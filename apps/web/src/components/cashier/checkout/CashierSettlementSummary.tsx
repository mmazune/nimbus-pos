import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";

type CashierSettlementSummaryProps = {
  order: CashierOrderViewModel;
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-semibold text-text-primary" : "text-text-secondary"}>{label}</span>
      <span className={strong ? "font-bold tabular-nums text-text-primary" : "font-semibold tabular-nums text-text-primary"}>
        {value}
      </span>
    </div>
  );
}

export function CashierSettlementSummary({ order }: CashierSettlementSummaryProps) {
  return (
    <div className="rounded-md bg-surface-muted p-4 text-sm">
      <Row label="Total" value={order.formattedTotal} />
      <Row label="Paid" value={formatCashierMoney(order.payment.paid, order.currencyCode)} />
      <div className="mt-2 border-t border-border pt-2">
        <Row
          label="Remaining"
          value={formatCashierMoney(order.payment.outstanding, order.currencyCode)}
          strong
        />
      </div>
    </div>
  );
}
