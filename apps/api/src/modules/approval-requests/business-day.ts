/**
 * T6 — the business day a moment belongs to, in Africa/Kampala (UTC+3, no daylight saving).
 * A business day ends at the hour the venue sets (R24, OrgSettings.businessDayEndsHour): with
 * 5, a sale at 01:30 belongs to the day before.
 */
const KAMPALA_OFFSET_MS = 3 * 60 * 60 * 1000;

export function businessDayOf(at: Date, endsHour: number): string {
  const local = new Date(at.getTime() + KAMPALA_OFFSET_MS - endsHour * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function sameBusinessDay(a: Date, b: Date, endsHour: number): boolean {
  return businessDayOf(a, endsHour) === businessDayOf(b, endsHour);
}
