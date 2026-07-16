import type { StoredTokens } from "./types";

const ACCESS_TOKEN_KEY = "nimbus.accessToken";
const REFRESH_TOKEN_KEY = "nimbus.refreshToken";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredTokens(): StoredTokens | null {
  if (!canUseStorage()) return null;

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return null;

  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY) || undefined;
  return { accessToken, refreshToken };
}

export function storeTokens(tokens: StoredTokens) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearStoredTokens() {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
