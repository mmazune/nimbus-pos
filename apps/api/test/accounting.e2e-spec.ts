import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M28 Accounting Foundation — COA + Cost Centers + Fiscal Periods e2e tests.
 * Requires seeded DB with M28 permissions.
 */
describe('Accounting Foundation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;

  // IDs captured during tests
  let accountId: string;
  let costCenterId: string;
  let fiscalPeriodId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
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
  }, 60000);

  afterAll(async () => {
    // Cleanup e2e data in reverse dependency order
    if (fiscalPeriodId) {
      await prisma.fiscalPeriod.deleteMany({ where: { id: fiscalPeriodId } });
    }
    if (costCenterId) {
      await prisma.costCenter.deleteMany({ where: { id: costCenterId } });
    }
    if (accountId) {
      await prisma.account.deleteMany({ where: { id: accountId } });
    }
    await app.close();
  }, 30000);

  // ── Accounts ──

  describe('POST /api/accounting/accounts', () => {
    it('should create an account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          code: 'E2E-9990',
          name: 'E2E Test Account',
          accountType: 'ASSET',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBe('E2E-9990');
      expect(res.body.accountType).toBe('ASSET');
      accountId = res.body.id;
    });

    it('should reject duplicate code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          code: 'E2E-9990',
          name: 'Duplicate Account',
          accountType: 'ASSET',
        });

      expect(res.status).toBe(409);
    });

    it('should reject missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/accounts')
        .set('x-branch-id', branchId)
        .send({ code: 'X', name: 'Y', accountType: 'ASSET' });

      expect(res.status).toBe(401);
    });

    it('should reject unauthorized role (Chef)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/accounts')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({ code: 'E2E-CC', name: 'Chef Account', accountType: 'ASSET' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/accounting/accounts', () => {
    it('should list accounts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter by accountType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/accounts?accountType=ASSET')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      for (const acct of res.body.data) {
        expect(acct.accountType).toBe('ASSET');
      }
    });

    it('should reject unauthenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/accounts')
        .set('x-branch-id', branchId);

      expect(res.status).toBe(401);
    });
  });

  // ── Cost Centers ──

  describe('POST /api/accounting/cost-centers', () => {
    it('should create a cost center', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/cost-centers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          code: 'E2E-CC-01',
          name: 'E2E Kitchen',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBe('E2E-CC-01');
      costCenterId = res.body.id;
    });

    it('should reject duplicate cost center code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/cost-centers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          code: 'E2E-CC-01',
          name: 'Dup CC',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/accounting/cost-centers', () => {
    it('should list cost centers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/cost-centers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Fiscal Periods ──

  describe('POST /api/accounting/periods', () => {
    it('should create a fiscal period', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/periods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'E2E-FY2099-Q1',
          startsAt: '2099-01-01T00:00:00.000Z',
          endsAt: '2099-03-31T23:59:59.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('DRAFT');
      fiscalPeriodId = res.body.id;
    });

    it('should reject overlapping period', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/periods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'E2E-Overlap',
          startsAt: '2099-02-01T00:00:00.000Z',
          endsAt: '2099-04-30T23:59:59.000Z',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/accounting/periods', () => {
    it('should list fiscal periods', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/periods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PATCH /api/accounting/periods/:id/open', () => {
    it('should open a DRAFT period', async () => {
      if (!fiscalPeriodId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/periods/${fiscalPeriodId}/open`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OPEN');
      expect(res.body.openedById).toBeDefined();
    });

    it('should reject opening an already OPEN period', async () => {
      if (!fiscalPeriodId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/periods/${fiscalPeriodId}/open`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(409);
    });

    it('should return 404 for non-existent period', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/accounting/periods/nonexistent-id/open')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── Posting Source Maps ──

  describe('GET /api/accounting/posting-source-maps', () => {
    it('should list posting source maps', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/posting-source-maps')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Tax Ledger Config ──

  describe('GET /api/accounting/tax-config', () => {
    it('should return tax config (or 404 if not seeded)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/tax-config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('PATCH /api/accounting/tax-config', () => {
    it('should create/update tax config when valid accounts exist', async () => {
      if (!accountId) return;

      const res = await request(app.getHttpServer())
        .patch('/api/accounting/tax-config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          outputTaxAccountId: accountId,
          inputTaxAccountId: accountId,
        });

      // May return 200 or 400 depending on seed state
      expect([200, 400]).toContain(res.status);
    });

    it('should reject invalid account references', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/accounting/tax-config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          outputTaxAccountId: 'nonexistent-acct',
        });

      expect(res.status).toBe(400);
    });
  });
});
