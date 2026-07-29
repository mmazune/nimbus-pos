/**
 * Supervisor Reconstruction Prompt 3B1 — static/behavioral assertions.
 *
 * Run from the repo root:
 *   npx tsx apps/web/scripts/prompt3b1-assertions.ts
 *
 * Guards split-bill / split-items / move-items / merge: availability gating,
 * pure allocation + line validators, request-body builders, and structural
 * wiring (no Orders nav, dialogs mounted, deferred notice trimmed).
 */
import { readFileSync } from "fs";
import { join } from "path";

import {
  createIdempotencyIntent,
  buildOperationalIdempotencyKey,
} from "../src/lib/pos-shell/idempotency";
import {
  buildCustomSplitInput,
  buildEqualSplitInput,
  buildItemSelections,
  computeEqualSplitPreview,
  toCents,
  validateCustomSplit,
  validateEqualCount,
  validateLineSelections,
} from "../src/lib/supervisor/order-action-forms";
import {
  SUPERVISOR_LIVE_ORDER_ACTIONS,
  getSupervisorOrderActionAvailability,
} from "../src/lib/supervisor/order-actions";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error("Prompt3B1 assertion failed: " + message);
}
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const SPLIT = ["pos:order:split"];
const MERGE = ["pos:order:merge"];
const MOVE = ["pos:order:move-items"];
const ALL = ["pos:order:split", "pos:order:merge", "pos:order:move-items", "pos:orders:write"];

// ── Live set now includes the four handoff actions ──
for (const a of ["request-bill", "mark-served", "split-bill", "split-items", "move-items", "merge"] as const) {
  assert(SUPERVISOR_LIVE_ORDER_ACTIONS.includes(a), `${a} is live`);
}
// ── Still-deferred actions stay hidden even with permission ──
// (transfer-table → 3B2; void + request-discount → 3B3A; approve/reject-discount +
// complimentary → 3B3B, asserted in their own scripts. Only transfer-server remains.)
for (const a of ["transfer-server"] as const) {
  const av = getSupervisorOrderActionAvailability(a, {
    permissions: ["pos:order:transfer", "pos:orders:void", "pos:discount:request", "pos:discount:approve"],
    order: { status: "READY" },
    lineCount: 2,
    total: 10000,
  });
  assert(!av.visible, `${a} stays hidden`);
}

// ── Permission gating ──
assert(!getSupervisorOrderActionAvailability("split-bill", { permissions: [], order: { status: "SENT" }, total: 10000 }).visible, "split-bill hidden without perm");
assert(getSupervisorOrderActionAvailability("split-bill", { permissions: SPLIT, order: { status: "SENT" }, total: 10000 }).enabled, "split-bill enabled with perm + positive total");
assert(getSupervisorOrderActionAvailability("merge", { permissions: MERGE, order: { status: "SERVED" } }).enabled, "merge enabled with perm on open order");
assert(getSupervisorOrderActionAvailability("move-items", { permissions: MOVE, order: { status: "SENT" }, lineCount: 1 }).enabled, "move-items enabled with perm + lines");

// ── Status gating (CLOSED/VOIDED blocked) ──
for (const status of ["CLOSED", "VOIDED"] as const) {
  for (const a of ["split-bill", "split-items", "move-items", "merge"] as const) {
    const av = getSupervisorOrderActionAvailability(a, { permissions: ALL, order: { status }, lineCount: 2, total: 10000 });
    assert(av.visible && !av.enabled && av.reason, `${a} disabled with reason on ${status}`);
  }
}

// ── Line / total gating ──
assert(!getSupervisorOrderActionAvailability("split-items", { permissions: SPLIT, order: { status: "SENT" }, lineCount: 0 }).enabled, "split-items needs lines");
assert(!getSupervisorOrderActionAvailability("move-items", { permissions: MOVE, order: { status: "SENT" }, lineCount: 0 }).enabled, "move-items needs lines");
assert(!getSupervisorOrderActionAvailability("split-bill", { permissions: SPLIT, order: { status: "SENT" }, total: 0 }).enabled, "split-bill needs positive total");

// ── Idempotency requirement metadata ──
for (const a of ["split-bill", "split-items", "move-items", "merge"] as const) {
  assert(getSupervisorOrderActionAvailability(a, { permissions: ALL, order: { status: "READY" }, lineCount: 2, total: 10000 }).requiresIdempotencyKey, `${a} requires idempotency key`);
}
assert(getSupervisorOrderActionAvailability("merge", { permissions: MERGE, order: { status: "READY" } }).requiresReason, "merge requires a reason");

