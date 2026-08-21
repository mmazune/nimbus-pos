import type { AuthMeResponse } from "@/lib/auth/types";

/**
 * Manager surface ALLOW-LIST — M-P1 GO condition 1.
 *
 * ⚠️ WHY THIS IS NOT A PERMISSION CHECK ⚠️
 *
 * M-P0 (`ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md` §12) verified the seeded Manager
 * JWT against the live API: it carries **214 permissions** and **61/61** of the
 * documented Manager API-matrix permission strings are HELD. Crucially it ALSO holds
 * strings the approved MVP explicitly forbids the UI from exposing:
 *
 *   pos:hr:contracts:read, pos:hr:contracts:create, pos:hr:compensation:read,
 *   pos:hr:positions:read, tenancy:membership:manage, devices:status:write,
 *   pos:receipt:read / reprint / send, audit:read, approvals:read, approvals:decide
 *
 * A `hasPermission()`-driven UI would therefore happily open payroll-adjacent and
 * out-of-scope surfaces, because the backend says "yes". **Every Manager MVP
 * restriction is a product/safety constraint, not a permission block.** So the
 * frontend gate is this hand-maintained list of ALLOWED surfaces: a surface renders
 * only when it appears here with `status: "allowed"`, regardless of what the JWT says.
 *
 * Rules for future phases:
 * - Never replace `isManagerSurfaceAllowed()` with a permission lookup.
 * - Adding a surface requires an owner decision recorded in
 *   `MANAGER_APPROVAL_DECISIONS.md`, not merely a permission that happens to be held.
 * - `permissions` below is documentation of the backing route's guard (for the API
 *   matrix), NOT the gate.
 */

export type ManagerSurfaceKey =
  | "overview"
  | "operations"
  | "staff"
  | "reports"
  | "accounting"
  | "settings"
  | "me";

export type ManagerSurfaceStatus = "allowed" | "excluded";

export type ManagerSurface = {
  key: ManagerSurfaceKey;
  label: string;
  route: string;
  status: ManagerSurfaceStatus;
  /**
   * The phase that puts live data behind this surface.
   *
   * Track B2 (2026-08-20) re-tagged the not-yet surfaces from the superseded
   * M-P* numbering to the canonical `ai/ENTERPRISE_UI_ROADMAP.md` Track B phases,
   * so the on-screen badge names the phase that will actually build them — the
   * same phase labels the B1 top-nav tree already shows. `"live"` marks a surface
   * whose data has shipped.
   */
  liveFrom: "live" | "M-P1" | "B2" | "B3" | "B4" | "B6";
  /**
   * Set only where the surface's SCOPE is narrower than "everything this module
   * covers" — rendered as honest disclosure rather than left implicit.
   */
  scopeNote?: string;
  summary: string;
  /** Documentation of the backing guards — never used as the gate. */
  permissions: readonly string[];
};

export const managerSurfaces: readonly ManagerSurface[] = [
  {
    key: "overview",
    label: "Overview",
    route: "/manager/overview",
    status: "allowed",
    liveFrom: "live",
    summary: "Branch command dashboard: KPIs, payment mix, open-order aging, low stock, approval counts.",
    permissions: ["pos:dash:manager:read", "pos:dash:today-summary:read", "pos:dash:stream:read"],
  },
  {
    key: "operations",
    label: "Operations",
    route: "/manager/operations",
    status: "allowed",
    liveFrom: "live",
    summary: "Read-only oversight of tables, orders, and reservations. No checkout, no order entry.",
    permissions: ["pos:floor:read", "pos:table:read", "pos:order:read", "pos:reservation:read"],
  },
  {
    key: "staff",
    label: "Staff",
    route: "/manager/staff",
    status: "allowed",
    liveFrom: "live",
    summary:
      "Safe-field staff directory, frontline onboarding, Quick PIN admin, attendance, leave and shift-swap review.",
    permissions: [
      "pos:hr:employees:read",
      "pos:hr:frontline:onboard",
      "pos:hr:attendance:read",
      "pos:hr:leave:review",
      "pos:hr:shift-swaps:approve",
    ],
  },
  {
    key: "reports",
    label: "Reports",
    route: "/manager/reports",
    status: "allowed",
    liveFrom: "live",
    summary: "Report catalog, generation, history/detail, and export with a truthful unavailable state.",
    permissions: [
      "pos:reports:catalog:read",
      "pos:reports:history:read",
      "pos:reports:exports:read",
      "pos:reports:exports:download",
    ],
  },
  {
    key: "accounting",
    label: "Accounting",
    route: "/manager/accounting",
    status: "allowed",
    liveFrom: "live",
    summary:
      "Read-only accounting overview: receivable and payable aging, ledger and posting health, bank reconciliation status, fiscal period state.",
    scopeNote:
      "READ-ONLY BY PERMISSION, not merely by product choice. The manager role holds 15 accounting read strings and zero writes (PC-01/PC-02), so no create, post, approve, match or close control renders anywhere in this module.",
    // Documentation of the backing guards — never the gate. These are the exact
    // strings the 2026-08-20 permissions cutover granted Manager, re-verified
    // live on 2026-08-21 (26 accounting-family strings on the token, of which
    // these are the ones this module reads through).
    permissions: [
      "accounting:ap:bill:read",
      "accounting:ap:credit-note:read",
      "accounting:ap:recurring:read",
      "accounting:ap:reminder:read",
      "accounting:ar:account:read",
      "accounting:ar:aging:read",
      "accounting:ar:credit-note:read",
      "accounting:ar:invoice:read",
      "finance:budget:read",
      "finance:demand-calendar:read",
      "franchise:forecast:read",
      "pos:accounting:accounts:read",
      "pos:accounting:bank-accounts:read",
      "pos:accounting:bank-statements:read",
      "pos:accounting:cost-centers:read",
      "pos:accounting:journals:read",
      "pos:accounting:period-close-runs:read",
      "pos:accounting:periods:read",
      "pos:accounting:posting-errors:read",
      "pos:accounting:posting-runs:read",
      "pos:accounting:posting-source-maps:read",
      "pos:accounting:reconciliation:read",
      "pos:accounting:tax-config:read",
    ],
  },
  {
    key: "settings",
    label: "Settings",
    route: "/manager/settings",
    status: "allowed",
    liveFrom: "B6",
    summary:
      "Read-only branch profile and device registry; printer routes metadata-only; terminal pairing stub-only.",
    permissions: ["devices:read", "devices:routes:write", "devices:terminals:write"],
  },
  {
    key: "me",
    label: "Me",
    route: "/manager/me",
    status: "allowed",
    liveFrom: "M-P1",
    summary: "Identity, session, branch memberships, and logout — sourced from /api/auth/me only.",
    permissions: [],
  },
];

