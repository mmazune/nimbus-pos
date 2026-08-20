import {
    Injectable,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { QuickPinService } from '../auth/quick-pin.service';
import { resolveQuickPinTier } from '../auth/quick-pin.constants';
import { JobRole } from '@prisma/client';
import { FrontlineStaffOnboardingService } from './frontline-staff-onboarding.service';

interface RequestMeta {
    ipAddress?: string;
    userAgent?: string;
}

/**
 * BG1.1 — Frontline Staff Quick PIN admin (manager-facing).
 *
 * Sits on top of the existing QuickPinService and exposes employee-id-keyed
 * endpoints under /api/hr/frontline-staff/:id/quick-pin*. Resolves Employee →
 * User, enforces tenancy + branch scope, and supports:
 *   - GET    quick-pin-status   (does not return the PIN)
 *   - POST   quick-pin/reset    (returns a fresh PIN ONCE)
 *   - PATCH  quick-pin/disable  (idempotent)
 *   - PATCH  quick-pin/enable   (rejects if no valid PIN exists)
 *
 * The stored Quick PIN itself is NEVER returned by any of these endpoints —
 * only at issuance / reset time, exactly once.
 */
@Injectable()
export class FrontlineStaffQuickPinService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly quickPin: QuickPinService,
    ) { }

    /**
     * B3-F1 (2026-08-20) — resolve the target employee inside BOTH the caller's org AND
     * the caller's active branch.
     *
     * Before this fix the lookup was `{ id, orgId }` only. `BranchContextGuard` already
     * proved the caller is an ACTIVE member of the `X-Branch-Id` they sent, but nothing
     * tied the *target* to that branch — so a manager of branch A who knew (or guessed)
     * an employee id in branch B could read that person's Quick PIN status and
     * reset / disable / enable their PIN. Verified live before the fix: a Manager token
     * scoped to Tapas Downtown got 200 on a Rooftop Bar employee for status, disable and
     * enable.
     *
     * The guard mirrors the branch-scoped HR pattern already used by shift-swap approve
     * (`where: { id, orgId, branchId, … }` → 404). It fails CLOSED in two ways:
     *   - a cross-branch employee is indistinguishable from a missing one (404, never a
     *     403 that would confirm the id exists elsewhere);
     *   - an employee with a NULL `branchId` (an org-level record with no home branch)
     *     is also refused, because there is no branch to check them against and Quick PIN
     *     issuance is inherently branch-scoped — the PIN lookup hash includes a branchId.
     */
    private async loadEmployeeForBranch(
        employeeId: string,
        ctx: { organizationId: string; branchId: string },
    ) {
        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId },
        });
        if (
            !employee ||
            employee.orgId !== ctx.organizationId ||
            !employee.branchId ||
            employee.branchId !== ctx.branchId
        ) {
            throw new NotFoundException('Frontline staff member not found');
        }
        if (!employee.userId) {
            throw new BadRequestException(
                'Frontline staff member has no linked User account; cannot administer Quick PIN',
            );
        }
        return employee;
    }

    private async loadUserWithRoles(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                userRoles: { include: { role: true } },
                memberships: { where: { status: 'ACTIVE' } },
            },
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async getStatus(
        actorUserId: string,
        ctx: { organizationId: string; branchId: string },
        employeeId: string,
        meta: RequestMeta = {},
    ) {
        const employee = await this.loadEmployeeForBranch(employeeId, ctx);
        const user = await this.loadUserWithRoles(employee.userId!);

        const jobRoles = user.userRoles
            .map((ur) => ur.role.jobRole)
            .filter(Boolean) as JobRole[];
        const eligibleRoles = jobRoles.filter((jr) => !!resolveQuickPinTier(jr));
        const eligibleForPin = eligibleRoles.length > 0;

        const hasPasswordLogin = !FrontlineStaffOnboardingService.isSyntheticEmail(
            user.email,
        );

        const status = {
            employeeId: employee.id,
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: employee.phone,
            email: hasPasswordLogin ? user.email : null,
            orgId: employee.orgId,
            branchId: employee.branchId,
            pinEnabled: user.quickPinEnabled,
            pinExists: !!user.quickPinHash,
            pinIssuedAt: user.quickPinIssuedAt,
            pinLastResetAt: user.lastPinChangedAt,
            pinLastUsedAt: null as Date | null, // not tracked yet — explicit null
            pinTier: user.pinTier,
            pinLength: user.pinLength,
            failedPinAttempts: user.failedPinAttempts,
            isLocked: user.pinLockedUntil ? user.pinLockedUntil > new Date() : false,
            lockedUntil: user.pinLockedUntil,
            eligibleForPin,
            hasPasswordLogin,
            mustChangePassword: user.mustChangePassword,
            authMode: this.deriveAuthMode(
                user.quickPinEnabled && !!user.quickPinHash,
                hasPasswordLogin,
            ),
        };

        await this.audit.log({
            actorUserId,
            action: 'QUICK_PIN_STATUS_VIEWED',
            entityType: 'Employee',
            entityId: employee.id,
            metadata: {
                userId: user.id,
                orgId: employee.orgId,
                branchId: employee.branchId,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return status;
    }

    async reset(
        actorUserId: string,
        ctx: { organizationId: string; branchId: string },
        employeeId: string,
        body: { branchId?: string },
        meta: RequestMeta = {},
    ) {
        const employee = await this.loadEmployeeForBranch(employeeId, ctx);
        const user = await this.loadUserWithRoles(employee.userId!);

        const jobRoles = user.userRoles
            .map((ur) => ur.role.jobRole)
            .filter(Boolean) as JobRole[];
        const eligible = jobRoles.some((jr) => !!resolveQuickPinTier(jr));
        if (!eligible) {
            throw new BadRequestException(
                'User role is not eligible for Quick PIN login',
            );
        }

        // B3-F1 — the optional `branchId` in the body used to be taken at face value and
        // passed straight into the Quick PIN lookup hash, so a caller could mint a PIN
        // scoped to a branch they are not acting in (verified live: 200 before the fix).
        // It is now accepted only as an explicit restatement of the active branch
        // context; anything else is refused rather than silently ignored, so a caller
        // that asked for a different branch is told it was refused.
        if (body.branchId && body.branchId !== ctx.branchId) {
            throw new BadRequestException(
                'branchId must match the active X-Branch-Id context — a Quick PIN cannot be issued for another branch',
            );
        }

        // `loadEmployeeForBranch` has already proven employee.branchId === ctx.branchId,
        // so these three resolve to the same value; the chain is kept for clarity.
        const targetBranchId = body.branchId ?? employee.branchId ?? ctx.branchId;
        if (!targetBranchId) {
            throw new BadRequestException(
                'Cannot resolve branch for PIN reset — provide branchId in body',
            );
        }

        // If the user has never had a PIN before, fall through to issue.
        const opName = user.quickPinHash ? 'reset' : 'issue';
        const result =
            opName === 'reset'
                ? await this.quickPin.resetQuickPin(
                    user.id,
                    actorUserId,
                    targetBranchId,
                    meta,
                )
                : await this.quickPin.issueQuickPin(
                    user.id,
                    actorUserId,
                    targetBranchId,
                    meta,
                );

        // Re-enable in case it was previously disabled.
        await this.prisma.user.update({
            where: { id: user.id },
            data: { quickPinEnabled: true },
        });

        return {
            ok: true,
            employeeId: employee.id,
            userId: user.id,
            operation: opName,
            quickPin: {
                issued: true,
                pin: (result as any).pin,
                pinLength: (result as any).pinLength,
                tier: (result as any).tier,
                branchId: (result as any).branchId,
                shownOnce: true,
                note: 'Returned ONCE — share with the staff member directly. Old PIN (if any) is invalidated immediately.',
            },
        };
    }

    async disable(
        actorUserId: string,
        ctx: { organizationId: string; branchId: string },
        employeeId: string,
        meta: RequestMeta = {},
    ) {
        const employee = await this.loadEmployeeForBranch(employeeId, ctx);
        const user = await this.loadUserWithRoles(employee.userId!);

        // Idempotent — already disabled returns ok without re-auditing.
        if (!user.quickPinEnabled) {
            return {
                ok: true,
                employeeId: employee.id,
                userId: user.id,
                pinEnabled: false,
                alreadyDisabled: true,
            };
        }

        await this.quickPin.updateQuickPinSettings(
            user.id,
            actorUserId,
            { quickPinEnabled: false },
            meta,
        );

        return {
            ok: true,
            employeeId: employee.id,
            userId: user.id,
            pinEnabled: false,
            alreadyDisabled: false,
        };
    }

    async enable(
        actorUserId: string,
        ctx: { organizationId: string; branchId: string },
        employeeId: string,
        meta: RequestMeta = {},
    ) {
        const employee = await this.loadEmployeeForBranch(employeeId, ctx);
        const user = await this.loadUserWithRoles(employee.userId!);

        if (!user.quickPinHash) {
            throw new ConflictException(
                'No Quick PIN exists for this user — call /quick-pin/reset to issue one first',
            );
        }

        if (user.quickPinEnabled) {
            return {
                ok: true,
                employeeId: employee.id,
                userId: user.id,
                pinEnabled: true,
                alreadyEnabled: true,
            };
        }

        await this.quickPin.updateQuickPinSettings(
            user.id,
            actorUserId,
            { quickPinEnabled: true },
            meta,
        );

        return {
            ok: true,
            employeeId: employee.id,
            userId: user.id,
            pinEnabled: true,
            alreadyEnabled: false,
        };
    }

    private deriveAuthMode(
        hasPin: boolean,
        hasPasswordLogin: boolean,
    ): 'PIN_ONLY' | 'PIN_PLUS_PASSWORD' | 'PASSWORD_ONLY' | 'NONE' {
        if (hasPin && hasPasswordLogin) return 'PIN_PLUS_PASSWORD';
        if (hasPin) return 'PIN_ONLY';
        if (hasPasswordLogin) return 'PASSWORD_ONLY';
        return 'NONE';
    }
}
