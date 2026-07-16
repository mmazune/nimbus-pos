import { ArrowLeft } from "@phosphor-icons/react";
import { useRouter } from "next/router";
import { ReactNode, useEffect } from "react";

import { BlockedState, Button, LoadingState } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";

type CashierSessionGuardProps = {
  children: ReactNode;
};

export function CashierSessionGuard({ children }: CashierSessionGuardProps) {
  const router = useRouter();
  const { accessToken, branchId, clearSession, isAuthenticated, isCashier, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken || !isAuthenticated) {
      void router.replace("/login?reason=session_required");
    }
  }, [accessToken, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen min-w-[1280px] items-center justify-center bg-page p-8">
        <LoadingState title="Restoring cashier session" />
      </main>
    );
  }

  if (!accessToken || !isAuthenticated) {
    return (
      <main className="flex min-h-screen min-w-[1280px] items-center justify-center bg-page p-8">
        <LoadingState title="Returning to login" />
      </main>
    );
  }

  if (!isCashier) {
    return (
      <main className="flex min-h-screen min-w-[1280px] items-center justify-center bg-page p-8">
        <BlockedState
          title="Cashier access required."
          description="This route requires a cashier role from the authenticated session context."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={18} weight="bold" />}
              onClick={() => {
                clearSession();
                void router.replace("/login?reason=cashier_only");
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
      <main className="flex min-h-screen min-w-[1280px] items-center justify-center bg-page p-8">
        <BlockedState
          title="Branch context unavailable."
          description="The cashier workspace needs a default branch from /api/auth/me before shift and till reads can run."
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
