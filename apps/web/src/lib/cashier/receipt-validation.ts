import type {
  CashierReceiptReprintInput,
  CashierReceiptSendInput,
  CashierReceiptViewModel,
} from "@/lib/cashier/receipt-types";

export const CASHIER_RECEIPT_SEND_CHANNELS = [
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
] as const;

export function validateReceiptReprintInput(input: CashierReceiptReprintInput) {
  const reasons: string[] = [];
  const copies = input.copies ?? 1;

  if (!Number.isInteger(copies) || copies < 1 || copies > 10) {
    reasons.push("Copies must be a whole number from 1 to 10.");
  }
  if (input.reason && input.reason.length > 280) {
    reasons.push("Reason must be 280 characters or fewer.");
  }

  return { canSubmit: reasons.length === 0, reasons, copies };
}

export function validateReceiptSendInput(input: CashierReceiptSendInput) {
  const reasons: string[] = [];
  const validChannel = CASHIER_RECEIPT_SEND_CHANNELS.some((channel) => channel.id === input.channel);

  if (!validChannel) reasons.push("Unsupported receipt channel.");
  if (!input.recipient.trim()) reasons.push("Recipient is required.");
  if (input.recipient.trim() && input.recipient.trim().length < 3) {
    reasons.push("Recipient must be at least 3 characters.");
  }
  if (input.recipient.length > 160) reasons.push("Recipient must be 160 characters or fewer.");
  if (input.locale && input.locale.length > 8) reasons.push("Locale must be 8 characters or fewer.");
  if (input.note && input.note.length > 280) reasons.push("Note must be 280 characters or fewer.");

  return { canSubmit: reasons.length === 0, reasons };
}

export function deriveReceiptActionBlock(receipt?: CashierReceiptViewModel | null) {
  if (!receipt) return "No receipt available.";
  if (!receipt.canReprint || !receipt.canSend) {
    return receipt.unavailableReason || "Receipt actions are available after order close.";
  }
  return undefined;
}
