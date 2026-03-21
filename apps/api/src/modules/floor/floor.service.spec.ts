import { Test, TestingModule } from '@nestjs/testing';
import { FloorService } from './floor.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TableStatus } from '@prisma/client';

describe('FloorService', () => {
  let service: FloorService;
  let prisma: Record<string, any>;
  let audit: { log: jest.Mock };

  const mockBranchCtx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
  };
  const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      floorPlan: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      table: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FloorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<FloorService>(FloorService);
  });

  // ── Floor Plans ──

  it('should create a floor plan', async () => {
    const dto = { name: 'Main Hall' };
    prisma.floorPlan.create.mockResolvedValue({
      id: 'fp-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      name: 'Main Hall',
      data: {},
      isActive: true,
    });

    const result = await service.createFloorPlan('user-1', mockBranchCtx, dto, mockMeta);

    expect(result.name).toBe('Main Hall');
    expect(prisma.floorPlan.create).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FLOOR_PLAN_CREATED' }),
    );
  });

  it('should list floor plans scoped to branch', async () => {
    prisma.floorPlan.findMany.mockResolvedValue([
      { id: 'fp-1', name: 'Main Hall', branchId: 'branch-1' },
      { id: 'fp-2', name: 'Patio', branchId: 'branch-1' },
    ]);

    const result = await service.listFloorPlans(mockBranchCtx);

    expect(result).toHaveLength(2);
    expect(prisma.floorPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 'branch-1', orgId: 'org-1' },
      }),
    );
  });

  it('should throw NotFoundException for non-existent floor plan', async () => {
    prisma.floorPlan.findFirst.mockResolvedValue(null);

    await expect(service.getFloorPlan('fp-nonexistent', mockBranchCtx)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── Tables ──

  it('should create a table', async () => {
    const dto = { label: 'T1', capacity: 4 };
    prisma.table.findUnique.mockResolvedValue(null);
    prisma.table.create.mockResolvedValue({
      id: 'tbl-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      label: 'T1',
      capacity: 4,
      status: 'AVAILABLE',
      isActive: true,
    });

    const result = await service.createTable('user-1', mockBranchCtx, dto, mockMeta);

    expect(result.label).toBe('T1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TABLE_CREATED' }));
  });

  it('should throw ConflictException for duplicate table label', async () => {
    prisma.table.findUnique.mockResolvedValue({ id: 'tbl-existing', label: 'T1' });

    await expect(
      service.createTable('user-1', mockBranchCtx, { label: 'T1' }, mockMeta),
    ).rejects.toThrow(ConflictException);
  });

  it('should update a table', async () => {
    prisma.table.findFirst.mockResolvedValue({
      id: 'tbl-1',
      label: 'T1',
      branchId: 'branch-1',
    });
    prisma.table.update.mockResolvedValue({
      id: 'tbl-1',
      label: 'T1',
      capacity: 6,
    });

    const result = await service.updateTable(
      'tbl-1',
      'user-1',
      mockBranchCtx,
      { capacity: 6 },
      mockMeta,
    );

    expect(result.capacity).toBe(6);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TABLE_UPDATED' }));
  });

  it('should update table status', async () => {
    prisma.table.findFirst.mockResolvedValue({
      id: 'tbl-1',
      status: TableStatus.AVAILABLE,
      branchId: 'branch-1',
    });
    prisma.table.update.mockResolvedValue({
      id: 'tbl-1',
      status: TableStatus.OCCUPIED,
    });

    const result = await service.updateTableStatus(
      'tbl-1',
      'user-1',
      mockBranchCtx,
      { status: TableStatus.OCCUPIED },
      mockMeta,
    );

    expect(result.status).toBe(TableStatus.OCCUPIED);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TABLE_STATUS_UPDATED',
        metadata: expect.objectContaining({
          previousStatus: TableStatus.AVAILABLE,
          newStatus: TableStatus.OCCUPIED,
        }),
      }),
    );
  });

  it('should throw NotFoundException when updating non-existent table', async () => {
    prisma.table.findFirst.mockResolvedValue(null);

    await expect(
      service.updateTable('tbl-none', 'user-1', mockBranchCtx, { capacity: 6 }, mockMeta),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Availability ──

  it('should return availability summary', async () => {
    prisma.table.findMany.mockResolvedValue([
      { id: '1', label: 'T1', capacity: 4, status: TableStatus.AVAILABLE, floorPlanId: null },
      { id: '2', label: 'T2', capacity: 4, status: TableStatus.OCCUPIED, floorPlanId: null },
      { id: '3', label: 'T3', capacity: 2, status: TableStatus.RESERVED, floorPlanId: null },
      { id: '4', label: 'T4', capacity: 4, status: TableStatus.CLEANING, floorPlanId: null },
    ]);

    const result = await service.getAvailability(mockBranchCtx);

    expect(result.summary.total).toBe(4);
    expect(result.summary.available).toBe(1);
    expect(result.summary.occupied).toBe(1);
    expect(result.summary.reserved).toBe(1);
    expect(result.summary.cleaning).toBe(1);
    expect(result.tables).toHaveLength(4);
  });
});
