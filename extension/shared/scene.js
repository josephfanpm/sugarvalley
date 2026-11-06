// Top-down pixel world (40x28 tiles) the user's LPC character explores, doing activities that
// match their blood sugar: eating and drinking when low; running, lifting, jumping rope and
// running errands when high; strolling when normal. Pure canvas, no dependencies.
import { characterSheet, FRAME, DIRS, ANIM_FRAMES, GEAR_SPOTS, DEFAULT_AVATAR, drawCgm, drawPump, px } from './avatar.js';
import { parseLayout, COLS, ROWS, TILE } from './maps.js';
import { ITEMS, drawBarbell, drawRope, drawBag } from './items.js';
import { ITEM_BY_ID } from './game-data.js';
import { Particles, drawPet, drawCheerBubble } from './fx.js';

export const THEMES = [
  { id: 'forest', label: 'Forest' },
  { id: 'city', label: 'City' },
  { id: 'beach', label: 'Beach' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'snow', label: 'Snow' },
];

const W = COLS * TILE, H = ROWS * TILE;

// ---------- drawing helpers ----------
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function blob(c, cx, cy, rx, ry, color, rnd, jitter = 0) {
  c.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    let w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    if (jitter && rnd) w += Math.round((rnd() - 0.5) * jitter);
    if (w >= 0) c.fillRect(Math.round(cx - w), Math.round(cy + dy), 2 * w + 1, 1);
  }
}
function speckle(c, rnd, x, y, w, h, colors, n) {
  for (let i = 0; i < n; i++) px(c, colors[Math.floor(rnd() * colors.length)], Math.floor(x + rnd() * w), Math.floor(y + rnd() * h), 1 + Math.floor(rnd() * 2), 1);
}
const shadow = (c, x, y, rx, ry) => blob(c, x, y, rx, ry, 'rgba(0,0,0,0.22)');
function stripedCircle(c, x, y, r, a, b) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    for (let dx = -w; dx <= w; dx++) px(c, Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 8) % 2 ? a : b, x + dx, y + dy);
  }
  blob(c, x, y, 2, 2, '#f8fafc');
}

// ---------- theme styles ----------
const STYLES = {
  forest: {
    layout: 'park', edge: '#2b5f27',
    ground: ['#5b9e3c', '#4a8a2f', '#73b84e'], path: ['#b8956a', '#9c7a4f', '#c9a77a'],
    water: ['#3b82c4', '#2c6aa3', '#93c5fd'], tree: 'round', leaves: ['#2b5f27', '#3a7d32', '#4f9a42', '#24521f'],
    building: { roof: ['#8b3a2a', '#6e2b1f', '#a54a36'], wall: ['#8a5a34', '#6b4423'], window: '#fde68a', frame: '#3f2615', door: '#4a2e17', logs: true },
    food: { f: 'apple', d: 'juice', c: 'sandwich' }, stall: ['#dc2626', '#fef2f2'],
  },
  snow: {
    layout: 'park', edge: '#cfdbe8',
    ground: ['#eef3f9', '#dfe8f2', '#ffffff'], path: ['#d3dde9', '#bccadb', '#e4ebf3'],
    water: ['#bfe3f2', '#8fbfd6', '#e6f6fd'], tree: 'pine', leaves: ['#24503a', '#2f6448', '#3b7a57', '#4b8f68'],
    building: { roof: ['#ffffff', '#cbd8e6', '#f1f5f9'], wall: ['#7a5230', '#5e3b1f'], window: '#fcd34d', frame: '#3f2615', door: '#3f2615', logs: true },
    food: { f: 'cookie', d: 'cocoa', c: 'sandwich' }, stall: ['#2563eb', '#f8fafc'],
  },
  city: {
    layout: 'urban', edge: '#3b3e45',
    ground: ['#c9c4bb', '#bfb9af', '#d3cec5'], path: ['#b5afa5', '#9f998f', '#c4beb5'],
    water: ['#38bdf8', '#0284c7', '#bae6fd'], tree: 'round', leaves: ['#2f6b2a', '#3f8a35', '#58a845', '#2a5a25'],
    road: ['#3b3e45', '#42464e', '#e6c84a', '#e5e7eb'],
    building: { roof: ['#6b7280', '#4b5563', '#9ca3af'], wall: ['#9a5b4a', '#7c4536'], window: '#bfdbfe', frame: '#1f2937', door: '#1f2937', palette: [['#9a5b4a', '#7c4536'], ['#a8a29e', '#78716c'], ['#64748b', '#475569'], ['#c2a27a', '#9b7f58']] },
    food: { f: 'hotdog', d: 'soda', c: 'coffee' }, stall: ['#dc2626', '#facc15'],
  },
  cyberpunk: {
    layout: 'urban', edge: '#0b0c18',
    ground: ['#1d1f38', '#24264a', '#181a30'], path: ['#2a2c52', '#33365f', '#24264a'],
    water: ['#0e7490', '#155e75', '#67e8f9'], tree: 'pillar', leaves: ['#ff3ea5', '#2de2e6', '#a855f7', '#facc15'],
    road: ['#0b0c18', '#12132a', '#2de2e6', '#ff3ea5'],
    building: { roof: ['#12132a', '#07080f', '#1d1f38'], wall: ['#16172e', '#0b0c18'], window: '#38bdf8', frame: '#07080f', door: '#07080f', neon: ['#ff3ea5', '#2de2e6', '#a855f7', '#facc15'] },
    food: { f: 'noodles', d: 'soda', c: 'donut' }, stall: ['#ff3ea5', '#1b1c33'],
  },
  beach: {
    layout: 'beach', edge: '#2176b3',
    ground: ['#ecd59f', '#d9bf85', '#f5e4b8'], path: ['#b07d4a', '#8a5f35', '#c8955f'],
    water: ['#3ea6d6', '#2f8fc9', '#e0f2fe'], tree: 'palm', leaves: ['#2f7a2c', '#3f9b3a', '#56b34a'],
    building: { roof: ['#f8fafc', '#cbd5e1', '#fde68a'], wall: ['#f9a8d4', '#ec4899'], window: '#bae6fd', frame: '#0f172a', door: '#0e7490', palette: [['#f9a8d4', '#ec4899'], ['#5eead4', '#14b8a6'], ['#fde68a', '#f59e0b'], ['#bfdbfe', '#3b82f6']] },
    food: { f: 'icecream', d: 'lemonade', c: 'sandwich' }, stall: ['#f472b6', '#fef9c3'],
  },
};

// ---------- base layer (ground, paths, water, roads) ----------
const at = (m, x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? null : m.grid[y][x]);

