import { PrismaClient, RoleLevel, JobRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

// ── Baseline AppConfig rows ──
const APP_CONFIG_DEFAULTS: { key: string; value: string }[] = [
    { key: 'app.name', value: 'Nimbus POS' },
    { key: 'app.version', value: '0.9.0' },
    { key: 'app.milestone', value: 'M11' },
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
    {
        name: 'Owner',
        level: RoleLevel.L5,
        jobRole: JobRole.OWNER,
        description: 'Full system access — platform owner',
    },
    {
        name: 'Manager',
        level: RoleLevel.L4,
        jobRole: JobRole.MANAGER,
        description: 'Branch management — day-to-day operations',
    },
    {
        name: 'Accountant',
        level: RoleLevel.L4,
        jobRole: JobRole.ACCOUNTANT,
        description: 'Financial access — reporting and accounting',
    },
    {
        name: 'Supervisor',
        level: RoleLevel.L3,
        jobRole: JobRole.SUPERVISOR,
        description: 'Floor supervisor — overrides and approvals',
    },
    {
        name: 'Cashier',
        level: RoleLevel.L2,
        jobRole: JobRole.CASHIER,
        description: 'POS operations — orders and payments',
    },
    {
        name: 'Chef',
        level: RoleLevel.L2,
        jobRole: JobRole.CHEF,
        description: 'Kitchen operations — KDS and prep',
    },
    {
        name: 'Waiter',
        level: RoleLevel.L1,
        jobRole: JobRole.WAITER,
        description: 'Floor service — order taking',
    },
    {
        name: 'Bartender',
        level: RoleLevel.L2,
        jobRole: JobRole.BARTENDER,
        description: 'Bar operations — drinks and service',
    },
    {
        name: 'Procurement',
        level: RoleLevel.L3,
        jobRole: JobRole.PROCUREMENT,
        description: 'Purchasing — suppliers and orders',
    },
    {
        name: 'Stock Manager',
        level: RoleLevel.L3,
        jobRole: JobRole.STOCK_MANAGER,
        description: 'Inventory management — counts and adjustments',
    },
    {
        name: 'Event Manager',
        level: RoleLevel.L3,
        jobRole: JobRole.EVENT_MANAGER,
        description: 'Events and bookings — reservations',
    },
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
    // M6 menu + tax permissions
    { action: 'pos:menu:read', description: 'Read menu categories and items' },
    { action: 'pos:menu:write', description: 'Create/update menu categories and items' },
    { action: 'pos:tax:read', description: 'Read tax categories' },
    { action: 'pos:tax:write', description: 'Create/update tax categories' },
    // M8 recipe + cost permissions
    { action: 'pos:recipe:read', description: 'Read recipes and ingredient lists' },
    { action: 'pos:recipe:write', description: 'Create/update recipes' },
    { action: 'pos:cost:read', description: 'Read recipe cost breakdowns' },
    // M9 inventory + stock permissions
    { action: 'pos:inventory:read', description: 'Read inventory levels and stock batches' },
    { action: 'pos:inventory:write', description: 'Create/update stock batches' },
    { action: 'pos:inventory:adjust', description: 'Create stock adjustments' },
    // M10 POS order permissions
    { action: 'pos:orders:read', description: 'Read orders' },
    { action: 'pos:orders:write', description: 'Create/update orders and items' },
    { action: 'pos:orders:close', description: 'Close orders' },
    { action: 'pos:orders:void', description: 'Void orders' },
    // M11 KDS permissions
    { action: 'pos:kds:read', description: 'Read KDS queue and tickets' },
    { action: 'pos:kds:write', description: 'Mark ready / recall KDS tickets' },
    { action: 'pos:kds:sla:write', description: 'Update KDS SLA configuration' },
    // M12 discount permissions
    { action: 'pos:discount:request', description: 'Request a discount on an order' },
    { action: 'pos:discount:approve', description: 'Approve or reject pending discounts' },
    { action: 'pos:discount:read', description: 'Read discount records' },
    // M13 payment permissions
    { action: 'pos:payment:create', description: 'Create payment records on orders' },
    { action: 'pos:payment:close', description: 'Close orders with payment' },
    { action: 'pos:payment:intent', description: 'Create/cancel MOMO payment intents' },
    { action: 'pos:payment:read', description: 'Read payment and intent records' },
    // M13.1 payment permissions
    { action: 'pos:payment:manual-reference', description: 'Record manual reference payments (offline fallback)' },
    { action: 'pos:payment:cancel', description: 'Cancel pending MOMO payment intents' },
    { action: 'pos:payment:override', description: 'Override payment verification status' },
    // M14 refund + void permissions
    { action: 'pos:refund:create', description: 'Request a refund on a closed order' },
    { action: 'pos:refund:approve', description: 'Approve pending high-value refunds' },
    { action: 'pos:refund:read', description: 'Read refund records' },
    { action: 'pos:void:postclose', description: 'Void a recently-closed order (post-close void)' },
    // M15 shift + till + cash reconciliation permissions
    { action: 'pos:shift:open', description: 'Open a new shift' },
    { action: 'pos:shift:close', description: 'Close an active shift' },
    { action: 'pos:shift:read', description: 'Read shift records and summaries' },
    { action: 'pos:till:open', description: 'Open a till session' },
    { action: 'pos:till:reconcile', description: 'Reconcile and close a till session' },
    { action: 'pos:till:safe-drop', description: 'Perform a safe drop on an open till' },
    { action: 'pos:till:read', description: 'Read till sessions and summaries' },
    // M16 reservations + deposits + seating permissions
    { action: 'pos:reservation:create', description: 'Create a new reservation' },
    { action: 'pos:reservation:read', description: 'Read reservations and events' },
    { action: 'pos:reservation:confirm', description: 'Confirm a pending reservation' },
    { action: 'pos:reservation:seat', description: 'Seat a confirmed reservation' },
    { action: 'pos:reservation:cancel', description: 'Cancel a reservation' },
    { action: 'pos:reservation:no-show', description: 'Mark a reservation as no-show' },
    { action: 'pos:reservation:deposit:record', description: 'Record a deposit for a reservation' },
    { action: 'pos:reservation:deposit:read', description: 'Read deposits for a reservation' },
    { action: 'pos:reservation:update', description: 'Update reservation details' },
    { action: 'pos:reservation:table:assign', description: 'Assign a table to a reservation' },
    // ── M17: Events + Booking Portal + Ticketing ──
    { action: 'pos:event:create', description: 'Create a new event' },
    { action: 'pos:event:read', description: 'Read events and event details' },
    { action: 'pos:event:update', description: 'Update event details' },
    { action: 'pos:event:publish', description: 'Publish a draft event' },
    { action: 'pos:event:close', description: 'Close an open event' },
    { action: 'pos:event:booking:create', description: 'Create a booking for an event' },
    { action: 'pos:event:booking:read', description: 'Read event bookings' },
    { action: 'pos:event:booking:cancel', description: 'Cancel an event booking' },
    { action: 'pos:event:ticket:issue', description: 'Issue tickets for a booking' },
    { action: 'pos:event:ticket:read', description: 'Read event tickets' },
    { action: 'pos:event:checkin', description: 'Check in a ticket at an event' },
    { action: 'pos:event:portal:read', description: 'Access event portal data' },
    // ── M18: Anomaly Detection + Anti-Theft Signals ──
    { action: 'pos:analytics:anomalies:read', description: 'Read anomaly events and history' },
    { action: 'pos:analytics:anomaly-rules:create', description: 'Create anomaly detection rules' },
    { action: 'pos:analytics:anomaly-rules:update', description: 'Update anomaly detection rules' },
    { action: 'pos:analytics:anomalies:acknowledge', description: 'Acknowledge or resolve anomaly events' },
    { action: 'pos:analytics:risk-dashboard:read', description: 'View staff risk dashboard and snapshots' },
    { action: 'pos:analytics:anomalies:recalculate', description: 'Trigger anomaly recalculation for a branch' },
    { action: 'pos:analytics:thresholds:read', description: 'Read risk threshold configuration' },
    { action: 'pos:analytics:thresholds:update', description: 'Update risk threshold configuration' },
    // ── M19: Operational Dashboards + KPI Streams ──
    { action: 'pos:dash:owner:read', description: 'Read owner-level dashboard' },
    { action: 'pos:dash:manager:read', description: 'Read manager-level dashboard' },
    { action: 'pos:dash:today-summary:read', description: 'Read today summary + payment mix + open orders + low stock' },
    { action: 'pos:dash:stream:read', description: 'Subscribe to live metric SSE stream' },
    { action: 'pos:dash:kpi:refresh', description: 'Trigger a manual KPI snapshot refresh' },
    // ── M20: Reporting v1 + Exports ──
    { action: 'pos:reports:shift-end:generate', description: 'Generate shift-end report' },
    { action: 'pos:reports:daily-sales:generate', description: 'Generate daily sales report' },
    { action: 'pos:reports:payment-mix:generate', description: 'Generate payment mix report' },
    { action: 'pos:reports:top-items:generate', description: 'Generate top items report' },
    { action: 'pos:reports:stock-variance:generate', description: 'Generate stock variance report' },
    { action: 'pos:reports:anomaly-summary:generate', description: 'Generate anomaly summary report' },
    { action: 'pos:reports:reservation-summary:generate', description: 'Generate reservation summary report' },
    { action: 'pos:reports:event-summary:generate', description: 'Generate event summary report' },
    { action: 'pos:reports:exports:read', description: 'Create export artifacts from reports' },
    { action: 'pos:reports:exports:download', description: 'Download export artifacts' },
    { action: 'pos:reports:history:read', description: 'List and view report run history' },
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
        'pos:menu:read',
        'pos:menu:write',
        'pos:tax:read',
        'pos:tax:write',
        'pos:recipe:read',
        'pos:recipe:write',
        'pos:cost:read',
        'pos:inventory:read',
        'pos:inventory:write',
        'pos:inventory:adjust',
        'pos:orders:read',
        'pos:orders:write',
        'pos:orders:close',
        'pos:orders:void',
        'pos:kds:read',
        'pos:kds:write',
        'pos:kds:sla:write',
        'pos:discount:request',
        'pos:discount:approve',
        'pos:discount:read',
        'pos:payment:create',
        'pos:payment:close',
        'pos:payment:intent',
        'pos:payment:read',
        'pos:payment:manual-reference',
        'pos:payment:cancel',
        'pos:payment:override',
        'pos:refund:create',
        'pos:refund:approve',
        'pos:refund:read',
        'pos:void:postclose',
        'pos:shift:open',
        'pos:shift:close',
        'pos:shift:read',
        'pos:till:open',
        'pos:till:reconcile',
        'pos:till:safe-drop',
        'pos:till:read',
        'pos:reservation:create',
        'pos:reservation:read',
        'pos:reservation:confirm',
        'pos:reservation:seat',
        'pos:reservation:cancel',
        'pos:reservation:no-show',
        'pos:reservation:deposit:record',
        'pos:reservation:deposit:read',
        'pos:reservation:update',
        'pos:reservation:table:assign',
        'pos:event:create',
        'pos:event:read',
        'pos:event:update',
        'pos:event:publish',
        'pos:event:close',
        'pos:event:booking:create',
        'pos:event:booking:read',
        'pos:event:booking:cancel',
        'pos:event:ticket:issue',
        'pos:event:ticket:read',
        'pos:event:checkin',
        'pos:event:portal:read',
        // M18: Anomaly Detection + Anti-Theft
        'pos:analytics:anomalies:read',
        'pos:analytics:anomaly-rules:create',
        'pos:analytics:anomaly-rules:update',
        'pos:analytics:anomalies:acknowledge',
        'pos:analytics:risk-dashboard:read',
        'pos:analytics:anomalies:recalculate',
        'pos:analytics:thresholds:read',
        'pos:analytics:thresholds:update',
        // M19: Operational Dashboards + KPI Streams
        'pos:dash:owner:read',
        'pos:dash:manager:read',
        'pos:dash:today-summary:read',
        'pos:dash:stream:read',
        'pos:dash:kpi:refresh',
        // M20: Reporting v1 + Exports
        'pos:reports:shift-end:generate',
        'pos:reports:daily-sales:generate',
        'pos:reports:payment-mix:generate',
        'pos:reports:top-items:generate',
        'pos:reports:stock-variance:generate',
        'pos:reports:anomaly-summary:generate',
        'pos:reports:reservation-summary:generate',
        'pos:reports:event-summary:generate',
        'pos:reports:exports:read',
        'pos:reports:exports:download',
        'pos:reports:history:read',
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
        'pos:menu:read',
        'pos:menu:write',
        'pos:tax:read',
        'pos:tax:write',
        'pos:recipe:read',
        'pos:recipe:write',
        'pos:cost:read',
        'pos:inventory:read',
        'pos:inventory:write',
        'pos:inventory:adjust',
        'pos:orders:read',
        'pos:orders:write',
        'pos:orders:close',
        'pos:orders:void',
        'pos:kds:read',
        'pos:kds:write',
        'pos:kds:sla:write',
        'pos:discount:request',
        'pos:discount:approve',
        'pos:discount:read',
        'pos:payment:create',
        'pos:payment:close',
        'pos:payment:intent',
        'pos:payment:read',
        'pos:payment:manual-reference',
        'pos:payment:cancel',
        'pos:payment:override',
        'pos:refund:create',
        'pos:refund:approve',
        'pos:refund:read',
        'pos:void:postclose',
        'pos:shift:open',
        'pos:shift:close',
        'pos:shift:read',
        'pos:till:open',
        'pos:till:reconcile',
        'pos:till:safe-drop',
        'pos:till:read',
        'pos:reservation:create',
        'pos:reservation:read',
        'pos:reservation:confirm',
        'pos:reservation:seat',
        'pos:reservation:cancel',
        'pos:reservation:no-show',
        'pos:reservation:deposit:record',
        'pos:reservation:deposit:read',
        'pos:reservation:update',
        'pos:reservation:table:assign',
        'pos:event:create',
        'pos:event:read',
        'pos:event:update',
        'pos:event:publish',
        'pos:event:close',
        'pos:event:booking:create',
        'pos:event:booking:read',
        'pos:event:booking:cancel',
        'pos:event:ticket:issue',
        'pos:event:ticket:read',
        'pos:event:checkin',
        'pos:event:portal:read',
        // M18: Anomaly Detection + Anti-Theft
        'pos:analytics:anomalies:read',
        'pos:analytics:anomaly-rules:create',
        'pos:analytics:anomaly-rules:update',
        'pos:analytics:anomalies:acknowledge',
        'pos:analytics:risk-dashboard:read',
        'pos:analytics:anomalies:recalculate',
        'pos:analytics:thresholds:read',
        'pos:analytics:thresholds:update',
        // M19: Operational Dashboards + KPI Streams
        'pos:dash:manager:read',
        'pos:dash:today-summary:read',
        'pos:dash:stream:read',
        'pos:dash:kpi:refresh',
        // M20: Reporting v1 + Exports (Manager: all generate + read + download)
        'pos:reports:shift-end:generate',
        'pos:reports:daily-sales:generate',
        'pos:reports:payment-mix:generate',
        'pos:reports:top-items:generate',
        'pos:reports:stock-variance:generate',
        'pos:reports:anomaly-summary:generate',
        'pos:reports:reservation-summary:generate',
        'pos:reports:event-summary:generate',
        'pos:reports:exports:read',
        'pos:reports:exports:download',
        'pos:reports:history:read',
    ],
    Accountant: [
        'identity:user:read',
        'identity:session:read',
        'identity:access-matrix:read',
        'tenancy:org:read',
        'tenancy:branch:read',
        'pos:discount:read',
        'pos:payment:read',
        'pos:refund:read',
        'pos:shift:read',
        'pos:till:read',
        'pos:reservation:read',
        'pos:reservation:deposit:read',
        'pos:event:read',
        'pos:event:booking:read',
        'pos:event:ticket:read',
        // M18: Anomaly Detection + Anti-Theft (read-only for Accountant)
        'pos:analytics:anomalies:read',
        'pos:analytics:risk-dashboard:read',
        'pos:analytics:thresholds:read',
        // M19: Dashboards (read-only for Accountant)
        'pos:dash:today-summary:read',
        // M20: Reporting (Accountant: history + exports + download)
        'pos:reports:daily-sales:generate',
        'pos:reports:payment-mix:generate',
        'pos:reports:exports:read',
        'pos:reports:exports:download',
        'pos:reports:history:read',
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
        'pos:menu:read',
        'pos:menu:write',
        'pos:tax:read',
        'pos:tax:write',
        'pos:recipe:read',
        'pos:recipe:write',
        'pos:cost:read',
        'pos:inventory:read',
        'pos:inventory:write',
        'pos:inventory:adjust',
        'pos:orders:read',
        'pos:orders:write',
        'pos:orders:close',
        'pos:orders:void',
        'pos:kds:read',
        'pos:kds:write',
        'pos:kds:sla:write',
        'pos:discount:request',
        'pos:discount:approve',
        'pos:discount:read',
        'pos:payment:create',
        'pos:payment:close',
        'pos:payment:intent',
        'pos:payment:read',
        'pos:payment:manual-reference',
        'pos:payment:cancel',
        'pos:payment:override',
        'pos:refund:create',
        'pos:refund:approve',
        'pos:refund:read',
        'pos:void:postclose',
        'pos:shift:open',
        'pos:shift:close',
        'pos:shift:read',
        'pos:till:open',
        'pos:till:reconcile',
        'pos:till:safe-drop',
        'pos:till:read',
        'pos:reservation:create',
        'pos:reservation:read',
        'pos:reservation:confirm',
        'pos:reservation:seat',
        'pos:reservation:cancel',
        'pos:reservation:no-show',
        'pos:reservation:deposit:record',
        'pos:reservation:deposit:read',
        'pos:reservation:update',
        'pos:reservation:table:assign',
        'pos:event:create',
        'pos:event:read',
        'pos:event:update',
        'pos:event:publish',
        'pos:event:close',
        'pos:event:booking:create',
        'pos:event:booking:read',
        'pos:event:booking:cancel',
        'pos:event:ticket:issue',
        'pos:event:ticket:read',
        'pos:event:checkin',
        'pos:event:portal:read',
        // M18: Anomaly Detection + Anti-Theft (Supervisor: read + acknowledge + recalculate)
        'pos:analytics:anomalies:read',
        'pos:analytics:anomalies:acknowledge',
        'pos:analytics:risk-dashboard:read',
        'pos:analytics:anomalies:recalculate',
        'pos:analytics:thresholds:read',
        // M19: Operational Dashboards (Supervisor: manager + today-summary + stream)
        'pos:dash:manager:read',
        'pos:dash:today-summary:read',
        'pos:dash:stream:read',
        // M20: Reporting (Supervisor: shift-end + daily-sales + top-items + history + exports)
        'pos:reports:shift-end:generate',
        'pos:reports:daily-sales:generate',
        'pos:reports:top-items:generate',
        'pos:reports:exports:read',
        'pos:reports:exports:download',
        'pos:reports:history:read',
    ],
    Cashier: [
        'identity:user:read',
        'tenancy:branch:read',
        'pos:floor:read',
        'pos:table:read',
        'pos:menu:read',
        'pos:tax:read',
        'pos:inventory:read',
        'pos:orders:read',
        'pos:orders:write',
        'pos:kds:read',
        'pos:kds:write',
        'pos:discount:request',
        'pos:discount:read',
        'pos:payment:create',
        'pos:payment:close',
        'pos:payment:intent',
        'pos:payment:read',
        'pos:payment:manual-reference',
        'pos:payment:cancel',
        'pos:refund:create',
        'pos:refund:read',
        'pos:shift:open',
        'pos:shift:close',
        'pos:shift:read',
        'pos:till:open',
        'pos:till:reconcile',
        'pos:till:safe-drop',
        'pos:till:read',
        'pos:reservation:create',
        'pos:reservation:read',
        'pos:reservation:confirm',
        'pos:reservation:seat',
        'pos:reservation:deposit:record',
        'pos:reservation:deposit:read',
        'pos:reservation:table:assign',
        'pos:event:read',
        'pos:event:booking:create',
        'pos:event:booking:read',
        'pos:event:ticket:issue',
        'pos:event:ticket:read',
        'pos:event:checkin',
        'pos:event:portal:read',
    ],
    Chef: [
        'identity:user:read',
        'tenancy:branch:read',
        'pos:floor:read',
        'pos:table:read',
        'pos:menu:read',
        'pos:tax:read',
        'pos:recipe:read',
        'pos:cost:read',
        'pos:inventory:read',
        'pos:orders:read',
        'pos:kds:read',
        'pos:kds:write',
        'pos:discount:read',
        'pos:payment:read',
        'pos:refund:read',
        'pos:shift:read',
        'pos:till:read',
        'pos:reservation:read',
        'pos:event:read',
    ],
    Waiter: [
        'identity:user:read',
        'tenancy:branch:read',
        'pos:floor:read',
        'pos:table:read',
        'pos:menu:read',
        'pos:tax:read',
        'pos:inventory:read',
        'pos:orders:read',
        'pos:orders:write',
        'pos:kds:read',
        'pos:kds:write',
        'pos:discount:request',
        'pos:discount:read',
        'pos:payment:create',
        'pos:payment:intent',
        'pos:payment:manual-reference',
        'pos:payment:read',
        'pos:refund:create',
        'pos:refund:read',
        'pos:shift:open',
        'pos:shift:close',
        'pos:shift:read',
        'pos:till:open',
        'pos:till:reconcile',
        'pos:till:safe-drop',
        'pos:till:read',
        'pos:reservation:create',
        'pos:reservation:read',
        'pos:reservation:confirm',
        'pos:reservation:seat',
        'pos:reservation:deposit:record',
        'pos:reservation:deposit:read',
        'pos:reservation:table:assign',
        'pos:event:read',
        'pos:event:booking:create',
        'pos:event:booking:read',
        'pos:event:ticket:issue',
        'pos:event:ticket:read',
        'pos:event:checkin',
        'pos:event:portal:read',
    ],
    Bartender: [
        'identity:user:read',
        'tenancy:branch:read',
        'pos:floor:read',
        'pos:table:read',
        'pos:menu:read',
        'pos:tax:read',
        'pos:inventory:read',
        'pos:orders:read',
        'pos:kds:read',
        'pos:kds:write',
        'pos:discount:read',
        'pos:payment:read',
        'pos:refund:read',
        'pos:shift:read',
        'pos:till:read',
        'pos:reservation:read',
        'pos:event:read',
    ],
    Procurement: [
        'identity:user:read',
        'identity:session:read',
        'tenancy:org:read',
        'tenancy:branch:read',
    ],
    'Stock Manager': [
        'identity:user:read',
        'identity:session:read',
        'tenancy:org:read',
        'tenancy:branch:read',
        'pos:inventory:read',
        'pos:inventory:write',
        'pos:inventory:adjust',
    ],
    'Event Manager': [
        'identity:user:read',
        'identity:session:read',
        'tenancy:org:read',
        'tenancy:branch:read',
        'pos:reservation:create',
        'pos:reservation:read',
        'pos:reservation:confirm',
        'pos:reservation:seat',
        'pos:reservation:cancel',
        'pos:reservation:no-show',
        'pos:reservation:deposit:record',
        'pos:reservation:deposit:read',
        'pos:reservation:update',
        'pos:reservation:table:assign',
    ],
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
    {
        email: 'owner@demo.local',
        password: 'Owner#123',
        pin: '1234',
        firstName: 'Demo',
        lastName: 'Owner',
        roleName: 'Owner',
    },
    {
        email: 'manager@demo.local',
        password: 'Manager#123',
        pin: '2345',
        firstName: 'Demo',
        lastName: 'Manager',
        roleName: 'Manager',
    },
    {
        email: 'accountant@demo.local',
        password: 'Accountant#123',
        pin: '6789',
        firstName: 'Demo',
        lastName: 'Accountant',
        roleName: 'Accountant',
    },
    {
        email: 'cashier@demo.local',
        password: 'Cashier#123',
        pin: '3456',
        firstName: 'Demo',
        lastName: 'Cashier',
        roleName: 'Cashier',
    },
    {
        email: 'chef@demo.local',
        password: 'Chef#123',
        pin: '4567',
        firstName: 'Demo',
        lastName: 'Chef',
        roleName: 'Chef',
    },
    {
        email: 'waiter@demo.local',
        password: 'Waiter#123',
        pin: '5678',
        firstName: 'Demo',
        lastName: 'Waiter',
        roleName: 'Waiter',
    },
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
    {
        name: 'Downtown Branch',
        code: 'DOWNTOWN',
        slug: 'downtown',
        timezone: 'UTC',
        currencyCode: 'USD',
    },
];

