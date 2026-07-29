import {
  ArrowLeft,
  Armchair,
  CalendarCheck,
  CheckCircle,
  ClockCounterClockwise,
  ForkKnife,
  Info,
  NotePencil,
  Prohibit,
  SealCheck,
  User,
  UserSwitch,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, Button, Card, Skeleton, StatusMessage } from "@/components/ui";
import {
  getSupervisorReservationActions,
  getSupervisorReservationAttention,
  normalizeSupervisorReservation,
  type SupervisorReservation,
  type SupervisorReservationDeposit,
  type SupervisorReservationEvent,
} from "@/lib/supervisor/reservations";

export type SupervisorReservationActionKind =
  | "confirm"
  | "assign-table"
  | "change-table"
  | "seat"
  | "complete"
  | "cancel"
  | "no-show";

type SupervisorReservationWorkspaceProps = {
  reservation: SupervisorReservation | null;
  detail?: SupervisorReservation | null;
  events?: SupervisorReservationEvent[] | null;
  deposits?: SupervisorReservationDeposit[] | null;
  isLoading?: boolean;
  eventsLoading?: boolean;
  detailError?: string | null;
  onClose: () => void;
  onRequestAction: (action: SupervisorReservationActionKind) => void;
};

function formatDateTime(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function displayValue(value: string | number | null | undefined, fallback: string) {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg bg-surface-muted p-4">
      <div className="flex items-center gap-2">
        <span className="text-brand-navy-900">{icon}</span>
        <h3 className="text-base font-bold tracking-normal text-text-primary">{title}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-surface px-3 py-2 text-sm">
      <dt className="font-semibold text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-right font-bold text-text-primary" title={value}>
        {value}
      </dd>
    </div>
  );
}

// Automatic-completion detection: the order-close integration writes a COMPLETED
// event; a manual completion also writes one. We surface completion truthfully
// from event data without claiming a source we cannot prove.
function completionEvent(events: SupervisorReservationEvent[]) {
  return events.find((event) => String(event.type || "").toUpperCase() === "COMPLETED") || null;
}

