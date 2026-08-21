import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

import {
  ACCOUNTING_MENU,
  ACCOUNTING_OMITTED_ITEMS,
  ACCOUNTING_SUBPHASES,
  accountingMenuItems,
  assertAccountingMenuIsBacked,
} from "../src/lib/accounting/menu";
import {
  ACCOUNTING_DENIED_WRITES,
  ACCOUNTING_ROUTE_REGISTRY,
  getAccountingRoute,
} from "../src/lib/accounting/route-registry";
import { ACCOUNTING_LANDING, ACCOUNTING_ROOT, ACCOUNTING_ROUTES } from "../src/lib/accounting/routes";
import {
  ACCOUNTING_KPI_BINDINGS,
  AR_AGING_PAGE_SIZE,
  countActiveReconciliations,
  countPeriodsByStatus,
  currentFiscalPeriod,
  FISCAL_PERIOD_STATUSES,
  formatAccountingCount,
  formatAccountingMoney,
  getAccountingKpi,
  getAccountingKpiRoute,
  isArAgingComplete,
  isJournalBalanced,
  isJournalReadableInBranch,
  isReconciliationBalanced,
  overdueTotal,
  reconciliationPipelineIndex,
  RECONCILIATION_PIPELINE,
  sumJournalLineAmounts,
  toAccountingAmount,
  toAccountingCount,
  toApAgingBuckets,
  toArAgingBuckets,
  toFiscalPeriodStatus,
  unpaginatedCountLabel,
} from "../src/lib/accounting/model";
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
 * runs, Posting errors, Audit trail) — 20 total. Exact equality on purpose: a
 * page appearing here with no matching `available:true` menu row below (or
 * vice versa) is exactly the drift this gate exists to catch.
 */
assert(accountingPageFiles.length === 20, `Accounting ships 20 pages (found ${accountingPageFiles.length})`);
assert(
  existsSync(join(process.cwd(), `${MANAGER_LIB_DIR}/accounting-context.ts`)),
  "the Manager-side React Query adapter exists",
);
assert(
  existsSync(join(process.cwd(), `${MANAGER_LIB_DIR}/accounting-surface-queries.ts`)),
  "the Customers/Vendors list+detail React Query adapter exists (B5.2)",
);

// ═══════════════════════════════════════════════════════════════════════════
// 1. RULING 2 — MANAGER ACCOUNTING IS READ-ONLY. NO WRITE AFFORDANCE AT ALL.
// ═══════════════════════════════════════════════════════════════════════════

