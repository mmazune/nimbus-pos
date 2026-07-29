export const operationalIconNames = {
  approvals: "approvals",
  back: "back",
  branch: "branch",
  cashierQueue: "cashierQueue",
  cashierReceipts: "cashierReceipts",
  cashierTill: "cashierTill",
  close: "close",
  floor: "floor",
  logout: "logout",
  me: "me",
  refresh: "refresh",
  reservations: "reservations",
  search: "search",
  serviceArea: "serviceArea",
  success: "success",
  table: "table",
  time: "time",
  warning: "warning",
  workstation: "workstation",
} as const;

export type OperationalIconName = (typeof operationalIconNames)[keyof typeof operationalIconNames];

export const operationalIconSizes = {
  compactAction: 18,
  bottomNavigation: 24,
  pageState: 32,
} as const;

export const operationalIconWeights = {
  activeNavigation: "fill",
  brand: "duotone",
  default: "bold",
  inactiveNavigation: "bold",
} as const;