function paintGround(c, st, theme, x, y, rnd, alt) {
  c.fillStyle = st.ground[0]; c.fillRect(x, y, TILE, TILE);
  speckle(c, rnd, x, y, TILE, TILE, [st.ground[1]], 8); speckle(c, rnd, x, y, TILE, TILE, [st.ground[2]], 5);
  if (theme === 'city') { px(c, '#aea89e', x, y, TILE, 1); px(c, '#aea89e', x, y, 1, TILE); px(c, '#aea89e', x + 16, y, 1, TILE); px(c, '#aea89e', x, y + 16, TILE, 1); }
  if (theme === 'cyberpunk') { px(c, '#2b2e55', x, y, TILE, 1); px(c, '#2b2e55', x, y, 1, TILE); px(c, '#3b3f72', x + 3, y + 3); }
  if (!alt) {
    if (theme === 'forest' && rnd() < 0.12) { const fx = x + 6 + rnd() * 20, fy = y + 6 + rnd() * 20, col = ['#ffffff', '#fde047', '#f9a8d4'][Math.floor(rnd() * 3)]; px(c, col, fx, fy - 1, 1, 3); px(c, col, fx - 1, fy, 3, 1); }
    return;
  }
  if (theme === 'forest') speckle(c, rnd, x, y, TILE, TILE, ['#fde047', '#f9a8d4', '#ffffff'], 6);
  if (theme === 'snow') blob(c, x + 16, y + 16, 14, 6, 'rgba(160,185,215,0.25)');
  if (theme === 'city') { px(c, '#6aa84f', x, y, TILE, TILE); speckle(c, rnd, x, y, TILE, TILE, ['#5b9a42', '#7dbb5f'], 14); }
  if (theme === 'cyberpunk') { px(c, '#14152a', x, y, TILE, TILE); px(c, 'rgba(45,226,230,0.45)', x, y + 15, TILE, 1); px(c, 'rgba(45,226,230,0.45)', x + 15, y, 1, TILE); }
  if (theme === 'beach') { px(c, '#fff7ed', x + 8, y + 12, 3, 2); px(c, '#fdba74', x + 20, y + 20, 3, 2); px(c, '#4d7c0f', x + 14, y + 6, 5, 1); px(c, '#65a30d', x + 15, y + 7, 4, 1); }
}

function paintPath(c, st, theme, m, tx, ty, rnd) {
  const x = tx * TILE, y = ty * TILE;
  c.fillStyle = st.path[0]; c.fillRect(x, y, TILE, TILE);
  speckle(c, rnd, x, y, TILE, TILE, [st.path[1], st.path[2]], 10);
  if (theme === 'beach') for (let i = 0; i < TILE; i += 8) { px(c, st.path[1], x, y + i, TILE, 1); px(c, st.path[2], x, y + i + 1, TILE, 1); }
  if (theme === 'city') { px(c, '#a39d93', x, y, TILE, 1); px(c, '#a39d93', x, y, 1, TILE); }
  const isPath = (ch) => ch === '#' || ch === 'X' || ch === 'r';
  const edge = theme === 'cyberpunk' ? '#facc15' : st.path[1];
  if (!isPath(at(m, tx, ty - 1)) && at(m, tx, ty - 1) !== 'R') px(c, edge, x, y, TILE, 2);
  if (!isPath(at(m, tx, ty + 1)) && at(m, tx, ty + 1) !== 'R') px(c, edge, x, y + TILE - 2, TILE, 2);
  if (!isPath(at(m, tx - 1, ty))) px(c, edge, x, y, 2, TILE);
  if (!isPath(at(m, tx + 1, ty))) px(c, edge, x + TILE - 2, y, 2, TILE);
}

function paintRoad(c, st, theme, m, tx, ty, rnd, crossing) {
  const x = tx * TILE, y = ty * TILE;
  c.fillStyle = st.road[0]; c.fillRect(x, y, TILE, TILE);
  speckle(c, rnd, x, y, TILE, TILE, [st.road[1]], 14);
  if (crossing) { for (let i = 2; i < TILE; i += 8) px(c, theme === 'cyberpunk' ? 'rgba(45,226,230,0.55)' : st.road[3], x + i, y, 4, TILE); return; }
  const below = at(m, tx, ty + 1);
  if (below === 'R' || below === 'X') {
    if (theme === 'cyberpunk') { px(c, 'rgba(45,226,230,0.25)', x + 2, y + TILE - 3, 18, 6); px(c, st.road[2], x + 4, y + TILE - 1, 14, 2); }
    else if (tx % 2 === 0) px(c, st.road[2], x + 4, y + TILE - 1, 16, 3);
  }
}

function paintWater(c, st, theme, m, tx, ty, rnd) {
  const x = tx * TILE, y = ty * TILE;
  let base = st.water[0];
  if (theme === 'beach') { const depth = ty - 21; base = depth <= 0 ? '#5cc3e0' : depth <= 2 ? '#3ea6d6' : depth <= 4 ? '#2f8fc9' : '#2176b3'; }
  c.fillStyle = base; c.fillRect(x, y, TILE, TILE);
  if (rnd() < 0.5) px(c, st.water[2], x + 4 + rnd() * 20, y + 6 + rnd() * 20, 4, 1);
  const shore = st.water[1];
  if (at(m, tx, ty - 1) !== 'W' && at(m, tx, ty - 1) !== null) px(c, shore, x, y, TILE, 3);
  if (at(m, tx, ty + 1) !== 'W' && at(m, tx, ty + 1) !== null) px(c, shore, x, y + TILE - 3, TILE, 3);
  if (at(m, tx - 1, ty) !== 'W' && at(m, tx - 1, ty) !== null) px(c, shore, x, y, 3, TILE);
  if (at(m, tx + 1, ty) !== 'W' && at(m, tx + 1, ty) !== null) px(c, shore, x + TILE - 3, y, 3, TILE);
  if (theme === 'snow') { let cx = x + 4 + rnd() * 10, cy = y + 6 + rnd() * 16; for (let s = 0; s < 10; s++) { px(c, '#9ccbe0', cx, cy); cx += 1; cy += rnd() < 0.5 ? 1 : -1; } }
  if (theme === 'cyberpunk') px(c, 'rgba(103,232,249,0.35)', x, y + 14, TILE, 2);
}

function paintDune(c, x, y, rnd) {
  c.fillStyle = '#e2c98f'; c.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 4; i++) { const gx = x + 3 + rnd() * 24, gy = y + 8 + rnd() * 18; px(c, '#6b8e23', gx, gy, 1, 5); px(c, '#7da832', gx + 2, gy + 1, 1, 4); px(c, '#556b2f', gx - 2, gy + 2, 1, 3); }
  px(c, '#8b6a3e', x + 14, y + 4, 3, 22);
}

// ---------- sortable objects (trees, buildings, props): drawn back-to-front with the character ----------
function makeObj(baseX, baseY, w, h, anchorX, anchorY, paint) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.translate(anchorX, anchorY);
  paint(c);
  return { canvas: cv, x: baseX - anchorX, y: baseY - anchorY, w, h, baseY };
}

