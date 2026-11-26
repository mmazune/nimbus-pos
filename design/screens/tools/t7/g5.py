from base import *
G = 5
T, P = (1280, 800), (390, 844)
RS = '/supervisor/reservations'
BK = [('19:30', 'P. Achieng', '2 guests · Table 22', 'Late 12 min', 'p-red'), ('19:45', 'J. Mukasa', '6 guests · Table 5', 'Table still in use', 'p-amber'), ('20:00', 'R. Namara', '6 guests · Table 7', 'In 18 min', 'p-neutral'),
      ('20:30', 'S. Okello', '4 guests · Table 21', 'In 48 min', 'p-neutral'), ('20:30', 'D. Ssali', '8 guests · Table 27', 'In 48 min', 'p-neutral'), ('21:00', 'M. Atim', '2 guests · No table yet', 'Needs a table', 'p-amber'), ('21:15', 'T. Byaruhanga', '4 guests · VIP 2', 'In 1 h 33', 'p-neutral')]
def bkrows(items, sel=None, inert=False):
    return '<div class="card" style="overflow: hidden">' + ''.join(
        f'<button class="row" style="width: 100%; min-height: 76px;{" background: var(--canvas);" if n == sel else ""}"><span class="t-h" style="width: 76px">{t}</span><span class="grow"><span class="t-row">{n}</span><br><span class="t-sup muted">{s}</span></span><span class="pill {pc}">{p}</span></button>' for t, n, s, p, pc in items) + '</div>'
def resv(segon='Arriving · 7', left=None, aside='', inert=False, newbtn=True, sub='Today · 7 still to come · 1 late · as at 19:42'):
    a = ' inert' if inert else ''
    nb = btn('New reservation', 'tonal', icon='plus') if newbtn else ''
    hdr = tbar('Reservations', sub, 'supervisor')
    if inert: hdr = hdr.replace('<header class="bar tall">', '<header class="bar tall" inert>')
    return hdr + f'''
  <main class="page" style="padding: 16px 24px; flex-direction: row; gap: 20px"{a}>
    <section class="grow vstack g16">
      <div class="hstack" style="justify-content: space-between">{seg(["Arriving · 7", "Seated · 4", "Attention · 2", "History"], segon)}{nb}</div>
      {left if left is not None else bkrows(BK)}
    </section>
    {aside}
  </main>
{navbar("supervisor", "Reservations").replace('<nav class="navbar"', '<nav inert class="navbar"' if inert else '<nav class="navbar"')}'''
def presv(segon='Arriving', body=None, inert=False):
    a = ' inert' if inert else ''
    hd = band('Bookings', 'Today · 7 to come · 1 late · 19:42', rbtn('plus', 'New booking'))
    if inert: hd = hd.replace('<header class="band">', '<header inert class="band">')
    rows = body if body is not None else '<div class="card" style="overflow: hidden">' + ''.join(f'<button class="row" style="width: 100%"><span class="t-row" style="width: 56px">{t}</span><span class="grow"><span class="t-body b">{n}</span><br><span class="t-sup muted">{s}</span></span><span class="pill {pc}">{p.replace("Table still in use", "Table busy")}</span></button>' for t, n, s, p, pc in BK[:6]) + '</div>'
    return hd + f'''
  <main class="body"{a}>{seg(["Arriving", "Seated", "Attention", "History"], segon, True).replace('<button class=', '<button style="padding: 0 4px" class=')}{rows}</main>
{navbar("supervisor", "Reservations", True).replace('<nav class="tabbar"', '<nav inert class="tabbar"' if inert else '<nav class="tabbar"')}'''
def aside(content): return f'<aside class="card vstack g12" style="width: 420px; padding: 20px; flex: none">{content}</aside>'

# 1 Team
TEAM = [('AK', 'Amina K.', 'Waiter · Main hall', '6 tables', '1,240,000', 'On since 16:02'), ('BO', 'Brian O.', 'Waiter · Main hall', '4 tables', '986,000', 'On since 16:30'),
        ('DS', 'David S.', 'Waiter · Main hall, Bar', '4 tables', '871,500', 'On since 17:00'), ('JM', 'Joy M.', 'Waiter · Terrace', '1 table', '142,000', 'On since 19:30'),
        ('SM', 'Sarah M.', 'Cashier · Till 1', '—', '—', 'On since 15:55'), ('RA', 'Ruth A.', 'Chef · Hot kitchen', '8 tickets', '—', 'On since 15:00')]
