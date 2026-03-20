import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
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
    // Verify user exists and is active
    const user = await this.prisma.user.findUnique({
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

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Verify session is still active
    const session = await this.prisma.session.findUnique({
      where: { jti: payload.jti },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session revoked or expired');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    // Update last activity
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    // Derive effective role level (highest) and permissions
    const roles = user.userRoles.map((ur) => ur.role);
    const roleLevelOrder = ['L1', 'L2', 'L3', 'L4', 'L5'];
    const highestRole = roles.reduce(
      (highest, role) => {
        const currentIndex = roleLevelOrder.indexOf(role.level);
        const highestIndex = roleLevelOrder.indexOf(highest.level);
        return currentIndex > highestIndex ? role : highest;
      },
      roles[0] || { level: 'L1' as const },
    );

    const permissions = [
      ...new Set(roles.flatMap((r) => r.rolePermissions.map((rp) => rp.permission.action))),
    ];

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleLevel: highestRole.level,
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        level: r.level,
        jobRole: r.jobRole,
      })),
      permissions,
      sessionId: session.id,
      jti: payload.jti,
    };
  }
}
