import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: Record<string, any>;
  let audit: { log: jest.Mock };

  const mockBranchCtx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
    roleId: 'role-owner',
  };
  const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      inventoryItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      stockBatch: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      stockAdjustment: {
        create: jest.fn(),
      },
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  // ── Stock Batches ──

  describe('createStockBatch', () => {
    it('should create a stock batch and audit', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1', name: 'Chicken' });
      prisma.stockBatch.create.mockResolvedValue({
        id: 'batch-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        itemId: 'item-1',
        receivedQty: new Decimal('20.000'),
        remainingQty: new Decimal('20.000'),
        unitCost: new Decimal('4.000'),
      });

      const result = await service.createStockBatch(
        'user-1',
        mockBranchCtx,
        { itemId: 'item-1', receivedQty: '20.000', unitCost: '4.000' },
        mockMeta,
      );

      expect(result.id).toBe('batch-1');
      expect(prisma.stockBatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: 'item-1',
            receivedQty: '20.000',
            remainingQty: '20.000',
            unitCost: '4.000',
          }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_BATCH_CREATED' }),
      );
    });

    it('should reject if inventory item not found', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(
        service.createStockBatch(
          'user-1',
          mockBranchCtx,
          { itemId: 'nonexistent', receivedQty: '10.000', unitCost: '1.000' },
          mockMeta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject receivedQty <= 0', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });

      await expect(
        service.createStockBatch(
          'user-1',
          mockBranchCtx,
          { itemId: 'item-1', receivedQty: '0.000', unitCost: '1.000' },
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listStockBatches', () => {
    it('should return batches for branch', async () => {
      prisma.stockBatch.findMany.mockResolvedValue([
        { id: 'batch-1', itemId: 'item-1', remainingQty: new Decimal('10.000') },
      ]);

      const result = await service.listStockBatches(mockBranchCtx);
      expect(result).toHaveLength(1);
      expect(prisma.stockBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-1', orgId: 'org-1' }),
        }),
      );
    });

    it('should filter by itemId when provided', async () => {
      prisma.stockBatch.findMany.mockResolvedValue([]);

      await service.listStockBatches(mockBranchCtx, 'item-1');
      expect(prisma.stockBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ itemId: 'item-1' }),
        }),
      );
    });
  });

  // ── Inventory Levels ──

  describe('getInventoryLevels', () => {
    it('should aggregate on-hand quantities from batches', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Chicken',
          unit: 'pc',
          category: 'Meat',
          reorderLevel: new Decimal('30.000'),
          reorderQty: new Decimal('60.000'),
        },
        {
          id: 'item-2',
          name: 'Milk',
          unit: 'ml',
          category: 'Dairy',
          reorderLevel: new Decimal('5000.000'),
          reorderQty: new Decimal('10000.000'),
        },
      ]);
      prisma.stockBatch.groupBy.mockResolvedValue([
        { itemId: 'item-1', _sum: { remainingQty: new Decimal('45.000') } },
        { itemId: 'item-2', _sum: { remainingQty: new Decimal('3000.000') } },
      ]);

      const levels = await service.getInventoryLevels(mockBranchCtx);
      expect(levels).toHaveLength(2);

      const chicken = levels.find((l) => l.itemId === 'item-1');
      expect(chicken?.onHandQty).toBe('45.000');
      expect(chicken?.belowReorder).toBe(false); // 45 >= 30

      const milk = levels.find((l) => l.itemId === 'item-2');
      expect(milk?.onHandQty).toBe('3000.000');
      expect(milk?.belowReorder).toBe(true); // 3000 < 5000
    });

    it('should show belowReorder=false when reorderLevel is 0', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Test',
          unit: 'g',
          category: 'Other',
          reorderLevel: new Decimal('0.000'),
          reorderQty: new Decimal('0.000'),
        },
      ]);
      prisma.stockBatch.groupBy.mockResolvedValue([]);

      const levels = await service.getInventoryLevels(mockBranchCtx);
      expect(levels[0].belowReorder).toBe(false);
      expect(levels[0].onHandQty).toBe('0.000');
    });

    it('should filter by category', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.stockBatch.groupBy.mockResolvedValue([]);

      await service.getInventoryLevels(mockBranchCtx, 'Meat');
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'Meat' }),
        }),
      );
    });
  });

  // ── Stock Adjustments ──

  describe('createStockAdjustment', () => {
    it('should create positive adjustment with zero-cost batch', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1', name: 'Chicken' });
      prisma.stockBatch.aggregate.mockResolvedValue({
        _sum: { remainingQty: new Decimal('10.000') },
      });
      prisma.stockBatch.create.mockResolvedValue({ id: 'adj-batch-1' });
      prisma.stockAdjustment.create.mockResolvedValue({
        id: 'adj-1',
        itemId: 'item-1',
        qtyDelta: new Decimal('5.000'),
        reason: 'Found in storeroom',
      });

      const result = await service.createStockAdjustment(
        'user-1',
        mockBranchCtx,
        { itemId: 'item-1', qtyDelta: '5.000', reason: 'Found in storeroom' },
        mockMeta,
      );

      expect(result.id).toBe('adj-1');
      expect(prisma.stockBatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receivedQty: '5.000',
            remainingQty: '5.000',
            unitCost: '0.00',
          }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'STOCK_ADJUSTED' }));
    });

    it('should block negative stock and audit the attempt', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1', name: 'Chicken' });
      prisma.stockBatch.aggregate.mockResolvedValue({
        _sum: { remainingQty: new Decimal('5.000') },
      });

      await expect(
        service.createStockAdjustment(
          'user-1',
          mockBranchCtx,
          { itemId: 'item-1', qtyDelta: '-10.000' },
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'NEGATIVE_STOCK_ATTEMPT' }),
      );
    });

    it('should reject zero delta', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });

      await expect(
        service.createStockAdjustment(
          'user-1',
          mockBranchCtx,
          { itemId: 'item-1', qtyDelta: '0.000' },
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if item not found', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(
        service.createStockAdjustment(
          'user-1',
          mockBranchCtx,
          { itemId: 'nonexistent', qtyDelta: '5.000' },
          mockMeta,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── FIFO Deduction ──

  describe('fifoDeduct', () => {
    it('should deduct from oldest batch first (FIFO)', async () => {
      prisma.stockBatch.findMany.mockResolvedValue([
        {
          id: 'batch-old',
          remainingQty: new Decimal('10.000'),
          receivedAt: new Date('2025-03-01'),
        },
        {
          id: 'batch-new',
          remainingQty: new Decimal('20.000'),
          receivedAt: new Date('2025-03-05'),
        },
      ]);
      prisma.stockBatch.update.mockResolvedValue({});

      const deductions = await service.fifoDeduct(mockBranchCtx, 'item-1', new Decimal('15.000'));

      expect(deductions).toHaveLength(2);
      expect(deductions[0]).toEqual({ batchId: 'batch-old', deducted: '10.000' });
      expect(deductions[1]).toEqual({ batchId: 'batch-new', deducted: '5.000' });

      // Verify batch-old fully consumed
      expect(prisma.stockBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-old' },
        data: { remainingQty: '0.000' },
      });
      // Verify batch-new partially consumed
      expect(prisma.stockBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-new' },
        data: { remainingQty: '15.000' },
      });
    });

    it('should consume a single batch when quantity fits', async () => {
      prisma.stockBatch.findMany.mockResolvedValue([
        { id: 'batch-1', remainingQty: new Decimal('50.000'), receivedAt: new Date('2025-03-01') },
      ]);
      prisma.stockBatch.update.mockResolvedValue({});

      const deductions = await service.fifoDeduct(mockBranchCtx, 'item-1', new Decimal('10.000'));

      expect(deductions).toHaveLength(1);
      expect(deductions[0]).toEqual({ batchId: 'batch-1', deducted: '10.000' });
      expect(prisma.stockBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { remainingQty: '40.000' },
      });
    });

    it('should return empty array when no batches exist', async () => {
      prisma.stockBatch.findMany.mockResolvedValue([]);

      const deductions = await service.fifoDeduct(mockBranchCtx, 'item-1', new Decimal('5.000'));
      expect(deductions).toEqual([]);
    });
  });

  // ── Oldest Non-Empty Batch ──

  describe('getOldestNonEmptyBatch', () => {
    it('should return the oldest batch with remaining stock', async () => {
      const batch = { id: 'batch-old', remainingQty: new Decimal('5.000') };
      prisma.stockBatch.findFirst.mockResolvedValue(batch);

      const result = await service.getOldestNonEmptyBatch(mockBranchCtx, 'item-1');
      expect(result).toEqual(batch);
      expect(prisma.stockBatch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: 'branch-1',
            itemId: 'item-1',
            remainingQty: { gt: 0 },
          }),
          orderBy: { receivedAt: 'asc' },
        }),
      );
    });

    it('should return null when no batches have stock', async () => {
      prisma.stockBatch.findFirst.mockResolvedValue(null);

      const result = await service.getOldestNonEmptyBatch(mockBranchCtx, 'item-1');
      expect(result).toBeNull();
    });
  });
});
