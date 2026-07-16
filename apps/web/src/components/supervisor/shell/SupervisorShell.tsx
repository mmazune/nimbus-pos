import { ReactNode } from "react";

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
      <div className="min-h-screen bg-page">
        <SupervisorHeader readinessItems={readiness.items} />
        <SupervisorReadinessStrip items={readiness.items} />
        <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-28 pt-40 sm:px-6 xl:px-8">
          {children}
        </main>
        <SupervisorBottomNav />
      </div>
    </SupervisorSessionGuard>
  );
}
