import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// R-E1 probe (track T4): who writes Order.status = CLOSED, and who frees a table, across the
// whole API source. Static: it reads apps/api/src and needs no database. A red test names the
// files that write outside the one close door (apps/api/src/modules/orders/order-close.ts).

const SRC = join(__dirname, '..', 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });
}

function writers(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(pattern)) {
      const line = text.slice(0, m.index).split('\n').length;
      hits.push(`${relative(join(SRC, '..'), file)}:${line}`);
    }
  }
  return hits;
}

describe('R-E1 writers probe (static)', () => {
  it('W1 only the close door writes CLOSED on an order (quick-sale, born closed, is the one disclosed exception)', () => {
    const hits = writers(
      /\.order\.(?:update|updateMany|create|upsert)\(\{[\s\S]{0,600}?status:\s*(?:OrderStatus\.CLOSED|'CLOSED')/g,
    );
    const outside = hits.filter(
      (h) =>
        !h.includes('orders/order-close.ts') && !h.includes('quick-sale/quick-sale.service.ts'),
    );
    expect(hits.length).toBeGreaterThan(0); // the scan sees the close door itself
    expect(outside).toEqual([]);
  });

  it('S6 money arrives as a string decimal, never a JS number, on the payment DTOs', () => {
    const dtoDir = join(SRC, 'modules', 'payments', 'dto');
    const offenders: string[] = [];
    for (const file of readdirSync(dtoDir).filter((f) => f.endsWith('.dto.ts'))) {
      const text = readFileSync(join(dtoDir, file), 'utf8');
      for (const m of text.matchAll(/\b(amount|tendered)!?\??:\s*number/g)) {
        const line = text.slice(0, m.index).split('\n').length;
        offenders.push(`src/modules/payments/dto/${file}:${line}`);
      }
    }
    // Correct: none. A JS number is a float from the request onwards (E1 part c).
    expect(offenders).toEqual([]);
  });

  it('W2 only the close door frees a table to AVAILABLE (the audited manual floor action aside)', () => {
    const hits = writers(
      /\.table\.(?:update|updateMany)\(\{[\s\S]{0,300}?status:\s*(?:TableStatus\.AVAILABLE|'AVAILABLE')/g,
    );
    const outside = hits.filter((h) => !h.includes('orders/order-close.ts'));
    expect(hits.length).toBeGreaterThan(0);
    // Correct: none. A free written elsewhere runs outside the close door's table lock (see P8).
    expect(outside).toEqual([]);
  });
});
