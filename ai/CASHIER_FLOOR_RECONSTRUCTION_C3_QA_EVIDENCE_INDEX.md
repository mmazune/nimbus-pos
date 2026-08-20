# Cashier Floor-First Reconstruction — Prompt C3 QA Evidence Index

**Date:** 2026-08-20 · **Classification:** A — C3 COMPLETE / READY FOR C4 · **Commit/push:** none.

C3 is the first Cashier reconstruction prompt whose gate cannot be met without **real money
mutations**. Every payment, split and close recorded below was executed for real against a
**disposable local Postgres** stack. Shared Neon was not reachable from this environment at all.

## 1. Isolated stack

| Component | Value |
| --- | --- |
| Postgres | Local disposable instance (sandbox), seeded + demo-imported (branch `cb27be401a2c35dfc0d4e610` "Tapas Downtown", 22 tables, ~304 orders) |
| API | `http://localhost:3001` (global prefix `/api`), `GET /api/health` → `{"status":"ok","db":"ok"}` |
| Web | `http://localhost:3000` (`next dev`; `next build` deliberately not run per the QA brief) |
| Cashier | `cashier@nimbus.demo` / `Demo1234!` — Sarah Namutebi, 63 permissions incl. `pos:orders:close`, `pos:payment:manual-reference`, `pos:order:split` |
| Readiness used | Shift **SHF-000005** opened live from Cashier **Me**; till **TILL-TAPAS_DOWNTOWN-020** already OPEN for this operator |
| Shared Neon | **Not reachable / never written.** |

## 2. Static and executable gates

| Gate | Command | Result |
| --- | --- | --- |
| Web typecheck | `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` | PASS |
| Web lint | `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` | PASS (0/0) |
| Web build | `next build` | **NOT RUN** (forbidden in this environment by the QA brief) |
| Shell assertions | `npx tsx apps/web/scripts/shell-assertions.ts` | PASS |
| Floor assertions | `npx tsx apps/web/scripts/floor-assertions.ts` | PASS |
| Profile assertions | `npx tsx apps/web/scripts/profile-assertions.ts` | PASS |
| C1 assertions | `npx tsx apps/web/scripts/cashier-c1-assertions.ts` | PASS |
| C2 assertions (C3-adjusted) | `npx tsx apps/web/scripts/cashier-c2-assertions.ts` | PASS |
| **C3 assertions (new)** | `npx tsx apps/web/scripts/cashier-c3-assertions.ts` | PASS |
| Git hygiene | `git diff --check -- apps/web docs/cashier-ui-docs` | clean |

## 3. Playwright — `e2e/cashier-floor/` full four-viewport matrix

```
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
PW_BASE_URL=http://localhost:3000 PW_API_URL=http://localhost:3001 \
npx playwright test e2e/cashier-floor --reporter=list
```

**192 passed / 0 failed / 0 skipped** — 48 tests × 4 viewport projects (`vp-1024x768`,
`vp-1366x768`, `vp-1440x900`, `vp-1920x1080`), 14.7 min, 26 spec files.

New in C3 (7 tests × 4 viewports = 28 of the 192):

| Spec | Covers |
| --- | --- |
| `settlement-payment-cash-close.spec.ts` | Cash prefills to the canonical outstanding; close → terminal state; form unmounts; receipt exists; backend re-checked (`CLOSED`, `isSettled`, `remaining 0`, a `CASH:` payment). |
| `settlement-partial-payment.spec.ts` | Card reference for half → `SERVED` + **Partially paid** + canonical remainder; cash field re-prefills to the remainder; close → `CLOSED` with exactly 2 payments. |
| `settlement-split-execution.spec.ts` | Split allocation offered, handoff actions absent; equal split saved through the confirm dialog; `metadata.splitBill` persisted with `allocated == order total`; parent totals and paid amount unchanged. |
| `settlement-fail-closed.spec.ts` (3 tests) | (a) simulated payment-summary `500` → *State unavailable*, "never shown as paid or unpaid", payment **and** split blocked/disabled; (b) a closed bill exposes no settlement control, on a hot transition and on a cold URL; (c) a non-`SERVED` bill states the cash-close precondition and disables the button. |
| `request-count-c3.spec.ts` | After a close: every request matches an allow-list, no receipts/refunds/menu/auth-me calls, exactly one `/close`, ≤ 16 requests total. |

