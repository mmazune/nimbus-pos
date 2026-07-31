import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListLeaveQueryDto } from './list-leave-query.dto';

/**
 * Prompt 5A: leave-list query params arrive as strings. Without `@Type(() => Number)`
 * the numeric `skip`/`take` fail `@IsInt`, and without `@Max(100)` `take` was
 * unbounded (an unbounded-history read). These tests lock in the coercion and the
 * bounded-history contract, mirroring the discounts DTO regression (SUP-RG-032).
 */
describe('ListLeaveQueryDto', () => {
  const build = (query: Record<string, unknown>) =>
    plainToInstance(ListLeaveQueryDto, query, { enableImplicitConversion: false });

  it('coerces string skip/take (as they arrive from the query string) to numbers', () => {
    const dto = build({ skip: '25', take: '50' });
    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
    expect(dto.skip).toBe(25);
    expect(dto.take).toBe(50);
    expect(typeof dto.take).toBe('number');
  });

  it('accepts an empty query (all optional)', () => {
    expect(validateSync(build({}))).toHaveLength(0);
  });

  it('rejects take above the max of 100 (bounded history)', () => {
    expect(validateSync(build({ take: '101' })).length).toBeGreaterThan(0);
  });

  it('accepts take at exactly the max of 100', () => {
    expect(validateSync(build({ take: '100' }))).toHaveLength(0);
  });

  it('rejects take below the min of 1', () => {
    expect(validateSync(build({ take: '0' })).length).toBeGreaterThan(0);
  });

  it('rejects a negative skip', () => {
    expect(validateSync(build({ skip: '-1' })).length).toBeGreaterThan(0);
  });

  it('rejects a non-integer take', () => {
    expect(validateSync(build({ take: 'abc' })).length).toBeGreaterThan(0);
  });

  it('accepts a valid status + leaveType + coerced take together', () => {
    const dto = build({ status: 'PENDING', leaveType: 'SICK', take: '25' });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.status).toBe('PENDING');
    expect(dto.take).toBe(25);
  });

  it('accepts a valid ISO dateFrom/dateTo History window', () => {
    const dto = build({ dateFrom: '2026-01-01', dateTo: '2026-07-30T23:59:59.000Z' });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects a non-ISO dateFrom', () => {
    expect(validateSync(build({ dateFrom: 'not-a-date' })).length).toBeGreaterThan(0);
  });

  it('rejects an invalid status enum', () => {
    expect(validateSync(build({ status: 'NEEDS_ACTION' })).length).toBeGreaterThan(0);
  });
});
