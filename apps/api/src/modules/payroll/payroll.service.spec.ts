import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('PayrollService', () => {
    let service: PayrollService;
    let prisma: any;
    let audit: any;

    const ctx = { branchId: 'branch-1', organizationId: 'org-1' };
    const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

    const mockPayComponent = {
        id: 'comp-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        code: 'BASIC-SAL',
        name: 'Basic Salary',
        componentType: 'EARNING',
        calculationMethod: null,
        defaultAmount: { toString: () => '500000' },
        taxable: true,
        active: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockEmployee = {
        id: 'emp-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        employeeCode: 'EMP-00001',
        firstName: 'Alice',
        lastName: 'Nakamya',
        status: 'ACTIVE',
        compensationProfile: {
            baseAmount: { toString: () => '500000' },
        },
    };

    const mockPayRun = {
        id: 'run-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        name: 'April 2025',
        periodStart: new Date('2025-04-01'),
        periodEnd: new Date('2025-04-30'),
        status: 'DRAFT',
        builtById: 'user-1',
        approvedById: null,
        approvedAt: null,
        paidById: null,
        paidAt: null,
        employeeCount: 1,
        grossTotal: { toString: () => '500000' },
        netTotal: { toString: () => '475000' },
        postingPayload: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        paySlips: [],
    };

    const mockPaySlip = {
        id: 'slip-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        payRunId: 'run-1',
        employeeId: 'emp-1',
        status: 'DRAFT',
        grossPay: { toString: () => '500000' },
        totalDeductions: { toString: () => '25000' },
        netPay: { toString: () => '475000' },
        componentSnapshot: {},
        generatedAt: new Date(),
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        prisma = {
            payComponent: {
                create: jest.fn(),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
            },
            payrollAdjustment: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
            },
            payRun: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
                update: jest.fn(),
            },
            paySlip: {
                create: jest.fn(),
                createMany: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
                updateMany: jest.fn(),
            },
            employee: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
            },
            $transaction: jest.fn(),
        };
        audit = { log: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PayrollService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get<PayrollService>(PayrollService);
    });

    // ── Pay Components ──

    describe('createPayComponent', () => {
        it('should create a pay component', async () => {
            prisma.payComponent.findUnique.mockResolvedValue(null);
            prisma.payComponent.create.mockResolvedValue(mockPayComponent);

            const result = await service.createPayComponent(
                'user-1',
                ctx,
                {
                    code: 'BASIC-SAL',
                    name: 'Basic Salary',
                    componentType: 'EARNING' as any,
                    taxable: true,
                },
                meta,
            );

            expect(result).toEqual(mockPayComponent);
            expect(prisma.payComponent.create).toHaveBeenCalled();
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PAY_COMPONENT_CREATED' }),
            );
        });

        it('should reject duplicate component code', async () => {
            prisma.payComponent.findUnique.mockResolvedValue(mockPayComponent);

            await expect(
                service.createPayComponent(
                    'user-1',
                    ctx,
                    {
                        code: 'BASIC-SAL',
                        name: 'Basic Salary',
                        componentType: 'EARNING' as any,
                    },
                    meta,
                ),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('listPayComponents', () => {
        it('should return components for org/branch', async () => {
            prisma.payComponent.findMany.mockResolvedValue([mockPayComponent]);

            const result = await service.listPayComponents(ctx);
            expect(result).toEqual([mockPayComponent]);
        });
    });

    // ── Payroll Adjustments ──

    describe('createPayrollAdjustment', () => {
        it('should create an adjustment', async () => {
            const mockAdj = { id: 'adj-1', orgId: 'org-1', branchId: 'branch-1', adjustmentType: 'BONUS', amount: 100000 };
            prisma.employee.findFirst.mockResolvedValue(mockEmployee);
            prisma.payrollAdjustment.create.mockResolvedValue(mockAdj as any);

            const result = await service.createPayrollAdjustment(
                'user-1',
                ctx,
                {
                    employeeId: 'emp-1',
                    adjustmentType: 'BONUS' as any,
                    amount: 100000,
                    effectiveDate: '2025-04-15',
                },
                meta,
            );

            expect(result).toEqual(mockAdj);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PAYROLL_ADJUSTMENT_CREATED' }),
            );
        });

        it('should reject unknown employee', async () => {
            prisma.employee.findFirst.mockResolvedValue(null);

            await expect(
                service.createPayrollAdjustment(
                    'user-1',
                    ctx,
                    {
                        employeeId: 'emp-999',
                        adjustmentType: 'BONUS' as any,
                        amount: 100000,
                        effectiveDate: '2025-04-15',
                    },
                    meta,
                ),
            ).rejects.toThrow(NotFoundException);
        });

        it('should reject unknown pay component', async () => {
            prisma.employee.findFirst.mockResolvedValue(mockEmployee);
            prisma.payComponent.findFirst.mockResolvedValue(null);

            await expect(
                service.createPayrollAdjustment(
                    'user-1',
                    ctx,
                    {
                        employeeId: 'emp-1',
                        payComponentId: 'comp-999',
                        adjustmentType: 'BONUS' as any,
                        amount: 100000,
                        effectiveDate: '2025-04-15',
                    },
                    meta,
                ),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('listPayrollAdjustments', () => {
        it('should return adjustments', async () => {
            prisma.payrollAdjustment.findMany.mockResolvedValue([]);
            prisma.payrollAdjustment.count.mockResolvedValue(0);

            const result = await service.listPayrollAdjustments(ctx, {});
            expect(result).toEqual({ data: [], total: 0 });
        });
    });

    // ── Pay Runs ──

    describe('buildPayRun', () => {
        it('should reject when periodEnd < periodStart', async () => {
            await expect(
                service.buildPayRun(
                    'user-1',
                    ctx,
                    {
                        name: 'Bad Run',
                        periodStart: '2025-04-30',
                        periodEnd: '2025-04-01',
                    },
                    meta,
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject overlapping pay run', async () => {
            prisma.payRun.findFirst.mockResolvedValue(mockPayRun);

            await expect(
                service.buildPayRun(
                    'user-1',
                    ctx,
                    {
                        name: 'April 2025',
                        periodStart: '2025-04-01',
                        periodEnd: '2025-04-30',
                    },
                    meta,
                ),
            ).rejects.toThrow(ConflictException);
        });

        it('should reject when no active employees', async () => {
            prisma.payRun.findFirst.mockResolvedValue(null);
            prisma.employee.findMany.mockResolvedValue([]);

            await expect(
                service.buildPayRun(
                    'user-1',
                    ctx,
                    {
                        name: 'April 2025',
                        periodStart: '2025-04-01',
                        periodEnd: '2025-04-30',
                    },
                    meta,
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should build a pay run with payslips', async () => {
            prisma.payRun.findFirst.mockResolvedValue(null);
            prisma.employee.findMany.mockResolvedValue([mockEmployee]);
            prisma.payComponent.findMany.mockResolvedValue([]);
            prisma.payrollAdjustment.findMany.mockResolvedValue([]);
            prisma.$transaction.mockImplementation(async (fn: any) => {
                const tx = {
                    payRun: {
                        create: jest.fn().mockResolvedValue({ ...mockPayRun, id: 'run-new' }),
                        findUnique: jest
                            .fn()
                            .mockResolvedValue({ ...mockPayRun, id: 'run-new', paySlips: [mockPaySlip] }),
                    },
                    paySlip: {
                        createMany: jest.fn().mockResolvedValue({ count: 1 }),
                    },
                };
                return fn(tx);
            });

            const result = await service.buildPayRun(
                'user-1',
                ctx,
                {
                    name: 'April 2025',
                    periodStart: '2025-04-01',
                    periodEnd: '2025-04-30',
                },
                meta,
            );

            expect(result).toBeDefined();
            expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAY_RUN_BUILT' }));
        });
    });

    describe('approvePayRun', () => {
        it('should approve a DRAFT pay run', async () => {
            prisma.payRun.findFirst.mockResolvedValue(mockPayRun);
            const approved = { ...mockPayRun, status: 'APPROVED', approvedById: 'user-1' };
            prisma.$transaction.mockImplementation(async (fn: any) => {
                const tx = {
                    payRun: { update: jest.fn().mockResolvedValue(approved) },
                    paySlip: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
                };
                return fn(tx);
            });

            const result = await service.approvePayRun('user-1', ctx, 'run-1', {}, meta);
            expect(result.status).toBe('APPROVED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PAY_RUN_APPROVED' }),
            );
        });

        it('should reject non-DRAFT pay run', async () => {
            prisma.payRun.findFirst.mockResolvedValue({ ...mockPayRun, status: 'APPROVED' });

            await expect(service.approvePayRun('user-1', ctx, 'run-1', {}, meta)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should reject unknown pay run', async () => {
            prisma.payRun.findFirst.mockResolvedValue(null);

            await expect(service.approvePayRun('user-1', ctx, 'run-999', {}, meta)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('payPayRun', () => {
        it('should pay an APPROVED pay run', async () => {
            prisma.payRun.findFirst.mockResolvedValue({ ...mockPayRun, status: 'APPROVED' });
            const paid = { ...mockPayRun, status: 'PAID', paidById: 'user-1' };
            prisma.$transaction.mockImplementation(async (fn: any) => {
                const tx = {
                    payRun: { update: jest.fn().mockResolvedValue(paid) },
                    paySlip: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
                };
                return fn(tx);
            });

            const result = await service.payPayRun('user-1', ctx, 'run-1', {}, meta);
            expect(result.status).toBe('PAID');
            expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAY_RUN_PAID' }));
        });

        it('should reject non-APPROVED pay run', async () => {
            prisma.payRun.findFirst.mockResolvedValue({ ...mockPayRun, status: 'DRAFT' });

            await expect(service.payPayRun('user-1', ctx, 'run-1', {}, meta)).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('getPayRun', () => {
        it('should return a pay run with payslips', async () => {
            prisma.payRun.findFirst.mockResolvedValue({ ...mockPayRun, paySlips: [mockPaySlip] });

            const result = await service.getPayRun(ctx, 'run-1');
            expect(result.id).toBe('run-1');
        });

        it('should throw NotFoundException for missing pay run', async () => {
            prisma.payRun.findFirst.mockResolvedValue(null);

            await expect(service.getPayRun(ctx, 'run-999')).rejects.toThrow(NotFoundException);
        });
    });

    describe('listPayRuns', () => {
        it('should return paginated pay runs', async () => {
            prisma.payRun.findMany.mockResolvedValue([mockPayRun]);
            prisma.payRun.count.mockResolvedValue(1);

            const result = await service.listPayRuns(ctx, {});
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    // ── Pay Slips ──

    describe('getPaySlip', () => {
        it('should return a pay slip', async () => {
            prisma.paySlip.findFirst.mockResolvedValue(mockPaySlip);

            const result = await service.getPaySlip(ctx, 'slip-1');
            expect(result.id).toBe('slip-1');
        });

        it('should throw NotFoundException for missing slip', async () => {
            prisma.paySlip.findFirst.mockResolvedValue(null);

            await expect(service.getPaySlip(ctx, 'slip-999')).rejects.toThrow(NotFoundException);
        });
    });

    describe('listPaySlips', () => {
        it('should return paginated pay slips', async () => {
            prisma.paySlip.findMany.mockResolvedValue([mockPaySlip]);
            prisma.paySlip.count.mockResolvedValue(1);

            const result = await service.listPaySlips(ctx, {});
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });
});
