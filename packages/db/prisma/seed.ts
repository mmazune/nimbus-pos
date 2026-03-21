import { PrismaClient, RoleLevel, JobRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

// ── Baseline AppConfig rows ──
const APP_CONFIG_DEFAULTS: { key: string; value: string }[] = [
    { key: 'app.name', value: 'Nimbus POS' },
    { key: 'app.version', value: '0.5.0' },
    { key: 'app.milestone', value: 'M5' },
];

async function seedAppConfig(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const row of APP_CONFIG_DEFAULTS) {
        const existing = await prisma.appConfig.findUnique({ where: { key: row.key } });
        if (existing) {
            // Update value if changed
            if (existing.value !== row.value) {
                await prisma.appConfig.update({ where: { key: row.key }, data: { value: row.value } });
                console.log(`  🔄 AppConfig "${row.key}" updated to "${row.value}"`);
            } else {
                console.log(`  ⏭  AppConfig "${row.key}" already exists — skipped`);
            }
            skipped++;
        } else {
            await prisma.appConfig.create({ data: row });
            console.log(`  ✅ AppConfig "${row.key}" created`);
            created++;
        }
    }

    return { created, skipped };
}

// ── M2: Roles ──

const ROLES_DATA = [
    { name: 'Owner', level: RoleLevel.L5, jobRole: JobRole.OWNER, description: 'Full system access — platform owner' },
    { name: 'Manager', level: RoleLevel.L4, jobRole: JobRole.MANAGER, description: 'Branch management — day-to-day operations' },
    { name: 'Accountant', level: RoleLevel.L4, jobRole: JobRole.ACCOUNTANT, description: 'Financial access — reporting and accounting' },
    { name: 'Supervisor', level: RoleLevel.L3, jobRole: JobRole.SUPERVISOR, description: 'Floor supervisor — overrides and approvals' },
    { name: 'Cashier', level: RoleLevel.L2, jobRole: JobRole.CASHIER, description: 'POS operations — orders and payments' },
    { name: 'Chef', level: RoleLevel.L2, jobRole: JobRole.CHEF, description: 'Kitchen operations — KDS and prep' },
    { name: 'Waiter', level: RoleLevel.L1, jobRole: JobRole.WAITER, description: 'Floor service — order taking' },
    { name: 'Bartender', level: RoleLevel.L2, jobRole: JobRole.BARTENDER, description: 'Bar operations — drinks and service' },
    { name: 'Procurement', level: RoleLevel.L3, jobRole: JobRole.PROCUREMENT, description: 'Purchasing — suppliers and orders' },
    { name: 'Stock Manager', level: RoleLevel.L3, jobRole: JobRole.STOCK_MANAGER, description: 'Inventory management — counts and adjustments' },
    { name: 'Event Manager', level: RoleLevel.L3, jobRole: JobRole.EVENT_MANAGER, description: 'Events and bookings — reservations' },
];

async function seedRoles(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const role of ROLES_DATA) {
        const existing = await prisma.role.findUnique({ where: { name: role.name } });
        if (existing) {
            console.log(`  ⏭  Role "${role.name}" already exists — skipped`);
            skipped++;
        } else {
            await prisma.role.create({ data: role });
            console.log(`  ✅ Role "${role.name}" created`);
            created++;
        }
    }

    return { created, skipped };
}

// ── M2: Permissions ──

