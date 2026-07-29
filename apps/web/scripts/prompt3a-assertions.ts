/**
 * Supervisor Reconstruction Prompt 3A — static/behavioral assertions.
 *
 * Run from the repo root:
 *   npx tsx apps/web/scripts/prompt3a-assertions.ts
 *
 * Guards the Prompt 3A foundation: idle-session parity, shared idle constants,
 * central action availability, canonical order wiring, confirmation dialog
 * accessibility, and idempotency-intent lifecycle. Throwing aborts with a
 * non-zero exit.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import {
  OPERATIONAL_ACTIVITY_EVENTS,
  OPERATIONAL_IDLE_TIMEOUT_MS,
} from "../src/components/pos-shell/idle";
import {
  buildOperationalIdempotencyKey,
  createIdempotencyIntent,
} from "../src/lib/pos-shell/idempotency";
import {
  SUPERVISOR_LIVE_ORDER_ACTIONS,
  getSupervisorOrderActionAvailability,
} from "../src/lib/supervisor/order-actions";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error("Prompt3A assertion failed: " + message);
}

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const WRITE = ["pos:orders:write"];

// ── Idle-session parity + shared constants ──
assert(OPERATIONAL_IDLE_TIMEOUT_MS === 15 * 60 * 1000, "idle timeout preserved at 15 minutes");
assert(OPERATIONAL_ACTIVITY_EVENTS.length === 5, "five activity events preserved");
assert(OPERATIONAL_ACTIVITY_EVENTS.includes("keydown"), "keydown activity event preserved");

const idleHandlerSrc = source("apps/web/src/components/pos-shell/OperationalIdleLogoutHandler.tsx");
assert(
  idleHandlerSrc.includes('from "@/components/pos-shell/idle"'),
  "shared idle handler imports shared (non-waiter) idle constants",
);
assert(
  !idleHandlerSrc.includes("WAITER_ACTIVITY_EVENTS") && !idleHandlerSrc.includes("WAITER_IDLE_TIMEOUT_MS"),
  "shared idle handler no longer references waiter-namespaced constants",
);

const supervisorShellSrc = source("apps/web/src/components/supervisor/shell/SupervisorShell.tsx");
assert(
  supervisorShellSrc.includes("idleHandler=") &&
    supervisorShellSrc.includes("OperationalIdleLogoutHandler"),
  "SupervisorShell injects the shared idle handler",
);

const waiterShellSrc = source("apps/web/src/components/waiter/shell/WaiterShell.tsx");
const cashierShellSrc = source("apps/web/src/components/cashier/shell/CashierShell.tsx");
assert(waiterShellSrc.includes("idleHandler="), "WaiterShell keeps its idle handler");
assert(cashierShellSrc.includes("idleHandler="), "CashierShell keeps its idle handler");

// ── Central action availability: permission gating ──
const noPerm = getSupervisorOrderActionAvailability("request-bill", {
  permissions: [],
  order: { status: "SENT" },
});
assert(!noPerm.visible, "request-bill hidden without pos:orders:write");

const withPerm = getSupervisorOrderActionAvailability("request-bill", {
  permissions: WRITE,
  order: { status: "SENT" },
});
assert(withPerm.visible && withPerm.enabled, "request-bill visible+enabled on an open order");

// ── Action availability: order status ──
for (const status of ["CLOSED", "VOIDED"] as const) {
  const a = getSupervisorOrderActionAvailability("request-bill", { permissions: WRITE, order: { status } });
  assert(a.visible && !a.enabled && a.reason, `request-bill disabled with reason on ${status} order`);
}

const markReady = getSupervisorOrderActionAvailability("mark-served", { permissions: WRITE, order: { status: "READY" } });
assert(markReady.enabled && markReady.requiresConfirmation, "mark-served enabled + requires confirmation when READY");

for (const status of ["NEW", "SENT", "IN_KITCHEN", "SERVED"] as const) {
  const a = getSupervisorOrderActionAvailability("mark-served", { permissions: WRITE, order: { status } });
  assert(a.visible && !a.enabled && a.reason, `mark-served disabled with reason when ${status}`);
}

// ── No order / errored order blocks live actions ──
const noOrder = getSupervisorOrderActionAvailability("request-bill", { permissions: WRITE, order: null });
assert(!noOrder.enabled && noOrder.reason, "request-bill disabled with reason when no order");
const errored = getSupervisorOrderActionAvailability("request-bill", {
  permissions: WRITE,
  order: { status: "SENT" },
  orderErrored: true,
});
assert(!errored.enabled, "request-bill disabled when order errored");

// ── Mutation-in-progress blocks live actions ──
const mutating = getSupervisorOrderActionAvailability("mark-served", {
  permissions: WRITE,
  order: { status: "READY" },
  isMutating: true,
});
assert(!mutating.enabled, "actions disabled while another action is in progress");

// ── Prompt 3B actions remain hidden foundation (never live in 3A) ──
const allPerms = [
  "pos:orders:write",
  "pos:orders:void",
  "pos:order:split",
  "pos:order:merge",
  "pos:order:move-items",
  "pos:order:transfer",
  "pos:discount:request",
  "pos:discount:approve",
];
// NOTE: split/move/merge went live in Prompt 3B1, transfer-table in 3B2, void +
// request-discount in 3B3A, and approve/reject-discount + complimentary in 3B3B.
// Only transfer-server remains deferred (no safe server selector).
for (const action of ["transfer-server"] as const) {
  const a = getSupervisorOrderActionAvailability(action, { permissions: allPerms, order: { status: "READY" } });
  assert(!a.visible, `${action} stays hidden even with permission`);
}
assert(
  SUPERVISOR_LIVE_ORDER_ACTIONS.includes("request-bill") &&
    SUPERVISOR_LIVE_ORDER_ACTIONS.includes("mark-served"),
  "request-bill and mark-served (Prompt 3A service actions) remain live",
);

// ── Idempotency-key requirement metadata (foundation for Prompt 3B) ──
assert(
  !getSupervisorOrderActionAvailability("request-bill", { permissions: WRITE, order: { status: "SENT" } }).requiresIdempotencyKey,
  "request-bill does not require an idempotency key (backend not BG3-wrapped)",
);
assert(
  !getSupervisorOrderActionAvailability("mark-served", { permissions: WRITE, order: { status: "READY" } }).requiresIdempotencyKey,
  "mark-served does not require an idempotency key (backend not BG3-wrapped)",
);
for (const action of ["merge", "split-bill", "split-items", "move-items", "transfer-table", "transfer-server"] as const) {
  const a = getSupervisorOrderActionAvailability(action, { permissions: allPerms, order: { status: "READY" } });
  assert(a.requiresIdempotencyKey, `${action} requires an idempotency key (BG3-wrapped)`);
}
assert(
  getSupervisorOrderActionAvailability("transfer-server", { permissions: allPerms, order: { status: "READY" } }).requiresIdempotencyKey,
  "transfer-server carries idempotency requirement even though deferred",
);

// ── Idempotency-intent lifecycle (stability + renewal) ──
const intent = createIdempotencyIntent(() => buildOperationalIdempotencyKey({ operation: "supervisor:test", orderId: "ord_1" }));
assert(intent.current() === null, "no key generated before submission intent begins");
const first = intent.begin();
assert(typeof first === "string" && first.length >= 20, "begin() generates a key");
assert(intent.begin() === first, "duplicate begin() reuses the same key (retry stability)");
assert(intent.current() === first, "current() returns the active key");
intent.reset();
assert(intent.current() === null, "reset() clears the intent");
const second = intent.begin();
assert(second !== first, "a new intent after reset yields a fresh key");

// ── Canonical order wiring + confirmation + duplicate prevention (structural) ──
const workspaceSrc = source("apps/web/src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx");
assert(
  workspaceSrc.includes('["supervisor", "order-detail", branchId, orderId]'),
  "mark-served updates the canonical order-detail cache entry",
);
assert(
  workspaceSrc.includes("requestBillMutation.isPending") && workspaceSrc.includes("markServedMutation.isPending"),
  "live action buttons are disabled while their mutation is pending (duplicate prevention)",
);
assert(
  workspaceSrc.includes("getSupervisorOrderActionAvailability"),
  "workspace derives action state from the central availability module",
);
assert(
  workspaceSrc.includes("Payment collection and order close remain in Cashier"),
  "payment state remains read-only with Cashier boundary copy",
);
assert(
  workspaceSrc.includes("showOrderActions") && workspaceSrc.includes("Boolean(order)"),
  "order actions are gated on a canonical order (supports tableless order context)",
);

const dialogSrc = source("apps/web/src/components/pos-shell/ActionConfirmDialog.tsx");
assert(dialogSrc.includes('role="dialog"'), "confirmation dialog has role=dialog");
assert(dialogSrc.includes('aria-modal="true"'), "confirmation dialog is aria-modal");
assert(dialogSrc.includes("aria-labelledby") && dialogSrc.includes("aria-describedby"), "confirmation dialog is labelled + described");
assert(dialogSrc.includes('"Escape"'), "confirmation dialog handles Escape");
assert(dialogSrc.includes("returnFocusRef"), "confirmation dialog restores focus on close");

// ── No Supervisor Orders navigation reintroduced ──
const supervisorRoutesSrc = source("apps/web/src/lib/supervisor/routes.ts");
assert(!/label:\s*"Orders"/.test(supervisorRoutesSrc), "Supervisor nav has no Orders tab");
assert(supervisorRoutesSrc.includes('"/supervisor/floor"'), "Supervisor nav keeps Floor");

// ── Files exist ──
for (const path of [
  "apps/web/src/components/pos-shell/idle.ts",
  "apps/web/src/components/pos-shell/ActionConfirmDialog.tsx",
  "apps/web/src/lib/pos-shell/idempotency.ts",
  "apps/web/src/lib/supervisor/order-actions.ts",
]) {
  assert(existsSync(join(process.cwd(), path)), `${path} exists`);
}

console.log(
  "Prompt3A assertions passed: idle parity, shared idle constants, action availability (permission/status/mutation/3B-hidden), idempotency metadata + intent lifecycle, canonical order wiring, confirmation accessibility, read-only payment boundary, and no Orders nav.",
);
