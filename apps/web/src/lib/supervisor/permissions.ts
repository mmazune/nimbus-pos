import type { AuthMeResponse } from "@/lib/auth/types";
import type { SupervisorReadinessTone } from "@/lib/supervisor/state";

export type SupervisorPermissionSummary = {
  key: string;
  label: string;
  description: string;
  permissions: readonly string[];
  matched: string[];
  total: number;
  tone: SupervisorReadinessTone;
};

export const supervisorPermissionGroups: Record<string, Omit<SupervisorPermissionSummary, "matched" | "total" | "tone">> = {
  floor: {
    key: "floor",
    label: "Floor and table control",
    description: "Branch floor plans, tables, and verified table status controls.",
    permissions: ["pos:floor:read", "pos:floor:write", "pos:table:read", "pos:table:write"],
  },
  orders: {
    key: "orders",
    label: "Order exception resolution",
    description: "Order handoff and exception capabilities without becoming waiter menu entry.",
    permissions: [
      "pos:order:split",
      "pos:order:merge",
      "pos:order:transfer",
      "pos:order:move-items",
      "pos:void:postclose",
      "pos:discount:read",
      "pos:refund:read",
    ],
  },
  reservations: {
    key: "reservations",
    label: "Reservation oversight",
    description: "Reservation review and branch front-door control within verified read contracts.",
    permissions: [
      "pos:reservation:read",
      "pos:reservation:confirm",
      "pos:reservation:assign-table",
      "pos:reservation:seat",
      "pos:reservation:cancel",
      "pos:reservation:no-show",
    ],
  },
  approvals: {
    key: "approvals",
    label: "Domain approvals and exceptions",
    description: "Domain-specific approval surfaces only; global approvals inbox stays unavailable.",
    permissions: [
      "pos:discount:approve",
      "pos:refund:approve",
      "pos:void:postclose",
      "pos:analytics:anomalies:acknowledge",
      "pos:hr:leave:review",
      "pos:hr:shift-swaps:approve",
    ],
  },
  workforce: {
    key: "workforce",
    label: "Workforce self-service and review",
    description: "Punch, leave, shift swap reads, attendance, and safe current-user staff context.",
    permissions: [
      "pos:hr:attendance:read",
      "pos:hr:leave:read",
      "pos:hr:leave:review",
      "pos:hr:shift-swaps:read",
      "pos:hr:shift-swaps:approve",
      "pos:staff:insights:read",
    ],
  },
  reports: {
    key: "reports",
    label: "Operational reports read",
    description: "Read-oriented branch reports and operational dashboard access.",
    permissions: [
      "pos:dash:manager:read",
      "pos:dash:today-summary:read",
      "pos:dash:stream:read",
      "pos:reports:shift-end:generate",
      "pos:reports:daily-sales:generate",
      "pos:reports:top-items:read",
      "pos:reports:history:read",
    ],
  },
} as const;

export const supervisorRestrictedSurfaces = [
  {
    label: "Global approvals inbox",
    detail: "Use domain-specific queues only; do not call /api/approvals for Supervisor v1.",
    permissions: ["approvals:read", "approvals:decide"],
  },
  {
    label: "Receipt administration",
    detail: "Receipt view, reprint, and send remain outside Supervisor v1.",
    permissions: ["pos:receipt:read", "pos:receipt:reprint", "pos:receipt:send"],
  },
  {
    label: "Device, printer, and terminal administration",
    detail: "Device routes are metadata only and terminal pairing is a stub; no hardware traffic.",
    permissions: ["devices:read", "devices:write", "devices:routes:write", "devices:terminals:write"],
  },
  {
    label: "Owner, billing, accounting, franchise, and developer surfaces",
    detail: "Backoffice and owner SaaS surfaces are not Supervisor route shortcuts.",
    permissions: ["billing:*", "accounting:*", "franchise:*", "developer:*"],
  },
] as const;

export function hasSupervisorPermission(user: AuthMeResponse | null, permission: string) {
  return Boolean(user?.permissions.includes(permission));
}

export function hasAnySupervisorPermission(user: AuthMeResponse | null, permissions: readonly string[]) {
  return permissions.some((permission) => hasSupervisorPermission(user, permission));
}

export function summarizeSupervisorPermissions(permissions: readonly string[] = []): SupervisorPermissionSummary[] {
  const granted = new Set(permissions);

  return Object.values(supervisorPermissionGroups).map((group) => {
    const matched = group.permissions.filter((permission) => granted.has(permission));
    const tone: SupervisorReadinessTone =
      matched.length === 0 ? "neutral" : matched.length === group.permissions.length ? "success" : "info";

    return {
      ...group,
      matched,
      total: group.permissions.length,
      tone,
    };
  });
}

export function requireSupervisorContext(user: AuthMeResponse | null) {
  if (!user) {
    return {
      ok: false,
      reason: "Session context is unavailable.",
    };
  }

  if (!user.context.defaultBranchId) {
    return {
      ok: false,
      reason: "Supervisor workspace needs a default branch from /api/auth/me.",
    };
  }

  return {
    ok: true,
    reason: null,
  };
}
