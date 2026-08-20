import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

import { managerRoutes } from "../src/lib/manager/routes";
import {
  MANAGER_APPROVAL_DOMAINS,
  MANAGER_KPI_BINDINGS,
  formatManagerCount,
  formatManagerMoney,
  formatSharePercent,
  isOpenOrdersPreviewCapped,
  minutesSince,
  oldestOpenOrder,
  toAgingBuckets,
  toLowStockEntries,
  toManagerAmount,
  toOrderStatusSplit,
  toPaymentMixSlices,
  toSharePercent,
} from "../src/lib/manager/dashboard-model";

/**
 * Track B2 — Manager Overview dashboard static assertions.
 *
 * Encodes the roadmap's B2 acceptance gate as executable checks:
 *
 *   "every rendered KPI maps to a verified response field; every count has a
 *    drill-in target; no bare Gross/Net label exists; the approvals count path
 *    filters by branch before display; no tills/shifts table renders; the
 *    degraded-stream state renders when the stream fails."
 *
 * plus the query-key, no-SSE and no-PII-on-the-wire invariants this phase adds.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Manager B2 assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** Source with comments stripped — used wherever a comment could satisfy a check by accident. */
function codeOnly(path: string) {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

const DASHBOARD_LIB = [
  "apps/web/src/lib/manager/dashboard-api.ts",
  "apps/web/src/lib/manager/dashboard-context.ts",
  "apps/web/src/lib/manager/dashboard-model.ts",
  "apps/web/src/lib/manager/dashboard-types.ts",
];

const DASHBOARD_COMPONENT_DIR = "apps/web/src/components/manager/dashboard";
const CARD_DIR = `${DASHBOARD_COMPONENT_DIR}/cards`;

function listCardFiles() {
  return readdirSync(join(process.cwd(), CARD_DIR))
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => `${CARD_DIR}/${file}`);
}

const cardFiles = listCardFiles();
const dashboardFiles = [
  `${DASHBOARD_COMPONENT_DIR}/ManagerDashboardCard.tsx`,
  `${DASHBOARD_COMPONENT_DIR}/ManagerDashboardCharts.tsx`,
  `${DASHBOARD_COMPONENT_DIR}/ManagerOverviewDashboard.tsx`,
  ...cardFiles,
];

for (const file of [...DASHBOARD_LIB, ...dashboardFiles]) {
  assert(existsSync(join(process.cwd(), file)), `expected B2 file exists: ${file}`);
}
assert(cardFiles.length === 8, `the Overview grid ships 8 cards (found ${cardFiles.length})`);

// ── 1. The dashboard is actually mounted on /manager/overview ────────────────

const overviewPage = codeOnly("apps/web/src/pages/manager/overview.tsx");
assert(
  overviewPage.includes("<ManagerOverviewDashboard />"),
  "/manager/overview renders the real dashboard",
);
assert(
  !overviewPage.includes("ManagerFoundationScreen"),
  "/manager/overview no longer renders the B1 honest-foundation screen",
);
assert(overviewPage.includes("<ManagerShell>"), "Overview still renders inside the shared ManagerShell");

const dashboardShell = codeOnly(`${DASHBOARD_COMPONENT_DIR}/ManagerOverviewDashboard.tsx`);
for (const chrome of ["ManagerContentShell", "ManagerControlPanel"]) {
  assert(dashboardShell.includes(chrome), `the dashboard composes the B1 chrome primitive ${chrome}`);
}
assert(
  dashboardShell.includes("data-manager-dashboard-grid"),
  "the card grid is addressable for e2e",
);

// ── 2. Every rendered KPI maps to a verified response field ──────────────────

const bindingKeys = new Set(MANAGER_KPI_BINDINGS.map((binding) => binding.key));
assert(bindingKeys.size === MANAGER_KPI_BINDINGS.length, "KPI binding keys are unique");

const managerRouteHrefs = new Set<string>(managerRoutes.map((route) => route.href as string));

for (const binding of MANAGER_KPI_BINDINGS) {
  assert(binding.label.trim().length > 0, `KPI ${binding.key} has a label`);
  assert(
    /^(GET|POST) \/api\//.test(binding.endpoint),
    `KPI ${binding.key} names a concrete API endpoint (got "${binding.endpoint}")`,
  );
  assert(binding.field.trim().length > 0, `KPI ${binding.key} names the exact response field`);

  // Every count carries a drill-in target — or an explicit reason there is none.
  if (binding.drillIn === null) {
    assert(
      Boolean(binding.noDrillInReason && binding.noDrillInReason.length > 20),
      `KPI ${binding.key} has no drill-in and must record why`,
    );
  } else {
    assert(
      managerRouteHrefs.has(binding.drillIn),
      `KPI ${binding.key} drills into a real Manager route (got "${binding.drillIn}")`,
    );
  }
}

