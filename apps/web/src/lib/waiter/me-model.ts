import type { AuthMeResponse } from "@/lib/auth/types";
import type {
  WaiterAttendanceRecordApi,
  WaiterLeaveRequestApi,
  WaiterShiftApi,
  WaiterShiftSwapApi,
} from "@/lib/waiter/me-api";

export type WaiterMeProfileViewModel = {
  userId: string;
  displayName: string;
  email: string;
  roleLabels: string[];
  branchId?: string;
  branchName: string;
  organizationName: string;
  serviceArea: string;
  avatarInitials: string;
  employeeId?: string;
  employeeUnavailableReason?: string;
  permissions: string[];
};

export type WaiterSelfServiceCapabilityViewModel = {
  canStartShift: boolean;
  canEndShift: boolean;
  canClockAttendance: boolean;
  canCreateLeave: boolean;
  canCreateShiftSwap: boolean;
  attendanceReadOnlyReason?: string;
  leaveReadOnlyReason?: string;
  shiftSwapReadOnlyReason?: string;
};

export type WaiterShiftViewModel = {
  id?: string;
  shiftNumber: string;
  status: "OPEN" | "CLOSED" | "NONE" | string;
  openedAt?: string;
  closedAt?: string;
  openedLabel: string;
  closedLabel: string;
  elapsedLabel: string;
  canStart: boolean;
  canEnd: boolean;
  blockedReason?: string;
};

export type WaiterAttendanceRecordViewModel = {
  id: string;
  employeeId?: string;
  dateLabel: string;
  clockInLabel: string;
  clockOutLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  durationLabel: string;
  notes?: string;
};

export type WaiterLeaveRequestViewModel = {
  id: string;
  employeeId?: string;
  typeLabel: string;
  dateRangeLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  reasonSnippet: string;
};

export type WaiterShiftSwapViewModel = {
  id: string;
  requesterEmployeeId?: string;
  targetEmployeeId?: string;
  shiftDateLabel: string;
  targetLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  reasonSnippet: string;
};

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

