import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M42 — Feature Flags + Maintenance Windows + Training Mode (e2e)
 *
 * Validates:
 *   - GET    /flags returns the seeded flags
 *   - POST   /flags creates a flag and writes a FLAG_CREATED audit row
 *   - PATCH  /flags/:key toggles status and writes a FLAG_DISABLED audit row
 *   - GET    /flags/audit lists the audit trail
 *   - POST   /maintenance-windows creates a SCHEDULED window and audits
 *   - PATCH  /maintenance-windows/:id → ACTIVE blocks INVENTORY writes (409),
 *     then transition to COMPLETED unblocks (back to 201)
 *   - POST   /training/start happy path; second start for same actor → 403
 *   - x-training-session-id header short-circuits inventory adjustment
 *     (returns inTraining: true; no real StockAdjustment row persisted)
 *   - POST   /training/:id/end completes the session
 *   - chef token cannot read/write flags (403)
 */
describe('M42 Control Plane (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ownerToken: string;
    let chefToken: string;
    let orgId: string;
    let branchId: string;
    let inventoryItemId: string;

    const flagKey = `e2e_m42_${Date.now()}`;
    const windowCode = `e2e-m42-window-${Date.now()}`;
    let createdFlagId: string | undefined;
    let createdWindowId: string | undefined;
    let createdTrainingId: string | undefined;
    const stockAdjustmentIdsBefore: Set<string> = new Set();

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
        );
        await app.init();
        prisma = moduleFixture.get(PrismaService);

        const ownerLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'owner@demo.local', password: 'Owner#123' });
        ownerToken = ownerLogin.body.accessToken;

        const chefLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'chef@demo.local', password: 'Chef#123' });
        chefToken = chefLogin.body.accessToken;

        const owner = await prisma.user.findUnique({ where: { email: 'owner@demo.local' } });
        // Use the SAME membership row that the control-plane controller's
        // `resolveOrgId` will pick (Prisma's natural insertion order on
        // findFirst), so the maintenance window we create lands in the same
        // org as the inventory branch we'll write to below.
        const m = await prisma.membership.findFirst({
            where: { userId: owner!.id, status: 'ACTIVE' },
        });
        orgId = m!.organizationId;
        branchId = m!.branchId!;

        // Create (or reuse) a dedicated test inventory item for this branch.
        const itemRes = await request(app.getHttpServer())
            .post('/api/inventory/items')
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId)
            .send({
                name: `M42 E2E Item ${Date.now()}`,
                unit: 'kg',
                category: 'Produce',
                theoreticalUnitCost: '1.000',
                reorderLevel: '5.000',
                reorderQty: '20.000',
            });
        inventoryItemId = itemRes.body.id;

        // Snapshot existing adjustment ids so we can prove the training-mode
        // request did not persist a new row.
        const existing = await prisma.stockAdjustment.findMany({
            where: { branchId },
            select: { id: true },
        });
        existing.forEach((r) => stockAdjustmentIdsBefore.add(r.id));
    }, 60000);

    afterAll(async () => {
        if (createdFlagId) {
            await prisma.flagAudit
                .deleteMany({ where: { flagId: createdFlagId } })
                .catch(() => undefined);
            await prisma.featureFlag
                .delete({ where: { id: createdFlagId } })
                .catch(() => undefined);
        }
        if (createdWindowId) {
            await prisma.flagAudit
                .deleteMany({ where: { maintenanceWindowId: createdWindowId } })
                .catch(() => undefined);
            await prisma.maintenanceWindow
                .delete({ where: { id: createdWindowId } })
                .catch(() => undefined);
        }
        if (createdTrainingId) {
            await prisma.flagAudit
                .deleteMany({ where: { trainingSessionId: createdTrainingId } })
                .catch(() => undefined);
            await prisma.trainingSession
                .delete({ where: { id: createdTrainingId } })
                .catch(() => undefined);
        }
        await app.close();
    });

    it('GET /api/flags returns seeded flags (owner)', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/flags')
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.items.length).toBeGreaterThanOrEqual(5);
        const keys = res.body.items.map((f: any) => f.key);
        expect(keys).toContain('training_mode_enabled');
    });

    it('POST /api/flags creates a flag and writes a FLAG_CREATED audit row', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/flags')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                key: flagKey,
                name: 'E2E M42 flag',
                description: 'Created by control-plane e2e suite',
                scope: 'ORG',
                status: 'ENABLED',
                rolloutPercent: 100,
            });
        expect(res.status).toBe(201);
        expect(res.body.key).toBe(flagKey);
        expect(res.body.status).toBe('ENABLED');
        createdFlagId = res.body.id;

        const audits = await request(app.getHttpServer())
            .get(`/api/flags/audit?flagId=${createdFlagId}`)
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(audits.status).toBe(200);
        const actions = audits.body.items.map((a: any) => a.action);
        expect(actions).toContain('FLAG_CREATED');
    });

    it('PATCH /api/flags/:key disables the flag and writes FLAG_DISABLED audit', async () => {
        const res = await request(app.getHttpServer())
            .patch(`/api/flags/${flagKey}`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ status: 'DISABLED', note: 'e2e disable' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('DISABLED');

        const audits = await request(app.getHttpServer())
            .get(`/api/flags/audit?flagId=${createdFlagId}`)
            .set('Authorization', `Bearer ${ownerToken}`);
        const actions = audits.body.items.map((a: any) => a.action);
        expect(actions).toContain('FLAG_DISABLED');
    });

    it('chef token cannot read flags (403)', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/flags')
            .set('Authorization', `Bearer ${chefToken}`);
        expect(res.status).toBe(403);
    });

    it('chef token cannot create flags (403)', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/flags')
            .set('Authorization', `Bearer ${chefToken}`)
            .send({ key: 'should-fail', name: 'should fail' });
        expect(res.status).toBe(403);
    });

    it('POST /api/maintenance-windows creates a SCHEDULED BLOCK_WRITES INVENTORY window', async () => {
        const startsAt = new Date(Date.now() - 5 * 60_000).toISOString();
        const endsAt = new Date(Date.now() + 60 * 60_000).toISOString();
        const res = await request(app.getHttpServer())
            .post('/api/maintenance-windows')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                code: windowCode,
                title: 'E2E inventory block',
                message: 'Inventory writes are paused for e2e test.',
                mode: 'BLOCK_WRITES',
                blockCategories: ['INVENTORY_WRITES'],
                startsAt,
                endsAt,
            });
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('SCHEDULED');
        expect(res.body.blockCategories).toContain('INVENTORY_WRITES');
        createdWindowId = res.body.id;
    });

    it('PATCH window → ACTIVE then inventory adjustment is blocked (409)', async () => {
        const activate = await request(app.getHttpServer())
            .patch(`/api/maintenance-windows/${createdWindowId}`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ status: 'ACTIVE' });
        expect(activate.status).toBe(200);
        expect(activate.body.status).toBe('ACTIVE');

        const adj = await request(app.getHttpServer())
            .post('/api/inventory/adjustments')
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId)
            .send({ itemId: inventoryItemId, qtyDelta: '1.000', reason: 'e2e blocked' });
        expect(adj.status).toBe(409);
        expect(String(adj.body.message ?? '')).toMatch(/maintenance/i);
    });

    it('PATCH window → COMPLETED restores inventory writes (201)', async () => {
        const complete = await request(app.getHttpServer())
            .patch(`/api/maintenance-windows/${createdWindowId}`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ status: 'COMPLETED' });
        expect(complete.status).toBe(200);
        expect(complete.body.status).toBe('COMPLETED');

        const adj = await request(app.getHttpServer())
            .post('/api/inventory/adjustments')
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId)
            .send({ itemId: inventoryItemId, qtyDelta: '1.000', reason: 'e2e unblocked' });
        expect(adj.status).toBe(201);
        expect(adj.body.id).toBeDefined();
        // Track for cleanup-friendly equality below
        stockAdjustmentIdsBefore.add(adj.body.id);
    });

    it('POST /api/training/start succeeds, second start for same actor → 403', async () => {
        const start = await request(app.getHttpServer())
            .post('/api/training/start')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                label: 'E2E training',
                purpose: 'e2e suite',
                mode: 'SIMULATION_ONLY',
                durationMinutes: 30,
            });
        expect(start.status).toBe(201);
        expect(start.body.status).toBe('ACTIVE');
        createdTrainingId = start.body.id;

        const dup = await request(app.getHttpServer())
            .post('/api/training/start')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ label: 'E2E training duplicate' });
        expect(dup.status).toBe(403);
    });

    it('x-training-session-id short-circuits inventory adjustment (no real row persisted)', async () => {
        const before = await prisma.stockAdjustment.count({ where: { branchId } });
        const res = await request(app.getHttpServer())
            .post('/api/inventory/adjustments')
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId)
            .set('x-training-session-id', createdTrainingId!)
            .send({ itemId: inventoryItemId, qtyDelta: '7.000', reason: 'training simulated' });
        expect(res.status).toBe(201);
        expect(res.body.inTraining).toBe(true);
        expect(res.body.simulated).toBe(true);
        expect(res.body.sessionId).toBe(createdTrainingId);
        const after = await prisma.stockAdjustment.count({ where: { branchId } });
        expect(after).toBe(before);
    });

    it('POST /api/training/:id/end completes the session', async () => {
        const res = await request(app.getHttpServer())
            .post(`/api/training/${createdTrainingId}/end`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ note: 'e2e end' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('COMPLETED');
    });
});