function treeSprite(st, rnd) {
  return (c) => {
    if (st.tree === 'round') {
      shadow(c, 5, -2, 20, 7); px(c, '#6b4423', -3, -16, 6, 14);
      blob(c, 0, -26, 20, 17, st.leaves[0], rnd, 3); blob(c, -2, -29, 16, 13, st.leaves[1], rnd, 3);
      blob(c, -6, -34, 9, 7, st.leaves[2], rnd, 2); speckle(c, rnd, -16, -40, 30, 26, [st.leaves[3]], 12);
    } else if (st.tree === 'pine') {
      shadow(c, 5, -2, 16, 6); px(c, '#5e3b1f', -2, -10, 4, 8);
      for (const [r, oy, col] of [[16, -16, st.leaves[0]], [13, -24, st.leaves[1]], [10, -32, st.leaves[2]], [6, -39, st.leaves[3]]]) blob(c, 0, oy, r, r * 0.55, col, rnd, 3);
      speckle(c, rnd, -14, -44, 28, 34, ['#ffffff', '#e8f0f8'], 34);
    } else if (st.tree === 'palm') {
      shadow(c, 8, -2, 18, 6);
      for (let i = 0; i < 26; i += 2) px(c, i % 4 ? '#8b6a3e' : '#a07a4a', -2 + Math.round(Math.sin(i / 9) * 3), -4 - i, 4, 2);
      const top = -32;
      for (let a = 0; a < 7; a++) {
        const ang = (a / 7) * Math.PI * 2 + rnd();
        for (let s = 0; s < 20; s += 2) blob(c, Math.cos(ang) * s, top + Math.sin(ang) * s * 0.7 + s * 0.25, s < 6 ? 3 : 2, 2, st.leaves[(a + (s > 10)) % 3]);
      }
      blob(c, 0, top, 4, 3, '#6b4a22');
    } else { // cyberpunk holo pillar
      const neon = st.leaves[Math.floor(rnd() * st.leaves.length)];
      shadow(c, 4, -1, 12, 4);
      px(c, '#07080f', -8, -46, 16, 46); px(c, '#16172e', -6, -44, 12, 42);
      for (let yy = -40; yy < -4; yy += 8) px(c, neon, -6, yy, 12, 1);
      px(c, neon, -8, -48, 16, 3); c.globalAlpha = 0.25; px(c, neon, -11, -51, 22, 9); c.globalAlpha = 1;
    }
  };
}

function buildingComponents(m) {
  const seen = new Uint8Array(COLS * ROWS), comps = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (m.grid[y][x] !== 'B' || seen[y * COLS + x]) continue;
    const tiles = [], stack = [[x, y]];
    seen[y * COLS + x] = 1;
    while (stack.length) {
      const [cx, cy] = stack.pop(); tiles.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (at(m, nx, ny) === 'B' && !seen[ny * COLS + nx]) { seen[ny * COLS + nx] = 1; stack.push([nx, ny]); }
      }
    }
    const xs = tiles.map((t) => t[0]), ys = tiles.map((t) => t[1]);
    comps.push({ tiles, minx: Math.min(...xs), maxx: Math.max(...xs), miny: Math.min(...ys), maxy: Math.max(...ys) });
  }
  return comps;
}

function buildingSprite(st, theme, m, comp, rnd, idx) {
  const b = st.building;
  const [wall, wallDark] = b.palette ? b.palette[idx % b.palette.length] : b.wall;
  const neon = b.neon?.[idx % b.neon.length];
  const ox = comp.minx * TILE, oy = comp.miny * TILE;
  const signs = [];
  const obj = makeObj(0, (comp.maxy + 1) * TILE, (comp.maxx - comp.minx + 1) * TILE, (comp.maxy - comp.miny + 1) * TILE + 6, -ox, -oy, (c) => {
    for (const [tx, ty] of comp.tiles) {
      const x = tx * TILE, y = ty * TILE, isWall = at(m, tx, ty + 1) !== 'B';
      if (!isWall) {
        px(c, b.roof[0], x, y, TILE, TILE);
        speckle(c, rnd, x, y, TILE, TILE, [b.roof[2]], 5);
        if (at(m, tx, ty - 1) !== 'B') px(c, b.roof[2], x, y, TILE, 3);
        if (at(m, tx - 1, ty) !== 'B') px(c, b.roof[1], x, y, 3, TILE);
        if (at(m, tx + 1, ty) !== 'B') px(c, b.roof[1], x + TILE - 3, y, 3, TILE);
        if (theme === 'city' && rnd() < 0.18) { px(c, '#4b5563', x + 8, y + 8, 14, 12); px(c, '#9ca3af', x + 9, y + 9, 12, 10); blob(c, x + 15, y + 14, 4, 4, '#6b7280'); }
        if (theme === 'beach' && (tx + ty) % 2 === 0) px(c, b.roof[1], x, y + 14, TILE, 4);
        if (neon && at(m, tx, ty - 1) !== 'B') px(c, neon, x, y, TILE, 1);
      } else {
        px(c, wall, x, y, TILE, TILE);
        if (b.logs) for (let i = 3; i < TILE; i += 6) px(c, wallDark, x, y + i, TILE, 1);
        else { px(c, wallDark, x, y, TILE, 3); speckle(c, rnd, x, y, TILE, TILE, [wallDark], 6); }
        px(c, 'rgba(0,0,0,0.25)', x, y, TILE, 2);
        if (neon) px(c, neon, x, y + TILE - 2, TILE, 2);
        const place = m.places.find((p) => p.tx === tx && p.ty === ty + 1 && p.onBuilding);
        if (place && (place.kind === 's' || place.kind === 'h')) {
          px(c, b.frame, x + 9, y + 8, 14, 24); px(c, b.door, x + 10, y + 9, 12, 23); px(c, '#fbbf24', x + 19, y + 20, 2, 2);
          if (place.kind === 's') { for (let i = 0; i < 4; i++) px(c, i % 2 ? '#f8fafc' : st.stall[0], x + i * 8, y + 2, 8, 5); }
          else px(c, b.window, x + 13, y + 11, 6, 4);
        } else if (place) {
          for (let i = 0; i < 4; i++) px(c, i % 2 ? st.stall[1] : st.stall[0], x + i * 8, y + 4, 8, 6);
          px(c, b.frame, x + 4, y + 12, 24, 16); px(c, neon || b.window, x + 5, y + 13, 22, 14);
          signs.push({ x: x + 4, y: y + 12, w: 24, h: 16, color: neon || st.stall[0] });
        } else if ((tx + idx) % 2 === 0) {
          px(c, b.frame, x + 7, y + 9, 18, 14); px(c, b.window, x + 8, y + 10, 16, 12); px(c, 'rgba(255,255,255,0.35)', x + 9, y + 11, 5, 2);
          if (neon) { const s = { x: x + 7, y: y + 9, w: 18, h: 14, color: neon }; if (rnd() < 0.5) signs.push(s); }
        }
      }
    }
  });
  obj.x = ox; obj.y = oy; // painted in world coordinates; sorted by its bottom edge
  if (theme === 'cyberpunk' && signs.length) obj.signs = signs;
  return obj;
}

