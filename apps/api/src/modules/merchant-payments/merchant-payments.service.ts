import {
    Injectable,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
    ConnectMerchantPaymentDto,
    UpdateMerchantPaymentConfigDto,
    MerchantPaymentReadiness,
} from './dto';

/**
 * Merchant Payment Connectivity service.
 *
 * BUSINESS MEANING:
 *   This module records a restaurant's *readiness* to one day accept public
 *   diner payments (reservation deposits, event tickets) via mobile money.
 *
 *   It is NOT a live PesaPal integration for diner-to-restaurant payments.
 *   It is NOT used for SaaS subscription billing — that is handled by the
 *   `billing-pesapal/` module, which is the only live PesaPal integration
 *   in this codebase.
 *
 *   The service is deliberately storage-only: connect / update / status.
 *   No external API calls are made.
 *
 * READINESS LIFECYCLE:
 *   NOT_CONFIGURED  →  PENDING_MTN | PENDING_AIRTEL  →  READY_FOR_INTEGRATION
 *                                                  →  LIVE  (only after a Nimbus
 *                                                            engineer wires the
 *                                                            mobile-money adapter)
 *   any state       →  DISABLED   (operator opt-out)
 *
 *   The DB enum (`MerchantPaymentConfigStatus`) only has PENDING / CONNECTED /
 *   FAILED / DISABLED, so we map readiness onto it:
 *     PENDING_MTN, PENDING_AIRTEL          -> PENDING
 *     READY_FOR_INTEGRATION, LIVE           -> CONNECTED
 *     DISABLED                              -> DISABLED
 *   The fine-grained readiness label is persisted in the `notes` field as
 *   a JSON-ish prefix `[readiness=...]` so that it survives without a
 *   schema change.
 */

const READINESS_PREFIX = '[readiness=';

function encodeReadiness(readiness: MerchantPaymentReadiness, notes?: string | null): string {
    const cleaned = (notes ?? '').replace(/^\[readiness=[^\]]+\]\s*/i, '');
    return `[readiness=${readiness}] ${cleaned}`.trim();
}

function decodeReadiness(
    persisted: { status: string; notes: string | null },
): { readiness: MerchantPaymentReadiness; notes: string | null } {
    const raw = persisted.notes ?? '';
    if (raw.startsWith(READINESS_PREFIX)) {
        const end = raw.indexOf(']');
        const readiness = raw.substring(READINESS_PREFIX.length, end) as MerchantPaymentReadiness;
        const notes = raw.substring(end + 1).trim() || null;
        return { readiness, notes };
    }
    // Fallback: derive readiness from the underlying enum.
    let readiness: MerchantPaymentReadiness;
    switch (persisted.status) {
        case 'CONNECTED':
            readiness = 'READY_FOR_INTEGRATION';
            break;
        case 'DISABLED':
            readiness = 'DISABLED';
            break;
        case 'FAILED':
            readiness = 'NOT_CONFIGURED';
            break;
        default:
            readiness = 'PENDING_MTN';
    }
    return { readiness, notes: raw || null };
}

function readinessToEnum(readiness: MerchantPaymentReadiness): 'PENDING' | 'CONNECTED' | 'DISABLED' {
    switch (readiness) {
        case 'PENDING_MTN':
        case 'PENDING_AIRTEL':
            return 'PENDING';
        case 'READY_FOR_INTEGRATION':
        case 'LIVE':
            return 'CONNECTED';
        case 'DISABLED':
            return 'DISABLED';
        default:
            return 'PENDING';
    }
}

@Injectable()
export class MerchantPaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async resolveOrgContext(userId: string): Promise<{ organizationId: string }> {
        const membership = await this.prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
        });
        if (!membership) {
            throw new BadRequestException('No active membership found');
        }
        return { organizationId: membership.organizationId };
    }

    async connect(orgId: string, dto: ConnectMerchantPaymentDto, userId: string) {
        const existing = await this.prisma.merchantPaymentConfig.findUnique({
            where: { orgId },
        });

        if (existing) {
            const decoded = decodeReadiness(existing);
            if (decoded.readiness === 'LIVE') {
                throw new ConflictException(
                    'Merchant public-payment configuration is already LIVE',
                );
            }
        }

        const readiness: MerchantPaymentReadiness = dto.readiness ?? 'PENDING_MTN';
        const enumStatus = readinessToEnum(readiness);
        const encodedNotes = encodeReadiness(readiness, dto.notes);

        const config = await this.prisma.merchantPaymentConfig.upsert({
            where: { orgId },
            update: { status: enumStatus, notes: encodedNotes, lastCheckedAt: new Date() },
            create: {
                orgId,
                // Provider is intentionally generic. Mobile-money providers (MTN/Airtel)
                // will be selected by the future integration; this is NOT a PesaPal
                // diner-payment integration.
                provider: 'MOBILE_MONEY',
                status: enumStatus,
                notes: encodedNotes,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'MERCHANT_PAYMENT_CONNECT_INITIATED',
            entityType: 'MerchantPaymentConfig',
            entityId: config.id,
            metadata: { provider: 'MOBILE_MONEY', readiness },
        });

        return this.shape(config);
    }

    async updateConfig(orgId: string, dto: UpdateMerchantPaymentConfigDto, userId: string) {
        const config = await this.prisma.merchantPaymentConfig.findUnique({
            where: { orgId },
        });

        if (!config) {
            throw new NotFoundException('No merchant payment configuration found');
        }

        const current = decodeReadiness(config);
        const readiness: MerchantPaymentReadiness = dto.readiness ?? current.readiness;
        const enumStatus = readinessToEnum(readiness);
        const encodedNotes = encodeReadiness(readiness, dto.notes ?? current.notes);

        const updated = await this.prisma.merchantPaymentConfig.update({
            where: { orgId },
            data: {
                status: enumStatus,
                notes: encodedNotes,
                lastCheckedAt: new Date(),
                connectedAt: readiness === 'LIVE' ? new Date() : config.connectedAt,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'MERCHANT_PAYMENT_CONFIG_UPDATED',
            entityType: 'MerchantPaymentConfig',
            entityId: updated.id,
            metadata: { readiness },
        });

        return this.shape(updated);
    }

    async getStatus(orgId: string) {
        const config = await this.prisma.merchantPaymentConfig.findUnique({
            where: { orgId },
        });

        if (!config) {
            return {
                configured: false,
                provider: null,
                readiness: 'NOT_CONFIGURED' as const,
                notes: null,
                live: false,
                message:
                    'Public diner payment collection is not yet configured. Mobile-money integration is pending.',
            };
        }

        return { configured: true, ...this.shape(config) };
    }

    private shape(config: {
        id: string;
        provider: string;
        status: string;
        notes: string | null;
        connectedAt: Date | null;
        lastCheckedAt: Date | null;
    }) {
        const { readiness, notes } = decodeReadiness(config);
        return {
            id: config.id,
            provider: config.provider,
            readiness,
            live: readiness === 'LIVE',
            notes,
            connectedAt: config.connectedAt,
            lastCheckedAt: config.lastCheckedAt,
            message:
                readiness === 'LIVE'
                    ? 'Public payment collection is LIVE.'
                    : 'Public payment collection is not yet live. Mobile-money integration is pending.',
        };
    }
}
