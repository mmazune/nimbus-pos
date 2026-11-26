from base import *
G = 10
L, P = (1440, 900), (390, 844)
def table(heads, rows, sel=None, cls='dt'):
    th = ''.join(f'<th{" class=\"num\"" if h.startswith("#") else ""}>{h.lstrip("#")}</th>' for h in heads)
    tr = ''.join(f'<tr{" class=\"sel\"" if r[0] == sel else ""}>' + ''.join(f'<td{" class=\"num\"" if heads[i].startswith("#") else ""}>{c}</td>' for i, c in enumerate(r)) + '</tr>' for r in rows)
    return f'<div class="card" style="overflow: hidden"><table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'
def tiles(items): return f'<div class="card"><div class="tilerow" style="grid-template-columns: repeat({len(items)}, minmax(0, 1fr))">' + ''.join(f'<div class="stat"><span class="t-sup muted">{l}</span><b>{v}</b><span class="t-small muted">{s}</span></div>' for l, v, s in items) + '</div></div>'
def card(c, pad='16px 20px'): return f'<div class="card" style="padding: {pad}">{c}</div>'
def kvcard(cap, items): return card(f'<p class="cap" style="padding-bottom: 6px">{cap}</p>' + ''.join(kv(a, b) for a, b in items))
def lp(name, role, on, crumb, h1, right, main, title, shows, route, ms, pill_='', place='Tapas Downtown'):
    page(name, *L, title, lbar(role, on, place) + cp(crumb, h1, right, pill_) + f'\n  <main class="page" style="flex-direction: row; gap: 20px">{main}</main>', G, role.capitalize(), shows, route, ms)
def pp(name, role, on, head, main, title, shows, route, ms):
    page(name, *P, title, head + f'<main class="body">{main}</main>' + navbar(role, on, True), G, role.capitalize(), shows, route, ms)
def needs(items): return '<div class="card" style="overflow: hidden"><p class="cap" style="padding: 14px 20px 4px">Needs you</p>' + ''.join(row(t, s, CHEV, ic(i), style='padding: 10px 20px') for i, t, s in items) + '</div>'
NO = [('till', 'Lakeside: till over by UGX 5,000', 'Closed 16:00 by the day cashier'), ('void', 'Airport road: 6 voids today', 'A usual day has 2'), ('clock', 'Downtown: 4 approvals waiting', 'The oldest has waited 9 min')]
BR = [('Tapas Downtown', '4,860,000', '96', '17', '4', pill('Open', 'p-green')), ('Tapas Lakeside', '3,220,000', '68', '11', '1', pill('Till over 5,000', 'p-amber')), ('Tapas Airport road', '2,470,000', '50', '8', '6', pill('6 voids', 'p-amber'))]
BRP = BR + [('All 3', '10,550,000', '214', '36', '11', '')]

# 1 all branches
main = f'''<section class="grow vstack g16">{tiles([("Sales today, UGX", "10,550,000", "214 bills"), ("Tables open now", "36", "3 branches"), ("Voids", "11", "UGX 168,000"), ("Yesterday, same time", "9,870,000", "+7%")])}
    {table(["Branch", "#Sales today, UGX", "#Bills", "#Open tables", "#Voids", "Now"], BR + [("All 3", "10,550,000", "214", "36", "11", "")])}
    <p class="t-sup muted">Each branch’s day report arrives here the moment its manager closes the day.</p></section>
    <aside class="vstack g16" style="width: 440px; flex: none">{needs(NO)}{kvcard("Closed yesterday", [("Downtown", "UGX 7,610,000 · 01:12"), ("Lakeside", "UGX 4,980,000 · 23:40"), ("Airport road", "UGX 3,105,000 · 00:05")])}</aside>'''
lp('Owner-Branches', 'owner', 'Branches', 'All branches ›', 'Today · Thu 26 Nov', btn('Download', 'sm tonal', icon='down'), main, 'All branches, owner laptop', 'All branches today: sales, open tables, voids, what needs the owner', '/owner/branches (new)', 'U7', '<span class="t-sup muted">as at 19:42</span>', 'All branches')
pp('Owner-Branches-Phone', 'owner', 'Branches', band('Branches', '3 branches · as at 19:42'), '<div class="card" style="overflow: hidden">' + ''.join(row(b, f'{n} bills · {o} open', f'{p_}<span class="t-body b">{s}</span>' + (CHEV if p_ else '')) for b, s, n, o, v, p_ in BRP) + '</div>' + kvcard('Closed yesterday', [('Downtown', '7,610,000'), ('Lakeside', '4,980,000'), ('Airport road', '3,105,000')]),
   'All branches, owner phone', 'All branches on a phone (Today on a phone is the approved Owner-Phone-Today)', '/owner/branches (new)', 'U7')

