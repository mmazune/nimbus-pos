import { useEffect, useState } from "react";

import { validateCurrencyDraft } from "@/lib/manager/settings-model";
import type { ManagerOrgSettings } from "@/lib/manager/settings-types";

import { fieldInputClass, ManagerSettingsField, ManagerSettingsSectionCard } from "./ManagerSettingsSectionCard";

type Draft = { currency: string; baseCurrencyCode: string };

function draftFromSettings(settings: ManagerOrgSettings): Draft {
  return { currency: settings.currency, baseCurrencyCode: settings.baseCurrencyCode || "" };
}

type ManagerCurrencySectionProps = {
  settings: ManagerOrgSettings;
  onSave: (input: { currency: string; baseCurrencyCode?: string }) => Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
  clearError: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function ManagerCurrencySection({
  clearError,
  errorMessage,
  isSaving,
  onDirtyChange,
  onSave,
  settings,
}: ManagerCurrencySectionProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromSettings(settings));

  useEffect(() => {
    setDraft(draftFromSettings(settings));
  }, [settings]);

  const errors = validateCurrencyDraft(draft);
  const isDirty =
    draft.currency.trim().toUpperCase() !== settings.currency.trim().toUpperCase() ||
    draft.baseCurrencyCode.trim().toUpperCase() !== (settings.baseCurrencyCode || "").trim().toUpperCase();

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  return (
    <ManagerSettingsSectionCard
      title="Currency"
      description="The organization's operating currency and an optional base currency used for exchange-rate conversions."
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
          currency: draft.currency.trim().toUpperCase(),
          baseCurrencyCode: draft.baseCurrencyCode.trim() ? draft.baseCurrencyCode.trim().toUpperCase() : undefined,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ManagerSettingsField label="Currency" error={errors.currency} hint="ISO 4217 code, e.g. UGX.">
          <input
            className={fieldInputClass}
            value={draft.currency}
            maxLength={10}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))}
          />
        </ManagerSettingsField>
        <ManagerSettingsField
          label="Base currency (optional)"
          error={errors.baseCurrencyCode}
          hint="Used for exchange-rate conversions."
        >
          <input
            className={fieldInputClass}
            value={draft.baseCurrencyCode}
            maxLength={10}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...current, baseCurrencyCode: event.target.value }))}
          />
        </ManagerSettingsField>
      </div>
    </ManagerSettingsSectionCard>
  );
}
