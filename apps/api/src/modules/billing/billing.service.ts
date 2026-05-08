import {
    Injectable,
    ForbiddenException,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
    UpdateSubscriptionDto,
    CreateApiKeyDto,
    CreateWebhookDto,
    UpdateWebhookDto,
    CreateSupportSessionDto,
    CloseSupportSessionDto,
    UsageQueryDto,
} from './dto';
import { randomBytes, createHash } from 'crypto';
import type {
    SubscriptionStatus,
    BillingCycle,
    UsageMetricType,
    WebhookEventType,
    WebhookStatus,
} from '@prisma/client';

// Valid subscription transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING_PAYMENT: ['ACTIVE', 'CANCELLED'],
    TRIAL: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['GRACE_PERIOD', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'],
    GRACE_PERIOD: ['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'],
    PAST_DUE: ['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED'],
    SUSPENDED: ['ACTIVE', 'CANCELLED'],
    CANCELLED: [],
};

@Injectable()
export class BillingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ── Org context resolution ──

    async resolveOrgContext(userId: string): Promise<{ organizationId: string }> {
        const membership = await this.prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
        });
        if (!membership) {
            throw new ForbiddenException('No active membership found');
        }
        return { organizationId: membership.organizationId };
    }

    // ── Billing overview ──

    async getBillingOverview(orgId: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { orgId },
            include: { plan: true },
        });

        if (!subscription) {
            return {
                subscription: null,
                plan: null,
                limits: null,
                usage: [],
            };
        }

        const plan = subscription.plan;
        const now = new Date();
        const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const usage = await this.prisma.usageMeter.findMany({
            where: {
                orgId,
                windowStart: { gte: windowStart },
                windowEnd: { lte: windowEnd },
            },
        });

        // Build live counts for current-state metrics
        const [branchCount, userCount, apiKeyCount, webhookCount] = await Promise.all([
            this.prisma.branch.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
            this.prisma.membership.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
            this.prisma.apiKey.count({ where: { orgId, status: 'ACTIVE' } }),
            this.prisma.webhookEndpoint.count({ where: { orgId, status: 'ACTIVE' } }),
        ]);

        // ── M39 PLAN-CATALOG CORRECTION ──
        // The only enforced commercial cap is the location (branch) count.
        // Feature gating is intentionally absent: every plan grants the full
        // Nimbus feature set. The `upgradeRequired` flag below tells the UI
        // whether the customer must upgrade to add another location.
        const upgradeRequired = branchCount >= plan.maxBranches;
        const recommendedNextPlan =
            upgradeRequired && plan.code === 'solo'
                ? 'growth'
                : upgradeRequired && plan.code === 'growth'
                    ? 'franchise'
                    : null;

        return {
            subscription: {
                id: subscription.id,
                status: subscription.status,
                billingCycle: subscription.billingCycle,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
                trialEndsAt: subscription.trialEndsAt,
                graceEndsAt: subscription.graceEndsAt,
                cancelledAt: subscription.cancelledAt,
            },
            plan: {
                id: plan.id,
                code: plan.code,
                name: plan.name,
                priceMonthly: plan.priceMonthly.toString(),
                priceAnnual: plan.priceAnnual.toString(),
                supportTier: plan.supportTier,
            },
            limits: {
                maxBranches: plan.maxBranches,
                maxUsers: plan.maxUsers,
                maxApiKeys: plan.maxApiKeys,
                webhooksEnabled: plan.webhooksEnabled,
                maxWebhookEndpoints: plan.maxWebhookEndpoints,
                analyticsEnabled: plan.analyticsEnabled,
                franchiseEnabled: plan.franchiseEnabled,
            },
            currentUsage: {
                branches: branchCount,
                activeUsers: userCount,
                apiKeys: apiKeyCount,
                webhookEndpoints: webhookCount,
            },
            locationCapacity: {
                current: branchCount,
                allowed: plan.maxBranches,
                upgradeRequired,
                recommendedNextPlan,
                note: 'Plan enforcement is location-count only. All plans include the full Nimbus feature set.',
            },
            usage: usage.map((u) => ({
                metricType: u.metricType,
                currentValue: u.currentValue.toString(),
                limitValue: u.limitValue?.toString() ?? null,
                windowStart: u.windowStart,
                windowEnd: u.windowEnd,
            })),
        };
    }

    // ── Subscription lifecycle ──

    async updateSubscription(orgId: string, dto: UpdateSubscriptionDto, userId: string) {
        const existing = await this.prisma.subscription.findUnique({
            where: { orgId },
            include: { plan: true },
        });

        if (!existing) {
            throw new NotFoundException('No subscription found for this organization');
        }

        // Handle plan change
        if (dto.planCode) {
            const newPlan = await this.prisma.plan.findUnique({
                where: { code: dto.planCode },
            });
            if (!newPlan || newPlan.status !== 'ACTIVE') {
                throw new BadRequestException(`Plan "${dto.planCode}" not found or not active`);
            }

            // Enforce plan limits on downgrade
            await this.enforcePlanLimitsOnChange(orgId, newPlan);

            const updated = await this.prisma.subscription.update({
                where: { orgId },
                data: {
                    planId: newPlan.id,
                    billingCycle: dto.billingCycle
                        ? (dto.billingCycle as BillingCycle)
                        : existing.billingCycle,
                    updatedAt: new Date(),
                },
                include: { plan: true },
            });

            await this.audit.log({
                actorUserId: userId,
                action: 'SUBSCRIPTION_PLAN_CHANGED',
                entityType: 'Subscription',
                entityId: updated.id,
                metadata: {
                    previousPlanId: existing.planId,
                    previousPlanCode: existing.plan.code,
                    newPlanId: newPlan.id,
                    newPlanCode: newPlan.code,
                },
            });

            return this.formatSubscription(updated);
        }

        // Handle status change
        if (dto.status) {
            const allowed = VALID_TRANSITIONS[existing.status] ?? [];
            if (!allowed.includes(dto.status)) {
                throw new ConflictException(
                    `Cannot transition subscription from ${existing.status} to ${dto.status}`,
                );
            }

            const updateData: Record<string, unknown> = {
                status: dto.status as SubscriptionStatus,
                updatedAt: new Date(),
            };

            if (dto.status === 'CANCELLED') {
                updateData.cancelledAt = new Date();
                updateData.cancelReason = dto.cancelReason ?? null;
            }

            if (dto.status === 'GRACE_PERIOD') {
                updateData.graceEndsAt = new Date(
                    Date.now() + existing.plan.gracePeriodDays * 24 * 60 * 60 * 1000,
                );
            }

            const updated = await this.prisma.subscription.update({
                where: { orgId },
                data: updateData,
                include: { plan: true },
            });

            await this.audit.log({
                actorUserId: userId,
                action: 'SUBSCRIPTION_STATUS_CHANGED',
                entityType: 'Subscription',
                entityId: updated.id,
                metadata: {
                    previousStatus: existing.status,
                    newStatus: dto.status,
                    cancelReason: dto.cancelReason,
                },
            });

            return this.formatSubscription(updated);
        }

        // Only billing cycle change
        if (dto.billingCycle) {
            const updated = await this.prisma.subscription.update({
                where: { orgId },
                data: {
                    billingCycle: dto.billingCycle as BillingCycle,
                    updatedAt: new Date(),
                },
                include: { plan: true },
            });
            return this.formatSubscription(updated);
        }

        return this.formatSubscription(existing);
    }

    // ── Plan enforcement ──

    async enforcePlanLimitsOnChange(
        orgId: string,
        plan: {
            maxBranches: number;
            maxUsers: number;
            maxApiKeys: number;
            maxWebhookEndpoints: number;
        },
    ) {
        // ── M39 PLAN-CATALOG CORRECTION ──
        // Only the location (branch) cap is enforced when changing plans.
        // Users / API keys / webhooks are NOT gated by plan tier.
        const branchCount = await this.prisma.branch.count({
            where: { organizationId: orgId, status: 'ACTIVE' },
        });

        if (branchCount > plan.maxBranches) {
            throw new ConflictException({
                message: 'Plan change blocked: current location count exceeds target plan limit',
                violations: [
                    `Current locations (${branchCount}) exceed target plan limit (${plan.maxBranches})`,
                ],
            });
        }
    }

    async checkPlanLimit(orgId: string, resource: 'API_KEY' | 'WEBHOOK' | 'BRANCH', userId?: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { orgId },
            include: { plan: true },
        });

        if (!subscription) {
            throw new ForbiddenException('No active subscription');
        }

        // Allow reads during grace/suspended. Block creates only when cancelled.
        if (['CANCELLED'].includes(subscription.status)) {
            throw new ForbiddenException('Subscription is cancelled. Cannot create resources.');
        }

        const plan = subscription.plan;

        // ── M39 PLAN-CATALOG CORRECTION ──
        // Only BRANCH (location) is enforced. API keys and webhooks are
        // intentionally NOT gated by plan tier — every plan grants the full
        // Nimbus feature set, the only commercial cap is location count.
        if (resource === 'API_KEY' || resource === 'WEBHOOK') {
            return; // no-op; included for backwards compat with existing callers
        }

        if (resource === 'BRANCH') {
            const count = await this.prisma.branch.count({
                where: { organizationId: orgId, status: 'ACTIVE' },
            });
            if (count >= plan.maxBranches) {
                const recommendedNextPlan =
                    plan.code === 'solo' ? 'growth' : plan.code === 'growth' ? 'franchise' : null;
                await this.audit.log({
                    actorUserId: userId,
                    action: 'PLAN_LIMIT_ENFORCED',
                    entityType: 'Branch',
                    metadata: {
                        resource,
                        current: count,
                        limit: plan.maxBranches,
                        planCode: plan.code,
                        recommendedNextPlan,
                    },
                });
                throw new ConflictException({
                    message: `Location limit reached (${count}/${plan.maxBranches}). Upgrade your plan to add another location.`,
                    code: 'PLAN_LOCATION_LIMIT_REACHED',
                    currentPlan: plan.code,
                    currentLocations: count,
                    allowedLocations: plan.maxBranches,
                    recommendedNextPlan,
                });
            }
        }
    }

    // ── Usage metering ──

    async getUsage(orgId: string, dto: UsageQueryDto) {
        const now = new Date();
        const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const where: Record<string, unknown> = {
            orgId,
            windowStart: { gte: windowStart },
            windowEnd: { lte: windowEnd },
        };

        if (dto.metricType) {
            where.metricType = dto.metricType as UsageMetricType;
        }

        const meters = await this.prisma.usageMeter.findMany({ where });

        // Also compute live current-state metrics
        const [branchCount, userCount, apiKeyCount, webhookCount] = await Promise.all([
            this.prisma.branch.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
            this.prisma.membership.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
            this.prisma.apiKey.count({ where: { orgId, status: 'ACTIVE' } }),
            this.prisma.webhookEndpoint.count({ where: { orgId, status: 'ACTIVE' } }),
        ]);

        // Get plan limits
        const subscription = await this.prisma.subscription.findUnique({
            where: { orgId },
            include: { plan: true },
        });

        const planLimits = subscription
            ? {
                maxBranches: subscription.plan.maxBranches,
                maxUsers: subscription.plan.maxUsers,
                maxApiKeys: subscription.plan.maxApiKeys,
                maxWebhookEndpoints: subscription.plan.maxWebhookEndpoints,
            }
            : null;

        // ── M39 PLAN-CATALOG CORRECTION ──
        // Surface the location-cap as the *primary* enforced metric so callers
        // (developer portal, ops portal, billing UI) can clearly show whether
        // an upgrade is needed before adding another location.
        const planCode = subscription?.plan.code ?? null;
        const upgradeRequired = !!planLimits && branchCount >= planLimits.maxBranches;
        const recommendedNextPlan = upgradeRequired
            ? planCode === 'solo'
                ? 'growth'
                : planCode === 'growth'
                    ? 'franchise'
                    : null
            : null;

        return {
            plan: planCode,
            locations: {
                current: branchCount,
                allowed: planLimits?.maxBranches ?? null,
                upgradeRequired,
                recommendedNextPlan,
                note: 'Location count is the only enforced plan metric. All other features are unlimited on every plan.',
            },
            currentState: {
                branches: { current: branchCount, limit: planLimits?.maxBranches ?? null },
                activeUsers: { current: userCount, limit: planLimits?.maxUsers ?? null },
                apiKeys: { current: apiKeyCount, limit: planLimits?.maxApiKeys ?? null },
                webhookEndpoints: { current: webhookCount, limit: planLimits?.maxWebhookEndpoints ?? null },
            },
            meters: meters.map((m) => ({
                id: m.id,
                metricType: m.metricType,
                currentValue: m.currentValue.toString(),
                limitValue: m.limitValue?.toString() ?? null,
                windowStart: m.windowStart,
                windowEnd: m.windowEnd,
                measuredAt: m.measuredAt,
            })),
        };
    }

    async refreshUsageMeters(orgId: string, userId: string) {
        const now = new Date();
        const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const subscription = await this.prisma.subscription.findUnique({
            where: { orgId },
            include: { plan: true },
        });

        const plan = subscription?.plan;

        const [branchCount, userCount, apiKeyCount, webhookCount] = await Promise.all([
            this.prisma.branch.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
            this.prisma.membership.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
            this.prisma.apiKey.count({ where: { orgId, status: 'ACTIVE' } }),
            this.prisma.webhookEndpoint.count({ where: { orgId, status: 'ACTIVE' } }),
        ]);

        const metrics: { type: UsageMetricType; value: number; limit: number | null }[] = [
            { type: 'BRANCHES' as UsageMetricType, value: branchCount, limit: plan?.maxBranches ?? null },
            { type: 'ACTIVE_USERS' as UsageMetricType, value: userCount, limit: plan?.maxUsers ?? null },
            { type: 'API_KEYS' as UsageMetricType, value: apiKeyCount, limit: plan?.maxApiKeys ?? null },
            {
                type: 'WEBHOOK_ENDPOINTS' as UsageMetricType,
                value: webhookCount,
                limit: plan?.maxWebhookEndpoints ?? null,
            },
        ];

        for (const m of metrics) {
            await this.prisma.usageMeter.upsert({
                where: {
                    orgId_metricType_windowStart_windowEnd: {
                        orgId,
                        metricType: m.type,
                        windowStart: windowStart,
                        windowEnd: windowEnd,
                    },
                },
                update: {
                    currentValue: m.value,
                    limitValue: m.limit,
                    measuredAt: now,
                },
                create: {
                    orgId,
                    metricType: m.type,
                    currentValue: m.value,
                    limitValue: m.limit,
                    windowStart,
                    windowEnd,
                    measuredAt: now,
                },
            });
        }

        await this.audit.log({
            actorUserId: userId,
            action: 'USAGE_METERS_REFRESHED',
            entityType: 'UsageMeter',
            metadata: { orgId, metricsUpdated: metrics.length },
        });

        return { refreshed: metrics.length };
    }

    // ── API Keys ──

    async createApiKey(orgId: string, dto: CreateApiKeyDto, userId: string) {
        await this.checkPlanLimit(orgId, 'API_KEY', userId);

        // BG7 — branchId restriction is optional. If provided, validate that
        // the branch belongs to this org so a malicious owner cannot bind a
        // key to a foreign branch.
        if (dto.branchId) {
            const branch = await this.prisma.branch.findFirst({
                where: { id: dto.branchId, organizationId: orgId },
                select: { id: true },
            });
            if (!branch) {
                throw new NotFoundException('Branch not found in this organization');
            }
        }

        // Generate a secure random key
        const rawKey = randomBytes(32).toString('hex');
        const keyPrefix = `nk_${rawKey.substring(0, 8)}`;
        const keyHash = createHash('sha256').update(rawKey).digest('hex');

        const apiKey = await this.prisma.apiKey.create({
            data: {
                orgId,
                branchId: dto.branchId ?? null,
                name: dto.name,
                keyPrefix,
                keyHash,
                scopes: dto.scopes ?? [],
                createdById: userId,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'API_KEY_CREATED',
            entityType: 'ApiKey',
            entityId: apiKey.id,
            metadata: { name: dto.name, keyPrefix, scopes: dto.scopes, branchId: apiKey.branchId },
        });

        // Return full key only once
        return {
            id: apiKey.id,
            name: apiKey.name,
            keyPrefix: apiKey.keyPrefix,
            key: rawKey,
            scopes: apiKey.scopes,
            branchId: apiKey.branchId,
            scope: apiKey.branchId ? 'BRANCH' : 'ORGANIZATION',
            status: apiKey.status,
            createdAt: apiKey.createdAt,
        };
    }

    async listApiKeys(orgId: string) {
        const keys = await this.prisma.apiKey.findMany({
            where: { orgId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                keyPrefix: true,
                status: true,
                scopes: true,
                branchId: true,
                lastUsedAt: true,
                lastUsedIp: true,
                expiresAt: true,
                createdAt: true,
                revokedAt: true,
            },
        });
        return keys;
    }

    async revokeApiKey(orgId: string, keyId: string, userId: string) {
        const key = await this.prisma.apiKey.findFirst({
            where: { id: keyId, orgId },
        });

        if (!key) {
            throw new NotFoundException('API key not found');
        }
        if (key.status === 'REVOKED') {
            throw new ConflictException('API key is already revoked');
        }

        const updated = await this.prisma.apiKey.update({
            where: { id: keyId },
            data: {
                status: 'REVOKED',
                revokedAt: new Date(),
                revokedById: userId,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'API_KEY_REVOKED',
            entityType: 'ApiKey',
            entityId: keyId,
            metadata: { name: key.name, keyPrefix: key.keyPrefix },
        });

        return {
            id: updated.id,
            name: updated.name,
            keyPrefix: updated.keyPrefix,
            status: updated.status,
            revokedAt: updated.revokedAt,
        };
    }

    // ── Webhooks ──

    async createWebhook(orgId: string, dto: CreateWebhookDto, userId: string) {
        await this.checkPlanLimit(orgId, 'WEBHOOK', userId);

        // Generate signing secret
        const signingSecret = `whsec_${randomBytes(24).toString('hex')}`;

        const webhook = await this.prisma.webhookEndpoint.create({
            data: {
                orgId,
                url: dto.url,
                description: dto.description,
                signingSecret,
                events: dto.events as WebhookEventType[],
                createdById: userId,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'WEBHOOK_CREATED',
            entityType: 'WebhookEndpoint',
            entityId: webhook.id,
            metadata: { url: dto.url, events: dto.events },
        });

        // Show signing secret only once at creation
        return {
            id: webhook.id,
            url: webhook.url,
            description: webhook.description,
            status: webhook.status,
            events: webhook.events,
            signingSecret,
            createdAt: webhook.createdAt,
        };
    }

    async listWebhooks(orgId: string) {
        return this.prisma.webhookEndpoint.findMany({
            where: { orgId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                url: true,
                description: true,
                status: true,
                events: true,
                failureCount: true,
                lastDeliveredAt: true,
                lastFailedAt: true,
                createdAt: true,
            },
        });
    }

    async updateWebhook(orgId: string, webhookId: string, dto: UpdateWebhookDto, userId: string) {
        const wh = await this.prisma.webhookEndpoint.findFirst({
            where: { id: webhookId, orgId },
        });

        if (!wh) {
            throw new NotFoundException('Webhook endpoint not found');
        }

        const data: Record<string, unknown> = {};
        if (dto.url !== undefined) data.url = dto.url;
        if (dto.description !== undefined) data.description = dto.description;
        if (dto.status !== undefined) data.status = dto.status as WebhookStatus;
        if (dto.events !== undefined) data.events = dto.events as WebhookEventType[];

        const updated = await this.prisma.webhookEndpoint.update({
            where: { id: webhookId },
            data,
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'WEBHOOK_UPDATED',
            entityType: 'WebhookEndpoint',
            entityId: webhookId,
            metadata: { changes: dto },
        });

        return {
            id: updated.id,
            url: updated.url,
            description: updated.description,
            status: updated.status,
            events: updated.events,
            createdAt: updated.createdAt,
        };
    }

    // ── Support Sessions ──

    async createSupportSession(orgId: string, dto: CreateSupportSessionDto, userId: string) {
        // Default expiry: 4 hours from now
        const expiresAt = dto.expiresAt
            ? new Date(dto.expiresAt)
            : new Date(Date.now() + 4 * 60 * 60 * 1000);

        // Check support tier
        const subscription = await this.prisma.subscription.findUnique({
            where: { orgId },
            include: { plan: true },
        });

        if (subscription?.plan.supportTier === 'basic') {
            // Check for existing open sessions
            const openCount = await this.prisma.supportSession.count({
                where: { orgId, status: 'OPEN' },
            });
            if (openCount >= 1) {
                throw new ConflictException(
                    'Basic plan allows only 1 concurrent support session. Upgrade for more.',
                );
            }
        }

        const session = await this.prisma.supportSession.create({
            data: {
                orgId,
                reason: dto.reason,
                expiresAt,
                openedById: userId,
                notes: dto.notes,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'SUPPORT_SESSION_OPENED',
            entityType: 'SupportSession',
            entityId: session.id,
            metadata: { reason: dto.reason, expiresAt },
        });

        return session;
    }

    async closeSupportSession(
        orgId: string,
        sessionId: string,
        dto: CloseSupportSessionDto,
        userId: string,
    ) {
        const session = await this.prisma.supportSession.findFirst({
            where: { id: sessionId, orgId },
        });

        if (!session) {
            throw new NotFoundException('Support session not found');
        }

        if (session.status !== 'OPEN') {
            throw new ConflictException(`Support session is already ${session.status}`);
        }

        const updated = await this.prisma.supportSession.update({
            where: { id: sessionId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closedById: userId,
                closedReason: dto.closedReason,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'SUPPORT_SESSION_CLOSED',
            entityType: 'SupportSession',
            entityId: sessionId,
            metadata: { closedReason: dto.closedReason },
        });

        return updated;
    }

    async listSupportSessions(orgId: string) {
        return this.prisma.supportSession.findMany({
            where: { orgId },
            orderBy: { startedAt: 'desc' },
            select: {
                id: true,
                reason: true,
                status: true,
                startedAt: true,
                expiresAt: true,
                closedAt: true,
                closedReason: true,
                notes: true,
            },
        });
    }

    // ── Dev Admins ──

    async isProtectedDevAdmin(userId: string): Promise<boolean> {
        const da = await this.prisma.devAdmin.findUnique({ where: { userId } });
        return !!da?.isProtected;
    }

    async listDevAdmins() {
        return this.prisma.devAdmin.findMany({
            include: {
                user: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
            },
        });
    }

    // ── Plans catalog (admin read) ──

    async listPlans() {
        return this.prisma.plan.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { sortOrder: 'asc' },
        });
    }

    // ── Helpers ──

    private formatSubscription(sub: {
        id: string;
        status: SubscriptionStatus;
        billingCycle: BillingCycle;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        trialEndsAt: Date | null;
        graceEndsAt: Date | null;
        cancelledAt: Date | null;
        plan: { id: string; code: string; name: string };
    }) {
        return {
            id: sub.id,
            status: sub.status,
            billingCycle: sub.billingCycle,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            trialEndsAt: sub.trialEndsAt,
            graceEndsAt: sub.graceEndsAt,
            cancelledAt: sub.cancelledAt,
            plan: {
                id: sub.plan.id,
                code: sub.plan.code,
                name: sub.plan.name,
            },
        };
    }
}