tbl = '<div class="card" style="overflow: hidden"><table class="dt"><thead><tr><th>Who</th><th>Role and area</th><th>Open now</th><th class="num">Sold today</th><th>Shift</th></tr></thead><tbody>' + ''.join(
    f'<tr{" class=\"sel\"" if n == "Brian O." else ""}><td>{n}</td><td>{r}</td><td>{o}</td><td class="num">{"UGX " + s if s != "—" else s}</td><td class="muted">{sh}</td></tr>' for av, n, r, o, s, sh in TEAM) + '</tbody></table></div>'
mv = picks([('Table 3', '54,000'), ('Table 16', '38,000'), ('Table 24', '81,000'), ('Table 30', '143,500')], 2, ('Table 24', 'Table 30'))
team_aside = aside(f'''<div class="hstack"><span class="av">BO</span><div class="grow"><h2 class="t-h">Brian O.</h2><p class="t-sup muted">Waiter · on since 16:30 · 4 tables open</p></div></div>
      <div><p class="lab">Tables to move · 2 picked</p>{mv}</div>
      <div><p class="lab">To</p>{seg(["David S.", "Joy M.", "Amina K."], "Joy M.", True)}</div>
      <p class="t-sup muted">Both waiters are told. Sales already sent stay counted for Brian O.</p>
      <span class="grow"></span>{btn("Move 2 tables to Joy M.", "filled")}''')
body = tbar('Team', 'On shift now · 6 people · as at 20:10', 'supervisor') + f'''
  <main class="page" style="padding: 16px 24px; flex-direction: row; gap: 20px">
    <section class="grow vstack g16"><div class="hstack" style="justify-content: space-between">{seg(["On now · 6", "Later today · 3", "Off"], "On now · 6")}<span class="t-sup muted">Tap a person to see their tables</span></div>{tbl}</section>
    {team_aside}
  </main>
{navbar("supervisor", "Team")}'''
page('Supervisor-Team', *T, 'Team, supervisor', body, G, 'Supervisor', 'Team: who is on, their tables and sales; move tables between waiters', '/supervisor/team (new)', 'U4, needs E3')
prow = '<div class="card" style="overflow: hidden">' + ''.join(row(n, f'{o} · UGX {s}' if r.startswith('Waiter') else f'{r} · {s}', CHEV, av) for av, n, r, o, s, sh in TEAM[:6]) + '</div>'
body = band('Team', 'On shift now · 6 · as at 20:10') + f'<main class="body">{seg(["On now · 6", "Later · 3", "Off"], "On now · 6", True)}{prow}</main>' + navbar('supervisor', 'Team', True)
page('Supervisor-Team-Phone', *P, 'Team, supervisor, phone', body, G, 'Supervisor', 'Team on a phone: tap a person to move their tables', '/supervisor/team (new)', 'U4, needs E3')

# 2 Me
me = f'''<section class="card vstack g12" style="flex: 1 1 0; padding: 20px"><div class="hstack"><h2 class="t-h grow">My shift</h2><span class="pill p-green">On shift</span></div><p class="big">4 h 10</p><p class="t-sup muted">Started 16:00 at Front desk · Tapas Downtown</p><span class="grow"></span>{btn("End my shift", "tonal")}</section>
    <section class="card vstack g12" style="flex: 1 1 0; padding: 20px"><h2 class="t-h">My day</h2>{kv("Approvals answered", "11")}{kv("Approved", "9")}{kv("Declined", "2")}{kv("Usual time to answer", "1 min 40 s")}{kv("Voids I approved", "UGX 62,000")}<span class="grow"></span><p class="t-small muted">Only your own numbers show here.</p></section>
    <section class="vstack g16" style="flex: 1 1 0"><div class="card" style="overflow: hidden"><p class="cap" style="padding: 16px 16px 8px">My requests</p><div class="row s"><span class="grow"><span class="t-body b">Leave, 3 to 5 Jan</span><br><span class="t-sup muted">Asked 24 Nov</span></span>{pill("Waiting", "p-amber")}</div><div class="hstack g8" style="padding: 12px 16px 16px">{btn("Ask for leave", "tonal sm grow")}{btn("Ask to swap", "tonal sm grow")}</div></div><span class="grow"></span>{btn("Change my PIN", "tonal")}{btn("Log out", "filled")}</section>'''
