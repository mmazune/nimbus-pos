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

  // Lock order everywhere: order (claimed above), then reservation, then table (E1F, S2/P8).
  const completedIds = await completeSeatedReservationsInTx(tx, {
    orgId,
    branchId,
    orderId,
    actorUserId: input.userId ?? order.userId,
    auditUserId: input.userId ?? null,
    source: 'order-close',
    message: 'Reservation auto-completed on order close',
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  const completedReservationId = completedIds[0] ?? null;

  const tableFreed = order.tableId
    ? await releaseTableIfIdleInTx(tx, order.tableId, orderId)
    : false;

  await audit(tx, input, input.auditAction, 'order', orderId, {
    orgId,
    branchId,
    newStatus: OrderStatus.CLOSED,
    closedVia: input.source,
    tableFreed,
    completedReservationId,
    ...(completedIds.length > 1 ? { completedReservationIds: completedIds } : {}),
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

/**
 * The one place a table goes back to AVAILABLE after an order ends (W2): the table row is
 * locked first, so two orders ending on one table at the same moment cannot both see the
 * other as open. Called by the close door, the whole-order void and the table moves.
 */
export async function releaseTableIfIdleInTx(
  tx: Prisma.TransactionClient,
  tableId: string,
  excludeOrderId: string | null,
): Promise<boolean> {
  await tx.$queryRaw`SELECT "id" FROM "tables" WHERE "id" = ${tableId} FOR UPDATE`;
  const stillOpen = await tx.order.count({
    where: {
      tableId,
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      status: OPEN_FILTER,
    },
  });
  if (stillOpen > 0) return false;
  const freed = await tx.table.updateMany({
    where: { id: tableId, status: TableStatus.OCCUPIED },
    data: { status: TableStatus.AVAILABLE },
  });
  return freed.count > 0;
}

/**
 * Every reservation still SEATED on this order completes, once each (N1: a bad link that
 * points two reservations at one order leaves none behind). Used by the close door
 * (source order-close) and the whole-order void (source order-void, ruling R-c).
 */
export async function completeSeatedReservationsInTx(
  tx: Prisma.TransactionClient,
  input: {
    orgId: string;
    branchId: string;
    orderId: string;
    actorUserId: string;
    auditUserId: string | null;
    source: 'order-close' | 'order-void';
    message: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<string[]> {
  const { orgId, branchId, orderId } = input;
  const seated = await tx.reservation.findMany({
    where: { seatedOrderId: orderId, orgId, branchId, status: ReservationStatus.SEATED },
    select: { id: true, reservationNumber: true },
    orderBy: { id: 'asc' },
  });
  const done: string[] = [];
  for (const r of seated) {
    const res = await tx.reservation.updateMany({
      where: { id: r.id, status: ReservationStatus.SEATED },
      data: {
        status: ReservationStatus.COMPLETED,
        completedAt: new Date(),
        updatedById: input.auditUserId ?? undefined,
      },
    });
    if (res.count !== 1) continue;
    done.push(r.id);
    await tx.reservationEvent.create({
      data: {
        orgId,
        branchId,
        reservationId: r.id,
        type: ReservationEventType.COMPLETED,
        // an automatic close (provider callback) has no person: the order's owner stands in
        actorUserId: input.actorUserId,
        message: input.message,
        metadata: { source: input.source, orderId },
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.auditUserId,
        action: 'RESERVATION_COMPLETED',
        entityType: 'Reservation',
        entityId: r.id,
        metadata: {
          branchId,
          reservationNumber: r.reservationNumber,
          source: input.source,
          orderId,
        },
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }
  return done;
}
