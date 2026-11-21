# Event Till — handover (start here)

*Written Sat 21 Nov 2026 by the research/architect session for the Omakase project. This folder is the full context for making Nimbus POS run a concert in 7 days. New files only; nothing else in the repo was changed and nothing was committed.*

## In short

- **What:** Nimbus POS runs the food and drinks tills at a Visa-sponsored concert, believed to be **B'rakaland, Sat 28 Nov 2026, Lugogo Hockey Grounds** (press match; Moses has not corrected it). The client is the agency Omakase (contact: Bwomono). It is a partnership: nothing sent to them mentions price.
- **The one thing:** "Every sale at B'rakaland is rung up in two taps and tagged with how it was paid, so Omakase can show Visa exactly what Visa cards bought."
- **State on 21 Nov:** nothing for the event is built. The right code base is the local branch **`rescued/main-2026-11-15`** (tip `5a35a18`), not `main` and not the Desktop working tree.
- **Plan:** a thin "Event Till" slice, not a finish of the restaurant product: one API call per sale, one tablet screen, one live view, one deployment. Six milestones, H0–H5, in `06_MILESTONES.md`.

## Read in this order

| File | What it is | Who needs it |
|---|---|---|
| `README.md` | This page | Everyone |
| `01_DIRECTION.md` | Decisions EV-1 to EV-24, how card type is known, what is not built, owner decisions | Everyone |
| `02_GAPS_BY_ROLE.md` | Cashier, supervisor, manager, organiser, waiter, accountant: must-fix, workaround, not needed | Architect |
| `03_BACKEND_SPEC.md` | Schema change, `POST /pos/quick-sale`, till fix, event reports, import and seed scripts | H1, H2, H4 builders |
| `04_FRONTEND_SPEC.md` | `/event/till`, `/event/live`, offline queue, session survival, reuse list | H3, H4 builders |
| `05_DEPLOY_AND_OPS.md` | Hosting, env names, seed safety, load test, event-day runbook, kit list | H2 builder, Moses |
| `06_MILESTONES.md` | H0–H5 with model labels, dates, done-when, cut line, go/no-go | Architect |
| `prompts/HANDOVER.md` | The prompt Moses pastes into the Nimbus POS session | Moses |
| `research/` | Eight lane reports, whole. A1, A2, B, C, D from 18 Nov; G1, G2, G3 from 21 Nov | Builders, for file:line detail |

Where the 18 Nov reports (A1, A2) disagree with the 21 Nov reports (G1–G3), **G wins**: for example A1 says the API depends on Redis; G3 read the code more deeply and found it does not.

The G reports are the detailed ones: `G1_backend_build_spec.md` (60 KB, every route and line number), `G2_frontend_build_spec.md`, `G3_deploy_readiness.md`. The numbered documents here summarise and decide; where a builder needs the exact line, the G report has it.

## Grades used everywhere

**[V]** opened and read · **[2H]** second-hand · **[PK]** from memory · **[P]** our proposal · **UNKNOWN** looked, not found. Code facts marked [V-lead] were re-checked by the lead session against the rescued branch on 21 Nov; other code facts are the lane agent's reading.

## Rules for whoever builds

1. Load `moses-build-standards` first and follow it. Project `AGENTS.md` / `CLAUDE.md` win where they conflict; this folder's EV decisions win over both for event work, and each conflict is logged in `01_DIRECTION.md`.
2. Branch from `rescued/main-2026-11-15`. Work in a clean folder outside the Desktop tree (`~/Code/nimbus-pos-event`). Never build from the Desktop working tree: it is about 10,000 lines behind in 60 files.
3. This folder is untracked in the Desktop repo, so a clone will not contain it. **H0 copies `docs/event/` into the working branch and commits it** as its first step.
4. Event work is **additive**: new modules, new pages, new nullable columns. Do not refactor the restaurant flow.
5. Never run `db:seed` against the event database (it creates demo accounts with known passwords). Never run tests against a real database.
6. No full card number, CVV or free-text card field anywhere. Brand, last four, approval code and terminal ID only.
7. Commit per checkpoint; push, merge and deploy only on Moses's word.
8. Model labels: **Opus** for screens (H3, H4b), **Sonnet** for everything else.

## What changed since the 18 Nov direction (v1.1)

| Was | Now | Why |
|---|---|---|
| "Recover the code" as a half-day milestone | Branch from `rescued/main-2026-11-15`; minutes | The rescue was already done on 15 Nov [V-lead] |
| API needs Redis | Postgres only | G3 found no Redis, BullMQ or cron in the code |
| Idempotency via the existing replay endpoint | `Order.clientSaleId`, unique per org | The generic idempotency table and replay endpoint are unfit (G1 s3) |
| 10 days, 8 milestones | 7 days, 6 milestones | Three days passed with no build |
| Offline = a local queue | Queue **plus** offline cold start **plus** session survival | Tokens last 15 min and pages are server-rendered (G2) |

The earlier copy of this work at `~/Desktop/Nimbus/omakase-concert/` is superseded by this folder.
