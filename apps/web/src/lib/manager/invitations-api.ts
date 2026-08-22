import { apiRequest } from "@/lib/api/client";
import type { ManagerInvitationCreateResult, ManagerInvitationRow } from "@/lib/manager/invitations-types";

/**
 * Manager Invitations — request layer (Track B6, C-31/C-22 closure).
 *
 * `POST /onboarding/invitations` (create) is gated `onboarding:write`, seeded to
 * Owner + Manager only this phase (`docs/manager-settings-docs/
 * MANAGER_SETTINGS_API_MATRIX.md` §6). `GET /onboarding/invitations` is a NEW
 * route this phase added (§4). Resend/revoke pre-existed, gated
 * `onboarding:invitation:write`.
 *
 * 🔴 The backend does NOT let the caller choose which branch an invitee is
 * assigned to — `createInvitations` always resolves the organization's OLDEST
 * active branch (`orderBy: createdAt asc`), ignoring `X-Branch-Id` entirely.
 * This client therefore never offers a branch picker, and the create form
 * discloses this plainly rather than implying the invitee joins whichever
 * branch the Manager is currently viewing.
 */

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function projectInvitationRow(raw: unknown): ManagerInvitationRow {
  const source = (raw || {}) as Record<string, unknown>;
  const status = str(source.status).toUpperCase();
  return {
    id: str(source.id),
    email: str(source.email),
    firstName: strOrNull(source.firstName),
    lastName: strOrNull(source.lastName),
    roleId: str(source.roleId),
    branchId: str(source.branchId),
    status: (["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"].includes(status) ? status : "PENDING") as ManagerInvitationRow["status"],
    expiresAt: strOrNull(source.expiresAt),
    acceptedAt: strOrNull(source.acceptedAt),
    revokedAt: strOrNull(source.revokedAt),
    revokedReason: strOrNull(source.revokedReason),
    resendCount: num(source.resendCount, 0),
    lastResentAt: strOrNull(source.lastResentAt),
    invitedById: str(source.invitedById),
    createdAt: strOrNull(source.createdAt),
  };
}

/** `GET /onboarding/invitations` — new in B6. Organisation-wide bare array (no server total). */
export async function listManagerInvitations(token: string, branchId: string): Promise<ManagerInvitationRow[]> {
  const response = await apiRequest<unknown[]>("/api/onboarding/invitations", { token, branchId });
  return (Array.isArray(response) ? response : []).map(projectInvitationRow);
}

/**
 * `POST /onboarding/invitations` — `onboarding:write`. Only `Manager` and
 * `Accountant` are invitable through this path (backend hard-codes the
 * allow-list; other staff use the frontline Quick-PIN onboarding flow instead —
 * see `staff-api.ts`).
 */
export async function createManagerInvitation(
  token: string,
  branchId: string,
  input: { email: string; roleName: "Manager" | "Accountant"; firstName?: string; lastName?: string },
): Promise<ManagerInvitationCreateResult> {
  const response = await apiRequest<Record<string, unknown>>("/api/onboarding/invitations", {
    method: "POST",
    body: { invitations: [input] },
    token,
    branchId,
  });
  const invitations = Array.isArray(response.invitations) ? response.invitations : [];
  const first = (invitations[0] || {}) as Record<string, unknown>;
  const status = str(first.status).toUpperCase();
  return {
    email: str(first.email) || input.email,
    roleName: strOrNull(first.roleName),
    wasNewUser: first.wasNewUser === true,
    status: status === "ALREADY_MEMBER" ? "ALREADY_MEMBER" : "INVITED",
    tempPassword: strOrNull(first.tempPassword),
    invitationToken: strOrNull(first.invitationToken),
    expiresAt: strOrNull(first.expiresAt),
  };
}

/** `POST /onboarding/invitations/:id/resend` — `onboarding:invitation:write`. */
export async function resendManagerInvitation(token: string, branchId: string, invitationId: string) {
  return apiRequest<unknown>(`/api/onboarding/invitations/${encodeURIComponent(invitationId)}/resend`, {
    method: "POST",
    body: {},
    token,
    branchId,
  });
}

/** `PATCH /onboarding/invitations/:id/revoke` — `onboarding:invitation:write`. */
export async function revokeManagerInvitation(
  token: string,
  branchId: string,
  invitationId: string,
  reason?: string,
) {
  const trimmed = reason?.trim();
  return apiRequest<unknown>(`/api/onboarding/invitations/${encodeURIComponent(invitationId)}/revoke`, {
    method: "PATCH",
    body: trimmed ? { reason: trimmed } : {},
    token,
    branchId,
  });
}
