from base import *
G = 11
T, P = (1280, 800), (390, 844)
def sk(w, h=16, r=8, style=''): return f'<span class="skel" style="width: {w}; height: {h}px; border-radius: {r}px{";" + style if style else ""}"></span>'
def state(icon, title, text, action='', tone='brand', pad='32px'):
    bg = {'brand': 'var(--tonal)', 'red': 'var(--red-t)'}[tone]; fg = {'brand': 'var(--primary)', 'red': 'var(--red)'}[tone]
    return f'<div class="card vstack g12" style="padding: {pad}; align-items: center; text-align: center"><span class="bubble" style="width: 72px; height: 72px; background: {bg}; color: {fg}">{ic(icon, "l")}</span><p class="t-h">{title}</p><p class="t-body muted" style="max-width: 460px">{text}</p>{action}</div>'
REC = '/cashier/receipts'

# ---------- list: Receipts ----------
def rec_t(main, aside, sub):
    return tbar('Receipts', sub, 'cashier') + f'''
  <main class="page" style="padding: 16px 24px; flex-direction: row; gap: 20px">
    <section class="grow vstack g16"><div class="hstack"><span class="field ph grow">{ic("search", "s")}Find a bill by number, table or amount</span>{seg(["Today", "Earlier"], "Today")}</div>{main}</section>
    {aside}
  </main>
{navbar("cashier", "Receipts")}'''
def rec_p(main, sub):
    return band('Receipts', sub, rbtn('search', 'Find a bill')) + f'<main class="body">{seg(["Today", "Earlier"], "Today", True)}{main}</main>' + navbar('cashier', 'Receipts', True)
emptyaside = '<aside style="width: 420px; flex: none"></aside>'
e = state('receipt', 'No paid bills yet today', 'A bill appears here the moment it is paid. The first table of the day has not paid yet. Yesterday’s bills are under Earlier.', btn('Look at earlier days', 'tonal'))
center = lambda x: f'<div style="align-self: center; width: 640px; margin-top: 48px">{x}</div>'
page('State-List-Empty', *T, 'Receipts, empty', rec_t(center(e), '', 'Paid bills today · 0 · as at 12:05'), G, 'Cashier', 'Empty list: why it is empty, and the way forward', REC, 'U3')
page('State-List-Empty-Phone', *P, 'Receipts, empty, phone', rec_p(state('receipt', 'No paid bills yet today', 'A bill appears here the moment it is paid. Yesterday’s are under Earlier.', btn('Look at earlier days', 'tonal'), pad='24px'), 'Today · 0 · as at 12:05'), G, 'Cashier', 'Empty list on a phone', REC, 'U3')
skrow = lambda: f'<div class="row" style="width: 100%">{sk("64px")}{sk("80px")}<span class="grow"></span>{sk("110px")}{sk("72px")}</div>'
load = '<div class="card" style="overflow: hidden">' + ''.join(skrow() for _ in range(8)) + '</div>'
laside = f'<aside class="card vstack g12" style="width: 420px; padding: 20px; flex: none">{sk("60%", 24)}{sk("80%")}{"".join(sk("100%", 20) for _ in range(5))}</aside>'
page('State-List-Loading', *T, 'Receipts, loading', rec_t(load, laside, 'Paid bills today · loading'), G, 'Cashier', 'Loading list: header and bar at once, grey shapes in the final places, no spinner', REC, 'U3')
pload = '<div class="card" style="overflow: hidden">' + ''.join(f'<div class="row" style="width: 100%"><span class="vstack g8 grow">{sk("50%")}{sk("70%", 12)}</span>{sk("72px")}</div>' for _ in range(7)) + '</div>'
page('State-List-Loading-Phone', *P, 'Receipts, loading, phone', rec_p(pload, 'Today · loading'), G, 'Cashier', 'Loading list on a phone', REC, 'U3')
err = state('wifi', 'Receipts could not load', 'The bills are safe; this screen could not reach them. Tables can still be paid from the Floor.', btn('Try again', 'filled', 'min-width: 200px'), 'red')
page('State-List-Error', *T, 'Receipts, error', rec_t(center(err), '', 'Paid bills today · not loaded'), G, 'Cashier', 'Error on a list: what happened, what is safe, Try again', REC, 'U3')
page('State-List-Error-Phone', *P, 'Receipts, error, phone', rec_p(state('wifi', 'Receipts could not load', 'The bills are safe. Tables can still be paid from the Floor.', btn('Try again', 'filled'), 'red', '24px'), 'Today · not loaded'), G, 'Cashier', 'Error on a list, phone', REC, 'U3')

