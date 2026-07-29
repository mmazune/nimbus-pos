# Supervisor Reservations — Live QA Evidence Index

**Scope:** Prompt 4C shared-Neon cutover + QA closure. **No guest PII appears here**
(synthetic markers only). Updated 2026-07-29.

---

## A. Executed evidence (Prompt 4C)

### A1. Shared-Neon migration cutover (Neon MCP, read + authorized write)
| Item | Command / query | Result |
|------|-----------------|--------|
| Deploy | `db:migrate:deploy` (`prisma migrate deploy`, direct conn) against `production` | ✅ applied ONLY `20260518000000_prompt4a_reservation_completed_event` |
| Migration record | `SELECT … FROM _prisma_migrations WHERE migration_name=…` | ✅ finished 2026-07-28 20:42:02, not rolled back, steps=1 |
| Checksum | compare `_prisma_migrations.checksum` vs repo file sha256 | ✅ both `8f1317fa72baaddcd81d5410c8be3e9261e287fc465c3e8c2cf2d8ab382f6d7d` |
| Enum | `enum_range(ReservationEventType)` | ✅ COMPLETED present after SEATED; all 9 prior retained |
| Migration totals | count of `_prisma_migrations` | ✅ 58 total, 0 unfinished, 0 rolled back |
| Data invariance | reservation counts before/after | ✅ 126 → 126 (enum add mutated no rows) |

### A2. Seed (authorized) — Supervisor `pos:order:transfer`
| Item | Query | Result |
|------|-------|--------|
| Transfer mapping | Supervisor ⋈ role_permissions ⋈ permissions | ✅ `pos:order:transfer` present (was absent) |
| role_permissions delta | count before/after | ✅ 835 → 836 (exactly +1) |
| Unrelated data | reservations/orders/payments/users/roles/permissions counts | ✅ all unchanged |

### A3. Local static validation
| Gate | Result |
|------|--------|
| web typecheck | ✅ pass |
| web lint | ✅ no warnings/errors |
| web build | ✅ pass (`/supervisor/reservations` 21.4 kB) |
| reservations + orders Jest | ✅ 67/67 pass |
| Postman JSON parse | ✅ 56/56 (BOM-tolerant) |
| `git diff --check` | ✅ clean |

### A4. Isolated API (partial)
| Item | Result |
|------|--------|
| `nest build` | ✅ exit 0 |
| API boot :4002 → `/api/health` | ✅ `{status:ok, db:ok}` |
| Supervisor login (`supervisor@nimbus.demo`) | ✅ HTTP 201, token acquired |
| Create reservation via API | ⚠️ HTTP 201 but hit **production** (isolation failure) → row deleted, production restored to 126 |

## B. NOT executed — outstanding QA gate

The disposable-branch **live reservation matrix** and the **Playwright four-viewport
browser run** were **not** completed (isolation fragility + destructive-action
classifier; closed at B per user decision). The following are **authored and compile-
verified** (`playwright test --list` → 72 tests × 4 viewport projects) but not executed:

| Spec (`apps/web/e2e/supervisor-reservations/`) | Viewports | Status |
|---|---|---|
| navigation-and-default-view.spec.ts | 1024×768 / 1366×768 / 1440×900 / 1920×1080 | ⏳ authored, not run |
| create-reservation.spec.ts | all four | ⏳ authored, not run |
| arriving-actions.spec.ts | all four | ⏳ authored, not run |
| seated-and-completion.spec.ts | all four | ⏳ authored, not run |
| attention.spec.ts | all four | ⏳ authored, not run |
| history-and-pagination.spec.ts | all four | ⏳ authored, not run |
| waiter-visibility.spec.ts | all four | ⏳ authored, not run |
| responsive.spec.ts | all four | ⏳ authored, not run |
| privacy-and-boundaries.spec.ts | all four | ⏳ authored, not run |

- **Playwright command (for when a properly-isolated stack is available):**
  `PW_BASE_URL=http://localhost:3101 PW_API_URL=http://localhost:4002 PW_BRANCH_ID=<disposable-branch-supervisor-branch> corepack pnpm@8.15.0 --filter @nimbus-pos/web exec playwright test e2e/supervisor-reservations`
- **Screenshots/traces:** none (no browser run). Playwright retains screenshots + traces
  on failure under `apps/web/e2e/.evidence/` (git-ignored) when executed.
- **Synthetic marker convention:** `P4C-QA-<timestamp>` (contact data synthetic; never
  copied into reports/screenshots).

## C. Isolation lesson (for the next live run)
Swapping `apps/api/.env` is insufficient: a shell/profile `DATABASE_URL` overrides it
(`dotenv` won't override existing env). Before any write, **unset the inherited
`DATABASE_URL`**, point BOTH `apps/api/.env` and `packages/db/.env` at the disposable
branch, and **verify isolation with a read** (query which branch the API sees) before
creating data.
