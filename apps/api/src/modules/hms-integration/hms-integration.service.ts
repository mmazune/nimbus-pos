import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import {
    HmsListOrdersDto,
    HmsListPaymentsDto,
    HmsListReservationsDto,
    HmsListEventsDto,
    HmsListInventoryDto,
    HmsListMenuDto,
    HmsListShiftsDto,
    HmsListAccessLogsDto,
    HmsPaginationDto,
} from './dto';

/**
 * BG7 — HMS Integration read façade.
 *
 * Direct Prisma reads scoped to the calling API key's `(orgId, branchId?)`
 * pair. If `branchId` is null on the key the caller sees ALL branches in the
 * org; if `branchId` is set, results are restricted to that single branch.
 *
 * NEVER mutates state. NEVER returns hashed credentials, PINs, password
 * hashes, signing secrets, raw provider tokens, or webhook secrets. The
 * DTO selects below explicitly enumerate the fields exposed.
 */
@Injectable()
export class HmsIntegrationService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Resolve effective scope ──────────────────────────────────

    private effectiveBranchFilter(
        keyBranchId: string | null,
        requestedBranchId?: string,
    ): string | undefined {
        // Branch-scoped key: ignore caller's request, force keyBranchId.
        if (keyBranchId) return keyBranchId;
        // Org-scoped key: honour optional ?branchId= filter.
        return requestedBranchId;
    }

    private windowFilter(q: HmsPaginationDto) {
        const where: { gte?: Date; lte?: Date } = {};
        if (q.from) where.gte = new Date(q.from);
        if (q.to) where.lte = new Date(q.to);
        return Object.keys(where).length ? where : undefined;
    }

    // ── Org / Branch overview ────────────────────────────────────

    async getOrganization(orgId: string, keyBranchId: string | null) {
        const org = await this.prisma.organization.findUniqueOrThrow({
            where: { id: orgId },
            select: {
                id: true,
                name: true,
                slug: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        const branches = await this.prisma.branch.findMany({
            where: {
                organizationId: orgId,
                ...(keyBranchId && { id: keyBranchId }),
            },
            select: {
                id: true,
                name: true,
                code: true,
                slug: true,
                timezone: true,
                currencyCode: true,
                address: true,
                phone: true,
                email: true,
                status: true,
            },
            orderBy: { name: 'asc' },
        });

        return {
            organization: org,
            branchScope: keyBranchId ? 'BRANCH' : 'ORGANIZATION',
            branches,
        };
    }

    async listBranches(orgId: string, keyBranchId: string | null) {
        return this.prisma.branch.findMany({
            where: {
                organizationId: orgId,
                ...(keyBranchId && { id: keyBranchId }),
            },
            select: {
                id: true,
                name: true,
                code: true,
                slug: true,
                timezone: true,
                currencyCode: true,
                status: true,
                createdAt: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    // ── Sales / Orders ───────────────────────────────────────────

    async listOrders(orgId: string, keyBranchId: string | null, q: HmsListOrdersDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const createdAt = this.windowFilter(q);
        const where = {
            orgId,
            ...(branchId && { branchId }),
            ...(q.status && { status: q.status as never }),
            ...(q.serviceType && { serviceType: q.serviceType as never }),
            ...(createdAt && { createdAt }),
        };

        const [items, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
                select: {
                    id: true,
                    orgId: true,
                    branchId: true,
                    orderNumber: true,
                    status: true,
                    serviceType: true,
                    subtotal: true,
                    tax: true,
                    discount: true,
                    total: true,
                    notes: true,
                    createdAt: true,
                    updatedAt: true,
                    table: { select: { id: true, label: true } },
                    user: { select: { id: true, firstName: true, lastName: true } },
                },
            }),
            this.prisma.order.count({ where }),
        ]);

        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    async getOrder(orgId: string, keyBranchId: string | null, id: string) {
        const order = await this.prisma.order.findFirst({
            where: { id, orgId, ...(keyBranchId && { branchId: keyBranchId }) },
            include: {
                items: {
                    select: {
                        id: true,
                        menuItemId: true,
                        quantity: true,
                        price: true,
                        subtotal: true,
                        notes: true,
                    },
                },
                payments: {
                    select: {
                        id: true,
                        amount: true,
                        method: true,
                        status: true,
                        transactionId: true,
                        externalTransactionId: true,
                        createdAt: true,
                    },
                },
                discounts: {
                    select: { id: true, type: true, value: true, reason: true, status: true, createdAt: true },
                },
                refunds: {
                    select: { id: true, amount: true, reason: true, status: true, createdAt: true },
                },
            },
        });
        if (!order) throw new NotFoundException('Order not found in scope');
        return order;
    }

    // ── Payments ─────────────────────────────────────────────────

    async listPayments(orgId: string, keyBranchId: string | null, q: HmsListPaymentsDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const createdAt = this.windowFilter(q);
        const where = {
            orgId,
            ...(branchId && { branchId }),
            ...(q.method && { method: q.method as never }),
            ...(q.status && { status: q.status as never }),
            ...(createdAt && { createdAt }),
        };
        const [items, total] = await Promise.all([
            this.prisma.payment.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
                select: {
                    id: true,
                    orderId: true,
                    branchId: true,
                    amount: true,
                    method: true,
                    status: true,
                    transactionId: true,
                    externalTransactionId: true,
                    postedAt: true,
                    createdAt: true,
                },
            }),
            this.prisma.payment.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    // ── Refunds ──────────────────────────────────────────────────

    async listRefunds(orgId: string, keyBranchId: string | null, q: HmsPaginationDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const createdAt = this.windowFilter(q);
        const where = {
            orgId,
            ...(branchId && { branchId }),
            ...(createdAt && { createdAt }),
        };
        const [items, total] = await Promise.all([
            this.prisma.refund.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.refund.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    // ── Sales summary ────────────────────────────────────────────

    async salesSummary(orgId: string, keyBranchId: string | null, q: HmsPaginationDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const createdAt = this.windowFilter(q) ?? {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        };
        const where = {
            orgId,
            ...(branchId && { branchId }),
            createdAt,
        };
        const [agg, count] = await Promise.all([
            this.prisma.order.aggregate({
                where: { ...where, status: 'CLOSED' as never },
                _sum: { subtotal: true, tax: true, discount: true, total: true },
            }),
            this.prisma.order.count({ where: { ...where, status: 'CLOSED' as never } }),
        ]);
        return {
            window: { from: createdAt.gte, to: (createdAt as { lte?: Date }).lte ?? null },
            scope: branchId ?? 'ORGANIZATION',
            closedOrders: count,
            totals: {
                subtotal: agg._sum.subtotal ?? 0,
                tax: agg._sum.tax ?? 0,
                discount: agg._sum.discount ?? 0,
                grandTotal: agg._sum.total ?? 0,
            },
        };
    }

    // ── Reservations + Events (HMS-relevant) ─────────────────────

    async listReservations(
        orgId: string,
        keyBranchId: string | null,
        q: HmsListReservationsDto,
    ) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const createdAt = this.windowFilter(q);
        const where = {
            orgId,
            ...(branchId && { branchId }),
            ...(q.status && { status: q.status as never }),
            ...(createdAt && { createdAt }),
        };
        const [items, total] = await Promise.all([
            this.prisma.reservation.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.reservation.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    async listEvents(orgId: string, keyBranchId: string | null, q: HmsListEventsDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const where = {
            orgId,
            ...(branchId && { branchId }),
            ...(q.status && { status: q.status as never }),
        };
        const [items, total] = await Promise.all([
            this.prisma.event.findMany({
                where,
                orderBy: { startsAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.event.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    async listEventBookings(orgId: string, keyBranchId: string | null, q: HmsPaginationDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const where = {
            orgId,
            ...(branchId && { branchId }),
        };
        const [items, total] = await Promise.all([
            this.prisma.eventBooking.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.eventBooking.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    // ── Menu / Inventory ─────────────────────────────────────────

    async listMenuItems(orgId: string, keyBranchId: string | null, q: HmsListMenuDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const where = {
            orgId,
            ...(branchId && { branchId }),
            ...(q.categoryId && { categoryId: q.categoryId }),
        };
        const [items, total] = await Promise.all([
            this.prisma.menuItem.findMany({
                where,
                orderBy: { name: 'asc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.menuItem.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    async listInventory(orgId: string, keyBranchId: string | null, q: HmsListInventoryDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const where = {
            orgId,
            ...(branchId && { branchId }),
        };
        const [items, total] = await Promise.all([
            this.prisma.inventoryItem.findMany({
                where,
                orderBy: { name: 'asc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.inventoryItem.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    // ── Shifts (close/Z-report visibility) ───────────────────────

    async listShifts(orgId: string, keyBranchId: string | null, q: HmsListShiftsDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const openedAt = this.windowFilter(q);
        const where = {
            orgId,
            ...(branchId && { branchId }),
            ...(q.status && { status: q.status as never }),
            ...(openedAt && { openedAt }),
        };
        const [items, total] = await Promise.all([
            this.prisma.shift.findMany({
                where,
                orderBy: { openedAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.shift.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    // ── Accounting (chart of accounts + posted journals) ─────────

    async listAccounts(orgId: string, _keyBranchId: string | null, q: HmsPaginationDto) {
        const where = { orgId };
        const [items, total] = await Promise.all([
            this.prisma.account.findMany({
                where,
                orderBy: { code: 'asc' },
                take: q.limit ?? 100,
                skip: q.skip ?? 0,
            }),
            this.prisma.account.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 100, skip: q.skip ?? 0 };
    }

    async listInvoices(orgId: string, keyBranchId: string | null, q: HmsPaginationDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const createdAt = this.windowFilter(q);
        const where = {
            orgId,
            ...(branchId && { branchId }),
            ...(createdAt && { createdAt }),
        };
        const [items, total] = await Promise.all([
            this.prisma.invoice.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.invoice.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    async listVendorBills(orgId: string, keyBranchId: string | null, q: HmsPaginationDto) {
        const branchId = this.effectiveBranchFilter(keyBranchId, q.branchId);
        const createdAt = this.windowFilter(q);
        const where = {
            orgId,
            ...(branchId && { branchId }),
            ...(createdAt && { createdAt }),
        };
        const [items, total] = await Promise.all([
            this.prisma.vendorBill.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.vendorBill.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    // ── Self / introspection ─────────────────────────────────────

    async whoAmI(apiKeyId: string) {
        const k = await this.prisma.apiKey.findUniqueOrThrow({
            where: { id: apiKeyId },
            select: {
                id: true,
                orgId: true,
                branchId: true,
                name: true,
                keyPrefix: true,
                status: true,
                scopes: true,
                lastUsedAt: true,
                lastUsedIp: true,
                expiresAt: true,
                createdAt: true,
                organization: { select: { id: true, name: true, slug: true } },
            },
        });
        return {
            ...k,
            scope: k.branchId ? 'BRANCH' : 'ORGANIZATION',
            grantedPermissions: ['hms:read:*', ...(k.scopes ?? [])],
        };
    }

    async listAccessLogs(
        orgId: string,
        apiKeyId: string,
        keyBranchId: string | null,
        q: HmsListAccessLogsDto,
    ) {
        const where = {
            orgId,
            apiKeyId,
            ...(keyBranchId && { branchId: keyBranchId }),
            ...(q.statusCode && { statusCode: q.statusCode }),
        };
        const [items, total] = await Promise.all([
            this.prisma.integrationAccessLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: q.limit ?? 50,
                skip: q.skip ?? 0,
            }),
            this.prisma.integrationAccessLog.count({ where }),
        ]);
        return { items, total, limit: q.limit ?? 50, skip: q.skip ?? 0 };
    }

    // ── Access-log writer (called by interceptor) ────────────────

    async recordAccess(input: {
        orgId: string;
        apiKeyId: string;
        branchId: string | null;
        routeMethod: string;
        routePath: string;
        statusCode: number;
        durationMs: number;
        ipAddress: string | null;
        userAgent: string | null;
        requestId: string | null;
        metadata?: Record<string, unknown>;
    }) {
        try {
            await this.prisma.integrationAccessLog.create({
                data: {
                    orgId: input.orgId,
                    apiKeyId: input.apiKeyId,
                    branchId: input.branchId,
                    routeMethod: input.routeMethod,
                    routePath: input.routePath,
                    statusCode: input.statusCode,
                    durationMs: input.durationMs,
                    ipAddress: input.ipAddress,
                    userAgent: input.userAgent,
                    requestId: input.requestId,
                    metadata: input.metadata as never,
                },
            });
        } catch {
            // Best-effort journal — never block a successful read on logging failure.
        }
    }
}
