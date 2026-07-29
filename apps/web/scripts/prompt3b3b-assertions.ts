/**
 * Supervisor Reconstruction Prompt 3B3B — static/behavioral assertions.
 *
 * Run from the repo root:
 *   npx tsx apps/web/scripts/prompt3b3b-assertions.ts
 *
 * Guards discount APPROVE / REJECT + COMPLIMENTARY: availability gating (permission /
 * status / payment), reject-not-payment-gated, complimentary contract helper (Outcome
 * B whole-order 100% + metadata), manager-PIN validation, error mapping, and structural
 * wiring (inline review controls, discount-domain-only invalidation, comp ≠ void/refund,
 * no Refund / post-close void / payment controls, no Orders nav, permissions not granted).
 */
import { readFileSync } from "fs";
import { join } from "path";

import {
  SUPERVISOR_LIVE_ORDER_ACTIONS,
  getSupervisorOrderActionAvailability,
} from "../src/lib/supervisor/order-actions";
import {
  approveDiscountErrorCopy,
  buildComplimentaryDiscountInput,
  COMPLIMENTARY_CATEGORIES,
  rejectDiscountErrorCopy,
  validateManagerPin,
} from "../src/lib/supervisor/order-financials";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error("Prompt3B3B assertion failed: " + message);
}
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const APPROVE = ["pos:discount:approve"];
const REQUEST = ["pos:discount:request"];

// ── Live set now includes approve/reject/complimentary; transfer-server stays hidden ──
for (const a of ["approve-discount", "reject-discount", "complimentary"] as const) {
  assert(SUPERVISOR_LIVE_ORDER_ACTIONS.includes(a), `${a} is live`);
}
assert(!SUPERVISOR_LIVE_ORDER_ACTIONS.includes("transfer-server"), "transfer-server is NOT live");

// ── Permission gating ──
assert(!getSupervisorOrderActionAvailability("approve-discount", { permissions: [], order: { status: "SENT" } }).visible, "approve hidden without perm");
assert(!getSupervisorOrderActionAvailability("reject-discount", { permissions: [], order: { status: "SENT" } }).visible, "reject hidden without perm");
assert(!getSupervisorOrderActionAvailability("complimentary", { permissions: [], order: { status: "SENT" }, total: 10000 }).visible, "complimentary hidden without perm");

// ── APPROVE: enabled on a discountable unpaid order; metadata truthful ──
const approveOk = getSupervisorOrderActionAvailability("approve-discount", { permissions: APPROVE, order: { status: "SENT" }, paymentState: "unpaid" });
assert(approveOk.visible && approveOk.enabled, "approve enabled on unpaid SENT order");
assert(approveOk.requiresConfirmation && !approveOk.requiresIdempotencyKey && !approveOk.requiresManagerPin, "approve: confirm, no idempotency key, PIN not required");
// Approve excludes SERVED (backend re-checks discountable) + terminal
for (const status of ["SERVED", "CLOSED", "VOIDED"] as const) {
  const av = getSupervisorOrderActionAvailability("approve-discount", { permissions: APPROVE, order: { status }, paymentState: "unpaid" });
  assert(av.visible && !av.enabled && av.reason, `approve disabled with reason on ${status}`);
}
// Approve is payment-gated (recalcs totals)
assert(!getSupervisorOrderActionAvailability("approve-discount", { permissions: APPROVE, order: { status: "SENT" }, paymentState: "settled" }).enabled, "approve blocked on settled payment");
assert(!getSupervisorOrderActionAvailability("approve-discount", { permissions: APPROVE, order: { status: "SENT" }, paymentUnavailable: true }).enabled, "approve blocked while payment unavailable");

// ── REJECT: enabled on open order; reason required; NOT payment-gated (non-mutating) ──
const rejectOk = getSupervisorOrderActionAvailability("reject-discount", { permissions: APPROVE, order: { status: "SENT" }, paymentState: "unpaid" });
assert(rejectOk.visible && rejectOk.enabled && rejectOk.requiresReason, "reject enabled + requires reason");
assert(!rejectOk.requiresIdempotencyKey, "reject not idempotent");
assert(getSupervisorOrderActionAvailability("reject-discount", { permissions: APPROVE, order: { status: "SENT" }, paymentState: "settled" }).enabled, "reject NOT payment-gated (non-mutating)");

// ── COMPLIMENTARY: whole-order via discount-request permission + gating ──
const compOk = getSupervisorOrderActionAvailability("complimentary", { permissions: REQUEST, order: { status: "READY" }, total: 10000, paymentState: "unpaid" });
assert(compOk.visible && compOk.enabled && compOk.requiresReason, "complimentary enabled + requires reason");
assert(!compOk.requiresIdempotencyKey, "complimentary not idempotent");
assert(!getSupervisorOrderActionAvailability("complimentary", { permissions: REQUEST, order: { status: "SERVED" }, total: 10000, paymentState: "unpaid" }).enabled, "complimentary blocked on SERVED");
assert(!getSupervisorOrderActionAvailability("complimentary", { permissions: REQUEST, order: { status: "SENT" }, total: 0, paymentState: "unpaid" }).enabled, "complimentary blocked with no positive total");
assert(!getSupervisorOrderActionAvailability("complimentary", { permissions: REQUEST, order: { status: "SENT" }, total: 10000, paymentState: "settled" }).enabled, "complimentary blocked on settled payment");
assert(!getSupervisorOrderActionAvailability("complimentary", { permissions: REQUEST, order: { status: "SENT" }, total: 10000, paymentState: "unpaid", hasPendingDiscount: true }).enabled, "complimentary blocked while a pending discount exists");

