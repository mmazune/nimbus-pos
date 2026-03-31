import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';

const ctx = { branchId: 'branch-1', organizationId: 'org-1' };

const mockAccount = {
  id: 'acct-1',
  orgId: 'org-1',
  code: '1000',
  name: 'Cash on Hand',
  status: 'ACTIVE',
};

const mockAccount2 = {
  id: 'acct-2',
  orgId: 'org-1',
  code: '4000',
  name: 'Sales Revenue',
  status: 'ACTIVE',
};

const mockCostCenter = {
  id: 'cc-1',
  orgId: 'org-1',
  code: 'MAIN',
  name: 'Main Branch',
  active: true,
};

const mockFiscalPeriod = {
  id: 'fp-1',
  orgId: 'org-1',
  name: '2024-Q1',
  status: 'OPEN',
};

const mockJournal = {
  id: 'journal-1',
  orgId: 'org-1',
  branchId: 'branch-1',
  journalNumber: 'JNL-000001',
  journalDate: new Date('2024-01-15'),
  status: 'POSTED',
  sourceKey: null,
  sourceDocumentId: null,
  reference: 'Opening Balance',
  description: 'Opening balance entry',
  fiscalPeriodId: 'fp-1',
  reversedFromId: null,
  reversalOfId: null,
  totalDebit: { toString: () => '1000.00' },
  totalCredit: { toString: () => '1000.00' },
  postedAt: new Date(),
  postedById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  lines: [
    {
      id: 'line-1',
      orgId: 'org-1',
      journalEntryId: 'journal-1',
      accountId: 'acct-1',
      costCenterId: null,
      direction: 'DEBIT',
      amount: { toString: () => '1000.00' },
      description: 'Cash debit',
      account: { id: 'acct-1', code: '1000', name: 'Cash on Hand' },
    },
    {
      id: 'line-2',
      orgId: 'org-1',
      journalEntryId: 'journal-1',
      accountId: 'acct-2',
      costCenterId: null,
      direction: 'CREDIT',
      amount: { toString: () => '1000.00' },
      description: 'Revenue credit',
      account: { id: 'acct-2', code: '4000', name: 'Sales Revenue' },
    },
  ],
};

