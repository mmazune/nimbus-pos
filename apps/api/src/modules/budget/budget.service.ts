import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { CreateBudgetDto, ListBudgetsQueryDto, UpdateActualsDto } from './dto';

interface BranchContext {
  organizationId: string;
  branchId: string;
}

interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Budgets ──

  async listBudgets(ctx: BranchContext, query: ListBudgetsQueryDto) {
    const where: Record<string, unknown> = {
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
    };
    if (query.status) where['status'] = query.status;
    if (query.budgetType) where['budgetType'] = query.budgetType;
    if (query.fiscalPeriodId) where['fiscalPeriodId'] = query.fiscalPeriodId;
    if (query.periodStart) where['periodStart'] = { gte: new Date(query.periodStart) };
    if (query.periodEnd) where['periodEnd'] = { lte: new Date(query.periodEnd) };

    return this.prisma.budget.findMany({
      where,
      include: {
        fiscalPeriod: { select: { id: true, name: true, startsAt: true, endsAt: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        lines: true,
      },
      orderBy: [{ periodStart: 'desc' }, { version: 'desc' }],
    });
  }

  async getBudget(ctx: BranchContext, budgetId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, orgId: ctx.organizationId, branchId: ctx.branchId },
      include: {
        fiscalPeriod: { select: { id: true, name: true, startsAt: true, endsAt: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          include: {
            account: { select: { id: true, name: true, code: true, accountType: true } },
            costCenter: { select: { id: true, name: true, code: true } },
          },
          orderBy: { category: 'asc' },
        },
      },
    });
    if (!budget) throw new NotFoundException(`Budget "${budgetId}" not found`);
    return budget;
  }

  async createBudget(userId: string, ctx: BranchContext, dto: CreateBudgetDto, meta: AuditMeta) {
    const budgetType = dto.budgetType ?? 'OPERATIONAL';
    const version = dto.version ?? 1;

    // Enforce uniqueness: one budget per org+branch+fiscalPeriod+type+version
    const existing = await this.prisma.budget.findFirst({
      where: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        fiscalPeriodId: dto.fiscalPeriodId ?? null,
        budgetType,
        version,
      },
    });
    if (existing) {
      throw new ConflictException(
        `A ${budgetType} budget v${version} already exists for this branch and period`,
      );
    }

    // Validate fiscal period belongs to org
    if (dto.fiscalPeriodId) {
      const period = await this.prisma.fiscalPeriod.findFirst({
        where: { id: dto.fiscalPeriodId, orgId: ctx.organizationId },
      });
      if (!period) {
        throw new BadRequestException(`Fiscal period "${dto.fiscalPeriodId}" not found in org`);
      }
    }

    const totalBudget = dto.lines.reduce((sum, l) => sum + (l.budgetAmount ?? 0), 0);

    const budget = await this.prisma.$transaction(async (tx) => {
      const b = await tx.budget.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          fiscalPeriodId: dto.fiscalPeriodId ?? null,
          name: dto.name,
          budgetType,
          version,
          periodStart: new Date(dto.periodStart),
          periodEnd: new Date(dto.periodEnd),
          totalBudget,
          notes: dto.notes,
          createdById: userId,
        },
      });

      if (dto.lines.length > 0) {
        await tx.budgetLine.createMany({
          data: dto.lines.map((l) => ({
            budgetId: b.id,
            accountId: l.accountId ?? null,
            costCenterId: l.costCenterId ?? null,
            category: l.category,
            dimension: l.dimension ?? null,
            budgetAmount: l.budgetAmount,
            actualAmount: 0,
            varianceAmount: l.budgetAmount,
            variancePct: 0,
          })),
        });
      }

      return b;
    });

    await this.audit.log({
      action: 'BUDGET_CREATED',
      actorUserId: userId,
      entityType: 'Budget',
      entityId: budget.id,
      metadata: {
        name: dto.name,
        budgetType,
        version,
        totalBudget,
        linesCount: dto.lines.length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getBudget(ctx, budget.id);
  }

  // ── Actuals Refresh ──

  /**
   * Pulls journal-line actuals from the GL for each BudgetLine that has an accountId,
   * then recomputes variance. Source: JournalEntry + JournalLine within the budget period.
   */
  async updateActuals(
    userId: string,
    ctx: BranchContext,
    budgetId: string,
    dto: UpdateActualsDto,
    meta: AuditMeta,
  ) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, orgId: ctx.organizationId, branchId: ctx.branchId },
      include: { lines: true },
    });
    if (!budget) throw new NotFoundException(`Budget "${budgetId}" not found`);
    if (budget.status === 'ARCHIVED') {
      throw new BadRequestException('Cannot refresh actuals on an ARCHIVED budget');
    }

    const windowStart = dto.windowStart ? new Date(dto.windowStart) : budget.periodStart;
    const windowEnd = dto.windowEnd
      ? new Date(dto.windowEnd)
      : new Date(Math.min(budget.periodEnd.getTime(), Date.now()));

    // Fetch journal lines aggregated by account
    const accountIds = budget.lines.filter((l) => l.accountId).map((l) => l.accountId as string);

    const actualsByAccount = new Map<string, number>();

    if (accountIds.length > 0) {
      const rows = await this.prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          accountId: { in: accountIds },
          journalEntry: {
            orgId: ctx.organizationId,
            status: 'POSTED',
            journalDate: { gte: windowStart, lte: windowEnd },
          },
        },
        _sum: { amount: true },
      });

      for (const row of rows) {
        const sum = row._sum.amount ? Number(row._sum.amount) : 0;
        actualsByAccount.set(row.accountId, sum);
      }
    }

    const now = new Date();
    const updates = budget.lines.map(async (line) => {
      const actual = line.accountId ? (actualsByAccount.get(line.accountId) ?? 0) : 0;
      const budgetAmt = Number(line.budgetAmount);
      const varianceAmount = budgetAmt - actual;
      const variancePct = budgetAmt !== 0 ? (varianceAmount / budgetAmt) * 100 : 0;

      return this.prisma.budgetLine.update({
        where: { id: line.id },
        data: {
          actualAmount: actual,
          varianceAmount,
          variancePct: parseFloat(variancePct.toFixed(4)),
          actualsUpdatedAt: now,
        },
      });
    });

    await Promise.all(updates);

    // Recompute budget totalBudget (sum of budgetAmount)
    const totalBudget = budget.lines.reduce((sum, l) => sum + Number(l.budgetAmount), 0);

    await this.prisma.budget.update({
      where: { id: budgetId },
      data: { totalBudget, updatedById: userId },
    });

    await this.audit.log({
      action: 'BUDGET_ACTUALS_REFRESHED',
      actorUserId: userId,
      entityType: 'Budget',
      entityId: budgetId,
      metadata: {
        windowStart,
        windowEnd,
        accountsRefreshed: accountIds.length,
        notes: dto.notes,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getBudget(ctx, budgetId);
  }

  // ── Procurement Suggestions (review only — generation is in ForecastService) ──

  async listProcurementSuggestions(ctx: BranchContext, urgency?: string, status?: string) {
    const where: Record<string, unknown> = {
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
    };
    if (status) where['status'] = status;
    if (urgency) where['urgency'] = urgency;

    return this.prisma.procurementSuggestion.findMany({
      where,
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true } },
        demandCalendarEntry: {
          select: { id: true, title: true, calendarType: true, daypart: true },
        },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async reviewProcurementSuggestion(
    userId: string,
    ctx: BranchContext,
    suggestionId: string,
    status: 'REVIEWED' | 'DISMISSED' | 'ACTIONED',
    reviewNotes: string | undefined,
    meta: AuditMeta,
  ) {
    const suggestion = await this.prisma.procurementSuggestion.findFirst({
      where: { id: suggestionId, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!suggestion) {
      throw new NotFoundException(`Procurement suggestion "${suggestionId}" not found`);
    }
    if (suggestion.status !== 'PENDING') {
      throw new BadRequestException(
        `Suggestion is already ${suggestion.status} and cannot be changed`,
      );
    }

    const updated = await this.prisma.procurementSuggestion.update({
      where: { id: suggestionId },
      data: {
        status,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
    });

    await this.audit.log({
      action: 'PROCUREMENT_SUGGESTION_REVIEWED',
      actorUserId: userId,
      entityType: 'ProcurementSuggestion',
      entityId: suggestionId,
      metadata: { status, reviewNotes },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
