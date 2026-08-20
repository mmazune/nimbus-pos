import { CFG } from "../supervisor-prompt3/fixtures";

/**
 * Cashier C3 QA helpers — payment / partial / split / close execution.
 *
 * These run against the ISOLATED API only (PW_API_URL). C3 specs execute REAL
 * money mutations, so a bill they settle is normally one they created themselves
 * and tagged `C3-QA-*`. Where the stack cannot mint a new order number (see
 * `adoptPayableBill`) they fall back to ADOPTING an unpaid payable bill from the
 * disposable QA database — never a shared/production database.
 */

const QA_TAG = `C3-QA-${Date.now()}`;

export async function apiLogin(role: "supervisor" | "cashier" | "waiter"): Promise<string> {
  const creds = CFG[role];
  const res = await fetch(`${CFG.api}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  const json = await res.json();
  return json.accessToken as string;
}

function h(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Branch-Id": CFG.branchId,
    "Content-Type": "application/json",
  };
}

async function pickTable(token: string): Promise<string> {
  const tables = (await fetch(`${CFG.api}/api/tables`, { headers: h(token) }).then((r) => r.json())) as Array<{
    id: string;
    status: string;
  }>;
  const free = tables.find((t) => String(t.status).toUpperCase() === "AVAILABLE");
  return free ? free.id : tables[0]?.id || CFG.availableTables[0];
}

export type C3Bill = {
  orderId: string;
  orderNumber: string;
  tableId: string;
  total: number;
  status: string;
};

const PAYABLE = new Set(["SENT", "IN_KITCHEN", "READY", "SERVED"]);

/**
 * Fallback for stacks where `POST /pos/orders` cannot mint a number.
 *
 * `OrdersService.generateOrderNumber` derives the next sequence from the newest
 * order's number via `/ORD-(\d+)/`. A branch-prefixed demo number
 * (`ORD-TAPAS_DOWNTOWN-00374`) does not match, so the generator falls back to
 * `ORD-000001` and the create fails with a unique-constraint 500 (recorded as a
 * C3 backend finding; NOT fixed in a frontend-only pass). When that happens we
 * adopt an existing payable bill from the disposable QA database instead of
 * skipping the settlement coverage entirely.
 */
async function adoptPayableBill(token: string, exclude: Set<string>): Promise<C3Bill | null> {
  const list = (await fetch(`${CFG.api}/api/pos/orders?pageSize=100&excludeStatus=NEW,CLOSED,VOIDED`, {
    headers: h(token),
  }).then((r) => r.json())) as { data?: Array<{ id: string; status?: string; tableId?: string | null }> };

  for (const candidate of list.data || []) {
    if (exclude.has(candidate.id)) continue;
    if (!candidate.tableId) continue;
    if (!PAYABLE.has(String(candidate.status || "").toUpperCase())) continue;

    const payments = await fetch(`${CFG.api}/api/pos/orders/${candidate.id}/payments`, { headers: h(token) }).then((r) =>
      r.json(),
    );
    // Only adopt a clean, wholly unpaid bill so amount assertions stay exact.
    if (Number(payments?.totalPaid || 0) !== 0) continue;

    for (const step of ["in-kitchen", "ready", "mark-served"]) {
      await fetch(`${CFG.api}/api/pos/orders/${candidate.id}/${step}`, {
        method: "POST",
        headers: h(token),
        body: JSON.stringify({}),
      });
    }
    const final = await fetch(`${CFG.api}/api/pos/orders/${candidate.id}`, { headers: h(token) }).then((r) => r.json());
    if (String(final?.status).toUpperCase() !== "SERVED") continue;
    adopted.add(final.id);
    return {
      orderId: final.id,
      orderNumber: final.orderNumber,
      tableId: final.tableId,
      total: Number(final.total),
      status: final.status,
    };
  }
  return null;
}

const adopted = new Set<string>();

/**
 * A DINE_IN bill advanced to **SERVED** — the only status the backend will close
 * (`CLOSABLE_STATES = ['SERVED']`). Returns null only when neither creating nor
 * adopting a bill is possible, so a caller can skip instead of asserting against
 * a half-built fixture.
 */
export async function apiCreateServedBill(quantity = 2): Promise<C3Bill | null> {
  const token = await apiLogin("supervisor");
  const tableId = await pickTable(token);
  const created = await fetch(`${CFG.api}/api/pos/orders`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ serviceType: "DINE_IN", tableId }),
  }).then((r) => r.json().catch(() => null));
  if (!created?.id) return adoptPayableBill(token, adopted);

  const itemRes = await fetch(`${CFG.api}/api/pos/orders/${created.id}/items`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({
      menuItemId: CFG.menuItemId,
      menuItemServingId: CFG.servingStd,
      quantity,
      notes: QA_TAG,
    }),
  });
  if (!itemRes.ok) return adoptPayableBill(token, adopted);

  for (const step of ["send", "in-kitchen", "ready", "mark-served"]) {
    const res = await fetch(`${CFG.api}/api/pos/orders/${created.id}/${step}`, {
      method: "POST",
      headers: h(token),
      body: JSON.stringify({}),
    });
    if (!res.ok) return adoptPayableBill(token, adopted);
  }

  const final = await fetch(`${CFG.api}/api/pos/orders/${created.id}`, { headers: h(token) }).then((r) => r.json());
  if (String(final?.status).toUpperCase() !== "SERVED") return adoptPayableBill(token, adopted);
  adopted.add(final.id);
  return {
    orderId: final.id,
    orderNumber: final.orderNumber,
    tableId,
    total: Number(final.total),
    status: final.status,
  };
}

/** Canonical order + payment state, read the way the settlement workspace reads it. */
export async function apiBillState(orderId: string) {
  const token = await apiLogin("cashier");
  const order = await fetch(`${CFG.api}/api/pos/orders/${orderId}`, { headers: h(token) }).then((r) => r.json());
  const payments = await fetch(`${CFG.api}/api/pos/orders/${orderId}/payments`, { headers: h(token) }).then((r) =>
    r.json(),
  );
  return {
    status: String(order?.status || "").toUpperCase(),
    total: String(order?.total ?? ""),
    totalPaid: String(payments?.totalPaid ?? ""),
    remainingBalance: String(payments?.remainingBalance ?? ""),
    isSettled: Boolean(payments?.isSettled),
    methods: (payments?.payments || []).map((p: { method: string; amount: string }) => `${p.method}:${p.amount}`),
    metadata: order?.metadata || null,
  };
}

/** Receipt existence for a closed bill (`receipt id == order id`). */
export async function apiReceiptStatus(orderId: string) {
  const token = await apiLogin("cashier");
  const res = await fetch(`${CFG.api}/api/receipts/${orderId}`, { headers: h(token) });
  return { status: res.status, body: res.ok ? await res.json() : null };
}

/**
 * The cashier settlement gates need an OPEN shift (and, for cash, an OPEN till
 * owned by this cashier). Both are cashier-owned and idempotent enough to make
 * safe here: an existing OPEN shift is reused, never re-opened.
 */
export async function apiEnsureCashierShift(): Promise<boolean> {
  const token = await apiLogin("cashier");
  const active = await fetch(`${CFG.api}/api/shifts/active`, { headers: h(token) }).then((r) =>
    r.json().catch(() => null),
  );
  if (active && String(active.status).toUpperCase() === "OPEN") return true;
  const res = await fetch(`${CFG.api}/api/shifts/open`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ notes: QA_TAG }),
  });
  return res.ok;
}

export async function apiCashierTillActive(): Promise<boolean> {
  const token = await apiLogin("cashier");
  const till = await fetch(`${CFG.api}/api/tills/active`, { headers: h(token) }).then((r) => r.json().catch(() => null));
  return Boolean(till && String(till.status).toUpperCase() === "OPEN");
}
