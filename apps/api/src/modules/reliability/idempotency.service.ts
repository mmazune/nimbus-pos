import {
    Injectable,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface IdempotencyContext {
    /** Idempotency-Key value supplied by client (or generated). */
    key: string;
    /** Logical scope so two unrelated routes can share keys safely. */
    scope?: string;
    routeMethod: string;
    routePath: string;
    actorUserId?: string | null;
    orgId?: string | null;
    /** The request body (or any deterministic fingerprint source). */
    fingerprintSource: unknown;
    /** Retention TTL in seconds. Default 24h. */
    ttlSeconds?: number;
}

export interface IdempotencyHit<T> {
    /**
     * - 'first': caller should run the handler and then call `complete()`
     * - 'replay': caller should return `replay.body` directly with `replay.statusCode`
     * - 'conflict': same key reused with a different payload — caller should 4xx
     * - 'in_flight': another request is currently executing — caller should 409
     */
    outcome: 'first' | 'replay' | 'conflict' | 'in_flight';
    recordId: string;
    fingerprint: string;
    replay?: { statusCode: number; body: T | null };
    conflictReason?: string;
}

export interface CompleteOptions {
    statusCode: number;
    body?: unknown;
    responseRef?: string | null;
    failureSummary?: string | null;
    /** When true, persists as FAILED instead of SUCCEEDED. */
    failed?: boolean;
}

/**
 * Generic idempotency layer for risky write surfaces.
 *
 * Usage:
 *   const hit = await idem.begin(ctx);
 *   if (hit.outcome === 'replay') return hit.replay.body;
 *   if (hit.outcome === 'conflict') throw new ConflictException(hit.conflictReason);
 *   if (hit.outcome === 'in_flight') throw new ConflictException('Request already in flight');
 *   try {
 *     const result = await doRealWork();
 *     await idem.complete(hit.recordId, { statusCode: 200, body: result });
 *     return result;
 *   } catch (err) {
 *     await idem.complete(hit.recordId, { statusCode: 500, failed: true, failureSummary: String(err) });
 *     throw err;
 *   }
 */
@Injectable()
export class IdempotencyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    fingerprint(input: unknown): string {
        const stable = stableStringify(input);
        return createHash('sha256').update(stable).digest('hex');
    }

    async begin<T = unknown>(ctx: IdempotencyContext): Promise<IdempotencyHit<T>> {
        const fingerprint = this.fingerprint(ctx.fingerprintSource);
        const scope = ctx.scope ?? 'default';
        const ttl = ctx.ttlSeconds ?? 24 * 60 * 60;
        const expiresAt = new Date(Date.now() + ttl * 1000);

        const existing = await this.prisma.idempotencyKey.findUnique({
            where: {
                scope_key_routeMethod_routePath: {
                    scope,
                    key: ctx.key,
                    routeMethod: ctx.routeMethod,
                    routePath: ctx.routePath,
                },
            },
        });

        if (existing) {
            if (existing.requestHash !== fingerprint) {
                return {
                    outcome: 'conflict',
                    recordId: existing.id,
                    fingerprint,
                    conflictReason:
                        'Idempotency-Key reused with a different request payload',
                };
            }
            if (existing.status === 'IN_FLIGHT') {
                return { outcome: 'in_flight', recordId: existing.id, fingerprint };
            }
            return {
                outcome: 'replay',
                recordId: existing.id,
                fingerprint,
                replay: {
                    statusCode: existing.statusCode ?? 200,
                    body: (existing.responseBody as T) ?? null,
                },
            };
        }

        const created = await this.prisma.idempotencyKey.create({
            data: {
                orgId: ctx.orgId ?? null,
                actorUserId: ctx.actorUserId ?? null,
                routeMethod: ctx.routeMethod,
                routePath: ctx.routePath,
                scope,
                key: ctx.key,
                requestHash: fingerprint,
                status: 'IN_FLIGHT',
                expiresAt,
            },
        });

        return { outcome: 'first', recordId: created.id, fingerprint };
    }

    async complete(recordId: string, opts: CompleteOptions): Promise<void> {
        await this.prisma.idempotencyKey.update({
            where: { id: recordId },
            data: {
                status: opts.failed ? 'FAILED' : 'SUCCEEDED',
                statusCode: opts.statusCode,
                responseBody:
                    opts.body === undefined ? undefined : (opts.body as any),
                responseRef: opts.responseRef ?? null,
                failureSummary: opts.failureSummary ?? null,
                completedAt: new Date(),
            },
        });
    }

    async markConflict(recordId: string, reason: string): Promise<void> {
        await this.prisma.idempotencyKey.update({
            where: { id: recordId },
            data: {
                status: 'CONFLICT',
                failureSummary: reason,
                completedAt: new Date(),
            },
        });
    }

    async lookup(
        scope: string,
        routeMethod: string,
        routePath: string,
        key: string,
    ) {
        return this.prisma.idempotencyKey.findUnique({
            where: {
                scope_key_routeMethod_routePath: {
                    scope: scope || 'default',
                    key,
                    routeMethod,
                    routePath,
                },
            },
        });
    }

    /**
     * Convenience wrapper used by Nest services where it is acceptable to
     * 409 immediately on conflict / in-flight, and replay the original
     * response on a safe repeat. Returns either the cached body or the
     * fresh handler result.
     */
    async wrap<T>(
        ctx: IdempotencyContext,
        handler: () => Promise<{ statusCode?: number; body: T; responseRef?: string }>,
    ): Promise<T> {
        const hit = await this.begin<T>(ctx);
        if (hit.outcome === 'replay') {
            return (hit.replay?.body as T) ?? (null as any);
        }
        if (hit.outcome === 'conflict') {
            throw new ConflictException(hit.conflictReason ?? 'idempotency conflict');
        }
        if (hit.outcome === 'in_flight') {
            throw new ConflictException('Idempotent request already in flight');
        }
        try {
            const result = await handler();
            await this.complete(hit.recordId, {
                statusCode: result.statusCode ?? 200,
                body: result.body,
                responseRef: result.responseRef ?? null,
            });
            return result.body;
        } catch (err: any) {
            await this.complete(hit.recordId, {
                statusCode: err?.status ?? 500,
                failed: true,
                failureSummary: err?.message ?? String(err),
            });
            throw err;
        }
    }

    /**
     * Validates an Idempotency-Key header value (loose: 8..128 chars, no whitespace).
     * Throws BadRequestException when present-but-invalid.
     */
    requireValidKey(key: string | undefined | null): string {
        if (!key || typeof key !== 'string') {
            throw new BadRequestException('Idempotency-Key header is required');
        }
        const trimmed = key.trim();
        if (trimmed.length < 8 || trimmed.length > 128 || /\s/.test(trimmed)) {
            throw new BadRequestException(
                'Idempotency-Key must be 8-128 chars and contain no whitespace',
            );
        }
        return trimmed;
    }
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
        return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
    }
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return (
        '{' +
        keys
            .map(
                (k) =>
                    JSON.stringify(k) +
                    ':' +
                    stableStringify((value as Record<string, unknown>)[k]),
            )
            .join(',') +
        '}'
    );
}
