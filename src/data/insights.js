// Loops that help people learn their own patterns (design/gdd/quests-journal.md):
//   Weekly pattern quest: the weakest time of day over the last 14 days becomes this week's goal.
//   Garden Journal: tag what happened on a day; insights compare tagged vs untagged days.
// Safety: goals and observations only, never instructions or advice (safety.md #10).
import { dayStart } from './cgm.js';
import * as B from './balance.js';

const DAY = 86_400_000, HOUR = 3_600_000;

export const WINDOWS = {
  overnight: { name: 'night', plural: 'nights', label: 'Overnight', from: 0, to: 6 },
  morning: { name: 'morning', plural: 'mornings', label: 'Morning', from: 6, to: 12 },
  afternoon: { name: 'afternoon', plural: 'afternoons', label: 'Afternoon', from: 12, to: 18 },
  evening: { name: 'evening', plural: 'evenings', label: 'Evening', from: 18, to: 24 },
};
const MIN_WINDOW_READINGS = 36; // half of a 6-hour window

export const TAGS = [
  { id: 'walk', label: 'Walked' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'prebolus', label: 'Pre-bolused' },
  { id: 'lighter', label: 'Lighter meals' },
  { id: 'sleep', label: 'Slept well' },
  { id: 'stress', label: 'Stressed' },
  { id: 'sick', label: 'Sick' },
  { id: 'site', label: 'New site or sensor' },
];
const TAG_IDS = new Set(TAGS.map((t) => t.id));

/** Monday 00:00 of the week containing `now`, in tz. */
export function weekStart(now, tz) {
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', ...(tz ? { timeZone: tz } : {}) }).format(new Date(now));
  const back = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[wd] ?? 0;
  return dayStart(dayStart(now, tz) - back * DAY + 12 * HOUR, tz);
}

/** Per-day, per-window stats: { [dayStart]: { [window]: { n, inR, low } } } */
function windowTable(readings, t, tz, from, to) {
  const out = {};
  for (const r of readings) {
    if (r.ts < from || r.ts >= to) continue;
    const d = dayStart(r.ts, tz), h = (r.ts - d) / HOUR;
    const w = h < 6 ? 'overnight' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    const cell = ((out[d] ||= {})[w] ||= { n: 0, inR: 0, low: 0 });
    cell.n++;
    if (r.mgdl < t.low) cell.low++; else if (r.mgdl <= t.high) cell.inR++;
  }
  return out;
}

/** Pick this week's quest from the 14 days before the week started. */
export function pickQuest(readings, { t, tz, week }) {
  const table = windowTable(readings, t, tz, week - 14 * DAY, week);
  const totals = {};
  for (const day of Object.values(table)) for (const [w, c] of Object.entries(day)) {
    if (c.n < MIN_WINDOW_READINGS) continue;
    const tot = (totals[w] ||= { n: 0, inR: 0, low: 0, days: 0 });
    tot.n += c.n; tot.inR += c.inR; tot.low += c.low; tot.days++;
  }
  const scored = Object.entries(totals).filter(([, c]) => c.days >= 3).map(([w, c]) => ({ w, tir: (100 * c.inR) / c.n, tbr: (100 * c.low) / c.n }));
  if (!scored.length) return { window: 'morning', kind: 'steady', threshold: 70, need: 3, baseline: null };
  // Lows first: a window with too many lows becomes a "no lows" goal.
  const lowest = [...scored].sort((a, b) => b.tbr - a.tbr)[0];
  if (lowest.tbr > B.MAX_TBR) return { window: lowest.w, kind: 'nolows', threshold: 0, need: 3, baseline: Math.round(lowest.tbr) };
  const weakest = [...scored].sort((a, b) => a.tir - b.tir)[0];
  // A reachable step: a little above recent average, never above 85%.
  const threshold = Math.max(60, Math.min(85, Math.round((weakest.tir + 5) / 5) * 5));
  return { window: weakest.w, kind: 'steady', threshold, need: 3, baseline: Math.round(weakest.tir) };
}

