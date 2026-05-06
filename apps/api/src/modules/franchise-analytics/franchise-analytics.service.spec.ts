import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { FranchiseAnalyticsService } from './franchise-analytics.service';
import { AnalyticsWindowTypeDto, DeepRankingTypeDto, MetricFamilyDto } from './dto';

const ORG = 'org-1';
const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const USER = 'user-1';
const META = { ipAddress: '127.0.0.1', userAgent: 'jest' };

const BRANCHES = [
  { id: BRANCH_A, name: 'Main Branch', code: 'MAIN' },
  { id: BRANCH_B, name: 'Downtown Branch', code: 'DOWNTOWN' },
];

function makePrisma() {
  return {
    membership: {
      findFirst: jest.fn().mockResolvedValue({ organizationId: ORG, status: 'ACTIVE' }),
    },
    branch: {
      findFirst: jest.fn().mockResolvedValue(BRANCHES[0]),
      findMany: jest.fn().mockResolvedValue(BRANCHES),
    },
    order: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 450000 } }),
    },
    budgetLine: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { actualAmount: 12000, budgetAmount: 15000 },
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventoryItem: {
      count: jest.fn().mockResolvedValue(45),
    },
    procurementSuggestion: {
      count: jest.fn().mockResolvedValue(0),
    },
    demandCalendarEntry: {
      count: jest.fn().mockResolvedValue(2),
    },
    franchiseKpiSnapshot: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    franchiseConsolidationRun: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: 'run-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    branchPerformanceScorecard: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    wasteBenchmarkSnapshot: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    franchiseRanking: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest
      .fn()
      .mockResolvedValue([
        { total: '135000', total_waste: '1500', reason_breakdown: '[]', count: '0' },
      ]),
  } as any;
}

