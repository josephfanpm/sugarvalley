// Small pixel-art items the character holds or uses, drawn in 64x64 frame space.
import { px, drawJuice, drawWater } from './avatar.js';

function apple(c, x, y) {
  px(c, '#7f1d1d', x - 1, y, 6, 6); px(c, '#dc2626', x, y + 1, 4, 4); px(c, '#fca5a5', x + 1, y + 1, 1, 1);
  px(c, '#713f12', x + 2, y - 2, 1, 2); px(c, '#16a34a', x + 3, y - 2, 2, 1);
}
function sandwich(c, x, y) {
  px(c, '#78350f', x - 2, y, 9, 6); px(c, '#fcd34d', x - 1, y + 1, 7, 1); px(c, '#4ade80', x - 1, y + 2, 7, 1);
  px(c, '#f87171', x - 1, y + 3, 7, 1); px(c, '#fcd34d', x - 1, y + 4, 7, 1);
}
function donut(c, x, y) {
  px(c, '#78350f', x - 1, y, 7, 6); px(c, '#f472b6', x, y + 1, 5, 4); px(c, '#78350f', x + 2, y + 2, 1, 2);
  px(c, '#fef08a', x + 1, y + 1, 1, 1); px(c, '#60a5fa', x + 3, y + 3, 1, 1);
}
function icecream(c, x, y) {
  px(c, '#9a3412', x, y + 3, 5, 3); px(c, '#d97706', x + 1, y + 3, 3, 2); px(c, '#d97706', x + 2, y + 5, 1, 2);
  px(c, '#be185d', x - 1, y - 2, 7, 5); px(c, '#f9a8d4', x, y - 1, 5, 3); px(c, '#fdf2f8', x + 1, y - 1, 1, 1);
}
function mug(c, x, y) {
  px(c, '#1f2937', x - 1, y, 6, 7); px(c, '#f8fafc', x, y + 1, 4, 5); px(c, '#7c2d12', x, y + 1, 4, 1);
  px(c, '#1f2937', x + 5, y + 2, 2, 3); px(c, 'rgba(255,255,255,0.7)', x + 1, y - 3, 1, 2); px(c, 'rgba(255,255,255,0.5)', x + 3, y - 4, 1, 2);
}
function can(c, x, y) {
  px(c, '#1f2937', x - 1, y - 1, 6, 9); px(c, '#ef4444', x, y, 4, 7); px(c, '#f8fafc', x, y + 3, 4, 1); px(c, '#cbd5e1', x, y - 1, 4, 1);
}
function hotdog(c, x, y) {
  px(c, '#92400e', x - 2, y + 1, 9, 4); px(c, '#fbbf24', x - 1, y + 1, 7, 3); px(c, '#b91c1c', x - 2, y + 2, 9, 1); px(c, '#facc15', x, y + 2, 5, 1);
}
function noodles(c, x, y) {
  px(c, '#111827', x - 2, y + 2, 9, 5); px(c, '#f8fafc', x - 1, y + 3, 7, 3); px(c, '#fde68a', x - 1, y + 2, 7, 1);
  px(c, '#a16207', x + 4, y - 4, 1, 7); px(c, '#a16207', x + 6, y - 3, 1, 6);
}
function cookie(c, x, y) {
  px(c, '#78350f', x - 1, y, 7, 6); px(c, '#d97706', x, y + 1, 5, 4); px(c, '#422006', x + 1, y + 2, 1, 1); px(c, '#422006', x + 3, y + 3, 1, 1);
}

export const ITEMS = {
  juice: { draw: drawJuice, label: 'Drinking a juice box' },
  lemonade: { draw: drawJuice, label: 'Sipping lemonade' },
  water: { draw: drawWater, label: 'Drinking water' },
  apple: { draw: apple, label: 'Eating an apple' },
  sandwich: { draw: sandwich, label: 'Having a sandwich' },
  donut: { draw: donut, label: 'Eating a donut' },
  icecream: { draw: icecream, label: 'Eating ice cream' },
  cocoa: { draw: mug, label: 'Sipping hot cocoa' },
  coffee: { draw: mug, label: 'Having a coffee and a snack' },
  soda: { draw: can, label: 'Drinking a soda' },
  hotdog: { draw: hotdog, label: 'Eating a hot dog' },
  noodles: { draw: noodles, label: 'Slurping noodles' },
  cookie: { draw: cookie, label: 'Eating a cookie' },
};

// Barbell curl: spellcast frames 0-2 move the hands from hips to chest.
const BAR_Y = [48, 45, 44, 44, 45, 48, 48];
export function drawBarbell(c, frame) {
  const y = BAR_Y[frame] ?? 48;
  px(c, '#374151', 9, y - 1, 46, 2); px(c, '#9ca3af', 9, y - 1, 46, 1);
  px(c, '#111827', 7, y - 5, 4, 10); px(c, '#111827', 53, y - 5, 4, 10);
  px(c, '#4b5563', 8, y - 4, 2, 8); px(c, '#4b5563', 54, y - 4, 2, 8);
}

// Jump rope: under the feet while airborne (frames 1-3), over the head otherwise.
export function drawRope(c, frame) {
  const under = frame >= 1 && frame <= 3;
  const midY = under ? 63 : 4, x0 = 18, x1 = 46, y0 = 44;
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, x = x0 + (x1 - x0) * t;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (midY * 2 - y0) + t * t * y0;
    px(c, '#e11d48', Math.round(x), Math.round(Math.min(63, Math.max(0, y))), 1, 1);
  }
  px(c, '#1f2937', x0 - 1, y0 - 1, 3, 3); px(c, '#1f2937', x1 - 1, y0 - 1, 3, 3);
}

// Shopping bag carried while walking, offset by facing direction.
const BAG = { down: [45, 44], up: [17, 44], left: [24, 46], right: [36, 46] };
export function drawBag(c, dir) {
  const [x, y] = BAG[dir];
  px(c, '#7c2d12', x + 1, y - 2, 4, 1); px(c, '#7c2d12', x + 1, y - 2, 1, 3); px(c, '#7c2d12', x + 4, y - 2, 1, 3);
  px(c, '#92400e', x, y, 6, 7); px(c, '#d6a46b', x + 1, y + 1, 4, 5); px(c, '#16a34a', x + 1, y - 1, 2, 2);
}
