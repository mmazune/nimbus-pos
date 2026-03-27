import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 1234 }),
}));

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;
  let audit: any;

  const orgId = 'org-1';
  const branchId = 'branch-1';
  const userId = 'user-1';

  beforeEach(async () => {
    prisma = {
      reportRun: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      exportArtifact: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      order: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      orderItem: {
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      payment: {
        groupBy: jest.fn(),
      },
      refund: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      shift: {
        findMany: jest.fn(),
      },
      stockAdjustment: {
        findMany: jest.fn(),
      },
      anomalyEvent: {
        findMany: jest.fn(),
      },
      menuItem: {
        findMany: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
      },
      discount: {
        findMany: jest.fn(),
      },
      tillSession: {
        findMany: jest.fn(),
      },
      cashMovement: {
        findMany: jest.fn(),
      },
      inventoryItem: {
        findMany: jest.fn(),
      },
      reservation: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      reservationDeposit: {
        findMany: jest.fn(),
      },
      event: {
        findMany: jest.fn(),
      },
      eventBooking: {
        findMany: jest.fn(),
      },
      eventCheckIn: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  /** Fake report run returned from create */
  function fakeRun(overrides: any = {}) {
    return {
      id: 'run-1',
      orgId,
      branchId,
      reportType: 'SHIFT_END',
      reportWindow: 'DAY',
      requestedById: userId,
      status: 'PENDING',
      ...overrides,
    };
  }

  // ── resolveRange (tested through generators) ──

  it('should throw if CUSTOM window with missing dates', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun());
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'FAILED' }));

    await expect(
      service.generateShiftEndReport(orgId, branchId, userId, 'CUSTOM' as any),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Shift-End Report ──

  it('should generate shift-end report', async () => {
    const completedRun = fakeRun({ status: 'COMPLETED', summary: {} });
    prisma.reportRun.create.mockResolvedValue(fakeRun());
    prisma.reportRun.update.mockResolvedValue(completedRun);

    prisma.shift.findMany.mockResolvedValue([
      {
        id: 's1',
        tillSessions: [
          {
            id: 't1',
            cashMovements: [{ type: 'SAFE_DROP', amount: new Decimal(50000) }],
          },
        ],
      },
    ]);

    prisma.order.aggregate.mockResolvedValue({
      _sum: {
        subtotal: new Decimal(500000),
        total: new Decimal(480000),
        tax: new Decimal(20000),
        discount: new Decimal(10000),
      },
      _count: 20,
    });

    prisma.payment.groupBy.mockResolvedValue([
      { method: 'CASH', _sum: { amount: new Decimal(300000) } },
    ]);

    prisma.refund.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal(15000) },
      _count: 2,
    });

    const result = await service.generateShiftEndReport(orgId, branchId, userId, 'DAY' as any);

    expect(result.status).toBe('COMPLETED');
    expect(prisma.reportRun.create).toHaveBeenCalledTimes(1);
    expect(prisma.reportRun.update).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REPORT_RUN_COMPLETED',
        entityType: 'ReportRun',
      }),
    );
  });

  // ── Daily Sales Report ──

  it('should generate daily sales report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'DAILY_SALES' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));

    prisma.order.aggregate.mockResolvedValue({
      _sum: {
        subtotal: new Decimal(500000),
        total: new Decimal(480000),
        tax: new Decimal(20000),
        discount: new Decimal(10000),
      },
      _count: 20,
      _avg: { total: new Decimal(24000) },
    });

    prisma.payment.groupBy.mockResolvedValue([]);
    prisma.refund.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal(0) },
      _count: 0,
    });

    const result = await service.generateDailySalesReport(orgId, branchId, userId, 'DAY' as any);

    expect(result.status).toBe('COMPLETED');
    expect(prisma.reportRun.create).toHaveBeenCalledTimes(1);
  });

  // ── Payment Mix Report ──

  it('should generate payment mix report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'PAYMENT_MIX' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));

    prisma.payment.groupBy.mockResolvedValue([
      { method: 'CASH', _sum: { amount: new Decimal(300000) }, _count: 10 },
      { method: 'CARD', _sum: { amount: new Decimal(200000) }, _count: 5 },
    ]);

    const result = await service.generatePaymentMixReport(orgId, branchId, userId, 'DAY' as any);

    expect(result.status).toBe('COMPLETED');
  });

  // ── Top Items Report ──

  it('should generate top items report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'TOP_ITEMS' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));

    prisma.orderItem.groupBy.mockResolvedValue([
      { menuItemId: 'mi-1', _sum: { quantity: 50, subtotal: new Decimal(500000) } },
    ]);

    prisma.menuItem.findMany.mockResolvedValue([{ id: 'mi-1', name: 'Burger' }]);

    const result = await service.generateTopItemsReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
      undefined,
      undefined,
      10,
    );

    expect(result.status).toBe('COMPLETED');
  });

  // ── Stock Variance Report ──

  it('should generate stock variance report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'STOCK_VARIANCE' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));

    prisma.stockAdjustment.findMany.mockResolvedValue([
      {
        itemId: 'item-1',
        qtyDelta: new Decimal(10),
        inventoryItem: { id: 'item-1', name: 'Flour', unit: 'kg' },
      },
      {
        itemId: 'item-1',
        qtyDelta: new Decimal(-3),
        inventoryItem: { id: 'item-1', name: 'Flour', unit: 'kg' },
      },
    ]);

    const result = await service.generateStockVarianceReport(orgId, branchId, userId, 'DAY' as any);

    expect(result.status).toBe('COMPLETED');
  });

  // ── Anomaly Summary Report ──

  it('should generate anomaly summary report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'ANOMALY_SUMMARY' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));

    prisma.anomalyEvent.findMany.mockResolvedValue([
      { type: 'VOID_SPIKE', severity: 'MEDIUM', status: 'OPEN' },
      { type: 'DISCOUNT_ABUSE', severity: 'HIGH', status: 'OPEN' },
    ]);

    const result = await service.generateAnomalySummaryReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );

    expect(result.status).toBe('COMPLETED');
  });

  // ── List Reports ──

  it('should list reports with pagination', async () => {
    prisma.reportRun.findMany.mockResolvedValue([fakeRun()]);
    prisma.reportRun.count.mockResolvedValue(1);

    const result = await service.listReports(orgId, branchId, { page: 1, pageSize: 10 });

    expect(result.data.length).toBe(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  // ── Get Report By ID ──

  it('should get report by id', async () => {
    prisma.reportRun.findFirst.mockResolvedValue(fakeRun());

    const result = await service.getReportById(orgId, 'run-1');
    expect(result.id).toBe('run-1');
  });

  it('should throw NotFoundException for missing report', async () => {
    prisma.reportRun.findFirst.mockResolvedValue(null);

    await expect(service.getReportById(orgId, 'missing')).rejects.toThrow(NotFoundException);
  });

  // ── Export Artifact ──

  it('should create export artifact for completed report', async () => {
    prisma.reportRun.findFirst.mockResolvedValue(
      fakeRun({ status: 'COMPLETED', summary: { shiftCount: 1 }, reportType: 'SHIFT_END' }),
    );
    prisma.exportArtifact.create.mockResolvedValue({
      id: 'art-1',
      status: 'PENDING',
      storagePath: '/tmp/test.csv',
      fileName: 'test.csv',
      mimeType: 'text/csv',
    });
    prisma.exportArtifact.update.mockResolvedValue({
      id: 'art-1',
      status: 'READY',
    });

    const result = await service.createExport(orgId, branchId, userId, 'run-1', 'CSV' as any);

    expect(result.status).toBe('READY');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should reject export for non-completed report', async () => {
    prisma.reportRun.findFirst.mockResolvedValue(fakeRun({ status: 'PENDING' }));

    await expect(
      service.createExport(orgId, branchId, userId, 'run-1', 'CSV' as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject export if report not found', async () => {
    prisma.reportRun.findFirst.mockResolvedValue(null);

    await expect(
      service.createExport(orgId, branchId, userId, 'missing', 'CSV' as any),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Get Export Artifact ──

  it('should get export artifact by id', async () => {
    prisma.exportArtifact.findFirst.mockResolvedValue({
      id: 'art-1',
      orgId,
      status: 'READY',
    });

    const result = await service.getExportArtifact(orgId, 'art-1');
    expect(result.id).toBe('art-1');
  });

  it('should throw NotFoundException for missing artifact', async () => {
    prisma.exportArtifact.findFirst.mockResolvedValue(null);

    await expect(service.getExportArtifact(orgId, 'missing')).rejects.toThrow(NotFoundException);
  });

  // ── Download ──

  it('should return file path for ready artifact', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    prisma.exportArtifact.findFirst.mockResolvedValue({
      id: 'art-1',
      orgId,
      status: 'READY',
      storagePath: '/tmp/test.csv',
      fileName: 'test.csv',
      mimeType: 'text/csv',
    });

    const result = await service.getExportFilePath(orgId, 'art-1');
    expect(result.fileName).toBe('test.csv');
    expect(result.mimeType).toBe('text/csv');
  });

  it('should reject download for non-ready artifact', async () => {
    prisma.exportArtifact.findFirst.mockResolvedValue({
      id: 'art-1',
      orgId,
      status: 'PENDING',
    });

    await expect(service.getExportFilePath(orgId, 'art-1')).rejects.toThrow(BadRequestException);
  });

  // ── Branch Isolation ──

  it('should scope shift-end report to branch', async () => {
    const completedRun = fakeRun({ status: 'COMPLETED' });
    prisma.reportRun.create.mockResolvedValue(fakeRun());
    prisma.reportRun.update.mockResolvedValue(completedRun);
    prisma.shift.findMany.mockResolvedValue([]);
    prisma.order.aggregate.mockResolvedValue({
      _sum: {
        subtotal: new Decimal(0),
        total: new Decimal(0),
        tax: new Decimal(0),
        discount: new Decimal(0),
      },
      _count: 0,
    });
    prisma.payment.groupBy.mockResolvedValue([]);
    prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: new Decimal(0) }, _count: 0 });

    await service.generateShiftEndReport(orgId, branchId, userId, 'DAY' as any);

    // Verify branch filter on underlying queries
    expect(prisma.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId }),
      }),
    );
    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId }),
      }),
    );
  });

  // ── Audit Logging ──

  it('should audit both completion and failure events', async () => {
    // Test failure auditing
    prisma.reportRun.create.mockResolvedValue(fakeRun());
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'FAILED' }));
    prisma.shift.findMany.mockRejectedValue(new Error('DB timeout'));

    await expect(
      service.generateShiftEndReport(orgId, branchId, userId, 'DAY' as any),
    ).rejects.toThrow('DB timeout');

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REPORT_RUN_FAILED',
      }),
    );
  });

  // ── Custom Date Range ──

  it('should accept custom date range', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun());
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.shift.findMany.mockResolvedValue([]);
    prisma.order.aggregate.mockResolvedValue({
      _sum: {
        subtotal: new Decimal(0),
        total: new Decimal(0),
        tax: new Decimal(0),
        discount: new Decimal(0),
      },
      _count: 0,
    });
    prisma.payment.groupBy.mockResolvedValue([]);
    prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: new Decimal(0) }, _count: 0 });

    const result = await service.generateShiftEndReport(
      orgId,
      branchId,
      userId,
      'CUSTOM' as any,
      '2024-01-01',
      '2024-01-31',
    );

    expect(result.status).toBe('COMPLETED');
    expect(prisma.reportRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportWindow: 'CUSTOM',
          dateFrom: new Date('2024-01-01'),
          dateTo: new Date('2024-01-31'),
        }),
      }),
    );
  });

  // ═══════════════════════════════════════════
  //  M20.1 — NEW REPORT GENERATOR TESTS
  // ═══════════════════════════════════════════

  // ── Sales By Category ──

  it('should generate sales-by-category report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'SALES_BY_CATEGORY' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.orderItem.findMany.mockResolvedValue([
      {
        menuItem: { id: 'mi-1', name: 'Burger', categoryId: 'cat-1' },
        quantity: 5,
        subtotal: new Decimal(50000),
      },
      {
        menuItem: { id: 'mi-2', name: 'Fries', categoryId: 'cat-1' },
        quantity: 3,
        subtotal: new Decimal(15000),
      },
    ]);
    prisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Food' }]);

    const result = await service.generateSalesByCategoryReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );
    expect(result.status).toBe('COMPLETED');
  });

  // ── Sales By Hour ──

  it('should generate sales-by-hour report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'SALES_BY_HOUR' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.order.findMany.mockResolvedValue([
      { total: new Decimal(10000), createdAt: new Date('2024-01-15T09:30:00Z') },
      { total: new Decimal(20000), createdAt: new Date('2024-01-15T12:00:00Z') },
    ]);

    const result = await service.generateSalesByHourReport(orgId, branchId, userId, 'DAY' as any);
    expect(result.status).toBe('COMPLETED');
  });

  // ── Open/Closed Orders ──

  it('should generate open-closed-orders report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'OPEN_CLOSED_ORDERS' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.order.groupBy.mockResolvedValue([
      { status: 'OPEN', _count: 5, _sum: { total: new Decimal(100000) } },
      { status: 'CLOSED', _count: 20, _sum: { total: new Decimal(500000) } },
    ]);

    const result = await service.generateOpenClosedOrdersReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );
    expect(result.status).toBe('COMPLETED');
  });

  // ── Discounts Summary ──

  it('should generate discounts-summary report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'DISCOUNTS_SUMMARY' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.discount.findMany.mockResolvedValue([
      {
        status: 'APPROVED',
        type: 'PERCENTAGE',
        value: new Decimal(1000),
        createdById: 'u1',
        createdBy: { id: 'u1', email: 'staff@test.co' },
      },
    ]);

    const result = await service.generateDiscountsSummaryReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );
    expect(result.status).toBe('COMPLETED');
  });

  // ── Voids Summary ──

  it('should generate voids-summary report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'VOIDS_SUMMARY' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.order.findMany.mockResolvedValue([
      { userId: 'u1', total: new Decimal(15000), user: { id: 'u1', email: 'staff@test.co' } },
    ]);

    const result = await service.generateVoidsSummaryReport(orgId, branchId, userId, 'DAY' as any);
    expect(result.status).toBe('COMPLETED');
  });

  // ── Refunds Summary ──

  it('should generate refunds-summary report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'REFUNDS_SUMMARY' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.refund.findMany.mockResolvedValue([
      {
        status: 'COMPLETED',
        amount: new Decimal(5000),
        createdById: 'u1',
        createdBy: { id: 'u1', email: 'staff@test.co' },
      },
    ]);

    const result = await service.generateRefundsSummaryReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );
    expect(result.status).toBe('COMPLETED');
  });

  // ── Cash Variance ──

  it('should generate cash-variance report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'CASH_VARIANCE' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.tillSession.findMany.mockResolvedValue([
      {
        id: 't1',
        tillCode: 'TILL-01',
        openingFloat: new Decimal(50000),
        expectedCash: new Decimal(200000),
        countedCash: new Decimal(198000),
        variance: new Decimal(-2000),
        varianceStatus: 'SHORT',
        operatorUser: { id: 'u1', email: 'op@test.co' },
      },
    ]);

    const result = await service.generateCashVarianceReport(orgId, branchId, userId, 'DAY' as any);
    expect(result.status).toBe('COMPLETED');
  });

  // ── Cash Movements ──

  it('should generate cash-movements report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'CASH_MOVEMENTS' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.cashMovement.findMany.mockResolvedValue([
      {
        type: 'SAFE_DROP',
        amount: new Decimal(50000),
        createdBy: { id: 'u1', email: 'staff@test.co' },
      },
      {
        type: 'PAID_IN',
        amount: new Decimal(10000),
        createdBy: { id: 'u1', email: 'staff@test.co' },
      },
    ]);

    const result = await service.generateCashMovementsReport(orgId, branchId, userId, 'DAY' as any);
    expect(result.status).toBe('COMPLETED');
  });

  // ── Wastage/Shrinkage ──

  it('should generate wastage report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'WASTAGE_SUMMARY' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.stockAdjustment.findMany.mockResolvedValue([
      {
        itemId: 'item-1',
        qtyDelta: new Decimal(-5),
        inventoryItem: {
          id: 'item-1',
          name: 'Flour',
          unit: 'kg',
          theoreticalUnitCost: new Decimal(2000),
        },
      },
    ]);

    const result = await service.generateWastageReport(orgId, branchId, userId, 'DAY' as any);
    expect(result.status).toBe('COMPLETED');
  });

  // ── Low Stock ──

  it('should generate low-stock report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'LOW_STOCK' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        name: 'Flour',
        unit: 'kg',
        reorderLevel: new Decimal(10),
        reorderQty: new Decimal(50),
        stockBatches: [{ remainingQty: new Decimal(3) }],
      },
      {
        id: 'item-2',
        name: 'Sugar',
        unit: 'kg',
        reorderLevel: new Decimal(5),
        reorderQty: new Decimal(20),
        stockBatches: [{ remainingQty: new Decimal(20) }],
      },
    ]);

    const result = await service.generateLowStockReport(orgId, branchId, userId, 'DAY' as any);
    expect(result.status).toBe('COMPLETED');
  });

  // ── Reservation Summary ──

  it('should generate reservation-summary report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'RESERVATION_SUMMARY' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.reservation.findMany.mockResolvedValue([
      { status: 'CONFIRMED', partySize: 4, seatedAt: new Date() },
      { status: 'NO_SHOW', partySize: 2, seatedAt: null },
    ]);

    const result = await service.generateReservationSummaryReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );
    expect(result.status).toBe('COMPLETED');
  });

  // ── Reservation Deposits ──

  it('should generate reservation-deposits report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'RESERVATION_DEPOSITS' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.reservationDeposit.findMany.mockResolvedValue([
      { status: 'RECEIVED', amount: new Decimal(20000) },
      { status: 'APPLIED', amount: new Decimal(15000) },
    ]);

    const result = await service.generateReservationDepositsReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );
    expect(result.status).toBe('COMPLETED');
  });

  // ── Reservation No-Shows ──

  it('should generate reservation-no-shows report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'RESERVATION_NO_SHOWS' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.reservation.findMany.mockResolvedValue([{ partySize: 3 }]);
    prisma.reservation.count.mockResolvedValueOnce(2).mockResolvedValueOnce(10);

    const result = await service.generateReservationNoShowsReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );
    expect(result.status).toBe('COMPLETED');
  });

  // ── Event Summary ──

  it('should generate event-summary report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'EVENT_SUMMARY' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.event.findMany.mockResolvedValue([
      { status: 'PUBLISHED', capacity: 100, soldCount: 80, checkedInCount: 60, bookings: [] },
    ]);

    const result = await service.generateEventSummaryReport(orgId, branchId, userId, 'DAY' as any);
    expect(result.status).toBe('COMPLETED');
  });

  // ── Event Bookings ──

  it('should generate event-bookings report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'EVENT_BOOKINGS' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.eventBooking.findMany.mockResolvedValue([
      { status: 'CONFIRMED', subtotal: new Decimal(50000), quantity: 2 },
    ]);

    const result = await service.generateEventBookingsReport(orgId, branchId, userId, 'DAY' as any);
    expect(result.status).toBe('COMPLETED');
  });

  // ── Event Check-Ins ──

  it('should generate event-checkins report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'EVENT_CHECKINS' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.eventCheckIn.findMany.mockResolvedValue([{ status: 'SUCCESS' }, { status: 'DENIED' }]);

    const result = await service.generateEventCheckinsReport(orgId, branchId, userId, 'DAY' as any);
    expect(result.status).toBe('COMPLETED');
  });

  // ── High-Risk Actors ──

  it('should generate high-risk-actors report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'HIGH_RISK_ACTORS' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.anomalyEvent.findMany.mockResolvedValue([
      { actorUserId: 'u1', severity: 'HIGH', type: 'VOID_SPIKE' },
      { actorUserId: 'u1', severity: 'MEDIUM', type: 'DISCOUNT_ABUSE' },
    ]);

    const result = await service.generateHighRiskActorsReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );
    expect(result.status).toBe('COMPLETED');
  });

  // ── Staff Operations ──

  it('should generate staff-operations report', async () => {
    prisma.reportRun.create.mockResolvedValue(fakeRun({ reportType: 'STAFF_OPERATIONS' }));
    prisma.reportRun.update.mockResolvedValue(fakeRun({ status: 'COMPLETED' }));
    prisma.order.findMany
      .mockResolvedValueOnce([{ userId: 'u1', total: new Decimal(100000) }])
      .mockResolvedValueOnce([{ userId: 'u1', total: new Decimal(5000) }]);
    prisma.refund.findMany.mockResolvedValue([{ createdById: 'u1', amount: new Decimal(3000) }]);
    prisma.discount.findMany.mockResolvedValue([{ createdById: 'u1', value: new Decimal(2000) }]);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'staff@test.co' }]);

    const result = await service.generateStaffOperationsReport(
      orgId,
      branchId,
      userId,
      'DAY' as any,
    );
    expect(result.status).toBe('COMPLETED');
  });

  // ── Report Catalog ──

  it('should return report catalog with correct structure', () => {
    const catalog = service.getReportCatalog();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(20);
    const implemented = catalog.filter((c: any) => c.status === 'IMPLEMENTED');
    expect(implemented.length).toBeGreaterThanOrEqual(24);
    for (const entry of catalog) {
      expect(entry).toHaveProperty('key');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('description');
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('formats');
      expect(entry).toHaveProperty('permission');
    }
  });
});
