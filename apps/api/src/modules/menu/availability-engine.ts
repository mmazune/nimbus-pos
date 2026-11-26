// T2 phase 1 (E2) — sold out, back on, a number left.
// Pure transaction helpers shared by the menu availability endpoints and by E1's send path.
// Rules (docs/direction/03-stock-stores-availability.md §6, sources 1 and 2 of R19):
//   * one row per menu item; no row = available, no number;
//   * a number is taken with a guarded UPDATE, so two sends in the same instant cannot both
//     take the last one; reaching zero marks the item sold out (source COUNT);
//   * crossing `lowAt` writes a LOW log row; every change writes an append-only log row.
import {
  Prisma,
  MenuAvailabilityChange,
  MenuAvailabilityState,
  MenuAvailabilitySource,
} from '@prisma/client';

export const MENU_AVAILABILITY_CHANGED = 'menu.availability.changed';

export interface MenuAvailabilityChangedEvent {
  orgId: string;
  branchId: string;
  menuItemIds: string[];
}

export type AvailabilityView = {
  state: 'AVAILABLE' | 'LOW' | 'SOLD_OUT';
  left: number | null;
  lowAt: number;
  source: MenuAvailabilitySource | null;
  since: Date | null;
  byUserId: string | null;
};

export const DEFAULT_LOW_AT = 5;

type Row = {
  state: MenuAvailabilityState;
  source: MenuAvailabilitySource;
  left: number | null;
  lowAt: number;
  since: Date;
  byUserId: string | null;
};

/** The answer a terminal shows for one item. */
export function availabilityView(row: Row | null | undefined): AvailabilityView {
  if (!row) {
    return {
      state: 'AVAILABLE',
      left: null,
      lowAt: DEFAULT_LOW_AT,
      source: null,
      since: null,
      byUserId: null,
    };
  }
  let state: AvailabilityView['state'] = 'AVAILABLE';
  if (row.state === 'SOLD_OUT') state = 'SOLD_OUT';
  else if (row.left !== null && row.left <= row.lowAt) state = 'LOW';
  return {
    state,
    left: row.left,
    lowAt: row.lowAt,
    source: row.source,
    since: row.since,
    byUserId: row.byUserId,
  };
}

export interface SendLine {
  id: string;
  menuItemId: string;
  quantity: number;
  name: string;
}

export interface SkippedLine {
  orderItemId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  reason: 'SOLD_OUT' | 'NOT_ENOUGH_LEFT';
  left: number | null;
  message: string;
}

export interface TakeResult {
  sendIds: string[];
  skipped: SkippedLine[];
  changedItemIds: string[];
}

/**
 * Inside the send transaction: decide which unsent lines may go, taking counted portions.
 * Items are processed in menuItemId order so two orders holding the same two items never
 * lock their availability rows in opposite orders (no deadlock).
 */
