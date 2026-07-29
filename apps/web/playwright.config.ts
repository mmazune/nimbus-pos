import { defineConfig, devices } from "@playwright/test";

/**
 * Prompt 3D — Supervisor Reconstruction browser QA.
 *
 * Runs against an ISOLATED stack (local QA Postgres + API on :4001 + web on :3100).
 * Credentials and base URLs come from env (no hard-coded secrets); the defaults
 * below target the disposable local demo only.
 *
 *   PW_BASE_URL   web app under test   (default http://localhost:3100)
 *   PW_API_URL    isolated API base    (default http://localhost:4001)
 *   PW_SUPERVISOR_EMAIL / PW_SUPERVISOR_PASSWORD  (default seeded demo supervisor)
 *   PW_WAITER_EMAIL / PW_WAITER_PASSWORD
 *   PW_CASHIER_EMAIL / PW_CASHIER_PASSWORD
 *   PW_BRANCH_ID  seeded demo branch   (default Tapas Downtown)
 *
 * Destructive specs create their own QA orders through the API, so they are
 * self-contained. workers=1 serialises them so shared table/order state is stable.
 */
const BASE_URL = process.env.PW_BASE_URL || "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.evidence/test-output",
  fullyParallel: false,
  workers: 1,
  forbidOnly: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    { name: "vp-1024x768", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
    { name: "vp-1366x768", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "vp-1440x900", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "vp-1920x1080", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
  ],
});
