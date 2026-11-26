from base import *
G = 6
K, P = (1920, 1080), (390, 844)
PILL = 'height: 32px; font-size: 16px; padding: 0 12px; border-radius: 16px'
def tk(no, mins, pc, who, ls, filled=False, label='Ready', extra=''):
    o = ''
    for x in ls:
        q, n = x[0], x[1]
        cls = ' x' if len(x) > 3 and x[3] == 'x' else ''
        o += f'<div class="ln{cls}"><span class="q">{q}</span><span>{n}</span></div>'
        if len(x) > 2 and x[2]: o += f'<div class="mod">{x[2]}</div>'
    b = btn(label, 'filled' if filled else 'tonal', 'width: 100%; height: 56px; font-size: 18px')
    return f'<article class="tk"><div class="hd"><span class="no">{no}</span><span class="pill {pc}" style="{PILL}">{mins}</span></div><p class="t-sup muted" style="padding: 0 16px 8px">{who}</p><div class="hr"></div><div style="padding-top: 8px">{o}</div>{extra}<div class="ft">{b}</div></article>'
def kscreen(title, sub, role, main, aside='', on='Tickets', nb=None, inert=False):
    h = tbar(title, sub, role)
    nav = navbar(role, on)
    a = ' inert' if inert else ''
    if inert: h = h.replace('<header class="bar tall">', '<header class="bar tall" inert>'); nav = nav.replace('<nav class="navbar"', '<nav inert class="navbar"')
    return h + f'''
  <main class="page" style="padding: 16px 24px; flex-direction: row; gap: 16px"{a}>
    <section class="grow vstack g16">{main}</section>
    {aside}
  </main>
{nav}'''
def tix(items, cols=4, rows=404): return f'<div class="tix" style="grid-template-columns: repeat({cols}, minmax(0, 1fr)); grid-auto-rows: {rows}px">{"".join(items)}</div>'
def tomake(title, items):
    return f'<div class="card" style="padding: 16px 20px"><p class="cap" style="padding-bottom: 8px">{title}</p>' + ''.join(f'<div class="hstack" style="min-height: 38px"><span class="t-row" style="width: 32px">{q}</span><span class="t-body">{n}</span></div>' for q, n in items) + '</div>'
KT = [tk('Table 6', '26 min', 'p-red', 'Amina K. · sent 19:30', [(2, 'Beef burger', '1 medium, no onions'), (0, '', '1 well done'), (1, 'Chips'), (1, 'Chicken wings')], True),
      tk('Table 19', '21 min', 'p-red', 'David S. · sent 19:35', [(1, 'Grilled tilapia'), (1, 'Goat stew'), (2, 'Matooke and beef')]),
      tk('Table 12', '14 min', 'p-amber', 'Amina K. · sent 19:42', [(1, 'Beef burger', 'Medium, no onions, cheese'), (2, 'Chips'), (1, 'Chicken wings', 'Voided 19:54, do not make', 'x')]),
      tk('Tab 3', '11 min', 'p-amber', 'Amina K. · sent 19:45', [(3, 'Rolex'), (2, 'Beef samosas'), (2, 'Chips')]),
      tk('Table 30', '8 min', 'p-green', 'Brian O. · sent 19:48', [(2, 'Chicken curry'), (1, 'Pepper steak', 'Medium rare'), (1, 'Pork ribs')]),
      tk('Table 24', '6 min', 'p-green', 'Brian O. · sent 19:50', [(1, 'Greek salad'), (1, 'Margherita pizza')]),
      tk('Table 10', '4 min', 'p-green', 'David S. · sent 19:52', [(1, 'Club sandwich'), (1, 'Fruit platter')]),
      tk('Table 2', '2 min', 'p-green', 'Amina K. · sent 19:54', [(1, 'Grilled tilapia', 'Was held, now fired')])]
