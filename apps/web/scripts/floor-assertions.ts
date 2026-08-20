import { existsSync, readFileSync } from "fs";
import { join } from "path";

import {
  buildOperationalTableLabelMap,
  formatOperationalStaffName,
  formatOperationalTableLabel,
  operationalTableStatusLabels,
} from "../src/components/floor/formatters";
import {
  buildSupervisorFloorContextQuery,
  firstLegacyQueryValue,
} from "../src/lib/supervisor/legacy-orders-route";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Floor assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const waiterScreen = source("apps/web/src/components/waiter/floor/WaiterFloorScreen.tsx");
const supervisorScreen = source("apps/web/src/components/supervisor/floor/SupervisorFloorScreen.tsx");
const cashierScreen = source("apps/web/src/components/cashier/floor/CashierFloorScreen.tsx");
const supervisorPage = source("apps/web/src/pages/supervisor/floor.tsx");
const operationalFloor = source("apps/web/src/components/floor/OperationalFloor.tsx");
const operationalToolbar = source("apps/web/src/components/floor/OperationalFloorToolbar.tsx");
const operationalGrid = source("apps/web/src/components/floor/OperationalTableGrid.tsx");
const operationalCard = source("apps/web/src/components/floor/OperationalTableCard.tsx");
const workspaceFrame = source("apps/web/src/components/floor/OperationalTableWorkspaceFrame.tsx");
const supervisorRoutes = source("apps/web/src/lib/supervisor/routes.ts");
const legacyRedirect = source("apps/web/src/components/supervisor/orders/SupervisorLegacyOrdersRedirect.tsx");

for (const [role, roleSource] of [["Waiter", waiterScreen], ["Supervisor", supervisorScreen], ["Cashier", cashierScreen]] as const) {
  assert(roleSource.includes("@/components/floor/OperationalFloor"), `${role} imports the shared OperationalFloor`);
  assert(roleSource.includes("@/components/floor/OperationalTableWorkspaceFrame"), `${role} imports the shared workspace frame`);
  assert(roleSource.includes("selectedTableId"), `${role} preserves URL-backed table selection`);
}

assert(operationalFloor.includes('from "./OperationalFloorToolbar"'), "shared Floor imports the shared toolbar");
assert(operationalFloor.includes('from "./OperationalTableGrid"'), "shared Floor imports the shared grid");
assert(operationalGrid.includes('from "./OperationalTableCard"'), "shared grid imports the shared table card");
assert(supervisorPage.includes("<SupervisorFloorScreen"), "Supervisor page renders the shared-floor role adapter");

assert(!supervisorScreen.includes("SupervisorFloorSummary"), "Supervisor does not render old summary cards");
assert(!supervisorScreen.includes("Floor Control"), "Supervisor does not render the old Floor Control heading");
assert(!supervisorScreen.includes("SupervisorFloorToolbar"), "Supervisor does not render the old toolbar");
assert(!existsSync(join(process.cwd(), "apps/web/src/components/supervisor/floor/SupervisorFloorSummary.tsx")), "old Supervisor summary file is removed");
assert(!existsSync(join(process.cwd(), "apps/web/src/components/supervisor/floor/SupervisorTableCard.tsx")), "old Supervisor card file is removed");

assert(!operationalCard.includes("guestName"), "shared Floor card does not consume a guest name");
assert(!operationalCard.includes("orderNumber"), "shared Floor card does not consume an order number");
// Owner-approved 2026-08-20: card titles are now ONE LINE (`truncate` replaced
// `break-words`) and show a deterministic abbreviation. "Preserves full table
// identifiers" is now satisfied by title + aria-label, asserted at the end of
// this file — the visible string is allowed to be shorter.
assert(operationalCard.includes("truncate"), "shared card title is a single truncated line");
assert(!operationalCard.includes("break-words"), "the old multi-line card title wrap is gone");
assert(operationalCard.includes("aria-pressed={selected}"), "shared card announces selected state");
assert(operationalCard.includes("data-operational-table-id"), "shared card supports focus return");
assert(operationalToolbar.includes('value: "available"'), "shared toolbar exposes Available filter");
assert(operationalToolbar.includes('value: "occupied"'), "shared toolbar exposes Occupied filter");
assert(operationalToolbar.includes('value: "reserved"'), "shared toolbar exposes Reserved filter");
assert(operationalToolbar.includes('value: "mine"'), "shared toolbar exposes Mine filter");

