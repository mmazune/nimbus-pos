import { OperationalBottomNav } from "@/components/pos-shell/OperationalBottomNav";
import { getOperationalRoleNavigation } from "@/components/pos-shell/role-navigation";

export function SupervisorBottomNav() {
  return (
    <OperationalBottomNav
      ariaLabel="Supervisor navigation"
      items={getOperationalRoleNavigation("supervisor")}
    />
  );
}
