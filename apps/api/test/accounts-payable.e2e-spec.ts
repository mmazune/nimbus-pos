import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

describe('AccountsPayable (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;
  let orgId: string;

  // IDs captured during tests
  let supplierId: string;
  let supplierIdB: string;
  let supplierUtilityId: string;
  let billId: string;
  let billId2: string;
  let paymentId: string;
  let creditNoteId: string;
  let recurringProfileId: string;
  let generatedRecurringBillId: string;
  let reminderId: string;

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

    // Wake Neon (free tier suspends quickly; retry until DB responds)
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }

    // Login as owner
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as chef (no AP permissions — for 403 tests)
    const chefLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'chef@demo.local', password: 'Chef#123' });
    chefToken = chefLogin.body.accessToken;

    // Resolve branch + org
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

    const org = await prisma.organization.findFirst();
    orgId = org!.id;
  }, 120000);

  afterAll(async () => {
    // Clean up reminders
    if (reminderId) {
      await prisma.payableReminder.deleteMany({ where: { id: reminderId } });
    }
    // Clean up generated recurring bill
    if (generatedRecurringBillId) {
      await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: generatedRecurringBillId } });
      await prisma.vendorBill.deleteMany({ where: { id: generatedRecurringBillId } });
    }
    // Clean up recurring profiles
    if (recurringProfileId) {
      await prisma.recurringBillProfile.deleteMany({ where: { id: recurringProfileId } });
    }
    // Clean up in reverse dependency order
    if (paymentId) {
      await prisma.vendorPaymentAllocation.deleteMany({ where: { vendorPaymentId: paymentId } });
      await prisma.vendorPayment.deleteMany({ where: { id: paymentId } });
    }
    if (creditNoteId) {
      await prisma.creditNote.deleteMany({ where: { id: creditNoteId } });
    }
    if (billId2) {
      await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: billId2 } });
      await prisma.vendorBill.deleteMany({ where: { id: billId2 } });
    }
    if (billId) {
      await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: billId } });
      await prisma.vendorBill.deleteMany({ where: { id: billId } });
    }
    // Clean up e2e test suppliers by code prefix
    const testSuppliers = await prisma.supplier.findMany({
      where: { orgId, code: { startsWith: 'E2E-' } },
    });
    for (const s of testSuppliers) {
      await prisma.payableReminder.deleteMany({ where: { supplierId: s.id } });
      // Remove recurring bills first (they have recurringProfileId FK)
      const recurringBills = await prisma.vendorBill.findMany({
        where: { supplierId: s.id, recurringProfileId: { not: null } },
      });
      for (const rb of recurringBills) {
        await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: rb.id } });
      }
      await prisma.vendorBill.deleteMany({
        where: { supplierId: s.id, recurringProfileId: { not: null } },
      });
      await prisma.recurringBillProfile.deleteMany({ where: { supplierId: s.id } });
      await prisma.creditNote.deleteMany({ where: { supplierId: s.id } });
      const bills = await prisma.vendorBill.findMany({ where: { supplierId: s.id } });
      for (const b of bills) {
        await prisma.vendorPaymentAllocation.deleteMany({ where: { vendorBillId: b.id } });
        await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: b.id } });
      }
      await prisma.vendorBill.deleteMany({ where: { supplierId: s.id } });
      await prisma.vendorPayment.deleteMany({ where: { supplierId: s.id } });
    }
    await prisma.supplier.deleteMany({ where: { orgId, code: { startsWith: 'E2E-' } } });
    await app.close();
  }, 30000);

  // ── POST /accounting/ap/suppliers ──

  describe('POST /api/accounting/ap/suppliers', () => {
    it('should create a supplier', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'E2E Produce Ltd',
          code: 'E2E-SUP-001',
          currencyCode: 'UGX',
          email: 'e2e@producelimited.local',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('E2E Produce Ltd');
      expect(res.body.code).toBe('E2E-SUP-001');
      supplierId = res.body.id;
    });

    it('should return 409 when creating supplier with duplicate code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Duplicate Supplier',
          code: 'E2E-SUP-001',
          currencyCode: 'UGX',
        });

      expect(res.status).toBe(409);
    });

    it('should create a second supplier', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'E2E Equipment Co',
          code: 'E2E-SUP-002',
          currencyCode: 'UGX',
        });

      expect(res.status).toBe(201);
      supplierIdB = res.body.id;
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/suppliers')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({ name: 'No Access Ltd', code: 'E2E-NA-001', currencyCode: 'UGX' });

      expect(res.status).toBe(403);
    });

    it('should return 400 for missing required name', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ code: 'E2E-NO-NAME' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /accounting/ap/suppliers ──

  describe('GET /api/accounting/ap/suppliers', () => {
    it('should list suppliers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/suppliers')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /accounting/ap/bills ──

  describe('POST /api/accounting/ap/bills', () => {
    it('should create a vendor bill in DRAFT status', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          sourceType: 'MANUAL_SERVICE',
          billDate: '2025-01-15',
          issueDate: '2025-01-15',
          dueDate: '2025-02-14',
          lines: [
            {
              description: 'E2E Produce delivery',
              quantity: 2,
              unitPrice: '100',
              taxRate: 18,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.supplierId).toBe(supplierId);
      billId = res.body.id;
    });

    it('should return 404 for non-existent supplier', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: 'nonexistent-supplier-id',
          sourceType: 'MANUAL_SERVICE',
          billDate: '2025-01-15',
          issueDate: '2025-01-15',
          dueDate: '2025-02-14',
          lines: [{ description: 'X', quantity: 1, unitPrice: '100' }],
        });

      expect(res.status).toBe(404);
    });

    it('should return 400 for empty lines', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          sourceType: 'MANUAL_SERVICE',
          billDate: '2025-01-15',
          issueDate: '2025-01-15',
          dueDate: '2025-02-14',
          lines: [],
        });

      expect(res.status).toBe(400);
    });

    it('should create a second bill for payment allocation tests', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: supplierIdB,
          sourceType: 'EXPENSE',
          billDate: '2025-01-10',
          issueDate: '2025-01-10',
          dueDate: '2025-01-24',
          lines: [
            { description: 'E2E equipment service', quantity: 1, unitPrice: '500', taxRate: 18 },
          ],
        });

      expect(res.status).toBe(201);
      billId2 = res.body.id;
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          sourceType: 'MANUAL_SERVICE',
          billDate: '2025-01-15',
          issueDate: '2025-01-15',
          dueDate: '2025-02-14',
          lines: [{ description: 'X', quantity: 1, unitPrice: '100' }],
        });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /accounting/ap/bills ──

  describe('GET /api/accounting/ap/bills', () => {
    it('should list bills', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter bills by supplierId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounting/ap/bills?supplierId=${supplierId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data.every((b: any) => b.supplierId === supplierId)).toBe(true);
    });
  });

  // ── GET /accounting/ap/bills/:id ──

  describe('GET /api/accounting/ap/bills/:id', () => {
    it('should get a bill by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounting/ap/bills/${billId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(billId);
      expect(res.body).toHaveProperty('lines');
    });

    it('should return 404 for non-existent bill', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/bills/nonexistent-bill-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(404);
    });
  });

  // ── POST /accounting/ap/bills/:id/approve ──

  describe('POST /api/accounting/ap/bills/:id/approve', () => {
    it('should approve a DRAFT bill', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounting/ap/bills/${billId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('APPROVED');
      expect(res.body.approvedById).toBeTruthy();
    });

    it('should return 409 when approving an already-APPROVED bill', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounting/ap/bills/${billId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(409);
    });

    it('should also approve the second bill', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounting/ap/bills/${billId2}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('APPROVED');
    });

    it('should return 403 for chef user', async () => {
      const tempBillRes = await request(app.getHttpServer())
        .post('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          sourceType: 'MANUAL_SERVICE',
          billDate: '2025-01-15',
          issueDate: '2025-01-15',
          dueDate: '2025-02-14',
          lines: [{ description: 'Temp', quantity: 1, unitPrice: '50' }],
        });
      const tempId = tempBillRes.body.id;

      const res = await request(app.getHttpServer())
        .post(`/api/accounting/ap/bills/${tempId}/approve`)
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(403);

      // Cleanup temp bill
      await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: tempId } });
      await prisma.vendorBill.deleteMany({ where: { id: tempId } });
    });
  });

  // ── POST /accounting/ap/payments ──

  describe('POST /api/accounting/ap/payments', () => {
    it('should create a full AP payment with allocation', async () => {
      // billId is APPROVED, totalAmount = 2*100 + 18% tax = 2*100*1.18 = 236
      const billData = await prisma.vendorBill.findFirst({ where: { id: billId } });
      const fullAmt = billData!.totalAmount.toString();

      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          amount: fullAmt,
          paymentDate: '2025-01-20',
          paymentMethod: 'BANK_TRANSFER',
          reference: 'E2E-PAY-001',
          allocations: [{ vendorBillId: billId, amount: fullAmt }],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      paymentId = res.body.id;

      // Verify bill is now PAID
      const updatedBill = await prisma.vendorBill.findFirst({ where: { id: billId } });
      expect(updatedBill!.status).toBe('PAID');
    });

    it('should return 400 when allocation sum does not equal payment amount', async () => {
      // billId2 is APPROVED
      const billData = await prisma.vendorBill.findFirst({ where: { id: billId2 } });
      const fullAmt = billData!.totalAmount.toString();
      const wrongAmt = (parseFloat(fullAmt) + 100).toFixed(2);

      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: supplierIdB,
          amount: wrongAmt,
          paymentDate: '2025-01-20',
          paymentMethod: 'CASH',
          allocations: [{ vendorBillId: billId2, amount: fullAmt }],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when paying a DRAFT bill', async () => {
      // Create a fresh DRAFT bill
      const draftRes = await request(app.getHttpServer())
        .post('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          sourceType: 'MANUAL_SERVICE',
          billDate: '2025-01-15',
          issueDate: '2025-01-15',
          dueDate: '2025-02-14',
          lines: [{ description: 'Draft test', quantity: 1, unitPrice: '100' }],
        });
      const draftBillId = draftRes.body.id;

      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          amount: '100',
          paymentDate: '2025-01-20',
          paymentMethod: 'CASH',
          allocations: [{ vendorBillId: draftBillId, amount: '100' }],
        });

      expect(res.status).toBe(400);

      // Cleanup
      await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: draftBillId } });
      await prisma.vendorBill.deleteMany({ where: { id: draftBillId } });
    });

    it('should return 400 for over-allocation', async () => {
      // billId2 outstanding amount is its full totalAmount
      const billData = await prisma.vendorBill.findFirst({ where: { id: billId2 } });
      const outstanding = billData!.outstandingAmount.toString();
      const overAmt = (parseFloat(outstanding) + 50).toFixed(2);

      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: supplierIdB,
          amount: overAmt,
          paymentDate: '2025-01-20',
          paymentMethod: 'CASH',
          allocations: [{ vendorBillId: billId2, amount: overAmt }],
        });

      expect(res.status).toBe(400);
    });

    it('should return 403 for chef user', async () => {
      const billData = await prisma.vendorBill.findFirst({ where: { id: billId2 } });
      const amt = billData!.outstandingAmount.toString();

      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/payments')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: supplierIdB,
          amount: amt,
          paymentDate: '2025-01-20',
          paymentMethod: 'CASH',
          allocations: [{ vendorBillId: billId2, amount: amt }],
        });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /accounting/ap/payments ──

  describe('GET /api/accounting/ap/payments', () => {
    it('should list AP payments', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── POST /accounting/ap/credit-notes ──

  describe('POST /api/accounting/ap/credit-notes', () => {
    it('should create a credit note', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/credit-notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          issueDate: '2025-01-18',
          totalAmount: '50',
          reason: 'E2E overcharge reversal',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('OPEN');
      expect(res.body.supplierId).toBe(supplierId);
      creditNoteId = res.body.id;
    });

    it('should return 404 for non-existent supplier', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/credit-notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: 'nonexistent',
          issueDate: '2025-01-18',
          totalAmount: '50',
          reason: 'Test',
        });

      expect(res.status).toBe(404);
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/credit-notes')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          issueDate: '2025-01-18',
          totalAmount: '25',
          reason: 'Unauthorized',
        });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /accounting/ap/credit-notes ──

  describe('GET /api/accounting/ap/credit-notes', () => {
    it('should list credit notes', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/credit-notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── GET /accounting/ap/aging ──

  describe('GET /api/accounting/ap/aging', () => {
    it('should return AP aging summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/aging')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('asOf');
      expect(res.body).toHaveProperty('buckets');
      expect(Array.isArray(res.body.bySupplier)).toBe(true);
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/aging')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /accounting/ap/suppliers (with counterpartyType) ──

  describe('POST /api/accounting/ap/suppliers (counterpartyType)', () => {
    it('should create a utility provider supplier with counterpartyType', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'E2E UMEME Power',
          code: 'E2E-UTIL-001',
          counterpartyType: 'UTILITY_PROVIDER',
          paymentTermDays: 30,
          bankName: 'Stanbic Bank',
          bankAccountNo: '9100001234',
          currencyCode: 'UGX',
        });

      expect(res.status).toBe(201);
      expect(res.body.counterpartyType).toBe('UTILITY_PROVIDER');
      expect(res.body.paymentTermDays).toBe(30);
      expect(res.body.bankName).toBe('Stanbic Bank');
      supplierUtilityId = res.body.id;
    });

    it('should filter suppliers by counterpartyType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/suppliers?counterpartyType=UTILITY_PROVIDER')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((s: any) => s.counterpartyType === 'UTILITY_PROVIDER')).toBe(true);
    });
  });

  // ── POST /accounting/ap/bills (new source types) ──

  describe('POST /api/accounting/ap/bills (expanded source types)', () => {
    it('should create a UTILITY bill with service period', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: supplierUtilityId,
          sourceType: 'UTILITY',
          billDate: '2025-02-01',
          issueDate: '2025-02-01',
          dueDate: '2025-02-28',
          servicePeriodStart: '2025-01-01',
          servicePeriodEnd: '2025-01-31',
          lines: [{ description: 'E2E Electricity Jan 2025', quantity: 1, unitPrice: '350000' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.sourceType).toBe('UTILITY');
      expect(res.body.servicePeriodStart).toBeTruthy();
      expect(res.body.servicePeriodEnd).toBeTruthy();

      // Cleanup
      await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: res.body.id } });
      await prisma.vendorBill.deleteMany({ where: { id: res.body.id } });
    });
  });

  // ── Recurring Bill Profiles ──

  describe('POST /api/accounting/ap/recurring-profiles', () => {
    it('should create a recurring bill profile', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/recurring-profiles')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: supplierUtilityId,
          profileName: 'E2E Monthly Internet',
          cadence: 'MONTHLY',
          expectedAmount: '150000',
          nextDueDate: '2025-03-01',
          startDate: '2025-01-01',
          description: 'E2E fibre internet subscription',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.profileName).toBe('E2E Monthly Internet');
      expect(res.body.cadence).toBe('MONTHLY');
      expect(res.body.isActive).toBe(true);
      recurringProfileId = res.body.id;
    });

    it('should return 404 for nonexistent supplier', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/recurring-profiles')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: 'nonexistent',
          profileName: 'Ghost',
          cadence: 'MONTHLY',
          expectedAmount: '1000',
          nextDueDate: '2025-03-01',
          startDate: '2025-01-01',
        });

      expect(res.status).toBe(404);
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/recurring-profiles')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: supplierUtilityId,
          profileName: 'Blocked',
          cadence: 'MONTHLY',
          expectedAmount: '100',
          nextDueDate: '2025-03-01',
          startDate: '2025-01-01',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/accounting/ap/recurring-profiles', () => {
    it('should list recurring profiles', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/recurring-profiles')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter by supplierId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounting/ap/recurring-profiles?supplierId=${supplierUtilityId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/recurring-profiles')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/accounting/ap/recurring-profiles/:id', () => {
    it('should update a recurring profile', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounting/ap/recurring-profiles/${recurringProfileId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ expectedAmount: '175000', description: 'Updated amount' });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated amount');
    });

    it('should return 404 for nonexistent profile', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/accounting/ap/recurring-profiles/nonexistent')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({ isActive: false });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/accounting/ap/recurring-profiles/:id/generate-bill', () => {
    it('should generate a bill from a recurring profile', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounting/ap/recurring-profiles/${recurringProfileId}/generate-bill`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body.sourceType).toBe('RECURRING');
      expect(res.body.recurringProfileId).toBe(recurringProfileId);
      generatedRecurringBillId = res.body.id;
    });

    // PC-04 — RESOLVED in backend gap batch 2 (2026-08-21). This test was
    // deliberately left RED by B0 because it documented the correct contract
    // while the source did not honour it: the old guard compared
    // `lastBill.dueDate === profile.nextDueDate`, but the generating
    // transaction ADVANCES `nextDueDate` in the same breath, so the two could
    // never be equal again and the ConflictException was unreachable dead code.
    // A second call issued a second bill for the same supplier.
    //
    // It now passes. Do NOT "fix" it by relaxing the expectation to 200 — that
    // would encode a duplicate-billing bug as the contract.
    it('should return 409 when generating duplicate for same cycle', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounting/ap/recurring-profiles/${recurringProfileId}/generate-bill`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(409);
    });

    // PC-04, the other half of the contract: the guard must refuse a DUPLICATE
    // without refusing the legitimate NEXT-PERIOD bill. The profile is MONTHLY,
    // so the second leg is proved by backdating `lastGeneratedAt` past one full
    // cadence — the only part of the state a caller cannot reach through the
    // API, and the reason this leg is asserted here rather than by waiting.
    it('should still generate the next-period bill once the cadence has elapsed', async () => {
      const before = await prisma.vendorBill.count({
        where: { recurringProfileId },
      });
      expect(before).toBe(1);

      const fiveWeeksAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      await prisma.recurringBillProfile.update({
        where: { id: recurringProfileId },
        data: { lastGeneratedAt: fiveWeeksAgo },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/accounting/ap/recurring-profiles/${recurringProfileId}/generate-bill`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.recurringProfileId).toBe(recurringProfileId);

      // Exactly one further bill — 1 -> 2, not 1 -> 3.
      const after = await prisma.vendorBill.count({ where: { recurringProfileId } });
      expect(after).toBe(2);

      // ...and the two bills cover DIFFERENT cycles.
      const bills = await prisma.vendorBill.findMany({
        where: { recurringProfileId },
        select: { dueDate: true },
        orderBy: { dueDate: 'asc' },
      });
      expect(bills[0].dueDate.getTime()).not.toBe(bills[1].dueDate.getTime());
    });

    // PC-04 check 1 — the repaired form of the original intent. Rewinding
    // `nextDueDate` onto a cycle that has already been billed must 409 even
    // though the cadence clock says the profile is eligible.
    it('should return 409 when the targeted cycle has already been billed', async () => {
      const bills = await prisma.vendorBill.findMany({
        where: { recurringProfileId },
        select: { dueDate: true },
        orderBy: { dueDate: 'asc' },
      });
      const alreadyBilledCycle = bills[0].dueDate;

      await prisma.recurringBillProfile.update({
        where: { id: recurringProfileId },
        data: {
          nextDueDate: alreadyBilledCycle,
          lastGeneratedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/accounting/ap/recurring-profiles/${recurringProfileId}/generate-bill`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(409);
      expect(await prisma.vendorBill.count({ where: { recurringProfileId } })).toBe(2);
    });

    it('should return 404 for nonexistent profile', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/recurring-profiles/nonexistent/generate-bill')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(404);
    });
  });

  // ── Payable Reminders ──

  describe('POST /api/accounting/ap/reminders/generate', () => {
    it('should generate reminders for due-soon bills', async () => {
      // First create a bill due soon from the utility supplier
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      const billRes = await request(app.getHttpServer())
        .post('/api/accounting/ap/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId: supplierUtilityId,
          sourceType: 'UTILITY',
          billDate: new Date().toISOString().split('T')[0],
          issueDate: new Date().toISOString().split('T')[0],
          dueDate: dueDate.toISOString().split('T')[0],
          lines: [{ description: 'Due soon bill', quantity: 1, unitPrice: '100000' }],
        });
      const dueSoonBillId = billRes.body.id;

      // Approve it so it's eligible for reminders
      await request(app.getHttpServer())
        .post(`/api/accounting/ap/bills/${dueSoonBillId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/reminders/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('generated');

      // If a reminder was generated for our bill, capture it
      if (res.body.reminders?.length > 0) {
        const found = res.body.reminders.find((r: any) => r.vendorBillId === dueSoonBillId);
        if (found) reminderId = found.id;
      }

      // Cleanup the due-soon bill
      await prisma.payableReminder.deleteMany({ where: { vendorBillId: dueSoonBillId } });
      await prisma.vendorBillLine.deleteMany({ where: { vendorBillId: dueSoonBillId } });
      await prisma.vendorBill.deleteMany({ where: { id: dueSoonBillId } });
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/reminders/generate')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/accounting/ap/reminders', () => {
    it('should list reminders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/reminders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/reminders')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/accounting/ap/reminders/:id/dismiss', () => {
    it('should return 404 for nonexistent reminder', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/reminders/nonexistent/dismiss')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(404);
    });

    it('should return 403 for chef user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounting/ap/reminders/nonexistent/dismiss')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('x-branch-id', branchId)
        .send();

      expect(res.status).toBe(403);
    });
  });

  // ── GET /accounting/ap/bills (expanded filters) ──

  describe('GET /api/accounting/ap/bills (expanded filters)', () => {
    it('should filter bills with dueSoonDays', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/bills?dueSoonDays=30')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('should filter bills by recurring flag', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/bills?recurring=true')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      // Generated recurring bill should appear
      if (generatedRecurringBillId) {
        const found = res.body.data.find((b: any) => b.id === generatedRecurringBillId);
        if (found) {
          expect(found.recurringProfileId).toBeTruthy();
        }
      }
    });

    it('should filter bills by openOnly', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounting/ap/bills?openOnly=true')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
    });
  });
});
