# Supervisor Reconstruction — Prompt 3C

## Consolidated Live API / Database / Permission Verification & Prompt 3 Closure

**Date:** 2026-07-28
**Agent:** Claude (Opus 4.8), highest reasoning effort
**Type:** Closure & verification pass (no new Supervisor capabilities)
**Result:** **C. IMPLEMENTED / QA BLOCKED** — see §53.

---

## Executive summary

Prompt 3's Supervisor order-workspace implementation is **verified present and
correctly gated in code**, the **static gates pass** (typecheck, lint, production
build), the **API boots and `/api/health` returns `db: ok`**, the **order-service
Jest suite passes (26/26)**, and **runtime Supervisor permissions were verified
read-only through the live API** — confirming 9 of 10 in-scope grants are live and
surfacing **one real runtime gap** (`pos:order:transfer` is not mapped to the
Supervisor role on the active database, so **Transfer table currently 403s**).

The **destructive live-mutation QA (§11–§23)** and the **authenticated browser +
four-viewport QA (§25–§27)** were **NOT executed** in this environment and are
**not fabricated**: the active database is a **shared live Neon instance** (not a
throwaway/local DB), the environment's safety classifier **blocked direct DB
writes**, and **no browser-automation tooling** (Playwright/Puppeteer/Cypress) is
installed. Accordingly the status is **IMPLEMENTED / QA BLOCKED**, not
DEMO-READY.

---

## 1. Repository path
`C:\Users\arman\Desktop\nimbus-pos` (canonical). The forbidden stale path was not used.

## 2. Initial branch & git status
- Branch: **main**.
- Extensive uncommitted work preserved. No `reset`/`restore`/`stash`/`clean`/`checkout --`/`commit`/`push`.
- `git diff --check`: **clean** (only informational LF→CRLF normalization notices on pre-existing untouched files; no whitespace/conflict errors).

## 3. Pre-existing deletions (verified intentional, not attributed to 3C)
The 12 role-specific Floor files remain deleted by design:
- `supervisor/floor/`: `SupervisorFloorStatusBadge`, `SupervisorFloorSummary`, `SupervisorFloorToolbar`, `SupervisorTableCard`, `SupervisorTableDetailPanel`, `SupervisorTableGrid`.
- `waiter/floor/`: `WaiterTableCard`, `WaiterTableDetailPanel`, `WaiterTableGrid`, `WaiterTableStatusBadge`, `WaiterTableToolbar`.
- `waiter/shell/CurrentTime.tsx` (moved to shared `pos-shell`).
All Prompt 3B1–3B3B dialog files exist (untracked): Split bill/Split items/Move/Merge/Transfer/Find order/Void/Discount request/Approve/Reject/Complimentary dialogs + selectors + workspace.

## 4. Authorised seed mappings (inspected, not silently changed)
`packages/db/prisma/seed.ts` maps the Supervisor role to the **already-existing**
permissions `pos:order:split`, `pos:order:merge`, `pos:order:move-items`,
`pos:order:transfer`. **No new permission identifiers are created.** `seedRolePermissions`
is purely additive (`createMany` + `skipDuplicates`); the only delete is a targeted
**Waiter** revoke (unrelated to Supervisor). Confirmed no unauthorised role/permission changes.

## 5. Active database verification
- `DATABASE_URL` → Neon `ep-empty-paper-a4sogjap-pooler.us-east-1.aws.neon.tech` (the intended committed Nimbus demo instance).
- Reachability: TCP 5432 open; Prisma `select 1` OK.
- Schema state: **fully migrated — 164 public tables** (incl. `permissions`, `role_permissions`, `roles`, `orders`, `order_items`, `discounts`, `payments`, …).
- **Did NOT run `db:migrate`/`db:seed`; did NOT modify seed/demo data.**

