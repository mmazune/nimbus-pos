import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import {
  OperationalStatusBadge,
  ProfileMetaGrid,
  ProfileSection,
  RoleProfileHero,
  SessionCard,
  ShiftStatusCard,
} from "@/components/profile";
import { Button, PageShell, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { CashierShiftApi } from "@/lib/cashier/api";
import { useCashierContext } from "@/lib/cashier/context";
import { formatCashierDateTime, formatCashierElapsed } from "@/lib/cashier/formatters";
import { hasCashierPermission } from "@/lib/cashier/permissions";
import { useCashierReadiness } from "@/lib/cashier/readiness";
import { closeCashierShift, openCashierShift } from "@/lib/cashier/shifts";

function shiftActionError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return "Could not reach Nimbus. Check the connection and try again.";
    if (error.code === "SHIFT_NOT_OPEN") return "No open shift was found.";
    if (error.isAuthError) return "Your session expired. Sign in again.";
    if (error.isForbidden) return "This action is not available for this account.";
    if (error.status === 409) {
      return "A shift is already open for this branch. Refresh this page before trying again.";
    }
    if (error.status === 400) return error.message || "Check the details and try again.";
    return error.message;
  }

  return error instanceof Error ? error.message : "The shift action could not be completed.";
}

export function CashierMeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, logout, user } = useAuth();
  const context = useCashierContext();
  const readiness = useCashierReadiness();
  const queryBranchId = branchId;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [shiftNote, setShiftNote] = useState("");
  const [shiftFeedback, setShiftFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null);

  const shift = useMemo(() => (readiness.shiftQuery.data || null) as CashierShiftApi, [readiness.shiftQuery.data]);
  const isShiftOpen = readiness.shift.status === "active";
  const canOpenShift = hasCashierPermission(user, "pos:shift:open");
  const canCloseShift = hasCashierPermission(user, "pos:shift:close");
  const canWriteShift = Boolean(accessToken && branchId);

  function refreshShiftReadiness() {
    void queryClient.invalidateQueries({ queryKey: ["cashier", "active-shift", queryBranchId] });
    void queryClient.invalidateQueries({ queryKey: ["cashier", "active-till", queryBranchId] });
  }

  const openShiftMutation = useMutation({
    mutationFn: () =>
      openCashierShift(
        accessToken as string,
        branchId as string,
        shiftNote.trim() ? { notes: shiftNote.trim() } : {},
      ),
    onMutate: () => setShiftFeedback(null),
    onSuccess: () => {
      setShiftNote("");
      setShiftFeedback({ tone: "success", message: "Shift started." });
      refreshShiftReadiness();
    },
    onError: (error) => setShiftFeedback({ tone: "danger", message: shiftActionError(error) }),
  });

  const closeShiftMutation = useMutation({
    mutationFn: () =>
      closeCashierShift(
        accessToken as string,
        branchId as string,
        shift?.id as string,
        shiftNote.trim() ? { notes: shiftNote.trim() } : {},
      ),
    onMutate: () => setShiftFeedback(null),
    onSuccess: () => {
      setShiftNote("");
      setShiftFeedback({ tone: "success", message: "Shift ended." });
      refreshShiftReadiness();
    },
    onError: (error) => setShiftFeedback({ tone: "danger", message: shiftActionError(error) }),
  });

  const shiftPending = openShiftMutation.isPending || closeShiftMutation.isPending;
  const shiftBlockedReason = !canWriteShift
    ? "Session and branch context are required before shift actions."
    : isShiftOpen
      ? canCloseShift
        ? undefined
        : "Closing a shift is not available for this account."
      : canOpenShift
        ? undefined
        : "Starting a shift is not available for this account.";

  async function handleLogout() {
    setIsSigningOut(true);
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
      return;
    }
    void router.replace("/login?reason=logged_out");
  }

  const readinessFailed = readiness.shift.status === "failed" || readiness.till.status === "failed";
  const heroStatus = readinessFailed
    ? {
        label: "Operational issue",
        detail: readiness.shift.status === "failed" ? readiness.shift.detail : readiness.till.detail,
        tone: "danger" as const,
      }
    : readiness.shift.status === "active" && readiness.till.status === "active"
      ? { label: "Till active", detail: readiness.till.detail, tone: "success" as const }
      : readiness.shift.status === "active"
        ? { label: "Till required", detail: readiness.till.detail, tone: "warning" as const }
        : readiness.till.status === "active"
          ? { label: "Shift required", detail: "A till is active, but checkout remains blocked until the shift is active.", tone: "warning" as const }
          : { label: "Off shift", detail: readiness.shift.detail, tone: "neutral" as const };

  return (
    <PageShell title="Me" subtitle="Your cashier profile, till readiness, and secure session." className="mx-auto w-full max-w-[1420px]">
      <RoleProfileHero
        role="cashier"
        displayName={context.displayName}
        roleLabel={context.roleLabel}
        email={context.email}
        branchName={context.branchName}
        operationalLabel={heroStatus.label}
        operationalDetail={heroStatus.detail}
        operationalTone={heroStatus.tone}
        secondaryStatus={readiness.shift.label}
      />

      {shiftFeedback ? <StatusMessage tone={shiftFeedback.tone} title={shiftFeedback.message} /> : null}

      {readiness.shiftQuery.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : readiness.shift.status === "failed" ? (
        <ProfileSection title="Shift" description="The current shift could not be verified.">
          <StatusMessage tone="danger" title={readiness.shift.detail} />
        </ProfileSection>
      ) : (
        <ShiftStatusCard
          statusLabel={readiness.shift.label}
          statusTone={readiness.shift.tone}
          title={isShiftOpen ? "Current shift" : "Start your cashier shift"}
          description={
            isShiftOpen
              ? "Your shift is active for this branch. Till operations and cash settlement stay available while it is open."
              : "Open a shift before opening a till. Till and cash payment actions stay blocked without one."
          }
          details={
            <ProfileMetaGrid
              className="lg:grid-cols-4"
              items={[
                { label: "Shift", value: shift?.shiftNumber || "No shift open" },
                { label: "Started", value: formatCashierDateTime(shift?.openedAt, "Not started") },
                {
                  label: "Elapsed",
                  value: <span className="tabular-nums">{formatCashierElapsed(shift?.openedAt) || "Not started"}</span>,
                },
                { label: "Shift note", value: shift?.notes || "No note recorded" },
              ]}
            />
          }
          controls={
            <div aria-busy={shiftPending}>
              <label htmlFor="cashier-shift-note" className="text-sm font-semibold text-text-primary">
                Shift note <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <textarea
                id="cashier-shift-note"
                className="mt-2 min-h-24 w-full resize-y rounded-md bg-surface px-4 py-3 text-sm text-text-primary shadow-subtle placeholder:text-text-muted disabled:text-text-muted"
                value={shiftNote}
                onChange={(event) => setShiftNote(event.target.value)}
                placeholder={isShiftOpen ? "Add a closing note." : "Add a starting note."}
                maxLength={500}
                disabled={shiftPending}
              />
              {isShiftOpen ? (
                <Button
                  className="mt-4 min-h-12 w-full"
                  disabled={!canCloseShift || !canWriteShift || !shift?.id || shiftPending}
                  onClick={() => closeShiftMutation.mutate()}
                >
                  {closeShiftMutation.isPending ? "Ending shift" : "End shift"}
                </Button>
              ) : (
                <Button
                  className="mt-4 min-h-12 w-full"
                  disabled={!canOpenShift || !canWriteShift || shiftPending}
                  onClick={() => openShiftMutation.mutate()}
                >
                  {openShiftMutation.isPending ? "Starting shift" : "Start shift"}
                </Button>
              )}
              {shiftBlockedReason ? (
                <p className="mt-3 text-sm leading-5 text-text-secondary">{shiftBlockedReason}</p>
              ) : null}
            </div>
          }
        />
      )}

      <ProfileSection id="cashier-readiness" title="Shift and till" description="Cash checkout requires both an active shift and an active till.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md bg-surface-muted p-5">
            <OperationalStatusBadge label={readiness.shift.label} tone={readiness.shift.tone} />
            <h3 className="mt-4 text-base font-bold text-text-primary">Shift</h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{readiness.shift.detail}</p>
          </div>
          <div className="rounded-md bg-surface-muted p-5">
            <OperationalStatusBadge label={readiness.till.label} tone={readiness.till.tone} />
            <h3 className="mt-4 text-base font-bold text-text-primary">Till</h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{readiness.till.detail}</p>
          </div>
        </div>
      </ProfileSection>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ProfileSection id="cashier-context" title="Branch and account context" description="Verified context for this cashier terminal.">
          <ProfileMetaGrid items={[
            { label: "Organization", value: context.organizationName },
            { label: "Branch", value: context.branchName },
            { label: "Role", value: context.roleLabel },
            { label: "Account", value: context.email },
            { label: "Workstation", value: context.workstationLabel },
            { label: "Branch access", value: context.branchId ? "Ready" : "Unavailable" },
          ]} />
        </ProfileSection>

        <SessionCard
          accountLabel={context.email}
          branchName={context.branchName}
          platform={context.sessionPlatform}
          source={context.sessionSource}
          createdAt={context.sessionCreatedAt}
          lastActivityAt={context.sessionLastActivityAt}
          idleMessage="Sign out before leaving this shared cashier terminal. Active till state is not changed by signing out."
          isSigningOut={isSigningOut}
          onSignOut={() => void handleLogout()}
        />
      </div>

      <ProfileSection id="cashier-boundaries" title="Cashier operating context" description="Role boundaries remain enforced by the existing permissions and checkout workflows.">
        <ProfileMetaGrid items={[
          { label: "Checkout", value: "Cashier workspace" },
          { label: "Cash payments", value: readiness.till.status === "active" ? "Till ready" : "Blocked until till is active" },
          { label: "Provider mode", value: "Manual and reference-based where configured" },
          { label: "Manager functions", value: "Not available in cashier profile" },
        ]} className="lg:grid-cols-4" />
      </ProfileSection>
    </PageShell>
  );
}
