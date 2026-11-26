import { ReactNode } from "react";

import { TouchLegacyBody, TouchShell } from "@/components/pos-shell/TouchShell";
import { WaiterIdleLogoutHandler } from "@/components/waiter/shell/WaiterIdleLogoutHandler";
import { WaiterSessionGuard } from "@/components/waiter/shell/WaiterSessionGuard";
import { WaiterShiftNotice } from "@/components/waiter/shell/WaiterShiftNotice";

type WaiterShellProps = {
  children: ReactNode;
  /** The screen is a kit screen that lays itself out; otherwise the old body gutters. */
  bare?: boolean;
};

export function WaiterShell({ children, bare = false }: WaiterShellProps) {
  return (
    <WaiterSessionGuard>
      <TouchShell role="waiter" notice={<WaiterShiftNotice />} idleHandler={<WaiterIdleLogoutHandler />}>
        {bare ? children : <TouchLegacyBody>{children}</TouchLegacyBody>}
      </TouchShell>
    </WaiterSessionGuard>
  );
}
