import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { operationalRoleNavigation } from "../src/components/pos-shell/role-navigation";
import { operationalIconNames } from "../src/components/pos-shell/role-icon-config";
import { getCashierLandingPath } from "../src/lib/auth/role";
import {
  CASHIER_COMPATIBILITY_ROUTES,
  CASHIER_FLOOR_ROUTE,
  buildCashierFloorQuery,
  firstCashierQueryValue,
} from "../src/lib/cashier/floor-route";
import type { OperationalNavItem } from "../src/components/pos-shell/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Cashier C1 assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function labels(items: readonly OperationalNavItem[]) {
  return items.map((item) => item.label).join(",");
}

const { cashier } = operationalRoleNavigation;

// ── Navigation: exactly Floor / Till / Me ──────────────────────────────────
assert(labels(cashier) === "Floor,Till,Me", "Cashier visible nav is exactly Floor, Till, Me");
assert(cashier.length === 3, "Cashier visible nav has three items");
assert(!cashier.some((i) => i.label === "Queue" || i.href === "/cashier/queue"), "Queue is absent from visible Cashier nav");
assert(!cashier.some((i) => i.label === "Receipts" || i.href === "/cashier/receipts"), "Receipts is absent from visible Cashier nav");
assert(!cashier.some((i) => i.label === "Orders"), "Orders is absent from visible Cashier nav");
assert(cashier[0].href === CASHIER_FLOOR_ROUTE, "Cashier default nav item is Floor at /cashier/floor");

// ── Icon registry (canonical, no direct Phosphor names) ────────────────────
assert(cashier[0].icon === operationalIconNames.floor, "Cashier Floor uses the canonical shared floor icon name");
assert(cashier[1].icon === operationalIconNames.cashierTill, "Cashier Till uses the canonical till icon name");
assert(cashier[2].icon === operationalIconNames.me, "Cashier Me uses the canonical me icon name");

// ── Default routing + landing ──────────────────────────────────────────────
assert(getCashierLandingPath() === "/cashier/floor", "Cashier login landing route is /cashier/floor");
const cashierIndex = source("apps/web/src/pages/cashier/index.tsx");
assert(cashierIndex.includes('destination: "/cashier/floor"'), "/cashier redirects to /cashier/floor");
assert(cashierIndex.includes("permanent: false"), "/cashier redirect is non-permanent");

// ── New Floor page + screen consume the shared OperationalFloor ────────────
const floorPage = source("apps/web/src/pages/cashier/floor.tsx");
assert(floorPage.includes("<CashierShell>") && floorPage.includes("<CashierFloorScreen"), "Cashier floor page composes CashierShell + CashierFloorScreen");
const cashierScreen = source("apps/web/src/components/cashier/floor/CashierFloorScreen.tsx");
assert(cashierScreen.includes("@/components/floor/OperationalFloor"), "Cashier screen imports the shared OperationalFloor");
assert(cashierScreen.includes("@/components/floor/OperationalTableWorkspaceFrame"), "Cashier screen imports the shared workspace frame");
assert(cashierScreen.includes("selectedTableId"), "Cashier screen preserves URL-backed table selection");

// ── No Cashier-specific Floor fork was created ─────────────────────────────
for (const forbidden of [
  "apps/web/src/components/cashier/floor/CashierTableCard.tsx",
  "apps/web/src/components/cashier/floor/CashierTableGrid.tsx",
  "apps/web/src/components/cashier/floor/CashierFloorToolbar.tsx",
  "apps/web/src/components/cashier/floor/CashierFloorStatus.tsx",
  "apps/web/src/components/cashier/floor/OperationalFloor.tsx",
]) {
  assert(!existsSync(join(process.cwd(), forbidden)), `no Cashier-specific Floor fork: ${forbidden}`);
}
assert(!cashierScreen.includes("CashierTableCard") && !cashierScreen.includes("CashierFloorToolbar"), "Cashier screen references no forked Floor primitives");

