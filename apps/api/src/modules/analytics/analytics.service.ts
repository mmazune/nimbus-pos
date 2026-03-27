import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  AnomalyRuleStatus,
  AnomalyRuleType,
  AnomalySeverity,
  AnomalyEventStatus,
  RiskEntityType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  CreateAnomalyRuleDto,
  UpdateAnomalyRuleDto,
  AcknowledgeAnomalyDto,
  ResolveAnomalyDto,
  ListAnomaliesQueryDto,
  RiskDashboardQueryDto,
  UpdateThresholdDto,
} from './dto';

interface BranchContext {
  branchId: string;
  organizationId: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) { }

  // ── Anomaly Rules CRUD ──

  async createRule(
    userId: string,
    ctx: BranchContext,
    dto: CreateAnomalyRuleDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.anomalyRule.findUnique({
      where: { orgId_code: { orgId: ctx.organizationId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Rule code "${dto.code}" already exists`);
    }

    const rule = await this.prisma.anomalyRule.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        code: dto.code,
        name: dto.name,
        type: dto.type as AnomalyRuleType,
        description: dto.description,
        severity: dto.severity as AnomalySeverity,
        metricKey: dto.metricKey,
        operator: dto.operator,
        thresholdValue: dto.thresholdValue != null ? new Decimal(dto.thresholdValue) : null,
        windowMinutes: dto.windowMinutes,
        minimumSampleSize: dto.minimumSampleSize,
        appliesToEntityType: dto.appliesToEntityType as RiskEntityType | undefined,
        config: dto.config ?? undefined,
        createdById: userId,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'anomaly-rule.create',
      entityType: 'AnomalyRule',
      entityId: rule.id,
      metadata: { code: dto.code, type: dto.type },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return rule;
  }

  async updateRule(
    ruleId: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateAnomalyRuleDto,
    meta: RequestMeta,
  ) {
    const rule = await this.prisma.anomalyRule.findFirst({
      where: { id: ruleId, orgId: ctx.organizationId },
    });
    if (!rule) throw new NotFoundException('Anomaly rule not found');

    const updated = await this.prisma.anomalyRule.update({
      where: { id: ruleId },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status as AnomalyRuleStatus | undefined,
        severity: dto.severity as AnomalySeverity | undefined,
        metricKey: dto.metricKey,
        operator: dto.operator,
        thresholdValue: dto.thresholdValue != null ? new Decimal(dto.thresholdValue) : undefined,
        windowMinutes: dto.windowMinutes,
        minimumSampleSize: dto.minimumSampleSize,
        appliesToEntityType: dto.appliesToEntityType as RiskEntityType | undefined,
        config: dto.config ?? undefined,
        updatedById: userId,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'anomaly-rule.update',
      entityType: 'AnomalyRule',
      entityId: ruleId,
      metadata: { changes: Object.keys(dto) },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async listRules(ctx: BranchContext) {
    return this.prisma.anomalyRule.findMany({
      where: {
        orgId: ctx.organizationId,
        OR: [{ branchId: ctx.branchId }, { branchId: null }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRuleById(ruleId: string, ctx: BranchContext) {
    const rule = await this.prisma.anomalyRule.findFirst({
      where: { id: ruleId, orgId: ctx.organizationId },
      include: { _count: { select: { anomalyEvents: true } } },
    });
    if (!rule) throw new NotFoundException('Anomaly rule not found');
    return rule;
  }

  // ── Anomaly Events ──

  async listAnomalies(ctx: BranchContext, query: ListAnomaliesQueryDto) {
    const where: any = {
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
    };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.severity) where.severity = query.severity;
    if (query.actorUserId) where.actorUserId = query.actorUserId;

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.anomalyEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { rule: { select: { code: true, name: true } } },
      }),
      this.prisma.anomalyEvent.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  async findAnomalyById(anomalyId: string, ctx: BranchContext) {
    const anomaly = await this.prisma.anomalyEvent.findFirst({
      where: { id: anomalyId, orgId: ctx.organizationId },
      include: {
        rule: { select: { code: true, name: true, type: true } },
        actorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        acknowledgedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!anomaly) throw new NotFoundException('Anomaly event not found');
    return anomaly;
  }

  async acknowledgeAnomaly(
    anomalyId: string,
    userId: string,
    ctx: BranchContext,
    dto: AcknowledgeAnomalyDto,
    meta: RequestMeta,
  ) {
    const anomaly = await this.prisma.anomalyEvent.findFirst({
      where: { id: anomalyId, orgId: ctx.organizationId },
    });
    if (!anomaly) throw new NotFoundException('Anomaly event not found');
    if (anomaly.status !== 'OPEN') {
      throw new BadRequestException(`Cannot acknowledge anomaly in ${anomaly.status} status`);
    }

    const updated = await this.prisma.anomalyEvent.update({
      where: { id: anomalyId },
      data: {
        status: AnomalyEventStatus.ACKNOWLEDGED,
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
        resolutionNotes: dto.resolutionNotes,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'anomaly-event.acknowledge',
      entityType: 'AnomalyEvent',
      entityId: anomalyId,
      metadata: { previousStatus: anomaly.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async resolveAnomaly(
    anomalyId: string,
    userId: string,
    ctx: BranchContext,
    dto: ResolveAnomalyDto,
    meta: RequestMeta,
  ) {
    const anomaly = await this.prisma.anomalyEvent.findFirst({
      where: { id: anomalyId, orgId: ctx.organizationId },
    });
    if (!anomaly) throw new NotFoundException('Anomaly event not found');
    if (anomaly.status !== 'ACKNOWLEDGED') {
      throw new BadRequestException(`Cannot resolve anomaly in ${anomaly.status} status`);
    }

    const updated = await this.prisma.anomalyEvent.update({
      where: { id: anomalyId },
      data: {
        status: AnomalyEventStatus.RESOLVED,
        resolutionNotes: dto.resolutionNotes,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'anomaly-event.resolve',
      entityType: 'AnomalyEvent',
      entityId: anomalyId,
      metadata: { previousStatus: anomaly.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Risk Dashboard ──

  async getRiskDashboard(ctx: BranchContext, query: RiskDashboardQueryDto) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // last 24h

    const [openAnomalies, severityCounts, typeCounts, topStaff] = await Promise.all([
      this.prisma.anomalyEvent.count({
        where: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          status: AnomalyEventStatus.OPEN,
        },
      }),
      this.prisma.anomalyEvent.groupBy({
        by: ['severity'],
        where: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          status: AnomalyEventStatus.OPEN,
        },
        _count: true,
      }),
      this.prisma.anomalyEvent.groupBy({
        by: ['type'],
        where: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          createdAt: { gte: windowStart },
        },
        _count: true,
      }),
      this.prisma.anomalyEvent.groupBy({
        by: ['actorUserId'],
        where: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          actorUserId: query.userId ?? undefined,
          status: { in: [AnomalyEventStatus.OPEN, AnomalyEventStatus.ACKNOWLEDGED] },
          createdAt: { gte: windowStart },
        },
        _count: true,
        orderBy: { _count: { actorUserId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      openAnomalies,
      severityBreakdown: severityCounts.map((s) => ({
        severity: s.severity,
        count: s._count,
      })),
      typeBreakdown: typeCounts.map((t) => ({
        type: t.type,
        count: t._count,
      })),
      topStaffByAnomalies: topStaff.map((s) => ({
        userId: s.actorUserId,
        count: s._count,
      })),
      windowStart: windowStart.toISOString(),
      windowEnd: now.toISOString(),
    };
  }

  // ── Staff Risk ──

  async getStaffRisk(userId: string, ctx: BranchContext) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // last 7 days

    const [snapshot, recentAnomalies] = await Promise.all([
      this.prisma.staffRiskSnapshot.findFirst({
        where: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          userId,
        },
        orderBy: { windowEnd: 'desc' },
      }),
      this.prisma.anomalyEvent.findMany({
        where: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          actorUserId: userId,
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          severity: true,
          status: true,
          title: true,
          createdAt: true,
        },
      }),
    ]);

    return { snapshot, recentAnomalies };
  }

  // ── Thresholds ──

  async listThresholds(ctx: BranchContext) {
    return this.prisma.riskThreshold.findMany({
      where: {
        orgId: ctx.organizationId,
        OR: [{ branchId: ctx.branchId }, { branchId: null }],
      },
      orderBy: { key: 'asc' },
    });
  }

  async updateThreshold(
    thresholdId: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateThresholdDto,
    meta: RequestMeta,
  ) {
    const threshold = await this.prisma.riskThreshold.findFirst({
      where: { id: thresholdId, orgId: ctx.organizationId },
    });
    if (!threshold) throw new NotFoundException('Threshold not found');

    const updated = await this.prisma.riskThreshold.update({
      where: { id: thresholdId },
      data: {
        name: dto.name,
        value: dto.value != null ? new Decimal(dto.value) : undefined,
        intValue: dto.intValue,
        boolValue: dto.boolValue,
        unit: dto.unit,
        description: dto.description,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'risk-threshold.update',
      entityType: 'RiskThreshold',
      entityId: thresholdId,
      metadata: { key: threshold.key, changes: Object.keys(dto) },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Signal Detection (Recalculate) ──

  async recalculateAnomalies(userId: string, ctx: BranchContext, meta: RequestMeta) {
    const rules = await this.prisma.anomalyRule.findMany({
      where: {
        orgId: ctx.organizationId,
        status: AnomalyRuleStatus.ACTIVE,
        OR: [{ branchId: ctx.branchId }, { branchId: null }],
      },
    });

    const results: { ruleCode: string; detected: number }[] = [];

    for (const rule of rules) {
      let detected = 0;
      try {
        switch (rule.type) {
          case 'VOID_SPIKE':
            detected = await this.detectVoidSpike(rule, ctx);
            break;
          case 'DISCOUNT_ABUSE':
            detected = await this.detectDiscountAbuse(rule, ctx);
            break;
          case 'CASH_VARIANCE':
            detected = await this.detectCashVariance(rule, ctx);
            break;
          case 'LATE_CLOSE':
            detected = await this.detectLateClose(rule, ctx);
            break;
          case 'REFUND_SPIKE':
            detected = await this.detectRefundSpike(rule, ctx);
            break;
          default:
            this.logger.debug(`Skipping rule ${rule.code} — type ${rule.type} not yet implemented`);
        }
      } catch (err) {
        this.logger.error(`Error evaluating rule ${rule.code}: ${err}`);
      }
      results.push({ ruleCode: rule.code, detected });
    }

    await this.audit.log({
      actorUserId: userId,
      action: 'anomaly.recalculate',
      entityType: 'AnomalyEvent',
      entityId: ctx.branchId,
      metadata: { rulesEvaluated: rules.length, results },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { rulesEvaluated: rules.length, results };
  }

  // ── Signal Implementations ──

  private async detectVoidSpike(rule: any, ctx: BranchContext): Promise<number> {
    const windowMs = (rule.windowMinutes ?? 60) * 60 * 1000;
    const since = new Date(Date.now() - windowMs);
    const threshold = rule.thresholdValue ? Number(rule.thresholdValue) : 5;

    // Count voids per staff in window
    const voids = await this.prisma.order.groupBy({
      by: ['userId'],
      where: {
        branchId: ctx.branchId,
        status: 'VOIDED',
        updatedAt: { gte: since },
      },
      _count: true,
    });

    let detected = 0;
    for (const v of voids) {
      if (v._count >= threshold && v.userId) {
        await this.createAnomalyEvent(ctx, rule, {
          entityType: RiskEntityType.STAFF,
          entityId: v.userId,
          actorUserId: v.userId,
          title: `Void spike: ${v._count} voids in ${rule.windowMinutes ?? 60}min`,
          evidence: { voidCount: v._count, windowMinutes: rule.windowMinutes ?? 60, threshold },
        });
        detected++;
      }
    }
    return detected;
  }

  private async detectDiscountAbuse(rule: any, ctx: BranchContext): Promise<number> {
    const windowMs = (rule.windowMinutes ?? 60) * 60 * 1000;
    const since = new Date(Date.now() - windowMs);
    const threshold = rule.thresholdValue ? Number(rule.thresholdValue) : 5;

    const discounts = await this.prisma.discount.groupBy({
      by: ['createdById'],
      where: {
        branchId: ctx.branchId,
        createdAt: { gte: since },
      },
      _count: true,
    });

    let detected = 0;
    for (const d of discounts) {
      if (d._count >= threshold && d.createdById) {
        await this.createAnomalyEvent(ctx, rule, {
          entityType: RiskEntityType.STAFF,
          entityId: d.createdById,
          actorUserId: d.createdById,
          title: `Discount abuse: ${d._count} discounts in ${rule.windowMinutes ?? 60}min`,
          evidence: { discountCount: d._count, windowMinutes: rule.windowMinutes ?? 60, threshold },
        });
        detected++;
      }
    }
    return detected;
  }

  private async detectCashVariance(rule: any, ctx: BranchContext): Promise<number> {
    const windowMs = (rule.windowMinutes ?? 480) * 60 * 1000;
    const since = new Date(Date.now() - windowMs);
    const threshold = rule.thresholdValue ? Number(rule.thresholdValue) : 500;

    // Check till sessions with variance
    const sessions = await this.prisma.tillSession.findMany({
      where: {
        branchId: ctx.branchId,
        closedAt: { gte: since },
        variance: { not: null },
      },
      select: {
        id: true,
        operatorUserId: true,
        variance: true,
      },
    });

    let detected = 0;
    for (const s of sessions) {
      const variance = Math.abs(Number(s.variance ?? 0));
      if (variance >= threshold) {
        await this.createAnomalyEvent(ctx, rule, {
          entityType: RiskEntityType.TILL,
          entityId: s.id,
          actorUserId: s.operatorUserId,
          relatedTillSessionId: s.id,
          title: `Cash variance: ${variance.toFixed(2)} on till session`,
          evidence: { variance, threshold, tillSessionId: s.id },
        });
        detected++;
      }
    }
    return detected;
  }

  private async detectLateClose(rule: any, ctx: BranchContext): Promise<number> {
    const windowMs = (rule.windowMinutes ?? 1440) * 60 * 1000;
    const since = new Date(Date.now() - windowMs);
    const thresholdHours = rule.thresholdValue ? Number(rule.thresholdValue) : 12;

    const shifts = await this.prisma.shift.findMany({
      where: {
        branchId: ctx.branchId,
        closedAt: { gte: since },
      },
      select: {
        id: true,
        openedById: true,
        openedAt: true,
        closedAt: true,
      },
    });

    let detected = 0;
    for (const s of shifts) {
      if (s.closedAt) {
        const durationHours = (s.closedAt.getTime() - s.openedAt.getTime()) / (1000 * 60 * 60);
        if (durationHours >= thresholdHours) {
          await this.createAnomalyEvent(ctx, rule, {
            entityType: RiskEntityType.SHIFT,
            entityId: s.id,
            actorUserId: s.openedById,
            relatedShiftId: s.id,
            title: `Late close: shift duration ${durationHours.toFixed(1)}h exceeds ${thresholdHours}h`,
            evidence: { durationHours: +durationHours.toFixed(2), thresholdHours, shiftId: s.id },
          });
          detected++;
        }
      }
    }
    return detected;
  }

  private async detectRefundSpike(rule: any, ctx: BranchContext): Promise<number> {
    const windowMs = (rule.windowMinutes ?? 60) * 60 * 1000;
    const since = new Date(Date.now() - windowMs);
    const threshold = rule.thresholdValue ? Number(rule.thresholdValue) : 3;

    const refunds = await this.prisma.refund.groupBy({
      by: ['createdById'],
      where: {
        branchId: ctx.branchId,
        createdAt: { gte: since },
      },
      _count: true,
    });

    let detected = 0;
    for (const r of refunds) {
      if (r._count >= threshold && r.createdById) {
        await this.createAnomalyEvent(ctx, rule, {
          entityType: RiskEntityType.STAFF,
          entityId: r.createdById,
          actorUserId: r.createdById,
          title: `Refund spike: ${r._count} refunds in ${rule.windowMinutes ?? 60}min`,
          evidence: { refundCount: r._count, windowMinutes: rule.windowMinutes ?? 60, threshold },
        });
        detected++;
      }
    }
    return detected;
  }

  // ── Helper: Create Anomaly Event ──

  private async createAnomalyEvent(
    ctx: BranchContext,
    rule: any,
    data: {
      entityType: RiskEntityType;
      entityId: string;
      actorUserId?: string | null;
      relatedOrderId?: string;
      relatedShiftId?: string;
      relatedTillSessionId?: string;
      relatedPaymentId?: string;
      relatedRefundId?: string;
      relatedReservationId?: string;
      relatedEventId?: string;
      title: string;
      evidence: Record<string, any>;
    },
  ) {
    return this.prisma.anomalyEvent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        ruleId: rule.id,
        type: rule.type as AnomalyRuleType,
        severity: rule.severity as AnomalySeverity,
        entityType: data.entityType,
        entityId: data.entityId,
        actorUserId: data.actorUserId,
        relatedOrderId: data.relatedOrderId,
        relatedShiftId: data.relatedShiftId,
        relatedTillSessionId: data.relatedTillSessionId,
        relatedPaymentId: data.relatedPaymentId,
        relatedRefundId: data.relatedRefundId,
        relatedReservationId: data.relatedReservationId,
        relatedEventId: data.relatedEventId,
        title: data.title,
        description: `Detected by rule: ${rule.name} (${rule.code})`,
        evidence: data.evidence,
        metadata: { ruleCode: rule.code, evaluatedAt: new Date().toISOString() },
      },
    });
  }
}
