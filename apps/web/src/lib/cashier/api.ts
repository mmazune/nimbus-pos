import { apiRequest } from "@/lib/api/client";

export type CashierShiftApi = {
  id: string;
  shiftNumber?: string | null;
  status?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  openedById?: string | null;
  branchId?: string | null;
  orgId?: string | null;
  tillSessions?: Array<{
    id: string;
    tillCode?: string | null;
    status?: string | null;
    openingFloat?: string | number | null;
  }>;
} | null;

export type CashierTillApi = {
  id: string;
  tillCode?: string | null;
  status?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  reconciledAt?: string | null;
  openingFloat?: string | number | null;
  expectedCash?: string | number | null;
  countedCash?: string | number | null;
  variance?: string | number | null;
  varianceStatus?: string | null;
  branchId?: string | null;
  orgId?: string | null;
  shift?: {
    id: string;
    shiftNumber?: string | null;
    status?: string | null;
  } | null;
} | null;

export function getCashierActiveShift(token: string, branchId: string) {
  return apiRequest<CashierShiftApi>("/api/shifts/active", {
    token,
    branchId,
  });
}

export function getCashierActiveTill(token: string, branchId: string) {
  return apiRequest<CashierTillApi>("/api/tills/active", {
    token,
    branchId,
  });
}
