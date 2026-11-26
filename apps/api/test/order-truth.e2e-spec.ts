import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';
import { assertDisposableEventDb } from './support/event-db-guard';

// E1 — order truth. Refuses anything but a disposable local nimbus_event_* database.
assertDisposableEventDb();

/**
 * "Table 12's evening": one table, one seated reservation, four things the old code got wrong.
 *  1. 19:42 kitchen food is sent -> a kitchen ticket.
 *  2. 20:15 drinks are added and sent -> the BAR gets its own ticket (it got nothing before).
 *  3. The guest sends back the wings -> a supervisor voids that one line.
 *  4. The guest pays cash with change -> the order closes, the table frees, the reservation completes.
 */
describe('E1 order truth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: string, supervisor: string, waiter: string, cashier: string;
  let branchId: string;
  const run = Date.now().toString(36);

  const as = (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId });
  const http = () => request(app.getHttpServer());

  async function login(email: string, password: string) {
    const r = await http().post('/api/auth/login').send({ email, password });
    expect(r.status).toBe(201);
    return r.body.accessToken as string;
  }

  let categoryId: string;
  async function menuItem(name: string, price: number, station: 'KITCHEN' | 'BAR') {
    const org = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { organizationId: true },
    });
    return prisma.menuItem.create({
      data: {
        orgId: org.organizationId,
        branchId,
        categoryId,
        name: `E1 ${name} ${run}`,
        price,
        itemType: station === 'BAR' ? 'DRINK' : 'FOOD',
        station,
      },
    });
  }

  async function newTable(label: string) {
    const org = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { organizationId: true },
    });
    return prisma.table.create({
      data: { orgId: org.organizationId, branchId, label: `${label}-${run}`, capacity: 6 },
    });
  }

  async function addLine(orderId: string, menuItemId: string, quantity: number) {
    const r = await http()
      .post(`/api/pos/orders/${orderId}/items`)
      .set(as(owner))
      .send({ menuItemId, quantity });
    expect(r.status).toBe(201);
    return r.body.id as string;
  }
  const send = (orderId: string) =>
    http().post(`/api/pos/orders/${orderId}/send`).set(as(owner)).send({});
  const pay = (token: string, orderId: string, payments: any[]) =>
    http().post(`/api/pos/orders/${orderId}/close`).set(as(token)).send({ payments });

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
    const me = await http().get('/api/me').set('Authorization', `Bearer ${owner}`);
    branchId =
      me.body.defaultBranch?.id ||
      me.body.organizations?.[0]?.branches?.[0]?.id ||
      me.body.branches?.[0]?.id ||
      me.body.memberships?.[0]?.branchId;
    const cat = await prisma.category.findFirstOrThrow({ where: { branchId } });
    categoryId = cat.id;
  }, 120000);

  afterAll(async () => {
    await app?.close();
  });

  it("Table 12's evening", async () => {
    const burger = await menuItem('Beef burger', 28000, 'KITCHEN');
    const chips = await menuItem('Chips', 8000, 'KITCHEN');
    const wings = await menuItem('Chicken wings', 24000, 'KITCHEN');
    const lager = await menuItem('Lager', 6000, 'BAR');
    const scotch = await menuItem('Double blended Scotch with cola', 15000, 'BAR');
    const cola = await menuItem('Cola', 3000, 'BAR');
    const table = await newTable('T12');

    // A reservation, confirmed and seated at table 12 with its order.
    const created = await http()
      .post('/api/reservations')
      .set(as(owner))
      .send({
        customerName: 'Table twelve party',
        partySize: 4,
        reservationAt: new Date(Date.now() + 3600_000).toISOString(),
        source: 'PHONE',
      });
    expect(created.status).toBe(201);
    const reservationId = created.body.id;
    await http()
      .patch(`/api/reservations/${reservationId}/confirm`)
      .set(as(owner))
      .send({})
      .expect(200);
    const seated = await http()
      .patch(`/api/reservations/${reservationId}/seat`)
      .set(as(owner))
      .send({ tableId: table.id, createOrder: true });
    expect(seated.status).toBe(200);
    const orderId = seated.body.seatedOrderId as string;
    expect(orderId).toBeTruthy();
    expect((await prisma.table.findUniqueOrThrow({ where: { id: table.id } })).status).toBe(
      'OCCUPIED',
    );

    // ── 1. 19:42 — kitchen food, one send, one kitchen ticket
    const burgerLine = await addLine(orderId, burger.id, 1);
    await addLine(orderId, chips.id, 2);
    const wingsLine = await addLine(orderId, wings.id, 1);
    await send(orderId).then((r) => expect(r.status).toBe(200));
    let tickets = await prisma.kdsTicket.findMany({ where: { orderId }, include: { items: true } });
    expect(tickets.map((t) => t.station)).toEqual(['KITCHEN']);
    expect(tickets[0].items).toHaveLength(3);

    // ── 2. 20:15 — drinks added to the same order and sent: the BAR gets a ticket
    await addLine(orderId, lager.id, 2);
    await addLine(orderId, scotch.id, 1);
    await addLine(orderId, cola.id, 1);
    // payment is refused while lines are unsent
    const early = await pay(cashier, orderId, [{ method: 'CASH', amount: 98000 }]);
    expect(early.status).toBe(409);
    expect(early.body.message).toContain('Send or remove the unsent items first');
    const second = await send(orderId);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe('SENT'); // status left alone after the first send
    tickets = await prisma.kdsTicket.findMany({
      where: { orderId },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(tickets.map((t) => t.station)).toEqual(['KITCHEN', 'BAR']);
    expect(tickets[0].items).toHaveLength(3); // the kitchen ticket is not touched
    expect(tickets[1].items).toHaveLength(3);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).total.toString(),
    ).toBe('98000');

    // a doubled send makes no second ticket
    const [a, b] = await Promise.all([send(orderId), send(orderId)]);
    expect([a.status, b.status]).toEqual([409, 409]);
    expect(await prisma.kdsTicket.count({ where: { orderId } })).toBe(2);

    // ── 3. The wings go back. Waiter and cashier cannot void; the supervisor can.
    const body = { reason: 'GUEST_COMPLAINT', wasMade: true };
    const voidPath = `/api/orders/${orderId}/items/${wingsLine}/void`;
    expect((await http().post(voidPath).set(as(waiter)).send(body)).status).toBe(403);
    expect((await http().post(voidPath).set(as(cashier)).send(body)).status).toBe(403);
    const voided = await http().post(voidPath).set(as(supervisor)).send(body);
    expect(voided.status).toBe(200);
    expect(voided.body.order.total).toBe('74000');
    const wingsRow = await prisma.orderItem.findUniqueOrThrow({ where: { id: wingsLine } });
    expect(wingsRow.voidedAt).not.toBeNull();
    expect(wingsRow.voidReason).toBe('GUEST_COMPLAINT');
    expect(wingsRow.wasMade).toBe(true);
    expect(wingsRow.voidedById).toBeTruthy();
    const ticketItem = await prisma.kdsTicketItem.findFirstOrThrow({
      where: { orderItemId: wingsLine },
    });
    expect(ticketItem.voidedAt).not.toBeNull();
    // voiding again changes nothing
    const again = await http().post(voidPath).set(as(supervisor)).send(body);
    expect(again.status).toBe(200);
    expect(again.body.unchanged).toBe(true);
    // the other lines are untouched
    expect(
      (await prisma.orderItem.findUniqueOrThrow({ where: { id: burgerLine } })).voidedAt,
    ).toBeNull();

    // ── 4. Cash with change: 76,000 handed over on the 74,000 bill
    const paid = await pay(cashier, orderId, [{ method: 'CASH', amount: 76000 }]);
    expect(paid.status).toBe(200);
    expect(paid.body.order.status).toBe('CLOSED');
    expect(paid.body.change).toBe('2000.00');
    const row = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    expect(row.amount.toString()).toBe('74000');
    expect(row.tendered?.toString()).toBe('76000');
    expect(row.changeGiven?.toString()).toBe('2000');

    expect((await prisma.table.findUniqueOrThrow({ where: { id: table.id } })).status).toBe(
      'AVAILABLE',
    );
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status,
    ).toBe('COMPLETED');
    const completed = await prisma.reservationEvent.count({
      where: { reservationId, type: 'COMPLETED' },
    });
    expect(completed).toBe(1);
    // and no line can be voided on the closed order
    const late = await http()
      .post(`/api/orders/${orderId}/items/${burgerLine}/void`)
      .set(as(supervisor))
      .send(body);
    expect(late.status).toBe(409);
  }, 120000);

  it('100,000 cash on a 98,000 bill: 2,000 change, order closed, table freed', async () => {
    const dish = await menuItem('Platter', 98000, 'KITCHEN');
    const table = await newTable('T13');
    const order = await http()
      .post('/api/pos/orders')
      .set(as(owner))
      .send({ serviceType: 'DINE_IN', tableId: table.id });
    const orderId = order.body.id;
    await addLine(orderId, dish.id, 1);
    expect((await send(orderId)).status).toBe(200);
    expect((await prisma.table.findUniqueOrThrow({ where: { id: table.id } })).status).toBe(
      'OCCUPIED',
    );

    // a card payment that is more than owed is refused; cash is not
    const card = await pay(cashier, orderId, [{ method: 'CARD', amount: 100000 }]);
    expect(card.status).toBe(400);
    const cash = await pay(cashier, orderId, [{ method: 'CASH', amount: 100000 }]);
    expect(cash.status).toBe(200);
    expect(cash.body.change).toBe('2000.00');
    expect((await prisma.table.findUniqueOrThrow({ where: { id: table.id } })).status).toBe(
      'AVAILABLE',
    );
  }, 60000);

  it('two open orders on one table: closing one leaves the table occupied', async () => {
    const dish = await menuItem('Soup', 10000, 'KITCHEN');
    const table = await newTable('T14');
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const o = await http()
        .post('/api/pos/orders')
        .set(as(owner))
        .send({ serviceType: 'DINE_IN', tableId: table.id });
      await addLine(o.body.id, dish.id, 1);
      expect((await send(o.body.id)).status).toBe(200);
      ids.push(o.body.id);
    }
    expect((await pay(cashier, ids[0], [{ method: 'CASH', amount: 10000 }])).status).toBe(200);
    expect((await prisma.table.findUniqueOrThrow({ where: { id: table.id } })).status).toBe(
      'OCCUPIED',
    );
    expect((await pay(cashier, ids[1], [{ method: 'CASH', amount: 10000 }])).status).toBe(200);
    expect((await prisma.table.findUniqueOrThrow({ where: { id: table.id } })).status).toBe(
      'AVAILABLE',
    );
  }, 60000);

  it('void rules: never-sent line, part quantity, OTHER needs a note, payment blocks a void', async () => {
    const dish = await menuItem('Pizza', 20000, 'KITCHEN');
    const order = await http()
      .post('/api/pos/orders')
      .set(as(owner))
      .send({ serviceType: 'TAKEAWAY' });
    const orderId = order.body.id;
    const sent = await addLine(orderId, dish.id, 3);
    const unsent = await addLine(orderId, dish.id, 1);
    // nothing sent yet: a void is refused with "remove it instead"
    const early = await http()
      .post(`/api/orders/${orderId}/items/${unsent}/void`)
      .set(as(supervisor))
      .send({ reason: 'WRONG_ITEM', wasMade: false });
    expect(early.status).toBe(400);
    expect(early.body.message).toContain('Remove it instead');
    await send(orderId);
    // a sent line is never deleted by the waiter's remove
    expect(
      (await http().delete(`/api/pos/orders/${orderId}/items/${sent}`).set(as(owner))).status,
    ).toBe(409);
    // OTHER needs a note; wasMade is required
    expect(
      (
        await http()
          .post(`/api/orders/${orderId}/items/${sent}/void`)
          .set(as(supervisor))
          .send({ reason: 'OTHER', wasMade: false })
      ).status,
    ).toBe(400);
    expect(
      (
        await http()
          .post(`/api/orders/${orderId}/items/${sent}/void`)
          .set(as(supervisor))
          .send({ reason: 'WRONG_ITEM' })
      ).status,
    ).toBe(400);
    // part of a quantity: 3 -> 2 live + 1 voided
    const part = await http()
      .post(`/api/orders/${orderId}/items/${sent}/void`)
      .set(as(supervisor))
      .send({ reason: 'KITCHEN_RAN_OUT', wasMade: false, quantity: 1 });
    expect(part.status).toBe(200);
    expect(part.body.order.total).toBe('60000'); // 80,000 less the one voided pizza; 3 live pizzas remain
    const lines = await prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    expect(lines.map((l) => [l.quantity, l.voidedAt !== null])).toEqual(
      expect.arrayContaining([
        [2, false],
        [1, true],
        [1, false],
      ]),
    );
    // once paid, no line can be voided (409)
    const total = part.body.order.total;
    expect((await pay(cashier, orderId, [{ method: 'CASH', amount: Number(total) }])).status).toBe(
      200,
    );
    const after = await http()
      .post(`/api/orders/${orderId}/items/${sent}/void`)
      .set(as(supervisor))
      .send({ reason: 'WRONG_ITEM', wasMade: false });
    expect(after.status).toBe(409);
  }, 60000);

  it('two sends fired together: exactly one succeeds, the lines are ticketed once', async () => {
    const dish = await menuItem('Stew', 12000, 'KITCHEN');
    const drink = await menuItem('Soda', 3000, 'BAR');
    const order = await http()
      .post('/api/pos/orders')
      .set(as(owner))
      .send({ serviceType: 'TAKEAWAY' });
    const orderId = order.body.id;
    const l1 = await addLine(orderId, dish.id, 1);
    const l2 = await addLine(orderId, drink.id, 1);
    const results = await Promise.all([send(orderId), send(orderId), send(orderId)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    const items = await prisma.kdsTicketItem.findMany({ where: { orderItemId: { in: [l1, l2] } } });
    expect(items).toHaveLength(2); // one ticket item per line, never two
    expect(await prisma.kdsTicket.count({ where: { orderId } })).toBe(2);
    // the database itself refuses a second ticket item for a line
    await expect(
      prisma.kdsTicketItem.create({ data: { ticketId: items[0].ticketId, orderItemId: l1 } }),
    ).rejects.toThrow();
  }, 60000);
});
