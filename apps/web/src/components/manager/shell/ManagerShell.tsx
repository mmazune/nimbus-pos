import { ReactNode } from "react";

import { ManagerReadinessStrip } from "@/components/manager/shell/ManagerReadinessStrip";
import { ManagerSessionGuard } from "@/components/manager/shell/ManagerSessionGuard";
import { ManagerTopNav } from "@/components/manager/shell/ManagerTopNav";
import { OperationalIdleLogoutHandler } from "@/components/pos-shell/OperationalIdleLogoutHandler";
import { OperationalShell } from "@/components/pos-shell/OperationalShell";
import { ManagerBranchProvider } from "@/lib/manager/branch-context";
import { useManagerReadiness } from "@/lib/manager/context";

type ManagerShellProps = {
  children: ReactNode;
};

/**
 * Manager is the FOURTH consumer of the shared operational shell — never a fork.
 * Track B1 (D-MGRTOPNAV) converts its presentation from the M-P1 bottom nav to the
 * shared `OperationalShell`'s additive `navigation="top"` variant: the `header` slot
 * now renders `ManagerTopNav` (the module bar) instead of `ManagerHeader`, and there
 * is no `bottomNavigation` slot — the shell renders no fixed bottom bar in this mode.
 * Readiness, the idle handler, and the branch provider are unchanged from M-P1.
 */
function ManagerShellFrame({ children }: ManagerShellProps) {
  const readiness = useManagerReadiness();

  return (
    <ManagerSessionGuard>
      <OperationalShell
        navigation="top"
        header={<ManagerTopNav />}
        readiness={<ManagerReadinessStrip items={readiness.items} />}
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
