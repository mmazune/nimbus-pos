import { availabilityView, takeAvailabilityForSend } from './availability-engine';
import { stationsFor } from './menu-availability.service';
import { initialsOf } from './menu-workspace.service';

const base = {
  state: 'AVAILABLE' as const,
  source: 'MANUAL' as const,
  left: null as number | null,
  lowAt: 5,
  since: new Date('2026-11-26T19:20:00Z'),
  byUserId: 'u1',
};

describe('availabilityView (T2 phase 1)', () => {
  it('no row is available with no number', () => {
    expect(availabilityView(null)).toMatchObject({ state: 'AVAILABLE', left: null, lowAt: 5 });
  });
  it('a number at or under the low mark is LOW', () => {
    expect(availabilityView({ ...base, left: 5 }).state).toBe('LOW');
    expect(availabilityView({ ...base, left: 6 }).state).toBe('AVAILABLE');
  });
  it('sold out wins over a number', () => {
    expect(availabilityView({ ...base, state: 'SOLD_OUT', left: 3 }).state).toBe('SOLD_OUT');
  });
});

describe('initialsOf', () => {
  it('takes the first letter of each word', () => {
    expect(initialsOf('Lamb chops')).toBe('lc');
    expect(initialsOf('Double blended Scotch with cola')).toBe('dbswc');
    expect(initialsOf('Fish & chips (large)')).toBe('fcl');
  });
});

describe('stationsFor', () => {
  it('owner, manager, supervisor may mark any station', () => {
    expect(stationsFor({ id: 'x', roles: [{ jobRole: 'SUPERVISOR' }] })).toBeNull();
  });
  it('a chef marks kitchen items only, a bartender bar items only', () => {
    expect(stationsFor({ id: 'x', roles: [{ jobRole: 'CHEF' }] })).toEqual([
      'KITCHEN',
      'COLD_KITCHEN',
      'DESSERT',
    ]);
    expect(stationsFor({ id: 'x', roles: [{ jobRole: 'BARTENDER' }] })).toEqual(['BAR']);
    expect(stationsFor({ id: 'x', roles: [{ jobRole: 'WAITER' }] })).toEqual([]);
  });
});

describe('takeAvailabilityForSend', () => {
  it('locks items in menuItemId order and sends items with no row untouched', async () => {
    const calls: string[] = [];
    const tx: any = {
      menuItemAvailability: {
        findUnique: jest.fn(async ({ where }: any) => {
          calls.push(where.menuItemId);
          return where.menuItemId === 'b' ? { id: 'row-b' } : null;
        }),
        findUniqueOrThrow: jest.fn(async () => ({ state: 'SOLD_OUT', left: 0 })),
        update: jest.fn(),
      },
      $queryRaw: jest.fn(async () => []), // guarded take finds nothing: sold out
      menuAvailabilityLog: { create: jest.fn() },
    };
    const res = await takeAvailabilityForSend(
      tx,
      { organizationId: 'o', branchId: 'br' },
      'ord',
      'u',
      [
        { id: 'l1', menuItemId: 'c', quantity: 1, name: 'C' },
        { id: 'l2', menuItemId: 'b', quantity: 1, name: 'B' },
        { id: 'l3', menuItemId: 'a', quantity: 1, name: 'A' },
      ],
    );
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(res.sendIds.sort()).toEqual(['l1', 'l3']);
    expect(res.skipped).toEqual([
      expect.objectContaining({ orderItemId: 'l2', reason: 'SOLD_OUT' }),
    ]);
  });
});
