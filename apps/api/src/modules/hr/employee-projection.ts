import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * C-02 (NG-02 / MP0-01) — employee compensation + PII projection.
 *
 * `GET /api/hr/employees` used to return `compensationProfile{baseAmount, salaryBasis,
 * allowances, deductions}` plus `dateOfBirth`, `address`, `emergencyContact*`, private HR
 * `notes` and free-form `metadata` on EVERY row, to any token holding
 * `pos:hr:employees:read`. `GET /api/hr/employees/:id` additionally returned
 * `contracts[].salaryAmount`. A client-side allow-list cannot undo that: the data is
 * already on the wire.
 *
 * The contract is now:
 *   * DEFAULT (no `view` parameter) — the SAFE projection, for every caller including
 *     Owner. Compensation, bank/tax-adjacent and personal fields are never selected from
 *     the database, so they cannot be returned by accident.
 *   * `?view=full` — the historical full payload, allowed ONLY for a token holding
 *     `pos:hr:compensation:read` (the existing compensation-grade permission that already
 *     gates `GET /api/hr/compensation-profiles`). No new permission was invented or seeded.
 *
 * ⚠️ Recorded honestly: the seeded role matrix grants `pos:hr:compensation:read` to
 * Owner, Manager AND Accountant (`packages/db/prisma/seed.ts`). So a Manager token can
 * still opt in explicitly. What this module guarantees is that the DEFAULT wire payload
 * — the one a Staff directory fetches — carries no compensation and no personal PII for
 * anybody. Narrowing the Manager role's grant is a seed/role change and was NOT
 * authorised in this batch; it is recorded as a follow-up.
 */

export const COMPENSATION_READ_PERMISSION = 'pos:hr:compensation:read';

export type EmployeeView = 'safe' | 'full';

/**
 * Columns the safe projection is allowed to read. Anything absent here is never even
 * fetched from Postgres on the default path.
 *
 * Deliberately EXCLUDED: `dateOfBirth`, `address`, `emergencyContactName`,
 * `emergencyContactPhone`, `notes` (private HR notes), `metadata` (free-form, unaudited),
 * and the whole `compensationProfile` relation.
 *
 * `phone` / `email` are retained: they are the work contact details a staff directory
 * needs, and are the same values already exposed through `/api/auth/me` and the
 * operational staff pickers.
 */
export const SAFE_EMPLOYEE_SELECT = {
  id: true,
  orgId: true,
  branchId: true,
  userId: true,
  employeeCode: true,
  firstName: true,
  middleName: true,
  lastName: true,
  phone: true,
  email: true,
  hireDate: true,
  status: true,
  employmentType: true,
  positionId: true,
  compensationProfileId: true,
  createdAt: true,
  updatedAt: true,
  position: true,
} satisfies Prisma.EmployeeSelect;

/** Contract fields that are safe next to an employee record (no salary of any kind). */
export const SAFE_CONTRACT_SELECT = {
  id: true,
  contractNumber: true,
  contractStatus: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmploymentContractSelect;

/** The historical (pre-C-02) payload, still reachable through `?view=full`. */
export const FULL_EMPLOYEE_INCLUDE = {
  position: true,
  compensationProfile: true,
} satisfies Prisma.EmployeeInclude;

/**
 * Resolve the requested view against the caller's permissions.
 *
 * `undefined` / `'safe'` → `'safe'`.
 * `'full'` → `'full'` when the caller holds {@link COMPENSATION_READ_PERMISSION},
 * otherwise a 403 that names the permission (never a silent downgrade — a caller that
 * asked for salary data must be told it was refused).
 */
export function resolveEmployeeView(
  requested: string | undefined,
  permissions: string[] | undefined,
): EmployeeView {
  if (requested !== 'full') return 'safe';
  const held = permissions ?? [];
  if (!held.includes(COMPENSATION_READ_PERMISSION)) {
    throw new ForbiddenException(
      `view=full returns compensation and personal data and requires "${COMPENSATION_READ_PERMISSION}"`,
    );
  }
  return 'full';
}

export interface SafeContract {
  id: string;
  contractNumber: string;
  contractStatus: string;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeEmployee {
  id: string;
  orgId: string;
  branchId: string | null;
  userId: string | null;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  phone: string | null;
  email: string | null;
  hireDate: Date;
  status: string;
  employmentType: string;
  positionId: string | null;
  compensationProfileId: string | null;
  createdAt: Date;
  updatedAt: Date;
  position?: unknown;
  contracts?: SafeContract[];
}

/**
 * Build the safe employee object explicitly, field by field.
 *
 * This runs even though {@link SAFE_EMPLOYEE_SELECT} already restricts the query: the
 * select protects the wire, this mapping makes the guarantee assertable in unit tests
 * and stops a future `include` from silently widening the payload.
 */
export function projectEmployeeSafe(employee: any): SafeEmployee {
  const safe: SafeEmployee = {
    id: employee.id,
    orgId: employee.orgId,
    branchId: employee.branchId ?? null,
    userId: employee.userId ?? null,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    middleName: employee.middleName ?? null,
    lastName: employee.lastName,
    phone: employee.phone ?? null,
    email: employee.email ?? null,
    hireDate: employee.hireDate,
    status: employee.status,
    employmentType: employee.employmentType,
    positionId: employee.positionId ?? null,
    compensationProfileId: employee.compensationProfileId ?? null,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
  if (employee && 'position' in employee) safe.position = employee.position ?? null;
  if (employee && 'contracts' in employee) {
    safe.contracts = (employee.contracts ?? []).map((c: any) => ({
      id: c.id,
      contractNumber: c.contractNumber,
      contractStatus: c.contractStatus,
      startsAt: c.startsAt,
      endsAt: c.endsAt ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }
  return safe;
}

/**
 * Field names that must never appear on a safe employee payload. Exported so the unit
 * tests assert against one list instead of restating it.
 */
export const FORBIDDEN_SAFE_EMPLOYEE_KEYS = [
  'compensationProfile',
  'dateOfBirth',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
  'notes',
  'metadata',
] as const;