# ---------- detail: an order ----------
def ord_t(left, right, sub='3 guests · open 1 h 05 · Amina K.'):
    return obar('Table 12', sub, 'waiter') + f'''
  <div class="ord" style="grid-template-columns: minmax(0, 1fr) 372px">
    <main class="menu">{left}</main>
    <aside class="check" aria-label="Order">{right}</aside>
  </div>'''
menuleft = f'{seg(["Food", "Drinks"], "Food").replace("<button class=", "<button style=\"min-width: 140px\" class=")}{optgrid(FOODG, 8, "Popular")}<div class="items" style="grid-template-columns: repeat(4, minmax(0, 1fr))">' + ''.join(f'<button class="item"><b>{n}</b><span>{p}</span></button>' for n, p in POP[:16]) + '</div>'
emptycheck = f'<div class="hstack" style="padding: 16px 16px 8px"><h2 class="t-h">Order</h2></div><div class="vstack g12" style="padding: 40px 24px; align-items: center; text-align: center"><span class="bubble" style="width: 72px; height: 72px">{ic("receipt", "l")}</span><p class="t-row">Nothing ordered yet</p><p class="t-sup muted">Tap an item on the left. Nothing is saved until you send.</p></div><span class="grow"></span><div class="hstack g8" style="padding: 12px 16px 16px">{btn("Send", "off", "flex: 1 1 0")}</div>'
page('State-Detail-Empty', *T, 'Order, empty', ord_t(menuleft, emptycheck, 'Free · 4 seats · Amina K.').replace('Table 12', 'Table 8'), G, 'Waiter', 'Empty detail: a free table’s order, nothing yet, Send waits', '/waiter/floor?tableId=', 'U2')
page('State-Detail-Empty-Phone', *P, 'Order, empty, phone', rband('Table 8', 'Free · 4 seats') + f'<main class="body">{state("receipt", "Nothing ordered yet", "Open the menu and tap an item. Nothing is saved until you send.", btn("Open the menu", "tonal"), pad="24px")}</main><footer class="foot">{btn("Send", "off", "flex: 1 1 0")}</footer>', G, 'Waiter', 'Empty detail on a phone', '/waiter/floor?tableId=', 'U2')
skmenu = f'{seg(["Food", "Drinks"], "Food").replace("<button class=", "<button style=\"min-width: 140px\" class=")}<div class="optgrid" style="grid-template-columns: repeat(8, minmax(0, 1fr))">' + ''.join(sk('100%', 48, 12) for _ in range(16)) + '</div><div class="items" style="grid-template-columns: repeat(4, minmax(0, 1fr))">' + ''.join(sk('100%', 96, 14) for _ in range(12)) + '</div>'
skcheck = f'<div class="hstack" style="padding: 16px 16px 8px"><h2 class="t-h">Order</h2></div><div class="vstack g16" style="padding: 12px 16px">' + ''.join(f'<div class="hstack">{sk("28px", 28)}{sk("55%")}<span class="grow"></span>{sk("56px")}</div>' for _ in range(6)) + '</div>'
page('State-Detail-Loading', *T, 'Order, loading', ord_t(skmenu, skcheck), G, 'Waiter', 'Loading detail: the table and its frame at once, grey shapes for lines and menu', '/waiter/floor?tableId=', 'U2')
page('State-Detail-Loading-Phone', *P, 'Order, loading, phone', rband('Table 12', '3 guests · open 1 h 05') + '<main class="body"><div class="card vstack g16" style="padding: 16px">' + ''.join(f'<div class="hstack">{sk("28px", 28)}{sk("55%")}<span class="grow"></span>{sk("56px")}</div>' for _ in range(6)) + f'</div></main><footer class="foot">{sk("100%", 52, 14)}</footer>', G, 'Waiter', 'Loading detail on a phone', '/waiter/floor?tableId=', 'U2')
errcheck = f'<div class="hstack" style="padding: 16px 16px 8px"><h2 class="t-h">Order</h2></div><div class="vstack g12" style="padding: 32px 24px; align-items: center; text-align: center"><span class="bubble" style="width: 72px; height: 72px; background: var(--red-t); color: var(--red)">{ic("warn", "l")}</span><p class="t-row">Table 12’s order could not open</p><p class="t-sup muted">The 8 items sent at 19:42 and 20:15 are safe on the server. Do not take a new order for this table until it opens.</p>{btn("Try again", "filled", "min-width: 200px")}</div><span class="grow"></span>'
page('State-Detail-Error', *T, 'Order, error', ord_t(menuleft.replace('<div class="items"', '<div inert class="items"'), errcheck), G, 'Waiter', 'Error on a detail: what is safe, what not to do, Try again', '/waiter/floor?tableId=', 'U2')
page('State-Detail-Error-Phone', *P, 'Order, error, phone', rband('Table 12', '3 guests · open 1 h 05') + f'<main class="body">{state("warn", "Table 12’s order could not open", "The 8 items already sent are safe. Do not start a new order for this table.", btn("Try again", "filled"), "red", "24px")}</main>', G, 'Waiter', 'Error on a detail, phone', '/waiter/floor?tableId=', 'U2')

