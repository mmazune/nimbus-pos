import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, RefundStatus, PaymentStatus, OrderStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { CreateRefundDto, ApproveRefundDto, PostCloseVoidDto } from './dto';

interface BranchContext {
  branchId: string;
  organizationId: string;
  roleId?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// Post-close void window in minutes
const POST_CLOSE_VOID_WINDOW_MINUTES = 15;

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Create Refund ──

  async createRefund(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: CreateRefundDto,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'CLOSED') {
      throw new ConflictException('Refunds can only be issued on CLOSED orders');
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        id: dto.paymentId,
        orderId,
        branchId: ctx.branchId,
        status: PaymentStatus.COMPLETED,
      },
    });
    if (!payment) throw new NotFoundException('Completed payment not found on this order');

    const refundAmount = new Decimal(dto.amount);

    // Check that refund amount does not exceed payment amount minus existing refunds
    const existingRefunds = await this.prisma.refund.findMany({
      where: {
        paymentId: dto.paymentId,
        status: { in: [RefundStatus.PENDING, RefundStatus.APPROVED, RefundStatus.COMPLETED] },
      },
    });
    const totalRefunded = existingRefunds.reduce(
      (sum, r) => sum.add(new Decimal(r.amount)),
      new Decimal(0),
    );
    const available = new Decimal(payment.amount).sub(totalRefunded);
    if (refundAmount.gt(available)) {
      throw new BadRequestException(
        `Refund amount exceeds available balance. Max refundable: ${available.toFixed(2)}`,
      );
    }

    // Auto-approve vs pending: use org threshold
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId: ctx.organizationId },
    });
    const threshold = settings?.discountApprovalThreshold ?? new Decimal(5000);
    const autoApprove = refundAmount.lte(threshold);
    const status = autoApprove ? RefundStatus.COMPLETED : RefundStatus.PENDING;

    const refund = await this.prisma.refund.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId,
        paymentId: dto.paymentId,
        provider: dto.provider ?? payment.method,
        amount: dto.amount,
        reason: dto.reason,
        status,
        createdById: userId,
        approvedById: autoApprove ? userId : null,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    // If auto-approved (COMPLETED), mark payment as REFUNDED if fully refunded
    if (autoApprove) {
      await this.checkAndMarkPaymentRefunded(dto.paymentId);
    }

    // Flag anomaly if above threshold
    if (!autoApprove) {
      await this.flagRefundAnomaly(orderId, refundAmount);
    }

    await this.audit.log({
      actorUserId: userId,
      action: autoApprove ? 'REFUND_AUTO_COMPLETED' : 'REFUND_REQUESTED',
      entityType: 'refund',
      entityId: refund.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId,
        paymentId: dto.paymentId,
        amount: dto.amount.toString(),
        reason: dto.reason,
        status,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return refund;
  }

  // ── Approve Refund ──

  async approveRefund(
    userId: string,
    ctx: BranchContext,
    refundId: string,
    dto: ApproveRefundDto,
    meta: RequestMeta,
  ) {
    const refund = await this.prisma.refund.findFirst({
      where: { id: refundId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (refund.status !== 'PENDING') {
      throw new ConflictException(`Cannot approve a refund in ${refund.status} status`);
    }

    // Manager PIN verification (required for high-value refund approval)
    if (dto.managerPin) {
      const manager = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!manager || !manager.quickPinHash) {
        throw new UnauthorizedException('Invalid manager PIN');
      }
      const pinValid = await bcrypt.compare(dto.managerPin, manager.quickPinHash);
      if (!pinValid) {
        throw new UnauthorizedException('Invalid manager PIN');
      }
    }

    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.COMPLETED,
        approvedById: userId,
      },
    });

    await this.checkAndMarkPaymentRefunded(refund.paymentId);

    await this.audit.log({
      actorUserId: userId,
      action: 'REFUND_APPROVED',
      entityType: 'refund',
      entityId: refundId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: refund.orderId,
        paymentId: refund.paymentId,
        amount: refund.amount.toString(),
        pinVerified: !!dto.managerPin,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Get Refund ──

  async getRefund(ctx: BranchContext, refundId: string) {
    const refund = await this.prisma.refund.findFirst({
      where: { id: refundId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  // ── List Order Refunds ──

  async listOrderRefunds(ctx: BranchContext, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.refund.findMany({
      where: { orderId, branchId: ctx.branchId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Post-Close Void ──

  async postCloseVoid(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: PostCloseVoidDto,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'CLOSED') {
      throw new ConflictException('Post-close void is only allowed on CLOSED orders');
    }

    // Enforce 15-minute window from when the order was last updated (closed)
    const closedAt = order.updatedAt;
    const elapsedMs = Date.now() - closedAt.getTime();
    const windowMs = POST_CLOSE_VOID_WINDOW_MINUTES * 60 * 1000;
    if (elapsedMs > windowMs) {
      throw new ForbiddenException(
        `Post-close void window of ${POST_CLOSE_VOID_WINDOW_MINUTES} minutes has expired`,
      );
    }

    // Require manager PIN
    const manager = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!manager || !manager.quickPinHash) {
      throw new UnauthorizedException('Manager PIN required for post-close void');
    }
    const pinValid = await bcrypt.compare(dto.managerPin, manager.quickPinHash);
    if (!pinValid) {
      throw new UnauthorizedException('Invalid manager PIN');
    }

    // Void the order and mark all completed payments as REFUNDED
    const updated = await this.prisma.$transaction(async (tx) => {
      const voidedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.VOIDED },
      });

      await tx.payment.updateMany({
        where: { orderId, branchId: ctx.branchId, status: PaymentStatus.COMPLETED },
        data: { status: PaymentStatus.REFUNDED },
      });

      return voidedOrder;
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_POST_CLOSE_VOIDED',
      entityType: 'order',
      entityId: orderId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        reason: dto.reason,
        closedAt: closedAt.toISOString(),
        voidedAt: new Date().toISOString(),
        elapsedMinutes: Math.round(elapsedMs / 60000),
        pinVerified: true,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Helpers ──

  private async checkAndMarkPaymentRefunded(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return;

    const completedRefunds = await this.prisma.refund.findMany({
      where: { paymentId, status: RefundStatus.COMPLETED },
    });
    const totalRefunded = completedRefunds.reduce(
      (sum, r) => sum.add(new Decimal(r.amount)),
      new Decimal(0),
    );

    if (totalRefunded.gte(new Decimal(payment.amount))) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED },
      });
    }
  }

  private async flagRefundAnomaly(orderId: string, amount: Decimal): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;

    const existing = (order.anomalyFlags as Record<string, unknown>) ?? {};
    const flags = {
      ...existing,
      highValueRefund: {
        amount: amount.toFixed(2),
        flaggedAt: new Date().toISOString(),
      },
    };

    await this.prisma.order.update({
      where: { id: orderId },
      data: { anomalyFlags: flags as Prisma.InputJsonValue },
    });
  }
}
