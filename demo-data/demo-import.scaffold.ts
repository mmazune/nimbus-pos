// Nimbus enterprise demo-data dry-run importer scaffold.
// Copy into packages/db/prisma/demo-import.ts, then adapt to repo Prisma helpers.
// Default mode MUST remain dry-run until reviewed.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEMO_DIR = process.env.DEMO_DATA_DIR ?? 'demo-data/csv';
const WRITE = process.env.DEMO_DATA_WRITE === '1';

if (WRITE) {
  throw new Error('Write mode is intentionally disabled in this scaffold. Review dry-run results before enabling.');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function readCsv(file: string): Record<string, string>[] {
  const raw = readFileSync(join(DEMO_DIR, file), 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split(/?
/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
}

function assertUnique(rows: Record<string,string>[], file: string, keyFn: (r: Record<string,string>) => string) {
  const seen = new Set<string>();
  for (const r of rows) {
    const k = keyFn(r);
    if (seen.has(k)) throw new Error(`${file}: duplicate key ${k}`);
    seen.add(k);
  }
}

function asMoney(v: string): number {
  if (!/^[-]?\d+(\.\d{1,2})?$/.test(v)) throw new Error(`Invalid money value: ${v}`);
  return Number(v);
}

function main() {
  const files = readdirSync(DEMO_DIR).filter((f) => f.endsWith('.csv')).sort();
  const tables = new Map<string, Record<string,string>[]>();
  for (const f of files) tables.set(f, readCsv(f));

  assertUnique(tables.get('00_organizations.csv') ?? [], '00_organizations.csv', r => r.slug);
  assertUnique(tables.get('01_branches.csv') ?? [], '01_branches.csv', r => `${r.organizationSlug}:${r.code}`);
  assertUnique(tables.get('02_users.csv') ?? [], '02_users.csv', r => r.email);
  assertUnique(tables.get('28_orders.csv') ?? [], '28_orders.csv', r => `${r.branchCode}:${r.orderNumber}`);

  // Order totals
  const itemsByOrder = new Map<string, number>();
  for (const item of tables.get('29_order_items.csv') ?? []) {
    const key = `${item.branchCode}:${item.orderNumber}`;
    itemsByOrder.set(key, (itemsByOrder.get(key) ?? 0) + asMoney(item.subtotal));
  }
  for (const order of tables.get('28_orders.csv') ?? []) {
    const key = `${order.branchCode}:${order.orderNumber}`;
    const itemSubtotal = Math.round((itemsByOrder.get(key) ?? 0) * 100) / 100;
    const subtotal = asMoney(order.subtotal);
    if (Math.abs(itemSubtotal - subtotal) > 0.01) throw new Error(`${key}: subtotal mismatch ${itemSubtotal} !== ${subtotal}`);
  }

  // Journal balance
  const journal = new Map<string, { debit: number; credit: number }>();
  for (const line of tables.get('47_journal_lines.csv') ?? []) {
    const rec = journal.get(line.journalNumber) ?? { debit: 0, credit: 0 };
    if (line.direction === 'DEBIT') rec.debit += asMoney(line.amount);
    if (line.direction === 'CREDIT') rec.credit += asMoney(line.amount);
    journal.set(line.journalNumber, rec);
  }
  for (const [num, rec] of journal) {
    if (Math.abs(rec.debit - rec.credit) > 0.01) throw new Error(`${num}: journal not balanced`);
  }

  console.log(JSON.stringify({ mode: 'dry-run', files: files.length, rows: Object.fromEntries([...tables].map(([k,v]) => [k, v.length])), writeEnabled: WRITE }, null, 2));
}

main();
