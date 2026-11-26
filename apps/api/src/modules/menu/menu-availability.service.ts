import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, PrepStation } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma';
import {
  availabilityView,
  logChange,
  MENU_AVAILABILITY_CHANGED,
  MenuAvailabilityChangedEvent,
  DEFAULT_LOW_AT,
} from './availability-engine';

interface BranchContext {
  branchId: string;
  organizationId: string;
}

export interface AvailabilityActor {
  id: string;
  roles?: Array<{ jobRole?: string | null } | null | undefined> | null;
}

const ALL_STATIONS_ROLES = new Set(['OWNER', 'MANAGER', 'SUPERVISOR']);
const RESET_ROLES = new Set(['OWNER', 'MANAGER']);
const CHEF_STATIONS: PrepStation[] = ['KITCHEN', 'COLD_KITCHEN', 'DESSERT'];
const BAR_STATIONS: PrepStation[] = ['BAR'];

function jobRoles(actor: AvailabilityActor): Set<string> {
  return new Set((actor.roles ?? []).map((r) => r?.jobRole ?? '').filter(Boolean));
}

/** Which stations' items this person may mark. `null` = every station. */
export function stationsFor(actor: AvailabilityActor): PrepStation[] | null {
  const roles = jobRoles(actor);
  if ([...roles].some((r) => ALL_STATIONS_ROLES.has(r))) return null;
  const out: PrepStation[] = [];
  if (roles.has('CHEF')) out.push(...CHEF_STATIONS);
  if (roles.has('BARTENDER')) out.push(...BAR_STATIONS);
  return out;
}

