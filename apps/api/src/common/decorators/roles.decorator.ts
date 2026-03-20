import { SetMetadata } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleLevel[]) => SetMetadata(ROLES_KEY, roles);
