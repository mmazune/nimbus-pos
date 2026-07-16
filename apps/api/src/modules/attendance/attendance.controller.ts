import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { AttendanceService } from './attendance.service';
import {
  ClockAttendanceDto,
  ListAttendanceQueryDto,
  CreateLeaveRequestDto,
  ReviewLeaveRequestDto,
  ListLeaveQueryDto,
  CreateShiftSwapDto,
  ApproveShiftSwapDto,
  ListShiftSwapsQueryDto,
  CreateAttendancePolicyDto,
  UpdateAttendancePolicyDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) { }

  // ── Attendance Clock ──

  @Post('attendance/clock')
  @Permissions('pos:hr:attendance:clock')
  async clockInOut(
    @Body() dto: ClockAttendanceDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.clockInOut(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('attendance')
  @Permissions('pos:hr:attendance:read')
  async listAttendance(
    @Query() query: ListAttendanceQueryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.listAttendance(ctx, query, user.id);
  }

  // ── Leave Requests ──

  @Post('leave')
  @Permissions('pos:hr:leave:create')
  async createLeaveRequest(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.createLeaveRequest(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('leave')
  @Permissions('pos:hr:leave:read')
  async listLeaveRequests(
    @Query() query: ListLeaveQueryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.listLeaveRequests(ctx, query, user.id);
  }

  @Patch('leave/:id/review')
  @Permissions('pos:hr:leave:review')
  async reviewLeaveRequest(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.reviewLeaveRequest(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Shift Swaps ──

  @Post('shift-swaps')
  @Permissions('pos:hr:shift-swaps:create')
  async createShiftSwap(
    @Body() dto: CreateShiftSwapDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.createShiftSwap(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('shift-swaps')
  @Permissions('pos:hr:shift-swaps:read')
  async listShiftSwaps(
    @Query() query: ListShiftSwapsQueryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.listShiftSwaps(ctx, query, user.id);
  }

  @Patch('shift-swaps/:id/approve')
  @Permissions('pos:hr:shift-swaps:approve')
  async approveShiftSwap(
    @Param('id') id: string,
    @Body() dto: ApproveShiftSwapDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.approveShiftSwap(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Attendance Policies ──

  @Get('attendance/policies')
  @Permissions('pos:hr:attendance-policy:read')
  async listPolicies(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.listAttendancePolicies(ctx);
  }

  @Post('attendance/policies')
  @Permissions('pos:hr:attendance-policy:create')
  async createPolicy(
    @Body() dto: CreateAttendancePolicyDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.createAttendancePolicy(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('attendance/policies/:id')
  @Permissions('pos:hr:attendance-policy:update')
  async updatePolicy(
    @Param('id') id: string,
    @Body() dto: UpdateAttendancePolicyDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.attendanceService.updateAttendancePolicy(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
