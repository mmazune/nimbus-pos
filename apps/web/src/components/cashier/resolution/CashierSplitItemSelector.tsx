import { Input } from "@/components/ui";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";

type CashierSplitItemSelectorProps = {
  order: CashierOrderViewModel;
  quantities: Record<string, number>;
  disabled?: boolean;
  onQuantityChange: (lineId: string, quantity: number) => void;
};

function clampQuantity(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.floor(value)));
}

export function CashierSplitItemSelector({
  order,
  quantities,
  disabled,
  onQuantityChange,
}: CashierSplitItemSelectorProps) {
  if (!order.lines.length) {
    return (
      <p className="rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
        Item detail must load before item split or move actions.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {order.lines.map((line) => {
        const selected = quantities[line.id] || 0;
        const checked = selected > 0;

        return (
          <div key={line.id} className="rounded-md bg-surface p-3 shadow-subtle">
            <div className="flex items-start gap-3">
              <input
                id={`cashier-resolution-line-${line.id}`}
                type="checkbox"
                className="mt-1 h-5 w-5 rounded border-brand-silver text-brand-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onQuantityChange(line.id, event.target.checked ? 1 : 0)}
              />
              <label htmlFor={`cashier-resolution-line-${line.id}`} className="min-w-0 flex-1">
                <span className="block font-semibold text-text-primary">{line.name}</span>
                <span className="mt-1 block text-xs font-medium text-text-secondary">
                  Available quantity: {line.quantity}
                </span>
              </label>
              <div className="w-24">
                <Input
                  aria-label={`Quantity for ${line.name}`}
                  type="number"
                  min={0}
                  max={line.quantity}
                  value={selected}
                  disabled={disabled || !checked}
                  onChange={(event) => {
                    onQuantityChange(line.id, clampQuantity(Number(event.target.value), line.quantity));
                  }}
                  className="min-h-10 px-3 text-center text-sm"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