function propSprite(kind, st, theme) {
  const [a, b2] = st.stall;
  return (c) => {
    if (kind === 'f' || kind === 'd') {
      shadow(c, 0, -2, 18, 4);
      if (kind === 'd' && (theme === 'city' || theme === 'cyberpunk')) { // vending machine
        px(c, '#0b0c18', -12, -40, 24, 38); px(c, theme === 'cyberpunk' ? '#1b1c33' : '#b91c1c', -11, -39, 22, 36);
        px(c, '#cffafe', -8, -35, 12, 20);
        for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) px(c, ['#f43f5e', '#facc15', '#22c55e'][k], -7 + k * 4, -33 + r * 6, 3, 4);
        px(c, '#111827', -8, -12, 12, 4); px(c, '#fde68a', 6, -30, 2, 6);
        return;
      }
      px(c, '#7c4a1e', -16, -26, 32, 22); px(c, '#a16207', -15, -25, 30, 4);
      for (let i = 0; i < 4; i++) px(c, i % 2 ? b2 : a, -16 + i * 8, -38, 8, 10);
      px(c, 'rgba(0,0,0,0.2)', -16, -28, 32, 2);
      const item = ITEMS[st.food[kind]];
      c.save(); c.translate(-4, -22); item.draw(c, 0, 0); c.restore();
    } else if (kind === 'g') { // weight rack
      shadow(c, 0, -2, 18, 4);
      px(c, '#1f2937', -16, -30, 3, 28); px(c, '#1f2937', 13, -30, 3, 28);
      px(c, '#6b7280', -20, -26, 40, 2);
      px(c, '#111827', -22, -31, 4, 12); px(c, '#111827', 18, -31, 4, 12);
      px(c, '#374151', -10, -10, 20, 6); px(c, '#4b5563', -9, -9, 18, 2);
    } else if (kind === 'm') {
      shadow(c, 0, -1, 6, 2); px(c, '#4b5563', -1, -16, 3, 15);
      px(c, '#1e3a8a', -6, -26, 12, 11); px(c, '#2563eb', -5, -25, 10, 4); px(c, '#ef4444', 5, -26, 2, 6);
    } else if (kind === 'b') {
      shadow(c, 0, -2, 18, 3);
      px(c, theme === 'cyberpunk' ? '#1b1c33' : '#5e3b1f', -16, -14, 32, 9);
      for (let i = 0; i < 3; i++) px(c, theme === 'cyberpunk' ? '#3f3f62' : '#8a5a34', -15, -13 + i * 3, 30, 2);
      px(c, '#3b3b3b', -14, -5, 2, 4); px(c, '#3b3b3b', 12, -5, 2, 4);
      if (theme === 'cyberpunk') px(c, 'rgba(255,62,165,0.45)', -16, -4, 32, 3);
    } else if (kind === 'w') { // drinking fountain
      shadow(c, 0, -1, 9, 3); px(c, '#6b7280', -3, -14, 6, 13);
      px(c, '#9ca3af', -8, -20, 16, 7); px(c, '#38bdf8', -5, -19, 10, 4); px(c, '#e0f2fe', -1, -23, 2, 4);
    } else if (kind === 'v') {
      if (theme === 'beach') { // lifeguard tower
        shadow(c, 2, -2, 16, 4); px(c, '#b45309', -12, -40, 2, 38); px(c, '#b45309', 10, -40, 2, 38);
        px(c, '#ef4444', -14, -52, 28, 14); px(c, '#f8fafc', -12, -50, 24, 3); px(c, '#b45309', -14, -38, 28, 3);
      } else { // coin telescope
        shadow(c, 0, -1, 7, 2); px(c, '#4b5563', -1, -16, 3, 15); px(c, '#1f2937', -6, -24, 12, 7); px(c, '#9ca3af', 4, -23, 3, 5);
      }
    } else if (kind === 'c') { // cafe table + umbrella, beside the seat
      shadow(c, 18, -3, 12, 4); px(c, '#4b5563', 17, -16, 2, 14); px(c, '#e5e7eb', 10, -18, 16, 4);
      stripedCircle(c, 18, -30, 13, a, b2);
    }
  };
}

const PROP_SIZE = { f: [44, 50], d: [44, 50], g: [52, 40], m: [20, 32], b: [40, 22], w: [24, 30], v: [36, 60], c: [60, 50] };

// ---------- world assembly ----------
const worldCache = new Map();
function world(themeId) {
  const theme = STYLES[themeId] ? themeId : 'forest';
  if (worldCache.has(theme)) return worldCache.get(theme);
  const st = STYLES[theme], m = parseLayout(st.layout), rnd = rng(theme.length * 7919 + 17);
  const base = document.createElement('canvas');
  base.width = W; base.height = H;
  const c = base.getContext('2d');
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    const ch = m.grid[ty][tx], x = tx * TILE, y = ty * TILE;
    if (ch === '#' || ch === 'r') paintPath(c, st, theme, m, tx, ty, rnd);
    else if (ch === 'R' || ch === 'X') paintRoad(c, st, theme, m, tx, ty, rnd, ch === 'X');
    else if (ch === 'W') paintWater(c, st, theme, m, tx, ty, rnd);
    else if (ch === 'F') paintDune(c, x, y, rnd);
    else paintGround(c, st, theme, x, y, rnd, ch === ',');
    if (ch === 'j') { // exercise mat with a coiled rope
      const mat = theme === 'cyberpunk' ? ['#581c87', '#a855f7'] : ['#1e3a8a', '#3b82f6'];
      px(c, 'rgba(0,0,0,0.25)', x + 3, y + 9, 28, 20); px(c, mat[0], x + 2, y + 7, 28, 20); px(c, mat[1], x + 3, y + 8, 26, 18);
      for (let i = 6; i < 26; i += 6) px(c, mat[0], x + 3, y + 7 + i, 26, 1);
      blob(c, x + 24, y + 12, 4, 3, '#e11d48'); blob(c, x + 24, y + 12, 2, 1, mat[1]); px(c, '#1f2937', x + 19, y + 13, 3, 2);
    }
  }

  const objects = [];
  const variants = Array.from({ length: 6 }, () => treeSprite(st, rnd));
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    if (m.grid[ty][tx] !== 'T') continue;
    const jx = Math.round((rnd() - 0.5) * 6);
    objects.push(makeObj(tx * TILE + 16 + jx, ty * TILE + 30, 64, 76, 32, 70, variants[Math.floor(rnd() * variants.length)]));
  }
  buildingComponents(m).forEach((comp, i) => objects.push(buildingSprite(st, theme, m, comp, rnd, i)));
  for (const p of m.places) {
    const size = PROP_SIZE[p.kind];
    if (!size || (p.onBuilding && p.kind !== 'c' && p.kind !== 'm' && p.kind !== 'b' && p.kind !== 'w' && p.kind !== 'v')) continue;
    const [w, h] = size;
    if (p.kind === 'c') objects.push(makeObj(p.x, p.y, w, h, 12, h - 4, propSprite('c', st, theme)));
    else if (p.onBuilding) objects.push(makeObj(p.x + 16, p.y, w, h, w / 2, h - 4, propSprite(p.kind, st, theme)));
    else objects.push(makeObj(p.x, p.ty * TILE, w, h, w / 2, h - 4, propSprite(p.kind, st, theme)));
  }
  objects.sort((a, b) => a.baseY - b.baseY);

  const lanes = [];
  for (let ty = 0; ty < ROWS; ty++) if (m.grid[ty].filter((ch) => ch === 'R' || ch === 'X').length > COLS / 2) lanes.push(ty);
  const shoreRow = m.grid.findIndex((row) => row.every((ch) => ch === 'W'));
  const w = { theme, st, m, base, objects, lanes, shoreRow, overview: null };
  worldCache.set(theme, w);
  return w;
}

