import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, PrepStation, StockKind, StockMovementType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/** Ids for rows written with raw SQL (no new dependency): time-ordered, 26 characters. */
const createId = () => `c${Date.now().toString(36)}${randomBytes(9).toString('hex')}`;
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { QuickPinService } from '../auth/quick-pin.service';
import {
  ORDER_LINES_SENT,
  ORDER_LINE_VOIDED,
  OrderLinesSentEvent,
  OrderLineVoidedEvent,
} from '../orders/order-events';
import { ingredientsForLine } from './line-ingredients';
import { DISPLAY_UNIT, toBase } from './units';
import { ANSWER_KEY, ANSWER_MANAGER_KEY } from '../approval-requests/approval-requests.service';

type Db = Prisma.TransactionClient | PrismaService;
type Ctx = { organizationId: string; branchId: string };

/** R21: the fixed reasons for taking stock out, and the ledger type each writes. */
export const TAKE_OUT_REASONS = {
  SPOILED_OR_EXPIRED: 'WASTE',
  BURNT_DROPPED_OR_BROKEN: 'WASTE',
  STAFF_MEAL: 'STAFF_MEAL',
  MISSING: 'MISSING',
  RETURNED_TO_SUPPLIER: 'RETURN_TO_SUPPLIER',
} as const satisfies Record<string, StockMovementType>;
export type TakeOutReason = keyof typeof TAKE_OUT_REASONS;

export interface MovementInput {
  storeId: string;
  inventoryItemId: string;
  amount: number;
  type: StockMovementType;
  reason?: string | null;
  note?: string | null;
  refType?: string | null;
  refId?: string | null;
  orderItemId?: string | null;
  userId?: string | null;
  approvedById?: string | null;
  dedupeKey?: string | null;
  /** Unit cost to record instead of the item's current average (deliveries, issues). */
  unitCost?: Decimal | null;
}

