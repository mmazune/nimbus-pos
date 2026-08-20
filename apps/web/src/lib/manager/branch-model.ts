import type { AuthMembership, AuthMeResponse } from "../auth/types";

/**
 * Manager branch model (M-P1, MANAGER-GAP-001) — pure logic, no React.
 *
 * The Manager is the only multi-branch operational role: M-P0 verified the seeded
 * demo account holds **4 ACTIVE memberships**, and that branch-scoped reads really
 * do re-scope (22 `TD-*` tables vs 16 `RB-*`), fail-closed on a non-membership
 * branch (403), an unknown branch (400), and a missing header (400).
 *
 * The selected branch here is the ONLY branch id Manager queries may use. It is NOT
 * `useAuth().branchId` — that is the *default* branch from `/api/auth/me` and never
 * changes. Manager reads pass `branchId` to `apiRequest`, which sets `X-Branch-Id`
 * (`lib/api/client.ts`) — no client change was needed, and the three existing roles
 * keep passing `useAuth().branchId` exactly as before.
 *
 * Persistence: `nimbus.managerBranchId`, matching the existing station key pattern
 * (`nimbus.stationBranchId` in `pages/login.tsx`). A SEPARATE key on purpose — the
 * station key seeds the shared terminal's Quick-PIN branch field, and one manager
 * switching to Rooftop Bar must not silently re-point the next waiter's PIN login.
 *
 * Resolution order (per `managerui.md` §3 step 7): stored branch (if still an ACTIVE
 * membership) → `context.defaultBranchId` → first ACTIVE membership → null.
 */

export const MANAGER_BRANCH_STORAGE_KEY = "nimbus.managerBranchId";

export type ManagerBranchOption = {
  branchId: string;
  branchName: string;
  organizationId: string | null;
  organizationName: string | null;
  currencyCode: string | null;
  isDefaultBranch: boolean;
  membershipId: string | null;
};

function isActiveMembership(membership: AuthMembership) {
  const status = membership.status?.toUpperCase();
  // Missing status is treated as active: the Quick-PIN branch session shape has no
  // membership list at all, and a fail-closed empty switcher would be worse than
  // showing the single branch the session already proved.
  return !status || status === "ACTIVE";
}

export function toManagerBranchOptions(user: AuthMeResponse | null): ManagerBranchOption[] {
  if (!user) return [];

  const seen = new Set<string>();
  const options: ManagerBranchOption[] = [];

  for (const membership of user.memberships.filter(isActiveMembership)) {
    if (!membership.branchId || seen.has(membership.branchId)) continue;
    seen.add(membership.branchId);
    options.push({
      branchId: membership.branchId,
      branchName: membership.branchName || membership.branchSlug || membership.branchId,
      organizationId: membership.organizationId || null,
      organizationName: membership.organizationName || null,
      currencyCode: membership.branchCurrencyCode || null,
      isDefaultBranch: Boolean(
        membership.isDefaultBranch || membership.branchId === user.context.defaultBranchId,
      ),
      membershipId: membership.id || null,
    });
  }

  // A branch-scoped session (Quick PIN) returns no memberships; keep the switcher
  // truthful by listing the one branch the session actually has.
  if (!options.length && user.context.defaultBranchId) {
    options.push({
      branchId: user.context.defaultBranchId,
      branchName: "Active branch",
      organizationId: user.context.defaultOrganizationId,
      organizationName: null,
      currencyCode: null,
      isDefaultBranch: true,
      membershipId: user.context.defaultMembershipId,
    });
  }

  return options;
}

export function resolveManagerBranchId(
  options: readonly ManagerBranchOption[],
  storedBranchId: string | null,
  defaultBranchId: string | null,
) {
  if (!options.length) return null;
  const stored = storedBranchId && options.find((option) => option.branchId === storedBranchId);
  if (stored) return stored.branchId;
  const fallback = defaultBranchId && options.find((option) => option.branchId === defaultBranchId);
  if (fallback) return fallback.branchId;
  const flagged = options.find((option) => option.isDefaultBranch);
  return (flagged || options[0]).branchId;
}

