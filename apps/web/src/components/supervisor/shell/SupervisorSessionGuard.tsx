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
          description="Sign in with a supervisor PIN to use it."
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
          title="No branch is set for this account."
          description="Ask a manager to add you to a branch, then sign in again."
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
          title="No business is set for this account."
          description="Ask a manager to add you to the business, then sign in again."
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
