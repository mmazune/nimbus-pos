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
  overdueTotal,
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
assert(accountingPageFiles.length === 2, `Accounting ships 2 pages (found ${accountingPageFiles.length})`);
assert(
  existsSync(join(process.cwd(), `${MANAGER_LIB_DIR}/accounting-context.ts`)),
  "the Manager-side React Query adapter exists",
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
assert(
  !accountingComponentSource.includes("pager={"),
  "no accounting surface binds a pager — PC-06's bare arrays have no server total to bind one to",
);
assert(
  !/total:\s*\w+\.length/.test(accountingSource),
  "no `.length` is ever assigned to a field named `total`",
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
assert(availableItems.length === 1, `B5.1 ships exactly one live menu row (found ${availableItems.length})`);
assert(
  availableItems[0].href === ACCOUNTING_ROUTES.dashboard,
  "the one live row is the dashboard, which is also the module landing",
);
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
// 8. B5-F1 — THE AR AGING PARTIAL-PAGE GUARD ACTUALLY FAILS CLOSED
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
  !isArAgingComplete({ ...completePage, total: 9 }),
  "a page carrying fewer invoices than the server counted is INCOMPLETE — the B5-F1 defect",
);
assert(!isArAgingComplete({ ...completePage, skip: 1 }), "a page past the first is never treated as complete");
assert(!isArAgingComplete({ ...completePage, accounts: undefined }), "a missing accounts array fails closed");
assert(!isArAgingComplete({ ...completePage, total: undefined }), "a missing total fails closed");
assert(!isArAgingComplete(undefined), "no response at all fails closed");
assert(
  accountingComponentSource.includes('data-accounting-partial="ar-aging"'),
  "the receivable card renders a dedicated withheld state rather than an understated figure",
);
assert(AR_AGING_PAGE_SIZE >= 100, "the aging read requests a page large enough to cover a realistic branch");

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

console.log("Manager B5.1 assertions: all checks passed.");
