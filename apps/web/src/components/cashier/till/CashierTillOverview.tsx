import { ClockClockwise, UserCircle } from "@phosphor-icons/react";

import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierTillViewModel } from "@/lib/cashier/till-types";

import { CashierTillStatusBadge } from "./CashierTillStatusBadge";
import { CashierVarianceBadge } from "./CashierVarianceBadge";

type CashierTillOverviewProps = {
  till: CashierTillViewModel;
};

export function CashierTillOverview({ till }: CashierTillOverviewProps) {
  return (
    <section className="rounded-lg bg-surface p-5 shadow-subtle" aria-labelledby="cashier-till-overview-title">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id="cashier-till-overview-title" className="text-xl font-bold tracking-normal text-text-primary">
            {till.tillCode}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {till.shiftNumber} opened {till.openedAtLabel}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <CashierTillStatusBadge status={till.status} />
          <CashierVarianceBadge value={till.variance} currencyCode={till.currencyCode} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-md bg-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Opening Float</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
            {formatCashierMoney(till.openingFloat, till.currencyCode)}
          </p>
        </div>
        <div className="rounded-md bg-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Expected Cash</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
            {formatCashierMoney(till.expectedCash, till.currencyCode)}
          </p>
        </div>
        <div className="rounded-md bg-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Safe Drops</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
            {formatCashierMoney(till.safeDrops, till.currencyCode)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 rounded-md bg-page p-3 text-text-secondary">
          <UserCircle size={20} weight="bold" className="text-status-info" aria-hidden />
          <span className="min-w-0 truncate">Operator: {till.operatorName}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-page p-3 text-text-secondary">
          <ClockClockwise size={20} weight="bold" className="text-status-info" aria-hidden />
          <span className="min-w-0 truncate">
            {till.reconciledAtLabel ? `Reconciled ${till.reconciledAtLabel}` : "Till is open"}
          </span>
        </div>
      </div>
    </section>
  );
}
