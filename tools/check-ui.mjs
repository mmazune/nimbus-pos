#!/usr/bin/env node
// check:ui — U0 (26 Nov 2026). Keeps new UI made from the kit and nothing else.
//
// Scans: apps/web/src/components/kit/** and apps/web/src/screens/** (.ts .tsx .js .jsx .css).
// Exits 1 on:
//   colour        a hex or rgb()/hsl()/oklch() colour (colours are born only in kit-tokens.css)
//   arbitrary     a Tailwind arbitrary value or property: w-[12px], bg-[#fff], [mask:none]
//   ellipsis      truncate, text-ellipsis, text-clip, line-clamp, text-overflow: ellipsis
//   sideways      overflow-x-auto, overflow-x-scroll (or overflowX: auto|scroll)
//   raw-control   a raw <button or <a in screens/** (use a kit piece)
//   text-size     a text-size class that is not the kit's: text-sm, text-2xl, text-kit-<not a kit style>
// The kit's own names are read from apps/web/src/styles/kit-tokens.css.
// Allow list: tools/check-ui.allow.json, [{ file, rule, reason }]; a stale entry fails.
// Also fails on a missing scan root, a missing tokens file, or 0 files scanned.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps/web/src');
const TOKENS = join(WEB, 'styles/kit-tokens.css');
const ROOTS = [
  { path: join(WEB, 'components/kit'), screens: false },
  { path: join(WEB, 'screens'), screens: true },
];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist']);

const fail = [];

// The kit's colour and type names, from the tokens file.
let kitText = new Set();
if (!existsSync(TOKENS)) {
  fail.push(`tokens file missing: ${relative(ROOT, TOKENS)}`);
} else {
  const css = readFileSync(TOKENS, 'utf8');
  for (const m of css.matchAll(/--kit-color-([a-z0-9-]+)\s*:/g)) kitText.add(m[1]);
  for (const m of css.matchAll(/--kit-type-([a-z0-9-]+)-size\s*:/g)) kitText.add(m[1]);
  if (kitText.size === 0) fail.push('no --kit-color-* or --kit-type-* names found in kit-tokens.css');
}

const RULES = [
  {
    id: 'colour',
    test: (line) =>
      /(?<![\w&#/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/.test(line) ||
      /(?<![\w-])(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/.test(line),
  },
  {
    id: 'arbitrary',
    test: (line) =>
      /(?:^|[\s"'`{(])!?(?:[a-z0-9-]+:)*-?[a-z][a-z0-9-]*-\[[^\]\s]+\]/.test(line) ||
      /(?:^|[\s"'`])!?(?:[a-z0-9-]+:)*\[[a-z-]+:[^\]\s]+\]/.test(line),
  },
  {
    id: 'ellipsis',
    test: (line) =>
      /(?<![\w-])(?:[a-z0-9-]+:)*(?:truncate|text-ellipsis|text-clip|line-clamp(?:-[a-z0-9]+)?)(?![\w-])/.test(line) ||
      /text-overflow\s*:\s*ellipsis|textOverflow/.test(line),
  },
  {
    id: 'sideways',
    test: (line) =>
      /(?<![\w-])(?:[a-z0-9-]+:)*overflow-x-(?:auto|scroll)(?![\w-])/.test(line) ||
      /overflowX\s*:\s*["'`](?:auto|scroll)/.test(line) ||
      /overflow-x\s*:\s*(?:auto|scroll)/.test(line),
  },
  {
    id: 'raw-control',
    screensOnly: true,
    test: (line) => /<button(?![\w-])|<a(?=[\s>])/.test(line),
  },
  {
    id: 'text-size',
    test: (line) => {
      if (/(?<![\w-])(?:[a-z0-9-]+:)*text-(?:xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/.test(line)) return true;
      for (const m of line.matchAll(/(?<![\w-])(?:[a-z0-9-]+:)*text-kit-([a-z0-9-]+)/g)) {
        if (!kitText.has(m[1])) return true;
      }
      return false;
    },
  },
];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) {
      const dot = name.lastIndexOf('.');
      if (dot !== -1 && EXTENSIONS.has(name.slice(dot))) out.push(full);
    }
  }
}

const files = [];
for (const r of ROOTS) {
  if (!existsSync(r.path)) {
    fail.push(`scan root missing: ${relative(ROOT, r.path)}`);
    continue;
  }
  const found = [];
  walk(r.path, found);
  for (const f of found) files.push({ path: f, screens: r.screens });
  console.log(`check:ui ${relative(ROOT, r.path)}: ${found.length} file(s)`);
}

const allowPath = join(ROOT, 'tools/check-ui.allow.json');
let allow = [];
if (existsSync(allowPath)) {
  allow = JSON.parse(readFileSync(allowPath, 'utf8'));
  for (const a of allow) {
    if (!a.file || !a.rule || !a.reason) fail.push(`allow entry needs file, rule, reason: ${JSON.stringify(a)}`);
  }
}
const allowUsed = new Set();

const hits = [];
let allowed = 0;
for (const f of files) {
  const rel = relative(ROOT, f.path).split(sep).join('/');
  const lines = readFileSync(f.path, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.screensOnly && !f.screens) continue;
      if (!rule.test(line)) continue;
      const idx = allow.findIndex((a) => a.file === rel && a.rule === rule.id);
      if (idx !== -1) {
        allowed += 1;
        allowUsed.add(idx);
      } else {
        hits.push(`${rel}:${i + 1}  [${rule.id}]  ${line.trim().slice(0, 110)}`);
      }
    }
  });
}
allow.forEach((a, idx) => {
  if (!allowUsed.has(idx)) fail.push(`stale allow entry (matches nothing): ${a.file} [${a.rule}]`);
});

console.log(`check:ui scanned ${files.length} files with ${RULES.length} rules; ${kitText.size} kit colour and type names`);
console.log(`check:ui allowed ${allowed} hit(s) via ${allow.length} allow entr${allow.length === 1 ? 'y' : 'ies'}`);
if (files.length === 0) fail.push('0 files scanned');
for (const h of hits) console.log(`HIT ${h}`);
for (const f of fail) console.log(`FAIL ${f}`);

if (hits.length > 0 || fail.length > 0) {
  console.log(`check:ui RED: ${hits.length} hit(s), ${fail.length} problem(s)`);
  process.exit(1);
}
console.log('check:ui green');
