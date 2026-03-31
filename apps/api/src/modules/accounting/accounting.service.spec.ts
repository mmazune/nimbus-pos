import { Test, TestingModule } from '@nestjs/testing';
import { AccountingService } from './accounting.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountTypeDto } from './dto';

describe('AccountingService', () => {
    let service: AccountingService;
    let prisma: any;
    let audit: any;

    const ctx = { branchId: 'branch-1', organizationId: 'org-1' };
    const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

    const mockAccount = {
        id: 'acct-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        code: '1000',
        name: 'Cash on Hand',
        accountType: 'ASSET',
        status: 'ACTIVE',
        parentAccountId: null,
        systemManaged: false,
        allowManualPosting: true,
        taxRelevant: false,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockCostCenter = {
        id: 'cc-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        code: 'CC-001',
        name: 'Main Kitchen',
        description: 'Primary kitchen cost center',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockPeriod = {
        id: 'fp-1',
        orgId: 'org-1',
        name: 'FY2025-Q1',
        startsAt: new Date('2025-01-01'),
        endsAt: new Date('2025-03-31'),
        status: 'DRAFT',
        openedAt: null,
        openedById: null,
        closedAt: null,
        closedById: null,
        lockedAt: null,
        lockedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockPostingSourceMap = {
        id: 'psm-1',
        orgId: 'org-1',
        sourceKey: 'ORDER_REVENUE',
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        costCenterRequired: false,
        active: true,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockTaxConfig = {
        id: 'tlc-1',
        orgId: 'org-1',
        outputTaxAccountId: 'acct-tax-out',
        inputTaxAccountId: 'acct-tax-in',
        discountAccountId: 'acct-disc',
        depositLiabilityAccountId: 'acct-dep',
        payrollPayableAccountId: 'acct-pay',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        prisma = {
            account: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                count: jest.fn(),
            },
            costCenter: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
            },
            fiscalPeriod: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            postingSourceMap: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
            },
            taxLedgerConfig: {
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
        };
        audit = { log: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccountingService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get<AccountingService>(AccountingService);
    });

    // ── Accounts ──

    describe('listAccounts', () => {
        it('should return paginated accounts', async () => {
            prisma.account.findMany.mockResolvedValue([mockAccount]);
            prisma.account.count.mockResolvedValue(1);

            const result = await service.listAccounts(ctx, {});
            expect(result).toEqual({ data: [mockAccount], total: 1 });
            expect(prisma.account.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orgId: 'org-1' },
                    skip: 0,
                    take: 50,
                }),
            );
        });

        it('should filter by accountType', async () => {
            prisma.account.findMany.mockResolvedValue([]);
            prisma.account.count.mockResolvedValue(0);

            await service.listAccounts(ctx, { accountType: 'ASSET' });
            expect(prisma.account.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orgId: 'org-1', accountType: 'ASSET' },
                }),
            );
        });

        it('should filter by status', async () => {
            prisma.account.findMany.mockResolvedValue([]);
            prisma.account.count.mockResolvedValue(0);

            await service.listAccounts(ctx, { status: 'ACTIVE' });
            expect(prisma.account.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orgId: 'org-1', status: 'ACTIVE' },
                }),
            );
        });
    });

    describe('createAccount', () => {
        const dto = {
            code: '1000',
            name: 'Cash on Hand',
            accountType: AccountTypeDto.ASSET,
        };

        it('should create an account and audit', async () => {
            prisma.account.findUnique.mockResolvedValue(null);
            prisma.account.create.mockResolvedValue(mockAccount);

            const result = await service.createAccount('user-1', ctx, dto, meta);
            expect(result).toEqual(mockAccount);
            expect(prisma.account.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ code: '1000', orgId: 'org-1' }),
                }),
            );
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'ACCOUNT_CREATED' }),
            );
        });

        it('should throw ConflictException for duplicate code', async () => {
            prisma.account.findUnique.mockResolvedValue(mockAccount);

            await expect(service.createAccount('user-1', ctx, dto, meta)).rejects.toThrow(
                ConflictException,
            );
        });

        it('should throw BadRequestException for invalid parent account', async () => {
            prisma.account.findUnique.mockResolvedValue(null);
            prisma.account.findFirst.mockResolvedValue(null);

            await expect(
                service.createAccount('user-1', ctx, { ...dto, parentAccountId: 'bad-id' }, meta),
            ).rejects.toThrow(BadRequestException);
        });

        it('should accept valid parent account', async () => {
            prisma.account.findUnique.mockResolvedValue(null);
            prisma.account.findFirst.mockResolvedValue(mockAccount);
            prisma.account.create.mockResolvedValue({ ...mockAccount, parentAccountId: 'acct-1' });

            const result = await service.createAccount(
                'user-1',
                ctx,
                { ...dto, parentAccountId: 'acct-1' },
                meta,
            );
            expect(result.parentAccountId).toBe('acct-1');
        });
    });

    // ── Cost Centers ──

    describe('listCostCenters', () => {
        it('should return active cost centers', async () => {
            prisma.costCenter.findMany.mockResolvedValue([mockCostCenter]);

            const result = await service.listCostCenters(ctx);
            expect(result).toEqual([mockCostCenter]);
            expect(prisma.costCenter.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orgId: 'org-1', active: true },
                }),
            );
        });
    });

    describe('createCostCenter', () => {
        const dto = { code: 'CC-001', name: 'Main Kitchen' };

        it('should create a cost center and audit', async () => {
            prisma.costCenter.findUnique.mockResolvedValue(null);
            prisma.costCenter.create.mockResolvedValue(mockCostCenter);

            const result = await service.createCostCenter('user-1', ctx, dto, meta);
            expect(result).toEqual(mockCostCenter);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'COST_CENTER_CREATED' }),
            );
        });

        it('should throw ConflictException for duplicate code', async () => {
            prisma.costCenter.findUnique.mockResolvedValue(mockCostCenter);

            await expect(service.createCostCenter('user-1', ctx, dto, meta)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    // ── Fiscal Periods ──

    describe('listFiscalPeriods', () => {
        it('should return periods ordered by startsAt desc', async () => {
            prisma.fiscalPeriod.findMany.mockResolvedValue([mockPeriod]);

            const result = await service.listFiscalPeriods('org-1');
            expect(result).toEqual([mockPeriod]);
            expect(prisma.fiscalPeriod.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orgId: 'org-1' },
                    orderBy: { startsAt: 'desc' },
                }),
            );
        });
    });

    describe('createFiscalPeriod', () => {
        const dto = {
            name: 'FY2025-Q1',
            startsAt: '2025-01-01T00:00:00.000Z',
            endsAt: '2025-03-31T23:59:59.000Z',
        };

        it('should create a fiscal period and audit', async () => {
            prisma.fiscalPeriod.findFirst.mockResolvedValue(null);
            prisma.fiscalPeriod.create.mockResolvedValue(mockPeriod);

            const result = await service.createFiscalPeriod('user-1', 'org-1', dto, meta);
            expect(result).toEqual(mockPeriod);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'FISCAL_PERIOD_CREATED' }),
            );
        });

        it('should throw BadRequestException if endsAt <= startsAt', async () => {
            await expect(
                service.createFiscalPeriod(
                    'user-1',
                    'org-1',
                    { name: 'Bad', startsAt: '2025-03-31', endsAt: '2025-01-01' },
                    meta,
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw ConflictException for overlapping periods', async () => {
            prisma.fiscalPeriod.findFirst.mockResolvedValue(mockPeriod);

            await expect(service.createFiscalPeriod('user-1', 'org-1', dto, meta)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    describe('openFiscalPeriod', () => {
        it('should open a DRAFT period', async () => {
            prisma.fiscalPeriod.findFirst.mockResolvedValue(mockPeriod);
            prisma.fiscalPeriod.update.mockResolvedValue({
                ...mockPeriod,
                status: 'OPEN',
                openedAt: new Date(),
                openedById: 'user-1',
            });

            const result = await service.openFiscalPeriod('user-1', 'org-1', 'fp-1', meta);
            expect(result.status).toBe('OPEN');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'FISCAL_PERIOD_OPENED' }),
            );
        });

        it('should throw NotFoundException if period not found', async () => {
            prisma.fiscalPeriod.findFirst.mockResolvedValue(null);

            await expect(service.openFiscalPeriod('user-1', 'org-1', 'bad-id', meta)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ConflictException if period is not DRAFT', async () => {
            prisma.fiscalPeriod.findFirst.mockResolvedValue({ ...mockPeriod, status: 'OPEN' });

            await expect(service.openFiscalPeriod('user-1', 'org-1', 'fp-1', meta)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    // ── Posting Source Maps ──

    describe('listPostingSourceMaps', () => {
        it('should return source maps with included accounts', async () => {
            prisma.postingSourceMap.findMany.mockResolvedValue([mockPostingSourceMap]);

            const result = await service.listPostingSourceMaps('org-1');
            expect(result).toEqual([mockPostingSourceMap]);
        });
    });

    describe('updatePostingSourceMap', () => {
        const dto = { debitAccountId: 'acct-new', active: true };

        it('should update a posting source map and audit', async () => {
            prisma.postingSourceMap.findFirst.mockResolvedValue(mockPostingSourceMap);
            prisma.account.findFirst.mockResolvedValue(mockAccount);
            prisma.postingSourceMap.update.mockResolvedValue({
                ...mockPostingSourceMap,
                debitAccountId: 'acct-new',
            });

            const result = await service.updatePostingSourceMap('user-1', 'org-1', 'psm-1', dto, meta);
            expect(result.debitAccountId).toBe('acct-new');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'POSTING_SOURCE_MAP_UPDATED' }),
            );
        });

        it('should throw NotFoundException if map not found', async () => {
            prisma.postingSourceMap.findFirst.mockResolvedValue(null);

            await expect(
                service.updatePostingSourceMap('user-1', 'org-1', 'bad-id', dto, meta),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException for invalid debit account', async () => {
            prisma.postingSourceMap.findFirst.mockResolvedValue(mockPostingSourceMap);
            prisma.account.findFirst.mockResolvedValue(null);

            await expect(
                service.updatePostingSourceMap('user-1', 'org-1', 'psm-1', dto, meta),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ── Tax Ledger Config ──

    describe('getTaxLedgerConfig', () => {
        it('should return active tax config', async () => {
            prisma.taxLedgerConfig.findFirst.mockResolvedValue(mockTaxConfig);

            const result = await service.getTaxLedgerConfig('org-1');
            expect(result).toEqual(mockTaxConfig);
        });

        it('should throw NotFoundException if no config', async () => {
            prisma.taxLedgerConfig.findFirst.mockResolvedValue(null);

            await expect(service.getTaxLedgerConfig('org-1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateTaxLedgerConfig', () => {
        const dto = {
            outputTaxAccountId: 'acct-tax-out',
            inputTaxAccountId: 'acct-tax-in',
        };

        it('should update existing config and audit', async () => {
            prisma.taxLedgerConfig.findFirst
                .mockResolvedValueOnce(mockTaxConfig) // first call: find existing
                .mockResolvedValueOnce(mockTaxConfig); // second call: getTaxLedgerConfig
            prisma.account.findMany.mockResolvedValue([{ id: 'acct-tax-out' }, { id: 'acct-tax-in' }]);
            prisma.taxLedgerConfig.update.mockResolvedValue(mockTaxConfig);

            const result = await service.updateTaxLedgerConfig('user-1', 'org-1', dto, meta);
            expect(result).toEqual(mockTaxConfig);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'TAX_LEDGER_CONFIG_UPDATED' }),
            );
        });

        it('should create config if none exists', async () => {
            prisma.taxLedgerConfig.findFirst
                .mockResolvedValueOnce(null) // first call: no existing
                .mockResolvedValueOnce(mockTaxConfig); // second call: getTaxLedgerConfig
            prisma.account.findMany.mockResolvedValue([{ id: 'acct-tax-out' }, { id: 'acct-tax-in' }]);
            prisma.taxLedgerConfig.create.mockResolvedValue(mockTaxConfig);

            const result = await service.updateTaxLedgerConfig('user-1', 'org-1', dto, meta);
            expect(result).toEqual(mockTaxConfig);
            expect(prisma.taxLedgerConfig.create).toHaveBeenCalled();
        });

        it('should throw BadRequestException for invalid account references', async () => {
            prisma.taxLedgerConfig.findFirst.mockResolvedValue(mockTaxConfig);
            prisma.account.findMany.mockResolvedValue([]);

            await expect(service.updateTaxLedgerConfig('user-1', 'org-1', dto, meta)).rejects.toThrow(
                BadRequestException,
            );
        });
    });
});
