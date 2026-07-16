import { Badge } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { amountFromUnknown, parseCashierSplitBillMetadata } from "@/lib/cashier/resolution-validation";

type CashierSplitBillSummaryProps = {
  order: CashierOrderViewModel;
};

export function CashierSplitBillSummary({ order }: CashierSplitBillSummaryProps) {
  const splitBill = parseCashierSplitBillMetadata(order.metadata);

  if (!splitBill) {
    return (
      <p className="rounded-md bg-surface p-3 text-sm font-medium text-text-secondary shadow-subtle">
        No split allocation is recorded on this order yet.
      </p>
    );
  }

  return (
    <div className="rounded-md bg-surface p-3 shadow-subtle">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">Recorded split allocation</p>
          <p className="mt-1 text-xs font-medium text-text-secondary">
            {splitBill.reason || "No reason recorded."}
          </p>
        </div>
        <Badge variant="info">{splitBill.mode === "CUSTOM" ? "Custom" : "Equal"}</Badge>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        {(splitBill.groups || []).map((group, index) => (
          <div key={group.groupId || `${group.label}-${index}`} className="flex items-center justify-between gap-3">
            <dt className="font-medium text-text-secondary">{group.label || `Guest ${index + 1}`}</dt>
            <dd className="font-bold tabular-nums text-text-primary">
              {formatCashierMoney(amountFromUnknown(group.amount), order.currencyCode)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