KT = [t.replace('<div class="ln"><span class="q">0</span><span></span></div>', '') for t in KT]
KASIDE = f'<aside class="vstack g16" style="width: 300px; flex: none">{tomake("To make now, all orders", [(6, "Chips"), (3, "Beef burger"), (3, "Rolex"), (2, "Chicken curry"), (2, "Matooke and beef"), (2, "Beef samosas"), (2, "Grilled tilapia"), (1, "Goat stew"), (1, "Pepper steak"), (1, "Pork ribs"), (1, "Greek salad"), (1, "Margherita pizza")])}<div class="card" style="padding: 16px 20px"><p class="cap" style="padding-bottom: 8px">Sold out today</p><p class="t-body b">Lamb chops</p><p class="t-sup muted">Waiters see it greyed out on the menu.</p></div></aside>'
STA = seg(['All stations · 8', 'Grill · 4', 'Fry · 5', 'Cold · 2'], 'All stations · 8')
legend = '<span class="t-sup muted">Oldest first. Green under 10 minutes, amber under 20, red after.</span>'
KR = '/kitchen (new)'

# 1 bar screen
BT = [tk('Table 28', '9 min', 'p-amber', 'Grace N. · sent 19:33', [(2, 'Mojito'), (1, 'Gin and tonic', 'Double, slice of lemon'), (2, 'Water 500 ml')], True),
      tk('Tab 6', '7 min', 'p-amber', 'Amina K. · sent 19:35', [(4, 'Lager 500 ml'), (2, 'Margarita', 'No salt on one'), (1, 'Draught lager, jug')]),
      tk('Table 12', '4 min', 'p-green', 'Amina K. · sent 20:15', [(2, 'Lager 500 ml'), (1, 'Blended Scotch', 'Double, cola'), (1, 'Cola 300 ml')]),
      tk('Table 16', '3 min', 'p-green', 'Brian O. · sent 20:16', [(1, 'Red wine, glass'), (1, 'Passion juice')]),
      tk('Tab 1', '2 min', 'p-green', 'Amina K. · sent 20:17', [(2, 'Stout 500 ml')]),
      tk('Table 9', '1 min', 'p-green', 'Amina K. · sent 20:18', [(2, 'Tonic'), (2, 'Gin, tot')])]
baside = f'<aside class="vstack g16" style="width: 300px; flex: none">{tomake("To pour now, all orders", [(8, "Lager 500 ml"), (2, "Mojito"), (2, "Margarita"), (2, "Stout 500 ml"), (2, "Water 500 ml"), (2, "Tonic"), (3, "Gin, tots"), (1, "Blended Scotch, double"), (1, "Red wine, glass"), (1, "Draught lager, jug")])}<div class="card" style="padding: 16px 20px"><p class="cap" style="padding-bottom: 8px">Low in the bar store</p><p class="t-body b">Tonic · 6 left</p><p class="t-sup muted">Minimum 12. A request is ready under Store.</p></div></aside>'
page('Bar', *K, 'Bar screen', (lambda h: h.replace('Tickets<span class="nb">8</span>', 'Tickets<span class="nb">6</span>'))(kscreen('Bar', '6 orders · oldest 9 min · as at 20:18', 'bar', f'<div class="hstack">{seg(["All · 6", "Cocktails · 2", "Beer and wine · 4"], "All · 6")}<span class="grow"></span><span class="t-sup muted">Oldest first. Green under 5 minutes, amber under 10, red after.</span></div>{tix(BT, 3, 372)}', baside)),
     G, 'Bartender', 'The bar screen: drink tickets, to pour now, the bar store', '/bar (new)', 'U5, needs E5')
def ktickets_phone(title, sub, role, cards, banner_html='', on='Tickets', over=''):
    return band(title, sub) + f'<main class="body" style="gap: 12px">{banner_html}{cards}</main>' + navbar(role, on, True) + over
def ptk(no, mins, pc, who, items, label='Ready', filled=True):
    ls = ''.join(f'<div class="hstack" style="min-height: 32px"><span class="t-row" style="width: 28px">{q}</span><span class="t-body">{n}</span></div>' + (f'<p class="t-sup" style="padding-left: 40px; color: var(--red); font-weight: 600">{m}</p>' if m else '') for q, n, m in items)
    return f'<div class="card vstack g8" style="padding: 14px 16px"><div class="hstack"><span class="t-h grow">{no}</span>{pill(mins, pc)}</div><p class="t-sup muted">{who}</p>{ls}{btn(label, "filled" if filled else "tonal")}</div>'
