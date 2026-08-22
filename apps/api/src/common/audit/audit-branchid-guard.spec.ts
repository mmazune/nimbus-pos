import * as fs from 'fs';
import * as path from 'path';

/**
 * C-28 — repo-wide regression guard.
 *
 * apps/api/src/modules/audit-timeline/audit-timeline.service.ts unconditionally
 * filters `metadata.branchId = callerCtx.branchId` on every read. Any
 * `audit.log(...)` call whose `metadata` object never includes a `branchId` key
 * is therefore invisible to that branch-scoped trail forever — the defect class
 * found (and partially fixed) across Batch 4, B5.6 and finally swept
 * repo-wide in B5.7 (C-28).
 *
 * This test re-derives every `audit.log(`/`this.audit.log(` call site in
 * apps/api/src, and fails if one is missing `branchId` in its `metadata` block
 * AND does not carry a `// C-28-EXEMPT: <reason>` comment on the line
 * immediately above the call. This is a structural check, not a semantic one —
 * it cannot verify an exemption's reason is truthful, only that every
 * unstamped site has been deliberately looked at and documented, so this class
 * of defect cannot be silently reintroduced by a new call site.
 */

const SRC_ROOT = path.resolve(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function extractBalancedCall(src: string, openParenIdx: number): string {
  let depth = 0;
  for (let i = openParenIdx; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return src.slice(openParenIdx, i + 1);
    }
  }
  return src.slice(openParenIdx, openParenIdx + 2000);
}

function spreadIdentifierHasBranchId(fileSrc: string, identifier: string): boolean {
  // Best-effort resolution of `metadata: { ...someVar, ... }` /
  // `metadata: someVar` where someVar is a locally-built object assigned
  // earlier in the same file, e.g. `const someVar = { ..., branchId: x };`.
  // This is intentionally conservative (whole-file scan, not scope-aware) —
  // it only exists to avoid false positives on a known, verified pattern
  // (pos-handoff.service.ts's `auditMeta`); it does not attempt full
  // JS scope resolution.
  const declRegex = new RegExp(
    `(?:const|let)\\s+${identifier}\\s*(?::[^=]+)?=\\s*\\{`,
    'g',
  );
  const dm = declRegex.exec(fileSrc);
  if (!dm) return false;
  const braceStart = dm.index + dm[0].length - 1;
  let depth = 0;
  for (let i = braceStart; i < fileSrc.length; i++) {
    if (fileSrc[i] === '{') depth++;
    else if (fileSrc[i] === '}') {
      depth--;
      if (depth === 0) {
        return fileSrc.slice(braceStart, i + 1).includes('branchId');
      }
    }
  }
  return false;
}

function metadataHasBranchId(callText: string, fileSrc: string): boolean {
  const metaMatch = /metadata\s*:\s*/.exec(callText);
  if (!metaMatch) return false;
  const rest = callText.slice(metaMatch.index + metaMatch[0].length).trimStart();
  if (rest.startsWith('{')) {
    let depth = 0;
    let end = rest.length;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '{') depth++;
      else if (rest[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    const block = rest.slice(0, end);
    if (block.includes('branchId')) return true;
    // No literal branchId key in this object literal — but it may spread a
    // locally-built variable that already carries one, e.g.
    // `{ ...auditMeta, role: 'source' }`.
    const spreadNames = [...block.matchAll(/\.\.\.(\w+)/g)].map((m) => m[1]);
    return spreadNames.some((name) => spreadIdentifierHasBranchId(fileSrc, name));
  }
  // Bare `metadata: someVar` reference.
  const bareMatch = /^([A-Za-z_$][\w$]*)/.exec(rest);
  if (bareMatch) {
    return spreadIdentifierHasBranchId(fileSrc, bareMatch[1]);
  }
  return false;
}

describe('C-28 — audit.log call sites must stamp metadata.branchId or be exempted', () => {
  it('has no unstamped, unexempted audit.log call sites', () => {
    const files = walk(SRC_ROOT).filter((f) => {
      const rel = path.relative(SRC_ROOT, f);
      return !rel.startsWith('common/audit/'); // exclude the AuditService itself and this guard's own dir
    });

    const violations: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const lines = src.split('\n');
      const callRegex = /(?:this\.)?audit\.log\(/g;
      let m: RegExpExecArray | null;
      while ((m = callRegex.exec(src))) {
        const openParenIdx = m.index + m[0].length - 1;
        const callText = extractBalancedCall(src, openParenIdx);
        if (metadataHasBranchId(callText, src)) continue;

        const lineNo = src.slice(0, m.index).split('\n').length;
        // Look at the exemption comment on the line(s) immediately above the call.
        const precedingLines = lines.slice(Math.max(0, lineNo - 3), lineNo - 1).join('\n');
        const exempted = /C-28-EXEMPT:/.test(precedingLines);
        if (!exempted) {
          violations.push(`${path.relative(SRC_ROOT, file)}:${lineNo}`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} audit.log call site(s) that do not stamp metadata.branchId ` +
          `and carry no "// C-28-EXEMPT: <reason>" comment on the line above:\n` +
          violations.map((v) => `  - ${v}`).join('\n') +
          `\n\nEither add branchId to the call's metadata object, or — only if the entity/action is ` +
          `genuinely organisation-level with no branch concept (verify against schema.prisma; do not ` +
          `guess) — add a "// C-28-EXEMPT: <concrete reason>" comment directly above the audit.log( call.`,
      );
    }
  });
});
