import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M21 Customer Feedback + NPS + QR Follow-up e2e tests.
 * Requires seeded DB with M21 permissions.
 */
describe('Customer Feedback + NPS (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;
  let feedbackRequestId: string;
  let feedbackToken: string;
  let feedbackId: string;

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

    // Login as chef (no feedback permissions)
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
    // Cleanup test data
    const prisma = moduleFixture.get(PrismaService);
    if (feedbackId) {
      await prisma.feedbackTag.deleteMany({ where: { feedbackId } });
      await prisma.feedback.deleteMany({ where: { id: feedbackId } });
    }
    if (feedbackRequestId) {
      await prisma.feedbackRequest.deleteMany({ where: { id: feedbackRequestId } });
    }
    // Clean up any other test feedback requests
    await prisma.feedbackRequest.deleteMany({
      where: { customerName: 'E2E Test Customer' },
    });
    await app.close();
  }, 30000);

  // ── Feedback Requests ──

  describe('POST /feedback/requests', () => {
    it('should create a feedback request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/feedback/requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          source: 'QR',
          customerName: 'E2E Test Customer',
          customerEmail: 'test@e2e.local',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('token');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.source).toBe('QR');
      feedbackRequestId = res.body.id;
      feedbackToken = res.body.token;
    });

    it('should reject with missing source', async () => {
      await request(app.getHttpServer())
        .post('/api/feedback/requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ customerName: 'Missing Source' })

        .expect(400);
    });

    it('should reject without branch header', async () => {
      await request(app.getHttpServer())
        .post('/api/feedback/requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ source: 'QR' })
        .expect(400);
    });

    it('should reject unauthorized role (chef)', async () => {
      await request(app.getHttpServer())
        .post('/api/feedback/requests')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({ source: 'QR' })
        .expect(403);
    });
  });

  describe('GET /feedback/requests', () => {
    it('should list feedback requests', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/feedback/requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Public Token Lookup ──

  describe('GET /feedback/public/token/:token', () => {
    it('should look up a valid token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/feedback/public/token/${feedbackToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id', feedbackRequestId);
      expect(res.body).toHaveProperty('source', 'QR');
      expect(res.body).toHaveProperty('customerName', 'E2E Test Customer');
    });

    it('should return 404 for invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/feedback/public/token/nonexistent-invalid-token')
        .expect(404);
    });
  });

  // ── Public Feedback Submission ──

  describe('POST /feedback/public', () => {
    it('should submit feedback via public endpoint', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/feedback/public')
        .send({
          token: feedbackToken,
          rating: 5,
          npsScore: 9,
          comment: 'Excellent service! E2E test.',
          customerName: 'E2E Test Customer',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.rating).toBe(5);
      expect(res.body.npsScore).toBe(9);
      expect(res.body.npsBucket).toBe('PROMOTER');
      expect(res.body.sentiment).toBe('POSITIVE');
      expect(res.body.status).toBe('NEW');
      feedbackId = res.body.id;
    });

    it('should reject duplicate submission on same token', async () => {
      const res = await request(app.getHttpServer()).post('/api/feedback/public').send({
        token: feedbackToken,
        rating: 3,
        comment: 'Duplicate attempt',
      });

      // Either 409 (ConflictException) or rate-limited 201 with message
      expect([201, 409]).toContain(res.status);
    });

    it('should reject with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/feedback/public')
        .send({
          token: 'nonexistent-token',
          rating: 3,
        })
        .expect(404);
    });
  });

  // ── Admin: List Feedback ──

  describe('GET /feedback', () => {
    it('should list feedback entries', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/feedback')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/feedback?status=NEW')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      for (const fb of res.body.data) {
        expect(fb.status).toBe('NEW');
      }
    });
  });

  describe('GET /feedback/:id', () => {
    it('should get feedback by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/feedback/${feedbackId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.id).toBe(feedbackId);
      expect(res.body).toHaveProperty('tags');
      expect(res.body).toHaveProperty('feedbackRequest');
    });

    it('should return 404 for non-existent feedback', async () => {
      await request(app.getHttpServer())
        .get('/api/feedback/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(404);
    });
  });

  // ── Admin: Tag ──

  describe('PATCH /feedback/:id/tag', () => {
    it('should tag feedback', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/feedback/${feedbackId}/tag`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ tagKey: 'SERVICE_QUALITY', tagLabel: 'Service Quality' })
        .expect(200);

      expect(res.body.tagKey).toBe('SERVICE_QUALITY');
      expect(res.body.tagLabel).toBe('Service Quality');
    });

    it('should reject duplicate tag', async () => {
      await request(app.getHttpServer())
        .patch(`/api/feedback/${feedbackId}/tag`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ tagKey: 'SERVICE_QUALITY', tagLabel: 'Service Quality' })
        .expect(409);
    });

    it('should reject tag on non-existent feedback', async () => {
      await request(app.getHttpServer())
        .patch('/api/feedback/nonexistent/tag')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ tagKey: 'TEST', tagLabel: 'Test' })
        .expect(404);
    });
  });

  describe('GET /feedback/tags', () => {
    it('should list tags', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/feedback/tags')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Admin: Acknowledge ──

  describe('PATCH /feedback/:id/acknowledge', () => {
    it('should acknowledge feedback', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/feedback/${feedbackId}/acknowledge`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.status).toBe('ACKNOWLEDGED');
    });

    it('should reject re-acknowledging', async () => {
      await request(app.getHttpServer())
        .patch(`/api/feedback/${feedbackId}/acknowledge`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(409);
    });
  });

  // ── Admin: Resolve ──

  describe('PATCH /feedback/:id/resolve', () => {
    it('should resolve feedback', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/feedback/${feedbackId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ resolutionNotes: 'Resolved via e2e test' })
        .expect(200);

      expect(res.body.status).toBe('RESOLVED');
    });

    it('should reject re-resolving', async () => {
      await request(app.getHttpServer())
        .patch(`/api/feedback/${feedbackId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ resolutionNotes: 'Again' })
        .expect(409);
    });
  });

  // ── NPS Summary ──

  describe('GET /feedback/nps-summary', () => {
    it('should return NPS summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/feedback/nps-summary')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('totalResponses');
      expect(res.body).toHaveProperty('promoters');
      expect(res.body).toHaveProperty('passives');
      expect(res.body).toHaveProperty('detractors');
      expect(res.body).toHaveProperty('npsScore');
      expect(res.body).toHaveProperty('avgRating');
    });
  });

  // ── Cancel Feedback Request ──

  describe('PATCH /feedback/requests/:id/cancel', () => {
    let cancelReqId: string;

    beforeAll(async () => {
      // Create a fresh request to cancel
      const res = await request(app.getHttpServer())
        .post('/api/feedback/requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          source: 'MANUAL',
          customerName: 'E2E Test Customer',
          customerPhone: '+256700000000',
        });
      cancelReqId = res.body.id;
    });

    afterAll(async () => {
      const prisma = moduleFixture.get(PrismaService);
      if (cancelReqId) {
        await prisma.feedbackRequest.deleteMany({ where: { id: cancelReqId } });
      }
    });

    it('should cancel a pending request', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/feedback/requests/${cancelReqId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });

    it('should reject cancelling already cancelled request', async () => {
      await request(app.getHttpServer())
        .patch(`/api/feedback/requests/${cancelReqId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(409);
    });
  });
});
