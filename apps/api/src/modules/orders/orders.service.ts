import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, OrderStatus, ShiftStatus, TableStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KdsService } from '../kds/kds.service';
import {
  closeOrderInTx,
  completeSeatedReservationsInTx,
  releaseTableIfIdleInTx,
} from './order-close';
import {
  giveBackForVoid,
  MENU_AVAILABILITY_CHANGED,
  MenuAvailabilityChangedEvent,
  takeAvailabilityForSend,
  availabilityView,
} from '../menu/availability-engine';
import {
  ORDER_CLOSED,
  ORDER_LINES_SENT,
  ORDER_LINE_VOIDED,
  OrderClosedEvent,
  OrderLinesSentEvent,
  OrderLineVoidedEvent,
} from './order-events';
import {
  ActorLike,
  assertWaiterOrderOwnership,
  assertWaiterTransitionAllowed,
  isWaiterOnly,
} from '../../common/auth';
import {
  CreateOrderDto,
  AddOrderItemDto,
  UpdateOrderItemDto,
  TransitionOrderDto,
  ListOrdersQueryDto,
  VoidOrderItemDto,
} from './dto';

interface BranchContext {
  branchId: string;
  organizationId: string;
  roleId?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
  /** Actor with role information. Required for waiter-scope enforcement. */
  actor?: ActorLike;
}

// ── State Machine ──

const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ['SENT', 'VOIDED'],
  SENT: ['IN_KITCHEN', 'VOIDED'],
  IN_KITCHEN: ['READY', 'VOIDED'],
  READY: ['SERVED', 'VOIDED'],
  SERVED: ['CLOSED'],
  VOIDED: [],
  CLOSED: [],
};

