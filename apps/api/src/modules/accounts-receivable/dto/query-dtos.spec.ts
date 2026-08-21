import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListInvoicesQueryDto } from './list-invoices-query.dto';
import { ListArCreditNotesQueryDto } from './list-ar-credit-notes-query.dto';
import { AgingQueryDto } from './aging-query.dto';
import { ListAccountsQueryDto } from './list-accounts-query.dto';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

/**
 * Backend gap batch 3 — B5-F2 (unvalidated `status` → 500) and B5-F3
 * (unbounded `take`). These DTO-level tests lock in both fixes the same way
 * the leave/shift-swap precedent does (`list-leave-query.dto.spec.ts`):
 * invalid → validation error (→ 400 at the controller), valid → no error
 * (→ 200), omitted → no error (→ 200, unfiltered).
 */
describe('ListInvoicesQueryDto (GET /accounting/ar/invoices)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(ListInvoicesQueryDto, query);

  it('B5-F2: rejects an invalid status — VendorBillStatus has OVERDUE, InvoiceStatus does not', () => {
    expect(validateSync(build({ status: 'OVERDUE' })).length).toBeGreaterThan(0);
  });

  it('accepts every real InvoiceStatus value', () => {
    for (const status of [
      'DRAFT',
      'ISSUED',
      'PARTIALLY_PAID',
      'PAID',
      'CANCELLED',
      'CREDIT_ADJUSTED',
    ]) {
      expect(validateSync(build({ status }))).toHaveLength(0);
    }
  });

  it('omitted status is valid (unfiltered)', () => {
    expect(validateSync(build({}))).toHaveLength(0);
  });

  it('B5-F3: rejects take above the max of 100 — previously unbounded', () => {
    expect(validateSync(build({ take: 10000 })).length).toBeGreaterThan(0);
  });

  it(`accepts take at exactly the max of ${MAX_ACCOUNTING_LIST_PAGE_SIZE}`, () => {
    expect(validateSync(build({ take: MAX_ACCOUNTING_LIST_PAGE_SIZE }))).toHaveLength(0);
  });
});

describe('ListArCreditNotesQueryDto (GET /accounting/ar/credit-notes)', () => {
  const build = (query: Record<string, unknown>) =>
    plainToInstance(ListArCreditNotesQueryDto, query);

  it('B5-F2: rejects an invalid status', () => {
    expect(validateSync(build({ status: 'PAID' })).length).toBeGreaterThan(0);
  });

  it('accepts every real ArCreditNoteStatus value', () => {
    for (const status of ['OPEN', 'PARTIALLY_APPLIED', 'FULLY_APPLIED', 'VOID']) {
      expect(validateSync(build({ status }))).toHaveLength(0);
    }
  });

  it('B5-F3: rejects take above the max', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });
});

describe('AgingQueryDto (GET /accounting/ar/aging)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(AgingQueryDto, query);

  it('B5-F3: rejects take above the max — B0 measured take=5000 returning 200 with no bound', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });

  it('accepts take=1 (the exact repro that understated the branch total pre-fix)', () => {
    expect(validateSync(build({ take: 1 }))).toHaveLength(0);
  });

  it('accepts an empty query (defaults apply downstream)', () => {
    expect(validateSync(build({}))).toHaveLength(0);
  });
});

describe('ListAccountsQueryDto — AR customer accounts (GET /accounting/ar/accounts)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(ListAccountsQueryDto, query);

  it('B5-F3: rejects take above the max', () => {
    expect(validateSync(build({ take: 9999 })).length).toBeGreaterThan(0);
  });

  it('still rejects an invalid status (pre-existing AccountStatusFilterEnum contract)', () => {
    expect(validateSync(build({ status: 'BOGUS' })).length).toBeGreaterThan(0);
  });
});
