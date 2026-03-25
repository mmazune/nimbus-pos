import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { MtnAdapter } from './adapters/mtn.adapter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let audit: any;
  let mtnAdapter: any;
  let eventEmitter: any;

  const ctx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
  };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      order: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      paymentIntent: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      webhookEvent: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    mtnAdapter = {
      isEnabled: jest.fn().mockReturnValue(false),
      getDefaultCurrency: jest.fn().mockReturnValue('UGX'),
      requestToPay: jest.fn(),
      normalizeStatus: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: MtnAdapter, useValue: mtnAdapter },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  // ══════════════════════════════════════════════
  // Close Order with Payment
  // ══════════════════════════════════════════════

  it('should close a SERVED order with a single cash payment', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findMany.mockResolvedValue([]);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'CASH',
      amount: new Decimal(100),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

    const result = await service.closeOrderWithPayment(
      'user-1',
      ctx,
      'order-1',
      { payments: [{ method: 'CASH', amount: 100 }] },
      meta,
    );

    expect(result.order.status).toBe('CLOSED');
    expect(result.payments).toHaveLength(1);
    expect(result.changeDue).toBe('0.00');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should allow cash overpayment and compute changeDue', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(80),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findMany.mockResolvedValue([]);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'CASH',
      amount: new Decimal(100),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

    const result = await service.closeOrderWithPayment(
      'user-1',
      ctx,
      'order-1',
      { payments: [{ method: 'CASH', amount: 100 }] },
      meta,
    );

    expect(result.changeDue).toBe('20.00');
  });

  it('should accept split payment across methods', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(150),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findMany.mockResolvedValue([]);
    prisma.payment.create
      .mockResolvedValueOnce({
        id: 'pay-1',
        method: 'CASH',
        amount: new Decimal(80),
        status: 'COMPLETED',
      })
      .mockResolvedValueOnce({
        id: 'pay-2',
        method: 'CARD',
        amount: new Decimal(70),
        status: 'COMPLETED',
      });
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

    const result = await service.closeOrderWithPayment(
      'user-1',
      ctx,
      'order-1',
      {
        payments: [
          { method: 'CASH', amount: 80 },
          { method: 'CARD', amount: 70, transactionId: 'TXN-001' },
        ],
      },
      meta,
    );

    expect(result.payments).toHaveLength(2);
    expect(result.changeDue).toBe('0.00');
  });

  it('should reject insufficient payment total', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findMany.mockResolvedValue([]);

    await expect(
      service.closeOrderWithPayment(
        'user-1',
        ctx,
        'order-1',
        { payments: [{ method: 'CASH', amount: 50 }] },
        meta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject overpayment without cash', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findMany.mockResolvedValue([]);

    await expect(
      service.closeOrderWithPayment(
        'user-1',
        ctx,
        'order-1',
        { payments: [{ method: 'CARD', amount: 120 }] },
        meta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject close on a NEW order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'NEW',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });

    await expect(
      service.closeOrderWithPayment(
        'user-1',
        ctx,
        'order-1',
        { payments: [{ method: 'CASH', amount: 100 }] },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject close on a VOIDED order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'VOIDED',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });

    await expect(
      service.closeOrderWithPayment(
        'user-1',
        ctx,
        'order-1',
        { payments: [{ method: 'CASH', amount: 100 }] },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if order does not exist', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.closeOrderWithPayment(
        'user-1',
        ctx,
        'order-x',
        { payments: [{ method: 'CASH', amount: 100 }] },
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject MOMO payment without a succeeded intent', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findFirst.mockResolvedValue(null);

    await expect(
      service.closeOrderWithPayment(
        'user-1',
        ctx,
        'order-1',
        { payments: [{ method: 'MOMO', amount: 100 }] },
        meta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow MOMO payment with a succeeded intent', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findFirst
      .mockResolvedValueOnce({ id: 'intent-1', status: 'SUCCEEDED' }) // for MOMO check
      .mockResolvedValueOnce(null); // fallback in webhook (unused)
    prisma.paymentIntent.findMany.mockResolvedValue([]);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'MOMO',
      amount: new Decimal(100),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

    const result = await service.closeOrderWithPayment(
      'user-1',
      ctx,
      'order-1',
      { payments: [{ method: 'MOMO', amount: 100 }] },
      meta,
    );

    expect(result.order.status).toBe('CLOSED');
  });

  it('should block close with pending intents', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findMany.mockResolvedValue([{ id: 'intent-1', status: 'PENDING' }]);

    await expect(
      service.closeOrderWithPayment(
        'user-1',
        ctx,
        'order-1',
        { payments: [{ method: 'CASH', amount: 100 }] },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should account for already-paid amounts when closing', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [{ id: 'pay-old', status: 'COMPLETED', amount: new Decimal(60) }],
    });
    prisma.paymentIntent.findMany.mockResolvedValue([]);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'CASH',
      amount: new Decimal(40),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

    const result = await service.closeOrderWithPayment(
      'user-1',
      ctx,
      'order-1',
      { payments: [{ method: 'CASH', amount: 40 }] },
      meta,
    );

    expect(result.order.status).toBe('CLOSED');
    expect(result.totalPaid).toBe('100.00');
  });

  // ══════════════════════════════════════════════
  // Create Payment Intent
  // ══════════════════════════════════════════════

  it('should create a MOMO payment intent for a valid order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.paymentIntent.create.mockResolvedValue({
      id: 'intent-1',
      provider: 'MTN',
      amount: new Decimal(50000),
      status: 'REQUIRES_ACTION',
    });

    const result = await service.createPaymentIntent(
      'user-1',
      ctx,
      { orderId: 'order-1', provider: 'MTN', amount: 50000, phoneNumber: '+256700000000' },
      meta,
    );

    expect(result!.status).toBe('REQUIRES_ACTION');
    expect(result!.provider).toBe('MTN');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.update',
      expect.objectContaining({ eventType: 'PAYMENT_INTENT_CREATED' }),
    );
  });

  it('should reject intent creation on VOIDED order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'VOIDED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.createPaymentIntent(
        'user-1',
        ctx,
        { orderId: 'order-1', provider: 'MTN', amount: 50000, phoneNumber: '256700000000' },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject intent creation on CLOSED order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.createPaymentIntent(
        'user-1',
        ctx,
        { orderId: 'order-1', provider: 'AIRTEL', amount: 30000, phoneNumber: '256700000000' },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException for non-existent order on intent creation', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.createPaymentIntent(
        'user-1',
        ctx,
        { orderId: 'order-x', provider: 'MTN', amount: 50000, phoneNumber: '256700000000' },
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return existing intent for duplicate idempotencyKey', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-existing',
      idempotencyKey: 'key-1',
      status: 'REQUIRES_ACTION',
    });

    const result = await service.createPaymentIntent(
      'user-1',
      ctx,
      {
        orderId: 'order-1',
        provider: 'MTN',
        amount: 50000,
        phoneNumber: '256700000000',
        idempotencyKey: 'key-1',
      },
      meta,
    );

    expect(result!.id).toBe('intent-existing');
    expect(prisma.paymentIntent.create).not.toHaveBeenCalled();
  });

  it('should call MTN adapter when enabled', async () => {
    mtnAdapter.isEnabled.mockReturnValue(true);
    mtnAdapter.requestToPay.mockResolvedValue({ success: true, httpStatus: 202 });
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.paymentIntent.create.mockResolvedValue({
      id: 'intent-1',
      provider: 'MTN',
      amount: new Decimal(50000),
      status: 'REQUIRES_ACTION',
    });

    await service.createPaymentIntent(
      'user-1',
      ctx,
      { orderId: 'order-1', provider: 'MTN', amount: 50000, phoneNumber: '+256700000000' },
      meta,
    );

    expect(mtnAdapter.requestToPay).toHaveBeenCalled();
  });

  it('should mark intent FAILED when MTN adapter returns error', async () => {
    mtnAdapter.isEnabled.mockReturnValue(true);
    mtnAdapter.requestToPay.mockResolvedValue({
      success: false,
      httpStatus: 500,
      error: 'Internal Error',
    });
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.paymentIntent.create.mockResolvedValue({
      id: 'intent-1',
      provider: 'MTN',
      amount: new Decimal(50000),
      status: 'REQUIRES_ACTION',
    });
    prisma.paymentIntent.findUnique.mockResolvedValue({
      id: 'intent-1',
      status: 'FAILED',
      failureReason: 'Internal Error',
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'intent-1',
      status: 'FAILED',
    });

    await service.createPaymentIntent(
      'user-1',
      ctx,
      { orderId: 'order-1', provider: 'MTN', amount: 50000, phoneNumber: '+256700000000' },
      meta,
    );

    expect(prisma.paymentIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.update',
      expect.objectContaining({ eventType: 'PAYMENT_FAILED' }),
    );
  });

  // ══════════════════════════════════════════════
  // Cancel Payment Intent
  // ══════════════════════════════════════════════

  it('should cancel a REQUIRES_ACTION intent', async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      status: 'REQUIRES_ACTION',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.paymentIntent.update.mockResolvedValue({ id: 'intent-1', status: 'CANCELLED' });

    const result = await service.cancelPaymentIntent(
      'user-1',
      ctx,
      'intent-1',
      { reason: 'Customer changed mind' },
      meta,
    );

    expect(result.status).toBe('CANCELLED');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.update',
      expect.objectContaining({ eventType: 'PAYMENT_CANCELLED' }),
    );
  });

  it('should cancel a PENDING intent', async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      status: 'PENDING',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.paymentIntent.update.mockResolvedValue({ id: 'intent-1', status: 'CANCELLED' });

    const result = await service.cancelPaymentIntent('user-1', ctx, 'intent-1', {}, meta);

    expect(result.status).toBe('CANCELLED');
  });

  it('should reject cancellation of a SUCCEEDED intent', async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      status: 'SUCCEEDED',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(service.cancelPaymentIntent('user-1', ctx, 'intent-1', {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw NotFoundException for non-existent intent', async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue(null);

    await expect(service.cancelPaymentIntent('user-1', ctx, 'intent-x', {}, meta)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ══════════════════════════════════════════════
  // Process Webhook
  // ══════════════════════════════════════════════

  it('should persist webhook and update matching intent on success', async () => {
    prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-1', eventType: 'payment.success' });
    prisma.paymentIntent.findUnique.mockResolvedValue({
      id: 'intent-1',
      provider: 'MTN',
      externalId: 'EXT-001',
      orderId: 'order-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      amount: new Decimal(50000),
      customerPhone: '256700000000',
      status: 'REQUIRES_ACTION',
    });
    mtnAdapter.normalizeStatus.mockReturnValue('SUCCEEDED');
    prisma.paymentIntent.update.mockResolvedValue({ id: 'intent-1', status: 'SUCCEEDED' });
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-momo-1',
      method: 'MOMO',
      status: 'COMPLETED',
      amount: new Decimal(50000),
    });
    // for autoSettleIfFullyPaid
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(50000),
      branchId: 'branch-1',
    });
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-momo-1', status: 'COMPLETED', amount: new Decimal(50000) },
    ]);
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });
    prisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.processWebhook('MTN', {
      event_type: 'payment.success',
      externalId: 'EXT-001',
      status: 'SUCCESSFUL',
    });

    expect(result.intentUpdated).toBe(true);
    expect(result.paymentCreated).toBe(true);
    expect(result.autoSettled).toBe(true);
    expect(prisma.webhookEvent.create).toHaveBeenCalled();
  });

  it('should persist webhook even without matching intent', async () => {
    prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-2', eventType: 'payment.unknown' });
    prisma.paymentIntent.findUnique.mockResolvedValue(null);
    prisma.paymentIntent.findFirst.mockResolvedValue(null);
    prisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.processWebhook('AIRTEL', {
      event_type: 'payment.unknown',
      externalId: 'EXT-999',
      status: 'FAILED',
    });

    expect(result.intentUpdated).toBe(false);
    expect(result.paymentCreated).toBe(false);
    expect(prisma.webhookEvent.create).toHaveBeenCalled();
  });

  it('should not create duplicate payment on repeated webhook', async () => {
    prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-3', eventType: 'payment.success' });
    prisma.paymentIntent.findUnique.mockResolvedValue({
      id: 'intent-1',
      provider: 'MTN',
      externalId: 'EXT-001',
      orderId: 'order-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      amount: new Decimal(50000),
      customerPhone: '256700000000',
      status: 'REQUIRES_ACTION',
    });
    mtnAdapter.normalizeStatus.mockReturnValue('SUCCEEDED');
    prisma.paymentIntent.update.mockResolvedValue({ id: 'intent-1', status: 'SUCCEEDED' });
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay-existing', method: 'MOMO' });
    prisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.processWebhook('MTN', {
      event_type: 'payment.success',
      externalId: 'EXT-001',
      status: 'SUCCESSFUL',
    });

    expect(result.intentUpdated).toBe(true);
    expect(result.paymentCreated).toBe(false);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('should emit PAYMENT_FAILED on webhook with failed status', async () => {
    prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-4', eventType: 'payment.failed' });
    prisma.paymentIntent.findUnique.mockResolvedValue({
      id: 'intent-1',
      provider: 'MTN',
      externalId: 'EXT-002',
      orderId: 'order-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      amount: new Decimal(50000),
      status: 'REQUIRES_ACTION',
    });
    mtnAdapter.normalizeStatus.mockReturnValue('FAILED');
    prisma.paymentIntent.update.mockResolvedValue({ id: 'intent-1', status: 'FAILED' });
    prisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.processWebhook('MTN', {
      externalId: 'EXT-002',
      status: 'FAILED',
      reason: { message: 'Insufficient funds' },
    });

    expect(result.intentUpdated).toBe(true);
    expect(result.paymentCreated).toBe(false);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.update',
      expect.objectContaining({ eventType: 'PAYMENT_FAILED' }),
    );
  });

  // ══════════════════════════════════════════════
  // Get Order Payments
  // ══════════════════════════════════════════════

  it('should return payments, intents, and balance for an order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
      total: new Decimal(100),
    });
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-1', method: 'CASH', amount: new Decimal(60), status: 'COMPLETED' },
    ]);
    prisma.paymentIntent.findMany.mockResolvedValue([
      { id: 'intent-1', provider: 'MTN', status: 'SUCCEEDED' },
    ]);

    const result = await service.getOrderPayments(ctx, 'order-1');

    expect(result.payments).toHaveLength(1);
    expect(result.intents).toHaveLength(1);
    expect(result.remainingBalance).toBe('40.00');
    expect(result.orderTotal).toBe('100');
  });

  it('should throw NotFoundException for non-existent order in getOrderPayments', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(service.getOrderPayments(ctx, 'order-x')).rejects.toThrow(NotFoundException);
  });

  // ══════════════════════════════════════════════
  // Manual Reference Payment
  // ══════════════════════════════════════════════

  it('should create a manual reference payment', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      branchId: 'branch-1',
      orgId: 'org-1',
      total: new Decimal(100),
    });
    prisma.payment.findFirst.mockResolvedValue(null); // no duplicate
    prisma.payment.create.mockResolvedValue({
      id: 'pay-manual-1',
      method: 'MOMO',
      amount: new Decimal(50),
      status: 'COMPLETED',
      captureMode: 'MANUAL_REFERENCE',
      verificationStatus: 'UNVERIFIED',
    });
    // for getOutstandingBalance
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-manual-1', status: 'COMPLETED', amount: new Decimal(50) },
    ]);

    const result = await service.createManualReferencePayment(
      'user-1',
      ctx,
      {
        orderId: 'order-1',
        method: 'MOMO',
        amount: 50,
        externalTransactionId: 'MTN-REF-001',
        payerPhone: '256700000000',
      },
      meta,
    );

    expect(result.payment.captureMode).toBe('MANUAL_REFERENCE');
    expect(result.payment.verificationStatus).toBe('UNVERIFIED');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.update',
      expect.objectContaining({ eventType: 'PAYMENT_MANUAL_REFERENCE_RECORDED' }),
    );
  });

  it('should reject duplicate manual reference by externalTransactionId', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-existing',
      externalTransactionId: 'MTN-REF-001',
    });

    await expect(
      service.createManualReferencePayment(
        'user-1',
        ctx,
        {
          orderId: 'order-1',
          method: 'MOMO',
          amount: 50,
          externalTransactionId: 'MTN-REF-001',
        },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject manual reference on VOIDED order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'VOIDED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.createManualReferencePayment(
        'user-1',
        ctx,
        {
          orderId: 'order-1',
          method: 'MOMO',
          amount: 50,
          externalTransactionId: 'MTN-REF-002',
        },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException for non-existent order on manual reference', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.createManualReferencePayment(
        'user-1',
        ctx,
        {
          orderId: 'order-x',
          method: 'MOMO',
          amount: 50,
          externalTransactionId: 'MTN-REF-003',
        },
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should auto-settle order when manual reference covers remaining balance', async () => {
    prisma.order.findFirst
      .mockResolvedValueOnce({
        // createManualReferencePayment: order check
        id: 'order-1',
        status: 'SERVED',
        branchId: 'branch-1',
        orgId: 'org-1',
        total: new Decimal(100),
      })
      .mockResolvedValueOnce({
        // getOutstandingBalance #1
        id: 'order-1',
        branchId: 'branch-1',
        total: new Decimal(100),
      })
      .mockResolvedValueOnce({
        // autoSettleIfFullyPaid
        id: 'order-1',
        status: 'SERVED',
        branchId: 'branch-1',
        total: new Decimal(100),
      })
      .mockResolvedValueOnce({
        // getOutstandingBalance #2 (inside auto-settle)
        id: 'order-1',
        branchId: 'branch-1',
        total: new Decimal(100),
      })
      .mockResolvedValueOnce({
        // getOutstandingBalance #3 (final)
        id: 'order-1',
        branchId: 'branch-1',
        total: new Decimal(100),
      });
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-manual-1',
      method: 'MOMO',
      amount: new Decimal(100),
      status: 'COMPLETED',
      captureMode: 'MANUAL_REFERENCE',
      verificationStatus: 'UNVERIFIED',
    });
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-manual-1', status: 'COMPLETED', amount: new Decimal(100) },
    ]);
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

    const result = await service.createManualReferencePayment(
      'user-1',
      ctx,
      {
        orderId: 'order-1',
        method: 'MOMO',
        amount: 100,
        externalTransactionId: 'MTN-REF-004',
      },
      meta,
    );

    expect(result.autoSettled).toBe(true);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.update',
      expect.objectContaining({ eventType: 'ORDER_AUTO_SETTLED' }),
    );
  });

  // ══════════════════════════════════════════════
  // Get Payment Intent
  // ══════════════════════════════════════════════

  it('should return a payment intent by id', async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      provider: 'MTN',
      status: 'REQUIRES_ACTION',
    });

    const result = await service.getPaymentIntent(ctx, 'intent-1');

    expect(result.id).toBe('intent-1');
  });

  it('should throw NotFoundException for non-existent intent', async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue(null);

    await expect(service.getPaymentIntent(ctx, 'intent-x')).rejects.toThrow(NotFoundException);
  });

  // ══════════════════════════════════════════════
  // Branch Isolation
  // ══════════════════════════════════════════════

  it('should not find order from different branch', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.closeOrderWithPayment(
        'user-1',
        { branchId: 'other-branch', organizationId: 'org-1' },
        'order-1',
        { payments: [{ method: 'CASH', amount: 100 }] },
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ══════════════════════════════════════════════
  // Audit Logging
  // ══════════════════════════════════════════════

  it('should call audit.log on successful close', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(50),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findMany.mockResolvedValue([]);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'CASH',
      amount: new Decimal(50),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

    await service.closeOrderWithPayment(
      'user-1',
      ctx,
      'order-1',
      { payments: [{ method: 'CASH', amount: 50 }] },
      meta,
    );

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_PAID_AND_CLOSED',
        entityType: 'order',
        entityId: 'order-1',
      }),
    );
  });

  it('should emit SSE events on close', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(50),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.paymentIntent.findMany.mockResolvedValue([]);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'CASH',
      amount: new Decimal(50),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CLOSED' });

    await service.closeOrderWithPayment(
      'user-1',
      ctx,
      'order-1',
      { payments: [{ method: 'CASH', amount: 50 }] },
      meta,
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.update',
      expect.objectContaining({
        eventType: 'ORDER_AUTO_SETTLED',
        branchId: 'branch-1',
      }),
    );
  });
});
