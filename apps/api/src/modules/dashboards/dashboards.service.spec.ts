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

    /** Helper: mock all aggregation primitives with sensible defaults */
    function mockDefaults() {
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
        expect(result.grossSales).toEqual(new Decimal(500000));
        expect(result.netSales).toEqual(new Decimal(480000));
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

        const result = await service.getOpenOrders(orgId, branchId);

        expect(result.count).toBe(1);
        expect(result.orders[0].orderNumber).toBe('ORD-001');
        expect(prisma.order.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ orgId, branchId }),
            }),
        );
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
