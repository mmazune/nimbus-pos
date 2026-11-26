from base import *
G = 9
L, P = (1440, 900), (390, 844)
def table(heads, rows, cls='dt'):
    th = ''.join(f'<th{" class=\"num\"" if h.startswith("#") else ""}>{h.lstrip("#")}</th>' for h in heads)
    tr = ''.join('<tr>' + ''.join(f'<td{" class=\"num\"" if heads[i].startswith("#") else ""}>{c}</td>' for i, c in enumerate(r)) + '</tr>' for r in rows)
    return f'<div class="card" style="overflow: hidden"><table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'
def tiles(items): return f'<div class="card"><div class="tilerow" style="grid-template-columns: repeat({len(items)}, minmax(0, 1fr))">' + ''.join(f'<div class="stat"><span class="t-sup muted">{l}</span><b>{v}</b><span class="t-small muted">{s}</span></div>' for l, v, s in items) + '</div></div>'
def card(c, pad='16px 20px'): return f'<div class="card" style="padding: {pad}">{c}</div>'
def kvcard(cap, items): return card(f'<p class="cap" style="padding-bottom: 6px">{cap}</p>' + ''.join(kv(a, b) for a, b in items))
CH = ['Today', 'Yesterday', 'This week', 'Last week', 'This month']
def report(name, title, h1, period, on, tl, tbl, aside, shows, ms, phone_rows, role='Manager', ptiles=None, sub=None):
    chips = ''.join(f'<button class="chip{" on" if c == on else ""}">{c}</button>' for c in CH)
    tl = [((l + ', UGX') if v.startswith('UGX ') else l, v.replace('UGX ', ''), sm) for l, v, sm in tl]
    body = lbar('manager', 'More') + cp('Reports ›', h1, chips + btn('Download', 'sm tonal', icon='down'), f'<span class="t-sup muted">{period}</span>') + f'''
  <main class="page" style="flex-direction: row; gap: 20px"><section class="grow vstack g16">{tiles(tl)}{tbl}</section><aside class="vstack g16" style="width: 420px; flex: none">{aside}</aside></main>'''
    page(name, *L, title, body, G, role, shows, f'/manager/reports/{name.lower().replace("report-", "")} (new)', ms)
    pch = '<div class="hstack g8">' + ''.join(f'<button class="chip{" on" if c == on else ""}">{c}</button>' for c in [on] + [c for c in ['Yesterday', 'Last week', 'Today'] if c != on][:2]) + '</div>'
    pt = tiles([(l, v.replace('UGX ', ''), sm) for l, v, sm in (ptiles or tl)[:2]])
    pb = rband(h1, sub or period, more=False).replace('aria-label="Back"', 'aria-label="Back to reports"') + f'<main class="body">{pch}{pt}{phone_rows}</main>' + navbar('manager', 'Reports', True)
    page(name + '-Phone', *P, title + ', phone', pb, G, role, shows + ', phone', f'/manager/reports/{name.lower().replace("report-", "")} (new)', ms)
def prows(rows): return '<div class="card" style="overflow: hidden">' + ''.join(row(a, b, f'<span class="t-body b">{c}</span>' if c else '', btn=False) for a, b, c in rows) + '</div>'

# 1 the day report
pay = table(['How it was paid', '#Bills', '#UGX'], [('Cash', '71', '3,402,000'), ('Mobile money', '58', '2,896,500'), ('Card', '33', '1,311,500'), ('Pending at close', '0', '0'), ('Total', '162', '7,610,000')])
wrong = card('<p class="cap" style="padding-bottom: 6px">What went wrong</p>' + ''.join(f'<div class="hstack" style="min-height: 44px"><span class="grow t-body">{a}</span>{pill(b, c)}</div>' for a, b, c in [('Till 2 was UGX 1,000 short', 'Signed', 'p-neutral'), ('5 voids, UGX 74,000', 'Usual', 'p-neutral'), ('Goat stew ran out 21:40 to close', 'About 52,000', 'p-amber'), ('3 tickets late at the hot kitchen', 'Late', 'p-amber'), ('A kitchen request arrived 6 buns short', 'Seen', 'p-neutral')]))
top = kvcard('Sold most, UGX', [('Beef burger · 61', '1,708,000'), ('Lager · 214', '1,284,000'), ('Chicken wings · 38', '912,000'), ('Grilled tilapia · 19', '722,000')])
report('Report-Day', 'Day report', 'Day report', 'Wed 25 Nov · closed 01:12 by Peter K.', 'Yesterday',
       [('Sales', 'UGX 7,610,000', '162 bills'), ('Usual bill', 'UGX 46,975', 'average'), ('Voids', 'UGX 74,000', '5 lines'), ('Discounts', 'UGX 88,000', '7 bills')], pay, wrong + top,
       'The day report: sales, how it was paid, what went wrong, what sold most', 'U9, needs E11',
       prows([('Cash', '71 bills', '3,402,000'), ('Mobile money', '58 bills', '2,896,500'), ('Card', '33 bills', '1,311,500')]) + card('<p class="cap" style="padding-bottom: 4px">What went wrong</p><p class="t-sup">Till 2 was UGX 1,000 short, signed. Goat stew ran out 21:40 to close. 3 hot-kitchen tickets late.</p>', '14px 16px'),
       role='Owner, manager', ptiles=[('Sales', '7,610,000', '162 bills'), ('Voids', '74,000', '5'), ('Discounts', '88,000', '7')], sub='Wed 25 Nov · closed 01:12')

