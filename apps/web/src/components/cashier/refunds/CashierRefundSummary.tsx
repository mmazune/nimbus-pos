import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierRefundSummary as RefundSummary } from "@/lib/cashier/refund-types";

type CashierRefundSummaryProps = {
  summary: RefundSummary;
  currencyCode?: string | null;
  selectedPaymentRefundable?: number;
};

export function CashierRefundSummary({
  summary,
  currencyCode,
  selectedPaymentRefundable,
}: CashierRefundSummaryProps) {
  const rows = [
    { label: "Total paid", value: summary.totalPaid },
    { label: "Already refunded", value: summary.alreadyRefunded },
    { label: "Remaining refundable", value: summary.remainingRefundable },
    { label: "Selected payment refundable", value: selectedPaymentRefundable },
  ];

  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-refund-summary-title">
      <h3 id="cashier-refund-summary-title" className="font-bold text-text-primary">
        Refundable Summary
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md bg-surface-muted p-3">
            <dt className="font-semibold text-text-muted">{row.label}</dt>
            <dd className="mt-1 font-bold tabular-nums text-text-primary">
              {formatCashierMoney(row.value, currencyCode)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
