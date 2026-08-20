import { SlidersHorizontal } from "@phosphor-icons/react";

import { SearchInput } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import type {
  OperationalFloorPlanOption,
  OperationalTableFilter,
} from "./types";

const filters: Array<{ value: OperationalTableFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "mine", label: "Mine" },
];

type OperationalFloorToolbarProps = {
  query: string;
  filter: OperationalTableFilter;
  counts: Record<OperationalTableFilter, number>;
  floorPlans: OperationalFloorPlanOption[];
  selectedFloorPlanId: string | null;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: OperationalTableFilter) => void;
  onFloorPlanChange: (floorPlanId: string | null) => void;
};

export function OperationalFloorToolbar({
  counts,
  filter,
  floorPlans,
  onFilterChange,
  onFloorPlanChange,
  onQueryChange,
  query,
  selectedFloorPlanId,
}: OperationalFloorToolbarProps) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-subtle" data-operational-floor-toolbar>
      <div className="flex flex-wrap items-end gap-4">
        {/*
         * Below `xl` this wrapper is a real full-width flex row so search +
         * floor plan share line 1 and the filter chips wrap onto their own
         * full-width line 2 (chips then flow horizontally instead of being
         * squeezed into a tall vertical column). At `xl` and above it becomes
         * `display: contents`, so its children are direct flex children of the
         * toolbar row again and the locked 1280+/1440+ desktop layout is
         * byte-identical to before.
         */}
        <div className="flex w-full flex-wrap items-end gap-4 xl:contents">
          <div className="min-w-[280px] flex-1 basis-[360px]">
            <SearchInput
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search table or assigned waiter"
              aria-label="Search tables"
            />
          </div>

          {floorPlans.length > 1 ? (
            <label className="grid min-w-[220px] gap-1 text-sm font-semibold text-text-secondary">
              <span>Floor plan</span>
              <select
                className="min-h-12 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
                value={selectedFloorPlanId || ""}
                onChange={(event) => onFloorPlanChange(event.target.value || null)}
              >
                <option value="">All floor plans</option>
                {floorPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
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
                  "transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.96] focus-visible:shadow-focus",
                  active
                    ? "bg-brand-navy-900 text-text-inverse shadow-subtle"
                    : "bg-surface-muted text-text-secondary hover:bg-brand-white hover:text-text-primary hover:shadow-subtle",
                )}
                aria-pressed={active}
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
