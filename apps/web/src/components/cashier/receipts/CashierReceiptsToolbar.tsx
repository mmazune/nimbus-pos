import { MagnifyingGlass } from "@phosphor-icons/react";

import { Input } from "@/components/ui";
import type { CashierReceiptFilterId } from "@/lib/cashier/receipt-types";

const filters: Array<{ id: CashierReceiptFilterId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "closed", label: "Closed" },
  { id: "paid", label: "Paid" },
  { id: "pending-send", label: "Pending Send" },
  { id: "reprinted", label: "Reprinted" },
];

type CashierReceiptsToolbarProps = {
  activeFilter: CashierReceiptFilterId;
  search: string;
  onFilterChange: (filter: CashierReceiptFilterId) => void;
  onSearchChange: (value: string) => void;
};

export function CashierReceiptsToolbar({
  activeFilter,
  search,
  onFilterChange,
  onSearchChange,
}: CashierReceiptsToolbarProps) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-subtle">
      <label className="block" htmlFor="cashier-receipt-search">
        <span className="text-sm font-semibold text-text-secondary">Search receipts</span>
        <div className="relative mt-2">
          <MagnifyingGlass
            size={20}
            weight="bold"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <Input
            id="cashier-receipt-search"
            name="receiptSearch"
            className="pl-10"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Order, table, server, method, amount..."
            autoComplete="off"
          />
        </div>
      </label>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Receipt filters">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`min-h-11 rounded-md px-4 text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900 ${
              activeFilter === filter.id
                ? "bg-brand-navy-900 text-text-inverse shadow-subtle"
                : "bg-surface-muted text-text-secondary hover:bg-surface"
            }`}
            aria-pressed={activeFilter === filter.id}
            onClick={() => onFilterChange(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
