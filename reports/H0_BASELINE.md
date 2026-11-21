# H0 baseline

Measured Sat 21 Nov 2026 on `concert/event-till--moses`, HEAD after commit `18d019c` (docs only on top of base `5a35a18`). Machine: macOS (Darwin 27.0.0). Node v22.23.2, pnpm 8.15.0 via `corepack pnpm@8.15.0`.

Every command ran from the repo root with `env -u DATABASE_URL -u DIRECT_DATABASE_URL`, and `corepack pnpm@8.15.0` is written below as `pnpm`. No database, server or `.env*` was touched. Setup: `pnpm install --frozen-lockfile` exit 0 (146 s), `pnpm db:generate` exit 0 (4 s).

## The seven runs

| # | What | Command | Exit | Count | Time |
|---|---|---|---|---|---|
| 1 | API lint | `pnpm --filter @nimbus-pos/api exec eslint "{src,test}/**/*.ts"` (no `--fix`) | **1 (red)** | 22,533 problems: 21,443 errors, 1,090 warnings | 9 s |
| 2 | API typecheck | `pnpm --filter @nimbus-pos/api exec tsc --noEmit -p tsconfig.build.json` | 0 | 0 errors; 520 non-node_modules files seen | 6 s |
| 3 | API unit tests | `pnpm --filter @nimbus-pos/api test` (jest) | 0 | **1,200 passed, 0 failed**, 67 suites | 26 s |
| 4 | API build | `pnpm --filter @nimbus-pos/api build` (`nest build`) | 0 | `dist/main.js` produced; 0 warnings | 8 s |
| 5 | Web lint | `pnpm --dir apps/web run lint` (`next lint`) | 0 | "No ESLint warnings or errors" | 4 s |
| 6 | Web typecheck | `pnpm --dir apps/web run typecheck` (`tsc --noEmit`) | 0 | 0 errors; 675 non-node_modules files seen | 6 s |
| 7 | Web build | `pnpm --dir apps/web run build` (`next build`) | 0 | 69 route lines; 0 warnings | 43 s |

Row 2 tsconfig: `apps/api/tsconfig.build.json`, which `nest build` uses by default (`nest-cli.json` sets no `tsConfigPath`). It extends `tsconfig.json`, excludes `node_modules`, `test`, `dist` and `**/*spec.ts`, and sets `outDir: ./dist`.

## What is red on the base (recorded, not fixed)

- **Row 1, API lint: 22,533 problems** (21,443 errors, 1,090 warnings) in 303 of 637 linted files. Exact counts, from a second run with `-f json` that reproduced the same totals: `prettier/prettier` 21,424 errors; `@typescript-eslint/no-explicit-any` 1,090 warnings; `@typescript-eslint/no-unused-vars` 15 errors; `@typescript-eslint/ban-types` 3 errors; `prefer-const` 1 error. ESLint's own summary says 21,425 errors are fixable with `--fix`: that is the repo-wide prettier drift `CLAUDE.md` §10 (batch 3) describes. The API `lint` script has `--fix` baked in and rewrote 193 files once, so it was not run.
- Per-rule and per-file counts are in `reports/proof/H0_api_lint_by_file.txt`. **H1 rule: lint only its own new and touched files, and compare each file's count against that list; a touched file must not get worse, and a new file must have 0 errors. The 22,533 total is not a target.**

## Expected vs measured

- Row 3 expected "about 1,184 or more, 0 failing". Measured **1,200 passed, 0 failing** (16 above the B6 report). **H1 baseline for unit tests: 1,200 / 67 suites.**

## Tree after the runs

`git status --porcelain` showed nothing apart from `reports/`. `dist/`, `.next/` and `node_modules/` are in `.gitignore`.

## Limits of this baseline

- Only graded [live] for what ran here: rows 1–7 on this machine, one run each. Times are single runs, not medians.
- `next lint` prints no file count, and I did not plant a violation to prove it scans `apps/web`. Its 4 s and the green result are therefore unverified as a gate. The two `tsc` rows were checked with `--listFilesOnly` (520 and 675 files), so they are not empty.
- Unit tests mock Prisma; they prove no database behaviour. No database was reached: the folder holds only `.env.example` files (checked by name, none read; no real `.env*` exists, ignored or not), both database variables were unset for every command, and the web build log shows no env loading.
- The document secret scan (connection strings, token patterns, key blocks, phone numbers) found nothing. It did not look for demo passwords: `docs/event/research/G1` and `G3` quote the seeded demo logins and PINs (for example `Owner#123`), which are already in `packages/db/prisma/seed.ts` and `apps/api/test/orders.e2e-spec.ts`. They are public in the repo and must never exist on the event database (EV-18).

## Known history, not measured here

- The last full four-viewport Playwright sweep on this tip (B6.7) ended with **41 failures that were never burned down**. Playwright and `test:e2e` need a database, so H0 did not run them.
- The CI workflow (`.github/workflows/branch-validation.yml`) runs `pnpm lint` (with `--fix`) and has no build job and no `concert/**` trigger (G3 §8).
- This repo has no `.loadmaster.toml`, so the checks ran directly, not through loadmaster.
