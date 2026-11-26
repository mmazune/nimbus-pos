from base import *
G = 3
T, P = (1280, 800), (390, 844)
R = '/waiter/floor?tableId='

def oscreen(mainhtml, checkhtml, title='Table 12', sub='3 guests · open 1 h 05 · Amina K.', search='Search the whole menu', over=''):
    return obar(title, sub, 'waiter', search=search) + f'''
  <div class="ord" style="grid-template-columns: minmax(0, 1fr) 372px">
    <main class="menu">{mainhtml}</main>
{checkhtml}
  </div>{over}'''
def searchbar(q):
    return f'<span class="search" style="width: 320px; background: var(--card); color: var(--text)">{ic("search", "s")}<span class="grow">{q}</span>{ic("close", "s")}</span>'
def obar_q(title, sub, q):
    return obar(title, sub, 'waiter', search=None, extra=searchbar(q))
def phone(name, title, shows, route, ms, body, foot, sub='3 guests · open 1 h 05', head=None, over=''):
    page(name, *P, title, (head or rband('Table 12', sub)) + f'\n  <main class="body" style="gap: 12px">{body}</main>\n  <footer class="foot">{foot}</footer>{over}', G, 'Waiter', shows, route, ms)
def pfoot(n_order, label):
    return f'<a class="btn tonal" href="#" style="flex: 1 1 0">Order · {n_order}</a>' + btn(label, 'filled', 'flex: 2 1 0')
NOTSENT = ('Not sent', '', [(2, 'Lager 500 ml', '', '12,000'), (1, 'Blended Scotch', 'Double · Cola', '15,000'), (1, 'Cola 300 ml', '', '3,000')])
SENT1942 = T12[1]
std_check = check(lines([NOTSENT, SENT1942]), '98,000', MORE + btn('Print bill', 'tonal', 'flex: 1 1 0; padding: 0 12px') + btn('Send 4 items', 'filled', 'flex: 1.4 1 0; padding: 0 12px'))
def item(n, p, cls='', small=None):
    s = small or p
    return f'<button class="item {cls}"><b>{n}</b><span>{s}</span></button>'

# 1 search results
RES = [('Chicken wings', '24,000', 'Food › Starters'), ('Chicken curry', '27,000', 'Food › Mains'), ('Chicken luwombo', '30,000', 'Food › Local'), ('Club sandwich', '25,000', 'Food › Mains · chicken, bacon'), ('Chicken soup', '14,000', 'Food › Soups')]
res = ''.join(f'<button class="item"><b>{n}</b><span>{p} · {w}</span></button>' for n, p, w in RES)
main = f'<div class="hstack" style="justify-content: space-between"><p class="t-row">5 found for “chick”</p><span class="t-sup muted">Whole menu, food and drinks</span></div><div class="items" style="grid-template-columns: repeat(3, minmax(0, 1fr))">{res}</div><p class="t-sup muted">Tap one to add it. Clear the search to go back to the groups.</p>'
page('Order-Search', *T, 'Order, search results', obar_q('Table 12', '3 guests · open 1 h 05', 'chick') + oscreen(main, std_check)[len(obar('Table 12', '3 guests · open 1 h 05 · Amina K.', 'waiter')):], G, 'Waiter', 'Search the whole menu: results with where each item lives', R + '&q=', 'U2')
pres = '<div class="items" style="grid-template-columns: minmax(0, 1fr)">' + ''.join(f'<div class="mrow"><span class="grow"><b>{n}</b><br><span class="t-sup muted">{w}</span></span><button class="mbtn">Add<small>{p}</small></button></div>' for n, p, w in RES) + '</div>'
phone('Order-Search-Phone', 'Order, search, phone', 'Search results on a phone', R + '&q=', 'U2',
      f'<div class="field" style="background: var(--card); box-shadow: var(--shadow-s)">{ic("search", "s")}<span class="grow">chick</span><button class="close" aria-label="Clear the search" style="background: none">{ic("close", "s")}</button></div><p class="t-row">5 found</p>{pres}', pfoot(8, 'Send 4 items'))

# 2 nothing found
empty = f'''<div class="card vstack g12" style="padding: 32px; align-items: center; text-align: center; margin-top: 24px">
      <span class="bubble" style="width: 72px; height: 72px">{ic("search", "l")}</span>
      <p class="t-h">Nothing called “kebab” on the menu</p>
      <p class="t-body muted" style="max-width: 460px">Check the spelling, or try one word. If the guest wants something the kitchen can make, add it as an open item with a name and a price.</p>
      <div class="hstack">{btn("Clear the search", "textbtn")}{btn("Add an open item", "tonal", icon="plus")}</div>
      <p class="t-sup muted">Open items up to UGX 30,000 need no PIN. Above that, a supervisor types theirs.</p>
    </div>'''
