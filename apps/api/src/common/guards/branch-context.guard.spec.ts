import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BranchContextGuard } from './branch-context.guard';
import { PrismaService } from '../prisma';
import { AuditService } from '../audit';

describe('BranchContextGuard', () => {
  let guard: BranchContextGuard;
  let reflector: Reflector;

  const mockPrisma = {
    branch: { findUnique: jest.fn() },
    membership: { findFirst: jest.fn() },
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  function createMockContext(
    headers: Record<string, string> = {},
    user: any = null,
  ): ExecutionContext {
    const request = {
      headers,
      user,
      ip: '127.0.0.1',
      branchContext: undefined,
    };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchContextGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    guard = module.get<BranchContextGuard>(BranchContextGuard);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  it('should pass when guard is not required', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const context = createMockContext();
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw 400 when X-Branch-Id header is missing', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const context = createMockContext({}, { id: 'user1' });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw 403 when user has no membership', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    mockPrisma.branch.findUnique.mockResolvedValue({ id: 'b1', status: 'ACTIVE' });
    mockPrisma.membership.findFirst.mockResolvedValue(null);

    const context = createMockContext({ 'x-branch-id': 'b1' }, { id: 'user1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BRANCH_ACCESS_DENIED' }),
    );
  });

  it('should pass and attach context for valid member', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b1',
      organizationId: 'org1',
      status: 'ACTIVE',
    });
    mockPrisma.membership.findFirst.mockResolvedValue({
      id: 'ms1',
      branchId: 'b1',
      organizationId: 'org1',
      roleId: 'r1',
    });

    const context = createMockContext({ 'x-branch-id': 'b1' }, { id: 'user1' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);

    const request = context.switchToHttp().getRequest();
    expect(request.branchContext).toEqual({
      branchId: 'b1',
      organizationId: 'org1',
      roleId: 'r1',
      membershipId: 'ms1',
    });
  });
});
