# T3 progress (memory file; read this and `git log` first after a restart)

Track T3 — the one order screen. Branch `t3/order-screen`. Rules: `docs/prompts/LONG-RUN-RULES.md`.

## Now
- Phase 1, part a (read-back) done. Next: part b, `apps/web/src/screens/order/data/`.

## Baseline (26 Nov 2026, before any web change) [live]
- web typecheck 0; web lint `✔ No ESLint warnings or errors`; `check:ui` green; `check:event` green.
- API (E1 build) on :4111 against throwaway Postgres `t3_order` (seed + demo import): `/api/health` ok.

## Commits
| Phase.part | Commit | What |
|---|---|---|

## Decisions taken
1. `u0/foundations` not merged: `components/kit/index.ts` already exists on `rebuild/main` (the prompt merges it only when missing).
2. Test PINs: minted in the e2e setup through the manager's own reset route, held in memory only; a per-boot random pepper and JWT secrets are generated in the shell. Nothing secret is written to disk.
3. E2E specs live in `apps/web/e2e/order/` (a new folder; the prompt names no e2e folder, and the existing harness reads `e2e/`).
4. Fixture menu for "Table 12's evening" is created through the API by the manager in the test setup (the demo menu has no measures); fictional item names, throwaway database only.

## Left out (and why)
See `T3_READ_BACK.md` "What is missing".
