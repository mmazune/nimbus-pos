import { ReactNode } from "react";

import { OperationalShell } from "@/components/pos-shell/OperationalShell";
import { WaiterBottomNav } from "@/components/waiter/shell/WaiterBottomNav";
import { WaiterHeader } from "@/components/waiter/shell/WaiterHeader";
import { WaiterIdleLogoutHandler } from "@/components/waiter/shell/WaiterIdleLogoutHandler";
import { WaiterSessionGuard } from "@/components/waiter/shell/WaiterSessionGuard";
import { WaiterShiftBanner } from "@/components/waiter/shell/WaiterShiftBanner";

type WaiterShellProps = {
  children: ReactNode;
};

export function WaiterShell({ children }: WaiterShellProps) {
  return (
    <WaiterSessionGuard>
      <OperationalShell
        header={<WaiterHeader />}
        readiness={<WaiterShiftBanner />}
        bottomNavigation={<WaiterBottomNav />}
        idleHandler={<WaiterIdleLogoutHandler />}
      >
        {children}
      </OperationalShell>
    </WaiterSessionGuard>
  );
}
