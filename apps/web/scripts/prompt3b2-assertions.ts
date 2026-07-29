/**
 * Supervisor Reconstruction Prompt 3B2 — static/behavioral assertions.
 *
 * Run from the repo root:
 *   npx tsx apps/web/scripts/prompt3b2-assertions.ts
 *
 * Guards transfer-table (availability gating, target derivation, submission
 * validity, error mapping, idempotency) and the bounded Find-order lookup +
 * structural wiring (no Orders nav, transfer-server stays deferred, seed grant).
 */
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildOperationalIdempotencyKey,
  createIdempotencyIntent,
} from "../src/lib/pos-shell/idempotency";
import {
  SUPERVISOR_LIVE_ORDER_ACTIONS,
  getSupervisorOrderActionAvailability,
} from "../src/lib/supervisor/order-actions";
import {
  buildTransferTableTargets,
  transferTableErrorCopy,
  transferTargetWarning,
  validateTransferTableSelection,
} from "../src/lib/supervisor/transfer-table";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error("Prompt3B2 assertion failed: " + message);
}
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const TRANSFER = ["pos:order:transfer"];

// ── transfer-table is now LIVE; transfer-server stays foundation ──
assert(SUPERVISOR_LIVE_ORDER_ACTIONS.includes("transfer-table"), "transfer-table is live");
assert(!SUPERVISOR_LIVE_ORDER_ACTIONS.includes("transfer-server"), "transfer-server is NOT live");

// ── Permission gating ──
assert(
  !getSupervisorOrderActionAvailability("transfer-table", { permissions: [], order: { status: "SENT" } }).visible,
  "transfer-table hidden without permission",
);
const enabledOnOpen = getSupervisorOrderActionAvailability("transfer-table", { permissions: TRANSFER, order: { status: "SERVED" } });
assert(enabledOnOpen.visible && enabledOnOpen.enabled, "transfer-table enabled with perm on open order");
assert(enabledOnOpen.requiresConfirmation, "transfer-table requires confirmation");
assert(enabledOnOpen.requiresIdempotencyKey, "transfer-table requires idempotency key");

// ── Works for a tableless open order (no lineCount/total requirement) ──
assert(
  getSupervisorOrderActionAvailability("transfer-table", { permissions: TRANSFER, order: { status: "NEW" } }).enabled,
  "transfer-table enabled on a tableless/new open order",
);

// ── Status gating (CLOSED/VOIDED disabled with a reason, still visible) ──
for (const status of ["CLOSED", "VOIDED"] as const) {
  const av = getSupervisorOrderActionAvailability("transfer-table", { permissions: TRANSFER, order: { status } });
  assert(av.visible && !av.enabled && av.reason, `transfer-table disabled with reason on ${status}`);
}

// ── transfer-server stays hidden AND hard-blocked even with the permission ──
const serverAv = getSupervisorOrderActionAvailability("transfer-server", { permissions: TRANSFER, order: { status: "READY" } });
assert(!serverAv.visible, "transfer-server hidden (not in live set)");

// ── Target derivation: exclude current table, warn on occupied/reserved ──
const candidates = [
  { id: "t1", label: "Table 1", status: "available" as const, capacity: 4 },
  { id: "t2", label: "Table 2", status: "occupied" as const, capacity: 2, activeOrderId: "o9" },
  { id: "t3", label: "Table 3", status: "reserved" as const, capacity: 6, reservationTime: "7:30 PM" },
];
const targets = buildTransferTableTargets(candidates, "t1");
assert(targets.length === 2 && targets.every((t) => t.id !== "t1"), "source table excluded from targets");
assert(targets.find((t) => t.id === "t2")!.warning !== null, "occupied target carries a warning");
assert(/7:30 PM/.test(targets.find((t) => t.id === "t3")!.warning || ""), "reserved target warning names the time");
assert(transferTargetWarning({ id: "x", label: "X", status: "available" }) === null, "available target has no warning");

// ── Submission validity ──
assert(!validateTransferTableSelection("t1", null).valid, "no target rejected");
assert(!validateTransferTableSelection("t1", "t1").valid, "same table rejected");
assert(validateTransferTableSelection("t1", "t2").valid, "distinct target accepted");
assert(validateTransferTableSelection(null, "t2").valid, "tableless source with a target accepted");

