import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListAnomaliesQueryDto } from './list-anomalies-query.dto';

/**
 * Prompt 5A: anomaly-list query coercion + bounds + the ISO History date window.
 * limit/offset already carried `@Type(() => Number)`; these lock the contract and
 * cover the newly added dateFrom/dateTo (mirrors the discounts DTO regression).
 */
describe('ListAnomaliesQueryDto', () => {
  const build = (query: Record<string, unknown>) =>
    plainToInstance(ListAnomaliesQueryDto, query, { enableImplicitConversion: false });

  it('coerces string limit/offset to numbers', () => {
    const dto = build({ limit: '50', offset: '25' });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.limit).toBe(50);
    expect(dto.offset).toBe(25);
  });

  it('accepts an empty query (all optional)', () => {
    expect(validateSync(build({}))).toHaveLength(0);
  });

  it('rejects limit above the max of 100', () => {
    expect(validateSync(build({ limit: '101' })).length).toBeGreaterThan(0);
  });

  it('rejects a negative offset', () => {
    expect(validateSync(build({ offset: '-1' })).length).toBeGreaterThan(0);
  });

  it('accepts valid status/type/severity enums', () => {
    const dto = build({ status: 'OPEN', type: 'CASH_VARIANCE', severity: 'HIGH' });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects an invalid severity', () => {
    expect(validateSync(build({ severity: 'EXTREME' })).length).toBeGreaterThan(0);
  });

  it('accepts a valid ISO dateFrom/dateTo History window', () => {
    const dto = build({ dateFrom: '2026-01-01', dateTo: '2026-07-30T23:59:59.000Z' });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects a non-ISO dateTo', () => {
    expect(validateSync(build({ dateTo: '30/07/2026' })).length).toBeGreaterThan(0);
  });
});
