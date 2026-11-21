import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { QuickSaleService } from './quick-sale.service';
import { QuickSaleDto } from './dto';

const ctx = { branchId: 'branch-1', organizationId: 'org-1' };
const meta = { ipAddress: '127.0.0.1', userAgent: 'jest' };

const beer = {
  id: 'm1',
  sku: 'BEER-1',
  name: 'Beer',
  brand: 'Nile',
  price: new Decimal(4000),
  isActive: true,
  servings: [] as { id: string; price: Decimal; isActive: boolean }[],
};

function dto(over: Partial<QuickSaleDto> = {}): QuickSaleDto {
  return {
    clientSaleId: 'sale-0000001',
    tillCode: 'DRK-03',
    lines: [{ sku: 'BEER-1', quantity: 2 }],
    payment: { method: 'CARD', cardScheme: 'VISA', cardLast4: '4242', authCode: 'A1B2C3' },
    ...over,
  } as QuickSaleDto;
}

function p2002(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

describe('QuickSaleService', () => {
  let service: QuickSaleService;
  let prisma: {
    order: { findFirst: jest.Mock; findUniqueOrThrow: jest.Mock };
    menuItem: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
    order: { create: jest.Mock };
    payment: { create: jest.Mock };
  };
  let audit: { log: jest.Mock };

  const paymentRow = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    orderId: 'o1',
    amount: new Decimal(8000),
    method: 'CARD',
    status: 'COMPLETED',
    captureMode: 'MANUAL_REFERENCE',
    verificationStatus: 'UNVERIFIED',
    tillCode: 'DRK-03',
    cardScheme: 'VISA',
    cardLast4: '4242',
    authCode: 'A1B2C3',
    terminalId: null,
    momoNetwork: null,
    createdAt: new Date('2026-11-21T18:14:00Z'),
    ...over,
  });
  const orderRow = (over: Record<string, unknown> = {}) => ({
    id: 'o1',
    orgId: 'org-1',
    branchId: 'branch-1',
    orderNumber: 'ORD-000007',
    status: 'CLOSED',
    total: new Decimal(8000),
    tillCode: 'DRK-03',
    clientSaleId: 'sale-0000001',
    createdAt: new Date('2026-11-21T18:14:00Z'),
    metadata: { source: 'QUICK_SALE', changeDue: '0' },
    items: [
      {
        id: 'i1',
        menuItemId: 'm1',
        menuItemServingId: null,
        quantity: 2,
        price: new Decimal(4000),
        subtotal: new Decimal(8000),
        menuItem: { sku: 'BEER-1', name: 'Beer', brand: 'Nile' },
      },
    ],
    payments: [paymentRow()],
    ...over,
  });

  beforeEach(async () => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ max: '6' }]),
      order: { create: jest.fn().mockResolvedValue({ id: 'o1' }) },
      payment: { create: jest.fn().mockResolvedValue(paymentRow()) },
    };
    prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(null),
        // The full order is read back after the commit, outside the branch lock (H1F).
        findUniqueOrThrow: jest.fn().mockResolvedValue(orderRow({ payments: undefined })),
      },
      menuItem: { findMany: jest.fn().mockResolvedValue([beer]) },
      $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickSaleService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(QuickSaleService);
  });

  describe('the real case: two beers at 4,000 by Visa at DRK-03', () => {
    it('writes one closed order (8,000, tax 0) and one completed VISA payment', async () => {
      const res = await service.quickSale('user-1', ctx, dto(), meta);
      expect(res.replayed).toBe(false);
      const orderData = tx.order.create.mock.calls[0][0].data;
      expect(orderData.status).toBe('CLOSED');
      expect(orderData.serviceType).toBe('TAKEAWAY');
      expect(orderData.tillCode).toBe('DRK-03');
      expect(orderData.clientSaleId).toBe('sale-0000001');
      expect(orderData.orderNumber).toBe('ORD-000007');
      expect(new Decimal(orderData.subtotal).toString()).toBe('8000');
      expect(new Decimal(orderData.total).toString()).toBe('8000');
      expect(new Decimal(orderData.tax).toString()).toBe('0');
      expect(orderData.metadata.source).toBe('QUICK_SALE');
      expect(orderData.items.create).toHaveLength(1);
      const payData = tx.payment.create.mock.calls[0][0].data;
      expect(new Decimal(payData.amount).toString()).toBe('8000');
      expect(payData.status).toBe('COMPLETED');
      expect(payData.method).toBe('CARD');
      expect(payData.cardScheme).toBe('VISA');
      expect(payData.tillCode).toBe('DRK-03');
      expect(payData.captureMode).toBe('MANUAL_REFERENCE');
      expect(payData.verificationStatus).toBe('UNVERIFIED');
    });

    it('prices all lines with one menu query, outside the transaction', async () => {
      await service.quickSale('user-1', ctx, dto(), meta);
      expect(prisma.menuItem.findMany).toHaveBeenCalledTimes(1);
      const where = prisma.menuItem.findMany.mock.calls[0][0].where;
      expect(where.orgId).toBe('org-1');
      expect(where.branchId).toBe('branch-1');
      expect(where.isActive).toBe(true);
      expect(prisma.menuItem.findMany.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.$transaction.mock.invocationCallOrder[0],
      );
    });

    it('takes the advisory lock before allocating the number, inside the transaction', async () => {
      await service.quickSale('user-1', ctx, dto(), meta);
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.$queryRaw.mock.invocationCallOrder[0],
      );
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.order.create.mock.invocationCallOrder[0],
      );
    });

    it('runs the transaction with the agreed timeouts', async () => {
      await service.quickSale('user-1', ctx, dto(), meta);
      expect(prisma.$transaction.mock.calls[0][1]).toEqual({ timeout: 15000, maxWait: 5000 });
    });
  });

  describe('replay', () => {
    it('returns the stored sale with replayed: true and writes nothing (same branch)', async () => {
      prisma.order.findFirst.mockResolvedValue(orderRow());
      const res = await service.quickSale('user-1', ctx, dto(), meta);
      expect(res.replayed).toBe(true);
      expect(res.order.orderNumber).toBe('ORD-000007');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.menuItem.findMany).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('scopes the replay lookup by org and clientSaleId', async () => {
      await service.quickSale('user-1', ctx, dto(), meta);
      expect(prisma.order.findFirst.mock.calls[0][0].where).toEqual({
        orgId: 'org-1',
        clientSaleId: 'sale-0000001',
      });
    });

    it('is a 409 when the same clientSaleId exists in another branch', async () => {
      prisma.order.findFirst.mockResolvedValue(orderRow({ branchId: 'branch-2' }));
      await expect(service.quickSale('user-1', ctx, dto(), meta)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('turns a client_sale_id unique violation into a replay of the original', async () => {
      prisma.order.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(orderRow());
      prisma.$transaction.mockRejectedValueOnce(p2002(['org_id', 'client_sale_id']));
      const res = await service.quickSale('user-1', ctx, dto(), meta);
      expect(res.replayed).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('is a 409 when the unique-violation original belongs to another branch', async () => {
      prisma.order.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(orderRow({ branchId: 'branch-2' }));
      prisma.$transaction.mockRejectedValueOnce(p2002(['org_id', 'client_sale_id']));
      await expect(service.quickSale('user-1', ctx, dto(), meta)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('order_number collisions', () => {
    it('retries and succeeds on the second attempt', async () => {
      prisma.$transaction
        .mockRejectedValueOnce(p2002(['branch_id', 'order_number']))
        .mockImplementationOnce((fn: (t: unknown) => unknown) => fn(tx));
      const res = await service.quickSale('user-1', ctx, dto(), meta);
      expect(res.replayed).toBe(false);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('gives up after three attempts with a 409', async () => {
      prisma.$transaction.mockRejectedValue(p2002(['branch_id', 'order_number']));
      await expect(service.quickSale('user-1', ctx, dto(), meta)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('does not retry an unrelated error', async () => {
      prisma.$transaction.mockRejectedValue(new Error('boom'));
      await expect(service.quickSale('user-1', ctx, dto(), meta)).rejects.toThrow('boom');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('validation: 400 and nothing written', () => {
    const rejects = async (d: QuickSaleDto) => {
      await expect(service.quickSale('user-1', ctx, d, meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    };

    it('CARD without cardScheme', () =>
      rejects(dto({ payment: { method: 'CARD', cardLast4: '4242' } as QuickSaleDto['payment'] })));
    it('MOMO without momoNetwork', () =>
      rejects(
        dto({
          payment: { method: 'MOMO', payerPhone: '+256700000001' } as QuickSaleDto['payment'],
        }),
      ));
    it('cash tendered below the total', () =>
      rejects(
        dto({ payment: { method: 'CASH', tenderedAmount: 7999 } as QuickSaleDto['payment'] }),
      ));
    it('card fields on a cash sale', () =>
      rejects(dto({ payment: { method: 'CASH', cardScheme: 'VISA' } as QuickSaleDto['payment'] })));
    it('mobile-money network on a card sale', () =>
      rejects(
        dto({
          payment: {
            method: 'CARD',
            cardScheme: 'VISA',
            momoNetwork: 'MTN',
          } as QuickSaleDto['payment'],
        }),
      ));
    it('tendered amount on a card sale', () =>
      rejects(
        dto({
          payment: {
            method: 'CARD',
            cardScheme: 'VISA',
            tenderedAmount: 9000,
          } as QuickSaleDto['payment'],
        }),
      ));
    it('a line with neither sku nor menuItemId', () =>
      rejects(dto({ lines: [{ quantity: 1 }] as unknown as QuickSaleDto['lines'] })));
    it('a line with both sku and menuItemId', () =>
      rejects(dto({ lines: [{ sku: 'BEER-1', menuItemId: 'm1', quantity: 1 }] })));

    it('an unknown, inactive or other-branch SKU (not among active branch items)', async () => {
      prisma.menuItem.findMany.mockResolvedValue([]);
      await rejects(dto());
    });

    it('a SKU matching two active items in the branch', async () => {
      prisma.menuItem.findMany.mockResolvedValue([beer, { ...beer, id: 'm2' }]);
      await rejects(dto());
    });

    it('a serving that does not belong to the item', async () => {
      await rejects(dto({ lines: [{ sku: 'BEER-1', menuItemServingId: 'nope', quantity: 1 }] }));
    });

    it('an inactive serving', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        { ...beer, servings: [{ id: 's1', price: new Decimal(3000), isActive: false }] },
      ]);
      await rejects(dto({ lines: [{ sku: 'BEER-1', menuItemServingId: 's1', quantity: 1 }] }));
    });
  });

  describe('money', () => {
    it('cash: absent tendered means exact, change 0', async () => {
      const res = await service.quickSale(
        'user-1',
        ctx,
        dto({ payment: { method: 'CASH' } as QuickSaleDto['payment'] }),
        meta,
      );
      expect(res.changeDue.toString()).toBe('0');
      const payData = tx.payment.create.mock.calls[0][0].data;
      expect(payData.captureMode).toBe('ONLINE_PROVIDER');
      expect(payData.verificationStatus).toBe('NOT_REQUIRED');
      expect(payData.cardScheme).toBeUndefined();
    });

    it('cash: changeDue is tendered minus total, Decimal-exact', async () => {
      const res = await service.quickSale(
        'user-1',
        ctx,
        dto({ payment: { method: 'CASH', tenderedAmount: 10000.5 } as QuickSaleDto['payment'] }),
        meta,
      );
      expect(res.changeDue.toString()).toBe('2000.5');
      expect(tx.order.create.mock.calls[0][0].data.metadata.changeDue).toBe('2000.5');
    });

    it('uses the serving price when a serving is chosen, and sums mixed lines', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        { ...beer, servings: [{ id: 's1', price: new Decimal('3500.25'), isActive: true }] },
        { ...beer, id: 'm2', sku: 'SODA-1', price: new Decimal(1500) },
      ]);
      await service.quickSale(
        'user-1',
        ctx,
        dto({
          lines: [
            { sku: 'BEER-1', menuItemServingId: 's1', quantity: 3 },
            { sku: 'SODA-1', quantity: 2 },
          ],
        }),
        meta,
      );
      const o = tx.order.create.mock.calls[0][0].data;
      expect(new Decimal(o.total).toString()).toBe('13500.75'); // 3 x 3500.25 + 2 x 1500
    });

    it('card and mobile money are UNVERIFIED manual references', async () => {
      await service.quickSale(
        'user-1',
        ctx,
        dto({ payment: { method: 'MOMO', momoNetwork: 'MTN' } as QuickSaleDto['payment'] }),
        meta,
      );
      const payData = tx.payment.create.mock.calls[0][0].data;
      expect(payData.momoNetwork).toBe('MTN');
      expect(payData.captureMode).toBe('MANUAL_REFERENCE');
      expect(payData.verificationStatus).toBe('UNVERIFIED');
    });
  });

  describe('atomicity and audit', () => {
    it('a payment failure rejects the whole call (the transaction callback throws)', async () => {
      tx.payment.create.mockRejectedValue(new Error('payment insert failed'));
      await expect(service.quickSale('user-1', ctx, dto(), meta)).rejects.toThrow(
        'payment insert failed',
      );
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('writes one ORDER_QUICK_SALE audit entry with branchId, after the commit', async () => {
      await service.quickSale('user-1', ctx, dto(), meta);
      expect(audit.log).toHaveBeenCalledTimes(1);
      const entry = audit.log.mock.calls[0][0];
      expect(entry.action).toBe('ORDER_QUICK_SALE');
      expect(entry.metadata.branchId).toBe('branch-1');
      expect(entry.actorUserId).toBe('user-1');
      expect(audit.log.mock.invocationCallOrder[0]).toBeGreaterThan(
        prisma.$transaction.mock.invocationCallOrder[0],
      );
    });

    it('does not fail a committed sale when the audit write fails', async () => {
      audit.log.mockRejectedValue(new Error('audit down'));
      const res = await service.quickSale('user-1', ctx, dto(), meta);
      expect(res.replayed).toBe(false);
    });
  });

  describe('H1F: a replay must be the same sale', () => {
    const mismatch = async (d: QuickSaleDto, stored = orderRow()) => {
      prisma.order.findFirst.mockResolvedValue(stored);
      const err = await service.quickSale('user-1', ctx, d, meta).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('CLIENT_SALE_ID_PAYLOAD_MISMATCH');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.menuItem.findMany).not.toHaveBeenCalled();
      return err.getResponse() as { differs: string[] };
    };

    it('a different quantity is a 409 naming "lines"', async () => {
      const r = await mismatch(dto({ lines: [{ sku: 'BEER-1', quantity: 3 }] }));
      expect(r.differs).toEqual(['lines']);
    });

    it('a different till, in any case or padding, is compared normalised', async () => {
      const r = await mismatch(dto({ tillCode: 'DRK-04' }));
      expect(r.differs).toEqual(['tillCode']);
      prisma.order.findFirst.mockResolvedValue(orderRow());
      const same = await service.quickSale('user-1', ctx, dto({ tillCode: ' drk-03 ' }), meta);
      expect(same.replayed).toBe(true);
    });

    it('a different method or card scheme is a 409', async () => {
      const r = await mismatch(dto({ payment: { method: 'CASH' } as QuickSaleDto['payment'] }));
      expect(r.differs).toEqual(expect.arrayContaining(['payment.method', 'payment.cardScheme']));
    });

    it('authCode, cardLast4 and terminalId are not compared', async () => {
      prisma.order.findFirst.mockResolvedValue(orderRow());
      const res = await service.quickSale(
        'user-1',
        ctx,
        dto({
          payment: {
            method: 'CARD',
            cardScheme: 'VISA',
            cardLast4: '1111',
            authCode: 'ZZ99',
            terminalId: 'T-9',
          },
        }),
        meta,
      );
      expect(res.replayed).toBe(true);
      expect(res.payment.cardLast4).toBe('4242'); // the stored sale is what comes back
    });

    it('line order does not matter and sku or menuItemId both identify the stored item', async () => {
      const two = orderRow();
      two.items = [
        ...two.items,
        {
          id: 'i2',
          menuItemId: 'm2',
          menuItemServingId: null,
          quantity: 1,
          price: new Decimal(2000),
          subtotal: new Decimal(2000),
          menuItem: { sku: 'SODA-1', name: 'Soda', brand: 'X' },
        },
      ];
      prisma.order.findFirst.mockResolvedValue(two);
      const res = await service.quickSale(
        'user-1',
        ctx,
        dto({
          lines: [
            { menuItemId: 'm2', quantity: 1 },
            { sku: 'BEER-1', quantity: 2 },
          ],
        }),
        meta,
      );
      expect(res.replayed).toBe(true);
    });

    it('uses the stored fingerprint for soldAt and tendered as sent', async () => {
      const stored = orderRow({
        metadata: {
          source: 'QUICK_SALE',
          changeDue: '0',
          fingerprint: { soldAt: '2026-11-21T21:14:00+03:00', tenderedAmount: null },
        },
      });
      prisma.order.findFirst.mockResolvedValue(stored);
      const same = await service.quickSale(
        'user-1',
        ctx,
        dto({ soldAt: '2026-11-21T21:14:00+03:00' }),
        meta,
      );
      expect(same.replayed).toBe(true);
      const r = await mismatch(dto({ soldAt: '2026-11-21T22:00:00+03:00' }), stored);
      expect(r.differs).toEqual(['soldAt']);
    });

    it('the unique-violation path compares too', async () => {
      prisma.order.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(orderRow());
      prisma.$transaction.mockRejectedValueOnce(p2002(['org_id', 'client_sale_id']));
      await expect(
        service.quickSale('user-1', ctx, dto({ lines: [{ sku: 'BEER-1', quantity: 3 }] }), meta),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('stores the fingerprint and the normalised till code on a new sale', async () => {
      await service.quickSale(
        'user-1',
        ctx,
        dto({
          tillCode: ' drk-03',
          soldAt: '2026-11-21T21:14:00+03:00',
          payment: { method: 'CASH', tenderedAmount: 10000 } as QuickSaleDto['payment'],
        }),
        meta,
      );
      const data = tx.order.create.mock.calls[0][0].data;
      expect(data.tillCode).toBe('DRK-03');
      expect(data.metadata.fingerprint).toEqual({
        soldAt: '2026-11-21T21:14:00+03:00',
        tenderedAmount: '10000',
      });
      expect(tx.payment.create.mock.calls[0][0].data.tillCode).toBe('DRK-03');
    });
  });

  describe('H1F: mobile-money slip fields belong to a mobile-money sale', () => {
    for (const method of ['CASH', 'CARD'] as const) {
      for (const field of ['externalTransactionId', 'payerPhone'] as const) {
        it(`${field} on a ${method} sale is a 400 and nothing is written`, async () => {
          const payment =
            method === 'CASH'
              ? { method, [field]: 'x' }
              : { method, cardScheme: 'VISA', [field]: 'x' };
          await expect(
            service.quickSale('user-1', ctx, dto({ payment } as unknown as QuickSaleDto), meta),
          ).rejects.toBeInstanceOf(BadRequestException);
          expect(prisma.$transaction).not.toHaveBeenCalled();
        });
      }
    }
  });

  describe('H1F: a failed audit write after the commit', () => {
    it('leaves the sale in place and logs order, sale, branch and till but no card data', async () => {
      audit.log.mockRejectedValue(
        new Error('Invalid prisma.auditLog.create() invocation\nlots of echoed data 4242\nrefused'),
      );
      const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      try {
        const res = await service.quickSale('user-1', ctx, dto(), meta);
        expect(res.replayed).toBe(false);
        const line = String(spy.mock.calls[0][0]);
        for (const part of ['o1', 'ORD-000007', 'sale-0000001', 'branch-1', 'DRK-03', 'refused']) {
          expect(line).toContain(part);
        }
        expect(line).not.toContain('4242');
        expect(line).not.toContain('A1B2C3');
      } finally {
        spy.mockRestore();
      }
    });
  });
});
