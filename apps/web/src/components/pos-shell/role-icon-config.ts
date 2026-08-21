export const operationalIconNames = {
  // Track B5.1 (Manager Accounting module): the seventh module's nav glyph.
  // Added HERE rather than imported ad hoc, per docs/UI_SYSTEM.md §4 — this file
  // stays the only place a glyph is chosen.
  accounting: "accounting",
  approvals: "approvals",
  back: "back",
  branch: "branch",
  caretDown: "caretDown",
  cashierQueue: "cashierQueue",
  cashierReceipts: "cashierReceipts",
  cashierTill: "cashierTill",
  close: "close",
  floor: "floor",
  // Track B2 (Manager Overview dashboard): two card glyphs with no existing
  // equivalent in the registry. Added HERE rather than imported ad hoc, per
  // docs/UI_SYSTEM.md §4 — this file stays the only place a glyph is chosen.
  inventory: "inventory",
  logout: "logout",
  me: "me",
  operations: "operations",
  overview: "overview",
  refresh: "refresh",
  reports: "reports",
  reservations: "reservations",
  revenue: "revenue",
  search: "search",
  serviceArea: "serviceArea",
  settings: "settings",
  staff: "staff",
  success: "success",
  table: "table",
  time: "time",
  warning: "warning",
  workstation: "workstation",
} as const;

export type OperationalIconName = (typeof operationalIconNames)[keyof typeof operationalIconNames];

/**
 * Canonical icon sizes, in CSS px.
 *
 * Density pass (owner-approved 2026-08-20): reduced from 18 / 24 / 32 to
 * 16 / 20 / 28. Phosphor renders a raw `size` in px, so these do NOT follow the
 * viewport-scaled root font size in `globals.css` — this registry is the ONE
 * place icon geometry may be re-tuned, per docs/UI_SYSTEM.md §4.
 */
export const operationalIconSizes = {
  compactAction: 16,
  bottomNavigation: 20,
  pageState: 28,
} as const;

export const operationalIconWeights = {
  activeNavigation: "fill",
  brand: "duotone",
  default: "bold",
  inactiveNavigation: "bold",
} as const;
