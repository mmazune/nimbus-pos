import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { useStationTerminalLabel } from "@/components/pos-shell/station";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getPrimaryRoleLabel } from "@/lib/auth/role";
import type { AuthMeResponse, AuthRole } from "@/lib/auth/types";
import { getManagerDeviceSummaryRequest, getManagerReportCatalogRequest } from "@/lib/manager/api";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { managerQueryKey, type ManagerReadinessItem } from "@/lib/manager/state";

/**
 * Manager workspace context (M-P1) — modelled on `lib/cashier/context.ts` and
 * `lib/supervisor/context.ts`, with one difference: the branch is the SELECTED
 * branch from `ManagerBranchProvider`, never the fixed `/api/auth/me` default.
 *
 * Every field is derived from data the shell already has (`/api/auth/me`, fetched
 * once by `AuthProvider`) — no extra identity request, so the performance hardening
 * (no duplicate `/api/auth/me`) is preserved.
 */
export type ManagerWorkspaceContext = {
  userId: string | null;
  displayName: string;
  email: string;
  roleLabel: string;
  jobRole: string;
  branchId: string | null;
  branchName: string;
  organizationId: string | null;
  organizationName: string;
  branchCount: number;
  organizationCount: number;
  membershipCount: number;
  sessionId: string | null;
  sessionPlatform: string;
  sessionSource: string;
  sessionCreatedAt: string | null;
  sessionLastActivityAt: string | null;
  employeeCode: string | null;
  employeeLabel: string;
  permissionCount: number;
  workspaceLabel: string;
};

function managerPrimaryRole(user: AuthMeResponse | null): AuthRole | undefined {
  return (
    user?.roles.find((role) => {
      const jobRole = role.jobRole?.toUpperCase();
      const roleName = role.name?.toUpperCase();
      return jobRole === "MANAGER" || roleName === "MANAGER";
    }) || user?.roles[0]
  );
}

function displayValue(value: string | null | undefined, fallback = "Not available") {
  return value?.trim() || fallback;
}

export function useManagerContext(): ManagerWorkspaceContext {
  const { displayName, user } = useAuth();
  const branch = useManagerBranch();
  const terminalLabel = useStationTerminalLabel();

  return useMemo(() => {
    const primaryRole = managerPrimaryRole(user);

    return {
      userId: user?.id || null,
      displayName: displayName || "Manager",
      email: displayValue(user?.email),
      roleLabel: getPrimaryRoleLabel(user),
      jobRole: displayValue(primaryRole?.jobRole || primaryRole?.name, "Role unavailable"),
      branchId: branch.branchId,
      branchName: branch.branchName,
      organizationId: branch.organizationId,
      organizationName: branch.organizationName,
      branchCount: user?.context.branchCount || branch.options.length,
      organizationCount: user?.context.organizationCount || 0,
      membershipCount: branch.options.length,
      sessionId: user?.session?.id || null,
      sessionPlatform: displayValue(user?.session?.platform, "Session platform unavailable"),
      sessionSource: displayValue(user?.session?.source, "Session source unavailable"),
      sessionCreatedAt: user?.session?.createdAt || null,
      sessionLastActivityAt: user?.session?.lastActivityAt || null,
      employeeCode: user?.employee?.employeeCode || null,
      employeeLabel:
        user?.employee?.displayName ||
        [user?.employee?.firstName, user?.employee?.lastName].filter(Boolean).join(" ").trim() ||
        user?.employee?.employeeCode ||
        "Employee profile unavailable",
      permissionCount: user?.permissions?.length || 0,
      // Station label, NOT backend data — see components/pos-shell/station.ts.
      workspaceLabel: terminalLabel,
    };
  }, [branch, displayName, terminalLabel, user]);
}

export type ManagerReadinessSnapshot = {
  items: ManagerReadinessItem[];
  catalogQuery: ReturnType<typeof useQuery>;
  devicesQuery: ReturnType<typeof useQuery>;
};

