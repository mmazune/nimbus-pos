import { isWaiterOnly } from '../../common/auth/waiter-scope';

/**
 * T6 — what this person may do to this order now, so screens stop guessing.
 *
 * Each action pairs the permission key its route checks with the order states the service
 * accepts. A screen shows a button only for an action in the list; the route still decides.
 * Nothing here grants anything.
 */
export type OrderAction =
  | 'ADD_ITEMS'
  | 'SEND'
  | 'PRINT_BILL'
  | 'MARK_SERVED'
  | 'TAKE_PAYMENT'
  | 'CLOSE'
  | 'VOID_ORDER'
  | 'VOID_LINE'
  | 'DISCOUNT'
  | 'APPROVE_DISCOUNT'
  | 'SPLIT'
  | 'MERGE'
  | 'MOVE_ITEMS'
  | 'TRANSFER_TABLE'
  | 'REFUND';

export interface AllowedActionsInput {
  status: string;
  userId: string | null;
  tableId: string | null;
  items: { sentAt: Date | null; voidedAt: Date | null }[];
  paidCount: number;
}

export interface Actor {
  id: string;
  permissions?: string[];
  roles?: { name?: string; jobRole?: string | null }[];
}

const OPEN = new Set(['NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED']);

export function allowedActions(order: AllowedActionsInput, actor: Actor): OrderAction[] {
  const has = (k: string) => (actor.permissions ?? []).includes(k);
  const open = OPEN.has(order.status);
  const live = order.items.filter((i) => !i.voidedAt);
  const unsent = live.some((i) => !i.sentAt);
  const sent = live.some((i) => !!i.sentAt);
  const paid = order.paidCount > 0;
  // A waiter writes only their own orders (assertWaiterOrderOwnership).
  const mine = !isWaiterOnly(actor as any) || (!!order.userId && order.userId === actor.id);

  const out: OrderAction[] = [];
  const add = (a: OrderAction, ok: boolean) => ok && out.push(a);
  add('ADD_ITEMS', open && mine && has('pos:orders:write'));
  add('SEND', open && mine && unsent && has('pos:orders:write'));
  add('PRINT_BILL', open && mine && sent && has('pos:orders:write'));
  add(
    'MARK_SERVED',
    ['SENT', 'IN_KITCHEN', 'READY'].includes(order.status) && mine && has('pos:orders:write'),
  );
  add('TAKE_PAYMENT', open && live.length > 0 && has('pos:payment:create'));
  add('CLOSE', open && live.length > 0 && has('pos:orders:close'));
  add('VOID_ORDER', open && !paid && has('pos:orders:void'));
  add('VOID_LINE', open && sent && has('pos:order:item:void'));
  add('DISCOUNT', open && !paid && live.length > 0 && has('pos:discount:request'));
  add('APPROVE_DISCOUNT', open && has('pos:discount:approve'));
  add('SPLIT', open && live.length > 0 && has('pos:order:split'));
  add('MERGE', open && has('pos:order:merge'));
  add('MOVE_ITEMS', open && live.length > 0 && has('pos:order:move-items'));
  add('TRANSFER_TABLE', open && !!order.tableId && has('pos:order:transfer'));
  add('REFUND', order.status === 'CLOSED' && paid && has('pos:refund:create'));
  return out;
}
