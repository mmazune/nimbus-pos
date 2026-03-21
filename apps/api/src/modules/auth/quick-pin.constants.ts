import { JobRole } from '@prisma/client';

/**
 * M3.1 Quick PIN tier policy.
 * Maps job roles to their PIN tier and expected PIN length.
 */

export enum QuickPinTierValue {
  LOW_6 = 'LOW_6',
  HIGH_8 = 'HIGH_8',
}

export const PIN_LENGTH_BY_TIER: Record<QuickPinTierValue, number> = {
  [QuickPinTierValue.LOW_6]: 6,
  [QuickPinTierValue.HIGH_8]: 8,
};

/** Roles that get 6-digit PINs (low-level POS staff) */
export const LOW_TIER_ROLES: JobRole[] = [JobRole.WAITER, JobRole.CASHIER, JobRole.BARTENDER];

/** Roles that get 8-digit PINs (higher-level POS approval) */
export const HIGH_TIER_ROLES: JobRole[] = [JobRole.SUPERVISOR, JobRole.MANAGER];

/** Roles excluded from quick PIN login entirely */
export const EXCLUDED_FROM_QUICK_PIN: JobRole[] = [
  JobRole.OWNER,
  JobRole.ACCOUNTANT,
  JobRole.PROCUREMENT,
  JobRole.STOCK_MANAGER,
  JobRole.EVENT_MANAGER,
  JobRole.CHEF,
];

/** Quick PIN login is POS_DESKTOP only */
export const QUICK_PIN_ALLOWED_PLATFORMS = ['POS_DESKTOP'] as const;

/** Lockout policy */
export const QUICK_PIN_MAX_FAILED_ATTEMPTS = 5;
export const QUICK_PIN_LOCKOUT_MINUTES = 5;

/**
 * Resolve the PIN tier for a given JobRole.
 * Returns null if the role is excluded from quick PIN login.
 */
export function resolveQuickPinTier(jobRole: JobRole): QuickPinTierValue | null {
  if (LOW_TIER_ROLES.includes(jobRole)) return QuickPinTierValue.LOW_6;
  if (HIGH_TIER_ROLES.includes(jobRole)) return QuickPinTierValue.HIGH_8;
  return null;
}

/**
 * Get the expected PIN length for a given tier.
 */
export function getPinLengthForTier(tier: QuickPinTierValue): number {
  return PIN_LENGTH_BY_TIER[tier];
}
