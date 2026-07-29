// Supervisor Reservations — Prompt 4B premium operational workspace.
// The legacy read-only triple-query components (Card/List/Summary/Toolbar/
// DetailPanel/StatusBadge) were removed when the page was rebuilt on the
// Prompt 4A active/history scope contracts.
export { SupervisorReservationViewSelector } from "./SupervisorReservationViewSelector";
export { SupervisorReservationRow } from "./SupervisorReservationRow";
export { SupervisorReservationsDateToolbar } from "./SupervisorReservationsDateToolbar";
export type { SupervisorReservationHistoryStatus } from "./SupervisorReservationsDateToolbar";
export { SupervisorReservationTableSelect } from "./SupervisorReservationTableSelect";
export {
  SupervisorReservationWorkspace,
  type SupervisorReservationActionKind,
} from "./SupervisorReservationWorkspace";
export { SupervisorCreateReservationDialog } from "./SupervisorCreateReservationDialog";
export {
  SupervisorConfirmReservationDialog,
  SupervisorSeatReservationDialog,
  SupervisorAssignTableDialog,
  SupervisorCancelReservationDialog,
  SupervisorNoShowReservationDialog,
  SupervisorCompleteReservationDialog,
} from "./SupervisorReservationLifecycleDialogs";
