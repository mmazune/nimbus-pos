import { apiRequest } from "@/lib/api/client";
import type {
  CashierCashMovementApi,
  CashierOpenTillInput,
  CashierReconcileTillInput,
  CashierSafeDropInput,
  CashierTillApi,
} from "@/lib/cashier/till-types";

function idempotencyHeaders(idempotencyKey: string) {
  return { "Idempotency-Key": idempotencyKey };
}

export function getCashierTill(token: string, branchId: string, tillId: string) {
  return apiRequest<CashierTillApi>(`/api/tills/${tillId}`, { token, branchId });
}

export function getCashierTillSummary(token: string, branchId: string, tillId: string) {
  return apiRequest<CashierTillApi>(`/api/tills/${tillId}/summary`, { token, branchId });
}

export function openCashierTill({
  token,
  branchId,
  idempotencyKey,
  input,
}: {
  token: string;
  branchId: string;
  idempotencyKey: string;
  input: CashierOpenTillInput;
}) {
  return apiRequest<CashierTillApi>("/api/tills/open", {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function recordCashierSafeDrop({
  token,
  branchId,
  tillId,
  idempotencyKey,
  input,
}: {
  token: string;
  branchId: string;
  tillId: string;
  idempotencyKey: string;
  input: CashierSafeDropInput;
}) {
  return apiRequest<CashierCashMovementApi>(`/api/tills/${tillId}/safe-drop`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function reconcileCashierTill({
  token,
  branchId,
  tillId,
  idempotencyKey,
  input,
}: {
  token: string;
  branchId: string;
  tillId: string;
  idempotencyKey: string;
  input: CashierReconcileTillInput;
}) {
  return apiRequest<CashierTillApi>(`/api/tills/${tillId}/reconcile`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}
