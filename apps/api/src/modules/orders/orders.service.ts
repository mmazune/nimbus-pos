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
import { KdsService } from '../kds/kds.service';
import { ReservationsService } from '../reservations/reservations.service';
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

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly kdsService: KdsService,
    private readonly reservationsService: ReservationsService,
  ) { }

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

  /**
   * Auto-release: when an order moves to a terminal state (CLOSED/VOIDED)
   * and no other active dine-in orders remain on the table, return the
   * table to AVAILABLE so it can be re-seated.
   */
  private async autoReleaseTableIfIdle(
    tableId: string | null | undefined,
    excludeOrderId: string,
  ): Promise<void> {
    if (!tableId) return;
    const activeOnTable = await this.prisma.order.count({
      where: {
        tableId,
        id: { not: excludeOrderId },
        status: { notIn: [OrderStatus.CLOSED, OrderStatus.VOIDED] },
      },
    });
    if (activeOnTable > 0) return;
    await this.prisma.table.updateMany({
      where: { id: tableId, status: TableStatus.OCCUPIED },
      data: { status: TableStatus.AVAILABLE },
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
    return order;
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
    if (query.serviceType) where.serviceType = query.serviceType as Prisma.OrderWhereInput['serviceType'];
    if (query.tableId) where.tableId = query.tableId;

    // Waiter MVP: support userId filter with literal `me`
    if (query.userId) {
      const resolved = query.userId === 'me' ? actor?.id : query.userId;
      if (resolved) where.userId = resolved;
    }

    // Waiter MVP: support excludeStatus to hide e.g. NEW drafts
    if (query.excludeStatus && query.excludeStatus.length > 0) {
      where.status = {
        ...(typeof where.status === 'string' ? { equals: where.status } : (where.status as object) || {}),
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
  ): Promise<{
    price: Decimal;
    subtotal: Decimal;
    costUnit: Decimal | null;
    costTotal: Decimal | null;
    marginTotal: Decimal | null;
    marginPct: Decimal | null;
  }> {
    const menuItem = await this.prisma.menuItem.findFirst({
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
      const optionIds = [...new Set(selectedModifiers.map((m) => m.modifierOptionId).filter(Boolean))];
      if (optionIds.length > 0) {
        const assignedGroups = await this.prisma.menuItemOnGroup.findMany({
          where: { itemId: menuItem.id },
          select: { groupId: true },
        });
        const assignedGroupIds = new Set(assignedGroups.map((assignment) => assignment.groupId));
        const options = await this.prisma.modifierOption.findMany({
          where: { id: { in: optionIds }, group: { branchId: ctx.branchId, orgId: ctx.organizationId } },
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

    const effectivePrice = new Decimal(unitPrice).add(modifierDelta);
    const lineSubtotal = effectivePrice.mul(quantity);

    // Compute cost snapshot from M8 recipes
    let costUnit: Decimal | null = null;
    let costTotal: Decimal | null = null;
    let marginTotal: Decimal | null = null;
    let marginPct: Decimal | null = null;

    const recipeIngredients = await this.prisma.recipeIngredient.findMany({
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
          const modRecipes = await this.prisma.recipeIngredient.findMany({
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
      costUnit,
      costTotal,
      marginTotal,
      marginPct,
    };
  }

  // ── Recalculate Order Totals ──

  private async recalcOrderTotals(orderId: string): Promise<void> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { subtotal: true },
    });

    let subtotal = new Decimal(0);
    for (const item of items) {
      subtotal = subtotal.add(item.subtotal);
    }

    // M12: Compute discount from latest approved discount
    const approvedDiscount = await this.prisma.discount.findFirst({
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

    await this.prisma.order.update({
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

    if (order.status === 'CLOSED' || order.status === 'VOIDED') {
      throw new ConflictException(`Cannot add items to a ${order.status} order`);
    }

    const quantity = dto.quantity ?? 1;

    const pricing = await this.computeLinePricing(
      ctx,
      dto.menuItemId,
      dto.menuItemServingId,
      quantity,
      dto.metadata as Record<string, unknown> | undefined,
    );

    const item = await this.prisma.orderItem.create({
      data: {
        orderId,
        menuItemId: dto.menuItemId,
        menuItemServingId: dto.menuItemServingId ?? null,
        quantity,
        price: pricing.price,
        subtotal: pricing.subtotal,
        notes: dto.notes ?? null,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        costUnit: pricing.costUnit,
        costTotal: pricing.costTotal,
        marginTotal: pricing.marginTotal,
        marginPct: pricing.marginPct,
      },
    });

    await this.recalcOrderTotals(orderId);

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_ITEM_ADDED',
      entityType: 'orderItem',
      entityId: item.id,
      metadata: {
        orderId,
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

    await this.prisma.orderItem.delete({ where: { id: itemId } });
    await this.recalcOrderTotals(orderId);

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_ITEM_REMOVED',
      entityType: 'orderItem',
      entityId: itemId,
      metadata: { orderId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { deleted: true };
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

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: targetStatus },
    });

    // Waiter MVP — auto-occupy on SENT; auto-release on CLOSED.
    if (targetStatus === OrderStatus.SENT && order.serviceType === 'DINE_IN') {
      await this.autoOccupyTable(order.tableId);
    }
    if (targetStatus === OrderStatus.CLOSED) {
      await this.autoReleaseTableIfIdle(order.tableId, orderId);

      // Prompt 4A — canonical order-close reservation reconciliation. A SEATED
      // reservation explicitly linked via seatedOrderId is auto-completed here,
      // at the single order-close choke point (never in Cashier frontend code).
      // The order close remains canonical: completion runs after the committed
      // status change and is retry-safe/idempotent (conditional update, no
      // duplicate event). Failure is logged for visibility, never swallowed
      // silently, and never rolls back the order close.
      try {
        const completedReservationId = await this.reservationsService.completeForClosedOrder(
          orderId,
          ctx,
          userId,
          meta,
        );
        if (completedReservationId) {
          this.logger.log(
            `Order ${orderId} close auto-completed reservation ${completedReservationId}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Order ${orderId} closed but linked reservation auto-completion failed: ${
            (err as Error)?.message ?? err
          }. Reservation may remain SEATED and can be completed manually.`,
        );
      }
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

  async sendOrder(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: TransitionOrderDto,
    meta: RequestMeta,
  ) {
    const order = await this.transitionOrder(
      userId,
      ctx,
      orderId,
      OrderStatus.SENT,
      'ORDER_SENT',
      meta,
      dto.reason,
    );

    // M11: Create KDS tickets grouped by station. Ticket creation is intentionally
    // best-effort here so a slow KDS write never traps the waiter in "Sending".
    void this.kdsService.createTicketsForOrder(userId, ctx, orderId, meta).catch(() => undefined);

    return order;
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

  async closeOrder(
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
      OrderStatus.CLOSED,
      'ORDER_CLOSED',
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

    this.validateTransition(order.status, 'VOIDED');

    // Post-kitchen voids require a reason
    const postKitchen = ['IN_KITCHEN', 'READY'].includes(order.status);
    if (postKitchen && !dto.reason) {
      throw new BadRequestException('Post-kitchen void requires a reason');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.VOIDED },
    });

    // Waiter MVP — released voided dine-in tables
    if (order.serviceType === 'DINE_IN') {
      await this.autoReleaseTableIfIdle(order.tableId, orderId);
    }

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_VOIDED',
      entityType: 'order',
      entityId: orderId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        previousStatus: order.status,
        postKitchenVoid: postKitchen,
        reason: dto.reason ?? null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Request Bill (Waiter MVP) ──
  // Records an explicit "bill requested" audit event so the cashier flow can
  // pick it up later. Does NOT mutate payment state or order status.
  async requestBill(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    meta: RequestMeta,
  ) {
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
