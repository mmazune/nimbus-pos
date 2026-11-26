# T3 progress (memory file; read this and `git log` first after a restart)

Track T3 — the one order screen. Branch `t3/order-screen`. Rules: `docs/prompts/LONG-RUN-RULES.md`.

## Now
- All six phases done; report `reports/T3_REPORT.md`; look review `reports/T3_LOOK_REVIEW.md` (10 of 10 pass). Nothing next on this track.

## Baseline (26 Nov 2026, before any web change) [live]
- web typecheck 0; web lint `✔ No ESLint warnings or errors`; `check:ui` green; `check:event` green.
- API (E1 build) on :4111 against throwaway Postgres `t3_order` (seed + demo import): `/api/health` ok.

## Commits
| Phase.part | Commit | What |
|---|---|---|
| 1a | `ded65e1` | read-back, progress file |
| 1b | `214c096` | data layer + unit spec (10 passed) |
| 2–3 | `25cddc1` | OrderScreen, menu pane, order panel, item sheet, search, quantity first, mixer row, Same again, leave guard; waiter mount; e2e `waiter.spec.ts` 2 passed |

| 4 | `4c9ed92`, `a54628f` | cashier, supervisor, manager mounts; table actions; void; pay; laptop |
| 5 | `b54ac3e` | phone |
| 6 | `de37868`, close commit | old surfaces deleted, races, taps, 3 runs, compare images, look review, report |

## Decisions taken
1. `u0/foundations` not merged: `components/kit/index.ts` already exists on `rebuild/main` (the prompt merges it only when missing).
2. Test PINs: minted in the e2e setup through the manager's own reset route, held in memory only; a per-boot random pepper and JWT secrets are generated in the shell. Nothing secret is written to disk.
3. E2E specs live in `apps/web/e2e/order/` (a new folder; the prompt names no e2e folder, and the existing harness reads `e2e/`).
4. Fixture menu for "Table 12's evening" is created through the API by the manager in the test setup (the demo menu has no measures); fictional item names, throwaway database only.

5. Lines not sent are held on the device until Send, for a free table and an open one alike (one path to the kitchen); leaving with lines not sent asks first ("Leave without sending" / "Send N items").
6. After Send the waiter stays on the order (the panel shows "Sent hh:mm"); Back returns to the Floor.
7. "Send N items" counts quantities, as the drawing does (2 lagers + 1 Scotch + 1 cola = 4).
8. Quantity first: a "How many 2–6" strip in the menu's top row on touch, and digit keys on any keyboard. Not in the drawings; listed as a difference.
9. An item with any choice group opens the item sheet; a measured drink opens it only when a non-mixer group is required. A "Mixer" group shows as the drawing's "Add a mixer" row under the drink just added.
10. Fixture tables `12`, `14`–`18` are added by the e2e setup (the demo floor has open orders on almost every table); setup voids only leftovers on those fixture tables.
11. Option tiles wrap a long group name to two lines instead of cutting it ("Zero-Proof Bar" at 8 columns).
12. A selected group/measure/option (aria-pressed) is counted as a selection, not a filled button, in the rule-10 measurer.

13. R1–R7 (26 Nov 2026, `docs/direction/01-decisions.md`) override the older root `CLAUDE.md` bans this work touches: Manager operations read-only and no order actions on the manager floor, Supervisor without a line void, no shared order screen across roles.
14. R5's filled button takes payment from the role: cashier and manager; a supervisor gets Print bill (owner default 2: a supervisor does not take payment), even though the supervisor's token could close.
15. With two orders on one table, the signed-in person's own opens first and a banner offers the other.
16. Proofs come from a production build (`next build` + `next start`), not the dev server.
17. Cash needs the taker's own open till (`GET /api/tills/active`), as the old cashier screen required; card and mobile money do not.
19. The laptop header: the manager keeps the shared top bar (D-MGRTOPNAV, shell not T3's); the order screen sits under it.
18. Tap counts are measured from the Floor including the table tap (A2 §3.8). The fixture's Popular groups hold the lager and the house Scotch (Drinks) and the burger ("Popular food", because group names are unique per branch); a single malt stays in Whisky.

## Left out (and why)
See `T3_READ_BACK.md` "What is missing".
