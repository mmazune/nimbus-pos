import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { KdsService } from '../kds/kds.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: Record<string, any>;
  let audit: { log: jest.Mock };
  let kdsService: { createTicketsForLines: jest.Mock; announceTickets: jest.Mock };
  let emitter: { emit: jest.Mock };

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
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn(),
      },
      kdsTicketItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      payment: { count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([]),
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
      // T2 phase 1 (E2): no availability row = available, no number
      menuItemAvailability: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    prisma.$transaction = jest.fn().mockImplementation((fn: any) => fn(prisma));

    audit = { log: jest.fn().mockResolvedValue(undefined) };
    kdsService = {
      createTicketsForLines: jest.fn().mockResolvedValue([{ id: 'ticket-1', station: 'KITCHEN' }]),
      announceTickets: jest.fn(),
    };
    emitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: KdsService, useValue: kdsService },
        { provide: EventEmitter2, useValue: emitter },
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

  describe('sendOrder (E1 — send by line)', () => {
    beforeEach(() => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        status: 'NEW',
        serviceType: 'TAKEAWAY',
        tableId: null,
      });
      // first read = the locked row inside the transaction, second = the answer
      prisma.order.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 'order-1', status: 'NEW' })
        .mockResolvedValue({ id: 'order-1', status: 'SENT' });
      prisma.orderItem.findMany.mockResolvedValue([
        { id: 'line-1', menuItemId: 'mi-1', quantity: 1, menuItem: { name: 'Item one' } },
        { id: 'line-2', menuItemId: 'mi-2', quantity: 1, menuItem: { name: 'Item two' } },
      ]);
    });

    it('moves NEW → SENT the first time, stamps the lines and tickets exactly those lines', async () => {
      const result = await service.sendOrder('user-1', mockCtx, 'order-1', {}, mockMeta);

      expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orderId: 'order-1', sentAt: null, voidedAt: null } }),
      );
      expect(prisma.orderItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['line-1', 'line-2'] }, sentAt: null } }),
      );
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'SENT' },
      });
      expect(kdsService.createTicketsForLines).toHaveBeenCalledWith(prisma, mockCtx, 'order-1', [
        'line-1',
        'line-2',
      ]);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'ORDER_SENT' }),
      });
      expect(result.status).toBe('SENT');
    });

    it('a later send leaves the status alone', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        status: 'SERVED',
        serviceType: 'TAKEAWAY',
        tableId: null,
      });
      prisma.order.findUniqueOrThrow
        .mockReset()
        .mockResolvedValue({ id: 'order-1', status: 'SERVED' });

      await service.sendOrder('user-1', mockCtx, 'order-1', {}, mockMeta);

      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(kdsService.createTicketsForLines).toHaveBeenCalled();
    });

    it('answers 409 when there is nothing to send', async () => {
      prisma.orderItem.findMany.mockResolvedValue([]);
      await expect(service.sendOrder('user-1', mockCtx, 'order-1', {}, mockMeta)).rejects.toThrow(
        ConflictException,
      );
      expect(kdsService.createTicketsForLines).not.toHaveBeenCalled();
    });

    it('rejects a CLOSED order', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });
      prisma.order.findUniqueOrThrow
        .mockReset()
        .mockResolvedValue({ id: 'order-1', status: 'CLOSED' });
      await expect(service.sendOrder('user-1', mockCtx, 'order-1', {}, mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });

    it('emits order.lines.sent with ids only, after the transaction', async () => {
      await service.sendOrder('user-1', mockCtx, 'order-1', {}, mockMeta);
      expect(emitter.emit).toHaveBeenCalledWith('order.lines.sent', {
        orderId: 'order-1',
        branchId: 'branch-1',
        orgId: 'org-1',
        orderItemIds: ['line-1', 'line-2'],
        ticketIds: ['ticket-1'],
      });
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

  describe('closing an order (E1 — one close door)', () => {
    it('there is no closeOrder method that closes without payment', () => {
      expect((service as any).closeOrder).toBeUndefined();
    });

    it('transitionOrder(CLOSED) closes through the door and emits order.closed', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        status: 'SERVED',
        orgId: 'org-1',
        branchId: 'branch-1',
        tableId: null,
        total: new Decimal(0),
        userId: 'u',
      });
      prisma.order.findUniqueOrThrow.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });
      prisma.reservation = { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() };

      const result = await (service as any).transitionOrder(
        'user-1',
        mockCtx,
        'order-1',
        'CLOSED',
        'ORDER_CLOSED',
        mockMeta,
      );

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CLOSED' } }),
      );
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(result.status).toBe('CLOSED');
      expect(emitter.emit).toHaveBeenCalledWith('order.closed', {
        orderId: 'order-1',
        branchId: 'branch-1',
        orgId: 'org-1',
        tableId: null,
        completedReservationId: null,
      });
    });

    it('rejects NEW → CLOSED', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'NEW' });
      await expect(
        (service as any).transitionOrder(
          'user-1',
          mockCtx,
          'order-1',
          'CLOSED',
          'ORDER_CLOSED',
          mockMeta,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('voidOrderItem (E1 — void one line)', () => {
    const sentLine = {
      id: 'line-1',
      orderId: 'order-1',
      menuItemId: 'm-1',
      menuItemServingId: null,
      quantity: 2,
      price: new Decimal(12000),
      subtotal: new Decimal(24000),
      notes: null,
      metadata: null,
      costUnit: null,
      sentAt: new Date('2026-11-25T16:42:00Z'),
      voidedAt: null,
    };
    const dto = { reason: 'GUEST_CHANGED_MIND', wasMade: false } as any;

    beforeEach(() => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'SERVED' });
      prisma.orderItem.findFirst.mockResolvedValue(sentLine);
      prisma.orderItem.update.mockImplementation(async ({ data }: any) => ({
        ...sentLine,
        ...data,
      }));
      prisma.orderItem.create.mockImplementation(async ({ data }: any) => ({
        id: 'line-new',
        ...data,
      }));
      prisma.orderItem.findMany.mockResolvedValue([]);
      prisma.order.findUniqueOrThrow.mockResolvedValue({ id: 'order-1', total: new Decimal(0) });
    });

    it('voids a whole sent line: who, when, why, wasMade; ticket item flagged; event emitted', async () => {
      const result = await service.voidOrderItem(
        'sup-1',
        mockCtx,
        'order-1',
        'line-1',
        dto,
        mockMeta,
      );

      expect(prisma.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'line-1' },
        data: expect.objectContaining({
          voidedById: 'sup-1',
          voidReason: 'GUEST_CHANGED_MIND',
          wasMade: false,
          voidedAt: expect.any(Date),
        }),
      });
      expect(prisma.kdsTicketItem.updateMany).toHaveBeenCalledWith({
        where: { orderItemId: 'line-1' },
        data: expect.objectContaining({ voidReason: 'GUEST_CHANGED_MIND', wasMade: false }),
      });
      expect(prisma.orderItem.delete).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'ORDER_ITEM_VOIDED', actorUserId: 'sup-1' }),
      });
      expect(result.unchanged).toBe(false);
      expect(emitter.emit).toHaveBeenCalledWith('order.line.voided', {
        orderId: 'order-1',
        branchId: 'branch-1',
        orgId: 'org-1',
        orderItemId: 'line-1',
      });
    });

    it('part of a quantity splits the line in two', async () => {
      await service.voidOrderItem(
        'sup-1',
        mockCtx,
        'order-1',
        'line-1',
        { ...dto, quantity: 1 },
        mockMeta,
      );

      expect(prisma.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'line-1' },
        data: expect.objectContaining({ quantity: 1 }),
      });
      expect(prisma.orderItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quantity: 1,
          voidReason: 'GUEST_CHANGED_MIND',
          sentAt: sentLine.sentAt,
        }),
      });
    });

    it('refuses a line that was never sent (400, remove it instead)', async () => {
      prisma.orderItem.findFirst.mockResolvedValue({ ...sentLine, sentAt: null });
      await expect(
        service.voidOrderItem('sup-1', mockCtx, 'order-1', 'line-1', dto, mockMeta),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a closed order and an order with a posted payment (409)', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });
      await expect(
        service.voidOrderItem('sup-1', mockCtx, 'order-1', 'line-1', dto, mockMeta),
      ).rejects.toThrow(ConflictException);

      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'SERVED' });
      prisma.payment.count.mockResolvedValue(1);
      await expect(
        service.voidOrderItem('sup-1', mockCtx, 'order-1', 'line-1', dto, mockMeta),
      ).rejects.toThrow(ConflictException);
    });

    it('voiding an already voided line returns it unchanged and writes nothing', async () => {
      prisma.orderItem.findFirst.mockResolvedValue({ ...sentLine, voidedAt: new Date() });
      const result = await service.voidOrderItem(
        'sup-1',
        mockCtx,
        'order-1',
        'line-1',
        dto,
        mockMeta,
      );
      expect(result.unchanged).toBe(true);
      expect(prisma.orderItem.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('OTHER needs a note', async () => {
      await expect(
        service.voidOrderItem(
          'sup-1',
          mockCtx,
          'order-1',
          'line-1',
          { reason: 'OTHER', wasMade: true } as any,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
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
