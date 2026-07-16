export function initialsFromName(name: string | null | undefined) {
  if (!name) return "SV";

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "SV";
}

export function formatSessionDate(value: string | null | undefined) {
  if (!value) return "Session check pending";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Session check pending";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

