/**
 * Tapas Downtown demo venue: data types, file loading, the localhost guard and the validator.
 * Every person, item, price and booking here is made up. Nothing here is a real venue's data.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DATA_DIR = join(__dirname, 'data');

// ── Data shapes (as written in data/*.json) ──────────────────────────────────────────────────

export interface VenueFile {
  organization: { name: string; slug: string };
  branch: {
    name: string;
    code: string;
    slug: string;
    timezone: string;
    currencyCode: string;
    phone: string;
    address: string;
  };
  /** One floor plan per area (the Floor groups tables by floor plan name). */
  areas: { name: string; prefix: string; count: number; capacities: number[] }[];
}

export interface Person {
  key: string;
  firstName: string;
  lastName: string;
  /** The seeded role name (roles are global, created by db:seed). */
  role: string;
  phone: string;
}

/** [name, price] or a full item. Prices are whole UGX. */
export type ItemRow =
  | [string, number]
  | {
      name: string;
      price: number;
      description?: string;
      station?: Station;
      /** [format, label, price]; the first is the default and sets the item price. */
      servings?: [string, string, number][];
      /** Modifier group names from modifiers.json. */
      choices?: string[];
    };

export type Station = 'KITCHEN' | 'BAR' | 'COLD_KITCHEN' | 'DESSERT' | 'NONE';

export interface MenuFile {
  sections: {
    section: 'FOOD' | 'DRINKS';
    groups: {
      name: string;
      subgroups: { name: string; station: Station; itemType: 'FOOD' | 'DRINK'; items: ItemRow[] }[];
    }[];
  }[];
}

export interface ModifierGroupRow {
  name: string;
  min: number;
  max: number;
  required: boolean;
  /** [name, price delta in whole UGX] */
  options: [string, number][];
}

export interface StockRow {
  sku: string;
  name: string;
  unit: string;
  category: string;
  /** UGX per one unit, up to 3 decimals (the column is Decimal(10,3)). */
  unitCost: number;
  reorderLevel: number;
  reorderQty: number;
}

/** menu item name → [stock sku, quantity in that stock item's unit, waste %][] */
export type RecipesFile = Record<string, [string, number, number][]>;

/** [item name, quantity, serving label or null, choice option names] */
export type LineRow = [string, number, (string | null)?, string[]?];

export type TableState =
  | 'not-sent'
  | 'sent'
  | 'sent-with-new-lines'
  | 'in-kitchen'
  | 'ready'
  | 'served'
  | 'bill-asked';

export interface ServiceFile {
  shifts: { by: string; openedMinutesAgo: number }[];
  till: { code: string; operator: string; openedBy: string; openingFloat: number; openedMinutesAgo: number };
  openTables: {
    table: string;
    waiter: string;
    state: TableState;
    minutesAgo: number;
    lines: LineRow[];
    /** Lines added after the first send and not sent yet (state sent-with-new-lines). */
    newLines?: LineRow[];
    /** A reservation seated on this table, by booking key. */
    seatedBooking?: string;
  }[];
  paidBills: {
    table: string;
    waiter: string;
    minutesAgo: number;
    lines: LineRow[];
    /** [method, amount handed over]. Cash may be more than the bill; the change is stored. */
    payments: [string, number][];
    seatedBooking?: string;
  }[];
  bookings: {
    key: string;
    customerName: string;
    phone: string;
    partySize: number;
    /** Negative is in the past. */
    minutesFromNow: number;
    status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
    table?: string;
    source: 'WALK_IN' | 'PHONE' | 'WHATSAPP' | 'INSTAGRAM' | 'MANUAL' | 'OTHER';
    note?: string;
  }[];
}

export interface VenueData {
  venue: VenueFile;
  people: Person[];
  menu: MenuFile;
  modifiers: ModifierGroupRow[];
  stock: StockRow[];
  recipes: RecipesFile;
  service: ServiceFile;
}

export function readData(dir = DATA_DIR): VenueData {
  const read = <T>(name: string): T => JSON.parse(readFileSync(join(dir, name), 'utf8')) as T;
  return {
    venue: read<VenueFile>('venue.json'),
    people: read<Person[]>('people.json'),
    menu: read<MenuFile>('menu.json'),
    modifiers: read<ModifierGroupRow[]>('modifiers.json'),
    stock: read<StockRow[]>('stock.json'),
    recipes: read<RecipesFile>('recipes.json'),
    service: read<ServiceFile>('service.json'),
  };
}

// ── Derived views ───────────────────────────────────────────────────────────────────────────

