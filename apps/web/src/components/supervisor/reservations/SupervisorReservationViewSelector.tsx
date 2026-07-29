import { cn } from "@/lib/utils/cn";
import {
  supervisorReservationViews,
  type SupervisorReservationView,
} from "@/lib/supervisor/reservations";

type ViewCounts = Partial<Record<SupervisorReservationView, number | null>>;

type SupervisorReservationViewSelectorProps = {
  view: SupervisorReservationView;
  counts: ViewCounts;
  /** Views whose count is not yet loaded render without a numeric chip. */
  onSelect: (view: SupervisorReservationView) => void;
};

// Semantic, keyboard-accessible view selector. It drives the reservation list
// region (a master-detail lens switcher, not swapped tabpanels) so it is a
// `tablist` of `tab` buttons with `aria-selected`; the list region below is the
// controlled panel. Active view never relies on colour alone — the selected tab
// carries an underline + weight + `aria-selected`.
export function SupervisorReservationViewSelector({
  counts,
  onSelect,
  view,
}: SupervisorReservationViewSelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Reservation views"
      aria-orientation="horizontal"
      className="flex flex-wrap gap-1 rounded-lg bg-surface-muted p-1"
    >
      {supervisorReservationViews.map((entry) => {
        const active = entry.value === view;
        const count = counts[entry.value];
        const showCount = typeof count === "number";
        const attention = entry.value === "attention" && showCount && (count as number) > 0;

        return (
          <button
            key={entry.value}
            type="button"
            role="tab"
            id={`supervisor-reservation-tab-${entry.value}`}
            aria-selected={active}
            aria-controls="supervisor-reservation-list-region"
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(entry.value)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const index = supervisorReservationViews.findIndex((item) => item.value === view);
              const delta = event.key === "ArrowRight" ? 1 : -1;
              const next =
                supervisorReservationViews[
                  (index + delta + supervisorReservationViews.length) %
                    supervisorReservationViews.length
                ];
              onSelect(next.value);
            }}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold",
              "transition-[background-color,color,box-shadow] duration-150 ease-out",
              "focus-visible:shadow-focus focus-visible:outline-none",
              active
                ? "bg-surface text-text-primary shadow-subtle"
                : "text-text-secondary hover:bg-surface/60 hover:text-text-primary",
            )}
          >
            <span className={cn(active && "underline decoration-2 underline-offset-8")}>
              {entry.label}
            </span>
            {showCount ? (
              <span
                className={cn(
                  "inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums",
                  attention
                    ? "bg-status-danger-surface text-status-danger"
                    : active
                      ? "bg-status-neutral-surface text-status-neutral"
                      : "bg-surface text-text-muted",
                )}
                aria-hidden
              >
                {count}
              </span>
            ) : null}
            {showCount ? (
              <span className="sr-only">
                {count} {entry.label.toLowerCase()} reservation{count === 1 ? "" : "s"}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
