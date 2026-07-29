import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, SearchInput, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import {
  fetchSupervisorOrderDetail,
  fetchSupervisorOrders,
  formatSupervisorMoney,
  formatSupervisorShortTime,
  getSupervisorOrderLabel,
  getSupervisorOrderStatusLabel,
  getSupervisorTableLabel,
  getSupervisorUserName,
  type SupervisorOrderListItem,
  type SupervisorOrderStatus,
  type SupervisorOrdersQuery,
  type SupervisorServiceType,
} from "@/lib/supervisor/orders";
import { cn } from "@/lib/utils/cn";

// Compact, bounded "Find order" lookup for the Supervisor Floor. This is NOT an
// Orders page: it opens as a focused dialog, fetches ONE bounded/paginated branch
// page (never full history, never cross-branch), and filters client-side. The
// backend has no order-number search, so exact-number matching is done locally;
// an exact order ID (paste) resolves through GET /pos/orders/:id.

const FIND_PAGE_SIZE = 25;

type StatusFilter = "ACTIVE" | "ALL" | SupervisorOrderStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ACTIVE", label: "Active orders" },
  { value: "ALL", label: "All recent" },
  { value: "READY", label: "Ready" },
  { value: "SERVED", label: "Served" },
  { value: "CLOSED", label: "Closed" },
  { value: "VOIDED", label: "Voided" },
];

const SERVICE_OPTIONS: { value: "" | SupervisorServiceType; label: string }[] = [
  { value: "", label: "Any service" },
  { value: "DINE_IN", label: "Dine-in" },
  { value: "TAKEAWAY", label: "Takeaway" },
];

/** cuid2-style order ids are ~20-32 url-safe chars; used for the exact-id path. */
function looksLikeOrderId(value: string): boolean {
  return /^[a-z0-9]{20,32}$/i.test(value.trim());
}

function buildQuery(statusFilter: StatusFilter, serviceFilter: "" | SupervisorServiceType): SupervisorOrdersQuery {
  const query: SupervisorOrdersQuery = { pageSize: FIND_PAGE_SIZE };
  if (statusFilter === "ACTIVE") query.excludeStatus = ["CLOSED", "VOIDED"];
  else if (statusFilter !== "ALL") query.status = statusFilter;
  if (serviceFilter) query.serviceType = serviceFilter;
  return query;
}

type SupervisorFindOrderDialogProps = {
  token: string;
  branchId: string;
  onClose: () => void;
  onSelectOrder: (params: { orderId: string; tableId: string | null }) => void;
};

export function SupervisorFindOrderDialog({
  branchId,
  onClose,
  onSelectOrder,
  token,
}: SupervisorFindOrderDialogProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [serviceFilter, setServiceFilter] = useState<"" | SupervisorServiceType>("");
  const dialogRef = useRef<HTMLDivElement>(null);
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
    queryKey: ["supervisor", "find-orders", branchId, statusFilter, serviceFilter],
    queryFn: () => fetchSupervisorOrders(token, branchId, buildQuery(statusFilter, serviceFilter)),
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((order) => {
      const haystack = [
        order.id,
        getSupervisorOrderLabel(order),
        getSupervisorTableLabel(order),
        getSupervisorUserName(order.user),
        order.serviceType || "",
        getSupervisorOrderStatusLabel(order.status),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search]);

  // Exact-reference fallback: when nothing in the bounded page matches and the
  // input looks like an order id, resolve it directly (id-only backend lookup).
  const wantsDirectLookup = Boolean(
    !listQuery.isLoading && filtered.length === 0 && looksLikeOrderId(search),
  );
  const directQuery = useQuery({
    queryKey: ["supervisor", "order-detail", branchId, search.trim()],
    enabled: wantsDirectLookup,
    queryFn: () => fetchSupervisorOrderDetail(token, branchId, search.trim()),
    retry: false,
    staleTime: 8_000,
  });

  const directResult = wantsDirectLookup && directQuery.data ? (directQuery.data as SupervisorOrderListItem) : null;
  const total = listQuery.data?.total ?? rows.length;
  const boundedNote =
    total > FIND_PAGE_SIZE
      ? `Showing the ${FIND_PAGE_SIZE} most recent orders for this filter — narrow with status/service or an exact order number.`
      : null;

  function handleSelect(order: SupervisorOrderListItem) {
    onSelectOrder({ orderId: order.id, tableId: order.tableId ?? order.table?.id ?? null });
  }

  const resultList = directResult ? [directResult] : filtered;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:pt-16"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Find order"
        className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg bg-surface p-6 shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Find order</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Look up takeaway, tableless, closed, or exception orders by number or reference.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close find order"
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
            placeholder="Search by order number, table, server, or exact ID"
            aria-label="Search orders"
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
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-text-secondary">
              <span>Service</span>
              <select
                className="min-h-11 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value as "" | SupervisorServiceType)}
              >
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option.value || "any"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4">
          {listQuery.isError ? (
            <StatusMessage tone="warning" title="Could not load orders">
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
                    ? "No order matches that reference in this branch."
                    : "That reference could not be resolved. Check the value and try again."}
                </p>
              ) : (
                <p className="text-sm text-text-secondary">
                  No orders match. Try a different status filter or an exact order number.
                </p>
              )}
            </div>
          ) : (
            <ul className="grid max-h-[52vh] gap-2 overflow-y-auto" aria-label="Order results">
              {resultList.map((order) => {
                const tableLabel = getSupervisorTableLabel(order);
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
                        <span className="font-semibold text-text-primary">{getSupervisorOrderLabel(order)}</span>
                        <span className="text-sm font-semibold tabular-nums text-text-primary">
                          {formatSupervisorMoney(order.total ?? 0)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                        <Badge variant="neutral">{getSupervisorOrderStatusLabel(order.status)}</Badge>
                        <span>{order.serviceType === "TAKEAWAY" ? "Takeaway" : tableLabel}</span>
                        <span>{getSupervisorUserName(order.user)}</span>
                        {order.items?.length ? <span>{order.items.length} items</span> : null}
                        {order.updatedAt ? <span>Updated {formatSupervisorShortTime(order.updatedAt)}</span> : null}
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
      </div>
    </div>
  );
}
