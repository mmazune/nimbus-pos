# Supervisor Reconstruction — Prompt 4B: Reservations UI Completion Report

**Date:** 2026-07-28
**Author:** Claude (Opus 4.8, 1M context)
**Final status:** **B. COMPLETE WITH KNOWN LIMITATIONS**
**Commit/push:** ⛔ none (no `git commit`, no `git push`)

---

## 0. Executive summary

The read-only Supervisor Reservations page (an all/today/upcoming **triple query**
at `pageSize: 100` merged in the browser by `mergeSupervisorReservationRows`) has
been **replaced** with a premium **master-detail operational workspace** built on
the Prompt 4A `scope=active|history` query contracts. It provides four views
(**Arriving / Seated / Attention / History**), Supervisor reservation **creation**,
the full **verified lifecycle** (confirm / assign-table / change-table / seat /
cancel / no-show / manual complete), truthful **automatic-completion** presentation,
an **Attention** workflow over overdue + structurally-inconsistent reservations
(individual actions only, no bulk resolution), **cross-role Waiter visibility**
via narrow invalidation, URL-persisted page state, and responsive/accessible
behaviour.

**Zero permission change and zero backend change** were required: the Supervisor
role already holds every `pos:reservation:*` permission (verified in the seed).

Classification is **B** because the shared Neon `production` branch still **lacks**
the Prompt 4A `ReservationEventType.COMPLETED` enum value (migration
`20260518000000_prompt4a_reservation_completed_event` unapplied — verified read-only
via Neon MCP). Consequently **manual complete** and **auto-completion-on-order-close**
would error on shared Neon until that migration deploys; **all other actions**
(create/confirm/assign/seat/cancel/no-show) and the **Attention/overdue** derivation
work on shared today.

---

## 1–8. Environment, safety, and Neon verification

1. **Repository path:** `C:\Users\arman\Desktop\nimbus-pos` (canonical; the
   forbidden `C:\Users\arman\Desktop\NIMBUS\nimbus-pos` was not touched).
2. **Initial branch / git status:** branch `main`; extensive pre-existing dirty
   worktree preserved (no reset/restore/stash/clean/checkout/discard). The twelve
   intentional Floor component deletions remain deleted.
3. **Neon MCP verification:** project **nimbus-pos** (`empty-glade-26849299`,
   org Moses, pg 17). Single branch **`production`** (`br-holy-darkness-a4fg93r2`,
   primary/default) → treated as the **shared** dev/demo branch, **read-only** for QA.
4. **Shared branch migration state (read-only SQL):** `_prisma_migrations` has **no**
   row matching the Prompt 4A migration; `enum_range(ReservationEventType)` =
   {CANCELLED, CONFIRMED, CREATED, DEPOSIT_FORFEITED, DEPOSIT_RECORDED,
   DEPOSIT_REFUNDED, NO_SHOW, SEATED, TABLE_ASSIGNED} — **`COMPLETED` absent**.
5. **Disposable branch:** a Prompt 4B disposable branch + full migrate/seed/demo
   + live mutation QA was **not** stood up in this environment — the destructive
   run requires a local API/web/browser stack unavailable to this background agent
   (see §40/§57 QA-blocked). No writes were made to shared Neon.
6. **Isolated migrations / 7. seed:** not executed here (see item 5); the Prompt 4A
   completion report already recorded a successful disposable-branch apply of the
   `COMPLETED` migration (`prompt4a-reservations-qa-*`).
8. **Documents read:** root `CLAUDE.md`, `.claude/CLAUDE.md`, `PROGRESS.md`,
   `ai/AI_STATUS.md` (Current State), the Prompt 4A completion report, the
   reservation lib/screen/components, backend reservations controller + service +
   all DTOs, the seed role-permission blocks, `ActionConfirmDialog`, the Prompt-3
   dialog + mutation patterns, the Playwright config + fixtures.

---

## 9–17. Architecture: old vs new, views, pagination, filtering, search

