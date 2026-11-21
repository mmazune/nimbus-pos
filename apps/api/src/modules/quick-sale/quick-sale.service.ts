import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  CardScheme,
  MomoNetwork,
  OrderStatus,
  PaymentCaptureMode,
  PaymentMethod,
  PaymentStatus,
  PaymentVerificationStatus,
  Prisma,
  ServiceType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { allocateOrderNumber } from '../orders/order-number';
import { QuickSaleDto } from './dto';
import { normalizeTillCode } from './till-code';

interface BranchContext {
  branchId: string;
  organizationId: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface PricedLine {
  menuItemId: string;
  menuItemServingId: string | null;
  quantity: number;
  price: Decimal;
  subtotal: Decimal;
}

interface Plan {
  lines: PricedLine[];
  subtotal: Decimal;
  total: Decimal;
  tendered: Decimal | null;
  changeDue: Decimal;
}

const MAX_ATTEMPTS = 3;
/** orders.total is Decimal(12,2): anything at or above this cannot be stored. */
const TOTAL_LIMIT = new Decimal('10000000000');

const ORDER_INCLUDE = {
  items: {
    include: { menuItem: { select: { sku: true, name: true, brand: true } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrderInclude;

type SavedOrder = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
type SavedPayment = Prisma.PaymentGetPayload<object>;
type StoredSale = SavedOrder & { payments: SavedPayment[] };

/** The parts of a request that a stored sale cannot reproduce on its own. */
type Fingerprint = {
  soldAt: string | null;
  tenderedAmount: string | null;
};

function fingerprintOf(dto: QuickSaleDto): Fingerprint {
  const sent = dto.payment.tenderedAmount;
  return {
    soldAt: dto.soldAt ?? null,
    tenderedAmount: sent === undefined ? null : new Decimal(String(sent)).toString(),
  };
}

/** Which unique index a P2002 violated, normalised so column or field names both match. */
function uniqueViolation(e: unknown): 'client_sale_id' | 'order_number' | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return null;
  const target = JSON.stringify(e.meta?.target ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (target.includes('clientsaleid')) return 'client_sale_id';
  if (target.includes('ordernumber')) return 'order_number';
  return null;
}

@Injectable()
export class QuickSaleService {
  private readonly logger = new Logger(QuickSaleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async quickSale(userId: string, ctx: BranchContext, rawDto: QuickSaleDto, meta: RequestMeta) {
    // The DTO transform already normalises the till code; this keeps direct callers honest too.
    const dto: QuickSaleDto = { ...rawDto, tillCode: normalizeTillCode(rawDto.tillCode) };

    // 1. Replay check, first: a retry of a sale that already landed never re-validates or re-prices.
    //    It is a replay only if it is the SAME sale (H1F); otherwise it is a 409 and nothing is written.
    const existing = await this.findExisting(ctx, dto.clientSaleId);
    if (existing) return this.replayOf(existing, ctx, dto);

    // 2-3. Load, validate and price outside the transaction.
    const plan = await this.plan(ctx, dto);

    // 4-5. One transaction of writes only; retry on an order-number collision.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const saved = await this.prisma.$transaction(
          (tx) => this.write(tx, userId, ctx, dto, plan),
          { timeout: 15000, maxWait: 5000 },
        );
        await this.auditSale(userId, ctx, dto, saved.order, saved.payment, plan, meta);
        return this.toResponse(saved.order, saved.payment, false, plan.changeDue);
      } catch (e) {
        const violated = uniqueViolation(e);
        if (violated === 'client_sale_id') {
          const original = await this.findExisting(ctx, dto.clientSaleId);
          if (original) return this.replayOf(original, ctx, dto);
          throw e;
        }
        if (violated === 'order_number') {
          if (attempt < MAX_ATTEMPTS) continue;
          throw new ConflictException({
            code: 'ORDER_NUMBER_CONTENTION',
            message: 'Could not allocate an order number. Retry the same sale.',
          });
        }
        throw e;
      }
    }
    /* istanbul ignore next: the loop always returns or throws */
    throw new ConflictException({
      code: 'ORDER_NUMBER_CONTENTION',
      message: 'Retry the same sale.',
    });
  }

  // ── replay ──

  private findExisting(ctx: BranchContext, clientSaleId: string) {
    return this.prisma.order.findFirst({
      where: { orgId: ctx.organizationId, clientSaleId },
      include: { ...ORDER_INCLUDE, payments: { orderBy: { createdAt: 'asc' } } },
    }) as Promise<StoredSale | null>;
  }

  private replayOf(stored: StoredSale, ctx: BranchContext, dto: QuickSaleDto) {
    if (stored.branchId !== ctx.branchId) {
      throw new ConflictException({
        code: 'CLIENT_SALE_ID_OTHER_BRANCH',
        message: 'This clientSaleId was already used in another branch.',
      });
    }
    const differs = this.differences(stored, dto);
    if (differs.length > 0) {
      // Names of the differing parts only, never their values. The stored sale is untouched.
      this.logger.warn(
        `QUICK_SALE_REPLAY_MISMATCH ${JSON.stringify({
          clientSaleId: dto.clientSaleId,
          branchId: ctx.branchId,
          tillCode: dto.tillCode,
          orderId: stored.id,
          differs,
        })}`,
      );
      throw new ConflictException({
        code: 'CLIENT_SALE_ID_PAYLOAD_MISMATCH',
        message:
          'This clientSaleId was already used for a different sale. Nothing was saved; give the new sale its own clientSaleId.',
        differs,
      });
    }
    const changeDue = new Decimal(
      String((stored.metadata as { changeDue?: string } | null)?.changeDue ?? '0'),
    );
    return this.toResponse(stored, stored.payments[0], true, changeDue);
  }

  /**
   * Which parts of this request differ from the sale already stored under its clientSaleId.
   * Compared: till, method, card scheme / mobile-money network, the lines as a multiset of
   * (item, serving, quantity), and (from the stored fingerprint) tendered amount and soldAt
   * exactly as sent. Not compared: authCode, cardLast4, terminalId and the mobile-money slip
   * fields: a retry may carry a corrected slip, and a replay never changes the stored sale.
   */
  private differences(stored: StoredSale, dto: QuickSaleDto): string[] {
    const out: string[] = [];
    const payment = stored.payments[0];
    const p = dto.payment;

    if (normalizeTillCode(stored.tillCode ?? '') !== dto.tillCode) out.push('tillCode');
    if (!payment || payment.method !== p.method) out.push('payment.method');
    if ((payment?.cardScheme ?? null) !== (p.cardScheme ?? null)) out.push('payment.cardScheme');
    if ((payment?.momoNetwork ?? null) !== (p.momoNetwork ?? null)) out.push('payment.momoNetwork');

    // Lines as a multiset: each request line must claim one distinct stored line.
    const unclaimed = [...stored.items];
    let linesMatch = dto.lines.length === stored.items.length;
    for (const l of dto.lines) {
      if (!linesMatch) break;
      const at = unclaimed.findIndex(
        (i) =>
          (l.sku ? i.menuItem?.sku === l.sku : i.menuItemId === l.menuItemId) &&
          (i.menuItemServingId ?? null) === (l.menuItemServingId ?? null) &&
          i.quantity === l.quantity,
      );
      if (at < 0) linesMatch = false;
      else unclaimed.splice(at, 1);
    }
    if (!linesMatch) out.push('lines');

    // Fingerprint fields only exist on sales written by H1F or later; older rows skip them.
    const fp = (stored.metadata as { fingerprint?: Fingerprint } | null)?.fingerprint;
    if (fp) {
      const now = fingerprintOf(dto);
      if (fp.tenderedAmount !== now.tenderedAmount) out.push('payment.tenderedAmount');
      if (fp.soldAt !== now.soldAt) out.push('soldAt');
    }
    return out;
  }

  // ── validate + price ──

  private bad(code: string, message: string): never {
    throw new BadRequestException({ code, message });
  }

  private async plan(ctx: BranchContext, dto: QuickSaleDto): Promise<Plan> {
    const p = dto.payment;
    const cardFields = p.cardScheme || p.cardLast4 || p.authCode || p.terminalId;
    if (p.method === 'CASH' && (cardFields || p.momoNetwork)) {
      this.bad(
        'QUICK_SALE_CASH_FIELDS',
        'Card or mobile-money fields are not allowed on a cash sale.',
      );
    }
    if (p.method === 'CARD') {
      if (!p.cardScheme)
        this.bad('QUICK_SALE_CARD_SCHEME_REQUIRED', 'cardScheme is required for a card sale.');
      if (p.momoNetwork)
        this.bad('QUICK_SALE_CARD_FIELDS', 'momoNetwork is not allowed on a card sale.');
    }
    if (p.method === 'MOMO') {
      if (!p.momoNetwork)
        this.bad(
          'QUICK_SALE_MOMO_NETWORK_REQUIRED',
          'momoNetwork is required for a mobile-money sale.',
        );
      if (cardFields)
        this.bad('QUICK_SALE_MOMO_FIELDS', 'Card fields are not allowed on a mobile-money sale.');
    }
    if (p.method !== 'CASH' && p.tenderedAmount !== undefined) {
      this.bad('QUICK_SALE_TENDERED_CASH_ONLY', 'tenderedAmount applies to cash sales only.');
    }

    for (const l of dto.lines) {
      if (!!l.sku === !!l.menuItemId) {
        this.bad('QUICK_SALE_LINE_REF', 'Each line needs exactly one of sku or menuItemId.');
      }
    }

    // One query for every line: active items of THIS branch of THIS organisation only.
    const skus = [...new Set(dto.lines.map((l) => l.sku).filter((s): s is string => !!s))];
    const ids = [...new Set(dto.lines.map((l) => l.menuItemId).filter((s): s is string => !!s))];
    const items = await this.prisma.menuItem.findMany({
      where: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        isActive: true,
        OR: [
          ...(skus.length ? [{ sku: { in: skus } }] : []),
          ...(ids.length ? [{ id: { in: ids } }] : []),
        ],
      },
      include: { servings: true },
    });

    const lines: PricedLine[] = [];
    let subtotal = new Decimal(0);
    for (const l of dto.lines) {
      let item;
      if (l.sku) {
        const matches = items.filter((i) => i.sku === l.sku);
        if (matches.length === 0)
          this.bad(
            'QUICK_SALE_ITEM_NOT_FOUND',
            `No active item with SKU "${l.sku}" in this branch.`,
          );
        if (matches.length > 1)
          this.bad(
            'QUICK_SALE_SKU_AMBIGUOUS',
            `SKU "${l.sku}" matches more than one active item in this branch.`,
          );
        item = matches[0];
      } else {
        item = items.find((i) => i.id === l.menuItemId);
        if (!item)
          this.bad('QUICK_SALE_ITEM_NOT_FOUND', 'No active item with that id in this branch.');
      }
      let unit: Decimal = new Decimal(item.price);
      if (l.menuItemServingId) {
        const serving = item.servings.find((s) => s.id === l.menuItemServingId);
        if (!serving)
          this.bad('QUICK_SALE_SERVING_NOT_FOUND', 'That serving does not belong to the item.');
        if (!serving.isActive)
          this.bad('QUICK_SALE_SERVING_INACTIVE', 'That serving is not available.');
        unit = new Decimal(serving.price);
      }
      const price = unit.toDecimalPlaces(2);
      const lineSubtotal = price.mul(l.quantity);
      subtotal = subtotal.add(lineSubtotal);
      lines.push({
        menuItemId: item.id,
        menuItemServingId: l.menuItemServingId ?? null,
        quantity: l.quantity,
        price,
        subtotal: lineSubtotal,
      });
    }

    // Prices are tax-inclusive: tax 0, total = subtotal (03 §2 step 3).
    const total = subtotal;
    if (total.gte(TOTAL_LIMIT)) this.bad('QUICK_SALE_TOTAL_TOO_LARGE', 'The total is too large.');

    let tendered: Decimal | null = null;
    let changeDue = new Decimal(0);
    if (p.method === 'CASH') {
      tendered = p.tenderedAmount !== undefined ? new Decimal(String(p.tenderedAmount)) : total;
      if (tendered.lt(total))
        this.bad('QUICK_SALE_TENDERED_BELOW_TOTAL', 'The cash tendered is below the total.');
      changeDue = tendered.sub(total);
    }
    return { lines, subtotal, total, tendered, changeDue };
  }

  // ── the transaction: writes only ──

  private async write(
    tx: Prisma.TransactionClient,
    userId: string,
    ctx: BranchContext,
    dto: QuickSaleDto,
    plan: Plan,
  ) {
    const orderNumber = await allocateOrderNumber(tx, ctx.branchId);
    const order = await tx.order.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        userId,
        orderNumber,
        status: OrderStatus.CLOSED,
        serviceType: ServiceType.TAKEAWAY,
        subtotal: plan.subtotal,
        tax: new Decimal(0),
        discount: new Decimal(0),
        total: plan.total,
        tillCode: dto.tillCode,
        clientSaleId: dto.clientSaleId,
        metadata: {
          source: 'QUICK_SALE',
          // 03 §2: soldAt defaults to now when the tablet sends none. Stored only; never used
          // for numbering, locking or ordering (createdAt stays the server's clock).
          soldAt: dto.soldAt ?? new Date().toISOString(),
          tendered: plan.tendered ? plan.tendered.toString() : null,
          changeDue: plan.changeDue.toString(),
          // What was asked for, as sent: a later request with the same clientSaleId is a replay
          // only if it matches (H1F).
          fingerprint: fingerprintOf(dto),
        },
        items: {
          create: plan.lines.map((l) => ({
            menuItemId: l.menuItemId,
            menuItemServingId: l.menuItemServingId,
            quantity: l.quantity,
            price: l.price,
            subtotal: l.subtotal,
          })),
        },
      },
      include: ORDER_INCLUDE,
    });

