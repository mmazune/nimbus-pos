import { Test } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadavg } from 'os';
import { performance } from 'perf_hooks';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';
import { TillsService } from '../src/modules/tills/tills.service';
import { assertDisposableEventDb } from './support/event-db-guard';

// Must run before anything connects: refuse anything but a local nimbus_event_* database.
assertDisposableEventDb();

/**
 * H1-R: a fresh reviewer's probes of the quick-sale engine (POST /api/pos/quick-sale).
 * Real HTTP, real Postgres. Every probe asserts the CORRECT behaviour, so a probe that is
 * red today is a finding (listed in docs/reviews/h1-sale-engine.md) for H1F to turn green.
 * Own organisations, branches and users, created here with generated passwords; every
 * clientSaleId carries a random run suffix so the spec can run again on the same database.
 */
describe('H1-R review probes: quick sale (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tills: TillsService;
  let orgId: string;
  let org2Id: string;
  const branch: Record<string, string> = {};
  const item: Record<string, string> = {};
  const RUN = randomBytes(3).toString('hex');
  const cid = (label: string) => `${label.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48)}-${RUN}`;
  let cashier: { id: string; token: string };
  let cashier2: { id: string; token: string };
  let waiter: { id: string; token: string };
  let supervisor: { id: string; token: string };
  let manager: { id: string; token: string };
  let supervisorPin: string;

  const STD = [
    { sku: 'BEER-R', name: 'Review beer', price: '4000' },
    { sku: 'SODA-R', name: 'Review soda', price: '2000' },
  ];

  async function makeBranch(org: string, key: string, extra: typeof STD = []) {
    const b = await prisma.branch.create({
      data: {
        organizationId: org,
        name: `H1R ${key}`,
        code: `R${key.toUpperCase()}`.slice(0, 20),
        slug: `h1r-${key}-${RUN}`,
        timezone: 'Africa/Kampala',
        currencyCode: 'UGX',
      },
    });
    branch[key] = b.id;
    const cat = await prisma.category.create({
      data: { orgId: org, branchId: b.id, name: 'Menu' },
    });
    for (const it of [...STD, ...extra]) {
      const m = await prisma.menuItem.create({
        data: {
          orgId: org,
          branchId: b.id,
          categoryId: cat.id,
          name: it.name,
          sku: it.sku,
          brand: 'Review',
          price: it.price,
          itemType: 'DRINK',
        },
      });
      item[`${key}:${it.sku}`] = m.id;
    }
    return b.id;
  }

  async function makeUser(org: string, label: string, roleName: string, keys: string[]) {
    const password = randomBytes(18).toString('hex');
    const email = `${label}.${RUN}@event-h1r.invalid`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 4),
        firstName: label,
        lastName: 'H1R',
      },
    });
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    for (const k of keys) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: org,
          branchId: branch[k],
          roleId: role.id,
          isDefaultBranch: k === keys[0],
        },
      });
    }
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    expect([200, 201]).toContain(login.status);
    return { id: user.id, token: login.body.accessToken as string };
  }

  const post = async (token: string, key: string, body: unknown) => {
    const r = await request(app.getHttpServer())
      .post('/api/pos/quick-sale')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Branch-Id', branch[key])
      .send(body as object);
    if (r.status >= 404 && r.status !== 409) {
      // eslint-disable-next-line no-console
      console.log(`quick-sale HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
    }
    return r;
  };

  const visa = { method: 'CARD', cardScheme: 'VISA', cardLast4: '4242', authCode: 'A1B2C3' };
  const sale = (id: string, over: Record<string, unknown> = {}) => ({
    clientSaleId: id,
    tillCode: 'DRK-03',
    lines: [{ sku: 'BEER-R', quantity: 2 }],
    payment: visa,
    ...over,
  });

  const ordersFor = (clientSaleId: string) =>
    prisma.order.count({ where: { clientSaleId: { startsWith: clientSaleId } } });
  const branchOrders = (key: string) => prisma.order.count({ where: { branchId: branch[key] } });

  /** A raw order row for numbering probes (no quick sale, no lock: like a legacy writer). */
  async function insertOrder(key: string, orderNumber: string) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO orders (id, org_id, branch_id, user_id, order_number, service_type, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'TAKEAWAY'::"ServiceType", 'CLOSED'::"OrderStatus", now())`,
      `h1r-${randomBytes(8).toString('hex')}`,
      orgId,
      branch[key],
      cashier.id,
      orderNumber,
    );
  }

  async function openTill(key: string, tillCode: string, openingFloat: number) {
    const shift = await prisma.shift.create({
      data: {
        orgId,
        branchId: branch[key],
        shiftNumber: `H1R-${key}-${tillCode}-${RUN}`,
        openedById: cashier.id,
      },
    });
    return prisma.tillSession.create({
      data: {
        orgId,
        branchId: branch[key],
        shiftId: shift.id,
        tillCode,
        operatorUserId: cashier.id,
        openedById: cashier.id,
        openingFloat,
        openedAt: new Date(Date.now() - 60_000),
      },
    });
  }

  const expectedCash = async (key: string, sessionId: string, float: number) =>
    Number(
      await tills.computeExpectedCash(sessionId, float, {
        branchId: branch[key],
        organizationId: orgId,
      }),
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    // Same pipe options as src/main.ts.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    tills = app.get(TillsService);

    const dbRow = await prisma.$queryRaw<
      { db: string; port: number }[]
    >`select current_database() as db, inet_server_port() as port`;
    // eslint-disable-next-line no-console
    console.log(`h1r e2e database: ${dbRow[0].db} port ${dbRow[0].port} run ${RUN}`);
    expect(dbRow[0].db.startsWith('nimbus_event_')).toBe(true);

    orgId = (await prisma.organization.create({ data: { name: 'H1R QA', slug: `h1r-qa-${RUN}` } }))
      .id;
    org2Id = (
      await prisma.organization.create({ data: { name: 'H1R QA two', slug: `h1r-qa2-${RUN}` } })
    ).id;

    await makeBranch(orgId, 'a', [
      { sku: 'FREE-R', name: 'Free water', price: '0' },
      { sku: 'HUGE-R', name: 'Huge item', price: '99999999.99' },
    ]);
    for (const k of ['b', 'nomember', 'num', 'big', 'retry', 'conc', 'perf', 'tills', 'tills2']) {
      await makeBranch(orgId, k);
    }
    await makeBranch(org2Id, 'x');

    // Servings: one on BEER-R, one on SODA-R (branch a), for the "serving of another item" case.
    for (const sku of ['BEER-R', 'SODA-R']) {
      const s = await prisma.menuItemServing.create({
        data: { menuItemId: item[`a:${sku}`], format: 'BOTTLE', price: '3500' },
      });
      item[`a:${sku}:serving`] = s.id;
    }

    cashier = await makeUser(orgId, 'cashier', 'Cashier', [
      'a',
      'num',
      'big',
      'retry',
      'conc',
      'perf',
      'tills',
      'tills2',
    ]);
    cashier2 = await makeUser(org2Id, 'cashier2', 'Cashier', ['x']);
    waiter = await makeUser(orgId, 'waiter', 'Waiter', ['a']);
    supervisor = await makeUser(orgId, 'supervisor', 'Supervisor', ['a']);
    manager = await makeUser(orgId, 'manager', 'Manager', ['a']);
    supervisorPin = String(randomInt(10_000_000, 99_999_999));
    await prisma.user.update({
      where: { id: supervisor.id },
      data: { quickPinHash: await bcrypt.hash(supervisorPin, 4), quickPinEnabled: true },
    });
  }, 120000);

  afterAll(async () => {
    for (const sql of [
      'DROP TRIGGER IF EXISTS h1r_audit_fail ON audit_logs',
      'DROP FUNCTION IF EXISTS h1r_audit_fail()',
      'DROP TRIGGER IF EXISTS h1r_collide ON orders',
      'DROP FUNCTION IF EXISTS h1r_collide()',
      'DROP SEQUENCE IF EXISTS h1r_collide_seq',
      'DROP INDEX IF EXISTS h1r_probe_authcode_uq',
      'DROP INDEX IF EXISTS h1r_probe_ordnum_idx',
    ]) {
      await prisma.$executeRawUnsafe(sql);
    }
    await app?.close();
  });

  // ── R3 / A1: a replay whose payload differs must be refused ──

  describe('A1 (R3): same clientSaleId, different sale, must be a 409', () => {
    const differs: [string, Record<string, unknown>][] = [
      ['different lines', { lines: [{ sku: 'BEER-R', quantity: 3 }] }],
      ['different tender', { payment: { method: 'CASH' } }],
      ['different till', { tillCode: 'DRK-04' }],
    ];
    for (const [label, over] of differs) {
      it(`R3 ${label}: second post is 409 and only the first sale exists`, async () => {
        const id = cid(`r3-${label.replace(/ /g, '-')}`);
        const first = await post(cashier.token, 'a', sale(id));
        expect(first.status).toBe(200);
        expect(first.body.replayed).toBe(false);
        const second = await post(cashier.token, 'a', sale(id, over));
        expect(second.status).toBe(409);
        expect(await ordersFor(id)).toBe(1);
      });
    }

    it('R3 control: differing only in optional slip fields is still a plain replay (200)', async () => {
      const id = cid('r3-slip');
      const first = await post(cashier.token, 'a', sale(id));
      expect(first.status).toBe(200);
      const second = await post(
        cashier.token,
        'a',
        sale(id, {
          payment: { ...visa, cardLast4: '1111', authCode: 'ZZZZ99', terminalId: 'TRM-X' },
        }),
      );
      expect(second.status).toBe(200);
      expect(second.body.replayed).toBe(true);
      expect(second.body.order.id).toBe(first.body.order.id);
      expect(await ordersFor(id)).toBe(1);
    });
  });

  // ── A2 + G15 (EV-22): void within 15 minutes, then a queue replays the sale ──

  describe('A2 + G15: post-close void by a Supervisor, then an offline replay', () => {
    const id = cid('void');
    let orderId: string;

    it('G15: Supervisor voids a quick sale with their own PIN; order VOIDED, payment REFUNDED', async () => {
      const r = await post(cashier.token, 'a', sale(id));
      expect(r.status).toBe(200);
      orderId = r.body.order.id;
      const v = await request(app.getHttpServer())
        .post(`/api/pos/orders/${orderId}/post-close-void`)
        .set('Authorization', `Bearer ${supervisor.token}`)
        .set('X-Branch-Id', branch.a)
        .send({ reason: 'Rang twice', managerPin: supervisorPin });
      expect(v.status).toBe(200);
      const o = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { payments: true },
      });
      expect(o.status).toBe('VOIDED');
      expect(o.payments.map((p) => p.status)).toEqual(['REFUNDED']);
    });

    it('A2: the replay returns the original (now VOIDED) and creates no new sale', async () => {
      const before = await branchOrders('a');
      const r = await post(cashier.token, 'a', sale(id));
      expect(r.status).toBe(200);
      expect(r.body.replayed).toBe(true);
      expect(r.body.order.id).toBe(orderId);
      expect(r.body.order.status).toBe('VOIDED');
      expect(r.body.payment.status).toBe('REFUNDED');
      expect(await branchOrders('a')).toBe(before);
    });
  });

  // ── A3: the unique-violation handler acts only on client_sale_id ──

  describe('A3: a unique violation on another constraint is not treated as a replay', () => {
    it('a P2002 on a probe-only payments index is not answered as a replay and writes nothing', async () => {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS h1r_probe_authcode_uq ON payments (auth_code)
         WHERE auth_code LIKE 'P2002%'`,
      );
      const code = `P2002${RUN}`;
      const first = await post(
        cashier.token,
        'a',
        sale(cid('a3-one'), { payment: { ...visa, authCode: code } }),
      );
      expect(first.status).toBe(200);
      const second = await post(
        cashier.token,
        'a',
        sale(cid('a3-two'), { payment: { ...visa, authCode: code } }),
      );
      expect(second.status).not.toBe(200);
      expect(second.body?.order?.id).toBeUndefined();
      expect(await ordersFor(cid('a3-two'))).toBe(0);
      await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS h1r_probe_authcode_uq');
    });
  });

  // ── A4 + D11: organisation and branch come from the guard, never the body ──

  describe('A4 + D11: scope', () => {
    it('A4: an orgId or organizationId in the body is a 400 and writes nothing', async () => {
      for (const extra of [{ orgId: org2Id }, { organizationId: org2Id }, { branchId: branch.b }]) {
        const id = cid(`a4-${Object.keys(extra)[0]}`);
        const r = await post(cashier.token, 'a', sale(id, extra));
        expect(r.status).toBe(400);
        expect(await ordersFor(id)).toBe(0);
      }
    });

    it('A4: the same clientSaleId in another organisation is a new sale there, not a replay', async () => {
      const id = cid('a4-crossorg');
      const one = await post(cashier.token, 'a', sale(id));
      expect(one.status).toBe(200);
      const two = await post(cashier2.token, 'x', sale(id));
      expect(two.status).toBe(200);
      expect(two.body.replayed).toBe(false);
      expect(two.body.order.id).not.toBe(one.body.order.id);
      const rows = await prisma.order.findMany({ where: { clientSaleId: id } });
      expect(rows.map((r) => r.orgId).sort()).toEqual([orgId, org2Id].sort());
    });

    const refused = async (label: string, token: string, key: string, body: object) => {
      const r = await post(token, key, body);
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      expect(await ordersFor(label)).toBe(0);
      return r.status;
    };

    it('D11: menuItemId from another branch of the same organisation is refused', async () => {
      const id = cid('d11-otherbranch');
      const s = await refused(id, cashier.token, 'a', {
        ...sale(id),
        lines: [{ menuItemId: item['b:BEER-R'], quantity: 1 }],
      });
      expect(s).toBe(400);
    });

    it('D11: menuItemId from another organisation is refused', async () => {
      const id = cid('d11-otherorg');
      const s = await refused(id, cashier.token, 'a', {
        ...sale(id),
        lines: [{ menuItemId: item['x:BEER-R'], quantity: 1 }],
      });
      expect(s).toBe(400);
    });

    it('D11: a serving that belongs to a different item is refused', async () => {
      const id = cid('d11-serving');
      const s = await refused(id, cashier.token, 'a', {
        ...sale(id),
        lines: [{ sku: 'BEER-R', menuItemServingId: item['a:SODA-R:serving'], quantity: 1 }],
      });
      expect(s).toBe(400);
    });

    it('D11: a branch the user has no membership in is refused (403)', async () => {
      const id = cid('d11-nomember');
      expect(await refused(id, cashier.token, 'nomember', sale(id))).toBe(403);
    });

    it('D11: another organisation’s branch is refused (403)', async () => {
      const id = cid('d11-org2branch');
      expect(await refused(id, cashier.token, 'x', sale(id))).toBe(403);
    });

    it('permissions are all-of: a Waiter (pos:orders:write only) is refused (403)', async () => {
      const id = cid('perm-waiter');
      expect(await refused(id, waiter.token, 'a', sale(id))).toBe(403);
    });
  });

  // ── B: numbering (EV-15) ──

  describe('B5: odd and large order numbers', () => {
    it('an odd newest number (not ORD-digits) does not reset or break the counter', async () => {
      await insertOrder('num', 'ORD-000010');
      await insertOrder('num', 'EVT-77');
      await insertOrder('num', 'ORD-12A');
      const r = await post(cashier.token, 'num', sale(cid('b5-odd')));
      expect(r.status).toBe(200);
      expect(r.body.order.orderNumber).toBe('ORD-000011');
    });

    it('after ORD-999999 the counter goes to ORD-1000000, then ORD-1000001', async () => {
      await insertOrder('num', 'ORD-999999');
      const one = await post(cashier.token, 'num', sale(cid('b5-999a')));
      const two = await post(cashier.token, 'num', sale(cid('b5-999b')));
      expect([one.status, two.status]).toEqual([200, 200]);
      expect(one.body.order.orderNumber).toBe('ORD-1000000');
      expect(two.body.order.orderNumber).toBe('ORD-1000001');
      // Why R2's fix must not be "highest order_number by the text index": text order puts
      // ORD-999999 above ORD-1000001, so that fix would hand out ORD-1000000 again.
      const [top] = await prisma.$queryRawUnsafe<{ order_number: string }[]>(
        `SELECT order_number FROM orders WHERE branch_id = $1 AND order_number LIKE 'ORD-%'
         ORDER BY order_number DESC LIMIT 1`,
        branch.num,
      );
      expect(top.order_number).toBe('ORD-999999');
    });

    it('an ORD- number beyond 2^31 in the branch does not stop the branch selling', async () => {
      await insertOrder('big', 'ORD-99999999999');
      const r = await post(cashier.token, 'big', sale(cid('b5-big')));
      expect(r.status).toBeLessThan(500);
      expect(r.status).toBe(200);
    });
  });

  describe('B6: the retry after an order_number violation runs in a new transaction', () => {
    it('a forced one-shot collision is retried and succeeds with the next number', async () => {
      await insertOrder('retry', 'ORD-000001');
      // One-shot: a sequence survives the rollback of the failed attempt, so only the first
      // insert into this branch is rewritten onto the existing ORD-000001.
      await prisma.$executeRawUnsafe('CREATE SEQUENCE IF NOT EXISTS h1r_collide_seq');
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION h1r_collide() RETURNS trigger AS $$
        BEGIN
          IF NEW.branch_id = '${branch.retry}' AND nextval('h1r_collide_seq') = 1 THEN
            NEW.order_number := 'ORD-000001';
          END IF;
          RETURN NEW;
        END $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        'CREATE TRIGGER h1r_collide BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION h1r_collide()',
      );
      const r = await post(cashier.token, 'retry', sale(cid('b6')));
      const fired = await prisma.$queryRawUnsafe<{ v: bigint }[]>(
        'SELECT last_value AS v FROM h1r_collide_seq',
      );
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS h1r_collide ON orders');
      expect(Number(fired[0].v)).toBeGreaterThanOrEqual(2); // control: the collision happened
      expect(r.status).toBe(200);
      expect(r.body.order.orderNumber).toBe('ORD-000002');
      expect(await branchOrders('retry')).toBe(2);
    });
  });

  describe('B7: 20 concurrent sales in one branch (negative-control target)', () => {
    it('20 distinct, contiguous order numbers and no failures', async () => {
      const res = await Promise.all(
        Array.from({ length: 20 }, (_, i) => post(cashier.token, 'conc', sale(cid(`b7-${i}`)))),
      );
      const statuses = res.map((r) => r.status);
      expect(statuses.filter((s) => s !== 200)).toEqual([]);
      const nums = res
        .map((r) => Number(String(r.body.order.orderNumber).slice(4)))
        .sort((x, y) => x - y);
      expect(new Set(nums).size).toBe(20);
      expect(nums[19] - nums[0]).toBe(19);
    });
  });

  // ── R2: allocator cost with 10,000 orders in one branch ──

  describe('R2: allocator with 10,000 orders in one branch, 20 concurrent sales', () => {
    const ALLOC_SQL = (b: string) => `
      SELECT MAX(CAST(SUBSTRING(order_number FROM '^ORD-([0-9]+)$') AS INTEGER)) AS max
      FROM orders WHERE branch_id = '${b}'`;

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
    const explain = async (sql: string) => {
      const rows = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': { Plan: PlanNode }[] }[]>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
      );
      const nodes = walk(rows[0]['QUERY PLAN'][0].Plan);
      const scanned = nodes
        .filter((n) => n['Relation Name'] === 'orders')
        .reduce(
          (s, n) =>
            s +
            ((n['Actual Rows'] ?? 0) + (n['Rows Removed by Filter'] ?? 0)) *
              (n['Actual Loops'] ?? 1),
          0,
        );
      return {
        scanned,
        nodes: nodes.map(
          (n) => `${n['Node Type']}${n['Index Name'] ? `(${n['Index Name']})` : ''}`,
        ),
      };
    };

    beforeAll(async () => {
      await prisma.$executeRawUnsafe(
        `INSERT INTO orders (id, org_id, branch_id, user_id, order_number, service_type, status, updated_at)
         SELECT 'h1r-perf-${RUN}-' || g, $1, $2, $3, 'ORD-' || lpad(g::text, 6, '0'),
                'TAKEAWAY'::"ServiceType", 'CLOSED'::"OrderStatus", now()
         FROM generate_series(1, 10000) g`,
        orgId,
        branch.perf,
        cashier.id,
      );
      await prisma.$executeRawUnsafe('ANALYZE orders');
    }, 120000);

    it('the number query reads a handful of rows, not every order in the branch', async () => {
      const e = await explain(ALLOC_SQL(branch.perf));
      // eslint-disable-next-line no-console
      console.log(`R2 allocator plan: ${e.nodes.join(' > ')}; order rows read: ${e.scanned}`);
      expect(e.scanned).toBeLessThanOrEqual(10);
    });

    it('named fix check: an expression index on (branch_id, numeric part as bigint) reads 1 row and agrees', async () => {
      const expr = `CAST(SUBSTRING(order_number FROM '^ORD-([0-9]+)$') AS BIGINT)`;
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS h1r_probe_ordnum_idx ON orders (branch_id, (${expr}))`,
      );
      await prisma.$executeRawUnsafe('ANALYZE orders');
      const fixSql = `SELECT MAX(${expr}) AS max FROM orders WHERE branch_id = '${branch.perf}'`;
      const e = await explain(fixSql);
      const [cur] = await prisma.$queryRawUnsafe<{ max: number }[]>(ALLOC_SQL(branch.perf));
      const [fix] = await prisma.$queryRawUnsafe<{ max: bigint }[]>(fixSql);
      await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS h1r_probe_ordnum_idx');
      // eslint-disable-next-line no-console
      console.log(`R2 fix plan: ${e.nodes.join(' > ')}; order rows read: ${e.scanned}`);
      expect(e.scanned).toBeLessThanOrEqual(2);
      expect(Number(fix.max)).toBe(Number(cur.max));
    });

    it('lock held (lock acquired -> commit returned) p95 <= 20 ms over 10 rounds of 20 concurrent sales', async () => {
      const holds: number[] = [];
      const orig = prisma.$transaction.bind(prisma) as (...a: unknown[]) => Promise<unknown>;
      type Tx = Record<string | symbol, unknown> & {
        $executeRaw: (...a: unknown[]) => Promise<unknown>;
      };
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
                      t0 = performance.now();
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
          holds.push(performance.now() - t0);
          return r;
        });
      }) as never);
      const statuses: number[] = [];
      try {
        for (let round = 0; round < 10; round++) {
          const res = await Promise.all(
            Array.from({ length: 20 }, (_, i) =>
              post(cashier.token, 'perf', sale(cid(`r2-${round}-${i}`))),
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
      const ms = (v: number) => v.toFixed(1);
      const load = loadavg()
        .map((l) => l.toFixed(2))
        .join(' ');
      const non200 = statuses.filter((s) => s !== 200).length;
      // eslint-disable-next-line no-console
      console.log(
        `R2 lock hold ms over ${holds.length} sales: p50 ${ms(pct(0.5))} p95 ${ms(pct(0.95))} max ${ms(sorted[sorted.length - 1])}; non-200: ${non200}; load ${load}`,
      );
      expect(holds.length).toBe(200); // control: the spy saw every sale's transaction
      expect(statuses.filter((s) => s !== 200)).toEqual([]);
      expect(pct(0.95)).toBeLessThanOrEqual(20);
    }, 300000);
  });

  // ── C: money ──

  describe('C8: prices come only from the database', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['price on a line', { lines: [{ sku: 'BEER-R', quantity: 1, price: 1 }] }],
      ['unitPrice on a line', { lines: [{ sku: 'BEER-R', quantity: 1, unitPrice: 1 }] }],
      ['total at the top', { total: 1 }],
      ['amount in payment', { payment: { ...visa, amount: 1 } }],
    ];
    for (const [label, over] of cases) {
      it(`${label} is a 400 and writes nothing`, async () => {
        const id = cid(`c8-${label.replace(/ /g, '-')}`);
        const r = await post(cashier.token, 'a', sale(id, over));
        expect(r.status).toBe(400);
        expect(await ordersFor(id)).toBe(0);
      });
    }
  });

  describe('C9: extremes', () => {
    const bad: [string, Record<string, unknown>][] = [
      ['quantity 0', { lines: [{ sku: 'BEER-R', quantity: 0 }] }],
      ['quantity -1', { lines: [{ sku: 'BEER-R', quantity: -1 }] }],
      ['quantity 1.5', { lines: [{ sku: 'BEER-R', quantity: 1.5 }] }],
      ['quantity 1,000,000,000', { lines: [{ sku: 'BEER-R', quantity: 1_000_000_000 }] }],
      ['quantity "2" (string)', { lines: [{ sku: 'BEER-R', quantity: '2' }] }],
      ['101 lines', { lines: Array.from({ length: 101 }, () => ({ sku: 'BEER-R', quantity: 1 })) }],
      ['total of 10^11 (HUGE x 1000)', { lines: [{ sku: 'HUGE-R', quantity: 1000 }] }],
      ['tendered 10^15', { payment: { method: 'CASH', tenderedAmount: 1e15 } }],
      ['tendered with 3 decimals', { payment: { method: 'CASH', tenderedAmount: 10000.005 } }],
      ['empty lines', { lines: [] }],
      ['payment as an array', { payment: [visa, visa] }],
    ];
    for (const [label, over] of bad) {
      it(`${label}: 400, no 5xx, nothing written`, async () => {
        const id = cid(`c9-${label}`);
        const r = await post(cashier.token, 'a', sale(id, over));
        expect(r.status).toBe(400);
        expect(await ordersFor(id)).toBe(0);
      });
    }

    it('100 lines are accepted and priced exactly (100 x 2 x 4,000 = 800,000)', async () => {
      const r = await post(
        cashier.token,
        'a',
        sale(cid('c9-100'), {
          lines: Array.from({ length: 100 }, () => ({ sku: 'BEER-R', quantity: 2 })),
        }),
      );
      expect(r.status).toBe(200);
      expect(String(r.body.order.total)).toBe('800000');
      expect(String(r.body.payment.amount)).toBe('800000');
    });

    it('quantity 1000 is accepted (4,000,000)', async () => {
      const r = await post(
        cashier.token,
        'a',
        sale(cid('c9-q1000'), { lines: [{ sku: 'BEER-R', quantity: 1000 }] }),
      );
      expect(r.status).toBe(200);
      expect(String(r.body.order.total)).toBe('4000000');
    });

    it('note: an item priced 0 makes a CLOSED sale with a COMPLETED payment of 0', async () => {
      const r = await post(
        cashier.token,
        'a',
        sale(cid('c9-free'), { lines: [{ sku: 'FREE-R', quantity: 1 }] }),
      );
      expect(r.status).toBe(200);
      expect(String(r.body.order.total)).toBe('0');
      expect(r.body.payment.status).toBe('COMPLETED');
    });
  });

  describe('C10: Payment.amount = Order.total on every quick-sale row in this database', () => {
    it('no quick-sale order has a payment that differs from its total, or other than one payment', async () => {
      const [row] = await prisma.$queryRawUnsafe<
        { sales: bigint; mismatched: bigint; not_one_payment: bigint }[]
      >(`
        SELECT
          (SELECT count(*) FROM orders WHERE client_sale_id IS NOT NULL) AS sales,
          (SELECT count(*) FROM orders o JOIN payments p ON p.order_id = o.id
             WHERE o.client_sale_id IS NOT NULL AND p.amount <> o.total) AS mismatched,
          (SELECT count(*) FROM orders o
             WHERE o.client_sale_id IS NOT NULL
               AND (SELECT count(*) FROM payments p WHERE p.order_id = o.id) <> 1) AS not_one_payment`);
      // eslint-disable-next-line no-console
      console.log(
        `C10 quick-sale orders: ${row.sales}; amount<>total: ${row.mismatched}; not one payment: ${row.not_one_payment}`,
      );
      expect(Number(row.sales)).toBeGreaterThanOrEqual(200); // control: the fixture night is here
      expect(Number(row.mismatched)).toBe(0);
      expect(Number(row.not_one_payment)).toBe(0);
    });

    it('no float arithmetic on money in the quick-sale service or the allocator', () => {
      for (const f of [
        '../src/modules/quick-sale/quick-sale.service.ts',
        '../src/modules/orders/order-number.ts',
      ]) {
        const src = readFileSync(join(__dirname, f), 'utf8');
        expect(
          src.match(/parseFloat|toFixed|(?<![A-Za-z])Number\(|Math\.|\.toNumber\(/g),
        ).toBeNull();
      }
    });
  });

  // ── E: validation ──

  describe('E12: validation', () => {
    const bad: [string, Record<string, unknown>][] = [
      ['unknown field inside payment', { payment: { ...visa, foo: 1 } }],
      ['unknown field inside a line', { lines: [{ sku: 'BEER-R', quantity: 1, foo: 1 }] }],
      ['cardLast4 on a cash sale', { payment: { method: 'CASH', cardLast4: '4242' } }],
      ['authCode on a cash sale', { payment: { method: 'CASH', authCode: 'A1' } }],
      ['terminalId on a cash sale', { payment: { method: 'CASH', terminalId: 'T1' } }],
      ['cardLast4 of 3 digits', { payment: { ...visa, cardLast4: '424' } }],
      ['cardLast4 of letters', { payment: { ...visa, cardLast4: 'abcd' } }],
      ['cardLast4 of 5 digits', { payment: { ...visa, cardLast4: '42424' } }],
      ['authCode of 33 chars', { payment: { ...visa, authCode: 'A'.repeat(33) } }],
      ['terminalId of 65 chars', { payment: { ...visa, terminalId: 'T'.repeat(65) } }],
      ['tillCode of 51 chars', { tillCode: 'D'.repeat(51) }],
      ['empty tillCode', { tillCode: '' }],
      [
        'externalTransactionId of 101 chars',
        { payment: { method: 'MOMO', momoNetwork: 'MTN', externalTransactionId: '9'.repeat(101) } },
      ],
      [
        'payerPhone of 33 chars',
        { payment: { method: 'MOMO', momoNetwork: 'MTN', payerPhone: '7'.repeat(33) } },
      ],
      ['unknown cardScheme', { payment: { ...visa, cardScheme: 'AMEX' } }],
      ['unknown method', { payment: { method: 'BANK_TRANSFER' } }],
      ['soldAt without an offset', { soldAt: '2026-11-28T21:14:00' }],
    ];
    for (const [label, over] of bad) {
      it(`${label}: 400, nothing written`, async () => {
        const id = cid(`e12-${label}`);
        const r = await post(cashier.token, 'a', sale(id, over));
        expect(r.status).toBe(400);
        expect(await ordersFor(id)).toBe(0);
      });
    }

    it('clientSaleId of 7 chars or with a space is a 400', async () => {
      for (const id of ['abc1234', 'has space-123']) {
        const r = await post(cashier.token, 'a', sale(id));
        expect(r.status).toBe(400);
      }
    });
  });

  // ── F: till cash (EV-20) ──

  describe('F13: till code as typed on the tablet', () => {
    let sessionId: string;
    beforeAll(async () => {
      sessionId = (await openTill('tills', 'DRK-03', 10000)).id;
    });
    const cash = (id: string, tillCode: string) =>
      sale(id, { tillCode, lines: [{ sku: 'SODA-R', quantity: 1 }], payment: { method: 'CASH' } });

    it('exact code: 2,000 cash at DRK-03 reaches DRK-03 expected cash', async () => {
      const before = await expectedCash('tills', sessionId, 10000);
      expect((await post(cashier.token, 'tills', cash(cid('f13-exact'), 'DRK-03'))).status).toBe(
        200,
      );
      expect(await expectedCash('tills', sessionId, 10000)).toBe(before + 2000);
    });

    ['drk-03', 'DRK-03 ', ' DRK-03'].forEach((variant, n) => {
      it(`"${variant}": the cash reaches DRK-03 expected cash (or the sale is refused)`, async () => {
        const before = await expectedCash('tills', sessionId, 10000);
        const r = await post(cashier.token, 'tills', cash(cid(`f13-variant-${n}`), variant));
        if (r.status === 400) return; // refusing an unknown till code is an acceptable fix
        expect(r.status).toBe(200);
        expect(await expectedCash('tills', sessionId, 10000)).toBe(before + 2000);
      });
    });

    it('note (documents, 03 skips the till-session check on purpose): cash at a till code with no session is accepted and counted by no till', async () => {
      const before = await expectedCash('tills', sessionId, 10000);
      const r = await post(cashier.token, 'tills', cash(cid('f13-nosession'), 'DRK-99'));
      const after = await expectedCash('tills', sessionId, 10000);
      // eslint-disable-next-line no-console
      console.log(`F13 unknown till: HTTP ${r.status}; DRK-03 expected ${before} -> ${after}`);
      expect(r.status).toBe(200);
      expect(after).toBe(before);
    });
  });

  describe('F14: two tills in one branch (negative-control target)', () => {
    it("each till's expected cash is its own float plus its own cash", async () => {
      const t1 = await openTill('tills2', 'DRK-01', 20000);
      const t2 = await openTill('tills2', 'DRK-02', 5000);
      const c = (id: string, till: string, qty: number) =>
        sale(id, {
          tillCode: till,
          lines: [{ sku: 'BEER-R', quantity: qty }],
          payment: { method: 'CASH' },
        });
      expect((await post(cashier.token, 'tills2', c(cid('f14-1'), 'DRK-01', 3))).status).toBe(200);
      expect((await post(cashier.token, 'tills2', c(cid('f14-2'), 'DRK-02', 5))).status).toBe(200);
      expect(await expectedCash('tills2', t1.id, 20000)).toBe(20000 + 12000);
      expect(await expectedCash('tills2', t2.id, 5000)).toBe(5000 + 20000);
    });
  });

  // ── G16 (EV-16): an existing dashboard counts a quick sale ──

  describe('G16: GET /api/dash/today-summary (Manager) counts a quick sale', () => {
    it('closedOrders +1 and grossSales +8,000 after one quick sale', async () => {
      const read = () =>
        request(app.getHttpServer())
          .get('/api/dash/today-summary')
          .set('Authorization', `Bearer ${manager.token}`)
          .set('X-Branch-Id', branch.a);
      const before = await read();
      expect(before.status).toBe(200);
      expect((await post(cashier.token, 'a', sale(cid('g16')))).status).toBe(200);
      const after = await read();
      // eslint-disable-next-line no-console
      console.log(
        `G16 today-summary branch a: closedOrders ${before.body.closedOrders} -> ${after.body.closedOrders}; grossSales ${before.body.grossSales} -> ${after.body.grossSales}; card ${JSON.stringify(before.body.paymentMix.card)} -> ${JSON.stringify(after.body.paymentMix.card)}`,
      );
      expect(Number(after.body.closedOrders)).toBe(Number(before.body.closedOrders) + 1);
      expect(Number(after.body.grossSales)).toBe(Number(before.body.grossSales) + 8000);
    });
  });

  // ── R1: the audit write fails after the sale commits ──

  describe('R1: audit failure after commit', () => {
    const id = cid('r1fail');
    let res: request.Response;
    let errorCalls: string;

    beforeAll(async () => {
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION h1r_audit_fail() RETURNS trigger AS $$
        BEGIN
          IF NEW.action = 'ORDER_QUICK_SALE' AND NEW.metadata->>'clientSaleId' LIKE 'r1fail-%' THEN
            RAISE EXCEPTION 'h1r probe: audit insert refused';
          END IF;
          RETURN NEW;
        END $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        'CREATE TRIGGER h1r_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION h1r_audit_fail()',
      );
      const spy = jest.spyOn(Logger.prototype, 'error');
      res = await post(cashier.token, 'a', sale(id));
      errorCalls = JSON.stringify(spy.mock.calls);
      spy.mockRestore();
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS h1r_audit_fail ON audit_logs');
    });

    it('the sale still succeeds and no audit row exists (control: the audit really failed)', async () => {
      expect(res.status).toBe(200);
      expect(await prisma.auditLog.count({ where: { entityId: res.body.order.id } })).toBe(0);
    });

    it('the error log carries order id, clientSaleId and branchId', () => {
      expect(errorCalls).toContain(res.body.order.id);
      expect(errorCalls).toContain(id);
      expect(errorCalls).toContain(branch.a);
    });

    it('the error log carries no card data', () => {
      expect(errorCalls).not.toContain('4242');
      expect(errorCalls).not.toContain('A1B2C3');
    });

    it('the order and payment rows alone show who sold, at which till, when', async () => {
      const o = await prisma.order.findUniqueOrThrow({
        where: { id: res.body.order.id },
        include: { payments: true },
      });
      expect(o.userId).toBe(cashier.id);
      expect(o.tillCode).toBe('DRK-03');
      expect(o.createdAt).toBeInstanceOf(Date);
      expect(o.payments[0].enteredById).toBe(cashier.id);
      expect(o.payments[0].tillCode).toBe('DRK-03');
      expect(o.payments[0].createdAt).toBeInstanceOf(Date);
    });
  });

  // ── H18: card data ──

  describe('H18: card data limited to scheme, last four, approval code, terminal ID', () => {
    it('the audit metadata of a card sale carries no card field', async () => {
      const r = await post(cashier.token, 'a', sale(cid('h18-audit')));
      expect(r.status).toBe(200);
      const rows = await prisma.auditLog.findMany({ where: { entityId: r.body.order.id } });
      expect(rows).toHaveLength(1);
      const meta = JSON.stringify(rows[0].metadata);
      expect(meta).not.toContain('4242');
      expect(meta).not.toContain('A1B2C3');
    });

    it('a refused value is not echoed in the error message', async () => {
      const r = await post(
        cashier.token,
        'a',
        sale(cid('h18-echo'), { payment: { ...visa, cardLast4: '9x7z' } }),
      );
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).not.toContain('9x7z');
    });

    for (const field of ['authCode', 'terminalId']) {
      it(`a full card number typed into ${field} is refused (400), not stored`, async () => {
        const id = cid(`h18-pan-${field}`);
        // 4111 1111 1111 1111: the public Visa test number (Luhn-valid), not a real card.
        const pan = '4111111111111111';
        const r = await post(cashier.token, 'a', sale(id, { payment: { ...visa, [field]: pan } }));
        const stored = await prisma.payment.count({
          where: { OR: [{ authCode: pan }, { terminalId: pan }], order: { clientSaleId: id } },
        });
        const echoed = JSON.stringify(r.body).includes(pan);
        // eslint-disable-next-line no-console
        console.log(
          `H18 PAN in ${field}: HTTP ${r.status}; stored rows ${stored}; echoed ${echoed}`,
        );
        expect(r.status).toBe(400);
        expect(stored).toBe(0);
      });
    }
  });
});
