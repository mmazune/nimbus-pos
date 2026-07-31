/**
 * Narrow Cashier Floor-first query-key model (Prompt C2).
 *
 * One place that names every read domain the Floor-first settlement flow uses,
 * so selection changes invalidate/refetch predictably and nothing broadly
 * invalidates. C2 is read-only — mutation invalidation is defined in C3.
 *
 * Domains:
 *  - floor            : the shared Floor snapshot (tables + orders + reservations)
 *  - tableBills       : bounded order list for ONE selected table
 *  - orderDetail      : canonical order detail for ONE selected bill
 *  - orderPayments    : canonical payment summary for ONE selected bill
 *  - findBills        : bounded Find-bill search results
 *  - findBillDirect   : exact order-id direct lookup fallback
 */
export const cashierBillQueryKeys = {
  floor: (branchId: string | null | undefined) => ["cashier", "floor", branchId] as const,
  tableBills: (branchId: string | null | undefined, tableId: string | null | undefined) =>
    ["cashier", "table-bills", branchId, tableId] as const,
  orderDetail: (branchId: string | null | undefined, orderId: string | null | undefined) =>
    ["cashier", "order-detail", branchId, orderId] as const,
  orderPayments: (branchId: string | null | undefined, orderId: string | null | undefined) =>
    ["cashier", "order-payments", branchId, orderId, "settlement"] as const,
  findBills: (
    branchId: string | null | undefined,
    status: string,
    service: string,
  ) => ["cashier", "find-bills", branchId, status, service] as const,
  findBillDirect: (branchId: string | null | undefined, reference: string) =>
    ["cashier", "order-detail", branchId, reference] as const,
} as const;
