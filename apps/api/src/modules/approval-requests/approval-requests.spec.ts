import { mayAnswer, ANSWER_KEY, ANSWER_MANAGER_KEY } from './approval-requests.service';
import { businessDayOf, sameBusinessDay } from './business-day';

describe('mayAnswer (T6)', () => {
  it('a supervisor answers supervisor level, not manager level', () => {
    expect(mayAnswer([ANSWER_KEY], 'SUPERVISOR')).toBe(true);
    expect(mayAnswer([ANSWER_KEY], 'MANAGER')).toBe(false);
  });
  it('a manager answers both', () => {
    expect(mayAnswer([ANSWER_MANAGER_KEY], 'SUPERVISOR')).toBe(true);
    expect(mayAnswer([ANSWER_MANAGER_KEY], 'MANAGER')).toBe(true);
  });
  it('nobody else answers', () => {
    expect(mayAnswer(['pos:orders:write'], 'SUPERVISOR')).toBe(false);
  });
});

describe('business day in Africa/Kampala (T6)', () => {
  // 22:30 UTC = 01:30 Kampala on the 27th; with the day ending at 05:00 it is still the 26th.
  it('a sale at 01:30 belongs to the day before when the day ends at 05:00', () => {
    expect(businessDayOf(new Date('2026-11-26T22:30:00Z'), 5)).toBe('2026-11-26');
  });
  it('05:00 Kampala starts the next business day', () => {
    expect(businessDayOf(new Date('2026-11-27T02:00:00Z'), 5)).toBe('2026-11-27');
  });
  it('same evening and after midnight are the same business day', () => {
    expect(
      sameBusinessDay(new Date('2026-11-26T18:00:00Z'), new Date('2026-11-26T23:59:00Z'), 5),
    ).toBe(true);
    expect(
      sameBusinessDay(new Date('2026-11-26T18:00:00Z'), new Date('2026-11-27T03:00:00Z'), 5),
    ).toBe(false);
  });
});