// E1 — lines may be added, and sent, while the order is in any of these states.
const SENDABLE_STATES: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.SENT,
  OrderStatus.IN_KITCHEN,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly kdsService: KdsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Order Number Generation ──
  // Format: ORD-XXXXXX, branch-scoped, sequential, concurrency-safe via DB

  private async generateOrderNumber(branchId: string): Promise<string> {
    const lastOrder = await this.prisma.order.findFirst({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });

    let nextSeq = 1;
    if (lastOrder?.orderNumber) {
      const match = lastOrder.orderNumber.match(/ORD-(\d+)/);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }

    return `ORD-${String(nextSeq).padStart(6, '0')}`;
  }

  // ── Waiter MVP guard helpers ──

  /**
   * Enforce that waiter-only actors have an OPEN shift on this branch before
   * performing operational writes. Owners/managers/cashiers are exempt.
   * Throws 409 SHIFT_NOT_OPEN otherwise.
   */
  private async assertWaiterShiftOpen(
    actor: ActorLike | undefined,
    ctx: BranchContext,
  ): Promise<void> {
    if (!actor || !isWaiterOnly(actor)) return;
    const openShift = await this.prisma.shift.findFirst({
      where: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        openedById: actor.id,
        status: ShiftStatus.OPEN,
      },
      select: { id: true },
    });
    if (!openShift) {
      throw new ConflictException({
        code: 'SHIFT_NOT_OPEN',
        message: 'Waiter must open a shift before performing this action',
      });
    }
  }

  /**
   * Auto-occupy: when a dine-in order with a table becomes operationally
   * active (SENT), flip the table to OCCUPIED.
   */
  private async autoOccupyTable(tableId: string | null | undefined): Promise<void> {
    if (!tableId) return;
    await this.prisma.table.updateMany({
      where: { id: tableId, status: { not: TableStatus.OCCUPIED } },
      data: { status: TableStatus.OCCUPIED },
    });
  }

  // ── Create Order ──

  async createOrder(userId: string, ctx: BranchContext, dto: CreateOrderDto, meta: RequestMeta) {
    // Waiter MVP: require an open shift for waiter-only actors
    await this.assertWaiterShiftOpen(meta.actor, ctx);

    // Validate TAKEAWAY has no table
    if (dto.serviceType === 'TAKEAWAY' && dto.tableId) {
      throw new BadRequestException('Takeaway orders must not have a tableId');
    }

    // Validate DINE_IN table if provided
    if (dto.tableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.tableId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!table) throw new NotFoundException('Table not found in this branch');
    }

    const orderNumber = await this.generateOrderNumber(ctx.branchId);

    const order = await this.prisma.order.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        userId,
        tableId: dto.tableId ?? null,
        orderNumber,
        serviceType: dto.serviceType,
        notes: dto.notes ?? null,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_CREATED',
      entityType: 'order',
      entityId: order.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderNumber,
        serviceType: dto.serviceType,
        tableId: dto.tableId ?? null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return order;
  }

  // ── Get Order ──

  async getOrder(ctx: BranchContext, orderId: string, actor?: ActorLike) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: {
        items: {
          include: {
            menuItem: { select: { id: true, name: true, station: true } },
            menuItemServing: { select: { id: true, format: true, label: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        table: { select: { id: true, label: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (actor) assertWaiterOrderOwnership(actor, order);

    // T2 phase 1 (E2): an unsent line whose item is sold out is flagged; Send will skip it.
    const unsentItemIds = [
      ...new Set(order.items.filter((i) => !i.sentAt && !i.voidedAt).map((i) => i.menuItemId)),
    ];
    const rows = unsentItemIds.length
      ? await this.prisma.menuItemAvailability.findMany({
          where: { menuItemId: { in: unsentItemIds } },
        })
      : [];
    const byItem = new Map(rows.map((r) => [r.menuItemId, availabilityView(r)]));
    return {
      ...order,
      items: order.items.map((i) => {
        const view = !i.sentAt && !i.voidedAt ? byItem.get(i.menuItemId) : undefined;
        return {
          ...i,
          unsendable: view?.state === 'SOLD_OUT',
          ...(view?.state === 'SOLD_OUT' ? { unsendableReason: 'SOLD_OUT' } : {}),
        };
      }),
    };
  }

  // ── List Orders ──

  async listOrders(ctx: BranchContext, query: ListOrdersQueryDto, actor?: ActorLike) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OrderWhereInput = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
    };
    if (query.status) where.status = query.status as OrderStatus;
    if (query.serviceType)
      where.serviceType = query.serviceType as Prisma.OrderWhereInput['serviceType'];
    if (query.tableId) where.tableId = query.tableId;

    // Waiter MVP: support userId filter with literal `me`
    if (query.userId) {
      const resolved = query.userId === 'me' ? actor?.id : query.userId;
      if (resolved) where.userId = resolved;
    }

    // Waiter MVP: support excludeStatus to hide e.g. NEW drafts
    if (query.excludeStatus && query.excludeStatus.length > 0) {
      where.status = {
        ...(typeof where.status === 'string'
          ? { equals: where.status }
          : (where.status as object) || {}),
        notIn: query.excludeStatus as OrderStatus[],
      } as Prisma.EnumOrderStatusFilter;
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: { select: { id: true } },
          table: { select: { id: true, label: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  // ── Compute Line Pricing ──

  private async computeLinePricing(
    ctx: BranchContext,
    menuItemId: string,
    menuItemServingId: string | null | undefined,
    quantity: number,
    modifierMeta?: Record<string, unknown>,
    // Optional transaction client (H1). Existing callers omit it and keep using db.
    client?: Prisma.TransactionClient,
    // T2 phase 1 (E2): an offer price agreed when the line was added stays on later edits.
    lockedOfferBase?: Decimal | string | null,
  ): Promise<{
    price: Decimal;
    subtotal: Decimal;
    normalPrice: Decimal | null;
    offerBasePrice: Decimal | null;
    costUnit: Decimal | null;
    costTotal: Decimal | null;
    marginTotal: Decimal | null;
    marginPct: Decimal | null;
  }> {
    const db = client ?? this.prisma;
    const menuItem = await db.menuItem.findFirst({
      where: { id: menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { servings: true },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found in this branch');
    if (!menuItem.isActive) {
      throw new ConflictException({
        code: 'MENU_ITEM_UNAVAILABLE',
        message: 'This menu item is not currently available.',
      });
    }

    // Determine base price from serving or item
    let unitPrice = menuItem.price;
    // T2 phase 1 (E2): offers. The offer replaces the item's own price; a chosen serving keeps
    // its serving price. The normal price is kept beside the line.
    let offerBase: Decimal | null = null;
    if (!menuItemServingId) {
      if (lockedOfferBase !== undefined && lockedOfferBase !== null) {
        offerBase = new Decimal(lockedOfferBase);
      } else if (menuItem.isOffer && menuItem.offerPrice !== null) {
        offerBase = new Decimal(menuItem.offerPrice);
      }
    }

    if (menuItemServingId) {
      const serving = menuItem.servings.find((s) => s.id === menuItemServingId);
      if (!serving) {
        throw new BadRequestException('Serving not found for this menu item');
      }
      if (!serving.isActive) {
        throw new ConflictException({
          code: 'MENU_SERVING_INACTIVE',
          message: 'This serving is not currently available.',
        });
      }
      unitPrice = serving.price;
    }

    // Add modifier price deltas
    let modifierDelta = new Decimal(0);
    if (modifierMeta && Array.isArray((modifierMeta as any).selectedModifiers)) {
      const selectedModifiers = (modifierMeta as any).selectedModifiers as {
        modifierOptionId: string;
      }[];
      const optionIds = [
        ...new Set(selectedModifiers.map((m) => m.modifierOptionId).filter(Boolean)),
      ];
      if (optionIds.length > 0) {
        const assignedGroups = await db.menuItemOnGroup.findMany({
          where: { itemId: menuItem.id },
          select: { groupId: true },
        });
        const assignedGroupIds = new Set(assignedGroups.map((assignment) => assignment.groupId));
        const options = await db.modifierOption.findMany({
          where: {
            id: { in: optionIds },
            group: { branchId: ctx.branchId, orgId: ctx.organizationId },
          },
          include: { group: { select: { id: true, isActive: true } } },
        });
        if (options.length !== optionIds.length) {
          throw new BadRequestException({
            code: 'MODIFIER_OPTION_NOT_FOUND',
            message: 'One or more selected modifier options were not found for this branch.',
          });
        }
        const inactiveOption = options.find((opt) => !opt.isActive || !opt.group.isActive);
        if (inactiveOption) {
          throw new ConflictException({
            code: 'MODIFIER_OPTION_INACTIVE',
            message: 'One or more selected modifier options are not currently available.',
          });
        }
        const unassignedOption = options.find((opt) => !assignedGroupIds.has(opt.group.id));
        if (unassignedOption) {
          throw new BadRequestException({
            code: 'MODIFIER_NOT_ASSIGNED_TO_ITEM',
            message: 'One or more selected modifiers are not assigned to this menu item.',
          });
        }
        for (const opt of options) {
          modifierDelta = modifierDelta.add(opt.priceDelta);
        }
      }
    }

    const normalUnit = new Decimal(unitPrice).add(modifierDelta);
    const effectivePrice = offerBase ? offerBase.add(modifierDelta) : normalUnit;
    const lineSubtotal = effectivePrice.mul(quantity);

    // Compute cost snapshot from M8 recipes
    let costUnit: Decimal | null = null;
    let costTotal: Decimal | null = null;
    let marginTotal: Decimal | null = null;
    let marginPct: Decimal | null = null;

    const recipeIngredients = await db.recipeIngredient.findMany({
      where: {
        menuItemId,
        branchId: ctx.branchId,
        modifierOptionId: null,
        menuItemServingId: null,
      },
      include: { inventoryItem: { select: { theoreticalUnitCost: true } } },
    });

    if (recipeIngredients.length > 0) {
      let baseCost = new Decimal(0);
      for (const ri of recipeIngredients) {
        const effectiveQty = new Decimal(ri.qtyPerUnit).mul(
          new Decimal(1).add(new Decimal(ri.wastePct).div(100)),
        );
        const extCost = effectiveQty.mul(ri.inventoryItem.theoreticalUnitCost);
        baseCost = baseCost.add(extCost);
      }

      // Add modifier-linked ingredient costs
      if (modifierMeta && Array.isArray((modifierMeta as any).selectedModifiers)) {
        const selectedModifiers = (modifierMeta as any).selectedModifiers as {
          modifierOptionId: string;
        }[];
        const modOptionIds = selectedModifiers.map((m) => m.modifierOptionId);
        if (modOptionIds.length > 0) {
          const modRecipes = await db.recipeIngredient.findMany({
            where: {
              menuItemId,
              branchId: ctx.branchId,
              modifierOptionId: { in: modOptionIds },
            },
            include: { inventoryItem: { select: { theoreticalUnitCost: true } } },
          });
          for (const mr of modRecipes) {
            const effectiveQty = new Decimal(mr.qtyPerUnit).mul(
              new Decimal(1).add(new Decimal(mr.wastePct).div(100)),
            );
            baseCost = baseCost.add(effectiveQty.mul(mr.inventoryItem.theoreticalUnitCost));
          }
        }
      }

      costUnit = baseCost.toDecimalPlaces(2);
      costTotal = baseCost.mul(quantity).toDecimalPlaces(2);
      marginTotal = lineSubtotal.sub(costTotal).toDecimalPlaces(2);
      marginPct = lineSubtotal.gt(0)
        ? marginTotal.div(lineSubtotal).mul(100).toDecimalPlaces(2)
        : new Decimal(0);
    }

    return {
      price: effectivePrice.toDecimalPlaces(2),
      subtotal: lineSubtotal.toDecimalPlaces(2),
      normalPrice: offerBase ? normalUnit.toDecimalPlaces(2) : null,
      offerBasePrice: offerBase ? offerBase.toDecimalPlaces(2) : null,
      costUnit,
      costTotal,
      marginTotal,
      marginPct,
    };
  }

  // ── Recalculate Order Totals ──

  private async recalcOrderTotals(
    orderId: string,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = client ?? this.prisma;
    // E1 — a voided line stays on the order for the record but leaves the totals.
    const items = await db.orderItem.findMany({
      where: { orderId, voidedAt: null },
      select: { subtotal: true },
    });

    let subtotal = new Decimal(0);
    for (const item of items) {
      subtotal = subtotal.add(item.subtotal);
    }

    // M12: Compute discount from latest approved discount
    const approvedDiscount = await db.discount.findFirst({
      where: { orderId, status: 'APPROVED' },
      orderBy: { approvedAt: 'desc' },
    });

    let discountAmount = new Decimal(0);
    if (approvedDiscount) {
      if (approvedDiscount.type === 'PERCENTAGE') {
        discountAmount = subtotal.mul(approvedDiscount.value).div(100).toDecimalPlaces(2);
      } else {
        discountAmount = Decimal.min(approvedDiscount.value, subtotal).toDecimalPlaces(2);
      }
    }

    const total = Decimal.max(subtotal.sub(discountAmount), new Decimal(0));

    await db.order.update({
      where: { id: orderId },
      data: {
        subtotal: subtotal.toDecimalPlaces(2),
        discount: discountAmount.toDecimalPlaces(2),
        total: total.toDecimalPlaces(2),
      },
    });
  }

  // ── Add Item ──

  async addOrderItem(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: AddOrderItemDto,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (meta.actor) assertWaiterOrderOwnership(meta.actor, order);
    await this.assertWaiterShiftOpen(meta.actor, ctx);

    const quantity = dto.quantity ?? 1;

    // E1F (B2): the status is judged under the order's row lock, and the line and the new
    // totals are written in the same transaction, so a line cannot land on an order that a
    // payment is closing at that moment.
    const { item, pricing } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} AND "branch_id" = ${ctx.branchId} FOR UPDATE`;
      const locked = await tx.order.findFirst({
        where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!locked) throw new NotFoundException('Order not found');
      if (locked.status === 'CLOSED' || locked.status === 'VOIDED') {
        throw new ConflictException(`Cannot add items to a ${locked.status} order`);
      }

      // T2 phase 1 (E2): a sold-out item cannot be added; its button is grey for everyone.
      const availability = await tx.menuItemAvailability.findUnique({
        where: { menuItemId: dto.menuItemId },
        select: { state: true, since: true },
      });
      if (availability?.state === 'SOLD_OUT') {
        throw new ConflictException({
          code: 'ITEM_SOLD_OUT',
          message: 'This item is sold out.',
          menuItemId: dto.menuItemId,
          since: availability.since,
        });
      }

      const linePricing = await this.computeLinePricing(
        ctx,
        dto.menuItemId,
        dto.menuItemServingId,
        quantity,
        dto.metadata as Record<string, unknown> | undefined,
        tx,
      );

      const created = await tx.orderItem.create({
        data: {
          orderId,
          menuItemId: dto.menuItemId,
          menuItemServingId: dto.menuItemServingId ?? null,
          quantity,
          price: linePricing.price,
          subtotal: linePricing.subtotal,
          normalPrice: linePricing.normalPrice,
          offerBasePrice: linePricing.offerBasePrice,
          notes: dto.notes ?? null,
          metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          costUnit: linePricing.costUnit,
          costTotal: linePricing.costTotal,
          marginTotal: linePricing.marginTotal,
          marginPct: linePricing.marginPct,
        },
      });
      await this.recalcOrderTotals(orderId, tx);
      return { item: created, pricing: linePricing };
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_ITEM_ADDED',
      entityType: 'orderItem',
      entityId: item.id,
      metadata: {
        orderId,
        // C-28: this used to omit branchId entirely, making the event structurally
        // invisible to the branch-scoped audit-timeline endpoint (which unconditionally
        // ANDs `metadata.branchId = X-Branch-Id`).
        branchId: ctx.branchId,
        menuItemId: dto.menuItemId,
        quantity,
        price: pricing.price.toString(),
        subtotal: pricing.subtotal.toString(),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return item;
  }

  // ── Update Item ──

  async updateOrderItem(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    itemId: string,
    dto: UpdateOrderItemDto,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (meta.actor) assertWaiterOrderOwnership(meta.actor, order);
    await this.assertWaiterShiftOpen(meta.actor, ctx);

    if (order.status === 'CLOSED' || order.status === 'VOIDED') {
      throw new ConflictException(`Cannot update items on a ${order.status} order`);
    }

    const existingItem = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!existingItem) throw new NotFoundException('Order item not found');
    if (existingItem.voidedAt) {
      throw new ConflictException('This item was voided and cannot be changed');
    }
    // E1F (B1): a sent line is changed only by a void (pos:order:item:void, with a reason).
    if (existingItem.sentAt) {
      throw new ConflictException({
        code: 'ITEM_ALREADY_SENT',
        message: 'This item was already sent. Ask a supervisor to void it instead.',
      });
    }

    const quantity = dto.quantity ?? existingItem.quantity;
    const metadata =
      dto.metadata !== undefined
        ? dto.metadata
        : (existingItem.metadata as Record<string, unknown> | null);

    const pricing = await this.computeLinePricing(
      ctx,
      existingItem.menuItemId,
      existingItem.menuItemServingId,
      quantity,
      metadata as Record<string, unknown> | undefined,
      undefined,
      existingItem.offerBasePrice,
    );

    const updated = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        quantity,
        notes: dto.notes !== undefined ? dto.notes : existingItem.notes,
        metadata:
          dto.metadata !== undefined
            ? ((dto.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull)
            : undefined,
        price: pricing.price,
        subtotal: pricing.subtotal,
        normalPrice: pricing.normalPrice,
        offerBasePrice: pricing.offerBasePrice,
        costUnit: pricing.costUnit,
        costTotal: pricing.costTotal,
        marginTotal: pricing.marginTotal,
        marginPct: pricing.marginPct,
      },
    });

    await this.recalcOrderTotals(orderId);

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_ITEM_UPDATED',
      entityType: 'orderItem',
      entityId: itemId,
      metadata: {
        orderId,
        // C-28: this used to omit branchId entirely, making the event structurally
        // invisible to the branch-scoped audit-timeline endpoint (which unconditionally
        // ANDs `metadata.branchId = X-Branch-Id`).
        branchId: ctx.branchId,
        quantity,
        price: pricing.price.toString(),
        subtotal: pricing.subtotal.toString(),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Delete Item ──

  async deleteOrderItem(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    itemId: string,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (meta.actor) assertWaiterOrderOwnership(meta.actor, order);
    await this.assertWaiterShiftOpen(meta.actor, ctx);

    if (order.status === 'CLOSED' || order.status === 'VOIDED') {
      throw new ConflictException(`Cannot remove items from a ${order.status} order`);
    }

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.sentAt) {
      throw new ConflictException({
        code: 'ITEM_ALREADY_SENT',
        message: 'This item was already sent. Ask a supervisor to void it instead.',
      });
    }

    await this.prisma.orderItem.delete({ where: { id: itemId } });
    await this.recalcOrderTotals(orderId);

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_ITEM_REMOVED',
      entityType: 'orderItem',
      entityId: itemId,
      metadata: {
        orderId,
        // C-28: this used to omit branchId entirely, making the event structurally
        // invisible to the branch-scoped audit-timeline endpoint (which unconditionally
        // ANDs `metadata.branchId = X-Branch-Id`).
        branchId: ctx.branchId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.closeIfSettled(userId, ctx, orderId, meta);
    return { deleted: true };
  }

  /**
   * E1F (S9): money that arrived while lines were still unsent leaves the order open; once
   * the last unsent line is sent or removed and the payments cover the bill, it closes here,
   * through the close door, so it never sits paid and open with no way out.
   */
  private async closeIfSettled(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const paidRows = await this.prisma.payment.count({ where: { orderId, status: 'COMPLETED' } });
    if (paidRows === 0) return;
    const closed = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} AND "branch_id" = ${ctx.branchId} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (
        order.status === OrderStatus.NEW ||
        order.status === OrderStatus.CLOSED ||
        order.status === OrderStatus.VOIDED
      )
        return null;
      const lines = await tx.orderItem.findMany({
        where: { orderId, voidedAt: null },
        select: { sentAt: true },
      });
      if (lines.length === 0 || lines.some((l) => !l.sentAt)) return null;
      const paid = await tx.payment.aggregate({
        where: { orderId, status: 'COMPLETED' },
        _sum: { amount: true },
      });
      if (new Decimal(paid._sum.amount ?? 0).lt(order.total)) return null;
      return closeOrderInTx(tx, {
        orderId,
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        userId,
        source: 'auto-settle',
        auditAction: 'ORDER_AUTO_SETTLED',
        auditMetadata: { trigger: 'settled_after_lines_sent_or_removed' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    });
    if (closed?.event)
      this.eventEmitter.emit(ORDER_CLOSED, closed.event satisfies OrderClosedEvent);
  }

  // ── State Transitions ──

  private validateTransition(current: string, target: string): void {
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed || !allowed.includes(target)) {
      throw new ConflictException(`Invalid transition from ${current} to ${target}`);
    }
  }

  private async transitionOrder(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    targetStatus: OrderStatus,
    auditAction: string,
    meta: RequestMeta,
    reason?: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (meta.actor) {
      assertWaiterOrderOwnership(meta.actor, order);
      assertWaiterTransitionAllowed(meta.actor, targetStatus);
    }
    await this.assertWaiterShiftOpen(meta.actor, ctx);

    this.validateTransition(order.status, targetStatus);

    // E1 — closing goes through the one close door (table, reservation, audit, all in one
    // transaction). It writes its own audit row, so this method returns straight after it.
    if (targetStatus === OrderStatus.CLOSED) {
      const closed = await this.prisma.$transaction((tx) =>
        closeOrderInTx(tx, {
          orderId,
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          userId,
          source: 'transition',
          auditAction,
          auditMetadata: { previousStatus: order.status, reason: reason ?? null },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        }),
      );
      if (closed.event)
        this.eventEmitter.emit(ORDER_CLOSED, closed.event satisfies OrderClosedEvent);
      return this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: targetStatus },
    });

    // Waiter MVP — auto-occupy on SENT.
    if (targetStatus === OrderStatus.SENT && order.serviceType === 'DINE_IN') {
      await this.autoOccupyTable(order.tableId);
    }

    await this.audit.log({
      actorUserId: userId,
      action: auditAction,
      entityType: 'order',
      entityId: orderId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        previousStatus: order.status,
        newStatus: targetStatus,
        reason: reason ?? null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  /**
   * E1 — send by line. Stamps every line that is not yet sent and not voided, moves
   * NEW → SENT the first time (later sends leave the status alone) and makes kitchen/bar
   * tickets for exactly the lines just sent. Everything happens under a row lock on the
   * order, and `kds_ticket_items.order_item_id` is unique, so a doubled or retried send
   * cannot ticket a line twice: the second one finds nothing unsent and answers 409.
   */
  async sendOrder(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: TransitionOrderDto,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (meta.actor) {
      assertWaiterOrderOwnership(meta.actor, order);
      assertWaiterTransitionAllowed(meta.actor, OrderStatus.SENT);
    }
    await this.assertWaiterShiftOpen(meta.actor, ctx);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} AND "branch_id" = ${ctx.branchId} FOR UPDATE`;
      const locked = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (!SENDABLE_STATES.includes(locked.status)) {
        throw new ConflictException(`Cannot send items on a ${locked.status} order`);
      }

      const unsent = await tx.orderItem.findMany({
        where: { orderId, sentAt: null, voidedAt: null },
        select: {
          id: true,
          menuItemId: true,
          quantity: true,
          menuItem: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (unsent.length === 0) {
        throw new ConflictException({
          code: 'NOTHING_TO_SEND',
          message: 'There is nothing new to send on this order.',
        });
      }

      // T2 phase 1 (E2): sold-out lines are skipped and reported; counted items lose portions
      // with a guarded update, so two sends racing for the last one cannot both take it.
      const take = await takeAvailabilityForSend(
        tx,
        ctx,
        orderId,
        userId,
        unsent.map((l) => ({
          id: l.id,
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          name: l.menuItem.name,
        })),
      );
      if (take.sendIds.length === 0) {
        throw new ConflictException({
          code: 'NOTHING_SENDABLE',
          message: `Nothing could be sent: ${[...new Set(take.skipped.map((k) => k.name))].join(', ')} sold out or not enough left.`,
          skipped: take.skipped,
        });
      }
      const sendSet = new Set(take.sendIds);
      const lineIds = unsent.filter((l) => sendSet.has(l.id)).map((l) => l.id);

      await tx.orderItem.updateMany({
        where: { id: { in: lineIds }, sentAt: null },
        data: { sentAt: new Date() },
      });

      const firstSend = locked.status === OrderStatus.NEW;
      if (firstSend) {
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.SENT } });
      }
      // E1F (S10): the table is occupied inside the send, under its row lock, so a close that
      // commits right after cannot be overtaken by a late "occupied".
      if (firstSend && locked.serviceType === 'DINE_IN' && locked.tableId) {
        await tx.$queryRaw`SELECT "id" FROM "tables" WHERE "id" = ${locked.tableId} FOR UPDATE`;
        await tx.table.updateMany({
          where: { id: locked.tableId, status: { not: TableStatus.OCCUPIED } },
          data: { status: TableStatus.OCCUPIED },
        });
      }

      const tickets = await this.kdsService.createTicketsForLines(tx, ctx, orderId, lineIds);

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'ORDER_SENT',
          entityType: 'order',
          entityId: orderId,
          metadata: {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            previousStatus: locked.status,
            newStatus: firstSend ? OrderStatus.SENT : locked.status,
            reason: dto.reason ?? null,
            lineCount: lineIds.length,
            orderItemIds: lineIds,
            ticketIds: tickets.map((t) => t.id),
            skipped: take.skipped.map((k) => ({ orderItemId: k.orderItemId, reason: k.reason })),
          },
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
      return { lineIds, tickets, firstSend, skipped: take.skipped, changed: take.changedItemIds };
    });

    this.kdsService.announceTickets(ctx, orderId, result.tickets);
    this.eventEmitter.emit(ORDER_LINES_SENT, {
      orderId,
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
      orderItemIds: result.lineIds,
      ticketIds: result.tickets.map((t) => t.id),
    } satisfies OrderLinesSentEvent);
    if (result.changed.length > 0) {
      this.eventEmitter.emit(MENU_AVAILABILITY_CHANGED, {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        menuItemIds: result.changed,
      } satisfies MenuAvailabilityChangedEvent);
    }

    await this.closeIfSettled(userId, ctx, orderId, meta);
    const sentOrder = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    return { ...sentOrder, sent: result.lineIds, skipped: result.skipped };
  }

  async markInKitchen(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: TransitionOrderDto,
    meta: RequestMeta,
  ) {
    return this.transitionOrder(
      userId,
      ctx,
      orderId,
      OrderStatus.IN_KITCHEN,
      'ORDER_IN_KITCHEN',
      meta,
      dto.reason,
    );
  }

  async markReady(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: TransitionOrderDto,
    meta: RequestMeta,
  ) {
    return this.transitionOrder(
      userId,
      ctx,
      orderId,
      OrderStatus.READY,
      'ORDER_READY',
      meta,
      dto.reason,
    );
  }

  async markServed(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: TransitionOrderDto,
    meta: RequestMeta,
  ) {
    return this.transitionOrder(
      userId,
      ctx,
      orderId,
      OrderStatus.SERVED,
      'ORDER_SERVED',
      meta,
      dto.reason,
    );
  }

  async voidOrder(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: TransitionOrderDto,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (meta.actor) {
      assertWaiterOrderOwnership(meta.actor, order);
      assertWaiterTransitionAllowed(meta.actor, 'VOIDED');
    }

    // E1F (B4, S2, S3, S8): judged and written under the order's row lock, in the lock order
    // order -> reservation -> table that the close door uses.
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} AND "branch_id" = ${ctx.branchId} FOR UPDATE`;
      const locked = await tx.order.findFirst({
        where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!locked) throw new NotFoundException('Order not found');

      // Ruling R-a (default taken): an order left open at zero after its last line was
      // voided may be voided from SERVED too, so it is never stuck on the table.
      const zeroServed = locked.status === OrderStatus.SERVED && new Decimal(locked.total).eq(0);
      if (!zeroServed) this.validateTransition(locked.status, 'VOIDED');

      const postKitchen = ['IN_KITCHEN', 'READY'].includes(locked.status);
      if (postKitchen && !dto.reason) {
        throw new BadRequestException('Post-kitchen void requires a reason');
      }

      const paid = await tx.payment.count({ where: { orderId, status: 'COMPLETED' } });
      if (paid > 0) {
        throw new ConflictException({
          code: 'ORDER_HAS_PAYMENT',
          message: 'This order already has a payment, so it cannot be voided.',
        });
      }

      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: locked.status },
        data: { status: OrderStatus.VOIDED },
      });
      if (claimed.count !== 1) throw new ConflictException('The order changed; try again');

      // Ruling R-c (default taken): a seated reservation on a voided order is completed.
      const completed = await completeSeatedReservationsInTx(tx, {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId,
        actorUserId: userId,
        auditUserId: userId,
        source: 'order-void',
        message: 'Reservation completed because its order was voided',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      const tableFreed =
        locked.serviceType === 'DINE_IN' && locked.tableId
          ? await releaseTableIfIdleInTx(tx, locked.tableId, orderId)
          : false;

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'ORDER_VOIDED',
          entityType: 'order',
          entityId: orderId,
          metadata: {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            previousStatus: locked.status,
            postKitchenVoid: postKitchen,
            zeroTotalVoid: zeroServed,
            reason: dto.reason ?? null,
            tableFreed,
            completedReservationIds: completed,
          },
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    return result;
  }

  // ── Void one line (E1) ──
  //
  // A sent line is never deleted: it stays on the order with who, when, why and whether it
  // was made, leaves the totals, and shows as voided on its ticket. Part of a quantity splits
  // the line in two. Refused: a line never sent (remove it instead), an order that is closed or
  // voided, an order that already has a posted payment. Voiding a voided line changes nothing.
  async voidOrderItem(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    itemId: string,
    dto: VoidOrderItemDto,
    meta: RequestMeta,
  ) {
    if (dto.reason === 'OTHER' && !dto.note?.trim()) {
      throw new BadRequestException('A note is required when the reason is OTHER');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} AND "branch_id" = ${ctx.branchId} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.VOIDED) {
        throw new ConflictException(`Cannot void items on a ${order.status} order`);
      }

      const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
      if (!item) throw new NotFoundException('Order item not found');
      if (item.voidedAt) return { item, unchanged: true, event: null as string | null };
      if (!item.sentAt) {
        throw new BadRequestException({
          code: 'ITEM_NOT_SENT',
          message: 'This item was never sent. Remove it instead.',
        });
      }

      const posted = await tx.payment.count({ where: { orderId, status: 'COMPLETED' } });
      if (posted > 0) {
        throw new ConflictException({
          code: 'ORDER_HAS_PAYMENT',
          message: 'This order already has a payment, so a line cannot be voided.',
        });
      }
      // E1F (S11): a payment already asked of the guest's phone would settle the old total.
      const pendingIntents = await tx.paymentIntent.count({
        where: { orderId, status: { in: ['PENDING', 'REQUIRES_ACTION'] } },
      });
      if (pendingIntents > 0) {
        throw new ConflictException({
          code: 'PAYMENT_PENDING',
          message:
            'A mobile-money payment is waiting on this order. Cancel it before voiding a line.',
        });
      }

      const voidQty = dto.quantity ?? item.quantity;
      if (voidQty > item.quantity) {
        throw new BadRequestException(`Quantity cannot be more than ${item.quantity}`);
      }

      const now = new Date();
      const voidFields = {
        voidedAt: now,
        voidedById: userId,
        voidReason: dto.reason,
        voidNote: dto.note?.trim() || null,
        wasMade: dto.wasMade,
      };

      let voided = item;
      if (voidQty === item.quantity) {
        voided = await tx.orderItem.update({ where: { id: itemId }, data: voidFields });
        await tx.kdsTicketItem.updateMany({
          where: { orderItemId: itemId },
          data: { voidedAt: now, voidReason: dto.reason, wasMade: dto.wasMade },
        });
      } else {
        // Split: the original keeps what is still wanted; a new line carries the voided part.
        const remaining = item.quantity - voidQty;
        const unit = new Decimal(item.price);
        await tx.orderItem.update({
          where: { id: itemId },
          data: {
            quantity: remaining,
            subtotal: unit.mul(remaining).toDecimalPlaces(2),
            costTotal: item.costUnit
              ? new Decimal(item.costUnit).mul(remaining).toDecimalPlaces(2)
              : null,
          },
        });
        voided = await tx.orderItem.create({
          data: {
            orderId,
            menuItemId: item.menuItemId,
            menuItemServingId: item.menuItemServingId,
            quantity: voidQty,
            price: item.price,
            subtotal: unit.mul(voidQty).toDecimalPlaces(2),
            normalPrice: item.normalPrice,
            offerBasePrice: item.offerBasePrice,
            notes: item.notes,
            metadata: item.metadata ? (item.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
            costUnit: item.costUnit,
            costTotal: item.costUnit
              ? new Decimal(item.costUnit).mul(voidQty).toDecimalPlaces(2)
              : null,
            sentAt: item.sentAt,
            ...voidFields,
          },
        });
        // The voided part shows on the same ticket as the line it came from.
        const ticketItem = await tx.kdsTicketItem.findFirst({ where: { orderItemId: itemId } });
        if (ticketItem) {
          await tx.kdsTicketItem.create({
            data: {
              ticketId: ticketItem.ticketId,
              orderItemId: voided.id,
              voidedAt: now,
              voidReason: dto.reason,
              wasMade: dto.wasMade,
            },
          });
        }
      }

      await this.recalcOrderTotals(orderId, tx);

      // T2 phase 1 (E2): "not made" gives the portions back to the number, if there is one.
      const gaveBack =
        dto.wasMade === false
          ? await giveBackForVoid(tx, ctx, item.menuItemId, voidQty, userId, orderId, voided.id)
          : false;

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'ORDER_ITEM_VOIDED',
          entityType: 'orderItem',
          entityId: voided.id,
          metadata: {
            orderId,
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            sourceItemId: itemId,
            menuItemId: item.menuItemId,
            quantityVoided: voidQty,
            quantityBefore: item.quantity,
            reason: dto.reason,
            note: dto.note?.trim() || null,
            wasMade: dto.wasMade,
            amountRemoved: new Decimal(item.price).mul(voidQty).toDecimalPlaces(2).toString(),
          },
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
      return {
        item: voided,
        unchanged: false,
        event: voided.id as string | null,
        gaveBack: gaveBack ? item.menuItemId : null,
      };
    });
    if ('gaveBack' in result && result.gaveBack) {
      this.eventEmitter.emit(MENU_AVAILABILITY_CHANGED, {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        menuItemIds: [result.gaveBack],
      } satisfies MenuAvailabilityChangedEvent);
    }

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, subtotal: true, discount: true, total: true, status: true },
    });
    if (result.event) {
      this.eventEmitter.emit(ORDER_LINE_VOIDED, {
        orderId,
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        orderItemId: result.event,
      } satisfies OrderLineVoidedEvent);
    }
    return { item: result.item, order, unchanged: result.unchanged };
  }

  // ── Request Bill (Waiter MVP) ──
  // Records an explicit "bill requested" audit event so the cashier flow can
  // pick it up later. Does NOT mutate payment state or order status.
  async requestBill(userId: string, ctx: BranchContext, orderId: string, meta: RequestMeta) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (meta.actor) assertWaiterOrderOwnership(meta.actor, order);
    await this.assertWaiterShiftOpen(meta.actor, ctx);

    if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.VOIDED) {
      throw new ConflictException(`Cannot request bill on a ${order.status} order`);
    }

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_BILL_REQUESTED',
      entityType: 'order',
      entityId: orderId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderNumber: order.orderNumber,
        status: order.status,
        tableId: order.tableId,
        total: order.total?.toString?.() ?? null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      billRequested: true,
      requestedAt: new Date().toISOString(),
    };
  }
}
