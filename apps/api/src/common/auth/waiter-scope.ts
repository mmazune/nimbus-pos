/**
 * Waiter MVP scope helpers.
 *
 * The waiter role gets ordinary POS permissions (e.g. `pos:orders:write`)
 * but the MVP business rules constrain how a waiter can use them:
 *
 *   - waiter cannot read/mutate another waiter's order (ownership rule)
 *   - waiter cannot drive kitchen-side state transitions
 *   - waiter operational writes require an OPEN shift on the active branch
 *
 * Owners, managers and cashiers keep their existing overrides — these
 * helpers ONLY tighten behaviour when the actor is exclusively a waiter.
 */

export interface ActorLike {
    id: string;
    roles?: Array<{ jobRole?: string | null } | null | undefined> | null;
}

/**
 * Returns true when the user's only assigned job role is WAITER.
 * Hybrid roles (e.g. Waiter + Cashier) are not treated as waiter-only.
 */
export function isWaiterOnly(user: ActorLike | null | undefined): boolean {
    const roles = user?.roles ?? [];
    if (!roles.length) return false;
    return roles.every((r) => (r?.jobRole ?? null) === 'WAITER');
}

/**
 * Throws 403 ORDER_NOT_OWNED_BY_WAITER if the actor is waiter-only and
 * does not own the order. Returns silently otherwise.
 */
export function assertWaiterOrderOwnership(
    user: ActorLike,
    order: { userId: string | null | undefined },
): void {
    if (!isWaiterOnly(user)) return;
    if (order.userId && order.userId === user.id) return;
    // Use lazy import to avoid Nest core coupling in unit-test surface.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ForbiddenException } = require('@nestjs/common');
    throw new ForbiddenException({
        code: 'ORDER_NOT_OWNED_BY_WAITER',
        message: 'Waiter cannot access another waiter’s order',
    });
}

/**
 * Order state transitions a waiter is allowed to drive directly.
 * SEND + MARK_SERVED are explicitly waiter-safe; everything else
 * (IN_KITCHEN, READY, VOID, CLOSE) is kitchen/cashier scope.
 */
const WAITER_SAFE_TRANSITIONS = new Set(['SENT', 'SERVED']);

export function assertWaiterTransitionAllowed(
    user: ActorLike,
    targetStatus: string,
): void {
    if (!isWaiterOnly(user)) return;
    if (WAITER_SAFE_TRANSITIONS.has(targetStatus)) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ForbiddenException } = require('@nestjs/common');
    throw new ForbiddenException({
        code: 'ORDER_TRANSITION_NOT_WAITER_SAFE',
        message: `Waiter cannot transition order to ${targetStatus}`,
    });
}
