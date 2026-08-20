import { apiRequest } from "@/lib/api/client";
import {
  projectManagerEmployee,
  projectManagerStaffIdentity,
  type ManagerSafeEmployee,
} from "@/lib/manager/staff-projection";
import type {
  ManagerDirectoryPage,
  ManagerLeavePage,
  ManagerLeaveRow,
  ManagerOnboardResult,
  ManagerOneTimeSecret,
  ManagerQuickPinStatus,
  ManagerShiftSwapPage,
  ManagerShiftSwapRow,
} from "@/lib/manager/staff-types";
import {
  managerOnboardingInstructions,
  type ManagerOnboardPayload,
} from "@/lib/manager/staff-model";

/**
 * Manager Staff — request layer (Track B3).
 *
 * ## The four things this module guarantees
 *
 * 1. **`?view=full` is never sent.** `GET /hr/employees` still accepts it, and
 *    the seeded Manager role still holds `pos:hr:compensation:read` (FU-1, a
 *    seed change nobody authorised), so a Manager token *could* fetch salary.
 *    The frontend simply never asks. There is no code path, no flag and no
 *    parameter in this file that can produce `view=full`; the B3 assertion
 *    script greps for it across `lib/manager` and `components/manager`.
 * 2. **Every response is projected before it is returned.** `/hr/leave` and
 *    `/hr/shift-swaps` embed full `employee` objects with `address`,
 *    `dateOfBirth`, `emergencyContact*` and private `notes`. Those objects are
 *    read as `unknown`, narrowed by the allow-list, and dropped — so nothing
 *    forbidden ever enters React state or the React Query cache.
 * 3. **Every list sends an explicit bound.** `/hr/employees` has no `@Max` and
 *    no clamp (C-12); leave and shift-swaps clamp at 100 but are still asked
 *    explicitly.
 * 4. **The one-time secret is returned from a MUTATION only.** Onboarding and
 *    PIN reset return the plaintext PIN once (MP0-14). Mutations have no cache
 *    in React Query, so the value has nowhere to persist; the caller holds it in
 *    component state for the life of one dialog and never writes it anywhere.
 *    It is never logged — this module contains no `console.*` call.
 */

/** Explicit bound for the org-wide employee read (C-12: no server-side `@Max`). */
export const MANAGER_DIRECTORY_TAKE = 100;

/** Explicit bound for the review lists (server clamps at 100; we ask for less). */
export const MANAGER_REVIEW_TAKE = 25;

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(value: unknown) {
  return value === true;
}

function personName(value: unknown) {
  const source = (value || {}) as Record<string, unknown>;
  const name = [str(source.firstName), str(source.lastName)].filter(Boolean).join(" ").trim();
  return name || null;
}

// ── Directory ───────────────────────────────────────────────────────────────

export type ManagerDirectoryQuery = {
  /** Server-side text search — `/hr/employees` really does support `?search=`. */
  search?: string | null;
  status?: string | null;
};

export function buildManagerDirectoryPath({ search, status }: ManagerDirectoryQuery) {
  const params = new URLSearchParams();
  // Explicit bound — `take` is unbounded server-side (C-12).
  params.set("take", String(MANAGER_DIRECTORY_TAKE));
  params.set("skip", "0");
  if (status) params.set("status", status);
  const trimmed = search?.trim();
  if (trimmed) params.set("search", trimmed);
  // NOTE: `view` is deliberately absent. The default is the C-02 safe projection;
  // asking for `view=full` would return compensation and personal data.
  // NOTE: `branchId` is deliberately absent — the endpoint 400s on it (MP0-06).
  return `/api/hr/employees?${params.toString()}`;
}

export async function listManagerEmployees(
  token: string,
  branchId: string,
  query: ManagerDirectoryQuery,
): Promise<ManagerDirectoryPage> {
  const response = await apiRequest<{ data?: unknown[]; total?: number }>(
    buildManagerDirectoryPath(query),
    { token, branchId },
  );

  return {
    rows: (response.data || []).map(projectManagerEmployee),
    // The endpoint's total is ORGANIZATION-wide; the UI never presents it as a
    // branch count, because the branch narrowing happens in the browser.
    organizationTotal: num(response.total) ?? 0,
    requestedTake: MANAGER_DIRECTORY_TAKE,
  };
}

// ── Leave ───────────────────────────────────────────────────────────────────

export function buildManagerLeavePath(status: string | null, page: number) {
  const params = new URLSearchParams();
  params.set("take", String(MANAGER_REVIEW_TAKE));
  params.set("skip", String(Math.max(0, (page - 1) * MANAGER_REVIEW_TAKE)));
  if (status) params.set("status", status);
  return `/api/hr/leave?${params.toString()}`;
}

