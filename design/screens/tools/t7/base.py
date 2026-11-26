# T7 generator base: plain .html drawings that link ../kit.css, built only from kit classes.
import os, re, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from g import I, NAV  # icons and bottom-bar sections from the first 38 drawings
HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'html')
REG = []  # (name, w, h, group, role, shows, route, milestone)
EXISTING = set(f[:-5] for f in os.listdir(HTML) if f.endswith('.html')) if os.path.isdir(HTML) else set()
I.update(dict(
  key='<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  wifi='<path d="M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M9 17a4 4 0 0 1 6 0"/><path d="M3 3l18 18"/>',
  star='<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  redo='<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>', hand='<path d="M7 11V5a1.5 1.5 0 0 1 3 0v5M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v6M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.6L7 14"/>',
  warn='<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>', edit='<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  gear='<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  bag='<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', fire='<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 2 1 3 3 3 5 1-1 1-3 0-9z"/>',
  pause='<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  receipt='<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>', bksp='<path d="M21 6H9l-6 6 6 6h12z"/><path d="m12 9 6 6M18 9l-6 6"/>',
  door='<path d="M5 21V4h11v17M16 21h3M12 12h.01"/><path d="M16 4l3 1v16"/>',
))
def ic(n, c=''): return f'<svg class="ic {c}" viewBox="0 0 24 24" aria-hidden="true">{I[n]}</svg>'
def reg(name, w, h, group, role, shows, route, ms):
    assert all(r[0] != name for r in REG), name
    REG.append((name, w, h, group, role, shows, route, ms))