function drawObjects(c, list, view, t) {
  for (const o of list) {
    if (o.x > view.x + view.w || o.x + o.w < view.x || o.y > view.y + view.h || o.y + o.h < view.y) continue;
    c.drawImage(o.canvas, o.x, o.y);
    if (o.signs) for (const s of o.signs) {
      const flicker = Math.sin(t * 7 + s.x * 0.13) > 0.97 ? 0.35 : 0.12 + 0.06 * Math.sin(t * 2 + s.y);
      c.globalAlpha = flicker; px(c, s.color, s.x - 2, s.y - 2, s.w + 4, s.h + 4); c.globalAlpha = 1;
    }
  }
}

/** Whole-map preview for the scene picker. */
export function drawThemeThumb(canvas, themeId) {
  const w = world(themeId);
  if (!w.overview) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.drawImage(w.base, 0, 0);
    drawObjects(c, w.objects, { x: 0, y: 0, w: W, h: H }, 0);
    w.overview = cv;
  }
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(w.overview, 0, 0, canvas.width, canvas.height);
}

// ---------- ambient effects ----------
function under(w, c, t, v) {
  const { theme, lanes, shoreRow } = w;
  if ((theme === 'city' || theme === 'cyberpunk') && lanes.length) {
    for (let li = 0; li < lanes.length; li++) {
      const y = lanes[li] * TILE + 16, dir = li % 2 ? -1 : 1, span = W + 160;
      for (let i = 0; i < 3; i++) {
        const p = (i * (span / 3) + t * (60 + li * 12)) % span, x = dir > 0 ? p - 80 : W + 80 - p;
        if (theme === 'city') {
          const col = ['#2563eb', '#f97316', '#16a34a', '#e11d48', '#facc15', '#7c3aed'][(li * 3 + i) % 6];
          shadow(c, x + 2, y + 9, 19, 4);
          px(c, '#111827', x - 18, y - 8, 36, 17); px(c, col, x - 17, y - 7, 34, 15); px(c, '#1f2937', x - 6, y - 6, 14, 13);
          px(c, '#93c5fd', dir > 0 ? x + 8 : x - 9, y - 5, 2, 11);
          px(c, dir > 0 ? '#fde68a' : '#ef4444', dir > 0 ? x + 16 : x - 18, y - 6, 2, 3); px(c, dir > 0 ? '#fde68a' : '#ef4444', dir > 0 ? x + 16 : x - 18, y + 4, 2, 3);
        } else {
          const col = ['#ff3ea5', '#2de2e6', '#a855f7'][(li + i) % 3];
          px(c, 'rgba(0,0,0,0.4)', x - 14, y + 8, 28, 3); px(c, '#1b1c33', x - 14, y - 6, 28, 12); px(c, col, x - 14, y + 4, 28, 2);
          px(c, dir > 0 ? '#fde68a' : '#f43f5e', dir > 0 ? x + 13 : x - 15, y - 4, 2, 8);
        }
      }
    }
  }
  if (theme === 'beach' && shoreRow > 0) {
    const sy = shoreRow * TILE;
    for (let x = Math.max(0, Math.floor(v.x)); x < Math.min(W, v.x + v.w); x += 2) {
      const y = sy + 2 + 3 * Math.sin(t * 1.4 + x / 26);
      px(c, 'rgba(255,255,255,0.9)', x, y, 2, 2); px(c, 'rgba(255,255,255,0.4)', x, y + 3, 2, 1);
    }
    for (let i = 0; i < 30; i++) { const x = (i * 97) % W, y = sy + 30 + (i * 37) % 170; if (Math.sin(t * 3 + i * 2.1) > 0.75) px(c, '#e0f2fe', x, y, 2, 1); }
    const cx = 200 + ((t * 14) % 700), cy = sy - 18;
    px(c, '#dc2626', cx, cy, 6, 4); px(c, '#b91c1c', cx - 2, cy - 1 + (Math.floor(t * 6) % 2), 2, 2); px(c, '#b91c1c', cx + 6, cy - 1 + (Math.floor(t * 6 + 1) % 2), 2, 2);
  }
}

function over(w, c, t, v) {
  if (w.theme === 'forest') {
    for (let i = 0; i < 40; i++) {
      const x = (i * 151) % W + Math.sin(t * 0.6 + i) * 24, y = (i * 89) % H + Math.cos(t * 0.45 + i * 2) * 14;
      if (x < v.x - 4 || x > v.x + v.w || y < v.y - 4 || y > v.y + v.h) continue;
      const a = 0.35 + 0.35 * Math.sin(t * 2.6 + i * 1.7);
      if (a < 0.1) continue;
      px(c, `rgba(254,240,138,${a * 0.35})`, x - 1, y - 1, 4, 4); px(c, `rgba(254,249,195,${a})`, x, y, 2, 2);
    }
  }
  if (w.theme === 'snow') {
    for (let i = 0; i < 55; i++) {
      const sx = v.x + ((i * 113.7) % (v.w + 20)) + Math.sin(t + i) * 6 - 10, sy = v.y + ((i * 71.3 + t * (16 + (i % 3) * 6)) % (v.h + 20)) - 10;
      px(c, 'rgba(255,255,255,0.85)', sx, sy, i % 3 ? 1 : 2, i % 3 ? 1 : 2);
    }
  }
}

