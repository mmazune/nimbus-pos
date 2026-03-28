import { Test, TestingModule } from '@nestjs/testing';
import { HrService } from './hr.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('HrService', () => {
    let service: HrService;
    let prisma: any;
    let audit: any;

    const ctx = { branchId: 'branch-1', organizationId: 'org-1' };
    const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

    const mockEmployee = {
        id: 'emp-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        userId: null,
        employeeCode: 'EMP-00001',
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        phone: '+256700000001',
        email: 'john@example.com',
        dateOfBirth: null,
        hireDate: new Date('2024-01-15'),
        status: 'ACTIVE',
        employmentType: 'PERMANENT',
        positionId: null,
        compensationProfileId: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        address: null,
        notes: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        position: null,
        compensationProfile: null,
    };

    const mockContract = {
        id: 'ctr-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        employeeId: 'emp-1',
        contractNumber: 'CTR-00001',
        contractStatus: 'DRAFT',
        startsAt: new Date('2024-01-15'),
        endsAt: null,
        salaryBasis: 'MONTHLY',
        salaryAmount: 5000000,
        termsSummary: null,
        createdById: 'user-1',
        updatedById: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        employee: mockEmployee,
    };

    const mockPosition = {
        id: 'pos-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        code: 'HEAD-CHEF',
        title: 'Head Chef',
        department: 'Kitchen',
        level: 'Senior',
        description: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockProfile = {
        id: 'comp-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        code: 'MONTHLY-STANDARD',
        salaryBasis: 'MONTHLY',
        baseAmount: 3000000,
        currency: 'UGX',
        allowances: null,
        deductions: null,
        notes: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        prisma = {
            employee: {
                create: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
                update: jest.fn(),
            },
            employmentContract: {
                create: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
            },
            position: {
                create: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
            },
            compensationProfile: {
                create: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
            },
            user: {
                findUnique: jest.fn(),
            },
        };
        audit = { log: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HrService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get<HrService>(HrService);
    });

    // ── Employee Creation ──

    describe('createEmployee', () => {
        it('should create employee with auto-generated code', async () => {
            prisma.employee.count.mockResolvedValue(0);
            prisma.employee.findUnique.mockResolvedValue(null);
            prisma.employee.create.mockResolvedValue(mockEmployee);

            const result = await service.createEmployee(
                'user-1',
                ctx,
                {
                    firstName: 'John',
                    lastName: 'Doe',
                    hireDate: '2024-01-15',
                    employmentType: 'PERMANENT' as any,
                },
                meta,
            );

            expect(result).toBeDefined();
            expect(result.firstName).toBe('John');
            expect(prisma.employee.create).toHaveBeenCalledTimes(1);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'EMPLOYEE_CREATED' }),
            );
        });

        it('should create employee with explicit code', async () => {
            prisma.employee.findUnique.mockResolvedValue(null);
            prisma.employee.create.mockResolvedValue({ ...mockEmployee, employeeCode: 'CHEF-001' });

            const result = await service.createEmployee(
                'user-1',
                ctx,
                {
                    employeeCode: 'CHEF-001',
                    firstName: 'John',
                    lastName: 'Doe',
                    hireDate: '2024-01-15',
                    employmentType: 'PERMANENT' as any,
                },
                meta,
            );

            expect(result.employeeCode).toBe('CHEF-001');
        });

        it('should create employee without userId', async () => {
            prisma.employee.count.mockResolvedValue(2);
            prisma.employee.findUnique.mockResolvedValue(null);
            prisma.employee.create.mockResolvedValue({ ...mockEmployee, userId: null });

            const result = await service.createEmployee(
                'user-1',
                ctx,
                {
                    firstName: 'Jane',
                    lastName: 'Doe',
                    hireDate: '2024-01-15',
                    employmentType: 'TEMPORARY' as any,
                },
                meta,
            );

            expect(result.userId).toBeNull();
        });

        it('should reject duplicate employee code', async () => {
            prisma.employee.count.mockResolvedValue(0);
            // First call: check for existing by code (returns existing)
            prisma.employee.findUnique.mockResolvedValueOnce(mockEmployee);

            await expect(
                service.createEmployee(
                    'user-1',
                    ctx,
                    {
                        employeeCode: 'EMP-00001',
                        firstName: 'John',
                        lastName: 'Doe',
                        hireDate: '2024-01-15',
                        employmentType: 'PERMANENT' as any,
                    },
                    meta,
                ),
            ).rejects.toThrow(ConflictException);
        });

        it('should reject if userId not found', async () => {
            prisma.employee.count.mockResolvedValue(0);
            prisma.employee.findUnique.mockResolvedValue(null); // code check
            prisma.user.findUnique.mockResolvedValue(null); // user not found

            await expect(
                service.createEmployee(
                    'user-1',
                    ctx,
                    {
                        userId: 'nonexistent-user',
                        firstName: 'John',
                        lastName: 'Doe',
                        hireDate: '2024-01-15',
                        employmentType: 'PERMANENT' as any,
                    },
                    meta,
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject if userId already linked to another employee', async () => {
            prisma.employee.count.mockResolvedValue(0);
            // First findUnique: code check (null = not found)
            prisma.employee.findUnique.mockResolvedValueOnce(null);
            prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
            // Second findUnique: userId check (linked employee found)
            prisma.employee.findUnique.mockResolvedValueOnce({ ...mockEmployee, userId: 'user-2' });

            await expect(
                service.createEmployee(
                    'user-1',
                    ctx,
                    {
                        userId: 'user-2',
                        firstName: 'John',
                        lastName: 'Doe',
                        hireDate: '2024-01-15',
                        employmentType: 'PERMANENT' as any,
                    },
                    meta,
                ),
            ).rejects.toThrow(ConflictException);
        });
    });

    // ── Employee Update ──

    describe('updateEmployee', () => {
        it('should update employee fields', async () => {
            prisma.employee.findUnique.mockResolvedValue(mockEmployee);
            prisma.employee.update.mockResolvedValue({ ...mockEmployee, firstName: 'Jane' });

            const result = await service.updateEmployee(
                'user-1',
                ctx,
                'emp-1',
                {
                    firstName: 'Jane',
                },
                meta,
            );

            expect(result.firstName).toBe('Jane');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'EMPLOYEE_UPDATED' }),
            );
        });

        it('should 404 on unknown employee', async () => {
            prisma.employee.findUnique.mockResolvedValue(null);

            await expect(
                service.updateEmployee('user-1', ctx, 'nonexistent', { firstName: 'Jane' }, meta),
            ).rejects.toThrow(NotFoundException);
        });

        it('should 404 on employee from different org', async () => {
            prisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, orgId: 'org-other' });

            await expect(
                service.updateEmployee('user-1', ctx, 'emp-1', { firstName: 'Jane' }, meta),
            ).rejects.toThrow(NotFoundException);
        });

        it('should update status with audit trail', async () => {
            prisma.employee.findUnique.mockResolvedValue(mockEmployee);
            prisma.employee.update.mockResolvedValue({ ...mockEmployee, status: 'ON_LEAVE' });

            await service.updateEmployee(
                'user-1',
                ctx,
                'emp-1',
                {
                    status: 'ON_LEAVE' as any,
                },
                meta,
            );

            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'EMPLOYEE_UPDATED',
                    metadata: expect.objectContaining({
                        statusChange: { from: 'ACTIVE', to: 'ON_LEAVE' },
                    }),
                }),
            );
        });
    });

    // ── Employee List ──

    describe('listEmployees', () => {
        it('should list employees with pagination', async () => {
            prisma.employee.findMany.mockResolvedValue([mockEmployee]);
            prisma.employee.count.mockResolvedValue(1);

            const result = await service.listEmployees(ctx, {});

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.skip).toBe(0);
            expect(result.take).toBe(50);
        });

        it('should filter by status', async () => {
            prisma.employee.findMany.mockResolvedValue([]);
            prisma.employee.count.mockResolvedValue(0);

            await service.listEmployees(ctx, { status: 'TERMINATED' as any });

            expect(prisma.employee.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ status: 'TERMINATED' }),
                }),
            );
        });

        it('should filter by search term', async () => {
            prisma.employee.findMany.mockResolvedValue([]);
            prisma.employee.count.mockResolvedValue(0);

            await service.listEmployees(ctx, { search: 'John' });

            expect(prisma.employee.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            expect.objectContaining({ firstName: { contains: 'John', mode: 'insensitive' } }),
                        ]),
                    }),
                }),
            );
        });
    });

    // ── Get Employee ──

    describe('getEmployee', () => {
        it('should return employee with contracts', async () => {
            prisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, contracts: [] });

            const result = await service.getEmployee(ctx, 'emp-1');

            expect(result).toBeDefined();
            expect(result.contracts).toBeDefined();
        });

        it('should 404 on missing employee', async () => {
            prisma.employee.findUnique.mockResolvedValue(null);

            await expect(service.getEmployee(ctx, 'nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    // ── Contract Creation ──

    describe('createContract', () => {
        it('should create contract with auto-generated number', async () => {
            prisma.employee.findUnique.mockResolvedValue(mockEmployee);
            prisma.employmentContract.count.mockResolvedValue(0);
            prisma.employmentContract.findUnique.mockResolvedValue(null);
            prisma.employmentContract.create.mockResolvedValue(mockContract);

            const result = await service.createContract(
                'user-1',
                ctx,
                {
                    employeeId: 'emp-1',
                    startsAt: '2024-01-15',
                    salaryBasis: 'MONTHLY' as any,
                    salaryAmount: 5000000,
                },
                meta,
            );

            expect(result).toBeDefined();
            expect(result.contractNumber).toBe('CTR-00001');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'CONTRACT_CREATED' }),
            );
        });

        it('should reject duplicate contract number', async () => {
            prisma.employee.findUnique.mockResolvedValue(mockEmployee);
            prisma.employmentContract.findUnique.mockResolvedValue(mockContract);

            await expect(
                service.createContract(
                    'user-1',
                    ctx,
                    {
                        contractNumber: 'CTR-00001',
                        employeeId: 'emp-1',
                        startsAt: '2024-01-15',
                        salaryBasis: 'MONTHLY' as any,
                    },
                    meta,
                ),
            ).rejects.toThrow(ConflictException);
        });

        it('should reject if employee not found', async () => {
            prisma.employee.findUnique.mockResolvedValue(null);

            await expect(
                service.createContract(
                    'user-1',
                    ctx,
                    {
                        employeeId: 'nonexistent',
                        startsAt: '2024-01-15',
                        salaryBasis: 'MONTHLY' as any,
                    },
                    meta,
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject if employee from different org', async () => {
            prisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, orgId: 'org-other' });

            await expect(
                service.createContract(
                    'user-1',
                    ctx,
                    {
                        employeeId: 'emp-1',
                        startsAt: '2024-01-15',
                        salaryBasis: 'MONTHLY' as any,
                    },
                    meta,
                ),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ── List Contracts ──

    describe('listContracts', () => {
        it('should list contracts with filters', async () => {
            prisma.employmentContract.findMany.mockResolvedValue([mockContract]);
            prisma.employmentContract.count.mockResolvedValue(1);

            const result = await service.listContracts(ctx, {
                employeeId: 'emp-1',
            });

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    // ── Positions ──

    describe('createPosition', () => {
        it('should create a position', async () => {
            prisma.position.findUnique.mockResolvedValue(null);
            prisma.position.create.mockResolvedValue(mockPosition);

            const result = await service.createPosition(
                'user-1',
                ctx,
                {
                    code: 'HEAD-CHEF',
                    title: 'Head Chef',
                    department: 'Kitchen',
                },
                meta,
            );

            expect(result.code).toBe('HEAD-CHEF');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'POSITION_CREATED' }),
            );
        });

        it('should reject duplicate position code', async () => {
            prisma.position.findUnique.mockResolvedValue(mockPosition);

            await expect(
                service.createPosition(
                    'user-1',
                    ctx,
                    {
                        code: 'HEAD-CHEF',
                        title: 'Head Chef',
                    },
                    meta,
                ),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('listPositions', () => {
        it('should list positions sorted by title', async () => {
            prisma.position.findMany.mockResolvedValue([mockPosition]);

            const result = await service.listPositions(ctx);

            expect(result).toHaveLength(1);
            expect(prisma.position.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { title: 'asc' } }),
            );
        });
    });

    // ── Compensation Profiles ──

    describe('createCompensationProfile', () => {
        it('should create a compensation profile', async () => {
            prisma.compensationProfile.findUnique.mockResolvedValue(null);
            prisma.compensationProfile.create.mockResolvedValue(mockProfile);

            const result = await service.createCompensationProfile(
                'user-1',
                ctx,
                {
                    code: 'MONTHLY-STANDARD',
                    salaryBasis: 'MONTHLY' as any,
                    baseAmount: 3000000,
                    currency: 'UGX',
                },
                meta,
            );

            expect(result.code).toBe('MONTHLY-STANDARD');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'COMPENSATION_PROFILE_CREATED' }),
            );
        });

        it('should reject duplicate profile code', async () => {
            prisma.compensationProfile.findUnique.mockResolvedValue(mockProfile);

            await expect(
                service.createCompensationProfile(
                    'user-1',
                    ctx,
                    {
                        code: 'MONTHLY-STANDARD',
                        salaryBasis: 'MONTHLY' as any,
                    },
                    meta,
                ),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('listCompensationProfiles', () => {
        it('should list profiles sorted by code', async () => {
            prisma.compensationProfile.findMany.mockResolvedValue([mockProfile]);

            const result = await service.listCompensationProfiles(ctx);

            expect(result).toHaveLength(1);
            expect(prisma.compensationProfile.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { code: 'asc' } }),
            );
        });
    });
});
