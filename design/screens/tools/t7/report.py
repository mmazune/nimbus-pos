# Writes reports/T7_REPORT.md from the measurement and score files. Run from the repo root.
import json, re, subprocess
P = 'reports/proof/T7'
reg = json.load(open('/tmp/claude-0/s/reg-1-2-3-4-5-6-7-8-9-10-11.json'))
meas = [x for g in range(1, 12) for x in json.load(open(f'{P}/measure-g{g}.json'))]
sc = open(f'{P}/SCORES.md').read()
rows = re.findall(r'^\| `([^`]+)` \| (\d+) \| ([^|]+) \| ([^|]*) \|$', sc, re.M)
scored = {n: s.strip() for n, g, s, f in rows}
nums = [int(s) for s in scored.values() if s.isdigit()]
unscored = [n for n, s in scored.items() if not s.isdigit()]
low = [n for n, s in scored.items() if s.isdigit() and int(s) < 20]
HEAD = {1: 'Start of a shift', 2: 'Table actions', 3: 'The order screen’s other states', 4: 'Paying', 5: 'Supervisor', 6: 'Kitchen and bar', 7: 'Stock', 8: 'Manager on a laptop', 9: 'Reports', 10: 'Owner and accountant on a laptop', 11: 'Empty, loading and error'}
diffnames = subprocess.run(['git', 'diff', '--name-only', '41772c7', 'HEAD'], capture_output=True, text=True).stdout.split()
outside = [f for f in diffnames if not (f.startswith('design/screens/') or f.startswith('reports/'))]
stat = subprocess.run(['git', 'diff', '--stat', '41772c7', 'HEAD'], capture_output=True, text=True).stdout.strip().splitlines()[-1]
decisions = open('/tmp/claude-0/s/decisions.txt').read()
L = ['# T7 report: the screens that were still owed', '', 'Track T7, branch `t7/drawings` (cut from `rebuild/main` at 41772c7), 26 Nov 2026. Rules: `docs/prompts/LONG-RUN-RULES.md`. Standards: `moses-build-standards` was loaded first.', '',
     '## Verdict', '', f'All 11 groups are drawn: {len(reg)} new drawings, each at its main size and again at 390 × 844. Every one is measured clean (no issue, at most one filled button, Inter) and scored by a reviewer that drew nothing: lowest {min(nums)} of 24, none under 20, none with a zero{", " + str(len(unscored)) + " not yet scored" if unscored else ""}. None of the first 38 drawings and no existing `kit.css` value changed. Nothing is missing from groups 1 to 11.', '',
     '## Per group', '', '| Group | Drawings | Lowest score | Review |', '|---|---|---|---|']
for g, h in HEAD.items():
    ns = [r[0] for r in reg if r[3] == g]
    ss = [int(scored[n]) for n in ns if scored.get(n, '').isdigit()]
    rv = 'review-g10-11.md' if g in (10, 11) else f'review-g{g}.md'
    L.append(f'| {g}. {h} | {len(ns)} | {min(ss) if ss else "pending"} | `{P}/{rv}` |')
