# A2 Front-end audit: Nimbus POS (read-only, 2026-11-18)

Repo: `$HOME/mnt/Nimbus/POS` (git HEAD dbb5e25 "PERMS-2 Manager full accounting access"; 127 uncommitted changes in working tree, incl. CLAUDE.md, PROGRESS.md, AI_STATUS.md). All paths below relative to repo unless stated. Only read commands run. No .env opened.

## 0. Headline findings
- There is exactly ONE real front-end: `apps/web` (Next.js 14 Pages Router). `Front End/` contains ONLY documentation packs (zips + md), no code.
- `apps/mobile` and `apps/desktop` are empty stubs: `"dev": "echo \"Mobile app not yet scaffolded\""` (apps/mobile/package.json, apps/desktop/package.json).
- `demo-deploy/` and `pilot-deploy/` are NOT Nimbus POS. Both are `"name": "nimbus-hms"` (hotel/rental management for Eden Lawns, Salama Springs, Ihunde). They contain no POS deployment.
- Roles built in UI: waiter, cashier, supervisor, manager (+ manager accounting). NO owner, accountant, kitchen/bar display, customer display, platform-admin UI.
- Cashier cannot create orders. A counter/quick-sale (no table) flow does not exist in the UI.
- Payment screen has Cash / Card reference / MTN / Airtel / Bank transfer. No card-type (Visa/Mastercard) field anywhere in web code.
- No printing (print is metadata-only), no digital receipt delivery (pending stub).
- No menu management screens in `apps/web`. No offline support (no service worker).

## 1. Front-end apps
| App | Path | Framework / versions | Run / build | Status |
|---|---|---|---|---|
| Web (all roles) | `apps/web` | Next 14 (`"next": "14"`, eslint-config-next 14.2.23), React 18, Tailwind 3.4.17, @tanstack/react-query ^5.101, @phosphor-icons/react, Inter variable font; Playwright ^1.62 for e2e. **Pages Router** (`src/pages`, no `src/app`) | `pnpm --filter @nimbus-pos/web dev` (`next dev -p 3000`), `build` = `next build`, `typecheck`, `lint`; `test` = `echo "No frontend tests yet"` (apps/web/package.json, apps/web/README.md:17-20). Root `package.json` has `dev:api` only, no root web script | Real |
| Mobile | `apps/mobile` | none | echo stub | Not scaffolded |
| Desktop | `apps/desktop` | none | echo stub | Not scaffolded |

- Monorepo: pnpm 8.15 + turbo, node >=22 (package.json). Root `build` = `turbo run build`.
- API base URL: `apps/web/src/lib/api/client.ts` `normalizeApiBaseUrl`: `process.env.NEXT_PUBLIC_API_BASE_URL` default `http://localhost:3001`, trailing `/api` stripped; calls go to `/api/...`. `apps/web/README.md:40` documents `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` and `NEXT_PUBLIC_DEFAULT_BRANCH_ID` (optional, Quick PIN terminals). API needs `API_CORS_ORIGINS` to include web origin (README:49). Because it is `NEXT_PUBLIC_`, it is baked at build time.
- No `next.config` rewrites/standalone/output setting (apps/web/next.config.mjs only `reactStrictMode` + icon modularizeImports).
- PWA: manifest only (`apps/web/public/brand/manifest.webmanifest`, `display: standalone`, icons 192/512/maskable, linked in `src/pages/_app.tsx:24`). NO service worker, no IndexedDB, no offline queue in web code (grep for serviceWorker/indexedDB/offline in `apps/web/src` returned nothing). API side has an offline-replay contract (`docs/SYNC_CONTRACT.md`, M41) but no client consumes it. Install-to-home-screen would work; offline would not.
- Auth: `src/pages/login.tsx`. Two modes `LoginMode = "pin" | "password"`, default "pin". PIN keypad, PIN must be 6 or 8 digits (login.tsx:97). Quick PIN login needs a **Branch ID** typed/pre-filled (login.tsx ~353; `loginWithPin(branchId, pin)`; README:53 `POST /api/auth/quick-pin-login` body `{ branchId, pin, platform: "POS_DESKTOP" }`). Branch remembered in localStorage (login.tsx:162). Idle logout handlers per role (`components/*/shell/*IdleLogoutHandler.tsx`, `components/pos-shell/idle.ts`). Token handling `src/lib/auth/token-storage.ts`.
- Role gating is by JWT role: `src/lib/auth/role.ts` defines only `isWaiterCompatible`, `isCashierCompatible`, `isSupervisorCompatible`, `isManagerCompatible`. No owner/accountant helper.
- Root `/` redirects to `/login` (src/pages/index.tsx).
- Tests: Playwright e2e dirs `apps/web/e2e/{cashier-floor,manager-accounting,manager-dashboard,manager-operations,manager-reports,manager-shell,manager-staff,supervisor-approvals,supervisor-prompt3,supervisor-reservations}`; no waiter e2e dir listed. Viewports in `apps/web/playwright.config.ts:61-64`: 1024x768, 1366x768, 1440x900, 1920x1080 (all "Desktop Chrome"; no phone or portrait-tablet project).

