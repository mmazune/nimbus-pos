import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListJournalsQueryDto } from './list-journals-query.dto';
import { ListPostingRunsQueryDto } from './list-posting-runs-query.dto';
import { ListPostingErrorsQueryDto } from './list-posting-errors-query.dto';
import { ResolvePostingErrorDto } from './resolve-posting-error.dto';
import { DismissPostingErrorDto } from './dismiss-posting-error.dto';

/** Backend gap batch 3 — B5-F2 / B5-F3 sweep across the ledger list routes. */
describe('ListJournalsQueryDto (GET /accounting/journals)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(ListJournalsQueryDto, query);

  it('B5-F3: rejects take=5000 — B0 measured this returning 200 with no server maximum', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });

  it('accepts take at exactly the max of 100', () => {
    expect(validateSync(build({ take: 100 }))).toHaveLength(0);
  });

  it('still rejects an invalid status (pre-existing JournalStatusFilter contract)', () => {
    expect(validateSync(build({ status: 'BOGUS' })).length).toBeGreaterThan(0);
  });

  it('coerces string skip/take (as they arrive from the query string) to numbers', () => {
    const dto = build({ skip: '10', take: '25' });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.skip).toBe(10);
    expect(dto.take).toBe(25);
  });
});

describe('ListPostingRunsQueryDto (GET /accounting/posting-runs)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(ListPostingRunsQueryDto, query);

  it('B5-F3: rejects take above the max — previously a raw unbounded @Query', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });

  it('accepts an empty query', () => {
    expect(validateSync(build({}))).toHaveLength(0);
  });
});

describe('ListPostingErrorsQueryDto (GET /accounting/posting-errors)', () => {
  const build = (query: Record<string, unknown>) =>
    plainToInstance(ListPostingErrorsQueryDto, query);

  it('B5-F2: rejects an invalid status', () => {
    expect(validateSync(build({ status: 'BOGUS' })).length).toBeGreaterThan(0);
  });

  it('accepts every real PostingErrorStatus value', () => {
    for (const status of ['OPEN', 'RESOLVED', 'DISMISSED']) {
      expect(validateSync(build({ status }))).toHaveLength(0);
    }
  });

  it('B5-F3: rejects take above the max', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });
});

/** Backend gap batch 4 — B5.4-D1. */
describe('ResolvePostingErrorDto / DismissPostingErrorDto (PATCH .../{resolve,dismiss})', () => {
  it('accepts an empty body — resolutionNotes is optional', () => {
    expect(validateSync(plainToInstance(ResolvePostingErrorDto, {}))).toHaveLength(0);
    expect(validateSync(plainToInstance(DismissPostingErrorDto, {}))).toHaveLength(0);
  });

  it('accepts a string resolutionNotes', () => {
    const dto = plainToInstance(ResolvePostingErrorDto, { resolutionNotes: 'Fixed the map' });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.resolutionNotes).toBe('Fixed the map');
  });

  it('rejects a non-string resolutionNotes', () => {
    expect(
      validateSync(plainToInstance(ResolvePostingErrorDto, { resolutionNotes: 123 })).length,
    ).toBeGreaterThan(0);
  });
});
