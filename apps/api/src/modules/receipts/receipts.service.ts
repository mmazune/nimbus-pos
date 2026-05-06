import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
    SendReceiptDto,
    ReprintReceiptDto,
    ReceiptHistoryQueryDto,
    RECEIPT_CHANNELS,
} from './dto';

interface BranchContext {
    organizationId: string;
    branchId: string;
}

interface ActorMeta {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
}

/**
 * Audit actions emitted by the BG4.A receipt surface. The BG2 audit
 * timeline ( /api/audit/timeline ) automatically picks these up because
 * they share the same `AuditLog` table.
 */
export const RECEIPT_AUDIT_ACTIONS = {
    VIEWED: 'RECEIPT_VIEWED',
    REPRINTED: 'RECEIPT_REPRINTED',
    SENT: 'RECEIPT_SENT',
} as const;

/**
 * Order-side audit actions that are part of the receipt lifecycle and
 * therefore included in `GET /api/receipts/:id/history` so cashiers /
 * support can see the full trail (close → reprint → send) in one place.
 */
const ORDER_LIFECYCLE_ACTIONS = new Set<string>([
    'ORDER_PAID_AND_CLOSED',
    'ORDER_AUTO_SETTLED',
    'ORDER_VOIDED',
]);

/**
 * BG4.A — Receipts surface.
 *
 * The Nimbus rebuild has no separate `Receipt` model: a closed Order
 * with its captured Payment[] IS the receipt. This service composes a
 * stable, frontend-grade view over `Order + OrderItem + Payment +
 * Branch + Organization + OrgSettings.receiptFooter` and records every
 * read / reprint / send action to the audit log so the same rows feed
 * both `/api/receipts/:id/history` and the BG2 global audit timeline.
 *
 * Delivery: NO live email/SMS/WhatsApp adapter is wired in this
 * milestone. `POST /api/receipts/:id/send` records the request as a
 * PENDING delivery row inside the audit metadata and returns 202 with
 * `supported: false` + reason `NO_LIVE_DELIVERY_ADAPTER` so the
 * frontend can disable the action honestly.
 */
@Injectable()
export class ReceiptsService {
    private readonly log = new Logger('ReceiptsService');

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ──────────────────────────────────────────────────────────────────
    // Read
    // ──────────────────────────────────────────────────────────────────

    async getReceipt(ctx: BranchContext, receiptId: string, actor: ActorMeta) {
        const order = await this.loadOrderForReceipt(ctx, receiptId);

        const view = await this.buildReceiptView(order);

        // Fire-and-forget audit (read-side; never blocks the response).
        this.audit
            .log({
                actorUserId: actor.userId,
                action: RECEIPT_AUDIT_ACTIONS.VIEWED,
                entityType: 'receipt',
                entityId: order.id,
                metadata: {
                    orgId: ctx.organizationId,
                    branchId: ctx.branchId,
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    orderStatus: order.status,
                },
                ipAddress: actor.ipAddress ?? undefined,
                userAgent: actor.userAgent ?? undefined,
            })
            .catch((err) => this.log.warn(`audit RECEIPT_VIEWED failed: ${err}`));

        return view;
    }

    // ──────────────────────────────────────────────────────────────────
    // Reprint
    // ──────────────────────────────────────────────────────────────────

