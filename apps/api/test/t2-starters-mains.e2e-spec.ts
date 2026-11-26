import { assertDisposableEventDb } from './support/event-db-guard';
import {
  addLine,
  bootWorld,
  ensureShift,
  makeItem,
  makeStaff,
  makeTable,
  openOrder,
  send,
  T2World,
} from './support/t2-helpers';

// T2 phase 3 (E5). Refuses anything but a disposable local nimbus_event_* database.
assertDisposableEventDb();

/**
 * "Starters now, mains later" (Moses, 25 Nov 2026: "We have like a kitchen screen we are trying
 * to work on… how a chef is notified.")
 * Starters sent and mains held: the kitchen sees only starters; Ready reaches the waiter's list;
 * Collected; mains fired, one fire undone inside 3 seconds; a nut allergy shows on both tickets;
 * a second round of drinks makes a bar ticket; a ticket bumped by mistake is brought back.
 */
describe('T2 phase 3: Starters now, mains later (e2e)', () => {
  let w: T2World;
  let waiter: { id: string; token: string };
  let other: { id: string; token: string };
  let bartender: { id: string; token: string };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  beforeAll(async () => {
    w = await bootWorld();
    waiter = await makeStaff(w, 'Waiter', 'Dembe');
    other = await makeStaff(w, 'Waiter', 'Esther');
    bartender = await makeStaff(w, 'Bartender', 'Faisal');
    await ensureShift(w, waiter.token);
    await ensureShift(w, other.token);
  }, 120000);

  afterAll(async () => {
    await w?.app.close();
  });

  const ticketsFor = async (orderIds: string[], station: string) =>
    (
      await w
        .http()
        .get('/api/kds/queue')
        .query({ station, orderId: orderIds[0], pageSize: 200 })
        .set(w.as(w.tokens.chef))
    ).body.data as any[];
  const ready = (token: string, scope: 'mine' | 'all') =>
    w.http().get('/api/kds/ready').query({ scope }).set(w.as(token));
  const floorState = async (tableId: string) =>
    (
      (await w.http().get('/api/floor/state').set(w.as(w.tokens.supervisor))).body.tables as any[]
    ).find((t) => t.tableId === tableId);

  it('the whole table', async () => {
    const soup = await makeItem(w, 'Groundnut soup', 9000, 'KITCHEN');
    const salad = await makeItem(w, 'Avocado salad', 8000, 'KITCHEN');
    const steak = await makeItem(w, 'Steak', 45000, 'KITCHEN');
    const tilapia = await makeItem(w, 'Whole tilapia', 38000, 'KITCHEN');
    const lager = await makeItem(w, 'Club lager', 6000, 'BAR');
    const table = await makeTable(w, 'SM');

    // Round one: starters now (one with a nut allergy), mains held, one drink.
    const o = await openOrder(w, waiter.token, table.id);
    expect((await addLine(w, waiter.token, o, soup.id, 1, { allergy: 'nuts' })).status).toBe(201);
    await addLine(w, waiter.token, o, salad.id);
    const steakLine = (await addLine(w, waiter.token, o, steak.id, 1, { hold: true })).body;
    const fishLine = (
      await addLine(w, waiter.token, o, tilapia.id, 1, { hold: true, takeaway: true })
    ).body;
    expect([steakLine.heldAt !== null, fishLine.takeaway]).toEqual([true, true]);
    await addLine(w, waiter.token, o, lager.id);
    const s1 = await send(w, waiter.token, o);
    expect(s1.status).toBe(200);
    expect(s1.body.sent).toHaveLength(3);
    expect(s1.body.held).toEqual(expect.arrayContaining([steakLine.id, fishLine.id]));

    // The kitchen sees only the starters, with the allergy on the ticket.
    let kitchen = await ticketsFor([o], 'KITCHEN');
    expect(kitchen).toHaveLength(1);
    const starters = kitchen[0];
    expect(starters.items.map((i: any) => i.menuItemName).sort()).toEqual(
      [salad.name, soup.name].sort(),
    );
    expect(starters.items.find((i: any) => i.menuItemName === soup.name).allergy).toBe('nuts');
    expect(starters.allergies).toEqual(['nuts']);
    expect(starters.table.label).toBe(table.label);
    expect((await floorState(table.id)).state).toBe('SENT');

    // Rights: a waiter and a bartender cannot work a kitchen ticket; the chef cannot work the bar's.
    expect(
      (await w.http().post(`/api/kds/tickets/${starters.id}/mark-ready`).set(w.as(waiter.token)))
        .status,
    ).toBe(403);
    expect(
      (await w.http().post(`/api/kds/tickets/${starters.id}/mark-ready`).set(w.as(bartender.token)))
        .status,
    ).toBe(403);
    const bar = await ticketsFor([o], 'BAR');
    expect(bar).toHaveLength(1);
    expect(
      (await w.http().post(`/api/kds/tickets/${bar[0].id}/mark-ready`).set(w.as(w.tokens.chef)))
        .status,
    ).toBe(403);
    expect(
      (await w.http().post(`/api/kds/tickets/${bar[0].id}/mark-ready`).set(w.as(bartender.token)))
        .status,
    ).toBe(201);

    // Ready reaches the waiter's list, twice-tapped Ready does nothing the second time.
    const [r1, r2] = await Promise.all([
      w.http().post(`/api/kds/tickets/${starters.id}/mark-ready`).set(w.as(w.tokens.chef)),
      w.http().post(`/api/kds/tickets/${starters.id}/mark-ready`).set(w.as(w.tokens.chef)),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]); // mark-ready answers 201 (existing route)
    expect((await floorState(table.id)).state).toBe('READY');
    const mine = await ready(waiter.token, 'mine');
    expect(mine.status).toBe(200);
    expect(mine.body.tickets.map((t: any) => t.id).sort()).toEqual([starters.id, bar[0].id].sort());
    expect(mine.body.tickets.find((t: any) => t.id === starters.id)).toMatchObject({
      tableLabel: table.label,
      station: 'KITCHEN',
    });
    expect((await ready(other.token, 'mine')).body.tickets.map((t: any) => t.id)).not.toContain(
      starters.id,
    );
    expect((await ready(other.token, 'all')).body.tickets.map((t: any) => t.id)).toContain(
      starters.id,
    );

    // Collected: once; the times are kept.
    const [c1, c2] = await Promise.all([
      w.http().post(`/api/kds/tickets/${starters.id}/collected`).set(w.as(waiter.token)),
      w.http().post(`/api/kds/tickets/${starters.id}/collected`).set(w.as(waiter.token)),
    ]);
    expect([c1.status, c2.status].sort()).toEqual([200, 409]);
    await w.http().post(`/api/kds/tickets/${bar[0].id}/collected`).set(w.as(waiter.token));
    const kept = await w.prisma.kdsTicket.findUniqueOrThrow({ where: { id: starters.id } });
    const soupSent = (
      await w.prisma.orderItem.findFirstOrThrow({ where: { orderId: o, menuItemId: soup.id } })
    ).sentAt!;
    expect(soupSent <= kept.readyAt! && kept.readyAt! <= kept.collectedAt!).toBe(true);
    expect((await ready(waiter.token, 'mine')).body.tickets).toEqual([]);
    expect((await floorState(table.id)).state).toBe('SENT');

    // Mains fired; that fire is undone inside 3 seconds; nothing reaches the kitchen.
    const f1 = await w.http().post(`/api/pos/orders/${o}/fire`).set(w.as(waiter.token)).send({});
    expect(f1.status).toBe(200);
    expect(f1.body.itemIds.sort()).toEqual([steakLine.id, fishLine.id].sort());
    const u1 = await w
      .http()
      .post(`/api/pos/orders/${o}/fire/${f1.body.fireId}/undo`)
      .set(w.as(waiter.token));
    expect(u1.status).toBe(200);
    await wait(3300);
    expect(await ticketsFor([o], 'KITCHEN')).toHaveLength(1);
    expect(
      (await w.prisma.orderItem.findUniqueOrThrow({ where: { id: steakLine.id } })).sentAt,
    ).toBeNull();

    // Fired again and left: after 3 seconds the mains ticket is in the kitchen, allergy and all.
    const f2 = await w.http().post(`/api/pos/orders/${o}/fire`).set(w.as(waiter.token)).send({});
    expect(f2.status).toBe(200);
    expect(
      (await w.http().post(`/api/pos/orders/${o}/fire`).set(w.as(waiter.token)).send({})).status,
    ).toBe(409); // nothing left to fire
    await wait(3300);
    const late = await w
      .http()
      .post(`/api/pos/orders/${o}/fire/${f2.body.fireId}/undo`)
      .set(w.as(waiter.token));
    expect(late.status).toBe(409);
    kitchen = await ticketsFor([o], 'KITCHEN');
    expect(kitchen).toHaveLength(2);
    const mains = kitchen.find((t) => t.id !== starters.id)!;
    expect(mains.items.map((i: any) => i.menuItemName).sort()).toEqual(
      [steak.name, tilapia.name].sort(),
    );
    expect(mains.allergies).toEqual(['nuts']); // the allergy is kept for later rounds on this table
    expect(mains.items.find((i: any) => i.menuItemName === tilapia.name).takeaway).toBe(true);
    expect(await w.prisma.kdsTicketItem.count({ where: { orderItemId: steakLine.id } })).toBe(1);

    // A second round of drinks makes its own bar ticket.
    await addLine(w, waiter.token, o, lager.id, 2);
    expect((await send(w, waiter.token, o)).status).toBe(200);
    expect(await ticketsFor([o], 'BAR')).toHaveLength(2);

    // The mains ticket is bumped by mistake, then brought back.
    expect(
      (await w.http().post(`/api/kds/tickets/${mains.id}/mark-ready`).set(w.as(w.tokens.chef)))
        .status,
    ).toBe(201);
    const back = await w
      .http()
      .post(`/api/kds/tickets/${mains.id}/recall`)
      .set(w.as(w.tokens.chef));
    expect([back.status, back.body.status]).toEqual([201, 'RECALLED']);
    expect((await ready(waiter.token, 'mine')).body.tickets.map((t: any) => t.id)).not.toContain(
      mains.id,
    );
    expect((await ticketsFor([o], 'KITCHEN')).find((t) => t.id === mains.id).status).toBe(
      'RECALLED',
    );

    // Ready reaches whoever has the table now.
    const cw = await w
      .http()
      .post(`/api/tables/${table.id}/change-waiter`)
      .set(w.as(w.tokens.supervisor))
      .send({ toUserId: other.id });
    expect(cw.status).toBe(200);
    expect(
      (await w.http().post(`/api/kds/tickets/${mains.id}/mark-ready`).set(w.as(w.tokens.chef)))
        .status,
    ).toBe(201);
    expect((await ready(other.token, 'mine')).body.tickets.map((t: any) => t.id)).toContain(
      mains.id,
    );
    expect((await ready(waiter.token, 'mine')).body.tickets.map((t: any) => t.id)).not.toContain(
      mains.id,
    );
  }, 60000);

  it('stations are listed per branch with their late times; a ticket past its red time makes the table late', async () => {
    const st = await w.http().get('/api/kds/stations').set(w.as(w.tokens.chef));
    expect(st.status).toBe(200);
    expect(st.body.stations.map((s: any) => s.station)).toEqual([
      'KITCHEN',
      'BAR',
      'COLD_KITCHEN',
      'DESSERT',
    ]);
    const dessert = st.body.stations.find((s: any) => s.station === 'DESSERT');
    // a short red time for the dessert station only, put back afterwards
    await w
      .http()
      .patch('/api/kds/sla-config/DESSERT')
      .set(w.as(w.tokens.manager))
      .send({ greenSeconds: 1, amberSeconds: 1, redSeconds: 2 });
    try {
      const cake = await w.prisma.menuItem.create({
        data: {
          orgId: w.orgId,
          branchId: w.branchId,
          categoryId: w.categoryId,
          name: `Late cake ${w.run}`,
          price: 12000,
          itemType: 'FOOD',
          station: 'DESSERT',
        },
      });
      const table = await makeTable(w, 'LATE');
      const o = await openOrder(w, waiter.token, table.id);
      await addLine(w, waiter.token, o, cake.id);
      expect((await send(w, waiter.token, o)).status).toBe(200);
      expect((await floorState(table.id)).state).toBe('SENT');
      await wait(2300);
      expect((await floorState(table.id)).state).toBe('LATE');
      // An unsent line on an open table reads "not sent".
      const t2 = await makeTable(w, 'NOTSENT');
      const o2 = await openOrder(w, waiter.token, t2.id);
      await addLine(w, waiter.token, o2, cake.id);
      expect((await floorState(t2.id)).state).toBe('NOT_SENT');
    } finally {
      await w.http().patch('/api/kds/sla-config/DESSERT').set(w.as(w.tokens.manager)).send({
        greenSeconds: dessert.greenSeconds,
        amberSeconds: dessert.amberSeconds,
        redSeconds: dessert.redSeconds,
      });
    }
  });

  it('races: double fire, and undo against the fire going out', async () => {
    const pilau = await makeItem(w, 'Race pilau', 15000, 'KITCHEN');
    const table = await makeTable(w, 'FIRE');
    const o = await openOrder(w, waiter.token, table.id);
    await addLine(w, waiter.token, o, pilau.id, 1, { hold: true });
    await addLine(w, waiter.token, o, pilau.id, 1);
    expect((await send(w, waiter.token, o)).status).toBe(200);
    const [a, b] = await Promise.all([
      w.http().post(`/api/pos/orders/${o}/fire`).set(w.as(waiter.token)).send({}),
      w.http().post(`/api/pos/orders/${o}/fire`).set(w.as(waiter.token)).send({}),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const fireId = (a.status === 200 ? a : b).body.fireId;
    await wait(2950);
    // The undo and the fire going out land together, at the 3-second line: exactly one wins.
    const [undo, q] = await Promise.all([
      w.http().post(`/api/pos/orders/${o}/fire/${fireId}/undo`).set(w.as(waiter.token)),
      w
        .http()
        .get('/api/kds/queue')
        .query({ station: 'KITCHEN', pageSize: 200 })
        .set(w.as(w.tokens.chef)),
    ]);
    expect(q.status).toBe(200);
    const held = await w.prisma.orderItem.findFirstOrThrow({
      where: { orderId: o, menuItemId: pilau.id, heldAt: { not: null } },
    });
    const tickets = await w.prisma.kdsTicketItem.count({ where: { orderItemId: held.id } });
    if (undo.status === 200) expect([held.sentAt, tickets]).toEqual([null, 0]);
    else expect([undo.status, held.sentAt !== null, tickets]).toEqual([409, true, 1]);
  });

  it('an allergy said at one table stays on the next round after the tables are joined', async () => {
    const prawns = await makeItem(w, 'Garlic prawns', 30000, 'KITCHEN');
    const rice = await makeItem(w, 'Pilau rice', 7000, 'KITCHEN');
    const host = await makeTable(w, 'ALH');
    const other = await makeTable(w, 'ALO');
    const oh = await openOrder(w, waiter.token, host.id);
    await addLine(w, waiter.token, oh, rice.id);
    expect((await send(w, waiter.token, oh)).status).toBe(200);
    const oo = await openOrder(w, waiter.token, other.id);
    await addLine(w, waiter.token, oo, prawns.id, 1, { allergy: 'Shellfish' });
    expect((await send(w, waiter.token, oo)).status).toBe(200);
    const jn = await w
      .http()
      .post(`/api/tables/${host.id}/join`)
      .set(w.as(w.tokens.supervisor))
      .send({ tableId: other.id });
    expect(jn.status).toBe(200);
    await addLine(w, waiter.token, oh, rice.id, 2);
    expect((await send(w, waiter.token, oh)).status).toBe(200);
    const kitchen = await ticketsFor([oh], 'KITCHEN');
    const latest = kitchen.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    expect(latest.items.map((i: any) => i.quantity)).toEqual([2]);
    expect(latest.allergies).toEqual(['shellfish']);
    expect(latest.table.label).toBe(host.label);
  });

  it('[emulation] a fire that came due with no timer is sent out by the next read (kitchen queue, then the floor)', async () => {
    const goat = await makeItem(w, 'Lazy goat stew', 22000, 'KITCHEN');
    for (const via of ['queue', 'floor'] as const) {
      const table = await makeTable(w, `LZ-${via}`);
      const o = await openOrder(w, waiter.token, table.id);
      const line = (await addLine(w, waiter.token, o, goat.id, 1, { hold: true })).body;
      // A fire whose window passed while no process was running: no timer exists for it.
      await w.prisma.orderItem.update({
        where: { id: line.id },
        data: { fireAt: new Date(Date.now() - 1000), fireId: `lazy-${via}-${w.run}` },
      });
      expect(await w.prisma.kdsTicketItem.count({ where: { orderItemId: line.id } })).toBe(0);
      if (via === 'queue') {
        const q = await w
          .http()
          .get('/api/kds/queue')
          .query({ orderId: o, station: 'KITCHEN' })
          .set(w.as(w.tokens.chef));
        expect(q.body.data).toHaveLength(1);
        expect(q.body.data[0].fireId).toBe(`lazy-queue-${w.run}`);
      } else {
        const fs = await w.http().get('/api/floor/state').set(w.as(w.tokens.supervisor));
        expect(fs.body.tables.find((t: any) => t.tableId === table.id).state).toBe('SENT');
      }
      expect(await w.prisma.kdsTicketItem.count({ where: { orderItemId: line.id } })).toBe(1);
      expect(
        (await w.prisma.orderItem.findUniqueOrThrow({ where: { id: line.id } })).sentAt,
      ).not.toBeNull();
    }
  });

  it('a bartender marks bar items sold out or sets a number, never kitchen items', async () => {
    const gin = await makeItem(w, 'House gin', 9000, 'BAR');
    const stew = await makeItem(w, 'Bar-proof stew', 18000, 'KITCHEN');
    const own = await w
      .http()
      .put(`/api/menu/items/${gin.id}/left`)
      .set(w.as(bartender.token))
      .send({ left: 10 });
    expect([own.status, own.body.availability.left]).toEqual([200, 10]);
    expect(
      (await w.http().post(`/api/menu/items/${gin.id}/sold-out`).set(w.as(bartender.token))).status,
    ).toBe(200);
    expect(
      (
        await w
          .http()
          .put(`/api/menu/items/${stew.id}/left`)
          .set(w.as(bartender.token))
          .send({ left: 3 })
      ).status,
    ).toBe(403);
    expect(
      (await w.http().post(`/api/menu/items/${stew.id}/sold-out`).set(w.as(bartender.token)))
        .status,
    ).toBe(403);
  });
});
