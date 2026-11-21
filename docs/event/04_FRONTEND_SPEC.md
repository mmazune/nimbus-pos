# 04 — Front-end spec (H3, H4b)

*21 Nov 2026. Detail with quotes: `research/G2_frontend_build_spec.md` (G2 s…). Paths are under `apps/web/src`. All [P] until built. Both milestones are **Opus** work.*

## In short

- Two new pages: `/event/till` (the cashier's whole night) and `/event/live` (the organiser's five numbers). Plus `/event/setup` to bind a tablet to a branch and till.
- The till saves every sale locally first, then sends it. It opens with no signal and stays logged in all night.
- "2 beers, Visa" is **3 taps**: beer, beer, Visa.

## 1. `/event/till`

**Layout, landscape tablet 1280×800 (also 1024×768):**

```
+--------------------------------------------------------------------------------+
| DRINKS · Till DRK-03 · Amina            Synced ✓ / 4 not yet synced      Menu  |  48
+----------------------------------------------------------+---------------------+
|  [ Bell ]   [ Nile ]   [ Club ]   [ Tusker ]              |  2 × Bell     8,000 |
|  [ Water ]  [ Soda ]   [ Gin tot ] [ Whisky tot ]         |  1 × Water    2,000 |
|  [ … about 12 tiles, 3 rows × 4, each ≥ 120 × 96 ]        |                     |
|                                                           |  TOTAL  UGX 10,000  |
|                                                           |  [ Clear ]          |
+----------------------------------------------------------+---------------------+
| [ CASH ]  [ VISA ]  [ MASTERCARD ]  [ OTHER CARD ]  [ MTN ]  [ AIRTEL ]         |  88
+--------------------------------------------------------------------------------+
```

| Rule | Detail |
|---|---|
| Tiles | About 12 per branch, from the cached menu, ordered by `sort_order`. Name and price. Tap adds one; tap the cart line to remove one. No modifiers, no search, no scrolling |
| Tender bar | Six buttons, always visible, disabled when the cart is empty. **No default tender** |
| Card and mobile money | One tap completes the sale. A small "Add approval code" chip appears on the confirmation toast for 10 s; it is optional and never blocks |
| Cash | Opens a dialog: amount chips (exact, and the next round notes), change shown large, one "Done" |
| After a sale | Cart clears; a top toast "Sold · UGX 10,000 · Visa" with **Undo** for 15 s |
| Undo | Opens the supervisor PIN dialog; calls the existing post-close void (EV-22). Only for a sale already synced; an unsynced sale is removed from the queue with the same PIN |
| Sync badge | "Synced" or "N not yet synced". Tapping shows the queue with times. Never hidden |
| Menu button | Shift, till open and cash-up (links to `/cashier/me`, `/cashier/till`), sign out |
| Money | `UGX 10,000`, no decimals. `formatWaiterMoney` already handles UGX (`lib/waiter/formatters.ts:45`) |
| Targets | ≥ 44 px, and check at 1024×768: the root-font clamp shrinks targets on short viewports (G2 risk 8) |
| Words | "Sold", "Not yet synced", "Add approval code". No internal codes on screen |

**Six states to design:** loading (menu from cache), empty cart, selling, offline (badge and unchanged flow), rejected sale (shown in the queue with the reason, never silently dropped), signed out.

## 2. Local-first sale path (EV-11)

1. Tender tap → build the sale with a new `clientSaleId` (UUID) and `soldAt` → write it to the queue in **IndexedDB** → clear the cart and show the toast. The cashier never waits.
2. A queue worker posts each sale to `POST /api/pos/quick-sale`, oldest first, one at a time.
3. Success or `replayed: true` → mark synced. Network error or 5xx → retry with backoff. **4xx** → mark rejected and show it; do not retry.
4. The queue survives reload and sign-out. A sale is removed only after the server confirms it.
5. On 401: refresh the token once, then retry; if refresh fails, keep queueing and prompt for the PIN.

Use `clientSaleId` in the body as the idempotency key. Do not send `Idempotency-Key` and do not use `/sync/replay` (EV-14). Existing helpers `lib/cashier/idempotency.ts` and `lib/pos-shell/idempotency.ts` are for other flows.

## 3. Session survival (EV-17) and offline start (EV-21)

| Problem | Fix |
|---|---|
| Access token lasts 15 minutes | API env `JWT_ACCESS_TTL=12h` for the event (H2) |
| The web app never refreshes | Add a single 401 → `/api/auth/refresh` → retry path in the API client (`lib/api/client.ts` / `AuthProvider`). Refresh rotates with reuse detection, so **one** refresh at a time, shared across tabs |
| Idle logout at 15 minutes (`components/pos-shell/idle.ts:6`) | Skip the idle handler on `/event/*` |
| Pages use `getServerSideProps`; offline reload shows nothing | `/event/till` is client-rendered (no `getServerSideProps`), with a small service worker that caches the page shell and static assets |
| Menu needed offline | Cache the branch menu in IndexedDB on login and on each successful refresh; show its age |
| Login needs the network | Stay signed in. If a cashier must change while offline, the till keeps the current user and records the change note; real re-login happens when the signal returns |

