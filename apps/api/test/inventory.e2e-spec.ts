import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M9 Inventory Stock + FIFO e2e tests.
 * Run against real DB; seed must have been run beforehand.
 */
describe('Inventory (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let waiterToken: string;
  let branchId: string;
  let inventoryItemId: string;
  let batchId: string;
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

    // Login as owner (has pos:inventory:read, pos:inventory:write, pos:inventory:adjust)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as waiter (pos:inventory:read only — no write/adjust)
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

    // Create a test inventory item via recipes endpoint (M8)
    const itemRes = await request(app.getHttpServer())
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        name: `E2E Stock Item ${suffix}`,
        unit: 'kg',
        category: 'Produce',
        theoreticalUnitCost: '2.500',
        reorderLevel: '10.000',
        reorderQty: '50.000',
      });
    inventoryItemId = itemRes.body.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── Stock Batches ──

  it('POST /api/inventory/batches — create stock batch (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/inventory/batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        itemId: inventoryItemId,
        receivedQty: '25.000',
        unitCost: '2.400',
        batchNumber: `E2E-BATCH-${suffix}`,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.receivedQty).toBe('25.000');
    expect(res.body.remainingQty).toBe('25.000');
    batchId = res.body.id;
  }, 15000);

  it('POST /api/inventory/batches — missing X-Branch-Id → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        itemId: inventoryItemId,
        receivedQty: '10.000',
        unitCost: '2.000',
      })
      .expect(400);
  }, 10000);

  it('POST /api/inventory/batches — waiter (no write perm) → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/batches')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        itemId: inventoryItemId,
        receivedQty: '10.000',
        unitCost: '2.000',
      })
      .expect(403);
  }, 10000);

  it('POST /api/inventory/batches — invalid payload (missing receivedQty) → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        itemId: inventoryItemId,
        unitCost: '2.000',
      })
      .expect(400);
  }, 10000);

  it('GET /api/inventory/batches — list all batches', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  }, 10000);

  it('GET /api/inventory/items/:id/batches — list batches for item', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/inventory/items/${inventoryItemId}/batches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((b: any) => b.id === batchId);
    expect(found).toBeDefined();
  }, 10000);

  // ── Inventory Levels ──

  it('GET /api/inventory/levels — list inventory levels', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/levels')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('itemId');
    expect(res.body[0]).toHaveProperty('onHandQty');
    expect(res.body[0]).toHaveProperty('belowReorder');
  }, 10000);

  it('GET /api/inventory/levels?category=Produce — filter by category', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/levels?category=Produce')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    for (const level of res.body) {
      expect(level.category).toBe('Produce');
    }
  }, 10000);

  it('GET /api/inventory/levels — waiter (read-only) → 200', async () => {
    await request(app.getHttpServer())
      .get('/api/inventory/levels')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);
  }, 10000);

  // ── Stock Adjustments ──

  it('POST /api/inventory/adjustments — positive adjustment', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/inventory/adjustments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        itemId: inventoryItemId,
        qtyDelta: '5.000',
        reason: 'E2E found in storeroom',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.reason).toBe('E2E found in storeroom');
  }, 15000);

  it('POST /api/inventory/adjustments — negative adjustment (within stock)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/inventory/adjustments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        itemId: inventoryItemId,
        qtyDelta: '-2.000',
        reason: 'E2E spillage',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
  }, 15000);

  it('POST /api/inventory/adjustments — negative stock attempt → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/adjustments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        itemId: inventoryItemId,
        qtyDelta: '-999999.000',
        reason: 'E2E impossible',
      })
      .expect(400);
  }, 10000);

  it('POST /api/inventory/adjustments — waiter (no adjust perm) → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/adjustments')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        itemId: inventoryItemId,
        qtyDelta: '1.000',
      })
      .expect(403);
  }, 10000);

  it('POST /api/inventory/adjustments — zero delta → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/adjustments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        itemId: inventoryItemId,
        qtyDelta: '0.000',
      })
      .expect(400);
  }, 10000);

  it('POST /api/inventory/adjustments — nonexistent item → 404', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/adjustments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        itemId: 'nonexistent-item-id',
        qtyDelta: '1.000',
      })
      .expect(404);
  }, 10000);
});
