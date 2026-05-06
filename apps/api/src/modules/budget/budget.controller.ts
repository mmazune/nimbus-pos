import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { BudgetService } from './budget.service';
import { ForecastService } from './forecast.service';
import { DemandCalendarService } from './demand-calendar.service';
import {
  CreateBudgetDto,
  ListBudgetsQueryDto,
  UpdateActualsDto,
  ListForecastQueryDto,
  CreateDemandCalendarEntryDto,
  UpdateDemandCalendarEntryDto,
  ListDemandCalendarQueryDto,
  ReviewProcurementSuggestionDto,
} from './dto';

// ── Finance: Budget Endpoints  /finance/budgets/* ──
@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get('budgets')
  @Permissions('finance:budget:read')
  async listBudgets(@Query() query: ListBudgetsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.budgetService.listBudgets(ctx, query);
  }

  @Get('budgets/:id')
  @Permissions('finance:budget:read')
  async getBudget(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.budgetService.getBudget(ctx, id);
  }

  @Post('budgets')
  @Permissions('finance:budget:write')
  async createBudget(
    @Body() dto: CreateBudgetDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.budgetService.createBudget(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('budgets/:id/update-actuals')
  @HttpCode(200)
  @Permissions('finance:budget:update-actuals')
  async updateActuals(
    @Param('id') id: string,
    @Body() dto: UpdateActualsDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.budgetService.updateActuals(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('procurement-suggestions')
  @Permissions('procurement:advisory:read')
  async listProcurementSuggestions(
    @Query('urgency') urgency: string | undefined,
    @Query('status') status: string | undefined,
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.budgetService.listProcurementSuggestions(ctx, urgency, status);
  }

  @Patch('procurement-suggestions/:id/review')
  @HttpCode(200)
  @Permissions('procurement:advisory:read')
  async reviewProcurementSuggestion(
    @Param('id') id: string,
    @Body() dto: ReviewProcurementSuggestionDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.budgetService.reviewProcurementSuggestion(
      user.id,
      ctx,
      id,
      dto.status,
      dto.reviewNotes,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );
  }
}

// ── Finance: Demand Calendar Endpoints  /finance/demand-calendar/* ──
@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class DemandCalendarController {
  constructor(private readonly demandCalendarService: DemandCalendarService) {}

  @Get('demand-calendar')
  @Permissions('finance:demand-calendar:read')
  async list(@Query() query: ListDemandCalendarQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.demandCalendarService.list(ctx, query);
  }

  @Get('demand-calendar/:id')
  @Permissions('finance:demand-calendar:read')
  async getById(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.demandCalendarService.getById(ctx, id);
  }

  @Post('demand-calendar')
  @Permissions('finance:demand-calendar:write')
  async create(
    @Body() dto: CreateDemandCalendarEntryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.demandCalendarService.create(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('demand-calendar/:id')
  @Permissions('finance:demand-calendar:write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDemandCalendarEntryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.demandCalendarService.update(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete('demand-calendar/:id')
  @Permissions('finance:demand-calendar:write')
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string }, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.demandCalendarService.delete(user.id, ctx, id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}

// ── Franchise: Forecast Endpoint  /franchise/forecast ──
@Controller('franchise')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get('forecast')
  @Permissions('franchise:forecast:read')
  async getForecast(
    @Query() query: ListForecastQueryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.forecastService.getForecast(user.id, ctx, query, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