head = obar('Table 12', '3 guests · open 1 h 05', 'waiter', search=None, extra=searchbar('kebab'))
page('Order-Search-None', *T, 'Order, nothing found', head + f'''
  <div class="ord" style="grid-template-columns: minmax(0, 1fr) 372px">
    <main class="menu">{empty}</main>
{std_check}
  </div>''', G, 'Waiter', 'Search finds nothing: say so, offer an open item', R + '&q=', 'U2, open item needs E13')
phone('Order-Search-None-Phone', 'Order, nothing found, phone', 'Nothing found on a phone', R + '&q=', 'U2, open item needs E13',
      f'<div class="field" style="background: var(--card); box-shadow: var(--shadow-s)">{ic("search", "s")}<span class="grow">kebab</span><button class="close" aria-label="Clear the search" style="background: none">{ic("close", "s")}</button></div><div class="card vstack g12" style="padding: 24px; align-items: center; text-align: center"><span class="bubble" style="width: 72px; height: 72px">{ic("search", "l")}</span><p class="t-row">Nothing called “kebab”</p><p class="t-sup muted">Check the spelling, or add it as an open item with a name and a price.</p>{btn("Add an open item", "tonal", icon="plus")}</div>', pfoot(8, 'Send 4 items'))

# 3 a line that became sold out; grills group with one low and one out
GR = [item('Pork ribs', '35,000'), item('Pepper steak', '45,000', small='45,000 · 3 left'), item('Lamb chops', '', 'off', 'Sold out since 20:12'), item('Grilled tilapia', '38,000'), item('T-bone steak', '52,000'), item('Beef skewers', '18,000'), item('Grilled chicken', '25,000'), item('Pork chops', '30,000')]
LAMB = '<div class="line" style="background: var(--red-t)"><span class="q" style="background: var(--card); color: var(--red)">1</span><span class="grow"><span class="nm" style="color: var(--red)">Lamb chops</span><br><span class="sub" style="color: var(--red)">Sold out at 20:12, after you added it. It will not send and is not on the bill.</span></span><button class="btn sm textbtn danger" style="padding: 0 8px">Remove</button></div>'
NS23 = [('', '', [(1, 'Rolex', '', '9,000'), (1, 'Chips', '', '8,000'), (1, 'Water 500 ml', '', '2,000')])]
chk = check('<p class="cap" style="padding: 8px 16px 4px">Not sent</p>' + LAMB + lines(NS23), '19,000',
            MORE + btn('Ask the kitchen', 'tonal', 'flex: 1 1 0; padding: 0 12px') + btn('Send 3 items', 'filled', 'flex: 1.2 1 0; padding: 0 12px'), count='3 items')
main = f'{seg(["Food", "Drinks"], "Food").replace("<button class=", "<button style=\"min-width: 140px\" class=")}{optgrid(FOODG, 8, "Grills")}<div class="items" style="grid-template-columns: repeat(4, minmax(0, 1fr))">{"".join(GR)}</div>'
page('Order-Line-Sold-Out', *T, 'Order, a line became sold out', oscreen(main, chk, 'Table 23', '2 guests · open 6 min · Amina K.'), G, 'Waiter', 'A line not yet sent whose item sold out: red, Send skips it', R, 'U2, needs E2 and E10')
phone('Order-Line-Sold-Out-Phone', 'Order, line sold out, phone', 'A line that sold out, on a phone', R, 'U2, needs E2 and E10',
      f'<p class="cap">Not sent</p><div class="card" style="overflow: hidden">{LAMB}{lines(NS23)}</div><p class="t-sup muted">Send skips Lamb chops and sends the other 3. Or ask the kitchen; they may have one left.</p>',
      btn('Ask the kitchen', 'tonal', 'flex: 1 1 0') + btn('Send 3 items', 'filled', 'flex: 1.4 1 0'), head=rband('Table 23', '2 guests · UGX 19,000'))

