import {
    Injectable,
    BadRequestException,
    ConflictException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { BillingService } from '../billing/billing.service';
import {
    CreateOnboardingOrgDto,
    CreateOnboardingBranchDto,
    UpdateBusinessProfileDto,
    UpdateOnboardingSettingsDto,
    CreateOnboardingInvitationsDto,
    OnboardingInvitationDto,
} from './dto';

const INVITATION_TTL_DAYS = 14;
function sha256(s: string): string {
    return crypto.createHash('sha256').update(s).digest('hex');
}

// Roles that the OWNER may invite during onboarding. Broader staff (Cashier,
// Waiter, Chef, etc.) are deliberately added LATER from inside the app /
// POS admin — NOT in this onboarding wizard.
const INVITABLE_ROLES_DURING_ONBOARDING = ['Manager', 'Accountant'];

@Injectable()
export class ClientOnboardingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly billing: BillingService,
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

    async getOnboardingStatus(orgId: string) {
        let progress = await this.prisma.onboardingProgress.findUnique({
            where: { orgId },
        });

        if (!progress) {
            progress = await this.prisma.onboardingProgress.create({
                data: { orgId },
            });
        }

        const steps = [
            { step: 'accountCreated', status: progress.accountCreated },
            { step: 'subscriptionPaid', status: progress.subscriptionPaid },
            { step: 'organizationCreated', status: progress.organizationCreated },
            { step: 'firstBranchCreated', status: progress.firstBranchCreated },
            { step: 'businessProfileDone', status: progress.businessProfileDone },
            { step: 'coreSettingsDone', status: progress.coreSettingsDone },
            { step: 'teamInvited', status: progress.teamInvited },
        ];

        const completedSteps = steps.filter((s) => s.status === 'COMPLETED').length;
        const totalSteps = steps.length;
        const isComplete = progress.completedAt !== null;

        return {
            orgId,
            steps,
            completedSteps,
            totalSteps,
            progressPercent: Math.round((completedSteps / totalSteps) * 100),
            isComplete,
            completedAt: progress.completedAt,
        };
    }

    async createOrganization(orgId: string, dto: CreateOnboardingOrgDto, userId: string) {
        const progress = await this.prisma.onboardingProgress.findUnique({ where: { orgId } });

        if (progress?.organizationCreated === 'COMPLETED') {
            throw new ConflictException('Organization already created during onboarding');
        }

        // Update the org with provided details
        const org = await this.prisma.organization.update({
            where: { id: orgId },
            data: {
                name: dto.name,
                slug: dto.slug,
                legalName: dto.legalName,
                taxId: dto.taxId,
            },
        });

        await this.prisma.onboardingProgress.upsert({
            where: { orgId },
            update: { organizationCreated: 'COMPLETED' },
            create: { orgId, organizationCreated: 'COMPLETED' },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'ONBOARDING_ORG_CREATED',
            entityType: 'Organization',
            entityId: org.id,
            metadata: { slug: dto.slug },
        });

        await this.checkAutoComplete(orgId);

        return { organization: org, step: 'organizationCreated', status: 'COMPLETED' };
    }

    async createBranch(orgId: string, dto: CreateOnboardingBranchDto, userId: string) {
        const progress = await this.prisma.onboardingProgress.findUnique({ where: { orgId } });

        if (progress?.firstBranchCreated === 'COMPLETED') {
            throw new ConflictException('First branch already created during onboarding');
        }

        // ── M39 PLAN-CATALOG CORRECTION ──
        // Onboarding only ever creates the FIRST branch (Solo allows 1) — but
        // we still defer to the central plan-cap check so the rule lives in
        // exactly one place. If no subscription is attached yet (e.g. before
        // the SaaS PesaPal step), the cap check is skipped.
        const hasSubscription = await this.prisma.subscription.findUnique({ where: { orgId } });
        if (hasSubscription) {
            await this.billing.checkPlanLimit(orgId, 'BRANCH', userId);
        }

        const branch = await this.prisma.branch.create({
            data: {
                organizationId: orgId,
                name: dto.name,
                code: dto.code || dto.name.toUpperCase().replace(/\s+/g, '_').substring(0, 10),
                slug: dto.name.toLowerCase().replace(/\s+/g, '-'),
            },
        });

        await this.prisma.onboardingProgress.upsert({
            where: { orgId },
            update: { firstBranchCreated: 'COMPLETED' },
            create: { orgId, firstBranchCreated: 'COMPLETED' },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'ONBOARDING_BRANCH_CREATED',
            entityType: 'Branch',
            entityId: branch.id,
            metadata: { name: dto.name },
        });

        await this.checkAutoComplete(orgId);

        return { branch, step: 'firstBranchCreated', status: 'COMPLETED' };
    }

    async updateBusinessProfile(orgId: string, dto: UpdateBusinessProfileDto, userId: string) {
        await this.prisma.onboardingProgress.upsert({
            where: { orgId },
            update: { businessProfileDone: 'COMPLETED' },
            create: { orgId, businessProfileDone: 'COMPLETED' },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'ONBOARDING_BUSINESS_PROFILE_UPDATED',
            entityType: 'Organization',
            entityId: orgId,
            metadata: dto as unknown as Record<string, unknown>,
        });

        await this.checkAutoComplete(orgId);

        return { step: 'businessProfileDone', status: 'COMPLETED' };
    }

    async updateSettings(orgId: string, dto: UpdateOnboardingSettingsDto, userId: string) {
        await this.prisma.onboardingProgress.upsert({
            where: { orgId },
            update: { coreSettingsDone: 'COMPLETED' },
            create: { orgId, coreSettingsDone: 'COMPLETED' },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'ONBOARDING_SETTINGS_UPDATED',
            entityType: 'Organization',
            entityId: orgId,
            metadata: dto as unknown as Record<string, unknown>,
        });

        await this.checkAutoComplete(orgId);

        return { step: 'coreSettingsDone', status: 'COMPLETED' };
    }

    async createInvitations(orgId: string, dto: CreateOnboardingInvitationsDto, userId: string) {
        if (!Array.isArray(dto.invitations) || dto.invitations.length === 0) {
            throw new BadRequestException('At least one invitation is required');
        }

        // M39.2 — owner only invites the CORE TEAM here. Other staff (Cashier,
        // Waiter, Chef, etc.) are added later from inside the app, not as part
        // of onboarding.
        for (const inv of dto.invitations) {
            if (!INVITABLE_ROLES_DURING_ONBOARDING.includes(inv.roleName)) {
                throw new BadRequestException(
                    `Role "${inv.roleName}" cannot be invited during onboarding. Allowed: ${INVITABLE_ROLES_DURING_ONBOARDING.join(', ')}. Other staff are added later from inside the app.`,
                );
            }
        }

        // Resolve target branch — onboarding only ever has one branch at this
        // point. We pin invited core-team members to that branch by default.
        const targetBranch = await this.prisma.branch.findFirst({
            where: { organizationId: orgId, status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
        });
        if (!targetBranch) {
            throw new BadRequestException(
                'Cannot invite team before the first branch is created. Complete the firstBranchCreated step first.',
            );
        }

        const results = [] as Array<{
            email: string;
            roleName: string;
            userId: string;
            membershipId: string;
            branchId: string;
            wasNewUser: boolean;
            invitationId: string;
            invitationToken: string;
            tempPassword: string | null;
            status: 'INVITED' | 'ALREADY_MEMBER';
            expiresAt: Date;
        }>;

        for (const inv of dto.invitations) {
            const result = await this.inviteOne(orgId, targetBranch.id, inv, userId);
            results.push(result);
        }

        await this.prisma.onboardingProgress.upsert({
            where: { orgId },
            update: { teamInvited: 'COMPLETED' },
            create: { orgId, teamInvited: 'COMPLETED' },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'ONBOARDING_INVITATIONS_SENT',
            entityType: 'Organization',
            entityId: orgId,
            metadata: {
                invitationCount: dto.invitations.length,
                invitedEmails: dto.invitations.map((i) => i.email),
            },
        });

        await this.checkAutoComplete(orgId);

        return {
            step: 'teamInvited',
            status: 'COMPLETED',
            invited: results.length,
            invitations: results,
            firstLoginInstructions:
                'Invited users log in globally at POST /auth/login with their email + tempPassword. After login, GET /auth/me resolves their org/branch context (memberships array). They will be auto-routed to their assigned branch on first login.',
        };
    }

    private async inviteOne(
        orgId: string,
        branchId: string,
        inv: OnboardingInvitationDto,
        actorUserId: string,
    ) {
        const role = await this.prisma.role.findFirst({ where: { name: inv.roleName } });
        if (!role) {
            throw new BadRequestException(`Role "${inv.roleName}" not found in system`);
        }

        const email = inv.email.toLowerCase().trim();
        const existing = await this.prisma.user.findUnique({ where: { email } });

        let user = existing;
        let tempPassword: string | null = null;
        let wasNewUser = false;

        if (!user) {
            // Generate a single-use temporary password — returned ONCE in this
            // response. The invited user uses it to log in globally; first
            // login resolves their membership via GET /auth/me.
            tempPassword = `Tmp-${crypto.randomBytes(6).toString('base64url')}!9`;
            const passwordHash = await bcrypt.hash(tempPassword, 10);
            user = await this.prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    firstName: inv.firstName ?? '',
                    lastName: inv.lastName ?? '',
                    isActive: true,
                },
            });
            wasNewUser = true;

            // Bind UserRole so RBAC permissions resolve at first login.
            await this.prisma.userRole.create({
                data: { userId: user.id, roleId: role.id },
            });
        }

        // Idempotent membership upsert — re-invitations don't double-add.
        const existingMembership = await this.prisma.membership.findUnique({
            where: { userId_branchId: { userId: user.id, branchId } },
        });

        let membership = existingMembership;
        let membershipStatus: 'INVITED' | 'ALREADY_MEMBER' = 'INVITED';
        if (!membership) {
            membership = await this.prisma.membership.create({
                data: {
                    userId: user.id,
                    organizationId: orgId,
                    branchId,
                    roleId: role.id,
                    isDefaultBranch: true,
                    status: 'ACTIVE',
                },
            });
        } else {
            membershipStatus = 'ALREADY_MEMBER';
        }

        // BG1 — persist a tracked Invitation row so resend/revoke have a target.
        // The plaintext token is returned ONCE; only its SHA-256 hash is stored.
        const invitationToken = `inv_${crypto.randomBytes(16).toString('hex')}`;
        const tokenHash = sha256(invitationToken);
        const expiresAt = new Date(
            Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        // If the user already had a PENDING invite for this email, mark it
        // EXPIRED so we always have a single live invite.
        await this.prisma.invitation.updateMany({
            where: {
                organizationId: orgId,
                email,
                status: 'PENDING',
            },
            data: { status: 'EXPIRED' },
        });

        const invitation = await this.prisma.invitation.create({
            data: {
                organizationId: orgId,
                branchId,
                roleId: role.id,
                email,
                firstName: inv.firstName ?? null,
                lastName: inv.lastName ?? null,
                tokenHash,
                status: 'PENDING',
                expiresAt,
                invitedById: actorUserId,
                membershipId: membership.id,
                userId: user.id,
                metadata: { roleName: inv.roleName, wasNewUser },
            },
        });

        await this.audit.log({
            actorUserId,
            action: 'ONBOARDING_INVITATION_CREATED',
            entityType: 'Invitation',
            entityId: invitation.id,
            metadata: {
                email,
                roleName: inv.roleName,
                branchId,
                wasNewUser,
                membershipStatus,
                membershipId: membership.id,
            },
        });

        return {
            email,
            roleName: inv.roleName,
            userId: user.id,
            membershipId: membership.id,
            branchId,
            wasNewUser,
            invitationId: invitation.id,
            invitationToken,
            tempPassword,
            status: membershipStatus,
            expiresAt,
        };
    }

    // ── BG1: Resend / Revoke ──

    /**
     * POST /api/onboarding/invitations/:id/resend
     * Rotates the invitation token, extends expiry, increments resendCount,
     * keeps the same membership/user. Returns the new plaintext token ONCE.
     */
    async resendInvitation(
        orgId: string,
        invitationId: string,
        actorUserId: string,
    ) {
        const inv = await this.prisma.invitation.findUnique({
            where: { id: invitationId },
        });
        if (!inv) throw new NotFoundException('Invitation not found');
        if (inv.organizationId !== orgId) {
            throw new ForbiddenException('Invitation belongs to a different organization');
        }
        if (inv.status === 'ACCEPTED') {
            throw new ConflictException('Invitation already accepted');
        }
        if (inv.status === 'REVOKED') {
            throw new ConflictException('Invitation has been revoked');
        }

        const newToken = `inv_${crypto.randomBytes(16).toString('hex')}`;
        const tokenHash = sha256(newToken);
        const expiresAt = new Date(
            Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        const updated = await this.prisma.invitation.update({
            where: { id: invitationId },
            data: {
                tokenHash,
                status: 'PENDING',
                expiresAt,
                resendCount: { increment: 1 },
                lastResentAt: new Date(),
            },
        });

        await this.audit.log({
            actorUserId,
            action: 'ONBOARDING_INVITATION_RESENT',
            entityType: 'Invitation',
            entityId: invitationId,
            metadata: { email: inv.email, resendCount: updated.resendCount },
        });

        return {
            ok: true,
            invitationId,
            email: inv.email,
            invitationToken: newToken,
            expiresAt,
            resendCount: updated.resendCount,
        };
    }

    /**
     * PATCH /api/onboarding/invitations/:id/revoke
     */
    async revokeInvitation(
        orgId: string,
        invitationId: string,
        actorUserId: string,
        reason?: string,
    ) {
        const inv = await this.prisma.invitation.findUnique({
            where: { id: invitationId },
        });
        if (!inv) throw new NotFoundException('Invitation not found');
        if (inv.organizationId !== orgId) {
            throw new ForbiddenException('Invitation belongs to a different organization');
        }
        if (inv.status === 'ACCEPTED') {
            throw new ConflictException('Invitation already accepted — cannot revoke');
        }
        if (inv.status === 'REVOKED') {
            // Idempotent: already revoked
            return {
                ok: true,
                invitationId,
                status: 'REVOKED',
                alreadyRevoked: true,
            };
        }

        await this.prisma.invitation.update({
            where: { id: invitationId },
            data: {
                status: 'REVOKED',
                revokedAt: new Date(),
                revokedById: actorUserId,
                revokedReason: reason ?? null,
            },
        });

        await this.audit.log({
            actorUserId,
            action: 'ONBOARDING_INVITATION_REVOKED',
            entityType: 'Invitation',
            entityId: invitationId,
            metadata: { email: inv.email, reason: reason ?? null },
        });

        return {
            ok: true,
            invitationId,
            status: 'REVOKED' as const,
        };
    }

    private async checkAutoComplete(orgId: string) {
        const progress = await this.prisma.onboardingProgress.findUnique({ where: { orgId } });
        if (!progress) return;

        const allDone =
            progress.accountCreated === 'COMPLETED' &&
            progress.subscriptionPaid === 'COMPLETED' &&
            progress.organizationCreated === 'COMPLETED' &&
            progress.firstBranchCreated === 'COMPLETED' &&
            progress.businessProfileDone === 'COMPLETED' &&
            progress.coreSettingsDone === 'COMPLETED' &&
            progress.teamInvited === 'COMPLETED';

        if (allDone && !progress.completedAt) {
            await this.prisma.onboardingProgress.update({
                where: { orgId },
                data: { completedAt: new Date() },
            });
        }
    }
}
