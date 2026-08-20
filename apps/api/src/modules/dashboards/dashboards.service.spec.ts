import { Test, TestingModule } from '@nestjs/testing';
import { DashboardsService } from './dashboards.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';

describe('DashboardsService', () => {
  let service: DashboardsService;
  let prisma: any;
  let audit: any;

  const orgId = 'org-1';
  const branchId = 'branch-1';

  beforeEach(async () => {
    prisma = {
      order: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      payment: {
        groupBy: jest.fn(),
      },
      refund: {
        aggregate: jest.fn(),
      },
      inventoryItem: {
        findMany: jest.fn(),
      },
      anomalyEvent: {
        count: jest.fn(),
      },
      reservation: {
        count: jest.fn(),
      },
      event: {
        count: jest.fn(),
      },
      shift: {
        count: jest.fn(),
      },
      tillSession: {
        count: jest.fn(),
      },
      kpiSnapshot: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      kpiSubscription: {
        findMany: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<DashboardsService>(DashboardsService);
  });

  /**
   * Helper: mock all aggregation primitives with sensible defaults.
   *
   * The sales figures obey the persisted identity `total = subtotal + tax - discount`
   * (500000 + 20000 - 10000 = 510000), which is what the database actually stores —
   * see the MP0-10 note on `aggregateSales`.
   */
  function mockDefaults() {
    prisma.order.aggregate.mockResolvedValue({
      _sum: {
        subtotal: new Decimal(500000),
        total: new Decimal(510000),
        tax: new Decimal(20000),
        discount: new Decimal(10000),
      },
      _count: 20,
      _avg: { total: new Decimal(24000) },
    });
    prisma.payment.groupBy.mockResolvedValue([
      { method: 'CASH', _sum: { amount: new Decimal(300000) } },
      { method: 'CARD', _sum: { amount: new Decimal(100000) } },
      { method: 'MOMO', _sum: { amount: new Decimal(80000) } },
    ]);
    prisma.refund.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal(15000) },
    });
    prisma.order.count.mockResolvedValue(3);
    prisma.inventoryItem.findMany.mockResolvedValue([]);
    prisma.anomalyEvent.count.mockResolvedValue(0);
    prisma.reservation.count.mockResolvedValue(0);
    prisma.event.count.mockResolvedValue(0);
    prisma.shift.count.mockResolvedValue(1);
    prisma.tillSession.count.mockResolvedValue(1);
  }

  // ── Today Summary ──

  it('should return today summary with live aggregation', async () => {
    mockDefaults();

    const result = await service.getTodaySummary(orgId, branchId);

    expect(result.date).toBeDefined();
    // MP0-10: gross is the tax-inclusive billed amount, net is gross minus tax.
    expect(result.grossSales).toEqual(new Decimal(510000));
    expect(result.netSales).toEqual(new Decimal(490000));
    expect(result.subtotalSales).toEqual(new Decimal(500000));
    expect(result.paymentMix.cash).toEqual(new Decimal(300000));
    expect(result.paymentMix.card).toEqual(new Decimal(100000));
    expect(result.paymentMix.momo).toEqual(new Decimal(80000));
    expect(result.openOrders).toBe(3);
    expect(result.calculatedAt).toBeDefined();
    expect(prisma.order.aggregate).toHaveBeenCalled();
    expect(prisma.payment.groupBy).toHaveBeenCalled();
  });

  // ── Owner Dashboard ──

  it('should return owner dashboard with today + MTD', async () => {
    mockDefaults();

    const result = await service.getOwnerDashboard(orgId, branchId);

    expect(result.today).toBeDefined();
    expect(result.mtd).toBeDefined();
    expect(result.paymentMix).toBeDefined();
    expect(result.openOrders).toBeDefined();
    expect(result.lowStockCount).toBeDefined();
    expect(result.anomalySummary).toBeDefined();
    expect(result.reservationsTodayCount).toBeDefined();
    expect(result.eventsTodayCount).toBeDefined();
    expect(result.calculatedAt).toBeDefined();
    // 2 calls to aggregateSales (today + mtd)
    expect(prisma.order.aggregate).toHaveBeenCalledTimes(2);
  });

  // ── Manager Dashboard ──

  it('should return manager dashboard with shift/till summary', async () => {
    mockDefaults();

    const result = await service.getManagerDashboard(orgId, branchId);

    expect(result.today).toBeDefined();
    expect(result.openOrders).toBeDefined();
    expect(result.shiftSummary.activeShifts).toBe(1);
    expect(result.shiftSummary.activeTills).toBe(1);
    expect(result.reservationsTodayCount).toBe(0);
    expect(prisma.shift.count).toHaveBeenCalled();
    expect(prisma.tillSession.count).toHaveBeenCalled();
  });

  // ── Payment Mix ──

  it('should return payment mix with totals', async () => {
    mockDefaults();

    const result = await service.getPaymentMix(orgId, branchId);

    expect(result.cash).toEqual(new Decimal(300000));
    expect(result.card).toEqual(new Decimal(100000));
    expect(result.momo).toEqual(new Decimal(80000));
    expect(result.total).toEqual(new Decimal(480000));
    expect(result.date).toBeDefined();
  });

  // ── Open Orders ──

  it('should return open orders list', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        orderNumber: 'ORD-001',
        status: 'NEW',
        serviceType: 'DINE_IN',
        total: new Decimal(25000),
        createdAt: new Date(),
      },
    ]);
    prisma.order.count.mockResolvedValue(1);

    const result = await service.getOpenOrders(orgId, branchId);

    expect(result.count).toBe(1);
    expect(result.total).toBe(1);
    expect(result.truncated).toBe(false);
    expect(result.orders[0].orderNumber).toBe('ORD-001');
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId, branchId }),
      }),
    );
  });

  // ── MP0-09: open-order count parity ──

  describe('MP0-09 open-order count parity', () => {
    /** 107 open orders in the branch; the list can only carry 50 of them. */
    const OPEN_ORDER_TOTAL = 107;

    function mockOversizedOpenOrders() {
      const rows = Array.from({ length: 50 }, (_, i) => ({
        id: `o${i + 1}`,
        orderNumber: `ORD-${String(i + 1).padStart(3, '0')}`,
        status: 'SENT',
        serviceType: 'DINE_IN',
        total: new Decimal(10000),
        createdAt: new Date(2026, 7, 20, 8, i),
      }));
      prisma.order.findMany.mockResolvedValue(rows);
      prisma.order.count.mockResolvedValue(OPEN_ORDER_TOTAL);
    }

    it('reports the real total next to the capped rows', async () => {
      mockOversizedOpenOrders();

      const result = await service.getOpenOrders(orgId, branchId);

      // Before MP0-09 the only number here was `count: 50` — the page length.
      expect(result.orders).toHaveLength(50);
      expect(result.count).toBe(50);
      expect(result.limit).toBe(50);
      expect(result.total).toBe(OPEN_ORDER_TOTAL);
      expect(result.truncated).toBe(true);
    });

    it('agrees with /dash/manager.openOrders on the same fixture', async () => {
      mockOversizedOpenOrders();
      mockDefaults();
      prisma.order.count.mockResolvedValue(OPEN_ORDER_TOTAL);

      const list = await service.getOpenOrders(orgId, branchId);
      const manager = await service.getManagerDashboard(orgId, branchId);
      const summary = await service.getTodaySummary(orgId, branchId);

      expect(list.total).toBe(manager.openOrders);
      expect(list.total).toBe(summary.openOrders);
      expect(manager.openOrders).toBe(OPEN_ORDER_TOTAL);
    });

    it('uses one shared definition of "open" for the list and the count', async () => {
      mockOversizedOpenOrders();

      await service.getOpenOrders(orgId, branchId);
      const listWhere = prisma.order.findMany.mock.calls[0][0].where;
      const countWhere = prisma.order.count.mock.calls[0][0].where;

      expect(listWhere).toEqual(countWhere);
      expect(listWhere.status).toEqual({
        in: ['NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED'],
      });
    });
  });

  // ── MP0-10: gross/net ordering ──

  describe('MP0-10 gross vs net sales', () => {
    /**
     * Controlled fixture reproducing the live inversion.
     * subtotal 28,107,000 (ex-tax) · tax 5,059,260 · discount 152,160
     *   → total = 28,107,000 + 5,059,260 - 152,160 = 33,014,100
     * Before the fix: grossSales = 28,107,000 and netSales = 33,014,100 → net > gross.
     * After the fix:  grossSales = 33,014,100 and netSales = 27,954,840 (= gross - tax).
     */
    const SUBTOTAL = new Decimal(28107000);
    const TAX = new Decimal(5059260);
    const DISCOUNT = new Decimal(152160);
    const TOTAL = new Decimal(33014100);

    function mockLiveShapedSales() {
      prisma.order.aggregate.mockResolvedValue({
        _sum: { subtotal: SUBTOTAL, total: TOTAL, tax: TAX, discount: DISCOUNT },
        _count: 374,
        _avg: { total: new Decimal(88273) },
      });
      prisma.payment.groupBy.mockResolvedValue([]);
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.order.count.mockResolvedValue(0);
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.anomalyEvent.count.mockResolvedValue(0);
      prisma.reservation.count.mockResolvedValue(0);
      prisma.event.count.mockResolvedValue(0);
      prisma.shift.count.mockResolvedValue(0);
      prisma.tillSession.count.mockResolvedValue(0);
    }

    it('today-summary: gross >= net, and gross = net + tax', async () => {
      mockLiveShapedSales();

      const result = await service.getTodaySummary(orgId, branchId);

      expect(result.grossSales).toEqual(TOTAL); // 33,014,100
      expect(result.netSales).toEqual(new Decimal(27954840)); // 33,014,100 - 5,059,260
      expect(result.taxTotal).toEqual(TAX);
      expect(result.subtotalSales).toEqual(SUBTOTAL); // the old, ex-tax "gross"
      expect(new Decimal(result.grossSales).gte(new Decimal(result.netSales))).toBe(true);
      expect(new Decimal(result.netSales).add(result.taxTotal)).toEqual(
        new Decimal(result.grossSales),
      );
    });

    it('manager, owner and stream metrics use the same definition', async () => {
      mockLiveShapedSales();

      const manager = await service.getManagerDashboard(orgId, branchId);
      const owner = await service.getOwnerDashboard(orgId, branchId);
      const stream = await service.getStreamMetrics(orgId, branchId);

      for (const scope of [manager.today, owner.today, owner.mtd]) {
        expect(scope.grossSales).toEqual(TOTAL);
        expect(scope.netSales).toEqual(new Decimal(27954840));
      }
      expect(stream.grossSales).toEqual(TOTAL);
      expect(stream.netSales).toEqual(new Decimal(27954840));
    });

    it('holds when there is no tax at all (POS-created orders)', async () => {
      prisma.order.aggregate.mockResolvedValue({
        _sum: {
          subtotal: new Decimal(120000),
          total: new Decimal(110000),
          tax: new Decimal(0),
          discount: new Decimal(10000),
        },
        _count: 4,
        _avg: { total: new Decimal(27500) },
      });
      prisma.payment.groupBy.mockResolvedValue([]);
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.order.count.mockResolvedValue(0);
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.anomalyEvent.count.mockResolvedValue(0);
      prisma.reservation.count.mockResolvedValue(0);
      prisma.event.count.mockResolvedValue(0);

      const result = await service.getTodaySummary(orgId, branchId);

      expect(result.grossSales).toEqual(new Decimal(110000));
      expect(result.netSales).toEqual(new Decimal(110000));
      expect(result.subtotalSales).toEqual(new Decimal(120000));
    });

    it('an empty day returns zeros, not nulls', async () => {
      prisma.order.aggregate.mockResolvedValue({
        _sum: { subtotal: null, total: null, tax: null, discount: null },
        _count: 0,
        _avg: { total: null },
      });
      prisma.payment.groupBy.mockResolvedValue([]);
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.order.count.mockResolvedValue(0);
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.anomalyEvent.count.mockResolvedValue(0);
      prisma.reservation.count.mockResolvedValue(0);
      prisma.event.count.mockResolvedValue(0);

      const result = await service.getTodaySummary(orgId, branchId);

      expect(result.grossSales).toEqual(new Decimal(0));
      expect(result.netSales).toEqual(new Decimal(0));
      expect(result.subtotalSales).toEqual(new Decimal(0));
    });
  });

  // ── Low Stock ──

  it('should detect low stock items', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        reorderLevel: new Decimal(10),
        stockBatches: [{ remainingQty: new Decimal(3) }],
        name: 'Flour',
        sku: 'FLR-001',
        unit: 'kg',
        reorderQty: new Decimal(50),
      },
      {
        id: 'inv-2',
        reorderLevel: new Decimal(5),
        stockBatches: [{ remainingQty: new Decimal(20) }],
        name: 'Sugar',
        sku: 'SGR-001',
        unit: 'kg',
        reorderQty: new Decimal(25),
      },
    ]);

    const result = await service.getLowStock(orgId, branchId);

    expect(result.count).toBe(1);
    expect(result.items[0].name).toBe('Flour');
    expect(result.items[0].currentStock).toEqual(new Decimal(3));
  });

  it('should return empty when no low stock', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    const result = await service.getLowStock(orgId, branchId);

    expect(result.count).toBe(0);
    expect(result.items).toEqual([]);
  });

  // ── KPI Refresh ──

  it('should create a KPI snapshot and audit log', async () => {
    mockDefaults();
    const mockSnapshot = {
      id: 'snap-1',
      orgId,
      branchId,
      scopeType: 'BRANCH',
      metricWindow: 'TODAY',
    };
    prisma.kpiSnapshot.create.mockResolvedValue(mockSnapshot);

    const result = await service.refreshKpi(orgId, branchId, 'BRANCH', 'TODAY', 'user-1', {
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    });

    expect(result.id).toBe('snap-1');
    expect(prisma.kpiSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId,
          branchId,
          scopeType: 'BRANCH',
          metricWindow: 'TODAY',
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'KPI_REFRESH_TRIGGERED',
        actorUserId: 'user-1',
        entityType: 'KpiSnapshot',
        entityId: 'snap-1',
      }),
    );
  });

  it('should use MTD range when metricWindow is MTD', async () => {
    mockDefaults();
    prisma.kpiSnapshot.create.mockResolvedValue({ id: 'snap-2' });

    await service.refreshKpi(orgId, branchId, 'OWNER', 'MTD', 'user-1', {});

    expect(prisma.kpiSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metricWindow: 'MTD' }),
      }),
    );
  });

  // ── Snapshots List ──

  it('should list snapshots ordered by calculatedAt desc', async () => {
    prisma.kpiSnapshot.findMany.mockResolvedValue([
      { id: 'snap-1', scopeType: 'BRANCH', calculatedAt: new Date() },
    ]);

    const result = await service.listSnapshots(orgId, branchId);

    expect(result).toHaveLength(1);
    expect(prisma.kpiSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId, branchId },
        orderBy: { calculatedAt: 'desc' },
        take: 20,
      }),
    );
  });

  // ── Stream Metrics ──

  it('should return lightweight stream metrics', async () => {
    mockDefaults();

    const result = await service.getStreamMetrics(orgId, branchId);

    expect(result.grossSales).toBeDefined();
    expect(result.netSales).toBeDefined();
    expect(result.openOrders).toBeDefined();
    expect(result.anomalyOpenCount).toBeDefined();
    expect(result.orderCount).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });

  // ── Branch Isolation ──

  it('should scope aggregations to branchId', async () => {
    mockDefaults();

    await service.getTodaySummary(orgId, branchId);

    // order aggregate should be scoped to branch
    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId, branchId }),
      }),
    );
  });

  // ── Anomaly Summary ──

  it('should count open and high-severity anomalies', async () => {
    prisma.anomalyEvent.count
      .mockResolvedValueOnce(5) // open count
      .mockResolvedValueOnce(2); // high count
    // Mock minimal other calls for owner dashboard
    prisma.order.aggregate.mockResolvedValue({
      _sum: {
        subtotal: new Decimal(0),
        total: new Decimal(0),
        tax: new Decimal(0),
        discount: new Decimal(0),
      },
      _count: 0,
      _avg: { total: new Decimal(0) },
    });
    prisma.payment.groupBy.mockResolvedValue([]);
    prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.order.count.mockResolvedValue(0);
    prisma.inventoryItem.findMany.mockResolvedValue([]);
    prisma.reservation.count.mockResolvedValue(0);
    prisma.event.count.mockResolvedValue(0);

    const result = await service.getOwnerDashboard(orgId, branchId);

    expect(result.anomalySummary.openCount).toBe(5);
    expect(result.anomalySummary.highCount).toBe(2);
  });
});
