import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M16 Reservations + Deposits + Seating e2e tests.
 * Requires seeded DB with M16 permissions.
 */
describe('Reservations (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let ownerToken: string;
  let _waiterToken: string;
  let chefToken: string;
  let branchId: string;
  let reservationId: string;
  let tableId: string;
  const createdReservationIds: string[] = [];

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Login as owner (has all permissions)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as waiter (front-of-house reservations)
    const waiterLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'waiter@demo.local', password: 'Waiter#123' });
    _waiterToken = waiterLogin.body.accessToken;

    // Login as chef (read-only for reservations)
    const chefLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'chef@demo.local', password: 'Chef#123' });
    chefToken = chefLogin.body.accessToken;

    // Get branch ID
    const me = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    branchId =
      me.body.defaultBranch?.id ||
      me.body.organizations?.[0]?.branches?.[0]?.id ||
      me.body.branches?.[0]?.id ||
      me.body.memberships?.[0]?.branchId;

    // Get a table for tests
    const prisma = moduleFixture.get(PrismaService);
    const table = await prisma.table.findFirst({
      where: { branchId },
      orderBy: { label: 'asc' },
    });
    if (table) tableId = table.id;
  }, 30000);

  afterAll(async () => {
    // Cleanup: delete test reservations
    if (createdReservationIds.length > 0) {
      const prisma = moduleFixture.get(PrismaService);
      for (const id of createdReservationIds) {
        await prisma.reservationEvent.deleteMany({ where: { reservationId: id } });
        await prisma.reservationDeposit.deleteMany({ where: { reservationId: id } });
      }
      await prisma.reservation.deleteMany({
        where: { id: { in: createdReservationIds } },
      });
    }
    await app.close();
  }, 30000);

  // ── Create Reservation ──

  describe('POST /reservations', () => {
    it('should create a reservation', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      tomorrow.setHours(12, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          customerName: 'E2E Test Customer',
          partySize: 4,
          reservationAt: tomorrow.toISOString(),
          source: 'PHONE',
          notes: 'E2E test reservation',
          depositRequired: 25000,
        });

      expect(res.status).toBe(201);
      expect(res.body.reservationNumber).toMatch(/^RES-/);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.customerName).toBe('E2E Test Customer');
      expect(res.body.partySize).toBe(4);

      reservationId = res.body.id;
      createdReservationIds.push(reservationId);
    });

    it('should reject invalid payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ customerName: 'X' }); // missing required fields

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('X-Branch-Id', branchId)
        .send({ customerName: 'No Auth', partySize: 2, reservationAt: new Date().toISOString() });

      expect(res.status).toBe(401);
    });
  });

  // ── List Reservations ──

  describe('GET /reservations', () => {
    it('should list reservations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reservations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reservations?status=PENDING')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      for (const r of res.body.data) {
        expect(r.status).toBe('PENDING');
      }
    });

    it('chef should see reservations (read-only)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reservations')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
    });
  });

  // ── List Upcoming ──

  describe('GET /reservations/upcoming', () => {
    it('should list upcoming reservations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reservations/upcoming')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Get By Id ──

  describe('GET /reservations/:id', () => {
    it('should return reservation by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(reservationId);
      expect(res.body.customerName).toBe('E2E Test Customer');
    });

    it('should 404 for non-existent id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reservations/nonexistent-id-12345')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── Confirm ──

  describe('PATCH /reservations/:id/confirm', () => {
    it('should confirm a pending reservation', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ notes: 'Confirmed via e2e test' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body.confirmedAt).toBeDefined();
    });

    it('should reject double-confirm', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({});

      expect(res.status).toBe(409);
    });
  });

  // ── Record Deposit ──

  describe('POST /reservations/:id/deposits', () => {
    it('should record a deposit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/reservations/${reservationId}/deposits`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          amount: 25000,
          method: 'CASH',
          notes: 'E2E deposit',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('RECEIVED');
      expect(Number(res.body.amount)).toBe(25000);
    });
  });

  // ── Get Deposits ──

  describe('GET /reservations/:id/deposits', () => {
    it('should return deposits for a reservation', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reservations/${reservationId}/deposits`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Get Events ──

  describe('GET /reservations/:id/events', () => {
    it('should return events for a reservation', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reservations/${reservationId}/events`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Assign Table ──

  describe('PATCH /reservations/:id/assign-table', () => {
    it('should assign a table', async () => {
      if (!tableId) return; // skip if no tables
      const res = await request(app.getHttpServer())
        .patch(`/api/reservations/${reservationId}/assign-table`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ tableId });

      expect(res.status).toBe(200);
      expect(res.body.tableId).toBe(tableId);
    });
  });

  // ── Seat ──

  describe('PATCH /reservations/:id/seat', () => {
    it('should seat a confirmed reservation', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/reservations/${reservationId}/seat`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          tableId: tableId || undefined,
          createOrder: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SEATED');
      expect(res.body.seatedAt).toBeDefined();
    });
  });

  // ── Seat with Order Creation ──

  describe('Seat with order creation', () => {
    let secondReservationId: string;

    it('should create reservation, confirm, and seat with order', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      futureDate.setHours(20, 0, 0, 0);

      // Create
      const createRes = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          customerName: 'E2E Seating Bridge',
          partySize: 2,
          reservationAt: futureDate.toISOString(),
          tableId: tableId || undefined,
        });

      expect(createRes.status).toBe(201);
      secondReservationId = createRes.body.id;
      createdReservationIds.push(secondReservationId);

      // Confirm
      const confirmRes = await request(app.getHttpServer())
        .patch(`/api/reservations/${secondReservationId}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({});

      expect(confirmRes.status).toBe(200);

      // Seat with order
      const seatRes = await request(app.getHttpServer())
        .patch(`/api/reservations/${secondReservationId}/seat`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          tableId: tableId || undefined,
          createOrder: true,
        });

      if (tableId) {
        expect(seatRes.status).toBe(200);
        expect(seatRes.body.status).toBe('SEATED');
        expect(seatRes.body.seatedOrderId).toBeDefined();
        expect(seatRes.body.seatedOrder).toBeDefined();
      }
    });
  });

  // ── Cancel ──

  describe('PATCH /reservations/:id/cancel', () => {
    let cancelReservationId: string;

    it('should cancel a pending reservation', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const createRes = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          customerName: 'E2E Cancel Target',
          partySize: 2,
          reservationAt: futureDate.toISOString(),
        });

      cancelReservationId = createRes.body.id;
      createdReservationIds.push(cancelReservationId);

      const res = await request(app.getHttpServer())
        .patch(`/api/reservations/${cancelReservationId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ reason: 'E2E test cancellation' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.cancelledAt).toBeDefined();
    });

    it('chef should be denied cancel (no permission)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 6);

      const createRes = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          customerName: 'E2E Chef Cancel',
          partySize: 1,
          reservationAt: futureDate.toISOString(),
        });

      const tmpResId = createRes.body.id;
      createdReservationIds.push(tmpResId);

      const res = await request(app.getHttpServer())
        .patch(`/api/reservations/${tmpResId}/cancel`)
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({ reason: 'chef attempt' });

      expect(res.status).toBe(403);
    });
  });

  // ── No-Show ──

  describe('PATCH /reservations/:id/no-show', () => {
    let noShowReservationId: string;

    it('should mark reservation as no-show', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      // Create and confirm
      const createRes = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          customerName: 'E2E No-Show',
          partySize: 3,
          reservationAt: futureDate.toISOString(),
        });

      noShowReservationId = createRes.body.id;
      createdReservationIds.push(noShowReservationId);

      await request(app.getHttpServer())
        .patch(`/api/reservations/${noShowReservationId}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({});

      const res = await request(app.getHttpServer())
        .patch(`/api/reservations/${noShowReservationId}/no-show`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ reason: 'Did not arrive' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('NO_SHOW');
      expect(res.body.noShowAt).toBeDefined();
    });
  });

  // ── State Machine Guard ──

  describe('State machine enforcement', () => {
    it('should reject seating a PENDING reservation (must confirm first)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 8);

      const createRes = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          customerName: 'E2E State Guard',
          partySize: 2,
          reservationAt: futureDate.toISOString(),
          tableId: tableId || undefined,
        });

      const tmpId = createRes.body.id;
      createdReservationIds.push(tmpId);

      const res = await request(app.getHttpServer())
        .patch(`/api/reservations/${tmpId}/seat`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({});

      expect(res.status).toBe(409); // ConflictException
    });
  });
});