function questDays(q, readings, { t, tz, week, now }) {
  const table = windowTable(readings, t, tz, week, Math.min(now, week + 7 * DAY));
  const W = WINDOWS[q.window];
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = dayStart(week + i * DAY + 12 * HOUR, tz);
    const windowEnd = d + W.to * HOUR;
    const c = table[d]?.[q.window];
    let status = 'future';
    if (windowEnd <= now) {
      if (!c || c.n < MIN_WINDOW_READINGS) status = 'nodata';
      else if (q.kind === 'nolows') status = c.low === 0 ? 'done' : 'missed';
      else status = (100 * c.inR) / c.n >= q.threshold ? 'done' : 'missed';
    }
    days.push({ day: d, status });
  }
  return days;
}

export function questView(state, readings, { t, tz, now = Date.now() }) {
  const week = weekStart(now, tz);
  state.quests ||= {};
  if (!state.quests[week]) {
    state.quests[week] = { ...pickQuest(readings, { t, tz, week }), claimed: false };
    for (const k of Object.keys(state.quests)) if (Number(k) < week - 8 * 7 * DAY) delete state.quests[k];
  }
  const q = state.quests[week];
  const W = WINDOWS[q.window];
  const days = questDays(q, readings, { t, tz, week, now });
  // Sick days don't count against you: each one lowers what's needed (never below 1).
  const sick = days.filter((d) => state.journal?.[d.day]?.includes('sick')).length;
  const need = Math.max(1, q.need - sick);
  const done = days.filter((d) => d.status === 'done').length;
  const title = q.kind === 'nolows' ? `${need} ${W.plural} without lows` : `${need} steady ${W.plural}`;
  const detail = q.kind === 'nolows'
    ? `${W.label} (${hours(W)}): no readings under ${t.low}.`
    : `${W.label} (${hours(W)}): ${q.threshold}% or more in range.`;
  const why = q.baseline == null ? null : q.kind === 'nolows'
    ? `Your ${W.plural} had the most lows over the last two weeks.`
    : `Your ${W.plural} were ${q.baseline}% in range over the last two weeks.`;
  return { week, window: q.window, kind: q.kind, title, detail, why, need, done, days, claimed: q.claimed, claimable: !q.claimed && done >= need, reward: B.QUEST_SUN };
}
const hours = (W) => `${fmtH(W.from)}–${fmtH(W.to)}`;
const fmtH = (h) => (h === 0 || h === 24 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`);

export function claimQuest(state, readings, ctx) {
  const v = questView(state, readings, ctx);
  if (!v.claimable) throw new Error(v.claimed ? 'Already claimed this week.' : 'Not finished yet.');
  state.quests[v.week].claimed = true;
  state.sun += B.QUEST_SUN;
  state.ribbons = (state.ribbons || 0) + 1;
  return { sun: B.QUEST_SUN };
}

// ---------- Garden Journal ----------
export function tagDay(state, day, tags, tz) {
  const d = Number(day), today = dayStart(Date.now(), tz);
  if (!(d > today - 7 * DAY) || d > today || dayStart(d + 12 * HOUR, tz) !== d) throw new Error('You can tag the last 7 days.');
  const clean = [...new Set((tags || []).filter((x) => TAG_IDS.has(x)))];
  state.journal ||= {};
  state.journalSun ||= {};
  if (clean.length) state.journal[d] = clean; else delete state.journal[d];
  // A small thank-you for reflecting, once per tagged day.
  let sun = 0;
  if (clean.length && !state.journalSun[d]) { state.journalSun[d] = 1; sun = B.JOURNAL_SUN; state.sun += sun; }
  for (const k of Object.keys(state.journal)) if (Number(k) < today - 60 * DAY) delete state.journal[k];
  for (const k of Object.keys(state.journalSun)) if (Number(k) < today - 60 * DAY) delete state.journalSun[k];
  return { sun };
}

/** Observations from tagged days (needs 3+ tagged and 3+ untagged scored days). */
export function insightsFrom(journal, days) {
  const scored = days.filter((d) => d.enough && d.tir != null);
  const out = [];
  for (const tag of TAGS) {
    const withTag = scored.filter((d) => journal?.[d.start]?.includes(tag.id));
    const tagged = new Set(Object.keys(journal || {}).map(Number));
    const without = scored.filter((d) => tagged.has(d.start) && !journal[d.start].includes(tag.id));
    if (withTag.length < 3 || without.length < 3) continue;
    const a = avg(withTag.map((d) => d.tir)), b = avg(without.map((d) => d.tir));
    if (Math.abs(a - b) < 5) continue;
    out.push({ tag: tag.id, text: `On days tagged "${tag.label}", you averaged ${Math.round(a)}% in range vs ${Math.round(b)}%.`, diff: a - b, n: withTag.length });
  }
  return out.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function journalView(state, days, todayStart) {
  const past = days.slice(-6).reverse().map((d) => ({ day: d.start, tir: d.tir, enough: d.enough, tags: state.journal?.[d.start] || [] }));
  const recent = todayStart ? [{ day: todayStart, today: true, tags: state.journal?.[todayStart] || [] }, ...past] : past;
  const tagged = Object.keys(state.journal || {}).length;
  return { tags: TAGS, recent, insights: insightsFrom(state.journal, days).slice(0, 3), taggedDays: tagged, needForInsights: Math.max(0, 6 - tagged) };
}

// ---------- comebacks, steady streak, morning recap ----------
const STEP_GAP = 15 * 60_000;

/** Returns to range within the recovery window after a high or low. */
export function comebacksFrom(readings, t, { from = 0, to = Infinity } = {}) {
  const out = [];
  let left = null, kind = null, last = null;
  for (const r of readings) {
    if (last && r.ts - last.ts > STEP_GAP) { left = null; kind = null; } // sensor gap: start fresh
    const inRange = r.mgdl >= t.low && r.mgdl <= t.high;
    if (!inRange && left === null) { left = r.ts; kind = r.mgdl < t.low ? 'low' : 'high'; }
    if (inRange && left !== null) {
      const minutes = Math.round((r.ts - left) / 60_000);
      if (minutes <= B.RECOVERY_WINDOW_MIN && r.ts >= from && r.ts < to) out.push({ ts: r.ts, from: kind, minutes });
      left = null; kind = null;
    }
    last = r;
  }
  return out;
}

/** Minutes in range without a break, ending at the latest reading (0 if out of range or stale). */
export function steadyMinutes(readings, t, now = Date.now()) {
  if (!readings.length) return 0;
  const lastR = readings[readings.length - 1];
  if (now - lastR.ts > STEP_GAP) return 0;
  let start = null, prev = null;
  for (let i = readings.length - 1; i >= 0; i--) {
    const r = readings[i];
    if (r.mgdl < t.low || r.mgdl > t.high) break;
    if (prev && prev.ts - r.ts > STEP_GAP) break;
    start = r.ts; prev = r;
  }
  return start === null ? 0 : Math.round((lastR.ts - start) / 60_000);
}

/** Yesterday at a glance, for the morning recap. */
export function recapFor(day, readings, t, tz) {
  if (!day?.enough) return null;
  const rs = readings.filter((r) => r.ts >= day.start && r.ts < day.start + DAY);
  const table = windowTable(rs, t, tz, day.start, day.start + DAY)[day.start] || {};
  let best = null;
  for (const [w, c] of Object.entries(table)) {
    if (c.n < MIN_WINDOW_READINGS) continue;
    const tir = (100 * c.inR) / c.n;
    if (!best || tir > best.tir) best = { window: w, label: WINDOWS[w].label, tir: Math.round(tir) };
  }
  return { day: day.start, tir: Math.round(day.tir), good: day.good, comebacks: comebacksFrom(rs, t).length, best };
}
