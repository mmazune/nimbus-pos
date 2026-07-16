import {
  ArrowsLeftRight,
  CalendarCheck,
  CalendarPlus,
  Clock,
  ClockClockwise,
  IdentificationBadge,
  PlayCircle,
  SignOut,
  StopCircle,
  Storefront,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { FormEvent, ReactNode, useMemo, useState } from "react";

import { Badge, Button, Card, Input, PageShell, Skeleton, StatusMessage } from "@/components/ui";
import { CurrentTime } from "@/components/waiter/shell/CurrentTime";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { ActiveShiftResponse } from "@/lib/auth/types";
import { cn } from "@/lib/utils/cn";
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
  type WaiterSelfServiceCapabilityViewModel,
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
    if (error.code === "NETWORK_ERROR") {
      return "Could not reach the API. Confirm the backend is running at the configured API URL.";
    }
    if (error.code === "SHIFT_NOT_OPEN") return "Shift not started: service actions are disabled.";
    if (error.code === "UNAUTHORIZED") return "Your session expired. Log in again.";
    if (error.code === "FORBIDDEN") return "This action is not available for waiter role.";
    if (error.status === 409 && /active shift|already/i.test(error.message)) {
      return "A shift is already open for this branch.";
    }
    if (error.status === 409 && /clocked out/i.test(error.message)) {
      return "Attendance is already clocked out for today.";
    }
    if (error.status === 400) return error.message || "Check the form details and try again.";
    return error.message;
  }

  return error instanceof Error ? error.message : "Action failed. Try again.";
}

