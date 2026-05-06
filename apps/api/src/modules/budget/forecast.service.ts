import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { DemandCalendarService } from './demand-calendar.service';
import { ListForecastQueryDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

interface BranchContext {
  organizationId: string;
  branchId: string;
}

interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface DaypartSummary {
  daypart: string;
  date: string;
  baselineCovers: number;
  calendarUplift: number;
  reservationCovers: number;
  projectedCovers: number;
  isBusy: boolean;
  busyReason: string | null;
  demandDrivers: string[];
}

interface DemandSignal {
  type: string;
  source: string;
  description: string;
  impact: string;
  dateRange: string;
}

interface ItemUsageProjection {
  inventoryItemId: string;
  itemName: string;
  unit: string;
  projectedUsage: number;
  currentStock: number;
  inboundStock: number;
  safetyStock: number;
  leadTimeDays: number;
  deficit: number;
  urgency: string;
  suggestedAction: string;
  rationale: string;
  linkedCalendarEntryId: string | null;
  daypart: string | null;
}

// Daypart ranges used inline by hourToDaypart()

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

@Injectable()
export class ForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly demandCalendar: DemandCalendarService,
  ) {}

  async getForecast(
    userId: string,
    ctx: BranchContext,
    query: ListForecastQueryDto,
    meta: AuditMeta,
  ) {
    const forecastType = query.forecastType ?? 'BRANCH';
    const refresh = query.refresh === 'true';
    const horizon = query.horizon ?? 'THREE_DAY';

    if (!refresh) {
      const latest = await this.prisma.forecastRun.findFirst({
        where: {
          orgId: ctx.organizationId,
          ...(forecastType !== 'FRANCHISE' ? { branchId: ctx.branchId } : { branchId: null }),
          forecastType,
          status: 'COMPLETED',
          ...(query.fiscalPeriodId ? { fiscalPeriodId: query.fiscalPeriodId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { procurementSuggestions: { where: { status: 'PENDING' }, take: 50 } },
      });
      if (latest) return latest;
    }

    return this.generateForecast(userId, ctx, query, forecastType, horizon, meta);
  }

  private async generateForecast(
    userId: string,
    ctx: BranchContext,
    query: ListForecastQueryDto,
    forecastType: string,
    horizon: string,
    meta: AuditMeta,
  ) {
    const now = new Date();
    const horizonDays = this.getHorizonDays(horizon);

    // Source window: comparable historical data (last 4 weeks same weekdays)
    const defaultSourceStart = new Date(now);
    defaultSourceStart.setDate(defaultSourceStart.getDate() - 28);
    const sourceWindowStart = query.sourceWindowStart
      ? new Date(query.sourceWindowStart)
      : defaultSourceStart;
    const sourceWindowEnd = query.sourceWindowEnd ? new Date(query.sourceWindowEnd) : now;

    // Forecast horizon
    const forecastHorizonStart = new Date(now);
    forecastHorizonStart.setHours(0, 0, 0, 0);
    const forecastHorizonEnd = new Date(forecastHorizonStart);
    forecastHorizonEnd.setDate(forecastHorizonEnd.getDate() + horizonDays);

    const branchFilter = forecastType !== 'FRANCHISE' ? ctx.branchId : undefined;

    // Gather demand signals in parallel
    const [calendarEntries, reservations, historicalOrders, inventoryItems, glSummary] =
      await Promise.all([
        this.demandCalendar.getEntriesForWindow(
          ctx.organizationId,
          ctx.branchId,
          forecastHorizonStart,
          forecastHorizonEnd,
        ),
        this.getReservationsForWindow(
          ctx.organizationId,
          ctx.branchId,
          forecastHorizonStart,
          forecastHorizonEnd,
        ),
        this.getHistoricalOrderStats(
          ctx.organizationId,
          branchFilter,
          sourceWindowStart,
          sourceWindowEnd,
        ),
        this.getInventoryWithStock(ctx.organizationId, ctx.branchId),
        this.getGlSummary(ctx.organizationId, branchFilter, sourceWindowStart, sourceWindowEnd),
      ]);

    // Build daypart summaries for each day in horizon
    const daypartSummaries = this.buildDaypartSummaries(
      forecastHorizonStart,
      horizonDays,
      historicalOrders,
      calendarEntries,
      reservations,
    );

    // Build demand signals summary
    const demandSignals = this.buildDemandSignals(
      calendarEntries,
      reservations,
      forecastHorizonStart,
      forecastHorizonEnd,
    );

    // Compute item-level usage projections
    const totalProjectedCovers = daypartSummaries.reduce((s, d) => s + d.projectedCovers, 0);
    const itemProjections = this.projectItemUsage(
      inventoryItems,
      historicalOrders,
      totalProjectedCovers,
      calendarEntries,
      horizonDays,
    );

    // Compute GL-based financial summary
    const windowDays = Math.max(
      1,
      Math.ceil((sourceWindowEnd.getTime() - sourceWindowStart.getTime()) / 86_400_000),
    );
    const dailyRevenue = glSummary.totalRevenue / windowDays;
    const dailyExpense = glSummary.totalExpense / windowDays;

    const outputs = {
      horizonDays,
      sourceWindowDays: windowDays,
      financialSummary: {
        historicalRevenue: round2(glSummary.totalRevenue),
        historicalExpense: round2(glSummary.totalExpense),
        dailyRevenue: round2(dailyRevenue),
        dailyExpense: round2(dailyExpense),
        projectedRevenue: round2(dailyRevenue * horizonDays),
        projectedExpense: round2(dailyExpense * horizonDays),
        projectedNetIncome: round2((dailyRevenue - dailyExpense) * horizonDays),
      },
      operationalSummary: {
        totalProjectedCovers,
        busyPeriods: daypartSummaries
          .filter((d) => d.isBusy)
          .map((d) => ({
            date: d.date,
            daypart: d.daypart,
            projectedCovers: d.projectedCovers,
            reason: d.busyReason,
          })),
        demandDriverCount: calendarEntries.length,
        upcomingReservationCovers: reservations.reduce((s, r) => s + r.partySize, 0),
      },
      stockRiskCount: itemProjections.filter((p) => p.deficit > 0).length,
    };

    const run = await this.prisma.forecastRun.create({
      data: {
        orgId: ctx.organizationId,
        branchId: forecastType !== 'FRANCHISE' ? ctx.branchId : null,
        fiscalPeriodId: query.fiscalPeriodId ?? null,
        forecastType: forecastType as 'BRANCH' | 'ROLLUP' | 'FRANCHISE',
        status: 'COMPLETED',
        forecastHorizonStart,
        forecastHorizonEnd,
        sourceWindowStart,
        sourceWindowEnd,
        assumptions: {
          horizonDays,
          forecastType,
          branchId: forecastType !== 'FRANCHISE' ? ctx.branchId : null,
          sourceWindowDays: windowDays,
          calendarEntriesUsed: calendarEntries.map((c) => c.id),
          reservationCount: reservations.length,
        },
        demandSignals: demandSignals as unknown as Prisma.InputJsonValue,
        daypartSummaries: daypartSummaries as unknown as Prisma.InputJsonValue,
        outputs,
        completedAt: new Date(),
        createdById: userId,
      },
    });

    // Persist procurement suggestions for items with projected deficits
    const suggestionsToCreate = itemProjections
      .filter((p) => p.deficit > 0)
      .map((p) => ({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        forecastRunId: run.id,
        inventoryItemId: p.inventoryItemId,
        demandCalendarEntryId: p.linkedCalendarEntryId,
        status: 'PENDING' as const,
        urgency: p.urgency as
          | 'MONITOR'
          | 'ORDER_NEXT_PO'
          | 'STOCK_UP_BEFORE_EVENT'
          | 'TRANSFER_FROM_BRANCH'
          | 'URGENT_LOCAL_BUY',
        daypart: p.daypart as
          | 'BREAKFAST'
          | 'LUNCH'
          | 'AFTERNOON'
          | 'DINNER'
          | 'LATE_NIGHT'
          | 'ALL_DAY'
          | null,
        suggestedQty: Math.ceil(p.deficit * 1.1),
        projectedUsage: round3(p.projectedUsage),
        currentStock: round3(p.currentStock),
        inboundStock: 0,
        safetyStock: round3(p.safetyStock),
        leadTimeDays: p.leadTimeDays,
        estimatedUnitCost: null as number | null,
        estimatedTotalCost: null as number | null,
        priority: this.urgencyToPriority(p.urgency),
        rationale: p.rationale,
        suggestedAction: p.suggestedAction,
      }));

    if (suggestionsToCreate.length > 0) {
      await this.prisma.procurementSuggestion.createMany({ data: suggestionsToCreate });
    }

    await this.audit.log({
      action: 'FORECAST_RUN_CREATED',
      actorUserId: userId,
      entityType: 'ForecastRun',
      entityId: run.id,
      metadata: {
        forecastType,
        horizonDays,
        calendarEntriesUsed: calendarEntries.length,
        reservationsUsed: reservations.length,
        suggestionsGenerated: suggestionsToCreate.length,
        busyPeriods: outputs.operationalSummary.busyPeriods.length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.prisma.forecastRun.findFirst({
      where: { id: run.id },
      include: { procurementSuggestions: { where: { status: 'PENDING' }, take: 50 } },
    });
  }

  // ── Data Fetchers ──

  private async getReservationsForWindow(orgId: string, branchId: string, start: Date, end: Date) {
    return this.prisma.reservation.findMany({
      where: {
        orgId,
        branchId,
        reservationAt: { gte: start, lte: end },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { id: true, partySize: true, reservationAt: true },
    });
  }

  private async getHistoricalOrderStats(
    orgId: string,
    branchId: string | undefined,
    start: Date,
    end: Date,
  ) {
    const orders = await this.prisma.order.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        status: { in: ['CLOSED', 'SERVED'] },
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            menuItemId: true,
            quantity: true,
            menuItem: {
              select: {
                id: true,
                name: true,
                recipeIngredients: {
                  select: {
                    inventoryItemId: true,
                    qtyPerUnit: true,
                    wastePct: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return orders;
  }

  private async getInventoryWithStock(orgId: string, branchId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { orgId, branchId, isActive: true },
      select: {
        id: true,
        name: true,
        unit: true,
        reorderLevel: true,
        reorderQty: true,
        theoreticalUnitCost: true,
        stockBatches: {
          where: { remainingQty: { gt: 0 } },
          select: { remainingQty: true },
        },
      },
    });
    return items;
  }

  private async getGlSummary(orgId: string, branchId: string | undefined, start: Date, end: Date) {
    const [revenueRows, expenseRows] = await Promise.all([
      this.prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          journalEntry: {
            orgId,
            ...(branchId ? { branchId } : {}),
            status: 'POSTED',
            journalDate: { gte: start, lte: end },
          },
          account: { accountType: 'REVENUE' },
        },
        _sum: { amount: true },
      }),
      this.prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          journalEntry: {
            orgId,
            ...(branchId ? { branchId } : {}),
            status: 'POSTED',
            journalDate: { gte: start, lte: end },
          },
          account: { accountType: 'EXPENSE' },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalRevenue: revenueRows.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0),
      totalExpense: expenseRows.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0),
    };
  }

  // ── Forecast Logic ──

  buildDaypartSummaries(
    horizonStart: Date,
    horizonDays: number,
    historicalOrders: { createdAt: Date; total: Decimal; items: { quantity: number }[] }[],
    calendarEntries: {
      dateStart: Date;
      dateEnd: Date;
      daypart: string;
      calendarType: string;
      expectedCovers: number | null;
      demandMultiplier: Decimal | null;
      title: string;
    }[],
    reservations: { partySize: number; reservationAt: Date }[],
  ): DaypartSummary[] {
    const dayparts = ['BREAKFAST', 'LUNCH', 'DINNER', 'LATE_NIGHT'] as const;
    const summaries: DaypartSummary[] = [];

    // Compute weekly average covers per daypart from history
    const historicalByDayDaypart = new Map<string, number[]>();
    for (const order of historicalOrders) {
      const dow = order.createdAt.getDay();
      const hour = order.createdAt.getHours();
      const dp = this.hourToDaypart(hour);
      const key = `${dow}-${dp}`;
      const counts = historicalByDayDaypart.get(key) || [];
      counts.push(order.items.reduce((s, i) => s + i.quantity, 0) || 1);
      historicalByDayDaypart.set(key, counts);
    }

    for (let d = 0; d < horizonDays; d++) {
      const date = new Date(horizonStart);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      const dow = date.getDay();

      for (const dp of dayparts) {
        const key = `${dow}-${dp}`;
        const historical = historicalByDayDaypart.get(key) || [];
        const avgWeeks = Math.max(1, Math.ceil(historical.length > 0 ? historical.length / 4 : 1));
        const baselineCovers =
          historical.length > 0 ? Math.round(historical.reduce((s, v) => s + v, 0) / avgWeeks) : 0;

        // Calendar uplift
        let calendarUplift = 0;
        const drivers: string[] = [];
        for (const ce of calendarEntries) {
          const ceStart = new Date(ce.dateStart);
          const ceEnd = new Date(ce.dateEnd);
          if (date >= ceStart && date <= ceEnd) {
            if (ce.daypart === 'ALL_DAY' || ce.daypart === dp) {
              const multiplier = ce.demandMultiplier ? Number(ce.demandMultiplier) : 1.3;
              calendarUplift += Math.round(baselineCovers * (multiplier - 1));
              if (ce.expectedCovers) {
                calendarUplift = Math.max(calendarUplift, ce.expectedCovers);
              }
              drivers.push(`${ce.calendarType}: ${ce.title}`);
            }
          }
        }

        // Reservation covers
        let reservationCovers = 0;
        for (const res of reservations) {
          const resDate = new Date(res.reservationAt);
          if (resDate.toISOString().split('T')[0] === dateStr) {
            const resHour = resDate.getHours();
            if (this.hourToDaypart(resHour) === dp) {
              reservationCovers += res.partySize;
            }
          }
        }

        const projectedCovers = baselineCovers + calendarUplift + reservationCovers;
        const busyThreshold = Math.max(baselineCovers * 1.3, baselineCovers + 20);
        const isBusy = projectedCovers > busyThreshold && projectedCovers > 0;

        let busyReason: string | null = null;
        if (isBusy) {
          const reasons: string[] = [];
          if (calendarUplift > 0) reasons.push(`demand calendar: ${drivers.join(', ')}`);
          if (reservationCovers > baselineCovers * 0.3)
            reasons.push(`${reservationCovers} reservation covers`);
          if (reasons.length === 0) reasons.push(`${WEEKDAY_NAMES[dow]} ${dp} historically busy`);
          busyReason = reasons.join('; ');
        }

        summaries.push({
          daypart: dp,
          date: dateStr,
          baselineCovers,
          calendarUplift,
          reservationCovers,
          projectedCovers,
          isBusy,
          busyReason,
          demandDrivers: drivers,
        });
      }
    }

    return summaries;
  }

  buildDemandSignals(
    calendarEntries: {
      id: string;
      calendarType: string;
      title: string;
      dateStart: Date;
      dateEnd: Date;
      daypart: string;
      expectedCovers: number | null;
      demandMultiplier: Decimal | null;
    }[],
    reservations: { partySize: number; reservationAt: Date }[],
    _horizonStart: Date,
    _horizonEnd: Date,
  ): DemandSignal[] {
    const signals: DemandSignal[] = [];

    for (const ce of calendarEntries) {
      signals.push({
        type: 'CALENDAR_ENTRY',
        source: ce.calendarType,
        description: ce.title,
        impact: ce.expectedCovers
          ? `+${ce.expectedCovers} expected covers`
          : ce.demandMultiplier
            ? `${Number(ce.demandMultiplier)}x demand multiplier`
            : 'Elevated demand expected',
        dateRange: `${new Date(ce.dateStart).toISOString().split('T')[0]} – ${new Date(ce.dateEnd).toISOString().split('T')[0]}`,
      });
    }

    // Summarize reservations by date
    const resByDate = new Map<string, number>();
    for (const r of reservations) {
      const d = new Date(r.reservationAt).toISOString().split('T')[0];
      resByDate.set(d, (resByDate.get(d) || 0) + r.partySize);
    }
    for (const [d, covers] of resByDate) {
      if (covers > 10) {
        signals.push({
          type: 'RESERVATIONS',
          source: 'reservations',
          description: `${covers} covers booked`,
          impact: `+${covers} confirmed covers`,
          dateRange: d,
        });
      }
    }

    return signals;
  }

  projectItemUsage(
    inventoryItems: {
      id: string;
      name: string;
      unit: string;
      reorderLevel: Decimal;
      reorderQty: Decimal;
      theoreticalUnitCost: Decimal;
      stockBatches: { remainingQty: Decimal }[];
    }[],
    historicalOrders: {
      items: {
        quantity: number;
        menuItem: {
          recipeIngredients: { inventoryItemId: string; qtyPerUnit: Decimal; wastePct: Decimal }[];
        };
      }[];
    }[],
    totalProjectedCovers: number,
    calendarEntries: { id: string; calendarType: string; itemNotes: string | null }[],
    horizonDays: number,
  ): ItemUsageProjection[] {
    // Calculate historical daily usage per inventory item from order BOM
    const usageByItem = new Map<string, number>();
    let totalHistCovers = 0;
    for (const order of historicalOrders) {
      for (const oi of order.items) {
        totalHistCovers += oi.quantity;
        for (const ri of oi.menuItem.recipeIngredients) {
          const usage = Number(ri.qtyPerUnit) * oi.quantity * (1 + Number(ri.wastePct) / 100);
          usageByItem.set(ri.inventoryItemId, (usageByItem.get(ri.inventoryItemId) || 0) + usage);
        }
      }
    }

    const avgDailyCovers = totalHistCovers > 0 ? totalHistCovers / Math.max(1, horizonDays) : 0;
    const coverMultiplier =
      avgDailyCovers > 0 ? totalProjectedCovers / (avgDailyCovers * horizonDays) : 1;

    // Parse item notes from calendar entries
    const mentionedItems = new Set<string>();
    for (const ce of calendarEntries) {
      if (ce.itemNotes) {
        const lower = ce.itemNotes.toLowerCase();
        for (const item of inventoryItems) {
          if (lower.includes(item.name.toLowerCase())) {
            mentionedItems.add(item.id);
          }
        }
      }
    }

    const projections: ItemUsageProjection[] = [];

    for (const item of inventoryItems) {
      const historicalUsage = usageByItem.get(item.id) || 0;
      const dailyUsage = historicalUsage / Math.max(1, 28); // assume 28-day window
      let projectedUsage = dailyUsage * horizonDays * coverMultiplier;

      // Extra uplift for items explicitly mentioned in calendar entries
      if (mentionedItems.has(item.id)) {
        projectedUsage *= 1.5;
      }

      const currentStock = item.stockBatches.reduce((s, b) => s + Number(b.remainingQty), 0);
      const safetyStock = Number(item.reorderLevel);
      const reorderQty = Number(item.reorderQty);
      const leadTimeDays = 1; // TODO: from supplier data in future milestones

      const available = currentStock - safetyStock;
      const deficit = projectedUsage - available;

      if (deficit <= 0 && currentStock > safetyStock) continue;

      // Determine urgency
      const urgency = this.classifyUrgency(
        deficit,
        currentStock,
        safetyStock,
        projectedUsage,
        horizonDays,
        mentionedItems.has(item.id),
      );

      const linkedEntry = mentionedItems.has(item.id)
        ? calendarEntries.find((ce) =>
            ce.itemNotes?.toLowerCase().includes(item.name.toLowerCase()),
          )
        : null;

      const suggestedAction = this.buildSuggestedAction(
        urgency,
        item.name,
        Math.ceil(deficit > 0 ? deficit : reorderQty),
      );
      const rationale = this.buildRationale(
        item.name,
        item.unit,
        currentStock,
        projectedUsage,
        safetyStock,
        deficit,
        urgency,
        linkedEntry?.calendarType,
      );

      projections.push({
        inventoryItemId: item.id,
        itemName: item.name,
        unit: item.unit,
        projectedUsage,
        currentStock,
        inboundStock: 0,
        safetyStock,
        leadTimeDays,
        deficit: Math.max(0, deficit),
        urgency,
        suggestedAction,
        rationale,
        linkedCalendarEntryId: linkedEntry?.id ?? null,
        daypart: null,
      });
    }

    return projections.sort(
      (a, b) => this.urgencyToPriority(a.urgency) - this.urgencyToPriority(b.urgency),
    );
  }

  classifyUrgency(
    deficit: number,
    currentStock: number,
    safetyStock: number,
    projectedUsage: number,
    horizonDays: number,
    mentionedInCalendar: boolean,
  ): string {
    const daysOfStock =
      projectedUsage > 0 ? currentStock / (projectedUsage / horizonDays) : Infinity;

    if (daysOfStock < 1) return 'URGENT_LOCAL_BUY';
    if (mentionedInCalendar && deficit > 0) return 'STOCK_UP_BEFORE_EVENT';
    if (daysOfStock < 2 && deficit > 0) return 'URGENT_LOCAL_BUY';
    if (deficit > 0 && currentStock <= safetyStock) return 'ORDER_NEXT_PO';
    if (deficit > 0) return 'ORDER_NEXT_PO';
    if (currentStock <= safetyStock * 1.2) return 'MONITOR';
    return 'MONITOR';
  }

  urgencyToPriority(urgency: string): number {
    switch (urgency) {
      case 'URGENT_LOCAL_BUY':
        return 1;
      case 'STOCK_UP_BEFORE_EVENT':
        return 2;
      case 'TRANSFER_FROM_BRANCH':
        return 3;
      case 'ORDER_NEXT_PO':
        return 4;
      case 'MONITOR':
        return 5;
      default:
        return 5;
    }
  }

  private buildSuggestedAction(urgency: string, itemName: string, qty: number): string {
    switch (urgency) {
      case 'URGENT_LOCAL_BUY':
        return `Urgent local buy: ${qty} units of ${itemName} — likely to run out before end of shift`;
      case 'STOCK_UP_BEFORE_EVENT':
        return `Stock up tomorrow: ${qty} units of ${itemName} before upcoming event`;
      case 'ORDER_NEXT_PO':
        return `Add ${qty} units of ${itemName} to next purchase order`;
      case 'TRANSFER_FROM_BRANCH':
        return `Request branch transfer: ${qty} units of ${itemName}`;
      case 'MONITOR':
        return `Monitor ${itemName} — stock approaching safety level`;
      default:
        return `Review stock for ${itemName}`;
    }
  }

  private buildRationale(
    name: string,
    unit: string,
    currentStock: number,
    projectedUsage: number,
    safetyStock: number,
    deficit: number,
    urgency: string,
    calendarType?: string,
  ): string {
    const parts: string[] = [];
    parts.push(`Current stock: ${round3(currentStock)} ${unit}`);
    parts.push(`Projected usage over horizon: ${round3(projectedUsage)} ${unit}`);
    parts.push(`Safety stock: ${round3(safetyStock)} ${unit}`);

    if (deficit > 0) {
      parts.push(`Projected deficit: ${round3(deficit)} ${unit}`);
    }

    if (calendarType) {
      parts.push(`Linked to demand calendar event: ${calendarType}`);
    }

    if (urgency === 'URGENT_LOCAL_BUY') {
      parts.push(
        `${name} is likely to run out before replenishment — urgent local buy recommended`,
      );
    } else if (urgency === 'STOCK_UP_BEFORE_EVENT') {
      parts.push(`Stock up before event to avoid shortage`);
    }

    return parts.join('. ') + '.';
  }

  hourToDaypart(hour: number): string {
    if (hour >= 6 && hour < 11) return 'BREAKFAST';
    if (hour >= 11 && hour < 15) return 'LUNCH';
    if (hour >= 15 && hour < 17) return 'AFTERNOON';
    if (hour >= 17 && hour < 22) return 'DINNER';
    return 'LATE_NIGHT';
  }

  private getHorizonDays(horizon: string): number {
    switch (horizon) {
      case 'TODAY':
        return 1;
      case 'THREE_DAY':
        return 3;
      case 'SEVEN_DAY':
        return 7;
      default:
        return 3;
    }
  }
}

function round2(n: number): number {
  return parseFloat(n.toFixed(2));
}

function round3(n: number): number {
  return parseFloat(n.toFixed(3));
}
