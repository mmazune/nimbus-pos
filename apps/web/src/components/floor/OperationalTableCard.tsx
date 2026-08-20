import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import { OperationalTableStatusBadge } from "./OperationalTableStatusBadge";
import { formatOperationalTableLabel, operationalTableStatusLabels } from "./formatters";
import type { OperationalTableViewModel } from "./types";

type OperationalTableCardProps<T extends OperationalTableViewModel> = {
  table: T;
  selected?: boolean;
  /**
   * Collision-safe abbreviation for the fetched set (see
   * `buildOperationalTableLabelMap`). Falls back to the pure formatter so the
   * card is still correct when rendered outside `OperationalFloor`.
   */
  displayLabel?: string;
  onSelect: (table: T) => void;
};

function TableMiddle({ table }: { table: OperationalTableViewModel }) {
  if (table.status === "available") {
    return <p className="text-sm font-medium text-text-muted">Ready for seating</p>;
  }

  if (table.status === "reserved") {
    return (
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">Reservation</p>
        {table.reservationTime ? (
          <p className="mt-1 text-sm font-medium tabular-nums text-text-muted">
            {table.reservationTime}
          </p>
        ) : null}
      </div>
    );
  }

  if (table.status === "blocked") {
    return <p className="text-sm font-medium text-text-muted">Temporarily unavailable</p>;
  }

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p
          className="truncate text-sm font-semibold text-text-primary"
          title={table.assignedStaffName || "Assigned waiter unavailable"}
        >
          {table.assignedStaffName || "Assigned waiter unavailable"}
        </p>
        {table.isMine ? <Badge variant="info">Mine</Badge> : null}
      </div>
    </div>
  );
}

export function OperationalTableCard<T extends OperationalTableViewModel>({
  displayLabel,
  onSelect,
  selected = false,
  table,
}: OperationalTableCardProps<T>) {
  const statusLabel = operationalTableStatusLabels[table.status];
  const capacityLabel = table.capacity ? `${table.capacity} seats` : "seat capacity unavailable";
  // Display-side abbreviation only — the full label stays in title + aria-label.
  const shortLabel = displayLabel || formatOperationalTableLabel(table.label) || table.label;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${table.label}, ${statusLabel}, ${capacityLabel}`}
      data-operational-table-id={table.id}
      data-operational-table-label={table.label}
      className={cn(
        // Density pass (owner-approved 2026-08-20): the previously locked 176px card
        // height is now the rem-based 9.5rem, so it tracks the viewport-scaled root
        // font size (~152px at 1920x1080, ~141px at 1440x900, ~128px at 1280x680).
        "flex min-h-[9.5rem] w-full min-w-0 flex-col justify-between gap-3 rounded-lg border bg-surface p-4 text-left shadow-subtle",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96]",
        "hover:bg-brand-white hover:shadow-panel focus-visible:shadow-focus",
        selected ? "border-brand-navy-900 shadow-panel" : "border-transparent",
        table.status === "occupied" && !table.isMine && "bg-status-neutral-surface",
        table.status === "blocked" && "bg-status-danger-surface",
      )}
      onClick={() => onSelect(table)}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className="min-w-0 truncate text-lg font-bold leading-6 tracking-normal text-text-primary"
          title={table.label}
        >
          {shortLabel}
        </p>
        <span className="shrink-0">
          <OperationalTableStatusBadge status={table.status} />
        </span>
      </div>

      <TableMiddle table={table} />

      <div className="text-xs font-semibold text-text-secondary">
        <span className="tabular-nums">{capacityLabel}</span>
      </div>
    </button>
  );
}
