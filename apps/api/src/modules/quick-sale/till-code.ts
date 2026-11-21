/**
 * One spelling of a till code for the event tills (H1F): trimmed and upper-cased, so
 * `drk-03`, `DRK-03 ` and ` DRK-03` are all `DRK-03`. Used by the quick-sale DTO, the
 * quick-sale service and the till's expected-cash query. The till-open path is unchanged.
 */
export function normalizeTillCode<T>(value: T): T {
  return (typeof value === 'string' ? value.trim().toUpperCase() : value) as T;
}
