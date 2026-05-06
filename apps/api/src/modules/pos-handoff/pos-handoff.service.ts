import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
    SplitBillDto,
    SplitBillMode,
    SplitItemsDto,
    MergeOrdersDto,
    TransferTableDto,
    TransferServerDto,
    MoveOrderItemsDto,
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
 * BG4.B — POS Order Handoff audit actions. Emitted on `entityType:'order'`
 * so they automatically surface in the BG2 unified audit timeline at
 * `/api/audit/timeline`.
 */
export const HANDOFF_AUDIT_ACTIONS = {
    SPLIT_BILL: 'ORDER_SPLIT_BILL',
    SPLIT_ITEMS: 'ORDER_SPLIT_ITEMS',
    SPLIT_CHILD_CREATED: 'ORDER_SPLIT_CHILD_CREATED',
    MERGED: 'ORDER_MERGED',
    TRANSFERRED_TABLE: 'ORDER_TRANSFERRED_TABLE',
    TRANSFERRED_SERVER: 'ORDER_TRANSFERRED_SERVER',
    ITEMS_MOVED: 'ORDER_ITEMS_MOVED',
} as const;

/**
 * Order statuses where handoff operations are permitted. Once an order
 * is CLOSED or VOIDED its physical state is finalised — no further
 * structural mutation is allowed and the endpoint returns 409.
 */
const HANDOFF_OPEN_STATUSES = new Set<OrderStatus>([
    'NEW',
    'SENT',
    'IN_KITCHEN',
    'READY',
    'SERVED',
] as OrderStatus[]);

/**
 * Split-bill is permitted only after items are physically present on the
 * order. SERVED is allowed because partial-pay collection often happens
 * after the meal has been delivered.
 */
const SPLIT_BILL_OPEN_STATUSES = new Set<OrderStatus>([
    'NEW',
    'SENT',
    'IN_KITCHEN',
    'READY',
    'SERVED',
] as OrderStatus[]);

const round2 = (d: Decimal): Decimal => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/**
 * BG4.B — POS Order Handoff service.
 *
 * Surfaces six operational endpoints for the POS frontend:
 *   1. POST /api/pos/orders/:id/split-bill        — non-physical bill split
 *   2. POST /api/pos/orders/:id/split-items       — physical split into child order
 *   3. POST /api/pos/orders/merge                 — absorb source into target
 *   4. POST /api/pos/orders/:id/transfer-table    — change Order.tableId
 *   5. POST /api/pos/orders/:id/transfer-server   — change Order.userId
 *   6. POST /api/pos/orders/:id/move-items        — move items to existing order
 *
 * KDS strategy (uniform for split-items / merge / move-items):
 *   - Existing KDS tickets that already fired against the source order
 *     are NOT republished. Kitchen completes what was already prepared.
 *   - Affected tickets get a metadata marker (`bg4bSuperseded` or
 *     `bg4bMergedInto` / `bg4bMovedTo`) so kitchen / support can see
 *     the cross-order relationship.
 *   - The destination order (split child or merge target) must be
 *     re-sent explicitly via POST /api/pos/orders/:id/send by the
 *     operator if items still need preparation. This avoids any
 *     possibility of double-firing the same dish.
 *
 * All write paths are wrapped at the controller via Bg3ReliabilityService
 * with `category: null` (handoff is operational POS, not billing /
 * accounting / inventory). `idempotencyMode: 'optional'`.
 */
@Injectable()
export class PosHandoffService {
    private readonly log = new Logger('PosHandoffService');

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ──────────────────────────────────────────────────────────────────
    // Common helpers
    // ──────────────────────────────────────────────────────────────────

