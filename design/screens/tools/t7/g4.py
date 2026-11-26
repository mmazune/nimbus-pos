from base import *
G = 4
T, P = (1280, 800), (390, 844)
R = '/cashier/floor?tableId='
METH = [('cash', 'Cash', 'Notes and coins'), ('phone', 'Mobile money', 'On their phone'), ('card', 'Card', 'Card machine'), ('split', 'Split', 'Two ways or more')]
def methods(on, cols=4, xl=True):
    c = 'opt xl' if xl else 'opt tall'
    return f'<div class="optgrid" style="grid-template-columns: repeat({cols}, minmax(0, 1fr))">' + ''.join(
        f'<button class="{c}{" on" if l == on else ""}">{ic(i, "l") if xl else ""}<span>{l}</span><small>{s}</small></button>' for i, l, s in METH) + '</div>'
def bill_aside(groups=T12, total='98,000', label='Total', extra='', title='Bill', count='8 items'):
    return f'''    <aside class="check" aria-label="{title}">
      <div class="hstack" style="padding: 16px 16px 8px; justify-content: space-between"><h2 class="t-h">{title}</h2><span class="t-sup muted">{count}</span></div>
      {lines(groups)}
      <span class="grow"></span>{extra}
      <div class="hr"></div>
      <div class="tot" style="padding: 14px 16px 16px"><span class="t-row">{label}</span><span class="t-h">UGX {total}</span></div>
    </aside>'''
def pay(name, title, shows, ms, main, aside=None, sub='Table 12 · 3 guests · served by Amina K.', back='Table 12', role='cashier'):
    body = obar(title, sub, role, back=back, search=None) + f'''
  <div class="ord" style="grid-template-columns: minmax(0, 1fr) 372px">
    <main class="menu" style="gap: 18px; padding: 20px 24px">{main}</main>
{aside or bill_aside()}
  </div>'''
    page(name, *T, title, body, G, role.capitalize(), shows, R + '#pay', ms)
def ppay(name, title, shows, ms, body, foot, sub='Table 12 · UGX 98,000', role='Cashier', over=''):
    page(name + '-Phone', *P, title + ', phone', rband(title, sub, more=False) + f'\n  <main class="body" style="gap: 14px">{body}</main>\n  <footer class="foot">{foot}</footer>{over}', G, role, shows + ', phone', R + '#pay', ms)
topay = lambda amt='98,000', cap='To pay': f'<div><p class="cap">{cap}</p><p class="big" style="margin-top: 4px">UGX {amt}</p></div>'
note = lambda t: f'<p class="t-small muted" style="text-align: center">{t}</p>'
bigbtn = lambda t: btn(t, 'filled', 'height: 64px; font-size: 18px; width: 100%')

# 1 mobile money by reference
mm = f'''<div class="hstack g24" style="align-items: flex-start"><div class="grow vstack g16">{topay()}<div><p class="lab">How are they paying?</p>{methods("Mobile money")}</div>
      <div class="hstack g16"><div class="grow"><p class="lab">Network</p>{seg(["MTN MoMo", "Airtel Money"], "MTN MoMo", True)}</div><div class="grow"><p class="lab">They pay to</p><div class="field">Merchant 400 112 · Tapas</div></div></div>
      <div><label class="lab">Reference from the guest’s message</label><div class="field" style="font-weight: 700; letter-spacing: .04em">QK7H 2M9P 1A</div></div></div></div>
      <span class="grow"></span>
      <div class="vstack g8"><div class="hstack g12">{btn("No message yet · wait for it", "tonal", "flex: 1 1 0; height: 64px")}{btn("Record UGX 98,000 by mobile money", "filled", "flex: 2 1 0; height: 64px; font-size: 18px")}</div>{note("Check the message names Tapas and shows 98,000. The receipt prints and table 12 becomes free.")}</div>'''
pay('Pay-Mobile-Money', 'Take payment', 'Mobile money by reference: the cashier types the code from the guest’s message', 'U3, needs E13', mm)
ppay('Pay-Mobile-Money', 'Take payment', 'Mobile money by reference', 'U3, needs E13',
     f'{methods("Mobile money", 2, False)}{seg(["MTN MoMo", "Airtel Money"], "MTN MoMo", True)}<div><p class="lab">They pay to</p><div class="field">Merchant 400 112 · Tapas</div></div><div><label class="lab">Reference from their message</label><div class="field" style="font-weight: 700; letter-spacing: .04em">QK7H 2M9P 1A</div></div>{btn("No message yet · wait for it", "tonal")}',
     btn('Record UGX 98,000', 'filled', 'flex: 1 1 0'))