// ── Error copy mapping (operational, no raw endpoint noise) ──
assert(/already at that table/i.test(transferTableErrorCopy(new Error("Order is already at the target table"))), "same-table error mapped");
assert(/no longer available/i.test(transferTableErrorCopy(new Error("Target table not found in this branch"))), "not-found error mapped");
assert(/status changed/i.test(transferTableErrorCopy(new Error("Order is in CLOSED state; handoff requires one of ..."))), "not-open error mapped");

// ── Idempotency intent lifecycle ──
const intent = createIdempotencyIntent(() => buildOperationalIdempotencyKey({ operation: "supervisor:transfer-table", orderId: "o1" }));
const k1 = intent.begin();
assert(intent.begin() === k1, "same key on retry");
intent.reset();
assert(intent.begin() !== k1, "new key after material change");

// ── Structural wiring ──
const workspace = source("apps/web/src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx");
assert(workspace.includes("SupervisorTransferTableDialog"), "workspace mounts the transfer dialog");
assert(workspace.includes('getSupervisorOrderActionAvailability("transfer-table"'), "workspace derives transfer-table availability centrally");
assert(workspace.includes("Payment collection and order close remain in Cashier"), "payment read-only boundary retained");
assert(!/\bTransfer,\s*void,\s*discount/.test(workspace), "deferred notice no longer lists Transfer as unavailable");

const transferDialog = source("apps/web/src/components/supervisor/floor/SupervisorTransferTableDialog.tsx");
assert(transferDialog.includes("setQueryData"), "transfer dialog does canonical cache updates");
assert(transferDialog.includes('["supervisor", "floor", branchId]') && transferDialog.includes('["waiter", "floor", branchId]'), "transfer updates supervisor + waiter floor");
assert(!transferDialog.includes('queryKey: ["supervisor", "me"') && !transferDialog.includes("menu"), "transfer does not touch profile/menu caches");

const targetSelector = source("apps/web/src/components/supervisor/floor/SupervisorTableTargetSelector.tsx");
assert(targetSelector.includes('["supervisor", "floor", branchId]'), "target selector reuses the bounded floor query");
assert(targetSelector.includes("buildTransferTableTargets"), "target selector excludes source via the pure helper");

const floorScreen = source("apps/web/src/components/supervisor/floor/SupervisorFloorScreen.tsx");
assert(floorScreen.includes("SupervisorFindOrderDialog"), "floor screen mounts Find order dialog");
assert(floorScreen.includes("Find order"), "floor screen exposes a Find order control");
assert(floorScreen.includes("OperationalFloor"), "floor screen still renders the shared OperationalFloor");

const operationalFloor = source("apps/web/src/components/floor/OperationalFloor.tsx");
assert(!operationalFloor.includes("Find order") && !operationalFloor.includes("Supervisor"), "shared OperationalFloor is NOT forked for Supervisor");

const findDialog = source("apps/web/src/components/supervisor/floor/SupervisorFindOrderDialog.tsx");
assert(findDialog.includes("FIND_PAGE_SIZE") && findDialog.includes("pageSize"), "Find order is bounded/paginated");
assert(findDialog.includes('["CLOSED", "VOIDED"]'), "Find order active filter excludes terminal orders");
assert(findDialog.includes("looksLikeOrderId"), "Find order supports exact-id reference lookup");
assert(findDialog.includes("Takeaway"), "Find order renders a truthful Tableless/Takeaway label");

const routes = source("apps/web/src/lib/supervisor/routes.ts");
assert(!/label:\s*"Orders"/.test(routes), "no Supervisor Orders nav");

const seed = source("packages/db/prisma/seed.ts");
const supervisorBlock = seed.slice(seed.indexOf("Supervisor: ["), seed.indexOf("Supervisor: [") + 4000);
assert(supervisorBlock.includes("'pos:order:transfer'"), "seed grants pos:order:transfer to Supervisor");

console.log(
  "Prompt3B2 assertions passed: transfer-table live + permission/status gating + idempotency, transfer-server deferred, target derivation/validity/error mapping, bounded Find order + exact-id lookup, canonical cache updates, unforked shared Floor, no Orders nav, seed grant.",
);
