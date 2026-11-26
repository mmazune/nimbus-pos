import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';
import { assertDisposableEventDb } from './support/event-db-guard';

// R-E1 review probes (track T4). Each test states the CORRECT behaviour, so a red test is a
// fault that is present. They are kept whether they pass or fail; see
// docs/reviews/e1-order-truth.md for the finding each one belongs to.
//
// Races are made deterministic, not left to timing: a probe transaction holds the row lock of
// the reservation linked to the order, so a payment that reaches the close door claims the
// order (status CLOSED, uncommitted, order row locked) and then waits. The second request is
// fired into that window, and the lock is released once the second request is either waiting
// on a lock itself or has answered.
assertDisposableEventDb();

jest.setTimeout(120_000);

describe('R-E1 probes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: string, supervisor: string, waiter: string, cashier: string;
  let branchId: string, otherBranchId: string, orgId: string, categoryId: string;
  const run = Date.now().toString(36);
  let seq = 0;

  const http = () => request(app.getHttpServer());
  const as = (token: string, branch = branchId) => ({
    Authorization: `Bearer ${token}`,
    'X-Branch-Id': branch,
  });

  async function login(email: string, password: string) {
    const r = await http().post('/api/auth/login').send({ email, password });
    expect(r.status).toBe(201);
    return r.body.accessToken as string;
  }

  async function menuItem(price: number, station: 'KITCHEN' | 'BAR' = 'KITCHEN') {
    return prisma.menuItem.create({
      data: {
        orgId,
        branchId,
        categoryId,
        name: `RE1 probe ${run} ${++seq}`,
        price,
        itemType: station === 'BAR' ? 'DRINK' : 'FOOD',
        station,
      },
    });
  }

  async function newTable() {
    return prisma.table.create({
      data: { orgId, branchId, label: `RE1-${run}-${++seq}`, capacity: 4 },
    });
  }

  async function addLine(orderId: string, menuItemId: string, quantity = 1, token = owner) {
    const r = await http()
      .post(`/api/pos/orders/${orderId}/items`)
      .set(as(token))
      .send({ menuItemId, quantity });
    expect(r.status).toBe(201);
    return r.body.id as string;
  }
  const send = (orderId: string) =>
    http().post(`/api/pos/orders/${orderId}/send`).set(as(owner)).send({});
  const pay = (orderId: string, payments: any[], token = owner) =>
    http().post(`/api/pos/orders/${orderId}/close`).set(as(token)).send({ payments });
  const voidLine = (token: string, orderId: string, itemId: string, body: any, branch = branchId) =>
    http().post(`/api/orders/${orderId}/items/${itemId}/void`).set(as(token, branch)).send(body);
  const manualRef = (orderId: string, method: string, amount: number) =>
    http()
      .post('/api/payments/manual-reference')
      .set(as(owner))
      .send({ orderId, method, amount, externalTransactionId: `RE1-${run}-${++seq}` });

  /** A dine-in order on its own table, with a confirmed reservation seated on it. */
  async function seatedOrder(lines: { price: number; qty?: number }[], doSend = true) {
    const table = await newTable();
    const created = await http()
      .post('/api/reservations')
      .set(as(owner))
      .send({
        customerName: `Probe party ${++seq}`,
        partySize: 2,
        reservationAt: new Date(Date.now() + 3600_000).toISOString(),
        source: 'PHONE',
      });
    expect(created.status).toBe(201);
    const reservationId = created.body.id as string;
    await http().patch(`/api/reservations/${reservationId}/confirm`).set(as(owner)).send({});
    const seated = await http()
      .patch(`/api/reservations/${reservationId}/seat`)
      .set(as(owner))
      .send({ tableId: table.id, createOrder: true });
    expect(seated.status).toBe(200);
    const orderId = seated.body.seatedOrderId as string;
    const itemIds: string[] = [];
    for (const l of lines) {
      const mi = await menuItem(l.price);
      itemIds.push(await addLine(orderId, mi.id, l.qty ?? 1));
    }
    if (doSend) expect((await send(orderId)).status).toBe(200);
    return { orderId, tableId: table.id, reservationId, itemIds };
  }

  /** A plain dine-in order on an existing table (no reservation). */
  async function plainOrder(tableId: string, price: number) {
    const o = await http()
      .post('/api/pos/orders')
      .set(as(owner))
      .send({ serviceType: 'DINE_IN', tableId });
    expect(o.status).toBe(201);
    const mi = await menuItem(price);
    const itemId = await addLine(o.body.id, mi.id);
    expect((await send(o.body.id)).status).toBe(200);
    return { orderId: o.body.id as string, itemId };
  }

  /** Holds the reservation row lock until release() is called. */
  async function holdReservationLock(reservationId: string) {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let locked!: () => void;
    const isLocked = new Promise<void>((r) => (locked = r));
    const done = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "reservations" WHERE "id" = ${reservationId} FOR UPDATE`;
        locked();
        await gate;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    await isLocked;
    return { release, done };
  }

  /** Waits until some other session is blocked on a lock while running a query matching `like`. */
  async function waitForLockWait(like: string, timeoutMs = 15_000) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const rows = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*)::bigint AS n FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE ${like}`;
      if (Number(rows[0].n) > 0) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }

  /** Fires `req`, then waits until it is either blocked on a lock (matching `like`) or answered. */
  async function fireInto(req: Promise<request.Response>, like: string) {
    let answered = false;
    const p = req.then((r) => {
      answered = true;
      return r;
    });
    const until = Date.now() + 15_000;
    while (!answered && Date.now() < until) {
      if (await waitForLockWait(like, 200)) break;
    }
    return p;
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    owner = await login('owner@demo.local', 'Owner#123');
    supervisor = await login('supervisor@demo.local', 'Supervisor#123');
    waiter = await login('waiter@demo.local', 'Waiter#123');
    cashier = await login('cashier@demo.local', 'Cashier#123');
    const main = await prisma.branch.findFirstOrThrow({ where: { name: 'Main Branch' } });
    branchId = main.id;
    orgId = main.organizationId;
    const other = await prisma.branch.findFirstOrThrow({
      where: { organizationId: orgId, id: { not: branchId } },
    });
    otherBranchId = other.id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { branchId } })).id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  // ── Concurrency ──────────────────────────────────────────────────────────────────────────

  it('P1 two cash payments in the same instant: one closes, one is refused, one set of rows', async () => {
    const { orderId } = await seatedOrder([{ price: 30000 }]);
    const [a, b] = await Promise.all([
      pay(orderId, [{ method: 'CASH', amount: 30000 }]),
      pay(orderId, [{ method: 'CASH', amount: 30000 }]),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const rows = await prisma.payment.count({ where: { orderId, status: 'COMPLETED' } });
    expect(rows).toBe(1);
  });

  it('P2 a payment and a line void in the same instant: the money matches the bill', async () => {
    const { orderId, itemIds } = await seatedOrder([{ price: 20000 }, { price: 10000 }]);
    const [p, v] = await Promise.all([
      pay(orderId, [{ method: 'CASH', amount: 30000 }]),
      voidLine(supervisor, orderId, itemIds[1], { reason: 'WRONG_ITEM', wasMade: false }),
    ]);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const paid = await prisma.payment.aggregate({
      where: { orderId, status: 'COMPLETED' },
      _sum: { amount: true },
    });
    // Either the payment won (void refused) or the void won (bill 20,000, change 10,000).
    expect([p.status, v.status]).toEqual(expect.arrayContaining([200]));
    expect(order.status).toBe('CLOSED');
    expect(paid._sum.amount?.toString()).toBe(order.total.toString());
  });

  it('P3 two voids of the same line in the same instant: voided once, one audit row', async () => {
    const { orderId, itemIds } = await seatedOrder([{ price: 12000 }, { price: 5000 }]);
    const body = { reason: 'GUEST_COMPLAINT', wasMade: true };
    const [a, b] = await Promise.all([
      voidLine(supervisor, orderId, itemIds[0], body),
      voidLine(supervisor, orderId, itemIds[0], body),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const audits = await prisma.auditLog.count({
      where: { action: 'ORDER_ITEM_VOIDED', entityId: itemIds[0] },
    });
    expect(audits).toBe(1);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.total.toString()).toBe('5000');
  });

  it('P4 a send during a payment: the order never closes with an unsent line', async () => {
    const { orderId } = await seatedOrder([{ price: 9000 }]);
    const extra = await menuItem(4000, 'BAR');
    await addLine(orderId, extra.id);
    const [p, s] = await Promise.all([
      pay(orderId, [{ method: 'CASH', amount: 13000 }]),
      send(orderId),
    ]);
    expect(s.status).toBe(200);
    const unsent = await prisma.orderItem.count({ where: { orderId, sentAt: null } });
    expect(unsent).toBe(0);
    if (p.status === 200) {
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.status).toBe('CLOSED');
    } else {
      expect(p.status).toBe(409);
    }
  });

  it('P5 a line added while a cash close is in flight must not land on the closed order', async () => {
    const { orderId, reservationId } = await seatedOrder([{ price: 25000 }]);
    const late = await menuItem(7000, 'BAR');
    const lock = await holdReservationLock(reservationId);
    const payP = pay(orderId, [{ method: 'CASH', amount: 25000 }]).then((r) => r); // supertest is lazy: start it now
    expect(await waitForLockWait('%reservations%')).toBe(true); // payment is inside the close door
    const addP = fireInto(
      http().post(`/api/pos/orders/${orderId}/items`).set(as(owner)).send({ menuItemId: late.id }),
      '%order_items%',
    );
    await new Promise((r) => setTimeout(r, 300));
    lock.release();
    await lock.done;
    const [p, a] = await Promise.all([payP, addP]);
    expect(p.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const paid = await prisma.payment.aggregate({
      where: { orderId, status: 'COMPLETED' },
      _sum: { amount: true },
    });
    const lines = await prisma.orderItem.count({ where: { orderId } });
    // Correct: the add is refused (409) and the closed order still matches what was paid.
    expect(a.status).toBe(409);
    expect(lines).toBe(1);
    expect(order.total.toString()).toBe(paid._sum.amount?.toString());
  });

  it('P6 a manual-reference payment racing a cash close must not post money on the closed order', async () => {
    const { orderId, reservationId } = await seatedOrder([{ price: 40000 }]);
    const lock = await holdReservationLock(reservationId);
    const payP = pay(orderId, [{ method: 'CASH', amount: 40000 }]).then((r) => r);
    expect(await waitForLockWait('%reservations%')).toBe(true);
    const refP = fireInto(manualRef(orderId, 'MOMO', 40000), '%payments%');
    await new Promise((r) => setTimeout(r, 300));
    lock.release();
    await lock.done;
    const [p, m] = await Promise.all([payP, refP]);
    expect(p.status).toBe(200);
    const posted = await prisma.payment.aggregate({
      where: { orderId, status: 'COMPLETED' },
      _sum: { amount: true },
    });
    // Correct: the late manual reference is refused, and 40,000 is paid once.
    expect(m.status).toBe(409);
    expect(posted._sum.amount?.toString()).toBe('40000');
  });

  it('P7 a whole-order void racing a cash close must not void a paid order', async () => {
    const { orderId, reservationId } = await seatedOrder([{ price: 18000 }]);
    const lock = await holdReservationLock(reservationId);
    const payP = pay(orderId, [{ method: 'CASH', amount: 18000 }]).then((r) => r);
    expect(await waitForLockWait('%reservations%')).toBe(true);
    const voidP = fireInto(
      http().post(`/api/pos/orders/${orderId}/void`).set(as(owner)).send({ reason: 'probe' }),
      '%orders%',
    );
    await new Promise((r) => setTimeout(r, 300));
    lock.release();
    await lock.done;
    const [p, v] = await Promise.all([payP, voidP]);
    expect(p.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    // Correct: the void is refused and a paid order stays CLOSED.
    expect(v.status).toBe(409);
    expect(order.status).toBe('CLOSED');
  });

  it('P8 closing one order while the other order on the same table is voided frees the table', async () => {
    const { orderId: a, reservationId, tableId } = await seatedOrder([{ price: 11000 }]);
    const { orderId: b } = await plainOrder(tableId, 6000);
    const lock = await holdReservationLock(reservationId);
    // A's close claims A, locks the table, sees B open (so keeps the table), then waits.
    const payP = pay(a, [{ method: 'CASH', amount: 11000 }]).then((r) => r);
    expect(await waitForLockWait('%reservations%')).toBe(true);
    // B is voided now: it commits, counts A as still open (A's close has not committed).
    const v = await http()
      .post(`/api/pos/orders/${b}/void`)
      .set(as(owner))
      .send({ reason: 'probe' });
    expect(v.status).toBe(200);
    lock.release();
    await lock.done;
    expect((await payP).status).toBe(200);
    const open = await prisma.order.count({
      where: { tableId, status: { notIn: ['CLOSED', 'VOIDED'] } },
    });
    const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(open).toBe(0);
    // Correct: no open order on the table, so it is free.
    expect(table.status).toBe('AVAILABLE');
  });

  // ── Close door: tables and reservations ─────────────────────────────────────────────────

  it('P9 a table with two open orders stays occupied until the second is paid', async () => {
    const { orderId: a, tableId } = await seatedOrder([{ price: 10000 }]);
    const { orderId: b } = await plainOrder(tableId, 5000);
    expect((await pay(a, [{ method: 'CASH', amount: 10000 }])).status).toBe(200);
    expect((await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).status).toBe(
      'OCCUPIED',
    );
    expect((await pay(b, [{ method: 'CASH', amount: 5000 }])).status).toBe(200);
    expect((await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).status).toBe(
      'AVAILABLE',
    );
  });

  it('P10 an order with no table pays and closes', async () => {
    const o = await http().post('/api/pos/orders').set(as(owner)).send({ serviceType: 'TAKEAWAY' });
    expect(o.status).toBe(201);
    const mi = await menuItem(8000);
    await addLine(o.body.id, mi.id);
    expect((await send(o.body.id)).status).toBe(200);
    const p = await pay(o.body.id, [{ method: 'CASH', amount: 10000 }]);
    expect(p.status).toBe(200);
    expect(p.body.change).toBe('2000.00');
  });

  it('P11 a voided order leaves no reservation SEATED behind', async () => {
    const { orderId, reservationId } = await seatedOrder([{ price: 9000 }]);
    const v = await http()
      .post(`/api/pos/orders/${orderId}/void`)
      .set(as(owner))
      .send({ reason: 'probe' });
    expect(v.status).toBe(200);
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    // Correct: the reservation is not left SEATED on a dead order (completed or released).
    expect(r.status).not.toBe('SEATED');
  });

  // ── Money ───────────────────────────────────────────────────────────────────────────────

  it('P12 cash below the bill is refused and nothing is written', async () => {
    const { orderId } = await seatedOrder([{ price: 74000 }]);
    const r = await pay(orderId, [{ method: 'CASH', amount: 73999 }]);
    expect(r.status).toBe(400);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
  });

  it('P13 cash far above the bill: change is exact and stored (no cap exists)', async () => {
    const { orderId } = await seatedOrder([{ price: 74000 }]);
    const r = await pay(orderId, [{ method: 'CASH', amount: 10_000_000 }]);
    expect(r.status).toBe(200);
    expect(r.body.change).toBe('9926000.00');
    const row = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    expect(row.amount.toString()).toBe('74000');
    expect(row.tendered?.toString()).toBe('10000000');
    expect(row.changeGiven?.toString()).toBe('9926000');
  });

  it('P14 a non-cash method above the bill is refused on the close route', async () => {
    const { orderId } = await seatedOrder([{ price: 74000 }]);
    const r = await pay(orderId, [{ method: 'CARD', amount: 75000, reference: 'x' }]);
    expect(r.status).toBe(400);
  });

  it('P15 a non-cash manual reference above the balance is refused', async () => {
    const { orderId } = await seatedOrder([{ price: 74000 }]);
    const r = await manualRef(orderId, 'MOMO', 200000);
    // Correct: "any other method must equal what is left to pay".
    expect(r.status).toBe(400);
  });

  it('P16 amounts with more than two decimals are refused', async () => {
    const { orderId } = await seatedOrder([{ price: 1000 }]);
    const r = await pay(orderId, [{ method: 'CASH', amount: 1000.005 }]);
    expect(r.status).toBe(400);
  });

  // ── Void one line ───────────────────────────────────────────────────────────────────────

  it('P17 waiter and cashier get 403; a supervisor under another branch never reaches the order', async () => {
    const { orderId, itemIds } = await seatedOrder([{ price: 5000 }]);
    const body = { reason: 'WRONG_ITEM', wasMade: false };
    expect((await voidLine(waiter, orderId, itemIds[0], body)).status).toBe(403);
    expect((await voidLine(cashier, orderId, itemIds[0], body)).status).toBe(403);
    const cross = await voidLine(supervisor, orderId, itemIds[0], body, otherBranchId);
    expect([403, 404]).toContain(cross.status);
    const line = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemIds[0] } });
    expect(line.voidedAt).toBeNull();
  });

  it('P18 refusals: unsent line, zero or too-large quantity, OTHER without a note, paid order', async () => {
    const { orderId, itemIds } = await seatedOrder([{ price: 6000, qty: 2 }]);
    const extra = await menuItem(1000);
    const unsentId = await addLine(orderId, extra.id);
    expect(
      (await voidLine(supervisor, orderId, unsentId, { reason: 'WRONG_ITEM', wasMade: false }))
        .status,
    ).toBe(400);
    expect(
      (
        await voidLine(supervisor, orderId, itemIds[0], {
          reason: 'WRONG_ITEM',
          wasMade: false,
          quantity: 0,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await voidLine(supervisor, orderId, itemIds[0], {
          reason: 'WRONG_ITEM',
          wasMade: false,
          quantity: 3,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await voidLine(supervisor, orderId, itemIds[0], {
          reason: 'OTHER',
          wasMade: false,
          note: '   ',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await voidLine(supervisor, orderId, itemIds[0], {
          reason: 'WRONG_ITEM',
          wasMade: false,
          quantity: 1.5,
        })
      ).status,
    ).toBe(400);
    // remove the unsent line, pay, then a void on the closed order is 409
    expect(
      (await http().delete(`/api/pos/orders/${orderId}/items/${unsentId}`).set(as(owner))).status,
    ).toBeLessThan(300);
    expect((await pay(orderId, [{ method: 'CASH', amount: 12000 }])).status).toBe(200);
    expect(
      (await voidLine(supervisor, orderId, itemIds[0], { reason: 'WRONG_ITEM', wasMade: false }))
        .status,
    ).toBe(409);
  });

  it("P19 a supervisor may void a line on another waiter's order, and part of a quantity splits it", async () => {
    const { orderId, itemIds } = await seatedOrder([{ price: 4000, qty: 3 }]);
    const r = await voidLine(supervisor, orderId, itemIds[0], {
      reason: 'KITCHEN_RAN_OUT',
      wasMade: false,
      quantity: 1,
    });
    expect(r.status).toBe(200);
    const lines = await prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    expect(lines.map((l) => [l.quantity, l.voidedAt ? 'void' : 'live'])).toEqual([
      [2, 'live'],
      [1, 'void'],
    ]);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.total.toString()).toBe('8000');
    const ticketItems = await prisma.kdsTicketItem.findMany({
      where: { orderItemId: { in: lines.map((l) => l.id) } },
    });
    expect(ticketItems).toHaveLength(2);
  });

  it('P20 the last line voided: the order is left open at zero and still has a way out', async () => {
    const { orderId, tableId, itemIds } = await seatedOrder([{ price: 7000 }]);
    // serve it first: the common case for a sent-back dish
    for (const step of ['in-kitchen', 'ready', 'mark-served']) {
      expect(
        (await http().post(`/api/pos/orders/${orderId}/${step}`).set(as(owner)).send({})).status,
      ).toBe(200);
    }
    const v = await voidLine(supervisor, orderId, itemIds[0], {
      reason: 'GUEST_COMPLAINT',
      wasMade: true,
    });
    expect(v.status).toBe(200);
    expect(v.body.order.total).toBe('0');
    expect(v.body.order.status).toBe('SERVED');
    // Nothing to pay, so payment is refused…
    expect((await pay(orderId, [{ method: 'CASH', amount: 1 }])).status).toBe(409);
    // …and a SERVED order cannot be voided either. Correct: some door frees the table.
    const wholeVoid = await http()
      .post(`/api/pos/orders/${orderId}/void`)
      .set(as(owner))
      .send({ reason: 'zero bill' });
    const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(wholeVoid.status === 200 || table.status === 'AVAILABLE').toBe(true);
  });

  it('P22 the item-edit route (pos:orders:write, which waiters hold) cannot lower a sent line', async () => {
    const { orderId, itemIds } = await seatedOrder([{ price: 6000, qty: 2 }]);
    const lineId = itemIds[0];
    const r = await http()
      .patch(`/api/pos/orders/${orderId}/items/${lineId}`)
      .set(as(owner))
      .send({ quantity: 1 });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const line = await prisma.orderItem.findUniqueOrThrow({ where: { id: lineId } });
    const ticketLines = await prisma.kdsTicketItem.count({ where: { orderItemId: lineId } });
    // Correct: the line still says 2 and the bill stays 12,000, and the edit is refused (409).
    // The status is checked last so the values above are observed even when it is red.
    expect({ qty: line.quantity, total: order.total.toString(), voided: line.voidedAt }).toEqual({
      qty: 2,
      total: '12000',
      voided: null,
    });
    expect(ticketLines).toBe(1);
    expect(r.status).toBe(409);
  });

  it('P22b the same, driven as a waiter on their own order with an open shift', async () => {
    const opened = await http().post('/api/shifts/open').set(as(waiter)).send({});
    expect([201, 409]).toContain(opened.status); // 409: this waiter already has an open shift
    const table = await newTable();
    const o = await http()
      .post('/api/pos/orders')
      .set(as(waiter))
      .send({ serviceType: 'DINE_IN', tableId: table.id });
    expect(o.status).toBe(201);
    const mi = await menuItem(6000);
    const lineId = await addLine(o.body.id, mi.id, 2, waiter);
    expect(
      (await http().post(`/api/pos/orders/${o.body.id}/send`).set(as(waiter)).send({})).status,
    ).toBe(200);
    const r = await http()
      .patch(`/api/pos/orders/${o.body.id}/items/${lineId}`)
      .set(as(waiter))
      .send({ quantity: 1 });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: o.body.id } });
    const line = await prisma.orderItem.findUniqueOrThrow({ where: { id: lineId } });
    // Correct: refused, the line still says 2 and the bill 12,000. Status checked last.
    expect({ qty: line.quantity, total: order.total.toString() }).toEqual({
      qty: 2,
      total: '12000',
    });
    expect(r.status).toBe(409);
  });

  it('P23 a line void on an open order that already has a part payment is refused', async () => {
    const { orderId, itemIds } = await seatedOrder([{ price: 30000 }, { price: 10000 }]);
    expect((await manualRef(orderId, 'MOMO', 15000)).status).toBe(201);
    const v = await voidLine(supervisor, orderId, itemIds[1], {
      reason: 'WRONG_ITEM',
      wasMade: false,
    });
    expect(v.status).toBe(409);
  });

  it('P24 a reservation linked to a different order is not completed by this close', async () => {
    const one = await seatedOrder([{ price: 5000 }]);
    const two = await seatedOrder([{ price: 5000 }]);
    // point reservation one at order two (a bad link, as a data repair or a bug could leave it)
    await prisma.reservation.update({
      where: { id: one.reservationId },
      data: { seatedOrderId: two.orderId },
    });
    expect((await pay(one.orderId, [{ method: 'CASH', amount: 5000 }])).status).toBe(200);
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: one.reservationId } })).status,
    ).toBe('SEATED');
    expect((await pay(two.orderId, [{ method: 'CASH', amount: 5000 }])).status).toBe(200);
    const done = await prisma.reservation.findMany({
      where: { id: { in: [one.reservationId, two.reservationId] } },
      select: { status: true },
    });
    expect(done.map((d) => d.status)).toEqual(['COMPLETED', 'COMPLETED']);
  });

  it('N2 two cash rows whose last is smaller than the change still settle (75,000 + 5,000 on 74,000)', async () => {
    const { orderId } = await seatedOrder([{ price: 74000 }]);
    const r = await pay(orderId, [
      { method: 'CASH', amount: 75000 },
      { method: 'CASH', amount: 5000 },
    ]);
    // Correct: 80,000 handed over, 6,000 change, the bill paid.
    expect(r.status).toBe(200);
    expect(r.body.change).toBe('6000.00');
  });

  it('P25 cash beyond the column limit is a 400, never a 500', async () => {
    const { orderId } = await seatedOrder([{ price: 1000 }]);
    const r = await pay(orderId, [{ method: 'CASH', amount: 10_000_000_000 }]);
    expect(r.status).toBe(400);
  });

  // ── Rights (track T4 phase 4) ─────────────────────────────────────────────────────────

  it('A1 a waiter cannot list the branch payslips (R14: no finance rights for frontline roles)', async () => {
    const r = await http().get('/api/payroll/slips').set(as(waiter));
    const alias = await http().get('/api/payroll/payslips').set(as(cashier));
    // Correct: 403. Today pos:payroll:slips:read is granted to Waiter and Cashier and the list is
    // scoped by branch only (payroll.service.ts listPaySlips), not to the caller's own slips.
    expect([r.status, alias.status]).toEqual([403, 403]);
  });

  // ── Send ────────────────────────────────────────────────────────────────────────────────

  it('P21 a send with every line voided or removed answers 409 and makes no ticket', async () => {
    const { orderId, itemIds } = await seatedOrder([{ price: 3000 }]);
    await voidLine(supervisor, orderId, itemIds[0], { reason: 'WRONG_ITEM', wasMade: false });
    const before = await prisma.kdsTicket.count({ where: { orderId } });
    expect((await send(orderId)).status).toBe(409);
    expect(await prisma.kdsTicket.count({ where: { orderId } })).toBe(before);
  });
});
