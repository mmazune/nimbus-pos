import { useEffect, useState } from "react";

import { validateOperationsDraft } from "@/lib/manager/settings-model";
import type { ManagerOrgSettings } from "@/lib/manager/settings-types";

import { fieldInputClass, ManagerSettingsField, ManagerSettingsSectionCard } from "./ManagerSettingsSectionCard";

type Draft = { reservationHoldMinutes: string; receiptFooter: string; showCostToChef: boolean };

function draftFromSettings(settings: ManagerOrgSettings): Draft {
  return {
    reservationHoldMinutes: String(settings.reservationHoldMinutes),
    receiptFooter: settings.receiptFooter || "",
    showCostToChef: settings.showCostToChef,
  };
}

type ManagerOperationsSectionProps = {
  settings: ManagerOrgSettings;
  onSave: (input: {
    reservationHoldMinutes: number;
    receiptFooter: string;
    showCostToChef: boolean;
  }) => Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
  clearError: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function ManagerOperationsSection({
  clearError,
  errorMessage,
  isSaving,
  onDirtyChange,
  onSave,
  settings,
}: ManagerOperationsSectionProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromSettings(settings));

  useEffect(() => {
    setDraft(draftFromSettings(settings));
  }, [settings]);

  const errors = validateOperationsDraft(draft);
  const baseline = draftFromSettings(settings);
  const isDirty =
    draft.reservationHoldMinutes !== baseline.reservationHoldMinutes ||
    draft.receiptFooter !== baseline.receiptFooter ||
    draft.showCostToChef !== baseline.showCostToChef;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  return (
    <ManagerSettingsSectionCard
      title="Reservations & receipts"
      description="How long an unconfirmed reservation hold is kept, the free-text line printed at the bottom of every receipt, and whether the kitchen display shows item cost."
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
          reservationHoldMinutes: Number(draft.reservationHoldMinutes),
          receiptFooter: draft.receiptFooter.trim(),
          showCostToChef: draft.showCostToChef,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ManagerSettingsField label="Reservation hold (minutes)" error={errors.reservationHoldMinutes}>
          <input
            type="number"
            min={1}
            step="1"
            className={fieldInputClass}
            value={draft.reservationHoldMinutes}
            disabled={isSaving}
            onChange={(event) =>
              setDraft((current) => ({ ...current, reservationHoldMinutes: event.target.value }))
            }
          />
        </ManagerSettingsField>
        <label className="flex items-center gap-2 self-end text-sm font-semibold text-text-secondary">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-border-subtle"
            checked={draft.showCostToChef}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...current, showCostToChef: event.target.checked }))}
          />
          Show item cost on the kitchen display
        </label>
      </div>
      <ManagerSettingsField label="Receipt footer" error={errors.receiptFooter} hint="Up to 500 characters.">
        <textarea
          className="min-h-[84px] w-full rounded-md bg-surface-muted px-3 py-2 text-base font-medium text-text-primary shadow-subtle outline-none focus-visible:shadow-focus disabled:opacity-60"
          maxLength={500}
          value={draft.receiptFooter}
          disabled={isSaving}
          onChange={(event) => setDraft((current) => ({ ...current, receiptFooter: event.target.value }))}
        />
      </ManagerSettingsField>
    </ManagerSettingsSectionCard>
  );
}
