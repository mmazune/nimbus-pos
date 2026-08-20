import type { ManagerSafeEmployee, ManagerStaffIdentity } from "./staff-projection";

/**
 * Manager Staff — the projected shapes the UI is allowed to see (Track B3).
 *
 * There is deliberately no `*Api` type for the leave / shift-swap / quick-pin
 * responses. Those payloads carry PII that must never be modelled as something
 * the app holds; `staff-api.ts` reads them as `unknown` and hands them straight
 * to the allow-list projection, so there is no type in the codebase that says
 * "a Manager surface may have an employee's address".
 */

export type ManagerEmployeeRow = ManagerSafeEmployee;

export type ManagerDirectoryPage = {
  rows: ManagerEmployeeRow[];
  /** The endpoint's own ORGANIZATION-wide total (it cannot be branch-filtered). */
  organizationTotal: number;
  /** The bound this client sent, so the UI can say when it read a partial set. */
  requestedTake: number;
};

// ── Leave ───────────────────────────────────────────────────────────────────

export type ManagerLeaveRow = {
  id: string;
  employee: ManagerStaffIdentity;
  leaveType: string;
  startsAt: string | null;
  endsAt: string | null;
  reason: string | null;
  status: string;
  requestedByName: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  /** Leave has a NULLABLE branch and is reviewed org-wide — surfaced, not hidden. */
  branchId: string | null;
};

export type ManagerLeavePage = {
  rows: ManagerLeaveRow[];
  total: number;
};

// ── Shift swaps ─────────────────────────────────────────────────────────────

export type ManagerShiftSwapRow = {
  id: string;
  requester: ManagerStaffIdentity;
  target: ManagerStaffIdentity;
  shiftDate: string | null;
  reason: string | null;
  status: string;
  reviewNotes: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  branchId: string | null;
};

export type ManagerShiftSwapPage = {
  rows: ManagerShiftSwapRow[];
  total: number;
};

// ── Quick PIN ───────────────────────────────────────────────────────────────

/**
 * The projected Quick-PIN status. The endpoint returns contact PII alongside the
 * PIN metadata; only the PIN facts survive the boundary, because this surface's
 * job is credential administration, not a second contact card.
 *
 * There is **no `pin` field on this type by design** — `GET
 * /quick-pin-status` never returns the PIN, and modelling one here would invite
 * a future edit to render a value that does not exist.
 */
export type ManagerQuickPinStatus = {
  employeeId: string;
  userId: string | null;
  pinEnabled: boolean;
  pinExists: boolean;
  pinIssuedAt: string | null;
  pinLastResetAt: string | null;
  pinTier: string | null;
  pinLength: number | null;
  failedPinAttempts: number | null;
  isLocked: boolean;
  lockedUntil: string | null;
  eligibleForPin: boolean;
  authMode: string | null;
};

/**
 * A one-time secret. Held in COMPONENT STATE ONLY, for the life of one dialog.
 *
 * It is never returned into a React Query cache, never written to localStorage
 * or sessionStorage, never put in a URL, never logged, and never used as part of
 * a query key. `staff-api.ts` returns it from a mutation (not a query) precisely
 * so React Query has nowhere to keep it.
 */
export type ManagerOneTimeSecret = {
  value: string;
  length: number | null;
  tier: string | null;
  /** Copy explaining that it cannot be retrieved again. */
  note: string;
};

export type ManagerOnboardResult = {
  employeeId: string | null;
  employeeCode: string | null;
  displayName: string;
  roleName: string | null;
  authMode: string | null;
  quickPin: ManagerOneTimeSecret | null;
  instructions: readonly string[];
};
