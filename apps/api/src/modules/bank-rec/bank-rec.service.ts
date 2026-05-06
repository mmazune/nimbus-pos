import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Prisma } from '@prisma/client';
import {
  CreateBankAccountDto,
  ImportBankStatementDto,
  CreateReconciliationDto,
  MatchLineDto,
  CreateManualBankEntryDto,
  SkipLineDto,
  PeriodCloseDto,
} from './dto';

interface BranchContext {
  organizationId: string;
  branchId: string;
}

interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class BankRecService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ═══════════════════════════════════════════════════
  // ── Bank Accounts ──
  // ═══════════════════════════════════════════════════

  async listBankAccounts(ctx: BranchContext) {
    return this.prisma.bankAccount.findMany({
      where: { orgId: ctx.organizationId, branchId: ctx.branchId },
      orderBy: { name: 'asc' },
    });
  }

  async createBankAccount(
    userId: string,
    ctx: BranchContext,
    dto: CreateBankAccountDto,
    meta: AuditMeta,
  ) {
    const existing = await this.prisma.bankAccount.findUnique({
      where: {
        orgId_accountCode: { orgId: ctx.organizationId, accountCode: dto.accountCode },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Bank account code "${dto.accountCode}" already exists in this organization`,
      );
    }

    if (dto.glAccountId) {
      const glAccount = await this.prisma.account.findFirst({
        where: { id: dto.glAccountId, orgId: ctx.organizationId },
      });
      if (!glAccount) throw new NotFoundException('GL account not found');
    }

    const account = await this.prisma.bankAccount.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        name: dto.name,
        accountCode: dto.accountCode,
        bankName: dto.bankName,
        currencyCode: dto.currencyCode ?? 'UGX',
        glAccountId: dto.glAccountId,
        isActive: dto.isActive ?? true,
        notes: dto.notes,
      },
    });

    await this.audit.log({
      action: 'BANK_ACCOUNT_CREATED',
      actorUserId: userId,
      entityType: 'BankAccount',
      entityId: account.id,
      metadata: { accountCode: dto.accountCode, bankName: dto.bankName },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return account;
  }

  // ═══════════════════════════════════════════════════
  // ── Bank Statements ──
  // ═══════════════════════════════════════════════════

  async listBankStatements(ctx: BranchContext, bankAccountId?: string) {
    return this.prisma.bankStatement.findMany({
      where: {
        orgId: ctx.organizationId,
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      orderBy: { statementDate: 'desc' },
      include: {
        bankAccount: { select: { id: true, name: true, accountCode: true } },
        importedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  async getBankStatement(ctx: BranchContext, id: string) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id, orgId: ctx.organizationId },
      include: {
        bankAccount: { select: { id: true, name: true, accountCode: true } },
        importedBy: { select: { id: true, firstName: true, lastName: true } },
        lines: { orderBy: { txDate: 'asc' } },
      },
    });
    if (!stmt) throw new NotFoundException('Bank statement not found');
    return stmt;
  }

  async importBankStatement(
    userId: string,
    ctx: BranchContext,
    dto: ImportBankStatementDto,
    meta: AuditMeta,
  ) {
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, orgId: ctx.organizationId },
    });
    if (!bankAccount) throw new NotFoundException('Bank account not found');

    // Duplicate-import check: same bank account + same reference
    if (dto.reference) {
      const duplicate = await this.prisma.bankStatement.findFirst({
        where: {
          orgId: ctx.organizationId,
          bankAccountId: dto.bankAccountId,
          reference: dto.reference,
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `A statement with reference "${dto.reference}" already exists for this bank account`,
        );
      }
    }

    const statement = await this.prisma.$transaction(async (tx) => {
      const stmt = await tx.bankStatement.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          bankAccountId: dto.bankAccountId,
          statementDate: new Date(dto.statementDate),
          periodStart: new Date(dto.periodStart),
          periodEnd: new Date(dto.periodEnd),
          openingBalance: dto.openingBalance,
          closingBalance: dto.closingBalance,
          status: 'IMPORTED',
          importedById: userId,
          reference: dto.reference,
          notes: dto.notes,
        },
      });

      if (dto.lines.length > 0) {
        await tx.bankStatementLine.createMany({
          data: dto.lines.map((l) => ({
            orgId: ctx.organizationId,
            bankStatementId: stmt.id,
            txDate: new Date(l.txDate),
            description: l.description,
            amount: l.amount,
            direction: l.direction as 'DEBIT' | 'CREDIT',
            reference: l.reference,
            status: 'UNMATCHED' as const,
          })),
        });
      }

      return stmt;
    });

    await this.audit.log({
      action: 'BANK_STATEMENT_IMPORTED',
      actorUserId: userId,
      entityType: 'BankStatement',
      entityId: statement.id,
      metadata: {
        bankAccountId: dto.bankAccountId,
        statementDate: dto.statementDate,
        lineCount: dto.lines.length,
        openingBalance: dto.openingBalance,
        closingBalance: dto.closingBalance,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.prisma.bankStatement.findUnique({
      where: { id: statement.id },
      include: {
        lines: { orderBy: { txDate: 'asc' } },
        bankAccount: { select: { id: true, name: true, accountCode: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════
  // ── Reconciliations ──
  // ═══════════════════════════════════════════════════

  async listReconciliations(ctx: BranchContext, bankAccountId?: string) {
    return this.prisma.bankReconciliation.findMany({
      where: {
        orgId: ctx.organizationId,
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        bankAccount: { select: { id: true, name: true, accountCode: true } },
        bankStatement: { select: { id: true, reference: true, closingBalance: true } },
        fiscalPeriod: { select: { id: true, name: true, startsAt: true, endsAt: true } },
        startedBy: { select: { id: true, firstName: true, lastName: true } },
        completedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async createReconciliation(
    userId: string,
    ctx: BranchContext,
    dto: CreateReconciliationDto,
    meta: AuditMeta,
  ) {
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, orgId: ctx.organizationId },
    });
    if (!bankAccount) throw new NotFoundException('Bank account not found');

    if (dto.fiscalPeriodId) {
      const period = await this.prisma.fiscalPeriod.findFirst({
        where: { id: dto.fiscalPeriodId, orgId: ctx.organizationId },
      });
      if (!period) throw new NotFoundException('Fiscal period not found');
    }

    const active = await this.prisma.bankReconciliation.findFirst({
      where: {
        orgId: ctx.organizationId,
        bankAccountId: dto.bankAccountId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
    if (active) {
      throw new ConflictException(
        `An active reconciliation already exists for this bank account (status: ${active.status})`,
      );
    }

    let unmatchedCount = 0;
    let statementBalance = new Prisma.Decimal(0);

    if (dto.bankStatementId) {
      const stmt = await this.prisma.bankStatement.findFirst({
        where: { id: dto.bankStatementId, orgId: ctx.organizationId },
      });
      if (!stmt) throw new NotFoundException('Bank statement not found');
      statementBalance = stmt.closingBalance;
      unmatchedCount = await this.prisma.bankStatementLine.count({
        where: {
          bankStatementId: dto.bankStatementId,
          orgId: ctx.organizationId,
          status: 'UNMATCHED',
        },
      });
    }

    const rec = await this.prisma.bankReconciliation.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        bankAccountId: dto.bankAccountId,
        bankStatementId: dto.bankStatementId,
        fiscalPeriodId: dto.fiscalPeriodId,
        status: 'OPEN',
        statementBalance,
        matchedTotal: 0,
        unmatchedCount,
        matchedCount: 0,
        startedById: userId,
        notes: dto.notes,
      },
      include: {
        bankAccount: { select: { id: true, name: true, accountCode: true } },
        bankStatement: { select: { id: true, reference: true, closingBalance: true } },
        fiscalPeriod: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      action: 'BANK_RECONCILIATION_CREATED',
      actorUserId: userId,
      entityType: 'BankReconciliation',
      entityId: rec.id,
      metadata: {
        bankAccountId: dto.bankAccountId,
        fiscalPeriodId: dto.fiscalPeriodId,
        bankStatementId: dto.bankStatementId,
        unmatchedCount,
        statementBalance: statementBalance.toString(),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return rec;
  }

  // ═══════════════════════════════════════════════════
  // ── Get Reconciliation (with live difference) ──
  // ═══════════════════════════════════════════════════

  async getReconciliation(ctx: BranchContext, id: string) {
    const rec = await this.prisma.bankReconciliation.findFirst({
      where: { id, orgId: ctx.organizationId },
      include: {
        bankAccount: { select: { id: true, name: true, accountCode: true } },
        bankStatement: {
          include: {
            lines: { orderBy: { txDate: 'asc' } },
          },
        },
        fiscalPeriod: { select: { id: true, name: true, startsAt: true, endsAt: true } },
        startedBy: { select: { id: true, firstName: true, lastName: true } },
        completedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!rec) throw new NotFoundException('Reconciliation not found');

    const difference = rec.statementBalance.minus(rec.matchedTotal);
    return { ...rec, difference: difference.toFixed(2) };
  }

  // ═══════════════════════════════════════════════════
  // ── Manual Match ──
  // ═══════════════════════════════════════════════════

  async matchLine(
    userId: string,
    ctx: BranchContext,
    reconciliationId: string,
    dto: MatchLineDto,
    meta: AuditMeta,
  ) {
    const rec = await this.prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, orgId: ctx.organizationId },
    });
    if (!rec) throw new NotFoundException('Reconciliation not found');
    if (rec.status === 'COMPLETED') {
      throw new ConflictException('Cannot match lines on a completed reconciliation');
    }

    if (rec.fiscalPeriodId) {
      const period = await this.prisma.fiscalPeriod.findFirst({
        where: { id: rec.fiscalPeriodId },
      });
      if (period && (period.status === 'LOCKED' || period.status === 'CLOSED')) {
        throw new ConflictException(`Cannot match lines — fiscal period is ${period.status}`);
      }
    }

    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: dto.bankStatementLineId, orgId: ctx.organizationId },
    });
    if (!line) throw new NotFoundException('Bank statement line not found');
    if (line.status === 'MATCHED') {
      throw new ConflictException('Bank statement line is already matched');
    }

    if (!dto.journalLineId && !dto.manualEntryId) {
      throw new BadRequestException('Either journalLineId or manualEntryId must be provided');
    }

    if (dto.journalLineId) {
      const journalLine = await this.prisma.journalLine.findFirst({
        where: { id: dto.journalLineId, orgId: ctx.organizationId },
      });
      if (!journalLine) throw new NotFoundException('Journal line not found');
    }

    if (dto.manualEntryId) {
      const entry = await this.prisma.manualBankEntry.findFirst({
        where: { id: dto.manualEntryId, orgId: ctx.organizationId },
      });
      if (!entry) throw new NotFoundException('Manual bank entry not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedLine = await tx.bankStatementLine.update({
        where: { id: dto.bankStatementLineId },
        data: {
          status: 'MATCHED',
          matchedJournalLineId: dto.journalLineId ?? null,
          matchedManualEntryId: dto.manualEntryId ?? null,
          matchedAt: new Date(),
          matchedById: userId,
        },
      });

      // Recompute reconciliation totals
      const { matchedTotal, matchedCount, unmatchedCount } = await this._recomputeTotals(tx, rec);

      await tx.bankReconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: rec.status === 'OPEN' ? 'IN_PROGRESS' : rec.status,
          matchedTotal,
          matchedCount,
          unmatchedCount,
        },
      });

      return updatedLine;
    });

    await this.audit.log({
      action: 'BANK_STATEMENT_LINE_MATCHED',
      actorUserId: userId,
      entityType: 'BankStatementLine',
      entityId: dto.bankStatementLineId,
      metadata: {
        reconciliationId,
        journalLineId: dto.journalLineId,
        manualEntryId: dto.manualEntryId,
        amount: String(line.amount),
        direction: line.direction,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════
  // ── Skip Line ──
  // ═══════════════════════════════════════════════════

  async skipLine(
    userId: string,
    ctx: BranchContext,
    reconciliationId: string,
    dto: SkipLineDto,
    meta: AuditMeta,
  ) {
    const rec = await this.prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, orgId: ctx.organizationId },
    });
    if (!rec) throw new NotFoundException('Reconciliation not found');
    if (rec.status === 'COMPLETED') {
      throw new ConflictException('Cannot skip lines on a completed reconciliation');
    }

    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: dto.bankStatementLineId, orgId: ctx.organizationId },
    });
    if (!line) throw new NotFoundException('Bank statement line not found');
    if (line.status === 'MATCHED') {
      throw new ConflictException('Cannot skip a matched line');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedLine = await tx.bankStatementLine.update({
        where: { id: dto.bankStatementLineId },
        data: { status: 'SKIPPED' },
      });

      const unmatchedCount = await tx.bankStatementLine.count({
        where: {
          ...(rec.bankStatementId
            ? { bankStatementId: rec.bankStatementId }
            : { bankStatement: { bankAccountId: rec.bankAccountId } }),
          orgId: rec.orgId,
          status: 'UNMATCHED',
        },
      });

      await tx.bankReconciliation.update({
        where: { id: reconciliationId },
        data: { unmatchedCount },
      });

      return updatedLine;
    });

    await this.audit.log({
      action: 'BANK_STATEMENT_LINE_SKIPPED',
      actorUserId: userId,
      entityType: 'BankStatementLine',
      entityId: dto.bankStatementLineId,
      metadata: { reconciliationId, notes: dto.notes },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════
  // ── Manual Bank Entry (missing transactions) ──
  // ═══════════════════════════════════════════════════

  async createManualBankEntry(
    userId: string,
    ctx: BranchContext,
    dto: CreateManualBankEntryDto,
    meta: AuditMeta,
  ) {
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, orgId: ctx.organizationId },
    });
    if (!bankAccount) throw new NotFoundException('Bank account not found');

    if (dto.accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountId, orgId: ctx.organizationId },
      });
      if (!account) throw new NotFoundException('GL account not found');
    }

    const entry = await this.prisma.manualBankEntry.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        bankAccountId: dto.bankAccountId,
        txDate: new Date(dto.txDate),
        amount: dto.amount,
        direction: dto.direction as 'DEBIT' | 'CREDIT',
        description: dto.description,
        entryType: dto.entryType,
        accountId: dto.accountId,
        reference: dto.reference,
        notes: dto.notes,
        createdById: userId,
      },
    });

    await this.audit.log({
      action: 'MANUAL_BANK_ENTRY_CREATED',
      actorUserId: userId,
      entityType: 'ManualBankEntry',
      entityId: entry.id,
      metadata: {
        bankAccountId: dto.bankAccountId,
        amount: String(dto.amount),
        direction: dto.direction,
        entryType: dto.entryType,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return entry;
  }

  // ═══════════════════════════════════════════════════
  // ── Reconciliation Completion ──
  // ═══════════════════════════════════════════════════

  async completeReconciliation(
    userId: string,
    ctx: BranchContext,
    reconciliationId: string,
    meta: AuditMeta,
  ) {
    const rec = await this.prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, orgId: ctx.organizationId },
    });
    if (!rec) throw new NotFoundException('Reconciliation not found');
    if (rec.status === 'COMPLETED') {
      throw new ConflictException('Reconciliation is already completed');
    }
    if (rec.status === 'OPEN') {
      throw new BadRequestException(
        'Cannot complete a reconciliation with no matched lines — start matching first',
      );
    }

    const difference = rec.statementBalance.minus(rec.matchedTotal);
    if (!difference.isZero()) {
      throw new BadRequestException(
        `Cannot complete reconciliation — difference is ${difference.toFixed(2)} (must be zero)`,
      );
    }

    const updated = await this.prisma.bankReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedById: userId,
      },
    });

    await this.audit.log({
      action: 'BANK_RECONCILIATION_COMPLETED',
      actorUserId: userId,
      entityType: 'BankReconciliation',
      entityId: reconciliationId,
      metadata: {
        bankAccountId: rec.bankAccountId,
        fiscalPeriodId: rec.fiscalPeriodId,
        matchedCount: rec.matchedCount,
        statementBalance: rec.statementBalance.toString(),
        matchedTotal: rec.matchedTotal.toString(),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════
  // ── Period Close Runs ──
  // ═══════════════════════════════════════════════════

  async listPeriodCloseRuns(ctx: BranchContext, fiscalPeriodId?: string) {
    return this.prisma.periodCloseRun.findMany({
      where: {
        orgId: ctx.organizationId,
        ...(fiscalPeriodId ? { fiscalPeriodId } : {}),
      },
      orderBy: { closedAt: 'desc' },
      include: {
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        fiscalPeriod: { select: { id: true, name: true, startsAt: true, endsAt: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════
  // ── Period Close / Lock ──
  // ═══════════════════════════════════════════════════

  async closeFiscalPeriod(
    userId: string,
    orgId: string,
    periodId: string,
    dto: PeriodCloseDto | undefined,
    meta: AuditMeta,
  ) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: periodId, orgId },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    if (period.status !== 'OPEN') {
      throw new ConflictException(
        `Cannot close period — current status is ${period.status} (must be OPEN)`,
      );
    }

    // Calculate retained earnings: REVENUE credits - EXPENSE debits
    const revenueAgg = await this.prisma.journalLine.aggregate({
      where: {
        orgId,
        journalEntry: { fiscalPeriodId: periodId, status: 'POSTED' },
        account: { accountType: 'REVENUE' },
        direction: 'CREDIT',
      },
      _sum: { amount: true },
    });

    const expenseAgg = await this.prisma.journalLine.aggregate({
      where: {
        orgId,
        journalEntry: { fiscalPeriodId: periodId, status: 'POSTED' },
        account: { accountType: 'EXPENSE' },
        direction: 'DEBIT',
      },
      _sum: { amount: true },
    });

    const incomeTotal = revenueAgg._sum.amount
      ? new Prisma.Decimal(revenueAgg._sum.amount.toString())
      : new Prisma.Decimal(0);
    const expenseTotal = expenseAgg._sum.amount
      ? new Prisma.Decimal(expenseAgg._sum.amount.toString())
      : new Prisma.Decimal(0);
    const retainedEarnings = incomeTotal.minus(expenseTotal);

    const [updated, closeRun] = await this.prisma.$transaction(async (tx) => {
      const fp = await tx.fiscalPeriod.update({
        where: { id: periodId },
        data: { status: 'CLOSED', closedAt: new Date(), closedById: userId },
      });

      const run = await tx.periodCloseRun.create({
        data: {
          orgId,
          fiscalPeriodId: periodId,
          status: 'COMPLETED',
          closedById: userId,
          retainedEarningsAmount: retainedEarnings,
          incomeTotal,
          expenseTotal,
          summary: {
            periodName: period.name,
            startsAt: period.startsAt,
            endsAt: period.endsAt,
            closedAt: new Date(),
            incomeTotal: incomeTotal.toString(),
            expenseTotal: expenseTotal.toString(),
            retainedEarnings: retainedEarnings.toString(),
          },
          notes: dto?.notes,
        },
      });

      return [fp, run];
    });

    await this.audit.log({
      action: 'FISCAL_PERIOD_CLOSED',
      actorUserId: userId,
      entityType: 'FiscalPeriod',
      entityId: periodId,
      metadata: {
        oldStatus: 'OPEN',
        newStatus: 'CLOSED',
        closeRunId: closeRun.id,
        retainedEarnings: retainedEarnings.toString(),
        incomeTotal: incomeTotal.toString(),
        expenseTotal: expenseTotal.toString(),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async lockFiscalPeriod(userId: string, orgId: string, periodId: string, meta: AuditMeta) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: periodId, orgId },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    if (period.status !== 'CLOSED') {
      throw new ConflictException(
        `Cannot lock period — current status is ${period.status} (must be CLOSED)`,
      );
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: 'LOCKED', lockedAt: new Date(), lockedById: userId },
    });

    await this.audit.log({
      action: 'FISCAL_PERIOD_LOCKED',
      actorUserId: userId,
      entityType: 'FiscalPeriod',
      entityId: periodId,
      metadata: { oldStatus: 'CLOSED', newStatus: 'LOCKED' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════
  // ── Private Helpers ──
  // ═══════════════════════════════════════════════════

  private async _recomputeTotals(
    tx: Prisma.TransactionClient,
    rec: { bankAccountId: string; bankStatementId: string | null; orgId: string },
  ) {
    const lineFilter: Prisma.BankStatementLineWhereInput = {
      orgId: rec.orgId,
      bankStatement: { bankAccountId: rec.bankAccountId },
    };
    if (rec.bankStatementId) {
      lineFilter.bankStatementId = rec.bankStatementId;
    }

    const matchedLines = await tx.bankStatementLine.findMany({
      where: { ...lineFilter, status: 'MATCHED' },
      select: { amount: true, direction: true },
    });

    let matchedTotal = new Prisma.Decimal(0);
    for (const line of matchedLines) {
      if (line.direction === 'CREDIT') {
        matchedTotal = matchedTotal.plus(line.amount);
      } else {
        matchedTotal = matchedTotal.minus(line.amount);
      }
    }

    const matchedCount = matchedLines.length;
    const unmatchedCount = await tx.bankStatementLine.count({
      where: { ...lineFilter, status: 'UNMATCHED' },
    });

    return { matchedTotal, matchedCount, unmatchedCount };
  }
}
