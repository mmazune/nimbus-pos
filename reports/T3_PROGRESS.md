# T3 progress (memory file; read this and `git log` first after a restart)

Track T3 — the one order screen. Branch `t3/order-screen`. Rules: `docs/prompts/LONG-RUN-RULES.md`.

## Now
- Phases 1–3 done for the waiter on a terminal (screen mounted on `/waiter/floor`). The phone layout, void, table actions and pay are written; their e2e comes in phases 4–5. Next: phase 4 mounts for cashier, supervisor, manager.

## Baseline (26 Nov 2026, before any web change) [live]
- web typecheck 0; web lint `✔ No ESLint warnings or errors`; `check:ui` green; `check:event` green.
- API (E1 build) on :4111 against throwaway Postgres `t3_order` (seed + demo import): `/api/health` ok.

## Commits
| Phase.part | Commit | What |
|---|---|---|
| 1a | `ded65e1` | read-back, progress file |
| 1b | `214c096` | data layer + unit spec (10 passed) |
| 2–3 | (this commit) | OrderScreen, menu pane, order panel, item sheet, search, quantity first, mixer row, Same again, leave guard; waiter mount; e2e `waiter.spec.ts` 2 passed |

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

## Left out (and why)
See `T3_READ_BACK.md` "What is missing".
