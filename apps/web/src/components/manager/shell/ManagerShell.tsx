import { ReactNode } from "react";

import { ManagerBottomNav } from "@/components/manager/shell/ManagerBottomNav";
import { ManagerHeader } from "@/components/manager/shell/ManagerHeader";
import { ManagerReadinessStrip } from "@/components/manager/shell/ManagerReadinessStrip";
import { ManagerSessionGuard } from "@/components/manager/shell/ManagerSessionGuard";
import { OperationalIdleLogoutHandler } from "@/components/pos-shell/OperationalIdleLogoutHandler";
import { OperationalShell } from "@/components/pos-shell/OperationalShell";
import { ManagerBranchProvider } from "@/lib/manager/branch-context";
import { useManagerReadiness } from "@/lib/manager/context";

type ManagerShellProps = {
  children: ReactNode;
};

/**
 * Manager is the FOURTH consumer of the shared operational shell — never a fork.
 * It wraps the same `OperationalShell` with the same four slots (header, readiness,
 * bottom nav, shared idle handler) as Waiter / Cashier / Supervisor. The only
 * Manager-specific addition is the branch provider, mounted around the guard so the
 * guard, the header switcher, and every page share one selected branch.
 */
function ManagerShellFrame({ children }: ManagerShellProps) {
  const readiness = useManagerReadiness();

  return (
    <ManagerSessionGuard>
      <OperationalShell
        header={<ManagerHeader />}
        readiness={<ManagerReadinessStrip items={readiness.items} />}
        bottomNavigation={<ManagerBottomNav />}
        idleHandler={<OperationalIdleLogoutHandler />}
      >
        {children}
      </OperationalShell>
    </ManagerSessionGuard>
  );
}

export function ManagerShell({ children }: ManagerShellProps) {
  return (
    <ManagerBranchProvider>
      <ManagerShellFrame>{children}</ManagerShellFrame>
    </ManagerBranchProvider>
  );
}
