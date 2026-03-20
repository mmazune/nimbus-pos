import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;
  let audit: any;

  const mockOrgSettings = {
    id: 'settings-1',
    orgId: 'org-1',
    vatPercent: { toNumber: () => 18 },
    currency: 'UGX',
    discountApprovalThreshold: { toNumber: () => 5000 },
    reservationHoldMinutes: 30,
    receiptFooter: null,
    metadata: null,
    anomalyThresholds: { lateVoidMin: 5, heavyDiscountUGX: 5000 },
    platformAccess: { useRoleDefaults: true },
    franchiseWeights: null,
    showCostToChef: false,
    defaults: null,
    baseCurrencyCode: null,
    taxMatrix: { defaultVatPct: 18, categories: [] },
    rounding: { mode: 'NEAREST', increment: 100 },
    bookingPolicies: null,
    attendance: { autoClockOutHours: 16 },
    inventoryTolerance: { variancePct: 2 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      membership: {
        findFirst: jest.fn(),
      },
      orgSettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      exchangeRate: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('resolveOrgId', () => {
    it('should resolve org ID from user membership', async () => {
      prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
      const orgId = await service.resolveOrgId('user-1');
      expect(orgId).toBe('org-1');
    });

    it('should throw NotFoundException when no membership exists', async () => {
      prisma.membership.findFirst.mockResolvedValue(null);
      await expect(service.resolveOrgId('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrCreateSettings', () => {
    it('should return existing settings', async () => {
      prisma.orgSettings.findUnique.mockResolvedValue(mockOrgSettings);
      const result = await service.getOrCreateSettings('org-1');
      expect(result).toEqual(mockOrgSettings);
    });

    it('should create default settings when none exist', async () => {
      prisma.orgSettings.findUnique.mockResolvedValue(null);
      prisma.orgSettings.create.mockResolvedValue(mockOrgSettings);
      const result = await service.getOrCreateSettings('org-1');
      expect(result).toEqual(mockOrgSettings);
      expect(prisma.orgSettings.create).toHaveBeenCalledWith({ data: { orgId: 'org-1' } });
    });
  });

  describe('getSettings', () => {
    it('should return settings for the user org', async () => {
      prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
      prisma.orgSettings.findUnique.mockResolvedValue(mockOrgSettings);
      const result = await service.getSettings('user-1');
      expect(result.currency).toBe('UGX');
    });
  });

  describe('updateSettings', () => {
    it('should update settings and audit log', async () => {
      prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
      prisma.orgSettings.findUnique.mockResolvedValue(mockOrgSettings);
      prisma.orgSettings.update.mockResolvedValue({
        ...mockOrgSettings,
        currency: 'USD',
      });

      const result = await service.updateSettings(
        'user-1',
        { currency: 'USD' },
        { ipAddress: '127.0.0.1' },
      );

      expect(result.currency).toBe('USD');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ORG_SETTINGS_UPDATED' }),
      );
    });
  });

  describe('updateCurrency', () => {
    it('should update currency and audit', async () => {
      prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
      prisma.orgSettings.findUnique.mockResolvedValue(mockOrgSettings);
      prisma.orgSettings.update.mockResolvedValue({
        ...mockOrgSettings,
        currency: 'EUR',
        baseCurrencyCode: 'USD',
      });

      const result = await service.updateCurrency(
        'user-1',
        { currency: 'EUR', baseCurrencyCode: 'USD' },
        { ipAddress: '127.0.0.1' },
      );

      expect(result.currency).toBe('EUR');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CURRENCY_UPDATED' }),
      );
    });
  });

  describe('updateTaxMatrix', () => {
    it('should update tax matrix and audit', async () => {
      prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
      prisma.orgSettings.findUnique.mockResolvedValue(mockOrgSettings);
      const updatedTaxMatrix = { defaultVatPct: 20, categories: [{ name: 'Alcohol', vatPct: 25 }] };
      prisma.orgSettings.update.mockResolvedValue({
        ...mockOrgSettings,
        taxMatrix: updatedTaxMatrix,
        vatPercent: { toNumber: () => 20 },
      });

      const result = await service.updateTaxMatrix(
        'user-1',
        { defaultVatPct: 20, categories: [{ name: 'Alcohol', vatPct: 25 }] },
        { ipAddress: '127.0.0.1' },
      );

      expect(result.taxMatrix).toEqual(updatedTaxMatrix);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TAX_MATRIX_UPDATED' }),
      );
    });
  });

  describe('updateThresholds', () => {
    it('should merge anomaly thresholds and audit', async () => {
      prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
      prisma.orgSettings.findUnique.mockResolvedValue(mockOrgSettings);
      prisma.orgSettings.update.mockResolvedValue({
        ...mockOrgSettings,
        discountApprovalThreshold: { toNumber: () => 10000 },
        anomalyThresholds: { lateVoidMin: 10, heavyDiscountUGX: 5000 },
      });

      const result = await service.updateThresholds(
        'user-1',
        { lateVoidMin: 10, discountApprovalThreshold: '10000' },
        { ipAddress: '127.0.0.1' },
      );

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'THRESHOLDS_UPDATED' }),
      );
      expect(result.anomalyThresholds).toEqual({ lateVoidMin: 10, heavyDiscountUGX: 5000 });
    });
  });

  describe('updateRounding', () => {
    it('should update rounding and audit', async () => {
      prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
      prisma.orgSettings.findUnique.mockResolvedValue(mockOrgSettings);
      prisma.orgSettings.update.mockResolvedValue({
        ...mockOrgSettings,
        rounding: { mode: 'UP', increment: 50 },
      });

      const result = await service.updateRounding(
        'user-1',
        { mode: 'UP', increment: 50 },
        { ipAddress: '127.0.0.1' },
      );

      expect(result.rounding).toEqual({ mode: 'UP', increment: 50 });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ROUNDING_UPDATED' }),
      );
    });
  });

  describe('createExchangeRate', () => {
    it('should create exchange rate and audit', async () => {
      prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
      prisma.exchangeRate.create.mockResolvedValue({
        id: 'er-1',
        orgId: 'org-1',
        baseCurrencyCode: 'USD',
        quoteCurrencyCode: 'UGX',
        rate: { toNumber: () => 3700 },
        effectiveAt: new Date(),
        createdById: 'user-1',
        createdAt: new Date(),
      });

      const result = await service.createExchangeRate(
        'user-1',
        {
          baseCurrencyCode: 'USD',
          quoteCurrencyCode: 'UGX',
          rate: '3700.000000',
          effectiveAt: '2026-03-20T00:00:00Z',
        },
        { ipAddress: '127.0.0.1' },
      );

      expect(result.baseCurrencyCode).toBe('USD');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EXCHANGE_RATE_CREATED' }),
      );
    });
  });

  describe('listExchangeRates', () => {
    it('should return exchange rates for the org', async () => {
      prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
      prisma.exchangeRate.findMany.mockResolvedValue([]);
      const result = await service.listExchangeRates('user-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