@Injectable()
export class MenuAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private async loadItem(ctx: BranchContext, menuItemId: string, actor: AvailabilityActor) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
      select: { id: true, name: true, station: true },
    });
    if (!item) throw new NotFoundException('Menu item not found in this branch');
    const allowed = stationsFor(actor);
    if (allowed !== null && !allowed.includes(item.station)) {
      throw new ForbiddenException({
        code: 'NOT_YOUR_STATION',
        message: `${item.name} belongs to the ${item.station.toLowerCase()} station, not yours.`,
      });
    }
    return item;
  }

  /** Ensures the row exists, then locks it. */
  private async lockRow(tx: Prisma.TransactionClient, ctx: BranchContext, menuItemId: string) {
    try {
      await tx.menuItemAvailability.upsert({
        where: { menuItemId },
        create: { orgId: ctx.organizationId, branchId: ctx.branchId, menuItemId },
        update: {},
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
    await tx.$queryRaw`SELECT "id" FROM "menu_item_availability" WHERE "menu_item_id" = ${menuItemId} FOR UPDATE`;
    return tx.menuItemAvailability.findUniqueOrThrow({ where: { menuItemId } });
  }

  private emit(ctx: BranchContext, menuItemIds: string[]) {
    if (menuItemIds.length === 0) return;
    this.events.emit(MENU_AVAILABILITY_CHANGED, {
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      menuItemIds,
    } satisfies MenuAvailabilityChangedEvent);
  }

  async markSoldOut(ctx: BranchContext, menuItemId: string, actor: AvailabilityActor) {
    const item = await this.loadItem(ctx, menuItemId, actor);
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await this.lockRow(tx, ctx, menuItemId);
      if (before.state === 'SOLD_OUT') return before;
      const now = new Date();
      const after = await tx.menuItemAvailability.update({
        where: { menuItemId },
        data: { state: 'SOLD_OUT', source: 'MANUAL', since: now, byUserId: actor.id },
      });
      await logChange(tx, ctx, menuItemId, {
        change: 'SOLD_OUT',
        fromState: before.state,
        toState: 'SOLD_OUT',
        source: 'MANUAL',
        leftBefore: before.left,
        leftAfter: after.left,
        byUserId: actor.id,
        createdAt: now,
      });
      return after;
    });
    this.emit(ctx, [menuItemId]);
    return { menuItemId, name: item.name, availability: availabilityView(row) };
  }

  async markAvailable(ctx: BranchContext, menuItemId: string, actor: AvailabilityActor) {
    const item = await this.loadItem(ctx, menuItemId, actor);
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await this.lockRow(tx, ctx, menuItemId);
      // Back on with no number: a number of zero would only sell out again at once.
      const left = before.left === 0 ? null : before.left;
      if (before.state === 'AVAILABLE' && left === before.left) return before;
      const now = new Date();
      const after = await tx.menuItemAvailability.update({
        where: { menuItemId },
        data: { state: 'AVAILABLE', source: 'MANUAL', left, since: now, byUserId: actor.id },
      });
      await logChange(tx, ctx, menuItemId, {
        change: 'AVAILABLE',
        fromState: before.state,
        toState: 'AVAILABLE',
        source: 'MANUAL',
        leftBefore: before.left,
        leftAfter: left,
        byUserId: actor.id,
        createdAt: now,
      });
      return after;
    });
    this.emit(ctx, [menuItemId]);
    return { menuItemId, name: item.name, availability: availabilityView(row) };
  }

  async setLeft(
    ctx: BranchContext,
    menuItemId: string,
    actor: AvailabilityActor,
    left: number,
    lowAt?: number,
  ) {
    if (!Number.isInteger(left) || left < 0) {
      throw new BadRequestException('left must be a whole number, 0 or more');
    }
    const item = await this.loadItem(ctx, menuItemId, actor);
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await this.lockRow(tx, ctx, menuItemId);
      const now = new Date();
      const state = left === 0 ? 'SOLD_OUT' : 'AVAILABLE';
      const after = await tx.menuItemAvailability.update({
        where: { menuItemId },
        data: {
          left,
          lowAt: lowAt ?? before.lowAt,
          state,
          source: 'COUNT',
          since: now,
          byUserId: actor.id,
        },
      });
      await logChange(tx, ctx, menuItemId, {
        change: 'SET_LEFT',
        fromState: before.state,
        toState: state,
        source: 'COUNT',
        leftBefore: before.left,
        leftAfter: left,
        byUserId: actor.id,
        createdAt: now,
      });
      return after;
    });
    this.emit(ctx, [menuItemId]);
    return { menuItemId, name: item.name, availability: availabilityView(row) };
  }

  /** Everything not plainly available: sold out, or carrying a number. */
  async listNotAvailable(ctx: BranchContext) {
    const rows = await this.prisma.menuItemAvailability.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        OR: [{ state: 'SOLD_OUT' }, { left: { not: null } }],
      },
      include: { menuItem: { select: { name: true, station: true } } },
      orderBy: { since: 'desc' },
    });
    return {
      items: rows.map((r) => ({
        menuItemId: r.menuItemId,
        name: r.menuItem.name,
        station: r.menuItem.station,
        availability: availabilityView(r),
      })),
    };
  }

  /**
   * Only what changed after `since`. `cursor` is read on the server before the query; the
   * terminal sends it back as the next `since` and never uses its own clock.
   */
  async changedSince(ctx: BranchContext, since?: string) {
    const cursor = new Date();
    let from: Date | null = null;
    if (since) {
      from = new Date(since);
      if (Number.isNaN(from.getTime())) throw new BadRequestException('since must be a date-time');
    }
    const logs = await this.prisma.menuAvailabilityLog.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        createdAt: { ...(from ? { gt: from } : {}), lte: cursor },
      },
      select: { menuItemId: true },
      distinct: ['menuItemId'],
    });
    const ids = logs.map((l) => l.menuItemId);
    const rows = ids.length
      ? await this.prisma.menuItemAvailability.findMany({ where: { menuItemId: { in: ids } } })
      : [];
    const byId = new Map(rows.map((r) => [r.menuItemId, r]));
    return {
      cursor: cursor.toISOString(),
      items: ids
        .sort()
        .map((id) => ({ menuItemId: id, availability: availabilityView(byId.get(id)) })),
    };
  }

  async reset(ctx: BranchContext, actor: AvailabilityActor) {
    const roles = jobRoles(actor);
    if (![...roles].some((r) => RESET_ROLES.has(r))) {
      throw new ForbiddenException({
        code: 'RESET_OWNER_OR_MANAGER',
        message: 'Only an owner or a manager can reset sold-out marks and numbers.',
      });
    }
    const batchId = randomUUID();
    const cleared = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ menu_item_id: string }[]>`
        SELECT "menu_item_id" FROM "menu_item_availability"
         WHERE "branch_id" = ${ctx.branchId} AND ("state" = 'SOLD_OUT' OR "left" IS NOT NULL)
         ORDER BY "menu_item_id" FOR UPDATE`;
      const now = new Date();
      const out: { menuItemId: string; wasState: string; wasLeft: number | null }[] = [];
      for (const { menu_item_id: menuItemId } of rows) {
        const before = await tx.menuItemAvailability.findUniqueOrThrow({ where: { menuItemId } });
        await tx.menuItemAvailability.update({
          where: { menuItemId },
          data: {
            state: 'AVAILABLE',
            source: 'MANUAL',
            left: null,
            lowAt: DEFAULT_LOW_AT,
            since: now,
            byUserId: actor.id,
          },
        });
        await logChange(tx, ctx, menuItemId, {
          change: 'RESET',
          fromState: before.state,
          toState: 'AVAILABLE',
          source: before.source,
          leftBefore: before.left,
          leftAfter: null,
          byUserId: actor.id,
          batchId,
          createdAt: now,
        });
        out.push({ menuItemId, wasState: before.state, wasLeft: before.left });
      }
      return out;
    });
    this.emit(
      ctx,
      cleared.map((c) => c.menuItemId),
    );
    return { batchId, cleared: await this.withNames(cleared) };
  }

  /** The opening list: what the last reset cleared, for the chef to confirm. */
  async yesterday(ctx: BranchContext) {
    const last = await this.prisma.menuAvailabilityLog.findFirst({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId, change: 'RESET' },
      orderBy: { createdAt: 'desc' },
      select: { batchId: true, createdAt: true },
    });
    if (!last?.batchId) return { resetAt: null, batchId: null, cleared: [] };
    const rows = await this.prisma.menuAvailabilityLog.findMany({
      where: { batchId: last.batchId },
      orderBy: { menuItemId: 'asc' },
    });
    return {
      resetAt: last.createdAt,
      batchId: last.batchId,
      cleared: await this.withNames(
        rows.map((r) => ({
          menuItemId: r.menuItemId,
          wasState: r.fromState,
          wasLeft: r.leftBefore,
        })),
      ),
    };
  }

  private async withNames<T extends { menuItemId: string }>(list: T[]) {
    if (list.length === 0) return [];
    const items = await this.prisma.menuItem.findMany({
      where: { id: { in: list.map((l) => l.menuItemId) } },
      select: { id: true, name: true, station: true },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    return list.map((l) => ({
      ...l,
      name: byId.get(l.menuItemId)?.name ?? null,
      station: byId.get(l.menuItemId)?.station ?? null,
    }));
  }
}
