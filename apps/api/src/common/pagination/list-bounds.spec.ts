import { clampTake, MAX_ACCOUNTING_LIST_PAGE_SIZE } from './list-bounds';

describe('clampTake', () => {
  it('clamps a value above the max down to the max', () => {
    expect(clampTake(10000)).toBe(MAX_ACCOUNTING_LIST_PAGE_SIZE);
    expect(clampTake(5000, 50, 100)).toBe(100);
  });

  it('leaves an in-range value untouched', () => {
    expect(clampTake(25, 50)).toBe(25);
  });

  it('falls back to the default when undefined', () => {
    expect(clampTake(undefined, 50)).toBe(50);
  });

  it('falls back to the default for a non-numeric string', () => {
    expect(clampTake('abc' as any, 50)).toBe(50);
  });

  it('never returns below 1', () => {
    expect(clampTake(0)).toBe(1);
    expect(clampTake(-5)).toBe(1);
  });

  it('coerces a numeric string (as arrives from a raw @Query())', () => {
    expect(clampTake('25' as any, 50)).toBe(25);
  });
});