# 2 one branch
WK = [('Mon 23', '5,410,000'), ('Tue 24', '5,880,000'), ('Wed 25', '7,610,000'), ('Thu 26, so far', '4,860,000')]
wk = card('<p class="cap" style="padding-bottom: 8px">This week, UGX</p>' + ''.join(f'<div class="hstack" style="min-height: 36px"><span class="t-sup muted" style="width: 120px">{d}</span><div class="bar-s grow" style="margin: 0; height: 10px"><i style="width: {round(int(v.replace(",", "")) / 80000)}%"></i></div><span class="t-sup" style="width: 90px; text-align: right">{v}</span></div>' for d, v in WK))
main = f'''<section class="grow vstack g16">{tiles([("Sales today, UGX", "4,860,000", "96 bills"), ("Open now", "17 tables", "UGX 1,342,500"), ("Voids", "4", "UGX 48,000"), ("Discounts, UGX", "62,000", "6 bills")])}{wk}
    {kvcard("Staff on today", [("Manager", "Peter K."), ("Supervisor", "Grace N."), ("Waiters", "4 · 17 tables"), ("Kitchen and bar", "Ruth A., Isaac B. off")])}</section>
    <aside class="vstack g16" style="width: 440px; flex: none">{needs([NO[2], ("box", "Burger buns are short", "36 in Main store, the kitchen asked for 48"), ("void", "Lamb chops sold out since 19:40", "Marked by Ruth A.")])}{kvcard("How it was paid, UGX", [("Cash", "2,140,000"), ("Mobile money", "1,910,000"), ("Card", "810,000")])}</aside>'''
lp('Owner-Branch', 'owner', 'Branches', 'Branches ›', 'Tapas Downtown', btn('Day report so far', 'sm tonal'), main, 'One branch, owner laptop', 'One branch: today, this week, who is on, what needs the owner', '/owner/branches/[id] (new)', 'U7', '<span class="t-sup muted">as at 19:42 · read only</span>', 'All branches')
pp('Owner-Branch-Phone', 'owner', 'Branches', rband('Tapas Downtown', 'Today · as at 19:42', more=False), tiles([('Sales, UGX', '4,860,000', '96 bills'), ('Open now', '17', 'tables')]) + '<div class="card" style="overflow: hidden">' + ''.join(row(t, s, CHEV, ic(i)) for i, t, s in [NO[2], ('void', 'Lamb chops sold out since 19:40', 'Marked by Ruth A.')]) + '</div>' + kvcard('This week, UGX', WK),
   'One branch, owner phone', 'One branch on a phone', '/owner/branches/[id] (new)', 'U7')

# 3 purchases (accountant)
PU = [('26 Nov', 'Green Valley Farms', 'Main store', 'GV-2281', '5', '474,600', pill('2 price changes', 'p-amber')), ('26 Nov ', 'City Drinks Depot', 'Main store', 'CD-9917', '7', '1,846,000', pill('As ordered', 'p-green')),
      ('25 Nov', 'Lakeview Butchery', 'Main store', 'LB-0412', '3', '612,000', pill('1 short', 'p-amber')), ('24 Nov', 'Green Valley Farms', 'Main store', 'GV-2264', '6', '388,500', pill('As ordered', 'p-green')),
      ('24 Nov', 'Sunrise Bakery', 'Main store', 'SB-1180', '2', '96,000', pill('No order', 'p-neutral')), ('23 Nov', 'City Drinks Depot', 'Main store', 'CD-9875', '5', '1,402,000', pill('As ordered', 'p-green'))]
pa = f'''<div class="card vstack g12" style="padding: 20px"><div class="hstack"><div class="grow"><h2 class="t-h">GV-2281</h2><p class="t-sup muted">Green Valley Farms · received 26 Nov 10:52 by Joel T.</p></div>{pill("2 price changes", "p-amber")}</div>
      <div class="card" style="box-shadow: none; background: var(--canvas); padding: 4px 16px">{kv("Ordered for", "UGX 481,800")}{kv("Invoice", "UGX 474,600")}{kv("Short", "24 burger buns · UGX 19,200")}</div>
      <p class="cap">Price changes</p>{kv("Tomatoes", "4,000 to 4,600 a kg")}{kv("Cooking oil", "8,500 to 9,000 a litre")}
      <p class="t-sup muted">Both are on your “Cost changed” list. Every dish using them shows its new cost and margin.</p>{btn("Open Cost changed", "tonal")}</div>'''