page('Bar-Phone', *P, 'Bar, phone', ktickets_phone('Bar', '6 orders · oldest 9 min · 20:18', 'bar', ptk('Table 28', '9 min', 'p-amber', 'Grace N. · sent 19:33', [(2, 'Mojito', ''), (1, 'Gin and tonic', 'Double, slice of lemon'), (2, 'Water 500 ml', '')]) + ptk('Tab 6', '7 min', 'p-amber', 'Amina K. · sent 19:35', [(4, 'Lager 500 ml', ''), (2, 'Margarita', 'No salt on one')], filled=False) + '<p class="t-sup muted">4 more below, oldest first.</p>').replace('Tickets<span class="nb">8</span>', 'Tickets<span class="nb">6</span>'),
     G, 'Bartender', 'The bar screen on a phone', '/bar (new)', 'U5, needs E5')

# 2 Done, bring back
DONE = [('Table 9', 'Amina K.', '19:58', '8 min', 'Ready'), ('Table 13', 'Grace N.', '19:55', '12 min', 'Collected 19:57'), ('Table 20', 'Grace N.', '19:51', '9 min', 'Collected 19:53'), ('Table 3', 'Brian O.', '19:47', '14 min', 'Collected 19:50'),
        ('Tab 2', 'Brian O.', '19:44', '7 min', 'Collected 19:45'), ('Table 26', 'David S.', '19:40', '11 min', 'Collected 19:43'), ('Table 16', 'Brian O.', '19:36', '10 min', 'Collected 19:38')]
dt = '<div class="card" style="overflow: hidden"><table class="dt"><thead><tr><th>Ticket</th><th>Waiter</th><th>Done at</th><th class="num">Took</th><th>Now</th></tr></thead><tbody>' + ''.join(
    f'<tr{" class=\"sel\"" if t == "Table 9" else ""}><td>{t}</td><td>{w}</td><td>{d}</td><td class="num">{tk_}</td><td>{pill(n, "p-amber" if n == "Ready" else "p-neutral")}</td></tr>' for t, w, d, tk_, n in DONE) + '</tbody></table></div>'
dside = f'<aside class="card vstack g12" style="width: 440px; padding: 20px; flex: none"><div class="hstack"><div class="grow"><h2 class="t-h">Table 9</h2><p class="t-sup muted">Amina K. · sent 19:50 · done 19:58</p></div>{pill("Ready, not collected", "p-amber")}</div><div class="hr"></div><div class="tk" style="box-shadow: none"><div class="ln"><span class="q">2</span><span>Chicken curry</span></div><div class="ln"><span class="q">1</span><span>Chips</span></div></div><p class="t-sup muted">Bumped by mistake, or the plate went to the wrong table? Bring it back: it goes to the top of Tickets with its first time kept, and the waiter’s Ready line is taken down.</p><span class="grow"></span>{btn("Bring back to Tickets", "filled", "height: 56px; font-size: 18px")}</aside>'
page('Kitchen-Done', *K, 'Kitchen, Done', kscreen('Hot kitchen', 'Done in the last hour · 23 tickets · as at 20:04', 'chef', f'<div class="hstack">{seg(["Last hour · 23", "Today · 142"], "Last hour · 23")}<span class="grow"></span><span class="t-sup muted">Newest first</span></div>{dt}<p class="t-sup muted">16 more in the last hour, scroll for them.</p>', dside, on='Done'),
     G, 'Chef', 'Done: tickets already bumped, with bring back', KR + '?view=done', 'U5, needs E5')
pd = '<div class="card" style="overflow: hidden">' + ''.join(row(f'{t} · {w}', f'Done {d} · took {tk_}', pill(n.split(" ")[0], "p-amber" if n == "Ready" else "p-neutral")) for t, w, d, tk_, n in DONE[:6]) + '</div>'
page('Kitchen-Done-Phone', *P, 'Kitchen, Done, phone', band('Done', 'Last hour · 23 tickets · 20:04') + f'<main class="body">{pd}<p class="t-sup muted">17 more in the last hour, scroll for them. Tap a ticket to bring it back.</p></main>' + navbar('chef', 'Done', True),
     G, 'Chef', 'Done on a phone', KR + '?view=done', 'U5, needs E5')

