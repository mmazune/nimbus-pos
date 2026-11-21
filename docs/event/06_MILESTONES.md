# 06 — Milestones, 21–28 Nov

*21 Nov 2026. Seven days. One prompt = one milestone = one session, in the standard frame of `moses-build-standards` §1.3, pasted in full and run by path. Opus only for screens.*

## In short

- **H0–H4 before the event, H5 after.** H1 (the sale endpoint) and H3 (the till) are the two that cannot slip.
- H2 and H3 can run at the same time in separate working folders.
- Go / no-go on **Tue 24 evening**. Dry run **Wed 25 evening**. Freeze **Thu 26 night**.

## The table

| ID | What | Model | When | Depends | Done when |
|---|---|---|---|---|---|
| **H0** | Clean base. Working folder `~/Code/nimbus-pos-event` from `rescued/main-2026-11-15`, branch `concert/event-till--moses`. Copy `~/Desktop/Nimbus/POS/docs/event/` into the branch and commit it. Install; lint, typecheck, unit tests, build for api and web; record counts. Add `pnpm check:event` (fails on card-number-like fields under `apps/`, prints files scanned, proved red once). No schema, no screens | Sonnet | Sat 21, 1–2 h | — | `git log` shows `5a35a18` as an ancestor; baseline written; guard proved; Desktop repo untouched |
| **H1** | Sale engine. Migration (`03` §1); `POST /pos/quick-sale` (`03` §2); till cash fix (`03` §3); all tests in `03` §2, seen failing first | Sonnet | Sat 21 – Sun 22 | H0 | One call makes a closed, paid sale; same `clientSaleId` twice makes one; 20 concurrent sales get 20 numbers; migration applies on an empty database |
| **H1-R** | Fresh review of H1 by a session that built none of it: money, idempotency, the order-number lock, tenant scoping. Table of findings with file:line and failure scenario | **Opus** | Sun 22, 1 h | H1 | No open blocker |
| **H2** | Go live. Dockerfile, compose, Caddy; health 503; trust proxy; secret checks; `event-setup.ts`; `import-event-menu.ts`; Vercel project; latency measured (`05` §5) | Sonnet | Mon 23 | H1 | A tablet on mobile data logs in and the API answers; both menus imported (needs O9); p95 written down |
| **H3** | Event Till. `/event/till`, `/event/setup`, local queue, offline start, session survival, undo by supervisor PIN (`04` §1–4, §8) | **Opus** | Mon 23 – Tue 24 | H1 (API shape) | Every test in `04` §8 passes on a real tablet |
| **Go / no-go** | Moses decides from the H3 report | — | Tue 24 evening | H3 | Written decision. If the till cannot sell offline: paper tally sheets as the offline fallback |
| **H4a** | Event reports API: `summary` and `lines.csv` (`03` §4) | Sonnet | Wed 25 am | H1 | Fixture night reconciles to the shilling |
| **H4b** | `/event/live` (`04` §5) | **Opus** | Wed 25 pm | H4a | Every number equals the API; works at 390 px |
| **Dry run** | A real bar, real staff, one terminal, an hour of real sales | — | Wed 25 evening | H2, H3 | Cash-up matches; fix list written |
| **Fix and freeze** | Dry-run fixes only; load test (`05` §6); freeze | Sonnet | Thu 26 | Dry run | Load test passes; image tagged |
| **Train and stage** | Devices set up, PIN sheet, one-hour training, restore branch | — | Fri 27 | Freeze | Every cashier has rung a practice sale |
| **Event** | Runbook in `05` §7 | — | Sat 28 | — | — |
| **H5** | After: bank report import and matcher (marks payments VERIFIED, corrects card type); brands by category; hour curve; final report for Omakase | Sonnet | Sun 29 – Tue 1 Dec | Bank file (O3) | Match rate per terminal; unmatched list; report sent as a draft for Moses |

## Running H2 and H3 together

H3 needs only H1's request and response shape. Give it its own working folder (`~/Code/nimbus-pos-event-ui`, a git worktree of the same branch family), its own port and a local disposable database, and merge after H2. One session per folder, always.

## Cut line

Drop in this order if time runs short:

1. Approval-code chip (H3).
2. `/event/setup` QR prefill (type the branch once per tablet instead).
3. H4b live view → fall back to `/manager/overview` per branch plus `lines.csv`.
4. Undo dialog → note on the paper sheet, manager refunds after.

**Never drop:** H1, the local queue, session survival, per-till `tillCode`, the event setup script, the restore branches.

## What each prompt must carry

| Line | Value |
|---|---|
| Model | As in the table, followed by "If you are not <model>, say so and stop." |
| First instruction | "Load `moses-build-standards`, say so, and read §0, §1.3, §6, §7, §8 (type A, product app)." H3 and H4b add §3, §4, §5 |
| Read first | `docs/event/README.md`, `01_DIRECTION.md`, the spec for that milestone, and the matching G report sections |
| Why | Moses's words with dates from `01_DIRECTION.md`, and the real case: "2 beers, Visa, at a bar till with no signal" |
| Ship policy | "Commit per checkpoint; no push, no deploy" except H2, where Moses names what may deploy |
| Read-back | `reports/<ID>_READ_BACK.md`, ≤ 60 lines, then continue |
| Report | ≤ 8 lines, verdict first, ending `You need to: …`, then STOP |

Repo hygiene the project's own rules ask for (G1 s10, `AGENTS.md`): update `ai/AI_STATUS.md` and `PROGRESS.md`, add the new routes to the Postman collection. Do these in H1 and H4a, briefly.

## Needs Moses, by day

| Day | Needed |
|---|---|
| Sat 21 | Confirm the event (O1). Say whether to push the rescued branch to `origin` (O2). Chase the terminal supplier (O3) |
| Sun 22 | Hosting choice and Neon project (O4). Ask Omakase for attendance and till count (O6) and the Visa terms (O5) |
| Mon 23 | Both menus as CSV with SKU, brand, price (O9). Set the secrets on the server |
| Tue 24 | Go / no-go. Book the dry-run bar (O10) |
| Wed 25 | Dry run |
| Fri 27 | Tablets, routers, floats on site (O7) |

## What is still unverified

- The whole schedule assumes one developer with AI sessions and no surprises in the first container build.
- H3 on real tablets: models and browsers unknown.
- No independent reviewer has scored this version.