# 4 hold and fire, the moment after Fire with 3 s to undo
HELD = '<p class="cap" style="padding: 8px 16px 4px">Going to the kitchen in 3 seconds</p>' + '<div class="line"><span class="q">1</span><span class="grow"><span class="nm">Grilled tilapia</span><br><span class="sub">Main · was held for later</span></span><span class="pr">38,000</span></div>'
S2 = lines([('Sent 19:58', 'sent', [(2, 'Beef samosas', 'Starter', '24,000'), (1, 'Spring rolls', 'Starter', '12,000'), (2, 'Lager 500 ml', '', '12,000')])])
chk = check(HELD + '<div class="hr" style="margin: 8px 16px"></div>' + S2, '86,000', MORE + btn('Print bill', 'tonal', 'flex: 1 1 0; padding: 0 12px'), count='6 items')
main = f'{seg(["Food", "Drinks"], "Food").replace("<button class=", "<button style=\"min-width: 140px\" class=")}{optgrid(FOODG, 8, "Popular")}<div class="items" style="grid-template-columns: repeat(4, minmax(0, 1fr))">{"".join(item(n, p) for n, p in POP[:16])}</div>'
tst = toast('Grilled tilapia goes to the kitchen in 3 seconds', 'Undo', 'left: 24px; right: 396px; bottom: 24px')
page('Order-Hold-Fire', *T, 'Order, fire with undo', oscreen(main, chk, 'Table 2', '4 guests · open 42 min · Amina K.', over=tst), G, 'Waiter', 'Hold and fire: a held main is fired, 3 seconds to undo', R, 'U2, needs E5')
heldp = '<div class="card" style="overflow: hidden"><div class="line"><span class="q">1</span><span class="grow"><span class="nm">Grilled tilapia</span><br><span class="sub">Main · was held for later</span></span><span class="pr">38,000</span></div></div>'
phone('Order-Hold-Fire-Phone', 'Order, hold and fire, phone', 'A held main with Fire, and the undo after firing', R, 'U2, needs E5',
      f'<p class="cap">Going to the kitchen in 3 seconds</p>{heldp}<div class="card" style="overflow: hidden">{S2}</div>',
      f'<a class="btn tonal" href="#" style="flex: 1 1 0">Order · 6</a>' + btn('Print bill', 'tonal', 'flex: 1 1 0'), head=rband('Table 2', '4 guests · UGX 86,000'),
      over=toast('Grilled tilapia goes to the kitchen in 3 s', 'Undo', 'left: 16px; right: 16px; bottom: 96px'))

# 5 a line's options: allergy, takeaway, note
ALL = ['Nuts', 'Gluten', 'Dairy', 'Eggs', 'Shellfish', 'Other']
def line_sheet(cols):
    top = 'vstack g12' if cols == 3 else 'hstack g16'
    return sheet('Beef burger', 'Not sent yet · UGX 28,000', f'''
    <div class="{top}"><div><p class="lab">How many</p><div class="step"><button class="round sm tonal" aria-label="One fewer">{ic("minus")}</button><b>1</b><button class="round sm tonal" aria-label="One more">{ic("plus")}</button></div></div><div class="grow" style="width: 100%"><p class="lab">How cooked</p>{seg(["Rare", "Medium", "Well done"], "Medium", True)}</div></div>
    <div><p class="lab">Allergy</p>{optgrid(ALL, cols, "Nuts")}</div>
    <div><p class="lab">Where it is eaten</p>{seg(["Here", "Takeaway"], "Takeaway", True)}</div>
    <div><label class="lab">Note for the kitchen</label><div class="field">No sauce on the bun</div></div>
    <div class="hstack g8"><span class="pill p-red">NUT ALLERGY</span><span class="pill p-neutral">TAKEAWAY</span><span class="t-sup muted grow">How the ticket shows it, in red at the top. The allergy stays on table 12 for later rounds.</span></div>''',
        sfoot(btn('Remove', 'textbtn danger'), '<span class="grow"></span>', btn('Save the line', 'filled', 'min-width: 220px'), end=False))
