from base import *
G = 2
T, P = (1280, 800), (390, 844)

def order_bg(role='waiter', sub='3 guests · open 1 h 05 · Amina K.', title='Table 12', total='98,000', groups=T12, foot=None):
    who = role
    f = foot or (MORE + btn('Print bill', 'tonal', 'flex: 1 1 0; padding: 0 12px'))
    return obar(title, sub, who) + f'''
  <div class="ord" style="grid-template-columns: minmax(0, 1fr) 372px" inert>
{menu(FOODG, 'Popular', POP, 4)}
{check(lines(groups), total, f)}
  </div>'''
def phone_bg(title='Table 12', sub='3 guests · open 1 h 05', groups=T12, total='98,000'):
    return rband(title, sub).replace('<header class="band"', '<header inert class="band"') + f'''
  <main class="body" inert style="gap: 0; padding: 0">
    <div class="check" style="flex: 1 1 0; box-shadow: none">{lines(groups)}</div>
  </main>
  <footer class="foot" inert><button class="btn tonal" style="flex: 1 1 0">Bill · UGX {total}</button></footer>'''

def both(name, title, role, shows, route, ms, tbody, tfoot, pbody, pfoot, sub='', psub=None, bg=None, pbg=None, tcls='wide'):
    page(name, *T, title, (bg or order_bg(role)) + scrim() + sheet(title, sub, tbody, tfoot, tcls), G, role.capitalize(), shows, route, ms)
    page(name + '-Phone', *P, title + ', phone', (pbg or phone_bg()) + scrim() + sheet(title, psub if psub is not None else sub, pbody, pfoot, gap=14), G, role.capitalize(), shows + ', phone', route, ms)

FREE = [('1', '4 seats'), ('4', '2 seats'), ('8', '4 seats'), ('11', '4 seats'), ('14', '6 seats'), ('18', '4 seats'), ('22', '2 seats'), ('25', '4 seats'), ('27', '8 seats'), ('29', '4 seats'), ('31', '2 seats'), ('32', '4 seats')]
def tablegrid(items, cols, on):
    return f'<div class="optgrid" style="grid-template-columns: repeat({cols}, minmax(0, 1fr))">' + ''.join(
        f'<button class="opt tall{" on" if n == on else ""}">Table {n}<small>{s}</small></button>' for n, s in items) + '</div>'
R = '/waiter/floor?tableId='

# 1 move table
both('Table-Move', 'Move table 12', 'waiter', 'Move table: pick a free table; the order goes with the guests', R + '#move', 'U3, needs E3',
     f'<div class="hstack" style="justify-content: space-between">{seg(["Main hall", "Terrace", "Bar", "VIP"], "Main hall")}<span class="t-sup muted">12 free tables · 3 guests need 3 seats or more</span></div>{tablegrid([f for f in FREE if f[1] != "2 seats"], 6, "14")}<p class="t-sup muted">Tables 4, 22 and 31 have 2 seats and are not shown. Terrace has 5 free, VIP 1.</p><p class="t-sup muted">The order, the bill and you as their waiter go with them. Kitchen tickets now say table 14. Table 12 becomes free.</p>',
     sfoot(btn('Keep them at 12', 'textbtn'), btn('Move to table 14', 'filled', 'min-width: 260px')),
     f'{seg(["Main hall", "Terrace", "Bar", "VIP"], "Main hall", True)}{tablegrid([f for f in FREE if f[1] != "2 seats"], 3, "14")}<p class="t-sup muted">The order and the bill go with them. Table 12 becomes free.</p>',
     btn('Move to table 14', 'filled'), sub='3 guests · UGX 98,000 · pick a free table', psub='Pick a free table')

# 2 join
JOIN = [('2', 'You · 4 guests · 86,000'), ('9', 'You · 2 guests · 24,000'), ('17', 'You · 4 guests · 45,000'), ('6', 'You · 61,000'), ('23', 'You · 19,000'), ('3', 'Brian O. · 54,000')]
def joingrid(items, cols, on):
    return f'<div class="optgrid" style="grid-template-columns: repeat({cols}, minmax(0, 1fr))">' + ''.join(
        f'<button class="opt tall{" on" if n in on else ""}">Table {n}<small>{s}</small></button>' for n, s in items) + '</div>'
