import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prisma: any;
  let audit: any;

  const ctx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
  };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      reservation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      reservationDeposit: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      reservationEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      table: {
        findFirst: jest.fn(),
      },
      order: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  // ── Create Reservation ──

  it('should create a reservation successfully', async () => {
    prisma.reservation.findFirst.mockResolvedValueOnce(null); // no last reservation (number gen)
    prisma.reservation.create.mockResolvedValue({
      id: 'res-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      reservationNumber: 'RES-000001',
      customerName: 'John Doe',
      partySize: 4,
      status: 'PENDING',
      table: null,
      deposits: [],
      events: [],
    });
    prisma.reservationEvent.create.mockResolvedValue({});

    const result = await service.create(
      'user-1',
      ctx,
      {
        customerName: 'John Doe',
        partySize: 4,
        reservationAt: '2026-04-01T19:00:00Z',
      },
      meta,
    );

    expect(result.reservationNumber).toBe('RES-000001');
    expect(result.status).toBe('PENDING');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_CREATED' }),
    );
  });

  it('should increment reservation number from last reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValueOnce({ reservationNumber: 'RES-000010' });
    prisma.reservation.create.mockResolvedValue({
      id: 'res-2',
      reservationNumber: 'RES-000011',
      status: 'PENDING',
      table: null,
      deposits: [],
      events: [],
    });
    prisma.reservationEvent.create.mockResolvedValue({});

    await service.create(
      'user-1',
      ctx,
      {
        customerName: 'Jane Doe',
        partySize: 2,
        reservationAt: '2026-04-01T20:00:00Z',
      },
      meta,
    );

    expect(prisma.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reservationNumber: 'RES-000011' }),
      }),
    );
  });

  it('should throw NotFoundException when table not found on create', async () => {
    prisma.table.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        'user-1',
        ctx,
        {
          customerName: 'John',
          partySize: 2,
          reservationAt: '2026-04-01T19:00:00Z',
          tableId: 'bad-table',
        },
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should detect table conflict on create', async () => {
    prisma.table.findFirst.mockResolvedValue({ id: 'table-1', label: 'T1' });
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: 'existing-res',
        reservationAt: new Date('2026-04-01T18:00:00Z'),
        expectedDurationMinutes: 120,
      },
    ]);
    // number gen
    prisma.reservation.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create(
        'user-1',
        ctx,
        {
          customerName: 'John',
          partySize: 2,
          reservationAt: '2026-04-01T19:00:00Z',
          tableId: 'table-1',
        },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ── Confirm ──

  it('should confirm a PENDING reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'PENDING',
      reservationNumber: 'RES-000001',
      notes: null,
    });
    prisma.reservation.update.mockResolvedValue({
      id: 'res-1',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      table: null,
      deposits: [],
      events: [],
    });
    prisma.reservationEvent.create.mockResolvedValue({});

    const result = await service.confirm('res-1', 'user-1', ctx, {}, meta);

    expect(result.status).toBe('CONFIRMED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_CONFIRMED' }),
    );
  });

  it('should reject confirm on CANCELLED reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'CANCELLED',
      reservationNumber: 'RES-000001',
    });

    await expect(service.confirm('res-1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  // ── Seat ──

  it('should seat a CONFIRMED reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'CONFIRMED',
      reservationNumber: 'RES-000001',
      tableId: 'table-1',
    });
    prisma.table.findFirst.mockResolvedValue({ id: 'table-1', label: 'T1' });
    prisma.reservation.update.mockResolvedValue({
      id: 'res-1',
      status: 'SEATED',
      seatedAt: new Date(),
      tableId: 'table-1',
      table: { id: 'table-1', label: 'T1' },
      deposits: [],
      events: [],
      seatedOrder: null,
    });
    prisma.reservationEvent.create.mockResolvedValue({});

    const result = await service.seat('res-1', 'user-1', ctx, {}, meta);

    expect(result.status).toBe('SEATED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_SEATED' }),
    );
  });

  it('should require table when seating', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'CONFIRMED',
      reservationNumber: 'RES-000001',
      tableId: null,
    });

    await expect(service.seat('res-1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should create order when seating with createOrder=true', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'CONFIRMED',
      reservationNumber: 'RES-000001',
      tableId: 'table-1',
    });
    prisma.table.findFirst.mockResolvedValue({ id: 'table-1', label: 'T1' });
    prisma.order.findFirst.mockResolvedValue(null); // no last order
    prisma.order.create.mockResolvedValue({ id: 'order-1', orderNumber: 'ORD-000001' });
    prisma.reservation.update.mockResolvedValue({
      id: 'res-1',
      status: 'SEATED',
      seatedOrderId: 'order-1',
      table: { id: 'table-1', label: 'T1' },
      deposits: [],
      events: [],
      seatedOrder: { id: 'order-1' },
    });
    prisma.reservationEvent.create.mockResolvedValue({});

    const result = await service.seat('res-1', 'user-1', ctx, { createOrder: true }, meta);

    expect(result.seatedOrderId).toBe('order-1');
    expect(prisma.order.create).toHaveBeenCalled();
  });

  // ── Cancel ──

  it('should cancel a PENDING reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'PENDING',
      reservationNumber: 'RES-000001',
    });
    prisma.reservation.update.mockResolvedValue({
      id: 'res-1',
      status: 'CANCELLED',
      cancelledAt: new Date(),
      table: null,
      deposits: [],
      events: [],
    });
    prisma.reservationEvent.create.mockResolvedValue({});

    const result = await service.cancel(
      'res-1',
      'user-1',
      ctx,
      { reason: 'Customer called to cancel' },
      meta,
    );

    expect(result.status).toBe('CANCELLED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_CANCELLED' }),
    );
  });

  it('should reject cancel on SEATED reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'SEATED',
      reservationNumber: 'RES-000001',
    });

    await expect(service.cancel('res-1', 'user-1', ctx, { reason: 'test' }, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should handle deposit forfeit on cancel', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'CONFIRMED',
      reservationNumber: 'RES-000001',
    });
    prisma.reservation.update.mockResolvedValue({
      id: 'res-1',
      status: 'CANCELLED',
      table: null,
      deposits: [],
      events: [],
    });
    prisma.reservationDeposit.updateMany.mockResolvedValue({ count: 1 });
    prisma.reservationEvent.create.mockResolvedValue({});

    await service.cancel(
      'res-1',
      'user-1',
      ctx,
      {
        reason: 'Late cancel',
        depositOutcome: 'FORFEIT',
      },
      meta,
    );

    expect(prisma.reservationDeposit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'FORFEITED' },
      }),
    );
  });

  // ── No-Show ──

  it('should mark reservation as no-show', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'CONFIRMED',
      reservationNumber: 'RES-000001',
    });
    prisma.reservation.update.mockResolvedValue({
      id: 'res-1',
      status: 'NO_SHOW',
      noShowAt: new Date(),
      table: null,
      deposits: [],
      events: [],
    });
    prisma.reservationEvent.create.mockResolvedValue({});

    const result = await service.markNoShow('res-1', 'user-1', ctx, {}, meta);

    expect(result.status).toBe('NO_SHOW');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_NO_SHOW' }),
    );
  });

  // ── Record Deposit ──

  it('should record a deposit successfully', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'PENDING',
      reservationNumber: 'RES-000001',
    });
    prisma.reservationDeposit.create.mockResolvedValue({
      id: 'dep-1',
      reservationId: 'res-1',
      amount: new Decimal(50),
      status: 'RECEIVED',
    });
    prisma.reservationEvent.create.mockResolvedValue({});

    const result = await service.recordDeposit(
      'res-1',
      'user-1',
      ctx,
      {
        amount: 50,
        method: 'CASH',
      },
      meta,
    );

    expect(result.status).toBe('RECEIVED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_DEPOSIT_RECORDED' }),
    );
  });

  it('should reject deposit on cancelled reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'CANCELLED',
      reservationNumber: 'RES-000001',
    });

    await expect(
      service.recordDeposit('res-1', 'user-1', ctx, { amount: 50 }, meta),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Assign Table ──

  it('should assign a table to a reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValueOnce({
      id: 'res-1',
      status: 'PENDING',
      reservationNumber: 'RES-000001',
      reservationAt: new Date('2026-04-01T19:00:00Z'),
      expectedDurationMinutes: 120,
    });
    prisma.table.findFirst.mockResolvedValue({ id: 'table-2', label: 'T2' });
    prisma.reservation.findMany.mockResolvedValue([]); // no conflicts
    prisma.reservation.update.mockResolvedValue({
      id: 'res-1',
      tableId: 'table-2',
      table: { id: 'table-2', label: 'T2' },
      deposits: [],
      events: [],
    });
    prisma.reservationEvent.create.mockResolvedValue({});

    const result = await service.assignTable('res-1', 'user-1', ctx, { tableId: 'table-2' }, meta);

    expect(result.tableId).toBe('table-2');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_TABLE_ASSIGNED' }),
    );
  });

  it('should reject table assignment on completed reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'COMPLETED',
      reservationNumber: 'RES-000001',
    });

    await expect(
      service.assignTable('res-1', 'user-1', ctx, { tableId: 'table-1' }, meta),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Find By Id ──

  it('should return reservation by id', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'PENDING',
      reservationNumber: 'RES-000001',
    });

    const result = await service.findById('res-1', ctx);
    expect(result.id).toBe('res-1');
  });

  it('should throw NotFoundException for non-existent reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue(null);

    await expect(service.findById('nonexistent', ctx)).rejects.toThrow(NotFoundException);
  });

  // ── List ──

  it('should list reservations with pagination', async () => {
    prisma.reservation.findMany.mockResolvedValue([
      { id: 'res-1', reservationNumber: 'RES-000001', status: 'PENDING' },
    ]);
    prisma.reservation.count.mockResolvedValue(1);

    const result = await service.list(ctx, { page: 1, pageSize: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  // ── List Upcoming ──

  it('should list upcoming reservations', async () => {
    prisma.reservation.findMany.mockResolvedValue([
      { id: 'res-1', status: 'CONFIRMED', reservationAt: new Date('2026-04-01T19:00:00Z') },
    ]);

    const result = await service.listUpcoming(ctx);
    expect(result).toHaveLength(1);
  });

  // ── Get Deposits ──

  it('should return deposits for a reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'PENDING',
      reservationNumber: 'RES-000001',
    });
    prisma.reservationDeposit.findMany.mockResolvedValue([
      { id: 'dep-1', amount: new Decimal(50), status: 'RECEIVED' },
    ]);

    const result = await service.getDeposits('res-1', ctx);
    expect(result).toHaveLength(1);
  });

  // ── Get Events ──

  it('should return events for a reservation', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'PENDING',
      reservationNumber: 'RES-000001',
    });
    prisma.reservationEvent.findMany.mockResolvedValue([{ id: 'evt-1', type: 'CREATED' }]);

    const result = await service.getEvents('res-1', ctx);
    expect(result).toHaveLength(1);
  });

  // ── State Machine Guard ──

  it('should block PENDING → SEATED (must confirm first)', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'PENDING',
      reservationNumber: 'RES-000001',
      tableId: 'table-1',
    });

    await expect(service.seat('res-1', 'user-1', ctx, {}, meta)).rejects.toThrow(ConflictException);
  });

  it('should block COMPLETED → CANCELLED', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: 'COMPLETED',
      reservationNumber: 'RES-000001',
    });

    await expect(service.cancel('res-1', 'user-1', ctx, { reason: 'test' }, meta)).rejects.toThrow(
      ConflictException,
    );
  });
});