function projectManagerLeaveRow(raw: unknown): ManagerLeaveRow {
  const source = (raw || {}) as Record<string, unknown>;
  return {
    id: str(source.id) || "",
    // The nested `employee` object carries address / dateOfBirth / notes — the
    // identity projection keeps the name and code and nothing else.
    employee: projectManagerStaffIdentity(source.employee),
    leaveType: (str(source.leaveType) || "OTHER").toUpperCase(),
    startsAt: str(source.startsAt),
    endsAt: str(source.endsAt),
    reason: str(source.reason),
    status: (str(source.status) || "PENDING").toUpperCase(),
    requestedByName: personName(source.requestedBy),
    reviewedByName: personName(source.reviewedBy),
    reviewedAt: str(source.reviewedAt),
    reviewNotes: str(source.reviewNotes),
    createdAt: str(source.createdAt),
    branchId: str(source.branchId),
  };
}

export async function listManagerLeave(
  token: string,
  branchId: string,
  status: string | null,
  page: number,
): Promise<ManagerLeavePage> {
  const response = await apiRequest<{ data?: unknown[]; total?: number }>(
    buildManagerLeavePath(status, page),
    { token, branchId },
  );
  return {
    rows: (response.data || []).map(projectManagerLeaveRow),
    total: num(response.total) ?? 0,
  };
}

/**
 * `PATCH /api/hr/leave/:id/review` — `pos:hr:leave:review`.
 *
 * The service looks the record up by `{ id, orgId }` only: leave has a nullable
 * branch and is reviewed at ORGANIZATION level by design
 * (`attendance.service.ts:330`). The UI states that and shows each row's own
 * branch, rather than implying a branch-scoped decision it does not make.
 *
 * It writes `status`, `reviewedById`, `reviewedAt` and `reviewNotes` — and
 * nothing else. **No payroll record and no roster row is touched**, so the UI
 * makes no payroll or roster claim (the Supervisor precedent).
 */
export async function reviewManagerLeave(
  token: string,
  branchId: string,
  leaveId: string,
  decision: "APPROVED" | "REJECTED",
  reviewNotes?: string,
) {
  const trimmed = reviewNotes?.trim();
  return apiRequest<unknown>(`/api/hr/leave/${encodeURIComponent(leaveId)}/review`, {
    method: "PATCH",
    body: { status: decision, ...(trimmed ? { reviewNotes: trimmed } : {}) },
    token,
    branchId,
  });
}

// ── Shift swaps ─────────────────────────────────────────────────────────────

export function buildManagerShiftSwapPath(status: string | null, page: number) {
  const params = new URLSearchParams();
  params.set("take", String(MANAGER_REVIEW_TAKE));
  params.set("skip", String(Math.max(0, (page - 1) * MANAGER_REVIEW_TAKE)));
  if (status) params.set("status", status);
  return `/api/hr/shift-swaps?${params.toString()}`;
}

function projectManagerShiftSwapRow(raw: unknown): ManagerShiftSwapRow {
  const source = (raw || {}) as Record<string, unknown>;
  return {
    id: str(source.id) || "",
    requester: projectManagerStaffIdentity(source.requester),
    target: projectManagerStaffIdentity(source.target),
    shiftDate: str(source.shiftDate),
    reason: str(source.reason),
    status: (str(source.status) || "PENDING").toUpperCase(),
    reviewNotes: str(source.reviewNotes),
    approvedAt: str(source.approvedAt),
    createdAt: str(source.createdAt),
    branchId: str(source.branchId),
  };
}

export async function listManagerShiftSwaps(
  token: string,
  branchId: string,
  status: string | null,
  page: number,
): Promise<ManagerShiftSwapPage> {
  const response = await apiRequest<{ data?: unknown[]; total?: number }>(
    buildManagerShiftSwapPath(status, page),
    { token, branchId },
  );
  return {
    rows: (response.data || []).map(projectManagerShiftSwapRow),
    total: num(response.total) ?? 0,
  };
}

/**
 * `PATCH /api/hr/shift-swaps/:id/approve` — **REJECT ONLY** (Outcome C).
 *
 * The route accepts `status: APPROVED | REJECTED`, but approving is a promise
 * this backend cannot keep. `attendance.service.ts:555-623` mutates the
 * `ShiftSwapRequest` row and writes one audit event — nothing else. A repo-wide
 * grep finds SIX `scheduleAssignment` call sites and **all six are reads**
 * (`attendance.service.ts:439,454`; `staff-insights.service.ts:293`;
 * `workforce.service.ts:425,436,467`); there is no create, update or delete
 * anywhere in the API. **Approving a swap changes ZERO roster rows.**
 *
 * Supervisor reached the same conclusion (SUP-RG-036/042) and shipped reject-only
 * with an honest notice. Manager follows that precedent exactly, so the parameter
 * here is narrowed to the literal `"REJECTED"` — the type system, not a code
 * review, is what stops an Approve button appearing later.
 */
export async function rejectManagerShiftSwap(
  token: string,
  branchId: string,
  swapId: string,
  reviewNotes?: string,
) {
  const trimmed = reviewNotes?.trim();
  return apiRequest<unknown>(`/api/hr/shift-swaps/${encodeURIComponent(swapId)}/approve`, {
    method: "PATCH",
    body: { status: "REJECTED" as const, ...(trimmed ? { reviewNotes: trimmed } : {}) },
    token,
    branchId,
  });
}

