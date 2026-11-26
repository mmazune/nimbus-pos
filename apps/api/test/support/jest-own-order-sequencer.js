// T6 — Jest's own default order, for the second of the two required runs.
// The default run uses T4's fixed order (e2e-sequencer.js). This file hands the choice back to
// Jest's built-in sequencer (by file size and cached durations), so the suite is shown not to
// depend on the order its files run in. Resolved through Jest itself: no new dependency.
const jestPath = require.resolve('jest');
const corePath = require.resolve('@jest/core', { paths: [jestPath] });
const DefaultSequencer = require(
  require.resolve('@jest/test-sequencer', { paths: [corePath] }),
).default;

module.exports = DefaultSequencer;
