import { existsSync, readFileSync } from "fs";
import { join } from "path";

import {
  formatOperationalStaffName,
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
const supervisorPage = source("apps/web/src/pages/supervisor/floor.tsx");
const operationalFloor = source("apps/web/src/components/floor/OperationalFloor.tsx");
const operationalToolbar = source("apps/web/src/components/floor/OperationalFloorToolbar.tsx");
const operationalGrid = source("apps/web/src/components/floor/OperationalTableGrid.tsx");
const operationalCard = source("apps/web/src/components/floor/OperationalTableCard.tsx");
const workspaceFrame = source("apps/web/src/components/floor/OperationalTableWorkspaceFrame.tsx");
const supervisorRoutes = source("apps/web/src/lib/supervisor/routes.ts");
const legacyRedirect = source("apps/web/src/components/supervisor/orders/SupervisorLegacyOrdersRedirect.tsx");

for (const [role, roleSource] of [["Waiter", waiterScreen], ["Supervisor", supervisorScreen]] as const) {
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
assert(operationalCard.includes("break-words"), "shared card preserves full table identifiers");
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

console.log("Floor assertions passed: shared dependency graph, card safety, full labels, status/name formatting, URL context, legacy redirect, four-tab navigation, and single responsive workspace.");
