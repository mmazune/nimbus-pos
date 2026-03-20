import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import * as bcrypt from 'bcrypt';

// Hash a test password/pin for mock data
const TEST_PASSWORD = 'Owner#123';
const TEST_PIN = '1234';
let hashedPassword: string;
let hashedPin: string;

beforeAll(async () => {
  hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
  hashedPin = await bcrypt.hash(TEST_PIN, 10);
});

const mockUser = () => ({
  id: 'user-1',
  email: 'owner@demo.local',
  passwordHash: hashedPassword,
  pinHash: hashedPin,
  firstName: 'Demo',
  lastName: 'Owner',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  userRoles: [
    {
      role: {
        id: 'role-1',
        name: 'Owner',
        level: 'L5',
        jobRole: 'OWNER',
        rolePermissions: [
          { permission: { action: 'identity:user:read' } },
          { permission: { action: 'identity:access-matrix:read' } },
        ],
      },
    },
  ],
});

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  jti: 'test-jti',
  platform: 'WEB_BACKOFFICE',
  source: 'PASSWORD',
  ipAddress: null,
  userAgent: null,
  lastActivityAt: new Date(),
  expiresAt: new Date(Date.now() + 86400000),
  revokedAt: null,
  createdAt: new Date(),
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  session: {
    create: jest.fn().mockResolvedValue(mockSession),
    findUnique: jest.fn().mockResolvedValue(mockSession),
    update: jest.fn().mockResolvedValue(mockSession),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  refreshToken: {
    create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultVal: string) => defaultVal),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const meta = { ipAddress: '127.0.0.1', userAgent: 'jest-test' };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return tokens on valid email + password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser());

      const result = await service.login(
        { email: 'owner@demo.local', password: TEST_PASSWORD },
        meta,
      );

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('owner@demo.local');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_SUCCESS' }),
      );
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser());

      await expect(
        service.login({ email: 'owner@demo.local', password: 'wrong-password' }, meta),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_FAILED' }),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@demo.local', password: 'anything' }, meta),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('pinLogin', () => {
    it('should return tokens on valid email + pin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser());

      const result = await service.pinLogin({ email: 'owner@demo.local', pin: TEST_PIN }, meta);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PIN_LOGIN_SUCCESS' }),
      );
    });

    it('should throw UnauthorizedException on invalid pin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser());

      await expect(
        service.pinLogin({ email: 'owner@demo.local', pin: '0000' }, meta),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should reject revoked refresh token and revoke family', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'hash',
        family: 'fam-1',
        sessionId: 'session-1',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // already revoked
        user: { id: 'user-1', isActive: true },
      });

      await expect(service.refresh({ refreshToken: 'some-token' }, meta)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ family: 'fam-1' }),
        }),
      );
    });

    it('should reject expired refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'hash',
        family: 'fam-1',
        sessionId: 'session-1',
        expiresAt: new Date(Date.now() - 1000), // expired
        revokedAt: null,
        user: { id: 'user-1', isActive: true },
      });

      await expect(service.refresh({ refreshToken: 'some-token' }, meta)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('audit logging', () => {
    it('should write audit log on login success', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser());

      await service.login({ email: 'owner@demo.local', password: TEST_PASSWORD }, meta);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_SUCCESS',
          entityType: 'auth',
        }),
      );
    });
  });
});
