import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

import {
  ACCOUNTING_MENU,
  ACCOUNTING_OMITTED_ITEMS,
  accountingMenuItems,
  assertAccountingMenuIsBacked,
} from "../src/lib/accounting/menu";
import {
  ACCOUNTING_DENIED_WRITES,
  ACCOUNTING_ROUTE_REGISTRY,
  ACCOUNTING_WRITE_ROUTE_REGISTRY,
  getAccountingRoute,
  getAccountingWriteRoute,
} from "../src/lib/accounting/route-registry";
import { ACCOUNTING_LANDING, ACCOUNTING_ROOT, ACCOUNTING_ROUTES } from "../src/lib/accounting/routes";
import {
  ACCOUNTING_KPI_BINDINGS,
  AR_AGING_PAGE_SIZE,
  buildTaxConfigWritePayload,
  countActiveReconciliations,
  countCloseRunsByStatus,
  countPeriodsByStatus,
  currentFiscalPeriod,
  FISCAL_PERIOD_STATUSES,
  fiscalPeriodPipelineIndex,
  formatAccountingCount,
  formatAccountingMoney,
  getAccountingKpi,
  getAccountingKpiRoute,
  isArAgingComplete,
  isBudgetArchived,
  isDemandCalendarWindowValid,
  isJournalBalanced,
  isJournalReadableInBranch,
  isPostingSourceMapValid,
  isReconciliationBalanced,
  overdueTotal,
  PERIOD_CLOSE_RUN_STATUS_META,
  reconciliationPipelineIndex,
  RECONCILIATION_PIPELINE,
  sumJournalLineAmounts,
  toAccountingAmount,
  toAccountingCount,
  toApAgingBuckets,
  toArAgingBuckets,
  toFiscalPeriodStatus,
  toPeriodCloseRunStatus,
  unpaginatedCountLabel,
} from "../src/lib/accounting/model";
import { BUDGET_TYPES, DEMAND_CALENDAR_TYPES, PERIOD_CLOSE_RUN_STATUSES } from "../src/lib/accounting/types";
import { managerRoutes } from "../src/lib/manager/routes";
import { managerSurfaces } from "../src/lib/manager/permissions";
import { managerTopNavMenus } from "../src/lib/manager/top-nav";

/**
 * Track B5.1 — Manager ACCOUNTING module static assertions.
 *
 * Encodes the owner's four binding rulings plus the roadmap's own B5 acceptance
 * gates as executable checks:
 *
 *   1. **READ-ONLY** — no POST/PATCH/PUT/DELETE to any accounting route from
 *      `components/manager` or `lib/manager`, and no write affordance at all
 *      (not even a disabled one);
 *   2. **no charting dependency** and no SSE client;
 *   3. **query-key discipline** — every read is branch-scoped, bounded and keyed
 *      under `["manager", …]`;
 *   4. **no fabricated totals** — PC-06's bare arrays are labelled as client
 *      counts and never bound to a pager;
 *
 *   plus: every menu item resolves to a live-verified endpoint Manager can
 *   actually read; no financial statement is offered; every rendered figure is
 *   registry-bound; money goes through the ONE shared UGX formatter; and the
 *   B5-F1 partial-page guard actually fails closed.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Manager B5 assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** Source with comments stripped — a comment must never satisfy a check. */
