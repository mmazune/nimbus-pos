import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import {
  createSupervisorReservation,
  invalidateSupervisorReservationCaches,
  supervisorReservationActionErrorCopy,
  todayIsoDate,
  type CreateSupervisorReservationInput,
  type SupervisorReservation,
} from "@/lib/supervisor/reservations";
import { SupervisorReservationTableSelect } from "./SupervisorReservationTableSelect";

type SupervisorCreateReservationDialogProps = {
  token: string;
  branchId: string;
  /** Prefill the operational date from the current Arriving view. */
  defaultDate?: string;
  onClose: () => void;
  onCreated: (reservation: SupervisorReservation) => void;
};

const sourceOptions = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE", label: "Phone" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "MANUAL", label: "Manual" },
  { value: "OTHER", label: "Other" },
];

const fieldClass =
  "min-h-11 w-full rounded-md bg-surface-muted px-3 text-base font-medium text-text-primary shadow-subtle focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+()\-\s\d]{6,}$/;

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1 text-sm font-semibold text-text-secondary">
      <span>
        {label}
        {required ? <span className="text-status-danger"> *</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="text-xs font-medium text-text-muted">{hint}</span> : null}
      {error ? (
        <span role="alert" className="text-xs font-semibold text-status-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function SupervisorCreateReservationDialog({
  branchId,
  defaultDate,
  onClose,
  onCreated,
  token,
}: SupervisorCreateReservationDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [date, setDate] = useState(defaultDate || todayIsoDate());
  const [time, setTime] = useState("19:00");
  const [duration, setDuration] = useState("");
  const [source, setSource] = useState("PHONE");
  const [tableId, setTableId] = useState<string | null>(null);
  const [deposit, setDeposit] = useState("");
  const [notes, setNotes] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    firstFieldRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const toRestore = returnFocusRef.current;
      if (toRestore instanceof HTMLElement) toRestore.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedPartySize = Number.parseInt(partySize, 10);
  const parsedDuration = duration.trim() ? Number.parseInt(duration, 10) : undefined;
  const parsedDeposit = deposit.trim() ? Number.parseFloat(deposit) : undefined;

  const scheduledDate = useMemo(() => {
    if (!date || !time) return null;
    const parsed = new Date(`${date}T${time}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [date, time]);

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (!customerName.trim()) next.customerName = "Guest name is required.";
    else if (customerName.trim().length > 200) next.customerName = "Keep the name under 200 characters.";
    if (!Number.isInteger(parsedPartySize) || parsedPartySize < 1) next.partySize = "Party size must be at least 1.";
    if (!date) next.date = "Choose a date.";
    if (!time) next.time = "Choose a time.";
    if (scheduledDate && scheduledDate.getTime() < Date.now()) next.time = "Reservation time cannot be in the past.";
    if (customerEmail.trim() && !emailPattern.test(customerEmail.trim())) next.customerEmail = "Enter a valid email.";
    if (customerPhone.trim() && !phonePattern.test(customerPhone.trim())) next.customerPhone = "Enter a valid phone number.";
    if (duration.trim() && (!Number.isInteger(parsedDuration) || (parsedDuration ?? 0) < 1)) {
      next.duration = "Duration must be a whole number of minutes.";
    }
    if (deposit.trim() && (parsedDeposit === undefined || Number.isNaN(parsedDeposit) || parsedDeposit < 0)) {
      next.deposit = "Deposit must be zero or more.";
    }
    if (notes.length > 1000) next.notes = "Notes must be under 1000 characters.";
    if (specialRequests.length > 1000) next.specialRequests = "Special requests must be under 1000 characters.";
    return next;
  }, [
    customerName,
    parsedPartySize,
    date,
    time,
    scheduledDate,
    customerEmail,
    customerPhone,
    duration,
    parsedDuration,
    deposit,
    parsedDeposit,
    notes,
    specialRequests,
  ]);

  const isValid = Object.keys(errors).length === 0 && Boolean(scheduledDate);

  const mutation = useMutation({
    mutationFn: () => {
      if (!scheduledDate) throw new Error("Choose a valid date and time.");
      const input: CreateSupervisorReservationInput = {
        customerName: customerName.trim(),
        partySize: parsedPartySize,
        reservationAt: scheduledDate.toISOString(),
        source,
      };
      if (customerPhone.trim()) input.customerPhone = customerPhone.trim();
      if (customerEmail.trim()) input.customerEmail = customerEmail.trim();
      if (parsedDuration) input.expectedDurationMinutes = parsedDuration;
      if (tableId) input.tableId = tableId;
      if (parsedDeposit !== undefined && parsedDeposit > 0) input.depositRequired = parsedDeposit;
      if (notes.trim()) input.notes = notes.trim();
      if (specialRequests.trim()) input.specialRequests = specialRequests.trim();
      return createSupervisorReservation(token, branchId, input);
    },
    onSuccess: (reservation) => {
      invalidateSupervisorReservationCaches(queryClient, branchId, reservation.id);
      showToast({ tone: "success", title: "Reservation created", description: customerName.trim() });
      onCreated(reservation);
    },
  });

  function handleSubmit() {
    setSubmitted(true);
    if (!isValid || mutation.isPending) return;
    mutation.mutate();
  }

  const showError = (field: string) => (submitted ? errors[field] : undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-6 w-full max-w-2xl rounded-lg bg-surface p-6 shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-text-primary">
              Create reservation
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Adds a PENDING reservation for this branch. It becomes visible to Waiter immediately.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close create reservation"
            onClick={() => {
              if (!mutation.isPending) onClose();
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary hover:text-text-primary focus-visible:shadow-focus focus-visible:outline-none"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <Field label="Guest name" htmlFor="res-name" required error={showError("customerName")}>
            <input
              id="res-name"
              ref={firstFieldRef}
              className={fieldClass}
              value={customerName}
              maxLength={200}
              disabled={mutation.isPending}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="res-phone" error={showError("customerPhone")}>
              <input
                id="res-phone"
                className={fieldClass}
                value={customerPhone}
                inputMode="tel"
                disabled={mutation.isPending}
                onChange={(event) => setCustomerPhone(event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="res-email" error={showError("customerEmail")}>
              <input
                id="res-email"
                className={fieldClass}
                value={customerEmail}
                inputMode="email"
                disabled={mutation.isPending}
                onChange={(event) => setCustomerEmail(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Party size" htmlFor="res-party" required error={showError("partySize")}>
              <input
                id="res-party"
                type="number"
                min={1}
                className={cn(fieldClass, "tabular-nums")}
                value={partySize}
                disabled={mutation.isPending}
                onChange={(event) => setPartySize(event.target.value)}
              />
            </Field>
            <Field label="Date" htmlFor="res-date" required error={showError("date")}>
              <input
                id="res-date"
                type="date"
                className={cn(fieldClass, "tabular-nums")}
                value={date}
                min={todayIsoDate()}
                disabled={mutation.isPending}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label="Time" htmlFor="res-time" required error={showError("time")}>
              <input
                id="res-time"
                type="time"
                className={cn(fieldClass, "tabular-nums")}
                value={time}
                disabled={mutation.isPending}
                onChange={(event) => setTime(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Duration (min)" htmlFor="res-duration" error={showError("duration")} hint="Defaults to 120">
              <input
                id="res-duration"
                type="number"
                min={1}
                className={cn(fieldClass, "tabular-nums")}
                value={duration}
                placeholder="120"
                disabled={mutation.isPending}
                onChange={(event) => setDuration(event.target.value)}
              />
            </Field>
            <Field label="Source" htmlFor="res-source">
              <select
                id="res-source"
                className={fieldClass}
                value={source}
                disabled={mutation.isPending}
                onChange={(event) => setSource(event.target.value)}
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Deposit required (UGX)" htmlFor="res-deposit" error={showError("deposit")} hint="Optional">
              <input
                id="res-deposit"
                type="number"
                min={0}
                step="0.01"
                className={cn(fieldClass, "tabular-nums")}
                value={deposit}
                disabled={mutation.isPending}
                onChange={(event) => setDeposit(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-1">
            <span className="text-sm font-semibold text-text-secondary">Table (optional)</span>
            <SupervisorReservationTableSelect
              token={token}
              branchId={branchId}
              value={tableId}
              partySize={parsedPartySize}
              allowNone
              disabled={mutation.isPending}
              onChange={setTableId}
            />
          </div>

          <Field label="Notes" htmlFor="res-notes" error={showError("notes")}>
            <textarea
              id="res-notes"
              className={cn(fieldClass, "min-h-[64px] py-2")}
              value={notes}
              maxLength={1000}
              disabled={mutation.isPending}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>

          <Field label="Special requests" htmlFor="res-special" error={showError("specialRequests")}>
            <textarea
              id="res-special"
              className={cn(fieldClass, "min-h-[64px] py-2")}
              value={specialRequests}
              maxLength={1000}
              disabled={mutation.isPending}
              onChange={(event) => setSpecialRequests(event.target.value)}
            />
          </Field>

          {mutation.isError ? (
            <p role="alert" className="rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
              {supervisorReservationActionErrorCopy(mutation.error)}
            </p>
          ) : null}
          {submitted && !isValid ? (
            <p role="alert" className="rounded-md bg-status-warning-surface px-3 py-2 text-sm font-semibold text-status-warning">
              Fix the highlighted fields before creating the reservation.
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="tertiary" disabled={mutation.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || (submitted && !isValid)}>
              {mutation.isPending ? "Creating…" : "Create reservation"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
