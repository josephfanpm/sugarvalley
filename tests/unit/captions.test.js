// Caption safety: every line starts with "<name>'s blood sugar is"; urgent and stale never joke or
// imply "fine"; hidden numbers never leak the reading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captionFor } from '../../src/data/captions.js';

const now = Date.now();
const view = (over) => ({ name: 'Sam', unit: 'mgdl', showNumbers: true, latest: { ts: now - 60_000, mgdl: 112 }, state: 'in_range', ...over });

test('every caption starts with the name and "blood sugar is"', () => {
  for (const state of ['in_range', 'low', 'high', 'urgent_low', 'urgent_high', 'stale']) {
    for (let i = 0; i < 40; i++) {
      const c = captionFor(view({ state, latest: { ts: now - i * 300_000, mgdl: 112 } }), now);
      assert.match(c, /^Sam's blood sugar is /, `${state}: ${c}`);
    }
  }
});

test('urgent captions are plain', () => {
  assert.equal(captionFor(view({ state: 'urgent_low', latest: { ts: now, mgdl: 48 } }), now), "Sam's blood sugar is urgently low: 48 mg/dL.");
});

test('stale never shows a value or implies fine', () => {
  const c = captionFor(view({ state: 'stale', latest: { ts: now - 40 * 60_000, mgdl: 112 } }), now);
  assert.doesNotMatch(c, /112/);
  assert.match(c, /40 min ago/);
});

test('hidden numbers never include a reading', () => {
  const c = captionFor(view({ showNumbers: false, latest: null }), now);
  assert.doesNotMatch(c, /\d/);
});

test('mmol units', () => {
  assert.match(captionFor(view({ unit: 'mmol', latest: { ts: now, mgdl: 108 } }), now), /6\.0 mmol\/L/);
});
