import { ManagerBranchSwitcher } from "@/components/manager/shell/ManagerBranchSwitcher";
import { OperationalTopNav } from "@/components/pos-shell/OperationalTopNav";
import { useManagerContext } from "@/lib/manager/context";
import { managerTopNavMenus } from "@/lib/manager/top-nav";
import { getProfileInitials } from "@/lib/profile/profile-model";

/**
 * Manager top-nav module bar (Track B1, D-MGRTOPNAV) — the top-nav
 * REPLACEMENT for `ManagerHeader`/`ManagerBottomNav`. It is a thin adapter
 * over the shared `OperationalTopNav`, exactly the same "adapter, not fork"
 * shape as every other Manager shell piece: presentation lives in
 * `components/pos-shell/`, this file only supplies Manager's data (branch
 * switcher, identity, the six-menu tree).
 */
export function ManagerTopNav() {
  const managerContext = useManagerContext();

  return (
    <OperationalTopNav
      ariaLabel="Manager navigation"
      brandHref="/manager/overview"
      workspaceLabel="Nimbus POS · Manager"
      menus={managerTopNavMenus}
      branchSwitcher={<ManagerBranchSwitcher />}
      displayName={managerContext.displayName}
      initials={getProfileInitials(managerContext.displayName)}
      roleLabel={managerContext.roleLabel}
      profileHref="/manager/me"
    />
  );
}
