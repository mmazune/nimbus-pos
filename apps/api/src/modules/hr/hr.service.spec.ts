import { Test, TestingModule } from '@nestjs/testing';
import { HrService } from './hr.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FORBIDDEN_SAFE_EMPLOYEE_KEYS, resolveEmployeeView } from './employee-projection';

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

  // ── C-02 (NG-02 / MP0-01): compensation + PII projection ──

  describe('C-02 employee projection', () => {
    /**
     * A row exactly as Postgres would have returned it BEFORE C-02: every sensitive
     * column populated. The projection is asserted against this worst case, so the test
     * fails if a future change re-widens the payload.
     */
    const leakyEmployee = {
      ...mockEmployee,
      dateOfBirth: new Date('1994-03-02'),
      address: { line1: '12 Kira Road', city: 'Kampala' },
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+256700000009',
      notes: 'On a performance improvement plan',
      metadata: { bankAccount: '01234567890', tin: 'TIN-99881' },
      compensationProfileId: 'comp-1',
      compensationProfile: {
        id: 'comp-1',
        code: 'MONTHLY-STANDARD',
        salaryBasis: 'MONTHLY',
        baseAmount: 2800000,
        currency: 'UGX',
        allowances: { transport: 200000 },
        deductions: { nssf: 150000 },
      },
      position: mockPosition,
    };

    /** Permission sets taken from packages/db/prisma/seed.ts ROLE_PERM_MATRIX. */
    const MANAGER_PERMISSIONS = [
      'pos:hr:employees:read',
      'pos:hr:employees:create',
      'pos:hr:employees:update',
      'pos:hr:contracts:read',
      'pos:hr:compensation:read',
    ];
    const SUPERVISOR_PERMISSIONS = ['pos:hr:employees:read', 'pos:hr:contracts:read'];

    it('default list projection returns NO compensation and NO personal PII (manager token)', async () => {
      prisma.employee.findMany.mockResolvedValue([leakyEmployee]);
      prisma.employee.count.mockResolvedValue(1);

      const view = resolveEmployeeView(undefined, MANAGER_PERMISSIONS);
      const result = await service.listEmployees(ctx, {}, view);

      expect(view).toBe('safe');
      expect(result.view).toBe('safe');
      expect(result.data).toHaveLength(1);

      const row = result.data[0] as Record<string, unknown>;
      for (const forbidden of FORBIDDEN_SAFE_EMPLOYEE_KEYS) {
        expect(row).not.toHaveProperty(forbidden);
      }
      // The directory fields a Staff list actually needs survive.
      expect(row.id).toBe('emp-1');
      expect(row.employeeCode).toBe('EMP-00001');
      expect(row.firstName).toBe('John');
      expect(row.lastName).toBe('Doe');
      expect(row.status).toBe('ACTIVE');
      expect(row.employmentType).toBe('PERMANENT');
      expect(row.position).toEqual(mockPosition);
      // The link is kept; the amounts behind it are not.
      expect(row.compensationProfileId).toBe('comp-1');
      // Serialised the way the wire sees it — belt and braces.
      expect(JSON.stringify(row)).not.toContain('2800000');
      expect(JSON.stringify(row)).not.toContain('01234567890');
    });

    it('default list never SELECTS the sensitive columns from Postgres', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await service.listEmployees(ctx, {}, 'safe');

      const args = prisma.employee.findMany.mock.calls[0][0];
      expect(args.include).toBeUndefined();
      expect(args.select).toBeDefined();
      expect(args.select.compensationProfile).toBeUndefined();
      expect(args.select.dateOfBirth).toBeUndefined();
      expect(args.select.address).toBeUndefined();
      expect(args.select.notes).toBeUndefined();
      expect(args.select.metadata).toBeUndefined();
      expect(args.select.firstName).toBe(true);
    });

    it('view=full still returns compensation for a token holding pos:hr:compensation:read', async () => {
      prisma.employee.findMany.mockResolvedValue([leakyEmployee]);
      prisma.employee.count.mockResolvedValue(1);

      const view = resolveEmployeeView('full', MANAGER_PERMISSIONS);
      const result = await service.listEmployees(ctx, {}, view);

      expect(view).toBe('full');
      expect(result.view).toBe('full');
      const row = result.data[0] as any;
      expect(row.compensationProfile.baseAmount).toBe(2800000);
      expect(prisma.employee.findMany.mock.calls[0][0].include).toEqual({
        position: true,
        compensationProfile: true,
      });
    });

    it('view=full is refused (403) without pos:hr:compensation:read', () => {
      expect(() => resolveEmployeeView('full', SUPERVISOR_PERMISSIONS)).toThrow(ForbiddenException);
      expect(() => resolveEmployeeView('full', [])).toThrow(/pos:hr:compensation:read/);
    });

    it('unknown view values fall back to safe rather than failing open', () => {
      expect(resolveEmployeeView(undefined, [])).toBe('safe');
      expect(resolveEmployeeView('safe', [])).toBe('safe');
      expect(resolveEmployeeView('FULL', MANAGER_PERMISSIONS)).toBe('safe');
    });

    it('detail route drops contract salary on the safe path', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        ...leakyEmployee,
        contracts: [
          {
            id: 'ctr-1',
            contractNumber: 'CTR-00001',
            contractStatus: 'ACTIVE',
            startsAt: new Date('2024-01-15'),
            endsAt: null,
            salaryBasis: 'MONTHLY',
            salaryAmount: 2800000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const result: any = await service.getEmployee(ctx, 'emp-1', 'safe');

      expect(result.contracts).toHaveLength(1);
      expect(result.contracts[0].contractNumber).toBe('CTR-00001');
      expect(result.contracts[0]).not.toHaveProperty('salaryAmount');
      expect(result.contracts[0]).not.toHaveProperty('salaryBasis');
      for (const forbidden of FORBIDDEN_SAFE_EMPLOYEE_KEYS) {
        expect(result).not.toHaveProperty(forbidden);
      }
      expect(JSON.stringify(result)).not.toContain('2800000');
    });

    it('create and update echoes are projected too', async () => {
      prisma.employee.count.mockResolvedValue(0);
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.employee.create.mockResolvedValue(leakyEmployee);

      const created: any = await service.createEmployee(
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
      expect(created).not.toHaveProperty('compensationProfile');
      expect(created).not.toHaveProperty('notes');
      expect(prisma.employee.create.mock.calls[0][0].select).toBeDefined();

      prisma.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.employee.update.mockResolvedValue(leakyEmployee);
      const updated: any = await service.updateEmployee('user-1', ctx, 'emp-1', {
        firstName: 'John',
      });
      expect(updated).not.toHaveProperty('compensationProfile');
      expect(updated).not.toHaveProperty('address');
    });

    it('contract list embeds the projected employee, keeping contract salary itself', async () => {
      prisma.employmentContract.findMany.mockResolvedValue([mockContract]);
      prisma.employmentContract.count.mockResolvedValue(1);

      await service.listContracts(ctx, {});

      const args = prisma.employmentContract.findMany.mock.calls[0][0];
      expect(args.include.employee.select).toBeDefined();
      expect(args.include.employee.select.dateOfBirth).toBeUndefined();
      expect(args.include.employee.select.compensationProfile).toBeUndefined();
      expect(args.include.employee).not.toBe(true);
    });
  });
});