# 3 Sold out: mark, back on, set a number
SO = [('Lamb chops', 'Grills', 'Sold out', 'p-red', 'Marked by Ruth A. at 19:40', 'Back on'), ('Goat stew', 'Local', '12 left', 'p-amber', 'Number set by Ruth A. at 17:05', 'Change'),
      ('Pepper steak', 'Grills', '3 left', 'p-amber', 'From the kitchen store: 3 servings of steak', 'Mark sold out'), ('Chicken luwombo', 'Local', 'Check stock', 'p-amber', 'Stock says 0 banana leaves; still sells', 'We have it'),
      ('Beef burger', 'Burgers', 'Available', 'p-green', '24 servings in the kitchen store', 'Sold out'), ('Grilled tilapia', 'Grills', 'Available', 'p-green', '9 servings', 'Sold out'),
      ('Chicken wings', 'Starters', 'Available', 'p-green', 'Not counted', 'Sold out'), ('Fruit platter', 'Desserts', 'Available', 'p-green', 'Not counted', 'Sold out')]
sot = '<div class="card" style="overflow: hidden"><table class="dt"><thead><tr><th>Item</th><th>Group</th><th>Now</th><th>Why</th><th></th></tr></thead><tbody>' + ''.join(
    f'<tr><td>{n}</td><td class="muted">{g}</td><td>{pill(s, pc)}</td><td class="muted">{w}</td><td class="num" style="width: 200px">{btn(a, "tonal sm", "min-width: 160px")}</td></tr>' for n, g, s, pc, w, a in SO[:4]) + '</tbody></table></div>'
sside = f'<aside class="vstack g16" style="width: 380px; flex: none"><div class="card" style="padding: 16px 20px"><p class="cap" style="padding-bottom: 6px">How it works</p><p class="t-sup"><b>Sold out</b> greys the item for every waiter at once. <b>Set a number</b> counts down with each send; at 0 it is sold out. <b>We have it</b> clears a stock warning until the day closes and asks the store for a count.</p></div><div class="card" style="padding: 16px 20px"><p class="cap" style="padding-bottom: 6px">At day close</p><p class="t-sup">Marks and numbers clear. Tomorrow you are asked “still sold out?”.</p></div></aside>'
sotop = f'<div class="hstack">{seg(["Out or low · 4", "All 64 items"], "Out or low · 4")}<span class="field ph" style="width: 360px; margin-left: 12px">{ic("search", "s")}Find an item</span><span class="grow"></span>{btn("Set a number", "tonal", icon="plus")}</div>'
page('Kitchen-Sold-Out', *K, 'Kitchen, Sold out', kscreen('Hot kitchen', 'Sold out and low · as at 20:04', 'chef', sotop + sot, sside, on='Sold out'),
     G, 'Chef', 'Sold out: mark, back on, numbers left, stock warnings', KR + '?view=sold-out', 'U5, needs E2 and E10')
pso = '<div class="card" style="overflow: hidden">' + ''.join(row(n, f'{pill(s_, pc)} {w}', btn(a, 'tonal sm', 'width: 128px'), btn=False) for n, g, s_, pc, w, a in SO[:4]) + '</div>' + btn('Set a number', 'tonal', icon='plus')
pso = pso.replace('Marked by Ruth A. at 19:40', '19:40, Ruth A.').replace('Number set by Ruth A. at 17:05', 'set 17:05').replace('From the kitchen store: 3 servings of steak', 'from stock').replace('Stock says 0 banana leaves; still sells', 'still sells')
page('Kitchen-Sold-Out-Phone', *P, 'Kitchen, Sold out, phone', band('Sold out', 'Out or low · 4 · 20:04', rbtn('search', 'Find an item')) + f'<main class="body">{seg(["Out or low · 4", "All items"], "Out or low · 4", True)}{pso}</main>' + navbar('chef', 'Sold out', True),
     G, 'Chef', 'Sold out on a phone', KR + '?view=sold-out', 'U5, needs E2 and E10')

# 4 set a number
setn = f'''<div class="hstack g24" style="align-items: flex-start"><div class="vstack g12 grow"><div class="field" style="height: 72px; justify-content: flex-end; font-size: 26px; line-height: 32px; font-weight: 700">12</div>{optgrid(["5", "10", "12", "20"], 4, "12", "opt lg")}<p class="t-sup muted">Each send of Goat stew takes one. At 3 the waiters see “3 left”; at 0 it greys out. The number clears when the day closes.</p></div>
    <div style="width: 340px; flex: none">{keypad(h=72)}</div></div>'''