both('Table-Join', 'Join table 12 with another', 'waiter', 'Join tables: two parties become one bill', R + '#join', 'U3, needs E3',
     f'<p class="lab">Pick the table to join to 12</p>{joingrid(JOIN, 3, ["9"])}<div class="card" style="box-shadow: none; background: var(--canvas); padding: 14px 16px">{kv("Table 12", "UGX 98,000")}{kv("Table 9", "UGX 24,000")}<div class="hr"></div>{kv("One bill on table 12", "UGX 122,000")}</div><p class="t-sup muted">Table 9 shows “Joined to 12” until the bill is paid. You can split them again at any time. Another waiter’s table needs a supervisor.</p>',
     sfoot(btn('Cancel', 'textbtn'), btn('Join 2 tables · UGX 122,000', 'filled', 'min-width: 300px')),
     f'{joingrid(JOIN[:4], 2, ["9"])}{kv("One bill on table 12", "UGX 122,000")}<p class="t-sup muted">Table 9 shows “Joined to 12”. You can split them again later.</p>',
     btn('Join 2 tables · UGX 122,000', 'filled'), sub='3 guests · UGX 98,000', psub='Pick the table to join to 12')

# 3-6 split
SPLITS = ['By guest', 'By item', 'By amount', 'Evenly']
def billcard(title, ls, total, on=False, phone=False):
    sh = 'background: var(--tonal); box-shadow: none' if on else ''
    o = ''.join(f'<div class="line" style="min-height: 44px; padding: 8px 14px"><span class="q">{q}</span><span class="grow"><span class="nm">{n}</span></span><span class="pr">{p}</span></div>' for q, n, p in ls)
    return f'<div class="card vstack" style="padding: 4px 0 8px; {sh}"><div class="hstack" style="padding: 10px 14px 4px; justify-content: space-between"><span class="t-row">{title}</span><span class="t-row">UGX {total}</span></div>{o}</div>'
G1 = [(1, 'Lager 500 ml', '6,000'), (1, 'Beef burger', '28,000'), (1, 'Chips', '8,000')]
G2 = [(1, 'Lager 500 ml', '6,000'), (1, 'Blended Scotch', '15,000'), (1, 'Chicken wings', '24,000')]
G3 = [(1, 'Cola 300 ml', '3,000'), (1, 'Chips', '8,000')]
splitsub = 'Table 12 · UGX 98,000 · 8 items'
both('Split-Guest', 'Split the bill', 'waiter', 'Split by guest: tap a line, then a guest', R + '#split', 'U3, needs E3',
     f'{seg(SPLITS, "By guest", True)}<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px">{billcard("Guest 1", G1, "42,000")}{billcard("Guest 2", G2, "45,000")}{billcard("Guest 3", G3, "11,000", True)}</div><p class="t-sup muted">Tap a line, then the guest who had it. Two lagers were split one each. All 8 items have a guest.</p>',
     sfoot(btn('Add a guest', 'tonal', icon='plus'), '<span class="grow"></span>', btn('Make 3 bills', 'filled', 'min-width: 240px')),
     f'{seg(["Guest", "Item", "Amount", "Evenly"], "Guest", True)}{billcard("Guest 1", G1, "42,000")}<div class="card hstack" style="padding: 14px; justify-content: space-between"><span class="t-row">Guest 2 · 3 items</span><span class="t-row">UGX 45,000</span></div><div class="card hstack" style="padding: 14px; justify-content: space-between"><span class="t-row">Guest 3 · 2 items</span><span class="t-row">UGX 11,000</span></div>{btn("Add a guest", "tonal", icon="plus")}',
     btn('Make 3 bills', 'filled'), sub=splitsub)
