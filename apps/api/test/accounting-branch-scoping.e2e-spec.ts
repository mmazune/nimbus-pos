import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * PC-03 — cross-branch isolation across the accounting block.
 *
 * Track B0 (`ai/ACCOUNTING_API_VERIFICATION_REPORT.md` §6) proved live that
 * `ap/suppliers`, `ap/credit-notes`, `ar/credit-notes` and `bank-statements`
 * returned another branch's rows regardless of `X-Branch-Id`, and that several
 * list/detail pairs disagreed about scope. This suite is the executable form of
 * that finding: every case creates a row in ONE branch and then asserts it is
 * unreachable from the OTHER, through the same token.
 *
 * ⚠️ It never self-skips. The B3-F1 lesson from the permissions cutover was a
 * test that *looked for* a second-branch fixture and skipped when the dataset
 * had none — the suite went green while proving nothing. Both branches and both
 * memberships are ASSERTED in `beforeAll`; if the dataset cannot support the
 * test, the suite fails loudly instead of passing vacuously.
 *
 * ⚠️ `take=100` (not the original `take=500`): backend gap batch 3 (B5-F3,
 * `ai/BACKEND_GAP_BATCH3_COMPLETION_REPORT.md`) added a genuine server-side
 * maximum of 100 to every paginated accounting/finance list route — `take=500`
 * now correctly 400s. This suite's fixtures are 1-3 rows per branch, so 100 is
 * still "all of it" for these assertions.
 */