def page(name, w, h, title, body, group, role, shows, route, ms):
    if name in ORIGINAL38: raise SystemExit('refusing to overwrite ' + name)  # never touch the first 38
    reg(name, w, h, group, role, shows, route, ms)
    with open(os.path.join(HTML, name + '.html'), 'w') as f:
        f.write(f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="../kit.css">
</head>
<body>
<x-dc>
<helmet>
<style>
body{{margin:0}}
</style>
</helmet>
<div class="ab" style="width: {w}px; height: {h}px">
{body}
</div>
</x-dc>
</body>
</html>
''')
ORIGINAL38 = set('''Accountant-Costs Accountant-Phone-Costs Bill-Phone Cashier-Pay Cashier-Receipts Cashier-Till Chef-Request-Phone Chef-Waste-Phone Floor-1024 Floor-1920 Floor-Phone Kitchen-Store Kitchen Main Manager-Floor Manager-Item Manager-Phone-Approve Manager-Phone-Today Manager-Waste-Report Nav-Roles Order-Empty Order-Laptop Order-Other Order-Phone-Check Order-Phone-Item Order-Phone Order-Terminal Owner-Phone-Today Reservations-Supervisor Reservations-Waiter Store-Requests Supervisor-Approvals Supervisor-Table Supervisor-Void Table-Life Table-Tile Waiter-Me Waiter-Ready'''.split())

# ---------- people and places (the fictional cast of the first 38) ----------
WHO = dict(waiter=('Amina K.', 'Waiter', 'Terminal 01', 'AK'), cashier=('Sarah M.', 'Cashier', 'Till 1', 'SM'),
           supervisor=('Grace N.', 'Supervisor', 'Front desk', 'GN'), chef=('Ruth A.', 'Chef', 'Kitchen screen 1', 'RA'),
           bar=('Isaac B.', 'Bartender', 'Bar screen', 'IB'), store=('Joel T.', 'Store keeper', 'Main store', 'JT'),
           manager=('Peter K.', 'Manager', 'Tapas Downtown', 'PK'), owner=('Daniel W.', 'Owner', 'All branches', 'DW'),
           accountant=('Esther L.', 'Accountant', 'Tapas Downtown', 'EL'))
NAV = dict(NAV)
NAV['bar'] = NAV['kitchen']
NAV['supervisor_phone'] = [('Floor', 'grid', 0), ('Bookings', 'cal', 0), ('Approvals', 'shield', 4), ('Team', 'team', 0), ('Me', 'user', 0)]

def navbar(role, on, phone=False):
    tag = 'tabbar' if phone else 'navbar'
    secs = NAV['supervisor_phone'] if (phone and role == 'supervisor') else NAV[role]
    o = f'  <nav class="{tag}" aria-label="Main">\n'
    for l, i, n in secs:
        if phone and role == 'supervisor' and on == 'Reservations': on = 'Bookings'
        b = f'<span class="nb">{n}</span>' if n else ''
        cur = ' class="on" aria-current="page"' if l == on else ''
        o += f'    <a{cur} href="#">{ic(i, "" if phone else "l")}{l}{b}</a>\n'
    return o + '  </nav>'

def tbar(title, sub, role, search=None, extra=''):
    n, r, p, _ = WHO[role]
    s = f'<span class="search">{ic("search", "s")}{search}</span>' if search else ''
    return f'''  <header class="bar tall">
    <a class="mark solo" href="#" aria-label="Nimbus POS, home"><i></i></a>
    <h1 class="t-h">{title}</h1>
    <span class="clock">{sub}</span>
    <span class="grow"></span>
    {s}{extra}
    <span class="name"><b>{n}</b> · {r} · {p}</span>
    <button class="rb" aria-label="Lock the screen">{ic("lock")}</button>
  </header>'''

def obar(title, sub, role, back='Floor', search='Search the whole menu', extra=''):
    s = f'<span class="search" style="width: 320px">{ic("search", "s")}{search}</span>' if search else ''
    return f'''  <header class="bar">
    <a class="back" href="#">{ic("back")}{back}</a>
    <h1 class="t-h">{title}</h1>
    <span class="clock">{sub}</span>
    <span class="grow"></span>
    {s}{extra}
    <span class="who" title="Signed in">{WHO[role][3]}</span>
  </header>'''

LNAV = dict(manager=['Floor', 'Menu', 'Stock', 'Staff', 'More'], accountant=['Costs', 'Stock value', 'Purchases', 'Reports'],
            owner=['Today', 'Branches', 'Reports', 'Alerts', 'More'])
def lbar(role, on, place='Tapas Downtown'):
    nav = ''.join(f'<a class="on" aria-current="page" href="#">{x}</a>' if x == on else f'<a href="#">{x}</a>' for x in LNAV[role])
    return f'''  <header class="bar">
    <button class="rb" aria-label="All apps">{ic("apps")}</button><span class="div"></span>
    <a class="mark" href="#"><i></i>Nimbus POS</a>
    <nav aria-label="Main">{nav}</nav>
    <span class="grow"></span>
    <span class="search">{ic("search", "s")}Search</span>
    <button class="rb" aria-label="Alerts">{ic("alert")}</button>
    <span class="clock">{place}</span>
    <button class="who" aria-label="Account">{WHO[role][3]}</button>
  </header>'''

def cp(crumb, title, right='', pill=''):
    return f'  <div class="cp"><span class="crumb">{crumb}</span><h1 class="t-row">{title}</h1>{pill}<span class="grow"></span>{right}</div>'

def band(title, sub, btns=''):
    return f'''  <header class="band">
    <div class="hstack"><h1 class="t-title grow">{title}</h1>{btns}</div>
    <p class="sub">{sub}</p>
  </header>'''
def rband(title, sub, more=True, back='Back'):
    m = f'<button class="rb" aria-label="Table actions">{ic("more")}</button>' if more else ''
    return f'''  <header class="band" style="padding-bottom: 16px">
    <div class="hstack">
      <a class="rb" href="#" aria-label="{back}">{ic("back")}</a>
      <div class="grow"><h1 class="t-h">{title}</h1><p class="t-sup" style="color: var(--on-primary-muted)">{sub}</p></div>
      {m}
    </div>
  </header>'''
def rbtn(i, label): return f'<button class="rb" aria-label="{label}">{ic(i)}</button>'

# ---------- floor tiles, taken verbatim from the first drawings ----------
def _tiles(fn):
    src = open(os.path.join(HTML, fn)).read()
    return re.findall(r'<button class="tbl[^"]*">.*?</button>', src)
MAIN_TILES = _tiles('Main.html')          # tables 1..32, Amina K. is "You"
PHONE_MINE = _tiles('Floor-Phone.html')[:6]
PHONE_FREE = _tiles('Floor-Phone.html')[6:]
def floor(tiles, cols=8, cls='floor', inert=False):
    a = ' inert' if inert else ''
    return f'    <div class="{cls}" style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"{a}>\n      ' + '\n      '.join(tiles) + '\n    </div>'
def tile(no, pill, pcls, mid, who='', amt='', cls=''):
    return f'<button class="tbl {cls}"><span class="top"><span class="no">{no}</span><span class="pill {pcls}">{pill}</span></span><span class="mid">{mid}</span><span class="bot"><span class="who">{who}</span><span class="amt">{amt}</span></span></button>'
def ptile(no, small, pill, pcls, cls=''):
    return f'<button class="tbl {cls}"><span class="top"><span class="no">{no}</span><span class="t-bar muted">{small}</span></span><span class="bot"><span class="pill {pcls}">{pill}</span></span></button>'
AREAS = [('Main hall', 32), ('Terrace', 16), ('Bar', 10), ('VIP', 6), ('Tabs', 6)]
def areas(on='Main hall'):
    return '<div class="hstack g8" role="tablist" aria-label="Areas">' + ''.join(
        f'<button class="chip{" on" if a == on else ""}" role="tab">{a} <span class="n">{n}</span></button>' for a, n in AREAS) + '</div>'

# ---------- table 12's bill (UGX 98,000) ----------
T12 = [('Sent 20:15', 'sent', [(2, 'Lager 500 ml', '', '12,000'), (1, 'Blended Scotch', 'Double · Cola', '15,000'), (1, 'Cola 300 ml', '', '3,000')]),
       ('Sent 19:42', 'sent', [(1, 'Beef burger', 'Medium · No onions', '28,000'), (2, 'Chips', '', '16,000'), (1, 'Chicken wings', '', '24,000')])]
def lines(groups, tag='button'):
    o = ''
    for k, (cap, cls, ls) in enumerate(groups):
        if k: o += '<div class="hr" style="margin: 8px 16px"></div>'
        if cap: o += f'<p class="cap" style="padding: 8px 16px 4px">{cap}</p>'
        for q, n, sub, p in ls:
            sb = f'<br><span class="sub">{sub}</span>' if sub else ''
            o += f'<{tag} class="line {cls}"><span class="q">{q}</span><span class="grow"><span class="nm">{n}</span>{sb}</span><span class="pr">{p}</span></{tag}>'
    return o
def check(body, total, foot, title='Order', count='8 items', inert=False, label='Total'):
    a = ' inert' if inert else ''
    return f'''    <aside class="check" aria-label="{title}"{a}>
      <div class="hstack" style="padding: 16px 16px 8px; justify-content: space-between"><h2 class="t-h">{title}</h2><span class="t-sup muted">{count}</span></div>
      {body}
      <span class="grow"></span>
      <div class="hr"></div>
      <div class="tot" style="padding: 14px 16px 4px"><span class="t-row">{label}</span><span class="t-h">UGX {total}</span></div>
      <div class="hstack g8" style="padding: 12px 16px 16px">{foot}</div>
    </aside>'''
MORE = f'<button class="sq tonal" aria-label="Table actions">{ic("more")}</button>'
def btn(label, kind='tonal', style='', tag='button', icon=None):
    i = ic(icon, 's') if icon else ''
    st = f' style="{style}"' if style else ''
    return f'<{tag} class="btn {kind}"{st}>{i}{label}</{tag}>'

FOODG = ['Popular', 'Offers', 'Starters', 'Soups', 'Salads', 'Mains', 'Grills', 'Burgers', 'Pizza', 'Pasta', 'Local', 'Sides', 'Kids', 'Desserts', 'Breakfast', 'Extras']
DRINKG = ['Popular', 'Offers', 'Beer', 'Cider', 'Soft drinks', 'Water', 'Juice', 'Wine', 'Whisky', 'Gin', 'Vodka', 'Rum', 'Tequila', 'Liqueur', 'Cocktails', 'Hot drinks']
POP = [('Beef burger', '28,000'), ('Chicken wings', '24,000'), ('Chips', '8,000'), ('Goat stew', '26,000'), ('Grilled tilapia', '38,000'), ('Chicken curry', '27,000'), ('Pork ribs', '35,000'), ('Beef samosas', '12,000'), ('Margherita pizza', '30,000'), ('Club sandwich', '25,000'), ('Greek salad', '20,000'), ('Fish and chips', '32,000'), ('Rolex', '9,000'), ('Matooke and beef', '22,000'), ('Chicken luwombo', '30,000'), ('Spring rolls', '12,000'), ('Pepper steak', '45,000'), ('Spaghetti bolognese', '27,000'), ('Fruit platter', '15,000'), ('Chocolate cake', '14,000')]
def seg(opts, on, fill=False, style=''):
    st = f' style="{style}"' if style else ''
    return f'<div class="seg{" fill" if fill else ""}"{st}>' + ''.join(f'<button class="{"on" if o == on else ""}">{o}</button>' for o in opts) + '</div>'
def optgrid(opts, cols, on=(), cls='opt', style=''):
    on = (on,) if isinstance(on, str) else on
    return f'<div class="optgrid" style="grid-template-columns: repeat({cols}, minmax(0, 1fr)){";" + style if style else ""}">' + ''.join(
        f'<button class="{cls}{" on" if o in on else ""}">{o}</button>' for o in opts) + '</div>'
def menu(groups, gon, items, cols, side='Food', top='', inert=False, extra=''):
    a = ' inert' if inert else ''
    it = ''.join(items) if items and isinstance(items[0], str) else ''.join(
        (f'<button class="item off"><b>{n}</b><span>Sold out</span></button>' if p is None else f'<button class="item"><b>{n}</b><span>{p}</span></button>') for n, p in items)
    sd = seg(['Food', 'Drinks'], side) .replace('<button class="', '<button style="min-width: 140px" class="')
    return f'''    <main class="menu"{a}>
      <div class="hstack" style="justify-content: space-between">{sd}{top}</div>
      {optgrid(groups, 8, gon)}
      <div class="items" style="grid-template-columns: repeat({cols}, minmax(0, 1fr))">{it}</div>{extra}
    </main>'''

def scrim(): return '  <div class="scrim"></div>'
def sheet(title, sub, body, foot='', cls='', close=True, gap=16, style=''):
    c = f'<a class="close" href="#" aria-label="Close">{ic("close")}</a>' if close else ''
    s = f'<p class="t-sup muted">{sub}</p>' if sub else ''
    grab = '' if 'side' in cls else '<span class="grab"></span>'
    return f'''  <section class="sheet {cls}" aria-label="{title}" style="gap: {gap}px{";" + style if style else ""}">
    {grab}
    <div class="hstack"><div class="grow"><h2 class="t-h">{title}</h2>{s}</div>{c}</div>
    {body}
    {foot}
  </section>'''
def sfoot(*b, end=True):
    return f'<div class="hstack" style="justify-content: {"flex-end" if end else "stretch"}">' + ''.join(b) + '</div>'
def keypad(keys=('1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'del'), h=None, style=''):
    st = f' style="height: {h}px"' if h else ''
    o = ''
    for k in keys:
        if k == 'del': o += f'<button class="key"{st} aria-label="Delete">{ic("bksp", "l")}</button>'
        elif k == 'C': o += f'<button class="key"{st} aria-label="Clear" style="font-size: 17px">Clear</button>' if not h else f'<button class="key" aria-label="Clear" style="height: {h}px; font-size: 17px">Clear</button>'
        else: o += f'<button class="key"{st}>{k}</button>'
    return f'<div class="optgrid" style="grid-template-columns: repeat(3, minmax(0, 1fr)){";" + style if style else ""}">{o}</div>'
def pin(n_full, n=4, cls=''):
    return f'<div class="pin {cls}" aria-label="{n_full} of {n} digits">' + ''.join('<i class="on"></i>' if k < n_full else '<i></i>' for k in range(n)) + '</div>'
def kv(label, value, strong=True):
    return f'<div class="hstack" style="justify-content: space-between; min-height: 40px"><span class="t-sup muted">{label}</span><span class="t-body{" b" if strong else ""}" style="text-align: right">{value}</span></div>'
def row(title, sub='', right='', av='', btn=True, cls='row', style=''):
    a = f'<span class="av">{av}</span>' if av else ''
    s = f'<br><span class="t-sup muted">{sub}</span>' if sub else ''
    tag = 'button' if btn else 'div'
    st = f' style="width: 100%{";" + style if style else ""}"'
    return f'<{tag} class="{cls}"{st}>{a}<span class="grow"><span class="t-body b">{title}</span>{s}</span>{right}</{tag}>'
CHEV = ic('chev')
def pill(t, c='p-neutral'): return f'<span class="pill {c}">{t}</span>'
def banner(text, sub='', right='', tone='amber', icon='warn', style=''):
    bg = {'amber': 'var(--amber-t)', 'red': 'var(--red-t)', 'green': 'var(--green-t)', 'brand': 'var(--tonal)'}[tone]
    fg = {'amber': 'var(--amber)', 'red': 'var(--red)', 'green': 'var(--green)', 'brand': 'var(--primary)'}[tone]
    s = f'<br><span class="t-sup">{sub}</span>' if sub else ''
    return f'<div class="card hstack" style="padding: 10px 12px 10px 16px; background: {bg}; color: {fg}; box-shadow: none; min-height: 64px{";" + style if style else ""}">{ic(icon)}<span class="grow"><span class="t-body b">{text}</span>{s}</span>{right}</div>'
def toast(text, action='Undo', style=''):
    return f'<div class="toast" role="status" style="{style}"><span class="grow">{text}</span><button class="btn sm textbtn" style="color: var(--on-primary)">{action}</button></div>'

def write_list(path, names=None):
    items = [dict(name=r[0], w=r[1], h=r[2]) for r in REG if names is None or r[0] in names]
    json.dump(items, open(path, 'w'))
