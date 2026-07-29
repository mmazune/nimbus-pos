import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  CapabilityNotice,
  CompactUnavailableState,
  OperationalStatusBadge,
  ProfileMetaGrid,
  ProfileSection,
  RoleProfileHero,
  SessionCard,
} from "@/components/profile";
import { SupervisorLeaveRequestForm } from "@/components/supervisor/me/SupervisorLeaveRequestForm";
import { Button, PageShell, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSupervisorContext, useSupervisorReadiness } from "@/lib/supervisor/context";
import {
  createSupervisorLeaveRequest,
  fetchSupervisorAttendance,
  fetchSupervisorLeaveRequests,
  fetchSupervisorShiftSwaps,
  getSupervisorPunchState,
  normalizeSupervisorAttendanceRecord,
  normalizeSupervisorLeaveRequest,
  normalizeSupervisorShiftSwap,
  punchSupervisorClock,
  resolveSupervisorEmployeeIdentity,
  type SupervisorCreateLeavePayload,
} from "@/lib/supervisor/workforce";

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return "Could not reach Nimbus. Check the connection and try again.";
    if (error.isAuthError) return "Your session expired. Sign in again.";
    if (error.isForbidden) return "This workforce action is not available for this account.";
    return error.message || "The request could not be completed.";
  }
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function LoadingRows() {
  return (
    <div className="space-y-3" aria-label="Loading">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function CompactEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md bg-surface-muted px-4 py-5">
      <p className="text-sm font-bold text-text-primary">{title}</p>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  );
}

