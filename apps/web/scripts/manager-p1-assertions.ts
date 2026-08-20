import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { operationalIconNames } from "../src/components/pos-shell/role-icon-config";
import { operationalRoleNavigation } from "../src/components/pos-shell/role-navigation";
import { getManagerLandingPath, isManagerCompatible } from "../src/lib/auth/role";
import {
  MANAGER_BRANCH_STORAGE_KEY,
  resolveManagerBranchId,
  toManagerBranchOptions,
} from "../src/lib/manager/branch-model";
import {
  isManagerSurfaceAllowed,
  managerExcludedSurfaces,
  managerSurfaces,
} from "../src/lib/manager/permissions";
import { MANAGER_LANDING_ROUTE } from "../src/lib/manager/routes";
import { MANAGER_QUERY_NAMESPACE, managerQueryKey } from "../src/lib/manager/state";
import { roleAccentMap } from "../src/lib/profile/profile-model";
import type { OperationalNavItem } from "../src/components/pos-shell/types";
import type { AuthMeResponse } from "../src/lib/auth/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Manager M-P1 assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function labels(items: readonly OperationalNavItem[]) {
  return items.map((item) => item.label).join(",");
}

const { manager, cashier, supervisor, waiter } = operationalRoleNavigation;

// ── Navigation: exactly six items in the locked order ──────────────────────
assert(manager.length === 6, "Manager nav has exactly six items");
assert(
  labels(manager) === "Overview,Operations,Staff,Reports,Settings,Me",
  "Manager nav is exactly Overview, Operations, Staff, Reports, Settings, Me in that order",
);
assert(!manager.some((item) => /^more$/i.test(item.label)), "There is no More tab");
assert(
  !manager.some((item) => /^approvals$/i.test(item.label) || item.href === "/manager/approvals"),
  "There is no Approvals tab (approvals integrate into Overview/Operations/Staff)",
);
assert(
  manager.every((item) => item.href.startsWith("/manager/")),
  "Every Manager nav href is under /manager/",
);

// ── Icons resolve through the canonical registry only ──────────────────────
const expectedIcons = ["overview", "operations", "staff", "reports", "settings", "me"] as const;
manager.forEach((item, index) => {
  assert(
    item.icon === operationalIconNames[expectedIcons[index]],
    `Manager nav item ${item.label} uses the canonical "${expectedIcons[index]}" icon name`,
  );
});
const routesSource = source("apps/web/src/lib/manager/routes.ts");
assert(
  !routesSource.includes("@phosphor-icons/react"),
  "Manager routes never import Phosphor directly — icons come from the registry by name",
);
const iconsSource = source("apps/web/src/components/pos-shell/role-icons.ts");
for (const binding of [
  "overview: ChartLineUp",
  "operations: ListChecks",
  "staff: UsersThree",
  "reports: FileText",
  "settings: GearSix",
  "caretDown: CaretDown",
]) {
  assert(iconsSource.includes(binding), `role-icons.ts binds ${binding}`);
}

// ── Landing + redirect ─────────────────────────────────────────────────────
assert(getManagerLandingPath() === "/manager/overview", "Manager login landing route is /manager/overview");
assert(MANAGER_LANDING_ROUTE === "/manager/overview", "MANAGER_LANDING_ROUTE is /manager/overview");
const managerIndex = source("apps/web/src/pages/manager/index.tsx");
assert(managerIndex.includes('destination: "/manager/overview"'), "/manager redirects to /manager/overview");
assert(managerIndex.includes("permanent: false"), "/manager redirect is non-permanent");

