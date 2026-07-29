import { ArrowLeft } from "@phosphor-icons/react";
import { useRouter } from "next/router";
import { ReactNode, useEffect } from "react";

import { BlockedState, Button, LoadingState } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";

type WaiterSessionGuardProps = {
  children: ReactNode;
};

export function WaiterSessionGuard({ children }: WaiterSessionGuardProps) {
  const router = useRouter();
  const { accessToken, clearSession, isAuthenticated, isLoading, isWaiter } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken || !isAuthenticated) {
      void router.replace("/login?reason=session_required");
    }
  }, [accessToken, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-8">
        <LoadingState title="Restoring waiter session" />
      </main>
    );
  }

  if (!accessToken || !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-8">
        <LoadingState title="Returning to login" />
      </main>
    );
  }

  if (!isWaiter) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-8">
        <BlockedState
          title="Waiter workspace only"
          description="This frontend MVP currently supports waiter workspace only."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={18} weight="bold" />}
              onClick={() => {
                clearSession();
                void router.replace("/login?reason=waiter_only");
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
