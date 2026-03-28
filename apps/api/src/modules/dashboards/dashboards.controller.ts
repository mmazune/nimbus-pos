import { Controller, Get, Post, Req, Sse, UseGuards, Body, MessageEvent } from '@nestjs/common';
import { Request } from 'express';
import { Observable, interval, switchMap, startWith } from 'rxjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { BranchContextGuard } from '../../common/guards/branch-context.guard';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { DashboardsService } from './dashboards.service';
import { AuditService } from '../../common/audit';
import { RefreshKpiDto } from './dto';
import { KpiScopeType, KpiMetricWindow } from '@prisma/client';

@Controller('dash')
@UseGuards(JwtAuthGuard)
export class DashboardsController {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly audit: AuditService,
  ) {}

  // ── Owner Dashboard ──

  @Get('owner')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:dash:owner:read')
  @RequireBranchContext()
  async getOwnerDashboard(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.dashboards.getOwnerDashboard(ctx.organizationId, ctx.branchId);
  }

  // ── Manager Dashboard ──

  @Get('manager')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:dash:manager:read')
  @RequireBranchContext()
  async getManagerDashboard(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.dashboards.getManagerDashboard(ctx.organizationId, ctx.branchId);
  }

  // ── Today Summary ──

  @Get('today-summary')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:dash:today-summary:read')
  @RequireBranchContext()
  async getTodaySummary(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.dashboards.getTodaySummary(ctx.organizationId, ctx.branchId);
  }

  // ── Payment Mix ──

  @Get('payment-mix')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:dash:today-summary:read')
  @RequireBranchContext()
  async getPaymentMix(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.dashboards.getPaymentMix(ctx.organizationId, ctx.branchId);
  }

  // ── Open Orders ──

  @Get('open-orders')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:dash:today-summary:read')
  @RequireBranchContext()
  async getOpenOrders(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.dashboards.getOpenOrders(ctx.organizationId, ctx.branchId);
  }

  // ── Low Stock ──

  @Get('low-stock')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:dash:today-summary:read')
  @RequireBranchContext()
  async getLowStock(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.dashboards.getLowStock(ctx.organizationId, ctx.branchId);
  }

  // ── Snapshots ──

  @Get('snapshots')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:dash:owner:read')
  @RequireBranchContext()
  async listSnapshots(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.dashboards.listSnapshots(ctx.organizationId, ctx.branchId);
  }

  // ── KPI Refresh ──

  @Post('kpi/refresh')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:dash:kpi:refresh')
  @RequireBranchContext()
  async refreshKpi(@Req() req: Request, @CurrentUser() user: any, @Body() body: RefreshKpiDto) {
    const ctx = (req as any).branchContext;
    const scopeType = body.scopeType ?? KpiScopeType.BRANCH;
    const metricWindow = body.metricWindow ?? KpiMetricWindow.TODAY;

    return this.dashboards.refreshKpi(
      ctx.organizationId,
      ctx.branchId,
      scopeType,
      metricWindow,
      user.id,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }
}

// ── Stream Controller (separate prefix for /stream/metrics) ──

@Controller('stream')
@UseGuards(JwtAuthGuard)
export class StreamController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Sse('metrics')
  @UseGuards(BranchContextGuard)
  @RequireBranchContext()
  metricsStream(@Req() req: Request): Observable<MessageEvent> {
    const ctx = (req as any).branchContext;
    const orgId = ctx.organizationId;
    const branchId = ctx.branchId;

    // Emit current metrics every 15 seconds via polling-based SSE
    return interval(15000).pipe(
      startWith(0),
      switchMap(async () => {
        const data = await this.dashboards.getStreamMetrics(orgId, branchId);
        return { data } as MessageEvent;
      }),
    );
  }
}
