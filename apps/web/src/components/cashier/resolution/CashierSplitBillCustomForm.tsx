import { Plus, Trash } from "@phosphor-icons/react";

import { Button, Input } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import type { CashierSplitBillGroupInput } from "@/lib/cashier/resolution-types";
import { validateSplitBillInput } from "@/lib/cashier/resolution-validation";

type CashierSplitBillCustomFormProps = {
  order: CashierOrderViewModel;
  groups: CashierSplitBillGroupInput[];
  reason: string;
  disabled?: boolean;
  onGroupsChange: (groups: CashierSplitBillGroupInput[]) => void;
  onReasonChange: (reason: string) => void;
};

export function CashierSplitBillCustomForm({
  order,
  groups,
  reason,
  disabled,
  onGroupsChange,
  onReasonChange,
}: CashierSplitBillCustomFormProps) {
  const validation = validateSplitBillInput({ order, mode: "CUSTOM", equalCount: 2, groups });
  const allocated = validation.previewGroups.reduce((sum, group) => sum + (group.amount || 0), 0);

  function updateGroup(index: number, patch: CashierSplitBillGroupInput) {
    onGroupsChange(groups.map((group, groupIndex) => (groupIndex === index ? { ...group, ...patch } : group)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">Custom groups</p>
        <Button
          variant="secondary"
          size="compact"
          leadingIcon={<Plus size={16} weight="bold" aria-hidden />}
          disabled={disabled || groups.length >= 20}
          onClick={() => onGroupsChange([...groups, { label: `Guest ${groups.length + 1}`, amount: "" }])}
        >
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {groups.map((group, index) => (
          <div key={`split-group-${index}`} className="grid grid-cols-[minmax(0,1fr)_8rem_2.5rem] gap-2">
            <Input
              aria-label={`Guest ${index + 1} label`}
              value={group.label || ""}
              maxLength={80}
              disabled={disabled}
              placeholder={`Guest ${index + 1}`}
              onChange={(event) => updateGroup(index, { label: event.target.value })}
            />
            <Input
              aria-label={`Guest ${index + 1} amount`}
              value={group.amount || ""}
              disabled={disabled}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(event) => updateGroup(index, { amount: event.target.value })}
            />
            <button
              type="button"
              className="flex h-11 w-10 items-center justify-center rounded-md bg-surface text-text-secondary shadow-subtle transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900 disabled:pointer-events-none disabled:text-text-muted"
              aria-label={`Remove guest ${index + 1}`}
              disabled={disabled || groups.length <= 2}
              onClick={() => onGroupsChange(groups.filter((_, groupIndex) => groupIndex !== index))}
            >
              <Trash size={17} weight="bold" aria-hidden />
            </button>
          </div>
        ))}
      </div>

      <label className="block text-sm font-semibold text-text-primary" htmlFor="cashier-custom-split-reason">
        Reason or note
      </label>
      <Input
        id="cashier-custom-split-reason"
        value={reason}
        disabled={disabled}
        maxLength={200}
        placeholder="Optional"
        onChange={(event) => onReasonChange(event.target.value)}
      />

      <div className="rounded-md bg-surface p-3 text-sm shadow-subtle">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-text-secondary">Allocated</span>
          <span className="font-bold tabular-nums text-text-primary">
            {formatCashierMoney(allocated, order.currencyCode)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="font-medium text-text-secondary">Order total</span>
          <span className="font-bold tabular-nums text-text-primary">
            {formatCashierMoney(order.total, order.currencyCode)}
          </span>
        </div>
      </div>
    </div>
  );
}
