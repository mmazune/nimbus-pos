// RELATIVE imports on purpose — `scripts/manager-b3-assertions.ts` executes this
// module directly under `tsx`, which does not resolve the `@/` alias.
import type { ManagerSafeEmployee } from "./staff-projection";
import type { ManagerStatusTone } from "./operations-model";
import { titleCaseManagerStatus } from "./operations-model";

/**
 * Manager Staff — pure model (Track B3). No React, no network, no aliases.
 */

export const MANAGER_STAFF_VIEWS = ["kanban", "list"] as const;
export type ManagerStaffView = (typeof MANAGER_STAFF_VIEWS)[number];

/** Mirrors Prisma's `EmployeeStatus` — never a superset. */
export const MANAGER_EMPLOYEE_STATUS_FILTERS = [
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "TERMINATED",
] as const;

/** Mirrors Prisma's `LeaveRequestStatus`. */
export const MANAGER_LEAVE_STATUS_FILTERS = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

/** Mirrors Prisma's `ShiftSwapStatus`. */
export const MANAGER_SHIFT_SWAP_STATUS_FILTERS = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

/**
 * The employment pipeline shown on the C14 statusbar of a staff record.
 *
 * Odoo's employee statusbar reads `Invited ▸ Confirmed`. **Nimbus has no
 * invite-by-email flow at all** (NG-08) — staff are created directly with a
 * Quick PIN — so borrowing that pipeline would show a stage that does not exist.
 * These are the real `EmployeeStatus` values a record moves through.
 * `TERMINATED` is an exit, not a stage, and renders as an exit chip.
 */
export const MANAGER_EMPLOYEE_PIPELINE = ["ACTIVE", "ON_LEAVE", "SUSPENDED"] as const;

export function managerEmployeePipelineIndex(status: string) {
  return MANAGER_EMPLOYEE_PIPELINE.indexOf(
    status.toUpperCase() as (typeof MANAGER_EMPLOYEE_PIPELINE)[number],
  );
}

export function managerEmployeeStatusTone(status: string): ManagerStatusTone {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "success";
    case "ON_LEAVE":
      return "warning";
    case "SUSPENDED":
    case "TERMINATED":
      return "danger";
    default:
      return "neutral";
  }
}

export function managerReviewStatusTone(status: string): ManagerStatusTone {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "CANCELLED":
      return "neutral";
    default:
      return "warning";
  }
}

/** Terminal review states cannot be decided again — the backend 400s on a retry. */
export function isManagerReviewDecidable(status: string) {
  return status.toUpperCase() === "PENDING";
}

// ── Directory filtering ─────────────────────────────────────────────────────

/**
 * The client-side branch filter.
 *
 * `GET /hr/employees` is **organization-scoped and rejects `?branchId=`** with a
 * 400 (MP0-06 / C-09) — there is no server-side branch filter to call. So the
 * directory reads the organization and narrows here, and the UI states that
 * plainly. Employees with a NULL `branchId` are org-level records and are
 * excluded from a branch view rather than silently attributed to it.
 */
export function filterManagerEmployeesByBranch(
  employees: readonly ManagerSafeEmployee[],
  branchId: string | null,
) {
  if (!branchId) return [...employees];
  return employees.filter((employee) => employee.branchId === branchId);
}

export type ManagerDirectoryFacet = {
  key: string;
  label: string;
  count: number;
};

/**
 * The left facet sidebar (Odoo's `DEPARTMENT → All / ▸ Administration 3` panel,
 * screenshot `12`). Nimbus's equivalent grouping is the employee's POSITION,
 * which the safe payload already carries — so no extra request is made, and in
 * particular `GET /hr/positions` is NOT called: it is compensation-adjacent and
 * falls under the locked exclusion (C-19).
 */