function capabilityStatus(
  capability: WaiterSelfServiceCapabilityViewModel,
  key: keyof WaiterSelfServiceCapabilityViewModel,
) {
  return capability[key] ? "Enabled" : "Read-only";
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function SectionCard({
  children,
  icon,
  title,
  action,
  className,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-brand-navy-900">
            {icon}
          </span>
          <h2 className="text-lg font-bold tracking-normal text-text-primary">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function MetaTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">{label}</p>
      <div className="mt-1 text-sm font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function CompactEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md bg-surface-muted p-4">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}

function SelfServiceError({ error }: { error: unknown }) {
  return (
    <StatusMessage tone="danger" title="Could not load this section.">
      {friendlyError(error)}
    </StatusMessage>
  );
}

function PermissionNote({ reason }: { reason?: string }) {
  if (!reason) return null;

  return (
    <StatusMessage tone="warning" title="This self-service action is not enabled yet.">
      {reason}
    </StatusMessage>
  );
}

function LeaveForm({
  disabledReason,
  employeeId,
  isSubmitting,
  onSubmit,
}: {
  disabledReason?: string;
  employeeId?: string;
  isSubmitting: boolean;
  onSubmit: (payload: CreateLeaveRequestPayload) => void;
}) {
  const [leaveType, setLeaveType] = useState<CreateLeaveRequestPayload["leaveType"]>("ANNUAL");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId || disabledReason) return;

    onSubmit({
      employeeId,
      leaveType,
      startsAt,
      endsAt,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
  }

  return (
    <form className="mt-5 rounded-md bg-surface-muted p-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-[160px_1fr_1fr] gap-3">
        <label>
          <span className="text-xs font-semibold uppercase tracking-normal text-text-muted">Type</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md bg-surface px-3 text-sm font-semibold text-text-primary shadow-subtle transition-[background-color,box-shadow] duration-150 ease-out disabled:bg-surface-muted disabled:text-text-muted"
            value={leaveType}
            onChange={(event) => setLeaveType(event.target.value as CreateLeaveRequestPayload["leaveType"])}
            disabled={Boolean(disabledReason) || isSubmitting}
          >
            {LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {titleCase(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-normal text-text-muted">Start</span>
          <Input
            className="mt-2 text-sm"
            type="date"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            disabled={Boolean(disabledReason) || isSubmitting}
            required
          />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-normal text-text-muted">End</span>
          <Input
            className="mt-2 text-sm"
            type="date"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            disabled={Boolean(disabledReason) || isSubmitting}
            required
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-semibold uppercase tracking-normal text-text-muted">Reason</span>
        <textarea
          className="mt-2 min-h-20 w-full resize-none rounded-md bg-surface px-4 py-3 text-sm text-text-primary shadow-subtle placeholder:text-text-muted transition-[background-color,box-shadow] duration-150 ease-out disabled:bg-surface-muted disabled:text-text-muted"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Short note for the manager."
          disabled={Boolean(disabledReason) || isSubmitting}
          maxLength={1000}
        />
      </label>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          {disabledReason || "Requests stay pending until a manager reviews them."}
        </p>
        <Button
          type="submit"
          size="compact"
          leadingIcon={<CalendarPlus size={18} weight="bold" />}
          disabled={Boolean(disabledReason) || !startsAt || !endsAt || isSubmitting}
        >
          {isSubmitting ? "Sending" : "Request leave"}
        </Button>
      </div>
    </form>
  );
}

export function WaiterMeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, branchName, displayName, logout, user } = useAuth();
  const activeShiftQuery = useActiveShift();
  const [startNotes, setStartNotes] = useState("");
  const [endNotes, setEndNotes] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger" | "info"; message: string } | null>(null);

  const profile = useMemo(
    () => normalizeWaiterMeProfile(user, branchName),
    [branchName, user],
  );
  const shift = useMemo(
    () => normalizeShift(activeShiftQuery.data as ActiveShiftResponse & WaiterShiftApi, profile.permissions),
    [activeShiftQuery.data, profile.permissions],
  );
  const capabilities = useMemo(
    () => normalizeCapabilities({ profile, shift }),
    [profile, shift],
  );

  const attendanceQuery = useQuery({
    queryKey: ["waiter", "me", "attendance", branchId],
    enabled: Boolean(accessToken && branchId),
    queryFn: () => listMyAttendance(accessToken as string, branchId as string, { mine: true, take: 8 }),
    retry: 1,
  });

  const leaveQuery = useQuery({
    queryKey: ["waiter", "me", "leave", branchId],
    enabled: Boolean(accessToken && branchId),
    queryFn: () => listMyLeaveRequests(accessToken as string, branchId as string, { mine: true, take: 8 }),
    retry: 1,
  });

  const swapsQuery = useQuery({
    queryKey: ["waiter", "me", "shift-swaps", branchId],
    enabled: Boolean(accessToken && branchId),
    queryFn: () => listMyShiftSwaps(accessToken as string, branchId as string, { mine: true, take: 8 }),
    retry: 1,
  });

  const attendance = useMemo(
    () => (attendanceQuery.data?.data || []).map(normalizeAttendanceRecord),
    [attendanceQuery.data],
  );
  const leaveRequests = useMemo(
    () => (leaveQuery.data?.data || []).map(normalizeLeaveRequest),
    [leaveQuery.data],
  );
  const shiftSwaps = useMemo(
    () => (swapsQuery.data?.data || []).map(normalizeShiftSwap),
    [swapsQuery.data],
  );

  async function invalidateOperationalQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["waiter", "active-shift", branchId] }),
      queryClient.invalidateQueries({ queryKey: ["waiter", "floor"] }),
      queryClient.invalidateQueries({ queryKey: ["waiter", "orders-queue"] }),
      queryClient.invalidateQueries({ queryKey: ["waiter", "reservations"] }),
    ]);
  }

  const startShiftMutation = useMutation({
    mutationFn: () =>
      startShift(accessToken as string, branchId as string, {
        ...(startNotes.trim() ? { notes: startNotes.trim() } : {}),
      }),
    onSuccess: async () => {
      setStartNotes("");
      setFeedback({ tone: "success", message: "Shift started." });
      await invalidateOperationalQueries();
    },
    onError: (error) => setFeedback({ tone: "danger", message: friendlyError(error) }),
  });

  const endShiftMutation = useMutation({
    mutationFn: () =>
      endShift(accessToken as string, branchId as string, shift.id as string, {
        ...(endNotes.trim() ? { notes: endNotes.trim() } : {}),
      }),
    onSuccess: async () => {
      setEndNotes("");
      setFeedback({ tone: "success", message: "Shift ended." });
      await invalidateOperationalQueries();
    },
    onError: (error) => setFeedback({ tone: "danger", message: friendlyError(error) }),
  });

  const clockMutation = useMutation({
    mutationFn: () =>
      clockAttendance(accessToken as string, branchId as string, {
        employeeId: profile.employeeId as string,
      }),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "Attendance updated." });
      await queryClient.invalidateQueries({ queryKey: ["waiter", "me", "attendance", branchId] });
    },
    onError: (error) => setFeedback({ tone: "danger", message: friendlyError(error) }),
  });

  const leaveMutation = useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) =>
      createLeaveRequest(accessToken as string, branchId as string, payload),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "Leave request submitted." });
      await queryClient.invalidateQueries({ queryKey: ["waiter", "me", "leave", branchId] });
    },
    onError: (error) => setFeedback({ tone: "danger", message: friendlyError(error) }),
  });

  async function handleLogout() {
    setFeedback({ tone: "info", message: "Logging out." });
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
      return;
    }
    void router.replace("/login?reason=logged_out");
  }

  return (
    <PageShell
      title="Me"
      subtitle="Profile, shift controls, and waiter self-service."
      actions={<Badge variant={shift.status === "OPEN" ? "success" : "warning"}>{shift.status === "OPEN" ? "Shift open" : "Read-only"}</Badge>}
    >
      {feedback ? (
        <StatusMessage tone={feedback.tone} title={feedback.message} />
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_392px] gap-6">
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-w-0 items-center gap-5 p-6">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-brand-navy-900 text-2xl font-bold tracking-normal text-text-inverse shadow-panel">
                  {profile.avatarInitials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">Waiter profile</p>
                  <h2 className="mt-1 truncate text-2xl font-bold tracking-normal text-text-primary">
                    {profile.displayName}
                  </h2>
                  <p className="mt-1 truncate text-sm text-text-secondary">{profile.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.roleLabels.map((role) => (
                      <Badge key={role} variant="info">
                        {role}
                      </Badge>
                    ))}
                    <Badge variant={profile.employeeId ? "success" : "warning"}>
                      {profile.employeeId ? "Employee linked" : "Employee link missing"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="border-l border-border-subtle bg-surface-muted p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                  <Clock size={18} weight="bold" />
                  <span>Current time</span>
                </div>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-normal text-text-primary">
                  <CurrentTime />
                </p>
                <p className="mt-4 text-sm text-text-secondary">
                  Logged in as {displayName}. Idle timeout remains active in the waiter shell.
                </p>
              </div>
            </div>
          </Card>

          <SectionCard
            title="Shift controls"
            icon={<ClockClockwise size={22} weight="duotone" />}
            action={<Badge variant={shift.status === "OPEN" ? "success" : "warning"}>{shift.shiftNumber}</Badge>}
          >
            {activeShiftQuery.isLoading ? (
              <ListSkeleton />
            ) : activeShiftQuery.isError ? (
              <SelfServiceError error={activeShiftQuery.error} />
            ) : (
              <div className="grid grid-cols-[1fr_300px] gap-5">
                <div className="grid grid-cols-3 gap-3">
                  <MetaTile label="Status" value={titleCase(shift.status)} />
                  <MetaTile label="Started" value={shift.openedLabel} />
                  <MetaTile label="Elapsed" value={<span className="tabular-nums">{shift.elapsedLabel}</span>} />
                  <MetaTile label="Closed" value={shift.closedLabel} />
                  <MetaTile label="Start action" value={capabilityStatus(capabilities, "canStartShift")} />
                  <MetaTile label="End action" value={capabilityStatus(capabilities, "canEndShift")} />
                </div>
                <div className="rounded-md bg-surface-muted p-4">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-normal text-text-muted">
                      Shift note
                    </span>
                    <textarea
                      className="mt-2 min-h-20 w-full resize-none rounded-md bg-surface px-3 py-2 text-sm text-text-primary shadow-subtle placeholder:text-text-muted transition-[background-color,box-shadow] duration-150 ease-out disabled:bg-surface-muted disabled:text-text-muted"
                      value={shift.status === "OPEN" ? endNotes : startNotes}
                      onChange={(event) =>
                        shift.status === "OPEN" ? setEndNotes(event.target.value) : setStartNotes(event.target.value)
                      }
                      placeholder="Optional shift note."
                      maxLength={500}
                      disabled={startShiftMutation.isPending || endShiftMutation.isPending}
                    />
                  </label>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Button
                      leadingIcon={<PlayCircle size={19} weight="bold" />}
                      disabled={!capabilities.canStartShift || !accessToken || !branchId || startShiftMutation.isPending}
                      onClick={() => startShiftMutation.mutate()}
                    >
                      {startShiftMutation.isPending ? "Starting" : "Start"}
                    </Button>
                    <Button
                      variant="secondary"
                      leadingIcon={<StopCircle size={19} weight="bold" />}
                      disabled={!capabilities.canEndShift || !shift.id || !accessToken || !branchId || endShiftMutation.isPending}
                      onClick={() => endShiftMutation.mutate()}
                    >
                      {endShiftMutation.isPending ? "Ending" : "End"}
                    </Button>
                  </div>
                  {shift.blockedReason ? (
                    <p className="mt-3 text-sm text-text-secondary">{shift.blockedReason}</p>
                  ) : null}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Attendance"
            icon={<CalendarCheck size={22} weight="duotone" />}
            action={
              <Button
                size="compact"
                variant="secondary"
                leadingIcon={<ClockClockwise size={18} weight="bold" />}
                disabled={!capabilities.canClockAttendance || clockMutation.isPending}
                onClick={() => clockMutation.mutate()}
              >
                {clockMutation.isPending ? "Updating" : "Clock in/out"}
              </Button>
            }
          >
            <PermissionNote reason={capabilities.attendanceReadOnlyReason} />
            <div className="mt-4">
              {attendanceQuery.isLoading ? (
                <ListSkeleton />
              ) : attendanceQuery.isError ? (
                <SelfServiceError error={attendanceQuery.error} />
              ) : attendance.length ? (
                <div className="space-y-3">
                  {attendance.map((record) => (
                    <div
                      key={record.id}
                      className="grid min-h-16 grid-cols-[150px_1fr_120px_120px] items-center gap-4 rounded-md bg-surface-muted px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-text-primary">{record.dateLabel}</p>
                        <p className="text-xs text-text-muted">{record.durationLabel}</p>
                      </div>
                      <div className="text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">{record.clockInLabel}</span>
                        <span className="mx-2 text-text-muted">to</span>
                        <span className="font-semibold text-text-primary">{record.clockOutLabel}</span>
                      </div>
                      <Badge variant={record.statusTone}>{record.statusLabel}</Badge>
                      <p className="truncate text-right text-sm text-text-secondary">
                        {record.notes || "No note"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <CompactEmpty
                  title="No attendance records returned."
                  description="Self-scope attendance is available, but there are no rows for this waiter yet."
                />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Leave requests" icon={<CalendarPlus size={22} weight="duotone" />}>
            <PermissionNote reason={capabilities.leaveReadOnlyReason} />
            {leaveQuery.isLoading ? (
              <ListSkeleton />
            ) : leaveQuery.isError ? (
              <SelfServiceError error={leaveQuery.error} />
            ) : leaveRequests.length ? (
              <div className="space-y-3">
                {leaveRequests.map((request) => (
                  <div
                    key={request.id}
                    className="grid min-h-16 grid-cols-[170px_1fr_120px] items-center gap-4 rounded-md bg-surface-muted px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-text-primary">{request.typeLabel}</p>
                      <p className="text-xs text-text-muted">{request.dateRangeLabel}</p>
                    </div>
                    <p className="truncate text-sm text-text-secondary">{request.reasonSnippet}</p>
                    <Badge variant={request.statusTone}>{request.statusLabel}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <CompactEmpty
                title="No leave requests."
                description="Self-scope leave is enabled for reads. New requests appear here after submission."
              />
            )}
            <LeaveForm
              employeeId={profile.employeeId}
              disabledReason={capabilities.leaveReadOnlyReason}
              isSubmitting={leaveMutation.isPending}
              onSubmit={(payload) => leaveMutation.mutate(payload)}
            />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Branch context" icon={<Storefront size={22} weight="duotone" />}>
            <div className="space-y-3">
              <MetaTile label="Organization" value={profile.organizationName} />
              <MetaTile label="Branch" value={profile.branchName} />
              <MetaTile label="Service area" value={profile.serviceArea} />
              <MetaTile label="Branch ID" value={<span className="break-all text-xs">{profile.branchId || "Unavailable"}</span>} />
            </div>
          </SectionCard>

          <SectionCard title="Identity" icon={<IdentificationBadge size={22} weight="duotone" />}>
            <div className="space-y-3">
              <MetaTile label="User ID" value={<span className="break-all text-xs">{profile.userId}</span>} />
              <MetaTile label="Employee ID" value={<span className="break-all text-xs">{profile.employeeId || "Not returned"}</span>} />
              {profile.employeeUnavailableReason ? (
                <StatusMessage tone="warning" title="Employee profile gap">
                  {profile.employeeUnavailableReason}
                </StatusMessage>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Shift swaps"
            icon={<ArrowsLeftRight size={22} weight="duotone" />}
            action={<Badge variant="neutral">Self-scope</Badge>}
          >
            <PermissionNote reason={capabilities.shiftSwapReadOnlyReason} />
            <div className="mt-4">
              {swapsQuery.isLoading ? (
                <ListSkeleton />
              ) : swapsQuery.isError ? (
                <SelfServiceError error={swapsQuery.error} />
              ) : shiftSwaps.length ? (
                <div className="space-y-3">
                  {shiftSwaps.map((swap) => (
                    <div key={swap.id} className="rounded-md bg-surface-muted p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-text-primary">{swap.shiftDateLabel}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            Target: {swap.targetLabel}
                          </p>
                        </div>
                        <Badge variant={swap.statusTone}>{swap.statusLabel}</Badge>
                      </div>
                      <p className="mt-3 text-sm text-text-secondary">{swap.reasonSnippet}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <CompactEmpty
                  title="No shift swap requests."
                  description="Self-scope swap reads are enabled. Creating swaps stays disabled until a safe target selector exists."
                />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Session" icon={<UserCircle size={22} weight="duotone" />}>
            <StatusMessage tone="info" title="Idle auto-logout is active.">
              The waiter terminal returns to login after 15 minutes of inactivity.
            </StatusMessage>
            <div className="mt-4 rounded-md bg-surface-muted p-4">
              <div className="flex items-start gap-3">
                <WarningCircle size={22} weight="bold" className="mt-0.5 text-status-warning" />
                <p className="text-sm text-text-secondary">
                  Use logout before leaving a shared terminal. This clears the local session and calls the existing auth logout endpoint.
                </p>
              </div>
              <Button
                className="mt-4 w-full"
                variant="secondary"
                leadingIcon={<SignOut size={18} weight="bold" />}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}
