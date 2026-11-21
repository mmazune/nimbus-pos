import { readFileSync } from 'fs';
import { join } from 'path';
import { allocateOrderNumber } from './order-number';

/** What the allocator sent to Postgres, with the SQL text rebuilt from the tagged template. */
function fakeTx(max: string | null) {
  const queries: string[] = [];
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray) => {
      queries.push(strings.join('?'));
      return Promise.resolve([{ max }]);
    }),
  };
  return { tx, queries };
}

const run = (max: string | null) => {
  const { tx, queries } = fakeTx(max);
  return allocateOrderNumber(tx as never, 'branch-1').then((n) => ({ n, tx, queries }));
};

describe('allocateOrderNumber (H1F)', () => {
  it('starts at ORD-000001 for an empty branch or one with no ORD- numbers', async () => {
    expect((await run(null)).n).toBe('ORD-000001');
  });

  it('adds one and pads to six digits', async () => {
    expect((await run('6')).n).toBe('ORD-000007');
  });

  it('past ORD-999999 the number grows a digit', async () => {
    expect((await run('999999')).n).toBe('ORD-1000000');
  });

  it('a branch above 2^31 still allocates, exactly (no float, no overflow)', async () => {
    expect((await run('99999999999')).n).toBe('ORD-100000000000');
    expect((await run('9007199254740993')).n).toBe('ORD-9007199254740994'); // beyond 2^53
  });

  it('takes the branch lock first, then reads the maximum', async () => {
    const { tx } = await run('1');
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[0],
    );
  });

  it('uses exactly the expression the migration indexes, or the index is never used', async () => {
    const squash = (s: string) => s.replace(/["\s()]/g, '').toLowerCase();
    const migration = readFileSync(
      join(
        __dirname,
        '../../../../../packages/db/prisma/migrations/20261121100000_event_order_number_index/migration.sql',
      ),
      'utf8',
    );
    const expression = "CAST(SUBSTRING(order_number FROM '^ORD-([0-9]+)$') AS NUMERIC)";
    const { queries } = await run('1');
    expect(squash(queries[0])).toContain(squash(expression));
    expect(squash(migration)).toContain(squash(expression));
  });
});