const PERMISSIONS_DATA = [
    { action: 'identity:user:read', description: 'Read user profiles' },
    { action: 'identity:user:write', description: 'Create/update users' },
    { action: 'identity:session:read', description: 'View sessions' },
    { action: 'identity:session:revoke', description: 'Revoke sessions' },
    { action: 'identity:access-matrix:read', description: 'View access matrix / permission test' },
    { action: 'identity:access-matrix:write', description: 'Modify access matrix' },
    // M3 tenancy permissions
    { action: 'tenancy:org:read', description: 'Read organizations' },
    { action: 'tenancy:org:write', description: 'Create/update organizations' },
    { action: 'tenancy:branch:read', description: 'Read branches' },
    { action: 'tenancy:branch:write', description: 'Create/update branches' },
    { action: 'tenancy:membership:manage', description: 'Create/manage memberships' },
    // M4 settings permissions
    { action: 'tenancy:settings:manage', description: 'Create/update org settings' },
    // M5 floor + table permissions
    { action: 'pos:floor:read', description: 'Read floor plans' },
    { action: 'pos:floor:write', description: 'Create/update floor plans' },
    { action: 'pos:table:read', description: 'Read tables' },
    { action: 'pos:table:write', description: 'Create/update tables' },
];

async function seedPermissions(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const perm of PERMISSIONS_DATA) {
        const existing = await prisma.permission.findUnique({ where: { action: perm.action } });
        if (existing) {
            console.log(`  ⏭  Permission "${perm.action}" already exists — skipped`);
            skipped++;
        } else {
            await prisma.permission.create({ data: perm });
            console.log(`  ✅ Permission "${perm.action}" created`);
            created++;
        }
    }

    return { created, skipped };
}

// ── M2: Role-Permission Mappings ──
// L5 (Owner) gets all permissions.
// L4 (Manager, Accountant) gets all except access-matrix:write.
// L3 (Supervisor, Procurement, Stock Manager, Event Manager) gets read permissions.
// L2 (Cashier, Chef, Bartender) gets user:read only.
// L1 (Waiter) gets user:read only.

const ROLE_PERM_MATRIX: Record<string, string[]> = {
    Owner: [
        'identity:user:read',
        'identity:user:write',
        'identity:session:read',
        'identity:session:revoke',
        'identity:access-matrix:read',
        'identity:access-matrix:write',
        'tenancy:org:read',
        'tenancy:org:write',
        'tenancy:branch:read',
        'tenancy:branch:write',
        'tenancy:membership:manage',
        'tenancy:settings:manage',
        'pos:floor:read',
        'pos:floor:write',
        'pos:table:read',
        'pos:table:write',
    ],
    Manager: [
        'identity:user:read',
        'identity:user:write',
        'identity:session:read',
        'identity:session:revoke',
        'identity:access-matrix:read',
        'tenancy:org:read',
        'tenancy:branch:read',
        'tenancy:branch:write',
        'tenancy:membership:manage',
        'tenancy:settings:manage',
        'pos:floor:read',
        'pos:floor:write',
        'pos:table:read',
        'pos:table:write',
    ],
    Accountant: [
        'identity:user:read',
        'identity:session:read',
        'identity:access-matrix:read',
        'tenancy:org:read',
        'tenancy:branch:read',
    ],
    Supervisor: [
        'identity:user:read',
        'identity:session:read',
        'identity:access-matrix:read',
        'tenancy:org:read',
        'tenancy:branch:read',
        'pos:floor:read',
        'pos:floor:write',
        'pos:table:read',
        'pos:table:write',
    ],
    Cashier: ['identity:user:read', 'tenancy:branch:read', 'pos:floor:read', 'pos:table:read'],
    Chef: ['identity:user:read', 'tenancy:branch:read', 'pos:floor:read', 'pos:table:read'],
    Waiter: ['identity:user:read', 'tenancy:branch:read', 'pos:floor:read', 'pos:table:read'],
    Bartender: ['identity:user:read', 'tenancy:branch:read', 'pos:floor:read', 'pos:table:read'],
    Procurement: ['identity:user:read', 'identity:session:read', 'tenancy:org:read', 'tenancy:branch:read'],
    'Stock Manager': ['identity:user:read', 'identity:session:read', 'tenancy:org:read', 'tenancy:branch:read'],
    'Event Manager': ['identity:user:read', 'identity:session:read', 'tenancy:org:read', 'tenancy:branch:read'],
};