## 4. `/event/setup`

One screen, used once per tablet by Moses or a supervisor: choose branch, choose till code, store both on the device, then show the PIN pad. `?branch=` and `?till=` prefill it so a QR per tablet works. The login page gains a `?branch=` prefill and sends event cashiers to `/event/till`.

## 5. `/event/live` (H4b)

Read-only, Manager role, polls `GET /api/event-reports/summary` every 30 s. Works on a phone at 390 px and on a laptop.

| Card | Shows |
|---|---|
| Total | Gross sales and sale count, food and drinks, "as at 21:42" |
| How people paid | Cash, Visa, Mastercard, Other card, MTN, Airtel: value and share, as bars with numbers |
| Visa | Value, share of card and of all sales, labelled "provisional until the bank report" |
| What Visa bought | Top 10 items on Visa by value |
| Top items | Top 10 overall, with brand |
| Tills | Per till: sales, cash, card, mobile money; "not yet synced" cannot be known server-side, so show the last sale time per till instead |

Every count carries its time. An error keeps the last good numbers and says they are stale. Template for polling: `lib/manager/dashboard-context.ts:49,99`.

## 6. Reuse (most are private or inline: extract or copy, do not import across role folders blindly)

| Need | Source |
|---|---|
| Menu tile, quantity stepper | `components/waiter/orders/WaiterOrderBuilderScreen.tsx:579`, `:226` |
| Payment method tiles (pattern only) | `components/cashier/checkout/CashierPaymentMethodSelector.tsx` |
| PIN keypad | Inline in `pages/login.tsx:30,373` → extract to `components/ui/PinPad` |
| Dialog with a manager PIN field | `components/pos-shell/ActionConfirmDialog.tsx` |
| Money | `lib/waiter/formatters.ts:45` |
| Menu fetch | `lib/waiter/order-api.ts:307-326` |
| Till and shift APIs | `lib/cashier/tills.ts`, `lib/cashier/shifts.ts` |
| Route guard template | `components/cashier/shell/CashierSessionGuard.tsx` |
| Toast, Badge | `components/providers/ToastProvider.tsx`, `components/ui` |
| Tokens | `styles/globals.css` (navy `#000033`, Inter, Phosphor icons); `docs/BRAND_IDENTITY.md`, `docs/UI_SYSTEM.md` |

Not reusable: `lib/cashier/payment-validation.ts` (bound to an existing SERVED order).

## 7. Files

| Kind | Paths |
|---|---|
| Pages | `pages/event/index.tsx`, `till.tsx`, `live.tsx`, `setup.tsx` |
| Components | `components/event/` — `EventSessionGuard`, `EventTillScreen`, `EventItemTile`, `EventCartPanel`, `EventTenderBar`, `EventCashDialog`, `EventUndoDialog`, `EventApprovalCodeField`, `EventSyncBadge`, `EventHeader`, `EventLiveScreen` and its cards; `components/ui/PinPad` |
| Lib | `lib/event/` — `types`, `cart`, `tenders`, `queue`, `useEventQueue`, `useOnlineStatus`, `quick-sale-api`, `menu-cache`, `live-api`, `live-model` |
| Edits | `pages/login.tsx` (landing, `?branch=`), role helper, 401 refresh in the API client, idle skip, service worker registration, manifest `start_url` |
| Tests | `scripts/event-assertions.ts` (the repo's gate style), `e2e/event/*.spec.ts`, a 1280×800 touch project in `playwright.config.ts` |

## 8. Done-when tests (H3)

| Test | Pass |
|---|---|
| Taps | "2 beers, Visa" ≤ 3 taps from the till home; "1 water, cash, exact" ≤ 4 |
| Offline sale | With the network off, ring 5 sales; turn it on; exactly 5 orders exist, badge returns to "Synced" |
| Offline reload | With the network off, reload the tablet; the till opens with the cached menu |
| Duplicate | Kill the tab mid-post, reopen: no duplicate order |
| Session | After 20 minutes idle the cashier can still sell |
| Layout | No sideways scroll at 1024×768 and 1280×800; all targets ≥ 44 px |
| Rejected sale | A sale for a deactivated SKU appears as rejected in the queue with the reason |

The web app has no unit runner (`test` is an echo stub) and no `check:*` scripts; gates are `scripts/*-assertions.ts` plus Playwright at desktop viewports with a UI login per spec (G2 s5).

## What is still unverified

- IndexedDB and service-worker behaviour on the actual tablets (models UNKNOWN). Test on a real device in H3, not only Chromium.
- Whether refresh-token reuse detection logs a tablet out when two tabs are open; enforce one tab.
- The lead session has not looked at the current screens; no captures were taken. The H3 builder should capture `/cashier/floor`, `/cashier/till` and `/manager/overview` first as the visual reference.
