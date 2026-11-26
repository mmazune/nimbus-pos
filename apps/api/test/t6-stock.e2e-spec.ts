// T6 phase 4 — real case "A burger takes 150 g of mince".
// The recipe is the one drawn on Manager-Item (design/screens/html/Manager-Item.html): beef mince
// 150 g (UGX 2,700), bun 1 (800), cheese slice 1 (600), lettuce 20 g (100), tomato 30 g (150),
// cooking oil 10 ml (90), frozen chips 180 g (1,260): UGX 5,700 to make one. One burger sent, one
// voided as not made, one remade, 1.5 kg of mince taken out as spoiled; each with its ledger row
// and cost. Fictional cast; figures from the drawing.
import { bootWorld, T2World, makeItem, makeTable, ensureShift } from './support/t2-helpers';
import { makeEmployee, givePin } from './support/t6-helpers';
import { StockService } from '../src/modules/stock/stock.service';

jest.setTimeout(180000);

let w: T2World;
type Staff = Awaited<ReturnType<typeof makeEmployee>>;
let manager: Staff;
let waiter: Staff;
let chef: Staff;
let supervisor: Staff;
let supPin: string;
let burgerId: string;
let doubleServingId: string;
let tableId: string;
const inv: Record<string, string> = {};

// name, unit typed on the recipe, kind, cost per display unit (kg, L or piece), recipe amount
const RECIPE = [
  ['Beef mince', 'g', 'WEIGHT', '18000', '150'],
  ['Burger bun', 'piece', 'COUNT', '800', '1'],
  ['Cheese slice', 'piece', 'COUNT', '600', '1'],
  ['Lettuce', 'g', 'WEIGHT', '5000', '20'],
  ['Tomato', 'g', 'WEIGHT', '5000', '30'],
  ['Cooking oil', 'ml', 'VOLUME', '9000', '10'],
  ['Chips, frozen', 'g', 'WEIGHT', '7000', '180'],
] as const;
const OPENING: Record<string, [string, string]> = {
  'Beef mince': ['10', 'kg'],
  'Burger bun': ['48', 'piece'],
  'Cheese slice': ['0', 'piece'], // none in stock: a sale is still allowed (R18)
  Lettuce: ['2', 'kg'],
  Tomato: ['3', 'kg'],
  'Cooking oil': ['5', 'L'],
  'Chips, frozen': ['20', 'kg'],
};

