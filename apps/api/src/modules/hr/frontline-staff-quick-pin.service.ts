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

    private async loadEmployeeForOrg(
        employeeId: string,
        orgId: string,
    ) {
        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId },
        });
        if (!employee || employee.orgId !== orgId) {
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
        const employee = await this.loadEmployeeForOrg(employeeId, ctx.organizationId);
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
        const employee = await this.loadEmployeeForOrg(employeeId, ctx.organizationId);
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

        const targetBranchId =
            body.branchId ?? employee.branchId ?? ctx.branchId;
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
        const employee = await this.loadEmployeeForOrg(employeeId, ctx.organizationId);
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
        const employee = await this.loadEmployeeForOrg(employeeId, ctx.organizationId);
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
