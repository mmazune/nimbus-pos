import { useQueries } from "@tanstack/react-query";
import { ReactNode } from "react";

import { OperationalIdleLogoutHandler } from "@/components/pos-shell/OperationalIdleLogoutHandler";
import { TouchLegacyBody, TouchShell } from "@/components/pos-shell/TouchShell";
import { SupervisorSessionGuard } from "@/components/supervisor/shell/SupervisorSessionGuard";
import { shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { approvalKeys, type ApprovalWorkspaceDomain } from "@/lib/supervisor/approvals-contract";
import { fetchNeedsAction } from "@/lib/supervisor/approvals-workspace";

type SupervisorShellProps = {
  children: ReactNode;
  /** The screen is a kit screen that lays itself out; otherwise the old body gutters. */
  bare?: boolean;
};

const DOMAINS: readonly ApprovalWorkspaceDomain[] = ["discount", "leave", "shift-swap", "anomaly"];

/**
 * The waiting count on the Approvals tab (drawing Supervisor-Approvals). The same queries,
 * keys and reader as the Approvals screen, so on that screen they are one read, not two.
 */
function useWaitingApprovals(): number | undefined {
  const { accessToken, branchId } = useAuth();
  const ready = Boolean(accessToken && branchId);
  const qs = useQueries({
    queries: DOMAINS.map((d) => ({
      queryKey: approvalKeys.queue(branchId as string, d, "needs-action"),
      enabled: ready,
      queryFn: () => fetchNeedsAction(d, accessToken as string, branchId as string),
      retry: shouldRetryApiRequest,
      staleTime: 15_000,
      refetchInterval: 60_000,
    })),
  });
  if (!qs.every((q) => q.data)) return undefined;
  return qs.reduce((n, q) => n + (q.data?.items.length ?? 0), 0);
}

function Body({ children, bare }: SupervisorShellProps) {
  const waiting = useWaitingApprovals();
  return (
    <TouchShell role="supervisor" idleHandler={<OperationalIdleLogoutHandler />} counts={waiting ? { approvals: waiting } : undefined}>
      {bare ? children : <TouchLegacyBody>{children}</TouchLegacyBody>}
    </TouchShell>
  );
}

export function SupervisorShell({ children, bare = false }: SupervisorShellProps) {
  return (
    <SupervisorSessionGuard>
      <Body bare={bare}>{children}</Body>
    </SupervisorSessionGuard>
  );
}
