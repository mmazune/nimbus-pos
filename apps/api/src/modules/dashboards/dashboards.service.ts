import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Prisma, KpiScopeType, KpiMetricWindow } from '@prisma/client';

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Helpers ──

  private todayRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  private mtdRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(start.getTime());
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  // ── Live Aggregation Helpers ──

  /**
   * MP0-10 — sales aggregation with a stated, order-preserving definition.
   *
   * The persisted money model is `Order.total = Order.subtotal + Order.tax -
   * Order.discount` (asserted by `packages/db/prisma/demo-import.ts:443`; the POS write
   * path in `OrdersService.recalcOrderTotals` is the same identity with `tax = 0`).
   * `subtotal` is therefore EX-tax and `total` is TAX-INCLUSIVE.
   *
   * Before this fix `grossSales` was `SUM(subtotal)` and `netSales` was `SUM(total)`, so
   * whenever tax exceeded discount the "net" figure was LARGER than the "gross" figure
   * (live: net 33,014,100 > gross 28,107,000). The labels were inverted, not the maths.
   *
   * The definition is now:
   *   grossSales    = SUM(order.total)               — billed to the guest, tax included
   *   netSales      = grossSales - SUM(order.tax)    — revenue excluding tax
   *   subtotalSales = SUM(order.subtotal)            — ex-tax, BEFORE discount (additive;
   *                                                    this is the value that used to be
   *                                                    published as `grossSales`)
   *
   * Invariant: `grossSales = netSales + taxTotal`, and tax is never negative, so
   * `grossSales >= netSales` always holds.
   */
  private async aggregateSales(
    orgId: string,
    branchId: string | null,
    range: { start: Date; end: Date },
  ) {
    const where: any = {
      orgId,
      status: { in: ['CLOSED', 'SERVED'] },
      createdAt: { gte: range.start, lt: range.end },
    };
    if (branchId) where.branchId = branchId;

    const result = await this.prisma.order.aggregate({
      where,
      _sum: { subtotal: true, total: true, tax: true, discount: true },
      _count: true,
      _avg: { total: true },
    });

    const grossSales = result._sum.total ?? new Prisma.Decimal(0);
    const taxTotal = result._sum.tax ?? new Prisma.Decimal(0);

    return {
      grossSales,
      netSales: grossSales.sub(taxTotal),
      taxTotal,
      discountTotal: result._sum.discount ?? new Prisma.Decimal(0),
      subtotalSales: result._sum.subtotal ?? new Prisma.Decimal(0),
      orderCount: result._count ?? 0,
      avgOrderValue: result._avg.total ?? new Prisma.Decimal(0),
    };
  }

  private async aggregatePaymentMix(
    orgId: string,
    branchId: string | null,
    range: { start: Date; end: Date },
  ) {
    const where: any = {
      orgId,
      status: 'COMPLETED',
      createdAt: { gte: range.start, lt: range.end },
    };
    if (branchId) where.branchId = branchId;

    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where,
      _sum: { amount: true },
    });

    let cash = new Prisma.Decimal(0);
    let card = new Prisma.Decimal(0);
    let momo = new Prisma.Decimal(0);

    for (const p of payments) {
      const amount = p._sum.amount ?? new Prisma.Decimal(0);
      switch (p.method) {
        case 'CASH':
          cash = amount;
          break;
        case 'CARD':
          card = amount;
          break;
        case 'MOMO':
          momo = amount;
          break;
      }
    }

    return { cash, card, momo };
  }

  private async aggregateRefunds(
    orgId: string,
    branchId: string | null,
    range: { start: Date; end: Date },
  ) {
    const where: any = {
      orgId,
      status: 'COMPLETED',
      createdAt: { gte: range.start, lt: range.end },
    };
    if (branchId) where.branchId = branchId;

    const result = await this.prisma.refund.aggregate({
      where,
      _sum: { amount: true },
    });

    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  /**
   * MP0-09 — the ONE definition of an "open" order, shared by the count on
   * `/dash/manager`, `/dash/owner`, `/dash/today-summary`, `/stream/metrics` and by the
   * `/dash/open-orders` list. Previously the list rebuilt the same filter inline, so the
   * two could drift apart silently.
   */
  private openOrdersWhere(orgId: string, branchId: string | null) {
    const where: any = {
      orgId,
      status: { in: ['NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED'] },
    };
    if (branchId) where.branchId = branchId;
    return where;
  }

  /** Maximum rows `/dash/open-orders` returns. The list is a preview, not the count. */
  private readonly OPEN_ORDERS_PAGE_LIMIT = 50;

  private async countOpenOrders(orgId: string, branchId: string | null) {
    return this.prisma.order.count({ where: this.openOrdersWhere(orgId, branchId) });
  }

  private async countClosedOrders(
    orgId: string,
    branchId: string | null,
    range: { start: Date; end: Date },
  ) {
    const where: any = {
      orgId,
      status: 'CLOSED',
      createdAt: { gte: range.start, lt: range.end },
    };
    if (branchId) where.branchId = branchId;

    return this.prisma.order.count({ where });
  }

  private async countLowStock(orgId: string, branchId: string | null) {
    const where: any = {
      orgId,
      isActive: true,
      reorderLevel: { gt: 0 },
    };
    if (branchId) where.branchId = branchId;

    const items = await this.prisma.inventoryItem.findMany({
      where,
      select: {
        id: true,
        reorderLevel: true,
        stockBatches: {
          select: { remainingQty: true },
          where: { remainingQty: { gt: 0 } },
        },
      },
    });

    let count = 0;
    for (const item of items) {
      const totalQty = item.stockBatches.reduce(
        (sum, b) => sum.add(b.remainingQty),
        new Prisma.Decimal(0),
      );
      if (item.reorderLevel && totalQty.lessThanOrEqualTo(item.reorderLevel)) {
        count++;
      }
    }
    return count;
  }

  private async countAnomalies(orgId: string, branchId: string | null) {
    const openWhere: any = { orgId, status: 'OPEN' };
    if (branchId) openWhere.branchId = branchId;

    const highWhere: any = {
      orgId,
      status: 'OPEN',
      severity: { in: ['HIGH', 'CRITICAL'] },
    };
    if (branchId) highWhere.branchId = branchId;

    const [openCount, highCount] = await Promise.all([
      this.prisma.anomalyEvent.count({ where: openWhere }),
      this.prisma.anomalyEvent.count({ where: highWhere }),
    ]);

    return { openCount, highCount };
  }

  private async countReservationsToday(orgId: string, branchId: string | null) {
    const { start, end } = this.todayRange();
    const where: any = {
      orgId,
      reservationAt: { gte: start, lt: end },
      status: { in: ['PENDING', 'CONFIRMED', 'SEATED'] },
    };
    if (branchId) where.branchId = branchId;

    return this.prisma.reservation.count({ where });
  }

  private async countEventsToday(orgId: string, branchId: string | null) {
    const { start, end } = this.todayRange();
    const where: any = {
      orgId,
      startsAt: { lte: end },
      endsAt: { gte: start },
      status: { in: ['OPEN', 'PUBLISHED'] },
    };
    if (branchId) where.branchId = branchId;

    return this.prisma.event.count({ where });
  }

  // ── Today Summary (live aggregation) ──

  async getTodaySummary(orgId: string, branchId: string | null) {
    const range = this.todayRange();

    const [sales, paymentMix, refundsTotal, openOrders, closedOrders, lowStock, anomalies] =
      await Promise.all([
        this.aggregateSales(orgId, branchId, range),
        this.aggregatePaymentMix(orgId, branchId, range),
        this.aggregateRefunds(orgId, branchId, range),
        this.countOpenOrders(orgId, branchId),
        this.countClosedOrders(orgId, branchId, range),
        this.countLowStock(orgId, branchId),
        this.countAnomalies(orgId, branchId),
      ]);

    return {
      date: range.start.toISOString().split('T')[0],
      // MP0-10: grossSales = SUM(order.total) (tax-inclusive, discount applied);
      // netSales = grossSales - taxTotal; subtotalSales is the additive ex-tax,
      // pre-discount figure that used to be published as `grossSales`.
      grossSales: sales.grossSales,
      netSales: sales.netSales,
      taxTotal: sales.taxTotal,
      discountTotal: sales.discountTotal,
      subtotalSales: sales.subtotalSales,
      refundsTotal,
      paymentMix: {
        cash: paymentMix.cash,
        card: paymentMix.card,
        momo: paymentMix.momo,
      },
      openOrders,
      closedOrders,
      avgOrderValue: sales.avgOrderValue,
      lowStockCount: lowStock,
      anomalyOpenCount: anomalies.openCount,
      anomalyHighCount: anomalies.highCount,
      calculatedAt: new Date().toISOString(),
    };
  }

  // ── Owner Dashboard ──

  async getOwnerDashboard(orgId: string, branchId: string | null) {
    const todayRange = this.todayRange();
    const mtdRange = this.mtdRange();

    const [
      todaySales,
      mtdSales,
      todayPaymentMix,
      todayRefunds,
      mtdRefunds,
      openOrders,
      lowStock,
      anomalies,
      reservationsToday,
      eventsToday,
    ] = await Promise.all([
      this.aggregateSales(orgId, branchId, todayRange),
      this.aggregateSales(orgId, branchId, mtdRange),
      this.aggregatePaymentMix(orgId, branchId, todayRange),
      this.aggregateRefunds(orgId, branchId, todayRange),
      this.aggregateRefunds(orgId, branchId, mtdRange),
      this.countOpenOrders(orgId, branchId),
      this.countLowStock(orgId, branchId),
      this.countAnomalies(orgId, branchId),
      this.countReservationsToday(orgId, branchId),
      this.countEventsToday(orgId, branchId),
    ]);

    return {
      today: {
        grossSales: todaySales.grossSales,
        netSales: todaySales.netSales,
        taxTotal: todaySales.taxTotal,
        subtotalSales: todaySales.subtotalSales,
        orderCount: todaySales.orderCount,
        avgOrderValue: todaySales.avgOrderValue,
        refundsTotal: todayRefunds,
      },
      mtd: {
        grossSales: mtdSales.grossSales,
        netSales: mtdSales.netSales,
        taxTotal: mtdSales.taxTotal,
        subtotalSales: mtdSales.subtotalSales,
        orderCount: mtdSales.orderCount,
        avgOrderValue: mtdSales.avgOrderValue,
        refundsTotal: mtdRefunds,
      },
      paymentMix: {
        cash: todayPaymentMix.cash,
        card: todayPaymentMix.card,
        momo: todayPaymentMix.momo,
      },
      openOrders,
      lowStockCount: lowStock,
      anomalySummary: {
        openCount: anomalies.openCount,
        highCount: anomalies.highCount,
      },
      reservationsTodayCount: reservationsToday,
      eventsTodayCount: eventsToday,
      calculatedAt: new Date().toISOString(),
    };
  }

  // ── Manager Dashboard ──

  async getManagerDashboard(orgId: string, branchId: string) {
    const todayRange = this.todayRange();

    const [todaySales, openOrders, lowStock, anomalies, reservationsToday] = await Promise.all([
      this.aggregateSales(orgId, branchId, todayRange),
      this.countOpenOrders(orgId, branchId),
      this.countLowStock(orgId, branchId),
      this.countAnomalies(orgId, branchId),
      this.countReservationsToday(orgId, branchId),
    ]);

    // Shift/till summary for the branch today
    const activeShifts = await this.prisma.shift.count({
      where: { orgId, branchId, status: 'OPEN' },
    });
    const activeTills = await this.prisma.tillSession.count({
      where: { orgId, branchId, status: 'OPEN' },
    });

    return {
      today: {
        grossSales: todaySales.grossSales,
        netSales: todaySales.netSales,
        taxTotal: todaySales.taxTotal,
        subtotalSales: todaySales.subtotalSales,
        orderCount: todaySales.orderCount,
        avgOrderValue: todaySales.avgOrderValue,
      },
      openOrders,
      lowStockCount: lowStock,
      anomalySummary: {
        openCount: anomalies.openCount,
        highCount: anomalies.highCount,
      },
      shiftSummary: {
        activeShifts,
        activeTills,
      },
      reservationsTodayCount: reservationsToday,
      calculatedAt: new Date().toISOString(),
    };
  }

  // ── Payment Mix ──

  async getPaymentMix(orgId: string, branchId: string | null) {
    const range = this.todayRange();
    const mix = await this.aggregatePaymentMix(orgId, branchId, range);
    const total = mix.cash.add(mix.card).add(mix.momo);
    return {
      cash: mix.cash,
      card: mix.card,
      momo: mix.momo,
      total,
      date: range.start.toISOString().split('T')[0],
      calculatedAt: new Date().toISOString(),
    };
  }

  // ── Open Orders ──

  /**
   * MP0-09 — `/dash/open-orders`.
   *
   * The rows are still the 50 oldest open orders. What changed is that the response now
   * carries the REAL number of open orders alongside them, from the same `where` clause
   * the dashboard counts use, so `/dash/open-orders.total` and
   * `/dash/manager.openOrders` are guaranteed to agree (live repro: the list reported
   * `count: 50` while the branch actually had 107 open orders).
   *
   * Additive only — `count` and `orders` keep their existing meaning so today's Manager
   * Overview keeps working:
   *   `count`     — rows returned in THIS response (page length; equals `total` only when
   *                 the branch has 50 or fewer open orders). Retained for compatibility;
   *                 prefer `total`.
   *   `total`     — every open order matching the shared definition (not capped).
   *   `limit`     — the page cap applied (50).
   *   `truncated` — `total > count`, i.e. the rows are a preview.
   */
  async getOpenOrders(orgId: string, branchId: string | null) {
    const where = this.openOrdersWhere(orgId, branchId);

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          serviceType: true,
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: this.OPEN_ORDERS_PAGE_LIMIT,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      count: orders.length,
      total,
      limit: this.OPEN_ORDERS_PAGE_LIMIT,
      truncated: total > orders.length,
      orders,
    };
  }

  // ── Low Stock ──

  async getLowStock(orgId: string, branchId: string | null) {
    const where: any = {
      orgId,
      isActive: true,
      reorderLevel: { gt: 0 },
    };
    if (branchId) where.branchId = branchId;

    const items = await this.prisma.inventoryItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        reorderLevel: true,
        reorderQty: true,
        stockBatches: {
          select: { remainingQty: true },
          where: { remainingQty: { gt: 0 } },
        },
      },
    });

    const lowItems: any[] = [];
    for (const item of items) {
      const totalQty = item.stockBatches.reduce(
        (sum, b) => sum.add(b.remainingQty),
        new Prisma.Decimal(0),
      );
      if (item.reorderLevel && totalQty.lessThanOrEqualTo(item.reorderLevel)) {
        lowItems.push({
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          currentStock: totalQty,
          reorderLevel: item.reorderLevel,
          reorderQty: item.reorderQty,
        });
      }
    }

    return { count: lowItems.length, items: lowItems };
  }

  // ── Snapshots ──

  async listSnapshots(orgId: string, branchId: string | null) {
    const where: any = { orgId };
    if (branchId) where.branchId = branchId;

    return this.prisma.kpiSnapshot.findMany({
      where,
      orderBy: { calculatedAt: 'desc' },
      take: 20,
    });
  }

  // ── KPI Refresh ──

  async refreshKpi(
    orgId: string,
    branchId: string | null,
    scopeType: KpiScopeType,
    metricWindow: KpiMetricWindow,
    userId: string,
    auditMeta: { ipAddress?: string; userAgent?: string },
  ) {
    const range = metricWindow === 'MTD' ? this.mtdRange() : this.todayRange();

    const [
      sales,
      paymentMix,
      refundsTotal,
      openOrders,
      closedOrders,
      lowStock,
      anomalies,
      reservationsToday,
      eventsToday,
    ] = await Promise.all([
      this.aggregateSales(orgId, branchId, range),
      this.aggregatePaymentMix(orgId, branchId, range),
      this.aggregateRefunds(orgId, branchId, range),
      this.countOpenOrders(orgId, branchId),
      this.countClosedOrders(orgId, branchId, range),
      this.countLowStock(orgId, branchId),
      this.countAnomalies(orgId, branchId),
      this.countReservationsToday(orgId, branchId),
      this.countEventsToday(orgId, branchId),
    ]);

    const now = new Date();
    const snapshotDate = range.start;

    const snapshot = await this.prisma.kpiSnapshot.create({
      data: {
        orgId,
        branchId,
        scopeType,
        metricWindow,
        snapshotDate,
        grossSales: sales.grossSales,
        netSales: sales.netSales,
        paymentCash: paymentMix.cash,
        paymentCard: paymentMix.card,
        paymentMomo: paymentMix.momo,
        refundsTotal,
        ordersOpenCount: openOrders,
        ordersClosedCount: closedOrders,
        lowStockCount: lowStock,
        anomalyOpenCount: anomalies.openCount,
        anomalyHighCount: anomalies.highCount,
        reservationsTodayCount: reservationsToday,
        eventsTodayCount: eventsToday,
        avgOrderValue: sales.avgOrderValue,
        calculatedAt: now,
      },
    });

    await this.audit.log({
      action: 'KPI_REFRESH_TRIGGERED',
      actorUserId: userId,
      entityType: 'KpiSnapshot',
      entityId: snapshot.id,
      metadata: { scopeType, metricWindow, orgId, branchId },
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
    });

    return snapshot;
  }

  // ── Stream Metrics (lightweight polling-compatible snapshot) ──

  async getStreamMetrics(orgId: string, branchId: string | null) {
    const range = this.todayRange();

    const [sales, openOrders, anomalies] = await Promise.all([
      this.aggregateSales(orgId, branchId, range),
      this.countOpenOrders(orgId, branchId),
      this.countAnomalies(orgId, branchId),
    ]);

    return {
      grossSales: sales.grossSales,
      netSales: sales.netSales,
      openOrders,
      anomalyOpenCount: anomalies.openCount,
      orderCount: sales.orderCount,
      timestamp: new Date().toISOString(),
    };
  }
}
