import { Test, TestingModule } from '@nestjs/testing';
import { KdsService } from './kds.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('KdsService', () => {
  let service: KdsService;
  let prisma: Record<string, any>;
  let audit: { log: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  const mockCtx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
  };
  const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      order: { findFirst: jest.fn() },
      kdsTicket: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      kdsTicketItem: { findMany: jest.fn() },
      kdsSlaConfig: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KdsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<KdsService>(KdsService);
  });

  // ── Create Tickets for lines (E1) ──

  describe('createTicketsForLines', () => {
    const line = (id: string, station: string) => ({ id, menuItem: { station } });

    beforeEach(() => {
      prisma.orderItem = { findMany: jest.fn() };
      prisma.auditLog = { create: jest.fn().mockResolvedValue({}) };
      prisma.kdsTicket.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `ticket-${data.station}`, station: data.station }),
      );
    });

    it('groups only the given lines by station: one ticket per station', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        line('l-1', 'KITCHEN'),
        line('l-2', 'KITCHEN'),
        line('l-3', 'BAR'),
      ]);

      const tickets = await service.createTicketsForLines(prisma as any, mockCtx, 'order-1', [
        'l-1',
        'l-2',
        'l-3',
      ]);

      expect(tickets.map((t) => t.station).sort()).toEqual(['BAR', 'KITCHEN']);
      expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['l-1', 'l-2', 'l-3'] }, orderId: 'order-1', voidedAt: null },
        }),
      );
      const kitchen = prisma.kdsTicket.create.mock.calls.find(
        (c: any[]) => c[0].data.station === 'KITCHEN',
      )[0];
      expect(kitchen.data.items.create).toEqual([{ orderItemId: 'l-1' }, { orderItemId: 'l-2' }]);
    });

    it('excludes lines with station NONE', async () => {
      prisma.orderItem.findMany.mockResolvedValue([line('l-1', 'KITCHEN'), line('l-2', 'NONE')]);
      const tickets = await service.createTicketsForLines(prisma as any, mockCtx, 'order-1', [
        'l-1',
        'l-2',
      ]);
      expect(tickets).toHaveLength(1);
    });

    it('announces tickets only when asked (after commit), never inside the transaction', async () => {
      prisma.orderItem.findMany.mockResolvedValue([line('l-1', 'COLD_KITCHEN')]);
      const tickets = await service.createTicketsForLines(prisma as any, mockCtx, 'order-1', [
        'l-1',
      ]);
      expect(eventEmitter.emit).not.toHaveBeenCalled();

      service.announceTickets(mockCtx, 'order-1', tickets);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'kds.update',
        expect.objectContaining({
          eventType: 'NEW_TICKET',
          station: 'COLD_KITCHEN',
          status: 'QUEUED',
          orderId: 'order-1',
        }),
      );
    });
  });

  describe('getQueue', () => {
    it('should return enriched queue with urgency fields', async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      prisma.kdsTicket.findMany.mockResolvedValue([
        {
          id: 'ticket-1',
          orderId: 'order-1',
          station: 'KITCHEN',
          status: 'QUEUED',
          startedAt: fiveMinAgo,
          createdAt: fiveMinAgo,
          readyAt: null,
          recalledAt: null,
          order: {
            id: 'order-1',
            orderNumber: 'ORD-000001',
            serviceType: 'DINE_IN',
            tableId: 'table-1',
            notes: null,
            table: { id: 'table-1', label: 'T1' },
          },
          items: [
            {
              id: 'ti-1',
              orderItemId: 'item-1',
              orderItem: {
                quantity: 1,
                notes: null,
                menuItem: { id: 'mi-1', name: 'Burger', station: 'KITCHEN' },
                menuItemServing: null,
              },
            },
          ],
        },
      ]);
      prisma.kdsTicket.count.mockResolvedValue(1);
      prisma.kdsSlaConfig.findMany.mockResolvedValue([]);

      const result = await service.getQueue(mockCtx, {});

      expect(result.data).toHaveLength(1);
      const ticket = result.data[0];
      expect(ticket.urgencyState).toBe('GREEN'); // 5 min < 10 min default amber
      expect(ticket.elapsedSeconds).toBeGreaterThan(200);
      expect(ticket.remainingSecondsToAmber).toBeGreaterThan(0);
      expect(ticket.remainingSecondsToRed).toBeGreaterThan(0);
      expect(ticket.amberAtSeconds).toBe(600);
      expect(ticket.redAtSeconds).toBe(900);
    });

    it('should filter by station', async () => {
      prisma.kdsTicket.findMany.mockResolvedValue([]);
      prisma.kdsTicket.count.mockResolvedValue(0);
      prisma.kdsSlaConfig.findMany.mockResolvedValue([]);

      await service.getQueue(mockCtx, { station: 'BAR' });

      expect(prisma.kdsTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ station: 'BAR' }),
        }),
      );
    });

    it('should sort RED first, then AMBER, then GREEN', async () => {
      const now = Date.now();
      prisma.kdsTicket.findMany.mockResolvedValue([
        {
          id: 'green-ticket',
          orderId: 'o1',
          station: 'KITCHEN',
          status: 'QUEUED',
          startedAt: new Date(now - 60 * 1000), // 1 min ago
          createdAt: new Date(now - 60 * 1000),
          readyAt: null,
          recalledAt: null,
          order: {
            id: 'o1',
            orderNumber: 'ORD-001',
            serviceType: 'DINE_IN',
            tableId: null,
            notes: null,
            table: null,
          },
          items: [],
        },
        {
          id: 'red-ticket',
          orderId: 'o2',
          station: 'KITCHEN',
          status: 'QUEUED',
          startedAt: new Date(now - 1000 * 1000), // ~16 min ago
          createdAt: new Date(now - 1000 * 1000),
          readyAt: null,
          recalledAt: null,
          order: {
            id: 'o2',
            orderNumber: 'ORD-002',
            serviceType: 'DINE_IN',
            tableId: null,
            notes: null,
            table: null,
          },
          items: [],
        },
      ]);
      prisma.kdsTicket.count.mockResolvedValue(2);
      prisma.kdsSlaConfig.findMany.mockResolvedValue([]);

      const result = await service.getQueue(mockCtx, {});

      expect(result.data[0].id).toBe('red-ticket');
      expect(result.data[0].urgencyState).toBe('RED');
      expect(result.data[1].id).toBe('green-ticket');
      expect(result.data[1].urgencyState).toBe('GREEN');
    });
  });

  // ── Mark Ready ──

  describe('markReady', () => {
    it('should mark a QUEUED ticket as READY', async () => {
      prisma.kdsTicket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        branchId: 'branch-1',
        orgId: 'org-1',
        orderId: 'order-1',
        station: 'KITCHEN',
        status: 'QUEUED',
        startedAt: new Date(),
      });
      prisma.kdsTicket.update.mockResolvedValue({
        id: 'ticket-1',
        status: 'READY',
        readyAt: new Date(),
      });
      prisma.kdsSlaConfig.findUnique.mockResolvedValue(null);

      const result = await service.markReady('user-1', mockCtx, 'ticket-1', mockMeta);

      expect(result.status).toBe('READY');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'KDS_TICKET_READY' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'kds.update',
        expect.objectContaining({ eventType: 'TICKET_READY' }),
      );
    });

    it('should reject already-READY ticket', async () => {
      prisma.kdsTicket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        status: 'READY',
      });

      await expect(service.markReady('user-1', mockCtx, 'ticket-1', mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw not found for missing ticket', async () => {
      prisma.kdsTicket.findFirst.mockResolvedValue(null);

      await expect(service.markReady('user-1', mockCtx, 'ticket-1', mockMeta)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── Recall ──

  describe('recallTicket', () => {
    it('should recall a READY ticket to RECALLED', async () => {
      prisma.kdsTicket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        branchId: 'branch-1',
        orgId: 'org-1',
        orderId: 'order-1',
        station: 'BAR',
        status: 'READY',
        startedAt: new Date(),
      });
      prisma.kdsTicket.update.mockResolvedValue({
        id: 'ticket-1',
        status: 'RECALLED',
        recalledAt: new Date(),
      });
      prisma.kdsSlaConfig.findUnique.mockResolvedValue(null);

      const result = await service.recallTicket('user-1', mockCtx, 'ticket-1', mockMeta);

      expect(result.status).toBe('RECALLED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'KDS_TICKET_RECALLED' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'kds.update',
        expect.objectContaining({ eventType: 'TICKET_RECALLED' }),
      );
    });

    it('should reject non-READY ticket for recall', async () => {
      prisma.kdsTicket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        status: 'QUEUED',
      });

      await expect(service.recallTicket('user-1', mockCtx, 'ticket-1', mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── SLA Config ──

  describe('getSlaConfig', () => {
    it('should return stored SLA config', async () => {
      prisma.kdsSlaConfig.findUnique.mockResolvedValue({
        id: 'sla-1',
        station: 'KITCHEN',
        branchId: 'branch-1',
        greenSeconds: 180,
        amberSeconds: 480,
        redSeconds: 720,
      });

      const result = await service.getSlaConfig(mockCtx, 'KITCHEN');

      expect(result.greenSeconds).toBe(180);
      expect(result.isDefault).toBe(false);
    });

    it('should return defaults when no config exists', async () => {
      prisma.kdsSlaConfig.findUnique.mockResolvedValue(null);

      const result = await service.getSlaConfig(mockCtx, 'BAR');

      expect(result.greenSeconds).toBe(300);
      expect(result.amberSeconds).toBe(600);
      expect(result.redSeconds).toBe(900);
      expect(result.isDefault).toBe(true);
    });
  });

  describe('updateSlaConfig', () => {
    it('should upsert SLA config', async () => {
      prisma.kdsSlaConfig.upsert.mockResolvedValue({
        id: 'sla-1',
        station: 'KITCHEN',
        greenSeconds: 120,
        amberSeconds: 360,
        redSeconds: 600,
      });

      const result = await service.updateSlaConfig(
        'user-1',
        mockCtx,
        'KITCHEN',
        { greenSeconds: 120, amberSeconds: 360, redSeconds: 600 },
        mockMeta,
      );

      expect(result.greenSeconds).toBe(120);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'KDS_SLA_UPDATED' }),
      );
    });

    it('should reject invalid SLA order', async () => {
      await expect(
        service.updateSlaConfig(
          'user-1',
          mockCtx,
          'KITCHEN',
          { greenSeconds: 600, amberSeconds: 300, redSeconds: 900 },
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Urgency Calculation ──

  describe('urgency calculation', () => {
    it('should compute GREEN for recent tickets', async () => {
      const justNow = new Date();
      prisma.kdsTicket.findMany.mockResolvedValue([
        {
          id: 'ticket-1',
          orderId: 'o1',
          station: 'KITCHEN',
          status: 'QUEUED',
          startedAt: justNow,
          createdAt: justNow,
          readyAt: null,
          recalledAt: null,
          order: {
            id: 'o1',
            orderNumber: 'ORD-001',
            serviceType: 'DINE_IN',
            tableId: null,
            notes: null,
            table: null,
          },
          items: [],
        },
      ]);
      prisma.kdsTicket.count.mockResolvedValue(1);
      prisma.kdsSlaConfig.findMany.mockResolvedValue([]);

      const result = await service.getQueue(mockCtx, {});
      expect(result.data[0].urgencyState).toBe('GREEN');
    });

    it('should compute AMBER for tickets past amber threshold', async () => {
      const sevenMinAgo = new Date(Date.now() - 7 * 60 * 1000);
      prisma.kdsTicket.findMany.mockResolvedValue([
        {
          id: 'ticket-1',
          orderId: 'o1',
          station: 'KITCHEN',
          status: 'QUEUED',
          startedAt: sevenMinAgo,
          createdAt: sevenMinAgo,
          readyAt: null,
          recalledAt: null,
          order: {
            id: 'o1',
            orderNumber: 'ORD-001',
            serviceType: 'DINE_IN',
            tableId: null,
            notes: null,
            table: null,
          },
          items: [],
        },
      ]);
      prisma.kdsTicket.count.mockResolvedValue(1);
      prisma.kdsSlaConfig.findMany.mockResolvedValue([
        { station: 'KITCHEN', greenSeconds: 120, amberSeconds: 300, redSeconds: 600 },
      ]);

      const result = await service.getQueue(mockCtx, {});
      expect(result.data[0].urgencyState).toBe('AMBER');
    });

    it('should compute RED for tickets past red threshold', async () => {
      const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
      prisma.kdsTicket.findMany.mockResolvedValue([
        {
          id: 'ticket-1',
          orderId: 'o1',
          station: 'KITCHEN',
          status: 'QUEUED',
          startedAt: twentyMinAgo,
          createdAt: twentyMinAgo,
          readyAt: null,
          recalledAt: null,
          order: {
            id: 'o1',
            orderNumber: 'ORD-001',
            serviceType: 'DINE_IN',
            tableId: null,
            notes: null,
            table: null,
          },
          items: [],
        },
      ]);
      prisma.kdsTicket.count.mockResolvedValue(1);
      prisma.kdsSlaConfig.findMany.mockResolvedValue([]);

      const result = await service.getQueue(mockCtx, {});
      expect(result.data[0].urgencyState).toBe('RED');
    });
  });
});
