# G2 Frontend build spec input: Nimbus POS Event Till (28 Nov 2026)

Source: branch rescued/main-2026-11-15 export at /sessions/rcw-016h54ooiszn9pzbzpezf9ht/pos-rescued (apps/web). Read-only. All paths below are relative to `apps/web/` unless prefixed `repo:` (repo root). Quotes are real; "UNKNOWN" = not determined.

## 1. App skeleton

**Providers** (`src/pages/_app.tsx:16-40`, `src/components/providers/AppProviders.tsx:12-34`): `NimbusApp` wraps `<AppProviders>` = `QueryClientProvider` > `AuthProvider` > `ToastProvider`. Pages Router, no `_document`, no `middleware.ts` (confirmed absent), so every guard is client-side.
```
AppProviders.tsx:18  gcTime: typeof window === "undefined" ? Infinity : 5 * 60_000,
AppProviders.tsx:19  refetchOnWindowFocus: false,
AppProviders.tsx:20  retry: shouldRetryApiRequest,
AppProviders.tsx:21  staleTime: 30_000,
```
No react-query persister, no `onlineManager` use.

**Token storage** (`src/lib/auth/token-storage.ts:3-4,13,23`): plain localStorage, keys `nimbus.accessToken`, `nimbus.refreshToken`. Branch id for the lock screen: `nimbus.stationBranchId` (`src/pages/login.tsx:31,163`). Terminal label: `nimbus.stationTerminalLabel` (default "Terminal 01") (`src/components/pos-shell/station.ts:11-29`). Manager branch: `MANAGER_BRANCH_STORAGE_KEY` (`src/lib/manager/branch-context.ts:65`).

**API client** (`src/lib/api/client.ts`):
```
:63   export const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);   // default http://localhost:3001, strips trailing /api
:136-152 headers: Accept, "X-Request-Id": createRequestId(), ...options.headers; Content-Type when body; 
         if (options.token) headers.Authorization = `Bearer ${options.token}`;
         if (options.branchId) headers["X-Branch-Id"] = options.branchId;
:156  const timeoutMs = options.timeoutMs ?? 30_000;
:170,179 throws ApiError code REQUEST_TIMEOUT / NETWORK_ERROR (status 0)
:53-56 shouldRetryApiRequest: no retry on 4xx, 1 retry otherwise
```
`ApiError.isAuthError` = 401/UNAUTHORIZED (`:44-46`). Callers pass `token` + `branchId` explicitly on every call (no interceptor). Idempotency pattern: `headers: { "Idempotency-Key": key }` (`src/lib/cashier/tills.ts:9-11`); key builders `src/lib/cashier/idempotency.ts`, `src/lib/pos-shell/idempotency.ts` (`createIdempotencyIntent`, `useIdempotencyIntent`).

**Token refresh: NONE in the web app.** `grep refresh` finds only the field being stored (`AuthProvider.tsx:36,55,224`, `token-storage.ts`); nothing calls `/api/auth/refresh`. The API has it (`repo: apps/api/src/modules/auth/auth.controller.ts:48`, rotating tokens; reuse of a revoked token revokes the whole family, `auth.service.ts:~215-222`). Access TTL default **15m** (`repo: apps/api/.env.example:16 JWT_ACCESS_TTL=15m`; `auth.service.ts:57`), refresh TTL 7d. A 401 makes `loadMe`/readiness call `clearSession()` (`AuthProvider.tsx:122-125`). Consequence: any till session dies about 15 min after login unless the API's TTL is raised or the client gains refresh logic. See Risks R1.

**Idle logout:** `OperationalIdleLogoutHandler` logs out after 15 min without mouse/key/touch/scroll events (`src/components/pos-shell/idle.ts:70`, `OperationalIdleLogoutHandler.tsx:17-33`, then `window.location.replace("/login?reason=idle_timeout")`). Injected via the shell's `idleHandler` slot (Cashier/Waiter/Manager shells). The Event Till must not mount it, or must raise it.

**Auth state** (`src/lib/auth/AuthProvider.tsx`): `loginWithPin(branchId, pin)` -> `POST /api/auth/quick-pin-login` body `{branchId, pin, platform: "POS_DESKTOP"}` (`auth-api.ts:14-19`); `loginWithPassword` -> `/api/auth/login`. Quick-PIN logins build an immediate session with `memberships: []` then call `/api/auth/me` in the background (`:59-81,140-151`). Role flags come from `src/lib/auth/role.ts`: `isWaiterCompatible`, `isCashierCompatible`, `isSupervisorCompatible`, `isManagerCompatible` (jobRole or role name). Exposed: `accessToken, branchId, branchName, currencyCode, organizationId, isCashier ...` (`:221-243`).

**Login page** (`src/pages/login.tsx`): tabs "Quick PIN" / "Email". PIN: branch text field (prefilled from `localStorage nimbus.stationBranchId`, else `NEXT_PUBLIC_DEFAULT_BRANCH_ID`, else hard-coded demo cuid `DEMO_BRANCH_ID = "cb27be401a2c35dfc0d4e610"`, "Tapas Downtown", `:30-33,100-108`) plus an on-screen 12-key keypad; **PIN must be 6 or 8 digits** (`:97`). Header chip reads "API: Local dev" (hard-coded, `:224`).
Landing per role (`:166-172`, `role.ts:78-88`): manager `/manager/overview`; supervisor `/supervisor/floor`; cashier `/cashier/floor`; waiter `/waiter/floor`. Anyone else is blocked:
```
login.tsx:154-158  if (!isWaiterUser && !isCashierUser && !isSupervisorUser && !isManagerUser) { clearSession(); setBlockedMessage("This frontend currently supports waiter, cashier, supervisor, and manager workspaces only.");
```
So owner/accountant accounts cannot get in at all. Redirect reasons handled: `idle_timeout, logged_out, session_required, waiter_only, cashier_only, supervisor_only, manager_only` (`:35-55`). A new guard reason would need a case here.

