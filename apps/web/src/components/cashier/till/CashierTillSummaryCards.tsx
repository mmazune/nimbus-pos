import type { CashierTillViewModel } from "@/lib/cashier/till-types";
import { cn } from "@/lib/utils/cn";

const toneClasses = {
  neutral: "bg-surface text-text-primary",
  success: "bg-status-success-surface text-status-success",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  info: "bg-status-info-surface text-status-info",
};

type CashierTillSummaryCardsProps = {
  till: CashierTillViewModel;
};

export function CashierTillSummaryCards({ till }: CashierTillSummaryCardsProps) {
  return (
    <section aria-labelledby="cashier-till-summary-title">
      <div className="flex items-center justify-between">
        <h2 id="cashier-till-summary-title" className="text-lg font-bold text-text-primary">
          Cash Position
        </h2>
        <p className="text-sm font-semibold text-text-muted">Unavailable fields are not treated as zero.</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {till.metrics.map((item) => (
          <div key={item.key} className={cn("rounded-lg p-4 shadow-subtle", toneClasses[item.tone])}>
            <p className="text-xs font-semibold uppercase tracking-normal opacity-80">{item.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{item.formattedValue}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
