export function formatWaiterDisplayName(value: string | null | undefined) {
  const parts = (value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";

  const firstName = parts[0];
  const surname = parts[parts.length - 1];
  return `${firstName} ${surname.charAt(0).toUpperCase()}.`;
}

const ZERO_FRACTION_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "XAF",
  "XOF",
  "XPF",
]);

function normalizeCurrencyCode(value: string | null | undefined) {
  const code = (value || "UGX").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "UGX";
}

function currencyFractionDigits(currencyCode: string) {
  if (ZERO_FRACTION_CURRENCIES.has(currencyCode)) return 0;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

export function formatWaiterMoney(
  value: number | null | undefined,
  currencyCode?: string | null,
  fallback = "Pending",
) {
  if (value === undefined || value === null || !Number.isFinite(value)) return fallback;

  const currency = normalizeCurrencyCode(currencyCode);
  const fractionDigits = currencyFractionDigits(currency);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
    .format(value)
    .replace(/\u00a0/g, " ");
}
