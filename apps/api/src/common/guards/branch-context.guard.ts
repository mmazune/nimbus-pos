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
  private readonly contextCache = new Map<
    string,
    {
      expiresAt: number;
      value: {
        branchId: string;
        organizationId: string;
        roleId: string;
        membershipId: string;
      };
    }
  >();
  private readonly pendingContext = new Map<
    string,
    Promise<{
      branchId: string;
      organizationId: string;
      roleId: string;
      membershipId: string;
    }>
  >();
  private readonly cacheTtlMs = 30_000;

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

    const cacheKey = `${user.id}:${branchId}`;
    const cached = this.contextCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      request.branchContext = cached.value;
      return true;
    }

    let pending = this.pendingContext.get(cacheKey);
    if (!pending) {
      pending = this.resolveBranchContext(user.id, branchId, request);
      this.pendingContext.set(cacheKey, pending);
      pending.finally(() => this.pendingContext.delete(cacheKey)).catch(() => undefined);
    }

    const value = await pending;
    this.contextCache.set(cacheKey, { value, expiresAt: Date.now() + this.cacheTtlMs });
    request.branchContext = value;

    return true;
  }

  private async resolveBranchContext(
    userId: string,
    branchId: string,
    request: any,
  ): Promise<{
    branchId: string;
    organizationId: string;
    roleId: string;
    membershipId: string;
  }> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, branchId, status: 'ACTIVE' },
      include: {
        branch: { select: { id: true, organizationId: true, status: true } },
      },
    });

    const resolvedBranch =
      membership?.branch ??
      (membership
        ? await this.prisma.branch.findUnique({
          where: { id: branchId },
          select: { id: true, organizationId: true, status: true },
        })
        : null);

    if (membership && resolvedBranch?.status === 'ACTIVE') {
      return {
        branchId: resolvedBranch.id,
        organizationId: resolvedBranch.organizationId,
        roleId: membership.roleId,
        membershipId: membership.id,
      };
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, status: true },
    });

    if (!branch || branch.status !== 'ACTIVE') {
      throw new BadRequestException('Branch not found or inactive');
    }

    await this.audit.log({
      actorUserId: userId,
      action: 'BRANCH_ACCESS_DENIED',
      entityType: 'branch',
      entityId: branchId,
      metadata: { reason: 'no_active_membership', branchId },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    throw new ForbiddenException('Not a member of this branch');
  }
}
