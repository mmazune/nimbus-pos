import { allowedActions } from './allowed-actions';

const order = (over: Partial<Parameters<typeof allowedActions>[0]> = {}) => ({
  status: 'SENT',
  userId: 'waiter-1',
  tableId: 't1',
  items: [{ sentAt: new Date(), voidedAt: null }],
  paidCount: 0,
  ...over,
});
const waiter = {
  id: 'waiter-1',
  roles: [{ jobRole: 'WAITER' }],
  permissions: ['pos:orders:write'],
};

describe('allowedActions (T6)', () => {
  it('a waiter on her own sent order: add and print, nothing about money', () => {
    expect(allowedActions(order(), waiter)).toEqual(['ADD_ITEMS', 'PRINT_BILL', 'MARK_SERVED']);
  });
  it("a waiter on another waiter's order gets nothing to write", () => {
    expect(allowedActions(order({ userId: 'waiter-2' }), waiter)).toEqual([]);
  });
  it('SEND only when there is an unsent line', () => {
    expect(allowedActions(order({ items: [{ sentAt: null, voidedAt: null }] }), waiter)).toContain(
      'SEND',
    );
  });
  it('no void of the order once money is on it', () => {
    const sup = {
      id: 's',
      roles: [{ jobRole: 'SUPERVISOR' }],
      permissions: ['pos:orders:void', 'pos:order:item:void'],
    };
    expect(allowedActions(order(), sup)).toEqual(['VOID_ORDER', 'VOID_LINE']);
    expect(allowedActions(order({ paidCount: 1 }), sup)).toEqual(['VOID_LINE']);
  });
  it('a closed, paid order offers only a refund, to whoever holds the right', () => {
    const sup = { id: 's', permissions: ['pos:refund:create', 'pos:orders:write'] };
    expect(allowedActions(order({ status: 'CLOSED', paidCount: 1 }), sup)).toEqual(['REFUND']);
  });
});
