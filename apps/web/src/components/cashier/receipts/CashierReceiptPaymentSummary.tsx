import { formatCashierDateTime, formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierReceiptViewModel } from "@/lib/cashier/receipt-types";

type CashierReceiptPaymentSummaryProps = {
  receipt: CashierReceiptViewModel;
};

export function CashierReceiptPaymentSummary({ receipt }: CashierReceiptPaymentSummaryProps) {
  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-receipt-payments-title">
      <h3 id="cashier-receipt-payments-title" className="font-bold text-text-primary">
        Payment Summary
      </h3>

      {receipt.payments.length === 0 ? (
        <p className="mt-3 rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
          No payment rows returned.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {receipt.payments.map((payment) => (
            <div key={payment.id} className="rounded-md bg-surface-muted p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-text-primary">{payment.method}</p>
                  <p className="mt-1 text-xs font-semibold text-text-secondary">{payment.status}</p>
                  {payment.reference ? (
                    <p className="mt-1 truncate text-xs font-semibold text-text-muted">
                      Ref {payment.reference}
                    </p>
                  ) : null}
                </div>
                <p className="font-bold tabular-nums text-text-primary">
                  {formatCashierMoney(payment.amount, receipt.currencyCode)}
                </p>
              </div>
              {payment.postedAt ? (
                <p className="mt-2 text-xs font-semibold tabular-nums text-text-muted">
                  {formatCashierDateTime(payment.postedAt)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
