import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { ApiError } from "@/lib/api/client";
import { useStationTerminalLabel } from "@/components/pos-shell/station";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getActiveShiftRequest } from "@/lib/auth/auth-api";
import { getPrimaryRoleLabel, resolveDefaultMembership } from "@/lib/auth/role";
import type { AuthMeResponse, AuthRole } from "@/lib/auth/types";
import type { SupervisorReadinessItem, SupervisorReadinessTone } from "@/lib/supervisor/state";

type SupervisorReadinessStatus = "loading" | "active" | "inactive" | "failed" | "unavailable";

export type SupervisorWorkspaceContext = {
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
  membershipId: string | null;
  membershipStatus: string;
  membershipRoleName: string;
  membershipSummary: string;
  roleNames: string[];
  workstationLabel: string;
  sessionPlatform: string;
  sessionSource: string;
  sessionId: string | null;
  sessionCreatedAt: string | null;
  sessionLastActivityAt: string | null;
  employeeId: string | null;
  employeeLabel: string;
  employeeCode: string | null;
  employeeBranchId: string | null;
  employeeStatus: string | null;
  employeeJobRole: string | null;
  permissions: string[];
};

export type SupervisorReadinessState = {
  status: SupervisorReadinessStatus;
  label: string;
  detail: string;
  tone: SupervisorReadinessTone;
};

export type SupervisorReadinessSnapshot = {
  shift: SupervisorReadinessState;
  items: SupervisorReadinessItem[];
  shiftQuery: ReturnType<typeof useQuery>;
};

function isOpen(value?: string | null) {
  return value?.toUpperCase() === "OPEN";
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

function unavailableState(label: string, detail: string): SupervisorReadinessState {
  return {
    status: "unavailable",
    label,
    detail,
    tone: "neutral",
  };
}

function displayValue(value: string | null | undefined, fallback = "Not available") {
  return value?.trim() || fallback;
}

function supervisorPrimaryRole(user: AuthMeResponse | null): AuthRole | undefined {
  return (
    user?.roles.find((role) => {
      const jobRole = role.jobRole?.toUpperCase();
      const roleName = role.name?.toUpperCase();
      return jobRole === "SUPERVISOR" || roleName === "SUPERVISOR";
    }) || user?.roles[0]
  );
}

function formatMembershipSummary(
  roleName: string | null | undefined,
  branchName: string | null | undefined,
  organizationName: string | null | undefined,
) {
  const parts = [roleName, branchName, organizationName].map((part) => part?.trim()).filter(Boolean);
  return parts.length ? parts.join(" / ") : "Not available";
}

export function useSupervisorContext() {
  const { branchId, branchName, displayName, organizationId, user } = useAuth();
  // Station label, NOT backend data — see components/pos-shell/station.ts.
  const terminalLabel = useStationTerminalLabel();

  return useMemo<SupervisorWorkspaceContext>(() => {
    const membership = resolveDefaultMembership(user);
    const primaryRole = supervisorPrimaryRole(user);
    const resolvedBranchName = branchName || membership?.branchName;
    const resolvedOrganizationName = membership?.organizationName;
    const membershipRoleName = membership?.roleName || primaryRole?.name || primaryRole?.jobRole;

    return {
      userId: user?.id || null,
      displayName: displayName || "Supervisor",
      email: displayValue(user?.email),
      roleLabel: getPrimaryRoleLabel(user),
      jobRole: displayValue(primaryRole?.jobRole || membership?.jobRole, "Role unavailable"),
      branchId: branchId || membership?.branchId || null,
      branchName: resolvedBranchName || "Branch context unavailable",
      organizationId: organizationId || membership?.organizationId || null,
      organizationName: resolvedOrganizationName || "Organization context unavailable",
      organizationCount: user?.context.organizationCount || 0,
      branchCount: user?.context.branchCount || 0,
      requiresContextSelection: user?.context.requiresContextSelection || false,
      membershipId: membership?.id || null,
      membershipStatus: membership?.status || "Not available",
      membershipRoleName: displayValue(membershipRoleName),
      membershipSummary: formatMembershipSummary(
        membershipRoleName,
        resolvedBranchName,
        resolvedOrganizationName,
      ),
      roleNames: user?.roles.map((role) => role.jobRole || role.name).filter(Boolean) || [],
      workstationLabel: terminalLabel,
      sessionPlatform: user?.session?.platform || "Session check pending",
      sessionSource: user?.session?.source || "Session check pending",
      sessionId: user?.session?.id || null,
      sessionCreatedAt: user?.session?.createdAt || null,
      sessionLastActivityAt: user?.session?.lastActivityAt || null,
      employeeId: user?.employee?.id || null,
      employeeLabel:
        user?.employee?.displayName ||
        [user?.employee?.firstName, user?.employee?.lastName].filter(Boolean).join(" ").trim() ||
        user?.employee?.employeeCode ||
        "Employee profile unavailable",
      employeeCode: user?.employee?.employeeCode || null,
      employeeBranchId: user?.employee?.branchId || null,
      employeeStatus: user?.employee?.status || null,
      employeeJobRole: user?.employee?.jobRole || null,
      permissions: user?.permissions || [],
    };
  }, [branchId, branchName, displayName, organizationId, terminalLabel, user]);
}

export function useSupervisorReadiness(): SupervisorReadinessSnapshot {
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor } = useAuth();
  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);

  const shiftQuery = useQuery({
    queryKey: ["supervisor", "active-shift", branchId],
    enabled: canQuery,
    queryFn: () => getActiveShiftRequest(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (shiftQuery.error instanceof ApiError && shiftQuery.error.isAuthError) {
      clearSession();
    }
  }, [clearSession, shiftQuery.error]);

  const shift = useMemo<SupervisorReadinessState>(() => {
    if (!canQuery) {
      if (!isAuthenticated) {
        return unavailableState("Shift check pending", "Session check pending.");
      }
      if (!isSupervisor) {
        return unavailableState("Shift check pending", "Supervisor access required.");
      }
      return unavailableState("Shift check pending", "Branch context unavailable.");
    }

    if (shiftQuery.isLoading) {
      return {
        status: "loading",
        label: "Shift check pending",
        detail: "Reading active shift state.",
        tone: "neutral",
      };
    }

    if (shiftQuery.isError) {
      return {
        status: "failed",
        label: "Shift check failed",
        detail: errorMessage(shiftQuery.error, "Could not read active shift state."),
        tone: "danger",
      };
    }

    if (shiftQuery.data && isOpen(shiftQuery.data.status)) {
      return {
        status: "active",
        label: "Shift active",
        detail: shiftQuery.data.shiftNumber
          ? `Active shift ${shiftQuery.data.shiftNumber}.`
          : "Active shift confirmed.",
        tone: "success",
      };
    }

    return {
      status: "inactive",
      label: "No active shift",
      detail: "Supervisor shift is not active yet.",
      tone: "warning",
    };
  }, [
    canQuery,
    isAuthenticated,
    isSupervisor,
    shiftQuery.data,
    shiftQuery.error,
    shiftQuery.isError,
    shiftQuery.isLoading,
  ]);

  const items = useMemo<SupervisorReadinessItem[]>(
    () => [
      {
        key: "shift",
        label: "Shift",
        value: shift.label,
        tone: shift.tone,
      },
      {
        key: "floor",
        label: "Floor",
        value: "Floor check pending",
        tone: "neutral",
      },
      {
        key: "approvals",
        label: "Approvals",
        value: "Approvals check pending",
        tone: "neutral",
      },
    ],
    [shift.label, shift.tone],
  );

  return {
    shift,
    items,
    shiftQuery,
  };
}
