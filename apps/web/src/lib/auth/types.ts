export type SessionPlatform =
  | "WEB_BACKOFFICE"
  | "POS_DESKTOP"
  | "MOBILE_APP"
  | "KDS_SCREEN"
  | "SELF_KIOSK"
  | "DRIVER_APP";

export type AuthRole = {
  id: string;
  name: string;
  level?: string;
  jobRole?: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  roles: AuthRole[];
  permissions: string[];
};

export type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
  session?: {
    id: string;
    platform?: SessionPlatform;
    source?: string;
    orgId?: string | null;
    branchId?: string | null;
  };
};

export type AuthMembership = {
  id: string;
  organizationId: string;
  organizationName?: string;
  organizationSlug?: string;
  organizationStatus?: string;
  branchId: string;
  branchName?: string;
  branchSlug?: string;
  branchStatus?: string;
  branchCurrencyCode?: string | null;
  roleId?: string;
  roleName?: string;
  roleLevel?: string;
  jobRole?: string | null;
  status?: string;
  isDefaultBranch?: boolean;
};

export type AuthContext = {
  organizationCount: number;
  branchCount: number;
  requiresContextSelection: boolean;
  defaultOrganizationId: string | null;
  defaultBranchId: string | null;
  defaultMembershipId: string | null;
};

export type AuthEmployeeIdentity = {
  id: string;
  employeeCode?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status?: string | null;
  orgId?: string | null;
  branchId?: string | null;
  jobRole?: string | null;
  positionCode?: string | null;
};

export type AuthMeResponse = AuthUser & {
  isActive?: boolean;
  memberships: AuthMembership[];
  context: AuthContext;
  employee?: AuthEmployeeIdentity | null;
  session: {
    id: string;
    platform?: SessionPlatform;
    source?: string;
    lastActivityAt?: string;
    createdAt?: string;
  } | null;
};

export type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type ActiveShiftResponse = {
  id: string;
  shiftNumber?: string;
  status?: "OPEN" | "CLOSED" | string;
  openedAt?: string;
  closedAt?: string | null;
  openedById?: string;
  branchId?: string;
  orgId?: string;
  tillSessions?: Array<{
    id: string;
    tillCode?: string;
    status?: string;
    openingFloat?: string;
  }>;
} | null;

export type WaiterSessionState = {
  user: AuthMeResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isWaiter: boolean;
  isCashier: boolean;
  isSupervisor: boolean;
  branchId: string | null;
  branchName: string | null;
  currencyCode: string | null;
  organizationId: string | null;
};
