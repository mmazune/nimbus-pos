import { ArrowLeft } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { OperationalTableStatusBadge } from "@/components/floor/OperationalTableStatusBadge";
import { formatOperationalTableLabel } from "@/components/floor/formatters";
import { Button, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { cashierBillQueryKeys } from "@/lib/cashier/bill-query-keys";
import {
  resolveCashierTableBills,
  type CashierBillCandidate,
} from "@/lib/cashier/bill-resolution";
import type { CashierFloorTableViewModel } from "@/lib/cashier/floor-model";
import { listCashierOrders } from "@/lib/cashier/orders";
import type { CashierReadinessSnapshot } from "@/lib/cashier/readiness";

import { CashierBillSelector } from "./CashierBillSelector";
import { CashierSettlementWorkspace } from "./CashierSettlementWorkspace";

/**
 * Table-to-bill resolution container (Prompt C2).
 *
 * Behind a Floor table selection this panel runs ONE bounded, branch-scoped
 * table-order query (`GET /api/pos/orders?tableId=…`) and classifies the result
 * into payable candidates + terminal orders (never "first active order"):
 *   - zero payable  → truthful empty state (+ read-only terminal list if any);
 *   - one payable   → auto-resolve into the settlement workspace (URL orderId);
 *   - many payable  → an explicit bounded selector (no silent first-pick).
 *
 * The table-order query stays mounted while a bill is open so "Back to bills"
 * can return to the selector without a re-fetch. Resolution itself is read-only;
 * settlement execution lives inside the workspace it opens (Prompt C3).
 */

const TABLE_BILLS_PAGE_SIZE = 50;

type CashierBillResolutionPanelProps = {
  table: CashierFloorTableViewModel;
  selectedOrderId?: string;
  token: string;
  branchId: string;
  fallbackBranchName?: string;
  readiness: CashierReadinessSnapshot;
  onResolveSingle: (orderId: string) => void;
  onSelectBill: (orderId: string) => void;
  onBackToBills: () => void;
  onClose: () => void;
};

function tableBillsErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.isForbidden) return "This table's bills belong to another branch and cannot be read here.";
    if (error.isAuthError) return "Session expired. Please log in again to continue.";
    return error.message || "Could not load bills for this table.";
  }
  return "Could not load bills for this table. Try again when the connection is stable.";
}

export function CashierBillResolutionPanel({
  table,
  selectedOrderId,
  token,
  branchId,
  fallbackBranchName,
  readiness,
  onResolveSingle,
  onSelectBill,
  onBackToBills,
  onClose,
}: CashierBillResolutionPanelProps) {
  const autoResolvedRef = useRef<string | null>(null);

  const tableBillsQuery = useQuery({
    queryKey: cashierBillQueryKeys.tableBills(branchId, table.id),
    queryFn: () =>
      listCashierOrders(token, branchId, { tableId: table.id, pageSize: TABLE_BILLS_PAGE_SIZE }),
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  const orders = tableBillsQuery.data?.data || [];
  const resolution = resolveCashierTableBills(orders);
  const payableCandidates: CashierBillCandidate[] =
    resolution.kind === "multiple"
      ? resolution.candidates
      : resolution.kind === "single"
        ? [resolution.candidate]
        : [];
  const hasMultiple = payableCandidates.length > 1;

  const matchingOrder = selectedOrderId
    ? orders.find((order) => order.id === selectedOrderId)
    : undefined;

  // Auto-resolve exactly one payable bill (no visible intermediate selector).
  useEffect(() => {
    if (selectedOrderId) return;
    if (!tableBillsQuery.isSuccess) return;
    if (resolution.kind !== "single") return;
    if (autoResolvedRef.current === resolution.candidate.order.id) return;
    autoResolvedRef.current = resolution.candidate.order.id;
    onResolveSingle(resolution.candidate.order.id);
  }, [onResolveSingle, resolution, selectedOrderId, tableBillsQuery.isSuccess]);

  useEffect(() => {
    autoResolvedRef.current = null;
  }, [table.id]);

  // A bill is selected → open the single canonical settlement workspace.
  if (selectedOrderId) {
    return (
      <CashierSettlementWorkspace
        orderId={selectedOrderId}
        token={token}
        branchId={branchId}
        tableId={table.id}
        fallbackBranchName={fallbackBranchName}
        fallbackOrder={matchingOrder}
        readiness={readiness}
        onClose={onClose}
        onBackToBills={hasMultiple ? onBackToBills : undefined}
      />
    );
  }

  return (
    <section className="grid gap-6" aria-label={`Bills for ${table.label}`}>
      <button
        type="button"
        className="inline-flex w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-muted focus-visible:shadow-focus"
        onClick={onClose}
      >
        <ArrowLeft size={18} weight="bold" aria-hidden />
        Back to Floor
      </button>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-normal text-text-primary" title={table.label}>
          {formatOperationalTableLabel(table.label) || table.label}
        </h2>
        <OperationalTableStatusBadge status={table.status} />
      </header>

      {tableBillsQuery.isError ? (
        <StatusMessage tone="warning" title="Could not load bills">
          <p>{tableBillsErrorCopy(tableBillsQuery.error)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="compact" variant="secondary" onClick={() => void tableBillsQuery.refetch()}>
              Retry
            </Button>
            <Button size="compact" variant="tertiary" onClick={onClose}>
              Back to Floor
            </Button>
          </div>
        </StatusMessage>
      ) : tableBillsQuery.isLoading ? (
        <div className="grid gap-2" aria-hidden>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : resolution.kind === "multiple" ? (
        <CashierBillSelector
          candidates={resolution.candidates}
          fallbackBranchName={fallbackBranchName}
          onSelect={onSelectBill}
        />
      ) : resolution.kind === "single" ? (
        // Auto-resolving into the workspace — show a brief resolving state.
        <div className="grid gap-2" aria-hidden>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-lg border border-border-subtle bg-surface-muted p-6 text-center" role="status">
            <p className="text-base font-semibold text-text-primary">No bill is available for this table.</p>
            <p className="mt-2 text-sm font-medium text-text-secondary">
              Nothing here can be settled right now. Use Find bill for takeaway, tableless, or closed bills.
            </p>
          </div>

          {resolution.terminal.length ? (
            <CashierBillSelector
              mode="closed-history"
              candidates={resolution.terminal}
              fallbackBranchName={fallbackBranchName}
              onSelect={onSelectBill}
            />
          ) : null}
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {tableBillsQuery.isLoading
          ? "Finding bills for this table."
          : tableBillsQuery.isError
            ? "Could not load bills for this table."
            : resolution.kind === "multiple"
              ? `${resolution.candidates.length} bills found for this table.`
              : resolution.kind === "zero"
                ? "No bill is available for this table."
                : "Opening the selected bill."}
      </div>
    </section>
  );
}
