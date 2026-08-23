import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmployeeCredentialResetService } from './employee-credential-reset.service';
import { PrismaService } from '../../common/prisma';
import { PasswordLifecycleService } from '../auth/password-lifecycle.service';

describe('EmployeeCredentialResetService — B6.7', () => {
  let service: EmployeeCredentialResetService;

  const mockPrisma = {
    employee: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const mockPasswordLifecycle = {
    adminForceReset: jest.fn(),
    getForceResetStatus: jest.fn(),
  };

  const ctx = { organizationId: 'org-1', branchId: 'branch-1' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeCredentialResetService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PasswordLifecycleService, useValue: mockPasswordLifecycle },
      ],
    }).compile();
    service = module.get(EmployeeCredentialResetService);
  });

  it('404s on a missing employee — never confirms existence with a 403', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);
    await expect(service.trigger('manager-1', ctx, 'emp-x')).rejects.toThrow(NotFoundException);
  });

  it('404s on a cross-branch employee (B3-F1 guard pattern)', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      orgId: 'org-1',
      branchId: 'branch-OTHER',
      userId: 'user-1',
    });
    await expect(service.trigger('manager-1', ctx, 'emp-1')).rejects.toThrow(NotFoundException);
  });

  it('404s on an employee with a NULL branchId', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      orgId: 'org-1',
      branchId: null,
      userId: 'user-1',
    });
    await expect(service.trigger('manager-1', ctx, 'emp-1')).rejects.toThrow(NotFoundException);
  });

  it('400s on an employee with no linked User account', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      userId: null,
    });
    await expect(service.trigger('manager-1', ctx, 'emp-1')).rejects.toThrow(BadRequestException);
  });

  it('400s on a PIN-only (synthetic-email) account, naming Quick-PIN reset', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      userId: 'user-1',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      email: 'pin-abc123@nimbus.pin.local', // synthetic pattern (PIN-only account)
    });
    await expect(service.trigger('manager-1', ctx, 'emp-1')).rejects.toThrow(/Quick-PIN reset/);
    expect(mockPasswordLifecycle.adminForceReset).not.toHaveBeenCalled();
  });

  it('delegates to PasswordLifecycleService.adminForceReset for a real password-login employee', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      userId: 'user-1',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      email: 'manager.demo@nimbus.test',
    });
    mockPasswordLifecycle.adminForceReset.mockResolvedValue({
      ok: true,
      userId: 'user-1',
      expiresAt: new Date(),
    });

    const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };
    const result = await service.trigger('manager-1', ctx, 'emp-1', meta);

    expect(result.ok).toBe(true);
    expect(mockPasswordLifecycle.adminForceReset).toHaveBeenCalledWith(
      'user-1',
      { id: 'manager-1', branchId: 'branch-1' },
      expect.objectContaining({ ...meta, employeeId: 'emp-1' }),
    );
  });

  it('getStatus applies the same branch guard and PIN-only rejection before delegating', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      userId: 'user-1',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      email: 'manager.demo@nimbus.test',
    });
    mockPasswordLifecycle.getForceResetStatus.mockResolvedValue({
      userId: 'user-1',
      pending: false,
      expiresAt: null,
      triggeredAt: null,
    });

    const status = await service.getStatus(ctx, 'emp-1');
    expect(status.pending).toBe(false);
    expect(mockPasswordLifecycle.getForceResetStatus).toHaveBeenCalledWith('user-1');
  });
});
