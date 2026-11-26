from base import *
G = 7
T, P, L = (1280, 800), (390, 844), (1440, 900)
def sscreen(title, sub, main, aside='', on='Stock', role='store', inert=False):
    h = tbar(title, sub, role); nav = navbar(role, on); a = ' inert' if inert else ''
    if inert: h = h.replace('<header class="bar tall">', '<header class="bar tall" inert>'); nav = nav.replace('<nav class="navbar"', '<nav inert class="navbar"')
    return h + f'''
  <main class="page" style="padding: 16px 24px; flex-direction: row; gap: 20px"{a}>
    <section class="grow vstack g16">{main}</section>
    {aside}
  </main>
{nav}'''
def table(heads, rows, sel=None, cls='dt'):
    th = ''.join(f'<th{" class=\"num\"" if h.startswith("#") else ""}>{h.lstrip("#")}</th>' for h in heads)
    tr = ''.join(f'<tr{" class=\"sel\"" if r[0] == sel else ""}>' + ''.join(f'<td{" class=\"num\"" if heads[i].startswith("#") else ""}>{c}</td>' for i, c in enumerate(r)) + '</tr>' for r in rows)
    return f'<div class="card" style="overflow: hidden"><table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'
def aside(c, w=400): return f'<aside class="card vstack g12" style="width: {w}px; padding: 20px; flex: none">{c}</aside>'
def phead(title, sub, btns=''): return band(title, sub, btns)
SR = '/store'

# 1 Stock with minimum and fill-to
ST = [('Burger buns', '36 pieces', '48', '120', pill('Below minimum', 'p-amber')), ('Beef mince', '8.4 kg', '5 kg', '20 kg', pill('OK', 'p-green')), ('Cheese slices', '140 pieces', '50', '200', pill('OK', 'p-green')),
      ('Tomatoes', '4 kg', '6 kg', '20 kg', pill('Below minimum', 'p-amber')), ('Chips, frozen', '22 kg', '10 kg', '40 kg', pill('OK', 'p-green')), ('Chicken wings', '9 kg', '8 kg', '30 kg', pill('OK', 'p-green')),
      ('Lager 500 ml', '−3 bottles', '48', '240', pill('Below zero · count it', 'p-red')), ('Tonic 300 ml', '18 bottles', '24', '96', pill('Below minimum', 'p-amber')), ('Cooking oil', '14 l', '10 l', '40 l', pill('OK', 'p-green'))]
sa = aside(f'''<div class="hstack"><div class="grow"><h2 class="t-h">Burger buns</h2><p class="t-sup muted">Main store · counted in pieces · pack of 12</p></div>{pill("Below minimum", "p-amber")}</div>
      <div class="card" style="box-shadow: none; background: var(--canvas); padding: 4px 16px">{kv("On hand", "36 pieces")}{kv("On its way to the kitchen", "12 pieces")}{kv("Average cost", "UGX 800 a piece")}</div>
      <div class="hstack g12"><div class="grow"><label class="lab">Minimum</label><div class="field">48</div></div><div class="grow"><label class="lab">Fill to</label><div class="field">120</div></div></div>
      <p class="t-sup muted">Below 48, buns join To buy with 84 suggested (7 packs) to reach 120. One alert per crossing, not one per sale.</p>
      <span class="grow"></span>
      <div class="hstack g8">{btn("All movements", "tonal")}<span class="grow"></span>{btn("Save levels", "filled", "min-width: 160px")}</div>''')
sm = f'<div class="hstack">{seg(["Main store · 64", "Kitchen store · 38", "Bar store · 41"], "Main store · 64")}<span class="grow"></span><span class="field ph" style="width: 260px">{ic("search", "s")}Find an item</span></div>' + table(['Item', '#On hand', '#Minimum', '#Fill to', 'Now'], ST, 'Burger buns', 'dt c')
page('Store-Stock', *T, 'Stock, store keeper', sscreen('Stock', 'Main store · 4 below minimum · 1 below zero · as at 16:20', sm, sa),
     G, 'Store keeper', 'Stock: each store’s items with minimum and fill-to; one item’s levels', SR + '/stock (new)', 'U6, needs E7')
