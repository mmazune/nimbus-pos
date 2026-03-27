import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { ReportType, ReportWindow, ReportRunStatus, ExportFormat, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

/** Report catalog entry shape returned by GET /reports/catalog */
export interface CatalogEntry {
  key: string;
  title: string;
  description: string;
  status: 'IMPLEMENTED' | 'CONDITIONAL' | 'PENDING_LATER';
  formats: string[];
  permission: string;
  dependencyMilestone?: string;
  notes?: string;
}

@Injectable()
export class ReportsService {
  private readonly exportDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    this.exportDir = path.resolve(process.cwd(), 'exports');
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  // ── Date Range Helpers ──

  private resolveRange(
    reportWindow: ReportWindow,
    dateFrom?: string | null,
    dateTo?: string | null,
  ): { start: Date; end: Date } {
    if (reportWindow === 'CUSTOM') {
      if (!dateFrom || !dateTo) {
        throw new BadRequestException('dateFrom and dateTo required for CUSTOM window');
      }
      return { start: new Date(dateFrom), end: new Date(dateTo) };
    }
    const now = new Date();
    if (reportWindow === 'DAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return { start, end };
    }
    if (reportWindow === 'WEEK') {
      const dayOfWeek = now.getDay();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    // MONTH
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }

  /** Shared helper: create a PENDING run, execute generator, mark COMPLETED or FAILED */
  private async executeReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportType: ReportType,
    reportWindow: ReportWindow,
    dateFrom: string | undefined,
    dateTo: string | undefined,
    parameters: Record<string, any> | undefined,
    generator: (range: { start: Date; end: Date }) => Promise<{ summary: any; rowCount: number }>,
  ) {
    const range = this.resolveRange(reportWindow, dateFrom, dateTo);

    const run = await this.prisma.reportRun.create({
      data: {
        orgId,
        branchId,
        reportType,
        reportWindow,
        requestedById,
        status: 'PENDING',
        dateFrom: range.start,
        dateTo: range.end,
        parameters: parameters ?? Prisma.JsonNull,
      },
    });

    try {
      const { summary, rowCount } = await generator(range);

      const updated = await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          summary,
          rowCount,
          generatedAt: new Date(),
        },
      });

      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_COMPLETED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType, reportWindow },
      });

      return updated;
    } catch (err) {
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message },
      });
      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_FAILED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType, error: (err as Error).message },
      });
      throw err;
    }
  }

  // ═══════════════════════════════════════════
  //  A) CORE SALES / REVENUE REPORTS
  // ═══════════════════════════════════════════

  async generateShiftEndReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'SHIFT_END',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const shifts = await this.prisma.shift.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
          include: { tillSessions: { include: { cashMovements: true } } },
        });
        const salesAgg = await this.prisma.order.aggregate({
          where: {
            orgId,
            branchId,
            status: { in: ['CLOSED', 'SERVED'] },
            createdAt: { gte: range.start, lt: range.end },
          },
          _sum: { subtotal: true, total: true, tax: true, discount: true },
          _count: true,
        });
        const payments = await this.prisma.payment.groupBy({
          by: ['method'],
          where: {
            orgId,
            branchId,
            status: 'COMPLETED',
            createdAt: { gte: range.start, lt: range.end },
          },
          _sum: { amount: true },
        });
        const refundAgg = await this.prisma.refund.aggregate({
          where: {
            orgId,
            branchId,
            status: 'COMPLETED',
            createdAt: { gte: range.start, lt: range.end },
          },
          _sum: { amount: true },
          _count: true,
        });

        const paymentBreakdown: Record<string, string> = {};
        for (const p of payments)
          paymentBreakdown[p.method] = (p._sum.amount ?? new Prisma.Decimal(0)).toString();

        let totalSafeDrops = new Prisma.Decimal(0);
        let tillCount = 0;
        for (const s of shifts) {
          for (const t of s.tillSessions) {
            tillCount++;
            for (const cm of t.cashMovements) {
              if (cm.type === 'SAFE_DROP') totalSafeDrops = totalSafeDrops.add(cm.amount);
            }
          }
        }

        return {
          summary: {
            shiftCount: shifts.length,
            tillCount,
            grossSales: (salesAgg._sum.subtotal ?? new Prisma.Decimal(0)).toString(),
            netSales: (salesAgg._sum.total ?? new Prisma.Decimal(0)).toString(),
            taxTotal: (salesAgg._sum.tax ?? new Prisma.Decimal(0)).toString(),
            discountTotal: (salesAgg._sum.discount ?? new Prisma.Decimal(0)).toString(),
            orderCount: salesAgg._count ?? 0,
            paymentBreakdown,
            refundTotal: (refundAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
            refundCount: refundAgg._count ?? 0,
            safeDropTotal: totalSafeDrops.toString(),
          },
          rowCount: shifts.length + tillCount,
        };
      },
    );
  }

  async generateDailySalesReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'DAILY_SALES',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const salesAgg = await this.prisma.order.aggregate({
          where: {
            orgId,
            branchId,
            status: { in: ['CLOSED', 'SERVED'] },
            createdAt: { gte: range.start, lt: range.end },
          },
          _sum: { subtotal: true, total: true, tax: true, discount: true },
          _count: true,
          _avg: { total: true },
        });
        const payments = await this.prisma.payment.groupBy({
          by: ['method'],
          where: {
            orgId,
            branchId,
            status: 'COMPLETED',
            createdAt: { gte: range.start, lt: range.end },
          },
          _sum: { amount: true },
        });
        const refundAgg = await this.prisma.refund.aggregate({
          where: {
            orgId,
            branchId,
            status: 'COMPLETED',
            createdAt: { gte: range.start, lt: range.end },
          },
          _sum: { amount: true },
          _count: true,
        });
        const paymentBreakdown: Record<string, string> = {};
        for (const p of payments)
          paymentBreakdown[p.method] = (p._sum.amount ?? new Prisma.Decimal(0)).toString();

        return {
          summary: {
            grossSales: (salesAgg._sum.subtotal ?? new Prisma.Decimal(0)).toString(),
            netSales: (salesAgg._sum.total ?? new Prisma.Decimal(0)).toString(),
            taxTotal: (salesAgg._sum.tax ?? new Prisma.Decimal(0)).toString(),
            discountTotal: (salesAgg._sum.discount ?? new Prisma.Decimal(0)).toString(),
            orderCount: salesAgg._count ?? 0,
            avgOrderValue: (salesAgg._avg.total ?? new Prisma.Decimal(0)).toString(),
            paymentBreakdown,
            refundTotal: (refundAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
            refundCount: refundAgg._count ?? 0,
          },
          rowCount: salesAgg._count ?? 0,
        };
      },
    );
  }

  async generatePaymentMixReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'PAYMENT_MIX',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const payments = await this.prisma.payment.groupBy({
          by: ['method'],
          where: {
            orgId,
            branchId,
            status: 'COMPLETED',
            createdAt: { gte: range.start, lt: range.end },
          },
          _sum: { amount: true },
          _count: true,
        });
        const totalAmount = payments.reduce(
          (acc, p) => acc.add(p._sum.amount ?? new Prisma.Decimal(0)),
          new Prisma.Decimal(0),
        );
        const breakdown = payments.map((p) => ({
          method: p.method,
          amount: (p._sum.amount ?? new Prisma.Decimal(0)).toString(),
          count: p._count ?? 0,
          percentage: totalAmount.gt(0)
            ? new Prisma.Decimal(p._sum.amount ?? 0).div(totalAmount).mul(100).toFixed(2)
            : '0.00',
        }));
        return {
          summary: { totalAmount: totalAmount.toString(), breakdown },
          rowCount: payments.length,
        };
      },
    );
  }

  async generateTopItemsReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    limit = 20,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'TOP_ITEMS',
      reportWindow,
      dateFrom,
      dateTo,
      { ...(parameters ?? {}), limit },
      async (range) => {
        const items = await this.prisma.orderItem.groupBy({
          by: ['menuItemId'],
          where: {
            order: {
              orgId,
              branchId,
              status: { in: ['CLOSED', 'SERVED'] },
              createdAt: { gte: range.start, lt: range.end },
            },
          },
          _sum: { quantity: true, subtotal: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: limit,
        });
        const menuItemIds = items.map((i) => i.menuItemId);
        const menuItems = await this.prisma.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          select: { id: true, name: true },
        });
        const nameMap = new Map(menuItems.map((m) => [m.id, m.name]));
        const topItems = items.map((i) => ({
          menuItemId: i.menuItemId,
          name: nameMap.get(i.menuItemId) ?? 'Unknown',
          quantitySold: i._sum.quantity ?? 0,
          grossSales: (i._sum.subtotal ?? new Prisma.Decimal(0)).toString(),
        }));
        return { summary: { topItems, totalUniqueItems: items.length }, rowCount: items.length };
      },
    );
  }

  // ── Sales by Category / PMIX ──

  async generateSalesByCategoryReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'SALES_BY_CATEGORY',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const items = await this.prisma.orderItem.findMany({
          where: {
            order: {
              orgId,
              branchId,
              status: { in: ['CLOSED', 'SERVED'] },
              createdAt: { gte: range.start, lt: range.end },
            },
          },
          include: { menuItem: { select: { id: true, name: true, categoryId: true } } },
        });
        const categoryIds = [...new Set(items.map((i) => i.menuItem.categoryId))];
        const categories = await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        });
        const catNameMap = new Map(categories.map((c) => [c.id, c.name]));

        const byCat = new Map<
          string,
          { name: string; qty: number; sales: Prisma.Decimal; itemCount: number }
        >();
        for (const item of items) {
          const catId = item.menuItem.categoryId;
          const existing = byCat.get(catId) ?? {
            name: catNameMap.get(catId) ?? 'Unknown',
            qty: 0,
            sales: new Prisma.Decimal(0),
            itemCount: 0,
          };
          existing.qty += item.quantity;
          existing.sales = existing.sales.add(item.subtotal);
          existing.itemCount++;
          byCat.set(catId, existing);
        }

        const totalSales = items.reduce((acc, i) => acc.add(i.subtotal), new Prisma.Decimal(0));
        const breakdown = Array.from(byCat.entries())
          .map(([catId, data]) => ({
            categoryId: catId,
            categoryName: data.name,
            quantitySold: data.qty,
            grossSales: data.sales.toString(),
            lineItems: data.itemCount,
            percentage: totalSales.gt(0) ? data.sales.div(totalSales).mul(100).toFixed(2) : '0.00',
          }))
          .sort((a, b) => Number(b.grossSales) - Number(a.grossSales));

        return {
          summary: { totalSales: totalSales.toString(), categories: breakdown },
          rowCount: breakdown.length,
        };
      },
    );
  }

  // ── Sales by Hour / Daypart ──

  async generateSalesByHourReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'SALES_BY_HOUR',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const orders = await this.prisma.order.findMany({
          where: {
            orgId,
            branchId,
            status: { in: ['CLOSED', 'SERVED'] },
            createdAt: { gte: range.start, lt: range.end },
          },
          select: { total: true, createdAt: true },
        });

        const byHour = new Map<number, { count: number; sales: Prisma.Decimal }>();
        for (let h = 0; h < 24; h++) byHour.set(h, { count: 0, sales: new Prisma.Decimal(0) });
        for (const o of orders) {
          const hour = o.createdAt.getHours();
          const entry = byHour.get(hour)!;
          entry.count++;
          entry.sales = entry.sales.add(o.total);
        }

        const hourlyBreakdown = Array.from(byHour.entries()).map(([hour, data]) => ({
          hour,
          label: `${String(hour).padStart(2, '0')}:00`,
          orderCount: data.count,
          sales: data.sales.toString(),
        }));

        const peakHour = hourlyBreakdown.reduce(
          (best, cur) => (Number(cur.sales) > Number(best.sales) ? cur : best),
          hourlyBreakdown[0],
        );
        return {
          summary: {
            hourlyBreakdown,
            totalOrders: orders.length,
            peakHour: peakHour.label,
            peakSales: peakHour.sales,
          },
          rowCount: orders.length,
        };
      },
    );
  }

  // ── Open vs Closed Orders Summary ──

  async generateOpenClosedOrdersReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'OPEN_CLOSED_ORDERS',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const orders = await this.prisma.order.groupBy({
          by: ['status'],
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
          _count: true,
          _sum: { total: true },
        });
        const breakdown = orders.map((o) => ({
          status: o.status,
          count: o._count,
          totalValue: (o._sum.total ?? new Prisma.Decimal(0)).toString(),
        }));
        const totalOrders = breakdown.reduce((acc, b) => acc + b.count, 0);
        return { summary: { breakdown, totalOrders }, rowCount: totalOrders };
      },
    );
  }

  // ═══════════════════════════════════════════
  //  B) DISCOUNT / VOID / REFUND REPORTS
  // ═══════════════════════════════════════════

  async generateDiscountsSummaryReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'DISCOUNTS_SUMMARY',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const discounts = await this.prisma.discount.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
          include: { createdBy: { select: { id: true, email: true } } },
        });
        const byStatus: Record<string, number> = {};
        const byType: Record<string, { count: number; total: Prisma.Decimal }> = {};
        const byActor = new Map<string, { email: string; count: number; total: Prisma.Decimal }>();
        let grandTotal = new Prisma.Decimal(0);

        for (const d of discounts) {
          byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
          const key = d.type;
          byType[key] = byType[key] ?? { count: 0, total: new Prisma.Decimal(0) };
          byType[key].count++;
          byType[key].total = byType[key].total.add(d.value);
          grandTotal = grandTotal.add(d.value);

          const existing = byActor.get(d.createdById) ?? {
            email: d.createdBy.email,
            count: 0,
            total: new Prisma.Decimal(0),
          };
          existing.count++;
          existing.total = existing.total.add(d.value);
          byActor.set(d.createdById, existing);
        }

        const typeBreakdown = Object.entries(byType).map(([type, data]) => ({
          type,
          count: data.count,
          total: data.total.toString(),
        }));
        const actorBreakdown = Array.from(byActor.entries())
          .map(([userId, data]) => ({
            userId,
            email: data.email,
            count: data.count,
            total: data.total.toString(),
          }))
          .sort((a, b) => Number(b.total) - Number(a.total));

        return {
          summary: {
            totalDiscounts: discounts.length,
            grandTotal: grandTotal.toString(),
            byStatus,
            typeBreakdown,
            actorBreakdown,
          },
          rowCount: discounts.length,
        };
      },
    );
  }

  async generateVoidsSummaryReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'VOIDS_SUMMARY',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const voidedOrders = await this.prisma.order.findMany({
          where: {
            orgId,
            branchId,
            status: 'VOIDED',
            updatedAt: { gte: range.start, lt: range.end },
          },
          include: { user: { select: { id: true, email: true } } },
        });
        const byActor = new Map<string, { email: string; count: number; total: Prisma.Decimal }>();
        let grandTotal = new Prisma.Decimal(0);

        for (const o of voidedOrders) {
          grandTotal = grandTotal.add(o.total);
          const existing = byActor.get(o.userId) ?? {
            email: o.user.email,
            count: 0,
            total: new Prisma.Decimal(0),
          };
          existing.count++;
          existing.total = existing.total.add(o.total);
          byActor.set(o.userId, existing);
        }

        const actorBreakdown = Array.from(byActor.entries())
          .map(([userId, data]) => ({
            userId,
            email: data.email,
            count: data.count,
            total: data.total.toString(),
          }))
          .sort((a, b) => Number(b.total) - Number(a.total));

        return {
          summary: {
            totalVoids: voidedOrders.length,
            grandTotal: grandTotal.toString(),
            actorBreakdown,
          },
          rowCount: voidedOrders.length,
        };
      },
    );
  }

  async generateRefundsSummaryReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'REFUNDS_SUMMARY',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const refunds = await this.prisma.refund.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
          include: { createdBy: { select: { id: true, email: true } } },
        });
        const byStatus: Record<string, number> = {};
        const byActor = new Map<string, { email: string; count: number; total: Prisma.Decimal }>();
        let grandTotal = new Prisma.Decimal(0);

        for (const r of refunds) {
          byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
          grandTotal = grandTotal.add(r.amount);
          const existing = byActor.get(r.createdById) ?? {
            email: r.createdBy.email,
            count: 0,
            total: new Prisma.Decimal(0),
          };
          existing.count++;
          existing.total = existing.total.add(r.amount);
          byActor.set(r.createdById, existing);
        }

        const actorBreakdown = Array.from(byActor.entries())
          .map(([userId, data]) => ({
            userId,
            email: data.email,
            count: data.count,
            total: data.total.toString(),
          }))
          .sort((a, b) => Number(b.total) - Number(a.total));

        return {
          summary: {
            totalRefunds: refunds.length,
            grandTotal: grandTotal.toString(),
            byStatus,
            actorBreakdown,
          },
          rowCount: refunds.length,
        };
      },
    );
  }

  // ═══════════════════════════════════════════
  //  C) CASH / TILL / SHIFT CONTROL REPORTS
  // ═══════════════════════════════════════════

  async generateCashVarianceReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'CASH_VARIANCE',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const tills = await this.prisma.tillSession.findMany({
          where: {
            orgId,
            branchId,
            status: 'CLOSED',
            closedAt: { gte: range.start, lt: range.end },
          },
          include: { operatorUser: { select: { id: true, email: true } } },
        });

        const tillBreakdown = tills.map((t) => ({
          tillId: t.id,
          tillCode: t.tillCode,
          operatorEmail: t.operatorUser.email,
          openingFloat: t.openingFloat.toString(),
          expectedCash: t.expectedCash.toString(),
          countedCash: t.countedCash?.toString() ?? null,
          variance: t.variance?.toString() ?? null,
          varianceStatus: t.varianceStatus,
        }));

        const totalVariance = tills.reduce(
          (acc, t) => acc.add(t.variance ?? new Prisma.Decimal(0)),
          new Prisma.Decimal(0),
        );

        return {
          summary: {
            tillCount: tills.length,
            totalVariance: totalVariance.toString(),
            tillBreakdown,
          },
          rowCount: tills.length,
        };
      },
    );
  }

  async generateCashMovementsReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'CASH_MOVEMENTS',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const movements = await this.prisma.cashMovement.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
          include: { createdBy: { select: { id: true, email: true } } },
        });
        const byType = new Map<string, { count: number; total: Prisma.Decimal }>();
        for (const m of movements) {
          const existing = byType.get(m.type) ?? { count: 0, total: new Prisma.Decimal(0) };
          existing.count++;
          existing.total = existing.total.add(m.amount);
          byType.set(m.type, existing);
        }
        const typeBreakdown = Array.from(byType.entries()).map(([type, data]) => ({
          type,
          count: data.count,
          total: data.total.toString(),
        }));
        return {
          summary: { totalMovements: movements.length, typeBreakdown },
          rowCount: movements.length,
        };
      },
    );
  }

  // ═══════════════════════════════════════════
  //  D) INVENTORY / STOCK CONTROL REPORTS
  // ═══════════════════════════════════════════

  async generateStockVarianceReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'STOCK_VARIANCE',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const adjustments = await this.prisma.stockAdjustment.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
          include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
        });
        const byItem = new Map<
          string,
          {
            name: string;
            unit: string;
            positive: Prisma.Decimal;
            negative: Prisma.Decimal;
            count: number;
          }
        >();
        for (const adj of adjustments) {
          const existing = byItem.get(adj.itemId) ?? {
            name: adj.inventoryItem.name,
            unit: adj.inventoryItem.unit,
            positive: new Prisma.Decimal(0),
            negative: new Prisma.Decimal(0),
            count: 0,
          };
          existing.count++;
          if (adj.qtyDelta.gt(0)) existing.positive = existing.positive.add(adj.qtyDelta);
          else existing.negative = existing.negative.add(adj.qtyDelta.abs());
          byItem.set(adj.itemId, existing);
        }
        const varianceItems = Array.from(byItem.entries()).map(([itemId, data]) => ({
          inventoryItemId: itemId,
          name: data.name,
          unit: data.unit,
          positiveAdjustments: data.positive.toString(),
          negativeAdjustments: data.negative.toString(),
          netChange: data.positive.sub(data.negative).toString(),
          adjustmentCount: data.count,
        }));
        return {
          summary: {
            totalAdjustments: adjustments.length,
            itemsAffected: byItem.size,
            varianceItems,
          },
          rowCount: adjustments.length,
        };
      },
    );
  }

  async generateWastageReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'WASTAGE_SUMMARY',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const adjustments = await this.prisma.stockAdjustment.findMany({
          where: {
            orgId,
            branchId,
            qtyDelta: { lt: 0 },
            createdAt: { gte: range.start, lt: range.end },
          },
          include: {
            inventoryItem: {
              select: { id: true, name: true, unit: true, theoreticalUnitCost: true },
            },
          },
        });
        const byItem = new Map<
          string,
          {
            name: string;
            unit: string;
            qty: Prisma.Decimal;
            estimatedCost: Prisma.Decimal;
            count: number;
          }
        >();
        for (const adj of adjustments) {
          const existing = byItem.get(adj.itemId) ?? {
            name: adj.inventoryItem.name,
            unit: adj.inventoryItem.unit,
            qty: new Prisma.Decimal(0),
            estimatedCost: new Prisma.Decimal(0),
            count: 0,
          };
          existing.count++;
          const absQty = adj.qtyDelta.abs();
          existing.qty = existing.qty.add(absQty);
          existing.estimatedCost = existing.estimatedCost.add(
            absQty.mul(adj.inventoryItem.theoreticalUnitCost ?? new Prisma.Decimal(0)),
          );
          byItem.set(adj.itemId, existing);
        }
        const wastageItems = Array.from(byItem.entries())
          .map(([itemId, data]) => ({
            inventoryItemId: itemId,
            name: data.name,
            unit: data.unit,
            totalWastedQty: data.qty.toString(),
            estimatedCost: data.estimatedCost.toString(),
            adjustmentCount: data.count,
          }))
          .sort((a, b) => Number(b.estimatedCost) - Number(a.estimatedCost));
        const totalCost = wastageItems.reduce(
          (acc, w) => acc.add(new Prisma.Decimal(w.estimatedCost)),
          new Prisma.Decimal(0),
        );
        return {
          summary: {
            totalWastageAdjustments: adjustments.length,
            itemsAffected: byItem.size,
            totalEstimatedCost: totalCost.toString(),
            wastageItems,
          },
          rowCount: adjustments.length,
        };
      },
    );
  }

  async generateLowStockReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'LOW_STOCK',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async () => {
        const items = await this.prisma.inventoryItem.findMany({
          where: { orgId, branchId, isActive: true },
          select: {
            id: true,
            name: true,
            unit: true,
            reorderLevel: true,
            reorderQty: true,
            stockBatches: { select: { remainingQty: true } },
          },
        });
        const lowStockItems = items
          .map((item) => {
            const currentStock = item.stockBatches.reduce(
              (acc, b) => acc.add(b.remainingQty),
              new Prisma.Decimal(0),
            );
            return {
              inventoryItemId: item.id,
              name: item.name,
              unit: item.unit,
              currentStock: currentStock.toString(),
              reorderLevel: item.reorderLevel?.toString() ?? null,
              reorderQty: item.reorderQty?.toString() ?? null,
              belowReorderLevel: item.reorderLevel ? currentStock.lt(item.reorderLevel) : false,
            };
          })
          .filter((i) => i.belowReorderLevel);

        return {
          summary: { totalLowStockItems: lowStockItems.length, lowStockItems },
          rowCount: lowStockItems.length,
        };
      },
    );
  }

  // ═══════════════════════════════════════════
  //  E) RESERVATION / DEPOSIT REPORTS
  // ═══════════════════════════════════════════

  async generateReservationSummaryReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'RESERVATION_SUMMARY',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const reservations = await this.prisma.reservation.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
        });
        const byStatus: Record<string, number> = {};
        let totalPartySize = 0;
        for (const r of reservations) {
          byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
          totalPartySize += r.partySize;
        }
        const seated = reservations.filter((r) => r.seatedAt).length;
        const conversionRate =
          reservations.length > 0 ? ((seated / reservations.length) * 100).toFixed(2) : '0.00';
        return {
          summary: {
            totalReservations: reservations.length,
            byStatus,
            totalPartySize,
            avgPartySize:
              reservations.length > 0 ? (totalPartySize / reservations.length).toFixed(1) : '0',
            seatedCount: seated,
            conversionRate,
          },
          rowCount: reservations.length,
        };
      },
    );
  }

  async generateReservationDepositsReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'RESERVATION_DEPOSITS',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const deposits = await this.prisma.reservationDeposit.findMany({
          where: { orgId, branchId, recordedAt: { gte: range.start, lt: range.end } },
        });
        const byStatus: Record<string, { count: number; total: Prisma.Decimal }> = {};
        let grandTotal = new Prisma.Decimal(0);
        for (const d of deposits) {
          byStatus[d.status] = byStatus[d.status] ?? { count: 0, total: new Prisma.Decimal(0) };
          byStatus[d.status].count++;
          byStatus[d.status].total = byStatus[d.status].total.add(d.amount);
          grandTotal = grandTotal.add(d.amount);
        }
        const statusBreakdown = Object.entries(byStatus).map(([status, data]) => ({
          status,
          count: data.count,
          total: data.total.toString(),
        }));
        return {
          summary: {
            totalDeposits: deposits.length,
            grandTotal: grandTotal.toString(),
            statusBreakdown,
          },
          rowCount: deposits.length,
        };
      },
    );
  }

  async generateReservationNoShowsReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'RESERVATION_NO_SHOWS',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const noShows = await this.prisma.reservation.findMany({
          where: {
            orgId,
            branchId,
            status: 'NO_SHOW',
            noShowAt: { gte: range.start, lt: range.end },
          },
        });
        const cancelled = await this.prisma.reservation.count({
          where: {
            orgId,
            branchId,
            status: 'CANCELLED',
            cancelledAt: { gte: range.start, lt: range.end },
          },
        });
        const totalReservations = await this.prisma.reservation.count({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
        });
        const totalNoShowPartySize = noShows.reduce((acc, r) => acc + r.partySize, 0);
        return {
          summary: {
            noShowCount: noShows.length,
            cancelledCount: cancelled,
            totalReservations,
            noShowRate:
              totalReservations > 0
                ? ((noShows.length / totalReservations) * 100).toFixed(2)
                : '0.00',
            totalNoShowPartySize,
          },
          rowCount: noShows.length + cancelled,
        };
      },
    );
  }

  // ═══════════════════════════════════════════
  //  F) EVENT / TICKETING REPORTS
  // ═══════════════════════════════════════════

  async generateEventSummaryReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'EVENT_SUMMARY',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const events = await this.prisma.event.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
          include: { bookings: true },
        });
        const byStatus: Record<string, number> = {};
        let totalCapacity = 0;
        let totalSold = 0;
        let totalCheckedIn = 0;
        for (const e of events) {
          byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
          totalCapacity += e.capacity;
          totalSold += e.soldCount;
          totalCheckedIn += e.checkedInCount;
        }
        return {
          summary: {
            totalEvents: events.length,
            byStatus,
            totalCapacity,
            totalSold,
            totalCheckedIn,
            overallUtilization:
              totalCapacity > 0 ? ((totalSold / totalCapacity) * 100).toFixed(2) : '0.00',
          },
          rowCount: events.length,
        };
      },
    );
  }

  async generateEventBookingsReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'EVENT_BOOKINGS',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const bookings = await this.prisma.eventBooking.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
        });
        const byStatus: Record<string, number> = {};
        let totalRevenue = new Prisma.Decimal(0);
        let totalQuantity = 0;
        for (const b of bookings) {
          byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
          totalRevenue = totalRevenue.add(b.subtotal);
          totalQuantity += b.quantity;
        }
        return {
          summary: {
            totalBookings: bookings.length,
            byStatus,
            totalRevenue: totalRevenue.toString(),
            totalQuantity,
          },
          rowCount: bookings.length,
        };
      },
    );
  }

  async generateEventCheckinsReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'EVENT_CHECKINS',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const checkins = await this.prisma.eventCheckIn.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
        });
        const byStatus: Record<string, number> = {};
        for (const c of checkins) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
        return {
          summary: { totalCheckins: checkins.length, byStatus },
          rowCount: checkins.length,
        };
      },
    );
  }

  // ═══════════════════════════════════════════
  //  G) RISK / ANOMALY REPORTS
  // ═══════════════════════════════════════════

  async generateAnomalySummaryReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'ANOMALY_SUMMARY',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const anomalies = await this.prisma.anomalyEvent.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
        });
        const byStatus: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        const byType: Record<string, number> = {};
        for (const a of anomalies) {
          byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
          bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
          byType[a.type] = (byType[a.type] ?? 0) + 1;
        }
        return {
          summary: { totalAnomalies: anomalies.length, byStatus, bySeverity, byType },
          rowCount: anomalies.length,
        };
      },
    );
  }

  async generateHighRiskActorsReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'HIGH_RISK_ACTORS',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        const anomalies = await this.prisma.anomalyEvent.findMany({
          where: {
            orgId,
            branchId,
            actorUserId: { not: null },
            createdAt: { gte: range.start, lt: range.end },
          },
        });
        const byActor = new Map<string, { count: number; highCount: number; types: Set<string> }>();
        for (const a of anomalies) {
          const uid = a.actorUserId!;
          const existing = byActor.get(uid) ?? { count: 0, highCount: 0, types: new Set() };
          existing.count++;
          if (a.severity === 'HIGH' || a.severity === 'CRITICAL') existing.highCount++;
          existing.types.add(a.type);
          byActor.set(uid, existing);
        }
        const actors = Array.from(byActor.entries())
          .map(([userId, data]) => ({
            userId,
            totalAnomalies: data.count,
            highSeverityCount: data.highCount,
            anomalyTypes: Array.from(data.types),
          }))
          .sort((a, b) => b.totalAnomalies - a.totalAnomalies);

        return {
          summary: { totalActorsWithAnomalies: actors.length, actors },
          rowCount: actors.length,
        };
      },
    );
  }

  // ═══════════════════════════════════════════
  //  H) STAFF OPERATIONS REPORT
  // ═══════════════════════════════════════════

  async generateStaffOperationsReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    return this.executeReport(
      orgId,
      branchId,
      requestedById,
      'STAFF_OPERATIONS',
      reportWindow,
      dateFrom,
      dateTo,
      parameters,
      async (range) => {
        // Sales by staff
        const orders = await this.prisma.order.findMany({
          where: {
            orgId,
            branchId,
            status: { in: ['CLOSED', 'SERVED'] },
            createdAt: { gte: range.start, lt: range.end },
          },
          select: { userId: true, total: true },
        });
        // Refunds by staff
        const refunds = await this.prisma.refund.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
          select: { createdById: true, amount: true },
        });
        // Discounts by staff
        const discounts = await this.prisma.discount.findMany({
          where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
          select: { createdById: true, value: true },
        });
        // Voided orders by staff
        const voids = await this.prisma.order.findMany({
          where: {
            orgId,
            branchId,
            status: 'VOIDED',
            updatedAt: { gte: range.start, lt: range.end },
          },
          select: { userId: true, total: true },
        });

        const staffMap = new Map<
          string,
          {
            salesCount: number;
            salesTotal: Prisma.Decimal;
            refundCount: number;
            refundTotal: Prisma.Decimal;
            discountCount: number;
            discountTotal: Prisma.Decimal;
            voidCount: number;
            voidTotal: Prisma.Decimal;
          }
        >();
        const getOrCreate = (uid: string) => {
          if (!staffMap.has(uid))
            staffMap.set(uid, {
              salesCount: 0,
              salesTotal: new Prisma.Decimal(0),
              refundCount: 0,
              refundTotal: new Prisma.Decimal(0),
              discountCount: 0,
              discountTotal: new Prisma.Decimal(0),
              voidCount: 0,
              voidTotal: new Prisma.Decimal(0),
            });
          return staffMap.get(uid)!;
        };

        for (const o of orders) {
          const s = getOrCreate(o.userId);
          s.salesCount++;
          s.salesTotal = s.salesTotal.add(o.total);
        }
        for (const r of refunds) {
          const s = getOrCreate(r.createdById);
          s.refundCount++;
          s.refundTotal = s.refundTotal.add(r.amount);
        }
        for (const d of discounts) {
          const s = getOrCreate(d.createdById);
          s.discountCount++;
          s.discountTotal = s.discountTotal.add(d.value);
        }
        for (const v of voids) {
          const s = getOrCreate(v.userId);
          s.voidCount++;
          s.voidTotal = s.voidTotal.add(v.total);
        }

        // Fetch user emails
        const userIds = Array.from(staffMap.keys());
        const users = await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        });
        const emailMap = new Map(users.map((u) => [u.id, u.email]));

        const staffBreakdown = Array.from(staffMap.entries())
          .map(([userId, data]) => ({
            userId,
            email: emailMap.get(userId) ?? 'Unknown',
            salesCount: data.salesCount,
            salesTotal: data.salesTotal.toString(),
            refundCount: data.refundCount,
            refundTotal: data.refundTotal.toString(),
            discountCount: data.discountCount,
            discountTotal: data.discountTotal.toString(),
            voidCount: data.voidCount,
            voidTotal: data.voidTotal.toString(),
          }))
          .sort((a, b) => Number(b.salesTotal) - Number(a.salesTotal));

        return {
          summary: { staffCount: staffBreakdown.length, staffBreakdown },
          rowCount: staffBreakdown.length,
        };
      },
    );
  }

  // ═══════════════════════════════════════════
  //  REPORT CATALOG
  // ═══════════════════════════════════════════

  getReportCatalog(): CatalogEntry[] {
    return [
      // A) Core Sales / Revenue
      {
        key: 'SHIFT_END',
        title: 'Shift-End Report',
        description: 'Shift/till counts, gross/net sales, payment breakdown, refunds, safe drops',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:shift-end:generate',
      },
      {
        key: 'DAILY_SALES',
        title: 'Daily Sales Report',
        description: 'Gross/net sales, tax, discounts, order count, AOV, payment mix',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:daily-sales:generate',
      },
      {
        key: 'PAYMENT_MIX',
        title: 'Payment Mix Report',
        description: 'Payment method breakdown with amounts, counts, percentages',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:payment-mix:generate',
      },
      {
        key: 'TOP_ITEMS',
        title: 'Top Items Report',
        description: 'Top-N items by quantity sold and gross sales contribution',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:top-items:generate',
      },
      {
        key: 'SALES_BY_CATEGORY',
        title: 'Sales by Category / PMIX Report',
        description: 'Sales breakdown by menu category with percentages',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:sales-by-category:generate',
      },
      {
        key: 'SALES_BY_HOUR',
        title: 'Sales by Hour / Daypart Report',
        description: 'Hourly sales distribution with peak identification',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:sales-by-hour:generate',
      },
      {
        key: 'OPEN_CLOSED_ORDERS',
        title: 'Open vs Closed Orders Summary',
        description: 'Order status distribution with value totals',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:daily-sales:generate',
        notes: 'Uses daily-sales permission',
      },

      // B) Discount / Void / Refund
      {
        key: 'DISCOUNTS_SUMMARY',
        title: 'Discounts Summary Report',
        description: 'All discounts by type, status, actor with amounts',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:discounts:generate',
      },
      {
        key: 'VOIDS_SUMMARY',
        title: 'Voids Summary Report',
        description: 'Voided orders by actor with value totals',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:voids:generate',
      },
      {
        key: 'REFUNDS_SUMMARY',
        title: 'Refunds Summary Report',
        description: 'Refund breakdown by status, actor with amounts',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:refunds:generate',
      },

      // C) Cash / Till / Shift Control
      {
        key: 'CASH_VARIANCE',
        title: 'Till Cash Variance Report',
        description: 'Till reconciliation variance by operator',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:cash-variance:generate',
      },
      {
        key: 'CASH_MOVEMENTS',
        title: 'Cash Movements Report',
        description: 'Cash movement breakdown by type (safe drops, pickups, etc.)',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:cash-movements:generate',
      },

      // D) Inventory / Stock Control
      {
        key: 'STOCK_VARIANCE',
        title: 'Stock Variance Report',
        description: 'Positive/negative adjustments, net change per item',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:stock-variance:generate',
      },
      {
        key: 'WASTAGE_SUMMARY',
        title: 'Wastage / Shrinkage Report',
        description: 'Negative stock adjustments with estimated cost impact',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:wastage:generate',
      },
      {
        key: 'LOW_STOCK',
        title: 'Low Stock / Reorder Report',
        description: 'Items below reorder point with current stock levels',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:low-stock:generate',
      },

      // E) Reservation / Deposit
      {
        key: 'RESERVATION_SUMMARY',
        title: 'Reservations Summary Report',
        description: 'Reservation counts by status, party sizes, conversion rate',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:reservations:generate',
      },
      {
        key: 'RESERVATION_DEPOSITS',
        title: 'Reservation Deposits Report',
        description: 'Deposit amounts by status with totals',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:reservations:generate',
      },
      {
        key: 'RESERVATION_NO_SHOWS',
        title: 'No-Show / Cancellation Report',
        description: 'No-show and cancellation counts with rates',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:reservations:generate',
      },

      // F) Event / Ticketing
      {
        key: 'EVENT_SUMMARY',
        title: 'Event Summary Report',
        description: 'Events by status, capacity utilization, sold/checked-in counts',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:events:generate',
      },
      {
        key: 'EVENT_BOOKINGS',
        title: 'Event Bookings Report',
        description: 'Booking breakdown by status with revenue and quantity',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:events:generate',
      },
      {
        key: 'EVENT_CHECKINS',
        title: 'Event Check-Ins Report',
        description: 'Check-in / denied-check-in counts by status',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:events:generate',
      },

      // G) Risk / Anomaly
      {
        key: 'ANOMALY_SUMMARY',
        title: 'Anomaly Summary Report',
        description: 'Anomaly totals by status, severity, type',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:anomaly-summary:generate',
      },
      {
        key: 'HIGH_RISK_ACTORS',
        title: 'High-Risk Actors Report',
        description: 'Staff with most anomaly events, severity breakdown',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:anomaly-summary:generate',
      },

      // H) Staff Operations
      {
        key: 'STAFF_OPERATIONS',
        title: 'Staff Operations Report',
        description: 'Per-staff sales, refunds, voids, discounts handled',
        status: 'IMPLEMENTED',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:staff-operations:generate',
      },

      // ── CONDITIONAL (implemented only if source data is reliable) ──
      {
        key: 'MENU_ENGINEERING',
        title: 'Menu Engineering Report',
        description: 'Margin vs popularity analysis using recipe cost + sales data',
        status: 'CONDITIONAL',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:sales-by-category:generate',
        notes: 'Depends on M8 recipe costing data quality. Not all items may have cost data.',
      },

      // ── PENDING LATER ──
      {
        key: 'CUSTOMER_FEEDBACK',
        title: 'Customer Feedback Trends',
        description: 'Feedback trends, NPS, complaint themes',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M25 — Customer Feedback + NPS + QR Follow-up',
      },
      {
        key: 'DOCUMENT_EXPORT_PACKS',
        title: 'Document Export Packs',
        description: 'Invoice/receipt attachment bundles, evidence bundles',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M26 — Documents + Uploads + Attachments',
      },
      {
        key: 'LABOR_HOURS',
        title: 'Labor Hours Report',
        description: 'Attendance, overtime, leave, shift hours worked',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M27-M30 — HR / Attendance / Scheduling / Payroll',
      },
      {
        key: 'PAYROLL_SUMMARY',
        title: 'Payroll Run Summary',
        description: 'Pay periods, gross/net pay, deductions, tax',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M30 — Payroll Engine + Pay Runs + Payslips',
      },
      {
        key: 'PROFIT_AND_LOSS',
        title: 'P&L / Income Statement',
        description: 'Revenue, expenses, net income by period',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M32-M37 — Accounting Foundation + GL + AP/AR',
      },
      {
        key: 'BALANCE_SHEET',
        title: 'Balance Sheet',
        description: 'Assets, liabilities, equity snapshot',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M32-M37 — Accounting Foundation + GL + AP/AR',
      },
      {
        key: 'CASH_FLOW',
        title: 'Cash Flow Statement',
        description: 'Operating, investing, financing cash flow',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M32-M37 — Accounting Foundation + GL + AP/AR',
      },
      {
        key: 'AP_AGING',
        title: 'Accounts Payable Aging',
        description: 'Vendor bills by aging bucket',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M34 — Accounts Payable',
      },
      {
        key: 'AR_AGING',
        title: 'Accounts Receivable Aging',
        description: 'Customer invoices by aging bucket',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M35 — Accounts Receivable',
      },
      {
        key: 'BUDGET_VS_ACTUAL',
        title: 'Budget vs Actual',
        description: 'Planned vs actual by GL account and cost center',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M37 — Budgets + Forecasts',
      },
      {
        key: 'FRANCHISE_ROLLUP',
        title: 'Franchise / Multi-Branch Consolidation',
        description: 'Branch league tables, consolidated KPIs',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M38 — Franchise + Multi-Branch Suite',
      },
      {
        key: 'SCHEDULED_DIGEST',
        title: 'Scheduled Report Digest',
        description: 'Daily/weekly automated report delivery to owners',
        status: 'PENDING_LATER',
        formats: ['CSV', 'PDF'],
        permission: 'pos:reports:history:read',
        dependencyMilestone: 'M40 — Alerts + Digests + Real-Time Owner Views',
      },
    ];
  }

  // ═══════════════════════════════════════════
  //  LIST / HISTORY / EXPORT
  // ═══════════════════════════════════════════

  async listReports(
    orgId: string,
    branchId: string | null,
    query: { reportType?: ReportType; status?: ReportRunStatus; page?: number; pageSize?: number },
  ) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const where: any = { orgId };
    if (branchId) where.branchId = branchId;
    if (query.reportType) where.reportType = query.reportType;
    if (query.status) where.status = query.status;
    const [data, total] = await Promise.all([
      this.prisma.reportRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { exportArtifacts: true },
      }),
      this.prisma.reportRun.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async getReportById(orgId: string, reportId: string) {
    const run = await this.prisma.reportRun.findFirst({
      where: { id: reportId, orgId },
      include: { exportArtifacts: true },
    });
    if (!run) throw new NotFoundException('Report run not found');
    return run;
  }

  // ── Export Artifact Creation ──

  async createExport(
    orgId: string,
    branchId: string | null,
    generatedById: string,
    reportRunId: string,
    format: ExportFormat,
  ) {
    const run = await this.prisma.reportRun.findFirst({ where: { id: reportRunId, orgId } });
    if (!run) throw new NotFoundException('Report run not found');
    if (run.status !== 'COMPLETED')
      throw new BadRequestException('Can only export completed reports');

    const mimeType = format === 'CSV' ? 'text/csv' : 'application/pdf';
    const ext = format === 'CSV' ? 'csv' : 'pdf';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${run.reportType.toLowerCase()}_${timestamp}.${ext}`;
    const storagePath = path.join(this.exportDir, fileName);

    const artifact = await this.prisma.exportArtifact.create({
      data: {
        orgId,
        branchId: branchId ?? run.branchId,
        reportRunId,
        format,
        status: 'PENDING',
        fileName,
        mimeType,
        storagePath,
        generatedById,
      },
    });

    await this.audit.log({
      actorUserId: generatedById,
      action: 'EXPORT_ARTIFACT_CREATED',
      entityType: 'ExportArtifact',
      entityId: artifact.id,
      metadata: { reportRunId, format },
    });

    try {
      const content = this.generateExportContent(run, format);
      fs.writeFileSync(storagePath, content);
      const stats = fs.statSync(storagePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      const updated = await this.prisma.exportArtifact.update({
        where: { id: artifact.id },
        data: { status: 'READY', readyAt: new Date(), fileSizeBytes: stats.size, checksum: hash },
      });

      await this.audit.log({
        actorUserId: generatedById,
        action: 'EXPORT_ARTIFACT_READY',
        entityType: 'ExportArtifact',
        entityId: artifact.id,
        metadata: { fileName, fileSizeBytes: stats.size },
      });

      return updated;
    } catch (err) {
      await this.prisma.exportArtifact.update({
        where: { id: artifact.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message },
      });
      throw err;
    }
  }

  // ── Export Content Generation ──

  private generateExportContent(run: any, format: ExportFormat): string {
    const summary = run.summary ?? {};
    if (format === 'CSV') return this.generateCsv(run.reportType, summary);
    return this.generateTextPdf(run.reportType, summary, run);
  }

  private generateCsv(reportType: string, summary: any): string {
    const lines: string[] = [];
    switch (reportType) {
      case 'SHIFT_END':
        lines.push('Metric,Value');
        lines.push(`Shift Count,${summary.shiftCount ?? 0}`);
        lines.push(`Till Count,${summary.tillCount ?? 0}`);
        lines.push(`Gross Sales,${summary.grossSales ?? '0'}`);
        lines.push(`Net Sales,${summary.netSales ?? '0'}`);
        lines.push(`Tax Total,${summary.taxTotal ?? '0'}`);
        lines.push(`Discount Total,${summary.discountTotal ?? '0'}`);
        lines.push(`Order Count,${summary.orderCount ?? 0}`);
        lines.push(`Refund Total,${summary.refundTotal ?? '0'}`);
        lines.push(`Refund Count,${summary.refundCount ?? 0}`);
        lines.push(`Safe Drop Total,${summary.safeDropTotal ?? '0'}`);
        if (summary.paymentBreakdown) {
          for (const [method, amount] of Object.entries(summary.paymentBreakdown))
            lines.push(`Payment (${method}),${amount}`);
        }
        break;
      case 'DAILY_SALES':
        lines.push('Metric,Value');
        lines.push(`Gross Sales,${summary.grossSales ?? '0'}`);
        lines.push(`Net Sales,${summary.netSales ?? '0'}`);
        lines.push(`Tax Total,${summary.taxTotal ?? '0'}`);
        lines.push(`Discount Total,${summary.discountTotal ?? '0'}`);
        lines.push(`Order Count,${summary.orderCount ?? 0}`);
        lines.push(`Avg Order Value,${summary.avgOrderValue ?? '0'}`);
        lines.push(`Refund Total,${summary.refundTotal ?? '0'}`);
        lines.push(`Refund Count,${summary.refundCount ?? 0}`);
        if (summary.paymentBreakdown) {
          for (const [method, amount] of Object.entries(summary.paymentBreakdown))
            lines.push(`Payment (${method}),${amount}`);
        }
        break;
      case 'PAYMENT_MIX':
        lines.push('Method,Amount,Count,Percentage');
        if (summary.breakdown)
          for (const row of summary.breakdown)
            lines.push(`${row.method},${row.amount},${row.count},${row.percentage}%`);
        lines.push(`Total,${summary.totalAmount ?? '0'},,`);
        break;
      case 'TOP_ITEMS':
        lines.push('Rank,Item,Quantity Sold,Gross Sales');
        if (summary.topItems)
          summary.topItems.forEach((item: any, idx: number) =>
            lines.push(`${idx + 1},${item.name},${item.quantitySold},${item.grossSales}`),
          );
        break;
      case 'SALES_BY_CATEGORY':
        lines.push('Category,Quantity Sold,Gross Sales,Line Items,Percentage');
        if (summary.categories)
          for (const c of summary.categories)
            lines.push(
              `${c.categoryName},${c.quantitySold},${c.grossSales},${c.lineItems},${c.percentage}%`,
            );
        lines.push(`Total,,${summary.totalSales ?? '0'},,`);
        break;
      case 'SALES_BY_HOUR':
        lines.push('Hour,Order Count,Sales');
        if (summary.hourlyBreakdown)
          for (const h of summary.hourlyBreakdown)
            lines.push(`${h.label},${h.orderCount},${h.sales}`);
        lines.push(`Peak Hour,${summary.peakHour ?? ''},${summary.peakSales ?? '0'}`);
        break;
      case 'OPEN_CLOSED_ORDERS':
        lines.push('Status,Count,Total Value');
        if (summary.breakdown)
          for (const b of summary.breakdown) lines.push(`${b.status},${b.count},${b.totalValue}`);
        break;
      case 'DISCOUNTS_SUMMARY':
        lines.push('Metric,Value');
        lines.push(`Total Discounts,${summary.totalDiscounts ?? 0}`);
        lines.push(`Grand Total,${summary.grandTotal ?? '0'}`);
        if (summary.typeBreakdown)
          for (const t of summary.typeBreakdown)
            lines.push(`Type ${t.type},${t.count} (${t.total})`);
        if (summary.actorBreakdown) {
          lines.push('');
          lines.push('Actor,Count,Total');
          for (const a of summary.actorBreakdown) lines.push(`${a.email},${a.count},${a.total}`);
        }
        break;
      case 'VOIDS_SUMMARY':
        lines.push('Metric,Value');
        lines.push(`Total Voids,${summary.totalVoids ?? 0}`);
        lines.push(`Grand Total,${summary.grandTotal ?? '0'}`);
        if (summary.actorBreakdown) {
          lines.push('');
          lines.push('Actor,Count,Total');
          for (const a of summary.actorBreakdown) lines.push(`${a.email},${a.count},${a.total}`);
        }
        break;
      case 'REFUNDS_SUMMARY':
        lines.push('Metric,Value');
        lines.push(`Total Refunds,${summary.totalRefunds ?? 0}`);
        lines.push(`Grand Total,${summary.grandTotal ?? '0'}`);
        if (summary.actorBreakdown) {
          lines.push('');
          lines.push('Actor,Count,Total');
          for (const a of summary.actorBreakdown) lines.push(`${a.email},${a.count},${a.total}`);
        }
        break;
      case 'CASH_VARIANCE':
        lines.push(
          'Till Code,Operator,Opening Float,Expected Cash,Counted Cash,Variance,Variance Status',
        );
        if (summary.tillBreakdown)
          for (const t of summary.tillBreakdown)
            lines.push(
              `${t.tillCode},${t.operatorEmail},${t.openingFloat},${t.expectedCash},${t.countedCash ?? ''},${t.variance ?? ''},${t.varianceStatus ?? ''}`,
            );
        lines.push(`Total Variance,,,,,${summary.totalVariance ?? '0'},`);
        break;
      case 'CASH_MOVEMENTS':
        lines.push('Type,Count,Total');
        if (summary.typeBreakdown)
          for (const t of summary.typeBreakdown) lines.push(`${t.type},${t.count},${t.total}`);
        break;
      case 'STOCK_VARIANCE':
        lines.push('Item,Unit,Positive Adjustments,Negative Adjustments,Net Change,Count');
        if (summary.varianceItems)
          for (const item of summary.varianceItems)
            lines.push(
              `${item.name},${item.unit},${item.positiveAdjustments},${item.negativeAdjustments},${item.netChange},${item.adjustmentCount}`,
            );
        break;
      case 'WASTAGE_SUMMARY':
        lines.push('Item,Unit,Wasted Qty,Estimated Cost,Adjustment Count');
        if (summary.wastageItems)
          for (const w of summary.wastageItems)
            lines.push(
              `${w.name},${w.unit},${w.totalWastedQty},${w.estimatedCost},${w.adjustmentCount}`,
            );
        lines.push(`Total Cost,,,${summary.totalEstimatedCost ?? '0'},`);
        break;
      case 'LOW_STOCK':
        lines.push('Item,Unit,Current Stock,Reorder Level,Reorder Qty');
        if (summary.lowStockItems)
          for (const i of summary.lowStockItems)
            lines.push(
              `${i.name},${i.unit},${i.currentStock},${i.reorderLevel ?? ''},${i.reorderQty ?? ''}`,
            );
        break;
      case 'RESERVATION_SUMMARY':
        lines.push('Metric,Value');
        lines.push(`Total Reservations,${summary.totalReservations ?? 0}`);
        lines.push(`Seated Count,${summary.seatedCount ?? 0}`);
        lines.push(`Conversion Rate,${summary.conversionRate ?? '0.00'}%`);
        lines.push(`Avg Party Size,${summary.avgPartySize ?? '0'}`);
        if (summary.byStatus)
          for (const [s, c] of Object.entries(summary.byStatus)) lines.push(`Status ${s},${c}`);
        break;
      case 'RESERVATION_DEPOSITS':
        lines.push('Status,Count,Total');
        if (summary.statusBreakdown)
          for (const s of summary.statusBreakdown) lines.push(`${s.status},${s.count},${s.total}`);
        lines.push(`Grand Total,,${summary.grandTotal ?? '0'}`);
        break;
      case 'RESERVATION_NO_SHOWS':
        lines.push('Metric,Value');
        lines.push(`No-Show Count,${summary.noShowCount ?? 0}`);
        lines.push(`Cancelled Count,${summary.cancelledCount ?? 0}`);
        lines.push(`Total Reservations,${summary.totalReservations ?? 0}`);
        lines.push(`No-Show Rate,${summary.noShowRate ?? '0.00'}%`);
        break;
      case 'EVENT_SUMMARY':
        lines.push('Metric,Value');
        lines.push(`Total Events,${summary.totalEvents ?? 0}`);
        lines.push(`Total Capacity,${summary.totalCapacity ?? 0}`);
        lines.push(`Total Sold,${summary.totalSold ?? 0}`);
        lines.push(`Total Checked In,${summary.totalCheckedIn ?? 0}`);
        lines.push(`Overall Utilization,${summary.overallUtilization ?? '0.00'}%`);
        if (summary.byStatus)
          for (const [s, c] of Object.entries(summary.byStatus)) lines.push(`Status ${s},${c}`);
        break;
      case 'EVENT_BOOKINGS':
        lines.push('Metric,Value');
        lines.push(`Total Bookings,${summary.totalBookings ?? 0}`);
        lines.push(`Total Revenue,${summary.totalRevenue ?? '0'}`);
        lines.push(`Total Quantity,${summary.totalQuantity ?? 0}`);
        if (summary.byStatus)
          for (const [s, c] of Object.entries(summary.byStatus)) lines.push(`Status ${s},${c}`);
        break;
      case 'EVENT_CHECKINS':
        lines.push('Metric,Value');
        lines.push(`Total Check-Ins,${summary.totalCheckins ?? 0}`);
        if (summary.byStatus)
          for (const [s, c] of Object.entries(summary.byStatus)) lines.push(`Status ${s},${c}`);
        break;
      case 'ANOMALY_SUMMARY':
        lines.push('Metric,Value');
        lines.push(`Total Anomalies,${summary.totalAnomalies ?? 0}`);
        if (summary.byStatus)
          for (const [s, c] of Object.entries(summary.byStatus)) lines.push(`Status: ${s},${c}`);
        if (summary.bySeverity)
          for (const [s, c] of Object.entries(summary.bySeverity))
            lines.push(`Severity: ${s},${c}`);
        if (summary.byType)
          for (const [t, c] of Object.entries(summary.byType)) lines.push(`Type: ${t},${c}`);
        break;
      case 'HIGH_RISK_ACTORS':
        lines.push('User ID,Total Anomalies,High Severity Count,Anomaly Types');
        if (summary.actors)
          for (const a of summary.actors)
            lines.push(
              `${a.userId},${a.totalAnomalies},${a.highSeverityCount},"${a.anomalyTypes.join(', ')}"`,
            );
        break;
      case 'STAFF_OPERATIONS':
        lines.push(
          'Email,Sales Count,Sales Total,Refund Count,Refund Total,Discount Count,Discount Total,Void Count,Void Total',
        );
        if (summary.staffBreakdown)
          for (const s of summary.staffBreakdown)
            lines.push(
              `${s.email},${s.salesCount},${s.salesTotal},${s.refundCount},${s.refundTotal},${s.discountCount},${s.discountTotal},${s.voidCount},${s.voidTotal}`,
            );
        break;
      default:
        lines.push('Key,Value');
        for (const [key, val] of Object.entries(summary))
          lines.push(`${key},${typeof val === 'object' ? JSON.stringify(val) : val}`);
    }
    return lines.join('\n');
  }

  private generateTextPdf(reportType: string, summary: any, run: any): string {
    const lines: string[] = [];
    lines.push('='.repeat(60));
    lines.push(`NIMBUS POS — ${reportType.replace(/_/g, ' ')} REPORT`);
    lines.push('='.repeat(60));
    lines.push(`Report ID: ${run.id}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Period: ${run.dateFrom?.toISOString()} to ${run.dateTo?.toISOString()}`);
    lines.push(`Window: ${run.reportWindow}`);
    lines.push('-'.repeat(60));
    lines.push('');
    for (const [key, val] of Object.entries(summary)) {
      if (typeof val === 'object' && val !== null) {
        lines.push(`${key}:`);
        if (Array.isArray(val)) {
          for (const item of val) lines.push(`  - ${JSON.stringify(item)}`);
        } else {
          for (const [k, v] of Object.entries(val as Record<string, unknown>))
            lines.push(`  ${k}: ${v}`);
        }
      } else {
        lines.push(`${key}: ${val}`);
      }
    }
    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('This is an operational report, not a formal accounting statement.');
    lines.push('='.repeat(60));
    return lines.join('\n');
  }

  // ── Get Export Artifact ──

  async getExportArtifact(orgId: string, artifactId: string) {
    const artifact = await this.prisma.exportArtifact.findFirst({
      where: { id: artifactId, orgId },
    });
    if (!artifact) throw new NotFoundException('Export artifact not found');
    return artifact;
  }

  async getExportFilePath(
    orgId: string,
    artifactId: string,
  ): Promise<{ path: string; fileName: string; mimeType: string }> {
    const artifact = await this.prisma.exportArtifact.findFirst({
      where: { id: artifactId, orgId },
    });
    if (!artifact) throw new NotFoundException('Export artifact not found');
    if (artifact.status !== 'READY')
      throw new BadRequestException('Export is not ready for download');
    if (!fs.existsSync(artifact.storagePath))
      throw new NotFoundException('Export file not found on disk');
    return { path: artifact.storagePath, fileName: artifact.fileName, mimeType: artifact.mimeType };
  }
}
