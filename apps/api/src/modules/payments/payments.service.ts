import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, OrderStatus, PaymentStatus, PaymentIntentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { CloseOrderDto, CreatePaymentIntentDto, CancelPaymentIntentDto } from './dto';

interface BranchContext {
  branchId: string;
  organizationId: string;
  roleId?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// States from which an order can be closed with payment
const CLOSABLE_STATES: string[] = ['SERVED'];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Close Order with Payment ──
  async closeOrderWithPayment(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: CloseOrderDto,
    meta: RequestMeta,
  ) {
    // Load order
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (!CLOSABLE_STATES.includes(order.status)) {
      throw new ConflictException(
        `Cannot close order in ${order.status} state. Order must be SERVED.`,
      );
    }

    const orderTotal = new Decimal(order.total);

    // Validate payment amounts
    let totalPaid = new Decimal(0);
    let hasCash = false;
    for (const p of dto.payments) {
      if (new Decimal(p.amount).lte(0)) {
        throw new BadRequestException('Payment amounts must be positive');
      }
      totalPaid = totalPaid.add(new Decimal(p.amount));
      if (p.method === 'CASH') hasCash = true;

      // MOMO payments in close must reference a succeeded intent or be disallowed
      if (p.method === 'MOMO') {
        // MOMO can only be used in close if there's a SUCCEEDED intent for this order
        const succeededIntent = await this.prisma.paymentIntent.findFirst({
          where: {
            orderId,
            branchId: ctx.branchId,
            status: PaymentIntentStatus.SUCCEEDED,
          },
        });
        if (!succeededIntent) {
          throw new BadRequestException(
            'MOMO payment requires a succeeded payment intent. Create an intent first.',
          );
        }
      }
    }

    // Check overpayment: allow for cash (generate change), block for non-cash-only
    const changeDue = totalPaid.sub(orderTotal);
    if (changeDue.gt(0) && !hasCash) {
      throw new BadRequestException(
        'Overpayment is only allowed when CASH is included (change due is returned for cash)',
      );
    }

    // Check underpayment
    if (totalPaid.lt(orderTotal)) {
      throw new BadRequestException(
        `Insufficient payment: order total is ${orderTotal.toFixed(2)} but only ${totalPaid.toFixed(2)} provided`,
      );
    }

    // Create payment records and close order in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const paymentRecords = [];
      for (const p of dto.payments) {
        const payment = await tx.payment.create({
          data: {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            orderId,
            amount: p.amount,
            method: p.method,
            status: PaymentStatus.COMPLETED,
            transactionId: p.transactionId ?? null,
            metadata: p.metadata ? (p.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
        });
        paymentRecords.push(payment);
      }

      // Close the order
      const closedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CLOSED },
      });