    async reprintReceipt(
        ctx: BranchContext,
        receiptId: string,
        dto: ReprintReceiptDto,
        actor: ActorMeta,
    ) {
        const order = await this.loadOrderForReceipt(ctx, receiptId);
        if (!this.isPrintable(order.status)) {
            throw new BadRequestException(
                `Receipt for order in status ${order.status} cannot be reprinted (must be CLOSED or VOIDED).`,
            );
        }

        const view = await this.buildReceiptView(order);
        const copies = dto.copies ?? 1;

        await this.audit.log({
            actorUserId: actor.userId,
            action: RECEIPT_AUDIT_ACTIONS.REPRINTED,
            entityType: 'receipt',
            entityId: order.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                orderId: order.id,
                orderNumber: order.orderNumber,
                copies,
                reason: dto.reason ?? null,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: RECEIPT_AUDIT_ACTIONS.REPRINTED,
            receiptId: order.id,
            copies,
            reason: dto.reason ?? null,
            reprintedAt: new Date().toISOString(),
            printable: view,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // Send
    // ──────────────────────────────────────────────────────────────────

    /**
     * Records a delivery REQUEST. Returns a synthetic deliveryId that
     * the audit log row uses as its metadata.deliveryId so the history
     * endpoint can surface per-request status.
     *
     * No live channel is wired today (see service header). The response
     * always carries `status: 'PENDING'` and `supported: false` with
     * `reason: 'NO_LIVE_DELIVERY_ADAPTER'` so the frontend can disable
     * the affordance honestly.
     */
    async sendReceipt(
        ctx: BranchContext,
        receiptId: string,
        dto: SendReceiptDto,
        actor: ActorMeta,
    ) {
        const order = await this.loadOrderForReceipt(ctx, receiptId);
        if (!this.isPrintable(order.status)) {
            throw new BadRequestException(
                `Receipt for order in status ${order.status} cannot be sent (must be CLOSED or VOIDED).`,
            );
        }

        if (!RECEIPT_CHANNELS.includes(dto.channel)) {
            // class-validator should prevent this, but guard defensively.
            throw new BadRequestException(`Unsupported channel: ${dto.channel}`);
        }

        const requestedAt = new Date();
        const deliveryId = `rcpt-dlv-${order.id}-${requestedAt.getTime()}`;

        await this.audit.log({
            actorUserId: actor.userId,
            action: RECEIPT_AUDIT_ACTIONS.SENT,
            entityType: 'receipt',
            entityId: order.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                orderId: order.id,
                orderNumber: order.orderNumber,
                deliveryId,
                channel: dto.channel,
                recipient: this.maskRecipient(dto.recipient),
                locale: dto.locale ?? null,
                note: dto.note ?? null,
                status: 'PENDING',
                supported: false,
                reason: 'NO_LIVE_DELIVERY_ADAPTER',
                requestedAt: requestedAt.toISOString(),
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: RECEIPT_AUDIT_ACTIONS.SENT,
            receiptId: order.id,
            deliveryId,
            channel: dto.channel,
            recipient: this.maskRecipient(dto.recipient),
            status: 'PENDING' as const,
            supported: false as const,
            reason: 'NO_LIVE_DELIVERY_ADAPTER' as const,
            requestedAt: requestedAt.toISOString(),
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // History
    // ──────────────────────────────────────────────────────────────────

    async getReceiptHistory(
        ctx: BranchContext,
        receiptId: string,
        query: ReceiptHistoryQueryDto,
    ) {
        // Make sure the caller is allowed to see this order at all.
        await this.loadOrderForReceipt(ctx, receiptId);

        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 50;
        const skip = (page - 1) * pageSize;

        const where: Prisma.AuditLogWhereInput = {
            OR: [
                { entityType: 'receipt', entityId: receiptId },
                {
                    entityType: 'order',
                    entityId: receiptId,
                    action: { in: Array.from(ORDER_LIFECYCLE_ACTIONS) },
                },
            ],
        };

        const [total, rows] = await this.prisma.$transaction([
            this.prisma.auditLog.count({ where }),
            this.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
            }),
        ]);

        return {
            data: rows.map((r) => ({
                id: r.id,
                action: r.action,
                actorUserId: r.actorUserId,
                entityType: r.entityType,
                entityId: r.entityId,
                metadata: r.metadata ?? null,
                createdAt: r.createdAt.toISOString(),
            })),
            total,
            page,
            pageSize,
            receiptId,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

    private isPrintable(status: string): boolean {
        return status === 'CLOSED' || status === 'VOIDED';
    }

    private maskRecipient(recipient: string): string {
        if (recipient.includes('@')) {
            const [name, domain] = recipient.split('@');
            const head = name.length <= 2 ? name : `${name.slice(0, 2)}***`;
            return `${head}@${domain}`;
        }
        const trimmed = recipient.trim();
        if (trimmed.length <= 4) return trimmed;
        return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
    }

    private async loadOrderForReceipt(ctx: BranchContext, receiptId: string) {
        const order = await this.prisma.order.findFirst({
            where: {
                id: receiptId,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
        });
        if (!order) throw new NotFoundException('Receipt not found');
        return order;
    }

    private async buildReceiptView(order: {
        id: string;
        orgId: string;
        branchId: string;
        userId: string;
        tableId: string | null;
        orderNumber: string;
        status: string;
        serviceType: string;
        subtotal: Decimal;
        tax: Decimal;
        discount: Decimal;
        total: Decimal;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    }) {
        // NOTE: queries are serialized rather than Promise.all'd to avoid
        // exhausting the Prisma pool under concurrent receipt traffic. Ten
        // small reads in series complete in well under 1s in practice and
        // mirror the BG2 UnifiedApprovalsService pattern.
        const items = await this.prisma.orderItem.findMany({
            where: { orderId: order.id },
            orderBy: { createdAt: 'asc' },
            include: {
                menuItem: { select: { id: true, name: true, sku: true } },
                menuItemServing: { select: { id: true, label: true } },
            },
        });
        const payments = await this.prisma.payment.findMany({
            where: { orderId: order.id },
            orderBy: { postedAt: 'asc' },
        });
        const branch = await this.prisma.branch.findUnique({ where: { id: order.branchId } });
        const org = await this.prisma.organization.findUnique({ where: { id: order.orgId } });
        const settings = await this.prisma.orgSettings.findUnique({ where: { orgId: order.orgId } });
        const table = order.tableId
            ? await this.prisma.table.findUnique({ where: { id: order.tableId } })
            : null;
        const server = await this.prisma.user.findUnique({
            where: { id: order.userId },
            select: { id: true, firstName: true, lastName: true, email: true },
        });
        const viewedCount = await this.prisma.auditLog.count({
            where: { entityType: 'receipt', entityId: order.id, action: RECEIPT_AUDIT_ACTIONS.VIEWED },
        });
        const sentCount = await this.prisma.auditLog.count({
            where: { entityType: 'receipt', entityId: order.id, action: RECEIPT_AUDIT_ACTIONS.SENT },
        });
        const reprintCount = await this.prisma.auditLog.count({
            where: { entityType: 'receipt', entityId: order.id, action: RECEIPT_AUDIT_ACTIONS.REPRINTED },
        });

        const completedTotal = payments
            .filter((p) => p.status === 'COMPLETED')
            .reduce((acc, p) => acc.add(new Decimal(p.amount)), new Decimal(0));
        const outstanding = new Decimal(order.total).sub(completedTotal);

        return {
            receiptId: order.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            serviceType: order.serviceType,
            organization: org
                ? { id: org.id, name: org.name, slug: org.slug }
                : null,
            branch: branch
                ? {
                    id: branch.id,
                    name: branch.name,
                    code: branch.code,
                    currencyCode: branch.currencyCode,
                    timezone: branch.timezone,
                }
                : null,
            table: table ? { id: table.id, label: table.label } : null,
            server: server
                ? {
                    id: server.id,
                    fullName: [server.firstName, server.lastName].filter(Boolean).join(' '),
                    email: server.email,
                }
                : null,
            totals: {
                subtotal: order.subtotal.toFixed(2),
                tax: order.tax.toFixed(2),
                discount: order.discount.toFixed(2),
                total: order.total.toFixed(2),
                paid: completedTotal.toFixed(2),
                outstanding: outstanding.lt(0) ? '0.00' : outstanding.toFixed(2),
                currencyCode: branch?.currencyCode ?? settings?.currency ?? 'USD',
            },
            items: items.map((it) => ({
                id: it.id,
                menuItemId: it.menuItemId,
                name: it.menuItem?.name ?? null,
                sku: it.menuItem?.sku ?? null,
                serving: it.menuItemServing?.label ?? null,
                quantity: it.quantity,
                unitPrice: it.price.toFixed(2),
                lineTotal: it.subtotal.toFixed(2),
                notes: it.notes ?? null,
            })),
            payments: payments.map((p) => ({
                id: p.id,
                method: p.method,
                status: p.status,
                amount: p.amount.toFixed(2),
                transactionId: p.transactionId ?? null,
                postedAt: p.postedAt.toISOString(),
            })),
            footer: settings?.receiptFooter ?? null,
            timestamps: {
                openedAt: order.createdAt.toISOString(),
                updatedAt: order.updatedAt.toISOString(),
            },
            history: {
                viewedCount,
                reprintCount,
                sentCount,
            },
        };
    }
}
