/**
 * Manager Staff routing + URL state (Track B3).
 *
 * Mirrors `operations-route.ts`: every scope/filter/page/selection lives in the
 * URL so refresh, Back and Forward restore the same view, and every value read
 * back out is validated against the backing endpoint's own enum.
 */
import {
  MANAGER_EMPLOYEE_STATUS_FILTERS,
  MANAGER_LEAVE_STATUS_FILTERS,
  MANAGER_SHIFT_SWAP_STATUS_FILTERS,
  MANAGER_STAFF_VIEWS,
} from "./staff-model";
import type { ManagerStaffView } from "./staff-model";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerPage,
  type ManagerQueryValue,
} from "./operations-route";

export const MANAGER_STAFF_ROUTES = {
  directory: "/manager/staff/directory",
  onboarding: "/manager/staff/onboarding",
  quickPin: "/manager/staff/quick-pin",
  leave: "/manager/staff/leave",
  shiftSwaps: "/manager/staff/shift-swaps",
} as const;

export const MANAGER_STAFF_LANDING = MANAGER_STAFF_ROUTES.directory;

export { buildManagerListQuery, firstManagerQueryValue, readManagerPage };

function readEnum<T extends string>(value: ManagerQueryValue, allowed: readonly T[]): T | null {
  const raw = firstManagerQueryValue(value)?.toUpperCase();
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function readManagerEmployeeStatus(value: ManagerQueryValue) {
  return readEnum(value, MANAGER_EMPLOYEE_STATUS_FILTERS);
}

export function readManagerLeaveStatus(value: ManagerQueryValue) {
  return readEnum(value, MANAGER_LEAVE_STATUS_FILTERS);
}

export function readManagerShiftSwapStatus(value: ManagerQueryValue) {
  return readEnum(value, MANAGER_SHIFT_SWAP_STATUS_FILTERS);
}

export function readManagerStaffView(value: ManagerQueryValue): ManagerStaffView {
  const raw = firstManagerQueryValue(value)?.toLowerCase();
  return (MANAGER_STAFF_VIEWS as readonly string[]).includes(raw || "")
    ? (raw as ManagerStaffView)
    : "kanban";
}

/**
 * Whether the directory is scoped to the selected branch (default) or shows the
 * whole organization.
 *
 * This exists because `GET /hr/employees` is **org-scoped and rejects
 * `?branchId=`** (400, MP0-06 / C-09). The branch view is therefore a CLIENT
 * filter over an org read, and the UI says so — otherwise the branch switcher
 * would look broken on the one Manager surface it cannot drive server-side.
 */
export function readManagerDirectoryScope(value: ManagerQueryValue): "branch" | "organization" {
  return firstManagerQueryValue(value) === "organization" ? "organization" : "branch";
}
