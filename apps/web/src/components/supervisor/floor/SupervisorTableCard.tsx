import { Clock, ForkKnife, MapPin, Users } from "@phosphor-icons/react";

import { SupervisorFloorStatusBadge } from "@/components/supervisor/floor/SupervisorFloorStatusBadge";
import type { SupervisorTableViewModel } from "@/lib/supervisor/floor-model";
import { cn } from "@/lib/utils/cn";

type SupervisorTableCardProps = {
  table: SupervisorTableViewModel;
  selected?: boolean;
  onSelect: (table: SupervisorTableViewModel) => void;
};

const cardAccent = {
  available: "bg-status-success-surface text-status-success",
  occupied: "bg-status-info-surface text-status-info",
  reserved: "bg-status-warning-surface text-status-warning",
  blocked: "bg-status-danger-surface text-status-danger",
  other: "bg-status-neutral-surface text-status-neutral",
  all: "bg-status-neutral-surface text-status-neutral",
} as const;

export function SupervisorTableCard({ onSelect, selected, table }: SupervisorTableCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-[224px] w-full flex-col justify-between gap-4 rounded-lg bg-surface p-5 text-left shadow-subtle",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96]",
        "hover:bg-brand-white hover:shadow-panel focus-visible:shadow-focus",
        selected && "bg-brand-white shadow-panel",
      )}
      aria-pressed={selected}
      onClick={() => onSelect(table)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-normal text-text-primary" title={table.name}>
            {table.name}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-text-secondary" title={table.floorPlanName}>
            {table.floorPlanName}
          </p>
        </div>
        <SupervisorFloorStatusBadge status={table.status} />
      </div>

      <div className={cn("rounded-md px-4 py-3", cardAccent[table.status])}>
        <p className="text-xs font-semibold uppercase tracking-normal opacity-80">Service state</p>
        <p className="mt-1 truncate text-base font-bold" title={table.backendStatus}>
          {table.backendStatus}
        </p>
        <p className="mt-2 truncate text-sm font-semibold opacity-90" title={table.activeOrderSummary}>
          {table.activeOrderSummary}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm font-semibold text-text-secondary">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Users size={17} weight="bold" className="shrink-0" aria-hidden />
          <span className="truncate tabular-nums" title={table.capacityLabel}>
            {table.capacityLabel}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <MapPin size={17} weight="bold" className="shrink-0" aria-hidden />
          <span className="truncate" title={table.zoneLabel}>
            {table.zoneLabel}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <ForkKnife size={17} weight="bold" className="shrink-0" aria-hidden />
          <span className="truncate" title={table.assignedServer}>
            {table.assignedServer}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <Clock size={17} weight="bold" className="shrink-0" aria-hidden />
          <span className="truncate" title={table.lastUpdatedLabel}>
            {table.lastUpdatedLabel}
          </span>
        </span>
      </div>
    </button>
  );
}

