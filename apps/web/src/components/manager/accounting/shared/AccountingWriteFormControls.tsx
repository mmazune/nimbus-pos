import { ReactNode, SelectHTMLAttributes } from "react";

import { Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/**
 * Shared presentational form primitives for the Track B5.6 write-enabled
 * surfaces (Budgets, Demand calendar, Chart of accounts, Cost centres,
 * Posting source maps, Tax configuration).
 *
 * Deliberately presentation-only — no `onClick`, no `<Button>`, no mutation of
 * any kind lives here, so this file needs no allow-listing in
 * `scripts/manager-b5-assertions.ts`'s write-affordance ban: the ban targets
 * files that actually issue a write or render an action control, not a label
 * + input/select wrapper. Every B5.6 screen composes these rather than
 * hand-rolling its own label/error markup seven times over.
 */

export function AccountingFieldLabel({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-text-secondary">
      <span>
        {label}
        {required ? <span className="text-status-danger"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs font-normal text-text-muted">{hint}</span> : null}
    </label>
  );
}

export function AccountingTextField({
  label,
  required,
  hint,
  ...inputProps
}: {
  label: string;
  required?: boolean;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">) {
  return (
    <AccountingFieldLabel label={label} required={required} hint={hint}>
      <Input {...inputProps} required={required} aria-required={required || undefined} />
    </AccountingFieldLabel>
  );
}

export function AccountingSelectField({
  label,
  required,
  hint,
  placeholder,
  children,
  ...selectProps
}: {
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">) {
  return (
    <AccountingFieldLabel label={label} required={required} hint={hint}>
      <select
        {...selectProps}
        required={required}
        aria-required={required || undefined}
        className={cn(
          "min-h-11 w-full rounded-md bg-surface px-4 text-base text-text-primary shadow-subtle",
          "disabled:bg-surface-muted disabled:text-text-muted",
        )}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children}
      </select>
    </AccountingFieldLabel>
  );
}

export function AccountingCheckboxField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm font-semibold text-text-secondary">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border-subtle"
      />
      <span className="flex flex-col gap-0.5">
        {label}
        {hint ? <span className="text-xs font-normal text-text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function AccountingFormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
      {message}
    </p>
  );
}

/** A form-shaped panel wrapper — surface + shadow + spacing, reused by every B5.6 create/edit form. */
export function AccountingFormPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg bg-surface p-5 shadow-panel">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  );
}