async function seedRolePermissions(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const [roleName, permActions] of Object.entries(ROLE_PERM_MATRIX)) {
        const role = await prisma.role.findUnique({ where: { name: roleName } });
        if (!role) {
            console.log(`  ⚠️  Role "${roleName}" not found — skipping permissions`);
            continue;
        }

        for (const action of permActions) {
            const permission = await prisma.permission.findUnique({ where: { action } });
            if (!permission) {
                console.log(`  ⚠️  Permission "${action}" not found — skipping`);
                continue;
            }

            const existing = await prisma.rolePermission.findUnique({
                where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
            });

            if (existing) {
                skipped++;
            } else {
                await prisma.rolePermission.create({
                    data: { roleId: role.id, permissionId: permission.id },
                });
                console.log(`  ✅ RolePermission "${roleName}" → "${action}"`);
                created++;
            }
        }
    }

    return { created, skipped };
}

// ── M2: Demo Users ──
// PINs for testing (before hashing): Owner=1234, Manager=2345, Cashier=3456, Chef=4567, Waiter=5678, Accountant=6789

interface DemoUser {
    email: string;
    password: string;
    pin: string;
    firstName: string;
    lastName: string;
    roleName: string;
}

const DEMO_USERS: DemoUser[] = [
    { email: 'owner@demo.local', password: 'Owner#123', pin: '1234', firstName: 'Demo', lastName: 'Owner', roleName: 'Owner' },
    { email: 'manager@demo.local', password: 'Manager#123', pin: '2345', firstName: 'Demo', lastName: 'Manager', roleName: 'Manager' },
    { email: 'accountant@demo.local', password: 'Accountant#123', pin: '6789', firstName: 'Demo', lastName: 'Accountant', roleName: 'Accountant' },
    { email: 'cashier@demo.local', password: 'Cashier#123', pin: '3456', firstName: 'Demo', lastName: 'Cashier', roleName: 'Cashier' },
    { email: 'chef@demo.local', password: 'Chef#123', pin: '4567', firstName: 'Demo', lastName: 'Chef', roleName: 'Chef' },
    { email: 'waiter@demo.local', password: 'Waiter#123', pin: '5678', firstName: 'Demo', lastName: 'Waiter', roleName: 'Waiter' },
];

async function seedUsers(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const demo of DEMO_USERS) {
        const existing = await prisma.user.findUnique({ where: { email: demo.email } });
        if (existing) {
            console.log(`  ⏭  User "${demo.email}" already exists — skipped`);
            skipped++;
            continue;
        }

        const passwordHash = await bcrypt.hash(demo.password, SALT_ROUNDS);
        const pinHash = await bcrypt.hash(demo.pin, SALT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                email: demo.email,
                passwordHash,
                pinHash,
                firstName: demo.firstName,
                lastName: demo.lastName,
            },
        });

        // Assign role
        const role = await prisma.role.findUnique({ where: { name: demo.roleName } });
        if (role) {
            await prisma.userRole.create({
                data: { userId: user.id, roleId: role.id },
            });
            console.log(`  ✅ User "${demo.email}" created with role "${demo.roleName}"`);
        } else {
            console.log(`  ✅ User "${demo.email}" created (role "${demo.roleName}" not found)`);
        }

        created++;
    }

    return { created, skipped };
}

// ── Seed History ──

async function recordSeedRun(seedName: string, details: string): Promise<void> {
    await prisma.seedHistory.upsert({
        where: { seedName },
        update: { runAt: new Date(), details },
        create: { seedName, status: 'completed', details },
    });
}

// ── M3: Organization + Branches + Memberships ──

const ORG_SEED = {
    name: 'Nimbus Restaurant Group',
    slug: 'nimbus',
    legalName: 'Nimbus Restaurant Group LLC',
};

const BRANCHES_SEED = [
    { name: 'Main Branch', code: 'MAIN', slug: 'main', timezone: 'UTC', currencyCode: 'USD' },
    { name: 'Downtown Branch', code: 'DOWNTOWN', slug: 'downtown', timezone: 'UTC', currencyCode: 'USD' },
];

