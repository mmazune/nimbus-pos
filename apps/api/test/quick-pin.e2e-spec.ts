import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M3.1 Quick PIN Login e2e tests.
 * These tests run against the real database (Neon).
 * Seed must have been run before executing these tests.
 *
 * Demo quick PINs from seed:
 *   waiter@demo.local  → 123456  (6-digit, LOW_6)
 *   cashier@demo.local → 654321  (6-digit, LOW_6)
 *   manager@demo.local → 12345678 (8-digit, HIGH_8)
 */
describe('Quick PIN Login (e2e)', () => {
  let app: INestApplication;
  let ownerAccessToken: string;
  let branchId: string;
  let waiterUserId: string;
  // cashierUserId and managerUserId resolved in beforeAll for future tests
  let _cashierUserId: string;
  let _managerUserId: string;
  // Dynamic PINs issued in beforeAll (seed PINs may have been rotated by prior e2e runs)
  let waiterPin: string;
  let cashierPin: string;
  let managerPin: string;

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

    // Login as owner to get access token and resolve IDs
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' })
      .expect(201);

    ownerAccessToken = loginRes.body.accessToken;

    // Get branch IDs from /api/branches
    const branchesRes = await request(app.getHttpServer())
      .get('/api/branches')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    const mainBranch = branchesRes.body.find((b: any) => b.code === 'MAIN');
    branchId = mainBranch?.id;

    // Verify /api/me works (result not needed for subsequent tests)
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    // We need individual user IDs. Login as each user to get their IDs.
    const waiterLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'waiter@demo.local', password: 'Waiter#123' })
      .expect(201);
    waiterUserId = waiterLogin.body.user.id;

    const cashierLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@demo.local', password: 'Cashier#123' })
      .expect(201);
    _cashierUserId = cashierLogin.body.user.id;

    const managerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'manager@demo.local', password: 'Manager#123' })
      .expect(201);
    _managerUserId = managerLogin.body.user.id;

    // Issue fresh PINs so tests are independent of seed state (seed PINs may have been
    // rotated by a prior e2e run that called issue-quick-pin or reset-quick-pin).
    const waiterPinRes = await request(app.getHttpServer())
      .post(`/api/auth/users/${waiterUserId}/issue-quick-pin`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ branchId })
      .expect(201);
    waiterPin = waiterPinRes.body.pin;

    const cashierPinRes = await request(app.getHttpServer())
      .post(`/api/auth/users/${_cashierUserId}/issue-quick-pin`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ branchId })
      .expect(201);
    cashierPin = cashierPinRes.body.pin;

    const managerPinRes = await request(app.getHttpServer())
      .post(`/api/auth/users/${_managerUserId}/issue-quick-pin`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ branchId })
      .expect(201);
    managerPin = managerPinRes.body.pin;
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  // ── Quick PIN Login Happy Path ──

  it('POST /api/auth/quick-pin-login — waiter happy path', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/quick-pin-login')
      .send({
        branchId,
        pin: waiterPin,
        platform: 'POS_DESKTOP',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.session.source).toBe('PIN');
    expect(res.body.session.platform).toBe('POS_DESKTOP');
    expect(res.body.session.branchId).toBe(branchId);
    expect(res.body.user.email).toBe('waiter@demo.local');
  }, 30000);

  it('POST /api/auth/quick-pin-login — cashier happy path', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/quick-pin-login')
      .send({
        branchId,
        pin: cashierPin,
        platform: 'POS_DESKTOP',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.session.source).toBe('PIN');
    expect(res.body.user.email).toBe('cashier@demo.local');
  }, 30000);

  it('POST /api/auth/quick-pin-login — manager happy path (8-digit)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/quick-pin-login')
      .send({
        branchId,
        pin: managerPin,
        platform: 'POS_DESKTOP',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.session.source).toBe('PIN');
    expect(res.body.user.email).toBe('manager@demo.local');
  }, 30000);

  // ── Verify /auth/me shows branch context after quick PIN login ──

  it('GET /api/auth/me — after quick PIN login shows correct session', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/quick-pin-login')
      .send({
        branchId,
        pin: waiterPin,
        platform: 'POS_DESKTOP',
      })
      .expect(201);

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(200);

    expect(meRes.body.email).toBe('waiter@demo.local');
    expect(meRes.body.session).toBeDefined();
  }, 30000);

  // ── Rejection Cases ──

  it('POST /api/auth/quick-pin-login — invalid PIN → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/quick-pin-login')
      .send({
        branchId,
        pin: '000000',
        platform: 'POS_DESKTOP',
      })
      .expect(401);
  }, 30000);

  it('POST /api/auth/quick-pin-login — wrong platform → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/quick-pin-login')
      .send({
        branchId,
        pin: '123456',
        platform: 'MOBILE_APP',
      })
      .expect(403);
  }, 30000);

  it('POST /api/auth/quick-pin-login — non-existent branch → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/quick-pin-login')
      .send({
        branchId: 'nonexistent-branch-id',
        pin: '123456',
        platform: 'POS_DESKTOP',
      })
      .expect(401);
  }, 30000);

  it('POST /api/auth/quick-pin-login — invalid DTO → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/quick-pin-login')
      .send({
        branchId,
        pin: 'abc',
        platform: 'POS_DESKTOP',
      })
      .expect(400);
  }, 30000);

  it('POST /api/auth/quick-pin-login — missing platform → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/quick-pin-login')
      .send({
        branchId,
        pin: '123456',
      })
      .expect(400);
  });

  // ── Issue Quick PIN ──

  it('POST /api/auth/users/:id/issue-quick-pin — works for privileged user', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/auth/users/${waiterUserId}/issue-quick-pin`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ branchId })
      .expect(201);

    expect(res.body.pin).toBeDefined();
    expect(res.body.pinLength).toBe(6);
    expect(res.body.tier).toBe('LOW_6');
  }, 30000);

  // ── Reset Quick PIN ──

  it('POST /api/auth/users/:id/reset-quick-pin — works for privileged user', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/auth/users/${waiterUserId}/reset-quick-pin`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ branchId })
      .expect(201);

    expect(res.body.pin).toBeDefined();
    expect(res.body.pinLength).toBe(6);
  }, 30000);

  // ── Update Quick PIN Settings ──

  it('PATCH /api/auth/users/:id/quick-pin-settings — update display name', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/auth/users/${waiterUserId}/quick-pin-settings`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ displayName: 'Test Waiter', quickPinEnabled: true })
      .expect(200);

    expect(res.body.displayName).toBe('Test Waiter');
    expect(res.body.quickPinEnabled).toBe(true);
  }, 30000);

  // ── Quick PIN Status ──

  it('GET /api/auth/users/:id/quick-pin-status — returns status', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/auth/users/${waiterUserId}/quick-pin-status`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    expect(res.body.id).toBe(waiterUserId);
    expect(res.body.quickPinEnabled).toBeDefined();
    expect(res.body.hasPin).toBeDefined();
  }, 30000);

  // ── Ensure M0-M3 still work ──

  it('GET /api/health — still works', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('POST /api/auth/login — still works', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
  }, 30000);
});
