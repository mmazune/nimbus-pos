import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, TableStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  CreateFloorPlanDto,
  UpdateFloorPlanDto,
  CreateTableDto,
  UpdateTableDto,
  UpdateTableStatusDto,
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
export class FloorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Floor Plans ──

  async createFloorPlan(
    userId: string,
    ctx: BranchContext,
    dto: CreateFloorPlanDto,
    meta: RequestMeta,
  ) {
    const floorPlan = await this.prisma.floorPlan.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        name: dto.name,
        data: (dto.data ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'FLOOR_PLAN_CREATED',
      entityType: 'floor_plan',
      entityId: floorPlan.id,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, name: dto.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return floorPlan;
  }

  async listFloorPlans(ctx: BranchContext) {
    return this.prisma.floorPlan.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getFloorPlan(id: string, ctx: BranchContext) {
    const floorPlan = await this.prisma.floorPlan.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { tables: true },
    });
    if (!floorPlan) {
      throw new NotFoundException('Floor plan not found');
    }
    return floorPlan;
  }

  async updateFloorPlan(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateFloorPlanDto,
    meta: RequestMeta,
  ) {
    // Verify floor plan belongs to branch
    const existing = await this.prisma.floorPlan.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Floor plan not found');
    }

    const data: Prisma.FloorPlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.data !== undefined) data.data = dto.data as Prisma.InputJsonValue;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.floorPlan.update({
      where: { id },
      data,
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'FLOOR_PLAN_UPDATED',
      entityType: 'floor_plan',
      entityId: id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Tables ──

  async createTable(userId: string, ctx: BranchContext, dto: CreateTableDto, meta: RequestMeta) {
    // Validate floorPlanId belongs to same branch if provided
    if (dto.floorPlanId) {
      const fp = await this.prisma.floorPlan.findFirst({
        where: { id: dto.floorPlanId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!fp) {
        throw new NotFoundException('Floor plan not found in this branch');
      }
    }

    // Check unique label per branch
    const existing = await this.prisma.table.findUnique({
      where: { branchId_label: { branchId: ctx.branchId, label: dto.label } },
    });
    if (existing) {
      throw new ConflictException(`Table label "${dto.label}" already exists in this branch`);
    }

    const table = await this.prisma.table.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        floorPlanId: dto.floorPlanId ?? null,
        label: dto.label,
        capacity: dto.capacity ?? 4,
        status: dto.status ?? TableStatus.AVAILABLE,
        isActive: dto.isActive ?? true,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'TABLE_CREATED',
      entityType: 'table',
      entityId: table.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        label: dto.label,
        floorPlanId: dto.floorPlanId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return table;
  }

  async listTables(ctx: BranchContext) {
    return this.prisma.table.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId },
      orderBy: { label: 'asc' },
      include: { floorPlan: { select: { id: true, name: true } } },
    });
  }

  async getTable(id: string, ctx: BranchContext) {
    const table = await this.prisma.table.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { floorPlan: { select: { id: true, name: true } } },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return table;
  }

  async updateTable(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateTableDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.table.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Table not found');
    }

    // If changing label, check uniqueness
    if (dto.label !== undefined && dto.label !== existing.label) {
      const labelConflict = await this.prisma.table.findUnique({
        where: { branchId_label: { branchId: ctx.branchId, label: dto.label } },
      });
      if (labelConflict) {
        throw new ConflictException(`Table label "${dto.label}" already exists in this branch`);
      }
    }

    // Validate floorPlanId if changing
    if (dto.floorPlanId !== undefined && dto.floorPlanId !== null) {
      const fp = await this.prisma.floorPlan.findFirst({
        where: { id: dto.floorPlanId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!fp) {
        throw new NotFoundException('Floor plan not found in this branch');
      }
    }

    const data: Prisma.TableUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as Prisma.InputJsonValue;
    if (dto.floorPlanId !== undefined) {
      data.floorPlan = dto.floorPlanId
        ? { connect: { id: dto.floorPlanId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.table.update({
      where: { id },
      data,
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'TABLE_UPDATED',
      entityType: 'table',
      entityId: id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async updateTableStatus(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateTableStatusDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.table.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Table not found');
    }

    const updated = await this.prisma.table.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'TABLE_STATUS_UPDATED',
      entityType: 'table',
      entityId: id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        previousStatus: existing.status,
        newStatus: dto.status,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Availability ──

  async getAvailability(ctx: BranchContext) {
    const tables = await this.prisma.table.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId, isActive: true },
      select: { id: true, label: true, capacity: true, status: true, floorPlanId: true },
      orderBy: { label: 'asc' },
    });

    const summary = {
      total: tables.length,
      available: tables.filter((t) => t.status === TableStatus.AVAILABLE).length,
      occupied: tables.filter((t) => t.status === TableStatus.OCCUPIED).length,
      reserved: tables.filter((t) => t.status === TableStatus.RESERVED).length,
      cleaning: tables.filter((t) => t.status === TableStatus.CLEANING).length,
    };

    return { summary, tables };
  }
}