Renamed in C3: `settlement-workspace-readonly.spec.ts` → `settlement-workspace-scope.spec.ts` (its
C2 read-only premise is superseded; its canonical-section and out-of-scope assertions are kept and
extended with `Settlement` and an explicit "no longer claims read-only" check).

## 4. Cross-role regression

```
npx playwright test e2e/supervisor-prompt3/regression.spec.ts \
                    e2e/supervisor-prompt3/role-boundaries.spec.ts
```

**20 passed / 0 failed** — 5 tests × 4 viewports, 1.4 min. Waiter Floor/nav intact, Supervisor
Floor/nav intact and still exposing Find order (not Find bill), Cashier nav still exactly
Floor/Till/Me with Queue/Receipts reachable only by direct URL, Waiter still blocked from the
Supervisor Floor workspace. Additionally, `e2e/cashier-floor/cross-role-c2-regression.spec.ts` and
`role-boundaries.spec.ts` (inside the 192) re-verify that C3 introduced no Supervisor/Waiter
affordance on Cashier Floor.

## 5. Live settlement transcript (real mutations)

| # | Flow | Bill | Before | Action | After (verified via API) |
| --- | --- | --- | --- | --- | --- |
| 1 | **Readiness fail-closed** | `ORD-TAPAS_DOWNTOWN-00195` (TD-03, SERVED, 122,700) | no active shift | opened the workspace | Payment blocked: *"No active shift. Start a shift before checkout."*; split blocked: *"No active shift. Resolution actions are blocked."* — shot `03` |
| 2 | **Shift open from Me** | — | `GET /shifts/active` empty | Start shift | **SHF-000005** OPEN; readiness chips flip to *Shift active* — shot `04` |
| 3 | **Full cash payment → close** | `ORD-TAPAS_DOWNTOWN-00195` | 122,700 due | Cash 122,700 → *Close with cash payment* | `POST /pos/orders/:id/close` **200**; status **CLOSED**, `totalPaid 122700.00`, `remainingBalance 0.00`, `isSettled true`, `CASH:122700`; `GET /receipts/:id` **200** — shots `05`, `06` |
| 4 | **Partial payment** | `ORD-TAPAS_DOWNTOWN-00969` (TD-09, SERVED, 213,600) | 213,600 due | Card reference `C3-QA-CARD-001` for 100,000 | `POST /payments/manual-reference` **201**; status stays **SERVED**, `totalPaid 100000.00`, `remainingBalance 113600.00`, badge **Partially paid** — shots `07`, `08` |
| 4b | **Duplicate reference** | same | — | replayed the same `externalTransactionId` | Server **deduped** — `totalPaid` unchanged at 100,000 |
| 5 | **Remainder → close** | `ORD-TAPAS_DOWNTOWN-00969` | 113,600 due | cash field prefilled **113,600** → close | `POST /close` **200**; **CLOSED**, `totalPaid 213600.00`, `remaining 0.00`, payments `CARD:100000` + `CASH:113600`; receipt **200** with 2 payments — shots `09`, `10` |
| 6 | **Split bill (equal ×3)** | `ORD-TAPAS_DOWNTOWN-00615` (TD-16, READY, 304,400) | no allocation | Save split → confirm | `POST /split-bill` **200**; `metadata.splitBill = {mode EQUAL, groups 3, allocated "304400.00"}`; order total unchanged — shots `11`–`13` |
| 7 | **Split-group partial payment** | same | 304,400 due | Bank reference `C3-QA-SPLIT-G1` for 101,466.66 | **201**; `totalPaid 101466.66`, `remainingBalance 202933.34`, **Partially paid** — shots `14`, `15` |
| 8 | **Split items → child order** | `ORD-TAPAS_DOWNTOWN-00374` (TD-13, SERVED, 113,300) | 2 lines | select 1 line, reason, confirm *Create child order* | `POST /split-items` **200**; child `…-00374-S1` created **NEW** 28,000; parent reduced to **85,300**; the `NEW` child is correctly **not** offered as a payable candidate — shots `23`–`25` |
| 9 | **Fail closed — closed bill** | `ORD-TAPAS_DOWNTOWN-00195` | CLOSED | opened by `?orderId=` | No payment method selector, no cash-close button, no Save split; truthful *"This bill is closed."* — shot `16` |
| 10 | **Fail closed — API truth** | same | CLOSED | `POST /close` with a cash payment | **409** *"Cannot close order in CLOSED state. Order must be SERVED."* |
| 10b | **Backend gap probe** | same | CLOSED | `POST /payments/manual-reference` `CARD:1000` | **201** — accepted. Overpayment `totalPaid 123,700` on a 122,700 bill. Recorded as **F-C3-2 / matrix M7**; UI is unaffected (no control exists) and rendered the overpayment truthfully — shot `16` |
| 11 | **Floor card state after close** | TD-03 | 1 payable | re-selected the table | *"No bill is available for this table."* + read-only closed-bill history list — shot `17` |
| 12 | **Fail closed — summary outage** | `ORD-TAPAS_DOWNTOWN-00615` | partially paid | intercepted `/payments` → 500 | Badge **State unavailable** (danger), *"not shown as paid or unpaid"*, payment blocked (*"Payment summary must load before payment entry"*), split blocked; **never** rendered as Unpaid or Settled — shot `18` |
| 13 | **Multiple-bill selector → settlement** | TD-13 (2 payable) | — | table click → explicit selector → pick | URL `?tableId=&orderId=`; no silent first-pick — shots `19`, `20` |
| 14 | **URL state** | same | — | Back / Forward / reload | Back → selector (no `orderId`); Forward → settlement restored; reload → settlement restored — shot `21` |
| 15 | **Invalid orderId** | `deadbeef…` | — | direct URL | Fail-safe "bill unavailable"; never another bill; expected 404s only — shot `22` |
| 16 | **Final clean pass** | `ORD-000137` (TD-01, SERVED, 44,000) and `ORD-000138` (TD-04, SERVED, 66,000) | fresh bills | cash close / method switch | **CLOSED**; both viewports clean, no horizontal overflow — shots `40`–`43` |

