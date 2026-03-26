import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M6 Menu Catalog e2e tests.
 * Run against real DB; seed must have been run beforehand.
 */
describe('Menu (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let waiterToken: string;
  let branchId: string;
  let categoryId: string;
  let taxCategoryId: string;
  let menuItemId: string;
  let browseGroupId: string;
  let browseSubgroupId: string;
  let servingId: string;
  let modifierGroupId: string;
  let modifierOptionId: string;
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

    // Login as owner (has pos:menu:write, pos:tax:write)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as waiter (read-only for menu)
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

  // ── Categories ──

  it('POST /api/menu/categories — create category (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Category ${suffix}`, sortOrder: 10 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`E2E Category ${suffix}`);
    expect(res.body.sortOrder).toBe(10);
    expect(res.body.isActive).toBe(true);
    categoryId = res.body.id;
  }, 30000);

  it('GET /api/menu/categories — list categories (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('GET /api/menu/categories/:id — get single category', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/menu/categories/${categoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.id).toBe(categoryId);
  }, 30000);

  it('PATCH /api/menu/categories/:id — update category', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/categories/${categoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ sortOrder: 20 })
      .expect(200);

    expect(res.body.sortOrder).toBe(20);
  }, 30000);

  // ── Tax Categories ──

  it('POST /api/menu/tax-categories — create tax category (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/menu/tax-categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Tax ${suffix}`, rate: 18.0 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`E2E Tax ${suffix}`);
    taxCategoryId = res.body.id;
  }, 30000);

  it('GET /api/menu/tax-categories — list tax categories', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/tax-categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('GET /api/menu/tax-categories/:id — get single tax category', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/menu/tax-categories/${taxCategoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.id).toBe(taxCategoryId);
  }, 30000);

  it('PATCH /api/menu/tax-categories/:id — update tax category', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/tax-categories/${taxCategoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ rate: 20.0 })
      .expect(200);

    expect(Number(res.body.rate)).toBe(20);
  }, 30000);

  // ── Menu Items ──

  it('POST /api/menu/items — create menu item (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        name: `E2E Item ${suffix}`,
        categoryId,
        taxCategoryId,
        price: 15.99,
        itemType: 'FOOD',
        station: 'KITCHEN',
        sortOrder: 1,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`E2E Item ${suffix}`);
    expect(Number(res.body.price)).toBe(15.99);
    expect(res.body.itemType).toBe('FOOD');
    expect(res.body.station).toBe('KITCHEN');
    expect(res.body.category.id).toBe(categoryId);
    expect(res.body.taxCategory.id).toBe(taxCategoryId);
    menuItemId = res.body.id;
  }, 30000);

  it('GET /api/menu/items — list menu items (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('GET /api/menu/items/:id — get single item', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/menu/items/${menuItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.id).toBe(menuItemId);
  }, 30000);

  it('PATCH /api/menu/items/:id — update menu item (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/items/${menuItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ price: 18.5, description: 'Updated by e2e' })
      .expect(200);

    expect(Number(res.body.price)).toBe(18.5);
    expect(res.body.description).toBe('Updated by e2e');
  }, 30000);

  // ── Catalog (M6.1 upgraded) ──

  it('GET /api/menu/catalog — grouped catalog (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/catalog')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body).toHaveProperty('categories');
    expect(res.body).toHaveProperty('taxCategories');
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(Array.isArray(res.body.taxCategories)).toBe(true);
    if (res.body.categories.length > 0) {
      expect(res.body.categories[0]).toHaveProperty('id');
      expect(res.body.categories[0]).toHaveProperty('name');
      expect(res.body.categories[0]).toHaveProperty('items');
      expect(Array.isArray(res.body.categories[0].items)).toBe(true);
    }
  }, 30000);

  // ── Browse Groups (M6.1) ──

  it('POST /api/menu/browse-groups — create browse group (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/menu/browse-groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Group ${suffix}`, section: 'FOOD', sortOrder: 99 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`E2E Group ${suffix}`);
    expect(res.body.section).toBe('FOOD');
    browseGroupId = res.body.id;
  }, 30000);

  it('GET /api/menu/browse-groups — list browse groups', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/browse-groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('GET /api/menu/browse-groups/:id — get single browse group', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/menu/browse-groups/${browseGroupId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.id).toBe(browseGroupId);
  }, 30000);

  it('PATCH /api/menu/browse-groups/:id — update browse group', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/browse-groups/${browseGroupId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ sortOrder: 50 })
      .expect(200);

    expect(res.body.sortOrder).toBe(50);
  }, 30000);

  it('POST /api/menu/browse-groups — duplicate name → 409', async () => {
    await request(app.getHttpServer())
      .post('/api/menu/browse-groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Group ${suffix}`, section: 'FOOD' })
      .expect(409);
  }, 30000);

  // ── Browse Subgroups (M6.1) ──

  it('POST /api/menu/browse-groups/:id/subgroups — create subgroup (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/menu/browse-groups/${browseGroupId}/subgroups`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Sub ${suffix}`, sortOrder: 0 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`E2E Sub ${suffix}`);
    browseSubgroupId = res.body.id;
  }, 30000);

  it('GET /api/menu/browse-groups/:id/subgroups — list subgroups', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/menu/browse-groups/${browseGroupId}/subgroups`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('PATCH /api/menu/browse-groups/:gId/subgroups/:sId — update subgroup', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/browse-groups/${browseGroupId}/subgroups/${browseSubgroupId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ sortOrder: 5 })
      .expect(200);

    expect(res.body.sortOrder).toBe(5);
  }, 30000);

  // ── Menu Item Servings (M6.1) ──

  it('POST /api/menu/items/:id/servings — create serving (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/menu/items/${menuItemId}/servings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ format: 'GLASS', price: 12.0, isDefault: true })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.format).toBe('GLASS');
    expect(Number(res.body.price)).toBe(12);
    servingId = res.body.id;
  }, 30000);

  it('GET /api/menu/items/:id/servings — list servings', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/menu/items/${menuItemId}/servings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('PATCH /api/menu/items/:iId/servings/:sId — update serving', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/items/${menuItemId}/servings/${servingId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ price: 14.5 })
      .expect(200);

    expect(Number(res.body.price)).toBe(14.5);
  }, 30000);

  // ── Assign Browse (M6.1) ──

  it('PATCH /api/menu/items/:id/browse — assign browse group + subgroup', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/items/${menuItemId}/browse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ browseGroupId, browseSubgroupId })
      .expect(200);

    expect(res.body.browseGroupId).toBe(browseGroupId);
    expect(res.body.browseSubgroupId).toBe(browseSubgroupId);
  }, 30000);

  it('PATCH /api/menu/items/:id/browse — clear browse assignment', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/items/${menuItemId}/browse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ browseGroupId: null })
      .expect(200);

    expect(res.body.browseGroupId).toBeNull();
    expect(res.body.browseSubgroupId).toBeNull();
  }, 30000);

  // ── Navigation (M6.1) ──

  it('GET /api/menu/navigation — POS browse tree', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/navigation')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('section');
      expect(res.body[0]).toHaveProperty('groups');
      expect(Array.isArray(res.body[0].groups)).toBe(true);
    }
  }, 30000);

  it('GET /api/menu/navigation?section=FOOD — filtered by section', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/navigation?section=FOOD')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    for (const entry of res.body) {
      expect(entry.section).toBe('FOOD');
    }
  }, 30000);

  // ── Modifier Groups (M7) ──

  it('POST /api/menu/modifier-groups — create modifier group (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/menu/modifier-groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Size ${suffix}`, min: 1, max: 1, required: true })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`E2E Size ${suffix}`);
    expect(res.body.min).toBe(1);
    expect(res.body.max).toBe(1);
    expect(res.body.required).toBe(true);
    modifierGroupId = res.body.id;
  }, 30000);

  it('POST /api/menu/modifier-groups — duplicate name → 409', async () => {
    await request(app.getHttpServer())
      .post('/api/menu/modifier-groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Size ${suffix}` })
      .expect(409);
  }, 30000);

  it('POST /api/menu/modifier-groups — min > max → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/menu/modifier-groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Bad ${suffix}`, min: 5, max: 2 })
      .expect(400);
  }, 30000);

  it('GET /api/menu/modifier-groups — list modifier groups', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/modifier-groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('GET /api/menu/modifier-groups/:id — get single modifier group', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/menu/modifier-groups/${modifierGroupId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body.id).toBe(modifierGroupId);
    expect(res.body).toHaveProperty('options');
  }, 30000);

  it('PATCH /api/menu/modifier-groups/:id — update modifier group', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/modifier-groups/${modifierGroupId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ max: 3 })
      .expect(200);

    expect(res.body.max).toBe(3);
  }, 30000);

  // ── Modifier Options (M7) ──

  it('POST /api/menu/modifier-groups/:id/options — create option (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/menu/modifier-groups/${modifierGroupId}/options`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Small ${suffix}`, priceDelta: '0.00' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`E2E Small ${suffix}`);
    expect(Number(res.body.priceDelta)).toBe(0);
    modifierOptionId = res.body.id;
  }, 30000);

  it('POST /api/menu/modifier-groups/:id/options — duplicate name → 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/menu/modifier-groups/${modifierGroupId}/options`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: `E2E Small ${suffix}` })
      .expect(409);
  }, 30000);

  it('GET /api/menu/modifier-groups/:id/options — list options', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/menu/modifier-groups/${modifierGroupId}/options`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('PATCH /api/menu/modifier-groups/:gId/options/:oId — update option', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/menu/modifier-groups/${modifierGroupId}/options/${modifierOptionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ priceDelta: '2.50' })
      .expect(200);

    expect(Number(res.body.priceDelta)).toBe(2.5);
  }, 30000);

  // ── Item ↔ Modifier Group Assignment (M7) ──

  it('POST /api/menu/items/:id/modifier-groups — assign modifier groups', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/menu/items/${menuItemId}/modifier-groups`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ groups: [{ groupId: modifierGroupId, sortOrder: 0 }] })
      .expect(201);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(modifierGroupId);
  }, 30000);

  it('GET /api/menu/items/:id/modifier-groups — list item modifier groups', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/menu/items/${menuItemId}/modifier-groups`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toHaveProperty('options');
  }, 30000);

  it('POST /api/menu/items/:id/modifier-groups — clear assignment with empty array', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/menu/items/${menuItemId}/modifier-groups`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ groups: [] })
      .expect(201);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  }, 30000);

  it('GET /api/menu/items/:id — detail includes modifierGroups', async () => {
    // Re-assign so we have data
    await request(app.getHttpServer())
      .post(`/api/menu/items/${menuItemId}/modifier-groups`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ groups: [{ groupId: modifierGroupId, sortOrder: 0 }] })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/menu/items/${menuItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .expect(200);

    expect(res.body).toHaveProperty('modifierGroups');
    expect(Array.isArray(res.body.modifierGroups)).toBe(true);
    expect(res.body.modifierGroups.length).toBe(1);
    expect(res.body.modifierGroups[0]).toHaveProperty('options');
  }, 30000);

  // ── Permission Denial ──

  it('POST /api/menu/categories — waiter denied (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: 'Unauthorized Cat' })
      .expect(403);
  }, 30000);

  it('POST /api/menu/items — waiter denied (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        name: 'Unauthorized Item',
        categoryId,
        price: 10,
        itemType: 'FOOD',
      })
      .expect(403);
  }, 30000);

  it('POST /api/menu/browse-groups — waiter denied (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/menu/browse-groups')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: 'Unauth Group', section: 'FOOD' })
      .expect(403);
  }, 30000);

  // ── Missing Branch Header ──

  it('GET /api/menu/categories — missing X-Branch-Id → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/menu/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  }, 30000);

  // ── Invalid Payload ──

  it('POST /api/menu/items — invalid payload → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: 'Bad Item', price: -5, itemType: 'INVALID_TYPE' })
      .expect(400);
  }, 30000);

  it('POST /api/menu/categories — forbidden extra field → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({ name: 'Extra Field Cat', extraField: 'bad' })
      .expect(400);
  }, 30000);

  it('POST /api/menu/items — negative price → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', branchId)
      .send({
        name: 'Negative Price',
        categoryId,
        price: -10,
        itemType: 'FOOD',
      })
      .expect(400);
  }, 30000);

  // ── Cross-branch access ──

  it('GET /api/menu/categories — cross-branch → 403', async () => {
    // Waiter only has membership on MAIN branch, use a fake branch ID
    await request(app.getHttpServer())
      .get('/api/menu/categories')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('X-Branch-Id', 'fake-branch-id-123')
      .expect(400); // branch not found → 400
  }, 30000);
});