// ── EQUAL split allocation: floor per group, last absorbs residual, sums to total ──
const p1 = computeEqualSplitPreview(10000, 3);
assert(p1 !== null, "equal preview computed");
assert(p1!.groups.length === 3, "3 groups");
assert(p1!.groups[0].amount === "3333.33" && p1!.groups[2].amount === "3333.34", "residual on last group");
const sumCents = p1!.groups.reduce((s, g) => s + toCents(g.amount), 0);
assert(sumCents === toCents(10000), "equal allocation sums exactly to total");
assert(computeEqualSplitPreview(15000, 3)!.groups.every((g) => g.amount === "5000.00"), "clean equal split");
assert(computeEqualSplitPreview(10000, 1) === null, "count<2 invalid preview");
assert(!validateEqualCount(1).valid && !validateEqualCount(21).valid && validateEqualCount(2).valid && validateEqualCount(20).valid, "count bounds 2..20");

// ── CUSTOM split: sum must equal total ──
assert(validateCustomSplit(["5000", "5000"], 10000).valid, "custom sum equals total ok");
assert(!validateCustomSplit(["5000", "4000"], 10000).valid, "custom sum mismatch rejected");
assert(!validateCustomSplit(["10000"], 10000).valid, "custom needs >=2 groups");
assert(!validateCustomSplit(["0", "10000"], 10000).valid, "custom zero group rejected");
assert(!validateCustomSplit(["abc", "5000"], 10000).valid, "custom non-numeric rejected");

// ── Request-body builders ──
assert(JSON.stringify(buildEqualSplitInput(3, " x ")) === JSON.stringify({ mode: "EQUAL", count: 3, reason: "x" }), "equal input shape");
const custom = buildCustomSplitInput([{ amount: "5000" }, { label: " A ", amount: "5000" }]);
assert(custom.mode === "CUSTOM" && custom.groups!.length === 2 && custom.groups![0].amount === "5000.00" && custom.groups![1].label === "A", "custom input shape");

// ── Line selection validation ──
const lines = [{ id: "a", quantity: 3 }, { id: "b", quantity: 1 }];
assert(validateLineSelections([{ orderItemId: "a", quantity: 2 }], lines).valid, "valid line selection");
assert(!validateLineSelections([], lines).valid, "empty selection rejected");
assert(!validateLineSelections([{ orderItemId: "a", quantity: 4 }], lines).valid, "over-quantity rejected");
assert(!validateLineSelections([{ orderItemId: "a", quantity: 1 }, { orderItemId: "a", quantity: 1 }], lines).valid, "duplicate rejected");
assert(!validateLineSelections([{ orderItemId: "zzz", quantity: 1 }], lines).valid, "unknown line rejected");
assert(JSON.stringify(buildItemSelections({ a: 2, b: 0, c: 1 })) === JSON.stringify([{ orderItemId: "a", quantity: 2 }, { orderItemId: "c", quantity: 1 }]), "builds selections, drops zeros");

// ── Idempotency intent (reuse + renewal) ──
const intent = createIdempotencyIntent(() => buildOperationalIdempotencyKey({ operation: "supervisor:merge", orderId: "o1" }));
const k1 = intent.begin();
assert(intent.begin() === k1, "same key on retry");
intent.reset();
assert(intent.begin() !== k1, "new key after material change");

// ── Structural wiring ──
const workspace = source("apps/web/src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx");
for (const dlg of ["SupervisorSplitBillDialog", "SupervisorSplitItemsDialog", "SupervisorMoveItemsDialog", "SupervisorMergeOrderDialog"]) {
  assert(workspace.includes(dlg), `workspace mounts ${dlg}`);
}
assert(workspace.includes("getSupervisorOrderActionAvailability"), "workspace uses central availability");
assert(workspace.includes("Payment collection and order close remain in Cashier"), "payment read-only boundary retained");
assert(!/Split,\s*merge,\s*transfer/.test(workspace), "deferred notice no longer lists split/merge as unavailable");

const targetSelector = source("apps/web/src/components/supervisor/floor/SupervisorOrderTargetSelector.tsx");
assert(targetSelector.includes('excludeStatus: ["CLOSED", "VOIDED"]'), "target selector excludes closed/voided");
assert(targetSelector.includes("order.id !== sourceOrderId"), "target selector excludes the source order");
assert(targetSelector.includes("pageSize"), "target selector is bounded/paginated");

const mergeDialog = source("apps/web/src/components/supervisor/floor/SupervisorMergeOrderDialog.tsx");
assert(mergeDialog.includes("MERGE_SOURCE_HAS_PAYMENTS"), "merge dialog maps the payments-block error");
assert(mergeDialog.includes("will be VOIDED") || mergeDialog.includes("voided"), "merge dialog states surviving/void outcome");

const routes = source("apps/web/src/lib/supervisor/routes.ts");
assert(!/label:\s*"Orders"/.test(routes), "no Supervisor Orders nav");

console.log(
  "Prompt3B1 assertions passed: live-set + hidden 3B2/3B3, permission/status/line/total gating, idempotency metadata + intent lifecycle, EQUAL/CUSTOM allocation math, line-selection validation, body builders, bounded source-excluding target selector, merge payment-block mapping, and no Orders nav.",
);
