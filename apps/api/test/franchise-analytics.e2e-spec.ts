import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

describe('Franchise Analytics (M38.1) – E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let orgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    // Auth tokens
    const ownerRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerRes.body.accessToken;

    const chefRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'chef@demo.local', password: 'Chef#123' });
    chefToken = chefRes.body.accessToken;

    // Resolve org
    const owner = await prisma.user.findFirst({ where: { email: 'owner@demo.local' } });
    const membership = await prisma.membership.findFirst({
      where: { userId: owner!.id, status: 'ACTIVE' },
    });
    orgId = membership!.organizationId;
  }, 60000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  // ═══════════════════════════════════════
  // Consolidated Finance
  // ═══════════════════════════════════════

  describe('GET /api/franchise/consolidated-finance', () => {
    it('401 — no auth', async () => {
      await request(app.getHttpServer()).get('/api/franchise/consolidated-finance').expect(401);
    });

    it('403 — chef has no franchise:analytics:read', async () => {
      await request(app.getHttpServer())
        .get('/api/franchise/consolidated-finance')
        .set('Authorization', `Bearer ${chefToken}`)
        .expect(403);
    });

    it('200 — owner gets consolidated finance', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/consolidated-finance')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.orgId).toBe(orgId);
      expect(res.body.consolidated).toBeDefined();
      expect(res.body.consolidated.revenue).toBeDefined();
      expect(res.body.consolidated.grossProfit).toBeDefined();
      expect(res.body.consolidated.primeCost).toBeDefined();
      expect(res.body.consolidated.primeCostPct).toBeDefined();
      expect(res.body.branches).toBeInstanceOf(Array);
      expect(res.body.branches.length).toBeGreaterThanOrEqual(1);
      expect(res.body.calculationBasis).toBeDefined();
    });

    it('200 — with window params', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/consolidated-finance')
        .query({
          windowStart: '2026-01-01',
          windowEnd: '2026-01-31',
          windowType: 'MONTHLY',
        })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.windowType).toBe('MONTHLY');
    });
  });

  // ═══════════════════════════════════════
  // Generate Consolidated Snapshot
  // ═══════════════════════════════════════

  describe('POST /api/franchise/consolidated-finance/generate', () => {
    it('200 — generates snapshot and persists', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/franchise/consolidated-finance/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.runId).toBeDefined();
      expect(res.body.metricsCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════
  // Financial Comparison
  // ═══════════════════════════════════════

  describe('GET /api/franchise/financial-comparison', () => {
    it('401 — no auth', async () => {
      await request(app.getHttpServer()).get('/api/franchise/financial-comparison').expect(401);
    });

    it('200 — returns comparison with portfolio averages', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/financial-comparison')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.portfolioAverage).toBeDefined();
      expect(res.body.bestBranch).toBeDefined();
      expect(res.body.worstBranch).toBeDefined();
      expect(res.body.branches).toBeInstanceOf(Array);
      for (const b of res.body.branches) {
        expect(b.vsPortfolio).toBeDefined();
      }
    });
  });

  // ═══════════════════════════════════════
  // Waste Benchmarks
  // ═══════════════════════════════════════

  describe('GET /api/franchise/waste-benchmarks', () => {
    it('401 — no auth', async () => {
      await request(app.getHttpServer()).get('/api/franchise/waste-benchmarks').expect(401);
    });

    it('200 — returns waste benchmarks with rankings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/waste-benchmarks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.portfolioAverage).toBeDefined();
      expect(res.body.branches).toBeInstanceOf(Array);
      expect(res.body.calculationBasis).toBeDefined();
      for (const b of res.body.branches) {
        expect(b.rank).toBeDefined();
        expect(b.wasteValue).toBeDefined();
        expect(b.wastePctCogs).toBeDefined();
        expect(b.theoreticalCogs).toBeDefined();
        expect(b.actualCogs).toBeDefined();
        expect(b.varianceAmount).toBeDefined();
      }
    });
  });

  // ═══════════════════════════════════════
  // Scorecards
  // ═══════════════════════════════════════

  describe('GET /api/franchise/scorecards', () => {
    it('401 — no auth', async () => {
      await request(app.getHttpServer()).get('/api/franchise/scorecards').expect(401);
    });

    it('200 — returns scorecards with domains and tiers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/franchise/scorecards')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.branches).toBeInstanceOf(Array);
      for (const branch of res.body.branches) {
        expect(branch.domains).toBeInstanceOf(Array);
        expect(branch.domains.length).toBe(7);
        for (const d of branch.domains) {
          expect(d.domain).toBeDefined();
          expect(d.tier).toBeDefined();
          expect(['STRONG', 'WATCH', 'AT_RISK']).toContain(d.tier);
          expect(d.kpiValues).toBeDefined();
        }
      }
    });
  });

  // ═══════════════════════════════════════
  // Deep Rankings
  // ═══════════════════════════════════════

  describe('POST /api/franchise/rankings/generate-deep', () => {
    it('401 — no auth', async () => {
      await request(app.getHttpServer()).post('/api/franchise/rankings/generate-deep').expect(401);
    });

    it('200 — generates all 6 ranking types', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/franchise/rankings/generate-deep')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.rankings).toBeDefined();
      const types = Object.keys(res.body.rankings);
      expect(types).toContain('PRIME_COST');
      expect(types).toContain('WASTE_EFFICIENCY');
      expect(types).toContain('GROSS_MARGIN');
      expect(types).toContain('LABOR_EFFICIENCY');
      expect(res.body.totalRankings).toBeGreaterThanOrEqual(1);
    });

    it('200 — deterministic: same input gives same rankings', async () => {
      const query = {
        windowStart: '2026-01-01',
        windowEnd: '2026-01-31',
        windowType: 'MONTHLY',
      };
      const res1 = await request(app.getHttpServer())
        .post('/api/franchise/rankings/generate-deep')
        .query(query)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .post('/api/franchise/rankings/generate-deep')
        .query(query)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Same ranking order
      for (const type of Object.keys(res1.body.rankings)) {
        const r1 = res1.body.rankings[type];
        const r2 = res2.body.rankings[type];
        expect(r1.length).toBe(r2.length);
        for (let i = 0; i < r1.length; i++) {
          expect(r1[i].branchId).toBe(r2[i].branchId);
          expect(r1[i].rank).toBe(r2[i].rank);
        }
      }
    });
  });

  // ═══════════════════════════════════════
  // Drilldown
  // ═══════════════════════════════════════

  describe('GET /api/franchise/drilldown', () => {
    it('401 — no auth', async () => {
      await request(app.getHttpServer()).get('/api/franchise/drilldown').expect(401);
    });

    it('400 — missing branchId', async () => {
      await request(app.getHttpServer())
        .get('/api/franchise/drilldown')
        .query({ metricFamily: 'REVENUE' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });

    it('200 — revenue drilldown returns category + item breakdowns', async () => {
      const branch = await prisma.branch.findFirst({
        where: { organizationId: orgId, status: 'ACTIVE' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/franchise/drilldown')
        .query({ branchId: branch!.id, metricFamily: 'REVENUE' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.metricFamily).toBe('REVENUE');
      expect(res.body.drilldown).toBeDefined();
    });

    it('200 — COGS drilldown', async () => {
      const branch = await prisma.branch.findFirst({
        where: { organizationId: orgId, status: 'ACTIVE' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/franchise/drilldown')
        .query({ branchId: branch!.id, metricFamily: 'COGS' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.metricFamily).toBe('COGS');
      expect(res.body.drilldown).toBeDefined();
    });

    it('200 — PRIME_COST drilldown returns cogs + labor', async () => {
      const branch = await prisma.branch.findFirst({
        where: { organizationId: orgId, status: 'ACTIVE' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/franchise/drilldown')
        .query({ branchId: branch!.id, metricFamily: 'PRIME_COST' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.drilldown.cogs).toBeDefined();
      expect(res.body.drilldown.labor).toBeDefined();
    });
  });
});