// owner + manager → both branches, accountant → both branches (org visibility)
// cashier, chef, waiter → Main Branch only
const MEMBERSHIP_SEED: {
    email: string;
    roleName: string;
    branchCodes: string[];
    defaultBranch: string;
}[] = [
        {
            email: 'owner@demo.local',
            roleName: 'Owner',
            branchCodes: ['MAIN', 'DOWNTOWN'],
            defaultBranch: 'MAIN',
        },
        {
            email: 'manager@demo.local',
            roleName: 'Manager',
            branchCodes: ['MAIN', 'DOWNTOWN'],
            defaultBranch: 'MAIN',
        },
        {
            email: 'accountant@demo.local',
            roleName: 'Accountant',
            branchCodes: ['MAIN', 'DOWNTOWN'],
            defaultBranch: 'MAIN',
        },
        {
            email: 'cashier@demo.local',
            roleName: 'Cashier',
            branchCodes: ['MAIN'],
            defaultBranch: 'MAIN',
        },
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
            console.log(
                `  ✅ Membership: "${ms.email}" → "${branch.name}" (${ms.roleName})${isDefault ? ' [default]' : ''}`,
            );
            created++;
        }
    }

    return { created, skipped };
}

// ── M3.1: Quick PIN Seed ──

const QUICK_PIN_PEPPER = process.env.QUICK_PIN_PEPPER || 'nimbus-dev-pin-pepper';

// Deterministic demo PINs for testing (NOT used in production)
const DEMO_QUICK_PINS: {
    email: string;
    pin: string;
    tier: 'LOW_6' | 'HIGH_8';
    pinLength: number;
}[] = [
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
    vatPercent: 18.0,
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

async function seedExchangeRate(
    orgId: string,
    creatorEmail: string,
): Promise<{ created: boolean }> {
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
            rate: 3700.0,
            effectiveAt: new Date(),
            createdById: creator?.id ?? null,
        },
    });
    console.log(`  ✅ ExchangeRate USD/UGX seeded`);
    return { created: true };
}

// ── M5: Floor Plans + Tables Seed ──

import { TableStatus, MenuItemType, PrepStation, MenuSection, ServingFormat, OrderStatus, ServiceType } from '@prisma/client';

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
    {
        label: 'T1',
        capacity: 4,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 50, y: 50, shape: 'round' },
    },
    {
        label: 'T2',
        capacity: 4,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 150, y: 50, shape: 'round' },
    },
    {
        label: 'T3',
        capacity: 2,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 250, y: 50, shape: 'square' },
    },
    {
        label: 'T4',
        capacity: 4,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 350, y: 50, shape: 'round' },
    },
    {
        label: 'T5',
        capacity: 6,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 450, y: 50, shape: 'rectangle' },
    },
    {
        label: 'T6',
        capacity: 4,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 550, y: 50, shape: 'round' },
    },
    {
        label: 'T7',
        capacity: 2,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 50, y: 200, shape: 'square' },
    },
    {
        label: 'T8',
        capacity: 4,
        status: TableStatus.OCCUPIED,
        floorPlanName: 'Main Dining',
        metadata: { x: 150, y: 200, shape: 'round' },
    },
    {
        label: 'T9',
        capacity: 6,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 250, y: 200, shape: 'rectangle' },
    },
    {
        label: 'T10',
        capacity: 8,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 350, y: 200, shape: 'rectangle' },
    },
    {
        label: 'VIP-1',
        capacity: 6,
        status: TableStatus.RESERVED,
        floorPlanName: 'Main Dining',
        metadata: { x: 550, y: 200, shape: 'booth' },
    },
    {
        label: 'VIP-2',
        capacity: 8,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Main Dining',
        metadata: { x: 650, y: 200, shape: 'booth' },
    },
    {
        label: 'P1',
        capacity: 4,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Patio',
        metadata: { x: 50, y: 50, shape: 'round' },
    },
    {
        label: 'P2',
        capacity: 4,
        status: TableStatus.AVAILABLE,
        floorPlanName: 'Patio',
        metadata: { x: 200, y: 50, shape: 'round' },
    },
    {
        label: 'P3',
        capacity: 2,
        status: TableStatus.CLEANING,
        floorPlanName: 'Patio',
        metadata: { x: 350, y: 50, shape: 'square' },
    },
];

async function seedFloorPlans(
    orgId: string,
    branchCode: string,
): Promise<{ floorPlanIds: Record<string, string>; created: number; skipped: number }> {
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

// ── M6: Menu Catalog Seed ──

const CATEGORIES_SEED = [
    { name: 'Starters', sortOrder: 0 },
    { name: 'Mains', sortOrder: 1 },
    { name: 'Desserts', sortOrder: 2 },
    { name: 'Drinks', sortOrder: 3 },
    { name: 'Sides', sortOrder: 4 },
];

const TAX_CATEGORIES_SEED = [
    { name: 'VAT Standard', rate: 18.0 },
    { name: 'VAT Zero', rate: 0.0 },
];

interface MenuItemSeed {
    name: string;
    categoryName: string;
    taxCategoryName: string;
    price: number;
    itemType: MenuItemType;
    station: PrepStation;
    sortOrder: number;
    description?: string;
    sku?: string;
}

const MENU_ITEMS_SEED: MenuItemSeed[] = [
    // Starters
    {
        name: 'Bruschetta',
        categoryName: 'Starters',
        taxCategoryName: 'VAT Standard',
        price: 8.5,
        itemType: MenuItemType.FOOD,
        station: PrepStation.COLD_KITCHEN,
        sortOrder: 0,
        description: 'Toasted bread with tomato and basil',
    },
    {
        name: 'Chicken Wings',
        categoryName: 'Starters',
        taxCategoryName: 'VAT Standard',
        price: 12.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.KITCHEN,
        sortOrder: 1,
        description: 'Crispy wings with hot sauce',
    },
    {
        name: 'Caesar Salad',
        categoryName: 'Starters',
        taxCategoryName: 'VAT Standard',
        price: 10.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.COLD_KITCHEN,
        sortOrder: 2,
        description: 'Romaine lettuce with Caesar dressing',
    },
    {
        name: 'Garlic Bread',
        categoryName: 'Starters',
        taxCategoryName: 'VAT Standard',
        price: 6.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.KITCHEN,
        sortOrder: 3,
    },
    // Mains
    {
        name: 'Grilled Chicken',
        categoryName: 'Mains',
        taxCategoryName: 'VAT Standard',
        price: 22.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.KITCHEN,
        sortOrder: 0,
        description: 'Half grilled chicken with herbs',
    },
    {
        name: 'Beef Burger',
        categoryName: 'Mains',
        taxCategoryName: 'VAT Standard',
        price: 18.5,
        itemType: MenuItemType.FOOD,
        station: PrepStation.KITCHEN,
        sortOrder: 1,
        description: 'Angus beef patty with fries',
    },
    {
        name: 'Pasta Alfredo',
        categoryName: 'Mains',
        taxCategoryName: 'VAT Standard',
        price: 16.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.KITCHEN,
        sortOrder: 2,
        description: 'Fettuccine in creamy Alfredo sauce',
    },
    {
        name: 'Grilled Salmon',
        categoryName: 'Mains',
        taxCategoryName: 'VAT Standard',
        price: 26.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.KITCHEN,
        sortOrder: 3,
        description: 'Atlantic salmon with lemon butter',
    },
    {
        name: 'Margherita Pizza',
        categoryName: 'Mains',
        taxCategoryName: 'VAT Standard',
        price: 14.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.KITCHEN,
        sortOrder: 4,
        description: 'Classic tomato, mozzarella, basil',
    },
    // Desserts
    {
        name: 'Cheesecake',
        categoryName: 'Desserts',
        taxCategoryName: 'VAT Standard',
        price: 9.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.DESSERT,
        sortOrder: 0,
        description: 'New York style cheesecake',
    },
    {
        name: 'Chocolate Brownie',
        categoryName: 'Desserts',
        taxCategoryName: 'VAT Standard',
        price: 8.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.DESSERT,
        sortOrder: 1,
        description: 'Warm brownie with vanilla ice cream',
    },
    {
        name: 'Tiramisu',
        categoryName: 'Desserts',
        taxCategoryName: 'VAT Standard',
        price: 10.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.DESSERT,
        sortOrder: 2,
        description: 'Classic Italian coffee dessert',
    },
    // Drinks
    {
        name: 'Cola',
        categoryName: 'Drinks',
        taxCategoryName: 'VAT Zero',
        price: 3.5,
        itemType: MenuItemType.DRINK,
        station: PrepStation.BAR,
        sortOrder: 0,
    },
    {
        name: 'Orange Juice',
        categoryName: 'Drinks',
        taxCategoryName: 'VAT Zero',
        price: 4.0,
        itemType: MenuItemType.DRINK,
        station: PrepStation.BAR,
        sortOrder: 1,
        description: 'Fresh squeezed orange juice',
    },
    {
        name: 'House Cocktail',
        categoryName: 'Drinks',
        taxCategoryName: 'VAT Standard',
        price: 12.0,
        itemType: MenuItemType.DRINK,
        station: PrepStation.BAR,
        sortOrder: 2,
        description: 'Signature cocktail of the day',
    },
    {
        name: 'Sparkling Water',
        categoryName: 'Drinks',
        taxCategoryName: 'VAT Zero',
        price: 2.5,
        itemType: MenuItemType.DRINK,
        station: PrepStation.BAR,
        sortOrder: 3,
    },
    {
        name: 'Espresso',
        categoryName: 'Drinks',
        taxCategoryName: 'VAT Zero',
        price: 3.0,
        itemType: MenuItemType.DRINK,
        station: PrepStation.BAR,
        sortOrder: 4,
    },
    {
        name: 'Craft Beer',
        categoryName: 'Drinks',
        taxCategoryName: 'VAT Standard',
        price: 7.0,
        itemType: MenuItemType.DRINK,
        station: PrepStation.BAR,
        sortOrder: 5,
        description: 'Rotating local craft beer',
    },
    // Sides
    {
        name: 'French Fries',
        categoryName: 'Sides',
        taxCategoryName: 'VAT Standard',
        price: 5.0,
        itemType: MenuItemType.FOOD,
        station: PrepStation.KITCHEN,
        sortOrder: 0,
    },
    {
        name: 'Side Salad',
        categoryName: 'Sides',
        taxCategoryName: 'VAT Standard',
        price: 4.5,
        itemType: MenuItemType.FOOD,
        station: PrepStation.COLD_KITCHEN,
        sortOrder: 1,
        description: 'Mixed greens with vinaigrette',
    },
];

async function seedCategories(
    orgId: string,
    branchCode: string,
): Promise<{ categoryIds: Record<string, string>; created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const categoryIds: Record<string, string> = {};

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping categories`);
        return { categoryIds, created: 0, skipped: 0 };
    }

    for (const cat of CATEGORIES_SEED) {
        const existing = await prisma.category.findUnique({
            where: { branchId_name: { branchId: branch.id, name: cat.name } },
        });
        if (existing) {
            console.log(`  ⏭  Category "${cat.name}" already exists — skipped`);
            categoryIds[cat.name] = existing.id;
            skipped++;
            continue;
        }

        const created_cat = await prisma.category.create({
            data: {
                orgId,
                branchId: branch.id,
                name: cat.name,
                sortOrder: cat.sortOrder,
            },
        });
        console.log(`  ✅ Category "${cat.name}" created`);
        categoryIds[cat.name] = created_cat.id;
        created++;
    }

    return { categoryIds, created, skipped };
}

async function seedTaxCategories(
    orgId: string,
    branchCode: string,
): Promise<{ taxCategoryIds: Record<string, string>; created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const taxCategoryIds: Record<string, string> = {};

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping tax categories`);
        return { taxCategoryIds, created: 0, skipped: 0 };
    }

    for (const tc of TAX_CATEGORIES_SEED) {
        const existing = await prisma.taxCategory.findUnique({
            where: { branchId_name: { branchId: branch.id, name: tc.name } },
        });
        if (existing) {
            console.log(`  ⏭  TaxCategory "${tc.name}" already exists — skipped`);
            taxCategoryIds[tc.name] = existing.id;
            skipped++;
            continue;
        }

        const created_tc = await prisma.taxCategory.create({
            data: {
                orgId,
                branchId: branch.id,
                name: tc.name,
                rate: tc.rate,
            },
        });
        console.log(`  ✅ TaxCategory "${tc.name}" (${tc.rate}%) created`);
        taxCategoryIds[tc.name] = created_tc.id;
        created++;
    }

    return { taxCategoryIds, created, skipped };
}

