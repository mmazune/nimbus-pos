export function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C";
}

export function asCashierNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatCashierMoney(
  value: string | number | null | undefined,
  currencyCode?: string | null,
  unavailable = "Unavailable",
) {
  const amount = asCashierNumber(value);
  if (amount === undefined) return unavailable;

  if (!currencyCode) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatCashierDateTime(value: string | null | undefined, fallback = "Time unavailable") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatCashierElapsed(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function titleCaseCashier(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}
