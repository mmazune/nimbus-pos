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

const _mockCostCenter = {
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
        update: jest.fn(),
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
        expect.objectContaining({
          action: 'JOURNAL_CREATED',
          // C-26: this event used to omit branchId entirely, making it structurally
          // invisible to the branch-scoped audit-timeline endpoint.
          metadata: expect.objectContaining({ branchId: ctx.branchId }),
        }),
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
        branchId: ctx.branchId,
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
        branchId: ctx.branchId,
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

    // BGB3-L3 / PC-03: JournalEntry.branchId is nullable — the predicate must be
    // `OR: [{branchId}, {branchId: null}]`, never strict equality (which would
    // orphan every org-level journal from every branch at once), and must be
    // fail-closed when no branch is resolved (matches listPostingErrors).
    describe('PC-03 branch scoping', () => {
      it('applies the OR-nullable predicate, not strict equality', async () => {
        prisma.journalEntry.findMany.mockResolvedValue([]);
        prisma.journalEntry.count.mockResolvedValue(0);

        await service.listJournals({ orgId: ctx.organizationId, branchId: ctx.branchId });

        const where = prisma.journalEntry.findMany.mock.calls[0][0].where;
        expect(where.OR).toEqual([{ branchId: ctx.branchId }, { branchId: null }]);
      });

      it('is fail-closed when no branch is resolved', async () => {
        await expect(service.listJournals({ orgId: ctx.organizationId } as any)).rejects.toThrow(
          /without a branch id/,
        );
      });
    });
  });

  // ── getJournal ──

  describe('getJournal', () => {
    it('should return journal with lines and relations', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(mockJournal);

      const result = await service.getJournal({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        journalId: 'journal-1',
      });

      expect(result).toEqual(mockJournal);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.getJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          journalId: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    // C-25: getJournal used to resolve by `{id, orgId}` alone with NO branch
    // predicate at all — a journal id from one branch's list stayed readable by
    // the same id under a different branch's header.
    describe('C-25 branch scoping', () => {
      it('applies the same OR-nullable predicate as listJournals', async () => {
        prisma.journalEntry.findFirst.mockResolvedValue(mockJournal);

        await service.getJournal({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          journalId: 'journal-1',
        });

        const where = prisma.journalEntry.findFirst.mock.calls[0][0].where;
        expect(where.OR).toEqual([{ branchId: ctx.branchId }, { branchId: null }]);
      });

      it('is fail-closed when no branch is resolved', async () => {
        await expect(
          service.getJournal({ orgId: ctx.organizationId, journalId: 'journal-1' } as any),
        ).rejects.toThrow(/without a branch id/);
      });

      it('refuses a journal belonging to a different branch (returns 404, not the row)', async () => {
        // Simulates the fail-closed Prisma predicate excluding a cross-branch row —
        // findFirst returns null because the branch-B journal never matches branch-A's scope.
        prisma.journalEntry.findFirst.mockResolvedValue(null);

        await expect(
          service.getJournal({
            orgId: ctx.organizationId,
            branchId: 'branch-A',
            journalId: 'journal-owned-by-branch-B',
          }),
        ).rejects.toThrow(NotFoundException);

        const where = prisma.journalEntry.findFirst.mock.calls[0][0].where;
        expect(where.OR).toEqual([{ branchId: 'branch-A' }, { branchId: null }]);
      });
    });
  });

  // ── reverseJournal ──

  describe('reverseJournal', () => {
    it('should create a reversal entry and mark original as REVERSED', async () => {
      const postedJournal = { ...mockJournal, status: 'POSTED' };
      prisma.journalEntry.findFirst
        .mockResolvedValueOnce(postedJournal) // original lookup
        .mockResolvedValueOnce(null) // check for existing reversal
        .mockResolvedValueOnce(null); // journal number lookup

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
        expect.objectContaining({
          action: 'JOURNAL_REVERSED',
          // C-26: stamps the original journal's own branchId.
          metadata: expect.objectContaining({ branchId: postedJournal.branchId }),
        }),
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
        .mockResolvedValueOnce({ ...mockJournal, status: 'POSTED' }) // original
        .mockResolvedValueOnce({ id: 'existing-reversal' }); // existing reversal

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
      // C-26: POSTING_RUN_STARTED and the success-path POSTING_RUN_FINISHED both
      // used to omit branchId entirely.
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'POSTING_RUN_STARTED',
          metadata: expect.objectContaining({ branchId: ctx.branchId }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'POSTING_RUN_FINISHED',
          metadata: expect.objectContaining({ branchId: ctx.branchId, status: 'SUCCEEDED' }),
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
      // C-26: POSTING_ERROR_CREATED and the failure-path POSTING_RUN_FINISHED both
      // used to omit branchId entirely.
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'POSTING_ERROR_CREATED',
          metadata: expect.objectContaining({ branchId: ctx.branchId }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'POSTING_RUN_FINISHED',
          metadata: expect.objectContaining({ branchId: ctx.branchId, status: 'FAILED' }),
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

    // BGB3-L3: PostingRun.branchId is nullable and was strictly filtered — same
    // defect class as journals, fixed the same way.
    describe('PC-03 branch scoping', () => {
      it('applies the OR-nullable predicate, not strict equality', async () => {
        prisma.postingRun.findMany.mockResolvedValue([]);
        prisma.postingRun.count.mockResolvedValue(0);

        await service.listPostingRuns({ orgId: ctx.organizationId, branchId: ctx.branchId });

        const where = prisma.postingRun.findMany.mock.calls[0][0].where;
        expect(where.OR).toEqual([{ branchId: ctx.branchId }, { branchId: null }]);
      });

      it('is fail-closed when no branch is resolved', async () => {
        await expect(service.listPostingRuns({ orgId: ctx.organizationId } as any)).rejects.toThrow(
          /without a branch id/,
        );
      });
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
        branchId: ctx.branchId,
        status: 'OPEN',
      });

      expect(prisma.postingError.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OPEN' }),
        }),
      );
    });

    // B5-F3 (backend gap batch 3): the DTO already rejects take > 100, but the
    // service clamps defensively too (mirrors MAX_LEAVE_PAGE_SIZE in
    // attendance.service.ts) so no caller — validated or not — forces an
    // unbounded read.
    it('B5-F3: clamps an oversized take to the 100-row maximum', async () => {
      prisma.postingError.findMany.mockResolvedValue([]);
      prisma.postingError.count.mockResolvedValue(0);

      await service.listPostingErrors({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        take: 10000,
      });

      expect(prisma.postingError.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('normal paging is unaffected by the clamp', async () => {
      prisma.postingError.findMany.mockResolvedValue([]);
      prisma.postingError.count.mockResolvedValue(0);

      await service.listPostingErrors({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        take: 25,
      });

      expect(prisma.postingError.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 }),
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
        postingRun: {
          id: 'run-1',
          sourceKey: 'ORDER_REVENUE',
          status: 'FAILED',
          runKey: 'ORDER_REVENUE:doc-1',
        },
      };
      prisma.postingError.findFirst.mockResolvedValue(mockError);

      const result = await service.getPostingError({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        errorId: 'err-1',
      });

      expect(result).toEqual(mockError);
    });

    it('should throw NotFoundException when error not found', async () => {
      prisma.postingError.findFirst.mockResolvedValue(null);

      await expect(
        service.getPostingError({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          errorId: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── PC-03 branch scoping ────────────────────────────────────────────────
  describe('PC-03 posting-error scoping', () => {
    it('applies the same predicate to the list and the detail', async () => {
      prisma.postingError.findMany.mockResolvedValue([]);
      prisma.postingError.count.mockResolvedValue(0);
      prisma.postingError.findFirst.mockResolvedValue({ id: 'err-1' });

      await service.listPostingErrors({ orgId: ctx.organizationId, branchId: ctx.branchId });
      await service.getPostingError({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        errorId: 'err-1',
      });

      const listWhere = prisma.postingError.findMany.mock.calls[0][0].where;
      const detailWhere = prisma.postingError.findFirst.mock.calls[0][0].where;

      // B0 could only verify this one statically (0 posting-error rows on the
      // dataset): the detail resolved by orgId alone while the list filtered by
      // branch — the MP0-12 shape.
      expect(listWhere.OR).toEqual([{ branchId: ctx.branchId }, { branchId: null }]);
      expect(detailWhere.OR).toEqual(listWhere.OR);
    });

    it('is fail-closed when no branch is resolved', async () => {
      await expect(
        service.getPostingError({ orgId: ctx.organizationId, errorId: 'err-1' } as any),
      ).rejects.toThrow(/without a branch id/);
    });
  });

  // ── resolvePostingError / dismissPostingError (B5.4-D1, backend gap batch 4) ──

  describe('resolvePostingError / dismissPostingError', () => {
    const openError = {
      id: 'err-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      status: 'OPEN',
      code: 'POSTING_FAILED',
      message: 'boom',
    };

    it('resolves an OPEN posting error and stamps a branch-scoped audit event', async () => {
      prisma.postingError.findFirst.mockResolvedValue(openError);
      prisma.postingError.update.mockResolvedValue({ ...openError, status: 'RESOLVED' });

      const result = await service.resolvePostingError({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        errorId: 'err-1',
        userId: 'user-1',
        resolutionNotes: 'Fixed the source map',
      });

      expect(result.status).toBe('RESOLVED');
      expect(prisma.postingError.update).toHaveBeenCalledWith({
        where: { id: 'err-1' },
        data: {
          status: 'RESOLVED',
          resolvedById: 'user-1',
          resolvedAt: expect.any(Date),
          resolutionNotes: 'Fixed the source map',
        },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'POSTING_ERROR_RESOLVED',
          metadata: expect.objectContaining({
            branchId: openError.branchId,
            oldStatus: 'OPEN',
            newStatus: 'RESOLVED',
          }),
        }),
      );
    });

    it('dismisses an OPEN posting error and stamps a branch-scoped audit event', async () => {
      prisma.postingError.findFirst.mockResolvedValue(openError);
      prisma.postingError.update.mockResolvedValue({ ...openError, status: 'DISMISSED' });

      const result = await service.dismissPostingError({
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        errorId: 'err-1',
        userId: 'user-1',
      });

      expect(result.status).toBe('DISMISSED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'POSTING_ERROR_DISMISSED',
          metadata: expect.objectContaining({
            branchId: openError.branchId,
            newStatus: 'DISMISSED',
          }),
        }),
      );
    });

    it('rejects resolving an already-RESOLVED posting error', async () => {
      prisma.postingError.findFirst.mockResolvedValue({ ...openError, status: 'RESOLVED' });

      await expect(
        service.resolvePostingError({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          errorId: 'err-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.postingError.update).not.toHaveBeenCalled();
    });

    it('rejects dismissing an already-DISMISSED posting error', async () => {
      prisma.postingError.findFirst.mockResolvedValue({ ...openError, status: 'DISMISSED' });

      await expect(
        service.dismissPostingError({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          errorId: 'err-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for a cross-branch/unknown posting error', async () => {
      prisma.postingError.findFirst.mockResolvedValue(null);

      await expect(
        service.resolvePostingError({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          errorId: 'nonexistent',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('is fail-closed when no branch is resolved', async () => {
      await expect(
        service.resolvePostingError({
          orgId: ctx.organizationId,
          errorId: 'err-1',
          userId: 'user-1',
        } as any),
      ).rejects.toThrow(/without a branch id/);
    });
  });
});