export interface FlatItem {
  name: string;
  price: number;
  description?: string;
  station: Station;
  itemType: 'FOOD' | 'DRINK';
  section: 'FOOD' | 'DRINKS';
  group: string;
  subgroup: string;
  servings: [string, string, number][];
  choices: string[];
}

export function flatItems(menu: MenuFile): FlatItem[] {
  const out: FlatItem[] = [];
  for (const s of menu.sections)
    for (const g of s.groups)
      for (const sg of g.subgroups)
        for (const row of sg.items) {
          const r = Array.isArray(row) ? { name: row[0], price: row[1] } : row;
          out.push({
            name: r.name,
            price: r.price,
            description: 'description' in r ? r.description : undefined,
            station: ('station' in r && r.station) || sg.station,
            itemType: sg.itemType,
            section: s.section,
            group: g.name,
            subgroup: sg.name,
            servings: ('servings' in r && r.servings) || [],
            choices: ('choices' in r && r.choices) || [],
          });
        }
  return out;
}

export function tableLabels(venue: VenueFile): { label: string; area: string; capacity: number }[] {
  const out: { label: string; area: string; capacity: number }[] = [];
  for (const a of venue.areas)
    for (let i = 1; i <= a.count; i++)
      out.push({
        label: `${a.prefix}${String(i).padStart(2, '0')}`,
        area: a.name,
        capacity: a.capacities[(i - 1) % a.capacities.length],
      });
  return out;
}

/** "+256 700 000 123" → "+256700000123" */
export const normalisePhone = (p: string) => p.replace(/\s+/g, '');

// ── The localhost guard ─────────────────────────────────────────────────────────────────────

/**
 * Refuses unless both DATABASE_URL and DIRECT_DATABASE_URL are set, point at localhost, and
 * name a throwaway nimbus_event_* database. Never echoes a URL (it holds a password).
 * Returns the URL to pass explicitly to PrismaClient, so no .env file can win over it.
 */
export function assertLocalThrowawayDb(env: NodeJS.ProcessEnv = process.env): string {
  const out: string[] = [];
  for (const name of ['DATABASE_URL', 'DIRECT_DATABASE_URL'] as const) {
    const raw = env[name];
    if (!raw) throw new Error(`Refusing: ${name} is not set (eval "$(tools/test-env.sh)" first).`);
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new Error(`Refusing: ${name} is not a parseable URL.`);
    }
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
      throw new Error(`Refusing: ${name} points at host "${host}", which is not localhost.`);
    }
    const db = decodeURIComponent(u.pathname.replace(/^\//, ''));
    if (!db.startsWith('nimbus_event_')) {
      throw new Error(`Refusing: ${name} names database "${db}", not a throwaway nimbus_event_* one.`);
    }
    out.push(raw);
  }
  if (out[0] !== out[1]) {
    throw new Error('Refusing: DATABASE_URL and DIRECT_DATABASE_URL name different databases.');
  }
  return out[0];
}

// ── The validator ───────────────────────────────────────────────────────────────────────────

/** Words that would name a real brand on a demo menu. Extend when a new one is spotted. */
export const BRAND_WORDS = [
  'coca', 'coke', 'pepsi', 'fanta', 'sprite', 'mirinda', 'schweppes', 'stoney', 'tusker',
  'nile special', 'bell lager', 'club pilsener', 'guinness', 'heineken', 'castle lager',
  'smirnoff', 'absolut', 'johnnie walker', 'jameson', 'jack daniel', "gordon's", 'tanqueray',
  'bombay sapphire', 'bacardi', 'captain morgan', 'hennessy', 'baileys', 'amarula', 'waragi',
  'red bull', 'nescafe', 'starbucks', 'rwenzori', 'minute maid', 'savanna cider',
  'hunters gold', 'jose cuervo', 'patron', 'chivas', 'glenfiddich', 'moet', 'heinz', 'kfc',
  "mcdonald", "nando's",
];

const ROLES_NEEDED = [
  'Owner', 'Manager', 'Supervisor', 'Cashier', 'Waiter', 'Bartender', 'Chef', 'Stock Manager',
  'Accountant',
];
const SERVING_FORMATS = [
  'GLASS', 'BOTTLE', 'JUG', 'PINT', 'HALF_PINT', 'SHOT', 'SINGLE', 'DOUBLE', 'CARAFE', 'FLIGHT',
  'CUP', 'CUSTOM',
];
const UNITS = ['kg', 'g', 'l', 'ml', 'pc'];
const METHODS = ['CASH', 'CARD', 'MOMO', 'BANK_TRANSFER'];
const PHONE = /^\+256 700 000 \d{3}$/;
const threeDecimals = (v: number) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6;

