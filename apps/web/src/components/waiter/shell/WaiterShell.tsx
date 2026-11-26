import { ReactNode } from "react";

import { TouchLegacyBody, TouchShell } from "@/components/pos-shell/TouchShell";
import { WaiterIdleLogoutHandler } from "@/components/waiter/shell/WaiterIdleLogoutHandler";
import { WaiterSessionGuard } from "@/components/waiter/shell/WaiterSessionGuard";
import { WaiterShiftNotice } from "@/components/waiter/shell/WaiterShiftNotice";
import { useReadyCount } from "@/screens/ready/ReadyScreen";

type WaiterShellProps = {
  children: ReactNode;
  /** The screen is a kit screen that lays itself out; otherwise the old body gutters. */
  bare?: boolean;
};

export function WaiterShell({ children, bare = false }: WaiterShellProps) {
  // The Ready badge: what waits at the pass for this waiter (T2 ready list, shared with the Ready screen).
  const ready = useReadyCount(true);
  return (
    <WaiterSessionGuard>
      <TouchShell role="waiter" notice={<WaiterShiftNotice />} idleHandler={<WaiterIdleLogoutHandler />} counts={ready ? { ready } : undefined}>
        {bare ? children : <TouchLegacyBody>{children}</TouchLegacyBody>}
      </TouchShell>
    </WaiterSessionGuard>
  );
}
