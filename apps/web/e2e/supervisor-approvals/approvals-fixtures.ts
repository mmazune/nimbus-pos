import { expect, Page } from "@playwright/test";

import { CFG } from "../supervisor-prompt3/fixtures";

/**
 * Prompt 5B1 Approvals helpers. All destructive/mutation data is created against
 * the ISOLATED disposable stack only (the Prompt 4D fail-closed launcher). Fresh
 * orders carry no payment, so the discounts they anchor are cleanly approvable.
 */

async function apiLogin(role: "supervisor" | "waiter" | "cashier" = "supervisor"): Promise<string> {
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

async function orderSubtotal(token: string, orderId: string): Promise<number> {
  const o = await fetch(`${CFG.api}/api/pos/orders/${orderId}`, { headers: h(token) }).then((r) => r.json());
  return Number(o.subtotal ?? 0);
}

/**
 * Create an order whose subtotal exceeds the org discount threshold (default
 * 5000) and request a discount that therefore stays PENDING — anchored to a
 * fresh, unpaid order and requested by the Supervisor (so self-approval copy
 * shows). Returns the pending discount id + its order id.
 */
export async function apiCreatePendingDiscount(): Promise<{ discountId: string; orderId: string }> {
  const token = await apiLogin("supervisor");
  const tableId = await pickAvailableTable(token);
  const order = await fetch(`${CFG.api}/api/pos/orders`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ serviceType: "DINE_IN", tableId }),
  }).then((r) => r.json());
  const orderId = order.id as string;

  // Add items until the subtotal comfortably exceeds the 5000 threshold.
  let subtotal = 0;
  for (let i = 0; i < 6 && subtotal <= 5000; i += 1) {
    await fetch(`${CFG.api}/api/pos/orders/${orderId}/items`, {
      method: "POST",
      headers: h(token),
      body: JSON.stringify({ menuItemId: CFG.menuItemId, menuItemServingId: CFG.servingStd, quantity: 3, notes: "P5B1-QA" }),
    });
    subtotal = await orderSubtotal(token, orderId);
  }

  // FIXED discount equal to the subtotal → amount = subtotal (> 5000) → PENDING.
  const discount = await fetch(`${CFG.api}/api/pos/orders/${orderId}/discounts`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ type: "FIXED", value: Math.max(5001, Math.floor(subtotal)), reason: "P5B1-QA pending discount" }),
  }).then((r) => r.json());

  return { discountId: discount.id as string, orderId };
}

/** First seeded (P5B2-QA) anomaly id currently in the given status, or null. */
export async function apiFirstAnomalyId(status: "OPEN" | "ACKNOWLEDGED"): Promise<string | null> {
  const token = await apiLogin("supervisor");
  const res = await fetch(`${CFG.api}/api/analytics/anomalies?status=${status}&limit=50`, { headers: h(token) }).then(
    (r) => r.json(),
  );
  const rows = (res?.data ?? []) as Array<{ id: string }>;
  const seeded = rows.find((r) => r.id.startsWith("p5b2qa-anom"));
  return (seeded ?? rows[0])?.id ?? null;
}

/** Deep-link straight to a specific approval's detail (deterministic, no queue navigation). */
export async function openApprovalDetail(page: Page, domain: string, id: string) {
  await page.goto(`/supervisor/approvals?domain=${domain}&selDomain=${domain}&selId=${id}`);
  // The detail only mounts once the bounded needs-action query resolves — give the (possibly
  // cold-starting) query headroom before asserting the workspace opened.
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.getByRole("button", { name: /back to list/i })).toBeVisible({ timeout: 45_000 });
}

/** Navigate to Approvals via the UI nav (not a hard goto) and wait for it to settle. */
export async function gotoApprovals(page: Page) {
  await page.goto("/supervisor/approvals");
  await expect(page).toHaveURL(/\/supervisor\/approvals/);
  await expect(page.getByRole("tab", { name: /needs action/i })).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Filter the queue to a domain by clicking its chip. */
export async function filterDomain(page: Page, label: RegExp) {
  await page.getByRole("button", { name: label }).click();
}

/** The queue list of clickable rows. */
export function queueRows(page: Page) {
  return page.getByRole("list", { name: /approval queue/i }).getByRole("button");
}

/**
 * Click through queue rows until the detail panel exposes a button matching `action`.
 * Returns true if found within `max` rows. Used to locate an OPEN anomaly (Acknowledge) or a
 * PENDING shift-swap (Reject) deterministically regardless of queue order.
 */
export async function selectRowWithAction(page: Page, action: RegExp, max = 8): Promise<boolean> {
  const rows = queueRows(page);
  const n = Math.min(await rows.count(), max);
  for (let i = 0; i < n; i += 1) {
    await rows.nth(i).click();
    const btn = page.getByRole("button", { name: action });
    if (await btn.count()) {
      try {
        await btn.first().waitFor({ state: "visible", timeout: 4000 });
        return true;
      } catch {
        /* keep scanning */
      }
    }
  }
  return false;
}
