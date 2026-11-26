from base import *
G = 1
T, P = (1280, 800), (390, 844)

def lock_header():
    return f'''  <header class="bar tall">
    <a class="mark solo" href="#" aria-label="Nimbus POS"><i></i></a>
    <h1 class="t-h">Tapas Downtown</h1>
    <span class="clock">Terminal 01 · Main hall</span>
    <span class="grow"></span>
    <span class="name">19:58 · Thu 26 Nov</span>
  </header>'''

def lock_left(locked=True):
    held = '<div class="card" style="padding: 16px 20px"><p class="cap" style="padding-bottom: 6px">Kept while locked</p><p class="t-body">Amina K. locked this screen at 19:58. Her table 23 has 3 items not sent; they wait for her.</p></div>' if locked else ''
    return f'''<section class="vstack g16" style="width: 440px; flex: none; justify-content: center">
      <div><p class="t-sup muted">Thursday 26 November</p><p class="big" style="font-size: 40px">19:58</p></div>
      {held}
      <p class="t-sup muted">The screen locks itself after 15 minutes with no taps.</p>
    </section>'''

def pad_card(title, sub, dots, bad=False, foot=''):
    msg = f'<p class="t-sup" style="text-align: center; color: var(--red); min-height: 20px">{sub}</p>' if bad else f'<p class="t-sup muted" style="text-align: center; min-height: 20px">{sub}</p>'
    return f'''<section class="card vstack g16" style="width: 420px; padding: 24px; flex: none">
      <h2 class="t-h" style="text-align: center">{title}</h2>
      {pin(dots, 4, "bad" if bad else "")}
      {msg}
      {keypad(h=76)}
      {foot}
    </section>'''

def lock_t(name, title, sub, dots, bad=False, foot='', left=None, shows='', route='/lock (new)'):
    body = lock_header() + f'''
  <main class="page" style="flex-direction: row; justify-content: center; align-items: center; gap: 64px">
    {left if left is not None else lock_left()}
    {pad_card(title, sub, dots, bad, foot)}
  </main>'''
    page(name, *T, title, body, G, 'All touch roles', shows, route, 'U1')

def lock_p(name, title, sub, dots, bad=False, foot='', shows='', route='/lock (new)', top='Tapas Downtown', topsub='Terminal 01 · 19:58', note=None):
    msg = f'<p class="t-sup" style="text-align: center; color: var(--red); min-height: 20px">{sub}</p>' if bad else f'<p class="t-sup muted" style="text-align: center; min-height: 20px">{sub}</p>'
    body = band(top, topsub) + f'''
  <main class="body" style="gap: 16px; padding-bottom: 24px">
    {note if note is not None else '<div class="card" style="padding: 14px 16px"><p class="cap" style="padding-bottom: 4px">Kept while locked</p><p class="t-sup">Amina K. locked at 19:58. Table 23 has 3 items not sent; they wait for her.</p></div>'}
    <span class="grow"></span>
    <h2 class="t-h" style="text-align: center">{title}</h2>
    {pin(dots, 4, "bad" if bad else "")}
    {msg}
    {keypad(h=72)}
    {foot}
  </main>'''
    page(name, *P, title, body, G, 'All touch roles', shows, route, 'U1')

forgot = '<button class="btn textbtn" style="align-self: center">Forgot your PIN?</button>'
lock_t('Lock-PIN', 'Type your PIN', 'Your PIN says who you are.', 2, foot=forgot, shows='Lock screen, PIN pad, two digits typed')
lock_p('Lock-PIN-Phone', 'Type your PIN', 'Your PIN says who you are.', 2, foot=forgot, shows='Lock screen on a phone')
lock_t('Lock-Wrong-PIN', 'Type your PIN', 'That PIN is not right. 2 tries left, then a 5-minute wait.', 4, bad=True, foot=forgot, shows='Wrong PIN, tries left')
lock_p('Lock-Wrong-PIN-Phone', 'Type your PIN', 'Not right. 2 tries left, then a 5-minute wait.', 4, bad=True, foot=forgot, shows='Wrong PIN on a phone')

setleft = '''<section class="vstack g16" style="width: 440px; flex: none; justify-content: center">
      <div><p class="cap">Welcome, Brian O.</p><h2 class="t-title" style="margin-top: 6px">Set your own PIN</h2></div>
      <div class="card" style="padding: 16px 20px"><div class="hstack" style="min-height: 40px"><span class="pill p-green">Done</span><span class="t-body">1. Type four numbers</span></div><div class="hstack" style="min-height: 40px"><span class="pill p-brand">Now</span><span class="t-body b">2. Type them again</span></div></div>
      <p class="t-sup muted">Nobody else sees your PIN, not even the manager. Do not use 1234 or your birthday.</p>
    </section>'''
