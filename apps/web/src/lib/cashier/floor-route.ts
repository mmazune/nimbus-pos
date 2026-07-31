/**
 * Cashier Floor routing helpers (Prompt C1).
 *
 * Single source of truth for the Floor-first route model:
 *  - the canonical default/landing route (`/cashier/floor`);
 *  - the table-selection URL param model (`?tableId=<id>`), standardised on the
 *    Receipts pattern (`router.replace`/`push` with `shallow: true`, spread the
 *    existing query, delete the key when clearing) so refresh / Back / Forward
 *    all restore understandable context;
 *  - the hidden COMPATIBILITY routes (`/cashier/queue`, `/cashier/receipts`) that
 *    remain reachable by direct URL until their capabilities migrate (Receipts →
 *    C4, Queue → C5). They are intentionally absent from visible navigation and
 *    are NOT redirected in C1.
 */

export const CASHIER_FLOOR_ROUTE = "/cashier/floor";
export const CASHIER_TILL_ROUTE = "/cashier/till";
export const CASHIER_ME_ROUTE = "/cashier/me";

/**
 * Compatibility routes — reachable by direct URL only, not surfaced in the
 * shell. Retirement is tracked in the gap register:
 *   - `/cashier/receipts` retires in C4 (Find bill + receipt context on Floor).
 *   - `/cashier/queue` retires in C5 (settlement workspace + Find bill on Floor).
 */
export const CASHIER_COMPATIBILITY_ROUTES = {
  queue: "/cashier/queue",
  receipts: "/cashier/receipts",
} as const;

export function firstCashierQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

/**
 * Build the next Floor query object when selecting a table. Spreads the existing
 * query so unrelated params survive, and sets/deletes `tableId`. Passing a null
 * `tableId` clears the selection.
 *
 * NOTE (C1 contract, unchanged): this helper manages `tableId` only and does not
 * touch `orderId`. The C2 bill selection helpers below own the `orderId` param.
 */
export function buildCashierFloorQuery(
  currentQuery: Record<string, string | string[] | undefined>,
  tableId: string | null,
): Record<string, string | string[] | undefined> {
  const nextQuery = { ...currentQuery };
  if (tableId) nextQuery.tableId = tableId;
  else delete nextQuery.tableId;
  return nextQuery;
}

/**
 * Canonical bill-selection URL state (Prompt C2). A resolved/selected bill lives
 * in `?orderId=<id>`; a table context (when present) lives in `?tableId=<id>`.
 *  - table-linked bills carry both params (refresh/Back/Forward safe);
 *  - tableless / takeaway / Find-bill results carry `orderId` only;
 *  - passing a null value deletes that param, so clearing selection removes
 *    only the relevant keys.
 */
export function buildCashierBillQuery(
  currentQuery: Record<string, string | string[] | undefined>,
  selection: { tableId?: string | null; orderId?: string | null },
): Record<string, string | string[] | undefined> {
  const nextQuery = { ...currentQuery };
  if (selection.tableId) nextQuery.tableId = selection.tableId;
  else delete nextQuery.tableId;
  if (selection.orderId) nextQuery.orderId = selection.orderId;
  else delete nextQuery.orderId;
  return nextQuery;
}

/**
 * Clear only the selected bill (`orderId`) while preserving the table context
 * (`tableId`). Used to return from an open bill to a table's bill list.
 */
export function clearCashierBillQuery(
  currentQuery: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const nextQuery = { ...currentQuery };
  delete nextQuery.orderId;
  return nextQuery;
}
