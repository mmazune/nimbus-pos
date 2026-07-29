# Claude Repository Onboarding & UI Verification Report

- **Author:** Claude (Opus 4.8, 1M context) via Claude Code
- **Date:** 2026-07-26
- **Pass type:** Onboarding · documentation consolidation · implementation
  verification · safe UI polish. **No new feature phase.**
- **Commit/push:** ⛔ None. Worktree preserved.

---

## 1. Repository path

- Canonical (used): `C:\Users\arman\Desktop\nimbus-pos`
- Forbidden/stale (not touched): `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`

## 2. Initial branch & git status

- Branch: `main`; HEAD `174a787 feat: add role workflows and demo data`.
- Large **dirty worktree** (authoritative). Tracked modifications across
  `apps/web`, `apps/api` (auth/orders perf hardening), `packages/db`, docs, and
  Front End packs; role-specific Waiter/Supervisor floor components + waiter
  `CurrentTime` **deleted**; many untracked new files (shared `components/floor/`,
  `components/pos-shell/`, `components/profile/`, `lib/profile/`, supervisor/waiter
  workspace + legacy-redirect components, new `ai/` reports, new
  `docs/supervisor-ui-docs/*`, `PRODUCT.md`, demo CSVs, `apps/web/scripts/*`,
  `apps/web/public/`).
- Processes/ports at start: **no** node processes; `:3000`/`:3001` free.
- Generated QA artifacts present (root `_*.txt/.log/.cjs/.mjs`, `seed*.log`,
  `_qa-logs/`) — left untouched.

## 3. Repository inventory (grouped)

- **App code:** `apps/web` (`@nimbus-pos/web`, Next 14 Pages Router), `apps/api`
  (`@nimbus-pos/api`, NestJS, 53 modules).
- **Shared UI:** `apps/web/src/components/pos-shell/`, `.../floor/`, `.../profile/`
  (+ `lib/profile/`, `lib/api/client.ts`).
- **Waiter:** `components/waiter/*`, `lib/waiter/*`, `pages/waiter/*`.
- **Cashier:** `components/cashier/*`, `lib/cashier/*`, `pages/cashier/*`.
- **Supervisor:** `components/supervisor/*`, `lib/supervisor/*`, `pages/supervisor/*`.
- **Manager:** planning docs only (no app code).
- **API modules:** 53 (auth, orders, payments, floor, reservations, menu, kds,
  tills, receipts, refunds, unified-approvals, hms-integration, …).
- **DB:** `packages/db/prisma` (schema, ~65 migrations, `seed.ts`, `demo-import.ts`).
- **Postman:** 56 collections in `postman/collections/`.
- **Tests/QA:** `apps/web/scripts/*-assertions.ts` (static guards); no Jest web tests.
- **Docs:** `docs/*`, `ai/*`, `Front End/*`, root README/ROADMAP/PRODUCT/AGENTS.
- **Generated/temp:** root/`apps/api`/`packages/db` `_*`/`seed*` dumps, `_qa-logs/`.

Full map: `docs/REPOSITORY_MAP.md`.

## 4. Instruction files read

Root `AGENTS.md` + inlined governance (`ai/AI_GOVERNANCE_PROMPT_UPDATED.md`,
`ai/AI_ERROR_PROTOCOL.md`, `ai/AI_POSTMAN_WORKING_PATTERNS.md`,
`ai/AI_CONTEXT.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`,
`docs/POSTMAN_ENDPOINT_GUIDE.md`, `docs/API_CONVENTIONS.md`), plus role AGENTS.md
under `Front End/{waiter,cashier,supervisor,manager}` packs. `.claude/CLAUDE.md`
(project instructions) already present and honoured.

## 5. Documentation inventory

Catalogued in `docs/DOCUMENT_INDEX.md` (root, `docs/`, `docs/supervisor-ui-docs/`,
`Front End/*` packs, `ai/` reports, demo-data). ~90 milestone/UI completion
reports; multiple design packs; three Postman-guide copies; two demo-data copies.

## 6. Canonical documentation decisions

