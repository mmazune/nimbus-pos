import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { HrService } from './hr.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  ListEmployeesQueryDto,
  CreateContractDto,
  ListContractsQueryDto,
  CreatePositionDto,
  CreateCompensationProfileDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class HrController {
  constructor(private readonly hrService: HrService) {}

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
}
