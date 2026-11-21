import { Test } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { AddressInfo } from 'net';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { loadavg } from 'os';
import { performance } from 'perf_hooks';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';
import { TillsService } from '../src/modules/tills/tills.service';
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
  let baseUrl: string;
  let prisma: PrismaService;
  let tills: TillsService;
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
    const login = await request(baseUrl)
      .post('/api/auth/login')
      .send({ email, password });
    expect([200, 201]).toContain(login.status);
    return { id: user.id, token: login.body.accessToken as string };
  }

  const post = (key: string, body: unknown) =>
    request(baseUrl)
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
    // Listen once, on the loopback address only, and send every request there (H1F2, part c).
    // Without a fixed listener supertest binds a fresh ephemeral port per request, and another
    // program on this machine once answered on that port number (a 404 'not found' from a
    // foreign process). Listening on 127.0.0.1 and requesting that exact address removes it.
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    // Listen once, so supertest never starts (and then closes) a shared server per request:
    // that closed the server under in-flight concurrent requests (read ECONNRESET).
    await app.listen(0);
    prisma = app.get(PrismaService);
    tills = app.get(TillsService);

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
      // H1F2 (owner ruling): the wall-clock threshold runs on demand (EVENT_PERF=1) and at the load
      // test, not in every run on a busy laptop. Every sale above is still checked: 200 each,
      // and the transaction spy saw all 200. The index-read half is in the review spec (R2).
      if (process.env.EVENT_PERF === '1') {
        expect(p95s.filter((v) => v > 20)).toEqual([]);
      }
    }, 300000);
  });

  const ordersFor = (id: string) =>
    prisma.order.count({ where: { clientSaleId: { startsWith: id } } });

  /**
   * Everything the app logs or prints while `fn` runs: stdout, stderr and every Nest Logger
   * call (the testing module's logger only prints errors, so the Logger methods are spied on).
   */
  async function captureOutput(fn: () => Promise<unknown>) {
    let out = '';
    const grab = (chunk: unknown) => {
      out += String(chunk);
      return true;
    };
    const spies = [
      jest.spyOn(process.stdout, 'write').mockImplementation(grab as never),
      jest.spyOn(process.stderr, 'write').mockImplementation(grab as never),
      ...(['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) =>
        jest.spyOn(Logger.prototype, m).mockImplementation(((...args: unknown[]) => {
          out += `${JSON.stringify(args)}\n`;
        }) as never),
      ),
    ];
    try {
      await fn();
    } finally {
      spies.forEach((x) => x.mockRestore());
    }
    return out;
  }

  // ── a. a replay must be the same sale ──

  describe('a. replay fingerprint', () => {
    const visa = { method: 'CARD', cardScheme: 'VISA', cardLast4: '4242', authCode: 'A1B2C3' };

    it('the real case: the same sale posted twice is one order, 8,000, VISA, DRK-03', async () => {
      const id = cid('real');
      const body = sale(id, { payment: visa, soldAt: '2026-11-21T21:14:00+03:00' });
      const one = await post('tills', body);
      const two = await post('tills', body);
      expect([one.status, two.status]).toEqual([200, 200]);
      expect([one.body.replayed, two.body.replayed]).toEqual([false, true]);
      expect(two.body.order.id).toBe(one.body.order.id);
      expect(await ordersFor(id)).toBe(1);
      expect(Number(one.body.order.total)).toBe(8000);
      expect(one.body.payment.cardScheme).toBe('VISA');
      expect(one.body.order.tillCode).toBe('DRK-03');
    });

    it('the order of the lines does not matter', async () => {
      const id = cid('line-order');
      const a = [
        { sku: 'BEER-F', quantity: 1 },
        { sku: 'SODA-F', quantity: 2 },
      ];
      const one = await post('tills', sale(id, { lines: a }));
      const two = await post('tills', sale(id, { lines: [...a].reverse() }));
      expect(two.status).toBe(200);
      expect(two.body.replayed).toBe(true);
      expect(two.body.order.id).toBe(one.body.order.id);
    });

    it('sku on the first send and menuItemId on the retry is still the same sale', async () => {
      const id = cid('sku-vs-id');
      const item = await prisma.menuItem.findFirstOrThrow({
        where: { orgId, branchId: branch.tills, sku: 'BEER-F' },
      });
      const one = await post('tills', sale(id, { lines: [{ sku: 'BEER-F', quantity: 2 }] }));
      const two = await post('tills', sale(id, { lines: [{ menuItemId: item.id, quantity: 2 }] }));
      expect(one.status).toBe(200);
      expect(two.status).toBe(200);
      expect(two.body.replayed).toBe(true);
    });

    const differs: [string, Record<string, unknown>, string][] = [
      ['a different quantity', { lines: [{ sku: 'BEER-F', quantity: 3 }] }, 'lines'],
      ['a different item', { lines: [{ sku: 'SODA-F', quantity: 2 }] }, 'lines'],
      [
        'an extra line',
        {
          lines: [
            { sku: 'BEER-F', quantity: 2 },
            { sku: 'SODA-F', quantity: 1 },
          ],
        },
        'lines',
      ],
      ['a different method', { payment: visa }, 'payment.method'],
      ['a different till', { tillCode: 'DRK-04' }, 'tillCode'],
      [
        'a different tendered amount',
        { payment: { method: 'CASH', tenderedAmount: 20000 } },
        'payment.tenderedAmount',
      ],
      ['a different soldAt', { soldAt: '2026-11-21T22:00:00+03:00' }, 'soldAt'],
    ];
    for (const [label, over, part] of differs) {
      it(`${label} under the same clientSaleId is a 409 that names the part and writes nothing`, async () => {
        const id = cid(`mismatch-${label}`);
        const first = await post(
          'tills',
          sale(id, {
            soldAt: '2026-11-21T21:14:00+03:00',
            payment: { method: 'CASH', tenderedAmount: 10000 },
          }),
        );
        expect(first.status).toBe(200);
        const second = await post(
          'tills',
          sale(id, {
            soldAt: '2026-11-21T21:14:00+03:00',
            payment: { method: 'CASH', tenderedAmount: 10000 },
            ...over,
          }),
        );
        expect(second.status).toBe(409);
        expect(second.body.code).toBe('CLIENT_SALE_ID_PAYLOAD_MISMATCH');
        expect(second.body.differs).toContain(part);
        expect(await ordersFor(id)).toBe(1);
      });
    }

    it('a different card scheme or mobile-money network is a 409', async () => {
      const idCard = cid('scheme');
      await post('tills', sale(idCard, { payment: visa }));
      const card = await post(
        'tills',
        sale(idCard, { payment: { ...visa, cardScheme: 'MASTERCARD' } }),
      );
      expect(card.status).toBe(409);
      const idMomo = cid('network');
      await post('tills', sale(idMomo, { payment: { method: 'MOMO', momoNetwork: 'MTN' } }));
      const momo = await post(
        'tills',
        sale(idMomo, { payment: { method: 'MOMO', momoNetwork: 'AIRTEL' } }),
      );
      expect(momo.status).toBe(409);
    });

    it('omitted soldAt on both sends is the same sale; sending one the second time is not', async () => {
      const id = cid('soldat-omitted');
      await post('tills', sale(id));
      expect((await post('tills', sale(id))).body.replayed).toBe(true);
      expect((await post('tills', sale(id, { soldAt: '2026-11-21T21:14:00+03:00' }))).status).toBe(
        409,
      );
    });

    it('a replay with different slip fields is a 200 and never changes the stored sale', async () => {
      const id = cid('slip');
      const one = await post('tills', sale(id, { payment: visa }));
      const two = await post(
        'tills',
        sale(id, { payment: { ...visa, cardLast4: '1111', authCode: 'ZZ99', terminalId: 'T-9' } }),
      );
      expect(two.status).toBe(200);
      expect(two.body.replayed).toBe(true);
      const stored = await prisma.payment.findFirstOrThrow({
        where: { orderId: one.body.order.id },
      });
      expect([stored.cardLast4, stored.authCode, stored.terminalId]).toEqual([
        '4242',
        'A1B2C3',
        null,
      ]);
    });

    it('the 409 does not echo a value and logs the sale id, branch and till but no card data', async () => {
      const id = cid('echo');
      await post('tills', sale(id, { payment: visa }));
      let res: request.Response | undefined;
      const out = await captureOutput(async () => {
        res = await post(
          'tills',
          sale(id, { lines: [{ sku: 'SODA-F', quantity: 7 }], payment: visa }),
        );
      });
      expect(res?.status).toBe(409);
      expect(JSON.stringify(res?.body)).not.toContain('4242');
      expect(JSON.stringify(res?.body)).not.toContain('A1B2C3');
      expect(out).toContain('QUICK_SALE_REPLAY_MISMATCH');
      expect(out).toContain(id);
      expect(out).not.toContain('4242');
      expect(out).not.toContain('A1B2C3');
    });
  });

  // ── e. no card number in a text field ──

  describe('e. card data fields', () => {
    const SIXTEEN_DIGITS = '4111111111111111'; // a 16-digit number such as a card number (the public Visa test value, not a real card)
    const visa = { method: 'CARD', cardScheme: 'VISA', cardLast4: '4242', authCode: 'A1B2C3' };
    const momo = { method: 'MOMO', momoNetwork: 'MTN' };

    for (const field of ['authCode', 'terminalId']) {
      it(`a 16-digit number in ${field} is a 400: not stored, not echoed, not logged`, async () => {
        const id = cid(`pan-${field}`);
        let res: request.Response | undefined;
        const out = await captureOutput(async () => {
          res = await post('tills', sale(id, { payment: { ...visa, [field]: SIXTEEN_DIGITS } }));
        });
        expect(res?.status).toBe(400);
        expect(JSON.stringify(res?.body)).not.toContain(SIXTEEN_DIGITS);
        expect(out).not.toContain(SIXTEEN_DIGITS);
        expect(await ordersFor(id)).toBe(0);
        expect(
          await prisma.payment.count({
            where: { OR: [{ authCode: SIXTEEN_DIGITS }, { terminalId: SIXTEEN_DIGITS }], orgId },
          }),
        ).toBe(0);
      });
    }

    const refused: [string, Record<string, unknown>][] = [
      ['authCode with a dash', { ...visa, authCode: 'AB-123' }],
      ['authCode of 9 characters', { ...visa, authCode: 'A12345678' }],
      ['terminalId with a space', { ...visa, terminalId: 'TRM 03' }],
      ['terminalId of 13 characters', { ...visa, terminalId: 'T'.repeat(13) }],
      ['externalTransactionId on a card sale', { ...visa, externalTransactionId: 'MP123456' }],
      ['payerPhone on a card sale', { ...visa, payerPhone: '+256700000001' }],
      [
        'externalTransactionId on a cash sale',
        { method: 'CASH', externalTransactionId: 'MP123456' },
      ],
      ['payerPhone on a cash sale', { method: 'CASH', payerPhone: '+256700000001' }],
      ['payerPhone that is a card number', { ...momo, payerPhone: SIXTEEN_DIGITS }],
      ['payerPhone of 6 digits', { ...momo, payerPhone: '123456' }],
      ['payerPhone with letters', { ...momo, payerPhone: 'call me' }],
    ];
    for (const [label, payment] of refused) {
      it(`${label}: 400, nothing written, value not echoed`, async () => {
        const id = cid(`e-${label}`);
        const res = await post('tills', sale(id, { payment }));
        expect(res.status).toBe(400);
        expect(await ordersFor(id)).toBe(0);
        const echoed = Object.values(payment).filter(
          (v) => typeof v === 'string' && /\d{6}|call me|TRM 03|AB-123/.test(v),
        );
        for (const v of echoed) expect(JSON.stringify(res.body)).not.toContain(v as string);
      });
    }

    const accepted: [string, Record<string, unknown>][] = [
      ['a 6-character authCode and a dashed terminalId', { ...visa, terminalId: 'TRM-DRK-03' }],
      [
        'mobile money with an id and a +256 number',
        { ...momo, externalTransactionId: 'MP240101123456', payerPhone: '+256700000001' },
      ],
      ['mobile money with a local number with spaces', { ...momo, payerPhone: '0700 000 001' }],
    ];
    for (const [label, payment] of accepted) {
      it(`accepted: ${label}`, async () => {
        const res = await post('tills', sale(cid(`ok-${label}`), { payment }));
        expect(res.status).toBe(200);
      });
    }
  });

  // The reviewer's A3 probe (a unique violation on ANOTHER constraint is not taken for a
  // replay) builds its probe-only index on authCode with an 11-character value, which the new
  // 8-character authCode limit refuses. Same property, on terminalId (11 characters is valid).
  describe('a. a unique violation on another constraint is not a replay (A3 on terminalId)', () => {
    it('is not answered as a replay and writes nothing', async () => {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS h1f_probe_terminal_uq ON payments (terminal_id)
         WHERE terminal_id LIKE 'P2002%'`,
      );
      try {
        const terminalId = `P2002${RUN}`;
        const card = { method: 'CARD', cardScheme: 'VISA', cardLast4: '4242', terminalId };
        const first = await post('tills', sale(cid('a3t-one'), { payment: card }));
        expect(first.status).toBe(200);
        const second = await post('tills', sale(cid('a3t-two'), { payment: card }));
        expect(second.status).not.toBe(200);
        expect(second.body?.order?.id).toBeUndefined();
        expect(await ordersFor(cid('a3t-two'))).toBe(0);
      } finally {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS h1f_probe_terminal_uq');
      }
    });
  });

  // ── f. cash that arrives after its till was reconciled ──

  describe('f. a cash sale that arrives after the till was reconciled', () => {
    const ctx = () => ({ branchId: branch.late, organizationId: orgId });

    async function openAndReconcile(tillCode: string, float: number, cashSale: number) {
      const open = async (startedMsAgo = 60_000) => {
        const shift = await prisma.shift.create({
          data: {
            orgId,
            branchId: branch.late,
            shiftNumber: `H1F-${tillCode}-${randomBytes(3).toString('hex')}`,
            openedById: cashier.id,
          },
        });
        return prisma.tillSession.create({
          data: {
            orgId,
            branchId: branch.late,
            shiftId: shift.id,
            tillCode,
            operatorUserId: cashier.id,
            openedById: cashier.id,
            openingFloat: float,
            openedAt: new Date(Date.now() - startedMsAgo),
          },
        });
      };
      const session = await open();
      const rung = await post(
        'late',
        sale(cid(`late-first-${tillCode}`), {
          tillCode,
          lines: [{ sku: 'BEER-F', quantity: cashSale / 4000 }],
        }),
      );
      expect(rung.status).toBe(200);
      const counted = float + cashSale;
      await tills.reconcileTill(session.id, cashier.id, ctx(), { countedCash: counted }, {});
      const done = await prisma.tillSession.findUniqueOrThrow({ where: { id: session.id } });
      expect(done.status).toBe('RECONCILED');
      expect(Number(done.expectedCash)).toBe(counted);
      return { session: done, open };
    }

    it('with no later session on that code: accepted and stored with its till code, counted in no till', async () => {
      const { session } = await openAndReconcile('DRK-07', 10000, 4000);
      // The tablet was offline at cash-up; its queue now posts a 2,000 cash sale (rung as "drk-07 ").
      const id = cid('late-cash');
      const late = await post(
        'late',
        sale(id, {
          tillCode: 'drk-07 ',
          lines: [{ sku: 'SODA-F', quantity: 1 }],
          soldAt: new Date(Date.now() - 600_000).toISOString(),
        }),
      );
      expect(late.status).toBe(200);
      expect(late.body.order.tillCode).toBe('DRK-07');
      const stored = await prisma.payment.findFirstOrThrow({
        where: { orderId: late.body.order.id },
      });
      expect([stored.tillCode, stored.method, stored.status]).toEqual([
        'DRK-07',
        'CASH',
        'COMPLETED',
      ]);
      expect(Number(stored.amount)).toBe(2000);

      // Where it shows up and where it does not:
      expect(Number(await tills.computeExpectedCash(session.id, 10000, ctx()))).toBe(14000); // reconciled till: unchanged
      const after = await prisma.tillSession.findUniqueOrThrow({ where: { id: session.id } });
      expect([Number(after.expectedCash), Number(after.variance)]).toEqual([14000, 0]); // frozen at reconcile
      const open = await prisma.tillSession.count({
        where: { branchId: branch.late, tillCode: 'DRK-07', status: 'OPEN' },
      });
      expect(open).toBe(0); // no till has it
      const sum = await prisma.payment.aggregate({
        _sum: { amount: true },
        where: { branchId: branch.late, tillCode: 'DRK-07', method: 'CASH', status: 'COMPLETED' },
      });
      expect(Number(sum._sum.amount)).toBe(6000); // the sale ledger has all of it: 4,000 + the late 2,000
    });

    it('with a new session already open on the same code: it lands in that session, not the one it was rung in', async () => {
      const { session, open } = await openAndReconcile('DRK-08', 10000, 4000);
      const next = await open(0); // a new shift reuses the code before the tablet syncs
      const late = await post(
        'late',
        sale(cid('late-cash-2'), { tillCode: 'DRK-08', lines: [{ sku: 'SODA-F', quantity: 1 }] }),
      );
      expect(late.status).toBe(200);
      expect(Number(await tills.computeExpectedCash(session.id, 10000, ctx()))).toBe(14000);
      expect(Number(await tills.computeExpectedCash(next.id, 10000, ctx()))).toBe(12000);
    });
  });
});
