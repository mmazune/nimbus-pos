import { formatReceiptMoney } from "@/lib/waiter/receipt-model";

import type { WaiterReceiptViewModel } from "@/lib/waiter/receipt-model";

type WaiterReceiptTotalsProps = {
  receipt: WaiterReceiptViewModel;
};

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={strong ? "flex items-center justify-between text-lg" : "flex items-center justify-between text-sm"}>
      <span className={strong ? "font-bold text-text-primary" : "font-medium text-text-secondary"}>
        {label}
      </span>
      <span className={strong ? "font-bold tabular-nums text-text-primary" : "font-bold tabular-nums text-text-primary"}>
        {value}
      </span>
    </div>
  );
}

export function WaiterReceiptTotals({ receipt }: WaiterReceiptTotalsProps) {
  return (
    <div className="grid gap-2 border-t border-border-subtle pt-4">
      <TotalRow
        label="Subtotal"
        value={formatReceiptMoney(receipt.subtotal, receipt.currencyCode, "Subtotal unavailable")}
      />
      <TotalRow
        label="Tax"
        value={formatReceiptMoney(receipt.tax, receipt.currencyCode, "Tax unavailable")}
      />
      {receipt.discount !== undefined && receipt.discount > 0 ? (
        <TotalRow
          label="Discount"
          value={`-${formatReceiptMoney(receipt.discount, receipt.currencyCode)}`}
        />
      ) : null}
      {receipt.serviceCharge !== undefined && receipt.serviceCharge > 0 ? (
        <TotalRow
          label="Service charge"
          value={formatReceiptMoney(receipt.serviceCharge, receipt.currencyCode)}
        />
      ) : null}
      <div className="mt-2 rounded-md bg-brand-navy-900 px-4 py-3 text-text-inverse">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-bold">Total</span>
          <span className="text-2xl font-bold tabular-nums">
            {formatReceiptMoney(receipt.total, receipt.currencyCode)}
          </span>
        </div>
      </div>
      <TotalRow
        label="Paid"
        value={formatReceiptMoney(receipt.paid, receipt.currencyCode, "Paid unavailable")}
      />
      <TotalRow
        label="Outstanding"
        value={formatReceiptMoney(receipt.outstanding, receipt.currencyCode, "Outstanding unavailable")}
        strong
      />
    </div>
  );
}