async function seedMenuItems(
    orgId: string,
    branchCode: string,
    categoryIds: Record<string, string>,
    taxCategoryIds: Record<string, string>,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping menu items`);
        return { created: 0, skipped: 0 };
    }

    for (const item of MENU_ITEMS_SEED) {
        const catId = categoryIds[item.categoryName];
        if (!catId) {
            console.log(`  ⚠️  Category "${item.categoryName}" not found — skipping item "${item.name}"`);
            continue;
        }

        const existing = await prisma.menuItem.findUnique({
            where: { categoryId_name: { categoryId: catId, name: item.name } },
        });
        if (existing) {
            console.log(`  ⏭  MenuItem "${item.name}" already exists — skipped`);
            skipped++;
            continue;
        }

        const tcId = taxCategoryIds[item.taxCategoryName] ?? null;

        await prisma.menuItem.create({
            data: {
                orgId,
                branchId: branch.id,
                categoryId: catId,
                taxCategoryId: tcId,
                name: item.name,
                sku: item.sku ?? null,
                description: item.description ?? null,
                price: item.price,
                itemType: item.itemType,
                station: item.station,
                sortOrder: item.sortOrder,
            },
        });
        console.log(`  ✅ MenuItem "${item.name}" (${item.categoryName}, $${item.price}) created`);
        created++;
    }

    return { created, skipped };
}

// ── M6.1: Browse Groups, Subgroups, Servings ──

interface BrowseGroupSeed {
    name: string;
    section: MenuSection;
    internalKey?: string;
    sortOrder: number;
}

const BROWSE_GROUPS_SEED: BrowseGroupSeed[] = [
    { name: 'Starters', section: MenuSection.FOOD, internalKey: 'starters', sortOrder: 0 },
    { name: 'Mains', section: MenuSection.FOOD, internalKey: 'mains', sortOrder: 1 },
    { name: 'Desserts', section: MenuSection.FOOD, internalKey: 'desserts', sortOrder: 2 },
    { name: 'Sides', section: MenuSection.FOOD, internalKey: 'sides', sortOrder: 3 },
    { name: 'Cocktails', section: MenuSection.DRINKS, internalKey: 'cocktails', sortOrder: 0 },
    { name: 'Beer', section: MenuSection.DRINKS, internalKey: 'beer', sortOrder: 1 },
    { name: 'Soft Drinks', section: MenuSection.DRINKS, internalKey: 'soft-drinks', sortOrder: 2 },
    {
        name: 'Hot Beverages',
        section: MenuSection.DRINKS,
        internalKey: 'hot-beverages',
        sortOrder: 3,
    },
];

interface BrowseSubgroupSeed {
    name: string;
    groupName: string;
    internalKey?: string;
    sortOrder: number;
}

const BROWSE_SUBGROUPS_SEED: BrowseSubgroupSeed[] = [
    { name: 'Cold Starters', groupName: 'Starters', internalKey: 'cold-starters', sortOrder: 0 },
    { name: 'Hot Starters', groupName: 'Starters', internalKey: 'hot-starters', sortOrder: 1 },
    { name: 'Grills', groupName: 'Mains', internalKey: 'grills', sortOrder: 0 },
    { name: 'Pasta', groupName: 'Mains', internalKey: 'pasta', sortOrder: 1 },
    { name: 'Pizza', groupName: 'Mains', internalKey: 'pizza', sortOrder: 2 },
];

// Map menu item names to browse group names for assignment
const ITEM_BROWSE_MAP: Record<string, { groupName: string; subgroupName?: string }> = {
    Bruschetta: { groupName: 'Starters', subgroupName: 'Cold Starters' },
    'Caesar Salad': { groupName: 'Starters', subgroupName: 'Cold Starters' },
    'Chicken Wings': { groupName: 'Starters', subgroupName: 'Hot Starters' },
    'Garlic Bread': { groupName: 'Starters', subgroupName: 'Hot Starters' },
    'Grilled Chicken': { groupName: 'Mains', subgroupName: 'Grills' },
    'Grilled Salmon': { groupName: 'Mains', subgroupName: 'Grills' },
    'Pasta Alfredo': { groupName: 'Mains', subgroupName: 'Pasta' },
    'Margherita Pizza': { groupName: 'Mains', subgroupName: 'Pizza' },
    'Beef Burger': { groupName: 'Mains' },
    Cheesecake: { groupName: 'Desserts' },
    'Chocolate Brownie': { groupName: 'Desserts' },
    Tiramisu: { groupName: 'Desserts' },
    'French Fries': { groupName: 'Sides' },
    'Side Salad': { groupName: 'Sides' },
    'House Cocktail': { groupName: 'Cocktails' },
    'Craft Beer': { groupName: 'Beer' },
    Cola: { groupName: 'Soft Drinks' },
    'Orange Juice': { groupName: 'Soft Drinks' },
    'Sparkling Water': { groupName: 'Soft Drinks' },
    Espresso: { groupName: 'Hot Beverages' },
};

// Serving formats for select items
interface ServingSeed {
    itemName: string;
    format: ServingFormat;
    label?: string;
    price: number;
    volumeText?: string;
    isDefault: boolean;
    sortOrder: number;
}

const SERVINGS_SEED: ServingSeed[] = [
    {
        itemName: 'House Cocktail',
        format: ServingFormat.GLASS,
        price: 12.0,
        isDefault: true,
        sortOrder: 0,
    },
    {
        itemName: 'House Cocktail',
        format: ServingFormat.JUG,
        label: 'Large Jug',
        price: 35.0,
        isDefault: false,
        sortOrder: 1,
    },
    { itemName: 'Craft Beer', format: ServingFormat.PINT, price: 7.0, isDefault: true, sortOrder: 0 },
    {
        itemName: 'Craft Beer',
        format: ServingFormat.HALF_PINT,
        price: 4.0,
        isDefault: false,
        sortOrder: 1,
    },
    { itemName: 'Cola', format: ServingFormat.GLASS, price: 3.5, isDefault: true, sortOrder: 0 },
    {
        itemName: 'Cola',
        format: ServingFormat.BOTTLE,
        label: '500ml',
        price: 5.0,
        volumeText: '500ml',
        isDefault: false,
        sortOrder: 1,
    },
    {
        itemName: 'Orange Juice',
        format: ServingFormat.GLASS,
        price: 4.0,
        isDefault: true,
        sortOrder: 0,
    },
    {
        itemName: 'Orange Juice',
        format: ServingFormat.JUG,
        label: '1L Jug',
        price: 12.0,
        volumeText: '1L',
        isDefault: false,
        sortOrder: 1,
    },
    { itemName: 'Espresso', format: ServingFormat.SINGLE, price: 3.0, isDefault: true, sortOrder: 0 },
    {
        itemName: 'Espresso',
        format: ServingFormat.DOUBLE,
        price: 4.5,
        isDefault: false,
        sortOrder: 1,
    },
    {
        itemName: 'Sparkling Water',
        format: ServingFormat.BOTTLE,
        label: '330ml',
        price: 2.5,
        volumeText: '330ml',
        isDefault: true,
        sortOrder: 0,
    },
    {
        itemName: 'Sparkling Water',
        format: ServingFormat.BOTTLE,
        label: '750ml',
        price: 4.5,
        volumeText: '750ml',
        isDefault: false,
        sortOrder: 1,
    },
];

async function seedBrowseGroups(
    orgId: string,
    branchCode: string,
): Promise<{ groupIds: Record<string, string>; created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const groupIds: Record<string, string> = {};

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping browse groups`);
        return { groupIds, created: 0, skipped: 0 };
    }

    for (const bg of BROWSE_GROUPS_SEED) {
        const existing = await prisma.menuBrowseGroup.findUnique({
            where: { branchId_name: { branchId: branch.id, name: bg.name } },
        });
        if (existing) {
            console.log(`  ⏭  BrowseGroup "${bg.name}" already exists — skipped`);
            groupIds[bg.name] = existing.id;
            skipped++;
            continue;
        }

        const group = await prisma.menuBrowseGroup.create({
            data: {
                orgId,
                branchId: branch.id,
                section: bg.section,
                name: bg.name,
                internalKey: bg.internalKey ?? null,
                sortOrder: bg.sortOrder,
            },
        });
        console.log(`  ✅ BrowseGroup "${bg.name}" (${bg.section}) created`);
        groupIds[bg.name] = group.id;
        created++;
    }

    return { groupIds, created, skipped };
}

async function seedBrowseSubgroups(
    groupIds: Record<string, string>,
): Promise<{ subgroupIds: Record<string, string>; created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const subgroupIds: Record<string, string> = {};

    for (const sg of BROWSE_SUBGROUPS_SEED) {
        const groupId = groupIds[sg.groupName];
        if (!groupId) {
            console.log(`  ⚠️  BrowseGroup "${sg.groupName}" not found — skipping subgroup "${sg.name}"`);
            continue;
        }

        const existing = await prisma.menuBrowseSubgroup.findUnique({
            where: { groupId_name: { groupId, name: sg.name } },
        });
        if (existing) {
            console.log(`  ⏭  BrowseSubgroup "${sg.name}" already exists — skipped`);
            subgroupIds[sg.name] = existing.id;
            skipped++;
            continue;
        }

        const subgroup = await prisma.menuBrowseSubgroup.create({
            data: {
                groupId,
                name: sg.name,
                internalKey: sg.internalKey ?? null,
                sortOrder: sg.sortOrder,
            },
        });
        console.log(`  ✅ BrowseSubgroup "${sg.name}" (→ ${sg.groupName}) created`);
        subgroupIds[sg.name] = subgroup.id;
        created++;
    }

    return { subgroupIds, created, skipped };
}

async function seedBrowseAssignments(
    orgId: string,
    branchCode: string,
    groupIds: Record<string, string>,
    subgroupIds: Record<string, string>,
): Promise<{ updated: number; skipped: number }> {
    let updated = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) return { updated: 0, skipped: 0 };

    for (const [itemName, mapping] of Object.entries(ITEM_BROWSE_MAP)) {
        const groupId = groupIds[mapping.groupName] ?? null;
        const subgroupId = mapping.subgroupName ? (subgroupIds[mapping.subgroupName] ?? null) : null;

        if (!groupId) {
            console.log(`  ⚠️  BrowseGroup "${mapping.groupName}" not found — skipping "${itemName}"`);
            continue;
        }

        const item = await prisma.menuItem.findFirst({
            where: { branchId: branch.id, name: itemName },
        });
        if (!item) {
            console.log(`  ⚠️  MenuItem "${itemName}" not found — skipping browse assignment`);
            continue;
        }

        if (item.browseGroupId === groupId && item.browseSubgroupId === subgroupId) {
            skipped++;
            continue;
        }

        await prisma.menuItem.update({
            where: { id: item.id },
            data: { browseGroupId: groupId, browseSubgroupId: subgroupId },
        });
        console.log(
            `  ✅ "${itemName}" → group="${mapping.groupName}"${mapping.subgroupName ? ` / sub="${mapping.subgroupName}"` : ''}`,
        );
        updated++;
    }

    return { updated, skipped };
}

