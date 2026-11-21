#!/usr/bin/env python3
"""H1 negative controls: plant one defect per guard, run the checks, record what goes red,
restore from a COPY of the file (never git checkout/restore). Reads DATABASE_URL and
DIRECT_DATABASE_URL from the environment (the disposable nimbus_event_* database); prints no secret.
Usage (from repo root): DATABASE_URL=... DIRECT_DATABASE_URL=... python3 reports/proof/H1_mutation_controls.py
"""
import os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
API = os.path.join(ROOT, 'apps', 'api')
QS = 'apps/api/src/modules/quick-sale/quick-sale.service.ts'
ON = 'apps/api/src/modules/orders/order-number.ts'
CT = 'apps/api/src/modules/quick-sale/quick-sale.controller.ts'
TL = 'apps/api/src/modules/tills/tills.service.ts'

UNIT = ['pnpm', 'exec', 'jest', 'src/modules/quick-sale', 'src/modules/tills', 'src/common/audit']
def e2e(pattern):
    return ['pnpm', 'exec', 'jest', '--config', './test/jest-e2e.json', 'test/quick-sale.e2e-spec.ts', '-t', pattern]

# (name, [(file, old, new)], e2e pattern or None, run unit?)
MUTATIONS = [
 ('M1 replay lookup ignored', [(QS, 'if (existing) return this.replayOf(existing, ctx);', 'void existing;')], 'the real case', True),
 ('M2 replay branch check removed', [(QS, 'if (stored.branchId !== ctx.branchId) {', 'if (false as boolean) {')], 'another branch is a 409', True),
 ('M3 advisory lock removed', [(ON, 'await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${branchId}))`;', '')], 'twenty concurrent', True),
 ('M3b advisory lock AND order_number retry removed', [(ON, 'await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${branchId}))`;', ''), (QS, 'if (attempt < MAX_ATTEMPTS) continue;', '')], 'twenty concurrent', True),
 ('M4 client_sale_id unique-violation handler removed', [(QS, "if (violated === 'client_sale_id') {", 'if (false as boolean) {')], 'same moment', True),
 ('M5 @Permissions removed from the route', [(CT, "@Permissions('pos:orders:write', 'pos:orders:close')", '')], 'Bartender', False),
 ('M6 branch filter removed from the menu query', [(QS, '        branchId: ctx.branchId,\n        isActive: true,', '        isActive: true,')], "another branch's", True),
 ('M7 isActive filter removed from the menu query', [(QS, '        isActive: true,\n        OR: [', '        OR: [')], 'an inactive SKU', True),
 ('M8 order written outside the transaction', [(QS, 'const order = await tx.order.create({', 'const order = await this.prisma.order.create({')], 'leaves no order row', False),
 ('M9 tills OR(tillCode, null) removed', [(TL, 'OR: [{ tillCode: till.tillCode }, { tillCode: null }],', '')], 'till cash', True),
 ('M10 branchId dropped from the audit metadata', [(QS, '          branchId: ctx.branchId,\n          orgId: ctx.organizationId,\n          orderNumber', '          orgId: ctx.organizationId,\n          orderNumber')], 'audit entry', True),
 ('M11 cash tendered-below-total check removed', [(QS, 'if (tendered.lt(total)) this.bad(', 'if (false as boolean) this.bad(')], 'cash tendered below the total', True),
 ('M12 cardScheme requirement removed', [(QS, 'if (!p.cardScheme) this.bad(', 'if (false as boolean) this.bad(')], 'CARD without cardScheme', True),
]

ANSI = re.compile(r'\x1b\[[0-9;]*m')
def run(cmd):
    r = subprocess.run(cmd, cwd=API, capture_output=True, text=True, env=os.environ)
    out = ANSI.sub('', r.stdout + r.stderr)
    tests = [l.strip() for l in out.splitlines() if l.strip().startswith('Tests:')]
    failed = [l.strip() for l in out.splitlines() if '✕' in l]
    recv = [l.strip() for l in out.splitlines() if l.strip().startswith('Received:')][:2]
    return (tests[-1] if tests else 'no Tests line (suite failed to run)'), failed, recv

def main():
    keep = tempfile.mkdtemp(prefix='h1-mut-')
    for name, edits, pattern, do_unit in MUTATIONS:
        backups = {}
        for f, old, new in edits:
            p = os.path.join(ROOT, f)
            if f not in backups:
                backups[f] = os.path.join(keep, f.replace('/', '__'))
                shutil.copy2(p, backups[f])
            s = open(p).read()
            if old not in s:
                print(f'!! {name}: pattern not found in {f}; mutation NOT applied'); sys.exit(2)
            open(p, 'w').write(s.replace(old, new, 1))
        print(f'=== {name}')
        try:
            if do_unit:
                t, failed, _ = run(UNIT)
                print(f'  unit : {t}')
                for l in failed[:4]: print(f'         red: {l}')
            if pattern:
                t, failed, recv = run(e2e(pattern))
                print(f'  e2e  : {t}  (-t "{pattern}")')
                for l in failed[:4]: print(f'         red: {l}')
                for l in recv: print(f'         {l[:200]}')
        finally:
            for f, b in backups.items():
                shutil.copy2(b, os.path.join(ROOT, f))
    d = subprocess.run(['git', 'diff', '--stat'], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    print('=== after restore, git diff --stat:', d or '(empty)')

if __name__ == '__main__':
    main()
