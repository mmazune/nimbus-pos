import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RoleLevel, SessionPlatform } from '@prisma/client';

/**
 * Default platform access matrix.
 * Higher role levels have access to more platforms.
 * This will be configurable per-org in M3+.
 */
const PLATFORM_ACCESS_MATRIX: Record<RoleLevel, SessionPlatform[]> = {
  L5: [
    SessionPlatform.WEB_BACKOFFICE,
    SessionPlatform.POS_DESKTOP,
    SessionPlatform.MOBILE_APP,
    SessionPlatform.KDS_SCREEN,
    SessionPlatform.DEV_PORTAL,
    SessionPlatform.OTHER,
  ],
  L4: [SessionPlatform.WEB_BACKOFFICE, SessionPlatform.MOBILE_APP, SessionPlatform.POS_DESKTOP],
  L3: [SessionPlatform.KDS_SCREEN, SessionPlatform.POS_DESKTOP],
  L2: [SessionPlatform.POS_DESKTOP, SessionPlatform.MOBILE_APP],
  L1: [SessionPlatform.MOBILE_APP],
};

@Injectable()
export class PlatformAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    // Platform from X-Platform header, or default to WEB_BACKOFFICE
    const platformHeader = request.headers['x-platform'] || 'WEB_BACKOFFICE';
    const platform = platformHeader as SessionPlatform;

    if (!Object.values(SessionPlatform).includes(platform)) {
      throw new ForbiddenException(`Invalid platform: ${platform}`);
    }

    const userLevel: RoleLevel = user.roleLevel;
    if (!userLevel) {
      throw new ForbiddenException('User has no role level assigned');
    }

    const allowedPlatforms = PLATFORM_ACCESS_MATRIX[userLevel] || [];
    if (!allowedPlatforms.includes(platform)) {
      throw new ForbiddenException(`Role level ${userLevel} cannot access platform ${platform}`);
    }

    return true;
  }
}
