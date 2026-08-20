/**
 * Manager Staff — the API-client-boundary ALLOW-LIST projection (Track B3).
 *
 * ## Why this exists even though C-02 landed
 *
 * `GET /hr/employees` is now safe by default: backend gap batch 1 (2026-08-20)
 * stopped selecting `compensationProfile`, `dateOfBirth`, `address`,
 * `emergencyContact*`, private `notes` and free-form `metadata` from Postgres at
 * all. That fixed the biggest leak — but it did **not** fix the others:
 *
 * - `GET /api/hr/leave` embeds a FULL nested `employee` object (`include:
 *   { employee: true, requestedBy: true, reviewedBy: true }`,
 *   `attendance.service.ts:308`) carrying every field C-02 removed from the
 *   employee endpoint.
 * - `GET /api/hr/shift-swaps` does the same for `requester` and `target`
 *   (`attendance.service.ts:544`).
 * - `GET /hr/frontline-staff/:id/quick-pin-status` returns contact PII plus PIN
 *   metadata.
 *
 * A render-time whitelist does not help: the payload is already in the browser,
 * in React state, and — critically — in the React Query cache, where it survives
 * navigation and shows up in a devtools dump. So every Manager Staff response is
 * rebuilt **field by field** here, at the boundary, and the raw object is
 * discarded before it is ever returned to a hook.
 *
 * ## The rule
 *
 * This module is an **ALLOW-LIST, not a deny-list.** Nothing is "removed"; only
 * the named fields are constructed. An endpoint that grows a field tomorrow
 * cannot widen a Manager surface by accident, and `FORBIDDEN_STAFF_KEYS` below
 * is only ever used to PROVE that (in tests and the assertion script), never as
 * the mechanism.
 *
 * No React, no aliases, no network — the assertion script executes this directly.
 */

/** The only employee fields any Manager surface may hold. */
export const SAFE_EMPLOYEE_FIELDS = [
  "id",
  "employeeCode",
  "firstName",
  "lastName",
  "displayName",
  "email",
  "phone",
  "hireDate",
  "status",
  "employmentType",
  "branchId",
  "userId",
  "positionTitle",
  "positionDepartment",
] as const;

/**
 * Keys that must never appear on ANY projected Manager staff object. Mirrors the
 * backend's own `FORBIDDEN_SAFE_EMPLOYEE_KEYS` (`apps/api/src/modules/hr/
 * employee-projection.ts`) and adds the compensation/contract/bank/tax names the
 * locked owner decision excludes from the Manager workspace entirely.
 */
export const FORBIDDEN_STAFF_KEYS = [
  "compensationProfile",
  "compensationProfileId",
  "baseAmount",
  "salaryBasis",
  "salaryAmount",
  "allowances",
  "deductions",
  "contracts",
  "contractId",
  "bankAccount",
  "bankName",
  "taxId",
  "tin",
  "nssf",
  "dateOfBirth",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "notes",
  "metadata",
] as const;

export type ManagerSafeEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  hireDate: string | null;
  status: string;
  employmentType: string;
  branchId: string | null;
  userId: string | null;
  positionTitle: string | null;
  positionDepartment: string | null;
};

/** A name-only identity, for rows that reference an employee they do not own. */
export type ManagerStaffIdentity = {
  id: string | null;
  displayName: string;
  employeeCode: string | null;
};

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isoString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return null;
}

function joinName(first: unknown, last: unknown, fallback: string) {
  const name = [str(first), str(last)].filter(Boolean).join(" ").trim();
  return name || fallback;
}

/**
 * Build a `ManagerSafeEmployee` from any employee-shaped payload — the directory
 * list row, or the nested `employee` a leave/swap row embeds. Both go through
 * this one function, so a Manager surface cannot end up with two different ideas
 * of what "safe" means.
 */
export function projectManagerEmployee(raw: unknown): ManagerSafeEmployee {
  const source = (raw || {}) as Record<string, unknown>;
  const position = (source.position || null) as Record<string, unknown> | null;

  return {
    id: str(source.id) || "",
    employeeCode: str(source.employeeCode) || "",
    firstName: str(source.firstName) || "",
    lastName: str(source.lastName) || "",
    displayName: joinName(source.firstName, source.lastName, str(source.employeeCode) || "Employee"),
    // Work contact only — the same values `/api/auth/me` and the operational
    // staff pickers already expose. Never a home address or a next-of-kin number.
    email: str(source.email),
    phone: str(source.phone),
    hireDate: isoString(source.hireDate),
    status: (str(source.status) || "UNKNOWN").toUpperCase(),
    employmentType: (str(source.employmentType) || "UNKNOWN").toUpperCase(),
    branchId: str(source.branchId),
    userId: str(source.userId),
    // Position carries no salary of any kind (`Position` model: code, title,
    // department, level, description, active) — verified against the schema.
    positionTitle: position ? str(position.title) : null,
    positionDepartment: position ? str(position.department) : null,
  };
}

/** Name + code only. Used wherever a row merely references a person. */
export function projectManagerStaffIdentity(raw: unknown): ManagerStaffIdentity {
  const source = (raw || {}) as Record<string, unknown>;
  return {
    id: str(source.id),
    displayName: joinName(source.firstName, source.lastName, str(source.employeeCode) || "Unknown"),
    employeeCode: str(source.employeeCode),
  };
}

/**
 * Assert a projected object carries no forbidden key. Exported so the unit-style
 * assertion script and the e2e DOM proof check the SAME list the projection is
 * written against, instead of two lists drifting apart.
 */
export function findForbiddenStaffKeys(value: unknown, path = "$"): string[] {
  const found: string[] = [];

  function walk(node: unknown, at: string) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${at}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if ((FORBIDDEN_STAFF_KEYS as readonly string[]).includes(key)) found.push(`${at}.${key}`);
      walk(child, `${at}.${key}`);
    }
  }

  walk(value, path);
  return found;
}