# 2 pending
pend = f'''{topay()}
      <div class="card vstack g12" style="padding: 20px; background: var(--amber-t); box-shadow: none; color: var(--amber)">
        <div class="hstack">{ic("clock", "l")}<div class="grow"><p class="t-h">Waiting for the guest’s money</p><p class="t-body">MTN MoMo · UGX 98,000 · since 20:51, 3 minutes</p></div>{pill("Pending", "p-amber")}</div>
        <p class="t-sup">Table 12 shows “Paying” on the floor. Nothing is counted in the till until you enter the reference. After 10 minutes the supervisor is told.</p>
      </div>
      <div><label class="lab">Reference, when their message arrives</label><div class="field ph">Type the code from the guest’s message</div></div>
      <span class="grow"></span>
      <div class="vstack g8"><div class="hstack g12">{btn("Change the method", "tonal", "flex: 1 1 0; height: 64px")}{btn("Record · type the reference first", "off", "flex: 2 1 0; height: 64px; font-size: 18px")}</div>{note("Still pending when the day closes? It is on the close list until it is settled.")}</div>'''
pay('Pay-Mobile-Pending', 'Take payment', 'Mobile money pending: no confirmation yet, the table shows Paying', 'U3, needs E13', pend)
ppay('Pay-Mobile-Pending', 'Paying', 'Mobile money pending', 'U3, needs E13',
     f'<div class="card vstack g8" style="padding: 16px; background: var(--amber-t); box-shadow: none; color: var(--amber)"><div class="hstack">{ic("clock")}<p class="t-row grow">Waiting for the money</p>{pill("Pending", "p-amber")}</div><p class="t-sup">MTN MoMo · UGX 98,000 · since 20:51. Table 12 shows “Paying”. The supervisor is told after 10 minutes.</p></div><div><label class="lab">Reference, when it arrives</label><div class="field ph">Code from their message</div></div>{btn("Change the method", "tonal")}',
     btn('Record · type the reference first', 'off', 'flex: 1 1 0'), sub='Table 12 · UGX 98,000 · pending')

# 3 card by reference
cd = f'''<div class="hstack g24" style="align-items: flex-start"><div class="grow vstack g16">{topay()}<div><p class="lab">How are they paying?</p>{methods("Card")}</div>
      <div class="card" style="padding: 16px 20px"><p class="t-row">1. Type UGX 98,000 on the card machine</p><p class="t-row" style="margin-top: 8px">2. When the slip prints, type its approval code</p></div>
      <div class="hstack g16"><div class="grow"><label class="lab">Approval code on the slip</label><div class="field" style="font-weight: 700; letter-spacing: .04em">482 913</div></div><div style="width: 220px"><p class="lab">Last 4 digits</p><div class="field">4471</div></div></div></div></div>
      <span class="grow"></span>
      <div class="vstack g8">{bigbtn("Record UGX 98,000 by card")}{note("Declined on the machine? Record nothing and pick another way. The card machine is not linked to the till yet.")}</div>'''
pay('Pay-Card', 'Take payment', 'Card by reference: run it on the machine, type the approval code', 'U3', cd)
ppay('Pay-Card', 'Take payment', 'Card by reference', 'U3',
     f'{methods("Card", 2, False)}<div class="card" style="padding: 14px 16px"><p class="t-body b">1. Type 98,000 on the card machine</p><p class="t-body b" style="margin-top: 6px">2. Type the approval code from the slip</p></div><div><label class="lab">Approval code</label><div class="field" style="font-weight: 700; letter-spacing: .04em">482 913</div></div><p class="t-sup muted">Declined? Record nothing, pick another way.</p>',
     btn('Record UGX 98,000 by card', 'filled', 'flex: 1 1 0'))

