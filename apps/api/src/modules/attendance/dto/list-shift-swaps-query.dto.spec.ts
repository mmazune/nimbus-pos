import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListShiftSwapsQueryDto } from './list-shift-swaps-query.dto';

/**
 * Prompt 5A: shift-swap-list query params arrive as strings. Locks in string→number
 * coercion of `skip`/`take`, the bounded-history `@Max(100)`, and the ISO History
 * date window (mirrors the discounts DTO regression, SUP-RG-032).
 */
describe('ListShiftSwapsQueryDto', () => {
  const build = (query: Record<string, unknown>) =>
    plainToInstance(ListShiftSwapsQueryDto, query, { enableImplicitConversion: false });

  it('coerces string skip/take to numbers', () => {
    const dto = build({ skip: '10', take: '40' });
    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
    expect(dto.skip).toBe(10);
    expect(dto.take).toBe(40);
    expect(typeof dto.take).toBe('number');
  });

  it('accepts an empty query (all optional)', () => {
    expect(validateSync(build({}))).toHaveLength(0);
  });

  it('rejects take above the max of 100 (bounded history)', () => {
    expect(validateSync(build({ take: '250' })).length).toBeGreaterThan(0);
  });

  it('accepts take at exactly the max of 100', () => {
    expect(validateSync(build({ take: '100' }))).toHaveLength(0);
  });

  it('rejects take below the min of 1', () => {
    expect(validateSync(build({ take: '0' })).length).toBeGreaterThan(0);
  });

  it('rejects a negative skip', () => {
    expect(validateSync(build({ skip: '-5' })).length).toBeGreaterThan(0);
  });

  it('rejects a non-integer take', () => {
    expect(validateSync(build({ take: '1.5' })).length).toBeGreaterThan(0);
  });

  it('accepts a valid status + coerced take together', () => {
    const dto = build({ status: 'APPROVED', take: '25' });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.status).toBe('APPROVED');
  });

  it('accepts a valid ISO dateFrom/dateTo History window', () => {
    const dto = build({ dateFrom: '2026-06-01', dateTo: '2026-07-30' });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects an invalid status enum', () => {
    expect(validateSync(build({ status: 'RESOLVED' })).length).toBeGreaterThan(0);
  });
});
