import { apiRequest } from "@/lib/api/client";

type Page<T> = { data?: T[] | null; total?: number | null };

const PAGE = 500;

/**
 * Every open order in the branch. One page of 100 is not enough (the demo branch
 * has 135 open orders, and a tile built from a cut list lies), and paging by
 * offset is unsafe here: orders sort by createdAt, many share the same instant,
 * so a row can slip between pages. So: one large page, more only if `total` says
 * so, and every row de-duplicated by id.
 */
export async function loadAllActiveOrders<T extends { id: string }>(token: string, branchId: string): Promise<T[]> {
  return loadOrders<T>(token, branchId, "excludeStatus=CLOSED,VOIDED");
}

/** All orders matching `query`, in pages of 500, de-duplicated by id (at most 10 pages). */
export async function loadOrders<T extends { id: string }>(token: string, branchId: string, query: string): Promise<T[]> {
  const byId = new Map<string, T>();
  for (let page = 1; page <= 10; page += 1) {
    const res = await apiRequest<Page<T>>(`/api/pos/orders?${query}&pageSize=${PAGE}&page=${page}`, { token, branchId });
    const rows = res.data ?? [];
    for (const r of rows) byId.set(r.id, r);
    if (rows.length < PAGE || (typeof res.total === "number" && byId.size >= res.total)) break;
  }
  return [...byId.values()];
}
