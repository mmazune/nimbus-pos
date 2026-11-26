import { toBase, recipeLineBase, unitInfo } from './units';

describe('stock units (T6)', () => {
  it('turns display amounts into whole base units', () => {
    expect(toBase('1.5', 'kg', 'WEIGHT')).toBe(1500);
    expect(toBase('150', 'g', 'WEIGHT')).toBe(150);
    expect(toBase('0.75', 'L', 'VOLUME')).toBe(750);
    expect(toBase('2', 'piece', 'COUNT')).toBe(2000);
    expect(toBase('0.5', 'piece', 'COUNT')).toBe(500);
  });
  it('refuses another kind and a part of a base unit', () => {
    expect(() => toBase('1', 'ml', 'WEIGHT')).toThrow();
    expect(() => toBase('0.5', 'g', 'WEIGHT')).toThrow();
    expect(() => toBase('1', 'cups', null)).toThrow();
  });
  it('a recipe line keeps its waste, rounded half up', () => {
    expect(recipeLineBase('150', 'g', '0', 'WEIGHT')).toBe(150);
    expect(recipeLineBase('150', 'g', '10', 'WEIGHT')).toBe(165);
    expect(recipeLineBase('1', 'piece', '0', 'COUNT')).toBe(1000);
    expect(recipeLineBase('10', 'ml', '0', 'WEIGHT')).toBeNull();
  });
  it('knows its units', () => {
    expect(unitInfo('KG')).toEqual({ kind: 'WEIGHT', perBase: 1000 });
    expect(unitInfo('nope')).toBeNull();
  });
});
