import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { branchOrOrgScope } from '../../common/scope';
import { Prisma } from '@prisma/client';

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Journal Number Generation ──

  private async nextJournalNumber(orgId: string): Promise<string> {
    const last = await this.prisma.journalEntry.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { journalNumber: true },
    });

    let seq = 1;
    if (last?.journalNumber) {
      const parts = last.journalNumber.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }

    return `JNL-${String(seq).padStart(6, '0')}`;
  }

  // ── Manual Journal Create ──

  async createJournal(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: {
      journalDate: string;
      sourceKey?: string;
      sourceDocumentId?: string;
      reference?: string;
      description?: string;
      fiscalPeriodId?: string;
      lines: {
        accountId: string;
        costCenterId?: string;
        direction: 'DEBIT' | 'CREDIT';
        amount: string;
        description?: string;
      }[];
    };
  }) {
    const { orgId, branchId, userId, dto } = params;

    // Validate balancing
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of dto.lines) {
      const amt = new Prisma.Decimal(line.amount);
      if (amt.lte(0)) {
        throw new BadRequestException('Line amounts must be positive');
      }
      if (line.direction === 'DEBIT') {
        totalDebit = totalDebit.add(amt);
      } else {
        totalCredit = totalCredit.add(amt);
      }
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal must balance: debits (${totalDebit}) ≠ credits (${totalCredit})`,
      );
    }

    // Validate accounts exist in org
    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds }, orgId, status: 'ACTIVE' },
      select: { id: true },
    });
    const foundIds = new Set(accounts.map((a) => a.id));
    for (const id of accountIds) {
      if (!foundIds.has(id)) {
        throw new BadRequestException(`Account ${id} not found or inactive`);
      }
    }

    // Validate cost centers if provided
    const costCenterIds = [
      ...new Set(dto.lines.filter((l) => l.costCenterId).map((l) => l.costCenterId!)),
    ];
    if (costCenterIds.length > 0) {
      const costCenters = await this.prisma.costCenter.findMany({
        where: { id: { in: costCenterIds }, orgId, active: true },
        select: { id: true },
      });
      const foundCcIds = new Set(costCenters.map((c) => c.id));
      for (const id of costCenterIds) {
        if (!foundCcIds.has(id)) {
          throw new BadRequestException(`Cost center ${id} not found or inactive`);
        }
      }
    }

    // Validate fiscal period if provided
    if (dto.fiscalPeriodId) {
      const period = await this.prisma.fiscalPeriod.findFirst({
        where: { id: dto.fiscalPeriodId, orgId, status: 'OPEN' },
      });
      if (!period) {
        throw new BadRequestException('Fiscal period not found or not in OPEN status');
      }
    }

    const journalNumber = await this.nextJournalNumber(orgId);

    const journal = await this.prisma.journalEntry.create({
      data: {
        orgId,
        branchId: branchId || null,
        journalNumber,
        journalDate: new Date(dto.journalDate),
        status: 'POSTED',
        sourceKey: dto.sourceKey || null,
        sourceDocumentId: dto.sourceDocumentId || null,
        reference: dto.reference || null,
        description: dto.description || null,
        fiscalPeriodId: dto.fiscalPeriodId || null,
        totalDebit,
        totalCredit,
        postedAt: new Date(),
        postedById: userId,
        lines: {
          create: dto.lines.map((l) => ({
            orgId,
            accountId: l.accountId,
            costCenterId: l.costCenterId || null,
            direction: l.direction,
            amount: new Prisma.Decimal(l.amount),
            description: l.description || null,
          })),
        },
      },
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true } } } },
      },
    });

    await this.audit.log({
      action: 'JOURNAL_CREATED',
      actorUserId: userId,
      entityType: 'JournalEntry',
      entityId: journal.id,
      metadata: {
        orgId,
        journalNumber,
        totalDebit: totalDebit.toString(),
        totalCredit: totalCredit.toString(),
        lineCount: dto.lines.length,
      },
    });

    return journal;
  }

  // ── List Journals ──

  async listJournals(params: {
    orgId: string;
    branchId?: string;
    status?: string;
    sourceKey?: string;
    from?: string;
    to?: string;
    skip?: number;
    take?: number;
  }) {
    const { orgId, branchId, status, sourceKey, from, to, skip = 0, take = 50 } = params;

    const where: Prisma.JournalEntryWhereInput = { orgId };
    if (branchId) where.branchId = branchId;
    if (status) where.status = status as any;
    if (sourceKey) where.sourceKey = sourceKey;
    if (from || to) {
      where.journalDate = {};
      if (from) where.journalDate.gte = new Date(from);
      if (to) where.journalDate.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
              costCenter: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  // ── Get Journal By ID ──

  async getJournal(params: { orgId: string; journalId: string }) {
    const journal = await this.prisma.journalEntry.findFirst({
      where: { id: params.journalId, orgId: params.orgId },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, accountType: true } },
            costCenter: { select: { id: true, code: true, name: true } },
          },
        },
        reversedFrom: { select: { id: true, journalNumber: true } },
        reversalEntry: { select: { id: true, journalNumber: true } },
        postedBy: { select: { id: true, firstName: true, lastName: true } },
        fiscalPeriod: { select: { id: true, name: true, status: true } },
      },
    });

    if (!journal) {
      throw new NotFoundException('Journal entry not found');
    }

    return journal;
  }

  // ── Reverse Journal ──

  async reverseJournal(params: {
    orgId: string;
    branchId?: string;
    journalId: string;
    userId: string;
    reason?: string;
  }) {
    const { orgId, journalId, userId, reason } = params;

    const original = await this.prisma.journalEntry.findFirst({
      where: { id: journalId, orgId },
      include: { lines: true },
    });

    if (!original) {
      throw new NotFoundException('Journal entry not found');
    }

    if (original.status === 'REVERSED') {
      throw new ConflictException('Journal is already reversed');
    }

    if (original.status !== 'POSTED') {
      throw new ConflictException('Only POSTED journals can be reversed');
    }

    // Check if there's already a reversal
    const existingReversal = await this.prisma.journalEntry.findFirst({
      where: { reversedFromId: journalId },
    });

    if (existingReversal) {
      throw new ConflictException('Journal already has a reversal entry');
    }

    const reversalNumber = await this.nextJournalNumber(orgId);

    const result = await this.prisma.$transaction(async (tx) => {
      // Create reversal journal with opposite lines
      const reversal = await tx.journalEntry.create({
        data: {
          orgId,
          branchId: original.branchId,
          journalNumber: reversalNumber,
          journalDate: new Date(),
          status: 'POSTED',
          sourceKey: original.sourceKey,
          sourceDocumentId: original.sourceDocumentId,
          reference: `Reversal of ${original.journalNumber}${reason ? ': ' + reason : ''}`,
          description: `Reversal of ${original.journalNumber}`,
          fiscalPeriodId: original.fiscalPeriodId,
          reversedFromId: original.id,
          totalDebit: original.totalCredit,
          totalCredit: original.totalDebit,
          postedAt: new Date(),
          postedById: userId,
          lines: {
            create: original.lines.map((line) => ({
              orgId,
              accountId: line.accountId,
              costCenterId: line.costCenterId,
              direction: line.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
              amount: line.amount,
              description: `Reversal: ${line.description || ''}`.trim(),
            })),
          },
        },
        include: {
          lines: {
            include: { account: { select: { id: true, code: true, name: true } } },
          },
        },
      });

      // Mark original as REVERSED
      await tx.journalEntry.update({
        where: { id: original.id },
        data: { status: 'REVERSED', reversalOfId: reversal.id },
      });

      return reversal;
    });

    await this.audit.log({
      action: 'JOURNAL_REVERSED',
      actorUserId: userId,
      entityType: 'JournalEntry',
      entityId: result.id,
      metadata: {
        orgId,
        originalJournalId: original.id,
        originalJournalNumber: original.journalNumber,
        reversalJournalNumber: result.journalNumber,
        reason,
      },
    });

    return result;
  }

  // ── Posting Replay ──

  async replayPosting(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    sourceKey: string;
    sourceDocumentId?: string;
  }) {
    const { orgId, branchId, userId, sourceKey, sourceDocumentId } = params;

    // Build a run key for idempotency
    const runKey = `${sourceKey}:${sourceDocumentId || 'manual'}`;

    // Check for existing successful run with this runKey
    const existingRun = await this.prisma.postingRun.findFirst({
      where: { orgId, runKey, status: 'SUCCEEDED' },
      include: { journalEntry: { select: { id: true, journalNumber: true } } },
    });

    if (existingRun) {
      return {
        alreadyPosted: true,
        postingRun: existingRun,
        message: `Source document already posted in run ${existingRun.id}`,
      };
    }

    await this.audit.log({
      action: 'POSTING_RUN_STARTED',
      actorUserId: userId,
      entityType: 'PostingRun',
      entityId: 'pending',
      metadata: { orgId, sourceKey, sourceDocumentId, runKey },
    });

    // Create the posting run
    const postingRun = await this.prisma.postingRun.create({
      data: {
        orgId,
        branchId: branchId || null,
        sourceKey,
        sourceDocumentId: sourceDocumentId || null,
        status: 'PENDING',
        runKey,
      },
    });

    try {
      // Look up the posting source map
      const sourceMap = await this.prisma.postingSourceMap.findFirst({
        where: { orgId, sourceKey, active: true },
        include: {
          debitAccount: { select: { id: true, code: true, name: true } },
          creditAccount: { select: { id: true, code: true, name: true } },
        },
      });

      if (!sourceMap || !sourceMap.debitAccountId || !sourceMap.creditAccountId) {
        throw new Error(`No active posting source map found for key: ${sourceKey}`);
      }

      // For a real production system, we'd look up the source document amount.
      // Here we demonstrate the posting engine with a placeholder approach:
      // the caller can pass sourceDocumentId, and the engine maps it to the correct accounts.
      // In future milestones, each source adapter will resolve amounts from the actual document.

      // For now, create a demonstrative journal entry from the source map.
      // Real integrations will supply amounts from source documents.
      const amount = new Prisma.Decimal('0.01'); // Placeholder — real integrations override this

      const journalNumber = await this.nextJournalNumber(orgId);

      const journal = await this.prisma.journalEntry.create({
        data: {
          orgId,
          branchId: branchId || null,
          journalNumber,
          journalDate: new Date(),
          status: 'POSTED',
          sourceKey,
          sourceDocumentId: sourceDocumentId || null,
          description: `Auto-posted from ${sourceKey}${sourceDocumentId ? ' / ' + sourceDocumentId : ''}`,
          totalDebit: amount,
          totalCredit: amount,
          postedAt: new Date(),
          postedById: userId,
          lines: {
            create: [
              {
                orgId,
                accountId: sourceMap.debitAccountId,
                direction: 'DEBIT',
                amount,
                description: `${sourceKey} debit`,
              },
              {
                orgId,
                accountId: sourceMap.creditAccountId,
                direction: 'CREDIT',
                amount,
                description: `${sourceKey} credit`,
              },
            ],
          },
        },
        include: {
          lines: {
            include: { account: { select: { id: true, code: true, name: true } } },
          },
        },
      });

      // Update posting run to succeeded
      const updatedRun = await this.prisma.postingRun.update({
        where: { id: postingRun.id },
        data: {
          status: 'SUCCEEDED',
          journalEntryId: journal.id,
          finishedAt: new Date(),
        },
        include: { journalEntry: true },
      });

      await this.audit.log({
        action: 'POSTING_RUN_FINISHED',
        actorUserId: userId,
        entityType: 'PostingRun',
        entityId: postingRun.id,
        metadata: {
          orgId,
          status: 'SUCCEEDED',
          journalId: journal.id,
          journalNumber: journal.journalNumber,
        },
      });

      return { alreadyPosted: false, postingRun: updatedRun };
    } catch (err: any) {
      // Create posting error
      const postingError = await this.prisma.postingError.create({
        data: {
          orgId,
          branchId: branchId || null,
          postingRunId: postingRun.id,
          sourceKey,
          sourceDocumentId: sourceDocumentId || null,
          status: 'OPEN',
          code: 'POSTING_FAILED',
          message: err.message || 'Unknown posting error',
          details: { stack: err.stack?.slice(0, 500) },
        },
      });

      await this.prisma.postingRun.update({
        where: { id: postingRun.id },
        data: { status: 'FAILED', finishedAt: new Date(), errorCount: 1 },
      });

      await this.audit.log({
        action: 'POSTING_ERROR_CREATED',
        actorUserId: userId,
        entityType: 'PostingError',
        entityId: postingError.id,
        metadata: {
          orgId,
          postingRunId: postingRun.id,
          code: 'POSTING_FAILED',
          message: err.message,
        },
      });

      await this.audit.log({
        action: 'POSTING_RUN_FINISHED',
        actorUserId: userId,
        entityType: 'PostingRun',
        entityId: postingRun.id,
        metadata: { orgId, status: 'FAILED', errorId: postingError.id },
      });

      return {
        alreadyPosted: false,
        postingRun: { ...postingRun, status: 'FAILED' },
        error: { id: postingError.id, code: postingError.code, message: postingError.message },
      };
    }
  }

  // ── List Posting Runs ──

  async listPostingRuns(params: {
    orgId: string;
    branchId?: string;
    skip?: number;
    take?: number;
  }) {
    const { orgId, branchId, skip = 0, take = 50 } = params;

    const where: Prisma.PostingRunWhereInput = { orgId };
    if (branchId) where.branchId = branchId;

    const [data, total] = await Promise.all([
      this.prisma.postingRun.findMany({
        where,
        include: {
          journalEntry: { select: { id: true, journalNumber: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.postingRun.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  // ── List Posting Errors ──

  async listPostingErrors(params: {
    orgId: string;
    branchId?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const { orgId, branchId, status, skip = 0, take = 50 } = params;

    // PC-03: was strict `where.branchId = branchId` on a NULLABLE column, which
    // hid every unattributed org-level posting error from every branch at once.
    const where: Prisma.PostingErrorWhereInput = {
      orgId,
      ...branchOrOrgScope(branchId, 'posting error'),
    };
    if (status) where.status = status as any;

    const [data, total] = await Promise.all([
      this.prisma.postingError.findMany({
        where,
        include: {
          postingRun: { select: { id: true, sourceKey: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.postingError.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  // ── Get Posting Error ──

  // PC-03: this detail resolved by `orgId` alone while its list was
  // branch-filtered — the exact MP0-12 shape, and the one item of PC-03 B0
  // could only verify statically (the dataset held 0 posting errors). Both
  // sides now apply the identical predicate.
  async getPostingError(params: { orgId: string; branchId?: string; errorId: string }) {
    const error = await this.prisma.postingError.findFirst({
      where: {
        id: params.errorId,
        orgId: params.orgId,
        ...branchOrOrgScope(params.branchId, 'posting error'),
      },
      include: {
        postingRun: {
          select: {
            id: true,
            sourceKey: true,
            sourceDocumentId: true,
            status: true,
            runKey: true,
          },
        },
      },
    });

    if (!error) {
      throw new NotFoundException('Posting error not found');
    }

    return error;
  }
}
