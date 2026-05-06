import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
    CreateReservationCheckoutDto,
    CreateEventBookingCheckoutDto,
    PublicPaymentReconcileDto,
} from './dto';

/**
 * Public commerce payment service — SCAFFOLD ONLY.
 *
 * IMPORTANT BUSINESS RULE:
 *   These endpoints exist to define the public-diner payment contract,
 *   but they DO NOT execute any payment.
 *
 *   Public diner payments (reservation deposits, event tickets) are
 *   pending the MTN / Airtel mobile-money integration. They are NOT
 *   handled by PesaPal. PesaPal in this repo is reserved exclusively
 *   for owner SaaS subscription billing — see `billing-pesapal/`.
 *
 *   Until the mobile-money integration is finalised, every endpoint here
 *   validates input, persists a PendingPaymentIntent row for traceability,
 *   and returns a uniform pending-integration response.
 */
const PENDING_RESPONSE = {
    status: 'PENDING_INTEGRATION' as const,
    provider: 'MOBILE_MONEY' as const,
    message:
        'Public commerce payment execution is not yet enabled pending MTN/Airtel integration confirmation.',
};

@Injectable()
export class PublicCommercePaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async createReservationCheckout(dto: CreateReservationCheckoutDto) {
        const hold = await this.prisma.reservationHold.findUnique({
            where: { id: dto.holdId },
        });

        if (!hold) throw new NotFoundException('Reservation hold not found');
        if (hold.status !== 'HELD') {
            throw new BadRequestException(`Cannot checkout hold in status ${hold.status}`);
        }

        const intent = await this.prisma.pendingPaymentIntent.create({
            data: {
                orgId: hold.orgId,
                paymentType: 'RESERVATION',
                referenceId: hold.id,
                status: 'NOT_ENABLED',
                reason: PENDING_RESPONSE.message,
            },
        });

        await this.audit.log({
            action: 'PUBLIC_PAYMENT_CHECKOUT_ATTEMPTED',
            entityType: 'PendingPaymentIntent',
            entityId: intent.id,
            metadata: {
                paymentType: 'RESERVATION',
                holdId: dto.holdId,
                provider: PENDING_RESPONSE.provider,
            },
        });

        return { intentId: intent.id, ...PENDING_RESPONSE };
    }

    async createEventBookingCheckout(dto: CreateEventBookingCheckoutDto) {
        const hold = await this.prisma.eventBookingHold.findUnique({
            where: { id: dto.holdId },
        });

        if (!hold) throw new NotFoundException('Event booking hold not found');
        if (hold.status !== 'HELD') {
            throw new BadRequestException(`Cannot checkout booking in status ${hold.status}`);
        }

        const intent = await this.prisma.pendingPaymentIntent.create({
            data: {
                orgId: hold.orgId,
                paymentType: 'EVENT_BOOKING',
                referenceId: hold.id,
                status: 'NOT_ENABLED',
                reason: PENDING_RESPONSE.message,
            },
        });

        await this.audit.log({
            action: 'PUBLIC_PAYMENT_CHECKOUT_ATTEMPTED',
            entityType: 'PendingPaymentIntent',
            entityId: intent.id,
            metadata: {
                paymentType: 'EVENT_BOOKING',
                holdId: dto.holdId,
                provider: PENDING_RESPONSE.provider,
            },
        });

        return { intentId: intent.id, ...PENDING_RESPONSE };
    }

    async handleCallback(_orderTrackingId: string) {
        // Public-diner payment callbacks are documentation-only contracts at this stage.
        // No external provider is wired up. Any inbound call is acknowledged but no-op'd.
        return { ...PENDING_RESPONSE };
    }

    async handleIpn(_body: Record<string, unknown>) {
        // Public-diner payment IPN/webhook is a placeholder. The future MTN/Airtel
        // adapter will replace this; today it just returns the pending response.
        return { ...PENDING_RESPONSE };
    }

    async reconcileStatus(dto: PublicPaymentReconcileDto) {
        return {
            orderTrackingId: dto.orderTrackingId,
            ...PENDING_RESPONSE,
        };
    }
}
