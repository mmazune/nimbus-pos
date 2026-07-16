import { useMemo } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { getPrimaryRoleLabel, resolveDefaultMembership } from "@/lib/auth/role";

export type CashierWorkspaceContext = {
  userId: string | null;
  displayName: string;
  email: string;
  roleLabel: string;
  jobRole: string;
  branchId: string | null;
  branchName: string;
  organizationId: string | null;
  organizationName: string;
  organizationCount: number;
  branchCount: number;
  requiresContextSelection: boolean;
  workstationLabel: string;
  sessionPlatform: string;
  sessionSource: string;
  sessionId: string | null;
  sessionCreatedAt: string | null;
  sessionLastActivityAt: string | null;
  permissions: string[];
};

export function useCashierContext() {
  const { branchId, branchName, displayName, organizationId, user } = useAuth();

  return useMemo<CashierWorkspaceContext>(() => {
    const membership = resolveDefaultMembership(user);
    const primaryRole = user?.roles[0];

    return {
      userId: user?.id || null,
      displayName: displayName || "Cashier",
      email: user?.email || "Email unavailable",
      roleLabel: getPrimaryRoleLabel(user),
      jobRole: primaryRole?.jobRole || membership?.jobRole || "Role unavailable",
      branchId: branchId || membership?.branchId || null,
      branchName: branchName || membership?.branchName || "Branch context unavailable",
      organizationId: organizationId || membership?.organizationId || null,
      organizationName: membership?.organizationName || "Organization unavailable",
      organizationCount: user?.context.organizationCount || 0,
      branchCount: user?.context.branchCount || 0,
      requiresContextSelection: user?.context.requiresContextSelection || false,
      workstationLabel: "Cashier terminal",
      sessionPlatform: user?.session?.platform || "Session check pending",
      sessionSource: user?.session?.source || "Session check pending",
      sessionId: user?.session?.id || null,
      sessionCreatedAt: user?.session?.createdAt || null,
      sessionLastActivityAt: user?.session?.lastActivityAt || null,
      permissions: user?.permissions || [],
    };
  }, [branchId, branchName, displayName, organizationId, user]);
}
