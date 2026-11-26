// T4 — one fixed order for the e2e suite, so a run is the same run every time.
//
// Jest's default sequencer orders files by size and by the durations it cached from earlier
// runs, so the same suite runs in a different order on a fresh container than on a warm one.
// Some specs read rows other specs leave behind (quick-sale.review's C10 reads the 200-sale
// night that quick-sale.e2e writes), and some change shared demo users. This sequencer:
//   1. runs the files named in RUN_FIRST, in that order, before everything else;
//   2. runs every other file in alphabetical order of its path;
//   3. runs the files named in RUN_LAST, in that order, after everything else.
// E2E_ORDER (comma-separated file-name fragments) overrides both, for diagnosing pairs:
//   E2E_ORDER=waiter-mvp,quick-pin npx jest --config ./test/jest-e2e.json waiter-mvp quick-pin
// Standalone (no new dependency): Jest only needs sort(); cacheResults() is a no-op because
// this order never depends on earlier durations.

const RUN_FIRST = [
  // quick-sale.review C10 audits every quick-sale row and needs quick-sale.e2e's night first.
  'quick-sale.e2e-spec.ts',
  'quick-sale.h1f.e2e-spec.ts',
  'quick-sale.review.e2e-spec.ts',
];

const RUN_LAST = [
  // bg1-onboarding resets the shared demo user cashier@demo.local's password and never puts it
  // back, so every later spec that signs in as the cashier gets 401 (quick-pin, tenancy).
  'bg1-onboarding.e2e-spec.ts',
];

function rank(path, order) {
  const i = order.findIndex((frag) => path.endsWith(frag) || path.includes(`/${frag}`));
  return i === -1 ? order.length : i;
}

function defaultRank(path) {
  const first = rank(path, RUN_FIRST);
  if (first < RUN_FIRST.length) return first;
  const last = rank(path, RUN_LAST);
  return last < RUN_LAST.length ? RUN_FIRST.length + 1 + last : RUN_FIRST.length;
}

class E2eSequencer {
  cacheResults() {}

  allFailedTests(tests) {
    return tests;
  }

  shard(tests) {
    return tests;
  }

  sort(tests) {
    const order = process.env.E2E_ORDER
      ? process.env.E2E_ORDER.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
    const r = (p) => (order ? rank(p, order) : defaultRank(p));
    return [...tests].sort((a, b) => {
      const d = r(a.path) - r(b.path);
      return d !== 0 ? d : a.path.localeCompare(b.path);
    });
  }
}

module.exports = E2eSequencer;