// owner + manager → both branches, accountant → both branches (org visibility)
// cashier, chef, waiter → Main Branch only
const MEMBERSHIP_SEED: { email: string; roleName: string; branchCodes: string[]; defaultBranch: string }[] = [
    { email: 'owner@demo.local', roleName: 'Owner', branchCodes: ['MAIN', 'DOWNTOWN'], defaultBranch: 'MAIN' },
    { email: 'manager@demo.local', roleName: 'Manager', branchCodes: ['MAIN', 'DOWNTOWN'], defaultBranch: 'MAIN' },
    { email: 'accountant@demo.local', roleName: 'Accountant', branchCodes: ['MAIN', 'DOWNTOWN'], defaultBranch: 'MAIN' },
    { email: 'cashier@demo.local', roleName: 'Cashier', branchCodes: ['MAIN'], defaultBranch: 'MAIN' },
    { email: 'chef@demo.local', roleName: 'Chef', branchCodes: ['MAIN'], defaultBranch: 'MAIN' },
    { email: 'waiter@demo.local', roleName: 'Waiter', branchCodes: ['MAIN'], defaultBranch: 'MAIN' },
];

async function seedOrganization(): Promise<{ orgId: string; created: boolean }> {
    const existing = await prisma.organization.findUnique({ where: { slug: ORG_SEED.slug } });
    if (existing) {
        console.log(`  ⏭  Organization "${ORG_SEED.name}" already exists — skipped`);
        return { orgId: existing.id, created: false };
    }

    const org = await prisma.organization.create({
        data: {
            name: ORG_SEED.name,
            slug: ORG_SEED.slug,
            legalName: ORG_SEED.legalName,
        },
    });
    console.log(`  ✅ Organization "${ORG_SEED.name}" created`);
    return { orgId: org.id, created: true };
}

async function seedBranches(orgId: string): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const branch of BRANCHES_SEED) {
        const existing = await prisma.branch.findUnique({
            where: { organizationId_code: { organizationId: orgId, code: branch.code } },
        });
        if (existing) {
            console.log(`  ⏭  Branch "${branch.name}" already exists — skipped`);
            skipped++;
            continue;
        }

        await prisma.branch.create({
            data: {
                organizationId: orgId,
                name: branch.name,
                code: branch.code,
                slug: branch.slug,
                timezone: branch.timezone,
                currencyCode: branch.currencyCode,
            },
        });
        console.log(`  ✅ Branch "${branch.name}" created`);
        created++;
    }

    return { created, skipped };
}

async function seedMemberships(orgId: string): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const ms of MEMBERSHIP_SEED) {
        const user = await prisma.user.findUnique({ where: { email: ms.email } });
        if (!user) {
            console.log(`  ⚠️  User "${ms.email}" not found — skipping membership`);
            continue;
        }

        const role = await prisma.role.findUnique({ where: { name: ms.roleName } });
        if (!role) {
            console.log(`  ⚠️  Role "${ms.roleName}" not found — skipping membership`);
            continue;
        }

        for (const code of ms.branchCodes) {
            const branch = await prisma.branch.findUnique({
                where: { organizationId_code: { organizationId: orgId, code } },
            });
            if (!branch) {
                console.log(`  ⚠️  Branch code "${code}" not found — skipping`);
                continue;
            }

            const existing = await prisma.membership.findUnique({
                where: { userId_branchId: { userId: user.id, branchId: branch.id } },
            });
            if (existing) {
                skipped++;
                continue;
            }

            const isDefault = code === ms.defaultBranch;

            // If setting default, unset any prior defaults for this user in this org
            if (isDefault) {
                await prisma.membership.updateMany({
                    where: { userId: user.id, organizationId: orgId, isDefaultBranch: true },
                    data: { isDefaultBranch: false },
                });
            }

            await prisma.membership.create({
                data: {
                    userId: user.id,
                    organizationId: orgId,
                    branchId: branch.id,
                    roleId: role.id,
                    isDefaultBranch: isDefault,
                },
            });
            console.log(`  ✅ Membership: "${ms.email}" → "${branch.name}" (${ms.roleName})${isDefault ? ' [default]' : ''}`);
            created++;
        }
    }

    return { created, skipped };
}

