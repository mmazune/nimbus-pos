import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M36 Bank Reconciliation + Period Close e2e tests (simplified).
 * Requires seeded DB with M36 permissions and an OPEN fiscal period.
 */
describe('Bank Reconciliation + Period Close (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;
  let orgId: string;

  // IDs captured during tests
  let bankAccountId: string;
  let bankStatementId: string;
  let bankStatementLineId: string;
  let bankStatementLineId2: string;
  let reconciliationId: string;
  let fiscalPeriodId: string;
  let manualEntryId: string;

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

    // Get branch and org IDs
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

    const branch = await prisma.branch.findFirst({ where: { id: branchId } });
    orgId = branch!.organizationId;

    // Ensure a seeded OPEN fiscal period exists for period-close tests
    const existing = await prisma.fiscalPeriod.findFirst({
      where: { orgId, status: 'OPEN' },
    });
    if (!existing) {
      const user = await prisma.user.findFirst({ where: { memberships: { some: {} } } });
      const created = await prisma.fiscalPeriod.create({
        data: {
          orgId,
          name: 'E2E M36 Period',
          startsAt: new Date('2027-01-01'),
          endsAt: new Date('2027-01-31'),
          status: 'OPEN',
          openedAt: new Date(),
          openedById: user!.id,
        },
      });
      fiscalPeriodId = created.id;
    } else {
      fiscalPeriodId = existing.id;
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (reconciliationId) {
      await prisma.bankReconciliation.deleteMany({ where: { id: reconciliationId } });
    }
    if (bankStatementId) {
      await prisma.bankStatementLine.deleteMany({ where: { bankStatementId } });
      await prisma.bankStatement.deleteMany({ where: { id: bankStatementId } });
    }
    if (manualEntryId) {
      await prisma.manualBankEntry.deleteMany({ where: { id: manualEntryId } });
    }
    if (bankAccountId) {
      await prisma.manualBankEntry.deleteMany({ where: { bankAccountId } });
      await prisma.bankAccount.deleteMany({ where: { id: bankAccountId } });
    }
    if (fiscalPeriodId) {
      const period = await prisma.fiscalPeriod.findFirst({
        where: { id: fiscalPeriodId, name: 'E2E M36 Period' },
      });
      if (period) {
        await prisma.periodCloseRun.deleteMany({ where: { fiscalPeriodId } });
        await prisma.fiscalPeriod.deleteMany({ where: { id: fiscalPeriodId } });
      }
    }
    await app.close();
  }, 30000);

  // -- Bank Accounts --

  describe('POST /api/accounting/bank-accounts', () => {
    it('should create a bank account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/bank-accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'E2E Main Account',
          accountCode: 'E2E-BA-001',
          bankName: 'E2E Bank',
          currencyCode: 'UGX',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.accountCode).toBe('E2E-BA-001');
      bankAccountId = res.body.id;
    });

    it('should reject duplicate account code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/bank-accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Duplicate',
          accountCode: 'E2E-BA-001',
          bankName: 'E2E Bank',
        });

      expect(res.status).toBe(409);
    });

    it('should reject missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/bank-accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ name: 'Missing fields' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/accounting/bank-accounts', () => {
    it('should list bank accounts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/bank-accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject chef without permission', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/bank-accounts')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });
  });

  // -- Bank Statements --

  describe('POST /api/accounting/bank-statements/import', () => {
    it('should import a bank statement with lines', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/bank-statements/import')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          bankAccountId,
          statementDate: '2025-01-31',
          periodStart: '2025-01-01',
          periodEnd: '2025-01-31',
          openingBalance: 100000,
          closingBalance: 150000,
          reference: 'E2E-STMT-001',
          lines: [
            {
              txDate: '2025-01-15',
              description: 'E2E Sales deposit',
              amount: 50000,
              direction: 'CREDIT',
              reference: 'E2E-DEP-001',
            },
            {
              txDate: '2025-01-20',
              description: 'E2E Bank charge',
              amount: 5000,
              direction: 'DEBIT',
              reference: 'E2E-CHG-001',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      bankStatementId = res.body.id;
      expect(res.body.lines.length).toBe(2);
      bankStatementLineId = res.body.lines[0].id;
      bankStatementLineId2 = res.body.lines[1].id;
    });

    it('should reject duplicate reference', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/bank-statements/import')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          bankAccountId,
          statementDate: '2025-02-28',
          periodStart: '2025-02-01',
          periodEnd: '2025-02-28',
          openingBalance: 0,
          closingBalance: 0,
          reference: 'E2E-STMT-001',
          lines: [],
        });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/accounting/bank-statements', () => {
    it('should list bank statements', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/bank-statements')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/accounting/bank-statements/:id', () => {
    it('should get a bank statement with lines', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounting/bank-statements/${bankStatementId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(bankStatementId);
      expect(res.body.lines.length).toBe(2);
    });

    it('should return 404 for non-existent statement', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/bank-statements/no-such-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // -- Manual Bank Entries --

  describe('POST /api/accounting/manual-bank-entries', () => {
    it('should create a manual bank entry', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/manual-bank-entries')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          bankAccountId,
          txDate: '2025-01-31',
          amount: 5000,
          direction: 'DEBIT',
          description: 'E2E Bank charge entry',
          entryType: 'BANK_CHARGE',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      manualEntryId = res.body.id;
    });
  });

  // -- Reconciliations --

  describe('POST /api/accounting/reconciliation', () => {
    it('should create a reconciliation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/reconciliation')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          bankAccountId,
          bankStatementId,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.unmatchedCount).toBe(2);
      expect(res.body.statementBalance).toBeDefined();
      reconciliationId = res.body.id;
    });

    it('should reject creating a second active reconciliation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/reconciliation')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ bankAccountId, bankStatementId });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/accounting/reconciliation', () => {
    it('should list reconciliations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/reconciliation')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/accounting/reconciliation/:id', () => {
    it('should get a reconciliation with live difference', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounting/reconciliation/${reconciliationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(reconciliationId);
      expect(res.body.difference).toBeDefined();
    });
  });

  // -- Matching + Skipping --

  describe('PATCH /api/accounting/reconciliation/:id/skip', () => {
    it('should skip a bank statement line', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/reconciliation/${reconciliationId}/skip`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ bankStatementLineId: bankStatementLineId2 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SKIPPED');
    });
  });

  describe('PATCH /api/accounting/reconciliation/:id/match', () => {
    it('should match a line to a manual bank entry', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/reconciliation/${reconciliationId}/match`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          bankStatementLineId,
          manualEntryId,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('MATCHED');
    });

    it('should reject matching an already-matched line', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/reconciliation/${reconciliationId}/match`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          bankStatementLineId,
          manualEntryId,
        });

      expect(res.status).toBe(409);
    });

    it('should reject match without journalLineId or manualEntryId', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/reconciliation/${reconciliationId}/match`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ bankStatementLineId: 'some-id' });

      // 400 from service validation or 404 from not found
      expect([400, 404]).toContain(res.status);
    });
  });

  // -- Complete Reconciliation --

  describe('POST /api/accounting/reconciliation/:id/complete', () => {
    it('should reject when difference is not zero', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounting/reconciliation/${reconciliationId}/complete`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(400);
    });
  });

  // -- Period Close Runs --

  describe('GET /api/accounting/period-close-runs', () => {
    it('should list period close runs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/period-close-runs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // -- Period Close / Lock --

  describe('PATCH /api/accounting/periods/:id/close', () => {
    it('should close an open fiscal period', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/periods/${fiscalPeriodId}/close`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ notes: 'E2E close test' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CLOSED');
    });

    it('should reject closing an already-closed period', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/periods/${fiscalPeriodId}/close`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({});

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/accounting/periods/:id/lock', () => {
    it('should lock a closed fiscal period', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/periods/${fiscalPeriodId}/lock`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('LOCKED');
    });

    it('should reject locking an already-locked period', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/periods/${fiscalPeriodId}/lock`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(409);
    });
  });
});
