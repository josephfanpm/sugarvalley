// Safety-rule tests for Sunlight and day scoring (design/gdd/safety.md #4, #5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunlightFrom, dayStats, stateOf } from '../../src/data/cgm.js';

const STEP = 5 * 60_000;
const T0 = new Date(2026, 10, 3, 0, 0).getTime();
const run = (values, start = T0) => values.map((mgdl, i) => ({ ts: start + i * STEP, mgdl }));

test('in-range readings earn 1 sunlight each', () => {
  assert.equal(sunlightFrom(run([100, 120, 150])), 3);
});

test('lows and highs never earn sunlight', () => {
  assert.equal(sunlightFrom(run([60, 50, 65, 200, 260])), 0);
});

test('recovery bonus only pays on return to range, and cannot beat staying in range', () => {
  const dip = sunlightFrom(run([100, 60, 100]));
  const steady = sunlightFrom(run([100, 100, 100]));
  assert.equal(dip, 1 + 1 + 1); // bonus capped at the readings spent out of range
  assert.ok(dip <= steady);
  // Over a full day, excursions are capped: 4 bonuses max.
  const zigzag = run(Array.from({ length: 288 }, (_, i) => (i % 2 ? 60 : 100)));
  const steadyDay = run(Array.from({ length: 288 }, () => 100));
  assert.ok(sunlightFrom(zigzag) < sunlightFrom(steadyDay));
  assert.ok(steady >= 3);
});

test('good day needs TIR goal AND under 4% below range', () => {
  const highTirManyLows = run([...Array(260).fill(110), ...Array(28).fill(60)]); // 90% TIR, ~9.7% low
  assert.equal(dayStats(highTirManyLows).good, false);
  const good = run([...Array(230).fill(110), ...Array(58).fill(200)]); // ~80% TIR, 0% low
  assert.equal(dayStats(good).good, true);
});

test('a day with under half its readings is not scored', () => {
  const s = dayStats(run(Array(100).fill(110)));
  assert.equal(s.enough, false);
  assert.equal(s.good, false);
});

test('stale data is never treated as in range', () => {
  const latest = { ts: Date.now() - 20 * 60_000, mgdl: 110 };
  assert.equal(stateOf(latest), 'stale');
});
