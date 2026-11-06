import { rangeOf, DEFAULT_THRESHOLDS } from './glucose.js';

const COLORS = {
  urgent_low: 'var(--c-urgent)', low: 'var(--c-low)', in_range: 'var(--c-ok)', high: 'var(--c-high)', urgent_high: 'var(--c-urgent)',
};

/** 3-hour sparkline as an SVG string. Points are colored by the user's ranges; their normal band is shaded. */
export function sparklineSvg(points, { width = 320, height = 72, spanMs = 3 * 3_600_000, now = Date.now(), thresholds = DEFAULT_THRESHOLDS } = {}) {
  const lo = 40, hi = 300;
  const x = (ts) => ((ts - (now - spanMs)) / spanMs) * (width - 8) + 4;
  const y = (v) => height - 4 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (height - 8);
  const band = `<rect x="0" y="${y(thresholds.high)}" width="${width}" height="${y(thresholds.low) - y(thresholds.high)}" fill="var(--band)" rx="3"/>`;
  const dots = points
    .filter((p) => p.ts >= now - spanMs)
    .map((p) => `<rect x="${(x(p.ts) - 2).toFixed(1)}" y="${(y(p.mgdl) - 2).toFixed(1)}" width="4" height="4" fill="${COLORS[rangeOf(p.mgdl, thresholds)]}"/>`)
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Last 3 hours" preserveAspectRatio="none">${band}${dots}</svg>`;
}
