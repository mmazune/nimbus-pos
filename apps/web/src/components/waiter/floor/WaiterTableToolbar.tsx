import { SlidersHorizontal } from "@phosphor-icons/react";

import { SearchInput } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { WaiterTableFilter } from "@/lib/waiter/floor-model";

type FilterOption = {
  value: WaiterTableFilter;
  label: string;
};

type WaiterTableToolbarProps = {
  query: string;
  filter: WaiterTableFilter;
  counts: Record<WaiterTableFilter, number>;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: WaiterTableFilter) => void;
};

const filters: FilterOption[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "mine", label: "Mine" },
];

export function WaiterTableToolbar({
  query,
  filter,
  counts,
  onQueryChange,
  onFilterChange,
}: WaiterTableToolbarProps) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-subtle">
      <div className="grid grid-cols-[minmax(360px,480px)_1fr] items-center gap-4">
        <SearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search table, guest, or order"
          aria-label="Search tables"
        />

        <div className="flex items-center justify-end gap-2">
          <span className="mr-1 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <SlidersHorizontal size={18} weight="bold" aria-hidden />
            Filters
          </span>
          {filters.map((option) => {
            const active = option.value === filter;

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold",
                  "transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.96]",
                  active
                    ? "bg-brand-navy-900 text-text-inverse shadow-subtle"
                    : "bg-surface-muted text-text-secondary hover:bg-brand-white hover:text-text-primary hover:shadow-subtle",
                )}
                onClick={() => onFilterChange(option.value)}
              >
                <span>{option.label}</span>
                <span className="tabular-nums text-xs opacity-80">{counts[option.value]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
