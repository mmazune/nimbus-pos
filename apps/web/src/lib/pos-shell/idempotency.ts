import { useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Operational idempotency-intent foundation.
//
// Prepared for Prompt 3B high-impact order actions (merge, split, move,
// transfer, …) whose backend endpoints honor an `Idempotency-Key` header via the
// BG3 reliability guard. The two Prompt 3A service actions (request-bill,
// mark-served) are NOT BG3-wrapped, so they intentionally do not use this.
//
// Lifecycle contract:
//   1. Rendering an action must NOT generate a key.
//   2. `begin()` generates a key on the first submission intent.
//   3. Duplicate submits / retries of the same unresolved intent reuse the key.
//   4. `reset()` clears the intent after success, cancel, or a material change.
//   5. A subsequent `begin()` after reset yields a fresh key.
// ─────────────────────────────────────────────────────────────────────────────

export type OperationalIdempotencyKeyInput = {
  /** Stable operation label, e.g. "supervisor:merge". */
  operation: string;
  /** Optional order/entity id the write targets. */
  orderId?: string | null;
};

let fallbackCounter = 0;

function randomSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without WebCrypto: monotonic counter + timestamp,
  // unique per call without relying on Math.random.
  fallbackCounter += 1;
  return `${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
}

/** Build a fresh, unique idempotency key. Never call this at render time. */
export function buildOperationalIdempotencyKey(input: OperationalIdempotencyKeyInput): string {
  return ["ops", input.operation, input.orderId || "-", randomSuffix()]
    .filter(Boolean)
    .join(":");
}

export type IdempotencyIntent = {
  /** Current key without generating one; null until `begin()` has run. */
  current: () => string | null;
  /** Return the existing key, or generate and store one on first call. */
  begin: () => string;
  /** Clear the stored key so the next `begin()` starts a new intent. */
  reset: () => void;
};

/**
 * Framework-agnostic intent holder. Kept pure so it is unit/assertion testable
 * without a React renderer.
 */
export function createIdempotencyIntent(build: () => string): IdempotencyIntent {
  let key: string | null = null;
  return {
    current: () => key,
    begin: () => {
      if (!key) key = build();
      return key;
    },
    reset: () => {
      key = null;
    },
  };
}

/** React binding: one stable intent per mounted action surface. */
export function useIdempotencyIntent(build: () => string): IdempotencyIntent {
  const ref = useRef<IdempotencyIntent | null>(null);
  if (!ref.current) {
    ref.current = createIdempotencyIntent(build);
  }
  return ref.current;
}
