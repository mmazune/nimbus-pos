/**
 * Manager Invitations — types (Track B6, Path B / office staff onboarding).
 * See docs/manager-settings-docs/STAFF_LIFECYCLE.md for the full lifecycle.
 */

export type ManagerInvitationRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roleId: string;
  branchId: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  resendCount: number;
  lastResentAt: string | null;
  invitedById: string;
  createdAt: string | null;
};

export type ManagerInvitationCreateResult = {
  email: string;
  roleName: string | null;
  wasNewUser: boolean;
  status: "INVITED" | "ALREADY_MEMBER";
  tempPassword: string | null;
  invitationToken: string | null;
  expiresAt: string | null;
};
