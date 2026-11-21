import { Prisma } from '@prisma/client';

/**
 * Allocates the next `ORD-xxxxxx` number for a branch inside an open transaction.
 *
 * Event quick sales only (H1). The legacy `OrdersService.generateOrderNumber` stays as it
 * is for the restaurant flow. Two tills selling at once used to read the same "latest"
 * number; here a transaction-scoped advisory lock keyed on the branch serialises
 * allocation, and the highest existing number is read with MAX over the numeric part
 * (not "latest by created_at"), so odd historic numbers cannot reset the counter.
 *
 * The lock is released at commit or rollback. A legacy writer does not take it, so the
 * caller must still handle a unique violation on (branch_id, order_number) by retrying.
 */
export async function allocateOrderNumber(
  tx: Prisma.TransactionClient,
  branchId: string,
): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${branchId}))`;
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(order_number FROM '^ORD-([0-9]+)$') AS INTEGER)) AS max
    FROM orders
    WHERE branch_id = ${branchId}`;
  const next = (rows[0]?.max ?? 0) + 1;
  return `ORD-${String(next).padStart(6, '0')}`;
}
