import { Input } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { validateSplitBillInput } from "@/lib/cashier/resolution-validation";

type CashierSplitBillEqualFormProps = {
  order: CashierOrderViewModel;
  count: number;
  reason: string;
  disabled?: boolean;
  onCountChange: (count: number) => void;
  onReasonChange: (reason: string) => void;
};

export function CashierSplitBillEqualForm({
  order,
  count,
  reason,
  disabled,
  onCountChange,
  onReasonChange,
}: CashierSplitBillEqualFormProps) {
  const validation = validateSplitBillInput({ order, mode: "EQUAL", equalCount: count, groups: [] });

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-text-primary" htmlFor="cashier-equal-split-count">
        Guest count
      </label>
      <Input
        id="cashier-equal-split-count"
        type="number"
        min={2}
        max={20}
        value={count}
        disabled={disabled}
        onChange={(event) => onCountChange(Number(event.target.value))}
      />

      <label className="block text-sm font-semibold text-text-primary" htmlFor="cashier-equal-split-reason">
        Reason or note
      </label>
      <Input
        id="cashier-equal-split-reason"
        value={reason}
        disabled={disabled}
        maxLength={200}
        placeholder="Optional"
        onChange={(event) => onReasonChange(event.target.value)}
      />

      {validation.previewGroups.length ? (
        <div className="rounded-md bg-surface p-3 shadow-subtle">
          <p className="text-sm font-semibold text-text-primary">Preview</p>
          <dl className="mt-2 space-y-1 text-sm">
            {validation.previewGroups.map((group) => (
              <div key={group.label} className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">{group.label}</dt>
                <dd className="font-bold tabular-nums text-text-primary">
                  {formatCashierMoney(group.amount, order.currencyCode)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