9. **Old Reservations architecture (removed from use):** `pages/supervisor/reservations.tsx`
   ran three overlapping `useQuery`s — `fetchSupervisorReservations({pageSize:100})`
   (all), `{date:today, pageSize:100}` (today), and upcoming — then merged/deduped
   them client-side (`mergeSupervisorReservationRows`) and filtered/sorted in the
   browser. Read-only; no lifecycle actions; large summary cards; a placeholder
   detail panel.
10. **Removed triple-query behaviour:** the new page issues **no** all/today/upcoming
    fetch and **no** browser merge. Arriving/Seated/Attention are derived from **one**
    bounded `scope=active` response; History is a **separate** `scope=history` query.
    No all-history initial fetch; no `pageSize: 100` default.
11. **New page architecture:** master-detail. Left = view selector + adaptive
    date/filter toolbar + paginated list region (`role="tabpanel"`). Right = the
    selected-reservation workspace (`xl:sticky`). On narrow viewports the list is
    full-width and the workspace stacks beneath (one detail instance only).
12. **View selector:** a semantic `role="tablist"` of four `role="tab"` buttons
    (Arriving/Seated/Attention/History) with `aria-selected`, arrow-key roving
    focus, concise count chips, and an emphasized (danger) Attention count. Selected
    state is underline + weight + `aria-selected` (never colour-only). No fifth "All".
13. **Arriving:** PENDING/CONFIRMED for the selected operational date, chronological.
14. **Seated:** SEATED visits (all dates), with manual completion.
15. **Attention:** derived — overdue PENDING/CONFIRMED (server `overdue`/
    `overdueByMinutes`, grace 15 min) plus SEATED structural issues (no linked order,
    linked order closed, no table). Bounded (over the bounded active set).
16. **History:** COMPLETED/CANCELLED/NO_SHOW only; server-paginated; date-range +
    terminal-status filter; read-only.
17. **Pagination:** History uses the canonical `{total,page,pageSize,totalPages}`
    response (default 25, max 100) with Previous/Next that retain view/filters in the
    URL; an out-of-range page auto-clamps to `totalPages` after the last row on a
    page transitions. The bounded active query (pageSize 50) drives Arriving/Seated/
    Attention; if the active set exceeds one page an honest "showing first N of M
    active" banner is shown (no silent cap).

---

## 18–33. Detail workspace, create, and each action

18. **Date/filter toolbar:** Arriving → prev/today/next + date picker (maps to Prompt
    4A `date`); History → from/to range + terminal-status select (maps to `from`/`to`/
    `status`); every view → a bounded search. Seated/Attention show an "all dates"
    note. All primary filters map to server params.
19. **Search:** client-side **within the loaded, bounded page**, labelled truthfully
    ("Search loaded reservations…"). No fetch-all-to-search; no cross-branch results;
    no raw-UUID-first experience (searchText covers name/table/number/status/source).
20. **Reservation rows:** time, guest **name**, party size, canonical status badge,
    table label or **Unassigned**, a concise attention chip, source; selected state via
    `aria-pressed`. No full phone/email, no raw ids, no long notes in rows.
21. **Detail workspace:** Back control; guest name + canonical status + schedule +
    party; attention banner; **only currently-valid actions** (never a disabled wall);
    Visit context (duration/source); Table & order (table, capacity, linked order +
    status, View-on-Floor link); Guest contact (phone/email, shown in detail only);
    Notes/special requests; Lifecycle events; read-only Deposits (when present).
22. **Create entry point:** one primary "Create reservation" button in the page header
    (reachable at all viewports); focused dialog; duplicate submissions prevented
    (button disables while pending).
23. **Create validation:** required guest name (≤200) + party size ≥1 + date + time;
    time-in-past blocked client-side (backend authoritative); email/phone format when
    supplied; duration ≥1; deposit ≥0; notes/special ≤1000. Selected time/party never
    silently changed; no auto table re-selection on conflict.
