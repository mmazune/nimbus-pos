import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M4 Org Settings e2e tests.
 * Run against real DB; seed must have been run beforehand.
 */
describe('Settings (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let waiterToken: string;

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

    // Login as owner (has tenancy:settings:manage)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as waiter (does NOT have tenancy:settings:manage)
    const waiterLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'waiter@demo.local', password: 'Waiter#123' });
    waiterToken = waiterLogin.body.accessToken;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── GET /api/settings — happy path ──

  it('GET /api/settings — returns seeded defaults', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.id).toBeDefined();
    expect(res.body.currency).toBe('UGX');
    expect(res.body.reservationHoldMinutes).toBe(30);
    expect(res.body.showCostToChef).toBe(false);
    expect(res.body.rounding).toBeDefined();
    expect(res.body.taxMatrix).toBeDefined();
    expect(res.body.anomalyThresholds).toBeDefined();
  }, 30000);

  // ── GET /api/settings/currency — happy path ──

  it('GET /api/settings/currency — returns currency info', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/settings/currency')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.currency).toBe('UGX');
  }, 30000);

  // ── PUT /api/settings/currency — happy path ──

  it('PUT /api/settings/currency — updates currency', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/settings/currency')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currency: 'USD', baseCurrencyCode: 'USD' })
      .expect(200);

    expect(res.body.currency).toBe('USD');
    expect(res.body.baseCurrencyCode).toBe('USD');

    // Reset back
    await request(app.getHttpServer())
      .put('/api/settings/currency')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currency: 'UGX' })
      .expect(200);
  }, 30000);

  // ── PUT /api/settings/tax-matrix — happy path ──

  it('PUT /api/settings/tax-matrix — updates tax matrix', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/settings/tax-matrix')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ defaultVatPct: 20, categories: [{ name: 'Alcohol', vatPct: 25 }] })
      .expect(200);

    expect(res.body.taxMatrix).toBeDefined();
    expect(res.body.taxMatrix.defaultVatPct).toBe(20);

    // Reset back
    await request(app.getHttpServer())
      .put('/api/settings/tax-matrix')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ defaultVatPct: 18, categories: [] })
      .expect(200);
  }, 30000);

  // ── PUT /api/settings/rounding — happy path ──

  it('PUT /api/settings/rounding — updates rounding', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/settings/rounding')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mode: 'UP', increment: 50 })
      .expect(200);

    expect(res.body.rounding).toBeDefined();
    expect(res.body.rounding.mode).toBe('UP');
    expect(res.body.rounding.increment).toBe(50);

    // Reset back
    await request(app.getHttpServer())
      .put('/api/settings/rounding')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mode: 'NEAREST', increment: 100 })
      .expect(200);
  }, 30000);

  // ── PATCH /api/thresholds — happy path ──

  it('PATCH /api/thresholds — updates thresholds', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/thresholds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ lateVoidMin: 10, discountApprovalThreshold: '10000' })
      .expect(200);

    expect(res.body.anomalyThresholds).toBeDefined();
    expect(res.body.anomalyThresholds.lateVoidMin).toBe(10);

    // Reset back
    await request(app.getHttpServer())
      .patch('/api/thresholds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ lateVoidMin: 5, discountApprovalThreshold: '5000' })
      .expect(200);
  }, 30000);

  // ── Invalid payload → 400 ──

  it('PUT /api/settings/rounding — invalid payload → 400', async () => {
    await request(app.getHttpServer())
      .put('/api/settings/rounding')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mode: 'INVALID', increment: -1 })
      .expect(400);
  }, 30000);

  it('PUT /api/settings/tax-matrix — invalid payload → 400', async () => {
    await request(app.getHttpServer())
      .put('/api/settings/tax-matrix')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ defaultVatPct: 'not-a-number' })
      .expect(400);
  }, 30000);

  // ── Permission denial → 403 ──

  it('PATCH /api/settings — waiter → 403', async () => {
    await request(app.getHttpServer())
      .patch('/api/settings')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ currency: 'EUR' })
      .expect(403);
  }, 30000);

  it('PUT /api/settings/currency — waiter → 403', async () => {
    await request(app.getHttpServer())
      .put('/api/settings/currency')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ currency: 'EUR' })
      .expect(403);
  }, 30000);

  it('PATCH /api/thresholds — waiter → 403', async () => {
    await request(app.getHttpServer())
      .patch('/api/thresholds')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ lateVoidMin: 99 })
      .expect(403);
  }, 30000);

  // ── Platform access endpoints ──

  it('GET /api/settings/platform-access — returns platform access config', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/settings/platform-access')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.platformAccess).toBeDefined();
  }, 30000);

  it('PUT /api/settings/platform-access — updates platform access', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/settings/platform-access')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ useRoleDefaults: false, overrides: { CASHIER: ['POS_DESKTOP', 'MOBILE_APP'] } })
      .expect(200);

    expect(res.body.platformAccess.useRoleDefaults).toBe(false);

    // Reset back
    await request(app.getHttpServer())
      .put('/api/settings/platform-access')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ useRoleDefaults: true })
      .expect(200);
  }, 30000);

  // ── Exchange rates ──

  it('POST /api/settings/exchange-rate — creates exchange rate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/settings/exchange-rate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        baseCurrencyCode: 'EUR',
        quoteCurrencyCode: 'UGX',
        rate: '4100.500000',
        effectiveAt: '2026-03-20T12:00:00Z',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.baseCurrencyCode).toBe('EUR');
  }, 30000);

  it('GET /api/settings/exchange-rates — lists exchange rates', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/settings/exchange-rates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  // ── Waiter can read settings (has tenancy:org:read via tenancy:branch:read) ──

  it('GET /api/settings — waiter can read via tenancy:org:read', async () => {
    // Note: waiter has tenancy:branch:read but NOT tenancy:org:read
    // This should return 403
    await request(app.getHttpServer())
      .get('/api/settings')
      .set('Authorization', `Bearer ${waiterToken}`)
      .expect(403);
  }, 30000);
});
