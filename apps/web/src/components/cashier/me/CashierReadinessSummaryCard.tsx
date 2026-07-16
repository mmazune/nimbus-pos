import { ClockClockwise, Wallet } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { Badge, Card } from "@/components/ui";
import type { CashierReadinessSnapshot, CashierReadinessState } from "@/lib/cashier/readiness";
import type { CashierReadinessTone } from "@/lib/cashier/state";
import { cn } from "@/lib/utils/cn";

type CashierReadinessSummaryCardProps = {
  readiness: CashierReadinessSnapshot;
};

const toneClasses: Record<CashierReadinessTone, string> = {
  neutral: "bg-status-neutral-surface text-status-neutral",
  success: "bg-status-success-surface text-status-success",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  info: "bg-status-info-surface text-status-info",
};

function ReadinessBlock({
  label,
  state,
  icon,
}: {
  label: string;
  state: CashierReadinessState;
  icon: ReactNode;
}) {
  return (
    <div className={cn("rounded-md p-4", toneClasses[state.tone])}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <p className="text-sm font-bold">{label}</p>
        </div>
        <Badge variant={state.tone === "danger" ? "danger" : state.tone === "success" ? "success" : state.tone === "warning" ? "warning" : "neutral"}>
          {state.status}
        </Badge>
      </div>
      <p className="mt-3 text-base font-bold">{state.label}</p>
      <p className="mt-1 text-sm leading-6">{state.detail}</p>
    </div>
  );
}

export function CashierReadinessSummaryCard({ readiness }: CashierReadinessSummaryCardProps) {
  return (
    <Card aria-labelledby="cashier-readiness-title">
      <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">Shift & till</p>
      <h2 id="cashier-readiness-title" className="mt-1 text-lg font-bold tracking-normal text-text-primary">
        Readiness Summary
      </h2>
      <div className="mt-5 grid gap-3">
        <ReadinessBlock
          label="Shift"
          state={readiness.shift}
          icon={<ClockClockwise size={18} weight="bold" aria-hidden />}
        />
        <ReadinessBlock
          label="Till"
          state={readiness.till}
          icon={<Wallet size={18} weight="bold" aria-hidden />}
        />
      </div>
      <p className="mt-4 rounded-md bg-surface-muted p-3 text-sm font-semibold leading-6 text-text-secondary">
        Cash checkout requires an active till.
      </p>
    </Card>
  );
}