pst = '<div class="card" style="overflow: hidden">' + ''.join(row(n, f'{o} · min {m} · fill to {f}', p, btn=True) for n, o, m, f, p in ST[:7]) + '</div>'
page('Store-Stock-Phone', *P, 'Stock, phone', phead('Stock', 'Main store · as at 16:20', rbtn('search', 'Find an item')) + f'<main class="body">{seg(["Main", "Kitchen", "Bar"], "Main", True)}{pst}</main>' + navbar('store', 'Stock', True),
     G, 'Store keeper', 'Stock on a phone', SR + '/stock (new)', 'U6, needs E7')

# 2 receive a delivery: full, short, dearer
RL = [('Beef mince', '10 kg', '10 kg', '18,000', '18,000', pill('Full', 'p-green')), ('Burger buns', '96 pieces', '72 pieces', '800', '800', pill('24 short', 'p-amber')),
      ('Tomatoes', '20 kg', '20 kg', '4,000', '4,600', pill('Dearer by 600', 'p-red')), ('Lettuce', '5 kg', '5 kg', '5,000', '5,000', pill('Full', 'p-green')), ('Cheese slices', '200 pieces', '200 pieces', '600', '600', pill('Full', 'p-green'))]
rt = table(['Item', '#Ordered', '#Received', '#Price ordered', '#Price on the invoice', ''], RL, 'Tomatoes', 'dt c')
ra = aside(f'''<h2 class="t-h">Delivery check</h2><p class="t-sup muted">Order 0047 to Green Valley Farms · expected today</p>
      <div class="card" style="box-shadow: none; background: var(--canvas); padding: 4px 16px">{kv("Lines", "5 · 3 full, 1 short, 1 dearer")}{kv("Invoice", "UGX 492,600")}{kv("Ordered for", "UGX 499,200")}</div>
      <div><label class="lab">Invoice number</label><div class="field">GV-2281</div></div>
      <p class="t-sup muted">The 24 short buns stay open on order 0047. The tomato price goes to the accountant’s “Cost changed” list; every dish with tomato updates its cost.</p>
      <span class="grow"></span>{btn("Receive into Main store", "filled")}''', 380)
rm = f'<div class="hstack"><div><p class="t-row">Green Valley Farms</p><p class="t-sup muted">Order 0047 · tap a line to change what came</p></div><span class="grow"></span>{btn("Receive with no order", "tonal")}</div>' + rt
page('Store-Receive', *T, 'Receive a delivery', sscreen('Receive', 'Main store · 2 deliveries expected today · as at 10:40', rm, ra, on='Receive'),
     G, 'Store keeper', 'Receive a delivery line by line: full, short, dearer', SR + '/receive (new)', 'U6, needs E7')
prl = '<div class="card" style="overflow: hidden">' + ''.join(row(n, f'Ordered {o} · came {r}' + (f' · {pr} a kg' if n == 'Tomatoes' else ''), p, btn=True) for n, o, r, po, pr, p in RL) + '</div>'
page('Store-Receive-Phone', *P, 'Receive a delivery, phone', rband('Green Valley Farms', 'Order 0047 · 5 lines', more=False) + f'<main class="body">{prl}<div class="card" style="padding: 4px 16px">{kv("Invoice", "UGX 492,600")}{kv("Invoice number", "GV-2281")}</div></main><footer class="foot">{btn("Receive into Main store", "filled", "flex: 1 1 0")}</footer>',
     G, 'Store keeper', 'Receive a delivery on a phone', SR + '/receive (new)', 'U6, needs E7')

