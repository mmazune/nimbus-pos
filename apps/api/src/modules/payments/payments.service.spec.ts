import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let audit: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  // ── Close Order: Successful Cash Payment ──

  it('should close a SERVED order with a single cash payment', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(100),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'CASH',
      amount: new Decimal(100),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
    });

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

  // ── Close Order: Cash Overpayment with Change ──

  it('should allow cash overpayment and compute changeDue', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(80),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'CASH',
      amount: new Decimal(100),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
    });

    const result = await service.closeOrderWithPayment(
      'user-1',
      ctx,
      'order-1',
      { payments: [{ method: 'CASH', amount: 100 }] },
      meta,
    );

    expect(result.changeDue).toBe('20.00');
  });

  // ── Close Order: Split Payment (Cash + Card) ──

  it('should accept split payment across methods', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(150),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
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
    prisma.order.update.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
    });

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

  // ── Close Order: Insufficient Payment ──

  it('should reject insufficient payment total', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
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
        { payments: [{ method: 'CASH', amount: 50 }] },
        meta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Close Order: Non-Cash Overpayment Blocked ──

  it('should reject overpayment without cash', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
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
        { payments: [{ method: 'CARD', amount: 120 }] },
        meta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Close Order: Wrong State ──

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

  // ── Close Order: Order Not Found ──

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

  // ── Close Order: MOMO requires succeeded intent ──

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
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      status: 'SUCCEEDED',
    });
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'MOMO',
      amount: new Decimal(100),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
    });

    const result = await service.closeOrderWithPayment(
      'user-1',
      ctx,
      'order-1',
      { payments: [{ method: 'MOMO', amount: 100 }] },
      meta,
    );

    expect(result.order.status).toBe('CLOSED');
  });

  // ── Create Payment Intent ──

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
      {
        orderId: 'order-1',
        provider: 'MTN',
        amount: 50000,
        phoneNumber: '+256700000000',
      },
      meta,
    );

    expect(result.status).toBe('REQUIRES_ACTION');
    expect(result.provider).toBe('MTN');
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
        { orderId: 'order-1', provider: 'MTN', amount: 50000 },
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
        { orderId: 'order-1', provider: 'AIRTEL', amount: 30000 },
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
        { orderId: 'order-x', provider: 'MTN', amount: 50000 },
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Cancel Payment Intent ──

  it('should cancel a REQUIRES_ACTION intent', async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      status: 'REQUIRES_ACTION',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'intent-1',
      status: 'CANCELLED',
    });

    const result = await service.cancelPaymentIntent(
      'user-1',
      ctx,
      'intent-1',
      { reason: 'Customer changed mind' },
      meta,
    );

    expect(result.status).toBe('CANCELLED');
  });

  it('should cancel a PENDING intent', async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      status: 'PENDING',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'intent-1',
      status: 'CANCELLED',
    });

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

  // ── Process Webhook ──

  it('should persist webhook and update matching intent on success', async () => {
    prisma.webhookEvent.create.mockResolvedValue({
      id: 'wh-1',
      eventType: 'payment.success',
    });
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      provider: 'MTN',
      providerRef: 'EXT-001',
      orderId: 'order-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      amount: new Decimal(50000),
      status: 'REQUIRES_ACTION',
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'intent-1',
      status: 'SUCCEEDED',
    });
    prisma.payment.findFirst.mockResolvedValue(null); // no existing payment
    prisma.payment.create.mockResolvedValue({
      id: 'pay-momo-1',
      method: 'MOMO',
      status: 'COMPLETED',
    });
    prisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.processWebhook('MTN', {
      event_type: 'payment.success',
      external_id: 'EXT-001',
      status: 'SUCCESSFUL',
    });

    expect(result.intentUpdated).toBe(true);
    expect(result.paymentCreated).toBe(true);
    expect(prisma.webhookEvent.create).toHaveBeenCalled();
  });

  it('should persist webhook even without matching intent', async () => {
    prisma.webhookEvent.create.mockResolvedValue({
      id: 'wh-2',
      eventType: 'payment.unknown',
    });
    prisma.paymentIntent.findFirst.mockResolvedValue(null);
    prisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.processWebhook('AIRTEL', {
      event_type: 'payment.unknown',
      external_id: 'EXT-999',
      status: 'FAILED',
    });

    expect(result.intentUpdated).toBe(false);
    expect(result.paymentCreated).toBe(false);
    expect(prisma.webhookEvent.create).toHaveBeenCalled();
  });

  it('should not create duplicate payment on repeated webhook', async () => {
    prisma.webhookEvent.create.mockResolvedValue({
      id: 'wh-3',
      eventType: 'payment.success',
    });
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      provider: 'MTN',
      providerRef: 'EXT-001',
      orderId: 'order-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      amount: new Decimal(50000),
      status: 'REQUIRES_ACTION',
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'intent-1',
      status: 'SUCCEEDED',
    });
    // Existing payment already recorded
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-existing',
      method: 'MOMO',
    });
    prisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.processWebhook('MTN', {
      event_type: 'payment.success',
      external_id: 'EXT-001',
      status: 'SUCCESSFUL',
    });

    expect(result.intentUpdated).toBe(true);
    expect(result.paymentCreated).toBe(false);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  // ── Get Order Payments ──

  it('should return payments and intents for an order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-1', method: 'CASH', amount: new Decimal(100) },
    ]);
    prisma.paymentIntent.findMany.mockResolvedValue([
      { id: 'intent-1', provider: 'MTN', status: 'SUCCEEDED' },
    ]);

    const result = await service.getOrderPayments(ctx, 'order-1');

    expect(result.payments).toHaveLength(1);
    expect(result.intents).toHaveLength(1);
  });

  it('should throw NotFoundException for non-existent order in getOrderPayments', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(service.getOrderPayments(ctx, 'order-x')).rejects.toThrow(NotFoundException);
  });

  // ── Branch Isolation ──

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

  // ── Audit Logging ──

  it('should call audit.log on successful close', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      total: new Decimal(50),
      branchId: 'branch-1',
      orgId: 'org-1',
      payments: [],
    });
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      method: 'CASH',
      amount: new Decimal(50),
      status: 'COMPLETED',
    });
    prisma.order.update.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
    });

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
});
