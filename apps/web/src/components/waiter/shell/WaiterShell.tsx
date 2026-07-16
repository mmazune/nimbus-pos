import { ReactNode } from "react";

import { WaiterBottomNav } from "@/components/waiter/shell/WaiterBottomNav";
import { WaiterHeader } from "@/components/waiter/shell/WaiterHeader";
import { WaiterIdleLogoutHandler } from "@/components/waiter/shell/WaiterIdleLogoutHandler";
import { WaiterPageContainer } from "@/components/waiter/shell/WaiterPageContainer";
import { WaiterSessionGuard } from "@/components/waiter/shell/WaiterSessionGuard";
import { WaiterShiftBanner } from "@/components/waiter/shell/WaiterShiftBanner";

type WaiterShellProps = {
  children: ReactNode;
};

export function WaiterShell({ children }: WaiterShellProps) {
  return (
    <WaiterSessionGuard>
      <div className="min-h-screen bg-page">
        <WaiterIdleLogoutHandler />
        <WaiterHeader />
        <WaiterShiftBanner />
        <WaiterPageContainer>{children}</WaiterPageContainer>
        <WaiterBottomNav />
      </div>
    </WaiterSessionGuard>
  );
}
