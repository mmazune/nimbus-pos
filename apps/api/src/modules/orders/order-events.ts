// E1 — domain events about an order, emitted on the app's EventEmitter2 AFTER the
// database transaction has committed. Payloads carry ids only (no names, no money):
// listeners read what they need. Nothing listens yet; stock, availability and alerts
// will (docs/direction/02-life-cycles.md).

export const ORDER_LINES_SENT = 'order.lines.sent';
export const ORDER_LINE_VOIDED = 'order.line.voided';
export const ORDER_CLOSED = 'order.closed';

export interface OrderLinesSentEvent {
  orderId: string;
  branchId: string;
  orgId: string;
  orderItemIds: string[];
  ticketIds: string[];
}

export interface OrderLineVoidedEvent {
  orderId: string;
  branchId: string;
  orgId: string;
  /** The line that was voided (for a part-void, the new voided line). */
  orderItemId: string;
}

export interface OrderClosedEvent {
  orderId: string;
  branchId: string;
  orgId: string;
  tableId: string | null;
  completedReservationId: string | null;
}
