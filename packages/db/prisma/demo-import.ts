import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@prisma/client';

type CsvRow = Record<string, string>;
type TableMap = Map<string, CsvRow[]>;
type Counters = Record<string, { created: number; updated: number; skipped: number }>;

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
const DEMO_DIR = resolve(process.cwd(), process.env.DEMO_DATA_DIR ?? '../../demo-data/csv');
const WRITE = process.argv.includes('--write') || process.env.DEMO_DATA_WRITE === '1';
const SKIP_EXISTING = process.argv.includes('--skip-existing') || process.env.DEMO_IMPORT_SKIP_EXISTING === '1';
const DRY_RUN = !WRITE;
const EXPECTED_FILES = [
  '00_organizations.csv',
  '01_branches.csv',
  '02_users.csv',
  '03_memberships.csv',
  '04_org_settings.csv',
  '05_floor_plans.csv',
  '06_tables.csv',
  '07_tax_categories.csv',
  '08_menu_categories.csv',
  '09_menu_items.csv',
  '09a_menu_browse_groups.csv',
  '09b_menu_browse_subgroups.csv',
  '09c_menu_item_browse_assignments.csv',
  '10_menu_servings.csv',
  '11_modifier_groups.csv',
  '12_modifier_options.csv',
  '13_menu_item_modifier_groups.csv',
  '14_inventory_items.csv',
  '15_recipes.csv',
  '16_recipe_lines.csv',
  '17_suppliers.csv',
  '20_stock_batches.csv',
  '21_stock_ledger_entries.csv',
  '22_positions.csv',
  '23_compensation_profiles.csv',
  '24_employees.csv',
  '25_employment_contracts.csv',
  '26_shifts.csv',
  '27_tills.csv',
  '28_orders.csv',
  '29_order_items.csv',
  '30_order_item_modifiers.csv',
  '31_payments.csv',
  '32_refunds.csv',
  '33_receipt_events.csv',
  '34_reservations.csv',
  '35_reservation_deposits.csv',
  '36_events.csv',
  '37_event_ticket_classes.csv',
  '38_event_bookings.csv',
  '39_event_tickets.csv',
  '40_attendance.csv',
  '41_leave_requests.csv',
  '42_shift_swaps.csv',
  '43_accounts.csv',
  '44_cost_centers.csv',
  '45_fiscal_periods.csv',
  '46_journal_entries.csv',
  '47_journal_lines.csv',
  '48_vendor_bills.csv',
  '49_vendor_bill_lines.csv',
  '50_ap_payments.csv',
  '51_customer_accounts.csv',
  '52_ar_invoices.csv',
  '53_ar_invoice_lines.csv',
  '54_ar_receipts.csv',
  '55_feedback.csv',
  '56_anomalies.csv',
  '57_devices.csv',
  '58_printer_routes.csv',
  '59_reports_exports.csv',
  '60_alerts_channels_digests.csv',
  '61_feature_flags.csv',
  '62_maintenance_windows.csv',
  '63_training_sessions.csv',
  '64_hms_api_keys_access_logs.csv',
];

const EXPECTED_HEADERS: Record<string, string[]> = {
  '00_organizations.csv': ['name', 'slug', 'legalName', 'status', 'metadata'],
  '01_branches.csv': [
    'organizationSlug',
    'name',
    'code',
    'slug',
    'timezone',
    'currencyCode',
    'status',
    'address',
    'phone',
    'metadata',
  ],
  '02_users.csv': [
    'email',
    'password',
    'firstName',
    'lastName',
    'isActive',
    'displayName',
    'employeeCode',
    'pinTier',
  ],
  '03_memberships.csv': [
    'userEmail',
    'organizationSlug',
    'branchCode',
    'roleName',
    'status',
    'isDefault',
    'metadata',
  ],
  '04_org_settings.csv': [
    'organizationSlug',
    'vatPercent',
    'currency',
    'baseCurrencyCode',
    'discountApprovalThreshold',
    'reservationHoldMinutes',
    'showCostToChef',
    'taxMatrix',
    'rounding',
    'bookingPolicies',
    'attendance',
    'inventoryTolerance',
  ],
};

const enumValues = new Map<string, Set<string>>(
  Prisma.dmmf.datamodel.enums.map((e) => [e.name, new Set(e.values.map((v) => v.name))]),
);

const skippedFiles: Record<string, string> = {
  '15_recipes.csv': 'Recipe header rows are represented by recipe_lines against RecipeIngredient.',
  '18_purchase_orders.csv': 'No current Prisma model in scan/report; intentionally unsupported.',
  '19_goods_receipts.csv': 'No current Prisma model in scan/report; intentionally unsupported.',
  '30_order_item_modifiers.csv': 'No current OrderItemModifier model; modifier deltas validated in totals only.',
  '33_receipt_events.csv': 'Receipt send/history remains audit/service surface only; no delivered state imported.',
  '64_hms_api_keys_access_logs.csv':
    'HMS plaintext keys are never imported; create real local demo keys through dev API if needed.',
};

const QUICK_PIN_PEPPER = process.env.QUICK_PIN_PEPPER || 'nimbus-dev-pin-pepper';

const DEMO_QUICK_PINS: Record<
  string,
  { pin: string; tier: 'LOW_6' | 'HIGH_8'; pinLength: number }
> = {
  'manager@nimbus.demo': { pin: '11223344', tier: 'HIGH_8', pinLength: 8 },
  'supervisor@nimbus.demo': { pin: '22334455', tier: 'HIGH_8', pinLength: 8 },
  'cashier@nimbus.demo': { pin: '135790', tier: 'LOW_6', pinLength: 6 },
  'waiter@nimbus.demo': { pin: '246810', tier: 'LOW_6', pinLength: 6 },
  'chef@nimbus.demo': { pin: '357913', tier: 'LOW_6', pinLength: 6 },
  'bartender@nimbus.demo': { pin: '468024', tier: 'LOW_6', pinLength: 6 },
  'stockmanager@nimbus.demo': { pin: '579135', tier: 'LOW_6', pinLength: 6 },
};

function derivePinLookupHash(branchId: string, pin: string): string {
  return crypto.createHmac('sha256', QUICK_PIN_PEPPER).update(`${branchId}:${pin}`).digest('hex');
}

function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '"') {
      if (quoted && raw[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && raw[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
  }

  if (quoted) throw new Error('CSV ended inside quoted field');
  return rows;
}

function readCsv(file: string): CsvRow[] {
  const raw = readFileSync(join(DEMO_DIR, file), 'utf8').replace(/^\uFEFF/, '');
  if (raw.includes('C:\\Users\\arman\\Desktop\\NIMBUS\\nimbus-pos')) {
    throw new Error(`${file}: forbidden old repo path reference`);
  }
  const rows = parseCsv(raw);
  if (rows.length === 0) throw new Error(`${file}: empty file`);
  const headers = rows[0];
  for (const [idx, row] of rows.entries()) {
    if (row.length !== headers.length) {
      throw new Error(`${file}: malformed row ${idx + 1}; expected ${headers.length} cells, got ${row.length}`);
    }
  }

  const expected = EXPECTED_HEADERS[file];
  if (expected && expected.join('|') !== headers.join('|')) {
    throw new Error(`${file}: header mismatch. Expected ${expected.join(', ')}, got ${headers.join(', ')}`);
  }

  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ''])));
}

function loadTables(): TableMap {
  if (!existsSync(DEMO_DIR)) throw new Error(`Demo CSV directory not found: ${DEMO_DIR}`);
  const files = readdirSync(DEMO_DIR).filter((file) => file.endsWith('.csv')).sort();
  const duplicate = files.find((file, index) => files.indexOf(file) !== index);
  if (duplicate) throw new Error(`Duplicate CSV filename: ${duplicate}`);
  for (const file of EXPECTED_FILES) {
    if (!files.includes(file)) throw new Error(`Missing generated CSV: ${file}`);
  }

  const tables: TableMap = new Map();
  for (const file of files) tables.set(file, readCsv(file));
  return tables;
}

function rows(tables: TableMap, file: string): CsvRow[] {
  return tables.get(file) ?? [];
}

function required(row: CsvRow, field: string, file = 'csv'): string {
  const value = row[field];
  if (value === undefined || value === null || value === '') throw new Error(`${file}: missing required ${field}`);
  return value;
}

function optional(row: CsvRow, field: string): string | null {
  const value = row[field];
  return value === undefined || value === '' ? null : value;
}

function bool(value: string | null | undefined, fallback = false): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  return value.toLowerCase() === 'true';
}

function int(value: string | null | undefined, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid integer: ${value}`);
  return parsed;
}

function money(value: string | null | undefined, scale = 4): Prisma.Decimal {
  if (value === undefined || value === null || value === '') return new Prisma.Decimal(0);
  if (!new RegExp(`^-?\\d+(\\.\\d{1,${scale}})?$`).test(value)) throw new Error(`Invalid decimal value: ${value}`);
  return new Prisma.Decimal(value);
}

function date(value: string | null | undefined): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ISO date: ${value}`);
  return parsed;
}

function json(value: string | null | undefined, fallback: unknown = undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || value === '') return fallback as Prisma.InputJsonValue | undefined;
  return JSON.parse(value) as Prisma.InputJsonValue;
}

function enumValue(name: string, value: string): string {
  const allowed = enumValues.get(name);
  if (!allowed?.has(value)) throw new Error(`Invalid ${name}: ${value}`);
  return value;
}

function enumList(name: string, raw: string | undefined): string[] {
  if (!raw || raw.trim() === '' || raw.trim() === '[]') return [];
  const values = raw.trim().startsWith('[') ? (JSON.parse(raw) as string[]) : raw.split('|');
  return values.filter(Boolean).map((value) => enumValue(name, value));
}

function key(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => part ?? '').join('::');
}

function stableId(label: string): string {
  return `c${crypto.createHash('sha256').update(`nimbus-demo:${label}`).digest('hex').slice(0, 23)}`;
}

function lineKey(branchCode: string, orderNumber: string, lineNo: string): string {
  return key(branchCode, orderNumber, lineNo);
}

function paymentNaturalKey(row: CsvRow): string {
  return key(row.branchCode, row.orderNumber, row.transactionId || row.providerRef, row.method, row.amount);
}

function addCounter(counters: Counters, domain: string, kind: 'created' | 'updated' | 'skipped'): void {
  counters[domain] ??= { created: 0, updated: 0, skipped: 0 };
  counters[domain][kind] += 1;
}

function addCounterBy(counters: Counters, domain: string, kind: 'created' | 'updated' | 'skipped', amount: number): void {
  if (amount <= 0) return;
  counters[domain] ??= { created: 0, updated: 0, skipped: 0 };
  counters[domain][kind] += amount;
}

function chunks<T>(items: T[], size = 250): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function assertUnique(file: string, records: CsvRow[], naturalKey: (row: CsvRow) => string): void {
  const seen = new Set<string>();
  for (const row of records) {
    const value = naturalKey(row);
    if (seen.has(value)) throw new Error(`${file}: duplicate natural key ${value}`);
    seen.add(value);
  }
}

