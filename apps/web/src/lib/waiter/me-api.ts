import { apiRequest } from "@/lib/api/client";
import { getActiveShiftRequest } from "@/lib/auth/auth-api";

export type WaiterShiftApi = {
  id: string;
  shiftNumber?: string | null;
  status?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  openedById?: string | null;
  branchId?: string | null;
  orgId?: string | null;
  notes?: string | null;
  tillSessions?: Array<{
    id: string;
    tillCode?: string | null;
    status?: string | null;
    openingFloat?: string | number | null;
  }> | null;
};

export type ShiftActionPayload = {
  notes?: string;
};

export type WaiterAttendanceEmployeeApi = {
  id?: string | null;
  employeeCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type WaiterAttendanceRecordApi = {
  id: string;
  employeeId?: string | null;
  attendanceDate?: string | null;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  status?: string | null;
  lateMinutes?: number | null;
  notes?: string | null;
  employee?: WaiterAttendanceEmployeeApi | null;
};

export type WaiterLeaveRequestApi = {
  id: string;
  employeeId?: string | null;
  leaveType?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  reason?: string | null;
  status?: string | null;
  reviewNotes?: string | null;
  createdAt?: string | null;
  employee?: WaiterAttendanceEmployeeApi | null;
};

export type WaiterShiftSwapApi = {
  id: string;
  requesterEmployeeId?: string | null;
  targetEmployeeId?: string | null;
  shiftDate?: string | null;
  reason?: string | null;
  status?: string | null;
  reviewNotes?: string | null;
  createdAt?: string | null;
  requester?: WaiterAttendanceEmployeeApi | null;
  target?: WaiterAttendanceEmployeeApi | null;
};

export type PaginatedSelfServiceResponse<T> = {
  data: T[];
  total?: number;
};

export type SelfServiceListQuery = {
  mine?: boolean;
  status?: string;
  skip?: number;
  take?: number;
};

export type AttendanceListQuery = SelfServiceListQuery & {
  dateFrom?: string;
  dateTo?: string;
};

export type LeaveListQuery = SelfServiceListQuery & {
  leaveType?: string;
};

export type ClockAttendancePayload = {
  employeeId: string;
  notes?: string;
};

export type CreateLeaveRequestPayload = {
  employeeId: string;
  leaveType: "ANNUAL" | "SICK" | "UNPAID" | "EMERGENCY" | "OTHER";
  startsAt: string;
  endsAt: string;
  reason?: string;
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

export const getActiveShift = getActiveShiftRequest;

export function startShift(token: string, branchId: string, payload: ShiftActionPayload = {}) {
  return apiRequest<WaiterShiftApi>("/api/shifts/open", {
    method: "POST",
    token,
    branchId,
    body: compactBody(payload),
  });
}

export function endShift(
  token: string,
  branchId: string,
  shiftId: string,
  payload: ShiftActionPayload = {},
) {
  return apiRequest<WaiterShiftApi & { summary?: unknown }>(`/api/shifts/${shiftId}/close`, {
    method: "POST",
    token,
    branchId,
    body: compactBody(payload),
  });
}

export function listMyAttendance(
  token: string,
  branchId: string,
  query: AttendanceListQuery = { mine: true, take: 8 },
) {
  return apiRequest<PaginatedSelfServiceResponse<WaiterAttendanceRecordApi>>(
    `/api/hr/attendance${buildQueryString({ mine: true, ...query })}`,
    { token, branchId },
  );
}

export function clockAttendance(
  token: string,
  branchId: string,
  payload: ClockAttendancePayload,
) {
  return apiRequest<WaiterAttendanceRecordApi>("/api/hr/attendance/clock", {
    method: "POST",
    token,
    branchId,
    body: compactBody(payload),
  });
}

export function listMyLeaveRequests(
  token: string,
  branchId: string,
  query: LeaveListQuery = { mine: true, take: 8 },
) {
  return apiRequest<PaginatedSelfServiceResponse<WaiterLeaveRequestApi>>(
    `/api/hr/leave${buildQueryString({ mine: true, ...query })}`,
    { token, branchId },
  );
}

export function createLeaveRequest(
  token: string,
  branchId: string,
  payload: CreateLeaveRequestPayload,
) {
  return apiRequest<WaiterLeaveRequestApi>("/api/hr/leave", {
    method: "POST",
    token,
    branchId,
    body: compactBody(payload),
  });
}

export function listMyShiftSwaps(
  token: string,
  branchId: string,
  query: SelfServiceListQuery = { mine: true, take: 8 },
) {
  return apiRequest<PaginatedSelfServiceResponse<WaiterShiftSwapApi>>(
    `/api/hr/shift-swaps${buildQueryString({ mine: true, ...query })}`,
    { token, branchId },
  );
}
