import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { loadavg } from 'os';
import { performance } from 'perf_hooks';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';
import { assertDisposableEventDb } from './support/event-db-guard';

// Must run before anything connects: refuse anything but a local nimbus_event_* database.
assertDisposableEventDb();

/**
 * H1F: tests for the fixes to what the H1-R review found, beyond the reviewer's own probes
 * (those stay untouched in quick-sale.review.e2e-spec.ts). Real HTTP, real Postgres
 * (disposable). Own organisation, branches and users with generated passwords; every
 * clientSaleId carries a random run suffix, so the spec can run again on the same database.
 */
describe('H1F: quick sale fixes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  const branch: Record<string, string> = {};
  const RUN = randomBytes(3).toString('hex');
  const cid = (label: string) => `${label.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48)}-${RUN}`;
  let cashier: { id: string; token: string };

  async function makeBranch(key: string) {
    const b = await prisma.branch.create({
      data: {
        organizationId: orgId,
        name: `H1F ${key}`,
        code: `F${key.toUpperCase()}`.slice(0, 20),
        slug: `h1f-${key}-${RUN}`,
        timezone: 'Africa/Kampala',
        currencyCode: 'UGX',
      },
    });
    branch[key] = b.id;
    const cat = await prisma.category.create({ data: { orgId, branchId: b.id, name: 'Menu' } });
    for (const it of [
      { sku: 'BEER-F', name: 'H1F beer', price: '4000' },
      { sku: 'SODA-F', name: 'H1F soda', price: '2000' },
    ]) {
      await prisma.menuItem.create({
        data: {
          orgId,
          branchId: b.id,
          categoryId: cat.id,
          name: it.name,
          sku: it.sku,
          brand: 'H1F',
          price: it.price,
          itemType: 'DRINK',
        },
      });
    }
  }

  async function makeCashier(branchKeys: string[]) {
    const password = randomBytes(18).toString('hex');
    const email = `cashier.${RUN}@event-h1f.invalid`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 4),
        firstName: 'Cashier',
        lastName: 'H1F',
      },
    });
    const role = await prisma.role.findUniqueOrThrow({ where: { name: 'Cashier' } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    for (const k of branchKeys) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: orgId,
          branchId: branch[k],
          roleId: role.id,
          isDefaultBranch: k === branchKeys[0],
        },
      });
    }
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    expect([200, 201]).toContain(login.status);
    return { id: user.id, token: login.body.accessToken as string };
  }

  const post = (key: string, body: unknown) =>
    request(app.getHttpServer())
      .post('/api/pos/quick-sale')
      .set('Authorization', `Bearer ${cashier.token}`)
      .set('X-Branch-Id', branch[key])
      .send(body as object);

  const sale = (id: string, over: Record<string, unknown> = {}) => ({
    clientSaleId: id,
    tillCode: 'DRK-03',
    lines: [{ sku: 'BEER-F', quantity: 2 }],
    payment: { method: 'CASH' },
    ...over,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    // Listen once, so supertest never starts (and then closes) a shared server per request:
    // that closed the server under in-flight concurrent requests (read ECONNRESET).
    await app.listen(0);
    prisma = app.get(PrismaService);

    const [db] = await prisma.$queryRaw<{ db: string }[]>`select current_database() as db`;
    expect(db.db.startsWith('nimbus_event_')).toBe(true);

    orgId = (await prisma.organization.create({ data: { name: 'H1F QA', slug: `h1f-qa-${RUN}` } }))
      .id;
    for (const k of ['perf', 'tills', 'late']) await makeBranch(k);
    cashier = await makeCashier(['perf', 'tills', 'late']);
  }, 120000);

  afterAll(async () => {
    await app?.close();
  });

  // ── c. the order-number allocator reads one row, and the lock is short ──

  describe('c. allocator: 10,000 orders in one branch, 20 concurrent sales, five runs', () => {
    type PlanNode = {
      'Node Type': string;
      'Relation Name'?: string;
      'Index Name'?: string;
      'Actual Rows'?: number;
      'Actual Loops'?: number;
      'Rows Removed by Filter'?: number;
      Plans?: PlanNode[];
    };
    const walk = (n: PlanNode, out: PlanNode[] = []) => {
      out.push(n);
      (n.Plans ?? []).forEach((c) => walk(c, out));
      return out;
    };

    beforeAll(async () => {
      await prisma.$executeRawUnsafe(
        `INSERT INTO orders (id, org_id, branch_id, user_id, order_number, service_type, status, updated_at)
         SELECT 'h1f-perf-${RUN}-' || g, $1, $2, $3, 'ORD-' || lpad(g::text, 6, '0'),
                'TAKEAWAY'::"ServiceType", 'CLOSED'::"OrderStatus", now()
         FROM generate_series(1, 10000) g`,
        orgId,
        branch.perf,
        cashier.id,
      );
      await prisma.$executeRawUnsafe('ANALYZE orders');
    }, 120000);

    /** Runs `fn` while recording the allocator's own SQL (the service's real query). */
    async function captureAllocatorQuery(fn: () => Promise<unknown>) {
      const orig = prisma.$transaction.bind(prisma) as (...a: unknown[]) => Promise<unknown>;
      type Tx = Record<string | symbol, unknown> & {
        $queryRaw: (...a: unknown[]) => Promise<unknown>;
      };
      let text = '';
      let values: unknown[] = [];
      const spy = jest.spyOn(prisma, '$transaction').mockImplementation(((
        cb: unknown,
        opts: unknown,
      ) => {
        if (typeof cb !== 'function') return orig(cb, opts);
        return orig(
          (tx: Tx) =>
            (cb as (t: unknown) => Promise<unknown>)(
              new Proxy(tx, {
                get(target, prop) {
                  if (prop === '$queryRaw') {
                    return (strings: TemplateStringsArray, ...vals: unknown[]) => {
                      text = strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, '');
                      values = vals;
                      return target.$queryRaw(strings, ...vals);
                    };
                  }
                  const v = target[prop];
                  return typeof v === 'function' ? v.bind(target) : v;
                },
              }),
            ),
          opts,
        );
      }) as never);
      try {
        await fn();
      } finally {
        spy.mockRestore();
      }
      return { text, values };
    }

    it("the service's own number query uses the index and reads one row", async () => {
      let res: request.Response | undefined;
      const q = await captureAllocatorQuery(async () => {
        res = await post('perf', sale(cid('plan-capture')));
      });
      expect(res?.status).toBe(200);
      expect(q.text).toContain('FROM orders'); // control: the capture saw the allocator
      const rows = await prisma.$queryRawUnsafe<
        { 'QUERY PLAN': { Plan: PlanNode; 'Execution Time': number }[] }[]
      >(`EXPLAIN (ANALYZE, FORMAT JSON) ${q.text}`, ...q.values);
      const root = rows[0]['QUERY PLAN'][0];
      const nodes = walk(root.Plan);
      const read = nodes
        .filter((n) => n['Relation Name'] === 'orders')
        .reduce(
          (s, n) =>
            s +
            ((n['Actual Rows'] ?? 0) + (n['Rows Removed by Filter'] ?? 0)) *
              (n['Actual Loops'] ?? 1),
          0,
        );
      const shape = nodes
        .map((n) => `${n['Node Type']}${n['Index Name'] ? `(${n['Index Name']})` : ''}`)
        .join(' > ');
      // eslint-disable-next-line no-console
      console.log(
        `H1F allocator plan: ${shape}; order rows read ${read}; ${root['Execution Time']} ms`,
      );
      expect(shape).toContain('orders_branch_id_order_number_numeric_idx');
      expect(read).toBeLessThanOrEqual(2);
    });

    it('lock held p95 <= 20 ms in each of five runs (10 rounds x 20 concurrent sales each)', async () => {
      const orig = prisma.$transaction.bind(prisma) as (...a: unknown[]) => Promise<unknown>;
      type Tx = Record<string | symbol, unknown> & {
        $executeRaw: (...a: unknown[]) => Promise<unknown>;
      };
      const p95s: number[] = [];
      for (let run = 1; run <= 5; run++) {
        const holds: number[] = [];
        const spy = jest.spyOn(prisma, '$transaction').mockImplementation(((
          fn: unknown,
          opts: unknown,
        ) => {
          if (typeof fn !== 'function') return orig(fn, opts);
          let t0 = 0;
          return orig(
            (tx: Tx) =>
              (fn as (t: unknown) => Promise<unknown>)(
                new Proxy(tx, {
                  get(target, prop) {
                    if (prop === '$executeRaw') {
                      return async (...a: unknown[]) => {
                        const r = await target.$executeRaw(...a);
                        t0 = performance.now(); // the advisory lock has just been granted
                        return r;
                      };
                    }
                    const v = target[prop];
                    return typeof v === 'function' ? v.bind(target) : v;
                  },
                }),
              ),
            opts,
          ).then((r) => {
            holds.push(performance.now() - t0); // transaction committed
            return r;
          });
        }) as never);
        const statuses: number[] = [];
        try {
          for (let round = 0; round < 10; round++) {
            const res = await Promise.all(
              Array.from({ length: 20 }, (_, i) =>
                post('perf', sale(cid(`c-${run}-${round}-${i}`))),
              ),
            );
            statuses.push(...res.map((r) => r.status));
          }
        } finally {
          spy.mockRestore();
        }
        const sorted = [...holds].sort((x, y) => x - y);
        const pct = (p: number) =>
          sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
        const load = loadavg()
          .map((l) => l.toFixed(2))
          .join(' ');
        // eslint-disable-next-line no-console
        console.log(
          `H1F allocator run ${run}: ${holds.length} sales, lock hold ms p50 ${pct(0.5).toFixed(1)} p95 ${pct(0.95).toFixed(1)} max ${sorted[sorted.length - 1].toFixed(1)}; non-200 ${statuses.filter((s) => s !== 200).length}; load ${load}`,
        );
        expect(holds.length).toBe(200); // control: the spy saw every sale's transaction
        expect(statuses.filter((s) => s !== 200)).toEqual([]);
        p95s.push(pct(0.95));
      }
      expect(p95s.filter((v) => v > 20)).toEqual([]);
    }, 300000);
  });
});
