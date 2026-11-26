import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { recipeLineBase } from './units';

type Db = Prisma.TransactionClient;

export interface LineForStock {
  id: string;
  menuItemId: string;
  menuItemServingId: string | null;
  quantity: number;
  metadata: Prisma.JsonValue | null;
}

export interface Ingredient {
  inventoryItemId: string;
  /** Whole base units for the whole line (quantity included). */
  amount: number;
}

function selectedModifierIds(metadata: Prisma.JsonValue | null): string[] {
  const m = (metadata as any)?.selectedModifiers;
  return Array.isArray(m) ? m.map((x: any) => x?.modifierOptionId).filter(Boolean) : [];
}

/**
 * The recipe rows that make one of this line. T6 fixes the servings fault: a serving with its
 * own rows (a double burger, a large bowl) uses those rows; only a serving with none falls back to
 * the item's base rows. Before, order lines always used the base rows, so a double cost the same
 * as a single. Chosen extras add their own rows.
 */
export async function recipeRowsForLine(
  db: Db,
  branchId: string,
  menuItemId: string,
  menuItemServingId: string | null,
  modifierOptionIds: string[],
) {
  const servingRows = menuItemServingId
    ? await db.recipeIngredient.findMany({
        where: { branchId, menuItemId, menuItemServingId, modifierOptionId: null },
        include: { inventoryItem: true },
      })
    : [];
  const base =
    servingRows.length > 0
      ? servingRows
      : await db.recipeIngredient.findMany({
          where: { branchId, menuItemId, menuItemServingId: null, modifierOptionId: null },
          include: { inventoryItem: true },
        });
  const mods = modifierOptionIds.length
    ? await db.recipeIngredient.findMany({
        where: { branchId, menuItemId, modifierOptionId: { in: modifierOptionIds } },
        include: { inventoryItem: true },
      })
    : [];
  return [...base, ...mods];
}

/** What one order line takes out of stock, by how its item is sold (03 section 4). */
export async function ingredientsForLine(
  db: Db,
  branchId: string,
  line: LineForStock,
): Promise<Ingredient[]> {
  const item = await db.menuItem.findUnique({
    where: { id: line.menuItemId },
    select: { soldAs: true, stockItemId: true },
  });
  if (!item || item.soldAs === 'NOT_TRACKED') return [];
  const q = line.quantity;
  if (item.soldAs === 'AS_BOUGHT') {
    return item.stockItemId ? [{ inventoryItemId: item.stockItemId, amount: 1000 * q }] : [];
  }
  if (item.soldAs === 'MEASURE') {
    if (!item.stockItemId) return [];
    const serving = line.menuItemServingId
      ? await db.menuItemServing.findUnique({ where: { id: line.menuItemServingId } })
      : await db.menuItemServing.findFirst({
          where: { menuItemId: line.menuItemId, isDefault: true },
        });
    return serving?.stockAmount
      ? [{ inventoryItemId: item.stockItemId, amount: serving.stockAmount * q }]
      : [];
  }
  const rows = await recipeRowsForLine(
    db,
    branchId,
    line.menuItemId,
    line.menuItemServingId,
    selectedModifierIds(line.metadata),
  );
  const byItem = new Map<string, number>();
  for (const r of rows) {
    const per =
      r.amountBase ??
      recipeLineBase(
        r.qtyPerUnit as unknown as Decimal,
        r.unit,
        r.wastePct as unknown as Decimal,
        r.inventoryItem.stockKind,
      );
    if (!per) continue;
    byItem.set(r.inventoryItemId, (byItem.get(r.inventoryItemId) ?? 0) + per * q);
  }
  return [...byItem].map(([inventoryItemId, amount]) => ({ inventoryItemId, amount }));
}
