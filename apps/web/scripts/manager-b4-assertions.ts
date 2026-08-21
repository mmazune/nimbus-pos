import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

import { managerRoutes } from "../src/lib/manager/routes";
import { managerTopNavMenus } from "../src/lib/manager/top-nav";
import { managerSurfaces } from "../src/lib/manager/permissions";
import { managerCaveats } from "../src/lib/manager/state";
import {
  MANAGER_REPORT_CATEGORIES,
  countManagerReportAvailability,
  filterManagerReportCatalog,
  managerReportAvailability,
  managerReportUnavailableReason,
  projectManagerReportCatalogEntry,
} from "../src/lib/manager/reports-catalog";
import {
  MANAGER_REPORT_RUN_STATUSES,
  MANAGER_REPORT_WINDOWS,
  formatManagerBreakdownCell,
  isManagerBreakdownColumnNumeric,
  managerReportLabel,
  projectManagerReportRun,
  toManagerReportBreakdown,
  toManagerReportSummaryEntries,
} from "../src/lib/manager/reports-model";
import {
  MANAGER_REPORTS_LANDING,
  MANAGER_REPORTS_ROUTES,
  readManagerReportCategory,
  readManagerReportKey,
  readManagerRunId,
  readManagerRunStatus,
} from "../src/lib/manager/reports-route";
import { buildManagerReportRunsPath, MANAGER_REPORTS_PAGE_SIZE } from "../src/lib/manager/reports-api";

/**
 * Track B4 — Manager Reports static assertions.
 *
 * Encodes the prompt's five guards plus the roadmap's own B4 acceptance gates
 * as executable checks:
 *
 *   1. no PDF affordance anywhere;
 *   2. no graph / pivot component, and the view switcher does not advertise them;
 *   3. unavailable generators never call an endpoint;
 *   4. every reports query is bounded, branch-scoped and `["manager", …]`-keyed;
 *   5. UGX money goes through the shared zero-fraction formatter.
 *
 * plus: no file is synthesized client-side, no row table is derived from
 * `rowCount`, and a run's own `branchId` is displayed (MP0-12).
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Manager B4 assertion failed: ${message}`);
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

const MANAGER_COMPONENT_DIR = "apps/web/src/components/manager";
const MANAGER_LIB_DIR = "apps/web/src/lib/manager";
const MANAGER_PAGES_DIR = "apps/web/src/pages/manager";

const reportComponentFiles = listFiles(`${MANAGER_COMPONENT_DIR}/reports`);
const reportLibFiles = [
  `${MANAGER_LIB_DIR}/reports-api.ts`,
  `${MANAGER_LIB_DIR}/reports-catalog.ts`,
  `${MANAGER_LIB_DIR}/reports-context.ts`,
  `${MANAGER_LIB_DIR}/reports-model.ts`,
  `${MANAGER_LIB_DIR}/reports-route.ts`,
  `${MANAGER_LIB_DIR}/reports-types.ts`,
];
const reportPageFiles = listFiles(`${MANAGER_PAGES_DIR}/reports`);
const reportFiles = [...reportComponentFiles, ...reportLibFiles, ...reportPageFiles];

const managerFiles = [
  ...listFiles(MANAGER_COMPONENT_DIR),
  ...listFiles(MANAGER_LIB_DIR),
  ...listFiles(MANAGER_PAGES_DIR),
];

assert(reportComponentFiles.length === 5, `Reports ships 5 component files (found ${reportComponentFiles.length})`);
assert(reportPageFiles.length === 3, `Reports ships 3 pages (found ${reportPageFiles.length})`);
for (const file of reportLibFiles) {
  assert(existsSync(join(process.cwd(), file)), `${file} exists`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. GUARD — no PDF affordance anywhere
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The distinction that matters: **prose may name PDF, a CONTROL may not.**
 *
 * B4 deliberately DISCLOSES that pre-2026-08-20 PDF artifacts exist on old runs
 * and that Nimbus has no PDF renderer — that honesty is the point, and it is the
 * same lesson B3 learned when an over-broad grep flagged its own privacy
 * disclosure. So the checks below target code, not copy: no format variable can
 * carry "PDF", and no `.pdf` filename is ever constructed.
 */