// ── M3.1: Quick PIN Seed ──

const QUICK_PIN_PEPPER = process.env.QUICK_PIN_PEPPER || 'nimbus-dev-pin-pepper';

// Deterministic demo PINs for testing (NOT used in production)
const DEMO_QUICK_PINS: { email: string; pin: string; tier: 'LOW_6' | 'HIGH_8'; pinLength: number }[] = [
    { email: 'waiter@demo.local', pin: '123456', tier: 'LOW_6', pinLength: 6 },
    { email: 'cashier@demo.local', pin: '654321', tier: 'LOW_6', pinLength: 6 },
    { email: 'manager@demo.local', pin: '12345678', tier: 'HIGH_8', pinLength: 8 },
];

// Add supervisor seed if user exists
// Note: We don't seed a supervisor user in M2, but we handle it gracefully

function derivePinLookupHash(pepper: string, branchId: string, pin: string): string {
    return crypto.createHmac('sha256', pepper).update(`${branchId}:${pin}`).digest('hex');
}

async function seedQuickPins(orgId: string): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    // Get the MAIN branch for lookup hash derivation
    const mainBranch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: 'MAIN' } },
    });

    if (!mainBranch) {
        console.log('  ⚠️  Main branch not found — skipping quick PIN seed');
        return { created: 0, skipped: 0 };
    }

    for (const demo of DEMO_QUICK_PINS) {
        const user = await prisma.user.findUnique({ where: { email: demo.email } });
        if (!user) {
            console.log(`  ⚠️  User "${demo.email}" not found — skipping quick PIN`);
            continue;
        }

        // Skip if already has quick PIN (idempotent)
        if (user.quickPinEnabled && user.quickPinHash) {
            console.log(`  ⏭  User "${demo.email}" already has quick PIN — skipped`);
            skipped++;
            continue;
        }

        const pinHash = await bcrypt.hash(demo.pin, SALT_ROUNDS);
        const lookupHash = derivePinLookupHash(QUICK_PIN_PEPPER, mainBranch.id, demo.pin);

        // Check for lookup hash collision
        const collision = await prisma.user.findUnique({ where: { pinLookupHash: lookupHash } });
        if (collision && collision.id !== user.id) {
            console.log(`  ⚠️  Lookup hash collision for "${demo.email}" — skipping`);
            skipped++;
            continue;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                quickPinHash: pinHash,
                pinLookupHash: lookupHash,
                pinLength: demo.pinLength,
                pinTier: demo.tier,
                quickPinEnabled: true,
                lastPinChangedAt: new Date(),
                quickPinIssuedAt: new Date(),
                displayName: `${user.firstName} ${user.lastName}`,
                failedPinAttempts: 0,
                pinLockedUntil: null,
            },
        });
        console.log(`  ✅ Quick PIN set for "${demo.email}" (${demo.tier}, ${demo.pinLength}-digit)`);
        created++;
    }

    return { created, skipped };
}

// ── M4: OrgSettings Seed ──

const ORG_SETTINGS_DEFAULTS = {
    vatPercent: 18.00,
    currency: 'UGX',
    discountApprovalThreshold: 5000,
    reservationHoldMinutes: 30,
    showCostToChef: false,
    anomalyThresholds: { lateVoidMin: 5, heavyDiscountUGX: 5000 },
    rounding: { mode: 'NEAREST', increment: 100 },
    taxMatrix: { defaultVatPct: 18, categories: [] },
    platformAccess: { useRoleDefaults: true },
    attendance: { autoClockOutHours: 16 },
    inventoryTolerance: { variancePct: 2 },
};

