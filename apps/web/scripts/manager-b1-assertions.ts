import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

import { operationalIconNames } from "../src/components/pos-shell/role-icon-config";
import { managerRoutes } from "../src/lib/manager/routes";
import { managerTopNavMenus } from "../src/lib/manager/top-nav";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Manager B1 assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function codeOnly(path: string) {
  return source(path)
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join("\n");
}

// ── Additive shell variant (OD-5): navigation="top"|"bottom", default "bottom" ──
const typesSource = source("apps/web/src/components/pos-shell/types.ts");
assert(typesSource.includes('navigation?: "top" | "bottom"'), "OperationalShellProps carries an optional top|bottom navigation variant");
assert(typesSource.includes("bottomNavigation?: ReactNode"), "bottomNavigation is optional (required only in bottom mode)");

const shellSource = source("apps/web/src/components/pos-shell/OperationalShell.tsx");
assert(shellSource.includes('navigation = "bottom"'), 'OperationalShell defaults navigation to "bottom"');
assert(
  shellSource.includes('navigation === "bottom" ? (') || shellSource.includes('navigation === "top"'),
  "OperationalShell renders the fixed bottom bar only in bottom mode",
);

// ── Frontline shells never opt into top nav and always pass bottomNavigation ──
for (const [role, path] of [
  ["Waiter", "apps/web/src/components/waiter/shell/WaiterShell.tsx"],
  ["Cashier", "apps/web/src/components/cashier/shell/CashierShell.tsx"],
  ["Supervisor", "apps/web/src/components/supervisor/shell/SupervisorShell.tsx"],
] as const) {
  const shell = source(path);
  assert(!shell.includes("navigation="), `${role}Shell passes no navigation prop — it keeps the "bottom" default`);
  assert(shell.includes("bottomNavigation={"), `${role}Shell still passes a real bottomNavigation node`);
  assert(!/OperationalTopNav/.test(shell), `${role}Shell never imports the Manager-only OperationalTopNav`);
}

