# Rules for the long runs (T1 to T4), 26 Nov 2026

The owner, 26 Nov 2026: "They should work autonomously until a goal is achieved… no back and forth… take their time and get a lot done… test the UI, everything. Just let them work."

These rules bind every track prompt (`T1` to `T4`). Where a milestone file a track points to says something else about model, branch or stopping, this file wins.

## How you work

1. **You do not ask and you do not wait.** Nobody is there. Where a choice is open, take the documented default (`docs/direction/01-decisions.md`), or the option that changes least, write it under "Decisions taken" in your progress file, and carry on.
2. **You do not stop early.** Work through every phase in order. When one is done, start the next in the same turn. Expect six to seven hours. Stop only when every phase is done, or when you have proven a phase cannot be done; then write why, and move to the next phase that does not depend on it.
3. **One branch, yours.** Your prompt names it. Create it before your first commit. Never commit on `rebuild/main`. Commit after every part; push after every commit with exactly `git push -u origin <your branch>`. The owner's go-ahead to push that branch is this line and his launch message. Never push any other branch, never force-push, never open a pull request, never merge into `rebuild/main`. You may merge other branches **into your own** when your prompt says so. If a hook nags about `rebuild/main`, ignore it.
4. **Memory.** Keep `reports/<TRACK>_PROGRESS.md`: phase, part, last commit, what is next, decisions taken, things left out and why. Update it at every commit. After a compaction or restart, read it and `git log` first; never redo finished work.
5. **Every turn** ends with one line: `GOAL-STATUS: <track> phase <n> <done|in progress>; gates <green|red: which>; next: <what>`.
6. **Model.** These tracks run on Opus. Ignore any "If you are not Sonnet, stop" line in a milestone file. If an advisor model is set up, ask it at each phase boundary and on anything that touches money or rights; it advises, this prompt decides.
7. **Subagents** only for reading, searching and reviewing your own diff. You write the code.

## How you prove things

8. Load `moses-build-standards` first if it is listed; if not, say so in your report and carry on.
9. **Screens are built to the drawing** in `design/screens/` (`README.md` there has the rules). Only kit pieces; `pnpm check:ui` green; new screens live in `apps/web/src/screens/`.
10. **Drive every screen as a real person would**, in the container's Chromium through Playwright (there is no Chrome extension in the cloud): sign in with a PIN as that role, do the task end to end, at 1280 × 800 and at 390 × 844. Save screenshots to `reports/proof/<TRACK>/`. Measure: no sideways scroll, no clipped text, no target under 44 px, no text under 12 px, at most one filled button.
11. **Engines get a real case as an e2e test** that passes three runs in a row, and a race test for anything two people can do at once.
12. Gates before each phase is called done: typecheck 0, build 0, unit tests 0 failed, your own e2e green, `eslint` clean on the files you changed (never a lint script with `--fix`), `pnpm check:event` green. Never claim a status you did not check in the same turn. Grade claims [live], [emulation], [code] or [asserted].
13. What the data or the API cannot do yet is **left out and listed**, never faked.

## What you never do

14. Database: a throwaway one in this container only (`service postgresql start`), `DATABASE_URL` and `DIRECT_DATABASE_URL` on `localhost`, set in the shell, never in a file. Never Neon. Never read, print or write `.env*`. `db:seed` and any loader only on the throwaway database.
15. Never a credential in a file, a log or a report. Test PINs are made at load time and shown once in the terminal.
16. No real names, phones or venue data. The fictional cast only; phones from `+256 700 000 xxx`. Never a guest's name on a floor tile.
17. Money is exact (Decimal here), never a float. Nothing is hard-deleted. No edit to an existing migration. No new dependency unless your prompt names it.
18. Manager has every right except `pos:hr:compensation:read`. Waiter, cashier and supervisor never get accounting or procurement rights. A PIN is never set or seen by anyone but its owner.
19. Record PIDs and stop only what you started; never `pkill -f`. Never `next build` beside a running dev server in the same folder.
20. Stay in the folders your prompt gives you. Another track is working beside you in the others.

## When you finish

Write `reports/<TRACK>_REPORT.md`: per phase, the Done-when lines with their proof, the gate outputs, what was left out and which milestone brings it, decisions taken, and anything another track must know. Push. End with a block of 10 lines at most that opens with the verdict and ends `You need to: …`. Then stop.