B1 = [(2, 'Lager 500 ml', '12,000'), (1, 'Beef burger', '28,000'), (2, 'Chips', '16,000'), (1, 'Chicken wings', '24,000')]
B2 = [(1, 'Blended Scotch', '15,000'), (1, 'Cola 300 ml', '3,000')]
both('Split-Item', 'Split the bill', 'waiter', 'Split by item: tap lines to move them to a new bill', R + '#split', 'U3, needs E3',
     f'{seg(SPLITS, "By item", True)}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">{billcard("Bill 1, stays on table 12", B1, "80,000")}{billcard("Bill 2, new", B2, "18,000", True)}</div><p class="t-sup muted">Tap a line to move it to the other bill. Each bill is paid on its own; the table frees when both are paid.</p>',
     sfoot(btn('Cancel', 'textbtn'), btn('Make 2 bills · 80,000 and 18,000', 'filled', 'min-width: 320px')),
     f'{seg(["Guest", "Item", "Amount", "Evenly"], "Item", True)}{billcard("Bill 2, new", B2, "18,000", True)}<div class="card hstack" style="padding: 14px; justify-content: space-between"><span class="t-row">Bill 1 · 6 items</span><span class="t-row">UGX 80,000</span></div><p class="t-sup muted">Tap a line to move it between bills.</p>',
     btn('Make 2 bills', 'filled'), sub=splitsub)
amt = f'<div class="field" style="height: 64px; justify-content: flex-end; font-size: 26px; line-height: 32px; font-weight: 700">50,000</div>'
both('Split-Amount', 'Split the bill', 'waiter', 'Split by amount: the first bill takes a sum, the rest stays', R + '#split', 'U3, needs E3',
     f'''{seg(SPLITS, "By amount", True)}<div class="hstack g24" style="align-items: flex-start"><div class="vstack g12" style="width: 320px; flex: none">{amt}{keypad(("1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"), 64)}</div>
     <div class="vstack g12 grow"><div class="card" style="padding: 16px 20px">{kv("Bill 1, paid now", "UGX 50,000")}{kv("Bill 2, left on table 12", "UGX 48,000")}</div>{optgrid(["10,000", "20,000", "50,000", "Half"], 2, "50,000", "opt lg")}<p class="t-sup muted">Bill 1 is a sum, not items. The lines stay on table 12 until the last shilling is paid.</p></div></div>''',
     sfoot(btn('Cancel', 'textbtn'), btn('Make 2 bills · 50,000 and 48,000', 'filled', 'min-width: 320px')),
     f'{seg(["Guest", "Item", "Amount", "Evenly"], "Amount", True)}{amt}{keypad(("1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"), 52)}{kv("Left on table 12", "UGX 48,000")}',
     btn('Make 2 bills', 'filled'), sub=splitsub)
ways = optgrid(['2', '3', '4', '5', '6', '8'], 6, '3', 'opt lg')
both('Split-Even', 'Split the bill', 'waiter', 'Split evenly: tap the number of people', R + '#split', 'U3, needs E3',
     f'{seg(SPLITS, "Evenly", True)}<p class="lab">How many people?</p>{ways}<div class="card hstack" style="padding: 18px 20px; justify-content: space-between"><span class="t-row">Each pays</span><span class="big">UGX 32,666</span></div><p class="t-sup muted">98,000 does not divide by 3, so the first bill takes the extra 2 shillings: 32,668, then 32,666 and 32,666.</p>',
     sfoot(btn('Cancel', 'textbtn'), btn('Make 3 bills', 'filled', 'min-width: 300px')),
     f'{seg(["Guest", "Item", "Amount", "Evenly"], "Evenly", True)}<p class="lab" style="margin: 0">How many people?</p>{optgrid(["2", "3", "4", "5", "6", "8"], 3, "3", "opt lg")}<div class="card hstack" style="padding: 16px; justify-content: space-between"><span class="t-row">Each pays</span><span class="t-h">UGX 32,666</span></div><p class="t-sup muted">The first bill takes the extra 2 shillings.</p>',
     btn('Make 3 bills', 'filled'), sub=splitsub)

