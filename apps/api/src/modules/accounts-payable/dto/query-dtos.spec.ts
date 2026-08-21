import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListSuppliersQueryDto } from './list-suppliers-query.dto';
import { ListApPaymentsQueryDto } from './list-ap-payments-query.dto';
import { ListApCreditNotesQueryDto } from './list-ap-credit-notes-query.dto';
import { ListBillsQueryDto } from './list-bills-query.dto';
import { ListRecurringProfilesQueryDto } from './list-recurring-profiles-query.dto';
import { ListRemindersQueryDto } from './list-reminders-query.dto';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

/** Backend gap batch 3 — B5-F2 / B5-F3 sweep across the AP list routes. */
describe('ListSuppliersQueryDto (GET /accounting/ap/suppliers)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(ListSuppliersQueryDto, query);

  it('B5-F2: rejects an invalid counterpartyType', () => {
    expect(validateSync(build({ counterpartyType: 'NOT_A_TYPE' })).length).toBeGreaterThan(0);
  });

  it('accepts a real CounterpartyType value', () => {
    expect(validateSync(build({ counterpartyType: 'INVENTORY_SUPPLIER' }))).toHaveLength(0);
  });

  it('B5-F3: rejects take above the max — previously unbounded (raw @Query)', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });
});

describe('ListApPaymentsQueryDto (GET /accounting/ap/payments)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(ListApPaymentsQueryDto, query);

  it('B5-F2: rejects an invalid status', () => {
    expect(validateSync(build({ status: 'ISSUED' })).length).toBeGreaterThan(0);
  });

  it('accepts every real VendorPaymentStatus value', () => {
    for (const status of ['PENDING', 'POSTED', 'FAILED', 'CANCELLED']) {
      expect(validateSync(build({ status }))).toHaveLength(0);
    }
  });

  it('omitted status is valid (unfiltered)', () => {
    expect(validateSync(build({}))).toHaveLength(0);
  });

  it('B5-F3: rejects take above the max', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });
});

describe('ListApCreditNotesQueryDto (GET /accounting/ap/credit-notes)', () => {
  const build = (query: Record<string, unknown>) =>
    plainToInstance(ListApCreditNotesQueryDto, query);

  it('B5-F2: rejects an invalid status', () => {
    expect(validateSync(build({ status: 'ISSUED' })).length).toBeGreaterThan(0);
  });

  it('accepts every real CreditNoteStatus value', () => {
    for (const status of ['OPEN', 'PARTIALLY_APPLIED', 'FULLY_APPLIED', 'VOID']) {
      expect(validateSync(build({ status }))).toHaveLength(0);
    }
  });

  it('B5-F3: rejects take above the max', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });
});

describe('ListBillsQueryDto (GET /accounting/ap/bills)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(ListBillsQueryDto, query);

  it('B5-F3: rejects take=5000 — B0 measured this returning 200 with no server maximum', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });

  it(`accepts take at exactly the max of ${MAX_ACCOUNTING_LIST_PAGE_SIZE}`, () => {
    expect(validateSync(build({ take: MAX_ACCOUNTING_LIST_PAGE_SIZE }))).toHaveLength(0);
  });

  it('still rejects an invalid status (pre-existing BillStatusFilterDto contract)', () => {
    expect(validateSync(build({ status: 'BOGUS' })).length).toBeGreaterThan(0);
  });
});

describe('ListRecurringProfilesQueryDto (GET /accounting/ap/recurring-profiles)', () => {
  const build = (query: Record<string, unknown>) =>
    plainToInstance(ListRecurringProfilesQueryDto, query);

  it('B5-F3: rejects take above the max', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });
});

describe('ListRemindersQueryDto (GET /accounting/ap/reminders)', () => {
  const build = (query: Record<string, unknown>) => plainToInstance(ListRemindersQueryDto, query);

  it('B5-F3: rejects take above the max', () => {
    expect(validateSync(build({ take: 5000 })).length).toBeGreaterThan(0);
  });

  it('normal paging is unaffected', () => {
    const dto = build({ skip: 20, take: 25 });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.skip).toBe(20);
    expect(dto.take).toBe(25);
  });
});
