import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M15 Shifts + Tills e2e tests.
 * Requires seeded DB with M15 permissions (pos:shift:open/close/read, pos:till:open/reconcile/safe-drop/read).
 */
describe('Shifts & Tills (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let ownerToken: string;
  let _cashierToken: string;
  let chefToken: string;
  let branchId: string;
  let shiftId: string;
  let tillId: string;

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

    // Login as cashier (has shift/till ops)
    const cashierLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@demo.local', password: 'Cashier#123' });
    _cashierToken = cashierLogin.body.accessToken;

    // Login as chef (read-only)
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

    // Cleanup: remove leftover TILL-E2E sessions and orphaned owner shifts from previous runs
    if (branchId) {
      const prisma = moduleFixture.get(PrismaService);
      const ownerUser = await prisma.user.findUnique({ where: { email: 'owner@demo.local' } });
      if (ownerUser) {
        const orphanedShifts = await prisma.shift.findMany({
          where: { branchId, openedById: ownerUser.id, status: 'OPEN' },
          select: { id: true },
        });
        for (const s of orphanedShifts) {
          await prisma.tillSession.deleteMany({ where: { shiftId: s.id } });
          await prisma.shift.delete({ where: { id: s.id } });
        }
      }
      // Delete any leftover TILL-E2E sessions from previous runs (unique constraint on reuse)
      await prisma.tillSession.deleteMany({ where: { branchId, tillCode: 'TILL-E2E' } });
    }
  }, 30000);

  afterAll(async () => {
    // Cleanup: delete test shift data so future runs start fresh
    if (shiftId) {
      const prisma = moduleFixture.get(PrismaService);
      await prisma.shift.deleteMany({
        where: { id: shiftId },
      });
    }
    await app.close();
  }, 30000);

  // ── Shift Lifecycle ──

  describe('POST /shifts/open', () => {
    it('should open a new shift', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ notes: 'E2E test shift' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('OPEN');
      expect(res.body.shiftNumber).toMatch(/^SHF-/);
      shiftId = res.body.id;
    });

    it('should reject opening a second shift', async () => {
      await request(app.getHttpServer())
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({})
        .expect(409);
    });

    it('should reject with missing branch header', async () => {
      await request(app.getHttpServer())
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(400);
    });

    it('should reject unauthorized role', async () => {
      await request(app.getHttpServer())
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({})
        .expect(403);
    });
  });

  describe('GET /shifts/active', () => {
    it('should return the active shift', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/shifts/active')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('id', shiftId);
      expect(res.body.status).toBe('OPEN');
    });
  });

  describe('GET /shifts/:id', () => {
    it('should return shift by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.id).toBe(shiftId);
    });

    it('should return 404 for non-existent shift', async () => {
      await request(app.getHttpServer())
        .get('/api/shifts/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(404);
    });
  });

  // ── Till Lifecycle ──

  describe('POST /tills/open', () => {
    it('should open a till for the active shift', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tills/open')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ tillCode: 'TILL-E2E', openingFloat: 50000 })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('OPEN');
      expect(res.body.tillCode).toBe('TILL-E2E');
      tillId = res.body.id;
    });

    it('should reject duplicate active tillCode', async () => {
      await request(app.getHttpServer())
        .post('/api/tills/open')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ tillCode: 'TILL-E2E', openingFloat: 10000 })
        .expect(409);
    });

    it('should reject with invalid openingFloat', async () => {
      await request(app.getHttpServer())
        .post('/api/tills/open')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ tillCode: 'TILL-BAD', openingFloat: -100 })
        .expect(400);
    });

    it('should reject with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/tills/open')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({})
        .expect(400);
    });
  });

  describe('GET /tills/active', () => {
    it('should return the active till', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tills/active')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('id', tillId);
      expect(res.body.status).toBe('OPEN');
    });
  });

  describe('GET /tills/:id', () => {
    it('should return till by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/tills/${tillId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.id).toBe(tillId);
      expect(res.body.tillCode).toBe('TILL-E2E');
    });
  });

  describe('POST /tills/:id/safe-drop', () => {
    it('should perform a safe drop', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/tills/${tillId}/safe-drop`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ amount: 20000, reason: 'E2E excess cash removal' })
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.type).toBe('SAFE_DROP');
    });

    it('should reject safe drop with invalid amount', async () => {
      await request(app.getHttpServer())
        .post(`/api/tills/${tillId}/safe-drop`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ amount: 0, reason: 'Zero amount' })
        .expect(400);
    });

    it('should reject safe drop without reason', async () => {
      await request(app.getHttpServer())
        .post(`/api/tills/${tillId}/safe-drop`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ amount: 5000 })
        .expect(400);
    });
  });

  describe('GET /tills/:id/summary', () => {
    it('should return till summary with computed expected cash', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/tills/${tillId}/summary`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('computedExpectedCash');
      expect(res.body.tillCode).toBe('TILL-E2E');
    });
  });

  describe('POST /tills/:id/reconcile', () => {
    it('should reconcile the till', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/tills/${tillId}/reconcile`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ countedCash: 30000, varianceReason: 'E2E test reconciliation' })
        .expect(200);

      expect(res.body.status).toBe('RECONCILED');
      expect(res.body).toHaveProperty('varianceStatus');
      expect(res.body).toHaveProperty('variance');
    });

    it('should reject reconcile on already-reconciled till', async () => {
      await request(app.getHttpServer())
        .post(`/api/tills/${tillId}/reconcile`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ countedCash: 30000 })
        .expect(409);
    });
  });

  // ── Shift Close ──

  describe('POST /shifts/:id/close', () => {
    it('should close the shift (no open tills)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ notes: 'E2E close' })
        .expect(200);

      expect(res.body.status).toBe('CLOSED');
    });

    it('should reject closing an already-closed shift', async () => {
      await request(app.getHttpServer())
        .post(`/api/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({})
        .expect(409);
    });
  });

  describe('GET /shifts/:id/summary', () => {
    it('should return shift summary after close', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/shifts/${shiftId}/summary`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('shiftId', shiftId);
    });
  });
});