lock_t('PIN-Set-Own', 'Type the same four again', 'Step 2 of 2', 3, foot='<button class="btn textbtn" style="align-self: center">Start over</button>', left=setleft, shows='Set your own PIN, typed twice by the person', route='/pin/set (new)')
lock_p('PIN-Set-Own-Phone', 'Type the same four again', 'Nobody else sees it, not even the manager.', 3, foot='<button class="btn textbtn" style="align-self: center">Start over</button>', note='<div class="card" style="padding: 8px 16px"><div class="hstack" style="min-height: 40px"><span class="pill p-green">Done</span><span class="t-body">1. Type four numbers</span></div><div class="hstack" style="min-height: 40px"><span class="pill p-brand">Now</span><span class="t-body b">2. Type them again</span></div></div><p class="t-sup muted">Do not use 1234 or your birthday.</p>', shows='Set your own PIN on a phone', route='/pin/set (new)', top='Set your own PIN', topsub='Welcome, Brian O.')

# ---- start my shift
def shift_card(phone=False):
    w = '' if phone else 'width: 560px; '
    return f'''<section class="card vstack g16" style="{w}padding: 24px">
      <div class="hstack"><span class="av" style="width: 56px; height: 56px; font-size: 17px">AK</span><div class="grow"><p class="t-sup muted">Good evening</p><h2 class="t-h">Amina K.</h2><p class="t-sup muted">Waiter · Tapas Downtown</p></div></div>
      <div class="hr"></div>
      {kv("Shift on the roster", "17:00 to 23:00")}
      {kv("Area", "Main hall")}
      {kv("Now", "16:52, 8 minutes early")}
      <p class="t-sup muted">You can look at the floor before you start. Taking orders needs a started shift.</p>
      <div class="vstack g8">{btn("Start my shift", "filled", "height: 56px; font-size: 17px")}{btn("Only look for now", "textbtn")}{btn("Not Amina K.? Lock the screen", "textbtn") if phone else ""}</div>
    </section>'''
body = tbar('Start of shift', 'Terminal 01 · Main hall', 'waiter') + f'''
  <main class="page" style="align-items: center; justify-content: center">{shift_card()}</main>'''
page('Shift-Start', *T, 'Start my shift', body, G, 'Waiter', 'Start my shift, after the PIN', '/shift/start (new)', 'U1')
body = band('Start of shift', 'Tapas Downtown · 16:52') + f'<main class="body">{shift_card(True)}</main>'
page('Shift-Start-Phone', *P, 'Start my shift, phone', body, G, 'Waiter', 'Start my shift on a phone', '/shift/start (new)', 'U1')

# ---- floor, shift not started
notstarted = banner('Your shift has not started', 'You can look at every table. To take an order, start your shift.', btn('Start my shift', 'filled', 'height: 44px'), 'amber', 'clock')
tiles = [t.replace('<button class="tbl">', '<button class="tbl other">').replace('<span class="who">You</span>', '<span class="who">Brian O.</span>').replace('p-brand', 'p-neutral').replace('3 items not sent', '3 guests · 6 min').replace('p-amber">Not sent', 'p-neutral">Open') for t in MAIN_TILES]
body = tbar('Floor', 'Main hall · 17 of 32 tables open · as at 16:52', 'waiter', 'Find a table or a tab') + f'''
  <main class="page" style="padding: 16px 32px 16px; gap: 12px">
    {notstarted}
    <div class="hstack" style="justify-content: space-between">{areas()}{seg(["My tables · 0", "All tables"], "All tables")}</div>
{floor(tiles)}
  </main>
{navbar("waiter", "Floor")}'''
page('Floor-Shift-Not-Started', *T, 'Floor, shift not started', body, G, 'Waiter', 'Floor before the shift starts: look only', '/waiter/floor', 'U1')
nsp = banner('Shift not started', 'Look only. Start it to take orders.', btn('Start', 'filled', 'height: 44px'), 'amber', 'clock', 'padding: 10px 10px 10px 14px')
body = band('Floor', 'Main hall · as at 16:52', rbtn('search', 'Find a table')) + f'''
  <main class="body">
    {nsp}
    <div class="sw"><button class="round sm" aria-label="Previous area">{ic("back")}</button><button class="mid"><span class="t-row">Main hall</span> <span class="t-sup muted">· 12 free</span></button><button class="round sm" aria-label="Next area">{ic("chev")}</button></div>
{floor([ptile(1, "4 seats", "Free", "p-green", "free"), ptile(2, "42 min", "Open", "p-neutral", "other"), ptile(3, "18 min", "Open", "p-neutral", "other"), ptile(4, "2 seats", "Free", "p-green", "free"), ptile(5, "1 h 20", "Bill", "p-amber", "other"), ptile(6, "26 min", "Late", "p-red", "other"), ptile(7, "20:00", "Reserved", "p-neutral", "free"), ptile(8, "4 seats", "Free", "p-green", "free"), ptile(9, "9 min", "Open", "p-neutral", "other"), ptile(10, "51 min", "Open", "p-neutral", "other"), ptile(11, "4 seats", "Free", "p-green", "free"), ptile(12, "1 h 05", "Bill", "p-amber", "other"), ptile(13, "33 min", "Open", "p-neutral", "other"), ptile(14, "6 seats", "Free", "p-green", "free"), ptile(15, "4 seats", "Cleaning", "p-neutral", "free")], 3, "floor c")}
  </main>
{navbar("waiter", "Floor", True)}'''
page('Floor-Shift-Not-Started-Phone', *P, 'Floor, shift not started, phone', body, G, 'Waiter', 'Floor before the shift starts, phone', '/waiter/floor', 'U1')