# 7 discount
DISC = [('Birthday', '15% · up to 30,000'), ('Happy hour', '10% on drinks'), ('Loyal guest', '10%'), ('Staff', '10% · staff only'), ('Kitchen was slow', '10%'), ('Other amount', 'Needs a PIN')]
def discgrid(cols, items=DISC):
    return f'<div class="optgrid" style="grid-template-columns: repeat({cols}, minmax(0, 1fr))">' + ''.join(
        f'<button class="opt tall{" on" if n == "Birthday" else ""}">{n}<small>{s}</small></button>' for n, s in items) + '</div>'
both('Discount', 'Discount on table 12', 'waiter', 'Discount: named ones for staff, any other amount needs a supervisor’s PIN', R + '#discount', 'U3, needs E9',
     f'<div><p class="lab">Which discount</p>{discgrid(3)}</div><div class="hstack g16"><div class="grow"><p class="lab">On</p>{seg(["The whole bill", "One line"], "The whole bill", True)}</div><div class="card" style="width: 320px; box-shadow: none; background: var(--canvas); padding: 10px 16px">{kv("Bill", "UGX 98,000")}{kv("Birthday 15%", "− 14,700")}{kv("New bill", "UGX 83,300")}</div></div><p class="t-sup muted">Your limit is 15% a bill. “Other amount” asks a supervisor to type their PIN on this screen. Your name and the reason go on the discounts report.</p>',
     sfoot(btn('Cancel', 'textbtn'), btn('Give 15% · UGX 14,700 off', 'filled', 'min-width: 300px')),
     f'{discgrid(2, DISC[:4] + DISC[5:])}{seg(["Whole bill", "One line"], "Whole bill", True)}{kv("Birthday 15%", "− 14,700")}{kv("New bill", "UGX 83,300")}',
     btn('Give 15% · UGX 14,700 off', 'filled'), sub='UGX 98,000 · pick a named discount', psub='Your limit is 15% a bill')

# 8 change waiter (supervisor)
STAFF = [('BO', 'Brian O.', '5 tables · UGX 412,000 open'), ('DS', 'David S.', '4 tables · UGX 329,500 open'), ('JM', 'Joy M.', '1 table · started 19:30'), ('AK', 'Amina K.', '6 tables now · has table 12')]
def staffrows(on, n=4):
    return '<div class="card" style="overflow: hidden">' + ''.join(row(nm, s, ('<span class="round sm" style="width: 32px; height: 32px; background: var(--primary); color: var(--on-primary)">' + ic('check', 's') + '</span>') if nm == on else (pill('Has it now', 'p-neutral') if nm == 'Amina K.' else ''), av, style='min-height: 64px' + ('; background: var(--tonal)' if nm == on else '')) for av, nm, s in STAFF[:n]) + '</div>'
sbg = order_bg('supervisor', 'Amina K.’s table · 3 guests · open 1 h 05')
both('Change-Waiter', 'New waiter for table 12', 'supervisor', 'Change waiter: a supervisor gives a table to another waiter on shift', '/supervisor/floor?tableId=#waiter', 'U3, needs E3',
     f'<p class="lab">Waiters on shift now</p>{staffrows("Brian O.")}<p class="t-sup muted">Table 12 and its bill move to Brian O. Amina K. and Brian O. are both told. Sales already sent stay counted for Amina K.</p>',
     sfoot(btn('Cancel', 'textbtn'), btn('Give table 12 to Brian O.', 'filled', 'min-width: 300px')),
     f'{staffrows("Brian O.", 4)}<p class="t-sup muted">Both waiters are told.</p>', btn('Give table 12 to Brian O.', 'filled'),
     sub='Amina K.’s table · UGX 98,000', bg=sbg, tcls='mid')

# 9 hand over: offer
MYT = [('2', '86,000'), ('6', '61,000 · late'), ('9', '24,000'), ('12', '98,000'), ('17', '45,000'), ('23', '19,000 · not sent')]
def mygrid(cols):
    return f'<div class="optgrid" style="grid-template-columns: repeat({cols}, minmax(0, 1fr))">' + ''.join(f'<button class="opt tall"><span class="hstack g4">{ic("check", "s")}Table {n}</span><small>{a}</small></button>' for n, a in MYT) + '</div>'
