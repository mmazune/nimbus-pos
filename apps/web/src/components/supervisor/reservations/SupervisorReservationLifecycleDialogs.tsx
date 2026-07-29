import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import {
  assignSupervisorReservationTable,
  cancelSupervisorReservation,
  completeSupervisorReservation,
  confirmSupervisorReservation,
  invalidateSupervisorReservationCaches,
  markSupervisorReservationNoShow,
  normalizeSupervisorReservation,
  seatSupervisorReservation,
  supervisorReservationActionErrorCopy,
  supervisorReservationKeys,
  type SupervisorReservation,
} from "@/lib/supervisor/reservations";
import { SupervisorReservationTableSelect } from "./SupervisorReservationTableSelect";

type BaseDialogProps = {
  reservation: SupervisorReservation;
  token: string;
  branchId: string;
  onClose: () => void;
  onCompleted: (result: SupervisorReservation) => void;
};

// Shared mutation wiring: writes the canonical response into the detail cache,
// invalidates exactly the reservation + floor + Waiter surfaces, toasts once,
// and on a stale-state error refetches canonical detail so the workspace
// self-corrects. Pending state clears on the canonical response (secondary
// invalidations are fire-and-forget inside the helper).
function useReservationActionMutation(options: {
  token: string;
  branchId: string;
  reservationId: string;
  successTitle: string;
  successDescription?: string;
  mutationFn: () => Promise<SupervisorReservation>;
  onCompleted: (result: SupervisorReservation) => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (result) => {
      queryClient.setQueryData<SupervisorReservation>(
        supervisorReservationKeys.detail(options.reservationId),
        (current) => (current ? { ...current, ...result } : result),
      );
      invalidateSupervisorReservationCaches(queryClient, options.branchId, options.reservationId);
      showToast({
        tone: "success",
        title: options.successTitle,
        description: options.successDescription,
      });
      options.onCompleted(result);
    },
    onError: () => {
      // Correct the workspace against the canonical row after a stale/conflict error.
      void queryClient.invalidateQueries({
        queryKey: supervisorReservationKeys.detail(options.reservationId),
      });
      void queryClient.invalidateQueries({ queryKey: supervisorReservationKeys.lists() });
    },
  });
}

function reservationSummary(reservation: SupervisorReservation) {
  const normalized = normalizeSupervisorReservation(reservation);
  return (
    <div className="grid gap-1">
      <p className="font-semibold text-text-primary">
        {normalized.guestName} • {normalized.partyLabel}
      </p>
      <p className="text-text-muted">
        {normalized.timeLabel} • {normalized.dateLabel} • {normalized.tableLabel}
      </p>
    </div>
  );
}