# ---- cashier floor: every waiter's name, Bill tables first
def cashier_tile(t):
    return t.replace('<span class="who">You</span>', '<span class="who">Amina K.</span>').replace('tbl other', 'tbl')
ctiles = [cashier_tile(t) for t in MAIN_TILES]
body = tbar('Floor', 'Main hall · 3 tables want the bill · as at 20:41', 'cashier', 'Find a table, a tab or a bill') + f'''
  <main class="page" style="padding: 16px 32px 16px">
    <div class="hstack" style="justify-content: space-between">{areas()}{seg(["Bill · 3", "All tables"], "All tables")}</div>
{floor(ctiles)}
  </main>
{navbar("cashier", "Floor")}'''
page('Cashier-Floor', *T, 'Floor, cashier', body, G, 'Cashier', 'The cashier’s floor: every table with its waiter, Bill tables marked', '/cashier/floor', 'U1')
bills = [ptile(5, '132,000', 'Bill', 'p-amber'), ptile(12, '98,000', 'Bill', 'p-amber'), ptile(28, '164,000', 'Bill', 'p-amber')]
openp = [ptile(2, '86,000', 'Open', 'p-brand'), ptile(3, '54,000', 'Open', 'p-brand'), ptile(6, '61,000', 'Late', 'p-red'), ptile(9, '24,000', 'Open', 'p-brand'), ptile(10, '118,500', 'Open', 'p-brand'), ptile(13, '72,000', 'Open', 'p-brand'), ptile(16, '38,000', 'Open', 'p-brand'), ptile(17, '45,000', 'Open', 'p-brand'), ptile(19, '66,000', 'Late', 'p-red')]
body = band('Floor', 'Main hall · 3 want the bill · as at 20:41', rbtn('search', 'Find a bill')) + f'''
  <main class="body">
    <div class="sw"><button class="round sm" aria-label="Previous area">{ic("back")}</button><button class="mid"><span class="t-row">Main hall</span> <span class="t-sup muted">· 17 open</span></button><button class="round sm" aria-label="Next area">{ic("chev")}</button></div>
    <p class="cap">Want the bill · UGX</p>
{floor(bills, 3, "floor c")}
    <p class="cap">Open · UGX · 9 of 14, scroll for the rest</p>
{floor(openp, 3, "floor c")}
  </main>
{navbar("cashier", "Floor", True)}'''
page('Cashier-Floor-Phone', *P, 'Floor, cashier, phone', body, G, 'Cashier', 'The cashier’s floor on a phone', '/cashier/floor', 'U1')

# ---- Tabs area
TABS = [('Tab 1', 'Red cap at the bar', 'You', '46,000', 'p-brand', 'Open', ''), ('Tab 2', 'Two at the window', 'Brian O.', '31,000', 'p-neutral', 'Open', 'other'),
        ('Tab 3', 'Birthday group', 'You', '128,000', 'p-amber', 'Bill', ''), ('Tab 4', 'Blue shirt, standing', 'David S.', '18,000', 'p-neutral', 'Open', 'other'),
        ('Tab 5', 'Darts board', 'Grace N.', '62,000', 'p-neutral', 'Open', 'other'), ('Tab 6', 'Office party, 8', 'You', '211,500', 'p-red', 'Late', '')]
def tab_tiles(new=False):
    o = [f'<button class="tbl {c}"><span class="top"><span class="no">{n}</span><span class="pill {pc}">{pl}</span></span><span class="mid">{note}</span><span class="bot"><span class="who">{w}</span><span class="amt">{a}</span></span></button>' for n, note, w, a, pc, pl, c in TABS]
    if new: o.append(f'<button class="tbl new">{ic("plus")}New tab</button>')
    return o
