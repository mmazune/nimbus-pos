import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountsPayableService } from './accounts-payable.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { LedgerService } from '../ledger/ledger.service';
import { VendorBillSourceTypeDto } from './dto/create-vendor-bill.dto';

const _ctx = { branchId: 'branch-1', organizationId: 'org-1' };

const mockSupplier = {
  id: 'sup-1',
  orgId: 'org-1',
  branchId: 'branch-1',
  code: 'SUPP-001',
  name: 'Fresh Produce Co',
  contactName: 'Alice',
  email: 'alice@fp.local',
  phone: '+256700000001',
  address: null,
  taxId: null,
  currencyCode: 'UGX',
  isActive: true,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBillDraft = {
  id: 'bill-1',
  orgId: 'org-1',
  branchId: 'branch-1',
  supplierId: 'sup-1',
  billNumber: 'BILL-000001',
  status: 'DRAFT',
  sourceType: 'MANUAL_SERVICE',
  sourceDocumentId: null,
  billDate: new Date('2025-01-15'),
  issueDate: new Date('2025-01-16'),
  dueDate: new Date('2025-02-15'),
  currencyCode: 'UGX',
  subtotal: new Prisma.Decimal('200.00'),
  taxAmount: new Prisma.Decimal('36.00'),
  totalAmount: new Prisma.Decimal('236.00'),
  outstandingAmount: new Prisma.Decimal('236.00'),
  notes: null,
  approvedById: null,
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBillApproved = {
  ...mockBillDraft,
  status: 'APPROVED',
  approvedById: 'user-1',
  approvedAt: new Date(),
};

const mockBillPartiallyPaid = {
  ...mockBillApproved,
  id: 'bill-2',
  billNumber: 'BILL-000002',
  status: 'PARTIALLY_PAID',
  totalAmount: new Prisma.Decimal('500.00'),
  outstandingAmount: new Prisma.Decimal('300.00'),
};

const mockPayment = {
  id: 'pay-1',
  orgId: 'org-1',
  branchId: 'branch-1',
  supplierId: 'sup-1',
  paymentNumber: 'AP-PAY-000001',
  status: 'PENDING',
  paymentDate: new Date(),
  currencyCode: 'UGX',
  amount: new Prisma.Decimal('236.00'),
  remainingAmount: new Prisma.Decimal('0'),
  paymentMethod: 'BANK_TRANSFER',
  reference: null,
  notes: null,
  journalEntryId: null,
  paidById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCreditNote = {
  id: 'cn-1',
  orgId: 'org-1',
  branchId: 'branch-1',
  supplierId: 'sup-1',
  creditNoteNumber: 'CN-000001',
  reference: null,
  status: 'OPEN',
  currencyCode: 'UGX',
  totalAmount: new Prisma.Decimal('50.00'),
  appliedAmount: new Prisma.Decimal('0'),
  remainingAmount: new Prisma.Decimal('50.00'),
  issueDate: new Date(),
  reason: 'Overcharge reversal',
  billId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AccountsPayableService', () => {
  let service: AccountsPayableService;
  let prisma: any;
  let audit: any;
  let ledger: any;

  beforeEach(async () => {
    prisma = {
      supplier: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      vendorBill: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      vendorPayment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      vendorPaymentAllocation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      creditNote: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      recurringBillProfile: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      payableReminder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      postingSourceMap: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };
    ledger = { createJournal: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsPayableService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: LedgerService, useValue: ledger },
      ],
    }).compile();

    service = module.get<AccountsPayableService>(AccountsPayableService);
  });

  // ── computeBillTotals ──

  describe('computeBillTotals', () => {
    it('should compute subtotal, taxAmount, and totalAmount correctly', () => {
      const result = service.computeBillTotals([{ quantity: 2, unitPrice: '100', taxRate: 18 }]);
      expect(result.subtotal.toString()).toBe('200');
      expect(result.taxAmount.toString()).toBe('36');
      expect(result.totalAmount.toString()).toBe('236');
    });

    it('should handle zero tax rate', () => {
      const result = service.computeBillTotals([{ quantity: 5, unitPrice: '1000', taxRate: 0 }]);
      expect(result.subtotal.toString()).toBe('5000');
      expect(result.taxAmount.toString()).toBe('0');
      expect(result.totalAmount.toString()).toBe('5000');
    });

    it('should handle multiple lines', () => {
      const result = service.computeBillTotals([
        { quantity: 1, unitPrice: '100', taxRate: 10 },
        { quantity: 2, unitPrice: '50', taxRate: 0 },
      ]);
      // line1: subtotal=100, tax=10; line2: subtotal=100, tax=0
      expect(result.subtotal.toString()).toBe('200');
      expect(result.taxAmount.toString()).toBe('10');
      expect(result.totalAmount.toString()).toBe('210');
    });

    it('should handle missing taxRate (defaults to 0)', () => {
      const result = service.computeBillTotals([{ quantity: 3, unitPrice: '200' }]);
      expect(result.subtotal.toString()).toBe('600');
      expect(result.taxAmount.toString()).toBe('0');
      expect(result.totalAmount.toString()).toBe('600');
    });
  });

  // ── createSupplier ──

  describe('createSupplier', () => {
    it('should create a supplier successfully', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);
      prisma.supplier.create.mockResolvedValue(mockSupplier);

      const result = await service.createSupplier({
        orgId: 'org-1',
        branchId: 'branch-1',
        userId: 'user-1',
        dto: {
          name: 'Fresh Produce Co',
          code: 'SUPP-001',
          currencyCode: 'UGX',
        },
      });

      expect(result).toEqual(mockSupplier);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUPPLIER_CREATED' }),
      );
    });

    it('should throw ConflictException if supplier code already exists', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);

      await expect(
        service.createSupplier({
          orgId: 'org-1',
          branchId: 'branch-1',
          userId: 'user-1',
          dto: { name: 'Duplicate', code: 'SUPP-001', currencyCode: 'UGX' },
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── listSuppliers ──

  describe('listSuppliers', () => {
    it('should return paginated suppliers', async () => {
      prisma.supplier.findMany.mockResolvedValue([mockSupplier]);
      prisma.supplier.count.mockResolvedValue(1);

      const result = await service.listSuppliers({ orgId: 'org-1' });
      expect(result).toEqual({ data: [mockSupplier], total: 1, skip: 0, take: 50 });
    });
  });

  // ── createVendorBill ──

  describe('createVendorBill', () => {
    it('should create a vendor bill in DRAFT status', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.vendorBill.findFirst.mockResolvedValue(null); // for nextBillNumber
      const createdBill = { ...mockBillDraft, lines: [], supplier: mockSupplier };
      prisma.vendorBill.create.mockResolvedValue(createdBill);

      const result = await service.createVendorBill({
        orgId: 'org-1',
        branchId: 'branch-1',
        userId: 'user-1',
        dto: {
          supplierId: 'sup-1',
          sourceType: VendorBillSourceTypeDto.MANUAL_SERVICE,
          billDate: '2025-01-15',
          issueDate: '2025-01-16',
          dueDate: '2025-02-15',
          lines: [{ quantity: 2, unitPrice: '100', description: 'Services', taxRate: 18 }],
        },
      });

      expect(result).toBeDefined();
      expect(prisma.vendorBill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });

    it('should throw NotFoundException when supplier not found', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.createVendorBill({
          orgId: 'org-1',
          branchId: 'branch-1',
          userId: 'user-1',
          dto: {
            supplierId: 'nonexistent',
            sourceType: VendorBillSourceTypeDto.MANUAL_SERVICE,
            billDate: '2025-01-15',
            issueDate: '2025-01-15',
            dueDate: '2025-02-15',
            lines: [{ quantity: 1, unitPrice: '100', description: 'X' }],
          },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no lines provided', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);

      await expect(
        service.createVendorBill({
          orgId: 'org-1',
          branchId: 'branch-1',
          userId: 'user-1',
          dto: {
            supplierId: 'sup-1',
            sourceType: VendorBillSourceTypeDto.MANUAL_SERVICE,
            billDate: '2025-01-15',
            issueDate: '2025-01-15',
            dueDate: '2025-02-15',
            lines: [],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getVendorBill ──

  describe('getVendorBill', () => {
    it('should return a bill by id', async () => {
      const fullBill = {
        ...mockBillApproved,
        lines: [],
        supplier: mockSupplier,
        paymentAllocs: [],
      };
      prisma.vendorBill.findFirst.mockResolvedValue(fullBill);

      const result = await service.getVendorBill({ orgId: 'org-1', billId: 'bill-1' });
      expect(result).toEqual(fullBill);
    });

    it('should throw NotFoundException when bill not found', async () => {
      prisma.vendorBill.findFirst.mockResolvedValue(null);

      await expect(
        service.getVendorBill({ orgId: 'org-1', billId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── approveVendorBill ──

  describe('approveVendorBill', () => {
    it('should approve a DRAFT bill', async () => {
      prisma.vendorBill.findFirst.mockResolvedValue(mockBillDraft);
      const approvedBill = {
        ...mockBillApproved,
        lines: [],
        supplier: mockSupplier,
        approvedBy: { id: 'user-1', firstName: 'Admin', lastName: 'User' },
      };
      prisma.vendorBill.update.mockResolvedValue(approvedBill);

      const result = await service.approveVendorBill({
        orgId: 'org-1',
        billId: 'bill-1',
        userId: 'user-1',
      });

      expect(result.status).toBe('APPROVED');
      expect(prisma.vendorBill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED', approvedById: 'user-1' }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VENDOR_BILL_APPROVED' }),
      );
    });

    it('should throw ConflictException when approving an already APPROVED bill', async () => {
      prisma.vendorBill.findFirst.mockResolvedValue(mockBillApproved);

      await expect(
        service.approveVendorBill({ orgId: 'org-1', billId: 'bill-1', userId: 'user-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when approving a PAID bill', async () => {
      prisma.vendorBill.findFirst.mockResolvedValue({ ...mockBillApproved, status: 'PAID' });

      await expect(
        service.approveVendorBill({ orgId: 'org-1', billId: 'bill-1', userId: 'user-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when bill not found', async () => {
      prisma.vendorBill.findFirst.mockResolvedValue(null);

      await expect(
        service.approveVendorBill({ orgId: 'org-1', billId: 'ghost', userId: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── createApPayment ──

  describe('createApPayment', () => {
    const createPaymentSetup = () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.vendorBill.findFirst.mockResolvedValue(null); // nextPaymentNumber
      prisma.vendorPayment.findFirst.mockResolvedValue(null); // nextPaymentNumber
      prisma.vendorBill.findMany.mockResolvedValue([mockBillApproved]);

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          vendorPayment: { create: jest.fn().mockResolvedValue(mockPayment) },
          vendorPaymentAllocation: { create: jest.fn().mockResolvedValue({}) },
          vendorBill: {
            update: jest.fn().mockResolvedValue({ ...mockBillApproved, status: 'PAID' }),
          },
        };
        return fn(txMock);
      });

      const finalPayment = {
        ...mockPayment,
        status: 'POSTED',
        supplier: mockSupplier,
        allocations: [
          {
            vendorBill: {
              id: 'bill-1',
              billNumber: 'BILL-000001',
              totalAmount: new Prisma.Decimal('236.00'),
            },
          },
        ],
      };
      prisma.vendorPayment.findFirst.mockResolvedValue(finalPayment);
      prisma.vendorPayment.update.mockResolvedValue({ ...finalPayment, status: 'POSTED' });
      prisma.postingSourceMap.findFirst.mockResolvedValue(null); // no source map
      ledger.createJournal.mockResolvedValue('journal-1');

      return finalPayment;
    };

    it('should create a payment with full allocation and post to GL', async () => {
      const expected = createPaymentSetup();
      prisma.postingSourceMap.findFirst.mockResolvedValue({
        debitAccountId: 'acct-ap',
        creditAccountId: 'acct-cash',
      });

      const result = await service.createApPayment({
        orgId: 'org-1',
        branchId: 'branch-1',
        userId: 'user-1',
        dto: {
          supplierId: 'sup-1',
          amount: '236.00',
          paymentDate: '2025-01-20',
          paymentMethod: 'BANK_TRANSFER',
          allocations: [{ vendorBillId: 'bill-1', amount: '236.00' }],
        },
      });

      expect(result).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AP_PAYMENT_CREATED' }),
      );
      void expected;
    });

    it('should throw BadRequestException when allocation sum does not match payment amount', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.vendorPayment.findFirst.mockResolvedValue(null);

      await expect(
        service.createApPayment({
          orgId: 'org-1',
          branchId: 'branch-1',
          userId: 'user-1',
          dto: {
            supplierId: 'sup-1',
            amount: '300.00',
            paymentDate: '2025-01-20',
            paymentMethod: 'BANK_TRANSFER',
            allocations: [{ vendorBillId: 'bill-1', amount: '200.00' }],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when paying a DRAFT bill', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.vendorPayment.findFirst.mockResolvedValue(null);
      prisma.vendorBill.findMany.mockResolvedValue([mockBillDraft]);

      await expect(
        service.createApPayment({
          orgId: 'org-1',
          branchId: 'branch-1',
          userId: 'user-1',
          dto: {
            supplierId: 'sup-1',
            amount: '236.00',
            paymentDate: '2025-01-20',
            paymentMethod: 'BANK_TRANSFER',
            allocations: [{ vendorBillId: 'bill-1', amount: '236.00' }],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when over-allocating', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.vendorPayment.findFirst.mockResolvedValue(null);
      // Bill outstanding is 300.00, attempt to allocate 400.00
      prisma.vendorBill.findMany.mockResolvedValue([mockBillPartiallyPaid]);

      await expect(
        service.createApPayment({
          orgId: 'org-1',
          branchId: 'branch-1',
          userId: 'user-1',
          dto: {
            supplierId: 'sup-1',
            amount: '400.00',
            paymentDate: '2025-01-20',
            paymentMethod: 'BANK_TRANSFER',
            allocations: [{ vendorBillId: 'bill-2', amount: '400.00' }],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no allocations provided', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.vendorPayment.findFirst.mockResolvedValue(null);

      await expect(
        service.createApPayment({
          orgId: 'org-1',
          branchId: 'branch-1',
          userId: 'user-1',
          dto: {
            supplierId: 'sup-1',
            amount: '100.00',
            paymentDate: '2025-01-20',
            paymentMethod: 'BANK_TRANSFER',
            allocations: [],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create payment with PENDING status if GL posting fails', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.vendorPayment.findFirst.mockResolvedValue(null);
      prisma.vendorBill.findMany.mockResolvedValue([mockBillApproved]);

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          vendorPayment: { create: jest.fn().mockResolvedValue(mockPayment) },
          vendorPaymentAllocation: { create: jest.fn().mockResolvedValue({}) },
          vendorBill: {
            update: jest.fn().mockResolvedValue({ ...mockBillApproved, status: 'PAID' }),
          },
        };
        return fn(txMock);
      });

      prisma.vendorPayment.update.mockResolvedValue({ ...mockPayment, status: 'PENDING' });
      const pendingPayment = {
        ...mockPayment,
        status: 'PENDING',
        supplier: mockSupplier,
        allocations: [],
      };
      prisma.vendorPayment.findFirst.mockResolvedValue(pendingPayment);
      prisma.postingSourceMap.findFirst.mockResolvedValue(null);
      // GL will throw because no source map and no account IDs

      const result = await service.createApPayment({
        orgId: 'org-1',
        branchId: 'branch-1',
        userId: 'user-1',
        dto: {
          supplierId: 'sup-1',
          amount: '236.00',
          paymentDate: '2025-01-20',
          paymentMethod: 'CASH',
          allocations: [{ vendorBillId: 'bill-1', amount: '236.00' }],
        },
      });

      // Payment is returned even though GL failed
      expect(result).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AP_PAYMENT_GL_POSTING_FAILED' }),
      );
    });
  });

  // ── createCreditNote ──

  describe('createCreditNote', () => {
    it('should create a credit note', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.creditNote.findFirst.mockResolvedValue(null); // nextCreditNoteNumber
      const createdCN = { ...mockCreditNote, supplier: mockSupplier };
      prisma.creditNote.create.mockResolvedValue(createdCN);

      const result = await service.createCreditNote({
        orgId: 'org-1',
        branchId: 'branch-1',
        userId: 'user-1',
        dto: {
          supplierId: 'sup-1',
          issueDate: '2025-01-15',
          totalAmount: '50.00',
          reason: 'Overcharge reversal',
        },
      });

      expect(result).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREDIT_NOTE_CREATED' }),
      );
    });

    it('should throw NotFoundException when supplier not found', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.createCreditNote({
          orgId: 'org-1',
          branchId: 'branch-1',
          userId: 'user-1',
          dto: {
            supplierId: 'nonexistent',
            issueDate: '2025-01-15',
            totalAmount: '50.00',
            reason: 'Test',
          },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getApAgingSummary ──

  describe('getApAgingSummary', () => {
    it('should return aging buckets grouped by supplier', async () => {
      const now = new Date();
      const overdue45 = new Date(now);
      overdue45.setDate(overdue45.getDate() - 45);

      const openBills = [
        {
          ...mockBillApproved,
          supplier: { id: 'sup-1', name: 'Fresh Produce Co' },
          dueDate: overdue45,
          outstandingAmount: new Prisma.Decimal('100.00'),
        },
      ];
      prisma.vendorBill.findMany.mockResolvedValue(openBills);

      const result = await service.getApAgingSummary({ orgId: 'org-1' });

      expect(result).toHaveProperty('bySupplier');
      expect(Array.isArray(result.bySupplier)).toBe(true);
      expect(result.bySupplier.length).toBeGreaterThan(0);
      const supplierRow = result.bySupplier.find((r: any) => r.supplierId === 'sup-1');
      expect(supplierRow).toBeDefined();
      // Bill is 45 days overdue — falls in days31to60 bucket
      expect(supplierRow!.days31to60.toString()).toBe('100');
    });
  });

  // ── Recurring Bill Profiles ──

  describe('createRecurringProfile', () => {
    const mockProfile = {
      id: 'rp-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      supplierId: 'sup-1',
      profileName: 'Monthly Internet',
      cadence: 'MONTHLY',
      expectedAmount: new Prisma.Decimal('150000'),
      currencyCode: 'UGX',
      nextDueDate: new Date('2025-03-01'),
      leadDays: 7,
      startDate: new Date('2025-01-01'),
      endDate: null,
      sourceType: 'RECURRING',
      description: 'Internet service',
      isActive: true,
      lastGeneratedAt: null,
      lastGeneratedBillId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      supplier: { id: 'sup-1', name: 'Fresh Produce Co', code: 'SUPP-001' },
    };

    it('should create a recurring profile successfully', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.recurringBillProfile.create.mockResolvedValue(mockProfile);

      const result = await service.createRecurringProfile({
        orgId: 'org-1',
        branchId: 'branch-1',
        userId: 'user-1',
        dto: {
          supplierId: 'sup-1',
          profileName: 'Monthly Internet',
          cadence: 'MONTHLY' as any,
          expectedAmount: '150000',
          nextDueDate: '2025-03-01',
          startDate: '2025-01-01',
          description: 'Internet service',
        },
      });

      expect(result).toEqual(mockProfile);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RECURRING_PROFILE_CREATED' }),
      );
    });

    it('should throw NotFoundException when supplier not found', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.createRecurringProfile({
          orgId: 'org-1',
          branchId: 'branch-1',
          userId: 'user-1',
          dto: {
            supplierId: 'nonexistent',
            profileName: 'Test',
            cadence: 'MONTHLY' as any,
            expectedAmount: '100',
            nextDueDate: '2025-03-01',
            startDate: '2025-01-01',
          },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listRecurringProfiles', () => {
    it('should return paginated recurring profiles', async () => {
      prisma.recurringBillProfile.findMany.mockResolvedValue([]);
      prisma.recurringBillProfile.count.mockResolvedValue(0);

      const result = await service.listRecurringProfiles({ orgId: 'org-1', query: {} });
      expect(result).toEqual({ data: [], total: 0, skip: 0, take: 50 });
    });
  });

  describe('updateRecurringProfile', () => {
    it('should throw NotFoundException when profile not found', async () => {
      prisma.recurringBillProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.updateRecurringProfile({
          orgId: 'org-1',
          profileId: 'nonexistent',
          userId: 'user-1',
          dto: { isActive: false },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update and return profile', async () => {
      const existing = {
        id: 'rp-1',
        orgId: 'org-1',
        profileName: 'Old',
        isActive: true,
      };
      prisma.recurringBillProfile.findFirst.mockResolvedValue(existing);
      const updated = {
        ...existing,
        isActive: false,
        supplier: { id: 'sup-1', name: 'X', code: 'C' },
      };
      prisma.recurringBillProfile.update.mockResolvedValue(updated);

      const result = await service.updateRecurringProfile({
        orgId: 'org-1',
        profileId: 'rp-1',
        userId: 'user-1',
        dto: { isActive: false },
      });

      expect(result.isActive).toBe(false);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RECURRING_PROFILE_UPDATED' }),
      );
    });
  });

  describe('generateBillFromRecurring', () => {
    const activeProfile = {
      id: 'rp-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      supplierId: 'sup-1',
      profileName: 'Monthly Internet',
      cadence: 'MONTHLY',
      expectedAmount: new Prisma.Decimal('150000'),
      currencyCode: 'UGX',
      nextDueDate: new Date('2025-03-01'),
      leadDays: 7,
      startDate: new Date('2025-01-01'),
      endDate: null,
      sourceType: 'RECURRING',
      description: 'Internet service',
      isActive: true,
      lastGeneratedAt: null,
      lastGeneratedBillId: null,
      supplier: mockSupplier,
    };

    it('should generate a bill from the recurring profile', async () => {
      prisma.recurringBillProfile.findFirst.mockResolvedValue(activeProfile);
      prisma.vendorBill.findFirst.mockResolvedValue(null); // nextBillNumber

      const generatedBill = {
        ...mockBillDraft,
        id: 'bill-gen-1',
        billNumber: 'BILL-000001',
        sourceType: 'RECURRING',
        recurringProfileId: 'rp-1',
        lines: [
          { description: 'Internet service', quantity: 1, unitPrice: new Prisma.Decimal('150000') },
        ],
        supplier: { id: 'sup-1', name: 'Fresh Produce Co', code: 'SUPP-001' },
      };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          vendorBill: { create: jest.fn().mockResolvedValue(generatedBill) },
          recurringBillProfile: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.generateBillFromRecurring({
        orgId: 'org-1',
        branchId: 'branch-1',
        userId: 'user-1',
        profileId: 'rp-1',
      });

      expect(result).toBeDefined();
      expect(result.sourceType).toBe('RECURRING');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RECURRING_BILL_GENERATED' }),
      );
    });

    it('should throw NotFoundException for inactive profile', async () => {
      prisma.recurringBillProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.generateBillFromRecurring({
          orgId: 'org-1',
          userId: 'user-1',
          profileId: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if duplicate bill for same cycle', async () => {
      const lastBill = { id: 'bill-prev', dueDate: new Date('2025-03-01') };
      prisma.recurringBillProfile.findFirst.mockResolvedValue({
        ...activeProfile,
        lastGeneratedBillId: 'bill-prev',
      });
      prisma.vendorBill.findFirst.mockResolvedValue(lastBill);

      await expect(
        service.generateBillFromRecurring({
          orgId: 'org-1',
          userId: 'user-1',
          profileId: 'rp-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── Payable Reminders ──

  describe('generateReminders', () => {
    it('should generate reminders for bills due soon', async () => {
      const dueSoon = new Date();
      dueSoon.setDate(dueSoon.getDate() + 5);

      const openBill = {
        ...mockBillApproved,
        dueDate: dueSoon,
        outstandingAmount: new Prisma.Decimal('236.00'),
        supplier: { id: 'sup-1', name: 'Fresh Produce Co', paymentTermDays: 7 },
        reminders: [],
        branchId: 'branch-1',
        currencyCode: 'UGX',
        billNumber: 'BILL-000001',
      };
      prisma.vendorBill.findMany.mockResolvedValue([openBill]);
      prisma.payableReminder.create.mockResolvedValue({
        id: 'rem-1',
        status: 'PENDING',
        vendorBillId: openBill.id,
      });

      const result = await service.generateReminders({ orgId: 'org-1' });
      expect(result.generated).toBe(1);
    });

    it('should not create duplicate reminders for bills that already have PENDING', async () => {
      const dueSoon = new Date();
      dueSoon.setDate(dueSoon.getDate() + 3);

      const billWithReminder = {
        ...mockBillApproved,
        dueDate: dueSoon,
        outstandingAmount: new Prisma.Decimal('100'),
        supplier: { id: 'sup-1', name: 'X', paymentTermDays: 7 },
        reminders: [{ id: 'rem-existing', status: 'PENDING' }],
        branchId: 'branch-1',
        currencyCode: 'UGX',
        billNumber: 'BILL-000002',
      };
      prisma.vendorBill.findMany.mockResolvedValue([billWithReminder]);

      const result = await service.generateReminders({ orgId: 'org-1' });
      expect(result.generated).toBe(0);
    });
  });

  describe('listReminders', () => {
    it('should return paginated reminders', async () => {
      prisma.payableReminder.findMany.mockResolvedValue([]);
      prisma.payableReminder.count.mockResolvedValue(0);

      const result = await service.listReminders({ orgId: 'org-1', query: {} });
      expect(result).toEqual({ data: [], total: 0, skip: 0, take: 50 });
    });
  });

  describe('dismissReminder', () => {
    it('should dismiss a PENDING reminder', async () => {
      const reminder = { id: 'rem-1', orgId: 'org-1', status: 'PENDING', vendorBillId: 'bill-1' };
      prisma.payableReminder.findFirst.mockResolvedValue(reminder);
      prisma.payableReminder.update.mockResolvedValue({ ...reminder, status: 'DISMISSED' });

      const result = await service.dismissReminder({
        orgId: 'org-1',
        reminderId: 'rem-1',
        userId: 'user-1',
      });
      expect(result.status).toBe('DISMISSED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYABLE_REMINDER_DISMISSED' }),
      );
    });

    it('should throw NotFoundException for nonexistent reminder', async () => {
      prisma.payableReminder.findFirst.mockResolvedValue(null);

      await expect(
        service.dismissReminder({ orgId: 'org-1', reminderId: 'nope', userId: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for non-PENDING reminder', async () => {
      prisma.payableReminder.findFirst.mockResolvedValue({
        id: 'rem-1',
        orgId: 'org-1',
        status: 'DISMISSED',
      });

      await expect(
        service.dismissReminder({ orgId: 'org-1', reminderId: 'rem-1', userId: 'user-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── Supplier with counterparty type ──

  describe('createSupplier with counterpartyType', () => {
    it('should create a supplier with counterpartyType and paymentTermDays', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);
      const supplierWithType = {
        ...mockSupplier,
        counterpartyType: 'UTILITY_PROVIDER',
        paymentTermDays: 30,
        bankName: 'MTN Mobile Money',
        bankAccountNo: '256700000001',
      };
      prisma.supplier.create.mockResolvedValue(supplierWithType);

      const result = await service.createSupplier({
        orgId: 'org-1',
        branchId: 'branch-1',
        userId: 'user-1',
        dto: {
          name: 'UMEME Power',
          counterpartyType: 'UTILITY_PROVIDER' as any,
          paymentTermDays: 30,
          bankName: 'MTN Mobile Money',
          bankAccountNo: '256700000001',
        },
      });

      expect(result.counterpartyType).toBe('UTILITY_PROVIDER');
      expect(result.paymentTermDays).toBe(30);
    });
  });
});
