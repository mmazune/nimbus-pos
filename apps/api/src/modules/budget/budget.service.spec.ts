import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BudgetService } from './budget.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { BudgetTypeDto } from './dto';

const ORG = 'org-1';
const BRANCH = 'branch-1';
const USER = 'user-1';
const META = { ipAddress: '127.0.0.1', userAgent: 'jest' };
const CTX = { organizationId: ORG, branchId: BRANCH };

const mockBudget = {
  id: 'bud-1',
  orgId: ORG,
  branchId: BRANCH,
  fiscalPeriodId: null,
  name: 'Q1 2026 Operations',
  budgetType: 'OPERATIONAL' as const,
  status: 'DRAFT' as const,
  version: 1,
  periodStart: new Date('2026-01-01'),
  periodEnd: new Date('2026-03-31'),
  totalBudget: new Prisma.Decimal('500000'),
  notes: null,
  metadata: null,
  createdById: USER,
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBudgetLine = {
  id: 'bl-1',
  budgetId: 'bud-1',
  accountId: 'acc-1',
  costCenterId: null,
  category: 'Food Cost',
  dimension: null,
  budgetAmount: new Prisma.Decimal('200000'),
  actualAmount: new Prisma.Decimal('0'),
  varianceAmount: new Prisma.Decimal('200000'),
  variancePct: new Prisma.Decimal('0'),
  actualsUpdatedAt: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProcSuggestion = {
  id: 'ps-1',
  orgId: ORG,
  branchId: BRANCH,
  forecastRunId: null,
  inventoryItemId: 'inv-1',
  supplierId: null,
  status: 'PENDING' as const,
  urgency: 'ORDER_NEXT_PO',
  daypart: null,
  suggestedQty: new Prisma.Decimal('100'),
  projectedUsage: new Prisma.Decimal('80'),
  currentStock: new Prisma.Decimal('20'),
  inboundStock: 0,
  safetyStock: new Prisma.Decimal('30'),
  leadTimeDays: 1,
  suggestedAction: 'Add 100 units of Chicken Breast to next purchase order',
  estimatedUnitCost: new Prisma.Decimal('2.5'),
  estimatedTotalCost: new Prisma.Decimal('250'),
  priority: 4,
  rationale: 'Stock at reorder level',
  demandCalendarEntryId: null,
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePrisma() {
  return {
    budget: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    budgetLine: {
      createMany: jest.fn(),
      update: jest.fn(),
    },
    fiscalPeriod: {
      findFirst: jest.fn(),
    },
    journalLine: {
      groupBy: jest.fn(),
    },
    procurementSuggestion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: any) => Promise<any>) =>
      fn({
        budget: { create: jest.fn().mockResolvedValue(mockBudget) },
        budgetLine: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      }),
    ),
  };
}