async function seedOrgSettings(orgId: string): Promise<{ created: boolean }> {
    const existing = await prisma.orgSettings.findUnique({ where: { orgId } });
    if (existing) {
        console.log(`  ⏭  OrgSettings for org "${orgId}" already exists — skipped`);
        return { created: false };
    }

    await prisma.orgSettings.create({
        data: {
            orgId,
            vatPercent: ORG_SETTINGS_DEFAULTS.vatPercent,
            currency: ORG_SETTINGS_DEFAULTS.currency,
            discountApprovalThreshold: ORG_SETTINGS_DEFAULTS.discountApprovalThreshold,
            reservationHoldMinutes: ORG_SETTINGS_DEFAULTS.reservationHoldMinutes,
            showCostToChef: ORG_SETTINGS_DEFAULTS.showCostToChef,
            anomalyThresholds: ORG_SETTINGS_DEFAULTS.anomalyThresholds,
            rounding: ORG_SETTINGS_DEFAULTS.rounding,
            taxMatrix: ORG_SETTINGS_DEFAULTS.taxMatrix,
            platformAccess: ORG_SETTINGS_DEFAULTS.platformAccess,
            attendance: ORG_SETTINGS_DEFAULTS.attendance,
            inventoryTolerance: ORG_SETTINGS_DEFAULTS.inventoryTolerance,
        },
    });
    console.log(`  ✅ OrgSettings created for org "${orgId}"`);
    return { created: true };
}

async function seedExchangeRate(orgId: string, creatorEmail: string): Promise<{ created: boolean }> {
    // Check if any exchange rate already exists for this org
    const existing = await prisma.exchangeRate.findFirst({ where: { orgId } });
    if (existing) {
        console.log(`  ⏭  ExchangeRate for org already exists — skipped`);
        return { created: false };
    }

    const creator = await prisma.user.findUnique({ where: { email: creatorEmail } });

    await prisma.exchangeRate.create({
        data: {
            orgId,
            baseCurrencyCode: 'USD',
            quoteCurrencyCode: 'UGX',
            rate: 3700.000000,
            effectiveAt: new Date(),
            createdById: creator?.id ?? null,
        },
    });
    console.log(`  ✅ ExchangeRate USD/UGX seeded`);
    return { created: true };
}

// ── M5: Floor Plans + Tables Seed ──

import { TableStatus } from '@prisma/client';

const FLOOR_PLANS_SEED = [
    {
        name: 'Main Dining',
        data: {
            layout: 'grid',
            width: 800,
            height: 600,
            zones: [
                { name: 'Window Side', x: 0, y: 0, w: 400, h: 300 },
                { name: 'Center', x: 400, y: 0, w: 400, h: 600 },
            ],
        },
    },
    {
        name: 'Patio',
        data: {
            layout: 'freeform',
            width: 600,
            height: 400,
            zones: [{ name: 'Outdoor', x: 0, y: 0, w: 600, h: 400 }],
        },
    },
];

interface TableSeed {
    label: string;
    capacity: number;
    status: TableStatus;
    floorPlanName: string;
    metadata?: Record<string, unknown>;
}

