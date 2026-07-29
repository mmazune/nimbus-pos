// Shared, cross-role idle-session constants for the operational shell.
// Consumed by the shared OperationalIdleLogoutHandler, which every operational
// role (Waiter, Cashier, Supervisor) injects through its shell. Named for
// cross-role ownership; do not reintroduce role-specific idle constants.

export const OPERATIONAL_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export const OPERATIONAL_ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;
