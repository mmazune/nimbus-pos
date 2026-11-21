import { Test } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { AddressInfo } from 'net';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadavg } from 'os';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';
import { AppModule } from '../src/app.module';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/common/prisma';
import { allocateOrderNumber } from '../src/modules/orders/order-number';
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
  let baseUrl: string;
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
    const login = await request(baseUrl).post('/api/auth/login').send({ email, password });
    expect([200, 201]).toContain(login.status);
    return { id: user.id, token: login.body.accessToken as string };
  }

  const post = async (token: string, key: string, body: unknown) => {
    const r = await request(baseUrl)
      .post('/api/pos/quick-sale')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Branch-Id', branch[key])
      .send(body as object);
    if (r.status >= 404 && r.status !== 409) {
      // eslint-disable-next-line no-console
      console.log(`quick-sale HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
    }
    if (r.status === 404) {
      // H1-R2 question 10: a 404 with an empty body is not Nest's. Record who answered: the
      // URL supertest used, the response headers and raw text, and what listens on that port
      // now (supertest has already closed its own ephemeral server by this point).
      const url = (r as unknown as { request?: { url?: string } }).request?.url ?? '?';
      const port = /:(\d+)\//.exec(url)?.[1];
      let listeners = 'n/a';
      try {
        listeners = port
          ? execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN || true`, { encoding: 'utf8' })
          : 'no port';
      } catch (e) {
        listeners = `lsof failed: ${(e as Error).message}`;
      }
      // eslint-disable-next-line no-console
      console.log(
        `H1R2-404 url=${url} headers=${JSON.stringify(r.headers)} text=${JSON.stringify((r.text ?? '').slice(0, 300))}\nlisteners on ${port}:\n${listeners}`,
      );
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
    // Listen once, on the loopback address only, and send every request there (H1F2, part c).
    // Without a fixed listener supertest binds a fresh ephemeral port per request, and another
    // program on this machine once answered on that port number (a 404 'not found' from a
    // foreign process). Listening on 127.0.0.1 and requesting that exact address removes it.
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
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
      'DROP TRIGGER IF EXISTS h1r_race ON orders',
      'DROP FUNCTION IF EXISTS h1r_race()',
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

    it('R3 race (unique-violation path): a different sale racing the first under the same id is a 409', async () => {
      // Probe-only trigger: the first insert for this id sleeps, so the second request misses
      // the up-front lookup and reaches the client_sale_id unique-violation handler instead.
      const id = cid('r3race');
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION h1r_race() RETURNS trigger AS $$
        BEGIN
          IF NEW.client_sale_id = '${id}' THEN PERFORM pg_sleep(0.6); END IF;
          RETURN NEW;
        END $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        'CREATE TRIGGER h1r_race BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION h1r_race()',
      );
      try {
        const first = post(cashier.token, 'a', sale(id));
        await new Promise((r) => setTimeout(r, 150));
        const second = post(
          cashier.token,
          'a',
          sale(id, { lines: [{ sku: 'BEER-R', quantity: 3 }] }),
        );
        const [x, y] = await Promise.all([first, second]);
        expect(x.status).toBe(200);
        expect(x.body.replayed).toBe(false);
        expect(y.status).toBe(409);
        expect(await ordersFor(id)).toBe(1);
      } finally {
        await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS h1r_race ON orders');
      }
    });

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
      const v = await request(baseUrl)
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
      // H1-R2 (owner ruling P1): authCode is capped at 8 letters or digits, so the code is
      // 'P2' + the 6-hex run id (8 chars). The probe index covers exactly this run's code, so
      // the only unique constraint the second sale can hit is this one, and a stale index
      // from an earlier interrupted run cannot change the predicate.
      const code = `P2${RUN}`;
      await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS h1r_probe_authcode_uq');
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX h1r_probe_authcode_uq ON payments (auth_code)
         WHERE auth_code = '${code}'`,
      );
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
    // H1-R2 (owner ruling P2): the probe examines the query the allocator REALLY runs, not a
    // copy. allocateOrderNumber is called with a transaction stand-in that records the
    // Prisma.Sql its $queryRaw receives (text with $n placeholders plus the bound values).
    // That exact statement is then EXPLAINed and run against the database.
    const realAllocatorQuery = async (b: string): Promise<Prisma.Sql> => {
      const seen: Prisma.Sql[] = [];
      const stand = {
        $executeRaw: async () => 0,
        $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
          seen.push(Prisma.sql(strings, ...values));
          return [{ max: null }];
        },
      } as unknown as Prisma.TransactionClient;
      await allocateOrderNumber(stand, b);
      expect(seen).toHaveLength(1);
      expect(seen[0].values).toEqual([b]);
      return seen[0];
    };
    const runReal = async (q: Prisma.Sql) =>
      // .text is the Postgres form ($1 placeholders); .sql is the '?' form.
      (await prisma.$queryRawUnsafe<{ max: string | null }[]>(q.text, ...q.values))[0].max;

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
    const explain = async (sql: string, values: unknown[] = []) => {
      const rows = await prisma.$queryRawUnsafe<
        { 'QUERY PLAN': { Plan: PlanNode; 'Execution Time': number }[] }[]
      >(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, ...values);
      const execMs = rows[0]['QUERY PLAN'][0]['Execution Time'];
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
        execMs,
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
      const q = await realAllocatorQuery(branch.perf);
      const e = await explain(q.text, q.values);
      // eslint-disable-next-line no-console
      console.log(
        `R2 allocator plan (real query from order-number.ts): ${e.nodes.join(' > ')}; order rows read: ${e.scanned}; execution ${e.execMs} ms`,
      );
      // Control: the plan really touched orders (a plan that reads nothing must not pass).
      expect(e.nodes.length).toBeGreaterThan(0);
      // ...and its answer agrees with the maximum computed in JS over every row of the branch.
      const all = await prisma.order.findMany({
        where: { branchId: branch.perf },
        select: { orderNumber: true },
      });
      const jsMax = all
        .map((o) => /^ORD-([0-9]+)$/.exec(o.orderNumber)?.[1])
        .filter((d): d is string => d !== undefined)
        .reduce((m, d) => (BigInt(d) > m ? BigInt(d) : m), BigInt(0));
      expect(all.length).toBeGreaterThanOrEqual(10000);
      expect(await runReal(q)).toBe(jsMax.toString());
      expect(e.scanned).toBeGreaterThanOrEqual(1);
      expect(e.scanned).toBeLessThanOrEqual(10);
    });

    it('named fix check: an expression index on (branch_id, numeric part as bigint) reads 1 row and agrees', async () => {
      const expr = `CAST(SUBSTRING(order_number FROM '^ORD-([0-9]+)$') AS BIGINT)`;
      // H1-R2: partial on this branch, so building the probe index evaluates the BIGINT cast for
      // this branch's 6-digit numbers only. A whole-table BIGINT index cannot even be built once
      // any branch holds a 19+ digit ORD- number (the H1-R2 index probes insert some), which is
      // the owner's P4 reason for NUMERIC in the product index.
      await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS h1r_probe_ordnum_idx');
      await prisma.$executeRawUnsafe(
        `CREATE INDEX h1r_probe_ordnum_idx ON orders (branch_id, (${expr}))
         WHERE branch_id = '${branch.perf}'`,
      );
      // H1-R2: dropped in `finally`. A BIGINT probe index left behind by a failure makes every
      // later insert of a 19+ digit ORD- number fail, which would poison the round-2 index probes.
      let e: Awaited<ReturnType<typeof explain>>;
      let cur: { max: string | null };
      let fix: { max: bigint };
      try {
        await prisma.$executeRawUnsafe('ANALYZE orders');
        const fixSql = `SELECT MAX(${expr}) AS max FROM orders WHERE branch_id = '${branch.perf}'`;
        e = await explain(fixSql);
        cur = { max: await runReal(await realAllocatorQuery(branch.perf)) };
        [fix] = await prisma.$queryRawUnsafe<{ max: bigint }[]>(fixSql);
      } finally {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS h1r_probe_ordnum_idx');
      }
      // eslint-disable-next-line no-console
      console.log(
        `R2 fix plan: ${e.nodes.join(' > ')}; order rows read: ${e.scanned}; execution ${e.execMs} ms`,
      );
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
      // H1F2 (owner ruling): the wall-clock threshold is opt-in (EVENT_PERF=1). The deterministic
      // half (the allocator's real query reads through the index, a handful of rows) is the R2
      // test above and stays in every run, as do the two controls and the all-200 check here.
      if (process.env.EVENT_PERF === '1') {
        expect(pct(0.95)).toBeLessThanOrEqual(20);
      }
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
        { sales: bigint; night: bigint; mismatched: bigint; not_one_payment: bigint }[]
      >(`
        SELECT
          (SELECT count(*) FROM orders WHERE client_sale_id IS NOT NULL) AS sales,
          (SELECT count(*) FROM orders WHERE client_sale_id LIKE 'night-%') AS night,
          (SELECT count(*) FROM orders o JOIN payments p ON p.order_id = o.id
             WHERE o.client_sale_id IS NOT NULL AND p.amount <> o.total) AS mismatched,
          (SELECT count(*) FROM orders o
             WHERE o.client_sale_id IS NOT NULL
               AND (SELECT count(*) FROM payments p WHERE p.order_id = o.id) <> 1) AS not_one_payment`);
      // eslint-disable-next-line no-console
      console.log(
        `C10 quick-sale orders: ${row.sales} (fixture night: ${row.night}); amount<>total: ${row.mismatched}; not one payment: ${row.not_one_payment}`,
      );
      // Control: H1's 200-sale fixture night (test/quick-sale.e2e-spec.ts) must have been run
      // on this database first; its clientSaleIds start with "night-".
      expect(Number(row.night)).toBeGreaterThanOrEqual(200);
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
        request(baseUrl)
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

  // ══════════════════════════════════════════════════════════════════════════════════════
  // H1-R2: second look at the H1F fixes (docs/reviews/h1-sale-engine.md, "Round 2").
  // Every probe asserts the correct behaviour; a red one is a round-2 finding.
  // ══════════════════════════════════════════════════════════════════════════════════════

  describe('H1-R2', () => {
    const ctxOf = (key: string) => ({ branchId: branch[key], organizationId: orgId });

    beforeAll(async () => {
      const role = await prisma.membership.findFirstOrThrow({
        where: { userId: cashier.id, branchId: branch.a },
        select: { roleId: true },
      });
      for (const k of ['r2idx', 'r2tills', 'r2fp']) {
        await makeBranch(orgId, k);
        await prisma.membership.create({
          data: { userId: cashier.id, organizationId: orgId, branchId: branch[k], roleId: role.roleId },
        });
      }
    }, 60000);

    // ── 1. Replay fingerprint ──

    describe('1. replay fingerprint', () => {
      it('two DIFFERENT sales under one clientSaleId sent at the same moment: one 200, one 409, never replayed (x10)', async () => {
        const outcomes: string[] = [];
        for (let i = 0; i < 10; i++) {
          const id = cid(`r2-fp-race-${i}`);
          const [x, y] = await Promise.all([
            post(cashier.token, 'r2fp', sale(id)),
            post(cashier.token, 'r2fp', sale(id, { lines: [{ sku: 'SODA-R', quantity: 5 }] })),
          ]);
          outcomes.push(`${x.status}/${x.body?.replayed}|${y.status}/${y.body?.replayed}`);
          const statuses = [x.status, y.status].sort();
          expect(statuses).toEqual([200, 409]);
          expect([x.body?.replayed, y.body?.replayed]).not.toContain(true);
          expect(await ordersFor(id)).toBe(1);
        }
        // eslint-disable-next-line no-console
        console.log(`R2-1 different-sale race outcomes: ${outcomes.join(' ')}`);
      });

      it('two cash sales differing only in tenderedAmount, at the same moment: one 200, one 409', async () => {
        const id = cid('r2-fp-tender');
        const cash = (t: number) => sale(id, { payment: { method: 'CASH', tenderedAmount: t } });
        const [x, y] = await Promise.all([
          post(cashier.token, 'r2fp', cash(10000)),
          post(cashier.token, 'r2fp', cash(20000)),
        ]);
        expect([x.status, y.status].sort()).toEqual([200, 409]);
        const refused = x.status === 409 ? x : y;
        expect(refused.body.code ?? refused.body.message?.code).toBeDefined();
        expect(JSON.stringify(refused.body)).toContain('payment.tenderedAmount');
        expect(await ordersFor(id)).toBe(1);
      });

      it('an IDENTICAL retry sent at the same moment as the original still replays (one false, one true)', async () => {
        const id = cid('r2-fp-same');
        const body = sale(id, {
          soldAt: '2026-11-26T21:04:00+03:00',
          payment: { method: 'CASH', tenderedAmount: 10000 },
        });
        const [x, y] = await Promise.all([
          post(cashier.token, 'r2fp', body),
          post(cashier.token, 'r2fp', body),
        ]);
        expect([x.status, y.status]).toEqual([200, 200]);
        expect([x.body.replayed, y.body.replayed].sort()).toEqual([false, true]);
        expect(x.body.order.id).toBe(y.body.order.id);
        expect(await ordersFor(id)).toBe(1);
        const later = await post(cashier.token, 'r2fp', body);
        expect(later.status).toBe(200);
        expect(later.body.replayed).toBe(true);
      });

      it('the stored fingerprint holds only soldAt and tenderedAmount, and no card data', async () => {
        const id = cid('r2-fp-card');
        const r = await post(cashier.token, 'r2fp', sale(id));
        expect(r.status).toBe(200);
        const o = await prisma.order.findUniqueOrThrow({ where: { id: r.body.order.id } });
        const meta = o.metadata as { fingerprint?: Record<string, unknown> };
        expect(Object.keys(meta.fingerprint ?? {}).sort()).toEqual(['soldAt', 'tenderedAmount']);
        const all = JSON.stringify(o.metadata);
        expect(all).not.toContain('4242');
        expect(all).not.toContain('A1B2C3');
      });

      it('a sale stored before H1F (no fingerprint) is handled without a server error', async () => {
        const id = cid('r2-fp-legacy');
        const body = sale(id, { payment: { method: 'CASH', tenderedAmount: 10000 } });
        const first = await post(cashier.token, 'r2fp', body);
        expect(first.status).toBe(200);
        await prisma.$executeRawUnsafe(
          `UPDATE orders SET metadata = metadata - 'fingerprint' WHERE id = $1`,
          first.body.order.id,
        );
        const same = await post(cashier.token, 'r2fp', body);
        const otherTender = await post(
          cashier.token,
          'r2fp',
          sale(id, { payment: { method: 'CASH', tenderedAmount: 50000 } }),
        );
        const otherLines = await post(
          cashier.token,
          'r2fp',
          sale(id, { lines: [{ sku: 'SODA-R', quantity: 1 }], payment: { method: 'CASH' } }),
        );
        // eslint-disable-next-line no-console
        console.log(
          `R2-1 legacy (no fingerprint): identical ${same.status}/${same.body.replayed}; other tender ${otherTender.status}/${otherTender.body.replayed}; other lines ${otherLines.status}`,
        );
        expect(same.status).toBe(200);
        expect(same.body.replayed).toBe(true);
        expect(otherTender.status).toBeLessThan(500);
        expect(otherLines.status).toBe(409);
        expect(await ordersFor(id)).toBe(1);
      });

      it('note: the same soldAt instant written with another offset is not a replay (documents)', async () => {
        const id = cid('r2-fp-offset');
        const first = await post(
          cashier.token,
          'r2fp',
          sale(id, { soldAt: '2026-11-26T21:04:00+03:00' }),
        );
        const again = await post(
          cashier.token,
          'r2fp',
          sale(id, { soldAt: '2026-11-26T18:04:00Z' }),
        );
        // eslint-disable-next-line no-console
        console.log(`R2-1 soldAt same instant, other offset: ${first.status} then ${again.status}`);
        expect(first.status).toBe(200);
        expect(await ordersFor(id)).toBe(1);
      });
    });

    // ── 2. The real case: two beers by Visa at DRK-03, offline, posted twice ──

    it('2. real case: two beers by Visa at DRK-03 with no signal, posted twice when the signal returns', async () => {
      const id = cid('r2-realcase');
      const body = sale(id, { soldAt: '2026-11-26T22:14:05+03:00' });
      const before = await branchOrders('r2fp');
      const [x, y] = await Promise.all([
        post(cashier.token, 'r2fp', body),
        post(cashier.token, 'r2fp', body),
      ]);
      expect([x.status, y.status]).toEqual([200, 200]);
      expect([x.body.replayed, y.body.replayed].sort()).toEqual([false, true]);
      expect(x.body.order.id).toBe(y.body.order.id);
      expect(await branchOrders('r2fp')).toBe(before + 1);
      const o = await prisma.order.findUniqueOrThrow({
        where: { id: x.body.order.id },
        include: { payments: true, items: true },
      });
      expect(o.tillCode).toBe('DRK-03');
      expect(String(o.total)).toBe('8000');
      expect(o.payments).toHaveLength(1);
      expect(String(o.payments[0].amount)).toBe('8000');
      expect(o.payments[0].method).toBe('CARD');
      expect(o.payments[0].cardScheme).toBe('VISA');
      expect(o.items).toHaveLength(1);
      expect(o.items[0].quantity).toBe(2);
    });

    // ── 3. The new expression index never fails an insert ──

    describe('3. the numeric order-number index never fails an insert', () => {
      const odd = [
        'ORD-',
        'ORD-abc',
        'ORD-1e5',
        'ORD-12 34',
        '',
        `ORD-${'9'.repeat(40)}`,
        `ORD-${'8'.repeat(400)}`,
      ];
      it('Prisma inserts of odd numbers all succeed with the index present', async () => {
        const idx = await prisma.$queryRawUnsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = 'orders_branch_id_order_number_numeric_idx'`,
        );
        expect(idx[0].n).toBe(1);
        const results: string[] = [];
        for (const orderNumber of odd) {
          try {
            await prisma.order.create({
              data: {
                orgId,
                branchId: branch.r2idx,
                userId: cashier.id,
                orderNumber,
                serviceType: 'TAKEAWAY',
                status: 'CLOSED',
              },
            });
            results.push(`${orderNumber.slice(0, 14)}(${orderNumber.length}):ok`);
          } catch (e) {
            results.push(`${orderNumber.slice(0, 14)}(${orderNumber.length}):FAIL ${(e as Error).message.split('\n').pop()}`);
          }
        }
        // eslint-disable-next-line no-console
        console.log(`R2-3 inserts: ${results.join(' | ')}`);
        expect(results.filter((r) => r.includes('FAIL'))).toEqual([]);
      });

      it('the allocator ignores the non-matching ones and continues from the highest ORD-digits number', async () => {
        // In this branch the matching numbers are the 40- and 400-digit ones; the rest are NULL.
        const r = await post(cashier.token, 'r2idx', sale(cid('r2-idx-after')));
        expect(r.status).toBe(200);
        const expected = `ORD-${(BigInt('8'.repeat(400)) + BigInt(1)).toString()}`;
        expect(r.body.order.orderNumber).toBe(expected);
      });

      it('in a branch holding only non-matching numbers the allocator starts at ORD-000001', async () => {
        await makeBranch(orgId, 'r2idx2');
        const role = await prisma.membership.findFirstOrThrow({
          where: { userId: cashier.id, branchId: branch.a },
          select: { roleId: true },
        });
        await prisma.membership.create({
          data: { userId: cashier.id, organizationId: orgId, branchId: branch.r2idx2, roleId: role.roleId },
        });
        for (const n of ['ORD-', 'ORD-abc', 'ORD-1e5', 'ORD-12 34', '']) await insertOrder('r2idx2', n);
        const r = await post(cashier.token, 'r2idx2', sale(cid('r2-idx2')));
        expect(r.status).toBe(200);
        expect(r.body.order.orderNumber).toBe('ORD-000001');
      });

      it('note: where the index row limit sits, against the existing unique index (documents)', async () => {
        // A btree entry is capped near 2,700 bytes. The existing (branch_id, order_number) unique
        // index has the same kind of limit on the raw text, so this records which one refuses first.
        const out: string[] = [];
        for (const digits of [2000, 5000, 8000]) {
          // Random digits: a repeated digit compresses inside the index tuple and hides the limit.
          const n = `ORD-${Array.from({ length: digits }, () => randomInt(0, 10)).join('')}`;
          try {
            await prisma.order.create({
              data: { orgId, branchId: branch.r2idx2, userId: cashier.id, orderNumber: n, serviceType: 'TAKEAWAY', status: 'CLOSED' },
            });
            out.push(`${digits}:ok`);
          } catch (e) {
            const m = (e as Error).message;
            const which = /order_number_numeric_idx/.test(m) ? 'numeric idx' : /branch_id_order_number_key|orders_branch_id_order_number/.test(m) ? 'unique idx' : 'other';
            out.push(`${digits}:FAIL(${which}) ${m.split('\n').filter(Boolean).pop()?.slice(0, 160)}`);
          }
        }
        // eslint-disable-next-line no-console
        console.log(`R2-3 long numbers: ${out.join(' | ')}`);
      });

      it('note: NUMERIC has a ceiling of 131,072 digits before the point (documents)', async () => {
        // A compressible number (repeated digits) passes the text unique index, so here the new
        // NUMERIC index is the first thing to refuse. Without the index the same insert succeeds
        // (control run by hand in psql, in a rolled-back transaction: see the review).
        const tryInsert = async (key: string, digits: number) => {
          try {
            await insertOrder(key, `ORD-${'9'.repeat(digits)}`);
            return 'ok';
          } catch (e) {
            return `FAIL ${/22003|overflows numeric/.test((e as Error).message) ? '22003 numeric overflow' : (e as Error).message.split('\n').pop()?.slice(0, 120)}`;
          }
        };
        await makeBranch(orgId, 'r2cap');
        const role = await prisma.membership.findFirstOrThrow({
          where: { userId: cashier.id, branchId: branch.a },
          select: { roleId: true },
        });
        await prisma.membership.create({
          data: { userId: cashier.id, organizationId: orgId, branchId: branch.r2cap, roleId: role.roleId },
        });
        const at = await tryInsert('r2cap', 131072);
        const over = await tryInsert('r2cap', 131073);
        // The branch now holds ORD- + 131,072 nines: the allocator's next number has 131,073 digits.
        const r = await post(cashier.token, 'r2cap', sale(cid('r2-cap-sale')));
        // eslint-disable-next-line no-console
        console.log(
          `R2-3 NUMERIC ceiling: insert 131072 nines ${at}; insert 131073 nines ${over}; next quick sale in that branch HTTP ${r.status}`,
        );
      });

      it('a restaurant-flow order (POST /api/pos/orders) is created with the index present', async () => {
        const r = await request(baseUrl)
          .post('/api/pos/orders')
          .set('Authorization', `Bearer ${manager.token}`)
          .set('X-Branch-Id', branch.a)
          .send({ serviceType: 'TAKEAWAY' });
        // eslint-disable-next-line no-console
        console.log(`R2-3 restaurant create: HTTP ${r.status} ${r.body?.orderNumber ?? JSON.stringify(r.body).slice(0, 200)}`);
        expect(r.status).toBe(201);
        expect(r.body.orderNumber).toMatch(/^ORD-\d+$/);
      });
    });

    // ── 6. Till codes ──

    describe('6. till codes', () => {
      it('"drk-03" and "DRK-03 " are stored as DRK-03 and reach the till opened as DRK-03', async () => {
        const t = await openTill('r2tills', 'DRK-03', 10000);
        for (const v of ['drk-03', 'DRK-03 ']) {
          const r = await post(
            cashier.token,
            'r2tills',
            sale(cid(`r2-tc-${v.trim()}-${v.length}`), { tillCode: v, payment: { method: 'CASH' } }),
          );
          expect(r.status).toBe(200);
          expect(r.body.order.tillCode ?? (await prisma.order.findUniqueOrThrow({ where: { id: r.body.order.id } })).tillCode).toBe('DRK-03');
        }
        expect(await expectedCash('r2tills', t.id, 10000)).toBe(10000 + 2 * 8000);
        await prisma.tillSession.update({ where: { id: t.id }, data: { status: 'CLOSED', closedAt: new Date() } });
      });

      it('S-1: with DRK-03 open, opening "drk-03" is refused, or the same cash is not counted by both', async () => {
        await prisma.shift.create({
          data: { orgId, branchId: branch.r2tills, shiftNumber: `H1R2-dup-${RUN}`, openedById: cashier.id },
        });
        const meta = { ipAddress: '127.0.0.1', userAgent: 'h1r2' };
        const up = await tills.openTill(cashier.id, ctxOf('r2tills'), { tillCode: 'DRK-03', openingFloat: 0 }, meta);
        let lowerId: string | null = null;
        let lowerErr = '';
        try {
          const low = await tills.openTill(cashier.id, ctxOf('r2tills'), { tillCode: 'drk-03', openingFloat: 0 }, meta);
          lowerId = low.id;
        } catch (e) {
          lowerErr = (e as Error).message;
        }
        const r = await post(
          cashier.token,
          'r2tills',
          sale(cid('r2-tc-dup'), { payment: { method: 'CASH' } }),
        );
        expect(r.status).toBe(200);
        const upCash = await expectedCash('r2tills', up.id, 0);
        const lowCash = lowerId ? await expectedCash('r2tills', lowerId, 0) : null;
        // eslint-disable-next-line no-console
        console.log(
          `R2-6 second open as "drk-03": ${lowerId ? 'OPENED' : `refused (${lowerErr})`}; expected cash DRK-03 ${upCash}, drk-03 ${lowCash}`,
        );
        // One 8,000 cash sale: across every open session it must be expected exactly once.
        expect(upCash + (lowCash ?? 0)).toBe(8000);
      });
    });

    // ── 7. Card number in a text field ──

    describe('7. card number in a text field', () => {
      // 4111 1111 1111 1111: the public Visa test number (Luhn-valid), not a real card.
      const luhnTestDigits = ['4111', '1111', '1111', '1111'].join('');

      const captureLogs = async <T>(fn: () => Promise<T>) => {
        const lines: string[] = [];
        const spies = [
          ...(['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const)
            .filter((m) => typeof (Logger.prototype as unknown as Record<string, unknown>)[m] === 'function')
            .map((m) =>
              jest.spyOn(Logger.prototype, m as 'log').mockImplementation((...a: unknown[]) => {
                lines.push(JSON.stringify(a));
              }),
            ),
          ...(['log', 'warn', 'error', 'info', 'debug'] as const).map((m) =>
            jest.spyOn(console, m).mockImplementation((...a: unknown[]) => {
              lines.push(JSON.stringify(a));
            }),
          ),
        ];
        try {
          return { result: await fn(), lines };
        } finally {
          spies.forEach((s) => s.mockRestore());
        }
      };

      for (const field of ['authCode', 'terminalId']) {
        it(`a 16-digit number in ${field}: 400, not stored, not in the response body, not in the log`, async () => {
          const id = cid(`r2-pan-${field}`);
          const { result: r, lines } = await captureLogs(() =>
            post(cashier.token, 'a', sale(id, { payment: { ...visa, [field]: luhnTestDigits } })),
          );
          expect(r.status).toBe(400);
          expect(await ordersFor(id)).toBe(0);
          expect(
            await prisma.payment.count({
              where: { OR: [{ authCode: luhnTestDigits }, { terminalId: luhnTestDigits }] },
            }),
          ).toBe(0);
          expect(JSON.stringify(r.body)).not.toContain(luhnTestDigits);
          expect(lines.join('\n')).not.toContain(luhnTestDigits);
        });
      }

      const slip: [string, Record<string, unknown>][] = [
        ['externalTransactionId on a card sale', { payment: { ...visa, externalTransactionId: 'MP123456' } }],
        ['payerPhone on a card sale', { payment: { ...visa, payerPhone: '+256700000123' } }],
        ['externalTransactionId on a cash sale', { payment: { method: 'CASH', externalTransactionId: 'MP123456' } }],
        ['payerPhone on a cash sale', { payment: { method: 'CASH', payerPhone: '+256700000123' } }],
      ];
      for (const [label, over] of slip) {
        it(`${label} is a 400 and writes nothing`, async () => {
          const id = cid(`r2-slip-${label.replace(/ /g, '-')}`);
          const r = await post(cashier.token, 'a', sale(id, over));
          expect(r.status).toBe(400);
          expect(await ordersFor(id)).toBe(0);
        });
      }

      it('S-2: a Luhn-valid 16-digit number in externalTransactionId on a mobile-money sale is refused, not stored', async () => {
        const id = cid('r2-pan-momo-ext');
        const r = await post(
          cashier.token,
          'a',
          sale(id, {
            payment: { method: 'MOMO', momoNetwork: 'MTN', externalTransactionId: luhnTestDigits },
          }),
        );
        const stored = await prisma.payment.count({
          where: { externalTransactionId: luhnTestDigits, order: { clientSaleId: id } },
        });
        // eslint-disable-next-line no-console
        console.log(
          `R2-7 Luhn test digits as MoMo externalTransactionId: HTTP ${r.status}; stored rows ${stored}; echoed ${JSON.stringify(r.body).includes(luhnTestDigits)}`,
        );
        expect(r.status).toBe(400);
        expect(stored).toBe(0);
      });
    });

    // ── 8. Audit failure log ──

    describe('8. audit failure log', () => {
      it('the line carries orderId, clientSaleId, branchId and tillCode, and no card data', async () => {
        const id = cid('r2audit');
        await prisma.$executeRawUnsafe(`
          CREATE OR REPLACE FUNCTION h1r_audit_fail() RETURNS trigger AS $$
          BEGIN
            IF NEW.action = 'ORDER_QUICK_SALE' AND NEW.metadata->>'clientSaleId' = '${id}' THEN
              RAISE EXCEPTION 'h1r2 probe: audit insert refused';
            END IF;
            RETURN NEW;
          END $$ LANGUAGE plpgsql`);
        await prisma.$executeRawUnsafe(
          'CREATE TRIGGER h1r_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION h1r_audit_fail()',
        );
        const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        let r!: request.Response;
        let calls = '';
        try {
          r = await post(
            cashier.token,
            'a',
            sale(id, { tillCode: 'drk-03', payment: { ...visa, terminalId: 'TRM-77' } }),
          );
          calls = JSON.stringify(spy.mock.calls);
        } finally {
          spy.mockRestore();
          await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS h1r_audit_fail ON audit_logs');
        }
        // eslint-disable-next-line no-console
        console.log(`R2-8 audit failure log: ${calls}`);
        expect(r.status).toBe(200);
        expect(await prisma.auditLog.count({ where: { entityId: r.body.order.id } })).toBe(0);
        const line = calls;
        expect(line).toContain('ORDER_QUICK_SALE audit write failed');
        expect(line).toContain(r.body.order.id);
        expect(line).toContain(id);
        expect(line).toContain(branch.a);
        expect(line).toContain('DRK-03');
        for (const cardBit of ['4242', 'A1B2C3', 'TRM-77']) expect(line).not.toContain(cardBit);
      });
    });
  });
});
