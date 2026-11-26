import { assertDisposableEventDb } from './support/event-db-guard';
import {
  addLine,
  bootWorld,
  ensureShift,
  makeItem,
  makeStaff,
  openOrder,
  send,
  T2World,
} from './support/t2-helpers';

// T2 phase 2 (E3). Refuses anything but a disposable local nimbus_event_* database.
assertDisposableEventDb();

/**
 * "A busy Friday" (Moses, 25 and 26 Nov 2026: "Some places have like 60 tables, then they add
 * extra tables for busy nights because some people are just standing." "Who creates tables
 * and with what permission.")
 * 60 tables in 4 areas and a tabs area, made through the API; 8 more tables added mid-service;
 * tab 1 to tab 30 opened by three waiters at once with no number used twice; table 5's party
 * moves to table 14; tables 7 and 8 joined then split; one line moved; a waiter hands six
 * tables to a colleague and only then ends the shift.
 * Each run gets its own branch, so the numbers 1 to 68 and tabs 1 to 30 are real every time.
 */
describe('T2 phase 2: A busy Friday (e2e)', () => {
  let w: T2World;
  let f: T2World; // the same world, on tonight's branch
  let asha: { id: string; token: string };
  let bosco: { id: string; token: string };
  let chloe: { id: string; token: string };
  let ashaShift: string;

  beforeAll(async () => {
    w = await bootWorld();
    const branch = await w.prisma.branch.create({
      data: {
        organizationId: w.orgId,
        name: `Friday ${w.run}`,
        code: `FRI-${w.run}`,
        currencyCode: 'UGX',
      },
    });
    const category = await w.prisma.category.create({
      data: { orgId: w.orgId, branchId: branch.id, name: `Friday menu ${w.run}` },
    });
    for (const email of ['owner@demo.local', 'manager@demo.local', 'supervisor@demo.local']) {
      const u = await w.prisma.user.findUniqueOrThrow({
        where: { email },
        include: { userRoles: true },
      });
      await w.prisma.membership.create({
        data: {
          userId: u.id,
          organizationId: w.orgId,
          branchId: branch.id,
          roleId: u.userRoles[0].roleId,
        },
      });
    }
    f = {
      ...w,
      branchId: branch.id,
      categoryId: category.id,
      as: (t) => ({ Authorization: `Bearer ${t}`, 'X-Branch-Id': branch.id }),
    };
    asha = await makeStaff(f, 'Waiter', 'Asha');
    bosco = await makeStaff(f, 'Waiter', 'Bosco');
    chloe = await makeStaff(f, 'Waiter', 'Chloe');
    ashaShift = await ensureShift(f, asha.token);
    await ensureShift(f, bosco.token);
    await ensureShift(f, chloe.token);
  }, 180000);

  afterAll(async () => {
    await w?.app.close();
  });

  const tableId = async (label: string) =>
    (
      await f.prisma.table.findUniqueOrThrow({
        where: { branchId_label: { branchId: f.branchId, label } },
      })
    ).id;
  const tableRow = async (label: string) =>
    f.prisma.table.findUniqueOrThrow({
      where: { branchId_label: { branchId: f.branchId, label } },
    });

  async function seat(waiter: { token: string }, label: string, items: { id: string }[]) {
    const o = await openOrder(f, waiter.token, await tableId(label));
    for (const it of items) expect((await addLine(f, waiter.token, o, it.id)).status).toBe(201);
    expect((await send(f, waiter.token, o)).status).toBe(200);
    return o;
  }

  it('the whole evening', async () => {
    const mgr = f.tokens.manager;
    const sup = f.tokens.supervisor;

    // Rights: a waiter cannot make areas or tables.
    expect(
      (await f.http().post('/api/areas').set(f.as(asha.token)).send({ name: 'Nope' })).status,
    ).toBe(403);

    // 60 tables in 4 areas, 15 each, and a tabs area, all through the API.
    const areas: Record<string, string> = {};
    let first = 1;
    for (const [i, name] of ['Main hall', 'Terrace', 'Garden', 'Lounge'].entries()) {
      const a = await f.http().post('/api/areas').set(f.as(mgr)).send({ name, sortOrder: i });
      expect(a.status).toBe(201);
      areas[name] = a.body.id;
      const b = await f
        .http()
        .post(`/api/areas/${a.body.id}/tables`)
        .set(f.as(mgr))
        .send({ count: 15, firstNumber: first, seats: 4 });
      expect(b.status).toBe(201);
      expect(b.body.tables.map((t: any) => t.label)).toEqual(
        Array.from({ length: 15 }, (_, k) => String(first + k)),
      );
      first += 15;
    }
    expect(
      (
        await f
          .http()
          .post(`/api/areas/${areas['Main hall']}/tables`)
          .set(f.as(asha.token))
          .send({ count: 1, firstNumber: 900, seats: 2 })
      ).status,
    ).toBe(403);
    const tabsArea = await f
      .http()
      .post('/api/areas')
      .set(f.as(mgr))
      .send({ name: 'Bar tabs', kind: 'TABS', sortOrder: 9 });
    expect(tabsArea.status).toBe(201);
    let list = await f.http().get('/api/areas').set(f.as(asha.token));
    expect(list.body.areas.map((a: any) => [a.name, a.kind, a.tables.length])).toEqual([
      ['Main hall', 'TABLES', 15],
      ['Terrace', 'TABLES', 15],
      ['Garden', 'TABLES', 15],
      ['Lounge', 'TABLES', 15],
      ['Bar tabs', 'TABS', 0],
    ]);

    const burger = await makeItem(f, 'Friday burger', 28000, 'KITCHEN');
    const chips = await makeItem(f, 'Friday chips', 8000, 'KITCHEN');
    const lager = await makeItem(f, 'Friday lager', 6000, 'BAR');

    // Service: Asha has six tables, Bosco four.
    const ashaTables = ['1', '2', '4', '6', '9', '10'];
    for (const t of ashaTables) await seat(asha, t, [burger, lager]);
    const o3 = await seat(bosco, '3', [burger, chips]);
    const o5 = await seat(bosco, '5', [burger, lager]);
    const o7 = await seat(bosco, '7', [burger]);
    const o8 = await seat(bosco, '8', [chips, lager]);

    // 8 more tables mid-service, by the supervisor; a number already used is refused whole.
    const clash = await f
      .http()
      .post(`/api/areas/${areas.Garden}/tables`)
      .set(f.as(sup))
      .send({ count: 2, firstNumber: 60, seats: 2 });
    expect(clash.status).toBe(409);
    expect(clash.body.numbers ?? clash.body.message?.numbers).toEqual(['60']);
    expect(await f.prisma.table.count({ where: { branchId: f.branchId, label: '61' } })).toBe(0);
    const extra = await f
      .http()
      .post(`/api/areas/${areas.Garden}/tables`)
      .set(f.as(sup))
      .send({ count: 8, firstNumber: 61, seats: 2 });
    expect(extra.status).toBe(201);
    expect(extra.body.tables.map((t: any) => t.label)).toEqual([
      '61',
      '62',
      '63',
      '64',
      '65',
      '66',
      '67',
      '68',
    ]);

    // Tab 1 to tab 30, opened by three waiters at once: no number used twice.
    const openers = [asha, bosco, chloe];
    const opened = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        f
          .http()
          .post(`/api/areas/${tabsArea.body.id}/tabs`)
          .set(f.as(openers[i % 3].token))
          .send({ note: `standing guest ${i + 1}` }),
      ),
    );
    expect(opened.map((r) => r.status)).toEqual(Array(30).fill(201));
    expect(opened.map((r) => r.body.tabNumber).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
    expect(new Set(opened.map((r) => r.body.label)).size).toBe(30);

    // A tab behaves as a table, and is put away when paid; its number is free again.
    const tab1 = opened.find((r) => r.body.tabNumber === 1)!.body;
    const ot = await openOrder(f, chloe.token, tab1.id);
    await addLine(f, chloe.token, ot, lager.id);
    expect((await send(f, chloe.token, ot)).status).toBe(200);
    const paid = await f
      .http()
      .post(`/api/pos/orders/${ot}/close`)
      .set(f.as(f.tokens.owner))
      .send({ payments: [{ method: 'CASH', amount: 10000 }] });
    expect(paid.status).toBe(200);
    const tab1Row = await f.prisma.table.findUniqueOrThrow({ where: { id: tab1.id } });
    expect([tab1Row.isActive, tab1Row.tabNumber]).toEqual([false, 1]);
    expect(tab1Row.putAwayAt).not.toBeNull();
    const again = await f
      .http()
      .post(`/api/areas/${tabsArea.body.id}/tabs`)
      .set(f.as(chloe.token))
      .send({});
    expect([again.status, again.body.tabNumber, again.body.label]).toEqual([201, 1, 'Tab 1']);

    // Table 5's party moves to table 14 (free); a move onto a taken table is refused.
    expect(
      (
        await f
          .http()
          .post(`/api/tables/${await tableId('5')}/move`)
          .set(f.as(sup))
          .send({ toTableId: await tableId('1') })
      ).status,
    ).toBe(409);
    const mv = await f
      .http()
      .post(`/api/tables/${await tableId('5')}/move`)
      .set(f.as(sup))
      .send({ toTableId: await tableId('14') });
    expect(mv.status).toBe(200);
    expect((await f.prisma.order.findUniqueOrThrow({ where: { id: o5 } })).tableId).toBe(
      await tableId('14'),
    );
    expect((await tableRow('5')).status).toBe('AVAILABLE');
    expect((await tableRow('14')).status).toBe('OCCUPIED');

    // Tables 7 and 8 joined into one bill, then split again.
    const total7 = (await f.prisma.order.findUniqueOrThrow({ where: { id: o7 } })).total.toString();
    const total8 = (await f.prisma.order.findUniqueOrThrow({ where: { id: o8 } })).total.toString();
    const jn = await f
      .http()
      .post(`/api/tables/${await tableId('7')}/join`)
      .set(f.as(sup))
      .send({ tableId: await tableId('8') });
    expect(jn.status).toBe(200);
    expect(jn.body.total).toBe(String(Number(total7) + Number(total8)));
    expect((await tableRow('8')).joinedToTableId).toBe(await tableId('7'));
    expect((await tableRow('8')).status).toBe('OCCUPIED');
    const sp = await f
      .http()
      .post(`/api/tables/${await tableId('7')}/split`)
      .set(f.as(sup))
      .send({ tableId: await tableId('8') });
    expect(sp.status).toBe(200);
    expect(sp.body.linesMovedBack).toBe(2);
    expect((await f.prisma.order.findUniqueOrThrow({ where: { id: o7 } })).total.toString()).toBe(
      total7,
    );
    const back8 = await f.prisma.order.findUniqueOrThrow({ where: { id: sp.body.otherOrderId } });
    expect([back8.tableId, back8.total.toString(), back8.status]).toEqual([
      await tableId('8'),
      total8,
      'SENT',
    ]);
    expect((await tableRow('8')).joinedToTableId).toBeNull();

    // One line moved: the chips from table 3 go to table 20, which is free, on a new bill.
    const chipsLine = await f.prisma.orderItem.findFirstOrThrow({
      where: { orderId: o3, menuItemId: chips.id },
    });
    const ml = await f
      .http()
      .post(`/api/pos/orders/${o3}/lines/${chipsLine.id}/move`)
      .set(f.as(sup))
      .send({ toTableId: await tableId('20') });
    expect(ml.status).toBe(200);
    expect((await f.prisma.order.findUniqueOrThrow({ where: { id: o3 } })).total.toString()).toBe(
      '28000',
    );
    const o20 = await f.prisma.order.findUniqueOrThrow({ where: { id: ml.body.toOrderId } });
    expect([o20.tableId, o20.total.toString()]).toEqual([await tableId('20'), '8000']);
    expect((await tableRow('20')).status).toBe('OCCUPIED');

    // Asha cannot end her shift with six open tables; she hands all of them to Chloe.
    const early = await f
      .http()
      .post(`/api/shifts/${ashaShift}/close`)
      .set(f.as(asha.token))
      .send({});
    expect(early.status).toBe(409);
    expect(JSON.stringify(early.body)).toContain('OPEN_TABLES');
    const offer = await f
      .http()
      .post('/api/handovers')
      .set(f.as(asha.token))
      .send({ toUserId: chloe.id, all: true });
    expect(offer.status).toBe(201);
    expect(offer.body.tableIds).toHaveLength(6);
    expect(
      (await f.http().post(`/api/handovers/${offer.body.id}/accept`).set(f.as(bosco.token))).status,
    ).toBe(403);
    const inbox = await f.http().get('/api/handovers').set(f.as(chloe.token));
    expect(inbox.body.incoming.map((h: any) => h.tables.map((t: any) => t.label).sort())).toEqual([
      [...ashaTables].sort(),
    ]);
    const ok = await f.http().post(`/api/handovers/${offer.body.id}/accept`).set(f.as(chloe.token));
    expect([ok.status, ok.body.status, ok.body.orderIds.length]).toEqual([200, 'ACCEPTED', 6]);
    expect(
      (await f.http().post(`/api/handovers/${offer.body.id}/accept`).set(f.as(chloe.token))).status,
    ).toBe(409);
    const ids = await Promise.all(ashaTables.map(tableId));
    expect(
      await f.prisma.order.count({
        where: { tableId: { in: ids }, status: { notIn: ['CLOSED', 'VOIDED'] }, userId: chloe.id },
      }),
    ).toBe(6);
    const closeShift = await f
      .http()
      .post(`/api/shifts/${ashaShift}/close`)
      .set(f.as(asha.token))
      .send({});
    expect(closeShift.status).toBe(200);

    // Every action wrote an audit row.
    const actions = await f.prisma.auditLog.groupBy({
      by: ['action'],
      where: { metadata: { path: ['branchId'], equals: f.branchId } },
      _count: true,
    });
    const count = Object.fromEntries(actions.map((a) => [a.action, a._count]));
    expect(count).toMatchObject({
      AREA_CREATED: 5,
      TABLES_BULK_ADDED: 5,
      TAB_OPENED: 31,
      TABLE_MOVED: 1,
      TABLES_JOINED: 1,
      TABLES_SPLIT: 1,
      ORDER_LINE_MOVED: 1,
      TABLE_HANDOVER_OFFERED: 1,
      TABLE_HANDOVER_ACCEPTED: 1,
    });
    list = await f.http().get('/api/areas').set(f.as(asha.token));
    expect(list.body.areas.find((a: any) => a.name === 'Garden').tables).toHaveLength(23);
  }, 240000);

  it('put away: a table with an open order is refused; an empty tab can be put away by a waiter', async () => {
    const a = await f
      .http()
      .post('/api/areas')
      .set(f.as(f.tokens.manager))
      .send({ name: `Spare ${w.run}` });
    const b = await f
      .http()
      .post(`/api/areas/${a.body.id}/tables`)
      .set(f.as(f.tokens.manager))
      .send({ count: 2, firstNumber: 500, seats: 2 });
    const [t500, t501] = b.body.tables;
    const item = await makeItem(f, 'Friday soda', 3000, 'BAR');
    const o = await openOrder(f, bosco.token, t500.id);
    await addLine(f, bosco.token, o, item.id);
    expect((await send(f, bosco.token, o)).status).toBe(200);
    expect(
      (await f.http().post(`/api/tables/${t500.id}/put-away`).set(f.as(f.tokens.supervisor)))
        .status,
    ).toBe(409);
    expect(
      (await f.http().post(`/api/areas/${a.body.id}/put-away`).set(f.as(f.tokens.supervisor)))
        .status,
    ).toBe(409);
    const pa = await f
      .http()
      .post(`/api/tables/${t501.id}/put-away`)
      .set(f.as(f.tokens.supervisor));
    expect([pa.status, pa.body.isActive]).toEqual([200, false]);
    expect(await f.prisma.table.count({ where: { id: t501.id } })).toBe(1); // never deleted
    const seats = await f
      .http()
      .patch(`/api/tables/${t500.id}/seats`)
      .set(f.as(f.tokens.supervisor))
      .send({ seats: 6 });
    expect([seats.status, seats.body.capacity]).toEqual([200, 6]);

    const tabs = await f.prisma.area.findFirstOrThrow({
      where: { branchId: f.branchId, kind: 'TABS' },
    });
    const tab = await f
      .http()
      .post(`/api/areas/${tabs.id}/tabs`)
      .set(f.as(bosco.token))
      .send({ note: 'red cap at the bar' });
    expect(tab.body.tabNote).toBe('red cap at the bar');
    const gone = await f.http().post(`/api/tabs/${tab.body.id}/put-away`).set(f.as(bosco.token));
    expect([gone.status, gone.body.isActive]).toEqual([200, false]);
  });

  it('change waiter is for a supervisor or manager; split by guest makes one bill per guest', async () => {
    const a = await f
      .http()
      .post('/api/areas')
      .set(f.as(f.tokens.manager))
      .send({ name: `Booths ${w.run}` });
    const b = await f
      .http()
      .post(`/api/areas/${a.body.id}/tables`)
      .set(f.as(f.tokens.manager))
      .send({ count: 1, firstNumber: 600, seats: 6 });
    const t = b.body.tables[0];
    const steak = await makeItem(f, 'Friday steak', 50000, 'KITCHEN');
    const wine = await makeItem(f, 'Friday wine', 20000, 'BAR');
    const o = await openOrder(f, bosco.token, t.id);
    await addLine(f, bosco.token, o, steak.id, 1, { guest: 1 });
    await addLine(f, bosco.token, o, wine.id, 1, { guest: 1 });
    await addLine(f, bosco.token, o, steak.id, 1, { guest: 2 });
    await addLine(f, bosco.token, o, wine.id, 2, { guest: 3 });
    expect((await send(f, bosco.token, o)).status).toBe(200);

    expect(
      (
        await f
          .http()
          .post(`/api/tables/${t.id}/change-waiter`)
          .set(f.as(bosco.token))
          .send({ toUserId: chloe.id })
      ).status,
    ).toBe(403);
    const cw = await f
      .http()
      .post(`/api/tables/${t.id}/change-waiter`)
      .set(f.as(f.tokens.supervisor))
      .send({ toUserId: chloe.id });
    expect(cw.status).toBe(200);
    expect((await f.prisma.order.findUniqueOrThrow({ where: { id: o } })).userId).toBe(chloe.id);

    const sg = await f
      .http()
      .post(`/api/pos/orders/${o}/split-by-guest`)
      .set(f.as(f.tokens.supervisor));
    expect(sg.status).toBe(200);
    expect(sg.body.total).toBe('70000');
    expect(sg.body.children.map((c: any) => [c.guest, c.total])).toEqual([
      [2, '50000'],
      [3, '40000'],
    ]);
    // Evenly and by amount use the existing split-bill; it still answers on the guest-1 bill.
    const even = await f
      .http()
      .post(`/api/pos/orders/${o}/split-bill`)
      .set(f.as(f.tokens.supervisor))
      .send({ mode: 'EQUAL', count: 2 });
    expect(even.status).toBe(200);
  });

  it('races: two parties moved onto one free table at once, and two bulk adds of the same numbers', async () => {
    const a = await f
      .http()
      .post('/api/areas')
      .set(f.as(f.tokens.manager))
      .send({ name: `Race ${w.run}` });
    const b = await f
      .http()
      .post(`/api/areas/${a.body.id}/tables`)
      .set(f.as(f.tokens.manager))
      .send({ count: 3, firstNumber: 700, seats: 4 });
    const [x, y, free] = b.body.tables;
    const item = await makeItem(f, 'Race pilau', 15000, 'KITCHEN');
    for (const t of [x, y]) {
      const o = await openOrder(f, bosco.token, t.id);
      await addLine(f, bosco.token, o, item.id);
      expect((await send(f, bosco.token, o)).status).toBe(200);
    }
    for (let round = 0; round < 5; round++) {
      const [m1, m2] = await Promise.all([
        f
          .http()
          .post(`/api/tables/${x.id}/move`)
          .set(f.as(f.tokens.supervisor))
          .send({ toTableId: free.id }),
        f
          .http()
          .post(`/api/tables/${y.id}/move`)
          .set(f.as(f.tokens.manager))
          .send({ toTableId: free.id }),
      ]);
      expect([m1.status, m2.status].sort()).toEqual([200, 409]);
      expect(
        await f.prisma.order.count({
          where: { tableId: free.id, status: { notIn: ['CLOSED', 'VOIDED'] } },
        }),
      ).toBe(1);
      // put the winner back for the next round
      const winnerFrom = m1.status === 200 ? x : y;
      expect(
        (
          await f
            .http()
            .post(`/api/tables/${free.id}/move`)
            .set(f.as(f.tokens.supervisor))
            .send({ toTableId: winnerFrom.id })
        ).status,
      ).toBe(200);
    }
    const [p1, p2] = await Promise.all([
      f
        .http()
        .post(`/api/areas/${a.body.id}/tables`)
        .set(f.as(f.tokens.manager))
        .send({ count: 5, firstNumber: 800, seats: 2 }),
      f
        .http()
        .post(`/api/areas/${a.body.id}/tables`)
        .set(f.as(f.tokens.supervisor))
        .send({ count: 5, firstNumber: 803, seats: 2 }),
    ]);
    expect([p1.status, p2.status].sort()).toEqual([201, 409]);
    expect(
      await f.prisma.table.count({
        where: {
          branchId: f.branchId,
          label: { in: ['800', '801', '802', '803', '804', '805', '806', '807'] },
        },
      }),
    ).toBe(5);
  });

  it('a booked table joined onto another, then paid: the booking completes, never left seated', async () => {
    const a = await f
      .http()
      .post('/api/areas')
      .set(f.as(f.tokens.manager))
      .send({ name: `Booked ${w.run}` });
    const b = await f
      .http()
      .post(`/api/areas/${a.body.id}/tables`)
      .set(f.as(f.tokens.manager))
      .send({ count: 2, firstNumber: 900, seats: 4 });
    const [host, booked] = b.body.tables;
    const item = await makeItem(f, 'Booked matoke', 12000, 'KITCHEN');
    const r = await f
      .http()
      .post('/api/reservations')
      .set(f.as(f.tokens.owner))
      .send({
        customerName: 'Party of four',
        partySize: 4,
        reservationAt: new Date(Date.now() + 3600_000).toISOString(),
        source: 'PHONE',
      });
    expect(r.status).toBe(201);
    await f
      .http()
      .patch(`/api/reservations/${r.body.id}/confirm`)
      .set(f.as(f.tokens.owner))
      .send({});
    const seated = await f
      .http()
      .patch(`/api/reservations/${r.body.id}/seat`)
      .set(f.as(f.tokens.owner))
      .send({ tableId: booked.id, createOrder: true });
    expect(seated.status).toBe(200);
    const bookedOrder = seated.body.seatedOrderId;
    await addLine(f, f.tokens.owner, bookedOrder, item.id);
    expect((await send(f, f.tokens.owner, bookedOrder)).status).toBe(200);
    const hostOrder = await openOrder(f, f.tokens.owner, host.id);
    await addLine(f, f.tokens.owner, hostOrder, item.id);
    expect((await send(f, f.tokens.owner, hostOrder)).status).toBe(200);

    const jn = await f
      .http()
      .post(`/api/tables/${host.id}/join`)
      .set(f.as(f.tokens.supervisor))
      .send({ tableId: booked.id });
    expect([jn.status, jn.body.total]).toEqual([200, '24000']);
    expect(
      (await f.prisma.reservation.findUniqueOrThrow({ where: { id: r.body.id } })).seatedOrderId,
    ).toBe(hostOrder);
    const paid = await f
      .http()
      .post(`/api/pos/orders/${hostOrder}/close`)
      .set(f.as(f.tokens.owner))
      .send({ payments: [{ method: 'CASH', amount: '24000' }] });
    expect(paid.status).toBe(200);
    expect(
      (await f.prisma.reservation.findUniqueOrThrow({ where: { id: r.body.id } })).status,
    ).toBe('COMPLETED');
    const tables = await f.prisma.table.findMany({
      where: { id: { in: [host.id, booked.id] } },
      orderBy: { label: 'asc' },
    });
    expect(tables.map((t) => [t.status, t.joinedToTableId])).toEqual([
      ['AVAILABLE', null],
      ['AVAILABLE', null],
    ]);
  });
});
