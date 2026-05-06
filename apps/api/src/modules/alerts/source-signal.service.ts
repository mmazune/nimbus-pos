import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * M40 — Source Signal Service
 *
 * Maps every supported AlertRuleType to a real, existing source module
 * via deterministic SQL aggregations. Each `evaluate*` returns concrete
 * occurrences justifying an alert. Locked rules:
 *   - Owner SaaS billing payment-failure signals are LIVE
 *     (Subscription.status = PAST_DUE / GRACE_PERIOD).
 *   - Public diner payment-execution signals are EXPLICITLY excluded
 *     while public mobile-money execution remains pending (M13.x).
 */

export interface SignalOccurrence {
    sourceModule: string;
    sourceRef: string;
    title: string;
    message: string;
    payload: Record<string, unknown>;
}

@Injectable()
export class SourceSignalService {
    constructor(private readonly prisma: PrismaService) { }

    async evaluateLowStock(
        orgId: string,
        threshold?: number,
    ): Promise<SignalOccurrence[]> {
        const items = await this.prisma.inventoryItem.findMany({
            where: { orgId, isActive: true },
            select: {
                id: true,
                name: true,
                sku: true,
                reorderLevel: true,
                branchId: true,
            },
            take: 200,
        });
        const out: SignalOccurrence[] = [];
        for (const item of items) {
            const limit =
                typeof threshold === 'number'
                    ? threshold
                    : Number(item.reorderLevel ?? 0);
            if (limit <= 0) continue;
            const aggr = await this.prisma.stockBatch.aggregate({
                where: { orgId, itemId: item.id, remainingQty: { gt: 0 } },
                _sum: { remainingQty: true },
            });
            const onHand = Number(aggr._sum.remainingQty ?? 0);
            if (onHand <= limit) {
                out.push({
                    sourceModule: 'inventory',
                    sourceRef: `inventory_item:${item.id}`,
                    title: `Low stock: ${item.name}`,
                    message: `On-hand ${onHand} ≤ reorder ${limit}`,
                    payload: {
                        itemId: item.id,
                        itemName: item.name,
                        sku: item.sku,
                        onHand,
                        threshold: limit,
                        branchId: item.branchId,
                    },
                });
            }
        }
        return out;
    }