**Route guards** (per-role component, client-only, in each shell): `CashierSessionGuard` (`src/components/cashier/shell/CashierSessionGuard.tsx:12-85`): effect redirects `/login?reason=session_required` when no token; `!isCashier` -> BlockedState + `/login?reason=cashier_only`; `!branchId` -> BlockedState. Same pattern in `ManagerSessionGuard` (`src/components/manager/shell/ManagerSessionGuard.tsx:15-60`, uses selected manager branch) and Supervisor/Waiter guards. Every page has the wrapper:
```
src/pages/cashier/till.tsx:6-8  export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });
```
(GSSP stub on each page, a repo convention to avoid static prerender.) `/cashier/index` redirects to `/cashier/floor` via GSSP.
**How `/event/*` would be guarded:** write `EventSessionGuard` modelled on `CashierSessionGuard` but accepting `isCashier || isSupervisor || isManager` for the till and `isManager` (plus whichever organiser account type is created) for `/event/live`; add `event_only` to `getQueryReason`. Also add `/event/till` as a landing path for cashier accounts when `NEXT_PUBLIC_EVENT_MODE=1` (login.tsx landing ternary).

## 2. Shells and UI kit

**Shell** `src/components/pos-shell/OperationalShell.tsx:13-39`: fixed header (`z-40`), fixed readiness strip (`top-16 h-9`), `<main className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pt-[7.25rem] ...pb-[calc(5rem+env(safe-area-inset-bottom))]">`, fixed bottom nav; `navigation="top"` variant for manager. Per-role wrappers: `CashierShell` (`src/components/cashier/shell/CashierShell.tsx:101-115`: Guard > OperationalShell with `CashierHeader`, `CashierReadinessStrip`, `CashierBottomNav`, `CashierIdleLogoutHandler`), `WaiterShell`, `SupervisorShell`, `ManagerShell` (`ManagerBranchProvider` + `ManagerTopNav`). Nav arrays: `src/lib/{cashier,waiter,supervisor,manager}/routes.ts` (cashier = Floor/Till/Me; supervisor = Floor/Reservations/Approvals/Me; manager = Overview/Operations/Staff/Reports/Accounting/Settings/Me). Registry: `components/pos-shell/role-navigation.ts:80-88` is typed to four roles.
Event Till should NOT use OperationalShell as is: the 4rem header + 2.25rem strip + bottom nav eat roughly 170px of a landscape tablet. Use a bare `<main className="h-screen">` with a slim custom header (branch, till code, sync badge, clock via `CurrentTime`, logout via `useAuth().logout`).

**`components/ui` inventory** (`src/components/ui/index.ts`): Badge, BlockedState, Button, Card, EmptyState, ErrorState, IconButton, Input, LoadingState, PageShell, SearchInput, Skeleton, StatusBadge, StatusMessage. **There is no Dialog, Sheet, Select, Toggle or numeric keypad in `ui`.** Dialog = `components/pos-shell/ActionConfirmDialog.tsx` (modal with optional `reason` textarea and `managerPin` password input, focus trap-ish, Escape; `:23-43,169-190`). Toast = `components/providers/ToastProvider.tsx` (`useToast().showToast({tone,title,description,duration})`, max 3, bottom-24 right, dedupe 2s). Numeric keypad exists only inline in `src/pages/login.tsx:30,373-388` (12 `<button>` keys `h-11`), not extracted.
Button: `variant` primary|secondary|tertiary|inverse|danger; `size` compact `min-h-9` | standard `min-h-10` | pos `min-h-12`; active:scale-[0.96] (`Button.tsx:5-37`). Input `min-h-11` (`Input.tsx:10`).

**Tokens** (`src/styles/globals.css`): navy `--color-brand-navy-950:#000024`, `-900:#000033`, `-800:#1E1E52`, silver `#B3B4AF`; `--color-page-bg:#F6F7F9`, `--color-surface:#FFFFFF`, `--color-surface-muted:#ECECEC`, `--color-border-subtle:#E3E5E8`, `--color-text-primary:#101828`, `-secondary:#4B5563`, `-muted:#6B7280`; status success `#11774E`/surface `#EAF7F1`, warning `#8A6410`/`#FFF6DF`, danger `#B7384C`/`#FDECEF`, info `#2B69B2`/`#EAF2FF`; chart series 1-4 `#000033 #33356B #7C7EA3 #B3B4AF`, `--color-chart-track:#E3E5E8`; spacing `--space-1..12` in rem (0.25..3rem); radii xs 4, sm 8, md 12, lg 16, xl 20, 2xl 24 px; shadows `subtle/panel/overlay/focus`; `--ease-out: cubic-bezier(0.23,1,0.32,1)`.
**Density mechanism** (`globals.css`, `html { font-size: clamp(13.5px, calc(0.625vh + 9.25px), 16px) }`): rem sizes shrink on short viewports (a 800px-tall tablet = 14.25px root, so `min-h-12` = 45px). Tile targets must be set in rem with generous min sizes (>= 4rem), not px.
**Tailwind** (`tailwind.config.ts`): `content ./src/**/*.{ts,tsx}`, `extend` only (default breakpoints sm640/md768/lg1024/xl1280 intact), colours mapped to CSS vars incl. `role.*`, `chart.series-*`, `status.*`, `fontFamily.sans = "Inter Variable", Inter, system`. No plugins. **Icons:** `@phosphor-icons/react` via `modularizeImports` (`next.config.mjs`), registry `components/pos-shell/role-icon-config.ts` (`operationalIconSizes` 16/20/28; rule: choose glyphs there, "never import Phosphor" in route files, though the checkout selector imports it directly: `CashierPaymentMethodSelector.tsx:1`). **Font:** `@fontsource-variable/inter` (`_app.tsx:13`).

