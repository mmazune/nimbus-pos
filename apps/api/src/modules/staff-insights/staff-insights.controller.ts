import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { StaffInsightsService } from './staff-insights.service';
import {
  ListStaffInsightsQueryDto,
  CreateStaffAwardDto,
  GeneratePromotionSuggestionsDto,
  DecidePromotionSuggestionDto,
  UpdateStaffWeightsDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('staff')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class StaffInsightsController {
  constructor(private readonly staffInsightsService: StaffInsightsService) {}

  // ── Weights ──

  @Get('weights')
  @Permissions('pos:staff:weights:read')
  async getWeights(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.getWeights(ctx);
  }

  @Patch('weights')
  @Permissions('pos:staff:weights:update')
  async updateWeights(
    @Body() dto: UpdateStaffWeightsDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.updateWeights(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Staff Insights ──

  @Get('insights')
  @Permissions('pos:staff:insights:read')
  async listInsights(@Query() query: ListStaffInsightsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.listInsights(ctx, query);
  }

  @Get('insights/:employeeId')
  @Permissions('pos:staff:insights:read')
  async getInsight(@Param('employeeId') employeeId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.getInsightByEmployee(ctx, employeeId);
  }

  @Post('insights/generate')
  @Permissions('pos:staff:insights:read')
  async generateInsights(
    @Body() dto: GeneratePromotionSuggestionsDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.generateInsights(
      user.id,
      ctx,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
      dto.employeeIds,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  // ── Awards ──

  @Post('awards')
  @Permissions('pos:staff:awards:create')
  async createAward(
    @Body() dto: CreateStaffAwardDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.createAward(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('awards')
  @Permissions('pos:staff:awards:read')
  async listAwards(
    @Query('employeeId') employeeId: string,
    @Query('awardType') awardType: string,
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.listAwards(ctx, {
      employeeId,
      awardType,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  // ── Promotion Suggestions ──

  @Post('promotion-suggestions/generate')
  @Permissions('pos:staff:promotions:generate')
  async generatePromotionSuggestions(
    @Body() dto: GeneratePromotionSuggestionsDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.generatePromotionSuggestions(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('promotion-suggestions')
  @Permissions('pos:staff:promotions:generate')
  async listPromotionSuggestions(
    @Query('status') status: string,
    @Query('employeeId') employeeId: string,
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.listPromotionSuggestions(ctx, {
      status,
      employeeId,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Patch('promotion-suggestions/:id/decision')
  @Permissions('pos:staff:promotions:decide')
  async decidePromotionSuggestion(
    @Param('id') id: string,
    @Body() dto: DecidePromotionSuggestionDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.staffInsightsService.decidePromotionSuggestion(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
