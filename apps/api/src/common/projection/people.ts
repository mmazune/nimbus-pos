import { Prisma } from '@prisma/client';

/**
 * T6 — the only fields of another person that a list or a record may carry.
 *
 * A bare `include: { user: true }` returns the whole User row, password hash, PIN hashes and
 * lookup hash included; a bare `include: { employee: true }` returns date of birth, address,
 * emergency contact, private notes and the compensation link. Every relation to a person in
 * an answer uses one of these selects instead.
 */
export const SAFE_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
} satisfies Prisma.UserSelect;

export const COLLEAGUE_EMPLOYEE_SELECT = {
  id: true,
  orgId: true,
  branchId: true,
  userId: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  status: true,
  positionId: true,
} satisfies Prisma.EmployeeSelect;

/** Keys that never leave the API in any answer, at any depth (see SecretScrubInterceptor). */
export const NEVER_IN_AN_ANSWER = [
  'passwordHash',
  'pinHash',
  'quickPinHash',
  'pinLookupHash',
  'tokenHash',
  'keyHash',
  'secretHash',
  'refreshTokenHash',
] as const;