- **Backend/system architecture:** `docs/ARCHITECTURE.md` (kept; not rewritten).
- **Frontend operational UI architecture:** new `docs/UI_SYSTEM.md`.
- **Current Supervisor UI:** `docs/supervisor-ui-docs/*` + `ai/SUPERVISOR_RECONSTRUCTION_*`.
- **Current Waiter UI:** `Front End/waiter-ui-docs/*` (already updated to shared Floor).
- **Progress:** `ai/AI_STATUS.md` (detail) indexed by new `PROGRESS.md`.
- **Postman guide canonical:** `docs/POSTMAN_ENDPOINT_GUIDE.md` (others = duplicates).
- **Demo-data canonical:** `demo-data/**` (enterprise pack copy = duplicate).

## 7. Legacy & superseded documents

- **Superseded (5-tab Supervisor w/ Orders tab + role-specific Floor):**
  `Front End/supervisor_ui_docs_pack/**` and legacy `ai/SUPERVISOR_UI_*` prompt
  reports (esp. `SUPERVISOR_UI_PROMPT4_ORDERS_COMPLETION_REPORT.md`,
  `SUPERVISOR_UI_FINALIZATION_REPORT.md`). Historical `ai/AI_STATUS.md` entries
  describing the old nav remain as history (superseded by newer top entries).
- **Supersession banners added** (this pass) to the 6 primary legacy pack docs:
  `README.md`, `AGENTS.md`, `supervisorui.md`, `supervisor_design.md`, `DESIGN.md`,
  `SUPERVISOR_LIFECYCLE.md` under `Front End/supervisor_ui_docs_pack/docs/supervisor-ui-docs/`.
- Historical completion reports were **not rewritten**; they are classified as
  generated evidence in `docs/DOCUMENT_INDEX.md`.

## 8. CLAUDE.md

New root `CLAUDE.md` — primary onboarding: purpose, canonical/forbidden paths,
pnpm pin, commands, structure, source-of-truth map, dirty-worktree safety,
no-commit rule, role boundaries + locked nav, current milestone, locked
Waiter/shell/Floor/Supervisor decisions, Prompt-3-not-started, UI/shared-component/
icon rules, DB/migration rules, performance-preservation, validation/completion
expectations, high-risk areas, deferred features, and doc-vs-code conflict rule.

## 9. PROGRESS.md

New root `PROGRESS.md` — status date, per-role completion, completed workstreams,
active/next milestone, blocked/deferred work, known limitations, validation table,
dirty-worktree warning, no-commit status. Indexes `ai/AI_STATUS.md`.

## 10. Architecture updates

Root `ARCHITECTURE.md` created as a concise index → `docs/ARCHITECTURE.md`
(backend, unchanged) + `docs/UI_SYSTEM.md` (frontend). Documents the shared shell
→ role adapters → routes and shared Floor → Waiter/Supervisor workspace dependency
chains, URL-backed context, route compatibility, and the performance foundation.

## 11. Additional documents created

`docs/DOCUMENT_INDEX.md`, `docs/REPOSITORY_MAP.md`, `docs/UI_SYSTEM.md`,
`docs/ROLE_JOURNEYS.md`, `docs/ROLE_CAPABILITY_MATRIX.md`, `docs/DECISIONS.md`,
`docs/TESTING_AND_QA.md`, `docs/KNOWN_LIMITATIONS.md`.

## 12. Implementation milestone verified

**Waiter complete + Cashier complete + Supervisor Reconstruction Prompt 0/1/2
complete; Prompt 3 NOT started.** Verified against code (routes, navigation,
components, redirects) and static assertions.

## 13. Waiter findings

Nav = Floor/Reservations/Me (`lib/waiter/routes.ts`); Floor tab stays active on
`/waiter/orders*`; `/waiter/orders` + `/waiter/orders/[orderId]` are redirect-only.
Floor renders shared `OperationalFloor`; selection mounts `WaiterTableWorkspace`.
No stale role-specific floor imports. No visual regression found in code review.

## 14. Cashier findings

Nav = Queue/Receipts/Till/Me (`lib/cashier/routes.ts`). Uses shared shell + profile
primitives. No Supervisor controls; payment boundary intact. Login/`me` smoke OK.

## 15. Supervisor findings