floorbg = tbar('Floor', 'Main hall · 6 tables are yours · as at 22:48', 'waiter', 'Find a table or a tab').replace('<header class="bar tall">', '<header class="bar tall" inert>') + f'''
  <main class="page" style="padding: 16px 32px 16px" inert>
    <div class="hstack" style="justify-content: space-between">{areas()}{seg(["My tables · 6", "All tables"], "My tables · 6")}</div>
{floor([t for t in MAIN_TILES if '>You<' in t], 8)}
  </main>
{navbar("waiter", "Floor").replace('<nav class="navbar"', '<nav inert class="navbar"')}'''
pfloorbg = band('Floor', '6 tables are yours · 22:48').replace('<header class="band">', '<header inert class="band">') + f'<main class="body" inert>{floor(PHONE_MINE, 3, "floor c")}</main>' + navbar('waiter', 'Floor', True).replace('<nav class="tabbar"', '<nav inert class="tabbar"')
both('Handover-Offer', 'Hand over your tables', 'waiter', 'Hand over: offer tables to a named colleague before going home', '/waiter/me#hand-over', 'U4, needs E3',
     f'<div class="hstack g24" style="align-items: flex-start"><div class="grow"><p class="lab">Tables · 6 picked · UGX 333,000 open</p>{mygrid(3)}</div><div style="width: 360px; flex: none"><p class="lab">To</p>{staffrows("Brian O.", 3)}</div></div><p class="t-sup muted">Brian O. must accept on his screen. Your shift ends when every table is taken. Your sales so far stay yours.</p>',
     sfoot(btn('Cancel', 'textbtn'), btn('Offer 6 tables to Brian O.', 'filled', 'min-width: 300px')),
     f'<p class="lab" style="margin: 0">6 tables · UGX 333,000 open</p>{mygrid(3)}<p class="lab" style="margin: 0">To</p>{staffrows("Brian O.", 3)}',
     btn('Offer 6 tables to Brian O.', 'filled'), sub='End of shift · Amina K.', psub='', bg=floorbg, pbg=pfloorbg, tcls='mid')

# 10 hand over: accept (Brian's screen)
btiles = [t.replace('tbl other', 'tbl').replace('<span class="who">Brian O.</span>', '<span class="who">You</span>').replace('p-neutral">Open', 'p-brand">Open') for t in MAIN_TILES if '>Brian O.<' in t]
bfloor = floorbg.replace('<b>Amina K.</b>', '<b>Brian O.</b>').replace('6 tables are yours', '4 tables are yours').replace('My tables · 6', 'My tables · 4').replace(floor([t for t in MAIN_TILES if '>You<' in t], 8), floor(btiles, 8))
bphone = pfloorbg.replace('6 tables are yours', '4 tables are yours').replace(floor(PHONE_MINE, 3, "floor c"), floor([ptile(3, '18 min', 'Open', 'p-brand'), ptile(16, '27 min', 'Open', 'p-brand'), ptile(24, '22 min', 'Open', 'p-brand'), ptile(30, '48 min', 'Open', 'p-brand')], 3, 'floor c'))
acc = '<div class="card" style="overflow: hidden">' + ''.join(row(f'Table {n}', f'UGX {a.split(" · ")[0]}', pill('Late', 'p-red') if 'late' in a else '') for n, a in MYT[:3]) + row('3 more tables', 'Tables 12, 17 and 23 · UGX 162,000', pill('3 not sent', 'p-amber')) + '</div>'
both('Handover-Accept', 'Amina K. offers you 6 tables', 'waiter', 'Hand over: the colleague accepts on their own screen', '/waiter/floor#hand-over', 'U4, needs E3',
     f'<div class="hstack g12"><span class="av">AK</span><p class="t-body grow">Amina K. is ending her shift. Her tables, with UGX 333,000 open, become yours when you accept.</p></div>{acc}',
     sfoot(btn('Say no', 'textbtn'), btn('Accept 6 tables', 'filled', 'min-width: 260px')),
     f'<p class="t-body">Her tables, with UGX 333,000 open, become yours.</p>{acc}', '<div class="vstack g4">' + btn('Accept 6 tables', 'filled') + btn('Say no', 'textbtn') + '</div>',
     sub='Sent 22:49 · she waits for your answer', bg=bfloor, pbg=bphone, tcls='mid')

