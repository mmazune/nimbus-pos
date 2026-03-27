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

  // ══════════════════════════════════════════════════════════════
  // M20.1 — New Report Endpoints
  // ══════════════════════════════════════════════════════════════

  // ── Report Catalog ──

  it('GET /api/reports/catalog — should return report catalog', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/catalog')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(20);
    const entry = res.body[0];
    expect(entry.key).toBeDefined();
    expect(entry.title).toBeDefined();
    expect(entry.status).toBeDefined();
  });

  // ── Sales by Category ──

  it('POST /api/reports/sales-by-category — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/sales-by-category')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('SALES_BY_CATEGORY');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Sales by Hour ──

  it('POST /api/reports/sales-by-hour — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/sales-by-hour')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('SALES_BY_HOUR');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Open/Closed Orders ──

  it('POST /api/reports/open-closed-orders — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/open-closed-orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('OPEN_CLOSED_ORDERS');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Discounts Summary ──

  it('POST /api/reports/discounts-summary — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/discounts-summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('DISCOUNTS_SUMMARY');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Voids Summary ──

  it('POST /api/reports/voids-summary — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/voids-summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('VOIDS_SUMMARY');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Refunds Summary ──

  it('POST /api/reports/refunds-summary — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/refunds-summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('REFUNDS_SUMMARY');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Cash Variance ──

  it('POST /api/reports/cash-variance — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/cash-variance')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('CASH_VARIANCE');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Cash Movements ──

  it('POST /api/reports/cash-movements — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/cash-movements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('CASH_MOVEMENTS');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Wastage Summary ──

  it('POST /api/reports/wastage-summary — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/wastage-summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('WASTAGE_SUMMARY');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Low Stock ──

  it('POST /api/reports/low-stock — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/low-stock')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('LOW_STOCK');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Reservation Summary ──

  it('POST /api/reports/reservation-summary — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/reservation-summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('RESERVATION_SUMMARY');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Reservation Deposits ──

  it('POST /api/reports/reservation-deposits — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/reservation-deposits')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('RESERVATION_DEPOSITS');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Reservation No-Shows ──

  it('POST /api/reports/reservation-no-shows — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/reservation-no-shows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('RESERVATION_NO_SHOWS');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Event Summary ──

  it('POST /api/reports/event-summary — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/event-summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('EVENT_SUMMARY');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Event Bookings ──

  it('POST /api/reports/event-bookings — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/event-bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('EVENT_BOOKINGS');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Event Checkins ──

  it('POST /api/reports/event-checkins — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/event-checkins')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('EVENT_CHECKINS');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Anomaly — High Risk Actors ──

  it('POST /api/reports/high-risk-actors — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/high-risk-actors')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('HIGH_RISK_ACTORS');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── Staff Operations ──

  it('POST /api/reports/staff-operations — should generate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/staff-operations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('STAFF_OPERATIONS');
    expect(res.body.status).toBe('COMPLETED');
    createdRunIds.push(res.body.id);
  });

  // ── M20.1 CSV Export for new report type ──

  it('POST /api/reports/export — should create CSV for sales-by-category', async () => {
    // Find the sales-by-category run
    const catRunId = createdRunIds.find((_, i) => i >= 17); // first M20.1 run ID
    if (!catRunId) return;

    const res = await request(app.getHttpServer())
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ reportRunId: catRunId, format: 'CSV' });

    expect(res.status).toBe(201);
    expect(res.body.format).toBe('CSV');
    expect(res.body.status).toBe('READY');
    createdArtifactIds.push(res.body.id);
  });

  // ── M20.1 — 403 for chef on new endpoints ──

  it('POST /api/reports/sales-by-category — 403 for chef', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reports/sales-by-category')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-branch-id', branchId)
      .send({ reportWindow: 'DAY' });

    expect(res.status).toBe(403);
  });

  it('GET /api/reports/catalog — 403 for chef', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/catalog')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(403);
  });
});
