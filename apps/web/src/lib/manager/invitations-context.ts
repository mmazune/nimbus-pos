import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  createManagerInvitation,
  listManagerInvitations,
  resendManagerInvitation,
  revokeManagerInvitation,
} from "@/lib/manager/invitations-api";
import type { ManagerInvitableRole } from "@/lib/manager/invitations-model";
import { managerQueryKey } from "@/lib/manager/state";
import type { ManagerInvitationCreateResult, ManagerInvitationRow } from "@/lib/manager/invitations-types";

/**
 * Manager Invitations — React Query binding (Track B6).
 *
 * The one-time `tempPassword`/`invitationToken` returned from a create mutation
 * live ONLY in the caller's `mutation.data` for the lifetime of this hook —
 * never cached, never part of a query key — same rule `staff-context.ts` follows
 * for the Quick-PIN one-time secret.
 */

function useManagerInvitationsSession() {
  const { accessToken, clearSession, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  return {
    accessToken,
    branchId: branch.branchId,
    clearSession,
    isEnabled: Boolean(accessToken && branch.branchId && isAuthenticated && isManager),
  };
}

function useAuthErrorGuard(clearSession: () => void, errors: readonly unknown[]) {
  const hasAuthError = errors.some((error) => error instanceof ApiError && error.isAuthError);
  useEffect(() => {
    if (hasAuthError) clearSession();
  }, [clearSession, hasAuthError]);
}

export type ManagerInvitationsSnapshot = {
  isEnabled: boolean;
  listQuery: UseQueryResult<ManagerInvitationRow[]>;
  create: (input: { email: string; roleName: ManagerInvitableRole; firstName?: string; lastName?: string }) => void;
  isCreating: boolean;
  createError: unknown;
  createResult: ManagerInvitationCreateResult | null;
  resetCreate: () => void;
  resend: (invitationId: string) => void;
  isResending: boolean;
  resendError: unknown;
  resendId: string | null;
  revoke: (input: { invitationId: string; reason?: string }) => void;
  isRevoking: boolean;
  revokeError: unknown;
  revokeId: string | null;
};

export function useManagerInvitations(): ManagerInvitationsSnapshot {
  const session = useManagerInvitationsSession();
  const queryClient = useQueryClient();
  const key = managerQueryKey("staff-invitations", session.branchId);

  const listQuery = useQuery({
    queryKey: key,
    enabled: session.isEnabled,
    staleTime: 15_000,
    retry: 1,
    queryFn: () => listManagerInvitations(session.accessToken as string, session.branchId as string),
  });

  const createMutation = useMutation({
    mutationFn: (input: { email: string; roleName: ManagerInvitableRole; firstName?: string; lastName?: string }) =>
      createManagerInvitation(session.accessToken as string, session.branchId as string, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) =>
      resendManagerInvitation(session.accessToken as string, session.branchId as string, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (input: { invitationId: string; reason?: string }) =>
      revokeManagerInvitation(session.accessToken as string, session.branchId as string, input.invitationId, input.reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  useAuthErrorGuard(session.clearSession, [
    listQuery.error,
    createMutation.error,
    resendMutation.error,
    revokeMutation.error,
  ]);

  return {
    isEnabled: session.isEnabled,
    listQuery,
    create: (input) => {
      if (!session.isEnabled || createMutation.isPending) return;
      createMutation.mutate(input);
    },
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    createResult: createMutation.data ?? null,
    resetCreate: () => createMutation.reset(),
    resend: (invitationId) => {
      if (!session.isEnabled || resendMutation.isPending) return;
      resendMutation.mutate(invitationId);
    },
    isResending: resendMutation.isPending,
    resendError: resendMutation.error,
    resendId: resendMutation.variables ?? null,
    revoke: (input) => {
      if (!session.isEnabled || revokeMutation.isPending) return;
      revokeMutation.mutate(input);
    },
    isRevoking: revokeMutation.isPending,
    revokeError: revokeMutation.error,
    revokeId: revokeMutation.variables?.invitationId ?? null,
  };
}
