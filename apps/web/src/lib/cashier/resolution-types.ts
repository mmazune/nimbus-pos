import type { CashierOrderApi } from "@/lib/cashier/order-types";

export type CashierSplitBillMode = "EQUAL" | "CUSTOM";

export type CashierSplitBillGroupInput = {
  label?: string;
  amount?: string;
};

export type SplitCashierBillInput = {
  mode: CashierSplitBillMode;
  count?: number;
  groups?: CashierSplitBillGroupInput[];
  reason?: string;
};

export type CashierSplitBillGroup = {
  groupId?: string;
  label?: string;
  amount?: string | number;
};

export type CashierSplitBillMetadata = {
  mode?: CashierSplitBillMode;
  groups?: CashierSplitBillGroup[];
  total?: string | number;
  allocated?: string | number;
  createdAt?: string;
  createdBy?: string;
  reason?: string;
};

export type CashierSplitBillResponse = {
  ok?: boolean;
  action?: string;
  orderId?: string;
  splitMode?: CashierSplitBillMode;
  splitGroups?: CashierSplitBillGroup[];
  totals?: {
    orderTotal?: string | number;
    allocated?: string | number;
    remaining?: string | number;
  };
  amountAllocated?: string | number;
  amountRemaining?: string | number;
  outstandingBalance?: string | number;
  note?: string;
};

export type CashierSplitItemSelection = {
  orderItemId: string;
  quantity: number;
};

export type SplitCashierItemsInput = {
  items: CashierSplitItemSelection[];
  targetTableId?: string;
  reason?: string;
  notes?: string;
};

export type MergeCashierOrdersInput = {
  sourceOrderId: string;
  targetOrderId: string;
  reason?: string;
};

export type MoveCashierOrderItemsInput = {
  targetOrderId: string;
  items: CashierSplitItemSelection[];
  reason?: string;
};

export type TransferCashierOrderTableInput = {
  targetTableId: string;
  reason?: string;
};

export type TransferCashierOrderServerInput = {
  targetUserId: string;
  reason?: string;
};

export type CashierResolutionMutationResponse = {
  ok?: boolean;
  action?: string;
  orderId?: string;
  sourceOrder?: CashierOrderApi | null;
  targetOrder?: CashierOrderApi | null;
  childOrder?: CashierOrderApi | null;
  movedItems?: CashierSplitItemSelection[];
  moved?: {
    itemRowsMoved?: number;
    totalQuantityMoved?: number;
  };
  table?: {
    id?: string | null;
    label?: string | null;
  } | null;
  server?: {
    id?: string | null;
    name?: string | null;
  } | null;
  kds?: {
    strategy?: string;
    note?: string;
  };
  note?: string;
};

export type CashierTableApi = {
  id: string;
  label?: string | null;
  status?: string | null;
  isActive?: boolean | null;
  capacity?: number | null;
  floorPlan?: {
    id?: string | null;
    name?: string | null;
  } | null;
};
