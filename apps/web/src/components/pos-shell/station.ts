/**
 * Shared terminal (station) identity for the operational header.
 *
 * HONEST NOTE — this is a **station label**, not backend data. The API exposes
 * no service-area or workstation entity for a POS terminal today, so before this
 * module every role header printed a dead "Service area unavailable" /
 * "Workstation unavailable" string. A physical POS terminal always has an
 * identity written on it, so the shell now shows a deterministic station label
 * instead of an unavailable-fallback:
 *
 *   1. `localStorage["nimbus.stationTerminalLabel"]`, if an installer/operator has
 *      set one for this physical station; otherwise
 *   2. the constant `DEFAULT_TERMINAL_LABEL` ("Terminal 01").
 *
 * It is NOT derived from, and never claims to be, a server-side workstation
 * record. When a real workstation/service-area contract lands, replace
 * `useStationTerminalLabel()`'s fallback with the fetched value — the render
 * sites need no change.
 */
import { useEffect, useState } from "react";

export const STATION_TERMINAL_LABEL_KEY = "nimbus.stationTerminalLabel";
export const DEFAULT_TERMINAL_LABEL = "Terminal 01";

export function readStationTerminalLabel(): string {
  if (typeof window === "undefined") return DEFAULT_TERMINAL_LABEL;

  try {
    const stored = window.localStorage.getItem(STATION_TERMINAL_LABEL_KEY);
    const trimmed = stored?.trim();
    return trimmed || DEFAULT_TERMINAL_LABEL;
  } catch {
    // Storage can be blocked (private mode / embedded webview) — stay deterministic.
    return DEFAULT_TERMINAL_LABEL;
  }
}

/**
 * Hydration-safe: the first client render matches the server render
 * (`DEFAULT_TERMINAL_LABEL`), then any station override is applied in an effect.
 */
export function useStationTerminalLabel() {
  const [label, setLabel] = useState(DEFAULT_TERMINAL_LABEL);

  useEffect(() => {
    setLabel(readStationTerminalLabel());
  }, []);

  return label;
}

/**
 * Resolve the header's second-slot context label: prefer a real resolved
 * service-area / workstation label, and only fall back to the station label.
 */
export function resolveOperationalContextLabel(
  resolved: string | null | undefined,
  stationLabel: string,
) {
  const trimmed = typeof resolved === "string" ? resolved.trim() : "";
  return trimmed || stationLabel;
}
