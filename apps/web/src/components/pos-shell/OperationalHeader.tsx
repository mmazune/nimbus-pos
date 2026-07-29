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
      <div className="mx-auto grid h-20 w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:gap-6 lg:px-8">
        <BranchContextLabel
          branchLabel={branchLabel}
          contextKind={contextKind}
          contextLabel={contextLabel}
        />

        <div
          className="flex h-10 shrink-0 items-center gap-2 rounded-md bg-brand-navy-800 px-2.5 text-sm font-semibold sm:px-3 sm:text-base"
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

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <RoleIdentity displayName={displayName} initials={initials} roleLabel={roleLabel} />
          <Button
            aria-label="Log out"
            aria-busy={isLoggingOut}
            size="compact"
            variant="tertiary"
            className="min-h-11 shrink-0 px-2 text-text-inverse hover:bg-brand-navy-800 disabled:text-brand-silver sm:px-3"
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
