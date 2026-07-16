import type { AuthMeResponse } from "@/lib/auth/types";

export function hasCashierPermission(user: AuthMeResponse | null, permission: string) {
  return Boolean(user?.permissions.includes(permission));
}

export function requireCashierContext({
  branchId,
  isCashier,
  user,
}: {
  branchId: string | null;
  isCashier: boolean;
  user: AuthMeResponse | null;
}) {
  return {
    canEnter: Boolean(user && isCashier && branchId),
    reason: !user
      ? "Session required."
      : !isCashier
        ? "Cashier role required."
        : !branchId
          ? "Branch context missing."
          : null,
  };
}

