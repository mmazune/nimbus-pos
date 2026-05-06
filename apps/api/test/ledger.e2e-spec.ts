import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

describe('Ledger (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;

  // IDs captured during tests
  let journalId: string;
  let reversalJournalId: string;
  let accountId1: string;
  let accountId2: string;
  let _postingRunId: string;

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

    // Login as chef (limited perms — for 403 tests)
    const chefLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'chef@demo.local', password: 'Chef#123' });
    chefToken = chefLogin.body.accessToken;

    // Resolve branch
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

    // Find two active accounts for journal lines
    const accounts = await prisma.account.findMany({
      where: { status: 'ACTIVE' },
      take: 2,
    });
    if (accounts.length >= 2) {
      accountId1 = accounts[0].id;
      accountId2 = accounts[1].id;
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (reversalJournalId) {
      await prisma.journalLine.deleteMany({ where: { journalEntryId: reversalJournalId } });
      await prisma.journalEntry.deleteMany({ where: { id: reversalJournalId } });
    }
    if (journalId) {
      await prisma.postingRun.deleteMany({ where: { journalEntryId: journalId } });
      await prisma.journalLine.deleteMany({ where: { journalEntryId: journalId } });
      await prisma.journalEntry.deleteMany({ where: { id: journalId } });
    }
    // Clean up any posting runs/errors created during tests
    const org = await prisma.organization.findFirst();
    if (org) {
      const testRuns = await prisma.postingRun.findMany({
        where: { orgId: org.id, sourceKey: { startsWith: 'E2E_' } },
      });
      for (const run of testRuns) {
        await prisma.postingError.deleteMany({ where: { postingRunId: run.id } });
      }
      await prisma.postingRun.deleteMany({
        where: { orgId: org.id, sourceKey: { startsWith: 'E2E_' } },
      });
      // Clean up e2e journals (by reference prefix)
      const e2eJournals = await prisma.journalEntry.findMany({
        where: { orgId: org.id, reference: { startsWith: 'E2E-' } },
      });
      for (const j of e2eJournals) {
        await prisma.journalLine.deleteMany({ where: { journalEntryId: j.id } });
        // Clean up any posting runs linked to this journal
        await prisma.postingRun.deleteMany({ where: { journalEntryId: j.id } });
      }
      await prisma.journalEntry.deleteMany({
        where: { orgId: org.id, reference: { startsWith: 'E2E-' } },
      });
    }
    await app.close();
  }, 30000);

  // ── Create Journal ──

  describe('POST /api/accounting/journals', () => {
    it('should create a balanced journal entry', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/journals')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          journalDate: '2024-01-15',
          reference: 'E2E-Opening Balance',
          description: 'E2e opening balance test',
          lines: [
            {
              accountId: accountId1,
              direction: 'DEBIT',
              amount: '500.00',
              description: 'Cash debit',
            },
            {
              accountId: accountId2,
              direction: 'CREDIT',
              amount: '500.00',
              description: 'Revenue credit',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.journalNumber).toBeDefined();
      expect(res.body.status).toBe('POSTED');
      expect(res.body.lines).toHaveLength(2);
      journalId = res.body.id;
    });

    it('should reject unbalanced journal', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/journals')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          journalDate: '2024-01-15',
          reference: 'E2E-Unbalanced',
          lines: [
            {
              accountId: accountId1,
              direction: 'DEBIT',
              amount: '500.00',
            },
            {
              accountId: accountId2,
              direction: 'CREDIT',
              amount: '300.00',
            },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should reject lines with fewer than 2 entries', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/journals')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          journalDate: '2024-01-15',
          reference: 'E2E-Single-Line',
          lines: [
            {
              accountId: accountId1,
              direction: 'DEBIT',
              amount: '100.00',
            },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing journalDate', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/journals')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          reference: 'E2E-NoDate',
          lines: [
            { accountId: accountId1, direction: 'DEBIT', amount: '100.00' },
            { accountId: accountId2, direction: 'CREDIT', amount: '100.00' },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/journals')
        .set('x-branch-id', branchId)
        .send({
          journalDate: '2024-01-15',
          lines: [
            { accountId: accountId1, direction: 'DEBIT', amount: '100.00' },
            { accountId: accountId2, direction: 'CREDIT', amount: '100.00' },
          ],
        });

      expect(res.status).toBe(401);
    });

    it('should return 403 for user without create permission', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/journals')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({
          journalDate: '2024-01-15',
          reference: 'E2E-Chef',
          lines: [
            { accountId: accountId1, direction: 'DEBIT', amount: '100.00' },
            { accountId: accountId2, direction: 'CREDIT', amount: '100.00' },
          ],
        });

      expect(res.status).toBe(403);
    });
  });

  // ── List Journals ──

  describe('GET /api/accounting/journals', () => {
    it('should list journals with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/journals')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/journals?status=POSTED')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      for (const j of res.body.data) {
        expect(j.status).toBe('POSTED');
      }
    });

    it('should support skip/take pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/journals?skip=0&take=5')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/journals')
        .set('x-branch-id', branchId);

      expect(res.status).toBe(401);
    });
  });

  // ── Get Journal By ID ──

  describe('GET /api/accounting/journals/:id', () => {
    it('should return journal detail with lines', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounting/journals/${journalId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(journalId);
      expect(res.body.lines).toBeDefined();
      expect(res.body.lines.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 404 for nonexistent journal', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/journals/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── Reverse Journal ──

  describe('POST /api/accounting/journals/:id/reverse', () => {
    it('should reverse a posted journal', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounting/journals/${journalId}/reverse`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ reason: 'E2E correction' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.reversedFromId).toBe(journalId);
      expect(res.body.status).toBe('POSTED');
      reversalJournalId = res.body.id;
    });

    it('should reject double-reverse on already reversed journal', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounting/journals/${journalId}/reverse`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ reason: 'Double reverse attempt' });

      expect(res.status).toBe(409);
    });

    it('should return 404 for nonexistent journal', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/journals/nonexistent-id/reverse')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({});

      expect(res.status).toBe(404);
    });

    it('should return 403 for unauthorized user', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounting/journals/${journalId}/reverse`)
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  // ── Posting Replay ──

  describe('POST /api/accounting/posting/replay', () => {
    it('should replay a posting from source map', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/posting/replay')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          sourceKey: 'ORDER_REVENUE',
          sourceDocumentId: 'e2e-doc-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.alreadyPosted).toBe(false);
      expect(res.body.postingRun).toBeDefined();
      _postingRunId = res.body.postingRun.id;
    });

    it('should return idempotent result for same source document', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/posting/replay')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          sourceKey: 'ORDER_REVENUE',
          sourceDocumentId: 'e2e-doc-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.alreadyPosted).toBe(true);
    });

    it('should create posting error for unknown source key', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/posting/replay')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          sourceKey: 'E2E_UNKNOWN_KEY',
        });

      expect(res.status).toBe(201);
      expect(res.body.alreadyPosted).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('POSTING_FAILED');
    });

    it('should require sourceKey', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/posting/replay')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── Posting Runs ──

  describe('GET /api/accounting/posting-runs', () => {
    it('should list posting runs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/posting-runs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(0);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/posting-runs')
        .set('x-branch-id', branchId);

      expect(res.status).toBe(401);
    });
  });

  // ── Posting Errors ──

  describe('GET /api/accounting/posting-errors', () => {
    it('should list posting errors', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/posting-errors')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter errors by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/posting-errors?status=OPEN')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      for (const err of res.body.data) {
        expect(err.status).toBe('OPEN');
      }
    });
  });

  describe('GET /api/accounting/posting-errors/:id', () => {
    it('should return posting error detail', async () => {
      // First get an error id from the list
      const list = await request(app.getHttpServer())
        .get('/api/accounting/posting-errors?status=OPEN')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      if (list.body.data.length > 0) {
        const errorId = list.body.data[0].id;
        const res = await request(app.getHttpServer())
          .get(`/api/accounting/posting-errors/${errorId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-branch-id', branchId);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(errorId);
        expect(res.body.postingRun).toBeDefined();
      }
    });

    it('should return 404 for nonexistent error', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/posting-errors/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });
});
