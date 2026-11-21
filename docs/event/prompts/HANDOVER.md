# Handover prompt — paste into the Nimbus POS session

You are taking over a piece of work from another session. Treat this as a handover, not a new idea: the research and the decisions are done and written into the repo. Your job is to turn them into build prompts and get the build moving today.

**First:** load `moses-build-standards` and say so. Then read, in this order, in the POS repo at `~/Desktop/Nimbus/POS/docs/event/`:

1. `README.md` — start here: state, base branch, rules.
2. `01_DIRECTION.md` — findings F1–F13, decisions EV-1 to EV-24, owner decisions O1–O10.
3. `06_MILESTONES.md` — H0 to H5, with models and dates.
4. `02_GAPS_BY_ROLE.md`, `03_BACKEND_SPEC.md`, `04_FRONTEND_SPEC.md`, `05_DEPLOY_AND_OPS.md`.
5. `research/G1_backend_build_spec.md`, `G2_frontend_build_spec.md`, `G3_deploy_readiness.md` — the detailed reads with file and line numbers. Open the section a milestone needs; do not read them whole into context.

Those files are more detailed than this prompt and they win over it. Where they disagree with your own memory of the project, say so in one line and tell me which is right; you know this codebase better than the session that wrote them.

**The situation in six lines**

- Nimbus POS will run the food and drinks tills at a Visa-sponsored concert for Omakase, believed to be B'rakaland on **Sat 28 Nov 2026**. Seven days. It is a partnership; nothing client-facing mentions price.
- Omakase wants: cash vs card vs mobile money, how much went through Visa, what Visa cards bought, top items and brands, across both vendors.
- Nothing for the event is built yet. We are **not** finishing owner, accountant or the cashier C4–C6 track. We build one thin slice: `POST /pos/quick-sale`, an Event Till screen that works offline, a live view, and a first deployment.
- **Base branch: `rescued/main-2026-11-15` (tip `5a35a18`).** Not `main`, not the Desktop working tree, which is about 10,000 lines behind. It is only on the `backup` remote, not `origin`.
- Menu items are keyed by **SKU** everywhere: import, till tiles, reports, CSV.
- Four things break on the night if ignored: order-number collisions under concurrent tills (`orders.service.ts:67-81`), 15-minute sessions with no refresh, no offline start, and no hosting.

**What I want from you now**

1. A read-back, at most 25 lines: what you understood, anything in `docs/event/` that contradicts what you know of the code or of decisions we made earlier in this project, and which of O1–O10 you can already answer from our history.
2. Then write the build prompts for **H0** and **H1** in the standard frame (`moses-build-standards` §1.3): save each to `docs/prompts/` in the working folder's naming style, and paste each **in full** in the chat. Label the model on each: **Sonnet** for H0, H1, H2, H4a, H5; **Opus** only for the screens (H3, H4b) and the H1 review. Each prompt must name the exact files to read in `docs/event/` and the G-report sections, quote my words with dates from `01_DIRECTION.md`, carry numbered done-when tests from the specs, and end with a report of at most 8 lines and "Then STOP."
3. Give me the launch lines for H0: the working folder (`~/Code/nimbus-pos-event`, outside the Desktop tree), the branch (`concert/event-till--moses` from `rescued/main-2026-11-15`), and the command to run the prompt by path.
4. After each milestone's report comes back, write the next prompt the same way: H1 review, H2 and H3 (they can run in parallel in separate folders), then H4a and H4b.

**Hold these lines**

- Event work is additive: new modules, new pages, new nullable columns. No refactor of the restaurant flow.
- One tender per sale. Quick sales are normal Order and Payment rows (CLOSED, COMPLETED) so existing dashboards still work.
- Idempotency is `Order.clientSaleId`, unique per organisation. Not the `IdempotencyKey` table, not `/sync/replay`.
- Never run `db:seed` on the event database. Never run tests against a real database. Never store a full card number.
- Commit per checkpoint. Push, merge and deploy only when I say.

If something in the plan is wrong or cannot be done in seven days, say so plainly in the read-back and propose the cut, using the cut line in `06_MILESTONES.md`.
