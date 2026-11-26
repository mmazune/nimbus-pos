# shared pieces for the Nimbus POS drawings
import os
P='/tmp/claude-0/-home-claude/21ef40cd-9273-5759-a18e-804582ed6c1a/scratchpad/canvas/project'
I=dict(
 back='<path d="m15 5-7 7 7 7"/>', chev='<path d="m9 5 7 7-7 7"/>', close='<path d="M6 6l12 12M18 6 6 18"/>',
 plus='<path d="M12 5v14M5 12h14"/>', minus='<path d="M5 12h14"/>',
 search='<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 more='<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 print='<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>',
 grid='<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
 user='<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 lock='<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 cal='<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4"/>',
 bell='<path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 9V6M10 6h4"/>',
 shield='<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
 team='<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5 5"/>',
 ticket='<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
 till='<rect x="3" y="11" width="18" height="8" rx="2"/><path d="M6 11V5h12v6M10 15h4"/>',
 move='<path d="M5 12h14M13 6l6 6-6 6"/>', join='<path d="M7 4v5a5 5 0 0 0 5 5v6M17 4v5a5 5 0 0 1-5 5"/>',
 split='<rect x="4" y="5" width="7" height="14" rx="1.5"/><rect x="13" y="5" width="7" height="14" rx="1.5"/>',
 pct='<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M19 5 5 19"/>',
 void='<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>', x='<circle cx="12" cy="12" r="8"/><path d="m9 9 6 6M15 9l-6 6"/>',
 cash='<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
 phone='<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/>',
 card='<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
 check='<path d="m5 12 5 5 9-10"/>', clock='<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
 box='<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
 inbox='<path d="M4 13l2-8h12l2 8v6H4z"/><path d="M4 13h5a3 3 0 0 0 6 0h5"/>',
 down='<path d="M12 4v10M8 10l4 4 4-4M5 19h14"/>', clip='<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h4"/>',
 apps='<circle cx="6" cy="6" r="1.3"/><circle cx="12" cy="6" r="1.3"/><circle cx="18" cy="6" r="1.3"/><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/><circle cx="6" cy="18" r="1.3"/><circle cx="12" cy="18" r="1.3"/><circle cx="18" cy="18" r="1.3"/>',
 alert='<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
 back2='<path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>', sun='<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
 chart='<path d="M5 20V10M12 20V4M19 20v-7"/>', shop='<path d="M4 10l1.5-5h13L20 10M5 10v10h14V10M4 10h16M10 20v-5h4v5"/>',
 coin='<circle cx="12" cy="12" r="8"/><path d="M9.5 14.5c.5 1 1.4 1.5 2.5 1.5 1.5 0 2.5-.8 2.5-2s-1-1.7-2.5-2-2.5-.8-2.5-2 1-2 2.5-2c1.100 0 2 .5 2.500 1.500M12 6v12"/>',
 cart='<path d="M4 5h2l2 10h10l2-7H7"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
)
def ic(n,c=''): return f'<svg class="ic {c}" viewBox="0 0 24 24" aria-hidden="true">{I[n]}</svg>'
def page(fn,title,w,h,body):
    open(os.path.join(P,fn),'w').write(f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="kit.css">
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
body{{margin:0}}
</style>
</helmet>
<div class="ab" style="width: {w}px; height: {h}px">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
''')
NAV=dict(
 waiter=[('Floor','grid',0),('Reservations','cal',0),('Ready','bell',2),('Me','user',0)],
 cashier=[('Floor','grid',0),('Receipts','ticket',0),('Till','till',0),('Me','user',0)],
 supervisor=[('Floor','grid',0),('Reservations','cal',0),('Approvals','shield',4),('Team','team',0),('Me','user',0)],
 kitchen=[('Tickets','ticket',8),('Done','check',0),('Sold out','void',0),('Store','box',1)],
 store=[('Requests','inbox',3),('Stock','box',0),('Receive','down',0),('Count','clip',0),('Me','user',0)],
 manager=[('Today','sun',0),('Floor','grid',0),('Approvals','shield',4),('Reports','chart',0),('More','more',0)],
 owner=[('Today','sun',0),('Branches','shop',0),('Reports','chart',0),('Alerts','alert',3),('More','more',0)],
 accountant=[('Today','sun',0),('Costs','coin',12),('Purchases','cart',0),('Reports','chart',0),('More','more',0)],
)
def nav(role,on,tag='navbar',big=True):
    o=f'  <nav class="{tag}" aria-label="Main">\n'
    for l,i,n in NAV[role]:
        b=f'<span class="nb">{n}</span>' if n else ''
        cur=' class="on" aria-current="page"' if l==on else ''
        o+=f'    <a{cur} href="#">{ic(i,"l" if big else "")}{l}{b}</a>\n'
    return o+'  </nav>'
def tab(role,on): return nav(role,on,'tabbar',False)
def tbar(title,sub,name,role,place):
    return f'''  <header class="bar tall">
    <a class="mark solo" href="#" aria-label="Nimbus POS"><i></i></a>
    <h1 class="t-h">{title}</h1>
    <span class="clock">{sub}</span>
    <span class="grow"></span>
    <span class="name"><b>{name}</b> · {role} · {place}</span>
    <button class="rb" aria-label="Lock the screen">{ic("lock")}</button>
  </header>'''
def obar(title,sub,who,back=('Floor','Main.dc.html'),search='Search the whole menu'):
    s=f'<span class="search" style="width: 320px">{ic("search","s")}{search}</span>' if search else ''
    return f'''  <header class="bar">
    <a class="back" href="{back[1]}">{ic("back")}{back[0]}</a>
    <h1 class="t-h">{title}</h1>
    <span class="clock">{sub}</span>
    <span class="grow"></span>
    {s}
    <span class="who" title="Signed in">{who}</span>
  </header>'''
FOODG=['Popular','Offers','Starters','Soups','Salads','Mains','Grills','Burgers','Pizza','Pasta','Local','Sides','Kids','Desserts','Breakfast','Extras']
POP=[('Beef burger','28,000'),('Chicken wings','24,000'),('Chips','8,000'),('Goat stew','26,000'),('Grilled tilapia','38,000'),('Chicken curry','27,000'),('Pork ribs','35,000'),('Beef samosas','12,000'),('Margherita pizza','30,000'),('Club sandwich','25,000'),('Greek salad','20,000'),('Fish and chips','32,000'),('Rolex','9,000'),('Matooke and beef','22,000'),('Chicken luwombo','30,000'),('Spring rolls','12,000'),('Pepper steak','45,000'),('Spaghetti bolognese','27,000'),('Fruit platter','15,000'),('Chocolate cake','14,000')]
def menu(groups,gon,items,cols,side='Food',right='',pad=''):
    g=''.join(f'<button class="opt{" on" if x==gon else ""}">{x}</button>' for x in groups)
    it=''.join((f'<button class="item off"><b>{n}</b><span>Sold out</span></button>' if p is None else f'<button class="item"><b>{n}</b><span>{p}</span></button>') for n,p in items)
    return f'''    <main class="menu"{pad}>
      <div class="hstack" style="justify-content: space-between">
        <div class="seg" role="tablist" aria-label="Menu">
          <button class="{"on" if side=="Food" else ""}" style="min-width: 140px">Food</button>
          <button class="{"on" if side=="Drinks" else ""}" style="min-width: 140px">Drinks</button>
        </div>{right}
      </div>
      <div class="optgrid" style="grid-template-columns: repeat(8, minmax(0, 1fr))">{g}</div>
      <div class="items" style="grid-template-columns: repeat({cols}, minmax(0, 1fr))">{it}</div>
    </main>'''
SENT=[('Sent 20:15','sent',[(2,'Lager 500 ml','','12,000'),(1,'Blended Scotch','Double · Cola','15,000'),(1,'Cola 300 ml','','3,000')]),
      ('Sent 19:42','sent',[(1,'Beef burger','Medium · No onions','28,000'),(2,'Chips','','16,000'),(1,'Chicken wings','','24,000')])]
def lines(groups):
    o=''
    for k,(cap,cls,ls) in enumerate(groups):
        if k: o+='<div class="hr" style="margin: 8px 16px"></div>'
        o+=f'<p class="cap" style="padding: 8px 16px 4px">{cap}</p>'
        for q,n,sub,p in ls:
            sb=f'<br><span class="sub">{sub}</span>' if sub else ''
            o+=f'<button class="line {cls}"><span class="q">{q}</span><span class="grow"><span class="nm">{n}</span>{sb}</span><span class="pr">{p}</span></button>'
    return o
def check(body,total,foot,title='Order',count='8 items',attr=''):
    return f'''    <aside class="check" aria-label="{title}"{attr}>
      <div class="hstack" style="padding: 16px 16px 8px; justify-content: space-between"><h2 class="t-h">{title}</h2><span class="t-sup muted">{count}</span></div>
      {body}
      <span class="grow"></span>
      <div class="hr"></div>
      <div class="tot" style="padding: 14px 16px 4px"><span class="t-row">Total</span><span class="t-h">UGX {total}</span></div>
      <div class="hstack g8" style="padding: 12px 16px 16px">{foot}</div>
    </aside>'''
MOREBTN=f'<button class="sq tonal" aria-label="Table actions">{ic("more")}</button>'
def foot(*btns,more=True):
    o=MOREBTN if more else ''
    for l,c,f in btns: o+=f'<button class="btn {c}" style="flex: {f} 1 0; padding: 0 12px">{l}</button>'
    return o
