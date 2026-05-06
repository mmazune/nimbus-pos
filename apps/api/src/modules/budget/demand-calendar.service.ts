import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  CreateDemandCalendarEntryDto,
  UpdateDemandCalendarEntryDto,
  ListDemandCalendarQueryDto,
} from './dto';

interface BranchContext {
  organizationId: string;
  branchId: string;
}

interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DemandCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: BranchContext, query: ListDemandCalendarQueryDto) {
    const where: Record<string, unknown> = {
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
    };
    if (query.calendarType) where['calendarType'] = query.calendarType;
    if (query.daypart) where['daypart'] = query.daypart;
    if (query.isActive !== undefined) where['isActive'] = query.isActive === 'true';
    if (query.dateStart || query.dateEnd) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateStart) dateFilter['gte'] = new Date(query.dateStart);
      if (query.dateEnd) dateFilter['lte'] = new Date(query.dateEnd);
      where['dateStart'] = dateFilter;
    }

    return this.prisma.demandCalendarEntry.findMany({
      where,
      include: {
        event: { select: { id: true, title: true, startsAt: true, endsAt: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ dateStart: 'asc' }, { daypart: 'asc' }],
    });
  }

  async getById(ctx: BranchContext, id: string) {
    const entry = await this.prisma.demandCalendarEntry.findFirst({
      where: { id, orgId: ctx.organizationId, branchId: ctx.branchId },
      include: {
        event: { select: { id: true, title: true, startsAt: true, endsAt: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!entry) throw new NotFoundException(`Demand calendar entry "${id}" not found`);
    return entry;
  }

  async create(
    userId: string,
    ctx: BranchContext,
    dto: CreateDemandCalendarEntryDto,
    meta: AuditMeta,
  ) {
    const dateStart = new Date(dto.dateStart);
    const dateEnd = new Date(dto.dateEnd);
    if (dateEnd < dateStart) {
      throw new BadRequestException('dateEnd must be >= dateStart');
    }

    if (dto.eventId) {
      const event = await this.prisma.event.findFirst({
        where: { id: dto.eventId, orgId: ctx.organizationId, branchId: ctx.branchId },
      });
      if (!event) throw new BadRequestException(`Event "${dto.eventId}" not found in branch`);
    }

    const entry = await this.prisma.demandCalendarEntry.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        eventId: dto.eventId ?? null,
        calendarType: dto.calendarType,
        daypart: dto.daypart ?? 'ALL_DAY',
        title: dto.title,
        dateStart,
        dateEnd,
        expectedCovers: dto.expectedCovers ?? null,
        demandMultiplier: dto.demandMultiplier ?? null,
        revenueUpliftPct: dto.revenueUpliftPct ?? null,
        itemNotes: dto.itemNotes ?? null,
        notes: dto.notes ?? null,
        createdById: userId,
      },
    });

    await this.audit.log({
      action: 'DEMAND_CALENDAR_CREATED',
      actorUserId: userId,
      entityType: 'DemandCalendarEntry',
      entityId: entry.id,
      metadata: {
        calendarType: dto.calendarType,
        daypart: dto.daypart ?? 'ALL_DAY',
        title: dto.title,
        dateStart: dto.dateStart,
        dateEnd: dto.dateEnd,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getById(ctx, entry.id);
  }

  async update(
    userId: string,
    ctx: BranchContext,
    id: string,
    dto: UpdateDemandCalendarEntryDto,
    meta: AuditMeta,
  ) {
    const existing = await this.prisma.demandCalendarEntry.findFirst({
      where: { id, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!existing) throw new NotFoundException(`Demand calendar entry "${id}" not found`);

    if (dto.dateStart && dto.dateEnd) {
      if (new Date(dto.dateEnd) < new Date(dto.dateStart)) {
        throw new BadRequestException('dateEnd must be >= dateStart');
      }
    } else if (dto.dateStart && !dto.dateEnd) {
      if (existing.dateEnd < new Date(dto.dateStart)) {
        throw new BadRequestException('dateEnd must be >= dateStart');
      }
    } else if (!dto.dateStart && dto.dateEnd) {
      if (new Date(dto.dateEnd) < existing.dateStart) {
        throw new BadRequestException('dateEnd must be >= dateStart');
      }
    }

    if (dto.eventId) {
      const event = await this.prisma.event.findFirst({
        where: { id: dto.eventId, orgId: ctx.organizationId, branchId: ctx.branchId },
      });
      if (!event) throw new BadRequestException(`Event "${dto.eventId}" not found in branch`);
    }

    const data: Record<string, unknown> = { updatedById: userId };
    if (dto.calendarType !== undefined) data['calendarType'] = dto.calendarType;
    if (dto.daypart !== undefined) data['daypart'] = dto.daypart;
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.dateStart !== undefined) data['dateStart'] = new Date(dto.dateStart);
    if (dto.dateEnd !== undefined) data['dateEnd'] = new Date(dto.dateEnd);
    if (dto.expectedCovers !== undefined) data['expectedCovers'] = dto.expectedCovers;
    if (dto.demandMultiplier !== undefined) data['demandMultiplier'] = dto.demandMultiplier;
    if (dto.revenueUpliftPct !== undefined) data['revenueUpliftPct'] = dto.revenueUpliftPct;
    if (dto.itemNotes !== undefined) data['itemNotes'] = dto.itemNotes;
    if (dto.notes !== undefined) data['notes'] = dto.notes;
    if (dto.eventId !== undefined) data['eventId'] = dto.eventId;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;

    await this.prisma.demandCalendarEntry.update({ where: { id }, data });

    await this.audit.log({
      action: 'DEMAND_CALENDAR_UPDATED',
      actorUserId: userId,
      entityType: 'DemandCalendarEntry',
      entityId: id,
      metadata: { changes: Object.keys(dto) },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getById(ctx, id);
  }

  async delete(userId: string, ctx: BranchContext, id: string, meta: AuditMeta) {
    const existing = await this.prisma.demandCalendarEntry.findFirst({
      where: { id, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!existing) throw new NotFoundException(`Demand calendar entry "${id}" not found`);

    await this.prisma.demandCalendarEntry.delete({ where: { id } });

    await this.audit.log({
      action: 'DEMAND_CALENDAR_DELETED',
      actorUserId: userId,
      entityType: 'DemandCalendarEntry',
      entityId: id,
      metadata: { title: existing.title, calendarType: existing.calendarType },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { deleted: true };
  }

  async getEntriesForWindow(orgId: string, branchId: string, windowStart: Date, windowEnd: Date) {
    return this.prisma.demandCalendarEntry.findMany({
      where: {
        orgId,
        branchId,
        isActive: true,
        dateStart: { lte: windowEnd },
        dateEnd: { gte: windowStart },
      },
      include: {
        event: { select: { id: true, title: true, startsAt: true, capacity: true } },
      },
      orderBy: [{ dateStart: 'asc' }],
    });
  }
}
