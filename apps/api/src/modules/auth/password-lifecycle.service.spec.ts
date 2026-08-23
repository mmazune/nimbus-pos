import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, NotFoundException } from '@nestjs/common';
import { PasswordLifecycleService } from './password-lifecycle.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';

describe('PasswordLifecycleService — B6.7 adminForceReset / getForceResetStatus', () => {
  let service: PasswordLifecycleService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    passwordResetToken: {
      count: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    session: { updateMany: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
  };

  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.NIMBUS_EXPOSE_RESET_TOKENS;
    process.env.NODE_ENV = 'test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PasswordLifecycleService>(PasswordLifecycleService);
  });

  const actor = { id: 'manager-1', branchId: 'branch-1' };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test', employeeId: 'emp-1' };

  function mockActiveSubject() {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true });
  }

  it('rejects a missing or inactive subject with 404', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.adminForceReset('user-1', actor, meta)).rejects.toThrow(NotFoundException);
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('issues a token, invalidates prior live tokens, revokes sessions, and audits the trigger', async () => {
    mockActiveSubject();
    mockPrisma.passwordResetToken.count.mockResolvedValue(0);

    const result = await service.adminForceReset('user-1', actor, meta);

    expect(result.ok).toBe(true);
    expect(result.userId).toBe('user-1');
    expect(result.expiresAt).toBeInstanceOf(Date);
    // Never returns the plaintext outside the dev-only gate.
    expect((result as any)._devOnlyDeliveryPreview).toBeUndefined();

    expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          purpose: 'FORCE_RESET_BY_ADMIN',
          consumedAt: null,
          invalidatedAt: null,
        }),
        data: expect.objectContaining({ invalidatedAt: expect.any(Date) }),
      }),
    );

    const createArgs = mockPrisma.passwordResetToken.create.mock.calls[0][0];
    expect(createArgs.data.purpose).toBe('FORCE_RESET_BY_ADMIN');
    expect(createArgs.data.tokenHash).toHaveLength(64); // SHA-256 hex
    expect(createArgs.data.metadata).toEqual({
      triggeredByUserId: 'manager-1',
      triggeredByBranchId: 'branch-1',
    });
    // The plaintext is never written to any persisted field.
    expect(JSON.stringify(createArgs.data)).not.toMatch(/far_[0-9a-f]{48}/);

    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
      }),
    );

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREDENTIAL_RESET_TRIGGERED',
        actorUserId: 'manager-1',
        entityType: 'User',
        entityId: 'user-1',
        metadata: expect.objectContaining({ employeeId: 'emp-1', branchId: 'branch-1' }),
      }),
    );
  });

  it('never includes the plaintext token in the metadata written to the audit log', async () => {
    mockActiveSubject();
    mockPrisma.passwordResetToken.count.mockResolvedValue(0);
    await service.adminForceReset('user-1', actor, meta);

    const auditCall = mockAudit.log.mock.calls.find(
      (c) => c[0].action === 'CREDENTIAL_RESET_TRIGGERED',
    );
    expect(JSON.stringify(auditCall[0])).not.toMatch(/far_/);
  });

  it('exposes the plaintext ONLY when NIMBUS_EXPOSE_RESET_TOKENS=true and not production', async () => {
    process.env.NIMBUS_EXPOSE_RESET_TOKENS = 'true';
    process.env.NODE_ENV = 'test';
    mockActiveSubject();
    mockPrisma.passwordResetToken.count.mockResolvedValue(0);

    const result = await service.adminForceReset('user-1', actor, meta);
    expect(result._devOnlyDeliveryPreview).toMatch(/^far_[0-9a-f]{48}$/);
  });

  it('never exposes the plaintext when NODE_ENV=production even if the dev flag is set', async () => {
    process.env.NIMBUS_EXPOSE_RESET_TOKENS = 'true';
    process.env.NODE_ENV = 'production';
    mockActiveSubject();
    mockPrisma.passwordResetToken.count.mockResolvedValue(0);

    const result = await service.adminForceReset('user-1', actor, meta);
    expect(result._devOnlyDeliveryPreview).toBeUndefined();

    process.env.NODE_ENV = 'test';
  });

  it('rate-limits per subject at the 3rd prior token in the rolling window (429) and audits it', async () => {
    mockActiveSubject();
    mockPrisma.passwordResetToken.count.mockResolvedValueOnce(3); // subject count check

    await expect(service.adminForceReset('user-1', actor, meta)).rejects.toThrow(HttpException);
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREDENTIAL_RESET_RATE_LIMITED',
        metadata: expect.objectContaining({ scope: 'subject' }),
      }),
    );
  });

  it('rate-limits per actor at the 20th prior token in the rolling window (429) and audits it', async () => {
    mockActiveSubject();
    mockPrisma.passwordResetToken.count
      .mockResolvedValueOnce(0) // subject count — under limit
      .mockResolvedValueOnce(20); // actor count — at limit

    await expect(service.adminForceReset('user-1', actor, meta)).rejects.toThrow(HttpException);
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREDENTIAL_RESET_RATE_LIMITED',
        metadata: expect.objectContaining({ scope: 'actor' }),
      }),
    );
  });

  it('getForceResetStatus reports pending=false when no live token exists', async () => {
    mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);
    const status = await service.getForceResetStatus('user-1');
    expect(status).toEqual({
      userId: 'user-1',
      pending: false,
      expiresAt: null,
      triggeredAt: null,
    });
  });

  it('getForceResetStatus reports pending=true with expiry but never a token value', async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const createdAt = new Date();
    mockPrisma.passwordResetToken.findFirst.mockResolvedValue({ expiresAt, createdAt });

    const status = await service.getForceResetStatus('user-1');
    expect(status.pending).toBe(true);
    expect(status.expiresAt).toBe(expiresAt);
    expect(Object.keys(status)).not.toContain('token');
    expect(Object.keys(status)).not.toContain('tokenHash');
  });
});
