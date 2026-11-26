import { useRef } from "react";

/**
 * One idempotency key per attempt. A retry of the same write (same input, after
 * a timeout or an error) sends the same key, so the server applies it once. The
 * key is renewed when the input changes or after the write succeeds.
 */
export function useAttemptKey() {
  const current = useRef<{ sig: string; key: string } | null>(null);
  return {
    for(sig: string, build: () => string): string {
      if (!current.current || current.current.sig !== sig) current.current = { sig, key: build() };
      return current.current.key;
    },
    done() {
      current.current = null;
    },
  };
}