## 6. Services started / ports / health
- Built the API fresh (`nest build`, exit 0) — the pre-existing `dist` was stale (Jul 18) and unsafe for QA (Rule P2).
- Booted `node dist/main.js` → **`http://localhost:3001`**, prefix `/api`. One Neon cold-start retry, then "Nest application successfully started".
- **`GET /api/health` → `{"status":"ok","db":"ok","timestamp":"2026-07-28T13:24:10Z"}`.** ✅
- Web app not booted (no browser automation available; static build validated instead).

## 7. Documents read
Root `CLAUDE.md`, `.claude/CLAUDE.md`, `ai/AI_STATUS.md`, `packages/db/prisma/seed.ts`,
Supervisor `order-actions.ts` / `order-financials.ts` / legacy-orders route,
`supervisor/routes.ts`, `supervisor/orders.tsx`, `SupervisorLegacyOrdersRedirect.tsx`,
`SupervisorFloorScreen.tsx`, `SupervisorTableControlWorkspace.tsx`,
`demo-data/DEMO_LOGIN_CREDENTIALS.md`, Postman collections index.

## 8. Pre-QA validation
| Gate | Result |
|---|---|
| `corepack pnpm@8.15.0 --version` | **8.15.0** |
| `@nimbus-pos/web typecheck` (`tsc --noEmit`) | **PASS** (exit 0) |
| `@nimbus-pos/web lint` | **PASS** (exit 0, no warnings) |
| `@nimbus-pos/web build` (`next build`) | **PASS** (exit 0, compiled + static pages generated) |
| `GET /api/health` | **ok / db ok** |
| `git diff --check` | clean (CRLF notices only) |
| Postman JSON (56 files) | **53 valid; 3 pre-existing UTF-8 BOM** (M17/M18/M19 — unmodified vs HEAD, valid after BOM strip, Postman tolerates; out of Prompt-3 scope). The 4 Prompt-3 collections (BG4B handoff, M10 orders, M12 discounts, M14 void) are valid. |
| API `orders.service.spec.ts` (Jest) | **PASS — 26/26 tests** (exit 0) |

## 9. QA data plan
A written plan exists in `ai/SUPERVISOR_PROMPT3_QA_RECORD_REGISTER.md`. **Destructive
QA data was intentionally NOT created** this session (shared live DB + classifier
block). Runtime verification used **read-only** techniques (see §10–§11).

## 10. Live permission verification (read-only, executed) ✅
Authenticated as Supervisor (`supervisor@nimbus.demo`, branch `cb27be401a2c35dfc0d4e610`).
- `POST /api/auth/login` → **201** (correct per Rule P1); session token issued.
- `GET /api/auth/me` → **132 permissions**; contains 9 of the 10 in-scope grants.
- Direct DB read of `role_permissions` for role `Supervisor` corroborates exactly.

**Guard-boundary probes** (POST to each action on a **nonexistent** id — a 403 means
the permission is missing; any other code means the guard passed and *nothing could
mutate*):

| Action | Endpoint | Code | Meaning |
|---|---|---|---|
| Order read | `GET /pos/orders` | **200** | read access OK |
| Request bill | `POST …/request-bill` | 404 | perm GRANTED |
| Mark served | `POST …/mark-served` | 404 | perm GRANTED |
| Split bill | `POST …/split-bill` | 400 | perm GRANTED |
| Split items | `POST …/split-items` | 400 | perm GRANTED |
| Move items | `POST …/move-items` | 400 | perm GRANTED |
| Merge | `POST …/merge` | 404 | perm GRANTED |
| Void | `POST …/void` | 404 | perm GRANTED |
| Discount request | `POST …/discounts` | 404 | perm GRANTED |
| Discount approve | `POST /pos/discounts/…/approve` | 404 | perm GRANTED |
| Discount reject | `POST /pos/discounts/…/reject` | 404 | perm GRANTED |
| **Transfer table** | `POST …/transfer-table` | **403** | **perm MISSING — real gap** |