main = f'''<section class="grow vstack g16">{tiles([("Bought this month, UGX", "18,420,000", "41 deliveries"), ("Price changes", "9", "this month"), ("Short on delivery", "3", "UGX 61,400"), ("With no order", "4", "received anyway")])}{table(["Date", "Supplier", "Store", "Invoice", "#Lines", "#UGX", ""], PU, "26 Nov")}<p class="t-sup muted">35 more this month below.</p></section>
    <aside class="vstack g16" style="width: 420px; flex: none">{pa}</aside>'''
lp('Accountant-Purchases', 'accountant', 'Purchases', 'Purchases ›', 'Deliveries · November', btn('Download', 'sm tonal', icon='down'), main, 'Purchases, accountant laptop', 'Purchases: what was bought, from whom, price changes, shorts', '/accounting/purchases (new)', 'U7, needs E7 and E8', '<span class="t-sup muted">as at 26 Nov, 16:30</span>')
pp('Accountant-Purchases-Phone', 'accountant', 'Purchases', band('Purchases', 'November · 41 deliveries'), tiles([('Bought, UGX', '18,420,000', 'this month'), ('Price changes', '9', 'this month')]) + '<div class="card" style="overflow: hidden">' + ''.join(row(s, f'{d} · {i} · UGX {u}', p_, btn=True) for d, s, st, i, n, u, p_ in PU[:5]) + '</div>',
   'Purchases, accountant phone', 'Purchases on a phone', '/accounting/purchases (new)', 'U7, needs E7 and E8')

# 4 stock value (accountant)
SV = [('Beer and cider', 'Bar store', '1,284,000'), ('Spirits', 'Bar store', '2,310,000'), ('Soft drinks and water', 'Bar store', '526,000'), ('Meat and fish', 'Main store', '4,280,000'), ('Vegetables and fruit', 'Main store', '812,000'),
      ('Dry goods and oil', 'Main store', '3,818,000'), ('Bread and dairy', 'Kitchen store', '418,000'), ('Kitchen point stock', 'Kitchen store', '832,000')]
sv = kvcard('Changed since 1 Nov, UGX', [('Worth on 1 Nov', '13,483,900'), ('Bought', '+18,420,000'), ('Used by sales', '−16,980,000'), ('Waste and staff meals', '−611,200'), ('Count differences', '−32,700'), ('Worth now', '14,280,000')])
main = f'''<section class="grow vstack g16">{tiles([("Worth now, UGX", "14,280,000", "143 items"), ("Main store, UGX", "8,910,000", "64 items"), ("Bar store, UGX", "4,120,000", "41 items"), ("Kitchen store, UGX", "1,250,000", "38 items")])}{table(["Group", "Store", "#Worth, UGX"], SV)}</section>
    <aside class="vstack g16" style="width: 420px; flex: none">{sv}{card("<p class=\"t-sup\">Valued at the average cost of what is in each store. Items with no cost yet (12) count as nothing until a cost is set.</p>")}</aside>'''
lp('Accountant-Stock-Value', 'accountant', 'Stock value', 'Stock value ›', 'All stores', btn('Download', 'sm tonal', icon='down'), main, 'Stock value, accountant laptop', 'Stock value: by store and group, and how it moved this month', '/accounting/stock-value (new)', 'U7, needs E7 and E8', '<span class="t-sup muted">as at 26 Nov, 16:30</span>')
pp('Accountant-Stock-Value-Phone', 'accountant', 'More', band('Stock value', 'All stores · as at 16:30'), tiles([('Worth now, UGX', '14,280,000', '143 items'), ('Main store', '8,910,000', '64 items')]) + '<div class="card" style="overflow: hidden">' + ''.join(row(g, s, f'<span class="t-body b">{v}</span>', btn=False) for g, s, v in SV[:6]) + '</div><p class="t-sup muted">2 more groups below, in the Kitchen store: UGX 1,250,000.</p>',
   'Stock value, accountant phone', 'Stock value on a phone', '/accounting/stock-value (new)', 'U7, needs E7 and E8')
