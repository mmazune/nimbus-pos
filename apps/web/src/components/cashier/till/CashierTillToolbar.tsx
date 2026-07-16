import { ArrowsClockwise, CashRegister } from "@phosphor-icons/react";

import { Badge, Button } from "@/components/ui";
import type { CashierReadinessSnapshot } from "@/lib/cashier/readiness";

type CashierTillToolbarProps = {
  branchName: string;
  workstationLabel: string;
  readiness: CashierReadinessSnapshot;
  isRefreshing?: boolean;
  onRefresh: () => void;
};

export function CashierTillToolbar({
  branchName,
  workstationLabel,
  readiness,
  isRefreshing,
  onRefresh,
}: CashierTillToolbarProps) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-subtle">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-brand-navy-900">
          <CashRegister size={24} weight="duotone" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text-primary">{branchName}</p>
          <p className="mt-1 truncate text-sm text-text-secondary">{workstationLabel}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={readiness.shift.status === "active" ? "success" : "warning"}>
          {readiness.shift.label}
        </Badge>
        <Badge variant={readiness.till.status === "active" ? "success" : "warning"}>
          {readiness.till.label}
        </Badge>
        <Button
          variant="secondary"
          leadingIcon={<ArrowsClockwise size={18} weight="bold" aria-hidden />}
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh till state"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
