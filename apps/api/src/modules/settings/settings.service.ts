import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  UpdateOrgSettingsDto,
  UpdateCurrencyDto,
  UpdateTaxMatrixDto,
  UpdateRoundingDto,
  UpdateThresholdsDto,
  UpdatePlatformAccessDto,
  CreateExchangeRateDto,
} from './dto';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Resolve the user's current org ID from their first active membership.
   * For M4 we use a deterministic approach: the user's first org from memberships.
   */
  async resolveOrgId(userId: string): Promise<string> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });
    if (!membership) {
      throw new NotFoundException('No active org membership found');
    }
    return membership.organizationId;
  }

  /**
   * Get or create the OrgSettings row for an org (upsert with defaults).
   */
  async getOrCreateSettings(orgId: string) {
    let settings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
    });

    if (!settings) {
      settings = await this.prisma.orgSettings.create({
        data: { orgId },
      });
    }

    return settings;
  }

  // ── GET /settings ──

  async getSettings(userId: string) {
    const orgId = await this.resolveOrgId(userId);
    return this.getOrCreateSettings(orgId);
  }

  // ── PATCH /settings ──

  async updateSettings(userId: string, dto: UpdateOrgSettingsDto, meta: RequestMeta) {
    const orgId = await this.resolveOrgId(userId);
    await this.getOrCreateSettings(orgId);

    const data: Prisma.OrgSettingsUpdateInput = {};

    if (dto.vatPercent !== undefined) data.vatPercent = new Prisma.Decimal(dto.vatPercent);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.discountApprovalThreshold !== undefined)
      data.discountApprovalThreshold = new Prisma.Decimal(dto.discountApprovalThreshold);
    if (dto.reservationHoldMinutes !== undefined)
      data.reservationHoldMinutes = dto.reservationHoldMinutes;
    if (dto.receiptFooter !== undefined) data.receiptFooter = dto.receiptFooter;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as Prisma.InputJsonValue;
    if (dto.anomalyThresholds !== undefined)
      data.anomalyThresholds = dto.anomalyThresholds as Prisma.InputJsonValue;
    if (dto.platformAccess !== undefined)
      data.platformAccess = dto.platformAccess as Prisma.InputJsonValue;
    if (dto.franchiseWeights !== undefined)
      data.franchiseWeights = dto.franchiseWeights as Prisma.InputJsonValue;
    if (dto.showCostToChef !== undefined) data.showCostToChef = dto.showCostToChef;
    if (dto.defaults !== undefined) data.defaults = dto.defaults as Prisma.InputJsonValue;
    if (dto.baseCurrencyCode !== undefined) data.baseCurrencyCode = dto.baseCurrencyCode;
    if (dto.taxMatrix !== undefined) data.taxMatrix = dto.taxMatrix as Prisma.InputJsonValue;
    if (dto.rounding !== undefined) data.rounding = dto.rounding as Prisma.InputJsonValue;
    if (dto.bookingPolicies !== undefined)
      data.bookingPolicies = dto.bookingPolicies as Prisma.InputJsonValue;
    if (dto.attendance !== undefined) data.attendance = dto.attendance as Prisma.InputJsonValue;
    if (dto.inventoryTolerance !== undefined)
      data.inventoryTolerance = dto.inventoryTolerance as Prisma.InputJsonValue;

    const updated = await this.prisma.orgSettings.update({
      where: { orgId },
      data,
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'ORG_SETTINGS_UPDATED',
      entityType: 'org_settings',
      entityId: updated.id,
      metadata: { orgId, fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined) },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── GET /settings/currency ──

  async getCurrency(userId: string) {
    const settings = await this.getSettings(userId);
    return {
      currency: settings.currency,
      baseCurrencyCode: settings.baseCurrencyCode,
    };
  }

  // ── PUT /settings/currency ──

  async updateCurrency(userId: string, dto: UpdateCurrencyDto, meta: RequestMeta) {
    const orgId = await this.resolveOrgId(userId);
    await this.getOrCreateSettings(orgId);

    const updated = await this.prisma.orgSettings.update({
      where: { orgId },
      data: {
        currency: dto.currency,
        baseCurrencyCode: dto.baseCurrencyCode ?? undefined,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'CURRENCY_UPDATED',
      entityType: 'org_settings',
      entityId: updated.id,
      metadata: { orgId, currency: dto.currency, baseCurrencyCode: dto.baseCurrencyCode },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { currency: updated.currency, baseCurrencyCode: updated.baseCurrencyCode };
  }

  // ── GET /settings/tax-matrix ──

  async getTaxMatrix(userId: string) {
    const settings = await this.getSettings(userId);
    return {
      vatPercent: settings.vatPercent,
      taxMatrix: settings.taxMatrix,
    };
  }

  // ── PUT /settings/tax-matrix ──

  async updateTaxMatrix(userId: string, dto: UpdateTaxMatrixDto, meta: RequestMeta) {
    const orgId = await this.resolveOrgId(userId);
    await this.getOrCreateSettings(orgId);

    const taxMatrixJson = { defaultVatPct: dto.defaultVatPct, categories: dto.categories ?? [] };

    const updated = await this.prisma.orgSettings.update({
      where: { orgId },
      data: {
        vatPercent: new Prisma.Decimal(dto.defaultVatPct),
        taxMatrix: taxMatrixJson as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'TAX_MATRIX_UPDATED',
      entityType: 'org_settings',
      entityId: updated.id,
      metadata: {
        orgId,
        defaultVatPct: dto.defaultVatPct,
        categoryCount: (dto.categories ?? []).length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { vatPercent: updated.vatPercent, taxMatrix: updated.taxMatrix };
  }

  // ── GET /settings/rounding ──

  async getRounding(userId: string) {
    const settings = await this.getSettings(userId);
    return { rounding: settings.rounding };
  }

  // ── PUT /settings/rounding ──

  async updateRounding(userId: string, dto: UpdateRoundingDto, meta: RequestMeta) {
    const orgId = await this.resolveOrgId(userId);
    await this.getOrCreateSettings(orgId);

    const roundingJson = { mode: dto.mode, increment: dto.increment };

    const updated = await this.prisma.orgSettings.update({
      where: { orgId },
      data: { rounding: roundingJson as unknown as Prisma.InputJsonValue },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'ROUNDING_UPDATED',
      entityType: 'org_settings',
      entityId: updated.id,
      metadata: { orgId, mode: dto.mode, increment: dto.increment },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { rounding: updated.rounding };
  }

  // ── GET /thresholds ──

  async getThresholds(userId: string) {
    const settings = await this.getSettings(userId);
    return {
      discountApprovalThreshold: settings.discountApprovalThreshold,
      anomalyThresholds: settings.anomalyThresholds,
    };
  }

  // ── PATCH /thresholds ──

  async updateThresholds(userId: string, dto: UpdateThresholdsDto, meta: RequestMeta) {
    const orgId = await this.resolveOrgId(userId);
    const settings = await this.getOrCreateSettings(orgId);

    const data: Prisma.OrgSettingsUpdateInput = {};

    if (dto.discountApprovalThreshold !== undefined) {
      data.discountApprovalThreshold = new Prisma.Decimal(dto.discountApprovalThreshold);
    }

    // Merge anomaly thresholds
    if (dto.lateVoidMin !== undefined || dto.heavyDiscountUGX !== undefined) {
      const existing = (settings.anomalyThresholds as Record<string, unknown>) ?? {};
      const merged = { ...existing };
      if (dto.lateVoidMin !== undefined) merged.lateVoidMin = dto.lateVoidMin;
      if (dto.heavyDiscountUGX !== undefined) merged.heavyDiscountUGX = dto.heavyDiscountUGX;
      data.anomalyThresholds = merged as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.orgSettings.update({
      where: { orgId },
      data,
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'THRESHOLDS_UPDATED',
      entityType: 'org_settings',
      entityId: updated.id,
      metadata: { orgId, ...dto },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      discountApprovalThreshold: updated.discountApprovalThreshold,
      anomalyThresholds: updated.anomalyThresholds,
    };
  }

  // ── GET /settings/platform-access ──

  async getPlatformAccess(userId: string) {
    const settings = await this.getSettings(userId);
    return { platformAccess: settings.platformAccess };
  }

  // ── PUT /settings/platform-access ──

  async updatePlatformAccess(userId: string, dto: UpdatePlatformAccessDto, meta: RequestMeta) {
    const orgId = await this.resolveOrgId(userId);
    await this.getOrCreateSettings(orgId);

    const platformJson = { useRoleDefaults: dto.useRoleDefaults, overrides: dto.overrides ?? {} };

    const updated = await this.prisma.orgSettings.update({
      where: { orgId },
      data: { platformAccess: platformJson as unknown as Prisma.InputJsonValue },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'PLATFORM_ACCESS_UPDATED',
      entityType: 'org_settings',
      entityId: updated.id,
      metadata: { orgId, useRoleDefaults: dto.useRoleDefaults },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { platformAccess: updated.platformAccess };
  }

  // ── POST /settings/exchange-rate ──

  async createExchangeRate(userId: string, dto: CreateExchangeRateDto, meta: RequestMeta) {
    const orgId = await this.resolveOrgId(userId);

    const rate = await this.prisma.exchangeRate.create({
      data: {
        orgId,
        baseCurrencyCode: dto.baseCurrencyCode,
        quoteCurrencyCode: dto.quoteCurrencyCode,
        rate: new Prisma.Decimal(dto.rate),
        effectiveAt: new Date(dto.effectiveAt),
        createdById: userId,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'EXCHANGE_RATE_CREATED',
      entityType: 'exchange_rate',
      entityId: rate.id,
      metadata: {
        orgId,
        baseCurrencyCode: dto.baseCurrencyCode,
        quoteCurrencyCode: dto.quoteCurrencyCode,
        rate: dto.rate,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return rate;
  }

  // ── GET /settings/exchange-rates ──

  async listExchangeRates(userId: string) {
    const orgId = await this.resolveOrgId(userId);
    return this.prisma.exchangeRate.findMany({
      where: { orgId },
      orderBy: { effectiveAt: 'desc' },
      take: 50,
    });
  }
}