page('Kitchen-Set-Number', *K, 'Kitchen, set a number', kscreen('Hot kitchen', 'Sold out and low · as at 19:45', 'chef', sotop + sot, sside, on='Sold out', inert=True) + scrim() + sheet('How many Goat stew are left now?', 'Local · counted by hand, no stock needed · now 12 left', setn, sfoot(btn('Cancel', 'textbtn'), btn('Set 12 left', 'filled', 'min-width: 240px')), 'mid'),
     G, 'Chef', 'Set a number: “12 goat stews left”, counted down by each send', KR + '?view=sold-out#count', 'U5, needs E2')
page('Kitchen-Set-Number-Phone', *P, 'Set a number, phone', band('Sold out', 'Out or low · 4').replace('<header class="band">', '<header inert class="band">') + '<main class="body" inert></main>' + navbar('chef', 'Sold out', True).replace('<nav class="tabbar"', '<nav inert class="tabbar"') + scrim() + sheet('Goat stew left', 'Each send takes one; at 0 it greys out', f'<div class="field" style="height: 64px; justify-content: flex-end; font-size: 26px; line-height: 32px; font-weight: 700">12</div>{keypad(h=56)}', btn('Set 12 left', 'filled'), gap=12),
     G, 'Chef', 'Set a number on a phone', KR + '?view=sold-out#count', 'U5, needs E2')

# 5 the low-stock banner on Tickets
lb = banner('The kitchen store is low on 3 items', 'Burger buns 14 (minimum 24) · beef mince 2.1 kg (minimum 4 kg) · chips 6 kg (minimum 10 kg). A request to Main store is ready.', btn('Look at the request', 'filled', 'height: 48px'), 'amber', 'box')
page('Kitchen-Low-Stock', *K, 'Kitchen, low-stock banner', kscreen('Hot kitchen', '8 orders · oldest 26 min · as at 19:56', 'chef', f'{lb.replace("btn filled", "btn tonal")}<div class="hstack">{STA}<span class="grow"></span>{legend}</div>{tix(KT[:8], 4, 360)}', KASIDE, on='Tickets').replace('Store<span class="nb">1</span>', 'Store<span class="nb">3</span>'),
     G, 'Chef', 'Low stock: one banner on Tickets, the request already written', KR, 'U6, needs E7 and E10')
page('Kitchen-Low-Stock-Phone', *P, 'Kitchen, low stock, phone', ktickets_phone('Tickets', '8 orders · oldest 26 min · 19:56', 'chef', ptk('Table 6', '26 min', 'p-red', 'Amina K. · sent 19:30', [(2, 'Beef burger', '1 medium, no onions; 1 well done'), (1, 'Chips', ''), (1, 'Chicken wings', '')]) + '<div class="card" style="overflow: hidden; flex: none">' + row('Table 19 · 3 items', 'David S. · sent 19:35', pill('21 min', 'p-red'), btn=True) + '</div><p class="t-sup muted">6 more below, oldest first.</p>', banner('Kitchen store low on 3 items', 'Buns, beef mince, chips. A request is ready.', btn('See request', 'tonal', 'height: 44px'), 'amber', 'box', 'padding: 10px 10px 10px 14px')).replace('Store<span class="nb">1</span>', 'Store<span class="nb">3</span>'),
     G, 'Chef', 'Low-stock banner on a phone', KR, 'U6, needs E7 and E10')

# 6 remake on a ticket
rm = f'''<div class="hstack g16"><div class="grow"><p class="lab">What happened</p>{optgrid(["Burnt", "Dropped", "Cooked wrong", "Something else"], 4, "Dropped")}</div><div><p class="lab">How many</p><div class="step"><button class="round sm tonal" aria-label="One fewer">{ic("minus")}</button><b>1 of 2</b><button class="round sm tonal" aria-label="One more">{ic("plus")}</button></div></div></div>
    <p class="t-sup muted">The ingredients for 1 Beef burger leave the kitchen store again, marked “kitchen error”, and show on the waste report. The guest is not charged twice. The ticket keeps its time.</p>'''