describe('FranchiseAnalyticsService', () => {
  let service: FranchiseAnalyticsService;
  let prisma: ReturnType<typeof makePrisma>;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FranchiseAnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<FranchiseAnalyticsService>(FranchiseAnalyticsService);
  });

  // ── resolveOrgContext ──

  describe('resolveOrgContext', () => {
    it('should resolve org from membership', async () => {
      const result = await service.resolveOrgContext(USER);
      expect(result.organizationId).toBe(ORG);
    });

    it('should throw ForbiddenException when no active membership', async () => {
      prisma.membership.findFirst.mockResolvedValue(null);
      await expect(service.resolveOrgContext(USER)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── getConsolidatedFinance ──

  describe('getConsolidatedFinance', () => {
    it('should return consolidated finance for all branches', async () => {
      // Raw query returns same for both branches
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total: '135000' }]) // COGS branch A
        .mockResolvedValueOnce([{ total: '45000' }]) // Labor branch A
        .mockResolvedValueOnce([{ total: '135000' }]) // COGS branch B
        .mockResolvedValueOnce([{ total: '45000' }]); // Labor branch B

      const result = await service.getConsolidatedFinance(ORG, {});

      expect(result.orgId).toBe(ORG);
      expect(result.branchCount).toBe(2);
      expect(result.consolidated).toBeDefined();
      expect(parseFloat(result.consolidated.revenue)).toBeGreaterThanOrEqual(0);
      expect(result.branches).toHaveLength(2);
      expect(result.calculationBasis).toBeDefined();
    });

    it('should default to MONTHLY window when no dates provided', async () => {
      prisma.$queryRaw.mockResolvedValue([{ total: '0' }]);
      const result = await service.getConsolidatedFinance(ORG, {});
      expect(result.windowType).toBe('MONTHLY');
    });

    it('should use provided window dates', async () => {
      prisma.$queryRaw.mockResolvedValue([{ total: '0' }]);
      const result = await service.getConsolidatedFinance(ORG, {
        windowStart: '2026-01-01',
        windowEnd: '2026-01-31',
        windowType: AnalyticsWindowTypeDto.MONTHLY,
      });
      expect(result.windowStart).toBeDefined();
      expect(result.windowEnd).toBeDefined();
    });

    it('should compute branch contributions that sum to ~100%', async () => {
      prisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { total: 600000 } }) // Branch A
        .mockResolvedValueOnce({ _sum: { total: 400000 } }); // Branch B
      prisma.$queryRaw.mockResolvedValue([{ total: '0' }]);

      const result = await service.getConsolidatedFinance(ORG, {});
      const totalContrib = result.branches.reduce(
        (s: number, b: any) => s + parseFloat(b.revenueContributionPct),
        0,
      );
      expect(totalContrib).toBeCloseTo(100, 1);
    });
  });

  // ── computeBranchFinancials ──

  describe('computeBranchFinancials', () => {
    it('should compute prime cost as cogs + labor', async () => {
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: 1000000 } });
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total: '300000' }]) // cogs
        .mockResolvedValueOnce([{ total: '150000' }]); // labor
      prisma.budgetLine.aggregate
        .mockResolvedValueOnce({ _sum: { actualAmount: 50000 } }) // overhead
        .mockResolvedValueOnce({ _sum: { budgetAmount: 500000, actualAmount: 480000 } }); // budget

      const result = await service.computeBranchFinancials(
        ORG,
        BRANCH_A,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.primeCost).toBe('450000.00');
      expect(result.primeCostPct).toBe('45.0000');
      expect(result.grossProfit).toBe('700000.00');
      expect(result.grossMarginPct).toBe('70.0000');
    });

    it('should handle zero revenue gracefully', async () => {
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: null } });
      prisma.$queryRaw.mockResolvedValue([{ total: '0' }]);
      prisma.budgetLine.aggregate.mockResolvedValue({
        _sum: { actualAmount: null, budgetAmount: null },
      });

      const result = await service.computeBranchFinancials(
        ORG,
        BRANCH_A,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.revenue).toBe('0.00');
      expect(result.grossMarginPct).toBe('0.0000');
      expect(result.primeCostPct).toBe('0.0000');
    });
  });

  // ── getFinancialComparison ──

  describe('getFinancialComparison', () => {
    it('should return portfolio averages and best/worst', async () => {
      prisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { total: 600000 } })
        .mockResolvedValueOnce({ _sum: { total: 400000 } });
      prisma.$queryRaw.mockResolvedValue([{ total: '0' }]);
      prisma.budgetLine.aggregate.mockResolvedValue({
        _sum: { actualAmount: 0, budgetAmount: 0 },
      });

      const result = await service.getFinancialComparison(ORG, {});

      expect(result.portfolioAverage).toBeDefined();
      expect(result.bestBranch).toBeDefined();
      expect(result.worstBranch).toBeDefined();
      expect(result.branches).toHaveLength(2);
      // vsPortfolio should exist on each branch
      for (const b of result.branches) {
        expect(b.vsPortfolio).toBeDefined();
      }
    });
  });

  // ── getWasteBenchmarks ──

  describe('getWasteBenchmarks', () => {
    it('should return waste benchmarks ranked by waste efficiency', async () => {
      // Set up distinct waste results per branch
      prisma.$queryRaw
        // Branch A: waste
        .mockResolvedValueOnce([{ total_waste: '1500', reason_breakdown: '[]' }])
        // Branch A: waste reasons
        .mockResolvedValueOnce([])
        // Branch A: wasted items
        .mockResolvedValueOnce([])
        // Branch A: cogs
        .mockResolvedValueOnce([{ total: '135000' }])
        // Branch A: theoretical cogs
        .mockResolvedValueOnce([{ total: '130000' }])
        // Branch B: waste
        .mockResolvedValueOnce([{ total_waste: '5000', reason_breakdown: '[]' }])
        // Branch B: waste reasons
        .mockResolvedValueOnce([])
        // Branch B: wasted items
        .mockResolvedValueOnce([])
        // Branch B: cogs
        .mockResolvedValueOnce([{ total: '100000' }])
        // Branch B: theoretical cogs
        .mockResolvedValueOnce([{ total: '95000' }]);

      const result = await service.getWasteBenchmarks(ORG, {});

      expect(result.branchCount).toBe(2);
      expect(result.portfolioAverage).toBeDefined();
      expect(result.branches).toHaveLength(2);
      // Rank 1 should have lower waste%
      expect(result.branches[0].rank).toBe(1);
      expect(result.calculationBasis).toBeDefined();
    });

    it('should filter by branchId when provided', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { total_waste: '0', total: '0', reason_breakdown: '[]' },
      ]);

      const result = await service.getWasteBenchmarks(ORG, { branchId: BRANCH_A });

      expect(result.branches.length).toBeLessThanOrEqual(1);
    });
  });

  // ── getScorecards ──

  describe('getScorecards', () => {
    it('should return scorecards with 7 domains per branch', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { total: '0', total_waste: '0', reason_breakdown: '[]', count: '0' },
      ]);

      const result = await service.getScorecards(ORG, {});

      expect(result.branchCount).toBe(2);
      expect(result.branches).toHaveLength(2);
      for (const b of result.branches) {
        expect(b.domains).toHaveLength(7);
        const domainNames = b.domains.map((d: any) => d.domain);
        expect(domainNames).toContain('FINANCIAL');
        expect(domainNames).toContain('PRIME_COST');
        expect(domainNames).toContain('WASTE_VARIANCE');
        expect(domainNames).toContain('STOCK_HEALTH');
        expect(domainNames).toContain('PROCUREMENT_READINESS');
        expect(domainNames).toContain('DEMAND_READINESS');
        expect(domainNames).toContain('OPERATIONAL_RISK');
      }
    });

    it('should assign deterministic tiers', async () => {
      // Revenue = 1M, COGS = 200K → margin 80% → STRONG
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: 1000000 } });
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total: '200000' }]) // cogs
        .mockResolvedValueOnce([{ total: '100000' }]) // labor
        // waste
        .mockResolvedValueOnce([{ total_waste: '1000', reason_breakdown: '[]' }])
        .mockResolvedValueOnce([]) // waste reasons
        .mockResolvedValueOnce([]) // wasted items
        .mockResolvedValueOnce([{ total: '200000' }]) // waste cogs
        .mockResolvedValueOnce([{ total: '195000' }]) // theoretical cogs
        // stock health
        .mockResolvedValueOnce([{ count: '0' }]);

      prisma.budgetLine.aggregate.mockResolvedValue({
        _sum: { actualAmount: 0, budgetAmount: 0 },
      });
      prisma.branch.findMany.mockResolvedValue([BRANCHES[0]]);

      const result = await service.getScorecards(ORG, { branchId: BRANCH_A });

      const financial = result.branches[0].domains.find((d: any) => d.domain === 'FINANCIAL');
      expect(financial!.tier).toBe('STRONG');
    });
  });

  // ── generateDeepRankings ──

  describe('generateDeepRankings', () => {
    it('should generate 6 ranking sets', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { total: '0', total_waste: '0', reason_breakdown: '[]' },
      ]);
      prisma.budgetLine.aggregate.mockResolvedValue({
        _sum: { actualAmount: 0, budgetAmount: 0 },
      });

      const result = await service.generateDeepRankings(USER, ORG, {}, META);

      expect(result.rankings).toBeDefined();
      const types = Object.keys(result.rankings);
      expect(types).toContain('PRIME_COST');
      expect(types).toContain('WASTE_EFFICIENCY');
      expect(types).toContain('THEORETICAL_VARIANCE');
      expect(types).toContain('GROSS_MARGIN');
      expect(types).toContain('LABOR_EFFICIENCY');
      expect(types).toContain('OVERALL_FINANCIAL_DISCIPLINE');
      expect(result.totalRankings).toBe(12); // 6 types × 2 branches
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FRANCHISE_DEEP_RANKINGS_GENERATED' }),
      );
    });

    it('should filter by rankingType when provided', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { total: '0', total_waste: '0', reason_breakdown: '[]' },
      ]);
      prisma.budgetLine.aggregate.mockResolvedValue({
        _sum: { actualAmount: 0, budgetAmount: 0 },
      });

      const result = await service.generateDeepRankings(
        USER,
        ORG,
        { rankingType: DeepRankingTypeDto.PRIME_COST },
        META,
      );

      expect(Object.keys(result.rankings)).toEqual(['PRIME_COST']);
      expect(result.totalRankings).toBe(2);
    });

    it('should return empty when no branches', async () => {
      prisma.branch.findMany.mockResolvedValue([]);
      const result = await service.generateDeepRankings(USER, ORG, {}, META);
      expect(result.totalRankings).toBe(0);
    });
  });

  // ── getDrilldown ──

  describe('getDrilldown', () => {
    it('should return revenue drilldown with category and top items', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { category_name: 'Main Courses', total: '200000', order_count: '150' },
          { category_name: 'Beverages', total: '80000', order_count: '300' },
        ])
        .mockResolvedValueOnce([{ item_name: 'Burger', total: '50000', qty: '100' }]);

      const result = await service.getDrilldown(ORG, {
        branchId: BRANCH_A,
        metricFamily: MetricFamilyDto.REVENUE,
      });

      expect(result.drilldown.byCategory).toHaveLength(2);
      expect(result.drilldown.topItems).toHaveLength(1);
      expect(result.metricFamily).toBe('REVENUE');
    });

    it('should throw BadRequestException without branchId', async () => {
      await expect(
        service.getDrilldown(ORG, { metricFamily: MetricFamilyDto.REVENUE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException without metricFamily', async () => {
      await expect(service.getDrilldown(ORG, { branchId: BRANCH_A })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when branch not found', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);
      await expect(
        service.getDrilldown(ORG, {
          branchId: 'nonexistent',
          metricFamily: MetricFamilyDto.REVENUE,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── generateConsolidatedSnapshot ──

  describe('generateConsolidatedSnapshot', () => {
    it('should create run, persist KPI snapshots, and audit', async () => {
      prisma.$queryRaw.mockResolvedValue([{ total: '0' }]);
      prisma.budgetLine.aggregate.mockResolvedValue({
        _sum: { actualAmount: 0, budgetAmount: 0 },
      });

      const result = await service.generateConsolidatedSnapshot(USER, ORG, {}, META);

      expect(result.runId).toBe('run-1');
      expect(result.status).toBe('COMPLETED');
      expect(prisma.franchiseConsolidationRun.upsert).toHaveBeenCalled();
      expect(prisma.franchiseKpiSnapshot.upsert).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FRANCHISE_CONSOLIDATION_GENERATED' }),
      );
    });

    it('should mark run as FAILED on error', async () => {
      // The error must happen inside the try block (after run creation)
      // branch.findMany succeeds for the initial run creation but
      // order.aggregate fails during getConsolidatedFinance
      prisma.franchiseConsolidationRun.upsert.mockResolvedValue({ id: 'run-2' });
      prisma.order.aggregate.mockRejectedValue(new Error('DB down'));

      await expect(service.generateConsolidatedSnapshot(USER, ORG, {}, META)).rejects.toThrow(
        'DB down',
      );

      expect(prisma.franchiseConsolidationRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  // ── Tiering determinism ──

  describe('tiering', () => {
    it('should tier based on deterministic thresholds', () => {
      // Access private methods via prototype
      const svc = service as any;
      expect(svc.tierFromMargin(70)).toBe('STRONG');
      expect(svc.tierFromMargin(55)).toBe('WATCH');
      expect(svc.tierFromMargin(40)).toBe('AT_RISK');
      expect(svc.tierFromPrimeCost(50)).toBe('STRONG');
      expect(svc.tierFromPrimeCost(60)).toBe('WATCH');
      expect(svc.tierFromPrimeCost(70)).toBe('AT_RISK');
      expect(svc.tierFromWaste(1)).toBe('STRONG');
      expect(svc.tierFromWaste(3)).toBe('WATCH');
      expect(svc.tierFromWaste(8)).toBe('AT_RISK');
    });
  });
});
