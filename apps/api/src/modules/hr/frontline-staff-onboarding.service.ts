import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { QuickPinService } from '../auth/quick-pin.service';
import { resolveQuickPinTier, isFrontlinePinFirstRole } from '../auth/quick-pin.constants';
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
  ) {}

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
    const wantsQuickPin = dto.issueQuickPin !== undefined ? dto.issueQuickPin : pinFirstRole;

    if (enablePasswordLogin) {
      if (!dto.email) {
        throw new BadRequestException('email is required when enablePasswordLogin=true');
      }
      // T6: nobody sets another person's password. The person sets it themselves with
      // the one-time password-setup token this call returns.
      if (dto.temporaryPassword) {
        throw new BadRequestException({
          code: 'PASSWORD_SET_BY_PERSON',
          message:
            "A manager does not set another person's password. Leave temporaryPassword out; the person sets their own with the setup token.",
        });
      }
    }
    if (!enablePasswordLogin && !wantsQuickPin) {
      throw new BadRequestException(
        'At least one login mode must be enabled (issueQuickPin or enablePasswordLogin)',
      );
    }
    if (wantsQuickPin && !eligibleForPin) {
      throw new BadRequestException(`Role "${dto.roleName}" is not eligible for Quick PIN login`);
    }

    // ── Validate branch lives under org ──
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: orgId },
    });
    if (!branch) {
      throw new BadRequestException('Branch context does not belong to your organization');
    }

    // ── Resolve email (real or synthetic) and check duplicates ──
    const realEmail = dto.email?.toLowerCase().trim() ?? null;
    let existingUser: Awaited<ReturnType<typeof this.prisma.user.findUnique>> | null = null;
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
        const otherOrg = memberships.find((m) => m.organizationId !== orgId);
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
    // Every new account starts with a random, unguessable password nobody knows; a
    // password-login person sets their own with the setup token below.
    const effectivePassword = crypto.randomBytes(32).toString('hex');
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
            mustChangePassword: false,
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
    let quickPin: {
      tier: string;
      pinLength: number;
      pinSetup: { setupToken: string; expiresAt: Date; singleUse: true };
    } | null = null;
    if (wantsQuickPin) {
      const pinResult = await this.quickPin.startPinSetup(
        result.user.id,
        actorUserId,
        'ONBOARDING',
        branchId,
        meta,
      );
      quickPin = {
        tier: pinResult.tier,
        pinLength: pinResult.pinLength,
        pinSetup: pinResult.pinSetup as any,
      };
    }

    // Password login: a one-time password-setup token, never a password.
    let passwordSetup: { setupToken: string; expiresAt: Date; singleUse: true } | null = null;
    if (enablePasswordLogin && !existingUser) {
      const plaintext = `prt_${crypto.randomBytes(24).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      await this.prisma.passwordResetToken.create({
        data: {
          userId: result.user.id,
          tokenHash: crypto.createHash('sha256').update(plaintext).digest('hex'),
          purpose: 'INVITATION_FIRST_LOGIN',
          expiresAt,
          metadata: { startedByUserId: actorUserId, branchId },
        },
      });
      passwordSetup = { setupToken: plaintext, expiresAt, singleUse: true };
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
            issued: false,
            setupPending: true,
            pinLength: quickPin.pinLength,
            tier: quickPin.tier,
            pinSetup: quickPin.pinSetup,
            note: 'Hand the device to the staff member: they type their own PIN (POST /api/auth/pin-setup). Nobody else sees it.',
          }
        : { issued: false, setupPending: false },
      passwordLogin: {
        enabled: enablePasswordLogin,
        temporaryPasswordIssued: false,
        passwordSetup,
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
        'Hand the device to the staff member. They type their own PIN twice (POST /api/auth/pin-setup with the setup token); nobody else sees it. The setup works once, for 15 minutes.',
      );
      out.push(
        'Then they sign in on the POS_DESKTOP terminal via POST /api/auth/quick-pin-login (branchId + pin + platform=POS_DESKTOP).',
      );
    }
    if (passwordEnabled) {
      out.push(
        'For back-office sign-in the person sets their own password with the password setup token (POST /api/auth/reset-password).',
      );
    }
    if (authMode === 'PIN_ONLY') {
      out.push(
        'No email or password was provisioned. If staff later needs back-office access, call frontline onboarding again with enablePasswordLogin=true.',
      );
    }
    out.push(
      'If the PIN is forgotten, the manager starts a reset via POST /api/hr/frontline-staff/{id}/quick-pin/reset: the old PIN stops at once and the person sets a new one the same way.',
    );
    return out;
  }
}
