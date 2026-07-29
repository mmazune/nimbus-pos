import { formatSupervisorMoney, type SupervisorOrderItem } from "@/lib/supervisor/orders";

// Shared line + quantity selection for Supervisor Split items and Move items.
// Not related to Waiter menu entry — it only selects existing order lines and a
// quantity to move (1..ordered). Keyboard accessible, 1024px-safe.

type SupervisorLineSelectorProps = {
  items: SupervisorOrderItem[];
  quantities: Record<string, number>;
  onChange: (orderItemId: string, quantity: number) => void;
  disabled?: boolean;
};

function orderedQuantity(item: SupervisorOrderItem): number {
  return Math.max(0, Math.floor(Number(item.quantity ?? 0)));
}

export function SupervisorLineSelector({
  disabled = false,
  items,
  onChange,
  quantities,
}: SupervisorLineSelectorProps) {
  if (!items.length) {
    return (
      <p className="rounded-md bg-surface-muted px-3 py-4 text-sm text-text-secondary">
        This order has no items to move.
      </p>
    );
  }

  return (
    <ul className="grid gap-2" role="group" aria-label="Select items and quantities to move">
      {items.map((item) => {
        const ordered = orderedQuantity(item);
        const selected = quantities[item.id] ?? 0;
        const eligible = ordered > 0;
        const serving = item.menuItemServing?.label || item.menuItemServing?.format || null;
        const inputId = `line-qty-${item.id}`;
        return (
          <li
            key={item.id}
            className="grid gap-3 rounded-md border border-border-subtle bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-text-primary">{item.menuItem?.name || "Menu item"}</p>
              <p className="mt-0.5 text-sm text-text-muted">
                {serving ? `${serving} • ` : ""}Ordered {ordered}
                {item.subtotal !== undefined && item.subtotal !== null
                  ? ` • ${formatSupervisorMoney(item.subtotal)}`
                  : ""}
              </p>
              {!eligible ? (
                <p className="mt-0.5 text-sm text-status-warning">Not available to move.</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 justify-self-start sm:justify-self-end">
              <label htmlFor={inputId} className="text-sm font-semibold text-text-secondary">
                Move
              </label>
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={0}
                max={ordered}
                step={1}
                value={selected}
                disabled={disabled || !eligible}
                aria-label={`Quantity to move for ${item.menuItem?.name || "item"}, up to ${ordered}`}
                className="h-11 w-20 rounded-md bg-surface-muted px-3 text-base font-semibold tabular-nums text-text-primary shadow-subtle focus-visible:shadow-focus disabled:opacity-50"
                onChange={(event) => {
                  const raw = Math.floor(Number(event.target.value));
                  const clamped = Number.isFinite(raw) ? Math.min(ordered, Math.max(0, raw)) : 0;
                  onChange(item.id, clamped);
                }}
              />
              <span className="text-sm text-text-muted tabular-nums">/ {ordered}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
