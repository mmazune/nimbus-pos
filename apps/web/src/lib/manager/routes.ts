import { operationalIconNames } from "../../components/pos-shell/role-icon-config";
import type { OperationalNavItem } from "../../components/pos-shell/types";

/**
 * Manager visible navigation (M-P1).
 *
 * LOCKED by the 2026-08-20 owner approval (`MANAGER_APPROVAL_DECISIONS.md` §2):
 * exactly six items, in this order — Overview · Operations · Staff · Reports ·
 * Settings · Me. There is **no More tab** and **no Approvals tab**; approvals
 * surface as counts on Overview and as reviews inside Operations / Staff.
 *
 * Icons are referenced by NAME from the canonical registry
 * (`components/pos-shell/role-icon-config.ts`); never import Phosphor here.
 */
export const managerRoutes = [
  {
    href: "/manager/overview",
    label: "Overview",
    icon: operationalIconNames.overview,
    match: (pathname: string) => pathname === "/manager/overview",
  },
  {
    href: "/manager/operations",
    label: "Operations",
    icon: operationalIconNames.operations,
    // Track B3 gives Operations and Staff real sub-routes (`/orders`, `/tables`,
    // `/reservations`; `/directory`, `/onboarding`, `/quick-pin`, `/leave`,
    // `/shift-swaps`), so their nav entry matches the whole module, not one exact
    // path — otherwise the module bar de-highlights the moment you open a surface
    // inside it. The four single-page surfaces keep their exact match.
    match: (pathname: string) => pathname.startsWith("/manager/operations"),
  },
  {
    href: "/manager/staff",
    label: "Staff",
    icon: operationalIconNames.staff,
    match: (pathname: string) => pathname.startsWith("/manager/staff"),
  },
  {
    href: "/manager/reports",
    label: "Reports",
    icon: operationalIconNames.reports,
    match: (pathname: string) => pathname === "/manager/reports",
  },
  {
    href: "/manager/settings",
    label: "Settings",
    icon: operationalIconNames.settings,
    match: (pathname: string) => pathname === "/manager/settings",
  },
  {
    href: "/manager/me",
    label: "Me",
    icon: operationalIconNames.me,
    match: (pathname: string) => pathname === "/manager/me",
  },
] as const satisfies readonly OperationalNavItem[];

export const MANAGER_LANDING_ROUTE = "/manager/overview";
