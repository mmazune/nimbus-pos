import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { cashierBillQueryKeys } from "../src/lib/cashier/bill-query-keys";

/**
 * Cashier C3 assertions — payment collection, partial payment + remaining
 * balance, split settlement execution, order close at the single verified choke
 * point, fail-closed readiness gating, narrow post-mutation invalidation, and the
 * scope boundary that still holds after C3 (no receipt/refund/handoff control).
 *
 * These are *positive* assertions for the surface C3 authorized. The C2 script
 * keeps the invariants C3 must not regress (shared Floor, bounded resolution,
 * URL state, Find bill, compat routes, privacy).
 *
 * Run from the repo root: `npx tsx apps/web/scripts/cashier-c3-assertions.ts`.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Cashier C3 assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** Code-only view (block + line comments removed) for "must not contain" checks. */
function code(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const BASE = "apps/web/src";
const workspace = source(`${BASE}/components/cashier/floor/CashierSettlementWorkspace.tsx`);
const actions = source(`${BASE}/components/cashier/floor/CashierSettlementActions.tsx`);
const resolutionPanel = source(`${BASE}/components/cashier/resolution/CashierResolutionPanel.tsx`);
const paymentPanel = source(`${BASE}/components/cashier/checkout/CashierPaymentPanel.tsx`);
const closePanel = source(`${BASE}/components/cashier/checkout/CashierCloseOrderPanel.tsx`);
const paymentValidation = source(`${BASE}/lib/cashier/payment-validation.ts`);
const paymentsApi = source(`${BASE}/lib/cashier/payments.ts`);
const settlementMutations = source(`${BASE}/lib/cashier/settlement-mutations.ts`);
const resolutionPanelBill = source(`${BASE}/components/cashier/resolution/CashierSplitBillPanel.tsx`);
const resolutionPanelItems = source(`${BASE}/components/cashier/resolution/CashierSplitItemsPanel.tsx`);
const checkoutPreview = source(`${BASE}/components/cashier/queue/CashierCheckoutPreview.tsx`);
const resolutionPanelIndex = source(`${BASE}/components/cashier/floor/index.ts`);

// ── 1. Settlement execution is mounted inside the ONE canonical workspace ───
assert(
  existsSync(join(process.cwd(), `${BASE}/components/cashier/floor/CashierSettlementActions.tsx`)),
  "the C3 settlement-actions mount point exists",
);
assert(workspace.includes("CashierSettlementActions"), "settlement workspace mounts the C3 settlement actions");
assert(
  workspace.includes('title="Settlement"'),
  "settlement workspace exposes a Settlement section for execution",
);
assert(
  !workspace.includes('<Badge variant="info">Read-only</Badge>'),
  "settlement workspace no longer claims to be read-only",
);
assert(
  !workspace.includes("This foundation is read-only"),
  "settlement workspace no longer carries the C2 read-only copy",
);
assert(resolutionPanelIndex.includes("CashierSettlementActions"), "settlement actions are exported from the Floor barrel");

// ── 2. Existing verified primitives are REUSED, not rewritten ──────────────
assert(actions.includes("@/components/cashier/checkout"), "settlement actions reuse the verified checkout primitives");
assert(actions.includes("CashierPaymentPanel"), "settlement actions mount the existing CashierPaymentPanel");
assert(actions.includes("@/components/cashier/resolution"), "settlement actions reuse the verified split primitives");
assert(actions.includes("CashierResolutionPanel"), "settlement actions mount the existing CashierResolutionPanel");
assert(
  /variant=\{?"split-only"\}?/.test(actions),
  "the Floor path mounts split-only resolution (no merge / move / transfer handoff group)",
);
assert(
  resolutionPanel.includes('variant === "full"') && resolutionPanel.includes("CashierAdvancedResolutionPanel"),
  "the advanced handoff group renders only for the legacy full variant",
);
assert(
  resolutionPanel.includes('variant = "full"'),
  "the resolution panel variant is additive — the Queue compat path keeps the full behaviour",
);
const queueResolutionUsage = /<CashierResolutionPanel[\s\S]*?\/>/.exec(checkoutPreview)?.[0] || "";
assert(
  queueResolutionUsage.length > 0 && !queueResolutionUsage.includes("variant"),
  "Queue checkout preview is unchanged and keeps the default full resolution variant",
);

// ── 3. The Floor path introduces NO new payment/close client helper ────────
for (const [name, src] of [
  ["workspace", workspace],
  ["settlement actions", actions],
] as const) {
  for (const token of ["closeCashierOrder", "createCashierManualReferencePayment", "createCashierPaymentIntent", "apiRequest("]) {
    assert(!src.includes(token), `C3 ${name} calls no payment/close endpoint directly (${token}) — it reuses the panel`);
  }
}
assert(
  paymentPanel.includes("closeCashierOrder") && paymentPanel.includes("createCashierManualReferencePayment"),
  "payment execution still runs through the verified CashierPaymentPanel helpers",
);

// ── 4. Close runs at the single verified choke point ──────────────────────
assert(
  paymentsApi.includes("/api/pos/orders/${orderId}/close"),
  "close uses the canonical POST /api/pos/orders/:id/close endpoint",
);
assert(
  (paymentsApi.match(/\/close`/g) || []).length === 1,
  "there is exactly one close endpoint helper (no second close path)",
);
assert(
  !workspace.includes("/close") && !actions.includes("/close"),
  "the Floor workspace does not add a second close call site",
);
assert(
  !workspace.includes("completeReservation") && !actions.includes("completeReservation"),
  "reservation auto-completion is never duplicated from the Cashier frontend",
);
assert(closePanel.includes("order.status === \"CLOSED\""), "close-state surface reads canonical backend order status");

// ── 5. Fail-closed readiness gating ───────────────────────────────────────
assert(
  paymentValidation.includes('readiness.shift.status !== "active"'),
  "payment is blocked unless the shift reads active (loading/unavailable/failed all fail closed)",
);
assert(
  paymentValidation.includes('method.id === "CASH" && readiness.till.status !== "active"'),
  "cash payment is blocked unless the till reads active",
);
assert(
  paymentValidation.includes("if (paymentSummaryBlocked)"),
  "payment is blocked while the canonical payment summary is unresolved",
);
assert(
  paymentValidation.includes("isCashierOrderClosed(order) || isCashierOrderVoid(order)"),
  "payment is blocked on terminal orders",
);
assert(
  paymentValidation.includes("hasPendingCashierPaymentIntent(order)"),
  "payment is blocked while a provider intent is pending",
);
assert(
  workspace.includes("paymentSummaryBlocked={paymentUnavailable || paymentsQuery.isLoading}"),
  "the workspace propagates an unavailable/loading payment summary as a hard block",
);
assert(
  actions.includes("isCashierOrderClosed(order)") && actions.includes("isCashierOrderVoid(order)"),
  "terminal bills render a truthful notice instead of a settlement form",
);

// ── 6. Canonical amounts only — no optimistic money ───────────────────────
assert(
  paymentValidation.includes("order.payment.outstanding ?? order.total"),
  "outstanding balance comes from the canonical backend payment summary",
);
for (const [name, src] of [
  ["workspace", workspace],
  ["settlement actions", actions],
  ["settlement mutations", settlementMutations],
] as const) {
  assert(!src.includes("setQueryData"), `${name} never writes an optimistic cache value (setQueryData)`);
}
assert(
  settlementMutations.includes("await Promise.all") && settlementMutations.includes("refetchQueries"),
  "post-mutation refresh awaits a canonical re-read before a result is presented",
);
assert(
  settlementMutations.includes("cashierBillQueryKeys.orderDetail") &&
    settlementMutations.includes("cashierBillQueryKeys.orderPayments"),
  "both canonical money reads are refetched after every mutation",
);
assert(
  paymentPanel.includes("await refreshAfterMutation();") &&
    /catch \(error\) \{[\s\S]*await refreshAfterMutation\(\);/.test(paymentPanel),
  "the payment panel re-reads canonical state after failure as well as success",
);

// ── 7. Idempotency (BG3) on payment / close / split mutations ─────────────
assert(paymentsApi.includes('"Idempotency-Key": idempotencyKey'), "payment/close requests send an Idempotency-Key header");
assert(paymentPanel.includes("buildCashierIdempotencyKey"), "payment/close mutations build a BG3 idempotency key");
assert(
  resolutionPanelBill.includes("buildCashierIdempotencyKey") && resolutionPanelItems.includes("buildCashierIdempotencyKey"),
  "split mutations build a BG3 idempotency key",
);
assert(paymentPanel.includes("setIsSubmitting(true)") && paymentPanel.includes("disabled={!canSubmit}"), "duplicate submit is prevented while a payment is in flight");

// ── 8. Invalidation is narrow and key-factory driven ──────────────────────
assert(
  existsSync(join(process.cwd(), `${BASE}/lib/cashier/settlement-mutations.ts`)),
  "the C3 narrow-invalidation module exists",
);
const settlementMutationsCode = code(settlementMutations);
assert(
  !/invalidateQueries\(\s*\)/.test(settlementMutationsCode) &&
    !/invalidateQueries\(\{\s*\}\)/.test(settlementMutationsCode),
  "no broad invalidateQueries() sweep",
);
assert(
  !settlementMutationsCode.includes('queryKey: ["cashier"]'),
  "no Cashier-root invalidation",
);
for (const forbidden of ["menu", "profile", "auth", "receipts", "refunds", "queue", "reservations"]) {
  assert(
    !settlementMutationsCode.includes(`"${forbidden}"`),
    `settlement invalidation never touches the ${forbidden} domain`,
  );
}
assert(
  workspace.includes("useCashierSettlementRefresh"),
  "the workspace wires mutations to the narrow refresh helper",
);

// Runtime contract of the shared key factory the refresh helper builds on.
assert(
  JSON.stringify(cashierBillQueryKeys.orderDetail("b1", "o1")) === JSON.stringify(["cashier", "order-detail", "b1", "o1"]),
  "orderDetail key factory contract is stable",
);
assert(
  JSON.stringify(cashierBillQueryKeys.orderPayments("b1", "o1")) ===
    JSON.stringify(["cashier", "order-payments", "b1", "o1", "settlement"]),
  "orderPayments key factory contract is stable",
);
assert(
  JSON.stringify(cashierBillQueryKeys.tableBills("b1", "t1")) === JSON.stringify(["cashier", "table-bills", "b1", "t1"]),
  "tableBills key factory contract is stable",
);
assert(
  cashierBillQueryKeys.orderPayments("b1", "o1").includes("b1") &&
    cashierBillQueryKeys.orderDetail("b1", "o1").includes("b1"),
  "every settlement key is branch-scoped",
);

// Cross-role Floor caches are invalidated by their own narrow keys only.
assert(
  settlementMutations.includes('["waiter", "floor", branchId]') &&
    settlementMutations.includes('["supervisor", "floor", branchId]'),
  "cross-role Floor snapshots are invalidated narrowly (branch-scoped floor key only)",
);

// ── 9. Table context is threaded so the bounded table-bill list refreshes ──
assert(workspace.includes("tableId"), "the workspace accepts the resolving table context");
assert(
  source(`${BASE}/components/cashier/floor/CashierBillResolutionPanel.tsx`).includes("tableId={table.id}"),
  "the resolution panel passes its table context into the workspace",
);

// ── 10. Scope boundary still held after C3 ────────────────────────────────
for (const [name, src] of [
  ["workspace", workspace],
  ["settlement actions", actions],
] as const) {
  for (const token of [
    "CashierRefundPanel",
    "CashierReceiptDrawer",
    "CashierReceiptReprintDialog",
    "CashierReceiptSendDialog",
    "CashierAdvancedResolutionPanel",
    "CashierTransferTablePanel",
    "transferCashierOrderTable",
    "mergeCashierOrders",
    "moveCashierOrderItems",
  ]) {
    assert(!src.includes(token), `C3 ${name} exposes no C4/out-of-scope control (${token})`);
  }
}

// ── 11. Rebrand: token classes only, no raw hex ───────────────────────────
for (const [name, src] of [
  ["settlement actions", actions],
  ["workspace", workspace],
] as const) {
  assert(!/#[0-9a-fA-F]{3,8}\b/.test(src), `${name} uses design tokens only (no raw hex colour)`);
}

// ── 12. Compatibility routes untouched ────────────────────────────────────
assert(existsSync(join(process.cwd(), `${BASE}/pages/cashier/queue.tsx`)), "Queue compat route still exists after C3");
assert(existsSync(join(process.cwd(), `${BASE}/pages/cashier/receipts.tsx`)), "Receipts compat route still exists after C3");
const queuePage = source(`${BASE}/pages/cashier/queue.tsx`);
const receiptsPage = source(`${BASE}/pages/cashier/receipts.tsx`);
assert(!queuePage.includes("redirect:"), "Queue compat route is NOT redirected in C3 (retires at C5)");
assert(!receiptsPage.includes("redirect:"), "Receipts compat route is NOT redirected in C3 (retires at C4)");

console.log(
  "Cashier C3 assertions passed: payment/partial/split execution mounted inside the ONE canonical settlement workspace by reusing the verified checkout + split primitives, close at the single verified choke point (no duplicate close, no reservation-completion duplication), fail-closed readiness/summary/terminal gating, canonical amounts with an awaited re-read and no optimistic totals, BG3 idempotency + duplicate-submit prevention, narrow key-factory invalidation (no broad sweep, no cross-domain), scope boundary held (no receipt/refund/handoff control), token-only styling, and Queue/Receipts compat routes untouched.",
);
