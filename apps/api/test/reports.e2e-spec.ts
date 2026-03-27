import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M20 Reporting v1 + Exports e2e tests.
 * Requires seeded DB with M20 permissions and demo data.
 */
describe('Reports (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;
  const createdRunIds: string[] = [];
  const createdArtifactIds: string[] = [];

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

    // Login as chef (limited permissions — no report access)
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
    if (createdArtifactIds.length > 0) {
      await prisma.exportArtifact.deleteMany({
        where: { id: { in: createdArtifactIds } },
      });
    }
    if (createdRunIds.length > 0) {
      await prisma.reportRun.deleteMany({
        where: { id: { in: createdRunIds } },
      });
    }
    await app.close();
  }, 30000);

  // ── Shift-End Report ──

  it('POST /api/reports/shift-end — should generate shift-end report', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/shift-end')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.reportType).toBe('SHIFT_END');
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.summary).toBeDefined();
    createdRunIds.push(res.body.id);
  });

  // ── Daily Sales Report ──

  it('POST /api/reports/daily-sales — should generate daily sales report', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/daily-sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('DAILY_SALES');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Payment Mix Report ──

  it('POST /api/reports/payment-mix — should generate payment mix report', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/payment-mix')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('PAYMENT_MIX');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Top Items Report ──

  it('POST /api/reports/top-items — should generate top items report', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/top-items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY', limit: 5 });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('TOP_ITEMS');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Stock Variance Report ──

  it('POST /api/reports/stock-variance — should generate stock variance report', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/stock-variance')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('STOCK_VARIANCE');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Anomaly Summary Report ──

  it('POST /api/reports/anomaly-summary — should generate anomaly summary report', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/anomaly-summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('ANOMALY_SUMMARY');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── List Reports ──

  it('GET /api/reports — should list reports with pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .query({ page: 1, pageSize: 10 });

    if (res.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('LIST STATUS:', res.status, 'BODY:', JSON.stringify(res.body));
    }
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeDefined();
    expect(res.body.page).toBe(1);
  });

  // ── Get Report By ID ──

  it('GET /api/reports/:id — should get report by id', async () => {
    const runId = createdRunIds[0];
    if (!runId) return; // skip if no runs created

    const res = await request(app.getHttpServer())
      .get(`/api/reports/${runId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(runId);
  });

  // ── Export ──

  it('POST /api/reports/export — should create CSV export', async () => {
    const runId = createdRunIds[0];
    if (!runId) return;

    const res = await request(app.getHttpServer())
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportRunId: runId, format: 'CSV' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('READY');
    expect(res.body.format).toBe('CSV');
    createdArtifactIds.push(res.body.id);
  });

  // ── Download Export ──

  it('GET /api/reports/exports/:id/download — should download export file', async () => {
    const artifactId = createdArtifactIds[0];
    if (!artifactId) return;

    const res = await request(app.getHttpServer())
      .get(`/api/reports/exports/${artifactId}/download`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });

  // ── 403 Forbidden for chef ──

  it('POST /api/reports/shift-end — 403 for chef', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/shift-end')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(403);
  });

  it('GET /api/reports — 403 for chef', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(403);
  });

  // ── 401 Unauthorized ──

  it('POST /api/reports/shift-end — 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/shift-end')
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(401);
  });

  // ── 400 Validation ──

  it('POST /api/reports/shift-end — 400 for missing reportWindow', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/shift-end')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({});

    expect(res.status).toBe(400);
  });

  it('POST /api/reports/shift-end — 400 for invalid reportWindow', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/shift-end')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'INVALID' });

    expect(res.status).toBe(400);
  });

  // ── Custom Date Range ──

  it('POST /api/reports/daily-sales — custom date range', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/daily-sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({
        reportWindow: 'CUSTOM',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('DAILY_SALES');
    expect(res.body.reportWindow).toBe('CUSTOM');
    createdRunIds.push(res.body.id);
  });

  // ── Export for non-existent report ──

  it('POST /api/reports/export — 404 for non-existent report', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportRunId: 'non-existent-id', format: 'CSV' });

    expect(res.status).toBe(404);
  });
});
