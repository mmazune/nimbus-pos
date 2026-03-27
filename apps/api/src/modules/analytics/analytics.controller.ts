import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import {
  CreateAnomalyRuleDto,
  UpdateAnomalyRuleDto,
  AcknowledgeAnomalyDto,
  ResolveAnomalyDto,
  ListAnomaliesQueryDto,
  RiskDashboardQueryDto,
  UpdateThresholdDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ── Anomaly Rules ──

  @Post('anomaly-rules')
  @Permissions('pos:analytics:anomaly-rules:create')
  async createRule(
    @Body() dto: CreateAnomalyRuleDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.createRule(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('anomaly-rules')
  @Permissions('pos:analytics:anomalies:read')
  async listRules(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.listRules(ctx);
  }

  @Get('anomaly-rules/:id')
  @Permissions('pos:analytics:anomalies:read')
  async findRule(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.findRuleById(id, ctx);
  }

  @Patch('anomaly-rules/:id')
  @Permissions('pos:analytics:anomaly-rules:update')
  @HttpCode(HttpStatus.OK)
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateAnomalyRuleDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.updateRule(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Anomaly Events ──

  @Get('anomalies')
  @Permissions('pos:analytics:anomalies:read')
  async listAnomalies(@Query() query: ListAnomaliesQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.listAnomalies(ctx, query);
  }

  @Get('anomalies/:id')
  @Permissions('pos:analytics:anomalies:read')
  async findAnomaly(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.findAnomalyById(id, ctx);
  }

  @Patch('anomalies/:id/acknowledge')
  @Permissions('pos:analytics:anomalies:acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledgeAnomaly(
    @Param('id') id: string,
    @Body() dto: AcknowledgeAnomalyDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.acknowledgeAnomaly(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('anomalies/:id/resolve')
  @Permissions('pos:analytics:anomalies:acknowledge')
  @HttpCode(HttpStatus.OK)
  async resolveAnomaly(
    @Param('id') id: string,
    @Body() dto: ResolveAnomalyDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.resolveAnomaly(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Risk Dashboard ──

  @Get('risk-dashboard')
  @Permissions('pos:analytics:risk-dashboard:read')
  async getRiskDashboard(@Query() query: RiskDashboardQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.getRiskDashboard(ctx, query);
  }

  // ── Staff Risk ──

  @Get('staff-risk/:userId')
  @Permissions('pos:analytics:risk-dashboard:read')
  async getStaffRisk(@Param('userId') userId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.getStaffRisk(userId, ctx);
  }

  // ── Thresholds ──

  @Get('thresholds')
  @Permissions('pos:analytics:thresholds:read')
  async listThresholds(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.listThresholds(ctx);
  }

  @Patch('thresholds/:id')
  @Permissions('pos:analytics:thresholds:update')
  @HttpCode(HttpStatus.OK)
  async updateThreshold(
    @Param('id') id: string,
    @Body() dto: UpdateThresholdDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.updateThreshold(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Recalculate ──

  @Post('anomalies/recalculate')
  @Permissions('pos:analytics:anomalies:recalculate')
  @HttpCode(HttpStatus.OK)
  async recalculate(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.analyticsService.recalculateAnomalies(user.id, ctx, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