Nav = Floor/Reservations/Approvals/Me (`lib/supervisor/routes.ts`) — **no Orders
tab**. `/supervisor/orders` → `SupervisorLegacyOrdersRedirect` resolves
`orderId`→`tableId` and `router.replace`s to Floor. Floor = shared
`OperationalFloor`; selection opens read-first `SupervisorTableControlWorkspace`.
Only the verified table-status mutation is live. **Note:** the visual
`SupervisorOrder*` components still exist but are referenced only within their own
folder (dead-but-reserved for Prompt 3); the order **data layer**
(`lib/supervisor/orders.ts`) is actively used by the shared Floor workspace,
approvals, and the legacy redirect — retained, not deleted.

## 16. Shared-shell findings

`OperationalShell` + role adapters + shared header/clock/logout/bottom-nav +
canonical icon registry confirmed. Fixed-region layout with correct bottom-nav
clearance. **Finding:** `SupervisorShell` omits the `idleHandler` slot that Waiter
and Cashier inject → supervisor sessions do not auto-logout on idle (documented,
not patched — auth-behaviour change). **Finding:** shared/cashier idle handlers
consume waiter-namespaced constants (naming smell; documented).

## 17. Shared-Floor findings

Waiter & Supervisor consume one `OperationalFloor` (toolbar, grid, card, status
badge, workspace frame). Staff formatting `First L.` and status labels are shared;
cards never expose guest names. Single responsive workspace (no double-mount).
Confirmed by `floor-assertions.ts`.

## 18. Documentation/code mismatches

- Legacy Supervisor pack + old `ai/SUPERVISOR_UI_*` reports assert a 5-tab nav with
  an Orders screen and role-specific Floor → **superseded** (banners added / indexed).
- `docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md` has a banner but retains
  legacy "Orders" rows → flagged as historical in `docs/DOCUMENT_INDEX.md`.
- `README.md`/`ROADMAP.md` frontend sections ("frontend deferred / next M43") are
  behind reality → noted in the index; left as backend-canonical.
- `repo file tree.txt` is a stale generated snapshot (lists deleted components) →
  superseded as a live authority by `docs/REPOSITORY_MAP.md`; **not regenerated**
  to avoid a large noisy diff (documented here).

## 19. UI defects found

1. `OperationalTableCard` capacity: visible `"? seats"` vs accessible "seat
   capacity unavailable" (label divergence). **Fixed.**
2. Supervisor idle-logout omission. **Documented** (out of polish scope).
3. Cross-role idle-constant naming smell. **Documented.**
4. Floor toolbar large min-widths on narrow viewports — wraps, no confirmed
   overflow. **Documented, not changed.**

## 20. Polish fixes made

- `apps/web/src/components/floor/OperationalTableCard.tsx`: capacity footer now
  renders the shared `capacityLabel`, so visible and `aria-label` text agree for
  tables with and without capacity. Verified against both consuming roles
  (identical shared component). No behavioural change for tables that have capacity.

## 21. Files created

- Root: `CLAUDE.md`, `PROGRESS.md`, `ARCHITECTURE.md`.
- `docs/`: `DOCUMENT_INDEX.md`, `REPOSITORY_MAP.md`, `UI_SYSTEM.md`,
  `ROLE_JOURNEYS.md`, `ROLE_CAPABILITY_MATRIX.md`, `DECISIONS.md`,
  `TESTING_AND_QA.md`, `KNOWN_LIMITATIONS.md`.
- `ai/CLAUDE_REPOSITORY_ONBOARDING_AND_UI_VERIFICATION_REPORT.md` (this report).

## 22. Files modified

- `apps/web/src/components/floor/OperationalTableCard.tsx` (polish).
- `ai/AI_STATUS.md` (new dated Current-State entry).
- Supersession banners: `Front End/supervisor_ui_docs_pack/docs/supervisor-ui-docs/`
  `README.md`, `AGENTS.md`, `supervisorui.md`, `supervisor_design.md`, `DESIGN.md`,
  `SUPERVISOR_LIFECYCLE.md`.

## 23. Files removed

None. No deletions performed in this pass.

## 24. Performance regression results

