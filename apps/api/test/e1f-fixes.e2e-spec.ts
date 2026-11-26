import { assertDisposableEventDb } from './support/event-db-guard';
import {
  addLine,
  bootWorld,
  makeItem,
  makeTable,
  openOrder,
  send,
  T2World,
} from './support/t2-helpers';
import { PaymentsService } from '../src/modules/payments/payments.service';

// E1F — the review findings the reviewer could not probe live (S9, S10, S11), with numbers.
// Refuses anything but a disposable local nimbus_event_* database.
assertDisposableEventDb();

describe('E1F fixes without a reviewer probe (e2e)', () => {
  let w: T2World;

  beforeAll(async () => {
    w = await bootWorld();
  }, 120000);

  afterAll(async () => {
    await w?.app.close();
  });

  it('S11: a line void is refused while a mobile-money payment waits on the order', async () => {
    const item = await makeItem(w, 'E1F fish', 30000, 'KITCHEN');
    const t = await makeTable(w, 'S11');
    const o = await openOrder(w, w.tokens.owner, t.id);
    const line = (await addLine(w, w.tokens.owner, o, item.id)).body.id;
    expect((await send(w, w.tokens.owner, o)).status).toBe(200);
    await w.prisma.paymentIntent.create({
      data: {
        orgId: w.orgId,
        branchId: w.branchId,
        orderId: o,
        provider: 'MTN',
        amount: 30000,
        requestedAmount: 30000,
        status: 'PENDING',
      },
    });
    const v = await w
      .http()
      .post(`/api/pos/orders/${o}/items/${line}/void`)
      .set(w.as(w.tokens.supervisor))
      .send({ reason: 'GUEST_COMPLAINT', wasMade: true });
    expect(v.status).toBe(409);
    expect(JSON.stringify(v.body)).toContain('PAYMENT_PENDING');
    expect((await w.prisma.order.findUniqueOrThrow({ where: { id: o } })).total.toString()).toBe(
      '30000',
    );
  });

  it('S9 [emulation]: money that covers the bill does not close an order with an unsent line; sending it does', async () => {
    const a = await makeItem(w, 'E1F stew', 20000, 'KITCHEN');
    const b = await makeItem(w, 'E1F juice', 5000, 'BAR');
    const t = await makeTable(w, 'S9');
    const o = await openOrder(w, w.tokens.owner, t.id);
    await addLine(w, w.tokens.owner, o, a.id);
    expect((await send(w, w.tokens.owner, o)).status).toBe(200);
    await addLine(w, w.tokens.owner, o, b.id); // unsent, bill now 25,000
    // A provider callback has recorded 25,000 (as a webhook would), then auto-settle runs.
    await w.prisma.payment.create({
      data: {
        orgId: w.orgId,
        branchId: w.branchId,
        orderId: o,
        amount: 25000,
        method: 'MOMO',
        status: 'COMPLETED',
      },
    });
    const payments = w.app.get(PaymentsService) as any;
    expect(await payments.autoSettleIfFullyPaid(o, w.branchId)).toBe(false);
    expect((await w.prisma.order.findUniqueOrThrow({ where: { id: o } })).status).toBe('SENT');
    // The juice is sent: the payments cover the bill, so the order closes and the table frees.
    expect((await send(w, w.tokens.owner, o)).status).toBe(200);
    expect((await w.prisma.order.findUniqueOrThrow({ where: { id: o } })).status).toBe('CLOSED');
    expect((await w.prisma.table.findUniqueOrThrow({ where: { id: t.id } })).status).toBe(
      'AVAILABLE',
    );
  });

  it('S9: removing the last unsent line also closes a paid order', async () => {
    const a = await makeItem(w, 'E1F rice', 15000, 'KITCHEN');
    const b = await makeItem(w, 'E1F soda', 3000, 'BAR');
    const t = await makeTable(w, 'S9b');
    const o = await openOrder(w, w.tokens.owner, t.id);
    await addLine(w, w.tokens.owner, o, a.id);
    expect((await send(w, w.tokens.owner, o)).status).toBe(200);
    const extra = (await addLine(w, w.tokens.owner, o, b.id)).body.id;
    await w.prisma.payment.create({
      data: {
        orgId: w.orgId,
        branchId: w.branchId,
        orderId: o,
        amount: 15000,
        method: 'MOMO',
        status: 'COMPLETED',
      },
    });
    const del = await w
      .http()
      .delete(`/api/pos/orders/${o}/items/${extra}`)
      .set(w.as(w.tokens.owner));
    expect(del.status).toBe(200);
    expect((await w.prisma.order.findUniqueOrThrow({ where: { id: o } })).status).toBe('CLOSED');
  });

  it('S10: the first send occupies the table inside the send', async () => {
    const a = await makeItem(w, 'E1F beans', 8000, 'KITCHEN');
    const t = await makeTable(w, 'S10');
    const o = await openOrder(w, w.tokens.owner, t.id);
    await addLine(w, w.tokens.owner, o, a.id);
    expect((await w.prisma.table.findUniqueOrThrow({ where: { id: t.id } })).status).toBe(
      'AVAILABLE',
    );
    expect((await send(w, w.tokens.owner, o)).status).toBe(200);
    expect((await w.prisma.table.findUniqueOrThrow({ where: { id: t.id } })).status).toBe(
      'OCCUPIED',
    );
  });

  it('review ruling 4: the line void answers under /api/pos/orders as well as the first path', async () => {
    const a = await makeItem(w, 'E1F tea', 2000, 'BAR');
    const t = await makeTable(w, 'R4');
    const o = await openOrder(w, w.tokens.owner, t.id);
    const line = (await addLine(w, w.tokens.owner, o, a.id, 2)).body.id;
    expect((await send(w, w.tokens.owner, o)).status).toBe(200);
    const one = await w
      .http()
      .post(`/api/pos/orders/${o}/items/${line}/void`)
      .set(w.as(w.tokens.supervisor))
      .send({ reason: 'WRONG_ITEM', wasMade: false, quantity: 1 });
    expect(one.status).toBe(200);
    const two = await w
      .http()
      .post(`/api/orders/${o}/items/${line}/void`)
      .set(w.as(w.tokens.supervisor))
      .send({ reason: 'WRONG_ITEM', wasMade: false });
    expect(two.status).toBe(200);
    expect((await w.prisma.order.findUniqueOrThrow({ where: { id: o } })).total.toString()).toBe(
      '0',
    );
  });
});
