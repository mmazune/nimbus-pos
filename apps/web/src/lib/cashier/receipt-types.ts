import type { CashierStatusTone } from "@/lib/cashier/order-types";

export type CashierReceiptApi = {
  receiptId?: string;
  id?: string;
  receiptNumber?: string | null;
  orderId?: string;
  orderNumber?: string | null;
  status?: string | null;
  serviceType?: string | null;
  organization?: {
    id?: string;
    name?: string | null;
    slug?: string | null;
  } | null;
  branch?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    currencyCode?: string | null;
    timezone?: string | null;
  } | null;
  table?: {
    id?: string;
    label?: string | null;
  } | null;
  server?: {
    id?: string;
    fullName?: string | null;
    email?: string | null;
  } | null;
  cashier?: {
    id?: string;
    fullName?: string | null;
    email?: string | null;
  } | null;
  totals?: {
    subtotal?: string | number | null;
    tax?: string | number | null;
    discount?: string | number | null;
    serviceCharge?: string | number | null;
    total?: string | number | null;
    paid?: string | number | null;
    outstanding?: string | number | null;
    currencyCode?: string | null;
  } | null;
  items?: CashierReceiptLineApi[] | null;
  payments?: CashierReceiptPaymentApi[] | null;
  footer?: string | null;
  timestamps?: {
    openedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
  createdAt?: string | null;
  history?: {
    viewedCount?: number | null;
    reprintCount?: number | null;
    sentCount?: number | null;
  } | null;
};

export type CashierReceiptLineApi = {
  id?: string;
  menuItemId?: string | null;
  name?: string | null;
  sku?: string | null;
  serving?: string | null;
  quantity?: number | null;
  unitPrice?: string | number | null;
  lineTotal?: string | number | null;
  notes?: string | null;
  modifierSummary?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CashierReceiptPaymentApi = {
  id?: string;
  method?: string | null;
  status?: string | null;
  amount?: string | number | null;
  transactionId?: string | null;
  postedAt?: string | null;
};

export type CashierReceiptHistoryApi = {
  data?: CashierReceiptHistoryEventApi[] | null;
  total?: number;
  page?: number;
  pageSize?: number;
  receiptId?: string;
};

export type CashierReceiptHistoryEventApi = {
  id?: string;
  action?: string | null;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
};

export type CashierReceiptSendChannel = "email" | "sms" | "whatsapp";

export type CashierReceiptReprintInput = {
  copies?: number;
  reason?: string;
};

export type CashierReceiptSendInput = {
  channel: CashierReceiptSendChannel;
  recipient: string;
  locale?: string;
  note?: string;
};

export type CashierReceiptReprintResponse = {
  ok?: boolean;
  action?: string;
  receiptId?: string;
  copies?: number;
  reason?: string | null;
  reprintedAt?: string;
  printable?: CashierReceiptApi;
};

export type CashierReceiptSendResponse = {
  ok?: boolean;
  action?: string;
  receiptId?: string;
  deliveryId?: string;
  channel?: CashierReceiptSendChannel;
  recipient?: string;
  status?: "PENDING" | string;
  supported?: boolean;
  reason?: string;
  requestedAt?: string;
};

export type CashierReceiptLineViewModel = {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  serving?: string;
  notes?: string;
  modifierSummary?: string;
};

export type CashierReceiptPaymentViewModel = {
  id: string;
  method: string;
  status: string;
  amount?: number;
  reference?: string;
  postedAt?: string;
};

export type CashierReceiptHistoryEventViewModel = {
  id: string;
  action: string;
  label: string;
  description: string;
  actor?: string;
  createdAt?: string;
  status?: string;
  tone: CashierStatusTone;
};

export type CashierReceiptStatus = "available" | "pending-payment" | "closed" | "unknown";

export type CashierReceiptViewModel = {
  id: string;
  orderId: string;
  receiptNumber: string;
  orderNumber: string;
  status: string;
  receiptStatus: CashierReceiptStatus;
  receiptStatusLabel: string;
  receiptStatusTone: CashierStatusTone;
  serviceType: string;
  tableName: string;
  serverName: string;
  cashierName: string;
  branchName: string;
  organizationName: string;
  openedAt?: string;
  updatedAt?: string;
  currencyCode: string;
  subtotal?: number;
  tax?: number;
  discount?: number;
  serviceCharge?: number;
  total?: number;
  paid?: number;
  outstanding?: number;
  lines: CashierReceiptLineViewModel[];
  payments: CashierReceiptPaymentViewModel[];
  footer?: string;
  reprintCount: number;
  sentCount: number;
  viewedCount: number;
  canReprint: boolean;
  canSend: boolean;
  unavailableReason?: string;
  searchText: string;
};

export type CashierReceiptFilterId = "today" | "closed" | "paid" | "pending-send" | "reprinted";
