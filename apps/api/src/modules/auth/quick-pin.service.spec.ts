import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { QuickPinService } from './quick-pin.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { SessionPlatform } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('QuickPinService', () => {
  let service: QuickPinService;

  const mockPrisma = {
    branch: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    membership: { findUnique: jest.fn() },
    session: { create: jest.fn() },
    refreshToken: { create: jest.fn() },
  };

  const mockAudit = { log: jest.fn() };
  const mockJwt = { sign: jest.fn().mockReturnValue('mock-jwt-token') };
  const mockConfig = {
    get: jest.fn((key: string, defaultVal?: string) => {
      const map: Record<string, string> = {
        QUICK_PIN_PEPPER: 'test-pepper',
        JWT_ACCESS_SECRET: 'test-secret',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
      };
      return map[key] || defaultVal;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickPinService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<QuickPinService>(QuickPinService);
    // Resolve providers to verify DI wiring
    module.get<PrismaService>(PrismaService);
    module.get<AuditService>(AuditService);
  });

  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  // ── derivePinLookupHash ──

  it('should derive deterministic lookup hash', () => {
    const hash1 = service.derivePinLookupHash('branch1', '123456');
    const hash2 = service.derivePinLookupHash('branch1', '123456');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('should produce different hashes for different PINs', () => {
    const hash1 = service.derivePinLookupHash('branch1', '123456');
    const hash2 = service.derivePinLookupHash('branch1', '654321');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different branches', () => {
    const hash1 = service.derivePinLookupHash('branch1', '123456');
    const hash2 = service.derivePinLookupHash('branch2', '123456');
    expect(hash1).not.toBe(hash2);
  });

  // ── quickPinLogin: platform rejection ──

  it('should reject non-POS_DESKTOP platform', async () => {
    await expect(
      service.quickPinLogin('branch1', '123456', SessionPlatform.MOBILE_APP, meta),
    ).rejects.toThrow('Quick PIN login is only available on POS_DESKTOP');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'QUICK_PIN_PLATFORM_DENIED' }),
    );
  });

  // ── quickPinLogin: branch not found ──

  it('should reject invalid branch', async () => {
    mockPrisma.branch.findUnique.mockResolvedValue(null);
    await expect(
      service.quickPinLogin('bad-branch', '123456', SessionPlatform.POS_DESKTOP, meta),
    ).rejects.toThrow('Invalid credentials');
  });

  // ── quickPinLogin: no matching user ──

  it('should reject when no user matches lookup hash', async () => {
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'ACTIVE',
      organizationId: 'o1',
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.quickPinLogin('b1', '999999', SessionPlatform.POS_DESKTOP, meta),
    ).rejects.toThrow('Invalid credentials');
  });

  // ── quickPinLogin: inactive user ──

  it('should reject inactive user', async () => {
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'ACTIVE',
      organizationId: 'o1',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: false,
      quickPinEnabled: true,
      quickPinHash: 'x',
      failedPinAttempts: 0,
      pinLockedUntil: null,
      pinLength: 6,
      userRoles: [],
    });
    await expect(
      service.quickPinLogin('b1', '123456', SessionPlatform.POS_DESKTOP, meta),
    ).rejects.toThrow('Invalid credentials');
  });

  // ── quickPinLogin: quickPinEnabled=false ──

  it('should reject when quickPinEnabled is false', async () => {
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'ACTIVE',
      organizationId: 'o1',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      quickPinEnabled: false,
      quickPinHash: 'x',
      failedPinAttempts: 0,
      pinLockedUntil: null,
      pinLength: 6,
      userRoles: [
        { role: { id: 'r1', name: 'Waiter', level: 'L1', jobRole: 'WAITER', rolePermissions: [] } },
      ],
    });
    await expect(
      service.quickPinLogin('b1', '123456', SessionPlatform.POS_DESKTOP, meta),
    ).rejects.toThrow('Invalid credentials');
  });

  // ── quickPinLogin: lockout ──

  it('should reject locked out user', async () => {
    const future = new Date(Date.now() + 300000);
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'ACTIVE',
      organizationId: 'o1',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      quickPinEnabled: true,
      quickPinHash: 'x',
      failedPinAttempts: 5,
      pinLockedUntil: future,
      pinLength: 6,
      userRoles: [],
    });
    await expect(
      service.quickPinLogin('b1', '123456', SessionPlatform.POS_DESKTOP, meta),
    ).rejects.toThrow('Invalid credentials');
  });

  // ── quickPinLogin: invalid PIN hash ──

  it('should reject wrong PIN and increment failed attempts', async () => {
    const pinHash = await bcrypt.hash('123456', 10);
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'ACTIVE',
      organizationId: 'o1',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      quickPinEnabled: true,
      quickPinHash: pinHash,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      pinLength: 6,
      userRoles: [
        { role: { id: 'r1', name: 'Waiter', level: 'L1', jobRole: 'WAITER', rolePermissions: [] } },
      ],
    });
    mockPrisma.user.update.mockResolvedValue({});

    await expect(
      service.quickPinLogin('b1', '000000', SessionPlatform.POS_DESKTOP, meta),
    ).rejects.toThrow('Invalid credentials');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ failedPinAttempts: 1 }),
      }),
    );
  });

  // ── quickPinLogin: success for low-tier user ──

  it('should succeed for a valid low-tier waiter PIN login', async () => {
    const pin = '123456';
    const pinHash = await bcrypt.hash(pin, 10);
    const lookupHash = service.derivePinLookupHash('b1', pin);

    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'ACTIVE',
      organizationId: 'o1',
    });
    // Mock user.findUnique to return user for lookup hash call
    mockPrisma.user.findUnique.mockImplementation((args: any) => {
      if (args.where.pinLookupHash === lookupHash) {
        return Promise.resolve({
          id: 'u1',
          email: 'waiter@demo.local',
          firstName: 'Demo',
          lastName: 'Waiter',
          displayName: 'Demo Waiter',
          isActive: true,
          quickPinEnabled: true,
          quickPinHash: pinHash,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          pinLength: 6,
          userRoles: [
            {
              role: {
                id: 'r1',
                name: 'Waiter',
                level: 'L1',
                jobRole: 'WAITER',
                rolePermissions: [{ permission: { action: 'identity:user:read' } }],
              },
            },
          ],
        });
      }
      return Promise.resolve(null);
    });

    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.membership.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      branchId: 'b1',
      status: 'ACTIVE',
      role: { id: 'r1', jobRole: 'WAITER' },
    });
    mockPrisma.session.create.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      jti: 'mock-jti',
      platform: 'POS_DESKTOP',
      source: 'PIN',
      orgId: 'o1',
      branchId: 'b1',
      expiresAt: new Date(Date.now() + 604800000),
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const result = await service.quickPinLogin('b1', pin, SessionPlatform.POS_DESKTOP, meta);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.session.source).toBe('PIN');
    expect(result.session.platform).toBe('POS_DESKTOP');
    expect(result.session.branchId).toBe('b1');
    expect(result.session.orgId).toBe('o1');
    expect(result.user.email).toBe('waiter@demo.local');
  });

  // ── quickPinLogin: success for high-tier user ──

  it('should succeed for a valid high-tier manager PIN login', async () => {
    const pin = '12345678';
    const pinHash = await bcrypt.hash(pin, 10);
    const lookupHash = service.derivePinLookupHash('b1', pin);

    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'ACTIVE',
      organizationId: 'o1',
    });
    mockPrisma.user.findUnique.mockImplementation((args: any) => {
      if (args.where.pinLookupHash === lookupHash) {
        return Promise.resolve({
          id: 'u2',
          email: 'manager@demo.local',
          firstName: 'Demo',
          lastName: 'Manager',
          displayName: 'Demo Manager',
          isActive: true,
          quickPinEnabled: true,
          quickPinHash: pinHash,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          pinLength: 8,
          userRoles: [
            {
              role: {
                id: 'r2',
                name: 'Manager',
                level: 'L4',
                jobRole: 'MANAGER',
                rolePermissions: [{ permission: { action: 'identity:user:read' } }],
              },
            },
          ],
        });
      }
      return Promise.resolve(null);
    });

    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.membership.findUnique.mockResolvedValue({
      id: 'm2',
      userId: 'u2',
      branchId: 'b1',
      status: 'ACTIVE',
      role: { id: 'r2', jobRole: 'MANAGER' },
    });
    mockPrisma.session.create.mockResolvedValue({
      id: 's2',
      userId: 'u2',
      jti: 'mock-jti',
      platform: 'POS_DESKTOP',
      source: 'PIN',
      orgId: 'o1',
      branchId: 'b1',
      expiresAt: new Date(Date.now() + 604800000),
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const result = await service.quickPinLogin('b1', pin, SessionPlatform.POS_DESKTOP, meta);

    expect(result.accessToken).toBeDefined();
    expect(result.session.source).toBe('PIN');
    expect(result.user.email).toBe('manager@demo.local');
  });

  // ── quickPinLogin: non-member rejection ──

  it('should reject user without active membership in branch', async () => {
    const pin = '123456';
    const pinHash = await bcrypt.hash(pin, 10);
    const lookupHash = service.derivePinLookupHash('b2', pin);

    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b2',
      status: 'ACTIVE',
      organizationId: 'o1',
    });
    mockPrisma.user.findUnique.mockImplementation((args: any) => {
      if (args.where.pinLookupHash === lookupHash) {
        return Promise.resolve({
          id: 'u1',
          email: 'waiter@demo.local',
          firstName: 'Demo',
          lastName: 'Waiter',
          isActive: true,
          quickPinEnabled: true,
          quickPinHash: pinHash,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          pinLength: 6,
          userRoles: [
            {
              role: {
                id: 'r1',
                name: 'Waiter',
                level: 'L1',
                jobRole: 'WAITER',
                rolePermissions: [],
              },
            },
          ],
        });
      }
      return Promise.resolve(null);
    });

    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    await expect(
      service.quickPinLogin('b2', pin, SessionPlatform.POS_DESKTOP, meta),
    ).rejects.toThrow('Not a member of this branch');
  });

  // ── issueQuickPin: correct length by tier ──

  it('should issue a 6-digit PIN for a LOW_6 tier user', async () => {
    mockPrisma.user.findUnique.mockImplementation((args: any) => {
      if (args.where.id) {
        return Promise.resolve({
          id: 'u1',
          email: 'waiter@demo.local',
          firstName: 'Demo',
          lastName: 'Waiter',
          quickPinEnabled: false,
          quickPinHash: null,
          userRoles: [{ role: { id: 'r1', name: 'Waiter', level: 'L1', jobRole: 'WAITER' } }],
          memberships: [{ branchId: 'b1', isDefaultBranch: true, branch: { id: 'b1' } }],
        });
      }
      // Uniqueness check — return null (no collision)
      return Promise.resolve(null);
    });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await service.issueQuickPin('u1', 'actor1', 'b1', meta);

    expect(result.pin).toHaveLength(6);
    expect(result.pinLength).toBe(6);
    expect(result.tier).toBe('LOW_6');
    expect(/^\d{6}$/.test(result.pin)).toBe(true);
  });

  it('should issue an 8-digit PIN for a HIGH_8 tier user', async () => {
    mockPrisma.user.findUnique.mockImplementation((args: any) => {
      if (args.where.id) {
        return Promise.resolve({
          id: 'u2',
          email: 'manager@demo.local',
          firstName: 'Demo',
          lastName: 'Manager',
          quickPinEnabled: false,
          quickPinHash: null,
          userRoles: [{ role: { id: 'r2', name: 'Manager', level: 'L4', jobRole: 'MANAGER' } }],
          memberships: [{ branchId: 'b1', isDefaultBranch: true, branch: { id: 'b1' } }],
        });
      }
      return Promise.resolve(null);
    });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await service.issueQuickPin('u2', 'actor1', 'b1', meta);

    expect(result.pin).toHaveLength(8);
    expect(result.pinLength).toBe(8);
    expect(result.tier).toBe('HIGH_8');
    expect(/^\d{8}$/.test(result.pin)).toBe(true);
  });

  // ── resetQuickPin: invalidates old PIN ──

  it('should reset PIN, generating a new one with same tier', async () => {
    mockPrisma.user.findUnique.mockImplementation((args: any) => {
      if (args.where.id) {
        return Promise.resolve({
          id: 'u1',
          email: 'waiter@demo.local',
          firstName: 'Demo',
          lastName: 'Waiter',
          quickPinEnabled: true,
          quickPinHash: 'old-hash',
          pinTier: 'LOW_6',
          pinLength: 6,
          userRoles: [{ role: { id: 'r1', name: 'Waiter', level: 'L1', jobRole: 'WAITER' } }],
          memberships: [{ branchId: 'b1', isDefaultBranch: true, branch: { id: 'b1' } }],
        });
      }
      return Promise.resolve(null);
    });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await service.resetQuickPin('u1', 'actor1', 'b1', meta);

    expect(result.pin).toHaveLength(6);
    expect(result.tier).toBe('LOW_6');
    // Verify the update was called with new hash
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          quickPinHash: expect.any(String),
          pinLookupHash: expect.any(String),
          failedPinAttempts: 0,
          pinLockedUntil: null,
        }),
      }),
    );
  });

  // ── lockout after repeated failures ──

  it('should lock account after 5 failed attempts', async () => {
    const pin = '123456';
    const pinHash = await bcrypt.hash(pin, 10);
    const lookupHash = service.derivePinLookupHash('b1', '000000');

    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'ACTIVE',
      organizationId: 'o1',
    });
    mockPrisma.user.findUnique.mockImplementation((args: any) => {
      if (args.where.pinLookupHash === lookupHash) {
        return Promise.resolve({
          id: 'u1',
          isActive: true,
          quickPinEnabled: true,
          quickPinHash: pinHash,
          failedPinAttempts: 4,
          pinLockedUntil: null,
          pinLength: 6,
          userRoles: [
            {
              role: {
                id: 'r1',
                name: 'Waiter',
                level: 'L1',
                jobRole: 'WAITER',
                rolePermissions: [],
              },
            },
          ],
        });
      }
      return Promise.resolve(null);
    });
    mockPrisma.user.update.mockResolvedValue({});

    await expect(
      service.quickPinLogin('b1', '000000', SessionPlatform.POS_DESKTOP, meta),
    ).rejects.toThrow('Invalid credentials');

    // Verify it set pinLockedUntil
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedPinAttempts: 5,
          pinLockedUntil: expect.any(Date),
        }),
      }),
    );

    // Verify QUICK_PIN_LOCKED audit event was logged
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'QUICK_PIN_LOCKED' }),
    );
  });
});