# 2 till report
mv = table(['When', 'What', 'Who', '#UGX'], [('15:55', 'Float in', 'Sarah M.', '200,000'), ('16:02 to 00:30', 'Cash from 71 bills', 'Sarah M.', '2,140,000'), ('18:40', 'Paid out · gas refill', 'Grace N.', '− 35,000'), ('21:15', 'Dropped to the safe', 'Grace N.', '− 1,500,000'), ('22:10', 'Drawer opened, no sale · change for a guest', 'Sarah M.', '0')])
tsum = kvcard('Does the drawer match?', [('Should be in the drawer', 'UGX 805,000'), ('Counted, blind', 'UGX 804,000'), ('Difference', 'UGX 1,000 short'), ('Limit before a signature', 'UGX 5,000')]) + card('<p class="t-sup">Under the limit, so it closed without a supervisor. The cashier did not see what the drawer should hold until she had counted.</p>')
report('Report-Till', 'Till report', 'Till report · Till 1', 'Thu 26 Nov · Sarah M. · 15:55 to 00:34', 'Today',
       [('Float', 'UGX 200,000', 'in at 15:55'), ('Cash taken', 'UGX 2,140,000', '71 bills'), ('Out of the drawer', 'UGX 1,535,000', 'paid out and dropped'), ('Difference', 'UGX −1,000', 'under the limit')], mv, tsum,
       'Till report: float, cash in, paid out, dropped, counted, difference', 'U9, needs E11',
       prows([('Should be in the drawer', '', '805,000'), ('Counted, blind', 'Sarah M. at 00:34', '804,000'), ('Difference', 'Under the 5,000 limit', '−1,000')]), role='Cashier (own), supervisor, manager',
       ptiles=[('Cash in', '2,140,000', '71 bills'), ('Short', '1,000', 'under the limit')])

# 3 voids
VD = [('Chicken wings', 'Table 12', 'Amina K.', 'Grace N.', 'Made, waste', 'Guest changed their mind', '24,000'), ('Pepper steak', 'Table 30', 'Brian O.', 'Grace N.', 'Made, waste', 'Took too long', '45,000'), ('Lager 500 ml', 'Tab 6', 'Amina K.', 'Grace N.', 'Not made', 'Wrong item entered', '6,000'),
      ('Goat stew', 'Table 19', 'David S.', 'Peter K.', 'Made, waste', 'Guest complaint', '26,000'), ('Cola 300 ml', 'Table 3', 'Brian O.', 'Grace N.', 'Not made', 'Wrong item entered', '3,000'), ('Chips', 'Table 10', 'David S.', 'Grace N.', 'Made, waste', 'Kitchen ran out', '8,000')]
