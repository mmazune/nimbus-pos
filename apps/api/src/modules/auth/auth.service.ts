import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { LoginDto, PinLoginDto, RefreshDto } from './dto';
import { SessionPlatform, SessionSource } from '@prisma/client';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.accessSecret = this.config.get<string>('JWT_ACCESS_SECRET', 'nimbus-dev-access-secret');
    this.refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET', 'nimbus-dev-refresh-secret');
    this.accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    this.refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    this.refreshTtlMs = this.parseTtlToMs(this.refreshTtl);
  }

  // ── Login (email + password) ──

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
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

    if (!user || !user.isActive) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        metadata: { email: dto.email, reason: 'user_not_found_or_inactive' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.audit.log({
        actorUserId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        metadata: { reason: 'invalid_password' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const platform = dto.platform || SessionPlatform.WEB_BACKOFFICE;
    const result = await this.createSessionAndTokens(user, platform, SessionSource.PASSWORD, meta);

    await this.audit.log({
      actorUserId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user.id,
      metadata: { platform, source: 'PASSWORD' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return result;
  }

  // ── PIN Login ──

  async pinLogin(dto: PinLoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
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

    if (!user || !user.isActive || !user.pinHash) {
      await this.audit.log({
        action: 'PIN_LOGIN_FAILED',
        entityType: 'auth',
        metadata: {
          email: dto.email,
          reason: 'user_not_found_or_no_pin',
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const pinValid = await bcrypt.compare(dto.pin, user.pinHash);
    if (!pinValid) {
      await this.audit.log({
        actorUserId: user.id,
        action: 'PIN_LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        metadata: { reason: 'invalid_pin' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const platform = dto.platform || SessionPlatform.POS_DESKTOP;
    const result = await this.createSessionAndTokens(user, platform, SessionSource.PIN, meta);

    await this.audit.log({
      actorUserId: user.id,
      action: 'PIN_LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user.id,
      metadata: { platform, source: 'PIN' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return result;
  }

  // ── Refresh ──

  async refresh(dto: RefreshDto, meta: RequestMeta) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      // Token reuse detected — revoke entire family
      await this.prisma.refreshToken.updateMany({
        where: { family: storedToken.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token already used — all tokens in family revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    // Revoke old refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Verify session is active
    const session = await this.prisma.session.findUnique({
      where: { id: storedToken.sessionId },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session revoked');
    }

    // Generate new tokens
    const jti = session.jti;
    const accessToken = this.signAccessToken(storedToken.user.id, storedToken.user.email, jti);
    const newRefreshTokenRaw = this.generateRefreshToken();
    const newRefreshTokenHash = this.hashToken(newRefreshTokenRaw);

    const newRefreshRecord = await this.prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: newRefreshTokenHash,
        family: storedToken.family,
        sessionId: storedToken.sessionId,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        replacedById: null,
      },
    });

    // Link old token to new one
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { replacedById: newRefreshRecord.id },
    });

    // Update session activity
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    await this.audit.log({
      actorUserId: storedToken.userId,
      action: 'TOKEN_REFRESH',
      entityType: 'auth',
      entityId: storedToken.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken: newRefreshTokenRaw,
    };
  }

  // ── Logout (current session) ──

  async logout(userId: string, sessionId: string, meta: RequestMeta) {
    // Revoke session
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedById: userId,
        revokedReason: 'user_logout',
      },
    });

    // Revoke all refresh tokens for this session
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'LOGOUT',
      entityType: 'session',
      entityId: sessionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { message: 'Logged out successfully' };
  }

  // ── Logout All ──

  async logoutAll(userId: string, meta: RequestMeta) {
    const now = new Date();

    // Revoke all active sessions
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: now,
        revokedById: userId,
        revokedReason: 'logout_all',
      },
    });

    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'LOGOUT_ALL',
      entityType: 'auth',
      entityId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { message: 'All sessions revoked' };
  }

  // ── Me ──

  async me(userId: string, sessionId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
      throw new UnauthorizedException('User not found');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
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

    // ── M39.2 — Membership Context Resolution ──
    // After a global Nimbus login, the frontend does NOT show an "org login"
    // screen. It calls GET /auth/me and uses the returned `memberships` +
    // `context` block to either auto-select (one org / one branch) or prompt
    // the user to pick an org / branch.
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        organization: { select: { id: true, name: true, slug: true, status: true } },
        branch: { select: { id: true, name: true, slug: true, status: true } },
        role: { select: { id: true, name: true, level: true, jobRole: true } },
      },
      orderBy: [{ isDefaultBranch: 'desc' }, { createdAt: 'asc' }],
    });

    const membershipDtos = memberships.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      organizationSlug: m.organization.slug,
      organizationStatus: m.organization.status,
      branchId: m.branchId,
      branchName: m.branch.name,
      branchSlug: m.branch.slug,
      branchStatus: m.branch.status,
      roleId: m.roleId,
      roleName: m.role.name,
      roleLevel: m.role.level,
      jobRole: m.role.jobRole,
      status: m.status,
      isDefaultBranch: m.isDefaultBranch,
    }));

    const orgIds = [...new Set(membershipDtos.map((m) => m.organizationId))];
    const branchIds = [...new Set(membershipDtos.map((m) => m.branchId))];

    const defaultMembership =
      membershipDtos.find((m) => m.isDefaultBranch) || membershipDtos[0] || null;

    const requiresContextSelection =
      orgIds.length > 1 || (orgIds.length === 1 && branchIds.length > 1);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      isActive: user.isActive,
      roles,
      permissions,
      memberships: membershipDtos,
      context: {
        organizationCount: orgIds.length,
        branchCount: branchIds.length,
        requiresContextSelection,
        defaultOrganizationId: defaultMembership?.organizationId ?? null,
        defaultBranchId: defaultMembership?.branchId ?? null,
        defaultMembershipId: defaultMembership?.id ?? null,
      },
      session: session
        ? {
          id: session.id,
          platform: session.platform,
          source: session.source,
          lastActivityAt: session.lastActivityAt,
          createdAt: session.createdAt,
        }
        : null,
    };
  }

  // ── Sessions list ──

  async sessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        platform: true,
        source: true,
        ipAddress: true,
        userAgent: true,
        lastActivityAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return { sessions };
  }

  // ── Private helpers ──

  private async createSessionAndTokens(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
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
    meta: RequestMeta,
  ) {
    const jti = crypto.randomUUID();
    const family = crypto.randomUUID();

    // Create session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        jti,
        platform,
        source,
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    // Create access token
    const accessToken = this.signAccessToken(user.id, user.email, jti);

    // Create refresh token
    const refreshTokenRaw = this.generateRefreshToken();
    const refreshTokenHash = this.hashToken(refreshTokenRaw);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        family,
        sessionId: session.id,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    // Derive role info for response
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
        roles,
        permissions,
      },
      session: {
        id: session.id,
        platform: session.platform,
        source: session.source,
      },
    };
  }

  private signAccessToken(userId: string, email: string, jti: string): string {
    return this.jwt.sign({ sub: userId, email, jti }, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    } as any);
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseTtlToMs(ttl: string): number {
    const match = ttl.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
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
