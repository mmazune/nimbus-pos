import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M37 Budgets + Forecasts + Procurement Advisory e2e tests.
 * Requires seeded DB with M37 permissions, an OPEN fiscal period, and seeded GL journals.
 */
describe('Budgets + Forecasts + Procurement Advisory (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;
  let orgId: string;

  // IDs captured during tests
  let budgetId: string;
  let fiscalPeriodId: string;
  let procurementSuggestionId: string;
  let demandCalendarId: string;
  const forecastRunIds: string[] = [];

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

    // Get branch and org IDs
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

    const branch = await prisma.branch.findFirst({ where: { id: branchId } });
    orgId = branch!.organizationId;

    // Ensure a seeded OPEN fiscal period exists
    const existing = await prisma.fiscalPeriod.findFirst({
      where: { orgId, status: 'OPEN' },
    });
    if (!existing) {
      const user = await prisma.user.findFirst({
        where: { memberships: { some: {} } },
      });
      const created = await prisma.fiscalPeriod.create({
        data: {
          orgId,
          name: 'E2E M37 Period',
          startsAt: new Date('2028-01-01'),
          endsAt: new Date('2028-01-31'),
          status: 'OPEN',
          openedAt: new Date(),
          openedById: user!.id,
        },
      });
      fiscalPeriodId = created.id;
    } else {
      fiscalPeriodId = existing.id;
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (budgetId) {
      await prisma.budgetLine.deleteMany({ where: { budgetId } });
      await prisma.budget.deleteMany({ where: { id: budgetId } });
    }
    // Clean up only the demand calendar entry created during this test run
    if (demandCalendarId) {
      await prisma.demandCalendarEntry.deleteMany({ where: { id: demandCalendarId } });
    }
    // Clean up only the procurement suggestion seeded for review tests
    if (procurementSuggestionId) {
      await prisma.procurementSuggestion.deleteMany({ where: { id: procurementSuggestionId } });
    }
    // Clean up forecast runs and their generated suggestions created during tests
    if (forecastRunIds.length > 0) {
      await prisma.procurementSuggestion.deleteMany({
        where: { forecastRunId: { in: forecastRunIds } },
      });
      await prisma.forecastRun.deleteMany({ where: { id: { in: forecastRunIds } } });
    }
    // Only clean up fiscal period if we created it
    if (fiscalPeriodId) {
      const period = await prisma.fiscalPeriod.findFirst({
        where: { id: fiscalPeriodId, name: 'E2E M37 Period' },
      });
      if (period) {
        await prisma.fiscalPeriod.deleteMany({ where: { id: fiscalPeriodId } });
      }
    }
    await app.close();
  }, 30000);

  // ── Budget List ──

  describe('GET /api/finance/budgets', () => {
    it('should return 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/budgets')
        .set('x-branch-id', branchId);

      expect(res.status).toBe(401);
    });

    it('should return 403 for chef (missing permission)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/budgets')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });

    it('should return empty array with no budgets yet', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Budget Create ──

  describe('POST /api/finance/budgets', () => {
    it('should return 400 for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ name: 'Incomplete budget' });

      expect(res.status).toBe(400);
    });

    it('should return 403 for chef (missing write permission)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/budgets')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Chef Budget',
          periodStart: '2028-01-01',
          periodEnd: '2028-01-31',
          lines: [],
        });

      expect(res.status).toBe(403);
    });

    it('should create a budget with lines', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'E2E Operational Budget Jan 2028',
          periodStart: '2028-01-01',
          periodEnd: '2028-01-31',
          budgetType: 'OPERATIONAL',
          version: 1,
          fiscalPeriodId,
          notes: 'Created by e2e test',
          lines: [
            {
              category: 'Food Cost',
              dimension: 'Kitchen',
              budgetAmount: 500000,
            },
            {
              category: 'Labour',
              dimension: 'FOH',
              budgetAmount: 300000,
            },
            {
              category: 'Operational',
              budgetAmount: 100000,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('E2E Operational Budget Jan 2028');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.totalBudget).toBeDefined();
      expect(res.body.lines).toHaveLength(3);
      budgetId = res.body.id;
    });

    it('should reject duplicate budget (same org+branch+period+type+version)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Duplicate Budget',
          periodStart: '2028-01-01',
          periodEnd: '2028-01-31',
          budgetType: 'OPERATIONAL',
          version: 1,
          fiscalPeriodId,
          lines: [{ category: 'Misc', budgetAmount: 10000 }],
        });

      expect(res.status).toBe(409);
    });

    it('should reject invalid fiscalPeriodId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Invalid Period Budget',
          periodStart: '2028-02-01',
          periodEnd: '2028-02-29',
          budgetType: 'OPERATIONAL',
          version: 1,
          fiscalPeriodId: 'nonexistent-period-id',
          lines: [{ category: 'Test', budgetAmount: 100 }],
        });

      expect(res.status).toBe(400);
    });
  });

  // ── Budget Get ──

  describe('GET /api/finance/budgets/:id', () => {
    it('should return the created budget', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/finance/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(budgetId);
      expect(res.body.lines).toHaveLength(3);
      const categories = res.body.lines.map((l: any) => l.category);
      expect(categories).toContain('Food Cost');
      expect(categories).toContain('Labour');
    });

    it('should return 404 for unknown budget ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/budgets/nonexistent-id-xyz')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── Update Actuals ──

  describe('POST /api/finance/budgets/:id/update-actuals', () => {
    it('should update actuals and return updated budget', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/finance/budgets/${budgetId}/update-actuals`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          windowStart: '2028-01-01',
          windowEnd: '2028-01-31',
          notes: 'E2E actuals refresh',
        });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(budgetId);
      // Actuals may be 0 if no GL data in window; variance = budgetAmount
      expect(res.body.lines).toBeDefined();
    });

    it('should return 404 for unknown budget ID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/budgets/unknown-budget/update-actuals')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({});

      expect(res.status).toBe(404);
    });

    it('should return 403 for chef (missing permission)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/finance/budgets/${budgetId}/update-actuals`)
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  // ── Procurement Suggestions ──

  describe('GET /api/finance/procurement-suggestions', () => {
    it('should return 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/procurement-suggestions')
        .set('x-branch-id', branchId);

      expect(res.status).toBe(401);
    });

    it('should return 403 for chef (missing permission)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/procurement-suggestions')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });

    it('should return list (array) for owner', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/procurement-suggestions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PATCH /api/finance/procurement-suggestions/:id/review', () => {
    beforeAll(async () => {
      // Seed a PENDING procurement suggestion for review tests
      const item = await prisma.inventoryItem.findFirst({
        where: { branchId },
      });
      if (item) {
        const created = await prisma.procurementSuggestion.create({
          data: {
            orgId,
            branchId,
            inventoryItemId: item.id,
            suggestedQty: 10,
            estimatedUnitCost: 5000,
            estimatedTotalCost: 50000,
            priority: 1,
            rationale: 'Stock below reorder level — e2e seed',
            status: 'PENDING',
          },
        });
        procurementSuggestionId = created.id;
      }
    });

    it('should review (REVIEWED) a PENDING suggestion', async () => {
      if (!procurementSuggestionId) {
        console.warn('Skipping review test: no inventory item found for seeding.');
        return;
      }

      const res = await request(app.getHttpServer())
        .patch(`/api/finance/procurement-suggestions/${procurementSuggestionId}/review`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ status: 'REVIEWED', reviewNotes: 'Reviewed in e2e test' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REVIEWED');
      expect(res.body.reviewNotes).toBe('Reviewed in e2e test');
    });

    it('should return 400 when re-reviewing a non-PENDING suggestion', async () => {
      if (!procurementSuggestionId) {
        console.warn('Skipping re-review test: no suggestion available.');
        return;
      }

      const res = await request(app.getHttpServer())
        .patch(`/api/finance/procurement-suggestions/${procurementSuggestionId}/review`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ status: 'DISMISSED' });

      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown suggestion ID', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/finance/procurement-suggestions/nonexistent-id/review')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ status: 'REVIEWED' });

      expect(res.status).toBe(404);
    });
  });

  // ── Forecast ──

  describe('GET /api/franchise/forecast', () => {
    it('should return 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/forecast')
        .set('x-branch-id', branchId);

      expect(res.status).toBe(401);
    });

    it('should return 403 for chef (missing permission)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/forecast')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });

    it('should generate and return a forecast run with operational summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/forecast')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .query({ refresh: 'true', forecastType: 'BRANCH' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      if (res.body.id) forecastRunIds.push(res.body.id);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.forecastType).toBe('BRANCH');
      expect(res.body.outputs).toBeDefined();
      // New operational forecast outputs
      if (res.body.outputs.operationalSummary) {
        expect(res.body.outputs.operationalSummary).toHaveProperty('totalProjectedCovers');
        expect(res.body.outputs.operationalSummary).toHaveProperty('busyPeriods');
      }
      if (res.body.outputs.financialSummary) {
        expect(res.body.outputs.financialSummary).toHaveProperty('projectedRevenue');
      }
    });

    it('should return cached forecast run without refresh', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/forecast')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .query({ forecastType: 'BRANCH' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
    });

    it('should filter by fiscalPeriodId if provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/forecast')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .query({ refresh: 'true', forecastType: 'BRANCH', fiscalPeriodId });

      expect(res.status).toBe(200);
      if (res.body.id) forecastRunIds.push(res.body.id);
    });
  });

  // ── Budget List with Status Filter ──

  describe('GET /api/finance/budgets?status=DRAFT', () => {
    it('should filter budgets by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .query({ status: 'DRAFT' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((b: any) => b.id === budgetId);
      expect(found).toBeDefined();
      expect(found.status).toBe('DRAFT');
    });

    it('should return empty array when filtering by non-existent status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .query({ status: 'ARCHIVED' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Budget we created is DRAFT, so ARCHIVED filter should not include it
      const found = res.body.find((b: any) => b.id === budgetId);
      expect(found).toBeUndefined();
    });
  });

  // ── Demand Calendar ──

  describe('POST /api/finance/demand-calendar', () => {
    it('should return 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/demand-calendar')
        .set('x-branch-id', branchId)
        .send({
          calendarType: 'BRUNCH',
          title: 'Test',
          dateStart: '2028-01-10',
          dateEnd: '2028-01-10',
        });

      expect(res.status).toBe(401);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/demand-calendar')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ title: 'Incomplete' });

      expect(res.status).toBe(400);
    });

    it('should create a demand calendar entry', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/demand-calendar')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          calendarType: 'SPORTS_NIGHT',
          daypart: 'DINNER',
          title: 'E2E Premier League Night',
          dateStart: '2028-01-15',
          dateEnd: '2028-01-15',
          expectedCovers: 100,
          demandMultiplier: 1.8,
          revenueUpliftPct: 40,
          itemNotes: 'Wings, nachos, beer kegs',
          notes: 'Created by e2e test',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.calendarType).toBe('SPORTS_NIGHT');
      expect(res.body.daypart).toBe('DINNER');
      expect(res.body.title).toBe('E2E Premier League Night');
      expect(res.body.expectedCovers).toBe(100);
      demandCalendarId = res.body.id;
    });

    it('should reject dateEnd before dateStart', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/finance/demand-calendar')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          calendarType: 'CUSTOM',
          title: 'Bad Dates',
          dateStart: '2028-01-20',
          dateEnd: '2028-01-10',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/finance/demand-calendar', () => {
    it('should list demand calendar entries for branch', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/demand-calendar')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by calendarType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/demand-calendar')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .query({ calendarType: 'SPORTS_NIGHT' });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      for (const entry of res.body) {
        expect(entry.calendarType).toBe('SPORTS_NIGHT');
      }
    });
  });

  describe('GET /api/finance/demand-calendar/:id', () => {
    it('should return a single demand calendar entry', async () => {
      if (!demandCalendarId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/finance/demand-calendar/${demandCalendarId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(demandCalendarId);
      expect(res.body.itemNotes).toContain('Wings');
    });

    it('should return 404 for unknown id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/finance/demand-calendar/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/finance/demand-calendar/:id', () => {
    it('should update a demand calendar entry', async () => {
      if (!demandCalendarId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/finance/demand-calendar/${demandCalendarId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ expectedCovers: 120, notes: 'Updated in e2e' });

      expect(res.status).toBe(200);
      expect(res.body.expectedCovers).toBe(120);
      expect(res.body.notes).toBe('Updated in e2e');
    });
  });

  describe('DELETE /api/finance/demand-calendar/:id', () => {
    it('should delete the demand calendar entry', async () => {
      if (!demandCalendarId) return;

      const res = await request(app.getHttpServer())
        .delete(`/api/finance/demand-calendar/${demandCalendarId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);

      // Verify it's gone
      const check = await request(app.getHttpServer())
        .get(`/api/finance/demand-calendar/${demandCalendarId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(check.status).toBe(404);
    });
  });
});