// ---------- pathfinding (8-way Dijkstra on the tile grid, prefers paths) ----------
function findPath(m, from, to) {
  const N = COLS * ROWS, dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const open = [from]; dist[from] = 0;
  const cost = (i) => { const ch = m.grid[Math.floor(i / COLS)][i % COLS]; return ch === '#' || ch === 'X' || ch === 'r' ? 1 : 1.5; };
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (dist[open[k]] < dist[open[bi]]) bi = k;
    const cur = open.splice(bi, 1)[0];
    if (cur === to) break;
    const cx = cur % COLS, cy = Math.floor(cur / COLS);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const ni = ny * COLS + nx;
      if (m.blocked[ni] && ni !== to) continue;
      if (dx && dy && (m.blocked[cy * COLS + nx] || m.blocked[ny * COLS + cx])) continue;
      const d = dist[cur] + cost(ni) * (dx && dy ? 1.414 : 1);
      if (d < dist[ni]) { if (dist[ni] === Infinity) open.push(ni); dist[ni] = d; prev[ni] = cur; }
    }
  }
  if (dist[to] === Infinity) return null;
  const path = [];
  for (let i = to; i !== -1; i = prev[i]) path.push(i);
  return path.reverse();
}
const tileOf = (x, y) => Math.max(0, Math.min(ROWS - 1, Math.floor(y / TILE))) * COLS + Math.max(0, Math.min(COLS - 1, Math.floor(x / TILE)));
const stand = (i) => ({ x: (i % COLS) * TILE + 16, y: Math.floor(i / COLS) * TILE + 24 });

