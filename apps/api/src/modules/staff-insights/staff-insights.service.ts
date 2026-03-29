import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  ListStaffInsightsQueryDto,
  CreateStaffAwardDto,
  GeneratePromotionSuggestionsDto,
  DecidePromotionSuggestionDto,
  UpdateStaffWeightsDto,
} from './dto';
import { Prisma } from '@prisma/client';

/** Default scoring weights (sum to 100). Stored in OrgSettings.staffInsightWeights JSON field or returned as defaults. */
const DEFAULT_WEIGHTS = {
  salesWeight: 25,
  reliabilityWeight: 25,
  attendanceWeight: 25,
  wastageWeight: 15,
  riskPenaltyWeight: 10,
};

@Injectable()
export class StaffInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Weights ──

  async getWeights(ctx: { branchId: string; organizationId: string }) {
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId: ctx.organizationId },
    });
    const raw = settings?.franchiseWeights as Record<string, unknown> | null;
    const staffWeights = (raw?.staffInsightWeights as Record<string, number>) ?? null;
    return staffWeights ?? { ...DEFAULT_WEIGHTS };
  }

  async updateWeights(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: UpdateStaffWeightsDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const current = await this.getWeights(ctx);
    const merged = { ...current, ...dto };

    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId: ctx.organizationId },
    });
    const existing = (settings?.franchiseWeights as Record<string, unknown>) ?? {};

    await this.prisma.orgSettings.update({
      where: { orgId: ctx.organizationId },
      data: {
        franchiseWeights: { ...existing, staffInsightWeights: merged } as any,
      },
    });

    await this.audit.log({
      action: 'STAFF_INSIGHT_WEIGHTS_UPDATED',
      actorUserId: userId,
      entityType: 'OrgSettings',
      entityId: ctx.organizationId,
      metadata: { weights: merged, orgId: ctx.organizationId, ...auditMeta },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return merged;
  }

  // ── Staff Insights ──

  async listInsights(
    ctx: { branchId: string; organizationId: string },
    query: ListStaffInsightsQueryDto,
  ) {
    const { organizationId: orgId, branchId } = ctx;
    const where: Prisma.StaffInsightSnapshotWhereInput = {
      orgId,
      OR: [{ branchId }, { branchId: null }],
    };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    if (query.periodStart) where.periodStart = { gte: new Date(query.periodStart) };
    if (query.periodEnd) where.periodEnd = { lte: new Date(query.periodEnd) };

    const [data, total] = await Promise.all([
      this.prisma.staffInsightSnapshot.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              positionId: true,
            },
          },
        },
        orderBy: { compositeScore: 'desc' },
        skip: query.skip ?? 0,
        take: query.take ?? 50,
      }),
      this.prisma.staffInsightSnapshot.count({ where }),
    ]);
    return { data, total };
  }

  async getInsightByEmployee(
    ctx: { branchId: string; organizationId: string },
    employeeId: string,
  ) {
    const { organizationId: orgId, branchId } = ctx;
    const snapshots = await this.prisma.staffInsightSnapshot.findMany({
      where: {
        orgId,
        employeeId,
        OR: [{ branchId }, { branchId: null }],
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            positionId: true,
            status: true,
          },
        },
      },
      orderBy: { periodEnd: 'desc' },
      take: 10,
    });
    if (snapshots.length === 0) {
      throw new NotFoundException('No insight snapshots found for this employee');
    }
    return snapshots;
  }

  async generateInsights(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    periodStart: Date,
    periodEnd: Date,
    employeeIds?: string[],
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;
    const weights = await this.getWeights(ctx);

    // Find ACTIVE employees for the branch
    const employeeWhere: Prisma.EmployeeWhereInput = {
      orgId,
      status: 'ACTIVE',
      OR: [{ branchId }, { branchId: null }],
    };
    if (employeeIds && employeeIds.length > 0) {
      employeeWhere.id = { in: employeeIds };
    }
    const employees = await this.prisma.employee.findMany({ where: employeeWhere });

    if (employees.length === 0) {
      throw new BadRequestException('No active employees found for the given criteria');
    }

    const results = [];
    for (const emp of employees) {
      // Check if snapshot already exists for this exact period
      const existing = await this.prisma.staffInsightSnapshot.findUnique({
        where: {
          orgId_employeeId_periodStart_periodEnd: {
            orgId,
            employeeId: emp.id,
            periodStart,
            periodEnd,
          },
        },
      });
      if (existing) {
        results.push(existing);
        continue;
      }

      // Calculate scores from source data
      const scores = await this.calculateScores(
        orgId,
        branchId,
        emp.id,
        periodStart,
        periodEnd,
        weights,
      );

      const snapshot = await this.prisma.staffInsightSnapshot.create({
        data: {
          orgId,
          branchId,
          employeeId: emp.id,
          periodStart,
          periodEnd,
          salesScore: scores.salesScore,
          reliabilityScore: scores.reliabilityScore,
          attendanceScore: scores.attendanceScore,
          wastageScore: scores.wastageScore,
          riskPenalty: scores.riskPenalty,
          compositeScore: scores.compositeScore,
          weights: weights as any,
          sourceSummary: scores.sourceSummary as any,
          generatedById: userId,
        },
      });
      results.push(snapshot);
    }

    await this.audit.log({
      action: 'STAFF_INSIGHT_SNAPSHOT_GENERATED',
      actorUserId: userId,
      entityType: 'StaffInsightSnapshot',
      entityId: results.map((r) => r.id).join(','),
      metadata: {
        count: results.length,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        orgId,
        branchId,
        ...auditMeta,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return results;
  }

  private async calculateScores(
    orgId: string,
    branchId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
    weights: Record<string, number>,
  ) {
    // 1. Get employee's linked user
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    });

    // 2. Sales score: based on orders created by the employee's linked user
    let salesCount = 0;
    let salesTotal = 0;
    if (employee?.userId) {
      const orders = await this.prisma.order.findMany({
        where: {
          orgId,
          branchId,
          userId: employee.userId,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        select: { total: true },
      });
      salesCount = orders.length;
      salesTotal = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    }
    // Normalize sales score 0-100 (simple: cap at 50 orders = 100)
    const salesScore = Math.min(100, (salesCount / 50) * 100);

    // 3. Attendance score: based on attendance records
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        orgId,
        employeeId,
        attendanceDate: { gte: periodStart, lte: periodEnd },
      },
      select: { status: true, lateMinutes: true },
    });
    const totalDays = attendanceRecords.length || 1;
    const lateDays = attendanceRecords.filter((r) => r.status === 'LATE').length;
    const absentDays = attendanceRecords.filter((r) => r.status === 'ABSENT').length;
    const attendanceScore = Math.max(0, 100 - lateDays * 5 - absentDays * 15);

    // 4. Reliability score: based on schedule assignment adherence
    const assignments = await this.prisma.scheduleAssignment.count({
      where: {
        orgId,
        employeeId,
        shiftDate: { gte: periodStart, lte: periodEnd },
      },
    });
    // Reliability = attendance vs scheduled shifts
    const reliabilityScore =
      assignments > 0 ? Math.min(100, ((totalDays - absentDays) / assignments) * 100) : 80; // default if no schedule data

    // 5. Wastage score: from anomaly events (lower anomaly count = higher score)
    let anomalyCount = 0;
    if (employee?.userId) {
      anomalyCount = await this.prisma.anomalyEvent.count({
        where: {
          orgId,
          branchId,
          actorUserId: employee.userId,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      });
    }
    const wastageScore = Math.max(0, 100 - anomalyCount * 10);

    // 6. Risk penalty: from staff risk snapshots and unresolved anomalies
    let riskPenalty = 0;
    if (employee?.userId) {
      const unresolvedHighSeverity = await this.prisma.anomalyEvent.count({
        where: {
          orgId,
          branchId,
          actorUserId: employee.userId,
          status: 'OPEN',
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
      });
      riskPenalty = Math.min(50, unresolvedHighSeverity * 10);
    }

    // 7. Composite score: weighted average minus risk penalty
    const w = weights;
    const rawComposite =
      (salesScore * (w.salesWeight ?? 25) +
        reliabilityScore * (w.reliabilityWeight ?? 25) +
        attendanceScore * (w.attendanceWeight ?? 25) +
        wastageScore * (w.wastageWeight ?? 15)) /
      ((w.salesWeight ?? 25) +
        (w.reliabilityWeight ?? 25) +
        (w.attendanceWeight ?? 25) +
        (w.wastageWeight ?? 15));

    const compositeScore = Math.max(
      0,
      rawComposite - (riskPenalty * (w.riskPenaltyWeight ?? 10)) / 100,
    );

    const sourceSummary = {
      salesCount,
      salesTotal,
      totalAttendanceDays: totalDays,
      lateDays,
      absentDays,
      scheduledShifts: assignments,
      anomalyCount,
      unresolvedHighSeverity: riskPenalty / 10,
    };

    return {
      salesScore: Number(salesScore.toFixed(2)),
      reliabilityScore: Number(reliabilityScore.toFixed(2)),
      attendanceScore: Number(attendanceScore.toFixed(2)),
      wastageScore: Number(wastageScore.toFixed(2)),
      riskPenalty: Number(riskPenalty.toFixed(2)),
      compositeScore: Number(compositeScore.toFixed(2)),
      sourceSummary,
    };
  }

  // ── Awards ──

  async createAward(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: CreateStaffAwardDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;

    // Verify employee exists and belongs to org
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, orgId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Check for critical unresolved risk flags
    if (employee.userId) {
      const criticalRisks = await this.prisma.anomalyEvent.count({
        where: {
          orgId,
          actorUserId: employee.userId,
          status: 'OPEN',
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
      });
      if (criticalRisks > 0) {
        throw new ConflictException(
          `Cannot award: employee has ${criticalRisks} unresolved critical/high risk flag(s). Resolve them first.`,
        );
      }
    }

    const award = await this.prisma.staffAward.create({
      data: {
        orgId,
        branchId,
        employeeId: dto.employeeId,
        awardType: dto.awardType,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        title: dto.title,
        reason: dto.reason,
        createdById: userId,
      },
    });

    await this.audit.log({
      action: 'STAFF_AWARD_CREATED',
      actorUserId: userId,
      entityType: 'StaffAward',
      entityId: award.id,
      metadata: {
        employeeId: dto.employeeId,
        awardType: dto.awardType,
        title: dto.title,
        orgId,
        branchId,
        ...auditMeta,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return award;
  }

  async listAwards(
    ctx: { branchId: string; organizationId: string },
    filters?: { employeeId?: string; awardType?: string; skip?: number; take?: number },
  ) {
    const { organizationId: orgId, branchId } = ctx;
    const where: Prisma.StaffAwardWhereInput = {
      orgId,
      OR: [{ branchId }, { branchId: null }],
    };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.awardType) where.awardType = filters.awardType as any;

    const [data, total] = await Promise.all([
      this.prisma.staffAward.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: filters?.skip ?? 0,
        take: filters?.take ?? 50,
      }),
      this.prisma.staffAward.count({ where }),
    ]);
    return { data, total };
  }

  // ── Promotion Suggestions ──

  async generatePromotionSuggestions(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: GeneratePromotionSuggestionsDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    // First, ensure insights exist for the period
    const insightWhere: Prisma.StaffInsightSnapshotWhereInput = {
      orgId,
      OR: [{ branchId }, { branchId: null }],
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
      status: 'ACTIVE',
    };
    if (dto.employeeIds && dto.employeeIds.length > 0) {
      insightWhere.employeeId = { in: dto.employeeIds };
    }

    const insights = await this.prisma.staffInsightSnapshot.findMany({
      where: insightWhere,
      include: {
        employee: {
          select: {
            id: true,
            positionId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { compositeScore: 'desc' },
    });

    if (insights.length === 0) {
      throw new BadRequestException(
        'No active insight snapshots found for the given period. Generate insights first.',
      );
    }

    // Generate suggestions for top-scoring employees (composite >= 70)
    const threshold = 70;
    const topPerformers = insights.filter((s) => Number(s.compositeScore) >= threshold);

    const suggestions = [];
    for (const insight of topPerformers) {
      // Skip if a pending suggestion already exists for this employee+period
      const existing = await this.prisma.promotionSuggestion.findFirst({
        where: {
          orgId,
          employeeId: insight.employeeId,
          periodStart,
          periodEnd,
          status: 'PENDING',
        },
      });
      if (existing) {
        suggestions.push(existing);
        continue;
      }

      const suggestion = await this.prisma.promotionSuggestion.create({
        data: {
          orgId,
          branchId,
          employeeId: insight.employeeId,
          currentPositionId: insight.employee.positionId,
          suggestedPositionId: dto.suggestedPositionId ?? null,
          periodStart,
          periodEnd,
          generatedById: userId,
          rationale: {
            compositeScore: Number(insight.compositeScore),
            salesScore: Number(insight.salesScore),
            reliabilityScore: Number(insight.reliabilityScore),
            attendanceScore: Number(insight.attendanceScore),
            wastageScore: Number(insight.wastageScore),
            riskPenalty: Number(insight.riskPenalty),
            threshold,
            sourceSummary: insight.sourceSummary,
          } as any,
        },
      });
      suggestions.push(suggestion);
    }

    await this.audit.log({
      action: 'PROMOTION_SUGGESTION_GENERATED',
      actorUserId: userId,
      entityType: 'PromotionSuggestion',
      entityId: suggestions.map((s) => s.id).join(','),
      metadata: {
        count: suggestions.length,
        threshold,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        orgId,
        branchId,
        ...auditMeta,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return suggestions;
  }

  async listPromotionSuggestions(
    ctx: { branchId: string; organizationId: string },
    filters?: { status?: string; employeeId?: string; skip?: number; take?: number },
  ) {
    const { organizationId: orgId, branchId } = ctx;
    const where: Prisma.PromotionSuggestionWhereInput = {
      orgId,
      OR: [{ branchId }, { branchId: null }],
    };
    if (filters?.status) where.status = filters.status as any;
    if (filters?.employeeId) where.employeeId = filters.employeeId;

    const [data, total] = await Promise.all([
      this.prisma.promotionSuggestion.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          currentPosition: { select: { id: true, code: true, title: true } },
          suggestedPosition: { select: { id: true, code: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: filters?.skip ?? 0,
        take: filters?.take ?? 50,
      }),
      this.prisma.promotionSuggestion.count({ where }),
    ]);
    return { data, total };
  }

  async decidePromotionSuggestion(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    id: string,
    dto: DecidePromotionSuggestionDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId } = ctx;

    const suggestion = await this.prisma.promotionSuggestion.findFirst({
      where: { id, orgId },
    });
    if (!suggestion) {
      throw new NotFoundException('Promotion suggestion not found');
    }
    if (suggestion.status !== 'PENDING') {
      throw new ConflictException(
        `Promotion suggestion is already ${suggestion.status}. Only PENDING suggestions can be decided.`,
      );
    }

    const updated = await this.prisma.promotionSuggestion.update({
      where: { id },
      data: {
        status: dto.decision,
        decidedById: userId,
        decidedAt: new Date(),
        decisionNotes: dto.decisionNotes,
      },
    });

    await this.audit.log({
      action: 'PROMOTION_SUGGESTION_DECIDED',
      actorUserId: userId,
      entityType: 'PromotionSuggestion',
      entityId: id,
      metadata: {
        decision: dto.decision,
        decisionNotes: dto.decisionNotes,
        employeeId: suggestion.employeeId,
        orgId,
        ...auditMeta,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return updated;
  }
}