    async evaluateCashVariance(
        orgId: string,
        thresholdAbs?: number,
    ): Promise<SignalOccurrence[]> {
        const limit = typeof thresholdAbs === 'number' ? thresholdAbs : 1000;
        const summaries = await this.prisma.shiftCloseSummary.findMany({
            where: {
                orgId,
                variance: { not: null },
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return summaries
            .filter((s) => Math.abs(Number(s.variance ?? 0)) >= limit)
            .map((s) => ({
                sourceModule: 'shifts',
                sourceRef: `shift_close_summary:${s.id}`,
                title: 'Cash variance on shift close',
                message: `Variance ${Number(s.variance).toFixed(2)} (counted ${Number(s.countedCash ?? 0).toFixed(2)} vs expected ${Number(s.expectedCash).toFixed(2)})`,
                payload: {
                    summaryId: s.id,
                    shiftId: s.shiftId,
                    branchId: s.branchId,
                    variance: Number(s.variance),
                },
            }));
    }

    async evaluateBookingReminders(
        orgId: string,
        windowMinutes = 60 * 24,
    ): Promise<SignalOccurrence[]> {
        const now = new Date();
        const horizon = new Date(now.getTime() + windowMinutes * 60 * 1000);
        const reservations = await this.prisma.reservation.findMany({
            where: {
                orgId,
                reservationAt: { gte: now, lte: horizon },
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
            orderBy: { reservationAt: 'asc' },
            take: 50,
            select: {
                id: true,
                reservationAt: true,
                partySize: true,
                customerName: true,
                branchId: true,
            },
        });
        return reservations.map((r) => ({
            sourceModule: 'reservations',
            sourceRef: `reservation:${r.id}`,
            title: `Reservation reminder: ${r.customerName}`,
            message: `Party of ${r.partySize} at ${r.reservationAt.toISOString()}`,
            payload: {
                reservationId: r.id,
                customerName: r.customerName,
                partySize: r.partySize,
                reservationAt: r.reservationAt,
                branchId: r.branchId,
            },
        }));
    }

    async evaluateBillingPaymentFailures(orgId: string): Promise<SignalOccurrence[]> {
        // Owner SaaS billing only — never public diner payments.
        const subs = await this.prisma.subscription.findMany({
            where: {
                orgId,
                status: { in: ['PAST_DUE', 'GRACE_PERIOD'] },
            },
            include: { plan: { select: { code: true, name: true } } },
        });
        return subs.map((s: any) => ({
            sourceModule: 'billing',
            sourceRef: `subscription:${s.id}`,
            title: `SaaS billing payment failure (${s.status})`,
            message: `Subscription on plan ${s.plan?.code ?? 'unknown'} is ${s.status}`,
            payload: {
                subscriptionId: s.id,
                planCode: s.plan?.code,
                status: s.status,
                graceEndsAt: s.graceEndsAt ?? null,
                currentPeriodEnd: s.currentPeriodEnd ?? null,
            },
        }));
    }

    async evaluateOverdueVendorBills(orgId: string): Promise<SignalOccurrence[]> {
        const now = new Date();
        const bills = await this.prisma.vendorBill.findMany({
            where: {
                orgId,
                status: { in: ['APPROVED', 'PARTIALLY_PAID', 'OVERDUE'] },
                dueDate: { lt: now },
                outstandingAmount: { gt: 0 },
            },
            orderBy: { dueDate: 'asc' },
            take: 50,
            select: {
                id: true,
                billNumber: true,
                dueDate: true,
                outstandingAmount: true,
                branchId: true,
            },
        });
        return bills.map((b) => ({
            sourceModule: 'accounts-payable',
            sourceRef: `vendor_bill:${b.id}`,
            title: `Overdue vendor bill ${b.billNumber}`,
            message: `Due ${b.dueDate.toISOString().slice(0, 10)} — outstanding ${Number(b.outstandingAmount).toFixed(2)}`,
            payload: {
                billId: b.id,
                billNumber: b.billNumber,
                dueDate: b.dueDate,
                outstanding: Number(b.outstandingAmount),
                branchId: b.branchId,
            },
        }));
    }

    async evaluateShiftNotClosed(
        orgId: string,
        olderThanHours = 16,
    ): Promise<SignalOccurrence[]> {
        const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
        const shifts = await this.prisma.shift.findMany({
            where: { orgId, status: 'OPEN', openedAt: { lt: cutoff } },
            take: 50,
            select: { id: true, openedAt: true, branchId: true, shiftNumber: true },
        });
        return shifts.map((s) => ({
            sourceModule: 'shifts',
            sourceRef: `shift:${s.id}`,
            title: `Shift ${s.shiftNumber} still open`,
            message: `Opened ${s.openedAt.toISOString()} — over ${olderThanHours}h ago`,
            payload: { shiftId: s.id, branchId: s.branchId, openedAt: s.openedAt },
        }));
    }

    async evaluateLargeWastageSpike(
        orgId: string,
        thresholdAbsQty = 50,
    ): Promise<SignalOccurrence[]> {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const adjustments = await this.prisma.stockAdjustment.findMany({
            where: { orgId, createdAt: { gte: since } },
            take: 100,
            select: {
                id: true,
                itemId: true,
                qtyDelta: true,
                reason: true,
                branchId: true,
                createdAt: true,
            },
        });
        return adjustments
            .filter(
                (a) =>
                    Math.abs(Number(a.qtyDelta)) >= thresholdAbsQty &&
                    /wast|spoil|brea|theft/i.test(a.reason ?? ''),
            )
            .map((a) => ({
                sourceModule: 'inventory',
                sourceRef: `stock_adjustment:${a.id}`,
                title: 'Large wastage spike detected',
                message: `Adjustment qtyDelta=${Number(a.qtyDelta)} reason="${a.reason ?? ''}"`,
                payload: {
                    adjustmentId: a.id,
                    itemId: a.itemId,
                    branchId: a.branchId,
                    qtyDelta: Number(a.qtyDelta),
                    reason: a.reason,
                },
            }));
    }

    /**
     * Public diner payment failures are explicitly NOT a source here.
     * Public mobile-money execution remains pending (M13.x).
     */
    async evaluatePublicDinerPaymentFailures(
        _orgId: string,
    ): Promise<SignalOccurrence[]> {
        return [];
    }
}
