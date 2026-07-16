import { ReactNode } from "react";

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
      <div className="min-h-screen bg-page">
        <CashierIdleLogoutHandler />
        <CashierHeader readinessItems={readiness.items} />
        <CashierReadinessStrip items={readiness.items} />
        <main className="mx-auto min-h-screen min-w-[1280px] max-w-[1600px] px-8 pb-28 pt-40">
          {children}
        </main>
        <CashierBottomNav />
      </div>
    </CashierSessionGuard>
  );
}
