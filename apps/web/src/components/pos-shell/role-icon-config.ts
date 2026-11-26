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
  // U0 kit (26 Nov 2026): the bar sections in R9 and the phone bars drawn for
  // manager, owner and accountant, plus the few glyphs kit pieces need. Added
  // HERE so this file stays the only place a glyph is chosen.
  alerts: "alerts",
  caretLeft: "caretLeft",
  caretRight: "caretRight",
  count: "count",
  done: "done",
  lock: "lock",
  minus: "minus",
  more: "more",
  plus: "plus",
  purchases: "purchases",
  ready: "ready",
  receive: "receive",
  reportsChart: "reportsChart",
  requests: "requests",
  soldOut: "soldOut",
  stock: "stock",
  store: "store",
  tickets: "tickets",
  today: "today",
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
  // U0 kit sizes (design/screens/README.md rule 4): 28 in the terminal bottom
  // bar, 24 elsewhere (and in the phone bar, as Nav-Roles draws it), 18 inside
  // buttons. Absolute px like the rest of the kit (R10).
  kitBar: 28,
  kitDefault: 24,
  kitInButton: 18,
} as const;

export const operationalIconWeights = {
  activeNavigation: "fill",
  brand: "duotone",
  default: "bold",
  inactiveNavigation: "bold",
  // U0 kit: regular when idle, fill when current.
  kitCurrent: "fill",
  kitIdle: "regular",
} as const;
