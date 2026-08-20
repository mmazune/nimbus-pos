import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { cashierBillQueryKeys } from "@/lib/cashier/bill-query-keys";
import type { CashierReadinessSnapshot } from "@/lib/cashier/readiness";

/**
 * Narrow post-mutation refresh for the Cashier Floor settlement workspace (Prompt C3).
 *
 * C2 defined the read domains (`bill-query-keys.ts`); C3 defines what a payment /
 * split / close mutation is allowed to touch afterwards. Rules (locked):
 *
 *  1. **Canonical money is re-read, never inferred.** The two money reads for the
 *     settled bill (`orderDetail` + `orderPayments`) are refetched and AWAITED, so
 *     the panel's success/failure notice is only rendered once the backend numbers
 *     are back. There is no optimistic total anywhere on this path.
 *  2. **Everything else is narrow and non-blocking.** The table's bounded bill list,
 *     the Floor snapshot, and any open Find-bill result set are invalidated by their
 *     exact key factories (a settled bill leaves the payable set, and the table may
 *     free up), but they never block settlement.
 *  3. **Cross-role Floor caches are invalidated by their own narrow keys.** A close
 *     changes what Waiter/Supervisor see on the shared Floor. These keys are inert in
 *     a Cashier session (no such query is mounted) so they cost zero requests here.
 *  4. **Readiness is refreshed, not re-gated.** A cash close changes till expectations,
 *     so shift/till are refetched non-blocking. Failure never unblocks payment.
 *  5. **Nothing broad.** No bare `invalidateQueries()`, no `["cashier"]` root
 *     invalidation, no menu / profile / auth / receipts / refunds / queue sweep.
 */

export type CashierSettlementRefreshTarget = {
  branchId: string | null | undefined;
  orderId: string | null | undefined;
  /** Table context when the bill was resolved from a Floor table (optional). */
  tableId?: string | null;
};

/**
 * The exact key set a Cashier settlement mutation may touch. Pure + exported so
 * the C3 assertions can prove the invalidation surface stays narrow without a
 * React renderer.
 */
export function cashierSettlementInvalidationKeys({
  branchId,
  orderId,
  tableId,
}: CashierSettlementRefreshTarget) {
  return {
    /** Awaited — canonical money for the settled bill. */
    awaited: [
      cashierBillQueryKeys.orderDetail(branchId, orderId),
      cashierBillQueryKeys.orderPayments(branchId, orderId),
    ],
    /** Non-blocking — bounded lists that merely present the bill. */
    background: [
      ...(tableId ? [cashierBillQueryKeys.tableBills(branchId, tableId)] : []),
      cashierBillQueryKeys.floor(branchId),
      // Find-bill result sets are keyed by status+service; the shared prefix is the
      // narrowest key that covers every open filter for THIS branch only.
      ["cashier", "find-bills", branchId] as const,
    ],
    /** Non-blocking — other roles' Floor snapshots (inert in a Cashier session). */
    crossRole: [
      ["waiter", "floor", branchId] as const,
      ["supervisor", "floor", branchId] as const,
    ],
  };
}

/**
 * Returns a stable `onRefresh` callback for the reused checkout/split primitives
 * (`CashierPaymentPanel`, `CashierSplitBillPanel`, `CashierSplitItemsPanel`), which
 * all expect `() => Promise<void>` and call it after every mutation outcome —
 * success AND failure. Failure re-reads are what make the panel fail closed: a
 * request that errored client-side may still have been applied server-side, so the
 * canonical summary is always re-read before the operator sees a result.
 */
export function useCashierSettlementRefresh({
  branchId,
  orderId,
  tableId,
  readiness,
}: CashierSettlementRefreshTarget & { readiness: CashierReadinessSnapshot }) {
  const queryClient = useQueryClient();
  const shiftQuery = readiness.shiftQuery;
  const tillQuery = readiness.tillQuery;

  return useCallback(async () => {
    const keys = cashierSettlementInvalidationKeys({ branchId, orderId, tableId });

    for (const queryKey of keys.background) {
      void queryClient.invalidateQueries({ queryKey });
    }
    for (const queryKey of keys.crossRole) {
      void queryClient.invalidateQueries({ queryKey });
    }

    // Till expectations move with a cash close; shift state can expire mid-service.
    void shiftQuery.refetch();
    void tillQuery.refetch();

    // Canonical money last — and awaited.
    await Promise.all(
      keys.awaited.map((queryKey) => queryClient.refetchQueries({ queryKey, exact: true })),
    );
  }, [branchId, orderId, queryClient, shiftQuery, tableId, tillQuery]);
}
