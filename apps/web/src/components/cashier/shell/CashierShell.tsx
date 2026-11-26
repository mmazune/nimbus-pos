import { ReactNode } from "react";

import { TouchLegacyBody, TouchShell } from "@/components/pos-shell/TouchShell";
import { CashierIdleLogoutHandler } from "@/components/cashier/shell/CashierIdleLogoutHandler";
import { CashierSessionGuard } from "@/components/cashier/shell/CashierSessionGuard";

type CashierShellProps = {
  children: ReactNode;
  /** The screen is a kit screen that lays itself out; otherwise the old body gutters. */
  bare?: boolean;
};

export function CashierShell({ children, bare = false }: CashierShellProps) {
  return (
    <CashierSessionGuard>
      <TouchShell role="cashier" idleHandler={<CashierIdleLogoutHandler />}>
        {bare ? children : <TouchLegacyBody>{children}</TouchLegacyBody>}
      </TouchShell>
    </CashierSessionGuard>
  );
}
