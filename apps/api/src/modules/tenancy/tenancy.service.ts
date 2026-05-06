import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { BillingService } from '../billing/billing.service';
import { CreateOrgDto, CreateBranchDto, CreateMembershipDto } from './dto';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class TenancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) { }

  // ── Organizations ──

  async createOrg(dto: CreateOrgDto, actorUserId: string, meta: RequestMeta) {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('Organization slug already taken');
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        legalName: dto.legalName,
        taxId: dto.taxId,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'ORG_CREATED',
      entityType: 'organization',
      entityId: org.id,
      metadata: { name: org.name, slug: org.slug },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return org;
  }

  async listOrgs(actorUserId: string) {
    // Return orgs the user has at least one active membership in
    const memberships = await this.prisma.membership.findMany({
      where: { userId: actorUserId, status: 'ACTIVE' },
      select: { organizationId: true },
      distinct: ['organizationId'],
    });

    const orgIds = memberships.map((m) => m.organizationId);

    if (orgIds.length === 0) return [];

    return this.prisma.organization.findMany({
      where: { id: { in: orgIds }, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async getOrg(orgId: string, actorUserId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Check that user has membership in this org
    const membership = await this.prisma.membership.findFirst({
      where: { userId: actorUserId, organizationId: orgId, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new ForbiddenException('No access to this organization');
    }

    return org;
  }

  // ── Branches ──

  async createBranch(orgId: string, dto: CreateBranchDto, actorUserId: string, meta: RequestMeta) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // ── M39 PLAN-CATALOG CORRECTION ──
    // Enforce location (branch) cap from the active subscription. This is the
    // ONLY plan-level enforcement applied during branch creation. Customers
    // hitting their cap receive a structured upgrade-required ConflictException.
    // If the org has no subscription yet (e.g. fresh seed), enforcement is
    // skipped — the onboarding flow attaches a subscription before this point.
    const hasSubscription = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (hasSubscription) {
      await this.billing.checkPlanLimit(orgId, 'BRANCH', actorUserId);
    }

    // If code is provided, check uniqueness within org
    if (dto.code) {
      const existing = await this.prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: dto.code } },
      });
      if (existing) {
        throw new ConflictException('Branch code already used in this organization');
      }
    }

    const branch = await this.prisma.branch.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        code: dto.code,
        slug: dto.slug,
        timezone: dto.timezone ?? 'UTC',
        currencyCode: dto.currencyCode ?? 'USD',
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
      },
    });

    // Auto-create membership for the actor so they can immediately access the branch
    const ownerRole = await this.prisma.role.findFirst({ where: { jobRole: 'OWNER' } });
    if (ownerRole) {
      const existingMembership = await this.prisma.membership.findFirst({
        where: { userId: actorUserId, status: 'ACTIVE' },
      });
      await this.prisma.membership.create({
        data: {
          userId: actorUserId,
          organizationId: orgId,
          branchId: branch.id,
          roleId: ownerRole.id,
          status: 'ACTIVE',
          isDefaultBranch: !existingMembership,
        },
      });
    }

    await this.audit.log({
      actorUserId,
      action: 'BRANCH_CREATED',
      entityType: 'branch',
      entityId: branch.id,
      metadata: { orgId, name: branch.name, code: branch.code },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return branch;
  }

  async listBranches(actorUserId: string) {
    // Return only branches user has active membership in
    const memberships = await this.prisma.membership.findMany({
      where: { userId: actorUserId, status: 'ACTIVE' },
      include: {
        branch: {
          include: { organization: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    return memberships
      .filter((m) => m.branch.status === 'ACTIVE')
      .map((m) => ({
        id: m.branch.id,
        organizationId: m.branch.organizationId,
        organization: m.branch.organization,
        name: m.branch.name,
        code: m.branch.code,
        slug: m.branch.slug,
        timezone: m.branch.timezone,
        currencyCode: m.branch.currencyCode,
        address: m.branch.address,
        phone: m.branch.phone,
        email: m.branch.email,
        status: m.branch.status,
        membershipRole: m.roleId,
        isDefaultBranch: m.isDefaultBranch,
        createdAt: m.branch.createdAt,
        updatedAt: m.branch.updatedAt,
      }));
  }

  async getBranch(branchId: string, _actorUserId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  // ── Memberships ──

  async createMembership(
    orgId: string,
    branchId: string,
    dto: CreateMembershipDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    // Verify org and branch exist and branch belongs to org
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch || branch.organizationId !== orgId) {
      throw new NotFoundException('Branch not found in this organization');
    }

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Verify role exists
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if membership already exists
    const existing = await this.prisma.membership.findUnique({
      where: { userId_branchId: { userId: dto.userId, branchId } },
    });
    if (existing) {
      throw new ConflictException('User already has a membership in this branch');
    }

    // If isDefaultBranch, unset any other default for this user in this org
    if (dto.isDefaultBranch) {
      await this.prisma.membership.updateMany({
        where: { userId: dto.userId, organizationId: orgId, isDefaultBranch: true },
        data: { isDefaultBranch: false },
      });
    }

    const membership = await this.prisma.membership.create({
      data: {
        userId: dto.userId,
        organizationId: orgId,
        branchId,
        roleId: dto.roleId,
        isDefaultBranch: dto.isDefaultBranch ?? false,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        role: { select: { id: true, name: true, level: true, jobRole: true } },
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'MEMBERSHIP_CREATED',
      entityType: 'membership',
      entityId: membership.id,
      metadata: {
        targetUserId: dto.userId,
        orgId,
        branchId,
        roleId: dto.roleId,
        isDefaultBranch: dto.isDefaultBranch ?? false,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return membership;
  }

  async listMemberships(orgId: string, branchId: string, actorUserId: string) {
    // Verify branch belongs to org
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.organizationId !== orgId) {
      throw new NotFoundException('Branch not found in this organization');
    }

    // Verify actor has membership in the org
    const actorMembership = await this.prisma.membership.findFirst({
      where: { userId: actorUserId, organizationId: orgId, status: 'ACTIVE' },
    });
    if (!actorMembership) {
      throw new ForbiddenException('No access to this branch');
    }

    return this.prisma.membership.findMany({
      where: { organizationId: orgId, branchId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        role: { select: { id: true, name: true, level: true, jobRole: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Me (tenancy context) ──

  async getMyTenancyContext(userId: string, sessionId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    // Get all active memberships with org + branch details
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        organization: { select: { id: true, name: true, slug: true, status: true } },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            slug: true,
            timezone: true,
            currencyCode: true,
            status: true,
          },
        },
        role: { select: { id: true, name: true, level: true, jobRole: true } },
      },
    });

    // Build org list with branches
    const orgMap = new Map<string, { org: any; branches: any[] }>();
    let defaultBranch: any = null;

    for (const m of memberships) {
      if (!orgMap.has(m.organizationId)) {
        orgMap.set(m.organizationId, { org: m.organization, branches: [] });
      }
      const branchEntry = {
        ...m.branch,
        role: m.role,
        isDefaultBranch: m.isDefaultBranch,
      };
      orgMap.get(m.organizationId)!.branches.push(branchEntry);

      if (m.isDefaultBranch) {
        defaultBranch = branchEntry;
      }
    }

    const organizations = Array.from(orgMap.values()).map((v) => ({
      ...v.org,
      branches: v.branches,
    }));

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
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles,
      permissions,
      organizations,
      defaultBranch,
      session: session
        ? {
          id: session.id,
          platform: session.platform,
          source: session.source,
          orgId: session.orgId,
          branchId: session.branchId,
          lastActivityAt: session.lastActivityAt,
          createdAt: session.createdAt,
        }
        : null,
    };
  }

  // ── Branch context validation (used by BranchContextGuard) ──

  async validateBranchAccess(
    userId: string,
    branchId: string,
  ): Promise<{
    branchId: string;
    organizationId: string;
    roleId: string;
    membershipId: string;
  } | null> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, branchId, status: 'ACTIVE' },
      include: {
        branch: { select: { organizationId: true, status: true } },
      },
    });

    if (!membership || membership.branch.status !== 'ACTIVE') {
      return null;
    }

    return {
      branchId: membership.branchId,
      organizationId: membership.organizationId,
      roleId: membership.roleId,
      membershipId: membership.id,
    };
  }
}
