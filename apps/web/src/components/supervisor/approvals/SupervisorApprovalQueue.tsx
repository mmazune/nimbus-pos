import { ClipboardText } from "@phosphor-icons/react";

import { Badge, Skeleton } from "@/components/ui";
import { SupervisorEmptyState } from "@/components/supervisor/states";
import {
  formatSupervisorApprovalDate,
  getSupervisorApprovalSeverityTone,
  getSupervisorApprovalStatusTone,
  type SupervisorApprovalItem,
} from "@/lib/supervisor/approvals";

type SupervisorApprovalQueueProps = {
  items: SupervisorApprovalItem[];
  selectedItemId?: string | null;
  isLoading?: boolean;
  onSelectItem: (item: SupervisorApprovalItem) => void;
};

export function SupervisorApprovalQueue({
  isLoading,
  items,
  onSelectItem,
  selectedItemId,
}: SupervisorApprovalQueueProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4" aria-label="Loading approval rows">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[152px]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <SupervisorEmptyState
        icon={<ClipboardText size={28} weight="duotone" aria-hidden />}
        title="No approval rows match this view."
        description="Available domain APIs returned no rows for the current filter and search."
        note="Unavailable domains are shown separately instead of counted as zero."
      />
    );
  }

  return (
    <div className="grid gap-4" aria-label="Supervisor approval queue">
      {items.map((item) => {
        const selected = item.id === selectedItemId;

        return (
          <button
            key={`${item.domain}-${item.id}`}
            type="button"
            className={`min-h-[148px] w-full rounded-lg bg-surface p-5 text-left shadow-subtle transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-brand-white focus-visible:shadow-focus active:scale-[0.96] ${
              selected ? "ring-2 ring-brand-navy-900" : ""
            }`}
            onClick={() => onSelectItem(item)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{item.domainLabel}</Badge>
                  <Badge variant={getSupervisorApprovalStatusTone(item.status)}>{item.statusLabel}</Badge>
                  {item.severity !== "unavailable" ? (
                    <Badge variant={getSupervisorApprovalSeverityTone(item.severity)}>{item.severityLabel}</Badge>
                  ) : null}
                </div>
                <p className="mt-3 truncate text-lg font-bold tracking-normal text-text-primary" title={item.reference}>
                  {item.reference}
                </p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">{item.reason}</p>
              </div>
              <p className="shrink-0 text-right text-base font-bold tabular-nums text-text-primary">
                {item.amountLabel}
              </p>
            </div>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="font-semibold text-text-muted">Requester</p>
                <p className="mt-1 truncate font-bold text-text-primary" title={item.requester}>
                  {item.requester}
                </p>
              </div>
              <div>
                <p className="font-semibold text-text-muted">Order / employee</p>
                <p className="mt-1 truncate font-bold text-text-primary" title={item.orderReference || item.employeeName || "Reference unavailable"}>
                  {item.orderReference || item.employeeName || "Reference unavailable"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-text-muted">Updated</p>
                <p className="mt-1 truncate font-bold text-text-primary">
                  {formatSupervisorApprovalDate(item.updatedAt || item.createdAt)}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