def tabs_floor(inert=False):
    a = ' inert' if inert else ''
    return tbar('Floor', 'Tabs · 6 open · as at 21:05', 'waiter', 'Find a table or a tab') + f'''
  <main class="page" style="padding: 16px 32px 16px"{a}>
    <div class="hstack" style="justify-content: space-between">{areas("Tabs")}<div class="hstack">{seg(["My tabs · 3", "All tabs"], "All tabs")}{btn("New tab", "filled", icon="plus")}</div></div>
{floor(tab_tiles(), 6)}
    <p class="t-sup muted">A tab is for guests with no table. Each gets the next free number and a note to find them.</p>
  </main>
{navbar("waiter", "Floor")}'''
page('Floor-Tabs', *T, 'Floor, Tabs area', tabs_floor(), G, 'Waiter', 'The Tabs area with New tab', '/waiter/floor?area=tabs', 'U1, needs E3')
pt = [ptile(n.split()[1], w if w != 'You' else a, pl, pc if w == 'You' else 'p-neutral', c) for n, note, w, a, pc, pl, c in TABS]
def tabs_phone(inert=False):
    a = ' inert' if inert else ''
    return band('Floor', 'Tabs · 6 open · as at 21:05', rbtn('search', 'Find a tab') + rbtn('plus', 'New tab')) + f'''
  <main class="body"{a}>
    <div class="sw"><button class="round sm" aria-label="Previous area">{ic("back")}</button><button class="mid"><span class="t-row">Tabs</span> <span class="t-sup muted">· 6 open</span></button><button class="round sm" aria-label="Next area">{ic("chev")}</button></div>
    <div class="card" style="overflow: hidden">{"".join(row(f"{n} · {note}", f"{w} · UGX {am}", pill(pl, pc if w == "You" else "p-neutral")) for n, note, w, am, pc, pl, c in TABS)}</div>
    {btn("New tab", "filled", icon="plus")}
  </main>
{navbar("waiter", "Floor", True)}'''
page('Floor-Tabs-Phone', *P, 'Tabs, phone', tabs_phone(), G, 'Waiter', 'Tabs on a phone, as rows with their notes', '/waiter/floor?area=tabs', 'U1, needs E3')

# ---- name a tab
def tab_sheet(cls='mid'):
    return sheet('New tab · Tab 7', 'Tab 7 is the next free number. Add a note so anyone can find them.', f'''
    <div><label class="lab">Note</label><div class="field">Green dress, by the pillar</div></div>
    <div><p class="lab">Or pick one</p>{optgrid(["At the bar", "Standing", "By the door", "Darts board"], 4)}</div>
    <div class="hstack g16"><div><p class="lab">Guests</p><div class="step"><button class="round sm tonal" aria-label="One fewer">{ic("minus")}</button><b>2</b><button class="round sm tonal" aria-label="One more">{ic("plus")}</button></div></div><p class="t-sup muted grow">An empty tab can be deleted by anyone. Once something is sent it stays until paid.</p></div>''',
        sfoot(btn('Cancel', 'textbtn'), btn('Open Tab 7', 'filled', 'min-width: 240px')), cls)
body = tabs_floor(True).replace('<nav class="navbar"', '<nav inert class="navbar"').replace('<header class="bar tall">', '<header class="bar tall" inert>') + scrim() + tab_sheet()
page('Tab-Name', *T, 'Name a tab', body, G, 'Waiter', 'New tab: number given, a note to find the guests', '/waiter/floor?area=tabs#new-tab', 'U1, needs E3')
psheet = sheet('New tab · Tab 7', 'A note helps anyone find them.', f'''
    <div><label class="lab">Note</label><div class="field">Green dress, by the pillar</div></div>
    {optgrid(["At the bar", "Standing", "By the door", "Darts board"], 2)}
    <div class="hstack"><p class="lab grow" style="margin: 0">Guests</p><div class="step"><button class="round sm tonal" aria-label="One fewer">{ic("minus")}</button><b>2</b><button class="round sm tonal" aria-label="One more">{ic("plus")}</button></div></div>''',
    btn('Open Tab 7', 'filled'))
body = tabs_phone(True).replace('<header class="band">', '<header class="band" inert>').replace('<nav class="tabbar"', '<nav inert class="tabbar"') + scrim() + psheet
page('Tab-Name-Phone', *P, 'Name a tab, phone', body, G, 'Waiter', 'New tab on a phone', '/waiter/floor?area=tabs#new-tab', 'U1, needs E3')