**Reuse candidates for the Event Till** (most are not exported; extract or copy):
| Need | Existing | Path |
|---|---|---|
| Menu tile | `MenuItemTile` (private fn, `min-h-[112px]`, name + price) | `components/waiter/orders/WaiterOrderBuilderScreen.tsx:579-609` |
| Qty stepper / cart line | `QuantityStepper` (private, 48px buttons), `OrderPanel` line markup | same file `:226-260`, `:611-760` |
| Payment method selector | `CashierPaymentMethodSelector` (radio tiles, icons, 2-col grid; method list is `CASHIER_PAYMENT_METHODS`, has no Visa/Mastercard split) | `components/cashier/checkout/CashierPaymentMethodSelector.tsx`; `lib/cashier/payment-validation.ts:6-54` |
| PIN pad | inline keypad (PIN_KEYS) | `pages/login.tsx:30,373-388`; password-type input in `ActionConfirmDialog.tsx:169-190` |
| Money formatter | `formatWaiterMoney` (`lib/waiter/formatters.ts:45-64`), re-exported as `formatMoney(value, currency="UGX")` in `lib/waiter/order-model.ts:187` | see section 3 |
| Confirm dialog | `ActionConfirmDialog` | `components/pos-shell/ActionConfirmDialog.tsx` |
| Toast / badges / cards | `useToast`, `Badge`, `Card`, `StatusMessage` | as above |
| Menu fetch | `loadWaiterMenuWorkspace` -> `GET /api/menu/navigation?activeOnly=true` + `GET /api/menu/catalog` | `lib/waiter/order-api.ts:307-326` |
| Till open/close | `openCashierTill`, `reconcileCashierTill`, `recordCashierSafeDrop` | `lib/cashier/tills.ts`; UI `components/cashier/till/*` |
| Shift open/close | `openCashierShift`, `closeCashierShift` | `lib/cashier/shifts.ts`; UI `components/cashier/me/CashierMeScreen.tsx:60-90` |
| Poll pattern | `refetchInterval: MANAGER_DASHBOARD_POLL_MS (60_000)` | `lib/manager/dashboard-context.ts:49,99` |
| Idempotency | `buildCashierIdempotencyKey`, `useIdempotencyIntent` | `lib/cashier/idempotency.ts`, `lib/pos-shell/idempotency.ts` |

## 3. Reusable logic (quotes)

**Money formatting handles UGX with zero decimals.** Waiter formatter (the canonical one per `docs/UI_SYSTEM.md` section 7):
```
lib/waiter/formatters.ts:10-25  const ZERO_FRACTION_CURRENCIES = new Set(["BIF",...,"RWF","UGX","VND",...]);
:45-63  export function formatWaiterMoney(value, currencyCode?, fallback="Pending") { ... new Intl.NumberFormat("en-US",{style:"currency",currency,currencyDisplay:"code",minimumFractionDigits:fractionDigits,maximumFractionDigits:fractionDigits}).format(value).replace(/ /g," ") }   // "UGX 20,000"
```
The cashier variant also renders integers without decimals but uses the browser locale (`lib/cashier/formatters.ts:16-36`, `Intl.NumberFormat(undefined, {style:"currency",currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2})`). Use the waiter one (fixed en-US, code display) for tablets.

**Cart / totals** (waiter builder; the cart is server-side order lines, not a client cart):
```
WaiterOrderBuilderScreen.tsx:126-149  function moneyNumber(value) {...}  function moneySnapshot(value:number){ return value.toFixed(2); }
  function withLineTotals(order) { const subtotal = (order.items||[]).reduce((sum,item)=> sum + moneyNumber(item.subtotal),0); const tax = moneyNumber(order.tax); const discount = moneyNumber(order.discount); return {...order, subtotal: moneySnapshot(subtotal), total: moneySnapshot(subtotal + tax - discount)}; }
```
Money is Decimal strings and JS floats here (`toFixed(2)`). For the Event Till, compute in integer UGX (no fractions), no tax line unless the API returns one. **No reusable client-side cart exists**; the Event Till needs its own small `Map<menuItemId, qty>` reducer.

**Cashier payment validation** (`lib/cashier/payment-validation.ts`):
```
:60-68  formatCashierAmountInput -> value.toFixed(2).replace(/\.00$/,""); cents(value) = Math.round(value*100)
:70-83  parseCashierPaymentAmount: /^\d+(\.\d{1,2})?$/ ; error "Amount must be greater than zero."
:157-159 if (amountCents !== undefined && method.id === "CASH" && amountCents !== outstandingCents) reasons.push("Partial cash is deferred because cash can only be recorded through final order close.");
:160-162 if (method.id === "CASH" && order.status !== "SERVED") reasons.push("Cash close is available only when the backend order status is Served.");
:163-165 if (method.requiresReference && !reference.trim()) reasons.push("Manual reference is required for this method.");
:104-120 mapCashierMutationError (IDEMPOTENCY_IN_FLIGHT, IDEMPOTENCY_KEY_PAYLOAD_MISMATCH, MAINTENANCE_WINDOW_*)
```
It is bound to an existing order (`CashierOrderViewModel`, shift/till readiness, SERVED status). It cannot be reused for quick sale; reuse only `getCashierPaymentMethod`-style config and the error mapper. Card/MoMo are "reference only, no live provider" (LIM-001/003) and "Card" is a single method (`backendMethod: "CARD"`), so Visa/Mastercard/Other must be a new `cardBrand` field on `quick-sale`. Cash change = `tendered - total` is not implemented anywhere (cash close forbids tender != outstanding).

