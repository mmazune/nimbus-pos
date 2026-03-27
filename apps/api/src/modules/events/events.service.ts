import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  EventStatus,
  EventBookingStatus,
  TicketStatus,
  TicketClassType,
  CheckInStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  CreateEventDto,
  UpdateEventDto,
  PublishEventDto,
  OpenEventDto,
  CloseEventDto,
  CreateTicketClassDto,
  CreateBookingDto,
  CancelBookingDto,
  IssueTicketsDto,
  CheckInTicketDto,
  ListEventsQueryDto,
} from './dto';
import { randomBytes } from 'crypto';

interface BranchContext {
  branchId: string;
  organizationId: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// ── Event State Machine ──

const EVENT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) { }

  // ── Number Generators ──

  private async generateEventNumber(branchId: string): Promise<string> {
    const last = await this.prisma.event.findFirst({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      select: { eventNumber: true },
    });
    let seq = 1;
    if (last?.eventNumber) {
      const m = last.eventNumber.match(/EVT-(\d+)/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    return `EVT-${String(seq).padStart(6, '0')}`;
  }

  private async generateBookingNumber(branchId: string): Promise<string> {
    const last = await this.prisma.eventBooking.findFirst({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      select: { bookingNumber: true },
    });
    let seq = 1;
    if (last?.bookingNumber) {
      const m = last.bookingNumber.match(/BKG-(\d+)/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    return `BKG-${String(seq).padStart(6, '0')}`;
  }

  private async generateTicketNumber(branchId: string): Promise<string> {
    const last = await this.prisma.eventTicket.findFirst({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      select: { ticketNumber: true },
    });
    let seq = 1;
    if (last?.ticketNumber) {
      const m = last.ticketNumber.match(/TKT-(\d+)/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    return `TKT-${String(seq).padStart(6, '0')}`;
  }

  private generateQrToken(): string {
    return randomBytes(24).toString('hex');
  }

  private generatePortalKey(): string {
    return randomBytes(12).toString('hex');
  }

  // ── Create Event ──

  async createEvent(userId: string, ctx: BranchContext, dto: CreateEventDto, meta: RequestMeta) {
    if (dto.venueTableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.venueTableId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!table) throw new NotFoundException('Table not found in this branch');
    }

    const eventNumber = await this.generateEventNumber(ctx.branchId);

    const event = await this.prisma.event.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        eventNumber,
        title: dto.title,
        description: dto.description || null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        bookingOpensAt: dto.bookingOpensAt ? new Date(dto.bookingOpensAt) : null,
        bookingClosesAt: dto.bookingClosesAt ? new Date(dto.bookingClosesAt) : null,
        capacity: dto.capacity,
        status: EventStatus.DRAFT,
        venueTableId: dto.venueTableId || null,
        venueNotes: dto.venueNotes || null,
        createdById: userId,
      },
      include: { ticketClasses: true, venueTable: true },
    });

    await this.logEventAudit(
      ctx,
      event.id,
      null,
      null,
      'EVENT_CREATED',
      userId,
      `Event ${eventNumber} created: "${dto.title}"`,
    );

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_CREATED',
      entityType: 'Event',
      entityId: event.id,
      metadata: { eventNumber, title: dto.title },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return event;
  }

  // ── Update Event ──

  async updateEvent(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateEventDto,
    meta: RequestMeta,
  ) {
    const event = await this.findEventOrFail(id, ctx);

    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT events can be edited');
    }

    if (dto.venueTableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.venueTableId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!table) throw new NotFoundException('Table not found in this branch');
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        bookingOpensAt: dto.bookingOpensAt ? new Date(dto.bookingOpensAt) : undefined,
        bookingClosesAt: dto.bookingClosesAt ? new Date(dto.bookingClosesAt) : undefined,
        capacity: dto.capacity,
        venueTableId: dto.venueTableId,
        venueNotes: dto.venueNotes,
        updatedById: userId,
      },
      include: { ticketClasses: true, venueTable: true },
    });

    await this.logEventAudit(ctx, id, null, null, 'EVENT_UPDATED', userId, 'Event details updated');

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_UPDATED',
      entityType: 'Event',
      entityId: id,
      metadata: { eventNumber: event.eventNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Publish Event ──

  async publishEvent(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: PublishEventDto,
    meta: RequestMeta,
  ) {
    const event = await this.findEventOrFail(id, ctx);
    this.assertEventTransition(event.status, EventStatus.PUBLISHED);

    const portalKey = this.generatePortalKey();
    const slug =
      dto.slug ||
      event.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        status: EventStatus.PUBLISHED,
        publishedAt: new Date(),
        portalKey,
        slug,
        updatedById: userId,
      },
      include: { ticketClasses: true, venueTable: true },
    });

    await this.logEventAudit(
      ctx,
      id,
      null,
      null,
      'EVENT_PUBLISHED',
      userId,
      `Event published with portal key ${portalKey}`,
    );

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_PUBLISHED',
      entityType: 'Event',
      entityId: id,
      metadata: { eventNumber: event.eventNumber, portalKey },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Open Event ──

  async openEvent(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: OpenEventDto,
    meta: RequestMeta,
  ) {
    const event = await this.findEventOrFail(id, ctx);
    this.assertEventTransition(event.status, EventStatus.OPEN);

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        status: EventStatus.OPEN,
        updatedById: userId,
      },
      include: { ticketClasses: true, venueTable: true },
    });

    await this.logEventAudit(
      ctx,
      id,
      null,
      null,
      'EVENT_OPENED',
      userId,
      dto.reason ? `Event opened: ${dto.reason}` : 'Event opened — doors open',
    );

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_OPENED',
      entityType: 'Event',
      entityId: id,
      metadata: { eventNumber: event.eventNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Close Event ──

  async closeEvent(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: CloseEventDto,
    meta: RequestMeta,
  ) {
    const event = await this.findEventOrFail(id, ctx);
    this.assertEventTransition(event.status, EventStatus.CLOSED);

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        status: EventStatus.CLOSED,
        completedAt: new Date(),
        updatedById: userId,
      },
      include: { ticketClasses: true, venueTable: true },
    });

    await this.logEventAudit(
      ctx,
      id,
      null,
      null,
      'EVENT_CLOSED',
      userId,
      dto.reason ? `Event closed: ${dto.reason}` : 'Event closed',
    );

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_CLOSED',
      entityType: 'Event',
      entityId: id,
      metadata: { eventNumber: event.eventNumber, reason: dto.reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Ticket Classes ──

  async createTicketClass(
    eventId: string,
    userId: string,
    ctx: BranchContext,
    dto: CreateTicketClassDto,
    meta: RequestMeta,
  ) {
    const event = await this.findEventOrFail(eventId, ctx);

    // Sum of all ticket class capacities must not exceed event capacity
    const existingCapacity = await this.prisma.eventTicketClass.aggregate({
      where: { eventId },
      _sum: { capacity: true },
    });
    const totalAfter = (existingCapacity._sum.capacity || 0) + dto.capacity;
    if (totalAfter > event.capacity) {
      throw new BadRequestException(
        `Ticket class capacity would exceed event capacity (${totalAfter} > ${event.capacity})`,
      );
    }

    const ticketClass = await this.prisma.eventTicketClass.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        eventId,
        name: dto.name,
        type: (dto.type as TicketClassType) || TicketClassType.GENERAL,
        price: new Decimal(dto.price),
        capacity: dto.capacity,
        sortOrder: dto.sortOrder || 0,
        notes: dto.notes || null,
      },
    });

    await this.logEventAudit(
      ctx,
      eventId,
      null,
      null,
      'TICKET_CLASS_CREATED',
      userId,
      `Ticket class "${dto.name}" created (capacity: ${dto.capacity}, price: ${dto.price})`,
    );

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_TICKET_CLASS_CREATED',
      entityType: 'EventTicketClass',
      entityId: ticketClass.id,
      metadata: { eventId, name: dto.name, capacity: dto.capacity, price: dto.price },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ticketClass;
  }

  async listTicketClasses(eventId: string, ctx: BranchContext) {
    await this.findEventOrFail(eventId, ctx);
    return this.prisma.eventTicketClass.findMany({
      where: { eventId, branchId: ctx.branchId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── Bookings ──

  async createBooking(
    eventId: string,
    userId: string,
    ctx: BranchContext,
    dto: CreateBookingDto,
    meta: RequestMeta,
  ) {
    const event = await this.findEventOrFail(eventId, ctx);

    // Verify event allows bookings
    if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.OPEN) {
      throw new BadRequestException('Event is not open for bookings');
    }

    // Check booking window
    const now = new Date();
    if (event.bookingOpensAt && now < event.bookingOpensAt) {
      throw new BadRequestException('Booking window has not opened yet');
    }
    if (event.bookingClosesAt && now > event.bookingClosesAt) {
      throw new BadRequestException('Booking window has closed');
    }

    // Verify ticket class
    const ticketClass = await this.prisma.eventTicketClass.findFirst({
      where: { id: dto.ticketClassId, eventId, branchId: ctx.branchId, active: true },
    });
    if (!ticketClass) throw new NotFoundException('Ticket class not found or inactive');

    // Check ticket class availability
    if (ticketClass.soldCount + dto.quantity > ticketClass.capacity) {
      throw new ConflictException(
        `Not enough tickets available (remaining: ${ticketClass.capacity - ticketClass.soldCount})`,
      );
    }

    // Check event-level capacity
    if (event.soldCount + dto.quantity > event.capacity) {
      throw new ConflictException(
        `Event capacity exceeded (remaining: ${event.capacity - event.soldCount})`,
      );
    }

    const bookingNumber = await this.generateBookingNumber(ctx.branchId);
    const subtotal = ticketClass.price.mul(dto.quantity);

    // Use transaction for atomic capacity update
    const booking = await this.prisma.$transaction(async (tx) => {
      const b = await tx.eventBooking.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          eventId,
          ticketClassId: dto.ticketClassId,
          bookingNumber,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone || null,
          customerEmail: dto.customerEmail || null,
          quantity: dto.quantity,
          subtotal,
          depositAmount: dto.depositAmount != null ? new Decimal(dto.depositAmount) : null,
          paymentId: dto.paymentId || null,
          reservationId: dto.reservationId || null,
          status: EventBookingStatus.CONFIRMED,
          confirmedAt: new Date(),
          bookedById: userId,
          notes: dto.notes || null,
        },
        include: { ticketClass: true, event: true },
      });

      // Update sold counts atomically
      await tx.eventTicketClass.update({
        where: { id: dto.ticketClassId },
        data: { soldCount: { increment: dto.quantity } },
      });

      await tx.event.update({
        where: { id: eventId },
        data: { soldCount: { increment: dto.quantity } },
      });

      return b;
    });

    await this.logEventAudit(
      ctx,
      eventId,
      booking.id,
      null,
      'BOOKING_CREATED',
      userId,
      `Booking ${bookingNumber} created for ${dto.customerName} (${dto.quantity} × ${ticketClass.name})`,
    );

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_BOOKING_CREATED',
      entityType: 'EventBooking',
      entityId: booking.id,
      metadata: { eventId, bookingNumber, quantity: dto.quantity },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return booking;
  }

  async cancelBooking(
    bookingId: string,
    userId: string,
    ctx: BranchContext,
    dto: CancelBookingDto,
    meta: RequestMeta,
  ) {
    const booking = await this.findBookingOrFail(bookingId, ctx);

    if (booking.status === EventBookingStatus.CANCELLED) {
      throw new ConflictException('Booking is already cancelled');
    }
    if (booking.status === EventBookingStatus.CHECKED_IN) {
      throw new BadRequestException('Cannot cancel a checked-in booking');
    }

    // Reverse capacity in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.eventBooking.update({
        where: { id: bookingId },
        data: {
          status: EventBookingStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      await tx.eventTicketClass.update({
        where: { id: booking.ticketClassId },
        data: { soldCount: { decrement: booking.quantity } },
      });

      await tx.event.update({
        where: { id: booking.eventId },
        data: { soldCount: { decrement: booking.quantity } },
      });

      // Cancel any issued tickets
      await tx.eventTicket.updateMany({
        where: { bookingId, status: TicketStatus.ISSUED },
        data: { status: TicketStatus.CANCELLED, cancelledAt: new Date() },
      });
    });

    await this.logEventAudit(
      ctx,
      booking.eventId,
      bookingId,
      null,
      'BOOKING_CANCELLED',
      userId,
      dto.reason ? `Booking cancelled: ${dto.reason}` : 'Booking cancelled',
    );

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_BOOKING_CANCELLED',
      entityType: 'EventBooking',
      entityId: bookingId,
      metadata: {
        eventId: booking.eventId,
        bookingNumber: booking.bookingNumber,
        reason: dto.reason,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.findBookingOrFail(bookingId, ctx);
  }

  async listBookings(eventId: string, ctx: BranchContext) {
    await this.findEventOrFail(eventId, ctx);
    return this.prisma.eventBooking.findMany({
      where: { eventId, branchId: ctx.branchId },
      include: { ticketClass: true, tickets: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBookingById(bookingId: string, ctx: BranchContext) {
    return this.findBookingOrFail(bookingId, ctx);
  }

  // ── Tickets ──

  async issueTickets(
    bookingId: string,
    userId: string,
    ctx: BranchContext,
    dto: IssueTicketsDto,
    meta: RequestMeta,
  ) {
    const booking = await this.findBookingOrFail(bookingId, ctx);

    if (booking.status !== EventBookingStatus.CONFIRMED) {
      throw new BadRequestException('Tickets can only be issued for confirmed bookings');
    }

    // Check if tickets already issued
    const existingCount = await this.prisma.eventTicket.count({
      where: { bookingId, status: { not: TicketStatus.CANCELLED } },
    });
    if (existingCount >= booking.quantity) {
      throw new ConflictException('All tickets have already been issued for this booking');
    }

    const remaining = booking.quantity - existingCount;
    const tickets = [];

    for (let i = 0; i < remaining; i++) {
      const ticketNumber = await this.generateTicketNumber(ctx.branchId);
      const qrToken = this.generateQrToken();

      const ticket = await this.prisma.eventTicket.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          eventId: booking.eventId,
          bookingId,
          ticketClassId: booking.ticketClassId,
          ticketNumber,
          holderName: dto.holderName || booking.customerName,
          holderPhone: dto.holderPhone || booking.customerPhone,
          status: TicketStatus.ISSUED,
          qrToken,
        },
      });
      tickets.push(ticket);
    }

    await this.logEventAudit(
      ctx,
      booking.eventId,
      bookingId,
      null,
      'TICKETS_ISSUED',
      userId,
      `${remaining} ticket(s) issued for booking ${booking.bookingNumber}`,
    );

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_TICKETS_ISSUED',
      entityType: 'EventBooking',
      entityId: bookingId,
      metadata: { eventId: booking.eventId, count: remaining, ticketIds: tickets.map((t) => t.id) },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tickets;
  }

  // ── Check-In ──

  async checkInTicket(
    ticketId: string,
    userId: string,
    ctx: BranchContext,
    dto: CheckInTicketDto,
    meta: RequestMeta,
  ) {
    const ticket = await this.prisma.eventTicket.findFirst({
      where: { id: ticketId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { booking: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Check if already checked in
    if (ticket.status === TicketStatus.CHECKED_IN) {
      // Log duplicate attempt
      await this.prisma.eventCheckIn.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          eventId: ticket.eventId,
          bookingId: ticket.bookingId,
          ticketId: ticket.id,
          actorUserId: userId,
          status: CheckInStatus.DUPLICATE,
          message: 'Ticket already checked in',
        },
      });
      throw new ConflictException('Ticket has already been checked in');
    }

    if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.VOIDED) {
      // Log denied attempt
      await this.prisma.eventCheckIn.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          eventId: ticket.eventId,
          bookingId: ticket.bookingId,
          ticketId: ticket.id,
          actorUserId: userId,
          status: CheckInStatus.DENIED,
          message: `Ticket is ${ticket.status}`,
        },
      });
      throw new BadRequestException(`Cannot check in a ${ticket.status} ticket`);
    }

    // Perform check-in in transaction
    const [updatedTicket] = await this.prisma.$transaction(async (tx) => {
      const t = await tx.eventTicket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
      });

      await tx.event.update({
        where: { id: ticket.eventId },
        data: { checkedInCount: { increment: 1 } },
      });

      // Update booking status if all tickets checked in
      const bookingTickets = await tx.eventTicket.findMany({
        where: { bookingId: ticket.bookingId },
        select: { status: true },
      });
      const allCheckedIn = bookingTickets.every((bt) => bt.status === TicketStatus.CHECKED_IN);
      if (allCheckedIn) {
        await tx.eventBooking.update({
          where: { id: ticket.bookingId },
          data: {
            status: EventBookingStatus.CHECKED_IN,
            checkedInAt: new Date(),
          },
        });
      }

      return [t];
    });

    // Log successful check-in
    await this.prisma.eventCheckIn.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        eventId: ticket.eventId,
        bookingId: ticket.bookingId,
        ticketId: ticket.id,
        actorUserId: userId,
        status: CheckInStatus.SUCCESS,
        message: dto.message || null,
      },
    });

    await this.logEventAudit(
      ctx,
      ticket.eventId,
      ticket.bookingId,
      ticketId,
      'TICKET_CHECKED_IN',
      userId,
      `Ticket ${ticket.ticketNumber} checked in`,
    );

    await this.audit.log({
      actorUserId: userId,
      action: 'EVENT_TICKET_CHECKED_IN',
      entityType: 'EventTicket',
      entityId: ticketId,
      metadata: { eventId: ticket.eventId, ticketNumber: ticket.ticketNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updatedTicket;
  }

  // ── Read ──

  async findEventById(id: string, ctx: BranchContext) {
    return this.findEventOrFail(id, ctx);
  }

  async listEvents(ctx: BranchContext, query: ListEventsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
    };

    if (query.status) where.status = query.status;

    if (query.date) {
      const dayStart = new Date(query.date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(query.date);
      dayEnd.setUTCHours(23, 59, 59, 999);
      where.startsAt = { gte: dayStart, lte: dayEnd };
    }

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: { ticketClasses: true, venueTable: true },
        orderBy: { startsAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async listUpcoming(ctx: BranchContext) {
    const now = new Date();
    return this.prisma.event.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        startsAt: { gte: now },
        status: { in: [EventStatus.PUBLISHED, EventStatus.OPEN] },
      },
      include: { ticketClasses: true, venueTable: true },
      orderBy: { startsAt: 'asc' },
      take: 50,
    });
  }

  // ── Portal (public-safe) ──

  async findByPortalKey(portalKey: string) {
    const event = await this.prisma.event.findUnique({
      where: { portalKey },
      include: {
        ticketClasses: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.OPEN) {
      throw new NotFoundException('Event not found');
    }

    // Return portal-safe subset (exclude internal IDs)
    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      bookingOpensAt: event.bookingOpensAt,
      bookingClosesAt: event.bookingClosesAt,
      status: event.status,
      capacity: event.capacity,
      soldCount: event.soldCount,
      venueNotes: event.venueNotes,
      ticketClasses: event.ticketClasses.map((tc) => ({
        id: tc.id,
        name: tc.name,
        type: tc.type,
        price: tc.price,
        capacity: tc.capacity,
        soldCount: tc.soldCount,
        available: tc.capacity - tc.soldCount,
      })),
    };
  }

  // ── Helpers ──

  private async findEventOrFail(id: string, ctx: BranchContext) {
    const event = await this.prisma.event.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { ticketClasses: true, venueTable: true, bookings: { include: { tickets: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async findBookingOrFail(id: string, ctx: BranchContext) {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { ticketClass: true, tickets: true, event: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private assertEventTransition(current: string, target: EventStatus) {
    const allowed = EVENT_TRANSITIONS[current] || [];
    if (!allowed.includes(target)) {
      throw new ConflictException(`Cannot transition event from ${current} to ${target}`);
    }
  }

  private async logEventAudit(
    ctx: BranchContext,
    eventId: string,
    bookingId: string | null,
    ticketId: string | null,
    type: string,
    actorUserId: string,
    message: string,
    metadata?: any,
  ) {
    await this.prisma.eventAuditLog.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        eventId,
        bookingId,
        ticketId,
        type,
        actorUserId,
        message,
        metadata: metadata || undefined,
      },
    });
  }
}