assert(formatOperationalStaffName("  Peter   Mugisha ") === "Peter M.", "Peter Mugisha formats as Peter M.");
assert(formatOperationalStaffName("Sarah Namutebi") === "Sarah N.", "Sarah Namutebi formats as Sarah N.");
assert(formatOperationalStaffName("Brian Kisekka") === "Brian K.", "Brian Kisekka formats as Brian K.");
assert(formatOperationalStaffName("Irene") === "Irene", "single name remains truthful");
assert(formatOperationalStaffName(undefined) === "", "unavailable name does not fabricate identity");

assert(operationalTableStatusLabels.available === "Available", "Available status label is stable");
assert(operationalTableStatusLabels.occupied === "Occupied", "Occupied status label is stable");
assert(operationalTableStatusLabels.reserved === "Reserved", "Reserved status label is stable");
assert(operationalTableStatusLabels.blocked === "Blocked", "Blocked status label is stable");

assert(firstLegacyQueryValue(["table-1", "table-2"]) === "table-1", "URL array parsing remains stable");
assert(
  JSON.stringify(buildSupervisorFloorContextQuery({ tableId: "table-1", orderId: "order-1" }))
    === JSON.stringify({ tableId: "table-1", orderId: "order-1" }),
  "tableId and orderId are preserved together",
);
assert(
  JSON.stringify(buildSupervisorFloorContextQuery({ orderId: "tableless-order" }, null))
    === JSON.stringify({ orderId: "tableless-order" }),
  "tableless orderId is preserved",
);
assert(legacyRedirect.includes('pathname: "/supervisor/floor"'), "legacy Orders redirect targets Floor");
assert(!legacyRedirect.includes('pathname: "/supervisor/orders"'), "legacy Orders redirect has no loop");

const supervisorLabels = [...supervisorRoutes.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
assert(supervisorLabels.join(",") === "Floor,Reservations,Approvals,Me", "Supervisor visible navigation remains four approved entries");
assert(!supervisorLabels.includes("Orders"), "Orders remains absent from navigation");

assert(!workspaceFrame.includes("hidden"), "one responsive workspace is mounted instead of hidden duplicates");
assert(workspaceFrame.includes("data-operational-workspace"), "shared workspace has a structural assertion hook");

// ── Table display-label abbreviation (owner-approved 2026-08-20) ──────────────
// Display-side only: the persisted label is never mutated and the full label
// stays in title/aria-label (asserted structurally further below).
assert(formatOperationalTableLabel("TD-01") === "TD-01", "short labels (<=7 chars) are untouched");
assert(formatOperationalTableLabel("BAR-3") === "BAR-3", "short alpha labels are untouched");
assert(formatOperationalTableLabel("QA-OPEN-01") === "QO-01", "QA-OPEN-01 abbreviates to QO-01");
assert(formatOperationalTableLabel("QA-P4-CLEAN-02") === "QP4C-02", "QA-P4-CLEAN-02 abbreviates to QP4C-02");
assert(
  formatOperationalTableLabel("QA-P4-PASS2-1440") === "QP4P2-1440",
  "QA-P4-PASS2-1440 abbreviates to QP4P2-1440",
);
assert(formatOperationalTableLabel("QA-PRE-BILL-01") === "QPB-01", "QA-PRE-BILL-01 abbreviates to QPB-01");
assert(formatOperationalTableLabel("") === "", "empty labels do not fabricate text");
assert(
  formatOperationalTableLabel("QA-OPEN-01") === formatOperationalTableLabel("QA-OPEN-01"),
  "abbreviation is deterministic",
);

const collisionMap = buildOperationalTableLabelMap([
  "QA-OPEN-01",
  "QA-OTHER-01",
  "QA-P4-PASS2-1440",
  "TD-01",
]);
const collisionValues = [...collisionMap.values()];
assert(
  new Set(collisionValues).size === collisionValues.length,
  "abbreviations are collision-free within one fetched set",
);
assert(collisionMap.get("TD-01") === "TD-01", "short labels survive the collision pass unchanged");
assert(
  collisionMap.get("QA-P4-PASS2-1440") === "QP4P2-1440",
  "non-colliding labels keep their depth-1 abbreviation",
);

const tableCardSource = source("apps/web/src/components/floor/OperationalTableCard.tsx");
assert(tableCardSource.includes("title={table.label}"), "the FULL label stays in the card title attribute");
assert(
  tableCardSource.includes("aria-label={`${table.label}, ${statusLabel}, ${capacityLabel}`}"),
  "the FULL label stays in the card aria-label",
);
assert(tableCardSource.includes("min-h-[9.5rem]"), "card min-height is the rem-based density value");
assert(!tableCardSource.includes("min-h-[176px]"), "the old absolute 176px card height is gone");

console.log("Floor assertions passed: shared dependency graph, card safety, full labels, status/name formatting, URL context, legacy redirect, four-tab navigation, single responsive workspace, and deterministic collision-safe table label abbreviation.");
