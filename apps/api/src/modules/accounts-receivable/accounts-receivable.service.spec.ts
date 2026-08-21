import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountsReceivableService } from './accounts-receivable.service';
import { CustomerAccountTypeEnum } from './dto/create-customer-account.dto';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { LedgerService } from '../ledger/ledger.service';

const ORG = 'org-1';
const BRANCH = 'branch-1';
const USER = 'user-1';

const mockAccount = {
  id: 'acct-1',
  orgId: ORG,
  branchId: BRANCH,
  name: 'Acme Corp',
  code: 'CORP-001',
  type: 'CORPORATE',
  status: 'ACTIVE',
  contactName: null,
  email: null,
  phone: null,
  address: null,
  taxId: null,
  currencyCode: 'UGX',
  creditLimit: null,
  openBalance: new Prisma.Decimal('0'),
  notes: null,
  metadata: null,
  createdById: USER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInvoiceIssued = {
  id: 'inv-1',
  orgId: ORG,
  branchId: BRANCH,
  customerAccountId: 'acct-1',
  invoiceNumber: 'INV-000001',
  status: 'ISSUED',
  sourceType: 'DIRECT_BILL',
  sourceDocumentId: null,
  invoiceDate: new Date('2025-01-01'),
  issueDate: new Date('2025-01-01'),
  dueDate: new Date('2025-02-01'),
  currencyCode: 'UGX',
  subtotal: new Prisma.Decimal('200'),
  taxAmount: new Prisma.Decimal('36'),
  totalAmount: new Prisma.Decimal('236'),
  outstandingBalance: new Prisma.Decimal('236'),
  issuedAt: new Date(),
  issuedById: USER,
  notes: null,
  metadata: null,
  createdById: USER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInvoicePartiallyPaid = {
  ...mockInvoiceIssued,
  id: 'inv-2',
  invoiceNumber: 'INV-000002',
  status: 'PARTIALLY_PAID',
  totalAmount: new Prisma.Decimal('708000'),
  outstandingBalance: new Prisma.Decimal('408000'),
};

const mockInvoiceDraft = {
  ...mockInvoiceIssued,
  id: 'inv-3',
  invoiceNumber: 'INV-000003',
  status: 'DRAFT',
  totalAmount: new Prisma.Decimal('100'),
  outstandingBalance: new Prisma.Decimal('100'),
};

const mockReceipt = {
  id: 'rcp-1',
  orgId: ORG,
  branchId: BRANCH,
  customerAccountId: 'acct-1',
  receiptNumber: 'RCP-000001',
  status: 'PENDING',
  receiptDate: new Date(),
  currencyCode: 'UGX',
  amount: new Prisma.Decimal('236'),
  remainingAmount: new Prisma.Decimal('0'),
  paymentMethod: 'CASH',
  reference: null,
  journalEntryId: null,
  receivedById: USER,
  notes: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCreditNote = {
  id: 'cn-1',
  orgId: ORG,
  branchId: BRANCH,
  customerAccountId: 'acct-1',
  invoiceId: null,
  creditNoteNumber: 'AR-CN-000001',
  status: 'OPEN',
  creditNoteDate: new Date(),
  currencyCode: 'UGX',
  amount: new Prisma.Decimal('50000'),
  appliedAmount: new Prisma.Decimal('0'),
  remainingAmount: new Prisma.Decimal('50000'),
  reason: 'Overcharge reversal',
  notes: null,
  metadata: null,
  issuedById: USER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AccountsReceivableService', () => {
  let service: AccountsReceivableService;
  let prisma: any;
  let audit: any;
  let ledger: any;

  beforeEach(async () => {
    prisma = {
      customerAccount: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      invoice: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      invoiceLine: {
        createMany: jest.fn(),
      },
      arReceipt: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      receiptAllocation: {
        create: jest.fn(),
      },
      arCreditNote: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };
    ledger = { createJournal: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsReceivableService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: LedgerService, useValue: ledger },
      ],
    }).compile();

    service = module.get<AccountsReceivableService>(AccountsReceivableService);
  });

  // ── computeInvoiceTotals ──

  describe('computeInvoiceTotals', () => {
    it('should compute subtotal, taxAmount, and totalAmount correctly', () => {
      const result = service.computeInvoiceTotals([{ quantity: 2, unitPrice: '100', taxRate: 18 }]);
      expect(result.subtotal.toString()).toBe('200');
      expect(result.taxAmount.toString()).toBe('36');
      expect(result.totalAmount.toString()).toBe('236');
    });

    it('should handle zero tax rate', () => {
      const result = service.computeInvoiceTotals([{ quantity: 5, unitPrice: '1000', taxRate: 0 }]);
      expect(result.subtotal.toString()).toBe('5000');
      expect(result.taxAmount.toString()).toBe('0');
      expect(result.totalAmount.toString()).toBe('5000');
    });

    it('should handle multiple lines', () => {
      const result = service.computeInvoiceTotals([
        { quantity: 1, unitPrice: '100', taxRate: 10 },
        { quantity: 2, unitPrice: '50', taxRate: 0 },
      ]);
      // line1: cost=100, tax=10; line2: cost=100, tax=0
      expect(result.subtotal.toString()).toBe('200');
      expect(result.taxAmount.toString()).toBe('10');
      expect(result.totalAmount.toString()).toBe('210');
    });

    it('should default missing taxRate to 0', () => {
      const result = service.computeInvoiceTotals([{ quantity: 3, unitPrice: '200' }]);
      expect(result.subtotal.toString()).toBe('600');
      expect(result.taxAmount.toString()).toBe('0');
      expect(result.totalAmount.toString()).toBe('600');
    });
  });

  // ── computeAgingBucket ──

  describe('computeAgingBucket', () => {
    const asOf = new Date('2025-04-01');

    it('should return current when due date is in the future', () => {
      const dueDate = new Date('2025-04-10');
      expect(service.computeAgingBucket(dueDate, asOf)).toBe('current');
    });

    it('should return current when due date equals asOf', () => {
      expect(service.computeAgingBucket(asOf, asOf)).toBe('current');
    });

    it('should return 1_30 when 1-30 days overdue', () => {
      const dueDate = new Date('2025-03-15'); // 17 days ago
      expect(service.computeAgingBucket(dueDate, asOf)).toBe('1_30');
    });

    it('should return 31_60 when 31-60 days overdue', () => {
      const dueDate = new Date('2025-02-10'); // 49 days ago
      expect(service.computeAgingBucket(dueDate, asOf)).toBe('31_60');
    });

    it('should return 61_90 when 61-90 days overdue', () => {
      const dueDate = new Date('2025-01-15'); // 75 days ago
      expect(service.computeAgingBucket(dueDate, asOf)).toBe('61_90');
    });

    it('should return 90_plus when more than 90 days overdue', () => {
      const dueDate = new Date('2024-12-01'); // >90 days ago
      expect(service.computeAgingBucket(dueDate, asOf)).toBe('90_plus');
    });
  });

  // ── createCustomerAccount ──

  describe('createCustomerAccount', () => {
    it('should create an account successfully', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(null); // no code conflict
      prisma.customerAccount.create.mockResolvedValue(mockAccount);

      const result = await service.createCustomerAccount({
        orgId: ORG,
        branchId: BRANCH,
        userId: USER,
        dto: {
          name: 'Acme Corp',
          code: 'CORP-001',
          type: CustomerAccountTypeEnum.CORPORATE,
          currencyCode: 'UGX',
        },
      });

      expect(result).toEqual(mockAccount);
      expect(prisma.customerAccount.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CUSTOMER_ACCOUNT_CREATED' }),
      );
    });

    it('should throw ConflictException if code already exists', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);

      await expect(
        service.createCustomerAccount({
          orgId: ORG,
          branchId: BRANCH,
          userId: USER,
          dto: { name: 'Duplicate', code: 'CORP-001' },
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── createInvoice ──

  describe('createInvoice', () => {
    const invoiceDto = {
      customerAccountId: 'acct-1',
      invoiceDate: '2025-01-01',
      dueDate: '2025-02-01',
      currencyCode: 'UGX',
      lines: [{ description: 'Service A', quantity: 2, unitPrice: '100', taxRate: 18 }],
    };

    it('should create an invoice with correct totals and ISSUED status', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);
      prisma.invoice.findFirst.mockResolvedValue(null); // no prior invoice (for number gen)
      const createdInvoice = {
        ...mockInvoiceIssued,
        customerAccount: { id: 'acct-1', name: 'Acme Corp', code: 'CORP-001', type: 'CORPORATE' },
        lines: [],
      };
      prisma.invoice.create.mockResolvedValue(createdInvoice);
      prisma.customerAccount.update.mockResolvedValue({});

      const result = await service.createInvoice({
        orgId: ORG,
        branchId: BRANCH,
        userId: USER,
        dto: invoiceDto,
      });

      expect(result.status).toBe('ISSUED');
      expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
      expect(prisma.customerAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'acct-1' } }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVOICE_CREATED' }),
      );
    });

    it('should throw NotFoundException if customer account not found or inactive', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.createInvoice({ orgId: ORG, branchId: BRANCH, userId: USER, dto: invoiceDto }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if lines are empty', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);

      await expect(
        service.createInvoice({
          orgId: ORG,
          branchId: BRANCH,
          userId: USER,
          dto: { ...invoiceDto, lines: [] },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── createReceipt ──

  describe('createReceipt', () => {
    const receiptDto = {
      customerAccountId: 'acct-1',
      receiptDate: '2025-02-01',
      amount: '236',
      paymentMethod: 'CASH',
      allocations: [{ invoiceId: 'inv-1', amount: '236' }],
    };

    it('should create a receipt and mark invoice PAID when fully settled', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);
      prisma.arReceipt.findFirst.mockResolvedValue(null);
      prisma.invoice.findMany.mockResolvedValue([mockInvoiceIssued]);

      // Simulate transaction: receipt created inside
      const txReceipt = { ...mockReceipt };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          arReceipt: { create: jest.fn().mockResolvedValue(txReceipt) },
          receiptAllocation: { create: jest.fn() },
          invoice: { update: jest.fn() },
          customerAccount: { update: jest.fn() },
        };
        return fn(tx);
      });

      prisma.arReceipt.update.mockResolvedValue({ ...txReceipt, status: 'POSTED' });
      prisma.arReceipt.findFirst.mockResolvedValue({
        ...txReceipt,
        allocations: [],
        customerAccount: mockAccount,
      });

      const result = await service.createReceipt({
        orgId: ORG,
        branchId: BRANCH,
        userId: USER,
        dto: receiptDto,
      });

      expect(result).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if customer account not found', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.createReceipt({ orgId: ORG, branchId: BRANCH, userId: USER, dto: receiptDto }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when allocations array is empty', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);

      await expect(
        service.createReceipt({
          orgId: ORG,
          branchId: BRANCH,
          userId: USER,
          dto: { ...receiptDto, allocations: [] },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when allocation total != receipt amount', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);

      await expect(
        service.createReceipt({
          orgId: ORG,
          branchId: BRANCH,
          userId: USER,
          dto: {
            ...receiptDto,
            amount: '500',
            allocations: [{ invoiceId: 'inv-1', amount: '236' }],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when invoice is in DRAFT status', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);
      prisma.invoice.findMany.mockResolvedValue([mockInvoiceDraft]);

      await expect(
        service.createReceipt({
          orgId: ORG,
          branchId: BRANCH,
          userId: USER,
          dto: {
            ...receiptDto,
            amount: '100',
            allocations: [{ invoiceId: 'inv-3', amount: '100' }],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when allocation exceeds outstanding balance', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);
      prisma.invoice.findMany.mockResolvedValue([mockInvoiceIssued]); // outstanding = 236

      await expect(
        service.createReceipt({
          orgId: ORG,
          branchId: BRANCH,
          userId: USER,
          dto: {
            ...receiptDto,
            amount: '999',
            allocations: [{ invoiceId: 'inv-1', amount: '999' }],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when invoice not found in DB', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);
      prisma.invoice.findMany.mockResolvedValue([]); // no invoices returned

      await expect(
        service.createReceipt({ orgId: ORG, branchId: BRANCH, userId: USER, dto: receiptDto }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getAgingSummary ──

  describe('getAgingSummary', () => {
    it('should return bucketed aging with grand totals', async () => {
      const asOf = new Date('2025-04-01');
      const overdueInvoice = {
        ...mockInvoiceIssued,
        dueDate: new Date('2025-03-15'), // 17 days ago → bucket 1_30
        outstandingBalance: new Prisma.Decimal('200'),
        customerAccount: {
          name: 'Acme Corp',
          code: 'CORP-001',
          type: 'CORPORATE',
          id: 'acct-1',
        },
      };

      prisma.invoice.findMany.mockResolvedValue([overdueInvoice]);

      const result = await service.getAgingSummary({
        orgId: ORG,
        branchId: BRANCH,
        query: { asOf: '2025-04-01' },
      });

      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].bucket_1_30).toBe('200');
      // PC-05: this block was renamed `totals.grand*` -> `summary.*`. The spec
      // asserted the pre-rename names and could not compile, so the whole AR
      // unit suite was dead. Corrected to the shape the service actually
      // returns (verified live in B0 §5).
      expect(result.summary.bucket_1_30).toBe('200');
      expect(result.summary.totalOutstanding).toBe('200');
    });

    it('should return empty accounts when no open invoices', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      const result = await service.getAgingSummary({ orgId: ORG, branchId: BRANCH, query: {} });

      expect(result.accounts).toHaveLength(0);
      expect(result.summary.totalOutstanding).toBe('0');
    });

    // B5-F1 (backend gap batch 3): `summary.*` used to be reduced from the
    // PAGINATED `openInvoices` fetch, so a bounded read understated the
    // branch total. Live repro cited in
    // ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md: on Tapas
    // Downtown, `?take=1` returned `summary.totalOutstanding: 599,800`
    // against a true branch figure of `9,106,400`. This test builds a
    // five-invoice dataset that sums to the identical 9,106,400 and proves
    // `summary` no longer depends on `take` while `accounts`/`total` still do.
    it('B5-F1: summary is page-size independent — identical at take=1, take=3, and unpaginated', async () => {
      const allInvoices = [
        {
          ...mockInvoiceIssued,
          id: 'inv-a',
          customerAccountId: 'acct-1',
          outstandingBalance: new Prisma.Decimal('5000000'),
          dueDate: new Date('2025-03-01'),
          customerAccount: { id: 'acct-1', name: 'A', code: 'A', type: 'CORPORATE' },
        },
        {
          ...mockInvoiceIssued,
          id: 'inv-b',
          customerAccountId: 'acct-2',
          outstandingBalance: new Prisma.Decimal('2000000'),
          dueDate: new Date('2025-02-01'),
          customerAccount: { id: 'acct-2', name: 'B', code: 'B', type: 'CORPORATE' },
        },
        {
          ...mockInvoiceIssued,
          id: 'inv-c',
          customerAccountId: 'acct-3',
          outstandingBalance: new Prisma.Decimal('1500000'),
          dueDate: new Date('2025-01-01'),
          customerAccount: { id: 'acct-3', name: 'C', code: 'C', type: 'CORPORATE' },
        },
        {
          ...mockInvoiceIssued,
          id: 'inv-d',
          customerAccountId: 'acct-4',
          outstandingBalance: new Prisma.Decimal('500000'),
          dueDate: new Date('2024-12-01'),
          customerAccount: { id: 'acct-4', name: 'D', code: 'D', type: 'CORPORATE' },
        },
        {
          ...mockInvoiceIssued,
          id: 'inv-e',
          customerAccountId: 'acct-5',
          outstandingBalance: new Prisma.Decimal('106400'),
          dueDate: new Date('2024-11-01'),
          customerAccount: { id: 'acct-5', name: 'E', code: 'E', type: 'CORPORATE' },
        },
      ];
      const trueTotal = '9106400'; // matches the live branch figure cited in B5-F1

      prisma.invoice.findMany.mockImplementation((args: any) => {
        // The full-set summary query selects minimal columns only (no
        // `include`); the paginated display query includes `customerAccount`.
        if (args?.select) {
          return Promise.resolve(
            allInvoices.map((inv) => ({
              dueDate: inv.dueDate,
              outstandingBalance: inv.outstandingBalance,
            })),
          );
        }
        const skip = args?.skip ?? 0;
        const take = args?.take ?? allInvoices.length;
        return Promise.resolve(allInvoices.slice(skip, skip + take));
      });
      prisma.invoice.count.mockResolvedValue(allInvoices.length);

      const take1 = await service.getAgingSummary({
        orgId: ORG,
        branchId: BRANCH,
        query: { asOf: '2025-04-01', take: 1 } as any,
      });
      const take3 = await service.getAgingSummary({
        orgId: ORG,
        branchId: BRANCH,
        query: { asOf: '2025-04-01', take: 3 } as any,
      });
      const unpaginated = await service.getAgingSummary({
        orgId: ORG,
        branchId: BRANCH,
        query: { asOf: '2025-04-01' } as any,
      });

      // The bug: summary used to shrink with `take`. The fix: it is identical
      // regardless of page size.
      expect(take1.summary.totalOutstanding).toBe(trueTotal);
      expect(take3.summary.totalOutstanding).toBe(trueTotal);
      expect(unpaginated.summary.totalOutstanding).toBe(trueTotal);

      // `total` (the count) is also page-size independent, as before.
      expect(take1.total).toBe(5);
      expect(take3.total).toBe(5);

      // The PAGE fed to `accounts` still varies with `take` — only the grand
      // totals were the bug.
      expect(take1.accounts).toHaveLength(1);
      expect(take3.accounts).toHaveLength(3);
      expect(unpaginated.accounts).toHaveLength(5);
    });
  });

  // ── createArCreditNote ──

  describe('createArCreditNote', () => {
    const creditNoteDto = {
      customerAccountId: 'acct-1',
      creditNoteDate: '2025-02-01',
      amount: '50000',
      reason: 'Overcharge reversal',
    };

    it('should create a credit note successfully without invoiceId', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);
      prisma.arCreditNote.findFirst.mockResolvedValue(null); // for number gen
      prisma.arCreditNote.create.mockResolvedValue(mockCreditNote);

      const result = await service.createArCreditNote({
        orgId: ORG,
        branchId: BRANCH,
        userId: USER,
        dto: creditNoteDto,
      });

      expect(result).toEqual(mockCreditNote);
      expect(prisma.arCreditNote.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AR_CREDIT_NOTE_CREATED' }),
      );
    });

    it('should create a credit note with optional invoiceId', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);
      prisma.invoice.findFirst.mockResolvedValue(mockInvoiceIssued);
      prisma.arCreditNote.findFirst.mockResolvedValue(null);
      prisma.arCreditNote.create.mockResolvedValue({
        ...mockCreditNote,
        invoiceId: 'inv-1',
      });

      const result = await service.createArCreditNote({
        orgId: ORG,
        branchId: BRANCH,
        userId: USER,
        dto: { ...creditNoteDto, invoiceId: 'inv-1' },
      });

      expect((result as any).invoiceId).toBe('inv-1');
    });

    it('should throw NotFoundException if customer account not found', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.createArCreditNote({
          orgId: ORG,
          branchId: BRANCH,
          userId: USER,
          dto: creditNoteDto,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if invoiceId provided but invoice not found', async () => {
      prisma.customerAccount.findFirst.mockResolvedValue(mockAccount);
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.createArCreditNote({
          orgId: ORG,
          branchId: BRANCH,
          userId: USER,
          dto: { ...creditNoteDto, invoiceId: 'nonexistent-inv' },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── PC-03 branch scoping ────────────────────────────────────────────────
  describe('PC-03 branch scoping', () => {
    it('scopes AR credit notes to the acting branch plus org-level rows', async () => {
      prisma.arCreditNote.findMany.mockResolvedValue([]);
      prisma.arCreditNote.count.mockResolvedValue(0);

      await service.listArCreditNotes({ orgId: ORG, branchId: BRANCH });

      const where = prisma.arCreditNote.findMany.mock.calls[0][0].where;
      expect(where.orgId).toBe(ORG);
      expect(where.OR).toEqual([{ branchId: BRANCH }, { branchId: null }]);
    });

    it('scopes customer accounts by the HEADER, not only by ?branchId=', async () => {
      // Before the fix this list honoured the optional query param alone, so
      // the default read — the one every UI issues — was organisation-wide.
      prisma.customerAccount.findMany.mockResolvedValue([]);
      prisma.customerAccount.count.mockResolvedValue(0);

      await service.listCustomerAccounts({ orgId: ORG, branchId: BRANCH, query: {} });

      const where = prisma.customerAccount.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ branchId: BRANCH }, { branchId: null }]);
    });

    it('ages only the acting branch’s invoices', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.invoice.count.mockResolvedValue(0);

      await service.getAgingSummary({ orgId: ORG, branchId: BRANCH, query: {} });

      const where = prisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ branchId: BRANCH }, { branchId: null }]);
    });

    it('is fail-closed when no branch is resolved', async () => {
      await expect(service.listArCreditNotes({ orgId: ORG } as any)).rejects.toThrow(
        /without a branch id/,
      );
    });
  });
});
