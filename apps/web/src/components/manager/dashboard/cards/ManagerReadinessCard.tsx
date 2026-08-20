import { useMemo } from "react";

import {
  ManagerCardActionLink,
  ManagerCardChecklist,
  ManagerDashboardCard,
  type ManagerChecklistItem,
} from "@/components/manager/dashboard/ManagerDashboardCard";
import { useManagerReadiness } from "@/lib/manager/context";

/**
 * Branch readiness — the Odoo **Tax Returns** card pattern: a checklist instead of
 * a chart (`ai/ODOO_REFERENCE_RESEARCH.md` §2.2).
 *
 * Odoo's version is a setup checklist. Nimbus's honest analogue, named by the
 * roadmap itself, is the branch readiness check built from the **three chips M-P0
 * actually verified** — branch selection, report generators (`/reports/catalog`),
 * and the device registry (`/devices`) — never a fabricated onboarding flow and
 * never a fourth invented step.
 *
 * It reuses the shell's existing `useManagerReadiness()` reads, so this card adds
 * **zero requests**: the two queries behind it are already in flight for the
 * readiness strip and share the same `["manager", …]` keys.
 */
export function ManagerReadinessCard() {
  const readiness = useManagerReadiness();

  const items = useMemo<ManagerChecklistItem[]>(
    () =>
      readiness.items.map((item) => ({
        key: item.key,
        label: item.label,
        detail: item.value,
        // "success" is the only tone that means the check passed; neutral means the
        // check has not completed, which is not the same as passing.
        done: item.tone === "success",
      })),
    [readiness.items],
  );

  const isLoading = readiness.catalogQuery.isLoading || readiness.devicesQuery.isLoading;
  const isError = readiness.catalogQuery.isError && readiness.devicesQuery.isError;

  return (
    <ManagerDashboardCard
      testId="readiness"
      title="Branch readiness"
      icon="branch"
      accent="success"
      isLoading={isLoading}
      isError={isError}
      errorMessage="The readiness checks could not be run, so none is reported as passing."
      actions={<ManagerCardActionLink href="/manager/settings">Settings</ManagerCardActionLink>}
      footnote="Only checks with a verified backing endpoint appear here. Till and shift readiness are deliberately absent — this backend exposes no branch-wide list to check them against."
    >
      <ManagerCardChecklist items={items} />
    </ManagerDashboardCard>
  );
}
