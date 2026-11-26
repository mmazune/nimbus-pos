import { apiRequest } from "@/lib/api/client";

type Page<T> = { data?: T[] | null; total?: number | null };

/**
 * Every open order in the branch, page by page. One page of 100 is not enough:
 * the demo branch has 135 open orders, and a tile built from a cut list lies.
 * Stops at the server's `total`, or at a short page, or after 20 pages.
 */
export async function loadAllActiveOrders<T>(token: string, branchId: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await apiRequest<Page<T>>(
      `/api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100&page=${page}`,
      { token, branchId },
    );
    const rows = res.data ?? [];
    out.push(...rows);
    if (rows.length < 100 || (typeof res.total === "number" && out.length >= res.total)) break;
  }
  return out;
}