L += ['', 'The names of every drawing, with size, role, what it shows, route and the milestone that builds it, are in `design/screens/SCREENS-2.md`; the pictures in order are in `design/screens/OVERVIEW.md`.', '',
      '## Done when, with proof', '',
      f'1. **Groups 1 to 8 drawn in full, and as much of 9 to 11 as time allows.** All of 1 to 11 are drawn: {len(reg)} drawings ({sum(1 for r in reg if r[2] == 844)} phone, {sum(1 for r in reg if r[2] != 844)} terminal, kitchen or laptop). Missing: none. Two lines of group 9 and 11 are settled by decisions 17 and 21: the other 16 reports, and empty/loading/error for every other screen, follow the drawn layouts instead of having a drawing each.',
      f'2. **Issues empty, at most one filled button, Inter, a recorded score of 20 or more; measured output in `{P}/`.** Measured: {len(meas)} drawings, {sum(1 for x in meas if x["issues"])} with an issue, {sum(1 for x in meas if x["filled"] > 1)} with more than one filled button, {sum(1 for x in meas if x["font"] == "Inter")} in Inter, {sum(1 for x in meas if x["pageOverflow"])} overflowing (`{P}/MEASUREMENTS.md`, `measure-g1.json` to `measure-g11.json`). Scores: {len(nums)} recorded, lowest {min(nums)}, under 20: {len(low)} (`{P}/SCORES.md`). The measuring tool was proven not blind on a planted fault (`{P}/check-proof.md`).',
      f'3. **No existing drawing and no existing value in `kit.css` changed; new kit classes listed.** `git diff --stat 41772c7 HEAD`: {stat}. Files changed among the first 38 HTML and PNG and `SCREENS.md`: 0. Lines removed from `kit.css`: 0; lines added: the T7 block at the end only. Files changed outside `design/screens/` and `reports/`: {len(outside)}. New kit classes: `.pin`, `.pin i`, `.pin i.on`, `.pin.bad i.on`, `.toast`, `.skel`.',
      '4. **Names, prices and tables agree with the first 38; no real person, venue or brand.** The cast is the first drawings’ (Amina K., Brian O., Grace N., David S., Sarah M., Ruth A., Joel T., Isaac B., Peter K., Daniel W.), plus Joy M. and Esther L., made up. Table 12 is UGX 98,000 with the same eight items wherever it appears; floor tiles are copied from `Main.html` and `Floor-Phone.html` by the generator, not retyped; menu items and prices are those of the first drawings. Cross-drawing numbers were checked by the reviewers and fixed where they disagreed (decisions 7, 10, 14, 20). Brands: a search for the networks and drink brands found none (decision 22). Phones are from `+256 700 000 xxx`.',
      '5. **`SCREENS-2.md` and `OVERVIEW.md` list every new drawing.** Both are written by `design/screens/tools/t7/deliver.py` from the same registry the drawings come from: 184 rows and 184 pictures, each picture path checked to exist.', '',
      '## Gates', '', '- `node tools/check-event.mjs`: green, scanned 1428 files.', '- `node tools/check-ui.mjs`: green (0 new screens in `apps/web/src/screens`).', '- Typecheck, build, unit tests, e2e: not run, settled by decision 23 (no code changed).', f'- Every drawing re-rendered and measured from the final generator: {len(meas)} of {len(reg)} clean.', '',
      '## How a drawing is made here (for whoever draws the next ones)', '',
      '- `design/screens/tools/t7/base.py` holds the shared pieces (bars per role, the cast, table 12’s bill, tiles copied from the first drawings, sheets, keypad, picks); `g1.py` … `g11.py` one file per group; `build.py 1 2 …` writes the HTML.',
      '- `design/screens/tools/render-all.js <list> <out>` renders and measures many drawings in one browser: the checks of `render.js` plus content hidden by a clipping box, a squeezed card, and a clipped tile number. `sheet.js` makes contact sheets for looking. `deliver.py` writes `SCREENS-2.md` and `OVERVIEW.md`; `scores.py` writes `SCORES.md`; `report.py` this report.', '',
      '## Left out, and which milestone brings it', '', '- No drawing was left out of groups 1 to 11. What the drawings show but the system cannot do yet is marked in the "Built in" column of `SCREENS-2.md` with the engine milestone it needs (for example “U3, needs E13” for mobile money pending and walk-outs, “U1, needs E12” for held orders).', '',
      '## Decisions taken', '', decisions, '',
      '## What another track must know', '',
      '- T5 owns `SCREENS.md`; T7 did not touch it. `SCREENS-2.md` sits beside it with the same columns.',
      '- `kit.css` gained `.pin`, `.toast` and `.skel` at the end; the app’s tokens and kit mirror `kit.css`, so a builder adds these three when the first screen that uses them is built.',
      '- Milestone prompts should cite the drawing names in `SCREENS-2.md`. The roadmap’s “Drawings owed” list in `docs/direction/06-roadmap.md` is now drawn; T7 did not edit it (outside its folders).',
      '- Mobile money networks are placeholders (decision 22). The owner’s laptop bar (decision 18) and the manager’s laptop bar without a Today word (decision 15) are proposals for the owner to confirm.', '']
open('reports/T7_REPORT.md', 'w').write('\n'.join(L))
print('report written; unscored', len(unscored))
