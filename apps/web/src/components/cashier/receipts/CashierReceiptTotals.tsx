import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierReceiptViewModel } from "@/lib/cashier/receipt-types";

type CashierReceiptTotalsProps = {
  receipt: CashierReceiptViewModel;
};

export function CashierReceiptTotals({ receipt }: CashierReceiptTotalsProps) {
  const rows = [
    ["Subtotal", receipt.subtotal],
    ["Tax", receipt.tax],
    ["Discount", receipt.discount],
    ["Service charge", receipt.serviceCharge],
    ["Total", receipt.total],
    ["Paid", receipt.paid],
    ["Outstanding", receipt.outstanding],
  ] as const;

  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-receipt-totals-title">
      <h3 id="cashier-receipt-totals-title" className="font-bold text-text-primary">
        Totals
      </h3>
      <dl className="mt-3 space-y-2">
        {rows.map(([label, value]) =>
          value === undefined ? null : (
            <div key={label} className="flex items-center justify-between gap-4 text-sm">
              <dt className="font-semibold text-text-secondary">{label}</dt>
              <dd className="font-bold tabular-nums text-text-primary">
                {formatCashierMoney(value, receipt.currencyCode)}
              </dd>
            </div>
          ),
        )}
      </dl>
    </section>
  );
}
