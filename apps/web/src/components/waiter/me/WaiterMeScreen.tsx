import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { FormEvent, useMemo, useState } from "react";

import {
  CapabilityNotice,
  CompactUnavailableState,
  OperationalStatusBadge,
  ProfileMetaGrid,
  ProfileSection,
  RoleProfileHero,
  SessionCard,
  ShiftStatusCard,
} from "@/components/profile";
import { Button, Input, PageShell, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  clockAttendance,
  createLeaveRequest,
  endShift,
  listMyAttendance,
  listMyLeaveRequests,
  listMyShiftSwaps,
  startShift,
  type CreateLeaveRequestPayload,
  type WaiterShiftApi,
} from "@/lib/waiter/me-api";
import {
  normalizeAttendanceRecord,
  normalizeCapabilities,
  normalizeLeaveRequest,
  normalizeShift,
  normalizeShiftSwap,
  normalizeWaiterMeProfile,
} from "@/lib/waiter/me-model";
import { useActiveShift } from "@/lib/waiter/useActiveShift";

const LEAVE_TYPES: CreateLeaveRequestPayload["leaveType"][] = [
  "ANNUAL",
  "SICK",
  "UNPAID",
  "EMERGENCY",
  "OTHER",
];

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return "Could not reach Nimbus. Check the connection and try again.";
    if (error.code === "SHIFT_NOT_OPEN") return "No open shift was found.";
    if (error.code === "UNAUTHORIZED") return "Your session expired. Sign in again.";
    if (error.code === "FORBIDDEN") return "This action is not available for this account.";
    if (error.status === 409 && /active shift|already/i.test(error.message)) {
      return "A shift is already open for this branch. Refresh the page before trying again.";
    }
    if (error.status === 409 && /clocked out/i.test(error.message)) {
      return "Attendance is already clocked out for today.";
    }
    if (error.status === 400) return error.message || "Check the details and try again.";
    return error.message;
  }

  return error instanceof Error ? error.message : "The action could not be completed.";
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function ListSkeleton() {
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

function SectionError({ error }: { error: unknown }) {
  return <StatusMessage tone="danger" title={friendlyError(error)} />;
}

function LeaveRequestForm({
  employeeId,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  employeeId: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateLeaveRequestPayload) => void;
}) {
  const [leaveType, setLeaveType] = useState<CreateLeaveRequestPayload["leaveType"]>("ANNUAL");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      employeeId,
      leaveType,
      startsAt,
      endsAt,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
  }

  return (
    <form className="rounded-lg bg-surface-muted p-4 sm:p-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          <span className="text-sm font-semibold text-text-primary">Leave type</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md bg-surface px-3 text-sm font-semibold text-text-primary shadow-subtle disabled:text-text-muted"
            value={leaveType}
            onChange={(event) => setLeaveType(event.target.value as CreateLeaveRequestPayload["leaveType"])}
            disabled={isSubmitting}
          >
            {LEAVE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold text-text-primary">Start date</span>
          <Input className="mt-2 text-sm" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} disabled={isSubmitting} required />
        </label>
        <label>
          <span className="text-sm font-semibold text-text-primary">End date</span>
          <Input className="mt-2 text-sm" type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} disabled={isSubmitting} required />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-semibold text-text-primary">Reason <span className="font-normal text-text-muted">(optional)</span></span>
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md bg-surface px-4 py-3 text-sm text-text-primary shadow-subtle placeholder:text-text-muted disabled:text-text-muted"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Add a short note for the manager."
          disabled={isSubmitting}
          maxLength={1000}
        />
      </label>
      <p className="mt-3 text-sm text-text-secondary">The request remains pending until a manager reviews it.</p>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button className="min-h-11" variant="tertiary" disabled={isSubmitting} onClick={onCancel}>Cancel</Button>
        <Button className="min-h-11" type="submit" disabled={!startsAt || !endsAt || isSubmitting}>
          {isSubmitting ? "Submitting" : "Submit request"}
        </Button>
      </div>
    </form>
  );
}

