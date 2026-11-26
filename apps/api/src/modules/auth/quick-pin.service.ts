import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { SessionPlatform, SessionSource, JobRole } from '@prisma/client';
import {
  resolveQuickPinTier,
  getPinLengthForTier,
  QuickPinTierValue,
  QUICK_PIN_ALLOWED_PLATFORMS,
  QUICK_PIN_MAX_FAILED_ATTEMPTS,
  QUICK_PIN_LOCKOUT_MINUTES,
  EXCLUDED_FROM_QUICK_PIN,
} from './quick-pin.constants';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const SALT_ROUNDS = 12;

@Injectable()
export class QuickPinService {
  private readonly pinPepper: string;
  private readonly accessSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.pinPepper = this.config.get<string>('QUICK_PIN_PEPPER', 'nimbus-dev-pin-pepper');
    this.accessSecret = this.config.get<string>('JWT_ACCESS_SECRET', 'nimbus-dev-access-secret');
    this.accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    this.refreshTtlMs = this.parseTtlToMs(refreshTtl);
  }

  // ── Quick PIN Login ──

  async quickPinLogin(branchId: string, pin: string, platform: SessionPlatform, meta: RequestMeta) {
    // 1. Platform must be POS_DESKTOP
    if (!QUICK_PIN_ALLOWED_PLATFORMS.includes(platform as any)) {
      await this.audit.log({
        action: 'QUICK_PIN_PLATFORM_DENIED',
        entityType: 'auth',
        metadata: { branchId, platform },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new ForbiddenException('Quick PIN login is only available on POS_DESKTOP');
    }

    // 2. Derive lookup hash and find candidate user. The membership include
    // carries branch/org context for the successful login path.
    const lookupHash = this.derivePinLookupHash(branchId, pin);
    const user = await this.prisma.user.findUnique({
      where: { pinLookupHash: lookupHash },
      include: {
        memberships: {
          where: { branchId },
          include: {
            role: true,
            branch: { select: { id: true, organizationId: true, status: true } },
          },
        },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      await this.audit.log({
        action: 'QUICK_PIN_LOGIN_FAILED',
        entityType: 'auth',
        metadata: { branchId, reason: 'no_user_found' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 4. Check user is active
    if (!user.isActive) {
      await this.audit.log({
        actorUserId: user.id,
        action: 'QUICK_PIN_LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        metadata: { branchId, reason: 'user_inactive' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 5. Check quickPinEnabled
    if (!user.quickPinEnabled) {
      await this.audit.log({
        actorUserId: user.id,
        action: 'QUICK_PIN_LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        metadata: { branchId, reason: 'quick_pin_disabled' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 6. Check lockout
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      await this.audit.log({
        actorUserId: user.id,
        action: 'QUICK_PIN_LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        metadata: {
          branchId,
          reason: 'locked_out',
          lockedUntil: user.pinLockedUntil.toISOString(),
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 7. Verify the PIN hash
    if (!user.quickPinHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const pinValid = await bcrypt.compare(pin, user.quickPinHash);
    if (!pinValid) {
      const newAttempts = user.failedPinAttempts + 1;
      const updateData: any = { failedPinAttempts: newAttempts };

      if (newAttempts >= QUICK_PIN_MAX_FAILED_ATTEMPTS) {
        updateData.pinLockedUntil = new Date(Date.now() + QUICK_PIN_LOCKOUT_MINUTES * 60 * 1000);
        await this.audit.log({
          actorUserId: user.id,
          action: 'QUICK_PIN_LOCKED',
          entityType: 'auth',
          entityId: user.id,
          metadata: { branchId, failedAttempts: newAttempts },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      await this.audit.log({
        actorUserId: user.id,
        action: 'QUICK_PIN_LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        metadata: { branchId, reason: 'invalid_pin', failedAttempts: newAttempts },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 8. Check PIN length matches user tier
    if (user.pinLength && pin.length !== user.pinLength) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 9. Check membership in branch. Real Prisma calls include this with the
    // user lookup; the fallback keeps unit-test mocks compatible.
    const membership =
      (Array.isArray((user as any).memberships) ? (user as any).memberships[0] : null) ??
      (await this.prisma.membership.findUnique({
        where: { userId_branchId: { userId: user.id, branchId } },
        include: {
          role: true,
          branch: { select: { id: true, organizationId: true, status: true } },
        },
      }));

    let membershipBranch = (membership as any)?.branch as
      | { id: string; organizationId: string; status: string }
      | undefined;
    if (membership && !membershipBranch) {
      membershipBranch =
        (await this.prisma.branch.findUnique({
          where: { id: branchId },
          select: { id: true, organizationId: true, status: true },
        })) ?? undefined;
    }
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      (membershipBranch && membershipBranch.status !== 'ACTIVE')
    ) {
      await this.audit.log({
        actorUserId: user.id,
        action: 'QUICK_PIN_BRANCH_DENIED',
        entityType: 'auth',
        entityId: user.id,
        metadata: { branchId, reason: 'no_active_membership_or_branch' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new ForbiddenException('Not a member of this branch');
    }
    const organizationId = membershipBranch?.organizationId ?? (membership as any).organizationId;

    // 10. Check role is allowed on POS_DESKTOP
    const userJobRoles = user.userRoles.map((ur) => ur.role.jobRole).filter(Boolean) as JobRole[];
    const hasAllowedRole = userJobRoles.some((jr) => !EXCLUDED_FROM_QUICK_PIN.includes(jr));
    if (!hasAllowedRole) {
      await this.audit.log({
        actorUserId: user.id,
        action: 'QUICK_PIN_PLATFORM_DENIED',
        entityType: 'auth',
        entityId: user.id,
        metadata: { branchId, reason: 'role_not_allowed_for_quick_pin' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new ForbiddenException('Role not allowed for quick PIN login');
    }

    // 11. Success — reset failed attempts and create session
    const [result] = await Promise.all([
      this.createSessionAndTokens(
        user,
        platform,
        SessionSource.PIN,
        organizationId,
        branchId,
        meta,
      ),
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedPinAttempts: 0, pinLockedUntil: null },
      }),
    ]);

    await this.audit.log({
      actorUserId: user.id,
      action: 'QUICK_PIN_LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user.id,
      metadata: { branchId, platform, source: 'PIN' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return result;
  }

  // ── PIN setup by token (T6) ──
  //
  // Rule (07-scenarios-and-rules.md, People; CLAUDE.md credential reset): a manager starts a
  // PIN; nobody ever sets or sees another person's PIN. The manager's action makes a one-time,
  // short-lived setup token bound to that person and branch. The device that holds it is
  // handed to the person, who types their own PIN twice (POST /api/auth/pin-setup). No
  // response, log line or audit row ever carries the PIN; only the token's SHA-256 is stored.

  static readonly PIN_SETUP_TTL_MINUTES = 15;

  static hashSetupToken(plaintext: string): string {
    return crypto.createHash('sha256').update(plaintext).digest('hex');
  }

  private resolveTier(
    jobRoles: JobRole[],
    current: QuickPinTierValue | null,
  ): QuickPinTierValue | null {
    let tier: QuickPinTierValue | null = current;
    if (!tier) {
      for (const jr of jobRoles) {
        const t = resolveQuickPinTier(jr);
        if (t && (!tier || t === QuickPinTierValue.HIGH_8)) tier = t;
      }
    }
    return tier;
  }

  /**
   * Start onboarding (first PIN) or a reset. A reset clears the old PIN at once, so a lost or
   * known PIN stops working before the person sets a new one. Earlier unused tokens for this
   * person are invalidated, so only one setup is ever live.
   */
  async startPinSetup(
    targetUserId: string,
    actorUserId: string,
    purpose: 'ONBOARDING' | 'RESET',
    defaultBranchId?: string,
    meta?: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        userRoles: { include: { role: true } },
        memberships: { where: { status: 'ACTIVE' } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const jobRoles = user.userRoles.map((ur) => ur.role.jobRole).filter(Boolean) as JobRole[];
    const tier = this.resolveTier(
      jobRoles,
      purpose === 'RESET' ? ((user.pinTier as QuickPinTierValue | null) ?? null) : null,
    );
    if (!tier) {
      throw new BadRequestException('User role is not eligible for quick PIN login');
    }
    const pinLength = getPinLengthForTier(tier);

    let branchId = defaultBranchId;
    if (!branchId) {
      const m = user.memberships.find((x) => x.isDefaultBranch) || user.memberships[0];
      if (!m) {
        throw new BadRequestException('User has no active branch membership');
      }
      branchId = m.branchId;
    }

    // Tenancy: the person must belong to that branch, and the actor to the same organisation
    // (the identity routes take any user id, so this is checked here for every caller).
    if (!user.memberships.some((m) => m.branchId === branchId)) {
      throw new BadRequestException("branchId is not one of this person's branches");
    }
    const orgId = user.memberships.find((m) => m.branchId === branchId)!.organizationId;
    if (actorUserId !== targetUserId) {
      const actorMember = await this.prisma.membership.findFirst({
        where: { userId: actorUserId, organizationId: orgId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!actorMember) {
        throw new NotFoundException('User not found');
      }
    }

    const now = new Date();
    const plaintext = `pst_${crypto.randomBytes(24).toString('base64url')}`;
    const expiresAt = new Date(now.getTime() + QuickPinService.PIN_SETUP_TTL_MINUTES * 60_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.pinSetupToken.updateMany({
        where: { userId: targetUserId, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });
      await tx.pinSetupToken.create({
        data: {
          userId: targetUserId,
          branchId: branchId!,
          tokenHash: QuickPinService.hashSetupToken(plaintext),
          purpose,
          issuedById: actorUserId,
          expiresAt,
        },
      });
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          pinLength,
          pinTier: tier as any,
          quickPinIssuedAt: now,
          quickPinIssuedById: actorUserId,
          // A reset ends the old PIN now: it cannot be used while the new one is pending.
          ...(purpose === 'RESET'
            ? {
                quickPinHash: null,
                pinLookupHash: null,
                quickPinEnabled: false,
                failedPinAttempts: 0,
                pinLockedUntil: null,
              }
            : {}),
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: purpose === 'RESET' ? 'QUICK_PIN_RESET' : 'QUICK_PIN_SETUP_STARTED',
      entityType: 'user',
      entityId: targetUserId,
      metadata: { tier, pinLength, branchId, purpose, expiresAt: expiresAt.toISOString() },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      userId: targetUserId,
      pinLength,
      tier,
      branchId,
      purpose,
      pinSetup: {
        setupToken: plaintext,
        expiresAt,
        singleUse: true,
      },
      message:
        'Hand the device to the staff member. They type their own PIN; nobody else sees it. The setup link works once and for 15 minutes.',
    };
  }

  /** Kept for callers of the old name: issuing a PIN now starts a setup. */
  async issueQuickPin(
    targetUserId: string,
    actorUserId: string,
    defaultBranchId?: string,
    meta?: RequestMeta,
  ) {
    return this.startPinSetup(targetUserId, actorUserId, 'ONBOARDING', defaultBranchId, meta);
  }

  /** Kept for callers of the old name: resetting clears the old PIN and starts a setup. */
  async resetQuickPin(
    targetUserId: string,
    actorUserId: string,
    defaultBranchId?: string,
    meta?: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.quickPinEnabled && !user.quickPinHash && !user.pinTier) {
      throw new BadRequestException('User does not have a quick PIN to reset');
    }
    return this.startPinSetup(targetUserId, actorUserId, 'RESET', defaultBranchId, meta);
  }

  private async findLiveSetupToken(plaintext: string) {
    if (typeof plaintext !== 'string' || !plaintext.startsWith('pst_')) {
      throw new NotFoundException('PIN setup link not found');
    }
    const record = await this.prisma.pinSetupToken.findUnique({
      where: { tokenHash: QuickPinService.hashSetupToken(plaintext) },
    });
    if (!record) throw new NotFoundException('PIN setup link not found');
    if (record.consumedAt) throw new ConflictException('PIN setup link already used');
    if (record.invalidatedAt) throw new ConflictException('PIN setup link was replaced');
    if (record.expiresAt < new Date()) throw new ConflictException('PIN setup link has expired');
    return record;
  }

  /** Public, token-authenticated: who the setup is for (first name and PIN length only). */
  async checkPinSetup(plaintext: string) {
    const record = await this.findLiveSetupToken(plaintext);
    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      select: { firstName: true, displayName: true, pinLength: true, isActive: true },
    });
    if (!user || !user.isActive) throw new NotFoundException('PIN setup link not found');
    return {
      firstName: user.firstName,
      displayName: user.displayName,
      pinLength: user.pinLength,
      purpose: record.purpose,
      expiresAt: record.expiresAt,
    };
  }

  /**
   * Public, token-authenticated: the person types their own PIN twice. The token is claimed
   * with a conditional update inside the same transaction that writes the PIN, so two taps
   * (or two devices) can never both use it.
   */
  async completePinSetup(plaintext: string, pin: string, pinConfirm: string, meta?: RequestMeta) {
    const record = await this.findLiveSetupToken(plaintext);
    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive) throw new NotFoundException('PIN setup link not found');
    const pinLength = user.pinLength ?? 0;

    if (typeof pin !== 'string' || typeof pinConfirm !== 'string' || pin !== pinConfirm) {
      throw new BadRequestException({ code: 'PIN_MISMATCH', message: 'The two PINs differ' });
    }
    if (!/^[0-9]+$/.test(pin) || pin.length !== pinLength) {
      throw new BadRequestException({
        code: 'PIN_FORMAT',
        message: `The PIN must be ${pinLength} digits`,
      });
    }
    if (/^(\d)\1+$/.test(pin)) {
      throw new BadRequestException({
        code: 'PIN_TOO_SIMPLE',
        message: 'Choose a less simple PIN',
      });
    }

    const lookupHash = this.derivePinLookupHash(record.branchId, pin);
    const clash = await this.prisma.user.findUnique({ where: { pinLookupHash: lookupHash } });
    if (clash && clash.id !== user.id) {
      throw new ConflictException({ code: 'PIN_TAKEN', message: 'Choose a different PIN' });
    }
    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.pinSetupToken.updateMany({
        where: { id: record.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('PIN setup link already used');
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          quickPinHash: pinHash,
          pinLookupHash: lookupHash,
          quickPinEnabled: true,
          lastPinChangedAt: now,
          failedPinAttempts: 0,
          pinLockedUntil: null,
        },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'QUICK_PIN_SET_BY_OWNER',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        branchId: record.branchId,
        purpose: record.purpose,
        pinLength,
        startedById: record.issuedById,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { ok: true, userId: user.id, pinLength, nextStep: 'quick-pin-login' };
  }

  // ── Update Quick PIN Settings ──

  async updateQuickPinSettings(
    targetUserId: string,
    actorUserId: string,
    data: {
      quickPinEnabled?: boolean;
      displayName?: string;
      employeeCode?: string;
      pinTier?: string;
      avatarUrl?: string;
    },
    meta?: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};

    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.employeeCode !== undefined) updateData.employeeCode = data.employeeCode;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    if (data.pinTier !== undefined) {
      if (!['LOW_6', 'HIGH_8'].includes(data.pinTier)) {
        throw new BadRequestException('Invalid pinTier value');
      }
      updateData.pinTier = data.pinTier;
    }

    if (data.quickPinEnabled !== undefined) {
      updateData.quickPinEnabled = data.quickPinEnabled;

      if (data.quickPinEnabled === false) {
        // C-28-EXEMPT: QUICK_PIN_DISABLED — updateQuickPinSettings() has no branchId in its own scope; the org-wide route (PATCH /auth/users/:id/quick-pin-settings, identity:user:write) carries no branch, though a separate branch-scoped caller exists elsewhere. Deferred: needs a signature change threaded through a shared method with a genuinely unscoped second caller.
        await this.audit.log({
          actorUserId,
          action: 'QUICK_PIN_DISABLED',
          entityType: 'user',
          entityId: targetUserId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      } else {
        // C-28-EXEMPT: QUICK_PIN_ENABLED — same reason as QUICK_PIN_DISABLED above. Deferred.
        await this.audit.log({
          actorUserId,
          action: 'QUICK_PIN_ENABLED',
          entityType: 'user',
          entityId: targetUserId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        employeeCode: true,
        quickPinEnabled: true,
        pinTier: true,
        pinLength: true,
        avatarUrl: true,
        lastPinChangedAt: true,
      },
    });

    return updated;
  }

  // ── Quick PIN Status ──

  async getQuickPinStatus(targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        displayName: true,
        employeeCode: true,
        quickPinEnabled: true,
        pinTier: true,
        pinLength: true,
        avatarUrl: true,
        lastPinChangedAt: true,
        quickPinIssuedAt: true,
        failedPinAttempts: true,
        pinLockedUntil: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      hasPin: !!user.lastPinChangedAt,
      isLocked: user.pinLockedUntil ? user.pinLockedUntil > new Date() : false,
    };
  }

  // ── Private: PIN generation ──

  /**
   * Derive a deterministic lookup hash: HMAC-SHA256(pepper, branchId:pin)
   * This allows fast indexed lookup without storing the raw PIN.
   */
  derivePinLookupHash(branchId: string, pin: string): string {
    return crypto.createHmac('sha256', this.pinPepper).update(`${branchId}:${pin}`).digest('hex');
  }

  // ── Private: session/token creation ──

  private async createSessionAndTokens(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      displayName?: string | null;
      userRoles: {
        role: {
          id: string;
          name: string;
          level: string;
          jobRole: string | null;
          rolePermissions: { permission: { action: string } }[];
        };
      }[];
    },
    platform: SessionPlatform,
    source: SessionSource,
    orgId: string,
    branchId: string,
    meta: RequestMeta,
  ) {
    const jti = crypto.randomUUID();
    const family = crypto.randomUUID();

    // Create session with org/branch context
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        jti,
        platform,
        source,
        orgId,
        branchId,
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    const roles = user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      level: ur.role.level,
      jobRole: ur.role.jobRole,
    }));

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.action)),
      ),
    ];

    // Create access token with short-lived auth claims so every protected
    // request does not reload the full role-permission graph.
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, jti, roles, permissions },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtl,
      } as any,
    );

    // Create refresh token
    const refreshTokenRaw = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        family,
        sessionId: session.id,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        roles,
        permissions,
      },
      session: {
        id: session.id,
        platform: session.platform,
        source: session.source,
        orgId,
        branchId,
      },
    };
  }

  private parseTtlToMs(ttl: string): number {
    const match = ttl.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}
