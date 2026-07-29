import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button, SearchInput, Skeleton, StatusMessage } from "@/components/ui";
import { shouldRetryApiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import {
  fetchSupervisorOrders,
  formatSupervisorMoney,
  getSupervisorOrderLabel,
  getSupervisorOrderStatusLabel,
  getSupervisorTableLabel,
  getSupervisorUserName,
  type SupervisorOrderListItem,
} from "@/lib/supervisor/orders";

// Bounded, branch-scoped selector of eligible target orders for Move items /
// Merge. Never fetches full history: excludes CLOSED/VOIDED and the source order,
// caps the page size, and searches within the bounded result set.

const TARGET_PAGE_SIZE = 25;

type SupervisorOrderTargetSelectorProps = {
  token: string;
  branchId: string;
  sourceOrderId: string;
  selectedOrderId?: string | null;
  onSelect: (order: SupervisorOrderListItem) => void;
};

export function SupervisorOrderTargetSelector({
  branchId,
  onSelect,
  selectedOrderId,
  sourceOrderId,
  token,
}: SupervisorOrderTargetSelectorProps) {
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["supervisor", "order-targets", branchId],
    queryFn: () =>
      fetchSupervisorOrders(token, branchId, {
        excludeStatus: ["CLOSED", "VOIDED"],
        pageSize: TARGET_PAGE_SIZE,
      }),
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const filtered = useMemo(() => {
    const eligible = rows.filter((order) => order.id !== sourceOrderId);
    const term = search.trim().toLowerCase();
    if (!term) return eligible;
    return eligible.filter((order) => {
      const haystack = [
        getSupervisorOrderLabel(order),
        getSupervisorTableLabel(order),
        getSupervisorUserName(order.user),
        order.serviceType || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, sourceOrderId]);

  const total = query.data?.total ?? rows.length;
  const boundedNote = total > TARGET_PAGE_SIZE ? `Showing the first ${TARGET_PAGE_SIZE} open orders — refine your search.` : null;

  return (
    <div className="grid gap-3">
      <SearchInput
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search open orders by number, table, or server"
        aria-label="Search open orders"
      />

      {query.isError ? (
        <StatusMessage tone="warning" title="Could not load target orders">
          <Button className="mt-2" size="compact" variant="secondary" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </StatusMessage>
      ) : query.isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-md bg-surface-muted px-3 py-4 text-sm text-text-secondary">
          {rows.length <= 1
            ? "No other open orders are available in this branch."
            : "No open orders match your search."}
        </p>
      ) : (
        <ul className="grid max-h-64 gap-2 overflow-y-auto" role="radiogroup" aria-label="Target order">
          {filtered.map((order) => {
            const isSelected = order.id === selectedOrderId;
            return (
              <li key={order.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelect(order)}
                  className={cn(
                    "grid w-full gap-1 rounded-md border p-3 text-left focus-visible:shadow-focus",
                    isSelected ? "border-brand-navy-900 bg-brand-white shadow-panel" : "border-border-subtle bg-surface hover:bg-surface-muted",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-text-primary">{getSupervisorOrderLabel(order)}</span>
                    <span className="text-sm font-semibold tabular-nums text-text-primary">
                      {formatSupervisorMoney(order.total ?? 0)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-text-muted">
                    <span>{getSupervisorTableLabel(order)}</span>
                    <span>{getSupervisorOrderStatusLabel(order.status)}</span>
                    <span>{getSupervisorUserName(order.user)}</span>
                    {order.items?.length ? <span>{order.items.length} lines</span> : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {boundedNote ? <p className="text-xs text-text-muted">{boundedNote}</p> : null}
    </div>
  );
}
