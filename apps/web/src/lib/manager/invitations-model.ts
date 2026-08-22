import type { ManagerStatusTone } from "./operations-model";
import type { ManagerInvitationRow } from "./invitations-types";

/**
 * Manager Invitations — pure model (Track B6). No React, no network.
 *
 * Only `Manager` and `Accountant` are invitable through this path — the backend
 * hard-codes the allow-list (`INVITABLE_ROLES_DURING_ONBOARDING`) and rejects
 * anything else with a 400. Other staff use frontline Quick-PIN onboarding.
 */
export const MANAGER_INVITABLE_ROLES = ["Manager", "Accountant"] as const;
export type ManagerInvitableRole = (typeof MANAGER_INVITABLE_ROLES)[number];

export type ManagerInvitationDraft = {
  email: string;
  roleName: ManagerInvitableRole | "";
  firstName: string;
  lastName: string;
};

export function emptyManagerInvitationDraft(): ManagerInvitationDraft {
  return { email: "", roleName: "", firstName: "", lastName: "" };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateManagerInvitationDraft(draft: ManagerInvitationDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(draft.email.trim())) errors.email = "Enter a valid email.";
  if (!draft.roleName) errors.roleName = "Choose a role.";
  return errors;
}

export function managerInvitationStatusTone(status: ManagerInvitationRow["status"]): ManagerStatusTone {
  switch (status) {
    case "ACCEPTED":
      return "success";
    case "REVOKED":
    case "EXPIRED":
      return "danger";
    default:
      return "warning";
  }
}

/** Mirrors `Invitation.status` guards in `client-onboarding.service.ts` exactly. */
export function canResendManagerInvitation(status: ManagerInvitationRow["status"]) {
  return status !== "ACCEPTED" && status !== "REVOKED";
}

export function canRevokeManagerInvitation(status: ManagerInvitationRow["status"]) {
  return status !== "ACCEPTED" && status !== "REVOKED";
}

export function managerInvitationDisplayName(row: ManagerInvitationRow) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return name || row.email;
}
