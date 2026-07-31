import { CFG } from "../supervisor-prompt3/fixtures";

/**
 * Cashier C2 QA helpers — self-contained synthetic bill creation against the
 * ISOLATED API only (PW_API_URL, default :4001). All records are tagged
 * `C2-QA-<timestamp>` and use synthetic references — never real guest PII.
 */

const QA_TAG = `C2-QA-${Date.now()}`;

async function apiLogin(role: "supervisor" | "cashier" | "waiter"): Promise<string> {
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

async function pickAvailableTable(token: string): Promise<string> {
  const tables = (await fetch(`${CFG.api}/api/tables`, { headers: h(token) }).then((r) => r.json())) as Array<{
    id: string;
    status: string;
  }>;
  const free = tables.find((t) => String(t.status).toUpperCase() === "AVAILABLE");
  return free ? free.id : CFG.availableTables[0];
}

async function addLineAndSend(token: string, orderId: string) {
  await fetch(`${CFG.api}/api/pos/orders/${orderId}/items`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({
      menuItemId: CFG.menuItemId,
      menuItemServingId: CFG.servingStd,
      quantity: 2,
      notes: QA_TAG,
    }),
  });
  await fetch(`${CFG.api}/api/pos/orders/${orderId}/send`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({}),
  });
}

async function tableActiveOrderCount(token: string, tableId: string): Promise<number> {
  const res = (await fetch(
    `${CFG.api}/api/pos/orders?tableId=${tableId}&excludeStatus=CLOSED,VOIDED,CANCELLED&pageSize=10`,
    { headers: h(token) },
  ).then((r) => r.json())) as { data?: unknown[] };
  return (res.data || []).length;
}

/**
 * A DINE_IN bill on a table (no cleanliness guarantee). Callers that open the
 * bill by an explicit `orderId` do not care how many other bills the table has.
 */
export async function apiCreateBill(): Promise<{ orderId: string; tableId: string }> {
  const token = await apiLogin("supervisor");
  const tableId = await pickAvailableTable(token);
  const order = await fetch(`${CFG.api}/api/pos/orders`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ serviceType: "DINE_IN", tableId }),
  }).then((r) => r.json());
  await addLineAndSend(token, order.id);
  return { orderId: order.id as string, tableId };
}

const PAYABLE = new Set(["SENT", "IN_KITCHEN", "READY", "SERVED"]);

/**
 * Find an EXISTING table that already carries exactly ONE payable bill (for the
 * table→single auto-resolution path). Read-only and repeatable across viewport
 * projects — it does not consume the branch's scarce empty tables. Falls back to
 * creating a clean single-bill table; returns null only if neither is possible.
 */
export async function apiResolveSingleBillTable(): Promise<{ orderId: string; tableId: string } | null> {
  const token = await apiLogin("supervisor");
  const tables = (await fetch(`${CFG.api}/api/tables`, { headers: h(token) }).then((r) => r.json())) as Array<{
    id: string;
  }>;
  let zeroPayableTableId: string | null = null;
  for (const t of tables) {
    const res = (await fetch(`${CFG.api}/api/pos/orders?tableId=${t.id}&pageSize=50`, {
      headers: h(token),
    }).then((r) => r.json())) as { data?: Array<{ id: string; status?: string }> };
    const payable = (res.data || []).filter((o) => PAYABLE.has(String(o.status || "").toUpperCase()));
    // Read-only reuse: a table that already has exactly one payable bill.
    if (payable.length === 1) return { orderId: payable[0].id, tableId: t.id };
    if (payable.length === 0 && !zeroPayableTableId) zeroPayableTableId = t.id;
  }
  // Otherwise create exactly one payable bill on a table that currently has none
  // (occupancy is independent of payable bills in this demo branch).
  if (!zeroPayableTableId) return null;
  const order = await fetch(`${CFG.api}/api/pos/orders`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ serviceType: "DINE_IN", tableId: zeroPayableTableId }),
  }).then((r) => r.json());
  if (!order?.id) return null;
  await addLineAndSend(token, order.id);
  return { orderId: order.id as string, tableId: zeroPayableTableId };
}

/**
 * A DINE_IN table that carries EXACTLY ONE payable bill (for the table→single
 * auto-resolution path). Scans for a genuinely clean AVAILABLE table; returns
 * null when none is free so the caller can skip rather than fail spuriously.
 */
export async function apiCreateCleanSingleBillTable(): Promise<{ orderId: string; tableId: string } | null> {
  const token = await apiLogin("supervisor");
  const tables = (await fetch(`${CFG.api}/api/tables`, { headers: h(token) }).then((r) => r.json())) as Array<{
    id: string;
    status: string;
  }>;
  let cleanTableId: string | null = null;
  for (const t of tables) {
    if (String(t.status).toUpperCase() !== "AVAILABLE") continue;
    if ((await tableActiveOrderCount(token, t.id)) === 0) {
      cleanTableId = t.id;
      break;
    }
  }
  if (!cleanTableId) return null;
  const order = await fetch(`${CFG.api}/api/pos/orders`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ serviceType: "DINE_IN", tableId: cleanTableId }),
  }).then((r) => r.json());
  await addLineAndSend(token, order.id);
  return { orderId: order.id as string, tableId: cleanTableId };
}

/** A tableless TAKEAWAY payable (SENT) bill — no tableId. */
export async function apiCreateTakeawayBill(): Promise<{ orderId: string }> {
  const token = await apiLogin("supervisor");
  const order = await fetch(`${CFG.api}/api/pos/orders`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ serviceType: "TAKEAWAY" }),
  }).then((r) => r.json());
  await addLineAndSend(token, order.id);
  return { orderId: order.id as string };
}

/**
 * Best-effort: two payable (SENT) bills on the SAME table. Returns null if the
 * backend rejects a second concurrent order on one table (then the caller skips
 * the multiple-bill assertion).
 */
export async function apiTryCreateMultiBillTable(): Promise<{ tableId: string; orderIds: string[] } | null> {
  const token = await apiLogin("supervisor");
  const tableId = await pickAvailableTable(token);
  const orderIds: string[] = [];
  for (let i = 0; i < 2; i += 1) {
    const res = await fetch(`${CFG.api}/api/pos/orders`, {
      method: "POST",
      headers: h(token),
      body: JSON.stringify({ serviceType: "DINE_IN", tableId }),
    });
    if (!res.ok) break;
    const order = await res.json();
    if (!order?.id) break;
    await addLineAndSend(token, order.id);
    orderIds.push(order.id);
  }
  return orderIds.length >= 2 ? { tableId, orderIds } : null;
}
