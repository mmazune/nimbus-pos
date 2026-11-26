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

  // ── Phase 2: rights for requests for approval (new keys, new feature) ──
  'pos:approvals:answer': {
    holders: ['Owner', 'Manager', 'Supervisor'],
    why: '07 Sensitive actions: a supervisor answers with a PIN or from Approvals; manager and owner may too (R14).',
  },
  'pos:approvals:answer-manager': {
    holders: ['Owner', 'Manager'],
    why: "07 Money: a refund after the day is a manager's; a climbed request reaches managers.",
  },

  // ── Phase 4: stock that moves (new keys; 03-stock-stores-availability.md section 11) ──
  'pos:stock:read': {
    holders: ['Owner', 'Manager', 'Supervisor', 'Chef', 'Bartender', 'Stock Manager', 'Accountant'],
    why: '03 section 11: the store keeper, the station and the manager see their stock; the accountant sees value. Cost is masked without pos:cost:read.',
  },
  'pos:stock:take-out': {
    holders: ['Owner', 'Manager', 'Supervisor', 'Chef', 'Bartender', 'Stock Manager'],
    why: '03 section 11: take out of stock — chef, bartender, store keeper (their store), supervisor (PIN above the limit), manager. One store per branch for now, so their store is the branch store.',
  },
  'pos:stock:remake': {
    holders: ['Owner', 'Manager', 'Supervisor', 'Chef', 'Bartender'],
    why: '03 section 5: the chef remakes a dish; supervisor and manager may too.',
  },
  'pos:cost:write': {
    holders: ['Owner', 'Manager', 'Accountant'],
    why: '03 section 11: set a cost — accountant yes; manager under R14; never waiter, cashier or supervisor.',
  },

  // ── Phase 5: stores (new keys; 03 section 11) ──
  'pos:store:setup': {
    holders: ['Owner', 'Manager'],
    why: '03 section 2: the venue sets its chain; manager.',
  },
  'pos:store:levels:write': {
    holders: ['Owner', 'Manager', 'Stock Manager'],
    why: '03 section 11: set minimum and fill-to — store keeper (their store) and manager.',
  },
  'pos:store:request': {
    holders: ['Owner', 'Manager', 'Chef', 'Bartender'],
    why: '03 section 11: ask the store, receive — chef, bartender (their store), manager.',
  },
  'pos:store:issue': {
    holders: ['Owner', 'Manager', 'Stock Manager'],
    why: '03 section 11: issue — store keeper (their store), manager.',
  },
  'pos:stock:count': {
    holders: ['Owner', 'Manager', 'Stock Manager'],
    why: '03 section 11: count — store keeper (their store), manager.',
  },
  'pos:purchasing:read': {
    holders: ['Owner', 'Manager', 'Stock Manager', 'Accountant'],
    why: '03 section 9: To buy is seen by the store keeper and the manager; the accountant sees cost. Never waiter, cashier or supervisor (R14).',
  },
  'pos:purchasing:write': {
    holders: ['Owner', 'Manager'],
    why: '03 section 9: the manager turns To buy lines into a purchase order.',
  },
  'pos:delivery:receive': {
    holders: ['Owner', 'Manager', 'Stock Manager'],
    why: '03 section 11: receive a delivery — store keeper and manager.',
  },

  // ── Phase 2: every other key whose holders rights-matrix.json changes (generated from its
  // `proposed` holders; the 35 keys with no permission row are ruled on in DEFERRED_KEYS) ──
  'alerts:channel:write': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'flags:audit:read': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'flags:write': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'idempotency:inspect': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'identity:access-matrix:write': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'maintenance:write': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'owner:live:read': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'pos:cost:read': {
    holders: ['Owner', 'Manager', 'Accountant'],
    why: '03 section 11: set a cost, see margin: manager (see) and accountant (yes); not chef or supervisor.',
  },
  'pos:dash:owner:read': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'pos:documents:storage-config:update': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'pos:hr:attendance-policy:create': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'pos:hr:attendance-policy:update': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'pos:hr:compensation:create': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read. (Owner-only today; owner to confirm, see the R14 section.)',
  },
  'pos:inventory:write': {
    holders: ['Owner', 'Manager', 'Stock Manager'],
    why: '03 section 11: issue, receive, count and set minimums: store keeper and manager; not supervisor.',
  },
  'pos:orders:close': {
    holders: ['Owner', 'Manager', 'Cashier'],
    why: 'Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count).',
  },
  'pos:payment:cancel': {
    holders: ['Owner', 'Manager', 'Cashier'],
    why: 'Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count).',
  },
  'pos:payment:close': {
    holders: ['Owner', 'Manager', 'Cashier'],
    why: 'Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count).',
  },
  'pos:payment:create': {
    holders: ['Owner', 'Manager', 'Cashier'],
    why: 'Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count).',
  },
  'pos:payment:intent': {
    holders: ['Owner', 'Manager', 'Cashier'],
    why: 'Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count).',
  },
  'pos:payment:manual-reference': {
    holders: ['Owner', 'Manager', 'Cashier'],
    why: 'Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count).',
  },
  'pos:payroll:runs:pay': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'pos:recipe:read': {
    holders: ['Owner', 'Manager', 'Supervisor', 'Bartender', 'Chef', 'Accountant'],
    why: '03 section 11: recipes: chef and bartender see, accountant sees, manager yes.',
  },
  'pos:recipe:write': {
    holders: ['Owner', 'Manager'],
    why: '03 section 11: recipes are written by the manager only.',
  },
  'pos:refund:create': {
    holders: ['Owner', 'Manager', 'Supervisor'],
    why: '07 Money: refund after close: same day supervisor, later manager. Not waiter or cashier.',
  },
  'pos:shift:close': {
    holders: [
      'Owner',
      'Manager',
      'Supervisor',
      'Cashier',
      'Waiter',
      'Bartender',
      'Chef',
      'Stock Manager',
    ],
    why: "07 Opening: staff start work with PIN, then 'Start my shift'. Chef, bartender and store keeper cannot today.",
  },
  'pos:shift:open': {
    holders: [
      'Owner',
      'Manager',
      'Supervisor',
      'Cashier',
      'Waiter',
      'Bartender',
      'Chef',
      'Stock Manager',
    ],
    why: "07 Opening: staff start work with PIN, then 'Start my shift'. Chef, bartender and store keeper cannot today.",
  },
  'pos:staff:weights:update': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
  'pos:till:open': {
    holders: ['Owner', 'Manager', 'Supervisor', 'Cashier'],
    why: 'R5/R9: a waiter sends and prints the bill; payment, refunds and the till belong to cashier, supervisor (refund same day) and manager.',
  },
  'pos:till:reconcile': {
    holders: ['Owner', 'Manager', 'Supervisor', 'Cashier'],
    why: 'R5/R9: a waiter sends and prints the bill; payment, refunds and the till belong to cashier, supervisor (refund same day) and manager.',
  },
  'pos:till:safe-drop': {
    holders: ['Owner', 'Manager', 'Supervisor', 'Cashier'],
    why: 'R5/R9: a waiter sends and prints the bill; payment, refunds and the till belong to cashier, supervisor (refund same day) and manager.',
  },
  'tenancy:org:write': {
    holders: ['Owner', 'Manager'],
    why: 'R14: Manager has every right except pos:hr:compensation:read.',
  },
};

