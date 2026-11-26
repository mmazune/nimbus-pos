import type { PrismaClient } from '@prisma/client';

/**
 * T6 — rights rulings that win over ROLE_PERM_MATRIX.
 *
 * `seedRolePermissions` only inserts. For every key listed here this step makes the holders
 * EXACTLY the list given: it grants the missing ones and revokes every other role's grant of
 * that key. Keys not listed are untouched. Idempotent: a second run changes nothing.
 *
 * Source of every row: docs/direction/rights-matrix.json `proposed`, which applies R14
 * (docs/direction/01-decisions.md) and docs/direction/10-people-and-access.md. Where a ruling
 * here departs from the matrix, the reason is on the row and in reports/T6_REPORT.md.
 */
export interface RightsRuling {
  holders: string[];
  why: string;
}

const PAYROLL_IS_FINANCE = 'R14: payroll is finance; waiter, cashier and supervisor never hold it.';

export const RIGHTS_RULINGS: Record<string, RightsRuling> = {
  // ── Phase 1: private things stay private ──
  'pos:payroll:slips:read': {
    holders: ['Owner', 'Manager', 'Accountant'],
    why: "R14 and privacy: GET /api/payroll/slips is branch-wide, so a waiter read everyone's pay (probe A1). Everyone reads their own at GET /api/payroll/my-slips, which needs no key.",
  },
  'pos:payroll:adjustments:create': { holders: ['Owner', 'Manager'], why: PAYROLL_IS_FINANCE },
  'pos:payroll:adjustments:read': {
    holders: ['Owner', 'Manager', 'Accountant'],
    why: PAYROLL_IS_FINANCE,
  },
  'pos:payroll:components:read': {
    holders: ['Owner', 'Manager', 'Accountant'],
    why: PAYROLL_IS_FINANCE,
  },
  'pos:payroll:runs:read': { holders: ['Owner', 'Manager', 'Accountant'], why: PAYROLL_IS_FINANCE },
};

export async function applyRightsRulings(
  prisma: PrismaClient,
  rulings: Record<string, RightsRuling> = RIGHTS_RULINGS,
): Promise<{ granted: number; revoked: number; missingKeys: string[]; missingRoles: string[] }> {
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const roleId = new Map(roles.map((r) => [r.name, r.id]));
  const perms = await prisma.permission.findMany({
    where: { action: { in: Object.keys(rulings) } },
    select: { id: true, action: true },
  });
  const permId = new Map(perms.map((p) => [p.action, p.id]));
  const missingKeys = Object.keys(rulings).filter((k) => !permId.has(k));
  const missingRoles = new Set<string>();
  let granted = 0;
  let revoked = 0;

  for (const [action, ruling] of Object.entries(rulings)) {
    const pid = permId.get(action);
    if (!pid) continue;
    const wanted = ruling.holders
      .map((name) => {
        const id = roleId.get(name);
        if (!id) missingRoles.add(name);
        return id;
      })
      .filter((x): x is string => !!x);

    const del = await prisma.rolePermission.deleteMany({
      where: { permissionId: pid, roleId: { notIn: wanted } },
    });
    revoked += del.count;
    const add = await prisma.rolePermission.createMany({
      data: wanted.map((rid) => ({ roleId: rid, permissionId: pid })),
      skipDuplicates: true,
    });
    granted += add.count;
  }
  return { granted, revoked, missingKeys, missingRoles: [...missingRoles] };
}