const mockPostingSourceMap = {
  id: 'psm-1',
  orgId: 'org-1',
  sourceKey: 'ORDER_REVENUE',
  debitAccountId: 'acct-1',
  creditAccountId: 'acct-2',
  active: true,
  debitAccount: { id: 'acct-1', code: '1000', name: 'Cash on Hand' },
  creditAccount: { id: 'acct-2', code: '4000', name: 'Sales Revenue' },
};

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      journalEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn(),
      },
      account: {
        findMany: jest.fn(),
      },
      costCenter: {
        findMany: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      postingRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      postingError: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      postingSourceMap: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  // ── createJournal ──

  describe('createJournal', () => {
    const validDto = {
      journalDate: '2024-01-15',
      reference: 'Opening Balance',
      description: 'Opening balance entry',
      fiscalPeriodId: 'fp-1',
      lines: [
        {
          accountId: 'acct-1',
          direction: 'DEBIT' as const,
          amount: '1000.00',
          description: 'Cash debit',
        },
        {
          accountId: 'acct-2',
          direction: 'CREDIT' as const,
          amount: '1000.00',
          description: 'Revenue credit',
        },
      ],
    };

    it('should create a balanced journal entry', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([mockAccount, mockAccount2]);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriod);
      prisma.journalEntry.create.mockResolvedValue(mockJournal);

      const result = await service.createJournal({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: 'user-1',
        dto: validDto,
      });

      expect(result).toEqual(mockJournal);
      expect(prisma.journalEntry.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'JOURNAL_CREATED' }),
      );
    });

    it('should reject unbalanced journal (debits ≠ credits)', async () => {
      const unbalancedDto = {
        ...validDto,
        lines: [
          { accountId: 'acct-1', direction: 'DEBIT' as const, amount: '1000.00' },
          { accountId: 'acct-2', direction: 'CREDIT' as const, amount: '500.00' },
        ],
      };

      prisma.journalEntry.findFirst.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([mockAccount, mockAccount2]);

      await expect(
        service.createJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          userId: 'user-1',
          dto: unbalancedDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject zero or negative line amounts', async () => {
      const negativeDto = {
        ...validDto,
        lines: [
          { accountId: 'acct-1', direction: 'DEBIT' as const, amount: '-100.00' },
          { accountId: 'acct-2', direction: 'CREDIT' as const, amount: '-100.00' },
        ],
      };

      await expect(
        service.createJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          userId: 'user-1',
          dto: negativeDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when account not found or inactive', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([mockAccount]); // only 1 of 2

      await expect(
        service.createJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          userId: 'user-1',
          dto: validDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when cost center not found', async () => {
      const dtoWithCc = {
        ...validDto,
        lines: [
          {
            accountId: 'acct-1',
            costCenterId: 'cc-missing',
            direction: 'DEBIT' as const,
            amount: '1000.00',
          },
          {
            accountId: 'acct-2',
            direction: 'CREDIT' as const,
            amount: '1000.00',
          },
        ],
      };

      prisma.journalEntry.findFirst.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([mockAccount, mockAccount2]);
      prisma.costCenter.findMany.mockResolvedValue([]);

      await expect(
        service.createJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          userId: 'user-1',
          dto: dtoWithCc,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when fiscal period not OPEN', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([mockAccount, mockAccount2]);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(null);

      await expect(
        service.createJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          userId: 'user-1',
          dto: validDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── listJournals ──

  describe('listJournals', () => {
    it('should return paginated journals', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([mockJournal]);
      prisma.journalEntry.count.mockResolvedValue(1);

      const result = await service.listJournals({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
      });

      expect(result.data).toEqual([mockJournal]);
      expect(result.total).toBe(1);
      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: 'org-1' }),
        }),
      );
    });

    it('should filter by status and sourceKey', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);
      prisma.journalEntry.count.mockResolvedValue(0);

      await service.listJournals({
        orgId: ctx.organizationId,
        status: 'POSTED',
        sourceKey: 'ORDER_REVENUE',
      });

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-1',
            status: 'POSTED',
            sourceKey: 'ORDER_REVENUE',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);
      prisma.journalEntry.count.mockResolvedValue(0);

      await service.listJournals({
        orgId: ctx.organizationId,
        from: '2024-01-01',
        to: '2024-03-31',
      });

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-1',
            journalDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  // ── getJournal ──

  describe('getJournal', () => {
    it('should return journal with lines and relations', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(mockJournal);

      const result = await service.getJournal({
        orgId: ctx.organizationId,
        journalId: 'journal-1',
      });

      expect(result).toEqual(mockJournal);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.getJournal({
          orgId: ctx.organizationId,
          journalId: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── reverseJournal ──

  describe('reverseJournal', () => {
    it('should create a reversal entry and mark original as REVERSED', async () => {
      const postedJournal = { ...mockJournal, status: 'POSTED' };
      prisma.journalEntry.findFirst
        .mockResolvedValueOnce(postedJournal) // original lookup
        .mockResolvedValueOnce(null)          // check for existing reversal
        .mockResolvedValueOnce(null);         // journal number lookup

      const reversalJournal = {
        ...mockJournal,
        id: 'journal-2',
        journalNumber: 'JNL-000002',
        reversedFromId: 'journal-1',
      };
      prisma.journalEntry.create.mockResolvedValue(reversalJournal);
      prisma.journalEntry.update.mockResolvedValue({
        ...postedJournal,
        status: 'REVERSED',
        reversalOfId: 'journal-2',
      });

      const result = await service.reverseJournal({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        journalId: 'journal-1',
        userId: 'user-1',
        reason: 'Correction',
      });

      expect(result).toEqual(reversalJournal);
      expect(prisma.journalEntry.create).toHaveBeenCalled();
      expect(prisma.journalEntry.update).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'JOURNAL_REVERSED' }),
      );
    });

    it('should reject reversing an already REVERSED journal', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({
        ...mockJournal,
        status: 'REVERSED',
      });

      await expect(
        service.reverseJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          journalId: 'journal-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject reversing a DRAFT journal', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({
        ...mockJournal,
        status: 'DRAFT',
      });

      await expect(
        service.reverseJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          journalId: 'journal-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if journal already has a reversal', async () => {
      prisma.journalEntry.findFirst
        .mockResolvedValueOnce({ ...mockJournal, status: 'POSTED' })    // original
        .mockResolvedValueOnce({ id: 'existing-reversal' });            // existing reversal

      await expect(
        service.reverseJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          journalId: 'journal-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when journal not found', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.reverseJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          journalId: 'nonexistent',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── replayPosting ──

  describe('replayPosting', () => {
    it('should create a posting run and journal entry on success', async () => {
      prisma.postingRun.findFirst.mockResolvedValue(null); // no existing run
      prisma.postingRun.create.mockResolvedValue({
        id: 'run-1',
        orgId: 'org-1',
        sourceKey: 'ORDER_REVENUE',
        status: 'PENDING',
        runKey: 'ORDER_REVENUE:doc-1',
      });
      prisma.postingSourceMap.findFirst.mockResolvedValue(mockPostingSourceMap);
      prisma.journalEntry.findFirst.mockResolvedValue(null); // journal number lookup
      prisma.journalEntry.create.mockResolvedValue({
        ...mockJournal,
        sourceKey: 'ORDER_REVENUE',
      });
      prisma.postingRun.update.mockResolvedValue({
        id: 'run-1',
        status: 'SUCCEEDED',
        journalEntryId: 'journal-1',
        journalEntry: mockJournal,
      });

      const result = await service.replayPosting({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: 'user-1',
        sourceKey: 'ORDER_REVENUE',
        sourceDocumentId: 'doc-1',
      });

      expect(result.alreadyPosted).toBe(false);
      expect(prisma.postingRun.create).toHaveBeenCalled();
      expect(prisma.journalEntry.create).toHaveBeenCalled();
      expect(prisma.postingRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED' }),
        }),
      );
    });

    it('should return existing run for idempotent replay', async () => {
      const existingRun = {
        id: 'run-1',
        orgId: 'org-1',
        runKey: 'ORDER_REVENUE:doc-1',
        status: 'SUCCEEDED',
        journalEntry: { id: 'journal-1', journalNumber: 'JNL-000001' },
      };
      prisma.postingRun.findFirst.mockResolvedValue(existingRun);

      const result = await service.replayPosting({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: 'user-1',
        sourceKey: 'ORDER_REVENUE',
        sourceDocumentId: 'doc-1',
      });

      expect(result.alreadyPosted).toBe(true);
      expect(result.postingRun).toEqual(existingRun);
      expect(prisma.postingRun.create).not.toHaveBeenCalled();
    });

    it('should create posting error when source map not found', async () => {
      prisma.postingRun.findFirst.mockResolvedValue(null);
      prisma.postingRun.create.mockResolvedValue({
        id: 'run-1',
        orgId: 'org-1',
        sourceKey: 'UNKNOWN_KEY',
        status: 'PENDING',
        runKey: 'UNKNOWN_KEY:manual',
      });
      prisma.postingSourceMap.findFirst.mockResolvedValue(null); // no mapping
      prisma.postingError.create.mockResolvedValue({
        id: 'err-1',
        orgId: 'org-1',
        postingRunId: 'run-1',
        code: 'POSTING_FAILED',
        message: 'No active posting source map found for key: UNKNOWN_KEY',
        status: 'OPEN',
      });
      prisma.postingRun.update.mockResolvedValue({
        id: 'run-1',
        status: 'FAILED',
        errorCount: 1,
      });

      const result = await service.replayPosting({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: 'user-1',
        sourceKey: 'UNKNOWN_KEY',
      });

      expect(result.alreadyPosted).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('POSTING_FAILED');
      expect(prisma.postingError.create).toHaveBeenCalled();
      expect(prisma.postingRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  // ── listPostingRuns ──

  describe('listPostingRuns', () => {
    it('should return paginated posting runs', async () => {
      const mockRun = { id: 'run-1', orgId: 'org-1', status: 'SUCCEEDED' };
      prisma.postingRun.findMany.mockResolvedValue([mockRun]);
      prisma.postingRun.count.mockResolvedValue(1);

      const result = await service.listPostingRuns({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
      });

      expect(result.data).toEqual([mockRun]);
      expect(result.total).toBe(1);
    });
  });

  // ── listPostingErrors ──

  describe('listPostingErrors', () => {
    it('should return paginated posting errors', async () => {
      const mockError = { id: 'err-1', orgId: 'org-1', status: 'OPEN' };
      prisma.postingError.findMany.mockResolvedValue([mockError]);
      prisma.postingError.count.mockResolvedValue(1);

      const result = await service.listPostingErrors({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
      });

      expect(result.data).toEqual([mockError]);
      expect(result.total).toBe(1);
    });

    it('should filter by error status', async () => {
      prisma.postingError.findMany.mockResolvedValue([]);
      prisma.postingError.count.mockResolvedValue(0);

      await service.listPostingErrors({
        orgId: ctx.organizationId,
        status: 'OPEN',
      });

      expect(prisma.postingError.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OPEN' }),
        }),
      );
    });
  });

  // ── getPostingError ──

  describe('getPostingError', () => {
    it('should return a posting error with associated run', async () => {
      const mockError = {
        id: 'err-1',
        orgId: 'org-1',
        status: 'OPEN',
        postingRun: { id: 'run-1', sourceKey: 'ORDER_REVENUE', status: 'FAILED', runKey: 'ORDER_REVENUE:doc-1' },
      };
      prisma.postingError.findFirst.mockResolvedValue(mockError);

      const result = await service.getPostingError({
        orgId: ctx.organizationId,
        errorId: 'err-1',
      });

      expect(result).toEqual(mockError);
    });

    it('should throw NotFoundException when error not found', async () => {
      prisma.postingError.findFirst.mockResolvedValue(null);

      await expect(
        service.getPostingError({
          orgId: ctx.organizationId,
          errorId: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
