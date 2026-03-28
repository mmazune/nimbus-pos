import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M25 Scheduling + Templates + Duty Roster e2e tests.
 * Requires seeded DB with M25 permissions + at least 1 employee.
 */
describe('Scheduling + Templates + Duty Roster (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;

  // IDs captured during tests
  let employeeId1: string;
  let templateId: string;
  let scheduleId: string;
  let coverageRuleId: string;

  const uniqueCode = `E2E_${Date.now()}`;

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

    prisma = moduleFixture.get(PrismaService);

    // Login as owner
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

    if (!branchId) {
      const branch = await prisma.branch.findFirst();
      branchId = branch!.id;
    }

    // Get employee from seed
    const employees = await prisma.employee.findMany({ take: 1 });
    if (employees.length >= 1) {
      employeeId1 = employees[0].id;
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup test data in reverse dependency order
    if (scheduleId) {
      await prisma.scheduleAssignment.deleteMany({ where: { scheduleId } });
      await prisma.schedule.deleteMany({ where: { id: scheduleId } });
    }
    if (templateId) {
      await prisma.shiftTemplate.deleteMany({ where: { id: templateId } });
    }
    if (coverageRuleId) {
      await prisma.coverageRule.deleteMany({ where: { id: coverageRuleId } });
    }
    await app.close();
  }, 60000);

  // ── Shift Templates ──

  describe('POST /workforce/templates', () => {
    it('should create a shift template', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/workforce/templates')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          code: uniqueCode,
          name: 'E2E Morning Shift',
          startsAtTime: '06:00',
          endsAtTime: '14:00',
          expectedHeadcount: 3,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.code).toBe(uniqueCode);
      expect(res.body.name).toBe('E2E Morning Shift');
      expect(res.body.startsAtTime).toBe('06:00');
      expect(res.body.endsAtTime).toBe('14:00');
      expect(res.body.expectedHeadcount).toBe(3);
      expect(res.body.active).toBe(true);
      templateId = res.body.id;
    });

    it('should 409 for duplicate code', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/templates')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          code: uniqueCode,
          name: 'Duplicate',
          startsAtTime: '08:00',
          endsAtTime: '16:00',
        })
        .expect(409);
    });

    it('should 400 for invalid time format', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/templates')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          code: 'BADTIME',
          name: 'Bad Time',
          startsAtTime: '6am',
          endsAtTime: '2pm',
        })
        .expect(400);
    });

    it('should 400 when code is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/templates')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: 'No Code',
          startsAtTime: '08:00',
          endsAtTime: '16:00',
        })
        .expect(400);
    });

    it('should 403 for unauthorized user', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/templates')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          code: 'NOPERM',
          name: 'No Perm',
          startsAtTime: '08:00',
          endsAtTime: '16:00',
        })
        .expect(403);
    });

    it('should 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/templates')
        .set('X-Branch-Id', branchId)
        .send({
          code: 'NOAUTH',
          name: 'No Auth',
          startsAtTime: '08:00',
          endsAtTime: '16:00',
        })
        .expect(401);
    });
  });

  describe('GET /workforce/templates', () => {
    it('should list shift templates', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workforce/templates')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter by active status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workforce/templates?active=true')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      for (const t of res.body.data) {
        expect(t.active).toBe(true);
      }
    });

    it('should search by name', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/workforce/templates?search=E2E`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Schedules ──

  describe('POST /workforce/schedules', () => {
    it('should create a schedule without assignments', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/workforce/schedules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: `E2E Schedule ${Date.now()}`,
          dateFrom: '2025-06-01',
          dateTo: '2025-06-07',
          notes: 'E2E test schedule',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.version).toBe(1);
      scheduleId = res.body.id;
    });

    it('should create a schedule with assignments', async () => {
      if (!employeeId1 || !templateId) return;

      const res = await request(app.getHttpServer())
        .post('/api/workforce/schedules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: `E2E Schedule With Assign ${Date.now()}`,
          dateFrom: '2025-07-01',
          dateTo: '2025-07-07',
          assignments: [
            {
              shiftTemplateId: templateId,
              employeeId: employeeId1,
              shiftDate: '2025-07-01',
            },
          ],
        })
        .expect(201);

      expect(res.body.assignments).toHaveLength(1);
      // Cleanup this extra schedule
      await prisma.scheduleAssignment.deleteMany({ where: { scheduleId: res.body.id } });
      await prisma.schedule.delete({ where: { id: res.body.id } });
    });

    it('should 400 if dateTo before dateFrom', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/schedules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: 'Bad Range',
          dateFrom: '2025-06-07',
          dateTo: '2025-06-01',
        })
        .expect(400);
    });

    it('should 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/schedules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          dateFrom: '2025-06-01',
          dateTo: '2025-06-07',
        })
        .expect(400);
    });

    it('should 403 for unauthorized user', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/schedules')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: 'No Perm Schedule',
          dateFrom: '2025-06-01',
          dateTo: '2025-06-07',
        })
        .expect(403);
    });
  });

  describe('GET /workforce/schedules', () => {
    it('should list schedules', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workforce/schedules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workforce/schedules?status=DRAFT')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      for (const s of res.body.data) {
        expect(s.status).toBe('DRAFT');
      }
    });
  });

  describe('GET /workforce/schedules/:id', () => {
    it('should get a schedule by id', async () => {
      if (!scheduleId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/workforce/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.id).toBe(scheduleId);
      expect(res.body.status).toBe('DRAFT');
    });

    it('should 404 for non-existent schedule', async () => {
      await request(app.getHttpServer())
        .get('/api/workforce/schedules/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(404);
    });
  });

  describe('PATCH /workforce/schedules/:id/publish', () => {
    it('should publish a DRAFT schedule', async () => {
      if (!scheduleId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/workforce/schedules/${scheduleId}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ notes: 'Published via e2e' })
        .expect(200);

      expect(res.body.status).toBe('PUBLISHED');
      expect(res.body.publishedAt).toBeDefined();
      expect(res.body.version).toBe(2);
    });

    it('should 400 when trying to publish an already published schedule', async () => {
      if (!scheduleId) return;

      await request(app.getHttpServer())
        .patch(`/api/workforce/schedules/${scheduleId}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({})
        .expect(400);
    });

    it('should 404 for non-existent schedule', async () => {
      await request(app.getHttpServer())
        .patch('/api/workforce/schedules/nonexistent-id/publish')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({})
        .expect(404);
    });

    it('should 403 for unauthorized user', async () => {
      if (!scheduleId) return;

      await request(app.getHttpServer())
        .patch(`/api/workforce/schedules/${scheduleId}/publish`)
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({})
        .expect(403);
    });
  });

  describe('PATCH /workforce/schedules/:id/archive', () => {
    it('should archive a published schedule', async () => {
      if (!scheduleId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/workforce/schedules/${scheduleId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.status).toBe('ARCHIVED');
    });

    it('should 400 when archiving an already archived schedule', async () => {
      if (!scheduleId) return;

      await request(app.getHttpServer())
        .patch(`/api/workforce/schedules/${scheduleId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(400);
    });
  });

  // ── Roster ──

  describe('GET /workforce/roster', () => {
    it('should return roster (published schedule assignments)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workforce/roster?dateFrom=2025-01-01&dateTo=2025-12-31')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter roster by employeeId', async () => {
      if (!employeeId1) return;

      const res = await request(app.getHttpServer())
        .get(`/api/workforce/roster?employeeId=${employeeId1}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
    });
  });

  // ── Coverage Rules ──

  describe('POST /workforce/coverage-rules', () => {
    it('should create a coverage rule', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/workforce/coverage-rules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: `E2E Coverage ${Date.now()}`,
          roleKey: 'COOK',
          minimumHeadcount: 2,
          appliesFromTime: '06:00',
          appliesToTime: '14:00',
          severity: 'HIGH',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toContain('E2E Coverage');
      expect(res.body.minimumHeadcount).toBe(2);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.severity).toBe('HIGH');
      coverageRuleId = res.body.id;
    });

    it('should 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/coverage-rules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ roleKey: 'COOK' })
        .expect(400);
    });

    it('should 403 for unauthorized user', async () => {
      await request(app.getHttpServer())
        .post('/api/workforce/coverage-rules')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: 'No Perm Rule',
          roleKey: 'COOK',
        })
        .expect(403);
    });
  });

  describe('GET /workforce/coverage-rules', () => {
    it('should list coverage rules', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workforce/coverage-rules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Coverage Gaps ──

  describe('GET /workforce/coverage-gaps', () => {
    it('should return coverage gaps analysis', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workforce/coverage-gaps?dateFrom=2025-06-01&dateTo=2025-06-07')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('gaps');
    });

    it('should 400 when dateFrom/dateTo missing', async () => {
      await request(app.getHttpServer())
        .get('/api/workforce/coverage-gaps')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(400);
    });
  });
});