for (const file of reportFiles) {
  const code = codeOnly(file);

  assert(
    !/format:\s*["'`]PDF["'`]/i.test(code),
    `no code path requests a PDF export (${file})`,
  );
  assert(
    !/["'`]application\/pdf["'`]/i.test(code),
    `no PDF mime type is constructed (${file})`,
  );
  assert(!/\.pdf["'`]/i.test(code), `no .pdf filename is constructed (${file})`);
}

// The export helper hard-codes CSV rather than taking a format parameter, so a
// PDF request cannot be constructed by a caller.
const reportsApi = codeOnly(`${MANAGER_LIB_DIR}/reports-api.ts`);
assert(
  /format:\s*["'`]CSV["'`]/.test(reportsApi),
  "the export request hard-codes format: CSV",
);
assert(
  !/format\s*[,:)]\s*$/m.test(reportsApi) && !/\bformat\s*:\s*ExportFormat\b/.test(reportsApi),
  "the export helper exposes no caller-supplied format parameter",
);

// The catalog projection strips PDF even if the backend re-advertised it.
const reportsCatalog = codeOnly(`${MANAGER_LIB_DIR}/reports-catalog.ts`);
assert(
  /filter\(\(format\)\s*=>\s*format\s*!==\s*["'`]PDF["'`]\)/.test(reportsCatalog),
  "the catalog projection filters PDF out of the advertised formats",
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. GUARD — no graph / pivot (C-03), not even advertised
// ═══════════════════════════════════════════════════════════════════════════

for (const file of reportFiles) {
  const code = codeOnly(file);
  for (const banned of ["PivotView", "GraphView", "ManagerViewSwitcher", "Chart", "recharts", "d3"]) {
    assert(!code.includes(banned), `no graph/pivot component "${banned}" in Reports (${file})`);
  }
}

const reportsMenu = managerTopNavMenus.find((menu) => menu.key === "reports");
assert(reportsMenu, "the Reports top-nav menu exists");
const reportsMenuItems = (reportsMenu?.groups || []).flatMap((group) => group.items);
assert(
  !reportsMenuItems.some((item) => /graph|pivot/i.test(item.label)),
  "the Reports menu does not advertise a graph or pivot view (gated on C-03)",
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. GUARD — unavailable generators never reach an endpoint
// ═══════════════════════════════════════════════════════════════════════════

const implemented = projectManagerReportCatalogEntry({
  key: "DAILY_SALES",
  title: "Daily Sales Report",
  description: "d",
  status: "IMPLEMENTED",
  formats: ["CSV"],
  permission: "pos:reports:daily-sales:generate",
});
const pendingLater = projectManagerReportCatalogEntry({
  key: "PAYROLL_SUMMARY",
  title: "Payroll Summary",
  description: "d",
  status: "PENDING_LATER",
  formats: ["CSV"],
  permission: "pos:reports:history:read",
  dependencyMilestone: "M30 — Payroll Engine + Pay Runs + Payslips",
});
const conditional = projectManagerReportCatalogEntry({
  key: "MENU_ENGINEERING",
  title: "Menu Engineering",
  description: "d",
  status: "CONDITIONAL",
  formats: ["CSV"],
  permission: "pos:reports:sales-by-category:generate",
  notes: "Depends on M8 recipe costing data quality.",
});

assert(implemented.availability === "available", "an IMPLEMENTED entry is available");
assert(implemented.generatorPath === "daily-sales", "an IMPLEMENTED entry carries its POST path");
assert(pendingLater.availability === "unavailable", "a PENDING_LATER entry is unavailable");
assert(
  pendingLater.generatorPath === null,
  "an unavailable entry has NO generator path — it is structurally uncallable",
);
assert(
  conditional.generatorPath === null && conditional.availability === "unavailable",
  "MENU_ENGINEERING is CONDITIONAL in the catalog but has no POST route, so it is not offered",
);
assert(
  /needs M30/.test(managerReportUnavailableReason(pendingLater) || ""),
  "the unavailable reason names the API's own dependency milestone",
);
assert(
  managerReportUnavailableReason(implemented) === null,
  "an available report has no unavailable reason",
);

// An unknown status fails CLOSED.
const unknownStatus = projectManagerReportCatalogEntry({
  key: "SOMETHING_NEW",
  title: "t",
  description: "d",
  status: "EXPERIMENTAL",
  formats: ["CSV"],
  permission: "p",
});
assert(
  unknownStatus.availability === "unavailable",
  "an unrecognised catalog status fails closed rather than being offered",
);

// The runtime guard: the generate action refuses an unavailable entry.
const reportsContext = codeOnly(`${MANAGER_LIB_DIR}/reports-context.ts`);
assert(
  /availability\s*===\s*["'`]unavailable["'`]\s*\|\|\s*!entry\.generatorPath/.test(reportsContext),
  "the generate action refuses an unavailable entry before dispatching",
);
assert(
  /if\s*\(!generatorPath\)/.test(reportsApi),
  "the generate request throws rather than building a URL without a generator path",
);

// Availability is driven by the catalog's own status, never a hand-kept list.
assert(
  managerReportAvailability("IMPLEMENTED", true) === "available" &&
    managerReportAvailability("IMPLEMENTED", false) === "unavailable" &&
    managerReportAvailability("PENDING_LATER", true) === "unavailable",
  "availability derives from the API's status AND the presence of a route",
);

// ═══════════════════════════════════════════════════════════════════════════
// 4. GUARD — bounded, branch-scoped, ["manager", …]-keyed queries
// ═══════════════════════════════════════════════════════════════════════════

const runsPath = buildManagerReportRunsPath({ page: 1 });
assert(
  runsPath.includes(`pageSize=${MANAGER_REPORTS_PAGE_SIZE}`),
  "the runs list always sends an explicit bounded pageSize (MP0-11)",
);
assert(
  buildManagerReportRunsPath({ page: -5 }).includes("page=1"),
  "a negative page clamps to 1",
);
assert(
  buildManagerReportRunsPath({ page: 2, status: "FAILED" }).includes("status=FAILED"),
  "the runs list forwards a validated status filter",
);
assert(
  MANAGER_REPORTS_PAGE_SIZE > 0 && MANAGER_REPORTS_PAGE_SIZE <= 100,
  "the reports page size is a sane explicit bound",
);
assert(
  reportsApi.includes('params.set("pageSize"'),
  "the runs path sets pageSize explicitly rather than relying on a server default",
);

// Every request in the module passes branchId (→ X-Branch-Id).
const apiCallCount = (reportsApi.match(/apiRequest</g) || []).length;
assert(apiCallCount >= 4, `the reports API layer issues its reads through apiRequest (${apiCallCount})`);
assert(
  (reportsApi.match(/branchId/g) || []).length >= apiCallCount,
  "every reports request carries a branchId",
);
assert(
  /"X-Branch-Id":\s*branchId/.test(reportsApi),
  "the raw-fetch download sends the branch header like every other read",
);

// Every query key is namespaced and branch-scoped.
const queryCount = (reportsContext.match(/useQuery\(/g) || []).length;
assert(queryCount === 3, `Reports mounts exactly 3 queries: catalog, runs list, run detail (${queryCount})`);
const queryKeyCount = (reportsContext.match(/managerQueryKey\(/g) || []).length;
// 3 query keys + 3 narrow post-mutation invalidations, all namespaced.
assert(
  queryKeyCount === 6,
  `every reports key AND every invalidation goes through managerQueryKey (${queryKeyCount})`,
);
assert(
  !/invalidateQueries\(\s*\{\s*queryKey:\s*\[["'`]manager["'`]\]\s*\}/.test(reportsContext),
  "post-mutation refresh is narrow — it never sweeps the whole manager namespace",
);
assert(
  !/queryKey:\s*\[/.test(reportsContext),
  "no reports query builds a raw array key that could skip the manager namespace",
);
for (const surface of ["reports-runs", "reports-run-detail"]) {
  assert(reportsContext.includes(`"${surface}"`), `the ${surface} query key exists`);
}

/**
 * The catalog SHARES the M-P1 readiness strip's key and fetcher.
 *
 * `GET /api/reports/catalog` is issued on every Manager page by the readiness
 * strip. B4's first implementation added a second key, and the catalog page then
 * fetched the same endpoint TWICE on one load — measured live, and exactly the
 * duplicate-query regression CLAUDE.md §15 forbids. This pins the fix.
 */
assert(
  reportsContext.includes('managerQueryKey("report-catalog"'),
  "the Reports catalog reuses the M-P1 readiness key so both consumers share one cache entry",
);
assert(
  !reportsContext.includes('"reports-catalog"'),
  "no second catalog query key exists — that duplicated the request",
);
assert(
  reportsContext.includes("getManagerReportCatalogRequest"),
  "the catalog is fetched through the single existing catalog request function",
);
assert(
  !reportsApi.includes("/api/reports/catalog"),
  "reports-api.ts does not add a second fetcher for the catalog endpoint",
);

// No polling: generation is synchronous, so no interval may be started.
for (const file of reportFiles) {
  const code = codeOnly(file);
  assert(!/refetchInterval/.test(code), `Reports does not poll (${file})`);
  assert(!/setInterval\(/.test(code), `Reports starts no timer (${file})`);
  assert(!/EventSource|new WebSocket/.test(code), `Reports opens no stream (${file}, C-04)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. GUARD — UGX money through the shared zero-fraction formatter
// ═══════════════════════════════════════════════════════════════════════════

const reportsModel = codeOnly(`${MANAGER_LIB_DIR}/reports-model.ts`);
assert(
  reportsModel.includes("formatManagerOperationsMoney"),
  "money is formatted through the shared Manager money formatter",
);
for (const file of reportFiles) {
  const code = codeOnly(file);
  assert(
    !/Intl\.NumberFormat\([^)]*currency/.test(code),
    `no reports file hand-rolls a currency formatter (${file})`,
  );
  assert(!/toFixed\(2\)/.test(code), `no reports file forces 2 decimals onto UGX (${file})`);
}

const moneyEntries = toManagerReportSummaryEntries(
  { grossSales: "33014100", netSales: "27978300", orderCount: 219 },
  "UGX",
);
const gross = moneyEntries.find((entry) => entry.key === "grossSales");
assert(gross?.value === "UGX 33,014,100", `UGX renders with zero fractions (got ${gross?.value})`);
assert(gross?.kind === "money", "grossSales is classified as money");
const orders = moneyEntries.find((entry) => entry.key === "orderCount");
assert(orders?.value === "219" && orders.kind === "count", "a count is not formatted as currency");

/**
 * ⚠️ The B3-D1 guard, carried into Reports.
 *
 * `grossSales` is tax-INCLUSIVE and `netSales` is ex-tax since backend gap
 * batch 1 (MP0-10). Neither may ever be labelled a bare "Gross"/"Net". Do NOT
 * "fix" these back.
 */
assert(
  managerReportLabel("grossSales") === "Sales (tax-inclusive)",
  "grossSales states its tax basis and is never a bare 'Gross sales'",
);
assert(
  managerReportLabel("netSales") === "Sales (ex-tax)",
  "netSales states its tax basis and is never a bare 'Net sales'",
);
assert(
  managerReportLabel("subtotalSales").includes("ex-tax"),
  "subtotalSales states its basis",
);

// B4-F2: the SAME key means different things at different depths, so the
// breakdown must not reuse the top-level label.
const topItems = toManagerReportBreakdown("TOP_ITEMS", {
  topItems: [{ name: "Tilapia", quantitySold: 67, grossSales: "3216000", menuItemId: "c73f" }],
});
assert(topItems, "TOP_ITEMS produces a breakdown");
const grossColumn = topItems?.columns.find((column) => column.field === "grossSales");
assert(
  grossColumn?.label === "Gross sales (ex-tax)",
  `per-item grossSales is labelled ex-tax, not tax-inclusive (got ${grossColumn?.label})`,
);
assert(
  !topItems?.columns.some((column) => /Id$/.test(column.field)),
  "raw identifier columns are not rendered in a breakdown",
);
assert(
  formatManagerBreakdownCell(grossColumn!, "3216000", "UGX") === "UGX 3,216,000",
  "a breakdown money cell uses the shared zero-fraction formatter",
);
assert(isManagerBreakdownColumnNumeric(grossColumn!), "money columns are right-aligned");

// ═══════════════════════════════════════════════════════════════════════════
// 6. GUARD — no client-synthesized file, and no fabricated row table
// ═══════════════════════════════════════════════════════════════════════════

for (const file of reportFiles) {
  const code = codeOnly(file);
  assert(!/new Blob\(/.test(code), `no file is assembled in the browser (${file})`);
  assert(!/text\/csv["'`]\s*\}\)/.test(code), `no CSV mime type is minted client-side (${file})`);
  assert(
    !/\.join\(["'`],["'`]\)/.test(code) || !/csv/i.test(code),
    `no CSV text is built by joining values (${file})`,
  );
}
assert(
  /await response\.blob\(\)/.test(reportsApi),
  "the download returns the server's own bytes via response.blob()",
);

/**
 * `rowCount` is the generator's count of SOURCE records — `shifts.length +
 * tillCount`, `salesAgg._count`, `orders.length` — and for SALES_BY_HOUR it is
 * 219 while the export is 24 rows. It must never drive a table or be called a
 * row count (MP0-08 / C-03).
 */
const summaryPanel = codeOnly(`${MANAGER_COMPONENT_DIR}/reports/ManagerReportSummaryPanel.tsx`);
assert(
  !/Array\.from\(\{\s*length:\s*\w*rowCount/.test(summaryPanel) &&
    !/rowCount\s*\)\s*\.map/.test(summaryPanel),
  "no row table is generated from rowCount",
);
assert(
  summaryPanel.includes("Records aggregated"),
  "rowCount is labelled 'Records aggregated', never 'rows'",
);
assert(
  /not the number of lines in the CSV/.test(source(`${MANAGER_COMPONENT_DIR}/reports/ManagerReportSummaryPanel.tsx`)),
  "the panel says in words that rowCount is not the CSV's line count",
);

// A breakdown only ever renders an array the summary actually carries.
assert(
  toManagerReportBreakdown("DAILY_SALES", { grossSales: "1", orderCount: 219 }) === null,
  "a summary with no array produces no breakdown table",
);
assert(
  toManagerReportBreakdown("TOP_ITEMS", { topItems: [] }) === null,
  "an empty array produces no breakdown table",
);
assert(
  toManagerReportBreakdown("PAYROLL_SUMMARY", { anything: [{ a: 1 }] }) === null,
  "a report with no curated spec renders no table, even if it carries an array",
);

// ═══════════════════════════════════════════════════════════════════════════
// 7. MP0-12 — a run's own branchId is displayed, and cross-branch fails safe
// ═══════════════════════════════════════════════════════════════════════════

assert(
  /run\.branchId\s*&&\s*run\.branchId\s*!==\s*branchId/.test(reportsApi),
  "the API boundary rejects a run belonging to another branch (MP0-12)",
);
assert(
  summaryPanel.includes("run.branchId"),
  "the run's own branchId reaches the UI so it can be shown, not assumed",
);
assert(
  /belongs to another branch/i.test(source(`${MANAGER_COMPONENT_DIR}/reports/ManagerReportSummaryPanel.tsx`)),
  "an out-of-branch run is disclosed in words",
);

const projected = projectManagerReportRun({
  id: "r1",
  branchId: "branch-a",
  reportType: "DAILY_SALES",
  reportWindow: "DAY",
  status: "COMPLETED",
  rowCount: 219,
  summary: { grossSales: "1" },
  exportArtifacts: [
    { id: "csv1", format: "CSV", status: "READY", fileName: "a.csv", readyAt: "2026-08-20T10:00:00Z" },
    { id: "pdf1", format: "PDF", status: "READY", fileName: "a.pdf" },
  ],
});
assert(projected.csvArtifact?.id === "csv1", "the CSV artifact is selected for download");
assert(
  projected.withdrawnPdfCount === 1,
  "a legacy PDF artifact is counted for disclosure, never offered",
);
assert(projected.branchId === "branch-a", "the run keeps its own branchId");

// ═══════════════════════════════════════════════════════════════════════════
// 8. Routing, nav and the module conversion
// ═══════════════════════════════════════════════════════════════════════════

assert(MANAGER_REPORTS_LANDING === MANAGER_REPORTS_ROUTES.catalog, "Reports lands on the catalog");

const reportsRoute = managerRoutes.find((route) => route.href === "/manager/reports");
assert(reportsRoute, "Reports is still one of the approved Manager surfaces");
assert(
  reportsRoute?.match("/manager/reports/runs") === true,
  "the Reports nav entry matches its whole module, so sub-routes keep it highlighted",
);
assert(managerRoutes.length === 7, "the approved seven-surface nav is unchanged (six + Accounting, OD-3)");

assert(
  reportsMenuItems.length === 2 && reportsMenuItems.every((item) => item.available),
  "both Reports menu rows are real, with no not-yet placeholder left behind",
);
assert(
  reportsMenuItems.some((item) => item.href === MANAGER_REPORTS_ROUTES.catalog) &&
    reportsMenuItems.some((item) => item.href === MANAGER_REPORTS_ROUTES.runs),
  "the Reports menu points at the two real surfaces",
);

const reportsSurface = managerSurfaces.find((surface) => surface.key === "reports");
assert(reportsSurface?.liveFrom === "live", "the Reports surface is tagged live");

// The module root redirects rather than rendering a foundation screen.
assert(
  !existsSync(join(process.cwd(), `${MANAGER_PAGES_DIR}/reports.tsx`)),
  "the old single-page /manager/reports foundation screen is gone",
);
const reportsIndex = codeOnly(`${MANAGER_PAGES_DIR}/reports/index.tsx`);
assert(
  /redirect:\s*\{\s*destination:\s*MANAGER_REPORTS_LANDING/.test(reportsIndex),
  "/manager/reports redirects into the catalog",
);

// URL state is validated against real enums.
assert(readManagerReportKey("DAILY_SALES") === "DAILY_SALES", "a valid report key is accepted");
assert(readManagerReportKey("../../etc") === null, "a malformed report key is rejected");
assert(readManagerRunStatus("nonsense") === null, "an invalid run status resolves to no filter");
assert(readManagerRunStatus("failed") === "FAILED", "a run status is normalised");
assert(readManagerReportCategory("Not a category") === null, "an invalid category is rejected");
assert(
  readManagerReportCategory(MANAGER_REPORT_CATEGORIES[0]) === MANAGER_REPORT_CATEGORIES[0],
  "a real category is accepted",
);
assert(readManagerRunId("' OR 1=1") === null, "a malformed run id is rejected");

// ═══════════════════════════════════════════════════════════════════════════
// 9. The uniform generate DTO (MP0-16)
// ═══════════════════════════════════════════════════════════════════════════

const parameterForm = codeOnly(`${MANAGER_COMPONENT_DIR}/reports/ManagerReportParameterForm.tsx`);
assert(
  MANAGER_REPORT_WINDOWS.length === 4 && MANAGER_REPORT_WINDOWS.includes("CUSTOM"),
  "the four real ReportWindow values are offered",
);
assert(
  /reportWindow\s*===\s*["'`]CUSTOM["'`]/.test(reportsApi),
  "dateFrom/dateTo are sent only for CUSTOM, which is the only window that takes them",
);
assert(
  /needs both a start and an end date/.test(parameterForm),
  "the form mirrors the DTO's CUSTOM requirement instead of letting the API 400",
);
assert(
  /entry\.supportsLimit/.test(parameterForm),
  "the limit field is conditional on the entry that actually accepts it",
);
assert(
  implemented.supportsLimit === false &&
    projectManagerReportCatalogEntry({
      key: "TOP_ITEMS",
      title: "t",
      description: "d",
      status: "IMPLEMENTED",
      formats: ["CSV"],
      permission: "p",
    }).supportsLimit === true,
  "TOP_ITEMS is the only generator offered a limit (MP0-16)",
);
assert(
  !/parameters:/.test(parameterForm),
  "no free-form parameters box is rendered — no generator reads that field",
);

// ═══════════════════════════════════════════════════════════════════════════
// 10. The mutation allow-list, extended deliberately by B4
// ═══════════════════════════════════════════════════════════════════════════

/**
 * B3 asserted exactly 7 Manager mutations repo-wide so that an eighth would be
 * a conscious act. B4 adds exactly two, both on Reports:
 *
 *   8. `POST /api/reports/{generator}` — run a report
 *   9. `POST /api/reports/export`      — create the CSV artifact
 *
 * The download is a GET. Nothing else in Reports writes.
 */
const ALLOWED_MUTATION_PATHS = [
  "/api/hr/frontline-staff/onboard",
  "quick-pin/reset",
  "quick-pin/disable",
  "quick-pin/enable",
  "/review",
  "/approve",
  "/api/dash/kpi/refresh", // pre-existing (B2)
  "/api/reports/export", // B4
  "/api/reports/${encodeURIComponent(generatorPath)}", // B4
];

const mutationRegex = /method:\s*["'](POST|PATCH|PUT|DELETE)["']/g;
let managerMutationCount = 0;
for (const file of managerFiles) {
  const code = codeOnly(file);
  const matches = code.match(mutationRegex);
  if (!matches) continue;
  managerMutationCount += matches.length;
  assert(
    ALLOWED_MUTATION_PATHS.some((allowed) => code.includes(allowed)),
    `every mutation in ${file} targets an allow-listed path`,
  );
}
assert(
  managerMutationCount === 9,
  `exactly 9 manager mutations exist — 7 from B3 plus B4's generate and export (found ${managerMutationCount})`,
);

// Reports owns exactly two of them.
let reportsMutationCount = 0;
for (const file of reportFiles) {
  reportsMutationCount += (codeOnly(file).match(mutationRegex) || []).length;
}
assert(
  reportsMutationCount === 2,
  `Reports issues exactly 2 mutations: generate and export (found ${reportsMutationCount})`,
);

// Nothing in Reports deletes or edits a run — history is append-only here.
for (const file of reportFiles) {
  const code = codeOnly(file);
  assert(
    !/method:\s*["'](DELETE|PUT|PATCH)["']/.test(code),
    `Reports never deletes or edits a run (${file})`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. Model behaviour
// ═══════════════════════════════════════════════════════════════════════════

const catalogSample = [implemented, pendingLater, conditional].map((entry) => entry);
const counts = countManagerReportAvailability(catalogSample);
assert(
  counts.total === 3 && counts.available === 1 && counts.unavailable === 2,
  "availability counts are computed from the projected entries",
);

assert(
  filterManagerReportCatalog(catalogSample, { search: "daily", category: null }).length === 1,
  "search matches on title",
);
assert(
  filterManagerReportCatalog(catalogSample, { search: "", category: "Not yet available" }).length === 1,
  "the category filter narrows the catalog",
);
assert(
  filterManagerReportCatalog(catalogSample, { search: "zzzz", category: null }).length === 0,
  "a search with no match returns nothing rather than everything",
);

// The payment map is flattened into money rows, exactly as the CSV renders it.
const paymentEntries = toManagerReportSummaryEntries(
  { paymentBreakdown: { CARD: "16691800", CASH: "10317500" } },
  "UGX",
);
assert(paymentEntries.length === 2, "a payment map becomes one row per method");
assert(
  paymentEntries[0].label.startsWith("Payment ·") && paymentEntries[0].kind === "money",
  "payment rows are labelled and formatted as money",
);

// An unknown key is never guessed into currency.
const unknownEntries = toManagerReportSummaryEntries({ someNewField: "12345" }, "UGX");
assert(
  unknownEntries[0].kind === "text" && unknownEntries[0].value === "12345",
  "an unrecognised summary key renders as text, never as money",
);

assert(
  MANAGER_REPORT_RUN_STATUSES.length === 3,
  "the three real ReportRunStatus values are used",
);

console.log("Manager B4 assertions: all checks passed.");
