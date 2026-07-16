import { ClockClockwise, WarningCircle } from "@phosphor-icons/react";
import { useEffect } from "react";

import { Badge, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useActiveShift } from "@/lib/waiter/useActiveShift";

export function WaiterShiftBanner() {
  const { clearSession } = useAuth();
  const { data, error, isError, isLoading } = useActiveShift();

  useEffect(() => {
    if (error instanceof ApiError && error.isAuthError) {
      clearSession();
    }
  }, [clearSession, error]);

  if (isLoading) {
    return (
      <div className="fixed inset-x-0 top-20 z-30 border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-10 min-w-[1280px] max-w-[1600px] items-center px-8">
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Could not read active shift state.";

    return (
      <div className="fixed inset-x-0 top-20 z-30 border-b border-status-danger bg-status-danger-surface">
        <div className="mx-auto flex h-10 min-w-[1280px] max-w-[1600px] items-center gap-2 px-8 text-sm font-semibold text-status-danger">
          <WarningCircle size={18} weight="bold" />
          <span>{message}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-x-0 top-20 z-30 border-b border-status-warning bg-status-warning-surface">
        <div className="mx-auto flex h-10 min-w-[1280px] max-w-[1600px] items-center justify-between px-8 text-sm font-semibold text-status-warning">
          <div className="flex items-center gap-2">
            <WarningCircle size={18} weight="bold" />
            <span>Shift not started: service actions disabled.</span>
          </div>
          <Badge variant="warning">Read-only foundation</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-20 z-30 border-b border-status-success bg-status-success-surface">
      <div className="mx-auto flex h-10 min-w-[1280px] max-w-[1600px] items-center justify-between px-8 text-sm font-semibold text-status-success">
        <div className="flex items-center gap-2">
          <ClockClockwise size={18} weight="bold" />
          <span>
            Active shift{data.shiftNumber ? ` ${data.shiftNumber}` : ""}: service reads ready.
          </span>
        </div>
        <Badge variant="success">Open</Badge>
      </div>
    </div>
  );
}
