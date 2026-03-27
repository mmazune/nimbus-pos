import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M18 Anomaly Detection + Anti-Theft Signals e2e tests.
 * Requires seeded DB with M18 permissions, rules, and thresholds.
 */
describe('Analytics (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;
  let ruleId: string;
  let anomalyId: string;
  let thresholdId: string;
  const createdRuleIds: string[] = [];
  const createdEventIds: string[] = [];

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

    // Login as owner (has all permissions)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as chef (limited permissions — no analytics)
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
    // Cleanup created test data
    const prisma = moduleFixture.get(PrismaService);
    if (createdEventIds.length > 0) {
      await prisma.anomalyEvent.deleteMany({
        where: { id: { in: createdEventIds } },
      });
    }
    if (createdRuleIds.length > 0) {
      await prisma.anomalyRule.deleteMany({
        where: { id: { in: createdRuleIds } },
      });
    }
    await app.close();
  }, 30000);

  // ── Anomaly Rules CRUD ──

  it('POST /api/analytics/anomaly-rules — should create a rule', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/analytics/anomaly-rules')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({
        code: 'E2E-VOID-01',
        name: 'E2E Void Spike',
        type: 'VOID_SPIKE',
        severity: 'HIGH',
        metricKey: 'order.void.count_per_staff',
        operator: '>=',
        thresholdValue: 5,
        windowMinutes: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('E2E-VOID-01');
    expect(res.body.type).toBe('VOID_SPIKE');
    expect(res.body.severity).toBe('HIGH');
    expect(res.body.status).toBe('ACTIVE');
    ruleId = res.body.id;
    createdRuleIds.push(ruleId);
  });

  it('POST /api/analytics/anomaly-rules — should reject duplicate code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/analytics/anomaly-rules')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({
        code: 'E2E-VOID-01',
        name: 'Duplicate',
        type: 'VOID_SPIKE',
        severity: 'LOW',
        metricKey: 'test',
        operator: '>=',
      });

    expect(res.status).toBe(409);
  });

  it('GET /api/analytics/anomaly-rules — should list rules', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/anomaly-rules')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/analytics/anomaly-rules/:id — should get rule by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/analytics/anomaly-rules/${ruleId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ruleId);
    expect(res.body.code).toBe('E2E-VOID-01');
  });

  it('PATCH /api/analytics/anomaly-rules/:id — should update rule', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/analytics/anomaly-rules/${ruleId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ name: 'Updated Void Spike', severity: 'CRITICAL' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Void Spike');
    expect(res.body.severity).toBe('CRITICAL');
  });

  // ── Anomaly Events ──

  it('GET /api/analytics/anomalies — should list anomaly events', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/anomalies')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.total).toBeDefined();
    // Capture anomaly ID from seed data if available
    if (res.body.data.length > 0) {
      anomalyId = res.body.data[0].id;
    }
  });

  it('GET /api/analytics/anomalies — should filter by status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/anomalies?status=OPEN')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      expect(res.body.data.every((a: any) => a.status === 'OPEN')).toBe(true);
    }
  });

  it('PATCH /api/analytics/anomalies/:id/acknowledge — should acknowledge anomaly', async () => {
    if (!anomalyId) {
      console.log('  ⚠ No anomaly to acknowledge — skipping');
      return;
    }

    const res = await request(app.getHttpServer())
      .patch(`/api/analytics/anomalies/${anomalyId}/acknowledge`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ resolutionNotes: 'Reviewed by e2e test' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACKNOWLEDGED');
    expect(res.body.acknowledgedById).toBeDefined();
  });

  it('PATCH /api/analytics/anomalies/:id/resolve — should resolve acknowledged anomaly', async () => {
    if (!anomalyId) {
      console.log('  ⚠ No anomaly to resolve — skipping');
      return;
    }

    const res = await request(app.getHttpServer())
      .patch(`/api/analytics/anomalies/${anomalyId}/resolve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ resolutionNotes: 'Resolved by e2e test — false positive' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
  });

  // ── Risk Dashboard ──

  it('GET /api/analytics/risk-dashboard — should return dashboard data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/risk-dashboard')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(res.body.openAnomalies).toBeDefined();
    expect(res.body.severityBreakdown).toBeDefined();
    expect(res.body.typeBreakdown).toBeDefined();
    expect(res.body.topStaffByAnomalies).toBeDefined();
    expect(res.body.windowStart).toBeDefined();
    expect(res.body.windowEnd).toBeDefined();
  });

  // ── Thresholds ──

  it('GET /api/analytics/thresholds — should list thresholds', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/thresholds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      thresholdId = res.body[0].id;
    }
  });

  it('PATCH /api/analytics/thresholds/:id — should update threshold', async () => {
    if (!thresholdId) {
      console.log('  ⚠ No threshold to update — skipping');
      return;
    }

    const res = await request(app.getHttpServer())
      .patch(`/api/analytics/thresholds/${thresholdId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({ description: 'Updated by e2e test' });

    expect(res.status).toBe(200);
  });

  // ── Recalculate ──

  it('POST /api/analytics/anomalies/recalculate — should trigger recalculation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/analytics/anomalies/recalculate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.rulesEvaluated).toBeDefined();
    expect(res.body.results).toBeDefined();
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  // ── Permission Guard ──

  it('GET /api/analytics/anomalies — chef should be denied (403)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/anomalies')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-branch-id', branchId);

    expect(res.status).toBe(403);
  });

  it('POST /api/analytics/anomaly-rules — chef should be denied (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/analytics/anomaly-rules')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-branch-id', branchId)
      .send({
        code: 'SHOULD-FAIL',
        name: 'Fail',
        type: 'CUSTOM',
        severity: 'LOW',
        metricKey: 'test',
        operator: '>=',
      });

    expect(res.status).toBe(403);
  });

  // ── Validation ──

  it('POST /api/analytics/anomaly-rules — should reject invalid type', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/analytics/anomaly-rules')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', branchId)
      .send({
        code: 'BAD-TYPE',
        name: 'Bad Type',
        type: 'INVALID_TYPE',
        severity: 'LOW',
        metricKey: 'test',
        operator: '>=',
      });

    expect(res.status).toBe(400);
  });
});
