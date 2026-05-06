import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  ConsolidatedFinanceQueryDto,
  ScorecardsQueryDto,
  WasteBenchmarkQueryDto,
  FinancialComparisonQueryDto,
  DeepRankingsQueryDto,
  DrilldownQueryDto,
} from './dto';

interface OrgContext {
  organizationId: string;
}

interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class FranchiseAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) { }

  // ── Helpers ──

  async resolveOrgContext(userId: string): Promise<OrgContext> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new ForbiddenException('No active membership found');
    }
    return { organizationId: membership.organizationId };
  }

  private async getOrgBranches(orgId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
    });
  }

  private normalizeWindow(
    windowStart?: string,
    windowEnd?: string,
    windowType?: string,
  ): { start: Date; end: Date; type: string } {
    const now = new Date();
    let type = windowType || 'MONTHLY';
    let start: Date;
    let end: Date;

    if (windowStart && windowEnd) {
      start = new Date(windowStart);
      end = new Date(windowEnd);
      if (end <= start) {
        throw new BadRequestException('windowEnd must be after windowStart');
      }
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      type = 'MONTHLY';
    }
    return { start, end, type };
  }

  // ═══════════════════════════════════════════════════════════════
  // 1) Consolidated Finance View
  // ═══════════════════════════════════════════════════════════════

  async getConsolidatedFinance(orgId: string, query: ConsolidatedFinanceQueryDto) {
    const { start, end, type } = this.normalizeWindow(
      query.windowStart,
      query.windowEnd,
      query.windowType,
    );
    const branches = await this.getOrgBranches(orgId);

    const branchFinancials = await Promise.all(
      branches.map(async (branch) => {
        const fin = await this.computeBranchFinancials(orgId, branch.id, start, end);
        return { branchId: branch.id, branchName: branch.name, branchCode: branch.code, ...fin };
      }),
    );

    // Consolidate
    const consolidated = {
      revenue: '0',
      cogs: '0',
      grossProfit: '0',
      grossMarginPct: '0',
      laborCost: '0',
      primeCost: '0',
      primeCostPct: '0',
      overheadCost: '0',
      totalBudget: '0',
      totalActual: '0',
      budgetVariance: '0',
      budgetVariancePct: '0',
    };

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalLabor = 0;
    let totalOverhead = 0;
    let totalBudget = 0;
    let totalActual = 0;

    for (const b of branchFinancials) {
      totalRevenue += parseFloat(b.revenue);
      totalCogs += parseFloat(b.cogs);
      totalLabor += parseFloat(b.laborCost);
      totalOverhead += parseFloat(b.overheadCost);
      totalBudget += parseFloat(b.totalBudget);
      totalActual += parseFloat(b.totalActual);
    }

    const grossProfit = totalRevenue - totalCogs;
    const primeCost = totalCogs + totalLabor;
    const budgetVariance = totalBudget - totalActual;

    consolidated.revenue = totalRevenue.toFixed(2);
    consolidated.cogs = totalCogs.toFixed(2);
    consolidated.grossProfit = grossProfit.toFixed(2);
    consolidated.grossMarginPct =
      totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(4) : '0.0000';
    consolidated.laborCost = totalLabor.toFixed(2);
    consolidated.primeCost = primeCost.toFixed(2);
    consolidated.primeCostPct =
      totalRevenue > 0 ? ((primeCost / totalRevenue) * 100).toFixed(4) : '0.0000';
    consolidated.overheadCost = totalOverhead.toFixed(2);
    consolidated.totalBudget = totalBudget.toFixed(2);
    consolidated.totalActual = totalActual.toFixed(2);
    consolidated.budgetVariance = budgetVariance.toFixed(2);
    consolidated.budgetVariancePct =
      totalBudget > 0 ? ((budgetVariance / totalBudget) * 100).toFixed(4) : '0.0000';

    // Branch contribution
    const branchContributions = branchFinancials.map((b) => ({
      branchId: b.branchId,
      branchName: b.branchName,
      branchCode: b.branchCode,
      revenue: b.revenue,
      cogs: b.cogs,
      grossProfit: b.grossProfit,
      grossMarginPct: b.grossMarginPct,
      laborCost: b.laborCost,
      primeCost: b.primeCost,
      primeCostPct: b.primeCostPct,
      overheadCost: b.overheadCost,
      revenueContributionPct:
        totalRevenue > 0 ? ((parseFloat(b.revenue) / totalRevenue) * 100).toFixed(4) : '0.0000',
      cogsContributionPct:
        totalCogs > 0 ? ((parseFloat(b.cogs) / totalCogs) * 100).toFixed(4) : '0.0000',
    }));

    return {
      orgId,
      windowType: type,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      branchCount: branches.length,
      consolidated,
      branches: branchContributions,
      calculationBasis: {
        revenue: 'SUM(order.total) WHERE status=CLOSED',
        cogs: 'SUM(order_item.cost_total) WHERE order.status=CLOSED',
        labor: 'SUM(pay_slip.net_pay) WHERE pay_run overlaps window',
        overhead: 'SUM(budget_line.actual_amount) WHERE category=OVERHEAD',
        primeCost: 'cogs + labor',
        grossProfit: 'revenue - cogs',
      },
    };
  }

  /** Compute financials for a single branch within a time window. */
  async computeBranchFinancials(orgId: string, branchId: string, start: Date, end: Date) {
    // Revenue: sum of closed order totals
    const revenueAgg = await this.prisma.order.aggregate({
      where: {
        orgId,
        branchId,
        status: 'CLOSED',
        createdAt: { gte: start, lte: end },
      },
      _sum: { total: true },
    });
    const revenue = Number(revenueAgg._sum.total ?? 0);

    // COGS: sum of order item cost totals from closed orders
    const cogsResult = await this.prisma.$queryRaw<{ total: string }[]>`
            SELECT COALESCE(SUM(oi.cost_total), 0)::text as total
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            WHERE o.org_id = ${orgId}
              AND o.branch_id = ${branchId}
              AND o.status = 'CLOSED'
              AND o.created_at >= ${start}
              AND o.created_at <= ${end}
        `;
    const cogs = parseFloat(cogsResult[0]?.total ?? '0');

    // Labor cost: from payroll pay slips
    const laborResult = await this.prisma.$queryRaw<{ total: string }[]>`
            SELECT COALESCE(SUM(ps.net_pay), 0)::text as total
            FROM pay_slips ps
            INNER JOIN pay_runs pr ON pr.id = ps.pay_run_id
            WHERE pr.org_id = ${orgId}
              AND pr.branch_id = ${branchId}
              AND pr.status = 'APPROVED'
              AND pr.period_start <= ${end}
              AND pr.period_end >= ${start}
        `;
    const laborCost = parseFloat(laborResult[0]?.total ?? '0');

    // Overhead: from budget lines where category is overhead-like
    const overheadAgg = await this.prisma.budgetLine.aggregate({
      where: {
        budget: {
          orgId,
          branchId,
          status: { in: ['ACTIVE', 'FINALIZED'] },
          periodStart: { lte: end },
          periodEnd: { gte: start },
        },
        category: { in: ['OVERHEAD', 'UTILITIES', 'REPAIRS', 'RENT', 'INSURANCE'] },
      },
      _sum: { actualAmount: true },
    });
    const overheadCost = Number(overheadAgg._sum.actualAmount ?? 0);

    // Budget aggregates
    const budgetAgg = await this.prisma.budgetLine.aggregate({
      where: {
        budget: {
          orgId,
          branchId,
          status: { in: ['ACTIVE', 'FINALIZED'] },
          periodStart: { lte: end },
          periodEnd: { gte: start },
        },
      },
      _sum: { budgetAmount: true, actualAmount: true },
    });
    const totalBudget = Number(budgetAgg._sum.budgetAmount ?? 0);
    const totalActual = Number(budgetAgg._sum.actualAmount ?? 0);

    const grossProfit = revenue - cogs;
    const primeCost = cogs + laborCost;

    return {
      revenue: revenue.toFixed(2),
      cogs: cogs.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      grossMarginPct: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(4) : '0.0000',
      laborCost: laborCost.toFixed(2),
      primeCost: primeCost.toFixed(2),
      primeCostPct: revenue > 0 ? ((primeCost / revenue) * 100).toFixed(4) : '0.0000',
      overheadCost: overheadCost.toFixed(2),
      totalBudget: totalBudget.toFixed(2),
      totalActual: totalActual.toFixed(2),
      budgetVariance: (totalBudget - totalActual).toFixed(2),
      budgetVariancePct:
        totalBudget > 0 ? (((totalBudget - totalActual) / totalBudget) * 100).toFixed(4) : '0.0000',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 2) Generate Consolidated Snapshot (persisted)
  // ═══════════════════════════════════════════════════════════════

  async generateConsolidatedSnapshot(
    userId: string,
    orgId: string,
    query: ConsolidatedFinanceQueryDto,
    meta: AuditMeta,
  ) {
    const { start, end, type } = this.normalizeWindow(
      query.windowStart,
      query.windowEnd,
      query.windowType,
    );
    const branches = await this.getOrgBranches(orgId);

    // Create consolidation run
    const run = await this.prisma.franchiseConsolidationRun.upsert({
      where: {
        orgId_windowType_windowStart_windowEnd: {
          orgId,
          windowType: type as any,
          windowStart: start,
          windowEnd: end,
        },
      },
      update: {
        status: 'PENDING',
        branchCount: branches.length,
        metricsCount: 0,
        startedAt: new Date(),
        completedAt: null,
        generatedById: userId,
      },
      create: {
        orgId,
        windowType: type as any,
        windowStart: start,
        windowEnd: end,
        status: 'PENDING',
        branchCount: branches.length,
        generatedById: userId,
      },
    });

    try {
      // Compute consolidated financials
      const finance = await this.getConsolidatedFinance(orgId, query);

      // Persist KPI snapshots
      const metrics: Array<{ family: string; value: string; breakdown: any; basis: string }> = [
        {
          family: 'REVENUE',
          value: finance.consolidated.revenue,
          breakdown: finance.branches.map((b) => ({
            branchId: b.branchId,
            value: b.revenue,
            contributionPct: b.revenueContributionPct,
          })),
          basis: 'SUM(order.total) WHERE status=CLOSED',
        },
        {
          family: 'COGS',
          value: finance.consolidated.cogs,
          breakdown: finance.branches.map((b) => ({
            branchId: b.branchId,
            value: b.cogs,
            contributionPct: b.cogsContributionPct,
          })),
          basis: 'SUM(order_item.cost_total) WHERE order.status=CLOSED',
        },
        {
          family: 'GROSS_PROFIT',
          value: finance.consolidated.grossProfit,
          breakdown: finance.branches.map((b) => ({
            branchId: b.branchId,
            value: b.grossProfit,
            marginPct: b.grossMarginPct,
          })),
          basis: 'revenue - cogs',
        },
        {
          family: 'LABOR',
          value: finance.consolidated.laborCost,
          breakdown: finance.branches.map((b) => ({
            branchId: b.branchId,
            value: b.laborCost,
          })),
          basis: 'SUM(pay_slip.net_pay) WHERE pay_run overlaps window',
        },
        {
          family: 'PRIME_COST',
          value: finance.consolidated.primeCost,
          breakdown: finance.branches.map((b) => ({
            branchId: b.branchId,
            value: b.primeCost,
            pct: b.primeCostPct,
          })),
          basis: 'cogs + labor',
        },
        {
          family: 'OVERHEAD',
          value: finance.consolidated.overheadCost,
          breakdown: finance.branches.map((b) => ({
            branchId: b.branchId,
            value: b.overheadCost,
          })),
          basis: 'SUM(budget_line.actual_amount) WHERE category IN overhead categories',
        },
      ];

      for (const m of metrics) {
        await this.prisma.franchiseKpiSnapshot.upsert({
          where: {
            orgId_metricFamily_windowType_windowStart_windowEnd: {
              orgId,
              metricFamily: m.family as any,
              windowType: type as any,
              windowStart: start,
              windowEnd: end,
            },
          },
          update: {
            value: new Prisma.Decimal(m.value),
            branchBreakdown: m.breakdown,
            calculationBasis: m.basis,
            consolidationRunId: run.id,
            generatedAt: new Date(),
          },
          create: {
            orgId,
            metricFamily: m.family as any,
            windowType: type as any,
            windowStart: start,
            windowEnd: end,
            value: new Prisma.Decimal(m.value),
            branchBreakdown: m.breakdown,
            calculationBasis: m.basis,
            consolidationRunId: run.id,
          },
        });
      }

      // Update run
      await this.prisma.franchiseConsolidationRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          metricsCount: metrics.length,
          completedAt: new Date(),
          summary: {
            revenue: finance.consolidated.revenue,
            grossMarginPct: finance.consolidated.grossMarginPct,
            primeCostPct: finance.consolidated.primeCostPct,
            branchCount: branches.length,
          },
        },
      });

      await this.audit.log({
        actorUserId: userId,
        action: 'FRANCHISE_CONSOLIDATION_GENERATED',
        entityType: 'FranchiseConsolidationRun',
        entityId: run.id,
        metadata: {
          windowType: type,
          windowStart: start.toISOString(),
          metricsCount: metrics.length,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return { runId: run.id, status: 'COMPLETED', metricsCount: metrics.length, finance };
    } catch (error) {
      await this.prisma.franchiseConsolidationRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3) Financial Comparison
  // ═══════════════════════════════════════════════════════════════

  async getFinancialComparison(orgId: string, query: FinancialComparisonQueryDto) {
    const { start, end, type } = this.normalizeWindow(
      query.windowStart,
      query.windowEnd,
      query.windowType,
    );
    const branches = await this.getOrgBranches(orgId);

    const branchMetrics = await Promise.all(
      branches.map(async (branch) => {
        const fin = await this.computeBranchFinancials(orgId, branch.id, start, end);
        return { branchId: branch.id, branchName: branch.name, branchCode: branch.code, ...fin };
      }),
    );

    // Portfolio averages
    const count = branchMetrics.length || 1;
    const avgRevenue = branchMetrics.reduce((s, b) => s + parseFloat(b.revenue), 0) / count;
    const avgGrossMargin =
      branchMetrics.reduce((s, b) => s + parseFloat(b.grossMarginPct), 0) / count;
    const avgPrimeCostPct =
      branchMetrics.reduce((s, b) => s + parseFloat(b.primeCostPct), 0) / count;
    const avgBudgetVarPct =
      branchMetrics.reduce((s, b) => s + parseFloat(b.budgetVariancePct), 0) / count;

    // Identify best/worst
    const sortedByRevenue = [...branchMetrics].sort(
      (a, b) => parseFloat(b.revenue) - parseFloat(a.revenue),
    );
    const sortedByMargin = [...branchMetrics].sort(
      (a, b) => parseFloat(b.grossMarginPct) - parseFloat(a.grossMarginPct),
    );
    const sortedByPrimeCost = [...branchMetrics].sort(
      (a, b) => parseFloat(a.primeCostPct) - parseFloat(b.primeCostPct),
    );

    // Enrich with vs-portfolio
    const enriched = branchMetrics.map((b) => ({
      ...b,
      vsPortfolio: {
        revenueVsAvg: (parseFloat(b.revenue) - avgRevenue).toFixed(2),
        grossMarginVsAvg: (parseFloat(b.grossMarginPct) - avgGrossMargin).toFixed(4),
        primeCostVsAvg: (parseFloat(b.primeCostPct) - avgPrimeCostPct).toFixed(4),
        budgetVarVsAvg: (parseFloat(b.budgetVariancePct) - avgBudgetVarPct).toFixed(4),
      },
    }));

    return {
      orgId,
      windowType: type,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      branchCount: branches.length,
      portfolioAverage: {
        revenue: avgRevenue.toFixed(2),
        grossMarginPct: avgGrossMargin.toFixed(4),
        primeCostPct: avgPrimeCostPct.toFixed(4),
        budgetVariancePct: avgBudgetVarPct.toFixed(4),
      },
      bestBranch: {
        revenue: sortedByRevenue[0]
          ? {
            branchId: sortedByRevenue[0].branchId,
            name: sortedByRevenue[0].branchName,
            value: sortedByRevenue[0].revenue,
          }
          : null,
        grossMargin: sortedByMargin[0]
          ? {
            branchId: sortedByMargin[0].branchId,
            name: sortedByMargin[0].branchName,
            value: sortedByMargin[0].grossMarginPct,
          }
          : null,
        primeCost: sortedByPrimeCost[0]
          ? {
            branchId: sortedByPrimeCost[0].branchId,
            name: sortedByPrimeCost[0].branchName,
            value: sortedByPrimeCost[0].primeCostPct,
          }
          : null,
      },
      worstBranch: {
        revenue: sortedByRevenue[sortedByRevenue.length - 1]
          ? {
            branchId: sortedByRevenue[sortedByRevenue.length - 1].branchId,
            name: sortedByRevenue[sortedByRevenue.length - 1].branchName,
            value: sortedByRevenue[sortedByRevenue.length - 1].revenue,
          }
          : null,
        grossMargin: sortedByMargin[sortedByMargin.length - 1]
          ? {
            branchId: sortedByMargin[sortedByMargin.length - 1].branchId,
            name: sortedByMargin[sortedByMargin.length - 1].branchName,
            value: sortedByMargin[sortedByMargin.length - 1].grossMarginPct,
          }
          : null,
        primeCost: sortedByPrimeCost[sortedByPrimeCost.length - 1]
          ? {
            branchId: sortedByPrimeCost[sortedByPrimeCost.length - 1].branchId,
            name: sortedByPrimeCost[sortedByPrimeCost.length - 1].branchName,
            value: sortedByPrimeCost[sortedByPrimeCost.length - 1].primeCostPct,
          }
          : null,
      },
      branches: enriched,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 4) Waste Benchmarks
  // ═══════════════════════════════════════════════════════════════

  async getWasteBenchmarks(orgId: string, query: WasteBenchmarkQueryDto) {
    const { start, end, type } = this.normalizeWindow(
      query.windowStart,
      query.windowEnd,
      query.windowType,
    );
    let branches = await this.getOrgBranches(orgId);
    if (query.branchId) {
      branches = branches.filter((b) => b.id === query.branchId);
    }

    const branchWaste = await Promise.all(
      branches.map(async (branch) => {
        return this.computeBranchWaste(orgId, branch.id, branch.name, start, end);
      }),
    );

    // Portfolio averages
    const count = branchWaste.length || 1;
    const avgWastePctCogs = branchWaste.reduce((s, b) => s + parseFloat(b.wastePctCogs), 0) / count;
    const avgWastePctSales =
      branchWaste.reduce((s, b) => s + parseFloat(b.wastePctSales), 0) / count;
    const avgVariancePct = branchWaste.reduce((s, b) => s + parseFloat(b.variancePct), 0) / count;

    // Rank by waste efficiency (lower waste% = better)
    const ranked = [...branchWaste]
      .sort((a, b) => parseFloat(a.wastePctCogs) - parseFloat(b.wastePctCogs))
      .map((b, i) => ({ ...b, rank: i + 1, portfolioAvgWastePctCogs: avgWastePctCogs.toFixed(4) }));

    return {
      orgId,
      windowType: type,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      branchCount: branches.length,
      portfolioAverage: {
        wastePctCogs: avgWastePctCogs.toFixed(4),
        wastePctSales: avgWastePctSales.toFixed(4),
        variancePct: avgVariancePct.toFixed(4),
      },
      branches: ranked,
      calculationBasis: {
        wasteValue:
          'SUM(ABS(stock_adjustment.qty_delta) * inventory_item.theoretical_unit_cost) WHERE qty_delta < 0',
        wastePctCogs: 'waste_value / cogs * 100',
        wastePctSales: 'waste_value / revenue * 100',
        theoreticalCogs: 'SUM(order_item qty * recipe ingredient effective_cost)',
        actualCogs: 'SUM(order_item.cost_total)',
        variance: 'actual_cogs - theoretical_cogs',
      },
    };
  }

  /** Compute waste metrics for a single branch. */
  async computeBranchWaste(
    orgId: string,
    branchId: string,
    branchName: string,
    start: Date,
    end: Date,
  ) {
    // Waste: negative stock adjustments (waste, spoilage, breakage, etc.)
    const wasteResult = await this.prisma.$queryRaw<
      { total_waste: string; reason_breakdown: string }[]
    >`
            SELECT
                COALESCE(SUM(ABS(sa.qty_delta) * COALESCE(ii.theoretical_unit_cost, 0)), 0)::text as total_waste,
                json_agg(json_build_object(
                    'reason', COALESCE(sa.reason, 'Unspecified'),
                    'count', 1,
                    'value', ABS(sa.qty_delta) * COALESCE(ii.theoretical_unit_cost, 0)
                ))::text as reason_breakdown
            FROM stock_adjustments sa
            INNER JOIN inventory_items ii ON ii.id = sa.item_id
            WHERE sa.org_id = ${orgId}
              AND sa.branch_id = ${branchId}
              AND sa.qty_delta < 0
              AND sa.created_at >= ${start}
              AND sa.created_at <= ${end}
        `;
    const wasteValue = parseFloat(wasteResult[0]?.total_waste ?? '0');

    // Top waste reasons grouped
    const wasteReasonRows = await this.prisma.$queryRaw<
      { reason: string; count: string; value: string }[]
    >`
            SELECT
                COALESCE(sa.reason, 'Unspecified') as reason,
                COUNT(*)::text as count,
                COALESCE(SUM(ABS(sa.qty_delta) * COALESCE(ii.theoretical_unit_cost, 0)), 0)::text as value
            FROM stock_adjustments sa
            INNER JOIN inventory_items ii ON ii.id = sa.item_id
            WHERE sa.org_id = ${orgId}
              AND sa.branch_id = ${branchId}
              AND sa.qty_delta < 0
              AND sa.created_at >= ${start}
              AND sa.created_at <= ${end}
            GROUP BY sa.reason
            ORDER BY SUM(ABS(sa.qty_delta) * COALESCE(ii.theoretical_unit_cost, 0)) DESC
            LIMIT 10
        `;

    // Top wasted items
    const wastedItemRows = await this.prisma.$queryRaw<
      { item_name: string; waste_qty: string; waste_value: string }[]
    >`
            SELECT
                ii.name as item_name,
                SUM(ABS(sa.qty_delta))::text as waste_qty,
                COALESCE(SUM(ABS(sa.qty_delta) * COALESCE(ii.theoretical_unit_cost, 0)), 0)::text as waste_value
            FROM stock_adjustments sa
            INNER JOIN inventory_items ii ON ii.id = sa.item_id
            WHERE sa.org_id = ${orgId}
              AND sa.branch_id = ${branchId}
              AND sa.qty_delta < 0
              AND sa.created_at >= ${start}
              AND sa.created_at <= ${end}
            GROUP BY ii.name
            ORDER BY SUM(ABS(sa.qty_delta) * COALESCE(ii.theoretical_unit_cost, 0)) DESC
            LIMIT 10
        `;

    // COGS and revenue for ratios
    const cogsResult = await this.prisma.$queryRaw<{ total: string }[]>`
            SELECT COALESCE(SUM(oi.cost_total), 0)::text as total
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            WHERE o.org_id = ${orgId}
              AND o.branch_id = ${branchId}
              AND o.status = 'CLOSED'
              AND o.created_at >= ${start}
              AND o.created_at <= ${end}
        `;
    const actualCogs = parseFloat(cogsResult[0]?.total ?? '0');

    const revenueAgg = await this.prisma.order.aggregate({
      where: {
        orgId,
        branchId,
        status: 'CLOSED',
        createdAt: { gte: start, lte: end },
      },
      _sum: { total: true },
    });
    const revenue = Number(revenueAgg._sum.total ?? 0);

    // Theoretical COGS: sum of ordered qty * recipe cost
    const theoreticalResult = await this.prisma.$queryRaw<{ total: string }[]>`
            SELECT COALESCE(SUM(
                oi.quantity * COALESCE(
                    (SELECT SUM(ri.qty_per_unit * (1 + COALESCE(ri.waste_pct, 0)/100) * ii2.theoretical_unit_cost)
                     FROM recipe_ingredients ri
                     INNER JOIN inventory_items ii2 ON ii2.id = ri.inventory_item_id
                     WHERE ri.menu_item_id = oi.menu_item_id),
                    0
                )
            ), 0)::text as total
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            WHERE o.org_id = ${orgId}
              AND o.branch_id = ${branchId}
              AND o.status = 'CLOSED'
              AND o.created_at >= ${start}
              AND o.created_at <= ${end}
        `;
    const theoreticalCogs = parseFloat(theoreticalResult[0]?.total ?? '0');

    const varianceAmount = actualCogs - theoreticalCogs;
    const wastePctCogs = actualCogs > 0 ? (wasteValue / actualCogs) * 100 : 0;
    const wastePctSales = revenue > 0 ? (wasteValue / revenue) * 100 : 0;
    const variancePct = theoreticalCogs > 0 ? (varianceAmount / theoreticalCogs) * 100 : 0;

    return {
      branchId,
      branchName,
      wasteValue: wasteValue.toFixed(2),
      wastePctCogs: wastePctCogs.toFixed(4),
      wastePctSales: wastePctSales.toFixed(4),
      theoreticalCogs: theoreticalCogs.toFixed(2),
      actualCogs: actualCogs.toFixed(2),
      varianceAmount: varianceAmount.toFixed(2),
      variancePct: variancePct.toFixed(4),
      topWasteReasons: wasteReasonRows.map((r) => ({
        reason: r.reason,
        count: parseInt(r.count, 10),
        value: parseFloat(r.value).toFixed(2),
      })),
      topWastedItems: wastedItemRows.map((r) => ({
        itemName: r.item_name,
        wasteQty: r.waste_qty,
        wasteValue: parseFloat(r.waste_value).toFixed(2),
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 5) Generate Waste Benchmark Snapshots (persisted)
  // ═══════════════════════════════════════════════════════════════

  async generateWasteBenchmarks(
    userId: string,
    orgId: string,
    query: WasteBenchmarkQueryDto,
    meta: AuditMeta,
  ) {
    const { start, end, type } = this.normalizeWindow(
      query.windowStart,
      query.windowEnd,
      query.windowType,
    );

    const benchmarks = await this.getWasteBenchmarks(orgId, query);

    for (const b of benchmarks.branches) {
      await this.prisma.wasteBenchmarkSnapshot.upsert({
        where: {
          orgId_branchId_windowType_windowStart_windowEnd: {
            orgId,
            branchId: b.branchId,
            windowType: type as any,
            windowStart: start,
            windowEnd: end,
          },
        },
        update: {
          wasteValue: new Prisma.Decimal(b.wasteValue),
          wastePctCogs: new Prisma.Decimal(b.wastePctCogs),
          wastePctSales: new Prisma.Decimal(b.wastePctSales),
          theoreticalCogs: new Prisma.Decimal(b.theoreticalCogs),
          actualCogs: new Prisma.Decimal(b.actualCogs),
          varianceAmount: new Prisma.Decimal(b.varianceAmount),
          variancePct: new Prisma.Decimal(b.variancePct),
          topWasteReasons: b.topWasteReasons,
          topWastedItems: b.topWastedItems,
          portfolioAvgWastePct: benchmarks.portfolioAverage.wastePctCogs
            ? new Prisma.Decimal(benchmarks.portfolioAverage.wastePctCogs)
            : null,
          rank: b.rank,
          generatedAt: new Date(),
        },
        create: {
          orgId,
          branchId: b.branchId,
          windowType: type as any,
          windowStart: start,
          windowEnd: end,
          wasteValue: new Prisma.Decimal(b.wasteValue),
          wastePctCogs: new Prisma.Decimal(b.wastePctCogs),
          wastePctSales: new Prisma.Decimal(b.wastePctSales),
          theoreticalCogs: new Prisma.Decimal(b.theoreticalCogs),
          actualCogs: new Prisma.Decimal(b.actualCogs),
          varianceAmount: new Prisma.Decimal(b.varianceAmount),
          variancePct: new Prisma.Decimal(b.variancePct),
          topWasteReasons: b.topWasteReasons,
          topWastedItems: b.topWastedItems,
          portfolioAvgWastePct: benchmarks.portfolioAverage.wastePctCogs
            ? new Prisma.Decimal(benchmarks.portfolioAverage.wastePctCogs)
            : null,
          rank: b.rank,
        },
      });
    }

    await this.audit.log({
      actorUserId: userId,
      action: 'FRANCHISE_WASTE_BENCHMARK_GENERATED',
      entityType: 'WasteBenchmarkSnapshot',
      entityId: orgId,
      metadata: {
        windowType: type,
        windowStart: start.toISOString(),
        branchCount: benchmarks.branches.length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return benchmarks;
  }

  // ═══════════════════════════════════════════════════════════════
  // 6) Branch Scorecards
  // ═══════════════════════════════════════════════════════════════

  async getScorecards(orgId: string, query: ScorecardsQueryDto) {
    const { start, end, type } = this.normalizeWindow(
      query.windowStart,
      query.windowEnd,
      query.windowType,
    );
    let branches = await this.getOrgBranches(orgId);
    if (query.branchId) {
      branches = branches.filter((b) => b.id === query.branchId);
    }

    const scorecards = await Promise.all(
      branches.map(async (branch) => {
        return this.computeBranchScorecard(orgId, branch.id, branch.name, start, end);
      }),
    );

    return {
      orgId,
      windowType: type,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      branchCount: branches.length,
      branches: scorecards,
    };
  }

  /** Compute a full scorecard for a branch. */
  async computeBranchScorecard(
    orgId: string,
    branchId: string,
    branchName: string,
    start: Date,
    end: Date,
  ) {
    const fin = await this.computeBranchFinancials(orgId, branchId, start, end);
    const waste = await this.computeBranchWaste(orgId, branchId, branchName, start, end);

    // Stock health
    const lowStockResult = await this.prisma.$queryRaw<{ count: string }[]>`
            SELECT COUNT(DISTINCT ii.id)::text as count
            FROM inventory_items ii
            LEFT JOIN (
                SELECT item_id, SUM(remaining_qty) as total_qty
                FROM stock_batches
                WHERE org_id = ${orgId} AND branch_id = ${branchId}
                GROUP BY item_id
            ) sb ON sb.item_id = ii.id
            WHERE ii.org_id = ${orgId}
              AND ii.branch_id = ${branchId}
              AND ii.is_active = true
              AND ii.reorder_level > 0
              AND COALESCE(sb.total_qty, 0) < ii.reorder_level
        `;
    const lowStockCount = parseInt(lowStockResult[0]?.count ?? '0', 10);

    const totalItemsResult = await this.prisma.inventoryItem.count({
      where: { orgId, branchId, isActive: true },
    });
    const stockHealthPct =
      totalItemsResult > 0 ? ((totalItemsResult - lowStockCount) / totalItemsResult) * 100 : 100;

    // Procurement
    const urgentProcCount = await this.prisma.procurementSuggestion.count({
      where: {
        orgId,
        branchId,
        status: 'PENDING',
        urgency: { in: ['URGENT_LOCAL_BUY', 'STOCK_UP_BEFORE_EVENT'] },
      },
    });

    // Demand readiness
    const upcomingEvents = await this.prisma.demandCalendarEntry.count({
      where: {
        orgId,
        branchId,
        isActive: true,
        dateStart: { lte: end },
        dateEnd: { gte: start },
      },
    });

    // Build domain scorecards
    const domains = [
      {
        domain: 'FINANCIAL',
        kpiValues: {
          revenue: fin.revenue,
          grossProfit: fin.grossProfit,
          grossMarginPct: fin.grossMarginPct,
          budgetVariancePct: fin.budgetVariancePct,
        },
        tier: this.tierFromMargin(parseFloat(fin.grossMarginPct)),
      },
      {
        domain: 'PRIME_COST',
        kpiValues: {
          primeCost: fin.primeCost,
          primeCostPct: fin.primeCostPct,
          cogs: fin.cogs,
          laborCost: fin.laborCost,
        },
        tier: this.tierFromPrimeCost(parseFloat(fin.primeCostPct)),
      },
      {
        domain: 'WASTE_VARIANCE',
        kpiValues: {
          wasteValue: waste.wasteValue,
          wastePctCogs: waste.wastePctCogs,
          wastePctSales: waste.wastePctSales,
          variancePct: waste.variancePct,
          topWasteReasons: waste.topWasteReasons.slice(0, 3),
        },
        tier: this.tierFromWaste(parseFloat(waste.wastePctCogs)),
      },
      {
        domain: 'STOCK_HEALTH',
        kpiValues: {
          lowStockCount,
          totalActiveItems: totalItemsResult,
          healthPct: stockHealthPct.toFixed(2),
        },
        tier: this.tierFromStockHealth(stockHealthPct),
      },
      {
        domain: 'PROCUREMENT_READINESS',
        kpiValues: { urgentSuggestionCount: urgentProcCount },
        tier: urgentProcCount === 0 ? 'STRONG' : urgentProcCount <= 3 ? 'WATCH' : 'AT_RISK',
      },
      {
        domain: 'DEMAND_READINESS',
        kpiValues: { upcomingEventCount: upcomingEvents },
        tier: 'WATCH' as const,
      },
      {
        domain: 'OPERATIONAL_RISK',
        kpiValues: {
          lowStockCount,
          urgentProcCount,
          wastePctCogs: waste.wastePctCogs,
          budgetVariancePct: fin.budgetVariancePct,
        },
        tier: this.tierFromRisk(lowStockCount, urgentProcCount, parseFloat(waste.wastePctCogs)),
      },
    ];

    return {
      branchId,
      branchName,
      domains,
    };
  }

  // ── Tiering logic (deterministic, explainable thresholds) ──

  private tierFromMargin(marginPct: number): string {
    if (marginPct >= 65) return 'STRONG';
    if (marginPct >= 50) return 'WATCH';
    return 'AT_RISK';
  }

  private tierFromPrimeCost(primeCostPct: number): string {
    if (primeCostPct <= 55) return 'STRONG';
    if (primeCostPct <= 65) return 'WATCH';
    return 'AT_RISK';
  }

  private tierFromWaste(wastePctCogs: number): string {
    if (wastePctCogs <= 2) return 'STRONG';
    if (wastePctCogs <= 5) return 'WATCH';
    return 'AT_RISK';
  }

  private tierFromStockHealth(healthPct: number): string {
    if (healthPct >= 90) return 'STRONG';
    if (healthPct >= 75) return 'WATCH';
    return 'AT_RISK';
  }

  private tierFromRisk(lowStock: number, urgentProc: number, wastePctCogs: number): string {
    const riskFactors =
      (lowStock > 5 ? 1 : 0) + (urgentProc > 3 ? 1 : 0) + (wastePctCogs > 5 ? 1 : 0);
    if (riskFactors === 0) return 'STRONG';
    if (riskFactors === 1) return 'WATCH';
    return 'AT_RISK';
  }

  // ═══════════════════════════════════════════════════════════════
  // 7) Generate Scorecards (persisted)
  // ═══════════════════════════════════════════════════════════════

  async generateScorecards(
    userId: string,
    orgId: string,
    query: ScorecardsQueryDto,
    meta: AuditMeta,
  ) {
    const { start, end, type } = this.normalizeWindow(
      query.windowStart,
      query.windowEnd,
      query.windowType,
    );
    const scorecards = await this.getScorecards(orgId, query);

    for (const branch of scorecards.branches) {
      for (const d of branch.domains) {
        await this.prisma.branchPerformanceScorecard.upsert({
          where: {
            orgId_branchId_domain_windowType_windowStart_windowEnd: {
              orgId,
              branchId: branch.branchId,
              domain: d.domain as any,
              windowType: type as any,
              windowStart: start,
              windowEnd: end,
            },
          },
          update: {
            tier: d.tier as any,
            kpiValues: d.kpiValues,
            generatedAt: new Date(),
          },
          create: {
            orgId,
            branchId: branch.branchId,
            domain: d.domain as any,
            windowType: type as any,
            windowStart: start,
            windowEnd: end,
            tier: d.tier as any,
            kpiValues: d.kpiValues,
          },
        });
      }
    }

    await this.audit.log({
      actorUserId: userId,
      action: 'FRANCHISE_SCORECARDS_GENERATED',
      entityType: 'BranchPerformanceScorecard',
      entityId: orgId,
      metadata: {
        windowType: type,
        windowStart: start.toISOString(),
        branchCount: scorecards.branchCount,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return scorecards;
  }

  // ═══════════════════════════════════════════════════════════════
  // 8) Deep Rankings
  // ═══════════════════════════════════════════════════════════════

  async generateDeepRankings(
    userId: string,
    orgId: string,
    query: DeepRankingsQueryDto,
    meta: AuditMeta,
  ) {
    const { start, end, type } = this.normalizeWindow(
      query.windowStart,
      query.windowEnd,
      query.windowType,
    );
    const branches = await this.getOrgBranches(orgId);
    if (branches.length === 0) return { rankings: {}, totalRankings: 0 };

    // Compute financials and waste for all branches
    const branchData = await Promise.all(
      branches.map(async (branch) => {
        const fin = await this.computeBranchFinancials(orgId, branch.id, start, end);
        const waste = await this.computeBranchWaste(orgId, branch.id, branch.name, start, end);
        return { branch, fin, waste };
      }),
    );

    const rankingSets: Array<{
      type: string;
      scores: Array<{ branchId: string; branchName: string; score: number }>;
      basis: string;
      ascending: boolean;
    }> = [
        {
          type: 'PRIME_COST',
          scores: branchData.map((d) => ({
            branchId: d.branch.id,
            branchName: d.branch.name,
            score: parseFloat(d.fin.primeCostPct),
          })),
          basis: 'prime_cost_pct_asc',
          ascending: true,
        },
        {
          type: 'WASTE_EFFICIENCY',
          scores: branchData.map((d) => ({
            branchId: d.branch.id,
            branchName: d.branch.name,
            score: parseFloat(d.waste.wastePctCogs),
          })),
          basis: 'waste_pct_cogs_asc',
          ascending: true,
        },
        {
          type: 'THEORETICAL_VARIANCE',
          scores: branchData.map((d) => ({
            branchId: d.branch.id,
            branchName: d.branch.name,
            score: Math.abs(parseFloat(d.waste.variancePct)),
          })),
          basis: 'abs_variance_pct_asc',
          ascending: true,
        },
        {
          type: 'GROSS_MARGIN',
          scores: branchData.map((d) => ({
            branchId: d.branch.id,
            branchName: d.branch.name,
            score: parseFloat(d.fin.grossMarginPct),
          })),
          basis: 'gross_margin_pct_desc',
          ascending: false,
        },
        {
          type: 'LABOR_EFFICIENCY',
          scores: branchData.map((d) => {
            const rev = parseFloat(d.fin.revenue);
            const labor = parseFloat(d.fin.laborCost);
            return {
              branchId: d.branch.id,
              branchName: d.branch.name,
              score: rev > 0 ? (labor / rev) * 100 : 0,
            };
          }),
          basis: 'labor_pct_asc',
          ascending: true,
        },
        {
          type: 'OVERALL_FINANCIAL_DISCIPLINE',
          scores: branchData.map((d) => {
            // Composite: lower prime cost%, lower waste%, higher margin% = better
            const primeCostPenalty = parseFloat(d.fin.primeCostPct);
            const wastePenalty = parseFloat(d.waste.wastePctCogs) * 2;
            const marginBonus = 100 - parseFloat(d.fin.grossMarginPct);
            return {
              branchId: d.branch.id,
              branchName: d.branch.name,
              score: primeCostPenalty + wastePenalty + marginBonus,
            };
          }),
          basis: 'composite(prime_cost + 2*waste - margin)_asc',
          ascending: true,
        },
      ];

    // If specific ranking type requested, filter
    const filteredSets = query.rankingType
      ? rankingSets.filter((s) => s.type === query.rankingType)
      : rankingSets;

    const results: Record<string, any[]> = {};
    let total = 0;

    for (const set of filteredSets) {
      set.scores.sort((a, b) => (set.ascending ? a.score - b.score : b.score - a.score));

      const ranked = [];
      for (let i = 0; i < set.scores.length; i++) {
        const entry = set.scores[i];
        await this.prisma.franchiseRanking.upsert({
          where: {
            orgId_branchId_rankingType_windowType_windowStart_windowEnd: {
              orgId,
              branchId: entry.branchId,
              rankingType: set.type as any,
              windowType: type as any,
              windowStart: start,
              windowEnd: end,
            },
          },
          update: {
            rank: i + 1,
            score: entry.score,
            normalizationBasis: set.basis,
            branchCount: branches.length,
            sourceSignals: { rawScore: entry.score },
            generatedAt: new Date(),
          },
          create: {
            orgId,
            branchId: entry.branchId,
            rankingType: set.type as any,
            windowType: type as any,
            windowStart: start,
            windowEnd: end,
            rank: i + 1,
            score: entry.score,
            normalizationBasis: set.basis,
            branchCount: branches.length,
            sourceSignals: { rawScore: entry.score },
          },
        });

        ranked.push({
          branchId: entry.branchId,
          branchName: entry.branchName,
          rank: i + 1,
          score: entry.score,
          basis: set.basis,
        });
      }
      results[set.type] = ranked;
      total += ranked.length;
    }

    await this.audit.log({
      actorUserId: userId,
      action: 'FRANCHISE_DEEP_RANKINGS_GENERATED',
      entityType: 'FranchiseRanking',
      entityId: orgId,
      metadata: {
        windowType: type,
        windowStart: start.toISOString(),
        rankingTypes: filteredSets.map((s) => s.type),
        totalRankings: total,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      orgId,
      windowType: type,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      rankings: results,
      totalRankings: total,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 9) Drilldown
  // ═══════════════════════════════════════════════════════════════

  async getDrilldown(orgId: string, query: DrilldownQueryDto) {
    const { start, end, type } = this.normalizeWindow(
      query.windowStart,
      query.windowEnd,
      query.windowType,
    );

    if (!query.branchId) {
      throw new BadRequestException('branchId is required for drilldown');
    }
    if (!query.metricFamily) {
      throw new BadRequestException('metricFamily is required for drilldown');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: query.branchId, organizationId: orgId, status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
    });
    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    let drilldownData: any;

    switch (query.metricFamily) {
      case 'REVENUE':
        drilldownData = await this.drilldownRevenue(orgId, query.branchId, start, end);
        break;
      case 'COGS':
        drilldownData = await this.drilldownCogs(orgId, query.branchId, start, end);
        break;
      case 'OVERHEAD':
      case 'UTILITIES':
      case 'REPAIRS':
        drilldownData = await this.drilldownBudgetCategory(
          orgId,
          query.branchId,
          query.metricFamily,
          start,
          end,
        );
        break;
      case 'PRIME_COST': {
        const cogs = await this.drilldownCogs(orgId, query.branchId, start, end);
        const labor = await this.drilldownLabor(orgId, query.branchId, start, end);
        drilldownData = { cogs, labor };
        break;
      }
      case 'LABOR':
        drilldownData = await this.drilldownLabor(orgId, query.branchId, start, end);
        break;
      default:
        drilldownData = { message: 'No detailed drilldown available for this metric family' };
    }

    return {
      orgId,
      branchId: query.branchId,
      branchName: branch.name,
      metricFamily: query.metricFamily,
      windowType: type,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      drilldown: drilldownData,
    };
  }

  private async drilldownRevenue(orgId: string, branchId: string, start: Date, end: Date) {
    // Revenue by category
    const byCategoryRows = await this.prisma.$queryRaw<
      { category_name: string; total: string; order_count: string }[]
    >`
            SELECT
                c.name as category_name,
                SUM(oi.subtotal)::text as total,
                COUNT(DISTINCT o.id)::text as order_count
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN menu_items mi ON mi.id = oi.menu_item_id
            INNER JOIN categories c ON c.id = mi.category_id
            WHERE o.org_id = ${orgId}
              AND o.branch_id = ${branchId}
              AND o.status = 'CLOSED'
              AND o.created_at >= ${start}
              AND o.created_at <= ${end}
            GROUP BY c.name
            ORDER BY SUM(oi.subtotal) DESC
        `;

    // Top items by revenue
    const topItemRows = await this.prisma.$queryRaw<
      { item_name: string; total: string; qty: string }[]
    >`
            SELECT
                mi.name as item_name,
                SUM(oi.subtotal)::text as total,
                SUM(oi.quantity)::text as qty
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.org_id = ${orgId}
              AND o.branch_id = ${branchId}
              AND o.status = 'CLOSED'
              AND o.created_at >= ${start}
              AND o.created_at <= ${end}
            GROUP BY mi.name
            ORDER BY SUM(oi.subtotal) DESC
            LIMIT 20
        `;

    return {
      byCategory: byCategoryRows.map((r) => ({
        categoryName: r.category_name,
        total: r.total,
        orderCount: parseInt(r.order_count, 10),
      })),
      topItems: topItemRows.map((r) => ({
        itemName: r.item_name,
        total: r.total,
        quantity: parseInt(r.qty, 10),
      })),
    };
  }

  private async drilldownCogs(orgId: string, branchId: string, start: Date, end: Date) {
    // COGS by category
    const byCategoryRows = await this.prisma.$queryRaw<
      { category_name: string; total_cost: string; total_revenue: string }[]
    >`
            SELECT
                c.name as category_name,
                COALESCE(SUM(oi.cost_total), 0)::text as total_cost,
                SUM(oi.subtotal)::text as total_revenue
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN menu_items mi ON mi.id = oi.menu_item_id
            INNER JOIN categories c ON c.id = mi.category_id
            WHERE o.org_id = ${orgId}
              AND o.branch_id = ${branchId}
              AND o.status = 'CLOSED'
              AND o.created_at >= ${start}
              AND o.created_at <= ${end}
            GROUP BY c.name
            ORDER BY SUM(oi.cost_total) DESC
        `;

    // Highest cost items
    const topCostItems = await this.prisma.$queryRaw<
      { item_name: string; total_cost: string; margin_pct: string }[]
    >`
            SELECT
                mi.name as item_name,
                COALESCE(SUM(oi.cost_total), 0)::text as total_cost,
                CASE WHEN SUM(oi.subtotal) > 0
                    THEN ((SUM(oi.subtotal) - COALESCE(SUM(oi.cost_total), 0)) / SUM(oi.subtotal) * 100)::text
                    ELSE '0'
                END as margin_pct
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.org_id = ${orgId}
              AND o.branch_id = ${branchId}
              AND o.status = 'CLOSED'
              AND o.created_at >= ${start}
              AND o.created_at <= ${end}
            GROUP BY mi.name
            ORDER BY SUM(oi.cost_total) DESC
            LIMIT 20
        `;

    return {
      byCategory: byCategoryRows.map((r) => ({
        categoryName: r.category_name,
        totalCost: r.total_cost,
        totalRevenue: r.total_revenue,
        costPct:
          parseFloat(r.total_revenue) > 0
            ? ((parseFloat(r.total_cost) / parseFloat(r.total_revenue)) * 100).toFixed(2)
            : '0.00',
      })),
      topCostItems: topCostItems.map((r) => ({
        itemName: r.item_name,
        totalCost: r.total_cost,
        marginPct: parseFloat(r.margin_pct).toFixed(2),
      })),
    };
  }

  private async drilldownLabor(orgId: string, branchId: string, start: Date, end: Date) {
    const laborRows = await this.prisma.$queryRaw<
      { department: string; total_pay: string; headcount: string }[]
    >`
            SELECT
                COALESCE(p.department, 'Unassigned') as department,
                COALESCE(SUM(ps.net_pay), 0)::text as total_pay,
                COUNT(DISTINCT ps.employee_id)::text as headcount
            FROM pay_slips ps
            INNER JOIN pay_runs pr ON pr.id = ps.pay_run_id
            LEFT JOIN employees e ON e.id = ps.employee_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE pr.org_id = ${orgId}
              AND pr.branch_id = ${branchId}
              AND pr.status = 'APPROVED'
              AND pr.period_start <= ${end}
              AND pr.period_end >= ${start}
            GROUP BY p.department
            ORDER BY SUM(ps.net_pay) DESC
        `;

    return {
      byDepartment: laborRows.map((r) => ({
        department: r.department,
        totalPay: r.total_pay,
        headcount: parseInt(r.headcount, 10),
      })),
    };
  }

  private async drilldownBudgetCategory(
    orgId: string,
    branchId: string,
    category: string,
    start: Date,
    end: Date,
  ) {
    const categories =
      category === 'OVERHEAD'
        ? ['OVERHEAD', 'UTILITIES', 'REPAIRS', 'RENT', 'INSURANCE']
        : [category];

    const lines = await this.prisma.budgetLine.findMany({
      where: {
        budget: {
          orgId,
          branchId,
          status: { in: ['ACTIVE', 'FINALIZED'] },
          periodStart: { lte: end },
          periodEnd: { gte: start },
        },
        category: { in: categories },
      },
      include: {
        account: { select: { code: true, name: true } },
        costCenter: { select: { code: true, name: true } },
      },
      orderBy: { actualAmount: 'desc' },
    });

    return {
      lines: lines.map((l) => ({
        category: l.category,
        dimension: l.dimension,
        account: l.account ? { code: l.account.code, name: l.account.name } : null,
        costCenter: l.costCenter ? { code: l.costCenter.code, name: l.costCenter.name } : null,
        budgetAmount: l.budgetAmount.toString(),
        actualAmount: l.actualAmount.toString(),
        varianceAmount: l.varianceAmount.toString(),
        variancePct: l.variancePct.toString(),
      })),
    };
  }
}
