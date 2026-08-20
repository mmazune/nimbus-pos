import { useRouter } from "next/router";
import { useState } from "react";

import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";

import { BranchContextLabel } from "./BranchContextLabel";
import { CurrentTime } from "./CurrentTime";
import { operationalIcons, operationalIconSizes, operationalIconWeights } from "./role-icons";
import { RoleIdentity } from "./RoleIdentity";
import type { OperationalHeaderContext } from "./types";

export function OperationalHeader({
  branchLabel,
  branchSwitcher,
  contextKind,
  contextLabel,
  displayName,
  initials,
  roleLabel,
}: OperationalHeaderContext) {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const TimeIcon = operationalIcons.time;
  const LogoutIcon = operationalIcons.logout;

  const clock = (
    <div
      className="flex h-8 shrink-0 items-center gap-2 rounded-md bg-brand-navy-800 px-2 text-xs font-semibold sm:px-2.5 sm:text-sm"
      aria-label="Current time"
    >
      <TimeIcon
        className="hidden sm:block"
        size={operationalIconSizes.compactAction}
        weight={operationalIconWeights.default}
        aria-hidden
      />
      <CurrentTime />
    </div>
  );

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();

    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
      return;
    }

    void router.replace("/login?reason=logged_out");
  }

  return (
    <header className="bg-brand-navy-950 text-text-inverse shadow-panel" data-operational-header>
      {/* Density pass 2026-08-20: 5rem -> 4rem tall (64px at the 16px root ceiling). */}
      <div className="mx-auto grid h-16 w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:gap-5 lg:px-6">
        <BranchContextLabel
          branchLabel={branchLabel}
          contextKind={contextKind}
          contextLabel={contextLabel}
        />

        {branchSwitcher ? (
          <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-3">
            {branchSwitcher}
            {clock}
          </div>
        ) : (
          clock
        )}

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <RoleIdentity displayName={displayName} initials={initials} roleLabel={roleLabel} />
          <Button
            aria-label="Log out"
            aria-busy={isLoggingOut}
            size="compact"
            variant="inverse"
            className="min-h-9 shrink-0 px-2 sm:px-2.5"
            leadingIcon={
              <LogoutIcon
                size={operationalIconSizes.compactAction}
                weight={operationalIconWeights.default}
                aria-hidden
              />
            }
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
