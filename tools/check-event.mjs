#!/usr/bin/env node
// check:event — fails when source declares a field or column that could hold a
// full card number, CVV, expiry or magnetic-stripe track data.
//
// Allowed on purpose: cardLast4, cardScheme, authCode, terminalId.
// Scans: source under apps/, packages/db/prisma/schema.prisma, packages/db/prisma/migrations/.
// Skips: node_modules, dist, .next.
// Exits 1 on any hit not in tools/check-event.allow.json, on a stale allow entry,
// on a missing scan root, or when 0 files were scanned.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.prisma', '.sql']);

// Case-aware on purpose (no `i` flag where it would blur words such as cardNotes).
const PATTERNS = [
  {
    id: 'card-number',
    // cardNumber, creditCardNumber, card_number, credit_card_no, CARD_NUMBER. Lowercase `card` must start a
    // word (so discardNumber is ignored); `Card` may follow a word; cardNotes / CARD_NOTES never match.
    re: /(?:(?<![A-Za-z])card|Card)[_-]?(?:[Nn]umber|[Nn]um|[Nn]o)(?![a-z])|CARD[_-]?(?:NUMBER|NUM|NO)(?![A-Z])/,
  },
  { id: 'primary-account-number', re: /primary[_ -]?account[_ -]?number/i },
  {
    id: 'cvv-cvc',
    // cvv, cvc, CVV, cardCvv, cardCVV, card_cvv, cvv2, cvvCode. Not inside longer lowercase words.
    re: /(?<![A-Za-z])(?:cv[vc]|CV[VC])2?(?![a-z])|Cv[vc]2?(?![a-z])|[a-z]CV[VC]2?(?![a-z])/,
  },
  { id: 'card-security-code', re: /card[_ -]?security[_ -]?code/i },
  { id: 'card-expiry', re: /card[_-]?expir(?:y|ation)/i },
  { id: 'expiry-month-year', re: /(?:expir(?:y|ation)|exp)[_-]?(?:month|year)/i },
  { id: 'track-data', re: /track[_-]?[12][_-]?data/i },
  {
    id: 'pan-field',
    // `pan` only as a field: property/assignment, quoted key or @map, or a schema/SQL declaration.
    re: /(?<![\w$])pan(?![\w$])\s*[?!]?\s*[:=]|["'`]pan["'`]|^\s*"?pan"?\s+(?:[A-Z]\w*|text|varchar|char|int)/i,
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

const fail = [];
const files = [];

const roots = [
  { path: join(ROOT, 'apps'), kind: 'dir' },
  { path: join(ROOT, 'packages/db/prisma/migrations'), kind: 'dir' },
  { path: join(ROOT, 'packages/db/prisma/schema.prisma'), kind: 'file' },
];
for (const r of roots) {
  if (!existsSync(r.path)) {
    fail.push(`scan root missing: ${relative(ROOT, r.path)}`);
    continue;
  }
  if (r.kind === 'dir') walk(r.path, files);
  else files.push(r.path);
}

// Allow list: [{ file, pattern, reason }]. A missing file means no allowances.
const allowPath = join(ROOT, 'tools/check-event.allow.json');
let allow = [];
if (existsSync(allowPath)) {
  allow = JSON.parse(readFileSync(allowPath, 'utf8'));
  for (const a of allow) {
    if (!a.file || !a.pattern || !a.reason) fail.push(`allow entry needs file, pattern, reason: ${JSON.stringify(a)}`);
  }
}
const allowUsed = new Set();

const hits = [];
let allowedCount = 0;
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const p of PATTERNS) {
      if (!p.re.test(line)) continue;
      const idx = allow.findIndex((a) => a.file === rel && a.pattern === p.id);
      if (idx !== -1) {
        allowedCount += 1;
        allowUsed.add(idx);
      } else {
        hits.push(`${rel}:${i + 1}  [${p.id}]  ${line.trim().slice(0, 100)}`);
      }
    }
  });
}
allow.forEach((a, idx) => {
  if (!allowUsed.has(idx)) fail.push(`stale allow entry (matches nothing): ${a.file} [${a.pattern}]`);
});

console.log(`check:event scanned ${files.length} files`);
console.log(`check:event allowed ${allowedCount} hit(s) via ${allow.length} allow entr${allow.length === 1 ? 'y' : 'ies'}`);
if (files.length === 0) fail.push('0 files scanned');
for (const h of hits) console.log(`HIT ${h}`);
for (const f of fail) console.log(`FAIL ${f}`);

if (hits.length > 0 || fail.length > 0) {
  console.log(`check:event RED: ${hits.length} hit(s), ${fail.length} problem(s)`);
  process.exit(1);
}
console.log('check:event green');
