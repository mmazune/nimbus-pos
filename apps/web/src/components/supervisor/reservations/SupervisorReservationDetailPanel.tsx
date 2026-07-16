import {
  Armchair,
  CalendarCheck,
  CurrencyCircleDollar,
  NotePencil,
  User,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";

import { Badge, Button, Card, Skeleton, StatusMessage } from "@/components/ui";
import {
  formatSupervisorReservationMoney,
  getSupervisorReservationDepositLabel,
  getSupervisorReservationDepositState,
  getSupervisorReservationSeatingLabel,
  getSupervisorReservationSeatingState,
  getSupervisorReservationStatusLabel,
  getSupervisorReservationStatusTone,
  normalizeSupervisorReservation,
  type SupervisorReservation,
  type SupervisorReservationDeposit,
  type SupervisorReservationEvent,
} from "@/lib/supervisor/reservations";

type SupervisorReservationDetailPanelProps = {
  reservation: SupervisorReservation | null;
  detail?: SupervisorReservation | null;
  deposits?: SupervisorReservationDeposit[] | null;
  events?: SupervisorReservationEvent[] | null;
  isLoading?: boolean;
  depositsLoading?: boolean;
  eventsLoading?: boolean;
  detailError?: string | null;
  depositsError?: string | null;
  eventsError?: string | null;
  onClose: () => void;
};

function displayValue(value: string | number | null | undefined, fallback = "Unavailable") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2 text-sm">
      <dt className="font-semibold text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-right font-bold text-text-primary" title={value}>
        {value}
      </dd>
    </div>
  );
}

function DeferredAction({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <div className="flex items-center gap-2">
        <WarningCircle size={20} weight="bold" className="text-text-secondary" aria-hidden />
        <p className="font-bold text-text-primary">{label}</p>
      </div>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{reason}</p>
      <Button className="mt-3 w-full" variant="secondary" size="compact" disabled>
        Deferred
      </Button>
    </div>
  );
}

