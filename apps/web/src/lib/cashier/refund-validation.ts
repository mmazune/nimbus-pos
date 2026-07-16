import { asCashierNumber } from "@/lib/cashier/formatters";
import type {
  CashierRefundPaymentOption,
  CashierRefundValidationResult,
} from "@/lib/cashier/refund-types";

export function validateRefundInput({
  amount,
  reason,
  selectedPayment,
  remainingRefundable,
}: {
  amount: string;
  reason: string;
  selectedPayment?: CashierRefundPaymentOption;
  remainingRefundable?: number;
}): CashierRefundValidationResult {
  const parsedAmount = asCashierNumber(amount);
  const trimmedReason = reason.trim();

  const result: CashierRefundValidationResult = { valid: true };

  if (!selectedPayment) {
    result.paymentError = "Select a completed payment to refund.";
  } else if (selectedPayment.disabledReason) {
    result.paymentError = selectedPayment.disabledReason;
  }

  if (parsedAmount === undefined) {
    result.amountError = "Enter a refund amount.";
  } else if (parsedAmount <= 0) {
    result.amountError = "Refund amount must be greater than zero.";
  } else if (remainingRefundable !== undefined && parsedAmount > remainingRefundable) {
    result.amountError = "Refund amount exceeds remaining refundable amount.";
  } else if (
    selectedPayment?.refundableAmount !== undefined &&
    parsedAmount > selectedPayment.refundableAmount
  ) {
    result.amountError = "Refund amount exceeds the selected payment refundable amount.";
  }

  if (!trimmedReason) {
    result.reasonError = "Enter a refund reason for audit.";
  }

  result.valid = !result.amountError && !result.reasonError && !result.paymentError;
  return result;
}
