// One-liners: "{name}'s blood sugar is {bg}…". Same line for owner and visitors (picked by reading
// time), changes with each new reading. Safety (design/gdd/safety.md):
//   - urgent states: no jokes (the urgent screen covers the game anyway)
//   - stale data: never implies they're fine
//   - jokes are about the valley and the situation, never blame food or the person
import { formatBg, unitLabel } from './cgm.js';

const LINES = {
  in_range: [
    "{name}'s blood sugar is {bg}. The chickens would like to know the secret.",
    "{name}'s blood sugar is {bg}. Somebody frame this graph.",
    "{name}'s blood sugar is {bg}. Boring. Beautiful. Boring.",
    "{name}'s blood sugar is {bg}. Pancreas who?",
    "{name}'s blood sugar is {bg}. The Sun Well is doing a little dance.",
    "{name}'s blood sugar is {bg}. Out here thriving, frankly.",
    "{name}'s blood sugar is {bg}. The cow is impressed, and she's hard to impress.",
    "{name}'s blood sugar is {bg}. Flat line, full heart.",
    "{name}'s blood sugar is {bg}. Carb counting level: wizard.",
    "{name}'s blood sugar is {bg}. The sunflowers are taking notes.",
  ],
  low: [
    "{name}'s blood sugar is {bg}. Juice box o'clock.",
    "{name}'s blood sugar is {bg}. Snacking for medical reasons. Very official.",
    "{name}'s blood sugar is {bg}. The well is waiting. Snacks first.",
    "{name}'s blood sugar is {bg}. Low-key low. Glucose tabs, assemble.",
    "{name}'s blood sugar is {bg}. Mandatory candy break.",
  ],
  high: [
    "{name}'s blood sugar is {bg}. Insulin has been summoned.",
    "{name}'s blood sugar is {bg}. Sweet. Like, literally.",
    "{name}'s blood sugar is {bg}. The chickens are not worried. Neither are we.",
    "{name}'s blood sugar is {bg}. Pizza math is hard.",
    "{name}'s blood sugar is {bg}. The valley will wait. It's patient like that.",
    "{name}'s blood sugar is {bg}. Running on pure maple syrup.",
  ],
  urgent_low: ["{name}'s blood sugar is urgently low: {bg}."],
  urgent_high: ["{name}'s blood sugar is very high: {bg}."],
  stale: ["{name}'s blood sugar is a mystery right now. Last reading {ago}."],
  none: ["{name}'s blood sugar is a mystery until the CGM connects."],
  hidden: [
    "{name}'s blood sugar is none of your business. Leave a gift anyway.",
    "{name}'s blood sugar is classified. The chickens know, but they won't talk.",
    "{name}'s blood sugar is a secret between {name} and the cow.",
    "{name}'s blood sugar is private. The sunflowers respect that.",
  ],
};

function hash(n) {
  let h = Math.floor(n / 1000) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

function ago(ts, now) {
  const m = Math.round((now - ts) / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} hr ago` : `${Math.floor(h / 24)} days ago`;
}

/** view: the valley view from the server or demo. */
export function captionFor(view, now = Date.now(), salt = 0) {
  const { name, latest, state, unit } = view;
  let key = state;
  if (!view.showNumbers) key = 'hidden';
  else if (!latest) key = 'none';
  const list = LINES[key] || LINES.none;
  const seed = latest?.ts ?? Math.floor(now / 300_000) * 300_000;
  return list[(hash(seed) + salt) % list.length]
    .replaceAll('{name}', name || 'Your friend')
    .replaceAll('{bg}', latest ? `${formatBg(latest.mgdl, unit)} ${unitLabel(unit)}` : '')
    .replaceAll('{ago}', latest ? ago(latest.ts, now) : '');
}
