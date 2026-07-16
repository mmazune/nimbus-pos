export type CashierReadinessTone = "neutral" | "success" | "warning" | "danger" | "info";

export type CashierReadinessItem = {
  key: string;
  label: string;
  value: string;
  tone: CashierReadinessTone;
};

export const cashierCaveats = {
  digitalReceipt: "PENDING — no live email/SMS/WhatsApp adapter",
  printer: "Metadata only — no print-driver invocation",
  cardTerminal: "STUB — no live acquirer/card-terminal traffic",
  mobileMoney: "CRITICAL — MTN/Airtel diner checkout pending provider confirmation",
  pesaPal: "PesaPal is owner SaaS billing only — excluded from diner checkout",
} as const;

export const defaultCashierReadiness: CashierReadinessItem[] = [
  {
    key: "shift",
    label: "Shift",
    value: "Shift check pending",
    tone: "neutral",
  },
  {
    key: "till",
    label: "Till",
    value: "Till check pending",
    tone: "warning",
  },
  {
    key: "providers",
    label: "Provider mode",
    value: "Manual/stub only",
    tone: "info",
  },
];