body = tbar('Me', 'Grace N. · Supervisor · as at 20:10', 'supervisor') + f'\n  <main class="page" style="padding: 16px 24px; flex-direction: row; gap: 20px">{me}</main>\n' + navbar('supervisor', 'Me')
page('Supervisor-Me', *T, 'Me, supervisor', body, G, 'Supervisor', 'Me: shift, my day as a supervisor, requests, PIN, log out', '/supervisor/me', 'U4')
body = band('Me', 'Grace N. · on shift 4 h 10') + f'''<main class="body"><div class="card" style="padding: 16px">{kv("Approvals answered", "11")}{kv("Declined", "2")}{kv("Usual time to answer", "1 min 40 s")}</div><div class="card" style="overflow: hidden">{row("Leave, 3 to 5 Jan", "Asked 24 Nov", pill("Waiting", "p-amber"), btn=False)}{row("Ask for leave or a swap", "", CHEV)}{row("Change my PIN", "", CHEV)}</div><span class="grow"></span>{btn("End my shift", "tonal")}{btn("Log out", "filled")}</main>''' + navbar('supervisor', 'Me', True)
page('Supervisor-Me-Phone', *P, 'Me, supervisor, phone', body, G, 'Supervisor', 'Me on a phone', '/supervisor/me', 'U4')

# 3 new booking
TIMES = ['19:30', '20:00', '20:30', '21:00', '21:30', '22:00']
def newform(cols, phone=False):
    tg = optgrid(TIMES, cols, '20:30')
    return f'''<div class="{"vstack g12" if phone else "hstack g16"}"><div class="grow"><label class="lab">Name</label><div class="field">K. Nansubuga</div></div><div class="grow"><label class="lab">Phone</label><div class="field">+256 700 000 148</div></div></div>
    <div class="hstack g16"><div class="grow"><p class="lab">Day</p>{seg(["Today", "Tomorrow", "Pick a day"], "Today", True)}</div>{'' if not phone else ''}{"" if phone else '<div><p class="lab">Guests</p><div class="step"><button class="round sm tonal" aria-label="One fewer">' + ic("minus") + '</button><b>5</b><button class="round sm tonal" aria-label="One more">' + ic("plus") + '</button></div></div>'}</div>
    {('<div class="hstack"><p class="lab grow" style="margin: 0">Guests</p><div class="step"><button class="round sm tonal" aria-label="One fewer">' + ic("minus") + '</button><b>5</b><button class="round sm tonal" aria-label="One more">' + ic("plus") + '</button></div></div>') if phone else ''}
    <div><p class="lab">Time</p>{tg}</div>
    {"" if phone else '<div class="hstack g16"><div class="grow"><p class="lab">Table</p>' + optgrid(["Choose later", "Table 14 · 6 seats", "T3 · 6 seats"], 3, "Table 14 · 6 seats") + '</div></div>'}
    <div class="{"vstack g12" if phone else "hstack g16"}">{'<div class="hstack g12"><div class="grow"><p class="lab">Table</p><div class="field">Choose later</div></div><div class="grow"><p class="lab">Deposit</p><div class="field ph">None</div></div></div>' if phone else ''}<div class="grow"><label class="lab">Note</label><div class="field ph">Birthday, high chair, a quiet corner</div></div>{"" if phone else '<div style="width: 220px"><label class="lab">Deposit</label><div class="field ph">None</div></div>'}</div>'''
page('Booking-New', *T, 'New reservation', resv(inert=True) + scrim() + sheet('New reservation', 'Tapas Downtown · Main hall', newform(6), sfoot(btn('Cancel', 'textbtn'), btn('Book 5 guests for 20:30', 'filled', 'min-width: 280px')), 'mid', gap=14),
     G, 'Supervisor', 'New booking: name, phone, day, time, guests, table, note', RS + '#new', 'U4')
page('Booking-New-Phone', *P, 'New booking, phone', presv(inert=True) + scrim() + sheet('New booking', '', newform(3, True), btn('Book 5 guests for 20:30', 'filled'), gap=12),
     G, 'Supervisor', 'New booking on a phone', RS + '#new', 'U4')

