import { Armchair, Clock, Users, WarningCircle } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import {
  getSupervisorReservationAttention,
  type SupervisorReservationView,
  type SupervisorReservationViewModel,
} from "@/lib/supervisor/reservations";

type SupervisorReservationRowProps = {
  reservation: SupervisorReservationViewModel;
  view: SupervisorReservationView;
  selected: boolean;
  onSelect: (reservation: SupervisorReservationViewModel) => void;
};

// One consistent operational reservation row. Summary information only — no
// full phone/email, no raw IDs, no long notes (guest privacy: contact detail
// lives in the detail workspace). A button so it is keyboard-selectable with a
// visible focus ring and `aria-pressed` selected state.
export function SupervisorReservationRow({
  onSelect,
  reservation,
  selected,
  view,
}: SupervisorReservationRowProps) {
  const attention = getSupervisorReservationAttention(reservation.raw);
  const primaryReason = attention.reasons[0];
  const isHistory = view === "history";
  const hasTable = Boolean(reservation.tableId);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${reservation.guestName}, ${reservation.partyLabel}, ${reservation.statusLabel}, ${reservation.timeLabel}`}
      onClick={() => onSelect(reservation)}
      className={cn(
        "w-full rounded-lg border px-4 py-3 text-left",
        "transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
        "focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.997]",
        selected
          ? "border-brand-navy-900 bg-surface shadow-subtle"
          : "border-transparent bg-surface hover:border-border-subtle hover:bg-brand-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Clock size={16} weight="bold" className="shrink-0 text-text-muted" aria-hidden />
          <span className="text-sm font-bold tabular-nums text-text-primary">
            {reservation.timeLabel}
          </span>
          {isHistory ? (
            <span className="truncate text-xs font-semibold text-text-muted">{reservation.dateLabel}</span>
          ) : null}
        </div>
        <Badge variant={reservation.statusTone}>{reservation.statusLabel}</Badge>
      </div>

      <p className="mt-2 truncate text-base font-bold text-text-primary" title={reservation.guestName}>
        {reservation.guestName}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <Users size={15} weight="bold" className="text-text-muted" aria-hidden />
          {reservation.partyLabel}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1">
          <Armchair size={15} weight="bold" className="text-text-muted" aria-hidden />
          <span className={cn("truncate", !hasTable && "text-text-muted")}>
            {hasTable ? reservation.tableLabel : "Unassigned"}
          </span>
        </span>
        {reservation.sourceLabel && reservation.sourceLabel !== "Source unavailable" ? (
          <span className="text-text-muted">{reservation.sourceLabel}</span>
        ) : null}
      </div>

      {primaryReason && !isHistory ? (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-status-warning-surface px-2 py-1 text-xs font-semibold text-status-warning">
          <WarningCircle size={14} weight="fill" aria-hidden />
          <span className="truncate">{primaryReason.label}</span>
          {attention.reasons.length > 1 ? (
            <span className="text-status-warning/80">+{attention.reasons.length - 1}</span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
