import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ClientOnboardingService } from './client-onboarding.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { BillingService } from '../billing/billing.service';

const ORG = 'org-1';
const USER = 'user-1';

function makePrisma() {
    return {
        membership: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        onboardingProgress: {
            findUnique: jest.fn(),
            create: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
        },
        organization: { update: jest.fn() },
        branch: { create: jest.fn(), findFirst: jest.fn() },
        subscription: { findUnique: jest.fn().mockResolvedValue(null) },
        user: { findUnique: jest.fn(), create: jest.fn() },
        userRole: { create: jest.fn() },
        role: { findFirst: jest.fn() },
    };
}

const PROGRESS_FRESH = {
    orgId: ORG,
    accountCreated: 'NOT_STARTED',
    subscriptionPaid: 'NOT_STARTED',
    organizationCreated: 'NOT_STARTED',
    firstBranchCreated: 'NOT_STARTED',
    businessProfileDone: 'NOT_STARTED',
    coreSettingsDone: 'NOT_STARTED',
    teamInvited: 'NOT_STARTED',
    completedAt: null,
};

const PROGRESS_ALL_DONE = {
    ...PROGRESS_FRESH,
    accountCreated: 'COMPLETED',
    subscriptionPaid: 'COMPLETED',
    organizationCreated: 'COMPLETED',
    firstBranchCreated: 'COMPLETED',
    businessProfileDone: 'COMPLETED',
    coreSettingsDone: 'COMPLETED',
    teamInvited: 'COMPLETED',
};

