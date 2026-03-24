import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M12 Discounts + Approval Workflow e2e tests.
 * Requires seeded DB with M12 permissions.
 */
describe('Discounts Approval Workflow (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let waiterToken: string;
  let chefToken: string;
  let branchId: string;
  let menuItemId: string;
  let orderId: string;
  let smallDiscountId: string;
  let largeDiscountId: string;
  let rejectDiscountId: string;

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

    // Login as owner (has pos:discount:request + pos:discount:approve + pos:discount:read)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as waiter (has pos:discount:request + pos:discount:read)
    const waiterLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'waiter@demo.local', password: 'Waiter#123' });
    waiterToken = waiterLogin.body.accessToken;

    // Login as chef (has pos:discount:read only)
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

    // Create an order for discount tests
    const createRes = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ serviceType: 'DINE_IN' })
      .expect(201);
    orderId = createRes.body.id;

    // Add items to the order to give it a subtotal
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ menuItemId, quantity: 3 })
      .expect(201);
  }, 90000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  // ── Small discount auto-approval ──

  it('POST /pos/orders/:id/discounts — small discount auto-approves', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/discounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        type: 'FIXED',
        value: 1000,
        reason: 'Loyalty customer',
      })
      .expect(201);

    expect(res.body.status).toBe('APPROVED');
    expect(res.body.orderId).toBe(orderId);
    smallDiscountId = res.body.id;
  });

  // ── Large discount creates pending ──

  it('POST /pos/orders/:id/discounts — large discount becomes PENDING', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/discounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        type: 'FIXED',
        value: 15000,
        reason: 'VIP guest special',
      })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    largeDiscountId = res.body.id;
  });

  // ── Approve large discount ──

  it('POST /pos/discounts/:id/approve — approves pending discount', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pos/discounts/${largeDiscountId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    expect(res.body.status).toBe('APPROVED');
    expect(res.body.approvedById).toBeDefined();
  });

  // ── Order totals updated after approval ──

  it('GET /pos/orders/:id — totals reflect approved discount', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/pos/orders/${orderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(parseFloat(res.body.discount)).toBeGreaterThan(0);
    expect(parseFloat(res.body.total)).toBeLessThan(parseFloat(res.body.subtotal));
  });

  // ── Create and reject discount ──

  it('POST /pos/orders/:id/discounts + POST /pos/discounts/:id/reject — reject works', async () => {
    // Create another large discount
    const createRes = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/discounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        type: 'FIXED',
        value: 8000,
        reason: 'Manager override test',
      })
      .expect(201);
    rejectDiscountId = createRes.body.id;

    // Reject it
    const rejectRes = await request(app.getHttpServer())
      .post(`/api/pos/discounts/${rejectDiscountId}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ rejectionReason: 'Not authorized for this amount' })
      .expect(200);

    expect(rejectRes.body.status).toBe('REJECTED');
  });

  // ── GET /pos/orders/:id/discounts ──

  it('GET /pos/orders/:id/discounts — lists all discounts', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/pos/orders/${orderId}/discounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
  });

  // ── Permission denial: chef cannot request discount ──

  it('POST /pos/orders/:id/discounts — chef gets 403 (no request permission)', async () => {
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/discounts`)
      .set('Authorization', `Bearer ${chefToken}`)
      .set('X-Branch-Id', branchId)
      .send({ type: 'FIXED', value: 500, reason: 'test' })
      .expect(403);
  });

  // ── Permission denial: waiter cannot approve ──

  it('POST /pos/discounts/:id/approve — waiter gets 403 (no approve permission)', async () => {
    // Create a pending discount first as owner
    const createRes = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/discounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ type: 'FIXED', value: 10000, reason: 'test pending' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/pos/discounts/${createRes.body.id}/approve`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(403);
  });

  // ── Invalid payload → 400 ──

  it('POST /pos/orders/:id/discounts — invalid payload returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/discounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ type: 'INVALID', value: -5 })
      .expect(400);
  });

  // ── Missing rejection reason → 400 ──

  it('POST /pos/discounts/:id/reject — missing reason returns 400', async () => {
    // Create pending discount
    const createRes = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/discounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ type: 'FIXED', value: 8000, reason: 'test' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/pos/discounts/${createRes.body.id}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(400);
  });

  // ── Missing branch header ──

  it('POST /pos/orders/:id/discounts — missing X-Branch-Id returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/discounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'FIXED', value: 500, reason: 'test' })
      .expect(400);
  });

  // ── Discount on closed order ──

  it('POST /pos/orders/:id/discounts — VOIDED order returns 409', async () => {
    // Create a new order and void it (NEW -> VOIDED — only 1 transition)
    const createRes = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ serviceType: 'TAKEAWAY' })
      .expect(201);
    const voidOrderId = createRes.body.id;

    // Void: NEW -> VOIDED (single transition)
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${voidOrderId}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    // Discount on voided order should return 409
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${voidOrderId}/discounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ type: 'FIXED', value: 500, reason: 'late discount' })
      .expect(409);
  }, 60000);

  // ── GET pending discounts ──

  it('GET /pos/discounts/pending — lists pending discounts for branch', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/pos/discounts/pending')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── Approve already-approved discount → 409 ──

  it('POST /pos/discounts/:id/approve — already approved returns 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/pos/discounts/${largeDiscountId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(409);
  });
});
