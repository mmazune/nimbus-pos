import { apiRequest } from "@/lib/api/client";

import type { ActiveShiftResponse, AuthMeResponse, LoginResponse } from "./types";

const POS_PLATFORM = "POS_DESKTOP";

export function loginWithPasswordRequest(email: string, password: string) {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password, platform: POS_PLATFORM },
  });
}

export function loginWithPinRequest(branchId: string, pin: string) {
  return apiRequest<LoginResponse>("/api/auth/quick-pin-login", {
    method: "POST",
    body: { branchId, pin, platform: POS_PLATFORM },
  });
}

export function getMeRequest(token: string) {
  return apiRequest<AuthMeResponse>("/api/auth/me", { token });
}

export function logoutRequest(token: string) {
  return apiRequest<{ message: string }>("/api/auth/logout", {
    method: "POST",
    token,
  });
}

export function getActiveShiftRequest(token: string, branchId: string) {
  return apiRequest<ActiveShiftResponse>("/api/shifts/active", {
    token,
    branchId,
  });
}
