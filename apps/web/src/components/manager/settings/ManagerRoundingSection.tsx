import { useEffect, useState } from "react";

import { MANAGER_ROUNDING_MODES, validateRoundingDraft } from "@/lib/manager/settings-model";
import type { ManagerOrgSettings } from "@/lib/manager/settings-types";

import { fieldInputClass, ManagerSettingsField, ManagerSettingsSectionCard } from "./ManagerSettingsSectionCard";

type Draft = { mode: string; increment: string };

function draftFromSettings(settings: ManagerOrgSettings): Draft {
  const raw = settings.rounding;
  const mode = typeof raw.mode === "string" ? raw.mode : "NEAREST";
  const increment = typeof raw.increment === "number" ? raw.increment : Number(raw.increment) || 100;
  return { mode, increment: String(increment) };
}

type ManagerRoundingSectionProps = {
  settings: ManagerOrgSettings;
  onSave: (input: { mode: "NEAREST" | "UP" | "DOWN"; increment: number }) => Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
  clearError: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function ManagerRoundingSection({
  clearError,
  errorMessage,
  isSaving,
  onDirtyChange,
  onSave,
  settings,
}: ManagerRoundingSectionProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromSettings(settings));

  useEffect(() => {
    setDraft(draftFromSettings(settings));
  }, [settings]);

  const errors = validateRoundingDraft(draft);
  const baseline = draftFromSettings(settings);
  const isDirty = draft.mode !== baseline.mode || draft.increment !== baseline.increment;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  return (
    <ManagerSettingsSectionCard
      title="Rounding"
      description="How order totals are rounded to the nearest cash-friendly amount."
      isDirty={isDirty}
      isSaving={isSaving}
      errorMessage={errorMessage}
      saveDisabled={Object.keys(errors).length > 0}
      onDiscard={() => {
        clearError();
        setDraft(draftFromSettings(settings));
      }}
      onSave={async () => {
        if (Object.keys(errors).length > 0) return;
        await onSave({ mode: draft.mode as "NEAREST" | "UP" | "DOWN", increment: Number(draft.increment) });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ManagerSettingsField label="Mode" error={errors.mode}>
          <select
            className={fieldInputClass}
            value={draft.mode}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...current, mode: event.target.value }))}
          >
            {MANAGER_ROUNDING_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </ManagerSettingsField>
        <ManagerSettingsField label="Increment" error={errors.increment} hint="e.g. 100 rounds to the nearest 100.">
          <input
            type="number"
            min={1}
            step="1"
            className={fieldInputClass}
            value={draft.increment}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...current, increment: event.target.value }))}
          />
        </ManagerSettingsField>
      </div>
    </ManagerSettingsSectionCard>
  );
}
