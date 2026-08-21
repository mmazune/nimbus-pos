import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditTimelineQueryDto } from './dto';

export interface AuditTimelineItem {
    id: string;
    timestamp: string;
    action: string;
    actorId: string | null;
    actorName: string | null;
    entityType: string;
    entityId: string | null;
    orgId: string | null;
    branchId: string | null;
    branchName: string | null;
    summary: string;
    sourceModule: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadataPreview: Record<string, unknown>;
}

export interface AuditTimelineResult {
    data: AuditTimelineItem[];
    total: number;
    page: number;
    pageSize: number;
    filters: AuditTimelineQueryDto & { resolvedOrgId?: string };
}

/**
 * BG2 — Global Audit Timeline (read-only).
 *
 * Reuses the existing `AuditLog` table that every domain already writes to.
 * No schema change. Filters use Prisma JSON-path filtering on `metadata.orgId`
 * and `metadata.branchId` — both are written consistently across BG1.x and
 * the M16/M19/M28/M34/M38 surfaces.
 */
@Injectable()
export class AuditTimelineReadService {
    constructor(private readonly prisma: PrismaService) { }

    async query(
        callerCtx: { organizationId: string; branchId: string },
        query: AuditTimelineQueryDto,
    ): Promise<AuditTimelineResult> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 50;

        // Default to the caller's organization when the client didn't provide one.
        const resolvedOrgId = query.orgId ?? callerCtx.organizationId;

        const where: Prisma.AuditLogWhereInput = {};
        const ANDs: Prisma.AuditLogWhereInput[] = [];

        if (query.entityType) where.entityType = query.entityType;
        if (query.entityId) where.entityId = query.entityId;
        if (query.userId) where.actorUserId = query.userId;
        if (query.action) where.action = query.action.toUpperCase();
        if (query.actionPrefix) {
            where.action = { startsWith: query.actionPrefix.toUpperCase() };
        }
        if (query.dateFrom || query.dateTo) {
            const range: { gte?: Date; lte?: Date } = {};
            if (query.dateFrom) range.gte = new Date(query.dateFrom);
            if (query.dateTo) range.lte = new Date(query.dateTo);
            where.createdAt = range;
        }

        // metadata.orgId / metadata.branchId JSON-path filters.
        ANDs.push({ metadata: { path: ['orgId'], equals: resolvedOrgId } });

        // B5-F4 (backend gap batch 3): this endpoint used to honour a branch
        // only via the OPTIONAL `?branchId=` query param and ignored
        // `X-Branch-Id` entirely, so the default read was every branch in the
        // org mixed together — the same shape PC-03 fixed across accounting.
        // `X-Branch-Id` now scopes every read by default, mirroring the
        // AR/AP "header scopes it; the query param survives as a narrowing
        // filter inside that scope" precedent. An explicit `?branchId=` that
        // disagrees with the acting branch simply returns nothing — it can no
        // longer be used to read another branch's audit trail.
        ANDs.push({ metadata: { path: ['branchId'], equals: callerCtx.branchId } });
        if (query.branchId && query.branchId !== callerCtx.branchId) {
            ANDs.push({ metadata: { path: ['branchId'], equals: query.branchId } });
        }
        if (ANDs.length) where.AND = ANDs;

        const [rows, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    actor: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                },
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        const branchIds = Array.from(
            new Set(
                rows
                    .map((r) => this.readMetaString(r.metadata, 'branchId'))
                    .filter((v): v is string => !!v),
            ),
        );
        const branchMap = new Map<string, string | null>();
        if (branchIds.length) {
            const branches = await this.prisma.branch.findMany({
                where: { id: { in: branchIds } },
                select: { id: true, name: true },
            });
            for (const b of branches) branchMap.set(b.id, b.name);
        }

        const data: AuditTimelineItem[] = rows.map((r) => {
            const orgId = this.readMetaString(r.metadata, 'orgId') ?? null;
            const branchId = this.readMetaString(r.metadata, 'branchId') ?? null;
            const actor = r.actor;
            const actorName = actor
                ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() || actor.email
                : null;
            return {
                id: r.id,
                timestamp: r.createdAt.toISOString(),
                action: r.action,
                actorId: r.actorUserId,
                actorName,
                entityType: r.entityType,
                entityId: r.entityId,
                orgId,
                branchId,
                branchName: branchId ? (branchMap.get(branchId) ?? null) : null,
                summary: this.buildSummary(r.action, r.entityType, r.entityId),
                sourceModule: this.deriveSourceModule(r.action, r.entityType),
                ipAddress: r.ipAddress,
                userAgent: r.userAgent,
                metadataPreview: this.previewMetadata(r.metadata),
            };
        });

        return {
            data,
            total,
            page,
            pageSize,
            filters: { ...query, resolvedOrgId },
        };
    }

    private readMetaString(meta: unknown, key: string): string | undefined {
        if (!meta || typeof meta !== 'object') return undefined;
        const v = (meta as Record<string, unknown>)[key];
        return typeof v === 'string' ? v : undefined;
    }

    private buildSummary(action: string, entityType: string, entityId: string | null): string {
        const verb = action.toLowerCase().replace(/_/g, ' ');
        return entityId ? `${verb} on ${entityType}/${entityId}` : verb;
    }

    /**
     * Best-effort source module attribution. The audit row already carries the
     * action+entityType so this is purely a UI-grouping hint.
     */
    private deriveSourceModule(action: string, entityType: string): string | null {
        const a = action.toUpperCase();
        if (a.startsWith('DISCOUNT_')) return 'discounts';
        if (a.startsWith('REFUND_')) return 'refunds';
        if (a.startsWith('ORDER_')) return 'orders';
        if (a.startsWith('LEAVE_REQUEST_')) return 'attendance';
        if (a.startsWith('SHIFT_SWAP_')) return 'attendance';
        if (a.startsWith('VENDOR_BILL_')) return 'accounts-payable';
        if (a.startsWith('INTER_BRANCH_TRANSFER_')) return 'franchise';
        if (a.startsWith('UNIFIED_APPROVAL_')) return 'unified-approvals';
        if (a.startsWith('QUICK_PIN_')) return 'auth';
        if (a.startsWith('FRONTLINE_STAFF_')) return 'hr';
        if (a.startsWith('FLAG_')) return 'controlplane';
        if (a.startsWith('MAINTENANCE_')) return 'controlplane';
        if (a.startsWith('TRAINING_')) return 'controlplane';
        return entityType ? entityType.toLowerCase() : null;
    }

    private previewMetadata(meta: unknown): Record<string, unknown> {
        if (!meta || typeof meta !== 'object') return {};
        const out: Record<string, unknown> = {};
        let n = 0;
        for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
            if (n >= 8) break;
            out[k] = typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…' : v;
            n++;
        }
        return out;
    }
}
