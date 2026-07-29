import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { KdsService } from '../kds/kds.service';
import { ReservationsService } from '../reservations/reservations.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: Record<string, any>;
  let audit: { log: jest.Mock };
  let kdsService: { createTicketsForOrder: jest.Mock };
  let reservationsService: { completeForClosedOrder: jest.Mock };

  const mockCtx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
    roleId: 'role-owner',
  };
  const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      order: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      orderItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      table: {
        findFirst: jest.fn(),
      },
      menuItem: {
        findFirst: jest.fn(),
      },
      modifierOption: {
        findMany: jest.fn(),
      },
      recipeIngredient: {
        findMany: jest.fn(),
      },
      discount: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };
    kdsService = { createTicketsForOrder: jest.fn().mockResolvedValue({ tickets: [] }) };
    reservationsService = { completeForClosedOrder: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: KdsService, useValue: kdsService },
        { provide: ReservationsService, useValue: reservationsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  // ── Create Order ──

  describe('createOrder', () => {
    it('should create a dine-in order with table', async () => {
      prisma.table.findFirst.mockResolvedValue({ id: 'table-1', label: 'T1' });
      prisma.order.findFirst.mockResolvedValue(null); // no previous order
      prisma.order.create.mockResolvedValue({
        id: 'order-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        orderNumber: 'ORD-000001',
        serviceType: 'DINE_IN',
        status: 'NEW',
        tableId: 'table-1',
      });

      const result = await service.createOrder(
        'user-1',
        mockCtx,
        {
          serviceType: 'DINE_IN',
          tableId: 'table-1',
        },
        mockMeta,
      );

      expect(result.id).toBe('order-1');
      expect(result.orderNumber).toBe('ORD-000001');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORDER_CREATED' }));
    });

    it('should create a takeaway order without table', async () => {
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.order.create.mockResolvedValue({
        id: 'order-2',
        orderNumber: 'ORD-000001',
        serviceType: 'TAKEAWAY',
        status: 'NEW',
      });

      const result = await service.createOrder(
        'user-1',
        mockCtx,
        {
          serviceType: 'TAKEAWAY',
        },
        mockMeta,
      );

      expect(result.id).toBe('order-2');
    });

    it('should reject takeaway with tableId', async () => {
      await expect(
        service.createOrder(
          'user-1',
          mockCtx,
          {
            serviceType: 'TAKEAWAY',
            tableId: 'table-1',
          },
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject dine-in with invalid table', async () => {
      prisma.table.findFirst.mockResolvedValue(null);

      await expect(
        service.createOrder(
          'user-1',
          mockCtx,
          {
            serviceType: 'DINE_IN',
            tableId: 'nonexistent',
          },
          mockMeta,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Get Order ──

  describe('getOrder', () => {
    it('should return order with items', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        items: [{ id: 'item-1' }],
        table: { id: 'table-1', label: 'T1' },
        user: { id: 'user-1' },
      });

      const result = await service.getOrder(mockCtx, 'order-1');
      expect(result.id).toBe('order-1');
    });

    it('should throw if order not found', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.getOrder(mockCtx, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── List Orders ──

  describe('listOrders', () => {
    it('should return paginated orders', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'order-1' }]);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.listOrders(mockCtx, { page: 1, pageSize: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      await service.listOrders(mockCtx, { status: 'NEW' });
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'NEW' }),
        }),
      );
    });
  });

  // ── Add Order Item ──

  describe('addOrderItem', () => {
    it('should add an item and recalculate totals', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'NEW' });
      prisma.menuItem.findFirst.mockResolvedValue({
        id: 'mi-1',
        price: new Decimal('10.00'),
        isActive: true,
        servings: [],
      });
      prisma.recipeIngredient.findMany.mockResolvedValue([]);
      prisma.orderItem.create.mockResolvedValue({
        id: 'oi-1',
        menuItemId: 'mi-1',
        quantity: 2,
        price: new Decimal('10.00'),
        subtotal: new Decimal('20.00'),
      });
      prisma.orderItem.findMany.mockResolvedValue([{ subtotal: new Decimal('20.00') }]);
      prisma.order.update.mockResolvedValue({});

      const result = await service.addOrderItem(
        'user-1',
        mockCtx,
        'order-1',
        {
          menuItemId: 'mi-1',
          quantity: 2,
        },
        mockMeta,
      );

      expect(result.id).toBe('oi-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ORDER_ITEM_ADDED' }),
      );
    });

    it('should reject adding items to CLOSED order', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

      await expect(
        service.addOrderItem(
          'user-1',
          mockCtx,
          'order-1',
          {
            menuItemId: 'mi-1',
          },
          mockMeta,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject adding items to VOIDED order', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'VOIDED' });

      await expect(
        service.addOrderItem(
          'user-1',
          mockCtx,
          'order-1',
          {
            menuItemId: 'mi-1',
          },
          mockMeta,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if order not found', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.addOrderItem(
          'user-1',
          mockCtx,
          'order-1',
          {
            menuItemId: 'mi-1',
          },
          mockMeta,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Delete Order Item ──

  describe('deleteOrderItem', () => {
    it('should delete item and recalculate totals', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'NEW' });
      prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi-1', orderId: 'order-1' });
      prisma.orderItem.delete.mockResolvedValue({});
      prisma.orderItem.findMany.mockResolvedValue([]);
      prisma.order.update.mockResolvedValue({});

      const result = await service.deleteOrderItem('user-1', mockCtx, 'order-1', 'oi-1', mockMeta);
      expect(result.deleted).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ORDER_ITEM_REMOVED' }),
      );
    });

    it('should reject if order is CLOSED', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

      await expect(
        service.deleteOrderItem('user-1', mockCtx, 'order-1', 'oi-1', mockMeta),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── State Machine Transitions ──

  describe('sendOrder', () => {
    it('should transition NEW → SENT', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'NEW' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'SENT' });

      const result = await service.sendOrder('user-1', mockCtx, 'order-1', {}, mockMeta);
      expect(result.status).toBe('SENT');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORDER_SENT' }));
    });

    it('should reject CLOSED → SENT', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

      await expect(service.sendOrder('user-1', mockCtx, 'order-1', {}, mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('markInKitchen', () => {
    it('should transition SENT → IN_KITCHEN', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'SENT' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'IN_KITCHEN' });

      const result = await service.markInKitchen('user-1', mockCtx, 'order-1', {}, mockMeta);
      expect(result.status).toBe('IN_KITCHEN');
    });
  });

  describe('markReady', () => {
    it('should transition IN_KITCHEN → READY', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'IN_KITCHEN' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'READY' });

      const result = await service.markReady('user-1', mockCtx, 'order-1', {}, mockMeta);
      expect(result.status).toBe('READY');
    });
  });

  describe('markServed', () => {
    it('should transition READY → SERVED', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'READY' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'SERVED' });

      const result = await service.markServed('user-1', mockCtx, 'order-1', {}, mockMeta);
      expect(result.status).toBe('SERVED');
    });
  });

  describe('closeOrder', () => {
    it('should transition SERVED → CLOSED', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'SERVED' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

      const result = await service.closeOrder('user-1', mockCtx, 'order-1', {}, mockMeta);
      expect(result.status).toBe('CLOSED');
    });

    it('should reconcile a linked reservation on close (Prompt 4A auto-completion)', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'SERVED' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });
      reservationsService.completeForClosedOrder.mockResolvedValue('res-1');

      await service.closeOrder('user-1', mockCtx, 'order-1', {}, mockMeta);

      expect(reservationsService.completeForClosedOrder).toHaveBeenCalledWith(
        'order-1',
        mockCtx,
        'user-1',
        mockMeta,
      );
    });

    it('should not fail the order close when reservation auto-completion throws', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'SERVED' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });
      reservationsService.completeForClosedOrder.mockRejectedValue(new Error('db blip'));

      const result = await service.closeOrder('user-1', mockCtx, 'order-1', {}, mockMeta);
      expect(result.status).toBe('CLOSED');
    });

    it('should reject NEW → CLOSED', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'NEW' });

      await expect(service.closeOrder('user-1', mockCtx, 'order-1', {}, mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── Void ──

  describe('voidOrder', () => {
    it('should void a NEW order without reason', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'NEW' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'VOIDED' });

      const result = await service.voidOrder('user-1', mockCtx, 'order-1', {}, mockMeta);
      expect(result.status).toBe('VOIDED');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORDER_VOIDED' }));
    });

    it('should void IN_KITCHEN order with reason', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'IN_KITCHEN' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'VOIDED' });

      const result = await service.voidOrder(
        'user-1',
        mockCtx,
        'order-1',
        { reason: 'Customer left' },
        mockMeta,
      );
      expect(result.status).toBe('VOIDED');
    });

    it('should reject post-kitchen void without reason', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'IN_KITCHEN' });

      await expect(service.voidOrder('user-1', mockCtx, 'order-1', {}, mockMeta)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject void from SERVED', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'SERVED' });

      await expect(service.voidOrder('user-1', mockCtx, 'order-1', {}, mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject void from CLOSED', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

      await expect(service.voidOrder('user-1', mockCtx, 'order-1', {}, mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
