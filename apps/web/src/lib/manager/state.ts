export type ManagerReadinessTone = "neutral" | "success" | "warning" | "danger" | "info";

export type ManagerReadinessItem = {
  key: string;
  label: string;
  value: string;
  tone: ManagerReadinessTone;
};

/**
 * Manager query-key namespace (M-P1).
 *
 * EVERY branch-scoped Manager query key MUST start with `MANAGER_QUERY_NAMESPACE`
 * and MUST carry the active `branchId`. Two reasons:
 *
 * 1. Switching branch invalidates exactly this namespace — never a blanket
 *    `queryClient.clear()` and never the auth/profile caches (MANAGER-GAP-016).
 * 2. Keys carrying the branch id keep per-branch results separate, so a switch can
 *    never render another branch's data while a refetch is in flight.
 */
export const MANAGER_QUERY_NAMESPACE = "manager" as const;

export function managerQueryKey(surface: string, branchId: string | null, ...rest: unknown[]) {
  return [MANAGER_QUERY_NAMESPACE, surface, branchId, ...rest] as const;
}

export const defaultManagerReadiness: ManagerReadinessItem[] = [
  {
    key: "branch",
    label: "Branch",
    value: "Select branch",
    tone: "warning",
  },
];

/**
 * Copy for the boundaries M-P0 proved. Used by the foundation pages so the
 * workspace never implies data or actions it cannot truthfully deliver.
 */
export const managerCaveats = {
  tillsShifts:
    "There is no branch-wide tills or shifts list on this backend (GET /api/tills and GET /api/shifts do not exist); tills and shifts can only ever be shown as counts.",
  employees:
    "The employee endpoint is organization-scoped and returns compensation on the wire, so Staff needs an allow-list projection before it can ship.",
  approvals:
    "The approvals list is only partly branch-scoped, so approval counts must be filtered client-side before they are shown.",
  exports:
    "Report exports are CSV-only; the backend's PDF export returns a plain-text file, so no PDF download is offered.",
  branchProfile: "The branch profile is read-only — this backend has no branch-update route.",
} as const;