async function seedMenuItemServings(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping servings`);
        return { created: 0, skipped: 0 };
    }

    for (const s of SERVINGS_SEED) {
        const item = await prisma.menuItem.findFirst({
            where: { branchId: branch.id, name: s.itemName },
        });
        if (!item) {
            console.log(`  ⚠️  MenuItem "${s.itemName}" not found — skipping serving`);
            continue;
        }

        const existing = await prisma.menuItemServing.findFirst({
            where: { menuItemId: item.id, format: s.format, label: s.label ?? null },
        });
        if (existing) {
            console.log(
                `  ⏭  Serving "${s.itemName}" ${s.format}${s.label ? ` (${s.label})` : ''} already exists — skipped`,
            );
            skipped++;
            continue;
        }

        await prisma.menuItemServing.create({
            data: {
                menuItemId: item.id,
                format: s.format,
                label: s.label ?? null,
                price: s.price,
                volumeText: s.volumeText ?? null,
                isDefault: s.isDefault,
                sortOrder: s.sortOrder,
            },
        });
        console.log(
            `  ✅ Serving "${s.itemName}" ${s.format}${s.label ? ` (${s.label})` : ''} at $${s.price}`,
        );
        created++;
    }

    return { created, skipped };
}

// ── M7: Modifier Groups + Options ──

interface ModifierGroupSeed {
    name: string;
    min: number;
    max: number;
    required: boolean;
    sortOrder: number;
}

const MODIFIER_GROUPS_SEED: ModifierGroupSeed[] = [
    { name: 'Size', min: 1, max: 1, required: true, sortOrder: 0 },
    { name: 'Cooking Temp', min: 1, max: 1, required: true, sortOrder: 1 },
    { name: 'Extra Toppings', min: 0, max: 5, required: false, sortOrder: 2 },
    { name: 'Drink Extras', min: 0, max: 3, required: false, sortOrder: 3 },
];

interface ModifierOptionSeed {
    groupName: string;
    name: string;
    priceDelta: string;
    sortOrder: number;
}

const MODIFIER_OPTIONS_SEED: ModifierOptionSeed[] = [
    // Size
    { groupName: 'Size', name: 'Small', priceDelta: '0.00', sortOrder: 0 },
    { groupName: 'Size', name: 'Medium', priceDelta: '2.00', sortOrder: 1 },
    { groupName: 'Size', name: 'Large', priceDelta: '4.00', sortOrder: 2 },
    // Cooking Temp
    { groupName: 'Cooking Temp', name: 'Rare', priceDelta: '0.00', sortOrder: 0 },
    { groupName: 'Cooking Temp', name: 'Medium Rare', priceDelta: '0.00', sortOrder: 1 },
    { groupName: 'Cooking Temp', name: 'Medium', priceDelta: '0.00', sortOrder: 2 },
    { groupName: 'Cooking Temp', name: 'Well Done', priceDelta: '0.00', sortOrder: 3 },
    // Extra Toppings
    { groupName: 'Extra Toppings', name: 'Extra Cheese', priceDelta: '1.50', sortOrder: 0 },
    { groupName: 'Extra Toppings', name: 'Mushrooms', priceDelta: '1.00', sortOrder: 1 },
    { groupName: 'Extra Toppings', name: 'Pepperoni', priceDelta: '2.00', sortOrder: 2 },
    { groupName: 'Extra Toppings', name: 'Olives', priceDelta: '1.00', sortOrder: 3 },
    // Drink Extras
    { groupName: 'Drink Extras', name: 'Extra Shot', priceDelta: '1.50', sortOrder: 0 },
    { groupName: 'Drink Extras', name: 'Whipped Cream', priceDelta: '0.50', sortOrder: 1 },
    { groupName: 'Drink Extras', name: 'Oat Milk', priceDelta: '1.00', sortOrder: 2 },
];

// Map: itemName → array of modifier group names
const ITEM_MODIFIER_ASSIGNMENTS: Record<string, string[]> = {
    'Beef Burger': ['Size', 'Cooking Temp', 'Extra Toppings'],
    'Grilled Chicken': ['Size'],
    'Margherita Pizza': ['Size', 'Extra Toppings'],
    Cola: ['Size'],
    'Orange Juice': ['Size'],
    Espresso: ['Drink Extras'],
    'House Cocktail': ['Drink Extras'],
};

async function seedModifierGroups(
    orgId: string,
    branchCode: string,
): Promise<{ groupIds: Record<string, string>; created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const groupIds: Record<string, string> = {};

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping modifier groups`);
        return { groupIds, created: 0, skipped: 0 };
    }

    for (const g of MODIFIER_GROUPS_SEED) {
        const existing = await prisma.modifierGroup.findUnique({
            where: { branchId_name: { branchId: branch.id, name: g.name } },
        });
        if (existing) {
            console.log(`  ⏭  ModifierGroup "${g.name}" already exists — skipped`);
            groupIds[g.name] = existing.id;
            skipped++;
            continue;
        }

        const created_g = await prisma.modifierGroup.create({
            data: {
                orgId,
                branchId: branch.id,
                name: g.name,
                min: g.min,
                max: g.max,
                required: g.required,
                sortOrder: g.sortOrder,
            },
        });
        console.log(`  ✅ ModifierGroup "${g.name}" created`);
        groupIds[g.name] = created_g.id;
        created++;
    }

    return { groupIds, created, skipped };
}

async function seedModifierOptions(
    groupIds: Record<string, string>,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const o of MODIFIER_OPTIONS_SEED) {
        const groupId = groupIds[o.groupName];
        if (!groupId) {
            console.log(`  ⚠️  ModifierGroup "${o.groupName}" not found — skipping option "${o.name}"`);
            continue;
        }

        const existing = await prisma.modifierOption.findUnique({
            where: { groupId_name: { groupId, name: o.name } },
        });
        if (existing) {
            console.log(`  ⏭  ModifierOption "${o.groupName} → ${o.name}" already exists — skipped`);
            skipped++;
            continue;
        }

        await prisma.modifierOption.create({
            data: {
                groupId,
                name: o.name,
                priceDelta: o.priceDelta,
                sortOrder: o.sortOrder,
            },
        });
        console.log(`  ✅ ModifierOption "${o.groupName} → ${o.name}" ($${o.priceDelta}) created`);
        created++;
    }

    return { created, skipped };
}

async function seedItemModifierAssignments(
    orgId: string,
    branchCode: string,
    groupIds: Record<string, string>,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) return { created: 0, skipped: 0 };

    for (const [itemName, groupNames] of Object.entries(ITEM_MODIFIER_ASSIGNMENTS)) {
        const item = await prisma.menuItem.findFirst({
            where: { branchId: branch.id, name: itemName },
        });
        if (!item) {
            console.log(`  ⚠️  MenuItem "${itemName}" not found — skipping modifier assignment`);
            continue;
        }

        for (let i = 0; i < groupNames.length; i++) {
            const groupId = groupIds[groupNames[i]];
            if (!groupId) {
                console.log(`  ⚠️  ModifierGroup "${groupNames[i]}" not found — skipping`);
                continue;
            }

            const existing = await prisma.menuItemOnGroup.findUnique({
                where: { itemId_groupId: { itemId: item.id, groupId } },
            });
            if (existing) {
                console.log(`  ⏭  "${itemName}" ↔ "${groupNames[i]}" already assigned — skipped`);
                skipped++;
                continue;
            }

            await prisma.menuItemOnGroup.create({
                data: { itemId: item.id, groupId, sortOrder: i },
            });
            console.log(`  ✅ "${itemName}" ↔ "${groupNames[i]}" assigned (sort=${i})`);
            created++;
        }
    }

    return { created, skipped };
}

// ── M8: Inventory Items + Recipe Ingredients ──

interface InventoryItemSeed {
    name: string;
    unit: string;
    category: string;
    theoreticalUnitCost: string;
    sku?: string;
    reorderLevel?: string;
    reorderQty?: string;
}

const INVENTORY_ITEMS_SEED: InventoryItemSeed[] = [
    { name: 'Burger Bun', unit: 'pc', category: 'Bakery', theoreticalUnitCost: '0.500', sku: 'INV-001', reorderLevel: '100.000', reorderQty: '200.000' },
    { name: 'Beef Patty 200g', unit: 'pc', category: 'Meat', theoreticalUnitCost: '3.500', sku: 'INV-002', reorderLevel: '50.000', reorderQty: '100.000' },
    { name: 'Iceberg Lettuce', unit: 'leaf', category: 'Produce', theoreticalUnitCost: '0.100', reorderLevel: '80.000', reorderQty: '200.000' },
    { name: 'Tomato Slice', unit: 'slice', category: 'Produce', theoreticalUnitCost: '0.080', reorderLevel: '60.000', reorderQty: '150.000' },
    { name: 'Burger Sauce', unit: 'ml', category: 'Condiments', theoreticalUnitCost: '0.010', reorderLevel: '500.000', reorderQty: '2000.000' },
    { name: 'Chicken Breast 250g', unit: 'pc', category: 'Meat', theoreticalUnitCost: '4.000', sku: 'INV-003', reorderLevel: '30.000', reorderQty: '60.000' },
    { name: 'Cooking Oil', unit: 'ml', category: 'Oils', theoreticalUnitCost: '0.005', reorderLevel: '2000.000', reorderQty: '5000.000' },
    { name: 'Herb Seasoning', unit: 'g', category: 'Spices', theoreticalUnitCost: '0.030', reorderLevel: '200.000', reorderQty: '500.000' },
    { name: 'Espresso Beans', unit: 'g', category: 'Coffee', theoreticalUnitCost: '0.040', sku: 'INV-004', reorderLevel: '500.000', reorderQty: '2000.000' },
    { name: 'Fresh Milk', unit: 'ml', category: 'Dairy', theoreticalUnitCost: '0.003', reorderLevel: '5000.000', reorderQty: '10000.000' },
    { name: 'Base Spirit (Vodka)', unit: 'ml', category: 'Spirits', theoreticalUnitCost: '0.060', sku: 'INV-005', reorderLevel: '1000.000', reorderQty: '3000.000' },
    { name: 'Cocktail Mixer', unit: 'ml', category: 'Beverages', theoreticalUnitCost: '0.015', reorderLevel: '2000.000', reorderQty: '5000.000' },
    { name: 'Cocktail Garnish', unit: 'pc', category: 'Garnish', theoreticalUnitCost: '0.200', reorderLevel: '30.000', reorderQty: '100.000' },
    { name: 'Pizza Dough Ball', unit: 'pc', category: 'Bakery', theoreticalUnitCost: '0.800', reorderLevel: '20.000', reorderQty: '50.000' },
    { name: 'Mozzarella Cheese', unit: 'g', category: 'Dairy', theoreticalUnitCost: '0.012', reorderLevel: '1000.000', reorderQty: '3000.000' },
    { name: 'Tomato Sauce', unit: 'ml', category: 'Condiments', theoreticalUnitCost: '0.008', reorderLevel: '1000.000', reorderQty: '3000.000' },
    { name: 'Fresh Basil', unit: 'leaf', category: 'Produce', theoreticalUnitCost: '0.050', reorderLevel: '40.000', reorderQty: '100.000' },
    { name: 'Fettuccine Pasta', unit: 'g', category: 'Pasta', theoreticalUnitCost: '0.006', reorderLevel: '2000.000', reorderQty: '5000.000' },
    { name: 'Alfredo Cream Sauce', unit: 'ml', category: 'Sauces', theoreticalUnitCost: '0.020', reorderLevel: '1000.000', reorderQty: '3000.000' },
    { name: 'Parmesan Cheese', unit: 'g', category: 'Dairy', theoreticalUnitCost: '0.025', reorderLevel: '500.000', reorderQty: '1000.000' },
    { name: 'Cheese Slice', unit: 'slice', category: 'Dairy', theoreticalUnitCost: '0.300', reorderLevel: '50.000', reorderQty: '100.000' },
    { name: 'Atlantic Salmon Fillet', unit: 'pc', category: 'Seafood', theoreticalUnitCost: '7.000', sku: 'INV-006', reorderLevel: '10.000', reorderQty: '20.000' },
    { name: 'Lemon', unit: 'pc', category: 'Produce', theoreticalUnitCost: '0.150', reorderLevel: '30.000', reorderQty: '60.000' },
    { name: 'Butter', unit: 'g', category: 'Dairy', theoreticalUnitCost: '0.008', reorderLevel: '500.000', reorderQty: '1000.000' },
];

interface RecipeSeed {
    menuItemName: string;
    ingredients: {
        inventoryItemName: string;
        qtyPerUnit: string;
        wastePct: string;
        unit: string;
        notes?: string;
        modifierOptionName?: string;
        modifierGroupName?: string;
    }[];
}

const RECIPES_SEED: RecipeSeed[] = [
    {
        menuItemName: 'Beef Burger',
        ingredients: [
            { inventoryItemName: 'Burger Bun', qtyPerUnit: '1.000', wastePct: '2.00', unit: 'pc' },
            { inventoryItemName: 'Beef Patty 200g', qtyPerUnit: '1.000', wastePct: '5.00', unit: 'pc' },
            { inventoryItemName: 'Iceberg Lettuce', qtyPerUnit: '2.000', wastePct: '10.00', unit: 'leaf' },
            { inventoryItemName: 'Tomato Slice', qtyPerUnit: '2.000', wastePct: '5.00', unit: 'slice' },
            { inventoryItemName: 'Burger Sauce', qtyPerUnit: '15.000', wastePct: '3.00', unit: 'ml' },
        ],
    },
    {
        menuItemName: 'Grilled Chicken',
        ingredients: [
            { inventoryItemName: 'Chicken Breast 250g', qtyPerUnit: '1.000', wastePct: '8.00', unit: 'pc' },
            { inventoryItemName: 'Cooking Oil', qtyPerUnit: '10.000', wastePct: '5.00', unit: 'ml' },
            { inventoryItemName: 'Herb Seasoning', qtyPerUnit: '5.000', wastePct: '3.00', unit: 'g' },
        ],
    },
    {
        menuItemName: 'Espresso',
        ingredients: [
            { inventoryItemName: 'Espresso Beans', qtyPerUnit: '18.000', wastePct: '5.00', unit: 'g', notes: 'Single shot dose' },
        ],
    },
    {
        menuItemName: 'House Cocktail',
        ingredients: [
            { inventoryItemName: 'Base Spirit (Vodka)', qtyPerUnit: '45.000', wastePct: '2.00', unit: 'ml' },
            { inventoryItemName: 'Cocktail Mixer', qtyPerUnit: '90.000', wastePct: '3.00', unit: 'ml' },
            { inventoryItemName: 'Cocktail Garnish', qtyPerUnit: '1.000', wastePct: '10.00', unit: 'pc' },
        ],
    },
    {
        menuItemName: 'Margherita Pizza',
        ingredients: [
            { inventoryItemName: 'Pizza Dough Ball', qtyPerUnit: '1.000', wastePct: '3.00', unit: 'pc' },
            { inventoryItemName: 'Mozzarella Cheese', qtyPerUnit: '120.000', wastePct: '5.00', unit: 'g' },
            { inventoryItemName: 'Tomato Sauce', qtyPerUnit: '80.000', wastePct: '5.00', unit: 'ml' },
            { inventoryItemName: 'Fresh Basil', qtyPerUnit: '4.000', wastePct: '15.00', unit: 'leaf' },
        ],
    },
    {
        menuItemName: 'Pasta Alfredo',
        ingredients: [
            { inventoryItemName: 'Fettuccine Pasta', qtyPerUnit: '180.000', wastePct: '3.00', unit: 'g' },
            { inventoryItemName: 'Alfredo Cream Sauce', qtyPerUnit: '120.000', wastePct: '5.00', unit: 'ml' },
            { inventoryItemName: 'Parmesan Cheese', qtyPerUnit: '20.000', wastePct: '5.00', unit: 'g' },
        ],
    },
    {
        menuItemName: 'Grilled Salmon',
        ingredients: [
            { inventoryItemName: 'Atlantic Salmon Fillet', qtyPerUnit: '1.000', wastePct: '10.00', unit: 'pc' },
            { inventoryItemName: 'Lemon', qtyPerUnit: '0.500', wastePct: '5.00', unit: 'pc' },
            { inventoryItemName: 'Butter', qtyPerUnit: '15.000', wastePct: '3.00', unit: 'g' },
            { inventoryItemName: 'Herb Seasoning', qtyPerUnit: '3.000', wastePct: '3.00', unit: 'g' },
        ],
    },
    {
        menuItemName: 'Caesar Salad',
        ingredients: [
            { inventoryItemName: 'Iceberg Lettuce', qtyPerUnit: '8.000', wastePct: '15.00', unit: 'leaf' },
            { inventoryItemName: 'Parmesan Cheese', qtyPerUnit: '10.000', wastePct: '5.00', unit: 'g' },
        ],
    },
    {
        menuItemName: 'Garlic Bread',
        ingredients: [
            { inventoryItemName: 'Burger Bun', qtyPerUnit: '1.000', wastePct: '2.00', unit: 'pc', notes: 'Sliced baguette used' },
            { inventoryItemName: 'Butter', qtyPerUnit: '10.000', wastePct: '3.00', unit: 'g' },
            { inventoryItemName: 'Herb Seasoning', qtyPerUnit: '2.000', wastePct: '3.00', unit: 'g' },
        ],
    },
    {
        menuItemName: 'Chicken Wings',
        ingredients: [
            { inventoryItemName: 'Chicken Breast 250g', qtyPerUnit: '1.500', wastePct: '10.00', unit: 'pc', notes: 'Wings portion approx' },
            { inventoryItemName: 'Cooking Oil', qtyPerUnit: '30.000', wastePct: '5.00', unit: 'ml' },
            { inventoryItemName: 'Burger Sauce', qtyPerUnit: '20.000', wastePct: '3.00', unit: 'ml', notes: 'Hot sauce variant' },
        ],
    },
];

// Modifier-linked ingredient: Extra Cheese on Beef Burger
const MODIFIER_RECIPE_SEED = [
    {
        menuItemName: 'Beef Burger',
        modifierGroupName: 'Extra Toppings',
        modifierOptionName: 'Extra Cheese',
        inventoryItemName: 'Cheese Slice',
        qtyPerUnit: '1.000',
        wastePct: '2.00',
        unit: 'slice',
        notes: 'Modifier: extra cheese slice',
    },
    {
        menuItemName: 'Margherita Pizza',
        modifierGroupName: 'Extra Toppings',
        modifierOptionName: 'Extra Cheese',
        inventoryItemName: 'Mozzarella Cheese',
        qtyPerUnit: '50.000',
        wastePct: '5.00',
        unit: 'g',
        notes: 'Modifier: extra mozzarella on pizza',
    },
];