## 11–23. Live mutating action QA (Request bill … Complimentary)
**NOT EXECUTED against the shared Neon DB.** No real orders/discounts were created,
split, moved, merged, voided, or discounted; no browser flow ran. Rationale: shared
live database + safety-classifier block on writes + no isolated test DB. The
**permission reachability** of every in-scope action is verified (§10); the
**backend behaviour** of the order-service transitions is covered by the passing
`orders.service.spec.ts` suite (26/26). End-to-end financial/idempotency/rounding
assertions with real records remain **outstanding** (see §52).

## 24. Payment & financial integrity (verified in code)
`lib/supervisor/order-actions.ts` implements the documented **UI-only payment safety
boundary**: `MONEY_PAYMENT_STATES` (settled/partially-paid/pending/failed/refunded)
plus `paymentUnavailable` **fail-closed** (a failed/loading payment read pauses the
action — it never assumes "unpaid"). `requiresCleanPayment: true` on **void,
request-discount, approve-discount, complimentary**; **reject is NOT payment-gated**
(non-mutating). Basis is subtotal; the backend threshold decides APPROVED vs PENDING
(no optimistic totals). Documented: the backend endpoints do **not** themselves check
payment state — this remains a UI-only boundary (known limitation, not concealed).

## 25–27. Browser QA / viewport matrix / shared-Floor parity screenshots
**NOT EXECUTED.** No Playwright/Puppeteer/Cypress is installed in any workspace
`package.json`; real authenticated browser QA and viewport screenshots cannot be
produced here and were **not fabricated**. Shared-Floor parity was instead verified
**structurally in code**: `SupervisorFloorScreen` renders the shared
`@/components/floor/OperationalFloor` with an explicit "never forks the shared Floor"
contract, and Find order is injected as a Supervisor-only **sibling** above it.

## 28–29. Cross-role regression (code-level)
- **Waiter** nav = Floor/Reservations/Me; **Cashier** nav = Queue/Receipts/Till/Me — unchanged. Supervisor action controls/Find order do not leak into Waiter (separate component trees; shared Floor is presentation-only). Live browser regression not run (see §25).
- Cashier owns `transfer-server` (its own panel) and payment — out of Supervisor scope.

## 30. Role & security boundaries (verified)
- **No visible Orders tab** for Supervisor (`routes.ts` = Floor/Reservations/Approvals/Me); `/supervisor/orders` renders `SupervisorLegacyOrdersRedirect` → `router.replace` into Floor via the **same** `["supervisor","order-detail",branchId,orderId]` key (no loop, no duplicate detail fetch, context preserved).
- **transfer-server has NO UI**: only a registry entry in `order-actions.ts` carrying `blockedReason: "A safe server selector is not available in this version."` — no dialog/selector file exists.
- Supervisor action registry contains exactly the **13 in-scope keys** and **zero** forbidden actions (no payment-collect, order-close, refund-create, refund-approve, post-close-void). The workspace explicitly states these are "intentionally not shown here."
- **transfer-server coupling limitation stands**: `pos:order:transfer` gates both transfer-table and transfer-server. Because the Supervisor role currently **lacks** `pos:order:transfer` on this DB, *neither* is reachable at runtime right now; once the authorised mapping is applied, transfer-server becomes API-reachable with no UI (documented known limitation — the endpoint still requires active branch membership + audit).

## 31. Idle-session QA
Verified in code: `SupervisorShell` injects the shared `OperationalIdleLogoutHandler`
(single handler, `OPERATIONAL_IDLE_TIMEOUT_MS` = 15 min preserved). Deterministic
timer/browser test not run (no browser env). Production timeout unchanged.

## 32/35/36. Request counts / performance
Not measured live (no browser instrumentation). API cold boot showed one documented
Neon cold-start retry then healthy. No performance claims are made beyond `/api/health` ok.

