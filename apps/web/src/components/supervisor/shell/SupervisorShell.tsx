import { ReactNode } from "react";

import { OperationalIdleLogoutHandler } from "@/components/pos-shell/OperationalIdleLogoutHandler";
import { OperationalShell } from "@/components/pos-shell/OperationalShell";
import { SupervisorBottomNav } from "@/components/supervisor/shell/SupervisorBottomNav";
import { SupervisorHeader } from "@/components/supervisor/shell/SupervisorHeader";
import { SupervisorReadinessStrip } from "@/components/supervisor/shell/SupervisorReadinessStrip";
import { SupervisorSessionGuard } from "@/components/supervisor/shell/SupervisorSessionGuard";
import { useSupervisorReadiness } from "@/lib/supervisor/context";

type SupervisorShellProps = {
  children: ReactNode;
};

export function SupervisorShell({ children }: SupervisorShellProps) {
  const readiness = useSupervisorReadiness();

  return (
    <SupervisorSessionGuard>
      <OperationalShell
        header={<SupervisorHeader />}
        readiness={<SupervisorReadinessStrip items={readiness.items} />}
        bottomNavigation={<SupervisorBottomNav />}
        idleHandler={<OperationalIdleLogoutHandler />}
      >
        {children}
      </OperationalShell>
    </SupervisorSessionGuard>
  );
}