// ── Manager opts into "top" and passes no bottomNavigation ──────────────────
const managerShellSource = source("apps/web/src/components/manager/shell/ManagerShell.tsx");
assert(managerShellSource.includes('navigation="top"'), 'ManagerShell passes navigation="top"');
assert(!managerShellSource.includes("bottomNavigation={"), "ManagerShell passes no bottomNavigation — the top-nav variant renders none");
assert(managerShellSource.includes("<ManagerTopNav />"), "ManagerShell's header slot renders ManagerTopNav");
assert(!/\bManagerHeader\b/.test(managerShellSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "ManagerShell no longer renders the retired ManagerHeader in code");

// ── The retired M-P1 bottom-nav components are gone, not just unmounted ─────
for (const retired of [
  "apps/web/src/components/manager/shell/ManagerHeader.tsx",
  "apps/web/src/components/manager/shell/ManagerBottomNav.tsx",
]) {
  assert(!existsSync(join(process.cwd(), retired)), `retired M-P1 component removed: ${retired}`);
}

// ── ManagerTopNav is a thin adapter over the SHARED OperationalTopNav — never a fork ──
const managerTopNavSource = source("apps/web/src/components/manager/shell/ManagerTopNav.tsx");
assert(managerTopNavSource.includes("@/components/pos-shell/OperationalTopNav"), "ManagerTopNav consumes the shared OperationalTopNav");
assert(managerTopNavSource.includes("brandHref=\"/manager/overview\""), "the brand/home control targets the Manager landing route");
assert(managerTopNavSource.includes("profileHref=\"/manager/me\""), "the identity menu's My profile targets /manager/me");
assert(managerTopNavSource.includes("branchSwitcher={<ManagerBranchSwitcher />}"), "the branch switcher is carried forward unchanged into the top nav");
assert(!managerTopNavSource.includes("@phosphor-icons/react"), "ManagerTopNav never imports Phosphor directly");

const topNavSharedSource = source("apps/web/src/components/pos-shell/OperationalTopNav.tsx");
assert(!/^import[^;]*@phosphor-icons\/react/m.test(topNavSharedSource), "OperationalTopNav never imports Phosphor directly — icons come from the registry");
for (const iconName of ["time", "logout", "caretDown", "me"] as const) {
  assert(
    topNavSharedSource.includes(`operationalIcons.${iconName}`),
    `OperationalTopNav resolves the "${iconName}" icon through the canonical registry`,
  );
  assert(iconName in operationalIconNames, `"${iconName}" is a canonical registry name`);
}

// ── Full keyboard operation: Escape, outside click, route-change close, roving tabindex ──
const dropdownSource = source("apps/web/src/components/pos-shell/OperationalTopNavDropdown.tsx");
for (const token of ['"Escape"', "mousedown", "routeChangeStart", "ArrowDown", "ArrowUp", "Home", "End"]) {
  assert(dropdownSource.includes(token), `the shared dropdown handles ${token}`);
}
assert(topNavSharedSource.includes("ArrowRight") && topNavSharedSource.includes("ArrowLeft"), "the module bar supports roving-tabindex left/right arrow traversal");
assert(topNavSharedSource.includes('role="menubar"'), "the desktop module bar exposes role=menubar");

// ── Responsive collapse (OD-4): a single menu control below xl, never the frontline bottom nav ──
// The xl (1280px) threshold, not lg (1024px), is deliberate: the full bar (brand lockup + six
// menus + branch switcher + clock + identity) does not reliably fit at the tightest supported
// project (1024x768), so that viewport gets the collapsed control too.
assert(topNavSharedSource.includes("xl:hidden"), "the module bar collapses to a single control below the xl breakpoint");
assert(topNavSharedSource.includes("hidden min-w-0 flex-1 items-center gap-1 xl:flex"), "the full module bar only shows at xl and up, keeping 1024x768 overflow-free");
assert(!/data-operational-bottom-nav/.test(topNavSharedSource), "the collapsed control never falls back to the frontline OperationalBottomNav markup");

// ── The menu tree is derived from the ONE locked six-surface list, not hand-duplicated ──
assert(managerRoutes.length === 6, "managerRoutes still carries exactly six locked surfaces");
assert(managerTopNavMenus.length === 6, "the top-nav menu tree has exactly six top-level menus");
assert(
  managerTopNavMenus.map((menu) => menu.label).join(",") === managerRoutes.map((route) => route.label).join(","),
  "the top-nav menu labels/order match the locked managerRoutes exactly",
);

const overviewMenu = managerTopNavMenus.find((menu) => menu.key === "overview");
const meMenu = managerTopNavMenus.find((menu) => menu.key === "me");
assert(overviewMenu?.href === "/manager/overview" && !overviewMenu?.groups, "Overview is a direct-action menu with no dropdown (roadmap B1(c))");
assert(meMenu?.href === "/manager/me" && !meMenu?.groups, "Me is a direct-action menu with no dropdown (roadmap B1(c))");

const dropdownMenuKeys = ["operations", "staff", "reports", "settings"] as const;

/**
 * The B1 shape was: ONE real link to the module's foundation page, plus an
 * honest not-yet tree naming the phase that would ship each surface.
 *
 * **Track B3 (2026-08-20) superseded that for `operations` and `staff`** — those
 * surfaces are now built, so their trees are real links and the module root is a
 * redirect rather than a foundation page. `reports` and `settings` are untouched
 * and still carry the original B1 shape; they are still checked against it.
 *
 * What this gate protects is unchanged for BOTH shapes and is asserted for every
 * menu below: no dropdown row may be a fake navigation target, and every row that
 * is not yet available must say so.
 */
const B1_FOUNDATION_MENUS = ["reports", "settings"] as const;
const expectedItemCounts: Record<(typeof B1_FOUNDATION_MENUS)[number], number> = {
  reports: 2,
  settings: 6,
};

for (const key of dropdownMenuKeys) {
  const menu = managerTopNavMenus.find((entry) => entry.key === key);
  assert(menu && !menu.href && menu.groups, `${key} is a dropdown menu (roadmap B1(c))`);
  const groups = menu!.groups!;
  const items = groups.flatMap((group) => group.items);

  // Invariant for every menu, in both shapes.
  assert(items.length > 0, `${key} has menu items`);
  assert(
    items.filter((item) => !item.available).every((item) => item.notYetNote),
    `every unavailable ${key} row states that it is not yet available`,
  );
  assert(
    items.filter((item) => item.available).every((item) => item.href.startsWith(`/manager/${key}`)),
    `every available ${key} row points inside its own module`,
  );

  if (!(B1_FOUNDATION_MENUS as readonly string[]).includes(key)) {
    // B3-built module: at least one real surface, and no foundation-page link left.
    assert(
      items.some((item) => item.available),
      `${key} has at least one live surface (superseded by B3)`,
    );
    assert(
      !items.some((item) => item.available && item.href === `/manager/${key}`),
      `${key}'s module root is a redirect, not a menu destination (superseded by B3)`,
    );
    continue;
  }

  // Unchanged B1 foundation shape.
  assert(groups.length === 2, `${key} has exactly two groups: the real dashboard link + the honest not-yet tree`);
  const [realGroup, treeGroup] = groups;
  assert(realGroup.items.length === 1 && realGroup.items[0].available, `${key}'s first group is the one real, clickable link`);
  assert(realGroup.items[0].href === `/manager/${key}`, `${key}'s real link targets the existing /manager/${key} foundation page`);
  assert(
    treeGroup.items.length === expectedItemCounts[key as (typeof B1_FOUNDATION_MENUS)[number]],
    `${key}'s not-yet tree has exactly the items named in the roadmap B1(c) table`,
  );
  assert(
    treeGroup.items.every((item) => !item.available),
    `every ${key} tree item beyond the real link is an honest not-yet row, never a fake navigation target`,
  );
  assert(
    treeGroup.items.every((item) => item.notYetNote),
    `every not-yet ${key} row names the phase that ships it (roadmap traceability)`,
  );
}

// Accounting is explicitly NOT a seventh menu yet (OD-3 is B5-gated, not B1 scope).
assert(!managerTopNavMenus.some((menu) => /accounting/i.test(menu.label)), "Accounting is not added as a menu in B1 (OD-3 is gated on B5)");

// ── Not-yet rows render as inert content, never as a Link to a page they do not own ──
assert(
  topNavSharedSource.includes('role="menuitem"') && topNavSharedSource.includes('aria-disabled="true"'),
  "not-yet items are marked inert (aria-disabled) rather than rendered as functioning links",
);

// ── Manager chrome primitives exist and are exported ────────────────────────
for (const file of [
  "apps/web/src/components/manager/chrome/ManagerControlPanel.tsx",
  "apps/web/src/components/manager/chrome/ManagerBreadcrumbs.tsx",
  "apps/web/src/components/manager/chrome/ManagerContentShell.tsx",
  "apps/web/src/components/manager/chrome/ManagerSearchFilterMenu.tsx",
  "apps/web/src/components/manager/chrome/index.ts",
]) {
  assert(existsSync(join(process.cwd(), file)), `chrome primitive exists: ${file}`);
}

// ── The control-panel pager takes an explicit total — it can never be an array length ──
const controlPanelSource = source("apps/web/src/components/manager/chrome/ManagerControlPanel.tsx");
assert(controlPanelSource.includes("total: number"), "ManagerControlPanelPager declares an explicit numeric total field");
assert(!codeOnly("apps/web/src/components/manager/chrome/ManagerControlPanel.tsx").includes(".length"), "ManagerControlPanel never derives its own count from an array length");

// ── Breadcrumbs primitive ships built but UNMOUNTED (consumed from B3, like the roadmap precedent) ──
const breadcrumbsConsumers: string[] = [];
for (const file of [
  "apps/web/src/components/manager/foundation/ManagerFoundationScreen.tsx",
  "apps/web/src/components/manager/me/ManagerMeScreen.tsx",
  "apps/web/src/components/manager/shell/ManagerTopNav.tsx",
]) {
  if (source(file).includes("ManagerBreadcrumbs")) breadcrumbsConsumers.push(file);
}
assert(breadcrumbsConsumers.length === 0, "ManagerBreadcrumbs is built but not yet mounted anywhere in B1 (no record surface exists to breadcrumb)");

// ── Favorites (NG-11 / OD-7): documented as localStorage/terminal-only, no save-search endpoint ──
const searchFilterSource = source("apps/web/src/components/manager/chrome/ManagerSearchFilterMenu.tsx");
assert(searchFilterSource.includes("Saved on this terminal only"), "Favorites is labelled localStorage/terminal-only per OD-7");
assert(!/\/api\/.*favorite/i.test(searchFilterSource), "ManagerSearchFilterMenu calls no save-search endpoint (none exists — NG-11)");

// ── Pages now render through the manager chrome, not the generic PageShell ──
//
// Track B3 turned Operations and Staff into module DIRECTORIES whose root is a
// redirect, so a nav href may resolve to `<href>.tsx` or `<href>/index.tsx`. The
// B1 invariant is unchanged: every surface a manager lands on renders inside
// `ManagerShell`, so for a module root the check follows the redirect.
function managerPageSources(href: string) {
  const flat = `apps/web/src/pages${href}.tsx`;
  if (existsSync(join(process.cwd(), flat))) return [source(flat)];

  const index = `apps/web/src/pages${href}/index.tsx`;
  assert(existsSync(join(process.cwd(), index)), `a page resolves for ${href}`);
  const dir = join(process.cwd(), `apps/web/src/pages${href}`);
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".tsx") && entry !== "index.tsx")
    .map((entry) => source(`apps/web/src/pages${href}/${entry}`));
}

