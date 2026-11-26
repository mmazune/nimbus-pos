import { ApprovalRequestsService } from '../approval-requests';
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
  let approvals: any;

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
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    approvals = {
      open: jest.fn().mockResolvedValue({ id: 'ar-1' }),
      decide: jest.fn().mockResolvedValue({}),
      registerEffect: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: ApprovalRequestsService, useValue: approvals },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
  });

  // ── T6: the refund rule is the business day, not an amount ──

  const closedOrder = {
    id: 'order-1',
    orderNumber: 'A-1',
    branchId: 'branch-1',
    orgId: 'org-1',
    status: 'CLOSED',
  };
  const paidAt = (ago: number) => ({
    id: 'pay-1',
    orderId: 'order-1',
    amount: new Decimal(50000),
    method: 'CASH',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - ago),
  });

  it('a supervisor refunds at once on the day the bill was paid', async () => {
    prisma.order.findFirst.mockResolvedValue(closedOrder);
    prisma.payment.findFirst.mockResolvedValue(paidAt(60_000));
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.orgSettings.findUnique.mockResolvedValue({ businessDayEndsHour: 5 });
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'COMPLETED' });
    prisma.payment.findUnique.mockResolvedValue(paidAt(60_000));

    const result: any = await service.createRefund(
      'sup-1',
      ctx,
      'order-1',
      { paymentId: 'pay-1', amount: 2000, reason: 'cold' } as any,
      meta,
      ['pos:refund:create', 'pos:approvals:answer'],
    );
    expect(result.status).toBe('COMPLETED');
    expect(result.approvalRequestId).toBeNull();
    expect(approvals.open).not.toHaveBeenCalled();
  });

  it('a supervisor refund on an earlier day waits for a manager', async () => {
    prisma.order.findFirst.mockResolvedValue(closedOrder);
    prisma.payment.findFirst.mockResolvedValue(paidAt(3 * 24 * 3600_000));
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.orgSettings.findUnique.mockResolvedValue({ businessDayEndsHour: 5 });
    prisma.refund.create.mockResolvedValue({ id: 'r2', status: 'PENDING' });
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', anomalyFlags: {} });
    prisma.order.update.mockResolvedValue({});

    const result: any = await service.createRefund(
      'sup-1',
      ctx,
      'order-1',
      { paymentId: 'pay-1', amount: 2000, reason: 'cold' } as any,
      meta,
      ['pos:refund:create', 'pos:approvals:answer'],
    );
    expect(result.status).toBe('PENDING');
    expect(result.needs).toBe('MANAGER');
    expect(approvals.open).toHaveBeenCalledWith(
      expect.anything(),
      ctx,
      expect.objectContaining({ kind: 'REFUND', level: 'MANAGER', subjectId: 'r2' }),
    );
  });

  it('a manager refunds at once on any day', async () => {
    prisma.order.findFirst.mockResolvedValue(closedOrder);
    prisma.payment.findFirst.mockResolvedValue(paidAt(3 * 24 * 3600_000));
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.orgSettings.findUnique.mockResolvedValue({ businessDayEndsHour: 5 });
    prisma.refund.create.mockResolvedValue({ id: 'r3', status: 'COMPLETED' });
    prisma.payment.findUnique.mockResolvedValue(paidAt(3 * 24 * 3600_000));
    const result: any = await service.createRefund(
      'mgr-1',
      ctx,
      'order-1',
      { paymentId: 'pay-1', amount: 2000, reason: 'cold' } as any,
      meta,
      ['pos:refund:create', 'pos:approvals:answer-manager'],
    );
    expect(result.status).toBe('COMPLETED');
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

  // ── T6: approving answers the refund's request for approval ──

  it('approving a pending refund answers its request for approval', async () => {
    prisma.refund.findFirst.mockResolvedValue({ id: 'r2', status: 'PENDING' });
    prisma.approvalRequest = { findFirst: jest.fn().mockResolvedValue({ id: 'ar-1' }) };
    prisma.refund.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'r2', status: 'COMPLETED' });
    const r: any = await service.approveRefund('mgr-1', ctx, 'r2', {} as any, meta, [
      'pos:approvals:answer-manager',
    ]);
    expect(approvals.decide).toHaveBeenCalledWith(
      ctx,
      { id: 'mgr-1', permissions: ['pos:approvals:answer-manager'] },
      'ar-1',
      'APPROVE',
    );
    expect(r.status).toBe('COMPLETED');
  });

  it('should reject approval of non-PENDING refund', async () => {
    prisma.refund.findFirst.mockResolvedValue({ id: 'r2', status: 'COMPLETED' });
    await expect(service.approveRefund('mgr-1', ctx, 'r2', {} as any, meta, [])).rejects.toThrow(
      'Cannot approve a refund in COMPLETED status',
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
