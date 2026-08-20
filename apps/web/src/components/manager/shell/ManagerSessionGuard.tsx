import { ArrowLeft } from "@phosphor-icons/react";
import { useRouter } from "next/router";
import { ReactNode, useEffect } from "react";

import { BlockedState, Button, LoadingState } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";

type ManagerSessionGuardProps = {
  children: ReactNode;
};

/**
 * Manager route guard — modelled on `CashierSessionGuard` / `SupervisorSessionGuard`.
 *
 * Manager-compatible users only; anyone else is returned to
 * `/login?reason=manager_only`. The branch check reads the SELECTED Manager branch
 * (not `useAuth().branchId`), because the Manager workspace is multi-branch.
 */
export function ManagerSessionGuard({ children }: ManagerSessionGuardProps) {
  const router = useRouter();
  const { accessToken, clearSession, isAuthenticated, isLoading, isManager, organizationId } = useAuth();
  const branch = useManagerBranch();

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken || !isAuthenticated) {
      void router.replace("/login?reason=session_required");
    }
  }, [accessToken, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <LoadingState title="Restoring manager session" />
      </main>
    );
  }

  if (!accessToken || !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <LoadingState title="Returning to login" />
      </main>
    );
  }

  if (!isManager) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <BlockedState
          title="Manager access required."
          description="This route requires the MANAGER role from the authenticated /api/auth/me context."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={18} weight="bold" />}
              onClick={() => {
                clearSession();
                void router.replace("/login?reason=manager_only");
              }}
            >
              Return to login
            </Button>
          }
        />
      </main>
    );
  }

  if (!branch.branchId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <BlockedState
          title="Branch context unavailable."
          description="The manager workspace needs at least one active branch membership from /api/auth/me before branch-scoped reads can run."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={18} weight="bold" />}
              onClick={() => {
                clearSession();
                void router.replace("/login?reason=session_required");
              }}
            >
              Return to login
            </Button>
          }
        />
      </main>
    );
  }

  if (!organizationId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <BlockedState
          title="Organization context unavailable."
          description="The manager workspace needs an organization context from /api/auth/me before branch-scoped reads can run."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={18} weight="bold" />}
              onClick={() => {
                clearSession();
                void router.replace("/login?reason=session_required");
              }}
            >
              Return to login
            </Button>
          }
        />
      </main>
    );
  }

  return <>{children}</>;
}
