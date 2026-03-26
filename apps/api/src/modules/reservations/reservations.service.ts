import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ReservationStatus,
  ReservationSource,
  ReservationDepositStatus,
  ReservationEventType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  CreateReservationDto,
  ConfirmReservationDto,
  SeatReservationDto,
  CancelReservationDto,
  MarkNoShowDto,
  RecordDepositDto,
  ListReservationsQueryDto,
  AssignTableDto,
} from './dto';

interface BranchContext {
  branchId: string;
  organizationId: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// ── State Machine ──

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['SEATED', 'CANCELLED', 'NO_SHOW'],
  SEATED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Number Generation ──

  private async generateReservationNumber(branchId: string): Promise<string> {
    const last = await this.prisma.reservation.findFirst({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      select: { reservationNumber: true },
    });

    let nextSeq = 1;
    if (last?.reservationNumber) {
      const match = last.reservationNumber.match(/RES-(\d+)/);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }

    return `RES-${String(nextSeq).padStart(6, '0')}`;
  }

  // ── Create ──

  async create(userId: string, ctx: BranchContext, dto: CreateReservationDto, meta: RequestMeta) {
    // Validate table if provided
    if (dto.tableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.tableId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!table) throw new NotFoundException('Table not found in this branch');

      // Check for overlapping reservation on same table
      await this.checkTableConflict(
        ctx.branchId,
        dto.tableId,
        new Date(dto.reservationAt),
        dto.expectedDurationMinutes,
      );
    }

    const reservationNumber = await this.generateReservationNumber(ctx.branchId);

