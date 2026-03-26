import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let prisma: any;
  let audit: any;

  const ctx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
  };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      shift: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tillSession: {
        findMany: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
      },
      refund: {
        findMany: jest.fn(),
      },
      cashMovement: {
        findMany: jest.fn(),
      },
      order: {
        count: jest.fn(),
      },
      shiftCloseSummary: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ShiftsService>(ShiftsService);
  });

  // ── Open Shift ──

  it('should open a shift successfully', async () => {
    prisma.shift.findFirst.mockResolvedValueOnce(null); // no existing open shift
    prisma.shift.findFirst.mockResolvedValueOnce(null); // no last shift (for number gen)
    prisma.shift.create.mockResolvedValue({
      id: 'shift-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      shiftNumber: 'SHF-000001',
      openedById: 'user-1',
      status: 'OPEN',
    });

    const result = await service.openShift('user-1', ctx, {}, meta);

    expect(result.shiftNumber).toBe('SHF-000001');
    expect(result.status).toBe('OPEN');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SHIFT_OPENED' }));
  });

  it('should increment shift number from last shift', async () => {
    prisma.shift.findFirst.mockResolvedValueOnce(null); // no existing open shift
    prisma.shift.findFirst.mockResolvedValueOnce({ shiftNumber: 'SHF-000005' }); // last shift
    prisma.shift.create.mockResolvedValue({
      id: 'shift-2',
      shiftNumber: 'SHF-000006',
      status: 'OPEN',
    });

    await service.openShift('user-1', ctx, {}, meta);

    expect(prisma.shift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shiftNumber: 'SHF-000006' }),
      }),
    );
  });

  it('should block duplicate active shift for same user in same branch', async () => {
    prisma.shift.findFirst.mockResolvedValueOnce({
      id: 'existing-shift',
      status: 'OPEN',
      openedById: 'user-1',
      branchId: 'branch-1',
    });

    await expect(service.openShift('user-1', ctx, {}, meta)).rejects.toThrow(ConflictException);
  });

  // ── Close Shift ──

  it('should close shift successfully when no open tills', async () => {
    prisma.shift.findFirst.mockResolvedValue({
      id: 'shift-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      shiftNumber: 'SHF-000001',
      status: 'OPEN',
      openedAt: new Date('2026-03-26T08:00:00Z'),
      notes: null,
    });
    prisma.tillSession.findMany
      .mockResolvedValueOnce([]) // no open tills (close check)
      .mockResolvedValueOnce([]); // till sessions for summary
    prisma.shift.findUnique.mockResolvedValue({
      id: 'shift-1',
      openedAt: new Date('2026-03-26T08:00:00Z'),
    });
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.cashMovement.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);
    prisma.shiftCloseSummary.create.mockResolvedValue({
      id: 'summary-1',
      grossSales: new Decimal(0),
      expectedCash: new Decimal(0),
    });
    prisma.shift.update.mockResolvedValue({
      id: 'shift-1',
      status: 'CLOSED',
      closedById: 'user-1',
    });

    const result = await service.closeShift('shift-1', 'user-1', ctx, {}, meta);

    expect(result.status).toBe('CLOSED');
    expect(result.summary).toBeDefined();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SHIFT_CLOSED' }));
  });

  it('should block close when open tills exist', async () => {
    prisma.shift.findFirst.mockResolvedValue({
      id: 'shift-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      status: 'OPEN',
    });
    prisma.tillSession.findMany.mockResolvedValue([{ id: 'till-1', status: 'OPEN' }]);

    await expect(service.closeShift('shift-1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw NotFoundException for non-existent shift on close', async () => {
    prisma.shift.findFirst.mockResolvedValue(null);

    await expect(service.closeShift('nonexistent', 'user-1', ctx, {}, meta)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should block close on already-closed shift', async () => {
    prisma.shift.findFirst.mockResolvedValue({
      id: 'shift-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      status: 'CLOSED',
    });

    await expect(service.closeShift('shift-1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  // ── Get Active Shift ──

  it('should return active shift for user', async () => {
    prisma.shift.findFirst.mockResolvedValue({
      id: 'shift-1',
      status: 'OPEN',
      openedById: 'user-1',
    });

    const result = await service.getActiveShift('user-1', ctx);
    expect(result).toBeDefined();
    expect(result!.status).toBe('OPEN');
  });

  it('should return null when no active shift', async () => {
    prisma.shift.findFirst.mockResolvedValue(null);

    const result = await service.getActiveShift('user-1', ctx);
    expect(result).toBeNull();
  });

  // ── Get Shift By ID ──

  it('should return shift by ID', async () => {
    prisma.shift.findFirst.mockResolvedValue({
      id: 'shift-1',
      status: 'OPEN',
      branchId: 'branch-1',
    });

    const result = await service.getShiftById('shift-1', ctx);
    expect(result.id).toBe('shift-1');
  });

  it('should throw NotFoundException for non-existent shift by ID', async () => {
    prisma.shift.findFirst.mockResolvedValue(null);

    await expect(service.getShiftById('nonexistent', ctx)).rejects.toThrow(NotFoundException);
  });

  // ── Branch Isolation ──

  it('should enforce branch isolation when opening shift', async () => {
    const otherCtx = { branchId: 'branch-2', organizationId: 'org-1' };
    prisma.shift.findFirst.mockResolvedValueOnce(null);
    prisma.shift.findFirst.mockResolvedValueOnce(null);
    prisma.shift.create.mockResolvedValue({
      id: 'shift-3',
      branchId: 'branch-2',
      shiftNumber: 'SHF-000001',
      status: 'OPEN',
    });

    await service.openShift('user-1', otherCtx, {}, meta);
    expect(prisma.shift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ branchId: 'branch-2' }),
      }),
    );
  });

  // ── Summary Generation with Sales Data ──

  it('should generate close summary with payment data', async () => {
    prisma.shift.findFirst.mockResolvedValue({
      id: 'shift-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      shiftNumber: 'SHF-000001',
      status: 'OPEN',
      openedAt: new Date('2026-03-26T08:00:00Z'),
      notes: null,
    });
    prisma.tillSession.findMany
      .mockResolvedValueOnce([]) // no open tills
      .mockResolvedValueOnce([
        // till sessions for summary
        {
          id: 'till-1',
          openingFloat: new Decimal(100000),
          countedCash: new Decimal(200000),
        },
      ]);
    prisma.shift.findUnique.mockResolvedValue({
      id: 'shift-1',
      openedAt: new Date('2026-03-26T08:00:00Z'),
    });
    prisma.payment.findMany.mockResolvedValue([
      { amount: new Decimal(50000), method: 'CASH' },
      { amount: new Decimal(30000), method: 'MOMO' },
      { amount: new Decimal(20000), method: 'CARD' },
    ]);
    prisma.refund.findMany.mockResolvedValue([{ amount: new Decimal(5000) }]);
    prisma.cashMovement.findMany.mockResolvedValue([
      { type: 'SAFE_DROP', amount: new Decimal(20000) },
    ]);
    prisma.order.count.mockResolvedValue(3);
    prisma.shiftCloseSummary.create.mockImplementation(({ data }: { data: any }) =>
      Promise.resolve({
        id: 'summary-1',
        ...data,
      }),
    );
    prisma.shift.update.mockResolvedValue({
      id: 'shift-1',
      status: 'CLOSED',
    });

    await service.closeShift('shift-1', 'user-1', ctx, {}, meta);

    expect(prisma.shiftCloseSummary.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          grossSales: expect.any(Decimal),
          cashSales: expect.any(Decimal),
          momoSales: expect.any(Decimal),
          ordersClosedCount: 3,
          refundsCount: 1,
        }),
      }),
    );
  });
});
