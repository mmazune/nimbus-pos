import { useEffect, useState } from "react";

import { validateTolerancesDraft } from "@/lib/manager/settings-model";
import type { ManagerOrgSettings } from "@/lib/manager/settings-types";

import { fieldInputClass, ManagerSettingsField, ManagerSettingsSectionCard } from "./ManagerSettingsSectionCard";

type Draft = { autoClockOutHours: string; variancePct: string };

function draftFromSettings(settings: ManagerOrgSettings): Draft {
  const attendance = settings.attendance;
  const inventory = settings.inventoryTolerance;
  const autoClockOutHours =
    typeof attendance.autoClockOutHours === "number"
      ? attendance.autoClockOutHours
      : Number(attendance.autoClockOutHours) || 16;
  const variancePct =
    typeof inventory.variancePct === "number" ? inventory.variancePct : Number(inventory.variancePct) || 2;
  return { autoClockOutHours: String(autoClockOutHours), variancePct: String(variancePct) };
}

type ManagerTolerancesSectionProps = {
  settings: ManagerOrgSettings;
  onSave: (input: { attendance: Record<string, unknown>; inventoryTolerance: Record<string, unknown> }) => Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
  clearError: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

/**
 * Both `attendance` and `inventoryTolerance` are full-replace JSON columns
 * server-side (`SettingsService.updateSettings` — no deep merge). This section
 * spreads the EXISTING loaded object and overrides only the one known field, so a
 * key this form does not know about (added out-of-band) is never silently dropped.
 */
export function ManagerTolerancesSection({
  clearError,
  errorMessage,
  isSaving,
  onDirtyChange,
  onSave,
  settings,
}: ManagerTolerancesSectionProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromSettings(settings));

  useEffect(() => {
    setDraft(draftFromSettings(settings));
  }, [settings]);

  const errors = validateTolerancesDraft(draft);
  const baseline = draftFromSettings(settings);
  const isDirty = draft.autoClockOutHours !== baseline.autoClockOutHours || draft.variancePct !== baseline.variancePct;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  return (
    <ManagerSettingsSectionCard
      title="Attendance & inventory"
      description="Hours after a clock-in before a shift is auto-clocked-out, and the stock-count variance percentage treated as within tolerance."
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
        await onSave({
          attendance: { ...settings.attendance, autoClockOutHours: Number(draft.autoClockOutHours) },
          inventoryTolerance: { ...settings.inventoryTolerance, variancePct: Number(draft.variancePct) },
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ManagerSettingsField label="Auto clock-out (hours)" error={errors.autoClockOutHours}>
          <input
            type="number"
            min={1}
            max={48}
            step="1"
            className={fieldInputClass}
            value={draft.autoClockOutHours}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...current, autoClockOutHours: event.target.value }))}
          />
        </ManagerSettingsField>
        <ManagerSettingsField label="Stock variance tolerance (%)" error={errors.variancePct}>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            className={fieldInputClass}
            value={draft.variancePct}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...current, variancePct: event.target.value }))}
          />
        </ManagerSettingsField>
      </div>
    </ManagerSettingsSectionCard>
  );
}