    const p = dto.payment;
    const isCash = p.method === 'CASH';
    const payment = await tx.payment.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: order.id,
        amount: plan.total,
        method: PaymentMethod[p.method],
        status: PaymentStatus.COMPLETED,
        captureMode: isCash
          ? PaymentCaptureMode.ONLINE_PROVIDER
          : PaymentCaptureMode.MANUAL_REFERENCE,
        verificationStatus: isCash
          ? PaymentVerificationStatus.NOT_REQUIRED
          : PaymentVerificationStatus.UNVERIFIED,
        tillCode: dto.tillCode,
        cardScheme: p.cardScheme as CardScheme | undefined,
        cardLast4: p.cardLast4,
        authCode: p.authCode,
        terminalId: p.terminalId,
        momoNetwork: p.momoNetwork as MomoNetwork | undefined,
        externalTransactionId: p.externalTransactionId,
        payerPhone: p.payerPhone,
        enteredById: userId,
      },
    });
    return { order, payment };
  }

  // ── after commit ──

  private async auditSale(
    userId: string,
    ctx: BranchContext,
    dto: QuickSaleDto,
    order: SavedOrder,
    payment: SavedPayment,
    plan: Plan,
    meta: RequestMeta,
  ): Promise<void> {
    try {
      await this.audit.log({
        actorUserId: userId,
        action: 'ORDER_QUICK_SALE',
        entityType: 'Order',
        entityId: order.id,
        metadata: {
          branchId: ctx.branchId,
          orgId: ctx.organizationId,
          orderNumber: order.orderNumber,
          clientSaleId: dto.clientSaleId,
          tillCode: dto.tillCode,
          method: payment.method,
          total: plan.total.toString(),
          itemCount: plan.lines.length,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    } catch (e) {
      // The sale is committed; a failed audit write must not turn it into an error the
      // tablet would retry. It is logged loudly instead.
      // Enough to find the sale and its till without a database lookup. No request body and no
      // card field: only ids, and the last line of the database error (capped), never the
      // multi-line Prisma message that echoes the statement.
      const reason = (e instanceof Error ? e.message : String(e))
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .pop();
      this.logger.error(
        `ORDER_QUICK_SALE audit write failed ${JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          clientSaleId: dto.clientSaleId,
          branchId: ctx.branchId,
          tillCode: dto.tillCode,
          error: e instanceof Error ? e.name : 'unknown',
          reason: (reason ?? '').slice(0, 200),
        })}`,
      );
    }
  }

  // ── response ──

  private toResponse(
    order: SavedOrder,
    payment: SavedPayment,
    replayed: boolean,
    changeDue: Decimal,
  ) {
    return {
      replayed,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        tillCode: order.tillCode,
        createdAt: order.createdAt,
      },
      items: order.items.map((i) => ({
        id: i.id,
        menuItemId: i.menuItemId,
        menuItemServingId: i.menuItemServingId,
        sku: i.menuItem?.sku ?? null,
        name: i.menuItem?.name ?? null,
        brand: i.menuItem?.brand ?? null,
        quantity: i.quantity,
        price: i.price,
        subtotal: i.subtotal,
      })),
      payment: {
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amount: payment.amount,
        captureMode: payment.captureMode,
        verificationStatus: payment.verificationStatus,
        tillCode: payment.tillCode,
        cardScheme: payment.cardScheme,
        cardLast4: payment.cardLast4,
        authCode: payment.authCode,
        terminalId: payment.terminalId,
        momoNetwork: payment.momoNetwork,
        createdAt: payment.createdAt,
      },
      changeDue,
    };
  }
}
