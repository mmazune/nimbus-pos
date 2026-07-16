import { apiRequest } from "@/lib/api/client";
import type { AuthMeResponse } from "@/lib/auth/types";

export type SupervisorWorkforceEmployee = {
  id?: string | null;
  employeeCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type SupervisorAttendanceRecord = {
  id: string;
  employeeId?: string | null;
  attendanceDate?: string | null;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  status?: string | null;
  lateMinutes?: number | null;
  notes?: string | null;
  employee?: SupervisorWorkforceEmployee | null;
};

export type SupervisorLeaveRequest = {
  id: string;
  employeeId?: string | null;
  leaveType?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  reason?: string | null;
  status?: string | null;
  reviewNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  employee?: SupervisorWorkforceEmployee | null;
};

export type SupervisorShiftSwap = {
  id: string;
  requesterEmployeeId?: string | null;
  targetEmployeeId?: string | null;
  shiftDate?: string | null;
  reason?: string | null;
  status?: string | null;
  reviewNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  requester?: SupervisorWorkforceEmployee | null;
  target?: SupervisorWorkforceEmployee | null;
};

export type SupervisorWorkforceListResponse<T> = {
  data: T[];
  total?: number;
};

export type SupervisorAttendanceQuery = {
  mine?: boolean;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  skip?: number;
  take?: number;
};

export type SupervisorLeaveQuery = {
  mine?: boolean;
  status?: string;
  leaveType?: string;
  skip?: number;
  take?: number;
};

export type SupervisorShiftSwapQuery = {
  mine?: boolean;
  status?: string;
  skip?: number;
  take?: number;
};

export type SupervisorClockPayload = {
  employeeId: string;
  notes?: string;
};

export type SupervisorCreateLeavePayload = {
  employeeId: string;
  leaveType: "ANNUAL" | "SICK" | "UNPAID" | "EMERGENCY" | "OTHER";
  startsAt: string;
  endsAt: string;
  reason?: string;
};

export type SupervisorCreateShiftSwapPayload = {
  requesterEmployeeId: string;
  targetEmployeeId: string;
  shiftDate: string;
  reason?: string;
};

export type SupervisorEmployeeIdentity = {
  employeeId: string | null;
  label: string;
  writeSafe: boolean;
  blockedReason: string;
};

export type SupervisorStatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type SupervisorAttendanceView = {
  id: string;
  employeeId: string;
  employeeLabel: string;
  dateLabel: string;
  clockInLabel: string;
  clockOutLabel: string;
  durationLabel: string;
  statusLabel: string;
  statusTone: SupervisorStatusTone;
  notesLabel: string;
  lateMinutesLabel: string;
};

export type SupervisorLeaveView = {
  id: string;
  employeeId: string;
  employeeLabel: string;
  typeLabel: string;
  dateRangeLabel: string;
  statusLabel: string;
  statusTone: SupervisorStatusTone;
  reasonLabel: string;
  createdLabel: string;
};

export type SupervisorShiftSwapView = {
  id: string;
  requesterEmployeeId: string;
  targetEmployeeId: string;
  requesterLabel: string;
  targetLabel: string;
  shiftDateLabel: string;
  statusLabel: string;
  statusTone: SupervisorStatusTone;
  reasonLabel: string;
  createdLabel: string;
};

export type SupervisorPunchState = {
  label: string;
  detail: string;
  tone: SupervisorStatusTone;
  nextActionLabel: string;
};

function compactBody<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as Partial<T>;
}

function buildQueryString(query: Record<string, string | number | boolean | undefined> = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const raw = params.toString();
  return raw ? `?${raw}` : "";
}

