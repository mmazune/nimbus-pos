import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListAccountsQueryDto } from './list-accounts-query.dto';

/** Backend gap batch 3 — B5-F3: GET /accounting/accounts previously had no `take` bound. */
describe('ListAccountsQueryDto — chart of accounts (GET /accounting/accounts)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(ListAccountsQueryDto, query);

  it('B5-F3: rejects take above the max', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });

  it('accepts take at exactly the max of 100', () => {
    expect(validateSync(build({ take: 100 }))).toHaveLength(0);
  });

  it('still rejects an invalid accountType / status (pre-existing contract)', () => {
    expect(validateSync(build({ accountType: 'BOGUS' })).length).toBeGreaterThan(0);
    expect(validateSync(build({ status: 'BOGUS' })).length).toBeGreaterThan(0);
  });

  it('coerces string skip/take to numbers', () => {
    const dto = build({ skip: '10', take: '25' });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.skip).toBe(10);
    expect(dto.take).toBe(25);
  });
});