// ── Every nav route has a real page ────────────────────────────────────────
//
// Track B3 (2026-08-20) turned Operations and Staff into MODULES with real
// sub-routes, so their nav href now resolves to `pages/manager/<module>/index.tsx`
// rather than a single `pages/manager/<module>.tsx`. The M-P1 invariant this
// check exists to protect is unchanged and still enforced below: no navigation
// entry may point at a route that does not resolve, and every surface a manager
// actually lands on renders inside `ManagerShell`. A module index is allowed to
// be a redirect (it owns no chrome of its own), so it is required to send the
// manager to a route that DOES render the shell.
for (const item of manager) {
  const flatPage = `apps/web/src/pages${item.href}.tsx`;
  const indexPage = `apps/web/src/pages${item.href}/index.tsx`;
  const isFlat = existsSync(join(process.cwd(), flatPage));
  const isModule = existsSync(join(process.cwd(), indexPage));
  assert(isFlat || isModule, `page exists for ${item.href} (${flatPage} or ${indexPage})`);

  if (isFlat) {
    assert(source(flatPage).includes("<ManagerShell>"), `${item.href} renders inside ManagerShell`);
    continue;
  }

  const moduleIndex = source(indexPage);
  const destination = moduleIndex.match(/destination:\s*([A-Z_]+|["'][^"']+["'])/)?.[1];
  assert(destination, `${item.href} module index redirects somewhere concrete`);
  assert(moduleIndex.includes("permanent: false"), `${item.href} module redirect is non-permanent`);

  // Prove the redirect target is a real page that renders the shell.
  const landingConstants: Record<string, string> = {
    MANAGER_OPERATIONS_LANDING: "/manager/operations/orders",
    MANAGER_STAFF_LANDING: "/manager/staff/directory",
    // Track B4 converts Reports to a module the same way B3 converted
    // Operations and Staff. The invariant this file protects is unchanged —
    // the locked surface must still resolve to a real page inside the shell.
    MANAGER_REPORTS_LANDING: "/manager/reports/catalog",
  };
  const landing = landingConstants[destination as string] || (destination as string).replace(/["']/g, "");
  const landingPage = `apps/web/src/pages${landing}.tsx`;
  assert(existsSync(join(process.cwd(), landingPage)), `${item.href} redirects to a real page (${landingPage})`);
  assert(
    source(landingPage).includes("<ManagerShell>"),
    `${item.href}'s landing route renders inside ManagerShell`,
  );
}

// ── Role compatibility helper ──────────────────────────────────────────────
function fakeUser(role: { name?: string; jobRole?: string | null }): AuthMeResponse {
  return {
    id: "u1",
    email: "person@example.test",
    roles: [{ id: "r1", name: role.name || "Role", jobRole: role.jobRole ?? null }],
    permissions: [],
    memberships: [],
    context: {
      organizationCount: 1,
      branchCount: 1,
      requiresContextSelection: false,
      defaultOrganizationId: "org1",
      defaultBranchId: "b1",
      defaultMembershipId: "m1",
    },
    session: null,
  };
}
assert(isManagerCompatible(fakeUser({ jobRole: "MANAGER", name: "Manager" })), "jobRole MANAGER is manager-compatible");
assert(isManagerCompatible(fakeUser({ name: "Manager" })), "roleName Manager is manager-compatible");
assert(!isManagerCompatible(fakeUser({ jobRole: "SUPERVISOR", name: "Supervisor" })), "Supervisor is not manager-compatible");
assert(!isManagerCompatible(fakeUser({ jobRole: "CASHIER", name: "Cashier" })), "Cashier is not manager-compatible");
assert(!isManagerCompatible(null), "null user is not manager-compatible");
const roleSource = source("apps/web/src/lib/auth/role.ts");
// The doc comment names the retired enum; the assertion targets real usage of it.
assert(
  !roleSource.includes('"BRANCH_MANAGER"'),
  "no BRANCH_MANAGER role value is reintroduced (MANAGER-GAP-002)",
);

// ── permissions.ts is a SURFACE ALLOW-LIST, not a permission check (GO cond. 1) ──
const permissionsSource = source("apps/web/src/lib/manager/permissions.ts");
// Comment lines are stripped: the module DOCUMENTS why it is not a permission check,
// so the ban applies to executable code only.
const permissionsCode = permissionsSource
  .split("\n")
  .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
  .join("\n");
for (const token of ["hasPermission(", "user.permissions", "permissions.includes("]) {
  assert(
    !permissionsCode.includes(token),
    `manager permissions module performs no permission lookup ("${token}") — GO condition 1`,
  );
}
assert(
  permissionsSource.includes("ALLOW-LIST") && permissionsSource.includes("WHY THIS IS NOT A PERMISSION CHECK"),
  "manager permissions module documents why it is an allow-list",
);
assert(managerSurfaces.length === 6, "the surface allow-list has exactly six surfaces");
assert(
  managerSurfaces.map((surface) => surface.key).join(",") === "overview,operations,staff,reports,settings,me",
  "allow-listed surfaces match the six nav tabs",
);
assert(isManagerSurfaceAllowed("overview") && isManagerSurfaceAllowed("me"), "nav surfaces are allowed");
assert(
  managerExcludedSurfaces.some((surface) => /compensation/i.test(surface.label)),
  "compensation/contracts/payroll is declared an excluded surface",
);
assert(
  managerExcludedSurfaces.some((surface) =>
    (surface.permissions as readonly string[]).includes("approvals:decide"),
  ),
  "the held approvals:decide permission is declared excluded, not exposed",
);

// ── Branch context: storage key, resolution order, narrow invalidation ─────
assert(
  MANAGER_BRANCH_STORAGE_KEY === "nimbus.managerBranchId",
  "manager branch persists under nimbus.managerBranchId (station-key naming pattern)",
);
const loginSource = source("apps/web/src/pages/login.tsx");
assert(
  loginSource.includes('STATION_BRANCH_KEY = "nimbus.stationBranchId"'),
  "the station branch key is untouched — the manager switcher must not repoint the terminal's PIN branch",
);
const branchContextSource = source("apps/web/src/lib/manager/branch-context.ts");
const branchContextCode = branchContextSource
  .split("\n")
  .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
  .join("\n");
assert(!branchContextCode.includes("queryClient.clear()"), "branch switching never clears the whole query cache");
assert(
  /invalidateQueries\(\{\s*queryKey: \[MANAGER_QUERY_NAMESPACE\],?/.test(branchContextSource),
  "branch switching invalidates only the manager query namespace (MANAGER-GAP-016)",
);
// Track B2: the invalidation must not refetch the OUTGOING branch's keys — it ran
// while the observers still held them, costing one wasted request per manager query.
assert(
  /refetchType: "none"/.test(branchContextCode),
  "branch switching marks the manager namespace stale without refetching the branch being left",
);
assert(MANAGER_QUERY_NAMESPACE === "manager", "manager query namespace is 'manager'");
assert(
  JSON.stringify(managerQueryKey("devices", "b2")) === JSON.stringify(["manager", "devices", "b2"]),
  "manager query keys carry the active branch id",
);

const memberships = [
  { id: "m1", organizationId: "o1", organizationName: "Org", branchId: "b1", branchName: "Tapas Downtown", status: "ACTIVE", isDefaultBranch: true },
  { id: "m2", organizationId: "o1", organizationName: "Org", branchId: "b2", branchName: "Rooftop Bar", status: "ACTIVE" },
  { id: "m3", organizationId: "o1", organizationName: "Org", branchId: "b3", branchName: "Closed Branch", status: "INACTIVE" },
];
const multiBranchUser = {
  ...fakeUser({ jobRole: "MANAGER", name: "Manager" }),
  memberships,
  context: {
    organizationCount: 1,
    branchCount: 3,
    requiresContextSelection: true,
    defaultOrganizationId: "o1",
    defaultBranchId: "b1",
    defaultMembershipId: "m1",
  },
} as AuthMeResponse;
const options = toManagerBranchOptions(multiBranchUser);
assert(options.length === 2, "only ACTIVE memberships become branch options");
assert(!options.some((option) => option.branchId === "b3"), "an INACTIVE membership is not switchable");
assert(resolveManagerBranchId(options, "b2", "b1") === "b2", "a stored branch wins when it is still a membership");
assert(resolveManagerBranchId(options, "b9", "b1") === "b1", "an unknown stored branch falls back to the default branch");
assert(resolveManagerBranchId(options, null, null) === "b1", "with no stored/default branch the default-flagged membership wins");
assert(resolveManagerBranchId([], "b1", "b1") === null, "no memberships resolves to no branch (fail-closed)");

// ── Shell composition: thin adapters over the shared shell, no fork ────────
// NOTE (Track B1, 2026-08-20): `ManagerHeader.tsx` and `ManagerBottomNav.tsx`
// were RETIRED — the top-nav conversion replaced them with `ManagerTopNav`,
// a thin adapter over the new shared `OperationalTopNav` (see
// `manager-b1-assertions.ts`). This section is updated to match; the "no
// manager fork of a shared component" invariant continues to hold — see
// `docs/DECISIONS.md` D-MGRTOPNAV for the recorded change.
const shellSource = source("apps/web/src/components/manager/shell/ManagerShell.tsx");
for (const shared of [
  "@/components/pos-shell/OperationalShell",
  "@/components/pos-shell/OperationalIdleLogoutHandler",
]) {
  assert(shellSource.includes(shared), `ManagerShell consumes the shared ${shared}`);
}
assert(shellSource.includes("<ManagerSessionGuard>"), "ManagerShell wraps the manager session guard");
assert(shellSource.includes("<ManagerBranchProvider>"), "ManagerShell mounts the branch provider");
assert(
  source("apps/web/src/components/manager/shell/ManagerTopNav.tsx").includes(
    "@/components/pos-shell/OperationalTopNav",
  ),
  "ManagerTopNav is a thin adapter over the shared OperationalTopNav",
);
for (const forbidden of [
  "apps/web/src/components/manager/shell/ManagerOperationalShell.tsx",
  "apps/web/src/components/manager/shell/OperationalShell.tsx",
  "apps/web/src/components/manager/shell/OperationalHeader.tsx",
  "apps/web/src/components/manager/shell/OperationalTopNav.tsx",
  "apps/web/src/components/manager/shell/ManagerIdleLogoutHandler.tsx",
  "apps/web/src/components/manager/floor/OperationalFloor.tsx",
  "apps/web/src/components/manager/floor/ManagerTableCard.tsx",
]) {
  assert(!existsSync(join(process.cwd(), forbidden)), `no manager fork of a shared component: ${forbidden}`);
}

// ── The branch switcher is in the top nav, sourced from memberships ────────
const switcherSource = source("apps/web/src/components/manager/shell/ManagerBranchSwitcher.tsx");
const switcherCode = switcherSource
  .split("\n")
  .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
  .join("\n");
assert(switcherSource.includes("<select"), "the branch switcher is a native, accessible select");
assert(switcherSource.includes("Active branch"), "the branch switcher carries an accessible label");
assert(switcherSource.includes("useManagerBranch"), "the branch switcher drives the manager branch context");
assert(
  !switcherCode.includes("/api/branches"),
  "the branch switcher costs no extra request — it reads me.memberships",
);
assert(
  source("apps/web/src/components/manager/shell/ManagerTopNav.tsx").includes("branchSwitcher={<ManagerBranchSwitcher />}"),
  "the branch switcher is mounted in the top-nav's branch switcher slot",
);

// ── The shared header slot is OPTIONAL: frontline roles are unchanged ──────
const headerSource = source("apps/web/src/components/pos-shell/OperationalHeader.tsx");
assert(headerSource.includes("branchSwitcher ? ("), "the shared header renders the switcher slot only when provided");
for (const [role, path] of [
  ["Cashier", "apps/web/src/components/cashier/shell/CashierHeader.tsx"],
  ["Supervisor", "apps/web/src/components/supervisor/shell/SupervisorHeader.tsx"],
  ["Waiter", "apps/web/src/components/waiter/shell/WaiterHeader.tsx"],
] as const) {
  assert(!source(path).includes("branchSwitcher"), `${role} header passes no switcher — its header is unchanged`);
  assert(source(path).includes("@/components/pos-shell/OperationalHeader"), `${role} header still consumes the shared bottom-nav-era OperationalHeader unchanged`);
}

// ── Existing role navigation is untouched ─────────────────────────────────
assert(labels(waiter) === "Floor,Reservations,Me", "Waiter nav is unchanged (Floor, Reservations, Me)");
assert(labels(cashier) === "Floor,Till,Me", "Cashier nav is unchanged (Floor, Till, Me)");
assert(labels(supervisor) === "Floor,Reservations,Approvals,Me", "Supervisor nav is unchanged");
assert(Object.keys(operationalRoleNavigation).length === 4, "the nav registry has exactly four roles");

// ── Login routing + blocked copy ──────────────────────────────────────────
assert(loginSource.includes("getManagerLandingPath()"), "login routes manager-compatible users to the manager landing path");
assert(loginSource.includes("isManagerCompatible(me)"), "login evaluates manager compatibility after authentication");
assert(
  loginSource.includes("waiter, cashier, supervisor, and manager workspaces only."),
  "the blocked message names all four supported workspaces",
);
assert(loginSource.includes('case "manager_only":'), "login explains the manager_only redirect reason");
assert(
  source("apps/web/src/components/manager/shell/ManagerSessionGuard.tsx").includes("/login?reason=manager_only"),
  "the manager guard sends non-manager users to /login?reason=manager_only",
);

// ── Role accent token (4th navy-family accent) ────────────────────────────
assert(roleAccentMap.manager?.heroClassName === "bg-role-manager text-text-inverse", "manager role accent is registered");
const globals = source("apps/web/src/styles/globals.css");
assert(globals.includes("--color-role-manager: oklch(0.36 0.06 324)"), "the manager accent token is defined in globals.css");
assert(globals.includes("--color-role-manager-soft: oklch(0.965 0.015 324)"), "the manager soft accent token is defined");
const tailwind = source("apps/web/tailwind.config.ts");
assert(tailwind.includes('manager: "var(--color-role-manager)"'), "tailwind maps the manager accent token");

// ── No fake data anywhere in the foundation pages ─────────────────────────
const foundationSource = source("apps/web/src/components/manager/foundation/ManagerFoundationScreen.tsx");
for (const token of ["UGX ", "0.00", "Sample", "Lorem", "placeholder data", "TODO", "Coming soon"]) {
  assert(!foundationSource.includes(token), `the foundation screen fabricates nothing ("${token}")`);
}
// Track B2 (2026-08-20): /manager/overview graduated from the honest foundation
// screen to the real KPI dashboard — its invariants live in
// `manager-b2-assertions.ts`.
// Track B3 (2026-08-20): /manager/operations and /manager/staff graduated the
// same way, into modules of real surfaces — their invariants live in
// `manager-b3-assertions.ts`.
// Track B4 (2026-08-20): /manager/reports graduated into a module of two real
// surfaces — its invariants live in `manager-b4-assertions.ts`.
//
// What remains true, and is what this check now proves: every surface that is
// still NOT built renders the honest foundation screen rather than an empty page
// or fabricated data. One is left — Settings (B6).
const BUILT_MANAGER_SURFACES = [
  "/manager/me",
  "/manager/overview",
  "/manager/operations",
  "/manager/staff",
  "/manager/reports",
];
const foundationRoutes = manager.filter((navItem) => !BUILT_MANAGER_SURFACES.includes(navItem.href));
assert(foundationRoutes.length === 1, "one Manager surface still ships the honest foundation screen");
for (const item of foundationRoutes) {
  const page = source(`apps/web/src/pages${item.href}.tsx`);
  assert(page.includes("ManagerFoundationScreen"), `${item.href} renders the honest foundation screen`);
}
assert(
  source("apps/web/src/pages/manager/overview.tsx").includes("ManagerOverviewDashboard"),
  "/manager/overview renders the Track B2 dashboard",
);

// ── Readiness strip: no unverified chip (GO condition 3) ──────────────────
function codeOnly(path: string) {
  return source(path)
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join("\n");
}
const managerReadCode = `${codeOnly("apps/web/src/lib/manager/context.ts")}\n${codeOnly(
  "apps/web/src/lib/manager/api.ts",
)}`;
for (const forbidden of ["/api/tills", "/api/shifts", "/tills/active", "/shifts/active"]) {
  assert(
    !managerReadCode.includes(forbidden),
    `no manager read touches ${forbidden} — those routes do not exist or are operator-scoped (MP0-02)`,
  );
}
const readinessSource = source("apps/web/src/components/manager/shell/ManagerReadinessStrip.tsx");
for (const chip of ["Tills", "Shifts"]) {
  assert(!readinessSource.includes(`${chip}:`), `the readiness strip has no ${chip} chip in M-P1`);
}

console.log(
  "Manager M-P1 assertions passed: six-tab locked nav, registry icons, /manager→/manager/overview, six pages on the shared shell, manager-compatible login routing, surface allow-list (no permission lookup), branch-context resolution + narrow invalidation, header switcher through the optional shared slot, unchanged Waiter/Cashier/Supervisor nav and headers, manager role accent, and no fabricated data or unverified readiness chip.",
);
