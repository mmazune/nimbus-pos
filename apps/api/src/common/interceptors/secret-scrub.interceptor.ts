import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { NEVER_IN_AN_ANSWER } from '../projection/people';

const BANNED = new Set<string>(NEVER_IN_AN_ANSWER);

/**
 * T6 — the last line of defence: no answer leaves the API carrying a password hash, a PIN
 * hash, a PIN lookup hash or a stored token hash, at any depth. Services are still expected
 * to select only safe fields (common/projection/people.ts); this catches the one that forgets.
 *
 * Walks plain objects and arrays only (Dates, Decimals, Buffers and class instances are left
 * as they are), and copies only when a banned key is actually found, so the cost on a clean
 * answer is one read of each key.
 */
export function scrubSecrets<T>(value: T, depth = 0): T {
  if (value === null || typeof value !== 'object' || depth > 12) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const s = scrubSecrets(v, depth + 1);
      if (s !== v) changed = true;
      return s;
    });
    return (changed ? out : value) as unknown as T;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  let out: Record<string, unknown> | null = null;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const v = (value as Record<string, unknown>)[key];
    if (BANNED.has(key)) {
      out = out ?? { ...(value as Record<string, unknown>) };
      delete out[key];
      continue;
    }
    const s = scrubSecrets(v, depth + 1);
    if (s !== v) {
      out = out ?? { ...(value as Record<string, unknown>) };
      out[key] = s;
    }
  }
  return (out ?? value) as T;
}

@Injectable()
export class SecretScrubInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body) => scrubSecrets(body)));
  }
}
