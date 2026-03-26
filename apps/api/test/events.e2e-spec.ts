import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M17 Events + Booking Portal + Ticketing e2e tests.
 * Requires seeded DB with M17 permissions.
 */
describe('Events (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;
  let eventId: string;
  let ticketClassId: string;
  let bookingId: string;
  let ticketId: string;
  let portalKey: string;
  const createdEventIds: string[] = [];

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

    // Login as chef (limited permissions)
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
  }, 30000);

  afterAll(async () => {
    // Cleanup: delete test events (cascade will handle children)
    if (createdEventIds.length > 0) {
      const prisma = moduleFixture.get(PrismaService);
      // Delete in correct order to respect FK constraints
      for (const id of createdEventIds) {
        await prisma.eventAuditLog.deleteMany({ where: { eventId: id } });
        await prisma.eventCheckIn.deleteMany({ where: { eventId: id } });
        await prisma.eventTicket.deleteMany({ where: { eventId: id } });
        await prisma.eventBooking.deleteMany({ where: { eventId: id } });
        await prisma.eventTicketClass.deleteMany({ where: { eventId: id } });
      }
      await prisma.event.deleteMany({
        where: { id: { in: createdEventIds } },
      });
    }
    await app.close();
  }, 30000);

  // ── Create Event ──

  describe('POST /events', () => {
    it('should create a DRAFT event', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const res = await request(app.getHttpServer())
        .post('/api/events')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          title: 'E2E Jazz Night',
          description: 'A test event',
          startsAt: nextWeek.toISOString(),
          capacity: 100,
        });

      expect(res.status).toBe(201);
      expect(res.body.eventNumber).toMatch(/^EVT-/);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.title).toBe('E2E Jazz Night');
      expect(res.body.capacity).toBe(100);

      eventId = res.body.id;
      createdEventIds.push(eventId);
    });

    it('should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/events')
        .set('X-Branch-Id', branchId)
        .send({ title: 'Test', startsAt: new Date().toISOString(), capacity: 10 });

      expect(res.status).toBe(401);
    });
  });

  // ── Update Event ──

  describe('PATCH /events/:id', () => {
    it('should update a DRAFT event', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ title: 'E2E Jazz Night Updated', venueNotes: 'Main hall' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('E2E Jazz Night Updated');
      expect(res.body.venueNotes).toBe('Main hall');
    });
  });

  // ── Get Event ──

  describe('GET /events/:id', () => {
    it('should retrieve an event by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(eventId);
      expect(res.body.title).toBe('E2E Jazz Night Updated');
    });

    it('should return 404 for non-existent event', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── Create Ticket Class ──

  describe('POST /events/:id/ticket-classes', () => {
    it('should create a ticket class', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/${eventId}/ticket-classes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: 'General Admission',
          type: 'GENERAL',
          price: 25000,
          capacity: 80,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('General Admission');
      expect(res.body.capacity).toBe(80);

      ticketClassId = res.body.id;
    });

    it('should reject ticket class exceeding event capacity', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/${eventId}/ticket-classes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: 'Overflow',
          price: 50000,
          capacity: 50,
        });

      expect(res.status).toBe(400);
    });
  });

  // ── List Ticket Classes ──

  describe('GET /events/:id/ticket-classes', () => {
    it('should list ticket classes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/${eventId}/ticket-classes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Publish Event ──

  describe('PATCH /events/:id/publish', () => {
    it('should publish a DRAFT event', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/events/${eventId}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ slug: 'e2e-jazz-night' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PUBLISHED');
      expect(res.body.portalKey).toBeTruthy();
      expect(res.body.slug).toBe('e2e-jazz-night');

      portalKey = res.body.portalKey;
    });

    it('should reject publishing a non-DRAFT event', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/events/${eventId}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({});

      expect(res.status).toBe(409);
    });
  });

  // ── Portal Endpoint ──

  describe('GET /events/portal/:portalKey', () => {
    it('should return portal-safe event data', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/portal/${portalKey}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.title).toContain('Jazz Night');
      expect(res.body.ticketClasses).toBeInstanceOf(Array);
      expect(res.body.ticketClasses[0].available).toBeDefined();
      // Portal should not expose internal IDs
      expect(res.body.orgId).toBeUndefined();
      expect(res.body.branchId).toBeUndefined();
    });

    it('should return 404 for invalid portal key', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/portal/nonexistent-key')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── Create Booking ──

  describe('POST /events/:id/bookings', () => {
    it('should create a confirmed booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/${eventId}/bookings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          ticketClassId,
          customerName: 'E2E Booking Customer',
          customerPhone: '+256700000000',
          quantity: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.bookingNumber).toMatch(/^BKG-/);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body.quantity).toBe(2);

      bookingId = res.body.id;
    });

    it('should reject booking for non-bookable event (after close)', async () => {
      // Create a separate DRAFT event, don't publish
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 14);

      const evtRes = await request(app.getHttpServer())
        .post('/api/events')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ title: 'Non-bookable Event', startsAt: nextWeek.toISOString(), capacity: 10 });

      createdEventIds.push(evtRes.body.id);

      const res = await request(app.getHttpServer())
        .post(`/api/events/${evtRes.body.id}/bookings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          ticketClassId,
          customerName: 'Should Fail',
          quantity: 1,
        });

      expect(res.status).toBe(400);
    });
  });

  // ── Get Booking ──

  describe('GET /events/bookings/:bookingId', () => {
    it('should retrieve a booking by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(bookingId);
      expect(res.body.customerName).toBe('E2E Booking Customer');
    });
  });

  // ── List Bookings ──

  describe('GET /events/:id/bookings', () => {
    it('should list bookings for event', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/${eventId}/bookings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Issue Tickets ──

  describe('POST /events/bookings/:bookingId/tickets/issue', () => {
    it('should issue tickets for a confirmed booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/bookings/${bookingId}/tickets/issue`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ holderName: 'E2E Ticket Holder' });

      expect(res.status).toBe(201);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2); // quantity was 2
      expect(res.body[0].ticketNumber).toMatch(/^TKT-/);
      expect(res.body[0].status).toBe('ISSUED');
      expect(res.body[0].qrToken).toBeTruthy();

      ticketId = res.body[0].id;
    });

    it('should reject duplicate ticket issuance', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/bookings/${bookingId}/tickets/issue`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({});

      expect(res.status).toBe(409);
    });
  });

  // ── Check-In ──

  describe('POST /events/tickets/:ticketId/check-in', () => {
    it('should check in a valid ticket', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/tickets/${ticketId}/check-in`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ message: 'Welcome!' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CHECKED_IN');
      expect(res.body.checkedInAt).toBeTruthy();
    });

    it('should reject duplicate check-in', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/tickets/${ticketId}/check-in`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({});

      expect(res.status).toBe(409);
    });
  });

  // ── Cancel Booking ──

  describe('PATCH /events/bookings/:bookingId/cancel', () => {
    it('should cancel a booking and reverse capacity', async () => {
      // Create a fresh booking to cancel
      const bookRes = await request(app.getHttpServer())
        .post(`/api/events/${eventId}/bookings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          ticketClassId,
          customerName: 'Cancel Me',
          quantity: 1,
        });

      const cancelBookingId = bookRes.body.id;

      const res = await request(app.getHttpServer())
        .patch(`/api/events/bookings/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ reason: 'Changed plans' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.cancelledAt).toBeTruthy();
    });
  });

  // ── List Events ──

  describe('GET /events', () => {
    it('should list events with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBeDefined();
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events?status=PUBLISHED')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].status).toBe('PUBLISHED');
      }
    });
  });

  // ── Upcoming Events ──

  describe('GET /events/upcoming', () => {
    it('should return upcoming events', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/upcoming')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
    });
  });

  // ── Close Event ──

  describe('PATCH /events/:id/close', () => {
    it('should close an OPEN event (need to transition to OPEN first)', async () => {
      // Manually set event status to OPEN via prisma
      const prisma = moduleFixture.get(PrismaService);
      await prisma.event.update({
        where: { id: eventId },
        data: { status: 'OPEN' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/events/${eventId}/close`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ reason: 'Event finished' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CLOSED');
    });
  });

  // ── Permission checks ──

  describe('Permission enforcement', () => {
    it('should deny creation to chef (no pos:event:create)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/events')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          title: 'Chef Event',
          startsAt: new Date().toISOString(),
          capacity: 10,
        });

      expect(res.status).toBe(403);
    });
  });
});
