import { useEffect, useState } from "react";

import { Button } from "@/components/ui";
import { emptyManagerTaxCategory, validateTaxMatrixDraft } from "@/lib/manager/settings-model";
import type { ManagerOrgSettings, ManagerTaxCategory } from "@/lib/manager/settings-types";

import { fieldInputClass, ManagerSettingsField, ManagerSettingsSectionCard } from "./ManagerSettingsSectionCard";

type Draft = { defaultVatPct: string; categories: ManagerTaxCategory[] };

function categoriesFromRaw(raw: Record<string, unknown>): ManagerTaxCategory[] {
  const list = Array.isArray(raw.categories) ? raw.categories : [];
  return list
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      name: typeof entry.name === "string" ? entry.name : "",
      vatPct: typeof entry.vatPct === "number" ? entry.vatPct : Number(entry.vatPct) || 0,
    }));
}

function draftFromSettings(settings: ManagerOrgSettings): Draft {
  const raw = settings.taxMatrix;
  const defaultVatPct = typeof raw.defaultVatPct === "number" ? raw.defaultVatPct : Number(raw.defaultVatPct) || 0;
  return { defaultVatPct: String(defaultVatPct), categories: categoriesFromRaw(raw) };
}

function sameCategories(a: ManagerTaxCategory[], b: ManagerTaxCategory[]) {
  if (a.length !== b.length) return false;
  return a.every((row, index) => row.name === b[index].name && row.vatPct === b[index].vatPct);
}

type ManagerTaxMatrixSectionProps = {
  settings: ManagerOrgSettings;
  onSave: (input: { defaultVatPct: number; categories: ManagerTaxCategory[] }) => Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
  clearError: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function ManagerTaxMatrixSection({
  clearError,
  errorMessage,
  isSaving,
  onDirtyChange,
  onSave,
  settings,
}: ManagerTaxMatrixSectionProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromSettings(settings));

  useEffect(() => {
    setDraft(draftFromSettings(settings));
  }, [settings]);

  const errors = validateTaxMatrixDraft(draft);
  const baseline = draftFromSettings(settings);
  const isDirty =
    draft.defaultVatPct !== baseline.defaultVatPct || !sameCategories(draft.categories, baseline.categories);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  return (
    <ManagerSettingsSectionCard
      title="Tax & VAT"
      description="The default VAT percentage applied to sales, and any per-category overrides."
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
          defaultVatPct: Number(draft.defaultVatPct),
          categories: draft.categories
            .map((category) => ({ name: category.name.trim(), vatPct: category.vatPct }))
            .filter((category) => category.name),
        });
      }}
    >
      <ManagerSettingsField label="Default VAT %" error={errors.defaultVatPct}>
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          className={fieldInputClass}
          value={draft.defaultVatPct}
          disabled={isSaving}
          onChange={(event) => setDraft((current) => ({ ...current, defaultVatPct: event.target.value }))}
        />
      </ManagerSettingsField>

      <div className="grid gap-2">
        <span className="text-sm font-semibold text-text-secondary">Category overrides</span>
        {draft.categories.length === 0 ? (
          <p className="text-sm text-text-muted">No category overrides — every item uses the default VAT %.</p>
        ) : null}
        {draft.categories.map((category, index) => (
          <div key={index} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
            <ManagerSettingsField label="Category name" error={errors[`category-${index}-name`]}>
              <input
                className={fieldInputClass}
                value={category.name}
                disabled={isSaving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    categories: current.categories.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, name: event.target.value } : row,
                    ),
                  }))
                }
              />
            </ManagerSettingsField>
            <ManagerSettingsField label="VAT %" error={errors[`category-${index}-vatPct`]}>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className={fieldInputClass}
                value={category.vatPct}
                disabled={isSaving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    categories: current.categories.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, vatPct: Number(event.target.value) } : row,
                    ),
                  }))
                }
              />
            </ManagerSettingsField>
            <Button
              variant="tertiary"
              disabled={isSaving}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  categories: current.categories.filter((_, rowIndex) => rowIndex !== index),
                }))
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          disabled={isSaving}
          className="justify-self-start"
          onClick={() =>
            setDraft((current) => ({ ...current, categories: [...current.categories, emptyManagerTaxCategory()] }))
          }
        >
          Add category
        </Button>
      </div>
    </ManagerSettingsSectionCard>
  );
}
