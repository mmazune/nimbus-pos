import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";

import { Button, SearchInput } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import {
  formatSupervisorReservationDayLabel,
  todayIsoDate,
  type SupervisorReservationView,
} from "@/lib/supervisor/reservations";

export type SupervisorReservationHistoryStatus = "all" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

type SupervisorReservationsDateToolbarProps = {
  view: SupervisorReservationView;
  date: string;
  search: string;
  historyStatus: SupervisorReservationHistoryStatus;
  historyFrom: string;
  historyTo: string;
  hasActiveFilters: boolean;
  onDateChange: (date: string) => void;
  onShiftDay: (delta: number) => void;
  onToday: () => void;
  onSearchChange: (value: string) => void;
  onHistoryStatusChange: (value: SupervisorReservationHistoryStatus) => void;
  onHistoryFromChange: (value: string) => void;
  onHistoryToChange: (value: string) => void;
  onClearFilters: () => void;
};

const controlClass =
  "min-h-11 rounded-md bg-surface px-3 text-sm font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus focus-visible:outline-none";

const historyStatusOptions: Array<{ value: SupervisorReservationHistoryStatus; label: string }> = [
  { value: "all", label: "All terminal" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No-show" },
];

// Compact operational toolbar. Adapts to the active view: Arriving gets the
// operational-day nav (prev / today / next + date), History gets a terminal
// date-range + status filter, and every view gets a bounded search. All primary
// filters map to Prompt 4A server-side params (date / from / to / status);
// search is client-side within the loaded, bounded page and labelled as such.
export function SupervisorReservationsDateToolbar({
  date,
  hasActiveFilters,
  historyFrom,
  historyStatus,
  historyTo,
  onClearFilters,
  onDateChange,
  onHistoryFromChange,
  onHistoryStatusChange,
  onHistoryToChange,
  onSearchChange,
  onShiftDay,
  onToday,
  search,
  view,
}: SupervisorReservationsDateToolbarProps) {
  const isArriving = view === "arriving";
  const isHistory = view === "history";
  const searchPlaceholder = isHistory
    ? "Search this page (guest, table, reference)…"
    : "Search loaded reservations (guest, table)…";

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3">
      <div className="flex flex-wrap items-center gap-2">
        {isArriving ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => onShiftDay(-1)}
              className={cn(controlClass, "flex w-11 items-center justify-center px-0")}
            >
              <CaretLeft size={18} weight="bold" aria-hidden />
            </button>
            <label className="flex items-center">
              <span className="sr-only">Operational date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => onDateChange(event.target.value || todayIsoDate())}
                className={cn(controlClass, "tabular-nums")}
              />
            </label>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => onShiftDay(1)}
              className={cn(controlClass, "flex w-11 items-center justify-center px-0")}
            >
              <CaretRight size={18} weight="bold" aria-hidden />
            </button>
            <Button variant="tertiary" size="compact" onClick={onToday} disabled={date === todayIsoDate()}>
              Today
            </Button>
            <span className="ml-1 hidden text-sm font-semibold text-text-secondary sm:inline">
              {formatSupervisorReservationDayLabel(date)}
            </span>
          </div>
        ) : null}

        {isHistory ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
              <span>From</span>
              <input
                type="date"
                value={historyFrom}
                max={historyTo || undefined}
                onChange={(event) => onHistoryFromChange(event.target.value)}
                className={cn(controlClass, "tabular-nums")}
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
              <span>To</span>
              <input
                type="date"
                value={historyTo}
                min={historyFrom || undefined}
                onChange={(event) => onHistoryToChange(event.target.value)}
                className={cn(controlClass, "tabular-nums")}
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
              <span className="sr-only">Terminal status</span>
              <select
                value={historyStatus}
                onChange={(event) =>
                  onHistoryStatusChange(event.target.value as SupervisorReservationHistoryStatus)
                }
                className={controlClass}
              >
                {historyStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {!isArriving && !isHistory ? (
          <p className="text-sm font-semibold text-text-secondary">
            {view === "seated" ? "Active seated visits (all dates)" : "Reservations needing a decision (all dates)"}
          </p>
        ) : null}

        {hasActiveFilters ? (
          <Button
            variant="tertiary"
            size="compact"
            className="ml-auto"
            leadingIcon={<X size={16} weight="bold" aria-hidden />}
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <SearchInput
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label="Search reservations on this page"
      />
    </div>
  );
}
