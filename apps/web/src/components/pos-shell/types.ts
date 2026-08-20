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
  bottomNavigation: ReactNode;
  children: ReactNode;
  header: ReactNode;
  idleHandler?: ReactNode;
  readiness: ReactNode;
};