const TABLES_SEED: TableSeed[] = [
    { label: 'T1', capacity: 4, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 50, y: 50, shape: 'round' } },
    { label: 'T2', capacity: 4, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 150, y: 50, shape: 'round' } },
    { label: 'T3', capacity: 2, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 250, y: 50, shape: 'square' } },
    { label: 'T4', capacity: 4, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 350, y: 50, shape: 'round' } },
    { label: 'T5', capacity: 6, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 450, y: 50, shape: 'rectangle' } },
    { label: 'T6', capacity: 4, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 550, y: 50, shape: 'round' } },
    { label: 'T7', capacity: 2, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 50, y: 200, shape: 'square' } },
    { label: 'T8', capacity: 4, status: TableStatus.OCCUPIED, floorPlanName: 'Main Dining', metadata: { x: 150, y: 200, shape: 'round' } },
    { label: 'T9', capacity: 6, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 250, y: 200, shape: 'rectangle' } },
    { label: 'T10', capacity: 8, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 350, y: 200, shape: 'rectangle' } },
    { label: 'VIP-1', capacity: 6, status: TableStatus.RESERVED, floorPlanName: 'Main Dining', metadata: { x: 550, y: 200, shape: 'booth' } },
    { label: 'VIP-2', capacity: 8, status: TableStatus.AVAILABLE, floorPlanName: 'Main Dining', metadata: { x: 650, y: 200, shape: 'booth' } },
    { label: 'P1', capacity: 4, status: TableStatus.AVAILABLE, floorPlanName: 'Patio', metadata: { x: 50, y: 50, shape: 'round' } },
    { label: 'P2', capacity: 4, status: TableStatus.AVAILABLE, floorPlanName: 'Patio', metadata: { x: 200, y: 50, shape: 'round' } },
    { label: 'P3', capacity: 2, status: TableStatus.CLEANING, floorPlanName: 'Patio', metadata: { x: 350, y: 50, shape: 'square' } },
];

async function seedFloorPlans(orgId: string, branchCode: string): Promise<{ floorPlanIds: Record<string, string>; created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const floorPlanIds: Record<string, string> = {};

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping floor plans`);
        return { floorPlanIds, created: 0, skipped: 0 };
    }

    for (const fp of FLOOR_PLANS_SEED) {
        const existing = await prisma.floorPlan.findFirst({
            where: { branchId: branch.id, orgId, name: fp.name },
        });
        if (existing) {
            console.log(`  ⏭  FloorPlan "${fp.name}" already exists — skipped`);
            floorPlanIds[fp.name] = existing.id;
            skipped++;
            continue;
        }

        const created_fp = await prisma.floorPlan.create({
            data: {
                orgId,
                branchId: branch.id,
                name: fp.name,
                data: fp.data as any,
            },
        });
        console.log(`  ✅ FloorPlan "${fp.name}" created`);
        floorPlanIds[fp.name] = created_fp.id;
        created++;
    }

    return { floorPlanIds, created, skipped };
}

async function seedTables(
    orgId: string,
    branchCode: string,
    floorPlanIds: Record<string, string>,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping tables`);
        return { created: 0, skipped: 0 };
    }

    for (const t of TABLES_SEED) {
        const existing = await prisma.table.findUnique({
            where: { branchId_label: { branchId: branch.id, label: t.label } },
        });
        if (existing) {
            console.log(`  ⏭  Table "${t.label}" already exists — skipped`);
            skipped++;
            continue;
        }

        const fpId = floorPlanIds[t.floorPlanName] ?? null;

        await prisma.table.create({
            data: {
                orgId,
                branchId: branch.id,
                floorPlanId: fpId,
                label: t.label,
                capacity: t.capacity,
                status: t.status,
                metadata: t.metadata ? (t.metadata as any) : undefined,
            },
        });
        console.log(`  ✅ Table "${t.label}" created (${t.floorPlanName}, cap=${t.capacity})`);
        created++;
    }

    return { created, skipped };
}

// ── Main Runner ──

