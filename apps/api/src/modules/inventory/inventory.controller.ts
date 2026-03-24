import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { InventoryService } from './inventory.service';
import { CreateStockBatchDto, CreateStockAdjustmentDto, ListInventoryLevelsQueryDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Stock Levels ──

  @Get('levels')
  @Permissions('pos:inventory:read')
  async getInventoryLevels(@Query() query: ListInventoryLevelsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.inventoryService.getInventoryLevels(ctx, query.category);
  }

  // ── Stock Adjustments ──

  @Post('adjustments')
  @Permissions('pos:inventory:adjust')
  async createStockAdjustment(
    @Body() dto: CreateStockAdjustmentDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.inventoryService.createStockAdjustment(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Stock Batches ──

  @Post('batches')
  @Permissions('pos:inventory:write')
  async createStockBatch(
    @Body() dto: CreateStockBatchDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.inventoryService.createStockBatch(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('batches')
  @Permissions('pos:inventory:read')
  async listStockBatches(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.inventoryService.listStockBatches(ctx);
  }

  @Get('items/:id/batches')
  @Permissions('pos:inventory:read')
  async listItemBatches(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.inventoryService.listStockBatches(ctx, id);
  }
}