    private async loadOpenOrder(
        ctx: BranchContext,
        orderId: string,
        opts: { allowedStatuses?: Set<OrderStatus> } = {},
    ) {
        const allowed = opts.allowedStatuses ?? HANDOFF_OPEN_STATUSES;
        const order = await this.prisma.order.findFirst({
            where: {
                id: orderId,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            include: { items: true },
        });
        if (!order) throw new NotFoundException('Order not found in this branch');
        if (!allowed.has(order.status)) {
            throw new ConflictException({
                code: 'ORDER_NOT_OPEN_FOR_HANDOFF',
                message: `Order is in ${order.status} state; handoff requires one of ${[...allowed].join(', ')}`,
                orderId: order.id,
                status: order.status,
            });
        }
        return order;
    }

    private recomputeTotals(items: { price: Decimal | string; quantity: number }[]) {
        let subtotal = new Decimal(0);
        for (const it of items) {
            subtotal = subtotal.add(new Decimal(it.price).mul(it.quantity));
        }
        return round2(subtotal);
    }

    /**
     * Recomputes `subtotal` and `total` for an order from its current
     * items. Tax and discount are preserved (they are aggregate fields
     * applied by other modules); only the line subtotal is recomputed.
     * Total is `subtotal + tax - discount`.
     *
     * Per-row OrderItem.subtotal is left to the calling code (split /
     * move loops always set it when they decrement or create rows). We
     * deliberately avoid re-iterating every row here so the enclosing
     * Prisma interactive transaction stays well under its 5s default
     * window even on remote pooled Postgres.
     */
    private async recomputeAndSaveOrderTotals(
        tx: Prisma.TransactionClient,
        orderId: string,
    ) {
        const [items, order] = await Promise.all([
            tx.orderItem.findMany({
                where: { orderId },
                select: { price: true, quantity: true },
            }),
            tx.order.findUnique({
                where: { id: orderId },
                select: { tax: true, discount: true },
            }),
        ]);
        if (!order) return;
        const subtotal = this.recomputeTotals(items);
        const total = round2(
            subtotal.add(new Decimal(order.tax)).sub(new Decimal(order.discount)),
        );
        await tx.order.update({
            where: { id: orderId },
            data: {
                subtotal: subtotal.toFixed(2),
                total: total.toFixed(2),
            },
        });
        return { subtotal, total };
    }

    private async computeOutstanding(orderId: string): Promise<Decimal> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { total: true },
        });
        if (!order) return new Decimal(0);
        const payments = await this.prisma.payment.findMany({
            where: { orderId, status: 'COMPLETED' },
            select: { amount: true },
        });
        const paid = payments.reduce(
            (s, p) => s.add(new Decimal(p.amount)),
            new Decimal(0),
        );
        const out = new Decimal(order.total).sub(paid);
        return out.lt(0) ? new Decimal(0) : round2(out);
    }

    // ──────────────────────────────────────────────────────────────────
    // A) Split bill — non-physical allocation groups stored on metadata
    // ──────────────────────────────────────────────────────────────────

    async splitBill(ctx: BranchContext, orderId: string, dto: SplitBillDto, actor: ActorMeta) {
        const order = await this.loadOpenOrder(ctx, orderId, {
            allowedStatuses: SPLIT_BILL_OPEN_STATUSES,
        });

        const total = round2(new Decimal(order.total));
        let groups: { groupId: string; label: string; amount: string }[] = [];

        if (dto.mode === SplitBillMode.EQUAL) {
            const count = dto.count ?? 0;
            if (count < 2) {
                throw new BadRequestException(
                    'EQUAL split requires count >= 2',
                );
            }
            // Distribute total across `count` groups, fixing the cent rounding
            // residual on the LAST group so the sum equals total exactly.
            const base = total.div(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
            let allocated = new Decimal(0);
            for (let i = 0; i < count; i++) {
                const isLast = i === count - 1;
                const amount = isLast ? round2(total.sub(allocated)) : base;
                allocated = allocated.add(amount);
                groups.push({
                    groupId: `g${i + 1}`,
                    label: `Person ${i + 1}`,
                    amount: amount.toFixed(2),
                });
            }
        } else {
            // CUSTOM
            const inputGroups = dto.groups ?? [];
            if (inputGroups.length < 2) {
                throw new BadRequestException(
                    'CUSTOM split requires at least 2 groups',
                );
            }
            let sum = new Decimal(0);
            groups = inputGroups.map((g, i) => {
                if (!g.amount) {
                    throw new BadRequestException(
                        `groups[${i}].amount is required for CUSTOM split`,
                    );
                }
                const amt = round2(new Decimal(g.amount));
                if (amt.lte(0)) {
                    throw new BadRequestException(
                        `groups[${i}].amount must be > 0`,
                    );
                }
                sum = sum.add(amt);
                return {
                    groupId: `g${i + 1}`,
                    label: g.label?.trim() || `Person ${i + 1}`,
                    amount: amt.toFixed(2),
                };
            });
            if (!sum.eq(total)) {
                throw new BadRequestException({
                    code: 'SPLIT_BILL_AMOUNT_MISMATCH',
                    message: `Sum of split groups (${sum.toFixed(2)}) must equal order total (${total.toFixed(2)})`,
                    sum: sum.toFixed(2),
                    total: total.toFixed(2),
                });
            }
        }

        const allocated = groups.reduce(
            (s, g) => s.add(new Decimal(g.amount)),
            new Decimal(0),
        );
        const outstanding = await this.computeOutstanding(orderId);

        // Persist groups onto Order.metadata.splitBill so subsequent
        // payment captures can correlate.
        const existingMeta =
            (order.metadata as Prisma.JsonObject | null | undefined) ?? {};
        const newMeta: Prisma.JsonObject = {
            ...existingMeta,
            splitBill: {
                mode: dto.mode,
                groups,
                total: total.toFixed(2),
                allocated: round2(allocated).toFixed(2),
                createdAt: new Date().toISOString(),
                createdBy: actor.userId,
                reason: dto.reason ?? null,
            },
        };
        await this.prisma.order.update({
            where: { id: orderId },
            data: { metadata: newMeta },
        });

        await this.audit.log({
            actorUserId: actor.userId,
            action: HANDOFF_AUDIT_ACTIONS.SPLIT_BILL,
            entityType: 'order',
            entityId: orderId,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                orderNumber: order.orderNumber,
                mode: dto.mode,
                groupCount: groups.length,
                total: total.toFixed(2),
                allocated: round2(allocated).toFixed(2),
                reason: dto.reason ?? null,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: HANDOFF_AUDIT_ACTIONS.SPLIT_BILL,
            orderId,
            splitMode: dto.mode,
            splitGroups: groups,
            totals: {
                subtotal: order.subtotal.toString(),
                tax: order.tax.toString(),
                discount: order.discount.toString(),
                total: total.toFixed(2),
            },
            amountAllocated: round2(allocated).toFixed(2),
            amountRemaining: round2(total.sub(allocated)).toFixed(2),
            outstandingBalance: outstanding.toFixed(2),
            note: 'Split-bill is non-physical: order, items, taxes and KDS tickets are unchanged. Use existing payment endpoints to collect each group via partial payments.',
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // B) Split items — physical split into a NEW child order
    // ──────────────────────────────────────────────────────────────────

    private async generateChildOrderNumber(
        tx: Prisma.TransactionClient,
        parentOrderNumber: string,
        parentId: string,
    ): Promise<string> {
        const existingChildCount = await tx.order.count({
            where: { splitFromOrderId: parentId },
        });
        // ${parent}-S1, -S2, ... — keeps split lineage visible at a glance
        // and never collides with the existing ORD-NNNNNN sequence used
        // by OrdersService.generateOrderNumber.
        return `${parentOrderNumber}-S${existingChildCount + 1}`;
    }

    async splitItems(ctx: BranchContext, orderId: string, dto: SplitItemsDto, actor: ActorMeta) {
        const source = await this.loadOpenOrder(ctx, orderId);

        // Validate selection up front
        const itemMap = new Map(source.items.map((i) => [i.id, i]));
        for (const sel of dto.items) {
            const it = itemMap.get(sel.orderItemId);
            if (!it) {
                throw new BadRequestException(
                    `OrderItem ${sel.orderItemId} not found on source order`,
                );
            }
            if (sel.quantity > it.quantity) {
                throw new BadRequestException({
                    code: 'SPLIT_QUANTITY_EXCEEDS_SOURCE',
                    message: `Requested quantity ${sel.quantity} exceeds available ${it.quantity} for ${sel.orderItemId}`,
                    orderItemId: sel.orderItemId,
                    requested: sel.quantity,
                    available: it.quantity,
                });
            }
        }

        if (dto.targetTableId) {
            const table = await this.prisma.table.findFirst({
                where: {
                    id: dto.targetTableId,
                    branchId: ctx.branchId,
                    orgId: ctx.organizationId,
                    isActive: true,
                },
            });
            if (!table) throw new NotFoundException('Target table not found in this branch');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const childOrderNumber = await this.generateChildOrderNumber(
                tx,
                source.orderNumber,
                source.id,
            );

            const child = await tx.order.create({
                data: {
                    orgId: ctx.organizationId,
                    branchId: ctx.branchId,
                    userId: source.userId,
                    tableId: dto.targetTableId ?? source.tableId ?? null,
                    orderNumber: childOrderNumber,
                    serviceType: source.serviceType,
                    status: 'NEW',
                    splitFromOrderId: source.id,
                    notes: dto.notes ?? null,
                    metadata: {
                        bg4bSplit: {
                            from: source.id,
                            fromOrderNumber: source.orderNumber,
                            createdAt: new Date().toISOString(),
                            createdBy: actor.userId,
                            reason: dto.reason ?? null,
                        },
                    } as Prisma.InputJsonValue,
                    // Tax / discount intentionally start at 0 — they are
                    // recomputed by downstream pricing modules when the
                    // child is finalised.
                },
            });

            const movedSummaries: {
                sourceItemId: string;
                childItemId: string;
                quantity: number;
            }[] = [];

            for (const sel of dto.items) {
                const it = itemMap.get(sel.orderItemId)!;
                const moveQty = sel.quantity;
                const remaining = it.quantity - moveQty;
                const unitPrice = new Decimal(it.price);
                const movedSubtotal = round2(unitPrice.mul(moveQty));

                if (remaining === 0) {
                    // Move the whole row by reparenting it.
                    const moved = await tx.orderItem.update({
                        where: { id: it.id },
                        data: { orderId: child.id },
                    });
                    movedSummaries.push({
                        sourceItemId: it.id,
                        childItemId: moved.id,
                        quantity: moveQty,
                    });
                } else {
                    // Decrement source, create new child row.
                    await tx.orderItem.update({
                        where: { id: it.id },
                        data: {
                            quantity: remaining,
                            subtotal: round2(unitPrice.mul(remaining)).toFixed(2),
                        },
                    });
                    const childItem = await tx.orderItem.create({
                        data: {
                            orderId: child.id,
                            menuItemId: it.menuItemId,
                            menuItemServingId: it.menuItemServingId ?? null,
                            quantity: moveQty,
                            price: unitPrice.toFixed(2),
                            subtotal: movedSubtotal.toFixed(2),
                            notes: it.notes ?? null,
                            metadata: it.metadata
                                ? (it.metadata as Prisma.InputJsonValue)
                                : Prisma.JsonNull,
                            costUnit: it.costUnit ?? null,
                            costTotal: it.costUnit
                                ? round2(new Decimal(it.costUnit).mul(moveQty)).toFixed(2)
                                : null,
                        },
                    });
                    movedSummaries.push({
                        sourceItemId: it.id,
                        childItemId: childItem.id,
                        quantity: moveQty,
                    });
                }
            }

            // Mark any KDS tickets on the source as superseded for traceability.
            // We do NOT republish; kitchen completes what was already fired.
            const affectedTickets = await tx.kdsTicket.findMany({
                where: { orderId: source.id },
            });
            for (const t of affectedTickets) {
                const tMeta = (t.metadata as Prisma.JsonObject | null) ?? {};
                await tx.kdsTicket.update({
                    where: { id: t.id },
                    data: {
                        metadata: {
                            ...tMeta,
                            bg4bSupersededBy: child.id,
                            bg4bSupersededAt: new Date().toISOString(),
                        } as Prisma.InputJsonValue,
                    },
                });
            }

            await this.recomputeAndSaveOrderTotals(tx, source.id);
            await this.recomputeAndSaveOrderTotals(tx, child.id);

            return { child, movedSummaries };
        }, { timeout: 20000, maxWait: 10000 });

        // Audit (outside tx — same pattern as OrdersService)
        await this.audit.log({
            actorUserId: actor.userId,
            action: HANDOFF_AUDIT_ACTIONS.SPLIT_ITEMS,
            entityType: 'order',
            entityId: source.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                sourceOrderId: source.id,
                sourceOrderNumber: source.orderNumber,
                childOrderId: result.child.id,
                childOrderNumber: result.child.orderNumber,
                itemCount: result.movedSummaries.length,
                totalQuantityMoved: result.movedSummaries.reduce(
                    (s, m) => s + m.quantity,
                    0,
                ),
                reason: actor && (dto.reason ?? null),
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });
        await this.audit.log({
            actorUserId: actor.userId,
            action: HANDOFF_AUDIT_ACTIONS.SPLIT_CHILD_CREATED,
            entityType: 'order',
            entityId: result.child.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                splitFromOrderId: source.id,
                splitFromOrderNumber: source.orderNumber,
                orderNumber: result.child.orderNumber,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        const refreshedSource = await this.prisma.order.findUnique({
            where: { id: source.id },
            select: { id: true, orderNumber: true, status: true, subtotal: true, tax: true, discount: true, total: true },
        });
        const refreshedChild = await this.prisma.order.findUnique({
            where: { id: result.child.id },
            include: { items: true },
        });

        return {
            ok: true,
            action: HANDOFF_AUDIT_ACTIONS.SPLIT_ITEMS,
            sourceOrder: refreshedSource,
            childOrder: refreshedChild,
            movedItems: result.movedSummaries,
            kds: {
                strategy: 'PRESERVE_AND_MARK_SUPERSEDED',
                note: 'Existing KDS tickets on the source remain in place (kitchen completes what was already fired). The child order is created in NEW status and must be explicitly re-sent via POST /api/pos/orders/:id/send if items still require preparation.',
            },
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // C) Merge two orders — source becomes VOIDED, items absorbed by target
    // ──────────────────────────────────────────────────────────────────

    async mergeOrders(ctx: BranchContext, dto: MergeOrdersDto, actor: ActorMeta) {
        if (dto.sourceOrderId === dto.targetOrderId) {
            throw new BadRequestException('sourceOrderId and targetOrderId must differ');
        }

        const source = await this.loadOpenOrder(ctx, dto.sourceOrderId);
        const target = await this.loadOpenOrder(ctx, dto.targetOrderId);

        // Block if source has any captured payment — refunds must be
        // processed via the refunds module first.
        const sourcePaymentCount = await this.prisma.payment.count({
            where: { orderId: source.id, status: { in: ['COMPLETED', 'PENDING'] } },
        });
        if (sourcePaymentCount > 0) {
            throw new ConflictException({
                code: 'MERGE_SOURCE_HAS_PAYMENTS',
                message: 'Source order has payments; resolve via refunds before merging',
                sourceOrderId: source.id,
                paymentCount: sourcePaymentCount,
            });
        }

        const movedItemIds: string[] = [];
        const movedSummary = {
            itemRowsMoved: 0,
            totalQuantityMoved: 0,
        };

        await this.prisma.$transaction(async (tx) => {
            for (const it of source.items) {
                const moved = await tx.orderItem.update({
                    where: { id: it.id },
                    data: { orderId: target.id },
                });
                movedItemIds.push(moved.id);
                movedSummary.itemRowsMoved += 1;
                movedSummary.totalQuantityMoved += it.quantity;
            }

            // Mark any source-side KDS tickets as merged-into for traceability.
            const sourceTickets = await tx.kdsTicket.findMany({
                where: { orderId: source.id },
            });
            for (const t of sourceTickets) {
                const tMeta = (t.metadata as Prisma.JsonObject | null) ?? {};
                await tx.kdsTicket.update({
                    where: { id: t.id },
                    data: {
                        metadata: {
                            ...tMeta,
                            bg4bMergedInto: target.id,
                            bg4bMergedAt: new Date().toISOString(),
                        } as Prisma.InputJsonValue,
                    },
                });
            }

            await this.recomputeAndSaveOrderTotals(tx, target.id);
            await this.recomputeAndSaveOrderTotals(tx, source.id);

            await tx.order.update({
                where: { id: source.id },
                data: {
                    status: 'VOIDED',
                    mergedIntoOrderId: target.id,
                    metadata: {
                        ...((source.metadata as Prisma.JsonObject | null) ?? {}),
                        bg4bMerge: {
                            mergedInto: target.id,
                            mergedIntoOrderNumber: target.orderNumber,
                            mergedAt: new Date().toISOString(),
                            mergedBy: actor.userId,
                            reason: dto.reason ?? null,
                        },
                    } as Prisma.InputJsonValue,
                },
            });
        }, { timeout: 20000, maxWait: 10000 });
        await this.audit.log({
            actorUserId: actor.userId,
            action: HANDOFF_AUDIT_ACTIONS.MERGED,
            entityType: 'order',
            entityId: source.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                role: 'source',
                sourceOrderId: source.id,
                sourceOrderNumber: source.orderNumber,
                targetOrderId: target.id,
                targetOrderNumber: target.orderNumber,
                itemRowsMoved: movedSummary.itemRowsMoved,
                totalQuantityMoved: movedSummary.totalQuantityMoved,
                reason: dto.reason ?? null,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });
        await this.audit.log({
            actorUserId: actor.userId,
            action: HANDOFF_AUDIT_ACTIONS.MERGED,
            entityType: 'order',
            entityId: target.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                role: 'target',
                sourceOrderId: source.id,
                sourceOrderNumber: source.orderNumber,
                targetOrderId: target.id,
                targetOrderNumber: target.orderNumber,
                itemRowsMoved: movedSummary.itemRowsMoved,
                totalQuantityMoved: movedSummary.totalQuantityMoved,
                reason: dto.reason ?? null,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        const refreshedSource = await this.prisma.order.findUnique({
            where: { id: source.id },
            select: {
                id: true, orderNumber: true, status: true, subtotal: true,
                tax: true, discount: true, total: true, mergedIntoOrderId: true,
            },
        });
        const refreshedTarget = await this.prisma.order.findUnique({
            where: { id: target.id },
            include: { items: true },
        });

        return {
            ok: true,
            action: HANDOFF_AUDIT_ACTIONS.MERGED,
            sourceOrder: refreshedSource,
            targetOrder: refreshedTarget,
            moved: movedSummary,
            kds: {
                strategy: 'PRESERVE_AND_MARK_MERGED_INTO',
                note: 'Existing source-side KDS tickets remain in place; metadata updated with bg4bMergedInto so kitchen / support can correlate. No tickets are republished automatically.',
            },
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // D) Transfer table
    // ──────────────────────────────────────────────────────────────────

    async transferTable(
        ctx: BranchContext,
        orderId: string,
        dto: TransferTableDto,
        actor: ActorMeta,
    ) {
        const order = await this.loadOpenOrder(ctx, orderId);

        const table = await this.prisma.table.findFirst({
            where: {
                id: dto.targetTableId,
                branchId: ctx.branchId,
                orgId: ctx.organizationId,
                isActive: true,
            },
        });
        if (!table) throw new NotFoundException('Target table not found in this branch');

        if (order.tableId === dto.targetTableId) {
            throw new BadRequestException('Order is already at the target table');
        }

        const previousTableId = order.tableId;
        await this.prisma.order.update({
            where: { id: orderId },
            data: { tableId: dto.targetTableId },
        });

        await this.audit.log({
            actorUserId: actor.userId,
            action: HANDOFF_AUDIT_ACTIONS.TRANSFERRED_TABLE,
            entityType: 'order',
            entityId: orderId,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                orderNumber: order.orderNumber,
                previousTableId,
                newTableId: dto.targetTableId,
                newTableLabel: table.label,
                reason: dto.reason ?? null,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: HANDOFF_AUDIT_ACTIONS.TRANSFERRED_TABLE,
            orderId,
            previousTableId,
            newTableId: dto.targetTableId,
            newTableLabel: table.label,
            reason: dto.reason ?? null,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // E) Transfer server
    // ──────────────────────────────────────────────────────────────────

    async transferServer(
        ctx: BranchContext,
        orderId: string,
        dto: TransferServerDto,
        actor: ActorMeta,
    ) {
        const order = await this.loadOpenOrder(ctx, orderId);

        // Validate target user has an active membership in this branch.
        const membership = await this.prisma.membership.findFirst({
            where: {
                userId: dto.targetUserId,
                branchId: ctx.branchId,
                status: 'ACTIVE',
            },
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        });
        if (!membership) {
            throw new ForbiddenException(
                'Target user has no active membership in this branch',
            );
        }

        if (order.userId === dto.targetUserId) {
            throw new BadRequestException('Order is already assigned to the target server');
        }

        const previousUserId = order.userId;
        await this.prisma.order.update({
            where: { id: orderId },
            data: { userId: dto.targetUserId },
        });

        await this.audit.log({
            actorUserId: actor.userId,
            action: HANDOFF_AUDIT_ACTIONS.TRANSFERRED_SERVER,
            entityType: 'order',
            entityId: orderId,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                orderNumber: order.orderNumber,
                previousUserId,
                newUserId: dto.targetUserId,
                newUserEmail: membership.user?.email ?? null,
                reason: dto.reason ?? null,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: HANDOFF_AUDIT_ACTIONS.TRANSFERRED_SERVER,
            orderId,
            previousUserId,
            newUserId: dto.targetUserId,
            newUser: membership.user
                ? {
                    id: membership.user.id,
                    name: [membership.user.firstName, membership.user.lastName]
                        .filter(Boolean)
                        .join(' '),
                    email: membership.user.email,
                }
                : null,
            reason: dto.reason ?? null,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // F) Move items between two open orders
    // ──────────────────────────────────────────────────────────────────

    async moveItems(
        ctx: BranchContext,
        sourceOrderId: string,
        dto: MoveOrderItemsDto,
        actor: ActorMeta,
    ) {
        if (sourceOrderId === dto.targetOrderId) {
            throw new BadRequestException('sourceOrderId and targetOrderId must differ');
        }

        const source = await this.loadOpenOrder(ctx, sourceOrderId);
        const target = await this.loadOpenOrder(ctx, dto.targetOrderId);

        const itemMap = new Map(source.items.map((i) => [i.id, i]));
        for (const sel of dto.items) {
            const it = itemMap.get(sel.orderItemId);
            if (!it) {
                throw new BadRequestException(
                    `OrderItem ${sel.orderItemId} not found on source order`,
                );
            }
            if (sel.quantity > it.quantity) {
                throw new BadRequestException({
                    code: 'MOVE_QUANTITY_EXCEEDS_SOURCE',
                    message: `Requested quantity ${sel.quantity} exceeds available ${it.quantity}`,
                    orderItemId: sel.orderItemId,
                    requested: sel.quantity,
                    available: it.quantity,
                });
            }
        }

        const movedSummaries: {
            sourceItemId: string;
            targetItemId: string;
            quantity: number;
        }[] = [];

        await this.prisma.$transaction(async (tx) => {
            for (const sel of dto.items) {
                const it = itemMap.get(sel.orderItemId)!;
                const moveQty = sel.quantity;
                const remaining = it.quantity - moveQty;
                const unitPrice = new Decimal(it.price);

                if (remaining === 0) {
                    const moved = await tx.orderItem.update({
                        where: { id: it.id },
                        data: { orderId: target.id },
                    });
                    movedSummaries.push({
                        sourceItemId: it.id,
                        targetItemId: moved.id,
                        quantity: moveQty,
                    });
                } else {
                    await tx.orderItem.update({
                        where: { id: it.id },
                        data: {
                            quantity: remaining,
                            subtotal: round2(unitPrice.mul(remaining)).toFixed(2),
                        },
                    });
                    const targetItem = await tx.orderItem.create({
                        data: {
                            orderId: target.id,
                            menuItemId: it.menuItemId,
                            menuItemServingId: it.menuItemServingId ?? null,
                            quantity: moveQty,
                            price: unitPrice.toFixed(2),
                            subtotal: round2(unitPrice.mul(moveQty)).toFixed(2),
                            notes: it.notes ?? null,
                            metadata: it.metadata
                                ? (it.metadata as Prisma.InputJsonValue)
                                : Prisma.JsonNull,
                            costUnit: it.costUnit ?? null,
                            costTotal: it.costUnit
                                ? round2(new Decimal(it.costUnit).mul(moveQty)).toFixed(2)
                                : null,
                        },
                    });
                    movedSummaries.push({
                        sourceItemId: it.id,
                        targetItemId: targetItem.id,
                        quantity: moveQty,
                    });
                }
            }

            // Mark source-side KDS tickets to record the cross-order move.
            const sourceTickets = await tx.kdsTicket.findMany({
                where: { orderId: source.id },
            });
            for (const t of sourceTickets) {
                const tMeta = (t.metadata as Prisma.JsonObject | null) ?? {};
                await tx.kdsTicket.update({
                    where: { id: t.id },
                    data: {
                        metadata: {
                            ...tMeta,
                            bg4bItemsMovedTo: target.id,
                            bg4bItemsMovedAt: new Date().toISOString(),
                        } as Prisma.InputJsonValue,
                    },
                });
            }

            await this.recomputeAndSaveOrderTotals(tx, source.id);
            await this.recomputeAndSaveOrderTotals(tx, target.id);
        }, { timeout: 20000, maxWait: 10000 });

        const auditMeta = {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            sourceOrderId: source.id,
            sourceOrderNumber: source.orderNumber,
            targetOrderId: target.id,
            targetOrderNumber: target.orderNumber,
            itemRowsMoved: movedSummaries.length,
            totalQuantityMoved: movedSummaries.reduce((s, m) => s + m.quantity, 0),
            reason: dto.reason ?? null,
        };
        await this.audit.log({
            actorUserId: actor.userId,
            action: HANDOFF_AUDIT_ACTIONS.ITEMS_MOVED,
            entityType: 'order',
            entityId: source.id,
            metadata: { ...auditMeta, role: 'source' },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });
        await this.audit.log({
            actorUserId: actor.userId,
            action: HANDOFF_AUDIT_ACTIONS.ITEMS_MOVED,
            entityType: 'order',
            entityId: target.id,
            metadata: { ...auditMeta, role: 'target' },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        const refreshedSource = await this.prisma.order.findUnique({
            where: { id: source.id },
            include: { items: true },
        });
        const refreshedTarget = await this.prisma.order.findUnique({
            where: { id: target.id },
            include: { items: true },
        });

        return {
            ok: true,
            action: HANDOFF_AUDIT_ACTIONS.ITEMS_MOVED,
            sourceOrder: refreshedSource,
            targetOrder: refreshedTarget,
            movedItems: movedSummaries,
            kds: {
                strategy: 'PRESERVE_AND_MARK_MOVED_TO',
                note: 'Existing KDS tickets on the source remain in place. If the target order needs preparation for the moved items, re-send via POST /api/pos/orders/:id/send.',
            },
        };
    }
}
