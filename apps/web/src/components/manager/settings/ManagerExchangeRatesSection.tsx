import { useState } from "react";

import { Button, Card, EmptyState } from "@/components/ui";
import { useManagerExchangeRates, useManagerSettingsErrorMessage } from "@/lib/manager/settings-context";
import { emptyManagerExchangeRateDraft, formatManagerRate, validateExchangeRateDraft } from "@/lib/manager/settings-model";

import { fieldInputClass, ManagerSettingsField } from "./ManagerSettingsSectionCard";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * List + create only — `CreateExchangeRateDto`/`ExchangeRate` has no edit or
 * delete route on this backend (verified against `settings.controller.ts`
 * directly). A wrong rate is corrected by adding a new row with a later
 * `effectiveAt`, not by editing history.
 */
export function ManagerExchangeRatesSection() {
  const { create, createError, isCreating, isEnabled, query, resetCreate } = useManagerExchangeRates();
  const [draft, setDraft] = useState(() => emptyManagerExchangeRateDraft(todayIsoDate()));
  const errorMessage = useManagerSettingsErrorMessage(createError);
  const errors = validateExchangeRateDraft(draft);

  if (!isEnabled) return null;

  return (
    <Card className="min-w-0" data-manager-settings-section>
      <h2 className="text-lg font-bold text-text-primary">Exchange rates</h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        A history of currency-pair rates used for conversions. There is no edit or delete route on this backend — add
        a new rate with today&apos;s date to correct one, rather than changing history.
      </p>

      {query.isLoading ? (
        <p className="mt-4 text-sm text-text-secondary">Loading…</p>
      ) : query.isError ? (
        <p className="mt-4 text-sm font-semibold text-status-danger">Could not load exchange rates.</p>
      ) : (query.data || []).length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No exchange rates yet" description="Add the first rate below." />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="pb-2 pr-4">Pair</th>
                <th className="pb-2 pr-4">Rate</th>
                <th className="pb-2">Effective</th>
              </tr>
            </thead>
            <tbody>
              {(query.data || []).map((row) => (
                <tr key={row.id} className="border-t border-border-subtle">
                  <td className="py-2 pr-4 font-semibold text-text-primary">
                    {row.baseCurrencyCode} → {row.quoteCurrencyCode}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{formatManagerRate(row.rate)}</td>
                  <td className="py-2 text-text-secondary">
                    {row.effectiveAt ? new Date(row.effectiveAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 grid gap-4 border-t border-border-subtle pt-5 sm:grid-cols-4">
        <ManagerSettingsField label="Base" error={errors.baseCurrencyCode}>
          <input
            className={fieldInputClass}
            maxLength={10}
            value={draft.baseCurrencyCode}
            disabled={isCreating}
            onChange={(event) => setDraft((current) => ({ ...current, baseCurrencyCode: event.target.value }))}
          />
        </ManagerSettingsField>
        <ManagerSettingsField label="Quote" error={errors.quoteCurrencyCode}>
          <input
            className={fieldInputClass}
            maxLength={10}
            value={draft.quoteCurrencyCode}
            disabled={isCreating}
            onChange={(event) => setDraft((current) => ({ ...current, quoteCurrencyCode: event.target.value }))}
          />
        </ManagerSettingsField>
        <ManagerSettingsField label="Rate" error={errors.rate}>
          <input
            type="number"
            min={0}
            step="0.000001"
            className={fieldInputClass}
            value={draft.rate}
            disabled={isCreating}
            onChange={(event) => setDraft((current) => ({ ...current, rate: event.target.value }))}
          />
        </ManagerSettingsField>
        <ManagerSettingsField label="Effective date" error={errors.effectiveAt}>
          <input
            type="date"
            className={fieldInputClass}
            value={draft.effectiveAt}
            disabled={isCreating}
            onChange={(event) => setDraft((current) => ({ ...current, effectiveAt: event.target.value }))}
          />
        </ManagerSettingsField>
      </div>

      {errorMessage ? (
        <p role="alert" className="mt-3 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4">
        <Button
          variant="primary"
          disabled={isCreating || Object.keys(errors).length > 0}
          onClick={() => {
            resetCreate();
            create({
              baseCurrencyCode: draft.baseCurrencyCode.trim().toUpperCase(),
              quoteCurrencyCode: draft.quoteCurrencyCode.trim().toUpperCase(),
              rate: draft.rate.trim(),
              effectiveAt: new Date(draft.effectiveAt).toISOString(),
            });
            setDraft(emptyManagerExchangeRateDraft(todayIsoDate()));
          }}
        >
          {isCreating ? "Adding…" : "Add rate"}
        </Button>
      </div>
    </Card>
  );
}
