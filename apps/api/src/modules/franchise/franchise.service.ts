import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
    FranchiseOverviewQueryDto,
    FranchiseRankingsQueryDto,
    FranchiseBudgetsQueryDto,
    CreateTransferDto,
    UpdateTransferStatusDto,
    ListTransfersQueryDto,
    CreateDigestSubscriptionDto,
    UpdateDigestSubscriptionDto,
} from './dto';

interface OrgContext {
    organizationId: string;
}

interface AuditMeta {
    ipAddress?: string;
    userAgent?: string;
}

/** Valid status transitions for inter-branch transfers */
const TRANSFER_TRANSITIONS: Record<string, string[]> = {
    REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: ['COMPLETED'],
};

@Injectable()
export class FranchiseService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ── Helpers ──

    /** Resolve orgId from user's memberships (must have >= 1 active membership at L4+ for franchise ops). */
    async resolveOrgContext(userId: string): Promise<OrgContext> {
        const membership = await this.prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
            include: { role: true },
        });
        if (!membership) {
            throw new ForbiddenException('No active membership found');
        }
        return { organizationId: membership.organizationId };
    }

    /** Get all active branches in an org. */
    private async getOrgBranches(orgId: string) {
        return this.prisma.branch.findMany({
            where: { organizationId: orgId, status: 'ACTIVE' },
            select: { id: true, name: true, code: true },
        });
    }

    /** Normalize window defaults: if not provided, use current month. */
    private normalizeWindow(
        windowStart?: string,
        windowEnd?: string,
        windowType?: string,
    ): { start: Date; end: Date; type: string } {
        const now = new Date();
        let type = windowType || 'MONTHLY';
        let start: Date;
        let end: Date;

        if (windowStart && windowEnd) {
            start = new Date(windowStart);
            end = new Date(windowEnd);
            if (end <= start) {
                throw new BadRequestException('windowEnd must be after windowStart');
            }
        } else {
            // Default to current month
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            type = 'MONTHLY';
        }

        return { start, end, type };
    }

    // ═══════════════════════════════════════════════════════════════
    // 1) Franchise Overview
    // ═══════════════════════════════════════════════════════════════

    async getOverview(orgId: string, query: FranchiseOverviewQueryDto) {
        const { start, end } = this.normalizeWindow(
            query.windowStart,
            query.windowEnd,
            query.windowType,
        );
        const branches = await this.getOrgBranches(orgId);

        const branchSummaries = await Promise.all(
            branches.map(async (branch) => {
                // Budget vs actual
                const budgetAgg = await this.prisma.budgetLine.aggregate({
                    where: {
                        budget: {
                            orgId,
                            branchId: branch.id,
                            status: { in: ['ACTIVE', 'FINALIZED'] },
                            periodStart: { lte: end },
                            periodEnd: { gte: start },
                        },
                    },
                    _sum: { budgetAmount: true, actualAmount: true, varianceAmount: true },
                });

                // Procurement suggestions by urgency
                const procurementCounts = await this.prisma.procurementSuggestion.groupBy({
                    by: ['urgency'],
                    where: {
                        orgId,
                        branchId: branch.id,
                        status: { in: ['PENDING', 'REVIEWED'] },
                    },
                    _count: true,
                });

                // Low stock items (items with stock below reorder level)
                const lowStockItems = await this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(DISTINCT ii.id)::bigint as count
          FROM inventory_items ii
          LEFT JOIN (
            SELECT item_id, SUM(remaining_qty) as total_qty
            FROM stock_batches
            WHERE org_id = ${orgId} AND branch_id = ${branch.id}
            GROUP BY item_id
          ) sb ON sb.item_id = ii.id
          WHERE ii.org_id = ${orgId}
            AND ii.branch_id = ${branch.id}
            AND ii.is_active = true
            AND ii.reorder_level > 0
            AND COALESCE(sb.total_qty, 0) < ii.reorder_level
        `;

                // Upcoming demand calendar events
                const upcomingEvents = await this.prisma.demandCalendarEntry.findMany({
                    where: {
                        orgId,
                        branchId: branch.id,
                        isActive: true,
                        dateStart: { lte: end },
                        dateEnd: { gte: start },
                    },
                    select: {
                        id: true,
                        title: true,
                        calendarType: true,
                        dateStart: true,
                        dateEnd: true,
                        expectedCovers: true,
                        demandMultiplier: true,
                        daypart: true,
                    },
                    orderBy: { dateStart: 'asc' },
                    take: 5,
                });

                // Pending transfer count (from or to this branch)
                const pendingTransfers = await this.prisma.interBranchTransfer.count({
                    where: {
                        orgId,
                        status: { in: ['REQUESTED', 'APPROVED', 'IN_TRANSIT'] },
                        OR: [{ fromBranchId: branch.id }, { toBranchId: branch.id }],
                    },
                });

                return {
                    branchId: branch.id,
                    branchName: branch.name,
                    branchCode: branch.code,
                    budget: {
                        totalBudget: budgetAgg._sum.budgetAmount?.toString() ?? '0',
                        totalActual: budgetAgg._sum.actualAmount?.toString() ?? '0',
                        totalVariance: budgetAgg._sum.varianceAmount?.toString() ?? '0',
                    },
                    procurement: {
                        byUrgency: procurementCounts.reduce(
                            (acc, row) => {
                                acc[row.urgency] = row._count;
                                return acc;
                            },
                            {} as Record<string, number>,
                        ),
                        totalPending: procurementCounts.reduce((sum, row) => sum + row._count, 0),
                    },
                    stockHealth: {
                        lowStockItemCount: Number(lowStockItems[0]?.count ?? 0),
                    },
                    demandCalendar: {
                        upcomingEvents,
                        upcomingEventCount: upcomingEvents.length,
                    },
                    transferPressure: {
                        pendingTransferCount: pendingTransfers,
                    },
                };
            }),
        );

        return {
            orgId,
            windowStart: start.toISOString(),
            windowEnd: end.toISOString(),
            branchCount: branches.length,
            branches: branchSummaries,
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 2) Rankings
    // ═══════════════════════════════════════════════════════════════

    async getRankings(orgId: string, query: FranchiseRankingsQueryDto) {
        const { start, end, type } = this.normalizeWindow(
            query.windowStart,
            query.windowEnd,
            query.windowType,
        );
        const rankingType = query.rankingType;

        const where: Prisma.FranchiseRankingWhereInput = {
            orgId,
            windowStart: start,
            windowEnd: end,
            windowType: type as any,
        };
        if (rankingType) {
            where.rankingType = rankingType as any;
        }

        const rankings = await this.prisma.franchiseRanking.findMany({
            where,
            include: {
                branch: { select: { id: true, name: true, code: true } },
            },
            orderBy: [{ rankingType: 'asc' }, { rank: 'asc' }],
        });

        // Group by type
        const grouped: Record<string, typeof rankings> = {};
        for (const r of rankings) {
            const key = r.rankingType;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(r);
        }

        return {
            orgId,
            windowType: type,
            windowStart: start.toISOString(),
            windowEnd: end.toISOString(),
            rankings: grouped,
            totalRankings: rankings.length,
        };
    }

    /** Generate or refresh rankings for a given window. Called by the service, not directly by user. */
    async generateRankings(orgId: string, windowType: string, windowStart: Date, windowEnd: Date) {
        const branches = await this.getOrgBranches(orgId);
        if (branches.length === 0) return [];

        const results: Array<{
            branchId: string;
            branchName: string;
            rankingType: string;
            rank: number;
            score: number;
        }> = [];

        // Revenue ranking: based on total actual amounts from budgets
        const revenueScores = await Promise.all(
            branches.map(async (branch) => {
                const agg = await this.prisma.budgetLine.aggregate({
                    where: {
                        budget: {
                            orgId,
                            branchId: branch.id,
                            status: { in: ['ACTIVE', 'FINALIZED'] },
                            periodStart: { lte: windowEnd },
                            periodEnd: { gte: windowStart },
                        },
                    },
                    _sum: { actualAmount: true },
                });
                return {
                    branchId: branch.id,
                    branchName: branch.name,
                    score: Number(agg._sum.actualAmount ?? 0),
                };
            }),
        );
        revenueScores.sort((a, b) => b.score - a.score);

        // Budget variance ranking: lower variance is better
        const varianceScores = await Promise.all(
            branches.map(async (branch) => {
                const agg = await this.prisma.budgetLine.aggregate({
                    where: {
                        budget: {
                            orgId,
                            branchId: branch.id,
                            status: { in: ['ACTIVE', 'FINALIZED'] },
                            periodStart: { lte: windowEnd },
                            periodEnd: { gte: windowStart },
                        },
                    },
                    _sum: { budgetAmount: true, actualAmount: true },
                });
                const budget = Number(agg._sum.budgetAmount ?? 0);
                const actual = Number(agg._sum.actualAmount ?? 0);
                const variancePct = budget > 0 ? Math.abs((actual - budget) / budget) * 100 : 0;
                return { branchId: branch.id, branchName: branch.name, score: variancePct };
            }),
        );
        varianceScores.sort((a, b) => a.score - b.score); // lower variance = better rank

        // Stock health ranking: fewer low-stock items is better
        const stockScores = await Promise.all(
            branches.map(async (branch) => {
                const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(DISTINCT ii.id)::bigint as count
          FROM inventory_items ii
          LEFT JOIN (
            SELECT item_id, SUM(remaining_qty) as total_qty
            FROM stock_batches
            WHERE org_id = ${orgId} AND branch_id = ${branch.id}
            GROUP BY item_id
          ) sb ON sb.item_id = ii.id
          WHERE ii.org_id = ${orgId}
            AND ii.branch_id = ${branch.id}
            AND ii.is_active = true
            AND ii.reorder_level > 0
            AND COALESCE(sb.total_qty, 0) < ii.reorder_level
        `;
                return {
                    branchId: branch.id,
                    branchName: branch.name,
                    score: Number(result[0]?.count ?? 0),
                };
            }),
        );
        stockScores.sort((a, b) => a.score - b.score); // fewer low-stock = better

        // Procurement preparedness: fewer urgent suggestions = better
        const procScores = await Promise.all(
            branches.map(async (branch) => {
                const count = await this.prisma.procurementSuggestion.count({
                    where: {
                        orgId,
                        branchId: branch.id,
                        status: 'PENDING',
                        urgency: { in: ['URGENT_LOCAL_BUY', 'STOCK_UP_BEFORE_EVENT'] },
                    },
                });
                return { branchId: branch.id, branchName: branch.name, score: count };
            }),
        );
        procScores.sort((a, b) => a.score - b.score);

        // Demand readiness: based on upcoming events with multiplier
        const demandScores = await Promise.all(
            branches.map(async (branch) => {
                const events = await this.prisma.demandCalendarEntry.findMany({
                    where: {
                        orgId,
                        branchId: branch.id,
                        isActive: true,
                        dateStart: { lte: windowEnd },
                        dateEnd: { gte: windowStart },
                    },
                    select: { demandMultiplier: true },
                });
                const avgMultiplier =
                    events.length > 0
                        ? events.reduce((sum, e) => sum + Number(e.demandMultiplier ?? 1), 0) / events.length
                        : 1;
                return { branchId: branch.id, branchName: branch.name, score: avgMultiplier };
            }),
        );
        demandScores.sort((a, b) => b.score - a.score); // higher readiness score = better

        const rankingSets: Array<{ type: string; scores: typeof revenueScores; basis: string }> = [
            { type: 'REVENUE', scores: revenueScores, basis: 'total_actual_amount_desc' },
            { type: 'BUDGET_VARIANCE', scores: varianceScores, basis: 'variance_pct_asc' },
            { type: 'STOCK_HEALTH', scores: stockScores, basis: 'low_stock_count_asc' },
            {
                type: 'PROCUREMENT_PREPAREDNESS',
                scores: procScores,
                basis: 'urgent_suggestion_count_asc',
            },
            { type: 'DEMAND_READINESS', scores: demandScores, basis: 'avg_demand_multiplier_desc' },
        ];

        for (const set of rankingSets) {
            for (let i = 0; i < set.scores.length; i++) {
                const entry = set.scores[i];
                await this.prisma.franchiseRanking.upsert({
                    where: {
                        orgId_branchId_rankingType_windowType_windowStart_windowEnd: {
                            orgId,
                            branchId: entry.branchId,
                            rankingType: set.type as any,
                            windowType: windowType as any,
                            windowStart,
                            windowEnd,
                        },
                    },
                    update: {
                        rank: i + 1,
                        score: entry.score,
                        normalizationBasis: set.basis,
                        branchCount: branches.length,
                        sourceSignals: { rawScore: entry.score },
                        generatedAt: new Date(),
                    },
                    create: {
                        orgId,
                        branchId: entry.branchId,
                        rankingType: set.type as any,
                        windowType: windowType as any,
                        windowStart,
                        windowEnd,
                        rank: i + 1,
                        score: entry.score,
                        normalizationBasis: set.basis,
                        branchCount: branches.length,
                        sourceSignals: { rawScore: entry.score },
                    },
                });

                results.push({
                    branchId: entry.branchId,
                    branchName: entry.branchName,
                    rankingType: set.type,
                    rank: i + 1,
                    score: entry.score,
                });
            }
        }

        return results;
    }

    // ═══════════════════════════════════════════════════════════════
    // 3) Budget Rollups
    // ═══════════════════════════════════════════════════════════════

    async getBudgetRollups(orgId: string, query: FranchiseBudgetsQueryDto) {
        const { start, end, type } = this.normalizeWindow(
            query.windowStart,
            query.windowEnd,
            query.windowType,
        );
        const branches = await this.getOrgBranches(orgId);

        let filteredBranches = branches;
        if (query.branchId) {
            filteredBranches = branches.filter((b) => b.id === query.branchId);
            if (filteredBranches.length === 0) {
                throw new NotFoundException(`Branch "${query.branchId}" not found in organization`);
            }
        }

        const branchSummaries = await Promise.all(
            filteredBranches.map(async (branch) => {
                const agg = await this.prisma.budgetLine.aggregate({
                    where: {
                        budget: {
                            orgId,
                            branchId: branch.id,
                            status: { in: ['ACTIVE', 'FINALIZED'] },
                            periodStart: { lte: end },
                            periodEnd: { gte: start },
                        },
                    },
                    _sum: { budgetAmount: true, actualAmount: true, varianceAmount: true },
                });

                const totalBudget = Number(agg._sum.budgetAmount ?? 0);
                const totalActual = Number(agg._sum.actualAmount ?? 0);
                const totalVariance = totalBudget - totalActual;
                const variancePct = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

                // Procurement urgency overlay
                const urgentProcCount = await this.prisma.procurementSuggestion.count({
                    where: {
                        orgId,
                        branchId: branch.id,
                        status: 'PENDING',
                        urgency: { in: ['URGENT_LOCAL_BUY', 'STOCK_UP_BEFORE_EVENT'] },
                    },
                });

                return {
                    branchId: branch.id,
                    branchName: branch.name,
                    branchCode: branch.code,
                    totalBudget: totalBudget.toFixed(2),
                    totalActual: totalActual.toFixed(2),
                    totalVariance: totalVariance.toFixed(2),
                    variancePct: variancePct.toFixed(4),
                    urgentProcurementCount: urgentProcCount,
                };
            }),
        );

        // Portfolio totals
        const portfolioTotalBudget = branchSummaries.reduce((s, b) => s + parseFloat(b.totalBudget), 0);
        const portfolioTotalActual = branchSummaries.reduce((s, b) => s + parseFloat(b.totalActual), 0);
        const portfolioVariance = portfolioTotalBudget - portfolioTotalActual;
        const portfolioVariancePct =
            portfolioTotalBudget > 0 ? (portfolioVariance / portfolioTotalBudget) * 100 : 0;

        return {
            orgId,
            windowType: type,
            windowStart: start.toISOString(),
            windowEnd: end.toISOString(),
            branchCount: filteredBranches.length,
            portfolio: {
                totalBudget: portfolioTotalBudget.toFixed(2),
                totalActual: portfolioTotalActual.toFixed(2),
                totalVariance: portfolioVariance.toFixed(2),
                variancePct: portfolioVariancePct.toFixed(4),
            },
            branches: branchSummaries,
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 4) Inter-Branch Transfers
    // ═══════════════════════════════════════════════════════════════

    async createTransfer(userId: string, orgId: string, dto: CreateTransferDto, meta: AuditMeta) {
        // Validate branches belong to org and are different
        if (dto.fromBranchId === dto.toBranchId) {
            throw new BadRequestException('Source and destination branches must be different');
        }

        const [fromBranch, toBranch] = await Promise.all([
            this.prisma.branch.findFirst({
                where: { id: dto.fromBranchId, organizationId: orgId, status: 'ACTIVE' },
            }),
            this.prisma.branch.findFirst({
                where: { id: dto.toBranchId, organizationId: orgId, status: 'ACTIVE' },
            }),
        ]);

        if (!fromBranch)
            throw new BadRequestException(`Source branch "${dto.fromBranchId}" not found or inactive`);
        if (!toBranch)
            throw new BadRequestException(`Destination branch "${dto.toBranchId}" not found or inactive`);

        // Validate inventory item if provided
        if (dto.inventoryItemId) {
            const item = await this.prisma.inventoryItem.findFirst({
                where: { id: dto.inventoryItemId, orgId },
            });
            if (!item) throw new BadRequestException(`Inventory item "${dto.inventoryItemId}" not found`);
        }

        // Generate transfer number
        const count = await this.prisma.interBranchTransfer.count({ where: { orgId } });
        const transferNumber = `TRF-${String(count + 1).padStart(6, '0')}`;

        const transfer = await this.prisma.interBranchTransfer.create({
            data: {
                orgId,
                fromBranchId: dto.fromBranchId,
                toBranchId: dto.toBranchId,
                transferType: (dto.transferType as any) ?? 'STOCK',
                urgency: (dto.urgency as any) ?? 'MEDIUM',
                inventoryItemId: dto.inventoryItemId,
                itemCategory: dto.itemCategory,
                quantity: dto.quantity ? new Prisma.Decimal(dto.quantity) : undefined,
                estimatedValue: dto.estimatedValue ? new Prisma.Decimal(dto.estimatedValue) : undefined,
                rationale: dto.rationale,
                transferNumber,
                requestedById: userId,
                notes: dto.notes,
            },
            include: {
                fromBranch: { select: { id: true, name: true, code: true } },
                toBranch: { select: { id: true, name: true, code: true } },
                inventoryItem: { select: { id: true, name: true, unit: true } },
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'INTER_BRANCH_TRANSFER_CREATED',
            entityType: 'InterBranchTransfer',
            entityId: transfer.id,
            metadata: {
                fromBranchId: dto.fromBranchId,
                toBranchId: dto.toBranchId,
                urgency: transfer.urgency,
                transferNumber,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return transfer;
    }

    async listTransfers(orgId: string, query: ListTransfersQueryDto) {
        const where: Prisma.InterBranchTransferWhereInput = { orgId };
        if (query.fromBranchId) where.fromBranchId = query.fromBranchId;
        if (query.toBranchId) where.toBranchId = query.toBranchId;
        if (query.status) where.status = query.status as any;
        if (query.dateFrom)
            where.createdAt = { ...(where.createdAt as any), gte: new Date(query.dateFrom) };
        if (query.dateTo)
            where.createdAt = { ...(where.createdAt as any), lte: new Date(query.dateTo) };

        return this.prisma.interBranchTransfer.findMany({
            where,
            include: {
                fromBranch: { select: { id: true, name: true, code: true } },
                toBranch: { select: { id: true, name: true, code: true } },
                inventoryItem: { select: { id: true, name: true, unit: true } },
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
                approvedBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getTransfer(orgId: string, transferId: string) {
        const transfer = await this.prisma.interBranchTransfer.findFirst({
            where: { id: transferId, orgId },
            include: {
                fromBranch: { select: { id: true, name: true, code: true } },
                toBranch: { select: { id: true, name: true, code: true } },
                inventoryItem: { select: { id: true, name: true, unit: true } },
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
                approvedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        if (!transfer) throw new NotFoundException(`Transfer "${transferId}" not found`);
        return transfer;
    }

    async updateTransferStatus(
        userId: string,
        orgId: string,
        transferId: string,
        dto: UpdateTransferStatusDto,
        meta: AuditMeta,
    ) {
        const transfer = await this.prisma.interBranchTransfer.findFirst({
            where: { id: transferId, orgId },
        });
        if (!transfer) throw new NotFoundException(`Transfer "${transferId}" not found`);

        const allowedNextStatuses = TRANSFER_TRANSITIONS[transfer.status];
        if (!allowedNextStatuses || !allowedNextStatuses.includes(dto.status)) {
            throw new BadRequestException(
                `Cannot transition from ${transfer.status} to ${dto.status}. Allowed: ${allowedNextStatuses?.join(', ') ?? 'none'}`,
            );
        }

        const updateData: Prisma.InterBranchTransferUpdateInput = {
            status: dto.status as any,
            notes: dto.notes ?? transfer.notes,
        };

        if (dto.status === 'APPROVED') {
            updateData.approvedBy = { connect: { id: userId } };
            updateData.approvedAt = new Date();
        }
        if (dto.status === 'COMPLETED') {
            updateData.completedAt = new Date();
        }
        if (dto.status === 'REJECTED') {
            updateData.rejectionReason = dto.rejectionReason;
        }

        const updated = await this.prisma.interBranchTransfer.update({
            where: { id: transferId },
            data: updateData,
            include: {
                fromBranch: { select: { id: true, name: true, code: true } },
                toBranch: { select: { id: true, name: true, code: true } },
                inventoryItem: { select: { id: true, name: true, unit: true } },
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
                approvedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'INTER_BRANCH_TRANSFER_STATUS_CHANGED',
            entityType: 'InterBranchTransfer',
            entityId: transferId,
            metadata: {
                fromStatus: transfer.status,
                toStatus: dto.status,
                rejectionReason: dto.rejectionReason,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return updated;
    }

    // ═══════════════════════════════════════════════════════════════
    // 5) HQ Digest Subscriptions
    // ═══════════════════════════════════════════════════════════════

    async createDigestSubscription(
        userId: string,
        orgId: string,
        dto: CreateDigestSubscriptionDto,
        meta: AuditMeta,
    ) {
        const channel = dto.channel ?? 'email';

        const existing = await this.prisma.hqDigestSubscription.findUnique({
            where: {
                orgId_userId_channel_digestType: {
                    orgId,
                    userId,
                    channel,
                    digestType: dto.digestType,
                },
            },
        });

        if (existing) {
            // Update instead of throwing conflict — upsert behavior
            const updated = await this.prisma.hqDigestSubscription.update({
                where: { id: existing.id },
                data: {
                    frequency: (dto.frequency as any) ?? existing.frequency,
                    isActive: dto.isActive ?? existing.isActive,
                    preferences: dto.preferences
                        ? JSON.parse(JSON.stringify(dto.preferences))
                        : existing.preferences,
                },
            });

            await this.audit.log({
                actorUserId: userId,
                action: 'HQ_DIGEST_SUBSCRIPTION_UPDATED',
                entityType: 'HqDigestSubscription',
                entityId: updated.id,
                metadata: { digestType: dto.digestType, channel },
                ipAddress: meta.ipAddress,
                userAgent: meta.userAgent,
            });

            return updated;
        }

        const subscription = await this.prisma.hqDigestSubscription.create({
            data: {
                orgId,
                userId,
                channel,
                frequency: (dto.frequency as any) ?? 'WEEKLY',
                digestType: dto.digestType,
                isActive: dto.isActive ?? true,
                preferences: dto.preferences ? JSON.parse(JSON.stringify(dto.preferences)) : undefined,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'HQ_DIGEST_SUBSCRIPTION_CREATED',
            entityType: 'HqDigestSubscription',
            entityId: subscription.id,
            metadata: { digestType: dto.digestType, channel, frequency: subscription.frequency },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return subscription;
    }

    async listDigestSubscriptions(userId: string, orgId: string) {
        return this.prisma.hqDigestSubscription.findMany({
            where: { orgId, userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateDigestSubscription(
        userId: string,
        orgId: string,
        subscriptionId: string,
        dto: UpdateDigestSubscriptionDto,
        meta: AuditMeta,
    ) {
        const existing = await this.prisma.hqDigestSubscription.findFirst({
            where: { id: subscriptionId, orgId, userId },
        });
        if (!existing) throw new NotFoundException(`Digest subscription "${subscriptionId}" not found`);

        const updated = await this.prisma.hqDigestSubscription.update({
            where: { id: subscriptionId },
            data: {
                frequency: (dto.frequency as any) ?? undefined,
                isActive: dto.isActive,
                preferences: dto.preferences ? JSON.parse(JSON.stringify(dto.preferences)) : undefined,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'HQ_DIGEST_SUBSCRIPTION_UPDATED',
            entityType: 'HqDigestSubscription',
            entityId: subscriptionId,
            metadata: { changes: dto },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return updated;
    }

    // ═══════════════════════════════════════════════════════════════
    // 6) Procurement Pressure (advisory)
    // ═══════════════════════════════════════════════════════════════

    async getProcurementPressure(orgId: string) {
        const branches = await this.getOrgBranches(orgId);

        const branchPressure = await Promise.all(
            branches.map(async (branch) => {
                const suggestions = await this.prisma.procurementSuggestion.findMany({
                    where: {
                        orgId,
                        branchId: branch.id,
                        status: { in: ['PENDING', 'REVIEWED'] },
                    },
                    include: {
                        inventoryItem: { select: { id: true, name: true, unit: true } },
                    },
                    orderBy: [{ urgency: 'desc' }, { priority: 'asc' }],
                    take: 10,
                });

                // Upcoming events that may increase demand
                const upcomingEvents = await this.prisma.demandCalendarEntry.findMany({
                    where: {
                        orgId,
                        branchId: branch.id,
                        isActive: true,
                        dateStart: { gte: new Date() },
                    },
                    select: {
                        id: true,
                        title: true,
                        calendarType: true,
                        dateStart: true,
                        demandMultiplier: true,
                    },
                    orderBy: { dateStart: 'asc' },
                    take: 5,
                });

                return {
                    branchId: branch.id,
                    branchName: branch.name,
                    branchCode: branch.code,
                    suggestions: suggestions.map((s) => ({
                        id: s.id,
                        inventoryItem: s.inventoryItem,
                        urgency: s.urgency,
                        suggestedQty: s.suggestedQty?.toString(),
                        currentStock: s.currentStock?.toString(),
                        safetyStock: s.safetyStock?.toString(),
                        rationale: s.rationale,
                        status: s.status,
                    })),
                    urgentCount: suggestions.filter((s) =>
                        ['URGENT_LOCAL_BUY', 'STOCK_UP_BEFORE_EVENT'].includes(s.urgency),
                    ).length,
                    upcomingEvents,
                };
            }),
        );

        return {
            orgId,
            generatedAt: new Date().toISOString(),
            branches: branchPressure,
            totalUrgentCount: branchPressure.reduce((s, b) => s + b.urgentCount, 0),
        };
    }
}
