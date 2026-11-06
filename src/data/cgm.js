// Glucose math shared by the game and the server: day scoring, Sunlight, units, demo data.
// Pure functions, no Phaser, no DOM.
import * as B from './balance.js';

const STEP = 5 * 60_000;
const DAY = 86_400_000;

export function stateOf(latest, now = Date.now(), t = B.DEFAULT_THRESHOLDS) {
  if (!latest || now - latest.ts > B.STALE_AFTER_MIN * 60_000) return 'stale';
  const v = latest.mgdl;
  if (v < t.urgentLow) return 'urgent_low';
  if (v < t.low) return 'low';
  if (v > t.urgentHigh) return 'urgent_high';
  if (v > t.high) return 'high';
  return 'in_range';
}
export const isUrgent = (s) => s === 'urgent_low' || s === 'urgent_high';

/** Re-check a view's state on the client so old data never looks fine (safety.md #3). */
export function liveState(view, now = Date.now()) {
  if (!view.latestTs || now - view.latestTs > B.STALE_AFTER_MIN * 60_000) return 'stale';
  if (view.latest) return stateOf(view.latest, now, view.thresholds);
  return view.state;
}

// UTC offset (minutes) of a time zone at ts. Cached per hour; no DST edge handling beyond that.
const offCache = new Map();
function tzOffset(ts, tz) {
  const key = `${tz}:${Math.floor(ts / 3_600_000)}`;
  if (offCache.has(key)) return offCache.get(key);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  const off = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - (ts - (ts % 60_000))) / 60_000);
  if (offCache.size > 5000) offCache.clear();
  offCache.set(key, off);
  return off;
}

/** Midnight (in `tz`, or the runtime's local zone) of the day containing ts. */
export function dayStart(ts, tz) {
  if (!tz) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  const off = tzOffset(ts, tz) * 60_000;
  const midnight = Math.floor((ts + off) / DAY) * DAY - off;
  return midnight - (tzOffset(midnight, tz) * 60_000 - off);
}

export function groupByDay(readings, tz) {
  const days = new Map();
  for (const r of readings) {
    const k = dayStart(r.ts, tz);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(r);
  }
  return [...days.entries()].sort((a, b) => a[0] - b[0]).map(([start, rs]) => ({ start, readings: rs }));
}

/** Stats for one day of readings. `curve` is mean-centered and scaled to -1..1, resampled to `samples`. */
export function dayStats(readings, { t = B.DEFAULT_THRESHOLDS, goal = B.DEFAULT_TIR_GOAL, samples = 24 } = {}) {
  const n = readings.length;
  const enough = n >= 288 * B.MIN_DAY_COVERAGE;
  if (!n) return { n, enough: false };
  let inR = 0, below = 0, sum = 0;
  for (const r of readings) {
    if (r.mgdl < t.low) below++; else if (r.mgdl <= t.high) inR++;
    sum += r.mgdl;
  }
  const mean = sum / n;
  const sd = Math.sqrt(readings.reduce((a, r) => a + (r.mgdl - mean) ** 2, 0) / n);
  const tir = (100 * inR) / n, tbr = (100 * below) / n;
  const curve = [];
  for (let i = 0; i < samples; i++) {
    const slice = readings.slice(Math.floor((i * n) / samples), Math.max(Math.floor(((i + 1) * n) / samples), Math.floor((i * n) / samples) + 1));
    const m = slice.reduce((a, r) => a + r.mgdl, 0) / slice.length;
    curve.push(Math.max(-1, Math.min(1, (m - mean) / 60)));
  }
  return { n, enough, tir, tbr, mean, cv: sd / mean, curve, good: enough && tir >= goal && tbr < B.MAX_TBR };
}

/** Past days (before today) as garden entries, plus today's progress. */
export function buildDays(readings, { t = B.DEFAULT_THRESHOLDS, goal = B.DEFAULT_TIR_GOAL, tz, now = Date.now() } = {}) {
  const today = dayStart(now, tz);
  const grouped = groupByDay(readings, tz);
  const days = grouped.filter((d) => d.start < today).map((d) => {
    const s = dayStats(d.readings, { t, goal });
    return { start: d.start, enough: s.enough, good: !!s.good, tir: s.tir, tbr: s.tbr, mean: s.mean, cv: s.cv, curve: s.curve?.map((v) => Math.round(v * 100) / 100) };
  });
  const todayCount = grouped.find((d) => d.start === today)?.readings.length || 0;
  return { days, todayStart: today, todayProgress: Math.min(1, todayCount / 288) };
}

export const MGDL_PER_MMOL = 18.0182;
export function formatBg(mgdl, unit = 'mgdl') {
  return unit === 'mmol' ? (mgdl / MGDL_PER_MMOL).toFixed(1) : String(Math.round(mgdl));
}
export const unitLabel = (unit) => (unit === 'mmol' ? 'mmol/L' : 'mg/dL');

/** Sunlight earned from a run of readings (safety.md #4: lows never earn). */
export function sunlightFrom(readings, t = B.DEFAULT_THRESHOLDS, tz) {
  let sun = 0, leftAt = null, recoveries = 0, day = null, outCount = 0;
  for (const r of readings) {
    const d = dayStart(r.ts, tz);
    if (d !== day) { day = d; recoveries = 0; }
    const inRange = r.mgdl >= t.low && r.mgdl <= t.high;
    if (inRange) {
      sun += B.SUN_PER_READING;
      // Comeback bonus, capped so an excursion never earns more than staying in range would have.
      if (leftAt !== null && r.ts - leftAt <= B.RECOVERY_WINDOW_MIN * 60_000 && recoveries < B.RECOVERY_DAILY_CAP) {
        sun += Math.min(B.RECOVERY_BONUS, outCount * B.SUN_PER_READING); recoveries++;
      }
      leftAt = null; outCount = 0;
    } else {
      if (leftAt === null) leftAt = r.ts;
      outCount++;
    }
  }
  return sun;
}

// ---------- demo source (mirrors server/connectors/demo.js) ----------
function live(ts) {
  const h = ts / 3_600_000;
  return 130 + 55 * Math.sin((2 * Math.PI * h) / 4) + 10 * Math.sin((2 * Math.PI * h) / 0.75);
}

/** 21 days of history plus today up to now. Varied days so the garden shows range. */
export function demoReadings(now = Date.now()) {
  const out = [];
  const today = dayStart(now);
  for (let d = 21; d >= 0; d--) {
    const start = today - d * DAY;
    const kind = d === 12 ? 'rough' : d === 5 ? 'gap' : d % 4 === 1 ? 'okay' : 'good';
    const count = kind === 'gap' ? 100 : 288;
    const amp = kind === 'good' ? 22 + (d % 3) * 6 : kind === 'okay' ? 45 : 60;
    const base = kind === 'rough' ? 175 : 112 + (d % 5) * 9;
    for (let i = 0; i < count; i++) {
      const ts = start + i * STEP;
      if (ts > now) break;
      const h = (i * 5) / 60;
      const v = base + amp * Math.sin((2 * Math.PI * (h + d)) / (5 + (d % 3))) + (h > 13 && h < 14.5 ? 50 : 0) + 6 * Math.sin(ts / 700_000);
      out.push({ ts, mgdl: Math.round(v) });
    }
  }
  return out;
}
