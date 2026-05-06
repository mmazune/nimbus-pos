import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OpsPortalService } from './ops-portal.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

const USER = 'user-ops-1';

function makePrisma() {
    return {
        organization: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
        subscription: { findMany: jest.fn() },
        onboardingProgress: { findMany: jest.fn() },
        merchantPaymentConfig: { findMany: jest.fn() },
        supportSession: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    };
}

describe('OpsPortalService', () => {
    let service: OpsPortalService;
    let prisma: ReturnType<typeof makePrisma>;
    let audit: { log: jest.Mock };

    beforeEach(async () => {
        prisma = makePrisma();
        audit = { log: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OpsPortalService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get(OpsPortalService);
    });

    describe('listCustomers', () => {
        it('returns organizations with subscriptions', async () => {
            prisma.organization.findMany.mockResolvedValue([
                { id: 'org-1', name: 'Acme', subscription: { status: 'ACTIVE' } },
            ]);
            const result = await service.listCustomers();
            expect(result).toHaveLength(1);
        });
    });

    describe('getCustomerDetail', () => {
        it('returns full org detail', async () => {
            prisma.organization.findUnique.mockResolvedValue({
                id: 'org-1',
                name: 'Acme',
                branches: [],
                subscription: { status: 'ACTIVE' },
                onboardingProgress: null,
                merchantPaymentConfig: null,
                memberships: [],
            });
            const result = await service.getCustomerDetail('org-1');
            expect(result.id).toBe('org-1');
        });

        it('throws NotFoundException for unknown org', async () => {
            prisma.organization.findUnique.mockResolvedValue(null);
            await expect(service.getCustomerDetail('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getSubscriptionsDue', () => {
        it('returns subscriptions expiring within 7 days', async () => {
            prisma.subscription.findMany.mockResolvedValue([
                { id: 'sub-1', status: 'ACTIVE', currentPeriodEnd: new Date() },
            ]);
            const result = await service.getSubscriptionsDue();
            expect(result).toHaveLength(1);
        });
    });

    describe('getSubscriptionsGracePeriod', () => {
        it('returns GRACE_PERIOD subscriptions', async () => {
            prisma.subscription.findMany.mockResolvedValue([]);
            const result = await service.getSubscriptionsGracePeriod();
            expect(result).toHaveLength(0);
        });
    });

    describe('getOnboardingPipeline', () => {
        it('returns incomplete onboarding records', async () => {
            prisma.onboardingProgress.findMany.mockResolvedValue([
                { orgId: 'org-1', completedAt: null },
            ]);
            const result = await service.getOnboardingPipeline();
            expect(result).toHaveLength(1);
        });
    });

    describe('getMerchantPaymentsStatus', () => {
        it('returns all merchant payment configs', async () => {
            prisma.merchantPaymentConfig.findMany.mockResolvedValue([]);
            const result = await service.getMerchantPaymentsStatus();
            expect(result).toHaveLength(0);
        });
    });

    // ── Support Sessions ──
    describe('createSupportSession', () => {
        it('creates session with 4-hour expiry and audits', async () => {
            prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Acme' });
            prisma.supportSession.create.mockResolvedValue({
                id: 'ss-1',
                orgId: 'org-1',
                reason: 'Password reset',
                status: 'OPEN',
                expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
            });

            const result = await service.createSupportSession(
                { orgId: 'org-1', reason: 'Password reset' },
                USER,
            );
            expect(result.status).toBe('OPEN');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'SUPPORT_SESSION_OPENED' }),
            );
        });

        it('throws NotFoundException for unknown org', async () => {
            prisma.organization.findUnique.mockResolvedValue(null);
            await expect(
                service.createSupportSession({ orgId: 'bad', reason: 'help' }, USER),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('closeSupportSession', () => {
        it('closes an OPEN session and audits', async () => {
            prisma.supportSession.findUnique.mockResolvedValue({
                id: 'ss-1', status: 'OPEN',
            });
            prisma.supportSession.update.mockResolvedValue({
                id: 'ss-1', status: 'CLOSED', closedAt: new Date(),
            });

            const result = await service.closeSupportSession(
                'ss-1',
                { closedReason: 'Resolved' },
                USER,
            );
            expect(result.status).toBe('CLOSED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'SUPPORT_SESSION_CLOSED' }),
            );
        });

        it('throws NotFoundException for unknown session', async () => {
            prisma.supportSession.findUnique.mockResolvedValue(null);
            await expect(
                service.closeSupportSession('bad', { closedReason: 'x' }, USER),
            ).rejects.toThrow(NotFoundException);
        });

        it('throws ConflictException for already closed session', async () => {
            prisma.supportSession.findUnique.mockResolvedValue({
                id: 'ss-1', status: 'CLOSED',
            });
            await expect(
                service.closeSupportSession('ss-1', { closedReason: 'x' }, USER),
            ).rejects.toThrow(ConflictException);
        });
    });
});