/**
 * The 35 guard keys that have no permission row. rights-matrix.json proposes granting 27 of them
 * (billing, developer portal, franchise, merchant, support) to Owner and Manager, but the
 * product's rules forbid seeding these deferred modules (CLAUDE.md section 12, Track B6:
 * "Do not seed any of the 35 remaining C-22 deferred-module permissions (franchise:*, ops:*,
 * dev:*, merchant:*, billing:*, support:*)"; T6 prompt: "where the product's rules forbid
 * granting a key (billing, franchise, HMS), grant nothing"). So no row is made and no role
 * holds them; their routes stay closed and their specs run in the quarantine group
 * (docs/reviews/e2e-quarantine.md). The eight ops:* keys are, by the matrix's own ruling, not
 * role rights at all: the operator portal is behind the platform-operator guard. `hms:read:*`
 * stays an API-key scope. Decision D8 in reports/T6_REPORT.md.
 */
export const DEFERRED_KEYS = [
  'billing:pesapal:checkout',
  'billing:read',
  'billing:subscription:write',
  'dev:api-key:read',
  'dev:api-key:write',
  'dev:usage:read',
  'dev:webhook:read',
  'dev:webhook:write',
  'franchise:analytics:read',
  'franchise:budget:read',
  'franchise:consolidation:generate',
  'franchise:digest:read',
  'franchise:digest:write',
  'franchise:overview:read',
  'franchise:ranking:generate-deep',
  'franchise:ranking:read',
  'franchise:scorecard:read',
  'franchise:transfer:approve',
  'franchise:transfer:read',
  'franchise:transfer:write',
  'franchise:waste-benchmark:read',
  'merchant:events:write',
  'merchant:payment:read',
  'merchant:payment:write',
  'merchant:public-profile:write',
  'support:session:read',
  'support:session:write',
  'ops:customers:read',
  'ops:merchant-payments:read',
  'ops:onboarding:read',
  'ops:plans:read',
  'ops:plans:write',
  'ops:subscriptions:read',
  'ops:support:read',
  'ops:support:write',
] as const;

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