# 11 move a line
OPEN = [('2', 'You · 4 guests'), ('9', 'You · 2 guests'), ('17', 'You · 4 guests'), ('6', 'You'), ('3', 'Brian O.'), ('13', 'Grace N.')]
both('Line-Move', 'Move Chicken wings', 'waiter', 'Move a line to the right table, with no void', R + '#move-line', 'U3, needs E3',
     f'<p class="lab">To which table</p>{joingrid(OPEN, 3, ["17"])}<p class="t-sup muted">Nothing is voided and no stock moves. The kitchen ticket now says table 17. Table 12’s bill becomes UGX 74,000; table 17’s becomes UGX 69,000.</p>',
     sfoot(btn('Cancel', 'textbtn'), btn('Move to table 17', 'filled', 'min-width: 260px')),
     f'{joingrid(OPEN[:4], 2, ["17"])}<p class="t-sup muted">Nothing is voided. Table 12’s bill becomes UGX 74,000.</p>', btn('Move to table 17', 'filled'),
     sub='Sent 19:42 · UGX 24,000 · entered on the wrong table')

# 12 cancel the order (supervisor)
both('Order-Cancel', 'Cancel table 12’s order', 'supervisor', 'Cancel the whole order: every line voided with one reason', '/supervisor/floor?tableId=#cancel', 'U3, needs E1',
     f'<div><p class="lab">Was anything made?</p>{seg(["Nothing made, back to stock", "All made, it is waste", "Some made"], "Nothing made, back to stock", True)}</div><div><p class="lab">Why</p>{optgrid(["Guests left before food", "Opened on the wrong table", "Guest complaint", "Something else"], 4, "Opened on the wrong table")}</div><div class="hstack g16"><div class="grow"><p class="lab">Note</p><div class="field sm ph">Anything the manager should know</div></div></div><p class="t-sup muted">All 6 lines, 8 items, are voided with your name and reason. The kitchen and bar see them struck through. Table 12 becomes free. Nothing is deleted.</p>',
     sfoot(btn('Keep the order', 'textbtn'), btn('Cancel the order · UGX 98,000', 'filled', 'min-width: 320px')),
     f'<p class="lab" style="margin: 0">Was anything made?</p>{seg(["None made", "All made", "Some made"], "None made", True)}<p class="lab" style="margin: 0">Why</p>{optgrid(["Guests left", "Wrong table", "Complaint", "Something else"], 2, "Wrong table")}<p class="t-sup muted">6 lines voided with your name. Table 12 becomes free.</p>',
     btn('Cancel the order · UGX 98,000', 'filled'), sub='8 items, all sent · Amina K.’s table', bg=sbg)

# 13 supervisor PIN pad on a waiter's screen
pinbody = f'''<div class="hstack g24" style="align-items: flex-start">
      <div class="vstack g12 grow"><div class="card" style="box-shadow: none; background: var(--canvas); padding: 14px 16px">{kv("Asked by", "Amina K.")}{kv("Void", "1 Chicken wings")}{kv("Value", "UGX 24,000")}{kv("Reason", "Guest changed their mind")}</div><p class="t-sup muted">Any supervisor on shift types their own PIN here. Their name goes on the void with Amina K.’s.</p>{btn("Send to Approvals instead", "tonal")}</div>
      <div class="vstack g12" style="width: 330px; flex: none">{pin(1)}{keypad(h=64)}</div></div>'''
both('Supervisor-PIN-Pad', 'A supervisor’s PIN is needed', 'waiter', 'A supervisor types their PIN on the waiter’s screen to approve', R + '#approve', 'U3, needs E9',
     pinbody, '',
     f'<div class="card" style="box-shadow: none; background: var(--canvas); padding: 8px 14px">{kv("Void", "1 Chicken wings · 24,000")}{kv("Asked by", "Amina K.")}</div>{pin(1)}{keypad(h=56)}<button class="btn textbtn">Send to Approvals instead</button>',
     '', sub='Void after it was sent · table 12', tcls='mid')
