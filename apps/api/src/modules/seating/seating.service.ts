import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderStatus, Prisma, TableStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { OrdersService } from '../orders/orders.service';
import { releaseTableIfIdleInTx } from '../orders/order-close';
import { allocateOrderNumber } from '../orders/order-number';

/**
 * T2 phase 2 (E3) — areas, tabs, and moving people around.
 *
 * Every write here runs in one transaction and takes its locks in the order the close door
 * uses: orders (sorted by id), then reservations, then tables (sorted by id). A table goes
 * back to AVAILABLE only through `releaseTableIfIdleInTx` (the close door's helper). Every
 * action writes an audit row in the same transaction.
 */
interface Ctx {
  branchId: string;
  organizationId: string;
}
export interface SeatingActor {
  id: string;
  roles?: Array<{ jobRole?: string | null } | null | undefined> | null;
}
interface Meta {
  ipAddress?: string;
  userAgent?: string;
}

const OPEN: Prisma.EnumOrderStatusFilter = { notIn: [OrderStatus.CLOSED, OrderStatus.VOIDED] };
const MAX_BULK = 200;
// A busy night: many people at once queue on the same locks, so a transaction may wait.
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };
const CHANGE_WAITER_ROLES = new Set(['OWNER', 'MANAGER', 'SUPERVISOR']);

type Tx = Prisma.TransactionClient;

