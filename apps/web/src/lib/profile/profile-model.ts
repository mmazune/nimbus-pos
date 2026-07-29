import type { AuthMeResponse } from "../auth/types";

export type ProfileRole = "waiter" | "cashier" | "supervisor";
export type OperationalTone = "neutral" | "success" | "warning" | "danger" | "info";

export type RoleAccent = {
  label: string;
  heroClassName: string;
  softClassName: string;
  textClassName: string;
};

export const roleAccentMap: Record<ProfileRole, RoleAccent> = {
  waiter: {
    label: "Waiter",
    heroClassName: "bg-role-waiter text-text-inverse",
    softClassName: "bg-role-waiter-soft",
    textClassName: "text-role-waiter",
  },
  cashier: {
    label: "Cashier",
    heroClassName: "bg-role-cashier text-text-inverse",
    softClassName: "bg-role-cashier-soft",
    textClassName: "text-role-cashier",
  },
  supervisor: {
    label: "Supervisor",
    heroClassName: "bg-role-supervisor text-text-inverse",
    softClassName: "bg-role-supervisor-soft",
    textClassName: "text-role-supervisor",
  },
};

export function getRoleAccent(role: ProfileRole) {
  return roleAccentMap[role];
}

export function getProfileInitials(displayName: string, fallback = "") {
  const parts = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return fallback.slice(0, 2).toUpperCase() || "OP";
}

export function resolveLinkedEmployeeId(user: AuthMeResponse | null) {
  if (!user) return undefined;
  const legacyUser = user as AuthMeResponse & {
    employeeId?: string | null;
    staff?: { employeeId?: string | null };
  };

  return user.employee?.id || legacyUser.employeeId || legacyUser.staff?.employeeId || undefined;
}

export function formatProfileDateTime(value: string | null | undefined, fallback = "Not available") {
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
