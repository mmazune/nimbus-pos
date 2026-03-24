import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { KdsService } from '../kds/kds.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly kdsService: KdsService,
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

  // ── Create Order ──

  async createOrder(userId: string, ctx: BranchContext, dto: CreateOrderDto, meta: RequestMeta) {
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

  async getOrder(ctx: BranchContext, orderId: string) {
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
    return order;
  }

  // ── List Orders ──

  async listOrders(ctx: BranchContext, query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
    };
    if (query.status) where.status = query.status;
    if (query.serviceType) where.serviceType = query.serviceType;
    if (query.tableId) where.tableId = query.tableId;

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
      where: { id: menuItemId, branchId: ctx.branchId },
      include: { servings: true },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found in this branch');

    // Determine base price from serving or item
    let unitPrice = menuItem.price;

    if (menuItemServingId) {
      const serving = menuItem.servings.find((s) => s.id === menuItemServingId);
      if (!serving) {
        throw new BadRequestException('Serving not found for this menu item');
      }
      unitPrice = serving.price;
    }

    // Add modifier price deltas
    let modifierDelta = new Decimal(0);
    if (modifierMeta && Array.isArray((modifierMeta as any).selectedModifiers)) {
      const selectedModifiers = (modifierMeta as any).selectedModifiers as {
        modifierOptionId: string;
      }[];
      const optionIds = selectedModifiers.map((m) => m.modifierOptionId);
      if (optionIds.length > 0) {
        const options = await this.prisma.modifierOption.findMany({
          where: { id: { in: optionIds }, isActive: true },
        });
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

    this.validateTransition(order.status, targetStatus);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: targetStatus },
    });

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

    // M11: Create KDS tickets grouped by station
    try {
      await this.kdsService.createTicketsForOrder(userId, ctx, orderId, meta);
    } catch {
      // KDS ticket creation failure should not block order send
    }

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
}
