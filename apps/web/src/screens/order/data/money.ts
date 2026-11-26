/**
 * Money on the order screen is held as whole minor units (cents) in an integer.
 * Every amount from the API is a decimal string ("28000.00") and is parsed by
 * string, never by parseFloat or Number() on a fraction (rule 17).
 * UGX has no coins below a shilling in use, so a whole-shilling amount renders
 * with no fraction: "UGX 98,000".
 */
export type Minor = number;

const DECIMAL = /^(-)?(\d+)(?:\.(\d{1,2})\d*)?$/;

/** "28000.00" | "28000" | 28000 → 2800000 minor units. Unreadable → null. */
export function toMinor(value: unknown): Minor | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      // The API sends decimals as strings; a non-integer number would be a contract change.
      return toMinor(String(value));
    }
    return value * 100;
  }
  if (typeof value !== "string") return null;
  const m = DECIMAL.exec(value.trim());
  if (!m) return null;
  const whole = Number.parseInt(m[2], 10);
  const frac = Number.parseInt((m[3] ?? "").padEnd(2, "0"), 10);
  if (!Number.isSafeInteger(whole)) return null;
  const minor = whole * 100 + frac;
  return m[1] ? -minor : minor;
}

/** Minor units → the number the API's `amount` field takes (it is an IsNumber field). */
export function toApiAmount(minor: Minor): number {
  if (minor % 100 === 0) return minor / 100;
  // Two decimal places, built from integers: the string is exact, the API parses it.
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return Number(`${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`);
}

/** 2800000 → "28,000"; 2800050 → "28,000.50". */
export function groupShillings(minor: Minor): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === 0 ? `${sign}${grouped}` : `${sign}${grouped}.${String(frac).padStart(2, "0")}`;
}

/** 9800000 → "UGX 98,000". */
export function formatMoney(minor: Minor, currency = "UGX"): string {
  return `${currency} ${groupShillings(minor)}`;
}

/** Whole shillings typed on a keypad ("100000") → minor units. */
export function shillingsToMinor(digits: string): Minor {
  const clean = digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!clean) return 0;
  const whole = Number.parseInt(clean, 10);
  return Number.isSafeInteger(whole * 100) ? whole * 100 : 0;
}