export function WaiterMeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, branchName, logout, user } = useAuth();
  const activeShiftQuery = useActiveShift();
  const [shiftNote, setShiftNote] = useState("");
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger" | "info"; message: string } | null>(null);

  const profile = useMemo(() => normalizeWaiterMeProfile(user, branchName), [branchName, user]);
  const shift = useMemo(
    () => normalizeShift(activeShiftQuery.data as WaiterShiftApi | null | undefined, profile.permissions),
    [activeShiftQuery.data, profile.permissions],
  );
  const capabilities = useMemo(() => normalizeCapabilities({ profile, shift }), [profile, shift]);
  const canReadWorkforce = Boolean(accessToken && branchId && profile.employeeId);

  const attendanceQuery = useQuery({
    queryKey: ["waiter", "me", "attendance", branchId],
    enabled: canReadWorkforce,
    queryFn: () => listMyAttendance(accessToken as string, branchId as string, { mine: true, take: 8 }),
    retry: shouldRetryApiRequest,
    staleTime: 30_000,
  });
  const leaveQuery = useQuery({
    queryKey: ["waiter", "me", "leave", branchId],
    enabled: canReadWorkforce,
    queryFn: () => listMyLeaveRequests(accessToken as string, branchId as string, { mine: true, take: 8 }),
    retry: shouldRetryApiRequest,
    staleTime: 30_000,
  });
  const swapsQuery = useQuery({
    queryKey: ["waiter", "me", "shift-swaps", branchId],
    enabled: canReadWorkforce,
    queryFn: () => listMyShiftSwaps(accessToken as string, branchId as string, { mine: true, take: 8 }),
    retry: shouldRetryApiRequest,
    staleTime: 30_000,
  });

  const attendance = useMemo(() => (attendanceQuery.data?.data || []).map(normalizeAttendanceRecord), [attendanceQuery.data]);
  const leaveRequests = useMemo(() => (leaveQuery.data?.data || []).map(normalizeLeaveRequest), [leaveQuery.data]);
  const shiftSwaps = useMemo(
    () => (swapsQuery.data?.data || []).map((record) => normalizeShiftSwap(record, profile.employeeId)),
    [profile.employeeId, swapsQuery.data],
  );

  function refreshActiveShift() {
    void queryClient.invalidateQueries({ queryKey: ["waiter", "active-shift", branchId] });
  }

  const startShiftMutation = useMutation({
    mutationFn: () => startShift(accessToken as string, branchId as string, shiftNote.trim() ? { notes: shiftNote.trim() } : {}),
    onMutate: () => setFeedback(null),
    onSuccess: () => {
      setShiftNote("");
      setFeedback({ tone: "success", message: "Shift started." });
      refreshActiveShift();
    },
    onError: (error) => setFeedback({ tone: "danger", message: friendlyError(error) }),
  });
  const endShiftMutation = useMutation({
    mutationFn: () => endShift(accessToken as string, branchId as string, shift.id as string, shiftNote.trim() ? { notes: shiftNote.trim() } : {}),
    onMutate: () => setFeedback(null),
    onSuccess: () => {
      setShiftNote("");
      setFeedback({ tone: "success", message: "Shift ended." });
      refreshActiveShift();
    },
    onError: (error) => setFeedback({ tone: "danger", message: friendlyError(error) }),
  });
  const clockMutation = useMutation({
    mutationFn: () => clockAttendance(accessToken as string, branchId as string, { employeeId: profile.employeeId as string }),
    onMutate: () => setFeedback(null),
    onSuccess: () => {
      setFeedback({ tone: "success", message: "Attendance updated." });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "me", "attendance", branchId] });
    },
    onError: (error) => setFeedback({ tone: "danger", message: friendlyError(error) }),
  });
  const leaveMutation = useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) => createLeaveRequest(accessToken as string, branchId as string, payload),
    onMutate: () => setFeedback(null),
    onSuccess: () => {
      setLeaveFormOpen(false);
      setFeedback({ tone: "success", message: "Leave request submitted." });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "me", "leave", branchId] });
    },
    onError: (error) => setFeedback({ tone: "danger", message: friendlyError(error) }),
  });

  async function handleLogout() {
    setIsSigningOut(true);
    setFeedback({ tone: "info", message: "Signing out." });
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
      return;
    }
    void router.replace("/login?reason=logged_out");
  }

  const shiftPending = startShiftMutation.isPending || endShiftMutation.isPending;
  const heroStatus = activeShiftQuery.isError
    ? { label: "Shift issue", detail: friendlyError(activeShiftQuery.error), tone: "danger" as const }
    : activeShiftQuery.isLoading
      ? { label: "Checking shift", detail: "Reading the current branch shift.", tone: "info" as const }
      : { label: shift.statusLabel, detail: shift.operationalWarning || (shift.status === "OPEN" ? `Started ${shift.openedLabel}.` : "No shift is currently open."), tone: shift.statusTone };

  return (
    <PageShell title="Me" subtitle="Your profile, shift, and workforce self-service." className="mx-auto w-full max-w-[1480px]">
      <RoleProfileHero
        role="waiter"
        displayName={profile.displayName}
        roleLabel={profile.roleLabels[0]}
        email={profile.email}
        branchName={profile.branchName}
        serviceArea={profile.serviceArea}
        operationalLabel={heroStatus.label}
        operationalDetail={heroStatus.detail}
        operationalTone={heroStatus.tone}
        secondaryStatus={profile.employeeId ? "Employee profile linked" : "Employee profile not linked"}
      />

      {!profile.employeeId ? (
        <CapabilityNotice unavailableFeatures="Attendance actions, leave requests, and employee-linked shift-swap details are unavailable." />
      ) : null}
      {feedback ? <StatusMessage tone={feedback.tone} title={feedback.message} /> : null}

      {activeShiftQuery.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : activeShiftQuery.isError ? (
        <ProfileSection title="Shift" description="The current shift could not be verified.">
          <SectionError error={activeShiftQuery.error} />
        </ProfileSection>
      ) : (
        <ShiftStatusCard
          statusLabel={shift.statusLabel}
          statusTone={shift.statusTone}
          title={shift.status === "OPEN" ? "Current shift" : "Start your service shift"}
          description={shift.status === "OPEN" ? "Your shift is active for this branch." : "Start a shift before using shift-gated service actions."}
          warning={shift.operationalWarning ? <StatusMessage tone="warning" title="Shift review needed">{shift.operationalWarning}</StatusMessage> : undefined}
          details={
            <ProfileMetaGrid
              className="lg:grid-cols-4"
              items={[
                { label: "Started", value: shift.openedLabel },
                { label: "Elapsed", value: <span className="tabular-nums">{shift.elapsedLabel}</span> },
                { label: "Branch", value: profile.branchName },
                { label: "Shift note", value: shift.notes || "No note recorded" },
              ]}
            />
          }
          controls={
            <div aria-busy={shiftPending}>
              <label htmlFor="waiter-shift-note" className="text-sm font-semibold text-text-primary">Shift note <span className="font-normal text-text-muted">(optional)</span></label>
              <textarea
                id="waiter-shift-note"
                className="mt-2 min-h-24 w-full resize-y rounded-md bg-surface px-4 py-3 text-sm text-text-primary shadow-subtle placeholder:text-text-muted disabled:text-text-muted"
                value={shiftNote}
                onChange={(event) => setShiftNote(event.target.value)}
                placeholder={shift.status === "OPEN" ? "Add a closing note." : "Add a starting note."}
                maxLength={500}
                disabled={shiftPending}
              />
              {shift.status === "OPEN" ? (
                <Button className="mt-4 min-h-12 w-full" disabled={!capabilities.canEndShift || !shift.id || shiftPending} onClick={() => endShiftMutation.mutate()}>
                  {endShiftMutation.isPending ? "Ending shift" : "End shift"}
                </Button>
              ) : (
                <Button className="mt-4 min-h-12 w-full" disabled={!capabilities.canStartShift || shiftPending} onClick={() => startShiftMutation.mutate()}>
                  {startShiftMutation.isPending ? "Starting shift" : "Start shift"}
                </Button>
              )}
              {shift.blockedReason ? <p className="mt-3 text-sm leading-5 text-text-secondary">{shift.blockedReason}</p> : null}
            </div>
          }
        />
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ProfileSection
          id="attendance"
          title="Attendance"
          description="Recent clock activity for your linked employee profile."
          action={capabilities.canClockAttendance ? (
            <Button className="min-h-11" variant="secondary" disabled={clockMutation.isPending} onClick={() => clockMutation.mutate()}>
              {clockMutation.isPending ? "Updating" : "Clock in or out"}
            </Button>
          ) : undefined}
        >
          {!profile.employeeId ? (
            <CompactUnavailableState title="Attendance unavailable" description="Link an employee profile to view history or record attendance." />
          ) : capabilities.attendanceReadOnlyReason ? (
            <CompactUnavailableState title="Attendance action unavailable" description={capabilities.attendanceReadOnlyReason} />
          ) : attendanceQuery.isLoading ? <ListSkeleton /> : attendanceQuery.isError ? <SectionError error={attendanceQuery.error} /> : attendance.length ? (
            <div className="divide-y divide-border-subtle">
              {attendance.map((record) => (
                <article key={record.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[130px_minmax(0,1fr)_auto] sm:items-center">
                  <div><p className="text-sm font-bold text-text-primary">{record.dateLabel}</p><p className="mt-1 text-xs text-text-muted">{record.durationLabel}</p></div>
                  <p className="text-sm text-text-secondary"><span className="font-semibold tabular-nums text-text-primary">{record.clockInLabel}</span><span className="mx-2">to</span><span className="font-semibold tabular-nums text-text-primary">{record.clockOutLabel}</span></p>
                  <OperationalStatusBadge label={record.statusLabel} tone={record.statusTone} />
                </article>
              ))}
            </div>
          ) : <CompactEmpty title="No attendance yet" description="Clock activity will appear here once it is recorded." />}
        </ProfileSection>

        <ProfileSection
          id="leave"
          title="Leave"
          description="Your current and recent leave requests."
          action={capabilities.canCreateLeave ? (
            <Button className="min-h-11" variant={leaveFormOpen ? "tertiary" : "secondary"} onClick={() => setLeaveFormOpen((open) => !open)}>
              {leaveFormOpen ? "Close form" : "Request leave"}
            </Button>
          ) : undefined}
        >
          {!profile.employeeId ? (
            <CompactUnavailableState title="Leave unavailable" description="Link an employee profile to view or request leave." />
          ) : capabilities.leaveReadOnlyReason ? (
            <CompactUnavailableState title="Leave requests unavailable" description={capabilities.leaveReadOnlyReason} />
          ) : (
            <>
              {leaveFormOpen ? <LeaveRequestForm employeeId={profile.employeeId} isSubmitting={leaveMutation.isPending} onCancel={() => setLeaveFormOpen(false)} onSubmit={(payload) => leaveMutation.mutate(payload)} /> : null}
              <div className={leaveFormOpen ? "mt-5" : undefined}>
                {leaveQuery.isLoading ? <ListSkeleton /> : leaveQuery.isError ? <SectionError error={leaveQuery.error} /> : leaveRequests.length ? (
                  <div className="divide-y divide-border-subtle">
                    {leaveRequests.map((request) => (
                      <article key={request.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0"><p className="text-sm font-bold text-text-primary">{request.typeLabel}</p><p className="mt-1 text-xs text-text-muted">{request.dateRangeLabel}</p><p className="mt-2 truncate text-sm text-text-secondary">{request.reasonSnippet}</p></div>
                        <OperationalStatusBadge label={request.statusLabel} tone={request.statusTone} />
                      </article>
                    ))}
                  </div>
                ) : <CompactEmpty title="No leave requests" description="New requests will appear here after submission." />}
              </div>
            </>
          )}
        </ProfileSection>
      </div>

      <ProfileSection id="shift-swaps" title="Shift swaps" description="Incoming and outgoing requests linked to your employee profile." action={<OperationalStatusBadge label="Self-service history" tone="neutral" />}>
        {!profile.employeeId ? (
          <CompactUnavailableState title="Shift swaps unavailable" description="Link an employee profile to view shift-swap history." />
        ) : (
          <>
            <CompactUnavailableState title="New swap requests are unavailable" description="A safe eligible-shift and target selector is not available for waiter self-service." />
            <div className="mt-4">
              {swapsQuery.isLoading ? <ListSkeleton /> : swapsQuery.isError ? <SectionError error={swapsQuery.error} /> : shiftSwaps.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {shiftSwaps.map((swap) => (
                    <article key={swap.id} className="rounded-md bg-surface-muted p-4">
                      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{swap.directionLabel}</p><p className="mt-1 text-sm font-bold text-text-primary">{swap.shiftDateLabel}</p></div><OperationalStatusBadge label={swap.statusLabel} tone={swap.statusTone} /></div>
                      <p className="mt-3 text-sm text-text-secondary">Target: {swap.targetLabel}</p><p className="mt-2 text-sm leading-6 text-text-secondary">{swap.reasonSnippet}</p>
                    </article>
                  ))}
                </div>
              ) : <CompactEmpty title="No shift swap requests" description="Incoming and outgoing requests will appear here when available." />}
            </div>
          </>
        )}
      </ProfileSection>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ProfileSection id="account-context" title="Branch and account context" description="Verified context for this signed-in account.">
          <ProfileMetaGrid items={[
            { label: "Organization", value: profile.organizationName },
            { label: "Branch", value: profile.branchName },
            { label: "Role", value: profile.roleLabels.join(", ") },
            { label: "Account", value: profile.email },
            { label: "Employee profile", value: profile.employeeId ? "Linked" : "Not linked" },
            ...(profile.serviceArea ? [{ label: "Service area", value: profile.serviceArea }] : []),
          ]} />
        </ProfileSection>
        <SessionCard
          accountLabel={profile.email}
          branchName={profile.branchName}
          platform={user?.session?.platform}
          source={user?.session?.source}
          createdAt={user?.session?.createdAt}
          lastActivityAt={user?.session?.lastActivityAt}
          idleMessage="This terminal signs out after 15 minutes of inactivity. Sign out sooner when leaving it unattended."
          isSigningOut={isSigningOut}
          onSignOut={() => void handleLogout()}
        />
      </div>
    </PageShell>
  );
}