# 4 edit
ed = aside(f'''<div class="hstack" style="align-items: flex-start"><div class="grow"><h2 class="t-h">S. Okello</h2><p class="t-sup muted">Change details · booked 22 Nov by phone</p></div><a class="close" href="#" aria-label="Close">{ic("close")}</a></div>
      <div><p class="lab">Time</p>{optgrid(["20:00", "20:30", "21:00"], 3, "21:00")}</div>
      <div class="hstack g16"><div><p class="lab">Guests</p><div class="step"><button class="round sm tonal" aria-label="One fewer">{ic("minus")}</button><b>5</b><button class="round sm tonal" aria-label="One more">{ic("plus")}</button></div></div><div class="grow"><p class="lab">Table</p><button class="field" style="width: 100%"><span class="grow">Table 14 · 6 seats</span>{ic("chev", "s")}</button></div></div>
      <div style="background: var(--amber-t); border-radius: 14px; padding: 12px 14px"><p class="t-sup" style="color: var(--amber)">Table 21 seats 4, so the booking moved to table 14.</p></div>
      <div><label class="lab">Phone</label><div class="field">+256 700 000 131</div></div>
      <span class="grow"></span>
      <div class="hstack g8">{btn("Undo changes", "textbtn")}<span class="grow"></span>{btn("Save changes", "filled", "min-width: 200px")}</div>''')
page('Booking-Edit', *T, 'Edit a reservation', resv(left=bkrows(BK, 'S. Okello'), aside=ed), G, 'Supervisor', 'Edit a booking: time, guests, table; a too-small table is moved and said', RS + '?id=', 'U4')
body = rband('S. Okello', 'Change details', more=False) + f'''<main class="body" style="gap: 14px"><div class="card vstack g12" style="padding: 16px"><div><p class="lab">Time</p>{optgrid(["20:00", "20:30", "21:00"], 3, "21:00")}</div><div class="hstack"><p class="lab grow" style="margin: 0">Guests</p><div class="step"><button class="round sm tonal" aria-label="One fewer">{ic("minus")}</button><b>5</b><button class="round sm tonal" aria-label="One more">{ic("plus")}</button></div></div><div><p class="lab">Table</p><div class="field">Table 14 · 6 seats</div></div><div style="background: var(--amber-t); border-radius: 14px; padding: 12px 14px"><p class="t-sup" style="color: var(--amber)">Table 21 seats 4, so the booking moved to table 14.</p></div><div><label class="lab">Phone</label><div class="field">+256 700 000 131</div></div></div></main>
  <footer class="foot">{btn("Undo", "tonal", "flex: 1 1 0")}{btn("Save changes", "filled", "flex: 2 1 0")}</footer>'''
page('Booking-Edit-Phone', *P, 'Edit a booking, phone', body, G, 'Supervisor', 'Edit a booking on a phone', RS + '?id=', 'U4')

# 5 cancel with a reason
cb = f'''<div><p class="lab">Why</p>{optgrid(["Guest called to cancel", "Booked twice", "We cannot seat them", "Something else"], 2, "Guest called to cancel")}</div>
    <div class="card" style="box-shadow: none; background: var(--canvas); padding: 14px 16px">{kv("Deposit", "UGX 50,000 received")}<p class="t-sup muted">Kept on the booking. A refund is a manager’s decision, from the booking’s history.</p></div>
    <p class="t-sup muted">Table 5 is no longer held for 19:45. The booking stays in History with your name and reason.</p>'''
page('Booking-Cancel', *T, 'Cancel a reservation', resv(left=bkrows(BK, 'J. Mukasa'), inert=True) + scrim() + sheet('Cancel J. Mukasa’s booking', '19:45 · 6 guests · Table 5', cb, sfoot(btn('Keep the booking', 'textbtn'), btn('Cancel the booking', 'filled', 'min-width: 240px')), 'mid'),
     G, 'Supervisor', 'Cancel a booking with a reason; the deposit is kept until a manager decides', RS + '?id=#cancel', 'U4')
