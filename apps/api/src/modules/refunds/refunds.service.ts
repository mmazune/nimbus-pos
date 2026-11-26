import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, RefundStatus, PaymentStatus, OrderStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { CreateRefundDto, ApproveRefundDto, PostCloseVoidDto } from './dto';
import { ApprovalRequestsService, ANSWER_MANAGER_KEY, sameBusinessDay } from '../approval-requests';

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
export class RefundsService implements OnModuleInit {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalRequestsService,
  ) {}

  /** T6: what a manager's answer to a later-day refund does. */
  onModuleInit() {
    this.approvals.registerEffect('REFUND', {
      approve: async (tx, req, approverId) => {
        const done = await tx.refund.updateMany({
          where: { id: req.subjectId, status: RefundStatus.PENDING },
          data: { status: RefundStatus.COMPLETED, approvedById: approverId },
        });
        if (done.count !== 1) throw new ConflictException('Refund is no longer pending');
        const refund = await tx.refund.findUniqueOrThrow({ where: { id: req.subjectId } });
        await this.markPaymentRefundedIfFull(tx, refund.paymentId);
      },
      decline: async (tx, req) => {
        await tx.refund.updateMany({
          where: { id: req.subjectId, status: RefundStatus.PENDING },
          data: { status: RefundStatus.DECLINED },
        });
      },
    });
  }

  private async markPaymentRefundedIfFull(tx: Prisma.TransactionClient, paymentId: string) {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return;
    const done = await tx.refund.findMany({ where: { paymentId, status: RefundStatus.COMPLETED } });
    const total = done.reduce((sum, r) => sum.add(new Decimal(r.amount)), new Decimal(0));
    if (total.gte(new Decimal(payment.amount))) {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED },
      });
    }
  }

  // ── Create Refund ──

  async createRefund(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: CreateRefundDto,
    meta: RequestMeta,
    permissions: string[] = [],
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
    // T6 (07-scenarios-and-rules.md, Money): a refund after close is a supervisor's on the
    // same business day, a manager's after it. A manager (or owner) refunds at once on any day;
    // a supervisor at once on the day the bill was paid; on a later day a supervisor's refund
    // waits for a manager, by PIN on this device or from Approvals.
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId: ctx.organizationId },
    });
    const endsHour = settings?.businessDayEndsHour ?? 5;
    // The bill's day is the day this payment was taken (orders carry no close time).
    const closedAt = payment.createdAt;
    const isManager = permissions.includes(ANSWER_MANAGER_KEY);
    const sameDay = sameBusinessDay(closedAt, new Date(), endsHour);
    const autoApprove = isManager || sameDay;
    const status = autoApprove ? RefundStatus.COMPLETED : RefundStatus.PENDING;

    const { refund, request } = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
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
      if (autoApprove) {
        await this.markPaymentRefundedIfFull(tx, dto.paymentId);
        return { refund, request: null };
      }
      const request = await this.approvals.open(tx, ctx, {
        kind: 'REFUND',
        level: 'MANAGER',
        subjectType: 'Refund',
        subjectId: refund.id,
        summary: `Refund ${refundAmount.toFixed(0)} on order ${order.orderNumber ?? order.id}, paid on an earlier day`,
        amount: refundAmount,
        payload: { orderId, paymentId: dto.paymentId, closedAt: closedAt.toISOString() },
        requestedById: userId,
      });
      return { refund, request };
    });

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
        sameBusinessDay: sameDay,
        approvalRequestId: request?.id ?? null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { ...refund, approvalRequestId: request?.id ?? null, needs: request ? 'MANAGER' : null };
  }

  // ── Approve Refund ──

  /**
   * T6: approving a pending refund answers its request for approval, so the same rule holds
   * whichever door is used: a refund on an earlier business day needs a manager.
   */
  async approveRefund(
    userId: string,
    ctx: BranchContext,
    refundId: string,
    _dto: ApproveRefundDto,
    _meta: RequestMeta,
    permissions: string[] = [],
  ) {
    const refund = await this.prisma.refund.findFirst({
      where: { id: refundId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status !== 'PENDING') {
      throw new ConflictException(`Cannot approve a refund in ${refund.status} status`);
    }
    const request = await this.prisma.approvalRequest.findFirst({
      where: { subjectType: 'Refund', subjectId: refund.id, status: 'PENDING' },
    });
    if (!request) {
      throw new ConflictException('This refund has no open request for approval');
    }
    await this.approvals.decide(ctx, { id: userId, permissions }, request.id, 'APPROVE');
    return this.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
  }

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
