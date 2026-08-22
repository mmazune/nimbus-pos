import { ReactNode } from "react";

import { Button, Card } from "@/components/ui";

/**
 * The shared Settings section shell (Track B6) — Odoo's grouped-category card with
 * an explicit save bar (`ai/ODOO_REFERENCE_RESEARCH.md` screenshots 07-11): a
 * title, a short description, the fields (composed by the caller), and a save/
 * discard row that appears ONLY once the draft has diverged from the loaded
 * server value (`isDirty`). This is a presentation shell only — every section
 * owns its own draft state, validation and mutation call.
 */
type ManagerSettingsSectionCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  errorMessage?: string | null;
  onSave: () => void;
  onDiscard: () => void;
  saveDisabled?: boolean;
};

export function ManagerSettingsSectionCard({
  children,
  description,
  errorMessage,
  isDirty,
  isSaving,
  onDiscard,
  onSave,
  saveDisabled = false,
  title,
}: ManagerSettingsSectionCardProps) {
  return (
    <Card className="min-w-0" data-manager-settings-section>
      <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>

      <div className="mt-5 grid gap-4">{children}</div>

      {errorMessage ? (
        <p role="alert" className="mt-4 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
          {errorMessage}
        </p>
      ) : null}

      {isDirty ? (
        <div
          data-manager-settings-save-bar
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md bg-status-warning-surface px-4 py-3"
        >
          <span className="text-sm font-semibold text-text-primary">Unsaved changes</span>
          <div className="flex gap-2">
            <Button variant="tertiary" disabled={isSaving} onClick={onDiscard}>
              Discard
            </Button>
            <Button variant="primary" disabled={isSaving || saveDisabled} onClick={onSave}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function ManagerSettingsField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-text-secondary">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-semibold text-status-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs font-medium text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const fieldInputClass =
  "min-h-11 w-full rounded-md bg-surface-muted px-3 text-base font-medium text-text-primary shadow-subtle outline-none transition-[box-shadow] duration-150 ease-out focus-visible:shadow-focus disabled:opacity-60";

export { fieldInputClass };
