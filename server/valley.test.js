// Valley rules: sunlight is server-computed, gifts are capped and blocked during urgent states,
// visitors never get numbers the owner turned off.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

let q, V;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-valley-'));
before(async () => {
  process.env.SUGARPEEK_DB = path.join(tmp, 'test.db');
  ({ q } = await import('./db.js'));
  V = await import('./valley.js');
});

function makeUser({ showGraph = 1, readings = [] } = {}) {
  const id = crypto.randomUUID();
  q.insertUser.run(id, crypto.randomUUID(), 'Sam', '{}', 'mgdl', showGraph, Date.now());
  q.setGameSettings.run(70, 'UTC', id);
  for (const r of readings) q.insertReading.run(id, r.ts, r.mgdl, null);
  // Count every test reading regardless of what time of day the test runs.
  q.saveValley.run(JSON.stringify({ sun: 100, collectedThrough: 0, restored: {}, wateredDay: 0, gifts: [], giftDay: 0, giftsToday: 0 }), id);
  return () => q.userById.get(id);
}
const recent = (values) => values.map((mgdl, i) => ({ ts: Date.now() - (values.length - i) * 5 * 60_000, mgdl }));

test('collect pays in-range readings only, once', () => {
  const u = makeUser({ readings: recent([100, 110, 60, 120]) });
  const first = V.collect(u());
  assert.ok(first.fromReadings >= 3);
  assert.equal(V.collect(u()).fromReadings, 0);
});

test('restore spends sunlight and refuses when short or repeated', () => {
  const u = makeUser({ readings: recent(Array(100).fill(110)) });
  assert.throws(() => V.restore(u(), 'bridge'), /more sunlight/); // welcome 100 < 150
  V.collect(u()); // +100 from readings
  V.restore(u(), 'bridge');
  assert.equal(V.loadValley(u()).sun, 50);
  assert.throws(() => V.restore(u(), 'bridge'), /Already restored/);
});

test('gifts add sunlight up to the daily cap', () => {
  const u = makeUser({ readings: recent([110]) });
  for (let i = 0; i < 7; i++) V.gift(u(), 'heart');
  const r = V.collect(u());
  assert.equal(r.gifts, 7);
  assert.equal(r.fromGifts, 15); // 5 × 3
});

test('no gifts during an urgent low', () => {
  const u = makeUser({ readings: recent([48]) });
  assert.throws(() => V.gift(u(), 'heart'), /Not right now/);
});

test('visitors get no readings or graph when numbers are hidden', () => {
  const u = makeUser({ showGraph: 0, readings: recent([110, 120]) });
  const v = V.valleyView(u(), 'viewer');
  assert.equal(v.latest, null);
  assert.equal(v.graph, null);
  assert.equal(v.valley.pending, undefined);
});

test('hidden visitors get only coarse plant data', () => {
  const day = Array.from({ length: 288 }, (_, i) => 80 + (i % 50) * 3);
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const rs = day.map((mgdl, i) => ({ ts: start.getTime() - 86_400_000 + i * 300_000, mgdl }));
  const u = makeUser({ showGraph: 0, readings: rs });
  const d = V.valleyView(u(), 'viewer').days.at(-1);
  assert.equal(d.cv, 0.25);
  assert.equal(d.curve.length, 4);
  assert.ok(d.curve.every((x) => [-1, 0, 1].includes(x)));
  assert.equal(d.tir % 10, 0);
  assert.equal(d.tbr, undefined);
});
