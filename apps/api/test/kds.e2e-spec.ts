import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M11 KDS + Station Routing e2e tests.
 * Requires seeded DB with M11 permissions.
 */
describe('KDS Station Routing (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let _waiterToken: string;
  let branchId: string;
  let menuItemId: string;
  let orderId: string;
  let ticketId: string;

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

    // Login as waiter (may not have kds perms)
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

    // Get a menu item (KITCHEN station)
    const menuRes = await request(app.getHttpServer())
      .get('/api/menu/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId);
    const items = menuRes.body?.data || menuRes.body || [];
    const kitchenItem = items.find((i: any) => i.station === 'KITCHEN');
    menuItemId = kitchenItem?.id || items[0]?.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── Setup: create and send an order ──

  it('should create an order and send it (KDS tickets created)', async () => {
    // Create order
    const createRes = await request(app.getHttpServer())
      .post('/api/pos/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ serviceType: 'TAKEAWAY' })
      .expect(201);

    orderId = createRes.body.id;
    expect(orderId).toBeDefined();

    // Add item
    await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ menuItemId, quantity: 2 })
      .expect(201);

    // Send order → triggers KDS ticket creation
    const sendRes = await request(app.getHttpServer())
      .post(`/api/pos/orders/${orderId}/send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(200);

    expect(sendRes.body.status).toBe('SENT');
  }, 60000);

  // ── Queue ──

  it('GET /api/kds/queue — should return queue with tickets', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/kds/queue')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);

    // Find our ticket
    const ourTicket = res.body.data.find((t: any) => t.orderId === orderId);
    if (ourTicket) {
      expect(ourTicket.urgencyState).toBeDefined();
      expect(ourTicket.elapsedSeconds).toBeGreaterThanOrEqual(0);
      expect(ourTicket.amberAtSeconds).toBeGreaterThan(0);
      expect(ourTicket.redAtSeconds).toBeGreaterThan(0);
      expect(ourTicket.items).toBeInstanceOf(Array);
      ticketId = ourTicket.id;
    }
  }, 30000);

  it('GET /api/kds/queue?station=KITCHEN — filter by station', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/kds/queue?station=KITCHEN')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    for (const ticket of res.body.data) {
      expect(ticket.station).toBe('KITCHEN');
    }
  }, 30000);

  it('GET /api/kds/queue — missing branch header → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/kds/queue')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  }, 30000);

  it('GET /api/kds/queue — no auth → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/kds/queue')
      .set('X-Branch-Id', branchId)
      .expect(401);
  }, 30000);

  // ── Mark Ready ──

  it('POST /api/kds/tickets/:id/mark-ready — mark ticket ready', async () => {
    // Ensure we have a ticket ID
    if (!ticketId) {
      const queueRes = await request(app.getHttpServer())
        .get('/api/kds/queue')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);
      ticketId = queueRes.body.data?.[0]?.id;
    }

    if (!ticketId) {
      console.warn('No KDS ticket found for mark-ready test — skipping');
      return;
    }

    const res = await request(app.getHttpServer())
      .post(`/api/kds/tickets/${ticketId}/mark-ready`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(201);

    expect(res.body.status).toBe('READY');
    expect(res.body.readyAt).toBeDefined();
  }, 30000);

  it('POST /api/kds/tickets/:id/mark-ready — already ready → 409', async () => {
    if (!ticketId) return;

    await request(app.getHttpServer())
      .post(`/api/kds/tickets/${ticketId}/mark-ready`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(409);
  }, 30000);

  // ── Recall ──

  it('POST /api/kds/tickets/:id/recall — recall READY ticket', async () => {
    if (!ticketId) return;

    const res = await request(app.getHttpServer())
      .post(`/api/kds/tickets/${ticketId}/recall`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(201);

    expect(res.body.status).toBe('RECALLED');
  }, 30000);

  it('POST /api/kds/tickets/:id/recall — non-READY → 409', async () => {
    if (!ticketId) return;

    // Ticket is now RECALLED, so recall again should fail
    await request(app.getHttpServer())
      .post(`/api/kds/tickets/${ticketId}/recall`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(409);
  }, 30000);

  // ── SLA Config ──

  it('GET /api/kds/sla-config/KITCHEN — returns defaults', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/kds/sla-config/KITCHEN')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.station).toBe('KITCHEN');
    expect(res.body.greenSeconds).toBeGreaterThan(0);
    expect(res.body.amberSeconds).toBeGreaterThan(res.body.greenSeconds);
    expect(res.body.redSeconds).toBeGreaterThan(res.body.amberSeconds);
  }, 30000);

  it('PATCH /api/kds/sla-config/KITCHEN — update SLA', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/kds/sla-config/KITCHEN')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        greenSeconds: 120,
        amberSeconds: 360,
        redSeconds: 600,
      })
      .expect(200);

    expect(res.body.greenSeconds).toBe(120);
    expect(res.body.amberSeconds).toBe(360);
    expect(res.body.redSeconds).toBe(600);
  }, 30000);

  it('PATCH /api/kds/sla-config/KITCHEN — invalid order → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/kds/sla-config/KITCHEN')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        greenSeconds: 600,
        amberSeconds: 300,
        redSeconds: 900,
      })
      .expect(400);
  }, 30000);

  // ── Nonexistent ticket ──

  it('POST /api/kds/tickets/nonexistent/mark-ready → 404', async () => {
    await request(app.getHttpServer())
      .post('/api/kds/tickets/nonexistent/mark-ready')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(404);
  }, 30000);
});