# 4 split payment, part paid
paidrows = f'<div class="card" style="overflow: hidden">{row("Cash · 20:52", "50,000 · no change", pill("Paid", "p-green"), ic("cash"), False)}{row("Mobile money · 20:53", "10,000 · MTN MoMo · ref TR4X 8L2K", pill("Paid", "p-green"), ic("phone"), False)}</div>'
sp = f'''<div class="hstack g24"><div class="grow">{topay("38,000", "Left to pay")}<p class="t-sup muted" style="margin-top: 4px">Bill UGX 98,000 · paid 60,000 in 2 parts</p></div><div class="bar-s" style="width: 280px; height: 8px"><i style="width: 61%"></i></div></div>
      {paidrows}
      <div><p class="lab">How do they pay the rest?</p>{methods("Card")}</div>
      <span class="grow"></span>
      <div class="vstack g8">{bigbtn("Record UGX 38,000 by card")}{note("Table 12 shows “Part paid” until the last shilling. Card: the approval code is asked next, as for any card payment.")}</div>'''
pay('Pay-Split-Part', 'Take payment', 'Split payment part-paid: what is paid, what is left, the next method', 'U3', sp)
ppay('Pay-Split-Part', 'Take payment', 'Split payment part-paid', 'U3',
     f'{topay("38,000", "Left to pay")}<p class="t-sup muted">Paid 60,000 of 98,000 in 2 parts</p>{paidrows}{methods("Card", 2, False)}',
     btn('Record UGX 38,000 by card', 'filled', 'flex: 1 1 0'), sub='Table 12 · part paid')

# 5 paid, with the receipt
def receipt(pad='20px 20px 16px'):
    ls = ''.join(f'<div class="line" style="padding: 5px 0; min-height: 0"><span class="t-body" style="width: 24px">{q}</span><span class="grow t-body">{n}</span><span class="pr">{p}</span></div>' for q, n, p in [(2, 'Lager 500 ml', '12,000'), (1, 'Blended Scotch, double, cola', '15,000'), (1, 'Cola 300 ml', '3,000'), (1, 'Beef burger', '28,000'), (2, 'Chips', '16,000'), (1, 'Chicken wings', '24,000')])
    return f'''<div class="card" style="padding: {pad}">
      <p class="t-row" style="text-align: center">Tapas Downtown</p><p class="t-small muted" style="text-align: center">Receipt 0431 · table 12 · Amina K. · 26 Nov 2026, 20:54</p>
      <div class="hr" style="margin: 12px 0 6px"></div>{ls}<div class="hr" style="margin: 6px 0 10px"></div>
      <div class="tot"><span class="t-row">Total</span><span class="t-row">UGX 98,000</span></div>
      <div class="tot" style="margin-top: 6px"><span class="t-sup muted">Cash given</span><span class="t-sup">100,000</span></div>
      <div class="tot"><span class="t-sup muted">Change</span><span class="t-sup">2,000</span></div>
      <p class="t-small muted" style="margin-top: 8px; text-align: center">Taken by Sarah M., till 1</p></div>'''
done = f'''<div class="hstack g24" style="align-items: stretch; flex: 1 1 0; min-height: 0">
      <div class="grow vstack g16" style="justify-content: center; align-items: center; text-align: center">
        <span class="bubble" style="width: 96px; height: 96px; background: var(--green-t); color: var(--green)">{ic("check", "l")}</span>
        <p class="t-title">Paid · UGX 98,000</p>
        <div class="card" style="padding: 18px 28px; background: var(--green-t); box-shadow: none"><p class="t-row" style="color: var(--green)">Give UGX 2,000 change</p></div>
        <p class="t-body muted">Table 12 is free. The receipt printed at the front desk and is kept under Receipts.</p>
        <div class="hstack">{btn("Print again", "tonal", icon="print")}{btn("Back to the floor", "filled", "min-width: 240px")}</div>
      </div>
      <div style="width: 380px; flex: none">{receipt()}</div></div>'''
page('Pay-Paid', *T, 'Paid, with the receipt', obar('Paid', 'Table 12 · receipt 0431', 'cashier', back='Floor', search=None) + f'\n  <main class="page" style="padding: 24px 32px">{done}</main>', G, 'Cashier', 'Paid: change to give, the table is free, the receipt', R + '#paid', 'U3, needs E1')
page('Pay-Paid-Phone', *P, 'Paid, phone', rband('Paid', 'Table 12 · receipt 0431', more=False) + f'''
  <main class="body" style="gap: 12px"><div class="card hstack" style="padding: 16px; background: var(--green-t); box-shadow: none; color: var(--green)">{ic("check", "l")}<div class="grow"><p class="t-row">Paid · UGX 98,000</p><p class="t-sup">Give UGX 2,000 change. Table 12 is free.</p></div></div>{receipt("16px")}</main>
  <footer class="foot">{btn("Print again", "tonal", "flex: 1 1 0")}{btn("Back to the floor", "filled", "flex: 1.6 1 0")}</footer>''', G, 'Cashier', 'Paid on a phone', R + '#paid', 'U3, needs E1')

