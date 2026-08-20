import { apiRequest } from "@/lib/api/client";
import type { CashierShiftRecord } from "@/lib/cashier/api";

export type CashierShiftActionPayload = {
  notes?: string;
};

function compactShiftBody(payload: CashierShiftActionPayload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as CashierShiftActionPayload;
}

export function openCashierShift(
  token: string,
  branchId: string,
  payload: CashierShiftActionPayload = {},
) {
  return apiRequest<CashierShiftRecord>("/api/shifts/open", {
    method: "POST",
    token,
    branchId,
    body: compactShiftBody(payload),
  });
}

export function closeCashierShift(
  token: string,
  branchId: string,
  shiftId: string,
  payload: CashierShiftActionPayload = {},
) {
  return apiRequest<CashierShiftRecord & { summary?: unknown }>(`/api/shifts/${shiftId}/close`, {
    method: "POST",
    token,
    branchId,
    body: compactShiftBody(payload),
  });
}
