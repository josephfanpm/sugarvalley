// Pixel-art glucose graph drawn at native pixel size, then scaled up by the HUD like the rest
// of the UI. Range band, low/high lines, line colored by state, latest point.
import { PAL } from '../data/palette.js';
import { canvasTexture, px } from '../world/pixels.js';

const Y_MIN = 40, Y_MAX = 300;
const GAP_MS = 15 * 60_000;

function line(c, x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(c, color, x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

const colorFor = (v, t) => (v < t.low ? PAL.roseDark : v > t.high ? PAL.goldDark : PAL.ink);

/**
 * points: [[ts, mgdl], ...]. Returns the texture key.
 * opts: { t thresholds, spanMs, now, w, h, ticksEveryMs }
 */
export function graphTexture(scene, key, points, { t, spanMs, now = Date.now(), w, h, ticksEveryMs = 0 }) {
  canvasTexture(scene, key, w, h, (c) => {
    const yOf = (v) => Math.round((h - 2) - ((Math.max(Y_MIN, Math.min(Y_MAX, v)) - Y_MIN) / (Y_MAX - Y_MIN)) * (h - 3));
    const xOf = (ts) => Math.round(((ts - (now - spanMs)) / spanMs) * (w - 3));
    // range band and its edges
    const yHigh = yOf(t.high), yLow = yOf(t.low);
    px(c, '#dff0bb', 0, yHigh, w, yLow - yHigh + 1);
    for (let x = 0; x < w; x += 2) { px(c, PAL.leafLight, x, yHigh); px(c, PAL.leafLight, x, yLow); }
    // time ticks
    if (ticksEveryMs) {
      for (let ts = Math.ceil((now - spanMs) / ticksEveryMs) * ticksEveryMs; ts < now; ts += ticksEveryMs) {
        const x = xOf(ts);
        for (let y = 0; y < h; y += 3) px(c, PAL.creamDark, x, y);
      }
    }
    // line
    const pts = points.filter(([ts]) => ts >= now - spanMs && ts <= now);
    for (let i = 1; i < pts.length; i++) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      if (t1 - t0 > GAP_MS) continue;
      line(c, xOf(t0), yOf(v0), xOf(t1), yOf(v1), colorFor(v1, t));
    }
    if (pts.length === 1) px(c, colorFor(pts[0][1], t), xOf(pts[0][0]), yOf(pts[0][1]));
    // latest point
    const last = pts[pts.length - 1];
    if (last) {
      const x = xOf(last[0]), y = yOf(last[1]);
      px(c, PAL.cream, x - 2, y - 1, 5, 3); px(c, PAL.cream, x - 1, y - 2, 3, 5);
      px(c, colorFor(last[1], t), x - 1, y - 1, 3, 3);
    }
  });
  return key;
}

export { Y_MIN, Y_MAX };
