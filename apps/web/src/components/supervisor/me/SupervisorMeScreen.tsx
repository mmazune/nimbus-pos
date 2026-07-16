import {
  ArrowsLeftRight,
  CalendarCheck,
  ClockClockwise,
  IdentificationBadge,
  Info,
  ListChecks,
  Prohibit,
  ShieldCheck,
  SignOut,
  Storefront,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Badge, Button, Card, Skeleton, StatusMessage } from "@/components/ui";
import { SupervisorLeaveRequestForm } from "@/components/supervisor/me/SupervisorLeaveRequestForm";
import { SupervisorCaveatBanner } from "@/components/supervisor/states";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatSessionDate } from "@/lib/supervisor/formatters";
import {
  summarizeSupervisorPermissions,
  supervisorRestrictedSurfaces,
} from "@/lib/supervisor/permissions";
import { supervisorCaveats } from "@/lib/supervisor/state";
import { useSupervisorContext, useSupervisorReadiness } from "@/lib/supervisor/context";
import type { SupervisorReadinessTone } from "@/lib/supervisor/state";
import {
  fetchSupervisorAttendance,
  fetchSupervisorLeaveRequests,
  fetchSupervisorShiftSwaps,
  getSupervisorPunchState,
  normalizeSupervisorAttendanceRecord,
  normalizeSupervisorLeaveRequest,
  normalizeSupervisorShiftSwap,
  punchSupervisorClock,
  createSupervisorLeaveRequest,
  resolveSupervisorEmployeeIdentity,
  type SupervisorAttendanceView,
  type SupervisorCreateLeavePayload,
  type SupervisorLeaveView,
  type SupervisorShiftSwapView,
  type SupervisorStatusTone,
} from "@/lib/supervisor/workforce";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

function valueOrFallback(value: string | number | null | undefined, fallback = "Not available") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function toneToBadgeVariant(tone: SupervisorReadinessTone | SupervisorStatusTone): BadgeVariant {
  return tone;
}

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") {
      return "Could not reach the API. Confirm the backend is running at the configured API URL.";
    }
    if (error.isAuthError) return "Your session expired. Log in again.";
    if (error.isForbidden) return "This workforce route is not available for the current Supervisor session.";
    return error.message || "Request failed.";
  }

  return error instanceof Error ? error.message : "Request failed.";
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number | null | undefined;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-normal text-text-muted">{label}</dt>
      <dd className={cn("mt-1 break-words text-sm font-semibold text-text-primary", valueClassName)}>
        {valueOrFallback(value)}
      </dd>
    </div>
  );
}

