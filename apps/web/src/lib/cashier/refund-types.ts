import type { CashierPaymentApi, CashierStatusTone } from "@/lib/cashier/order-types";

export const CASHIER_REFUND_AUTO_APPROVAL_THRESHOLD = 5000;

export type CashierRefundStatus =
  | "PENDING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED"
  | string;

export type CashierRefundApi = {
  id: string;
  orgId?: string | null;
  branchId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  provider?: string | null;
  amount?: string | number | null;
  reason?: string | null;
  status?: CashierRefundStatus | null;
  createdById?: string | null;
  approvedById?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
  approvedBy?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
};

export type CreateCashierRefundInput = {
  paymentId: string;
  amount: number;
  reason: string;
  provider?: string;
  metadata?: Record<string, unknown>;
};

export type CashierRefundPaymentOption = {
  id: string;
  payment: CashierPaymentApi;
  method: string;
  provider?: string;
  reference?: string;
  status: string;
  amount?: number;
  alreadyRefunded: number;
  refundableAmount?: number;
  postedAt?: string;
  disabledReason?: string;
};

export type CashierRefundSummary = {
  totalPaid?: number;
  alreadyRefunded: number;
  remainingRefundable?: number;
  paymentOptions: CashierRefundPaymentOption[];
  trustBlockedReason?: string;
};

export type CashierRefundStatusViewModel = {
  status: string;
  label: string;
  tone: CashierStatusTone;
  approvalRequired: boolean;
};

export type CashierRefundViewModel = {
  id: string;
  paymentId: string;
  provider: string;
  amount?: number;
  reason: string;
  status: string;
  statusLabel: string;
  statusTone: CashierStatusTone;
  approvalRequired: boolean;
  requestedBy: string;
  approvedBy: string;
  createdAt?: string;
  updatedAt?: string;
  failureReason?: string;
};

export type CashierRefundValidationResult = {
  valid: boolean;
  amountError?: string;
  reasonError?: string;
  paymentError?: string;
};
