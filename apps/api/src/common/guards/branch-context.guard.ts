import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BRANCH_CONTEXT_KEY } from '../decorators';
import { PrismaService } from '../prisma';
import { AuditService } from '../audit';

@Injectable()
export class BranchContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireBranch = this.reflector.getAllAndOverride<boolean>(BRANCH_CONTEXT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireBranch) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const branchId = request.headers['x-branch-id'] as string;

    if (!branchId) {
      throw new BadRequestException('X-Branch-Id header is required');
    }

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    // Verify branch exists and is active
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.status !== 'ACTIVE') {
      throw new BadRequestException('Branch not found or inactive');
    }

    // Verify user is an active member of this branch
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, branchId, status: 'ACTIVE' },
    });

    if (!membership) {
      await this.audit.log({
        actorUserId: user.id,
        action: 'BRANCH_ACCESS_DENIED',
        entityType: 'branch',
        entityId: branchId,
        metadata: { reason: 'no_active_membership', branchId },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      throw new ForbiddenException('Not a member of this branch');
    }

    // Attach branch context to request
    request.branchContext = {
      branchId: branch.id,
      organizationId: branch.organizationId,
      roleId: membership.roleId,
      membershipId: membership.id,
    };

    return true;
  }
}
