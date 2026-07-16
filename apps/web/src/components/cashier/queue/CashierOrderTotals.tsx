import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";

type CashierOrderTotalsProps = {
  order: CashierOrderViewModel;
};

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-semibold text-text-primary" : "text-text-secondary"}>{label}</span>
      <span className={strong ? "font-bold tabular-nums text-text-primary" : "font-semibold tabular-nums text-text-primary"}>
        {value}
      </span>
    </div>
  );
}

export function CashierOrderTotals({ order }: CashierOrderTotalsProps) {
  return (
    <div className="space-y-2 text-sm">
      <Row label="Subtotal" value={formatCashierMoney(order.subtotal, order.currencyCode)} />
      <Row label="Tax" value={formatCashierMoney(order.tax, order.currencyCode)} />
      <Row label="Discount" value={formatCashierMoney(order.discount, order.currencyCode)} />
      <div className="border-t border-border pt-2">
        <Row label="Total" value={order.formattedTotal} strong />
      </div>
      <Row label="Paid" value={formatCashierMoney(order.payment.paid, order.currencyCode)} />
      <Row
        label="Outstanding"
        value={formatCashierMoney(order.payment.outstanding, order.currencyCode)}
        strong
      />
    </div>
  );
}