page('Booking-Cancel-Phone', *P, 'Cancel a booking, phone', presv(inert=True) + scrim() + sheet('Cancel J. Mukasa’s booking', '19:45 · 6 guests', f'{optgrid(["Guest cancelled", "Booked twice", "Cannot seat them", "Something else"], 2, "Guest cancelled")}{kv("Deposit kept", "UGX 50,000")}<p class="t-sup muted">It stays in History with your name and reason.</p>', btn('Cancel the booking', 'filled')),
     G, 'Supervisor', 'Cancel a booking on a phone', RS + '?id=#cancel', 'U4')

# 6 no‑show
nb = f'''<div class="card" style="box-shadow: none; background: var(--canvas); padding: 14px 16px">{kv("Booked for", "19:30 · 2 guests")}{kv("Now", "19:57, 27 minutes late")}{kv("Phone", "+256 700 000 147")}</div>
    <p class="t-sup muted">Never automatic: only you decide. Table 22 is free for walk‑ins at once. A no‑show counts on the bookings report; if they arrive later, find them in History and seat them.</p>'''
page('Booking-No-Show', *T, 'Mark a no‑show', resv(left=bkrows([('19:30', 'P. Achieng', '2 guests · Table 22', 'Late 27 min', 'p-red')] + BK[1:], 'P. Achieng'), inert=True, sub='Today · 6 still to come · 1 late · as at 19:57') + scrim() + sheet('Mark P. Achieng as a no‑show?', 'Table 22 has been held 27 minutes', nb, sfoot(btn('Wait longer', 'textbtn'), btn('Mark no‑show · free table 22', 'filled', 'min-width: 300px')), 'mid'),
     G, 'Supervisor', 'No‑show: the supervisor decides; the table frees', RS + '?id=#no-show', 'U4')
page('Booking-No-Show-Phone', *P, 'No‑show, phone', presv(inert=True).replace('Late 12 min', 'Late 27 min').replace('1 late · 19:42', '1 late · 19:57') + scrim() + sheet('Mark P. Achieng as a no‑show?', '19:30 · 2 guests · 27 min late', '<p class="t-sup muted">Only you decide. Table 22 frees at once. If they arrive later, find them in History.</p>', '<div class="vstack g4">' + btn('Mark no‑show · free table 22', 'filled') + btn('Wait longer', 'textbtn') + '</div>'),
     G, 'Supervisor', 'No‑show on a phone', RS + '?id=#no-show', 'U4')

# 7 history
HIS = [('Wed 25 Nov', '20:00', 'A. Kato', '4', 'Table 14', 'Seated, paid 118,000', 'p-green'), ('Wed 25 Nov', '19:30', 'B. Nakato', '2', 'Table 22', 'No‑show', 'p-red'), ('Wed 25 Nov', '19:00', 'C. Opio', '6', 'Table 5', 'Seated, paid 246,500', 'p-green'),
       ('Tue 24 Nov', '21:00', 'E. Mugisha', '3', 'Table 9', 'Cancelled by guest', 'p-neutral'), ('Tue 24 Nov', '20:30', 'F. Tumusiime', '8', 'Table 27', 'Seated, paid 402,000', 'p-green'), ('Tue 24 Nov', '19:45', 'G. Akello', '2', 'T4', 'Seated, paid 64,000', 'p-green'),
       ('Mon 23 Nov', '20:00', 'H. Wasswa', '5', 'Table 14', 'No‑show', 'p-red'), ('Mon 23 Nov', '19:30', 'I. Nambi', '4', 'Table 21', 'Seated, paid 131,000', 'p-green')]
ht = '<div class="card" style="overflow: hidden"><table class="dt"><thead><tr><th>Day</th><th>Time</th><th>Name</th><th class="num">Guests</th><th>Table</th><th>What happened</th></tr></thead><tbody>' + ''.join(
    f'<tr{" class=\"sel\"" if n == "B. Nakato" else ""}><td>{d}</td><td>{t}</td><td>{n}</td><td class="num">{g}</td><td>{tb}</td><td>{pill(o, pc)}</td></tr>' for d, t, n, g, tb, o, pc in HIS) + '</tbody></table></div>'
