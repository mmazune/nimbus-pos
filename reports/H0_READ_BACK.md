# H0 read-back (Sat 21 Nov 2026, Sonnet 5.5)

Skill `moses-build-standards` loaded; type A (product app); §0, §1.3, §6, §7, §8 applied.

## What H0 does
- Commits the existing untracked `docs/event/` (16 files) and `docs/prompts/` (H0, H1) plus a new `docs/prompts/README.md` index. Commit 1.
- Installs (`--frozen-lockfile`), runs `db:generate`, then measures 7 checks once each; writes `reports/H0_BASELINE.md`. Commit 2.
- Adds `tools/check-event.mjs` + root script `check:event`, proved red then green (`reports/proof/check-event.txt`). Appends one `PROGRESS.md` line and marks H0 done in the prompts index. Commit 3.

## What H0 does not do
No schema, migration, API or web code; no database, Docker or server; no `.env*` read; no Playwright or `test:e2e`; no fixing of red results on the base; no push, merge or deploy; nothing written under `~/Desktop`.

## Room check (§0): all true
- `pwd` = `~/Code/nimbus-pos-event`; branch `concert/event-till--moses`; `git merge-base --is-ancestor 5a35a18 HEAD` exits 0.
- `docs/event/` = 16 files (includes `prompts/HANDOVER.md`); `docs/prompts/` = H0 + H1; only those two dirs are uncommitted.
- Node v22.23.2, pnpm 8.15.0 via corepack. No dev server runs from this folder.

## Commands
- Every command runs as `env -u DATABASE_URL -u DIRECT_DATABASE_URL corepack pnpm@8.15.0 …`.
- Lint API: `eslint "{src,test}/**/*.ts"` directly, no `--fix`. Typecheck API: `tsc --noEmit -p apps/api/tsconfig.build.json` (the config `nest build` uses; it extends `tsconfig.json`, excludes specs and `test/`).
- API tests `--filter @nimbus-pos/api test` (jest); API build `nest build`; web `lint` (`next lint`, no `--fix`), `typecheck` (`tsc --noEmit`), `build` (`next build`).
- Guard: `node tools/check-event.mjs`.

## Contradictions and notes (docs/event vs code and prompt)
1. `06_MILESTONES` H0 says copy `docs/event/` from `~/Desktop/Nimbus/POS/`. It is already in this folder, untracked, so no Desktop read is needed. The prompt matches the folder.
2. Project `CLAUDE.md` §8 says no commit unless asked. The H0 ship policy ("commit per checkpoint") is that ask. No push.
3. `CLAUDE.md` §16 also wants `ai/AI_STATUS.md` and a completion report. H0 builds nothing, so I follow the prompt: `PROGRESS.md` line only.
4. `CLAUDE.md` §2 names a Windows path. Irrelevant here; the prompt's folder wins.
5. `apps/api` `lint` script has `--fix`; CI (`G3` §8) runs it via `pnpm lint`. I avoid it; not changing CI.
6. `.gitignore` covers `dist/`, `.next/`, `node_modules/`, `.turbo/`; `reports/` is not ignored, so it will be committed as the prompt intends.
7. No `.loadmaster.toml` exists in this repo (`loadmaster guide` says so). Changing it is not H0's task.

## Questions with defaults
- Q1: Will the router rewrite `pnpm test` / `next build` to `qrun`? Default: run them as written; accept a rewrite; if blocked, record it as a finding and report via `ccr`.
- Q2: `pan` as a field name is a short token. Default: match it only as a whole identifier or key (`\bpan\b` in a declaration or property position), never inside words such as `expand` or `panel`.
- Q3: If the base already has hits, they go into `tools/check-event.allow.json` with a reason. No pattern is loosened.
- Q4: Baseline reds (lint, type, tests, build) are recorded, not fixed. If the tree is dirty after the runs from something other than `reports/`, I record that as a finding, not clean it silently.
