/**
 * Checks the Tapas Downtown data files before any load: every reference resolves, no duplicate
 * names, prices whole and believable, units known, phones in +256 700 000 xxx, no brand names,
 * recipe costs believable against their prices. Exit 0 when green, 1 with every error listed.
 *
 *   cd packages/db && npx ts-node --project tsconfig.seed.json demo-venue/validate.ts [data-dir]
 */
import { readData, validate, DATA_DIR } from './lib';

const dir = process.argv[2] ?? DATA_DIR;
const report = validate(readData(dir));
console.log(`demo-venue validator: ${dir}`);
for (const [k, v] of Object.entries(report.counts)) console.log(`  ${k.padEnd(18)} ${v}`);
const pcts = report.recipeCosts.map((r) => r.pct).sort((a, b) => a - b);
if (pcts.length)
  console.log(`  recipe cost as % of price: lowest ${pcts[0]}, median ${pcts[Math.floor(pcts.length / 2)]}, highest ${pcts[pcts.length - 1]}`);
if (report.errors.length) {
  console.log(`RED: ${report.errors.length} error(s)`);
  for (const e of report.errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log('GREEN: 0 errors');
