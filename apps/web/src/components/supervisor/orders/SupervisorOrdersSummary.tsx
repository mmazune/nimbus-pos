import { CurrencyCircleDollar, ForkKnife, Receipt, WarningCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import { Card } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type SupervisorOrdersSummaryProps = {
  activeCount: number;
  inProgressCount: number;
  payableCount: number;
  partiallyPaidCount: number;
  exceptionCount: number;
  paymentsLoading?: boolean;
};

type SummaryCardProps = {
  icon: Icon;
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "warning" | "danger" | "success";
};

const toneClasses = {
  neutral: "bg-surface text-brand-navy-900",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  success: "bg-status-success-surface text-status-success",
};

function SummaryCard({ detail, icon: Icon, label, tone = "neutral", value }: SummaryCardProps) {
  return (
    <Card className="min-h-[136px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-secondary">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-normal text-text-primary">
            {value}
          </p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-md", toneClasses[tone])}>
          <Icon size={24} weight="bold" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{detail}</p>
    </Card>
  );
}

export function SupervisorOrdersSummary({
  activeCount,
  exceptionCount,
  inProgressCount,
  partiallyPaidCount,
  payableCount,
  paymentsLoading,
}: SupervisorOrdersSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <SummaryCard
        icon={Receipt}
        label="Active orders"
        value={activeCount}
        detail="Open, sent, kitchen, ready, and served orders."
      />
      <SummaryCard
        icon={ForkKnife}
        label="In progress"
        value={inProgressCount}
        detail="New, sent, or currently in kitchen."
        tone="success"
      />
      <SummaryCard
        icon={CurrencyCircleDollar}
        label="Payable"
        value={payableCount}
        detail="Service states that can need cashier attention."
        tone="warning"
      />
      <SummaryCard
        icon={CurrencyCircleDollar}
        label="Partial paid"
        value={partiallyPaidCount}
        detail={paymentsLoading ? "Refreshing payment reads." : "Computed from payment summary reads."}
        tone={partiallyPaidCount > 0 ? "warning" : "neutral"}
      />
      <SummaryCard
        icon={WarningCircle}
        label="Watch list"
        value={exceptionCount}
        detail="Partial, pending, failed, missing table, or stale 45m+."
        tone={exceptionCount > 0 ? "danger" : "neutral"}
      />
    </div>
  );
}
