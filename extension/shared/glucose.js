// Shared by the server, the extension and the share page.

export const STALE_AFTER_MIN = 15;
export const MGDL_PER_MMOL = 18.0182;

/** The T1D user's own ranges, always stored in mg/dL. "Normal" is low..high. */
export const DEFAULT_THRESHOLDS = { urgentLow: 55, low: 70, high: 180, urgentHigh: 250 };

/** Returns cleaned thresholds or throws an Error with a user-facing message. */
export function validateThresholds(t) {
  const out = {};
  for (const k of Object.keys(DEFAULT_THRESHOLDS)) {
    const v = Math.round(Number(t?.[k]));
    if (!Number.isFinite(v) || v < 40 || v > 400) throw new Error('Ranges must be between 40 and 400 mg/dL (2.2–22.2 mmol/L).');
    out[k] = v;
  }
  if (!(out.urgentLow < out.low && out.low < out.high && out.high < out.urgentHigh)) {
    throw new Error('Ranges must go up in order: urgent low < low < high < urgent high.');
  }
  return out;
}

export const TREND_ARROWS = {
  DoubleUp: '⇈', SingleUp: '↑', FortyFiveUp: '↗', Flat: '→',
  FortyFiveDown: '↘', SingleDown: '↓', DoubleDown: '⇊', NotComputable: '', None: '',
};

export function rangeOf(mgdl, t = DEFAULT_THRESHOLDS) {
  if (mgdl < t.urgentLow) return 'urgent_low';
  if (mgdl < t.low) return 'low';
  if (mgdl <= t.high) return 'in_range';
  if (mgdl <= t.urgentHigh) return 'high';
  return 'urgent_high';
}

/** state = range, or 'stale' / 'no_data'. */
export function stateOf(latest, now = Date.now(), t = DEFAULT_THRESHOLDS) {
  if (!latest) return 'no_data';
  if (now - latest.ts > STALE_AFTER_MIN * 60_000) return 'stale';
  return rangeOf(latest.mgdl, t);
}

export const isUrgent = (state) => state === 'urgent_low' || state === 'urgent_high';

export function toUnit(mgdl, unit) {
  return unit === 'mmol' ? Number((mgdl / MGDL_PER_MMOL).toFixed(1)) : Math.round(mgdl);
}
export function fromUnit(value, unit) {
  return unit === 'mmol' ? Math.round(Number(value) * MGDL_PER_MMOL) : Math.round(Number(value));
}
export const unitLabel = (unit) => (unit === 'mmol' ? 'mmol/L' : 'mg/dL');

export function formatBg(mgdl, unit = 'mgdl') {
  return unit === 'mmol' ? `${(mgdl / MGDL_PER_MMOL).toFixed(1)} mmol/L` : `${Math.round(mgdl)} mg/dL`;
}

export function minutesAgo(ts, now = Date.now()) {
  return Math.max(0, Math.round((now - ts) / 60_000));
}

export function formatAgo(ts, now = Date.now()) {
  const m = minutesAgo(ts, now);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} hr ago` : `${Math.floor(h / 24)} days ago`;
}

// Caption bank. Funny in normal / low / high. Urgent states drop the jokes and
// ask the viewer to reach out. Stale / no data never claim the person is "alive".
const CAPTIONS = {
  in_range: [
    '{name} is alive and their blood sugar is {bg}. Suspiciously perfect.',
    '{name} is alive and their blood sugar is {bg}. The robot pancreas sends its regards.',
    '{name} is alive and their blood sugar is {bg}. Pancreas who? Nailed it.',
    '{name} is alive and their blood sugar is {bg}. Somebody frame this graph.',
    '{name} is alive and their blood sugar is {bg}. Carb counting level: wizard.',
    '{name} is alive and their blood sugar is {bg}. Out here thriving, frankly.',
    '{name} is alive and their blood sugar is {bg}. Boring. Beautiful. Boring.',
  ],
  low: [
    '{name} is alive and their blood sugar is {bg}. Juice box: deployed.',
    '{name} is alive and their blood sugar is {bg}. Currently negotiating with a bag of Skittles.',
    '{name} is alive and their blood sugar is {bg}. Eating candy for medical reasons. Very serious.',
    '{name} is alive and their blood sugar is {bg}. Mandatory snack o\'clock.',
    '{name} is alive and their blood sugar is {bg}. Low-key low. Snacks incoming.',
  ],
  high: [
    '{name} is alive and their blood sugar is {bg}. Someone met a bagel.',
    '{name} is alive and their blood sugar is {bg}. Running on pure syrup right now.',
    '{name} is alive and their blood sugar is {bg}. Doing laps to walk off the pasta.',
    '{name} is alive and their blood sugar is {bg}. Insulin has been summoned.',
    '{name} is alive and their blood sugar is {bg}. Pizza math is hard.',
    '{name} is alive and their blood sugar is {bg}. Sweet. Like, literally.',
  ],
  urgent_low: [
    '{name}\'s blood sugar is urgently low: {bg}. Please text or call {name} to make sure they\'re OK.',
    '{name} is at {bg}, which is urgently low. Text or call {name} now to check they have sugar.',
  ],
  urgent_high: [
    '{name}\'s blood sugar is very high: {bg}. Send {name} a text to check in.',
    '{name} is at {bg}, which is very high. Give {name} a call to make sure they\'re OK.',
  ],
  stale: ['No new reading from {name} since {ago}. Their sensor or phone may be offline.'],
  no_data: ['{name} hasn\'t shared a reading yet.'],
};

function hash(n) {
  let h = Math.floor(n / 1000) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Deterministic per reading, so every viewer sees the same caption. */
export function captionFor({ name, latest, unit = 'mgdl', now = Date.now(), thresholds = DEFAULT_THRESHOLDS }) {
  const state = stateOf(latest, now, thresholds);
  const list = CAPTIONS[state];
  const tpl = list[latest ? hash(latest.ts) % list.length : 0];
  return tpl
    .replaceAll('{name}', name || 'Your friend')
    .replaceAll('{bg}', latest ? formatBg(latest.mgdl, unit) : '')
    .replaceAll('{ago}', latest ? formatAgo(latest.ts, now) : '');
}

export const STATE_LABEL = {
  urgent_low: 'Urgent low', low: 'Low', in_range: 'Normal', high: 'High',
  urgent_high: 'Urgent high', stale: 'No recent data', no_data: 'No data',
};
