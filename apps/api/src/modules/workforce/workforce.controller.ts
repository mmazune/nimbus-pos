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
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { WorkforceService } from './workforce.service';
import {
  CreateShiftTemplateDto,
  ListShiftTemplatesQueryDto,
  CreateScheduleDto,
  PublishScheduleDto,
  ListSchedulesQueryDto,
  ListRosterQueryDto,
  CreateCoverageRuleDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('workforce')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class WorkforceController {
  constructor(private readonly workforceService: WorkforceService) {}

  // ── Shift Templates ──

  @Post('templates')
  @Permissions('pos:workforce:templates:create')
  async createShiftTemplate(
    @Body() dto: CreateShiftTemplateDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.workforceService.createShiftTemplate(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('templates')
  @Permissions('pos:workforce:templates:read')
  async listShiftTemplates(@Query() query: ListShiftTemplatesQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.workforceService.listShiftTemplates(ctx, query);
  }

  // ── Schedules ──

  @Post('schedules')
  @Permissions('pos:workforce:schedules:create')
  async createSchedule(
    @Body() dto: CreateScheduleDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.workforceService.createSchedule(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('schedules')
  @Permissions('pos:workforce:schedules:read')
  async listSchedules(@Query() query: ListSchedulesQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.workforceService.listSchedules(ctx, query);
  }

  @Get('schedules/:id')
  @Permissions('pos:workforce:schedules:read')
  async getSchedule(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.workforceService.getSchedule(ctx, id);
  }

  @Patch('schedules/:id/publish')
  @Permissions('pos:workforce:schedules:publish')
  async publishSchedule(
    @Param('id') id: string,
    @Body() dto: PublishScheduleDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.workforceService.publishSchedule(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('schedules/:id/archive')
  @Permissions('pos:workforce:schedules:publish')
  async archiveSchedule(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.workforceService.archiveSchedule(user.id, ctx, id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Roster ──

  @Get('roster')
  @Permissions('pos:workforce:schedules:read')
  async getRoster(@Query() query: ListRosterQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.workforceService.getRoster(ctx, query);
  }

  // ── Coverage Rules ──

  @Post('coverage-rules')
  @Permissions('pos:workforce:coverage-rules:create')
  async createCoverageRule(
    @Body() dto: CreateCoverageRuleDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.workforceService.createCoverageRule(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('coverage-rules')
  @Permissions('pos:workforce:coverage-rules:read')
  async listCoverageRules(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.workforceService.listCoverageRules(ctx);
  }

  @Get('coverage-gaps')
  @Permissions('pos:workforce:coverage-rules:read')
  async getCoverageGaps(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('dateFrom and dateTo query parameters are required');
    }
    return this.workforceService.getCoverageGaps(ctx, dateFrom, dateTo);
  }
}