kt = [KT[0].replace('btn filled', 'btn tonal')] + KT[1:8]
page('Kitchen-Remake', *K, 'Kitchen, remake', kscreen('Hot kitchen', '8 orders · oldest 26 min · as at 19:56', 'chef', f'<div class="hstack">{STA}<span class="grow"></span>{legend}</div>{tix(kt, 4, 404)}', KASIDE, inert=True) + scrim() + sheet('Remake on table 6', 'Beef burger · 1 medium, no onions · Amina K.', rm, sfoot(btn('Cancel', 'textbtn'), btn('Remake 1 Beef burger', 'filled', 'min-width: 260px')), 'mid'),
     G, 'Chef', 'Remake: stock out again as kitchen error, no second charge', KR + '#remake', 'U5, needs E6')
page('Kitchen-Remake-Phone', *P, 'Remake, phone', band('Tickets', '8 orders · 19:56').replace('<header class="band">', '<header inert class="band">') + '<main class="body" inert></main>' + navbar('chef', 'Tickets', True).replace('<nav class="tabbar"', '<nav inert class="tabbar"') + scrim() + sheet('Remake on table 6', 'Beef burger · medium, no onions', f'{optgrid(["Burnt", "Dropped", "Cooked wrong", "Something else"], 2, "Dropped")}<div class="hstack"><p class="lab grow" style="margin: 0">How many</p><div class="step"><button class="round sm tonal" aria-label="One fewer">{ic("minus")}</button><b>1 of 2</b><button class="round sm tonal" aria-label="One more">{ic("plus")}</button></div></div><p class="t-sup muted">Ingredients leave stock again as “kitchen error”. The guest is not charged twice.</p>', btn('Remake 1 Beef burger', 'filled')),
     G, 'Chef', 'Remake on a phone', KR + '#remake', 'U5, needs E6')

# 7 opening list: still sold out?
OP = [('Lamb chops', 'Marked sold out at 19:40 by Ruth A.', 'Still out'), ('Goat stew', 'Counted down to 0 at 21:40', 'Back on'), ('Fruit platter', 'Marked sold out at 20:55 by Ruth A.', 'Back on'), ('Chicken luwombo', 'Stock said 0 banana leaves', 'Back on')]
opl = '<div class="card" style="overflow: hidden">' + ''.join(f'<div class="row" style="min-height: 80px"><span class="grow"><span class="t-row">{n}</span><br><span class="t-sup muted">{w}</span></span><div style="width: 360px">{seg(["Still out", "Back on"], c, True)}</div></div>' for n, w, c in OP) + '</div>'
page('Kitchen-Opening', *K, 'Kitchen, still sold out?', kscreen('Hot kitchen', 'Good morning · Fri 27 Nov · 10:02', 'chef', f'<div><h2 class="t-title">Still sold out?</h2><p class="t-body muted" style="margin-top: 4px">Yesterday closed with these 4 items off. Tell the waiters what you have today.</p></div>{opl}<div class="hstack">{btn("Not now", "textbtn")}<span class="grow"></span>{btn("Done · 1 still out", "filled", "min-width: 280px; height: 56px; font-size: 18px")}</div>', '<aside style="width: 300px; flex: none"></aside>', on='Tickets').replace('Tickets<span class="nb">8</span>', 'Tickets'),
     G, 'Chef', 'Opening: yesterday’s sold-out list, “still sold out?”, one tap each', KR + '#opening', 'U5, needs E2 and E11')
pop = '<div class="card" style="overflow: hidden">' + ''.join(f'<div class="vstack g8" style="padding: 12px 16px; box-shadow: inset 0 -1px 0 var(--line)"><span><span class="t-body b">{n}</span><br><span class="t-sup muted">{w}</span></span>{seg(["Still out", "Back on"], c, True)}</div>' for n, w, c in OP) + '</div>'
page('Kitchen-Opening-Phone', *P, 'Still sold out, phone', band('Still sold out?', 'Fri 27 Nov · 10:02') + f'<main class="body">{pop}<div class="hstack">{btn("Not now", "textbtn")}<span class="grow"></span>{btn("Done · 1 still out", "filled", "min-width: 200px")}</div></main>' + navbar('chef', 'Tickets', True).replace('Tickets<span class="nb">8</span>', 'Tickets'),
     G, 'Chef', 'Opening list on a phone', KR + '#opening', 'U5, needs E2 and E11')