function validatePack(tables: TableMap): { rowCounts: Record<string, number>; warnings: string[] } {
  const warnings: string[] = [];
  const rowCounts = Object.fromEntries([...tables].map(([file, tableRows]) => [file, tableRows.length]));

  assertUnique('00_organizations.csv', rows(tables, '00_organizations.csv'), (r) => required(r, 'slug'));
  assertUnique('01_branches.csv', rows(tables, '01_branches.csv'), (r) => key(r.organizationSlug, r.code));
  assertUnique('02_users.csv', rows(tables, '02_users.csv'), (r) => required(r, 'email').toLowerCase());
  assertUnique('03_memberships.csv', rows(tables, '03_memberships.csv'), (r) =>
    key(r.userEmail.toLowerCase(), r.branchCode),
  );
  assertUnique('06_tables.csv', rows(tables, '06_tables.csv'), (r) => key(r.branchCode, r.label));
  assertUnique('09_menu_items.csv', rows(tables, '09_menu_items.csv'), (r) => key(r.branchCode, r.categoryName, r.name));
  assertUnique('09a_menu_browse_groups.csv', rows(tables, '09a_menu_browse_groups.csv'), (r) => key(r.branchCode, r.name));
  assertUnique('09b_menu_browse_subgroups.csv', rows(tables, '09b_menu_browse_subgroups.csv'), (r) => key(r.branchCode, r.groupName, r.name));
  assertUnique('09c_menu_item_browse_assignments.csv', rows(tables, '09c_menu_item_browse_assignments.csv'), (r) => key(r.branchCode, r.menuItemName));
  assertUnique('28_orders.csv', rows(tables, '28_orders.csv'), (r) => key(r.branchCode, r.orderNumber));
  assertUnique('31_payments.csv', rows(tables, '31_payments.csv'), paymentNaturalKey);
  assertUnique('46_journal_entries.csv', rows(tables, '46_journal_entries.csv'), (r) => key(r.organizationSlug, r.journalNumber));

  for (const record of rows(tables, '00_organizations.csv')) enumValue('OrganizationStatus', record.status);
  for (const record of rows(tables, '01_branches.csv')) enumValue('BranchStatus', record.status);
  for (const record of rows(tables, '03_memberships.csv')) enumValue('MembershipStatus', record.status);
  for (const record of rows(tables, '06_tables.csv')) enumValue('TableStatus', record.status);
  for (const record of rows(tables, '09_menu_items.csv')) {
    enumValue('MenuItemType', record.itemType);
    enumValue('PrepStation', record.station);
    money(record.price, 2);
  }
  for (const record of rows(tables, '09a_menu_browse_groups.csv')) enumValue('MenuSection', record.section);
  for (const record of rows(tables, '10_menu_servings.csv')) {
    enumValue('ServingFormat', record.format);
    money(record.price, 2);
  }
  for (const record of rows(tables, '14_inventory_items.csv')) money(record.theoreticalUnitCost, 3);
  for (const record of rows(tables, '20_stock_batches.csv')) {
    money(record.qtyReceived, 3);
    money(record.qtyRemaining, 3);
    money(record.unitCost, 4);
    date(record.receivedAt);
    date(record.expiresAt);
    if (money(record.qtyRemaining, 3).lessThan(0)) throw new Error('Stock remaining cannot be negative');
  }
  for (const record of rows(tables, '28_orders.csv')) {
    enumValue('OrderStatus', record.status);
    enumValue('ServiceType', record.serviceType);
    money(record.subtotal, 2);
    money(record.tax, 2);
    money(record.discount, 2);
    money(record.total, 2);
  }
  for (const record of rows(tables, '31_payments.csv')) {
    enumValue('PaymentMethod', record.method);
    enumValue('PaymentStatus', record.status);
    enumValue('PaymentCaptureMode', record.captureMode);
    enumValue('PaymentVerificationStatus', record.verificationStatus);
    if (record.method === 'MOMO') {
      if (record.status !== 'PENDING') throw new Error('Public/diner mobile-money rows must remain pending');
      if (record.captureMode !== 'ONLINE_PROVIDER') throw new Error('Mobile-money rows must remain provider-gated');
    }
    if (/PESAPAL/i.test(record.provider)) throw new Error('PesaPal rows are not allowed for diner checkout payments');
  }
  for (const record of rows(tables, '33_receipt_events.csv')) {
    if (!record.action.startsWith('RECEIPT_')) throw new Error(`Unsupported receipt action: ${record.action}`);
    if (/DELIVERED|SEND_SUCCESS|LIVE/i.test(record.action)) throw new Error(`Unsafe receipt action: ${record.action}`);
    if (record.action === 'RECEIPT_SEND_PENDING' && !record.metadata.includes('"PENDING"')) {
      throw new Error('Receipt send rows must stay PENDING');
    }
  }
  for (const record of rows(tables, '57_devices.csv')) {
    enumValue('DeviceType', record.type);
    enumValue('DeviceStatus', record.status);
    if (record.type === 'PAYMENT_TERMINAL_STUB' && !record.metadata.includes('"acquirerTraffic": false')) {
      throw new Error('Terminal stubs must not imply acquirer/card-terminal traffic');
    }
    if (record.type === 'PRINTER' && !record.metadata.includes('"printDriverInvoked": false')) {
      throw new Error('Printer devices must remain metadata only');
    }
  }
  for (const record of rows(tables, '58_printer_routes.csv')) {
    enumValue('PrinterRouteType', record.routeType);
    if (!record.metadata.includes('"metadataOnly": true') || !record.metadata.includes('"noPrintDriver": true')) {
      throw new Error('Printer routes must remain metadata-only/no-driver');
    }
  }
  for (const record of rows(tables, '64_hms_api_keys_access_logs.csv')) {
    if (!record.metadata.includes('"noPlaintextSecret": true')) throw new Error('HMS CSV must not contain plaintext API secrets');
  }

  const itemSubtotals = new Map<string, Prisma.Decimal>();
  for (const item of rows(tables, '29_order_items.csv')) {
    const k = key(item.branchCode, item.orderNumber);
    itemSubtotals.set(k, (itemSubtotals.get(k) ?? new Prisma.Decimal(0)).plus(money(item.subtotal, 2)));
  }
  for (const mod of rows(tables, '30_order_item_modifiers.csv')) {
    const k = key(mod.branchCode, mod.orderNumber);
    itemSubtotals.set(k, (itemSubtotals.get(k) ?? new Prisma.Decimal(0)).plus(money(mod.priceDelta, 2)));
  }
  for (const order of rows(tables, '28_orders.csv')) {
    const subtotal = itemSubtotals.get(key(order.branchCode, order.orderNumber)) ?? new Prisma.Decimal(0);
    if (!subtotal.toDecimalPlaces(2).equals(money(order.subtotal, 2))) {
      throw new Error(`${order.orderNumber}: item subtotal ${subtotal.toFixed(2)} != order subtotal ${order.subtotal}`);
    }
    const computedTotal = money(order.subtotal, 2).plus(money(order.tax, 2)).minus(money(order.discount, 2));
    if (!computedTotal.toDecimalPlaces(2).equals(money(order.total, 2))) {
      throw new Error(`${order.orderNumber}: total formula mismatch`);
    }
  }

  const paidByOrder = new Map<string, Prisma.Decimal>();
  for (const payment of rows(tables, '31_payments.csv')) {
    const k = key(payment.branchCode, payment.orderNumber);
    paidByOrder.set(k, (paidByOrder.get(k) ?? new Prisma.Decimal(0)).plus(money(payment.amount, 2)));
  }
  for (const order of rows(tables, '28_orders.csv')) {
    const paid = paidByOrder.get(key(order.branchCode, order.orderNumber)) ?? new Prisma.Decimal(0);
    if (order.status === 'CLOSED' && !paid.toDecimalPlaces(2).equals(money(order.total, 2))) {
      throw new Error(`${order.orderNumber}: closed order payment ${paid.toFixed(2)} != total ${order.total}`);
    }
    if (paid.greaterThan(money(order.total, 2))) throw new Error(`${order.orderNumber}: payment exceeds order total`);
  }

  const journalTotals = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
  for (const line of rows(tables, '47_journal_lines.csv')) {
    enumValue('JournalLineDirection', line.direction);
    const rec = journalTotals.get(line.journalNumber) ?? { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) };
    if (line.direction === 'DEBIT') rec.debit = rec.debit.plus(money(line.amount, 2));
    if (line.direction === 'CREDIT') rec.credit = rec.credit.plus(money(line.amount, 2));
    journalTotals.set(line.journalNumber, rec);
  }
  for (const [journalNumber, total] of journalTotals.entries()) {
    if (!total.debit.toDecimalPlaces(2).equals(total.credit.toDecimalPlaces(2))) {
      throw new Error(`${journalNumber}: journal entry does not balance`);
    }
  }

  const billLines = new Map<string, Prisma.Decimal>();
  for (const line of rows(tables, '49_vendor_bill_lines.csv')) {
    billLines.set(line.billNumber, (billLines.get(line.billNumber) ?? new Prisma.Decimal(0)).plus(money(line.lineTotal, 2)));
  }
  for (const bill of rows(tables, '48_vendor_bills.csv')) {
    const lineTotal = billLines.get(bill.billNumber) ?? new Prisma.Decimal(0);
    if (!lineTotal.toDecimalPlaces(2).equals(money(bill.subtotal, 2))) throw new Error(`${bill.billNumber}: AP line subtotal mismatch`);
  }
  const invoiceLines = new Map<string, Prisma.Decimal>();
  for (const line of rows(tables, '53_ar_invoice_lines.csv')) {
    invoiceLines.set(line.invoiceNumber, (invoiceLines.get(line.invoiceNumber) ?? new Prisma.Decimal(0)).plus(money(line.lineTotal, 2)));
  }
  for (const invoice of rows(tables, '52_ar_invoices.csv')) {
    const lineTotal = invoiceLines.get(invoice.invoiceNumber) ?? new Prisma.Decimal(0);
    if (!lineTotal.toDecimalPlaces(2).equals(money(invoice.subtotal, 2))) throw new Error(`${invoice.invoiceNumber}: AR line subtotal mismatch`);
  }

  warnings.push(...Object.entries(skippedFiles).map(([file, reason]) => `${file}: ${reason}`));
  return { rowCounts, warnings };
}

async function upsertById(delegate: any, id: string, data: Record<string, unknown>): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await delegate.findUnique({ where: { id } });
  if (existing && SKIP_EXISTING) return 'skipped';
  if (existing) {
    await delegate.update({ where: { id }, data });
    return 'updated';
  }
  await delegate.create({ data: { id, ...data } });
  return 'created';
}

async function upsertWithWhere(delegate: any, where: Record<string, unknown>, create: Record<string, unknown>, update: Record<string, unknown>): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await delegate.findUnique({ where });
  if (existing && SKIP_EXISTING) return 'skipped';
  await delegate.upsert({ where, create, update });
  return existing ? 'updated' : 'created';
}

async function ensureUserRole(
  userId: string,
  roleId: string,
  orgId: string | null,
  branchId: string | null,
): Promise<'created' | 'skipped'> {
  const existing = await prisma.userRole.findFirst({ where: { userId, roleId, orgId, branchId } });
  if (existing) return 'skipped';

  await prisma.userRole.create({
    data: {
      id: stableId(`user-role:${userId}:${roleId}:${orgId ?? 'global'}:${branchId ?? 'all'}`),
      userId,
      roleId,
      orgId,
      branchId,
    },
  });
  return 'created';
}

async function setKnownDemoQuickPin(
  user: { id: string; email: string; firstName: string; lastName: string },
  branchId: string,
  pinSpec: { pin: string; tier: 'LOW_6' | 'HIGH_8'; pinLength: number },
): Promise<'updated'> {
  const lookupHash = derivePinLookupHash(branchId, pinSpec.pin);
  const collision = await prisma.user.findUnique({ where: { pinLookupHash: lookupHash } });
  if (collision && collision.id !== user.id) {
    throw new Error(`Quick PIN lookup collision for ${user.email}`);
  }

  const pinHash = await bcrypt.hash(pinSpec.pin, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      quickPinHash: pinHash,
      pinLookupHash: lookupHash,
      pinLength: pinSpec.pinLength,
      pinTier: pinSpec.tier,
      quickPinEnabled: true,
      lastPinChangedAt: new Date(),
      quickPinIssuedAt: new Date(),
      displayName: `${user.firstName} ${user.lastName}`,
      failedPinAttempts: 0,
      pinLockedUntil: null,
    },
  });

  return 'updated';
}