# 3 blind count
CL = [('Lager 500 ml', 'bottles', '228', pill('Counted', 'p-green')), ('Stout 500 ml', 'bottles', '96', pill('Counted', 'p-green')), ('Tonic 300 ml', 'bottles', '', pill('Now', 'p-brand')), ('Cola 300 ml', 'bottles', '', ''), ('Soda water 300 ml', 'bottles', '', ''), ('Gin, 750 ml', 'bottles', '', ''), ('Blended Scotch, 750 ml', 'bottles', '', '')]
ct = '<div class="card" style="overflow: hidden">' + ''.join(f'<div class="row s"{" style=\"background: var(--canvas)\"" if p and "Now" in p else ""}><span class="grow"><span class="t-body b">{n}</span><br><span class="t-sup muted">in {u}</span></span><span class="t-row" style="min-width: 60px; text-align: right">{c}</span>{p}</div>' for n, u, c, p in CL) + '</div>'
ca = aside(f'''<p class="cap">Tonic 300 ml · in bottles</p><div class="field" style="height: 72px; justify-content: flex-end; font-size: 26px; line-height: 32px; font-weight: 700">17</div>{keypad(h=64)}{btn("Save 17 and next", "filled")}''', 360)
cm = f'<div class="hstack"><div><p class="t-row">Bar store · spot count · 2 of 10 done</p><p class="t-sup muted">You do not see what the books say. Selling carries on; each line is compared at the minute you save it.</p></div></div>' + ct
page('Store-Count', *T, 'Count, blind', sscreen('Count', 'Bar store · spot count started 16:05', cm, ca, on='Count'),
     G, 'Store keeper', 'Count, blind: type what is on the shelf; expected numbers stay hidden', SR + '/count (new)', 'U6, needs E7')
page('Store-Count-Phone', *P, 'Count, phone', rband('Spot count', 'Bar store · 2 of 10 done', more=False) + f'<main class="body" style="gap: 12px"><div class="card" style="padding: 14px 16px"><p class="t-sup muted">Item 3 of 10</p><p class="t-h">Tonic 300 ml</p><p class="t-sup muted">Count the bottles on the shelf. The books stay hidden.</p></div><div class="field" style="height: 64px; justify-content: flex-end; font-size: 26px; line-height: 32px; font-weight: 700">17</div>{keypad(h=60)}</main><footer class="foot">{btn("Back", "tonal", "flex: 1 1 0")}{btn("Save 17 and next", "filled", "flex: 2 1 0")}</footer>',
     G, 'Store keeper', 'Blind count on a phone, one item at a time', SR + '/count (new)', 'U6, needs E7')

# 4 take out of stock (terminal)
REAS = ['Spoiled or expired', 'Burnt, dropped, broken', 'Staff meal', 'Missing', 'Returned to supplier', 'We found more']
to = f'''<div class="hstack g16"><div class="grow"><label class="lab">Item</label><div class="field">Tomatoes · Main store · 4 kg on hand</div></div><div style="width: 200px"><label class="lab">How much</label><div class="field" style="justify-content: flex-end; font-weight: 700">3 kg</div></div></div>
    <div><p class="lab">Why</p>{optgrid(REAS, 3, "Spoiled or expired")}</div>
    <div class="card" style="box-shadow: none; background: var(--canvas); padding: 4px 16px">{kv("Worth, at average cost", "UGX 13,800")}{kv("Left after this", "1 kg · below the 6 kg minimum")}</div>
    <p class="t-sup muted">Your name, the time and the reason are kept. Above UGX 50,000 a supervisor’s PIN is asked. “Missing” tells the manager at once and asks for a count.</p>'''
sb = sscreen('Stock', 'Main store · 4 below minimum · as at 16:20', sm, '', inert=True)
page('Take-Out-Terminal', *T, 'Take out of stock', sb + scrim() + sheet('Take out of stock', 'Main store · Joel T.', to, sfoot(btn('Cancel', 'textbtn'), btn('Take 3 kg of tomatoes out', 'filled', 'min-width: 300px')), 'mid'),
     G, 'Store keeper', 'Take out of stock on a terminal: item, amount, a fixed reason', SR + '/stock#take-out', 'U6, needs E6')
page('Take-Out-Terminal-Phone', *P, 'Take out of stock, phone', phead('Stock', 'Main store').replace('<header class="band">', '<header inert class="band">') + '<main class="body" inert></main>' + navbar('store', 'Stock', True).replace('<nav class="tabbar"', '<nav inert class="tabbar"') + scrim() + sheet('Take out of stock', 'Tomatoes · 4 kg on hand', f'<div><label class="lab">How much</label><div class="field" style="justify-content: flex-end; font-weight: 700">3 kg</div></div>{optgrid(REAS, 2, "Spoiled or expired")}{kv("Worth", "UGX 13,800")}', btn('Take 3 kg out', 'filled'), gap=12),
     G, 'Store keeper', 'Take out of stock on a phone', SR + '/stock#take-out', 'U6, needs E6')

