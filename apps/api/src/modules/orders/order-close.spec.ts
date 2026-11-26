import { ConflictException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { closeOrderInTx } from './order-close';

/**
 * E1 part a — the one close door, exercised with a hand-rolled transaction client.
 * The live behaviour (real table, real reservation) is proven by the "Table 12" e2e spec.
 */
describe('closeOrderInTx', () => {
  let tx: any;
  const input = {
    orderId: 'order-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    userId: 'user-1',
    source: 'payment' as const,
    auditAction: 'ORDER_PAID_AND_CLOSED',
  };
  const orderRow = {
    id: 'order-1',
    status: 'CLOSED',
    tableId: 'table-12',
    total: new Decimal(98000),
    userId: 'waiter-1',
  };

  beforeEach(() => {
    tx = {
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(orderRow),
        count: jest.fn().mockResolvedValue(0),
      },
      table: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      reservation: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      reservationEvent: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    // E1F (N1): the close door reads every SEATED reservation; the mock delegates to findFirst
    tx.reservation.findMany = jest.fn(async (...a: any[]) => {
      const r = await tx.reservation.findFirst(...a);
      return r ? [r] : [];
    });
  });

  it('closes only an order that is still open (guarded write)', async () => {
    await closeOrderInTx(tx, input);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        status: { notIn: ['CLOSED', 'VOIDED'] },
      },
      data: { status: 'CLOSED' },
    });
  });

  it('frees the table when no other open order sits on it', async () => {
    const r = await closeOrderInTx(tx, input);
    expect(r.tableFreed).toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalled(); // the table row is locked first
    expect(tx.table.updateMany).toHaveBeenCalledWith({
      where: { id: 'table-12', status: 'OCCUPIED' },
      data: { status: 'AVAILABLE' },
    });
  });

  it('keeps the table occupied while another order on it is open', async () => {
    tx.order.count.mockResolvedValue(1);
    const r = await closeOrderInTx(tx, input);
    expect(r.tableFreed).toBe(false);
    expect(tx.table.updateMany).not.toHaveBeenCalled();
  });

  it('completes a linked SEATED reservation once, with source order-close', async () => {
    tx.reservation.findFirst.mockResolvedValue({ id: 'res-1', reservationNumber: 'RES-1' });
    const r = await closeOrderInTx(tx, input);
    expect(r.completedReservationId).toBe('res-1');
    expect(tx.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'res-1', status: 'SEATED' } }),
    );
    expect(tx.reservationEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.reservationEvent.create.mock.calls[0][0].data.metadata).toEqual({
      source: 'order-close',
      orderId: 'order-1',
    });
  });

  it('a lost race on the reservation writes no second event', async () => {
    tx.reservation.findFirst.mockResolvedValue({ id: 'res-1', reservationNumber: 'RES-1' });
    tx.reservation.updateMany.mockResolvedValue({ count: 0 });
    const r = await closeOrderInTx(tx, input);
    expect(r.completedReservationId).toBeNull();
    expect(tx.reservationEvent.create).not.toHaveBeenCalled();
  });

  it('a retry on an already CLOSED order does nothing and reports closed:false', async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 });
    const r = await closeOrderInTx(tx, input);
    expect(r.closed).toBe(false);
    expect(r.event).toBeNull();
    expect(tx.table.updateMany).not.toHaveBeenCalled();
    expect(tx.reservation.findFirst).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuses a VOIDED order', async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 });
    tx.order.findFirst.mockResolvedValue({ ...orderRow, status: 'VOIDED' });
    await expect(closeOrderInTx(tx, input)).rejects.toThrow(ConflictException);
  });

  it('writes the order audit row with the caller action and returns the event (ids only)', async () => {
    const r = await closeOrderInTx(tx, input);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'ORDER_PAID_AND_CLOSED',
        entityType: 'order',
        entityId: 'order-1',
      }),
    });
    expect(r.event).toEqual({
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
      tableId: 'table-12',
      completedReservationId: null,
    });
  });
});
