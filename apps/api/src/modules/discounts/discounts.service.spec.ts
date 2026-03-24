import { Test, TestingModule } from '@nestjs/testing';
import { DiscountsService } from './discounts.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

describe('DiscountsService', () => {
  let service: DiscountsService;
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
      discount: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      orgSettings: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<DiscountsService>(DiscountsService);
  });

  // ── Request Discount: Small = Auto-Approve ──

  it('should auto-approve a small FIXED discount below threshold', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'NEW',
      subtotal: new Decimal(50000),
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.orgSettings.findUnique.mockResolvedValue({
      discountApprovalThreshold: new Decimal(5000),
    });
    prisma.discount.create.mockResolvedValue({
      id: 'disc-1',
      status: 'APPROVED',
      type: 'FIXED',
      value: new Decimal(2000),
    });
    // recalcOrderDiscount calls
    prisma.order.findUnique.mockResolvedValue({ subtotal: new Decimal(50000) });
    prisma.discount.findFirst.mockResolvedValue({
      type: 'FIXED',
      value: new Decimal(2000),
      approvedAt: new Date(),
    });
    prisma.order.update.mockResolvedValue({});

    const result = await service.requestDiscount(
      'user-1',
      ctx,
      'order-1',
      {
        type: 'FIXED',
        value: 2000,
        reason: 'Loyalty',
      },
      meta,
    );

    expect(result.status).toBe('APPROVED');
    expect(prisma.discount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', approvedById: 'user-1' }),
      }),
    );
  });

  // ── Request Discount: Large = Pending ──

  it('should create pending discount when above threshold', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SENT',
      subtotal: new Decimal(50000),
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.orgSettings.findUnique.mockResolvedValue({
      discountApprovalThreshold: new Decimal(5000),
    });
    prisma.discount.create.mockResolvedValue({
      id: 'disc-2',
      status: 'PENDING',
      type: 'FIXED',
      value: new Decimal(10000),
    });
    // flagHeavyDiscount calls
    prisma.order.findUnique.mockResolvedValue({ anomalyFlags: null });
    prisma.order.update.mockResolvedValue({});

    const result = await service.requestDiscount(
      'user-1',
      ctx,
      'order-1',
      {
        type: 'FIXED',
        value: 10000,
        reason: 'VIP guest',
      },
      meta,
    );

    expect(result.status).toBe('PENDING');
    expect(prisma.discount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', approvedById: null }),
      }),
    );
  });

  // ── Request Discount: Percentage Auto-Approve ──

  it('should auto-approve a small PERCENTAGE discount', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'IN_KITCHEN',
      subtotal: new Decimal(20000),
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.orgSettings.findUnique.mockResolvedValue({
      discountApprovalThreshold: new Decimal(5000),
    });
    // 10% of 20000 = 2000 which is below 5000 threshold
    prisma.discount.create.mockResolvedValue({
      id: 'disc-3',
      status: 'APPROVED',
      type: 'PERCENTAGE',
      value: new Decimal(10),
    });
    prisma.order.findUnique.mockResolvedValue({ subtotal: new Decimal(20000) });
    prisma.discount.findFirst.mockResolvedValue({
      type: 'PERCENTAGE',
      value: new Decimal(10),
      approvedAt: new Date(),
    });
    prisma.order.update.mockResolvedValue({});

    const result = await service.requestDiscount(
      'user-1',
      ctx,
      'order-1',
      {
        type: 'PERCENTAGE',
        value: 10,
        reason: 'Regular customer',
      },
      meta,
    );

    expect(result.status).toBe('APPROVED');
  });

  // ── Percentage > 100 rejected ──

  it('should reject percentage discount exceeding 100', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'NEW',
      subtotal: new Decimal(50000),
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.requestDiscount(
        'user-1',
        ctx,
        'order-1',
        {
          type: 'PERCENTAGE',
          value: 150,
          reason: 'test',
        },
        meta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ── State Restriction ──

  it('should reject discount on CLOSED order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CLOSED',
      subtotal: new Decimal(50000),
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.requestDiscount(
        'user-1',
        ctx,
        'order-1',
        {
          type: 'FIXED',
          value: 1000,
          reason: 'test',
        },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject discount on VOIDED order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'VOIDED',
      subtotal: new Decimal(50000),
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.requestDiscount(
        'user-1',
        ctx,
        'order-1',
        {
          type: 'FIXED',
          value: 1000,
          reason: 'test',
        },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject discount on SERVED order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'SERVED',
      subtotal: new Decimal(50000),
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.requestDiscount(
        'user-1',
        ctx,
        'order-1',
        {
          type: 'FIXED',
          value: 1000,
          reason: 'test',
        },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ── Order Not Found ──

  it('should throw NotFoundException if order does not exist', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.requestDiscount(
        'user-1',
        ctx,
        'order-x',
        {
          type: 'FIXED',
          value: 1000,
          reason: 'test',
        },
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Approve Discount ──

  it('should approve a pending discount and recalculate order totals', async () => {
    prisma.discount.findFirst.mockResolvedValue({
      id: 'disc-2',
      status: 'PENDING',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
      type: 'FIXED',
      value: new Decimal(10000),
    });
    prisma.order.findUnique
      .mockResolvedValueOnce({ id: 'order-1', status: 'SENT' }) // state check
      .mockResolvedValueOnce({ subtotal: new Decimal(50000) }); // recalc
    prisma.discount.update.mockResolvedValue({
      id: 'disc-2',
      status: 'APPROVED',
      approvedById: 'manager-1',
    });
    prisma.discount.findFirst
      .mockResolvedValueOnce({
        id: 'disc-2',
        status: 'PENDING',
        orderId: 'order-1',
        branchId: 'branch-1',
        orgId: 'org-1',
        type: 'FIXED',
        value: new Decimal(10000),
      }) // initial
      .mockResolvedValueOnce({ type: 'FIXED', value: new Decimal(10000), approvedAt: new Date() }); // recalc
    prisma.order.update.mockResolvedValue({});

    const result = await service.approveDiscount('manager-1', ctx, 'disc-2', {}, meta);

    expect(result.status).toBe('APPROVED');
    expect(prisma.order.update).toHaveBeenCalled();
  });

  // ── Approve Already Approved ──

  it('should throw ConflictException if discount is already approved', async () => {
    prisma.discount.findFirst.mockResolvedValue({
      id: 'disc-1',
      status: 'APPROVED',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(service.approveDiscount('manager-1', ctx, 'disc-1', {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  // ── Reject Discount ──

  it('should reject a pending discount and leave order totals unchanged', async () => {
    prisma.discount.findFirst.mockResolvedValue({
      id: 'disc-2',
      status: 'PENDING',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.discount.update.mockResolvedValue({
      id: 'disc-2',
      status: 'REJECTED',
      rejectedById: 'manager-1',
    });

    const result = await service.rejectDiscount(
      'manager-1',
      ctx,
      'disc-2',
      {
        rejectionReason: 'Not justified',
      },
      meta,
    );

    expect(result.status).toBe('REJECTED');
    // Order update should NOT have been called (only discount.update)
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  // ── Reject Already Rejected ──

  it('should throw ConflictException if discount is already rejected', async () => {
    prisma.discount.findFirst.mockResolvedValue({
      id: 'disc-2',
      status: 'REJECTED',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });

    await expect(
      service.rejectDiscount(
        'manager-1',
        ctx,
        'disc-2',
        {
          rejectionReason: 'X',
        },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ── Heavy Discount Anomaly Flag ──

  it('should set HEAVY_DISCOUNT anomaly flag for large pending discount', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'NEW',
      subtotal: new Decimal(50000),
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.orgSettings.findUnique.mockResolvedValue({
      discountApprovalThreshold: new Decimal(5000),
    });
    prisma.discount.create.mockResolvedValue({
      id: 'disc-big',
      status: 'PENDING',
      type: 'FIXED',
      value: new Decimal(20000),
    });
    prisma.order.findUnique.mockResolvedValue({ anomalyFlags: null });
    prisma.order.update.mockResolvedValue({});

    await service.requestDiscount(
      'user-1',
      ctx,
      'order-1',
      {
        type: 'FIXED',
        value: 20000,
        reason: 'Big VIP',
      },
      meta,
    );

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          anomalyFlags: expect.arrayContaining(['HEAVY_DISCOUNT']),
        }),
      }),
    );
  });

  // ── Manager PIN Approval ──

  it('should verify manager PIN on approval when provided', async () => {
    const hashedPin = await bcrypt.hash('12345678', 10);

    prisma.discount.findFirst.mockResolvedValue({
      id: 'disc-2',
      status: 'PENDING',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
      type: 'FIXED',
      value: new Decimal(10000),
    });
    prisma.order.findUnique
      .mockResolvedValueOnce({ id: 'order-1', status: 'SENT' })
      .mockResolvedValueOnce({ subtotal: new Decimal(50000) });
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      quickPinHash: hashedPin,
    });
    prisma.discount.update.mockResolvedValue({
      id: 'disc-2',
      status: 'APPROVED',
      managerPinVerified: true,
    });
    prisma.discount.findFirst
      .mockResolvedValueOnce({
        id: 'disc-2',
        status: 'PENDING',
        orderId: 'order-1',
        branchId: 'branch-1',
        orgId: 'org-1',
        type: 'FIXED',
        value: new Decimal(10000),
      })
      .mockResolvedValueOnce({ type: 'FIXED', value: new Decimal(10000), approvedAt: new Date() });
    prisma.order.update.mockResolvedValue({});

    const result = await service.approveDiscount(
      'manager-1',
      ctx,
      'disc-2',
      {
        managerPin: '12345678',
      },
      meta,
    );

    expect(result.managerPinVerified).toBe(true);
  });

  // ── Invalid Manager PIN ──

  it('should reject approval with invalid manager PIN', async () => {
    prisma.discount.findFirst.mockResolvedValue({
      id: 'disc-2',
      status: 'PENDING',
      orderId: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: 'SENT' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      quickPinHash: await bcrypt.hash('99999999', 10),
    });

    await expect(
      service.approveDiscount(
        'manager-1',
        ctx,
        'disc-2',
        {
          managerPin: '00000000',
        },
        meta,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── computeDiscountAmount ──

  it('should compute FIXED discount capped at subtotal', () => {
    const result = service.computeDiscountAmount('FIXED', new Decimal(60000), new Decimal(50000));
    expect(result.toNumber()).toBe(50000);
  });

  it('should compute PERCENTAGE discount correctly', () => {
    const result = service.computeDiscountAmount('PERCENTAGE', new Decimal(15), new Decimal(40000));
    expect(result.toNumber()).toBe(6000);
  });

  // ── List Order Discounts ──

  it('should list discounts for an order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      branchId: 'branch-1',
      orgId: 'org-1',
    });
    prisma.discount.findMany.mockResolvedValue([{ id: 'disc-1' }]);
    prisma.discount.count.mockResolvedValue(1);

    const result = await service.listOrderDiscounts(ctx, 'order-1', {});

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  // ── Get Discount ──

  it('should throw NotFoundException for non-existent discount', async () => {
    prisma.discount.findFirst.mockResolvedValue(null);

    await expect(service.getDiscount(ctx, 'disc-x')).rejects.toThrow(NotFoundException);
  });

  // ── Branch Isolation ──

  it('should not find discount from different branch', async () => {
    prisma.discount.findFirst.mockResolvedValue(null);

    await expect(
      service.approveDiscount(
        'manager-1',
        { branchId: 'other-branch', organizationId: 'org-1' },
        'disc-1',
        {},
        meta,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