# 5 a request received short (chef, kitchen terminal)
RQ = [('Burger buns', '48 pieces', '36 pieces', pill('12 short', 'p-amber')), ('Beef mince', '4 kg', '4 kg', pill('All here', 'p-green')), ('Chips, frozen', '10 kg', '10 kg', pill('All here', 'p-green')), ('Tomatoes', '3 kg', '3 kg', pill('All here', 'p-green'))]
rqt = table(['Item', '#Sent by the store', '#Arrived', ''], RQ, 'Burger buns', 'dt c')
rqa = aside(f'<p class="t-row" style="text-align: center">Your PIN to receive</p>{pin(2)}{keypad(h=64)}<p class="t-sup muted" style="text-align: center">The 12 buns short stay against this trip. Joel T. and the manager are told.</p>', 340)
rqm = f'<div><p class="t-row">Request 0112 · issued by Joel T. at 16:10</p><p class="t-sup muted">Main store to Kitchen store · tap a line if less arrived</p></div>{rqt}'
page('Request-Received-Short', *T, 'Receive a request, short', sscreen('Store', 'Kitchen store · 1 request on its way · as at 16:24', rqm, rqa, on='Store', role='chef'),
     G, 'Chef', 'A request received short, with the receiver’s PIN; the gap is kept against the trip', '/kitchen/store#receive', 'U6, needs E7')
prq = '<div class="card" style="overflow: hidden">' + ''.join(row(n, f'Sent {s} · arrived {a}', p, btn=False) for n, s, a, p in RQ) + '</div>'
page('Request-Received-Short-Phone', *P, 'Receive a request, phone', rband('Request 0112', 'From Main store · issued 16:10', more=False) + f'<main class="body">{prq}<p class="t-sup muted">The 12 buns short stay against this trip. Joel T. and the manager are told.</p></main><footer class="foot">{btn("Receive with my PIN", "filled", "flex: 1 1 0")}</footer>',
     G, 'Chef', 'A request received short on a phone', '/kitchen/store#receive', 'U6, needs E7')

# 6 To buy
TB = [('Burger buns', 'Green Valley Farms', '36', '48', '120', '84 · 7 packs'), ('Tomatoes', 'Green Valley Farms', '1 kg', '6 kg', '20 kg', '19 kg'), ('Tonic 300 ml', 'City Drinks Depot', '18', '24', '96', '78 · 4 crates'),
      ('Lager 500 ml', 'City Drinks Depot', '−3', '48', '240', '243 · 11 crates'), ('Lettuce', 'Green Valley Farms', '1.5 kg', '2 kg', '6 kg', '4.5 kg')]
tbt = table(['Item', 'Supplier', '#On hand', '#Minimum', '#Fill to', '#Suggested'], TB, None, 'dt c')
tba = aside(f'''<h2 class="t-h">Order to Green Valley Farms</h2><p class="t-sup muted">3 lines picked from To buy</p>
      <div class="card" style="box-shadow: none; background: var(--canvas); padding: 4px 16px">{kv("Burger buns", "84 · UGX 67,200")}{kv("Tomatoes", "19 kg · UGX 87,400")}{kv("Lettuce", "4.5 kg · UGX 22,500")}</div>
      {kv("Expected total, at last price", "UGX 177,100")}
      <p class="t-sup muted">Prices are the last ones paid. The delivery is checked against this order when it comes.</p>
      <span class="grow"></span>{btn("Make the order · 3 lines", "filled")}''', 380)
tbm = f'<div class="hstack">{seg(["All · 5", "Green Valley Farms · 3", "City Drinks Depot · 2"], "Green Valley Farms · 3")}</div>{tbt}<p class="t-sup muted">An item joins this list when its feeding store falls below the minimum, and leaves it when the delivery is received.</p>'
page('To-Buy', *T, 'To buy', sscreen('To buy', 'Main store · 5 items below minimum · as at 16:30', tbm, tba, on='Stock'),
     G, 'Store keeper', 'To buy: everything below minimum, suggested to fill-to, turned into an order', SR + '/to-buy (new)', 'U7, needs E7')
