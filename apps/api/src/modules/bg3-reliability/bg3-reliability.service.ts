import {
    Injectable,
    HttpException,
    HttpStatus as NestHttpStatus,
    Logger,
} from '@nestjs/common';
const HttpStatus = NestHttpStatus as unknown as Record<string, number>;
import type { Request } from 'express';
import { IdempotencyService } from '../reliability/idempotency.service';
import { MaintenanceWindowService } from '../controlplane/maintenance-window.service';
import { TrainingSessionService } from '../controlplane/training-session.service';
import type { WriteBlockCategoryT } from '../controlplane/dto';
import {
    BG3_ERROR_CODES,
    TrainingSimulationMarker,
} from './bg3-write-categories';

export interface Bg3GuardOptions<T> {
    req: Request;
    /** logical scope for idempotency (e.g. 'payments.intents.create') */
    scope: string;
    routeMethod: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    routePath: string;
    /** maintenance category to check; null skips maintenance check */
    category: WriteBlockCategoryT | null;
    /**
     * 'required' → 400 if Idempotency-Key header missing.
     * 'optional' → idempotency wrap only when header present (default).
     */
    idempotencyMode?: 'required' | 'optional';
    fingerprintSource: unknown;
    actorUserId?: string | null;
    orgId?: string | null;
    branchId?: string | null;
    /**
     * If provided AND `x-training-session-id` header resolves to an active
     * session for actorUserId, the simulator is invoked instead of the real
     * handler and its result is returned with a `_training` marker injected.
     * If actorUserId/orgId is missing the training check is skipped.
     */
    trainingSimulator?: () => Promise<T> | T;
}

/**
 * BG3 reliability facade. Composes the existing M41 IdempotencyService
 * with the M42 MaintenanceWindowService + TrainingSessionService so every
 * risky write surface gets the same hardening with a one-call wrap.
 *
 * Contract:
 *   - Maintenance window blocking → 423 Locked, body includes
 *     { code: MAINTENANCE_WINDOW_BLOCKED, window: {...}, category }.
 *   - Training simulator path → 200/whatever the real handler returns,
 *     body augmented with `_training: TrainingSimulationMarker`.
 *   - Idempotency replay → cached body returned as-is (status 200).
 *   - Idempotency conflict (same key, different payload) → 409 Conflict
 *     with body { code: IDEMPOTENCY_KEY_PAYLOAD_MISMATCH, ... }.
 *   - Idempotency in-flight (concurrent same key) → 409 with code
 *     IDEMPOTENCY_IN_FLIGHT.
 *   - Bad key (present but malformed) → 400 with IDEMPOTENCY_KEY_INVALID.
 *   - Missing header on `idempotencyMode='required'` → 400.
 */
@Injectable()
export class Bg3ReliabilityService {
    private readonly log = new Logger('Bg3Reliability');

    constructor(
        private readonly idempotency: IdempotencyService,
        private readonly maintenance: MaintenanceWindowService,
        private readonly training: TrainingSessionService,
    ) { }

    /** Read Idempotency-Key header in a case-insensitive, array-safe way. */
    static readIdempotencyKey(req: Request): string | undefined {
        const raw =
            req.headers['idempotency-key'] ??
            (req.headers as Record<string, unknown>)['Idempotency-Key'];
        if (Array.isArray(raw)) return raw[0];
        return typeof raw === 'string' ? raw : undefined;
    }

    /** Read x-training-session-id header. */
    static readTrainingSessionId(req: Request): string | undefined {
        const raw = req.headers['x-training-session-id'];
        if (Array.isArray(raw)) return raw[0];
        return typeof raw === 'string' ? raw : undefined;
    }