// Only the two till/shift KPIs may lack a drill-in, and only because MP0-02 says
// the branch-wide surfaces do not exist.
const withoutDrillIn = MANAGER_KPI_BINDINGS.filter((binding) => binding.drillIn === null).map((b) => b.key);
assert(
  withoutDrillIn.length === 2 &&
    withoutDrillIn.includes("coverage.shifts") &&
    withoutDrillIn.includes("coverage.tills"),
  `only the till/shift coverage KPIs lack a drill-in (got ${withoutDrillIn.join(", ") || "none"})`,
);

// Every `kpiKey` literal rendered by a card must exist in the registry.
const renderedKpiKeys = new Set<string>();
for (const file of dashboardFiles) {
  const text = source(file);
  for (const match of text.matchAll(/kpiKey[=:]\s*["'`]([^"'`]+)["'`]/g)) {
    renderedKpiKeys.add(match[1]);
  }
}
assert(renderedKpiKeys.size >= 15, `the cards render a substantial KPI set (found ${renderedKpiKeys.size})`);
for (const key of renderedKpiKeys) {
  assert(bindingKeys.has(key), `rendered KPI "${key}" is registered in MANAGER_KPI_BINDINGS`);
}

// ── 3. No bare Gross / Net label (MP0-10) ───────────────────────────────────

for (const binding of MANAGER_KPI_BINDINGS) {
  const label = binding.label.toLowerCase();
  if (/\b(gross|net)\b/.test(label)) {
    assert(
      label.includes("tax"),
      `KPI ${binding.key} mentions gross/net and must qualify the tax basis (got "${binding.label}")`,
    );
  }
}

// The rendered copy must not reintroduce it either.
for (const file of dashboardFiles) {
  const text = source(file);
  for (const match of text.matchAll(/["'>]\s*(Gross|Net) sales\b/g)) {
    assert(false, `${file} renders a bare "${match[1]} sales" label — qualify the tax basis (MP0-10)`);
  }
}

// ── 4. No SSE anywhere in the B2 surface (MP0-07 / NG-14, gated on C-04) ─────

for (const file of [...DASHBOARD_LIB, ...dashboardFiles]) {
  const code = codeOnly(file);
  for (const banned of ["EventSource", "text/event-stream", "/api/stream/metrics", "stream/metrics"]) {
    assert(!code.includes(banned), `${file} contains no SSE client code ("${banned}")`);
  }
}

// …and the degraded-stream state is stated in words, not implied by a spinner.
assert(
  dashboardShell.includes('data-manager-stream-state="degraded"') &&
    /Live stream unavailable/.test(dashboardShell),
  "the dashboard renders an explicit degraded-stream state",
);
assert(
  /Refreshes every \{pollSeconds\} seconds/.test(dashboardShell),
  "the dashboard states its polling cadence in product copy",
);

// ── 5. Query-key discipline + no request storm ───────────────────────────────

const context = codeOnly("apps/web/src/lib/manager/dashboard-context.ts");
const useQueryCount = (context.match(/useQuery\(\{/g) || []).length;
assert(useQueryCount === 9, `the dashboard issues exactly 9 bounded queries (found ${useQueryCount})`);

const queryKeyCalls = context.match(/queryKey: managerQueryKey\("([^"]+)", branchId\)/g) || [];
assert(
  queryKeyCalls.length >= useQueryCount,
  "every dashboard query key goes through managerQueryKey(surface, branchId)",
);
assert(
  !/queryKey:\s*\[/.test(context),
  "no dashboard query builds a raw array key — the namespace helper is mandatory",
);
assert(!context.includes("queryClient.clear("), "the dashboard never clears the whole query cache");
assert(
  !/invalidateQueries\(\{\s*queryKey:\s*\[MANAGER_QUERY_NAMESPACE\]/.test(context),
  "refresh invalidates the nine dashboard keys narrowly, not the whole manager namespace",
);
assert(
  context.includes("MANAGER_DASHBOARD_SURFACES.map((surface) =>"),
  "refresh invalidates by walking the explicit surface list",
);
assert(
  /refetchInterval: isEnabled \? MANAGER_DASHBOARD_POLL_MS : false/.test(context),
  "polling is disabled whenever the dashboard is disabled (no branch / no session)",
);
assert(
  !context.includes("refetchOnWindowFocus: true"),
  "the dashboard does not opt into refetch-on-focus on top of polling",
);

// ── 6. Approvals: domain endpoints only, branch-true at the source ───────────

const api = codeOnly("apps/web/src/lib/manager/dashboard-api.ts");
assert(
  !/apiRequest[^)]*"\/api\/approvals/.test(api),
  "approval counts never call the partly org-scoped generic /api/approvals inbox (MP0-05)",
);
for (const endpoint of [
  "/api/pos/discounts/pending",
  "/api/hr/leave?status=PENDING&take=1",
  "/api/hr/shift-swaps?status=PENDING&take=1",
  "/api/analytics/anomalies?status=OPEN&limit=1",
]) {
  assert(api.includes(endpoint), `approval counts read the canonical domain endpoint ${endpoint}`);
}
assert(
  MANAGER_APPROVAL_DOMAINS.length === 4,
  "all four approval domains are represented on the Overview card",
);
for (const domain of MANAGER_APPROVAL_DOMAINS) {
  assert(
    managerRouteHrefs.has(domain.drillIn),
    `approval domain ${domain.key} drills into a real Manager route`,
  );
}

// Every approval request passes `branchId`, so X-Branch-Id is always set.
const approvalFns = api.match(/export async function getManager[A-Za-z]*Count[\s\S]*?\n}/g) || [];
assert(approvalFns.length === 4, `there are four approval count functions (found ${approvalFns.length})`);
for (const fn of approvalFns) {
  assert(/branchId,?\s*\n?\s*\}\)/.test(fn) || fn.includes("branchId }"), "each approval request is branch-scoped");
  assert(
    /return \{ domain: "[^"]+", count: [^}]+\};/.test(fn.replace(/\s+/g, " ")) ||
      /return \{ domain: "[^"]+", count: [^}]+ \};/.test(fn.replace(/\s+/g, " ")),
    "each approval request resolves to a count-only projection — the rows never leave this layer (MP0-01)",
  );
  assert(!/return payload;/.test(fn), "an approval request never returns the raw payload");
}

// ── 7. No tills / shifts list, anywhere (MP0-02) ─────────────────────────────

for (const file of [...DASHBOARD_LIB, ...dashboardFiles]) {
  const code = codeOnly(file);
  // Matches a REQUEST PATH (a quoted route), not prose: the KPI registry legitimately
  // names these routes in the text that explains why they cannot be drilled into.
  for (const banned of ['"/api/tills', '"/api/shifts', '"/api/pos/tills', '"/tills/', '"/shifts/']) {
    assert(!code.includes(banned), `${file} never requests a tills/shifts route (${banned})`);
  }
}
const coverageCard = source(`${CARD_DIR}/ManagerCoverageCard.tsx`);
assert(
  coverageCard.includes("shiftSummary?.activeShifts") && coverageCard.includes("shiftSummary?.activeTills"),
  "till/shift coverage renders counts from /dash/manager.shiftSummary only",
);
assert(!/<table|<tbody|role="table"/.test(coverageCard), "till/shift coverage renders no table");

// ── 8. Open orders: the authoritative count is never the capped page length ──

const openOrdersCard = codeOnly(`${CARD_DIR}/ManagerOpenOrdersCard.tsx`);
assert(
  openOrdersCard.includes("managerQuery.data?.openOrders"),
  "the open-order headline comes from /dash/manager.openOrders",
);
assert(
  !/openOrdersQuery\.data\?\.count/.test(openOrdersCard),
  "the open-order headline never uses /dash/open-orders.count, which is the capped page length (MP0-09)",
);
assert(
  openOrdersCard.includes("isOpenOrdersPreviewCapped"),
  "the card detects and discloses the 50-row preview cap",
);

// ── 9. No charting dependency was added ─────────────────────────────────────

const pkg = JSON.parse(source("apps/web/package.json")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
for (const banned of ["recharts", "chart.js", "react-chartjs-2", "apexcharts", "react-apexcharts", "d3", "victory", "nivo"]) {
  assert(!(banned in pkg.dependencies), `no charting dependency was added (${banned})`);
  assert(!(banned in pkg.devDependencies), `no charting devDependency was added (${banned})`);
}

// ── 10. Charts are accessible and token-driven ──────────────────────────────

const charts = source(`${DASHBOARD_COMPONENT_DIR}/ManagerDashboardCharts.tsx`);
assert((charts.match(/<title id=/g) || []).length >= 2, "every SVG mark carries a <title>");
assert((charts.match(/<desc id=/g) || []).length >= 2, "every SVG mark carries a <desc>");
assert((charts.match(/role="img"/g) || []).length >= 3, "every mark is exposed as role=img");
assert(
  !/#[0-9a-fA-F]{3,8}\b/.test(codeOnly(`${DASHBOARD_COMPONENT_DIR}/ManagerDashboardCharts.tsx`)),
  "charts contain no hard-coded hex colours — tokens only",
);
for (const file of dashboardFiles) {
  assert(
    !/from "@phosphor-icons\/react"/.test(source(file)),
    `${file} imports no icon directly — the canonical registry is the only source`,
  );
}

// ── 11. The KPI-refresh write is confirmed and locked while in flight ────────

assert(dashboardShell.includes("ActionConfirmDialog"), "the KPI refresh sits behind the shared confirm dialog");
assert(
  /disabled=\{!snapshot\.isEnabled \|\| snapshot\.refresh\.isPending\}/.test(dashboardShell),
  "the refresh control is locked while a refresh is in flight",
);
assert(
  /if \(!isEnabled \|\| refreshMutation\.isPending\) return;/.test(context),
  "a second refresh cannot be dispatched while one is running",
);
assert(api.includes('"/api/dash/kpi/refresh"'), "refresh posts to the verified KPI refresh route");

// ── 12. Card states: loading / empty / error are all real and fail-closed ────

const cardPrimitive = source(`${DASHBOARD_COMPONENT_DIR}/ManagerDashboardCard.tsx`);
for (const state of ["loading", "error", "empty", "ready"]) {
  assert(
    cardPrimitive.includes(`data-manager-card-state="${state}"`),
    `the card primitive renders a distinct "${state}" state`,
  );
}
assert(
  cardPrimitive.includes("getManagerKpiBinding(kpiKey)"),
  "a KPI cannot render without resolving its registry binding",
);

// ── 13. Model behaviour (pure functions, executed) ──────────────────────────

// Decimals arrive as strings and must never be coerced to a fabricated zero.
assert(toManagerAmount("2980000") === 2_980_000, "a wire Decimal string parses to a number");
assert(toManagerAmount(0) === 0, "a real zero survives");
assert(toManagerAmount(null) === null, "a missing value fails closed to null, not 0");
assert(toManagerAmount("") === null, "an empty value fails closed to null");
assert(toManagerAmount("not-a-number") === null, "an unparseable value fails closed to null");

assert(
  formatManagerMoney("2980000", "UGX") === "UGX 2,980,000",
  `UGX renders with zero fraction digits (got "${formatManagerMoney("2980000", "UGX")}")`,
);
assert(formatManagerMoney(null, "UGX") === "Unavailable", "missing money renders as Unavailable, never UGX 0");
assert(formatManagerCount(null) === "Unavailable", "a missing count renders as Unavailable, never 0");
assert(formatManagerCount(0) === "0", "a real zero count renders as 0");

// Payment mix shares come from the backend's own total.
const mix = toPaymentMixSlices({
  cash: "600",
  card: "300",
  momo: "100",
  total: "1000",
  date: "2026-08-20",
  calculatedAt: "2026-08-20T10:00:00.000Z",
});
assert(mix.total === 1000, "payment mix total parses");
assert(mix.slices.length === 3, "payment mix exposes exactly the three backend methods");
assert(mix.slices[0].share === 60, "payment mix shares are computed against the returned total");
assert(formatSharePercent(mix.slices[2].share) === "10%", "shares render as whole percents");
assert(toSharePercent(5, 0) === null, "a zero total yields no share rather than a divide-by-zero");

// Aging buckets group real timestamps and never invent a bucket.
const now = Date.parse("2026-08-20T12:00:00.000Z");
const buckets = toAgingBuckets(
  [
    { id: "a", orderNumber: "1", status: "NEW", serviceType: "DINE_IN", total: "1", createdAt: "2026-08-20T11:55:00.000Z" },
    { id: "b", orderNumber: "2", status: "SENT", serviceType: "DINE_IN", total: "1", createdAt: "2026-08-20T11:40:00.000Z" },
    { id: "c", orderNumber: "3", status: "SENT", serviceType: "DINE_IN", total: "1", createdAt: "2026-08-20T11:10:00.000Z" },
    { id: "d", orderNumber: "4", status: "READY", serviceType: "DINE_IN", total: "1", createdAt: "2026-08-20T09:00:00.000Z" },
    { id: "e", orderNumber: "5", status: "READY", serviceType: "DINE_IN", total: "1", createdAt: "not-a-date" },
  ],
  now,
);
assert(buckets.length === 4, "there are four aging buckets");
assert(buckets[0].count === 1, "a 5-minute-old order lands in 0-15m");
assert(buckets[1].count === 1, "a 20-minute-old order lands in 15-30m");
assert(buckets[2].count === 1, "a 50-minute-old order lands in 30-60m");
assert(buckets[3].count === 1, "a 3-hour-old order lands in 60m+");
assert(
  buckets.reduce((sum, bucket) => sum + bucket.count, 0) === 4,
  "an unreadable timestamp is skipped, not bucketed as fresh",
);
assert(buckets.every((bucket) => bucket.description.length > 0), "every bucket carries screen-reader wording");

assert(minutesSince("2026-08-20T11:00:00.000Z", now) === 60, "elapsed minutes are computed from real timestamps");
assert(minutesSince(null, now) === null, "a missing timestamp yields no elapsed reading");

const oldest = oldestOpenOrder([
  { id: "x", orderNumber: "1", status: "NEW", serviceType: "DINE_IN", total: "1", createdAt: "2026-08-20T11:00:00.000Z" },
  { id: "y", orderNumber: "2", status: "NEW", serviceType: "DINE_IN", total: "1", createdAt: "2026-08-20T09:00:00.000Z" },
]);
assert(oldest?.id === "y", "the oldest open order is re-derived rather than assumed from list order");

// The 50-row preview cap is detected from either side.
assert(
  isOpenOrdersPreviewCapped({ count: 50, orders: new Array(50).fill(null).map((_, index) => ({
    id: String(index),
    orderNumber: String(index),
    status: "NEW",
    serviceType: "DINE_IN",
    total: "1",
    createdAt: "2026-08-20T11:00:00.000Z",
  })) }, 112),
  "a full 50-row page is treated as capped",
);
assert(
  isOpenOrdersPreviewCapped({ count: 10, orders: [] }, 40),
  "a branch total larger than the preview is treated as capped",
);
assert(!isOpenOrdersPreviewCapped({ count: 3, orders: [] }, 0), "a small, complete preview is not flagged");

// Low stock ranks by deepest shortfall and never ranks an unreadable row first.
const lowStock = toLowStockEntries({
  count: 3,
  items: [
    { id: "1", name: "Tonic", sku: null, unit: "btl", currentStock: "8", reorderLevel: "10", reorderQty: "24" },
    { id: "2", name: "Gin", sku: null, unit: "btl", currentStock: "1", reorderLevel: "12", reorderQty: "24" },
    { id: "3", name: "Ice", sku: null, unit: "kg", currentStock: null, reorderLevel: "5", reorderQty: "10" },
  ],
});
assert(lowStock[0].row.name === "Gin", "the deepest shortfall ranks first");
assert(lowStock[0].shortfall === 11, "shortfall is reorder level minus stock on hand");
assert(lowStock[lowStock.length - 1].row.name === "Ice", "an unreadable row sinks to the bottom");
assert(lowStock[lowStock.length - 1].coverage === null, "an unreadable row renders no ratio");

const statuses = toOrderStatusSplit([
  { id: "1", orderNumber: "1", status: "SENT", serviceType: "DINE_IN", total: "1", createdAt: "" },
  { id: "2", orderNumber: "2", status: "SENT", serviceType: "DINE_IN", total: "1", createdAt: "" },
  { id: "3", orderNumber: "3", status: "IN_KITCHEN", serviceType: "DINE_IN", total: "1", createdAt: "" },
]);
assert(statuses[0].label === "Sent" && statuses[0].count === 2, "status split counts and title-cases real statuses");
assert(statuses[1].label === "In kitchen", "underscored enum values are humanised");

// eslint-disable-next-line no-console
console.log(
  `Manager B2 assertions passed — ${MANAGER_KPI_BINDINGS.length} KPI bindings, ${cardFiles.length} cards, ${useQueryCount} bounded queries, 0 SSE clients.`,
);
