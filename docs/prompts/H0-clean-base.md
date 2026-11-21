# H0 — Clean base for the Event Till

Model: Sonnet. If you are not Sonnet, say so and stop.
Size: S (1–2 h) · Sat 21 Nov 2026 · Depends on: nothing
Folder: `~/Code/nimbus-pos-event` · This is the only session in this folder.
Branch: `concert/event-till--moses`, cut from `rescued/main-2026-11-15` (tip `5a35a18`)
Ports: none · Database: none. H0 touches no database and starts no server.
Ship policy: commit per checkpoint; no push, no merge, no deploy.

First: load `moses-build-standards`, say so, and read §0, §1.3, §6, §7, §8 (type A, product app).

## Why

- Moses, 21 Nov 2026: "the gaps we really, really have that we need to close before the concert in seven days… for manager, everyone".
- Moses, 18 Nov 2026: "They want to know how much payments like cash, card, how much came from Visa, what items are bought from Visa".
- The real case every milestone is judged against: **"2 beers, Visa, at a bar till with no signal."**
- Nimbus POS runs the food and drinks tills at a concert on Sat 28 Nov. Nothing for it is built. H0 builds nothing either: it proves the base is the right one and measures it, so H1 can tell its own breakage from what was already there. The Desktop working tree is about 10,000 lines behind in 60 files; work started from it would be built on missing code.

## Read first (these files only)

1. `docs/event/README.md`, `docs/event/01_DIRECTION.md`, `docs/event/06_MILESTONES.md` (the H0 row and "What each prompt must carry").
2. `docs/event/research/G3_deploy_readiness.md` §1 (git state), §5 (Prisma), §8 (CI).
3. `docs/event/research/G1_backend_build_spec.md` §10 (migrations, rules), §11 (tests).
4. `CLAUDE.md` §8, §14, §16; `AGENTS.md` (the readiness sequence).

Do not read the G reports whole. `docs/event/` wins over this prompt where they differ; say so in the read-back.

## Read-back

Write `reports/H0_READ_BACK.md` (≤ 60 lines): what H0 does and does not do, the commands you will run, anything in `docs/event/` that contradicts the code you see, questions with defaults. Then continue unless blocked.

## Rules that hold all session

- Never run `pnpm lint`, `turbo run lint` or the API's `lint` script: it has `--fix` baked in and once rewrote 193 unrelated files. Call eslint directly, without `--fix`.
- Never `pkill -f` or kill by name. Kill only a PID you started.
- Never run `next build` while a dev server runs from this folder.
- Never read, print or write any `.env*`. Run every command with `DATABASE_URL` and `DIRECT_DATABASE_URL` unset (`env -u DATABASE_URL -u DIRECT_DATABASE_URL …`).
- Never write anywhere under `~/Desktop`. The shared Neon database is never touched.
- A red result on the base is a finding to record, not a thing to fix.

## Parts

**§0 Check the room (no writes).** Stop and report if any is false:
- `pwd` is `~/Code/nimbus-pos-event`; branch is `concert/event-till--moses`.
- `git merge-base --is-ancestor 5a35a18 HEAD` exits 0.
- `docs/event/` holds 16 files; `docs/prompts/` holds this prompt and `H1-sale-engine.md`; nothing else is uncommitted.

**a. Commit the documents.** Add `docs/prompts/README.md`: a table of H0, H1, H1-R, H2, H3, H4a, H4b, H5 with model, status and report path (H0 "running", the rest "not started"). Check `docs/event/` and `docs/prompts/` hold no secret, connection string or real phone number. Commit: `docs(event): event till direction, specs and prompts`.

**b. Install and measure.** `corepack pnpm@8.15.0 install --frozen-lockfile`, then `pnpm db:generate`. Run each of these once and record command, exit code, count and time in `reports/H0_BASELINE.md`, with the Node and pnpm versions:

| # | What | Command |
|---|---|---|
| 1 | API lint | `pnpm --filter @nimbus-pos/api exec eslint "{src,test}/**/*.ts"` (no `--fix`) |
| 2 | API typecheck | `tsc --noEmit` with the tsconfig `nest build` uses; write which |
| 3 | API unit tests | `pnpm --filter @nimbus-pos/api test` |
| 4 | API build | `pnpm --filter @nimbus-pos/api build` |
| 5 | Web lint | `pnpm --dir apps/web run lint` |
| 6 | Web typecheck | `pnpm --dir apps/web run typecheck` |
| 7 | Web build | `pnpm --dir apps/web run build` |

Expected for row 3: about 1,184 or more passing and 0 failing (the B6 milestone reported 1184/1184). Write the real number. Do **not** run Playwright or `test:e2e`: both need a database. Record as known history, unmeasured here: the last full four-viewport Playwright sweep on this tip (B6.7) ended with 41 failures that were never burned down.
After the seven runs `git status --porcelain` must be empty apart from `reports/`. Commit: `chore(event): H0 baseline`.

**c. The card-data guard.** Add `tools/check-event.mjs` and a root script `"check:event": "node tools/check-event.mjs"`.
- Scans source under `apps/` plus `packages/db/prisma/schema.prisma` and `packages/db/prisma/migrations/`; skips `node_modules`, `dist`, `.next`.
- Fails on a field or column that could hold a full card number, CVV or expiry: for example `cardNumber`, `card_number`, `cardNo`, `primaryAccountNumber`, `pan` used as a field name, `cvv`, `cvc`, `cardExpiry`, `expiryMonth`, `expiryYear`, `track1Data`, `track2Data`. `cardLast4`, `cardScheme`, `authCode` and `terminalId` are allowed.
- Prints the number of files scanned and each hit as `file:line`; exits 1 on any hit **or** when 0 files were scanned.
- If `5a35a18` already contains hits, list each in `tools/check-event.allow.json` with file, pattern and a one-line reason, print how many were allowed, and name them in the report. Do not loosen a pattern to get to green.
- Prove it: plant `cardNumber: string` in a scratch file under `apps/api/src`, run (must exit 1), remove the file, run (must exit 0). Save both outputs to `reports/proof/check-event.txt`.

Commit: `chore(event): check:event guard against card-number fields`.

**d. State.** Append one dated line to `PROGRESS.md` (H0 done, base `5a35a18`, where the baseline is). Mark H0 done in `docs/prompts/README.md`. Fold into the last commit.

## Not in it

Schema or migration changes · API or web code · any database, Docker or server · fixing lint, type or test failures that exist on the base · new dependencies · Playwright · push, merge, deploy.

## Done when

1. `git merge-base --is-ancestor 5a35a18 HEAD` exits 0 on `concert/event-till--moses`.
2. `docs/event/` (16 files), `docs/prompts/` and its README index are committed.
3. `reports/H0_BASELINE.md` gives command, exit code and count for all seven rows, and the tree was clean after them.
4. `pnpm check:event` prints a non-zero files-scanned count and exits 0 on HEAD; `reports/proof/check-event.txt` shows it red on the planted field and green after.
5. Nothing under `~/Desktop` was written; no database was reached; nothing was pushed.
6. Three commits: documents, baseline, guard.

## Report

At most 8 lines, verdict first: tip and ancestor check · the seven results in one line · unit-test count · guard proof and any allow-listed hits · anything red on the base · `You need to: …`.

Then STOP.
