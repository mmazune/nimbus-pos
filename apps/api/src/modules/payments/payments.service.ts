import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, OrderStatus, PaymentStatus, PaymentIntentStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { MtnAdapter } from './adapters/mtn.adapter';
import {
  CloseOrderDto,
  CreatePaymentIntentDto,
  CancelPaymentIntentDto,
  CreateManualReferencePaymentDto,
} from './dto';
import { randomUUID } from 'crypto';

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

// States from which a payment intent can be created
const PAYABLE_STATES: string[] = ['NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED'];

export type PaymentEventType =
  | 'PAYMENT_INTENT_CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_MANUAL_REFERENCE_RECORDED'
  | 'ORDER_BALANCE_UPDATED'
  | 'ORDER_AUTO_SETTLED';

export interface PaymentEvent {
  eventType: PaymentEventType;
  orderId: string;
  paymentIntentId?: string;
  paymentId?: string;
  provider?: string;
  status: string;
  amount?: string;
  remainingBalance?: string;
  verificationStatus?: string;
  at: string;
  branchId: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mtnAdapter: MtnAdapter,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  // ── Helpers ──

  async getOutstandingBalance(orderId: string, branchId: string): Promise<Decimal> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
    });
    if (!order) return new Decimal(0);

    const payments = await this.prisma.payment.findMany({
      where: { orderId, branchId, status: PaymentStatus.COMPLETED },
    });

    const totalPaid = payments.reduce((sum, p) => sum.add(new Decimal(p.amount)), new Decimal(0));
    const outstanding = new Decimal(order.total).sub(totalPaid);
    return outstanding.lt(0) ? new Decimal(0) : outstanding;
  }

  private async autoSettleIfFullyPaid(
    orderId: string,
    branchId: string,
    userId?: string,
    meta?: RequestMeta,
  ): Promise<boolean> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, branchId } });
    if (!order || order.status === 'CLOSED' || order.status === 'VOIDED') return false;

    const outstanding = await this.getOutstandingBalance(orderId, branchId);
    if (outstanding.lte(0)) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CLOSED },
      });

      await this.audit.log({
        actorUserId: userId ?? null,
        action: 'ORDER_AUTO_SETTLED',
        entityType: 'order',
        entityId: orderId,
        metadata: {
          branchId,
          orderTotal: order.total.toString(),
          trigger: 'auto_settle_balance_zero',
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      this.emitEvent({
        eventType: 'ORDER_AUTO_SETTLED',
        orderId,
        status: 'CLOSED',
        remainingBalance: '0.00',
        at: new Date().toISOString(),
        branchId,
      });
      return true;
    }

    this.emitEvent({
      eventType: 'ORDER_BALANCE_UPDATED',
      orderId,
      status: order.status,
      remainingBalance: outstanding.toFixed(2),
      at: new Date().toISOString(),
      branchId,
    });
    return false;
  }

  private emitEvent(event: PaymentEvent) {
    this.eventEmitter.emit('payment.update', event);
  }

  // ── Close Order with Payment ──

  async closeOrderWithPayment(
    userId: string,
    ctx: BranchContext,
    orderId: string,
    dto: CloseOrderDto,
    meta: RequestMeta,
  ) {
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
    const alreadyPaid = order.payments
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, p) => sum.add(new Decimal(p.amount)), new Decimal(0));

    let totalNewPaid = new Decimal(0);
    let hasCash = false;
    for (const p of dto.payments) {
      if (new Decimal(p.amount).lte(0)) {
        throw new BadRequestException('Payment amounts must be positive');
      }
      totalNewPaid = totalNewPaid.add(new Decimal(p.amount));
      if (p.method === 'CASH') hasCash = true;

      if (p.method === 'MOMO') {
        const succeededIntent = await this.prisma.paymentIntent.findFirst({
          where: { orderId, branchId: ctx.branchId, status: PaymentIntentStatus.SUCCEEDED },
        });
        if (!succeededIntent) {
          throw new BadRequestException(
            'MOMO payment requires a succeeded payment intent. Create an intent first.',
          );
        }
      }
    }

    // Block close if pending MOMO intents exist
    const pendingIntents = await this.prisma.paymentIntent.findMany({
      where: {
        orderId,
        branchId: ctx.branchId,
        status: { in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.REQUIRES_ACTION] },
      },
    });
    if (pendingIntents.length > 0) {
      throw new ConflictException(
        'Cannot close order while MOMO payment intents are still pending. Cancel or wait for resolution.',
      );
    }

    const totalCovered = alreadyPaid.add(totalNewPaid);
    const changeDue = totalCovered.sub(orderTotal);

    if (changeDue.gt(0) && !hasCash) {
      throw new BadRequestException(
        'Overpayment is only allowed when CASH is included (change due is returned for cash)',
      );
    }

    if (totalCovered.lt(orderTotal)) {
      throw new BadRequestException(
        `Insufficient payment: order total is ${orderTotal.toFixed(2)} but only ${totalCovered.toFixed(2)} covered`,
      );
    }

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
            captureMode: 'ONLINE_PROVIDER',
            verificationStatus: 'NOT_REQUIRED',
            transactionId: p.transactionId ?? null,
            postedAt: new Date(),
            metadata: p.metadata ? (p.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
        });
        paymentRecords.push(payment);
      }

      const closedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CLOSED },
      });

      return { order: closedOrder, payments: paymentRecords };
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_PAID_AND_CLOSED',
      entityType: 'order',
      entityId: orderId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderTotal: orderTotal.toFixed(2),
        totalPaid: totalCovered.toFixed(2),
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

    this.emitEvent({
      eventType: 'ORDER_AUTO_SETTLED',
      orderId,
      status: 'CLOSED',
      remainingBalance: '0.00',
      at: new Date().toISOString(),
      branchId: ctx.branchId,
    });

    return {
      order: result.order,
      payments: result.payments,
      orderTotal: orderTotal.toFixed(2),
      totalPaid: totalCovered.toFixed(2),
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

    if (!PAYABLE_STATES.includes(order.status)) {
      throw new ConflictException(
        `Cannot create payment intent for order in ${order.status} state`,
      );
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.paymentIntent.findFirst({
        where: { idempotencyKey: dto.idempotencyKey, branchId: ctx.branchId },
      });
      if (existing) return existing;
    }

    const msisdn = dto.phoneNumber.replace(/^\+/, '');
    const externalId = randomUUID();

    const intent = await this.prisma.paymentIntent.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: dto.orderId,
        provider: dto.provider,
        amount: dto.amount,
        currency: dto.currency ?? this.mtnAdapter.getDefaultCurrency(),
        status: PaymentIntentStatus.REQUIRES_ACTION,
        customerPhone: dto.phoneNumber,
        externalId,
        requestedAmount: dto.amount,
        requestedMsisdn: msisdn,
        idempotencyKey: dto.idempotencyKey ?? null,
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : ({ phoneNumber: dto.phoneNumber } as Prisma.InputJsonValue),
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
        externalId,
        phoneNumber: dto.phoneNumber,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    this.emitEvent({
      eventType: 'PAYMENT_INTENT_CREATED',
      orderId: dto.orderId,
      paymentIntentId: intent.id,
      provider: dto.provider,
      status: 'REQUIRES_ACTION',
      amount: dto.amount.toString(),
      at: new Date().toISOString(),
      branchId: ctx.branchId,
    });

    // MTN real call
    if (dto.provider === 'MTN' && this.mtnAdapter.isEnabled()) {
      try {
        const result = await this.mtnAdapter.requestToPay({
          externalId,
          amount: String(dto.amount),
          currency: dto.currency ?? this.mtnAdapter.getDefaultCurrency(),
          payerMsisdn: msisdn,
        });

        await this.audit.log({
          actorUserId: userId,
          action: 'PAYMENT_INTENT_OUTBOUND_SENT',
          entityType: 'paymentIntent',
          entityId: intent.id,
          metadata: {
            provider: 'MTN',
            externalId,
            success: result.success,
            httpStatus: result.httpStatus,
            error: result.error,
          },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });

        if (!result.success) {
          await this.prisma.paymentIntent.update({
            where: { id: intent.id },
            data: {
              status: PaymentIntentStatus.FAILED,
              failureReason: result.error ?? 'MTN RequestToPay failed',
            },
          });
          this.emitEvent({
            eventType: 'PAYMENT_FAILED',
            orderId: dto.orderId,
            paymentIntentId: intent.id,
            provider: dto.provider,
            status: 'FAILED',
            amount: dto.amount.toString(),
            at: new Date().toISOString(),
            branchId: ctx.branchId,
          });
          return await this.prisma.paymentIntent.findUnique({ where: { id: intent.id } });
        }

        this.emitEvent({
          eventType: 'PAYMENT_PENDING',
          orderId: dto.orderId,
          paymentIntentId: intent.id,
          provider: dto.provider,
          status: 'REQUIRES_ACTION',
          amount: dto.amount.toString(),
          at: new Date().toISOString(),
          branchId: ctx.branchId,
        });
      } catch (err) {
        this.logger.error(`MTN RequestToPay failed for intent ${intent.id}`, err);
        await this.prisma.paymentIntent.update({
          where: { id: intent.id },
          data: {
            status: PaymentIntentStatus.FAILED,
            failureReason: err instanceof Error ? err.message : 'Unknown error',
          },
        });
      }
    }

    return intent;
  }

  // ── Get Payment Intent ──

  async getPaymentIntent(ctx: BranchContext, intentId: string) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { id: intentId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!intent) throw new NotFoundException('Payment intent not found');
    return intent;
  }

  // ── Get Payment Intent Status ──

  async getPaymentIntentStatus(ctx: BranchContext, intentId: string) {
    const intent = await this.getPaymentIntent(ctx, intentId);
    const outstanding = await this.getOutstandingBalance(intent.orderId, ctx.branchId);
    return {
      id: intent.id,
      status: intent.status,
      provider: intent.provider,
      externalId: intent.externalId,
      requestedAmount: intent.requestedAmount?.toString(),
      confirmedAmount: intent.confirmedAmount?.toString() ?? null,
      failureReason: intent.failureReason,
      remainingBalance: outstanding.toFixed(2),
    };
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

    this.emitEvent({
      eventType: 'PAYMENT_CANCELLED',
      orderId: intent.orderId,
      paymentIntentId: intentId,
      provider: intent.provider,
      status: 'CANCELLED',
      at: new Date().toISOString(),
      branchId: ctx.branchId,
    });

    return updated;
  }

  // ── Process Webhook ──

  async processWebhook(
    provider: string,
    payload: Record<string, unknown>,
    headers?: Record<string, string>,
  ) {
    // 1. Persist raw payload FIRST
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider,
        eventType: (payload.event_type as string) ?? (payload.eventType as string) ?? 'UNKNOWN',
        raw: payload as Prisma.InputJsonValue,
        verified: false,
        signature: headers?.['x-signature'] ?? headers?.['authorization'] ?? null,
        headers: headers ? (headers as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    await this.audit.log({
      action: 'PAYMENT_WEBHOOK_RECEIVED',
      entityType: 'webhookEvent',
      entityId: webhookEvent.id,
      metadata: { provider, eventType: webhookEvent.eventType },
    });

    // 2. Resolve references
    const externalId =
      (payload.externalId as string) ??
      (payload.external_id as string) ??
      (payload.referenceId as string) ??
      null;

    const providerTransactionId =
      (payload.financialTransactionId as string) ??
      (payload.transaction_id as string) ??
      (payload.transactionId as string) ??
      null;

    const status = (payload.status as string) ?? (payload.transaction_status as string) ?? null;

    let intentUpdated = false;
    let paymentCreated = false;
    let autoSettled = false;
    let processingError: string | null = null;

    try {
      if (externalId) {
        let intent = await this.prisma.paymentIntent.findUnique({ where: { externalId } });
        if (!intent) {
          intent = await this.prisma.paymentIntent.findFirst({
            where: { providerRef: externalId, provider },
          });
        }
        if (!intent && providerTransactionId) {
          intent = await this.prisma.paymentIntent.findFirst({
            where: { providerTransactionId, provider },
          });
        }

        if (intent) {
          const normalizedStatus = this.mtnAdapter.normalizeStatus(status);

          if (normalizedStatus) {
            await this.prisma.paymentIntent.update({
              where: { id: intent.id },
              data: {
                status: normalizedStatus as PaymentIntentStatus,
                providerRef: externalId ?? intent.providerRef,
                providerTransactionId: providerTransactionId ?? intent.providerTransactionId,
                confirmedAmount: payload.amount ? new Decimal(String(payload.amount)) : null,
                confirmedMsisdn: (payload.payer as Record<string, string>)?.partyId ?? null,
                webhookEventIdLast: webhookEvent.id,
                failureReason:
                  normalizedStatus === 'FAILED'
                    ? ((payload.reason as Record<string, string>)?.message ??
                      (payload.reason as string) ??
                      null)
                    : null,
              },
            });
            intentUpdated = true;

            await this.audit.log({
              action: 'PAYMENT_WEBHOOK_VERIFIED',
              entityType: 'paymentIntent',
              entityId: intent.id,
              metadata: { provider, normalizedStatus, externalId, providerTransactionId },
            });

            if (normalizedStatus === 'SUCCEEDED') {
              const existingPayment = await this.prisma.payment.findFirst({
                where: { orderId: intent.orderId, method: 'MOMO', transactionId: externalId },
              });

              if (!existingPayment) {
                const payment = await this.prisma.payment.create({
                  data: {
                    orgId: intent.orgId,
                    branchId: intent.branchId,
                    orderId: intent.orderId,
                    amount: intent.confirmedAmount ?? intent.amount,
                    method: 'MOMO',
                    status: PaymentStatus.COMPLETED,
                    captureMode: 'ONLINE_PROVIDER',
                    verificationStatus: 'NOT_REQUIRED',
                    transactionId: externalId,
                    externalTransactionId: providerTransactionId,
                    payerPhone: intent.customerPhone,
                    postedAt: new Date(),
                    metadata: { paymentIntentId: intent.id, provider },
                  },
                });
                paymentCreated = true;

                await this.audit.log({
                  action: 'PAYMENT_RECORDED',
                  entityType: 'payment',
                  entityId: payment.id,
                  metadata: {
                    orderId: intent.orderId,
                    method: 'MOMO',
                    amount: payment.amount.toString(),
                    trigger: 'webhook',
                  },
                });

                this.emitEvent({
                  eventType: 'PAYMENT_SUCCEEDED',
                  orderId: intent.orderId,
                  paymentIntentId: intent.id,
                  paymentId: payment.id,
                  provider,
                  status: 'COMPLETED',
                  amount: payment.amount.toString(),
                  at: new Date().toISOString(),
                  branchId: intent.branchId,
                });

                autoSettled = await this.autoSettleIfFullyPaid(intent.orderId, intent.branchId);
              }
            } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'CANCELLED') {
              this.emitEvent({
                eventType: normalizedStatus === 'FAILED' ? 'PAYMENT_FAILED' : 'PAYMENT_CANCELLED',
                orderId: intent.orderId,
                paymentIntentId: intent.id,
                provider,
                status: normalizedStatus,
                at: new Date().toISOString(),
                branchId: intent.branchId,
              });
            }
          }
        }
      }
    } catch (err) {
      processingError = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook processing error: ${processingError}`);
    }

    await this.prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        verified: intentUpdated,
        processedAt: new Date(),
        processingError,
        metadata: { intentUpdated, paymentCreated, autoSettled, externalId },
      },
    });

    return { webhookEventId: webhookEvent.id, intentUpdated, paymentCreated, autoSettled };
  }

  // ── Get Order Payments (with balance) ──

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

    const outstanding = await this.getOutstandingBalance(orderId, ctx.branchId);

    return {
      payments,
      intents,
      orderTotal: order.total.toString(),
      totalPaid: payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum.add(new Decimal(p.amount)), new Decimal(0))
        .toFixed(2),
      remainingBalance: outstanding.toFixed(2),
      isSettled: order.status === 'CLOSED',
    };
  }

  // ── Manual Reference Payment ──

  async createManualReferencePayment(
    userId: string,
    ctx: BranchContext,
    dto: CreateManualReferencePaymentDto,
    meta: RequestMeta,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (['VOIDED'].includes(order.status)) {
      throw new ConflictException(`Cannot add payment to ${order.status} order`);
    }

    // Dedupe by externalTransactionId
    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId: dto.orderId,
        branchId: ctx.branchId,
        externalTransactionId: dto.externalTransactionId,
      },
    });
    if (existing) {
      throw new ConflictException(
        `A payment with transaction ID "${dto.externalTransactionId}" already exists for this order`,
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: dto.orderId,
        amount: dto.amount,
        method: dto.method,
        status: PaymentStatus.COMPLETED,
        captureMode: 'MANUAL_REFERENCE',
        verificationStatus: 'UNVERIFIED',
        externalTransactionId: dto.externalTransactionId,
        payerPhone: dto.payerPhone ?? null,
        postedAt: dto.postedAt ? new Date(dto.postedAt) : new Date(),
        enteredById: userId,
        verificationNote: dto.note ?? null,
        metadata: { provider: dto.provider ?? null, captureMode: 'MANUAL_REFERENCE' },
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'PAYMENT_MANUAL_REFERENCE_RECORDED',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        orderId: dto.orderId,
        method: dto.method,
        amount: dto.amount.toString(),
        externalTransactionId: dto.externalTransactionId,
        provider: dto.provider,
        verificationStatus: 'UNVERIFIED',
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const outstanding = await this.getOutstandingBalance(dto.orderId, ctx.branchId);

    this.emitEvent({
      eventType: 'PAYMENT_MANUAL_REFERENCE_RECORDED',
      orderId: dto.orderId,
      paymentId: payment.id,
      provider: dto.provider,
      status: 'COMPLETED',
      amount: dto.amount.toString(),
      remainingBalance: outstanding.toFixed(2),
      verificationStatus: 'UNVERIFIED',
      at: new Date().toISOString(),
      branchId: ctx.branchId,
    });

    const autoSettled = await this.autoSettleIfFullyPaid(dto.orderId, ctx.branchId, userId, meta);

    return {
      payment,
      remainingBalance: (await this.getOutstandingBalance(dto.orderId, ctx.branchId)).toFixed(2),
      autoSettled,
    };
  }

  // ── Get Manual Reference Payment ──

  async getManualReferencePayment(ctx: BranchContext, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        captureMode: 'MANUAL_REFERENCE',
      },
    });
    if (!payment) throw new NotFoundException('Manual reference payment not found');
    return payment;
  }

  // ── List Manual Reference Payments ──

  async listManualReferencePayments(ctx: BranchContext, verificationStatus?: string) {
    const where: Prisma.PaymentWhereInput = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
      captureMode: 'MANUAL_REFERENCE',
    };
    if (verificationStatus) {
      where.verificationStatus = verificationStatus as Prisma.EnumPaymentVerificationStatusFilter;
    }
    return this.prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}
