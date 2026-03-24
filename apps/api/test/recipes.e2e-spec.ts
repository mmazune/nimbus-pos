import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M8 Recipes + Ingredient Costing e2e tests.
 * Run against real DB; seed must have been run beforehand.
 */
describe('Recipes (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let waiterToken: string;
  let branchId: string;
  let inventoryItemId: string;
  let inventoryItemId2: string;
  let menuItemId: string;
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

    // Login as owner (has pos:recipe:write, pos:recipe:read, pos:cost:read)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as waiter (no recipe/cost permissions)
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

    // Find an existing menu item to attach recipes to
    const menuRes = await request(app.getHttpServer())
      .get('/api/menu/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId);
    menuItemId = menuRes.body?.[0]?.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── Inventory Items ──

  it('POST /api/inventory/items — create inventory item (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        name: `E2E Ingredient A ${suffix}`,
        unit: 'kg',
        category: 'Produce',
        theoreticalUnitCost: '5.250',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`E2E Ingredient A ${suffix}`);
    expect(res.body.unit).toBe('kg');
    inventoryItemId = res.body.id;
  }, 15000);

  it('POST /api/inventory/items — create second inventory item', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        name: `E2E Ingredient B ${suffix}`,
        unit: 'pcs',
        theoreticalUnitCost: '0.300',
      })
      .expect(201);

    inventoryItemId2 = res.body.id;
  }, 15000);

  it('POST /api/inventory/items — duplicate name → 409', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Ingredient A ${suffix}`, unit: 'kg' })
      .expect(409);
  }, 10000);

  it('GET /api/inventory/items — list inventory items', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  }, 10000);

  it('GET /api/inventory/items/:id — get single item', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/inventory/items/${inventoryItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.id).toBe(inventoryItemId);
  }, 10000);

  it('PATCH /api/inventory/items/:id — update item', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/inventory/items/${inventoryItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ theoreticalUnitCost: '6.000' })
      .expect(200);

    expect(res.body.theoreticalUnitCost).toBeDefined();
  }, 10000);

  it('POST /api/inventory/items — missing X-Branch-Id → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'No Branch', unit: 'kg' })
      .expect(400);
  }, 10000);

  it('POST /api/inventory/items — waiter (no write perm) → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: 'Blocked', unit: 'kg' })
      .expect(403);
  }, 10000);

  it('POST /api/inventory/items — invalid payload → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: '' })
      .expect(400);
  }, 10000);

  // ── Recipes ──

  it('POST /api/inventory/recipes/:menuItemId — set recipe (happy path)', async () => {
    if (!menuItemId) return; // skip if no menu item seeded

    const res = await request(app.getHttpServer())
      .post(`/api/inventory/recipes/${menuItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        ingredients: [
          {
            inventoryItemId,
            qtyPerUnit: '0.150',
            wastePct: '3',
            unit: 'kg',
          },
          {
            inventoryItemId: inventoryItemId2,
            qtyPerUnit: '2',
            unit: 'pcs',
          },
        ],
      })
      .expect(201);

    expect(res.body.menuItemId).toBe(menuItemId);
    expect(res.body.ingredientCount).toBe(2);
  }, 15000);

  it('GET /api/inventory/recipes/:menuItemId — get recipe', async () => {
    if (!menuItemId) return;

    const res = await request(app.getHttpServer())
      .get(`/api/inventory/recipes/${menuItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.menuItem).toBeDefined();
    expect(res.body.baseIngredients).toBeDefined();
    expect(Array.isArray(res.body.baseIngredients)).toBe(true);
  }, 10000);

  it('GET /api/inventory/recipes/:menuItemId/cost — cost breakdown', async () => {
    if (!menuItemId) return;

    const res = await request(app.getHttpServer())
      .get(`/api/inventory/recipes/${menuItemId}/cost`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.menuItemId).toBe(menuItemId);
    expect(res.body.totalTheoreticalCogs).toBeDefined();
    expect(res.body.margin).toBeDefined();
    expect(res.body.sellingPrice).toBeDefined();
    expect(res.body.rows).toBeDefined();
    expect(res.body.rows.length).toBe(2);
  }, 10000);

  it('POST /api/inventory/recipes/:menuItemId — replace recipe (atomic)', async () => {
    if (!menuItemId) return;

    // Replace with only 1 ingredient
    const res = await request(app.getHttpServer())
      .post(`/api/inventory/recipes/${menuItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        ingredients: [
          {
            inventoryItemId,
            qtyPerUnit: '0.250',
            unit: 'kg',
          },
        ],
      })
      .expect(201);

    expect(res.body.ingredientCount).toBe(1);
  }, 15000);

  it('POST /api/inventory/recipes/:menuItemId — non-existent menu item → 404', async () => {
    await request(app.getHttpServer())
      .post('/api/inventory/recipes/non-existent-id')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        ingredients: [{ inventoryItemId, qtyPerUnit: '1', unit: 'pcs' }],
      })
      .expect(404);
  }, 10000);

  it('POST /api/inventory/recipes/:menuItemId — non-existent inventory item → 404', async () => {
    if (!menuItemId) return;

    await request(app.getHttpServer())
      .post(`/api/inventory/recipes/${menuItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        ingredients: [{ inventoryItemId: 'non-existent-inv', qtyPerUnit: '1', unit: 'pcs' }],
      })
      .expect(404);
  }, 10000);

  it('POST /api/inventory/recipes/:menuItemId — invalid payload → 400', async () => {
    if (!menuItemId) return;

    await request(app.getHttpServer())
      .post(`/api/inventory/recipes/${menuItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ ingredients: 'not-an-array' })
      .expect(400);
  }, 10000);

  it('GET /api/inventory/recipes/:menuItemId/cost — waiter (no cost:read) → 403', async () => {
    if (!menuItemId) return;

    await request(app.getHttpServer())
      .get(`/api/inventory/recipes/${menuItemId}/cost`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .expect(403);
  }, 10000);
});