function SectionCard({
  action,
  children,
  description,
  icon,
  title,
  className,
}: {
  action?: React.ReactNode;
  children: ReactNode;
  description?: string;
  icon: ReactNode;
  title: string;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 shrink-0 text-brand-navy-900">{icon}</div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-normal text-text-primary">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-4/5" />
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md bg-surface-muted p-4">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  );
}

function ErrorPanel({ error }: { error: unknown }) {
  return (
    <StatusMessage tone="danger" title="Could not load this workforce section.">
      {friendlyError(error)}
    </StatusMessage>
  );
}

function DisabledActionCard({
  buttonLabel,
  reason,
  title,
}: {
  buttonLabel: string;
  reason: string;
  title: string;
}) {
  return (
    <div className="rounded-md bg-surface-muted p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">{reason}</p>
        </div>
        <Button size="compact" variant="secondary" disabled>
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

function AttendanceRows({ rows }: { rows: SupervisorAttendanceView[] }) {
  return (
    <div className="space-y-3">
      {rows.map((record) => (
        <div
          key={record.id}
          className="grid min-h-16 gap-3 rounded-md bg-surface-muted px-4 py-3 md:grid-cols-[150px_minmax(0,1fr)_150px_130px] md:items-center md:gap-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-text-primary">{record.dateLabel}</p>
            <p className="mt-1 truncate text-xs text-text-muted">{record.durationLabel}</p>
          </div>
          <div className="min-w-0 text-sm text-text-secondary">
            <span className="font-semibold tabular-nums text-text-primary">{record.clockInLabel}</span>
            <span className="mx-2 text-text-muted">to</span>
            <span className="font-semibold tabular-nums text-text-primary">{record.clockOutLabel}</span>
            <p className="mt-1 truncate text-xs text-text-muted">{record.notesLabel}</p>
          </div>
          <p className="truncate text-sm text-text-secondary">{record.lateMinutesLabel}</p>
          <Badge variant={record.statusTone}>{record.statusLabel}</Badge>
        </div>
      ))}
    </div>
  );
}

function LeaveRows({ rows }: { rows: SupervisorLeaveView[] }) {
  return (
    <div className="space-y-3">
      {rows.map((request) => (
        <div
          key={request.id}
          className="grid min-h-16 gap-3 rounded-md bg-surface-muted px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)_130px_130px] md:items-center md:gap-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-text-primary">{request.typeLabel}</p>
            <p className="mt-1 truncate text-xs text-text-muted">{request.dateRangeLabel}</p>
          </div>
          <p className="truncate text-sm text-text-secondary">{request.reasonLabel}</p>
          <p className="truncate text-sm text-text-secondary">{request.createdLabel}</p>
          <Badge variant={request.statusTone}>{request.statusLabel}</Badge>
        </div>
      ))}
    </div>
  );
}

function ShiftSwapRows({ rows }: { rows: SupervisorShiftSwapView[] }) {
  return (
    <div className="space-y-3">
      {rows.map((swap) => (
        <div key={swap.id} className="rounded-md bg-surface-muted p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">{swap.shiftDateLabel}</p>
              <p className="mt-1 truncate text-sm text-text-secondary">
                {swap.requesterLabel} to {swap.targetLabel}
              </p>
            </div>
            <Badge variant={swap.statusTone}>{swap.statusLabel}</Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{swap.reasonLabel}</p>
        </div>
      ))}
    </div>
  );
}

export function SupervisorMeScreen() {
  const queryClient = useQueryClient();
  const {
    accessToken,
    branchId,
    clearSession,
    isAuthenticated,
    isSupervisor,
    logout,
    organizationId,
    user,
  } = useAuth();
  const context = useSupervisorContext();
  const readiness = useSupervisorReadiness();
  const [punchFeedback, setPunchFeedback] = useState<{
    tone: "success" | "danger" | "info";
    message: string;
  } | null>(null);
  const [leaveFeedback, setLeaveFeedback] = useState<{
    tone: "success" | "danger" | "info";
    message: string;
  } | null>(null);
  const [leaveFormResetVersion, setLeaveFormResetVersion] = useState(0);
  const employeeIdentity = useMemo(() => resolveSupervisorEmployeeIdentity(user), [user]);
  const canReadWorkforce = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);
  const canPunch = Boolean(
    canReadWorkforce &&
      employeeIdentity.writeSafe &&
      employeeIdentity.employeeId &&
      context.permissions.includes("pos:hr:attendance:clock"),
  );
  const leaveCreateDisabledReason = useMemo(() => {
    if (!canReadWorkforce) return "Supervisor session, authentication, and branch context are required.";
    if (!organizationId) return "Organization context unavailable.";
    if (!branchId) return "Branch context unavailable.";
    if (!employeeIdentity.writeSafe || !employeeIdentity.employeeId) {
      return employeeIdentity.blockedReason || "Employee identity unavailable.";
    }
    if (!context.permissions.includes("pos:hr:leave:create")) {
      return "Leave create permission is not available for this Supervisor session.";
    }
    return null;
  }, [
    branchId,
    canReadWorkforce,
    context.permissions,
    employeeIdentity.blockedReason,
    employeeIdentity.employeeId,
    employeeIdentity.writeSafe,
    organizationId,
  ]);

  const attendanceQuery = useQuery({
    queryKey: ["supervisor", "me", "attendance", branchId],
    enabled: canReadWorkforce,
    queryFn: () =>
      fetchSupervisorAttendance(accessToken as string, branchId as string, {
        mine: true,
        take: 10,
      }),
    retry: 1,
  });

  const leaveQuery = useQuery({
    queryKey: ["supervisor", "me", "leave", branchId],
    enabled: canReadWorkforce,
    queryFn: () =>
      fetchSupervisorLeaveRequests(accessToken as string, branchId as string, {
        mine: true,
        take: 10,
      }),
    retry: 1,
  });

  const shiftSwapsQuery = useQuery({
    queryKey: ["supervisor", "me", "shift-swaps", branchId],
    enabled: canReadWorkforce,
    queryFn: () =>
      fetchSupervisorShiftSwaps(accessToken as string, branchId as string, {
        mine: true,
        take: 10,
      }),
    retry: 1,
  });

  useEffect(() => {
    const errors = [attendanceQuery.error, leaveQuery.error, shiftSwapsQuery.error];
    if (errors.some((error) => error instanceof ApiError && error.isAuthError)) {
      clearSession();
    }
  }, [attendanceQuery.error, clearSession, leaveQuery.error, shiftSwapsQuery.error]);

  const punchMutation = useMutation({
    mutationFn: () =>
      punchSupervisorClock(accessToken as string, branchId as string, {
        employeeId: employeeIdentity.employeeId as string,
      }),
    onSuccess: async (record) => {
      setPunchFeedback({
        tone: "success",
        message: record.clockOutAt ? "Clock-out recorded." : "Clock-in recorded.",
      });
      await queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "attendance", branchId] });
    },
    onError: (error) => {
      setPunchFeedback({ tone: "danger", message: friendlyError(error) });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (payload: SupervisorCreateLeavePayload) =>
      createSupervisorLeaveRequest(accessToken as string, branchId as string, payload),
    onSuccess: async () => {
      setLeaveFeedback({ tone: "success", message: "Leave request submitted for review." });
      setLeaveFormResetVersion((version) => version + 1);
      await queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "leave", branchId] });
      await queryClient.invalidateQueries({ queryKey: ["supervisor", "approvals", "leave", branchId] });
    },
    onError: (error) => {
      setLeaveFeedback({ tone: "danger", message: friendlyError(error) });
    },
  });

  const attendanceRecords = useMemo(
    () => attendanceQuery.data?.data || [],
    [attendanceQuery.data],
  );
  const attendance = useMemo(
    () => attendanceRecords.map(normalizeSupervisorAttendanceRecord),
    [attendanceRecords],
  );
  const leaveRequests = useMemo(
    () => (leaveQuery.data?.data || []).map(normalizeSupervisorLeaveRequest),
    [leaveQuery.data],
  );
  const shiftSwaps = useMemo(
    () => (shiftSwapsQuery.data?.data || []).map(normalizeSupervisorShiftSwap),
    [shiftSwapsQuery.data],
  );
  const punchState = useMemo(() => getSupervisorPunchState(attendanceRecords), [attendanceRecords]);
  const permissionSummaries = summarizeSupervisorPermissions(context.permissions);

  async function handleLogout() {
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
    }
  }

  async function refreshWorkforce() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "attendance", branchId] }),
      queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "leave", branchId] }),
      queryClient.invalidateQueries({ queryKey: ["supervisor", "me", "shift-swaps", branchId] }),
      queryClient.invalidateQueries({ queryKey: ["supervisor", "active-shift", branchId] }),
    ]);
  }

  function handlePunch() {
    if (!canPunch || punchMutation.isPending) return;

    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `${punchState.nextActionLabel} for ${employeeIdentity.label} at ${context.branchName}?`,
      );

    if (!confirmed) {
      setPunchFeedback({ tone: "info", message: "Punch cancelled." });
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

  const readinessRows = [
    {
      label: "Shift readiness",
      value: readiness.shift.label,
      detail: readiness.shift.detail,
      tone: readiness.shift.tone,
    },
    {
      label: "Floor",
      value: "Available in Floor",
      detail: "Live floor control remains on the Floor tab.",
      tone: "info" as const,
    },
    {
      label: "Orders",
      value: "Available in Orders",
      detail: "Order exception oversight remains on the Orders tab.",
      tone: "info" as const,
    },
    {
      label: "Reservations",
      value: "Available in Reservations",
      detail: "Reservation oversight remains on the Reservations tab.",
      tone: "info" as const,
    },
    {
      label: "Approvals",
      value: "Available in Approvals",
      detail: "Domain approvals remain read-only until action workflows are built.",
      tone: "warning" as const,
    },
    {
      label: "Workforce",
      value: canReadWorkforce ? "Self-scope reads enabled" : "Unavailable",
      detail: "Attendance, leave, and shift swaps use mine=true self-scope reads.",
      tone: canReadWorkforce ? ("success" as const) : ("warning" as const),
    },
  ];

  return (
    <section className="space-y-6" aria-labelledby="supervisor-me-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">
            Profile and workforce
          </p>
          <h1
            id="supervisor-me-title"
            className="mt-2 text-balance text-3xl font-bold tracking-normal text-text-primary"
          >
            Supervisor profile
          </h1>
          <p className="mt-2 max-w-4xl text-base leading-7 text-text-secondary">
            Session, punch, workforce self-service, and role boundaries.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant={branchId ? "success" : "warning"}>{context.branchName}</Badge>
            <Badge variant={organizationId ? "success" : "warning"}>{context.organizationName}</Badge>
            <Badge variant="neutral">{context.workstationLabel}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button size="pos" variant="secondary" leadingIcon={<ClockClockwise size={20} weight="bold" />} onClick={refreshWorkforce}>
            Refresh
          </Button>
          <Button size="pos" variant="secondary" leadingIcon={<SignOut size={20} weight="bold" />} onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Profile"
          description="Real fields from /api/auth/me with safe fallbacks where the auth payload is intentionally narrow."
          icon={<UserCircle size={24} weight="duotone" aria-hidden />}
          action={<Badge variant={isSupervisor ? "success" : "danger"}>{context.roleLabel}</Badge>}
        >
          <div className="flex min-w-0 gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-brand-navy-900 text-lg font-bold text-text-inverse shadow-subtle">
              SV
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-2xl font-bold tracking-normal text-text-primary">
                {context.displayName}
              </h3>
              <p className="mt-1 truncate text-sm font-semibold text-text-secondary">{context.email}</p>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <DetailRow label="User ID" value={context.userId} valueClassName="text-xs" />
                <DetailRow label="Job role" value={context.jobRole} />
                <DetailRow label="Membership" value={context.membershipSummary} />
                <DetailRow label="Branch" value={context.branchName} />
                <DetailRow label="Branch ID" value={context.branchId} valueClassName="text-xs" />
                <DetailRow label="Organization" value={context.organizationName} />
                <DetailRow label="Organization ID" value={context.organizationId} valueClassName="text-xs" />
                <DetailRow label="Membership status" value={context.membershipStatus} />
                <DetailRow label="Workstation" value={context.workstationLabel} />
                <DetailRow label="Employee" value={context.employeeLabel} />
                <DetailRow label="Employee ID" value={context.employeeId} valueClassName="text-xs" />
                <DetailRow label="Employee branch" value={context.employeeBranchId} valueClassName="text-xs" />
              </dl>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Session"
          description="Session state and Supervisor access are restored by the shared auth provider."
          icon={<IdentificationBadge size={24} weight="duotone" aria-hidden />}
          action={<Badge variant={isAuthenticated ? "success" : "warning"}>{isAuthenticated ? "Active" : "Inactive"}</Badge>}
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Session ID" value={context.sessionId} valueClassName="text-xs" />
            <DetailRow label="Platform" value={context.sessionPlatform} />
            <DetailRow label="Source" value={context.sessionSource} />
            <DetailRow label="Created" value={formatSessionDate(context.sessionCreatedAt)} />
            <DetailRow label="Last activity" value={formatSessionDate(context.sessionLastActivityAt)} />
            <DetailRow label="Roles" value={context.roleNames.join(", ")} />
            <DetailRow label="Organizations" value={context.organizationCount} />
            <DetailRow label="Branches" value={context.branchCount} />
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant={isSupervisor ? "success" : "danger"}>{isSupervisor ? "Supervisor allowed" : "Supervisor blocked"}</Badge>
            <Badge variant={branchId ? "success" : "warning"}>{branchId ? "Branch ready" : "Branch missing"}</Badge>
            <Badge variant={organizationId ? "success" : "warning"}>{organizationId ? "Organization ready" : "Organization missing"}</Badge>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="Readiness"
          description="Me summarizes route availability without duplicating Floor, Orders, Reservations, or Approvals data."
          icon={<ListChecks size={24} weight="duotone" aria-hidden />}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {readinessRows.map((item) => (
              <div key={item.label} className="min-h-24 rounded-md bg-surface-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                  <Badge variant={toneToBadgeVariant(item.tone)}>{item.value}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Punch and attendance"
          description="Self-scope attendance history uses GET /api/hr/attendance?mine=true."
          icon={<ClockClockwise size={24} weight="duotone" aria-hidden />}
          action={<Badge variant={punchState.tone}>{punchState.label}</Badge>}
        >
          <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-md bg-surface-muted p-4">
              <p className="text-sm font-semibold text-text-primary">{punchState.detail}</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Employee identity: {employeeIdentity.label}. Branch context: {context.branchName}.
              </p>
            </div>
            <div className="rounded-md bg-surface-muted p-4">
              <p className="text-sm font-semibold text-text-primary">
                {canPunch ? "Punch action enabled" : "Punch action unavailable"}
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                {canPunch
                  ? "Backend verifies this employee belongs to the current authenticated user before recording the punch."
                  : employeeIdentity.blockedReason || "Attendance clock permission is not available for this session."}
              </p>
              <Button
                className="mt-4 w-full"
                size="compact"
                variant={canPunch ? "primary" : "secondary"}
                disabled={!canPunch || punchMutation.isPending}
                onClick={handlePunch}
              >
                {punchMutation.isPending ? "Recording" : punchState.nextActionLabel}
              </Button>
            </div>
          </div>
          {punchFeedback ? (
            <div className="mb-4">
              <StatusMessage tone={punchFeedback.tone} title={punchFeedback.message} />
            </div>
          ) : null}

          {attendanceQuery.isLoading ? (
            <LoadingRows />
          ) : attendanceQuery.isError ? (
            <ErrorPanel error={attendanceQuery.error} />
          ) : attendance.length ? (
            <AttendanceRows rows={attendance} />
          ) : (
            <EmptyPanel
              title="No attendance records returned."
              description="Self-scope attendance is verified, but no rows were returned for this Supervisor employee link."
            />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Leave self-service"
          description="Self-scope leave visibility uses GET /api/hr/leave?mine=true. Creation submits only the linked current employee."
          icon={<CalendarCheck size={24} weight="duotone" aria-hidden />}
          action={<Badge variant={leaveCreateDisabledReason ? "warning" : "success"}>{leaveCreateDisabledReason ? "Guarded" : "Create enabled"}</Badge>}
        >
          <SupervisorLeaveRequestForm
            employeeId={employeeIdentity.employeeId}
            disabledReason={leaveCreateDisabledReason}
            isSubmitting={leaveMutation.isPending}
            resetVersion={leaveFormResetVersion}
            onSubmit={handleLeaveSubmit}
          />
          {leaveFeedback ? (
            <div className="mt-4">
              <StatusMessage tone={leaveFeedback.tone} title={leaveFeedback.message} />
            </div>
          ) : null}
          <div className="mt-4">
            {leaveQuery.isLoading ? (
              <LoadingRows />
            ) : leaveQuery.isError ? (
              <ErrorPanel error={leaveQuery.error} />
            ) : leaveRequests.length ? (
              <LeaveRows rows={leaveRequests} />
            ) : (
              <EmptyPanel
                title="No leave requests returned."
                description="Self-scope leave reads are verified. Submitted requests will appear here after the list refreshes."
              />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Shift swap self-service"
          description="Self-scope swap visibility uses GET /api/hr/shift-swaps?mine=true."
          icon={<ArrowsLeftRight size={24} weight="duotone" aria-hidden />}
          action={<Badge variant="info">Self-scope read</Badge>}
        >
          <DisabledActionCard
            title="Shift swap creation deferred"
            buttonLabel="Request swap"
            reason="Shift swap request creation requires a verified eligible shift/target selector. Broad staff selection is not exposed in Supervisor v1."
          />
          <div className="mt-4">
            {shiftSwapsQuery.isLoading ? (
              <LoadingRows />
            ) : shiftSwapsQuery.isError ? (
              <ErrorPanel error={shiftSwapsQuery.error} />
            ) : shiftSwaps.length ? (
              <ShiftSwapRows rows={shiftSwaps} />
            ) : (
              <EmptyPanel
                title="No shift swap requests returned."
                description="Self-scope shift swap reads are verified. Creating swaps stays disabled until an eligible shift and swap target selector is Supervisor-safe."
              />
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Supervisor scope"
          description="What Supervisor can do in current v1 without implying unsupported actions are live."
          icon={<ShieldCheck size={24} weight="duotone" aria-hidden />}
        >
          <div className="space-y-3">
            {[
              "Monitor floor.",
              "Review order exceptions.",
              "Review reservations.",
              "Review domain approvals.",
              "View punch and workforce self-service.",
              "Read shift readiness.",
              "Update table status where verified.",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-md bg-surface-muted px-4 py-3">
                <Info size={18} weight="bold" aria-hidden className="shrink-0 text-status-info" />
                <p className="text-sm font-semibold text-text-primary">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {permissionSummaries.slice(0, 5).map((group) => (
              <div key={group.key} className="grid gap-3 rounded-md bg-surface-muted p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{group.label}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {group.matched.length ? group.matched.join(", ") : "No matching permissions detected"}
                  </p>
                </div>
                <Badge variant={toneToBadgeVariant(group.tone)}>{group.matched.length}/{group.total}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Restricted surfaces"
          description="These are explicitly outside Supervisor v1."
          icon={<Prohibit size={24} weight="duotone" aria-hidden />}
        >
          <div className="space-y-3">
            {[
              "Global approvals inbox.",
              "Receipt send or reprint.",
              "Device, printer, or terminal administration.",
              "Accounting.",
              "Billing.",
              "Franchise.",
              "Developer tools.",
              "Payroll and pay runs.",
              "Staff admin.",
              "Cashier checkout.",
              "Waiter menu entry.",
              "Live MTN/Airtel checkout.",
              "PesaPal diner checkout.",
              "Physical printer-driver actions.",
              "Acquirer/card-terminal traffic.",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-md bg-surface-muted px-4 py-3">
                <Prohibit size={18} weight="bold" aria-hidden className="shrink-0 text-status-neutral" />
                <p className="text-sm font-semibold text-text-primary">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {supervisorRestrictedSurfaces.map((surface) => (
              <div key={surface.label} className="rounded-md bg-surface-muted p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{surface.label}</p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{surface.detail}</p>
                  </div>
                  <Badge variant="neutral">Blocked</Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Known limitations"
          description="Operational caveats remain visible here so the Me page does not overstate what is live."
          icon={<WarningCircle size={24} weight="duotone" aria-hidden />}
        >
          <div className="space-y-3">
            {[
              "Nest watch mode is slow/quiet; compiled API startup is verified QA path.",
              "Browser visual QA may be blocked by attach timeout; HTTP smoke is used where needed.",
              "Refund pending queue missing read-only endpoint.",
              "Post-close void candidate queue missing read-only endpoint.",
              "Punch/write actions may be disabled if current-user employee identity cannot be safely resolved.",
              "Leave creation may be disabled if current-user employee identity, branch context, or leave create permission is unavailable.",
              "Shift swap creation remains deferred until a safe eligible shift and target selector contract exists.",
              "Receipt/device APIs excluded because Supervisor lacks permissions.",
            ].map((item) => (
              <div key={item} className="rounded-md bg-surface-muted p-3">
                <p className="text-sm leading-6 text-text-secondary">{item}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <StatusMessage tone="info" title="Employee identity resolution">
            {employeeIdentity.writeSafe
              ? `Verified current-user employee identity: ${employeeIdentity.label}.`
              : employeeIdentity.blockedReason}
          </StatusMessage>
          <SupervisorCaveatBanner
            title={supervisorCaveats.globalApprovals}
            description="Supervisor remains on domain-specific approval reads."
            icon="approval"
            tone="warning"
          />
          <SupervisorCaveatBanner
            title={supervisorCaveats.receiptsDevices}
            description="Receipt and device surfaces stay out of this profile."
            icon="excluded"
            tone="neutral"
          />
          <SupervisorCaveatBanner
            title={supervisorCaveats.mobileMoney}
            description="No live diner mobile-money checkout is introduced."
            icon="mobile-money"
            tone="danger"
          />
          <SupervisorCaveatBanner
            title={supervisorCaveats.pesaPal}
            description="Owner billing remains outside the Supervisor workspace."
            icon="excluded"
            tone="neutral"
          />
          <SupervisorCaveatBanner
            title={supervisorCaveats.printer}
            description="Printer-related states stay metadata-only."
            icon="printer"
            tone="info"
          />
          <SupervisorCaveatBanner
            title={supervisorCaveats.terminal}
            description="Hardware provider traffic stays out of this profile."
            icon="terminal"
            tone="info"
          />
        </div>
      </div>
    </section>
  );
}
