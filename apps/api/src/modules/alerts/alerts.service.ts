import {
    Injectable,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
    ChannelDispatcherService,
    DispatchPayload,
} from './channel-dispatcher.service';
import {
    CreateAlertRuleDto,
    UpdateAlertRuleDto,
    CreateAlertChannelDto,
    UpdateAlertChannelDto,
    TestAlertDto,
    ListDeliveriesQueryDto,
} from './dto';
import { createHash } from 'crypto';

/**
 * M40 — Alerts Service
 *
 * Manages AlertRule CRUD, AlertChannel CRUD, AlertDelivery listing+retry,
 * and the synchronous "test alert" path that exercises the channel
 * dispatcher end-to-end. Owner SaaS billing alerts are LIVE; public diner
 * payment-execution alerts are explicitly out-of-scope (see source-signal).
 */
@Injectable()
export class AlertsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly dispatcher: ChannelDispatcherService,
    ) { }

    // ── Org context resolution (mirrors billing.service) ──
    async resolveOrgContext(userId: string): Promise<{ organizationId: string }> {
        const membership = await this.prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
        });
        if (!membership) {
            throw new ForbiddenException('No active membership found');
        }
        return { organizationId: membership.organizationId };
    }

    // ──────────────────────────────────────────────────────────
    // Alert Rules
    // ──────────────────────────────────────────────────────────

    async listRules(orgId: string) {
        return this.prisma.alertRule.findMany({
            where: { orgId },
            orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        });
    }

    async createRule(userId: string, orgId: string, dto: CreateAlertRuleDto) {
        const existing = await this.prisma.alertRule.findUnique({
            where: { orgId_code: { orgId, code: dto.code } },
        });
        if (existing) {
            throw new ConflictException(`Alert rule with code "${dto.code}" already exists`);
        }
        if (dto.branchId) {
            const branch = await this.prisma.branch.findFirst({
                where: { id: dto.branchId, organizationId: orgId },
                select: { id: true },
            });
            if (!branch) throw new BadRequestException('branchId not in this organization');
        }
        const rule = await this.prisma.alertRule.create({
            data: {
                orgId,
                branchId: dto.branchId ?? null,
                code: dto.code,
                name: dto.name,
                description: dto.description ?? null,
                type: dto.type as any,
                severity: (dto.severity ?? 'WARNING') as any,
                status: (dto.status ?? 'ACTIVE') as any,
                sourceModule: deriveSourceModule(dto.type),
                alertCategory: (dto.alertCategory ?? deriveAlertCategory(dto.type)) as any,
                channelIntent: (dto.channelIntent ?? deriveChannelIntent(dto.type)) as any,
                thresholdConfig: (dto.thresholdConfig ?? {}) as any,
                channelCodes: dto.channelCodes ?? [],
                escalationConfig: (dto.escalationConfig ?? {}) as any,
            },
        });
        await this.audit.log({
            actorUserId: userId,
            action: 'ALERT_RULE_CREATED',
            entityType: 'AlertRule',
            entityId: rule.id,
            metadata: { code: rule.code, type: rule.type, severity: rule.severity },
        });
        return rule;
    }

    async updateRule(
        userId: string,
        orgId: string,
        ruleId: string,
        dto: UpdateAlertRuleDto,
    ) {
        const existing = await this.prisma.alertRule.findFirst({
            where: { id: ruleId, orgId },
        });
        if (!existing) throw new NotFoundException('Alert rule not found');

        const updated = await this.prisma.alertRule.update({
            where: { id: ruleId },
            data: {
                name: dto.name ?? existing.name,
                description: dto.description ?? existing.description,
                severity: (dto.severity ?? existing.severity) as any,
                status: (dto.status ?? existing.status) as any,
                ...(dto.alertCategory && { alertCategory: dto.alertCategory as any }),
                ...(dto.channelIntent && { channelIntent: dto.channelIntent as any }),
                thresholdConfig:
                    dto.thresholdConfig !== undefined
                        ? (dto.thresholdConfig as any)
                        : (existing.thresholdConfig as any),
                channelCodes: dto.channelCodes ?? existing.channelCodes,
                escalationConfig:
                    dto.escalationConfig !== undefined
                        ? (dto.escalationConfig as any)
                        : (existing.escalationConfig as any),
                updatedAt: new Date(),
            },
        });
        await this.audit.log({
            actorUserId: userId,
            action:
                dto.status === 'DISABLED' ? 'ALERT_RULE_DISABLED' : 'ALERT_RULE_UPDATED',
            entityType: 'AlertRule',
            entityId: updated.id,
            metadata: { code: updated.code, status: updated.status },
        });
        return updated;
    }

    // ──────────────────────────────────────────────────────────
    // Alert Channels
    // ──────────────────────────────────────────────────────────

    async listChannels(orgId: string) {
        return this.prisma.alertChannel.findMany({
            where: { orgId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createChannel(userId: string, orgId: string, dto: CreateAlertChannelDto) {
        const existing = await this.prisma.alertChannel.findUnique({
            where: { orgId_code: { orgId, code: dto.code } },
        });
        if (existing) {
            throw new ConflictException(`Alert channel "${dto.code}" already exists`);
        }
        const channel = await this.prisma.alertChannel.create({
            data: {
                orgId,
                code: dto.code,
                name: dto.name,
                type: dto.type as any,
                status: (dto.status ?? 'ACTIVE') as any,
                config: (dto.config ?? {}) as any,
            },
        });
        await this.audit.log({
            actorUserId: userId,
            action: 'ALERT_CHANNEL_CREATED',
            entityType: 'AlertChannel',
            entityId: channel.id,
            metadata: { code: channel.code, type: channel.type },
        });
        return channel;
    }

    async updateChannel(
        userId: string,
        orgId: string,
        channelId: string,
        dto: UpdateAlertChannelDto,
    ) {
        const existing = await this.prisma.alertChannel.findFirst({
            where: { id: channelId, orgId },
        });
        if (!existing) throw new NotFoundException('Alert channel not found');

        const updated = await this.prisma.alertChannel.update({
            where: { id: channelId },
            data: {
                name: dto.name ?? existing.name,
                status: (dto.status ?? existing.status) as any,
                config:
                    dto.config !== undefined
                        ? (dto.config as any)
                        : (existing.config as any),
                updatedAt: new Date(),
            },
        });
        await this.audit.log({
            actorUserId: userId,
            action:
                dto.status === 'DISABLED'
                    ? 'ALERT_CHANNEL_DISABLED'
                    : 'ALERT_CHANNEL_UPDATED',
            entityType: 'AlertChannel',
            entityId: updated.id,
            metadata: { code: updated.code, status: updated.status },
        });
        return updated;
    }

    // ──────────────────────────────────────────────────────────
    // Test alert dispatch
    // ──────────────────────────────────────────────────────────

    async sendTestAlert(userId: string, orgId: string, dto: TestAlertDto) {
        const channels = await this.prisma.alertChannel.findMany({
            where: { orgId, code: { in: dto.channelCodes } },
        });
        if (channels.length === 0) {
            throw new BadRequestException('None of the supplied channel codes exist for this org');
        }
        let rule = null as Awaited<ReturnType<typeof this.prisma.alertRule.findUnique>> | null;
        if (dto.ruleCode) {
            rule = await this.prisma.alertRule.findUnique({
                where: { orgId_code: { orgId, code: dto.ruleCode } },
            });
        }

        const severity = dto.severity ?? rule?.severity ?? 'INFO';
        const alertType = (rule?.type as string) ?? 'TEST_ALERT';
        const title = dto.title ?? `Test alert (${severity})`;
        const message =
            dto.message ?? 'This is a test alert dispatched via POST /api/alerts/test';

        const dispatchPayload: DispatchPayload = {
            title,
            message,
            severity,
            alertType,
            context: dto.context ?? {},
        };

        const results = [];
        for (const channel of channels) {
            const dedupeKey = makeDedupeKey({
                orgId,
                ruleId: rule?.id ?? null,
                alertType,
                title,
                isTest: true,
            });

            const outcome = await this.dispatcher.dispatch(
                channel,
                dispatchPayload,
                { forceFailure: dto.forceFailure },
            );

            const status = outcome.ok
                ? 'SENT'
                : outcome.retryable
                    ? 'RETRY_SCHEDULED'
                    : 'FAILED';

            const delivery = await this.prisma.alertDelivery.create({
                data: {
                    orgId,
                    ruleId: rule?.id ?? null,
                    channelId: channel.id,
                    alertType: alertType as any,
                    severity: severity as any,
                    status: status as any,
                    attemptCount: 1,
                    maxAttempts: 3,
                    payload: dispatchPayload as any,
                    lastError: outcome.ok ? null : outcome.error,
                    failureReason: outcome.ok ? null : outcome.failureReason,
                    dedupeKey,
                    sentAt: outcome.ok ? outcome.sentAt : null,
                    nextRetryAt:
                        !outcome.ok && outcome.retryable
                            ? new Date(Date.now() + 5 * 60 * 1000)
                            : null,
                    isTest: true,
                    triggeredById: userId,
                },
            });
            results.push(delivery);
        }

        await this.audit.log({
            actorUserId: userId,
            action: 'ALERT_TEST_DISPATCHED',
            entityType: 'AlertDelivery',
            entityId: results.map((r) => r.id).join(','),
            metadata: {
                ruleCode: dto.ruleCode ?? null,
                channelCodes: dto.channelCodes,
                count: results.length,
            },
        });

        return { count: results.length, deliveries: results };
    }

    // ──────────────────────────────────────────────────────────
    // Deliveries — listing + retry
    // ──────────────────────────────────────────────────────────

    async listDeliveries(orgId: string, q: ListDeliveriesQueryDto) {
        const where: any = { orgId };
        if (q.status) where.status = q.status as any;
        if (q.ruleCode) {
            const rule = await this.prisma.alertRule.findUnique({
                where: { orgId_code: { orgId, code: q.ruleCode } },
                select: { id: true },
            });
            where.ruleId = rule?.id ?? '__none__';
        }
        return this.prisma.alertDelivery.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: q.limit ?? 50,
            include: {
                channel: { select: { code: true, type: true } },
                rule: { select: { code: true, type: true } },
            },
        });
    }

    async retryDelivery(userId: string, orgId: string, deliveryId: string) {
        const delivery = await this.prisma.alertDelivery.findFirst({
            where: { id: deliveryId, orgId },
            include: { channel: true },
        });
        if (!delivery) throw new NotFoundException('Alert delivery not found');
        if (delivery.status === 'SENT') {
            throw new ConflictException('Delivery already SENT');
        }
        if (delivery.attemptCount >= delivery.maxAttempts) {
            const exhausted = await this.prisma.alertDelivery.update({
                where: { id: deliveryId },
                data: { status: 'RETRY_EXHAUSTED' as any, updatedAt: new Date() },
            });
            await this.audit.log({
                actorUserId: userId,
                action: 'ALERT_DELIVERY_RETRY_EXHAUSTED',
                entityType: 'AlertDelivery',
                entityId: exhausted.id,
                metadata: { attemptCount: exhausted.attemptCount },
            });
            return exhausted;
        }

        const payload = delivery.payload as unknown as DispatchPayload;
        const outcome = await this.dispatcher.dispatch(delivery.channel, payload);
        const newAttempt = delivery.attemptCount + 1;
        const status = outcome.ok
            ? 'SENT'
            : outcome.retryable && newAttempt < delivery.maxAttempts
                ? 'RETRY_SCHEDULED'
                : outcome.retryable
                    ? 'RETRY_EXHAUSTED'
                    : 'FAILED';

        const updated = await this.prisma.alertDelivery.update({
            where: { id: deliveryId },
            data: {
                attemptCount: newAttempt,
                status: status as any,
                lastError: outcome.ok ? null : outcome.error,
                failureReason: outcome.ok ? null : outcome.failureReason,
                sentAt: outcome.ok ? outcome.sentAt : delivery.sentAt,
                nextRetryAt:
                    !outcome.ok && outcome.retryable && newAttempt < delivery.maxAttempts
                        ? new Date(Date.now() + 5 * 60 * 1000 * newAttempt)
                        : null,
                updatedAt: new Date(),
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'ALERT_DELIVERY_RETRIED',
            entityType: 'AlertDelivery',
            entityId: updated.id,
            metadata: {
                attempt: newAttempt,
                status: updated.status,
                ok: outcome.ok,
            },
        });
        return updated;
    }
}

// ── helpers ──

function deriveAlertCategory(type: string): string {
    switch (type) {
        case 'LOW_STOCK':
        case 'CASH_VARIANCE':
        case 'SHIFT_NOT_CLOSED':
            return 'OPERATIONAL_IMMEDIATE';
        case 'BILLING_PAYMENT_FAILURE':
        case 'OVERDUE_VENDOR_BILL':
        case 'FRANCHISE_BRANCH_AT_RISK':
        case 'LARGE_WASTAGE_SPIKE':
            return 'OWNER_FINANCE';
        case 'BOOKING_REMINDER':
        case 'UPCOMING_EVENT_STOCK_RISK':
            return 'BOOKING_EVENT';
        case 'FAILED_WEBHOOK_DELIVERY':
            return 'TECHNICAL_INTEGRATION';
        default:
            return 'OPERATIONAL_IMMEDIATE';
    }
}

function deriveChannelIntent(type: string): string {
    switch (type) {
        case 'LOW_STOCK':
        case 'SHIFT_NOT_CLOSED':
            return 'MOBILE_SMS';
        case 'CASH_VARIANCE':
        case 'BILLING_PAYMENT_FAILURE':
            return 'ALL_CHANNELS';
        case 'BOOKING_REMINDER':
        case 'OVERDUE_VENDOR_BILL':
        case 'FRANCHISE_BRANCH_AT_RISK':
        case 'LARGE_WASTAGE_SPIKE':
        case 'UPCOMING_EVENT_STOCK_RISK':
            return 'EMAIL_DIGEST';
        case 'FAILED_WEBHOOK_DELIVERY':
            return 'SLACK_WEBHOOK';
        default:
            return 'EMAIL_DIGEST';
    }
}

function deriveSourceModule(type: string): string {
    switch (type) {
        case 'LOW_STOCK':
        case 'LARGE_WASTAGE_SPIKE':
            return 'inventory';
        case 'CASH_VARIANCE':
        case 'SHIFT_NOT_CLOSED':
            return 'shifts';
        case 'BOOKING_REMINDER':
            return 'reservations';
        case 'BILLING_PAYMENT_FAILURE':
            return 'billing';
        case 'OVERDUE_VENDOR_BILL':
            return 'accounts-payable';
        case 'UPCOMING_EVENT_STOCK_RISK':
            return 'events';
        case 'FAILED_WEBHOOK_DELIVERY':
            return 'dev-portal';
        case 'FRANCHISE_BRANCH_AT_RISK':
            return 'franchise';
        default:
            return 'unknown';
    }
}

function makeDedupeKey(input: {
    orgId: string;
    ruleId: string | null;
    alertType: string;
    title: string;
    isTest: boolean;
}): string {
    const h = createHash('sha256');
    h.update(input.orgId);
    h.update('|');
    h.update(input.ruleId ?? '');
    h.update('|');
    h.update(input.alertType);
    h.update('|');
    h.update(input.title);
    h.update('|');
    h.update(input.isTest ? `test:${Date.now()}:${Math.random()}` : 'live');
    return h.digest('hex').slice(0, 32);
}
