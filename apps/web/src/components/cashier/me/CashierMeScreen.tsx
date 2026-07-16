import { ShieldCheck } from "@phosphor-icons/react";
import { useRouter } from "next/router";
import { useState } from "react";

import { Badge, PageShell } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCashierContext } from "@/lib/cashier/context";
import { useCashierReadiness } from "@/lib/cashier/readiness";

import { CashierDemoHelpCard } from "./CashierDemoHelpCard";
import { CashierKnownLimitationsCard } from "./CashierKnownLimitationsCard";
import { CashierProfileCard } from "./CashierProfileCard";
import { CashierReadinessSummaryCard } from "./CashierReadinessSummaryCard";
import { CashierRestrictedSurfacesCard } from "./CashierRestrictedSurfacesCard";
import { CashierScopeCard } from "./CashierScopeCard";
import { CashierSessionCard } from "./CashierSessionCard";
import { CashierWorkflowChecklist } from "./CashierWorkflowChecklist";

export function CashierMeScreen() {
  const router = useRouter();
  const { isAuthenticated, isCashier, isLoading, logout } = useAuth();
  const cashierContext = useCashierContext();
  const readiness = useCashierReadiness();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
      return;
    }

    void router.replace("/login?reason=logged_out");
  }

  const branchReady = Boolean(cashierContext.branchId);

  return (
    <PageShell
      title="Cashier profile"
      subtitle="Session, branch, readiness, and cashier-safe workflow boundaries."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant={isCashier ? "success" : "warning"}>Cashier scope</Badge>
          <Badge variant={readiness.till.status === "active" ? "success" : "warning"}>
            {readiness.till.label}
          </Badge>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg bg-status-info-surface p-4 text-sm text-status-info">
          <ShieldCheck size={22} weight="bold" className="shrink-0" aria-hidden />
          <p>
            This surface is informational and session-focused. It does not open manager approvals,
            payroll, staff lists, accounting, reports, franchise dashboards, KDS controls, or device
            administration.
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] items-start gap-6">
          <div className="min-w-0 space-y-5">
            <CashierProfileCard context={cashierContext} />
            <CashierWorkflowChecklist />
            <CashierScopeCard permissions={cashierContext.permissions} />
            <CashierKnownLimitationsCard />
          </div>

          <aside className="sticky top-40 space-y-5">
            <CashierSessionCard
              context={cashierContext}
              isAuthenticated={isAuthenticated}
              isCashier={isCashier}
              isLoading={isLoading}
              branchReady={branchReady}
              isLoggingOut={isLoggingOut}
              onLogout={() => void handleLogout()}
            />
            <CashierReadinessSummaryCard readiness={readiness} />
            <CashierRestrictedSurfacesCard />
            <CashierDemoHelpCard />
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
