import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M5 Floor Plans + Tables e2e tests.
 * Run against real DB; seed must have been run beforehand.
 */
describe('Floor (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let waiterToken: string;
  let branchId: string;
  let floorPlanId: string;
  let tableId: string;
  const suffix = Date.now().toString(36);

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

    // Login as owner (has pos:floor:write, pos:table:write)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as waiter (has pos:floor:read, pos:table:read but NOT write)
    const waiterLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'waiter@demo.local', password: 'Waiter#123' });
    waiterToken = waiterLogin.body.accessToken;

    // Get branch ID from /api/me
    const me = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    branchId =
      me.body.defaultBranch?.id ||
      me.body.organizations?.[0]?.branches?.[0]?.id ||
      me.body.branches?.[0]?.id ||
      me.body.memberships?.[0]?.branchId;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── Floor Plans ──

  it('POST /api/floor-plans — create floor plan (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/floor-plans')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Floor ${suffix}`, data: { layout: 'test' } })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`E2E Floor ${suffix}`);
    expect(res.body.isActive).toBe(true);
    floorPlanId = res.body.id;
  }, 30000);

  it('GET /api/floor-plans — list floor plans (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/floor-plans')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('GET /api/floor-plans/:id — get single floor plan', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/floor-plans/${floorPlanId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.id).toBe(floorPlanId);
    expect(res.body.name).toBe(`E2E Floor ${suffix}`);
  }, 30000);

  it('PATCH /api/floor-plans/:id — update floor plan', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/floor-plans/${floorPlanId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Updated ${suffix}` })
      .expect(200);

    expect(res.body.name).toBe(`E2E Updated ${suffix}`);
  }, 30000);

  // ── Tables ──

  it('POST /api/tables — create table (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/tables')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ label: `E2E-T1-${suffix}`, capacity: 6, floorPlanId })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.label).toBe(`E2E-T1-${suffix}`);
    expect(res.body.capacity).toBe(6);
    expect(res.body.status).toBe('AVAILABLE');
    tableId = res.body.id;
  }, 30000);

  it('GET /api/tables — list tables (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tables')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('GET /api/tables/:id — get single table', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/tables/${tableId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.id).toBe(tableId);
    expect(res.body.label).toBe(`E2E-T1-${suffix}`);
  }, 30000);

  it('PATCH /api/tables/:id — update table', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/tables/${tableId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ capacity: 8 })
      .expect(200);

    expect(res.body.capacity).toBe(8);
  }, 30000);

  it('PATCH /api/tables/:id/status — update table status (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/tables/${tableId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ status: 'OCCUPIED' })
      .expect(200);

    expect(res.body.status).toBe('OCCUPIED');
  }, 30000);

  // ── Availability ──

  it('GET /api/floor/availability — happy path', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/floor/availability')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total).toBeGreaterThanOrEqual(1);
    expect(res.body.tables).toBeDefined();
    expect(Array.isArray(res.body.tables)).toBe(true);
  }, 30000);

  // ── Validation / Error Cases ──

  it('missing X-Branch-Id → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/floor-plans')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  }, 30000);

  it('permission denial — waiter POST floor-plans → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/floor-plans')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: 'Waiter Floor' })
      .expect(403);
  }, 30000);

  it('permission denial — waiter POST tables → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/tables')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .send({ label: `WAITER-${suffix}` })
      .expect(403);
  }, 30000);

  it('invalid payload — missing name for floor plan → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/floor-plans')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({})
      .expect(400);
  }, 30000);

  it('invalid payload — bad status enum → 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/tables/${tableId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ status: 'INVALID_STATUS' })
      .expect(400);
  }, 30000);

  it('invalid payload — negative capacity → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/tables')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ label: `BAD-${suffix}`, capacity: -1 })
      .expect(400);
  }, 30000);

  it('invalid payload — forbidden extra field → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/floor-plans')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: 'Test', unknownField: true })
      .expect(400);
  }, 30000);

  it('cross-branch access — Downtown branch user cannot see Main branch floors if no membership', async () => {
    // Use a fake branch ID that the waiter is not a member of
    await request(app.getHttpServer())
      .get('/api/floor-plans')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', 'nonexistent-branch-id')
      .expect(400); // branch not found / inactive
  }, 30000);
});
