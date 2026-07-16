import type { CashierOrderApi, CashierPaymentApi } from "@/lib/cashier/order-types";

export type CashierPaymentMethodId =
  | "CASH"
  | "CARD_REFERENCE"
  | "MTN_REFERENCE"
  | "AIRTEL_REFERENCE"
  | "BANK_TRANSFER";

export type CashierManualReferenceMethod = "CARD" | "MOMO" | "BANK_TRANSFER";

export type CashierPaymentMethodConfig = {
  id: CashierPaymentMethodId;
  label: string;
  shortLabel: string;
  backendMethod: "CASH" | CashierManualReferenceMethod;
  provider?: "MTN" | "AIRTEL";
  requiresReference: boolean;
  supportsPartial: boolean;
  caveat: string;
};

export type CreateCashierManualReferencePaymentInput = {
  orderId: string;
  method: CashierManualReferenceMethod;
  provider?: string;
  amount: number;
  externalTransactionId: string;
  payerPhone?: string;
  note?: string;
};

export type CreateCashierPaymentIntentInput = {
  orderId: string;
  provider: "MTN" | "AIRTEL";
  amount: number;
  currency?: string;
  phoneNumber: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type CloseCashierOrderInput = {
  payments: Array<{
    method: "CASH" | "CARD" | "MOMO" | "BANK_TRANSFER";
    amount: number;
    transactionId?: string;
    metadata?: Record<string, unknown>;
  }>;
  reason?: string;
};

export type CashierManualReferencePaymentResponse = {
  payment?: CashierPaymentApi;
  remainingBalance?: string | number | null;
  autoSettled?: boolean;
};

export type CashierPaymentIntentResponse = {
  id: string;
  orderId?: string | null;
  provider?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  status?: string | null;
  customerPhone?: string | null;
  failureReason?: string | null;
};

export type CashierCloseOrderResponse = {
  order?: CashierOrderApi;
  payments?: CashierPaymentApi[];
  orderTotal?: string | number | null;
  totalPaid?: string | number | null;
  changeDue?: string | number | null;
};
