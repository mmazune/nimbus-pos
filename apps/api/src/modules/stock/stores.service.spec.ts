import { Decimal } from '@prisma/client/runtime/library';
import { movingAverage, roundUpToPack } from './stores.service';

describe('stores maths (T6)', () => {
  it('rounds a need up to whole packs', () => {
    expect(roundUpToPack(25000, 12000)).toBe(36000);
    expect(roundUpToPack(24000, 12000)).toBe(24000);
    expect(roundUpToPack(5, null)).toBe(5);
    expect(roundUpToPack(-3, 12000)).toBe(0);
  });
  it('moves the average by weight, exactly', () => {
    expect(movingAverage(64000, new Decimal('0.8'), 96000, new Decimal('0.85')).toString()).toBe(
      '0.83',
    );
    expect(movingAverage(0, new Decimal('0.8'), 10, new Decimal('1.2')).toString()).toBe('1.2');
    expect(movingAverage(-5, new Decimal('0.8'), 10, new Decimal('1.2')).toString()).toBe('1.2');
    expect(movingAverage(3, new Decimal('1'), 1, new Decimal('2')).toString()).toBe('1.25');
  });
});
