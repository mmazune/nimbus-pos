import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * BG3 — Reliability Rollout (e2e).
 *
 * Validates the BG3 facade behaviour across the risky write surfaces:
 *  - Idempotency-Key replay & payload-mismatch conflict on shifts.open
 *  - Idempotency does not create duplicate rows
 *  - Maintenance window blocks inventory.adjustments with 423
 *  - Training session short-circuits inventory.adjustments
 *  - Permission denial path still works (chef → 403)
 *
 * Runs against the seeded Neon DB. Requires `pnpm db:seed` to have completed.
 * BG3 introduces NO new permissions, so existing role grants are sufficient.
 */
describe('BG3 Reliability Rollout (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ownerToken: string;
    let chefToken: string;
    let ownerUserId: string;
    let orgId: string;
    let branchId: string;

    const key = (label: string) =>
        `bg3-${label}-${randomBytes(8).toString('hex')}`;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        await app.init();
        prisma = moduleFixture.get(PrismaService);

        const ownerLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'owner@demo.local', password: 'Owner#123' });
        expect([200, 201]).toContain(ownerLogin.status);
        ownerToken = ownerLogin.body.accessToken;
        ownerUserId = ownerLogin.body.user?.id ?? ownerLogin.body.userId;

        const me = await request(app.getHttpServer())
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${ownerToken}`)
            .expect(200);
        const ctx = me.body.context ?? me.body.memberships?.[0];
        orgId = ctx.defaultOrganizationId ?? ctx.organizationId ?? ctx.orgId;
        branchId = ctx.defaultBranchId ?? ctx.branchId;
        if (!ownerUserId) ownerUserId = me.body.user?.id ?? me.body.id;
        expect(orgId).toBeDefined();
        expect(branchId).toBeDefined();
        expect(ownerUserId).toBeDefined();

        const chefLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'chef@demo.local', password: 'Chef#123' });
        expect([200, 201]).toContain(chefLogin.status);
        chefToken = chefLogin.body.accessToken;
    }, 90000);

    afterAll(async () => {
        await app.close();
    });

    // ── A. Idempotency on shifts.open (replay + conflict + fresh) ──

    describe('A. Idempotency-Key on POST /api/shifts/open', () => {
        let activeShiftId: string;

        beforeAll(async () => {
            // Close any pre-existing OPEN shift for the owner so we get a clean slate.
            await prisma.shift.updateMany({
                where: { openedById: ownerUserId, branchId, status: 'OPEN' },
                data: { status: 'CLOSED', closedAt: new Date(), closedById: ownerUserId },
            });
        });

        afterAll(async () => {
            // Cleanup: close any shift we opened during the test.
            if (activeShiftId) {
                await prisma.shift.updateMany({
                    where: { id: activeShiftId, status: 'OPEN' },
                    data: { status: 'CLOSED', closedAt: new Date(), closedById: ownerUserId },
                });
            }
        });

        it('first call with Idempotency-Key creates the shift', async () => {
            const k = key('shift-open-1');
            const res = await request(app.getHttpServer())
                .post('/api/shifts/open')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send({ notes: 'bg3-first' });
            expect([200, 201]).toContain(res.status);
            expect(res.body.id).toBeDefined();
            expect(res.body.status).toBe('OPEN');
            activeShiftId = res.body.id;

            // Re-running the EXACT same key + payload must return the cached body.
            const replay = await request(app.getHttpServer())
                .post('/api/shifts/open')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send({ notes: 'bg3-first' });
            expect([200, 201]).toContain(replay.status);
            expect(replay.body.id).toBe(activeShiftId);

            // Verify no duplicate row was created.
            const cnt = await prisma.shift.count({
                where: { openedById: ownerUserId, branchId, status: 'OPEN' },
            });
            expect(cnt).toBe(1);
        }, 30000);

        it('same Idempotency-Key + different payload → 409 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH', async () => {
            const k = key('shift-open-mismatch');
            const first = await request(app.getHttpServer())
                .post('/api/shifts/open')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send({ notes: 'mismatch-A' });
            // Even if the 2nd open fails business-wise (already active), the
            // idempotency record was created for the first call. So we trigger
            // first against a fresh key, then conflict with a different body.
            // The first call may succeed (already-active replay) or 4xx — what
            // matters is the 2nd call with a DIFFERENT body returns 409 mismatch.
            void first;

            const conflict = await request(app.getHttpServer())
                .post('/api/shifts/open')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send({ notes: 'mismatch-B-different' })
                .expect(409);
            expect(conflict.body.code ?? conflict.body.message?.code).toBe(
                'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
            );
        }, 30000);

        it('malformed Idempotency-Key → 400 IDEMPOTENCY_KEY_INVALID', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/shifts/open')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', 'short')
                .send({ notes: 'bad-key' })
                .expect(400);
            expect(res.body.code ?? res.body.message?.code).toBe(
                'IDEMPOTENCY_KEY_INVALID',
            );
        });

        it('chef without pos:shift:open → 403 (BG3 must not weaken auth)', async () => {
            await request(app.getHttpServer())
                .post('/api/shifts/open')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', key('shift-chef'))
                .send({ notes: 'chef' })
                .expect(403);
        });
    });

    // ── B. Maintenance window blocking on inventory.adjustments ──

    describe('B. Maintenance window blocks POST /api/inventory/adjustments', () => {
        let windowId: string;
        let itemId: string;

        beforeAll(async () => {
            const item = await prisma.inventoryItem.findFirst({
                where: { orgId },
                select: { id: true },
            });
            expect(item).toBeTruthy();
            itemId = item!.id;

            const win = await prisma.maintenanceWindow.create({
                data: {
                    orgId,
                    branchId: null,
                    code: `bg3-test-${randomBytes(4).toString('hex')}`,
                    title: 'BG3 e2e: block inventory writes',
                    mode: 'BLOCK_WRITES' as any,
                    status: 'ACTIVE',
                    blockCategories: ['INVENTORY_WRITES'] as any,
                    startsAt: new Date(Date.now() - 60_000),
                    endsAt: new Date(Date.now() + 5 * 60_000),
                    createdById: ownerUserId,
                    updatedById: ownerUserId,
                },
            });
            windowId = win.id;
        });

        afterAll(async () => {
            if (windowId) {
                await prisma.maintenanceWindow.update({
                    where: { id: windowId },
                    data: { status: 'COMPLETED', deactivatedAt: new Date() },
                });
            }
        });

        it('returns 409 with MAINTENANCE_WINDOW_ACTIVE while window active (M42 service-layer block honoured)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/inventory/adjustments')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', key('inv-blocked'))
                .send({ itemId, qtyDelta: '1', reason: 'bg3-blocked' })
                .expect(409);
            const body = res.body.message ?? res.body;
            expect(body.code ?? res.body.code).toBe('MAINTENANCE_WINDOW_ACTIVE');
            expect(body.windowId ?? res.body.windowId).toBe(windowId);
        });

        it('succeeds again after the window is deactivated', async () => {
            await prisma.maintenanceWindow.update({
                where: { id: windowId },
                data: { status: 'COMPLETED', deactivatedAt: new Date() },
            });
            const res = await request(app.getHttpServer())
                .post('/api/inventory/adjustments')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', key('inv-after'))
                .send({ itemId, qtyDelta: '1', reason: 'bg3-after-window' });
            expect([200, 201]).toContain(res.status);
        });
    });

    // ── C. Training mode short-circuit on inventory.adjustments ──

    describe('C. Training-mode simulator on POST /api/inventory/adjustments', () => {
        let trainingId: string;
        let itemId: string;

        beforeAll(async () => {
            const item = await prisma.inventoryItem.findFirst({
                where: { orgId },
                select: { id: true },
            });
            itemId = item!.id;

            const session = await prisma.trainingSession.create({
                data: {
                    orgId,
                    actorUserId: ownerUserId,
                    label: 'BG3 e2e training',
                    mode: 'SIMULATION_ONLY' as any,
                    status: 'ACTIVE',
                    expiresAt: new Date(Date.now() + 5 * 60_000),
                },
            });
            trainingId = session.id;
        });

        afterAll(async () => {
            if (trainingId) {
                await prisma.trainingSession.update({
                    where: { id: trainingId },
                    data: { status: 'COMPLETED', endedAt: new Date() },
                });
            }
        });

        it('returns simulated body with _training marker and creates no real adjustment row', async () => {
            const before = await prisma.stockAdjustment.count({
                where: { orgId, branchId, itemId, reason: 'bg3-training' },
            });

            const res = await request(app.getHttpServer())
                .post('/api/inventory/adjustments')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', key('inv-train'))
                .set('x-training-session-id', trainingId)
                .send({ itemId, qtyDelta: '5', reason: 'bg3-training' });
            expect([200, 201]).toContain(res.status);
            expect(res.body._training).toBeDefined();
            expect(res.body._training.simulated).toBe(true);
            expect(res.body._training.trainingSessionId).toBe(trainingId);
            expect(res.body._training.scope).toBe('inventory.adjustments.create');
            expect(res.body.status).toBe('SIMULATED');

            const after = await prisma.stockAdjustment.count({
                where: { orgId, branchId, itemId, reason: 'bg3-training' },
            });
            expect(after).toBe(before);
        });
    });
});
