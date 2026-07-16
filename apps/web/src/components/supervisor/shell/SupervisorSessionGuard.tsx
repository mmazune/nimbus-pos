import { ArrowLeft } from "@phosphor-icons/react";
import { useRouter } from "next/router";
import { ReactNode, useEffect } from "react";

import { Button, LoadingState } from "@/components/ui";
import { SupervisorBlockedState } from "@/components/supervisor/states";
import { useAuth } from "@/lib/auth/AuthProvider";

type SupervisorSessionGuardProps = {
  children: ReactNode;
};

export function SupervisorSessionGuard({ children }: SupervisorSessionGuardProps) {
  const router = useRouter();
  const {
    accessToken,
    branchId,
    clearSession,
    isAuthenticated,
    isLoading,
    isSupervisor,
    organizationId,
  } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken || !isAuthenticated) {
      void router.replace("/login?reason=session_required");
    }
  }, [accessToken, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <LoadingState title="Restoring supervisor session" />
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

  if (!isSupervisor) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <SupervisorBlockedState
          title="Supervisor access required."
          description="This route requires the SUPERVISOR role from the authenticated /api/auth/me context."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={18} weight="bold" />}
              onClick={() => {
                clearSession();
                void router.replace("/login?reason=supervisor_only");
              }}
            >
              Return to login
            </Button>
          }
        />
      </main>
    );
  }

  if (!branchId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <SupervisorBlockedState
          title="Branch context unavailable."
          description="The supervisor workspace needs a default branch from /api/auth/me before operational routes can load."
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
        <SupervisorBlockedState
          title="Organization context unavailable."
          description="The supervisor workspace needs an organization context from /api/auth/me before operational routes can load."
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