# ---------- sheet: discount ----------
def obg():
    return obar('Table 12', '3 guests · open 1 h 05 · Amina K.', 'waiter').replace('<header class="bar">', '<header class="bar" inert>') + f'''
  <div class="ord" style="grid-template-columns: minmax(0, 1fr) 372px" inert>
    <main class="menu">{menuleft}</main>
{check(lines(T12), "98,000", MORE + btn("Print bill", "tonal", "flex: 1 1 0"))}
  </div>'''
pbg = rband('Table 12', '3 guests · UGX 98,000').replace('<header class="band"', '<header inert class="band"') + f'<main class="body" inert><div class="card" style="overflow: hidden">{lines(T12)}</div></main>'
se = state('pct', 'No named discounts yet', 'The manager sets up named discounts (Birthday, Happy hour) in Settings. For another amount, a supervisor types their PIN here.', btn('Ask a supervisor for another amount', 'tonal'), pad='24px').replace('class="card vstack g12"', 'class="vstack g12"')
page('State-Sheet-Empty', *T, 'Discount sheet, empty', obg() + scrim() + sheet('Discount on table 12', 'UGX 98,000', se, '', 'wide'), G, 'Waiter', 'Empty sheet: no named discounts set up, and the way forward', '/waiter/floor?tableId=#discount', 'U3, needs E9')
page('State-Sheet-Empty-Phone', *P, 'Discount sheet, empty, phone', pbg + scrim() + sheet('Discount on table 12', 'UGX 98,000', se.replace('max-width: 460px', 'max-width: 320px'), ''), G, 'Waiter', 'Empty sheet on a phone', '/waiter/floor?tableId=#discount', 'U3, needs E9')
sl = f'<p class="lab">Which discount</p><div class="optgrid" style="grid-template-columns: repeat(3, minmax(0, 1fr))">' + ''.join(sk('100%', 64, 12) for _ in range(6)) + f'</div><div class="hstack g16">{sk("50%", 52, 14)}{sk("50%", 120, 14)}</div>'
page('State-Sheet-Loading', *T, 'Discount sheet, loading', obg() + scrim() + sheet('Discount on table 12', 'UGX 98,000', sl, sfoot(btn('Cancel', 'textbtn'), btn('Give a discount', 'off', 'min-width: 300px')), 'wide'), G, 'Waiter', 'Loading sheet: the sheet and its title at once, grey choices', '/waiter/floor?tableId=#discount', 'U3, needs E9')
page('State-Sheet-Loading-Phone', *P, 'Discount sheet, loading, phone', pbg + scrim() + sheet('Discount on table 12', 'UGX 98,000', '<div class="optgrid" style="grid-template-columns: repeat(2, minmax(0, 1fr))">' + ''.join(sk('100%', 64, 12) for _ in range(4)) + '</div>' + sk('100%', 40, 12), btn('Give a discount', 'off')), G, 'Waiter', 'Loading sheet on a phone', '/waiter/floor?tableId=#discount', 'U3, needs E9')
ser = state('warn', 'Discounts could not load', 'Nothing was given and the bill is still UGX 98,000. Try again, or ask a supervisor.', btn('Try again', 'filled', 'min-width: 200px'), 'red', '24px').replace('class="card vstack g12"', 'class="vstack g12"')
page('State-Sheet-Error', *T, 'Discount sheet, error', obg() + scrim() + sheet('Discount on table 12', 'UGX 98,000', ser, '', 'wide'), G, 'Waiter', 'Error in a sheet: nothing was given, Try again', '/waiter/floor?tableId=#discount', 'U3, needs E9')
page('State-Sheet-Error-Phone', *P, 'Discount sheet, error, phone', pbg + scrim() + sheet('Discount on table 12', 'UGX 98,000', ser.replace('max-width: 460px', 'max-width: 320px'), ''), G, 'Waiter', 'Error in a sheet, phone', '/waiter/floor?tableId=#discount', 'U3, needs E9')

