import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * BG4.A — Receipts Surface (e2e).
 *
 * Validates the receipt read / reprint / send / history endpoints over
 * a synthetic CLOSED order plus its captured Payment row. No new
 * schema is introduced; receipt id == orderId. Reprint and send are
 * wrapped by the BG3 facade so Idempotency-Key behaviour is exercised
 * end-to-end as part of this suite.
 *
 * Requires `pnpm db:seed` to have run so pos:receipt:* perms are
 * granted to Owner / Cashier and denied to Chef.
 */
describe('BG4.A Receipts Surface (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ownerToken: string;
    let chefToken: string;
    let ownerUserId: string;
    let orgId: string;
    let branchId: string;
    let receiptId: string;

    const idemKey = (label: string) =>
        `bg4a-${label}-${randomBytes(8).toString('hex')}`;

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

        const chefLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'chef@demo.local', password: 'Chef#123' });
        expect([200, 201]).toContain(chefLogin.status);
        chefToken = chefLogin.body.accessToken;

        // Build a synthetic CLOSED order + completed Payment so we have
        // a printable receipt to operate on.
        const suffix = randomBytes(4).toString('hex').toUpperCase();
        const order = await prisma.order.create({
            data: {
                orgId,
                branchId,
                userId: ownerUserId,
                orderNumber: `BG4A-${suffix}`,
                status: 'CLOSED' as any,
                serviceType: 'DINE_IN' as any,
                subtotal: '20.00' as any,
                tax: '2.00' as any,
                discount: '0.00' as any,
                total: '22.00' as any,
            },
        });
        receiptId = order.id;

        await prisma.payment.create({
            data: {
                orgId,
                branchId,
                orderId: order.id,
                amount: '22.00' as any,
                method: 'CASH' as any,
                status: 'COMPLETED' as any,
                captureMode: 'ONLINE_PROVIDER' as any,
                verificationStatus: 'NOT_REQUIRED' as any,
                postedAt: new Date(),
            },
        });
    }, 90000);

    afterAll(async () => {
        if (receiptId) {
            await prisma.payment.deleteMany({ where: { orderId: receiptId } });
            await prisma.auditLog.deleteMany({
                where: { entityType: 'receipt', entityId: receiptId },
            });
            await prisma.order.deleteMany({ where: { id: receiptId } });
        }
        await app.close();
    });

    // ── A. GET /api/receipts/:id ──

    describe('A. GET /api/receipts/:id', () => {
        it('returns the normalized receipt for a closed order (Owner)', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/receipts/${receiptId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(200);

            expect(res.body.receiptId).toBe(receiptId);
            expect(res.body.orderId).toBe(receiptId);
            expect(res.body.status).toBe('CLOSED');
            expect(res.body.totals.total).toBe('22.00');
            expect(res.body.totals.paid).toBe('22.00');
            expect(res.body.totals.outstanding).toBe('0.00');
            expect(Array.isArray(res.body.payments)).toBe(true);
            expect(res.body.payments.length).toBeGreaterThanOrEqual(1);
            expect(res.body.history).toMatchObject({
                viewedCount: expect.any(Number),
                reprintCount: expect.any(Number),
                sentCount: expect.any(Number),
            });
            expect(res.body.branch?.id).toBe(branchId);
        });

        it('chef without pos:receipt:read → 403', async () => {
            await request(app.getHttpServer())
                .get(`/api/receipts/${receiptId}`)
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .expect(403);
        });

        it('unknown receipt id → 404', async () => {
            await request(app.getHttpServer())
                .get(`/api/receipts/clxxxxnotfound000000000000`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(404);
        });
    });

    // ── B. POST /api/receipts/:id/reprint ──

    describe('B. POST /api/receipts/:id/reprint', () => {
        it('records a RECEIPT_REPRINTED audit row and returns the printable receipt', async () => {
            const res = await request(app.getHttpServer())
                .post(`/api/receipts/${receiptId}/reprint`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ reason: 'Customer requested copy', copies: 2 })
                .expect(200);

            expect(res.body.action).toBe('RECEIPT_REPRINTED');
            expect(res.body.receiptId).toBe(receiptId);
            expect(res.body.copies).toBe(2);
            expect(res.body.printable.totals.total).toBe('22.00');

            const audit = await prisma.auditLog.findFirst({
                where: { entityType: 'receipt', entityId: receiptId, action: 'RECEIPT_REPRINTED' },
                orderBy: { createdAt: 'desc' },
            });
            expect(audit).toBeTruthy();
        });

        it('Idempotency-Key replay returns the cached body and only audits once', async () => {
            const k = idemKey('reprint-replay');
            const first = await request(app.getHttpServer())
                .post(`/api/receipts/${receiptId}/reprint`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send({ reason: 'replay-test', copies: 1 })
                .expect(200);

            const before = await prisma.auditLog.count({
                where: {
                    entityType: 'receipt',
                    entityId: receiptId,
                    action: 'RECEIPT_REPRINTED',
                    metadata: { path: ['reason'], equals: 'replay-test' } as any,
                },
            });

            const replay = await request(app.getHttpServer())
                .post(`/api/receipts/${receiptId}/reprint`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send({ reason: 'replay-test', copies: 1 })
                .expect(200);

            expect(replay.body.action).toBe('RECEIPT_REPRINTED');
            expect(replay.body.reprintedAt).toBe(first.body.reprintedAt);

            const after = await prisma.auditLog.count({
                where: {
                    entityType: 'receipt',
                    entityId: receiptId,
                    action: 'RECEIPT_REPRINTED',
                    metadata: { path: ['reason'], equals: 'replay-test' } as any,
                },
            });
            expect(after).toBe(before);
        }, 30000);

        it('chef without pos:receipt:reprint → 403', async () => {
            await request(app.getHttpServer())
                .post(`/api/receipts/${receiptId}/reprint`)
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ reason: 'denied' })
                .expect(403);
        });
    });

    // ── C. POST /api/receipts/:id/send ──

    describe('C. POST /api/receipts/:id/send', () => {
        it('returns 202 PENDING with supported:false (no live adapter)', async () => {
            const res = await request(app.getHttpServer())
                .post(`/api/receipts/${receiptId}/send`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ channel: 'email', recipient: 'guest@example.com' })
                .expect(202);

            expect(res.body.action).toBe('RECEIPT_SENT');
            expect(res.body.status).toBe('PENDING');
            expect(res.body.supported).toBe(false);
            expect(res.body.reason).toBe('NO_LIVE_DELIVERY_ADAPTER');
            expect(res.body.channel).toBe('email');
            // Recipient must be masked.
            expect(res.body.recipient).not.toBe('guest@example.com');
            expect(res.body.deliveryId).toMatch(/^rcpt-dlv-/);
        });

        it('rejects unknown channel with 400', async () => {
            await request(app.getHttpServer())
                .post(`/api/receipts/${receiptId}/send`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ channel: 'pigeon', recipient: 'x@y.com' })
                .expect(400);
        });

        it('Idempotency-Key replay returns the same deliveryId', async () => {
            const k = idemKey('send-replay');
            const first = await request(app.getHttpServer())
                .post(`/api/receipts/${receiptId}/send`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send({ channel: 'sms', recipient: '+256700000000' })
                .expect(202);
            const replay = await request(app.getHttpServer())
                .post(`/api/receipts/${receiptId}/send`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send({ channel: 'sms', recipient: '+256700000000' })
                .expect(202);
            expect(replay.body.deliveryId).toBe(first.body.deliveryId);
        }, 30000);

        it('chef without pos:receipt:send → 403', async () => {
            await request(app.getHttpServer())
                .post(`/api/receipts/${receiptId}/send`)
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ channel: 'email', recipient: 'a@b.com' })
                .expect(403);
        });
    });

    // ── D. GET /api/receipts/:id/history ──

    describe('D. GET /api/receipts/:id/history', () => {
        it('returns audit rows for the receipt (read + reprint + send seen above)', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/receipts/${receiptId}/history`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(200);

            expect(res.body.receiptId).toBe(receiptId);
            expect(typeof res.body.total).toBe('number');
            expect(Array.isArray(res.body.data)).toBe(true);
            const actions = new Set(res.body.data.map((r: { action: string }) => r.action));
            expect(actions.has('RECEIPT_VIEWED')).toBe(true);
            expect(actions.has('RECEIPT_REPRINTED')).toBe(true);
            expect(actions.has('RECEIPT_SENT')).toBe(true);
        });

        it('respects pagination (page=1 pageSize=1)', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/receipts/${receiptId}/history?page=1&pageSize=1`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .expect(200);
            expect(res.body.data.length).toBeLessThanOrEqual(1);
            expect(res.body.pageSize).toBe(1);
        });
    });
});
