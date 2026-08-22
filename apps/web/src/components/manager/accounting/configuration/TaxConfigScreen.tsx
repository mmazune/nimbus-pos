import { useMemo, useState } from "react";

import {
  AccountingCheckboxField,
  AccountingRouteScopeNote,
  AccountingSelectField,
} from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel } from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { buildTaxConfigWritePayload } from "@/lib/accounting/model";
import {
  isNotFoundError,
  useChartOfAccountsList,
  useTaxConfig,
  useUpdateTaxConfig,
} from "@/lib/manager/accounting-configuration-queries";

const ACCOUNT_FIELDS = [
  { key: "outputTaxAccountId", label: "Output tax account" },
  { key: "inputTaxAccountId", label: "Input tax account" },
  { key: "discountAccountId", label: "Discount account" },
  { key: "depositLiabilityAccountId", label: "Deposit liability account" },
  { key: "payrollPayableAccountId", label: "Payroll payable account" },
] as const;

/**
 * Accounting → Configuration → Tax configuration — Track B5.6 (2026-08-22).
 *
 * `GET /accounting/tax-config` — a SINGLETON object; 404 if none configured
 * yet (never an empty array — a genuinely distinct state from "loading" or
 * "read failed"). ORGANISATION data. **Write-enabled** (PERMS-2):
 * `pos:accounting:tax-config:update` upserts the singleton — updates the
 * existing active row if one exists, else creates one; the same PATCH form
 * handles both the "not yet configured" and "edit existing" cases. `active`
 * is ALWAYS sent explicitly — omitting it makes the service default to
 * `true` (`dto.active ?? true`), so an omitted field would silently
 * re-activate a config this form shows as inactive.
 */
export function TaxConfigScreen() {
  const configQuery = useTaxConfig();
  const accountsQuery = useChartOfAccountsList({ take: 100 });
  const updateMutation = useUpdateTaxConfig();

  const [editOpen, setEditOpen] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const accounts = useMemo(() => accountsQuery.data?.data || [], [accountsQuery.data]);
  const config = configQuery.data;
  const notConfigured = isNotFoundError(configQuery.error);

  function openEdit() {
    setFields({
      outputTaxAccountId: config?.outputTaxAccountId || "",
      inputTaxAccountId: config?.inputTaxAccountId || "",
      discountAccountId: config?.discountAccountId || "",
      depositLiabilityAccountId: config?.depositLiabilityAccountId || "",
      payrollPayableAccountId: config?.payrollPayableAccountId || "",
    });
    setActive(config?.active !== false);
    setFormError(null);
    setEditOpen(true);
  }

  async function submit() {
    setFormError(null);
    try {
      await updateMutation.mutateAsync(
        buildTaxConfigWritePayload({
          outputTaxAccountId: fields.outputTaxAccountId,
          inputTaxAccountId: fields.inputTaxAccountId,
          discountAccountId: fields.discountAccountId,
          depositLiabilityAccountId: fields.depositLiabilityAccountId,
          payrollPayableAccountId: fields.payrollPayableAccountId,
          active,
        }),
      );
      setEditOpen(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "The tax configuration could not be saved. Retry.",
      );
    }
  }

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Tax configuration"
        badge={
          <>
            <Badge variant="info">Read + write</Badge>
            <AccountingRouteScopeNote routeKey="accounting.taxConfig" />
          </>
        }
        primaryAction={
          <Button variant="primary" size="compact" onClick={openEdit}>
            {config ? "Edit configuration" : "Configure"}
          </Button>
        }
      />

      {configQuery.isLoading ? (
        <LoadingState title="Reading tax configuration…" />
      ) : notConfigured ? (
        <EmptyState
          title="Not configured yet"
          description="No active tax ledger configuration exists for this organisation. Use Configure to create one."
        />
      ) : configQuery.isError ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState title="Tax configuration unavailable" description="This could not be read. Retry." />
          <Button variant="secondary" onClick={() => void configQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : config ? (
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-text-primary">Mapped accounts</h2>
            <Badge variant={config.active ? "success" : "neutral"}>{config.active ? "Active" : "Inactive"}</Badge>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Output tax</dt>
              <dd className="font-semibold text-text-primary">
                {config.outputTaxAccount ? `${config.outputTaxAccount.code} — ${config.outputTaxAccount.name}` : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Input tax</dt>
              <dd className="font-semibold text-text-primary">
                {config.inputTaxAccount ? `${config.inputTaxAccount.code} — ${config.inputTaxAccount.name}` : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Discount</dt>
              <dd className="font-semibold text-text-primary">
                {config.discountAccount ? `${config.discountAccount.code} — ${config.discountAccount.name}` : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Deposit liability</dt>
              <dd className="font-semibold text-text-primary">
                {config.depositLiabilityAccount
                  ? `${config.depositLiabilityAccount.code} — ${config.depositLiabilityAccount.name}`
                  : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Payroll payable</dt>
              <dd className="font-semibold text-text-primary">
                {config.payrollPayableAccount
                  ? `${config.payrollPayableAccount.code} — ${config.payrollPayableAccount.name}`
                  : "Not set"}
              </dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <ActionConfirmDialog
        open={editOpen}
        title={config ? "Edit tax configuration" : "Configure tax ledger"}
        consequence="Saves the mapped accounts and active flag for this organisation's tax ledger configuration."
        size="lg"
        tone="info"
        confirmLabel="Save configuration"
        pending={updateMutation.isPending}
        error={formError}
        onCancel={() => setEditOpen(false)}
        onConfirm={() => void submit()}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {ACCOUNT_FIELDS.map(({ key, label }) => (
            <AccountingSelectField
              key={key}
              label={label}
              placeholder="Not set"
              value={fields[key] || ""}
              onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
              disabled={updateMutation.isPending}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </option>
              ))}
            </AccountingSelectField>
          ))}
        </div>
        <AccountingCheckboxField label="Active" checked={active} onChange={setActive} disabled={updateMutation.isPending} />
      </ActionConfirmDialog>
    </ManagerContentShell>
  );
}
