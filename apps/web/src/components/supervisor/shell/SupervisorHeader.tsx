import { Clock, DesktopTower, SignOut, Storefront } from "@phosphor-icons/react";
import { useRouter } from "next/router";
import { useState } from "react";

import { Button } from "@/components/ui";
import { CurrentTime } from "@/components/waiter/shell/CurrentTime";
import { useAuth } from "@/lib/auth/AuthProvider";
import { initialsFromName } from "@/lib/supervisor/formatters";
import { useSupervisorContext } from "@/lib/supervisor/context";
import type { SupervisorReadinessItem, SupervisorReadinessTone } from "@/lib/supervisor/state";
import { cn } from "@/lib/utils/cn";

const toneClasses: Record<SupervisorReadinessTone, string> = {
  neutral: "bg-brand-navy-800 text-brand-silver",
  success: "bg-status-success-surface text-status-success",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  info: "bg-status-info-surface text-status-info",
};

export function SupervisorHeader({ readinessItems = [] }: { readinessItems?: SupervisorReadinessItem[] }) {
  const router = useRouter();
  const { logout } = useAuth();
  const supervisorContext = useSupervisorContext();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const initials = initialsFromName(supervisorContext.displayName);
  const headerChips = readinessItems.slice(0, 3);

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
      return;
    }

    void router.replace("/login?reason=logged_out");
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-brand-navy-950 text-text-inverse shadow-panel">
      <div className="mx-auto grid h-20 w-full max-w-[1600px] grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-6 xl:grid-cols-[1fr_auto_1fr] xl:gap-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-white text-brand-navy-900 shadow-subtle">
            <Storefront size={24} weight="duotone" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-normal text-brand-silver">Nimbus POS</p>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-base font-semibold">
              <span className="truncate">{supervisorContext.branchName}</span>
              <span className="text-brand-silver">/</span>
              <DesktopTower size={18} weight="bold" aria-hidden />
              <span className="truncate text-brand-silver">{supervisorContext.workstationLabel}</span>
            </div>
          </div>
        </div>

        <div
          className="hidden h-10 items-center gap-2 rounded-md bg-brand-navy-800 px-4 text-base font-semibold tabular-nums xl:flex"
          aria-live="off"
        >
          <Clock size={18} weight="bold" aria-hidden />
          <CurrentTime />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3 xl:gap-4">
          <div className="hidden max-w-[520px] items-center justify-end gap-2 xl:flex">
            {headerChips.map((item) => (
              <span
                key={item.key}
                className={cn(
                  "inline-flex min-h-8 max-w-44 items-center rounded-full px-3 text-xs font-semibold",
                  toneClasses[item.tone],
                )}
                title={`${item.label}: ${item.value}`}
              >
                <span className="truncate">
                  {item.label}: {item.value}
                </span>
              </span>
            ))}
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-navy-800 text-sm font-bold tracking-normal text-text-inverse">
            {initials}
          </div>
          <div className="hidden min-w-36 text-right md:block">
            <p className="truncate text-sm font-semibold">{supervisorContext.displayName}</p>
            <p className="truncate text-xs font-medium text-brand-silver">{supervisorContext.roleLabel}</p>
          </div>
          <Button
            aria-label="Log out"
            size="compact"
            variant="tertiary"
            className="text-text-inverse hover:bg-brand-navy-800 disabled:text-brand-silver"
            leadingIcon={<SignOut size={18} weight="bold" />}
            disabled={isLoggingOut}
            onClick={handleLogout}
          >
            {isLoggingOut ? "Logging out" : "Logout"}
          </Button>
        </div>
      </div>
    </header>
  );
}
