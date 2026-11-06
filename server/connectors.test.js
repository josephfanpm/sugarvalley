// Run: npm test. Mocks fetch with payloads shaped like the real Dexcom Share / LibreLinkUp / Nightscout responses.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as dexcom from './connectors/dexcom.js';
import * as libre from './connectors/librelinkup.js';
import * as nightscout from './connectors/nightscout.js';
import { captionFor, stateOf, formatBg, rangeOf, validateThresholds, fromUnit } from '../extension/shared/glucose.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, opts });
    for (const [re, fn] of routes) if (re.test(u)) return fn(u, opts, calls);
    throw new Error(`unmocked ${u}`);
  };
  return calls;
}

test('dexcom: logs in, reads readings, maps trends and dates', async () => {
  const calls = mockFetch([
    [/AuthenticatePublisherAccount/, () => json('acct-1')],
    [/LoginPublisherAccountById/, () => json('sess-1')],
    [/ReadPublisherLatestGlucoseValues/, (u) => {
      assert.match(u, /sessionId=sess-1/);
      return json([
        { WT: 'Date(1762430700000)', Value: 142, Trend: 'Flat' },
        { WT: 'Date(1762430400000)', Value: 138, Trend: 3 },
      ]);
    }],
  ]);
  const cache = {};
  const r = await dexcom.fetchReadings({ username: 'u', password: 'p', region: 'us' }, cache);
  assert.deepEqual(r, [
    { ts: 1762430400000, mgdl: 138, trend: 'FortyFiveUp' },
    { ts: 1762430700000, mgdl: 142, trend: 'Flat' },
  ]);
  assert.equal(cache.sessionId, 'sess-1');
  assert.match(calls[0].url, /^https:\/\/share2\.dexcom\.com/);
});

test('dexcom: expired session re-logs in once', async () => {
  let reads = 0;
  mockFetch([
    [/AuthenticatePublisherAccount/, () => json('acct-1')],
    [/LoginPublisherAccountById/, () => json('sess-new')],
    [/ReadPublisherLatestGlucoseValues/, () => (++reads === 1 ? json({ Code: 'SessionIdNotFound' }, 500) : json([]))],
  ]);
  const cache = { sessionId: 'old' };
  await dexcom.fetchReadings({ username: 'u', password: 'p', region: 'ous' }, cache);
  assert.equal(cache.sessionId, 'sess-new');
});

test('dexcom: bad password is an auth error', async () => {
  mockFetch([[/AuthenticatePublisherAccount/, () => json({ Code: 'AccountPasswordInvalid' }, 500)]]);
  await assert.rejects(dexcom.fetchReadings({ username: 'u', password: 'x', region: 'us' }, {}), (e) => e.auth === true);
});

test('librelinkup: follows region redirect, sends account-id, parses UTC timestamps', async () => {
  const calls = mockFetch([
    [/api\.libreview\.io\/llu\/auth\/login/, () => json({ status: 0, data: { redirect: true, region: 'eu' } })],
    [/api-eu\.libreview\.io\/llu\/auth\/login/, () => json({ status: 0, data: { authTicket: { token: 'tok' }, user: { id: 'user-123' } } })],
    [/\/llu\/connections$/, () => json({ data: [{ patientId: 'pat-9' }] })],
    [/\/llu\/connections\/pat-9\/graph/, () => json({ data: {
      connection: { glucoseMeasurement: { ValueInMgPerDl: 101, TrendArrow: 4, FactoryTimestamp: '11/6/2026 3:05:00 PM' } },
      graphData: [{ ValueInMgPerDl: 95, FactoryTimestamp: '11/6/2026 2:50:00 PM' }],
    } })],
  ]);
  const cache = {};
  const r = await libre.fetchReadings({ email: 'e', password: 'p', region: '' }, cache);
  assert.equal(cache.region, 'eu');
  assert.deepEqual(r, [
    { ts: Date.UTC(2026, 10, 6, 14, 50, 0), mgdl: 95, trend: 'None' },
    { ts: Date.UTC(2026, 10, 6, 15, 5, 0), mgdl: 101, trend: 'FortyFiveUp' },
  ]);
  const graphCall = calls.find((c) => c.url.includes('/graph'));
  assert.equal(graphCall.opts.headers['account-id'].length, 64);
  assert.equal(graphCall.opts.headers.authorization, 'Bearer tok');
});

test('librelinkup: unaccepted terms gives a clear message', async () => {
  mockFetch([[/login/, () => json({ status: 4, data: { step: { type: 'tou' } } })]]);
  await assert.rejects(libre.fetchReadings({ email: 'e', password: 'p', region: 'us' }, {}), /accept the latest terms/);
});

test('nightscout: reads entries with token', async () => {
  const calls = mockFetch([[/entries\/sgv\.json/, () => json([{ sgv: 120, date: 1762430700000, direction: 'SingleDown' }, { type: 'mbg', mbg: 99 }])]]);
  const cfg = nightscout.normalizeConfig({ url: 'my.ns.site/', token: 'tok-1' });
  const r = await nightscout.fetchReadings(cfg);
  assert.deepEqual(r, [{ ts: 1762430700000, mgdl: 120, trend: 'SingleDown' }]);
  assert.match(calls[0].url, /^https:\/\/my\.ns\.site\/api\/v1\/entries\/sgv\.json\?count=150&token=tok-1$/);
});

test('captions never say "alive" when data is stale, and skip jokes on urgent lows', () => {
  const now = Date.now();
  const stale = captionFor({ name: 'Sam', latest: { ts: now - 20 * 60_000, mgdl: 120 }, now });
  assert.doesNotMatch(stale, /alive/);
  for (const mgdl of [48, 320]) {
    const urgent = captionFor({ name: 'Sam', latest: { ts: now, mgdl }, now });
    assert.doesNotMatch(urgent, /alive/);
    assert.match(urgent, /text|call/i);
  }
  assert.match(captionFor({ name: 'Sam', latest: { ts: now, mgdl: 110 }, now }), /^Sam is alive and their blood sugar is 110 mg\/dL\./);
  assert.equal(stateOf({ ts: now, mgdl: 181 }, now), 'high');
  assert.equal(formatBg(180, 'mmol'), '10.0 mmol/L');
});

test('user-defined ranges drive the state and are validated', () => {
  const t = validateThresholds({ urgentLow: 60, low: 80, high: 160, urgentHigh: 220 });
  assert.equal(rangeOf(75, t), 'low');
  assert.equal(rangeOf(170, t), 'high');
  assert.equal(rangeOf(230, t), 'urgent_high');
  assert.equal(rangeOf(59, t), 'urgent_low');
  assert.throws(() => validateThresholds({ urgentLow: 90, low: 80, high: 160, urgentHigh: 220 }), /in order/);
  assert.throws(() => validateThresholds({ urgentLow: 10, low: 80, high: 160, urgentHigh: 220 }), /between/);
  assert.equal(fromUnit(3.9, 'mmol'), 70);
});
