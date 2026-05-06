import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * BG2 — Unified Approvals Inbox + Global Audit Timeline (e2e).
 *
 * Runs against the seeded Neon DB. Requires `pnpm db:seed` to have completed
 * (BG2 perms `approvals:read|decide` and `audit:read` granted to Owner).
 *
 * Strategy:
 *  - Create real Discount approval rows via the public POS endpoints (M12).
 *  - Drive them through the unified inbox (list → detail → decide).
 *  - Confirm the audit timeline read API surfaces the resulting events.
 *  - Confirm permission denial for a role without `approvals:read`.
 */
describe('BG2 Unified Approvals + Audit Timeline (e2e)', () => {
    let app: INestApplication;
    let _prisma: PrismaService;
    let ownerToken: string;
    let chefToken: string;
    let orgId: string;
    let branchId: string;
    let menuItemId: string;

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

        _prisma = moduleFixture.get(PrismaService);

        const ownerLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'owner@demo.local', password: 'Owner#123' });
        expect([200, 201]).toContain(ownerLogin.status);
        ownerToken = ownerLogin.body.accessToken;

        const me = await request(app.getHttpServer())
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${ownerToken}`)
            .expect(200);
        const ctx = me.body.context ?? me.body.memberships?.[0];
        orgId = ctx.defaultOrganizationId ?? ctx.organizationId ?? ctx.orgId;
        branchId = ctx.defaultBranchId ?? ctx.branchId;
        expect(orgId).toBeDefined();
        expect(branchId).toBeDefined();

        // Chef has no approvals:read → used to assert 403
        const chefLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'chef@demo.local', password: 'Chef#123' });
        expect([200, 201]).toContain(chefLogin.status);
        chefToken = chefLogin.body.accessToken;

        const menuRes = await request(app.getHttpServer())
            .get('/api/menu/items')
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId);
        const items = menuRes.body?.data || menuRes.body || [];
        menuItemId = items[0]?.id;
        expect(menuItemId).toBeDefined();
    }, 90000);

    afterAll(async () => {
        await app.close();
    });

    /** Helper: create a PENDING discount (large value) via the POS flow. */
    async function createPendingDiscount(reason: string): Promise<string> {
        const orderRes = await request(app.getHttpServer())
            .post('/api/pos/orders')
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId)
            .send({ serviceType: 'DINE_IN' })
            .expect(201);
        const orderId = orderRes.body.id;

        await request(app.getHttpServer())
            .post(`/api/pos/orders/${orderId}/items`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId)
            .send({ menuItemId, quantity: 3 })
            .expect(201);

        const discountRes = await request(app.getHttpServer())
            .post(`/api/pos/orders/${orderId}/discounts`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId)
            .send({ type: 'FIXED', value: 15000, reason })
            .expect(201);
        expect(discountRes.body.status).toBe('PENDING');
        return discountRes.body.id as string;
    }

    // ── A. Inbox listing ──

    describe('GET /api/approvals', () => {
        let pendingDiscountId: string;

        beforeAll(async () => {
            pendingDiscountId = await createPendingDiscount(`bg2-list-${Date.now()}`);
        });

        it('returns paginated PENDING items including our new discount', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/approvals?status=PENDING&pageSize=100')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(200);

            expect(Array.isArray(res.body.data)).toBe(true);
            expect(typeof res.body.total).toBe('number');
            const ids: string[] = res.body.data.map((r: { id: string }) => r.id);
            expect(ids).toContain(`discount--${pendingDiscountId}`);

            const row = res.body.data.find((r: { id: string }) => r.id === `discount--${pendingDiscountId}`);
            expect(row.sourceType).toBe('discount');
            expect(row.status).toBe('PENDING');
            expect(row.actionsAvailable).toEqual(expect.arrayContaining(['APPROVE', 'REJECT']));
        });

        it('filter by sourceType=discount returns only discount rows', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/approvals?status=PENDING&sourceType=discount')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(200);
            for (const row of res.body.data) {
                expect(row.sourceType).toBe('discount');
            }
        });

        it('rejects unsupported sourceType with 400', async () => {
            await request(app.getHttpServer())
                .get('/api/approvals?sourceType=not_a_real_source')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(400);
        });

        it('returns 403 for a role without approvals:read', async () => {
            await request(app.getHttpServer())
                .get('/api/approvals')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .expect(403);
        });
    });

    // ── B. Detail ──

    describe('GET /api/approvals/:id', () => {
        let id: string;
        beforeAll(async () => {
            id = `discount--${await createPendingDiscount(`bg2-detail-${Date.now()}`)}`;
        });

        it('returns the wrapped item + raw entity', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/approvals/${id}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(200);
            expect(res.body.id).toBe(id);
            expect(res.body.sourceType).toBe('discount');
            expect(res.body.summary).toBeDefined();
            expect(res.body.summary.status).toBe('PENDING');
            expect(res.body.source).toBeDefined();
            expect(res.body.source.status).toBe('PENDING');
        });

        it('returns 400 for a malformed approval id', async () => {
            await request(app.getHttpServer())
                .get('/api/approvals/not-a-valid-id')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(400);
        });

        it('returns 404 for unknown discount id', async () => {
            await request(app.getHttpServer())
                .get('/api/approvals/discount--clxxxxxxxxxxxxxxxxxxxxxxx')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(404);
        });
    });

    // ── C. Decide (REJECT then re-decide → 409) ──

    describe('POST /api/approvals/:id/decide — REJECT', () => {
        let id: string;
        beforeAll(async () => {
            id = `discount--${await createPendingDiscount(`bg2-reject-${Date.now()}`)}`;
        });

        it('rejects a pending discount via the inbox', async () => {
            const res = await request(app.getHttpServer())
                .post(`/api/approvals/${id}/decide`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ decision: 'REJECT', reason: 'Inbox e2e reject' })
                .expect(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.decision).toBe('REJECT');
            expect(res.body.source).toBe('discount');
            expect(res.body.finalStatus).toBe('REJECTED');
        });

        it('repeating the decision returns 409', async () => {
            await request(app.getHttpServer())
                .post(`/api/approvals/${id}/decide`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ decision: 'REJECT', reason: 'second time' })
                .expect(409);
        });

        it('validation: missing decision → 400', async () => {
            const id2 = `discount--${await createPendingDiscount(`bg2-val-${Date.now()}`)}`;
            await request(app.getHttpServer())
                .post(`/api/approvals/${id2}/decide`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ reason: 'no decision' })
                .expect(400);
        });
    });

    // ── D. Decide APPROVE ──

    describe('POST /api/approvals/:id/decide — APPROVE', () => {
        let id: string;
        beforeAll(async () => {
            id = `discount--${await createPendingDiscount(`bg2-approve-${Date.now()}`)}`;
        });

        it('approves a pending discount via the inbox', async () => {
            const res = await request(app.getHttpServer())
                .post(`/api/approvals/${id}/decide`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ decision: 'APPROVE' })
                .expect(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.decision).toBe('APPROVE');
            expect(res.body.source).toBe('discount');
            expect(res.body.finalStatus).toBe('APPROVED');
        });

        it('decision endpoint requires approvals:decide → 403 for chef', async () => {
            const id2 = `discount--${await createPendingDiscount(`bg2-perm-${Date.now()}`)}`;
            await request(app.getHttpServer())
                .post(`/api/approvals/${id2}/decide`)
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ decision: 'APPROVE' })
                .expect(403);
        });
    });

    // ── E. Audit timeline ──

    describe('GET /api/audit/timeline', () => {
        it('returns UNIFIED_APPROVAL_DECIDED rows after BG2 decisions', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/audit/timeline?actionPrefix=UNIFIED_APPROVAL_&pageSize=100')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(200);

            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.total).toBeGreaterThan(0);
            const actions: string[] = res.body.data.map((r: { action: string }) => r.action);
            expect(actions).toEqual(expect.arrayContaining(['UNIFIED_APPROVAL_DECIDED']));
            const first = res.body.data[0];
            expect(first.orgId).toBe(orgId);
            expect(first.sourceModule).toBe('unified-approvals');
        });

        it('filter by exact action + dateFrom returns recent rows', async () => {
            const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const res = await request(app.getHttpServer())
                .get(`/api/audit/timeline?action=UNIFIED_APPROVAL_DECIDED&dateFrom=${encodeURIComponent(since)}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(200);
            for (const r of res.body.data) {
                expect(r.action).toBe('UNIFIED_APPROVAL_DECIDED');
                expect(new Date(r.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(since).getTime());
            }
        });

        it('returns 403 for a role without audit:read', async () => {
            await request(app.getHttpServer())
                .get('/api/audit/timeline')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .expect(403);
        });
    });
});
