import {
    Injectable,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { QuickPinService } from '../auth/quick-pin.service';
import {
    resolveQuickPinTier,
    isFrontlinePinFirstRole,
} from '../auth/quick-pin.constants';
import { FrontlineStaffOnboardDto } from './dto';
import { JobRole } from '@prisma/client';

/**
 * BG1 / BG1.1 — Frontline Staff One-Call Onboarding (PIN-first).
 *
 * Orchestrates User + UserRole + Membership + Employee creation in a single
 * Prisma transaction, then (optionally, post-commit) issues a Quick PIN.
 *
 * BG1.1 refinements:
 *   - phone is the primary identity; email is optional. When email is omitted
 *     we synthesise an internal `pin-{cuid}@nimbus.pin.local` address so the
 *     unique-email constraint is preserved without exposing a fake address.
 *   - issueQuickPin defaults to TRUE for frontline JobRoles.
 *   - enablePasswordLogin defaults to FALSE — PIN-only users get a random
 *     unguessable passwordHash and mustChangePassword stays FALSE.
 *   - Response separates loginMode / quickPin / password / mustChangePassword.
 */
@Injectable()
export class FrontlineStaffOnboardingService {
    private readonly SALT_ROUNDS = 12;
    public static readonly SYNTHETIC_EMAIL_DOMAIN = 'nimbus.pin.local';

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly quickPin: QuickPinService,
    ) { }

    /** True if the User row is one we synthesised for a PIN-only frontline staff member. */
    static isSyntheticEmail(email: string | null | undefined): boolean {
        return !!email && email.endsWith(`@${this.SYNTHETIC_EMAIL_DOMAIN}`);
    }

    async onboard(
        actorUserId: string,
        ctx: { organizationId: string; branchId: string },
        dto: FrontlineStaffOnboardDto,
        meta: { ipAddress?: string; userAgent?: string } = {},
    ) {
        const orgId = ctx.organizationId;
        const branchId = ctx.branchId;

        // ── Validate role + tier policy ──
        const role = await this.prisma.role.findFirst({
            where: { name: dto.roleName, isActive: true },
        });
        if (!role) {
            throw new BadRequestException(`Role "${dto.roleName}" not found`);
        }

        const jobRole = role.jobRole as JobRole | null;
        const eligibleForPin = jobRole ? !!resolveQuickPinTier(jobRole) : false;
        const pinFirstRole = isFrontlinePinFirstRole(jobRole);

        // ── Mode resolution ──
        const enablePasswordLogin = dto.enablePasswordLogin === true;
        const wantsQuickPin =
            dto.issueQuickPin !== undefined ? dto.issueQuickPin : pinFirstRole;

        if (enablePasswordLogin) {
            if (!dto.email) {
                throw new BadRequestException(
                    'email is required when enablePasswordLogin=true',
                );
            }
            if (!dto.temporaryPassword) {
                throw new BadRequestException(
                    'temporaryPassword is required when enablePasswordLogin=true',
                );
            }
        }
        if (!enablePasswordLogin && !wantsQuickPin) {
            throw new BadRequestException(
                'At least one login mode must be enabled (issueQuickPin or enablePasswordLogin)',
            );
        }
        if (wantsQuickPin && !eligibleForPin) {
            throw new BadRequestException(
                `Role "${dto.roleName}" is not eligible for Quick PIN login`,
            );
        }

        // ── Validate branch lives under org ──
        const branch = await this.prisma.branch.findFirst({
            where: { id: branchId, organizationId: orgId },
        });
        if (!branch) {
            throw new BadRequestException(
                'Branch context does not belong to your organization',
            );
        }

        // ── Resolve email (real or synthetic) and check duplicates ──
        const realEmail = dto.email?.toLowerCase().trim() ?? null;
        let existingUser: Awaited<
            ReturnType<typeof this.prisma.user.findUnique>
        > | null = null;
        if (realEmail) {
            existingUser = await this.prisma.user.findUnique({
                where: { email: realEmail },
                include: { memberships: true } as any,
            });
            if (existingUser) {
                const memberships = (existingUser as any).memberships as Array<{
                    organizationId: string;
                    branchId: string;
                }>;
                const otherOrg = memberships.find(
                    (m) => m.organizationId !== orgId,
                );
                if (otherOrg) {
                    throw new ConflictException(
                        'A user with this email already belongs to another organization',
                    );
                }
                const sameBranch = memberships.find((m) => m.branchId === branchId);
                if (sameBranch) {
                    throw new ConflictException(
                        'User already has a membership in this branch — use HR endpoints to update',
                    );
                }
            }
        }

        // ── Optional position / compensation profile validation ──
        if (dto.employee.positionId) {
            const pos = await this.prisma.position.findUnique({
                where: { id: dto.employee.positionId },
            });
            if (!pos || pos.orgId !== orgId) {
                throw new BadRequestException(
                    `Position "${dto.employee.positionId}" not found in this organization`,
                );
            }
        }
        if (dto.employee.compensationProfileId) {
            const cp = await this.prisma.compensationProfile.findUnique({
                where: { id: dto.employee.compensationProfileId },
            });
            if (!cp || cp.orgId !== orgId) {
                throw new BadRequestException(
                    `Compensation profile "${dto.employee.compensationProfileId}" not found in this organization`,
                );
            }
        }
        if (dto.employee.contractId) {
            const contract = await this.prisma.employmentContract.findUnique({
                where: { id: dto.employee.contractId },
            });
            if (!contract || contract.orgId !== orgId) {
                throw new BadRequestException(
                    `Contract "${dto.employee.contractId}" not found in this organization`,
                );
            }
        }

        // ── Resolve / generate employee code ──
        let employeeCode = dto.employee.employeeCode;
        if (!employeeCode) {
            const count = await this.prisma.employee.count({ where: { orgId } });
            employeeCode = `EMP-${String(count + 1).padStart(5, '0')}`;
        }
        const codeExists = await this.prisma.employee.findUnique({
            where: { orgId_employeeCode: { orgId, employeeCode } },
        });
        if (codeExists) {
            throw new ConflictException(
                `Employee code "${employeeCode}" already exists in this organization`,
            );
        }

        // ── Resolve final stored email + password mode ──
        const userEmail =
            realEmail ??
            `pin-${crypto.randomBytes(12).toString('hex')}@${FrontlineStaffOnboardingService.SYNTHETIC_EMAIL_DOMAIN}`;

        // PIN-only users get a random unguessable passwordHash so the column
        // stays NOT NULL but the bcrypt comparison can never match anything
        // a human could type.
        const effectivePassword = enablePasswordLogin
            ? dto.temporaryPassword!
            : crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(effectivePassword, this.SALT_ROUNDS);

        // ── Transactional create (User + UserRole + Membership + Employee) ──
        const result = await this.prisma.$transaction(async (tx) => {
            const user =
                existingUser ??
                (await tx.user.create({
                    data: {
                        email: userEmail,
                        passwordHash,
                        firstName: dto.firstName,
                        lastName: dto.lastName,
                        isActive: true,
                        // Only force password change when password login is the
                        // enabled mode AND we set the initial temporaryPassword.
                        mustChangePassword: enablePasswordLogin,
                    },
                }));

            // UserRole — idempotent on (userId, roleId, orgId, branchId)
            const existingUR = await tx.userRole.findFirst({
                where: {
                    userId: user.id,
                    roleId: role.id,
                    orgId: orgId,
                    branchId: branchId,
                },
            });
            if (!existingUR) {
                await tx.userRole.create({
                    data: {
                        userId: user.id,
                        roleId: role.id,
                        orgId: orgId,
                        branchId: branchId,
                    },
                });
            }

            const membership = await tx.membership.create({
                data: {
                    userId: user.id,
                    organizationId: orgId,
                    branchId,
                    roleId: role.id,
                    isDefaultBranch: existingUser ? false : true,
                    status: 'ACTIVE',
                },
            });

            const employee = await tx.employee.create({
                data: {
                    orgId,
                    branchId,
                    userId: user.id,
                    employeeCode: employeeCode!,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    phone: dto.phone,
                    // Employee.email is nullable — keep it null when no real
                    // email was supplied so HR exports don't show synthetic
                    // pin.local addresses.
                    email: realEmail,
                    hireDate: new Date(dto.employee.hireDate),
                    employmentType: dto.employee.employmentType,
                    status: 'ACTIVE',
                    positionId: dto.employee.positionId ?? null,
                    compensationProfileId: dto.employee.compensationProfileId ?? null,
                },
            });

            return { user, membership, employee };
        });

        // ── Optional Quick PIN issuance (post-commit) ──
        let quickPin: { pin: string; tier: string; pinLength: number } | null = null;
        if (wantsQuickPin) {
            const pinResult = await this.quickPin.issueQuickPin(
                result.user.id,
                actorUserId,
                branchId,
                meta,
            );
            quickPin = {
                pin: (pinResult as any).pin,
                tier: (pinResult as any).tier,
                pinLength: (pinResult as any).pinLength,
            };
        }

        // ── Final auth-mode classification ──
        const authMode: 'PIN_ONLY' | 'PIN_PLUS_PASSWORD' | 'PASSWORD_ONLY' =
            quickPin && enablePasswordLogin
                ? 'PIN_PLUS_PASSWORD'
                : quickPin
                    ? 'PIN_ONLY'
                    : 'PASSWORD_ONLY';

        await this.audit.log({
            actorUserId,
            action: 'FRONTLINE_STAFF_ONBOARDED',
            entityType: 'Employee',
            entityId: result.employee.id,
            metadata: {
                email: realEmail,
                hasSyntheticEmail: !realEmail,
                phone: dto.phone,
                roleName: dto.roleName,
                jobRole: jobRole ?? null,
                organizationId: orgId,
                branchId,
                wasNewUser: !existingUser,
                authMode,
                quickPinIssued: !!quickPin,
                passwordLoginEnabled: enablePasswordLogin,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        const onboardingInstructions = this.buildOnboardingInstructions(
            authMode,
            !!quickPin,
            enablePasswordLogin,
        );

        return {
            ok: true,
            authMode,
            mustChangePassword: result.user.mustChangePassword,
            user: {
                id: result.user.id,
                email: realEmail,
                hasSyntheticEmail: !realEmail,
                firstName: result.user.firstName,
                lastName: result.user.lastName,
                phone: dto.phone,
                isActive: result.user.isActive,
                mustChangePassword: result.user.mustChangePassword,
                wasNewUser: !existingUser,
            },
            membership: {
                id: result.membership.id,
                roleId: role.id,
                roleName: role.name,
                jobRole: jobRole ?? null,
                organizationId: orgId,
                branchId,
                isDefaultBranch: result.membership.isDefaultBranch,
            },
            employee: {
                id: result.employee.id,
                employeeCode: result.employee.employeeCode,
                positionId: result.employee.positionId,
                contractId: dto.employee.contractId ?? null,
                hireDate: result.employee.hireDate,
                employmentType: result.employee.employmentType,
            },
            branchAccess: {
                organizationId: orgId,
                branchId,
                branchName: branch.name,
            },
            quickPin: quickPin
                ? {
                    issued: true,
                    pin: quickPin.pin,
                    pinLength: quickPin.pinLength,
                    tier: quickPin.tier,
                    shownOnce: true,
                    note: 'Returned ONCE — share with the staff member directly. The PIN cannot be retrieved later; reset to issue a new one.',
                }
                : { issued: false, shownOnce: false },
            passwordLogin: {
                enabled: enablePasswordLogin,
                temporaryPasswordIssued: enablePasswordLogin,
            },
            onboardingInstructions,
        };
    }

    private buildOnboardingInstructions(
        authMode: 'PIN_ONLY' | 'PIN_PLUS_PASSWORD' | 'PASSWORD_ONLY',
        pinIssued: boolean,
        passwordEnabled: boolean,
    ): string[] {
        const out: string[] = [];
        if (pinIssued) {
            out.push(
                'Hand the Quick PIN to the staff member privately — it is shown only once.',
            );
            out.push(
                'Staff logs in on the POS_DESKTOP terminal via POST /api/auth/quick-pin-login (branchId + pin + platform=POS_DESKTOP).',
            );
        }
        if (passwordEnabled) {
            out.push(
                'Staff can also sign in via POST /api/auth/login with the temporary password — they will be forced through POST /api/auth/force-password-change on first login.',
            );
        }
        if (authMode === 'PIN_ONLY') {
            out.push(
                'No email or password was provisioned. If staff later needs back-office access, use the Quick PIN admin endpoints to reset the PIN or call frontline onboarding again with enablePasswordLogin=true.',
            );
        }
        out.push(
            'If the PIN is forgotten, the manager can reset it via POST /api/hr/frontline-staff/{id}/quick-pin/reset (returns a fresh PIN once).',
        );
        return out;
    }
}
