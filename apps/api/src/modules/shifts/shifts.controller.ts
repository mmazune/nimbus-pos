import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto, CloseShiftDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { Bg3ReliabilityService } from '../bg3-reliability';

@Controller('shifts')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService,
    private readonly bg3: Bg3ReliabilityService,
  ) { }

  @Post('open')
  @Permissions('pos:shift:open')
  async openShift(
    @Body() dto: OpenShiftDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bg3.guard(
      {
        req,
        scope: 'shifts.open',
        routeMethod: 'POST',
        routePath: '/api/shifts/open',
        category: null,
        idempotencyMode: 'optional',
        fingerprintSource: dto,
        actorUserId: user.id,
        orgId: ctx?.organizationId ?? null,
        branchId: ctx?.branchId ?? null,
      },
      () =>
        this.shiftsService.openShift(user.id, ctx, dto, {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }),
    );
  }

  @Post(':id/close')
  @Permissions('pos:shift:close')
  @HttpCode(HttpStatus.OK)
  async closeShift(
    @Param('id') id: string,
    @Body() dto: CloseShiftDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bg3.guard(
      {
        req,
        scope: 'shifts.close',
        routeMethod: 'POST',
        routePath: `/api/shifts/${id}/close`,
        category: null,
        idempotencyMode: 'optional',
        fingerprintSource: { id, dto },
        actorUserId: user.id,
        orgId: ctx?.organizationId ?? null,
        branchId: ctx?.branchId ?? null,
      },
      () =>
        this.shiftsService.closeShift(id, user.id, ctx, dto, {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }),
    );
  }

  @Get('active')
  @Permissions('pos:shift:read')
  async getActiveShift(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.shiftsService.getActiveShift(user.id, ctx);
  }

  @Get(':id')
  @Permissions('pos:shift:read')
  async getShiftById(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.shiftsService.getShiftById(id, ctx);
  }

  @Get(':id/summary')
  @Permissions('pos:shift:read')
  async getShiftSummary(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.shiftsService.getShiftSummary(id, ctx);
  }
}
