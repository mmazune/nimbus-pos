import { Funnel, ReceiptX } from "@phosphor-icons/react";

import { CASHIER_QUEUE_FILTERS, type CashierQueueFilterId } from "@/lib/cashier/queue-filters";
import { cn } from "@/lib/utils/cn";

type CashierQueueFilterChipsProps = {
  activeFilter: CashierQueueFilterId;
  onChange: (filter: CashierQueueFilterId) => void;
};

export function CashierQueueFilterChips({ activeFilter, onChange }: CashierQueueFilterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Queue filters">
      {CASHIER_QUEUE_FILTERS.map((filter) => {
        const active = activeFilter === filter.id;
        const disabled = Boolean(filter.disabled);
        const Icon = filter.id === "closed-today" ? ReceiptX : Funnel;

        return (
          <button
            key={filter.id}
            type="button"
            disabled={disabled}
            title={disabled ? filter.disabledReason : filter.description}
            aria-pressed={!disabled && active}
            aria-describedby={disabled ? `${filter.id}-disabled-reason` : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold",
              "transition-[background-color,color,transform] duration-150 ease-out",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900",
              !disabled && "active:scale-[0.96]",
              active && !disabled
                ? "bg-brand-navy-900 text-text-inverse"
                : "bg-surface-muted text-text-secondary hover:bg-surface",
              disabled && "cursor-not-allowed opacity-60 hover:bg-surface-muted",
            )}
            onClick={() => onChange(filter.id)}
          >
            <Icon size={18} weight={active && !disabled ? "fill" : "bold"} aria-hidden />
            <span>{filter.label}</span>
            {disabled ? (
              <span id={`${filter.id}-disabled-reason`} className="sr-only">
                {filter.disabledReason}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
