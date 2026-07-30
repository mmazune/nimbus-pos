# Prompt 4D — Database Isolation Evidence

**Date:** 2026-07-29 · **Status:** fail-closed isolation implemented, executed, and verified ·
**No secrets appear in this document** (passwords/connection strings are never printed; only
non-secret Neon endpoint/branch identifiers are recorded).

This document is the auditable evidence that all Prompt 4D mutation QA targeted a **disposable
Neon branch** and that shared/production Neon received **no QA writes** — the specific failure
mode of Prompt 4C (an inherited shell `DATABASE_URL` overrode a swapped `.env`).

---

## 1. Redacted endpoint identity

| Role | Project | Branch | Endpoint | Notes |
| --- | --- | --- | --- | --- |
| **Shared / production (READ-ONLY)** | `nimbus-pos` / `empty-glade-26849299` | `production` = `br-holy-darkness-a4fg93r2` | `ep-empty-paper-a4sogjap` | never written during 4D |
| **Disposable QA (mutations)** | same project | `br-shiny-dust-a4ns7urs` = `prompt4d-reservations-qa-20260729-170116Z` | `ep-frosty-firefly-a4rfugz9` (pooled) | forked from migrated `production` |
| **Retained recovery (untouched)** | same project | `br-dawn-truth-a4zjs1p7` = `prompt4c-predeploy-recovery-20260728-204019Z` | — | retained; NOT deleted |

Disposable endpoint (`ep-frosty-firefly-a4rfugz9`) ≠ shared endpoint (`ep-empty-paper-a4sogjap`):
**verified distinct** before any process started.

## 2. Inherited-variable detection

Checked at both the shell and the actual `process.env` level before launching anything:

```
DATABASE_URL         = (unset)
DIRECT_URL           = (unset)
DIRECT_DATABASE_URL  = (unset)
SHADOW_DATABASE_URL  = (unset)
```

No inherited DB URL was present this session. The launcher **still strips them fail-closed**
regardless (the 4C incident proves an inherited value can appear from a shell/profile), so the
guarantee does not depend on the parent shell being clean.

## 3. Explicit child-environment construction

`tools/qa/lib/isolation.mjs#buildIsolatedChildEnv` deletes every inherited DB/service key
(`DATABASE_URL`, `DIRECT_URL`, `DIRECT_DATABASE_URL`, `SHADOW_DATABASE_URL`, `PG*`, `API_PORT`,
`API_CORS_ORIGINS`, `NEXT_PUBLIC_API_BASE_URL`, `PW_*`) from a copy of `process.env`, then applies
the disposable values. Because `dotenv`/`ConfigModule` never override an already-set var, the API
child receives **only** the disposable `DATABASE_URL` — `apps/api/.env` (which points at
production) can no longer win.

## 4. Production/shared-target denylist (fail-closed)

`assertDisposableTarget(url, {expectedHostSubstr, forbiddenHostSubstrs})` throws unless the target
host contains the expected disposable endpoint id **and** contains none of the forbidden shared
ids. Executed proof:

- **NEGATIVE** — target host `ep-empty-paper-a4sogjap…` → `ISOLATION FAIL: target host matches
  forbidden/shared identifier "ep-empty-paper-a4sogjap" — refusing`, **exit 1, no connection made**.
- **POSITIVE** — target host `ep-frosty-firefly-a4rfugz9…` → denylist passed.

## 5. Disposable-branch sentinel

Created on the disposable branch **only** (never on shared), via Neon MCP, before API startup:

```
_p4d_qa_sentinel(marker text pk, branch_id text, created_at timestamptz)
marker = P4D-QA-20260729-170116Z, branch_id = br-shiny-dust-a4ns7urs
```

The table exists solely on `br-shiny-dust-a4ns7urs` and vanishes when the branch is deleted (no
repository migration; no shared-branch write).

## 6. DB-identity preflight (same Prisma client the API uses)

`tools/qa/db-identity-preflight.mjs` (resolves `@prisma/client` from `packages/db` — the exact
generated client the API loads) executed against the disposable `DATABASE_URL` and passed all
checks; health alone cannot prove this:

```
[preflight] ✓ denylist passed: host ep-frosty-firefly…(redacted) db=neondb
[preflight] ✓ prisma connected with the isolated DATABASE_URL
[preflight] ✓ disposable sentinel present (marker=P4D-QA-20260729-170116Z, branch=br-shiny-dust-a4ns7urs)
[preflight] ✓ required migration applied: 20260518000000_prompt4a_reservation_completed_event
[preflight] ✓ ReservationEventType.COMPLETED present
[preflight] ✓ demo branch row present: cb27be401a2c35dfc0d4e610
[preflight] ✅ ISOLATION VERIFIED — safe to run mutation QA against the disposable branch
```

## 7. Launcher chain + health

`tools/qa/run-isolated-api.mjs`: denylist → build explicit child env → preflight (with that exact
env) → spawn `apps/api/dist/main.js` only on success. Ran twice (once with CORS origin
`http://localhost:3101`, once `http://localhost:4100` after a Windows reserved-port change); both
executed the full chain and then:

```
GET http://localhost:4002/api/health -> {"status":"ok","db":"ok",...}
```

## 8. Proof mutations targeted the disposable branch

- The API accepting mutations is the exact process whose child env passed the preflight above.
- Every synthetic row is tagged `P4D-QA-20260729-170116Z`.
- Shared production was re-read (read-only) during and after QA and shows **0** `P4D-QA` rows and
  unchanged counts (section 9).

## 9. Shared before/after counts (read-only, Neon MCP)

Baseline (before any 4D activity) and post-QA (after all disposable QA + branch deletion):

| Metric | Before | After |
| --- | --- | --- |
| reservations total | 126 | _(appended at cleanup)_ |
| reservations by status | P9 / C52 / S6 / Cm57 / X1 / N1 | _(appended)_ |
| reservation_events total | 12 | _(appended)_ |
| P4D-QA marker rows | 0 | _(appended — expect 0)_ |
| orders / payments / users | 1223 / 750 / 19 | _(appended)_ |
| roles / permissions / role_permissions | 11 / 237 / 836 | _(appended)_ |
| migrations (total / rolled_back) | 58 / 0 | _(appended)_ |
| `ReservationEventType` values | 10 (incl COMPLETED) | _(appended)_ |
| supervisor `pos:order:transfer` mapping | 1 | _(appended)_ |
| recovery branch `br-dawn-truth-a4zjs1p7` | present | _(appended — retained)_ |

## 10. Disposable branch deletion

_(appended at cleanup: `br-shiny-dust-a4ns7urs` deleted; sentinel + all P4D-QA data removed with it.)_

## 11. Confirmation

_(appended at cleanup: no shared/production write occurred during Prompt 4D.)_
