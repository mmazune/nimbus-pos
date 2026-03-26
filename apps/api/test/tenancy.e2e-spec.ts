import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M3 Tenancy e2e tests.
 * Run against real DB; seed must have been run beforehand.
 */
describe('Tenancy (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let waiterToken: string;
  let cashierToken: string;
  let testOrgId: string;
  let testBranchId: string;
  let ownerUserId: string;
  let waiterUserId: string;

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
    ownerUserId = ownerLogin.body.user.id;

    // Login as waiter
    const waiterLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'waiter@demo.local', password: 'Waiter#123' });
    waiterToken = waiterLogin.body.accessToken;
    waiterUserId = waiterLogin.body.user.id;

    // Login as cashier
    const cashierLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@demo.local', password: 'Cashier#123' });
    cashierToken = cashierLogin.body.accessToken;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/orgs ──

  it('POST /api/orgs — happy path', async () => {
    const slug = `e2e-test-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/orgs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E Test Org', slug })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.slug).toBe(slug);
    expect(res.body.status).toBe('ACTIVE');
    testOrgId = res.body.id;
  }, 30000);

  it('POST /api/orgs — invalid payload → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/orgs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: '' })
      .expect(400);
  });

  it('POST /api/orgs — waiter (no tenancy:org:write) → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/orgs')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ name: 'Denied Org', slug: 'denied' })
      .expect(403);
  });

  // ── POST /api/orgs/:orgId/branches ──

  it('POST /api/orgs/:orgId/branches — happy path', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orgs/${testOrgId}/branches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E Branch', code: 'E2E', timezone: 'America/New_York', currencyCode: 'USD' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('E2E Branch');
    expect(res.body.organizationId).toBe(testOrgId);
    testBranchId = res.body.id;
  }, 30000);

  it('POST /api/orgs/:orgId/branches — cashier (no tenancy:branch:write) → 403', async () => {
    await request(app.getHttpServer())
      .post(`/api/orgs/${testOrgId}/branches`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Denied Branch' })
      .expect(403);
  });

  // ── POST /api/orgs/:orgId/branches/:branchId/memberships ──

  it('POST /api/.../memberships — happy path', async () => {
    // First get a role ID
    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${waiterToken}`)
      .expect(200);

    const waiterRoleId = meRes.body.roles[0].id;

    const res = await request(app.getHttpServer())
      .post(`/api/orgs/${testOrgId}/branches/${testBranchId}/memberships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: waiterUserId, roleId: waiterRoleId, isDefaultBranch: true })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.userId).toBe(waiterUserId);
    expect(res.body.isDefaultBranch).toBe(true);
  }, 30000);

  // ── GET /api/branches ──

  it('GET /api/branches — returns only scoped results', async () => {
    // Owner has seeded memberships and E2E membership
    const ownerRes = await request(app.getHttpServer())
      .get('/api/branches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Array.isArray(ownerRes.body)).toBe(true);
    // Owner should see at least the seeded branches
    expect(ownerRes.body.length).toBeGreaterThanOrEqual(2);

    // Cashier should see only Main Branch (seeded scope)
    const cashierRes = await request(app.getHttpServer())
      .get('/api/branches')
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(200);

    expect(Array.isArray(cashierRes.body)).toBe(true);
    const cashierBranches = cashierRes.body.map((b: any) => b.name);
    expect(cashierBranches).toContain('Main Branch');
    expect(cashierBranches).not.toContain('Downtown Branch');
  }, 30000);

  // ── GET /api/me ──

  it('GET /api/me — returns org + branch context', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe('owner@demo.local');
    expect(res.body.organizations).toBeDefined();
    expect(Array.isArray(res.body.organizations)).toBe(true);
    expect(res.body.organizations.length).toBeGreaterThanOrEqual(1);
    expect(res.body.defaultBranch).toBeDefined();
    expect(res.body.permissions).toBeDefined();
    expect(res.body.roles).toBeDefined();
  }, 30000);

  // ── GET /api/branch-test — BranchContextGuard ──

  it('GET /api/branch-test — without X-Branch-Id → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/branch-test')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  }, 30000);

  it('GET /api/branch-test — with valid membership → 200', async () => {
    // Use a seeded branch where owner has membership
    const branchesRes = await request(app.getHttpServer())
      .get('/api/branches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const seededBranchId = branchesRes.body[0].id;

    const res = await request(app.getHttpServer())
      .get('/api/branch-test')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Branch-Id', seededBranchId)
      .expect(200);

    expect(res.body.message).toBe('Branch context verified');
    expect(res.body.branchContext).toBeDefined();
    expect(res.body.branchContext.branchId).toBe(seededBranchId);
  }, 30000);

  it('GET /api/branch-test — non-member user → 403', async () => {
    // Cashier is only in Main Branch, use a branch they're NOT in
    const ownerBranches = await request(app.getHttpServer())
      .get('/api/branches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // Find Downtown Branch (cashier doesn't have access)
    const downtownBranch = ownerBranches.body.find((b: any) => b.name === 'Downtown Branch');
    if (downtownBranch) {
      await request(app.getHttpServer())
        .get('/api/branch-test')
        .set('Authorization', `Bearer ${cashierToken}`)
        .set('X-Branch-Id', downtownBranch.id)
        .expect(403);
    }
  }, 30000);

  // ── Permission denial ──

  it('POST /api/.../memberships — cashier → 403 (no tenancy:membership:manage)', async () => {
    await request(app.getHttpServer())
      .post(`/api/orgs/${testOrgId}/branches/${testBranchId}/memberships`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ userId: ownerUserId, roleId: 'some-role' })
      .expect(403);
  });

  // ── M2 regression: health still works ──

  it('GET /api/health — still returns ok', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.status).toBe('ok');
      });
  });
});
