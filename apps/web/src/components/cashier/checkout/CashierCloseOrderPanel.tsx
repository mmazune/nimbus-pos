import { CheckCircle, Receipt } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { hasPendingCashierPaymentIntent } from "@/lib/cashier/payment-validation";

type CashierCloseOrderPanelProps = {
  order: CashierOrderViewModel;
};

export function CashierCloseOrderPanel({ order }: CashierCloseOrderPanelProps) {
  const settled = order.payment.state === "settled";

  if (order.status === "CLOSED") {
    return (
      <div className="rounded-md bg-status-success-surface p-4 text-status-success">
        <div className="flex items-start gap-3">
          <Receipt size={22} weight="bold" aria-hidden />
          <div>
            <p className="font-semibold">Order closed.</p>
            <p className="mt-1 text-sm font-medium">Receipt can be viewed from Receipts.</p>
          </div>
        </div>
      </div>
    );
  }

  const reason = !settled
    ? "Outstanding balance remains. Close is blocked."
    : hasPendingCashierPaymentIntent(order)
      ? "A provider intent is still pending."
      : "Backend close requires final payment data. Refresh if a manual final payment just auto-settled.";

  return (
    <div className="rounded-md bg-surface-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle size={22} weight="bold" className="text-text-secondary" aria-hidden />
          <div>
            <p className="font-semibold text-text-primary">Close order</p>
            <p className="mt-1 text-sm font-medium text-text-secondary">{reason}</p>
          </div>
        </div>
        <Badge variant={settled ? "warning" : "neutral"}>{settled ? "Refresh" : "Blocked"}</Badge>
      </div>
    </div>
  );
}
