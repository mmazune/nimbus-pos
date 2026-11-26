import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';
import { assertDisposableEventDb } from './support/event-db-guard';

// T4 — smoke through the real API on a database loaded with the Tapas Downtown demo venue
// (packages/db/demo-venue/run.sh). The sign-ins are passed in the shell that ran the loader,
// never through a file:
//   DEMO_SIGNIN='waiter1=PIN,cashier1=PIN,…,owner1=pw:EMAIL:PASSWORD' npx jest … demo-venue.smoke
// Without DEMO_SIGNIN (the normal suite run) every test is skipped.
assertDisposableEventDb();

const signin = new Map(
  (process.env.DEMO_SIGNIN ?? '')
    .split(',')
    .filter(Boolean)
    .map((kv) => kv.split('=') as [string, string]),
);
const run = signin.size > 0 ? describe : describe.skip;

run('Tapas Downtown demo venue (smoke through the API)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let branchId: string;
  const http = () => request(app.getHttpServer());

  const pinLogin = async (key: string) => {
    const r = await http()
      .post('/api/auth/quick-pin-login')
      .send({ branchId, pin: signin.get(key), platform: 'POS_DESKTOP' });
    return r;
  };
  const tokenFor = async (key: string) => {
    const r = await pinLogin(key);
    expect(r.status).toBe(201);
    return r.body.accessToken as string;
  };
  const as = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Branch-Id': branchId });
  const openOrderAt = (label: string) =>
    prisma.order.findFirstOrThrow({
      where: { branchId, table: { label }, status: { notIn: ['CLOSED', 'VOIDED'] } },
    });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    branchId = (await prisma.branch.findFirstOrThrow({ where: { slug: 'tapas-downtown' } })).id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('every PIN role signs in by PIN; owner and accountant by password', async () => {
    for (const [key, secret] of signin) {
      if (secret.startsWith('pw:')) continue; // no PIN for this role
      const r = await pinLogin(key);
      expect({ key, status: r.status }).toEqual({ key, status: 201 });
    }
  });

  it('owner and accountant sign in with their one-time passwords', async () => {
    for (const [key, secret] of signin) {
      if (!secret.startsWith('pw:')) continue;
      const [, email, password] = secret.split(':');
      const r = await http().post('/api/auth/login').send({ email, password });
      expect({ key, status: r.status }).toEqual({ key, status: 201 });
    }
  });

  it('a loaded waiter adds and sends on a loaded table; the bar gets a ticket for that line only', async () => {
    const waiter = await tokenFor('waiter1');
    const order = await openOrderAt('M12'); // "not sent" in the loaded service
    const ticketsBefore = await prisma.kdsTicketItem.count({
      where: { orderItem: { orderId: order.id } },
    });
    const cola = await prisma.menuItem.findFirstOrThrow({ where: { branchId, name: 'Cola' } });
    const add = await http()
      .post(`/api/pos/orders/${order.id}/items`)
      .set(as(waiter))
      .send({ menuItemId: cola.id });
    expect(add.status).toBe(201);
    const send = await http().post(`/api/pos/orders/${order.id}/send`).set(as(waiter)).send({});
    expect(send.status).toBe(200);
    const after = await prisma.kdsTicketItem.count({ where: { orderItem: { orderId: order.id } } });
    // the three unsent lines (2 cola + olives as loaded, and the new cola) are ticketed now
    expect(after - ticketsBefore).toBe(3);
    expect(
      (await prisma.table.findFirstOrThrow({ where: { branchId, label: 'M12' } })).status,
    ).toBe('OCCUPIED');
  });

  it('a cashier takes cash on a bill-asked table: change given, table free, booking complete', async () => {
    const cashier = await tokenFor('cashier1');
    const order = await openOrderAt('M01'); // "bill asked", with a seated booking
    const due = Number(order.total);
    const handed = Math.ceil((due + 1) / 50000) * 50000;
    const r = await http()
      .post(`/api/pos/orders/${order.id}/close`)
      .set(as(cashier))
      .send({ payments: [{ method: 'CASH', amount: handed }] });
    expect(r.status).toBe(200);
    expect(r.body.change).toBe((handed - due).toFixed(2));
    expect(
      (await prisma.table.findFirstOrThrow({ where: { branchId, label: 'M01' } })).status,
    ).toBe('AVAILABLE');
    const booking = await prisma.reservation.findFirstOrThrow({
      where: { seatedOrderId: order.id },
    });
    expect(booking.status).toBe('COMPLETED');
  });

  it('a new order after the load gets the next number, and a new booking too', async () => {
    const waiter = await tokenFor('waiter2');
    const free = await prisma.table.findFirstOrThrow({ where: { branchId, label: 'M30' } });
    const before = await prisma.order.count({ where: { branchId } });
    const o = await http()
      .post('/api/pos/orders')
      .set(as(waiter))
      .send({ serviceType: 'DINE_IN', tableId: free.id });
    expect(o.status).toBe(201);
    expect(o.body.orderNumber).toBe(`ORD-${String(before + 1).padStart(6, '0')}`);
    const supervisor = await tokenFor('supervisor1');
    const bookings = await prisma.reservation.count({ where: { branchId } });
    const b = await http()
      .post('/api/reservations')
      .set(as(supervisor))
      .send({
        customerName: 'Smoke test guest',
        partySize: 2,
        reservationAt: new Date(Date.now() + 7200_000).toISOString(),
        source: 'PHONE',
      });
    expect(b.status).toBe(201);
    expect(b.body.reservationNumber).toBe(`RES-${String(bookings + 1).padStart(6, '0')}`);
  });
});
