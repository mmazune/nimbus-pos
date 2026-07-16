import { SlidersHorizontal } from "@phosphor-icons/react";

import { SearchInput } from "@/components/ui";
import type { SupervisorFloorPlan } from "@/lib/supervisor/floor";
import {
  supervisorFloorFilters,
  type SupervisorFloorCounts,
  type SupervisorFloorFilter,
} from "@/lib/supervisor/floor-model";
import { cn } from "@/lib/utils/cn";

type SupervisorFloorToolbarProps = {
  query: string;
  filter: SupervisorFloorFilter;
  counts: SupervisorFloorCounts;
  floorPlans: SupervisorFloorPlan[];
  selectedFloorPlanId: string | null;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: SupervisorFloorFilter) => void;
  onFloorPlanChange: (floorPlanId: string | null) => void;
};

export function SupervisorFloorToolbar({
  counts,
  filter,
  floorPlans,
  onFilterChange,
  onFloorPlanChange,
  onQueryChange,
  query,
  selectedFloorPlanId,
}: SupervisorFloorToolbarProps) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-subtle">
      <div className="grid gap-4 xl:grid-cols-[minmax(300px,430px)_minmax(220px,300px)_1fr] xl:items-center">
        <SearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search table, zone, capacity, or status"
          aria-label="Search supervisor floor tables"
          name="supervisor-floor-search"
          autoComplete="off"
        />

        <label className="grid gap-1 text-sm font-semibold text-text-secondary">
          <span>Floor plan</span>
          <select
            className="min-h-12 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
            value={selectedFloorPlanId || ""}
            onChange={(event) => onFloorPlanChange(event.target.value || null)}
          >
            <option value="">All floor plans</option>
            {floorPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
          <span className="mr-1 inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-text-secondary">
            <SlidersHorizontal size={18} weight="bold" aria-hidden />
            Filters
          </span>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {supervisorFloorFilters.map((option) => {
              const active = option.value === filter;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold",
                    "transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.96]",
                    "focus-visible:shadow-focus",
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
    </div>
  );
}
