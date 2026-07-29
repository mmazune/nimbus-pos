/**
 * Supervisor Reconstruction Prompt 3B3A — static/behavioral assertions.
 *
 * Run from the repo root:
 *   npx tsx apps/web/scripts/prompt3b3a-assertions.ts
 *
 * Guards active-order VOID + order-level DISCOUNT REQUEST: availability gating
 * (permission / status / payment / pending-discount / positive-total), pure
 * discount validators + preview math mirroring the backend, error mapping, and
 * structural wiring (Adjustments group, dialogs mounted, payment read-only, no
 * approval/complimentary controls, no Orders nav, permissions NOT silently granted).
 */
import { readFileSync } from "fs";
import { join } from "path";

import {
  SUPERVISOR_LIVE_ORDER_ACTIONS,
  getSupervisorOrderActionAvailability,
} from "../src/lib/supervisor/order-actions";
import {
  computeDiscountPreview,
  discountRequestErrorCopy,
  round2,
  validateAdjustmentReason,
  validateDiscountValue,
  voidOrderErrorCopy,
} from "../src/lib/supervisor/order-financials";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error("Prompt3B3A assertion failed: " + message);
}
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const VOID = ["pos:orders:void"];
const DISCOUNT = ["pos:discount:request"];

// ── Live set includes void + request-discount; transfer-server stays hidden ──
// (approve-discount / reject-discount / complimentary went live in Prompt 3B3B and
// are asserted in prompt3b3b-assertions.)
assert(SUPERVISOR_LIVE_ORDER_ACTIONS.includes("void"), "void is live");
assert(SUPERVISOR_LIVE_ORDER_ACTIONS.includes("request-discount"), "request-discount is live");
assert(!SUPERVISOR_LIVE_ORDER_ACTIONS.includes("transfer-server"), "transfer-server is NOT live");

// ── Permission gating ──
assert(!getSupervisorOrderActionAvailability("void", { permissions: [], order: { status: "SENT" } }).visible, "void hidden without perm");
assert(!getSupervisorOrderActionAvailability("request-discount", { permissions: [], order: { status: "SENT" }, total: 10000 }).visible, "discount hidden without perm");

// ── VOID: enabled on an eligible unpaid open order ──
const voidOk = getSupervisorOrderActionAvailability("void", { permissions: VOID, order: { status: "SENT" }, paymentState: "unpaid" });
assert(voidOk.visible && voidOk.enabled, "void enabled on unpaid SENT order");
assert(voidOk.requiresReason && voidOk.requiresConfirmation, "void requires reason + confirmation");
assert(!voidOk.requiresIdempotencyKey, "void does NOT require idempotency key (not BG3)");
assert(!voidOk.requiresManagerPin, "void does not require a manager PIN");

// ── VOID: status gating (SERVED/CLOSED/VOIDED disabled with reason) ──
for (const status of ["SERVED", "CLOSED", "VOIDED"] as const) {
  const av = getSupervisorOrderActionAvailability("void", { permissions: VOID, order: { status }, paymentState: "unpaid" });
  assert(av.visible && !av.enabled && av.reason, `void disabled with reason on ${status}`);
}

// ── VOID: payment-state gating (money present or unavailable → blocked) ──
for (const paymentState of ["settled", "partially-paid", "pending", "refunded", "failed"] as const) {
  const av = getSupervisorOrderActionAvailability("void", { permissions: VOID, order: { status: "SENT" }, paymentState });
  assert(av.visible && !av.enabled && /payment/i.test(av.reason || ""), `void blocked on ${paymentState} payment`);
}
assert(
  !getSupervisorOrderActionAvailability("void", { permissions: VOID, order: { status: "SENT" }, paymentUnavailable: true }).enabled,
  "void blocked while payment state unavailable",
);

