import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { CreateStockBatchDto, CreateStockAdjustmentDto } from './dto';
import { ControlPlaneService } from '../controlplane/controlplane.service';

interface BranchContext {
  branchId: string;
  organizationId: string;
  roleId?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
  trainingSessionId?: string | null;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly controlPlane: ControlPlaneService,
  ) { }

  // ── Stock Batches ──

  async createStockBatch(
    userId: string,
    ctx: BranchContext,
    dto: CreateStockBatchDto,
    meta: RequestMeta,
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: dto.itemId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const receivedQty = new Decimal(dto.receivedQty);
    if (receivedQty.lte(0)) {
      throw new BadRequestException('receivedQty must be greater than 0');
    }

    const batch = await this.prisma.stockBatch.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        itemId: dto.itemId,
        batchNumber: dto.batchNumber ?? null,
        receivedQty: dto.receivedQty,
        remainingQty: dto.receivedQty,
        unitCost: dto.unitCost,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
        goodsReceiptId: dto.goodsReceiptId ?? null,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'STOCK_BATCH_CREATED',
      entityType: 'stockBatch',
      entityId: batch.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        itemId: dto.itemId,
        receivedQty: dto.receivedQty,
        unitCost: dto.unitCost,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return batch;
  }

  async listStockBatches(ctx: BranchContext, itemId?: string) {
    const where: Record<string, unknown> = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
    };
    if (itemId) where.itemId = itemId;

    return this.prisma.stockBatch.findMany({
      where,
      include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
      orderBy: { receivedAt: 'asc' },
    });
  }

  // ── Inventory Levels ──

  async getInventoryLevels(ctx: BranchContext, category?: string) {
    const itemWhere: Record<string, unknown> = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
      isActive: true,
    };
    if (category) itemWhere.category = category;

    const items = await this.prisma.inventoryItem.findMany({
      where: itemWhere,
      orderBy: { name: 'asc' },
    });

    // Aggregate remaining qty per item from stock batches
    const batchAggregates = await this.prisma.stockBatch.groupBy({
      by: ['itemId'],
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        remainingQty: { gt: 0 },
      },
      _sum: { remainingQty: true },
    });

    const batchMap = new Map<string, Decimal>();
    for (const agg of batchAggregates) {
      batchMap.set(agg.itemId, agg._sum.remainingQty ?? new Decimal(0));
    }

    return items.map((item) => {
      const onHandQty = batchMap.get(item.id) ?? new Decimal(0);
      const reorderLevel = new Decimal(item.reorderLevel.toString());
      return {
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        category: item.category,
        onHandQty: onHandQty.toFixed(3),
        reorderLevel: reorderLevel.toFixed(3),
        reorderQty: new Decimal(item.reorderQty.toString()).toFixed(3),
        belowReorder: onHandQty.lt(reorderLevel) && reorderLevel.gt(0),
      };
    });
  }

  // ── Stock Adjustments ──

  async createStockAdjustment(
    userId: string,
    ctx: BranchContext,
    dto: CreateStockAdjustmentDto,
    meta: RequestMeta,
  ) {
    // M42: refuse the write if an ACTIVE BLOCK_WRITES maintenance window
    // currently covers INVENTORY_WRITES. Audit-logged inside the facade.
    await this.controlPlane.assertWriteAllowed({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      actorUserId: userId,
      category: 'INVENTORY_WRITES',
      operation: 'inventory.createStockAdjustment',
    });

    // M42: short-circuit when the actor has an ACTIVE training session.
    // No real batch / adjustment / audit row is persisted in that case.
    const sim = await this.controlPlane.checkTrainingMode(
      ctx.organizationId,
      userId,
      meta.trainingSessionId ?? null,
      'inventory.createStockAdjustment',
    );
    if (sim) {
      return {
        ...sim,
        request: {
          itemId: dto.itemId,
          qtyDelta: dto.qtyDelta,
          reason: dto.reason ?? null,
          branchId: ctx.branchId,
        },
      };
    }

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: dto.itemId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const qtyDelta = new Decimal(dto.qtyDelta);
    if (qtyDelta.eq(0)) {
      throw new BadRequestException('qtyDelta must not be zero');
    }

    // Calculate current on-hand
    const batchAgg = await this.prisma.stockBatch.aggregate({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        itemId: dto.itemId,
        remainingQty: { gt: 0 },
      },
      _sum: { remainingQty: true },
    });
    const currentOnHand = batchAgg._sum.remainingQty ?? new Decimal(0);

    // Block negative stock
    if (qtyDelta.lt(0)) {
      const resultingQty = currentOnHand.add(qtyDelta);
      if (resultingQty.lt(0)) {
        await this.audit.log({
          actorUserId: userId,
          action: 'NEGATIVE_STOCK_ATTEMPT',
          entityType: 'inventoryItem',
          entityId: dto.itemId,
          metadata: {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            currentOnHand: currentOnHand.toFixed(3),
            attemptedDelta: dto.qtyDelta,
            resultingQty: resultingQty.toFixed(3),
          },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
        throw new BadRequestException(
          `Adjustment would result in negative stock. Current on-hand: ${currentOnHand.toFixed(3)}, requested delta: ${dto.qtyDelta}`,
        );
      }

      // FIFO deduction for negative adjustments
      await this.fifoDeduct(ctx, dto.itemId, qtyDelta.abs());
    } else {
      // Positive adjustment: create a new batch with zero cost (manual add)
      await this.prisma.stockBatch.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          itemId: dto.itemId,
          batchNumber: null,
          receivedQty: qtyDelta.toFixed(3),
          remainingQty: qtyDelta.toFixed(3),
          unitCost: '0.00',
          receivedAt: new Date(),
          metadata: { source: 'manual_adjustment', reason: dto.reason ?? null },
        },
      });
    }

    const adjustment = await this.prisma.stockAdjustment.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        itemId: dto.itemId,
        qtyDelta: dto.qtyDelta,
        reason: dto.reason ?? null,
        userId,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'STOCK_ADJUSTED',
      entityType: 'stockAdjustment',
      entityId: adjustment.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        itemId: dto.itemId,
        qtyDelta: dto.qtyDelta,
        reason: dto.reason ?? null,
        previousOnHand: currentOnHand.toFixed(3),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return adjustment;
  }

  // ── FIFO Deduction Foundation ──

  /**
   * Deducts a quantity from the oldest non-empty batches (FIFO order).
   * Batches are ordered by receivedAt ASC.
   * Used by stock adjustments and will be reused by order-close deduction in M10+.
   *
   * @param ctx - Branch context
   * @param itemId - The inventory item to deduct from
   * @param qty - Positive Decimal amount to deduct
   * @returns Array of { batchId, deducted } records for traceability
   */
  async fifoDeduct(
    ctx: BranchContext,
    itemId: string,
    qty: Decimal,
  ): Promise<{ batchId: string; deducted: string }[]> {
    const batches = await this.prisma.stockBatch.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        itemId,
        remainingQty: { gt: 0 },
      },
      orderBy: { receivedAt: 'asc' },
    });

    let remaining = new Decimal(qty.toFixed(3));
    const deductions: { batchId: string; deducted: string }[] = [];

    for (const batch of batches) {
      if (remaining.lte(0)) break;

      const batchRemaining = new Decimal(batch.remainingQty.toString());
      const deductAmount = Decimal.min(batchRemaining, remaining);

      await this.prisma.stockBatch.update({
        where: { id: batch.id },
        data: { remainingQty: batchRemaining.sub(deductAmount).toFixed(3) },
      });

      deductions.push({
        batchId: batch.id,
        deducted: deductAmount.toFixed(3),
      });

      remaining = remaining.sub(deductAmount);
    }

    return deductions;
  }

  /**
   * Gets the oldest non-empty batch for an item at a branch.
   * Returns null if no batches have remaining stock.
   */
  async getOldestNonEmptyBatch(ctx: BranchContext, itemId: string) {
    return this.prisma.stockBatch.findFirst({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        itemId,
        remainingQty: { gt: 0 },
      },
      orderBy: { receivedAt: 'asc' },
    });
  }
}
