// T6 phase 5 — real case "Twelve buns short": the kitchen falls below its minimum, the request is
// suggested and sent, 36 are issued, 24 received; the gap is on the trip, the store keeper and the
// manager can see it, and a count closes it. Then deliveries (with and without an order) and the
// moving average cost, To buy, and a blind count with the limit and the manager's note.
// Fictional cast; buns at UGX 800 each, packs of 12.
import { Decimal } from '@prisma/client/runtime/library';
import { bootWorld, T2World, makeItem, makeTable, ensureShift } from './support/t2-helpers';
import { makeEmployee, givePin } from './support/t6-helpers';

jest.setTimeout(180000);

let w: T2World;
type Staff = Awaited<ReturnType<typeof makeEmployee>>;
let manager: Staff;
let chef: Staff;
let keeper: Staff;
let waiter: Staff;
let supervisor: Staff;
let accountant: Staff;
let chefPin: string;
let keeperPin: string;
let bun: string;
let mainId: string;
let kitchenId: string;
let basketId: string;
let tableId: string;
let tripId: string;

const http = () => w.http();
const PIECE = 1000;

async function level(storeId: string) {
  const r = await http().get('/api/stock/levels').set(w.as(manager.token));
  return (
    r.body.levels.find((l: any) => l.storeId === storeId && l.inventoryItemId === bun)?.onHand ?? 0
  );
}
async function sellBuns(n: number) {
  const o = await http()
    .post('/api/pos/orders')
    .set(w.as(waiter.token))
    .send({ serviceType: 'DINE_IN', tableId });
  const a = await http()
    .post(`/api/pos/orders/${o.body.id}/items`)
    .set(w.as(waiter.token))
    .send({ menuItemId: basketId, quantity: n });
  expect(a.status).toBe(201);
  expect(
    (await http().post(`/api/pos/orders/${o.body.id}/send`).set(w.as(waiter.token)).send({}))
      .status,
  ).toBeLessThan(300);
  const line = await w.prisma.orderItem.findFirstOrThrow({ where: { orderId: o.body.id } });
  for (let i = 0; i < 60; i++) {
    if ((await w.prisma.stockMovement.count({ where: { orderItemId: line.id, type: 'SALE' } })) > 0)
      return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('no SALE row');
}

beforeAll(async () => {
  w = await bootWorld();
  manager = await makeEmployee(w, 'Manager', 'Sarah');
  chef = await makeEmployee(w, 'Chef', 'Tom');
  keeper = await makeEmployee(w, 'Stock Manager', 'Umar');
  waiter = await makeEmployee(w, 'Waiter', 'Vicky');
  supervisor = await makeEmployee(w, 'Supervisor', 'Wasswa');
  accountant = await makeEmployee(w, 'Accountant', 'Xenia');
  chefPin = await givePin(w, chef.userId);
  keeperPin = await givePin(w, keeper.userId);
  await ensureShift(w, waiter.token);
  tableId = (await makeTable(w, 'T6B')).id;

  const c = await http()
    .post('/api/inventory/items')
    .set(w.as(manager.token))
    .send({ name: `Burger bun ${w.run}`, unit: 'piece', theoreticalUnitCost: '800' });
  bun = c.body.id;
  await http()
    .patch(`/api/stock/items/${bun}`)
    .set(w.as(manager.token))
    .send({ stockKind: 'COUNT', packSize: 12 * PIECE });
  await http()
    .put(`/api/stock/items/${bun}/cost`)
    .set(w.as(manager.token))
    .send({ unitCost: '800' });

  const stores = await http().get('/api/stores').set(w.as(manager.token));
  mainId = stores.body.stores.find((s: any) => s.kind === 'MAIN').id;
  const k = await http()
    .post('/api/stores')
    .set(w.as(manager.token))
    .send({ name: `Kitchen store ${w.run}`, kind: 'POINT' });
  expect([k.status, k.body.feedsFromStoreId]).toEqual([201, mainId]);
  kitchenId = k.body.id;
  expect(
    (
      await http()
        .put('/api/stores/stations/KITCHEN')
        .set(w.as(manager.token))
        .send({ storeId: kitchenId })
    ).status,
  ).toBe(200);

  for (const [storeId, amount] of [
    [mainId, '100'],
    [kitchenId, '13'],
  ]) {
    expect(
      (
        await http()
          .post('/api/stock/opening')
          .set(w.as(manager.token))
          .send({ inventoryItemId: bun, amount, unit: 'piece', storeId })
      ).status,
    ).toBe(201);
  }
  expect(
    (
      await http()
        .put(`/api/stores/${kitchenId}/levels/${bun}`)
        .set(w.as(keeper.token))
        .send({ minimum: '12', fillTo: '36', unit: 'piece' })
    ).status,
  ).toBe(200);
  expect(
    (
      await http()
        .put(`/api/stores/${mainId}/levels/${bun}`)
        .set(w.as(keeper.token))
        .send({ minimum: '80', fillTo: '150', unit: 'piece' })
    ).status,
  ).toBe(200);

  basketId = (await makeItem(w, 'Bun basket', 3000, 'KITCHEN')).id;
  expect(
    (
      await http()
        .patch(`/api/menu/items/${basketId}/sold-as`)
        .set(w.as(manager.token))
        .send({ soldAs: 'AS_BOUGHT', stockItemId: bun })
    ).status,
  ).toBe(200);
});
afterAll(async () => w?.app.close());

describe('Twelve buns short (T6 phase 5)', () => {
  it('two buns sold at the kitchen: they leave the kitchen store, which falls below its minimum of 12', async () => {
    await sellBuns(2);
    expect(await level(kitchenId)).toBe(11 * PIECE);
    expect(await level(mainId)).toBe(100 * PIECE);
  });

  it('the suggested request is 36: fill to 36 from 11 is 25, rounded up to whole packs of 12', async () => {
    const s = await http().get(`/api/stores/${kitchenId}/suggestion`).set(w.as(chef.token));
    expect(s.body.lines).toHaveLength(1);
    expect(s.body.lines[0]).toMatchObject({
      onHand: 11000,
      minimum: 12000,
      fillTo: 36000,
      need: 25000,
      amount: 36000,
    });
  });

  it('the chef sends the suggestion; a supervisor and a waiter may not ask', async () => {
    for (const t of [supervisor.token, waiter.token]) {
      expect(
        (
          await http()
            .post('/api/store-requests')
            .set(w.as(t))
            .send({ toStoreId: kitchenId, fromSuggestion: true })
        ).status,
      ).toBe(403);
    }
    const r = await http()
      .post('/api/store-requests')
      .set(w.as(chef.token))
      .send({ toStoreId: kitchenId, fromSuggestion: true });
    expect([r.status, r.body.status, r.body.suggested, r.body.fromStoreId]).toEqual([
      201,
      'REQUESTED',
      true,
      mainId,
    ]);
    expect(r.body.lines[0].requested).toBe(36000);
    tripId = r.body.id;
  });

  it('the store keeper sees it and issues 36: they leave the main store and are on their way', async () => {
    const waiting = await http()
      .get('/api/store-requests?status=REQUESTED')
      .set(w.as(keeper.token));
    expect(waiting.body.data.map((x: any) => x.id)).toContain(tripId);
    expect(
      (await http().post(`/api/store-requests/${tripId}/issue`).set(w.as(chef.token)).send({}))
        .status,
    ).toBe(403);
    const i = await http()
      .post(`/api/store-requests/${tripId}/issue`)
      .set(w.as(keeper.token))
      .send({});
    expect([i.status, i.body.status, i.body.lines[0].issued]).toEqual([200, 'ISSUED', 36000]);
    expect(await level(mainId)).toBe(64 * PIECE);
    const out = await w.prisma.stockMovement.findFirstOrThrow({
      where: { refId: tripId, type: 'ISSUE_OUT' },
    });
    expect([out.amount, out.value.toString()]).toEqual([-36000, '-28800']);
    // On its way: the suggestion no longer asks for more.
    const s = await http().get(`/api/stores/${kitchenId}/suggestion`).set(w.as(chef.token));
    expect(s.body.lines).toHaveLength(0);
  });

  it('24 arrive: the chef receives with her own PIN; the 12 short stay on the trip as UGX 9,600', async () => {
    const line = (
      await w.prisma.storeRequestLine.findFirstOrThrow({ where: { requestId: tripId } })
    ).id;
    const body = { lines: [{ lineId: line, amount: '24', unit: 'piece' }] };
    expect(
      (
        await http()
          .post(`/api/store-requests/${tripId}/receive`)
          .set(w.as(chef.token))
          .send({ ...body, pin: '00000001' })
      ).status,
    ).toBe(401);
    const byKeeper = await http()
      .post(`/api/store-requests/${tripId}/receive`)
      .set(w.as(chef.token))
      .send({ ...body, pin: keeperPin });
    expect([byKeeper.status, byKeeper.body.code]).toEqual([403, 'NOT_A_RECEIVER']);
    const r = await http()
      .post(`/api/store-requests/${tripId}/receive`)
      .set(w.as(chef.token))
      .send({ ...body, pin: chefPin });
    expect(r.status).toBe(200);
    expect([r.body.status, r.body.receivedById]).toEqual(['RECEIVED_SHORT', chef.userId]);
    expect(r.body.lines[0]).toMatchObject({
      issued: 36000,
      received: 24000,
      shortBy: 12000,
      shortValue: '9600',
    });
    expect(await level(kitchenId)).toBe(35 * PIECE);
    const inn = await w.prisma.stockMovement.findFirstOrThrow({
      where: { refId: tripId, type: 'ISSUE_IN' },
    });
    expect([inn.amount, inn.value.toString()]).toEqual([24000, '19200']);
    // Received twice is refused.
    expect(
      (
        await http()
          .post(`/api/store-requests/${tripId}/receive`)
          .set(w.as(chef.token))
          .send({ ...body, pin: chefPin })
      ).status,
    ).toBe(409);
  });

  it('the store keeper and the manager both see the open loss', async () => {
    for (const t of [keeper.token, manager.token]) {
      const r = await http().get('/api/store-requests?losses=open').set(w.as(t));
      const trip = r.body.data.find((x: any) => x.id === tripId);
      expect(trip).toBeDefined();
      expect(trip.transitLoss).toBe('9600.00');
    }
  });

  it('the main store is below its minimum: To buy says 96 (to 150 from 64 is 86, in packs of 12)', async () => {
    expect((await http().get('/api/to-buy').set(w.as(waiter.token))).status).toBe(403);
    const r = await http().get('/api/to-buy').set(w.as(keeper.token));
    expect(r.body.lines[0]).toMatchObject({ inventoryItemId: bun, onHand: 64000, amount: 96000 });
  });

  it('a blind count of the kitchen closes the trip; selling goes on while it is open', async () => {
    const c = await http()
      .post('/api/stock-counts')
      .set(w.as(keeper.token))
      .send({ storeId: kitchenId, kind: 'SPOT', inventoryItemIds: [bun] });
    expect([c.status, c.body.blind]).toEqual([201, true]);
    expect('bookAtSave' in c.body.lines[0]).toBe(false);
    // A bun is sold while the count is open: nothing waits for the count.
    await sellBuns(1);
    expect(await level(kitchenId)).toBe(34 * PIECE);
    const saved = await http()
      .put(`/api/stock-counts/${c.body.id}/lines/${bun}`)
      .set(w.as(keeper.token))
      .send({ amount: '34', unit: 'piece' });
    expect(saved.status).toBe(200);
    expect('difference' in saved.body.lines[0]).toBe(false); // still blind to the counter
    const asMgr = await http().get(`/api/stock-counts/${c.body.id}`).set(w.as(manager.token));
    expect(asMgr.body.lines[0]).toMatchObject({ counted: 34000, bookAtSave: 34000, difference: 0 });
    const closed = await http()
      .post(`/api/stock-counts/${c.body.id}/close`)
      .set(w.as(keeper.token))
      .send({});
    expect([closed.status, closed.body.status]).toEqual([200, 'CLOSED']);
    expect(closed.body.closedTrips).toEqual([tripId]);
    const open = await http().get('/api/store-requests?losses=open').set(w.as(manager.token));
    expect(open.body.data.map((x: any) => x.id)).not.toContain(tripId);
    const trip = await w.prisma.storeRequest.findUniqueOrThrow({ where: { id: tripId } });
    expect(trip.resolvedByCountId).toBe(c.body.id);
  });
});

describe("Counts: the limit and the manager's note (T6 phase 5)", () => {
  it('a difference above UGX 20,000 cannot close until the manager writes a note; then it adjusts the books', async () => {
    const c = await http()
      .post('/api/stock-counts')
      .set(w.as(keeper.token))
      .send({ storeId: mainId, kind: 'FULL', inventoryItemIds: [bun] });
    await http()
      .put(`/api/stock-counts/${c.body.id}/lines/${bun}`)
      .set(w.as(keeper.token))
      .send({ amount: '30', unit: 'piece' });
    const no = await http()
      .post(`/api/stock-counts/${c.body.id}/close`)
      .set(w.as(keeper.token))
      .send({});
    expect([no.status, no.body.code]).toEqual([409, 'NEEDS_MANAGER_NOTE']);
    expect(no.body.lines[0]).toMatchObject({
      inventoryItemId: bun,
      value: '-27200.00',
      limit: '20000.00',
    });
    expect(
      (
        await http()
          .post(`/api/stock-counts/${c.body.id}/manager-note`)
          .set(w.as(keeper.token))
          .send({ note: 'x' })
      ).status,
    ).toBe(403);
    expect(
      (
        await http()
          .post(`/api/stock-counts/${c.body.id}/manager-note`)
          .set(w.as(manager.token))
          .send({ note: 'Crate found broken; supplier called' })
      ).status,
    ).toBe(200);
    const ok = await http()
      .post(`/api/stock-counts/${c.body.id}/close`)
      .set(w.as(keeper.token))
      .send({});
    expect(ok.status).toBe(200);
    const adj = await w.prisma.stockMovement.findFirstOrThrow({
      where: { refId: c.body.id, type: 'COUNT_ADJUST' },
    });
    expect([adj.amount, adj.value.toString(), adj.approvedById]).toEqual([
      -34000,
      '-27200',
      manager.userId,
    ]);
    expect(await level(mainId)).toBe(30 * PIECE);
  });
});

describe('Deliveries and the average cost (T6 phase 5)', () => {
  let poId: string;

  it('the manager orders 96 buns at UGX 850; they arrive in full; the average moves exactly', async () => {
    expect(
      (
        await http()
          .post('/api/purchase-orders')
          .set(w.as(keeper.token))
          .send({
            supplierName: 'Fictional Bakery',
            lines: [{ inventoryItemId: bun, amount: '96', unit: 'piece', expectedUnitCost: '850' }],
          })
      ).status,
    ).toBe(403);
    const po = await http()
      .post('/api/purchase-orders')
      .set(w.as(manager.token))
      .send({
        supplierName: 'Fictional Bakery',
        lines: [{ inventoryItemId: bun, amount: '96', unit: 'piece', expectedUnitCost: '850' }],
      });
    expect(po.status).toBe(201);
    poId = po.body.id;
    // On order counts: from 30 (after the count) to 150 is 120, less 96 on order = 24.
    const tb = await http().get('/api/to-buy').set(w.as(keeper.token));
    expect(tb.body.lines[0]).toMatchObject({ onHand: 30000, onOrder: 96000, amount: 24000 });

    const before = await w.prisma.inventoryItem.findUniqueOrThrow({ where: { id: bun } });
    const onHand = (
      await w.prisma.storeLevel.aggregate({
        where: { inventoryItemId: bun },
        _sum: { onHand: true },
      })
    )._sum.onHand!;
    const d = await http()
      .post('/api/deliveries')
      .set(w.as(keeper.token))
      .send({
        purchaseOrderId: poId,
        lines: [{ inventoryItemId: bun, amount: '96', unit: 'piece', unitCost: '850' }],
      });
    expect(d.status).toBe(201);
    expect(d.body.lines[0]).toMatchObject({ outcome: 'FULL', costChanged: false });
    const expected = new Decimal(before.costPerBase)
      .mul(onHand)
      .add(new Decimal('0.85').mul(96000))
      .div(onHand + 96000)
      .toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
    const after = await w.prisma.inventoryItem.findUniqueOrThrow({ where: { id: bun } });
    expect(after.costPerBase.toString()).toBe(expected.toString());
    const recv = await w.prisma.stockMovement.findFirstOrThrow({
      where: { refId: d.body.id, type: 'RECEIVE' },
    });
    expect([recv.amount, recv.unitCost.toString(), recv.value.toString()]).toEqual([
      96000,
      '0.85',
      '81600',
    ]);
  });

  it("a delivery with no order, priced more than 10% above the average, goes on the accountant's Cost changed list", async () => {
    const d = await http()
      .post('/api/deliveries')
      .set(w.as(keeper.token))
      .send({
        supplierName: 'Corner shop',
        lines: [{ inventoryItemId: bun, amount: '24', unit: 'piece', unitCost: '1000' }],
      });
    expect(d.status).toBe(201);
    expect(d.body.lines[0].outcome).toBe('NO_ORDER,PRICE_DIFFERS');
    expect(d.body.lines[0].costChanged).toBe(true);
    const list = await http().get('/api/cost-changes').set(w.as(accountant.token));
    expect(list.status).toBe(200);
    expect(list.body.data.map((x: any) => x.id)).toContain(d.body.lines[0].id);
    expect((await http().get('/api/cost-changes').set(w.as(keeper.token))).status).toBe(403);
  });

  it("every store's level is the sum of its ledger rows", async () => {
    for (const storeId of [mainId, kitchenId]) {
      const sum = (
        await w.prisma.stockMovement.aggregate({
          where: { storeId, inventoryItemId: bun },
          _sum: { amount: true },
        })
      )._sum.amount;
      expect(await level(storeId)).toBe(sum);
    }
  });
});

describe('Two people at once (T6 phase 5)', () => {
  it('two store keepers issue the same request at once: one issue, one ISSUE_OUT row', async () => {
    const keeper2 = await makeEmployee(w, 'Stock Manager', 'Yusuf');
    const r = await http()
      .post('/api/store-requests')
      .set(w.as(chef.token))
      .send({
        toStoreId: kitchenId,
        lines: [{ inventoryItemId: bun, amount: '12', unit: 'piece' }],
      });
    const both = await Promise.all(
      [keeper.token, keeper2.token].map((t) =>
        http().post(`/api/store-requests/${r.body.id}/issue`).set(w.as(t)).send({}),
      ),
    );
    expect(both.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(
      await w.prisma.stockMovement.count({ where: { refId: r.body.id, type: 'ISSUE_OUT' } }),
    ).toBe(1);
  });
});
