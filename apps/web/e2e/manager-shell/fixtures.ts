import { Page } from "@playwright/test";

/**
 * Manager M-P1 fixtures. Credentials are env-first and default to the seeded
 * disposable demo account only — no secret is hard-coded beyond the demo values
 * already used by `e2e/supervisor-prompt3/fixtures.ts`.
 */
export const MANAGER_CFG = {
  api: process.env.PW_API_URL || "http://localhost:4001",
  email: process.env.PW_MANAGER_EMAIL || "manager@nimbus.demo",
  password: process.env.PW_MANAGER_PASSWORD || "Demo1234!",
  /** Tapas Downtown — the seeded manager's default branch. */
  defaultBranchId: process.env.PW_BRANCH_ID || "cb27be401a2c35dfc0d4e610",
  /** Rooftop Bar — a second ACTIVE membership, used to prove re-scoping. */
  secondBranchId: process.env.PW_MANAGER_SECOND_BRANCH_ID || "c1f953ca4a21f8e0ba97abdd",
  expectedBranchNames: ["Tapas Downtown", "Rooftop Bar", "Garden Cafe", "Events Kitchen"],
};

/**
 * Track B5.1 (2026-08-21): Accounting joins as the seventh module (OD-3,
 * owner-approved). The M-P1 six-tab lock governed the bottom-nav presentation,
 * which D-MGRTOPNAV superseded.
 */
export const MANAGER_TABS = [
  "Overview",
  "Operations",
  "Staff",
  "Reports",
  "Accounting",
  "Settings",
  "Me",
] as const;

export const MANAGER_BRANCH_STORAGE_KEY = "nimbus.managerBranchId";

/** Drives the real login form in password mode, exactly like the shared role fixture. */
export async function managerLogin(page: Page) {
  await page.goto("/login").catch(() => {});
  await page
    .evaluate(() => {
      try {
        window.localStorage.clear();
      } catch {
        // storage access can be restricted in some contexts
      }
    })
    .catch(() => {});
  await page.goto("/login");
  await page.getByRole("button", { name: /^email$/i }).click();
  await page.locator('input[name="email"]').fill(MANAGER_CFG.email);
  await page.locator('input[name="password"]').fill(MANAGER_CFG.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

export function branchSwitcher(page: Page) {
  return page.locator('select[name="managerBranchId"]');
}

/**
 * The full desktop module bar (`role="menubar"`, per-menu click-to-open
 * dropdowns) only renders at `xl` (1280px) and up — below that, OD-4's
 * single collapsed "Menu" control takes over with a flat, already-expanded
 * tree (no per-item toggle). Specs about desktop dropdown MECHANICS
 * (roving tabindex, click-to-open, Escape/outside-click/route-change close)
 * are only meaningful at desktop widths; the collapse itself is proven
 * separately by the dedicated OD-4 spec in shell-parity.spec.ts, which
 * forces a sub-xl viewport regardless of the project's own size.
 */
export function isDesktopTopNavViewport(page: Page) {
  const size = page.viewportSize();
  return Boolean(size && size.width >= 1280);
}

/** Captures the X-Branch-Id header of every API request the page makes. */
export function captureBranchHeaders(page: Page) {
  const seen: Array<{ url: string; branchId: string | null }> = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!/\/api\//.test(url)) return;
    seen.push({ url, branchId: request.headers()["x-branch-id"] ?? null });
  });
  return seen;
}
