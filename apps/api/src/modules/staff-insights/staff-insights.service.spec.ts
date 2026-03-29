import { Test, TestingModule } from '@nestjs/testing';
import { StaffInsightsService } from './staff-insights.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('StaffInsightsService', () => {
  let service: StaffInsightsService;
  let prisma: any;
  let audit: any;

  const ctx = { branchId: 'branch-1', organizationId: 'org-1' };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  const mockEmployee = {
    id: 'emp-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    userId: 'user-emp-1',
    firstName: 'Alice',
    lastName: 'Nakamya',
    employeeCode: 'EMP-00001',
    status: 'ACTIVE',
    positionId: 'pos-1',
  };

  const mockSnapshot = {
    id: 'snap-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    employeeId: 'emp-1',
    periodStart: new Date('2025-03-01'),
    periodEnd: new Date('2025-03-31'),
    salesScore: { toString: () => '80.00' },
    reliabilityScore: { toString: () => '90.00' },
    attendanceScore: { toString: () => '85.00' },
    wastageScore: { toString: () => '70.00' },
    riskPenalty: { toString: () => '5.00' },
    compositeScore: { toString: () => '82.50' },
    weights: {
      salesWeight: 25,
      reliabilityWeight: 25,
      attendanceWeight: 25,
      wastageWeight: 15,
      riskPenaltyWeight: 10,
    },
    sourceSummary: {},
    status: 'ACTIVE',
    generatedById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAward = {
    id: 'award-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    employeeId: 'emp-1',
    awardType: 'EMPLOYEE_OF_MONTH',
    periodStart: new Date('2025-03-01'),
    periodEnd: new Date('2025-03-31'),
    title: 'Top Performer',
    reason: 'Excellent scores',
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSuggestion = {
    id: 'promo-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    employeeId: 'emp-1',
    currentPositionId: 'pos-1',
    suggestedPositionId: 'pos-2',
    periodStart: new Date('2025-03-01'),
    periodEnd: new Date('2025-03-31'),
    status: 'PENDING',
    rationale: { compositeScore: 85 },
    generatedById: 'user-1',
    decidedById: null,
    decidedAt: null,
    decisionNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      orgSettings: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      staffInsightSnapshot: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      staffAward: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      promotionSuggestion: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
      },
      attendanceRecord: {
        findMany: jest.fn(),
      },
      scheduleAssignment: {
        count: jest.fn(),
      },
      anomalyEvent: {
        count: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffInsightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<StaffInsightsService>(StaffInsightsService);
  });

  // ── Weights ──

  describe('getWeights', () => {
    it('should return default weights when no org settings', async () => {
      prisma.orgSettings.findUnique.mockResolvedValue(null);

      const result = await service.getWeights(ctx);
      expect(result).toEqual({
        salesWeight: 25,
        reliabilityWeight: 25,
        attendanceWeight: 25,
        wastageWeight: 15,
        riskPenaltyWeight: 10,
      });
    });

    it('should return stored weights when present', async () => {
      const custom = {
        salesWeight: 30,
        reliabilityWeight: 30,
        attendanceWeight: 20,
        wastageWeight: 10,
        riskPenaltyWeight: 10,
      };
      prisma.orgSettings.findUnique.mockResolvedValue({
        franchiseWeights: { staffInsightWeights: custom },
      });

      const result = await service.getWeights(ctx);
      expect(result).toEqual(custom);
    });
  });

  describe('updateWeights', () => {
    it('should update weights and log audit', async () => {
      prisma.orgSettings.findUnique.mockResolvedValue({
        franchiseWeights: {},
      });
      prisma.orgSettings.update.mockResolvedValue({});

      const result = await service.updateWeights('user-1', ctx, { salesWeight: 40 }, meta);
      expect(result.salesWeight).toBe(40);
      expect(prisma.orgSettings.update).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STAFF_INSIGHT_WEIGHTS_UPDATED' }),
      );
    });
  });

  // ── Staff Insights ──

  describe('listInsights', () => {
    it('should return paginated insights', async () => {
      prisma.staffInsightSnapshot.findMany.mockResolvedValue([mockSnapshot]);
      prisma.staffInsightSnapshot.count.mockResolvedValue(1);

      const result = await service.listInsights(ctx, {});
      expect(result).toEqual({ data: [mockSnapshot], total: 1 });
    });

    it('should filter by employeeId', async () => {
      prisma.staffInsightSnapshot.findMany.mockResolvedValue([]);
      prisma.staffInsightSnapshot.count.mockResolvedValue(0);

      await service.listInsights(ctx, { employeeId: 'emp-99' });
      expect(prisma.staffInsightSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ employeeId: 'emp-99' }) }),
      );
    });
  });

  describe('getInsightByEmployee', () => {
    it('should return insights for an employee', async () => {
      prisma.staffInsightSnapshot.findMany.mockResolvedValue([mockSnapshot]);

      const result = await service.getInsightByEmployee(ctx, 'emp-1');
      expect(result).toEqual([mockSnapshot]);
    });

    it('should throw NotFoundException when no insights', async () => {
      prisma.staffInsightSnapshot.findMany.mockResolvedValue([]);

      await expect(service.getInsightByEmployee(ctx, 'emp-99')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateInsights', () => {
    it('should throw BadRequestException when no active employees', async () => {
      prisma.orgSettings.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([]);

      await expect(
        service.generateInsights(
          'user-1',
          ctx,
          new Date('2025-03-01'),
          new Date('2025-03-31'),
          undefined,
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip existing snapshots for same period', async () => {
      prisma.orgSettings.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([mockEmployee]);
      prisma.staffInsightSnapshot.findUnique.mockResolvedValue(mockSnapshot);

      const result = await service.generateInsights(
        'user-1',
        ctx,
        new Date('2025-03-01'),
        new Date('2025-03-31'),
        undefined,
        meta,
      );

      expect(result).toEqual([mockSnapshot]);
      expect(prisma.staffInsightSnapshot.create).not.toHaveBeenCalled();
    });

    it('should generate new snapshot with scores', async () => {
      prisma.orgSettings.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([mockEmployee]);
      prisma.staffInsightSnapshot.findUnique.mockResolvedValue(null);
      prisma.employee.findUnique.mockResolvedValue({ userId: 'user-emp-1' });
      prisma.order.findMany.mockResolvedValue([{ totalAmount: '100000' }]);
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { status: 'PRESENT', lateMinutes: 0 },
        { status: 'LATE', lateMinutes: 15 },
      ]);
      prisma.scheduleAssignment.count.mockResolvedValue(5);
      prisma.anomalyEvent.count.mockResolvedValue(0);
      prisma.staffInsightSnapshot.create.mockResolvedValue(mockSnapshot);

      const result = await service.generateInsights(
        'user-1',
        ctx,
        new Date('2025-03-01'),
        new Date('2025-03-31'),
        undefined,
        meta,
      );

      expect(result).toHaveLength(1);
      expect(prisma.staffInsightSnapshot.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STAFF_INSIGHT_SNAPSHOT_GENERATED' }),
      );
    });
  });

  // ── Awards ──

  describe('createAward', () => {
    it('should create an award', async () => {
      prisma.employee.findFirst.mockResolvedValue(mockEmployee);
      prisma.anomalyEvent.count.mockResolvedValue(0);
      prisma.staffAward.create.mockResolvedValue(mockAward);

      const result = await service.createAward(
        'user-1',
        ctx,
        {
          employeeId: 'emp-1',
          awardType: 'EMPLOYEE_OF_MONTH' as any,
          periodStart: '2025-03-01',
          periodEnd: '2025-03-31',
          title: 'Top Performer',
        },
        meta,
      );

      expect(result).toEqual(mockAward);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STAFF_AWARD_CREATED' }),
      );
    });

    it('should reject unknown employee', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.createAward(
          'user-1',
          ctx,
          {
            employeeId: 'emp-999',
            awardType: 'EMPLOYEE_OF_MONTH' as any,
            periodStart: '2025-03-01',
            periodEnd: '2025-03-31',
            title: 'Top Performer',
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should block award when employee has critical risk flags', async () => {
      prisma.employee.findFirst.mockResolvedValue(mockEmployee);
      prisma.anomalyEvent.count.mockResolvedValue(2);

      await expect(
        service.createAward(
          'user-1',
          ctx,
          {
            employeeId: 'emp-1',
            awardType: 'EMPLOYEE_OF_MONTH' as any,
            periodStart: '2025-03-01',
            periodEnd: '2025-03-31',
            title: 'Top Performer',
          },
          meta,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listAwards', () => {
    it('should return paginated awards', async () => {
      prisma.staffAward.findMany.mockResolvedValue([mockAward]);
      prisma.staffAward.count.mockResolvedValue(1);

      const result = await service.listAwards(ctx);
      expect(result).toEqual({ data: [mockAward], total: 1 });
    });
  });

  // ── Promotion Suggestions ──

  describe('generatePromotionSuggestions', () => {
    it('should reject when no insights exist', async () => {
      prisma.staffInsightSnapshot.findMany.mockResolvedValue([]);

      await expect(
        service.generatePromotionSuggestions(
          'user-1',
          ctx,
          { periodStart: '2025-03-01', periodEnd: '2025-03-31' },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate suggestions for top performers', async () => {
      const highScoreSnapshot = {
        ...mockSnapshot,
        compositeScore: { toString: () => '85.00' },
        employee: { id: 'emp-1', positionId: 'pos-1' },
      };
      prisma.staffInsightSnapshot.findMany.mockResolvedValue([highScoreSnapshot]);
      prisma.promotionSuggestion.findFirst.mockResolvedValue(null);
      prisma.promotionSuggestion.create.mockResolvedValue(mockSuggestion);

      const result = await service.generatePromotionSuggestions(
        'user-1',
        ctx,
        { periodStart: '2025-03-01', periodEnd: '2025-03-31' },
        meta,
      );

      expect(result).toHaveLength(1);
      expect(prisma.promotionSuggestion.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PROMOTION_SUGGESTION_GENERATED' }),
      );
    });
  });

  describe('listPromotionSuggestions', () => {
    it('should return paginated suggestions', async () => {
      prisma.promotionSuggestion.findMany.mockResolvedValue([mockSuggestion]);
      prisma.promotionSuggestion.count.mockResolvedValue(1);

      const result = await service.listPromotionSuggestions(ctx);
      expect(result).toEqual({ data: [mockSuggestion], total: 1 });
    });
  });

  describe('decidePromotionSuggestion', () => {
    it('should accept a pending suggestion', async () => {
      prisma.promotionSuggestion.findFirst.mockResolvedValue(mockSuggestion);
      prisma.promotionSuggestion.update.mockResolvedValue({
        ...mockSuggestion,
        status: 'ACCEPTED',
        decidedById: 'user-1',
        decidedAt: new Date(),
      });

      const result = await service.decidePromotionSuggestion(
        'user-1',
        ctx,
        'promo-1',
        { decision: 'ACCEPTED' as any },
        meta,
      );

      expect(result.status).toBe('ACCEPTED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PROMOTION_SUGGESTION_DECIDED' }),
      );
    });

    it('should reject non-existent suggestion', async () => {
      prisma.promotionSuggestion.findFirst.mockResolvedValue(null);

      await expect(
        service.decidePromotionSuggestion(
          'user-1',
          ctx,
          'promo-999',
          { decision: 'ACCEPTED' as any },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject deciding an already decided suggestion', async () => {
      prisma.promotionSuggestion.findFirst.mockResolvedValue({
        ...mockSuggestion,
        status: 'ACCEPTED',
      });

      await expect(
        service.decidePromotionSuggestion(
          'user-1',
          ctx,
          'promo-1',
          { decision: 'REJECTED' as any },
          meta,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
