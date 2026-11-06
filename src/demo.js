// Offline demo mode (?demo): same view shape as the server, from demo readings + localStorage.
// URL knobs: fresh, sun=N, bg=N (force current reading), viewer, hidden, unit=mmol,
// restored=bridge,coop,... (start with these restored), inv=egg:3,milk:1 (start inventory).
import { demoReadings, buildDays, sunlightFrom, stateOf, isUrgent, dayStart } from './data/cgm.js';
import * as B from './data/balance.js';
import { restoreRule, doChore, cook, freshDay, ripeness } from './data/valley-rules.js';
import { questView, journalView, tagDay, claimQuest, comebacksFrom, steadyMinutes, recapFor } from './data/insights.js';

const q = new URLSearchParams(location.search);
const PROTO = location.hostname.endsWith('github.io') || q.has('prototype');
const KEY = PROTO ? 'sugar-valley-prototype-v1' : 'sugar-valley-demo-v2';
const role = q.has('viewer') ? 'viewer' : 'owner';
const fresh = () => ({
  sun: Number(q.get('sun')) || 120, collectedThrough: 0, wateredDay: 0, gifts: [],
  restored: Object.fromEntries((q.get('restored') || '').split(',').filter(Boolean).map((id) => [id, 1])),
  inventory: Object.fromEntries((q.get('inv') || '').split(',').filter(Boolean).map((p) => { const [k, n] = p.split(':'); return [k, Number(n)]; })),
  chores: {}, day: 0, dishesToday: 0, journal: {}, quests: {},
  cookbook: Object.fromEntries((q.get('cooked') || '').split(',').filter(Boolean).map((id) => [id, 1])),
  ribbons: Number(q.get('ribbons')) || 0,
});

function load() {
  if (q.has('fresh')) return fresh();
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s.sun === 'number') return { ...fresh(), ...s }; } catch { /* blocked */ }
  return fresh();
}
let state = load();
function persist() { if (!q.has('fresh')) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* blocked */ } }

let readings = null;
let meta = null; // prototype: { name, unit, thresholds } published with the readings

/** Prototype: real readings ({ name, unit, thresholds, readings: [[ts, mgdl, trend]] }). */
export function setReadings(doc) {
  if (!doc || !Array.isArray(doc.readings)) return;
  meta = { name: doc.name, unit: doc.unit };
  if (doc.thresholds) T = { ...B.DEFAULT_THRESHOLDS, ...doc.thresholds };
  readings = doc.readings.filter((r) => Number.isFinite(r[0]) && Number.isFinite(r[1]))
    .map(([ts, mgdl, trend]) => ({ ts, mgdl, trend })).sort((a, b) => a.ts - b.ts);
}
function data() {
  if (PROTO) return readings || [];
  if (!readings) {
    readings = demoReadings();
    if (q.get('bg')) readings.push({ ts: Date.now(), mgdl: Number(q.get('bg')) });
  }
  return readings;
}
let T = B.DEFAULT_THRESHOLDS;
const inRangeToday = (rs, today) => rs.filter((r) => r.ts >= today && r.mgdl >= T.low && r.mgdl <= T.high).length;

export function demoView() {
  const now = Date.now(), rs = data(), today = dayStart(now);
  const latest = rs[rs.length - 1];
  const since = Math.max(state.collectedThrough, today);
  const { days, todayStart, todayProgress } = buildDays(rs, { now });
  const st = stateOf(latest, now);
  freshDay(state, todayStart);
  const hidden = q.has('hidden');
  return {
    role, name: meta?.name || (PROTO ? 'Joseph' : 'Sam'), unit: (q.get('unit') || meta?.unit) === 'mmol' ? 'mmol' : 'mgdl', thresholds: T, showNumbers: !hidden,
    latest: hidden ? null : latest, state: st,
    graph: hidden ? null : rs.filter((r) => r.ts >= now - 24 * 3_600_000).map((r) => [r.ts, r.mgdl]),
    days, todayStart, todayProgress,
    valley: {
      sun: state.sun, restored: state.restored, wateredToday: state.wateredDay === todayStart, gifts: state.gifts.length, ribbons: state.ribbons || 0,
      pending: sunlightFrom(rs.filter((r) => r.ts > since)), giftKinds: state.gifts.map((g) => g.kind),
    },
    farm: { inventory: state.inventory, chores: state.chores, cookbook: state.cookbook, dishesToday: state.dishesToday, ripeness: ripeness(inRangeToday(rs, todayStart)) },
    quest: role === 'owner' ? questView(state, rs, { t: T, now }) : null,
    journal: role === 'owner' ? journalView(state, days, todayStart) : null,
    comebacks: hidden ? null : comebacksFrom(rs.filter((r) => r.ts >= todayStart - 2 * 3_600_000), T, { from: todayStart }),
    steady: hidden ? 0 : steadyMinutes(rs, T, now),
    recap: role === 'owner' ? recapFor(days[days.length - 1], rs, T) : null,
    latestTs: latest?.ts ?? null,
    share: PROTO ? null : `${location.origin}/s/demo-link-xxxxxxxx`,
    contactPhone: role === 'viewer' && isUrgent(st) ? '+1 555 0100' : null,
  };
}

export async function demoAct(action, body) {
  const v = demoView(), ctx = { today: v.todayStart, inRangeToday: inRangeToday(data(), v.todayStart) };
  let result = {};
  if (action === 'collect') {
    const fromGifts = state.gifts.length * B.SUN_PER_GIFT;
    result = { collected: v.valley.pending + fromGifts, fromGifts, gifts: state.gifts.length };
    state.sun += v.valley.pending + fromGifts; state.collectedThrough = data().at(-1)?.ts ?? state.collectedThrough; state.gifts = [];
  } else if (action === 'restore') restoreRule(state, body.id);
  else if (action === 'water') state.wateredDay = v.todayStart;
  else if (action === 'gift') state.gifts.push({ kind: body.kind, ts: Date.now() });
  else if (action === 'chore') result = { gives: doChore(state, body.id, ctx) };
  else if (action === 'cook') { const r = cook(state, body.id, ctx); result = { dish: r.recipe.id, sun: r.sun, first: r.first }; }
  else if (action === 'journal') result = tagDay(state, body.day, body.tags);
  else if (action === 'quest') result = claimQuest(state, data(), { t: T, now: Date.now() });
  persist();
  return { ...result, view: demoView() };
}