// ---------- behaviour ----------
const MOODS = {
  in_range: { face: 'happy' },
  high: { face: 'neutral', sweat: 1 },
  urgent_high: { face: 'sad', sweat: 2, alert: true },
  low: { face: 'neutral', shake: true },
  urgent_low: { face: 'shock', alert: true, shake: true },
  stale: { face: 'closed', zzz: true },
  no_data: { face: 'neutral' },
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class Actor {
  constructor(w) {
    this.w = w; this.x = 640; this.y = 440; this.dir = 'down'; this.anim = 'idle'; this.t = 0; this.frame = 0;
    this.queue = []; this.step = null; this.state = 'in_range'; this.mood = MOODS.in_range; this.label = ''; this.last = null;
    const start = w.m.places.find((p) => p.kind === 'r') || { x: 640, y: 440 };
    this.x = start.x; this.y = start.y;
  }
  places(kind) { return this.w.m.places.filter((p) => kind.includes(p.kind)); }
  nearest(kinds) {
    const ps = this.places(kinds);
    return ps.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
  }
  setState(state, { snap = false } = {}) {
    this.state = state; this.mood = MOODS[state] || MOODS.in_range;
    this.queue = []; this.step = null;
    this.plan();
    if (snap && (state === 'urgent_low' || state === 'urgent_high' || state === 'stale')) {
      const dest = this.queue.find((s) => s.type === 'go');
      if (dest) { Object.assign(this, { x: dest.to.x, y: dest.to.y }); this.queue = this.queue.filter((s) => s.type !== 'go'); }
    }
  }
  go(place, opts = {}) { this.queue.push({ type: 'go', to: { x: place.x, y: place.y }, speed: opts.speed ?? 36, anim: opts.anim ?? 'walk', carry: opts.carry, label: opts.label }); }
  doIt(opts) { this.queue.push({ type: 'do', dur: Infinity, dir: 'down', ...opts }); }
  plan() {
    const st = this.w.st, s = this.state;
    if (s === 'urgent_low') {
      const p = this.nearest(['d', 'f', 'c']);
      if (p) this.go(p, { anim: 'run', speed: 60, label: 'Hurrying to get sugar' });
      this.doIt({ anim: 'sit', item: 'juice', label: 'Treating a low with juice' });
    } else if (s === 'urgent_high') {
      const p = this.nearest(['w', 'b']);
      if (p) this.go(p, { label: 'Heading for water' });
      this.doIt({ anim: 'sit', item: 'water', label: 'Drinking water and resting' });
    } else if (s === 'stale') {
      const p = this.nearest(['h', 'b']);
      if (p) this.go(p, { label: 'Heading home' });
      this.doIt({ anim: 'sit', label: 'Napping' });
    } else if (s === 'no_data') {
      this.doIt({ anim: 'idle', label: 'Hanging out' });
    } else if (s === 'low') { // eat and drink around the map
      const p = pick(this.places(['f', 'd', 'c']).filter((q) => q !== this.last)) || this.nearest(['f', 'd', 'c']);
      this.last = p;
      const item = st.food[p.kind];
      this.go(p, { speed: 32, label: p.kind === 'd' ? 'Getting a drink' : 'Looking for a snack' });
      this.doIt({ anim: p.kind === 'c' ? 'sit' : 'idle', item, dur: 7 + Math.random() * 4, label: ITEMS[item].label });
    } else if (s === 'high') { // stay active
      const options = ['laps', 'lift', 'rope', 'errand', 'walk'].filter((o) => o !== this.last);
      const o = pick(options);
      this.last = o;
      if (o === 'laps') {
        const corners = this.places(['r']), cx = corners.reduce((a, p) => a + p.x, 0) / corners.length, cy = corners.reduce((a, p) => a + p.y, 0) / corners.length;
        corners.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
        const startI = corners.indexOf(this.nearest(['r']));
        for (let lap = 0; lap < 2; lap++) for (let k = 0; k <= corners.length; k++) this.go(corners[(startI + k) % corners.length], { anim: 'run', speed: 84, label: 'Running laps' });
      } else if (o === 'lift') {
        const p = pick(this.places(['g']));
        this.go(p, { speed: 46, label: 'Heading to the gym' });
        this.doIt({ anim: 'spellcast', loop: [0, 1, 2, 2, 1, 0], fps: 6, overlay: 'barbell', dur: 9, label: 'Lifting weights' });
      } else if (o === 'rope') {
        const p = pick(this.places(['j']));
        this.go(p, { speed: 46, label: 'Heading out to jump rope' });
        this.doIt({ anim: 'jump', loop: [0, 1, 2, 3, 4], fps: 9, overlay: 'rope', dur: 7, label: 'Jumping rope' });
      } else if (o === 'errand') {
        const shop = pick(this.places(['s'])), dest = pick(this.places(['h', 'm']));
        this.go(shop, { speed: 46, label: 'Running errands' });
        this.doIt({ anim: 'idle', dur: 2.5, label: 'Shopping' });
        if (dest) { this.go(dest, { speed: 46, carry: true, label: dest.kind === 'm' ? 'Mailing a package' : 'Carrying groceries home' }); this.doIt({ anim: 'idle', dur: 1.5, carry: true, label: 'Dropping off groceries' }); }
      } else {
        const p = pick(this.places(['v', 'b', 'm', 'w']));
        this.go(p, { speed: 50, label: 'Power walking' });
        this.doIt({ anim: 'idle', dur: 1.5, label: 'Power walking' });
      }
    } else { // normal: explore at an easy pace
      const o = pick(['bench', 'view', 'stroll', 'stroll']);
      if (o === 'bench') { const p = pick(this.places(['b'])); this.go(p, { label: 'Strolling' }); this.doIt({ anim: 'sit', dur: 6, label: 'Taking a break on a bench' }); }
      else if (o === 'view') { const p = pick(this.places(['v'])); this.go(p, { label: 'Exploring' }); this.doIt({ anim: 'idle', dur: 4, hop: true, label: 'Enjoying the view' }); }
      else {
        const open = [];
        for (let i = 0; i < COLS * ROWS; i++) if (!this.w.m.blocked[i] && Math.hypot(stand(i).x - this.x, stand(i).y - this.y) > 200) open.push(i);
        const p = stand(pick(open));
        this.go(p, { speed: 34, label: 'Exploring' });
        this.doIt({ anim: 'idle', dur: 2, hop: Math.random() < 0.5, label: 'Exploring' });
      }
    }
  }
  setAnim(a) { if (this.anim !== a) { this.anim = a; this.t = 0; } }
  next() {
    if (!this.queue.length) this.plan();
    this.step = this.queue.shift();
    if (!this.step) return;
    if (this.step.type === 'go') {
      const path = findPath(this.w.m, tileOf(this.x, this.y), tileOf(this.step.to.x, this.step.to.y));
      if (!path) { this.step = null; return; }
      this.step.points = path.slice(1, -1).map(stand).concat([this.step.to]);
    } else this.step.left = this.step.dur;
    if (this.step.label) this.label = this.step.label;
  }
  update(dt) {
    this.t += dt;
    if (!this.step) this.next();
    const s = this.step;
    if (!s) { this.setAnim('idle'); this.frame = Math.floor(this.t * 2.5) % 2; return; }
    if (s.type === 'go') {
      let move = s.speed * dt;
      while (move > 0 && s.points.length) {
        const p = s.points[0], dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
        if (d < 0.5) { s.points.shift(); continue; }
        const stepLen = Math.min(d, move);
        this.x += (dx / d) * stepLen; this.y += (dy / d) * stepLen; move -= stepLen;
        if (d > 2) this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      }
      this.setAnim(s.anim);
      this.carry = !!s.carry;
      if (!s.points.length) this.step = null;
    } else {
      this.dir = s.dir; this.carry = !!s.carry;
      if (s.hop && s.left < s.dur - 0.6 && s.left > s.dur - 1.2) this.setAnim('jump');
      else this.setAnim(s.anim);
      s.left -= dt;
      if (s.left <= 0) this.step = null;
    }
    if (this.reactHop > 0) { this.reactHop -= dt; if (this.anim === 'idle') this.setAnim('jump'); } // happy hop when cheered
    const n = ANIM_FRAMES[this.anim], st = this.step;
    if (this.anim === 'sit') this.frame = 1;
    else if (st?.loop && this.anim === st.anim) this.frame = st.loop[Math.floor(this.t * st.fps) % st.loop.length];
    else if (this.anim === 'walk') this.frame = 1 + (Math.floor(this.t * 10) % (n - 1));
    else if (this.anim === 'run') this.frame = Math.floor(this.t * 13) % n;
    else if (this.anim === 'jump') this.frame = Math.min(n - 1, Math.floor(this.t * 10));
    else this.frame = Math.floor(this.t * 2.5) % n;
  }
  get activity() { return this.step?.type === 'do' ? this.step : null; }
}

function drawAlert(c, x, y, t) {
  const by = Math.round(y + Math.sin(t * 6) * 1.5);
  px(c, '#111827', x - 5, by - 8, 11, 13); px(c, '#ffffff', x - 4, by - 7, 9, 11);
  px(c, '#111827', x - 1, by + 5, 3, 2);
  px(c, '#dc2626', x - 1, by - 5, 3, 5); px(c, '#dc2626', x - 1, by + 1, 3, 2);
}
function drawZ(c, x, y, s, color) {
  for (let i = 0; i < s; i++) { px(c, color, x + i, y); px(c, color, x + i, y + s - 1); }
  for (let i = 1; i < s - 1; i++) px(c, color, x + s - 1 - i, y + i);
}

/**
 * Mounts a live scene on a canvas that fills its parent.
 * opts.scale: CSS pixels per world pixel (default fits the viewport).
 * opts.focusY: where the character sits vertically on screen (0..1).
 * opts.onActivity(label): called when the character starts something new.
 */
export function mountScene(canvas, assets, initial, opts = {}) {
  let cfg = { avatar: DEFAULT_AVATAR, theme: 'forest', state: 'in_range', ...initial };
  let w = world(cfg.theme);
  let actor = new Actor(w);
  actor.setState(cfg.state, { snap: true });
  const ctx = canvas.getContext('2d');
  let running = true, last = performance.now(), clock = 0, cam = null, lastLabel = '';
  const ready = new Map(); // resolved sheets, so switching animation never blinks
  const particles = new Particles();
  let pet = null, trailClock = 0, reaction = null, confettiPending = false;
  const trailHistory = [];

  // Unlocked cosmetics (item ids from game-data.js) → what the sprite compositor needs.
  function gearSpec() {
    const g = cfg.gear || {}, hat = ITEM_BY_ID[g.hat], glasses = ITEM_BY_ID[g.glasses];
    if (!hat && !glasses) return null;
    return { hat: hat ? { part: hat.part, color: hat.color } : undefined, glasses: glasses ? { part: glasses.part } : undefined };
  }

  function getSheet(anim) {
    const gear = gearSpec();
    const key = JSON.stringify([cfg.avatar, anim, actor.mood.face, gear]);
    if (ready.has(key)) return ready.get(key);
    ready.set(key, null);
    characterSheet(assets, cfg.avatar, anim, actor.mood.face, gear).then((sh) => ready.set(key, sh));
    return null;
  }

  // The pet trails a short way behind, then settles beside the character when it stops.
  function updatePet(dt) {
    const id = cfg.gear?.pet;
    if (!id) { pet = null; return; }
    trailHistory.push({ x: actor.x, y: actor.y, t: clock });
    while (trailHistory.length && clock - trailHistory[0].t > 0.6) trailHistory.shift();
    const moving = actor.step?.type === 'go';
    const goal = moving ? trailHistory[0] : { x: actor.x + 20, y: actor.y + 4 };
    pet ??= { x: goal.x, y: goal.y, facing: 'right' };
    const dx = goal.x - pet.x, dy = goal.y - pet.y, d = Math.hypot(dx, dy);
    if (d > 0.5) {
      const step = Math.min(d, Math.max(40, d * 4) * dt);
      pet.x += (dx / d) * step; pet.y += (dy / d) * step;
      if (Math.abs(dx) > 0.5) pet.facing = dx > 0 ? 'right' : 'left';
    }
    pet.sitting = !moving && d < 2;
  }

  // rAF normally drives the loop; the timer covers environments that throttle or skip rAF.
  function schedule() {
    let done = false;
    const run = (t) => { if (!done) { done = true; frame(typeof t === 'number' ? t : performance.now()); } };
    requestAnimationFrame(run);
    setTimeout(run, 50);
  }

  function drawCharacter(ax, ay) {
    const m = actor.mood, act = actor.activity;
    const sheet = getSheet(actor.anim);
    ctx.save(); ctx.translate(ax, ay);
    blob(ctx, 0, -1, 10, 3, 'rgba(0,0,0,0.25)');
    if (sheet) {
      ctx.drawImage(sheet, actor.frame * FRAME, DIRS[actor.dir] * FRAME, FRAME, FRAME, -32, -62, FRAME, FRAME);
      ctx.save(); ctx.translate(-32, -62);
      const spots = actor.dir === 'down' && GEAR_SPOTS[actor.anim];
      if (spots) {
        if (cfg.avatar.t1d?.cgm) drawCgm(ctx, ...spots.cgm);
        if (cfg.avatar.t1d?.pump) drawPump(ctx, ...spots.pump);
        if (act?.item) ITEMS[act.item].draw(ctx, ...spots.hand);
      }
      if (act?.overlay === 'barbell' && actor.anim === 'spellcast') drawBarbell(ctx, actor.frame);
      if (act?.overlay === 'rope' && actor.anim === 'jump') drawRope(ctx, actor.frame);
      if (actor.carry && (actor.anim === 'walk' || actor.anim === 'idle')) drawBag(ctx, actor.dir);
      if (m.sweat && actor.anim !== 'sit') {
        for (let i = 0; i < m.sweat; i++) {
          const dy = 12 + ((clock * 8 + i * 2) % 5), dx = i ? 17 : 44;
          px(ctx, '#1e3a8a', dx, dy, 3, 4); px(ctx, '#60a5fa', dx, dy + 1, 3, 2); px(ctx, '#dbeafe', dx, dy + 1, 1, 1);
        }
      }
      ctx.restore();
      const headY = -(actor.anim === 'sit' ? 46 : 54);
      if (m.alert) drawAlert(ctx, 0, headY - 12, clock);
      else if (reaction && clock < reaction.until) drawCheerBubble(ctx, reaction.kind, 0, headY - 14, clock);
      if (m.zzz && actor.anim === 'sit') { const r = Math.floor(clock * 2) % 3; drawZ(ctx, 8, headY - 2 - r, 3, '#6366f1'); drawZ(ctx, 12, headY - 9 - r, 4, '#818cf8'); drawZ(ctx, 17, headY - 17 - r, 5, '#a5b4fc'); }
    }
    ctx.restore();
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now; clock += dt;
    actor.update(dt);
    updatePet(dt);
    particles.update(dt);
    if (cfg.gear?.trail && actor.step?.type === 'go') {
      trailClock += dt;
      while (trailClock > 0.07) { trailClock -= 0.07; particles.emit(actor.x + (Math.random() - 0.5) * 10, actor.y - 4 - Math.random() * 10, cfg.gear.trail); }
    }
    for (const a of ['idle', 'walk', 'run', 'sit', 'jump', 'spellcast']) getSheet(a);
    if (ready.size > 60) ready.clear();
    if (actor.label !== lastLabel) { lastLabel = actor.label; opts.onActivity?.(lastLabel); }

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (!cssW || !cssH) return schedule();
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    }
    const scale = opts.scale ?? Math.max(2, Math.min(6, Math.floor(Math.min(cssH / 230, cssW / 130))));
    const s = Math.max(1, Math.round(scale * dpr));
    const vw = canvas.width / s, vh = canvas.height / s;

    const fx = actor.x, fy = actor.y - 24 + (opts.focusY != null ? (0.5 - opts.focusY) * vh : 0);
    cam ??= { x: fx, y: fy };
    cam.x += (fx - cam.x) * Math.min(1, dt * 3); cam.y += (fy - cam.y) * Math.min(1, dt * 3);
    // Camera stays fractional; the world is snapped to whole *device* pixels so scrolling is smooth.
    const cx = vw >= W ? (W - vw) / 2 : Math.max(0, Math.min(W - vw, cam.x - vw / 2));
    const cy = vh >= H ? (H - vh) / 2 : Math.max(0, Math.min(H - vh, cam.y - vh / 2));
    const ox = Math.round(cx * s), oy = Math.round(cy * s);
    const view = { x: cx, y: cy, w: vw, h: vh };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = w.st.edge; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, -ox, -oy);
    ctx.drawImage(w.base, 0, 0);
    under(w, ctx, clock, view);

    // depth-sorted: objects whose base is above the character's feet go behind it
    const ax = (Math.round((actor.x - cx) * s) + ox) / s + (actor.mood.shake && actor.anim === 'sit' ? (Math.floor(clock * 8) % 2 ? 1 : -1) : 0);
    const ay = (Math.round((actor.y - cy) * s) + oy) / s;
    const split = w.objects.findIndex((o) => o.baseY > actor.y);
    const behind = split === -1 ? w.objects : w.objects.slice(0, split), front = split === -1 ? [] : w.objects.slice(split);
    drawObjects(ctx, behind, view, clock);
    particles.draw(ctx, clock, (p) => p.kind !== 'confetti');
    const drawPetNow = () => pet && drawPet(ctx, cfg.gear.pet, (Math.round((pet.x - cx) * s) + ox) / s, (Math.round((pet.y - cy) * s) + oy) / s, pet.facing, clock, pet.sitting);
    if (pet && pet.y < actor.y) drawPetNow();
    drawCharacter(ax, ay);
    if (pet && pet.y >= actor.y) drawPetNow();
    drawObjects(ctx, front, view, clock);
    over(w, ctx, clock, view);
    particles.draw(ctx, clock, (p) => p.kind === 'confetti');
    if (confettiPending) {
      confettiPending = false;
      const colors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
      for (let i = 0; i < 140; i++) particles.emit(view.x + Math.random() * view.w, view.y - 10 - Math.random() * 30, 'confetti', { life: 2.5 + Math.random(), vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 30, color: colors[i % colors.length] });
    }

    if (actor.mood.alert && opts.vignette !== false) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const a = 0.18 + 0.1 * Math.sin(clock * 3);
      const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75);
      g.addColorStop(0, 'rgba(220,38,38,0)'); g.addColorStop(1, `rgba(220,38,38,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    schedule();
  }
  schedule();

  return {
    update(next) {
      const prev = cfg;
      cfg = { ...cfg, ...next };
      if (next.theme && next.theme !== prev.theme) {
        w = world(cfg.theme); actor = new Actor(w); actor.setState(cfg.state, { snap: true }); cam = null;
      } else if (next.state && next.state !== prev.state) actor.setState(cfg.state);
    },
    /** A viewer cheered: show the icon over the character's head and do a little hop. */
    react(kind) { reaction = { kind, until: clock + 2.4 }; actor.reactHop = 0.6; },
    /** Milestone celebration: confetti across the screen. */
    celebrate() { confettiPending = true; },
    stop() { running = false; },
  };
}
