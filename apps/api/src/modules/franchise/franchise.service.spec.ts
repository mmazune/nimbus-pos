import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FranchiseService } from './franchise.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';

const ORG = 'org-1';
const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const USER = 'user-1';
const META = { ipAddress: '127.0.0.1', userAgent: 'jest' };

const BRANCHES = [
    { id: BRANCH_A, name: 'Main', code: 'MAIN' },
    { id: BRANCH_B, name: 'Downtown', code: 'DOWNTOWN' },
];

function makePrisma() {
    return {
        membership: {
            findFirst: jest.fn().mockResolvedValue({
                organizationId: ORG,
                userId: USER,
                status: 'ACTIVE',
                role: { id: 'r1', name: 'Owner' },
            }),
        },
        branch: {
            findMany: jest.fn().mockResolvedValue(BRANCHES),
            findFirst: jest.fn(),
        },
        budgetLine: {
            aggregate: jest.fn().mockResolvedValue({
                _sum: { budgetAmount: 2400000, actualAmount: 2210000, varianceAmount: -190000 },
            }),
        },
        procurementSuggestion: {
            groupBy: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
        },
        demandCalendarEntry: {
            findMany: jest.fn().mockResolvedValue([]),
        },
        interBranchTransfer: {
            create: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn(),
            update: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
        },
        franchiseRanking: {
            findMany: jest.fn().mockResolvedValue([]),
            upsert: jest.fn(),
            findFirst: jest.fn(),
        },
        branchBudgetRollup: {
            findFirst: jest.fn(),
        },
        hqDigestSubscription: {
            create: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        inventoryItem: {
            findFirst: jest.fn(),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ count: BigInt(2) }]),
    };
}