// ── DISCOUNT: enabled on eligible unpaid open order with positive total ──
const discOk = getSupervisorOrderActionAvailability("request-discount", { permissions: DISCOUNT, order: { status: "READY" }, total: 10000, paymentState: "unpaid" });
assert(discOk.visible && discOk.enabled, "discount enabled on unpaid READY with total");
assert(!discOk.requiresIdempotencyKey, "discount does NOT require idempotency key (not BG3)");

// ── DISCOUNT: gating ──
assert(!getSupervisorOrderActionAvailability("request-discount", { permissions: DISCOUNT, order: { status: "SERVED" }, total: 10000, paymentState: "unpaid" }).enabled, "discount blocked on SERVED");
assert(!getSupervisorOrderActionAvailability("request-discount", { permissions: DISCOUNT, order: { status: "SENT" }, total: 0, paymentState: "unpaid" }).enabled, "discount blocked with no positive total");
const pendingBlocked = getSupervisorOrderActionAvailability("request-discount", { permissions: DISCOUNT, order: { status: "SENT" }, total: 10000, paymentState: "unpaid", hasPendingDiscount: true });
assert(pendingBlocked.visible && !pendingBlocked.enabled && /pending/i.test(pendingBlocked.reason || ""), "discount blocked while a pending discount exists");
assert(!getSupervisorOrderActionAvailability("request-discount", { permissions: DISCOUNT, order: { status: "SENT" }, total: 10000, paymentState: "settled" }).enabled, "discount blocked on settled payment");

// ── PERCENTAGE validation ──
assert(validateDiscountValue("PERCENTAGE", 10, 10000).valid, "10% valid");
assert(validateDiscountValue("PERCENTAGE", 100, 10000).valid, "100% valid (allowed)");
assert(!validateDiscountValue("PERCENTAGE", 0, 10000).valid, "0% rejected");
assert(!validateDiscountValue("PERCENTAGE", -5, 10000).valid, "negative % rejected");
assert(!validateDiscountValue("PERCENTAGE", 101, 10000).valid, ">100% rejected");
assert(!validateDiscountValue("PERCENTAGE", "abc", 10000).valid, "non-numeric % rejected");
assert(!validateDiscountValue("PERCENTAGE", "10.123", 10000).valid, ">2dp rejected");

// ── FIXED validation ──
assert(validateDiscountValue("FIXED", 5000, 10000).valid, "fixed within subtotal valid");
assert(!validateDiscountValue("FIXED", 0, 10000).valid, "fixed 0 rejected");
assert(!validateDiscountValue("FIXED", -1, 10000).valid, "fixed negative rejected");
assert(!validateDiscountValue("FIXED", 20000, 10000).valid, "fixed exceeding subtotal rejected (no silent cap)");

// ── Preview math mirrors backend (basis = subtotal; total floored at 0) ──
assert(round2(3333.335) === 3333.34 || round2(3333.335) === 3333.33, "round2 works");
const pPreview = computeDiscountPreview("PERCENTAGE", 10, 10000);
assert(pPreview && pPreview.discountAmount === 1000 && pPreview.newTotal === 9000, "percentage preview 10% of 10000");
const fPreview = computeDiscountPreview("FIXED", 2500, 10000);
assert(fPreview && fPreview.discountAmount === 2500 && fPreview.newTotal === 7500, "fixed preview");
const capped = computeDiscountPreview("FIXED", 999999, 10000);
assert(capped && capped.discountAmount === 10000 && capped.newTotal === 0, "fixed preview caps at subtotal, total floored 0");
assert(computeDiscountPreview("PERCENTAGE", 0, 10000) === null, "invalid value → null preview");

// ── Reason validation ──
assert(!validateAdjustmentReason("").valid, "empty reason rejected");
assert(!validateAdjustmentReason("   ").valid, "whitespace reason rejected");
assert(validateAdjustmentReason("Prompt 3B3A active-order void validation").valid, "descriptive reason valid");

