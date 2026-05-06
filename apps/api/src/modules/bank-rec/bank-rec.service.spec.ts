import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BankRecService } from './bank-rec.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';

const ORG = 'org-1';
const BRANCH = 'branch-1';
const USER = 'user-1';
const META = { ipAddress: '127.0.0.1', userAgent: 'jest' };
const CTX = { organizationId: ORG, branchId: BRANCH };

const mockBankAccount = {
  id: 'ba-1',
  orgId: ORG,
  branchId: BRANCH,
  name: 'Main Bank',
  accountCode: 'MBK-001',
  bankName: 'Demo Bank',
  currencyCode: 'UGX',
  isActive: true,
  glAccountId: null,
  notes: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockStatement = {
  id: 'stmt-1',
  orgId: ORG,
  branchId: BRANCH,
  bankAccountId: 'ba-1',
  statementDate: new Date('2025-01-31'),
  periodStart: new Date('2025-01-01'),
  periodEnd: new Date('2025-01-31'),
  openingBalance: new Prisma.Decimal('100000'),
  closingBalance: new Prisma.Decimal('250000'),
  status: 'IMPORTED' as const,
  importedById: USER,
  reference: null,
  notes: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockStatementLine = {
  id: 'sl-1',
  orgId: ORG,
  bankStatementId: 'stmt-1',
  txDate: new Date('2025-01-15'),
  description: 'Sales deposit',
  amount: new Prisma.Decimal('50000'),
  direction: 'CREDIT' as const,
  reference: 'REF-001',
  status: 'UNMATCHED' as const,
  matchedJournalLineId: null,
  matchedManualEntryId: null,
  matchedAt: null,
  matchedById: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockReconciliation = {
  id: 'rec-1',
  orgId: ORG,
  branchId: BRANCH,
  bankAccountId: 'ba-1',
  bankStatementId: 'stmt-1',
  fiscalPeriodId: 'fp-1',
  status: 'OPEN' as const,
  statementBalance: new Prisma.Decimal('250000'),
  matchedTotal: new Prisma.Decimal('0'),
  unmatchedCount: 3,
  matchedCount: 0,
  startedById: USER,
  completedAt: null,
  completedById: null,
  notes: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockReconciliationInProgress = {
  ...mockReconciliation,
  status: 'IN_PROGRESS' as const,
  matchedTotal: new Prisma.Decimal('50000'),
  matchedCount: 1,
  unmatchedCount: 2,
};

const mockFiscalPeriodOpen = {
  id: 'fp-1',
  orgId: ORG,
  name: 'January 2025',
  startsAt: new Date('2025-01-01'),
  endsAt: new Date('2025-01-31'),
  status: 'OPEN' as const,
  openedAt: new Date(),
  openedById: USER,
  closedAt: null,
  closedById: null,
  lockedAt: null,
  lockedById: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFiscalPeriodClosed = {
  ...mockFiscalPeriodOpen,
  status: 'CLOSED' as const,
  closedAt: new Date(),
  closedById: USER,
};

const mockJournalLine = {
  id: 'jl-1',
  orgId: ORG,
  journalEntryId: 'je-1',
  accountId: 'acct-1',
  costCenterId: null,
  direction: 'CREDIT' as const,
  amount: new Prisma.Decimal('50000'),
  description: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockManualEntry = {
  id: 'mbe-1',
  orgId: ORG,
  branchId: BRANCH,
  bankAccountId: 'ba-1',
  txDate: new Date('2025-01-31'),
  amount: new Prisma.Decimal('15000'),
  direction: 'DEBIT' as const,
  description: 'Bank charge',
  entryType: 'BANK_CHARGE',
  accountId: null,
  reference: null,
  notes: null,
  createdById: USER,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('BankRecService', () => {
  let service: BankRecService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      bankAccount: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      bankStatement: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      bankStatementLine: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
        count: jest.fn(),
      },
      bankReconciliation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      manualBankEntry: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
      },
      periodCloseRun: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      journalLine: {
        findFirst: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankRecService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<BankRecService>(BankRecService);
  });

  // -- listBankAccounts --

  describe('listBankAccounts', () => {
    it('should return bank accounts for the branch', async () => {
      prisma.bankAccount.findMany.mockResolvedValue([mockBankAccount]);
      const result = await service.listBankAccounts(CTX);
      expect(result).toEqual([mockBankAccount]);
      expect(prisma.bankAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: ORG, branchId: BRANCH } }),
      );
    });
  });

  // -- createBankAccount --

  describe('createBankAccount', () => {
    const dto = { name: 'Main Bank', accountCode: 'MBK-001', bankName: 'Demo Bank' };

    it('should create a bank account when code is unique', async () => {
      prisma.bankAccount.findUnique.mockResolvedValue(null);
      prisma.bankAccount.create.mockResolvedValue(mockBankAccount);
      const result = await service.createBankAccount(USER, CTX, dto, META);
      expect(result).toEqual(mockBankAccount);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_ACCOUNT_CREATED' }),
      );
    });

    it('should throw ConflictException when account code already exists', async () => {
      prisma.bankAccount.findUnique.mockResolvedValue(mockBankAccount);
      await expect(service.createBankAccount(USER, CTX, dto, META)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should validate glAccountId if provided', async () => {
      prisma.bankAccount.findUnique.mockResolvedValue(null);
      prisma.account.findFirst.mockResolvedValue(null);
      await expect(
        service.createBankAccount(USER, CTX, { ...dto, glAccountId: 'bad-gl' }, META),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -- listBankStatements --

  describe('listBankStatements', () => {
    it('should return bank statements for the org', async () => {
      prisma.bankStatement.findMany.mockResolvedValue([mockStatement]);
      const result = await service.listBankStatements(CTX);
      expect(result).toEqual([mockStatement]);
    });

    it('should filter by bankAccountId when provided', async () => {
      prisma.bankStatement.findMany.mockResolvedValue([mockStatement]);
      await service.listBankStatements(CTX, 'ba-1');
      expect(prisma.bankStatement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ bankAccountId: 'ba-1' }) }),
      );
    });
  });

  // -- getBankStatement --

  describe('getBankStatement', () => {
    it('should return a bank statement with lines', async () => {
      prisma.bankStatement.findFirst.mockResolvedValue({
        ...mockStatement,
        lines: [mockStatementLine],
      });
      const result = await service.getBankStatement(CTX, 'stmt-1');
      expect(result.id).toBe('stmt-1');
    });

    it('should throw NotFoundException when statement not found', async () => {
      prisma.bankStatement.findFirst.mockResolvedValue(null);
      await expect(service.getBankStatement(CTX, 'no-such-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -- importBankStatement --

  describe('importBankStatement', () => {
    const dto = {
      bankAccountId: 'ba-1',
      statementDate: '2025-01-31',
      periodStart: '2025-01-01',
      periodEnd: '2025-01-31',
      openingBalance: 100000,
      closingBalance: 250000,
      lines: [
        { txDate: '2025-01-15', description: 'Sales deposit', amount: 50000, direction: 'CREDIT' },
      ],
    };

    it('should import a bank statement with lines', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(mockBankAccount);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.bankStatement.create.mockResolvedValue(mockStatement);
      prisma.bankStatementLine.createMany.mockResolvedValue({ count: 1 });
      prisma.bankStatement.findUnique.mockResolvedValue({
        ...mockStatement,
        lines: [mockStatementLine],
      });

      const result = await service.importBankStatement(USER, CTX, dto, META);
      expect(result!.id).toBe('stmt-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_STATEMENT_IMPORTED' }),
      );
    });

    it('should throw NotFoundException when bank account not found', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(null);
      await expect(service.importBankStatement(USER, CTX, dto, META)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on duplicate reference', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(mockBankAccount);
      prisma.bankStatement.findFirst.mockResolvedValue(mockStatement);
      await expect(
        service.importBankStatement(USER, CTX, { ...dto, reference: 'STMT-2025-01' }, META),
      ).rejects.toThrow(ConflictException);
    });
  });

  // -- listReconciliations --

  describe('listReconciliations', () => {
    it('should return reconciliations for the org', async () => {
      prisma.bankReconciliation.findMany.mockResolvedValue([mockReconciliation]);
      const result = await service.listReconciliations(CTX);
      expect(result).toEqual([mockReconciliation]);
    });
  });

  // -- getReconciliation --

  describe('getReconciliation', () => {
    it('should return reconciliation with live difference', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      const result = await service.getReconciliation(CTX, 'rec-1');
      expect(result.difference).toBe('250000.00');
    });

    it('should throw NotFoundException when reconciliation not found', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(null);
      await expect(service.getReconciliation(CTX, 'no-such-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -- createReconciliation --

  describe('createReconciliation', () => {
    const dto = { bankAccountId: 'ba-1', bankStatementId: 'stmt-1', fiscalPeriodId: 'fp-1' };

    it('should create a reconciliation', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(mockBankAccount);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodOpen);
      prisma.bankReconciliation.findFirst.mockResolvedValue(null);
      prisma.bankStatement.findFirst.mockResolvedValue(mockStatement);
      prisma.bankStatementLine.count.mockResolvedValue(3);
      prisma.bankReconciliation.create.mockResolvedValue(mockReconciliation);

      const result = await service.createReconciliation(USER, CTX, dto, META);
      expect(result.id).toBe('rec-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_RECONCILIATION_CREATED' }),
      );
    });

    it('should throw ConflictException when active reconciliation exists', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(mockBankAccount);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodOpen);
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      await expect(service.createReconciliation(USER, CTX, dto, META)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when bank account not found', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(null);
      await expect(service.createReconciliation(USER, CTX, dto, META)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -- matchLine --

  describe('matchLine', () => {
    const dto = {
      bankStatementLineId: 'sl-1',
      journalLineId: 'jl-1',
    };

    it('should match a bank statement line to a journal line', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodOpen);
      prisma.bankStatementLine.findFirst.mockResolvedValue(mockStatementLine);
      prisma.journalLine.findFirst.mockResolvedValue(mockJournalLine);

      const txMock = {
        bankStatementLine: {
          update: jest.fn().mockResolvedValue({ ...mockStatementLine, status: 'MATCHED' }),
          findMany: jest
            .fn()
            .mockResolvedValue([{ amount: new Prisma.Decimal('50000'), direction: 'CREDIT' }]),
          count: jest.fn().mockResolvedValue(2),
        },
        bankReconciliation: { update: jest.fn().mockResolvedValue(mockReconciliationInProgress) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      const result = await service.matchLine(USER, CTX, 'rec-1', dto, META);
      expect(result.status).toBe('MATCHED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_STATEMENT_LINE_MATCHED' }),
      );
    });

    it('should throw NotFoundException when reconciliation not found', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(null);
      await expect(service.matchLine(USER, CTX, 'rec-1', dto, META)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when reconciliation is completed', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue({
        ...mockReconciliation,
        status: 'COMPLETED',
      });
      await expect(service.matchLine(USER, CTX, 'rec-1', dto, META)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when line is already matched', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodOpen);
      prisma.bankStatementLine.findFirst.mockResolvedValue({
        ...mockStatementLine,
        status: 'MATCHED',
      });
      await expect(service.matchLine(USER, CTX, 'rec-1', dto, META)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when neither journalLineId nor manualEntryId provided', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodOpen);
      prisma.bankStatementLine.findFirst.mockResolvedValue(mockStatementLine);
      await expect(
        service.matchLine(USER, CTX, 'rec-1', { bankStatementLineId: 'sl-1' }, META),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when fiscal period is locked', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        ...mockFiscalPeriodOpen,
        status: 'LOCKED',
      });
      await expect(service.matchLine(USER, CTX, 'rec-1', dto, META)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should match a line to a manual bank entry', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodOpen);
      prisma.bankStatementLine.findFirst.mockResolvedValue(mockStatementLine);
      prisma.manualBankEntry.findFirst.mockResolvedValue(mockManualEntry);

      const txMock = {
        bankStatementLine: {
          update: jest.fn().mockResolvedValue({ ...mockStatementLine, status: 'MATCHED' }),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(2),
        },
        bankReconciliation: { update: jest.fn().mockResolvedValue(mockReconciliationInProgress) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      const result = await service.matchLine(
        USER,
        CTX,
        'rec-1',
        { bankStatementLineId: 'sl-1', manualEntryId: 'mbe-1' },
        META,
      );
      expect(result.status).toBe('MATCHED');
    });
  });

  // -- skipLine --

  describe('skipLine', () => {
    const dto = { bankStatementLineId: 'sl-1' };

    it('should skip a bank statement line', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      prisma.bankStatementLine.findFirst.mockResolvedValue(mockStatementLine);

      const txMock = {
        bankStatementLine: {
          update: jest.fn().mockResolvedValue({ ...mockStatementLine, status: 'SKIPPED' }),
          count: jest.fn().mockResolvedValue(2),
        },
        bankReconciliation: { update: jest.fn().mockResolvedValue(mockReconciliation) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      const result = await service.skipLine(USER, CTX, 'rec-1', dto, META);
      expect(result.status).toBe('SKIPPED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_STATEMENT_LINE_SKIPPED' }),
      );
    });

    it('should throw ConflictException when reconciliation is completed', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue({
        ...mockReconciliation,
        status: 'COMPLETED',
      });
      await expect(service.skipLine(USER, CTX, 'rec-1', dto, META)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when line is already matched', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      prisma.bankStatementLine.findFirst.mockResolvedValue({
        ...mockStatementLine,
        status: 'MATCHED',
      });
      await expect(service.skipLine(USER, CTX, 'rec-1', dto, META)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // -- createManualBankEntry --

  describe('createManualBankEntry', () => {
    const dto = {
      bankAccountId: 'ba-1',
      txDate: '2025-01-31',
      amount: 15000,
      direction: 'DEBIT',
      description: 'Bank charge',
      entryType: 'BANK_CHARGE',
    };

    it('should create a manual bank entry', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(mockBankAccount);
      prisma.manualBankEntry.create.mockResolvedValue(mockManualEntry);
      const result = await service.createManualBankEntry(USER, CTX, dto, META);
      expect(result.id).toBe('mbe-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MANUAL_BANK_ENTRY_CREATED' }),
      );
    });

    it('should throw NotFoundException when bank account not found', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(null);
      await expect(service.createManualBankEntry(USER, CTX, dto, META)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate accountId if provided', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(mockBankAccount);
      prisma.account.findFirst.mockResolvedValue(null);
      await expect(
        service.createManualBankEntry(USER, CTX, { ...dto, accountId: 'bad-acct' }, META),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -- completeReconciliation --

  describe('completeReconciliation', () => {
    it('should complete a reconciliation when difference is zero', async () => {
      const balanced = {
        ...mockReconciliationInProgress,
        statementBalance: new Prisma.Decimal('50000'),
        matchedTotal: new Prisma.Decimal('50000'),
      };
      prisma.bankReconciliation.findFirst.mockResolvedValue(balanced);
      prisma.bankReconciliation.update.mockResolvedValue({
        ...balanced,
        status: 'COMPLETED',
      });

      const result = await service.completeReconciliation(USER, CTX, 'rec-1', META);
      expect(result.status).toBe('COMPLETED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_RECONCILIATION_COMPLETED' }),
      );
    });

    it('should throw BadRequestException when difference is not zero', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliationInProgress);
      await expect(service.completeReconciliation(USER, CTX, 'rec-1', META)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when already completed', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue({
        ...mockReconciliation,
        status: 'COMPLETED',
      });
      await expect(service.completeReconciliation(USER, CTX, 'rec-1', META)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when still OPEN', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(mockReconciliation);
      await expect(service.completeReconciliation(USER, CTX, 'rec-1', META)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -- listPeriodCloseRuns --

  describe('listPeriodCloseRuns', () => {
    it('should return period close runs', async () => {
      prisma.periodCloseRun.findMany.mockResolvedValue([]);
      const result = await service.listPeriodCloseRuns(CTX);
      expect(result).toEqual([]);
    });
  });

  // -- closeFiscalPeriod --

  describe('closeFiscalPeriod', () => {
    it('should close an open fiscal period with retained earnings', async () => {
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodOpen);
      prisma.journalLine.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('500000') } })
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('300000') } });

      const closedPeriod = { ...mockFiscalPeriodOpen, status: 'CLOSED' };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          fiscalPeriod: {
            update: jest.fn().mockResolvedValue(closedPeriod),
          },
          periodCloseRun: {
            create: jest.fn().mockResolvedValue({ id: 'pcr-1' }),
          },
        };
        return fn(tx);
      });

      const result = await service.closeFiscalPeriod(USER, ORG, 'fp-1', undefined, META);
      expect(result.status).toBe('CLOSED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FISCAL_PERIOD_CLOSED' }),
      );
    });

    it('should throw NotFoundException when period not found', async () => {
      prisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      await expect(service.closeFiscalPeriod(USER, ORG, 'fp-1', undefined, META)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when period is not OPEN', async () => {
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodClosed);
      await expect(service.closeFiscalPeriod(USER, ORG, 'fp-1', undefined, META)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // -- lockFiscalPeriod --

  describe('lockFiscalPeriod', () => {
    it('should lock a closed fiscal period', async () => {
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodClosed);
      const lockedPeriod = { ...mockFiscalPeriodClosed, status: 'LOCKED' };
      prisma.fiscalPeriod.update.mockResolvedValue(lockedPeriod);

      const result = await service.lockFiscalPeriod(USER, ORG, 'fp-1', META);
      expect(result.status).toBe('LOCKED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FISCAL_PERIOD_LOCKED' }),
      );
    });

    it('should throw NotFoundException when period not found', async () => {
      prisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      await expect(service.lockFiscalPeriod(USER, ORG, 'fp-1', META)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when period is not CLOSED', async () => {
      prisma.fiscalPeriod.findFirst.mockResolvedValue(mockFiscalPeriodOpen);
      await expect(service.lockFiscalPeriod(USER, ORG, 'fp-1', META)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