describe('ClientOnboardingService', () => {
    let service: ClientOnboardingService;
    let prisma: ReturnType<typeof makePrisma>;
    let audit: { log: jest.Mock };
    let billing: { checkPlanLimit: jest.Mock };

    beforeEach(async () => {
        prisma = makePrisma();
        audit = { log: jest.fn() };
        billing = { checkPlanLimit: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClientOnboardingService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
                { provide: BillingService, useValue: billing },
            ],
        }).compile();

        service = module.get(ClientOnboardingService);
    });

    // ── Org context ──
    describe('resolveOrgContext', () => {
        it('returns organizationId', async () => {
            prisma.membership.findFirst.mockResolvedValue({ organizationId: ORG });
            const ctx = await service.resolveOrgContext(USER);
            expect(ctx.organizationId).toBe(ORG);
        });

        it('throws if no membership', async () => {
            prisma.membership.findFirst.mockResolvedValue(null);
            await expect(service.resolveOrgContext(USER)).rejects.toThrow(BadRequestException);
        });
    });

    // ── Onboarding status ──
    describe('getOnboardingStatus', () => {
        it('returns progress with 0% for fresh progress', async () => {
            prisma.onboardingProgress.findUnique.mockResolvedValue(PROGRESS_FRESH);
            const result = await service.getOnboardingStatus(ORG);
            expect(result.completedSteps).toBe(0);
            expect(result.totalSteps).toBe(7);
            expect(result.progressPercent).toBe(0);
            expect(result.isComplete).toBe(false);
        });

        it('creates progress if none exists', async () => {
            prisma.onboardingProgress.findUnique.mockResolvedValue(null);
            prisma.onboardingProgress.create.mockResolvedValue(PROGRESS_FRESH);
            const result = await service.getOnboardingStatus(ORG);
            expect(prisma.onboardingProgress.create).toHaveBeenCalled();
            expect(result.totalSteps).toBe(7);
        });

        it('returns 100% when all steps complete', async () => {
            prisma.onboardingProgress.findUnique.mockResolvedValue({
                ...PROGRESS_ALL_DONE,
                completedAt: new Date(),
            });
            const result = await service.getOnboardingStatus(ORG);
            expect(result.completedSteps).toBe(7);
            expect(result.progressPercent).toBe(100);
            expect(result.isComplete).toBe(true);
        });
    });

    // ── Create organization ──
    describe('createOrganization', () => {
        const dto = { name: 'Acme', slug: 'acme', legalName: 'Acme Ltd', taxId: 'TX123' };

        it('creates org and marks step COMPLETED', async () => {
            prisma.onboardingProgress.findUnique
                .mockResolvedValueOnce({ ...PROGRESS_FRESH, organizationCreated: 'NOT_STARTED' }) // main check
                .mockResolvedValueOnce(PROGRESS_FRESH); // checkAutoComplete
            prisma.organization.update.mockResolvedValue({ id: ORG, ...dto });
            prisma.onboardingProgress.upsert.mockResolvedValue({});

            const result = await service.createOrganization(ORG, dto, USER);
            expect(result.step).toBe('organizationCreated');
            expect(result.status).toBe('COMPLETED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'ONBOARDING_ORG_CREATED' }),
            );
        });

        it('throws ConflictException if already done', async () => {
            prisma.onboardingProgress.findUnique.mockResolvedValue({
                ...PROGRESS_FRESH,
                organizationCreated: 'COMPLETED',
            });
            await expect(service.createOrganization(ORG, dto, USER)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    // ── Create branch ──
    describe('createBranch', () => {
        const dto = { name: 'Main Branch' };

        it('creates branch and marks step COMPLETED', async () => {
            prisma.onboardingProgress.findUnique
                .mockResolvedValueOnce({ ...PROGRESS_FRESH })
                .mockResolvedValueOnce(PROGRESS_FRESH);
            prisma.branch.create.mockResolvedValue({ id: 'branch-1', name: 'Main Branch' });
            prisma.onboardingProgress.upsert.mockResolvedValue({});

            const result = await service.createBranch(ORG, dto as any, USER);
            expect(result.step).toBe('firstBranchCreated');
            expect(result.status).toBe('COMPLETED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'ONBOARDING_BRANCH_CREATED' }),
            );
        });

        it('throws ConflictException if branch already created', async () => {
            prisma.onboardingProgress.findUnique.mockResolvedValue({
                ...PROGRESS_FRESH,
                firstBranchCreated: 'COMPLETED',
            });
            await expect(service.createBranch(ORG, dto as any, USER)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    // ── Business profile ──
    describe('updateBusinessProfile', () => {
        it('marks step COMPLETED and audits', async () => {
            prisma.onboardingProgress.upsert.mockResolvedValue({});
            prisma.onboardingProgress.findUnique.mockResolvedValue(PROGRESS_FRESH);

            const result = await service.updateBusinessProfile(ORG, { businessType: 'restaurant' } as any, USER);
            expect(result.step).toBe('businessProfileDone');
            expect(result.status).toBe('COMPLETED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'ONBOARDING_BUSINESS_PROFILE_UPDATED' }),
            );
        });
    });

    // ── Settings ──
    describe('updateSettings', () => {
        it('marks step COMPLETED and audits', async () => {
            prisma.onboardingProgress.upsert.mockResolvedValue({});
            prisma.onboardingProgress.findUnique.mockResolvedValue(PROGRESS_FRESH);

            const result = await service.updateSettings(ORG, { currency: 'USD' } as any, USER);
            expect(result.step).toBe('coreSettingsDone');
            expect(result.status).toBe('COMPLETED');
        });
    });

    // ── Invitations ──
    describe('createInvitations', () => {
        function setupInviteMocks() {
            prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', organizationId: ORG, status: 'ACTIVE' });
            prisma.role.findFirst.mockImplementation(({ where }: any) =>
                Promise.resolve({ id: `role-${where.name}`, name: where.name }),
            );
            prisma.user.findUnique.mockResolvedValue(null); // new user
            prisma.user.create.mockImplementation(({ data }: any) =>
                Promise.resolve({ id: `user-${data.email}`, ...data }),
            );
            prisma.userRole.create.mockResolvedValue({});
            prisma.membership.findUnique.mockResolvedValue(null);
            prisma.membership.create.mockImplementation(({ data }: any) =>
                Promise.resolve({ id: `m-${data.userId}`, ...data }),
            );
            prisma.onboardingProgress.upsert.mockResolvedValue({});
            prisma.onboardingProgress.findUnique.mockResolvedValue(PROGRESS_FRESH);
        }

        it('creates User + Membership + UserRole and returns tempPassword for new invitee', async () => {
            setupInviteMocks();

            const result = await service.createInvitations(
                ORG,
                {
                    invitations: [
                        { email: 'manager@acme.com', roleName: 'Manager', firstName: 'Mary' },
                    ],
                } as any,
                USER,
            );

            expect(result.step).toBe('teamInvited');
            expect(result.invited).toBe(1);
            expect(result.invitations[0].email).toBe('manager@acme.com');
            expect(result.invitations[0].roleName).toBe('Manager');
            expect(result.invitations[0].wasNewUser).toBe(true);
            expect(result.invitations[0].tempPassword).toMatch(/^Tmp-/);
            expect(result.invitations[0].invitationToken).toMatch(/^inv_/);
            expect(prisma.user.create).toHaveBeenCalled();
            expect(prisma.userRole.create).toHaveBeenCalled();
            expect(prisma.membership.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 'user-manager@acme.com',
                        organizationId: ORG,
                        branchId: 'branch-1',
                        isDefaultBranch: true,
                    }),
                }),
            );
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'ONBOARDING_INVITATION_CREATED' }),
            );
        });

        it('rejects roles outside Manager/Accountant during onboarding', async () => {
            setupInviteMocks();
            await expect(
                service.createInvitations(
                    ORG,
                    { invitations: [{ email: 'cashier@acme.com', roleName: 'Cashier' }] } as any,
                    USER,
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('reuses existing user and marks as ALREADY_MEMBER if membership exists', async () => {
            setupInviteMocks();
            prisma.user.findUnique.mockResolvedValue({ id: 'existing-user', email: 'manager@acme.com' });
            prisma.membership.findUnique.mockResolvedValue({ id: 'm-existing', userId: 'existing-user', branchId: 'branch-1' });

            const result = await service.createInvitations(
                ORG,
                { invitations: [{ email: 'manager@acme.com', roleName: 'Manager' }] } as any,
                USER,
            );

            expect(prisma.user.create).not.toHaveBeenCalled();
            expect(prisma.membership.create).not.toHaveBeenCalled();
            expect(result.invitations[0].status).toBe('ALREADY_MEMBER');
            expect(result.invitations[0].wasNewUser).toBe(false);
            expect(result.invitations[0].tempPassword).toBeNull();
        });

        it('throws when no active branch exists', async () => {
            setupInviteMocks();
            prisma.branch.findFirst.mockResolvedValue(null);
            await expect(
                service.createInvitations(
                    ORG,
                    { invitations: [{ email: 'a@b.com', roleName: 'Manager' }] } as any,
                    USER,
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws on empty invitations list', async () => {
            await expect(
                service.createInvitations(ORG, { invitations: [] } as any, USER),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ── Auto-complete ──
    describe('checkAutoComplete (via createInvitations)', () => {
        function setupInviteMocks() {
            prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', organizationId: ORG, status: 'ACTIVE' });
            prisma.role.findFirst.mockResolvedValue({ id: 'role-manager', name: 'Manager' });
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
            prisma.userRole.create.mockResolvedValue({});
            prisma.membership.findUnique.mockResolvedValue(null);
            prisma.membership.create.mockResolvedValue({ id: 'm1', userId: 'u1', branchId: 'branch-1' });
            prisma.onboardingProgress.upsert.mockResolvedValue({});
        }

        it('sets completedAt when all 7 steps COMPLETED', async () => {
            setupInviteMocks();
            prisma.onboardingProgress.findUnique.mockResolvedValue(PROGRESS_ALL_DONE);
            prisma.onboardingProgress.update.mockResolvedValue({});

            await service.createInvitations(
                ORG,
                { invitations: [{ email: 'a@b.com', roleName: 'Manager' }] } as any,
                USER,
            );
            expect(prisma.onboardingProgress.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ completedAt: expect.any(Date) }),
                }),
            );
        });

        it('does NOT set completedAt when steps remain', async () => {
            setupInviteMocks();
            prisma.onboardingProgress.findUnique.mockResolvedValue(PROGRESS_FRESH);

            await service.createInvitations(
                ORG,
                { invitations: [{ email: 'a@b.com', roleName: 'Manager' }] } as any,
                USER,
            );
            expect(prisma.onboardingProgress.update).not.toHaveBeenCalled();
        });
    });

    // ── M39.2: location-cap on branch creation ──
    describe('createBranch with active subscription (M39.2 location-cap)', () => {
        const dto = { name: 'Second Location' };

        it('calls billing.checkPlanLimit when subscription exists', async () => {
            prisma.onboardingProgress.findUnique
                .mockResolvedValueOnce({ ...PROGRESS_FRESH })
                .mockResolvedValueOnce(PROGRESS_FRESH);
            prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', orgId: ORG });
            prisma.branch.create.mockResolvedValue({ id: 'branch-2', name: dto.name });
            prisma.onboardingProgress.upsert.mockResolvedValue({});

            await service.createBranch(ORG, dto as any, USER);
            expect(billing.checkPlanLimit).toHaveBeenCalledWith(ORG, 'BRANCH', USER);
        });

        it('propagates 409 when plan-cap is exceeded', async () => {
            prisma.onboardingProgress.findUnique.mockResolvedValueOnce({ ...PROGRESS_FRESH });
            prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', orgId: ORG });
            billing.checkPlanLimit.mockRejectedValueOnce(
                new ConflictException({
                    code: 'PLAN_LOCATION_LIMIT_REACHED',
                    currentPlan: 'solo',
                    currentLocations: 1,
                    allowedLocations: 1,
                    recommendedNextPlan: 'growth',
                }),
            );

            await expect(service.createBranch(ORG, dto as any, USER)).rejects.toThrow(
                ConflictException,
            );
            expect(prisma.branch.create).not.toHaveBeenCalled();
        });

        it('skips checkPlanLimit when no subscription exists yet', async () => {
            prisma.onboardingProgress.findUnique
                .mockResolvedValueOnce({ ...PROGRESS_FRESH })
                .mockResolvedValueOnce(PROGRESS_FRESH);
            prisma.subscription.findUnique.mockResolvedValue(null);
            prisma.branch.create.mockResolvedValue({ id: 'branch-1', name: dto.name });
            prisma.onboardingProgress.upsert.mockResolvedValue({});

            await service.createBranch(ORG, dto as any, USER);
            expect(billing.checkPlanLimit).not.toHaveBeenCalled();
        });
    });
});
