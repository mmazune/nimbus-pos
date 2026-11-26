/**
 * What a role may do on the order screen. Rights decide the buttons, never the
 * screen (R1). Each right is read from the session's permission list; the one
 * filled button follows R5 and takes payment from the role, because a supervisor
 * does not take payment by default (owner default 2, `01-decisions.md`) even when
 * the token could close an order.
 */
export type OrderRole = "waiter" | "cashier" | "supervisor" | "manager";

export type OrderRights = {
  role: OrderRole;
  /** Add, change and remove lines; Send. */
  canOrder: boolean;
  /** Void one sent line (`pos:order:item:void`, E1). */
  canVoidLine: boolean;
  /** Take payment (R5: cashier and manager). */
  canPay: boolean;
  /** Ask for the bill (`request-bill`). */
  canRequestBill: boolean;
  /** Read another waiter's order lines. A waiter cannot (the API refuses). */
  canReadOthers: boolean;
  /** The table actions sheet (supervisor, manager). */
  canTableActions: boolean;
  canDiscount: boolean;
  canVoidOrder: boolean;
  /** Read posted payments: "to pay" and the payment safety gate. */
  canReadPayments: boolean;
  /** Set a table's status (free an empty table a move or join left occupied). */
  canSetTableStatus: boolean;
};

export function rightsFor(role: OrderRole, permissions: readonly string[]): OrderRights {
  const has = (p: string) => permissions.includes(p);
  const lead = role === "supervisor" || role === "manager";
  return {
    role,
    canOrder: has("pos:orders:write"),
    canVoidLine: has("pos:order:item:void"),
    canPay: (role === "cashier" || role === "manager") && has("pos:orders:close"),
    canRequestBill: has("pos:orders:write"),
    canReadOthers: role !== "waiter",
    canTableActions: lead,
    canDiscount: lead && has("pos:discount:request"),
    canVoidOrder: lead && has("pos:orders:void"),
    canReadPayments: role !== "waiter" && has("pos:payment:read"),
    canSetTableStatus: lead && has("pos:table:write"),
  };
}

export type FilledAction = "send" | "printBill" | "takePayment" | "none";

/** R5: Send when there are unsent lines; otherwise Print bill (waiter, supervisor) or Take payment (cashier, manager). */
export function filledAction(rights: OrderRights, unsentCount: number, hasSentLines: boolean, readOnly: boolean): FilledAction {
  // Another waiter's table: the API refuses both the read and the bill request to a waiter.
  if (readOnly) return "none";
  if (unsentCount > 0 && rights.canOrder) return "send";
  if (!hasSentLines) return rights.canOrder ? "send" : "none";
  if (rights.canPay) return "takePayment";
  return rights.canRequestBill ? "printBill" : "none";
}
