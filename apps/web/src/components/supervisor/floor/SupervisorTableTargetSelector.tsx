import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { OperationalTableStatusBadge } from "@/components/floor/OperationalTableStatusBadge";
import { formatOperationalTableLabel } from "@/components/floor/formatters";
import { Button, SearchInput, Skeleton, StatusMessage } from "@/components/ui";
import { shouldRetryApiRequest } from "@/lib/api/client";
import { loadSupervisorFloorData } from "@/lib/supervisor/floor";
import { normalizeSupervisorFloorTables } from "@/lib/supervisor/floor-model";
import {
  buildTransferTableTargets,
  type TransferTableTarget,
} from "@/lib/supervisor/transfer-table";
import { cn } from "@/lib/utils/cn";

// Bounded, branch-scoped selector of eligible TARGET tables for Transfer table.
// Reuses the Supervisor Floor query (same query key → cache hit, no request
// storm) so occupancy/reservation context is derived from already-loaded data.
// Excludes the current table; never fetches cross-branch or historical tables.

type SupervisorTableTargetSelectorProps = {
  token: string;
  branchId: string;
  sourceTableId: string | null;
  selectedTableId?: string | null;
  onSelect: (target: TransferTableTarget) => void;
};

export function SupervisorTableTargetSelector({
  branchId,
  onSelect,
  selectedTableId,
  sourceTableId,
  token,
}: SupervisorTableTargetSelectorProps) {
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["supervisor", "floor", branchId],
    queryFn: () => loadSupervisorFloorData(token, branchId),
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
  });

  const targets = useMemo(() => {
    const normalized = normalizeSupervisorFloorTables({
      tables: query.data?.tables || [],
      activeOrders: query.data?.activeOrders || [],
      reservations: query.data?.reservations || [],
    });
    const candidates = normalized.map((table) => ({
      id: table.id,
      label: table.label,
      // The normalized Supervisor Floor only yields available/occupied/reserved
      // (cleaning/blocked tables are filtered out upstream); coerce for the type.
      status:
        table.status === "occupied" || table.status === "reserved" ? table.status : ("available" as const),
      capacity: table.capacity,
      reservationTime: table.reservationTime,
      activeOrderId: table.activeOrderId,
    }));
    return buildTransferTableTargets(candidates, sourceTableId);
  }, [query.data, sourceTableId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return targets;
    return targets.filter((target) => target.label.toLowerCase().includes(term));
  }, [search, targets]);

  return (
    <div className="grid gap-3">
      <SearchInput
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search tables by label"
        aria-label="Search target tables"
      />

      {query.isError ? (
        <StatusMessage tone="warning" title="Could not load target tables">
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
          {targets.length === 0
            ? "No other tables are available in this branch."
            : "No tables match your search."}
        </p>
      ) : (
        <ul className="grid max-h-64 gap-2 overflow-y-auto" role="radiogroup" aria-label="Target table">
          {filtered.map((target) => {
            const isSelected = target.id === selectedTableId;
            return (
              <li key={target.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelect(target)}
                  className={cn(
                    "grid w-full gap-1 rounded-md border p-3 text-left focus-visible:shadow-focus",
                    isSelected
                      ? "border-brand-navy-900 bg-brand-white shadow-panel"
                      : "border-border-subtle bg-surface hover:bg-surface-muted",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold text-text-primary" title={target.label}>
                      {formatOperationalTableLabel(target.label) || target.label}
                    </span>
                    <OperationalTableStatusBadge status={target.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-text-muted">
                    <span>{target.capacity ? `${target.capacity} seats` : "Capacity unavailable"}</span>
                  </div>
                  {target.warning ? (
                    <p className="text-sm font-semibold text-status-warning">{target.warning}</p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
