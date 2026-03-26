import { Test, TestingModule } from '@nestjs/testing';
import { TillsService } from './tills.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('TillsService', () => {
    let service: TillsService;
    let prisma: any;
    let audit: any;

    const ctx = {
        branchId: 'branch-1',
        organizationId: 'org-1',
    };
    const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

    beforeEach(async () => {
        prisma = {
            shift: {
                findFirst: jest.fn(),
            },
            tillSession: {
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            cashMovement: {
                create: jest.fn(),
                findMany: jest.fn(),
            },
            payment: {
                findMany: jest.fn(),
            },
            refund: {
                findMany: jest.fn(),
            },
        };
        audit = { log: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TillsService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get<TillsService>(TillsService);
    });

    // ── Open Till ──

    it('should open a till successfully', async () => {
        prisma.shift.findFirst.mockResolvedValue({
            id: 'shift-1',
            status: 'OPEN',
            openedById: 'user-1',
        });
        prisma.tillSession.findFirst.mockResolvedValue(null); // no existing OPEN till
        prisma.tillSession.create.mockResolvedValue({
            id: 'till-1',
            tillCode: 'TILL-01',
            openingFloat: new Decimal(50000),
            status: 'OPEN',
            shiftId: 'shift-1',
        });
        prisma.cashMovement.create.mockResolvedValue({ id: 'cm-1' });

        const result = await service.openTill(
            'user-1',
            ctx,
            { tillCode: 'TILL-01', openingFloat: 50000 },
            meta,
        );

        expect(result.tillCode).toBe('TILL-01');
        expect(result.status).toBe('OPEN');
        expect(prisma.cashMovement.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: 'OPENING_FLOAT',
                    amount: expect.any(Decimal),
                }),
            }),
        );
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TILL_OPENED' }));
    });

    it('should block till open without active shift', async () => {
        prisma.shift.findFirst.mockResolvedValue(null);

        await expect(
            service.openTill('user-1', ctx, { tillCode: 'TILL-01', openingFloat: 50000 }, meta),
        ).rejects.toThrow(BadRequestException);
    });

    it('should block duplicate active till for same tillCode', async () => {
        prisma.shift.findFirst.mockResolvedValue({
            id: 'shift-1',
            status: 'OPEN',
        });
        prisma.tillSession.findFirst.mockResolvedValue({
            id: 'existing-till',
            tillCode: 'TILL-01',
            status: 'OPEN',
        });

        await expect(
            service.openTill('user-1', ctx, { tillCode: 'TILL-01', openingFloat: 50000 }, meta),
        ).rejects.toThrow(ConflictException);
    });

    // ── Safe Drop ──

    it('should perform safe drop successfully', async () => {
        prisma.tillSession.findFirst.mockResolvedValue({
            id: 'till-1',
            status: 'OPEN',
            shiftId: 'shift-1',
            tillCode: 'TILL-01',
            branchId: 'branch-1',
            orgId: 'org-1',
        });
        prisma.cashMovement.create.mockResolvedValue({
            id: 'cm-2',
            type: 'SAFE_DROP',
            amount: new Decimal(20000),
        });
        prisma.tillSession.update.mockResolvedValue({ id: 'till-1' });

        const result = await service.safeDrop(
            'till-1',
            'user-1',
            ctx,
            { amount: 20000, reason: 'Excess cash removal' },
            meta,
        );

        expect(result.type).toBe('SAFE_DROP');
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TILL_SAFE_DROP' }));
    });

    it('should reject safe drop on closed till', async () => {
        prisma.tillSession.findFirst.mockResolvedValue({
            id: 'till-1',
            status: 'RECONCILED',
            branchId: 'branch-1',
            orgId: 'org-1',
        });

        await expect(
            service.safeDrop('till-1', 'user-1', ctx, { amount: 20000, reason: 'test' }, meta),
        ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-existent till on safe drop', async () => {
        prisma.tillSession.findFirst.mockResolvedValue(null);

        await expect(
            service.safeDrop('nonexistent', 'user-1', ctx, { amount: 20000, reason: 'test' }, meta),
        ).rejects.toThrow(NotFoundException);
    });

    // ── Reconcile Till ──

    it('should reconcile till with matched variance', async () => {
        const openedAt = new Date('2026-03-26T08:00:00Z');
        prisma.tillSession.findFirst.mockResolvedValue({
            id: 'till-1',
            status: 'OPEN',
            openingFloat: new Decimal(50000),
            tillCode: 'TILL-01',
            branchId: 'branch-1',
            orgId: 'org-1',
            notes: null,
        });
        // computeExpectedCash mocks
        prisma.tillSession.findUnique.mockResolvedValue({
            id: 'till-1',
            openedAt,
            closedAt: null,
            openingFloat: new Decimal(50000),
        });
        prisma.payment.findMany.mockResolvedValue([]); // no cash payments
        prisma.cashMovement.findMany.mockResolvedValue([]); // no movements
        prisma.refund.findMany.mockResolvedValue([]); // no refunds
        prisma.tillSession.update.mockImplementation(({ data }: { data: any }) =>
            Promise.resolve({ id: 'till-1', ...data }),
        );

        const result = await service.reconcileTill(
            'till-1',
            'user-1',
            ctx,
            { countedCash: 50000 },
            meta,
        );

        expect(result.varianceStatus).toBe('MATCHED');
        expect(result.status).toBe('RECONCILED');
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TILL_RECONCILED' }));
    });

    it('should compute variance correctly (SHORT)', async () => {
        const openedAt = new Date('2026-03-26T08:00:00Z');
        prisma.tillSession.findFirst.mockResolvedValue({
            id: 'till-1',
            status: 'OPEN',
            openingFloat: new Decimal(50000),
            tillCode: 'TILL-01',
            branchId: 'branch-1',
            orgId: 'org-1',
            notes: null,
        });
        prisma.tillSession.findUnique.mockResolvedValue({
            id: 'till-1',
            openedAt,
            closedAt: null,
            openingFloat: new Decimal(50000),
        });
        prisma.payment.findMany.mockResolvedValue([{ amount: new Decimal(30000), method: 'CASH' }]);
        prisma.cashMovement.findMany.mockResolvedValue([]);
        prisma.refund.findMany.mockResolvedValue([]);
        prisma.tillSession.update.mockImplementation(({ data }: { data: any }) =>
            Promise.resolve({ id: 'till-1', ...data }),
        );

        // Expected = 50000 + 30000 = 80000, counted = 75000, variance = -5000 (SHORT)
        const result = await service.reconcileTill(
            'till-1',
            'user-1',
            ctx,
            { countedCash: 75000, varianceReason: 'Missing from drawer' },
            meta,
        );

        expect(result.varianceStatus).toBe('SHORT');
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'TILL_RECONCILE_VARIANCE' }),
        );
    });

    it('should compute variance correctly (OVER)', async () => {
        const openedAt = new Date('2026-03-26T08:00:00Z');
        prisma.tillSession.findFirst.mockResolvedValue({
            id: 'till-1',
            status: 'OPEN',
            openingFloat: new Decimal(50000),
            tillCode: 'TILL-01',
            branchId: 'branch-1',
            orgId: 'org-1',
            notes: null,
        });
        prisma.tillSession.findUnique.mockResolvedValue({
            id: 'till-1',
            openedAt,
            closedAt: null,
            openingFloat: new Decimal(50000),
        });
        prisma.payment.findMany.mockResolvedValue([]);
        prisma.cashMovement.findMany.mockResolvedValue([]);
        prisma.refund.findMany.mockResolvedValue([]);
        prisma.tillSession.update.mockImplementation(({ data }: { data: any }) =>
            Promise.resolve({ id: 'till-1', ...data }),
        );

        // Expected = 50000, counted = 55000, variance = +5000 (OVER)
        const result = await service.reconcileTill(
            'till-1',
            'user-1',
            ctx,
            { countedCash: 55000, varianceReason: 'Found extra cash' },
            meta,
        );

        expect(result.varianceStatus).toBe('OVER');
    });

    it('should require variance reason when mismatch', async () => {
        const openedAt = new Date('2026-03-26T08:00:00Z');
        prisma.tillSession.findFirst.mockResolvedValue({
            id: 'till-1',
            status: 'OPEN',
            openingFloat: new Decimal(50000),
            tillCode: 'TILL-01',
            branchId: 'branch-1',
            orgId: 'org-1',
        });
        prisma.tillSession.findUnique.mockResolvedValue({
            id: 'till-1',
            openedAt,
            closedAt: null,
            openingFloat: new Decimal(50000),
        });
        prisma.payment.findMany.mockResolvedValue([]);
        prisma.cashMovement.findMany.mockResolvedValue([]);
        prisma.refund.findMany.mockResolvedValue([]);

        await expect(
            service.reconcileTill(
                'till-1',
                'user-1',
                ctx,
                { countedCash: 45000 }, // mismatch, no reason
                meta,
            ),
        ).rejects.toThrow(BadRequestException);
    });

    it('should reject reconciliation on closed till', async () => {
        prisma.tillSession.findFirst.mockResolvedValue({
            id: 'till-1',
            status: 'RECONCILED',
            branchId: 'branch-1',
            orgId: 'org-1',
        });

        await expect(
            service.reconcileTill('till-1', 'user-1', ctx, { countedCash: 50000 }, meta),
        ).rejects.toThrow(ConflictException);
    });

    // ── Get Active Till ──

    it('should return active till for user', async () => {
        prisma.tillSession.findFirst.mockResolvedValue({
            id: 'till-1',
            status: 'OPEN',
            operatorUserId: 'user-1',
        });

        const result = await service.getActiveTill('user-1', ctx);
        expect(result).toBeDefined();
        expect(result!.status).toBe('OPEN');
    });

    it('should return null when no active till', async () => {
        prisma.tillSession.findFirst.mockResolvedValue(null);

        const result = await service.getActiveTill('user-1', ctx);
        expect(result).toBeNull();
    });

    // ── Branch Isolation ──

    it('should scope till queries to branch context', async () => {
        const otherCtx = { branchId: 'branch-2', organizationId: 'org-1' };

        prisma.shift.findFirst.mockResolvedValue({
            id: 'shift-2',
            status: 'OPEN',
            branchId: 'branch-2',
        });
        prisma.tillSession.findFirst.mockResolvedValue(null);
        prisma.tillSession.create.mockResolvedValue({
            id: 'till-2',
            tillCode: 'TILL-01',
            branchId: 'branch-2',
            status: 'OPEN',
            openingFloat: new Decimal(50000),
        });
        prisma.cashMovement.create.mockResolvedValue({ id: 'cm-3' });

        await service.openTill('user-1', otherCtx, { tillCode: 'TILL-01', openingFloat: 50000 }, meta);

        expect(prisma.tillSession.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ branchId: 'branch-2' }),
            }),
        );
    });

    // ── Active Till Check ──

    it('should return true when active till exists in branch', async () => {
        prisma.tillSession.findFirst.mockResolvedValue({ id: 'till-1' });

        const result = await service.hasActiveTillInBranch(ctx);
        expect(result).toBe(true);
    });

    it('should return false when no active till in branch', async () => {
        prisma.tillSession.findFirst.mockResolvedValue(null);

        const result = await service.hasActiveTillInBranch(ctx);
        expect(result).toBe(false);
    });
});