describe('Accounting cross-branch scoping — PC-03 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;

  /** The branch rows are created in. */
  let branchA: string;
  /** The branch they must be invisible from. */
  let branchB: string;

  const auth = (branch: string) => ({
    Authorization: `Bearer ${ownerToken}`,
    'x-branch-id': branch,
  });

  const get = (path: string, branch: string) =>
    request(app.getHttpServer()).get(path).set(auth(branch));

  const post = (path: string, branch: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post(path).set(auth(branch)).send(body);

  /** Unique-per-run suffix so re-running against a live DB cannot collide. */
  const tag = `PC03-${Date.now()}`;

  // Ids created in branch A.
  let supplierAId: string;
  let billAId: string;
  let apCreditNoteAId: string;
  let recurringProfileAId: string;
  let customerAccountAId: string;
  let invoiceAId: string;
  let arCreditNoteAId: string;
  let bankAccountAId: string;
  let bankStatementAId: string;
  let reconciliationAId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = login.body.accessToken;
    expect(ownerToken).toBeTruthy();

    // Two seeded branches, both with an owner membership (seed.ts BRANCHES_SEED
    // + MEMBERSHIP_SEED). Asserted, never skipped around.
    const main = await prisma.branch.findFirst({ where: { code: 'MAIN' } });
    const downtown = await prisma.branch.findFirst({ where: { code: 'DOWNTOWN' } });
    expect(main).toBeTruthy();
    expect(downtown).toBeTruthy();
    expect(main!.id).not.toBe(downtown!.id);

    branchA = downtown!.id;
    branchB = main!.id;

    // The whole point of this suite is that the SAME token, entitled to BOTH
    // branches, still cannot read across them. If the token were not entitled
    // to branch B, BranchContextGuard would 403 first and the 404s below would
    // prove nothing about scoping.
    for (const branchId of [branchA, branchB]) {
      const membership = await prisma.membership.findFirst({
        where: { branchId, user: { email: 'owner@demo.local' } },
      });
      expect(membership).toBeTruthy();
      const probe = await get('/api/accounting/ap/suppliers', branchId);
      expect(probe.status).toBe(200);
    }
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  // ───────────────────────────────────────────────────────────
  // Accounts Payable
  // ───────────────────────────────────────────────────────────

  describe('ap/suppliers — schema truth: Supplier.branchId is NULLABLE', () => {
    it('creates a supplier stamped with the operating branch', async () => {
      const res = await post('/api/accounting/ap/suppliers', branchA, {
        name: `${tag} Supplier A`,
        code: `${tag}-SUP-A`,
        currencyCode: 'UGX',
      });
      expect(res.status).toBe(201);
      supplierAId = res.body.id;
      // The create path must stamp the branch — without this the scoping fix
      // would silently degrade every new row to org-level.
      expect(res.body.branchId).toBe(branchA);
    });

    it('lists the supplier under its own branch', async () => {
      const res = await get('/api/accounting/ap/suppliers?take=100', branchA);
      expect(res.status).toBe(200);
      expect(res.body.data.map((s: any) => s.id)).toContain(supplierAId);
    });

    it('does NOT list it under another branch (was the 41-row, four-branch leak)', async () => {
      const res = await get('/api/accounting/ap/suppliers?take=100', branchB);
      expect(res.status).toBe(200);
      expect(res.body.data.map((s: any) => s.id)).not.toContain(supplierAId);
      // Nothing belonging to branch A may appear at all.
      const foreign = res.body.data.filter((s: any) => s.branchId === branchA);
      expect(foreign).toHaveLength(0);
    });

    it('resolves the DETAIL under its own branch and 404s under another', async () => {
      const own = await get(`/api/accounting/ap/suppliers/${supplierAId}`, branchA);
      expect(own.status).toBe(200);

      const foreign = await get(`/api/accounting/ap/suppliers/${supplierAId}`, branchB);
      // 404 rather than 403 — a 403 would confirm the id exists in another
      // branch (the B3-F1 precedent).
      expect(foreign.status).toBe(404);
    });

    it('keeps org-level (NULL-branch) suppliers visible from BOTH branches', async () => {
      // Nullable branchId means NULL is a real state: "belongs to the org, not
      // to a branch". Strict equality would have orphaned such rows from every
      // branch at once, which is a data-hiding bug rather than a scoping fix.
      const orgLevel = await prisma.supplier.create({
        data: {
          orgId: (await prisma.branch.findUniqueOrThrow({ where: { id: branchA } })).organizationId,
          branchId: null,
          name: `${tag} Org-level Supplier`,
          code: `${tag}-SUP-ORG`,
          currencyCode: 'UGX',
        },
      });

      for (const branch of [branchA, branchB]) {
        const res = await get('/api/accounting/ap/suppliers?take=100', branch);
        expect(res.status).toBe(200);
        expect(res.body.data.map((s: any) => s.id)).toContain(orgLevel.id);
      }
    });
  });

  describe('ap/bills — list was scoped, DETAIL was not', () => {
    it('creates a bill in branch A', async () => {
      const res = await post('/api/accounting/ap/bills', branchA, {
        supplierId: supplierAId,
        sourceType: 'MANUAL_SERVICE',
        billDate: '2025-06-01',
        issueDate: '2025-06-01',
        dueDate: '2025-07-01',
        lines: [{ description: `${tag} line`, quantity: 1, unitPrice: '250000' }],
      });
      expect(res.status).toBe(201);
      billAId = res.body.id;
      expect(res.body.branchId).toBe(branchA);
    });

    it('cannot be raised against another branch’s supplier', async () => {
      const res = await post('/api/accounting/ap/bills', branchB, {
        supplierId: supplierAId,
        sourceType: 'MANUAL_SERVICE',
        billDate: '2025-06-01',
        issueDate: '2025-06-01',
        dueDate: '2025-07-01',
        lines: [{ description: `${tag} cross`, quantity: 1, unitPrice: '1000' }],
      });
      expect(res.status).toBe(404);
    });

    it('resolves the DETAIL under its own branch and 404s under another', async () => {
      expect((await get(`/api/accounting/ap/bills/${billAId}`, branchA)).status).toBe(200);
      expect((await get(`/api/accounting/ap/bills/${billAId}`, branchB)).status).toBe(404);
    });

    it('refuses a cross-branch APPROVE — a write, not just a read', async () => {
      const foreign = await request(app.getHttpServer())
        .post(`/api/accounting/ap/bills/${billAId}/approve`)
        .set(auth(branchB))
        .send();
      expect(foreign.status).toBe(404);

      // ...and the bill is untouched.
      const stillDraft = await prisma.vendorBill.findUniqueOrThrow({ where: { id: billAId } });
      expect(stillDraft.status).toBe('DRAFT');

      // The same call from the owning branch succeeds — proving the 404 above
      // is scoping, not a broken route.
      const own = await request(app.getHttpServer())
        .post(`/api/accounting/ap/bills/${billAId}/approve`)
        .set(auth(branchA))
        .send();
      expect(own.status).toBe(200);
      expect(own.body.status).toBe('APPROVED');
    });
  });

  describe('ap/credit-notes — proven leaking live in B0 §6', () => {
    it('creates one in branch A', async () => {
      const res = await post('/api/accounting/ap/credit-notes', branchA, {
        supplierId: supplierAId,
        issueDate: '2025-06-05',
        totalAmount: '40000',
        reason: `${tag} overcharge`,
      });
      expect(res.status).toBe(201);
      apCreditNoteAId = res.body.id;
      expect(res.body.branchId).toBe(branchA);
    });

    it('is listed under its own branch only', async () => {
      const own = await get('/api/accounting/ap/credit-notes?take=100', branchA);
      expect(own.body.data.map((c: any) => c.id)).toContain(apCreditNoteAId);

      const foreign = await get('/api/accounting/ap/credit-notes?take=100', branchB);
      expect(foreign.status).toBe(200);
      expect(foreign.body.data.map((c: any) => c.id)).not.toContain(apCreditNoteAId);
    });
  });

  describe('ap/recurring-profiles + ap/aging', () => {
    it('creates a profile in branch A and scopes the list', async () => {
      const res = await post('/api/accounting/ap/recurring-profiles', branchA, {
        supplierId: supplierAId,
        profileName: `${tag} Monthly`,
        cadence: 'MONTHLY',
        expectedAmount: '90000',
        nextDueDate: '2025-08-01',
        startDate: '2025-01-01',
      });
      expect(res.status).toBe(201);
      recurringProfileAId = res.body.id;

      const own = await get('/api/accounting/ap/recurring-profiles?take=100', branchA);
      expect(own.body.data.map((p: any) => p.id)).toContain(recurringProfileAId);

      const foreign = await get('/api/accounting/ap/recurring-profiles?take=100', branchB);
      expect(foreign.body.data.map((p: any) => p.id)).not.toContain(recurringProfileAId);
    });

    it('ages only the acting branch’s open bills', async () => {
      // The bill approved above is branch A's, worth 250000 and open.
      const own = await get('/api/accounting/ap/aging', branchA);
      const foreign = await get('/api/accounting/ap/aging', branchB);
      expect(own.status).toBe(200);
      expect(foreign.status).toBe(200);

      const inOwn = own.body.bySupplier.some((s: any) => s.supplierId === supplierAId);
      const inForeign = foreign.body.bySupplier.some((s: any) => s.supplierId === supplierAId);
      expect(inOwn).toBe(true);
      // An aging total that includes another branch's bills cannot be
      // reconciled against the bill list on the same screen.
      expect(inForeign).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Accounts Receivable
  // ───────────────────────────────────────────────────────────

  describe('ar/accounts — honoured only ?branchId=, never the header', () => {
    it('creates a customer account in branch A', async () => {
      const res = await post('/api/accounting/ar/accounts', branchA, {
        name: `${tag} Customer A`,
        code: `${tag}-CUST-A`,
        type: 'CORPORATE',
        currencyCode: 'UGX',
      });
      expect(res.status).toBe(201);
      customerAccountAId = res.body.id;
      expect(res.body.branchId).toBe(branchA);
    });

    it('is listed under its own branch only, with NO query param supplied', async () => {
      const own = await get('/api/accounting/ar/accounts?take=100', branchA);
      expect(own.body.data.map((a: any) => a.id)).toContain(customerAccountAId);

      const foreign = await get('/api/accounting/ar/accounts?take=100', branchB);
      expect(foreign.status).toBe(200);
      expect(foreign.body.data.map((a: any) => a.id)).not.toContain(customerAccountAId);
    });

    it('cannot be reached by passing the other branch as ?branchId=', async () => {
      // The query filter narrows WITHIN the header scope; it can no longer be
      // used as an alternative scope.
      const res = await get(`/api/accounting/ar/accounts?take=100&branchId=${branchA}`, branchB);
      expect(res.status).toBe(200);
      expect(res.body.data.map((a: any) => a.id)).not.toContain(customerAccountAId);
    });

    it('resolves the DETAIL under its own branch and 404s under another', async () => {
      expect((await get(`/api/accounting/ar/accounts/${customerAccountAId}`, branchA)).status).toBe(
        200,
      );
      expect((await get(`/api/accounting/ar/accounts/${customerAccountAId}`, branchB)).status).toBe(
        404,
      );
    });
  });

  describe('ar/invoices — list was scoped, DETAIL was not', () => {
    it('creates an invoice in branch A', async () => {
      const res = await post('/api/accounting/ar/invoices', branchA, {
        customerAccountId: customerAccountAId,
        invoiceDate: '2025-06-01',
        dueDate: '2025-07-01',
        lines: [{ description: `${tag} svc`, quantity: 1, unitPrice: '300000' }],
      });
      expect(res.status).toBe(201);
      invoiceAId = res.body.id;
      expect(res.body.branchId).toBe(branchA);
    });

    it('resolves the DETAIL under its own branch and 404s under another', async () => {
      expect((await get(`/api/accounting/ar/invoices/${invoiceAId}`, branchA)).status).toBe(200);
      expect((await get(`/api/accounting/ar/invoices/${invoiceAId}`, branchB)).status).toBe(404);
    });

    it('ages only the acting branch’s open invoices', async () => {
      const own = await get('/api/accounting/ar/aging?take=100', branchA);
      const foreign = await get('/api/accounting/ar/aging?take=100', branchB);
      expect(own.status).toBe(200);
      expect(foreign.status).toBe(200);

      expect(own.body.accounts.map((a: any) => a.customerAccountId)).toContain(customerAccountAId);
      expect(foreign.body.accounts.map((a: any) => a.customerAccountId)).not.toContain(
        customerAccountAId,
      );
    });
  });

  describe('ar/credit-notes — proven leaking live in B0 §6', () => {
    it('creates one in branch A', async () => {
      const res = await post('/api/accounting/ar/credit-notes', branchA, {
        customerAccountId: customerAccountAId,
        creditNoteDate: '2025-06-10',
        amount: '25000',
        reason: `${tag} goodwill`,
      });
      expect(res.status).toBe(201);
      arCreditNoteAId = res.body.id;
      expect(res.body.branchId).toBe(branchA);
    });

    it('is listed under its own branch only', async () => {
      const own = await get('/api/accounting/ar/credit-notes?take=100', branchA);
      expect(own.body.data.map((c: any) => c.id)).toContain(arCreditNoteAId);

      const foreign = await get('/api/accounting/ar/credit-notes?take=100', branchB);
      expect(foreign.status).toBe(200);
      expect(foreign.body.data.map((c: any) => c.id)).not.toContain(arCreditNoteAId);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Bank reconciliation — branchId is NOT NULL on every model here
  // ───────────────────────────────────────────────────────────

  describe('bank-statements — schema truth: BankStatement.branchId is NOT NULL', () => {
    it('imports a statement into branch A', async () => {
      const acct = await post('/api/accounting/bank-accounts', branchA, {
        name: `${tag} Account A`,
        accountCode: `${tag}-BA-A`,
        bankName: 'PC03 Bank',
        currencyCode: 'UGX',
      });
      expect(acct.status).toBe(201);
      bankAccountAId = acct.body.id;

      const res = await post('/api/accounting/bank-statements/import', branchA, {
        bankAccountId: bankAccountAId,
        statementDate: '2025-06-30',
        periodStart: '2025-06-01',
        periodEnd: '2025-06-30',
        openingBalance: 0,
        closingBalance: 50000,
        reference: `${tag}-STMT-A`,
        lines: [
          {
            txDate: '2025-06-15',
            description: `${tag} deposit`,
            amount: 50000,
            direction: 'CREDIT',
          },
        ],
      });
      expect(res.status).toBe(201);
      bankStatementAId = res.body.id;
      expect(res.body.branchId).toBe(branchA);
    });

    it('lists under its own branch only (was: 2 rows, all the other branch’s)', async () => {
      const own = await get('/api/accounting/bank-statements', branchA);
      expect(own.status).toBe(200);
      expect(own.body.map((s: any) => s.id)).toContain(bankStatementAId);

      const foreign = await get('/api/accounting/bank-statements', branchB);
      expect(foreign.status).toBe(200);
      expect(foreign.body.map((s: any) => s.id)).not.toContain(bankStatementAId);
      expect(foreign.body.filter((s: any) => s.branchId === branchA)).toHaveLength(0);
    });

    it('resolves the DETAIL under its own branch and 404s under another', async () => {
      expect((await get(`/api/accounting/bank-statements/${bankStatementAId}`, branchA)).status).toBe(
        200,
      );
      expect((await get(`/api/accounting/bank-statements/${bankStatementAId}`, branchB)).status).toBe(
        404,
      );
    });

    it('cannot import against another branch’s bank account', async () => {
      const res = await post('/api/accounting/bank-statements/import', branchB, {
        bankAccountId: bankAccountAId,
        statementDate: '2025-07-31',
        periodStart: '2025-07-01',
        periodEnd: '2025-07-31',
        openingBalance: 0,
        closingBalance: 0,
        reference: `${tag}-STMT-CROSS`,
        lines: [],
      });
      expect(res.status).toBe(404);
    });
  });

  describe('reconciliation — list and detail were both org-scoped', () => {
    it('creates one in branch A', async () => {
      const res = await post('/api/accounting/reconciliation', branchA, {
        bankAccountId: bankAccountAId,
        bankStatementId: bankStatementAId,
      });
      expect(res.status).toBe(201);
      reconciliationAId = res.body.id;
      expect(res.body.branchId).toBe(branchA);
    });

    it('is listed and readable under its own branch only', async () => {
      const own = await get('/api/accounting/reconciliation', branchA);
      expect(own.body.map((r: any) => r.id)).toContain(reconciliationAId);

      const foreign = await get('/api/accounting/reconciliation', branchB);
      expect(foreign.status).toBe(200);
      expect(foreign.body.map((r: any) => r.id)).not.toContain(reconciliationAId);

      expect((await get(`/api/accounting/reconciliation/${reconciliationAId}`, branchA)).status).toBe(
        200,
      );
      expect((await get(`/api/accounting/reconciliation/${reconciliationAId}`, branchB)).status).toBe(
        404,
      );
    });

    it('refuses a cross-branch MATCH — a write against another branch’s books', async () => {
      const line = await prisma.bankStatementLine.findFirstOrThrow({
        where: { bankStatementId: bankStatementAId },
      });

      const foreign = await request(app.getHttpServer())
        .patch(`/api/accounting/reconciliation/${reconciliationAId}/match`)
        .set(auth(branchB))
        .send({ bankStatementLineId: line.id, manualEntryId: undefined, journalLineId: undefined });
      expect(foreign.status).toBe(404);

      const untouched = await prisma.bankStatementLine.findUniqueOrThrow({
        where: { id: line.id },
      });
      expect(untouched.status).toBe('UNMATCHED');
    });
  });

  // ───────────────────────────────────────────────────────────
  // Org-level by design — documented, NOT "fixed" by inventing a column
  // ───────────────────────────────────────────────────────────

  describe('org-level surfaces stay org-level', () => {
    it('fiscal periods, posting source maps and tax config carry no branchId at all', async () => {
      // These three Prisma models have NO branch_id column. They are org-wide
      // by design, so branch scoping is not applicable and none was invented.
      // Both branches must therefore agree, and that agreement is the contract
      // B5 documents rather than a leak it works around.
      for (const path of [
        '/api/accounting/periods',
        '/api/accounting/posting-source-maps',
        '/api/accounting/tax-config',
      ]) {
        const a = await get(path, branchA);
        const b = await get(path, branchB);
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
      }
    });

    it('period-close-runs are org-level: every row carries branchId NULL', async () => {
      // `PeriodCloseRun.branchId` is nullable and the close path never sets it,
      // so there is no branch to scope to. Verified against the table rather
      // than asserted from the endpoint alone.
      const stamped = await prisma.periodCloseRun.count({ where: { branchId: { not: null } } });
      expect(stamped).toBe(0);

      const a = await get('/api/accounting/period-close-runs', branchA);
      expect(a.status).toBe(200);
    });
  });
});
