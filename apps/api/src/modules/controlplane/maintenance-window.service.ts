import {
    Injectable,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FlagAuditService } from './flag-audit.service';
import {
    CreateMaintenanceWindowDto,
    UpdateMaintenanceWindowDto,
    ListMaintenanceWindowsQueryDto,
    WriteBlockCategoryT,
} from './dto';

@Injectable()
export class MaintenanceWindowService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: FlagAuditService,
    ) { }

    async list(orgId: string, q: ListMaintenanceWindowsQueryDto) {
        const where: any = { orgId };
        if (q.status) where.status = q.status;
        if (q.branchId) where.branchId = q.branchId;
        const items = await this.prisma.maintenanceWindow.findMany({
            where,
            orderBy: { startsAt: 'desc' },
            take: 200,
        });
        return { items, total: items.length };
    }

    async get(orgId: string, id: string) {
        const win = await this.prisma.maintenanceWindow.findFirst({ where: { id, orgId } });
        if (!win) throw new NotFoundException('Maintenance window not found');
        return win;
    }

    async create(actorUserId: string, orgId: string, dto: CreateMaintenanceWindowDto) {
        const startsAt = new Date(dto.startsAt);
        const endsAt = new Date(dto.endsAt);
        if (!(startsAt < endsAt)) {
            throw new BadRequestException('startsAt must be strictly before endsAt');
        }
        const mode = dto.mode ?? 'ANNOUNCEMENT_ONLY';
        const blockCategories = dto.blockCategories ?? [];
        if (mode === 'BLOCK_WRITES' && blockCategories.length === 0) {
            throw new BadRequestException(
                'blockCategories must contain at least one entry when mode=BLOCK_WRITES',
            );
        }

        const existing = await this.prisma.maintenanceWindow.findFirst({
            where: { orgId, code: dto.code },
        });
        if (existing) {
            throw new ConflictException(`Maintenance window code '${dto.code}' already exists for this org`);
        }

        const win = await this.prisma.maintenanceWindow.create({
            data: {
                orgId,
                branchId: dto.branchId ?? null,
                code: dto.code,
                title: dto.title,
                message: dto.message ?? null,
                mode: mode as any,
                status: 'SCHEDULED',
                blockCategories: blockCategories as any,
                startsAt,
                endsAt,
                metadata: dto.metadata ? (JSON.parse(JSON.stringify(dto.metadata)) as any) : undefined,
                createdById: actorUserId,
                updatedById: actorUserId,
            },
        });

        await this.audit.log({
            orgId,
            action: 'MAINTENANCE_WINDOW_CREATED',
            maintenanceWindowId: win.id,
            actorUserId,
            afterState: {
                status: win.status,
                mode: win.mode,
                blockCategories: win.blockCategories,
                startsAt: win.startsAt.toISOString(),
                endsAt: win.endsAt.toISOString(),
            },
        });

        return win;
    }

    async patch(actorUserId: string, orgId: string, id: string, dto: UpdateMaintenanceWindowDto) {
        const existing = await this.prisma.maintenanceWindow.findFirst({ where: { id, orgId } });
        if (!existing) throw new NotFoundException('Maintenance window not found');

        const before = {
            status: existing.status,
            mode: existing.mode,
            blockCategories: existing.blockCategories,
            startsAt: existing.startsAt.toISOString(),
            endsAt: existing.endsAt.toISOString(),
        };

        const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
        const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
        if (!(startsAt < endsAt)) {
            throw new BadRequestException('startsAt must be strictly before endsAt');
        }
        const nextMode = dto.mode ?? existing.mode;
        const nextCategories =
            dto.blockCategories !== undefined ? dto.blockCategories : (existing.blockCategories as WriteBlockCategoryT[]);
        if (nextMode === 'BLOCK_WRITES' && nextCategories.length === 0) {
            throw new BadRequestException(
                'blockCategories must contain at least one entry when mode=BLOCK_WRITES',
            );
        }

        const nextStatus = dto.status ?? existing.status;
        const becameActive =
            existing.status !== 'ACTIVE' && nextStatus === 'ACTIVE';
        const becameInactive =
            existing.status === 'ACTIVE' && nextStatus !== 'ACTIVE';

        const updated = await this.prisma.maintenanceWindow.update({
            where: { id: existing.id },
            data: {
                title: dto.title ?? undefined,
                message: dto.message ?? undefined,
                mode: nextMode as any,
                status: nextStatus as any,
                blockCategories: nextCategories as any,
                startsAt: dto.startsAt ? startsAt : undefined,
                endsAt: dto.endsAt ? endsAt : undefined,
                activatedAt: becameActive ? new Date() : undefined,
                deactivatedAt: becameInactive ? new Date() : undefined,
                metadata:
                    dto.metadata !== undefined
                        ? (JSON.parse(JSON.stringify(dto.metadata)) as any)
                        : undefined,
                updatedById: actorUserId,
            },
        });

        let action:
            | 'MAINTENANCE_WINDOW_UPDATED'
            | 'MAINTENANCE_WINDOW_ACTIVATED'
            | 'MAINTENANCE_WINDOW_DEACTIVATED' = 'MAINTENANCE_WINDOW_UPDATED';
        if (becameActive) action = 'MAINTENANCE_WINDOW_ACTIVATED';
        else if (becameInactive) action = 'MAINTENANCE_WINDOW_DEACTIVATED';

        await this.audit.log({
            orgId,
            action,
            maintenanceWindowId: updated.id,
            actorUserId,
            beforeState: before,
            afterState: {
                status: updated.status,
                mode: updated.mode,
                blockCategories: updated.blockCategories,
                startsAt: updated.startsAt.toISOString(),
                endsAt: updated.endsAt.toISOString(),
            },
            note: dto.note ?? null,
        });

        return updated;
    }

    /**
     * Returns the first ACTIVE maintenance window that is currently within
     * its time bounds and whose `blockCategories` covers the given category
     * (or `ALL_WRITES`). Branch-scoped windows are evaluated first; org-wide
     * windows (`branchId == null`) apply to every branch.
     */
    async findBlockingWindow(
        orgId: string,
        branchId: string | null | undefined,
        category: WriteBlockCategoryT,
    ) {
        const now = new Date();
        const wins = await this.prisma.maintenanceWindow.findMany({
            where: {
                orgId,
                status: 'ACTIVE',
                mode: 'BLOCK_WRITES',
                startsAt: { lte: now },
                endsAt: { gt: now },
                OR: branchId ? [{ branchId: null }, { branchId }] : [{ branchId: null }],
            },
            orderBy: { startsAt: 'desc' },
        });
        return (
            wins.find((w) => {
                const cats = w.blockCategories as unknown as WriteBlockCategoryT[];
                return cats.includes('ALL_WRITES') || cats.includes(category);
            }) ?? null
        );
    }
}
