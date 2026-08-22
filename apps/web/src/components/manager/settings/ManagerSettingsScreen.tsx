import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import { ManagerContentShell, ManagerControlPanel } from "@/components/manager/chrome";
import { ErrorState, LoadingState } from "@/components/ui";
import {
  useManagerSettings,
  useManagerSettingsErrorMessage,
} from "@/lib/manager/settings-context";
import {
  isManagerSettingsSectionKey,
  MANAGER_SETTINGS_SECTIONS,
  type ManagerSettingsSectionKey,
} from "@/lib/manager/settings-model";
import { cn } from "@/lib/utils/cn";

import { ManagerCurrencySection } from "./ManagerCurrencySection";
import { ManagerExchangeRatesSection } from "./ManagerExchangeRatesSection";
import { ManagerOperationsSection } from "./ManagerOperationsSection";
import { ManagerRoundingSection } from "./ManagerRoundingSection";
import { ManagerTaxMatrixSection } from "./ManagerTaxMatrixSection";
import { ManagerThresholdsSection } from "./ManagerThresholdsSection";
import { ManagerTolerancesSection } from "./ManagerTolerancesSection";

/**
 * Manager Settings (Track B6) — an Odoo-style grouped-category screen (section
 * rail + save bar per section, `ai/ODOO_REFERENCE_RESEARCH.md` screenshots 07-11)
 * over the real `SettingsController` contract. Every field maps 1:1 to a verified
 * route in `docs/manager-settings-docs/MANAGER_SETTINGS_API_MATRIX.md` §1.
 *
 * Deliberately absent: Platform access, Booking policies, Franchise weights,
 * free-form metadata/defaults — each has a written reason in `settings-model.ts`.
 * Device/printer/terminal registry is a real, zero-UI settings surface Manager
 * holds in full, but is out of this phase's scope (see API matrix §6).
 */
export function ManagerSettingsScreen() {
  const router = useRouter();
  const { clearSaveError, isEnabled, isSaving, query, saveCurrency, saveError, saveGeneral, saveRounding, saveTaxMatrix, saveThresholds } =
    useManagerSettings();
  const errorMessage = useManagerSettingsErrorMessage(saveError);

  const requestedSection = typeof router.query.section === "string" ? router.query.section : "";
  const activeSection: ManagerSettingsSectionKey = isManagerSettingsSectionKey(requestedSection)
    ? requestedSection
    : "currency";

  const [dirty, setDirty] = useState(false);

  // Any section-switch or route-navigation attempt while a section has unsaved
  // changes is confirmed first — the standing dirty-state-guard rule.
  const guardNavigation = useCallback(
    (proceed: () => void) => {
      if (!dirty) {
        proceed();
        return;
      }
      const confirmed = window.confirm("You have unsaved changes. Leave without saving?");
      if (confirmed) proceed();
    },
    [dirty],
  );

  useEffect(() => {
    function onRouteChangeStart(url: string) {
      if (!dirty) return;
      const confirmed = window.confirm("You have unsaved changes. Leave without saving?");
      if (!confirmed) {
        router.events.emit("routeChangeError");
        // Next.js expects a thrown value here to actually cancel the navigation.
        // eslint-disable-next-line no-throw-literal
        throw "Route change aborted by Manager Settings dirty-state guard.";
      }
      void url;
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    router.events.on("routeChangeStart", onRouteChangeStart);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      router.events.off("routeChangeStart", onRouteChangeStart);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty, router.events]);

  function selectSection(key: ManagerSettingsSectionKey) {
    guardNavigation(() => {
      setDirty(false);
      clearSaveError();
      void router.replace({ pathname: router.pathname, query: { ...router.query, section: key } }, undefined, {
        shallow: true,
      });
    });
  }

  return (
    <ManagerContentShell>
      <ManagerControlPanel title="Settings" />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings categories" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {MANAGER_SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              data-manager-settings-rail-item
              aria-current={activeSection === section.key || undefined}
              onClick={() => selectSection(section.key)}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-left text-sm font-semibold outline-none transition-colors",
                "hover:bg-surface-muted focus-visible:shadow-focus",
                activeSection === section.key
                  ? "bg-status-info-surface text-status-info"
                  : "text-text-secondary",
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {!isEnabled ? null : query.isLoading ? (
            <LoadingState title="Loading settings" />
          ) : query.isError ? (
            <ErrorState title="Could not load settings" description="Try again when the connection is stable." />
          ) : query.data ? (
            <>
              {activeSection === "currency" ? (
                <ManagerCurrencySection
                  settings={query.data}
                  onSave={saveCurrency}
                  isSaving={isSaving}
                  errorMessage={errorMessage}
                  clearError={clearSaveError}
                  onDirtyChange={setDirty}
                />
              ) : null}
              {activeSection === "tax" ? (
                <ManagerTaxMatrixSection
                  settings={query.data}
                  onSave={saveTaxMatrix}
                  isSaving={isSaving}
                  errorMessage={errorMessage}
                  clearError={clearSaveError}
                  onDirtyChange={setDirty}
                />
              ) : null}
              {activeSection === "rounding" ? (
                <ManagerRoundingSection
                  settings={query.data}
                  onSave={saveRounding}
                  isSaving={isSaving}
                  errorMessage={errorMessage}
                  clearError={clearSaveError}
                  onDirtyChange={setDirty}
                />
              ) : null}
              {activeSection === "thresholds" ? (
                <ManagerThresholdsSection
                  settings={query.data}
                  onSave={saveThresholds}
                  isSaving={isSaving}
                  errorMessage={errorMessage}
                  clearError={clearSaveError}
                  onDirtyChange={setDirty}
                />
              ) : null}
              {activeSection === "operations" ? (
                <ManagerOperationsSection
                  settings={query.data}
                  onSave={saveGeneral}
                  isSaving={isSaving}
                  errorMessage={errorMessage}
                  clearError={clearSaveError}
                  onDirtyChange={setDirty}
                />
              ) : null}
              {activeSection === "tolerances" ? (
                <ManagerTolerancesSection
                  settings={query.data}
                  onSave={saveGeneral}
                  isSaving={isSaving}
                  errorMessage={errorMessage}
                  clearError={clearSaveError}
                  onDirtyChange={setDirty}
                />
              ) : null}
              {activeSection === "exchange-rates" ? <ManagerExchangeRatesSection /> : null}
            </>
          ) : null}
        </div>
      </div>
    </ManagerContentShell>
  );
}
