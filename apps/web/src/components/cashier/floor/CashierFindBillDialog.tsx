import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, SearchInput, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { cashierBillQueryKeys } from "@/lib/cashier/bill-query-keys";
import { normalizeCashierOrder } from "@/lib/cashier/order-state";
import type { CashierOrderApi, CashierServiceType } from "@/lib/cashier/order-types";
import { getCashierOrder, listCashierOrders } from "@/lib/cashier/orders";
import { cn } from "@/lib/utils/cn";
import { formatOperationalTableLabel } from "@/components/floor/formatters";

/**
 * Compact, bounded "Find bill" lookup for the Cashier Floor (Prompt C2).
 *
 * This is the Cashier sibling of Supervisor's Find order — it is NOT a Queue and
 * NOT part of the shared OperationalFloor. It opens as a focused dialog, fetches
 * ONE bounded/paginated branch page (never full history, never cross-branch),
 * and filters client-side. Order-number search is local (the backend has no
 * number search); an exact order id (paste) resolves through GET /pos/orders/:id.
 *
 * It routes the selected bill into the SAME canonical settlement workspace via
 * orderId URL state, supporting tableless and takeaway bills. Receipt-reference
 * search is deferred to C4 and is shown as an explicit unavailable capability.
 */

const FIND_PAGE_SIZE = 25;

type StatusFilter = "ACTIVE" | "ALL" | "READY" | "SERVED" | "CLOSED" | "VOIDED";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ACTIVE", label: "Active bills" },
  { value: "ALL", label: "All recent" },
  { value: "READY", label: "Ready" },
  { value: "SERVED", label: "Served" },
  { value: "CLOSED", label: "Closed" },
  { value: "VOIDED", label: "Voided" },
];

const SERVICE_OPTIONS: { value: "" | CashierServiceType; label: string }[] = [
  { value: "", label: "Any service" },
  { value: "DINE_IN", label: "Dine-in" },
  { value: "TAKEAWAY", label: "Takeaway" },
];

/** cuid2-style order ids are ~20-32 url-safe chars; used for the exact-id path. */
function looksLikeOrderId(value: string): boolean {
  return /^[a-z0-9]{20,32}$/i.test(value.trim());
}

function buildQuery(statusFilter: StatusFilter, serviceFilter: "" | CashierServiceType) {
  const query: {
    status?: string;
    excludeStatus?: string[];
    serviceType?: CashierServiceType;
    pageSize: number;
  } = { pageSize: FIND_PAGE_SIZE };
  if (statusFilter === "ACTIVE") query.excludeStatus = ["NEW", "CLOSED", "VOIDED"];
  else if (statusFilter !== "ALL") query.status = statusFilter;
  if (serviceFilter) query.serviceType = serviceFilter;
  return query;
}

type CashierFindBillDialogProps = {
  token: string;
  branchId: string;
  fallbackBranchName?: string;
  onClose: () => void;
  onSelectBill: (params: { orderId: string; tableId: string | null }) => void;
};

export function CashierFindBillDialog({
  token,
  branchId,
  fallbackBranchName,
  onClose,
  onSelectBill,
}: CashierFindBillDialogProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [serviceFilter, setServiceFilter] = useState<"" | CashierServiceType>("");
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus();
    };
  }, [onClose]);

  const listQuery = useQuery({
    queryKey: cashierBillQueryKeys.findBills(branchId, statusFilter, serviceFilter || "any"),
    queryFn: () => listCashierOrders(token, branchId, buildQuery(statusFilter, serviceFilter)),
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((order) => {
      const view = normalizeCashierOrder({ order, fallbackBranchName });
      return view.searchText.includes(term);
    });
  }, [fallbackBranchName, rows, search]);

  const wantsDirectLookup = Boolean(
    !listQuery.isLoading && filtered.length === 0 && looksLikeOrderId(search),
  );
  const directQuery = useQuery({
    queryKey: cashierBillQueryKeys.findBillDirect(branchId, search.trim()),
    enabled: wantsDirectLookup,
    queryFn: () => getCashierOrder(token, branchId, search.trim()),
    retry: false,
    staleTime: 8_000,
  });

  const directResult = wantsDirectLookup && directQuery.data ? directQuery.data : null;
  const resultList: CashierOrderApi[] = directResult ? [directResult] : filtered;
  const total = listQuery.data?.total ?? rows.length;
  const boundedNote =
    total > FIND_PAGE_SIZE
      ? `Showing the ${FIND_PAGE_SIZE} most recent bills for this filter — narrow with status/service or paste an exact bill reference.`
      : null;

  function handleSelect(order: CashierOrderApi) {
    onSelectBill({ orderId: order.id, tableId: order.tableId ?? order.table?.id ?? null });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-brand-navy-950/40 p-4 sm:pt-16"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find bill"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-6 shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Find bill</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Look up takeaway, tableless, or closed bills by number or exact reference.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close find bill"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary hover:bg-surface hover:text-text-primary focus-visible:shadow-focus"
            onClick={onClose}
          >
            <X size={20} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <SearchInput
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by bill number, table, server, or exact ID"
            aria-label="Search bills"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-text-secondary">
              <span>Status</span>
              <select
                className="min-h-11 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-text-secondary">
              <span>Service</span>
              <select
                className="min-h-11 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value as "" | CashierServiceType)}
              >
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option.value || "any"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4">
          {listQuery.isError ? (
            <StatusMessage tone="warning" title="Could not load bills">
              <Button className="mt-2" size="compact" variant="secondary" onClick={() => void listQuery.refetch()}>
                Retry
              </Button>
            </StatusMessage>
          ) : listQuery.isLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : resultList.length === 0 ? (
            <div className="rounded-md bg-surface-muted px-3 py-6 text-center">
              {wantsDirectLookup && directQuery.isFetching ? (
                <p className="text-sm text-text-secondary">Looking up that reference…</p>
              ) : wantsDirectLookup && directQuery.isError ? (
                <p className="text-sm text-text-secondary">
                  {directQuery.error instanceof ApiError && directQuery.error.status === 404
                    ? "No bill matches that reference in this branch."
                    : "That reference could not be resolved. Check the value and try again."}
                </p>
              ) : (
                <p className="text-sm text-text-secondary">
                  No bills match. Try a different status filter or an exact bill number.
                </p>
              )}
            </div>
          ) : (
            <ul className="grid max-h-[52vh] gap-2 overflow-y-auto" aria-label="Bill results">
              {resultList.map((order) => {
                const view = normalizeCashierOrder({ order, fallbackBranchName });
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(order)}
                      className={cn(
                        "grid w-full gap-1 rounded-md border border-border-subtle bg-surface p-3 text-left",
                        "hover:bg-surface-muted focus-visible:shadow-focus",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-semibold text-text-primary">{view.orderNumber}</span>
                        <span className="font-semibold tabular-nums text-text-primary">{view.formattedTotal}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                        <Badge variant={view.statusTone}>{view.statusLabel}</Badge>
                        <span title={view.tableName}>
                          {view.serviceType === "TAKEAWAY"
                            ? "Takeaway"
                            : formatOperationalTableLabel(view.tableName) || view.tableName}
                        </span>
                        <span>{view.serverName}</span>
                        {view.itemCount ? <span>{view.itemCount} items</span> : null}
                        <span>Opened {view.openedLabel}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {boundedNote && resultList.length > 0 ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-text-muted">
            <MagnifyingGlass size={14} weight="bold" aria-hidden />
            {boundedNote}
          </p>
        ) : null}

        <p className="mt-3 text-xs text-text-muted">
          Receipt-reference search becomes available in a later step.
        </p>
      </div>
    </div>
  );
}
