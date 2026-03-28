import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M24 Attendance + Leave + Shift Swaps e2e tests.
 * Requires seeded DB with M24 permissions + at least 2 employees.
 */
describe('Attendance + Leave + Shift Swaps (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;

  // IDs captured during tests
  let employeeId1: string;
  let employeeId2: string;
  let attendanceRecordId: string;
  let policyId: string;
  let leaveRequestId: string;
  let shiftSwapId: string;

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

    // Login as owner (has all permissions)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as chef (limited permissions — no attendance perms)
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

    // Fallback: query DB directly if branchId still undefined
    if (!branchId) {
      const branch = await prisma.branch.findFirst();
      branchId = branch!.id;
    }

    // Get two existing employees from seed
    const employees = await prisma.employee.findMany({ take: 2 });
    if (employees.length >= 2) {
      employeeId1 = employees[0].id;
      employeeId2 = employees[1].id;
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup test data in reverse dependency order
    if (shiftSwapId) {
      await prisma.shiftSwapRequest.deleteMany({ where: { id: shiftSwapId } });
    }
    if (leaveRequestId) {
      await prisma.leaveRequest.deleteMany({ where: { id: leaveRequestId } });
    }
    if (attendanceRecordId) {
      await prisma.attendanceRecord.deleteMany({ where: { id: attendanceRecordId } });
    }
    if (policyId) {
      await prisma.attendancePolicy.deleteMany({ where: { id: policyId } });
    }
    await app.close();
  }, 60000);

  // ── Attendance Policies ──

  describe('POST /hr/attendance/policies', () => {
    it('should create an attendance policy', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/hr/attendance/policies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: `E2E Policy ${Date.now()}`,
          graceMinutes: 10,
          autoLateAfterMinutes: 15,
          allowSelfClockOutFix: false,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.graceMinutes).toBe(10);
      expect(res.body.autoLateAfterMinutes).toBe(15);
      policyId = res.body.id;
    });

    it('should reject invalid graceMinutes (> 120)', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/attendance/policies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: 'Bad Policy',
          graceMinutes: 999,
        })
        .expect(400);
    });

    it('should 403 without permission', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/attendance/policies')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          name: 'Chef Policy',
          graceMinutes: 5,
        })
        .expect(403);
    });
  });

  describe('GET /hr/attendance/policies', () => {
    it('should list attendance policies', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/attendance/policies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /hr/attendance/policies/:id', () => {
    it('should update an attendance policy', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/hr/attendance/policies/${policyId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ graceMinutes: 15 })
        .expect(200);

      expect(res.body.graceMinutes).toBe(15);
    });

    it('should deactivate a policy', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/hr/attendance/policies/${policyId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ active: false })
        .expect(200);

      expect(res.body.active).toBe(false);

      // Re-activate for further tests
      await request(app.getHttpServer())
        .patch(`/api/hr/attendance/policies/${policyId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ active: true });
    });

    it('should 404 for non-existent policy', async () => {
      await request(app.getHttpServer())
        .patch('/api/hr/attendance/policies/non-existent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ name: 'Nope' })
        .expect(404);
    });
  });

  // ── Clock In / Out ──

  describe('POST /hr/attendance/clock', () => {
    it('should clock in an employee', async () => {
      // Clean any existing today record for this employee
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.attendanceRecord.deleteMany({
        where: { employeeId: employeeId1, attendanceDate: today },
      });

      const res = await request(app.getHttpServer())
        .post('/api/hr/attendance/clock')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          employeeId: employeeId1,
          notes: 'E2E clock-in test',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      // Status may be CLOCKED_IN or LATE depending on attendance policy + time of day
      expect(['CLOCKED_IN', 'LATE']).toContain(res.body.status);
      expect(res.body.clockInAt).toBeDefined();
      expect(res.body.clockOutAt).toBeNull();
      attendanceRecordId = res.body.id;
    });

    it('should clock out the same employee (toggle)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/hr/attendance/clock')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          employeeId: employeeId1,
        })
        .expect(201);

      expect(res.body.status).toBe('CLOCKED_OUT');
      expect(res.body.clockOutAt).toBeDefined();
    });

    it('should 409 if employee already clocked out today', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/attendance/clock')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ employeeId: employeeId1 })
        .expect(409);
    });

    it('should 404 for non-existent employee', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/attendance/clock')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ employeeId: 'non-existent-id' })
        .expect(404);
    });

    it('should 400 when employeeId is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/attendance/clock')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({})
        .expect(400);
    });
  });

  describe('GET /hr/attendance', () => {
    it('should list attendance records', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/attendance')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by employeeId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/hr/attendance?employeeId=${employeeId1}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].employeeId).toBe(employeeId1);
    });

    it('should support pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/attendance?skip=0&take=1')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  // ── Leave Requests ──

  describe('POST /hr/leave', () => {
    it('should create a leave request', async () => {
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + 14);
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + 2);

      const res = await request(app.getHttpServer())
        .post('/api/hr/leave')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          employeeId: employeeId1,
          leaveType: 'ANNUAL',
          startsAt: startsAt.toISOString().split('T')[0],
          endsAt: endsAt.toISOString().split('T')[0],
          reason: 'E2E annual leave test',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.leaveType).toBe('ANNUAL');
      leaveRequestId = res.body.id;
    });

    it('should 400 if endsAt before startsAt', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/leave')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          employeeId: employeeId1,
          leaveType: 'SICK',
          startsAt: '2025-12-10',
          endsAt: '2025-12-05',
        })
        .expect(400);
    });

    it('should 409 for overlapping leave', async () => {
      // Try to create overlapping leave with the one just created
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + 15); // overlaps with +14..+16
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + 1);

      await request(app.getHttpServer())
        .post('/api/hr/leave')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          employeeId: employeeId1,
          leaveType: 'ANNUAL',
          startsAt: startsAt.toISOString().split('T')[0],
          endsAt: endsAt.toISOString().split('T')[0],
        })
        .expect(409);
    });

    it('should 404 for non-existent employee', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/leave')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          employeeId: 'non-existent-id',
          leaveType: 'SICK',
          startsAt: '2025-12-01',
          endsAt: '2025-12-03',
        })
        .expect(404);
    });
  });

  describe('GET /hr/leave', () => {
    it('should list leave requests', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/leave')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/leave?status=PENDING')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      res.body.data.forEach((lr: any) => {
        expect(lr.status).toBe('PENDING');
      });
    });
  });

  describe('PATCH /hr/leave/:id/review', () => {
    it('should approve a pending leave request', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/hr/leave/${leaveRequestId}/review`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          status: 'APPROVED',
          reviewNotes: 'E2E approved',
        })
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
      expect(res.body.reviewNotes).toBe('E2E approved');
      expect(res.body.reviewedById).toBeDefined();
    });

    it('should 400 when reviewing an already-reviewed request', async () => {
      await request(app.getHttpServer())
        .patch(`/api/hr/leave/${leaveRequestId}/review`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ status: 'REJECTED' })
        .expect(400);
    });

    it('should 404 for non-existent leave request', async () => {
      await request(app.getHttpServer())
        .patch('/api/hr/leave/non-existent-id/review')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ status: 'APPROVED' })
        .expect(404);
    });
  });

  // ── Shift Swaps ──

  describe('POST /hr/shift-swaps', () => {
    it('should create a shift swap request', async () => {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + 10);

      const res = await request(app.getHttpServer())
        .post('/api/hr/shift-swaps')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          requesterEmployeeId: employeeId1,
          targetEmployeeId: employeeId2,
          shiftDate: shiftDate.toISOString().split('T')[0],
          reason: 'E2E shift swap test',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.requesterEmployeeId).toBe(employeeId1);
      expect(res.body.targetEmployeeId).toBe(employeeId2);
      shiftSwapId = res.body.id;
    });

    it('should 400 when requester equals target', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/shift-swaps')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          requesterEmployeeId: employeeId1,
          targetEmployeeId: employeeId1,
          shiftDate: '2025-12-01',
        })
        .expect(400);
    });

    it('should 404 for non-existent requester', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/shift-swaps')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          requesterEmployeeId: 'non-existent-id',
          targetEmployeeId: employeeId2,
          shiftDate: '2025-12-01',
        })
        .expect(404);
    });
  });

  describe('GET /hr/shift-swaps', () => {
    it('should list shift swap requests', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/shift-swaps')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('should filter by employeeId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/hr/shift-swaps?employeeId=${employeeId1}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /hr/shift-swaps/:id/approve', () => {
    it('should approve a pending shift swap', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/hr/shift-swaps/${shiftSwapId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          status: 'APPROVED',
          reviewNotes: 'E2E approved swap',
        })
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
      expect(res.body.approvedById).toBeDefined();
    });

    it('should 400 when reviewing an already-reviewed swap', async () => {
      await request(app.getHttpServer())
        .patch(`/api/hr/shift-swaps/${shiftSwapId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ status: 'REJECTED' })
        .expect(400);
    });

    it('should 404 for non-existent swap', async () => {
      await request(app.getHttpServer())
        .patch('/api/hr/shift-swaps/non-existent-id/approve')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ status: 'APPROVED' })
        .expect(404);
    });
  });

  // ── Permission checks ──

  describe('Permission enforcement', () => {
    it('should 403 for chef trying to clock attendance', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/attendance/clock')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({ employeeId: employeeId1 })
        .expect(403);
    });

    it('should 403 for chef trying to create leave', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/leave')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          employeeId: employeeId1,
          leaveType: 'SICK',
          startsAt: '2025-12-20',
          endsAt: '2025-12-22',
        })
        .expect(403);
    });

    it('should 403 for chef trying to approve shift swap', async () => {
      await request(app.getHttpServer())
        .patch(`/api/hr/shift-swaps/${shiftSwapId}/approve`)
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({ status: 'APPROVED' })
        .expect(403);
    });

    it('should 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/hr/attendance')
        .expect(401);
    });
  });
});