function titleCase(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function parseDate(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "Time unavailable";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatElapsedSince(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "No active timer";

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just started";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function formatDuration(start: string | null | undefined, end: string | null | undefined) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate) return "Not started";
  if (!endDate) return "In progress";

  const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function getInitials(displayName: string, email: string) {
  const parts = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function readProfileEmployeeId(user: AuthMeResponse | null) {
  if (!user) return undefined;
  const profile = user as AuthMeResponse & {
    employeeId?: string | null;
    staff?: { employeeId?: string | null };
  };

  return profile.employeeId || profile.staff?.employeeId || undefined;
}

function statusTone(status: string | null | undefined): StatusTone {
  const raw = String(status || "").toUpperCase();
  if (raw.includes("APPROVED") || raw.includes("OPEN") || raw.includes("CLOCKED_IN")) return "success";
  if (raw.includes("PENDING") || raw.includes("LATE")) return "warning";
  if (raw.includes("REJECTED") || raw.includes("ABSENT") || raw.includes("CANCELLED")) return "danger";
  if (raw.includes("CLOCKED_OUT") || raw.includes("CLOSED") || raw.includes("ON_LEAVE")) return "info";
  return "neutral";
}

function employeeName(employee: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined) {
  if (!employee) return undefined;
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return name || employee.email || undefined;
}

function snippet(value: string | null | undefined, fallback: string) {
  const text = value?.trim();
  if (!text) return fallback;
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

export function normalizeWaiterMeProfile(
  user: AuthMeResponse | null,
  branchName: string | null,
): WaiterMeProfileViewModel {
  const membership =
    user?.memberships.find((item) => item.branchId === user.context.defaultBranchId) ||
    user?.memberships.find((item) => item.isDefaultBranch) ||
    user?.memberships[0];
  const displayName = user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.email || "Waiter";
  const email = user?.email || "Email unavailable";
  const employeeId = readProfileEmployeeId(user);

  return {
    userId: user?.id || "unknown",
    displayName,
    email,
    roleLabels: user?.roles.map((role) => role.jobRole || role.name).filter(Boolean) || ["Role unavailable"],
    branchId: user?.context.defaultBranchId || membership?.branchId || undefined,
    branchName: branchName || membership?.branchName || "Branch context unavailable",
    organizationName: membership?.organizationName || "Organization unavailable",
    serviceArea: "Service area pending",
    avatarInitials: getInitials(displayName, email),
    employeeId,
    employeeUnavailableReason: employeeId
      ? undefined
      : "Employee ID is not returned by auth/me. Actions that require an employee record are disabled.",
    permissions: user?.permissions || [],
  };
}

export function normalizeShift(
  shift: WaiterShiftApi | null | undefined,
  permissions: string[],
): WaiterShiftViewModel {
  const canStartByPermission = permissions.includes("pos:shift:open");
  const canEndByPermission = permissions.includes("pos:shift:close");
  const open = Boolean(shift?.id && String(shift.status || "OPEN").toUpperCase() === "OPEN");

  if (!shift) {
    return {
      status: "NONE",
      shiftNumber: "No active shift",
      openedLabel: "Not started",
      closedLabel: "Not closed",
      elapsedLabel: "No active timer",
      canStart: canStartByPermission,
      canEnd: false,
      blockedReason: canStartByPermission ? undefined : "Shift self-service is not available from this workstation.",
    };
  }

  return {
    id: shift.id,
    status: String(shift.status || "OPEN").toUpperCase(),
    shiftNumber: shift.shiftNumber || shift.id,
    openedAt: shift.openedAt || undefined,
    closedAt: shift.closedAt || undefined,
    openedLabel: formatDateTime(shift.openedAt),
    closedLabel: shift.closedAt ? formatDateTime(shift.closedAt) : "Still open",
    elapsedLabel: open ? formatElapsedSince(shift.openedAt) : "Shift closed",
    canStart: false,
    canEnd: open && canEndByPermission,
    blockedReason: open && !canEndByPermission ? "Shift close is not enabled for this account." : undefined,
  };
}

export function normalizeCapabilities({
  profile,
  shift,
}: {
  profile: WaiterMeProfileViewModel;
  shift: WaiterShiftViewModel;
}): WaiterSelfServiceCapabilityViewModel {
  const permissions = new Set(profile.permissions);
  const employeeReason = profile.employeeUnavailableReason;
  const canClockAttendance = Boolean(profile.employeeId && permissions.has("pos:hr:attendance:clock"));
  const canCreateLeave = Boolean(profile.employeeId && permissions.has("pos:hr:leave:create"));

  return {
    canStartShift: shift.canStart,
    canEndShift: shift.canEnd,
    canClockAttendance,
    canCreateLeave,
    canCreateShiftSwap: false,
    attendanceReadOnlyReason: !profile.employeeId
      ? employeeReason
      : canClockAttendance
        ? undefined
        : "Attendance clocking is not enabled for this account.",
    leaveReadOnlyReason: !profile.employeeId
      ? employeeReason
      : canCreateLeave
        ? undefined
        : "Leave requests are not enabled for this account.",
    shiftSwapReadOnlyReason:
      "Shift swap creation requires a target employee selector. The waiter UI only reads self-scope swap requests for now.",
  };
}

export function normalizeAttendanceRecord(
  record: WaiterAttendanceRecordApi,
): WaiterAttendanceRecordViewModel {
  return {
    id: record.id,
    employeeId: record.employeeId || undefined,
    dateLabel: formatDate(record.attendanceDate),
    clockInLabel: formatTime(record.clockInAt),
    clockOutLabel: formatTime(record.clockOutAt),
    statusLabel: titleCase(record.status, "Status unavailable"),
    statusTone: statusTone(record.status),
    durationLabel: formatDuration(record.clockInAt, record.clockOutAt),
    notes: record.notes || undefined,
  };
}

export function normalizeLeaveRequest(record: WaiterLeaveRequestApi): WaiterLeaveRequestViewModel {
  return {
    id: record.id,
    employeeId: record.employeeId || undefined,
    typeLabel: titleCase(record.leaveType, "Leave"),
    dateRangeLabel: `${formatDate(record.startsAt)} to ${formatDate(record.endsAt)}`,
    statusLabel: titleCase(record.status, "Status unavailable"),
    statusTone: statusTone(record.status),
    reasonSnippet: snippet(record.reason, "No reason added."),
  };
}

export function normalizeShiftSwap(record: WaiterShiftSwapApi): WaiterShiftSwapViewModel {
  return {
    id: record.id,
    requesterEmployeeId: record.requesterEmployeeId || undefined,
    targetEmployeeId: record.targetEmployeeId || undefined,
    shiftDateLabel: formatDate(record.shiftDate),
    targetLabel: employeeName(record.target) || "Target employee hidden",
    statusLabel: titleCase(record.status, "Status unavailable"),
    statusTone: statusTone(record.status),
    reasonSnippet: snippet(record.reason, "No reason added."),
  };
}
