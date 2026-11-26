import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrepStation, Prisma, StockCountKind, StoreKind } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { QuickPinService } from '../auth/quick-pin.service';
import { ANSWER_MANAGER_KEY } from '../approval-requests/approval-requests.service';
import { StockService } from './stock.service';
import { toBase } from './units';

type Ctx = { organizationId: string; branchId: string };
type Me = { id: string; permissions: string[] };
type AmountIn = { amount: string; unit: string };

const USAGE_TYPES = ['SALE', 'REMAKE', 'WASTE', 'STAFF_MEAL', 'MISSING'] as const;

/** Round a need up to a whole pack (03 section 7). */
export function roundUpToPack(need: number, packSize: number | null | undefined) {
  if (need <= 0) return 0;
  if (!packSize || packSize <= 0) return need;
  return Math.ceil(need / packSize) * packSize;
}

/** Moving weighted average of one base unit; nothing on hand (or less) takes the new price. */
export function movingAverage(onHand: number, avgBefore: Decimal, amount: number, cost: Decimal) {
  if (onHand <= 0) return new Decimal(cost).toDecimalPlaces(6);
  return new Decimal(avgBefore)
    .mul(onHand)
    .add(new Decimal(cost).mul(amount))
    .div(onHand + amount)
    .toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

/**
 * T6 phase 5 — stores (03-stock-stores-availability.md sections 2, 7, 8, 9, 10).
 *
 * A branch's stores form a chain: one main store, optional secondary stores, point stores linked
 * to stations; each store but the main feeds from another. A store below an item's minimum gets a
 * suggested request up to its fill-to; requests go REQUESTED -> ISSUED -> RECEIVED with the
 * receiver's PIN, and what was issued but not received stays on the request as that trip's loss.
 * Deliveries move the moving average cost; the top of the chain below minimum is "To buy". Counts
 * are blind by default and never stop selling.
 */
@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly quickPin: QuickPinService,
    private readonly stock: StockService,
  ) {}

  private async store(ctx: Ctx, id: string) {
    const s = await this.prisma.store.findFirst({ where: { id, branchId: ctx.branchId } });
    if (!s) throw new NotFoundException('Store not found in this branch');
    return s;
  }

  private async item(ctx: Ctx, id: string) {
    const i = await this.prisma.inventoryItem.findFirst({ where: { id, branchId: ctx.branchId } });
    if (!i) throw new NotFoundException('Stock item not found in this branch');
    return i;
  }

  // ── The chain ──

  async listStores(ctx: Ctx) {
    await this.stock.mainStore(this.prisma, ctx);
    const [stores, links] = await Promise.all([
      this.prisma.store.findMany({
        where: { branchId: ctx.branchId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.stationStore.findMany({ where: { branchId: ctx.branchId } }),
    ]);
    return { stores, stations: links.map((l) => ({ station: l.station, storeId: l.storeId })) };
  }

  async createStore(
    ctx: Ctx,
    me: Me,
    dto: { name: string; kind: StoreKind; feedsFromStoreId?: string },
  ) {
    if (dto.kind === 'MAIN') {
      throw new ConflictException({
        code: 'ONE_MAIN',
        message: 'A branch has one main store; it is made for you',
      });
    }
    const main = await this.stock.mainStore(this.prisma, ctx);
    const feeds = dto.feedsFromStoreId ? await this.store(ctx, dto.feedsFromStoreId) : main;
    if (dto.kind === 'SECONDARY' && feeds.kind !== 'MAIN') {
      throw new BadRequestException({
        code: 'CHAIN',
        message: 'A secondary store feeds from the main store',
      });
    }
    if (feeds.kind === 'POINT') {
      throw new BadRequestException({
        code: 'CHAIN',
        message: 'A point store feeds no other store',
      });
    }
    const created = await this.prisma.store.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        name: dto.name,
        kind: dto.kind,
        feedsFromStoreId: feeds.id,
      },
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'STORE_CREATED',
      entityType: 'Store',
      entityId: created.id,
      metadata: { branchId: ctx.branchId, kind: dto.kind, feedsFromStoreId: feeds.id },
    });
    return created;
  }

  async linkStation(ctx: Ctx, me: Me, station: PrepStation, storeId: string) {
    if (station === 'NONE') throw new BadRequestException('NONE is not a station');
    await this.store(ctx, storeId);
    const link = await this.prisma.stationStore.upsert({
      where: { branchId_station: { branchId: ctx.branchId, station } },
      update: { storeId },
      create: { branchId: ctx.branchId, station, storeId },
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'STATION_STORE_LINKED',
      entityType: 'StationStore',
      entityId: link.id,
      metadata: { branchId: ctx.branchId, station, storeId },
    });
    return link;
  }

  // ── Minimum and fill-to (03 section 7) ──

  async setLevel(
    ctx: Ctx,
    me: Me,
    storeId: string,
    itemId: string,
    dto: { minimum: string; fillTo: string; unit: string },
  ) {
    await this.store(ctx, storeId);
    const item = await this.item(ctx, itemId);
    const minimum = toBase(dto.minimum, dto.unit, item.stockKind);
    const fillTo = toBase(dto.fillTo, dto.unit, item.stockKind);
    if (minimum < 0 || fillTo < minimum) {
      throw new BadRequestException({ code: 'LEVELS', message: 'Fill-to is at least the minimum' });
    }
    const level = await this.prisma.storeLevel.upsert({
      where: { storeId_inventoryItemId: { storeId, inventoryItemId: itemId } },
      update: { minimum, fillTo },
      create: { storeId, inventoryItemId: itemId, minimum, fillTo },
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'STORE_LEVEL_SET',
      entityType: 'StoreLevel',
      entityId: level.id,
      metadata: { branchId: ctx.branchId, storeId, inventoryItemId: itemId, minimum, fillTo },
    });
    return level;
  }

  /** Issued to this store and not yet received, per item. */
  private async onItsWay(storeId: string) {
    const lines = await this.prisma.storeRequestLine.findMany({
      where: { request: { toStoreId: storeId, status: 'ISSUED' } },
    });
    const m = new Map<string, number>();
    for (const l of lines)
      m.set(l.inventoryItemId, (m.get(l.inventoryItemId) ?? 0) + (l.issued ?? 0));
    return m;
  }

  /** The suggested request: each item below minimum, up to fill-to, less what is on its way. */
  async suggestion(ctx: Ctx, storeId: string) {
    const store = await this.store(ctx, storeId);
    const levels = await this.prisma.storeLevel.findMany({
      where: { storeId, minimum: { not: null }, fillTo: { not: null } },
    });
    const way = await this.onItsWay(storeId);
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: levels.map((l) => l.inventoryItemId) } },
      select: { id: true, name: true, packSize: true, stockKind: true },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    const lines = levels
      .filter((l) => l.onHand < (l.minimum as number))
      .map((l) => {
        const it = byId.get(l.inventoryItemId)!;
        const onTheWay = way.get(l.inventoryItemId) ?? 0;
        const need = (l.fillTo as number) - l.onHand - onTheWay;
        return {
          inventoryItemId: l.inventoryItemId,
          name: it?.name,
          onHand: l.onHand,
          minimum: l.minimum,
          fillTo: l.fillTo,
          onItsWay: onTheWay,
          need,
          packSize: it?.packSize ?? null,
          amount: roundUpToPack(need, it?.packSize),
        };
      })
      .filter((x) => x.amount > 0);
    return { storeId, feedsFromStoreId: store.feedsFromStoreId, lines };
  }

  // ── Requests between stores (03 section 8) ──

  async createRequest(
    ctx: Ctx,
    me: Me,
    dto: {
      toStoreId: string;
      fromSuggestion?: boolean;
      lines?: ({ inventoryItemId: string } & AmountIn)[];
      note?: string;
    },
  ) {
    const to = await this.store(ctx, dto.toStoreId);
    if (!to.feedsFromStoreId) {
      throw new BadRequestException({
        code: 'NO_FEEDER',
        message: 'The main store buys; it does not ask',
      });
    }
    let lines: { inventoryItemId: string; requested: number }[];
    if (dto.fromSuggestion) {
      lines = (await this.suggestion(ctx, to.id)).lines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        requested: l.amount,
      }));
      if (lines.length === 0)
        throw new ConflictException({
          code: 'NOTHING_TO_ASK',
          message: 'Nothing is below its minimum',
        });
    } else {
      if (!dto.lines?.length) throw new BadRequestException('Ask for at least one item');
      lines = [];
      for (const l of dto.lines) {
        const item = await this.item(ctx, l.inventoryItemId);
        const requested = toBase(l.amount, l.unit, item.stockKind);
        if (requested <= 0) throw new BadRequestException('Ask for a positive amount');
        lines.push({ inventoryItemId: item.id, requested });
      }
    }
    const req = await this.prisma.storeRequest.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        fromStoreId: to.feedsFromStoreId,
        toStoreId: to.id,
        suggested: !!dto.fromSuggestion,
        note: dto.note ?? null,
        requestedById: me.id,
        lines: { create: lines },
      },
      include: { lines: true },
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'STORE_REQUEST_SENT',
      entityType: 'StoreRequest',
      entityId: req.id,
      metadata: {
        branchId: ctx.branchId,
        toStoreId: to.id,
        fromStoreId: to.feedsFromStoreId,
        lines: lines.length,
      },
    });
    return req;
  }

  private async request(ctx: Ctx, id: string) {
    const r = await this.prisma.storeRequest.findFirst({
      where: { id, branchId: ctx.branchId },
      include: { lines: true },
    });
    if (!r) throw new NotFoundException('Request not found');
    return r;
  }

  async issue(ctx: Ctx, me: Me, id: string, dto: { lines?: ({ lineId: string } & AmountIn)[] }) {
    const req = await this.request(ctx, id);
    const given = new Map((dto.lines ?? []).map((l) => [l.lineId, l]));
    const issued = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.storeRequest.updateMany({
        where: { id: req.id, status: 'REQUESTED' },
        data: { status: 'ISSUED', issuedById: me.id, issuedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException(`Request is ${req.status}`);
      for (const line of req.lines) {
        const item = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: line.inventoryItemId },
        });
        const g = given.get(line.id);
        const amount = g ? toBase(g.amount, g.unit, item.stockKind) : line.requested;
        if (amount < 0) throw new BadRequestException('Issue a positive amount, or nothing');
        await tx.storeRequestLine.update({
          where: { id: line.id },
          data: { issued: amount, unitCost: item.costPerBase },
        });
        if (amount > 0) {
          await this.stock.move(tx, ctx, {
            storeId: req.fromStoreId,
            inventoryItemId: line.inventoryItemId,
            amount: -amount,
            type: 'ISSUE_OUT',
            refType: 'StoreRequest',
            refId: req.id,
            userId: me.id,
            unitCost: item.costPerBase,
            dedupeKey: `ISSUE_OUT:${line.id}`,
          });
        }
      }
      return tx.storeRequest.findUniqueOrThrow({ where: { id: req.id }, include: { lines: true } });
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'STORE_REQUEST_ISSUED',
      entityType: 'StoreRequest',
      entityId: req.id,
      metadata: {
        branchId: ctx.branchId,
        lines: issued.lines.map((l) => ({ id: l.id, issued: l.issued })),
      },
    });
    return issued;
  }

  async decline(ctx: Ctx, me: Me, id: string, note?: string) {
    const req = await this.request(ctx, id);
    const done = await this.prisma.storeRequest.updateMany({
      where: { id: req.id, status: 'REQUESTED' },
      data: { status: 'DECLINED', issuedById: me.id, issuedAt: new Date(), note: note ?? req.note },
    });
    if (done.count !== 1) throw new ConflictException(`Request is ${req.status}`);
    await this.audit.log({
      actorUserId: me.id,
      action: 'STORE_REQUEST_DECLINED',
      entityType: 'StoreRequest',
      entityId: req.id,
      metadata: { branchId: ctx.branchId, note: note ?? null },
    });
    return this.request(ctx, id);
  }

  /** The receiver types their own PIN; it must belong to someone here who may receive. */
  private async receiverFromPin(ctx: Ctx, pin: string) {
    const u = await this.prisma.user.findUnique({
      where: { pinLookupHash: this.quickPin.derivePinLookupHash(ctx.branchId, String(pin)) },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
        memberships: { where: { branchId: ctx.branchId, status: 'ACTIVE' }, select: { id: true } },
      },
    });
    const ok =
      !!u &&
      u.isActive &&
      u.quickPinEnabled &&
      !!u.quickPinHash &&
      u.memberships.length > 0 &&
      (await bcrypt.compare(String(pin), u.quickPinHash));
    if (!ok)
      throw new UnauthorizedException({
        code: 'PIN_NOT_RECOGNISED',
        message: 'PIN not recognised',
      });
    const perms = u!.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.action),
    );
    if (!perms.includes('pos:store:request')) {
      throw new ForbiddenException({
        code: 'NOT_A_RECEIVER',
        message: 'This PIN cannot receive for a store',
      });
    }
    return u!.id;
  }

  async receive(
    ctx: Ctx,
    me: Me,
    id: string,
    dto: { pin: string; lines?: ({ lineId: string } & AmountIn)[] },
  ) {
    const req = await this.request(ctx, id);
    if (req.status !== 'ISSUED') throw new ConflictException(`Request is ${req.status}`);
    const receiverId = await this.receiverFromPin(ctx, dto.pin);
    const given = new Map((dto.lines ?? []).map((l) => [l.lineId, l]));
    const now = new Date();
    const out = await this.prisma.$transaction(async (tx) => {
      let short = false;
      for (const line of req.lines) {
        const item = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: line.inventoryItemId },
        });
        const g = given.get(line.id);
        const issued = line.issued ?? 0;
        const received = g ? toBase(g.amount, g.unit, item.stockKind) : issued;
        if (received < 0 || received > issued) {
          throw new BadRequestException({
            code: 'RECEIVED',
            message: 'Receive between nothing and what was issued',
          });
        }
        const shortBy = issued - received;
        if (shortBy > 0) short = true;
        const unitCost = new Decimal(line.unitCost ?? item.costPerBase);
        await tx.storeRequestLine.update({
          where: { id: line.id },
          data: {
            received,
            shortBy,
            shortValue: shortBy > 0 ? unitCost.mul(shortBy).toDecimalPlaces(2) : null,
          },
        });
        if (received > 0) {
          await this.stock.move(tx, ctx, {
            storeId: req.toStoreId,
            inventoryItemId: line.inventoryItemId,
            amount: received,
            type: 'ISSUE_IN',
            refType: 'StoreRequest',
            refId: req.id,
            userId: receiverId,
            unitCost,
            dedupeKey: `ISSUE_IN:${line.id}`,
          });
        }
      }
      const claimed = await tx.storeRequest.updateMany({
        where: { id: req.id, status: 'ISSUED' },
        data: {
          status: short ? 'RECEIVED_SHORT' : 'RECEIVED',
          receivedById: receiverId,
          receivedAt: now,
        },
      });
      if (claimed.count !== 1) throw new ConflictException('Request already received');
      return tx.storeRequest.findUniqueOrThrow({ where: { id: req.id }, include: { lines: true } });
    });
    await this.audit.log({
      actorUserId: receiverId,
      action:
        out.status === 'RECEIVED_SHORT' ? 'STORE_REQUEST_RECEIVED_SHORT' : 'STORE_REQUEST_RECEIVED',
      entityType: 'StoreRequest',
      entityId: req.id,
      metadata: {
        branchId: ctx.branchId,
        sessionUserId: me.id,
        lines: out.lines.map((l) => ({
          id: l.id,
          issued: l.issued,
          received: l.received,
          shortBy: l.shortBy,
        })),
      },
    });
    return out;
  }

  /** Issued, and nothing came: the whole trip is the loss. */
  async notArrived(ctx: Ctx, me: Me, id: string, pin: string) {
    const req = await this.request(ctx, id);
    if (req.status !== 'ISSUED') throw new ConflictException(`Request is ${req.status}`);
    const receiverId = await this.receiverFromPin(ctx, pin);
    await this.prisma.$transaction(async (tx) => {
      for (const l of req.lines) {
        const shortBy = l.issued ?? 0;
        await tx.storeRequestLine.update({
          where: { id: l.id },
          data: {
            received: 0,
            shortBy,
            shortValue: new Decimal(l.unitCost ?? 0).mul(shortBy).toDecimalPlaces(2),
          },
        });
      }
      const c = await tx.storeRequest.updateMany({
        where: { id: req.id, status: 'ISSUED' },
        data: { status: 'NOT_ARRIVED', receivedById: receiverId, receivedAt: new Date() },
      });
      if (c.count !== 1) throw new ConflictException('Request already answered');
    });
    await this.audit.log({
      actorUserId: receiverId,
      action: 'STORE_REQUEST_NOT_ARRIVED',
      entityType: 'StoreRequest',
      entityId: req.id,
      metadata: { branchId: ctx.branchId, sessionUserId: me.id },
    });
    return this.request(ctx, id);
  }

  /** Requests, newest first. `losses=open` lists trips short and not yet closed by a count. */
  async listRequests(ctx: Ctx, q: { status?: string; storeId?: string; losses?: string }) {
    const where: Prisma.StoreRequestWhereInput = { branchId: ctx.branchId };
    if (q.status) where.status = q.status as any;
    if (q.storeId) where.OR = [{ toStoreId: q.storeId }, { fromStoreId: q.storeId }];
    if (q.losses === 'open') {
      where.status = { in: ['RECEIVED_SHORT', 'NOT_ARRIVED'] };
      where.resolvedAt = null;
    }
    const rows = await this.prisma.storeRequest.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      data: rows.map((r) => ({
        ...r,
        transitLoss: r.lines.reduce((s, l) => s.add(l.shortValue ?? 0), new Decimal(0)).toFixed(2),
      })),
      total: rows.length,
    };
  }

  // ── Deliveries, average cost, To buy, Cost changed (03 section 9) ──

  async createPurchaseOrder(
    ctx: Ctx,
    me: Me,
    dto: {
      supplierName: string;
      lines: ({ inventoryItemId: string; expectedUnitCost: string } & AmountIn)[];
    },
  ) {
    if (!dto.lines?.length) throw new BadRequestException('An order has at least one line');
    const lines = [];
    for (const l of dto.lines) {
      const item = await this.item(ctx, l.inventoryItemId);
      const amount = toBase(l.amount, l.unit, item.stockKind);
      if (amount <= 0) throw new BadRequestException('Order a positive amount');
      lines.push({
        inventoryItemId: item.id,
        amount,
        expectedCostPerBase: new Decimal(l.expectedUnitCost).div(1000).toDecimalPlaces(6),
      });
    }
    const po = await this.prisma.purchaseOrder.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        supplierName: dto.supplierName,
        createdById: me.id,
        lines: { create: lines },
      },
      include: { lines: true },
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'PURCHASE_ORDER_CREATED',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      metadata: { branchId: ctx.branchId, supplierName: dto.supplierName, lines: lines.length },
    });
    return po;
  }

  async receiveDelivery(
    ctx: Ctx,
    me: Me,
    dto: {
      purchaseOrderId?: string;
      supplierName?: string;
      storeId?: string;
      lines: ({ inventoryItemId: string; unitCost: string } & AmountIn)[];
    },
  ) {
    if (!dto.lines?.length) throw new BadRequestException('A delivery has at least one line');
    const store = dto.storeId
      ? await this.store(ctx, dto.storeId)
      : await this.stock.mainStore(this.prisma, ctx);
    const po = dto.purchaseOrderId
      ? await this.prisma.purchaseOrder.findFirst({
          where: { id: dto.purchaseOrderId, branchId: ctx.branchId },
          include: { lines: true },
        })
      : null;
    if (dto.purchaseOrderId && !po) throw new NotFoundException('Purchase order not found');
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId: ctx.organizationId },
      select: { costChangePct: true },
    });
    const changeLimit = new Decimal(settings?.costChangePct ?? 10);

    const delivery = await this.prisma.$transaction(async (tx) => {
      const d = await tx.delivery.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          storeId: store.id,
          purchaseOrderId: po?.id ?? null,
          supplierName: dto.supplierName ?? po?.supplierName ?? null,
          receivedById: me.id,
        },
      });
      for (const l of dto.lines) {
        const item = await tx.inventoryItem.findFirst({
          where: { id: l.inventoryItemId, branchId: ctx.branchId },
        });
        if (!item) throw new NotFoundException('Stock item not found in this branch');
        const amount = toBase(l.amount, l.unit, item.stockKind);
        if (amount <= 0) throw new BadRequestException('Receive a positive amount');
        const cost = new Decimal(l.unitCost).div(1000).toDecimalPlaces(6);
        const ordered = po?.lines.find((x) => x.inventoryItemId === item.id) ?? null;
        const onHandAll =
          (
            await tx.storeLevel.aggregate({
              where: { inventoryItemId: item.id },
              _sum: { onHand: true },
            })
          )._sum.onHand ?? 0;
        const avgBefore = new Decimal(item.costPerBase);
        const avgAfter = movingAverage(onHandAll, avgBefore, amount, cost);
        const expected = ordered
          ? new Decimal(ordered.expectedCostPerBase)
          : avgBefore.gt(0)
            ? avgBefore
            : null;
        const changePct =
          expected && expected.gt(0)
            ? cost.sub(expected).div(expected).mul(100).toDecimalPlaces(2)
            : null;
        const costChanged = !!changePct && changePct.abs().gt(changeLimit);
        const outcome = [
          !ordered
            ? 'NO_ORDER'
            : amount === ordered.amount
              ? 'FULL'
              : amount < ordered.amount
                ? 'SHORT'
                : 'OVER',
          ...(costChanged ? ['PRICE_DIFFERS'] : []),
        ].join(',');
        await tx.deliveryLine.create({
          data: {
            deliveryId: d.id,
            inventoryItemId: item.id,
            amount,
            orderedAmount: ordered?.amount ?? null,
            outcome,
            costPerBase: cost,
            expectedCostPerBase: expected,
            averageBefore: avgBefore,
            averageAfter: avgAfter,
            costChanged,
            changePct,
          },
        });
        await tx.inventoryItem.update({ where: { id: item.id }, data: { costPerBase: avgAfter } });
        await this.stock.move(tx, ctx, {
          storeId: store.id,
          inventoryItemId: item.id,
          amount,
          type: 'RECEIVE',
          refType: 'Delivery',
          refId: d.id,
          userId: me.id,
          unitCost: cost,
        });
      }
      if (po) await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'RECEIVED' } });
      return tx.delivery.findUniqueOrThrow({ where: { id: d.id }, include: { lines: true } });
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'DELIVERY_RECEIVED',
      entityType: 'Delivery',
      entityId: delivery.id,
      metadata: {
        branchId: ctx.branchId,
        purchaseOrderId: po?.id ?? null,
        lines: delivery.lines.map((l) => ({
          item: l.inventoryItemId,
          amount: l.amount,
          outcome: l.outcome,
        })),
      },
    });
    return delivery;
  }

  /** The top of the chain below minimum: what to buy, up to fill-to, less what is on order. */
  async toBuy(ctx: Ctx) {
    const main = await this.stock.mainStore(this.prisma, ctx);
    const levels = await this.prisma.storeLevel.findMany({
      where: { storeId: main.id, minimum: { not: null }, fillTo: { not: null } },
    });
    const open = await this.prisma.purchaseOrderLine.findMany({
      where: { purchaseOrder: { branchId: ctx.branchId, status: 'OPEN' } },
    });
    const onOrder = new Map<string, number>();
    for (const l of open)
      onOrder.set(l.inventoryItemId, (onOrder.get(l.inventoryItemId) ?? 0) + l.amount);
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: levels.map((l) => l.inventoryItemId) } },
      select: { id: true, name: true, packSize: true },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    return {
      storeId: main.id,
      lines: levels
        .filter((l) => l.onHand < (l.minimum as number))
        .map((l) => {
          const it = byId.get(l.inventoryItemId);
          const need = (l.fillTo as number) - l.onHand - (onOrder.get(l.inventoryItemId) ?? 0);
          return {
            inventoryItemId: l.inventoryItemId,
            name: it?.name,
            onHand: l.onHand,
            minimum: l.minimum,
            fillTo: l.fillTo,
            onOrder: onOrder.get(l.inventoryItemId) ?? 0,
            amount: roundUpToPack(need, it?.packSize),
          };
        })
        .filter((x) => x.amount > 0),
    };
  }

  async costChanges(ctx: Ctx) {
    const rows = await this.prisma.deliveryLine.findMany({
      where: { costChanged: true, delivery: { branchId: ctx.branchId } },
      include: { delivery: { select: { createdAt: true, supplierName: true } } },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return { data: rows, total: rows.length };
  }

  // ── Counts (03 section 10) ──

  async openCount(
    ctx: Ctx,
    me: Me,
    dto: { storeId: string; kind: StockCountKind; inventoryItemIds?: string[]; blind?: boolean },
  ) {
    await this.store(ctx, dto.storeId);
    const itemIds = dto.inventoryItemIds?.length
      ? dto.inventoryItemIds
      : (await this.prisma.storeLevel.findMany({ where: { storeId: dto.storeId } })).map(
          (l) => l.inventoryItemId,
        );
    if (itemIds.length === 0) throw new BadRequestException('Nothing to count in this store');
    for (const id of itemIds) await this.item(ctx, id);
    const c = await this.prisma.stockCount.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        storeId: dto.storeId,
        kind: dto.kind,
        blind: dto.blind ?? true,
        openedById: me.id,
        lines: { create: [...new Set(itemIds)].map((inventoryItemId) => ({ inventoryItemId })) },
      },
      include: { lines: true },
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'STOCK_COUNT_OPENED',
      entityType: 'StockCount',
      entityId: c.id,
      metadata: {
        branchId: ctx.branchId,
        storeId: dto.storeId,
        kind: dto.kind,
        lines: c.lines.length,
        blind: c.blind,
      },
    });
    return this.shapeCount(c, me);
  }

  /** A blind count shows the counter nothing of the books while it is open. */
  private shapeCount(c: any, me: Me) {
    const hide = c.blind && c.status === 'OPEN' && !me.permissions.includes(ANSWER_MANAGER_KEY);
    return {
      ...c,
      lines: c.lines.map((l: any) =>
        hide
          ? { id: l.id, inventoryItemId: l.inventoryItemId, counted: l.counted, savedAt: l.savedAt }
          : l,
      ),
    };
  }

  private async count(ctx: Ctx, id: string) {
    const c = await this.prisma.stockCount.findFirst({
      where: { id, branchId: ctx.branchId },
      include: { lines: true },
    });
    if (!c) throw new NotFoundException('Count not found');
    return c;
  }

  async getCount(ctx: Ctx, me: Me, id: string) {
    return this.shapeCount(await this.count(ctx, id), me);
  }

  /** Saved against the books at this second; selling goes on. */
  async saveLine(ctx: Ctx, me: Me, id: string, itemId: string, dto: AmountIn) {
    const c = await this.count(ctx, id);
    if (c.status !== 'OPEN') throw new ConflictException('The count is closed');
    const line = c.lines.find((l) => l.inventoryItemId === itemId);
    if (!line) throw new NotFoundException('That item is not on this count');
    const item = await this.item(ctx, itemId);
    const counted = toBase(dto.amount, dto.unit, item.stockKind);
    if (counted < 0) throw new BadRequestException('A count is not negative');
    const level = await this.prisma.storeLevel.findUnique({
      where: { storeId_inventoryItemId: { storeId: c.storeId, inventoryItemId: itemId } },
    });
    const book = level?.onHand ?? 0;
    const difference = counted - book;
    await this.prisma.stockCountLine.update({
      where: { id: line.id },
      data: {
        counted,
        bookAtSave: book,
        difference,
        value: new Decimal(item.costPerBase).mul(difference).toDecimalPlaces(2),
        savedAt: new Date(),
        savedById: me.id,
      },
    });
    return this.getCount(ctx, me, id);
  }

  async managerNote(ctx: Ctx, me: Me, id: string, note: string) {
    if (!me.permissions.includes(ANSWER_MANAGER_KEY)) {
      throw new ForbiddenException({
        code: 'NEEDS_MANAGER',
        message: 'The manager writes this note',
      });
    }
    const c = await this.count(ctx, id);
    if (c.status !== 'OPEN') throw new ConflictException('The count is closed');
    await this.prisma.stockCount.update({
      where: { id: c.id },
      data: { managerNote: note, managerNoteById: me.id },
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'STOCK_COUNT_MANAGER_NOTE',
      entityType: 'StockCount',
      entityId: c.id,
      metadata: { branchId: ctx.branchId, note },
    });
    return this.getCount(ctx, me, id);
  }

  /** The limit for one line: the larger of pct of the period's usage value and a fixed value. */
  private async lineLimit(
    storeId: string,
    itemId: string,
    costPerBase: Decimal,
    pct: Decimal,
    fixed: Decimal,
  ) {
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const usage = await this.prisma.stockMovement.aggregate({
      where: {
        storeId,
        inventoryItemId: itemId,
        type: { in: [...USAGE_TYPES] },
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    const used = Math.abs(usage._sum.amount ?? 0);
    const byUsage = new Decimal(costPerBase).mul(used).mul(pct).div(100);
    return Decimal.max(byUsage, fixed).toDecimalPlaces(2);
  }

  async closeCount(ctx: Ctx, me: Me, id: string) {
    const c = await this.count(ctx, id);
    if (c.status !== 'OPEN') throw new ConflictException('The count is closed');
    const unsaved = c.lines.filter((l) => l.savedAt === null);
    if (unsaved.length) {
      throw new ConflictException({
        code: 'NOT_COUNTED',
        message: 'Count every line first',
        lines: unsaved.map((l) => l.inventoryItemId),
      });
    }
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId: ctx.organizationId },
      select: { countVariancePct: true, countVarianceValue: true },
    });
    const pct = new Decimal(settings?.countVariancePct ?? 2);
    const fixed = new Decimal(settings?.countVarianceValue ?? 20000);
    const over: { inventoryItemId: string; value: string; limit: string }[] = [];
    for (const l of c.lines) {
      const item = await this.prisma.inventoryItem.findUniqueOrThrow({
        where: { id: l.inventoryItemId },
      });
      const limit = await this.lineLimit(
        c.storeId,
        l.inventoryItemId,
        item.costPerBase,
        pct,
        fixed,
      );
      if (new Decimal(l.value ?? 0).abs().gt(limit)) {
        over.push({
          inventoryItemId: l.inventoryItemId,
          value: new Decimal(l.value ?? 0).toFixed(2),
          limit: limit.toFixed(2),
        });
      }
    }
    if (over.length && !c.managerNote) {
      throw new ConflictException({
        code: 'NEEDS_MANAGER_NOTE',
        message:
          'A difference is above the limit; the manager writes a note before the count closes',
        lines: over,
      });
    }
    const now = new Date();
    const closed = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.stockCount.updateMany({
        where: { id: c.id, status: 'OPEN' },
        data: { status: 'CLOSED', closedById: me.id, closedAt: now },
      });
      if (claimed.count !== 1) throw new ConflictException('The count is closed');
      for (const l of c.lines) {
        if (!l.difference) continue;
        await this.stock.move(tx, ctx, {
          storeId: c.storeId,
          inventoryItemId: l.inventoryItemId,
          amount: l.difference,
          type: 'COUNT_ADJUST',
          refType: 'StockCount',
          refId: c.id,
          note: c.managerNote,
          userId: me.id,
          approvedById: c.managerNoteById,
          dedupeKey: `COUNT:${c.id}:${l.inventoryItemId}`,
        });
      }
      // A count of the receiving store closes the trips that arrived short for these items.
      const items = c.lines.map((l) => l.inventoryItemId);
      const trips = await tx.storeRequest.findMany({
        where: {
          branchId: ctx.branchId,
          toStoreId: c.storeId,
          status: { in: ['RECEIVED_SHORT', 'NOT_ARRIVED'] },
          resolvedAt: null,
          receivedAt: { lte: now },
          lines: { some: { inventoryItemId: { in: items }, shortBy: { gt: 0 } } },
        },
        select: { id: true },
      });
      if (trips.length) {
        await tx.storeRequest.updateMany({
          where: { id: { in: trips.map((t) => t.id) } },
          data: { resolvedAt: now, resolvedByCountId: c.id },
        });
      }
      return {
        count: await tx.stockCount.findUniqueOrThrow({
          where: { id: c.id },
          include: { lines: true },
        }),
        closedTrips: trips.map((t) => t.id),
      };
    });
    await this.audit.log({
      actorUserId: me.id,
      action: 'STOCK_COUNT_CLOSED',
      entityType: 'StockCount',
      entityId: c.id,
      metadata: {
        branchId: ctx.branchId,
        adjustments: c.lines.filter((l) => l.difference).length,
        overLimit: over.length,
        closedTrips: closed.closedTrips,
      },
    });
    return { ...this.shapeCount(closed.count, me), closedTrips: closed.closedTrips };
  }
}
