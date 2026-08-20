import { ManagerBranchSwitcher } from "@/components/manager/shell/ManagerBranchSwitcher";
import { OperationalHeader } from "@/components/pos-shell/OperationalHeader";
import { useManagerContext } from "@/lib/manager/context";
import { getProfileInitials } from "@/lib/profile/profile-model";

/**
 * Thin adapter over the shared `OperationalHeader` — same contract as
 * `CashierHeader` / `SupervisorHeader`, plus the Manager-only branch switcher passed
 * through the shared header's OPTIONAL `branchSwitcher` slot. The logomark, clock,
 * identity, and logout all stay shared.
 */
export function ManagerHeader() {
  const managerContext = useManagerContext();

  return (
    <OperationalHeader
      branchLabel={managerContext.branchName}
      branchSwitcher={<ManagerBranchSwitcher />}
      contextKind="workstation"
      contextLabel={managerContext.workspaceLabel}
      displayName={managerContext.displayName}
      initials={getProfileInitials(managerContext.displayName)}
      roleLabel={managerContext.roleLabel}
    />
  );
}
