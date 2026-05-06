import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SourceSignalService } from './source-signal.service';
import { OwnerLiveQueryDto } from './dto';

/**
 * M40 — Owner Live Service
 *
 * Read-only projection of "what's happening right now" for an owner.
 * Combines:
 *   - the persistent owner_live_events log (append-only)
 *   - live aggregations from existing source modules (low stock, cash
 *     variance, billing payment failures, upcoming reservations).
 *
 * Designed to be safe to poll every few seconds — bounded `take` and
 * indexed queries on (orgId, createdAt).
 */
@Injectable()
export class OwnerLiveService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly signals: SourceSignalService,
    ) { }

    async resolveOrgContext(userId: string): Promise<{ organizationId: string }> {
        const m = await this.prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
        });
        if (!m) throw new ForbiddenException('No active membership found');
        return { organizationId: m.organizationId };
    }

    async getLiveFeed(orgId: string, q: OwnerLiveQueryDto) {
        const limit = q.limit ?? 25;
        const sinceDate = q.since ? new Date(q.since) : null;

        const where: any = { orgId };
        if (sinceDate && !isNaN(sinceDate.getTime())) {
            where.createdAt = { gte: sinceDate };
        }
        if (q.severity) where.severity = q.severity as any;

        const events = await this.prisma.ownerLiveEvent.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        // Live aggregations — bounded and cheap.
        const [lowStock, cashVar, bookingReminders, billingFailures] = await Promise.all([
            this.signals.evaluateLowStock(orgId),
            this.signals.evaluateCashVariance(orgId),
            this.signals.evaluateBookingReminders(orgId, 60 * 8),
            this.signals.evaluateBillingPaymentFailures(orgId),
        ]);

        return {
            events,
            counts: {
                events: events.length,
                lowStock: lowStock.length,
                cashVariance: cashVar.length,
                upcomingReservations: bookingReminders.length,
                billingPaymentFailures: billingFailures.length,
            },
            live: {
                lowStock: lowStock.slice(0, 10),
                cashVariance: cashVar.slice(0, 10),
                upcomingReservations: bookingReminders.slice(0, 10),
                billingPaymentFailures: billingFailures.slice(0, 10),
            },
            generatedAt: new Date().toISOString(),
            notes: {
                publicDinerPaymentExecution:
                    'Public diner payment execution is still pending (M13.x); ' +
                    'live diner payment-failure alerts are intentionally excluded.',
            },
        };
    }
}