async function seedInventoryItems(
    orgId: string,
    branchCode: string,
): Promise<{ itemIds: Record<string, string>; created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const itemIds: Record<string, string> = {};

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping inventory items`);
        return { itemIds, created: 0, skipped: 0 };
    }

    for (const inv of INVENTORY_ITEMS_SEED) {
        const existing = await prisma.inventoryItem.findUnique({
            where: { branchId_name: { branchId: branch.id, name: inv.name } },
        });
        if (existing) {
            console.log(`  ⏭  InventoryItem "${inv.name}" already exists — skipped`);
            itemIds[inv.name] = existing.id;
            skipped++;
            continue;
        }

        const item = await prisma.inventoryItem.create({
            data: {
                orgId,
                branchId: branch.id,
                sku: inv.sku ?? null,
                name: inv.name,
                unit: inv.unit,
                category: inv.category,
                theoreticalUnitCost: inv.theoreticalUnitCost,
                reorderLevel: inv.reorderLevel ?? '0.000',
                reorderQty: inv.reorderQty ?? '0.000',
            },
        });
        console.log(`  ✅ InventoryItem "${inv.name}" ($${inv.theoreticalUnitCost}/${inv.unit}) created`);
        itemIds[inv.name] = item.id;
        created++;
    }

    return { itemIds, created, skipped };
}

async function seedRecipes(
    orgId: string,
    branchCode: string,
    inventoryItemIds: Record<string, string>,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping recipes`);
        return { created: 0, skipped: 0 };
    }

    for (const recipe of RECIPES_SEED) {
        const menuItem = await prisma.menuItem.findFirst({
            where: { branchId: branch.id, name: recipe.menuItemName },
        });
        if (!menuItem) {
            console.log(`  ⚠️  MenuItem "${recipe.menuItemName}" not found — skipping recipe`);
            continue;
        }

        // Check if recipe already exists (idempotent)
        const existingCount = await prisma.recipeIngredient.count({
            where: { menuItemId: menuItem.id, branchId: branch.id, modifierOptionId: null },
        });
        if (existingCount > 0) {
            console.log(`  ⏭  Recipe for "${recipe.menuItemName}" already exists (${existingCount} rows) — skipped`);
            skipped++;
            continue;
        }

        for (const ing of recipe.ingredients) {
            const invItemId = inventoryItemIds[ing.inventoryItemName];
            if (!invItemId) {
                console.log(`  ⚠️  InventoryItem "${ing.inventoryItemName}" not found — skipping ingredient`);
                continue;
            }

            await prisma.recipeIngredient.create({
                data: {
                    orgId,
                    branchId: branch.id,
                    menuItemId: menuItem.id,
                    inventoryItemId: invItemId,
                    qtyPerUnit: ing.qtyPerUnit,
                    wastePct: ing.wastePct,
                    unit: ing.unit,
                    notes: ing.notes ?? null,
                },
            });
        }
        console.log(`  ✅ Recipe for "${recipe.menuItemName}" created (${recipe.ingredients.length} ingredients)`);
        created++;
    }

    // Seed modifier-linked recipe rows
    for (const modRecipe of MODIFIER_RECIPE_SEED) {
        const menuItem = await prisma.menuItem.findFirst({
            where: { branchId: branch.id, name: modRecipe.menuItemName },
        });
        if (!menuItem) continue;

        const invItemId = inventoryItemIds[modRecipe.inventoryItemName];
        if (!invItemId) continue;

        // Find modifier option
        const modGroup = await prisma.modifierGroup.findUnique({
            where: { branchId_name: { branchId: branch.id, name: modRecipe.modifierGroupName } },
        });
        if (!modGroup) continue;

        const modOption = await prisma.modifierOption.findUnique({
            where: { groupId_name: { groupId: modGroup.id, name: modRecipe.modifierOptionName } },
        });
        if (!modOption) continue;

        // Check if already exists (idempotent)
        const existing = await prisma.recipeIngredient.findFirst({
            where: {
                menuItemId: menuItem.id,
                branchId: branch.id,
                modifierOptionId: modOption.id,
                inventoryItemId: invItemId,
            },
        });
        if (existing) {
            console.log(`  ⏭  Modifier recipe "${modRecipe.menuItemName} → ${modRecipe.modifierOptionName}" already exists — skipped`);
            skipped++;
            continue;
        }

        await prisma.recipeIngredient.create({
            data: {
                orgId,
                branchId: branch.id,
                menuItemId: menuItem.id,
                inventoryItemId: invItemId,
                modifierOptionId: modOption.id,
                qtyPerUnit: modRecipe.qtyPerUnit,
                wastePct: modRecipe.wastePct,
                unit: modRecipe.unit,
                notes: modRecipe.notes,
            },
        });
        console.log(`  ✅ Modifier recipe "${modRecipe.menuItemName} → ${modRecipe.modifierOptionName}" created`);
        created++;
    }

    return { created, skipped };
}

// ── M9: Stock Batches Seed ──

interface StockBatchSeed {
    inventoryItemName: string;
    batchNumber: string;
    receivedQty: string;
    unitCost: string;
    expiryDate?: string;
    receivedAt: string;
}

// Multiple batches for some items to demonstrate FIFO ordering
const STOCK_BATCHES_SEED: StockBatchSeed[] = [
    // Chicken Breast: 3 batches (FIFO demo)
    { inventoryItemName: 'Chicken Breast 250g', batchNumber: 'CB-2025-001', receivedQty: '20.000', unitCost: '3.800', receivedAt: '2025-03-01T08:00:00Z', expiryDate: '2025-03-08T00:00:00Z' },
    { inventoryItemName: 'Chicken Breast 250g', batchNumber: 'CB-2025-002', receivedQty: '25.000', unitCost: '4.000', receivedAt: '2025-03-05T08:00:00Z', expiryDate: '2025-03-12T00:00:00Z' },
    { inventoryItemName: 'Chicken Breast 250g', batchNumber: 'CB-2025-003', receivedQty: '15.000', unitCost: '4.200', receivedAt: '2025-03-10T08:00:00Z', expiryDate: '2025-03-17T00:00:00Z' },
    // Fresh Milk: 3 batches (FIFO demo)
    { inventoryItemName: 'Fresh Milk', batchNumber: 'FM-2025-001', receivedQty: '5000.000', unitCost: '0.003', receivedAt: '2025-03-01T06:00:00Z', expiryDate: '2025-03-05T00:00:00Z' },
    { inventoryItemName: 'Fresh Milk', batchNumber: 'FM-2025-002', receivedQty: '5000.000', unitCost: '0.003', receivedAt: '2025-03-03T06:00:00Z', expiryDate: '2025-03-07T00:00:00Z' },
    { inventoryItemName: 'Fresh Milk', batchNumber: 'FM-2025-003', receivedQty: '8000.000', unitCost: '0.004', receivedAt: '2025-03-08T06:00:00Z', expiryDate: '2025-03-12T00:00:00Z' },
    // Base Spirit (Vodka): 2 batches (FIFO demo)
    { inventoryItemName: 'Base Spirit (Vodka)', batchNumber: 'VS-2025-001', receivedQty: '3000.000', unitCost: '0.058', receivedAt: '2025-02-15T10:00:00Z' },
    { inventoryItemName: 'Base Spirit (Vodka)', batchNumber: 'VS-2025-002', receivedQty: '2000.000', unitCost: '0.062', receivedAt: '2025-03-01T10:00:00Z' },
    // Single batches for remaining items
    { inventoryItemName: 'Burger Bun', batchNumber: 'BB-2025-001', receivedQty: '200.000', unitCost: '0.480', receivedAt: '2025-03-08T07:00:00Z', expiryDate: '2025-03-15T00:00:00Z' },
    { inventoryItemName: 'Beef Patty 200g', batchNumber: 'BP-2025-001', receivedQty: '80.000', unitCost: '3.400', receivedAt: '2025-03-06T09:00:00Z', expiryDate: '2025-03-20T00:00:00Z' },
    { inventoryItemName: 'Iceberg Lettuce', batchNumber: 'IL-2025-001', receivedQty: '150.000', unitCost: '0.090', receivedAt: '2025-03-09T07:00:00Z', expiryDate: '2025-03-14T00:00:00Z' },
    { inventoryItemName: 'Tomato Slice', batchNumber: 'TS-2025-001', receivedQty: '120.000', unitCost: '0.075', receivedAt: '2025-03-09T07:00:00Z', expiryDate: '2025-03-14T00:00:00Z' },
    { inventoryItemName: 'Burger Sauce', batchNumber: 'BS-2025-001', receivedQty: '3000.000', unitCost: '0.009', receivedAt: '2025-03-01T10:00:00Z' },
    { inventoryItemName: 'Cooking Oil', batchNumber: 'CO-2025-001', receivedQty: '5000.000', unitCost: '0.004', receivedAt: '2025-03-01T10:00:00Z' },
    { inventoryItemName: 'Herb Seasoning', batchNumber: 'HS-2025-001', receivedQty: '500.000', unitCost: '0.028', receivedAt: '2025-03-01T10:00:00Z' },
    { inventoryItemName: 'Espresso Beans', batchNumber: 'EB-2025-001', receivedQty: '2000.000', unitCost: '0.038', receivedAt: '2025-03-01T10:00:00Z' },
    { inventoryItemName: 'Cocktail Mixer', batchNumber: 'CM-2025-001', receivedQty: '5000.000', unitCost: '0.014', receivedAt: '2025-03-01T10:00:00Z' },
    { inventoryItemName: 'Cocktail Garnish', batchNumber: 'CG-2025-001', receivedQty: '80.000', unitCost: '0.180', receivedAt: '2025-03-05T10:00:00Z' },
    { inventoryItemName: 'Pizza Dough Ball', batchNumber: 'PD-2025-001', receivedQty: '40.000', unitCost: '0.750', receivedAt: '2025-03-08T06:00:00Z', expiryDate: '2025-03-11T00:00:00Z' },
    { inventoryItemName: 'Mozzarella Cheese', batchNumber: 'MC-2025-001', receivedQty: '3000.000', unitCost: '0.011', receivedAt: '2025-03-06T07:00:00Z', expiryDate: '2025-03-20T00:00:00Z' },
    { inventoryItemName: 'Tomato Sauce', batchNumber: 'TSC-2025-001', receivedQty: '5000.000', unitCost: '0.007', receivedAt: '2025-03-01T10:00:00Z' },
    { inventoryItemName: 'Fresh Basil', batchNumber: 'FB-2025-001', receivedQty: '80.000', unitCost: '0.045', receivedAt: '2025-03-09T07:00:00Z', expiryDate: '2025-03-13T00:00:00Z' },
    { inventoryItemName: 'Fettuccine Pasta', batchNumber: 'FP-2025-001', receivedQty: '5000.000', unitCost: '0.005', receivedAt: '2025-03-01T10:00:00Z' },
    { inventoryItemName: 'Alfredo Cream Sauce', batchNumber: 'AS-2025-001', receivedQty: '3000.000', unitCost: '0.018', receivedAt: '2025-03-01T10:00:00Z' },
    { inventoryItemName: 'Parmesan Cheese', batchNumber: 'PC-2025-001', receivedQty: '1000.000', unitCost: '0.023', receivedAt: '2025-03-01T10:00:00Z', expiryDate: '2025-06-01T00:00:00Z' },
    { inventoryItemName: 'Cheese Slice', batchNumber: 'CS-2025-001', receivedQty: '100.000', unitCost: '0.280', receivedAt: '2025-03-06T07:00:00Z', expiryDate: '2025-04-06T00:00:00Z' },
    { inventoryItemName: 'Atlantic Salmon Fillet', batchNumber: 'SF-2025-001', receivedQty: '15.000', unitCost: '6.800', receivedAt: '2025-03-08T06:00:00Z', expiryDate: '2025-03-12T00:00:00Z' },
    { inventoryItemName: 'Lemon', batchNumber: 'LM-2025-001', receivedQty: '60.000', unitCost: '0.140', receivedAt: '2025-03-06T07:00:00Z', expiryDate: '2025-03-20T00:00:00Z' },
    { inventoryItemName: 'Butter', batchNumber: 'BT-2025-001', receivedQty: '1000.000', unitCost: '0.007', receivedAt: '2025-03-01T10:00:00Z', expiryDate: '2025-04-01T00:00:00Z' },
];

async function seedStockBatches(
    orgId: string,
    branchCode: string,
    inventoryItemIds: Record<string, string>,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping stock batches`);
        return { created: 0, skipped: 0 };
    }

    for (const batch of STOCK_BATCHES_SEED) {
        const itemId = inventoryItemIds[batch.inventoryItemName];
        if (!itemId) {
            console.log(`  ⚠️  InventoryItem "${batch.inventoryItemName}" not found — skipping batch`);
            continue;
        }

        // Check if batch already exists (idempotent by batchNumber + branchId)
        const existing = await prisma.stockBatch.findFirst({
            where: { branchId: branch.id, itemId, batchNumber: batch.batchNumber },
        });
        if (existing) {
            console.log(`  ⏭  StockBatch "${batch.batchNumber}" already exists — skipped`);
            skipped++;
            continue;
        }

        await prisma.stockBatch.create({
            data: {
                orgId,
                branchId: branch.id,
                itemId,
                batchNumber: batch.batchNumber,
                receivedQty: batch.receivedQty,
                remainingQty: batch.receivedQty,
                unitCost: batch.unitCost,
                expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : null,
                receivedAt: new Date(batch.receivedAt),
            },
        });
        console.log(`  ✅ StockBatch "${batch.batchNumber}" (${batch.inventoryItemName}: ${batch.receivedQty} @ $${batch.unitCost}) created`);
        created++;
    }

    return { created, skipped };
}

// ── M10: POS Orders Seed ──

interface OrderSeed {
    orderNumber: string;
    serviceType: ServiceType;
    status: OrderStatus;
    tableLabel?: string;
    userEmail: string;
    items: {
        menuItemName: string;
        servingLabel?: string;
        quantity: number;
        unitPrice: number;
    }[];
    notes?: string;
}

const ORDERS_SEED: OrderSeed[] = [
    {
        orderNumber: 'ORD-000001',
        serviceType: ServiceType.DINE_IN,
        status: OrderStatus.NEW,
        tableLabel: 'T1',
        userEmail: 'waiter@demo.local',
        items: [
            { menuItemName: 'Caesar Salad', quantity: 1, unitPrice: 8.5 },
            { menuItemName: 'Grilled Chicken Breast', quantity: 2, unitPrice: 14.0 },
        ],
    },
    {
        orderNumber: 'ORD-000002',
        serviceType: ServiceType.TAKEAWAY,
        status: OrderStatus.SENT,
        userEmail: 'cashier@demo.local',
        items: [
            { menuItemName: 'Margherita Pizza', quantity: 1, unitPrice: 12.0 },
            { menuItemName: 'Lemonade', quantity: 2, unitPrice: 4.0 },
        ],
    },
    {
        orderNumber: 'ORD-000003',
        serviceType: ServiceType.DINE_IN,
        status: OrderStatus.IN_KITCHEN,
        tableLabel: 'T3',
        userEmail: 'waiter@demo.local',
        items: [
            { menuItemName: 'Beef Burger', quantity: 1, unitPrice: 11.0 },
            { menuItemName: 'French Fries', quantity: 1, unitPrice: 4.5 },
            { menuItemName: 'Iced Tea', quantity: 1, unitPrice: 3.5 },
        ],
    },
    {
        orderNumber: 'ORD-000004',
        serviceType: ServiceType.DINE_IN,
        status: OrderStatus.SERVED,
        tableLabel: 'T2',
        userEmail: 'waiter@demo.local',
        items: [
            { menuItemName: 'Tomato Soup', quantity: 2, unitPrice: 6.0 },
        ],
    },
    {
        orderNumber: 'ORD-000005',
        serviceType: ServiceType.TAKEAWAY,
        status: OrderStatus.CLOSED,
        userEmail: 'cashier@demo.local',
        items: [
            { menuItemName: 'Pasta Carbonara', quantity: 1, unitPrice: 13.0 },
            { menuItemName: 'Espresso', quantity: 1, unitPrice: 3.0 },
        ],
        notes: 'Customer picked up',
    },
    {
        orderNumber: 'ORD-000006',
        serviceType: ServiceType.DINE_IN,
        status: OrderStatus.VOIDED,
        tableLabel: 'T5',
        userEmail: 'manager@demo.local',
        items: [
            { menuItemName: 'Chocolate Lava Cake', quantity: 1, unitPrice: 7.5 },
        ],
        notes: 'Customer cancelled before preparation',
    },
];

async function seedOrders(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping orders`);
        return { created: 0, skipped: 0 };
    }

    for (const order of ORDERS_SEED) {
        // Check idempotency by orderNumber
        const existing = await prisma.order.findUnique({
            where: { branchId_orderNumber: { branchId: branch.id, orderNumber: order.orderNumber } },
        });
        if (existing) {
            console.log(`  ⏭  Order "${order.orderNumber}" already exists — skipped`);
            skipped++;
            continue;
        }

        // Resolve user
        const user = await prisma.user.findUnique({ where: { email: order.userEmail } });
        if (!user) {
            console.log(`  ⚠️  User "${order.userEmail}" not found — skipping order`);
            continue;
        }

        // Resolve table
        let tableId: string | null = null;
        if (order.tableLabel) {
            const table = await prisma.table.findUnique({
                where: { branchId_label: { branchId: branch.id, label: order.tableLabel } },
            });
            tableId = table?.id ?? null;
        }

        // Resolve items
        const itemsData: {
            menuItemId: string;
            menuItemServingId: string | null;
            quantity: number;
            price: number;
            subtotal: number;
        }[] = [];

        for (const item of order.items) {
            const menuItem = await prisma.menuItem.findFirst({
                where: { branchId: branch.id, name: item.menuItemName },
            });
            if (!menuItem) {
                console.log(`  ⚠️  MenuItem "${item.menuItemName}" not found — skipping item`);
                continue;
            }

            let servingId: string | null = null;
            if (item.servingLabel) {
                const serving = await prisma.menuItemServing.findFirst({
                    where: { menuItemId: menuItem.id, label: item.servingLabel },
                });
                servingId = serving?.id ?? null;
            }

            itemsData.push({
                menuItemId: menuItem.id,
                menuItemServingId: servingId,
                quantity: item.quantity,
                price: item.unitPrice,
                subtotal: item.unitPrice * item.quantity,
            });
        }

        const subtotal = itemsData.reduce((sum, i) => sum + i.subtotal, 0);

        await prisma.order.create({
            data: {
                orgId,
                branchId: branch.id,
                userId: user.id,
                tableId,
                orderNumber: order.orderNumber,
                status: order.status,
                serviceType: order.serviceType,
                subtotal,
                tax: 0,
                discount: 0,
                total: subtotal,
                notes: order.notes,
                items: {
                    create: itemsData.map((i) => ({
                        menuItemId: i.menuItemId,
                        menuItemServingId: i.menuItemServingId,
                        quantity: i.quantity,
                        price: i.price,
                        subtotal: i.subtotal,
                    })),
                },
            },
        });
        console.log(`  ✅ Order "${order.orderNumber}" (${order.serviceType}, ${order.status}) created with ${itemsData.length} items`);
        created++;
    }

    return { created, skipped };
}