# ---------- not connected, with held orders ----------
off = banner('Not connected · 3 orders held on this terminal', 'Keep taking orders. Held lines send themselves once, never twice, when the line is back. Payments by card and mobile money wait.', pill('Since 19:55', 'p-red'), 'red', 'wifi')
held = [t.replace('p-amber">Not sent', 'p-amber">Held').replace('3 items not sent', '3 items held') for t in MAIN_TILES]
held = [t.replace('<span class="pill p-brand">Open</span></span><span class="mid">4 guests · 14 min', '<span class="pill p-amber">Held</span></span><span class="mid">2 items held') if '>17<' in t else t for t in held]
held = [t.replace('<span class="pill p-brand">Open</span></span><span class="mid">2 guests · 9 min', '<span class="pill p-amber">Held</span></span><span class="mid">1 item held') if '>9<' in t else t for t in held]
body = tbar('Floor', 'Main hall · 17 of 32 tables open · as at 19:58', 'waiter', extra=pill('Not connected', 'p-red')) + f'''
  <main class="page" style="padding: 16px 32px 16px; gap: 12px">
    {off}
    <div class="hstack" style="justify-content: space-between">{areas()}{seg(["My tables · 6", "All tables"], "All tables")}</div>
{floor(held)}
  </main>
{navbar("waiter", "Floor")}'''
page('Offline-Held', *T, 'Not connected, held orders', body, G, 'Waiter', '“Not connected”: orders held on the terminal, tiles marked Held', '/waiter/floor', 'U1, needs E12')
pheld = [ptile(23, '3 items', 'Held', 'p-amber'), ptile(17, '2 items', 'Held', 'p-amber'), ptile(9, '1 item', 'Held', 'p-amber'), ptile(6, '26 min', 'Late', 'p-red'), ptile(12, '1 h 05', 'Bill', 'p-amber'), ptile(2, '42 min', 'Open', 'p-brand')]
body = band('Floor', '6 tables are yours · as at 19:58') + f'<main class="body">{banner("Not connected · 3 held", "Keep taking orders. They send once, by themselves, when the line is back.", "", "red", "wifi", "padding: 10px 12px")}{seg(["My tables · 6", "All tables"], "My tables · 6", True)}{floor(pheld, 3, "floor c")}</main>' + navbar('waiter', 'Floor', True)
page('Offline-Held-Phone', *P, 'Not connected, phone', body, G, 'Waiter', '“Not connected” on a phone', '/waiter/floor', 'U1, needs E12')