hl = f'<div class="hstack g8">{"".join(f"<button class=\"chip{" on" if c == "Last 7 days" else ""}\">{c}</button>" for c in ["Yesterday", "Last 7 days", "This month"])}<span class="grow"></span><span class="t-sup muted">41 bookings · 3 no‑shows · 2 cancelled</span></div>{ht}'
ha = aside(f'''<div class="hstack" style="align-items: flex-start"><div class="grow"><h2 class="t-h">B. Nakato</h2><p class="t-sup muted">Wed 25 Nov · 19:30 · 2 guests</p></div>{pill("No‑show", "p-red")}</div>
      <div class="card" style="box-shadow: none; background: var(--canvas); padding: 4px 16px">{kv("Booked", "23 Nov by phone, Grace N.")}{kv("Marked no‑show", "19:58 by Grace N.")}{kv("Phone", "+256 700 000 163")}{kv("Deposit", "None")}</div>
      <p class="t-sup muted">Earlier visits from this number: 2 seated, 1 no‑show.</p>
      <span class="grow"></span>{btn("Book them again", "tonal")}''')
page('Booking-History', *T, 'Reservations history', resv(segon='History', left=hl, aside=ha, sub='History · last 7 days'), G, 'Supervisor', 'History: what happened to each booking, with who and when', RS + '?view=history', 'U4')
hp = '<div class="hstack g8">' + ''.join(f'<button class="chip{" on" if c == "7 days" else ""}">{c}</button>' for c in ["Yesterday", "7 days", "Month"]) + '</div><div class="card" style="overflow: hidden">' + ''.join(row(f'{n} · {t}', f'{d} · {g} guests · {tb}', pill(o.split(",")[0], pc)) for d, t, n, g, tb, o, pc in HIS[:6]) + '</div><p class="t-sup muted">41 bookings in 7 days · newest 6 shown, scroll for more</p>'
page('Booking-History-Phone', *P, 'Booking history, phone', presv('History', hp).replace('Today · 7 to come · 1 late · 19:42', 'History · last 7 days'), G, 'Supervisor', 'History on a phone', RS + '?view=history', 'U4')

# 8 Attention
ATT = [('19:30', 'P. Achieng', '2 guests · Table 22 held', 'Late 12 min', 'p-red'), ('19:45', 'J. Mukasa', '6 guests · Table 5 in use', 'Table busy', 'p-amber')]
at = aside(f'''<div class="hstack" style="align-items: flex-start"><div class="grow"><h2 class="t-h">P. Achieng</h2><p class="t-sup muted">19:30 · 2 guests · booked online</p></div>{pill("Late 12 min", "p-red")}</div>
      <div style="background: var(--red-t); border-radius: 14px; padding: 12px 14px"><p class="t-body b" style="color: var(--red)">Table 22 is held and empty</p><p class="t-sup" style="color: var(--red)">Two walk‑ins are waiting at the door</p></div>
      <div class="card" style="box-shadow: none; background: var(--canvas); padding: 4px 16px">{kv("Phone", "+256 700 000 147")}{kv("Note", "Window if possible")}</div>
      <p class="lab" style="margin: 0">What now</p>
      {picks(["Hold 15 more minutes", "Give 22 away, keep the booking"], 1, ("Hold 15 more minutes",))}
      <span class="grow"></span>
      <div class="hstack g8">{btn("Mark no‑show", "textbtn danger")}<span class="grow"></span>{btn("Hold until 19:57", "filled", "min-width: 200px")}</div>''')
page('Booking-Attention', *T, 'Reservations, Attention', resv(segon='Attention · 3', left=bkrows(ATT, 'P. Achieng') + '<p class="t-sup muted">Late bookings, held tables still in use, and bookings with no table. Each clears itself when it is dealt with.</p>', aside=at), G, 'Supervisor', 'Attention: late, table busy, no table; the next step for each', RS + '?view=attention', 'U4')
ap = '<div class="card" style="overflow: hidden">' + ''.join(f'<button class="row" style="width: 100%"><span class="t-row" style="width: 56px">{t}</span><span class="grow"><span class="t-body b">{n}</span><br><span class="t-sup muted">{s}</span></span>{pill(p, pc)}</button>' for t, n, s, p, pc in ATT) + '</div><p class="t-sup muted">Each clears itself when it is dealt with. M. Atim at 21:00 has no table yet; it joins this list at 20:30 if still unseated.</p>'
page('Booking-Attention-Phone', *P, 'Bookings, Attention, phone', presv('Attention', ap), G, 'Supervisor', 'Attention on a phone', RS + '?view=attention', 'U4')