# 6 bill changed since printing
ADDED = ('Added after the bill was printed', '', [(1, 'Chocolate cake', '20:55 · Amina K.', '14,000')])
chg = f'''{banner("The bill changed after it was printed", "Printed at 20:47 for UGX 98,000. 1 Chocolate cake was added at 20:55.", "", "amber", "warn")}
      <div class="hstack g16"><div class="card grow" style="padding: 18px 20px"><p class="cap">Printed bill</p><p class="t-h" style="margin-top: 4px; text-decoration: line-through; color: var(--muted)">UGX 98,000</p></div><div class="card grow" style="padding: 18px 20px"><p class="cap">To pay now</p><p class="big" style="margin-top: 4px">UGX 112,000</p></div></div>
      <div><p class="lab">How are they paying?</p>{methods("Cash")}</div>
      <span class="grow"></span>
      <div class="vstack g8"><div class="hstack g12">{btn("Print the new bill", "tonal", "flex: 1 1 0; height: 64px", icon="print")}{btn("Take UGX 112,000 in cash", "filled", "flex: 2 1 0; height: 64px; font-size: 18px")}</div>{note("Tell the guest the new total before taking payment. Bills changed after printing are listed on the exceptions report.")}</div>'''
pay('Pay-Bill-Changed', 'Take payment', '“Bill changed”: the printed total and the new one side by side', 'U3, needs E4 and E10', chg, bill_aside([ADDED, T12[0], T12[1]], '112,000', count='9 items'))
ppay('Pay-Bill-Changed', 'Take payment', '“Bill changed” on a phone', 'U3, needs E4 and E10',
     f'{banner("Bill changed after printing", "Printed 20:47 for 98,000. Chocolate cake added 20:55.", "", "amber", "warn")}<div class="card" style="padding: 14px 16px">{kv("Printed bill", "UGX 98,000", False)}{kv("To pay now", "UGX 112,000")}</div>{methods("Cash", 2, False)}{btn("Print the new bill", "tonal", icon="print")}',
     btn('Take UGX 112,000', 'filled', 'flex: 1 1 0'), sub='Table 12 · UGX 112,000')

# 7 refund asks for a supervisor (on Receipts)
recbg = tbar('Receipts', 'Paid bills today · 96 · UGX 4,860,000 · as at 20:58', 'cashier').replace('<header class="bar tall">', '<header class="bar tall" inert>') + f'''
  <main class="page" style="padding: 16px 24px" inert><div class="card" style="overflow: hidden"><table class="dt"><thead><tr><th>Bill</th><th>Table</th><th>Waiter</th><th>Paid</th><th>How</th><th class="num">UGX</th></tr></thead><tbody><tr class="sel"><td>0418</td><td>Table 16</td><td>Brian O.</td><td>19:38</td><td>Mobile money</td><td class="num">38,000</td></tr><tr><td>0417</td><td>Tab 2</td><td>David S.</td><td>19:35</td><td>Cash</td><td class="num">24,000</td></tr><tr><td>0416</td><td>Table 30</td><td>Brian O.</td><td>19:33</td><td>Card</td><td class="num">143,500</td></tr><tr><td>0415</td><td>Table 20</td><td>Grace N.</td><td>19:28</td><td>Cash</td><td class="num">59,000</td></tr></tbody></table></div></main>
{navbar("cashier", "Receipts").replace('<nav class="navbar"', '<nav inert class="navbar"')}'''
REFL = '<div class="card" style="overflow: hidden">' + row('Chicken wings', '1 · UGX 24,000', '<span class="round sm" style="width: 32px; height: 32px; background: var(--primary); color: var(--on-primary)">' + ic('check', 's') + '</span>', style='background: var(--tonal)') + row('Lager 500 ml', '2 · UGX 12,000') + row('Water 500 ml', '1 · UGX 2,000') + '</div>'
rbody = f'''<div class="hstack g24" style="align-items: flex-start"><div class="grow vstack g16"><div><p class="lab">What goes back</p>{REFL}</div><div><p class="lab">Why</p>{optgrid(["Guest complaint", "Charged twice", "Item never came", "Something else"], 2, "Guest complaint")}</div><div><p class="lab">Money goes back by</p>{seg(["Mobile money, as paid", "Cash"], "Mobile money, as paid", True)}</div></div>
    <div class="vstack g12" style="width: 300px; flex: none"><p class="t-row" style="text-align: center">A supervisor’s PIN</p>{pin(0)}{keypad(h=60)}</div></div>'''
