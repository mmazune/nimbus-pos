// T7: renders many drawings in one browser and measures each the same way render.js does.
// node render-all.js <list.json> <out-results.json>   list: [{"name","w","h"}], files in ../html, PNGs to ../png
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const [list, outFile] = process.argv.slice(2);
  const items = JSON.parse(fs.readFileSync(list, 'utf8'));
  const browser = await chromium.launch();
  const results = [];
  for (const it of items) {
    const page = await browser.newPage({ viewport: { width: it.w, height: it.h }, deviceScaleFactor: 1 });
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); return r.abort(); });
    await page.goto('file://' + path.resolve(__dirname, '../html', it.name + '.html'));
    await page.waitForTimeout(150);
    const res = await page.evaluate(() => {
        const root = document.querySelector('.ab'); const R = root.getBoundingClientRect(); const out = { issues: [] };
        out.font = getComputedStyle(root).fontFamily.split(',')[0];
        out.pageOverflow = document.documentElement.scrollWidth > innerWidth || root.scrollHeight > root.clientHeight + 1 || root.scrollWidth > root.clientWidth + 1;
        const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        let filled = 0;
        for (const el of root.querySelectorAll('.filled')) if (vis(el) && !el.closest('[data-spec],[inert]')) filled++;
        out.filled = filled;
        for (const el of root.querySelectorAll('button,a,.pill,.chip,.opt,.mbtn,.tbl .mid,.tbl .bot,.item b,.line .nm,th,td,h1,h2,p,span.who,span.amt')) {
          if (!vis(el)) continue;
          if (el.scrollWidth > el.clientWidth + 1) out.issues.push('clip ' + el.className + ' "' + el.textContent.trim().slice(0, 30) + '"');
          const r = el.getBoundingClientRect();
          if (r.right > R.right + 1 || r.bottom > R.bottom + 1 || r.left < R.left - 1) out.issues.push('outside ' + el.tagName + '.' + el.className + ' "' + el.textContent.trim().slice(0, 30) + '" ' + Math.round(r.right) + ',' + Math.round(r.bottom));
        }
        // children wider than their parent box (text spilling out of a tile)
        for (const el of root.querySelectorAll('.tbl,.item,.mrow,.opt,.btn,.chip,.pill,.mbtn,.seg button,.tk,.row,.line,.field')) {
          const r = el.getBoundingClientRect();
          for (const c of el.querySelectorAll('*')) { const cr = c.getBoundingClientRect(); if (cr.width && (cr.right > r.right + 1 || cr.bottom > r.bottom + 1)) { out.issues.push('spill in ' + el.className.split(' ')[0] + ' "' + el.textContent.trim().slice(0, 28) + '"'); break; } }
        }
        for (const el of root.querySelectorAll('button,a')) { if (!vis(el) || el.closest('[data-spec]')) continue; const r = el.getBoundingClientRect(); if (r.height < 43.5 || r.width < 43.5) out.issues.push('target ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + el.className + ' "' + el.textContent.trim().slice(0, 24) + '"'); }
        const small = new Set();
        for (const el of root.querySelectorAll('*')) { if (!vis(el) || !el.childNodes.length) continue; const t = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (t && parseFloat(getComputedStyle(el).fontSize) < 12) small.add(el.className + ':' + getComputedStyle(el).fontSize); }
        if (small.size) out.issues.push('text under 12px: ' + [...small].join(' | '));
        out.issues = [...new Set(out.issues)];
        return out;
      });
      res.hidden = await page.evaluate(() => {
      const out = []; const root = document.querySelector('.ab');
      for (const el of root.querySelectorAll('button,a,p,h1,h2,span,td,.card,.field,.tbl,.row,.line')) {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('[inert]')) continue;
        let p = el.parentElement;
        while (p && p !== root) { const cs = getComputedStyle(p); if (cs.overflow !== 'visible' || cs.overflowY !== 'visible') { const pr = p.getBoundingClientRect(); if (r.bottom > pr.bottom + 1 || r.right > pr.right + 1) { out.push((el.className || el.tagName) + ' "' + el.textContent.trim().slice(0, 30) + '"'); } break; } p = p.parentElement; }
      }
      return [...new Set(out)].slice(0, 8);
    });
    if (res.hidden.length) res.issues.push('hidden by its box: ' + res.hidden.join(' | '));
    await page.screenshot({ path: path.resolve(__dirname, '../png', it.name + '.png') });
    res.name = it.name; res.size = it.w + 'x' + it.h; results.push(res);
    console.log(it.name, JSON.stringify({issues: res.issues, font: res.font, filled: res.filled, pageOverflow: res.pageOverflow}));
    await page.close();
  }
  fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
  await browser.close();
})();
