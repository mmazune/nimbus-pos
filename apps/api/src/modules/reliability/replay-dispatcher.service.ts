import { Injectable, Logger } from '@nestjs/common';
import { SyncJobTypeT } from './dto';

export type ReplayDisposition =
    | 'RETRYABLE'
    | 'PERMANENT_FAILURE'
    | 'CONFLICT'
    | 'DUPLICATE_SUPPRESSED';

export interface ReplayContext {
    orgId: string;
    branchId?: string | null;
    actorUserId?: string | null;
    idempotencyKey?: string | null;
    requestBody: Record<string, unknown>;
    requestHeaders?: Record<string, unknown> | null;
    intentSummary?: string | null;
}

export interface ReplayOutcome {
    ok: boolean;
    disposition: ReplayDisposition;
    /** Reference to the resulting domain entity (e.g. `Order:abc`). */
    resultRef?: string;
    /** Structured summary suitable for storage on SyncJob.resultSummary. */
    resultSummary?: Record<string, unknown>;
    /** Human-readable error if !ok. */
    error?: string;
    failureReason?: string;
    /** When disposition === 'CONFLICT', a server-side state snapshot to log. */
    serverState?: Record<string, unknown>;
    diffSummary?: string;
}

export type ReplayHandler = (ctx: ReplayContext) => Promise<ReplayOutcome>;

/**
 * Replay dispatcher.
 *
 * M41 ships a built-in `GENERIC_REPLAY` handler (echo-only, always succeeds)
 * so the contract is end-to-end testable from day one. Real domain handlers
 * (PAYMENT_CAPTURE, RESERVATION_CONFIRM, EVENT_BOOKING_CONFIRM, etc.) can be
 * registered by their owning modules during bootstrap via `register()`. This
 * keeps M41 from re-implementing business rules and guarantees that replay
 * always invokes the same domain service used by online requests.
 *
 * Note: by design, replay handlers MUST be idempotent. The SyncService
 * passes the captured Idempotency-Key through so domain services can
 * de-duplicate on their existing logic (e.g. PaymentIntent.idempotencyKey).
 */
@Injectable()
export class ReplayDispatcherService {
    private readonly logger = new Logger(ReplayDispatcherService.name);
    private readonly handlers = new Map<SyncJobTypeT, ReplayHandler>();

    constructor() {
        // Default echo handler — used by tests + Postman happy path.
        this.register('GENERIC_REPLAY', async (ctx) => ({
            ok: true,
            disposition: 'RETRYABLE',
            resultRef: `GENERIC_REPLAY:${ctx.idempotencyKey ?? 'no-key'}`,
            resultSummary: {
                echoed: true,
                receivedKeys: Object.keys(ctx.requestBody ?? {}),
            },
        }));
    }

    register(type: SyncJobTypeT, handler: ReplayHandler): void {
        this.handlers.set(type, handler);
    }

    has(type: SyncJobTypeT): boolean {
        return this.handlers.has(type);
    }

    async replay(type: SyncJobTypeT, ctx: ReplayContext): Promise<ReplayOutcome> {
        const handler = this.handlers.get(type);
        if (!handler) {
            return {
                ok: false,
                disposition: 'PERMANENT_FAILURE',
                error: `No replay handler registered for type ${type}`,
                failureReason: 'NO_HANDLER',
            };
        }
        try {
            return await handler(ctx);
        } catch (err: any) {
            this.logger.warn(`Replay handler ${type} threw: ${err?.message ?? err}`);
            const status = err?.status as number | undefined;
            const disposition: ReplayDisposition =
                status === 409
                    ? 'CONFLICT'
                    : status && status >= 400 && status < 500
                        ? 'PERMANENT_FAILURE'
                        : 'RETRYABLE';
            return {
                ok: false,
                disposition,
                error: err?.message ?? String(err),
                failureReason: err?.code ?? `HTTP_${status ?? '500'}`,
            };
        }
    }
}
