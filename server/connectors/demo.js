// Simulated CGM so the prototype works without real credentials.
// "live" drifts through every range over a few hours; the others pin a state.
import { ConnectorError } from './common.js';

export const SCENARIOS = ['live', 'in_range', 'high', 'urgent_high', 'low', 'urgent_low', 'stale'];
const STEP = 5 * 60_000;

export function normalizeConfig({ scenario }) {
  if (!SCENARIOS.includes(scenario)) throw new ConnectorError('Unknown demo scenario.');
  return { scenario };
}

const TARGET = { in_range: [118, 112], high: [170, 214], urgent_high: [240, 287], low: [96, 64], urgent_low: [72, 48] };

function live(t) {
  const h = t / 3_600_000;
  return 130 + 75 * Math.sin((2 * Math.PI * h) / 4) + 10 * Math.sin((2 * Math.PI * h) / 0.75);
}

function trendFrom(prev, cur) {
  const perMin = (cur - prev) / 5;
  if (perMin > 3) return 'DoubleUp';
  if (perMin > 2) return 'SingleUp';
  if (perMin > 1) return 'FortyFiveUp';
  if (perMin >= -1) return 'Flat';
  if (perMin >= -2) return 'FortyFiveDown';
  if (perMin >= -3) return 'SingleDown';
  return 'DoubleDown';
}

// Three weeks of history so the rewards game has something to score: mostly good days,
// one missed day (12 days ago) and one sensor-gap day (5 days ago) that doesn't count.
function history(before) {
  const out = [], DAY = 86_400_000, today = Math.floor(Date.now() / DAY) * DAY;
  for (let d = 21; d >= 0; d--) {
    const start = today - d * DAY, kind = d === 12 ? 'miss' : d === 5 ? 'gap' : 'good';
    const count = kind === 'gap' ? 100 : 288;
    for (let i = 0; i < count; i++) {
      const ts = start + i * STEP;
      if (ts >= before) break;
      const h = (i * 5) / 60, wobble = 6 * Math.sin(ts / 700_000);
      const v = kind === 'miss'
        ? 185 + 55 * Math.sin((2 * Math.PI * h) / 7) + wobble // lots of highs
        : 120 + 28 * Math.sin((2 * Math.PI * h) / 5) + (h > 13 && h < 14.5 ? 70 : 0) + wobble; // one post-lunch bump
      out.push({ ts, mgdl: Math.round(v), trend: 'Flat' });
    }
  }
  return out;
}

export async function fetchReadings(cfg, cache = {}) {
  const recent = await recentReadings(cfg);
  if (cache.historySent) return recent;
  cache.historySent = true;
  return [...history(recent[0].ts), ...recent];
}

async function recentReadings(cfg) {
  let end = Math.floor(Date.now() / STEP) * STEP;
  if (cfg.scenario === 'stale') end -= 40 * 60_000;
  const n = 144; // 12 hours
  const values = [];
  for (let i = n - 1; i >= 0; i--) {
    const ts = end - i * STEP;
    let v;
    if (cfg.scenario === 'live' || cfg.scenario === 'stale') v = live(ts);
    else {
      // drift normally, then ease into the pinned state over the last 3 hours
      const ramp = 36;
      if (i >= ramp) v = live(ts);
      else {
        const from = live(end - ramp * STEP), to = TARGET[cfg.scenario][1];
        const k = 1 - i / ramp;
        v = from + (to - from) * k * k + 3 * Math.sin(ts / 900_000);
      }
    }
    values.push({ ts, mgdl: Math.round(v) });
  }
  return values.map((r, i) => ({ ...r, trend: i ? trendFrom(values[i - 1].mgdl, r.mgdl) : 'Flat' }));
}
