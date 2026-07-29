export type OperationalTableStatus = "available" | "occupied" | "reserved" | "blocked";

export type OperationalTableFilter = "all" | "available" | "occupied" | "reserved" | "mine";

export type OperationalFloorPlanOption = {
  id: string;
  name: string;
};

export type OperationalTableViewModel = {
  id: string;
  label: string;
  floorPlanId?: string | null;
  floorPlanName?: string | null;
  capacity: number | null;
  status: OperationalTableStatus;
  assignedStaffName?: string | null;
  assignedStaffId?: string | null;
  isMine?: boolean;
  activeOrderId?: string | null;
  activeOrderStatus?: string | null;
  reservationId?: string | null;
  reservationStatus?: string | null;
  reservationTime?: string | null;
  attentionState?: string | null;
  disabledReason?: string | null;
};

export type OperationalFloorErrorCopy = {
  title: string;
  description: string;
};
