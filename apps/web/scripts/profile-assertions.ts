import type { AuthMeResponse } from "../src/lib/auth/types";
import {
  getProfileInitials,
  getRoleAccent,
  resolveLinkedEmployeeId,
  roleAccentMap,
} from "../src/lib/profile/profile-model";
import {
  normalizeCapabilities,
  normalizeShift,
  normalizeShiftSwap,
  normalizeWaiterMeProfile,
} from "../src/lib/waiter/me-model";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Profile assertion failed: ${message}`);
}

const baseUser: AuthMeResponse = {
  id: "user-1",
  email: "amina@nimbus.test",
  firstName: "Amina",
  lastName: "Nabirye",
  displayName: "Amina Nabirye",
  roles: [{ id: "role-1", name: "Waiter", jobRole: "WAITER" }],
  permissions: ["pos:shift:open", "pos:shift:close", "pos:hr:attendance:clock", "pos:hr:leave:create"],
  memberships: [{
    id: "membership-1",
    organizationId: "org-1",
    organizationName: "Nimbus Hospitality",
    branchId: "branch-1",
    branchName: "Tapas Downtown",
    isDefaultBranch: true,
  }],
  context: {
    organizationCount: 1,
    branchCount: 1,
    requiresContextSelection: false,
    defaultOrganizationId: "org-1",
    defaultBranchId: "branch-1",
    defaultMembershipId: "membership-1",
  },
  employee: {
    id: "employee-1",
    employeeCode: "EMP-001",
    displayName: "Amina Nabirye",
    branchId: "branch-1",
    orgId: "org-1",
  },
  session: {
    id: "session-1",
    platform: "POS_DESKTOP",
    source: "PASSWORD",
  },
};

const linkedProfile = normalizeWaiterMeProfile(baseUser, "Tapas Downtown");
assert(linkedProfile.displayName === "Amina Nabirye", "verified display name is normalized");
assert(linkedProfile.employeeId === "employee-1", "auth/me employee identity is resolved");
assert(!linkedProfile.employeeUnavailableReason, "employee-link notice is hidden for linked profiles");
assert(linkedProfile.serviceArea === undefined, "unsupported service area is not fabricated");
assert(resolveLinkedEmployeeId(baseUser) === "employee-1", "shared employee resolver uses the verified employee object");
assert(getProfileInitials("Amina Nabirye") === "AN", "identity initials use first and last names");

const unlinkedUser = { ...baseUser, employee: null };
const unlinkedProfile = normalizeWaiterMeProfile(unlinkedUser, "Tapas Downtown");
assert(!unlinkedProfile.employeeId, "missing employee linkage stays missing");
assert(Boolean(unlinkedProfile.employeeUnavailableReason), "one employee capability notice can be rendered");

const offShift = normalizeShift(null, baseUser.permissions);
const unlinkedCapabilities = normalizeCapabilities({ profile: unlinkedProfile, shift: offShift });
assert(offShift.statusLabel === "Off shift" && offShift.canStart, "off-shift presentation exposes one valid start action");
assert(!unlinkedCapabilities.canClockAttendance, "attendance action stays unavailable without employee linkage");
assert(!unlinkedCapabilities.canCreateLeave, "leave action stays unavailable without employee linkage");
assert(Boolean(unlinkedCapabilities.attendanceReadOnlyReason), "compact attendance unavailable state has a reason");

const longShift = normalizeShift({
  id: "shift-1",
  status: "OPEN",
  shiftNumber: "SHIFT-001",
  branchId: "branch-1",
  openedAt: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
}, baseUser.permissions);
assert(longShift.statusLabel === "Shift issue", "a shift over 16 hours is presented as an issue");
assert(longShift.isLongRunning && Boolean(longShift.operationalWarning), "long shifts include an operational warning");
assert(longShift.canEnd, "a long-running shift is not silently altered and can still be ended explicitly");

const missingStartShift = normalizeShift({ id: "shift-2", status: "OPEN" }, baseUser.permissions);
assert(missingStartShift.statusLabel === "Shift issue", "an open shift without a start time is presented as an issue");

const incomingSwap = normalizeShiftSwap({
  id: "swap-1",
  requesterEmployeeId: "employee-2",
  targetEmployeeId: "employee-1",
  status: "PENDING",
}, "employee-1");
const outgoingSwap = normalizeShiftSwap({
  id: "swap-2",
  requesterEmployeeId: "employee-1",
  targetEmployeeId: "employee-2",
  status: "PENDING",
}, "employee-1");
assert(incomingSwap.directionLabel === "Incoming", "incoming swaps are distinguished");
assert(outgoingSwap.directionLabel === "Outgoing", "outgoing swaps are distinguished");

assert(Object.keys(roleAccentMap).length === 3, "all supported profile roles have variants");
assert(getRoleAccent("waiter").heroClassName !== getRoleAccent("cashier").heroClassName, "waiter and cashier accents are distinct");
assert(getRoleAccent("cashier").heroClassName !== getRoleAccent("supervisor").heroClassName, "cashier and supervisor accents are distinct");

console.log("Profile assertions passed: normalization, role variants, linkage, shift states, unavailable states, and swap direction.");

