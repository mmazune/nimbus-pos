import { cn } from "@/lib/utils/cn";
import type { SupervisorFloorFilter } from "@/lib/supervisor/floor-model";

const statusClasses: Record<SupervisorFloorFilter, string> = {
  all: "bg-status-neutral-surface text-status-neutral",
  available: "bg-status-success-surface text-status-success",
  occupied: "bg-status-info-surface text-status-info",
  reserved: "bg-status-warning-surface text-status-warning",
  blocked: "bg-status-danger-surface text-status-danger",
  other: "bg-status-neutral-surface text-status-neutral",
};

const labels: Record<SupervisorFloorFilter, string> = {
  all: "All",
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  blocked: "Blocked",
  other: "Other",
};

export function SupervisorFloorStatusBadge({ status }: { status: SupervisorFloorFilter }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold uppercase tracking-normal",
        statusClasses[status],
      )}
    >
      {labels[status]}
    </span>
  );
}