## 2. Role surfaces and status
Sources of status: `docs/ROLE_JOURNEYS.md`, `ai/AI_STATUS.md`, `ai/ENTERPRISE_UI_ROADMAP.md`, `PROGRESS.md`, `ROADMAP.md`. Route list from `find apps/web/src/pages`.

| Role | Routes that exist | Documented status |
|---|---|---|
| Waiter | `/waiter` (redirect), `/waiter/floor`, `/waiter/orders`, `/waiter/orders/new`, `/waiter/orders/[orderId]`, `/waiter/reservations`, `/waiter/me` | Described as the "desktop-first Nimbus POS waiter MVP" (apps/web/README.md:3). Newman collection `_newman_waiter_mvp.json` exists. UNKNOWN: single explicit "Waiter complete" status line was not found in the greps run |
| Cashier | `/cashier` (redirect to `/cashier/floor`), `/cashier/floor`, `/cashier/till`, `/cashier/me`; hidden legacy `/cashier/queue`, `/cashier/receipts` (direct URL only) | AI_STATUS.md:1220 "CASHIER FLOOR-FIRST RECONSTRUCTION — PROMPT C3 COMPLETE (2026-08-20) — A. C3 COMPLETE / READY FOR C4. Frontend-only..." Roadmap row: "C4 -> C6 Cashier receipts/refunds -> Queue retirement -> closure QA ... C4 gated on explicit authorization". ROLE_JOURNEYS.md: payment/close execution "arrives C3" (done). Known limits docs/KNOWN_LIMITATIONS.md: "LIM-006 Paid-in/out/pickup deferred.", "LIM-010 Transfer server deferred." |
| Supervisor | `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, `/supervisor/approvals`, `/supervisor/me` | AI_STATUS.md:1466 "SUPERVISOR RECONSTRUCTION FINAL CLOSURE — B. COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY". ROLE_JOURNEYS.md: "Shift-swap offers Reject only ... (Outcome C)" |
| Manager | `/manager` (index), `/manager/overview`, `/manager/operations/{index,orders,tables,reservations}`, `/manager/staff/{index,directory,invitations,leave,onboarding,quick-pin,shift-swaps}`, `/manager/reports/{index,catalog,runs}`, `/manager/settings`, `/manager/me`, plus 30 accounting pages under `/manager/accounting/*` (dashboard, journals, bank/{accounts,statements,reconciliation}, closing/{fiscal-periods,period-close-runs}, configuration/{chart-of-accounts,cost-centres,posting-source-maps,tax-config}, customers/{accounts,credit-notes,invoices}, vendors/{bills,credit-notes,payments,recurring,reminders,suppliers}, reporting/{aged-payable,aged-receivable,budgets,demand-calendar,forecast}, review/{audit-trail,posting-errors,posting-runs}) | PROGRESS.md:3 "ENTERPRISE UI TRACK B6 COMPLETE — Manager Settings, Staff Onboarding, and Credential Management (2026-08-22)". "Track B6.6, B5.7's own remaining scope, and B7 are NOT started." ENTERPRISE_UI_ROADMAP B2 "COMPLETE (2026-08-20)", B3 "COMPLETE", B4 "COMPLETE ... CSV-only export" |
| Owner | NONE | ENTERPRISE_UI_ROADMAP.md table: "B7 Owner dashboard variant — same shell, wider scope ... Needs OD-1". PROGRESS.md: "B7 ... NOT started". ENTERPRISE_UI_ROADMAP "Explicitly absent, with no menu entry and no path: Owner/Admin settings, SaaS billing" and assertion "no owner / billing / franchise / developer route". Backend has `GET /api/dash/owner` gated by `pos:dash:owner:read` (ROADMAP B2 notes) but no UI |
| Accountant | NONE as a role. Accounting module exists inside Manager. | ENTERPRISE_UI_ROADMAP OD-2: accounting module kept "self-contained so an Accountant role can later mount it behind its own allow-list". No `isAccountantCompatible`. Manager given full accounting access by decision PERMS-2 (commit dbb5e25) |
| Kitchen / bar display | NONE | ROADMAP.md:135 "M15 KDS + Station Routing + SLA Timers" (backend only: `GET /kds/tickets`, `PATCH /kds/tickets/:id/start`, `/ready`, `GET /stream/kds`). ROADMAP.md:2413 "M44 Frontend POS + KDS + Backoffice Vertical Screens" is the only UI plan. ENTERPRISE_UI_ROADMAP.md:582 lists KDS as out of scope for Manager. Web grep finds "kds" only in cashier/manager comments and types |
| Customer display | NONE | no mention found in web code. UNKNOWN in docs |
| Admin / platform | NONE | ENTERPRISE_UI_ROADMAP: "Owner/billing/franchise/developer surfaces of any kind" excluded. Backend M39 billing/dev-portal exists (Newman `_newman_M39.1...`) with no UI |

Manager accounting status: AI_STATUS.md says B5.1 to B5.5 done, B5.7 write pass partly done (Posting errors, Fiscal periods, Bank reconciliation, Journals reverse); AR/AP forms, journal create, posting replay deferred.

## 3. Cashier flow in detail
Nav: Floor / Till / Me only (`src/lib/cashier/routes.ts`; Queue and Receipts removed from nav, kept as hidden routes).

Login to paid order, as built:
1. `/login`, Quick PIN (6 or 8 digits) plus Branch ID. Lands on `/cashier/floor` (`getCashierLandingPath`, `lib/auth/role.ts`).
2. `/cashier/floor`: shared `OperationalFloor` table grid (`components/floor/*`, `components/cashier/floor/CashierFloorScreen.tsx`). Pick a table (`?tableId=`), or use **Find bill** (`CashierFindBillDialog.tsx`) to open a takeaway/tableless/closed bill by number (`?orderId=`; service types Dine-in / Takeaway, line 43-44).
3. Bill resolution: 0, 1 or many bills for the table (`CashierBillSelector`). Opens `CashierSettlementWorkspace` with `CashierSettlementActions` mounting `CashierPaymentPanel` (`components/cashier/checkout/`).
4. Pick method, enter amount, (reference for non-cash), submit. Cash goes through `closeCashierOrder` (final cash close, change due shown), other methods through `createCashierManualReferencePayment` (CashierPaymentPanel.tsx:99-140). Idempotency key built per action (`lib/cashier/idempotency.ts`).
5. Cash is blocked unless a till is open: `cashBlocked={readiness.till.status !== "active"}` (CashierPaymentPanel.tsx:196). Till opened on `/cashier/till`.

Counter / quick-sale mode: NO. Order creation in the web app exists only for waiters: `createDineInOrder(token, branchId, tableId)` posts `{ serviceType: "DINE_IN", tableId }` (`lib/waiter/order-api.ts:211-216`) and `WaiterNewOrderScreen` shows "Table required: Start a dine-in order from an available table" when no table is chosen. `WaiterOrderServiceType` type includes "TAKEAWAY" but no UI creates one. Cashier has no add-items or create-order UI (floor.tsx description: cashier settles bills only).

Tap count for "2 beers, cash" in the current UI (waiter creates, cashier settles, two people, two logins):
- Waiter: login (branch + 6-digit PIN, ~7 taps) -> Floor -> tap table -> Start order -> pick menu group/subgroup in 3-column builder -> tap beer tile (if one serving and no modifiers it adds qty 1 immediately, WaiterOrderBuilderScreen.tsx ~1223-1233; otherwise a configurator modal with quantity stepper) -> tap again or stepper for qty 2 -> Send order. Roughly 8-10 taps post-login, needs a free table.
- Cashier: Floor -> tap table (or Find bill) -> select bill if several -> Cash is default method (`useState("CASH")`, CashierPaymentPanel.tsx:49) -> enter/confirm amount -> submit. About 4-6 taps, needs an open till and the order must be in status SENT/IN_KITCHEN/READY/SERVED (`CASHIER_PAYABLE_STATUSES`, lib/cashier/order-state.ts:17).
- No single-screen "tap items then pay" path exists.

Payment method list (file:line). `apps/web/src/lib/cashier/payment-validation.ts:6-54` (`CASHIER_PAYMENT_METHODS`):
- `CASH` label "Cash", backendMethod CASH, requiresReference false, supportsPartial false (line 8-15)
- `CARD_REFERENCE` label "Card reference", backendMethod CARD, requiresReference true, caveat "STUB - no live acquirer/card-terminal traffic." (line 16-24)
- `MTN_REFERENCE` backendMethod MOMO provider MTN, caveat "CRITICAL - MTN/Airtel diner checkout pending provider confirmation. Record a manual reference only." (line 25-34)
- `AIRTEL_REFERENCE` backendMethod MOMO provider AIRTEL (line 35-44)
- `BANK_TRANSFER` backendMethod BANK_TRANSFER (line 45-54)

Selector UI: `apps/web/src/components/cashier/checkout/CashierPaymentMethodSelector.tsx:29-72`: 2-column grid of radio tiles, `min-h-[74px]`, icon + shortLabel + "Split tender" / "Final cash close" subtitle; Cash tile shows a "Till" badge when blocked (line 33, 64).

Reference field: `CashierManualReferenceFields.tsx:28-42` "Reference ID" text input (placeholder "External transaction ID"), optional "Payer phone" (+256...) and "Note". Required for all non-cash methods (`requiresReference: true`). NO card-type / card-brand control: grep for VISA/Mastercard/cardBrand/cardType in `apps/web/src` returns nothing. Card brand could only be typed into the free-text Note or Reference. Backend payment enum seen on the front end is CASH, CARD, MOMO, BANK_TRANSFER; `MOMO` covers MTN and Airtel together (ManagerPaymentMixCard.tsx comment: "the split does not exist server-side"). In schema search `packages/db/prisma` the only match for card brand terms is `billing-pesapal` spec (unrelated); backend audit is another agent's job.

## 4. Receipts
- Printing: none. `CashierReceiptCaveatBanner.tsx`: "Metadata only — no print-driver invocation ... Reprint records an audit request only. It does not claim a physical printer completed anything." No `window.print`, no `@media print`, no ESC/POS, no Bluetooth, no WebUSB in `apps/web/src`. Waiter README says a "printable receipt preview" drawer exists (apps/web/README.md:207, components/waiter/receipts/WaiterReceiptPreview.tsx).
- Digital: `CashierReceiptSendDialog.tsx` offers Email / SMS / WhatsApp (`CASHIER_RECEIPT_SEND_CHANNELS`, lib/cashier/receipt-validation.ts:7-11) but banner says "PENDING — no live email/SMS/WhatsApp adapter ... records a pending request only."
- Receipt screens: `/cashier/receipts` (hidden legacy route; list/drawer/reprint/send/history), waiter receipt drawer + bill action panel. Cashier refunds components exist (`components/cashier/refunds/*`) with approval threshold constant.

## 5. Manager dashboard and reports
- `/manager/overview`: 8 cards (`components/manager/dashboard/cards/`): SalesToday, OrdersToday, PaymentMix, OpenOrders, Approvals, LowStock, Coverage, Readiness. Hand-rolled SVG charts only (donut, small bar series) in `ManagerDashboardCharts.tsx`. Polled, 9 bounded reads (ENTERPRISE_UI_ROADMAP B2 complete line).
- Payment mix: `ManagerPaymentMixCard.tsx` donut from `GET /api/dash/payment-mix`: three method sums (CASH, CARD, MOMO) plus total. Today only, single branch. No Visa share, no card brand, no MTN vs Airtel split.
- `/manager/reports/{catalog,runs,index}`: generic form that generates one of 24 implemented reports (of a 37-entry catalog), shows summary, history, CSV export streamed from the API (`lib/manager/reports-api.ts:183-200`, format hard-coded "CSV", no PDF). Includes generators `PAYMENT_MIX`, `TOP_ITEMS` (takes a limit), `SALES_BY_CATEGORY`, `SALES_BY_HOUR`, `DAILY_SALES`, `SHIFT_END`, `CASH_VARIANCE`, `DISCOUNTS_SUMMARY`, `VOIDS_SUMMARY`, `REFUNDS_SUMMARY`, `EVENT_SUMMARY`, `STAFF_OPERATIONS` etc. (reports-catalog.ts:34-60). `MENU_ENGINEERING` is catalogued but has no generator ("posts to nothing at all").
- So sales-by-payment-method and top-items exist only as generate-then-view report runs (not live), not as brand/Visa views. No top-brands, no items-by-payment-method, no live auto-refreshing organiser dashboard, no multi-vendor view. Operations pages (`/manager/operations/orders|tables|reservations`) are read-only lists.

## 6. Menu management
- No menu management pages in `apps/web/src/pages` and no write calls to `/menu/*` outside waiter read calls (`getMenuCatalog` -> `GET /api/menu/catalog`, `GET /api/menu/navigation?activeOnly=true`, `getMenuItemConfiguration`). Menu is consumed read-only by the waiter order builder.
- Backend M-menu exists (ROADMAP.md:547 "Core menu management with category hierarchy, item lifecycle, SKU/plu, base pricing, tax categories, and sellability flags"); demo data import via `pnpm db:demo:import` (root package.json). No bulk-import UI, no image upload UI, no brand field in any web type (grep "brand" in cashier/waiter libs only hits Tailwind brand colors). Item images: the builder renders text tiles (PRODUCT.md:25 explicitly rejects "image-heavy restaurant catalog"). UNKNOWN whether the backend menu item has a brand field (backend agent).

## 7. Device fit
- Described as desktop-first: apps/web/README.md:3 "desktop-first Nimbus POS waiter MVP"; login posts `platform: "POS_DESKTOP"`; playwright viewports 1024x768 to 1920x1080 only.
- Waiter builder is a fixed 3-column grid `grid-cols-[160px_minmax(0,1fr)_360px] xl:grid-cols-[180px_minmax(0,1fr)_400px]` (WaiterOrderBuilderScreen.tsx:1457). That needs roughly 1000px+ width: usable on landscape tablet, unusable on a phone.
- Viewport meta present (`_app.tsx:36`). Responsive utility classes are sparse: 24 `sm:/md:/lg:` occurrences across cashier+waiter components. There is a `*BottomNav` per role and 44-74px touch targets (`min-h-11`, `min-h-[74px]`), and docs mention "four viewports" QA, but all are desktop sizes.
- Manager UI is explicitly a desktop Odoo-style top-nav.
- Verdict: tablet landscape (>=1024px) plausible; phone not designed for.

## 8. Deployment
- POS web: no Dockerfile, no docker-compose, no vercel.json in the POS repo (`find -maxdepth 3`). README says DB is Neon Postgres, API at `http://localhost:3001/api`. Live URLs for POS: UNKNOWN (none stated in README/AGENTS/PRODUCT greps).
- CI: `.github/workflows/branch-validation.yml` only: on push to `milestone/**`, `feature/**`, `fix/**` and PRs to main/master: job `validate` (pnpm 8, node 22, install, `pnpm db:generate`, `pnpm lint`, API unit tests) and job `e2e` (PRs, needs DB secrets). No web build/typecheck step, no deploy step.
- `demo-deploy/` and `pilot-deploy/`: Next.js app named `nimbus-hms` with Prisma, `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.caddy.yml`, `Caddyfile` (placeholder `app.example.com` -> `nimbus-production-app:3000`, `staging.example.com`), `vercel.json` (pilot: region fra1, daily cron `/api/ttlock/cron`), `scripts/backup.sh`, many `p14..p30` walkthrough scripts. README: pilot = "Vercel + Neon", Vercel runs `vercel-build` (`prisma migrate deploy` then `next build`). These are the hotel product's templates; they could serve as a pattern (Caddy + compose on a VPS) but contain nothing for POS.

## 9. Design system (5 lines)
1. Tokens: CSS variables in `apps/web/src/styles/globals.css` (brand navy 950 `#000024`, 900 `#000033`, 800 `#1E1E52`, white, silver `#B3B4AF`, graphite `#6B6B6B`, status success/warning/danger/info, `chart-series-*`), mapped in `apps/web/tailwind.config.ts`.
2. UI kit: `apps/web/src/components/ui/` (Button, Card, Input, SearchInput, Badge, StatusBadge, StatusMessage, EmptyState, ErrorState, BlockedState, LoadingState, Skeleton, IconButton, PageShell) plus shared shell `components/pos-shell/*` and shared `components/floor/*`.
3. Brand: `docs/BRAND_IDENTITY.md` (Aug 2026, designer Andimashimwe Rhoda; "control, confidence, calm, and stability"); PDF at repo root `Nimbus_Pos_Brand_Identity (1).pdf`; assets `apps/web/public/brand/*`.
4. `docs/UI_SYSTEM.md`: one shared operational UI for Waiter/Cashier/Supervisor/Manager, shared-first (no forks), global density mechanism, fullscreen login; `PRODUCT.md` forbids "generic admin template ... image-heavy restaurant catalog".
5. Font Inter variable (bundled), icons Phosphor, Playwright assertion scripts enforce tokens/no-write affordances.

## 10. Gaps for the concert use case (facts only)
1. No counter / quick-sale ordering. Orders are created only by waiter on a table: `apps/web/src/lib/waiter/order-api.ts:211-216`, `components/waiter/orders/WaiterNewOrderScreen.tsx`. Cashier has no item entry: `components/cashier/floor/*`.
2. No card type (Visa/Mastercard/Other) on payment: `lib/cashier/payment-validation.ts:6-54`, `components/cashier/checkout/CashierManualReferenceFields.tsx`. Card is a "Card reference" free-text ID, flagged STUB; backend method enum has only CARD.
3. Card reference is mandatory (`requiresReference: true`, payment-validation.ts:21), so a cashier must type a terminal reference on every card sale. Speed cost.
4. Dashboard has no Visa share, items-by-payment, top brands, vendor split or live refresh: `components/manager/dashboard/cards/ManagerPaymentMixCard.tsx` (CASH/CARD/MOMO only), reports are generate-then-view (`lib/manager/reports-catalog.ts`). No brand concept in web types.
5. No Owner or Accountant UI; the organiser has no role to log into except Manager (B7 NOT started: PROGRESS.md, ai/ENTERPRISE_UI_ROADMAP.md).
6. Two vendors (food, drinks) need separate menus, tills, and reports. Web has branch context only (`useAuth().branchId`, login Branch ID field); no vendor/stall/station scoping in UI. UNKNOWN whether backend can model it.
7. Cash needs an open till per cashier (`CashierPaymentPanel.tsx:196`, `/cashier/till`); with 6-10 tills each needs opening float setup and reconcile.
8. Quick PIN login requires typing/pre-seeding Branch ID (`pages/login.tsx:87,353`; `NEXT_PUBLIC_DEFAULT_BRANCH_ID` is the shortcut) and 6 or 8-digit PINs (login.tsx:97). Staff PINs created in `/manager/staff/quick-pin`.
9. No offline mode or service worker (no `sw` in `apps/web`): concert Wi-Fi/4G drop stops sales. Backend sync contract exists (`docs/SYNC_CONTRACT.md`) but no client.
10. No receipt printing or delivery: `CashierReceiptCaveatBanner.tsx` ("Metadata only", "PENDING"). Customers get nothing physical or digital.
11. Phone UI not supported: fixed 3-column builder `WaiterOrderBuilderScreen.tsx:1457`; e2e viewports desktop only (`apps/web/playwright.config.ts:61-64`); README "desktop-first".
12. No menu admin UI (create items/categories/images/bulk import): no `/manager/menu` page. Menu would have to be loaded via backend import scripts (`pnpm db:demo:import`) or API.
13. No hosting setup for POS web/API (no Dockerfile/compose/vercel.json in POS repo); `NEXT_PUBLIC_API_BASE_URL` baked at build; API must allow the web origin in `API_CORS_ORIGINS`. CI does not build web (`.github/workflows/branch-validation.yml`).
14. Cashier pays only orders in SENT/IN_KITCHEN/READY/SERVED (`lib/cashier/order-state.ts:17`), so a paid-at-counter flow needs a send step that then requires waiter-side access; waiter ownership rule blocks other waiters (`WaiterOwnershipBlockedPanel`).
15. Mobile money is manual reference only (MTN/Airtel caveat "pending provider confirmation"); no live gateway. This matches the concert ask (record only) but no split by provider in dashboard.
16. Uncommitted work: 127 changed files in working tree (git status --short | wc -l); stability of HEAD vs working copy unknown.