**Supervisor approval / PIN:** the only PIN input is `ActionConfirmDialog`'s optional `managerPin` field (`:40,169-190`, `type="password" inputMode="numeric"`). Supervisor void in the UI is a normal order action: `lib/supervisor/order-actions.ts:206-213`:
```
void: { permission: "pos:orders:void", ... requiresManagerPin: false, // the /void endpoint accepts no manager PIN
```
`approveDiscount(..., managerPin?)` is optional and re-auths the approver (`lib/supervisor/orders.ts:573-587`). **No existing "supervisor PIN override on a till" flow.** Undo-last-sale by supervisor PIN needs a new API (verify PIN, return approver id) and a new component.

## 4. Offline

- **Confirmed none** in `src/`: grep for `serviceWorker|indexedDB|navigator.onLine|next-pwa|workbox|addEventListener("online"|offline` returns no code (only comments about "never persisted" in manager staff files). `package.json` has no next-pwa/workbox/idb/dexie. `next.config.mjs` is minimal (`reactStrictMode`, `modularizeImports`).
- **Manifest exists, no SW:** `public/brand/manifest.webmanifest` (name Nimbus POS, `display: standalone`, `start_url: "/"`, 192/512 icons) linked in `_app.tsx:24`. `start_url:"/"` redirects to /login (`pages/index.tsx` GSSP). Add-to-home-screen works; **offline load does not**: Next pages are server-rendered via GSSP, so a cold start with no network fails to load the shell.
- **localStorage use today:** only the keys listed in section 1.
- **No online/offline indicator** anywhere (no `onlineManager`, no banner). Closest: `CashierReadinessStrip` (shift/till status).
- **Backend contract exists for replay** (not used by web): `repo: docs/SYNC_CONTRACT.md` `POST /api/sync/replay` with `clientMutationId` (unique per org), `idempotencyKey`, `capturedAt`; types `PAYMENT_CAPTURE`, `SHIFT_ACTION` are "RESERVED" with no handler. The new `POST /pos/quick-sale` should accept `clientMutationId`/`Idempotency-Key` and `capturedAt` natively; do not depend on sync/replay.
- **Simplest local-first queue that fits** (about 150 lines, no libraries): `lib/event/queue.ts`, a localStorage JSON array under `nimbus.event.queue.v1:<branchId>:<tillId>`; each entry `{clientMutationId (crypto.randomUUID), capturedAt, lines, tender, cardBrand?, approvalCode?, amountTendered?, status: "pending"|"synced"|"failed", attempts}`. Write-ahead: persist before the network call; flush loop `setInterval(8s)` + `window "online"` event, sequential, `Idempotency-Key: clientMutationId`; treat 409/duplicate as success; 401 -> pause and show "sign in again" (do not drop). Keep localStorage (sync, survives reload; ~5MB is plenty for ~2k sales) with an IndexedDB upgrade only if time allows. Also cache the menu (`nimbus.event.menu.v1:<branchId>`) so tiles render offline.
  Insertion points: (a) new `lib/event/queue.ts` + `useEventQueue` hook; (b) `AppProviders.tsx` not needed, mount the flusher inside `EventTillScreen`; (c) `lib/api/client.ts` has no hook, call `apiRequest` directly with `Idempotency-Key`, `timeoutMs: 10_000`; (d) a `useOnlineStatus` hook (`navigator.onLine` + `online/offline` events) feeds the header badge. For true offline cold-start, a minimal hand-written `public/sw.js` caching `/event/till` + `_next/static` would be needed, but GSSP pages complicate it: mitigate operationally (tablets load the page while online, keep it open, never reload) and say so (see Risks R2).

## 5. Testing and quality gates (apps/web)

