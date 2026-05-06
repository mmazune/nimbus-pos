import type { WriteBlockCategoryT } from '../controlplane/dto';

/**
 * BG3 — write surface → maintenance category mapping.
 *
 * These constants are intentionally exported so tests, postman docs, and
 * the completion-report write-surface matrix all reference exactly the
 * same string the runtime uses.
 */
export const BG3_CATEGORY = {
    BILLING: 'BILLING_WRITES' as WriteBlockCategoryT,
    ACCOUNTING: 'ACCOUNTING_WRITES' as WriteBlockCategoryT,
    INVENTORY: 'INVENTORY_WRITES' as WriteBlockCategoryT,
    PUBLIC_BOOKING: 'PUBLIC_BOOKING_WRITES' as WriteBlockCategoryT,
    ADMIN: 'ADMIN_CONFIGURATION_WRITES' as WriteBlockCategoryT,
};

/** Marker shape attached to every training-mode simulated response body. */
export interface TrainingSimulationMarker {
    simulated: true;
    trainingSessionId: string;
    category: WriteBlockCategoryT;
    scope: string;
    note: string;
    simulatedAt: string;
}

/** Standard error code strings BG3 emits via HttpException bodies. */
export const BG3_ERROR_CODES = {
    IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
    IDEMPOTENCY_IN_FLIGHT: 'IDEMPOTENCY_IN_FLIGHT',
    IDEMPOTENCY_BAD_KEY: 'IDEMPOTENCY_KEY_INVALID',
    MAINTENANCE_BLOCKED: 'MAINTENANCE_WINDOW_BLOCKED',
} as const;
