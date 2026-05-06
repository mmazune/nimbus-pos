import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
    CreateOpsSupportSessionDto,
    CloseOpsSupportSessionDto,
    CreateOpsPlanDto,
    UpdateOpsPlanDto,
    UpdateOpsPlanStatusDto,
} from './dto';

// ── M39 Plan-Catalog Correction ──
// All plans grant the full Nimbus feature set. The only commercial cap is
// the location count, mapped to Plan.maxBranches in the schema. The DTOs
// expose this as `maxLocations` to match the locked product wording.
const PLAN_FEATURE_DEFAULTS = {
    webhooksEnabled: true,
    maxWebhookEndpoints: 999_999,
    maxUsers: 999_999,
    maxApiKeys: 999_999,
    analyticsEnabled: true,
    franchiseEnabled: true,
} as const;

@Injectable()
export class OpsPortalService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async listCustomers() {
        return this.prisma.organization.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                createdAt: true,
                subscription: {
                    select: {
                        id: true,
                        status: true,
                        billingCycle: true,
                        plan: { select: { code: true, name: true } },
                    },
                },
            },
        });
    }

    async getCustomerDetail(orgId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                branches: { select: { id: true, name: true, status: true } },
                subscription: { include: { plan: true } },
                onboardingProgress: true,
                merchantPaymentConfig: true,
                memberships: {
                    select: { id: true, status: true, userId: true },
                    take: 20,
                },
            },
        });

        if (!org) throw new NotFoundException('Organization not found');
        return org;
    }

    async getSubscriptionsDue() {
        const now = new Date();
        const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        return this.prisma.subscription.findMany({
            where: {
                status: 'ACTIVE',
                currentPeriodEnd: { lte: soon },
            },
            include: {
                plan: { select: { code: true, name: true } },
                organization: { select: { id: true, name: true } },
            },
            orderBy: { currentPeriodEnd: 'asc' },
        });
    }

    async getSubscriptionsGracePeriod() {
        return this.prisma.subscription.findMany({
            where: { status: 'GRACE_PERIOD' },
            include: {
                plan: { select: { code: true, name: true } },
                organization: { select: { id: true, name: true } },
            },
            orderBy: { graceEndsAt: 'asc' },
        });
    }

    async getOnboardingPipeline() {
        return this.prisma.onboardingProgress.findMany({
            where: { completedAt: null },
            include: {
                organization: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getMerchantPaymentsStatus() {
        return this.prisma.merchantPaymentConfig.findMany({
            include: {
                organization: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async listSupportSessions() {
        return this.prisma.supportSession.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                organization: { select: { id: true, name: true } },
                openedBy: { select: { id: true, firstName: true, lastName: true } },
                closedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });
    }

    async createSupportSession(dto: CreateOpsSupportSessionDto, userId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: dto.orgId },
        });
        if (!org) throw new NotFoundException('Organization not found');

        const session = await this.prisma.supportSession.create({
            data: {
                orgId: dto.orgId,
                reason: dto.reason,
                notes: dto.notes,
                openedById: userId,
                expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'SUPPORT_SESSION_OPENED',
            entityType: 'SupportSession',
            entityId: session.id,
            metadata: { orgId: dto.orgId, reason: dto.reason },
        });

        return session;
    }

    async closeSupportSession(sessionId: string, dto: CloseOpsSupportSessionDto, userId: string) {
        const session = await this.prisma.supportSession.findUnique({
            where: { id: sessionId },
        });

        if (!session) throw new NotFoundException('Support session not found');
        if (session.status !== 'OPEN') {
            throw new ConflictException(`Session is already ${session.status}`);
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

    // ────────────────────────────────────────────────────────────────────
    // M39 Plan-Catalog Correction — Internal plan administration
    // ────────────────────────────────────────────────────────────────────
    // These endpoints are reserved for Nimbus internal admins (Owner /
    // Manager roles inside the Nimbus tenant). They allow editing the
    // SaaS plan catalog without redeploying. Pricing, location caps,
    // status, and commercial wording are all updatable here.

    private formatPlan(p: {
        id: string;
        code: string;
        name: string;
        description: string | null;
        status: string;
        priceMonthly: { toString(): string };
        priceAnnual: { toString(): string };
        maxBranches: number;
        trialDays: number;
        gracePeriodDays: number;
        supportTier: string;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }) {
        const monthly = Number(p.priceMonthly.toString());
        const annual = Number(p.priceAnnual.toString());
        const annualDiscountPct =
            monthly > 0 ? Math.round((1 - annual / (monthly * 12)) * 1000) / 10 : 0;
        return {
            id: p.id,
            code: p.code,
            name: p.name,
            description: p.description,
            status: p.status,
            priceMonthly: monthly,
            priceAnnual: annual,
            annualDiscountPct,
            maxLocations: p.maxBranches,
            trialDays: p.trialDays,
            gracePeriodDays: p.gracePeriodDays,
            supportTier: p.supportTier,
            sortOrder: p.sortOrder,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            // Locked feature policy — all plans include the full Nimbus
            // feature set; only location count varies between tiers.
            features: {
                fullPlatformAccess: true,
                consolidatedReporting: true,
                crossBranchAnalytics: true,
                hqDashboards: true,
                developerPortal: true,
                publicCommerce: true,
                events: true,
                franchiseAnalytics: true,
            },
        };
    }

    async listPlans() {
        const plans = await this.prisma.plan.findMany({
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        return {
            policy: {
                enforcedMetric: 'maxLocations',
                featureGating: false,
                note: 'All plans grant the full Nimbus feature set. The only commercial cap is the number of allowed locations.',
            },
            plans: plans.map((p) => this.formatPlan(p)),
        };
    }

    async createPlan(dto: CreateOpsPlanDto, userId: string) {
        const existing = await this.prisma.plan.findUnique({ where: { code: dto.code } });
        if (existing) {
            throw new ConflictException(`Plan with code "${dto.code}" already exists`);
        }

        if (dto.priceAnnual > dto.priceMonthly * 12) {
            throw new BadRequestException(
                'Annual price must not exceed 12 × monthly price (use a discount, not a premium).',
            );
        }

        const plan = await this.prisma.plan.create({
            data: {
                code: dto.code,
                name: dto.name,
                description: dto.description,
                status: 'DRAFT',
                priceMonthly: dto.priceMonthly,
                priceAnnual: dto.priceAnnual,
                maxBranches: dto.maxLocations,
                trialDays: dto.trialDays ?? 14,
                gracePeriodDays: dto.gracePeriodDays ?? 7,
                supportTier: dto.supportTier ?? 'standard',
                sortOrder: dto.sortOrder ?? 99,
                ...PLAN_FEATURE_DEFAULTS,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'OPS_PLAN_CREATED',
            entityType: 'Plan',
            entityId: plan.id,
            metadata: {
                code: plan.code,
                priceMonthly: dto.priceMonthly,
                priceAnnual: dto.priceAnnual,
                maxLocations: dto.maxLocations,
            },
        });

        return this.formatPlan(plan);
    }

    async updatePlan(planId: string, dto: UpdateOpsPlanDto, userId: string) {
        const existing = await this.prisma.plan.findUnique({ where: { id: planId } });
        if (!existing) throw new NotFoundException('Plan not found');

        const newMonthly = dto.priceMonthly ?? Number(existing.priceMonthly.toString());
        const newAnnual = dto.priceAnnual ?? Number(existing.priceAnnual.toString());
        if (newAnnual > newMonthly * 12) {
            throw new BadRequestException(
                'Annual price must not exceed 12 × monthly price (use a discount, not a premium).',
            );
        }

        const data: Record<string, unknown> = {};
        if (dto.name !== undefined) data.name = dto.name;
        if (dto.description !== undefined) data.description = dto.description;
        if (dto.priceMonthly !== undefined) data.priceMonthly = dto.priceMonthly;
        if (dto.priceAnnual !== undefined) data.priceAnnual = dto.priceAnnual;
        if (dto.maxLocations !== undefined) data.maxBranches = dto.maxLocations;
        if (dto.trialDays !== undefined) data.trialDays = dto.trialDays;
        if (dto.gracePeriodDays !== undefined) data.gracePeriodDays = dto.gracePeriodDays;
        if (dto.supportTier !== undefined) data.supportTier = dto.supportTier;
        if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

        // If a maxLocations decrease would orphan existing subscribers, refuse.
        if (
            dto.maxLocations !== undefined &&
            dto.maxLocations < existing.maxBranches
        ) {
            const newCap = dto.maxLocations;
            const subs = await this.prisma.subscription.findMany({
                where: { planId, status: { in: ['ACTIVE', 'TRIAL', 'GRACE_PERIOD', 'PAST_DUE'] } },
                select: { orgId: true },
            });
            if (subs.length > 0) {
                const orgIds = subs.map((s) => s.orgId);
                const overCap = await this.prisma.branch.groupBy({
                    by: ['organizationId'],
                    where: { organizationId: { in: orgIds }, status: 'ACTIVE' },
                    _count: { _all: true },
                });
                const offenders = overCap.filter((g) => g._count._all > newCap);
                if (offenders.length > 0) {
                    throw new ConflictException({
                        message:
                            'Cannot lower maxLocations: existing subscribers already exceed the new cap.',
                        offenders: offenders.map((o) => ({
                            orgId: o.organizationId,
                            currentLocations: o._count._all,
                        })),
                    });
                }
            }
        }

        const updated = await this.prisma.plan.update({
            where: { id: planId },
            data,
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'OPS_PLAN_UPDATED',
            entityType: 'Plan',
            entityId: planId,
            metadata: { code: existing.code, changes: data },
        });

        return this.formatPlan(updated);
    }

    async updatePlanStatus(planId: string, dto: UpdateOpsPlanStatusDto, userId: string) {
        const existing = await this.prisma.plan.findUnique({ where: { id: planId } });
        if (!existing) throw new NotFoundException('Plan not found');

        if (existing.status === dto.status) {
            return this.formatPlan(existing);
        }

        // Block archiving a plan that still has live subscribers unless `force` is set
        if (dto.status === 'ARCHIVED' && !dto.force) {
            const liveCount = await this.prisma.subscription.count({
                where: {
                    planId,
                    status: { in: ['ACTIVE', 'TRIAL', 'GRACE_PERIOD', 'PAST_DUE'] },
                },
            });
            if (liveCount > 0) {
                throw new ConflictException({
                    message: `Cannot archive plan "${existing.code}": ${liveCount} live subscriber(s) still on this plan. Migrate them first or pass force=true.`,
                    liveSubscribers: liveCount,
                });
            }
        }

        const updated = await this.prisma.plan.update({
            where: { id: planId },
            data: { status: dto.status },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'OPS_PLAN_STATUS_CHANGED',
            entityType: 'Plan',
            entityId: planId,
            metadata: {
                code: existing.code,
                from: existing.status,
                to: dto.status,
                forced: !!dto.force,
            },
        });

        return this.formatPlan(updated);
    }

    async listPlanSubscribers(planId: string) {
        const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Plan not found');

        const subscriptions = await this.prisma.subscription.findMany({
            where: { planId },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        _count: { select: { branches: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return {
            plan: { id: plan.id, code: plan.code, name: plan.name, maxLocations: plan.maxBranches },
            count: subscriptions.length,
            subscribers: subscriptions.map((s) => ({
                subscriptionId: s.id,
                status: s.status,
                billingCycle: s.billingCycle,
                currentPeriodEnd: s.currentPeriodEnd,
                organization: {
                    id: s.organization.id,
                    name: s.organization.name,
                    slug: s.organization.slug,
                    activeLocations: s.organization._count.branches,
                    overCap: s.organization._count.branches > plan.maxBranches,
                },
            })),
        };
    }
}