async function ensureDerivedFranchiseAnalytics(
  counters: Counters,
  org: { id: string } | undefined,
  branches: Array<{ id: string; code: string; name: string }>,
  generatedById?: string,
): Promise<void> {
  if (!org || branches.length === 0) {
    addCounter(counters, 'franchiseAnalytics', 'skipped');
    return;
  }

  const windowStart = new Date('2026-06-01T00:00:00.000Z');
  const windowEnd = new Date('2026-06-30T23:59:59.000Z');
  const generatedAt = new Date('2026-06-30T12:00:00.000Z');
  const runId = stableId('franchise:consolidation:nimbus:2026-06');

  addCounter(
    counters,
    'franchiseConsolidations',
    await upsertById(prisma.franchiseConsolidationRun, runId, {
      orgId: org.id,
      windowType: 'MONTHLY',
      windowStart,
      windowEnd,
      status: 'COMPLETED',
      branchCount: branches.length,
      metricsCount: 3,
      errorMessage: null,
      summary: { demoOnly: true, preparedLocally: true, month: '2026-06' },
      generatedById: generatedById ?? null,
      startedAt: generatedAt,
      completedAt: generatedAt,
    }),
  );

  const branchBreakdown = Object.fromEntries(
    branches.map((branch, index) => [
      branch.code,
      {
        branchName: branch.name,
        revenueIndex: 100 - index * 7,
        primeCostIndex: 62 + index * 3,
      },
    ]),
  );

  for (const metric of [
    { family: 'REVENUE', value: '482500000.00', previousValue: '455000000.00', changePercent: '6.0440' },
    { family: 'GROSS_PROFIT', value: '289500000.00', previousValue: '270000000.00', changePercent: '7.2222' },
    { family: 'PRIME_COST', value: '301200000.00', previousValue: '295000000.00', changePercent: '2.1017' },
  ]) {
    addCounter(
      counters,
      'franchiseKpis',
      await upsertById(prisma.franchiseKpiSnapshot, stableId(`franchise:kpi:${metric.family}:2026-06`), {
        orgId: org.id,
        consolidationRunId: runId,
        metricFamily: metric.family,
        windowType: 'MONTHLY',
        windowStart,
        windowEnd,
        value: new Prisma.Decimal(metric.value),
        previousValue: new Prisma.Decimal(metric.previousValue),
        changePercent: new Prisma.Decimal(metric.changePercent),
        branchBreakdown,
        calculationBasis: 'Derived from imported local enterprise demo rows.',
        sourceQuery: null,
        metadata: { demoOnly: true, preparedLocally: true },
        generatedAt,
      }),
    );
  }

  const scorecardDomains = ['FINANCIAL', 'PRIME_COST', 'STOCK_HEALTH'] as const;
  for (const [index, branch] of branches.entries()) {
    for (const domain of scorecardDomains) {
      addCounter(
        counters,
        'branchScorecards',
        await upsertById(prisma.branchPerformanceScorecard, stableId(`franchise:scorecard:${branch.code}:${domain}:2026-06`), {
          orgId: org.id,
          branchId: branch.id,
          domain,
          windowType: 'MONTHLY',
          windowStart,
          windowEnd,
          tier: index < 2 ? 'STRONG' : 'WATCH',
          rank: index + 1,
          percentile: new Prisma.Decimal((92 - index * 8).toFixed(2)),
          kpiValues: {
            demoOnly: true,
            revenueIndex: 100 - index * 7,
            primeCostPct: 62 + index * 3,
            stockHealthPct: 94 - index * 5,
          },
          thresholds: { strong: 85, watch: 65, atRisk: 50 },
          drilldownHint: { branchCode: branch.code, source: 'local-demo-importer' },
          metadata: { demoOnly: true, preparedLocally: true },
          generatedAt,
        }),
      );
    }

    addCounter(
      counters,
      'franchiseRankings',
      await upsertById(prisma.franchiseRanking, stableId(`franchise:ranking:${branch.code}:REVENUE:2026-06`), {
        orgId: org.id,
        branchId: branch.id,
        rankingType: 'REVENUE',
        windowType: 'MONTHLY',
        windowStart,
        windowEnd,
        rank: index + 1,
        score: new Prisma.Decimal((100 - index * 7).toFixed(4)),
        normalizationBasis: 'Synthetic local demo index, prepared from imported branch set.',
        sourceSignals: { branchCode: branch.code, demoOnly: true },
        branchCount: branches.length,
        metadata: { demoOnly: true, preparedLocally: true },
        generatedAt,
      }),
    );
  }
}

