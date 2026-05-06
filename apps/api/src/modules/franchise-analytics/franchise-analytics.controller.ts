import { Controller, Get, Post, Query, UseGuards, Req, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { CurrentUser, Permissions } from '../../common/decorators';
import { FranchiseAnalyticsService } from './franchise-analytics.service';
import {
  ConsolidatedFinanceQueryDto,
  ScorecardsQueryDto,
  WasteBenchmarkQueryDto,
  FinancialComparisonQueryDto,
  DeepRankingsQueryDto,
  DrilldownQueryDto,
} from './dto';

/**
 * M38.1 — Franchise Analytics & Consolidation controller.
 * Operates at org level — no X-Branch-Id required.
 * Org is resolved from the user's active membership.
 */
@Controller('franchise')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FranchiseAnalyticsController {
  constructor(private readonly analyticsService: FranchiseAnalyticsService) { }

  // ── Consolidated Finance ──

  @Get('consolidated-finance')
  @Permissions('franchise:analytics:read')
  async getConsolidatedFinance(
    @Query() query: ConsolidatedFinanceQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    const ctx = await this.analyticsService.resolveOrgContext(user.id);
    return this.analyticsService.getConsolidatedFinance(ctx.organizationId, query);
  }

  @Post('consolidated-finance/generate')
  @HttpCode(200)
  @Permissions('franchise:consolidation:generate')
  async generateConsolidatedSnapshot(
    @Query() query: ConsolidatedFinanceQueryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = await this.analyticsService.resolveOrgContext(user.id);
    return this.analyticsService.generateConsolidatedSnapshot(user.id, ctx.organizationId, query, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Financial Comparison ──

  @Get('financial-comparison')
  @Permissions('franchise:analytics:read')
  async getFinancialComparison(
    @Query() query: FinancialComparisonQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    const ctx = await this.analyticsService.resolveOrgContext(user.id);
    return this.analyticsService.getFinancialComparison(ctx.organizationId, query);
  }

  // ── Waste Benchmarks ──

  @Get('waste-benchmarks')
  @Permissions('franchise:waste-benchmark:read')
  async getWasteBenchmarks(
    @Query() query: WasteBenchmarkQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    const ctx = await this.analyticsService.resolveOrgContext(user.id);
    return this.analyticsService.getWasteBenchmarks(ctx.organizationId, query);
  }

  @Post('waste-benchmarks/generate')
  @HttpCode(200)
  @Permissions('franchise:waste-benchmark:read')
  async generateWasteBenchmarks(
    @Query() query: WasteBenchmarkQueryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = await this.analyticsService.resolveOrgContext(user.id);
    return this.analyticsService.generateWasteBenchmarks(user.id, ctx.organizationId, query, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Scorecards ──

  @Get('scorecards')
  @Permissions('franchise:scorecard:read')
  async getScorecards(@Query() query: ScorecardsQueryDto, @CurrentUser() user: { id: string }) {
    const ctx = await this.analyticsService.resolveOrgContext(user.id);
    return this.analyticsService.getScorecards(ctx.organizationId, query);
  }

  @Post('scorecards/generate')
  @HttpCode(200)
  @Permissions('franchise:scorecard:read')
  async generateScorecards(
    @Query() query: ScorecardsQueryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = await this.analyticsService.resolveOrgContext(user.id);
    return this.analyticsService.generateScorecards(user.id, ctx.organizationId, query, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Deep Rankings ──

  @Post('rankings/generate-deep')
  @HttpCode(200)
  @Permissions('franchise:ranking:generate-deep')
  async generateDeepRankings(
    @Query() query: DeepRankingsQueryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = await this.analyticsService.resolveOrgContext(user.id);
    return this.analyticsService.generateDeepRankings(user.id, ctx.organizationId, query, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Drilldown ──

  @Get('drilldown')
  @Permissions('franchise:analytics:read')
  async getDrilldown(@Query() query: DrilldownQueryDto, @CurrentUser() user: { id: string }) {
    const ctx = await this.analyticsService.resolveOrgContext(user.id);
    return this.analyticsService.getDrilldown(ctx.organizationId, query);
  }
}