// ── Out-of-scope panel (transfer-table) is not imported by the new Floor ───
const selectedPanel = source("apps/web/src/components/cashier/floor/CashierSelectedTablePanel.tsx");
for (const [name, src] of [["screen", cashierScreen], ["panel", selectedPanel], ["page", floorPage]] as const) {
  assert(!src.includes("CashierTransferTablePanel"), `CashierTransferTablePanel is not imported by the new Floor ${name}`);
}

// ── C1 selected-table state exposes no payment/settlement action ───────────
for (const token of ["Pay ", "Collect payment", "Close order", "Split bill", "Refund", "Take payment", "Settle"]) {
  assert(!selectedPanel.includes(token), `C1 selected-table panel exposes no payment action ("${token}")`);
}
assert(selectedPanel.includes("Select a bill to continue."), "C1 selected-table panel shows the truthful boundary copy");
for (const milestone of ["Coming in C2", "under construction", "Feature pending", "TODO", "WIP"]) {
  assert(!selectedPanel.includes(milestone), `C1 selected-table panel uses no milestone/developer language ("${milestone}")`);
}

// ── Compatibility routes still exist (not deleted, not redirected in C1) ────
assert(existsSync(join(process.cwd(), "apps/web/src/pages/cashier/queue.tsx")), "Queue page still exists as a compatibility route");
assert(existsSync(join(process.cwd(), "apps/web/src/pages/cashier/receipts.tsx")), "Receipts page still exists as a compatibility route");
assert(CASHIER_COMPATIBILITY_ROUTES.queue === "/cashier/queue", "queue compatibility route constant is /cashier/queue");
assert(CASHIER_COMPATIBILITY_ROUTES.receipts === "/cashier/receipts", "receipts compatibility route constant is /cashier/receipts");
const queuePage = source("apps/web/src/pages/cashier/queue.tsx");
const receiptsPage = source("apps/web/src/pages/cashier/receipts.tsx");
assert(!queuePage.includes("redirect:") && queuePage.includes("CashierQueueScreen"), "Queue page is NOT redirected in C1 (still renders its screen)");
assert(!receiptsPage.includes("redirect:") && receiptsPage.includes("CashierReceiptsScreen"), "Receipts page is NOT redirected in C1 (still renders its screen)");

// ── Shared Floor remains consumed by Waiter and Supervisor ─────────────────
assert(source("apps/web/src/components/waiter/floor/WaiterFloorScreen.tsx").includes("@/components/floor/OperationalFloor"), "Waiter still consumes the shared OperationalFloor");
assert(source("apps/web/src/components/supervisor/floor/SupervisorFloorScreen.tsx").includes("@/components/floor/OperationalFloor"), "Supervisor still consumes the shared OperationalFloor");

// ── Table-selection URL helpers ────────────────────────────────────────────
assert(firstCashierQueryValue(["t-1", "t-2"]) === "t-1", "firstCashierQueryValue picks the first array value");
assert(firstCashierQueryValue(undefined) === null, "firstCashierQueryValue fails safe to null");
assert(firstCashierQueryValue("  ") === null, "firstCashierQueryValue trims to null on blank");
assert(JSON.stringify(buildCashierFloorQuery({ foo: "bar" }, "t-9")) === JSON.stringify({ foo: "bar", tableId: "t-9" }), "buildCashierFloorQuery sets tableId and preserves other params");
assert(JSON.stringify(buildCashierFloorQuery({ foo: "bar", tableId: "t-9" }, null)) === JSON.stringify({ foo: "bar" }), "buildCashierFloorQuery clears tableId when null");

// ── Privacy: Cashier Floor model carries no guest identity ─────────────────
const floorModel = source("apps/web/src/lib/cashier/floor-model.ts");
// Field-name tokens (camelCase) only — deliberately not bare words like "phone"/"email"
// which legitimately appear in the file's own privacy documentation prose.
for (const leak of ["guestName", "customerName", "payerPhone", "phoneNumber", "receiptId:", "receiptNumber"]) {
  assert(!floorModel.includes(leak), `Cashier Floor model does not carry guest/payment/receipt identity ("${leak}")`);
}

console.log("Cashier C1 assertions passed: nav Floor/Till/Me, /cashier→/cashier/floor, shared OperationalFloor consumption, no Floor fork, no premature payment action, compatibility routes intact, URL selection helpers, and Floor privacy.");