function titleCase(value: string | null | undefined, fallback = "Not available") {
  const text = value?.trim();
  if (!text) return fallback;
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
  if (!date) return "Not recorded";
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

function snippet(value: string | null | undefined, fallback: string) {
  const text = value?.trim();
  if (!text) return fallback;
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
}

function statusTone(status: string | null | undefined): SupervisorStatusTone {
  const raw = String(status || "").toUpperCase();
  if (raw.includes("APPROVED") || raw.includes("CLOCKED_IN")) return "success";
  if (raw.includes("PENDING") || raw.includes("LATE")) return "warning";
  if (raw.includes("REJECTED") || raw.includes("ABSENT") || raw.includes("CANCELLED")) return "danger";
  if (raw.includes("CLOCKED_OUT") || raw.includes("ON_LEAVE")) return "info";
  return "neutral";
}

function employeeName(employee: SupervisorWorkforceEmployee | null | undefined, fallback = "Employee hidden") {
  if (!employee) return fallback;
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return name || employee.employeeCode || employee.email || fallback;
}

function toDateKey(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function resolveSupervisorEmployeeIdentity(user: AuthMeResponse | null): SupervisorEmployeeIdentity {
  if (!user) {
    return {
      employeeId: null,
      label: "Employee profile unavailable",
      writeSafe: false,
      blockedReason:
        "Employee profile link is unavailable; punch and self-service writes are disabled until current-user employee resolution is verified.",
    };
  }

  if (user.employee?.id) {
    const label =
      user.employee.displayName ||
      [user.employee.firstName, user.employee.lastName].filter(Boolean).join(" ").trim() ||
      user.employee.employeeCode ||
      "Linked employee";

    return {
      employeeId: user.employee.id,
      label: user.employee.employeeCode ? `${user.employee.employeeCode} / ${label}` : label,
      writeSafe: true,
      blockedReason: "",
    };
  }

  return {
    employeeId: null,
    label: "Not returned by /api/auth/me",
    writeSafe: false,
    blockedReason:
      "Employee profile link is unavailable; punch and self-service writes are disabled until current-user employee resolution is verified.",
  };
}

export function fetchSupervisorAttendance(
  token: string,
  branchId: string,
  query: SupervisorAttendanceQuery = { mine: true, take: 10 },
) {
  return apiRequest<SupervisorWorkforceListResponse<SupervisorAttendanceRecord>>(
    `/api/hr/attendance${buildQueryString({ mine: true, ...query })}`,
    { token, branchId },
  );
}

export function punchSupervisorClock(token: string, branchId: string, payload: SupervisorClockPayload) {
  return apiRequest<SupervisorAttendanceRecord>("/api/hr/attendance/clock", {
    method: "POST",
    token,
    branchId,
    body: compactBody(payload),
  });
}

export function fetchSupervisorLeaveRequests(
  token: string,
  branchId: string,
  query: SupervisorLeaveQuery = { mine: true, take: 10 },
) {
  return apiRequest<SupervisorWorkforceListResponse<SupervisorLeaveRequest>>(
    `/api/hr/leave${buildQueryString({ mine: true, ...query })}`,
    { token, branchId },
  );
}

export function createSupervisorLeaveRequest(
  token: string,
  branchId: string,
  payload: SupervisorCreateLeavePayload,
) {
  return apiRequest<SupervisorLeaveRequest>("/api/hr/leave", {
    method: "POST",
    token,
    branchId,
    body: compactBody(payload),
  });
}

export function fetchSupervisorShiftSwaps(
  token: string,
  branchId: string,
  query: SupervisorShiftSwapQuery = { mine: true, take: 10 },
) {
  return apiRequest<SupervisorWorkforceListResponse<SupervisorShiftSwap>>(
    `/api/hr/shift-swaps${buildQueryString({ mine: true, ...query })}`,
    { token, branchId },
  );
}

export function createSupervisorShiftSwap(
  token: string,
  branchId: string,
  payload: SupervisorCreateShiftSwapPayload,
) {
  return apiRequest<SupervisorShiftSwap>("/api/hr/shift-swaps", {
    method: "POST",
    token,
    branchId,
    body: compactBody(payload),
  });
}

export function normalizeSupervisorAttendanceRecord(
  record: SupervisorAttendanceRecord,
): SupervisorAttendanceView {
  return {
    id: record.id,
    employeeId: record.employeeId || "Not available",
    employeeLabel: employeeName(record.employee),
    dateLabel: formatDate(record.attendanceDate),
    clockInLabel: formatTime(record.clockInAt),
    clockOutLabel: formatTime(record.clockOutAt),
    durationLabel: formatDuration(record.clockInAt, record.clockOutAt),
    statusLabel: titleCase(record.status, "Status unavailable"),
    statusTone: statusTone(record.status),
    notesLabel: snippet(record.notes, "No note recorded."),
    lateMinutesLabel:
      typeof record.lateMinutes === "number" && record.lateMinutes > 0
        ? `${record.lateMinutes} min late`
        : "No lateness recorded",
  };
}

export function normalizeSupervisorLeaveRequest(record: SupervisorLeaveRequest): SupervisorLeaveView {
  return {
    id: record.id,
    employeeId: record.employeeId || "Not available",
    employeeLabel: employeeName(record.employee),
    typeLabel: titleCase(record.leaveType, "Leave"),
    dateRangeLabel: `${formatDate(record.startsAt)} to ${formatDate(record.endsAt)}`,
    statusLabel: getSupervisorLeaveStatusLabel(record.status),
    statusTone: statusTone(record.status),
    reasonLabel: snippet(record.reason, "No reason added."),
    createdLabel: formatDateTime(record.createdAt),
  };
}

export function normalizeSupervisorShiftSwap(record: SupervisorShiftSwap): SupervisorShiftSwapView {
  return {
    id: record.id,
    requesterEmployeeId: record.requesterEmployeeId || "Not available",
    targetEmployeeId: record.targetEmployeeId || "Not available",
    requesterLabel: employeeName(record.requester, "Requester hidden"),
    targetLabel: employeeName(record.target, "Target employee hidden"),
    shiftDateLabel: formatDate(record.shiftDate),
    statusLabel: getSupervisorShiftSwapStatusLabel(record.status),
    statusTone: statusTone(record.status),
    reasonLabel: snippet(record.reason, "No reason added."),
    createdLabel: formatDateTime(record.createdAt),
  };
}

export function getSupervisorPunchState(records: SupervisorAttendanceRecord[]): SupervisorPunchState {
  if (!records.length) {
    return {
      label: "No punch recorded",
      detail: "Self-scope attendance read returned no records.",
      tone: "neutral",
      nextActionLabel: "Record punch",
    };
  }

  const todayKey = toDateKey(new Date().toISOString());
  const todayRecord = records.find((record) => toDateKey(record.attendanceDate) === todayKey);
  const latest = todayRecord || records[0];
  const status = String(latest.status || "").toUpperCase();

  if (latest.clockInAt && !latest.clockOutAt && (status === "CLOCKED_IN" || status === "LATE")) {
    return {
      label: status === "LATE" ? "Clocked in late" : "Clocked in",
      detail: `Latest clock-in: ${formatDateTime(latest.clockInAt)}.`,
      tone: status === "LATE" ? "warning" : "success",
      nextActionLabel: "Clock out",
    };
  }

  if (latest.clockOutAt) {
    return {
      label: "Clocked out",
      detail: `Latest clock-out: ${formatDateTime(latest.clockOutAt)}.`,
      tone: "info",
      nextActionLabel: "Clock in",
    };
  }

  return {
    label: titleCase(latest.status, "Attendance found"),
    detail: `${formatDate(latest.attendanceDate)} attendance record returned.`,
    tone: statusTone(latest.status),
    nextActionLabel: "Record punch",
  };
}

export function getSupervisorLeaveStatusLabel(status: string | null | undefined) {
  return titleCase(status, "Status unavailable");
}

export function getSupervisorShiftSwapStatusLabel(status: string | null | undefined) {
  return titleCase(status, "Status unavailable");
}
