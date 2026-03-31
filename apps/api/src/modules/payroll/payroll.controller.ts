import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { PayrollService } from './payroll.service';
import {
  CreatePayComponentDto,
  CreatePayrollAdjustmentDto,
  BuildPayRunDto,
  ApprovePayRunDto,
  PayPayRunDto,
  ListPayRunsQueryDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('payroll')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ── Pay Components ──

  @Post('components')
  @Permissions('pos:payroll:components:create')
  async createPayComponent(
    @Body() dto: CreatePayComponentDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.payrollService.createPayComponent(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('components')
  @Permissions('pos:payroll:components:read')
  async listPayComponents(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.payrollService.listPayComponents(ctx);
  }

  // ── Payroll Adjustments ──

  @Post('adjustments')
  @Permissions('pos:payroll:adjustments:create')
  async createPayrollAdjustment(
    @Body() dto: CreatePayrollAdjustmentDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.payrollService.createPayrollAdjustment(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('adjustments')
  @Permissions('pos:payroll:adjustments:read')
  async listPayrollAdjustments(
    @Query('employeeId') employeeId: string,
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.payrollService.listPayrollAdjustments(ctx, {
      employeeId,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  // ── Pay Runs ──

  @Post('runs/build')
  @Permissions('pos:payroll:runs:build')
  async buildPayRun(
    @Body() dto: BuildPayRunDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.payrollService.buildPayRun(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('runs/:id/approve')
  @Permissions('pos:payroll:runs:approve')
  async approvePayRun(
    @Param('id') id: string,
    @Body() dto: ApprovePayRunDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.payrollService.approvePayRun(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('runs/:id/pay')
  @Permissions('pos:payroll:runs:pay')
  async payPayRun(
    @Param('id') id: string,
    @Body() dto: PayPayRunDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.payrollService.payPayRun(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('runs')
  @Permissions('pos:payroll:runs:read')
  async listPayRuns(@Query() query: ListPayRunsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.payrollService.listPayRuns(ctx, query);
  }

  @Get('runs/:id')
  @Permissions('pos:payroll:runs:read')
  async getPayRun(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.payrollService.getPayRun(ctx, id);
  }

  // ── Pay Slips ──

  @Get('slips')
  @Permissions('pos:payroll:slips:read')
  async listPaySlips(
    @Query('payRunId') payRunId: string,
    @Query('employeeId') employeeId: string,
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.payrollService.listPaySlips(ctx, {
      payRunId,
      employeeId,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('slips/:id')
  @Permissions('pos:payroll:slips:read')
  async getPaySlip(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.payrollService.getPaySlip(ctx, id);
  }
}