async function importDemoData(tables: TableMap): Promise<{ counters: Counters; summary: Record<string, number> }> {
  const counters: Counters = {};
  const orgBySlug = new Map<string, any>();
  const branchByCode = new Map<string, any>();
  const userByEmail = new Map<string, any>();
  const roleByName = new Map<string, any>();
  const floorByBranchName = new Map<string, any>();
  const tableByBranchLabel = new Map<string, any>();
  const taxByBranchName = new Map<string, any>();
  const categoryByBranchName = new Map<string, any>();
  const browseGroupByBranchName = new Map<string, any>();
  const browseSubgroupByBranchName = new Map<string, any>();
  const menuByBranchName = new Map<string, any>();
  const servingByItemLabel = new Map<string, any>();
  const modGroupByBranchName = new Map<string, any>();
  const modOptionByGroupName = new Map<string, any>();
  const invByBranchName = new Map<string, any>();
  const supplierByName = new Map<string, any>();
  const positionByCode = new Map<string, any>();
  const compByCode = new Map<string, any>();
  const employeeByCode = new Map<string, any>();
  const shiftByNumber = new Map<string, any>();
  const orderByBranchNumber = new Map<string, any>();
  const orderItemByLine = new Map<string, any>();
  const paymentByRef = new Map<string, any>();
  const reservationByNumber = new Map<string, any>();
  const eventByNumber = new Map<string, any>();
  const ticketClassByEventName = new Map<string, any>();
  const bookingByNumber = new Map<string, any>();
  const accountByCode = new Map<string, any>();
  const costCenterByCode = new Map<string, any>();
  const fiscalByName = new Map<string, any>();
  const journalByNumber = new Map<string, any>();
  const vendorBillByNumber = new Map<string, any>();
  const customerByCode = new Map<string, any>();
  const invoiceByNumber = new Map<string, any>();
  const deviceByActivation = new Map<string, any>();

  for (const row of rows(tables, '00_organizations.csv')) {
    const result = await upsertWithWhere(
      prisma.organization,
      { slug: row.slug },
      {
        id: stableId(`org:${row.slug}`),
        name: row.name,
        slug: row.slug,
        legalName: optional(row, 'legalName'),
        status: enumValue('OrganizationStatus', row.status),
      },
      {
        name: row.name,
        legalName: optional(row, 'legalName'),
        status: enumValue('OrganizationStatus', row.status),
      },
    );
    addCounter(counters, 'organizations', result);
    orgBySlug.set(row.slug, await prisma.organization.findUniqueOrThrow({ where: { slug: row.slug } }));
  }

  const roles = await prisma.role.findMany();
  for (const role of roles) roleByName.set(role.name, role);

  for (const row of rows(tables, '01_branches.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const data = {
      organizationId: org.id,
      name: row.name,
      code: row.code,
      slug: row.slug,
      timezone: row.timezone,
      currencyCode: row.currencyCode,
      address: optional(row, 'address'),
      phone: optional(row, 'phone'),
      status: enumValue('BranchStatus', row.status),
    };
    const result = await upsertWithWhere(
      prisma.branch,
      { organizationId_code: { organizationId: org.id, code: row.code } },
      { id: stableId(`branch:${row.organizationSlug}:${row.code}`), ...data },
      data,
    );
    addCounter(counters, 'branches', result);
    branchByCode.set(row.code, await prisma.branch.findUniqueOrThrow({ where: { organizationId_code: { organizationId: org.id, code: row.code } } }));
  }

  for (const row of rows(tables, '02_users.csv')) {
    const passwordHash = await bcrypt.hash(row.password, SALT_ROUNDS);
    const data = {
      email: row.email.toLowerCase(),
      passwordHash,
      firstName: row.firstName,
      lastName: row.lastName,
      isActive: bool(row.isActive, true),
      displayName: optional(row, 'displayName'),
      employeeCode: optional(row, 'employeeCode'),
      pinTier: optional(row, 'pinTier'),
      mustChangePassword: false,
    };
    const result = await upsertWithWhere(
      prisma.user,
      { email: row.email.toLowerCase() },
      { id: stableId(`user:${row.email.toLowerCase()}`), ...data },
      { ...data, passwordHash: undefined },
    );
    addCounter(counters, 'users', result);
    userByEmail.set(row.email.toLowerCase(), await prisma.user.findUniqueOrThrow({ where: { email: row.email.toLowerCase() } }));
  }

  for (const row of rows(tables, '03_memberships.csv')) {
    const user = userByEmail.get(row.userEmail.toLowerCase());
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const role = roleByName.get(row.roleName);
    if (!user || !branch || !org || !role) throw new Error(`Cannot resolve membership ${JSON.stringify(row)}`);
    const data = {
      userId: user.id,
      organizationId: org.id,
      branchId: branch.id,
      roleId: role.id,
      status: enumValue('MembershipStatus', row.status),
      isDefaultBranch: bool(row.isDefault),
    };
    const result = await upsertWithWhere(
      prisma.membership,
      { userId_branchId: { userId: user.id, branchId: branch.id } },
      { id: stableId(`membership:${row.userEmail}:${row.branchCode}`), ...data },
      data,
    );
    addCounter(counters, 'memberships', result);

    const roleResult = await ensureUserRole(user.id, role.id, org.id, null);
    addCounter(counters, 'userRoles', roleResult);
  }

  for (const [email, pinSpec] of Object.entries(DEMO_QUICK_PINS)) {
    const user = userByEmail.get(email);
    if (!user) {
      addCounter(counters, 'quickPins', 'skipped');
      continue;
    }

    const defaultMembership = await prisma.membership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: [{ isDefaultBranch: 'desc' }, { createdAt: 'asc' }],
    });
    if (!defaultMembership) {
      addCounter(counters, 'quickPins', 'skipped');
      continue;
    }

    const result = await setKnownDemoQuickPin(user, defaultMembership.branchId, pinSpec);
    addCounter(counters, 'quickPins', result);
  }

  await ensureDerivedFranchiseAnalytics(
    counters,
    orgBySlug.get('nimbus'),
    ['TAPAS_DOWNTOWN', 'ROOFTOP_BAR', 'GARDEN_CAFE', 'EVENTS_KITCHEN']
      .map((code) => branchByCode.get(code))
      .filter((branch): branch is { id: string; code: string; name: string } => Boolean(branch)),
    userByEmail.get('franchise.ops@nimbus.demo')?.id ?? userByEmail.get('manager@nimbus.demo')?.id,
  );

  for (const row of rows(tables, '04_org_settings.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const data = {
      orgId: org.id,
      vatPercent: money(row.vatPercent, 2),
      currency: row.currency,
      baseCurrencyCode: optional(row, 'baseCurrencyCode'),
      discountApprovalThreshold: money(row.discountApprovalThreshold, 2),
      reservationHoldMinutes: int(row.reservationHoldMinutes),
      showCostToChef: bool(row.showCostToChef),
      taxMatrix: json(row.taxMatrix),
      rounding: json(row.rounding),
      bookingPolicies: json(row.bookingPolicies),
      attendance: json(row.attendance),
      inventoryTolerance: json(row.inventoryTolerance),
      metadata: { enterpriseDemo: true },
    };
    const result = await upsertWithWhere(prisma.orgSettings, { orgId: org.id }, { id: stableId(`settings:${row.organizationSlug}`), ...data }, data);
    addCounter(counters, 'orgSettings', result);
  }

  for (const row of rows(tables, '05_floor_plans.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const id = stableId(`floor:${row.branchCode}:${row.name}`);
    const result = await upsertById(prisma.floorPlan, id, {
      orgId: org.id,
      branchId: branch.id,
      name: row.name,
      data: json(row.data, {}),
      isActive: bool(row.isActive, true),
    });
    addCounter(counters, 'floorPlans', result);
    floorByBranchName.set(key(row.branchCode, row.name), await prisma.floorPlan.findUniqueOrThrow({ where: { id } }));
  }

  for (const row of rows(tables, '06_tables.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const floor = row.floorPlanName ? floorByBranchName.get(key(row.branchCode, row.floorPlanName)) : null;
    const data = {
      orgId: org.id,
      branchId: branch.id,
      floorPlanId: floor?.id ?? null,
      label: row.label,
      capacity: int(row.capacity),
      status: enumValue('TableStatus', row.status),
      isActive: true,
      metadata: json(row.metadata),
    };
    const result = await upsertWithWhere(
      prisma.table,
      { branchId_label: { branchId: branch.id, label: row.label } },
      { id: stableId(`table:${row.branchCode}:${row.label}`), ...data },
      data,
    );
    addCounter(counters, 'tables', result);
    tableByBranchLabel.set(key(row.branchCode, row.label), await prisma.table.findUniqueOrThrow({ where: { branchId_label: { branchId: branch.id, label: row.label } } }));
  }

  for (const row of rows(tables, '07_tax_categories.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const data = { orgId: org.id, branchId: branch.id, name: row.name, rate: money(row.rate, 2), isActive: true };
    const result = await upsertWithWhere(
      prisma.taxCategory,
      { branchId_name: { branchId: branch.id, name: row.name } },
      { id: stableId(`tax:${row.branchCode}:${row.name}`), ...data },
      data,
    );
    addCounter(counters, 'taxCategories', result);
    taxByBranchName.set(key(row.branchCode, row.name), await prisma.taxCategory.findUniqueOrThrow({ where: { branchId_name: { branchId: branch.id, name: row.name } } }));
  }

  for (const row of rows(tables, '08_menu_categories.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const data = { orgId: org.id, branchId: branch.id, name: row.name, sortOrder: int(row.sortOrder), isActive: bool(row.isActive, true) };
    const result = await upsertWithWhere(
      prisma.category,
      { branchId_name: { branchId: branch.id, name: row.name } },
      { id: stableId(`category:${row.branchCode}:${row.name}`), ...data },
      data,
    );
    addCounter(counters, 'menuCategories', result);
    categoryByBranchName.set(key(row.branchCode, row.name), await prisma.category.findUniqueOrThrow({ where: { branchId_name: { branchId: branch.id, name: row.name } } }));
  }

  for (const row of rows(tables, '09_menu_items.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const category = categoryByBranchName.get(key(row.branchCode, row.categoryName));
    const tax = taxByBranchName.get(key(row.branchCode, row.taxCategoryName));
    const data = {
      orgId: org.id,
      branchId: branch.id,
      categoryId: category.id,
      taxCategoryId: tax?.id ?? null,
      name: row.name,
      sku: optional(row, 'sku'),
      description: optional(row, 'description'),
      price: money(row.price, 2),
      itemType: enumValue('MenuItemType', row.itemType),
      station: enumValue('PrepStation', row.station),
      sortOrder: int(row.sortOrder),
      isActive: bool(row.isActive, true),
      metadata: json(row.metadata),
    };
    const result = await upsertWithWhere(
      prisma.menuItem,
      { categoryId_name: { categoryId: category.id, name: row.name } },
      { id: stableId(`menu:${row.branchCode}:${row.categoryName}:${row.name}`), ...data },
      data,
    );
    addCounter(counters, 'menuItems', result);
    menuByBranchName.set(key(row.branchCode, row.name), await prisma.menuItem.findUniqueOrThrow({ where: { categoryId_name: { categoryId: category.id, name: row.name } } }));
  }

  for (const row of rows(tables, '09a_menu_browse_groups.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const data = {
      orgId: org.id,
      branchId: branch.id,
      section: enumValue('MenuSection', row.section),
      name: row.name,
      internalKey: optional(row, 'internalKey'),
      sortOrder: int(row.sortOrder),
      isActive: bool(row.isActive, true),
    };
    const result = await upsertWithWhere(
      prisma.menuBrowseGroup,
      { branchId_name: { branchId: branch.id, name: row.name } },
      { id: stableId(`browse-group:${row.branchCode}:${row.name}`), ...data },
      data,
    );
    addCounter(counters, 'menuBrowseGroups', result);
    browseGroupByBranchName.set(key(row.branchCode, row.name), await prisma.menuBrowseGroup.findUniqueOrThrow({ where: { branchId_name: { branchId: branch.id, name: row.name } } }));
  }

  for (const row of rows(tables, '09b_menu_browse_subgroups.csv')) {
    const group = browseGroupByBranchName.get(key(row.branchCode, row.groupName));
    if (!group) throw new Error(`Missing browse group for subgroup ${JSON.stringify(row)}`);
    const data = {
      groupId: group.id,
      name: row.name,
      internalKey: optional(row, 'internalKey'),
      sortOrder: int(row.sortOrder),
      isActive: bool(row.isActive, true),
    };
    const result = await upsertWithWhere(
      prisma.menuBrowseSubgroup,
      { groupId_name: { groupId: group.id, name: row.name } },
      { id: stableId(`browse-subgroup:${row.branchCode}:${row.groupName}:${row.name}`), ...data },
      data,
    );
    addCounter(counters, 'menuBrowseSubgroups', result);
    browseSubgroupByBranchName.set(key(row.branchCode, row.groupName, row.name), await prisma.menuBrowseSubgroup.findUniqueOrThrow({ where: { groupId_name: { groupId: group.id, name: row.name } } }));
  }

  for (const row of rows(tables, '09c_menu_item_browse_assignments.csv')) {
    const item = menuByBranchName.get(key(row.branchCode, row.menuItemName));
    const group = browseGroupByBranchName.get(key(row.branchCode, row.groupName));
    const subgroupName = optional(row, 'subgroupName');
    const subgroup = subgroupName ? browseSubgroupByBranchName.get(key(row.branchCode, row.groupName, subgroupName)) : null;
    if (!item || !group) throw new Error(`Missing item/group browse assignment ${JSON.stringify(row)}`);
    if (subgroupName && !subgroup) throw new Error(`Missing browse subgroup for assignment ${JSON.stringify(row)}`);
    const result = await upsertById(prisma.menuItem, item.id, {
      browseGroupId: group.id,
      browseSubgroupId: subgroup?.id ?? null,
    });
    addCounter(counters, 'menuBrowseAssignments', result);
    menuByBranchName.set(key(row.branchCode, row.menuItemName), await prisma.menuItem.findUniqueOrThrow({ where: { id: item.id } }));
  }

  for (const row of rows(tables, '10_menu_servings.csv')) {
    const item = menuByBranchName.get(key(row.branchCode, row.menuItemName));
    if (!item) throw new Error(`Missing menu item for serving ${row.branchCode}/${row.menuItemName}`);
    const data = {
      menuItemId: item.id,
      label: optional(row, 'label'),
      format: enumValue('ServingFormat', row.format),
      price: money(row.price, 2),
      isDefault: bool(row.isDefault),
      sortOrder: int(row.sortOrder),
      isActive: true,
      metadata: json(row.metadata),
    };
    const result = await upsertWithWhere(
      prisma.menuItemServing,
      { menuItemId_format_label: { menuItemId: item.id, format: row.format as any, label: optional(row, 'label') ?? '' } },
      { id: stableId(`serving:${row.branchCode}:${row.menuItemName}:${row.format}:${row.label}`), ...data },
      data,
    );
    addCounter(counters, 'menuServings', result);
    servingByItemLabel.set(key(row.branchCode, row.menuItemName, row.label), await prisma.menuItemServing.findUniqueOrThrow({ where: { menuItemId_format_label: { menuItemId: item.id, format: row.format as any, label: optional(row, 'label') ?? '' } } }));
  }

  for (const row of rows(tables, '11_modifier_groups.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const data = {
      orgId: org.id,
      branchId: branch.id,
      name: row.name,
      min: int(row.minSelect),
      max: int(row.maxSelect),
      required: bool(row.isRequired),
      sortOrder: int(row.sortOrder),
      isActive: bool(row.isActive, true),
    };
    const result = await upsertWithWhere(
      prisma.modifierGroup,
      { branchId_name: { branchId: branch.id, name: row.name } },
      { id: stableId(`modifier-group:${row.branchCode}:${row.name}`), ...data },
      data,
    );
    addCounter(counters, 'modifierGroups', result);
    modGroupByBranchName.set(key(row.branchCode, row.name), await prisma.modifierGroup.findUniqueOrThrow({ where: { branchId_name: { branchId: branch.id, name: row.name } } }));
  }

  for (const row of rows(tables, '12_modifier_options.csv')) {
    const group = modGroupByBranchName.get(key(row.branchCode, row.groupName));
    const data = {
      groupId: group.id,
      name: row.name,
      priceDelta: money(row.priceDelta, 2),
      sortOrder: int(row.sortOrder),
      isActive: bool(row.isActive, true),
      metadata: json(row.metadata),
    };
    const result = await upsertWithWhere(
      prisma.modifierOption,
      { groupId_name: { groupId: group.id, name: row.name } },
      { id: stableId(`modifier-option:${row.branchCode}:${row.groupName}:${row.name}`), ...data },
      data,
    );
    addCounter(counters, 'modifierOptions', result);
    modOptionByGroupName.set(key(row.branchCode, row.groupName, row.name), await prisma.modifierOption.findUniqueOrThrow({ where: { groupId_name: { groupId: group.id, name: row.name } } }));
  }

  for (const row of rows(tables, '13_menu_item_modifier_groups.csv')) {
    const item = menuByBranchName.get(key(row.branchCode, row.menuItemName));
    const group = modGroupByBranchName.get(key(row.branchCode, row.modifierGroupName));
    if (!item || !group) throw new Error(`Missing item/group assignment ${JSON.stringify(row)}`);
    const data = { itemId: item.id, groupId: group.id, sortOrder: int(row.sortOrder) };
    const result = await upsertWithWhere(
      prisma.menuItemOnGroup,
      { itemId_groupId: { itemId: item.id, groupId: group.id } },
      { id: stableId(`item-mod-group:${row.branchCode}:${row.menuItemName}:${row.modifierGroupName}`), ...data },
      data,
    );
    addCounter(counters, 'menuModifierAssignments', result);
  }

  for (const row of rows(tables, '17_suppliers.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const code = stableId(`supplier-code:${row.branchCode}:${row.name}`).slice(0, 16).toUpperCase();
    const data = {
      orgId: org.id,
      branchId: branch.id,
      name: row.name,
      code,
      counterpartyType: enumValue('CounterpartyType', row.counterpartyType),
      contactName: optional(row, 'contactName'),
      email: optional(row, 'email'),
      phone: optional(row, 'phone'),
      paymentTermDays: int(row.paymentTermDays, 0),
      currencyCode: branch.currencyCode,
      isActive: row.status !== 'INACTIVE',
      metadata: json(row.metadata),
    };
    const result = await upsertWithWhere(prisma.supplier, { orgId_code: { orgId: org.id, code } }, { id: stableId(`supplier:${row.branchCode}:${row.name}`), ...data }, data);
    addCounter(counters, 'suppliers', result);
    supplierByName.set(key(row.branchCode, row.name), await prisma.supplier.findUniqueOrThrow({ where: { orgId_code: { orgId: org.id, code } } }));
  }

  for (const row of rows(tables, '14_inventory_items.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const data = {
      orgId: org.id,
      branchId: branch.id,
      sku: optional(row, 'sku'),
      name: row.name,
      unit: row.unit,
      category: row.category,
      theoreticalUnitCost: money(row.theoreticalUnitCost, 3),
      reorderLevel: money(row.reorderLevel, 3),
      reorderQty: money(row.reorderQty, 3),
      isActive: bool(row.isActive, true),
      metadata: { preferredSupplierKey: optional(row, 'preferredSupplierKey') },
    };
    const result = await upsertWithWhere(
      prisma.inventoryItem,
      { branchId_name: { branchId: branch.id, name: row.name } },
      { id: stableId(`inventory:${row.branchCode}:${row.name}`), ...data },
      data,
    );
    addCounter(counters, 'inventoryItems', result);
    invByBranchName.set(key(row.branchCode, row.name), await prisma.inventoryItem.findUniqueOrThrow({ where: { branchId_name: { branchId: branch.id, name: row.name } } }));
  }

  for (const row of rows(tables, '16_recipe_lines.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = branch ? orgBySlug.get('nimbus') : null;
    const item = menuByBranchName.get(key(row.branchCode, row.menuItemName));
    const inv = invByBranchName.get(key(row.branchCode, row.inventoryItemName));
    const serving = row.servingLabel ? servingByItemLabel.get(key(row.branchCode, row.menuItemName, row.servingLabel)) : null;
    const mod = row.modifierOptionName ? modOptionByGroupName.get(key(row.branchCode, row.modifierGroupName, row.modifierOptionName)) : null;
    if (!org || !branch || !item || !inv) throw new Error(`Missing recipe reference ${JSON.stringify(row)}`);
    const id = stableId(`recipe-line:${row.branchCode}:${row.menuItemName}:${row.inventoryItemName}:${row.servingLabel}:${row.modifierOptionName}`);
    const result = await upsertById(prisma.recipeIngredient, id, {
      orgId: org.id,
      branchId: branch.id,
      menuItemId: item.id,
      inventoryItemId: inv.id,
      menuItemServingId: serving?.id ?? null,
      modifierOptionId: mod?.id ?? null,
      qtyPerUnit: money(row.qtyPerUnit, 3),
      wastePct: money(row.wastePct, 2),
      unit: row.unit,
      notes: optional(row, 'notes'),
    });
    addCounter(counters, 'recipeLines', result);
  }

  for (const row of rows(tables, '20_stock_batches.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const item = invByBranchName.get(key(row.branchCode, row.inventoryItemName));
    const data = {
      orgId: org.id,
      branchId: branch.id,
      itemId: item.id,
      batchNumber: row.batchNumber,
      receivedQty: money(row.qtyReceived, 3),
      remainingQty: money(row.qtyRemaining, 3),
      unitCost: money(row.unitCost, 4),
      receivedAt: date(row.receivedAt) ?? new Date(),
      expiryDate: date(row.expiresAt),
      metadata: { sourceType: row.sourceType, sourceRef: optional(row, 'sourceRef') },
    };
    const result = await upsertById(prisma.stockBatch, stableId(`stock-batch:${row.branchCode}:${row.inventoryItemName}:${row.batchNumber}`), data);
    addCounter(counters, 'stockBatches', result);
  }

  const defaultActor = userByEmail.get('stockmanager@nimbus.demo') ?? userByEmail.values().next().value;
  for (const row of rows(tables, '21_stock_ledger_entries.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get(row.organizationSlug);
    const item = invByBranchName.get(key(row.branchCode, row.inventoryItemName));
    const actor = userByEmail.get(row.createdByEmail.toLowerCase()) ?? defaultActor;
    const result = await upsertById(prisma.stockAdjustment, stableId(`stock-adjustment:${row.branchCode}:${row.inventoryItemName}:${row.adjustedAt}:${row.reason}`), {
      orgId: org.id,
      branchId: branch.id,
      itemId: item.id,
      qtyDelta: money(row.quantity, 3),
      reason: `${row.adjustmentType}: ${row.reason}`,
      userId: actor.id,
      createdAt: date(row.adjustedAt) ?? new Date(),
    });
    addCounter(counters, 'stockAdjustments', result);
  }

  for (const row of rows(tables, '22_positions.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const data = { orgId: org.id, branchId: branch.id, code: row.code, title: row.title, department: optional(row, 'department'), level: optional(row, 'level'), active: bool(row.active, true), description: optional(row, 'metadata') };
    const result = await upsertWithWhere(prisma.position, { orgId_code: { orgId: org.id, code: row.code } }, { id: stableId(`position:${row.code}`), ...data }, data);
    addCounter(counters, 'positions', result);
    positionByCode.set(row.code, await prisma.position.findUniqueOrThrow({ where: { orgId_code: { orgId: org.id, code: row.code } } }));
  }
  for (const row of rows(tables, '23_compensation_profiles.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const data = { orgId: org.id, branchId: branch.id, code: row.code, salaryBasis: enumValue('SalaryBasis', row.salaryBasis), baseAmount: money(row.baseAmount, 2), currency: row.currency, active: bool(row.active, true), allowances: {}, deductions: {}, notes: null, };
    const result = await upsertWithWhere(prisma.compensationProfile, { orgId_code: { orgId: org.id, code: row.code } }, { id: stableId(`comp:${row.code}`), ...data }, data);
    addCounter(counters, 'compensationProfiles', result);
    compByCode.set(row.code, await prisma.compensationProfile.findUniqueOrThrow({ where: { orgId_code: { orgId: org.id, code: row.code } } }));
  }
  for (const row of rows(tables, '24_employees.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const user = row.userEmail ? userByEmail.get(row.userEmail.toLowerCase()) : null;
    const data = {
      orgId: org.id,
      branchId: branch.id,
      userId: user?.id ?? null,
      employeeCode: row.employeeCode,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: optional(row, 'phone'),
      email: optional(row, 'email'),
      hireDate: date(row.hireDate) ?? new Date(),
      status: enumValue('EmployeeStatus', row.status),
      employmentType: enumValue('EmploymentType', row.employmentType),
      positionId: positionByCode.get(row.positionCode)?.id ?? null,
      compensationProfileId: compByCode.get(row.compensationProfileCode)?.id ?? null,
    };
    const result = await upsertWithWhere(prisma.employee, { orgId_employeeCode: { orgId: org.id, employeeCode: row.employeeCode } }, { id: stableId(`employee:${row.employeeCode}`), ...data }, data);
    addCounter(counters, 'employees', result);
    employeeByCode.set(row.employeeCode, await prisma.employee.findUniqueOrThrow({ where: { orgId_employeeCode: { orgId: org.id, employeeCode: row.employeeCode } } }));
  }
  for (const row of rows(tables, '25_employment_contracts.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const employee = employeeByCode.get(row.employeeCode);
    const actor = userByEmail.get(row.createdByEmail.toLowerCase()) ?? userByEmail.values().next().value;
    const data = {
      orgId: org.id,
      branchId: branch.id,
      employeeId: employee.id,
      contractNumber: row.contractNumber,
      contractStatus: enumValue('ContractStatus', row.contractStatus),
      startsAt: date(row.startsAt) ?? new Date(),
      endsAt: date(row.endsAt),
      salaryBasis: enumValue('SalaryBasis', row.salaryBasis),
      salaryAmount: money(row.salaryAmount, 2),
      termsSummary: optional(row, 'termsSummary'),
      createdById: actor.id,
    };
    const result = await upsertWithWhere(prisma.employmentContract, { orgId_contractNumber: { orgId: org.id, contractNumber: row.contractNumber } }, { id: stableId(`contract:${row.contractNumber}`), ...data }, data);
    addCounter(counters, 'employmentContracts', result);
  }

  for (const row of rows(tables, '26_shifts.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const openedBy = userByEmail.get(row.openedByEmail.toLowerCase());
    const closedBy = row.closedByEmail ? userByEmail.get(row.closedByEmail.toLowerCase()) : null;
    const id = stableId(`shift:${row.branchCode}:${row.shiftNumber}`);
    const result = await upsertById(prisma.shift, id, {
      orgId: org.id,
      branchId: branch.id,
      shiftNumber: row.shiftNumber,
      openedById: openedBy.id,
      status: enumValue('ShiftStatus', row.status),
      openedAt: date(row.openedAt) ?? new Date(),
      closedAt: date(row.closedAt),
      closedById: closedBy?.id ?? null,
      notes: optional(row, 'notes'),
    });
    addCounter(counters, 'shifts', result);
    shiftByNumber.set(key(row.branchCode, row.shiftNumber), await prisma.shift.findUniqueOrThrow({ where: { id } }));
  }

  const primaryWaiter = userByEmail.get('waiter@nimbus.demo');
  const tapasDowntown = branchByCode.get('TAPAS_DOWNTOWN');
  const nimbusOrg = orgBySlug.get('nimbus');
  if (primaryWaiter && tapasDowntown && nimbusOrg) {
    const demoShiftId = stableId('shift:TAPAS_DOWNTOWN:DEMO-WAITER-OPEN');
    const demoShift = {
      orgId: nimbusOrg.id,
      branchId: tapasDowntown.id,
      shiftNumber: 'DEMO-WAITER-OPEN',
      openedById: primaryWaiter.id,
      closedById: null,
      status: 'OPEN',
      openedAt: new Date('2026-06-30T06:00:00.000Z'),
      closedAt: null,
      notes: 'Prepared locally for enterprise demo waiter flow.',
      metadata: { demoOnly: true, preparedLocally: true, primaryWaiterDemo: true },
    };
    const result = await upsertById(prisma.shift, demoShiftId, demoShift);
    addCounter(counters, 'activeWaiterShift', result);
    shiftByNumber.set(key('TAPAS_DOWNTOWN', demoShift.shiftNumber), await prisma.shift.findUniqueOrThrow({ where: { id: demoShiftId } }));
  } else {
    addCounter(counters, 'activeWaiterShift', 'skipped');
  }

  for (const row of rows(tables, '27_tills.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const shift = shiftByNumber.get(key(row.branchCode, row.shiftNumber));
    const operator = userByEmail.get(row.operatorEmail.toLowerCase());
    const result = await upsertById(prisma.tillSession, stableId(`till:${row.branchCode}:${row.tillNumber}`), {
      orgId: org.id,
      branchId: branch.id,
      shiftId: shift.id,
      tillCode: row.tillNumber,
      operatorUserId: operator.id,
      openedById: operator.id,
      closedById: row.closedAt ? operator.id : null,
      openingFloat: money(row.openingFloat, 2),
      status: enumValue('TillSessionStatus', row.status),
      openedAt: date(row.openedAt) ?? new Date(),
      closedAt: date(row.closedAt),
      expectedCash: money(row.expectedCash, 2),
      countedCash: money(row.countedCash, 2),
      variance: money(row.variance, 2),
      varianceStatus: money(row.variance, 2).equals(0) ? 'MATCHED' : money(row.variance, 2).lessThan(0) ? 'SHORT' : 'OVER',
    });
    addCounter(counters, 'tills', result);
  }

  const orderCreates: Record<string, unknown>[] = [];
  for (const row of rows(tables, '28_orders.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const user = userByEmail.get(row.userEmail.toLowerCase());
    const table = row.tableLabel ? tableByBranchLabel.get(key(row.branchCode, row.tableLabel)) : null;
    orderCreates.push({
      id: stableId(`order:${row.branchCode}:${row.orderNumber}`),
      orgId: org.id,
      branchId: branch.id,
      tableId: table?.id ?? null,
      userId: user.id,
      orderNumber: row.orderNumber,
      status: enumValue('OrderStatus', row.status),
      serviceType: enumValue('ServiceType', row.serviceType),
      subtotal: money(row.subtotal, 2),
      tax: money(row.tax, 2),
      discount: money(row.discount, 2),
      total: money(row.total, 2),
      notes: optional(row, 'notes'),
      metadata: json(row.metadata),
    });
  }
  for (const batch of chunks(orderCreates)) {
    const result = await prisma.order.createMany({ data: batch as any, skipDuplicates: true });
    addCounterBy(counters, 'orders', 'created', result.count);
    addCounterBy(counters, 'orders', 'skipped', batch.length - result.count);
  }
  const importedOrders = await prisma.order.findMany({ where: { id: { in: orderCreates.map((record) => String(record.id)) } } });
  for (const order of importedOrders) {
    const branch = Array.from(branchByCode.values()).find((candidate) => candidate.id === order.branchId);
    if (branch) orderByBranchNumber.set(key(branch.code, order.orderNumber), order);
  }

  const importedOrderIds = importedOrders.map((order) => order.id);
  for (const batch of chunks(importedOrderIds)) await prisma.orderItem.deleteMany({ where: { orderId: { in: batch } } });
  const orderItemCreates: Record<string, unknown>[] = [];
  for (const row of rows(tables, '29_order_items.csv')) {
    const order = orderByBranchNumber.get(key(row.branchCode, row.orderNumber));
    const item = menuByBranchName.get(key(row.branchCode, row.menuItemName));
    const serving = row.servingLabel ? servingByItemLabel.get(key(row.branchCode, row.menuItemName, row.servingLabel)) : null;
    orderItemCreates.push({
      id: stableId(`order-item:${row.branchCode}:${row.orderNumber}:${row.lineNo}`),
      orderId: order.id,
      menuItemId: item.id,
      menuItemServingId: serving?.id ?? null,
      quantity: int(row.quantity),
      price: money(row.price, 2),
      subtotal: money(row.subtotal, 2),
      notes: optional(row, 'notes'),
      metadata: { ...(json(row.metadata, {}) as Record<string, unknown>), demoLineNo: row.lineNo },
    });
  }
  for (const batch of chunks(orderItemCreates)) {
    const result = await prisma.orderItem.createMany({ data: batch as any, skipDuplicates: true });
    addCounterBy(counters, 'orderItems', 'created', result.count);
    addCounterBy(counters, 'orderItems', 'skipped', batch.length - result.count);
  }

  for (const batch of chunks(importedOrderIds)) await prisma.refund.deleteMany({ where: { orderId: { in: batch } } });
  for (const batch of chunks(importedOrderIds)) await prisma.payment.deleteMany({ where: { orderId: { in: batch } } });
  const paymentCreates: Record<string, unknown>[] = [];
  const paymentRefById = new Map<string, string>();
  for (const row of rows(tables, '31_payments.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const order = orderByBranchNumber.get(key(row.branchCode, row.orderNumber));
    const actor = userByEmail.get(row.enteredByEmail.toLowerCase());
    const paymentId = stableId(`payment:${paymentNaturalKey(row)}`);
    paymentCreates.push({
      id: paymentId,
      orgId: org.id,
      branchId: branch.id,
      orderId: order.id,
      amount: money(row.amount, 2),
      method: enumValue('PaymentMethod', row.method) as any,
      status: enumValue('PaymentStatus', row.status) as any,
      enteredById: actor.id,
      transactionId: optional(row, 'transactionId'),
      externalTransactionId: optional(row, 'providerRef'),
      captureMode: enumValue('PaymentCaptureMode', row.captureMode) as any,
      verificationStatus: enumValue('PaymentVerificationStatus', row.verificationStatus) as any,
      metadata: json(row.metadata),
    });
    paymentRefById.set(paymentId, row.transactionId || row.providerRef || paymentNaturalKey(row));
  }
  for (const batch of chunks(paymentCreates)) {
    const result = await prisma.payment.createMany({ data: batch as any, skipDuplicates: true });
    addCounterBy(counters, 'payments', 'created', result.count);
    addCounterBy(counters, 'payments', 'skipped', batch.length - result.count);
  }
  const importedPayments = await prisma.payment.findMany({ where: { id: { in: paymentCreates.map((record) => String(record.id)) } } });
  for (const payment of importedPayments) {
    const ref = paymentRefById.get(payment.id);
    if (ref) paymentByRef.set(ref, payment);
  }
  for (const row of rows(tables, '32_refunds.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get('nimbus');
    const order = orderByBranchNumber.get(key(row.branchCode, row.orderNumber));
    const payment = paymentByRef.get(row.paymentRef);
    const actor = userByEmail.get(row.createdByEmail.toLowerCase());
    const approver = row.approvedByEmail ? userByEmail.get(row.approvedByEmail.toLowerCase()) : null;
    const result = await upsertById(prisma.refund, stableId(`refund:${row.branchCode}:${row.orderNumber}:${row.paymentRef}:${row.amount}`), {
      orgId: org.id,
      branchId: branch.id,
      orderId: order.id,
      paymentId: payment.id,
      provider: 'MANUAL',
      amount: money(row.amount, 2),
      reason: row.reason,
      status: enumValue('RefundStatus', row.status),
      createdById: actor.id,
      approvedById: approver?.id ?? null,
      metadata: json(row.metadata),
    });
    addCounter(counters, 'refunds', result);
  }

  const hardenedMobileMoney = await prisma.payment.updateMany({
    where: {
      method: 'MOMO',
      OR: [{ status: { not: 'PENDING' } }, { captureMode: { not: 'ONLINE_PROVIDER' } }],
    },
    data: {
      status: 'PENDING',
      captureMode: 'ONLINE_PROVIDER',
      verificationStatus: 'UNVERIFIED',
      externalTransactionId: null,
      metadata: {
        demoSafety: true,
        reason: 'CRITICAL - PENDING MTN/AIRTEL PROVIDER CONFIRMATION',
      },
    },
  });
  addCounterBy(counters, 'mobileMoneySafety', 'updated', hardenedMobileMoney.count);

  for (const row of rows(tables, '34_reservations.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const table = row.tableLabel ? tableByBranchLabel.get(key(row.branchCode, row.tableLabel)) : null;
    const actor = userByEmail.get(row.createdByEmail.toLowerCase());
    const data = {
      orgId: org.id,
      branchId: branch.id,
      reservationNumber: row.reservationNumber,
      customerName: row.guestName,
      customerPhone: optional(row, 'guestPhone'),
      customerEmail: optional(row, 'guestEmail'),
      partySize: int(row.partySize),
      reservationAt: date(row.reservedFor) ?? new Date(),
      source: enumValue('ReservationSource', row.source),
      status: enumValue('ReservationStatus', row.status),
      notes: optional(row, 'notes'),
      specialRequests: optional(row, 'specialRequests'),
      tableId: table?.id ?? null,
      createdById: actor.id,
      updatedById: actor.id,
    };
    const result = await upsertWithWhere(prisma.reservation, { branchId_reservationNumber: { branchId: branch.id, reservationNumber: row.reservationNumber } }, { id: stableId(`reservation:${row.branchCode}:${row.reservationNumber}`), ...data }, data);
    addCounter(counters, 'reservations', result);
    reservationByNumber.set(key(row.branchCode, row.reservationNumber), await prisma.reservation.findUniqueOrThrow({ where: { branchId_reservationNumber: { branchId: branch.id, reservationNumber: row.reservationNumber } } }));
  }
  for (const row of rows(tables, '35_reservation_deposits.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get('nimbus');
    const reservation = reservationByNumber.get(key(row.branchCode, row.reservationNumber));
    const actor = userByEmail.get(row.recordedByEmail.toLowerCase());
    const result = await upsertById(prisma.reservationDeposit, stableId(`reservation-deposit:${row.branchCode}:${row.reference}`), {
      orgId: org.id,
      branchId: branch.id,
      reservationId: reservation.id,
      amount: money(row.amount, 2),
      status: enumValue('ReservationDepositStatus', row.status),
      method: row.method,
      reference: row.reference,
      recordedById: actor.id,
      recordedAt: new Date('2026-06-30T09:00:00Z'),
      metadata: json(row.metadata),
    });
    addCounter(counters, 'reservationDeposits', result);
  }

  for (const row of rows(tables, '36_events.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const table = row.venueTableLabel ? tableByBranchLabel.get(key(row.branchCode, row.venueTableLabel)) : null;
    const actor = userByEmail.get(row.createdByEmail.toLowerCase());
    const data = {
      orgId: org.id,
      branchId: branch.id,
      eventNumber: row.eventNumber,
      title: row.title,
      slug: optional(row, 'slug'),
      description: optional(row, 'description'),
      startsAt: date(row.startsAt) ?? new Date(),
      endsAt: date(row.endsAt),
      status: enumValue('EventStatus', row.status),
      capacity: int(row.capacity),
      soldCount: 0,
      checkedInCount: 0,
      venueTableId: table?.id ?? null,
      createdById: actor.id,
      updatedById: actor.id,
      metadata: json(row.metadata),
    };
    const result = await upsertWithWhere(prisma.event, { branchId_eventNumber: { branchId: branch.id, eventNumber: row.eventNumber } }, { id: stableId(`event:${row.branchCode}:${row.eventNumber}`), ...data }, data);
    addCounter(counters, 'events', result);
    eventByNumber.set(key(row.branchCode, row.eventNumber), await prisma.event.findUniqueOrThrow({ where: { branchId_eventNumber: { branchId: branch.id, eventNumber: row.eventNumber } } }));
  }
  for (const row of rows(tables, '37_event_ticket_classes.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get('nimbus');
    const event = eventByNumber.get(key(row.branchCode, row.eventNumber));
    const data = { orgId: org.id, branchId: branch.id, eventId: event.id, name: row.name, type: enumValue('TicketClassType', row.type), price: money(row.price, 2), capacity: int(row.capacity), soldCount: 0, active: true, sortOrder: int(row.sortOrder), metadata: json(row.metadata) };
    const result = await upsertWithWhere(prisma.eventTicketClass, { eventId_name: { eventId: event.id, name: row.name } }, { id: stableId(`ticket-class:${row.branchCode}:${row.eventNumber}:${row.name}`), ...data }, data);
    addCounter(counters, 'eventTicketClasses', result);
    ticketClassByEventName.set(key(row.branchCode, row.eventNumber, row.name), await prisma.eventTicketClass.findUniqueOrThrow({ where: { eventId_name: { eventId: event.id, name: row.name } } }));
  }
  for (const row of rows(tables, '38_event_bookings.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get('nimbus');
    const event = eventByNumber.get(key(row.branchCode, row.eventNumber));
    const ticketClass = ticketClassByEventName.get(key(row.branchCode, row.eventNumber, row.ticketClassName));
    const actor = userByEmail.get(row.bookedByEmail.toLowerCase());
    const data = { orgId: org.id, branchId: branch.id, eventId: event.id, ticketClassId: ticketClass.id, bookingNumber: row.bookingNumber, customerName: row.customerName, customerPhone: optional(row, 'customerPhone'), customerEmail: optional(row, 'customerEmail'), quantity: int(row.quantity), subtotal: money(row.totalAmount, 2), status: enumValue('EventBookingStatus', row.status), bookedById: actor.id };
    const result = await upsertWithWhere(prisma.eventBooking, { branchId_bookingNumber: { branchId: branch.id, bookingNumber: row.bookingNumber } }, { id: stableId(`booking:${row.branchCode}:${row.bookingNumber}`), ...data }, data);
    addCounter(counters, 'eventBookings', result);
    bookingByNumber.set(key(row.branchCode, row.bookingNumber), await prisma.eventBooking.findUniqueOrThrow({ where: { branchId_bookingNumber: { branchId: branch.id, bookingNumber: row.bookingNumber } } }));
  }
  for (const row of rows(tables, '39_event_tickets.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get('nimbus');
    const booking = bookingByNumber.get(key(row.branchCode, row.bookingNumber));
    const ticketClass = await prisma.eventTicketClass.findUniqueOrThrow({ where: { id: booking.ticketClassId } });
    const data = { orgId: org.id, branchId: branch.id, eventId: booking.eventId, bookingId: booking.id, ticketClassId: ticketClass.id, ticketNumber: row.ticketNumber, holderName: optional(row, 'holderName'), status: enumValue('TicketStatus', row.status), issuedAt: new Date('2026-06-30T09:00:00Z'), checkedInAt: date(row.checkedInAt), qrToken: row.qrToken, metadata: { demoQrNotSecret: true } };
    const result = await upsertWithWhere(prisma.eventTicket, { branchId_ticketNumber: { branchId: branch.id, ticketNumber: row.ticketNumber } }, { id: stableId(`ticket:${row.branchCode}:${row.ticketNumber}`), ...data }, data);
    addCounter(counters, 'eventTickets', result);
  }

  for (const row of rows(tables, '40_attendance.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const employee = employeeByCode.get(row.employeeCode);
    const result = await upsertWithWhere(
      prisma.attendanceRecord,
      { employeeId_attendanceDate: { employeeId: employee.id, attendanceDate: date(row.workDate) ?? new Date() } },
      { id: stableId(`attendance:${row.employeeCode}:${row.workDate}`), orgId: org.id, branchId: branch.id, employeeId: employee.id, userId: employee.userId, attendanceDate: date(row.workDate) ?? new Date(), status: enumValue('AttendanceStatus', row.status), clockInAt: date(row.clockInAt), clockOutAt: date(row.clockOutAt), lateMinutes: int(row.lateMinutes) },
      { status: enumValue('AttendanceStatus', row.status), clockInAt: date(row.clockInAt), clockOutAt: date(row.clockOutAt), lateMinutes: int(row.lateMinutes) },
    );
    addCounter(counters, 'attendance', result);
  }
  for (const row of rows(tables, '41_leave_requests.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get('nimbus');
    const employee = employeeByCode.get(row.employeeCode);
    const requester = userByEmail.get(row.requestedByEmail.toLowerCase());
    const reviewer = row.reviewedByEmail ? userByEmail.get(row.reviewedByEmail.toLowerCase()) : null;
    const result = await upsertById(prisma.leaveRequest, stableId(`leave:${row.employeeCode}:${row.startsAt}:${row.endsAt}`), { orgId: org.id, branchId: branch.id, employeeId: employee.id, leaveType: enumValue('LeaveType', row.leaveType), startsAt: date(row.startsAt) ?? new Date(), endsAt: date(row.endsAt) ?? new Date(), status: enumValue('LeaveRequestStatus', row.status), requestedById: requester.id, reviewedById: reviewer?.id ?? null, reviewedAt: reviewer ? new Date('2026-06-30T09:00:00Z') : null, reason: optional(row, 'reason'), reviewNotes: optional(row, 'reviewNote') });
    addCounter(counters, 'leaveRequests', result);
  }
  for (const row of rows(tables, '42_shift_swaps.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get('nimbus');
    const requester = employeeByCode.get(row.requesterEmployeeCode);
    const target = employeeByCode.get(row.targetEmployeeCode);
    const approver = row.approvedByEmail ? userByEmail.get(row.approvedByEmail.toLowerCase()) : null;
    const result = await upsertById(prisma.shiftSwapRequest, stableId(`swap:${row.requesterEmployeeCode}:${row.targetEmployeeCode}:${row.shiftDate}`), { orgId: org.id, branchId: branch.id, requesterEmployeeId: requester.id, targetEmployeeId: target.id, shiftDate: date(row.shiftDate) ?? new Date(), reason: optional(row, 'reason'), status: enumValue('ShiftSwapStatus', row.status), approvedById: approver?.id ?? null, approvedAt: approver ? new Date('2026-06-30T09:00:00Z') : null });
    addCounter(counters, 'shiftSwaps', result);
  }

  for (const row of rows(tables, '43_accounts.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = row.branchCode ? branchByCode.get(row.branchCode) : null;
    const data = { orgId: org.id, branchId: branch?.id ?? null, code: row.code, name: row.name, accountType: enumValue('AccountType', row.accountType), status: enumValue('AccountStatus', row.status), systemManaged: bool(row.systemManaged), allowManualPosting: bool(row.allowManualPosting), notes: optional(row, 'description') };
    const result = await upsertWithWhere(prisma.account, { orgId_code: { orgId: org.id, code: row.code } }, { id: stableId(`account:${row.code}`), ...data }, data);
    addCounter(counters, 'accounts', result);
    accountByCode.set(row.code, await prisma.account.findUniqueOrThrow({ where: { orgId_code: { orgId: org.id, code: row.code } } }));
  }
  for (const row of rows(tables, '44_cost_centers.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = row.branchCode ? branchByCode.get(row.branchCode) : null;
    const data = { orgId: org.id, branchId: branch?.id ?? null, code: row.code, name: row.name, active: bool(row.active, true), description: optional(row, 'description') };
    const result = await upsertWithWhere(prisma.costCenter, { orgId_code: { orgId: org.id, code: row.code } }, { id: stableId(`cost-center:${row.code}`), ...data }, data);
    addCounter(counters, 'costCenters', result);
    costCenterByCode.set(row.code, await prisma.costCenter.findUniqueOrThrow({ where: { orgId_code: { orgId: org.id, code: row.code } } }));
  }
  for (const row of rows(tables, '45_fiscal_periods.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const actor = userByEmail.get(row.openedByEmail.toLowerCase());
    const result = await upsertById(prisma.fiscalPeriod, stableId(`fiscal:${row.organizationSlug}:${row.name}`), { orgId: org.id, name: row.name, startsAt: date(row.startsAt) ?? new Date(), endsAt: date(row.endsAt) ?? new Date(), status: enumValue('FiscalPeriodStatus', row.status), openedAt: new Date('2026-06-30T09:00:00Z'), openedById: actor.id });
    addCounter(counters, 'fiscalPeriods', result);
    fiscalByName.set(row.name, await prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: stableId(`fiscal:${row.organizationSlug}:${row.name}`) } }));
  }
  for (const row of rows(tables, '46_journal_entries.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const period = fiscalByName.get(row.fiscalPeriodName);
    const actor = userByEmail.get(row.postedByEmail.toLowerCase());
    const totals = rows(tables, '47_journal_lines.csv').filter((l) => l.journalNumber === row.journalNumber).reduce((acc, l) => l.direction === 'DEBIT' ? { ...acc, debit: acc.debit.plus(money(l.amount, 2)) } : { ...acc, credit: acc.credit.plus(money(l.amount, 2)) }, { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) });
    const data = { orgId: org.id, branchId: branch.id, journalNumber: row.journalNumber, journalDate: date(row.journalDate) ?? new Date(), status: enumValue('JournalStatus', row.status), description: optional(row, 'description'), sourceKey: optional(row, 'sourceKey'), sourceDocumentId: optional(row, 'sourceId'), fiscalPeriodId: period?.id ?? null, totalDebit: totals.debit, totalCredit: totals.credit, postedAt: row.status === 'POSTED' ? new Date('2026-06-30T09:00:00Z') : null, postedById: actor?.id ?? null };
    const result = await upsertWithWhere(prisma.journalEntry, { orgId_journalNumber: { orgId: org.id, journalNumber: row.journalNumber } }, { id: stableId(`journal:${row.journalNumber}`), ...data }, data);
    addCounter(counters, 'journalEntries', result);
    journalByNumber.set(row.journalNumber, await prisma.journalEntry.findUniqueOrThrow({ where: { orgId_journalNumber: { orgId: org.id, journalNumber: row.journalNumber } } }));
  }
  for (const journal of journalByNumber.values()) await prisma.journalLine.deleteMany({ where: { journalEntryId: journal.id } });
  for (const row of rows(tables, '47_journal_lines.csv')) {
    const journal = journalByNumber.get(row.journalNumber);
    const account = accountByCode.get(row.accountCode);
    const costCenter = row.costCenterCode ? costCenterByCode.get(row.costCenterCode) : null;
    await prisma.journalLine.create({ data: { id: stableId(`journal-line:${row.journalNumber}:${row.direction}:${row.accountCode}:${row.amount}:${row.memo}`), orgId: journal.orgId, journalEntryId: journal.id, accountId: account.id, costCenterId: costCenter?.id ?? null, direction: enumValue('JournalLineDirection', row.direction) as any, amount: money(row.amount, 2), description: optional(row, 'memo') } });
    addCounter(counters, 'journalLines', 'created');
  }

  for (const row of rows(tables, '48_vendor_bills.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const supplier = supplierByName.get(key(row.branchCode, row.supplierName));
    const approver = userByEmail.get(row.approvedByEmail.toLowerCase());
    const paid = rows(tables, '50_ap_payments.csv').filter((p) => p.supplierName === row.supplierName).reduce((sum, p) => sum.plus(money(p.amount, 2)), new Prisma.Decimal(0));
    const data = { orgId: org.id, branchId: branch.id, supplierId: supplier.id, billNumber: row.billNumber, status: enumValue('VendorBillStatus', row.status), sourceType: enumValue('VendorBillSourceType', row.sourceType), billDate: date(row.billDate) ?? new Date(), issueDate: date(row.billDate) ?? new Date(), dueDate: date(row.dueDate) ?? new Date(), servicePeriodStart: date(row.servicePeriodStart), servicePeriodEnd: date(row.servicePeriodEnd), currencyCode: branch.currencyCode, subtotal: money(row.subtotal, 2), taxAmount: money(row.taxAmount, 2), totalAmount: money(row.totalAmount, 2), outstandingAmount: money(row.totalAmount, 2).minus(paid).lessThan(0) ? new Prisma.Decimal(0) : money(row.totalAmount, 2).minus(paid), approvedAt: new Date('2026-06-30T09:00:00Z'), approvedById: approver.id, notes: optional(row, 'notes') };
    const result = await upsertWithWhere(prisma.vendorBill, { orgId_billNumber: { orgId: org.id, billNumber: row.billNumber } }, { id: stableId(`vendor-bill:${row.billNumber}`), ...data }, data);
    addCounter(counters, 'vendorBills', result);
    vendorBillByNumber.set(row.billNumber, await prisma.vendorBill.findUniqueOrThrow({ where: { orgId_billNumber: { orgId: org.id, billNumber: row.billNumber } } }));
  }
  for (const bill of vendorBillByNumber.values()) await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: bill.id } });
  for (const row of rows(tables, '49_vendor_bill_lines.csv')) {
    const bill = vendorBillByNumber.get(row.billNumber);
    const account = accountByCode.get(row.accountCode);
    await prisma.vendorBillLine.create({ data: { id: stableId(`vendor-bill-line:${row.billNumber}:${row.description}`), vendorBillId: bill.id, orgId: bill.orgId, description: row.description, quantity: money(row.quantity, 3), unitPrice: money(row.unitCost, 2), taxRate: new Prisma.Decimal(0), taxAmount: money(row.taxAmount, 2), lineTotal: money(row.lineTotal, 2), accountId: account?.id ?? null } });
    addCounter(counters, 'vendorBillLines', 'created');
  }
  for (const row of rows(tables, '50_ap_payments.csv')) {
    const supplier = [...supplierByName.values()].find((s) => s.name === row.supplierName);
    const branch = supplier.branchId ? await prisma.branch.findUnique({ where: { id: supplier.branchId } }) : null;
    const actor = userByEmail.get(row.paidByEmail.toLowerCase());
    const result = await upsertWithWhere(prisma.vendorPayment, { orgId_paymentNumber: { orgId: supplier.orgId, paymentNumber: row.paymentNumber } }, { id: stableId(`vendor-payment:${row.paymentNumber}`), orgId: supplier.orgId, branchId: supplier.branchId, supplierId: supplier.id, paymentNumber: row.paymentNumber, status: enumValue('VendorPaymentStatus', row.status), paymentDate: date(row.paidAt) ?? new Date(), currencyCode: branch?.currencyCode ?? 'UGX', amount: money(row.amount, 2), remainingAmount: new Prisma.Decimal(0), paymentMethod: row.method, reference: optional(row, 'reference'), paidById: actor.id, metadata: json(row.metadata) }, { status: enumValue('VendorPaymentStatus', row.status), amount: money(row.amount, 2), remainingAmount: new Prisma.Decimal(0), reference: optional(row, 'reference'), metadata: json(row.metadata) });
    addCounter(counters, 'vendorPayments', result);
  }

  for (const row of rows(tables, '51_customer_accounts.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const actor = userByEmail.get('manager@nimbus.demo');
    const data = { orgId: org.id, branchId: branch.id, code: row.code, name: row.name, type: enumValue('CustomerAccountType', row.accountType), status: enumValue('CustomerAccountStatus', row.status), contactName: optional(row, 'contactName'), email: optional(row, 'email'), phone: optional(row, 'phone'), currencyCode: branch.currencyCode, creditLimit: money(row.creditLimit, 2), openBalance: new Prisma.Decimal(0), createdById: actor.id };
    const result = await upsertWithWhere(prisma.customerAccount, { orgId_code: { orgId: org.id, code: row.code } }, { id: stableId(`customer:${row.code}`), ...data }, data);
    addCounter(counters, 'customerAccounts', result);
    customerByCode.set(row.code, await prisma.customerAccount.findUniqueOrThrow({ where: { orgId_code: { orgId: org.id, code: row.code } } }));
  }
  for (const row of rows(tables, '52_ar_invoices.csv')) {
    const customer = customerByCode.get(row.customerCode);
    const creator = userByEmail.get(row.createdByEmail.toLowerCase());
    const issuer = userByEmail.get(row.issuedByEmail.toLowerCase());
    const receipts = rows(tables, '54_ar_receipts.csv').filter((p) => p.customerCode === row.customerCode).reduce((sum, p) => sum.plus(money(p.amount, 2)), new Prisma.Decimal(0));
    const data = { orgId: customer.orgId, branchId: customer.branchId, customerAccountId: customer.id, invoiceNumber: row.invoiceNumber, status: enumValue('InvoiceStatus', row.status), sourceType: enumValue('InvoiceSourceType', row.sourceType), invoiceDate: date(row.invoiceDate) ?? new Date(), issueDate: date(row.invoiceDate), dueDate: date(row.dueDate) ?? new Date(), currencyCode: customer.currencyCode, subtotal: money(row.subtotal, 2), taxAmount: money(row.taxAmount, 2), totalAmount: money(row.totalAmount, 2), outstandingBalance: money(row.totalAmount, 2).minus(receipts).lessThan(0) ? new Prisma.Decimal(0) : money(row.totalAmount, 2).minus(receipts), issuedAt: date(row.invoiceDate), issuedById: issuer.id, createdById: creator.id };
    const result = await upsertWithWhere(prisma.invoice, { orgId_invoiceNumber: { orgId: customer.orgId, invoiceNumber: row.invoiceNumber } }, { id: stableId(`invoice:${row.invoiceNumber}`), ...data }, data);
    addCounter(counters, 'invoices', result);
    invoiceByNumber.set(row.invoiceNumber, await prisma.invoice.findUniqueOrThrow({ where: { orgId_invoiceNumber: { orgId: customer.orgId, invoiceNumber: row.invoiceNumber } } }));
  }
  for (const invoice of invoiceByNumber.values()) await prisma.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });
  for (const row of rows(tables, '53_ar_invoice_lines.csv')) {
    const invoice = invoiceByNumber.get(row.invoiceNumber);
    const account = accountByCode.get(row.accountCode);
    await prisma.invoiceLine.create({ data: { id: stableId(`invoice-line:${row.invoiceNumber}:${row.description}`), invoiceId: invoice.id, orgId: invoice.orgId, description: row.description, quantity: money(row.quantity, 3), unitPrice: money(row.unitPrice, 2), taxRate: new Prisma.Decimal(0), taxAmount: money(row.taxAmount, 2), lineTotal: money(row.lineTotal, 2), accountId: account?.id ?? null } });
    addCounter(counters, 'invoiceLines', 'created');
  }
  for (const row of rows(tables, '54_ar_receipts.csv')) {
    const customer = customerByCode.get(row.customerCode);
    const actor = userByEmail.get(row.receivedByEmail.toLowerCase());
    const result = await upsertWithWhere(prisma.arReceipt, { orgId_receiptNumber: { orgId: customer.orgId, receiptNumber: row.receiptNumber } }, { id: stableId(`ar-receipt:${row.receiptNumber}`), orgId: customer.orgId, branchId: customer.branchId, customerAccountId: customer.id, receiptNumber: row.receiptNumber, status: enumValue('ReceiptStatus', row.status), receiptDate: date(row.receiptDate) ?? new Date(), currencyCode: customer.currencyCode, amount: money(row.amount, 2), remainingAmount: new Prisma.Decimal(0), paymentMethod: row.method, reference: optional(row, 'reference'), receivedById: actor.id, metadata: json(row.metadata) }, { status: enumValue('ReceiptStatus', row.status), amount: money(row.amount, 2), remainingAmount: new Prisma.Decimal(0), reference: optional(row, 'reference'), metadata: json(row.metadata) });
    addCounter(counters, 'arReceipts', result);
  }

  for (const row of rows(tables, '55_feedback.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const order = row.orderNumber ? orderByBranchNumber.get(key(row.branchCode, row.orderNumber)) : null;
    const reservation = row.reservationNumber ? reservationByNumber.get(key(row.branchCode, row.reservationNumber)) : null;
    const result = await upsertById(prisma.feedback, stableId(`feedback:${row.branchCode}:${row.customerAlias}:${row.orderNumber}:${row.reservationNumber}`), { orgId: org.id, branchId: branch.id, orderId: order?.id ?? null, reservationId: reservation?.id ?? null, customerName: row.customerAlias, source: enumValue('FeedbackSource', row.source), rating: int(row.rating, 0), sentiment: enumValue('FeedbackSentiment', row.sentiment), comment: optional(row, 'comment'), status: enumValue('FeedbackStatus', row.status), submittedAt: new Date('2026-06-30T09:00:00Z') });
    addCounter(counters, 'feedback', result);
  }

  const anomalyTypeMap: Record<string, string> = { LOW_STOCK: 'SHRINKAGE', WASTAGE_SPIKE: 'SHRINKAGE' };
  for (const row of rows(tables, '56_anomalies.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const actor = row.actorEmail ? userByEmail.get(row.actorEmail.toLowerCase()) : null;
    const acknowledgedBy = row.acknowledgedByEmail ? userByEmail.get(row.acknowledgedByEmail.toLowerCase()) : null;
    const type = anomalyTypeMap[row.ruleCode] ?? row.ruleCode;
    const result = await upsertById(prisma.anomalyEvent, stableId(`anomaly:${row.branchCode}:${row.ruleCode}:${row.evidence}`), { orgId: org.id, branchId: branch.id, type: enumValue('AnomalyRuleType', type), status: enumValue('AnomalyEventStatus', row.status), severity: enumValue('AnomalySeverity', row.severity), entityType: 'BRANCH', entityId: branch.id, actorUserId: actor?.id ?? null, title: `${row.ruleCode} demo anomaly`, description: 'Enterprise demo anomaly signal', evidence: json(row.evidence, {}), acknowledgedById: acknowledgedBy?.id ?? null, acknowledgedAt: acknowledgedBy ? new Date('2026-06-30T09:00:00Z') : null });
    addCounter(counters, 'anomalies', result);
  }

  for (const row of rows(tables, '57_devices.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const data = { orgId: org.id, branchId: branch.id, type: enumValue('DeviceType', row.type), name: row.name, activationCode: row.activationCode, status: enumValue('DeviceStatus', row.status), station: optional(row, 'station'), capabilities: json(row.capabilities), metadata: json(row.metadata) };
    const result = await upsertWithWhere(prisma.device, { branchId_name: { branchId: branch.id, name: row.name } }, { id: stableId(`device:${row.activationCode}`), ...data }, data);
    addCounter(counters, 'devices', result);
    deviceByActivation.set(row.activationCode, await prisma.device.findUniqueOrThrow({ where: { branchId_name: { branchId: branch.id, name: row.name } } }));
  }
  for (const row of rows(tables, '58_printer_routes.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get('nimbus');
    const printer = deviceByActivation.get(row.printerActivationCode);
    const data = { orgId: org.id, branchId: branch.id, printerId: printer.id, routeType: enumValue('PrinterRouteType', row.routeType), station: optional(row, 'station'), enabled: bool(row.enabled, true), priority: int(row.priority) };
    const result = await upsertWithWhere(prisma.printerRoute, { branch_route_station_printer_unique: { branchId: branch.id, routeType: row.routeType, station: optional(row, 'station'), printerId: printer.id } }, { id: stableId(`printer-route:${row.branchCode}:${row.routeType}:${row.station}`), ...data }, data);
    addCounter(counters, 'printerRoutes', result);
  }

  for (const row of rows(tables, '59_reports_exports.csv')) {
    const branch = branchByCode.get(row.branchCode);
    const org = orgBySlug.get('nimbus');
    const actor = userByEmail.get(row.requestedByEmail.toLowerCase());
    const reportId = stableId(`report:${row.branchCode}:${row.reportType}:${row.from}:${row.to}`);
    const result = await upsertById(prisma.reportRun, reportId, { orgId: org.id, branchId: branch.id, reportType: enumValue('ReportType', row.reportType), reportWindow: enumValue('ReportWindow', row.window), requestedById: actor.id, status: enumValue('ReportRunStatus', row.status), dateFrom: date(row.from), dateTo: date(row.to), summary: json(row.summary), rowCount: int(row.rowCount), generatedAt: row.status === 'COMPLETED' ? new Date('2026-06-30T09:00:00Z') : null });
    addCounter(counters, 'reports', result);
    const exportResult = await upsertById(prisma.exportArtifact, stableId(`export:${reportId}`), { orgId: org.id, branchId: branch.id, reportRunId: reportId, format: enumValue('ExportFormat', row.exportFormat), status: row.status === 'COMPLETED' ? 'READY' : 'PENDING', fileName: `${row.reportType.toLowerCase()}-${row.branchCode.toLowerCase()}.${row.exportFormat.toLowerCase()}`, mimeType: row.exportFormat === 'PDF' ? 'application/pdf' : 'text/csv', storagePath: `demo://${row.branchCode}/${row.reportType}`, generatedById: actor.id, readyAt: row.status === 'COMPLETED' ? new Date('2026-06-30T09:00:00Z') : null, metadata: { demoOnly: true } });
    addCounter(counters, 'exports', exportResult);
  }

  for (const row of rows(tables, '60_alerts_channels_digests.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const parts = row['type/category/channel/status/severity'].split('/');
    const [type, category, channel, status, severity] = parts;
    const channelCode = `${row.code}-channel`;
    await upsertWithWhere(prisma.alertChannel, { orgId_code: { orgId: org.id, code: channelCode } }, { id: stableId(`alert-channel:${channelCode}`), orgId: org.id, code: channelCode, name: `${row.code} ${channel}`, type: enumValue('AlertChannelType', channel), status: 'ACTIVE', config: json(row.config), metadata: json(row.metadata) }, { type: enumValue('AlertChannelType', channel), status: 'ACTIVE', config: json(row.config), metadata: json(row.metadata) });
    const result = await upsertWithWhere(prisma.alertRule, { orgId_code: { orgId: org.id, code: row.code } }, { id: stableId(`alert-rule:${row.code}`), orgId: org.id, branchId: branch.id, code: row.code, name: row.code.replace(/-/g, ' '), type: enumValue('AlertRuleType', type === 'THRESHOLD' ? 'LOW_STOCK' : type), severity: enumValue('AlertSeverity', severity), status: enumValue('AlertRuleStatus', status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED'), alertCategory: enumValue('AlertCategory', category), channelIntent: 'EMAIL_DIGEST', sourceModule: 'demo-import', thresholdConfig: json(row.config), channelCodes: [channelCode], metadata: json(row.metadata) }, { branchId: branch.id, severity: enumValue('AlertSeverity', severity), status: enumValue('AlertRuleStatus', status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED'), thresholdConfig: json(row.config), channelCodes: [channelCode], metadata: json(row.metadata) });
    addCounter(counters, 'alerts', result);
  }

  for (const row of rows(tables, '61_feature_flags.csv')) {
    const org = row.organizationSlug ? orgBySlug.get(row.organizationSlug) : null;
    const branch = row.branchCode ? branchByCode.get(row.branchCode) : null;
    const id = stableId(`flag:${row.scope}:${row.key}:${row.organizationSlug}:${row.branchCode}`);
    const result = await upsertById(prisma.featureFlag, id, { key: row.key, name: row.name, scope: enumValue('FeatureFlagScope', row.scope), orgId: org?.id ?? null, branchId: branch?.id ?? null, status: enumValue('FeatureFlagStatus', row.status), rolloutPercent: int(row.rolloutPercent), targeting: json(row.targeting), metadata: json(row.metadata) });
    addCounter(counters, 'featureFlags', result);
  }
  for (const row of rows(tables, '62_maintenance_windows.csv')) {
    const org = row.organizationSlug ? orgBySlug.get(row.organizationSlug) : null;
    const branch = row.branchCode ? branchByCode.get(row.branchCode) : null;
    const blockCategories = enumList('WriteBlockCategory', row.blockCategories);
    const result = await upsertWithWhere(prisma.maintenanceWindow, { orgId_code: { orgId: org?.id ?? null, code: row.code } }, { id: stableId(`maintenance:${row.code}`), orgId: org?.id ?? null, branchId: branch?.id ?? null, code: row.code, title: row.title, message: optional(row, 'message'), mode: enumValue('MaintenanceWindowMode', row.mode), status: enumValue('MaintenanceWindowStatus', row.status), blockCategories, startsAt: date(row.startsAt) ?? new Date(), endsAt: date(row.endsAt) ?? new Date() }, { branchId: branch?.id ?? null, title: row.title, message: optional(row, 'message'), mode: enumValue('MaintenanceWindowMode', row.mode), status: enumValue('MaintenanceWindowStatus', row.status), blockCategories, startsAt: date(row.startsAt) ?? new Date(), endsAt: date(row.endsAt) ?? new Date() });
    addCounter(counters, 'maintenanceWindows', result);
  }
  for (const row of rows(tables, '63_training_sessions.csv')) {
    const org = orgBySlug.get(row.organizationSlug);
    const branch = branchByCode.get(row.branchCode);
    const actor = userByEmail.get(row.actorEmail.toLowerCase());
    const result = await upsertById(prisma.trainingSession, stableId(`training:${row.branchCode}:${row.actorEmail}:${row.label}`), { orgId: org.id, branchId: branch.id, actorUserId: actor.id, label: row.label, purpose: optional(row, 'purpose'), mode: enumValue('TrainingSessionMode', row.mode), status: enumValue('TrainingSessionStatus', row.status), startedAt: date(row.startedAt) ?? new Date(), expiresAt: date(row.expiresAt) ?? new Date() });
    addCounter(counters, 'trainingSessions', result);
  }

  for (const [file] of Object.entries(skippedFiles)) addCounter(counters, file, 'skipped');
  const summary = {
    organizations: await prisma.organization.count({ where: { slug: 'nimbus' } }),
    branches: await prisma.branch.count({ where: { organizationId: orgBySlug.get('nimbus')?.id } }),
    users: await prisma.user.count({ where: { email: { endsWith: '@nimbus.demo' } } }),
    employees: await prisma.employee.count({ where: { orgId: orgBySlug.get('nimbus')?.id } }),
    menuItems: await prisma.menuItem.count({ where: { orgId: orgBySlug.get('nimbus')?.id } }),
    orders: await prisma.order.count({ where: { orgId: orgBySlug.get('nimbus')?.id } }),
    payments: await prisma.payment.count({ where: { orgId: orgBySlug.get('nimbus')?.id } }),
    reservations: await prisma.reservation.count({ where: { orgId: orgBySlug.get('nimbus')?.id } }),
    events: await prisma.event.count({ where: { orgId: orgBySlug.get('nimbus')?.id } }),
    journals: await prisma.journalEntry.count({ where: { orgId: orgBySlug.get('nimbus')?.id } }),
  };
  return { counters, summary };
}

async function main(): Promise<void> {
  const tables = loadTables();
  const validation = validatePack(tables);
  const plannedWrites = {
    mode: DRY_RUN ? 'dry-run' : 'write',
    csvFilesDiscovered: tables.size,
    totalRows: Object.values(validation.rowCounts).reduce((sum, count) => sum + count, 0),
    skippedFiles,
    rowCounts: validation.rowCounts,
    validationChecksPassed: [
      'CSV files exist and parse',
      'headers validated for critical files',
      'duplicate natural keys checked',
      'decimal and ISO date fields parsed',
      'Prisma enum values checked',
      'order/payment/AP/AR/GL totals checked',
      'mobile-money/PesaPal/receipt/printer/terminal/HMS safety checked',
    ],
    validationWarnings: validation.warnings,
    zeroDatabaseWrites: DRY_RUN,
  };

  if (DRY_RUN) {
    console.log(JSON.stringify({ ...plannedWrites, plannedWritesByDomain: 'all safe mapped domains; unsafe/non-schema CSVs skipped with reasons' }, null, 2));
    return;
  }

  const importResult = await importDemoData(tables);
  console.log(JSON.stringify({ ...plannedWrites, zeroDatabaseWrites: false, importResult }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error('Demo import failed');
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
