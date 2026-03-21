import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { FloorService } from './floor.service';
import {
  CreateFloorPlanDto,
  UpdateFloorPlanDto,
  CreateTableDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class FloorController {
  constructor(private readonly floorService: FloorService) {}

  // ── Floor Plans ──

  @Post('floor-plans')
  @Permissions('pos:floor:write')
  async createFloorPlan(
    @Body() dto: CreateFloorPlanDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.floorService.createFloorPlan(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('floor-plans')
  @Permissions('pos:floor:read')
  async listFloorPlans(@Req() req: Request) {
    return this.floorService.listFloorPlans((req as any).branchContext);
  }

  @Get('floor-plans/:id')
  @Permissions('pos:floor:read')
  async getFloorPlan(@Param('id') id: string, @Req() req: Request) {
    return this.floorService.getFloorPlan(id, (req as any).branchContext);
  }

  @Patch('floor-plans/:id')
  @Permissions('pos:floor:write')
  async updateFloorPlan(
    @Param('id') id: string,
    @Body() dto: UpdateFloorPlanDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.floorService.updateFloorPlan(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Tables ──

  @Post('tables')
  @Permissions('pos:table:write')
  async createTable(
    @Body() dto: CreateTableDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.floorService.createTable(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('tables')
  @Permissions('pos:table:read')
  async listTables(@Req() req: Request) {
    return this.floorService.listTables((req as any).branchContext);
  }

  @Get('tables/:id')
  @Permissions('pos:table:read')
  async getTable(@Param('id') id: string, @Req() req: Request) {
    return this.floorService.getTable(id, (req as any).branchContext);
  }

  @Patch('tables/:id')
  @Permissions('pos:table:write')
  async updateTable(
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.floorService.updateTable(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('tables/:id/status')
  @Permissions('pos:table:write')
  async updateTableStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.floorService.updateTableStatus(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Availability ──

  @Get('floor/availability')
  @Permissions('pos:floor:read')
  async getAvailability(@Req() req: Request) {
    return this.floorService.getAvailability((req as any).branchContext);
  }
}