ptb = '<div class="card" style="overflow: hidden">' + ''.join(row(n, f'{s} · {oh} on hand · buy {sg}', '', btn=True) for n, s, oh, m, f, sg in TB) + '</div>'
page('To-Buy-Phone', *P, 'To buy, phone', phead('To buy', '5 items below minimum · 16:30') + f'<main class="body">{ptb}</main><footer class="foot">{btn("Make an order", "filled", "flex: 1 1 0")}</footer>',
     G, 'Store keeper', 'To buy on a phone', SR + '/to-buy (new)', 'U7, needs E7')

# 7 stores set-up (manager, laptop)
chain = f'''<div class="card" style="padding: 20px"><p class="cap" style="padding-bottom: 12px">How stock flows at Tapas Downtown</p>
      <div class="hstack g16" style="align-items: stretch">
        <div class="card vstack g4" style="padding: 16px; flex: 1 1 0; background: var(--tonal); box-shadow: none"><p class="t-row">Main store</p><p class="t-sup muted">Deliveries come in here · 64 items</p></div>
        <span style="display: flex; align-items: center; color: var(--muted)">{ic("move")}</span>
        <div class="vstack g12" style="flex: 1 1 0"><div class="card vstack g4" style="padding: 16px"><p class="t-row">Kitchen store</p><p class="t-sup muted">Feeds Hot kitchen and Cold kitchen · 38 items</p></div><div class="card vstack g4" style="padding: 16px"><p class="t-row">Bar store</p><p class="t-sup muted">Feeds Bar · 41 items</p></div></div>
      </div></div>'''
set_side = f'''<div class="card vstack g12" style="padding: 20px"><p class="cap">Kitchen store</p>
      <div><label class="lab">Name</label><div class="field sm">Kitchen store</div></div>
      <div><p class="lab">Kind</p>{seg(["Main", "Secondary", "Point"], "Point", True)}</div>
      <div><label class="lab">Fed by</label><div class="field sm">Main store</div></div>
      <div><p class="lab">Stations that take from it</p>{picks(["Hot kitchen", "Cold kitchen", "Desserts"], 3, ("Hot kitchen", "Cold kitchen"))}</div></div>
      <div class="card vstack g12" style="padding: 20px"><p class="cap">When stock says zero</p>{seg(["Off", "Warn", "Block"], "Warn", True)}<p class="t-sup muted">Warn: the item shows “check stock” and still sells. The chef can always mark sold out by hand.</p></div>'''
body = lbar('manager', 'Stock') + cp('Stock › Settings ›', 'Stores', btn('Add a store', 'tonal sm', icon='plus') + btn('Save', 'sm filled', 'min-width: 120px')) + f'''
  <main class="page" style="flex-direction: row; gap: 20px"><section class="grow vstack g16">{chain}<div class="card" style="padding: 16px 20px"><p class="t-sup">One store is a valid set-up, and so is no stock at all. Adding a secondary store between Main and the point stores is a settings change, never a rebuild. Moving stores never changes the books: every move is a row in one ledger.</p></div></section>
  <aside class="vstack g16" style="width: 420px; flex: none">{set_side}</aside></main>'''
page('Stores-Setup', *L, 'Stores set-up', body, G, 'Manager', 'Stores set-up: main, point stores, which stations take from which', '/manager/stock/stores (new)', 'U7, needs E7')
pss = f'<div class="card" style="overflow: hidden">{row("Main store", "Main · deliveries come in here", CHEV)}{row("Kitchen store", "Point · fed by Main · Hot and Cold kitchen", CHEV)}{row("Bar store", "Point · fed by Main · Bar", CHEV)}</div><div class="card vstack g8" style="padding: 16px"><p class="cap">When stock says zero</p>{seg(["Off", "Warn", "Block"], "Warn", True)}<p class="t-sup muted">Warn: “check stock”, still sells.</p></div>{btn("Add a store", "tonal", icon="plus")}'
page('Stores-Setup-Phone', *P, 'Stores set-up, phone', rband('Stores', 'Tapas Downtown · 3 stores', more=False) + f'<main class="body">{pss}</main>' + navbar('manager', 'More', True),
     G, 'Manager', 'Stores set-up on a phone', '/manager/stock/stores (new)', 'U7, needs E7')