24. **Create table selection:** bounded same-branch `SupervisorReservationTableSelect`
    (label, capacity, operational status, under-capacity warning; "No table" allowed).
    No other guests' data exposed. Backend remains authoritative for time-window
    conflicts (surfaced as an error, not pre-blocked).
25. **Create submission:** on success → invalidate exactly the reservation + Floor +
    Waiter surfaces, one success toast, dialog closes, the new reservation is selected
    and its detail opens (view switches to Arriving on its date). No full reload; no
    broad invalidation.
26. **Confirm:** offered only for PENDING; focused confirm with optional note; canonical
    CONFIRMED response; no optimistic success.
27. **Assign / change table:** `assign-table` for PENDING/CONFIRMED/SEATED; "assign"
    when unassigned, "change" when reassigning; bounded selector; consequences stated;
    Floor overlay + Waiter Floor update; hard conflicts surfaced as backend errors.
28. **Seat:** offered only for CONFIRMED; requires a table (uses the assigned table or
    the selector); `dto.tableId || reservation.tableId`; **no order fabricated**
    (`createOrder` omitted → backend default). Table auto-occupies (backend). Detail
    stays open, now SEATED.
29. **Cancel:** PENDING/CONFIRMED only; destructive confirm; **reason required**; moves
    to History; does **not** delete the record.
30. **No-show:** PENDING/CONFIRMED only; **never** for SEATED; **never** automatic;
    optional reason; overdue duration shown; moves to History.