export function toManagerDirectoryFacets(
  employees: readonly ManagerSafeEmployee[],
): ManagerDirectoryFacet[] {
  const counts = new Map<string, number>();
  for (const employee of employees) {
    const key = employee.positionTitle || "Unassigned";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function filterManagerEmployeesByFacet(
  employees: readonly ManagerSafeEmployee[],
  facetKey: string | null,
) {
  if (!facetKey) return [...employees];
  return employees.filter((employee) => (employee.positionTitle || "Unassigned") === facetKey);
}

/**
 * The kanban avatar block (screenshot `12`: a solid colour panel with the
 * employee's initial). The colour is derived DETERMINISTICALLY from the employee
 * code so the same person always reads the same, and it uses the four chart
 * tokens Track B2 already added — no new palette, no random colour.
 */
/**
 * Full utility class names, not token fragments: Tailwind's scanner reads
 * `./src/**` for LITERAL class strings, so a composed `bg-${token}` would be
 * purged from the build. Written out, these survive.
 */
export const MANAGER_AVATAR_TOKENS = [
  "bg-chart-series-1",
  "bg-chart-series-2",
  "bg-chart-series-3",
  "bg-chart-series-4",
] as const;

export function managerAvatarToken(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return MANAGER_AVATAR_TOKENS[hash % MANAGER_AVATAR_TOKENS.length];
}

export function managerInitial(employee: ManagerSafeEmployee) {
  return (employee.firstName || employee.lastName || employee.employeeCode || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
}

// ── Frontline onboarding ────────────────────────────────────────────────────

/**
 * The roles this form may create.
 *
 * Only the five true frontline roles are offered. `Supervisor` and `Manager` are
 * technically accepted by the endpoint (they hold an 8-digit PIN tier), but
 * creating an account with approval authority is not "frontline onboarding" and
 * was not part of the approved B3 scope — so they are OMITTED from the picker,
 * not disabled in it. `Event Manager`, `Accountant` and `Procurement` are
 * excluded from Quick PIN entirely on the backend.
 */
export const MANAGER_FRONTLINE_ROLES = [
  { name: "Waiter", description: "Takes orders at the table. 6-digit PIN." },
  { name: "Cashier", description: "Collects payment and runs the till. 6-digit PIN." },
  { name: "Bartender", description: "Bar service. 6-digit PIN." },
  { name: "Chef", description: "Kitchen display and prep. 6-digit PIN." },
  { name: "Stock Manager", description: "Stock counts and receiving. 6-digit PIN." },
] as const;

/** Mirrors Prisma's `EmploymentType` EXACTLY — a value not in this enum 400s. */
export const MANAGER_EMPLOYMENT_TYPES = ["PERMANENT", "TEMPORARY", "CASUAL", "CONTRACTOR"] as const;

export type ManagerOnboardingDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  roleName: string;
  employeeCode: string;
  hireDate: string;
  employmentType: string;
};

export function emptyManagerOnboardingDraft(today: string): ManagerOnboardingDraft {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    roleName: "",
    employeeCode: "",
    hireDate: today,
    employmentType: "PERMANENT",
  };
}

/** Same shape the backend enforces (`@Matches(/^[0-9+()\-\s]{6,30}$/)`). */
const PHONE_PATTERN = /^[0-9+()\-\s]{6,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ManagerOnboardingStepKey = "identity" | "employment" | "review";

export const MANAGER_ONBOARDING_STEPS: readonly {
  key: ManagerOnboardingStepKey;
  label: string;
}[] = [
  { key: "identity", label: "Who they are" },
  { key: "employment", label: "Role and start" },
  { key: "review", label: "Review and create" },
];

/**
 * Validate a step client-side against the SAME rules the DTO enforces, so a
 * manager is told about a bad phone number before a 400 comes back — never
 * instead of the server check.
 */
export function validateManagerOnboardingStep(
  step: ManagerOnboardingStepKey,
  draft: ManagerOnboardingDraft,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (step === "identity") {
    if (!draft.firstName.trim()) errors.firstName = "First name is required.";
    if (draft.firstName.trim().length > 100) errors.firstName = "First name is limited to 100 characters.";
    if (!draft.lastName.trim()) errors.lastName = "Last name is required.";
    if (draft.lastName.trim().length > 100) errors.lastName = "Last name is limited to 100 characters.";
    if (!draft.phone.trim()) errors.phone = "Phone is required — it is the frontline identity.";
    else if (!PHONE_PATTERN.test(draft.phone.trim())) {
      errors.phone = "Use 6-30 characters: digits, spaces and + ( ) - only.";
    }
    if (draft.email.trim() && !EMAIL_PATTERN.test(draft.email.trim())) {
      errors.email = "Enter a valid email, or leave it blank for a PIN-only account.";
    }
  }

  if (step === "employment") {
    if (!draft.roleName) errors.roleName = "Choose the role this person will work.";
    if (!draft.hireDate) errors.hireDate = "A start date is required.";
    else if (Number.isNaN(new Date(draft.hireDate).getTime())) errors.hireDate = "Enter a valid date.";
    if (!(MANAGER_EMPLOYMENT_TYPES as readonly string[]).includes(draft.employmentType)) {
      errors.employmentType = "Choose an employment type.";
    }
    if (draft.employeeCode.trim().length > 50) {
      errors.employeeCode = "Employee code is limited to 50 characters.";
    }
  }

  return errors;
}

/**
 * Build the onboarding request body.
 *
 * ⚠️ **MP0-15.** The nested `employee` object accepts `contractId` and
 * `compensationProfileId`. This function NEVER sets either, and there is no
 * field in `ManagerOnboardingDraft` that could carry one — the exclusion is
 * structural, not a matter of remembering to omit it.
 *
 * `issueQuickPin` is sent EXPLICITLY as `true` rather than relying on the DTO
 * default, so the form's promise ("a PIN will be shown once") matches the
 * request byte for byte. `enablePasswordLogin` is never sent: Manager does not
 * provision passwords (NG-08), and sending it would require a temporary
 * password this form deliberately does not collect.
 */
export function buildManagerOnboardPayload(draft: ManagerOnboardingDraft) {
  const email = draft.email.trim();
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    phone: draft.phone.trim(),
    roleName: draft.roleName,
    issueQuickPin: true,
    ...(email ? { email } : {}),
    employee: {
      hireDate: new Date(draft.hireDate).toISOString(),
      employmentType: draft.employmentType,
      ...(draft.employeeCode.trim() ? { employeeCode: draft.employeeCode.trim() } : {}),
    },
  };
}

export type ManagerOnboardPayload = ReturnType<typeof buildManagerOnboardPayload>;

/**
 * Manager-facing next steps. Built here rather than rendering the backend's
 * `onboardingInstructions`, which name raw endpoints
 * (`POST /api/auth/quick-pin-login`) — accurate for an integrator, meaningless
 * to a floor manager.
 */
export function managerOnboardingInstructions(authMode: string | null, hasPin: boolean) {
  const steps: string[] = [];
  if (hasPin) {
    steps.push("Hand the PIN to them in person now — it cannot be shown again.");
    steps.push("They sign in on a POS terminal with the PIN; no email or password is needed.");
    steps.push("If the PIN is lost, issue a new one from Quick PIN administration.");
  } else {
    steps.push("No PIN was issued. Issue one from Quick PIN administration before their first shift.");
  }
  if (authMode === "PIN_PLUS_PASSWORD") {
    steps.push("This account can also sign in with email and password.");
  }
  return steps;
}

export function formatManagerLeaveWindow(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return "Dates unavailable";
  const format = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };
  return `${format(startsAt)} → ${format(endsAt)}`;
}

export function managerLeaveDayCount(startsAt: string | null, endsAt: string | null) {
  if (!startsAt || !endsAt) return null;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1;
}

export { titleCaseManagerStatus };