NEWB = ('Not sent', '', [(1, 'Beef burger', 'Medium · Nut allergy · Takeaway', '28,000')])
al_check = check(lines([NEWB, T12[0]]) + '<div class="hr" style="margin: 8px 16px"></div><button class="line sent" style="width: 100%"><span class="q">4</span><span class="grow"><span class="nm">Sent 19:42 · food</span></span><span class="pr">68,000</span></button>', '126,000', MORE + btn('Print bill', 'tonal', 'flex: 1 1 0; padding: 0 12px') + btn('Send 1 item', 'filled', 'flex: 1.4 1 0; padding: 0 12px'), count='9 items')
bg = oscreen(main.replace('"Popular"', '"Burgers"'), al_check).replace('<div class="ord"', '<div class="ord" inert')
page('Order-Line-Allergy', *T, 'Order, a line with allergy and takeaway', bg + scrim() + line_sheet(6).replace('class="sheet "', 'class="sheet wide"'), G, 'Waiter', 'A line’s options: allergy, takeaway, note', R, 'U2, needs E5')
pbg = rband('Table 12', '3 guests · open 1 h 05').replace('<header class="band"', '<header inert class="band"') + f'<main class="body" inert><div class="card" style="overflow: hidden">{lines([NEWB])}</div></main>'
page('Order-Line-Allergy-Phone', *P, 'Order, line options, phone', pbg + scrim() + line_sheet(3).replace('<div><p class="lab">Where it is eaten</p>', '<div><p class="lab" style="display: none"></p>').replace('<span class="t-sup muted grow">How the ticket shows it, in red at the top. The allergy stays on table 12 for later rounds.</span>', '<span class="t-sup muted grow">On the ticket, in red</span>'), G, 'Waiter', 'A line’s options on a phone', R, 'U2, needs E5')

# 6 same again
AGAIN = ('Not sent · same again', '', [(2, 'Lager 500 ml', '', '12,000'), (1, 'Blended Scotch', 'Double · Cola', '15,000'), (1, 'Cola 300 ml', '', '3,000')])
sa_btn = f'<div style="padding: 4px 16px 0">{btn("Same again · 4 drinks · UGX 30,000", "tonal", "width: 100%", icon="redo")}</div>'
older = '<div class="hr" style="margin: 8px 16px"></div><button class="line sent"><span class="q">4</span><span class="grow"><span class="nm">Sent 19:42 · food</span><br><span class="sub">Beef burger, Chips, Chicken wings</span></span><span class="pr">68,000</span></button>'
chk = check(lines([AGAIN]) + '<div class="hr" style="margin: 8px 16px"></div>' + lines([T12[0]]) + older, '128,000', MORE + btn('Print bill', 'tonal', 'flex: 1 1 0; padding: 0 12px') + btn('Send 4 items', 'filled', 'flex: 1.4 1 0; padding: 0 12px'), count='12 items')
DR = [f'<div class="mrow"><b class="grow">{n}</b>' + ''.join(f'<button class="mbtn">{m}<small>{p}</small></button>' for m, p in ms) + '</div>' for n, ms in [
    ('Lager', [('500 ml', '6,000'), ('Jug', '22,000')]), ('Stout', [('500 ml', '7,000')]), ('Local lager', [('500 ml', '5,000')]), ('Draught', [('Pint', '8,000'), ('Jug', '22,000')]),
    ('Imported lager', [('330 ml', '9,000')]), ('Cider', [('330 ml', '8,000')]), ('Cola', [('300 ml', '3,000')]), ('Soda water', [('300 ml', '3,000')]), ('Tonic', [('300 ml', '3,500')]), ('Water', [('500 ml', '2,000'), ('1.5 l', '4,000')])]]
main = f'{seg(["Food", "Drinks"], "Drinks").replace("<button class=", "<button style=\"min-width: 140px\" class=")}{optgrid(DRINKG, 8, "Popular")}<div class="items" style="grid-template-columns: repeat(2, minmax(0, 1fr))">{"".join(DR)}</div>'
tst = toast('Added the last round again: 4 drinks', 'Undo', 'left: 24px; right: 396px; bottom: 24px')
page('Order-Same-Again', *T, 'Order, same again', oscreen(main, chk, over=tst), G, 'Waiter', 'Same again: one tap re-adds the last sent drinks', R, 'U2')
phone('Order-Same-Again-Phone', 'Order, same again, phone', 'Same again on a phone', R, 'U2',
      f'<p class="cap">Not sent · same again</p><div class="card" style="overflow: hidden">{lines([("", "", AGAIN[2])])}</div><p class="cap">Sent</p><div class="card" style="overflow: hidden">{lines([("", "sent", [(4, "Drinks, 20:15", "Lager, Blended Scotch, Cola", "30,000"), (4, "Food, 19:42", "Beef burger, Chips, Chicken wings", "68,000")])])}</div>',
      pfoot(12, 'Send 4 items'), sub='3 guests · UGX 128,000', over=toast('Added the last round again', 'Undo', 'left: 16px; right: 16px; bottom: 96px'))

