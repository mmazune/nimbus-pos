import { FunnelSimple, SortAscending } from "@phosphor-icons/react";

import { SearchInput } from "@/components/ui";
import {
  supervisorReservationFilters,
  supervisorReservationSorts,
  type SupervisorReservationFilter,
  type SupervisorReservationSort,
} from "@/lib/supervisor/reservations";

type SupervisorReservationsToolbarProps = {
  query: string;
  filter: SupervisorReservationFilter;
  sort: SupervisorReservationSort;
  tableFilterLabel?: string | null;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: SupervisorReservationFilter) => void;
  onSortChange: (value: SupervisorReservationSort) => void;
  onClearTableFilter?: () => void;
};

export function SupervisorReservationsToolbar({
  filter,
  onClearTableFilter,
  onFilterChange,
  onQueryChange,
  onSortChange,
  query,
  sort,
  tableFilterLabel,
}: SupervisorReservationsToolbarProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-secondary" htmlFor="supervisor-reservations-search">
          Search reservations
        </label>
        <SearchInput
          id="supervisor-reservations-search"
          name="supervisor-reservations-search"
          autoComplete="off"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Reservation, guest, table, status, notes"
        />
      </div>

      <label className="grid gap-2 text-sm font-semibold text-text-secondary">
        <span className="inline-flex items-center gap-2">
          <FunnelSimple size={18} weight="bold" aria-hidden />
          Filter
        </span>
        <select
          className="min-h-12 w-full min-w-0 rounded-md bg-surface px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus lg:min-w-[190px]"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as SupervisorReservationFilter)}
        >
          {supervisorReservationFilters.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-text-secondary">
        <span className="inline-flex items-center gap-2">
          <SortAscending size={18} weight="bold" aria-hidden />
          Sort
        </span>
        <select
          className="min-h-12 w-full min-w-0 rounded-md bg-surface px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus lg:min-w-[190px]"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as SupervisorReservationSort)}
        >
          {supervisorReservationSorts.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {tableFilterLabel ? (
        <div className="flex flex-col gap-3 rounded-lg bg-status-info-surface px-4 py-3 text-sm text-status-info sm:flex-row sm:items-center sm:justify-between lg:col-span-3">
          <span className="font-semibold">Filtered by table: {tableFilterLabel}</span>
          <button
            type="button"
            className="min-h-9 rounded-md px-3 font-bold transition-[background-color,color] duration-150 ease-out hover:bg-surface focus-visible:shadow-focus"
            onClick={onClearTableFilter}
          >
            Clear table filter
          </button>
        </div>
      ) : null}
    </div>
  );
}