/**
 * T6 — stock that moves (03-stock-stores-availability.md sections 3, 4, 5, 7).
 *
 * One append-only ledger (stock_movements; a database trigger refuses UPDATE and DELETE). A
 * store's level is the sum of its rows, kept beside the ledger in store_levels in the same
 * transaction as the row. A sale is never refused for lack of stock (R18): a store may go
 * negative. Sends and voids are heard as order events after their transaction commits; every row
 * they write carries a dedupe key, so a send heard twice moves stock once.
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly quickPin: QuickPinService,
  ) {}

  // ── Stores (one per branch for now; the chain is phase 5) ──

  async mainStore(db: Db, ctx: Ctx) {
    const found = await db.store.findFirst({
      where: { branchId: ctx.branchId, kind: 'MAIN', isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (found) return found;
    try {
      return await db.store.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          name: 'Main store',
          kind: 'MAIN',
        },
      });
    } catch {
      return db.store.findFirstOrThrow({ where: { branchId: ctx.branchId, kind: 'MAIN' } });
    }
  }

  /** The store a station's sends take from: its link, else the branch's main store. */
  async storeForStation(db: Db, ctx: Ctx, station: PrepStation | null) {
    if (station) {
      const link = await db.stationStore.findUnique({
        where: { branchId_station: { branchId: ctx.branchId, station } },
      });
      if (link) {
        const store = await db.store.findUnique({ where: { id: link.storeId } });
        if (store?.isActive) return store;
      }
    }
    return this.mainStore(db, ctx);
  }

  // ── The ledger ──

  /**
   * Writes one row and moves the store's level by the same amount, in the caller's transaction.
   * With a dedupe key, a second write of the same thing is skipped and returns null.
   */
  async move(tx: Prisma.TransactionClient, ctx: Ctx, m: MovementInput) {
    if (!Number.isInteger(m.amount) || m.amount === 0)
      throw new BadRequestException('Amount must be a whole, non-zero number');
    const item = await tx.inventoryItem.findFirst({
      where: { id: m.inventoryItemId, branchId: ctx.branchId },
      select: { id: true, costPerBase: true, stockKind: true },
    });
    if (!item) throw new NotFoundException('Stock item not found in this branch');
    const unitCost = new Decimal(m.unitCost ?? item.costPerBase);
    const value = unitCost.mul(m.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const id = createId();
    const rows = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "stock_movements" ("id","org_id","branch_id","store_id","inventory_item_id","amount","type",
        "reason","note","ref_type","ref_id","order_item_id","user_id","approved_by_id","unit_cost","value","dedupe_key")
      VALUES (${id}, ${ctx.organizationId}, ${ctx.branchId}, ${m.storeId}, ${m.inventoryItemId}, ${m.amount},
        ${m.type}::"StockMovementType", ${m.reason ?? null}, ${m.note ?? null}, ${m.refType ?? null}, ${m.refId ?? null},
        ${m.orderItemId ?? null}, ${m.userId ?? null}, ${m.approvedById ?? null}, ${unitCost.toFixed(6)}::numeric,
        ${value.toFixed(2)}::numeric, ${m.dedupeKey ?? null})
      ON CONFLICT ("dedupe_key") DO NOTHING
      RETURNING "id"`;
    if (rows.length === 0) return null;
    await tx.$executeRaw`
      INSERT INTO "store_levels" ("id","store_id","inventory_item_id","on_hand","updated_at")
      VALUES (${createId()}, ${m.storeId}, ${m.inventoryItemId}, ${m.amount}, now())
      ON CONFLICT ("store_id","inventory_item_id")
      DO UPDATE SET "on_hand" = "store_levels"."on_hand" + EXCLUDED."on_hand", "updated_at" = now()`;
    return tx.stockMovement.findUniqueOrThrow({ where: { id } });
  }

  // ── Stock leaves on send (R12) ──

  /** Heard after a send commits. Safe to hear twice: one row per line and ingredient. */
  @OnEvent(ORDER_LINES_SENT, { async: true, promisify: true })
  async onLinesSent(e: OrderLinesSentEvent) {
    try {
      await this.recordSale({ organizationId: e.orgId, branchId: e.branchId }, e.orderItemIds);
    } catch (err) {
      this.logger.error(
        `stock for sent lines ${e.orderItemIds.join(',')}: ${(err as Error).message}`,
      );
    }
  }

  async recordSale(ctx: Ctx, orderItemIds: string[]) {
    let written = 0;
    for (const lineId of orderItemIds) {
      written += await this.prisma.$transaction(async (tx) => {
        const line = await tx.orderItem.findUnique({
          where: { id: lineId },
          include: { menuItem: { select: { station: true } }, order: { select: { userId: true } } },
        });
        if (!line || !line.sentAt || line.voidedAt) return 0;
        const store = await this.storeForStation(tx, ctx, line.menuItem.station);
        let n = 0;
        for (const ing of await ingredientsForLine(tx, ctx.branchId, line)) {
          const row = await this.move(tx, ctx, {
            storeId: store.id,
            inventoryItemId: ing.inventoryItemId,
            amount: -ing.amount,
            type: 'SALE',
            orderItemId: line.id,
            refType: 'OrderItem',
            refId: line.id,
            userId: line.order.userId,
            dedupeKey: `SALE:${line.id}:${ing.inventoryItemId}`,
          });
          if (row) n++;
        }
        return n;
      });
    }
    return written;
  }

  // ── A void marked "not made" puts it back ──

  @OnEvent(ORDER_LINE_VOIDED, { async: true, promisify: true })
  async onLineVoided(e: OrderLineVoidedEvent) {
    try {
      await this.reverseIfNotMade({ organizationId: e.orgId, branchId: e.branchId }, e.orderItemId);
    } catch (err) {
      this.logger.error(`stock for voided line ${e.orderItemId}: ${(err as Error).message}`);
    }
  }

  async reverseIfNotMade(ctx: Ctx, voidedLineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.orderItem.findUnique({
        where: { id: voidedLineId },
        include: { menuItem: { select: { station: true } } },
      });
      // Only a sent line took stock; only "not made" gives it back. Made-and-voided stays used.
      if (!line || !line.sentAt || line.wasMade !== false) return 0;
      const store = await this.storeForStation(tx, ctx, line.menuItem.station);
      let n = 0;
      for (const ing of await ingredientsForLine(tx, ctx.branchId, line)) {
        const row = await this.move(tx, ctx, {
          storeId: store.id,
          inventoryItemId: ing.inventoryItemId,
          amount: ing.amount,
          type: 'SALE_REVERSAL',
          reason: line.voidReason ?? null,
          orderItemId: line.id,
          refType: 'OrderItem',
          refId: line.id,
          userId: line.voidedById,
          dedupeKey: `REV:${line.id}:${ing.inventoryItemId}`,
        });
        if (row) n++;
      }
      return n;
    });
  }

  // ── Remake: the chef makes a dish again ──

  async remake(ctx: Ctx, userId: string, orderId: string, lineId: string, note?: string) {
    const line = await this.prisma.orderItem.findFirst({
      where: { id: lineId, orderId, order: { branchId: ctx.branchId, orgId: ctx.organizationId } },
      include: { menuItem: { select: { station: true, name: true } } },
    });
    if (!line) throw new NotFoundException('Order line not found');
    if (!line.sentAt)
      throw new ConflictException({ code: 'NOT_SENT', message: 'Only a sent line can be remade' });
    if (line.voidedAt)
      throw new ConflictException({ code: 'VOIDED', message: 'A voided line is not remade' });
    const remakeId = createId();
    const rows = await this.prisma.$transaction(async (tx) => {
      const store = await this.storeForStation(tx, ctx, line.menuItem.station);
      const out = [];
      for (const ing of await ingredientsForLine(tx, ctx.branchId, line)) {
        out.push(
          await this.move(tx, ctx, {
            storeId: store.id,
            inventoryItemId: ing.inventoryItemId,
            amount: -ing.amount,
            type: 'REMAKE',
            note: note ?? null,
            orderItemId: line.id,
            refType: 'Remake',
            refId: remakeId,
            userId,
          }),
        );
      }
      return out.filter(Boolean);
    });
    await this.audit.log({
      actorUserId: userId,
      action: 'ORDER_LINE_REMADE',
      entityType: 'OrderItem',
      entityId: line.id,
      metadata: {
        branchId: ctx.branchId,
        orderId,
        remakeId,
        rows: rows.length,
        note: note ?? null,
      },
    });
    return { remakeId, orderItemId: line.id, movements: rows };
  }

  // ── Take out of stock, and we found more (R21) ──

  private async approverFromPin(ctx: Ctx, pin: string, callerId: string) {
    const approver = await this.prisma.user.findUnique({
      where: { pinLookupHash: this.quickPin.derivePinLookupHash(ctx.branchId, String(pin)) },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
        memberships: { where: { branchId: ctx.branchId, status: 'ACTIVE' }, select: { id: true } },
      },
    });
    const ok =
      !!approver &&
      approver.isActive &&
      approver.quickPinEnabled &&
      !!approver.quickPinHash &&
      approver.memberships.length > 0 &&
      (await bcrypt.compare(String(pin), approver.quickPinHash));
    if (!ok)
      throw new UnauthorizedException({
        code: 'PIN_NOT_RECOGNISED',
        message: 'PIN not recognised',
      });
    if (approver!.id === callerId) {
      throw new ForbiddenException({
        code: 'OWN_PIN',
        message: 'Someone else confirms with their PIN',
      });
    }
    const perms = approver!.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.action),
    );
    if (!perms.includes(ANSWER_KEY) && !perms.includes(ANSWER_MANAGER_KEY)) {
      throw new ForbiddenException({
        code: 'NEEDS_SUPERVISOR',
        message: 'A supervisor confirms this one',
      });
    }
    return approver!.id;
  }

  async takeOut(
    ctx: Ctx,
    caller: { id: string; permissions: string[] },
    dto: {
      inventoryItemId: string;
      amount: string;
      unit: string;
      reason: TakeOutReason;
      note?: string;
      forWhom?: string;
      supervisorPin?: string;
    },
  ) {
    const type = TAKE_OUT_REASONS[dto.reason];
    if (!type)
      throw new BadRequestException({ code: 'REASON', message: 'Choose one of the fixed reasons' });
    if (dto.reason === 'STAFF_MEAL' && !dto.forWhom) {
      throw new BadRequestException({
        code: 'FOR_WHOM',
        message: 'A staff meal says who it was for',
      });
    }
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: dto.inventoryItemId, branchId: ctx.branchId },
    });
    if (!item) throw new NotFoundException('Stock item not found in this branch');
    const amount = toBase(dto.amount, dto.unit, item.stockKind);
    if (amount <= 0) throw new BadRequestException('Take out a positive amount');
    const value = new Decimal(item.costPerBase).mul(amount).toDecimalPlaces(2);
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId: ctx.organizationId },
      select: { wasteValueLimit: true },
    });
    const limit = new Decimal(settings?.wasteValueLimit ?? 50000);
    let approvedById: string | null = null;
    const callerAnswers =
      caller.permissions.includes(ANSWER_KEY) || caller.permissions.includes(ANSWER_MANAGER_KEY);
    if (value.gt(limit) && !callerAnswers) {
      if (!dto.supervisorPin) {
        throw new ForbiddenException({
          code: 'NEEDS_SUPERVISOR_PIN',
          message: `Above UGX ${limit.toFixed(0)} a supervisor confirms with their PIN`,
          value: value.toFixed(2),
          limit: limit.toFixed(2),
        });
      }
      approvedById = await this.approverFromPin(ctx, dto.supervisorPin, caller.id);
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const store = await this.mainStore(tx, ctx);
      return this.move(tx, ctx, {
        storeId: store.id,
        inventoryItemId: item.id,
        amount: -amount,
        type,
        reason: dto.reason,
        note:
          [dto.note, dto.forWhom ? `for ${dto.forWhom}` : null].filter(Boolean).join(' · ') || null,
        refType: 'TakeOut',
        userId: caller.id,
        approvedById,
      });
    });
    await this.audit.log({
      actorUserId: caller.id,
      action: 'STOCK_TAKEN_OUT',
      entityType: 'StockMovement',
      entityId: row!.id,
      metadata: {
        branchId: ctx.branchId,
        inventoryItemId: item.id,
        amount: -amount,
        reason: dto.reason,
        value: value.toFixed(2),
        approvedById,
      },
    });
    return row;
  }

  async found(
    ctx: Ctx,
    callerId: string,
    dto: { inventoryItemId: string; amount: string; unit: string; note?: string },
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: dto.inventoryItemId, branchId: ctx.branchId },
    });
    if (!item) throw new NotFoundException('Stock item not found in this branch');
    const amount = toBase(dto.amount, dto.unit, item.stockKind);
    if (amount <= 0) throw new BadRequestException('Found a positive amount');
    const row = await this.prisma.$transaction(async (tx) => {
      const store = await this.mainStore(tx, ctx);
      return this.move(tx, ctx, {
        storeId: store.id,
        inventoryItemId: item.id,
        amount,
        type: 'FOUND',
        reason: 'WE_FOUND_MORE',
        note: dto.note ?? null,
        refType: 'Found',
        userId: callerId,
      });
    });
    await this.audit.log({
      actorUserId: callerId,
      action: 'STOCK_FOUND',
      entityType: 'StockMovement',
      entityId: row!.id,
      metadata: { branchId: ctx.branchId, inventoryItemId: item.id, amount },
    });
    return row;
  }

  async opening(
    ctx: Ctx,
    callerId: string,
    dto: { inventoryItemId: string; amount: string; unit: string },
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: dto.inventoryItemId, branchId: ctx.branchId },
    });
    if (!item) throw new NotFoundException('Stock item not found in this branch');
    const amount = toBase(dto.amount, dto.unit, item.stockKind);
    if (amount <= 0) throw new BadRequestException('Opening stock is a positive amount');
    return this.prisma.$transaction(async (tx) => {
      const store = await this.mainStore(tx, ctx);
      return this.move(tx, ctx, {
        storeId: store.id,
        inventoryItemId: item.id,
        amount,
        type: 'OPENING',
        refType: 'Opening',
        userId: callerId,
      });
    });
  }

  // ── Items: kind, pack, cost ──

  async setItemKind(
    ctx: Ctx,
    callerId: string,
    id: string,
    dto: { stockKind?: StockKind; packSize?: number },
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!item) throw new NotFoundException('Stock item not found in this branch');
    if (dto.stockKind && dto.stockKind !== item.stockKind) {
      const moved = await this.prisma.stockMovement.count({ where: { inventoryItemId: id } });
      if (moved > 0) {
        throw new ConflictException({
          code: 'KIND_LOCKED',
          message: 'The kind is fixed once stock has moved',
        });
      }
    }
    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(dto.stockKind ? { stockKind: dto.stockKind } : {}),
        ...(dto.packSize !== undefined ? { packSize: dto.packSize } : {}),
      },
    });
    await this.audit.log({
      actorUserId: callerId,
      action: 'STOCK_ITEM_KIND_SET',
      entityType: 'InventoryItem',
      entityId: id,
      metadata: {
        branchId: ctx.branchId,
        stockKind: updated.stockKind,
        packSize: updated.packSize,
      },
    });
    return updated;
  }

  /** The accountant (or manager, owner) sets a cost per display unit: per piece, per kg, per L. */
  async setItemCost(ctx: Ctx, callerId: string, id: string, unitCost: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, branchId: ctx.branchId },
    });
    if (!item) throw new NotFoundException('Stock item not found in this branch');
    if (!item.stockKind)
      throw new ConflictException({ code: 'NO_KIND', message: "Set the item's kind first" });
    const perDisplay = new Decimal(unitCost);
    if (perDisplay.isNegative()) throw new BadRequestException('A cost is not negative');
    const costPerBase = perDisplay.div(1000).toDecimalPlaces(6);
    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: { costPerBase },
    });
    await this.audit.log({
      actorUserId: callerId,
      action: 'STOCK_ITEM_COST_SET',
      entityType: 'InventoryItem',
      entityId: id,
      metadata: {
        branchId: ctx.branchId,
        before: item.costPerBase.toString(),
        after: costPerBase.toString(),
      },
    });
    return {
      ...updated,
      costPerDisplayUnit: perDisplay.toFixed(2),
      displayUnit: DISPLAY_UNIT[item.stockKind],
    };
  }

  // ── How a menu item is sold (03 section 4) ──

  async setSoldAs(
    ctx: Ctx,
    callerId: string,
    menuItemId: string,
    dto: {
      soldAs: 'AS_BOUGHT' | 'MEASURE' | 'RECIPE' | 'NOT_TRACKED';
      stockItemId?: string | null;
    },
  ) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, branchId: ctx.branchId },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    let stockItemId: string | null = null;
    if (dto.soldAs === 'AS_BOUGHT' || dto.soldAs === 'MEASURE') {
      if (!dto.stockItemId) {
        throw new BadRequestException({
          code: 'STOCK_ITEM',
          message: 'Name the stock item it is sold from',
        });
      }
      const stockItem = await this.prisma.inventoryItem.findFirst({
        where: { id: dto.stockItemId, branchId: ctx.branchId },
      });
      if (!stockItem) throw new NotFoundException('Stock item not found in this branch');
      if (dto.soldAs === 'MEASURE' && stockItem.stockKind === 'COUNT') {
        throw new BadRequestException({
          code: 'MEASURE_KIND',
          message: 'A measure is taken from a weight or a volume',
        });
      }
      stockItemId = stockItem.id;
    }
    if (dto.soldAs === 'RECIPE') {
      const rows = await this.prisma.recipeIngredient.count({
        where: { menuItemId, branchId: ctx.branchId },
      });
      if (rows === 0)
        throw new ConflictException({ code: 'NO_RECIPE', message: 'Write the recipe first' });
    }
    const updated = await this.prisma.menuItem.update({
      where: { id: menuItemId },
      data: { soldAs: dto.soldAs, stockItemId },
      select: { id: true, name: true, soldAs: true, stockItemId: true },
    });
    await this.audit.log({
      actorUserId: callerId,
      action: 'MENU_ITEM_SOLD_AS_SET',
      entityType: 'MenuItem',
      entityId: menuItemId,
      metadata: { branchId: ctx.branchId, before: item.soldAs, after: dto.soldAs, stockItemId },
    });
    return updated;
  }

  async setServingAmount(
    ctx: Ctx,
    callerId: string,
    servingId: string,
    amount: string,
    unit: string,
  ) {
    const serving = await this.prisma.menuItemServing.findFirst({
      where: { id: servingId, menuItem: { branchId: ctx.branchId } },
      include: { menuItem: { select: { stockItemId: true } } },
    });
    if (!serving) throw new NotFoundException('Serving not found');
    const stockItem = serving.menuItem.stockItemId
      ? await this.prisma.inventoryItem.findUnique({ where: { id: serving.menuItem.stockItemId } })
      : null;
    const base = toBase(amount, unit, stockItem?.stockKind ?? null);
    if (base <= 0) throw new BadRequestException('A serving takes a positive amount');
    const updated = await this.prisma.menuItemServing.update({
      where: { id: servingId },
      data: { stockAmount: base },
    });
    await this.audit.log({
      actorUserId: callerId,
      action: 'SERVING_STOCK_AMOUNT_SET',
      entityType: 'MenuItemServing',
      entityId: servingId,
      metadata: { branchId: ctx.branchId, stockAmount: base },
    });
    return updated;
  }

  // ── Reading ──

  private maskCost<T extends { unitCost?: unknown; value?: unknown }>(
    rows: T[],
    seesCost: boolean,
  ) {
    return seesCost ? rows : rows.map(({ unitCost: _u, value: _v, ...rest }) => rest);
  }

  async movements(
    ctx: Ctx,
    caller: { permissions: string[] },
    q: { inventoryItemId?: string; orderItemId?: string; type?: string; take?: number },
  ) {
    const rows = await this.prisma.stockMovement.findMany({
      where: {
        branchId: ctx.branchId,
        ...(q.inventoryItemId ? { inventoryItemId: q.inventoryItemId } : {}),
        ...(q.orderItemId ? { orderItemId: q.orderItemId } : {}),
        ...(q.type ? { type: q.type as StockMovementType } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(Number(q.take) || 200, 1), 500),
    });
    // 03 section 11: chefs do not see cost; the value of a row is cost.
    return {
      data: this.maskCost(rows, caller.permissions.includes('pos:cost:read')),
      total: rows.length,
    };
  }

  async levels(ctx: Ctx, caller: { permissions: string[] }) {
    const stores = await this.prisma.store.findMany({ where: { branchId: ctx.branchId } });
    const levels = await this.prisma.storeLevel.findMany({
      where: { storeId: { in: stores.map((s) => s.id) } },
    });
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: levels.map((l) => l.inventoryItemId) } },
      select: { id: true, name: true, stockKind: true, costPerBase: true },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    const seesCost = caller.permissions.includes('pos:cost:read');
    return {
      stores: stores.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        feedsFromStoreId: s.feedsFromStoreId,
      })),
      levels: levels.map((l) => {
        const it = byId.get(l.inventoryItemId);
        return {
          storeId: l.storeId,
          inventoryItemId: l.inventoryItemId,
          name: it?.name,
          kind: it?.stockKind,
          onHand: l.onHand,
          negative: l.onHand < 0,
          ...(seesCost && it
            ? { value: new Decimal(it.costPerBase).mul(l.onHand).toDecimalPlaces(2).toString() }
            : {}),
        };
      }),
    };
  }
}