      return { order: closedOrder, payments: paymentRecords };
    });

    // Audit
    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_PAID_AND_CLOSED',
      entityType: 'order',
      entityId: orderId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderTotal: orderTotal.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        changeDue: changeDue.gt(0) ? changeDue.toFixed(2) : '0.00',
        paymentCount: dto.payments.length,
        methods: dto.payments.map((p) => p.method),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    for (const payment of result.payments) {
      await this.audit.log({
        actorUserId: userId,
        action: 'PAYMENT_RECORDED',
        entityType: 'payment',
        entityId: payment.id,
        metadata: {
          orderId,
          method: payment.method,
          amount: payment.amount.toString(),
          status: payment.status,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return {
      order: result.order,
      payments: result.payments,
      orderTotal: orderTotal.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      changeDue: changeDue.gt(0) ? changeDue.toFixed(2) : '0.00',
    };
  }

  // ── Create Payment Intent (MOMO) ──
  async createPaymentIntent(
    userId: string,
    ctx: BranchContext,
    dto: CreatePaymentIntentDto,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (['VOIDED', 'CLOSED'].includes(order.status)) {
      throw new ConflictException(`Cannot create payment intent for ${order.status} order`);
    }

    // Create a PENDING intent — in production this would call the MOMO API
    const intent = await this.prisma.paymentIntent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: dto.orderId,
        provider: dto.provider,
        amount: dto.amount,
        currency: dto.currency ?? 'UGX',
        status: PaymentIntentStatus.REQUIRES_ACTION,
        providerRef: null, // Populated by provider callback in production
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : dto.phoneNumber
            ? ({ phoneNumber: dto.phoneNumber } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'PAYMENT_INTENT_CREATED',
      entityType: 'paymentIntent',
      entityId: intent.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: dto.orderId,
        provider: dto.provider,
        amount: dto.amount.toString(),
        currency: dto.currency ?? 'UGX',
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return intent;
  }

  // ── Cancel Payment Intent ──
  async cancelPaymentIntent(
    userId: string,
    ctx: BranchContext,
    intentId: string,
    dto: CancelPaymentIntentDto,
    meta: RequestMeta,
  ) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { id: intentId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!intent) throw new NotFoundException('Payment intent not found');

    const cancellableStates: PaymentIntentStatus[] = [
      PaymentIntentStatus.PENDING,
      PaymentIntentStatus.REQUIRES_ACTION,
    ];
    if (!cancellableStates.includes(intent.status)) {
      throw new ConflictException(`Cannot cancel intent in ${intent.status} status`);
    }

    const updated = await this.prisma.paymentIntent.update({
      where: { id: intentId },
      data: { status: PaymentIntentStatus.CANCELLED },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'PAYMENT_INTENT_CANCELLED',
      entityType: 'paymentIntent',
      entityId: intentId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: intent.orderId,
        reason: dto.reason ?? null,
        previousStatus: intent.status,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Process Webhook ──
  async processWebhook(provider: string, payload: Record<string, unknown>) {
    // 1. Persist raw webhook payload FIRST (before any processing)
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider,
        eventType: (payload.event_type as string) ?? (payload.eventType as string) ?? 'UNKNOWN',
        raw: payload as Prisma.InputJsonValue,
        verified: false,
      },
    });

    await this.audit.log({
      action: 'PAYMENT_WEBHOOK_RECEIVED',
      entityType: 'webhookEvent',
      entityId: webhookEvent.id,
      metadata: { provider, eventType: webhookEvent.eventType },
    });

    // 2. Attempt to resolve provider reference and update intent
    const providerRef =
      (payload.external_id as string) ??
      (payload.externalId as string) ??
      (payload.transaction_id as string) ??
      (payload.transactionId as string) ??
      null;

    const status = (payload.status as string) ?? (payload.transaction_status as string) ?? null;

    let intentUpdated = false;
    let paymentCreated = false;

    if (providerRef) {
      // Try to find a matching intent by providerRef
      let intent = await this.prisma.paymentIntent.findFirst({
        where: { providerRef, provider },
      });

      // If no match by providerRef, try to find by intent ID in payload
      if (!intent) {
        const intentId =
          (payload.payment_intent_id as string) ??
          (payload.paymentIntentId as string) ??
          (payload.reference as string) ??
          null;
        if (intentId) {
          intent = await this.prisma.paymentIntent.findFirst({
            where: { id: intentId, provider },
          });
        }
      }

      if (intent) {
        const normalizedStatus = this.normalizeProviderStatus(status);

        if (normalizedStatus) {
          await this.prisma.paymentIntent.update({
            where: { id: intent.id },
            data: {
              status: normalizedStatus,
              providerRef: providerRef ?? intent.providerRef,
            },
          });
          intentUpdated = true;

          // If succeeded, create a Payment record
          if (normalizedStatus === PaymentIntentStatus.SUCCEEDED) {
            const existingPayment = await this.prisma.payment.findFirst({
              where: {
                orderId: intent.orderId,
                transactionId: providerRef,
                method: 'MOMO',
              },
            });

            if (!existingPayment) {
              await this.prisma.payment.create({
                data: {
                  orgId: intent.orgId,
                  branchId: intent.branchId,
                  orderId: intent.orderId,
                  amount: intent.amount,
                  method: 'MOMO',
                  status: PaymentStatus.COMPLETED,
                  transactionId: providerRef,
                  metadata: { paymentIntentId: intent.id, provider },
                },
              });
              paymentCreated = true;
            }
          }
        }
      }
    }

    // Mark webhook as processed
    await this.prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        verified: true,
        processedAt: new Date(),
        metadata: { intentUpdated, paymentCreated, providerRef },
      },
    });

    return {
      webhookEventId: webhookEvent.id,
      intentUpdated,
      paymentCreated,
    };
  }

  // ── Get Order Payments ──
  async getOrderPayments(ctx: BranchContext, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const payments = await this.prisma.payment.findMany({
      where: { orderId, branchId: ctx.branchId },
      orderBy: { createdAt: 'asc' },
    });

    const intents = await this.prisma.paymentIntent.findMany({
      where: { orderId, branchId: ctx.branchId },
      orderBy: { createdAt: 'asc' },
    });

    return { payments, intents };
  }

  // ── Helpers ──

  private normalizeProviderStatus(status: string | null): PaymentIntentStatus | null {
    if (!status) return null;
    const upper = status.toUpperCase();
    switch (upper) {
      case 'SUCCESSFUL':
      case 'SUCCESS':
      case 'SUCCEEDED':
      case 'COMPLETED':
        return PaymentIntentStatus.SUCCEEDED;
      case 'FAILED':
      case 'FAILURE':
      case 'REJECTED':
        return PaymentIntentStatus.FAILED;
      case 'PENDING':
      case 'PROCESSING':
        return PaymentIntentStatus.PENDING;
      case 'CANCELLED':
      case 'CANCELED':
        return PaymentIntentStatus.CANCELLED;
      default:
        return null;
    }
  }
}
