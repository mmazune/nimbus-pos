import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M10 POS Orders e2e tests.
 * Run against real DB; seed must have been run beforehand.
 */
describe('POS Orders (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let _waiterToken: string;
  let branchId: string;
  let tableId: string;
  let menuItemId: string;
  let orderId: string;
  let orderItemId: string;

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

    // Login as owner
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as waiter
    const waiterLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'waiter@demo.local', password: 'Waiter#123' });
    _waiterToken = waiterLogin.body.accessToken;

    // Get branch ID
    const me = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    branchId =
      me.body.defaultBranch?.id ||
      me.body.organizations?.[0]?.branches?.[0]?.id ||
      me.body.branches?.[0]?.id ||
      me.body.memberships?.[0]?.branchId;

    // Get a table for dine-in tests
    const tablesRes = await request(app.getHttpServer())
      .get('/api/floor/tables')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId);
    tableId = tablesRes.body?.[0]?.id || tablesRes.body?.data?.[0]?.id;

    // Get a menu item for order item tests
    const menuRes = await request(app.getHttpServer())
      .get('/api/menu/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId);
    menuItemId = menuRes.body?.[0]?.id || menuRes.body?.data?.[0]?.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── Create Order ──

  it('POST /api/pos/orders — create dine-in order', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        serviceType: 'DINE_IN',
        tableId,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.orderNumber).toMatch(/^ORD-\d{6}$/);
    expect(res.body.status).toBe('NEW');
    expect(res.body.serviceType).toBe('DINE_IN');
    orderId = res.body.id;
  }, 30000);

  it('POST /api/pos/orders — create takeaway order', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        serviceType: 'TAKEAWAY',
      })
      .expect(201);

    expect(res.body.serviceType).toBe('TAKEAWAY');
    expect(res.body.tableId).toBeNull();
  }, 30000);

  it('POST /api/pos/orders — TAKEAWAY with tableId → 400', async () => {
    if (!tableId) {
      console.warn('No tableId available (floor tables empty) — skipping TAKEAWAY+tableId validation test');
      return;
    }
    await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        serviceType: 'TAKEAWAY',
        tableId,
      })
      .expect(400);
  }, 30000);

  it('POST /api/pos/orders — missing X-Branch-Id → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ serviceType: 'TAKEAWAY' })
      .expect(400);
  }, 30000);

  // ── List / Get ──

  it('GET /api/pos/orders — list orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('GET /api/pos/orders/:id — get order', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/pos/orders/${orderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.id).toBe(orderId);
    expect(res.body.items).toBeInstanceOf(Array);
  }, 30000);

  it('GET /api/pos/orders/:id — nonexistent → 404', async () => {
    await request(app.getHttpServer())
      .get('/api/pos/orders/nonexistent-id')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(404);
  }, 30000);

  // ── Order Items ──

  it('POST /api/pos/orders/:id/items — add item', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        menuItemId,
        quantity: 2,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.quantity).toBe(2);
    expect(res.body.menuItemId).toBe(menuItemId);
    orderItemId = res.body.id;
  }, 30000);

  it('PATCH /api/pos/orders/:id/items/:itemId — update quantity', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/pos/orders/${orderId}/items/${orderItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ quantity: 3 })
      .expect(200);

    expect(res.body.quantity).toBe(3);
  }, 30000);

  it('DELETE /api/pos/orders/:id/items/:itemId — remove item', async () => {
    // Add another item first to delete
    const addRes = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ menuItemId, quantity: 1 });
    const deleteItemId = addRes.body.id;

    await request(app.getHttpServer())
      .delete(`/api/pos/orders/${orderId}/items/${deleteItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);
  }, 30000);

  // ── State Machine Transitions ──

  it('POST /api/pos/orders/:id/send — NEW → SENT', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    expect(res.body.status).toBe('SENT');
  }, 30000);

  it('POST /api/pos/orders/:id/in-kitchen — SENT → IN_KITCHEN', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/in-kitchen`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    expect(res.body.status).toBe('IN_KITCHEN');
  }, 30000);

  it('POST /api/pos/orders/:id/ready — IN_KITCHEN → READY', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/ready`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    expect(res.body.status).toBe('READY');
  }, 30000);

  it('POST /api/pos/orders/:id/mark-served — READY → SERVED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/mark-served`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    expect(res.body.status).toBe('SERVED');
  }, 30000);

  it('POST /api/pos/orders/:id/close — SERVED → CLOSED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ payments: [{ method: 'CASH', amount: 9999 }] })
      .expect(200);

    expect(res.body.order.status).toBe('CLOSED');
  }, 30000);

  // ── Void ──

  it('POST /api/pos/orders/:id/void — void a NEW order', async () => {
    // Create a fresh order to void
    const createRes = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ serviceType: 'TAKEAWAY' });
    const voidOrderId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${voidOrderId}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    expect(res.body.status).toBe('VOIDED');
  }, 30000);

  it('POST /api/pos/orders/:id/void — post-kitchen void without reason → 400', async () => {
    // Create order and advance to IN_KITCHEN
    const createRes = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ serviceType: 'TAKEAWAY' });
    const id = createRes.body.id;

    await request(app.getHttpServer())
      .post(`/api/pos/orders/${id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({});

    await request(app.getHttpServer())
      .post(`/api/pos/orders/${id}/in-kitchen`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({});

    // Void without reason should fail
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${id}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(400);
  }, 30000);

  it('POST /api/pos/orders/:id/close — invalid transition from NEW → 409', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ serviceType: 'TAKEAWAY' });
    const id = createRes.body.id;

    await request(app.getHttpServer())
      .post(`/api/pos/orders/${id}/close`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ payments: [{ method: 'CASH', amount: 1 }] })
      .expect(409);
  }, 30000);
});