    async guard<T>(
        opts: Bg3GuardOptions<T>,
        handler: () => Promise<T>,
    ): Promise<T> {
        const { req, category, scope, routeMethod, routePath } = opts;
        const idempotencyMode = opts.idempotencyMode ?? 'optional';

        // 1. Maintenance check (unconditional when category given + orgId known)
        if (category && opts.orgId) {
            const blocking = await this.maintenance.findBlockingWindow(
                opts.orgId,
                opts.branchId ?? null,
                category,
            );
            if (blocking) {
                throw new HttpException(
                    {
                        code: BG3_ERROR_CODES.MAINTENANCE_BLOCKED,
                        message: `Write blocked by active maintenance window '${blocking.code}'`,
                        category,
                        window: {
                            id: blocking.id,
                            code: blocking.code,
                            title: blocking.title,
                            startsAt: blocking.startsAt,
                            endsAt: blocking.endsAt,
                            blockCategories: blocking.blockCategories,
                        },
                    },
                    HttpStatus.LOCKED ?? 423, // 423 — Nest enum may not expose LOCKED on older versions
                );
            }
        }

        // 2. Training mode short-circuit (only when simulator + active session)
        if (opts.trainingSimulator && opts.actorUserId && opts.orgId) {
            const trainingId = Bg3ReliabilityService.readTrainingSessionId(req);
            if (trainingId) {
                const session = await this.training.findActiveForActor(
                    opts.orgId,
                    opts.actorUserId,
                    trainingId,
                );
                if (session) {
                    const simulated = await opts.trainingSimulator();
                    const marker: TrainingSimulationMarker = {
                        simulated: true,
                        trainingSessionId: session.id,
                        category: category ?? ('ALL_WRITES' as WriteBlockCategoryT),
                        scope,
                        note: 'BG3: training-mode simulated response — no real side effects persisted',
                        simulatedAt: new Date().toISOString(),
                    };
                    return Object.assign({} as object, simulated as object, {
                        _training: marker,
                    }) as T;
                }
            }
        }

        // 3. Idempotency wrap
        const rawKey = Bg3ReliabilityService.readIdempotencyKey(req);
        if (!rawKey) {
            if (idempotencyMode === 'required') {
                throw new HttpException(
                    {
                        code: BG3_ERROR_CODES.IDEMPOTENCY_BAD_KEY,
                        message:
                            'Idempotency-Key header is required for this write surface',
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }
            return handler();
        }

        let key: string;
        try {
            key = this.idempotency.requireValidKey(rawKey);
        } catch (err: any) {
            throw new HttpException(
                {
                    code: BG3_ERROR_CODES.IDEMPOTENCY_BAD_KEY,
                    message: err?.message ?? 'Idempotency-Key invalid',
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        try {
            return await this.idempotency.wrap<T>(
                {
                    key,
                    scope,
                    routeMethod,
                    routePath,
                    actorUserId: opts.actorUserId ?? null,
                    orgId: opts.orgId ?? null,
                    fingerprintSource: opts.fingerprintSource,
                },
                async () => {
                    const body = await handler();
                    return { statusCode: 200, body };
                },
            );
        } catch (err: any) {
            // Re-shape ONLY conflicts originating from the IdempotencyService
            // itself into BG3 structured codes. Conflicts thrown from inside
            // the wrapped handler (e.g. M42 service-layer MAINTENANCE_WINDOW_ACTIVE,
            // domain-level uniqueness collisions) must propagate unchanged so
            // their original `code`/`message` reach the client.
            const status = err?.status ?? err?.getStatus?.();
            const rawMsg: string = err?.response?.message ?? err?.message ?? '';
            const msg = typeof rawMsg === 'string' ? rawMsg : '';
            const isIdempotencyConflict =
                status === HttpStatus.CONFLICT &&
                (/^idempotency conflict$/i.test(msg) ||
                    /Idempotency-Key reused/i.test(msg) ||
                    /different request payload/i.test(msg) ||
                    /^Idempotent request already in flight$/i.test(msg));
            if (isIdempotencyConflict) {
                const inFlight = /in.?flight/i.test(msg);
                throw new HttpException(
                    {
                        code: inFlight
                            ? BG3_ERROR_CODES.IDEMPOTENCY_IN_FLIGHT
                            : BG3_ERROR_CODES.IDEMPOTENCY_CONFLICT,
                        message: msg,
                        scope,
                    },
                    HttpStatus.CONFLICT,
                );
            }
            throw err;
        }
    }
}
