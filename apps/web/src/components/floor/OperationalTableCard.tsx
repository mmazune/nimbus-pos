import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import { OperationalTableStatusBadge } from "./OperationalTableStatusBadge";
import { operationalTableStatusLabels } from "./formatters";
import type { OperationalTableViewModel } from "./types";

type OperationalTableCardProps<T extends OperationalTableViewModel> = {
  table: T;
  selected?: boolean;
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
  onSelect,
  selected = false,
  table,
}: OperationalTableCardProps<T>) {
  const statusLabel = operationalTableStatusLabels[table.status];
  const capacityLabel = table.capacity ? `${table.capacity} seats` : "seat capacity unavailable";

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${table.label}, ${statusLabel}, ${capacityLabel}`}
      data-operational-table-id={table.id}
      className={cn(
        "flex min-h-[176px] w-full min-w-0 flex-col justify-between gap-5 rounded-lg border bg-surface p-5 text-left shadow-subtle",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96]",
        "hover:bg-brand-white hover:shadow-panel focus-visible:shadow-focus",
        selected ? "border-brand-navy-900 shadow-panel" : "border-transparent",
        table.status === "occupied" && !table.isMine && "bg-status-neutral-surface",
        table.status === "blocked" && "bg-status-danger-surface",
      )}
      onClick={() => onSelect(table)}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="min-w-0 break-words text-xl font-bold leading-6 tracking-normal text-text-primary"
          title={table.label}
        >
          {table.label}
        </p>
        <OperationalTableStatusBadge status={table.status} />
      </div>

      <TableMiddle table={table} />

      <div className="text-sm font-semibold text-text-secondary">
        <span className="tabular-nums">{capacityLabel}</span>
      </div>
    </button>
  );
}
