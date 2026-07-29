import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListOrderDiscountsQueryDto } from './list-order-discounts-query.dto';

/**
 * Prompt 3D regression: query params arrive as strings. Without `@Type(() => Number)`
 * the numeric `page`/`pageSize` fail `@IsInt` and the endpoint 400s on the UI's
 * `?pageSize=50` read. These tests lock in the string→number coercion.
 */
describe('ListOrderDiscountsQueryDto', () => {
  const build = (query: Record<string, unknown>) =>
    plainToInstance(ListOrderDiscountsQueryDto, query, { enableImplicitConversion: false });

  it('coerces string pageSize/page (as they arrive from the query string) to numbers and validates', () => {
    const dto = build({ pageSize: '50', page: '2' });
    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
    expect(dto.pageSize).toBe(50);
    expect(dto.page).toBe(2);
    expect(typeof dto.pageSize).toBe('number');
  });

  it('accepts an empty query (all optional)', () => {
    expect(validateSync(build({}))).toHaveLength(0);
  });

  it('rejects pageSize above the max of 100', () => {
    const errors = validateSync(build({ pageSize: '101' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects pageSize below the min of 1', () => {
    const errors = validateSync(build({ pageSize: '0' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-integer pageSize', () => {
    const errors = validateSync(build({ pageSize: 'abc' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid status enum and coerced pageSize together', () => {
    const dto = build({ status: 'PENDING', pageSize: '25' });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.status).toBe('PENDING');
    expect(dto.pageSize).toBe(25);
  });
});
