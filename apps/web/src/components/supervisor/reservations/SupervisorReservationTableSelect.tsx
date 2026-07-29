import { useQuery } from "@tanstack/react-query";
import { Armchair, WarningCircle } from "@phosphor-icons/react";

import { Badge, Skeleton, StatusMessage } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { fetchSupervisorTables, type SupervisorTableStatus } from "@/lib/supervisor/floor";

type SupervisorReservationTableSelectProps = {
  token: string;
  branchId: string;
  value: string | null;
  partySize?: number | null;
  currentTableId?: string | null;
  allowNone?: boolean;
  disabled?: boolean;
  onChange: (tableId: string | null) => void;
};

const tableStatusTone: Record<SupervisorTableStatus, "success" | "warning" | "info" | "neutral"> = {
  AVAILABLE: "success",
  OCCUPIED: "warning",
  RESERVED: "info",
  CLEANING: "neutral",
};

function statusLabel(status?: string | null) {
  if (!status) return "Status unknown";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

// Bounded, same-branch table selector. Shows table label + capacity + current
// operational state + a capacity-suitability warning. It NEVER exposes other
// guests' reservation data (privacy). The backend remains authoritative for
// time-window conflicts — this selector warns on capacity only and lets the
// server reject a hard conflict, which the caller surfaces as an error.
export function SupervisorReservationTableSelect({
  allowNone = false,
  branchId,
  currentTableId,
  disabled,
  onChange,
  partySize,
  token,
  value,
}: SupervisorReservationTableSelectProps) {
  const tablesQuery = useQuery({
    queryKey: ["supervisor", "tables", branchId],
    enabled: Boolean(token && branchId),
    queryFn: () => fetchSupervisorTables(token, branchId),
    staleTime: 30_000,
    retry: 1,
  });

  if (tablesQuery.isLoading) {
    return (
      <div className="grid gap-2" aria-busy>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (tablesQuery.isError) {
    return (
      <StatusMessage tone="warning" title="Tables could not be loaded">
        Retry, or create the reservation without a table and assign one later.
      </StatusMessage>
    );
  }

  const tables = [...(tablesQuery.data || [])].sort((a, b) =>
    String(a.label || a.id).localeCompare(String(b.label || b.id), undefined, { numeric: true }),
  );

  if (tables.length === 0) {
    return (
      <StatusMessage tone="info" title="No tables configured">
        This branch has no tables to assign. Manager configuration is required.
      </StatusMessage>
    );
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Assign table"
        className="max-h-64 space-y-2 overflow-y-auto pr-1"
      >
        {allowNone ? (
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            disabled={disabled}
            onClick={() => onChange(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm font-semibold",
              "focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60",
              value === null
                ? "border-brand-navy-900 bg-surface text-text-primary"
                : "border-border-subtle bg-surface text-text-secondary hover:bg-brand-white",
            )}
          >
            <span>No table (assign later)</span>
            {value === null ? <Badge variant="info">Selected</Badge> : null}
          </button>
        ) : null}

        {tables.map((table) => {
          const selected = value === table.id;
          const isCurrent = currentTableId === table.id;
          const capacity = typeof table.capacity === "number" ? table.capacity : null;
          const undersized = Boolean(partySize && capacity !== null && capacity < partySize);
          const tone = tableStatusTone[(table.status as SupervisorTableStatus) || "AVAILABLE"] || "neutral";

          return (
            <button
              key={table.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(table.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left",
                "focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60",
                selected
                  ? "border-brand-navy-900 bg-surface"
                  : "border-border-subtle bg-surface hover:bg-brand-white",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Armchair size={18} weight="bold" className="shrink-0 text-text-muted" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-text-primary">
                    {table.label || table.id}
                    {isCurrent ? (
                      <span className="ml-2 text-xs font-semibold text-text-muted">(current)</span>
                    ) : null}
                  </span>
                  <span className="block text-xs font-semibold text-text-secondary">
                    {capacity !== null ? `${capacity} seats` : "Capacity unavailable"}
                    {undersized ? (
                      <span className="ml-1 inline-flex items-center gap-1 text-status-warning">
                        <WarningCircle size={12} weight="fill" aria-hidden /> under party size
                      </span>
                    ) : null}
                  </span>
                </span>
              </span>
              <Badge variant={tone}>{statusLabel(table.status)}</Badge>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs font-medium text-text-muted">
        Table state is a snapshot; the reservation service verifies time-window conflicts on submit.
      </p>
    </div>
  );
}