// ── M11: KDS SLA Configs + Demo Tickets ──

async function seedKdsData(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping KDS data`);
        return { created: 0, skipped: 0 };
    }

    // Seed SLA configs for KITCHEN and BAR
    const slaDefaults = [
        { station: 'KITCHEN', greenSeconds: 300, amberSeconds: 600, redSeconds: 900 },
        { station: 'BAR', greenSeconds: 180, amberSeconds: 360, redSeconds: 600 },
        { station: 'COLD_KITCHEN', greenSeconds: 240, amberSeconds: 480, redSeconds: 720 },
        { station: 'DESSERT', greenSeconds: 180, amberSeconds: 360, redSeconds: 540 },
    ];

    for (const sla of slaDefaults) {
        const existing = await prisma.kdsSlaConfig.findUnique({
            where: { branchId_station: { branchId: branch.id, station: sla.station } },
        });
        if (existing) {
            console.log(`  ⏭  KdsSlaConfig "${sla.station}" already exists — skipped`);
            skipped++;
            continue;
        }
        await prisma.kdsSlaConfig.create({
            data: {
                orgId,
                branchId: branch.id,
                station: sla.station,
                greenSeconds: sla.greenSeconds,
                amberSeconds: sla.amberSeconds,
                redSeconds: sla.redSeconds,
            },
        });
        console.log(`  ✅ KdsSlaConfig "${sla.station}" created`);
        created++;
    }

    // Create KDS tickets for the SENT order (ORD-000002)
    const sentOrder = await prisma.order.findFirst({
        where: { branchId: branch.id, status: 'SENT' },
        include: {
            items: {
                include: { menuItem: { select: { id: true, name: true, station: true } } },
            },
        },
    });

    if (sentOrder) {
        const existingTickets = await prisma.kdsTicket.findMany({
            where: { orderId: sentOrder.id, branchId: branch.id },
        });
        if (existingTickets.length > 0) {
            console.log(`  ⏭  KDS tickets for "${sentOrder.orderNumber}" already exist — skipped`);
            skipped++;
        } else {
            // Group items by station
            const stationGroups: Record<string, string[]> = {};
            for (const item of sentOrder.items) {
                const station = item.menuItem.station;
                if (station === 'NONE') continue;
                if (!stationGroups[station]) stationGroups[station] = [];
                stationGroups[station].push(item.id);
            }

            for (const [station, itemIds] of Object.entries(stationGroups)) {
                await prisma.kdsTicket.create({
                    data: {
                        orgId,
                        branchId: branch.id,
                        orderId: sentOrder.id,
                        station,
                        status: 'QUEUED',
                        items: {
                            create: itemIds.map((orderItemId) => ({ orderItemId })),
                        },
                    },
                });
                console.log(`  ✅ KDS ticket for "${sentOrder.orderNumber}" station=${station} created`);
                created++;
            }
        }
    }

    return { created, skipped };
}

// ── M12: Demo Discounts ──

async function seedDiscounts(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping discounts`);
        return { created: 0, skipped: 0 };
    }

    // Find the NEW order (ORD-000001) for demo discounts
    const newOrder = await prisma.order.findFirst({
        where: { branchId: branch.id, status: 'NEW' },
    });
    if (!newOrder) {
        console.log(`  ⚠️  No NEW order found — skipping discounts`);
        return { created: 0, skipped: 0 };
    }

    // Check idempotency
    const existing = await prisma.discount.findFirst({
        where: { orderId: newOrder.id, branchId: branch.id },
    });
    if (existing) {
        console.log(`  ⏭  Discounts for "${newOrder.orderNumber}" already exist — skipped`);
        return { created: 0, skipped: 3 };
    }

    const owner = await prisma.user.findUnique({ where: { email: 'owner@demo.local' } });
    const waiter = await prisma.user.findUnique({ where: { email: 'waiter@demo.local' } });
    if (!owner || !waiter) {
        console.log(`  ⚠️  Demo users not found — skipping discounts`);
        return { created: 0, skipped: 0 };
    }

    // 1) Small FIXED approved discount (auto-approved, below threshold)
    await prisma.discount.create({
        data: {
            orgId,
            branchId: branch.id,
            orderId: newOrder.id,
            type: 'FIXED',
            value: 2000,
            reason: 'Returning customer loyalty',
            status: 'APPROVED',
            createdById: waiter.id,
            approvedById: owner.id,
            approvedAt: new Date(),
        },
    });
    console.log(`  ✅ Discount FIXED/2000/APPROVED on "${newOrder.orderNumber}" created`);
    created++;

    // 2) Large PERCENTAGE pending discount (above threshold)
    await prisma.discount.create({
        data: {
            orgId,
            branchId: branch.id,
            orderId: newOrder.id,
            type: 'PERCENTAGE',
            value: 25,
            reason: 'VIP guest — pending manager approval',
            status: 'PENDING',
            createdById: waiter.id,
        },
    });
    console.log(`  ✅ Discount PERCENTAGE/25/PENDING on "${newOrder.orderNumber}" created`);
    created++;

    // 3) Rejected discount
    await prisma.discount.create({
        data: {
            orgId,
            branchId: branch.id,
            orderId: newOrder.id,
            type: 'FIXED',
            value: 50000,
            reason: 'Excessive discount request',
            status: 'REJECTED',
            createdById: waiter.id,
            rejectedById: owner.id,
            rejectedAt: new Date(),
            rejectionReason: 'Amount exceeds policy limit',
        },
    });
    console.log(`  ✅ Discount FIXED/50000/REJECTED on "${newOrder.orderNumber}" created`);
    created++;

    return { created, skipped };
}

// ── M13: Payments Demo Data ──

async function seedPayments(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping payments`);
        return { created: 0, skipped: 0 };
    }

    // Find the SERVED order (ORD-000004) for payment demo
    const servedOrder = await prisma.order.findUnique({
        where: { branchId_orderNumber: { branchId: branch.id, orderNumber: 'ORD-000004' } },
    });
    if (!servedOrder) {
        console.log(`  ⚠️  Order "ORD-000004" not found — skipping payments`);
        return { created: 0, skipped: 0 };
    }

    // Idempotency check
    const existingPayment = await prisma.payment.findFirst({
        where: { orderId: servedOrder.id, branchId: branch.id },
    });
    if (existingPayment) {
        console.log(`  ⏭  Payments for "ORD-000004" already exist — skipped`);
        return { created: 0, skipped: 3 };
    }

    const cashier = await prisma.user.findUnique({ where: { email: 'cashier@demo.local' } });
    if (!cashier) {
        console.log(`  ⚠️  Cashier user not found — skipping payments`);
        return { created: 0, skipped: 0 };
    }

    // 1) Cash payment — full amount for the SERVED order (split payment demo: part cash)
    await prisma.payment.create({
        data: {
            orgId,
            branchId: branch.id,
            orderId: servedOrder.id,
            amount: 8.0,
            method: 'CASH',
            status: 'COMPLETED',
            metadata: { changeDue: 0, note: 'Split payment — cash portion' },
        },
    });
    console.log(`  ✅ Payment CASH/8.00/COMPLETED on "ORD-000004" created`);
    created++;

    // 2) Card payment — remainder of split payment
    await prisma.payment.create({
        data: {
            orgId,
            branchId: branch.id,
            orderId: servedOrder.id,
            amount: 4.0,
            method: 'CARD',
            status: 'COMPLETED',
            transactionId: 'TXN-CARD-DEMO-001',
            metadata: { cardLast4: '4242' },
        },
    });
    console.log(`  ✅ Payment CARD/4.00/COMPLETED on "ORD-000004" created`);
    created++;

    // 3) MOMO payment intent — demonstrates async lifecycle
    const intent = await prisma.paymentIntent.create({
        data: {
            orgId,
            branchId: branch.id,
            orderId: servedOrder.id,
            provider: 'MTN',
            amount: 12.0,
            currency: 'UGX',
            status: 'SUCCEEDED',
            providerRef: 'MTN-DEMO-REF-001',
            externalId: 'demo-external-id-001',
            customerPhone: '256700000000',
            requestedAmount: 12.0,
            confirmedAmount: 12.0,
            requestedMsisdn: '256700000000',
            confirmedMsisdn: '256700000000',
            metadata: { phoneNumber: '+256700000000' },
        },
    });
    console.log(`  ✅ PaymentIntent MTN/SUCCEEDED/12.00 on "ORD-000004" created`);
    created++;

    // 4) Manual-reference payment — offline fallback demo (UNVERIFIED)
    await prisma.payment.create({
        data: {
            orgId,
            branchId: branch.id,
            orderId: servedOrder.id,
            amount: 5.0,
            method: 'MOMO',
            status: 'COMPLETED',
            captureMode: 'MANUAL_REFERENCE',
            verificationStatus: 'UNVERIFIED',
            externalTransactionId: 'MTN-TXN-MANUAL-DEMO-001',
            payerPhone: '256700000001',
            postedAt: new Date(),
            enteredById: cashier.id,
            verificationNote: 'Customer showed SMS confirmation on phone',
            metadata: { provider: 'MTN', captureMode: 'MANUAL_REFERENCE' },
        },
    });
    console.log(`  ✅ Payment MOMO/MANUAL_REFERENCE/5.00/UNVERIFIED on "ORD-000004" created`);
    created++;

    return { created, skipped };
}

// ── Shifts + Tills (M15) ──

async function seedShiftsAndTills(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping shifts/tills`);
        return { created: 0, skipped: 0 };
    }

    const cashier = await prisma.user.findUnique({ where: { email: 'cashier@demo.local' } });
    const owner = await prisma.user.findUnique({ where: { email: 'owner@demo.local' } });
    if (!cashier || !owner) {
        console.log(`  ⚠️  Demo users not found — skipping shifts/tills`);
        return { created: 0, skipped: 0 };
    }

    // Idempotency: check if shifts already exist
    const existingShift = await prisma.shift.findFirst({
        where: { branchId: branch.id },
    });
    if (existingShift) {
        console.log(`  ⏭  Shifts for branch "${branchCode}" already exist — skipped`);
        return { created: 0, skipped: 3 };
    }

    // 1) Closed shift with summary
    const closedShift = await prisma.shift.create({
        data: {
            orgId,
            branchId: branch.id,
            shiftNumber: 'SHF-000001',
            openedById: cashier.id,
            closedById: owner.id,
            status: 'CLOSED',
            openedAt: new Date('2026-03-25T06:00:00Z'),
            closedAt: new Date('2026-03-25T14:00:00Z'),
            notes: 'Morning shift — completed',
        },
    });
    console.log(`  ✅ Shift SHF-000001 (CLOSED) created`);
    created++;

    // Summary for the closed shift
    await prisma.shiftCloseSummary.create({
        data: {
            shiftId: closedShift.id,
            orgId,
            branchId: branch.id,
            grossSales: 150000,
            cashSales: 90000,
            momoSales: 40000,
            cardSales: 20000,
            refundCashOut: 5000,
            safeDropTotal: 30000,
            pickupTotal: 0,
            expectedCash: 55000,
            countedCash: 54500,
            variance: -500,
            ordersClosedCount: 12,
            refundsCount: 1,
            generatedById: owner.id,
        },
    });
    console.log(`  ✅ ShiftCloseSummary for SHF-000001 created`);
    created++;

    // Closed till for the closed shift
    const closedTill = await prisma.tillSession.create({
        data: {
            orgId,
            branchId: branch.id,
            shiftId: closedShift.id,
            tillCode: 'TILL-01',
            operatorUserId: cashier.id,
            openedById: cashier.id,
            closedById: owner.id,
            openingFloat: 50000,
            expectedCash: 55000,
            countedCash: 54500,
            variance: -500,
            varianceStatus: 'SHORT',
            status: 'RECONCILED',
            openedAt: new Date('2026-03-25T06:05:00Z'),
            reconciledAt: new Date('2026-03-25T13:55:00Z'),
            closedAt: new Date('2026-03-25T13:55:00Z'),
            notes: 'Minor variance — coins',
        },
    });
    console.log(`  ✅ TillSession TILL-01 (RECONCILED) created`);
    created++;

    // Cash movements for the closed till
    await prisma.cashMovement.create({
        data: {
            orgId,
            branchId: branch.id,
            tillSessionId: closedTill.id,
            shiftId: closedShift.id,
            type: 'OPENING_FLOAT',
            amount: 50000,
            reason: 'Opening float',
            createdById: cashier.id,
        },
    });
    console.log(`  ✅ CashMovement OPENING_FLOAT/50000 created`);
    created++;

    await prisma.cashMovement.create({
        data: {
            orgId,
            branchId: branch.id,
            tillSessionId: closedTill.id,
            shiftId: closedShift.id,
            type: 'SAFE_DROP',
            amount: 30000,
            reason: 'Excess cash removal mid-shift',
            createdById: cashier.id,
        },
    });
    console.log(`  ✅ CashMovement SAFE_DROP/30000 created`);
    created++;

    // 2) Currently open shift
    const openShift = await prisma.shift.create({
        data: {
            orgId,
            branchId: branch.id,
            shiftNumber: 'SHF-000002',
            openedById: cashier.id,
            status: 'OPEN',
            openedAt: new Date('2026-03-26T06:00:00Z'),
            notes: 'Current shift — ongoing',
        },
    });
    console.log(`  ✅ Shift SHF-000002 (OPEN) created`);
    created++;

    // Open till for the current shift
    const openTill = await prisma.tillSession.create({
        data: {
            orgId,
            branchId: branch.id,
            shiftId: openShift.id,
            tillCode: 'TILL-01',
            operatorUserId: cashier.id,
            openedById: cashier.id,
            openingFloat: 50000,
            expectedCash: 50000,
            status: 'OPEN',
            openedAt: new Date('2026-03-26T06:05:00Z'),
            notes: 'Active till session',
        },
    });
    console.log(`  ✅ TillSession TILL-01 (OPEN) created`);
    created++;

    await prisma.cashMovement.create({
        data: {
            orgId,
            branchId: branch.id,
            tillSessionId: openTill.id,
            shiftId: openShift.id,
            type: 'OPENING_FLOAT',
            amount: 50000,
            reason: 'Opening float',
            createdById: cashier.id,
        },
    });
    console.log(`  ✅ CashMovement OPENING_FLOAT/50000 (current) created`);
    created++;

    return { created, skipped };
}