// ── Quick PIN administration ────────────────────────────────────────────────

/**
 * `GET /hr/frontline-staff/:id/quick-pin-status` — read ON DEMAND, one employee
 * at a time.
 *
 * There is no bulk status endpoint on this backend, so a "status" column filled
 * in for every directory row would be N requests on mount (40 for the seeded
 * org). The Quick-PIN table therefore reads a row's status when that row is
 * selected, and says so on screen. That is a real constraint, disclosed — not a
 * loading spinner hiding a request storm (CLAUDE.md §15).
 */
export async function getManagerQuickPinStatus(
  token: string,
  branchId: string,
  employeeId: string,
): Promise<ManagerQuickPinStatus> {
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/hr/frontline-staff/${encodeURIComponent(employeeId)}/quick-pin-status`,
    { token, branchId },
  );

  // Projected: the response also carries firstName/lastName/phone/email. The
  // directory already has the identity; this surface keeps only PIN facts.
  return {
    employeeId: str(raw.employeeId) || employeeId,
    userId: str(raw.userId),
    pinEnabled: bool(raw.pinEnabled),
    pinExists: bool(raw.pinExists),
    pinIssuedAt: str(raw.pinIssuedAt),
    pinLastResetAt: str(raw.pinLastResetAt),
    pinTier: str(raw.pinTier),
    pinLength: num(raw.pinLength),
    failedPinAttempts: num(raw.failedPinAttempts),
    isLocked: bool(raw.isLocked),
    lockedUntil: str(raw.lockedUntil),
    eligibleForPin: bool(raw.eligibleForPin),
    authMode: str(raw.authMode),
  };
}

function projectOneTimeSecret(raw: unknown): ManagerOneTimeSecret | null {
  const source = (raw || {}) as Record<string, unknown>;
  const value = str(source.pin);
  if (!value) return null;
  return {
    value,
    length: num(source.pinLength),
    tier: str(source.tier),
    note:
      str(source.note) ||
      "Shown once. It cannot be retrieved later — reset the PIN to issue a new one.",
  };
}

/**
 * `POST /hr/frontline-staff/:id/quick-pin/reset` — returns a fresh plaintext PIN
 * ONCE and invalidates the old one immediately.
 *
 * Returned from a mutation, held in component state, rendered masked behind a
 * reveal, copyable once, and dropped when the dialog closes.
 */
export async function resetManagerQuickPin(
  token: string,
  branchId: string,
  employeeId: string,
): Promise<ManagerOneTimeSecret | null> {
  const response = await apiRequest<Record<string, unknown>>(
    `/api/hr/frontline-staff/${encodeURIComponent(employeeId)}/quick-pin/reset`,
    { method: "POST", body: {}, token, branchId },
  );
  return projectOneTimeSecret(response.quickPin);
}

export async function disableManagerQuickPin(token: string, branchId: string, employeeId: string) {
  return apiRequest<{ ok?: boolean; alreadyDisabled?: boolean }>(
    `/api/hr/frontline-staff/${encodeURIComponent(employeeId)}/quick-pin/disable`,
    { method: "PATCH", token, branchId },
  );
}

export async function enableManagerQuickPin(token: string, branchId: string, employeeId: string) {
  return apiRequest<{ ok?: boolean; alreadyEnabled?: boolean }>(
    `/api/hr/frontline-staff/${encodeURIComponent(employeeId)}/quick-pin/enable`,
    { method: "PATCH", token, branchId },
  );
}

// ── Frontline onboarding ────────────────────────────────────────────────────

/**
 * `POST /api/hr/frontline-staff/onboard` — `hr:frontline-staff:create`, 201.
 *
 * The payload is built by `buildManagerOnboardPayload`, which structurally
 * cannot carry `contractId` or `compensationProfileId` (MP0-15). The response is
 * projected here: the created employee's identity and the one-time PIN survive;
 * the raw user/membership/employee objects do not.
 */
export async function onboardManagerFrontlineStaff(
  token: string,
  branchId: string,
  payload: ManagerOnboardPayload,
): Promise<ManagerOnboardResult> {
  const response = await apiRequest<Record<string, unknown>>("/api/hr/frontline-staff/onboard", {
    method: "POST",
    body: payload,
    token,
    branchId,
  });

  const employee = (response.employee || {}) as Record<string, unknown>;
  const membership = (response.membership || {}) as Record<string, unknown>;
  const quickPin = projectOneTimeSecret(response.quickPin);
  const authMode = str(response.authMode);

  return {
    employeeId: str(employee.id),
    employeeCode: str(employee.employeeCode),
    displayName: `${payload.firstName} ${payload.lastName}`.trim(),
    roleName: str(membership.roleName) || payload.roleName,
    authMode,
    quickPin,
    instructions: managerOnboardingInstructions(authMode, Boolean(quickPin)),
  };
}

export type { ManagerSafeEmployee };
