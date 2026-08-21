import { operationalIconNames } from "../../components/pos-shell/role-icon-config";
import type { OperationalNavItem } from "../../components/pos-shell/types";

/**
 * Manager visible navigation (M-P1, extended by Track B5.1).
 *
 * LOCKED by the 2026-08-20 owner approval (`MANAGER_APPROVAL_DECISIONS.md` §2):
 * Overview · Operations · Staff · Reports · Settings · Me. There is **no More
 * tab** and **no Approvals tab**; approvals surface as counts on Overview and as
 * reviews inside Operations / Staff.
 *
 * ⚠️ **SEVEN, not six, since 2026-08-21.** The owner approved **OD-3** —
 * Accounting becomes a seventh top-level module, inserted before Settings. The
 * "exactly six tabs" lock was a statement about the M-P1 **bottom-nav
 * presentation**, which D-MGRTOPNAV superseded; it was never a cap on how many
 * modules Manager may reach, and the roadmap recorded that distinction when it
 * raised OD-3. Adding an eighth still requires an owner decision — the
 * allow-list in `permissions.ts` remains the gate, not this file.
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
    // Track B4 gives Reports real sub-routes (`/catalog`, `/runs`), so — like
    // Operations and Staff before it — its nav entry matches the whole module.
    match: (pathname: string) => pathname.startsWith("/manager/reports"),
  },
  {
    href: "/manager/accounting",
    label: "Accounting",
    icon: operationalIconNames.accounting,
    // Track B5.1: Accounting is a MODULE (root redirects to /accounting/dashboard),
    // so — like Operations, Staff and Reports before it — its nav entry matches
    // the whole module rather than one exact path.
    match: (pathname: string) => pathname.startsWith("/manager/accounting"),
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
