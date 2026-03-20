import { PrismaClient, RoleLevel, JobRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

// ── Baseline AppConfig rows ──
const APP_CONFIG_DEFAULTS: { key: string; value: string }[] = [
    { key: 'app.name', value: 'Nimbus POS' },
    { key: 'app.version', value: '0.2.0' },
    { key: 'app.milestone', value: 'M2' },
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
    ],
    Manager: [
        'identity:user:read',
        'identity:user:write',
        'identity:session:read',
        'identity:session:revoke',
        'identity:access-matrix:read',
    ],
    Accountant: [
        'identity:user:read',
        'identity:session:read',
        'identity:access-matrix:read',
    ],
    Supervisor: [
        'identity:user:read',
        'identity:session:read',
        'identity:access-matrix:read',
    ],
    Cashier: ['identity:user:read'],
    Chef: ['identity:user:read'],
    Waiter: ['identity:user:read'],
    Bartender: ['identity:user:read'],
    Procurement: ['identity:user:read', 'identity:session:read'],
    'Stock Manager': ['identity:user:read', 'identity:session:read'],
    'Event Manager': ['identity:user:read', 'identity:session:read'],
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

    // 6) Record seed execution
    await recordSeedRun(
        'm1-baseline',
        `AppConfig: ${configResult.created} created, ${configResult.skipped} skipped`,
    );
    await recordSeedRun(
        'm2-auth-rbac',
        `Roles: ${rolesResult.created}c/${rolesResult.skipped}s | Perms: ${permsResult.created}c/${permsResult.skipped}s | RolePerms: ${rpResult.created}c/${rpResult.skipped}s | Users: ${usersResult.created}c/${usersResult.skipped}s`,
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
