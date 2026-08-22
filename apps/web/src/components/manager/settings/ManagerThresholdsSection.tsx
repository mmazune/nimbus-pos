import { useEffect, useState } from "react";

import { validateThresholdsDraft } from "@/lib/manager/settings-model";
import type { ManagerOrgSettings } from "@/lib/manager/settings-types";

import { fieldInputClass, ManagerSettingsField, ManagerSettingsSectionCard } from "./ManagerSettingsSectionCard";

type Draft = { lateVoidMin: string; heavyDiscountUGX: string; discountApprovalThreshold: string };

function draftFromSettings(settings: ManagerOrgSettings): Draft {
  const anomaly = settings.anomalyThresholds;
  const lateVoidMin = typeof anomaly.lateVoidMin === "number" ? anomaly.lateVoidMin : Number(anomaly.lateVoidMin) || 0;
  const heavyDiscountUGX =
    typeof anomaly.heavyDiscountUGX === "number" ? anomaly.heavyDiscountUGX : Number(anomaly.heavyDiscountUGX) || 0;
  return {
    lateVoidMin: String(lateVoidMin),
    heavyDiscountUGX: String(heavyDiscountUGX),
    discountApprovalThreshold: settings.discountApprovalThreshold,
  };
}

type ManagerThresholdsSectionProps = {
  settings: ManagerOrgSettings;
  onSave: (input: { lateVoidMin: number; heavyDiscountUGX: number; discountApprovalThreshold: string }) => Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
  clearError: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function ManagerThresholdsSection({
  clearError,
  errorMessage,
  isSaving,
  onDirtyChange,
  onSave,
  settings,
}: ManagerThresholdsSectionProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromSettings(settings));

  useEffect(() => {
    setDraft(draftFromSettings(settings));
  }, [settings]);

  const errors = validateThresholdsDraft(draft);
  const baseline = draftFromSettings(settings);
  const isDirty =
    draft.lateVoidMin !== baseline.lateVoidMin ||
    draft.heavyDiscountUGX !== baseline.heavyDiscountUGX ||
    draft.discountApprovalThreshold !== baseline.discountApprovalThreshold;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  return (
    <ManagerSettingsSectionCard
      title="Approval thresholds"
      description="When a void is flagged as late, when a discount is flagged as heavy, and the subtotal above which a discount needs approval."
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
          lateVoidMin: Number(draft.lateVoidMin),
          heavyDiscountUGX: Number(draft.heavyDiscountUGX),
          discountApprovalThreshold: draft.discountApprovalThreshold,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <ManagerSettingsField label="Late void (minutes)" error={errors.lateVoidMin}>
          <input
            type="number"
            min={0}
            step="1"
            className={fieldInputClass}
            value={draft.lateVoidMin}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...current, lateVoidMin: event.target.value }))}
          />
        </ManagerSettingsField>
        <ManagerSettingsField label="Heavy discount (UGX)" error={errors.heavyDiscountUGX}>
          <input
            type="number"
            min={0}
            step="1"
            className={fieldInputClass}
            value={draft.heavyDiscountUGX}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...current, heavyDiscountUGX: event.target.value }))}
          />
        </ManagerSettingsField>
        <ManagerSettingsField label="Discount approval threshold" error={errors.discountApprovalThreshold}>
          <input
            type="number"
            min={0}
            step="1"
            className={fieldInputClass}
            value={draft.discountApprovalThreshold}
            disabled={isSaving}
            onChange={(event) =>
              setDraft((current) => ({ ...current, discountApprovalThreshold: event.target.value }))
            }
          />
        </ManagerSettingsField>
      </div>
    </ManagerSettingsSectionCard>
  );
}