// ── M16: Demo Reservations + Deposits ──

async function seedReservations(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping reservations`);
        return { created: 0, skipped: 0 };
    }

    const owner = await prisma.user.findUnique({ where: { email: 'owner@demo.local' } });
    const waiter = await prisma.user.findUnique({ where: { email: 'waiter@demo.local' } });
    if (!owner || !waiter) {
        console.log(`  ⚠️  Demo users not found — skipping reservations`);
        return { created: 0, skipped: 0 };
    }

    // Idempotency check
    const existing = await prisma.reservation.findFirst({
        where: { branchId: branch.id },
    });
    if (existing) {
        console.log(`  ⏭  Reservations for branch "${branchCode}" already exist — skipped`);
        return { created: 0, skipped: 5 };
    }

    // Grab first table for seating demo
    const table = await prisma.table.findFirst({
        where: { branchId: branch.id },
        orderBy: { label: 'asc' },
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(20, 0, 0, 0);

    // 1) PENDING reservation
    const r1 = await prisma.reservation.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationNumber: 'RES-000001',
            customerName: 'Grace Nakamya',
            customerPhone: '+256700123456',
            partySize: 4,
            reservationAt: tomorrow,
            expectedDurationMinutes: 90,
            source: 'PHONE',
            status: 'PENDING',
            notes: 'Birthday dinner — needs cake candles',
            depositRequired: 50000,
            createdById: waiter.id,
            tableId: table?.id || null,
        },
    });
    await prisma.reservationEvent.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationId: r1.id,
            type: 'CREATED',
            actorUserId: waiter.id,
            message: 'Reservation created via phone call',
        },
    });
    console.log(`  ✅ Reservation RES-000001 (PENDING) created`);
    created++;

    // 2) CONFIRMED with deposit
    const r2 = await prisma.reservation.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationNumber: 'RES-000002',
            customerName: 'Daniel Okello',
            customerPhone: '+256771234567',
            partySize: 6,
            reservationAt: tomorrow,
            expectedDurationMinutes: 120,
            source: 'WHATSAPP',
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            depositRequired: 100000,
            createdById: waiter.id,
            updatedById: owner.id,
            tableId: table?.id || null,
        },
    });
    await prisma.reservationDeposit.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationId: r2.id,
            amount: 100000,
            status: 'RECEIVED',
            method: 'MOBILE_MONEY',
            reference: 'MTN-REF-98765',
            recordedById: owner.id,
        },
    });
    await prisma.reservationEvent.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationId: r2.id,
            type: 'CREATED',
            actorUserId: waiter.id,
            message: 'Reservation created via WhatsApp',
        },
    });
    await prisma.reservationEvent.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationId: r2.id,
            type: 'CONFIRMED',
            actorUserId: owner.id,
            message: 'Reservation confirmed',
        },
    });
    await prisma.reservationEvent.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationId: r2.id,
            type: 'DEPOSIT_RECORDED',
            actorUserId: owner.id,
            message: 'Deposit of 100000 recorded via MOBILE_MONEY',
        },
    });
    console.log(`  ✅ Reservation RES-000002 (CONFIRMED + deposit) created`);
    created++;

    // 3) SEATED reservation
    const r3 = await prisma.reservation.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationNumber: 'RES-000003',
            customerName: 'Sarah Achieng',
            partySize: 2,
            reservationAt: new Date(),
            source: 'WALK_IN',
            status: 'SEATED',
            confirmedAt: new Date(),
            seatedAt: new Date(),
            createdById: waiter.id,
            updatedById: waiter.id,
            tableId: table?.id || null,
        },
    });
    await prisma.reservationEvent.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationId: r3.id,
            type: 'CREATED',
            actorUserId: waiter.id,
            message: 'Walk-in reservation',
        },
    });
    await prisma.reservationEvent.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationId: r3.id,
            type: 'SEATED',
            actorUserId: waiter.id,
            message: 'Party seated',
        },
    });
    console.log(`  ✅ Reservation RES-000003 (SEATED) created`);
    created++;

    // 4) CANCELLED reservation
    const r4 = await prisma.reservation.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationNumber: 'RES-000004',
            customerName: 'Peter Ssemakula',
            customerPhone: '+256780111222',
            partySize: 3,
            reservationAt: dayAfter,
            source: 'INSTAGRAM',
            status: 'CANCELLED',
            cancelledAt: new Date(),
            createdById: waiter.id,
            updatedById: owner.id,
        },
    });
    await prisma.reservationEvent.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationId: r4.id,
            type: 'CANCELLED',
            actorUserId: owner.id,
            message: 'Customer cancelled — schedule conflict',
        },
    });
    console.log(`  ✅ Reservation RES-000004 (CANCELLED) created`);
    created++;

    // 5) NO_SHOW reservation
    const r5 = await prisma.reservation.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationNumber: 'RES-000005',
            customerName: 'Amina Nambi',
            customerPhone: '+256700555666',
            partySize: 5,
            reservationAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
            source: 'PHONE',
            status: 'NO_SHOW',
            confirmedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            noShowAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
            createdById: waiter.id,
            updatedById: owner.id,
        },
    });
    await prisma.reservationEvent.create({
        data: {
            orgId,
            branchId: branch.id,
            reservationId: r5.id,
            type: 'NO_SHOW',
            actorUserId: owner.id,
            message: 'Marked as no-show after 30 minutes past reservation time',
        },
    });
    console.log(`  ✅ Reservation RES-000005 (NO_SHOW) created`);
    created++;

    return { created, skipped };
}

// ── M17: Events + Booking Portal + Ticketing ──

async function seedEvents(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping events`);
        return { created: 0, skipped: 0 };
    }

    const owner = await prisma.user.findUnique({ where: { email: 'owner@demo.local' } });
    const waiter = await prisma.user.findUnique({ where: { email: 'waiter@demo.local' } });
    if (!owner || !waiter) {
        console.log(`  ⚠️  Demo users not found — skipping events`);
        return { created: 0, skipped: 0 };
    }

    // Idempotency check
    const existing = await prisma.event.findFirst({
        where: { branchId: branch.id },
    });
    if (existing) {
        console.log(`  ⏭  Events for branch "${branchCode}" already exist — skipped`);
        return { created: 0, skipped: 3 };
    }

    const nextFriday = new Date();
    nextFriday.setDate(nextFriday.getDate() + ((5 - nextFriday.getDay() + 7) % 7 || 7));
    nextFriday.setHours(20, 0, 0, 0);

    const nextSaturday = new Date(nextFriday);
    nextSaturday.setDate(nextSaturday.getDate() + 1);
    nextSaturday.setHours(18, 0, 0, 0);

    // 1) DRAFT event
    await prisma.event.create({
        data: {
            orgId,
            branchId: branch.id,
            eventNumber: 'EVT-000001',
            title: 'Jazz Night — Draft',
            description: 'An upcoming jazz event still in planning',
            startsAt: nextFriday,
            endsAt: new Date(nextFriday.getTime() + 4 * 60 * 60 * 1000),
            capacity: 80,
            status: 'DRAFT',
            createdById: owner.id,
        },
    });
    await prisma.eventAuditLog.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: (await prisma.event.findFirst({ where: { branchId: branch.id, eventNumber: 'EVT-000001' } }))!.id,
            type: 'EVENT_CREATED',
            actorUserId: owner.id,
            message: 'Event EVT-000001 created: "Jazz Night — Draft"',
        },
    });
    console.log(`  ✅ Event EVT-000001 (DRAFT) created`);
    created++;

    // 2) PUBLISHED/OPEN event with ticket classes, bookings, tickets, check-ins
    const evt2 = await prisma.event.create({
        data: {
            orgId,
            branchId: branch.id,
            eventNumber: 'EVT-000002',
            title: 'Saturday Vibes Party',
            slug: 'saturday-vibes-party',
            portalKey: 'demo-portal-key-001',
            description: 'Live DJ, cocktails, and good vibes every Saturday!',
            startsAt: nextSaturday,
            endsAt: new Date(nextSaturday.getTime() + 5 * 60 * 60 * 1000),
            bookingOpensAt: new Date(),
            bookingClosesAt: nextSaturday,
            capacity: 150,
            soldCount: 5,
            checkedInCount: 1,
            status: 'OPEN',
            publishedAt: new Date(),
            createdById: owner.id,
            updatedById: owner.id,
        },
    });

    // Ticket classes
    const tcGeneral = await prisma.eventTicketClass.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            name: 'General Admission',
            type: 'GENERAL',
            price: 25000,
            capacity: 100,
            soldCount: 3,
            sortOrder: 0,
        },
    });

    const tcVip = await prisma.eventTicketClass.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            name: 'VIP Table',
            type: 'VIP',
            price: 100000,
            capacity: 50,
            soldCount: 2,
            sortOrder: 1,
            notes: 'Includes reserved table and a bottle',
        },
    });

    // Booking 1: CONFIRMED with tickets issued + 1 checked in
    const bkg1 = await prisma.eventBooking.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            ticketClassId: tcGeneral.id,
            bookingNumber: 'BKG-000001',
            customerName: 'Grace Nakamya',
            customerPhone: '+256700123456',
            quantity: 3,
            subtotal: 75000,
            status: 'CHECKED_IN',
            confirmedAt: new Date(),
            checkedInAt: new Date(),
            bookedById: waiter.id,
        },
    });

    // Issue 3 tickets for booking 1
    const tkt1 = await prisma.eventTicket.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            bookingId: bkg1.id,
            ticketClassId: tcGeneral.id,
            ticketNumber: 'TKT-000001',
            holderName: 'Grace Nakamya',
            holderPhone: '+256700123456',
            status: 'CHECKED_IN',
            checkedInAt: new Date(),
            qrToken: 'demo-qr-token-001',
        },
    });
    await prisma.eventTicket.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            bookingId: bkg1.id,
            ticketClassId: tcGeneral.id,
            ticketNumber: 'TKT-000002',
            holderName: 'Grace Nakamya',
            status: 'ISSUED',
            qrToken: 'demo-qr-token-002',
        },
    });
    await prisma.eventTicket.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            bookingId: bkg1.id,
            ticketClassId: tcGeneral.id,
            ticketNumber: 'TKT-000003',
            holderName: 'Grace Nakamya',
            status: 'ISSUED',
            qrToken: 'demo-qr-token-003',
        },
    });

    // Check-in record for ticket 1
    await prisma.eventCheckIn.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            bookingId: bkg1.id,
            ticketId: tkt1.id,
            actorUserId: waiter.id,
            status: 'SUCCESS',
            message: 'Welcome!',
        },
    });

    // Booking 2: CONFIRMED VIP booking (no tickets issued yet)
    await prisma.eventBooking.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            ticketClassId: tcVip.id,
            bookingNumber: 'BKG-000002',
            customerName: 'Daniel Okello',
            customerPhone: '+256771234567',
            customerEmail: 'daniel@example.com',
            quantity: 2,
            subtotal: 200000,
            depositAmount: 100000,
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            bookedById: owner.id,
            notes: 'VIP table near stage',
        },
    });

    // Booking 3: CANCELLED booking
    await prisma.eventBooking.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            ticketClassId: tcGeneral.id,
            bookingNumber: 'BKG-000003',
            customerName: 'Peter Ssemakula',
            quantity: 1,
            subtotal: 25000,
            status: 'CANCELLED',
            confirmedAt: new Date(Date.now() - 86400000),
            cancelledAt: new Date(),
            bookedById: waiter.id,
            notes: 'Customer requested cancellation',
        },
    });

    // Audit logs for event 2
    await prisma.eventAuditLog.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            type: 'EVENT_CREATED',
            actorUserId: owner.id,
            message: 'Event EVT-000002 created: "Saturday Vibes Party"',
        },
    });
    await prisma.eventAuditLog.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            type: 'EVENT_PUBLISHED',
            actorUserId: owner.id,
            message: 'Event published with portal key demo-portal-key-001',
        },
    });
    await prisma.eventAuditLog.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            bookingId: bkg1.id,
            type: 'BOOKING_CREATED',
            actorUserId: waiter.id,
            message: 'Booking BKG-000001 created for Grace Nakamya (3 × General Admission)',
        },
    });
    await prisma.eventAuditLog.create({
        data: {
            orgId,
            branchId: branch.id,
            eventId: evt2.id,
            bookingId: bkg1.id,
            ticketId: tkt1.id,
            type: 'TICKET_CHECKED_IN',
            actorUserId: waiter.id,
            message: 'Ticket TKT-000001 checked in',
        },
    });

    console.log(`  ✅ Event EVT-000002 (OPEN + ticket classes + bookings + tickets + check-in) created`);
    created++;

    // 3) CANCELLED event
    await prisma.event.create({
        data: {
            orgId,
            branchId: branch.id,
            eventNumber: 'EVT-000003',
            title: 'Cancelled Karaoke Night',
            description: 'Was planned but cancelled due to low interest',
            startsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            capacity: 40,
            status: 'CANCELLED',
            cancelledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            createdById: owner.id,
        },
    });
    console.log(`  ✅ Event EVT-000003 (CANCELLED) created`);
    created++;

    return { created, skipped };
}

// ── M18: Anomaly Detection + Anti-Theft Signals ──

