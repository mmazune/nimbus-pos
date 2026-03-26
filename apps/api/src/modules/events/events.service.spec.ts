import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: any;
  let audit: any;

  const ctx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
  };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      event: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      eventTicketClass: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      eventBooking: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      eventTicket: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      eventCheckIn: {
        create: jest.fn(),
      },
      eventAuditLog: {
        create: jest.fn(),
      },
      table: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  // ── Create Event ──

  it('should create an event in DRAFT status', async () => {
    prisma.event.findFirst.mockResolvedValueOnce(null); // number gen
    prisma.event.create.mockResolvedValue({
      id: 'evt-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      eventNumber: 'EVT-000001',
      title: 'Jazz Night',
      status: 'DRAFT',
      capacity: 100,
      soldCount: 0,
      ticketClasses: [],
      venueTable: null,
    });
    prisma.eventAuditLog.create.mockResolvedValue({});

    const result = await service.createEvent(
      'user-1',
      ctx,
      {
        title: 'Jazz Night',
        startsAt: '2026-07-01T20:00:00Z',
        capacity: 100,
      },
      meta,
    );

    expect(result.eventNumber).toBe('EVT-000001');
    expect(result.status).toBe('DRAFT');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'EVENT_CREATED' }));
  });

  // ── Publish Event ──

  it('should publish a DRAFT event', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'evt-1',
      status: 'DRAFT',
      eventNumber: 'EVT-000001',
      title: 'Jazz Night',
      ticketClasses: [],
      venueTable: null,
      bookings: [],
    });
    prisma.event.update.mockResolvedValue({
      id: 'evt-1',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      portalKey: 'abc123',
      slug: 'jazz-night',
      ticketClasses: [],
      venueTable: null,
    });
    prisma.eventAuditLog.create.mockResolvedValue({});

    const result = await service.publishEvent('evt-1', 'user-1', ctx, {}, meta);

    expect(result.status).toBe('PUBLISHED');
    expect(result.portalKey).toBeTruthy();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'EVENT_PUBLISHED' }));
  });

  it('should reject publishing a non-DRAFT event', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'evt-1',
      status: 'CLOSED',
      eventNumber: 'EVT-000001',
      ticketClasses: [],
      venueTable: null,
      bookings: [],
    });

    await expect(service.publishEvent('evt-1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  // ── Ticket Class ──

  it('should create a ticket class within event capacity', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'evt-1',
      status: 'DRAFT',
      capacity: 100,
      eventNumber: 'EVT-000001',
      ticketClasses: [],
      venueTable: null,
      bookings: [],
    });
    prisma.eventTicketClass.aggregate.mockResolvedValue({ _sum: { capacity: 30 } });
    prisma.eventTicketClass.create.mockResolvedValue({
      id: 'tc-1',
      name: 'VIP',
      type: 'VIP',
      price: new Decimal(50),
      capacity: 20,
      soldCount: 0,
    });
    prisma.eventAuditLog.create.mockResolvedValue({});

    const result = await service.createTicketClass(
      'evt-1',
      'user-1',
      ctx,
      {
        name: 'VIP',
        type: 'VIP',
        price: 50,
        capacity: 20,
      },
      meta,
    );

    expect(result.name).toBe('VIP');
    expect(result.capacity).toBe(20);
  });

  it('should reject ticket class exceeding event capacity', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'evt-1',
      status: 'DRAFT',
      capacity: 100,
      eventNumber: 'EVT-000001',
      ticketClasses: [],
      venueTable: null,
      bookings: [],
    });
    prisma.eventTicketClass.aggregate.mockResolvedValue({ _sum: { capacity: 90 } });

    await expect(
      service.createTicketClass(
        'evt-1',
        'user-1',
        ctx,
        {
          name: 'Overflow',
          price: 10,
          capacity: 20,
        },
        meta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Create Booking ──

  it('should create a booking and update sold counts', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'evt-1',
      status: 'OPEN',
      capacity: 100,
      soldCount: 10,
      eventNumber: 'EVT-000001',
      bookingOpensAt: null,
      bookingClosesAt: null,
      ticketClasses: [],
      venueTable: null,
      bookings: [],
    });
    prisma.eventTicketClass.findFirst.mockResolvedValue({
      id: 'tc-1',
      eventId: 'evt-1',
      branchId: 'branch-1',
      active: true,
      price: new Decimal(25),
      capacity: 50,
      soldCount: 5,
    });
    prisma.eventBooking.findFirst.mockResolvedValueOnce(null); // number gen
    prisma.eventBooking.create.mockResolvedValue({
      id: 'bkg-1',
      bookingNumber: 'BKG-000001',
      status: 'CONFIRMED',
      quantity: 2,
      subtotal: new Decimal(50),
      ticketClass: { name: 'General' },
      event: { title: 'Jazz Night' },
    });
    prisma.eventTicketClass.update.mockResolvedValue({});
    prisma.event.update.mockResolvedValue({});
    prisma.eventAuditLog.create.mockResolvedValue({});

    const result = await service.createBooking(
      'evt-1',
      'user-1',
      ctx,
      {
        ticketClassId: 'tc-1',
        customerName: 'Jane Doe',
        quantity: 2,
      },
      meta,
    );

    expect(result.bookingNumber).toBe('BKG-000001');
    expect(result.status).toBe('CONFIRMED');
    expect(prisma.eventTicketClass.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { soldCount: { increment: 2 } },
      }),
    );
  });

  it('should reject booking when booking window not open', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    prisma.event.findFirst.mockResolvedValue({
      id: 'evt-1',
      status: 'OPEN',
      capacity: 100,
      soldCount: 0,
      bookingOpensAt: new Date(futureDate),
      bookingClosesAt: null,
      ticketClasses: [],
      venueTable: null,
      bookings: [],
    });

    await expect(
      service.createBooking(
        'evt-1',
        'user-1',
        ctx,
        {
          ticketClassId: 'tc-1',
          customerName: 'Test',
          quantity: 1,
        },
        meta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject booking when capacity exceeded', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'evt-1',
      status: 'OPEN',
      capacity: 100,
      soldCount: 99,
      bookingOpensAt: null,
      bookingClosesAt: null,
      ticketClasses: [],
      venueTable: null,
      bookings: [],
    });
    prisma.eventTicketClass.findFirst.mockResolvedValue({
      id: 'tc-1',
      eventId: 'evt-1',
      branchId: 'branch-1',
      active: true,
      price: new Decimal(25),
      capacity: 50,
      soldCount: 5,
    });

    await expect(
      service.createBooking(
        'evt-1',
        'user-1',
        ctx,
        {
          ticketClassId: 'tc-1',
          customerName: 'Test',
          quantity: 5,
        },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ── Issue Tickets ──

  it('should issue tickets for a confirmed booking', async () => {
    prisma.eventBooking.findFirst.mockResolvedValue({
      id: 'bkg-1',
      status: 'CONFIRMED',
      quantity: 2,
      eventId: 'evt-1',
      ticketClassId: 'tc-1',
      bookingNumber: 'BKG-000001',
      customerName: 'Jane Doe',
      customerPhone: null,
      ticketClass: {},
      tickets: [],
      event: {},
    });
    prisma.eventTicket.count.mockResolvedValue(0);
    prisma.eventTicket.findFirst.mockResolvedValueOnce(null); // first ticket number gen
    prisma.eventTicket.findFirst.mockResolvedValueOnce({ ticketNumber: 'TKT-000001' }); // second
    prisma.eventTicket.create
      .mockResolvedValueOnce({ id: 'tkt-1', ticketNumber: 'TKT-000001', status: 'ISSUED' })
      .mockResolvedValueOnce({ id: 'tkt-2', ticketNumber: 'TKT-000002', status: 'ISSUED' });
    prisma.eventAuditLog.create.mockResolvedValue({});

    const result = await service.issueTickets('bkg-1', 'user-1', ctx, {}, meta);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('ISSUED');
  });

  it('should reject duplicate ticket issuance', async () => {
    prisma.eventBooking.findFirst.mockResolvedValue({
      id: 'bkg-1',
      status: 'CONFIRMED',
      quantity: 2,
      eventId: 'evt-1',
      ticketClassId: 'tc-1',
      bookingNumber: 'BKG-000001',
      ticketClass: {},
      tickets: [],
      event: {},
    });
    prisma.eventTicket.count.mockResolvedValue(2); // already issued

    await expect(service.issueTickets('bkg-1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  // ── Check-In ──

  it('should check in a valid ticket', async () => {
    prisma.eventTicket.findFirst.mockResolvedValue({
      id: 'tkt-1',
      status: 'ISSUED',
      eventId: 'evt-1',
      bookingId: 'bkg-1',
      ticketNumber: 'TKT-000001',
      booking: { id: 'bkg-1' },
    });
    prisma.eventTicket.update.mockResolvedValue({
      id: 'tkt-1',
      status: 'CHECKED_IN',
      checkedInAt: new Date(),
    });
    prisma.event.update.mockResolvedValue({});
    prisma.eventTicket.findMany.mockResolvedValue([{ status: 'CHECKED_IN' }]);
    prisma.eventBooking.update.mockResolvedValue({});
    prisma.eventCheckIn.create.mockResolvedValue({});
    prisma.eventAuditLog.create.mockResolvedValue({});

    const result = await service.checkInTicket('tkt-1', 'user-1', ctx, {}, meta);

    expect(result.status).toBe('CHECKED_IN');
    expect(prisma.eventCheckIn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCESS' }),
      }),
    );
  });

  it('should reject duplicate check-in', async () => {
    prisma.eventTicket.findFirst.mockResolvedValue({
      id: 'tkt-1',
      status: 'CHECKED_IN',
      eventId: 'evt-1',
      bookingId: 'bkg-1',
      ticketNumber: 'TKT-000001',
      booking: {},
    });
    prisma.eventCheckIn.create.mockResolvedValue({});

    await expect(service.checkInTicket('tkt-1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      ConflictException,
    );

    expect(prisma.eventCheckIn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DUPLICATE' }),
      }),
    );
  });

  // ── Cancel Booking ──

  it('should cancel a booking and decrement sold counts', async () => {
    prisma.eventBooking.findFirst
      .mockResolvedValueOnce({
        id: 'bkg-1',
        status: 'CONFIRMED',
        eventId: 'evt-1',
        ticketClassId: 'tc-1',
        quantity: 2,
        bookingNumber: 'BKG-000001',
        ticketClass: {},
        tickets: [],
        event: {},
      })
      .mockResolvedValueOnce({
        id: 'bkg-1',
        status: 'CANCELLED',
        cancelledAt: new Date(),
        eventId: 'evt-1',
        ticketClassId: 'tc-1',
        quantity: 2,
        bookingNumber: 'BKG-000001',
        ticketClass: {},
        tickets: [],
        event: {},
      });
    prisma.eventBooking.update.mockResolvedValue({});
    prisma.eventTicketClass.update.mockResolvedValue({});
    prisma.event.update.mockResolvedValue({});
    prisma.eventTicket.updateMany.mockResolvedValue({ count: 0 });
    prisma.eventAuditLog.create.mockResolvedValue({});

    const result = await service.cancelBooking(
      'bkg-1',
      'user-1',
      ctx,
      { reason: 'Changed plans' },
      meta,
    );

    expect(result.status).toBe('CANCELLED');
    expect(prisma.eventTicketClass.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { soldCount: { decrement: 2 } },
      }),
    );
  });

  it('should reject cancelling an already cancelled booking', async () => {
    prisma.eventBooking.findFirst.mockResolvedValue({
      id: 'bkg-1',
      status: 'CANCELLED',
      ticketClass: {},
      tickets: [],
      event: {},
    });

    await expect(service.cancelBooking('bkg-1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  // ── Branch Isolation ──

  it('should not find an event from another branch', async () => {
    prisma.event.findFirst.mockResolvedValue(null);

    await expect(service.findEventById('evt-other', ctx)).rejects.toThrow(NotFoundException);
  });

  // ── Close Event ──

  it('should close an OPEN event', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'evt-1',
      status: 'OPEN',
      eventNumber: 'EVT-000001',
      ticketClasses: [],
      venueTable: null,
      bookings: [],
    });
    prisma.event.update.mockResolvedValue({
      id: 'evt-1',
      status: 'CLOSED',
      completedAt: new Date(),
      ticketClasses: [],
      venueTable: null,
    });
    prisma.eventAuditLog.create.mockResolvedValue({});

    const result = await service.closeEvent('evt-1', 'user-1', ctx, { reason: 'Sold out' }, meta);

    expect(result.status).toBe('CLOSED');
  });

  // ── Update Event ──

  it('should reject updating a non-DRAFT event', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'evt-1',
      status: 'PUBLISHED',
      ticketClasses: [],
      venueTable: null,
      bookings: [],
    });

    await expect(
      service.updateEvent('evt-1', 'user-1', ctx, { title: 'New Title' }, meta),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Portal ──

  it('should return portal-safe event data for a valid portalKey', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      title: 'Jazz Night',
      slug: 'jazz-night',
      description: 'A night of jazz',
      startsAt: new Date(),
      endsAt: null,
      bookingOpensAt: null,
      bookingClosesAt: null,
      status: 'PUBLISHED',
      capacity: 100,
      soldCount: 10,
      venueNotes: 'Main Hall',
      ticketClasses: [
        {
          id: 'tc-1',
          name: 'General',
          type: 'GENERAL',
          price: new Decimal(25),
          capacity: 80,
          soldCount: 10,
        },
      ],
    });

    const result = await service.findByPortalKey('abc123');

    expect(result.title).toBe('Jazz Night');
    expect(result.ticketClasses[0].available).toBe(70);
    // Should not expose orgId or branchId
    expect((result as any).orgId).toBeUndefined();
    expect((result as any).branchId).toBeUndefined();
  });

  it('should return 404 for non-public portal event', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'DRAFT',
      ticketClasses: [],
    });

    await expect(service.findByPortalKey('xyz')).rejects.toThrow(NotFoundException);
  });
});