report('Report-Voids', 'Voids report', 'Voids', 'Thu 26 Nov · to 23:15', 'Today',
       [('Voided', 'UGX 112,000', '6 lines'), ('Made, so waste', 'UGX 103,000', '4 lines'), ('Back to stock', 'UGX 9,000', '2 lines'), ('A usual day', '4 lines', 'last 4 weeks')], table(['Item', 'Table', 'Asked by', 'Approved by', 'Was it made?', 'Why', '#UGX'], VD),
       kvcard('By waiter', [('Brian O.', '2 · UGX 48,000'), ('David S.', '2 · UGX 34,000'), ('Amina K.', '2 · UGX 30,000')]) + kvcard('By reason', [('Took too long', '1 · UGX 45,000'), ('Guest changed their mind', '1 · UGX 26,000'.replace('26', '24')), ('Guest complaint', '1 · UGX 26,000'), ('Wrong item entered', '2 · UGX 9,000'), ('Kitchen ran out', '1 · UGX 8,000')]),
       'Voids: what, who asked, who approved, made or not, why, value', 'U9, needs E1', prows([(a, f'{b} · {c} · {f}', g) for a, b, c, d, e, f, g in VD]))

# 4 sales by item
SI = [('Beef burger', 'Burgers', '34', '952,000', 20), ('Lager', 'Beer', '118', '708,000', 15), ('Chicken wings', 'Starters', '22', '528,000', 11), ('Grilled tilapia', 'Grills', '11', '418,000', 9), ('Goat stew', 'Local', '14', '364,000', 7),
      ('Blended Scotch, tots and doubles', 'Whisky', '31', '341,000', 7), ('Chips', 'Sides', '40', '320,000', 7), ('Pepper steak', 'Grills', '6', '270,000', 6)]
report('Report-Sales-By-Item', 'Sales by item', 'Sales by item and group', 'Thu 26 Nov · to 19:42', 'Today',
       [('Sales', 'UGX 4,860,000', '96 bills'), ('Items sold', '612', 'lines sent and paid'), ('Groups', '23', 'with a sale'), ('Not sold today', '19 items', 'see the list')], table(['Item', 'Group', '#Sold', '#UGX', 'Share of sales'], [(a, b, c, d, f'<div class="hstack g8"><div class="bar-s" style="margin: 0; width: 120px"><i style="width: {e * 5}%"></i></div><span class="t-sup">{e}%</span></div>') for a, b, c, d, e in SI]),
       kvcard('By group, UGX', [('Burgers', '1,166,000'), ('Beer', '968,000'), ('Grills', '942,000'), ('Starters', '624,000'), ('Whisky', '511,000')]) + card('<p class="t-sup">Counts lines that were sent and paid. A voided line is not a sale; it is on the voids report.</p>'),
       'Sales by item and group: what sells, what does not', 'U9', prows([(a, f'{b} · {c} sold', d) for a, b, c, d, e in SI[:6]]))

# 5 ticket times
TT = [('Hot kitchen', '18:00 to 19:00', '42', '12 min', '3'), ('Hot kitchen', '19:00 to 20:00', '58', '16 min', '7'), ('Cold kitchen', '19:00 to 20:00', '21', '7 min', '0'), ('Bar', '19:00 to 20:00', '96', '4 min', '2'), ('Desserts', '19:00 to 20:00', '9', '6 min', '0')]
report('Report-Ticket-Times', 'Ticket times', 'Ticket times', 'Thu 26 Nov · so far', 'Today',
       [('Tickets', '226', 'all stations'), ('Usual, sent to ready', '14 min', 'hot kitchen, all day'), ('Late', '12', 'past red time'), ('Ready, not collected', '3 min', 'usual wait')], table(['Station', 'Hour', '#Tickets', '#Usual time', '#Late'], TT),
       kvcard('Slowest dishes, sent to ready', [('Pepper steak', '22 min'), ('Grilled tilapia', '19 min'), ('Goat stew', '17 min'), ('Pork ribs', '16 min')]) + card('<p class="t-sup">Late means past the station’s red time: 20 minutes for the hot kitchen, 10 for the bar.</p>'),
       'Ticket times: how long by station and hour, how many late', 'U9, needs E5', prows([(f'{a}, {b}', f'{c} tickets · {e} late', d) for a, b, c, d, e in TT]), role='Manager, chef')

# 6 stock on hand
SH = [('Beef mince', 'Main store', '8.4 kg', '18,000 a kg', '151,200'), ('Lager 500 ml', 'Bar store', '228 bottles', '3,800', '866,400'), ('Blended Scotch', 'Bar store', '9 bottles', '33,750', '303,750'), ('Chicken wings', 'Main store', '9 kg', '14,000 a kg', '126,000'),
      ('Burger buns', 'Main store', '36 pieces', '800', '28,800'), ('Cooking oil', 'Main store', '14 l', '9,000 a l', '126,000'), ('Cheese slices', 'Kitchen store', '140 pieces', '600', '84,000')]