@Injectable()
export class SeatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  // ── helpers ──

  private async audit(
    tx: Tx,
    actor: SeatingActor,
    ctx: Ctx,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
    meta: Meta,
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action,
        entityType,
        entityId,
        metadata: JSON.parse(
          JSON.stringify({ orgId: ctx.organizationId, branchId: ctx.branchId, ...metadata }),
        ),
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });
  }

  /** Locks the orders in id order, then checks none of them closed while we waited. */
  private async lockOrders(tx: Tx, ids: string[]) {
    const unique = [...new Set(ids)].sort();
    for (const id of unique) {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${id} FOR UPDATE`;
    }
    if (unique.length === 0) return;
    const stillOpen = await tx.order.count({ where: { id: { in: unique }, status: OPEN } });
    if (stillOpen !== unique.length) {
      throw new ConflictException({
        code: 'ORDER_CHANGED',
        message: 'A bill here was just closed or voided; try again.',
      });
    }
  }

  private async lockTables(tx: Tx, ids: string[]) {
    for (const id of [...new Set(ids)].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "tables" WHERE "id" = ${id} FOR UPDATE`;
    }
  }

  private async table(tx: Tx | PrismaService, ctx: Ctx, id: string) {
    const t = await tx.table.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!t) throw new NotFoundException('Table not found in this branch');
    return t;
  }

  private async openOrdersOn(tx: Tx, tableId: string) {
    return tx.order.findMany({
      where: { tableId, status: OPEN },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  private async assertNoMoney(tx: Tx, orderIds: string[], what: string) {
    if (orderIds.length === 0) return;
    const paid = await tx.payment.count({
      where: { orderId: { in: orderIds }, status: { in: ['COMPLETED', 'PENDING'] } },
    });
    const intents = await tx.paymentIntent.count({
      where: { orderId: { in: orderIds }, status: { in: ['PENDING', 'REQUIRES_ACTION'] } },
    });
    if (paid + intents > 0) {
      throw new ConflictException({
        code: 'ORDER_HAS_PAYMENT',
        message: `A payment is already on this bill, so it cannot be ${what}.`,
      });
    }
  }

  /** A table someone can be seated at: in use, not put away, not joined, nothing open on it. */
  private async assertFree(
    tx: Tx,
    t: { id: string; isActive: boolean; joinedToTableId: string | null; label: string },
  ) {
    if (!t.isActive) throw new ConflictException(`Table ${t.label} is put away`);
    if (t.joinedToTableId)
      throw new ConflictException(`Table ${t.label} is joined to another table`);
    const open = await tx.order.count({ where: { tableId: t.id, status: OPEN } });
    if (open > 0) {
      throw new ConflictException({
        code: 'TABLE_NOT_FREE',
        message: `Table ${t.label} is not free`,
      });
    }
  }

  private async occupy(tx: Tx, tableId: string) {
    await tx.table.updateMany({
      where: { id: tableId, status: { not: TableStatus.OCCUPIED } },
      data: { status: TableStatus.OCCUPIED },
    });
  }

  // ── Areas ──

  async listAreas(ctx: Ctx, includePutAway = false) {
    const areas = await this.prisma.area.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        ...(includePutAway ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        tables: {
          where: includePutAway ? {} : { isActive: true },
          orderBy: [{ tabNumber: 'asc' }, { label: 'asc' }],
          select: {
            id: true,
            label: true,
            capacity: true,
            status: true,
            isActive: true,
            isTab: true,
            tabNumber: true,
            tabNote: true,
            joinedToTableId: true,
            putAwayAt: true,
          },
        },
      },
    });
    return { areas };
  }

  async createArea(
    ctx: Ctx,
    actor: SeatingActor,
    dto: { name: string; kind?: 'TABLES' | 'TABS'; sortOrder?: number },
    meta: Meta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.area.findUnique({
        where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
      });
      if (exists) throw new ConflictException(`An area called "${dto.name}" already exists`);
      const area = await tx.area.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          name: dto.name,
          kind: dto.kind ?? 'TABLES',
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      await this.audit(
        tx,
        actor,
        ctx,
        'AREA_CREATED',
        'area',
        area.id,
        { name: area.name, kind: area.kind },
        meta,
      );
      return area;
    }, TX_OPTIONS);
  }

  async updateArea(
    ctx: Ctx,
    actor: SeatingActor,
    id: string,
    dto: { name?: string; sortOrder?: number },
    meta: Meta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const area = await tx.area.findFirst({ where: { id, branchId: ctx.branchId } });
      if (!area) throw new NotFoundException('Area not found in this branch');
      if (dto.name && dto.name !== area.name) {
        const clash = await tx.area.findUnique({
          where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
        });
        if (clash) throw new ConflictException(`An area called "${dto.name}" already exists`);
      }
      const updated = await tx.area.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
      await this.audit(
        tx,
        actor,
        ctx,
        'AREA_UPDATED',
        'area',
        id,
        { before: { name: area.name, sortOrder: area.sortOrder }, after: dto },
        meta,
      );
      return updated;
    }, TX_OPTIONS);
  }

  /** Put away, never delete: refused while any table in it has an open order. */
  async putAwayArea(ctx: Ctx, actor: SeatingActor, id: string, meta: Meta) {
    return this.prisma.$transaction(async (tx) => {
      const area = await tx.area.findFirst({ where: { id, branchId: ctx.branchId } });
      if (!area) throw new NotFoundException('Area not found in this branch');
      const tables = await tx.table.findMany({
        where: { areaId: id, isActive: true },
        select: { id: true, label: true },
      });
      await this.lockTables(
        tx,
        tables.map((t) => t.id),
      );
      const busy = await tx.order.findMany({
        where: { tableId: { in: tables.map((t) => t.id) }, status: OPEN },
        select: { table: { select: { label: true } } },
      });
      if (busy.length > 0) {
        throw new ConflictException({
          code: 'AREA_HAS_OPEN_ORDERS',
          message: `Open orders on ${[...new Set(busy.map((b) => b.table!.label))].join(', ')}`,
        });
      }
      const now = new Date();
      await tx.table.updateMany({
        where: { areaId: id, isActive: true },
        data: { isActive: false, putAwayAt: now },
      });
      const updated = await tx.area.update({
        where: { id },
        data: { isActive: false, putAwayAt: now },
      });
      await this.audit(
        tx,
        actor,
        ctx,
        'AREA_PUT_AWAY',
        'area',
        id,
        { name: area.name, tablesPutAway: tables.length },
        meta,
      );
      return updated;
    }, TX_OPTIONS);
  }

  // ── Tables ──

  /** Bulk add: how many, first number, seats each, into an area; one transaction. */
  async bulkAddTables(
    ctx: Ctx,
    actor: SeatingActor,
    areaId: string,
    dto: { count: number; firstNumber: number; seats: number },
    meta: Meta,
  ) {
    if (dto.count < 1 || dto.count > MAX_BULK) {
      throw new BadRequestException(`count must be from 1 to ${MAX_BULK}`);
    }
    return this.prisma.$transaction(async (tx) => {
      // One bulk add at a time per branch, so two people adding tables cannot interleave.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'tables:' + ctx.branchId}))`;
      const area = await tx.area.findFirst({
        where: { id: areaId, branchId: ctx.branchId, isActive: true },
      });
      if (!area) throw new NotFoundException('Area not found in this branch');
      if (area.kind !== 'TABLES')
        throw new BadRequestException(
          'Tables are added to a tables area; tabs are opened in a tabs area',
        );
      const labels = Array.from({ length: dto.count }, (_, i) => String(dto.firstNumber + i));
      const taken = await tx.table.findMany({
        where: { branchId: ctx.branchId, label: { in: labels } },
        select: { label: true },
      });
      if (taken.length > 0) {
        throw new ConflictException({
          code: 'TABLE_NUMBERS_TAKEN',
          message: `These numbers are already used: ${taken
            .map((t) => t.label)
            .sort((a, b) => Number(a) - Number(b))
            .join(', ')}`,
          numbers: taken.map((t) => t.label),
        });
      }
      await tx.table.createMany({
        data: labels.map((label) => ({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          areaId,
          label,
          capacity: dto.seats,
        })),
      });
      const created = await tx.table.findMany({
        where: { branchId: ctx.branchId, label: { in: labels } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, label: true, capacity: true, areaId: true, status: true },
      });
      created.sort((a, b) => Number(a.label) - Number(b.label));
      await this.audit(
        tx,
        actor,
        ctx,
        'TABLES_BULK_ADDED',
        'area',
        areaId,
        {
          count: dto.count,
          firstNumber: dto.firstNumber,
          seats: dto.seats,
          tableIds: created.map((t) => t.id),
        },
        meta,
      );
      return { area: { id: area.id, name: area.name }, tables: created };
    }, TX_OPTIONS);
  }

  async putAwayTable(ctx: Ctx, actor: SeatingActor, id: string, meta: Meta, tabOnly = false) {
    return this.prisma.$transaction(async (tx) => {
      const t = await this.table(tx, ctx, id);
      if (tabOnly && !t.isTab) throw new BadRequestException('This is a table, not a tab');
      await this.lockTables(tx, [id]);
      const open = await tx.order.count({ where: { tableId: id, status: OPEN } });
      if (open > 0) {
        throw new ConflictException({
          code: 'TABLE_HAS_OPEN_ORDER',
          message: `Table ${t.label} has an open order`,
        });
      }
      if (!t.isActive) return t;
      const updated = await tx.table.update({
        where: { id },
        data: {
          isActive: false,
          putAwayAt: new Date(),
          joinedToTableId: null,
          ...(t.isTab ? { label: `${t.label} · ${id.slice(-8)}` } : {}),
        },
      });
      await this.audit(
        tx,
        actor,
        ctx,
        t.isTab ? 'TAB_PUT_AWAY' : 'TABLE_PUT_AWAY',
        'table',
        id,
        { label: t.label },
        meta,
      );
      return updated;
    }, TX_OPTIONS);
  }

  async changeSeats(ctx: Ctx, actor: SeatingActor, id: string, seats: number, meta: Meta) {
    return this.prisma.$transaction(async (tx) => {
      const t = await this.table(tx, ctx, id);
      const updated = await tx.table.update({ where: { id }, data: { capacity: seats } });
      await this.audit(
        tx,
        actor,
        ctx,
        'TABLE_SEATS_CHANGED',
        'table',
        id,
        { label: t.label, from: t.capacity, to: seats },
        meta,
      );
      return updated;
    }, TX_OPTIONS);
  }

  // ── Tabs ──

  /** A tab for standing guests: the next free number in the branch, an optional note. */
  async openTab(ctx: Ctx, actor: SeatingActor, areaId: string, dto: { note?: string }, meta: Meta) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'tabs:' + ctx.branchId}))`;
      const area = await tx.area.findFirst({
        where: { id: areaId, branchId: ctx.branchId, isActive: true },
      });
      if (!area) throw new NotFoundException('Area not found in this branch');
      if (area.kind !== 'TABS') throw new BadRequestException('Tabs are opened in a tabs area');
      const used = await tx.table.findMany({
        where: { branchId: ctx.branchId, isTab: true, isActive: true },
        select: { tabNumber: true },
      });
      const taken = new Set(used.map((u) => u.tabNumber));
      let n = 1;
      while (taken.has(n)) n++;
      const tab = await tx.table.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          areaId,
          label: `Tab ${n}`,
          capacity: 1,
          isTab: true,
          tabNumber: n,
          tabNote: dto.note?.trim() || null,
        },
      });
      await this.audit(
        tx,
        actor,
        ctx,
        'TAB_OPENED',
        'table',
        tab.id,
        { tabNumber: n, areaId, note: tab.tabNote },
        meta,
      );
      return tab;
    }, TX_OPTIONS);
  }

  // ── Moving people around ──

  /** Every open order on a table moves to a free table; the booking moves with them. */
  async moveTable(ctx: Ctx, actor: SeatingActor, fromId: string, toId: string, meta: Meta) {
    if (fromId === toId) throw new BadRequestException('Pick a different table');
    return this.prisma.$transaction(async (tx) => {
      const from = await this.table(tx, ctx, fromId);
      const to = await this.table(tx, ctx, toId);
      const orders = await this.openOrdersOn(tx, fromId);
      if (orders.length === 0)
        throw new ConflictException(`Table ${from.label} has no open order to move`);
      await this.lockOrders(
        tx,
        orders.map((o) => o.id),
      );
      const joinedHere = await tx.table.count({ where: { joinedToTableId: fromId } });
      if (joinedHere > 0)
        throw new ConflictException('Split the joined tables before moving this one');
      // Lock order everywhere: orders, then reservations, then tables.
      const moved = await tx.reservation.updateMany({
        where: { seatedOrderId: { in: orders.map((o) => o.id) }, status: 'SEATED' },
        data: { tableId: toId },
      });
      await this.lockTables(tx, [fromId, toId]);
      await this.assertFree(tx, to);

      await tx.order.updateMany({
        where: { id: { in: orders.map((o) => o.id) } },
        data: { tableId: toId },
      });
      await this.occupy(tx, toId);
      const freed = await releaseTableIfIdleInTx(tx, fromId, null);
      await this.audit(
        tx,
        actor,
        ctx,
        'TABLE_MOVED',
        'table',
        fromId,
        {
          from: { id: fromId, label: from.label },
          to: { id: toId, label: to.label },
          orderIds: orders.map((o) => o.id),
          reservationsMoved: moved.count,
          fromFreed: freed,
        },
        meta,
      );
      return {
        from: { id: fromId, label: from.label, freed },
        to: { id: toId, label: to.label },
        orderIds: orders.map((o) => o.id),
      };
    }, TX_OPTIONS);
  }

  /** Join: the other table's party comes onto this table's bill. It can be split again. */
  async joinTables(ctx: Ctx, actor: SeatingActor, hostId: string, otherId: string, meta: Meta) {
    if (hostId === otherId) throw new BadRequestException('Pick a different table');
    return this.prisma.$transaction(async (tx) => {
      const host = await this.table(tx, ctx, hostId);
      const other = await this.table(tx, ctx, otherId);
      const hostOrders = await this.openOrdersOn(tx, hostId);
      if (hostOrders.length !== 1) {
        throw new ConflictException(`Table ${host.label} needs exactly one open bill to join onto`);
      }
      const otherOrders = await this.openOrdersOn(tx, otherId);
      if (otherOrders.length > 1)
        throw new ConflictException(`Table ${other.label} has more than one bill`);
      const target = hostOrders[0];
      const source = otherOrders[0] ?? null;
      await this.lockOrders(tx, [target.id, ...(source ? [source.id] : [])]);
      await this.lockTables(tx, [hostId, otherId]);
      if (!other.isActive) throw new ConflictException(`Table ${other.label} is put away`);
      if (other.joinedToTableId || host.joinedToTableId)
        throw new ConflictException('One of these tables is already joined');
      await this.assertNoMoney(tx, [target.id, ...(source ? [source.id] : [])], 'joined');

      let itemIds: string[] = [];
      if (source) {
        const lines = await tx.orderItem.findMany({
          where: { orderId: source.id },
          select: { id: true },
        });
        itemIds = lines.map((l) => l.id);
        await tx.orderItem.updateMany({
          where: { orderId: source.id },
          data: { orderId: target.id },
        });
        // The booking seated on the absorbed bill now rides on the joined bill, so the close
        // door completes it when that bill is paid (never left SEATED on a voided order).
        await tx.reservation.updateMany({
          where: { seatedOrderId: source.id, status: 'SEATED' },
          data: { seatedOrderId: target.id },
        });
        await tx.order.update({
          where: { id: source.id },
          data: { status: OrderStatus.VOIDED, mergedIntoOrderId: target.id },
        });
        await this.orders.recalcOrderTotals(source.id, tx);
      }
      const meta0 = (target.metadata ?? {}) as Record<string, unknown>;
      const joins = Array.isArray(meta0.joins) ? (meta0.joins as unknown[]) : [];
      await tx.order.update({
        where: { id: target.id },
        data: {
          // T2 phase 3: allergies said at either table stay on every later ticket
          allergies: {
            set: [...new Set([...target.allergies, ...(source?.allergies ?? [])])].sort(),
          },
          metadata: {
            ...meta0,
            joins: [
              ...joins,
              {
                tableId: otherId,
                fromOrderId: source?.id ?? null,
                itemIds,
                at: new Date().toISOString(),
              },
            ],
          } as Prisma.InputJsonValue,
        },
      });
      await this.orders.recalcOrderTotals(target.id, tx);
      await tx.table.update({
        where: { id: otherId },
        data: { joinedToTableId: hostId, status: TableStatus.OCCUPIED },
      });
      await this.audit(
        tx,
        actor,
        ctx,
        'TABLES_JOINED',
        'table',
        hostId,
        {
          host: host.label,
          other: other.label,
          orderId: target.id,
          absorbedOrderId: source?.id ?? null,
          linesMoved: itemIds.length,
        },
        meta,
      );
      const order = await tx.order.findUniqueOrThrow({ where: { id: target.id } });
      return {
        orderId: target.id,
        total: order.total,
        host: host.label,
        joined: other.label,
        linesMoved: itemIds.length,
      };
    }, TX_OPTIONS);
  }

  /** Split joined tables again: the other table's lines go back to a bill on that table. */
  async splitJoin(ctx: Ctx, actor: SeatingActor, hostId: string, otherId: string, meta: Meta) {
    return this.prisma.$transaction(async (tx) => {
      const host = await this.table(tx, ctx, hostId);
      const other = await this.table(tx, ctx, otherId);
      if (other.joinedToTableId !== hostId)
        throw new ConflictException(`Table ${other.label} is not joined to ${host.label}`);
      const hostOrders = await this.openOrdersOn(tx, hostId);
      if (hostOrders.length !== 1)
        throw new ConflictException(`Table ${host.label} has no single open bill`);
      const target = hostOrders[0];
      await this.lockOrders(tx, [target.id]);
      await this.lockTables(tx, [hostId, otherId]);
      await this.assertNoMoney(tx, [target.id], 'split');

      const meta0 = (target.metadata ?? {}) as Record<string, unknown>;
      const joins = (Array.isArray(meta0.joins) ? meta0.joins : []) as {
        tableId: string;
        itemIds: string[];
      }[];
      const join = joins.find((j) => j.tableId === otherId);
      const back = join
        ? await tx.orderItem.findMany({ where: { id: { in: join.itemIds }, orderId: target.id } })
        : [];
      let newOrderId: string | null = null;
      if (back.length > 0) {
        const anySent = back.some((l) => l.sentAt && !l.voidedAt);
        const created = await tx.order.create({
          data: {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            tableId: otherId,
            userId: target.userId,
            orderNumber: await allocateOrderNumber(tx, ctx.branchId),
            status: anySent
              ? target.status === OrderStatus.NEW
                ? OrderStatus.SENT
                : target.status
              : OrderStatus.NEW,
            serviceType: 'DINE_IN',
            splitFromOrderId: target.id,
            allergies: target.allergies,
          },
        });
        newOrderId = created.id;
        await tx.orderItem.updateMany({
          where: { id: { in: back.map((l) => l.id) } },
          data: { orderId: created.id },
        });
        await this.orders.recalcOrderTotals(created.id, tx);
      }
      await tx.order.update({
        where: { id: target.id },
        data: {
          metadata: {
            ...meta0,
            joins: joins.filter((j) => j.tableId !== otherId),
          } as Prisma.InputJsonValue,
        },
      });
      await this.orders.recalcOrderTotals(target.id, tx);
      await tx.table.update({ where: { id: otherId }, data: { joinedToTableId: null } });
      const freed = newOrderId ? false : await releaseTableIfIdleInTx(tx, otherId, null);
      await this.audit(
        tx,
        actor,
        ctx,
        'TABLES_SPLIT',
        'table',
        hostId,
        {
          host: host.label,
          other: other.label,
          orderId: target.id,
          newOrderId,
          linesMovedBack: back.length,
          otherFreed: freed,
        },
        meta,
      );
      return {
        hostOrderId: target.id,
        otherOrderId: newOrderId,
        linesMovedBack: back.length,
        otherFreed: freed,
      };
    }, TX_OPTIONS);
  }

  /** Move one line (or part of it) to another table's bill, making one if that table is free. */
  async moveLine(
    ctx: Ctx,
    actor: SeatingActor,
    orderId: string,
    itemId: string,
    dto: { toTableId: string; quantity?: number },
    meta: Meta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.order.findFirst({
        where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!source) throw new NotFoundException('Order not found');
      const to = await this.table(tx, ctx, dto.toTableId);
      if (source.tableId === to.id)
        throw new BadRequestException('The line is already on that table');
      const targetOrders = await this.openOrdersOn(tx, to.id);
      await this.lockOrders(tx, [orderId, ...targetOrders.map((o) => o.id)]);
      await this.lockTables(tx, [to.id, ...(source.tableId ? [source.tableId] : [])]);

      const locked = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (locked.status === OrderStatus.CLOSED || locked.status === OrderStatus.VOIDED) {
        throw new ConflictException(`Cannot move a line off a ${locked.status} order`);
      }
      const line = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
      if (!line) throw new NotFoundException('Line not found on this order');
      if (line.voidedAt) throw new ConflictException('A voided line stays where it is');
      const qty = dto.quantity ?? line.quantity;
      if (qty < 1 || qty > line.quantity)
        throw new BadRequestException(`Quantity must be from 1 to ${line.quantity}`);
      if (!to.isActive) throw new ConflictException(`Table ${to.label} is put away`);
      if (to.joinedToTableId)
        throw new ConflictException(`Table ${to.label} is joined to another table`);

      let target = targetOrders[0] ?? null;
      await this.assertNoMoney(tx, [orderId, ...(target ? [target.id] : [])], 'changed');
      if (!target) {
        target = await tx.order.create({
          data: {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            tableId: to.id,
            userId: locked.userId,
            orderNumber: await allocateOrderNumber(tx, ctx.branchId),
            status: line.sentAt ? OrderStatus.SENT : OrderStatus.NEW,
            serviceType: 'DINE_IN',
            splitFromOrderId: orderId,
            allergies: locked.allergies,
          },
        });
        if (line.sentAt) await this.occupy(tx, to.id);
      }

      let movedLineId = itemId;
      if (qty === line.quantity) {
        await tx.orderItem.update({ where: { id: itemId }, data: { orderId: target.id } });
      } else {
        const unit = new Decimal(line.price);
        await tx.orderItem.update({
          where: { id: itemId },
          data: {
            quantity: line.quantity - qty,
            subtotal: unit.mul(line.quantity - qty).toDecimalPlaces(2),
            costTotal: line.costUnit
              ? new Decimal(line.costUnit).mul(line.quantity - qty).toDecimalPlaces(2)
              : null,
          },
        });
        const copy = await tx.orderItem.create({
          data: {
            orderId: target.id,
            menuItemId: line.menuItemId,
            menuItemServingId: line.menuItemServingId,
            quantity: qty,
            price: line.price,
            subtotal: unit.mul(qty).toDecimalPlaces(2),
            normalPrice: line.normalPrice,
            offerBasePrice: line.offerBasePrice,
            guest: line.guest,
            allergy: line.allergy,
            takeaway: line.takeaway,
            heldAt: line.heldAt,
            notes: line.notes,
            metadata: line.metadata ? (line.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
            costUnit: line.costUnit,
            costTotal: line.costUnit
              ? new Decimal(line.costUnit).mul(qty).toDecimalPlaces(2)
              : null,
            sentAt: line.sentAt,
          },
        });
        movedLineId = copy.id;
      }
      await this.orders.recalcOrderTotals(orderId, tx);
      await this.orders.recalcOrderTotals(target.id, tx);

      // A bill left with no lines at all is voided, so its table does not stay taken by nothing.
      let sourceVoided = false;
      const left = await tx.orderItem.count({ where: { orderId } });
      if (left === 0) {
        await tx.reservation.updateMany({
          where: { seatedOrderId: orderId, status: 'SEATED' },
          data: { seatedOrderId: target.id },
        });
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.VOIDED } });
        sourceVoided = true;
        if (locked.tableId) await releaseTableIfIdleInTx(tx, locked.tableId, orderId);
      }
      await this.audit(
        tx,
        actor,
        ctx,
        'ORDER_LINE_MOVED',
        'orderItem',
        movedLineId,
        {
          fromOrderId: orderId,
          toOrderId: target.id,
          toTableId: to.id,
          quantity: qty,
          sourceLineId: itemId,
          sourceVoided,
        },
        meta,
      );
      return {
        fromOrderId: orderId,
        toOrderId: target.id,
        toTable: to.label,
        lineId: movedLineId,
        quantity: qty,
        sourceVoided,
      };
    }, TX_OPTIONS);
  }

  /** Split a bill by guest: each guest after the first gets their own bill on the same table. */
  async splitByGuest(ctx: Ctx, actor: SeatingActor, orderId: string, meta: Meta) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrders(tx, [orderId]);
      const order = await tx.order.findFirst({
        where: { id: orderId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.VOIDED) {
        throw new ConflictException(`Cannot split a ${order.status} order`);
      }
      await this.assertNoMoney(tx, [orderId], 'split');
      const lines = await tx.orderItem.findMany({ where: { orderId, voidedAt: null } });
      const guests = [
        ...new Set(lines.map((l) => l.guest).filter((g): g is number => g !== null)),
      ].sort((a, b) => a - b);
      if (guests.length < 2) {
        throw new BadRequestException(
          'Mark the lines with at least two guests before splitting by guest',
        );
      }
      const children: { guest: number; orderId: string; total: Decimal }[] = [];
      for (const g of guests.slice(1)) {
        const mine = lines.filter((l) => l.guest === g);
        const allSent = mine.every((l) => l.sentAt);
        const child = await tx.order.create({
          data: {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            tableId: order.tableId,
            userId: order.userId,
            orderNumber: await allocateOrderNumber(tx, ctx.branchId),
            status:
              allSent && order.status !== OrderStatus.NEW
                ? order.status
                : allSent
                  ? OrderStatus.SENT
                  : OrderStatus.NEW,
            serviceType: order.serviceType,
            splitFromOrderId: orderId,
            allergies: order.allergies,
          },
        });
        await tx.orderItem.updateMany({
          where: { id: { in: mine.map((l) => l.id) } },
          data: { orderId: child.id },
        });
        await this.orders.recalcOrderTotals(child.id, tx);
        const c = await tx.order.findUniqueOrThrow({ where: { id: child.id } });
        children.push({ guest: g, orderId: child.id, total: c.total });
      }
      await this.orders.recalcOrderTotals(orderId, tx);
      const kept = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      await this.audit(
        tx,
        actor,
        ctx,
        'ORDER_SPLIT_BY_GUEST',
        'order',
        orderId,
        {
          guests,
          children: children.map((c) => ({
            guest: c.guest,
            orderId: c.orderId,
            total: c.total.toString(),
          })),
        },
        meta,
      );
      return { orderId, guest: guests[0], total: kept.total, children };
    }, TX_OPTIONS);
  }

  // ── People ──

  /** Change waiter: every open order on the table goes to another person (supervisor, manager). */
  async changeWaiter(ctx: Ctx, actor: SeatingActor, tableId: string, toUserId: string, meta: Meta) {
    const roles = (actor.roles ?? []).map((r) => r?.jobRole ?? '');
    if (!roles.some((r) => CHANGE_WAITER_ROLES.has(r))) {
      throw new ForbiddenException({
        code: 'SUPERVISOR_OR_MANAGER',
        message: 'Only a supervisor or a manager can change the waiter of a table.',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const t = await this.table(tx, ctx, tableId);
      await this.assertMember(tx, ctx, toUserId);
      const orders = await this.openOrdersOn(tx, tableId);
      if (orders.length === 0) throw new ConflictException(`Table ${t.label} has no open order`);
      await this.lockOrders(
        tx,
        orders.map((o) => o.id),
      );
      await tx.order.updateMany({
        where: { id: { in: orders.map((o) => o.id) }, status: OPEN },
        data: { userId: toUserId },
      });
      await this.audit(
        tx,
        actor,
        ctx,
        'TABLE_WAITER_CHANGED',
        'table',
        tableId,
        {
          label: t.label,
          orders: orders.map((o) => ({ id: o.id, fromUserId: o.userId })),
          toUserId,
        },
        meta,
      );
      return { tableId, label: t.label, toUserId, orderIds: orders.map((o) => o.id) };
    }, TX_OPTIONS);
  }

  private async assertMember(tx: Tx, ctx: Ctx, userId: string) {
    const m = await tx.membership.findFirst({
      where: { userId, branchId: ctx.branchId, status: 'ACTIVE' },
    });
    if (!m) throw new BadRequestException('That person does not work in this branch');
  }

  /** Hand over: a waiter offers one table, several, or all of theirs to a named colleague. */
  async offerHandover(
    ctx: Ctx,
    actor: SeatingActor,
    dto: { toUserId: string; tableIds?: string[]; all?: boolean; note?: string },
    meta: Meta,
  ) {
    if (dto.toUserId === actor.id) throw new BadRequestException('Hand over to someone else');
    if (!dto.all && !(dto.tableIds && dto.tableIds.length > 0)) {
      throw new BadRequestException('Name the tables, or hand over all of them');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.assertMember(tx, ctx, dto.toUserId);
      const mine = await tx.order.findMany({
        where: { branchId: ctx.branchId, userId: actor.id, status: OPEN, tableId: { not: null } },
        select: { tableId: true },
      });
      const myTables = new Set(mine.map((o) => o.tableId as string));
      const tableIds = dto.all ? [...myTables].sort() : [...new Set(dto.tableIds)].sort();
      if (tableIds.length === 0)
        throw new ConflictException('You have no open tables to hand over');
      const notMine = tableIds.filter((id) => !myTables.has(id));
      if (notMine.length > 0) {
        throw new ConflictException({
          code: 'NOT_YOUR_TABLE',
          message: 'Some of these tables have no open order of yours',
          tableIds: notMine,
        });
      }
      const pending = await tx.tableHandover.findMany({
        where: {
          branchId: ctx.branchId,
          fromUserId: actor.id,
          status: 'PENDING',
          tableIds: { hasSome: tableIds },
        },
        select: { id: true },
      });
      if (pending.length > 0)
        throw new ConflictException(
          'One of these tables is already offered; cancel that offer first',
        );
      const h = await tx.tableHandover.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          fromUserId: actor.id,
          toUserId: dto.toUserId,
          tableIds,
          note: dto.note?.trim() || null,
        },
      });
      await this.audit(
        tx,
        actor,
        ctx,
        'TABLE_HANDOVER_OFFERED',
        'table_handover',
        h.id,
        { toUserId: dto.toUserId, tableIds },
        meta,
      );
      return h;
    }, TX_OPTIONS);
  }

  async listHandovers(ctx: Ctx, actor: SeatingActor) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.tableHandover.findMany({
        where: { branchId: ctx.branchId, toUserId: actor.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.tableHandover.findMany({
        where: { branchId: ctx.branchId, fromUserId: actor.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const tableIds = [...new Set([...incoming, ...outgoing].flatMap((h) => h.tableIds))];
    const tables = await this.prisma.table.findMany({
      where: { id: { in: tableIds } },
      select: { id: true, label: true },
    });
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: [...new Set([...incoming, ...outgoing].flatMap((h) => [h.fromUserId, h.toUserId]))],
        },
      },
      select: { id: true, firstName: true, lastName: true },
    });
    const label = new Map(tables.map((t) => [t.id, t.label]));
    const name = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName?.[0] ?? ''}.`.trim()]),
    );
    const shape = (h: (typeof incoming)[number]) => ({
      ...h,
      from: name.get(h.fromUserId) ?? null,
      to: name.get(h.toUserId) ?? null,
      tables: h.tableIds.map((id) => ({ id, label: label.get(id) ?? null })),
    });
    return { incoming: incoming.map(shape), outgoing: outgoing.map(shape) };
  }

  async answerHandover(
    ctx: Ctx,
    actor: SeatingActor,
    id: string,
    answer: 'accept' | 'decline' | 'cancel',
    meta: Meta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const h = await tx.tableHandover.findFirst({ where: { id, branchId: ctx.branchId } });
      if (!h) throw new NotFoundException('Hand-over not found');
      if (answer === 'cancel' ? h.fromUserId !== actor.id : h.toUserId !== actor.id) {
        throw new ForbiddenException(
          answer === 'cancel'
            ? 'Only the person who offered it can cancel it'
            : 'This hand-over was offered to someone else',
        );
      }
      const status =
        answer === 'accept' ? 'ACCEPTED' : answer === 'decline' ? 'DECLINED' : 'CANCELLED';
      const claimed = await tx.tableHandover.updateMany({
        where: { id, status: 'PENDING' },
        data: { status, answeredAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new ConflictException(`This hand-over was already ${h.status.toLowerCase()}`);
      let moved: string[] = [];
      if (answer === 'accept') {
        const orders = await tx.order.findMany({
          where: { tableId: { in: h.tableIds }, userId: h.fromUserId, status: OPEN },
          select: { id: true },
        });
        await this.lockOrders(
          tx,
          orders.map((o) => o.id),
        );
        const res = await tx.order.updateMany({
          where: { id: { in: orders.map((o) => o.id) }, userId: h.fromUserId, status: OPEN },
          data: { userId: h.toUserId },
        });
        moved = orders.map((o) => o.id);
        if (res.count !== moved.length) moved = moved.slice(0, res.count);
      }
      await this.audit(
        tx,
        actor,
        ctx,
        `TABLE_HANDOVER_${status}`,
        'table_handover',
        id,
        {
          fromUserId: h.fromUserId,
          toUserId: h.toUserId,
          tableIds: h.tableIds,
          orderIds: moved,
        },
        meta,
      );
      return { id, status, orderIds: moved };
    }, TX_OPTIONS);
  }
}
