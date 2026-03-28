import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M19 Operational Dashboards + KPI Streams e2e tests.
 * Requires seeded DB with M19 permissions and demo data.
 */
describe('Dashboards (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;
  const createdSnapshotIds: string[] = [];

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
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

    // Login as owner (all permissions)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as chef (limited permissions — no dashboard access)
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
  }, 30000);

  afterAll(async () => {
    const prisma = moduleFixture.get(PrismaService);
    if (createdSnapshotIds.length > 0) {
      await prisma.kpiSnapshot.deleteMany({
        where: { id: { in: createdSnapshotIds } },
      });
    }
    await app.close();
  }, 30000);

  // ── Owner Dashboard ──

  it('GET /api/dash/owner — should return owner dashboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/owner')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.today).toBeDefined();
    expect(res.body.mtd).toBeDefined();
    expect(res.body.paymentMix).toBeDefined();
    expect(res.body.openOrders).toBeDefined();
    expect(res.body.lowStockCount).toBeDefined();
    expect(res.body.anomalySummary).toBeDefined();
    expect(res.body.calculatedAt).toBeDefined();
  });

  // ── Manager Dashboard ──

  it('GET /api/dash/manager — should return manager dashboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/manager')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.today).toBeDefined();
    expect(res.body.openOrders).toBeDefined();
    expect(res.body.shiftSummary).toBeDefined();
    expect(res.body.calculatedAt).toBeDefined();
  });

  // ── Today Summary ──

  it('GET /api/dash/today-summary — should return today summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/today-summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.date).toBeDefined();
    expect(res.body.grossSales).toBeDefined();
    expect(res.body.netSales).toBeDefined();
    expect(res.body.paymentMix).toBeDefined();
    expect(res.body.openOrders).toBeDefined();
    expect(res.body.closedOrders).toBeDefined();
    expect(res.body.calculatedAt).toBeDefined();
  });

  // ── Payment Mix ──

  it('GET /api/dash/payment-mix — should return payment mix', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/payment-mix')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.cash).toBeDefined();
    expect(res.body.card).toBeDefined();
    expect(res.body.momo).toBeDefined();
    expect(res.body.total).toBeDefined();
  });

  // ── Open Orders ──

  it('GET /api/dash/open-orders — should return open orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/open-orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.count).toBeDefined();
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  // ── Low Stock ──

  it('GET /api/dash/low-stock — should return low stock items', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/low-stock')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.count).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  // ── Snapshots ──

  it('GET /api/dash/snapshots — should list KPI snapshots', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/snapshots')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── KPI Refresh ──

  it('POST /api/dash/kpi/refresh — should create a KPI snapshot', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dash/kpi/refresh')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ scopeType: 'BRANCH', metricWindow: 'TODAY' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.scopeType).toBe('BRANCH');
    expect(res.body.metricWindow).toBe('TODAY');
    createdSnapshotIds.push(res.body.id);
  });

  it('POST /api/dash/kpi/refresh — should work with MTD window', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dash/kpi/refresh')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ scopeType: 'OWNER', metricWindow: 'MTD' });

    expect(res.status).toBe(201);
    expect(res.body.metricWindow).toBe('MTD');
    createdSnapshotIds.push(res.body.id);
  });

  // ── Permission Guard ──

  it('GET /api/dash/owner — chef should be denied (403)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/owner')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(403);
  });

  it('GET /api/dash/manager — chef should be denied (403)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/manager')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(403);
  });

  it('POST /api/dash/kpi/refresh — chef should be denied (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dash/kpi/refresh')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-branch-id', branchId)
      .send({ scopeType: 'BRANCH', metricWindow: 'TODAY' });

    expect(res.status).toBe(403);
  });

  // ── Missing Branch Header ──

  it('GET /api/dash/owner — should reject missing branch header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dash/owner')
      .set('Authorization', `Bearer ${ownerToken}`);

    // BranchContextGuard returns 400 or 403 when no x-branch-id header
    expect([400, 403]).toContain(res.status);
  });

  // ── Unauthenticated ──

  it('GET /api/dash/owner — should reject unauthenticated (401)', async () => {
    const res = await request(app.getHttpServer()).get('/api/dash/owner');

    expect(res.status).toBe(401);
  });
});
