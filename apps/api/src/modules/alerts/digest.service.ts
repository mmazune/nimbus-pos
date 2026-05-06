import {
    Injectable,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ChannelDispatcherService } from './channel-dispatcher.service';
import { SourceSignalService } from './source-signal.service';
import { CreateDigestScheduleDto, UpdateDigestScheduleDto } from './dto';

/**
 * M40 — Digest Service
 *
 * Manages DigestSchedule CRUD plus a synchronous `runDigest` method that
 * aggregates signals across the configured digestType, formats a single
 * payload, and dispatches it through every configured channel.
 *
 * No cron is wired (no BullMQ/Redis in the repo). Operators can trigger
 * digests via POST /api/alerts/digests/:id/run; future cron wiring will
 * call the same method.
 */
@Injectable()
export class DigestService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly dispatcher: ChannelDispatcherService,
        private readonly signals: SourceSignalService,
    ) { }

    async resolveOrgContext(userId: string): Promise<{ organizationId: string }> {
        const m = await this.prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
        });
        if (!m) throw new ForbiddenException('No active membership found');
        return { organizationId: m.organizationId };
    }

    async list(orgId: string) {
        return this.prisma.digestSchedule.findMany({
            where: { orgId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async create(userId: string, orgId: string, dto: CreateDigestScheduleDto) {
        const existing = await this.prisma.digestSchedule.findUnique({
            where: { orgId_code: { orgId, code: dto.code } },
        });
        if (existing) {
            throw new ConflictException(`Digest schedule "${dto.code}" already exists`);
        }
        if (dto.branchId) {
            const branch = await this.prisma.branch.findFirst({
                where: { id: dto.branchId, organizationId: orgId },
                select: { id: true },
            });
            if (!branch) throw new BadRequestException('branchId not in this organization');
        }
        if (dto.frequency === 'WEEKLY' && (dto.dayOfWeek === undefined || dto.dayOfWeek === null)) {
            throw new BadRequestException('dayOfWeek is required when frequency is WEEKLY');
        }

        const created = await this.prisma.digestSchedule.create({
            data: {
                orgId,
                branchId: dto.branchId ?? null,
                code: dto.code,
                name: dto.name,
                description: dto.description ?? null,
                digestType: dto.digestType,
                frequency: dto.frequency as any,
                hourLocal: dto.hourLocal ?? 7,
                dayOfWeek: dto.dayOfWeek ?? null,
                timezone: dto.timezone ?? 'UTC',
                channelCodes: dto.channelCodes,
                status: (dto.status ?? 'ACTIVE') as any,
                nextRunAt: this.computeNextRunAt(dto.frequency, dto.hourLocal ?? 7, dto.dayOfWeek),
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'DIGEST_SCHEDULE_CREATED',
            entityType: 'DigestSchedule',
            entityId: created.id,
            metadata: {
                code: created.code,
                frequency: created.frequency,
                digestType: created.digestType,
            },
        });
        return created;
    }

    async update(
        userId: string,
        orgId: string,
        id: string,
        dto: UpdateDigestScheduleDto,
    ) {
        const existing = await this.prisma.digestSchedule.findFirst({
            where: { id, orgId },
        });
        if (!existing) throw new NotFoundException('Digest schedule not found');

        const updated = await this.prisma.digestSchedule.update({
            where: { id },
            data: {
                name: dto.name ?? existing.name,
                description: dto.description ?? existing.description,
                frequency: (dto.frequency ?? existing.frequency) as any,
                hourLocal: dto.hourLocal ?? existing.hourLocal,
                dayOfWeek:
                    dto.dayOfWeek !== undefined ? dto.dayOfWeek : existing.dayOfWeek,
                channelCodes: dto.channelCodes ?? existing.channelCodes,
                status: (dto.status ?? existing.status) as any,
                updatedAt: new Date(),
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action:
                dto.status === 'DISABLED'
                    ? 'DIGEST_SCHEDULE_DISABLED'
                    : 'DIGEST_SCHEDULE_UPDATED',
            entityType: 'DigestSchedule',
            entityId: updated.id,
            metadata: { code: updated.code, status: updated.status },
        });
        return updated;
    }

    async runDigest(userId: string, orgId: string, id: string) {
        const schedule = await this.prisma.digestSchedule.findFirst({
            where: { id, orgId },
        });
        if (!schedule) throw new NotFoundException('Digest schedule not found');
        if (schedule.status !== 'ACTIVE') {
            throw new ConflictException('Cannot run a non-ACTIVE digest schedule');
        }
        if (!schedule.channelCodes.length) {
            throw new BadRequestException('Digest schedule has no channels configured');
        }

        const sections = await this.collectSections(orgId, schedule.digestType);
        const summary = formatDigest(schedule.name, sections);

        const channels = await this.prisma.alertChannel.findMany({
            where: { orgId, code: { in: schedule.channelCodes }, status: 'ACTIVE' },
        });

        const deliveries = [];
        for (const channel of channels) {
            const outcome = await this.dispatcher.dispatch(channel, {
                title: `Digest: ${schedule.name}`,
                message: summary,
                severity: 'INFO',
                alertType: `DIGEST:${schedule.digestType}`,
                context: { sections },
            });
            const delivery = await this.prisma.alertDelivery.create({
                data: {
                    orgId,
                    ruleId: null,
                    channelId: channel.id,
                    alertType: `DIGEST:${schedule.digestType}`,
                    severity: 'INFO' as any,
                    status: outcome.ok
                        ? ('SENT' as any)
                        : outcome.retryable
                            ? ('RETRY_SCHEDULED' as any)
                            : ('FAILED' as any),
                    attemptCount: 1,
                    maxAttempts: 3,
                    payload: { title: schedule.name, summary, sections } as any,
                    lastError: outcome.ok ? null : outcome.error,
                    failureReason: outcome.ok ? null : outcome.failureReason,
                    sentAt: outcome.ok ? outcome.sentAt : null,
                    isTest: false,
                    triggeredById: userId,
                },
            });
            deliveries.push(delivery);
        }

        await this.prisma.digestSchedule.update({
            where: { id: schedule.id },
            data: {
                lastRunAt: new Date(),
                nextRunAt: this.computeNextRunAt(
                    schedule.frequency,
                    schedule.hourLocal,
                    schedule.dayOfWeek,
                ),
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'DIGEST_RUN_TRIGGERED',
            entityType: 'DigestSchedule',
            entityId: schedule.id,
            metadata: {
                code: schedule.code,
                digestType: schedule.digestType,
                deliveries: deliveries.length,
            },
        });

        return { scheduleId: schedule.id, sections, deliveries };
    }

    // ── helpers ──

    private async collectSections(
        orgId: string,
        digestType: string,
    ): Promise<Record<string, unknown[]>> {
        const lower = digestType.toLowerCase();
        const out: Record<string, unknown[]> = {};
        if (lower.includes('owner') || lower.includes('daily')) {
            out.lowStock = await this.signals.evaluateLowStock(orgId);
            out.cashVariance = await this.signals.evaluateCashVariance(orgId);
            out.upcomingReservations = await this.signals.evaluateBookingReminders(
                orgId,
                60 * 24,
            );
            out.billingPaymentFailures =
                await this.signals.evaluateBillingPaymentFailures(orgId);
            out.overdueVendorBills = await this.signals.evaluateOverdueVendorBills(orgId);
        } else if (lower.includes('inventory')) {
            out.lowStock = await this.signals.evaluateLowStock(orgId);
            out.wastageSpikes = await this.signals.evaluateLargeWastageSpike(orgId);
        } else if (lower.includes('finance') || lower.includes('billing')) {
            out.billingPaymentFailures =
                await this.signals.evaluateBillingPaymentFailures(orgId);
            out.overdueVendorBills =
                await this.signals.evaluateOverdueVendorBills(orgId);
            out.cashVariance = await this.signals.evaluateCashVariance(orgId);
        } else {
            out.lowStock = await this.signals.evaluateLowStock(orgId);
            out.cashVariance = await this.signals.evaluateCashVariance(orgId);
        }
        return out;
    }

    private computeNextRunAt(
        frequency: string,
        hourLocal: number,
        dayOfWeek?: number | null,
    ): Date {
        const next = new Date();
        next.setUTCMinutes(0, 0, 0);
        next.setUTCHours(hourLocal);
        if (frequency === 'DAILY') {
            if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
            return next;
        }
        // WEEKLY
        const target = typeof dayOfWeek === 'number' ? dayOfWeek : 1;
        while (next.getUTCDay() !== target || next.getTime() <= Date.now()) {
            next.setUTCDate(next.getUTCDate() + 1);
        }
        return next;
    }
}

function formatDigest(name: string, sections: Record<string, unknown[]>): string {
    const lines = [`Digest "${name}"`, ''];
    for (const [key, rows] of Object.entries(sections)) {
        lines.push(`• ${key}: ${rows.length}`);
    }
    return lines.join('\n');
}
