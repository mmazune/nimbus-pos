import { Armchair, CalendarCheck, Clock, CurrencyCircleDollar, Users } from "@phosphor-icons/react";

import { Card } from "@/components/ui";
import { SupervisorReservationStatusBadge } from "@/components/supervisor/reservations/SupervisorReservationStatusBadge";
import type { SupervisorReservationViewModel } from "@/lib/supervisor/reservations";
import { cn } from "@/lib/utils/cn";

type SupervisorReservationCardProps = {
  reservation: SupervisorReservationViewModel;
  selected?: boolean;
  onSelect: (reservation: SupervisorReservationViewModel) => void;
};

const tagToneClasses = {
  neutral: "bg-status-neutral-surface text-status-neutral",
  success: "bg-status-success-surface text-status-success",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  info: "bg-status-info-surface text-status-info",
};

export function SupervisorReservationCard({
  onSelect,
  reservation,
  selected,
}: SupervisorReservationCardProps) {
  return (
    <button
      type="button"
      className="block w-full rounded-lg text-left focus-visible:shadow-focus"
      aria-pressed={selected}
      onClick={() => onSelect(reservation)}
    >
      <Card
        className={cn(
          "min-h-[176px] border border-transparent transition-[border-color,box-shadow,transform] duration-150 ease-out hover:border-brand-navy-200 hover:shadow-focus active:scale-[0.995]",
          selected && "border-brand-navy-900 shadow-focus",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-status-info-surface text-status-info">
              <span className="text-sm font-bold tracking-normal">{reservation.guestInitials}</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-lg font-bold tracking-normal text-text-primary" title={reservation.guestName}>
                  {reservation.guestName}
                </p>
                <SupervisorReservationStatusBadge
                  label={reservation.statusLabel}
                  tone={reservation.statusTone}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-text-secondary">
                {reservation.reservationNumber}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tabular-nums tracking-normal text-text-primary">
              {reservation.timeLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-text-secondary">{reservation.dateLabel}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-surface-muted px-3 py-2">
            <span className="flex items-center gap-2 font-semibold text-text-secondary">
              <Users size={16} weight="bold" aria-hidden />
              Party
            </span>
            <p className="mt-1 truncate font-bold text-text-primary" title={reservation.partyLabel}>
              {reservation.partyLabel}
            </p>
          </div>
          <div className="rounded-md bg-surface-muted px-3 py-2">
            <span className="flex items-center gap-2 font-semibold text-text-secondary">
              <Armchair size={16} weight="bold" aria-hidden />
              Table
            </span>
            <p className="mt-1 truncate font-bold text-text-primary" title={reservation.tableLabel}>
              {reservation.tableLabel}
            </p>
          </div>
          <div className="rounded-md bg-surface-muted px-3 py-2">
            <span className="flex items-center gap-2 font-semibold text-text-secondary">
              <CalendarCheck size={16} weight="bold" aria-hidden />
              Source
            </span>
            <p className="mt-1 truncate font-bold text-text-primary" title={reservation.sourceLabel}>
              {reservation.sourceLabel}
            </p>
          </div>
          <div className="rounded-md bg-surface-muted px-3 py-2">
            <span className="flex items-center gap-2 font-semibold text-text-secondary">
              <CurrencyCircleDollar size={16} weight="bold" aria-hidden />
              Deposit
            </span>
            <p className="mt-1 truncate font-bold text-text-primary" title={reservation.depositLabel}>
              {reservation.depositLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <Clock size={16} weight="bold" aria-hidden />
            {reservation.seatingLabel}
          </span>
          {reservation.tags.map((tag) => (
            <span
              key={tag.key}
              className={cn(
                "inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold",
                tagToneClasses[tag.tone],
              )}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </Card>
    </button>
  );
}
