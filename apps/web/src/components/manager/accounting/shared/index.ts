/**
 * Shared accounting primitives (Track B5.1).
 *
 * Every later B5 sub-phase composes its surfaces from these rather than
 * re-deriving money formatting, bucket geometry, scope labelling or the
 * read-only disclosure. The pattern is documented in `docs/UI_SYSTEM.md` §3e.
 */
export { AccountingAgingBars } from "./AccountingAgingBars";
export { AccountingPrimaryKpi, AccountingStatList } from "./AccountingKpi";
export type { AccountingStatRow } from "./AccountingKpi";
export {
  AccountingDeniedWritesPanel,
  AccountingPeriodStatusBadge,
  AccountingReadOnlyNote,
  AccountingRouteScopeNote,
  AccountingScopeNote,
  AccountingUnpaginatedNote,
} from "./AccountingNotes";
