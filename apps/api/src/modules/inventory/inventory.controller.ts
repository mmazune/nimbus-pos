import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { InventoryService } from './inventory.service';
import { CreateStockBatchDto, CreateStockAdjustmentDto, ListInventoryLevelsQueryDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { Bg3ReliabilityService, BG3_CATEGORY } from '../bg3-reliability';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly bg3: Bg3ReliabilityService,
  ) { }

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
    const trainingHeader = req.headers['x-training-session-id'];
    const trainingSessionId = Array.isArray(trainingHeader)
      ? trainingHeader[0]
      : (trainingHeader as string | undefined);
    return this.bg3.guard(
      {
        req,
        scope: 'inventory.adjustments.create',
        routeMethod: 'POST',
        routePath: '/api/inventory/adjustments',
        // M42's service-level `assertWriteAllowed` already enforces the
        // INVENTORY_WRITES maintenance-window block (returns 409 with
        // code MAINTENANCE_WINDOW_ACTIVE) and is exercised by the
        // existing M42 collection. Keep `category: null` here so the
        // BG3 facade does not double-fire and shadow that 409 with 423.
        category: null,
        idempotencyMode: 'optional',
        fingerprintSource: dto,
        actorUserId: user.id,
        orgId: ctx?.organizationId ?? null,
        branchId: ctx?.branchId ?? null,
        // BG3: training simulator returns a non-persisted shape; the
        // pre-existing inventory training-mode handling inside the service
        // is still honoured if BG3 simulation is bypassed (no header).
        trainingSimulator: (): any => ({
          id: `sim-adj-${Date.now()}`,
          status: 'SIMULATED',
          requestedQuantity: (dto as any).quantity,
          reason: (dto as any).reason ?? null,
        }),
      },
      () =>
        this.inventoryService.createStockAdjustment(user.id, ctx, dto, {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          trainingSessionId: trainingSessionId ?? null,
        }),
    );
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
