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
 * H1F: the MAX is over a NUMERIC expression that has its own index
 * (`orders_branch_id_order_number_numeric_idx`, migration 20261121100000), so the query
 * reads one row however many orders the branch holds while the lock is held. The
 * expression in the query must stay identical to the index's. NUMERIC cannot overflow, so
 * a branch whose highest number is above 2^31 still allocates, and past ORD-999999 the
 * number simply grows a digit. A number that is not `ORD-` plus digits gives NULL and is
 * ignored.
 *
 * The lock is released at commit or rollback. A legacy writer does not take it, so the
 * caller must still handle a unique violation on (branch_id, order_number) by retrying.
 */
export async function allocateOrderNumber(
  tx: Prisma.TransactionClient,
  branchId: string,
): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${branchId}))`;
  const rows = await tx.$queryRaw<{ max: string | null }[]>`
    SELECT MAX(CAST(SUBSTRING(order_number FROM '^ORD-([0-9]+)$') AS NUMERIC))::text AS max
    FROM orders
    WHERE branch_id = ${branchId}`;
  // BigInt, never Number: no float arithmetic on an order counter either.
  const next = BigInt(rows[0]?.max ?? '0') + BigInt(1);
  return `ORD-${next.toString().padStart(6, '0')}`;
}