report('Report-Stock-On-Hand', 'Stock on hand', 'Stock on hand', 'Now · 16:30 · at average cost', 'Today',
       [('Worth, all stores', 'UGX 14,280,000', '143 items'), ('Main store', 'UGX 8,910,000', '64 items'), ('Bar store', 'UGX 4,120,000', '41 items'), ('Kitchen store', 'UGX 1,250,000', '38 items')], table(['Item', 'Store', '#On hand', '#Average cost, UGX', '#Worth, UGX'], SH),
       kvcard('Below minimum', [('Burger buns', '36 of 48'), ('Tomatoes', '1 kg of 6 kg'), ('Tonic 300 ml', '18 of 24')]) + card('<p class="t-sup">Lager in the Bar store was below zero until this morning’s count. Items with no cost yet are worth nothing here until the accountant sets one.</p>'),
       'Stock on hand: what is in each store and what it is worth', 'U9, needs E7 and E8', prows([(a, f'{b} · {c}', e) for a, b, c, d, e in SH[:6]]), role='Store keeper, manager, accountant')

# 7 count differences
CD = [('Lager 500 ml', 'Bar store', '231', '228', '−3', '−11,400', 'Broken crate, not entered'), ('Tonic 300 ml', 'Bar store', '18', '17', '−1', '−1,050', ''), ('Blended Scotch', 'Bar store', '9.2', '8.6', '−0.6 bottles', '−20,250', 'Over limit · note: heavy pours, spoke to Isaac B.'),
      ('Beef mince', 'Main store', '8.0 kg', '8.4 kg', '+0.4 kg', '+7,200', ''), ('Cheese slices', 'Kitchen store', '152', '140', '−12', '−7,200', '')]
report('Report-Count-Differences', 'Count differences', 'Count differences', 'This week, 23 to 26 Nov · 4 counts', 'This week',
       [('Counts', '4', '2 spot, 1 full, 1 bar'), ('Short', 'UGX −39,900', '4 items'), ('Over', 'UGX +7,200', '1 item'), ('Over the limit', '1 item', 'note written')], table(['Item', 'Store', '#Books said', '#Counted', '#Difference', '#UGX', 'Manager’s note'], CD, 'dt w'),
       kvcard('The limit', [('An item', '2% or UGX 20,000'), ('Above it', 'the manager writes a note')]) + card('<p class="t-sup">Each line is compared with the books at the minute it was counted, so selling during a count does not show as a difference.</p>'),
       'Count differences: what the count found against the books, with the manager’s note', 'U9, needs E7', prows([(a, f'{b} · {e}', f) for a, b, c, d, e, f, g in CD[:5]]), role='Manager, accountant, owner')

# 8 cost and margin
CM = [('Beef burger', '28,000', '5,700', '22,300', '80%'), ('Chicken wings', '24,000', '6,900', '17,100', '71%'), ('Grilled tilapia', '38,000', '14,200', '23,800', '63%'), ('Blended Scotch, tot', '8,000', '1,350', '6,650', '83%'),
      ('Goat stew', '26,000', '9,800', '16,200', '62%'), ('Chicken luwombo', '30,000', 'No cost yet', '—', '—'), ('Pepper steak', '45,000', '19,500', '25,500', '57%')]
report('Report-Cost-Margin', 'Cost and margin', 'Cost and margin', 'Costs as at 24 Nov', 'This month',
       [('Items with a cost', '140 of 152', ''), ('Usual margin', '71%', 'food and drink'), ('No cost yet', '12 items', 'no margin shown'), ('Cost changed', '3 items', 'this week')], table(['Item', '#Sells for, UGX', '#Costs, UGX', '#Left over, UGX', '#Margin'], CM),
       kvcard('Cost changed this week', [('Tomatoes', '4,000 to 4,600 a kg'), ('Cooking oil', '8,500 to 9,000 a l'), ('Lager 500 ml', '3,700 to 3,800')]) + card('<p class="t-sup">Cost comes from what was paid on deliveries, averaged over what is in the store. An item with no cost shows no margin anywhere until the accountant sets one.</p>'),
       'Cost and margin per item; items with no cost', 'U9, needs E8', prows([(a, f'Sells {b} · costs {c}', e) for a, b, c, d, e in CM[:6]]), role='Accountant, manager')
