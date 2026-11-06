// Garden of Days: one plant per day, generated from that day's readings.
// See design/gdd/garden-of-days.md. Output is a 16x32 palette-only pixel sprite.
import { PAL } from '../data/palette.js';
import { canvasTexture, px } from './pixels.js';

export const PLANT_W = 16, PLANT_H = 32;

// Bloom colors by mean glucose. Every hue is pretty; none means "bad".
const BLOOMS = [
  { max: 115, c: [PAL.blueDark, PAL.blue, PAL.blueLight] },
  { max: 135, c: [PAL.violetDark, PAL.violet, PAL.violetLight] },
  { max: 155, c: [PAL.roseDark, PAL.rose, PAL.roseLight] },
  { max: 175, c: [PAL.peachDark, PAL.peach, PAL.peachLight] },
  { max: Infinity, c: [PAL.yellowDark, PAL.yellow, PAL.yellowLight] },
];
const bloomFor = (mean) => BLOOMS.find((b) => mean <= b.max).c;

function rng(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function soil(c) {
  px(c, PAL.woodMid, 4, 29, 8, 2);
  px(c, PAL.wood, 5, 29, 6, 1);
  px(c, PAL.woodLight, 6, 29, 2, 1);
  px(c, PAL.woodDark, 3, 30, 1, 1); px(c, PAL.woodDark, 12, 30, 1, 1);
  px(c, PAL.woodDark, 4, 31, 8, 1);
}

function leaf(c, x, y, dir, big) {
  // dir: 1 right, -1 left
  const p = (dx, dy, col) => px(c, col, x + dx * dir, y + dy);
  p(1, 0, PAL.leafDark); p(2, -1, PAL.leafMid); p(1, -1, PAL.leafMid); p(3, -1, PAL.leafDark);
  p(2, 0, PAL.leafLight);
  if (big) { p(3, -2, PAL.leafMid); p(4, -2, PAL.leafDark); p(2, -2, PAL.leafLight); }
}

function bloom(c, cx, cy, r, colors, rnd) {
  const [dark, mid, light] = colors;
  const petals = r >= 3 ? 6 : 5;
  const spots = [];
  for (let k = 0; k < petals; k++) {
    const a = (k / petals) * Math.PI * 2 + rnd() * 0.3;
    spots.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.85)]);
  }
  // outline pass first, then fill, so petals read as rounded blobs
  for (const [x, y] of spots) { px(c, dark, x - 1, y - 1, 3, 3); }
  for (const [x, y] of spots) { px(c, mid, x - 1, y, 2, 1); px(c, mid, x, y - 1, 1, 2); px(c, light, x - 1, y - 1, 1, 1); }
  px(c, PAL.goldDark, cx - 1, cy - 1, 3, 3);
  px(c, PAL.goldLight, cx - 1, cy - 1, 2, 2);
  px(c, PAL.sun, cx - 1, cy - 1, 1, 1);
}

/** Draw a day plant. stats from cgm.dayStats; `today` = still growing (0..1 of the day). */
export function drawPlant(c, stats, seed, today = null) {
  const rnd = rng(seed);
  soil(c);
  if (today !== null) return sprout(c, today);
  if (!stats.enough) return stone(c);
  if (!stats.good) return shrub(c, stats, rnd);

  const H = Math.min(25, 12 + Math.round((stats.tir - 60) * 0.32));
  const curve = stats.curve;
  let x = 8, prevX = 8;
  const stem = [];
  for (let i = 0; i <= H; i++) {
    const t = i / H;
    const v = curve[Math.min(curve.length - 1, Math.floor(t * curve.length))];
    x = 8 + Math.round(v * 2.2 * Math.min(1, t * 1.6));
    if (Math.abs(x - prevX) > 1) x = prevX + Math.sign(x - prevX);
    stem.push([x, 28 - i]);
    prevX = x;
  }
  for (const [sx, sy] of stem) { px(c, PAL.leafDark, sx - 1, sy); px(c, PAL.leaf, sx, sy); }
  // leaves: steadier days (low CV) grow more
  const leaves = Math.max(1, Math.min(4, Math.round(4.6 - stats.cv * 9)));
  for (let k = 0; k < leaves; k++) {
    const idx = Math.round(((k + 1) / (leaves + 1.5)) * H * 0.8) + 1;
    const [lx, ly] = stem[Math.min(stem.length - 1, idx)];
    leaf(c, lx, ly, k % 2 ? 1 : -1, k === 0);
  }
  const [tx, ty] = stem[stem.length - 1];
  const r = stats.tir >= 92 ? 3 : stats.tir >= 80 ? 2.5 : 2;
  bloom(c, tx, ty - 1, r, bloomFor(stats.mean), rnd);
}

function shrub(c, stats, rnd) {
  // A sturdy round bush with small buds: rough days still grow something.
  const cx = 8, cy = 24, rx = 5, ry = 4;
  for (let dy = -ry - 1; dy <= ry + 1; dy++) for (let dx = -rx - 1; dx <= rx + 1; dx++) {
    const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    if (d <= 1) px(c, dy < -1 && dx < 1 ? PAL.leafLight : dy > 1 ? PAL.leaf : PAL.leafMid, cx + dx, cy + dy);
    else if (d <= 1.45) px(c, PAL.leafDark, cx + dx, cy + dy);
  }
  const [dark, mid] = bloomFor(stats.mean);
  const buds = 2 + Math.round(rnd() * 2);
  for (let k = 0; k < buds; k++) {
    const bx = cx - 3 + Math.round(rnd() * 6), by = cy - 3 + Math.round(rnd() * 4);
    px(c, dark, bx, by + 1); px(c, mid, bx, by);
  }
}

function stone(c) {
  px(c, PAL.stoneDark, 4, 24, 8, 5); px(c, PAL.stoneDark, 5, 23, 6, 1);
  px(c, PAL.stone, 5, 24, 6, 4); px(c, PAL.stoneLight, 5, 24, 3, 1);
  px(c, PAL.leafMid, 9, 24, 2, 1); px(c, PAL.leafLight, 10, 23, 1, 1);
}

function sprout(c, progress) {
  const H = 3 + Math.round(progress * 7);
  for (let i = 0; i <= H; i++) { px(c, PAL.leafDark, 7, 28 - i); px(c, PAL.leaf, 8, 28 - i); }
  const top = 28 - H;
  leaf(c, 8, top + 1, 1, progress > 0.5);
  leaf(c, 7, top + 2, -1, false);
}

export function plantTexture(scene, key, stats, seed, today = null) {
  return canvasTexture(scene, key, PLANT_W, PLANT_H, (c) => drawPlant(c, stats, seed, today));
}