export function SupervisorReservationWorkspace({
  deposits,
  detail,
  detailError,
  events,
  eventsLoading,
  isLoading,
  onClose,
  onRequestAction,
  reservation,
}: SupervisorReservationWorkspaceProps) {
  const active = detail || reservation;

  if (!active) {
    return (
      <Card className="min-h-[520px] bg-surface-muted">
        <p className="text-lg font-bold tracking-normal text-text-primary">Select a reservation</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Guest context, table and order linkage, lifecycle events, and the available reservation
          actions appear here.
        </p>
      </Card>
    );
  }

  if (isLoading && !detail) {
    return (
      <Card className="min-h-[520px]">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-4 h-5 w-72" />
        <div className="mt-6 grid gap-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  const normalized = normalizeSupervisorReservation(active);
  const actions = getSupervisorReservationActions(active);
  const attention = getSupervisorReservationAttention(active);
  const eventRows = events || active.events || [];
  const depositRows = deposits || active.deposits || [];
  const tableId = active.tableId || active.table?.id || null;
  const linkedOrderId = active.seatedOrder?.id || active.seatedOrderId || null;
  const completed = normalized.statusRaw === "COMPLETED";
  const completionRow = completionEvent(eventRows);

  const hasAnyAction =
    actions.confirm ||
    actions.seat ||
    actions.complete ||
    actions.assignTable ||
    actions.changeTable ||
    actions.cancel ||
    actions.noShow;

  return (
    <Card className="min-h-[520px]" aria-labelledby="supervisor-reservation-workspace-title">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="mb-2 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-text-secondary hover:text-text-primary focus-visible:shadow-focus focus-visible:outline-none"
          >
            <ArrowLeft size={16} weight="bold" aria-hidden />
            Back to list
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2
              id="supervisor-reservation-workspace-title"
              className="truncate text-xl font-bold tracking-normal text-text-primary"
              title={normalized.guestName}
            >
              {normalized.guestName}
            </h2>
            <Badge variant={normalized.statusTone}>{normalized.statusLabel}</Badge>
          </div>
          <p className="mt-1 text-sm font-semibold text-text-secondary">
            {formatDateTime(active.reservationAt)} · {normalized.partyLabel} · {normalized.reservationNumber}
          </p>
        </div>
      </div>

      {detailError ? (
        <StatusMessage tone="warning" title="Showing last loaded detail">
          {detailError}
        </StatusMessage>
      ) : null}

      {attention.isAttention ? (
        <div className="mt-4 rounded-lg bg-status-warning-surface p-3">
          <div className="flex items-center gap-2 text-status-warning">
            <WarningCircle size={18} weight="fill" aria-hidden />
            <p className="text-sm font-bold">Needs attention</p>
          </div>
          <ul className="mt-1.5 grid gap-1">
            {attention.reasons.map((reason) => (
              <li key={reason.key} className="text-sm font-semibold text-status-warning">
                {reason.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Actions — only currently-valid transitions are rendered (never a disabled wall). */}
      {hasAnyAction ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.confirm ? (
            <Button
              size="compact"
              leadingIcon={<CheckCircle size={18} weight="bold" aria-hidden />}
              onClick={() => onRequestAction("confirm")}
            >
              Confirm
            </Button>
          ) : null}
          {actions.seat ? (
            <Button
              size="compact"
              leadingIcon={<ForkKnife size={18} weight="bold" aria-hidden />}
              onClick={() => onRequestAction("seat")}
            >
              Seat guest
            </Button>
          ) : null}
          {actions.complete ? (
            <Button
              size="compact"
              leadingIcon={<SealCheck size={18} weight="bold" aria-hidden />}
              onClick={() => onRequestAction("complete")}
            >
              Mark visit complete
            </Button>
          ) : null}
          {actions.assignTable ? (
            <Button
              variant="secondary"
              size="compact"
              leadingIcon={<Armchair size={18} weight="bold" aria-hidden />}
              onClick={() => onRequestAction("assign-table")}
            >
              Assign table
            </Button>
          ) : null}
          {actions.changeTable ? (
            <Button
              variant="secondary"
              size="compact"
              leadingIcon={<UserSwitch size={18} weight="bold" aria-hidden />}
              onClick={() => onRequestAction("change-table")}
            >
              Change table
            </Button>
          ) : null}
          {actions.cancel ? (
            <Button
              variant="tertiary"
              size="compact"
              leadingIcon={<Prohibit size={18} weight="bold" aria-hidden />}
              onClick={() => onRequestAction("cancel")}
            >
              Cancel
            </Button>
          ) : null}
          {actions.noShow ? (
            <Button
              variant="tertiary"
              size="compact"
              leadingIcon={<WarningCircle size={18} weight="bold" aria-hidden />}
              onClick={() => onRequestAction("no-show")}
            >
              Mark no-show
            </Button>
          ) : null}
        </div>
      ) : null}

      {actions.terminal ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted">
          <Info size={16} weight="bold" aria-hidden />
          This reservation is {normalized.statusLabel.toLowerCase()} — it is read-only.
        </p>
      ) : null}

      <Section icon={<CalendarCheck size={20} weight="bold" aria-hidden />} title="Visit context">
        <dl className="grid gap-2">
          <Row label="Date / time" value={formatDateTime(active.reservationAt)} />
          <Row label="Party size" value={normalized.partyLabel} />
          <Row
            label="Expected duration"
            value={
              typeof active.expectedDurationMinutes === "number"
                ? `${active.expectedDurationMinutes} min`
                : "Not set"
            }
          />
          <Row label="Source" value={normalized.sourceLabel} />
        </dl>
      </Section>

      <Section icon={<Armchair size={20} weight="bold" aria-hidden />} title="Table & order">
        <dl className="grid gap-2">
          <Row label="Table" value={normalized.tableLabel} />
          <Row label="Table capacity" value={normalized.tableCapacityLabel} />
          <Row
            label="Linked order"
            value={displayValue(active.seatedOrder?.orderNumber || linkedOrderId, "None linked")}
          />
          {active.seatedOrder?.status ? (
            <Row label="Order status" value={displayValue(active.seatedOrder.status, "Unknown")} />
          ) : null}
        </dl>
        {tableId ? (
          <Link
            href={`/supervisor/floor?tableId=${encodeURIComponent(tableId)}${
              linkedOrderId ? `&orderId=${encodeURIComponent(linkedOrderId)}` : ""
            }`}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-surface px-4 text-sm font-semibold text-text-primary shadow-subtle hover:bg-brand-white focus-visible:shadow-focus focus-visible:outline-none"
          >
            <Armchair size={18} weight="bold" aria-hidden />
            View table on Floor
          </Link>
        ) : null}
      </Section>

      <Section icon={<User size={20} weight="bold" aria-hidden />} title="Guest contact">
        <dl className="grid gap-2">
          <Row label="Name" value={normalized.guestName} />
          <Row label="Phone" value={displayValue(active.customerPhone, "Not provided")} />
          <Row label="Email" value={displayValue(active.customerEmail, "Not provided")} />
        </dl>
        {active.notes || active.specialRequests ? (
          <div className="mt-3 grid gap-2">
            {active.notes ? (
              <div className="rounded-md bg-surface px-3 py-2 text-sm leading-6 text-text-secondary">
                <p className="font-bold text-text-primary">Notes</p>
                <p className="mt-1">{active.notes}</p>
              </div>
            ) : null}
            {active.specialRequests ? (
              <div className="rounded-md bg-surface px-3 py-2 text-sm leading-6 text-text-secondary">
                <p className="font-bold text-text-primary">Special requests</p>
                <p className="mt-1">{active.specialRequests}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-text-muted">No notes or special requests.</p>
        )}
      </Section>

      {completed ? (
        <StatusMessage tone="success" title="Visit completed">
          {completionRow?.message
            ? completionRow.message
            : "This reservation is complete. Completion also fires automatically when a linked order is closed."}
        </StatusMessage>
      ) : null}

      <Section icon={<ClockCounterClockwise size={20} weight="bold" aria-hidden />} title="Lifecycle">
        {eventsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : eventRows.length ? (
          <ol className="grid gap-2">
            {eventRows.map((event) => (
              <li key={event.id} className="rounded-md bg-surface px-3 py-2 text-sm">
                <p className="font-bold text-text-primary">{displayValue(event.type, "Event")}</p>
                {event.message ? <p className="mt-0.5 text-text-secondary">{event.message}</p> : null}
                <p className="mt-0.5 text-xs font-semibold text-text-muted">
                  {formatDateTime(event.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-text-muted">No lifecycle events recorded yet.</p>
        )}
      </Section>

      {depositRows.length ? (
        <Section icon={<NotePencil size={20} weight="bold" aria-hidden />} title="Deposits (read-only)">
          <div className="grid gap-2">
            {depositRows.map((deposit) => (
              <div key={deposit.id} className="rounded-md bg-surface px-3 py-2 text-sm">
                <p className="font-bold text-text-primary">
                  {displayValue(deposit.status, "Unknown")}
                </p>
                <p className="mt-0.5 text-text-secondary">{formatDateTime(deposit.recordedAt)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-text-muted">
            Deposit recording and payment capture are not part of this Supervisor surface.
          </p>
        </Section>
      ) : null}
    </Card>
  );
}
