import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { HrService } from './hr.service';
import { FrontlineStaffOnboardingService } from './frontline-staff-onboarding.service';
import { FrontlineStaffQuickPinService } from './frontline-staff-quick-pin.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  ListEmployeesQueryDto,
  CreateContractDto,
  ListContractsQueryDto,
  CreatePositionDto,
  CreateCompensationProfileDto,
  FrontlineStaffOnboardDto,
  FrontlineQuickPinResetDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class HrController {
  constructor(
    private readonly hrService: HrService,
    private readonly frontlineOnboarding: FrontlineStaffOnboardingService,
    private readonly frontlineQuickPin: FrontlineStaffQuickPinService,
  ) { }

  // ── Employees ──

  @Post('employees')
  @Permissions('pos:hr:employees:create')
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.hrService.createEmployee(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('employees')
  @Permissions('pos:hr:employees:read')
  async listEmployees(@Query() query: ListEmployeesQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.hrService.listEmployees(ctx, query);
  }

  @Get('employees/:id')
  @Permissions('pos:hr:employees:read')
  async getEmployee(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.hrService.getEmployee(ctx, id);
  }

  @Patch('employees/:id')
  @Permissions('pos:hr:employees:update')
  async updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.hrService.updateEmployee(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Contracts ──

  @Post('contracts')
  @Permissions('pos:hr:contracts:create')
  async createContract(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.hrService.createContract(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('contracts')
  @Permissions('pos:hr:contracts:read')
  async listContracts(@Query() query: ListContractsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.hrService.listContracts(ctx, query);
  }

  // ── Positions ──

  @Post('positions')
  @Permissions('pos:hr:positions:create')
  async createPosition(
    @Body() dto: CreatePositionDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.hrService.createPosition(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('positions')
  @Permissions('pos:hr:positions:read')
  async listPositions(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.hrService.listPositions(ctx);
  }

  // ── Compensation Profiles ──

  @Post('compensation-profiles')
  @Permissions('pos:hr:compensation:create')
  async createCompensationProfile(
    @Body() dto: CreateCompensationProfileDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.hrService.createCompensationProfile(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('compensation-profiles')
  @Permissions('pos:hr:compensation:read')
  async listCompensationProfiles(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.hrService.listCompensationProfiles(ctx);
  }

  // ── BG1: Frontline Staff One-Call Onboarding ──

  @Post('frontline-staff/onboard')
  @Permissions('hr:frontline-staff:create')
  @HttpCode(201)
  async onboardFrontlineStaff(
    @Body() dto: FrontlineStaffOnboardDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.frontlineOnboarding.onboard(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── BG1.1: Frontline Staff Quick PIN Admin (manager-facing) ──

  @Get('frontline-staff/:id/quick-pin-status')
  @Permissions('auth:quick-pin:read')
  async frontlineQuickPinStatus(
    @Param('id') employeeId: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.frontlineQuickPin.getStatus(user.id, ctx, employeeId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('frontline-staff/:id/quick-pin/reset')
  @Permissions('auth:quick-pin:write')
  @HttpCode(200)
  async frontlineQuickPinReset(
    @Param('id') employeeId: string,
    @Body() dto: FrontlineQuickPinResetDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.frontlineQuickPin.reset(user.id, ctx, employeeId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('frontline-staff/:id/quick-pin/disable')
  @Permissions('auth:quick-pin:write')
  @HttpCode(200)
  async frontlineQuickPinDisable(
    @Param('id') employeeId: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.frontlineQuickPin.disable(user.id, ctx, employeeId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('frontline-staff/:id/quick-pin/enable')
  @Permissions('auth:quick-pin:write')
  @HttpCode(200)
  async frontlineQuickPinEnable(
    @Param('id') employeeId: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.frontlineQuickPin.enable(user.id, ctx, employeeId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