const http = () => w.http();
async function rowsFor(orderItemId: string, type: string, n: number) {
  for (let i = 0; i < 60; i++) {
    const r = await http()
      .get(`/api/stock/movements?orderItemId=${orderItemId}&type=${type}`)
      .set(w.as(manager.token));
    if (r.body.data.length >= n) return r.body.data;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error(`no ${type} rows for ${orderItemId}`);
}
async function onHand(name: string) {
  const r = await http().get('/api/stock/levels').set(w.as(manager.token));
  return r.body.levels.find((l: any) => l.inventoryItemId === inv[name])?.onHand ?? 0;
}
async function ledgerSum(name: string) {
  const rows = await w.prisma.stockMovement.findMany({ where: { inventoryItemId: inv[name] } });
  return rows.reduce((s, r) => s + r.amount, 0);
}

beforeAll(async () => {
  w = await bootWorld();
  manager = await makeEmployee(w, 'Manager', 'Olivia');
  waiter = await makeEmployee(w, 'Waiter', 'Peter');
  chef = await makeEmployee(w, 'Chef', 'Queen');
  supervisor = await makeEmployee(w, 'Supervisor', 'Ruth');
  supPin = await givePin(w, supervisor.userId);
  await ensureShift(w, waiter.token);
  tableId = (await makeTable(w, 'T6S')).id;

  for (const [name, unit, kind, cost] of RECIPE) {
    const c = await http()
      .post('/api/inventory/items')
      .set(w.as(manager.token))
      .send({
        name: `${name} ${w.run}`,
        unit,
        theoreticalUnitCost: (kind === 'COUNT' ? Number(cost) : Number(cost) / 1000).toString(),
      });
    expect(c.status).toBe(201);
    inv[name] = c.body.id;
    expect(
      (
        await http()
          .patch(`/api/stock/items/${c.body.id}`)
          .set(w.as(manager.token))
          .send({ stockKind: kind })
      ).status,
    ).toBe(200);
    expect(
      (
        await http()
          .put(`/api/stock/items/${c.body.id}/cost`)
          .set(w.as(manager.token))
          .send({ unitCost: cost })
      ).status,
    ).toBe(200);
    const [amount, ounit] = OPENING[name];
    if (amount !== '0') {
      expect(
        (
          await http()
            .post('/api/stock/opening')
            .set(w.as(manager.token))
            .send({ inventoryItemId: c.body.id, amount, unit: ounit })
        ).status,
      ).toBe(201);
    }
  }
  burgerId = (await makeItem(w, 'Beef burger', 28000, 'KITCHEN')).id;
  const dbl = await w.prisma.menuItemServing.create({
    data: {
      menuItemId: burgerId,
      format: 'DOUBLE',
      label: 'Double',
      price: 38000,
      isDefault: false,
    },
  });
  doubleServingId = dbl.id;
  const single = RECIPE.map(([name, unit, , , amt]) => ({
    inventoryItemId: inv[name],
    qtyPerUnit: amt,
    unit,
  }));
  const double = RECIPE.map(([name, unit, , , amt]) => ({
    inventoryItemId: inv[name],
    qtyPerUnit: name === 'Beef mince' ? '300' : name === 'Cheese slice' ? '2' : amt,
    unit,
    menuItemServingId: doubleServingId,
  }));
  const r = await http()
    .post(`/api/inventory/recipes/${burgerId}`)
    .set(w.as(manager.token))
    .send({ ingredients: [...single, ...double] });
  expect(r.status).toBeLessThan(300);
  const s = await http()
    .patch(`/api/menu/items/${burgerId}/sold-as`)
    .set(w.as(manager.token))
    .send({ soldAs: 'RECIPE' });
  expect([s.status, s.body.soldAs]).toEqual([200, 'RECIPE']);
});
afterAll(async () => w?.app.close());

async function sendBurger(orderId?: string, servingId?: string) {
  const id =
    orderId ??
    (
      await http()
        .post('/api/pos/orders')
        .set(w.as(waiter.token))
        .send({ serviceType: 'DINE_IN', tableId })
    ).body.id;
  const a = await http()
    .post(`/api/pos/orders/${id}/items`)
    .set(w.as(waiter.token))
    .send({
      menuItemId: burgerId,
      quantity: 1,
      ...(servingId ? { menuItemServingId: servingId } : {}),
    });
  expect(a.status).toBe(201);
  const s = await http().post(`/api/pos/orders/${id}/send`).set(w.as(waiter.token)).send({});
  expect(s.status).toBeLessThan(300);
  const lineId =
    (a.body.items ?? []).find?.((i: any) => i.menuItemId === burgerId && !i.sentAt)?.id ??
    a.body.item?.id ??
    a.body.id;
  const order = await http().get(`/api/pos/orders/${id}`).set(w.as(waiter.token));
  const line = order.body.items.filter((i: any) => i.menuItemId === burgerId).pop();
  return { orderId: id as string, lineId: (line?.id ?? lineId) as string };
}

describe('A burger takes 150 g of mince (T6 phase 4)', () => {
  let first: { orderId: string; lineId: string };

  it('one burger sent: seven ledger rows, 150 g of mince at UGX 2,700, UGX 5,700 in all', async () => {
    first = await sendBurger();
    const rows = await rowsFor(first.lineId, 'SALE', 7);
    expect(rows).toHaveLength(7);
    const mince = rows.find((r: any) => r.inventoryItemId === inv['Beef mince']);
    expect([mince.amount, mince.unitCost, mince.value]).toEqual([-150, '18', '-2700']);
    const total = rows.reduce((s: number, r: any) => s + Number(r.value), 0);
    expect(total).toBe(-5700);
    expect(await onHand('Beef mince')).toBe(10000 - 150);
  });

  it('a sale is never refused for lack of stock: the cheese goes below zero and the burger is still sent', async () => {
    expect(await onHand('Cheese slice')).toBe(-1000);
  });

  it('the same send heard twice (and at once) moves stock once', async () => {
    const svc = w.app.get(StockService);
    const ctx = { organizationId: w.orgId, branchId: w.branchId };
    const written = await Promise.all([
      svc.recordSale(ctx, [first.lineId]),
      svc.recordSale(ctx, [first.lineId]),
    ]);
    expect(written).toEqual([0, 0]);
    expect(
      await w.prisma.stockMovement.count({ where: { orderItemId: first.lineId, type: 'SALE' } }),
    ).toBe(7);
  });

  it('a second burger voided as "not made" puts its stock back', async () => {
    const second = await sendBurger(first.orderId);
    await rowsFor(second.lineId, 'SALE', 7);
    const v = await http()
      .post(`/api/pos/orders/${first.orderId}/items/${second.lineId}/void`)
      .set(w.as(supervisor.token))
      .send({ reason: 'GUEST_CHANGED_MIND', wasMade: false });
    expect(v.status).toBeLessThan(300);
    const back = await rowsFor(second.lineId, 'SALE_REVERSAL', 7);
    const mince = back.find((r: any) => r.inventoryItemId === inv['Beef mince']);
    expect([mince.amount, mince.value]).toEqual([150, '2700']);
    expect(await onHand('Beef mince')).toBe(10000 - 150);
  });

  it('a line voided as "made" gives nothing back', async () => {
    const third = await sendBurger(first.orderId);
    await rowsFor(third.lineId, 'SALE', 7);
    await http()
      .post(`/api/pos/orders/${first.orderId}/items/${third.lineId}/void`)
      .set(w.as(supervisor.token))
      .send({ reason: 'GUEST_COMPLAINT', wasMade: true });
    await new Promise((r) => setTimeout(r, 400));
    expect(
      await w.prisma.stockMovement.count({
        where: { orderItemId: third.lineId, type: 'SALE_REVERSAL' },
      }),
    ).toBe(0);
    expect(await onHand('Beef mince')).toBe(10000 - 300);
  });

  it('the chef remakes the first burger: its ingredients leave again as REMAKE', async () => {
    const r = await http()
      .post(`/api/pos/orders/${first.orderId}/lines/${first.lineId}/remake`)
      .set(w.as(chef.token))
      .send({ note: 'dropped on the pass' });
    expect(r.status).toBe(201);
    expect(r.body.movements).toHaveLength(7);
    const rows = await w.prisma.stockMovement.findMany({ where: { refId: r.body.remakeId } });
    const mince = rows.find((x) => x.inventoryItemId === inv['Beef mince'])!;
    expect([mince.type, mince.amount, mince.value.toString()]).toEqual(['REMAKE', -150, '-2700']);
    // A waiter cannot remake.
    expect(
      (
        await http()
          .post(`/api/pos/orders/${first.orderId}/lines/${first.lineId}/remake`)
          .set(w.as(waiter.token))
          .send({})
      ).status,
    ).toBe(403);
  });

  it('the chef takes 1.5 kg of mince out as spoiled: one WASTE row worth UGX 27,000, no PIN needed', async () => {
    const r = await http().post('/api/stock/take-out').set(w.as(chef.token)).send({
      inventoryItemId: inv['Beef mince'],
      amount: '1.5',
      unit: 'kg',
      reason: 'SPOILED_OR_EXPIRED',
      note: 'fridge door left open',
    });
    expect(r.status).toBe(201);
    expect([r.body.type, r.body.amount, r.body.reason, r.body.approvedById]).toEqual([
      'WASTE',
      -1500,
      'SPOILED_OR_EXPIRED',
      null,
    ]);
    const row = await w.prisma.stockMovement.findUniqueOrThrow({ where: { id: r.body.id } });
    expect([row.unitCost.toString(), row.value.toString()]).toEqual(['18', '-27000']);
    expect(await onHand('Beef mince')).toBe(10000 - 150 - 150 - 150 - 1500);
  });

  it('every level is the sum of its ledger rows', async () => {
    for (const [name] of RECIPE)
      expect([name, await onHand(name)]).toEqual([name, await ledgerSum(name)]);
    expect(await onHand('Beef mince')).toBe(8050);
  });
});

describe('Take out of stock: the limit, the PIN, the fixed reasons (T6 phase 4)', () => {
  it("above UGX 50,000 a chef needs a supervisor's PIN; with it the row records who confirmed", async () => {
    const big = {
      inventoryItemId: inv['Beef mince'],
      amount: '3',
      unit: 'kg',
      reason: 'BURNT_DROPPED_OR_BROKEN',
    };
    const no = await http().post('/api/stock/take-out').set(w.as(chef.token)).send(big);
    expect([no.status, no.body.code, no.body.value]).toEqual([
      403,
      'NEEDS_SUPERVISOR_PIN',
      '54000.00',
    ]);
    const wrong = await http()
      .post('/api/stock/take-out')
      .set(w.as(chef.token))
      .send({ ...big, supervisorPin: '00000001' });
    expect(wrong.status).toBe(401);
    const ok = await http()
      .post('/api/stock/take-out')
      .set(w.as(chef.token))
      .send({ ...big, supervisorPin: supPin });
    expect([ok.status, ok.body.approvedById, ok.body.type]).toEqual([
      201,
      supervisor.userId,
      'WASTE',
    ]);
    // A supervisor taking it out herself needs no one else.
    const sup = await http().post('/api/stock/take-out').set(w.as(supervisor.token)).send(big);
    expect([sup.status, sup.body.approvedById]).toEqual([201, null]);
  });

  it('a staff meal is its own type and says for whom; missing is its own type; we found more adds back', async () => {
    const noWho = await http().post('/api/stock/take-out').set(w.as(chef.token)).send({
      inventoryItemId: inv['Burger bun'],
      amount: '2',
      unit: 'piece',
      reason: 'STAFF_MEAL',
    });
    expect([noWho.status, noWho.body.code]).toEqual([400, 'FOR_WHOM']);
    const meal = await http().post('/api/stock/take-out').set(w.as(chef.token)).send({
      inventoryItemId: inv['Burger bun'],
      amount: '2',
      unit: 'piece',
      reason: 'STAFF_MEAL',
      forWhom: 'the dishwashers',
    });
    expect([meal.body.type, meal.body.amount]).toEqual(['STAFF_MEAL', -2000]);
    const miss = await http()
      .post('/api/stock/take-out')
      .set(w.as(chef.token))
      .send({ inventoryItemId: inv['Burger bun'], amount: '1', unit: 'piece', reason: 'MISSING' });
    expect(miss.body.type).toBe('MISSING');
    const found = await http().post('/api/stock/found').set(w.as(chef.token)).send({
      inventoryItemId: inv['Burger bun'],
      amount: '1',
      unit: 'piece',
      note: 'behind the freezer',
    });
    expect([found.status, found.body.type, found.body.amount]).toEqual([201, 'FOUND', 1000]);
    // "Stolen" is not a reason (R21).
    const stolen = await http()
      .post('/api/stock/take-out')
      .set(w.as(chef.token))
      .send({ inventoryItemId: inv['Burger bun'], amount: '1', unit: 'piece', reason: 'STOLEN' });
    expect(stolen.status).toBe(400);
  });

  it('units by kind: a weight in ml is refused, half a gram is refused, a waiter cannot take out', async () => {
    const ml = await http().post('/api/stock/take-out').set(w.as(chef.token)).send({
      inventoryItemId: inv['Beef mince'],
      amount: '100',
      unit: 'ml',
      reason: 'SPOILED_OR_EXPIRED',
    });
    expect([ml.status, ml.body.code]).toEqual([400, 'UNIT_KIND_MISMATCH']);
    const half = await http().post('/api/stock/take-out').set(w.as(chef.token)).send({
      inventoryItemId: inv['Beef mince'],
      amount: '0.5',
      unit: 'g',
      reason: 'SPOILED_OR_EXPIRED',
    });
    expect([half.status, half.body.code]).toEqual([400, 'NOT_WHOLE']);
    const waiterTry = await http().post('/api/stock/take-out').set(w.as(waiter.token)).send({
      inventoryItemId: inv['Beef mince'],
      amount: '1',
      unit: 'kg',
      reason: 'SPOILED_OR_EXPIRED',
    });
    expect(waiterTry.status).toBe(403);
    // The kind is locked once stock has moved.
    const relock = await http()
      .patch(`/api/stock/items/${inv['Beef mince']}`)
      .set(w.as(manager.token))
      .send({ stockKind: 'VOLUME' });
    expect([relock.status, relock.body.code]).toEqual([409, 'KIND_LOCKED']);
  });

  it('the ledger is append only: the database refuses an UPDATE or a DELETE', async () => {
    await expect(
      w.prisma.$executeRawUnsafe('UPDATE stock_movements SET amount = 0'),
    ).rejects.toThrow(/append only/);
    await expect(w.prisma.$executeRawUnsafe('DELETE FROM stock_movements')).rejects.toThrow(
      /append only/,
    );
  });

  it('a chef sees no cost on the ledger; the manager does', async () => {
    const asChef = await http()
      .get(`/api/stock/movements?inventoryItemId=${inv['Beef mince']}`)
      .set(w.as(chef.token));
    expect(asChef.status).toBe(200);
    expect(asChef.body.data.every((r: any) => !('value' in r) && !('unitCost' in r))).toBe(true);
    const asMgr = await http()
      .get(`/api/stock/movements?inventoryItemId=${inv['Beef mince']}`)
      .set(w.as(manager.token));
    expect(asMgr.body.data.every((r: any) => 'value' in r)).toBe(true);
  });
});

describe('The servings fault: a double costs and takes what a double does (T6 phase 4)', () => {
  it('a double burger line costs UGX 9,000 (300 g of mince, two slices: 5,700 + 2,700 + 600) and takes 300 g; a single costs UGX 5,700', async () => {
    const d = await sendBurger(undefined, doubleServingId);
    const line = await w.prisma.orderItem.findUniqueOrThrow({ where: { id: d.lineId } });
    expect(line.costUnit!.toString()).toBe('9000');
    const rows = await rowsFor(d.lineId, 'SALE', 7);
    expect(rows.find((r: any) => r.inventoryItemId === inv['Beef mince']).amount).toBe(-300);
    const single = await w.prisma.orderItem.findFirstOrThrow({
      where: { menuItemId: burgerId, menuItemServingId: null },
    });
    expect(single.costUnit!.toString()).toBe('5700');
    const cost = await http()
      .get(`/api/inventory/recipes/${burgerId}/cost?servingId=${doubleServingId}`)
      .set(w.as(manager.token));
    expect(cost.status).toBe(200);
    const counted = cost.body.rows.filter((r: any) => r.inTotal);
    expect(counted).toHaveLength(7);
    expect(counted.every((r: any) => r.menuItemServingId === doubleServingId)).toBe(true);
  });
});