No performance-affecting code changed. The only code edit is a JSX text swap in a
shared card. Auth/orders perf hardening (JWT claim reuse, `/auth/me`
parallelisation, branch-guard caching, bounded API client, non-blocking
invalidations, removed list N+1) remains intact. Representative live checks:
`/auth/me` returned 200 for all three roles; API booted cleanly on `:3001`.
(Deep per-flow request-count profiling requires browser automation — not run;
prior evidence: cashier startup ~101→~9 requests.)

## 25–28. Validation results

| Gate | Command | Result |
| --- | --- | --- |
| pnpm | `corepack pnpm@8.15.0 --version` | `8.15.0` |
| Typecheck | `--filter @nimbus-pos/web typecheck` | ✅ pass |
| Lint | `--filter @nimbus-pos/web lint` | ✅ "No ESLint warnings or errors" |
| Build | `--filter @nimbus-pos/web build` | ✅ compiled + static pages generated |
| Static assertions | `tsx apps/web/scripts/{floor,shell,profile}-assertions.ts` | ✅ all pass |
| API health | `GET /api/health` | ✅ `{status:ok, db:ok}` HTTP 200 |
| `git diff --check` | — | ✅ clean (LF→CRLF info warnings only) |

## 29. Postman validation

All **56** collections parse as valid JSON. 3 carry a legacy UTF-8 BOM
(`M17`, `M18`, `M19`) that Node's `JSON.parse` rejects but Postman/newman tolerate;
BOM removal is not a contract change, so files were **not** modified. Postman
contract diff: **empty** (no contract change required this pass).

## 30. Authenticated QA (API-level)

`POST /api/auth/login` returned **201** with valid access tokens and
`GET /api/auth/me` returned **200** with correct roles for
`waiter@nimbus.demo` (Waiter), `cashier@nimbus.demo` (Cashier),
`supervisor@nimbus.demo` (Supervisor). Structural invariants (four-tab nav / no
Orders tab, shared Floor, card safety/no guest names, single responsive workspace,
legacy redirect, fixed offsets) verified via passing static assertion scripts.

## 31. Viewport QA

Full authenticated **browser** visual QA at 1024×768 / 1366×768 / 1440×900 /
1920×1080 was **not executed** in this environment (no browser automation
configured; would be heavy and prior waves already captured it). Geometry
invariants (fixed offsets, single responsive workspace, four-tab layout) are
covered by the passing `shell`/`floor` assertion scripts. This is reported
honestly rather than fabricated. Recommendation: run the documented viewport
matrix in `docs/TESTING_AND_QA.md` with a browser before the next demo.

## 32. Unresolved gaps

- Supervisor idle-logout omission (needs a deliberate auth-behaviour decision).
- Cross-role idle-constant naming (future rename to a shared namespace).
- Backend contracts blocking UI: per-line sent-order state (WKL-010),
  reservation-completion endpoint/enum (SUP-RG-008/009).
- `repo file tree.txt` stale (superseded by `docs/REPOSITORY_MAP.md`).
- Browser viewport QA not run in this pass.

## 33. Deferred work

Supervisor Prompt 3+ (Floor-contained order workspace + exception lookup + vetted
order/approval/reservation/refund actions); Manager UI; and the product-level
deferrals in `docs/KNOWN_LIMITATIONS.md` (accounting, payroll admin, franchise,
dev portal, SaaS billing, live diner mobile money, printers, terminals, MSR/badge,
smart spouts).

## 34. Final repository readiness status

**Green for continuation.** Static validation (typecheck/lint/build/assertions),
API health, and authenticated API smoke all pass. Documentation is consolidated
with canonical vs legacy clearly marked. Worktree preserved; no commit/push.
Waiter/Supervisor Floor parity and no-visible-Orders-tab invariants intact.

## 35. Recommended next development prompt

**Supervisor Reconstruction — Prompt 3:** move Supervisor order work behind Floor
table selection and add exception lookup for tableless/takeaway/closed/
direct-reference/post-close cases, **without** recreating primary nav or an Orders
tab. Reuse the reserved `components/supervisor/orders/SupervisorOrder*` visual
components inside the Floor workspace. Coordinate the backend
reservation-completion contract separately before the Supervisor reservation
lifecycle work. See `ai/SUPERVISOR_RECONSTRUCTION_ROADMAP.md`.
