export type CashierOrderStatus =
  | "NEW"
  | "SENT"
  | "IN_KITCHEN"
  | "READY"
  | "SERVED"
  | "CLOSED"
  | "VOIDED"
  | string;

export type CashierServiceType = "DINE_IN" | "TAKEAWAY" | string;

export type CashierOrderApi = {
  id: string;
  orgId?: string;
  branchId?: string;
  userId?: string | null;
  tableId?: string | null;
  orderNumber?: string | null;
  status?: CashierOrderStatus | null;
  serviceType?: CashierServiceType | null;
  notes?: string | null;
  subtotal?: string | number | null;
  tax?: string | number | null;
  discount?: string | number | null;
  total?: string | number | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  table?: {
    id?: string | null;
    label?: string | null;
  } | null;
  branch?: {
    id?: string | null;
    name?: string | null;
    currencyCode?: string | null;
  } | null;
  user?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
  items?: CashierOrderItemApi[] | null;
};

export type CashierOrderItemApi = {
  id: string;
  orderId?: string | null;
  menuItemId?: string | null;
  menuItemServingId?: string | null;
  quantity?: number | null;
  price?: string | number | null;
  subtotal?: string | number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  menuItem?: {
    id?: string | null;
    name?: string | null;
    station?: string | null;
  } | null;
  menuItemServing?: {
    id?: string | null;
    format?: string | null;
    label?: string | null;
  } | null;
};

export type CashierOrdersListQuery = {
  status?: CashierOrderStatus;
  excludeStatus?: string | string[];
  serviceType?: CashierServiceType;
  tableId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
};

export type CashierPaginatedOrdersResponse = {
  data: CashierOrderApi[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export type CashierPaymentApi = {
  id: string;
  orderId?: string | null;
  amount?: string | number | null;
  method?: string | null;
  status?: string | null;
  captureMode?: string | null;
  verificationStatus?: string | null;
  transactionId?: string | null;
  externalTransactionId?: string | null;
  payerPhone?: string | null;
  postedAt?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CashierPaymentIntentApi = {
  id: string;
  orderId?: string | null;
  provider?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  status?: string | null;
  providerRef?: string | null;
  customerPhone?: string | null;
  failureReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CashierOrderPaymentsApi = {
  payments?: CashierPaymentApi[] | null;
  intents?: CashierPaymentIntentApi[] | null;
  orderTotal?: string | number | null;
  totalPaid?: string | number | null;
  remainingBalance?: string | number | null;
  isSettled?: boolean | null;
};

export type CashierPaymentState = "unpaid" | "partially-paid" | "settled" | "unknown";

export type CashierStatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type CashierPaymentSummaryViewModel = {
  state: CashierPaymentState;
  label: string;
  tone: CashierStatusTone;
  paid?: number;
  outstanding?: number;
  total?: number;
  payments: CashierPaymentApi[];
  intents: CashierPaymentIntentApi[];
  unavailableReason?: string;
};

export type CashierOrderLineViewModel = {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  statusLabel?: string;
  servingLabel?: string;
  notes?: string;
  modifierSummary?: string;
};

export type CashierOrderViewModel = {
  id: string;
  tableId?: string | null;
  userId?: string | null;
  orderNumber: string;
  status: string;
  statusLabel: string;
  statusTone: CashierStatusTone;
  serviceType: string;
  serviceTypeLabel: string;
  tableName: string;
  serverName: string;
  guestName?: string;
  branchName?: string;
  createdAt?: string;
  updatedAt?: string;
  openedLabel: string;
  updatedLabel: string;
  elapsedLabel?: string;
  subtotal?: number;
  tax?: number;
  discount?: number;
  total?: number;
  currencyCode?: string;
  formattedTotal: string;
  payment: CashierPaymentSummaryViewModel;
  readinessLabel: string;
  readinessTone: CashierStatusTone;
  canPreview: boolean;
  nonPayableReason?: string;
  billRequestedLabel?: string;
  itemCount?: number;
  lines: CashierOrderLineViewModel[];
  metadata?: Record<string, unknown> | null;
  searchText: string;
};
