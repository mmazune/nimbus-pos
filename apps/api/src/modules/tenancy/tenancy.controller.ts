import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { TenancyService } from './tenancy.service';
import { CreateOrgDto, CreateBranchDto, CreateMembershipDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller()
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  // ── Organizations ──

  @Post('orgs')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:org:write')
  async createOrg(
    @Body() dto: CreateOrgDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.tenancyService.createOrg(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('orgs')
  @UseGuards(JwtAuthGuard)
  async listOrgs(@CurrentUser() user: { id: string }) {
    return this.tenancyService.listOrgs(user.id);
  }

  @Get('orgs/:orgId')
  @UseGuards(JwtAuthGuard)
  async getOrg(@Param('orgId') orgId: string, @CurrentUser() user: { id: string }) {
    return this.tenancyService.getOrg(orgId, user.id);
  }

  // ── Branches ──

  @Post('orgs/:orgId/branches')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:branch:write')
  async createBranch(
    @Param('orgId') orgId: string,
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.tenancyService.createBranch(orgId, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('branches')
  @UseGuards(JwtAuthGuard)
  async listBranches(@CurrentUser() user: { id: string }) {
    return this.tenancyService.listBranches(user.id);
  }

  @Get('branches/:branchId')
  @UseGuards(JwtAuthGuard)
  async getBranch(@Param('branchId') branchId: string, @CurrentUser() user: { id: string }) {
    return this.tenancyService.getBranch(branchId, user.id);
  }

  // ── Memberships ──

  @Post('orgs/:orgId/branches/:branchId/memberships')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:membership:manage')
  async createMembership(
    @Param('orgId') orgId: string,
    @Param('branchId') branchId: string,
    @Body() dto: CreateMembershipDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.tenancyService.createMembership(orgId, branchId, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('orgs/:orgId/branches/:branchId/memberships')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:membership:manage')
  async listMemberships(
    @Param('orgId') orgId: string,
    @Param('branchId') branchId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tenancyService.listMemberships(orgId, branchId, user.id);
  }

  // ── Me (tenancy context) ──

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { id: string; sessionId: string }) {
    return this.tenancyService.getMyTenancyContext(user.id, user.sessionId);
  }

  // ── Branch context test endpoint (proves the guard works) ──

  @Get('branch-test')
  @UseGuards(JwtAuthGuard, BranchContextGuard)
  @RequireBranchContext()
  async branchTest(@CurrentUser() user: { id: string }, @Req() req: Request) {
    return {
      message: 'Branch context verified',
      userId: user.id,
      branchContext: (req as any).branchContext,
    };
  }
}
