import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M35 Accounts Receivable — Customer Accounts + Invoices + Receipts + Credit Notes e2e tests.
 * Requires seeded DB with M35 permissions.
 */
describe('Accounts Receivable (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;

  // IDs captured during tests
  let customerAccountId: string;
  let invoiceId: string;
  let invoiceId2: string;
  let receiptId: string;
  let creditNoteId: string;

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
    // Clean up in reverse dependency order
    if (creditNoteId) {
      await prisma.arCreditNote.deleteMany({ where: { id: creditNoteId } });
    }
    if (receiptId) {
      await prisma.receiptAllocation.deleteMany({ where: { receiptId } });
      await prisma.arReceipt.deleteMany({ where: { id: receiptId } });
    }
    if (invoiceId) {
      await prisma.invoiceLine.deleteMany({ where: { invoiceId } });
      await prisma.invoice.deleteMany({ where: { id: invoiceId } });
    }
    if (invoiceId2) {
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: invoiceId2 } });
      await prisma.invoice.deleteMany({ where: { id: invoiceId2 } });
    }
    if (customerAccountId) {
      await prisma.customerAccount.deleteMany({ where: { id: customerAccountId } });
    }
    await app.close();
  }, 30000);

  // ── Customer Accounts ──

  describe('POST /api/accounting/ar/accounts', () => {
    it('should create a customer account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'E2E Corp',
          code: 'E2E-CORP-01',
          type: 'CORPORATE',
          contactName: 'Test Contact',
          email: 'e2e@corp.local',
          currencyCode: 'UGX',
          creditLimit: '5000000',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('E2E Corp');
      expect(res.body.code).toBe('E2E-CORP-01');
      expect(res.body.type).toBe('CORPORATE');
      customerAccountId = res.body.id;
    });

    it('should reject duplicate code within same org', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'E2E Corp Duplicate',
          code: 'E2E-CORP-01',
          type: 'CORPORATE',
        });

      expect(res.status).toBe(409);
    });

    it('should reject missing name', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ code: 'E2E-NO-NAME', type: 'INDIVIDUAL' });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/accounts')
        .set('x-branch-id', branchId)
        .send({ name: 'No Auth', code: 'E2E-NOAUTH' });

      expect(res.status).toBe(401);
    });

    it('should reject unauthorized role (Chef has no ar:account:write)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/accounts')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({ name: 'Chef Account', code: 'E2E-CHEF-01', type: 'INDIVIDUAL' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/accounting/ar/accounts', () => {
    it('should list customer accounts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/accounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter by status=ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/accounts?status=ACTIVE')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data.every((a: any) => a.status === 'ACTIVE')).toBe(true);
    });

    it('should return 403 for chef', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/accounts')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/accounting/ar/accounts/:id', () => {
    it('should return a single customer account', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounting/ar/accounts/${customerAccountId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(customerAccountId);
    });

    it('should return 404 for unknown account id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/accounts/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── Invoices ──

  describe('POST /api/accounting/ar/invoices', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    it('should create an ISSUED invoice with auto-generated number', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          invoiceDate: tomorrow,
          dueDate: nextMonth,
          currencyCode: 'UGX',
          sourceType: 'DIRECT_BILL',
          lines: [
            {
              description: 'E2E Service A',
              quantity: 2,
              unitPrice: '100000',
              taxRate: 18,
            },
            {
              description: 'E2E Service B',
              quantity: 1,
              unitPrice: '50000',
              taxRate: 0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.invoiceNumber).toMatch(/^INV-\d{6}$/);
      expect(res.body.status).toBe('ISSUED');
      expect(res.body.lines).toHaveLength(2);
      invoiceId = res.body.id;
    });

    it('should create a second invoice for receipt testing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          invoiceDate: tomorrow,
          dueDate: nextMonth,
          currencyCode: 'UGX',
          lines: [
            { description: 'E2E Receipt Test', quantity: 1, unitPrice: '500000', taxRate: 0 },
          ],
        });

      expect(res.status).toBe(201);
      invoiceId2 = res.body.id;
    });

    it('should reject missing customerAccountId → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          invoiceDate: tomorrow,
          dueDate: nextMonth,
          lines: [{ description: 'X', quantity: 1, unitPrice: '100' }],
        });

      expect(res.status).toBe(400);
    });

    it('should reject empty lines array → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          invoiceDate: tomorrow,
          dueDate: nextMonth,
          lines: [],
        });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/invoices')
        .set('x-branch-id', branchId)
        .send({ customerAccountId, invoiceDate: tomorrow, dueDate: nextMonth, lines: [] });

      expect(res.status).toBe(401);
    });

    it('should reject unauthorized role (Chef) → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/invoices')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          invoiceDate: tomorrow,
          dueDate: nextMonth,
          lines: [{ description: 'X', quantity: 1, unitPrice: '100' }],
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/accounting/ar/invoices', () => {
    it('should list invoices', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by status=ISSUED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/invoices?status=ISSUED')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data.every((i: any) => i.status === 'ISSUED')).toBe(true);
    });
  });

  describe('GET /api/accounting/ar/invoices/:id', () => {
    it('should return a single invoice', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounting/ar/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(invoiceId);
      expect(res.body.lines).toBeDefined();
    });

    it('should return 404 for unknown invoice id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/invoices/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── Receipts ──

  describe('POST /api/accounting/ar/receipts', () => {
    it('should create a partial receipt and mark invoice PARTIALLY_PAID', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/receipts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          receiptDate: today,
          amount: '300000',
          paymentMethod: 'BANK_TRANSFER',
          reference: 'E2E-TRANSFER-001',
          currencyCode: 'UGX',
          allocations: [{ invoiceId: invoiceId2, amount: '300000' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.allocations).toHaveLength(1);
      receiptId = res.body.id;
    });

    it('should reject when allocation total != receipt amount → 400', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/receipts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          receiptDate: today,
          amount: '500000',
          paymentMethod: 'CASH',
          allocations: [{ invoiceId: invoiceId2, amount: '300000' }], // mismatch
        });

      expect(res.status).toBe(400);
    });

    it('should reject over-allocation exceeding outstanding balance → 400', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/receipts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          receiptDate: today,
          amount: '999999999',
          paymentMethod: 'CASH',
          allocations: [{ invoiceId: invoiceId2, amount: '999999999' }],
        });

      expect(res.status).toBe(400);
    });

    it('should reject receipt against a non-existent invoiceId → 404', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/receipts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          receiptDate: today,
          amount: '100',
          paymentMethod: 'CASH',
          allocations: [{ invoiceId: 'nonexistent-inv-id', amount: '100' }],
        });

      expect(res.status).toBe(404);
    });

    it('should reject unauthenticated → 401', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/receipts')
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          receiptDate: today,
          amount: '100',
          paymentMethod: 'CASH',
          allocations: [],
        });

      expect(res.status).toBe(401);
    });
  });

  // ── Aging Summary ──

  describe('GET /api/accounting/ar/aging', () => {
    it('should return aging summary with bucket structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/aging')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.accounts).toBeDefined();
      expect(Array.isArray(res.body.accounts)).toBe(true);
      expect(res.body.totals).toBeDefined();
      expect(res.body.totals.grandTotal).toBeDefined();
      expect(res.body.totals.grand_current).toBeDefined();
      expect(res.body.totals.grand_1_30).toBeDefined();
    });

    it('should support asOf query param', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/aging?asOf=2025-01-01')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
    });

    it('should return 401 for unauthenticated → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/aging')
        .set('x-branch-id', branchId);

      expect(res.status).toBe(401);
    });

    it('should return 403 for chef role', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/aging')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });
  });

  // ── AR Credit Notes ──

  describe('POST /api/accounting/ar/credit-notes', () => {
    it('should create a credit note without invoiceId', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/credit-notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          creditNoteDate: today,
          amount: '50000',
          currencyCode: 'UGX',
          reason: 'Overcharge adjustment e2e',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('OPEN');
      expect(res.body.creditNoteNumber).toMatch(/^AR-CN-/);
      creditNoteId = res.body.id;
    });

    it('should create a credit note linked to an invoice', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/credit-notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          customerAccountId,
          invoiceId,
          creditNoteDate: today,
          amount: '10000',
          currencyCode: 'UGX',
          reason: 'Partial service reversal',
        });

      expect(res.status).toBe(201);
      expect(res.body.invoiceId).toBe(invoiceId);
      // Clean up the second credit note
      if (res.body.id) {
        await prisma.arCreditNote.deleteMany({ where: { id: res.body.id } });
      }
    });

    it('should reject missing required fields → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/credit-notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ customerAccountId });

      expect(res.status).toBe(400);
    });

    it('should reject unauthorized role (Chef) → 403', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ar/credit-notes')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({ customerAccountId, creditNoteDate: today, amount: '1000' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/accounting/ar/credit-notes', () => {
    it('should list AR credit notes', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ar/credit-notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });
  });
});
