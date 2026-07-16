import { CalendarPlus } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import { type SupervisorCreateLeavePayload } from "@/lib/supervisor/workforce";

type LeaveTypeOption = SupervisorCreateLeavePayload["leaveType"];

const LEAVE_TYPE_OPTIONS: Array<{ value: LeaveTypeOption; label: string }> = [
  { value: "ANNUAL", label: "Annual" },
  { value: "SICK", label: "Sick" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "OTHER", label: "Other" },
];

type SupervisorLeaveRequestFormProps = {
  employeeId: string | null;
  disabledReason: string | null;
  isSubmitting: boolean;
  resetVersion: number;
  onSubmit: (payload: SupervisorCreateLeavePayload) => void;
};

type LeaveFormState = {
  leaveType: LeaveTypeOption;
  startsAt: string;
  endsAt: string;
  reason: string;
};

const initialState: LeaveFormState = {
  leaveType: "ANNUAL",
  startsAt: "",
  endsAt: "",
  reason: "",
};

function todayDateInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validateLeaveForm(state: LeaveFormState, employeeId: string | null) {
  if (!employeeId) return "Employee identity unavailable.";
  if (!state.leaveType) return "Choose a leave type.";
  if (!state.startsAt) return "Start date is required.";
  if (!state.endsAt) return "End date is required.";
  if (state.endsAt < state.startsAt) return "End date cannot be before start date.";
  if (state.reason.length > 1000) return "Reason must be 1,000 characters or fewer.";
  return null;
}

export function SupervisorLeaveRequestForm({
  employeeId,
  disabledReason,
  isSubmitting,
  resetVersion,
  onSubmit,
}: SupervisorLeaveRequestFormProps) {
  const [form, setForm] = useState<LeaveFormState>(initialState);
  const [localError, setLocalError] = useState<string | null>(null);
  const minDate = useMemo(() => todayDateInputValue(), []);
  const validationError = validateLeaveForm(form, employeeId);
  const blockedReason = disabledReason || validationError;
  const isBlocked = Boolean(disabledReason);

  useEffect(() => {
    if (resetVersion > 0) {
      setForm(initialState);
      setLocalError(null);
    }
  }, [resetVersion]);

  function updateForm<K extends keyof LeaveFormState>(key: K, value: LeaveFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setLocalError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextError = validateLeaveForm(form, employeeId);
    if (nextError) {
      setLocalError(nextError);
      return;
    }

    const confirmed =
      typeof window === "undefined" || window.confirm("Submit leave request for review?");
    if (!confirmed) return;

    onSubmit({
      employeeId: employeeId as string,
      leaveType: form.leaveType,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      reason: form.reason.trim() || undefined,
    });
  }

  return (
    <form className="space-y-4 rounded-md bg-surface-muted p-4" onSubmit={handleSubmit}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">Create Leave Request</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Submit a current-employee leave request for review. Approvals remain on the Approvals tab.
          </p>
        </div>
        <CalendarPlus size={22} weight="duotone" aria-hidden className="shrink-0 text-brand-navy-900" />
      </div>

      {isBlocked ? (
        <StatusMessage tone="warning" title="Leave creation unavailable">
          {disabledReason}
        </StatusMessage>
      ) : null}

      {localError ? (
        <StatusMessage tone="danger" title="Check Leave Request">
          {localError}
        </StatusMessage>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="min-w-0 text-sm font-semibold text-text-primary" htmlFor="supervisor-leave-type">
          Leave Type
          <select
            id="supervisor-leave-type"
            name="leaveType"
            className="mt-2 min-h-11 w-full rounded-md bg-surface px-4 text-base text-text-primary shadow-subtle transition-[background-color,box-shadow] duration-150 ease-out disabled:bg-surface-muted disabled:text-text-muted"
            value={form.leaveType}
            onChange={(event) => updateForm("leaveType", event.target.value as LeaveTypeOption)}
            disabled={isBlocked || isSubmitting}
          >
            {LEAVE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-sm font-semibold text-text-primary" htmlFor="supervisor-leave-start">
          Start Date
          <Input
            id="supervisor-leave-start"
            name="startsAt"
            className="mt-2"
            type="date"
            min={minDate}
            value={form.startsAt}
            onChange={(event) => updateForm("startsAt", event.target.value)}
            disabled={isBlocked || isSubmitting}
          />
        </label>

        <label className="min-w-0 text-sm font-semibold text-text-primary" htmlFor="supervisor-leave-end">
          End Date
          <Input
            id="supervisor-leave-end"
            name="endsAt"
            className="mt-2"
            type="date"
            min={form.startsAt || minDate}
            value={form.endsAt}
            onChange={(event) => updateForm("endsAt", event.target.value)}
            disabled={isBlocked || isSubmitting}
          />
        </label>
      </div>

      <label className="block text-sm font-semibold text-text-primary" htmlFor="supervisor-leave-reason">
        Reason
        <textarea
          id="supervisor-leave-reason"
          name="reason"
          className="mt-2 min-h-24 w-full resize-y rounded-md bg-surface px-4 py-3 text-base text-text-primary shadow-subtle transition-[background-color,box-shadow] duration-150 ease-out placeholder:text-text-muted disabled:bg-surface-muted disabled:text-text-muted"
          maxLength={1000}
          placeholder="Optional context for the reviewer"
          value={form.reason}
          onChange={(event) => updateForm("reason", event.target.value)}
          disabled={isBlocked || isSubmitting}
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">
          {blockedReason || "Ready to submit for review"}
        </p>
        <Button type="submit" size="compact" disabled={isBlocked || isSubmitting}>
          {isSubmitting ? "Submitting" : "Submit leave request"}
        </Button>
      </div>
    </form>
  );
}