31. **Manual complete:** SEATED only; especially for seated reservations **without** a
    linked order; optional note; consequence is explicit ("does NOT close an order or
    collect payment"); moves to History; detail becomes terminal/read-only.
32. **Automatic completion presentation:** the workspace surfaces completion from the
    `COMPLETED` lifecycle event (message shown when present) and never issues the
    completion mutation itself; the backend order-close integration remains canonical;
    no duplicate/second manual completion appears on a completed record.
33. **Deposit boundary:** create accepts optional `depositRequired` (verified DTO field
    — an amount, not a payment); deposits render **read-only** in the workspace; **no**
    payment collection / capture / deposit recording UI.

---

## 34–39. Privacy, cross-role, errors, states

34. **Guest privacy:** names in lists; full contact only in the workspace/create form;
    no PII on Floor cards or table selectors; synthetic QA guests only; no form logging;
    no live guest data in snapshots.
35. **Cross-role cache contract:** `invalidateSupervisorReservationCaches()` invalidates
    Supervisor active/history/detail/events/upcoming + Supervisor Floor overlay
    (`["supervisor","floor",branchId]`) + Waiter reservations/floor
    (`["waiter","reservations"]`, `["waiter","floor"]`, `["waiter","reservation"]`).
    **Never** menu / profile / auth / active-shift / approvals / all-orders / cashier.
    Secondary invalidations are fire-and-forget (pending clears on the canonical
    response).
36. **Waiter visibility:** a Supervisor-created/confirmed/assigned/seated/cancelled/
    no-showed/completed reservation persists canonically and the Waiter surfaces are
    narrowly invalidated; a Playwright spec asserts a Supervisor-created reservation
    appears in Waiter Reservations. Waiter Reservations was not redesigned.
37. **Floor overlay behaviour:** assign/change/seat/cancel/complete invalidate the
    Supervisor + Waiter Floor overlays; the shared `OperationalFloor` is unchanged.
38. **Error handling:** `supervisorReservationActionErrorCopy()` maps 401/403/404/409/
    400 to operational copy (conflicting-reservation, stale-transition, table-must-be-
    assigned, table-not-found); 409/404 trigger a canonical detail refetch; recoverable
    create input is preserved; no raw Prisma/SQL shown; success only on canonical success.
39. **Loading/empty/error states:** per-view empty copy ("No arrivals for this date.",
    "No seated reservations.", "No reservations need attention.", "No reservation
    history matches these filters."); list skeletons while the toolbar stays usable;
    focused Retry that preserves view/date/filters.

---

## 40–42. Performance, accessibility, responsive

40. **Performance / request counts:** exactly one bounded `scope=active` request feeds
    the three active views; History adds a single lazy request only on that view;
    detail + events fetch once per selection; no all/today/upcoming triple request; no
    all-history initial fetch; no browser merge; no desktop/mobile double-mount; no
    mutation blocked on unrelated invalidation. **Live request-count instrumentation
    (route/view/date/page/detail/create/mutation timings) is QA-BLOCKED** — see §57.
41. **Accessibility:** `role="tablist"`/`tab`/`tabpanel` with `aria-selected`/
    `aria-controls`; arrow-key roving focus; rows are buttons with `aria-pressed` +
    visible focus; dialogs are `role="dialog" aria-modal` with focus-in / Escape /
    focus-return (via `ActionConfirmDialog` and the create dialog); status conveyed by
    label+badge (not colour alone); errors use `role="alert"`; date/time fields labelled.
42. **Responsive:** the layout collapses to a single column below `xl`; one detail
    instance; the list region scrolls; dialogs cap height and scroll internally. The
    Playwright `responsive.spec.ts` asserts **no horizontal overflow** across the four
    config viewports (1024×768/1366×768/1440×900/1920×1080) and that the create action
    is not covered — **execution of that suite is QA-blocked here** (§57).

---

## 43–50. Change inventory, backend, migration, seed, Postman

43. **Files created (10):**
    - `apps/web/src/components/supervisor/reservations/SupervisorReservationViewSelector.tsx`
    - `.../SupervisorReservationRow.tsx`
    - `.../SupervisorReservationsDateToolbar.tsx`
    - `.../SupervisorReservationTableSelect.tsx`
    - `.../SupervisorReservationWorkspace.tsx`
    - `.../SupervisorCreateReservationDialog.tsx`
    - `.../SupervisorReservationLifecycleDialogs.tsx`
    - `apps/web/e2e/supervisor-reservations/fixtures.ts` + 9 spec files
    - `ai/SUPERVISOR_RECONSTRUCTION_PROMPT4B_RESERVATIONS_UI_COMPLETION_REPORT.md` (this)
    - `ai/SUPERVISOR_RESERVATIONS_SHARED_NEON_DEPLOYMENT_READINESS.md`
44. **Files modified:** `apps/web/src/lib/supervisor/reservations.ts` (additive:
    mutations, view grouping, attention, action availability, cache invalidation, date
    nav); `apps/web/src/pages/supervisor/reservations.tsx` (full rewrite);
    `apps/web/src/components/supervisor/reservations/index.ts` (barrel); status/decision
    docs (see §55).
45. **Files removed (6, superseded read-only components):** `SupervisorReservationCard`,
    `SupervisorReservationList`, `SupervisorReservationsSummary`,
    `SupervisorReservationsToolbar`, `SupervisorReservationDetailPanel`,
    `SupervisorReservationStatusBadge`.
46. **Frontend changes:** as above — new premium reservations workspace + lifecycle
    dialogs + create form + lib extensions.
47. **Backend changes:** **none.**
48. **Prisma / migration changes:** **none** (the only relevant migration is the
    pre-existing Prompt 4A `20260518000000_prompt4a_reservation_completed_event`).
49. **Seed / permission changes:** **none** (Supervisor already holds every
    `pos:reservation:*` permission — verified in `packages/db/prisma/seed.ts`).
50. **Postman changes:** **none** — no contract change (M16 Reservations already covers
    the endpoints). The only pending Postman file in the worktree (`M16-…`) is
    pre-existing and unrelated to this prompt.

---

## 51–60. Validation results

51. **Reservation tests:** `jest reservations orders` (apps/api) → **2 suites, 67/67
    tests pass** (incl. manual-complete idempotency, concurrency compare-and-set,
    order-close auto-completion + its logged-not-swallowed failure branch, active/
    history scope split, pageSize clamp, overdue derivation).
52. **Prompt 3 regression:** the order service spec is part of the same 67/67 run
    (orders.service.spec.ts passed); no order-workspace code was touched.
53. **typecheck:** `pnpm --filter @nimbus-pos/web typecheck` → **pass** (0 errors).
54. **lint:** `pnpm --filter @nimbus-pos/web lint` → **pass** (no warnings/errors).
55. **build:** `pnpm --filter @nimbus-pos/web build` → **pass**;
    `/supervisor/reservations` = 21.4 kB (153 kB first load).
56. **API health:** `/api/health` — **QA-BLOCKED**: no API is running on `:3001` in this
    background environment (probe returned no response). Not fabricated.
57. **Playwright Supervisor QA:** suite `apps/web/e2e/supervisor-reservations/` (9 specs)
    **compiles and enumerates as 72 tests × 4 viewport projects**
    (`playwright test --list`). **Execution is QA-BLOCKED** (needs the isolated
    API :4001 / web :3100 / seeded demo stack + Chromium — not available here).
58. **Playwright Waiter QA:** `waiter-visibility.spec.ts` authored (Supervisor create →
    Waiter Reservations visible; no Supervisor-only controls on Waiter). Execution
    blocked as in §57.
59. **Cashier regression:** no Cashier code touched; order-close→reservation
    auto-completion path is covered by the passing order service spec. Live Cashier
    browser regression blocked as in §57.
60. **Four-viewport QA:** the responsive spec targets all four config viewports;
    execution blocked as in §57.

---

## 61–69. Evidence, cleanup, readiness

61. **Screenshots/traces:** none captured (browser execution blocked). Playwright is
    configured to retain screenshots/traces on failure when the suite is run.
62. **QA-created records:** none created on shared Neon (no disposable run here). The
    QA record register documents the intended `P4B-QA-<timestamp>` scenario matrix and
    the read-only shared-branch verification actually performed.
63. **Disposable branch cleanup:** n/a (none created this pass).
64. **Proof shared Neon received no destructive writes:** only two read-only `SELECT`s
    were issued via Neon MCP (`_prisma_migrations` filter, `enum_range`); no INSERT/
    UPDATE/DELETE/DDL. The shared enum still lacks `COMPLETED` (unchanged).
65. **Shared-Neon deployment readiness:** see
    `ai/SUPERVISOR_RESERVATIONS_SHARED_NEON_DEPLOYMENT_READINESS.md` — migration name,
    exact SQL, additive/idempotent risk, command, verification, rollback.
66. **Remaining limitations:** (a) shared Neon needs the Prompt 4A `COMPLETED` migration
    before **manual complete** and **auto-completion** work there (all other actions +
    Attention work today); (b) live authenticated browser + 4-viewport + `/api/health`
    + disposable-branch mutation execution is outstanding (environment lacks a running
    stack); (c) branch timezone not modelled — day edges are UTC (inherited Prompt 4A
    limitation); (d) the 6 order-less SEATED + 55 overdue actives identified in the
    Prompt 4A shared-data audit will surface in Attention **individually** (no bulk
    repair — a separate approval).
67. **Readiness for Approvals reconstruction:** the full Approvals-page reconstruction
    was **not** started (out of scope). Prompt 4B leaves the codebase ready for it.
68. **Final status:** **B. COMPLETE WITH KNOWN LIMITATIONS.**
69. **No-commit/no-push confirmation:** no `git commit` and no `git push` were run.

---

## Design & decision notes

- **One-active-query design (documented):** the active operational set is inherently
  bounded, so a single `scope=active` request (pageSize 50) feeds Arriving/Seated/
  Attention via client derivation. This directly eliminates the triple-query
  anti-pattern (there is literally one active request, no browser merge, no overlap)
  and matches §40's "one query for the active view; a separate query only when the
  user opens History." History is the only additional (lazy) query.
- **Action gating mirrors the backend** (`VALID_TRANSITIONS`) exactly so the UI never
  offers an action the service would 409.
- **No fabricated orders/payments:** seat omits `createOrder`; complete/cancel/no-show
  never touch orders or payment; deposits are read-only.
