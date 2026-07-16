import { CalendarCheck, CheckCircle, ListChecks, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, Card, StatusMessage } from "@/components/ui";
import { SupervisorFloorStatusBadge } from "@/components/supervisor/floor/SupervisorFloorStatusBadge";
import {
  supervisorTableStatuses,
  type SupervisorTable,
  type SupervisorTableStatus,
} from "@/lib/supervisor/floor";
import {
  toBackendTableStatus,
  type SupervisorTableViewModel,
} from "@/lib/supervisor/floor-model";

type SupervisorTableDetailPanelProps = {
  table: SupervisorTableViewModel | null;
  detail?: SupervisorTable | null;
  isDetailLoading?: boolean;
  canUpdateStatus: boolean;
  isUpdatingStatus?: boolean;
  updateError?: string | null;
  updateSuccess?: string | null;
  ordersHref?: string | null;
  reservationsHref?: string | null;
  onUpdateStatus: (status: SupervisorTableStatus) => void;
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2">
      <dt className="font-semibold text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate font-bold text-text-primary" title={value}>
        {value}
      </dd>
    </div>
  );
}

function statusLabel(status: SupervisorTableStatus) {
  if (status === "CLEANING") return "Cleaning / reset";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function SupervisorTableDetailPanel({
  canUpdateStatus,
  detail,
  isDetailLoading,
  isUpdatingStatus,
  onClose,
  onUpdateStatus,
  ordersHref,
  reservationsHref,
  table,
  updateError,
  updateSuccess,
}: SupervisorTableDetailPanelProps) {
  const [pendingStatus, setPendingStatus] = useState<SupervisorTableStatus | "">("");

  const activeTable = useMemo(() => {
    if (!table) return null;
    if (!detail) return table;

    return {
      ...table,
      backendStatus: detail.status ? statusLabel(toBackendTableStatus(detail.status) || "CLEANING") : table.backendStatus,
      capacityLabel:
        typeof detail.capacity === "number" ? `${detail.capacity} seats` : table.capacityLabel,
      floorPlanName: detail.floorPlan?.name || table.floorPlanName,
      zoneLabel: table.zoneLabel,
    };
  }, [detail, table]);

  if (!activeTable) {
    return (
      <Card className="min-h-[520px] bg-surface-muted">
        <p className="text-lg font-bold tracking-normal text-text-primary">Select a table</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Table identity, status, assignment, availability, and verified future actions appear here.
        </p>
      </Card>
    );
  }

  const currentBackendStatus = toBackendTableStatus(detail?.status || activeTable.raw.status);
  const confirmDisabled = !pendingStatus || pendingStatus === currentBackendStatus || isUpdatingStatus;

  return (
    <Card className="min-h-[520px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <p className="truncate text-xl font-bold tracking-normal text-text-primary" title={activeTable.name}>
              {activeTable.name}
            </p>
            <SupervisorFloorStatusBadge status={activeTable.status} />
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {isDetailLoading ? "Refreshing table detail..." : "Live branch table detail from floor APIs."}
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-white hover:text-text-primary focus-visible:shadow-focus active:scale-[0.96]"
          aria-label="Close table detail"
          onClick={onClose}
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <dl className="mt-5 grid gap-3 text-sm">
        <DetailRow label="Status" value={activeTable.backendStatus} />
        <DetailRow label="Capacity" value={activeTable.capacityLabel} />
        <DetailRow label="Floor plan" value={activeTable.floorPlanName} />
        <DetailRow label="Zone / section" value={activeTable.zoneLabel} />
        <DetailRow label="Assigned server" value={activeTable.assignedServer} />
        <DetailRow label="Availability" value={activeTable.reservedIndicator} />
        <DetailRow label="Order summary" value={activeTable.activeOrderSummary} />
        <DetailRow label="Last updated" value={activeTable.lastUpdatedLabel} />
      </dl>

      {ordersHref ? (
        <Link
          href={ordersHref}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-surface-muted px-4 text-base font-semibold text-text-primary shadow-subtle transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-brand-white focus-visible:shadow-focus active:scale-[0.96]"
        >
          <ListChecks size={22} weight="bold" aria-hidden />
          View table orders
        </Link>
      ) : null}

      {reservationsHref ? (
        <Link
          href={reservationsHref}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-surface-muted px-4 text-base font-semibold text-text-primary shadow-subtle transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-brand-white focus-visible:shadow-focus active:scale-[0.96]"
        >
          <CalendarCheck size={22} weight="bold" aria-hidden />
          View table reservations
        </Link>
      ) : null}

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <h2 className="text-base font-bold tracking-normal text-text-primary">Table Status Update</h2>
        {canUpdateStatus ? (
          <>
            <label className="mt-3 grid gap-1 text-sm font-semibold text-text-secondary">
              <span>New status</span>
              <select
                className="min-h-12 rounded-md bg-surface px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
                value={pendingStatus}
                onChange={(event) => setPendingStatus(event.target.value as SupervisorTableStatus)}
              >
                <option value="">Choose a status</option>
                {supervisorTableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Confirming updates the live table status and refreshes floor data after success.
            </p>
            <Button
              className="mt-4 w-full"
              size="pos"
              disabled={confirmDisabled}
              leadingIcon={<CheckCircle size={22} weight="bold" aria-hidden />}
              onClick={() => {
                if (pendingStatus) onUpdateStatus(pendingStatus);
              }}
            >
              {isUpdatingStatus ? "Updating status..." : "Confirm status update"}
            </Button>
          </>
        ) : (
          <StatusMessage tone="warning" title="Table status changes unavailable">
            This session does not expose `pos:table:write`; status changes are blocked.
          </StatusMessage>
        )}
        {updateError ? (
          <StatusMessage tone="danger" title="Status update failed">
            {updateError}
          </StatusMessage>
        ) : null}
        {updateSuccess ? (
          <StatusMessage tone="success" title="Status updated">
            {updateSuccess}
          </StatusMessage>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        <StatusMessage tone="info" title="Order exception actions stay in Orders">
          This panel shows table context only. Split, transfer, void, refund, and payment actions are not available here.
        </StatusMessage>
        <StatusMessage tone="info" title="Reservation seating stays in Reservations">
          Reservation seating and table assignment remain unavailable on the Floor detail panel.
        </StatusMessage>
      </div>
    </Card>
  );
}
