import { assertDisposableEventDb } from './support/event-db-guard';
import {
  addLine,
  bootWorld,
  ensureShift,
  makeItem,
  makeTable,
  openOrder,
  send,
  T2World,
} from './support/t2-helpers';
import { buildTestMenu } from './support/t2-menu-fixture';

// T2 phase 1 (E2). Refuses anything but a disposable local nimbus_event_* database.
assertDisposableEventDb();

/**
 * "Lamb chops, 2 left, then gone" (Moses, 26 Nov 2026: "If lamb chops are done, they'll
 * disappear from the menu, or they'll be grayed out").
 * 19:20 the chef has two portions and says so. Waiter A sends one: every terminal shows
 * "1 left". Waiters B and C each send one in the same second: one gets it, the other is told
 * at once and the rest of their order still goes. The button is grey for everyone. Next
 * morning the manager resets and the chef sees what was cleared.
 */
describe('T2 phase 1: Lamb chops, 2 left, then gone (e2e)', () => {
  let w: T2World;

  beforeAll(async () => {
    w = await bootWorld();
    await ensureShift(w, w.tokens.waiter);
  }, 120000);

  afterAll(async () => {
    await w?.app.close();
  });

  const writeEndpoints = (itemId: string) =>
    [
      ['post', `/api/menu/items/${itemId}/sold-out`, {}],
      ['post', `/api/menu/items/${itemId}/available`, {}],
      ['put', `/api/menu/items/${itemId}/left`, { left: 3 }],
      ['post', '/api/menu/availability/reset', {}],
    ] as const;

  async function changed(since?: string) {
    const r = await w
      .http()
      .get('/api/menu/availability')
      .query(since ? { since } : {})
      .set(w.as(w.tokens.waiter));
    expect(r.status).toBe(200);
    return r.body as { cursor: string; items: { menuItemId: string; availability: any }[] };
  }

  async function workspaceItem(id: string) {
    const r = await w.http().get('/api/menu/workspace').set(w.as(w.tokens.waiter));
    expect(r.status).toBe(200);
    return r.body.items.find((i: any) => i.id === id);
  }

  async function logRows(menuItemId: string) {
    return w.prisma.menuAvailabilityLog.findMany({
      where: { menuItemId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  it('the whole evening, then the next morning', async () => {
    const lamb = await makeItem(w, 'Lamb chops', 45000, 'KITCHEN');
    const soup = await makeItem(w, 'Pumpkin soup', 12000, 'KITCHEN');
    const cola = await makeItem(w, 'Cola', 3000, 'BAR');
    const chefId = (await w.prisma.user.findUniqueOrThrow({ where: { email: 'chef@demo.local' } }))
      .id;

    // Rights: waiter and cashier get 403 on every write endpoint; a chef cannot touch a bar item.
    for (const role of ['waiter', 'cashier'] as const) {
      for (const [method, path, body] of writeEndpoints(lamb.id)) {
        const r = await (w.http() as any)[method](path).set(w.as(w.tokens[role])).send(body);
        expect({ role, path, status: r.status }).toEqual({ role, path, status: 403 });
      }
    }
    const chefOnBar = await w
      .http()
      .put(`/api/menu/items/${cola.id}/left`)
      .set(w.as(w.tokens.chef))
      .send({ left: 5 });
    expect(chefOnBar.status).toBe(403);
    expect(chefOnBar.body.code ?? chefOnBar.body.message?.code).toBeDefined();
    expect(await logRows(cola.id)).toHaveLength(0);

    const c0 = (await changed()).cursor;

    // 19:20 — the chef has two portions left.
    const set = await w
      .http()
      .put(`/api/menu/items/${lamb.id}/left`)
      .set(w.as(w.tokens.chef))
      .send({ left: 2 });
    expect(set.status).toBe(200);
    expect(set.body.availability).toMatchObject({ state: 'LOW', left: 2 });
    let logs = await logRows(lamb.id);
    expect(logs.map((l) => [l.change, l.leftAfter, l.byUserId])).toEqual([['SET_LEFT', 2, chefId]]);

    const afterSet = await changed(c0);
    expect(afterSet.items.map((i) => i.menuItemId)).toEqual([lamb.id]);
    const c1 = afterSet.cursor;
    expect((await changed(c1)).items).toEqual([]); // nothing changed since

    // Waiter A sends one lamb chops with a soup.
    const tA = await makeTable(w, 'T-A');
    const oA = await openOrder(w, w.tokens.waiter, tA.id);
    expect((await addLine(w, w.tokens.waiter, oA, lamb.id)).status).toBe(201);
    expect((await addLine(w, w.tokens.waiter, oA, soup.id)).status).toBe(201);
    const sA = await send(w, w.tokens.waiter, oA);
    expect(sA.status).toBe(200);
    expect(sA.body.sent).toHaveLength(2);
    expect(sA.body.skipped).toEqual([]);
    expect((await workspaceItem(lamb.id)).availability).toMatchObject({ state: 'LOW', left: 1 });
    const afterA = await changed(c1);
    expect(afterA.items).toEqual([
      { menuItemId: lamb.id, availability: expect.objectContaining({ state: 'LOW', left: 1 }) },
    ]);
    const c2 = afterA.cursor;

    // Waiters B and C each send one in the same second.
    const tB = await makeTable(w, 'T-B');
    const tC = await makeTable(w, 'T-C');
    const oB = await openOrder(w, w.tokens.manager, tB.id);
    const oC = await openOrder(w, w.tokens.supervisor, tC.id);
    await addLine(w, w.tokens.manager, oB, lamb.id);
    await addLine(w, w.tokens.manager, oB, cola.id);
    await addLine(w, w.tokens.supervisor, oC, lamb.id);
    await addLine(w, w.tokens.supervisor, oC, soup.id);
    const [sB, sC] = await Promise.all([
      send(w, w.tokens.manager, oB),
      send(w, w.tokens.supervisor, oC),
    ]);
    expect([sB.status, sC.status]).toEqual([200, 200]); // the rest of each order still goes
    const lambSentB = sB.body.skipped.length === 0;
    const winner = lambSentB ? sB : sC;
    const loser = lambSentB ? sC : sB;
    const loserOrder = lambSentB ? oC : oB;
    expect(winner.body.sent).toHaveLength(2);
    expect(loser.body.sent).toHaveLength(1);
    expect(loser.body.skipped).toEqual([
      expect.objectContaining({ menuItemId: lamb.id, reason: 'SOLD_OUT', name: lamb.name }),
    ]);

    // Grey for everyone, never below zero.
    const row = await w.prisma.menuItemAvailability.findUniqueOrThrow({
      where: { menuItemId: lamb.id },
    });
    expect([row.state, row.left, row.source]).toEqual(['SOLD_OUT', 0, 'COUNT']);
    expect((await workspaceItem(lamb.id)).availability.state).toBe('SOLD_OUT');
    logs = await logRows(lamb.id);
    expect(logs.map((l) => [l.change, l.leftBefore, l.leftAfter])).toEqual([
      ['SET_LEFT', null, 2],
      ['TAKEN', 2, 1], // 2 is already under the low mark of 5: no crossing, no LOW row
      ['TAKEN', 1, 0],
      ['SOLD_OUT', 0, 0],
    ]);
    const afterBC = await changed(c2);
    expect(afterBC.items.map((i) => [i.menuItemId, i.availability.state])).toEqual([
      [lamb.id, 'SOLD_OUT'],
    ]);

    // The loser's lamb line is flagged; a send with nothing sendable is a 409 that names it.
    const lo = await w.http().get(`/api/pos/orders/${loserOrder}`).set(w.as(w.tokens.owner));
    const lambLine = lo.body.items.find((i: any) => i.menuItemId === lamb.id);
    expect(lambLine).toMatchObject({ sentAt: null, unsendable: true });
    const again = await send(w, w.tokens.owner, loserOrder);
    expect(again.status).toBe(409);
    expect(JSON.stringify(again.body)).toContain('Lamb chops');
    const addMore = await addLine(w, w.tokens.waiter, oA, lamb.id);
    expect(addMore.status).toBe(409);
    expect(JSON.stringify(addMore.body)).toContain('ITEM_SOLD_OUT');

    // Next morning: a supervisor may not reset; the manager does; the opening list shows lamb.
    expect(
      (await w.http().post('/api/menu/availability/reset').set(w.as(w.tokens.supervisor))).status,
    ).toBe(403);
    const reset = await w.http().post('/api/menu/availability/reset').set(w.as(w.tokens.manager));
    expect(reset.status).toBe(200);
    expect(reset.body.cleared).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ menuItemId: lamb.id, wasState: 'SOLD_OUT', wasLeft: 0 }),
      ]),
    );
    const y = await w.http().get('/api/menu/availability/yesterday').set(w.as(w.tokens.chef));
    expect(y.status).toBe(200);
    expect(y.body.cleared.map((c: any) => c.menuItemId)).toContain(lamb.id);
    expect((await workspaceItem(lamb.id)).availability).toMatchObject({
      state: 'AVAILABLE',
      left: null,
    });
    expect((await logRows(lamb.id)).at(-1)).toMatchObject({ change: 'RESET', leftBefore: 0 });
  });

  it('two sends racing for the last serving, 20 times: exactly one gets it, never below zero', async () => {
    const item = await makeItem(w, 'Last goat stew', 30000, 'KITCHEN');
    const side = await makeItem(w, 'Side salad', 6000, 'KITCHEN');
    for (let round = 0; round < 20; round++) {
      const set = await w
        .http()
        .put(`/api/menu/items/${item.id}/left`)
        .set(w.as(w.tokens.chef))
        .send({ left: 1 });
      expect(set.status).toBe(200);
      const t1 = await makeTable(w, `R${round}a`);
      const t2 = await makeTable(w, `R${round}b`);
      const o1 = await openOrder(w, w.tokens.manager, t1.id);
      const o2 = await openOrder(w, w.tokens.supervisor, t2.id);
      for (const [tok, o] of [
        [w.tokens.manager, o1],
        [w.tokens.supervisor, o2],
      ] as const) {
        await addLine(w, tok, o, item.id);
        await addLine(w, tok, o, side.id);
      }
      const [a, b] = await Promise.all([
        send(w, w.tokens.manager, o1),
        send(w, w.tokens.supervisor, o2),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);
      const sentStew = [a, b].filter((r) => r.body.skipped.length === 0).length;
      const skippedStew = [a, b].filter((r) =>
        r.body.skipped.some((s: any) => s.menuItemId === item.id),
      ).length;
      expect({ round, sentStew, skippedStew }).toEqual({ round, sentStew: 1, skippedStew: 1 });
      const row = await w.prisma.menuItemAvailability.findUniqueOrThrow({
        where: { menuItemId: item.id },
      });
      expect({ round, state: row.state, left: row.left }).toEqual({
        round,
        state: 'SOLD_OUT',
        left: 0,
      });
      const sentLines = await w.prisma.orderItem.count({
        where: { menuItemId: item.id, orderId: { in: [o1, o2] }, sentAt: { not: null } },
      });
      expect({ round, sentLines }).toEqual({ round, sentLines: 1 });
    }
  }, 240000);

  it('crossing the low mark writes one LOW row', async () => {
    const item = await makeItem(w, 'Goat stew', 25000, 'KITCHEN');
    await w
      .http()
      .put(`/api/menu/items/${item.id}/left`)
      .set(w.as(w.tokens.chef))
      .send({ left: 7 });
    const t = await makeTable(w, 'L1');
    const o = await openOrder(w, w.tokens.owner, t.id);
    await addLine(w, w.tokens.owner, o, item.id, 2);
    expect((await send(w, w.tokens.owner, o)).status).toBe(200);
    await addLine(w, w.tokens.owner, o, item.id, 1);
    expect((await send(w, w.tokens.owner, o)).status).toBe(200);
    expect((await logRows(item.id)).map((l) => [l.change, l.leftBefore, l.leftAfter])).toEqual([
      ['SET_LEFT', null, 7],
      ['TAKEN', 7, 5],
      ['LOW', 7, 5],
      ['TAKEN', 5, 4],
    ]);
  });

  it('a void marked "not made" gives the portion back and the item comes back on', async () => {
    const item = await makeItem(w, 'Tilapia', 38000, 'KITCHEN');
    await w
      .http()
      .put(`/api/menu/items/${item.id}/left`)
      .set(w.as(w.tokens.chef))
      .send({ left: 1 });
    const t = await makeTable(w, 'V1');
    const o = await openOrder(w, w.tokens.owner, t.id);
    const line = (await addLine(w, w.tokens.owner, o, item.id)).body.id;
    expect((await send(w, w.tokens.owner, o)).status).toBe(200);
    expect(
      (await w.prisma.menuItemAvailability.findUniqueOrThrow({ where: { menuItemId: item.id } }))
        .state,
    ).toBe('SOLD_OUT');
    const v = await w
      .http()
      .post(`/api/orders/${o}/items/${line}/void`)
      .set(w.as(w.tokens.supervisor))
      .send({ reason: 'GUEST_CHANGED_MIND', wasMade: false });
    expect(v.status).toBe(200);
    const row = await w.prisma.menuItemAvailability.findUniqueOrThrow({
      where: { menuItemId: item.id },
    });
    expect([row.state, row.left]).toEqual(['AVAILABLE', 1]);
    expect((await logRows(item.id)).at(-1)).toMatchObject({
      change: 'GIVEN_BACK',
      leftBefore: 0,
      leftAfter: 1,
    });
  });

  it('an offer price is applied on the server and the normal price stays on the line', async () => {
    const item = await makeItem(w, 'Offer burger', 28000, 'KITCHEN');
    const patch = await w
      .http()
      .patch(`/api/menu/items/${item.id}`)
      .set(w.as(w.tokens.manager))
      .send({ isOffer: true, offerPrice: 22000, offerNote: 'Burger of the day' });
    expect(patch.status).toBe(200);
    const ws = await w.http().get('/api/menu/workspace').set(w.as(w.tokens.waiter));
    const food = ws.body.sections.find((s: any) => s.section === 'FOOD');
    expect(food.offers).toContain(item.id);
    expect(ws.body.items.find((i: any) => i.id === item.id).offer).toEqual({
      price: '22000',
      note: 'Burger of the day',
    });

    const t = await makeTable(w, 'OF1');
    const o = await openOrder(w, w.tokens.owner, t.id);
    const added = await addLine(w, w.tokens.owner, o, item.id, 2);
    expect(added.status).toBe(201);
    expect([added.body.price, added.body.normalPrice, added.body.subtotal]).toEqual([
      '22000',
      '28000',
      '44000',
    ]);
    // The offer ends; a quantity change keeps the price the line was added at.
    await w
      .http()
      .patch(`/api/menu/items/${item.id}`)
      .set(w.as(w.tokens.manager))
      .send({ isOffer: false });
    const upd = await w
      .http()
      .patch(`/api/pos/orders/${o}/items/${added.body.id}`)
      .set(w.as(w.tokens.owner))
      .send({ quantity: 3 });
    expect(upd.status).toBe(200);
    expect([upd.body.price, upd.body.normalPrice, upd.body.subtotal]).toEqual([
      '22000',
      '28000',
      '66000',
    ]);
    // A new line after the offer ended is at the normal price.
    const later = await addLine(w, w.tokens.owner, o, item.id, 1);
    expect([later.body.price, later.body.normalPrice]).toEqual(['28000', null]);
  });

  it('workspace: one call, version and 304, measured on a 200-item menu', async () => {
    const fixture = await buildTestMenu(w, 200);
    try {
      const t0 = Date.now();
      const r1 = await w.http().get('/api/menu/workspace').set(w.as(w.tokens.waiter));
      const ms = Date.now() - t0;
      expect(r1.status).toBe(200);
      const bytes = Buffer.byteLength(JSON.stringify(r1.body));
      // eslint-disable-next-line no-console
      console.log(`WORKSPACE_MEASURE items=${r1.body.items.length} bytes=${bytes} ms=${ms}`);
      expect(r1.body.items.length).toBeGreaterThanOrEqual(200);
      const sample = r1.body.items.find((i: any) => i.id === fixture.withChoices);
      expect(sample.choiceGroups[0].options.length).toBeGreaterThan(0);
      expect(r1.body.items.find((i: any) => i.id === fixture.withServings).servings.length).toBe(2);
      expect(sample.initials).toBeTruthy();
      for (const s of r1.body.sections) {
        expect(s.popular.length).toBeLessThanOrEqual(20);
        expect(Array.isArray(s.offers)).toBe(true);
        expect(Array.isArray(s.groups)).toBe(true);
      }
      expect(r1.body.sections.map((s: any) => s.section)).toEqual(['FOOD', 'DRINKS']);
      const fg = r1.body.sections[0].groups.find((g: any) => g.id === fixture.groupId);
      expect(fg.subgroups[0].itemIds.length).toBeGreaterThan(0);

      const etag = r1.headers.etag;
      expect(etag).toBe(`"${r1.body.version}"`);
      const r2 = await w
        .http()
        .get('/api/menu/workspace')
        .set(w.as(w.tokens.waiter))
        .set('If-None-Match', etag);
      expect(r2.status).toBe(304);
      await w
        .http()
        .post(`/api/menu/items/${fixture.withChoices}/sold-out`)
        .set(w.as(w.tokens.chef));
      const r3 = await w
        .http()
        .get('/api/menu/workspace')
        .set(w.as(w.tokens.waiter))
        .set('If-None-Match', etag);
      expect(r3.status).toBe(200);
      expect(r3.body.version).not.toBe(r1.body.version);
      expect(r3.body.items.find((i: any) => i.id === fixture.withChoices).availability.state).toBe(
        'SOLD_OUT',
      );
    } finally {
      await fixture.putAway();
    }
  });
});
