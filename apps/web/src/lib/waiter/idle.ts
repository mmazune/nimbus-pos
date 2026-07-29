// Idle-session constants moved to the shared operational shell to reflect
// cross-role ownership (Waiter, Cashier, Supervisor). Import the operational
// names from "@/components/pos-shell/idle" going forward.
// These re-exports remain as backward-compatible aliases only.
import {
  OPERATIONAL_ACTIVITY_EVENTS,
  OPERATIONAL_IDLE_TIMEOUT_MS,
} from "@/components/pos-shell/idle";

/** @deprecated Use OPERATIONAL_IDLE_TIMEOUT_MS from "@/components/pos-shell/idle". */
export const WAITER_IDLE_TIMEOUT_MS = OPERATIONAL_IDLE_TIMEOUT_MS;

/** @deprecated Use OPERATIONAL_ACTIVITY_EVENTS from "@/components/pos-shell/idle". */
export const WAITER_ACTIVITY_EVENTS = OPERATIONAL_ACTIVITY_EVENTS;
