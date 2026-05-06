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
import { TillsService } from './tills.service';
import { OpenTillDto, SafeDropDto, ReconcileTillDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { Bg3ReliabilityService } from '../bg3-reliability';

@Controller('tills')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class TillsController {
  constructor(
    private readonly tillsService: TillsService,
    private readonly bg3: Bg3ReliabilityService,
  ) { }

  @Post('open')
  @Permissions('pos:till:open')
  async openTill(
    @Body() dto: OpenTillDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bg3.guard(
      {
        req,
        scope: 'tills.open',
        routeMethod: 'POST',
        routePath: '/api/tills/open',
        category: null,
        idempotencyMode: 'optional',
        fingerprintSource: dto,
        actorUserId: user.id,
        orgId: ctx?.organizationId ?? null,
        branchId: ctx?.branchId ?? null,
      },
      () =>
        this.tillsService.openTill(user.id, ctx, dto, {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }),
    );
  }

  @Post(':id/safe-drop')
  @Permissions('pos:till:safe-drop')
  @HttpCode(HttpStatus.OK)
  async safeDrop(
    @Param('id') id: string,
    @Body() dto: SafeDropDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.tillsService.safeDrop(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/reconcile')
  @Permissions('pos:till:reconcile')
  @HttpCode(HttpStatus.OK)
  async reconcileTill(
    @Param('id') id: string,
    @Body() dto: ReconcileTillDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bg3.guard(
      {
        req,
        scope: 'tills.reconcile',
        routeMethod: 'POST',
        routePath: `/api/tills/${id}/reconcile`,
        category: null,
        idempotencyMode: 'optional',
        fingerprintSource: { id, dto },
        actorUserId: user.id,
        orgId: ctx?.organizationId ?? null,
        branchId: ctx?.branchId ?? null,
      },
      () =>
        this.tillsService.reconcileTill(id, user.id, ctx, dto, {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }),
    );
  }

  @Get('active')
  @Permissions('pos:till:read')
  async getActiveTill(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.tillsService.getActiveTill(user.id, ctx);
  }

  @Get(':id')
  @Permissions('pos:till:read')
  async getTillById(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.tillsService.getTillById(id, ctx);
  }

  @Get(':id/summary')
  @Permissions('pos:till:read')
  async getTillSummary(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.tillsService.getTillSummary(id, ctx);
  }
}