describe('BudgetService', () => {
  let service: BudgetService;
  let prisma: ReturnType<typeof makePrisma>;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
  });

  // ── listBudgets ──

  describe('listBudgets', () => {
    it('returns all budgets for branch', async () => {
      prisma.budget.findMany.mockResolvedValue([mockBudget]);
      const result = await service.listBudgets(CTX, {});
      expect(result).toEqual([mockBudget]);
      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: ORG, branchId: BRANCH },
        }),
      );
    });

    it('filters by status', async () => {
      prisma.budget.findMany.mockResolvedValue([mockBudget]);
      await service.listBudgets(CTX, { status: 'DRAFT' } as any);
      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });

    it('filters by fiscalPeriodId', async () => {
      prisma.budget.findMany.mockResolvedValue([]);
      await service.listBudgets(CTX, { fiscalPeriodId: 'fp-1' } as any);
      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ fiscalPeriodId: 'fp-1' }),
        }),
      );
    });
  });

  // ── getBudget ──

  describe('getBudget', () => {
    it('returns a budget by id', async () => {
      prisma.budget.findFirst.mockResolvedValue({ ...mockBudget, lines: [mockBudgetLine] });
      const result = await service.getBudget(CTX, 'bud-1');
      expect(result).toBeDefined();
      expect(prisma.budget.findFirst).toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown id', async () => {
      prisma.budget.findFirst.mockResolvedValue(null);
      await expect(service.getBudget(CTX, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── createBudget ──

  describe('createBudget', () => {
    const dto = {
      name: 'Q1 Budget',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      budgetType: BudgetTypeDto.OPERATIONAL,
      lines: [{ category: 'Food Cost', budgetAmount: 200000 }],
    };

    it('creates budget with lines via transaction', async () => {
      prisma.budget.findFirst.mockResolvedValueOnce(null); // uniqueness check
      prisma.budget.findFirst.mockResolvedValueOnce({ ...mockBudget, lines: [] }); // getBudget
      await service.createBudget(USER, CTX, dto, META);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'BUDGET_CREATED' }));
    });

    it('throws ConflictException if budget already exists', async () => {
      prisma.budget.findFirst.mockResolvedValueOnce(mockBudget); // uniqueness check finds existing
      await expect(service.createBudget(USER, CTX, dto, META)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for unknown fiscalPeriodId', async () => {
      prisma.budget.findFirst.mockResolvedValueOnce(null); // uniqueness check
      prisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      await expect(
        service.createBudget(USER, CTX, { ...dto, fiscalPeriodId: 'fp-unknown' }, META),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates period with known fiscalPeriodId', async () => {
      prisma.budget.findFirst.mockResolvedValueOnce(null); // uniqueness check
      prisma.fiscalPeriod.findFirst.mockResolvedValue({ id: 'fp-1', orgId: ORG });
      prisma.budget.findFirst.mockResolvedValueOnce({ ...mockBudget, lines: [] }); // getBudget
      await service.createBudget(USER, CTX, { ...dto, fiscalPeriodId: 'fp-1' }, META);
      expect(prisma.fiscalPeriod.findFirst).toHaveBeenCalled();
    });
  });

  // ── updateActuals ──

  describe('updateActuals', () => {
    it('throws NotFoundException for unknown budget', async () => {
      prisma.budget.findFirst.mockResolvedValue(null);
      await expect(service.updateActuals(USER, CTX, 'bad-id', {}, META)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for ARCHIVED budget', async () => {
      prisma.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        status: 'ARCHIVED',
        lines: [],
      });
      await expect(service.updateActuals(USER, CTX, 'bud-1', {}, META)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('pulls actuals from GL and updates lines', async () => {
      prisma.budget.findFirst
        .mockResolvedValueOnce({ ...mockBudget, lines: [mockBudgetLine] })
        .mockResolvedValueOnce({ ...mockBudget, lines: [mockBudgetLine] });
      prisma.journalLine.groupBy.mockResolvedValue([
        { accountId: 'acc-1', _sum: { amount: new Prisma.Decimal('150000') } },
      ]);
      prisma.budgetLine.update.mockResolvedValue({
        ...mockBudgetLine,
        actualAmount: new Prisma.Decimal('150000'),
        varianceAmount: new Prisma.Decimal('50000'),
      });
      prisma.budget.update.mockResolvedValue(mockBudget);

      await service.updateActuals(USER, CTX, 'bud-1', {}, META);

      expect(prisma.journalLine.groupBy).toHaveBeenCalled();
      expect(prisma.budgetLine.update).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BUDGET_ACTUALS_REFRESHED' }),
      );
    });

    it('skips GL query for lines with no accountId', async () => {
      const lineNoAccount = { ...mockBudgetLine, accountId: null };
      prisma.budget.findFirst
        .mockResolvedValueOnce({ ...mockBudget, lines: [lineNoAccount] })
        .mockResolvedValueOnce({ ...mockBudget, lines: [lineNoAccount] });
      prisma.budgetLine.update.mockResolvedValue(lineNoAccount);
      prisma.budget.update.mockResolvedValue(mockBudget);

      await service.updateActuals(USER, CTX, 'bud-1', {}, META);
      expect(prisma.journalLine.groupBy).not.toHaveBeenCalled();
    });
  });

  // ── listProcurementSuggestions ──

  describe('listProcurementSuggestions', () => {
    it('returns all suggestions when no filters provided', async () => {
      prisma.procurementSuggestion.findMany.mockResolvedValue([mockProcSuggestion]);
      const result = await service.listProcurementSuggestions(CTX);
      expect(result).toEqual([mockProcSuggestion]);
      expect(prisma.procurementSuggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: CTX.organizationId, branchId: CTX.branchId },
        }),
      );
    });

    it('filters by urgency when provided', async () => {
      prisma.procurementSuggestion.findMany.mockResolvedValue([mockProcSuggestion]);
      await service.listProcurementSuggestions(CTX, 'URGENT_LOCAL_BUY');
      expect(prisma.procurementSuggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ urgency: 'URGENT_LOCAL_BUY' }),
        }),
      );
    });

    it('includes demandCalendarEntry in result', async () => {
      prisma.procurementSuggestion.findMany.mockResolvedValue([mockProcSuggestion]);
      await service.listProcurementSuggestions(CTX);
      expect(prisma.procurementSuggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            demandCalendarEntry: expect.any(Object),
          }),
        }),
      );
    });
  });

  // ── reviewProcurementSuggestion ──

  describe('reviewProcurementSuggestion', () => {
    it('reviews a PENDING suggestion', async () => {
      prisma.procurementSuggestion.findFirst.mockResolvedValue(mockProcSuggestion);
      prisma.procurementSuggestion.update.mockResolvedValue({
        ...mockProcSuggestion,
        status: 'DISMISSED',
      });

      await service.reviewProcurementSuggestion(USER, CTX, 'ps-1', 'DISMISSED', 'Not needed', META);
      expect(prisma.procurementSuggestion.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DISMISSED' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PROCUREMENT_SUGGESTION_REVIEWED' }),
      );
    });

    it('throws NotFoundException for unknown suggestion', async () => {
      prisma.procurementSuggestion.findFirst.mockResolvedValue(null);
      await expect(
        service.reviewProcurementSuggestion(USER, CTX, 'bad-id', 'DISMISSED', undefined, META),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if suggestion is not PENDING', async () => {
      prisma.procurementSuggestion.findFirst.mockResolvedValue({
        ...mockProcSuggestion,
        status: 'DISMISSED',
      });
      await expect(
        service.reviewProcurementSuggestion(USER, CTX, 'ps-1', 'ACTIONED', undefined, META),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
