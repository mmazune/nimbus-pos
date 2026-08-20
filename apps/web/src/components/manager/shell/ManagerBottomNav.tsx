import { OperationalBottomNav } from "@/components/pos-shell/OperationalBottomNav";
import { getOperationalRoleNavigation } from "@/components/pos-shell/role-navigation";

export function ManagerBottomNav() {
  return (
    <OperationalBottomNav
      ariaLabel="Manager navigation"
      items={getOperationalRoleNavigation("manager")}
    />
  );
}
