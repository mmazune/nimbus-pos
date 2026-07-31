import { existsSync, readFileSync } from "fs";
import { join } from "path";

import {
  buildCashierBillQuery,
  clearCashierBillQuery,
  buildCashierFloorQuery,
} from "../src/lib/cashier/floor-route";

/**
 * Cashier C2 assertions — table→bill resolution, canonical read-only settlement
 * workspace foundation, orderId URL state, Find bill sibling, Queue/Receipts
 * compatibility, and the C2 read-only boundary (no payment/close/receipt/refund
 * mutation, no transfer-table control).
 *
 * Run from the repo root: `npx tsx apps/web/scripts/cashier-c2-assertions.ts`.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Cashier C2 assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const BASE = "apps/web/src";
const screen = source(`${BASE}/components/cashier/floor/CashierFloorScreen.tsx`);
const panel = source(`${BASE}/components/cashier/floor/CashierBillResolutionPanel.tsx`);
const selector = source(`${BASE}/components/cashier/floor/CashierBillSelector.tsx`);
const workspace = source(`${BASE}/components/cashier/floor/CashierSettlementWorkspace.tsx`);
const find = source(`${BASE}/components/cashier/floor/CashierFindBillDialog.tsx`);
const billLib = source(`${BASE}/lib/cashier/bill-resolution.ts`);
const floorRoute = source(`${BASE}/lib/cashier/floor-route.ts`);
const queryKeys = source(`${BASE}/lib/cashier/bill-query-keys.ts`);

const c2FloorFiles: [string, string][] = [
  ["screen", screen],
  ["resolution panel", panel],
  ["selector", selector],
  ["workspace", workspace],
  ["find bill", find],
];

// ── Cashier Floor still consumes the shared OperationalFloor (no fork) ──────
assert(screen.includes("@/components/floor/OperationalFloor"), "Cashier screen imports the shared OperationalFloor");
assert(screen.includes("@/components/floor/OperationalTableWorkspaceFrame"), "Cashier screen reuses the shared workspace frame");
for (const forbidden of [
  "CashierTableCard",
  "CashierTableGrid",
  "CashierFloorToolbar",
]) {
  assert(!screen.includes(forbidden), `Cashier screen references no forked Floor primitive (${forbidden})`);
}

// ── Selected table resolves bills through a bounded, branch-scoped order query ─
assert(panel.includes("listCashierOrders"), "resolution panel reads bills through the canonical orders list contract");
assert(panel.includes("tableId: table.id"), "resolution panel queries bills by the selected tableId");
assert(/pageSize/.test(panel) && /TABLE_BILLS_PAGE_SIZE/.test(panel), "resolution panel bounds the table-bills query with a pageSize");
assert(panel.includes("resolveCashierTableBills"), "resolution panel classifies through the central resolver (not a first-order shortcut)");

// ── No first-order shortcut; zero/one/multiple handling exists ──────────────
assert(billLib.includes('kind: "zero"') && billLib.includes('kind: "single"') && billLib.includes('kind: "multiple"'), "resolver models zero / single / multiple explicitly");
assert(billLib.includes("payable.length === 1") && billLib.includes("payable.length === 0"), "resolver distinguishes single and zero payable bills");
assert(billLib.includes("UNKNOWN_UNSAFE"), "classification fails closed with UNKNOWN_UNSAFE");
assert(billLib.includes("classifyCashierBillStatus") && billLib.includes("classifyCashierBillPayment"), "central status + payment classifiers exist");
// The multiple case must NOT silently pick the first candidate.
assert(!/resolution\.candidates\[0\]/.test(panel) && !/payableCandidates\[0\]/.test(screen), "no silent first-of-many bill pick in the resolution flow");
assert(panel.includes("CashierBillSelector"), "multiple payable bills render an explicit selector");
assert(panel.includes('resolution.kind !== "single"'), "auto-resolve only fires for exactly one payable bill");

// ── Canonical orderId URL state ────────────────────────────────────────────
assert(floorRoute.includes("buildCashierBillQuery") && floorRoute.includes("clearCashierBillQuery"), "floor-route exposes bill (orderId) URL helpers");
assert(screen.includes("requestedOrderId") && screen.includes("router.query.orderId"), "screen reads the canonical orderId URL param");
assert(screen.includes("buildCashierBillQuery"), "screen writes bill selection to the URL via the canonical helper");
// URL helper behaviour.
assert(
  JSON.stringify(buildCashierBillQuery({ tableId: "t-1" }, { tableId: "t-1", orderId: "o-9" })) ===
    JSON.stringify({ tableId: "t-1", orderId: "o-9" }),
  "buildCashierBillQuery sets orderId and preserves tableId",
);
assert(
  JSON.stringify(buildCashierBillQuery({ tableId: "t-1", orderId: "old" }, { tableId: "t-2", orderId: null })) ===
    JSON.stringify({ tableId: "t-2" }),
  "buildCashierBillQuery clears orderId when selecting a new table",
);
assert(
  JSON.stringify(buildCashierBillQuery({ foo: "bar" }, { orderId: "o-1" })) ===
    JSON.stringify({ foo: "bar", orderId: "o-1" }),
  "buildCashierBillQuery supports a tableless bill (orderId only) and preserves unrelated params",
);
assert(
  JSON.stringify(clearCashierBillQuery({ tableId: "t-1", orderId: "o-9" })) === JSON.stringify({ tableId: "t-1" }),
  "clearCashierBillQuery removes only orderId and keeps tableId",
);
// C1 helper is unchanged (tableId-only contract).
assert(
  JSON.stringify(buildCashierFloorQuery({ foo: "bar" }, "t-9")) === JSON.stringify({ foo: "bar", tableId: "t-9" }),
  "C1 buildCashierFloorQuery contract is preserved",
);

// ── One canonical settlement workspace; existing checkout primitives reused ──
assert(existsSync(join(process.cwd(), `${BASE}/components/cashier/floor/CashierSettlementWorkspace.tsx`)), "one canonical settlement workspace exists");
assert(workspace.includes("@/components/cashier/queue/CashierOrderTotals"), "settlement workspace reuses the shared CashierOrderTotals primitive");
assert(workspace.includes("@/components/cashier/queue/CashierPaymentSummary"), "settlement workspace reuses the shared CashierPaymentSummary primitive");
assert(workspace.includes("normalizeCashierOrder"), "settlement workspace reuses the canonical order view-model (no duplicated financial logic)");
assert(workspace.includes('title="Totals"') && workspace.includes('title="Payment state"'), "settlement workspace exposes Totals + Payment state sections");

// ── Payment state is read-only and fails closed ────────────────────────────
assert(workspace.includes("paymentUnavailable") && workspace.includes("not shown as paid or unpaid"), "settlement workspace never shows unavailable payment as unpaid");
assert(billLib.includes("if (!summary) return \"UNKNOWN_UNSAFE\""), "payment classification fails closed when the summary is missing");

// ── Find bill is a Cashier-only sibling, not a Floor fork ───────────────────
assert(screen.includes("CashierFindBillDialog"), "screen mounts the Find bill sibling");
assert(screen.includes("Find bill"), "Find bill control is labelled");
assert(!find.includes("@/components/floor/OperationalFloor"), "Find bill dialog does not import or fork the shared Floor");
assert(find.includes("pageSize") && find.includes("FIND_PAGE_SIZE"), "Find bill query is bounded by pageSize");
assert(find.includes("listCashierOrders"), "Find bill uses the bounded branch orders contract");

// ── Queue / Receipts are NOT mounted on Floor ──────────────────────────────
for (const [name, src] of c2FloorFiles) {
  assert(!src.includes("CashierQueueScreen"), `Queue screen is not mounted on Floor (${name})`);
  assert(!src.includes("CashierReceiptsScreen"), `Receipts screen is not mounted on Floor (${name})`);
  assert(!src.includes("CashierOrderList"), `Queue order list is not mounted on Floor (${name})`);
}

// ── No payment / close / receipt / refund mutation is introduced ───────────
const MUTATION_TOKENS = [
  "CashierPaymentPanel",
  "CashierResolutionPanel",
  "CashierRefundPanel",
  "CashierRefundForm",
  "splitCashierBill",
  "splitCashierItems",
  "mergeCashierOrders",
  "moveCashierOrderItems",
  "transferCashierOrderTable",
  "transferCashierOrderServer",
  "CashierTransferTablePanel",
];
for (const [name, src] of c2FloorFiles) {
  for (const token of MUTATION_TOKENS) {
    assert(!src.includes(token), `C2 Floor ${name} introduces no mutation/out-of-scope control (${token})`);
  }
}
// No settlement action button copy in the read-only foundation.
for (const token of ["Collect payment", "Take payment", "Close order", "Print receipt", "Reprint receipt", "Create refund", "Issue refund"]) {
  assert(!workspace.includes(token), `settlement workspace exposes no C3/C4 action (${token})`);
}

// ── Query-key model exists and is narrow ───────────────────────────────────
assert(queryKeys.includes("tableBills") && queryKeys.includes("orderDetail") && queryKeys.includes("orderPayments") && queryKeys.includes("findBills"), "narrow Cashier bill query-key model covers the read domains");
assert(panel.includes("cashierBillQueryKeys") && workspace.includes("cashierBillQueryKeys") && find.includes("cashierBillQueryKeys"), "C2 reads use the shared query-key model");

// ── Compatibility routes still exist (not deleted, not redirected) ──────────
assert(existsSync(join(process.cwd(), `${BASE}/pages/cashier/queue.tsx`)), "Queue page still exists as a compatibility route");
assert(existsSync(join(process.cwd(), `${BASE}/pages/cashier/receipts.tsx`)), "Receipts page still exists as a compatibility route");
const queuePage = source(`${BASE}/pages/cashier/queue.tsx`);
const receiptsPage = source(`${BASE}/pages/cashier/receipts.tsx`);
assert(!queuePage.includes("redirect:") && queuePage.includes("CashierQueueScreen"), "Queue page is NOT redirected in C2");
assert(!receiptsPage.includes("redirect:") && receiptsPage.includes("CashierReceiptsScreen"), "Receipts page is NOT redirected in C2");

// ── Shared Floor still consumed by Waiter and Supervisor ───────────────────
assert(source(`${BASE}/components/waiter/floor/WaiterFloorScreen.tsx`).includes("@/components/floor/OperationalFloor"), "Waiter still consumes the shared OperationalFloor");
assert(source(`${BASE}/components/supervisor/floor/SupervisorFloorScreen.tsx`).includes("@/components/floor/OperationalFloor"), "Supervisor still consumes the shared OperationalFloor");

// ── Privacy: selector/find rows carry no guest identity or raw-id title ─────
for (const [name, src] of [["selector", selector], ["find bill", find]] as const) {
  for (const leak of ["guestName", "customerName", "payerPhone", "customerPhone", "payer_phone"]) {
    assert(!src.includes(leak), `${name} row exposes no guest/payment identity (${leak})`);
  }
}

console.log("Cashier C2 assertions passed: shared-Floor consumption, bounded table→bill resolution (zero/one/multiple, fail-closed, no first-pick), canonical orderId URL state, one read-only settlement workspace reusing checkout primitives, Find bill sibling (bounded), Queue/Receipts not mounted + still routable, no payment/close/receipt/refund mutation, narrow query keys, and privacy.");
