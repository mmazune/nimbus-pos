# Completion Report - CASHIER UI Prompt 1 Shell Foundation

## Context Snapshot

- Current milestone: Cashier UI extension build - Prompt 1 shell/design foundation and permission alignment.
- Previous completed milestone: Waiter MVP UI fix pass / final QA work recorded in `ai/AI_STATUS.md`.
- Next milestone: Cashier Prompt 2 - auth/session/context routing with active shift/till read checks.

## Summary

- Built the cashier workspace route foundation for `/cashier/queue`, `/cashier/receipts`, `/cashier/till`, and `/cashier/me`.
- Added a guarded `CashierShell` with header, readiness strip, fixed bottom navigation, caveat banners, and reusable empty/blocked state primitives.
- Updated login routing so Cashier users land on `/cashier/queue` while Waiter users still land on `/waiter/floor`.
- Aligned the Cashier seed permissions by adding `pos:orders:close` and retaining `pos:payment:close`.

## Files Added / Changed

- `apps/web/src/components/cashier/shell/CashierShell.tsx`
- `apps/web/src/components/cashier/shell/CashierHeader.tsx`
- `apps/web/src/components/cashier/shell/CashierBottomNav.tsx`
- `apps/web/src/components/cashier/shell/CashierSessionGuard.tsx`
- `apps/web/src/components/cashier/shell/CashierReadinessStrip.tsx`
- `apps/web/src/components/cashier/shell/CashierIdleLogoutHandler.tsx`
- `apps/web/src/components/cashier/states/CashierCaveatBanner.tsx`
- `apps/web/src/components/cashier/states/CashierEmptyState.tsx`
- `apps/web/src/components/cashier/states/CashierBlockedState.tsx`
- `apps/web/src/lib/cashier/routes.ts`
- `apps/web/src/lib/cashier/permissions.ts`
- `apps/web/src/lib/cashier/state.ts`
- `apps/web/src/lib/cashier/formatters.ts`
- `apps/web/src/pages/cashier/queue.tsx`
- `apps/web/src/pages/cashier/receipts.tsx`
- `apps/web/src/pages/cashier/till.tsx`
- `apps/web/src/pages/cashier/me.tsx`
- `apps/web/src/lib/auth/role.ts`
- `apps/web/src/lib/auth/types.ts`
- `apps/web/src/lib/auth/AuthProvider.tsx`
- `apps/web/src/pages/login.tsx`
- `packages/db/prisma/seed.ts`
- `ai/AI_STATUS.md`
- `repo file tree.txt`

## Database

- Prisma models added/changed: none.
- Migration name: none.
- Indexes / constraints: none.
- Seed updates: Cashier role now includes `pos:orders:close`; `pos:payment:close` remains present.
- Notes: seed was not run, per prompt instruction.

## API

- Modules added/changed: none.
- Endpoints added/updated: none.
- Guards applied: frontend `CashierSessionGuard` only.
- Audit coverage: unchanged.
- Idempotency coverage: unchanged.

## Tests

- Unit tests: not added for this frontend shell prompt.
- e2e tests: not run.
- Commands run:
  - `corepack pnpm@8.15.0 --version`
  - `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`
  - `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`
- Results:
  - pnpm version: `8.15.0`
  - Web typecheck: passed.
  - Web lint: passed with no warnings or errors.

## Postman

- Collection added/updated: none.
- Variables/tests added: none.
- Manual checklist executed: not applicable for Prompt 1 because Postman edits and Newman runs were explicitly deferred.

## Docs

- ROADMAP status impact: frontend cashier foundation started.
- Files updated: `ai/AI_STATUS.md`, `repo file tree.txt`, and this completion report.

## DONE Checks

- `pnpm lint`: passed via `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`.
- `pnpm test`: not run; no frontend tests exist for this shell foundation.
- `pnpm db:migrate`: not run, per prompt instruction.
- `pnpm db:seed`: not run, per prompt instruction.
- relevant local run command(s): no duplicate API or web server was started.

## Decisions / Deviations

- Cashier compatibility is restricted to `jobRole === CASHIER` or a role named `Cashier`; owner/manager cashier impersonation remains future work.
- Active shift/till calls are not wired in Prompt 1; readiness chips show neutral/pending states only.
- The existing waiter idle logout handler is reused through `CashierIdleLogoutHandler` to preserve the established shared-terminal timeout behavior.
- Cashier docs were not present at `docs/cashier-ui-docs`; the checked-in copies under `Front End/cashier_ui_docs_pack` were read instead.

## Known Issues

- The working tree had substantial pre-existing modified/untracked files, including backend, Postman, and frontend files outside this prompt. They were left untouched except for the scoped files listed above.
- Browser route smoke was not run because the prompt disallowed starting duplicate servers, and no existing server was used.

## Next Step

- Cashier Prompt 2: wire cashier auth/session/context more deeply, add active shift/till read queries where safe, and keep all payment/till writes deferred.
