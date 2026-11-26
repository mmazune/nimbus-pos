// contact sheet: node sheet.js out.png scale name1 name2 ... (PNGs from ../../png)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [out, scale, ...names] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1800, height: 600 } });
  const imgs = names.map(n => `<figure style="margin:0"><img src="file://${path.resolve(__dirname, '../../png', n + '.png')}" style="zoom:${scale};display:block;border:1px solid #ccc"><figcaption style="font:14px sans-serif">${n}</figcaption></figure>`).join('');
  const fs=require('fs'); const f='/tmp/claude-0/s/_sheet.html'; fs.writeFileSync(f,`<body style="margin:8px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;width:1780px">${imgs}</body>`); await p.goto('file://'+f);
  await p.waitForTimeout(300); await p.screenshot({ path: out, fullPage: true }); await b.close();
})();
