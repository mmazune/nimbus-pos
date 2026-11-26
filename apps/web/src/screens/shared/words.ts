import { ApiError } from "@/lib/api/client";

/**
 * What went wrong, in words a person at the till can act on. The API client's
 * own messages for a dropped connection name the server address and CORS; they
 * never reach the screen. Server messages for a refused action are kept: they
 * say why (a booking clash, a closed shift).
 */
export function errorWords(e: unknown, fallback = "That did not go through. Try again."): string {
  if (e instanceof ApiError) {
    if (e.code === "NETWORK_ERROR") return "The connection dropped. Check the network, then try again.";
    if (e.code === "REQUEST_TIMEOUT") return "It took too long to answer. Try again.";
    if (e.isAuthError) return "Your session has ended. Sign in again.";
    if (e.isForbidden) return "This account cannot do that.";
    return e.message || fallback;
  }
  return e instanceof Error && e.message ? e.message : fallback;
}
