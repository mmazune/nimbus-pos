import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';

describe('TenancyService', () => {
  let service: TenancyService;

  const mockPrisma = {
    organization: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenancyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<TenancyService>(TenancyService);

    jest.clearAllMocks();
  });

  // ── createOrg ──

  it('should create an organization', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    mockPrisma.organization.create.mockResolvedValue({
      id: 'org1',
      name: 'Test Org',
      slug: 'test-org',
      status: 'ACTIVE',
    });

    const result = await service.createOrg({ name: 'Test Org', slug: 'test-org' }, 'user1', {});

    expect(result.id).toBe('org1');
    expect(result.slug).toBe('test-org');
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORG_CREATED' }));
  });

  it('should reject duplicate org slug', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(service.createOrg({ name: 'Test', slug: 'taken' }, 'user1', {})).rejects.toThrow(
      ConflictException,
    );
  });

  // ── createBranch ──

  it('should create a branch', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
    mockPrisma.branch.findUnique.mockResolvedValue(null);
    mockPrisma.branch.create.mockResolvedValue({
      id: 'branch1',
      organizationId: 'org1',
      name: 'Main',
      code: 'MAIN',
    });
    mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-owner', jobRole: 'OWNER' });
    mockPrisma.membership.findFirst.mockResolvedValue(null);
    mockPrisma.membership.create.mockResolvedValue({ id: 'ms-auto' });

    const result = await service.createBranch('org1', { name: 'Main', code: 'MAIN' }, 'user1', {});

    expect(result.id).toBe('branch1');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BRANCH_CREATED' }),
    );
  });

  it('should reject branch creation if org not found', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    await expect(service.createBranch('no-org', { name: 'X' }, 'user1', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── createMembership ──

  it('should create a membership', async () => {
    mockPrisma.branch.findUnique.mockResolvedValue({ id: 'b1', organizationId: 'org1' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'r1' });
    mockPrisma.membership.findUnique.mockResolvedValue(null);
    mockPrisma.membership.create.mockResolvedValue({
      id: 'ms1',
      userId: 'u2',
      branchId: 'b1',
      organizationId: 'org1',
      roleId: 'r1',
      isDefaultBranch: false,
      user: { id: 'u2', email: 'u2@test.com', firstName: 'A', lastName: 'B' },
      branch: { id: 'b1', name: 'Main' },
      role: { id: 'r1', name: 'Cashier', level: 'L2', jobRole: 'CASHIER' },
    });

    const result = await service.createMembership(
      'org1',
      'b1',
      { userId: 'u2', roleId: 'r1' },
      'user1',
      {},
    );

    expect(result.id).toBe('ms1');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MEMBERSHIP_CREATED' }),
    );
  });

  it('should reject duplicate membership', async () => {
    mockPrisma.branch.findUnique.mockResolvedValue({ id: 'b1', organizationId: 'org1' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'r1' });
    mockPrisma.membership.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createMembership('org1', 'b1', { userId: 'u2', roleId: 'r1' }, 'user1', {}),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject membership in wrong org branch', async () => {
    mockPrisma.branch.findUnique.mockResolvedValue({ id: 'b1', organizationId: 'other-org' });

    await expect(
      service.createMembership('org1', 'b1', { userId: 'u2', roleId: 'r1' }, 'user1', {}),
    ).rejects.toThrow(NotFoundException);
  });
});
