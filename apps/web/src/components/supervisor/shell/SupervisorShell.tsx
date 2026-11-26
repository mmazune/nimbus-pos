import { ReactNode } from "react";

import { OperationalIdleLogoutHandler } from "@/components/pos-shell/OperationalIdleLogoutHandler";
import { TouchLegacyBody, TouchShell } from "@/components/pos-shell/TouchShell";
import { SupervisorSessionGuard } from "@/components/supervisor/shell/SupervisorSessionGuard";

type SupervisorShellProps = {
  children: ReactNode;
  /** The screen is a kit screen that lays itself out; otherwise the old body gutters. */
  bare?: boolean;
};

export function SupervisorShell({ children, bare = false }: SupervisorShellProps) {
  return (
    <SupervisorSessionGuard>
      <TouchShell role="supervisor" idleHandler={<OperationalIdleLogoutHandler />}>
        {bare ? children : <TouchLegacyBody>{children}</TouchLegacyBody>}
      </TouchShell>
    </SupervisorSessionGuard>
  );
}
