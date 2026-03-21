import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
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

    // 2. Branch must exist and be ACTIVE
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch || branch.status !== 'ACTIVE') {
      await this.audit.log({
        action: 'QUICK_PIN_BRANCH_DENIED',
        entityType: 'auth',
        metadata: { branchId, reason: 'branch_not_found_or_inactive' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Derive lookup hash and find candidate user
    const lookupHash = this.derivePinLookupHash(branchId, pin);
    const user = await this.prisma.user.findUnique({
      where: { pinLookupHash: lookupHash },
      include: {
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

    // 9. Check membership in branch
    const membership = await this.prisma.membership.findUnique({
      where: { userId_branchId: { userId: user.id, branchId } },
      include: { role: true },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      await this.audit.log({
        actorUserId: user.id,
        action: 'QUICK_PIN_BRANCH_DENIED',
        entityType: 'auth',
        entityId: user.id,
        metadata: { branchId, reason: 'no_active_membership' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new ForbiddenException('Not a member of this branch');
    }

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
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedPinAttempts: 0, pinLockedUntil: null },
    });

    const result = await this.createSessionAndTokens(
      user,
      platform,
      SessionSource.PIN,
      branch.organizationId,
      branchId,
      meta,
    );

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

  // ── Issue Quick PIN ──

  async issueQuickPin(
    targetUserId: string,
    actorUserId: string,
    defaultBranchId?: string,
    meta?: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        userRoles: { include: { role: true } },
        memberships: { where: { status: 'ACTIVE' }, include: { branch: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Determine tier from user's job roles
    const jobRoles = user.userRoles.map((ur) => ur.role.jobRole).filter(Boolean) as JobRole[];
    let tier: QuickPinTierValue | null = null;
    for (const jr of jobRoles) {
      const t = resolveQuickPinTier(jr);
      if (t) {
        // If user has both high and low roles, prefer higher tier
        if (!tier || t === QuickPinTierValue.HIGH_8) {
          tier = t;
        }
      }
    }

    if (!tier) {
      throw new BadRequestException('User role is not eligible for quick PIN login');
    }

    const pinLength = getPinLengthForTier(tier);

    // Pick a branch for lookup hash: use provided branchId or user's default/first active membership
    let branchId = defaultBranchId;
    if (!branchId) {
      const defaultMembership =
        user.memberships.find((m) => m.isDefaultBranch) || user.memberships[0];
      if (!defaultMembership) {
        throw new BadRequestException('User has no active branch membership');
      }
      branchId = defaultMembership.branchId;
    }

    // Generate random PIN and ensure uniqueness
    const { plainPin, pinHash, lookupHash } = await this.generateUniquePin(pinLength, branchId);

    // Update user
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        quickPinHash: pinHash,
        pinLookupHash: lookupHash,
        pinLength,
        pinTier: tier as any,
        quickPinEnabled: true,
        lastPinChangedAt: new Date(),
        quickPinIssuedAt: new Date(),
        quickPinIssuedById: actorUserId,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'QUICK_PIN_ISSUED',
      entityType: 'user',
      entityId: targetUserId,
      metadata: { tier, pinLength, branchId },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      userId: targetUserId,
      pin: plainPin,
      pinLength,
      tier,
      branchId,
      message:
        'Quick PIN issued. Provide this PIN to the staff member securely. It will not be shown again.',
    };
  }

  // ── Reset Quick PIN ──

  async resetQuickPin(
    targetUserId: string,
    actorUserId: string,
    defaultBranchId?: string,
    meta?: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        userRoles: { include: { role: true } },
        memberships: { where: { status: 'ACTIVE' }, include: { branch: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.quickPinEnabled && !user.quickPinHash) {
      throw new BadRequestException('User does not have a quick PIN to reset');
    }

    // Determine tier
    const jobRoles = user.userRoles.map((ur) => ur.role.jobRole).filter(Boolean) as JobRole[];
    let tier: QuickPinTierValue | null = user.pinTier as QuickPinTierValue | null;
    if (!tier) {
      for (const jr of jobRoles) {
        const t = resolveQuickPinTier(jr);
        if (t) {
          if (!tier || t === QuickPinTierValue.HIGH_8) tier = t;
        }
      }
    }

    if (!tier) {
      throw new BadRequestException('User role is not eligible for quick PIN login');
    }

    const pinLength = getPinLengthForTier(tier);

    let branchId = defaultBranchId;
    if (!branchId) {
      const defaultMembership =
        user.memberships.find((m) => m.isDefaultBranch) || user.memberships[0];
      if (!defaultMembership) {
        throw new BadRequestException('User has no active branch membership');
      }
      branchId = defaultMembership.branchId;
    }

    // Generate new PIN
    const { plainPin, pinHash, lookupHash } = await this.generateUniquePin(pinLength, branchId);

    // Update — old PIN immediately invalidated
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        quickPinHash: pinHash,
        pinLookupHash: lookupHash,
        pinLength,
        pinTier: tier as any,
        lastPinChangedAt: new Date(),
        quickPinIssuedAt: new Date(),
        quickPinIssuedById: actorUserId,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'QUICK_PIN_RESET',
      entityType: 'user',
      entityId: targetUserId,
      metadata: { tier, pinLength, branchId },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      userId: targetUserId,
      pin: plainPin,
      pinLength,
      tier,
      branchId,
      message: 'Quick PIN reset. Old PIN is invalidated. Provide the new PIN securely.',
    };
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
        await this.audit.log({
          actorUserId,
          action: 'QUICK_PIN_DISABLED',
          entityType: 'user',
          entityId: targetUserId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      } else {
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

  /**
   * Generate a cryptographically-secure random numeric PIN of the given length.
   */
  private generateRandomPin(length: number): string {
    const max = Math.pow(10, length);
    let pin: string;
    do {
      const bytes = crypto.randomBytes(4);
      const num = bytes.readUInt32BE(0) % max;
      pin = num.toString().padStart(length, '0');
    } while (pin.length !== length);
    return pin;
  }

  /**
   * Generate a unique PIN, ensuring the lookup hash doesn't collide.
   */
  private async generateUniquePin(
    length: number,
    branchId: string,
  ): Promise<{ plainPin: string; pinHash: string; lookupHash: string }> {
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      const plainPin = this.generateRandomPin(length);
      const lookupHash = this.derivePinLookupHash(branchId, plainPin);

      // Check uniqueness
      const existing = await this.prisma.user.findUnique({
        where: { pinLookupHash: lookupHash },
      });

      if (!existing) {
        const pinHash = await bcrypt.hash(plainPin, SALT_ROUNDS);
        return { plainPin, pinHash, lookupHash };
      }

      attempts++;
    }

    throw new BadRequestException(
      'Unable to generate a unique PIN after maximum attempts. Please try again.',
    );
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

    // Create access token
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, jti }, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    } as any);

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