// ── Confirm (PENDING → CONFIRMED) ────────────────────────────────────────────
export function SupervisorConfirmReservationDialog({
  branchId,
  onClose,
  onCompleted,
  reservation,
  token,
}: BaseDialogProps) {
  const [notes, setNotes] = useState("");
  const mutation = useReservationActionMutation({
    token,
    branchId,
    reservationId: reservation.id,
    successTitle: "Reservation confirmed",
    mutationFn: () => confirmSupervisorReservation(token, branchId, reservation.id, notes.trim() || undefined),
    onCompleted,
  });

  return (
    <ActionConfirmDialog
      open
      tone="info"
      title="Confirm this reservation"
      consequence="The reservation moves to CONFIRMED. The guest can then be assigned a table and seated on arrival."
      context={reservationSummary(reservation)}
      reason={{
        label: "Confirmation note (optional)",
        placeholder: "Anything the floor team should know…",
        value: notes,
        onChange: setNotes,
      }}
      confirmLabel="Confirm reservation"
      pending={mutation.isPending}
      error={mutation.isError ? supervisorReservationActionErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
      onConfirm={() => mutation.mutate()}
    />
  );
}

// ── Seat (CONFIRMED → SEATED, table required) ────────────────────────────────
export function SupervisorSeatReservationDialog({
  branchId,
  onClose,
  onCompleted,
  reservation,
  token,
}: BaseDialogProps) {
  const existingTableId = reservation.tableId || reservation.table?.id || null;
  const [tableId, setTableId] = useState<string | null>(existingTableId);

  const mutation = useReservationActionMutation({
    token,
    branchId,
    reservationId: reservation.id,
    successTitle: "Guest seated",
    successDescription: "The table is now occupied.",
    mutationFn: () =>
      seatSupervisorReservation(token, branchId, reservation.id, {
        tableId: tableId || undefined,
      }),
    onCompleted,
  });

  const canConfirm = Boolean(tableId);

  return (
    <ActionConfirmDialog
      open
      tone="info"
      size="lg"
      title="Seat this guest"
      consequence="The reservation moves to SEATED and the table is marked occupied. No order is created or payment collected here."
      context={reservationSummary(reservation)}
      confirmLabel="Seat guest"
      confirmDisabled={!canConfirm}
      pending={mutation.isPending}
      error={mutation.isError ? supervisorReservationActionErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
      onConfirm={() => mutation.mutate()}
    >
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-text-secondary">
          {existingTableId ? "Confirm or change the table for seating." : "A table is required to seat this guest."}
        </p>
        <SupervisorReservationTableSelect
          token={token}
          branchId={branchId}
          value={tableId}
          partySize={reservation.partySize}
          currentTableId={existingTableId}
          disabled={mutation.isPending}
          onChange={setTableId}
        />
      </div>
    </ActionConfirmDialog>
  );
}

// ── Assign / Change table (PENDING/CONFIRMED/SEATED) ─────────────────────────
export function SupervisorAssignTableDialog({
  branchId,
  mode,
  onClose,
  onCompleted,
  reservation,
  token,
}: BaseDialogProps & { mode: "assign" | "change" }) {
  const existingTableId = reservation.tableId || reservation.table?.id || null;
  const [tableId, setTableId] = useState<string | null>(mode === "change" ? null : existingTableId);

  const mutation = useReservationActionMutation({
    token,
    branchId,
    reservationId: reservation.id,
    successTitle: mode === "change" ? "Table changed" : "Table assigned",
    mutationFn: () => {
      if (!tableId) throw new Error("Select a table to assign.");
      return assignSupervisorReservationTable(token, branchId, reservation.id, tableId);
    },
    onCompleted,
  });

  const canConfirm = Boolean(tableId) && tableId !== existingTableId;

  return (
    <ActionConfirmDialog
      open
      tone="info"
      size="lg"
      title={mode === "change" ? "Change the table" : "Assign a table"}
      consequence="The reservation keeps its current lifecycle status. The floor overlay updates to the new table. The service rejects a hard time-window conflict."
      context={reservationSummary(reservation)}
      confirmLabel={mode === "change" ? "Change table" : "Assign table"}
      confirmDisabled={!canConfirm}
      pending={mutation.isPending}
      error={mutation.isError ? supervisorReservationActionErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
      onConfirm={() => mutation.mutate()}
    >
      <SupervisorReservationTableSelect
        token={token}
        branchId={branchId}
        value={tableId}
        partySize={reservation.partySize}
        currentTableId={existingTableId}
        disabled={mutation.isPending}
        onChange={setTableId}
      />
    </ActionConfirmDialog>
  );
}

// ── Cancel (active → CANCELLED, reason required) ─────────────────────────────
export function SupervisorCancelReservationDialog({
  branchId,
  onClose,
  onCompleted,
  reservation,
  token,
}: BaseDialogProps) {
  const [reason, setReason] = useState("");
  const mutation = useReservationActionMutation({
    token,
    branchId,
    reservationId: reservation.id,
    successTitle: "Reservation cancelled",
    mutationFn: () => {
      const trimmed = reason.trim();
      if (!trimmed) throw new Error("A cancellation reason is required.");
      return cancelSupervisorReservation(token, branchId, reservation.id, trimmed);
    },
    onCompleted,
  });

  return (
    <ActionConfirmDialog
      open
      tone="danger"
      title="Cancel this reservation"
      consequence="The reservation moves to CANCELLED and out of the active queue into History. Any assigned table is released. This does not delete the record."
      context={reservationSummary(reservation)}
      reason={{
        label: "Cancellation reason (required)",
        placeholder: "Why is this reservation being cancelled?",
        value: reason,
        onChange: setReason,
        required: true,
      }}
      confirmLabel="Cancel reservation"
      confirmDisabled={!reason.trim()}
      pending={mutation.isPending}
      error={mutation.isError ? supervisorReservationActionErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
      onConfirm={() => mutation.mutate()}
    />
  );
}

// ── No-show (PENDING/CONFIRMED → NO_SHOW) ────────────────────────────────────
export function SupervisorNoShowReservationDialog({
  branchId,
  onClose,
  onCompleted,
  reservation,
  token,
}: BaseDialogProps) {
  const [reason, setReason] = useState("");
  const normalized = normalizeSupervisorReservation(reservation);
  const overdueLabel = reservation.overdue
    ? normalized.tags.find((tag) => tag.key === "overdue")?.label
    : null;

  const mutation = useReservationActionMutation({
    token,
    branchId,
    reservationId: reservation.id,
    successTitle: "Marked as no-show",
    mutationFn: () =>
      markSupervisorReservationNoShow(token, branchId, reservation.id, {
        reason: reason.trim() || undefined,
      }),
    onCompleted,
  });

  return (
    <ActionConfirmDialog
      open
      tone="warning"
      title="Mark as no-show"
      consequence="The reservation moves to NO_SHOW and into History. This is a deliberate decision — overdue reservations are never marked automatically."
      context={
        <div className="grid gap-1">
          {reservationSummary(reservation)}
          {overdueLabel ? <p className="font-semibold text-status-danger">{overdueLabel}</p> : null}
        </div>
      }
      reason={{
        label: "Reason (optional)",
        placeholder: "Optional note for the record…",
        value: reason,
        onChange: setReason,
      }}
      confirmLabel="Mark no-show"
      pending={mutation.isPending}
      error={mutation.isError ? supervisorReservationActionErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
      onConfirm={() => mutation.mutate()}
    />
  );
}

// ── Manual complete (SEATED → COMPLETED) ─────────────────────────────────────
export function SupervisorCompleteReservationDialog({
  branchId,
  onClose,
  onCompleted,
  reservation,
  token,
}: BaseDialogProps) {
  const [note, setNote] = useState("");
  const linkedOrder = reservation.seatedOrder?.orderNumber || reservation.seatedOrderId;

  const mutation = useReservationActionMutation({
    token,
    branchId,
    reservationId: reservation.id,
    successTitle: "Visit completed",
    mutationFn: () => completeSupervisorReservation(token, branchId, reservation.id, note.trim() || undefined),
    onCompleted,
  });

  return (
    <ActionConfirmDialog
      open
      tone="info"
      title="Mark visit complete"
      consequence="The reservation moves to COMPLETED and into History. This does NOT close an order or collect payment — it records that the visit is finished (useful when there is no linked order)."
      context={
        <div className="grid gap-1">
          {reservationSummary(reservation)}
          <p className="text-text-muted">
            {linkedOrder ? `Linked order: ${linkedOrder}` : "No linked order — completion is manual."}
          </p>
        </div>
      }
      reason={{
        label: "Completion note (optional)",
        placeholder: "Optional note for the record…",
        value: note,
        onChange: setNote,
      }}
      confirmLabel="Mark complete"
      pending={mutation.isPending}
      error={mutation.isError ? supervisorReservationActionErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
      onConfirm={() => mutation.mutate()}
    />
  );
}
