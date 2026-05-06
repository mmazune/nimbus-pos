import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListFlagAuditsQueryDto } from './dto';

export type FlagAuditActionT =
    | 'FLAG_CREATED'
    | 'FLAG_UPDATED'
    | 'FLAG_ENABLED'
    | 'FLAG_DISABLED'
    | 'FLAG_ARCHIVED'
    | 'MAINTENANCE_WINDOW_CREATED'
    | 'MAINTENANCE_WINDOW_UPDATED'
    | 'MAINTENANCE_WINDOW_ACTIVATED'
    | 'MAINTENANCE_WINDOW_DEACTIVATED'
    | 'TRAINING_SESSION_STARTED'
    | 'TRAINING_SESSION_ENDED'
    | 'WRITE_BLOCKED_BY_MAINTENANCE'
    | 'REAL_POST_BLOCKED_BY_TRAINING';

export interface FlagAuditEntry {
    orgId?: string | null;
    action: FlagAuditActionT;
    flagId?: string | null;
    maintenanceWindowId?: string | null;
    trainingSessionId?: string | null;
    actorUserId?: string | null;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    note?: string | null;
    metadata?: Record<string, unknown> | null;
}

@Injectable()
export class FlagAuditService {
    constructor(private readonly prisma: PrismaService) { }

    async log(entry: FlagAuditEntry): Promise<void> {
        await this.prisma.flagAudit.create({
            data: {
                orgId: entry.orgId ?? null,
                action: entry.action as any,
                flagId: entry.flagId ?? null,
                maintenanceWindowId: entry.maintenanceWindowId ?? null,
                trainingSessionId: entry.trainingSessionId ?? null,
                actorUserId: entry.actorUserId ?? null,
                beforeState: entry.beforeState ? (JSON.parse(JSON.stringify(entry.beforeState)) as any) : undefined,
                afterState: entry.afterState ? (JSON.parse(JSON.stringify(entry.afterState)) as any) : undefined,
                note: entry.note ?? null,
                metadata: entry.metadata ? (JSON.parse(JSON.stringify(entry.metadata)) as any) : undefined,
            },
        });
    }

    async list(orgId: string, q: ListFlagAuditsQueryDto) {
        const limit = Math.min(Math.max(q.limit ?? 50, 1), 500);
        const where: any = { orgId };
        if (q.flagId) where.flagId = q.flagId;
        if (q.maintenanceWindowId) where.maintenanceWindowId = q.maintenanceWindowId;
        if (q.action) where.action = q.action;
        const items = await this.prisma.flagAudit.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return { items, total: items.length };
    }
}
