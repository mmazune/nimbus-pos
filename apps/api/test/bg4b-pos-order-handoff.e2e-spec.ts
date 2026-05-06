import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * BG4.B — POS Order Handoff Operations (e2e).
 *
 * Covers the six new endpoints under /api/pos/orders/*:
 *   1. POST /:id/split-bill        (non-physical bill split)
 *   2. POST /:id/split-items       (physical split → child order)
 *   3. POST /merge                 (absorb source into target)
 *   4. POST /:id/transfer-table
 *   5. POST /:id/transfer-server
 *   6. POST /:id/move-items
 *
 * Plus permission denial (Chef → 403), validation failures, conflict
 * states (closed/voided orders) and idempotency replay against the
 * BG3 reliability facade.
 *
 * Requires `pnpm db:seed` to have applied the BG4.B grants to
 * Owner / Manager / Cashier / Waiter (Chef intentionally denied).
 */
describe('BG4.B POS Order Handoff (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let ownerToken: string;
    let chefToken: string;
    let ownerUserId: string;
    let orgId: string;
    let branchId: string;

    // Reusable IDs
    let menuItemId: string;
    let secondTableId: string;
    let secondUserId: string;
    const createdOrderIds: string[] = [];

    const idemKey = (label: string) =>
        `bg4b-${label}-${randomBytes(8).toString('hex')}`;

    /** Create a synthetic open order with N line items for the test. */
    async function createTestOrder(opts: {
        status?: 'NEW' | 'SENT' | 'IN_KITCHEN' | 'READY' | 'SERVED' | 'CLOSED' | 'VOIDED';
        items?: { qty: number; price: string }[];
        tableId?: string | null;
    } = {}) {
        const status = opts.status ?? 'NEW';
        const items = opts.items ?? [{ qty: 2, price: '10.00' }];
        const suffix = randomBytes(4).toString('hex').toUpperCase();
        const subtotalNum = items.reduce(
            (s, i) => s + Number(i.price) * i.qty,
            0,
        );
        const order = await prisma.order.create({
            data: {
                orgId,
                branchId,
                userId: ownerUserId,
                tableId: opts.tableId ?? null,
                orderNumber: `BG4B-${suffix}`,
                status: status as any,
                serviceType: 'DINE_IN' as any,
                subtotal: subtotalNum.toFixed(2) as any,
                tax: '0.00' as any,
                discount: '0.00' as any,
                total: subtotalNum.toFixed(2) as any,
                items: {
                    create: items.map((i) => ({
                        menuItemId,
                        quantity: i.qty,
                        price: i.price as any,
                        subtotal: (Number(i.price) * i.qty).toFixed(2) as any,
                    })),
                },
            },
            include: { items: true },
        });
        createdOrderIds.push(order.id);
        return order;
    }

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

        // Pick a real menu item from the branch for line-item fixtures.
        const mi = await prisma.menuItem.findFirst({
            where: { orgId, branchId },
        });
        if (!mi) throw new Error('No seeded menu item — run pnpm db:seed first');
        menuItemId = mi.id;

        // Find a second active table in this branch (for transfer-table).
        const tables = await prisma.table.findMany({
            where: { orgId, branchId, isActive: true },
            take: 2,
        });
        if (tables.length < 2) {
            throw new Error('Need at least 2 active tables in seeded branch');
        }
        secondTableId = tables[1].id;

        // Find a second active user in this branch (for transfer-server).
        const otherMembership = await prisma.membership.findFirst({
            where: { branchId, status: 'ACTIVE', userId: { not: ownerUserId } },
        });
        if (!otherMembership) {
            throw new Error('Need at least one other active membership in seeded branch');
        }
        secondUserId = otherMembership.userId;
    }, 90000);

    afterAll(async () => {
        // Clean up everything we created. Orders and their items cascade.
        if (createdOrderIds.length) {
            await prisma.payment.deleteMany({
                where: { orderId: { in: createdOrderIds } },
            });
            await prisma.kdsTicketItem.deleteMany({
                where: { orderItem: { orderId: { in: createdOrderIds } } },
            }).catch(() => undefined);
            await prisma.kdsTicket.deleteMany({
                where: { orderId: { in: createdOrderIds } },
            });
            await prisma.auditLog.deleteMany({
                where: { entityType: 'order', entityId: { in: createdOrderIds } },
            });
            // Also wipe any split children we may have created via the API.
            const children = await prisma.order.findMany({
                where: { splitFromOrderId: { in: createdOrderIds } },
                select: { id: true },
            });
            const childIds = children.map((c) => c.id);
            if (childIds.length) {
                await prisma.kdsTicket.deleteMany({ where: { orderId: { in: childIds } } });
                await prisma.auditLog.deleteMany({
                    where: { entityType: 'order', entityId: { in: childIds } },
                });
                await prisma.order.deleteMany({ where: { id: { in: childIds } } });
            }
            await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
        }
        await app.close();
    });

    // ──────────────────────────────────────────────────────────────────
    // A) Split bill
    // ──────────────────────────────────────────────────────────────────
    describe('A. POST /api/pos/orders/:id/split-bill', () => {
        it('EQUAL split divides total exactly across N groups', async () => {
            const order = await createTestOrder({
                status: 'SERVED',
                items: [{ qty: 1, price: '30.00' }],
            });
            const res = await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/split-bill`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ mode: 'EQUAL', count: 3 })
                .expect(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.splitGroups).toHaveLength(3);
            expect(res.body.amountAllocated).toBe('30.00');
            expect(res.body.amountRemaining).toBe('0.00');
            // Each group sums to total
            const sum = res.body.splitGroups.reduce(
                (s: number, g: { amount: string }) => s + Number(g.amount),
                0,
            );
            expect(sum).toBeCloseTo(30, 2);
        });

        it('CUSTOM split rejects when group sum != order.total', async () => {
            const order = await createTestOrder({
                status: 'SERVED',
                items: [{ qty: 1, price: '30.00' }],
            });
            await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/split-bill`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    mode: 'CUSTOM',
                    groups: [{ amount: '10.00' }, { amount: '15.00' }],
                })
                .expect(400);
        });

        it('chef without pos:order:split → 403', async () => {
            const order = await createTestOrder({
                status: 'SERVED',
                items: [{ qty: 1, price: '20.00' }],
            });
            await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/split-bill`)
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ mode: 'EQUAL', count: 2 })
                .expect(403);
        });

        it('rejects when order is CLOSED', async () => {
            const order = await createTestOrder({
                status: 'CLOSED',
                items: [{ qty: 1, price: '20.00' }],
            });
            const res = await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/split-bill`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ mode: 'EQUAL', count: 2 })
                .expect(409);
            expect(res.body.message?.code ?? res.body.code).toBe('ORDER_NOT_OPEN_FOR_HANDOFF');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // B) Split items
    // ──────────────────────────────────────────────────────────────────
    describe('B. POST /api/pos/orders/:id/split-items', () => {
        it('partially splits an item into a NEW child order with splitFromOrderId set', async () => {
            const order = await createTestOrder({
                status: 'SENT',
                items: [{ qty: 4, price: '5.00' }],
            });
            const sourceItemId = order.items[0].id;
            const res = await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/split-items`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    items: [{ orderItemId: sourceItemId, quantity: 1 }],
                    reason: 'one diner leaving early',
                })
                .expect(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.childOrder.status).toBe('NEW');
            expect(res.body.childOrder.splitFromOrderId).toBe(order.id);
            expect(res.body.childOrder.items).toHaveLength(1);
            expect(res.body.childOrder.items[0].quantity).toBe(1);
            // Source order should now have qty=3 on the original line, total recomputed
            const refreshed = await prisma.order.findUnique({
                where: { id: order.id },
                include: { items: true },
            });
            expect(refreshed!.items[0].quantity).toBe(3);
            expect(Number(refreshed!.subtotal)).toBeCloseTo(15, 2);
            expect(Number(res.body.childOrder.subtotal)).toBeCloseTo(5, 2);
            // Child order tracked for cleanup
            createdOrderIds.push(res.body.childOrder.id);
        });

        it('rejects when requested quantity exceeds available', async () => {
            const order = await createTestOrder({
                status: 'NEW',
                items: [{ qty: 2, price: '5.00' }],
            });
            const res = await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/split-items`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    items: [{ orderItemId: order.items[0].id, quantity: 99 }],
                })
                .expect(400);
            expect(res.body.message?.code ?? res.body.code).toBe(
                'SPLIT_QUANTITY_EXCEEDS_SOURCE',
            );
        });

        it('idempotency replay returns same childOrder.id', async () => {
            const order = await createTestOrder({
                status: 'NEW',
                items: [{ qty: 4, price: '5.00' }],
            });
            const k = idemKey('split-items-replay');
            const body = {
                items: [{ orderItemId: order.items[0].id, quantity: 2 }],
                reason: 'idempotency replay test',
            };
            const first = await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/split-items`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send(body)
                .expect(200);
            const childId = first.body.childOrder.id;
            createdOrderIds.push(childId);

            const replay = await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/split-items`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', k)
                .send(body)
                .expect(200);
            expect(replay.body.childOrder.id).toBe(childId);

            // Source order should only have been mutated once: still qty=2 remaining
            const refreshed = await prisma.order.findUnique({
                where: { id: order.id },
                include: { items: true },
            });
            expect(refreshed!.items[0].quantity).toBe(2);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // C) Merge orders
    // ──────────────────────────────────────────────────────────────────
    describe('C. POST /api/pos/orders/merge', () => {
        it('absorbs source into target; source becomes VOIDED with mergedIntoOrderId', async () => {
            const source = await createTestOrder({
                status: 'NEW',
                items: [{ qty: 1, price: '7.00' }],
            });
            const target = await createTestOrder({
                status: 'NEW',
                items: [{ qty: 2, price: '4.00' }],
            });
            const res = await request(app.getHttpServer())
                .post(`/api/pos/orders/merge`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    sourceOrderId: source.id,
                    targetOrderId: target.id,
                    reason: 'guests rejoined same table',
                })
                .expect(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.sourceOrder.status).toBe('VOIDED');
            expect(res.body.sourceOrder.mergedIntoOrderId).toBe(target.id);
            expect(res.body.targetOrder.items.length).toBeGreaterThanOrEqual(2);
            // Target subtotal = 4*2 + 7*1 = 15
            expect(Number(res.body.targetOrder.subtotal)).toBeCloseTo(15, 2);
        });

        it('rejects merging an order into itself', async () => {
            const o = await createTestOrder({ status: 'NEW' });
            await request(app.getHttpServer())
                .post(`/api/pos/orders/merge`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceOrderId: o.id, targetOrderId: o.id })
                .expect(400);
        });

        it('rejects when source has captured payments', async () => {
            const source = await createTestOrder({ status: 'SERVED' });
            const target = await createTestOrder({ status: 'NEW' });
            await prisma.payment.create({
                data: {
                    orgId, branchId, orderId: source.id,
                    amount: '5.00' as any,
                    method: 'CASH' as any,
                    status: 'COMPLETED' as any,
                    captureMode: 'ONLINE_PROVIDER' as any,
                    verificationStatus: 'NOT_REQUIRED' as any,
                    postedAt: new Date(),
                },
            });
            const res = await request(app.getHttpServer())
                .post(`/api/pos/orders/merge`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceOrderId: source.id, targetOrderId: target.id })
                .expect(409);
            expect(res.body.message?.code ?? res.body.code).toBe('MERGE_SOURCE_HAS_PAYMENTS');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // D) Transfer table
    // ──────────────────────────────────────────────────────────────────
    describe('D. POST /api/pos/orders/:id/transfer-table', () => {
        it('updates Order.tableId and audits previous/new', async () => {
            const order = await createTestOrder({ status: 'SENT' });
            const res = await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/transfer-table`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ targetTableId: secondTableId, reason: 'window seat requested' })
                .expect(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.newTableId).toBe(secondTableId);
            const refreshed = await prisma.order.findUnique({ where: { id: order.id } });
            expect(refreshed!.tableId).toBe(secondTableId);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // E) Transfer server
    // ──────────────────────────────────────────────────────────────────
    describe('E. POST /api/pos/orders/:id/transfer-server', () => {
        it('reassigns Order.userId to a valid in-branch user', async () => {
            const order = await createTestOrder({ status: 'SENT' });
            const res = await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/transfer-server`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ targetUserId: secondUserId, reason: 'shift handover' })
                .expect(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.newUserId).toBe(secondUserId);
            const refreshed = await prisma.order.findUnique({ where: { id: order.id } });
            expect(refreshed!.userId).toBe(secondUserId);
        });

        it('rejects user with no membership in branch', async () => {
            const order = await createTestOrder({ status: 'SENT' });
            await request(app.getHttpServer())
                .post(`/api/pos/orders/${order.id}/transfer-server`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ targetUserId: 'cl_nonexistent_user_id_123' })
                .expect(403);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // F) Move items
    // ──────────────────────────────────────────────────────────────────
    describe('F. POST /api/pos/orders/:id/move-items', () => {
        it('moves items between two open orders and recomputes both totals', async () => {
            const source = await createTestOrder({
                status: 'SENT',
                items: [{ qty: 4, price: '5.00' }],
            });
            const target = await createTestOrder({
                status: 'SENT',
                items: [{ qty: 1, price: '8.00' }],
            });
            const res = await request(app.getHttpServer())
                .post(`/api/pos/orders/${source.id}/move-items`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    targetOrderId: target.id,
                    items: [{ orderItemId: source.items[0].id, quantity: 2 }],
                    reason: 'moved to new bill',
                })
                .expect(200);
            expect(res.body.ok).toBe(true);
            // source: 5*2=10, target: 8 + 5*2 = 18
            expect(Number(res.body.sourceOrder.subtotal)).toBeCloseTo(10, 2);
            expect(Number(res.body.targetOrder.subtotal)).toBeCloseTo(18, 2);
        });

        it('chef without pos:order:move-items → 403', async () => {
            const source = await createTestOrder({ status: 'SENT' });
            const target = await createTestOrder({ status: 'SENT' });
            await request(app.getHttpServer())
                .post(`/api/pos/orders/${source.id}/move-items`)
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    targetOrderId: target.id,
                    items: [{ orderItemId: source.items[0].id, quantity: 1 }],
                })
                .expect(403);
        });
    });
});
