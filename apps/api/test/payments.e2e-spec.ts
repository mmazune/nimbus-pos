import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M13 Payments e2e tests.
 * Requires seeded DB with M13 permissions.
 */
describe('Payments (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let cashierToken: string;
  let chefToken: string;
  let branchId: string;
  let menuItemId: string;
  let orderId: string;
  let intentId: string;

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

    // Login as owner (has all pos:payment:* permissions)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as cashier (has pos:payment:create + close + intent + read)
    const cashierLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@demo.local', password: 'Cashier#123' });
    cashierToken = cashierLogin.body.accessToken;

    // Login as chef (has pos:payment:read only)
    const chefLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'chef@demo.local', password: 'Chef#123' });
    chefToken = chefLogin.body.accessToken;

    // Get branch ID
    const me = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    branchId =
      me.body.defaultBranch?.id ||
      me.body.organizations?.[0]?.branches?.[0]?.id ||
      me.body.branches?.[0]?.id ||
      me.body.memberships?.[0]?.branchId;

    // Get a menu item
    const menuRes = await request(app.getHttpServer())
      .get('/api/menu/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId);
    const items = menuRes.body?.data || menuRes.body || [];
    menuItemId = items[0]?.id;

    // Create an order, add items, advance to SERVED for close tests
    const createRes = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ serviceType: 'DINE_IN' })
      .expect(201);
    orderId = createRes.body.id;

    // Add items
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ menuItemId, quantity: 2 })
      .expect(201);

    // Advance: NEW → SENT
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    // Advance: SENT → IN_KITCHEN
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    // Advance: IN_KITCHEN → READY
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/ready`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    // Advance: READY → SERVED
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/serve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);
  }, 120000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  // ── Get Order Payments (empty initially) ──

  it('GET /pos/orders/:id/payments — returns empty initially', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/pos/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.payments).toEqual([]);
    expect(res.body.intents).toEqual([]);
  });

  // ── Create MOMO Intent ──

  it('POST /payments/intents — creates MOMO intent', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/payments/intents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        orderId,
        provider: 'MTN',
        amount: 10000,
        phoneNumber: '+256700000000',
      })
      .expect(201);

    expect(res.body.status).toBe('REQUIRES_ACTION');
    expect(res.body.provider).toBe('MTN');
    intentId = res.body.id;
  });

  // ── Cancel MOMO Intent ──

  it('POST /payments/intents/:id/cancel — cancels intent', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/payments/intents/${intentId}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ reason: 'Customer changed payment method' })
      .expect(200);

    expect(res.body.status).toBe('CANCELLED');
  });

  // ── Cancel already-cancelled intent → 409 ──

  it('POST /payments/intents/:id/cancel — already cancelled returns 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/payments/intents/${intentId}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(409);
  });

  // ── Close Order with Cash Payment ──

  it('POST /pos/orders/:id/close — closes order with cash payment', async () => {
    // Get order total first
    const orderRes = await request(app.getHttpServer())
      .get(`/api/pos/orders/${orderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);
    const orderTotal = parseFloat(orderRes.body.total);

    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        payments: [{ method: 'CASH', amount: orderTotal + 5 }],
      })
      .expect(200);

    expect(res.body.order.status).toBe('CLOSED');
    expect(res.body.payments.length).toBe(1);
    expect(parseFloat(res.body.changeDue)).toBeGreaterThan(0);
  });

  // ── Close already-closed order → 409 ──

  it('POST /pos/orders/:id/close — already closed returns 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        payments: [{ method: 'CASH', amount: 100 }],
      })
      .expect(409);
  });

  // ── Get Order Payments after close ──

  it('GET /pos/orders/:id/payments — returns payments after close', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/pos/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.payments.length).toBeGreaterThanOrEqual(1);
    expect(res.body.intents.length).toBeGreaterThanOrEqual(1);
  });

  // ── Webhook Endpoints ──

  it('POST /webhooks/mtn — persists webhook event', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/webhooks/mtn')
      .send({
        event_type: 'payment.completed',
        external_id: 'EXT-E2E-001',
        status: 'SUCCESSFUL',
        amount: 50000,
      })
      .expect(200);

    expect(res.body.webhookEventId).toBeDefined();
  });

  it('POST /webhooks/airtel — persists webhook event', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/webhooks/airtel')
      .send({
        eventType: 'transaction.success',
        transactionId: 'AIR-E2E-001',
        status: 'SUCCESS',
        amount: 30000,
      })
      .expect(200);

    expect(res.body.webhookEventId).toBeDefined();
  });

  // ── Permission denial: chef cannot close order ──

  it('POST /pos/orders/:id/close — chef gets 403', async () => {
    // Create another order for this test
    const createRes = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ serviceType: 'TAKEAWAY' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/pos/orders/${createRes.body.id}/close`)
      .set('Authorization', `Bearer ${chefToken}`)
      .set('X-Branch-Id', branchId)
      .send({ payments: [{ method: 'CASH', amount: 100 }] })
      .expect(403);
  });

  // ── Invalid payload → 400 ──

  it('POST /pos/orders/:id/close — empty payments array returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ payments: [] })
      .expect(400);
  });

  // ── Missing branch header → 400 ──

  it('POST /pos/orders/:id/close — missing X-Branch-Id returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ payments: [{ method: 'CASH', amount: 100 }] })
      .expect(400);
  });
});