export function SupervisorMeScreen() {
  const queryClient = useQueryClient();
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor, logout, organizationId, user } = useAuth();
  const context = useSupervisorContext();
  const readiness = useSupervisorReadiness();
  const employeeIdentity = useMemo(() => resolveSupervisorEmployeeIdentity(user), [user]);
  const [punchFeedback, setPunchFeedback] = useState<{ tone: "success" | "danger" | "info"; message: string } | null>(null);
  const [leaveFeedback, setLeaveFeedback] = useState<{ tone: "success" | "danger" | "info"; message: string } | null>(null);
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);
  const [leaveFormResetVersion, setLeaveFormResetVersion] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const baseWorkforceContext = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);
  const canReadWorkforce = Boolean(baseWorkforceContext && employeeIdentity.writeSafe && employeeIdentity.employeeId);
  const canPunch = Boolean(canReadWorkforce && context.permissions.includes("pos:hr:attendance:clock"));
  const leaveCreateDisabledReason = useMemo(() => {
    if (!baseWorkforceContext) return "Supervisor session and branch context are required.";
    if (!organizationId) return "Organization context is unavailable.";
    if (!employeeIdentity.writeSafe || !employeeIdentity.employeeId) return "Employee profile required.";
    if (!context.permissions.includes("pos:hr:leave:create")) return "Leave requests are not enabled for this account.";
    return null;
  }, [baseWorkforceContext, context.permissions, employeeIdentity.employeeId, employeeIdentity.writeSafe, organizationId]);

  const attendanceQuery = useQuery({
    queryKey: ["supervisor", "me", "attendance", branchId],
    enabled: canReadWorkforce,
    queryFn: () => fetchSupervisorAttendance(accessToken as string, branchId as string, { mine: true, take: 10 }),
    retry: 1,
    staleTime: 30_000,
  });
  const leaveQuery = useQuery({
    queryKey: ["supervisor", "me", "leave", branchId],
    enabled: canReadWorkforce,
    queryFn: () => fetchSupervisorLeaveRequests(accessToken as string, branchId as string, { mine: true, take: 10 }),
    retry: 1,
    staleTime: 30_000,
  });
  const shiftSwapsQuery = useQuery({
    queryKey: ["supervisor", "me", "shift-swaps", branchId],
    enabled: canReadWorkforce,
    queryFn: () => fetchSupervisorShiftSwaps(accessToken as string, branchId as string, { mine: true, take: 10 }),
    retry: 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    const errors = [attendanceQuery.error, leaveQuery.error, shiftSwapsQuery.error];
    if (errors.some((error) => error instanceof ApiError && error.isAuthError)) clearSession();
  }, [attendanceQuery.error, clearSession, leaveQuery.error, shiftSwapsQuery.error]);

  const attendanceRecords = useMemo(() => attendanceQuery.data?.data || [], [attendanceQuery.data]);
  const attendance = useMemo(() => attendanceRecords.map(normalizeSupervisorAttendanceRecord), [attendanceRecords]);
  const leaveRequests = useMemo(() => (leaveQuery.data?.data || []).map(normalizeSupervisorLeaveRequest), [leaveQuery.data]);
  const shiftSwaps = useMemo(() => (shiftSwapsQuery.data?.data || []).map(normalizeSupervisorShiftSwap), [shiftSwapsQuery.data]);
  const punchState = useMemo(() => getSupervisorPunchState(attendanceRecords), [attendanceRecords]);

  const punchMutation = useMutation({
    mutationFn: () => punchSupervisorClock(accessToken as string, branchId as string, { employeeId: employeeIdentity.employeeId as string }),
    onSuccess: (record) => {
      setPunchFeedback({ tone: "success", message: record.clockOutAt ? "Clock-out recorded." : "Clock-in recorded." });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "attendance", branchId] });
    },
    onError: (error) => setPunchFeedback({ tone: "danger", message: friendlyError(error) }),
  });
  const leaveMutation = useMutation({
    mutationFn: (payload: SupervisorCreateLeavePayload) => createSupervisorLeaveRequest(accessToken as string, branchId as string, payload),
    onSuccess: () => {
      setLeaveFeedback({ tone: "success", message: "Leave request submitted for review." });
      setLeaveFormOpen(false);
      setLeaveFormResetVersion((version) => version + 1);
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "leave", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "approvals", "leave", branchId] });
    },
    onError: (error) => setLeaveFeedback({ tone: "danger", message: friendlyError(error) }),
  });

  function refreshWorkforce() {
    if (!canReadWorkforce) return;
    void queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "attendance", branchId] });
    void queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "leave", branchId] });
    void queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "shift-swaps", branchId] });
    void queryClient.invalidateQueries({ queryKey: ["supervisor", "active-shift", branchId] });
  }

  function handlePunch() {
    if (!canPunch || punchMutation.isPending) return;
    const confirmed = typeof window === "undefined" || window.confirm(`${punchState.nextActionLabel} for ${employeeIdentity.label} at ${context.branchName}?`);
    if (!confirmed) {
      setPunchFeedback({ tone: "info", message: "Attendance action cancelled." });
      return;
    }
    setPunchFeedback(null);
    punchMutation.mutate();
  }

  function handleLeaveSubmit(payload: SupervisorCreateLeavePayload) {
    if (leaveCreateDisabledReason || leaveMutation.isPending) return;
    setLeaveFeedback(null);
    leaveMutation.mutate(payload);
  }

  async function handleLogout() {
    setIsSigningOut(true);
    await logout();
    if (typeof window !== "undefined") window.location.replace("/login?reason=logged_out");
  }

  const heroStatus = readiness.shift.status === "failed"
    ? { label: "Shift issue", detail: readiness.shift.detail, tone: "danger" as const }
    : readiness.shift.status === "active"
      ? { label: "On shift", detail: readiness.shift.detail, tone: "success" as const }
      : readiness.shift.status === "loading"
        ? { label: "Checking shift", detail: readiness.shift.detail, tone: "info" as const }
        : { label: "Off shift", detail: readiness.shift.detail, tone: "neutral" as const };

  return (
    <PageShell
      title="Me"
      subtitle="Your supervisor profile and workforce self-service."
      className="mx-auto w-full max-w-[1480px]"
      actions={<Button className="min-h-11" variant="tertiary" disabled={!canReadWorkforce} onClick={refreshWorkforce}>Refresh</Button>}
    >
      <RoleProfileHero
        role="supervisor"
        displayName={context.displayName}
        roleLabel={context.roleLabel}
        email={context.email}
        branchName={context.branchName}
        operationalLabel={heroStatus.label}
        operationalDetail={heroStatus.detail}
        operationalTone={heroStatus.tone}
        secondaryStatus={employeeIdentity.writeSafe ? "Employee profile linked" : "Employee profile not linked"}
      />

      {!employeeIdentity.writeSafe ? (
        <CapabilityNotice unavailableFeatures="Attendance actions, leave requests, and employee-linked shift-swap details are unavailable." />
      ) : null}
      {punchFeedback ? <StatusMessage tone={punchFeedback.tone} title={punchFeedback.message} /> : null}
      {leaveFeedback ? <StatusMessage tone={leaveFeedback.tone} title={leaveFeedback.message} /> : null}

      <ProfileSection
        id="supervisor-attendance"
        title="Attendance"
        description={canPunch ? punchState.detail : "Recent attendance for your linked employee profile."}
        action={canPunch ? (
          <Button className="min-h-11" disabled={punchMutation.isPending} onClick={handlePunch}>
            {punchMutation.isPending ? "Recording" : punchState.nextActionLabel}
          </Button>
        ) : undefined}
      >
        {!employeeIdentity.writeSafe ? (
          <CompactUnavailableState title="Attendance unavailable" description="Link an employee profile to view history or record attendance." />
        ) : !context.permissions.includes("pos:hr:attendance:clock") ? (
          <CompactUnavailableState title="Attendance action unavailable" description="Attendance clock permission is not enabled for this account." />
        ) : attendanceQuery.isLoading ? <LoadingRows /> : attendanceQuery.isError ? <StatusMessage tone="danger" title={friendlyError(attendanceQuery.error)} /> : attendance.length ? (
          <div className="divide-y divide-border-subtle">
            {attendance.map((record) => (
              <article key={record.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)_150px_auto] md:items-center">
                <div><p className="text-sm font-bold text-text-primary">{record.dateLabel}</p><p className="mt-1 text-xs text-text-muted">{record.durationLabel}</p></div>
                <p className="text-sm text-text-secondary"><span className="font-semibold tabular-nums text-text-primary">{record.clockInLabel}</span><span className="mx-2">to</span><span className="font-semibold tabular-nums text-text-primary">{record.clockOutLabel}</span></p>
                <p className="text-sm text-text-secondary">{record.lateMinutesLabel}</p>
                <OperationalStatusBadge label={record.statusLabel} tone={record.statusTone} />
              </article>
            ))}
          </div>
        ) : <CompactEmpty title="No attendance yet" description="Clock activity will appear here once it is recorded." />}
      </ProfileSection>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ProfileSection
          id="supervisor-leave"
          title="Leave"
          description="Your current and recent leave requests."
          action={!leaveCreateDisabledReason ? (
            <Button className="min-h-11" variant={leaveFormOpen ? "tertiary" : "secondary"} onClick={() => setLeaveFormOpen((open) => !open)}>
              {leaveFormOpen ? "Close form" : "Request leave"}
            </Button>
          ) : undefined}
        >
          {!employeeIdentity.writeSafe ? (
            <CompactUnavailableState title="Leave unavailable" description="Link an employee profile to view or request leave." />
          ) : leaveCreateDisabledReason ? (
            <CompactUnavailableState title="Leave requests unavailable" description={leaveCreateDisabledReason} />
          ) : (
            <>
              {leaveFormOpen ? <SupervisorLeaveRequestForm employeeId={employeeIdentity.employeeId} disabledReason={null} isSubmitting={leaveMutation.isPending} resetVersion={leaveFormResetVersion} onSubmit={handleLeaveSubmit} /> : null}
              <div className={leaveFormOpen ? "mt-5" : undefined}>
                {leaveQuery.isLoading ? <LoadingRows /> : leaveQuery.isError ? <StatusMessage tone="danger" title={friendlyError(leaveQuery.error)} /> : leaveRequests.length ? (
                  <div className="divide-y divide-border-subtle">
                    {leaveRequests.map((request) => (
                      <article key={request.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0"><p className="text-sm font-bold text-text-primary">{request.typeLabel}</p><p className="mt-1 text-xs text-text-muted">{request.dateRangeLabel}</p><p className="mt-2 truncate text-sm text-text-secondary">{request.reasonLabel}</p></div>
                        <OperationalStatusBadge label={request.statusLabel} tone={request.statusTone} />
                      </article>
                    ))}
                  </div>
                ) : <CompactEmpty title="No leave requests" description="Submitted requests will appear here." />}
              </div>
            </>
          )}
        </ProfileSection>

        <ProfileSection id="supervisor-swaps" title="Shift swaps" description="Incoming and outgoing requests linked to your employee profile." action={<OperationalStatusBadge label="Self-service history" tone="neutral" />}>
          {!employeeIdentity.writeSafe ? (
            <CompactUnavailableState title="Shift swaps unavailable" description="Link an employee profile to view shift-swap history." />
          ) : (
            <>
              <CompactUnavailableState title="New swap requests are unavailable" description="A safe eligible-shift and target selector is not available for supervisor self-service." />
              <div className="mt-4">
                {shiftSwapsQuery.isLoading ? <LoadingRows /> : shiftSwapsQuery.isError ? <StatusMessage tone="danger" title={friendlyError(shiftSwapsQuery.error)} /> : shiftSwaps.length ? (
                  <div className="space-y-3">
                    {shiftSwaps.map((swap) => {
                      const direction = swap.targetEmployeeId === employeeIdentity.employeeId ? "Incoming" : swap.requesterEmployeeId === employeeIdentity.employeeId ? "Outgoing" : "Request";
                      return (
                        <article key={swap.id} className="rounded-md bg-surface-muted p-4">
                          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{direction}</p><p className="mt-1 text-sm font-bold text-text-primary">{swap.shiftDateLabel}</p></div><OperationalStatusBadge label={swap.statusLabel} tone={swap.statusTone} /></div>
                          <p className="mt-3 text-sm text-text-secondary">{swap.requesterLabel} to {swap.targetLabel}</p><p className="mt-2 text-sm leading-6 text-text-secondary">{swap.reasonLabel}</p>
                        </article>
                      );
                    })}
                  </div>
                ) : <CompactEmpty title="No shift swap requests" description="Incoming and outgoing requests will appear here." />}
              </div>
            </>
          )}
        </ProfileSection>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ProfileSection id="supervisor-context" title="Branch and account context" description="Verified context for this supervisor account.">
          <ProfileMetaGrid items={[
            { label: "Organization", value: context.organizationName },
            { label: "Branch", value: context.branchName },
            { label: "Role", value: context.roleLabel },
            { label: "Account", value: context.email },
            { label: "Membership", value: context.membershipStatus },
            { label: "Employee profile", value: employeeIdentity.writeSafe ? "Linked" : "Not linked" },
          ]} />
        </ProfileSection>
        <SessionCard
          accountLabel={context.email}
          branchName={context.branchName}
          platform={context.sessionPlatform}
          source={context.sessionSource}
          createdAt={context.sessionCreatedAt}
          lastActivityAt={context.sessionLastActivityAt}
          idleMessage="Sign out before leaving this shared supervisor terminal. Operational shift state is not changed by signing out."
          isSigningOut={isSigningOut}
          onSignOut={() => void handleLogout()}
        />
      </div>
    </PageShell>
  );
}