async function seedAnalyticsData(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping analytics data`);
        return { created: 0, skipped: 0 };
    }

    const owner = await prisma.user.findUnique({ where: { email: 'owner@demo.local' } });
    if (!owner) {
        console.log(`  ⚠️  Owner user not found — skipping analytics data`);
        return { created: 0, skipped: 0 };
    }

    // ── Risk Thresholds (idempotent by orgId + key) ──
    const thresholds = [
        { key: 'void_rate_pct', name: 'Void Rate %', value: 10, unit: '%', description: 'Alert when void rate exceeds this % in a shift' },
        { key: 'discount_limit_per_hour', name: 'Discount Limit per Hour', value: 5, unit: 'count', description: 'Max discounts per staff member per hour before alert' },
        { key: 'cash_variance_limit', name: 'Cash Variance Limit', value: 5000, unit: 'UGX', description: 'Cash variance in UGX that triggers an alert' },
        { key: 'late_close_hours', name: 'Late Close Hours', value: 2, unit: 'hours', description: 'Hours past scheduled close time before alert is raised' },
        { key: 'refund_spike_per_hour', name: 'Refund Spike per Hour', value: 3, unit: 'count', description: 'Max refunds per staff member per hour before alert' },
        { key: 'price_override_enabled', name: 'Price Override Monitoring', boolValue: true, description: 'Enable monitoring of price override anomalies' },
    ];

    for (const t of thresholds) {
        const existing = await prisma.riskThreshold.findUnique({ where: { orgId_key: { orgId, key: t.key } } });
        if (existing) {
            console.log(`  ⏭  RiskThreshold "${t.key}" already exists — skipped`);
            skipped++;
        } else {
            await prisma.riskThreshold.create({
                data: {
                    orgId,
                    branchId: branch.id,
                    key: t.key,
                    name: t.name,
                    value: t.value !== undefined ? t.value : null,
                    boolValue: t.boolValue !== undefined ? t.boolValue : null,
                    unit: t.unit ?? null,
                    description: t.description ?? null,
                },
            });
            console.log(`  ✅ RiskThreshold "${t.key}" created`);
            created++;
        }
    }

    // ── Anomaly Rules (idempotent by orgId + code) ──
    const rules = [
        {
            code: 'VOID-SPIKE-01',
            name: 'Void Spike per Staff',
            type: 'VOID_SPIKE' as const,
            description: 'Flags staff with excessive void transactions in a shift',
            severity: 'HIGH' as const,
            metricKey: 'void_count',
            operator: 'GT',
            thresholdValue: 5,
            windowMinutes: 60,
            appliesToEntityType: 'STAFF' as const,
        },
        {
            code: 'DISC-ABUSE-01',
            name: 'Discount Abuse per Staff',
            type: 'DISCOUNT_ABUSE' as const,
            description: 'Flags staff applying excessive discounts per hour',
            severity: 'MEDIUM' as const,
            metricKey: 'discount_count',
            operator: 'GT',
            thresholdValue: 5,
            windowMinutes: 60,
            appliesToEntityType: 'STAFF' as const,
        },
        {
            code: 'CASH-VAR-01',
            name: 'Cash Variance Alert',
            type: 'CASH_VARIANCE' as const,
            description: 'Flags till sessions with large cash discrepancies',
            severity: 'HIGH' as const,
            metricKey: 'cash_variance_ugx',
            operator: 'GT',
            thresholdValue: 5000,
            windowMinutes: null,
            appliesToEntityType: 'TILL' as const,
        },
        {
            code: 'LATE-CLOSE-01',
            name: 'Late Shift Close',
            type: 'LATE_CLOSE' as const,
            description: 'Flags shifts closed significantly later than scheduled',
            severity: 'LOW' as const,
            metricKey: 'hours_past_close',
            operator: 'GT',
            thresholdValue: 2,
            windowMinutes: null,
            appliesToEntityType: 'SHIFT' as const,
        },
        {
            code: 'REFUND-SPIKE-01',
            name: 'Refund Spike per Staff',
            type: 'REFUND_SPIKE' as const,
            description: 'Flags staff processing excessive refunds per hour',
            severity: 'HIGH' as const,
            metricKey: 'refund_count',
            operator: 'GT',
            thresholdValue: 3,
            windowMinutes: 60,
            appliesToEntityType: 'STAFF' as const,
        },
    ];

    for (const r of rules) {
        const existing = await prisma.anomalyRule.findUnique({ where: { orgId_code: { orgId, code: r.code } } });
        if (existing) {
            console.log(`  ⏭  AnomalyRule "${r.code}" already exists — skipped`);
            skipped++;
        } else {
            await prisma.anomalyRule.create({
                data: {
                    orgId,
                    branchId: branch.id,
                    code: r.code,
                    name: r.name,
                    type: r.type,
                    description: r.description,
                    status: 'ACTIVE',
                    severity: r.severity,
                    metricKey: r.metricKey,
                    operator: r.operator,
                    thresholdValue: r.thresholdValue,
                    windowMinutes: r.windowMinutes ?? null,
                    appliesToEntityType: r.appliesToEntityType,
                    createdById: owner.id,
                },
            });
            console.log(`  ✅ AnomalyRule "${r.code}" created`);
            created++;
        }
    }

    // ── Sample Anomaly Event (idempotent: check if any event exists) ──
    const cashier = await prisma.user.findUnique({ where: { email: 'cashier@demo.local' } });
    const existingEvent = await prisma.anomalyEvent.findFirst({ where: { orgId, branchId: branch.id } });
    if (existingEvent) {
        console.log(`  ⏭  AnomalyEvent for branch "${branchCode}" already exists — skipped`);
        skipped++;
    } else if (cashier) {
        const voidRule = await prisma.anomalyRule.findUnique({ where: { orgId_code: { orgId, code: 'VOID-SPIKE-01' } } });
        await prisma.anomalyEvent.create({
            data: {
                orgId,
                branchId: branch.id,
                ruleId: voidRule?.id ?? null,
                type: 'VOID_SPIKE',
                status: 'OPEN',
                severity: 'HIGH',
                entityType: 'STAFF',
                entityId: cashier.id,
                actorUserId: cashier.id,
                title: 'Void spike detected for Demo Cashier',
                description: 'Demo Cashier processed 7 voids in the last 60 minutes (threshold: 5)',
                evidence: {
                    voidCount: 7,
                    windowMinutes: 60,
                    threshold: 5,
                    period: new Date().toISOString(),
                },
            },
        });
        console.log(`  ✅ Sample AnomalyEvent (VOID_SPIKE, OPEN) created`);
        created++;
    }

    return { created, skipped };
}

// ── M19: Operational Dashboards Seed Data ──

async function seedDashboardData(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping dashboard data`);
        return { created: 0, skipped: 0 };
    }

    const owner = await prisma.user.findUnique({ where: { email: 'owner@demo.local' } });
    if (!owner) {
        console.log(`  ⚠️  Owner user not found — skipping dashboard data`);
        return { created: 0, skipped: 0 };
    }

    // ── Sample KpiSnapshot (idempotent: check if any snapshot exists for branch) ──
    const existingSnapshot = await prisma.kpiSnapshot.findFirst({ where: { orgId, branchId: branch.id } });
    if (existingSnapshot) {
        console.log(`  ⏭  KpiSnapshot for branch "${branchCode}" already exists — skipped`);
        skipped++;
    } else {
        await prisma.kpiSnapshot.create({
            data: {
                orgId,
                branchId: branch.id,
                scopeType: 'BRANCH',
                metricWindow: 'TODAY',
                snapshotDate: new Date(new Date().setHours(0, 0, 0, 0)),
                grossSales: 1250000,
                netSales: 1215000,
                paymentCash: 750000,
                paymentCard: 300000,
                paymentMomo: 200000,
                refundsTotal: 35000,
                ordersOpenCount: 3,
                ordersClosedCount: 44,
                lowStockCount: 2,
                anomalyOpenCount: 1,
                anomalyHighCount: 0,
                reservationsTodayCount: 5,
                eventsTodayCount: 0,
                avgOrderValue: 26596,
                calculatedAt: new Date(),
            },
        });
        console.log(`  ✅ Sample KpiSnapshot (TODAY, BRANCH) created`);
        created++;
    }

    // ── Sample KpiSubscription (idempotent: check if subscription exists for owner) ──
    const existingSub = await prisma.kpiSubscription.findFirst({
        where: { orgId, branchId: branch.id, userId: owner.id },
    });
    if (existingSub) {
        console.log(`  ⏭  KpiSubscription for owner already exists — skipped`);
        skipped++;
    } else {
        await prisma.kpiSubscription.create({
            data: {
                orgId,
                branchId: branch.id,
                userId: owner.id,
                scopeType: 'OWNER',
                status: 'ACTIVE',
                lastPingAt: new Date(),
            },
        });
        console.log(`  ✅ Sample KpiSubscription (OWNER, ACTIVE) created`);
        created++;
    }

    return { created, skipped };
}

// ── M20: Reporting v1 + Exports Seed Data ──

async function seedReportsData(
    orgId: string,
    branchCode: string,
): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const branch = await prisma.branch.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: branchCode } },
    });
    if (!branch) {
        console.log(`  ⚠️  Branch "${branchCode}" not found — skipping reports data`);
        return { created: 0, skipped: 0 };
    }

    const owner = await prisma.user.findUnique({ where: { email: 'owner@demo.local' } });
    if (!owner) {
        console.log(`  ⚠️  Owner user not found — skipping reports data`);
        return { created: 0, skipped: 0 };
    }

    // ── Sample ReportRun (idempotent: check if any report run exists for branch) ──
    const existingRun = await prisma.reportRun.findFirst({ where: { orgId, branchId: branch.id } });
    if (existingRun) {
        console.log(`  ⏭  ReportRun for branch "${branchCode}" already exists — skipped`);
        skipped++;
    } else {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const run = await prisma.reportRun.create({
            data: {
                orgId,
                branchId: branch.id,
                reportType: 'DAILY_SALES',
                reportWindow: 'DAY',
                requestedById: owner.id,
                status: 'COMPLETED',
                dateFrom: todayStart,
                dateTo: todayEnd,
                rowCount: 12,
                summary: {
                    grossSales: '1250000',
                    netSales: '1215000',
                    taxTotal: '35000',
                    discountTotal: '15000',
                    orderCount: 12,
                    avgOrderValue: '101250',
                    paymentBreakdown: { CASH: '750000', CARD: '300000', MOMO: '165000' },
                    refundTotal: '20000',
                    refundCount: 1,
                },
                generatedAt: now,
            },
        });
        console.log(`  ✅ Sample ReportRun (DAILY_SALES, COMPLETED) created — ${run.id}`);
        created++;

        // ── Sample ExportArtifact (linked to the report run) ──
        const artifact = await prisma.exportArtifact.create({
            data: {
                orgId,
                branchId: branch.id,
                reportRunId: run.id,
                format: 'CSV',
                status: 'READY',
                fileName: `daily_sales_seed_${now.toISOString().replace(/[:.]/g, '-')}.csv`,
                mimeType: 'text/csv',
                storagePath: '/exports/daily_sales_seed.csv',
                fileSizeBytes: 512,
                checksum: 'seed-checksum-placeholder',
                generatedById: owner.id,
                readyAt: now,
            },
        });
        console.log(`  ✅ Sample ExportArtifact (CSV, READY) created — ${artifact.id}`);
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

    // 14) Seed Categories (M6)
    console.log('── Categories (M6) ──');
    const catResult = await seedCategories(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${catResult.created}, Skipped: ${catResult.skipped}\n`);

    // 15) Seed Tax Categories (M6)
    console.log('── Tax Categories (M6) ──');
    const taxCatResult = await seedTaxCategories(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${taxCatResult.created}, Skipped: ${taxCatResult.skipped}\n`);

    // 16) Seed Menu Items (M6)
    console.log('── Menu Items (M6) ──');
    const menuItemResult = await seedMenuItems(
        orgResult.orgId,
        'MAIN',
        catResult.categoryIds,
        taxCatResult.taxCategoryIds,
    );
    console.log(`   Created: ${menuItemResult.created}, Skipped: ${menuItemResult.skipped}\n`);

    // 17) Seed Browse Groups (M6.1)
    console.log('── Browse Groups (M6.1) ──');
    const bgResult = await seedBrowseGroups(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${bgResult.created}, Skipped: ${bgResult.skipped}\n`);

    // 18) Seed Browse Subgroups (M6.1)
    console.log('── Browse Subgroups (M6.1) ──');
    const bsgResult = await seedBrowseSubgroups(bgResult.groupIds);
    console.log(`   Created: ${bsgResult.created}, Skipped: ${bsgResult.skipped}\n`);

    // 19) Seed Browse Assignments (M6.1)
    console.log('── Browse Assignments (M6.1) ──');
    const assignResult = await seedBrowseAssignments(
        orgResult.orgId,
        'MAIN',
        bgResult.groupIds,
        bsgResult.subgroupIds,
    );
    console.log(`   Updated: ${assignResult.updated}, Skipped: ${assignResult.skipped}\n`);

    // 20) Seed Menu Item Servings (M6.1)
    console.log('── Menu Item Servings (M6.1) ──');
    const servingsResult = await seedMenuItemServings(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${servingsResult.created}, Skipped: ${servingsResult.skipped}\n`);

    // 21) Seed Modifier Groups (M7)
    console.log('── Modifier Groups (M7) ──');
    const modGroupResult = await seedModifierGroups(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${modGroupResult.created}, Skipped: ${modGroupResult.skipped}\n`);

    // 22) Seed Modifier Options (M7)
    console.log('── Modifier Options (M7) ──');
    const modOptionResult = await seedModifierOptions(modGroupResult.groupIds);
    console.log(`   Created: ${modOptionResult.created}, Skipped: ${modOptionResult.skipped}\n`);

    // 23) Seed Item ↔ Modifier Group Assignments (M7)
    console.log('── Item Modifier Assignments (M7) ──');
    const modAssignResult = await seedItemModifierAssignments(
        orgResult.orgId,
        'MAIN',
        modGroupResult.groupIds,
    );
    console.log(`   Created: ${modAssignResult.created}, Skipped: ${modAssignResult.skipped}\n`);

    // 24) Seed Inventory Items (M8)
    console.log('── Inventory Items (M8) ──');
    const invItemResult = await seedInventoryItems(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${invItemResult.created}, Skipped: ${invItemResult.skipped}\n`);

    // 25) Seed Recipes (M8)
    console.log('── Recipes (M8) ──');
    const recipeResult = await seedRecipes(orgResult.orgId, 'MAIN', invItemResult.itemIds);
    console.log(`   Created: ${recipeResult.created}, Skipped: ${recipeResult.skipped}\n`);

    // 26) Seed Stock Batches (M9)
    console.log('── Stock Batches (M9) ──');
    const stockBatchResult = await seedStockBatches(orgResult.orgId, 'MAIN', invItemResult.itemIds);
    console.log(`   Created: ${stockBatchResult.created}, Skipped: ${stockBatchResult.skipped}\n`);

    // 27) Seed Orders (M10)
    console.log('── Orders (M10) ──');
    const ordersResult = await seedOrders(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${ordersResult.created}, Skipped: ${ordersResult.skipped}\n`);

    // 28) Seed KDS Data (M11)
    console.log('── KDS Data (M11) ──');
    const kdsResult = await seedKdsData(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${kdsResult.created}, Skipped: ${kdsResult.skipped}\n`);

    // 29) Seed Discounts (M12)
    console.log('── Discounts (M12) ──');
    const discountsResult = await seedDiscounts(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${discountsResult.created}, Skipped: ${discountsResult.skipped}\n`);

    // 30) Seed Payments (M13)
    console.log('── Payments (M13) ──');
    const paymentsResult = await seedPayments(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${paymentsResult.created}, Skipped: ${paymentsResult.skipped}\n`);

    // 31) Seed Shifts + Tills (M15)
    console.log('── Shifts + Tills (M15) ──');
    const shiftsResult = await seedShiftsAndTills(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${shiftsResult.created}, Skipped: ${shiftsResult.skipped}\n`);

    // 32) Seed Reservations + Deposits (M16)
    console.log('── Reservations + Deposits (M16) ──');
    const reservationsResult = await seedReservations(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${reservationsResult.created}, Skipped: ${reservationsResult.skipped}\n`);

    // 33) Seed Events + Booking Portal + Ticketing (M17)
    console.log('── Events + Booking Portal + Ticketing (M17) ──');
    const eventsResult = await seedEvents(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${eventsResult.created}, Skipped: ${eventsResult.skipped}\n`);

    // 34) Seed Anomaly Detection + Anti-Theft Signals (M18)
    console.log('── Anomaly Detection + Anti-Theft Signals (M18) ──');
    const analyticsResult = await seedAnalyticsData(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${analyticsResult.created}, Skipped: ${analyticsResult.skipped}\n`);

    // 35) Seed Operational Dashboards + KPI Streams (M19)
    console.log('── Operational Dashboards + KPI Streams (M19) ──');
    const dashboardResult = await seedDashboardData(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${dashboardResult.created}, Skipped: ${dashboardResult.skipped}\n`);

    // 36) Seed Reporting v1 + Exports (M20)
    console.log('── Reporting v1 + Exports (M20) ──');
    const reportsResult = await seedReportsData(orgResult.orgId, 'MAIN');
    console.log(`   Created: ${reportsResult.created}, Skipped: ${reportsResult.skipped}\n`);

    // Record seed execution
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
    await recordSeedRun(
        'm6-menu-catalog',
        `Categories: ${catResult.created}c/${catResult.skipped}s | TaxCategories: ${taxCatResult.created}c/${taxCatResult.skipped}s | MenuItems: ${menuItemResult.created}c/${menuItemResult.skipped}s`,
    );
    await recordSeedRun(
        'm6.1-menu-taxonomy-servings',
        `BrowseGroups: ${bgResult.created}c/${bgResult.skipped}s | Subgroups: ${bsgResult.created}c/${bsgResult.skipped}s | Assignments: ${assignResult.updated}u/${assignResult.skipped}s | Servings: ${servingsResult.created}c/${servingsResult.skipped}s`,
    );
    await recordSeedRun(
        'm7-modifier-groups-options',
        `ModifierGroups: ${modGroupResult.created}c/${modGroupResult.skipped}s | ModifierOptions: ${modOptionResult.created}c/${modOptionResult.skipped}s | Assignments: ${modAssignResult.created}c/${modAssignResult.skipped}s`,
    );
    await recordSeedRun(
        'm8-recipes-costing',
        `InventoryItems: ${invItemResult.created}c/${invItemResult.skipped}s | Recipes: ${recipeResult.created}c/${recipeResult.skipped}s`,
    );
    await recordSeedRun(
        'm9-inventory-stock',
        `StockBatches: ${stockBatchResult.created}c/${stockBatchResult.skipped}s`,
    );
    await recordSeedRun(
        'm10-pos-orders',
        `Orders: ${ordersResult.created}c/${ordersResult.skipped}s`,
    );
    await recordSeedRun(
        'm11-kds-station-routing',
        `KDS: ${kdsResult.created}c/${kdsResult.skipped}s`,
    );
    await recordSeedRun(
        'm12-discounts-approval',
        `Discounts: ${discountsResult.created}c/${discountsResult.skipped}s`,
    );
    await recordSeedRun(
        'm13-payments',
        `Payments: ${paymentsResult.created}c/${paymentsResult.skipped}s`,
    );
    await recordSeedRun(
        'm15-shifts-tills',
        `Shifts+Tills: ${shiftsResult.created}c/${shiftsResult.skipped}s`,
    );
    await recordSeedRun(
        'm16-reservations-deposits',
        `Reservations: ${reservationsResult.created}c/${reservationsResult.skipped}s`,
    );
    await recordSeedRun(
        'm17-events-booking-ticketing',
        `Events: ${eventsResult.created}c/${eventsResult.skipped}s`,
    );
    await recordSeedRun(
        'm18-anomaly-anti-theft',
        `Analytics: ${analyticsResult.created}c/${analyticsResult.skipped}s`,
    );
    await recordSeedRun(
        'm19-dashboards-kpi-streams',
        `Dashboards: ${dashboardResult.created}c/${dashboardResult.skipped}s`,
    );
    await recordSeedRun(
        'm20-reporting-exports',
        `Reports: ${reportsResult.created}c/${reportsResult.skipped}s`,
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
