export const operationalIconNames = {
  approvals: "approvals",
  back: "back",
  branch: "branch",
  caretDown: "caretDown",
  cashierQueue: "cashierQueue",
  cashierReceipts: "cashierReceipts",
  cashierTill: "cashierTill",
  close: "close",
  floor: "floor",
  logout: "logout",
  me: "me",
  operations: "operations",
  overview: "overview",
  refresh: "refresh",
  reports: "reports",
  reservations: "reservations",
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