/**
 * M-P1 readiness strip.
 *
 * Only chips with an M-P0-verified source ship (roadmap M-P1: *"a chip with no
 * verified source is omitted, not faked"*):
 *
 * - **Branch** — from `me.memberships` + the selected branch.
 * - **Reports** — `GET /api/reports/catalog` status distribution.
 * - **Devices** — `GET /api/devices` total for the active branch.
 *
 * DELIBERATELY OMITTED (M-P1 GO condition 3): tills and shifts. `GET /api/tills` and
 * `GET /api/shifts` return 404, and `/tills/active` + `/shifts/active` are
 * operator-scoped — they would show the Manager's OWN row, never the branch's. They
 * return in M-P2 as counts from `/dash/manager.shiftSummary`, nothing more.
 * Pending-approvals is also omitted until M-P2 can filter the partly org-scoped
 * `/api/approvals` list (MP0-05).
 */
export function useManagerReadiness(): ManagerReadinessSnapshot {
  const { accessToken, clearSession, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  const branchId = branch.branchId;
  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isManager);

  const catalogQuery = useQuery({
    queryKey: managerQueryKey("report-catalog", branchId),
    enabled: canQuery,
    queryFn: () => getManagerReportCatalogRequest(accessToken as string, branchId as string),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const devicesQuery = useQuery({
    queryKey: managerQueryKey("device-summary", branchId),
    enabled: canQuery,
    queryFn: () => getManagerDeviceSummaryRequest(accessToken as string, branchId as string),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    const authFailure = [catalogQuery.error, devicesQuery.error].some(
      (error) => error instanceof ApiError && error.isAuthError,
    );
    if (authFailure) clearSession();
  }, [catalogQuery.error, clearSession, devicesQuery.error]);

  const items = useMemo<ManagerReadinessItem[]>(() => {
    const branchItem: ManagerReadinessItem = branch.isReady
      ? { key: "branch", label: "Branch", value: branch.branchName, tone: "success" }
      : { key: "branch", label: "Branch", value: "Select branch", tone: "warning" };

    const reportsItem: ManagerReadinessItem = (() => {
      if (!canQuery) return { key: "reports", label: "Reports", value: "Check pending", tone: "neutral" };
      if (catalogQuery.isLoading) {
        return { key: "reports", label: "Reports", value: "Checking generators", tone: "neutral" };
      }
      if (catalogQuery.isError) {
        return { key: "reports", label: "Reports", value: "Generator check failed", tone: "danger" };
      }
      const entries = catalogQuery.data || [];
      const implemented = entries.filter((entry) => entry.status === "IMPLEMENTED").length;
      if (!entries.length) {
        return { key: "reports", label: "Reports", value: "No generators listed", tone: "warning" };
      }
      return {
        key: "reports",
        label: "Reports",
        value: `${implemented} of ${entries.length} generators ready`,
        tone: implemented > 0 ? "success" : "warning",
      };
    })();

    const devicesItem: ManagerReadinessItem = (() => {
      if (!canQuery) return { key: "devices", label: "Devices", value: "Check pending", tone: "neutral" };
      if (devicesQuery.isLoading) {
        return { key: "devices", label: "Devices", value: "Checking registry", tone: "neutral" };
      }
      if (devicesQuery.isError) {
        return { key: "devices", label: "Devices", value: "Registry check failed", tone: "danger" };
      }
      const total = devicesQuery.data?.total ?? devicesQuery.data?.data?.length ?? 0;
      return {
        key: "devices",
        label: "Devices",
        value: total ? `${total} registered` : "None registered",
        tone: total ? "success" : "warning",
      };
    })();

    return [branchItem, reportsItem, devicesItem];
  }, [
    branch.branchName,
    branch.isReady,
    canQuery,
    catalogQuery.data,
    catalogQuery.isError,
    catalogQuery.isLoading,
    devicesQuery.data,
    devicesQuery.isError,
    devicesQuery.isLoading,
  ]);

  return { items, catalogQuery, devicesQuery };
}
