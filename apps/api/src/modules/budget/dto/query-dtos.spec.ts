import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListProcurementSuggestionsQueryDto } from './list-procurement-suggestions-query.dto';

/** Backend gap batch 3 — B5-F2: GET /finance/procurement-suggestions previously took raw strings. */
describe('ListProcurementSuggestionsQueryDto (GET /finance/procurement-suggestions)', () => {
  const build = (query: Record<string, unknown>) =>
    plainToInstance(ListProcurementSuggestionsQueryDto, query);

  it('rejects an invalid status', () => {
    expect(validateSync(build({ status: 'BOGUS' })).length).toBeGreaterThan(0);
  });

  it('accepts every real ProcurementSuggestionStatus value', () => {
    for (const status of ['PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED']) {
      expect(validateSync(build({ status }))).toHaveLength(0);
    }
  });

  it('rejects an invalid urgency', () => {
    expect(validateSync(build({ urgency: 'BOGUS' })).length).toBeGreaterThan(0);
  });

  it('accepts every real ProcurementUrgency value', () => {
    for (const urgency of [
      'MONITOR',
      'ORDER_NEXT_PO',
      'STOCK_UP_BEFORE_EVENT',
      'TRANSFER_FROM_BRANCH',
      'URGENT_LOCAL_BUY',
    ]) {
      expect(validateSync(build({ urgency }))).toHaveLength(0);
    }
  });

  it('omitted urgency/status is valid (unfiltered)', () => {
    expect(validateSync(build({}))).toHaveLength(0);
  });
});
