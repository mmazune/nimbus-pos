# Writes ../../SCREENS-2.md and ../../OVERVIEW.md from the drawing registry. Run: python3 deliver.py
import os, sys, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import base
for g in range(1, 12): importlib.import_module(f'g{g}')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
HEAD = {1: 'Start of a shift', 2: 'Table actions', 3: 'The order screen’s other states', 4: 'Paying', 5: 'Supervisor', 6: 'Kitchen and bar', 7: 'Stock',
        8: 'Manager on a laptop', 9: 'Reports', 10: 'Owner and accountant on a laptop', 11: 'Empty, loading and error'}
NOTE = {9: 'The other 16 reports of `docs/direction/05-reports.md` (sales by hour, sales by waiter, payments by method, discounts and on the house, refunds and reopened bills, exceptions, approvals log, sold-out log, low stock and To buy, stock movements, requests, waste by reason, staff meals, used against sold, purchases, bookings) follow this layout: the control panel with period chips and Download; four tiles; the rows in one table; a 420 px side panel; on a phone two tiles and the rows. The waste report is the approved `Manager-Waste-Report`.',
        11: 'Every other list, detail and sheet follows these three patterns: grey shapes in the final places while loading, a 72 px tinted circle with one line and one way forward when empty, what happened, what is safe and Try again on an error.'}
rows = base.REG
sz = lambda w, h: f'{w} × {h}'
t = ['# Screens, second set: the wiring table', '',
     'Drawn by track T7 on 26 Nov 2026 for the screens `docs/direction/06-roadmap.md` lists as owed. Same columns as `SCREENS.md`; that file keeps the first 38. A builder changes the last column of its own rows only. Every drawing here was measured (`reports/proof/T7/measure-g*.json`) and scored by a reviewer that drew none of them (`reports/proof/T7/review-*.md`).', '',
     f'{len(rows)} drawings in {len(HEAD)} groups.', '']
for g in HEAD:
    t += [f'## {g}. {HEAD[g]}', '', '| Drawing | Size | Role | What it shows | Route | Built in | Status |', '|---|---|---|---|---|---|---|']
    for name, w, h, gg, role, shows, route, ms in rows:
        if gg == g: t.append(f'| `{name}` | {sz(w, h)} | {role} | {shows} | `{route}` | {ms} | drawn, awaiting the owner |')
    if g in NOTE: t += ['', NOTE[g]]
    t.append('')
open(os.path.join(OUT, 'SCREENS-2.md'), 'w').write('\n'.join(t))
o = ['# The new screens, one page', '',
     'Every drawing T7 made, in the order of the brief, each at its main size and then on a phone. Scroll, and approve or mark them. The table with routes and milestones is `SCREENS-2.md`. Names, prices and tables are made up and agree with the first 38 drawings.', '']
o += ['Groups: ' + ' · '.join(f'[{g}. {HEAD[g]}](#{g}-{HEAD[g].lower().replace(" ", "-").replace("’", "").replace(",", "")})' for g in HEAD), '']
for g in HEAD:
    o += [f'## {g}. {HEAD[g]}', '']
    if g in NOTE: o += [NOTE[g], '']
    for name, w, h, gg, role, shows, route, ms in rows:
        if gg == g: o += [f'### {name}', '', f'{role} · {sz(w, h)} · {shows}', '', f'![{name}](png/{name}.png)', '']
open(os.path.join(OUT, 'OVERVIEW.md'), 'w').write('\n'.join(o))
print(len(rows), 'rows written')
