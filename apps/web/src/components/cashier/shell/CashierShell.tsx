import { ReactNode } from "react";

import { OperationalShell } from "@/components/pos-shell/OperationalShell";
import { CashierBottomNav } from "@/components/cashier/shell/CashierBottomNav";
import { CashierHeader } from "@/components/cashier/shell/CashierHeader";
import { CashierIdleLogoutHandler } from "@/components/cashier/shell/CashierIdleLogoutHandler";
import { CashierReadinessStrip } from "@/components/cashier/shell/CashierReadinessStrip";
import { CashierSessionGuard } from "@/components/cashier/shell/CashierSessionGuard";
import { useCashierReadiness } from "@/lib/cashier/readiness";

type CashierShellProps = {
  children: ReactNode;
};

export function CashierShell({ children }: CashierShellProps) {
  const readiness = useCashierReadiness();

  return (
    <CashierSessionGuard>
      <OperationalShell
        header={<CashierHeader />}
        readiness={<CashierReadinessStrip items={readiness.items} />}
        bottomNavigation={<CashierBottomNav />}
        idleHandler={<CashierIdleLogoutHandler />}
      >
        {children}
      </OperationalShell>
    </CashierSessionGuard>
  );
}
