import { Clock, MapPin, SignOut, Storefront } from "@phosphor-icons/react";
import { useRouter } from "next/router";
import { useState } from "react";

import { Button } from "@/components/ui";
import { CurrentTime } from "@/components/waiter/shell/CurrentTime";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getPrimaryRoleLabel } from "@/lib/auth/role";

export function WaiterHeader() {
  const router = useRouter();
  const { branchName, displayName, logout, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const roleLabel = getPrimaryRoleLabel(user);

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
      <div className="mx-auto flex h-20 min-w-[1280px] max-w-[1600px] items-center justify-between px-8">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-white text-brand-navy-900 shadow-subtle">
            <Storefront size={24} weight="duotone" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-brand-silver">Nimbus POS</p>
            <div className="mt-1 flex items-center gap-2 text-base font-semibold">
              <MapPin size={18} weight="bold" />
              <span>{branchName || "Branch context unavailable"}</span>
              <span className="text-brand-silver">/ Service area pending</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-10 items-center gap-2 rounded-md bg-brand-navy-800 px-3 text-sm font-semibold">
            <Clock size={18} weight="bold" />
            <CurrentTime />
          </div>
          <div className="min-w-40 text-right">
            <p className="text-sm font-semibold">{displayName}</p>
            <p className="text-xs font-medium text-brand-silver">{roleLabel}</p>
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
