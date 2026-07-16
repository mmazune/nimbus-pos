import { StatusBadge } from "@/components/ui";
import type { WaiterTableStatus } from "@/lib/waiter/floor-model";

type WaiterTableStatusBadgeProps = {
  status: WaiterTableStatus;
};

const statusCopy: Record<WaiterTableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
};

export function WaiterTableStatusBadge({ status }: WaiterTableStatusBadgeProps) {
  return <StatusBadge status={status}>{statusCopy[status]}</StatusBadge>;
}