// ── Complimentary is a truthful WHOLE-ORDER discount (Outcome B), distinct from void/refund ──
const compInput = buildComplimentaryDiscountInput("  Prompt 3B3B complimentary validation  ", "SERVICE_RECOVERY");
assert(compInput.type === "PERCENTAGE" && compInput.value === 100, "complimentary = 100% whole-order discount");
assert(compInput.reason === "Prompt 3B3B complimentary validation", "complimentary reason trimmed + preserved");
assert(compInput.metadata && (compInput.metadata as Record<string, unknown>).complimentary === true, "complimentary metadata flag persisted");
assert((compInput.metadata as Record<string, unknown>).category === "SERVICE_RECOVERY", "complimentary category persisted in metadata");
assert(COMPLIMENTARY_CATEGORIES.length === 5, "five complimentary categories");

// ── Manager PIN validation (optional; ≤8) ──
assert(validateManagerPin("").valid, "empty PIN valid (optional)");
assert(validateManagerPin("11223344").valid, "8-char PIN valid");
assert(!validateManagerPin("123456789").valid, ">8-char PIN rejected");

// ── Error copy mapping ──
assert(/already been decided/i.test(approveDiscountErrorCopy(new Error("Cannot approve a discount in APPROVED status"))), "approve already-decided mapped");
assert(/PIN was not recognised/i.test(approveDiscountErrorCopy(new Error("Invalid manager PIN"))), "invalid PIN mapped");
assert(/already been decided/i.test(rejectDiscountErrorCopy(new Error("Cannot reject a discount in REJECTED status"))), "reject already-decided mapped");

// ── Structural wiring ──
const workspace = source("apps/web/src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx");
for (const dlg of ["SupervisorApproveDiscountDialog", "SupervisorRejectDiscountDialog", "SupervisorComplimentaryDialog"]) {
  assert(workspace.includes(dlg), `workspace mounts ${dlg}`);
}
assert(workspace.includes('getSupervisorOrderActionAvailability("approve-discount"') && workspace.includes('getSupervisorOrderActionAvailability("reject-discount"') && workspace.includes('getSupervisorOrderActionAvailability("complimentary"'), "workspace derives all three from central availability");
assert(/>\s*Approve\s*</.test(workspace) && />\s*Reject\s*</.test(workspace), "inline approve/reject controls on pending rows");
assert(/>\s*Complimentary\s*</.test(workspace), "Complimentary in the Adjustments group");
assert(workspace.includes("Payment collection and order close remain in Cashier"), "payment read-only boundary retained");
assert(workspace.includes("intentionally not shown here"), "deferred boundary notice retained");
assert(!workspace.includes("Take payment") && !workspace.includes('setActiveAction("refund"') && !workspace.includes('setActiveAction("post-close'), "no refund/post-close/take-payment controls wired in the workspace");

const approveDialog = source("apps/web/src/components/supervisor/floor/SupervisorApproveDiscountDialog.tsx");
assert(approveDialog.includes("You requested this discount"), "approve dialog surfaces the self-approval note (backend permits it)");
assert(approveDialog.includes("invalidateQueries") && !approveDialog.includes("setQueryData"), "approve re-fetches canonical totals (no optimistic total)");

const rejectDialog = source("apps/web/src/components/supervisor/floor/SupervisorRejectDiscountDialog.tsx");
assert(rejectDialog.includes("order total stays unchanged") || rejectDialog.includes("total stays unchanged"), "reject dialog states totals are unchanged");
assert(!rejectDialog.includes('"order-detail"'), "reject does NOT invalidate order-detail totals (rejection changes nothing)");

const compDialog = source("apps/web/src/components/supervisor/floor/SupervisorComplimentaryDialog.tsx");
assert(compDialog.includes("NOT a void") && compDialog.includes("refund"), "complimentary dialog distinguishes comp from void + refund");
assert(!compDialog.includes('"leave"') && !compDialog.includes('"anomalies"') && !compDialog.includes('"shift-swaps"'), "complimentary invalidates discount domain only");

const financials = source("apps/web/src/lib/supervisor/order-financials.ts");
assert(!financials.includes("from \"react\"") && !financials.includes("apiRequest"), "order-financials stays pure");

const routes = source("apps/web/src/lib/supervisor/routes.ts");
assert(!/label:\s*"Orders"/.test(routes), "no Supervisor Orders nav");

// ── Permissions NOT silently granted (pre-existing) ──
const seed = source("packages/db/prisma/seed.ts");
const supervisorBlock = seed.slice(seed.indexOf("Supervisor: ["), seed.indexOf("Supervisor: [") + 4000);
assert(supervisorBlock.includes("'pos:discount:approve'"), "seed already grants pos:discount:approve (pre-existing)");
assert(supervisorBlock.includes("'pos:discount:request'"), "seed already grants pos:discount:request (pre-existing)");

console.log(
  "Prompt3B3B assertions passed: approve/reject/complimentary live with permission/status/payment gating, reject non-payment-gated, complimentary = Outcome-B whole-order 100% + metadata (distinct from void/refund), manager-PIN validation, error mapping, inline review wiring, discount-domain-only invalidation, no refund/post-close/payment controls, no Orders nav, permissions not silently granted.",
);
