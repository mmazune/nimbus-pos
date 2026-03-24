import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, DiscountStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  RequestDiscountDto,
  ApproveDiscountDto,
  RejectDiscountDto,
  ListOrderDiscountsQueryDto,
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

// Allowed order states for discount requests
const DISCOUNTABLE_STATES = ['NEW', 'SENT', 'IN_KITCHEN', 'READY'];

@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Request Discount ──

  async requestDiscount(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: RequestDiscountDto,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (!DISCOUNTABLE_STATES.includes(order.status)) {
      throw new ConflictException(`Cannot apply discount to order in ${order.status} state`);
    }

    // Validate percentage range
    if (dto.type === 'PERCENTAGE' && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    // Compute effective discount amount for threshold comparison.
    // For FIXED type, use the requested value directly (not capped to subtotal)
    // so that high-value requests always require approval regardless of order size.
    const thresholdAmount =
      dto.type === 'FIXED'
        ? new Decimal(dto.value)
        : this.computeDiscountAmount(dto.type, new Decimal(dto.value), order.subtotal);

    // Effective amount (capped at subtotal) — used for flagging and audit
    const effectiveAmount = this.computeDiscountAmount(
      dto.type,
      new Decimal(dto.value),
      order.subtotal,
    );

    // Read threshold from OrgSettings
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId: ctx.organizationId },
    });
    const threshold = settings?.discountApprovalThreshold ?? new Decimal(5000);

    // Determine auto-approve vs pending
    const autoApprove = thresholdAmount.lte(threshold);
    const status = autoApprove ? DiscountStatus.APPROVED : DiscountStatus.PENDING;

    const discount = await this.prisma.discount.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId,
        createdById: userId,
        type: dto.type,
        value: dto.value,
        reason: dto.reason,
        status,
        approvedById: autoApprove ? userId : null,
        approvedAt: autoApprove ? new Date() : null,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    // If auto-approved, recalculate order totals
    if (autoApprove) {
      await this.recalcOrderDiscount(orderId);
    }

    // Flag heavy discount anomaly if above threshold
    if (!autoApprove) {
      await this.flagHeavyDiscount(orderId, effectiveAmount);
    }

    // Audit
    const auditAction = autoApprove ? 'DISCOUNT_AUTO_APPROVED' : 'DISCOUNT_REQUESTED';
    await this.audit.log({
      actorUserId: userId,
      action: auditAction,
      entityType: 'discount',
      entityId: discount.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId,
        type: dto.type,
        value: dto.value.toString(),
        discountAmount: effectiveAmount.toString(),
        reason: dto.reason,
        status,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return discount;
  }

  // ── Approve Discount ──

  async approveDiscount(
    userId: string,
    ctx: BranchContext,
    discountId: string,
    dto: ApproveDiscountDto,
    meta: RequestMeta,
  ) {
    const discount = await this.prisma.discount.findFirst({
      where: { id: discountId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    if (discount.status !== 'PENDING') {
      throw new ConflictException(`Cannot approve a discount in ${discount.status} status`);
    }

    // Verify order is still in a discountable state
    const order = await this.prisma.order.findUnique({
      where: { id: discount.orderId },
    });
    if (!order || !DISCOUNTABLE_STATES.includes(order.status)) {
      throw new ConflictException('Order is no longer in a state that accepts discounts');
    }

    // Optional manager PIN verification
    let managerPinVerified = false;
    if (dto.managerPin) {
      const manager = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!manager || !manager.quickPinHash) {
        throw new UnauthorizedException('Invalid manager PIN');
      }
      const pinValid = await bcrypt.compare(dto.managerPin, manager.quickPinHash);
      if (!pinValid) {
        throw new UnauthorizedException('Invalid manager PIN');
      }
      managerPinVerified = true;
    }

    const updated = await this.prisma.discount.update({
      where: { id: discountId },
      data: {
        status: DiscountStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
        managerPinVerified,
      },
    });

    // Recalculate order totals with the approved discount
    await this.recalcOrderDiscount(discount.orderId);

    await this.audit.log({
      actorUserId: userId,
      action: 'DISCOUNT_APPROVED',
      entityType: 'discount',
      entityId: discountId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: discount.orderId,
        approverUserId: userId,
        managerPinVerified,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Reject Discount ──

  async rejectDiscount(
    userId: string,
    ctx: BranchContext,
    discountId: string,
    dto: RejectDiscountDto,
    meta: RequestMeta,
  ) {
    const discount = await this.prisma.discount.findFirst({
      where: { id: discountId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    if (discount.status !== 'PENDING') {
      throw new ConflictException(`Cannot reject a discount in ${discount.status} status`);
    }

    const updated = await this.prisma.discount.update({
      where: { id: discountId },
      data: {
        status: DiscountStatus.REJECTED,
        rejectedById: userId,
        rejectedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
    });

    // Order totals remain unchanged — rejected discounts have no effect

    await this.audit.log({
      actorUserId: userId,
      action: 'DISCOUNT_REJECTED',
      entityType: 'discount',
      entityId: discountId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: discount.orderId,
        rejectorUserId: userId,
        rejectionReason: dto.rejectionReason,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── List Order Discounts ──

  async listOrderDiscounts(ctx: BranchContext, orderId: string, query: ListOrderDiscountsQueryDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      orderId,
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
    };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.discount.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          rejectedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.discount.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  // ── Get Discount By ID ──

  async getDiscount(ctx: BranchContext, discountId: string) {
    const discount = await this.prisma.discount.findFirst({
      where: { id: discountId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            subtotal: true,
            discount: true,
            total: true,
          },
        },
      },
    });
    if (!discount) throw new NotFoundException('Discount not found');
    return discount;
  }

  // ── List Pending Discounts ──

  async listPendingDiscounts(ctx: BranchContext) {
    return this.prisma.discount.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        status: 'PENDING',
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        order: { select: { id: true, orderNumber: true, subtotal: true, total: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Discount Math ──

  computeDiscountAmount(type: string, value: Decimal, orderSubtotal: Decimal | number): Decimal {
    const subtotal = new Decimal(orderSubtotal);
    if (type === 'PERCENTAGE') {
      return subtotal.mul(value).div(100).toDecimalPlaces(2);
    }
    // FIXED: cap at subtotal (never negative)
    return Decimal.min(value, subtotal).toDecimalPlaces(2);
  }

  // ── Recalculate Order Discount ──
  // Strategy: one active approved discount per order (latest approved wins)

  async recalcOrderDiscount(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { subtotal: true },
    });
    if (!order) return;

    // Get the latest approved discount for this order
    const approvedDiscount = await this.prisma.discount.findFirst({
      where: { orderId, status: 'APPROVED' },
      orderBy: { approvedAt: 'desc' },
    });

    let discountAmount = new Decimal(0);
    if (approvedDiscount) {
      discountAmount = this.computeDiscountAmount(
        approvedDiscount.type,
        approvedDiscount.value,
        order.subtotal,
      );
    }

    // total = subtotal - discount (tax deferred to M13)
    const total = new Decimal(order.subtotal).sub(discountAmount);

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        discount: discountAmount.toDecimalPlaces(2),
        total: Decimal.max(total, new Decimal(0)).toDecimalPlaces(2),
      },
    });
  }

  // ── Heavy Discount Anomaly Flag ──

  private async flagHeavyDiscount(orderId: string, _discountAmount: Decimal): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { anomalyFlags: true },
    });
    if (!order) return;

    const existing = (order.anomalyFlags as string[] | null) ?? [];
    if (!existing.includes('HEAVY_DISCOUNT')) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          anomalyFlags: [...existing, 'HEAVY_DISCOUNT'],
        },
      });
    }
  }
}