export function SupervisorReservationDetailPanel({
  deposits,
  depositsError,
  depositsLoading,
  detail,
  detailError,
  events,
  eventsError,
  eventsLoading,
  isLoading,
  onClose,
  reservation,
}: SupervisorReservationDetailPanelProps) {
  const activeReservation = detail || reservation;

  if (!activeReservation) {
    return (
      <Card className="min-h-[620px] bg-surface-muted">
        <p className="text-lg font-bold tracking-normal text-text-primary">Select a reservation</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Reservation identity, guest-safe detail, table context, deposits, events, and unavailable actions appear here.
        </p>
      </Card>
    );
  }

  if (isLoading && !detail) {
    return (
      <Card className="min-h-[620px]">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-4 h-5 w-80" />
        <div className="mt-6 grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  const normalized = normalizeSupervisorReservation(activeReservation);
  const depositRows = deposits || activeReservation.deposits || [];
  const eventRows = events || activeReservation.events || [];
  const seatingState = getSupervisorReservationSeatingState(activeReservation);
  const depositState = getSupervisorReservationDepositState({
    depositRequired: activeReservation.depositRequired,
    deposits: depositRows,
  });
  const statusLabel = getSupervisorReservationStatusLabel(activeReservation.status);
  const statusTone = getSupervisorReservationStatusTone(activeReservation.status);
  const tableId = activeReservation.tableId || activeReservation.table?.id || null;

  return (
    <Card className="min-h-[620px]" aria-labelledby="supervisor-reservation-detail-title">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <h2
              id="supervisor-reservation-detail-title"
              className="truncate text-xl font-bold tracking-normal text-text-primary"
              title={normalized.reservationNumber}
            >
              {normalized.reservationNumber}
            </h2>
            <Badge variant={statusTone}>{statusLabel}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {detailError || "Read-only reservation oversight detail."}
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-white hover:text-text-primary focus-visible:shadow-focus active:scale-[0.96]"
          aria-label="Close reservation detail"
          onClick={onClose}
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {normalized.tags.length ? (
          normalized.tags.map((tag) => (
            <Badge key={tag.key} variant={tag.tone}>
              {tag.label}
            </Badge>
          ))
        ) : (
          <Badge variant="neutral">No exception tags</Badge>
        )}
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <CalendarCheck size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Reservation identity</h3>
        </div>
        <dl className="mt-3 grid gap-3">
          <DetailRow label="Date / time" value={formatDateTime(activeReservation.reservationAt)} />
          <DetailRow label="Party size" value={normalized.partyLabel} />
          <DetailRow label="Source" value={normalized.sourceLabel} />
          <DetailRow label="Created" value={formatDateTime(activeReservation.createdAt)} />
          <DetailRow label="Updated" value={formatDateTime(activeReservation.updatedAt)} />
        </dl>
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <User size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Guest</h3>
        </div>
        <dl className="mt-3 grid gap-3">
          <DetailRow label="Display name" value={normalized.guestName} />
          <DetailRow label="Phone" value={displayValue(activeReservation.customerPhone, "Contact not returned")} />
          <DetailRow label="Email" value={displayValue(activeReservation.customerEmail, "Contact not returned")} />
        </dl>
        <p className="mt-3 text-sm font-semibold text-text-secondary">
          Guest contact fields are shown only when returned by the reservation API.
        </p>
        {activeReservation.notes || activeReservation.specialRequests ? (
          <div className="mt-4 grid gap-3">
            {activeReservation.notes ? (
              <div className="rounded-md bg-surface px-3 py-2 text-sm leading-6 text-text-secondary">
                <p className="font-bold text-text-primary">Notes</p>
                <p className="mt-1">{activeReservation.notes}</p>
              </div>
            ) : null}
            {activeReservation.specialRequests ? (
              <div className="rounded-md bg-surface px-3 py-2 text-sm leading-6 text-text-secondary">
                <p className="font-bold text-text-primary">Special requests</p>
                <p className="mt-1">{activeReservation.specialRequests}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <Armchair size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Table / seating</h3>
        </div>
        <dl className="mt-3 grid gap-3">
          <DetailRow label="Assigned table" value={normalized.tableLabel} />
          <DetailRow label="Seating state" value={getSupervisorReservationSeatingLabel(seatingState)} />
          <DetailRow label="Table capacity" value={normalized.tableCapacityLabel} />
          <DetailRow label="Linked order" value={displayValue(activeReservation.seatedOrder?.orderNumber || activeReservation.seatedOrderId)} />
        </dl>
        {tableId ? (
          <Link
            href={`/supervisor/floor?tableId=${encodeURIComponent(tableId)}`}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-surface px-4 text-base font-semibold text-text-primary shadow-subtle transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-brand-white focus-visible:shadow-focus active:scale-[0.96]"
          >
            <Armchair size={22} weight="bold" aria-hidden />
            View table on Floor
          </Link>
        ) : null}
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <CurrencyCircleDollar size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Deposits</h3>
        </div>
        <p className="mt-2 text-sm font-semibold text-text-secondary">
          {getSupervisorReservationDepositLabel({
            depositRequired: activeReservation.depositRequired,
            deposits: depositRows,
          })}
        </p>
        {depositsLoading ? <Skeleton className="mt-3 h-10 w-full" /> : null}
        {depositsError ? (
          <StatusMessage tone="warning" title="Deposit reads unavailable">
            {depositsError}
          </StatusMessage>
        ) : depositRows.length ? (
          <div className="mt-3 grid gap-2">
            {depositRows.map((deposit) => (
              <div key={deposit.id} className="rounded-md bg-surface px-3 py-2 text-sm">
                <p className="font-bold text-text-primary">
                  {displayValue(deposit.status, "Unknown")} - {formatSupervisorReservationMoney(deposit.amount)}
                </p>
                <p className="mt-1 text-text-secondary">
                  {displayValue(deposit.method, "Method unavailable")} - {formatDateTime(deposit.recordedAt)}
                </p>
                {deposit.reference ? (
                  <p className="mt-1 text-text-secondary">Reference: {deposit.reference}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            {depositState === "none" ? "No deposit rows returned." : "Deposit rows were not returned."}
          </p>
        )}
        <StatusMessage tone="info" title="Deposit actions unavailable">
          Recording, capturing, refunding, or applying deposits is not available on this Supervisor surface.
        </StatusMessage>
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <NotePencil size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Events</h3>
        </div>
        {eventsLoading ? <Skeleton className="mt-3 h-10 w-full" /> : null}
        {eventsError ? (
          <StatusMessage tone="warning" title="Event reads unavailable">
            {eventsError}
          </StatusMessage>
        ) : eventRows.length ? (
          <div className="mt-3 grid gap-2">
            {eventRows.map((event) => (
              <div key={event.id} className="rounded-md bg-surface px-3 py-2 text-sm">
                <p className="font-bold text-text-primary">{displayValue(event.type, "Event")}</p>
                <p className="mt-1 text-text-secondary">{event.message || "No event message returned"}</p>
                <p className="mt-1 text-xs font-semibold text-text-muted">{formatDateTime(event.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-text-secondary">No event rows returned.</p>
        )}
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <WarningCircle size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Future actions</h3>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DeferredAction label="Create / edit reservation" reason="Reservation mutations require a separate verified action workflow." />
          <DeferredAction label="Confirm" reason="Confirm remains unavailable until mutation QA is completed." />
          <DeferredAction label="Assign table" reason="Table assignment will be enabled only after mutation QA." />
          <DeferredAction label="Seat" reason="This surface is read-only for seating." />
          <DeferredAction label="Cancel / no-show" reason="High-impact reservation mutations remain deferred." />
          <DeferredAction label="Record deposit" reason="Deposit/payment workflows are deferred in Supervisor v1." />
        </div>
      </div>
    </Card>
  );
}
