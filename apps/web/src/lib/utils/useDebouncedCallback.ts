import { useCallback, useEffect, useRef } from "react";

/**
 * Defer a callback until the caller stops calling it for `delayMs`.
 *
 * Added in Track B3 for the Staff directory's server-backed search box.
 * `/hr/employees?search=` is a real server filter, so writing it to the URL on
 * every keystroke would issue one request per character — a request storm of
 * exactly the kind `CLAUDE.md` §15 forbids. The input stays fully responsive
 * (local state updates immediately); only the URL write, and therefore the
 * refetch, is debounced.
 *
 * The pending timer is cleared on unmount, so a navigation mid-typing cannot fire
 * a router write against a page that is gone.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs = 350,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Kept in a ref so a re-created callback does not restart the timer.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(
    (...args: Args) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
}
