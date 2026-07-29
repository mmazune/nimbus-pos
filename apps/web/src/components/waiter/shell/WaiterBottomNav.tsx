import { OperationalBottomNav } from "@/components/pos-shell/OperationalBottomNav";
import { getOperationalRoleNavigation } from "@/components/pos-shell/role-navigation";

export function WaiterBottomNav() {
  return (
    <OperationalBottomNav
      ariaLabel="Waiter navigation"
      items={getOperationalRoleNavigation("waiter")}
    />
  );
}