## 37. Defects found
1. **[RUNTIME GAP — actionable] Supervisor role lacks `pos:order:transfer` on the active DB.** Confirmed via `/auth/me` (LACKS), direct `role_permissions` read, and a live **403** on `POST …/transfer-table`. **Transfer table (Prompt 3B2) is non-functional at runtime until the authorised seed mapping is applied.** This is a *seed-application* gap, not a code defect — the permission row exists, the code path exists, and the authorised mapping already exists in `seed.ts`.
   - **Authorised fix (apply in an environment cleared for live-DB writes):** run the documented seed command `corepack pnpm@8.15.0 db:seed` (idempotent; applies only the missing additive Supervisor→`pos:order:transfer` mapping and re-asserts the rest), **or** insert the single `role_permissions` row (roleId `cmqlcft890006wp6loken0xub` × permission `pos:order:transfer`). No schema/migration change.
2. **[NON-DEFECT] 3 Postman collections (M17/M18/M19) carry a UTF-8 BOM** that strict `JSON.parse` rejects but Postman tolerates — pre-existing, unmodified vs HEAD, out of Prompt-3 scope. Not fixed (editing Postman without a contract change is prohibited).

No other defects found within the executable verification scope.

## 38. Fixes made
**None applied.** The one actionable gap (transfer mapping) requires a live-DB write
that the safety classifier blocked and that I chose not to force on a shared database;
it is documented with its exact authorised fix instead. No code changes were made (no
evidence-based code defect surfaced within the executable scope).

## 39–41. Files created / modified / removed; backend/seed/Postman changes
- **Created:** `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3_CONSOLIDATED_LIVE_QA_COMPLETION_REPORT.md` (this file), `ai/SUPERVISOR_PROMPT3_QA_RECORD_REGISTER.md`.
- **Modified (docs only):** `ai/AI_STATUS.md`, `PROGRESS.md` (status + gap), plus the doc set noted in §40 of the prompt where a durable fact changed.
- **Removed:** none.
- **Backend / Prisma / migrations / seed / permissions / Postman:** **UNCHANGED.**

## 42–50. Validation results (executed)
typecheck **PASS** · lint **PASS** · build **PASS** · `orders.service.spec.ts` **26/26 PASS** · `/api/health` **ok/db ok** · `git diff --check` **clean** · Postman JSON **53/56 valid (+3 pre-existing BOM)**.

## 51. QA record register
`ai/SUPERVISOR_PROMPT3_QA_RECORD_REGISTER.md` — **no new mutated records created by 3C**; prior-prompt records catalogued for continuity.

## 52. Remaining limitations (carried forward)
1. Live **mutating** API QA (§11–§23) — needs an **isolated/authorised database**.
2. Authenticated **browser** QA + **four-viewport** matrix + screenshots (§25–§27) — needs **browser-automation tooling**.
3. **`pos:order:transfer` mapping must be applied** before Transfer table works at runtime.
4. UI-only payment safety boundary (backend endpoints don't self-check payment).
5. Backend self-approval / maker-checker guard for discounts still recommended.
6. transfer-server endpoint is API-reachable (once transfer perm is applied) with no UI — permission coupling limitation.

## 53. Prompt 3 final status
**C. IMPLEMENTED / QA BLOCKED.**
Implementation is verified present and correctly gated (static gates + code-level
locked decisions + runtime **read-only** permission verification + API health + the
order-service Jest suite all pass). The **destructive live-mutation QA and the
browser/viewport QA required by the §43 completion gate could not be executed** in
this environment (shared live DB + safety-classifier write block + no browser
tooling), and **one runtime gap** (unapplied `pos:order:transfer` mapping) leaves
Transfer table 403 until the authorised seed mapping is applied. Per the prompt's own
rule, **DEMO-READY (A) is not claimed** on typecheck/build alone.

## 54. Readiness for Reservations Prompt 4A
**Not started** (correctly out of scope). Recommended before 4A / a live demo:
(a) apply the authorised transfer mapping, (b) run the destructive live-mutation QA
on an isolated DB, (c) run the browser + four-viewport matrix once tooling is available.

## 55. No commit / no push
**Confirmed** — no `git commit`, no `git push`, no `reset`/`restore`/`stash`/`clean`.
Only additive documentation files were written.
