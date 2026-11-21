import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';
import { TillsService } from '../src/modules/tills/tills.service';
import { assertDisposableEventDb } from './support/event-db-guard';
import {
  BranchKey,
  FixtureItem,
  NIGHT_BRANCHES,
  buildEventNight,
  expectedNight,
} from './fixtures/event-night';

// Must run before anything connects: refuse anything but a local nimbus_event_* database.
assertDisposableEventDb();

/**
 * H1 quick sale: real HTTP, real Postgres (disposable). Users, branches and items are
 * created here through Prisma with passwords generated at run time; no demo login is used.
 */
describe('POST /api/pos/quick-sale (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tills: TillsService;
  let orgId: string;
  const branch: Record<string, string> = {};
  let cashierToken: string;
  let bartenderToken: string;

  // Branch A sells drinks only. FOOD-ONLY exists in branch B alone (the other-branch SKU case).
  const BASE_ITEMS: FixtureItem[] = [...NIGHT_BRANCHES.drinks.items];

  async function makeBranch(key: string, name: string, items: FixtureItem[]) {
    const b = await prisma.branch.create({
      data: {
        organizationId: orgId,
        name,
        code: key.toUpperCase(),
        slug: `${key}-${orgId.slice(-6)}`,
        timezone: 'Africa/Kampala',
        currencyCode: 'UGX',
      },
    });
    branch[key] = b.id;
    const cat = await prisma.category.create({ data: { orgId, branchId: b.id, name: 'Menu' } });
    for (const it of items) {
      await prisma.menuItem.create({
        data: {
          orgId,
          branchId: b.id,
          categoryId: cat.id,
          name: it.name,
          sku: it.sku,
          brand: it.brand,
          price: it.price,
          itemType: it.type,
        },
      });
    }
    return { branch: b, categoryId: cat.id };
  }

  async function makeUser(label: string, roleName: string, branchKeys: string[]) {
    const password = randomBytes(18).toString('hex');
    const email = `${label}.${orgId.slice(-8)}@event-h1.invalid`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 4),
        firstName: label,
        lastName: 'H1',
      },
    });
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
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

  const post = (token: string, branchKey: string, body: unknown) =>
    request(app.getHttpServer())
      .post('/api/pos/quick-sale')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Branch-Id', branch[branchKey])
      .send(body as object);

  const metaOf = (row: { metadata: unknown }) => row.metadata as Record<string, unknown>;

  const orderCount = (branchKey?: string) =>
    prisma.order.count({ where: { orgId, ...(branchKey ? { branchId: branch[branchKey] } : {}) } });

  const beers = (
    clientSaleId: string,
    payment: object,
    tillCode = 'DRK-03',
    sku = 'BEER-NILE',
    quantity = 2,
  ) => ({
    clientSaleId,
    tillCode,
    lines: [{ sku, quantity }],
    payment,
  });
  const visa = {
    method: 'CARD',
    cardScheme: 'VISA',
    cardLast4: '4242',
    authCode: '123456',
    terminalId: 'TRM-DRK-03',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
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
    console.log(`e2e database: ${dbRow[0].db} port ${dbRow[0].port}`);

    const org = await prisma.organization.create({
      data: { name: 'H1 QA', slug: `h1-qa-${randomBytes(4).toString('hex')}` },
    });
    orgId = org.id;

    const a = await makeBranch('a', 'QA Drinks A', BASE_ITEMS);
    await prisma.menuItem.create({
      data: {
        orgId,
        branchId: a.branch.id,
        categoryId: a.categoryId,
        name: 'Retired',
        sku: 'OLD-INACTIVE',
        price: 1000,
        itemType: 'DRINK',
        isActive: false,
      },
    });
    for (const name of ['Dup one', 'Dup two']) {
      await prisma.menuItem.create({
        data: {
          orgId,
          branchId: a.branch.id,
          categoryId: a.categoryId,
          name,
          sku: 'DUP-SKU',
          price: 1000,
          itemType: 'DRINK',
        },
      });
    }
    await makeBranch('b', 'QA Food B', [
      { sku: 'FOOD-ONLY', name: 'Food only item', brand: 'House', price: 5000, type: 'FOOD' },
      ...NIGHT_BRANCHES.drinks.items,
    ]);
    await makeBranch('c', 'QA Tills C', NIGHT_BRANCHES.drinks.items);
    await makeBranch('n1', NIGHT_BRANCHES.drinks.name, NIGHT_BRANCHES.drinks.items);
    await makeBranch('n2', NIGHT_BRANCHES.food.name, NIGHT_BRANCHES.food.items);

    cashierToken = (await makeUser('cashier', 'Cashier', ['a', 'b', 'c', 'n1', 'n2'])).token;
    bartenderToken = (await makeUser('bartender', 'Bartender', ['a'])).token;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS nimbus_event_h1_poison ON payments');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS nimbus_event_h1_poison()');
    await app?.close();
  });

  describe('the real case: two beers by Visa at DRK-03, posted twice', () => {
    const id = 'real-case-visa-0001';
    const body = { ...beers(id, visa), soldAt: '2026-11-21T21:14:00+03:00' };

    it('creates one CLOSED TAKEAWAY order and one COMPLETED VISA payment; the second post is a replay', async () => {
      const before = await orderCount('a');
      const r1 = await post(cashierToken, 'a', body);
      expect(r1.status).toBe(200);
      expect(r1.body.replayed).toBe(false);
      expect(r1.body.order.status).toBe('CLOSED');
      expect(Number(r1.body.order.total)).toBe(8000);
      expect(r1.body.order.orderNumber).toMatch(/^ORD-\d{6}$/);

      const r2 = await post(cashierToken, 'a', body);
      expect(r2.status).toBe(200);
      expect(r2.body.replayed).toBe(true);
      expect(r2.body.order.id).toBe(r1.body.order.id);

      expect(await orderCount('a')).toBe(before + 1);
      const order = await prisma.order.findFirstOrThrow({
        where: { orgId, clientSaleId: id },
        include: { payments: true, items: true },
      });
      expect(order.status).toBe('CLOSED');
      expect(order.serviceType).toBe('TAKEAWAY');
      expect(order.tillCode).toBe('DRK-03');
      expect(Number(order.total)).toBe(8000);
      expect(Number(order.tax)).toBe(0);
      expect(metaOf(order).source).toBe('QUICK_SALE');
      expect(order.items).toHaveLength(1);
      expect(order.payments).toHaveLength(1);
      const p = order.payments[0];
      expect([p.status, p.method, p.cardScheme, p.tillCode]).toEqual([
        'COMPLETED',
        'CARD',
        'VISA',
        'DRK-03',
      ]);
      expect(p.cardLast4).toBe('4242');
      expect(Number(p.amount)).toBe(8000);
    });

    it('two posts sent at the same moment still make one order', async () => {
      const cid = 'real-case-visa-0002';
      const before = await orderCount('a');
      const [x, y] = await Promise.all([
        post(cashierToken, 'a', beers(cid, visa)),
        post(cashierToken, 'a', beers(cid, visa)),
      ]);
      expect([x.status, y.status]).toEqual([200, 200]);
      expect([x.body.replayed, y.body.replayed].sort()).toEqual([false, true]);
      expect(x.body.order.id).toBe(y.body.order.id);
      expect(await orderCount('a')).toBe(before + 1);
    });

    it('writes an ORDER_QUICK_SALE audit entry carrying branchId', async () => {
      const order = await prisma.order.findFirstOrThrow({ where: { orgId, clientSaleId: id } });
      const rows = await prisma.auditLog.findMany({
        where: { action: 'ORDER_QUICK_SALE', entityId: order.id },
      });
      expect(rows).toHaveLength(1);
      expect(metaOf(rows[0]).branchId).toBe(branch.a);
    });
  });

  it('the same clientSaleId from another branch is a 409 and writes nothing', async () => {
    const before = await orderCount();
    const res = await post(cashierToken, 'b', {
      clientSaleId: 'real-case-visa-0001',
      tillCode: 'FOOD-01',
      lines: [{ sku: 'FOOD-ONLY', quantity: 1 }],
      payment: { method: 'CASH' },
    });
    expect(res.status).toBe(409);
    expect(await orderCount()).toBe(before);
  });

  it('twenty concurrent sales in one branch get twenty distinct order numbers, three runs in a row', async () => {
    const seen = new Set<string>();
    for (let run = 1; run <= 3; run++) {
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          post(
            cashierToken,
            'a',
            beers(
              `conc-${run}-${String(i).padStart(2, '0')}-xxxx`,
              { method: 'CASH' },
              'DRK-04',
              'SODA-COLA',
              1,
            ),
          ),
        ),
      );
      expect(results.filter((r) => r.status >= 500)).toHaveLength(0);
      expect(results.map((r) => r.status)).toEqual(Array(20).fill(200));
      const numbers = results.map((r) => r.body.order.orderNumber as string);
      expect(new Set(numbers).size).toBe(20);
      numbers.forEach((n) => {
        expect(seen.has(n)).toBe(false);
        seen.add(n);
      });
    }
    expect(seen.size).toBe(60);
  });

  describe('bad requests are 400 and the order count does not change', () => {
    const cases: [string, (n: string) => unknown][] = [
      ['CARD without cardScheme', (n) => beers(n, { method: 'CARD', cardLast4: '4242' })],
      ['MOMO without momoNetwork', (n) => beers(n, { method: 'MOMO' })],
      ['cash tendered below the total', (n) => beers(n, { method: 'CASH', tenderedAmount: 7999 })],
      [
        'two payments (payments array)',
        (n) => ({
          ...beers(n, { method: 'CASH' }),
          payments: [{ method: 'CASH' }, { method: 'CASH' }],
        }),
      ],
      [
        'two payments (payment as an array)',
        (n) => beers(n, [{ method: 'CASH' }, { method: 'CASH' }]),
      ],
      ['an inactive SKU', (n) => beers(n, { method: 'CASH' }, 'DRK-03', 'OLD-INACTIVE', 1)],
      ["another branch's SKU", (n) => beers(n, { method: 'CASH' }, 'DRK-03', 'FOOD-ONLY', 1)],
      [
        'a SKU that matches two active items',
        (n) => beers(n, { method: 'CASH' }, 'DRK-03', 'DUP-SKU', 1),
      ],
      ['card fields on a cash sale', (n) => beers(n, { method: 'CASH', cardScheme: 'VISA' })],
      ['a malformed cardLast4', (n) => beers(n, { ...visa, cardLast4: '42' })],
      [
        'a soldAt with no UTC offset',
        (n) => ({ ...beers(n, { method: 'CASH' }), soldAt: '2026-11-21T21:14:00' }),
      ],
      ['a clientSaleId that is too short', () => beers('short', { method: 'CASH' })],
      ['an unknown field', (n) => ({ ...beers(n, { method: 'CASH' }), cardNotes: 'x' })],
      ['an empty lines array', (n) => ({ ...beers(n, { method: 'CASH' }), lines: [] })],
    ];
    it.each(cases)('%s', async (_label, make) => {
      const before = await orderCount();
      const res = await post(cashierToken, 'a', make(`bad-${randomBytes(6).toString('hex')}`));
      expect(res.status).toBe(400);
      expect(await orderCount()).toBe(before);
    });
  });

  describe('roles', () => {
    it('a Bartender gets 403 and writes nothing; a Cashier gets 200', async () => {
      const before = await orderCount();
      const denied = await post(
        bartenderToken,
        'a',
        beers('role-bartender-01', { method: 'CASH' }),
      );
      expect(denied.status).toBe(403);
      expect(await orderCount()).toBe(before);
      const ok = await post(cashierToken, 'a', beers('role-cashier-0001', { method: 'CASH' }));
      expect(ok.status).toBe(200);
    });
  });

  describe('guards', () => {
    const body = () => beers(`guard-${randomBytes(6).toString('hex')}`, { method: 'CASH' });

    it('no token is a 401 and writes nothing', async () => {
      const before = await orderCount();
      const res = await request(app.getHttpServer())
        .post('/api/pos/quick-sale')
        .set('X-Branch-Id', branch.a)
        .send(body());
      expect(res.status).toBe(401);
      expect(await orderCount()).toBe(before);
    });

    it('a Cashier posting to a branch they have no membership in is refused and writes nothing', async () => {
      const before = await orderCount();
      const stranger = await prisma.branch.create({
        data: {
          organizationId: orgId,
          name: 'No membership',
          code: 'NOMEM',
          slug: `nomem-${orgId.slice(-6)}`,
        },
      });
      const res = await request(app.getHttpServer())
        .post('/api/pos/quick-sale')
        .set('Authorization', `Bearer ${cashierToken}`)
        .set('X-Branch-Id', stranger.id)
        .send(body());
      expect([401, 403]).toContain(res.status);
      expect(await orderCount()).toBe(before);
    });

    it("another branch's item by menuItemId is a 400 and writes nothing", async () => {
      const before = await orderCount();
      const foreign = await prisma.menuItem.findFirstOrThrow({
        where: { orgId, branchId: branch.b, sku: 'FOOD-ONLY' },
      });
      const res = await post(cashierToken, 'a', {
        clientSaleId: `guard-${randomBytes(6).toString('hex')}`,
        tillCode: 'DRK-03',
        lines: [{ menuItemId: foreign.id, quantity: 1 }],
        payment: { method: 'CASH' },
      });
      expect(res.status).toBe(400);
      expect(await orderCount()).toBe(before);
    });

    it('soldAt defaults to now when the tablet sends none', async () => {
      const res = await post(cashierToken, 'a', body());
      expect(res.status).toBe(200);
      const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } });
      const soldAt = Date.parse(String(metaOf(order).soldAt));
      expect(Math.abs(soldAt - Date.now())).toBeLessThan(60_000);
    });
  });

  describe('tender handling', () => {
    it('cash is NOT_REQUIRED and changeDue is tendered minus total', async () => {
      const res = await post(
        cashierToken,
        'a',
        beers('cash-change-0001', { method: 'CASH', tenderedAmount: 10000 }),
      );
      expect(res.status).toBe(200);
      expect(Number(res.body.changeDue)).toBe(2000);
      const p = await prisma.payment.findFirstOrThrow({ where: { orderId: res.body.order.id } });
      expect([p.method, p.verificationStatus, p.captureMode, p.status]).toEqual([
        'CASH',
        'NOT_REQUIRED',
        'ONLINE_PROVIDER',
        'COMPLETED',
      ]);
      expect(Number(p.amount)).toBe(8000);
      const o = await prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } });
      expect(metaOf(o).changeDue).toBe('2000');
      expect(metaOf(o).tendered).toBe('10000');
    });

    it('card and mobile money are UNVERIFIED manual references', async () => {
      const c = await post(cashierToken, 'a', beers('tender-card-0001', visa));
      const m = await post(
        cashierToken,
        'a',
        beers('tender-momo-0001', {
          method: 'MOMO',
          momoNetwork: 'AIRTEL',
          payerPhone: '+256700000001',
        }),
      );
      for (const [r, method] of [
        [c, 'CARD'],
        [m, 'MOMO'],
      ] as const) {
        expect(r.status).toBe(200);
        const p = await prisma.payment.findFirstOrThrow({ where: { orderId: r.body.order.id } });
        expect([p.method, p.verificationStatus, p.captureMode]).toEqual([
          method,
          'UNVERIFIED',
          'MANUAL_REFERENCE',
        ]);
      }
    });
  });

  describe('till cash (EV-20)', () => {
    it("each till's expected cash is its own float plus its own cash sales; a null-till cash payment still counts", async () => {
      const ctx = { branchId: branch.c, organizationId: orgId };
      const opener = await prisma.user.findFirstOrThrow({
        where: { email: { startsWith: 'cashier.' } },
      });
      const shift = await prisma.shift.create({
        data: { orgId, branchId: branch.c, shiftNumber: 'H1-SHIFT-1', openedById: opener.id },
      });
      const mk = (tillCode: string, openingFloat: number) =>
        prisma.tillSession.create({
          data: {
            orgId,
            branchId: branch.c,
            shiftId: shift.id,
            tillCode,
            operatorUserId: opener.id,
            openedById: opener.id,
            openingFloat,
            openedAt: new Date(Date.now() - 60_000),
          },
        });
      const t1 = await mk('DRK-01', 20000);
      const t2 = await mk('DRK-02', 5000);

      expect(
        (
          await post(
            cashierToken,
            'c',
            beers('till-cash-0001', { method: 'CASH' }, 'DRK-01', 'WHISKY-JW', 3),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await post(
            cashierToken,
            'c',
            beers('till-cash-0002', { method: 'CASH' }, 'DRK-02', 'WHISKY-JW', 5),
          )
        ).status,
      ).toBe(200);

      const e1 = await tills.computeExpectedCash(t1.id, t1.openingFloat, ctx);
      const e2 = await tills.computeExpectedCash(t2.id, t2.openingFloat, ctx);
      expect(Number(e1)).toBe(20000 + 30000);
      expect(Number(e2)).toBe(5000 + 50000);

      const legacy = await prisma.order.create({
        data: {
          orgId,
          branchId: branch.c,
          userId: opener.id,
          orderNumber: 'ORD-LEGACY1',
          status: 'CLOSED',
          serviceType: 'DINE_IN',
          subtotal: 7000,
          total: 7000,
        },
      });
      await prisma.payment.create({
        data: {
          orgId,
          branchId: branch.c,
          orderId: legacy.id,
          amount: 7000,
          method: 'CASH',
          status: 'COMPLETED',
        },
      });
      expect(Number(await tills.computeExpectedCash(t1.id, t1.openingFloat, ctx))).toBe(
        20000 + 30000 + 7000,
      );
      expect(Number(await tills.computeExpectedCash(t2.id, t2.openingFloat, ctx))).toBe(
        5000 + 50000 + 7000,
      );
    });
  });

  describe('atomicity', () => {
    it('a payment that fails inside the transaction leaves no order row', async () => {
      await prisma.$executeRawUnsafe(
        `CREATE OR REPLACE FUNCTION nimbus_event_h1_poison() RETURNS trigger AS $$ BEGIN IF NEW.terminal_id = 'POISON' THEN RAISE EXCEPTION 'poisoned payment'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`,
      );
      await prisma.$executeRawUnsafe(
        'CREATE TRIGGER nimbus_event_h1_poison BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION nimbus_event_h1_poison()',
      );
      const before = await orderCount();
      const paymentsBefore = await prisma.payment.count({ where: { orgId } });
      const res = await post(
        cashierToken,
        'a',
        beers('poison-sale-0001', { ...visa, terminalId: 'POISON' }),
      );
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(await orderCount()).toBe(before);
      expect(await prisma.payment.count({ where: { orgId } })).toBe(paymentsBefore);
      expect(await prisma.order.count({ where: { orgId, clientSaleId: 'poison-sale-0001' } })).toBe(
        0,
      );
      await prisma.$executeRawUnsafe('DROP TRIGGER nimbus_event_h1_poison ON payments');
    });
  });

  describe('fixture night: about 200 sales, two branches, four tills, reconciled to the shilling', () => {
    const sales = buildEventNight(200);
    const exp = expectedNight(sales);
    const key = (b: BranchKey) => (b === 'drinks' ? 'n1' : 'n2');
    const responseTotals: number[] = [];

    beforeAll(async () => {
      const opener = await prisma.user.findFirstOrThrow({
        where: { email: { startsWith: 'cashier.' } },
      });
      for (const b of ['drinks', 'food'] as BranchKey[]) {
        const shift = await prisma.shift.create({
          data: {
            orgId,
            branchId: branch[key(b)],
            shiftNumber: `H1-NIGHT-${b}`,
            openedById: opener.id,
          },
        });
        for (const till of NIGHT_BRANCHES[b].tills) {
          await prisma.tillSession.create({
            data: {
              orgId,
              branchId: branch[key(b)],
              shiftId: shift.id,
              tillCode: till,
              operatorUserId: opener.id,
              openedById: opener.id,
              openingFloat: 10000,
              openedAt: new Date(Date.now() - 60_000),
            },
          });
        }
      }
      for (let i = 0; i < sales.length; i += 10) {
        const batch = sales.slice(i, i + 10);
        const res = await Promise.all(
          batch.map((s) =>
            post(cashierToken, key(s.branch), {
              clientSaleId: s.clientSaleId,
              tillCode: s.tillCode,
              lines: s.lines,
              payment: s.payment,
            }),
          ),
        );
        res.forEach((r, j) => {
          expect(r.status).toBe(200);
          expect(Number(r.body.changeDue)).toBe(batch[j].changeDue);
          responseTotals.push(Number(r.body.order.total));
        });
      }
    }, 300000);

    const nightWhere = () => ({ orgId, branchId: { in: [branch.n1, branch.n2] } });

    it('order totals = payment amounts = the fixture total', async () => {
      const o = await prisma.order.aggregate({
        where: nightWhere(),
        _sum: { total: true },
        _count: true,
      });
      const p = await prisma.payment.aggregate({
        where: { ...nightWhere(), status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      });
      expect(o._count).toBe(exp.count);
      expect(p._count).toBe(exp.count);
      expect(Number(o._sum.total)).toBe(exp.grandTotal);
      expect(Number(p._sum.amount)).toBe(exp.grandTotal);
      expect(responseTotals.reduce((a, b) => a + b, 0)).toBe(exp.grandTotal);
    });

    it('matches per tender, per card scheme, per mobile-money network and per branch', async () => {
      const sum = async (extra: object) =>
        Number(
          (
            await prisma.payment.aggregate({
              where: { ...nightWhere(), ...extra },
              _sum: { amount: true },
            })
          )._sum.amount ?? 0,
        );
      for (const t of ['CASH', 'CARD', 'MOMO'] as const)
        expect(await sum({ method: t })).toBe(exp.byTender[t].total);
      for (const s of ['VISA', 'MASTERCARD', 'OTHER'] as const)
        expect(await sum({ cardScheme: s })).toBe(exp.byCardScheme[s].total);
      for (const n of ['MTN', 'AIRTEL'] as const)
        expect(await sum({ momoNetwork: n })).toBe(exp.byMomoNetwork[n].total);
      expect(await sum({ branchId: branch.n1 })).toBe(exp.byBranch.drinks.total);
      expect(await sum({ branchId: branch.n2 })).toBe(exp.byBranch.food.total);
    });

    it("each till's cash equals the cash term of that till's summary, and its expected cash is float + cash", async () => {
      for (const b of ['drinks', 'food'] as BranchKey[]) {
        for (const till of NIGHT_BRANCHES[b].tills) {
          const t = exp.tills[till];
          const cash = Number(
            (
              await prisma.payment.aggregate({
                where: { orgId, branchId: branch[key(b)], tillCode: till, method: 'CASH' },
                _sum: { amount: true },
              })
            )._sum.amount ?? 0,
          );
          expect(cash).toBe(t?.cash ?? 0);
          const session = await prisma.tillSession.findFirstOrThrow({
            where: { orgId, branchId: branch[key(b)], tillCode: till },
          });
          const expected = await tills.computeExpectedCash(session.id, session.openingFloat, {
            branchId: branch[key(b)],
            organizationId: orgId,
          });
          expect(Number(expected)).toBe(10000 + (t?.cash ?? 0));
        }
      }
    });
  });
});