export async function takeAvailabilityForSend(
  tx: Prisma.TransactionClient,
  ctx: { organizationId: string; branchId: string },
  orderId: string,
  userId: string,
  lines: SendLine[],
): Promise<TakeResult> {
  const byItem = new Map<string, SendLine[]>();
  for (const l of lines) {
    const list = byItem.get(l.menuItemId) ?? [];
    list.push(l);
    byItem.set(l.menuItemId, list);
  }
  const itemIds = [...byItem.keys()].sort();
  const sendIds: string[] = [];
  const skipped: SkippedLine[] = [];
  const changed = new Set<string>();

  for (const menuItemId of itemIds) {
    const itemLines = byItem.get(menuItemId)!;
    const exists = await tx.menuItemAvailability.findUnique({
      where: { menuItemId },
      select: { id: true },
    });
    if (!exists) {
      sendIds.push(...itemLines.map((l) => l.id));
      continue;
    }

    for (const line of itemLines) {
      // Guarded take: only an available item with enough left loses portions.
      const taken = await tx.$queryRaw<{ left: number | null; low_at: number }[]>`
        UPDATE "menu_item_availability"
           SET "left" = CASE WHEN "left" IS NULL THEN NULL ELSE "left" - ${line.quantity} END,
               "updated_at" = NOW()
         WHERE "menu_item_id" = ${menuItemId}
           AND "state" = 'AVAILABLE'
           AND ("left" IS NULL OR "left" >= ${line.quantity})
        RETURNING "left", "low_at"`;

      if (taken.length === 1) {
        sendIds.push(line.id);
        const after = taken[0].left;
        if (after === null) continue; // marked available, no number: nothing counted
        const before = after + line.quantity;
        const now = new Date();
        changed.add(menuItemId);
        await logChange(tx, ctx, menuItemId, {
          change: 'TAKEN',
          fromState: 'AVAILABLE',
          toState: after === 0 ? 'SOLD_OUT' : 'AVAILABLE',
          source: 'COUNT',
          leftBefore: before,
          leftAfter: after,
          byUserId: userId,
          orderId,
          orderItemId: line.id,
          createdAt: now,
        });
        if (after === 0) {
          await tx.menuItemAvailability.update({
            where: { menuItemId },
            data: { state: 'SOLD_OUT', source: 'COUNT', since: now, byUserId: userId },
          });
          await logChange(tx, ctx, menuItemId, {
            change: 'SOLD_OUT',
            fromState: 'AVAILABLE',
            toState: 'SOLD_OUT',
            source: 'COUNT',
            leftBefore: 0,
            leftAfter: 0,
            byUserId: userId,
            orderId,
            orderItemId: line.id,
            createdAt: now,
          });
        } else if (before > taken[0].low_at && after <= taken[0].low_at) {
          await logChange(tx, ctx, menuItemId, {
            change: 'LOW',
            fromState: 'AVAILABLE',
            toState: 'AVAILABLE',
            source: 'COUNT',
            leftBefore: before,
            leftAfter: after,
            byUserId: userId,
            orderId,
            orderItemId: line.id,
            createdAt: now,
          });
        }
        continue;
      }

      const row = await tx.menuItemAvailability.findUniqueOrThrow({ where: { menuItemId } });
      const soldOut = row.state === 'SOLD_OUT' || row.left === 0;
      skipped.push({
        orderItemId: line.id,
        menuItemId,
        name: line.name,
        quantity: line.quantity,
        reason: soldOut ? 'SOLD_OUT' : 'NOT_ENOUGH_LEFT',
        left: row.left,
        message: soldOut
          ? `${line.name} is sold out`
          : `${line.name}: only ${row.left} left, ${line.quantity} wanted`,
      });
    }
  }
  return { sendIds, skipped, changedItemIds: [...changed] };
}

/**
 * Inside a void transaction: a sent line voided as "not made" gives its quantity back to the
 * number, if the item still has one. An item sold out by the count comes back on.
 */
export async function giveBackForVoid(
  tx: Prisma.TransactionClient,
  ctx: { organizationId: string; branchId: string },
  menuItemId: string,
  quantity: number,
  userId: string,
  orderId: string,
  orderItemId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<
    { left: number | null; state: MenuAvailabilityState; source: MenuAvailabilitySource }[]
  >`
    SELECT "left", "state", "source" FROM "menu_item_availability"
     WHERE "menu_item_id" = ${menuItemId} FOR UPDATE`;
  if (rows.length === 0 || rows[0].left === null) return false;
  const before = rows[0];
  const after = (before.left ?? 0) + quantity;
  const comesBack = before.state === 'SOLD_OUT' && before.source === 'COUNT';
  const now = new Date();
  await tx.menuItemAvailability.update({
    where: { menuItemId },
    data: {
      left: after,
      ...(comesBack ? { state: 'AVAILABLE' as const, since: now, byUserId: userId } : {}),
    },
  });
  await logChange(tx, ctx, menuItemId, {
    change: 'GIVEN_BACK',
    fromState: before.state,
    toState: comesBack ? 'AVAILABLE' : before.state,
    source: 'COUNT',
    leftBefore: before.left,
    leftAfter: after,
    byUserId: userId,
    orderId,
    orderItemId,
    createdAt: now,
  });
  return true;
}

export async function logChange(
  tx: Prisma.TransactionClient,
  ctx: { organizationId: string; branchId: string },
  menuItemId: string,
  entry: {
    change: MenuAvailabilityChange;
    fromState: MenuAvailabilityState;
    toState: MenuAvailabilityState;
    source: MenuAvailabilitySource;
    leftBefore?: number | null;
    leftAfter?: number | null;
    byUserId?: string | null;
    orderId?: string | null;
    orderItemId?: string | null;
    batchId?: string | null;
    createdAt: Date;
  },
) {
  await tx.menuAvailabilityLog.create({
    data: {
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      menuItemId,
      change: entry.change,
      fromState: entry.fromState,
      toState: entry.toState,
      source: entry.source,
      leftBefore: entry.leftBefore ?? null,
      leftAfter: entry.leftAfter ?? null,
      byUserId: entry.byUserId ?? null,
      orderId: entry.orderId ?? null,
      orderItemId: entry.orderItemId ?? null,
      batchId: entry.batchId ?? null,
      createdAt: entry.createdAt,
    },
  });
}