page('Refund-Supervisor', *T, 'Refund, a supervisor’s PIN', recbg + scrim() + sheet('Refund from bill 0418', 'Table 16 · Brian O. · paid 19:38 · UGX 38,000', rbody, sfoot(btn('Cancel', 'textbtn'), btn('Refund UGX 24,000 · after the PIN', 'off', 'min-width: 320px')), 'mid'),
     G, 'Cashier', 'Refund from a paid bill: lines, reason, a supervisor’s PIN on the spot', '/cashier/receipts#refund', 'U3, needs E9')
precbg = band('Receipts', 'Paid today · 96').replace('<header class="band">', '<header inert class="band">') + '<main class="body" inert></main>' + navbar('cashier', 'Receipts', True).replace('<nav class="tabbar"', '<nav inert class="tabbar"')
page('Refund-Supervisor-Phone', *P, 'Refund, phone', precbg + scrim() + sheet('Refund from bill 0418', 'Chicken wings · UGX 24,000 · guest complaint', f'{kv("Goes back by", "Mobile money, as paid")}<p class="t-sup muted">Same day: a supervisor types their PIN here. Later: the manager.</p>{pin(0)}{keypad(h=56)}', btn('Refund UGX 24,000 · after the PIN', 'off'), gap=12),
     G, 'Cashier', 'Refund asking for a supervisor on a phone', '/cashier/receipts#refund', 'U3, needs E9')

# 8 walk‑out (manager)
wbg = obar('Table 19', 'David S.’s table · 3 guests · open 2 h 10 · last order 21:05', 'manager', back='Floor').replace('<header class="bar">', '<header class="bar" inert>') + f'''
  <div class="ord" style="grid-template-columns: minmax(0, 1fr) 372px" inert>
{menu(FOODG, "Popular", POP, 4)}
{check(lines([("Sent 19:35", "sent", [(1, "Grilled tilapia", "", "38,000"), (1, "Goat stew", "", "26,000"), (1, "Water 500 ml", "", "2,000")])]), "66,000", MORE + btn("Take payment", "tonal", "flex: 1 1 0"), count="3 items")}
  </div>'''
wb = f'''<div><p class="lab">What happened</p>{optgrid(["Left without paying", "Left while the bill was printed", "Something else"], 2, "Left without paying")}</div>
    <div class="hstack g16"><div class="grow"><label class="lab">Last seen</label><div class="field">About 21:40, by the terrace door</div></div><div class="grow"><label class="lab">Note</label><div class="field ph">Anything that helps later</div></div></div>
    <p class="t-sup muted">The table closes and frees. UGX 66,000 is counted as a walk‑out, not as a sale or a discount, with your name and reason. Nothing is deleted; the stock used stays used.</p>'''
page('Walk-Out', *T, 'Close as a walk‑out', wbg + scrim() + sheet('Close table 19 as a walk‑out', 'UGX 66,000 unpaid · David S.’s table · manager only', wb, sfoot(btn('Keep it open', 'textbtn'), btn('Close as walk‑out · UGX 66,000', 'filled', 'min-width: 320px')), 'mid'),
     G, 'Manager', 'Walk-out: the manager closes an unpaid table with a reason', '/manager/operations/floor?tableId=#walk‑out', 'U3, needs E13')
pwbg = rband('Table 19', 'David S. · UGX 66,000').replace('<header class="band"', '<header inert class="band"') + '<main class="body" inert></main>'
page('Walk-Out-Phone', *P, 'Close as a walk‑out, phone', pwbg + scrim() + sheet('Close table 19 as a walk‑out', 'UGX 66,000 unpaid · manager only', f'{optgrid(["Left without paying", "Left at the bill", "Something else"], 2, "Left without paying")}<div><label class="lab">Last seen</label><div class="field">About 21:40, terrace door</div></div><div><label class="lab">Note</label><div class="field ph">Anything that helps later</div></div><p class="t-sup muted">Counted as a walk‑out, not a sale or a discount. Nothing is deleted.</p>', btn('Close as walk‑out · UGX 66,000', 'filled')),
     G, 'Manager', 'Walk-out on a phone', '/manager/operations/floor?tableId=#walk‑out', 'U3, needs E13')
