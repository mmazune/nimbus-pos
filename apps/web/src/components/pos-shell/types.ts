import type { ReactNode } from "react";

import type { OperationalIconName } from "./role-icon-config";

export type OperationalRole = "waiter" | "cashier" | "supervisor";

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
};

export type OperationalShellProps = {
  bottomNavigation: ReactNode;
  children: ReactNode;
  header: ReactNode;
  idleHandler?: ReactNode;
  readiness: ReactNode;
};
