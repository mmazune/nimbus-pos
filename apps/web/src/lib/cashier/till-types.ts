export type CashierTillStatus = "OPEN" | "RECONCILED" | "CLOSED" | string;
export type CashierCashMovementType =
  | "OPENING_FLOAT"
  | "SAFE_DROP"
  | "CASH_PICKUP"
  | "PAID_IN"
  | "PAID_OUT"
  | "REFUND_PAYOUT"
  | string;
export type CashierVarianceStatus = "MATCHED" | "SHORT" | "OVER" | string;

export type CashierTillUserApi = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
} | null;

export type CashierCashMovementApi = {
  id: string;
  type?: CashierCashMovementType | null;
  amount?: string | number | null;
  reason?: string | null;
  reference?: string | null;
  createdAt?: string | null;
  createdById?: string | null;
} | null;

export type CashierTillApi = {
  id: string;
  orgId?: string | null;
  branchId?: string | null;
  shiftId?: string | null;
  tillCode?: string | null;
  operatorUserId?: string | null;
  openedById?: string | null;
  closedById?: string | null;
  openedAt?: string | null;
  reconciledAt?: string | null;
  closedAt?: string | null;
  openingFloat?: string | number | null;
  expectedCash?: string | number | null;
  computedExpectedCash?: string | number | null;
  countedCash?: string | number | null;
  variance?: string | number | null;
  varianceStatus?: CashierVarianceStatus | null;
  status?: CashierTillStatus | null;
  notes?: string | null;
  cashMovements?: CashierCashMovementApi[] | null;
  operatorUser?: CashierTillUserApi;
  openedBy?: CashierTillUserApi;
  closedBy?: CashierTillUserApi;
  shift?: {
    id?: string | null;
    shiftNumber?: string | null;
    status?: string | null;
  } | null;
} | null;

export type CashierOpenTillInput = {
  tillCode: string;
  openingFloat: number;
  notes?: string;
};

export type CashierSafeDropInput = {
  amount: number;
  reason: string;
};

export type CashierReconcileTillInput = {
  countedCash: number;
  varianceReason?: string;
  notes?: string;
};

export type CashierTillSummaryMetric = {
  key: string;
  label: string;
  value?: number;
  formattedValue: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
};

export type CashierTillViewModel = {
  id: string;
  tillCode: string;
  status: string;
  statusLabel: string;
  openedAtLabel: string;
  closedAtLabel?: string;
  reconciledAtLabel?: string;
  operatorName: string;
  shiftNumber: string;
  openingFloat?: number;
  cashPayments?: number;
  safeDrops?: number;
  expectedCash?: number;
  countedCash?: number;
  variance?: number;
  varianceStatus?: string;
  currencyCode?: string;
  notes?: string;
  movements: CashierCashMovementViewModel[];
  metrics: CashierTillSummaryMetric[];
  isOpen: boolean;
};

export type CashierCashMovementViewModel = {
  id: string;
  type: string;
  label: string;
  amount?: number;
  formattedAmount: string;
  reason: string;
  createdAtLabel: string;
};

export type CashierTillValidationResult<T> = {
  canSubmit: boolean;
  reasons: string[];
  value?: T;
};
