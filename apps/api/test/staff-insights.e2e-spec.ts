import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M27 Staff Insights + Awards + Promotion Suggestions e2e tests.
 * Requires seeded DB with M27 permissions + at least 1 active employee.
 */
describe('Staff Insights + Awards + Promotion Suggestions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;

  // IDs captured during tests
  let employeeId: string;
  let _insightId: string;
  let awardId: string;
  let promotionSuggestionId: string;

  const periodStart = '2099-06-01';
  const periodEnd = '2099-06-30';

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

    prisma = moduleFixture.get(PrismaService);

    // Login as owner
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as chef (limited permissions)
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

    if (!branchId) {
      const branch = await prisma.branch.findFirst();
      branchId = branch!.id;
    }

    // Get active employee from seed
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      take: 1,
    });
    if (employees.length >= 1) {
      employeeId = employees[0].id;
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup e2e data
    if (promotionSuggestionId) {
      await prisma.promotionSuggestion.deleteMany({ where: { id: promotionSuggestionId } });
    }
    if (awardId) {
      await prisma.staffAward.deleteMany({ where: { id: awardId } });
    }
    // Clean up any e2e-period snapshots
    await prisma.staffInsightSnapshot.deleteMany({
      where: { periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) },
    });
    await app.close();
  }, 30000);

  // ── Weights ──

  describe('GET /api/staff/weights', () => {
    it('should return scoring weights', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/staff/weights')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.salesWeight).toBeDefined();
      expect(res.body.reliabilityWeight).toBeDefined();
      expect(res.body.attendanceWeight).toBeDefined();
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/staff/weights')
        .set('x-branch-id', branchId);

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/staff/weights', () => {
    it('should update scoring weights', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/staff/weights')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ salesWeight: 30 });

      expect(res.status).toBe(200);
      expect(res.body.salesWeight).toBe(30);
    });

    it('should reject invalid weight value', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/staff/weights')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ salesWeight: 150 });

      expect(res.status).toBe(400);
    });
  });

  // ── Generate Insights ──

  describe('POST /api/staff/insights/generate', () => {
    it('should generate staff insight snapshots', async () => {
      if (!employeeId) return;

      const res = await request(app.getHttpServer())
        .post('/api/staff/insights/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          periodStart,
          periodEnd,
          employeeIds: [employeeId],
        });

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      _insightId = res.body[0]?.id;
    });

    it('should be idempotent for same period', async () => {
      if (!employeeId) return;

      const res = await request(app.getHttpServer())
        .post('/api/staff/insights/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          periodStart,
          periodEnd,
          employeeIds: [employeeId],
        });

      expect(res.status).toBe(201);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should reject missing period', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/staff/insights/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── List / Get Insights ──

  describe('GET /api/staff/insights', () => {
    it('should list staff insights', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/staff/insights')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter by employeeId', async () => {
      if (!employeeId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/staff/insights?employeeId=${employeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/staff/insights/:employeeId', () => {
    it('should return insight detail for employee', async () => {
      if (!employeeId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/staff/insights/${employeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 404 for non-existent employee', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/staff/insights/nonexistent-emp')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── Awards ──

  describe('POST /api/staff/awards', () => {
    it('should create a staff award', async () => {
      if (!employeeId) return;

      const res = await request(app.getHttpServer())
        .post('/api/staff/awards')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          employeeId,
          awardType: 'EMPLOYEE_OF_MONTH',
          periodStart,
          periodEnd,
          title: 'E2E Top Performer',
          reason: 'Outstanding performance in e2e testing period',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.awardType).toBe('EMPLOYEE_OF_MONTH');
      awardId = res.body.id;
    });

    it('should reject unknown employee', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/staff/awards')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          employeeId: 'nonexistent',
          awardType: 'EMPLOYEE_OF_MONTH',
          periodStart,
          periodEnd,
          title: 'Bad Award',
        });

      expect(res.status).toBe(404);
    });

    it('should reject unauthorized role (Chef)', async () => {
      if (!employeeId) return;

      const res = await request(app.getHttpServer())
        .post('/api/staff/awards')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({
          employeeId,
          awardType: 'EMPLOYEE_OF_MONTH',
          periodStart,
          periodEnd,
          title: 'Chef Award',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/staff/awards', () => {
    it('should list staff awards', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/staff/awards')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Promotion Suggestions ──

  describe('POST /api/staff/promotion-suggestions/generate', () => {
    it('should generate promotion suggestions', async () => {
      if (!employeeId) return;

      const res = await request(app.getHttpServer())
        .post('/api/staff/promotion-suggestions/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          periodStart,
          periodEnd,
          employeeIds: [employeeId],
        });

      // May return 201 with suggestions or 400 if no insights above threshold
      if (res.status === 201 && Array.isArray(res.body) && res.body.length > 0) {
        promotionSuggestionId = res.body[0].id;
      }
      expect([201, 400]).toContain(res.status);
    });
  });

  describe('GET /api/staff/promotion-suggestions', () => {
    it('should list promotion suggestions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/staff/promotion-suggestions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PATCH /api/staff/promotion-suggestions/:id/decision', () => {
    it('should accept a pending promotion suggestion', async () => {
      if (!promotionSuggestionId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/staff/promotion-suggestions/${promotionSuggestionId}/decision`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ decision: 'ACCEPTED', decisionNotes: 'Approved in e2e' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACCEPTED');
    });

    it('should reject deciding an already decided suggestion', async () => {
      if (!promotionSuggestionId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/staff/promotion-suggestions/${promotionSuggestionId}/decision`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ decision: 'REJECTED' });

      expect(res.status).toBe(409);
    });

    it('should return 404 for non-existent suggestion', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/staff/promotion-suggestions/nonexistent/decision')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ decision: 'ACCEPTED' });

      expect(res.status).toBe(404);
    });
  });
});