    const reservation = await this.prisma.reservation.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reservationNumber,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone || null,
        customerEmail: dto.customerEmail || null,
        partySize: dto.partySize,
        reservationAt: new Date(dto.reservationAt),
        expectedDurationMinutes: dto.expectedDurationMinutes || null,
        source: (dto.source as ReservationSource) || ReservationSource.MANUAL,
        status: ReservationStatus.PENDING,
        notes: dto.notes || null,
        specialRequests: dto.specialRequests || null,
        tableId: dto.tableId || null,
        depositRequired: dto.depositRequired != null ? new Decimal(dto.depositRequired) : null,
        createdById: userId,
      },
      include: { table: true, deposits: true, events: true },
    });

    // Record creation event
    await this.prisma.reservationEvent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reservationId: reservation.id,
        type: ReservationEventType.CREATED,
        actorUserId: userId,
        message: `Reservation ${reservationNumber} created for ${dto.customerName} (party of ${dto.partySize})`,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'RESERVATION_CREATED',
      entityType: 'Reservation',
      entityId: reservation.id,
      metadata: { reservationNumber, customerName: dto.customerName, partySize: dto.partySize },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return reservation;
  }

  // ── Confirm ──

  async confirm(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: ConfirmReservationDto,
    meta: RequestMeta,
  ) {
    const reservation = await this.findOneOrFail(id, ctx);
    this.assertTransition(reservation.status, ReservationStatus.CONFIRMED);

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CONFIRMED,
        confirmedAt: new Date(),
        updatedById: userId,
        notes: dto.notes ?? reservation.notes,
      },
      include: { table: true, deposits: true, events: true },
    });

    await this.prisma.reservationEvent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reservationId: id,
        type: ReservationEventType.CONFIRMED,
        actorUserId: userId,
        message: 'Reservation confirmed',
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'RESERVATION_CONFIRMED',
      entityType: 'Reservation',
      entityId: id,
      metadata: { reservationNumber: reservation.reservationNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Seat ──

  async seat(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: SeatReservationDto,
    meta: RequestMeta,
  ) {
    const reservation = await this.findOneOrFail(id, ctx);
    this.assertTransition(reservation.status, ReservationStatus.SEATED);

    const seatTableId = dto.tableId || reservation.tableId;
    if (!seatTableId) {
      throw new BadRequestException('A table must be assigned before seating');
    }

    // Validate table belongs to branch
    const table = await this.prisma.table.findFirst({
      where: { id: seatTableId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!table) throw new NotFoundException('Table not found in this branch');

    let seatedOrderId: string | null = null;

    if (dto.createOrder) {
      // Create a new DINE_IN order linked to this reservation
      const orderNumber = await this.generateOrderNumber(ctx.branchId);
      const order = await this.prisma.order.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          userId,
          tableId: seatTableId,
          orderNumber,
          serviceType: 'DINE_IN',
          status: 'NEW',
          notes: dto.orderNotes || null,
        },
      });
      seatedOrderId = order.id;
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.SEATED,
        seatedAt: new Date(),
        tableId: seatTableId,
        seatedOrderId,
        updatedById: userId,
      },
      include: { table: true, deposits: true, events: true, seatedOrder: true },
    });

    await this.prisma.reservationEvent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reservationId: id,
        type: ReservationEventType.SEATED,
        actorUserId: userId,
        message: `Party seated at table ${table.label}${seatedOrderId ? ' — order created' : ''}`,
        metadata: seatedOrderId ? { orderId: seatedOrderId } : undefined,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'RESERVATION_SEATED',
      entityType: 'Reservation',
      entityId: id,
      metadata: {
        reservationNumber: reservation.reservationNumber,
        tableId: seatTableId,
        seatedOrderId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Cancel ──

  async cancel(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: CancelReservationDto,
    meta: RequestMeta,
  ) {
    const reservation = await this.findOneOrFail(id, ctx);
    this.assertTransition(reservation.status, ReservationStatus.CANCELLED);

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedById: userId,
      },
      include: { table: true, deposits: true, events: true },
    });

    // Handle deposit outcome
    if (dto.depositOutcome && dto.depositOutcome !== 'NO_DEPOSIT') {
      await this.handleDepositOutcome(id, ctx, dto.depositOutcome);
    }

    await this.prisma.reservationEvent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reservationId: id,
        type: ReservationEventType.CANCELLED,
        actorUserId: userId,
        message: `Cancelled: ${dto.reason}`,
        metadata: dto.depositOutcome ? { depositOutcome: dto.depositOutcome } : undefined,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'RESERVATION_CANCELLED',
      entityType: 'Reservation',
      entityId: id,
      metadata: {
        reservationNumber: reservation.reservationNumber,
        reason: dto.reason,
        depositOutcome: dto.depositOutcome,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── No-Show ──

  async markNoShow(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: MarkNoShowDto,
    meta: RequestMeta,
  ) {
    const reservation = await this.findOneOrFail(id, ctx);
    this.assertTransition(reservation.status, ReservationStatus.NO_SHOW);

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.NO_SHOW,
        noShowAt: new Date(),
        updatedById: userId,
      },
      include: { table: true, deposits: true, events: true },
    });

    // Handle deposit outcome
    if (dto.depositOutcome && dto.depositOutcome !== 'NO_DEPOSIT') {
      await this.handleDepositOutcome(id, ctx, dto.depositOutcome);
    }

    await this.prisma.reservationEvent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reservationId: id,
        type: ReservationEventType.NO_SHOW,
        actorUserId: userId,
        message: dto.reason ? `No-show: ${dto.reason}` : 'Marked as no-show',
        metadata: dto.depositOutcome ? { depositOutcome: dto.depositOutcome } : undefined,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'RESERVATION_NO_SHOW',
      entityType: 'Reservation',
      entityId: id,
      metadata: {
        reservationNumber: reservation.reservationNumber,
        depositOutcome: dto.depositOutcome,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Record Deposit ──

  async recordDeposit(
    reservationId: string,
    userId: string,
    ctx: BranchContext,
    dto: RecordDepositDto,
    meta: RequestMeta,
  ) {
    const reservation = await this.findOneOrFail(reservationId, ctx);

    if (
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.NO_SHOW
    ) {
      throw new BadRequestException('Cannot record deposit for a cancelled or no-show reservation');
    }

    const deposit = await this.prisma.reservationDeposit.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reservationId,
        amount: new Decimal(dto.amount),
        status: ReservationDepositStatus.RECEIVED,
        method: dto.method || null,
        reference: dto.reference || null,
        paymentId: dto.paymentId || null,
        recordedById: userId,
        notes: dto.notes || null,
      },
    });

    await this.prisma.reservationEvent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reservationId,
        type: ReservationEventType.DEPOSIT_RECORDED,
        actorUserId: userId,
        message: `Deposit of ${dto.amount} recorded${dto.method ? ` via ${dto.method}` : ''}`,
        metadata: { depositId: deposit.id, amount: dto.amount },
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'RESERVATION_DEPOSIT_RECORDED',
      entityType: 'ReservationDeposit',
      entityId: deposit.id,
      metadata: { reservationId, amount: dto.amount, method: dto.method },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return deposit;
  }

  // ── Assign Table ──

  async assignTable(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: AssignTableDto,
    meta: RequestMeta,
  ) {
    const reservation = await this.findOneOrFail(id, ctx);

    if (
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.NO_SHOW ||
      reservation.status === ReservationStatus.COMPLETED
    ) {
      throw new BadRequestException('Cannot assign table to a finished reservation');
    }

    const table = await this.prisma.table.findFirst({
      where: { id: dto.tableId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!table) throw new NotFoundException('Table not found in this branch');

    // Check for overlapping reservations on this table
    await this.checkTableConflict(
      ctx.branchId,
      dto.tableId,
      reservation.reservationAt,
      reservation.expectedDurationMinutes,
      id,
    );

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: { tableId: dto.tableId, updatedById: userId },
      include: { table: true, deposits: true, events: true },
    });

    await this.prisma.reservationEvent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reservationId: id,
        type: ReservationEventType.TABLE_ASSIGNED,
        actorUserId: userId,
        message: `Table assigned: ${table.label}`,
        metadata: { tableId: dto.tableId },
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'RESERVATION_TABLE_ASSIGNED',
      entityType: 'Reservation',
      entityId: id,
      metadata: { reservationNumber: reservation.reservationNumber, tableId: dto.tableId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Read ──

  async findById(id: string, ctx: BranchContext) {
    return this.findOneOrFail(id, ctx);
  }

  async list(ctx: BranchContext, query: ListReservationsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
    };

    if (query.status) where.status = query.status;
    if (query.tableId) where.tableId = query.tableId;

    if (query.date) {
      const dayStart = new Date(query.date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(query.date);
      dayEnd.setUTCHours(23, 59, 59, 999);
      where.reservationAt = { gte: dayStart, lte: dayEnd };
    }

    if (query.upcoming) {
      where.reservationAt = { gte: new Date() };
      where.status = { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] };
    }

    const [data, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: { table: true, deposits: true },
        orderBy: { reservationAt: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async listUpcoming(ctx: BranchContext) {
    const now = new Date();
    return this.prisma.reservation.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        reservationAt: { gte: now },
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      },
      include: { table: true, deposits: true },
      orderBy: { reservationAt: 'asc' },
      take: 50,
    });
  }

  async getDeposits(reservationId: string, ctx: BranchContext) {
    await this.findOneOrFail(reservationId, ctx);
    return this.prisma.reservationDeposit.findMany({
      where: { reservationId, branchId: ctx.branchId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async getEvents(reservationId: string, ctx: BranchContext) {
    await this.findOneOrFail(reservationId, ctx);
    return this.prisma.reservationEvent.findMany({
      where: { reservationId, branchId: ctx.branchId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Helpers ──

  private async findOneOrFail(id: string, ctx: BranchContext) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { table: true, deposits: true, events: true, seatedOrder: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  private assertTransition(current: string, target: ReservationStatus) {
    const allowed = VALID_TRANSITIONS[current] || [];
    if (!allowed.includes(target)) {
      throw new ConflictException(`Cannot transition from ${current} to ${target}`);
    }
  }

  private async checkTableConflict(
    branchId: string,
    tableId: string,
    reservationAt: Date,
    durationMinutes?: number | null,
    excludeId?: string,
  ) {
    const duration = durationMinutes || 120; // default 2 hours
    const start = new Date(reservationAt);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const where: any = {
      branchId,
      tableId,
      status: {
        in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED],
      },
      // Overlaps: existing.start < new.end AND existing.end > new.start
      reservationAt: { lt: end },
    };

    if (excludeId) where.id = { not: excludeId };

    const conflicts = await this.prisma.reservation.findMany({
      where,
      select: { id: true, reservationAt: true, expectedDurationMinutes: true },
    });

    for (const c of conflicts) {
      const cDuration = c.expectedDurationMinutes || 120;
      const cEnd = new Date(c.reservationAt.getTime() + cDuration * 60 * 1000);
      if (cEnd > start) {
        throw new ConflictException('Table has a conflicting reservation in this time window');
      }
    }
  }

  private async handleDepositOutcome(reservationId: string, ctx: BranchContext, outcome: string) {
    const newStatus =
      outcome === 'REFUND' ? ReservationDepositStatus.REFUNDED : ReservationDepositStatus.FORFEITED;

    await this.prisma.reservationDeposit.updateMany({
      where: {
        reservationId,
        branchId: ctx.branchId,
        status: ReservationDepositStatus.RECEIVED,
      },
      data: { status: newStatus },
    });
  }

  private async generateOrderNumber(branchId: string): Promise<string> {
    const lastOrder = await this.prisma.order.findFirst({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });

    let nextSeq = 1;
    if (lastOrder?.orderNumber) {
      const match = lastOrder.orderNumber.match(/ORD-(\d+)/);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }

    return `ORD-${String(nextSeq).padStart(6, '0')}`;
  }
}