# 7 a group with a sub-group filter row
SUB = ['All · 14', 'Bottles · 8', 'Draught · 3', 'Local · 5', 'Imported · 4']
subrow = '<div class="hstack g8">' + ''.join(f'<button class="chip{" on" if s.startswith("Draught") else ""}">{s}</button>' for s in SUB) + '</div>'
DRA = [f'<div class="mrow"><b class="grow">{n}</b>' + ''.join(f'<button class="mbtn">{m}<small>{p}</small></button>' for m, p in ms) + '</div>' for n, ms in [
    ('Draught lager', [('Half', '5,000'), ('Pint', '8,000'), ('Jug', '22,000')]), ('Draught stout', [('Half', '6,000'), ('Pint', '9,000'), ('Jug', '25,000')]), ('Draught cider', [('Half', '5,500'), ('Pint', '9,000'), ('Jug', '24,000')])]]
main = f'{seg(["Food", "Drinks"], "Drinks").replace("<button class=", "<button style=\"min-width: 140px\" class=")}{optgrid(DRINKG, 8, "Beer")}{subrow}<div class="items" style="grid-template-columns: repeat(2, minmax(0, 1fr))">{"".join(DRA)}</div>'
page('Order-Subgroup', *T, 'Order, group with a sub-group filter', oscreen(main, std_check), G, 'Waiter', 'A group with a sub-group filter row', R, 'U2, needs E2')
psub = '<div class="hstack g8">' + ''.join(f'<button class="chip{" on" if s == "Draught" else ""}">{s}</button>' for s in ['All', 'Bottles', 'Draught']) + '<button class="chip">More · 2</button></div>'
phone('Order-Subgroup-Phone', 'Order, sub-group filter, phone', 'Sub-group filter on a phone: three chips and More', R, 'U2, needs E2',
      f'{seg(["Food", "Drinks"], "Drinks", True)}{optgrid(["Popular", "Offers", "Beer", "Soft", "Wine", "Whisky", "Gin", "More · 9"], 4, "Beer")}{psub}<div class="items p" style="grid-template-columns: minmax(0, 1fr)">{"".join(DRA)}</div>', pfoot(8, 'Send 4 items'))

# 8 offers
OF = [('Burger and a beer', 'Beef burger, chips and a lager 500 ml · every day', '32,000', 'Was 42,000', True), ('Wings and a jug', 'Chicken wings and a jug of draught lager', '40,000', 'Was 46,000', True),
      ('Family platter', '4 people · wings, samosas, chips, spring rolls', '85,000', 'Was 96,000', True), ('Happy hour lager', 'Lager 500 ml · Mon to Fri, 17:00 to 19:00', '4,500', 'Back at 17:00 tomorrow', False),
      ('Two cocktails', 'Any two cocktails from the list · Fri and Sat', '30,000', 'Fri and Sat only', False)]
def offrow(n, d, p, note, live):
    if live: return f'<div class="mrow"><span class="grow"><b>{n}</b><br><span class="t-sup muted">{d} · {note}</span></span><button class="mbtn">Add<small>{p}</small></button></div>'
    return f'<div class="mrow" style="background: var(--neutral-t); box-shadow: none; color: var(--muted)"><span class="grow"><b>{n}</b><br><span class="t-sup">{d}</span></span>{pill(note)}</div>'
main = f'{seg(["Food", "Drinks"], "Food").replace("<button class=", "<button style=\"min-width: 140px\" class=")}{optgrid(FOODG, 8, "Offers")}<div class="items" style="grid-template-columns: minmax(0, 1fr)">{"".join(offrow(*o) for o in OF)}</div>'
page('Order-Offers', *T, 'Order, offers', oscreen(main, std_check), G, 'Waiter', 'Offers: what applies now, and when the rest come back', R, 'U2, happy hour needs E13')
phone('Order-Offers-Phone', 'Order, offers, phone', 'Offers on a phone', R, 'U2, happy hour needs E13',
      f'{seg(["Food", "Drinks"], "Food", True)}{optgrid(["Popular", "Offers", "Starters", "Mains", "Grills", "Burgers", "Local", "More · 9"], 4, "Offers")}<div class="items p" style="grid-template-columns: minmax(0, 1fr)">{"".join(offrow(n, d.split(" · ")[0], p, nt, l) for n, d, p, nt, l in OF[:4])}</div>', pfoot(8, 'Send 4 items'))