const WRITE_METHODS = /method:\s*["'](POST|PATCH|PUT|DELETE)["']/;

for (const file of accountingFiles) {
  const code = codeOnly(file);
  assert(!WRITE_METHODS.test(code), `${file} issues no write request (Manager holds zero accounting writes — PC-01)`);
  assert(!/useMutation/.test(code), `${file} mounts no mutation hook`);
}

/**
 * The whole-tree sweep: no mutation ANYWHERE under `components/manager` or
 * `lib/manager` may target an accounting route. B3 established that a Manager
 * mutation must be individually allow-listed; this narrows it further for the
 * accounting block, where the allowed count is zero.
 */
const ACCOUNTING_PATH_FRAGMENTS = [
  "/api/accounting",
  "/api/finance",
  "/api/franchise/forecast",
];

for (const file of managerTreeFiles) {
  const code = codeOnly(file);
  if (!WRITE_METHODS.test(code)) continue;
  for (const fragment of ACCOUNTING_PATH_FRAGMENTS) {
    assert(
      !code.includes(fragment),
      `${file} contains a write AND an accounting path (${fragment}) — Manager holds no accounting write`,
    );
  }
}

/** No disabled-button escape hatch either: the ruling forbids even a greyed-out control. */
const accountingComponentSource = accountingComponentFiles.map((file) => codeOnly(file)).join("\n");
for (const banned of ["<Button", "<IconButton", "onClick=", "type=\"submit\""]) {
  assert(
    !accountingComponentSource.includes(banned),
    `no interactive control (${banned}) renders in the accounting tree — where an Odoo user expects an action, B5.1 shows an honest note instead`,
  );
}

assert(
  ACCOUNTING_DENIED_WRITES.length >= 8,
  "the denied-write disclosure names every action an accounting workspace normally offers",
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
 * errors, Audit trail — 19 total. Exact equality: a menu row available with
 * no matching page (or vice versa) is exactly the drift `accountingPageFiles`
 * above also gates.
 */
assert(availableItems.length === 19, `Accounting ships 19 live menu rows (found ${availableItems.length})`);
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
const ALL_AVAILABLE_KEYS = [...B52_AVAILABLE_KEYS, ...B53_AVAILABLE_KEYS, ...B54_AVAILABLE_KEYS];
assert(
  new Set(availableItems.map((item) => item.key)).size === ALL_AVAILABLE_KEYS.length &&
    ALL_AVAILABLE_KEYS.every((key) => availableItems.some((item) => item.key === key)),
  "exactly the 19 named rows are available — no undocumented row was made live, and none was missed",
);
/** The two rows B5.4 deliberately did NOT touch stay tagged for their real sub-phase, not B5.4's. */
assert(
  menuItems.find((item) => item.key === "accounting-periods" && !item.available && item.subphase === "B5.5"),
  "Fiscal periods stays a B5.5 not-yet row — it is Closing, not Accounting core (an operator brief for this phase described it as B5.4; the menu tree's own tags, unchanged since B5.1, say B5.5)",
);
assert(
  menuItems.find((item) => item.key === "accounting-period-close-runs" && !item.available && item.subphase === "B5.5"),
  "Period close runs stays a B5.5 not-yet row",
);
for (const key of ["accounting-chart-of-accounts", "accounting-posting-source-maps", "accounting-tax-config"]) {
  assert(
    menuItems.find((item) => item.key === key && !item.available && item.subphase === "B5.6"),
    `${key} stays a B5.6 not-yet row — Configuration, not Accounting core`,
  );
}
assert(ACCOUNTING_LANDING === ACCOUNTING_ROUTES.dashboard, "the module landing is the dashboard");
assert(ACCOUNTING_ROOT === "/manager/accounting", "the module root is /manager/accounting");

for (const item of menuItems) {
  if (item.available) continue;
  assert(
    (ACCOUNTING_SUBPHASES as readonly string[]).includes(item.subphase),
    `not-yet row "${item.key}" is tagged with a real sub-phase (found ${item.subphase})`,
  );
}

/** A route Manager cannot read must be ABSENT, not a not-yet row. */
const menuRouteKeys = new Set(menuItems.flatMap((item) => item.routeKeys));
assert(
  !menuRouteKeys.has("finance.procurementSuggestions"),
  "procurement suggestions are ABSENT from the menu — Manager is 403 on them (PC-02)",
);
assert(
  getAccountingRoute("finance.procurementSuggestions").manager === "forbidden",
  "the registry records the procurement 403 rather than leaving it implicit",
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
assert(
  /READ-ONLY BY PERMISSION/.test(accountingSurface!.scopeNote || ""),
  "the allow-list records that read-only is a permission fact, not merely a product choice",
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

const B52_REPORTING_FILES = accountingComponentFiles.filter((file) => file.includes("/reporting/"));
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

/** No match/skip/complete affordance anywhere in the bank tree — Manager holds the read permission only (PC-01). */
for (const file of BANK_DIR_FILES) {
  const code = codeOnly(file);
  assert(!/\bmatchLine\b|\bskipLine\b|\bcompleteReconciliation\b/.test(code), `${file} calls no match/skip/complete function`);
}
assert(
  accountingComponentSource.includes("AccountingReadOnlyCard") &&
    BANK_DIR_FILES.some((file) => codeOnly(file).includes("AccountingReadOnlyCard")),
  "the bank screens disclose the denied match/skip/complete actions in words",
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
//     (server-total pagination, balance tie-out, the C-25 branch fail-safe,
//     the B5.4-D1 honest "no resolve/dismiss endpoint" disclosure)
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
 * B5.4-D1 (new finding, this pass): unlike every other Manager-cannot-write
 * surface, there is genuinely no resolve/dismiss endpoint for PostingError at
 * all — for any role. PostingErrorsScreen must therefore say so in its own
 * words rather than reuse `AccountingReadOnlyCard`'s "an Owner or Accountant
 * performs this" copy, which would be false here.
 */
const postingErrorsSource = codeOnly(`${ACCOUNTING_COMPONENT_DIR}/review/PostingErrorsScreen.tsx`);
assert(
  !postingErrorsSource.includes("AccountingReadOnlyCard"),
  "PostingErrorsScreen does not reuse AccountingReadOnlyCard's 'an Owner or Accountant performs this' copy — no role can resolve/dismiss a posting error through this API, so that claim would be false",
);
assert(
  /no endpoint exists/i.test(postingErrorsSource) || /No role can act/i.test(postingErrorsSource),
  "PostingErrorsScreen states the genuine backend gap in its own words",
);
assert(
  !/\bresolvePostingError\b|\bdismissPostingError\b/.test(accountingSource),
  "no resolve/dismiss function exists anywhere in the accounting tree — none is being called against a route that was never built",
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

console.log("Manager B5.1 + B5.2 + B5.3 + B5.4 assertions: all checks passed.");
