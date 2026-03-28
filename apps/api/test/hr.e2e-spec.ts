import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M23 Employees + Contracts + HR Core e2e tests.
 * Requires seeded DB with M23 permissions.
 */
describe('Employees + Contracts + HR Core (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;

  // IDs captured during tests
  let positionId: string;
  let compensationProfileId: string;
  let employeeId: string;
  let contractId: string;

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
    // Cleanup test data in reverse dependency order
    if (contractId) {
      await prisma.employmentContract.deleteMany({ where: { id: contractId } });
    }
    if (employeeId) {
      await prisma.employee.deleteMany({ where: { id: employeeId } });
    }
    if (positionId) {
      await prisma.position.deleteMany({ where: { id: positionId } });
    }
    if (compensationProfileId) {
      await prisma.compensationProfile.deleteMany({ where: { id: compensationProfileId } });
    }
    await app.close();
  }, 30000);

  // ── Positions ──

  describe('POST /hr/positions', () => {
    it('should create a position', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/hr/positions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          code: `E2E-POS-${Date.now()}`,
          title: 'E2E Test Chef',
          department: 'Kitchen',
          level: 'Senior',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('E2E Test Chef');
      positionId = res.body.id;
    });

    it('should reject duplicate position code', async () => {
      // fetch the code we just created
      const pos = await prisma.position.findUnique({ where: { id: positionId } });
      await request(app.getHttpServer())
        .post('/api/hr/positions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          code: pos!.code,
          title: 'Duplicate',
        })
        .expect(409);
    });
  });

  describe('GET /hr/positions', () => {
    it('should list positions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/positions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ── Compensation Profiles ──

  describe('POST /hr/compensation-profiles', () => {
    it('should create a compensation profile', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/hr/compensation-profiles')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          code: `E2E-COMP-${Date.now()}`,
          salaryBasis: 'MONTHLY',
          baseAmount: 3000000,
          currency: 'UGX',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.salaryBasis).toBe('MONTHLY');
      compensationProfileId = res.body.id;
    });
  });

  describe('GET /hr/compensation-profiles', () => {
    it('should list compensation profiles', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/compensation-profiles')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ── Employees ──

  describe('POST /hr/employees', () => {
    it('should create an employee', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/hr/employees')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          firstName: 'E2E',
          lastName: 'TestWorker',
          hireDate: '2024-06-01',
          employmentType: 'PERMANENT',
          positionId,
          compensationProfileId,
          phone: '+256700999001',
          email: 'e2e-worker@test.local',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('employeeCode');
      expect(res.body.firstName).toBe('E2E');
      expect(res.body.employmentType).toBe('PERMANENT');
      expect(res.body.position).toBeDefined();
      expect(res.body.compensationProfile).toBeDefined();
      employeeId = res.body.id;
    });

    it('should reject missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/employees')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ firstName: 'NoLast' })
        .expect(400);
    });

    it('should 403 for chef (no hr permission)', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/employees')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          firstName: 'Forbidden',
          lastName: 'Test',
          hireDate: '2024-06-01',
          employmentType: 'TEMPORARY',
        })
        .expect(403);
    });
  });

  describe('GET /hr/employees', () => {
    it('should list employees', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/employees')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should filter by employmentType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/employees?employmentType=PERMANENT')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      for (const emp of res.body.data) {
        expect(emp.employmentType).toBe('PERMANENT');
      }
    });

    it('should search by name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/employees?search=E2E')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /hr/employees/:id', () => {
    it('should get employee with contracts', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/hr/employees/${employeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.id).toBe(employeeId);
      expect(res.body).toHaveProperty('contracts');
      expect(res.body).toHaveProperty('position');
    });

    it('should 404 on nonexistent employee', async () => {
      await request(app.getHttpServer())
        .get('/api/hr/employees/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(404);
    });
  });

  describe('PATCH /hr/employees/:id', () => {
    it('should update employee fields', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/hr/employees/${employeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          firstName: 'E2E-Updated',
          status: 'ON_LEAVE',
        })
        .expect(200);

      expect(res.body.firstName).toBe('E2E-Updated');
      expect(res.body.status).toBe('ON_LEAVE');
    });

    it('should 404 on nonexistent employee', async () => {
      await request(app.getHttpServer())
        .patch('/api/hr/employees/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ firstName: 'Nope' })
        .expect(404);
    });
  });

  // ── Contracts ──

  describe('POST /hr/contracts', () => {
    it('should create a contract', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/hr/contracts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          employeeId,
          startsAt: '2024-06-01',
          salaryBasis: 'MONTHLY',
          salaryAmount: 5000000,
          termsSummary: 'E2E test contract, 12-month term',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('contractNumber');
      expect(res.body.employeeId).toBe(employeeId);
      expect(res.body.salaryBasis).toBe('MONTHLY');
      contractId = res.body.id;
    });

    it('should reject contract with missing employee', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/contracts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          employeeId: 'nonexistent-emp',
          startsAt: '2024-06-01',
          salaryBasis: 'MONTHLY',
        })
        .expect(400);
    });
  });

  describe('GET /hr/contracts', () => {
    it('should list contracts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/hr/contracts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should filter by employeeId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/hr/contracts?employeeId=${employeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      for (const ctr of res.body.data) {
        expect(ctr.employeeId).toBe(employeeId);
      }
    });
  });

  // ── Auth guard checks ──

  describe('Auth & Permission guards', () => {
    it('should 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/hr/employees')
        .set('X-Branch-Id', branchId)
        .expect(401);
    });

    it('should 403 for chef on write endpoints', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/positions')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .send({ code: 'BLOCKED', title: 'Blocked' })
        .expect(403);
    });
  });
});
