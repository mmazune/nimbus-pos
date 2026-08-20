import { ReactNode, useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

// ─────────────────────────────────────────────────────────────────────────────
// Shared high-impact confirmation dialog for operational actions.
//
// Composable and presentation-only: it owns focus/Escape/validation/pending/error
// plumbing but NOT any action-specific mutation logic. Prompt 3A uses it for
// Mark served; Prompt 3B will reuse it for void/split/merge/transfer/etc. by
// passing the relevant reason/managerPin fields.
// ─────────────────────────────────────────────────────────────────────────────

type ConfirmFieldProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

type ActionConfirmDialogProps = {
  open: boolean;
  title: string;
  consequence: string;
  context?: ReactNode;
  amount?: string | null;
  tone?: "info" | "warning" | "danger";
  size?: "md" | "lg";
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  error?: string | null;
  /** Extra body content (editors, selectors) rendered above the reason field. */
  children?: ReactNode;
  /** Caller-supplied extra disable condition (e.g. invalid editor state). */
  confirmDisabled?: boolean;
  reason?: ConfirmFieldProps;
  managerPin?: ConfirmFieldProps;
  onCancel: () => void;
  onConfirm: () => void;
};

const toneSurface: Record<NonNullable<ActionConfirmDialogProps["tone"]>, string> = {
  info: "bg-status-info-surface",
  warning: "bg-status-warning-surface",
  danger: "bg-status-danger-surface",
};

const sizeClass: Record<NonNullable<ActionConfirmDialogProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function ActionConfirmDialog({
  amount,
  cancelLabel = "Cancel",
  children,
  confirmDisabled: confirmDisabledProp = false,
  confirmLabel = "Confirm",
  consequence,
  context,
  error,
  managerPin,
  onCancel,
  onConfirm,
  open,
  pending = false,
  reason,
  size = "md",
  title,
  tone = "warning",
}: ActionConfirmDialogProps) {
  const titleId = useId();
  const consequenceId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement;
    // Focus the first interactive field, else the dialog container.
    const focusTarget = initialFocusRef.current || dialogRef.current;
    focusTarget?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onCancel();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const toRestore = returnFocusRef.current;
      if (toRestore instanceof HTMLElement) toRestore.focus();
    };
  }, [open, pending, onCancel]);

  if (!open) return null;

  const reasonInvalid = Boolean(reason?.required && !reason.value.trim());
  const pinInvalid = Boolean(managerPin?.required && !managerPin.value.trim());
  const confirmDisabled = pending || reasonInvalid || pinInvalid || confirmDisabledProp;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={consequenceId}
        tabIndex={-1}
        className={cn(
          "w-full max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg bg-surface p-6 shadow-panel focus-visible:outline-none",
          sizeClass[size],
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={cn("rounded-md px-3 py-2", toneSurface[tone])}>
          <h2 id={titleId} className="text-lg font-bold text-text-primary">
            {title}
          </h2>
        </div>

        <p id={consequenceId} className="mt-4 text-sm leading-6 text-text-secondary">
          {consequence}
        </p>

        {context ? <div className="mt-4 text-sm text-text-secondary">{context}</div> : null}

        {amount ? (
          <p className="mt-4 text-2xl font-bold tabular-nums text-text-primary">{amount}</p>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        {reason ? (
          <label className="mt-5 grid gap-1 text-sm font-semibold text-text-secondary">
            <span>
              {reason.label || "Reason"}
              {reason.required ? <span className="text-status-danger"> *</span> : null}
            </span>
            <textarea
              ref={(element) => {
                initialFocusRef.current = element;
              }}
              className="min-h-[84px] rounded-md bg-surface-muted px-3 py-2 text-base font-medium text-text-primary shadow-subtle focus-visible:shadow-focus"
              placeholder={reason.placeholder}
              value={reason.value}
              disabled={pending}
              aria-required={reason.required || undefined}
              aria-invalid={reasonInvalid || undefined}
              onChange={(event) => reason.onChange(event.target.value)}
            />
          </label>
        ) : null}

        {managerPin ? (
          <label className="mt-4 grid gap-1 text-sm font-semibold text-text-secondary">
            <span>
              {managerPin.label || "Manager PIN"}
              {managerPin.required ? <span className="text-status-danger"> *</span> : null}
            </span>
            <input
              ref={(element) => {
                if (!reason) initialFocusRef.current = element;
              }}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              className="min-h-12 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
              value={managerPin.value}
              disabled={pending}
              aria-required={managerPin.required || undefined}
              aria-invalid={pinInvalid || undefined}
              onChange={(event) => managerPin.onChange(event.target.value)}
            />
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="tertiary" disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
