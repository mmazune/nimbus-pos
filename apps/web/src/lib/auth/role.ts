import type { AuthMeResponse } from "./types";

const WAITER_COMPATIBLE_JOB_ROLES = new Set(["WAITER"]);
const CASHIER_COMPATIBLE_JOB_ROLES = new Set(["CASHIER"]);
const SUPERVISOR_COMPATIBLE_JOB_ROLES = new Set(["SUPERVISOR"]);
const MANAGER_COMPATIBLE_JOB_ROLES = new Set(["MANAGER"]);

export function getDisplayName(user: Pick<AuthMeResponse, "displayName" | "firstName" | "lastName" | "email"> | null) {
  if (!user) return "Operator";
  if (user.displayName) return user.displayName;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.email;
}

export function getPrimaryRoleLabel(user: AuthMeResponse | null) {
  const role = user?.roles[0];
  return role?.jobRole || role?.name || "Role unavailable";
}

export function isWaiterCompatible(user: AuthMeResponse | null) {
  if (!user) return false;

  return user.roles.some((role) => {
    const jobRole = role.jobRole?.toUpperCase();
    return !!jobRole && WAITER_COMPATIBLE_JOB_ROLES.has(jobRole);
  });
}

export function isCashierCompatible(user: AuthMeResponse | null) {
  if (!user) return false;

  return user.roles.some((role) => {
    const jobRole = role.jobRole?.toUpperCase();
    const roleName = role.name?.toUpperCase();
    return (
      (!!jobRole && CASHIER_COMPATIBLE_JOB_ROLES.has(jobRole)) ||
      roleName === "CASHIER"
    );
  });
}

export function isSupervisorCompatible(user: AuthMeResponse | null) {
  if (!user) return false;

  return user.roles.some((role) => {
    const jobRole = role.jobRole?.toUpperCase();
    const roleName = role.name?.toUpperCase();
    return (
      (!!jobRole && SUPERVISOR_COMPATIBLE_JOB_ROLES.has(jobRole)) ||
      roleName === "SUPERVISOR"
    );
  });
}

/**
 * Manager compatibility (M-P1).
 *
 * Mirrors `isCashierCompatible` / `isSupervisorCompatible` — it accepts either the
 * `jobRole` (`MANAGER`) or the role `name` (`Manager`). M-P0 verified the seeded
 * `manager@nimbus.demo` account carries BOTH (`jobRole: "MANAGER"`, `roles[0].name:
 * "Manager"`), so either form alone would work; accepting both keeps the four role
 * helpers consistent. There is deliberately no `BRANCH_MANAGER` enum
 * (MANAGER-GAP-002, resolved — do not reintroduce).
 */
export function isManagerCompatible(user: AuthMeResponse | null) {
  if (!user) return false;

  return user.roles.some((role) => {
    const jobRole = role.jobRole?.toUpperCase();
    const roleName = role.name?.toUpperCase();
    return (
      (!!jobRole && MANAGER_COMPATIBLE_JOB_ROLES.has(jobRole)) ||
      roleName === "MANAGER"
    );
  });
}

export function getCashierLandingPath() {
  return "/cashier/floor";
}

export function getSupervisorLandingPath() {
  return "/supervisor/floor";
}

export function getManagerLandingPath() {
  return "/manager/overview";
}

export function resolveDefaultMembership(user: AuthMeResponse | null) {
  if (!user?.memberships.length) return null;

  const defaultBranchId = user.context.defaultBranchId;
  return (
    user.memberships.find((membership) => membership.branchId === defaultBranchId) ||
    user.memberships.find((membership) => membership.isDefaultBranch) ||
    user.memberships[0]
  );
}
