// T6 phase 2 — requests for approval: a supervisor's PIN on the same device, or Approvals; the
// climb to managers; allowedActions on the order; refund by business day; till sign-off.
// Fictional cast only. PINs are made here through the real setup-token path.
import { bootWorld, T2World, makeItem, makeTable, ensureShift } from './support/t2-helpers';
import { makeEmployee, givePin, paidOrder } from './support/t6-helpers';

jest.setTimeout(180000);

let w: T2World;
type Staff = Awaited<ReturnType<typeof makeEmployee>>;
let cashier: Staff;
let cashier2: Staff;
let supervisor: Staff;
let supervisor2: Staff;
let manager: Staff;
let waiter: Staff;
let waiter2: Staff;
let supPin: string;
let mgrPin: string;
let waiterPin: string;
let cashierPin: string;
let itemId: string;
const PRICE = 18000;

async function openTill(token: string, code: string) {
  await ensureShift(w, token);
  const r = await w
    .http()
    .post('/api/tills/open')
    .set(w.as(token))
    .send({ tillCode: code, openingFloat: 50000 });
  if (r.status !== 201) throw new Error(`till open gave ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.id as string;
}

beforeAll(async () => {
  w = await bootWorld();
  cashier = await makeEmployee(w, 'Cashier', 'Halima');
  cashier2 = await makeEmployee(w, 'Cashier', 'Ivan');
  supervisor = await makeEmployee(w, 'Supervisor', 'Joan');
  supervisor2 = await makeEmployee(w, 'Supervisor', 'Kato');
  manager = await makeEmployee(w, 'Manager', 'Lydia');
  waiter = await makeEmployee(w, 'Waiter', 'Musa');
  waiter2 = await makeEmployee(w, 'Waiter', 'Nakato');
  supPin = await givePin(w, supervisor.userId);
  mgrPin = await givePin(w, manager.userId);
  waiterPin = await givePin(w, waiter.userId);
  cashierPin = await givePin(w, cashier.userId);
  itemId = (await makeItem(w, 'T6 Rolex', PRICE, 'KITCHEN')).id;
  for (const s of [waiter, waiter2, cashier, cashier2]) await ensureShift(w, s.token);
});
afterAll(async () => w?.app.close());

describe('Till over or short: a supervisor signs (T6 phase 2)', () => {
  let tillId: string;
  let requestId: string;

  it('a cashier counting 20,000 short (limit 10,000) waits for a sign-off; the till is not closed', async () => {
    tillId = await openTill(cashier.token, `T6-A-${w.run}`);
    const r = await w
      .http()
      .post(`/api/tills/${tillId}/reconcile`)
      .set(w.as(cashier.token))
      .send({ countedCash: 30000, varianceReason: 'counted twice' });
    expect(r.status).toBe(200);
    expect(r.body.varianceStatus).toBe('SHORT');
    expect(r.body.variance).toBe('-20000');
    expect(r.body.signOff.required).toBe(true);
    expect(r.body.closedAt).toBeNull();
    requestId = r.body.signOff.approvalRequestId;
    const req = await w.prisma.approvalRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect([req.kind, req.level, req.status]).toEqual(['TILL_VARIANCE', 'SUPERVISOR', 'PENDING']);
    // The wait in settings (3 minutes) sets when it climbs.
    expect(req.climbsAt!.getTime() - req.requestedAt.getTime()).toBe(3 * 60_000);
  });

  it("on the same device: a wrong PIN, a waiter's PIN and the cashier's own PIN are refused", async () => {
    const wrong = await w
      .http()
      .post(`/api/approval-requests/${requestId}/pin`)
      .set(w.as(cashier.token))
      .send({ pin: '00000001', decision: 'APPROVE' });
    expect([wrong.status, wrong.body.code]).toEqual([401, 'PIN_NOT_RECOGNISED']);
    const byWaiter = await w
      .http()
      .post(`/api/approval-requests/${requestId}/pin`)
      .set(w.as(cashier.token))
      .send({ pin: waiterPin, decision: 'APPROVE' });
    expect([byWaiter.status, byWaiter.body.code]).toEqual([403, 'NEEDS_SUPERVISOR']);
    const ownPin = await w
      .http()
      .post(`/api/approval-requests/${requestId}/pin`)
      .set(w.as(cashier.token))
      .send({ pin: cashierPin, decision: 'APPROVE' });
    expect([ownPin.status, ownPin.body.code]).toEqual([403, 'OWN_REQUEST']);
    // Someone who did not ask cannot take a PIN for it.
    const notMine = await w
      .http()
      .post(`/api/approval-requests/${requestId}/pin`)
      .set(w.as(cashier2.token))
      .send({ pin: supPin, decision: 'APPROVE' });
    expect(notMine.status).toBe(403);
  });

  it("the supervisor types her PIN on the cashier's device: signed, the till closes, nothing about the PIN is kept", async () => {
    const r = await w
      .http()
      .post(`/api/approval-requests/${requestId}/pin`)
      .set(w.as(cashier.token))
      .send({ pin: supPin, decision: 'APPROVE', note: 'recounted with her' });
    expect(r.status).toBe(200);
    expect([r.body.status, r.body.decidedVia, r.body.decidedById]).toEqual([
      'APPROVED',
      'PIN_ON_DEVICE',
      supervisor.userId,
    ]);
    const till = await w.prisma.tillSession.findUniqueOrThrow({ where: { id: tillId } });
    expect(till.varianceSignedOffById).toBe(supervisor.userId);
    expect(till.closedAt).not.toBeNull();
    const audit = await w.prisma.auditLog.findMany({ where: { entityId: requestId } });
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(['APPROVAL_GRANTED', 'APPROVAL_PIN_REFUSED']),
    );
    expect(JSON.stringify(audit)).not.toContain(supPin);
    // Answered once only.
    const again = await w
      .http()
      .post(`/api/approval-requests/${requestId}/decide`)
      .set(w.as(supervisor2.token))
      .send({ decision: 'APPROVE' });
    expect(again.status).toBe(409);
  });

  it('from Approvals: a second supervisor sees it waiting and signs; two at once, one wins', async () => {
    const till2 = await openTill(cashier2.token, `T6-B-${w.run}`);
    const r = await w
      .http()
      .post(`/api/tills/${till2}/reconcile`)
      .set(w.as(cashier2.token))
      .send({ countedCash: 75000, varianceReason: 'tip jar mixed in' });
    expect(r.body.varianceStatus).toBe('OVER');
    const id = r.body.signOff.approvalRequestId;
    const list = await w.http().get('/api/approval-requests').set(w.as(supervisor2.token));
    expect(list.status).toBe(200);
    expect(list.body.data.map((x: any) => x.id)).toContain(id);
    // The cashier sees her own request, and only via scope=mine.
    const mine = await w.http().get('/api/approval-requests?scope=mine').set(w.as(cashier2.token));
    expect(mine.body.data.map((x: any) => x.id)).toContain(id);
    const both = await Promise.all(
      [supervisor, supervisor2].map((s) =>
        w
          .http()
          .post(`/api/approval-requests/${id}/decide`)
          .set(w.as(s.token))
          .send({ decision: 'APPROVE' }),
      ),
    );
    expect(both.map((x) => x.status).sort()).toEqual([200, 409]);
    const till = await w.prisma.tillSession.findUniqueOrThrow({ where: { id: till2 } });
    expect(till.varianceSignedOffAt).not.toBeNull();
  });

  it('declined: the count is not accepted and the till is open to be counted again', async () => {
    const t = await openTill(cashier.token, `T6-C-${w.run}`);
    const r = await w
      .http()
      .post(`/api/tills/${t}/reconcile`)
      .set(w.as(cashier.token))
      .send({ countedCash: 10000, varianceReason: 'drawer jammed' });
    const id = r.body.signOff.approvalRequestId;
    const d = await w
      .http()
      .post(`/api/approval-requests/${id}/decide`)
      .set(w.as(supervisor.token))
      .send({ decision: 'DECLINE', note: 'count again' });
    expect([d.status, d.body.status]).toEqual([200, 'DECLINED']);
    const till = await w.prisma.tillSession.findUniqueOrThrow({ where: { id: t } });
    expect([till.status, till.countedCash]).toEqual(['OPEN', null]);
    const again = await w
      .http()
      .post(`/api/tills/${t}/reconcile`)
      .set(w.as(cashier.token))
      .send({ countedCash: 50000 });
    expect([again.status, again.body.signOff.required]).toEqual([200, false]);
  });
});

describe('The climb: after the wait, managers are asked too (T6 phase 2)', () => {
  it("a request appears in the manager's waiting list only once it has climbed", async () => {
    const t = await openTill(cashier2.token, `T6-D-${w.run}`);
    const r = await w
      .http()
      .post(`/api/tills/${t}/reconcile`)
      .set(w.as(cashier2.token))
      .send({ countedCash: 20000, varianceReason: 'unknown' });
    const id = r.body.signOff.approvalRequestId;
    const before = await w.http().get('/api/approval-requests').set(w.as(manager.token));
    expect(before.body.data.map((x: any) => x.id)).not.toContain(id);
    const one = await w.http().get(`/api/approval-requests/${id}`).set(w.as(manager.token));
    expect(one.body.askedOf).toEqual(['Supervisor']);

    // [emulation] Four minutes pass: the request's clock is moved back in the database.
    const back = new Date(Date.now() - 4 * 60_000);
    await w.prisma.approvalRequest.update({
      where: { id },
      data: { requestedAt: back, climbsAt: new Date(back.getTime() + 3 * 60_000) },
    });
    const after = await w.http().get('/api/approval-requests').set(w.as(manager.token));
    const row = after.body.data.find((x: any) => x.id === id);
    expect(row).toBeDefined();
    expect(row.askedOf).toEqual(['Supervisor', 'Manager']);
    expect(row.climbedAt).not.toBeNull();
    // Supervisors still see it, and the climb is on the record once.
    const sup = await w.http().get('/api/approval-requests').set(w.as(supervisor.token));
    expect(sup.body.data.map((x: any) => x.id)).toContain(id);
    await w.http().get('/api/approval-requests').set(w.as(manager.token));
    const climbs = await w.prisma.auditLog.count({
      where: { entityId: id, action: 'APPROVAL_CLIMBED' },
    });
    expect(climbs).toBe(1);
    const ok = await w
      .http()
      .post(`/api/approval-requests/${id}/decide`)
      .set(w.as(manager.token))
      .send({ decision: 'APPROVE' });
    expect(ok.body.status).toBe('APPROVED');
  });
});

describe('The wait is a venue setting (T6 phase 2)', () => {
  it('PATCH /api/settings approvalClimbMinutes 5: the next request climbs 5 minutes after it is asked', async () => {
    const set = await w
      .http()
      .patch('/api/settings')
      .set(w.as(w.tokens.owner))
      .send({ approvalClimbMinutes: 5 });
    expect(set.status).toBe(200);
    try {
      const t = await openTill(cashier.token, `T6-E-${w.run}`);
      const r = await w
        .http()
        .post(`/api/tills/${t}/reconcile`)
        .set(w.as(cashier.token))
        .send({ countedCash: 25000, varianceReason: 'unknown' });
      const req = await w.prisma.approvalRequest.findUniqueOrThrow({
        where: { id: r.body.signOff.approvalRequestId },
      });
      expect(req.climbsAt!.getTime() - req.requestedAt.getTime()).toBe(5 * 60_000);
    } finally {
      await w
        .http()
        .patch('/api/settings')
        .set(w.as(w.tokens.owner))
        .send({ approvalClimbMinutes: 3 });
    }
  });
});

describe('Refunds: a supervisor on the same day, a manager after (T6 phase 2)', () => {
  let table: string;
  beforeAll(async () => {
    table = (await makeTable(w, 'T6R')).id;
  });

  it('a cashier and a waiter cannot refund; a supervisor refunds at once the same day', async () => {
    const { orderId, paymentId } = await paidOrder(
      w,
      waiter.token,
      cashier.token,
      table,
      itemId,
      PRICE,
    );
    for (const t of [cashier.token, waiter.token]) {
      const r = await w
        .http()
        .post(`/api/pos/orders/${orderId}/refunds`)
        .set(w.as(t))
        .send({ paymentId, amount: 5000, reason: 'cold' });
      expect(r.status).toBe(403);
    }
    const r = await w
      .http()
      .post(`/api/pos/orders/${orderId}/refunds`)
      .set(w.as(supervisor.token))
      .send({ paymentId, amount: 5000, reason: 'cold' });
    expect(r.status).toBe(201);
    expect([r.body.status, r.body.needs]).toEqual(['COMPLETED', null]);
  });

  it("a bill paid two days ago: the supervisor's refund waits; her own PIN cannot answer it, the manager's PIN on her device does", async () => {
    const { orderId, paymentId } = await paidOrder(
      w,
      waiter.token,
      cashier.token,
      table,
      itemId,
      PRICE,
    );
    // [emulation] the bill was paid two days ago.
    await w.prisma.payment.update({
      where: { id: paymentId },
      data: { createdAt: new Date(Date.now() - 2 * 24 * 3600_000) },
    });
    const r = await w
      .http()
      .post(`/api/pos/orders/${orderId}/refunds`)
      .set(w.as(supervisor.token))
      .send({ paymentId, amount: 7000, reason: 'charged twice' });
    expect([r.status, r.body.status, r.body.needs]).toEqual([201, 'PENDING', 'MANAGER']);
    const id = r.body.approvalRequestId;
    const bySup = await w
      .http()
      .post(`/api/approval-requests/${id}/pin`)
      .set(w.as(supervisor.token))
      .send({ pin: supPin, decision: 'APPROVE' });
    expect(bySup.status).toBe(403);
    // Another supervisor from Approvals cannot either.
    const bySup2 = await w
      .http()
      .post(`/api/approval-requests/${id}/decide`)
      .set(w.as(supervisor2.token))
      .send({ decision: 'APPROVE' });
    expect([bySup2.status, bySup2.body.code]).toEqual([403, 'NEEDS_MANAGER']);
    // Nor the old approve route.
    const old = await w
      .http()
      .post(`/api/pos/refunds/${r.body.id}/approve`)
      .set(w.as(supervisor2.token))
      .send({});
    expect(old.status).toBe(403);
    const byMgr = await w
      .http()
      .post(`/api/approval-requests/${id}/pin`)
      .set(w.as(supervisor.token))
      .send({ pin: mgrPin, decision: 'APPROVE' });
    expect([byMgr.status, byMgr.body.decidedById]).toEqual([200, manager.userId]);
    const refund = await w.prisma.refund.findUniqueOrThrow({ where: { id: r.body.id } });
    expect([refund.status, refund.approvedById]).toEqual(['COMPLETED', manager.userId]);
  });

  it('a later-day refund declined by the manager from Approvals is DECLINED', async () => {
    const { orderId, paymentId } = await paidOrder(
      w,
      waiter.token,
      cashier.token,
      table,
      itemId,
      PRICE,
    );
    await w.prisma.payment.update({
      where: { id: paymentId },
      data: { createdAt: new Date(Date.now() - 3 * 24 * 3600_000) },
    });
    const r = await w
      .http()
      .post(`/api/pos/orders/${orderId}/refunds`)
      .set(w.as(supervisor.token))
      .send({ paymentId, amount: 4000, reason: 'guest asked' });
    const waiting = await w.http().get('/api/approval-requests').set(w.as(manager.token));
    expect(waiting.body.data.map((x: any) => x.id)).toContain(r.body.approvalRequestId);
    const d = await w
      .http()
      .post(`/api/approval-requests/${r.body.approvalRequestId}/decide`)
      .set(w.as(manager.token))
      .send({ decision: 'DECLINE', note: 'no receipt' });
    expect(d.body.status).toBe('DECLINED');
    const refund = await w.prisma.refund.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(refund.status).toBe('DECLINED');
  });
});

describe('allowedActions: the order says what this person may do (T6 phase 2)', () => {
  it('waiter, other waiter, cashier, supervisor and manager each get their own list', async () => {
    const table = (await makeTable(w, 'T6A')).id;
    const o = await w
      .http()
      .post('/api/pos/orders')
      .set(w.as(waiter.token))
      .send({ serviceType: 'DINE_IN', tableId: table });
    const id = o.body.id;
    await w
      .http()
      .post(`/api/pos/orders/${id}/items`)
      .set(w.as(waiter.token))
      .send({ menuItemId: itemId, quantity: 1 });
    const get = async (t: string) =>
      (await w.http().get(`/api/pos/orders/${id}`).set(w.as(t))).body.allowedActions;

    expect(await get(waiter.token)).toEqual(expect.arrayContaining(['ADD_ITEMS', 'SEND']));
    expect(await get(waiter.token)).not.toContain('PRINT_BILL'); // nothing sent yet
    await w.http().post(`/api/pos/orders/${id}/send`).set(w.as(waiter.token)).send({});
    const mine = await get(waiter.token);
    expect(mine).toEqual(expect.arrayContaining(['ADD_ITEMS', 'PRINT_BILL']));
    for (const a of ['SEND', 'TAKE_PAYMENT', 'CLOSE', 'VOID_LINE', 'VOID_ORDER', 'REFUND'])
      expect(mine).not.toContain(a);

    const other = await w.http().get(`/api/pos/orders/${id}`).set(w.as(waiter2.token));
    // Another waiter cannot even open it (ownership), so a screen never shows it actions.
    expect(other.status).toBe(403);

    const cash = await get(cashier.token);
    expect(cash).toEqual(expect.arrayContaining(['TAKE_PAYMENT', 'CLOSE']));
    expect(cash).not.toContain('VOID_LINE');

    const sup = await get(supervisor.token);
    expect(sup).toEqual(expect.arrayContaining(['VOID_LINE', 'APPROVE_DISCOUNT']));
    for (const a of ['TAKE_PAYMENT', 'CLOSE']) expect(sup).not.toContain(a);

    const mgr = await get(manager.token);
    expect(mgr).toEqual(
      expect.arrayContaining(['ADD_ITEMS', 'TAKE_PAYMENT', 'CLOSE', 'VOID_LINE', 'VOID_ORDER']),
    );

    // Each action listed is accepted by its route: the cashier closes it.
    const close = await w
      .http()
      .post(`/api/pos/orders/${id}/close`)
      .set(w.as(cashier.token))
      .send({ payments: [{ method: 'CASH', amount: String(PRICE) }] });
    expect(close.status).toBe(200);
    expect(await get(supervisor.token)).toEqual(['REFUND']);
    expect(await get(cashier.token)).toEqual([]);
    expect(await get(manager.token)).toEqual(['REFUND']);
  });
});