// ── Error copy mapping (operational, no raw endpoint noise) ──
assert(/no longer be voided/i.test(voidOrderErrorCopy(new Error("Invalid transition from SERVED to VOIDED"))), "void invalid-transition mapped");
assert(/reason is required/i.test(voidOrderErrorCopy(new Error("Post-kitchen void requires a reason"))), "void reason error mapped");
assert(/cannot exceed 100/i.test(discountRequestErrorCopy(new Error("Percentage discount cannot exceed 100"))), "discount >100 mapped");
assert(/current state/i.test(discountRequestErrorCopy(new Error("Cannot apply discount to order in CLOSED state"))), "discount state error mapped");

// ── Structural wiring ──
const workspace = source("apps/web/src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx");
assert(workspace.includes("SupervisorVoidOrderDialog"), "workspace mounts the void dialog");
assert(workspace.includes("SupervisorDiscountRequestDialog"), "workspace mounts the discount dialog");
assert(workspace.includes('getSupervisorOrderActionAvailability("void"') && workspace.includes('getSupervisorOrderActionAvailability("request-discount"'), "workspace derives both from central availability");
assert(/>Adjustments</.test(workspace), "workspace has an Adjustments group");
assert(workspace.includes("Payment collection and order close remain in Cashier"), "payment read-only boundary retained");
// (Prompt 3B3B moved approve/reject inline onto PENDING discount rows and updated the
// panel note; those live controls are asserted in prompt3b3b-assertions.)
assert(workspace.includes("discount queue stays in Approvals"), "discount panel references the Approvals queue");

const voidDialog = source("apps/web/src/components/supervisor/floor/SupervisorVoidOrderDialog.tsx");
assert(voidDialog.includes("does NOT refund any payment") && voidDialog.includes("post-close void"), "void dialog separates void from refund/complimentary/post-close");
assert(voidDialog.includes("setQueryData") && voidDialog.includes('"VOIDED"'), "void dialog writes canonical VOIDED state");

const discountDialog = source("apps/web/src/components/supervisor/floor/SupervisorDiscountRequestDialog.tsx");
assert(discountDialog.includes('["supervisor", "approvals", "discounts", branchId]'), "discount dialog invalidates ONLY the discount approvals domain");
assert(!discountDialog.includes('"leave"') && !discountDialog.includes('"anomalies"') && !discountDialog.includes('"shift-swaps"'), "discount dialog does NOT touch other approval domains");
// Truthful totals: the discount dialog RE-FETCHES (invalidate) the order rather than
// writing a computed final total into the cache (no setQueryData on order-detail).
assert(discountDialog.includes("backend-authoritative"), "discount dialog documents backend-authoritative totals");
assert(discountDialog.includes("invalidateQueries") && !discountDialog.includes("setQueryData"), "discount dialog re-fetches canonical totals instead of writing a computed total");

const financials = source("apps/web/src/lib/supervisor/order-financials.ts");
assert(!financials.includes("from \"react\"") && !financials.includes("apiRequest"), "order-financials stays pure (no react/runtime imports)");

const routes = source("apps/web/src/lib/supervisor/routes.ts");
assert(!/label:\s*"Orders"/.test(routes), "no Supervisor Orders nav");

// ── Permissions were NOT silently granted (Supervisor already held them) ──
const seed = source("packages/db/prisma/seed.ts");
const supervisorBlock = seed.slice(seed.indexOf("Supervisor: ["), seed.indexOf("Supervisor: [") + 4000);
assert(supervisorBlock.includes("'pos:orders:void'"), "seed already grants pos:orders:void (pre-existing)");
assert(supervisorBlock.includes("'pos:discount:request'"), "seed already grants pos:discount:request (pre-existing)");

console.log(
  "Prompt3B3A assertions passed: void + request-discount live with permission/status/payment/pending/total gating, PERCENTAGE + FIXED validation, backend-mirrored preview math, error mapping, Adjustments wiring, discount-domain-only invalidation, pure financials, no Orders nav, permissions not silently granted.",
);
