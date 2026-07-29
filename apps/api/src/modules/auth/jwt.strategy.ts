import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
  roles?: {
    id: string;
    name: string;
    level: string;
    jobRole: string | null;
  }[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET', 'nimbus-dev-access-secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const session = await this.prisma.session.findUnique({
      where: { jti: payload.jti },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session revoked or expired');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    if (!session.user?.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const now = new Date();
    if (now.getTime() - session.lastActivityAt.getTime() > 60_000) {
      void this.prisma.session
        .update({
          where: { id: session.id },
          data: { lastActivityAt: now },
        })
        .catch(() => undefined);
    }

    let roles = payload.roles ?? [];
    let permissions = payload.permissions ?? [];

    if (roles.length === 0 || permissions.length === 0) {
      const authzUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
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

      if (!authzUser || !authzUser.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      roles = authzUser.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        level: ur.role.level,
        jobRole: ur.role.jobRole,
      }));
      permissions = [
        ...new Set(
          authzUser.userRoles.flatMap((ur) =>
            ur.role.rolePermissions.map((rp) => rp.permission.action),
          ),
        ),
      ];
    }

    // Derive effective role level (highest)
    const roleLevelOrder = ['L1', 'L2', 'L3', 'L4', 'L5'];
    const highestRole = roles.reduce(
      (highest, role) => {
        const currentIndex = roleLevelOrder.indexOf(role.level);
        const highestIndex = roleLevelOrder.indexOf(highest.level);
        return currentIndex > highestIndex ? role : highest;
      },
      roles[0] || { level: 'L1' as const },
    );

    return {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      displayName: session.user.displayName,
      isActive: session.user.isActive,
      roleLevel: highestRole.level,
      roles,
      permissions,
      sessionId: session.id,
      jti: payload.jti,
      sessionOrgId: session.orgId,
      sessionBranchId: session.branchId,
      session: {
        id: session.id,
        platform: session.platform,
        source: session.source,
        lastActivityAt: session.lastActivityAt,
        createdAt: session.createdAt,
      },
    };
  }
}
