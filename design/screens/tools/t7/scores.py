# Collects each drawing's latest look-review score from reports/proof/T7/review-*.md into SCORES.md
import json, re, os, glob
reg = json.load(open('/tmp/claude-0/s/reg-1-2-3-4-5-6-7-8-9-10-11.json'))
names = {r[0]: r[3] for r in reg}
P = 'reports/proof/T7'
order = ['review-g1.md', 'review-g2.md', 'review-g3.md', 'review-g4.md', 'review-g5.md', 'review-g6.md', 'review-g7.md', 'review-g8.md', 'review-g9.md', 'review-g10-11.md']
score, src, zero = {}, {}, {}
for f in order:
    p = os.path.join(P, f)
    if not os.path.exists(p): continue
    for line in open(p):
        c = [x.strip() for x in line.strip().strip('|').split('|')]
        if len(c) >= 14 and c[0].strip('`*') in names:
            n = c[0].strip('`*'); nums = [re.sub(r'\D', '', x) for x in c[1:14]]
            if not all(nums): continue
            score[n] = int(nums[12]); src[n] = f; zero[n] = any(int(x) == 0 for x in nums[:12])
L = ['# Look-review scores of every T7 drawing', '', 'Each drawing’s latest score from a reviewer that drew nothing (`review-*.md` in this folder, 12 points of 0 to 2 from the build standards; pass is 20 of 24 with no zero). Where a drawing failed and was redrawn, the re-review score is the one shown.', '']
miss = [n for n in names if n not in score]
low = [n for n in score if score[n] < 20 or zero[n]]
L += [f'- Drawings: {len(names)}; scored: {len(score)}; not scored: {len(miss)}', f'- Under 20 or with a zero: {len(low)}' + (' (' + ', '.join(low) + ')' if low else ''), f'- Lowest: {min(score.values())}; highest: {max(score.values())}', '',
      '| Drawing | Group | Score | From |', '|---|---|---|---|']
for n in names: L.append(f'| `{n}` | {names[n]} | {score.get(n, "not scored")} | {src.get(n, "")} |')
open(os.path.join(P, 'SCORES.md'), 'w').write('\n'.join(L) + '\n')
print(len(score), 'scored;', 'missing', miss[:10], 'low', low)
