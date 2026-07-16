export type SupervisorReadinessTone = "neutral" | "success" | "warning" | "danger" | "info";

export type SupervisorReadinessItem = {
  key: string;
  label: string;
  value: string;
  tone: SupervisorReadinessTone;
};

export type SupervisorStateTone = "neutral" | "info" | "warning" | "danger" | "success";

export const supervisorCaveats = {
  globalApprovals:
    "Supervisor approvals are domain-specific — global approvals inbox is not available in v1.",
  receiptsDevices:
    "Receipt and device administration are outside Supervisor v1.",
  pesaPal:
    "PesaPal is owner SaaS billing only — excluded from diner checkout.",
  mobileMoney:
    "CRITICAL — MTN/Airtel diner checkout pending provider confirmation.",
  printer:
    "Printer routes are metadata-oriented — no print-driver invocation.",
  terminal:
    "Terminal pairing is STUB — no acquirer/card-terminal traffic.",
} as const;

export const defaultSupervisorReadiness: SupervisorReadinessItem[] = [
  {
    key: "shift",
    label: "Shift",
    value: "Shift check pending",
    tone: "neutral",
  },
  {
    key: "floor",
    label: "Floor",
    value: "Floor check pending",
    tone: "neutral",
  },
  {
    key: "approvals",
    label: "Approvals",
    value: "Approvals check pending",
    tone: "neutral",
  },
];
