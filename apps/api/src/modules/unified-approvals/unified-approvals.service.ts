import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
    APPROVAL_SOURCE_REGISTRY,
    ApprovalDomain,
    ApprovalSourceMapping,
    ApprovalSourceType,
    decodeApprovalId,
    encodeApprovalId,
    findSource,
} from './approval-source.types';
import { ApprovalRoutingService, RoutedDecisionResult } from './approval-routing.service';
import { DecideApprovalDto, ListApprovalsDto } from './dto';

interface InboxContext {
    userId: string;
    organizationId: string;
    branchId: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface ApprovalListItem {
    id: string;
    sourceType: ApprovalSourceType;
    sourceModule: string;
    domain: ApprovalDomain;
    sourceEntityId: string;
    label: string;
    subtitle: string;
    status: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH';
    amount?: string | null;
    amountCurrency?: string | null;
    requestedById: string | null;
    requestedByName?: string | null;
    requestedAt: string;
    branchId?: string | null;
    branchName?: string | null;
    orgId: string;
    actionsAvailable: ('APPROVE' | 'REJECT')[];
    metadataPreview: Record<string, unknown>;
}

export interface ApprovalListResult {
    data: ApprovalListItem[];
    total: number;
    page: number;
    pageSize: number;
    filters: {
        status: string;
        sourceType?: ApprovalSourceType;
        domain?: ApprovalDomain[];
        branchId?: string;
        dateFrom?: string;
        dateTo?: string;
    };
    registry: {
        wiredSources: ApprovalSourceType[];
    };
}

export interface DecideResponse {
    ok: true;
    approvalId: string;
    source: ApprovalSourceType;
    decision: 'APPROVE' | 'REJECT';
    finalStatus: string;
    decidedById: string;
    decidedAt: string;
    reason?: string;
    underlying: unknown;
}

@Injectable()
export class UnifiedApprovalsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly routing: ApprovalRoutingService,
    ) { }

    // ───────────────────────────────────────────────────────────── List ──

    async list(ctx: InboxContext, query: ListApprovalsDto): Promise<ApprovalListResult> {
        const status = query.status ?? 'PENDING';
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const branchId = query.branchId ?? ctx.branchId;
        const domainFilter = this.normalizeDomainFilter(query.domain);

        const sourcesToQuery = APPROVAL_SOURCE_REGISTRY.filter((s) => {
            if (query.sourceType && s.type !== query.sourceType) return false;
            if (domainFilter && !domainFilter.includes(s.domain)) return false;
            return true;
        });

        // Per-source cap to keep merge cheap. The inbox is a manager surface,
        // not a deep scrolling history.
        const PER_SOURCE_CAP = Math.max(50, pageSize * 4);

        // Sequential fetch (one source at a time). Six small queries serialised
        // are still well under 1s and avoid blowing the Prisma connection pool
        // when the inbox is hit concurrently from multiple managers.
        const buckets: ApprovalListItem[][] = [];
        for (const source of sourcesToQuery) {
            buckets.push(
                await this.fetchSourceRows(
                    source,
                    ctx.organizationId,
                    branchId,
                    status,
                    query,
                    PER_SOURCE_CAP,
                ),
            );
        }

        const merged = buckets.flat().sort((a, b) => {
            if (b.requestedAt < a.requestedAt) return -1;
            if (b.requestedAt > a.requestedAt) return 1;
            return 0;
        });

        const total = merged.length;
        const start = (page - 1) * pageSize;
        const data = merged.slice(start, start + pageSize);

        // Inbox-read audit (lightweight; fire-and-forget would also be fine).
        await this.audit.log({
            actorUserId: ctx.userId,
            action: 'UNIFIED_APPROVAL_VIEWED',
            entityType: 'unified_approval_inbox',
            entityId: null,
            metadata: {
                orgId: ctx.organizationId,
                branchId,
                status,
                sourceType: query.sourceType,
                domain: domainFilter,
                returned: data.length,
                total,
            },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        });

        return {
            data,
            total,
            page,
            pageSize,
            filters: {
                status,
                sourceType: query.sourceType,
                domain: domainFilter,
                branchId,
                dateFrom: query.dateFrom,
                dateTo: query.dateTo,
            },
            registry: {
                wiredSources: APPROVAL_SOURCE_REGISTRY.map((s) => s.type),
            },
        };
    }

    // ─────────────────────────────────────────────────────────── Detail ──

    async detail(
        ctx: InboxContext,
        approvalId: string,
    ): Promise<{
        id: string;
        sourceType: ApprovalSourceType;
        sourceEntityId: string;
        summary: ApprovalListItem;
        source: Record<string, unknown>;
    }> {
        const decoded = decodeApprovalId(approvalId);
        if (!decoded) throw new BadRequestException(`Invalid approval id: "${approvalId}"`);
        const source = findSource(decoded.type)!;

        const row = await this.routing.loadDetail(source, decoded.entityId, {
            organizationId: ctx.organizationId,
            branchId: source.branchScoped ? ctx.branchId : undefined,
        });
        if (!row) throw new NotFoundException(`Approval "${approvalId}" not found`);

        const summary = await this.toListItem(source, row, ctx.organizationId, ctx.branchId);
        return {
            id: approvalId,
            sourceType: source.type,
            sourceEntityId: decoded.entityId,
            summary,
            source: row,
        };
    }

    // ─────────────────────────────────────────────────────────── Decide ──

    async decide(
        ctx: InboxContext,
        approvalId: string,
        dto: DecideApprovalDto,
    ): Promise<DecideResponse> {
        const decoded = decodeApprovalId(approvalId);
        if (!decoded) throw new BadRequestException(`Invalid approval id: "${approvalId}"`);
        const source = findSource(decoded.type)!;

        const result: RoutedDecisionResult = await this.routing.route(
            source,
            decoded.entityId,
            dto,
            ctx,
        );

        await this.audit.log({
            actorUserId: ctx.userId,
            action: 'UNIFIED_APPROVAL_DECIDED',
            entityType: 'unified_approval_inbox',
            entityId: approvalId,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                sourceType: source.type,
                sourceModule: source.sourceModule,
                sourceEntityId: decoded.entityId,
                decision: dto.decision,
                finalStatus: result.finalStatus,
                reason: dto.reason ?? null,
                managerPinUsed: !!dto.managerPin,
            },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        });

        return {
            ok: true,
            approvalId,
            source: source.type,
            decision: dto.decision,
            finalStatus: result.finalStatus,
            decidedById: result.decidedById,
            decidedAt: result.decidedAt,
            reason: dto.reason,
            underlying: result.underlying,
        };
    }

    // ──────────────────────────────────────────────────────────── Helpers ──

    private normalizeDomainFilter(
        raw: ListApprovalsDto['domain'],
    ): ApprovalDomain[] | undefined {
        if (!raw) return undefined;
        const items = Array.isArray(raw) ? raw : raw.split(',');
        const out = items
            .map((d) => d.toString().trim().toUpperCase())
            .filter((d): d is ApprovalDomain => d === 'POS' || d === 'FINANCE' || d === 'HR');
        return out.length ? out : undefined;
    }

    private async fetchSourceRows(
        source: ApprovalSourceMapping,
        orgId: string,
        branchId: string,
        status: string,
        query: ListApprovalsDto,
        cap: number,
    ): Promise<ApprovalListItem[]> {
        const where: Record<string, unknown> = { orgId };
        if (source.branchScoped) where.branchId = branchId;

        if (status === 'PENDING') {
            where.status = { in: source.pendingStatuses };
        } else if (status === 'DECIDED') {
            where.status = { notIn: source.pendingStatuses };
        } // 'ALL' → no status filter

        if (query.dateFrom || query.dateTo) {
            const range: { gte?: Date; lte?: Date } = {};
            if (query.dateFrom) range.gte = new Date(query.dateFrom);
            if (query.dateTo) range.lte = new Date(query.dateTo);
            where.createdAt = range;
        }

        const model = (this.prisma as unknown as Record<string, { findMany: Function }>)[
            source.prismaModel
        ];
        const rows = (await model.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: cap,
        })) as Array<Record<string, unknown>>;

        return Promise.all(rows.map((r) => this.toListItem(source, r, orgId, branchId)));
    }

    private async toListItem(
        source: ApprovalSourceMapping,
        row: Record<string, unknown>,
        orgId: string,
        fallbackBranchId: string,
    ): Promise<ApprovalListItem> {
        const id = encodeApprovalId(source.type, row.id as string);
        const status = (row.status as string) ?? 'UNKNOWN';
        const requestedAt =
            (row.createdAt as Date | undefined)?.toISOString?.() ?? new Date(0).toISOString();
        const rowBranchId = (row.branchId as string | null | undefined) ?? null;

        const requestedById = this.pickRequestedById(source.type, row);
        const amount = this.pickAmount(source.type, row);
        const subtitle = await this.buildSubtitle(source, row);
        const branchName = rowBranchId ? await this.lookupBranchName(rowBranchId) : null;

        const actionsAvailable: ('APPROVE' | 'REJECT')[] = source.pendingStatuses.includes(status)
            ? source.supportsReject
                ? ['APPROVE', 'REJECT']
                : ['APPROVE']
            : [];

        const priority = this.computePriority(source, row, amount);

        return {
            id,
            sourceType: source.type,
            sourceModule: source.sourceModule,
            domain: source.domain,
            sourceEntityId: row.id as string,
            label: source.label,
            subtitle,
            status,
            priority,
            amount: amount?.value ?? null,
            amountCurrency: amount?.currency ?? null,
            requestedById,
            requestedByName: requestedById ? await this.lookupUserName(requestedById) : null,
            requestedAt,
            branchId: rowBranchId ?? fallbackBranchId,
            branchName,
            orgId,
            actionsAvailable,
            metadataPreview: this.buildPreview(source.type, row),
        };
    }

    private pickRequestedById(type: ApprovalSourceType, row: Record<string, unknown>): string | null {
        switch (type) {
            case 'discount':
            case 'refund':
                return (row.createdById as string | undefined) ?? null;
            case 'leave_request':
                return (row.requestedById as string | undefined) ?? null;
            case 'shift_swap':
                // Approver isn't requester; use requesterEmployeeId via Employee lookup is too heavy
                // for inbox row — return null and let UI fetch detail.
                return null;
            case 'vendor_bill':
                return null;
            case 'inter_branch_transfer':
                return (row.requestedById as string | undefined) ?? null;
            default:
                return null;
        }
    }

    private pickAmount(
        type: ApprovalSourceType,
        row: Record<string, unknown>,
    ): { value: string; currency?: string } | null {
        switch (type) {
            case 'discount':
                return { value: String(row.value ?? '0') };
            case 'refund':
                return { value: String(row.amount ?? '0') };
            case 'vendor_bill':
                return { value: String(row.totalAmount ?? '0') };
            case 'inter_branch_transfer':
                return row.estimatedValue ? { value: String(row.estimatedValue) } : null;
            default:
                return null;
        }
    }

    private async buildSubtitle(
        source: ApprovalSourceMapping,
        row: Record<string, unknown>,
    ): Promise<string> {
        switch (source.type) {
            case 'discount':
                return `${row.type ?? ''} ${row.value ?? ''} — ${row.reason ?? 'no reason'}`.trim();
            case 'refund':
                return `Refund ${row.amount ?? ''} — ${row.reason ?? ''}`.trim();
            case 'leave_request':
                return `${row.leaveType ?? 'LEAVE'} ${this.fmtDate(row.startsAt)} → ${this.fmtDate(row.endsAt)}`;
            case 'shift_swap':
                return `Shift swap on ${this.fmtDate(row.shiftDate)}`;
            case 'vendor_bill':
                return `Bill ${row.billNumber ?? ''} — total ${row.totalAmount ?? '0'}`;
            case 'inter_branch_transfer':
                return `Transfer ${row.transferNumber ?? ''} — ${row.transferType ?? 'STOCK'}`;
            default:
                return '';
        }
    }

    private fmtDate(d: unknown): string {
        if (!d) return '';
        try {
            const dt = d instanceof Date ? d : new Date(d as string);
            return dt.toISOString().slice(0, 10);
        } catch {
            return String(d);
        }
    }

    private buildPreview(
        type: ApprovalSourceType,
        row: Record<string, unknown>,
    ): Record<string, unknown> {
        switch (type) {
            case 'discount':
                return {
                    orderId: row.orderId,
                    type: row.type,
                    value: String(row.value ?? ''),
                    reason: row.reason,
                };
            case 'refund':
                return {
                    orderId: row.orderId,
                    paymentId: row.paymentId,
                    provider: row.provider,
                    amount: String(row.amount ?? ''),
                    reason: row.reason,
                };
            case 'leave_request':
                return {
                    employeeId: row.employeeId,
                    leaveType: row.leaveType,
                    startsAt: this.fmtDate(row.startsAt),
                    endsAt: this.fmtDate(row.endsAt),
                    reason: row.reason,
                };
            case 'shift_swap':
                return {
                    requesterEmployeeId: row.requesterEmployeeId,
                    targetEmployeeId: row.targetEmployeeId,
                    shiftDate: this.fmtDate(row.shiftDate),
                    reason: row.reason,
                };
            case 'vendor_bill':
                return {
                    supplierId: row.supplierId,
                    billNumber: row.billNumber,
                    totalAmount: String(row.totalAmount ?? ''),
                    dueDate: this.fmtDate(row.dueDate),
                };
            case 'inter_branch_transfer':
                return {
                    fromBranchId: row.fromBranchId,
                    toBranchId: row.toBranchId,
                    transferNumber: row.transferNumber,
                    transferType: row.transferType,
                    urgency: row.urgency,
                    rationale: row.rationale,
                };
            default:
                return {};
        }
    }

    private computePriority(
        source: ApprovalSourceMapping,
        row: Record<string, unknown>,
        amount: { value: string } | null,
    ): 'LOW' | 'NORMAL' | 'HIGH' {
        if (source.type === 'inter_branch_transfer') {
            const u = (row.urgency as string | undefined) ?? 'MEDIUM';
            if (u === 'HIGH' || u === 'CRITICAL') return 'HIGH';
            if (u === 'LOW') return 'LOW';
            return 'NORMAL';
        }
        if (amount) {
            const n = Number(amount.value);
            if (Number.isFinite(n)) {
                if (n >= 100000) return 'HIGH';
                if (n >= 10000) return 'NORMAL';
                return 'LOW';
            }
        }
        return 'NORMAL';
    }

    // Cheap per-list memo to avoid re-querying the same branch/user.
    private branchNameCache = new Map<string, string | null>();
    private userNameCache = new Map<string, string | null>();

    private async lookupBranchName(branchId: string): Promise<string | null> {
        if (this.branchNameCache.has(branchId)) return this.branchNameCache.get(branchId)!;
        const b = await this.prisma.branch.findUnique({
            where: { id: branchId },
            select: { name: true },
        });
        const name = b?.name ?? null;
        this.branchNameCache.set(branchId, name);
        return name;
    }

    private async lookupUserName(userId: string): Promise<string | null> {
        if (this.userNameCache.has(userId)) return this.userNameCache.get(userId)!;
        const u = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true, email: true },
        });
        const name = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email : null;
        this.userNameCache.set(userId, name);
        return name;
    }
}