function codeOnly(path: string) {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

function listFiles(dir: string): string[] {
  const absolute = join(process.cwd(), dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(`${dir}/${entry.name}`)
      : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
        ? [`${dir}/${entry.name}`]
        : [],
  );
}

const WEB = "apps/web";
const ACCOUNTING_LIB_DIR = `${WEB}/src/lib/accounting`;
const ACCOUNTING_COMPONENT_DIR = `${WEB}/src/components/manager/accounting`;
const ACCOUNTING_PAGES_DIR = `${WEB}/src/pages/manager/accounting`;
const MANAGER_COMPONENT_DIR = `${WEB}/src/components/manager`;
const MANAGER_LIB_DIR = `${WEB}/src/lib/manager`;
const MANAGER_PAGES_DIR = `${WEB}/src/pages/manager`;

const accountingLibFiles = listFiles(ACCOUNTING_LIB_DIR);
const accountingComponentFiles = listFiles(ACCOUNTING_COMPONENT_DIR);
const accountingPageFiles = listFiles(ACCOUNTING_PAGES_DIR);
const accountingFiles = [
  ...accountingLibFiles,
  ...accountingComponentFiles,
  ...accountingPageFiles,
  `${MANAGER_LIB_DIR}/accounting-context.ts`,
  `${MANAGER_LIB_DIR}/accounting-surface-queries.ts`,
  `${MANAGER_LIB_DIR}/accounting-route.ts`,
];

const managerTreeFiles = [
  ...listFiles(MANAGER_COMPONENT_DIR),
  ...listFiles(MANAGER_LIB_DIR),
  ...listFiles(MANAGER_PAGES_DIR),
];

assert(accountingLibFiles.length >= 6, `lib/accounting ships its data layer (found ${accountingLibFiles.length})`);
assert(
  accountingComponentFiles.length >= 9,
  `components/manager/accounting ships cards + shared primitives (found ${accountingComponentFiles.length})`,
);
/**
 * Track B5.2 (2026-08-21) added 11 real surfaces (3 Customers, 6 Vendors, 2
 * Reporting) to B5.1's 2 (index redirect + dashboard) — 13 total. Track B5.3
 * (2026-08-21) added 3 more (Bank accounts, Bank statements, Reconciliation)
 * — 16 total. Track B5.4 (2026-08-21) added 4 more (Journal entries, Posting
 * runs, Posting errors, Audit trail) — 20 total. Track B5.5 (2026-08-21)
 * added 2 more (Fiscal periods, Period close runs) — 22 total. Track B5.6
 * (2026-08-22) added the LAST 7 (Budgets, Demand calendar, Forecast, Chart of
 * accounts, Cost centres, Posting source maps, Tax configuration) — 29 total,
 * the full 28-row menu tree plus the index redirect. Exact equality on
 * purpose: a page appearing here with no matching `available:true` menu row
 * below (or vice versa) is exactly the drift this gate exists to catch.
 */
assert(accountingPageFiles.length === 29, `Accounting ships 29 pages (found ${accountingPageFiles.length})`);
assert(
  existsSync(join(process.cwd(), `${MANAGER_LIB_DIR}/accounting-context.ts`)),
  "the Manager-side React Query adapter exists",
);
assert(
  existsSync(join(process.cwd(), `${MANAGER_LIB_DIR}/accounting-surface-queries.ts`)),
  "the Customers/Vendors list+detail React Query adapter exists (B5.2)",
);

// ═══════════════════════════════════════════════════════════════════════════
// 1. RULING 2 — MANAGER ACCOUNTING WAS READ-ONLY THROUGH B5.1–B5.5. NO WRITE
//    AFFORDANCE ANYWHERE EXCEPT THE SEVEN TRACK B5.6 SURFACES PLUS THE EIGHT
//    TRACK B5.7 RETROFIT SURFACES (2026-08-22) — see the B57 allow-list below.
// ═══════════════════════════════════════════════════════════════════════════

const WRITE_METHODS = /method:\s*["'](POST|PATCH|PUT|DELETE)["']/;

/**
 * ⚠️ PERMS-2 (2026-08-21) resolved PC-01/PC-02 — Manager now holds the full
 * accounting read+write permission set. Track B5.6 (2026-08-22) is the first
 * phase authorised to act on it, and it builds EXACTLY seven write-enabled
 * surfaces. Every file below is allow-listed for a write method / mutation /
 * interactive control; every other file in `accountingFiles` and
 * `managerTreeFiles` must stay exactly as write-free as it was through B5.5 —
 * the loops below still enforce that for everything NOT in this list.
 */
const B56_WRITE_ENABLED_FILES = [
  `${ACCOUNTING_LIB_DIR}/write-api.ts`,
  `${ACCOUNTING_LIB_DIR}/route-registry.ts`,
  `${MANAGER_LIB_DIR}/accounting-configuration-queries.ts`,
  `${ACCOUNTING_COMPONENT_DIR}/reporting/BudgetsScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/reporting/DemandCalendarScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/reporting/ForecastScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/configuration/ChartOfAccountsScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/configuration/CostCentresScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/configuration/PostingSourceMapsScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/configuration/TaxConfigScreen.tsx`,
];

/**
 * Track B5.7 (2026-08-22) — the retrofit write pass over B5.1–B5.5's
 * surfaces. `write-api.ts` and `route-registry.ts` are already on the B56
 * list above (both files gained B5.7 additions but stay listed once, not
 * duplicated); this list adds the one new mutation-hook file plus the four
 * screens B5.7 turned write-enabled: posting-error resolve/dismiss, fiscal
 * period create/open/close/lock, bank reconciliation match/skip/complete,
 * and journal reverse. Every other B5.1–B5.5 surface (AR/AP, Bank accounts,
 * Bank statements, journal CREATE, posting-run replay, Posting runs, Audit
 * trail) stays exactly as read-only as it shipped — see
 * `ACCOUNTING_DENIED_WRITES` for what remains deliberately undone.
 */
const B57_WRITE_ENABLED_FILES = [
  `${MANAGER_LIB_DIR}/accounting-transitions-queries.ts`,
  `${ACCOUNTING_COMPONENT_DIR}/review/PostingErrorsScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/closing/FiscalPeriodsScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/bank/ReconciliationScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/core/JournalsScreen.tsx`,
];

const WRITE_ENABLED_FILES = [...B56_WRITE_ENABLED_FILES, ...B57_WRITE_ENABLED_FILES];

for (const file of accountingFiles) {
  if (WRITE_ENABLED_FILES.includes(file)) continue;
  const code = codeOnly(file);
  assert(!WRITE_METHODS.test(code), `${file} issues no write request (this file is not one of the write-enabled Track B5.6/B5.7 surfaces)`);
  assert(!/useMutation/.test(code), `${file} mounts no mutation hook`);
}

/**
 * The whole-tree sweep: no mutation ANYWHERE under `components/manager` or
 * `lib/manager` may target an accounting route UNLESS the file is allow-
 * listed above. B3 established that a Manager mutation must be individually
 * allow-listed; this narrows it further for the accounting block, where the
 * allowed set is now exactly these fifteen files (ten from B5.6, five from
 * B5.7 — `write-api.ts`/`route-registry.ts` counted once each).
 */
const ACCOUNTING_PATH_FRAGMENTS = [
  "/api/accounting",
  "/api/finance",
  "/api/franchise/forecast",
];

for (const file of managerTreeFiles) {
  if (WRITE_ENABLED_FILES.includes(file)) continue;
  const code = codeOnly(file);
  if (!WRITE_METHODS.test(code)) continue;
  for (const fragment of ACCOUNTING_PATH_FRAGMENTS) {
    assert(
      !code.includes(fragment),
      `${file} contains a write AND an accounting path (${fragment}) — only the B5.6/B5.7 write-enabled files may do this`,
    );
  }
}

/**
 * Positive proof, not just an absence: every one of the allow-listed files
 * actually DOES write something — an allow-list entry that never exercises
 * its allowance would be silent scope creep waiting to happen.
 */
for (const file of WRITE_ENABLED_FILES) {
  const code = codeOnly(file);
  const writesOrMutates =
    WRITE_METHODS.test(code) || /useMutation/.test(code) || /use(Create|Update|Refresh|Resolve|Dismiss|Open|Close|Lock|Match|Skip|Complete|Reverse)[A-Za-z]*\(/.test(code);
  assert(writesOrMutates, `${file} is allow-listed as write-enabled but contains no write method, mutation hook, or mutation-hook call — remove it from the allow-list if it no longer needs one`);
}

/** No disabled-button escape hatch either, EXCEPT inside the write-enabled files, which are permitted real interactive controls. */
const accountingComponentSource = accountingComponentFiles
  .filter((file) => !WRITE_ENABLED_FILES.includes(file))
  .map((file) => codeOnly(file))
  .join("\n");
for (const banned of ["<Button", "<IconButton", "onClick=", "type=\"submit\""]) {
  assert(
    !accountingComponentSource.includes(banned),
    `no interactive control (${banned}) renders in a non-write-enabled accounting file — where an Odoo user expects an action on those surfaces, an honest note is shown instead`,
  );
}
/** The full component source, INCLUDING the write-enabled files — used by every check below that is not specifically about the write ban. */
const accountingComponentSourceAll = accountingComponentFiles.map((file) => codeOnly(file)).join("\n");

assert(
  ACCOUNTING_DENIED_WRITES.length >= 6,
  "the denied-write disclosure names every action an accounting workspace normally offers that Manager still cannot do through this UI (down from 8 as of Track B5.7, which surfaced bank-reconciliation match/skip/complete and fiscal-period open/close/lock for real)",
);
assert(
  ACCOUNTING_DENIED_WRITES.some((entry) => /procurement/i.test(entry.label) && /PC-02/.test(entry.finding)),
  "PC-02 (one string gating a read AND a write) is disclosed by name",
);
assert(
  accountingComponentSource.includes("ACCOUNTING_DENIED_WRITES"),
  "the disclosure panel is generated from the same list this script checks, so prose and guard cannot drift",
);

// The registry itself must contain no write route — a write entry would invite one.
for (const entry of ACCOUNTING_ROUTE_REGISTRY) {
  assert(entry.method === "GET", `${entry.key} is a GET route (the registry carries reads only)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. NO CHARTING DEPENDENCY, NO SSE
// ═══════════════════════════════════════════════════════════════════════════

const webPackageJson = JSON.parse(source(`${WEB}/package.json`)) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const allDeps = {
  ...(webPackageJson.dependencies || {}),
  ...(webPackageJson.devDependencies || {}),
};
const CHART_PACKAGES = [
  "recharts",
  "chart.js",
  "react-chartjs-2",
  "victory",
  "nivo",
  "@nivo/core",
  "d3",
  "apexcharts",
  "react-apexcharts",
  "echarts",
  "plotly.js",
  "visx",
  "@visx/visx",
];
for (const pkg of CHART_PACKAGES) {
  assert(!(pkg in allDeps), `no charting dependency was added (${pkg}) — the marks are hand-rolled SVG, per B2`);
}

const accountingSource = accountingFiles.map((file) => codeOnly(file)).join("\n");
for (const banned of ["EventSource", "text/event-stream", "new WebSocket"]) {
  assert(
    !accountingSource.includes(banned),
    `the accounting module contains no ${banned} — this app has no SSE reader (MP0-07 / NG-14 → Track C-04) and B5.1 does not add one`,
  );
}
assert(
  accountingComponentSource.includes('data-accounting-stream-state="degraded"'),
  "the dashboard states the missing live stream in words rather than implying liveness",
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. QUERY-KEY DISCIPLINE + BOUNDED, BRANCH-SCOPED READS
// ═══════════════════════════════════════════════════════════════════════════

const contextSource = codeOnly(`${MANAGER_LIB_DIR}/accounting-context.ts`);
const queryKeyCount = (contextSource.match(/queryKey:\s*managerQueryKey\(/g) || []).length;
const useQueryCount = (contextSource.match(/useQuery\(/g) || []).length;

assert(useQueryCount === 9, `the accounting dashboard issues exactly 9 queries (found ${useQueryCount})`);
assert(
  queryKeyCount === useQueryCount,
  `every accounting query key goes through managerQueryKey (${queryKeyCount} of ${useQueryCount})`,
);
assert(
  !/queryKey:\s*\[/.test(contextSource),
  "no accounting query builds a raw array key — managerQueryKey guarantees the ['manager', surface, branchId] shape",
);
assert(
  (contextSource.match(/managerQueryKey\("accounting-/g) || []).length === useQueryCount,
  "every accounting surface key is namespaced 'accounting-…' so a branch switch cannot collide with B2/B3/B4 keys",
);
assert(
  contextSource.includes("branchId") && contextSource.includes("useManagerBranch"),
  "every accounting read is scoped to the selected branch, not the session default",
);
assert(
  !/queryClient\.clear\(\)/.test(contextSource),
  "no blanket cache clear — the branch switch invalidates only the manager namespace",
);
assert(
  /refetchInterval/.test(contextSource) && /ACCOUNTING_POLL_MS/.test(contextSource),
  "the dashboard polls on one shared interval constant",
);

const apiSource = codeOnly(`${ACCOUNTING_LIB_DIR}/api.ts`);
assert(
  apiSource.includes("take=1") && apiSource.includes("AR_AGING_PAGE_SIZE"),
  "count reads are bounded to one row and the aging read carries its own explicit page size",
);
assert(
  !/apiRequest<[^>]*>\(\s*`[^`]*\?\s*`/.test(apiSource),
  "no accounting request sends an empty query string",
);
assert(
  apiSource.includes("routePath("),
  "every request path is read from the route registry rather than typed a second time",
);

/**
 * Any list route that CAN take a page size must be sent one. A bare-array route
 * cannot (it has no pagination at all), which is exactly why PC-06 needs the
 * honest label instead.
 */
for (const entry of ACCOUNTING_ROUTE_REGISTRY) {
  if (!apiSource.includes(`"${entry.key}"`)) continue;
  if (entry.envelope === "data-total") {
    assert(
      apiSource.includes("take=1") || apiSource.includes("AR_AGING_PAGE_SIZE"),
      `${entry.key} is read with an explicit bound`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. RULING 3 — PC-06: NO FABRICATED SERVER TOTAL
// ═══════════════════════════════════════════════════════════════════════════

assert(
  unpaginatedCountLabel(3, "reconciliations") === "Showing all 3 reconciliations",
  "a bare-array count is labelled 'Showing all N', never presented as a server total",
);
assert(
  unpaginatedCountLabel(null, "reconciliations") === "reconciliations unavailable",
  "an unreadable bare-array count fails closed to 'unavailable', never to zero",
);
assert(
  accountingComponentSource.includes("AccountingUnpaginatedNote"),
  "every card fed by a bare array carries the unpaginated disclosure",
);
/**
 * B5.1 shipped zero list surfaces, so "no pager anywhere" was a sound proxy
 * for "no fabricated total". B5.2 ships nine real `data-total` list routes
 * with genuine server totals (route-registry `serverTotal: true`), so binding
 * a pager to them is correct, not a violation — `toAccountingPager` is the
 * ONLY function in the tree allowed to build one, and it only ever reads a
 * `total` field, never a `.length`. The narrower, still-real check: every
 * `pager={` in the tree traces to `toAccountingPager(`, and no PC-06
 * bare-array surface (`AccountingUnpaginatedNote`-labelled) also binds one.
 */
if (accountingComponentSource.includes("pager={")) {
  assert(
    accountingComponentSource.includes("toAccountingPager("),
    "every bound pager is built by toAccountingPager, which only ever reads a real server `total`",
  );
}
/**
 * Per-FILE check (not a substring-proximity guess): a file that binds a
 * `pager={` prop must be one of the nine B5.2 `data-total` list screens (a
 * REAL server-total LIST pager via `toAccountingPager`), or one of the two
 * B5.3 detail-bearing bank screens (a `ManagerBreadcrumbs` RECORD pager over
 * the already-fetched `pageRows.length` — the same legitimate exception the
 * `.length`-assigned-to-`total:` check above already carves out). Neither
 * B5.3 file binds a LIST pager: `bank.statements` and `bank.reconciliations`
 * are PC-06 bare arrays with no server total to bind to.
 * `BankAccountsScreen.tsx` has no detail view and so is NOT here — it must
 * bind no pager of either kind, same as every other bare-array surface.
 */
const PAGER_ELIGIBLE_FILES = [
  "AccountingListScreen.tsx",
  "CustomersInvoicesScreen.tsx",
  "CustomersAccountsScreen.tsx",
  "CustomersCreditNotesScreen.tsx",
  "VendorsBillsScreen.tsx",
  "VendorsSuppliersScreen.tsx",
  "VendorsCreditNotesScreen.tsx",
  "VendorsPaymentsScreen.tsx",
  "VendorsRecurringScreen.tsx",
  "VendorsRemindersScreen.tsx",
  "BankStatementsScreen.tsx",
  "ReconciliationScreen.tsx",
  "JournalsScreen.tsx",
  "PostingRunsScreen.tsx",
  "PostingErrorsScreen.tsx",
  "AuditTrailScreen.tsx",
];
for (const file of accountingComponentFiles) {
  const isEligible = PAGER_ELIGIBLE_FILES.some((name) => file.endsWith(`/${name}`));
  if (isEligible) continue;
  assert(
    !codeOnly(file).includes("pager={"),
    `${file} is not one of the nine B5.2 server-total list screens, so it binds no pager`,
  );
}
/**
 * `total: pageRows.length` is the one legitimate exception: it feeds
 * `ManagerBreadcrumbsPager` — the "record N of M" walker over the CURRENT
 * PAGE's already-fetched rows on a detail view (the same pattern
 * `ManagerOrderDetailPanel.tsx` established outside this tree) — not a
 * fabricated stand-in for a LIST's server total. Anything else assigning
 * `.length` to a `total:` field is the real B4-D1 violation this guards.
 */
assert(
  !/total:\s*(?!pageRows\.length\b)\w+\.length/.test(accountingSource),
  "no `.length` is ever assigned to a field named `total`, except the record-pager's `pageRows.length`",
);

/** Every bare-array route in the registry declares that it has no server total. */
for (const entry of ACCOUNTING_ROUTE_REGISTRY) {
  if (entry.envelope === "bare-array") {
    assert(!entry.serverTotal, `${entry.key} is declared to have no server total (PC-06)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. RULING 1 — THE MENU TREE: EVERY ITEM RESOLVES TO A VERIFIED ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

assert(assertAccountingMenuIsBacked(), "every menu item cites a live-verified endpoint Manager can read");

const menuItems = accountingMenuItems();
const availableItems = menuItems.filter((item) => item.available);
/**
 * B5.1 shipped 1 (the dashboard). B5.2 (2026-08-21) turned 9 Customers/Vendors
 * rows available plus pulled 2 Reporting rows (Aged receivable/payable)
 * forward from B5.6 — 12 total. B5.3 (2026-08-21) turned the 3 Bank rows
 * available — 15 total. B5.4 (2026-08-21) turned the 4 rows the menu tree
 * already tagged "B5.4" since B5.1 — Journal entries, Posting runs, Posting
 * errors, Audit trail — 19 total. B5.5 (2026-08-21) turned the 2 rows the
 * menu tree already tagged "B5.5" — Fiscal periods, Period close runs — 21
 * total. B5.6 (2026-08-22) turned the LAST 7 rows the menu tree already
 * tagged "B5.6" — Budgets vs actuals, Demand calendar, Forecast, Chart of
 * accounts, Cost centres, Posting source maps, Tax configuration — 28 total,
 * every row in `ACCOUNTING_MENU`. Exact equality: a menu row available with
 * no matching page (or vice versa) is exactly the drift `accountingPageFiles`
 * above also gates.
 */
assert(availableItems.length === 28, `Accounting ships 28 live menu rows (found ${availableItems.length})`);
assert(
  menuItems.every((item) => item.available),
  "every row in ACCOUNTING_MENU is now available — B5.6 was the last sub-phase, so no not-yet row remains",
);
const dashboardMenuItem = availableItems.find((item) => item.key === "accounting-dashboard");
assert(dashboardMenuItem, "the dashboard row is still present and available");
assert(
  dashboardMenuItem!.href === ACCOUNTING_ROUTES.dashboard,
  "the dashboard row's href is still the module landing",
);
const B52_AVAILABLE_KEYS = [
  "accounting-dashboard",
  "accounting-ar-invoices",
  "accounting-ar-accounts",
  "accounting-ar-credit-notes",
  "accounting-ap-bills",
  "accounting-ap-payments",
  "accounting-ap-credit-notes",
  "accounting-ap-suppliers",
  "accounting-ap-recurring",
  "accounting-ap-reminders",
  "accounting-aged-receivable",
  "accounting-aged-payable",
];
const B53_AVAILABLE_KEYS = ["accounting-bank-accounts", "accounting-bank-statements", "accounting-bank-reconciliation"];
const B54_AVAILABLE_KEYS = [
  "accounting-journals",
  "accounting-posting-runs",
  "accounting-posting-errors",
  "accounting-audit-trail",
];
const B55_AVAILABLE_KEYS = ["accounting-periods", "accounting-period-close-runs"];
const B56_AVAILABLE_KEYS = [
  "accounting-budgets",
  "accounting-demand-calendar",
  "accounting-forecast",
  "accounting-chart-of-accounts",
  "accounting-cost-centres",
  "accounting-posting-source-maps",
  "accounting-tax-config",
];
const ALL_AVAILABLE_KEYS = [
  ...B52_AVAILABLE_KEYS,
  ...B53_AVAILABLE_KEYS,
  ...B54_AVAILABLE_KEYS,
  ...B55_AVAILABLE_KEYS,
  ...B56_AVAILABLE_KEYS,
];
assert(
  new Set(availableItems.map((item) => item.key)).size === ALL_AVAILABLE_KEYS.length &&
    ALL_AVAILABLE_KEYS.every((key) => availableItems.some((item) => item.key === key)),
  "exactly the 28 named rows are available — no undocumented row was made live, and none was missed",
);
for (const key of B56_AVAILABLE_KEYS) {
  assert(menuItems.find((item) => item.key === key && item.available), `${key} is available (Track B5.6)`);
}
/** The exact two rows this file's own tags already named "B5.5" are now the ones made live — no other row moved with them. */
assert(
  menuItems.find((item) => item.key === "accounting-periods" && item.available && item.href === ACCOUNTING_ROUTES.fiscalPeriods),
  "Fiscal periods is now a real, available row (Track B5.5, Closing) linking to the Fiscal periods list",
);
assert(
  menuItems.find(
    (item) => item.key === "accounting-period-close-runs" && item.available && item.href === ACCOUNTING_ROUTES.periodCloseRuns,
  ),
  "Period close runs is now a real, available row (Track B5.5, Closing)",
);
// INVERTED 2026-08-22 (Track B5.6): these three rows are no longer not-yet —
// B5.6 turned them live, along with the other four B5.6-tagged rows. The
// `menuItems.every((item) => item.available)` assertion above already covers
// this; this loop is kept, inverted, to re-check by name rather than delete
// the historical marker outright.
for (const key of ["accounting-chart-of-accounts", "accounting-posting-source-maps", "accounting-tax-config"]) {
  assert(
    menuItems.find((item) => item.key === key && item.available),
    `${key} is now a real, available row (Track B5.6, Configuration)`,
  );
}
assert(ACCOUNTING_LANDING === ACCOUNTING_ROUTES.dashboard, "the module landing is the dashboard");
assert(ACCOUNTING_ROOT === "/manager/accounting", "the module root is /manager/accounting");

// A per-row "not-yet rows are tagged with a real sub-phase" loop lived here
// through B5.1–B5.5. B5.6 (2026-08-22) made every row available — see the
// `menuItems.every((item) => item.available)` assertion above — so there is
// no `available: false` row left to check; the loop (and its now-unused
// ACCOUNTING_SUBPHASES import) is retired, not deleted silently.

/** A route Manager cannot read must be ABSENT, not a not-yet row. Procurement suggestions is a special case — see below. */
const menuRouteKeys = new Set(menuItems.flatMap((item) => item.routeKeys));
assert(
  !menuRouteKeys.has("finance.procurementSuggestions"),
  "procurement suggestions are ABSENT from the menu — Track B5.6 deliberately built only its 7 named rows, not this one",
);
/**
 * INVERTED 2026-08-22 (Track B5.6): PERMS-2 (2026-08-21) granted Manager
 * `procurement:advisory:read`, so this route is no longer forbidden — the
 * B5.1-era assertion that it must read "forbidden" is now stale and is
 * corrected here, not silently deleted. The row stays ABSENT from the menu
 * anyway (checked above), now for a build-order reason (B5.6 built exactly
 * seven named rows) rather than a permission one — see the route-registry.ts
 * entry's own note for the full explanation.
 */
assert(
  getAccountingRoute("finance.procurementSuggestions").manager === "allowed",
  "INVERTED 2026-08-22: Manager can now read procurement suggestions (PERMS-2) — the row's continued absence from the menu is a build-order choice, not a permission gap",
);

// No financial statement is offered anywhere in the tree — NG-07 → C-11.
const STATEMENT_WORDS = [
  "balance sheet",
  "profit and loss",
  "cash flow",
  "trial balance",
  "partner ledger",
  "tax report",
  "fiscal report",
  "invoice analysis",
  "executive summary",
];
for (const item of menuItems) {
  for (const word of STATEMENT_WORDS) {
    assert(
      !item.label.toLowerCase().includes(word),
      `no menu item offers a financial statement ("${item.label}") — none exists on this backend (NG-07 → C-11)`,
    );
  }
}
assert(
  ACCOUNTING_OMITTED_ITEMS.some((entry) => /Balance Sheet/i.test(entry.odooItem)),
  "the omitted-items register states why the financial statements are absent",
);
assert(
  ACCOUNTING_OMITTED_ITEMS.length >= 10,
  "the Odoo items deliberately not cloned are recorded with reasons, as the roadmap requires",
);
assert(
  ACCOUNTING_OMITTED_ITEMS.some((entry) => /Receipts/i.test(entry.odooItem) && /POST-only/i.test(entry.reason)),
  "the AR Receipts omission records that the endpoint is POST-only",
);

// Menu groups mirror Odoo's structure, adapted — the headings are not invented.
const headings = ACCOUNTING_MENU.map((group) => group.heading).filter(Boolean);
for (const expected of ["Customers", "Vendors", "Bank", "Accounting", "Review", "Reporting", "Configuration"]) {
  assert(headings.includes(expected), `the menu carries Odoo's "${expected}" grouping`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. RULING 4 — EVERY FIGURE IS REGISTRY-BOUND TO A VERIFIED FIELD
// ═══════════════════════════════════════════════════════════════════════════

for (const binding of ACCOUNTING_KPI_BINDINGS) {
  const route = getAccountingKpiRoute(binding.key);
  assert(route.manager === "allowed", `KPI ${binding.key} reads a route Manager can actually reach`);
  assert(binding.field.length > 0, `KPI ${binding.key} names the response field it renders`);
  if (binding.drillIn === null) {
    assert(
      Boolean(binding.noDrillInReason),
      `KPI ${binding.key} has no drill-in target, so it must state why`,
    );
  }
}

let threw = false;
try {
  getAccountingKpi("totally.made.up");
} catch {
  threw = true;
}
assert(threw, "an unregistered KPI throws rather than rendering");

threw = false;
try {
  getAccountingRoute("totally.made.up");
} catch {
  threw = true;
}
assert(threw, "an unregistered route key throws rather than being fetched");

/**
 * Every KPI key referenced by the components must resolve in the registry.
 * Both call shapes are matched: the JSX prop (`kpiKey="…"` on a primary figure)
 * and the object literal (`kpiKey: "…"` inside a stat-list row).
 */
const renderedKpiKeys = new Set(
  [...accountingComponentSource.matchAll(/kpiKey(?:=|:\s*)"([^"]+)"/g)].map((match) => match[1]),
);
assert(renderedKpiKeys.size >= 15, `the dashboard renders a substantial set of bound figures (${renderedKpiKeys.size})`);
for (const key of renderedKpiKeys) {
  getAccountingKpi(key); // throws when unregistered
}

// Registry hygiene.
const routeKeys = ACCOUNTING_ROUTE_REGISTRY.map((entry) => entry.key);
assert(new Set(routeKeys).size === routeKeys.length, "registry keys are unique");
for (const entry of ACCOUNTING_ROUTE_REGISTRY) {
  assert(entry.path.startsWith("/api/"), `${entry.key} declares a real API path`);
  assert(entry.observed.length > 20, `${entry.key} records what the live probe actually observed`);
}
assert(
  getAccountingRoute("franchise.forecast").path === "/api/franchise/forecast",
  "the forecast route is /api/franchise/forecast, not /api/finance/forecast (B0's parser defect)",
);

/** The four organisation-level surfaces are LABELLED, not "fixed" (batch 2). */
for (const key of [
  "accounting.periods",
  "accounting.periodCloseRuns",
  "accounting.postingSourceMaps",
  "accounting.taxConfig",
]) {
  assert(
    getAccountingRoute(key).scope === "organization",
    `${key} is declared organisation data — batch 2 ruled these org-level BY DESIGN`,
  );
}
assert(
  accountingComponentSource.includes("AccountingRouteScopeNote") ||
    accountingComponentSource.includes("AccountingScopeNote"),
  "every card labels the scope its figures describe",
);

// ═══════════════════════════════════════════════════════════════════════════
// 7. MONEY GOES THROUGH THE ONE SHARED UGX FORMATTER
// ═══════════════════════════════════════════════════════════════════════════

const modelSource = codeOnly(`${ACCOUNTING_LIB_DIR}/model.ts`);
assert(
  modelSource.includes("formatWaiterMoney") && modelSource.includes('from "../waiter/formatters"'),
  "accounting money delegates to the shared zero-fraction formatter rather than forking a fifth one",
);
for (const file of [...accountingComponentFiles, ...accountingLibFiles].filter(
  (candidate) => candidate !== `${ACCOUNTING_LIB_DIR}/model.ts`,
)) {
  assert(
    !/style:\s*["']currency["']/.test(codeOnly(file)),
    `${file} formats no currency of its own`,
  );
}
assert(formatAccountingMoney("1282400", "UGX") === "UGX 1,282,400", "UGX renders with zero fraction digits");
assert(formatAccountingMoney(null, "UGX") === "Unavailable", "missing money fails closed to a word, never to UGX 0");
assert(formatAccountingMoney("", "UGX") === "Unavailable", "an empty Decimal is not coerced to zero");
assert(toAccountingAmount("0") === 0, "a real zero is still a real zero");
assert(toAccountingAmount(undefined) === null, "an absent Decimal is null, not zero");
assert(toAccountingCount(undefined) === null && formatAccountingCount(null) === "Unavailable", "counts fail closed");
assert(formatAccountingCount(1198) === "1,198", "counts are grouped");

// ═══════════════════════════════════════════════════════════════════════════
// 8. B5-F1 — FIXED (backend gap batch 3, 2026-08-21): the AR aging summary is
//    now correct regardless of page size, so `isArAgingComplete` is a
//    well-formed-response guard only, not a page-completeness threshold.
//    Two assertions below are INVERTED, not deleted, per house style — each
//    names the date and the reason the contract changed.
// ═══════════════════════════════════════════════════════════════════════════

const completePage = {
  total: 3,
  skip: 0,
  take: AR_AGING_PAGE_SIZE,
  summary: { totalOutstanding: "9106400" },
  accounts: [
    { customerAccountId: "a", customerAccountName: "A", invoices: [{ invoiceId: "i1" }, { invoiceId: "i2" }] },
    { customerAccountId: "b", customerAccountName: "B", invoices: [{ invoiceId: "i3" }] },
  ],
};
assert(isArAgingComplete(completePage), "a page carrying every matching invoice is complete");

assert(
  isArAgingComplete({ ...completePage, total: 9 }),
  "INVERTED 2026-08-21 (batch 3): the backend now aggregates `summary` from a separate " +
    "unpaginated query, so a page reporting fewer invoices than `total` no longer means the " +
    "MONEY is incomplete — only the display breakdown is. The B5-F1 defect this used to pin is fixed.",
);
assert(
  isArAgingComplete({ ...completePage, skip: 1 }),
  "INVERTED 2026-08-21 (batch 3): `skip` no longer affects `summary` correctness, so a page " +
    "past the first is a normal paginated read, not an incomplete one.",
);
assert(!isArAgingComplete({ ...completePage, accounts: undefined }), "a missing accounts array fails closed");
assert(!isArAgingComplete({ ...completePage, total: undefined }), "a missing total fails closed");
assert(!isArAgingComplete(undefined), "no response at all fails closed");
assert(
  accountingComponentSource.includes('data-accounting-partial="ar-aging"'),
  "the receivable card KEEPS the withheld-state markup as a malformed-response fallback, even " +
    "though B5-F1 means it can no longer be reached by a large, well-formed branch",
);
assert(AR_AGING_PAGE_SIZE >= 100, "the aging read requests a page large enough for a realistic display breakdown");

// ═══════════════════════════════════════════════════════════════════════════
// 9. MODEL BEHAVIOUR — BUCKETS, PERIODS, RECONCILIATIONS
// ═══════════════════════════════════════════════════════════════════════════

const apBuckets = toApAgingBuckets({
  buckets: { current: "0", days1to30: "0", days31to60: "1282400", days61to90: "0", days90plus: "0", total: "1282400" },
});
assert(apBuckets.length === 5, "AP aging maps five buckets");
assert(apBuckets[2].amount === 1282400, "AP's days31to60 lands in the 31–60 bucket");
assert(overdueTotal(apBuckets) === 1282400, "overdue excludes the current bucket");

const arBuckets = toArAgingBuckets({
  summary: {
    current: "0",
    bucket_1_30: "1486600",
    bucket_31_60: "7619800",
    bucket_61_90: "0",
    bucket_90_plus: "0",
    totalOutstanding: "9106400",
  },
});
assert(arBuckets[1].amount === 1486600, "AR's bucket_1_30 lands in the 1–30 bucket");
assert(overdueTotal(arBuckets) === 9106400, "the AR overdue sum matches the live Tapas figure");
assert(
  overdueTotal([...arBuckets.slice(0, 4), { ...arBuckets[4], amount: null }]) === null,
  "an unreadable bucket makes the overdue total null rather than an understatement",
);
assert(
  apBuckets.every((bucket) => bucket.description.length > 0),
  "every bucket carries a worded description — status is never colour alone",
);

// PC-07: four states, LOCKED terminal, no unlock.
assert(FISCAL_PERIOD_STATUSES.join(",") === "DRAFT,OPEN,CLOSED,LOCKED", "the period lifecycle models four states");
assert(toFiscalPeriodStatus("open") === "OPEN", "a status is normalised, not trusted verbatim");
assert(toFiscalPeriodStatus("UNLOCKED") === null, "an unknown status is refused rather than guessed");
assert(
  !accountingSource.toLowerCase().includes("unlock period"),
  "no unlock affordance exists — LOCKED is terminal on this backend",
);

/**
 * The live dataset carries three simultaneously-OPEN periods (a quarter and two
 * months), which is precisely why "the first OPEN row" is the wrong answer.
 */
const now = Date.UTC(2026, 7, 21);
const periods = [
  { id: "q3", name: "FY2026-Q3", startsAt: "2026-06-30T21:00:00.000Z", endsAt: "2026-09-30T20:59:59.000Z", status: "OPEN" },
  { id: "m7", name: "FY2026-07", startsAt: "2026-06-30T21:00:00.000Z", endsAt: "2026-07-31T20:59:59.000Z", status: "OPEN" },
  { id: "m8", name: "FY2026-08", startsAt: "2026-07-31T21:00:00.000Z", endsAt: "2026-08-31T20:59:59.000Z", status: "OPEN" },
];
assert(currentFiscalPeriod(periods, now)?.id === "m8", "the current period is the NARROWEST window containing today");
assert(currentFiscalPeriod([periods[0]], now)?.id === "q3", "a quarter is used when no month covers today");
assert(currentFiscalPeriod(periods, Date.UTC(2027, 0, 1)) === null, "no period covering today yields null, not a guess");
assert(
  currentFiscalPeriod([{ id: "x", name: "Broken", startsAt: null, endsAt: null, status: "OPEN" }], now) === null,
  "a period with an unreadable window is skipped rather than assumed current",
);
assert(countPeriodsByStatus(periods, "OPEN") === 3, "open periods are counted by real status");
assert(countPeriodsByStatus(undefined, "OPEN") === null, "an unread period list counts null, not zero");

assert(
  countActiveReconciliations([{ id: "a", status: "OPEN" }, { id: "b", status: "COMPLETED" }]) === 1,
  "only OPEN and IN_PROGRESS reconciliations count as active",
);
assert(countActiveReconciliations(undefined) === null, "an unread reconciliation list counts null, not zero");

// ═══════════════════════════════════════════════════════════════════════════
// 10. NAVIGATION — ACCOUNTING IS THE SEVENTH MODULE (OD-3)
// ═══════════════════════════════════════════════════════════════════════════

assert(managerRoutes.length === 7, "Manager navigation carries seven modules");
const accountingRoute = managerRoutes.find((route) => route.label === "Accounting");
assert(accountingRoute, "Accounting is a top-level module");
assert(accountingRoute!.href === ACCOUNTING_ROOT, "the module entry points at the module root");
assert(
  accountingRoute!.match("/manager/accounting/dashboard"),
  "the module stays highlighted on its sub-routes",
);
assert(
  managerRoutes.map((route) => route.label).join(",") ===
    "Overview,Operations,Staff,Reports,Accounting,Settings,Me",
  "Accounting sits before Settings, and no More/Approvals tab was introduced",
);

const accountingMenu = managerTopNavMenus.find((menu) => menu.key === "accounting");
assert(accountingMenu, "the top nav renders an Accounting dropdown");
assert(!accountingMenu!.href, "Accounting is a grouped menu, not a direct-action link");
assert(
  (accountingMenu!.groups || []).flatMap((group) => group.items).length === menuItems.length,
  "the rendered dropdown is generated from lib/accounting/menu.ts — never a second hand-maintained copy",
);
for (const group of accountingMenu!.groups || []) {
  for (const item of group.items) {
    assert(item.available || Boolean(item.notYetNote), `not-yet row ${item.key} carries its phase tag`);
  }
}

const accountingSurface = managerSurfaces.find((surface) => surface.key === "accounting");
assert(accountingSurface, "Accounting is on the surface allow-list");
assert(accountingSurface!.status === "allowed" && accountingSurface!.liveFrom === "live", "the surface is live");
/**
 * INVERTED 2026-08-22 (Track B5.7): the original scopeNote's unqualified
 * "READ-ONLY BY PERMISSION... zero writes" claim was ALREADY false the day
 * Track B5.6 shipped (2026-08-22) and nobody corrected it — a real finding
 * this pass caught and fixed. It now carries a SUPERSEDED banner (§19 style,
 * matching CLAUDE.md's own pattern) rather than being silently rewritten.
 */
assert(
  /SUPERSEDED/.test(accountingSurface!.scopeNote || "") && /PERMS-2/.test(accountingSurface!.scopeNote || ""),
  "the allow-list's accounting scopeNote carries a SUPERSEDED banner correcting its stale 'READ-ONLY BY PERMISSION, zero writes' claim, dated and reasoned like every other correction in this codebase",
);
assert(
  !codeOnly(`${MANAGER_LIB_DIR}/permissions.ts`).includes("hasPermission("),
  "the surface gate is still an allow-list, never a permission lookup",
);

// ═══════════════════════════════════════════════════════════════════════════
// 11. NO FABRICATED FILES, NO FORKED SHELL
// ═══════════════════════════════════════════════════════════════════════════

assert(!accountingSource.includes("new Blob("), "nothing is synthesised client-side (the B4 rule, carried forward)");
assert(
  accountingComponentSource.includes("ManagerDashboardCard"),
  "the accounting cards reuse the B2 card shell rather than forking a second one",
);
assert(
  accountingComponentSource.includes("ManagerContentShell") &&
    accountingComponentSource.includes("ManagerControlPanel"),
  "the dashboard composes the B1 chrome primitives",
);
assert(
  !accountingSource.includes("@phosphor-icons/react"),
  "icons come from the canonical registry by name, never imported directly",
);
assert(
  codeOnly(`${WEB}/src/components/pos-shell/role-icon-config.ts`).includes("accounting:"),
  "the accounting glyph is registered in the canonical icon registry",
);

// ═══════════════════════════════════════════════════════════════════════════
// 12. TRACK B5.2 — CUSTOMERS + VENDORS LIST/DETAIL SURFACES
//     (server-total pagination, enum-only filters, clamp-aware paging)
// ═══════════════════════════════════════════════════════════════════════════

const B52_LIST_SCREEN_FILES = accountingComponentFiles.filter((file) =>
  /\/(customers|vendors)\/.*Screen\.tsx$/.test(file),
);
assert(B52_LIST_SCREEN_FILES.length === 9, `B5.2 ships 9 Customers/Vendors screens (found ${B52_LIST_SCREEN_FILES.length})`);

/**
 * Narrowed to the two AGING screens specifically (not a bare `/reporting/`
 * substring match) — Track B5.6 (2026-08-22) added three MORE files to this
 * same directory (BudgetsScreen.tsx, DemandCalendarScreen.tsx,
 * ForecastScreen.tsx), so a directory-wide filter would over-count from here
 * on. Those three are checked separately in §16 below.
 */
const B52_REPORTING_FILES = accountingComponentFiles.filter(
  (file) => file.includes("/reporting/") && (file.endsWith("AgedReceivableScreen.tsx") || file.endsWith("AgedPayableScreen.tsx")),
);
assert(B52_REPORTING_FILES.length === 2, `B5.2 ships 2 Reporting (aging) screens (found ${B52_REPORTING_FILES.length})`);

/**
 * Enum-only filters: every status/type/counterparty filter value that reaches
 * a list request must be validated against a real backend enum via
 * `readManagerEnum`, never forwarded as a raw `router.query.*` string — that
 * is precisely how B5-F2 (an unvalidated `?status=` 500ing) happened upstream.
 * No B5.2 screen may read a filter value any other way.
 */
for (const file of B52_LIST_SCREEN_FILES) {
  const code = codeOnly(file);
  const hasFilter = /router\.query\.(status|type|counterpartyType|active)\b/.test(code);
  if (!hasFilter) continue;
  assert(
    code.includes("readManagerEnum(") || code.includes("firstManagerQueryValue("),
    `${file} reads its filter value through a validating helper, never a raw query string`,
  );
  assert(
    !/(status|counterpartyType|type)\s*:\s*router\.query\./.test(code),
    `${file} never passes a raw router.query value straight into a list request param`,
  );
}

/** Clamp-aware paging: batch 3 made `take > 100` a 400, not a silent clamp — every B5.2 list request must stay under that server bound. */
assert(
  apiSource.includes("ACCOUNTING_LIST_PAGE_SIZE_MAX = 100"),
  "the client-side take clamp mirrors the backend's MAX_ACCOUNTING_LIST_PAGE_SIZE (batch 3)",
);
assert(
  apiSource.includes("clampAccountingTake"),
  "every B5.2 list request clamps `take` client-side before it is ever sent",
);
for (const file of B52_LIST_SCREEN_FILES) {
  assert(
    codeOnly(file).includes("clampAccountingTake("),
    `${file} clamps its page size through clampAccountingTake rather than sending a raw number`,
  );
}

/** Every B5.2 list route really does carry a server total — a route the registry marks otherwise must never anchor one of these screens. */
const B52_LIST_ROUTE_KEYS = [
  "ar.invoices",
  "ar.accounts",
  "ar.creditNotes",
  "ap.bills",
  "ap.suppliers",
  "ap.creditNotes",
  "ap.payments",
  "ap.recurringProfiles",
  "ap.reminders",
];
for (const key of B52_LIST_ROUTE_KEYS) {
  const route = getAccountingRoute(key);
  assert(route.envelope === "data-total" && route.serverTotal, `${key} carries a real server total the B5.2 pager may bind to`);
}

/** The two Reporting screens read the aging aggregates and render no pager (asserted structurally above) — they must still be registry-bound. */
assert(getAccountingRoute("ar.aging").manager === "allowed" && getAccountingRoute("ap.aging").manager === "allowed", "both aging reports read routes Manager can reach");

/** No B5.2 detail view was fabricated — every `?xId=` query param screen resolves against a real registry detail/list key, never a made-up one. */
assert(
  accountingComponentSource.includes('routeKey="ar.invoices"') &&
    accountingComponentSource.includes('routeKey="ar.accounts"') &&
    accountingComponentSource.includes('routeKey="ap.bills"') &&
    accountingComponentSource.includes('routeKey="ap.suppliers"'),
  "the four detail-bearing list screens cite their real registry route keys",
);

/** Dashboard "arrives in B5.x" placeholders for AR/AP KPIs are gone — every one now has a real drillIn. */
for (const key of [
  "ar.outstanding",
  "ar.openInvoices",
  "ar.customers",
  "ar.overdue",
  "ar.buckets",
  "ap.outstanding",
  "ap.openBills",
  "ap.overdue",
  "ap.topSupplier",
  "ap.buckets",
]) {
  const binding = getAccountingKpi(key);
  assert(binding.drillIn !== null, `KPI ${key} now links into a real B5.2 surface instead of a "not yet" note`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. TRACK B5.3 — BANK RECONCILIATION SURFACES
//     (read-only guard over the bank tree, no fabricated match states,
//     enum-only status filters, no fabricated list total on a bare array)
// ═══════════════════════════════════════════════════════════════════════════

const BANK_DIR_FILES = accountingComponentFiles.filter((file) => file.includes("/accounting/bank/"));
assert(BANK_DIR_FILES.length === 3, `B5.3 ships 3 Bank screens (found ${BANK_DIR_FILES.length})`);

/** Neither B5.3 screen fabricates a list total — `toAccountingPager` never appears in the bank tree. */
for (const file of BANK_DIR_FILES) {
  assert(
    !codeOnly(file).includes("toAccountingPager("),
    `${file} binds no server-total list pager — bank.statements and bank.reconciliations are PC-06 bare arrays`,
  );
}

/** The three bare-array bank routes stay declared PC-06, matching the general sweep above. */
for (const key of ["bank.accounts", "bank.statements", "bank.reconciliations"]) {
  const route = getAccountingRoute(key);
  assert(route.envelope === "bare-array" && !route.serverTotal, `${key} is declared PC-06 (bare array, no server total)`);
}
/** The two detail keys are real single-object reads, not bare arrays. */
for (const key of ["bank.statement", "bank.reconciliation"]) {
  assert(getAccountingRoute(key).envelope === "object", `${key} is a single-object detail read`);
}

/**
 * Enum-only status filters (same B5-F2-shaped rule §12 applies to B5.2): any
 * status filter value that reaches a bank screen must come from
 * `readManagerEnum`, never a raw `router.query.status` string forwarded
 * anywhere — these two routes accept NO server-side status parameter at all
 * (only `?bankAccountId=`), so the filter is applied client-side, but the
 * VALUE it filters by must still be validated, never a hand-edited arbitrary
 * string silently "matching" nothing.
 */
for (const file of BANK_DIR_FILES) {
  const code = codeOnly(file);
  if (!/router\.query\.status\b/.test(code)) continue;
  assert(code.includes("readManagerEnum("), `${file} reads its status filter through readManagerEnum, never a raw query string`);
  assert(!/\.filter\([^)]*router\.query\.status/.test(code), `${file} never filters rows against a raw router.query.status`);
}

/** No accounting route path is ever hand-typed as a server-side status query — the filter is applied to the fetched array, not sent to the server. */
assert(
  !accountingComponentSource.includes("bank-statements?status=") &&
    !accountingComponentSource.includes("reconciliation?status="),
  "no bank screen forwards a status filter to the server — neither route accepts one",
);

/** The reconciliation lifecycle models exactly three linear stages, DISPUTED is an exit, not a fourth stage. */
assert(RECONCILIATION_PIPELINE.join(",") === "OPEN,IN_PROGRESS,COMPLETED", "the reconciliation pipeline has three stages");
assert(reconciliationPipelineIndex("open") === 0, "a lowercase status is normalised before indexing");
assert(reconciliationPipelineIndex("DISPUTED") === -1, "DISPUTED is off the pipeline, not a fourth stage");
assert(reconciliationPipelineIndex(null) === -1, "an unread status is off the pipeline, never assumed OPEN");

/** completeReconciliation requires an EXACT zero difference (bank-rec.service.ts) — never a rounded or fuzzy match. */
assert(isReconciliationBalanced("0.00") === true, "a zero difference reads as balanced");
assert(isReconciliationBalanced("0") === true, "a zero difference reads as balanced regardless of decimal formatting");
assert(isReconciliationBalanced("200000.00") === false, "a non-zero difference reads as not balanced, never rounded away");
assert(isReconciliationBalanced(undefined) === null, "an unreadable difference is null, never guessed into balanced or not");

/**
 * INVERTED 2026-08-21 → 2026-08-22 (Track B5.7): match/skip/complete were
 * denied through B5.3–B5.6 (PC-01) and are real now — PERMS-2 resolved the
 * permission and B5.7 built the workbench. The ban now applies only to the
 * two bank screens that stayed read-only (Bank accounts, Bank statements —
 * neither gained a create/import control in this pass); ReconciliationScreen
 * is asserted to actually call the write hooks instead.
 */
const BANK_READ_ONLY_DIR_FILES = BANK_DIR_FILES.filter((file) => !file.endsWith("/ReconciliationScreen.tsx"));
for (const file of BANK_READ_ONLY_DIR_FILES) {
  const code = codeOnly(file);
  assert(!/\bmatchLine\b|\bskipLine\b|\bcompleteReconciliation\b/.test(code), `${file} calls no match/skip/complete function`);
}
const reconciliationScreenSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/bank/ReconciliationScreen.tsx`);
assert(
  /useMatchReconciliationLine|matchReconciliationLineRequest/.test(reconciliationScreenSource) &&
    /useSkipReconciliationLine|skipReconciliationLineRequest/.test(reconciliationScreenSource) &&
    /useCompleteReconciliation|completeReconciliationRequest/.test(reconciliationScreenSource),
  "ReconciliationScreen calls real match, skip AND complete write functions (Track B5.7)",
);
assert(
  accountingComponentSource.includes("AccountingReadOnlyCard") &&
    BANK_READ_ONLY_DIR_FILES.some((file) => codeOnly(file).includes("AccountingReadOnlyCard")),
  "the two still-read-only bank screens disclose their denied write actions in words",
);

/** The registry's two Bank dashboard-card KPI placeholders are gone — every bank KPI now links into a real B5.3 surface. */
for (const key of ["bank.activeReconciliations", "bank.reconciliations", "bank.accounts"]) {
  const binding = getAccountingKpi(key);
  assert(binding.drillIn !== null, `KPI ${key} now links into a real B5.3 surface instead of a "not yet" note`);
}
assert(getAccountingKpi("bank.accounts").drillIn === ACCOUNTING_ROUTES.bankAccounts, "the bank-accounts KPI links to the bank accounts list");
assert(
  getAccountingKpi("bank.reconciliations").drillIn === ACCOUNTING_ROUTES.bankReconciliation &&
    getAccountingKpi("bank.activeReconciliations").drillIn === ACCOUNTING_ROUTES.bankReconciliation,
  "both reconciliation KPIs link to the reconciliation workbench",
);

/** The Bank menu group's three rows now cite their real registry keys and resolve to the three new routes. */
const bankMenuItems = menuItems.filter((item) => item.key.startsWith("accounting-bank-"));
assert(bankMenuItems.length === 3, `the Bank menu group carries exactly 3 rows (found ${bankMenuItems.length})`);
for (const item of bankMenuItems) {
  assert(item.available, `${item.key} is available (B5.3 shipped it)`);
}

/** `BankAccountRow` no longer claims a `currentBalance` the schema does not have — a stale B5.1 field, corrected in this pass. */
const typesSource = codeOnly(`${ACCOUNTING_LIB_DIR}/types.ts`);
assert(!/BankAccountRow[\s\S]{0,400}currentBalance/.test(typesSource), "BankAccountRow no longer declares a currentBalance field that does not exist on the Prisma schema");

// ═══════════════════════════════════════════════════════════════════════════
// 14. TRACK B5.4 — ACCOUNTING CORE (JOURNALS) + REVIEW
//     (server-total pagination, balance tie-out, the C-25 branch fail-safe;
//     B5.4-D1's "no resolve/dismiss endpoint" gap was FIXED at the backend in
//     batch 4 and BUILT ON by Track B5.7 — see the inverted checks below)
// ═══════════════════════════════════════════════════════════════════════════

const CORE_DIR_FILES = accountingComponentFiles.filter((file) => file.includes("/accounting/core/"));
assert(CORE_DIR_FILES.length === 1, `B5.4 ships 1 Accounting-core screen (found ${CORE_DIR_FILES.length})`);
const REVIEW_DIR_FILES = accountingComponentFiles.filter((file) => file.includes("/accounting/review/"));
assert(REVIEW_DIR_FILES.length === 3, `B5.4 ships 3 Review screens (found ${REVIEW_DIR_FILES.length})`);
const B54_DIR_FILES = [...CORE_DIR_FILES, ...REVIEW_DIR_FILES];

/** All four B5.4 list routes genuinely carry a real server total — the pagers these screens bind are not fabricated. */
for (const key of ["accounting.journals", "accounting.postingRuns", "accounting.postingErrors", "audit.timeline"]) {
  const route = getAccountingRoute(key);
  assert(route.envelope === "data-total" && route.serverTotal, `${key} carries a real server total the B5.4 pager may bind to`);
}

/**
 * ✅ audit.timeline is INVERTED, not deleted, per house style: the B5.1-era
 * registry entry said this route was ORGANISATION scope because it ignored
 * X-Branch-Id — true THEN, stale now that backend gap batch 3 (B5-F4) fixed
 * it. This pass (Track B5.4, 2026-08-21) corrected the registry to match.
 */
assert(
  getAccountingRoute("audit.timeline").scope === "branch",
  "INVERTED 2026-08-21 (Track B5.4): audit.timeline is branch-scoped now that B5-F4 (batch 3) made it honour X-Branch-Id by default — the B5.1-era 'organisation scope' note was stale, not a fact that changed by policy",
);

/** Enum-only filters (the B5-F2-shaped rule §12/§13 already apply): journal status and posting-error status both come from a validated closed set. */
for (const file of [`${ACCOUNTING_COMPONENT_DIR}/core/JournalsScreen.tsx`, `${ACCOUNTING_COMPONENT_DIR}/review/PostingErrorsScreen.tsx`]) {
  const code = codeOnly(file);
  assert(code.includes("readManagerEnum("), `${file} reads its status filter through readManagerEnum, never a raw query string`);
}
/** The audit trail's entityType filter is not a backend-enforced enum, but it still comes from a closed, verified-against-source set, never a hand-typed string. */
const auditTrailSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/review/AuditTrailScreen.tsx`);
assert(
  auditTrailSource.includes("AUDIT_ENTITY_TYPES") && auditTrailSource.includes("readAuditEntityType"),
  "AuditTrailScreen validates entityType against a closed, verified set rather than forwarding router.query.entityType raw",
);
assert(
  !/entityType:\s*router\.query\.entityType\b/.test(auditTrailSource),
  "AuditTrailScreen never passes a raw router.query.entityType straight into the request",
);

/** Posting runs offers NO filter menu at all — the endpoint accepts no server-side filter, and a client-side one would misrepresent a single page as the whole branch (unlike PC-06's bare-array screens, this is a real paginated, serverTotal:true list). */
const postingRunsSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/review/PostingRunsScreen.tsx`);
assert(
  !postingRunsSource.includes("ManagerSearchFilterMenu") && !postingRunsSource.includes("filterMenu:"),
  "PostingRunsScreen offers no filter menu — the endpoint supports none, and a client-side filter over one page would misrepresent it as the whole branch",
);

/** The balance tie-out helpers behave correctly on concrete vectors. */
assert(isJournalBalanced({ totalDebit: "150000.00", totalCredit: "150000.00" }) === true, "equal debit/credit reads as balanced");
assert(isJournalBalanced({ totalDebit: "150000.00", totalCredit: "140000.00" }) === false, "unequal debit/credit reads as not balanced, never rounded away");
assert(isJournalBalanced({ totalDebit: undefined, totalCredit: "140000.00" }) === null, "an unreadable side fails closed to null, never guessed balanced or not");
assert(
  sumJournalLineAmounts(
    [
      { id: "l1", direction: "DEBIT", amount: "100000.00" },
      { id: "l2", direction: "DEBIT", amount: "50000.00" },
      { id: "l3", direction: "CREDIT", amount: "150000.00" },
    ],
    "DEBIT",
  ) === 150000,
  "summing DEBIT lines ignores CREDIT lines and totals correctly",
);
assert(
  sumJournalLineAmounts([{ id: "l1", direction: "DEBIT", amount: undefined }], "DEBIT") === null,
  "an unreadable line amount fails the whole sum closed, never an understatement",
);
assert(sumJournalLineAmounts(undefined, "DEBIT") === null, "no lines at all fails closed to null");

/** C-25 fail-safe: a journal with a DIFFERENT branchId than the active branch is refused, one with NO branchId (org-level) is not, and no branchId is never treated as a mismatch. */
assert(isJournalReadableInBranch({ branchId: "branch-a" }, "branch-a") === true, "a matching branch reads as readable");
assert(isJournalReadableInBranch({ branchId: "branch-a" }, "branch-b") === false, "a mismatched branch is refused — the C-25 fail-safe");
assert(isJournalReadableInBranch({ branchId: null }, "branch-a") === true, "a journal with no branchId (org-level) is not treated as a cross-branch mismatch");
assert(isJournalReadableInBranch(undefined, "branch-a") === false, "no journal at all is never readable");

/** The registry itself documents C-25 by name — this is not a silent frontend mitigation with no paper trail. */
assert(/C-25/.test(source(`${ACCOUNTING_LIB_DIR}/route-registry.ts`)), "the accounting.journal registry entry names the C-25 finding");
assert(
  codeOnly(`${ACCOUNTING_COMPONENT_DIR}/core/JournalsScreen.tsx`).includes("isJournalReadableInBranch"),
  "JournalsScreen actually calls the C-25 fail-safe, not just imports it",
);

/** ACCOUNTING_DENIED_WRITES now names posting-run replay, the one B5.4-relevant write that was missing from the disclosure list. */
assert(
  ACCOUNTING_DENIED_WRITES.some((entry) => /replay/i.test(entry.label) && /posting\/replay/.test(entry.route)),
  "the denied-write disclosure names posting-run replay, not only journal post/reverse",
);

/**
 * INVERTED 2026-08-21 → 2026-08-22: B5.4-D1 found there was genuinely no
 * resolve/dismiss endpoint for PostingError, for any role. Backend gap batch
 * 4 (2026-08-21) fixed that at the API layer; Track B5.7 (2026-08-22) is the
 * first phase to build UI on top of the fix. PostingErrorsScreen now calls
 * the real resolve/dismiss write functions and no longer claims the gap is
 * unfixable.
 */
const postingErrorsSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/review/PostingErrorsScreen.tsx`);
assert(
  /useResolvePostingError|resolvePostingErrorRequest/.test(postingErrorsSource) &&
    /useDismissPostingError|dismissPostingErrorRequest/.test(postingErrorsSource),
  "PostingErrorsScreen calls real resolve AND dismiss write functions (Track B5.7)",
);
assert(
  !/no endpoint exists/i.test(postingErrorsSource) && !/^No role can act/im.test(postingErrorsSource),
  "PostingErrorsScreen no longer claims the resolve/dismiss gap is unfixable — it was fixed at the backend and built on here",
);
assert(
  /\buseResolvePostingError\b|\buseDismissPostingError\b/.test(accountingSource),
  "a resolve/dismiss function is actually called somewhere in the accounting tree, matching the real route B5.7 built on",
);

/** Journal money never renders as a single signed column — Owner Ruling on money presentation: debit and credit are always two separate, unambiguous columns. */
const journalsSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/core/JournalsScreen.tsx`);
assert(
  journalsSource.includes('key: "debit"') && journalsSource.includes('key: "credit"'),
  "the journal lines table renders separate Debit and Credit columns, never one signed amount column",
);

/** Every B5.4 list route really does carry a server total — mirrors §12/§13's registry-hygiene sweep for the four new keys. */
assert(getAccountingKpi("ledger.journals").drillIn === ACCOUNTING_ROUTES.journals, "the journals KPI now links into the real journals list instead of a 'not yet' note");
assert(getAccountingKpi("ledger.postingRuns").drillIn === ACCOUNTING_ROUTES.postingRuns, "the posting-runs KPI now links into the real posting-runs list");
assert(getAccountingKpi("ledger.postingErrors").drillIn === ACCOUNTING_ROUTES.postingErrors, "the posting-errors KPI now links into the real posting-errors list");

for (const file of B54_DIR_FILES) {
  assert(!codeOnly(file).includes("EventSource") && !codeOnly(file).includes("new WebSocket"), `${file} contains no streaming client`);
}

/**
 * C-26 (new finding, this pass): `ledger.service.ts`'s six `audit.log(...)`
 * calls never stamp `metadata.branchId`, live-proven by creating fresh
 * journal/posting-run/posting-error events and finding every resulting row's
 * branchId NULL. Because B5-F4 (batch 3) ANDs branch match unconditionally,
 * the Audit trail rail can structurally never surface a ledger-domain event.
 * Both the registry and the screen must name this — an empty result here
 * must never read as "nothing happened".
 */
assert(/C-26/.test(source(`${ACCOUNTING_LIB_DIR}/route-registry.ts`)), "the audit.timeline registry entry names the C-26 finding");
assert(/C-26/.test(auditTrailSource), "AuditTrailScreen discloses C-26 rather than implying an empty history");

// ═══════════════════════════════════════════════════════════════════════════
// 15. TRACK B5.5 — CLOSING (FISCAL PERIODS + PERIOD CLOSE RUNS)
//     (read-only guard over the closing tree, org-level labelling, fail-closed
//     status rendering, no fabricated list total on either bare array, the
//     B5.5-F1 "FAILED/PENDING are unreachable" disclosure)
// ═══════════════════════════════════════════════════════════════════════════

const CLOSING_DIR_FILES = accountingComponentFiles.filter((file) => file.includes("/accounting/closing/"));
assert(CLOSING_DIR_FILES.length === 2, `B5.5 ships 2 Closing screens (found ${CLOSING_DIR_FILES.length})`);

/** Both B5.5 routes stay declared PC-06 bare arrays with no server total — list-only, same shape B5.4 found for Posting runs. */
for (const key of ["accounting.periods", "accounting.periodCloseRuns"]) {
  const route = getAccountingRoute(key);
  assert(route.envelope === "bare-array" && !route.serverTotal, `${key} is declared PC-06 (bare array, no server total)`);
}
/** Neither B5.5 screen fabricates a list total. */
for (const file of CLOSING_DIR_FILES) {
  assert(
    !codeOnly(file).includes("toAccountingPager(") && !codeOnly(file).includes("pager={"),
    `${file} binds no server-total list pager — both Closing routes are PC-06 bare arrays`,
  );
}

/** Both Closing routes stay declared ORGANISATION scope, per batch 2's ruling — re-checked here in case a future edit "fixes" the label instead of the underlying model. */
for (const key of ["accounting.periods", "accounting.periodCloseRuns"]) {
  assert(
    getAccountingRoute(key).scope === "organization",
    `${key} is declared organisation data — batch 2 ruled these org-level BY DESIGN, and B5.5 must not silently narrow that`,
  );
}
const closingSource = CLOSING_DIR_FILES.map((file) => codeOnly(file)).join("\n");
assert(
  closingSource.includes("AccountingRouteScopeNote"),
  "both Closing screens label their organisation scope through the shared scope note, not bespoke prose",
);

/** Neither entity has a detail route — no `?periodId=`/`?runId=` state, no `GET .../:id` call, matching the B5.4 Posting-runs precedent exactly. */
for (const key of ["accounting.period", "accounting.periodCloseRun"]) {
  assert(
    ACCOUNTING_ROUTE_REGISTRY.every((entry) => entry.key !== key),
    `${key} is not a registered route — neither Fiscal periods nor Period close runs has a detail endpoint`,
  );
}
assert(
  !/router\.query\.periodId\b|router\.query\.runId\b/.test(closingSource),
  "neither Closing screen carries detail-view URL state for an entity with no detail route",
);

/** The fiscal-period lifecycle pipeline models exactly four linear stages, with no side-branch — unlike bank reconciliation, an unreadable status is the ONLY thing off the pipeline. */
assert(FISCAL_PERIOD_STATUSES.join(",") === "DRAFT,OPEN,CLOSED,LOCKED", "the fiscal period pipeline has four stages in lifecycle order");
assert(fiscalPeriodPipelineIndex("DRAFT") === 0, "DRAFT is stage 0");
assert(fiscalPeriodPipelineIndex("LOCKED") === 3, "LOCKED is the terminal stage 3, not off the pipeline");
assert(fiscalPeriodPipelineIndex(null) === -1, "an unreadable status is off the pipeline — the ONLY reason to be off it, since there is no real side-branch state");

/** countPeriodsByStatus / countCloseRunsByStatus fail closed on missing data, never to 0 (which would look like a real, confirmed empty count). */
assert(countPeriodsByStatus(undefined, "OPEN") === null, "an unread periods list fails closed to null, never 0");
assert(
  countPeriodsByStatus(
    [
      { id: "p1", name: "FY2026-Q3", status: "OPEN" },
      { id: "p2", name: "FY2026-07", status: "OPEN" },
      { id: "p3", name: "FY2026-06", status: "CLOSED" },
    ],
    "OPEN",
  ) === 2,
  "countPeriodsByStatus counts only the matching status",
);
assert(countCloseRunsByStatus(undefined, "COMPLETED") === null, "an unread close-runs list fails closed to null, never 0");
assert(
  countCloseRunsByStatus([{ id: "r1", status: "COMPLETED" }, { id: "r2", status: "COMPLETED" }], "COMPLETED") === 2,
  "countCloseRunsByStatus counts only the matching status",
);

/** toFiscalPeriodStatus / toPeriodCloseRunStatus both fail closed to null on an unrecognised value — never guessed into a real status. */
assert(toFiscalPeriodStatus("open") === "OPEN", "a lowercase status is normalised before matching");
assert(toFiscalPeriodStatus("ARCHIVED") === null, "an unrecognised fiscal-period status is null, never guessed onto a real stage");
assert(toFiscalPeriodStatus(undefined) === null, "a missing fiscal-period status is null");
assert(toPeriodCloseRunStatus("completed") === "COMPLETED", "a lowercase close-run status is normalised before matching");
assert(toPeriodCloseRunStatus("SUCCESS") === null, "an unrecognised close-run status is null, never guessed onto COMPLETED");
assert(PERIOD_CLOSE_RUN_STATUSES.join(",") === "PENDING,COMPLETED,FAILED", "the close-run status enum has exactly three members");
assert(PERIOD_CLOSE_RUN_STATUS_META.FAILED.tone === "danger", "a FAILED close run renders with danger tone, never success styling");

/** Fail-closed status rendering: both status badges exist and neither ever falls back to a styled real status on a bad value — asserted by reading the component source for the exact null-guard shape the shared badges use. */
const accountingNotesSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/shared/AccountingNotes.tsx`);
assert(
  accountingNotesSource.includes("AccountingPeriodCloseRunStatusBadge") &&
    /AccountingPeriodCloseRunStatusBadge[\s\S]{0,200}if \(!status\)/.test(accountingNotesSource),
  "AccountingPeriodCloseRunStatusBadge fails closed on a missing/unrecognised status before touching PERIOD_CLOSE_RUN_STATUS_META",
);

/** B5.5-F1 (new finding, this pass): FAILED and PENDING are unreachable through the live API — PeriodCloseRunsScreen must say so, not imply every enum member is equally attainable. */
const periodCloseRunsSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/closing/PeriodCloseRunsScreen.tsx`);
assert(/B5\.5-F1/.test(periodCloseRunsSource), "PeriodCloseRunsScreen discloses the B5.5-F1 finding by name");
assert(
  /FAILED/i.test(periodCloseRunsSource) === false || /never/i.test(periodCloseRunsSource),
  "PeriodCloseRunsScreen's prose does not merely mention FAILED without disclosing it is unreachable",
);
assert(/B5\.5-F1/.test(source(`${ACCOUNTING_LIB_DIR}/types.ts`)), "the PeriodCloseRunRow/PERIOD_CLOSE_RUN_STATUSES doc comment names the B5.5-F1 finding");

/**
 * C-27 was found in Track B5.5 (NOT in B0/batch 2/batch 3/the permissions
 * cutover): Manager's token held `pos:accounting:periods:create` (and
 * `accounts:create`, `cost-centers:create`) — a pre-existing M28-era seed
 * grant the 2026-08-20 cutover never audited or revoked. B5.5 disclosed the
 * finding and deliberately rendered NO create control despite the token
 * technically permitting one, matching every other B5 surface's read-first
 * posture pending an explicit owner grant. PERMS-2 (2026-08-21) turned that
 * stray grant into a deliberate full one (open/close/lock too), and Track
 * B5.7 (2026-08-22) is the first phase authorised to build on it — the
 * finding stays named for history, but the "render no control" half of the
 * ruling is INVERTED here: a real create control now exists.
 */
const fiscalPeriodsSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/closing/FiscalPeriodsScreen.tsx`);
assert(/C-27/.test(fiscalPeriodsSource), "FiscalPeriodsScreen discloses the C-27 finding by name");
assert(/C-27/.test(source(`${ACCOUNTING_LIB_DIR}/route-registry.ts`)), "the accounting.periods registry entry names the C-27 finding");
assert(
  /useCreateFiscalPeriod|createFiscalPeriodRequest/.test(fiscalPeriodsSource),
  "INVERTED (Track B5.7): FiscalPeriodsScreen now renders a real create control — C-27's grant was made deliberate by PERMS-2 and B5.7 built on it",
);
assert(
  /useOpenFiscalPeriod|openFiscalPeriodRequest/.test(fiscalPeriodsSource) &&
    /useCloseFiscalPeriod|closeFiscalPeriodRequest/.test(fiscalPeriodsSource) &&
    /useLockFiscalPeriod|lockFiscalPeriodRequest/.test(fiscalPeriodsSource),
  "FiscalPeriodsScreen calls real open, close AND lock write functions (Track B5.7)",
);
/** Lock is irreversible (PC-07: no unlock route) — the dialog requires the period's own name to be typed before it enables, not a generic confirm. */
assert(
  /Type ".*" to confirm/.test(fiscalPeriodsSource) || /lockConfirmName/.test(fiscalPeriodsSource),
  "FiscalPeriodsScreen's Lock action requires the acting Manager to name the period before it enables, not a generic 'Are you sure?'",
);

/**
 * No interactive control anywhere in the REST of the Closing tree —
 * PeriodCloseRunsScreen stays list-only/read-only through B5.7 (period close
 * runs are a byproduct of Close, not a surface with their own writes).
 * FiscalPeriodsScreen is excluded from this ban now that it is B5.7
 * write-enabled — its writes are positively asserted above instead.
 */
const periodCloseRunsOnlySource = CLOSING_DIR_FILES.filter((file) => !file.endsWith("/FiscalPeriodsScreen.tsx"))
  .map((file) => codeOnly(file))
  .join("\n");
for (const banned of ["<Button", "<IconButton", "onClick=", "type=\"submit\"", "useMutation"]) {
  assert(!periodCloseRunsOnlySource.includes(banned), `no interactive control or write function (${banned}) renders in PeriodCloseRunsScreen`);
}

/** Both period.* KPI placeholders on the B5.1 dashboard card are gone — every Closing KPI now links into a real B5.5 surface. */
for (const key of ["period.current", "period.open", "period.closeRuns"]) {
  const binding = getAccountingKpi(key);
  assert(binding.drillIn !== null, `KPI ${key} now links into a real B5.5 surface instead of a "not yet" note`);
}
assert(getAccountingKpi("period.current").drillIn === ACCOUNTING_ROUTES.fiscalPeriods, "the current-period KPI links to the Fiscal periods list");
assert(getAccountingKpi("period.open").drillIn === ACCOUNTING_ROUTES.fiscalPeriods, "the open-periods KPI links to the Fiscal periods list");
assert(getAccountingKpi("period.closeRuns").drillIn === ACCOUNTING_ROUTES.periodCloseRuns, "the close-runs KPI links to the Period close runs list");

/** The dashboard card itself was NOT rewritten — B5.1 already built it correctly (fail-closed status, org-level footnote, unpaginated-count label); only the registry's drillIn changed. */
const periodCardSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/cards/AccountingPeriodCard.tsx`);
assert(
  periodCardSource.includes("currentFiscalPeriod") && periodCardSource.includes("AccountingPeriodStatusBadge"),
  "AccountingPeriodCard still resolves the current period by date window and renders the fail-closed status badge",
);

for (const file of CLOSING_DIR_FILES) {
  assert(!codeOnly(file).includes("EventSource") && !codeOnly(file).includes("new WebSocket"), `${file} contains no streaming client`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. TRACK B5.6 — CONFIGURATION + REPORTING, WRITE-ENABLED
//     (the write route registry, confirm-before-destroy, the always-explicit
//     boolean footguns, model-helper correctness, no hard delete anywhere,
//     and the seven-file write-affordance allow-list closes exactly here)
// ═══════════════════════════════════════════════════════════════════════════

const B56_REPORTING_FILES = [
  `${ACCOUNTING_COMPONENT_DIR}/reporting/BudgetsScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/reporting/DemandCalendarScreen.tsx`,
  `${ACCOUNTING_COMPONENT_DIR}/reporting/ForecastScreen.tsx`,
];
const B56_CONFIGURATION_FILES = accountingComponentFiles.filter((file) => file.includes("/accounting/configuration/"));
assert(B56_CONFIGURATION_FILES.length === 4, `B5.6 ships 4 Configuration screens (found ${B56_CONFIGURATION_FILES.length})`);
for (const file of B56_REPORTING_FILES) {
  assert(existsSync(join(process.cwd(), file)), `${file} exists`);
}
const B56_ALL_SCREEN_FILES = [...B56_REPORTING_FILES, ...B56_CONFIGURATION_FILES];

/** Every one of the seven screens is on the write-enabled allow-list from §1 — the allow-list and the actual file set cannot drift apart. */
for (const file of B56_ALL_SCREEN_FILES) {
  assert(B56_WRITE_ENABLED_FILES.includes(file), `${file} is on the §1 write-enabled allow-list`);
}
assert(
  B56_WRITE_ENABLED_FILES.length === B56_ALL_SCREEN_FILES.length + 3,
  "the write-enabled allow-list is exactly the 7 screens plus write-api.ts, route-registry.ts and accounting-configuration-queries.ts — nothing extra snuck in",
);

/** Every entry in the write registry is reachable by Manager and cites a real /api/ path. */
for (const entry of ACCOUNTING_WRITE_ROUTE_REGISTRY) {
  assert(entry.manager === "allowed", `${entry.key} is reachable by Manager (PERMS-2)`);
  assert(entry.path.startsWith("/api/"), `${entry.key} declares a real API path`);
  assert(entry.observed.length > 20, `${entry.key} records what the live probe actually observed`);
}
/**
 * INVERTED 2026-08-22 (Track B5.7): this was "exactly 9" through B5.6. B5.7
 * added 10 more entries to the SAME registry array (posting-error resolve +
 * dismiss, fiscal period create/open/close/lock, reconciliation match/skip/
 * complete, journal reverse) — 19 total. The exact-count discipline is kept,
 * just re-pointed at the new total, so a stray 20th entry still fails loud.
 */
assert(ACCOUNTING_WRITE_ROUTE_REGISTRY.length === 19, `the write registry carries exactly 19 entries — 9 from Track B5.6 + 10 from Track B5.7 (found ${ACCOUNTING_WRITE_ROUTE_REGISTRY.length})`);
let threwOnUnknownWriteKey = false;
try {
  getAccountingWriteRoute("totally.made.up.write");
} catch {
  threwOnUnknownWriteKey = true;
}
assert(threwOnUnknownWriteKey, "an unregistered write route key throws rather than being called");

/** write-api.ts issues every write through the registry lookups, never a hand-typed path for a write route. */
const writeApiSource = codeOnly(`${ACCOUNTING_LIB_DIR}/write-api.ts`);
assert(writeApiSource.includes("getAccountingWriteRoute("), "write-api.ts resolves write paths through the write registry");
assert(
  writeApiSource.includes("function writePath") && writeApiSource.includes("writePath("),
  "write-api.ts funnels every non-parameterised write path through one writePath() helper (itself backed by getAccountingWriteRoute), rather than resolving the registry inline at each call site",
);

/** The one GET-with-a-side-effect route is explicitly flagged, not silently indistinguishable from a pure write. */
const forecastRefreshEntry = getAccountingWriteRoute("franchise.forecast.refresh");
assert(forecastRefreshEntry.method === "GET" && forecastRefreshEntry.sideEffect === true, "the forecast refresh route is flagged as a side-effecting GET, not a POST");
assert(
  ACCOUNTING_WRITE_ROUTE_REGISTRY.filter((entry) => entry.method === "GET").length === 1,
  "exactly one write-registry entry is a GET (the forecast refresh) — every other B5.6 write is a real POST/PATCH",
);

/** No hard DELETE is ever issued anywhere in the accounting tree — the demand-calendar DELETE route exists at the API layer but this module deliberately never calls it (the dangling-ForecastRun-reference footgun). */
assert(
  !accountingSource.includes('method: "DELETE"') && !accountingSource.includes("method: 'DELETE'"),
  "no accounting write ever uses method: DELETE — Archive (PATCH isActive:false) is the only destructive affordance offered",
);
assert(
  !ACCOUNTING_WRITE_ROUTE_REGISTRY.some((entry) => entry.method === "DELETE"),
  "the write registry itself carries no DELETE entry — it was deliberately never added, matching the screen-level ban",
);

/** Confirm-before-destroy: every one of the 7 screens that mounts a mutation also mounts the shared confirm dialog — no mutation fires straight off a click. */
for (const file of B56_ALL_SCREEN_FILES) {
  const code = codeOnly(file);
  if (!/useMutation|Mutation\(\)/.test(code) && !/use(Create|Update|Refresh)/.test(code)) continue;
  assert(code.includes("ActionConfirmDialog"), `${file} confirms every write through the shared ActionConfirmDialog`);
}

/** Model-helper correctness: isBudgetArchived. */
assert(isBudgetArchived("ARCHIVED") === true, "an ARCHIVED budget is recognised");
assert(isBudgetArchived("ACTIVE") === false, "an ACTIVE budget is not archived");
assert(isBudgetArchived(null) === false, "an unreadable status is treated as NOT archived — refresh actuals stays available rather than hiding behind a rendering glitch");

/** Model-helper correctness: isDemandCalendarWindowValid mirrors the backend's dateEnd >= dateStart invariant. */
assert(isDemandCalendarWindowValid("2026-01-05", "2026-03-29") === true, "dateEnd after dateStart is valid");
assert(isDemandCalendarWindowValid("2026-03-29", "2026-01-05") === false, "dateEnd before dateStart is invalid");
assert(isDemandCalendarWindowValid("2026-01-05", "2026-01-05") === true, "an identical dateStart/dateEnd is valid (>=, not >)");
assert(isDemandCalendarWindowValid("", "2026-01-05") === null, "an incomplete window is null, not a guessed validity");
assert(isDemandCalendarWindowValid("not-a-date", "2026-01-05") === null, "an unparseable date fails closed to null, never true");

/** Model-helper correctness: isPostingSourceMapValid guards the same-account footgun the backend does NOT itself reject. */
assert(isPostingSourceMapValid("acct-a", "acct-b") === true, "distinct debit/credit accounts are valid");
assert(isPostingSourceMapValid("acct-a", "acct-a") === false, "an identical debit/credit account is invalid — the backend accepts it, so the form must refuse it");
assert(isPostingSourceMapValid(null, "acct-b") === null, "an incomplete selection is null, not a guessed validity");

/** Model-helper correctness: buildTaxConfigWritePayload ALWAYS includes `active` explicitly — the omission footgun this exists to prevent. */
const inactivePayload = buildTaxConfigWritePayload({ active: false });
assert(
  Object.prototype.hasOwnProperty.call(inactivePayload, "active") && inactivePayload.active === false,
  "buildTaxConfigWritePayload always includes `active` explicitly — omitting it would silently reactivate the config (dto.active ?? true)",
);
const activePayload = buildTaxConfigWritePayload({ outputTaxAccountId: "acct-out", active: true });
assert(activePayload.outputTaxAccountId === "acct-out" && activePayload.active === true, "buildTaxConfigWritePayload passes through a supplied account id");
assert(activePayload.inputTaxAccountId === undefined, "buildTaxConfigWritePayload omits an unsupplied account id as undefined, not an empty string (Prisma/DTO treat undefined as 'no change')");

/** The posting-source-maps screen always sends costCenterRequired/active explicitly — never omits the two booleans the service treats as "don't touch this field" when absent. */
const postingSourceMapsScreenSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/configuration/PostingSourceMapsScreen.tsx`);
assert(
  postingSourceMapsScreenSource.includes("costCenterRequired,") && postingSourceMapsScreenSource.includes("active,"),
  "PostingSourceMapsScreen always sends costCenterRequired and active as explicit values in the PATCH payload",
);

/** Budget/demand-calendar/account/cost-centre enums are real, closed sets — not hand-typed strings. */
assert(BUDGET_TYPES.join(",") === "OPERATIONAL,FINANCIAL", "the budget type enum has exactly two members");
assert(DEMAND_CALENDAR_TYPES.length === 8, "the demand calendar type enum has exactly 8 members, matching DemandCalendarType in schema.prisma");

/** The seven B5.6 pages exist at the routes menu.ts cites, and ACCOUNTING_ROUTES declares no stray extra path. */
for (const key of ["budgets", "demandCalendar", "forecast", "chartOfAccounts", "costCentres", "postingSourceMaps", "taxConfig"] as const) {
  assert(typeof ACCOUNTING_ROUTES[key] === "string" && ACCOUNTING_ROUTES[key].startsWith("/manager/accounting/"), `ACCOUNTING_ROUTES.${key} is declared`);
}

/** Every B5.6 screen reuses the B1 chrome primitives — no forked list/control-panel/dialog component. */
const b56Source = B56_ALL_SCREEN_FILES.map((file) => codeOnly(file)).join("\n");
assert(b56Source.includes("ManagerContentShell") && b56Source.includes("ManagerControlPanel"), "the B5.6 screens compose the shared B1 chrome primitives");
assert(b56Source.includes("ManagerListTable"), "the B5.6 list surfaces reuse ManagerListTable rather than a hand-rolled table");
assert(!b56Source.includes("@phosphor-icons/react"), "no B5.6 screen imports an icon library directly");
assert(!b56Source.includes("new Blob("), "no B5.6 screen synthesises a file client-side");
assert(!b56Source.includes("recharts") && !b56Source.includes("chart.js"), "no B5.6 screen adds a charting dependency");

/** The write-enabled surfaces are visibly labelled "Read + write" (or the Forecast-specific "Read + refresh") — never silently indistinguishable from a read-only B5.1–B5.5 surface. */
for (const file of B56_ALL_SCREEN_FILES) {
  const code = codeOnly(file);
  assert(/Read \+ (write|refresh)/.test(code), `${file} visibly labels itself as write-enabled, distinct from the read-only badge every earlier surface carries`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 17. TRACK B5.7 — RETROFIT WRITES OVER B5.1–B5.5
//     (posting-error resolve/dismiss, fiscal period create/open/close/lock,
//     bank reconciliation match/skip/complete, journal reverse — confirm-
//     before-destroy, the Lock-requires-typed-name friction, C-28 audit
//     branch-stamping already verified at the backend layer in the API suite)
// ═══════════════════════════════════════════════════════════════════════════

assert(existsSync(join(process.cwd(), `${MANAGER_LIB_DIR}/accounting-transitions-queries.ts`)), "the B5.7 mutation-hook file exists");

/** Every one of the five B5.7 screen/hook files is on the §1 write-enabled allow-list — the allow-list and the actual file set cannot drift apart, mirroring the B5.6 §16 check above. */
for (const file of B57_WRITE_ENABLED_FILES) {
  assert(WRITE_ENABLED_FILES.includes(file), `${file} is on the §1 write-enabled allow-list`);
}

/** Confirm-before-destroy: every B5.7 screen that mounts a mutation also mounts the shared confirm dialog — no mutation fires straight off a click. */
const B57_SCREEN_FILES = B57_WRITE_ENABLED_FILES.filter((file) => file.endsWith(".tsx"));
for (const file of B57_SCREEN_FILES) {
  const code = codeOnly(file);
  assert(code.includes("ActionConfirmDialog"), `${file} confirms every write through the shared ActionConfirmDialog`);
}

/** Lock is irreversible (PC-07: no unlock route anywhere in this API) — re-checked here by name, not only inside §15's C-27 block. */
assert(
  /confirmDisabled=\{!lockConfirmMatches\}/.test(codeOnly(`${ACCOUNTING_COMPONENT_DIR}/closing/FiscalPeriodsScreen.tsx`)),
  "FiscalPeriodsScreen's Lock confirm button stays disabled until the typed period name matches — a generic tone/confirm-label alone is not enough friction for a one-way door",
);

/** Every B5.7 write function funnels through the write registry, same discipline as B5.6 — no hand-typed accounting path outside write-api.ts. */
assert(writeApiSource.includes("resolvePostingErrorRequest") && writeApiSource.includes("dismissPostingErrorRequest"), "write-api.ts exports the B5.7 posting-error write functions");
assert(
  writeApiSource.includes("createFiscalPeriodRequest") &&
    writeApiSource.includes("openFiscalPeriodRequest") &&
    writeApiSource.includes("closeFiscalPeriodRequest") &&
    writeApiSource.includes("lockFiscalPeriodRequest"),
  "write-api.ts exports all four B5.7 fiscal-period write functions",
);
assert(
  writeApiSource.includes("matchReconciliationLineRequest") &&
    writeApiSource.includes("skipReconciliationLineRequest") &&
    writeApiSource.includes("completeReconciliationRequest"),
  "write-api.ts exports all three B5.7 bank-reconciliation write functions",
);
assert(writeApiSource.includes("reverseJournalRequest"), "write-api.ts exports the B5.7 journal-reverse write function");

/** No B5.7 write mutation invalidates a blanket ["manager"] cache sweep (CLAUDE.md §15) — every hook narrows to its own surface's query-key prefix. */
const transitionsQueriesSource = codeOnly(`${MANAGER_LIB_DIR}/accounting-transitions-queries.ts`);
assert(
  !/invalidateQueries\(\{\s*queryKey:\s*\["manager"\]\s*\}\)/.test(transitionsQueriesSource),
  "accounting-transitions-queries.ts never invalidates a blanket [\"manager\"] cache sweep",
);
assert(
  (transitionsQueriesSource.match(/invalidateQueries/g) || []).length >= 8,
  "every one of the eight B5.7 mutations narrowly invalidates its own surface's query-key prefix",
);

/** Journal reverse is only offered on a POSTED journal — DRAFT/REVERSED render no Reverse control, matching the backend's own 409 guard. */
assert(
  /canReverse\s*=\s*\(journal\?\.status[\s\S]{0,40}===\s*"POSTED"/.test(journalsSource),
  "JournalsScreen gates the Reverse control on status === POSTED, not rendered unconditionally",
);

console.log("Manager B5.1 + B5.2 + B5.3 + B5.4 + B5.5 + B5.6 + B5.7 assertions: all checks passed.");
