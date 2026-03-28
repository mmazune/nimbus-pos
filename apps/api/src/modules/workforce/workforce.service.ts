import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
    CreateShiftTemplateDto,
    ListShiftTemplatesQueryDto,
    CreateScheduleDto,
    ListSchedulesQueryDto,
    PublishScheduleDto,
    ListRosterQueryDto,
    CreateCoverageRuleDto,
} from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkforceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ── Shift Templates ──

    async createShiftTemplate(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        dto: CreateShiftTemplateDto,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        // Check duplicate code
        const existing = await this.prisma.shiftTemplate.findUnique({
            where: { orgId_code: { orgId, code: dto.code } },
        });
        if (existing) {
            throw new ConflictException(`Shift template with code "${dto.code}" already exists`);
        }

        // Validate position if provided
        if (dto.positionId) {
            const pos = await this.prisma.position.findFirst({
                where: { id: dto.positionId, orgId },
            });
            if (!pos) {
                throw new NotFoundException(`Position "${dto.positionId}" not found in this organization`);
            }
        }

        const record = await this.prisma.shiftTemplate.create({
            data: {
                orgId,
                branchId,
                code: dto.code,
                name: dto.name,
                startsAtTime: dto.startsAtTime,
                endsAtTime: dto.endsAtTime,
                roleKey: dto.roleKey,
                positionId: dto.positionId,
                expectedHeadcount: dto.expectedHeadcount ?? 1,
                active: dto.active ?? true,
                notes: dto.notes,
            },
        });

        await this.audit.log({
            action: 'SHIFT_TEMPLATE_CREATED',
            actorUserId: userId,
            entityType: 'ShiftTemplate',
            entityId: record.id,
            metadata: { code: dto.code, name: dto.name, orgId, branchId, ...auditMeta },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return record;
    }

    async listShiftTemplates(
        ctx: { branchId: string; organizationId: string },
        query: ListShiftTemplatesQueryDto,
    ) {
        const { organizationId: orgId, branchId } = ctx;
        const where: Prisma.ShiftTemplateWhereInput = {
            orgId,
            OR: [{ branchId }, { branchId: null }],
        };

        if (query.active !== undefined) where.active = query.active;
        if (query.roleKey) where.roleKey = query.roleKey;
        if (query.positionId) where.positionId = query.positionId;
        if (query.search) {
            where.AND = [
                {
                    OR: [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { code: { contains: query.search, mode: 'insensitive' } },
                    ],
                },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.shiftTemplate.findMany({
                where,
                include: { position: true },
                orderBy: { createdAt: 'desc' },
                skip: Number(query.skip) || 0,
                take: Number(query.take) || 50,
            }),
            this.prisma.shiftTemplate.count({ where }),
        ]);

        return { data, total };
    }

    // ── Schedules ──

    async createSchedule(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        dto: CreateScheduleDto,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        const dateFrom = new Date(dto.dateFrom);
        const dateTo = new Date(dto.dateTo);
        if (dateTo < dateFrom) {
            throw new BadRequestException('dateTo must be on or after dateFrom');
        }

        // Validate and build assignments
        const assignmentData: Prisma.ScheduleAssignmentCreateManyScheduleInput[] = [];
        if (dto.assignments?.length) {
            for (const a of dto.assignments) {
                const shiftDate = new Date(a.shiftDate);
                if (shiftDate < dateFrom || shiftDate > dateTo) {
                    throw new BadRequestException(
                        `Assignment shiftDate ${a.shiftDate} is outside the schedule range`,
                    );
                }

                // Validate template
                const tmpl = await this.prisma.shiftTemplate.findFirst({
                    where: { id: a.shiftTemplateId, orgId },
                });
                if (!tmpl) {
                    throw new NotFoundException(`Shift template "${a.shiftTemplateId}" not found`);
                }

                // Validate employee
                const emp = await this.prisma.employee.findFirst({
                    where: { id: a.employeeId, orgId },
                });
                if (!emp) {
                    throw new NotFoundException(`Employee "${a.employeeId}" not found in this organization`);
                }

                assignmentData.push({
                    orgId,
                    branchId,
                    shiftTemplateId: a.shiftTemplateId,
                    employeeId: a.employeeId,
                    shiftDate,
                    roleKey: a.roleKey,
                    notes: a.notes,
                });
            }
        }

        const schedule = await this.prisma.schedule.create({
            data: {
                orgId,
                branchId,
                name: dto.name,
                dateFrom,
                dateTo,
                notes: dto.notes,
                assignments: assignmentData.length ? { createMany: { data: assignmentData } } : undefined,
            },
            include: { assignments: true },
        });

        await this.audit.log({
            action: 'SCHEDULE_CREATED',
            actorUserId: userId,
            entityType: 'Schedule',
            entityId: schedule.id,
            metadata: {
                name: dto.name,
                dateFrom: dto.dateFrom,
                dateTo: dto.dateTo,
                assignmentCount: assignmentData.length,
                orgId,
                branchId,
                ...auditMeta,
            },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return schedule;
    }

    async listSchedules(
        ctx: { branchId: string; organizationId: string },
        query: ListSchedulesQueryDto,
    ) {
        const { organizationId: orgId, branchId } = ctx;
        const where: Prisma.ScheduleWhereInput = { orgId, branchId };

        if (query.status) where.status = query.status as any;
        if (query.dateFrom || query.dateTo) {
            if (query.dateFrom) where.dateFrom = { gte: new Date(query.dateFrom) };
            if (query.dateTo) where.dateTo = { lte: new Date(query.dateTo) };
        }

        const [data, total] = await Promise.all([
            this.prisma.schedule.findMany({
                where,
                include: { assignments: { include: { employee: true, shiftTemplate: true } } },
                orderBy: { createdAt: 'desc' },
                skip: Number(query.skip) || 0,
                take: Number(query.take) || 50,
            }),
            this.prisma.schedule.count({ where }),
        ]);

        return { data, total };
    }

    async getSchedule(ctx: { branchId: string; organizationId: string }, id: string) {
        const { organizationId: orgId, branchId } = ctx;

        const schedule = await this.prisma.schedule.findFirst({
            where: { id, orgId, branchId },
            include: {
                assignments: {
                    include: { employee: true, shiftTemplate: true },
                    orderBy: { shiftDate: 'asc' },
                },
                publishedBy: true,
            },
        });
        if (!schedule) {
            throw new NotFoundException(`Schedule "${id}" not found`);
        }
        return schedule;
    }

    async publishSchedule(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        id: string,
        dto: PublishScheduleDto,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        const existing = await this.prisma.schedule.findFirst({
            where: { id, orgId, branchId },
        });
        if (!existing) {
            throw new NotFoundException(`Schedule "${id}" not found`);
        }
        if (existing.status !== 'DRAFT') {
            throw new BadRequestException(
                `Only DRAFT schedules can be published (current: ${existing.status})`,
            );
        }

        const record = await this.prisma.schedule.update({
            where: { id },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date(),
                publishedById: userId,
                version: { increment: 1 },
                notes: dto.notes ?? existing.notes,
            },
            include: { assignments: true },
        });

        await this.audit.log({
            action: 'SCHEDULE_PUBLISHED',
            actorUserId: userId,
            entityType: 'Schedule',
            entityId: record.id,
            metadata: {
                name: record.name,
                version: record.version,
                orgId,
                branchId,
                ...auditMeta,
            },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return record;
    }

    async archiveSchedule(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        id: string,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        const existing = await this.prisma.schedule.findFirst({
            where: { id, orgId, branchId },
        });
        if (!existing) {
            throw new NotFoundException(`Schedule "${id}" not found`);
        }
        if (existing.status === 'ARCHIVED') {
            throw new BadRequestException('Schedule is already archived');
        }

        const record = await this.prisma.schedule.update({
            where: { id },
            data: { status: 'ARCHIVED' },
        });

        await this.audit.log({
            action: 'SCHEDULE_ARCHIVED',
            actorUserId: userId,
            entityType: 'Schedule',
            entityId: record.id,
            metadata: { name: record.name, orgId, branchId, ...auditMeta },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return record;
    }

    // ── Coverage Rules ──

    async createCoverageRule(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        dto: CreateCoverageRuleDto,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        if (dto.positionId) {
            const pos = await this.prisma.position.findFirst({
                where: { id: dto.positionId, orgId },
            });
            if (!pos) {
                throw new NotFoundException(`Position "${dto.positionId}" not found in this organization`);
            }
        }

        const record = await this.prisma.coverageRule.create({
            data: {
                orgId,
                branchId,
                name: dto.name,
                roleKey: dto.roleKey,
                positionId: dto.positionId,
                minimumHeadcount: dto.minimumHeadcount ?? 1,
                appliesFromTime: dto.appliesFromTime,
                appliesToTime: dto.appliesToTime,
                status: (dto.status as any) ?? 'ACTIVE',
                severity: (dto.severity as any) ?? 'MEDIUM',
                notes: dto.notes,
            },
        });

        await this.audit.log({
            action: 'COVERAGE_RULE_CREATED',
            actorUserId: userId,
            entityType: 'CoverageRule',
            entityId: record.id,
            metadata: { name: dto.name, orgId, branchId, ...auditMeta },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return record;
    }

    async listCoverageRules(ctx: { branchId: string; organizationId: string }) {
        const { organizationId: orgId, branchId } = ctx;

        return this.prisma.coverageRule.findMany({
            where: {
                orgId,
                OR: [{ branchId }, { branchId: null }],
            },
            include: { position: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ── Roster ──

    async getRoster(ctx: { branchId: string; organizationId: string }, query: ListRosterQueryDto) {
        const { organizationId: orgId, branchId } = ctx;
        const where: Prisma.ScheduleAssignmentWhereInput = {
            orgId,
            branchId,
            schedule: { status: 'PUBLISHED' },
        };

        if (query.employeeId) where.employeeId = query.employeeId;
        if (query.shiftTemplateId) where.shiftTemplateId = query.shiftTemplateId;
        if (query.dateFrom || query.dateTo) {
            where.shiftDate = {};
            if (query.dateFrom) where.shiftDate.gte = new Date(query.dateFrom);
            if (query.dateTo) where.shiftDate.lte = new Date(query.dateTo);
        }

        const [data, total] = await Promise.all([
            this.prisma.scheduleAssignment.findMany({
                where,
                include: {
                    employee: true,
                    shiftTemplate: true,
                    schedule: true,
                },
                orderBy: [{ shiftDate: 'asc' }, { createdAt: 'asc' }],
                skip: Number(query.skip) || 0,
                take: Number(query.take) || 50,
            }),
            this.prisma.scheduleAssignment.count({ where }),
        ]);

        return { data, total };
    }

    // ── Coverage Gaps ──

    async getCoverageGaps(
        ctx: { branchId: string; organizationId: string },
        dateFrom: string,
        dateTo: string,
    ) {
        const { organizationId: orgId, branchId } = ctx;

        // Get active coverage rules for this branch
        const rules = await this.prisma.coverageRule.findMany({
            where: {
                orgId,
                status: 'ACTIVE',
                OR: [{ branchId }, { branchId: null }],
            },
        });

        if (!rules.length) {
            return { gaps: [], message: 'No active coverage rules defined' };
        }

        // Get published schedule assignments in the date range
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        const assignments = await this.prisma.scheduleAssignment.findMany({
            where: {
                orgId,
                branchId,
                schedule: { status: 'PUBLISHED' },
                shiftDate: { gte: from, lte: to },
            },
            include: { shiftTemplate: true },
        });

        const gaps: Array<{
            date: string;
            rule: { id: string; name: string; roleKey: string | null; positionId: string | null };
            required: number;
            assigned: number;
            deficit: number;
            severity: string;
        }> = [];

        // For each day in the range, check each rule
        const current = new Date(from);
        while (current <= to) {
            const dateStr = current.toISOString().split('T')[0];

            for (const rule of rules) {
                // Count assignments matching this rule on this day
                const dayAssignments = assignments.filter((a) => {
                    const aDate = new Date(a.shiftDate).toISOString().split('T')[0];
                    if (aDate !== dateStr) return false;

                    // Match by roleKey if rule specifies one
                    if (rule.roleKey) {
                        const matchesRole =
                            a.roleKey === rule.roleKey || a.shiftTemplate.roleKey === rule.roleKey;
                        if (!matchesRole) return false;
                    }

                    // Match by positionId if rule specifies one
                    if (rule.positionId) {
                        if (a.shiftTemplate.positionId !== rule.positionId) return false;
                    }

                    // Match by time window if rule specifies one
                    if (rule.appliesFromTime && rule.appliesToTime) {
                        const tmplStart = a.shiftTemplate.startsAtTime;
                        const tmplEnd = a.shiftTemplate.endsAtTime;
                        // Simple overlap check: template overlaps rule window
                        if (tmplEnd <= rule.appliesFromTime || tmplStart >= rule.appliesToTime) {
                            return false;
                        }
                    }

                    return true;
                });

                const assigned = dayAssignments.length;
                if (assigned < rule.minimumHeadcount) {
                    gaps.push({
                        date: dateStr,
                        rule: {
                            id: rule.id,
                            name: rule.name,
                            roleKey: rule.roleKey,
                            positionId: rule.positionId,
                        },
                        required: rule.minimumHeadcount,
                        assigned,
                        deficit: rule.minimumHeadcount - assigned,
                        severity: rule.severity,
                    });
                }
            }

            current.setDate(current.getDate() + 1);
        }

        return { gaps, total: gaps.length };
    }
}