async function main(): Promise<void> {
    console.log('\n🌱 Nimbus POS — Seed Runner\n');

    // 1) Seed AppConfig
    console.log('── AppConfig ──');
    const configResult = await seedAppConfig();
    console.log(`   Created: ${configResult.created}, Skipped: ${configResult.skipped}\n`);

    // 2) Seed Roles
    console.log('── Roles ──');
    const rolesResult = await seedRoles();
    console.log(`   Created: ${rolesResult.created}, Skipped: ${rolesResult.skipped}\n`);

    // 3) Seed Permissions
    console.log('── Permissions ──');
    const permsResult = await seedPermissions();
    console.log(`   Created: ${permsResult.created}, Skipped: ${permsResult.skipped}\n`);

    // 4) Seed RolePermissions
    console.log('── RolePermissions ──');
    const rpResult = await seedRolePermissions();
    console.log(`   Created: ${rpResult.created}, Skipped: ${rpResult.skipped}\n`);

    // 5) Seed Demo Users
    console.log('── Users ──');
    const usersResult = await seedUsers();
    console.log(`   Created: ${usersResult.created}, Skipped: ${usersResult.skipped}\n`);

    // 6) Seed Organization (M3)
    console.log('── Organization (M3) ──');
    const orgResult = await seedOrganization();
    console.log(`   Org ID: ${orgResult.orgId}, Created: ${orgResult.created}\n`);

    // 7) Seed Branches (M3)
    console.log('── Branches (M3) ──');
    const branchesResult = await seedBranches(orgResult.orgId);
    console.log(`   Created: ${branchesResult.created}, Skipped: ${branchesResult.skipped}\n`);

    // 8) Seed Memberships (M3)
    console.log('── Memberships (M3) ──');
    const membershipsResult = await seedMemberships(orgResult.orgId);
    console.log(`   Created: ${membershipsResult.created}, Skipped: ${membershipsResult.skipped}\n`);

    // 9) Seed Quick PINs (M3.1)
    console.log('── Quick PINs (M3.1) ──');
    const quickPinResult = await seedQuickPins(orgResult.orgId);
    console.log(`   Created: ${quickPinResult.created}, Skipped: ${quickPinResult.skipped}\n`);

    // 10) Seed OrgSettings (M4)
    console.log('── OrgSettings (M4) ──');
    const settingsResult = await seedOrgSettings(orgResult.orgId);
    console.log(`   Created: ${settingsResult.created ? 1 : 0}\n`);

    // 11) Seed ExchangeRate (M4)
    console.log('── ExchangeRate (M4) ──');
    const exchangeRateResult = await seedExchangeRate(orgResult.orgId, 'owner@demo.local');
    console.log(`   Created: ${exchangeRateResult.created ? 1 : 0}\n`);

    // 12) Seed Floor Plans (M5)
    console.log('── Floor Plans (M5) ──');
    const floorResult = await seedFloorPlans(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${floorResult.created}, Skipped: ${floorResult.skipped}\n`);

    // 13) Seed Tables (M5)
    console.log('── Tables (M5) ──');
    const tablesResult = await seedTables(orgResult.orgId, 'MAIN', floorResult.floorPlanIds);
    console.log(`   Created: ${tablesResult.created}, Skipped: ${tablesResult.skipped}\n`);

    // 14) Record seed execution
    await recordSeedRun(
        'm1-baseline',
        `AppConfig: ${configResult.created} created, ${configResult.skipped} skipped`,
    );
    await recordSeedRun(
        'm2-auth-rbac',
        `Roles: ${rolesResult.created}c/${rolesResult.skipped}s | Perms: ${permsResult.created}c/${permsResult.skipped}s | RolePerms: ${rpResult.created}c/${rpResult.skipped}s | Users: ${usersResult.created}c/${usersResult.skipped}s`,
    );
    await recordSeedRun(
        'm3-tenancy',
        `Org: ${orgResult.created ? 1 : 0}c | Branches: ${branchesResult.created}c/${branchesResult.skipped}s | Memberships: ${membershipsResult.created}c/${membershipsResult.skipped}s`,
    );
    await recordSeedRun(
        'm3.1-quick-pin',
        `QuickPINs: ${quickPinResult.created}c/${quickPinResult.skipped}s`,
    );
    await recordSeedRun(
        'm4-org-settings',
        `OrgSettings: ${settingsResult.created ? 1 : 0}c | ExchangeRate: ${exchangeRateResult.created ? 1 : 0}c`,
    );
    await recordSeedRun(
        'm5-floor-plans-tables',
        `FloorPlans: ${floorResult.created}c/${floorResult.skipped}s | Tables: ${tablesResult.created}c/${tablesResult.skipped}s`,
    );
    console.log('── SeedHistory markers recorded ──\n');

    console.log('🌱 Seed complete.\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