/**
 * Surfaces the Manager holds permissions for but which the approved MVP EXCLUDES.
 * Rendered as honest disclosure (Me → restricted surfaces); never as an entry point.
 */
export const managerExcludedSurfaces = [
  {
    label: "Compensation, contracts, payroll and pay runs",
    detail:
      "Excluded from the Manager MVP even though the token holds pos:hr:compensation:read and pos:hr:contracts:*. Salary, allowances, deductions, bank details, tax IDs and private HR notes are never presented.",
    permissions: ["pos:hr:compensation:read", "pos:hr:contracts:read", "pos:hr:contracts:create"],
  },
  {
    label: "Generic approvals inbox and decisions",
    detail:
      "approvals:read / approvals:decide are held, but the MVP prefers domain-specific decision routes (Supervisor Option B precedent). Approvals appear as counts and as domain reviews, never as a generic decide button.",
    permissions: ["approvals:read", "approvals:decide"],
  },
  {
    label: "Membership and role administration",
    detail: "tenancy:membership:manage is held but Manager does not administer memberships or roles.",
    permissions: ["tenancy:membership:manage"],
  },
  {
    label: "Receipt administration",
    detail: "Receipt read/reprint/send stay outside the Manager MVP; there is no live send adapter.",
    permissions: ["pos:receipt:read", "pos:receipt:reprint", "pos:receipt:send"],
  },
  {
    label: "Owner, billing and developer surfaces",
    detail: "Owner dashboards (pos:dash:owner:read is NOT held — 403 verified) and SaaS billing are excluded.",
    permissions: ["billing:*", "developer:*"],
  },
  {
    // Track B5.1 replaces the blanket "accounting is excluded" entry above: the
    // 2026-08-20 permissions cutover granted Manager 15 accounting READ strings
    // and deliberately no writes, so accounting is now a live read-only module
    // and it is the WRITES that are the honest exclusion.
    label: "Every accounting write",
    detail:
      "Accounting is readable (Track B5) but not writable: creating or approving a bill, recording a payment, issuing an invoice or receipt, matching a bank reconciliation, posting or reversing a journal, opening/closing/locking a period and creating a budget are all 403 for this role (PC-01). Procurement suggestions are not even readable, because one permission string gates both the read and the review write (PC-02).",
    permissions: ["accounting:*:write", "pos:accounting:*:create", "procurement:advisory:read"],
  },
] as const;

const allowedSurfaceKeys = new Set<ManagerSurfaceKey>(
  managerSurfaces.filter((surface) => surface.status === "allowed").map((surface) => surface.key),
);

/** The gate. Allow-list membership only — deliberately ignores `user.permissions`. */
export function isManagerSurfaceAllowed(key: ManagerSurfaceKey) {
  return allowedSurfaceKeys.has(key);
}

export function getManagerSurface(key: ManagerSurfaceKey) {
  return managerSurfaces.find((surface) => surface.key === key);
}

/**
 * Session-shape guard (NOT a permission check): the Manager workspace needs an
 * organization and at least one ACTIVE branch membership from /api/auth/me.
 */
export function requireManagerContext(user: AuthMeResponse | null) {
  if (!user) {
    return { ok: false, reason: "Session context is unavailable." };
  }

  if (!user.context.defaultOrganizationId) {
    return { ok: false, reason: "Manager workspace needs an organization from /api/auth/me." };
  }

  if (!user.memberships.length && !user.context.defaultBranchId) {
    return { ok: false, reason: "Manager workspace needs at least one branch membership." };
  }

  return { ok: true, reason: null };
}
