import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  OrderStatus,
  ReservationStatus,
  ReservationEventType,
  TableStatus,
} from '@prisma/client';
import { OrderClosedEvent } from './order-events';

/**
 * E1 — the ONE door through which an order becomes CLOSED.
 *
 * Runs inside the caller's transaction, so the order, the table, the reservation and the
 * audit rows commit together or not at all. Called by the payment close, the payment
 * auto-settle and `OrdersService.transitionOrder(… CLOSED)`. No other code writes CLOSED
 * on a dine-in order (the event quick-sale engine inserts an order that is born CLOSED,
 * with no table and no reservation, and does not pass through here).
 *
 * Retry-safe: closing an order that is already CLOSED does nothing and says so.
 */
export type OrderCloseSource = 'payment' | 'auto-settle' | 'transition';

export interface CloseOrderInput {
  orderId: string;
  orgId: string;
  branchId: string;
  userId?: string | null;
  source: OrderCloseSource;
  /** Audit action for the order row, kept per caller so existing audit trails read the same. */
  auditAction: string;
  auditMetadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface CloseOrderResult {
  /** false when the order was already CLOSED (a retry); nothing was written. */
  closed: boolean;
  order: {
    id: string;
    status: OrderStatus;
    tableId: string | null;
    total: Prisma.Decimal;
    userId: string;
  };
  tableFreed: boolean;
  completedReservationId: string | null;
  event: OrderClosedEvent | null;
}

const OPEN_FILTER = { notIn: [OrderStatus.CLOSED, OrderStatus.VOIDED] };

async function audit(
  tx: Prisma.TransactionClient,
  input: CloseOrderInput,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  await tx.auditLog.create({
    data: {
      actorUserId: input.userId ?? null,
      action,
      entityType,
      entityId,
      metadata: JSON.parse(JSON.stringify(metadata)),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function closeOrderInTx(
  tx: Prisma.TransactionClient,
  input: CloseOrderInput,
): Promise<CloseOrderResult> {
  const { orderId, orgId, branchId } = input;

  // The guarded write: only an order that is still open can be closed, and only once.
  const claimed = await tx.order.updateMany({
    where: { id: orderId, orgId, branchId, status: OPEN_FILTER },
    data: { status: OrderStatus.CLOSED },
  });

  const order = await tx.order.findFirst({
    where: { id: orderId, orgId, branchId },
    select: { id: true, status: true, tableId: true, total: true, userId: true },
  });
  if (!order) throw new NotFoundException('Order not found');

  if (claimed.count === 0) {
    if (order.status === OrderStatus.CLOSED) {
      return { closed: false, order, tableFreed: false, completedReservationId: null, event: null };
    }
    throw new ConflictException(`Cannot close an order in ${order.status} state`);
  }

  // Free the table only when nothing else open sits on it. The table row is locked first so
  // two orders closing on one table at the same moment cannot both see the other as open.
  let tableFreed = false;
  if (order.tableId) {
    await tx.$queryRaw`SELECT "id" FROM "tables" WHERE "id" = ${order.tableId} FOR UPDATE`;
    const stillOpen = await tx.order.count({
      where: { tableId: order.tableId, id: { not: orderId }, status: OPEN_FILTER },
    });
    if (stillOpen === 0) {
      const freed = await tx.table.updateMany({
        where: { id: order.tableId, status: TableStatus.OCCUPIED },
        data: { status: TableStatus.AVAILABLE },
      });
      tableFreed = freed.count > 0;
    }
  }

  // A reservation linked by seatedOrderId and still SEATED completes, once.
  let completedReservationId: string | null = null;
  const reservation = await tx.reservation.findFirst({
    where: { seatedOrderId: orderId, orgId, branchId, status: ReservationStatus.SEATED },
    select: { id: true, reservationNumber: true },
  });
  if (reservation) {
    const done = await tx.reservation.updateMany({
      where: { id: reservation.id, status: ReservationStatus.SEATED },
      data: {
        status: ReservationStatus.COMPLETED,
        completedAt: new Date(),
        updatedById: input.userId ?? undefined,
      },
    });
    if (done.count === 1) {
      completedReservationId = reservation.id;
      await tx.reservationEvent.create({
        data: {
          orgId,
          branchId,
          reservationId: reservation.id,
          type: ReservationEventType.COMPLETED,
          // an automatic close (provider callback) has no person: the order's owner stands in
          actorUserId: input.userId ?? order.userId,
          message: 'Reservation auto-completed on order close',
          metadata: { source: 'order-close', orderId },
        },
      });
      await audit(tx, input, 'RESERVATION_COMPLETED', 'Reservation', reservation.id, {
        branchId,
        reservationNumber: reservation.reservationNumber,
        source: 'order-close',
        orderId,
      });
    }
  }

  await audit(tx, input, input.auditAction, 'order', orderId, {
    orgId,
    branchId,
    newStatus: OrderStatus.CLOSED,
    closedVia: input.source,
    tableFreed,
    completedReservationId,
    ...(input.auditMetadata ?? {}),
  });

  return {
    closed: true,
    order,
    tableFreed,
    completedReservationId,
    event: {
      orderId,
      branchId,
      orgId,
      tableId: order.tableId,
      completedReservationId,
    },
  };
}
