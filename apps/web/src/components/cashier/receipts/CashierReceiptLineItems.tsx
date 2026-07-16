import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierReceiptViewModel } from "@/lib/cashier/receipt-types";

type CashierReceiptLineItemsProps = {
  receipt: CashierReceiptViewModel;
};

export function CashierReceiptLineItems({ receipt }: CashierReceiptLineItemsProps) {
  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-receipt-lines-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="cashier-receipt-lines-title" className="font-bold text-text-primary">
          Items
        </h3>
        <span className="text-sm font-semibold text-text-muted">{receipt.lines.length} lines</span>
      </div>

      {receipt.lines.length === 0 ? (
        <p className="mt-3 rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
          No receipt lines returned.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-border-subtle">
          {receipt.lines.map((line) => (
            <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-text-primary">
                  {line.quantity}x {line.name}
                </p>
                {[line.serving, line.modifierSummary, line.notes].filter(Boolean).map((detail) => (
                  <p key={detail} className="mt-1 text-xs font-medium text-text-secondary">
                    {detail}
                  </p>
                ))}
                <p className="mt-1 text-xs font-semibold tabular-nums text-text-muted">
                  Unit {formatCashierMoney(line.unitPrice, receipt.currencyCode)}
                </p>
              </div>
              <p className="font-bold tabular-nums text-text-primary">
                {formatCashierMoney(line.lineTotal, receipt.currencyCode)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