- Unit runner: **none**. `package.json:11` `"test": "echo \"No frontend tests yet\""`. Substitute: `scripts/*-assertions.ts` (plain `assert` scripts run with `npx tsx`, each with a `tsconfig.<name>.json` listing the files it imports; e.g. `scripts/shell-assertions.ts:1-25`, `scripts/tsconfig.shell-assertions.json`). Run list in `repo: docs/TESTING_AND_QA.md:72-98`. Pure-logic modules must be free of `@/` aliases and React so tsx can import them (see `lib/manager/branch-model.ts` comment).
- Scripts (`package.json:5-11`): `dev` (next dev -p 3000), `build`, `lint` (`next lint`), `typecheck` (`tsc --noEmit`), `test` (stub). **No `check:*` scripts, no design-guardrail script.** UI rules are documentation only (`docs/UI_SYSTEM.md`: no hard-coded hex, shared primitives, rem not px for vertical rhythm, icon registry).
- Lint: `.eslintrc.json` = `{"extends":["next/core-web-vitals"]}` only; tsconfig `strict: true`, alias `@/* -> src/*`.
- Playwright (`playwright.config.ts`): `testDir ./e2e`, `workers 1`, `retries 0`, timeout 60s, base URL `PW_BASE_URL` (default http://localhost:3100), API `PW_API_URL` (default :4001), projects `vp-1024x768`, `vp-1366x768`, `vp-1440x900`, `vp-1920x1080` (all "Desktop Chrome"; **no tablet/touch/landscape-tablet project**, so add e.g. 1280x800 `hasTouch` for event specs). Chromium flags `--disable-gpu ...`.
- E2E login: UI login with email/password every spec, no storageState: `e2e/supervisor-prompt3/fixtures.ts:36-59` (`uiLogin`: clear localStorage, open /login, click "Email", fill `input[name="email"]`/`password`, click "Sign in", wait for URL change); creds from `CFG` env (`PW_*_EMAIL/PASSWORD`). API-side seed helpers use `POST /api/auth/login` (`e2e/cashier-floor/c2-fixtures.ts:11-21`). Offline specs can use `context.setOffline(true)`.
- Specs exist for cashier, supervisor, manager (shell, dashboard, ops, staff, reports, accounting); none for event.

## 6. Role by role gaps for the concert

Legend: MUST = MUST-FIX-BEFORE-28-NOV; WA = WORKAROUND; NN = NOT NEEDED FOR EVENT.

### 6.1 Cashier (tablet till operator)
| Event task | Screen today | Gap | Verdict |
|---|---|---|---|
| Log in on a tablet | `/login` Quick PIN (6/8 digits) + branch id field | Branch id is a free-text cuid, defaulting to demo "Tapas Downtown". Two branches means each tablet needs the right id once (persisted in `nimbus.stationBranchId`). Typing a cuid on 10 tablets is error-prone. | WA: pre-seed `localStorage nimbus.stationBranchId` / terminal label per tablet via a one-time `/event/setup` page or bookmarklet; MUST-FIX if no setup page: add `?branch=` query prefill. |
| Stay logged in all night | 15-min idle logout; 15-min JWT; no refresh | Till logs out or 401s mid-event | MUST (set `JWT_ACCESS_TTL=12h`, `JWT_REFRESH_TTL` >= 2d on the event API; Event Till skips idle handler; ideally add refresh in client) |
| Open shift, open till with float | `/cashier/me` start shift (`CashierMeScreen.tsx:60-90`), `/cashier/till` open till (till code + opening float, `till-validation.ts:24-48`) | Two screens, 2 mutations, till code free text; works. Requires `pos:shift:open`. | WA: use as is (cashier does Me > Start shift, Till > Open). Event Till should show "no open till" with link to `/cashier/till`. |
| Ring a sale | `/cashier/floor` is table/bill-based; checkout needs a SERVED order and cash only via close | No counter-sale flow; cashier checkout cannot do tiles + tender in 3 taps | MUST: Event Till + `POST /pos/quick-sale` |
| Cash with change | none | No tendered/change calc | MUST (in Event Till) |
| Visa / Mastercard / other card / approval code | `CARD_REFERENCE` single method with required reference | No brand field; reference is mandatory in cashier flow | MUST (new `cardBrand`, `approvalCode` optional) |
| MTN / Airtel | `MTN_REFERENCE`, `AIRTEL_REFERENCE` manual reference | Manual only (LIM-001/003) | OK as tender labels, reference optional at event |
| Void last sale | none for cashier; supervisor void is order-level (`pos:orders:void`) | | MUST (undo-last-sale with supervisor PIN) |
| End-of-night cash-up | `/cashier/till` reconcile (`validateReconcileInput`: counted cash, variance reason if |variance| > 0.01), safe drop | Expected cash is computed from till payments; quick-sale cash must be written to the till session for the number to be right | MUST (API must credit the till session) ; UI exists |
| Shift-end report / receipt | `/cashier/receipts` (hidden compat route), receipts "pending adapters" (no printer) | No printed receipts (LIM-004/005) | NN (no receipts needed; count slips by hand) |

### 6.2 Supervisor
| Task | Screen today | Gap | Verdict |
|---|---|---|---|
| Log in | Quick PIN, lands `/supervisor/floor` | Supervisor accounts cannot be created in the Manager onboarding picker ("Supervisor/Manager roles in the onboarding picker ... Omitted", `docs/KNOWN_LIMITATIONS.md` Manager Ops+Staff deferred list); invitations only Manager/Accountant | WA: create supervisors with a seed script / API call (`POST /api/hr/frontline-staff/onboard` rejects non-listed roles: UNKNOWN, check DTO) |
| Approve void | `/supervisor/approvals` (discount/leave/swap/anomaly queues), floor order actions | No till-level void approval; PIN is typed on the cashier's tablet | MUST (PIN dialog in Event Till, new verify endpoint) |
| See till activity | none | | WA: Manager Overview/Operations or the new live view |
| Reconcile tills | cashier-only screen | Supervisor cannot cash up a cashier's till (`/cashier/till` guarded by `isCashier`) | WA: cashier reconciles own till; supervisor counts alongside |

### 6.3 Manager
| Task | Screen today | Gap | Verdict |
|---|---|---|---|
| Log in (email or PIN) | `/manager/overview` | Branch-scoped token; Quick-PIN session starts with `memberships: []` | OK |
| See live sales | `/manager/overview` (poll 60s: today sales, payment mix, open orders, approvals) | Per branch only (switcher), no card-brand, no per-till, no cross-branch total; polls 60s | WA until live view; see section 7 |
| Create/edit menu items and prices | **No UI.** `/api/menu/*` is only read by the waiter (`grep` of `src` finds `/api/menu` only in `lib/waiter/order-api.ts`). | Menu must exist before the event; no `POST /api/menu/items` call in the frontend. API write routes exist (UNKNOWN exact shapes, `repo: apps/api/src/modules/menu`). | MUST for setup week, as script/CSV import (WA): load the ~12 items via API/seed script per branch; price edits on the night = no. |
| Add staff and PINs | `/manager/staff/onboarding` (3-step wizard: identity, role/start, review, then confirm dialog), PIN shown once masked (`ManagerOneTimeSecretPanel`, `staff-model.ts:180-186` roles Waiter/Cashier/Bartender/Chef/Stock Manager); `/manager/staff/quick-pin` reset/disable/enable | One person at a time, each needs name+phone/email, hire date, role; about 8 interactions and a PIN copy per person. 10-14 cashiers = 1-2 hours; no bulk, no CSV. | WA: seed script for staff + PINs, or do 12 wizard runs a day ahead and record PINs on a sheet. Password reset by manager does not exist. |
| Settings: currency, tax | `/manager/settings` (7 sections incl. Currency, Tax & VAT, Rounding; real writes) | Fine; verify branch currency UGX and tax mode so quick-sale total matches shelf prices | MUST verify (config check, not code) |
| Reports + CSV export | `/manager/reports` (catalog, runs, export CSV via `POST /api/reports/export {format:"CSV"}`, `reports-api.ts:196-201`) | CSV only, reports summary-only (no per-row), `PAYMENT_MIX`, `SALES_BY_HOUR` exist. Quick-sale rows appear only if they land in `orders`/`payments` tables with a method + brand | WA: CSV via reports; MUST: quick-sale data model must feed these |
| End of night | no event-specific close | | WA: cashiers reconcile tills; manager exports CSV |
| Accounting postings | `/manager/accounting/*` exists (journals, posting runs, read-only mostly) | **Closed orders do not post to the GL automatically**: `grep ledger|journal` finds no reference in `apps/api/src/modules/{orders,payments,tills}`; posting is by `POST /api/accounting/posting/replay` (`repo: docs/GL_POSTING_ENGINE_GUIDE.md:102`) from source maps `ORDER_REVENUE`, `PAYMENT_RECEIVED`. Not caused by quick-sale. | NN for event night (do it after, or never); flag as accountant follow-up |

### 6.4 Waiter
| Task | Screen today | Gap | Verdict |
|---|---|---|---|
| Table orders | `/waiter/floor` (tables), order builder, send to kitchen | Event is counter service, no tables, no kitchen. Waiter flow needs table + sent order + cashier close | NN. Do not put waiters on event tills. |
| If used as roaming seller | none | | NN |

### 6.5 Owner / organiser
| Task | Screen today | Gap | Verdict |
|---|---|---|---|
| Log in | **None.** Login blocks any account that is not waiter/cashier/supervisor/manager (`login.tsx:154-158`). | Owner role exists in the API (L5, FULL permissions, `docs/ROLE_CAPABILITY_MATRIX.md:12`) but no screen | MUST: either give the organiser a Manager-role account (WA, simplest) or allow `/event/live` for any authenticated user |
| See live totals across both branches | none | Manager screens are single-branch | MUST: `/event/live` (one view, two branches) |
| Visa share / card brand split | none (`/api/dash/payment-mix` has method only) | MUST (live view + new data) |
| Reports | manager reports | | WA via Manager login |

### 6.6 Accountant
| Task | Screen today | Gap | Verdict |
|---|---|---|---|
| Any | None (role excluded from login; manager has `/manager/accounting/*`, and invitations screen can invite "Manager/Accountant") | Accountant has FULL accounting permission but no screens | NN for the event. Post-event reconciliation: WA via Manager login + CSV; GL posting not automatic (see 6.3). |

Owner statement check: "we did waiter, manager; we didn't do owner, accountant." The code agrees: four role workspaces only (waiter, cashier, supervisor, manager). Cashier and supervisor also exist (the owner did not list them) but are table-bill centric.

## 7. Manager module specifics

**Routes** (`src/pages/manager`): `overview`, `me`, `settings`, `index` (redirect), `operations/{index,orders,tables,reservations}`, `staff/{index,directory,onboarding,quick-pin,invitations,leave,shift-swaps}`, `reports/{index,catalog,runs}`, `accounting/{index,dashboard,journals,bank/{accounts,statements,reconciliation},closing/{fiscal-periods,period-close-runs},configuration/{chart-of-accounts,cost-centres,posting-source-maps,tax-config},customers/{accounts,credit-notes,invoices},reporting/{aged-payable,aged-receivable,budgets,demand-calendar,forecast},review/{audit-trail,posting-errors,posting-runs},vendors/{bills,credit-notes,payments,recurring,reminders,suppliers}}`. Surface allow-list: `lib/manager/permissions.ts:42-` (`isManagerSurfaceAllowed`, deliberately not permission-driven).

| Screen | What it shows | Known defects / limits (quoted) |
|---|---|---|
| Overview `/manager/overview` | Cards: sales today, orders today, payment mix, open orders (aging), low stock, approvals, coverage, readiness; `refetchInterval 60_000`, "Refresh" = `POST /api/dash/kpi/refresh` (a persisted write) | "Polled, never streamed ... `EventSource` can send neither [Authorization/X-Branch-Id] ... (MP0-07 / NG-14)" (`ManagerOverviewDashboard.tsx` comment). B3-D1: "Backend gap batch 1 **inverted** `grossSales`/`netSales`, so the B2 Overview rendered the **ex-tax** figure under the label 'Sales today (tax-inclusive)'. **Fixed in B3**" (`docs/KNOWN_LIMITATIONS.md`, B3 table). Payment mix has no card brand. Per-branch. |
| Operations | Orders list, tables, reservations (read) | "`GET /api/tills` and `GET /api/shifts` **do not exist** ... No tills or shifts list anywhere in Operations"; "The orders totals row is a **page** total" |
| Staff | Directory, onboarding, quick-PIN admin, invitations (Manager/Accountant only), leave, swaps | "`POST /hr/frontline-staff/onboard` and `/quick-pin/reset` return a **plaintext PIN** ... remains a gap"; "no Manager-initiated password reset exists anywhere in the API"; B3-F1 quick-PIN endpoints org-scoped not branch-guarded; "Supervisor/Manager roles in the onboarding picker ... Omitted"; "`GET /hr/employees` is organization-scoped and 400s on `?branchId=`" |
| Reports | 24-report catalog, runs, CSV export | "No PDF renderer ... CSV is the only export"; "`/reports/:id` returns no rows - `rowCount` + an aggregate `summary` only"; B4-F2 `grossSales` tax base differs inside `topItems[]`; "`MENU_ENGINEERING` ... no POST route" |
| Settings | Currency, Tax & VAT, Rounding, thresholds, reservations/receipts, attendance/inventory, exchange rates (real writes, dirty-state bar) | ai/AI_STATUS.md B6: "Branch profile/Devices/Printers/Terminals/Alerts/Sync are NOT built here ... terminal pairing **stub-only**, alert rules **defer-or-read-only**"; "C-30 shared Neon still leaks `pos:hr:compensation:read` to Manager" |
| Accounting | Large read/limited-write module | "Manager accounting UI still renders zero write affordances" (CLAUDE.md B5 notes); GL not auto-posted from orders |

`ai/AI_STATUS.md` (3576 lines) top state: "ENTERPRISE UI TRACK B6 COMPLETE - Manager Settings, Staff Onboarding, and Credential Management (2026-08-22)." Latest tracked status files: `ai/ENTERPRISE_B*_COMPLETION_REPORT.md` (B1 to B6.7, all present). Cashier: `docs/KNOWN_LIMITATIONS.md` "LIM-001/003 Mobile money & card = manual/reference only", "LIM-004/005 Printer + receipt delivery pending adapters", "LIM-011 Partial cash tender blocked", "LIM-012 Manager approval / post-close void = boundary cards only". Infrastructure: "Quick PIN, catalog/detail, and some list reads can exceed targets on cold/noisy runs" and "WKL-013 warm Quick PIN ~3.8s" (latency risk on Neon).

**Single manager screen to fall back on if `/event/live` slips:** `/manager/overview` (Sales today + Payment mix + Orders today cards), one browser per branch with the branch switcher, plus `/manager/reports/catalog` run `PAYMENT_MIX` + `SALES_BY_HOUR` and CSV export at close. It lacks card brand, top items, per-till cash-up and a cross-branch total, and only counts sales that reached the orders/payments tables (queued offline sales not yet synced are invisible).

## 8. [P] Proposed file plan (apps/web)

Reuse: `apiRequest`, `useAuth`, `useToast`, `Button/Card/Badge/StatusMessage`, `formatWaiterMoney`, `loadWaiterMenuWorkspace`, `CurrentTime`, idempotency helpers, `ActionConfirmDialog` (for undo confirm) and the till/shift API clients.

New files [P]:
1. [P] `src/pages/event/till.tsx`: GSSP stub + `<EventSessionGuard><EventTillScreen/></EventSessionGuard>`; also `src/pages/event/index.tsx` redirect by role (cashier/supervisor -> till, manager -> live).
2. [P] `src/pages/event/live.tsx`: GSSP stub + guard (manager and organiser) + `<EventLiveScreen/>`.
3. [P] `src/pages/event/setup.tsx` (optional, strongly recommended): sets `nimbus.stationBranchId`, `nimbus.stationTerminalLabel`, shows queue/menu-cache state; reachable without login.
4. [P] `src/components/event/EventSessionGuard.tsx`: copy of `CashierSessionGuard` allowing cashier|supervisor|manager (till) / manager (live); no idle handler.
5. [P] `src/components/event/EventTillScreen.tsx`: landscape two-pane (left tile grid ~ 3x4 = 12 tiles, right cart + total + tender grid).
6. [P] `src/components/event/EventItemTile.tsx` (extract/restyle of `MenuItemTile`, rem sizes >= 5rem tall, quantity badge), `EventCartPanel.tsx` (lines with -/+, running total), `EventTenderBar.tsx` (Cash, Visa, Mastercard, Other card, MTN, Airtel as 6 big buttons), `EventCashDialog.tsx` (tendered quick-amount chips 5k/10k/20k/50k/exact + change), `EventApprovalCodeField.tsx` (optional, post-sale attach), `EventUndoDialog.tsx` (supervisor PIN keypad, reuse login's key layout extracted into `src/components/ui/PinPad.tsx`), `EventSyncBadge.tsx` ("N not yet synced", online dot), `EventHeader.tsx` (slim).
7. [P] `src/lib/event/types.ts`, `src/lib/event/cart.ts` (pure integer-UGX reducer: add, dec, clear, total), `src/lib/event/tenders.ts` (tender config: CASH, CARD+brand VISA|MASTERCARD|OTHER, MOMO+MTN|AIRTEL), `src/lib/event/queue.ts` (pure queue, localStorage adapter injected), `src/lib/event/useEventQueue.ts` (flush loop, online listener), `src/lib/event/useOnlineStatus.ts`, `src/lib/event/quick-sale-api.ts` (`POST /api/pos/quick-sale`, `POST /api/pos/quick-sale/:id/undo`, `Idempotency-Key`), `src/lib/event/menu-cache.ts`, `src/lib/event/live-api.ts` + `live-model.ts` (aggregations, pure).
8. [P] `src/components/event/EventLiveScreen.tsx` with `EventTenderSplitCard`, `EventVisaShareCard`, `EventCardTypeItemsCard`, `EventTopItemsCard`, `EventTillCashupTable` (five numbers, both branches, 15s poll via react-query `refetchInterval`, last-updated stamp, tolerates one branch failing). Data: either a new `GET /api/pos/quick-sale/summary` per branch, or 2 requests with `X-Branch-Id` each (manager token must hold both memberships; email login).
9. [P] Edits to existing files: `src/pages/login.tsx` (landing for event accounts, `event_only` reason, `?branch=` prefill), `src/lib/auth/role.ts` (`getEventLandingPath`), optionally `src/lib/api/client.ts` + `AuthProvider.tsx` (401 -> single-flight `/api/auth/refresh`, store rotated tokens), `public/brand/manifest.webmanifest` (`start_url: "/event/till"`, `orientation: "landscape"`).
10. [P] Tests: `scripts/event-assertions.ts` + `scripts/tsconfig.event-assertions.json` (cart math, change calc, queue ordering/idempotent flush, tender payload mapping, live aggregation incl. UGX integer sums); `e2e/event/till.spec.ts` (2 beers + Visa; offline `context.setOffline(true)` queue count then flush; undo with supervisor PIN), `e2e/event/live.spec.ts`; add a 1280x800 touch landscape project in `playwright.config.ts`.

**Tap count "2 beers, Visa":** tap Beer tile x2 (2) + tap Visa (1) = **3 taps**, the sale is committed to the local queue on the Visa tap and the cart clears; the optional approval code is attached afterwards from the "Last sale" strip (+1 tap to open, digits, +1 save) so it never blocks the queue. If an approval code is made mandatory at the till: 3 taps + about 6 keypad taps + 1 confirm. Cash: items + Cash + a chip (exact/10k/20k) = 3-4 taps and change shown on the confirmation toast.

## 9. Risks and unknowns

- R1 (critical): 15-min access token, no client refresh, 15-min idle logout; queued sales from a logged-out session cannot sync. Fix on the event environment: raise `JWT_ACCESS_TTL` (and refresh TTL), disable idle handler on `/event/*`, add refresh single-flight if time.
- R2 (critical): GSSP pages are not offline-loadable; reloading a tablet while offline shows nothing. Mitigate: load once online, never reload, keep queue in localStorage, PWA install; add `sw.js` only if time. UNKNOWN: whether the venue has reliable Wi-Fi/4G (it would change the weight of offline).
- R3: Quick-PIN login latency on Neon (~3.8s warm, `WKL-013`) and cold starts; the 28 Nov deployment host (Vercel/VPS) and DB region are UNKNOWN.
- R4: Staff/PIN logistics for 10-14 cashiers + supervisors: wizard is one-at-a-time; supervisors cannot be created through the UI; PIN is shown once. Needs a seed script and a PIN sheet. UNKNOWN: whether `onboard` accepts "Supervisor" (UI picker excludes it).
- R5: No menu management UI: items/prices must be seeded per branch; shape of `POST /api/menu/items` and servings/categories UNKNOWN (not read). Tiles depend on `/api/menu/catalog` + `navigation` and on orders needing `menuItemServingId` for some items (`e2e/c2-fixtures.ts` passes `menuItemServingId`); quick-sale API must accept a menu item without serving or pick the default serving.
- R6: Branch id entry on tablets; two branches means two ids. Hard-coded demo branch default in `login.tsx:32-33`.
- R7: Cash-up correctness depends on quick-sale cash being recorded against the open till session (`/api/tills/:id/summary`). UNKNOWN until the API is written. Also `reconcile` requires a till opened through `/cashier/till` and a shift opened on `/cashier/me`.
- R8: Live view across both branches requires a token with access to both (manager email login with two memberships) or a new org-level endpoint; Quick-PIN tokens are single-branch. Owner/organiser cannot log in at all today.
- R9: Dashboard/report numbers (payment mix, sales by hour) will not show card brand; consistent definitions between `/event/live` and manager reports are not guaranteed (B4-F2 tax-base inconsistency).
- R10: Touch target sizes shrink with the root-font clamp on short viewports; verify on the real tablets (UNKNOWN models/resolutions, assumed ~1280x800).
- R11: No printer/receipt (LIM-004/005); decide if paper slips or a "last sale" screen suffices.
- R12: Test infra is thin (no unit runner, desktop-only viewports, e2e needs an isolated API+DB stack on :4001/:3100). Plan on tsx assertions + one Playwright smoke.
- R13: Token/PIN security: tokens in localStorage on shared tablets; shared tablets should be locked to `/event/till` (kiosk/guided access).
- Not determined: JWT TTL actually deployed for the event API; production API URL/CORS for the event; whether `POST /pos/quick-sale` should create an `Order`+`Payment` rows (would make reports/dashboards work) or a separate table (reports will not see it); exact GL behaviour for payments (no auto-posting found by grep, not proven end to end).