export interface ValidationReport {
  errors: string[];
  counts: Record<string, number>;
  recipeCosts: { item: string; price: number; cost: number; pct: number }[];
}

export function validate(d: VenueData): ValidationReport {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const dupes = (what: string, names: string[]) => {
    const seen = new Set<string>();
    for (const n of names) {
      const k = n.trim().toLowerCase();
      if (seen.has(k)) err(`duplicate ${what}: "${n}"`);
      seen.add(k);
    }
  };
  const wholeUgx = (what: string, v: number, min = 0) => {
    if (!Number.isInteger(v) || v < min) err(`${what}: ${v} is not a whole UGX amount ≥ ${min}`);
    else if (v > 0 && v % 500 !== 0) err(`${what}: ${v} is not a believable price (not a multiple of 500)`);
  };
  const brand = (what: string, text: string) => {
    const t = text.toLowerCase();
    for (const b of BRAND_WORDS) {
      const re = new RegExp(`(^|[^a-z])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`);
      if (re.test(t)) err(`${what}: "${text}" contains brand word "${b}"`);
    }
  };

  // venue and floor
  if (!PHONE.test(d.venue.branch.phone)) err(`branch phone ${d.venue.branch.phone} is outside +256 700 000 xxx`);
  const tables = tableLabels(d.venue);
  dupes('table label', tables.map((t) => t.label));
  dupes('area', d.venue.areas.map((a) => a.name));
  for (const a of d.venue.areas)
    for (const c of a.capacities) if (!Number.isInteger(c) || c < 1 || c > 20) err(`area ${a.name}: capacity ${c}`);
  const tableSet = new Set(tables.map((t) => t.label));

  // people
  dupes('person key', d.people.map((p) => p.key));
  dupes('person name', d.people.map((p) => `${p.firstName} ${p.lastName}`));
  dupes('phone', d.people.map((p) => p.phone));
  const peopleByKey = new Map(d.people.map((p) => [p.key, p]));
  for (const p of d.people) {
    if (!PHONE.test(p.phone)) err(`person ${p.key}: phone ${p.phone} is outside +256 700 000 xxx`);
    if (!ROLES_NEEDED.includes(p.role)) err(`person ${p.key}: role "${p.role}" is not one of ${ROLES_NEEDED.join(', ')}`);
  }
  for (const r of ROLES_NEEDED) {
    const n = d.people.filter((p) => p.role === r).length;
    if (n < 2) err(`role ${r}: ${n} people, at least 2 needed`);
  }

  // modifiers
  dupes('choice group', d.modifiers.map((m) => m.name));
  const groupByName = new Map(d.modifiers.map((m) => [m.name, m]));
  for (const g of d.modifiers) {
    dupes(`option in "${g.name}"`, g.options.map((o) => o[0]));
    if (g.min > g.max || g.max > g.options.length) err(`choice group ${g.name}: min/max ${g.min}/${g.max} for ${g.options.length} options`);
    if (g.required && g.min < 1) err(`choice group ${g.name}: required but min is 0`);
    for (const [n, delta] of g.options) {
      wholeUgx(`option ${g.name}/${n} delta`, delta);
      brand(`option ${g.name}/${n}`, n);
    }
  }

  // menu
  const items = flatItems(d.menu);
  dupes('menu item', items.map((i) => i.name));
  dupes('menu group', d.menu.sections.flatMap((s) => s.groups.map((g) => g.name)));
  dupes('menu sub-group', d.menu.sections.flatMap((s) => s.groups.flatMap((g) => g.subgroups.map((sg) => sg.name))));
  const itemByName = new Map(items.map((i) => [i.name, i]));
  for (const i of items) {
    brand(`item`, i.name);
    if (i.description) brand(`item ${i.name} description`, i.description);
    wholeUgx(`item ${i.name} price`, i.price, 500);
    if (i.section === 'FOOD' && i.itemType !== 'FOOD') err(`item ${i.name}: FOOD section but itemType ${i.itemType}`);
    if (i.section === 'DRINKS' && i.itemType !== 'DRINK') err(`item ${i.name}: DRINKS section but itemType ${i.itemType}`);
    dupes(`serving of ${i.name}`, i.servings.map((s) => `${s[0]} ${s[1]}`));
    for (const [fmt, label, price] of i.servings) {
      if (!SERVING_FORMATS.includes(fmt)) err(`item ${i.name}: serving format ${fmt}`);
      if (!label) err(`item ${i.name}: serving with no label`);
      wholeUgx(`item ${i.name} serving ${label}`, price, 500);
    }
    if (i.servings.length && i.servings[0][2] !== i.price) err(`item ${i.name}: price ${i.price} is not its first serving's ${i.servings[0][2]}`);
    for (const c of i.choices) if (!groupByName.has(c)) err(`item ${i.name}: choice group "${c}" does not exist`);
    // a double costs more than a tot, a bottle more than a double
    const s = Object.fromEntries(i.servings.map(([f, , p]) => [f, p]));
    if (s.SINGLE && s.DOUBLE && !(s.DOUBLE > s.SINGLE)) err(`item ${i.name}: double not dearer than tot`);
    if (s.DOUBLE && s.BOTTLE && !(s.BOTTLE > s.DOUBLE * 5)) err(`item ${i.name}: bottle not dearer than five doubles`);
    if (s.GLASS && s.BOTTLE && !(s.BOTTLE > s.GLASS * 3)) err(`item ${i.name}: wine bottle not dearer than three glasses`);
  }

  // stock
  dupes('stock sku', d.stock.map((s) => s.sku));
  dupes('stock item', d.stock.map((s) => s.name));
  const stockBySku = new Map(d.stock.map((s) => [s.sku, s]));
  for (const s of d.stock) {
    brand('stock item', s.name);
    if (!UNITS.includes(s.unit)) err(`stock ${s.sku}: unit "${s.unit}" is not one of ${UNITS.join(', ')}`);
    if (!(s.unitCost > 0) || !threeDecimals(s.unitCost)) err(`stock ${s.sku}: unit cost ${s.unitCost}`);
    if (s.reorderLevel < 0 || s.reorderQty <= 0) err(`stock ${s.sku}: reorder ${s.reorderLevel}/${s.reorderQty}`);
    // sanity: per-unit cost bands so a kg is not priced like a gram
    const band: Record<string, [number, number]> = { kg: [500, 200000], l: [500, 300000], pc: [50, 60000], ml: [1, 1000], g: [1, 2000] };
    const [lo, hi] = band[s.unit] ?? [0, Infinity];
    if (s.unitCost < lo || s.unitCost > hi) err(`stock ${s.sku}: ${s.unitCost} UGX per ${s.unit} is outside ${lo}–${hi}`);
  }

  // recipes: every reference resolves, and the cost is believable against the price
  const recipeCosts: ValidationReport['recipeCosts'] = [];
  for (const [itemName, lines] of Object.entries(d.recipes)) {
    const item = itemByName.get(itemName);
    if (!item) {
      err(`recipe for unknown item "${itemName}"`);
      continue;
    }
    if (!lines.length) err(`recipe ${itemName}: no lines`);
    dupes(`stock in recipe ${itemName}`, lines.map((l) => l[0]));
    let cost = 0;
    for (const [sku, qty, waste] of lines) {
      const s = stockBySku.get(sku);
      if (!s) {
        err(`recipe ${itemName}: unknown stock sku ${sku}`);
        continue;
      }
      if (!(qty > 0) || !threeDecimals(qty)) err(`recipe ${itemName}/${sku}: quantity ${qty} (more than 0, at most 3 decimals)`);
      if (waste < 0 || waste > 30) err(`recipe ${itemName}/${sku}: waste ${waste}%`);
      cost += qty * (1 + waste / 100) * s.unitCost;
    }
    const pct = Math.round((cost / item.price) * 1000) / 10;
    recipeCosts.push({ item: itemName, price: item.price, cost: Math.round(cost), pct });
    if (pct < 8 || pct > 55) err(`recipe ${itemName}: cost ${Math.round(cost)} is ${pct}% of the price ${item.price} (believable is 8–55%)`);
  }

  // service in progress
  const service = d.service;
  const waiterKeys = new Set(d.people.filter((p) => p.role === 'Waiter').map((p) => p.key));
  const bookingKeys = new Map(service.bookings.map((b) => [b.key, b]));
  dupes('booking key', service.bookings.map((b) => b.key));
  for (const s of service.shifts) if (!peopleByKey.has(s.by)) err(`shift by unknown person ${s.by}`);
  dupes('shift holder', service.shifts.map((s) => s.by));
  for (const k of [service.till.operator, service.till.openedBy]) if (!peopleByKey.has(k)) err(`till: unknown person ${k}`);
  wholeUgx('till opening float', service.till.openingFloat);
  const shiftHolders = new Set(service.shifts.map((s) => s.by));
  const checkLines = (where: string, lines: LineRow[]) => {
    for (const [name, qty, serving, opts] of lines) {
      const item = itemByName.get(name);
      if (!item) {
        err(`${where}: unknown item "${name}"`);
        continue;
      }
      if (!Number.isInteger(qty) || qty < 1) err(`${where}/${name}: quantity ${qty}`);
      if (serving && !item.servings.some((s) => s[1] === serving)) err(`${where}/${name}: no serving "${serving}"`);
      for (const o of opts ?? []) {
        const ok = item.choices.some((c) => groupByName.get(c)?.options.some((op) => op[0] === o));
        if (!ok) err(`${where}/${name}: choice "${o}" is not offered on this item`);
      }
      for (const c of item.choices) {
        const g = groupByName.get(c)!;
        if (!g) continue;
        const picked = (opts ?? []).filter((o) => g.options.some((op) => op[0] === o)).length;
        if (picked < g.min || picked > g.max) err(`${where}/${name}: ${picked} picked in "${c}" (min ${g.min}, max ${g.max})`);
      }
    }
  };
  const usedTables = new Set<string>();
  for (const t of service.openTables) {
    const where = `open table ${t.table}`;
    if (!tableSet.has(t.table)) err(`${where}: no such table`);
    if (usedTables.has(t.table)) err(`${where}: two open orders on one table in the data`);
    usedTables.add(t.table);
    if (!waiterKeys.has(t.waiter)) err(`${where}: ${t.waiter} is not a waiter`);
    if (!shiftHolders.has(t.waiter)) err(`${where}: ${t.waiter} has no open shift`);
    if (!t.lines.length) err(`${where}: no lines`);
    checkLines(where, t.lines);
    checkLines(`${where} (new lines)`, t.newLines ?? []);
    if (t.state === 'sent-with-new-lines' && !(t.newLines ?? []).length) err(`${where}: state sent-with-new-lines but no new lines`);
    if (t.state !== 'sent-with-new-lines' && (t.newLines ?? []).length) err(`${where}: new lines only belong to state sent-with-new-lines`);
    if (t.seatedBooking) {
      const b = bookingKeys.get(t.seatedBooking);
      if (!b) err(`${where}: unknown booking ${t.seatedBooking}`);
      else if (b.status !== 'SEATED' || b.table !== t.table) err(`${where}: booking ${b.key} is not SEATED at this table`);
    }
  }
  for (const p of service.paidBills) {
    const where = `paid bill ${p.table}`;
    if (!tableSet.has(p.table)) err(`${where}: no such table`);
    if (!waiterKeys.has(p.waiter)) err(`${where}: ${p.waiter} is not a waiter`);
    checkLines(where, p.lines);
    for (const [m, amount] of p.payments) {
      if (!METHODS.includes(m)) err(`${where}: method ${m}`);
      wholeUgx(`${where} payment`, amount, 500);
    }
    if (p.seatedBooking) {
      const b = bookingKeys.get(p.seatedBooking);
      if (!b || b.status !== 'COMPLETED' || b.table !== p.table) err(`${where}: booking ${p.seatedBooking} is not COMPLETED at this table`);
    }
  }
  for (const b of service.bookings) {
    brand(`booking ${b.key}`, b.customerName);
    if (!PHONE.test(b.phone)) err(`booking ${b.key}: phone ${b.phone} is outside +256 700 000 xxx`);
    if (b.table && !tableSet.has(b.table)) err(`booking ${b.key}: no table ${b.table}`);
    if (b.status === 'SEATED') {
      if (!service.openTables.some((t) => t.seatedBooking === b.key)) err(`booking ${b.key}: SEATED but no open table holds it`);
    }
    if (b.status === 'COMPLETED' && !service.paidBills.some((p) => p.seatedBooking === b.key)) err(`booking ${b.key}: COMPLETED but no paid bill holds it`);
    if (b.partySize < 1 || b.partySize > 20) err(`booking ${b.key}: party of ${b.partySize}`);
  }

  // Order numbers follow time: two orders at the same minute would tie (orders.service.ts reads
  // the newest createdAt to number the next order).
  dupes('order time (minutesAgo)', [...service.openTables, ...service.paidBills].map((o) => String(o.minutesAgo)));

  const counts = {
    people: d.people.length,
    tables: tables.length,
    areas: d.venue.areas.length,
    menuItems: items.length,
    itemsWithChoices: items.filter((i) => i.choices.length > 0).length,
    servings: items.reduce((n, i) => n + i.servings.length, 0),
    stockItems: d.stock.length,
    recipes: Object.keys(d.recipes).length,
    openTables: service.openTables.length,
    bookingsToday: service.bookings.length,
    paidBills: service.paidBills.length,
  };
  return { errors, counts, recipeCosts };
}
