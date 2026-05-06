import { Test } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';

describe('BillingService', () => {
    let service: BillingService;
    let prisma: Record<string, any>;
    let audit: { log: jest.Mock };

    beforeEach(async () => {
        prisma = {
            membership: { findFirst: jest.fn() },
            subscription: { findUnique: jest.fn(), update: jest.fn() },
            plan: { findMany: jest.fn(), findUnique: jest.fn() },
            usageMeter: { findMany: jest.fn(), upsert: jest.fn() },
            apiKey: {
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
                count: jest.fn(),
            },
            webhookEndpoint: {
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
                count: jest.fn(),
            },
            supportSession: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
                count: jest.fn(),
            },
            devAdmin: { findUnique: jest.fn(), findMany: jest.fn() },
            branch: { count: jest.fn() },
        };
        audit = { log: jest.fn() };

        const module = await Test.createTestingModule({
            providers: [
                BillingService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get(BillingService);
    });

    // ── resolveOrgContext ──

    it('resolves org context from active membership', async () => {
        prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
        const ctx = await service.resolveOrgContext('user-1');
        expect(ctx.organizationId).toBe('org-1');
    });

    it('throws ForbiddenException when no membership', async () => {
        prisma.membership.findFirst.mockResolvedValue(null);
        await expect(service.resolveOrgContext('user-1')).rejects.toThrow(ForbiddenException);
    });

    // ── getBillingOverview ──

    it('returns null subscription when none exists', async () => {
        prisma.subscription.findUnique.mockResolvedValue(null);
        const result = await service.getBillingOverview('org-1');
        expect(result.subscription).toBeNull();
        expect(result.plan).toBeNull();
    });

    it('returns full billing overview with plan and usage', async () => {
        const plan = {
            id: 'plan-1',
            code: 'growth',
            name: 'Growth',
            priceMonthly: { toString: () => '49.99' },
            priceAnnual: { toString: () => '499.99' },
            supportTier: 'standard',
            maxBranches: 5,
            maxUsers: 25,
            maxApiKeys: 10,
            webhooksEnabled: true,
            maxWebhookEndpoints: 10,
            analyticsEnabled: true,
            franchiseEnabled: false,
        };
        prisma.subscription.findUnique.mockResolvedValue({
            id: 'sub-1',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            trialEndsAt: null,
            graceEndsAt: null,
            cancelledAt: null,
            plan,
        });
        prisma.usageMeter.findMany.mockResolvedValue([]);
        prisma.branch.count.mockResolvedValue(2);
        prisma.membership = { ...prisma.membership, count: jest.fn().mockResolvedValue(10) };
        prisma.apiKey.count.mockResolvedValue(3);
        prisma.webhookEndpoint.count.mockResolvedValue(1);

        const result = await service.getBillingOverview('org-1');
        expect(result.subscription!.status).toBe('ACTIVE');
        expect(result.plan!.code).toBe('growth');
        expect(result.limits!.maxBranches).toBe(5);
        expect(result.currentUsage!.branches).toBe(2);
        // M39 plan-catalog correction: locationCapacity surfaced for UI
        expect(result.locationCapacity!.current).toBe(2);
        expect(result.locationCapacity!.allowed).toBe(5);
        expect(result.locationCapacity!.upgradeRequired).toBe(false);
    });

    // ── updateSubscription (plan change) ──

    it('changes plan successfully when limits are not exceeded', async () => {
        const existingSub = {
            id: 'sub-1',
            status: 'ACTIVE',
            planId: 'plan-1',
            billingCycle: 'MONTHLY',
            plan: { id: 'plan-1', code: 'solo', name: 'Solo', gracePeriodDays: 7 },
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            trialEndsAt: null,
            graceEndsAt: null,
            cancelledAt: null,
        };
        const newPlan = {
            id: 'plan-2',
            code: 'growth',
            name: 'Growth',
            status: 'ACTIVE',
            maxBranches: 5,
            maxUsers: 25,
            maxApiKeys: 10,
            maxWebhookEndpoints: 10,
        };
        prisma.subscription.findUnique.mockResolvedValue(existingSub);
        prisma.plan.findUnique.mockResolvedValue(newPlan);
        prisma.branch.count.mockResolvedValue(1);
        prisma.membership = { ...prisma.membership, count: jest.fn().mockResolvedValue(3) };
        prisma.apiKey.count.mockResolvedValue(0);
        prisma.webhookEndpoint.count.mockResolvedValue(0);
        prisma.subscription.update.mockResolvedValue({
            ...existingSub,
            planId: 'plan-2',
            plan: { id: 'plan-2', code: 'growth', name: 'Growth' },
        });

        const result = await service.updateSubscription('org-1', { planCode: 'growth' }, 'user-1');
        expect(result.plan.code).toBe('growth');
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SUBSCRIPTION_PLAN_CHANGED' }),
        );
    });

    it('blocks plan downgrade when limits exceeded', async () => {
        const existingSub = {
            id: 'sub-1',
            status: 'ACTIVE',
            planId: 'plan-2',
            plan: { id: 'plan-2', code: 'growth', name: 'Growth', gracePeriodDays: 7 },
        };
        const soloPlan = {
            id: 'plan-1',
            code: 'solo',
            name: 'Solo',
            status: 'ACTIVE',
            maxBranches: 1,
            maxUsers: 999_999,
            maxApiKeys: 999_999,
            maxWebhookEndpoints: 999_999,
        };
        prisma.subscription.findUnique.mockResolvedValue(existingSub);
        prisma.plan.findUnique.mockResolvedValue(soloPlan);
        prisma.branch.count.mockResolvedValue(3); // 3 > 1
        prisma.membership = { ...prisma.membership, count: jest.fn().mockResolvedValue(2) };
        prisma.apiKey.count.mockResolvedValue(0);
        prisma.webhookEndpoint.count.mockResolvedValue(0);

        await expect(
            service.updateSubscription('org-1', { planCode: 'solo' }, 'user-1'),
        ).rejects.toThrow(ConflictException);
    });

    // ── updateSubscription (status change) ──

    it('transitions from ACTIVE to GRACE_PERIOD with graceEndsAt', async () => {
        const existingSub = {
            id: 'sub-1',
            status: 'ACTIVE',
            planId: 'plan-1',
            plan: { id: 'plan-1', code: 'growth', name: 'Growth', gracePeriodDays: 7 },
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            trialEndsAt: null,
            graceEndsAt: null,
            cancelledAt: null,
        };
        prisma.subscription.findUnique.mockResolvedValue(existingSub);
        prisma.subscription.update.mockImplementation(({ data }: any) => ({
            ...existingSub,
            ...data,
            plan: existingSub.plan,
        }));

        const result = await service.updateSubscription('org-1', { status: 'GRACE_PERIOD' }, 'user-1');
        expect(result.status).toBe('GRACE_PERIOD');
        expect(result.graceEndsAt).toBeDefined();
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SUBSCRIPTION_STATUS_CHANGED' }),
        );
    });

    it('blocks invalid status transition', async () => {
        prisma.subscription.findUnique.mockResolvedValue({
            id: 'sub-1',
            status: 'CANCELLED',
            planId: 'plan-1',
            plan: { id: 'plan-1', code: 'solo', name: 'Solo', gracePeriodDays: 7 },
        });

        await expect(
            service.updateSubscription('org-1', { status: 'ACTIVE' }, 'user-1'),
        ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when no subscription', async () => {
        prisma.subscription.findUnique.mockResolvedValue(null);
        await expect(
            service.updateSubscription('org-1', { status: 'ACTIVE' }, 'user-1'),
        ).rejects.toThrow(NotFoundException);
    });

    // ── Plan enforcement ──

    it('enforcePlanLimitsOnChange passes when under limits', async () => {
        prisma.branch.count.mockResolvedValue(1);
        prisma.membership = { ...prisma.membership, count: jest.fn().mockResolvedValue(3) };
        prisma.apiKey.count.mockResolvedValue(0);
        prisma.webhookEndpoint.count.mockResolvedValue(0);

        await expect(
            service.enforcePlanLimitsOnChange('org-1', {
                maxBranches: 5,
                maxUsers: 25,
                maxApiKeys: 10,
                maxWebhookEndpoints: 10,
            }),
        ).resolves.not.toThrow();
    });

    it('enforcePlanLimitsOnChange returns the location violation only (M39 plan-catalog correction)', async () => {
        // M39 correction: only the location (branch) cap is enforced.
        // User / API key / webhook counts are intentionally NOT gated.
        prisma.branch.count.mockResolvedValue(6);
        prisma.membership = { ...prisma.membership, count: jest.fn().mockResolvedValue(30) };
        prisma.apiKey.count.mockResolvedValue(15);
        prisma.webhookEndpoint.count.mockResolvedValue(20);

        try {
            await service.enforcePlanLimitsOnChange('org-1', {
                maxBranches: 5,
                maxUsers: 25,
                maxApiKeys: 10,
                maxWebhookEndpoints: 10,
            });
            fail('Expected ConflictException');
        } catch (e: any) {
            expect(e.response.violations).toHaveLength(1);
            expect(e.response.violations[0]).toMatch(/locations/i);
        }
    });

    // ── checkPlanLimit ──

    it('does NOT block API key creation under M39 plan-catalog correction', async () => {
        // API keys are no longer gated by plan tier; checkPlanLimit('API_KEY')
        // is a no-op kept for backwards compat with existing call sites.
        prisma.subscription.findUnique.mockResolvedValue({
            status: 'ACTIVE',
            plan: { maxApiKeys: 2, code: 'solo' },
        });
        prisma.apiKey.count.mockResolvedValue(99);

        await expect(service.checkPlanLimit('org-1', 'API_KEY', 'user-1')).resolves.toBeUndefined();
    });

    it('does NOT block webhook creation under M39 plan-catalog correction', async () => {
        prisma.subscription.findUnique.mockResolvedValue({
            status: 'ACTIVE',
            plan: { webhooksEnabled: false, code: 'solo' },
        });

        await expect(service.checkPlanLimit('org-1', 'WEBHOOK', 'user-1')).resolves.toBeUndefined();
    });

    it('blocks branch creation when location cap reached and surfaces upgrade target', async () => {
        prisma.subscription.findUnique.mockResolvedValue({
            status: 'ACTIVE',
            plan: { maxBranches: 1, code: 'solo' },
        });
        prisma.branch.count.mockResolvedValue(1);

        try {
            await service.checkPlanLimit('org-1', 'BRANCH', 'user-1');
            fail('Expected ConflictException');
        } catch (e: any) {
            expect(e.response.code).toBe('PLAN_LOCATION_LIMIT_REACHED');
            expect(e.response.recommendedNextPlan).toBe('growth');
        }
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'PLAN_LIMIT_ENFORCED' }),
        );
    });

    // ── API Keys ──

    it('creates API key and returns plaintext once', async () => {
        prisma.subscription.findUnique.mockResolvedValue({
            status: 'ACTIVE',
            plan: { maxApiKeys: 10, code: 'growth' },
        });
        prisma.apiKey.count.mockResolvedValue(1);
        prisma.apiKey.create.mockImplementation(({ data }: any) => ({
            ...data,
            id: 'key-1',
            status: 'ACTIVE',
            createdAt: new Date(),
        }));

        const result = await service.createApiKey('org-1', { name: 'Test Key' }, 'user-1');
        expect(result.key).toBeDefined();
        expect(result.key.length).toBe(64); // 32 bytes hex
        expect(result.keyPrefix).toMatch(/^nk_/);
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'API_KEY_CREATED' }));
    });

    it('revokes API key', async () => {
        prisma.apiKey.findFirst.mockResolvedValue({
            id: 'key-1',
            status: 'ACTIVE',
            name: 'K1',
            keyPrefix: 'nk_abc',
        });
        prisma.apiKey.update.mockResolvedValue({
            id: 'key-1',
            name: 'K1',
            keyPrefix: 'nk_abc',
            status: 'REVOKED',
            revokedAt: new Date(),
        });

        const result = await service.revokeApiKey('org-1', 'key-1', 'user-1');
        expect(result.status).toBe('REVOKED');
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'API_KEY_REVOKED' }));
    });

    it('throws when revoking already-revoked key', async () => {
        prisma.apiKey.findFirst.mockResolvedValue({ id: 'key-1', status: 'REVOKED' });
        await expect(service.revokeApiKey('org-1', 'key-1', 'user-1')).rejects.toThrow(
            ConflictException,
        );
    });

    // ── Webhooks ──

    it('creates webhook with signing secret', async () => {
        prisma.subscription.findUnique.mockResolvedValue({
            status: 'ACTIVE',
            plan: { webhooksEnabled: true, maxWebhookEndpoints: 5, code: 'growth' },
        });
        prisma.webhookEndpoint.count.mockResolvedValue(0);
        prisma.webhookEndpoint.create.mockImplementation(({ data }: any) => ({
            ...data,
            id: 'wh-1',
            status: 'ACTIVE',
            createdAt: new Date(),
        }));

        const result = await service.createWebhook(
            'org-1',
            { url: 'https://example.com/hook', events: ['ORDER_CREATED'] },
            'user-1',
        );
        expect(result.signingSecret).toMatch(/^whsec_/);
        expect(result.events).toContain('ORDER_CREATED');
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'WEBHOOK_CREATED' }));
    });

    it('updates webhook status', async () => {
        prisma.webhookEndpoint.findFirst.mockResolvedValue({ id: 'wh-1', orgId: 'org-1' });
        prisma.webhookEndpoint.update.mockResolvedValue({
            id: 'wh-1',
            url: 'https://example.com/hook',
            description: null,
            status: 'INACTIVE',
            events: ['ORDER_CREATED'],
            createdAt: new Date(),
        });

        const result = await service.updateWebhook('org-1', 'wh-1', { status: 'INACTIVE' }, 'user-1');
        expect(result.status).toBe('INACTIVE');
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'WEBHOOK_UPDATED' }));
    });

    // ── Support Sessions ──

    it('creates support session with default expiry', async () => {
        prisma.subscription.findUnique.mockResolvedValue({
            plan: { supportTier: 'standard' },
        });
        prisma.supportSession.create.mockImplementation(({ data }: any) => ({
            ...data,
            id: 'ss-1',
            status: 'OPEN',
            createdAt: new Date(),
        }));

        const result = await service.createSupportSession('org-1', { reason: 'Need help' }, 'user-1');
        expect(result.status).toBe('OPEN');
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SUPPORT_SESSION_OPENED' }),
        );
    });

    it('blocks concurrent support session on basic plan', async () => {
        prisma.subscription.findUnique.mockResolvedValue({
            plan: { supportTier: 'basic' },
        });
        prisma.supportSession.count.mockResolvedValue(1);

        await expect(
            service.createSupportSession('org-1', { reason: 'Help' }, 'user-1'),
        ).rejects.toThrow(ConflictException);
    });

    it('closes support session', async () => {
        prisma.supportSession.findFirst.mockResolvedValue({ id: 'ss-1', status: 'OPEN' });
        prisma.supportSession.update.mockResolvedValue({
            id: 'ss-1',
            status: 'CLOSED',
            closedAt: new Date(),
        });

        const result = await service.closeSupportSession(
            'org-1',
            'ss-1',
            { closedReason: 'Done' },
            'user-1',
        );
        expect(result.status).toBe('CLOSED');
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SUPPORT_SESSION_CLOSED' }),
        );
    });

    it('blocks closing already-closed session', async () => {
        prisma.supportSession.findFirst.mockResolvedValue({ id: 'ss-1', status: 'CLOSED' });
        await expect(service.closeSupportSession('org-1', 'ss-1', {}, 'user-1')).rejects.toThrow(
            ConflictException,
        );
    });

    // ── Dev Admins ──

    it('identifies protected dev admin', async () => {
        prisma.devAdmin.findUnique.mockResolvedValue({ isProtected: true });
        expect(await service.isProtectedDevAdmin('user-1')).toBe(true);
    });

    it('returns false for non-admin', async () => {
        prisma.devAdmin.findUnique.mockResolvedValue(null);
        expect(await service.isProtectedDevAdmin('user-1')).toBe(false);
    });

    // ── Grace period degradation ──

    it('sets graceEndsAt based on plan gracePeriodDays', async () => {
        const now = Date.now();
        const existingSub = {
            id: 'sub-1',
            status: 'ACTIVE',
            planId: 'plan-1',
            plan: { id: 'plan-1', code: 'growth', name: 'Growth', gracePeriodDays: 14 },
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            trialEndsAt: null,
            graceEndsAt: null,
            cancelledAt: null,
        };
        prisma.subscription.findUnique.mockResolvedValue(existingSub);
        prisma.subscription.update.mockImplementation(({ data }: any) => ({
            ...existingSub,
            ...data,
            plan: existingSub.plan,
        }));

        const result = await service.updateSubscription('org-1', { status: 'GRACE_PERIOD' }, 'user-1');
        const graceEnd = new Date(result.graceEndsAt!).getTime();
        // Grace period should be approximately 14 days from now (within 1 minute tolerance)
        expect(graceEnd).toBeGreaterThan(now + 13 * 24 * 60 * 60 * 1000);
        expect(graceEnd).toBeLessThan(now + 15 * 24 * 60 * 60 * 1000);
    });

    // ── Usage metering ──

    it('returns usage with plan limits', async () => {
        prisma.usageMeter.findMany.mockResolvedValue([]);
        prisma.branch.count.mockResolvedValue(2);
        prisma.membership = { ...prisma.membership, count: jest.fn().mockResolvedValue(8) };
        prisma.apiKey.count.mockResolvedValue(1);
        prisma.webhookEndpoint.count.mockResolvedValue(0);
        prisma.subscription.findUnique.mockResolvedValue({
            plan: { maxBranches: 5, maxUsers: 25, maxApiKeys: 10, maxWebhookEndpoints: 5 },
        });

        const result = await service.getUsage('org-1', {});
        expect(result.currentState.branches.current).toBe(2);
        expect(result.currentState.branches.limit).toBe(5);
        expect(result.currentState.apiKeys.current).toBe(1);
    });

    // ── M39.1 Commercial Foundation — additional lifecycle + location-only assertions ──

    it('M39.1: transitions PENDING_PAYMENT → ACTIVE after PesaPal verification', async () => {
        const existingSub = {
            id: 'sub-1',
            status: 'PENDING_PAYMENT',
            planId: 'plan-1',
            plan: { id: 'plan-1', code: 'solo', name: 'Solo', gracePeriodDays: 7 },
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            trialEndsAt: null,
            graceEndsAt: null,
            cancelledAt: null,
        };
        prisma.subscription.findUnique.mockResolvedValue(existingSub);
        prisma.subscription.update.mockImplementation(({ data }: any) => ({
            ...existingSub,
            ...data,
            plan: existingSub.plan,
        }));

        const result = await service.updateSubscription('org-1', { status: 'ACTIVE' }, 'user-1');
        expect(result.status).toBe('ACTIVE');
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SUBSCRIPTION_STATUS_CHANGED' }),
        );
    });

    it('M39.1: SOLO → GROWTH allowed regardless of user/api-key/webhook count', async () => {
        const existingSub = {
            id: 'sub-1',
            status: 'ACTIVE',
            planId: 'plan-solo',
            billingCycle: 'MONTHLY',
            plan: { id: 'plan-solo', code: 'solo', name: 'Solo', gracePeriodDays: 7 },
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            trialEndsAt: null,
            graceEndsAt: null,
            cancelledAt: null,
        };
        const growth = {
            id: 'plan-growth',
            code: 'growth',
            name: 'Growth',
            status: 'ACTIVE',
            maxBranches: 3,
            maxUsers: 999_999,
            maxApiKeys: 999_999,
            maxWebhookEndpoints: 999_999,
        };
        prisma.subscription.findUnique.mockResolvedValue(existingSub);
        prisma.plan.findUnique.mockResolvedValue(growth);
        prisma.branch.count.mockResolvedValue(1);
        prisma.subscription.update.mockResolvedValue({
            ...existingSub,
            planId: 'plan-growth',
            plan: { id: 'plan-growth', code: 'growth', name: 'Growth' },
        });

        const result = await service.updateSubscription('org-1', { planCode: 'growth' }, 'user-1');
        expect(result.plan.code).toBe('growth');
    });

    it('M39.1: FRANCHISE → GROWTH blocked when active locations exceed 3', async () => {
        const existingSub = {
            id: 'sub-1',
            status: 'ACTIVE',
            planId: 'plan-franchise',
            plan: {
                id: 'plan-franchise',
                code: 'franchise',
                name: 'Franchise',
                gracePeriodDays: 7,
            },
        };
        const growth = {
            id: 'plan-growth',
            code: 'growth',
            name: 'Growth',
            status: 'ACTIVE',
            maxBranches: 3,
            maxUsers: 999_999,
            maxApiKeys: 999_999,
            maxWebhookEndpoints: 999_999,
        };
        prisma.subscription.findUnique.mockResolvedValue(existingSub);
        prisma.plan.findUnique.mockResolvedValue(growth);
        prisma.branch.count.mockResolvedValue(5); // 5 > 3

        await expect(
            service.updateSubscription('org-1', { planCode: 'growth' }, 'user-1'),
        ).rejects.toThrow(ConflictException);
    });

    it('M39.1: GROWTH at cap returns upgradeRequired=true with recommendedNextPlan=franchise', async () => {
        prisma.subscription.findUnique.mockResolvedValue({
            id: 'sub-1',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            trialEndsAt: null,
            graceEndsAt: null,
            cancelledAt: null,
            plan: {
                id: 'plan-growth',
                code: 'growth',
                name: 'Growth',
                priceMonthly: { toString: () => '150.00' },
                priceAnnual: { toString: () => '1620.00' },
                supportTier: 'standard',
                maxBranches: 3,
                maxUsers: 999_999,
                maxApiKeys: 999_999,
                webhooksEnabled: true,
                maxWebhookEndpoints: 999_999,
                analyticsEnabled: true,
                franchiseEnabled: true,
            },
        });
        prisma.usageMeter.findMany.mockResolvedValue([]);
        prisma.branch.count.mockResolvedValue(3);
        prisma.membership = { ...prisma.membership, count: jest.fn().mockResolvedValue(20) };
        prisma.apiKey.count.mockResolvedValue(5);
        prisma.webhookEndpoint.count.mockResolvedValue(2);

        const result = await service.getBillingOverview('org-1');
        expect(result.locationCapacity!.upgradeRequired).toBe(true);
        expect(result.locationCapacity!.recommendedNextPlan).toBe('franchise');
    });

    it('M39.1: getUsage emphasizes location capacity at the top level', async () => {
        prisma.usageMeter.findMany.mockResolvedValue([]);
        prisma.branch.count.mockResolvedValue(1);
        prisma.membership = { ...prisma.membership, count: jest.fn().mockResolvedValue(2) };
        prisma.apiKey.count.mockResolvedValue(0);
        prisma.webhookEndpoint.count.mockResolvedValue(0);
        prisma.subscription.findUnique.mockResolvedValue({
            plan: {
                code: 'solo',
                maxBranches: 1,
                maxUsers: 999_999,
                maxApiKeys: 999_999,
                maxWebhookEndpoints: 999_999,
            },
        });

        const result = await service.getUsage('org-1', {});
        expect(result.plan).toBe('solo');
        expect(result.locations.current).toBe(1);
        expect(result.locations.allowed).toBe(1);
        expect(result.locations.upgradeRequired).toBe(true);
        expect(result.locations.recommendedNextPlan).toBe('growth');
    });
});