## 5b. Receipt viewability after a C3 close

`GET /api/receipts/<orderId>` returned **200** for every bill C3 closed, with the correct order
number, item lines and payment rows (`ORD-TAPAS_DOWNTOWN-00195` → 2 items / 1 payment;
`-00969` → 4 items / 2 payments). The hidden `/cashier/receipts` compat route also lists and opens
them (`ORD-000137`, `ORD-TAPAS_DOWNTOWN-00195` — shot `44`), console and network clean. Note for
C4: that legacy list renders *"Paid — Unavailable / Outstanding — Unavailable"* because it fetches
no per-row payment summary — pre-existing Receipts behaviour, not a C3 regression.

## 6. Request budget (measured, not asserted only)

A cash close on the Floor path issued **9** API requests in total:

```
200 POST /api/pos/orders/<id>/close
200 GET  /api/pos/orders?tableId=<id>&pageSize=50      (bounded table bills)
200 GET  /api/tables                                    (shared Floor snapshot)
200 GET  /api/reservations?pageSize=200                 (shared Floor snapshot)
200 GET  /api/pos/orders?pageSize=100&excludeStatus=CLOSED,VOIDED
200 GET  /api/pos/orders/<id>                           (canonical detail, awaited)
200 GET  /api/pos/orders/<id>/payments                  (canonical money, awaited)
200 GET  /api/shifts/active
200 GET  /api/tills/active
```

No receipts, refunds, menu, profile, `auth/me`, or queue calls. The same shape was observed after a
manual-reference payment, a split-bill save and a split-items save.

## 7. Screenshots

37 screenshots in `/tmp/qa-shots/c3/` (sandbox), all **viewed** during QA. Numbering matches §5.
Both required viewports are covered: `30`–`32` and `40`–`43` are captured at **1440×900 and
1024×768**; `01`–`25` are the 1440×900 transcript. Horizontal-overflow checks passed at both
viewports (`scrollWidth == clientWidth`).

## 8. Console / network cleanliness

0 console errors, 0 warnings, 0 unexpected failed requests on Floor, the settlement workspace in
all four states (payable / partially paid / closed / summary-unavailable), Me, and both viewports.
The only non-2xx traffic was deliberately induced: the simulated `500` payment-summary outage and
the `404`s from an intentionally invalid `orderId`.

## 9. QA data left behind (disposable DB only)

Closed by QA: `ORD-TAPAS_DOWNTOWN-00195`, `-00969`, `ORD-000137`, plus the bills created/adopted by
the Playwright destructive specs (each tagged `C3-QA-*` or advanced from an unpaid seeded bill).
Partially paid: `ORD-TAPAS_DOWNTOWN-00615`. Split-items child orders: `…-00374-S1`,
`ORD-000005-S1`. One deliberate overpayment on `-00195` from the F-C3-2 probe. Draft orders
`ORD-000006`, `ORD-000138` remain `NEW`/`SERVED`. All of it lives only on the disposable local
database.