for (const item of managerRoutes.filter((route) => route.href !== "/manager/me")) {
  const pages = managerPageSources(item.href);
  assert(pages.length > 0, `${item.href} resolves to at least one page`);
  assert(
    pages.every((page) => page.includes("<ManagerShell>")),
    `${item.href} still renders inside ManagerShell`,
  );
}
const foundationSource = source("apps/web/src/components/manager/foundation/ManagerFoundationScreen.tsx");
assert(foundationSource.includes("ManagerControlPanel") && foundationSource.includes("ManagerContentShell"), "foundation pages render through the B1 control-panel + content-shell primitives");
const meScreenSource = source("apps/web/src/components/manager/me/ManagerMeScreen.tsx");
assert(meScreenSource.includes("ManagerControlPanel") && meScreenSource.includes("ManagerContentShell"), "Manager Me renders through the B1 control-panel + content-shell primitives");

// ── No new hard-coded hex — brand tokens only ────────────────────────────────
for (const file of [
  "apps/web/src/components/pos-shell/OperationalTopNav.tsx",
  "apps/web/src/components/pos-shell/OperationalTopNavDropdown.tsx",
  "apps/web/src/components/manager/shell/ManagerTopNav.tsx",
  "apps/web/src/components/manager/chrome/ManagerControlPanel.tsx",
  "apps/web/src/components/manager/chrome/ManagerBreadcrumbs.tsx",
  "apps/web/src/components/manager/chrome/ManagerSearchFilterMenu.tsx",
  "apps/web/src/lib/manager/top-nav.ts",
]) {
  assert(!/#[0-9A-Fa-f]{3,8}\b/.test(source(file)), `${file} hard-codes no hex colour — tokens only`);
}

console.log(
  "Manager B1 assertions passed: additive top|bottom shell variant (default bottom, frontline unchanged), " +
    "ManagerTopNav as a thin adapter over the shared OperationalTopNav, full keyboard operation on the shared " +
    "dropdown, roving-tabindex menubar, OD-4 responsive collapse, the six-menu tree derived from the locked " +
    "managerRoutes with honest not-yet rows matching the roadmap B1(c) table, Accounting NOT added, chrome " +
    "primitives present, a pager that can never be an array length, Favorites correctly localStorage-only, " +
    "breadcrumbs built-but-unmounted, and no hard-coded hex colour.",
);
