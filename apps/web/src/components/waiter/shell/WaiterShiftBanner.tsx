import { WarningCircle } from "@phosphor-icons/react";
import { useEffect } from "react";

import { Badge, Skeleton } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { normalizeShift } from "@/lib/waiter/me-model";
import { useActiveShift } from "@/lib/waiter/useActiveShift";

export function WaiterShiftBanner() {
  const { clearSession, user } = useAuth();
  const { data, error, isError, isLoading } = useActiveShift();

  useEffect(() => {
    if (error instanceof ApiError && error.isAuthError) {
      clearSession();
    }
  }, [clearSession, error]);

  if (isLoading) {
    return (
      <div className="h-11 border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center px-4 sm:px-6 lg:px-8">
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
      <div className="h-11 border-b border-status-danger bg-status-danger-surface">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center gap-2 px-4 text-sm font-semibold text-status-danger sm:px-6 lg:px-8">
          <WarningCircle size={18} weight="bold" />
          <span>{message}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-11 border-b border-status-warning bg-status-warning-surface">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between px-4 text-sm font-semibold text-status-warning sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <WarningCircle size={18} weight="bold" />
            <span>Off shift. Service actions are unavailable.</span>
          </div>
          <Badge variant="warning">Off shift</Badge>
        </div>
      </div>
    );
  }

  const shift = normalizeShift(data, user?.permissions || []);

  if (shift.statusLabel === "Shift issue") {
    return (
      <div className="h-11 border-b border-status-warning bg-status-warning-surface">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between px-4 text-sm font-semibold text-status-warning sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <WarningCircle className="shrink-0" size={18} weight="bold" />
            <span className="truncate">Shift review needed. Open Me for details.</span>
          </div>
          <Badge variant="warning">Shift issue</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="h-11 border-b border-status-success bg-status-success-surface">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between px-4 text-sm font-semibold text-status-success sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span>
            On shift{data.shiftNumber ? ` · ${data.shiftNumber}` : ""}
          </span>
        </div>
        <Badge variant="success">On shift</Badge>
      </div>
    </div>
  );
}
