import { Test, TestingModule } from '@nestjs/testing';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

describe('RefundsService', () => {
  let service: RefundsService;
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
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      refund: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      orgSettings: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
  });

  // ── Create Refund: Auto-complete below threshold ──

  it('should auto-complete a small refund below threshold', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      branchId: 'branch-1',
      amount: new Decimal(50000),
      method: 'CASH',
      status: 'COMPLETED',
    });
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.orgSettings.findUnique.mockResolvedValue({
      discountApprovalThreshold: new Decimal(5000),
    });
    prisma.refund.create.mockResolvedValue({
      id: 'ref-1',
      status: 'COMPLETED',
      amount: new Decimal(2000),
    });
    // checkAndMarkPaymentRefunded
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      amount: new Decimal(50000),
    });
    // refunds for that payment (after create)
    prisma.refund.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: new Decimal(2000), status: 'COMPLETED' }]);

    const result = await service.createRefund(
      'user-1',
      ctx,
      'order-1',
      { paymentId: 'pay-1', amount: 2000, reason: 'Wrong item' },
      meta,
    );

    expect(result.status).toBe('COMPLETED');
    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          approvedById: 'user-1',
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFUND_AUTO_COMPLETED' }),
    );
  });

  // ── Create Refund: Pending above threshold ──

  it('should create PENDING refund above threshold', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      branchId: 'branch-1',
      amount: new Decimal(50000),
      method: 'CASH',
      status: 'COMPLETED',
    });
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.orgSettings.findUnique.mockResolvedValue({
      discountApprovalThreshold: new Decimal(5000),
    });
    prisma.refund.create.mockResolvedValue({
      id: 'ref-2',
      status: 'PENDING',
      amount: new Decimal(10000),
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      anomalyFlags: null,
    });
    prisma.order.update.mockResolvedValue({});

    const result = await service.createRefund(
      'user-1',
      ctx,
      'order-1',
      { paymentId: 'pay-1', amount: 10000, reason: 'Overcharge' },
      meta,
    );

    expect(result.status).toBe('PENDING');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'REFUND_REQUESTED' }));
  });

  // ── Create Refund: Order not found ──

  it('should throw NotFoundException if order not found', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.createRefund(
        'user-1',
        ctx,
        'order-999',
        { paymentId: 'pay-1', amount: 1000, reason: 'Test' },
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Create Refund: Only CLOSED orders ──

  it('should reject refund on non-CLOSED order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.createRefund(
        'user-1',
        ctx,
        'order-1',
        { paymentId: 'pay-1', amount: 1000, reason: 'Test' },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ── Create Refund: Payment not found ──

  it('should throw NotFoundException if payment not found', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      service.createRefund(
        'user-1',
        ctx,
        'order-1',
        { paymentId: 'pay-999', amount: 1000, reason: 'Test' },
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Create Refund: Amount exceeds available ──

  it('should reject when refund amount exceeds available balance', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      branchId: 'branch-1',
      amount: new Decimal(10000),
      method: 'CASH',
      status: 'COMPLETED',
    });
    prisma.refund.findMany.mockResolvedValue([{ amount: new Decimal(8000), status: 'COMPLETED' }]);

    await expect(
      service.createRefund(
        'user-1',
        ctx,
        'order-1',
        { paymentId: 'pay-1', amount: 5000, reason: 'Too much' },
        meta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Approve Refund: Success with PIN ──

  it('should approve a pending refund with valid manager PIN', async () => {
    const pinHash = await bcrypt.hash('1234', 10);
    prisma.refund.findFirst.mockResolvedValue({
      id: 'ref-1',
      status: 'PENDING',
      branchId: 'branch-1',
      orgId: 'org-1',
      orderId: 'order-1',
      paymentId: 'pay-1',
      amount: new Decimal(10000),
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'mgr-1',
      quickPinHash: pinHash,
    });
    prisma.refund.update.mockResolvedValue({
      id: 'ref-1',
      status: 'COMPLETED',
      approvedById: 'mgr-1',
    });
    // checkAndMarkPaymentRefunded
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      amount: new Decimal(10000),
    });
    prisma.refund.findMany.mockResolvedValue([{ amount: new Decimal(10000), status: 'COMPLETED' }]);
    prisma.payment.update.mockResolvedValue({});

    const result = await service.approveRefund('mgr-1', ctx, 'ref-1', { managerPin: '1234' }, meta);

    expect(result.status).toBe('COMPLETED');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'REFUND_APPROVED' }));
  });

  // ── Approve Refund: Invalid PIN ──

  it('should reject approval with invalid PIN', async () => {
    const pinHash = await bcrypt.hash('1234', 10);
    prisma.refund.findFirst.mockResolvedValue({
      id: 'ref-1',
      status: 'PENDING',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'mgr-1',
      quickPinHash: pinHash,
    });

    await expect(
      service.approveRefund('mgr-1', ctx, 'ref-1', { managerPin: '9999' }, meta),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── Approve Refund: Not pending ──

  it('should reject approval of non-PENDING refund', async () => {
    prisma.refund.findFirst.mockResolvedValue({
      id: 'ref-1',
      status: 'COMPLETED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(service.approveRefund('mgr-1', ctx, 'ref-1', {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  // ── List Order Refunds ──

  it('should list refunds for an order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.refund.findMany.mockResolvedValue([
      { id: 'ref-1', amount: new Decimal(2000), status: 'COMPLETED' },
      { id: 'ref-2', amount: new Decimal(3000), status: 'PENDING' },
    ]);

    const result = await service.listOrderRefunds(ctx, 'order-1');
    expect(result).toHaveLength(2);
  });

  // ── Post-Close Void: Success ──

  it('should void a recently-closed order with valid PIN', async () => {
    const pinHash = await bcrypt.hash('5678', 10);
    const closedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
      branchId: 'branch-1',
      orgId: 'org-1',
      updatedAt: closedAt,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'mgr-1',
      quickPinHash: pinHash,
    });
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: { update: jest.fn().mockResolvedValue({ id: 'order-1', status: 'VOIDED' }) },
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      };
      return cb(tx);
    });

    const result = await service.postCloseVoid(
      'mgr-1',
      ctx,
      'order-1',
      { reason: 'Customer complaint', managerPin: '5678' },
      meta,
    );

    expect(result.status).toBe('VOIDED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_POST_CLOSE_VOIDED' }),
    );
  });

  // ── Post-Close Void: Window expired ──

  it('should reject post-close void after 15-minute window', async () => {
    const closedAt = new Date(Date.now() - 20 * 60 * 1000); // 20 min ago
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
      branchId: 'branch-1',
      orgId: 'org-1',
      updatedAt: closedAt,
    });

    await expect(
      service.postCloseVoid(
        'mgr-1',
        ctx,
        'order-1',
        { reason: 'Late void', managerPin: '1234' },
        meta,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Post-Close Void: Invalid PIN ──

  it('should reject post-close void with invalid PIN', async () => {
    const pinHash = await bcrypt.hash('5678', 10);
    const closedAt = new Date(Date.now() - 2 * 60 * 1000);
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
      branchId: 'branch-1',
      orgId: 'org-1',
      updatedAt: closedAt,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'mgr-1',
      quickPinHash: pinHash,
    });

    await expect(
      service.postCloseVoid(
        'mgr-1',
        ctx,
        'order-1',
        { reason: 'Bad void', managerPin: '0000' },
        meta,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── Post-Close Void: Not CLOSED ──

  it('should reject post-close void on non-CLOSED order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.postCloseVoid('mgr-1', ctx, 'order-1', { reason: 'Nope', managerPin: '1234' }, meta),
    ).rejects.toThrow(ConflictException);
  });

  // ── Get Refund ──

  it('should get a single refund by id', async () => {
    prisma.refund.findFirst.mockResolvedValue({
      id: 'ref-1',
      status: 'COMPLETED',
      amount: new Decimal(5000),
      createdBy: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
    });

    const result = await service.getRefund(ctx, 'ref-1');
    expect(result.id).toBe('ref-1');
  });

  it('should throw NotFoundException for unknown refund', async () => {
    prisma.refund.findFirst.mockResolvedValue(null);

    await expect(service.getRefund(ctx, 'ref-999')).rejects.toThrow(NotFoundException);
  });
});