describe('FranchiseService', () => {
    let service: FranchiseService;
    let prisma: ReturnType<typeof makePrisma>;
    let audit: { log: jest.Mock };

    beforeEach(async () => {
        prisma = makePrisma();
        audit = { log: jest.fn() };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FranchiseService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();
        service = module.get<FranchiseService>(FranchiseService);
    });

    // ── resolveOrgContext ──

    describe('resolveOrgContext', () => {
        it('returns organizationId from active membership', async () => {
            const ctx = await service.resolveOrgContext(USER);
            expect(ctx.organizationId).toBe(ORG);
        });

        it('throws ForbiddenException if no active membership', async () => {
            prisma.membership.findFirst.mockResolvedValue(null);
            await expect(service.resolveOrgContext(USER)).rejects.toThrow(ForbiddenException);
        });
    });

    // ── getOverview ──

    describe('getOverview', () => {
        it('returns overview with branch summaries', async () => {
            const result = await service.getOverview(ORG, {});
            expect(result.orgId).toBe(ORG);
            expect(result.branchCount).toBe(2);
            expect(result.branches).toHaveLength(2);
            expect(result.branches[0].branchId).toBe(BRANCH_A);
            expect(result.branches[0].budget.totalBudget).toBeDefined();
        });
    });

    // ── getRankings ──

    describe('getRankings', () => {
        it('returns grouped rankings', async () => {
            prisma.franchiseRanking.findMany.mockResolvedValue([
                { rankingType: 'REVENUE', rank: 1, branch: BRANCHES[0] },
                { rankingType: 'REVENUE', rank: 2, branch: BRANCHES[1] },
            ]);
            const result = await service.getRankings(ORG, {});
            expect(result.rankings.REVENUE).toHaveLength(2);
            expect(result.totalRankings).toBe(2);
        });
    });

    // ── getBudgetRollups ──

    describe('getBudgetRollups', () => {
        it('returns portfolio totals across branches', async () => {
            const result = await service.getBudgetRollups(ORG, {});
            expect(result.orgId).toBe(ORG);
            expect(result.portfolio).toBeDefined();
            expect(result.branches).toHaveLength(2);
        });

        it('filters by branchId', async () => {
            const result = await service.getBudgetRollups(ORG, { branchId: BRANCH_A });
            expect(result.branches).toHaveLength(1);
        });

        it('throws NotFoundException for invalid branchId', async () => {
            await expect(service.getBudgetRollups(ORG, { branchId: 'nonexistent' })).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ── createTransfer ──

    describe('createTransfer', () => {
        const dto = {
            fromBranchId: BRANCH_A,
            toBranchId: BRANCH_B,
            transferType: 'STOCK',
            urgency: 'MEDIUM',
            quantity: 10,
            rationale: 'Low stock at Downtown',
        };

        beforeEach(() => {
            prisma.branch.findFirst
                .mockResolvedValueOnce({ id: BRANCH_A, name: 'Main' })
                .mockResolvedValueOnce({ id: BRANCH_B, name: 'Downtown' });
            prisma.interBranchTransfer.create.mockResolvedValue({
                id: 'txn-1',
                transferNumber: 'TRF-000001',
                ...dto,
                orgId: ORG,
                status: 'REQUESTED',
            });
        });

        it('creates a transfer and audits', async () => {
            const result = await service.createTransfer(USER, ORG, dto as any, META);
            expect(result.transferNumber).toBe('TRF-000001');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'INTER_BRANCH_TRANSFER_CREATED' }),
            );
        });

        it('rejects same-branch transfer', async () => {
            await expect(
                service.createTransfer(USER, ORG, { ...dto, toBranchId: BRANCH_A } as any, META),
            ).rejects.toThrow(BadRequestException);
        });

        it('rejects invalid source branch', async () => {
            prisma.branch.findFirst.mockReset().mockResolvedValue(null);
            await expect(service.createTransfer(USER, ORG, dto as any, META)).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    // ── getTransfer ──

    describe('getTransfer', () => {
        it('returns transfer by id', async () => {
            const mockTransfer = { id: 'txn-1', orgId: ORG, status: 'REQUESTED' };
            prisma.interBranchTransfer.findFirst.mockResolvedValue(mockTransfer);
            const result = await service.getTransfer(ORG, 'txn-1');
            expect(result.id).toBe('txn-1');
        });

        it('throws NotFoundException', async () => {
            prisma.interBranchTransfer.findFirst.mockResolvedValue(null);
            await expect(service.getTransfer(ORG, 'bad-id')).rejects.toThrow(NotFoundException);
        });
    });

    // ── updateTransferStatus ──

    describe('updateTransferStatus', () => {
        it('approves a REQUESTED transfer', async () => {
            prisma.interBranchTransfer.findFirst.mockResolvedValue({
                id: 'txn-1',
                orgId: ORG,
                status: 'REQUESTED',
            });
            prisma.interBranchTransfer.update.mockResolvedValue({
                id: 'txn-1',
                status: 'APPROVED',
            });

            const result = await service.updateTransferStatus(
                USER,
                ORG,
                'txn-1',
                { status: 'APPROVED' },
                META,
            );
            expect(result.status).toBe('APPROVED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'INTER_BRANCH_TRANSFER_STATUS_CHANGED' }),
            );
        });

        it('rejects invalid transition', async () => {
            prisma.interBranchTransfer.findFirst.mockResolvedValue({
                id: 'txn-1',
                orgId: ORG,
                status: 'COMPLETED',
            });
            await expect(
                service.updateTransferStatus(USER, ORG, 'txn-1', { status: 'APPROVED' }, META),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ── Digest Subscriptions ──

    describe('createDigestSubscription', () => {
        it('creates new subscription', async () => {
            const mockSub = { id: 'sub-1', digestType: 'EXECUTIVE_SUMMARY', frequency: 'WEEKLY' };
            prisma.hqDigestSubscription.create.mockResolvedValue(mockSub);

            const result = await service.createDigestSubscription(
                USER,
                ORG,
                { digestType: 'EXECUTIVE_SUMMARY', frequency: 'WEEKLY' } as any,
                META,
            );
            expect(result.digestType).toBe('EXECUTIVE_SUMMARY');
            expect(audit.log).toHaveBeenCalled();
        });

        it('upserts if subscription already exists', async () => {
            prisma.hqDigestSubscription.findUnique.mockResolvedValue({
                id: 'sub-1',
                frequency: 'WEEKLY',
                isActive: true,
            });
            prisma.hqDigestSubscription.update.mockResolvedValue({
                id: 'sub-1',
                frequency: 'DAILY',
                isActive: true,
            });

            const result = await service.createDigestSubscription(
                USER,
                ORG,
                { digestType: 'EXECUTIVE_SUMMARY', frequency: 'DAILY' } as any,
                META,
            );
            expect(result.frequency).toBe('DAILY');
        });
    });

    describe('updateDigestSubscription', () => {
        it('updates existing subscription', async () => {
            prisma.hqDigestSubscription.findFirst.mockResolvedValue({
                id: 'sub-1',
                orgId: ORG,
                userId: USER,
            });
            prisma.hqDigestSubscription.update.mockResolvedValue({
                id: 'sub-1',
                isActive: false,
            });

            const result = await service.updateDigestSubscription(
                USER,
                ORG,
                'sub-1',
                { isActive: false } as any,
                META,
            );
            expect(result.isActive).toBe(false);
        });

        it('throws NotFoundException for wrong subscription', async () => {
            prisma.hqDigestSubscription.findFirst.mockResolvedValue(null);
            await expect(
                service.updateDigestSubscription(USER, ORG, 'bad', {} as any, META),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ── Procurement Pressure ──

    describe('getProcurementPressure', () => {
        it('returns branch procurement pressure', async () => {
            const result = await service.getProcurementPressure(ORG);
            expect(result.orgId).toBe(ORG);
            expect(result.branches).toHaveLength(2);
            expect(result.totalUrgentCount).toBeDefined();
        });
    });
});
