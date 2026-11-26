import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { StockKind } from '@prisma/client';

/**
 * T6 (03 section 3) — units by kind. Every amount is a whole number of base units: thousandths
 * of a piece (count), grams (weight), millilitres (volume). The display units are piece, kg and L,
 * so a base unit is always a thousandth of the display unit.
 */
const UNITS: Record<string, { kind: StockKind; perBase: number }> = {
  g: { kind: 'WEIGHT', perBase: 1 },
  gram: { kind: 'WEIGHT', perBase: 1 },
  grams: { kind: 'WEIGHT', perBase: 1 },
  kg: { kind: 'WEIGHT', perBase: 1000 },
  ml: { kind: 'VOLUME', perBase: 1 },
  cl: { kind: 'VOLUME', perBase: 10 },
  l: { kind: 'VOLUME', perBase: 1000 },
  litre: { kind: 'VOLUME', perBase: 1000 },
  pc: { kind: 'COUNT', perBase: 1000 },
  pcs: { kind: 'COUNT', perBase: 1000 },
  piece: { kind: 'COUNT', perBase: 1000 },
  pieces: { kind: 'COUNT', perBase: 1000 },
  each: { kind: 'COUNT', perBase: 1000 },
  unit: { kind: 'COUNT', perBase: 1000 },
  slice: { kind: 'COUNT', perBase: 1000 },
};

export function unitInfo(unit: string) {
  return (
    UNITS[
      String(unit ?? '')
        .trim()
        .toLowerCase()
    ] ?? null
  );
}

export const DISPLAY_UNIT: Record<StockKind, string> = {
  COUNT: 'piece',
  WEIGHT: 'kg',
  VOLUME: 'L',
};

/** "1.5" kg → 1500. Refuses a unit of another kind and anything that is not a whole base unit. */
export function toBase(
  amount: string | number | Decimal,
  unit: string,
  kind: StockKind | null,
): number {
  const u = unitInfo(unit);
  if (!u)
    throw new BadRequestException({ code: 'UNIT_UNKNOWN', message: `Unknown unit "${unit}"` });
  if (kind && u.kind !== kind) {
    throw new BadRequestException({
      code: 'UNIT_KIND_MISMATCH',
      message: `"${unit}" is ${u.kind.toLowerCase()}; this item is counted by ${kind.toLowerCase()}`,
    });
  }
  const base = new Decimal(amount).mul(u.perBase);
  if (!base.isInteger()) {
    throw new BadRequestException({
      code: 'NOT_WHOLE',
      message: 'The amount must be a whole number of base units',
    });
  }
  if (base.abs().gt(2_000_000_000)) throw new BadRequestException('Amount too large');
  return base.toNumber();
}

/** A recipe line's amount with its waste percentage, rounded half up to a whole base unit. */
export function recipeLineBase(
  qty: Decimal | string,
  unit: string,
  wastePct: Decimal | string,
  kind: StockKind | null,
) {
  const u = unitInfo(unit);
  if (!u) return null;
  if (kind && u.kind !== kind) return null;
  return new Decimal(qty)
    .mul(u.perBase)
    .mul(new Decimal(1).add(new Decimal(wastePct ?? 0).div(100)))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}
