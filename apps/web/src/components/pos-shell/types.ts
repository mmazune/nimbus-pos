import type { ReactNode } from "react";

import type { OperationalIconName } from "./role-icon-config";

export type OperationalRole = "waiter" | "cashier" | "supervisor" | "manager";

export type OperationalNavItem = {
  href: string;
  label: string;
  icon: OperationalIconName;
  match?: (pathname: string) => boolean;
};

export type OperationalHeaderContext = {
  branchLabel: string;
  contextKind: "service-area" | "workstation";
  contextLabel: string;
  displayName: string;
  initials: string;
  roleLabel: string;
  /**
   * OPTIONAL header affordance slot (Manager M-P1). Rendered immediately before the
   * shared clock when — and only when — a role supplies it. Waiter, Cashier, and
   * Supervisor pass nothing and keep the identical three-cell header markup they had
   * before this prop existed; Manager passes its branch switcher.
   */
  branchSwitcher?: ReactNode;
};

export type OperationalShellProps = {
  /**
   * OPTIONAL when `navigation="top"` (the fixed bottom bar is not rendered in that
   * mode). Waiter, Cashier, and Supervisor always pass a real node here and never
   * pass `navigation`, so their markup is byte-identical to before this field
   * existed.
   */
  bottomNavigation?: ReactNode;
  children: ReactNode;
  header: ReactNode;
  idleHandler?: ReactNode;
  readiness: ReactNode;
  /**
   * Additive shell variant (Track B1, D-MGRTOPNAV / OD-5). Defaults to "bottom" —
   * the shell Waiter/Cashier/Supervisor have always rendered. "top" is Manager-only:
   * it omits the fixed bottom bar and the bottom content clearance, and expects the
   * `header` slot to render a top-module-bar component instead of the shared
   * `OperationalHeader`.
   */
  navigation?: "top" | "bottom";
};
