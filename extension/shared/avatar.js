// LPC layered character: palette-swaps the base sprites and composites every layer
// into one sheet per (avatar, animation, face). The scene engine draws frames from those sheets.
// No DOM access at import time (the server imports DEFAULT_AVATAR from here).

export const FRAME = 64;
export const DIRS = { up: 0, left: 1, down: 2, right: 3 };
export const ANIM_FRAMES = { idle: 2, sit: 3, walk: 9, run: 8, jump: 5, spellcast: 7 };
// Parts missing an animation borrow one that has the same rhythm.
const FALLBACK = { run: 'walk', jump: 'idle', walk: 'idle', sit: 'idle', spellcast: 'idle' };

export const DEFAULT_AVATAR = {
  v: 1,
  body: 'male',
  skin: 'light',
  eyes: 'brown',
  hair: 'messy',
  hairColor: 'dark_brown',
  shirt: 'tshirt',
  shirtColor: 'blue',
  legs: 'pants',
  legsColor: 'navy',
  shoes: 'basic',
  shoesColor: 'black',
  t1d: { cgm: true, pump: false },
};

let assetsPromise;
export function loadAssets(base) {
  assetsPromise ??= Promise.all(
    ['catalog', 'palettes', 'credits'].map((f) => fetch(`${base}/${f}.json`).then((r) => r.json())),
  ).then(([catalog, palettes, credits]) => ({ base, catalog, palettes, credits }));
  return assetsPromise;
}

const imgCache = new Map();
function loadImage(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(`sprite ${src}`));
      i.src = src;
    }));
  }
  return imgCache.get(src);
}

const hexToInt = (h) => parseInt(h.replace('#', ''), 16);

function buildColorMap(assets, recolor) {
  const map = new Map();
  for (const [material, variant] of recolor) {
    const pal = assets.palettes[material];
    if (!pal) continue;
    const from = pal.colors[pal.base];
    const to = pal.colors[variant] || from;
    from.forEach((c, i) => map.set(hexToInt(c), hexToInt(to[i] ?? c)));
  }
  return map;
}

// Some LPC sheets drift a few shades from their palette (e.g. eye colors on faces),
// so match within a small per-channel tolerance like the LPC generator does.
const TOLERANCE = 8;
function matchColor(map, rgb) {
  const exact = map.get(rgb);
  if (exact !== undefined) return exact;
  const r = rgb >> 16, g = (rgb >> 8) & 255, b = rgb & 255;
  for (const [from, to] of map) {
    if (Math.abs((from >> 16) - r) <= TOLERANCE && Math.abs(((from >> 8) & 255) - g) <= TOLERANCE && Math.abs((from & 255) - b) <= TOLERANCE) return to;
  }
  return null;
}

async function recolored(src, map) {
  const img = await loadImage(src);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  if (map.size) {
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const px = d.data, memo = new Map();
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const rgb = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      let to = memo.get(rgb);
      if (to === undefined) { to = matchColor(map, rgb); memo.set(rgb, to); }
      if (to !== null) { px[i] = to >> 16; px[i + 1] = (to >> 8) & 255; px[i + 2] = to & 255; }
    }
    ctx.putImageData(d, 0, 0);
  }
  return c;
}

function part(assets, slot, id) {
  return assets.catalog.slots[slot]?.find((p) => p.id === id);
}

// gear: optional unlocked cosmetics { hat: {part, color}, glasses: {part} } (see game-data.js)
function layersFor(assets, avatar, face, gear) {
  const a = { ...DEFAULT_AVATAR, ...avatar };
  const skin = ['body', a.skin], eye = ['eye', a.eyes];
  const extra = [];
  if (gear?.glasses) extra.push(['glasses', gear.glasses.part, []]);
  if (gear?.hat) extra.push(['hat', gear.hat.part, gear.hat.color ? [['cloth', gear.hat.color]] : []]);
  return [
    ['body', 'body', [skin]],
    ['shoes', a.shoes, [['cloth', a.shoesColor]]],
    ['legs', a.legs, [['cloth', a.legsColor]]],
    ['shirt', a.shirt, [['cloth', a.shirtColor]]],
    ['head', 'head', [skin, eye]],
    ['face', face, [skin, eye]],
    ['hair', a.hair, [['hair', a.hairColor]]],
    ...extra,
  ].map(([slot, id, recolor]) => {
    const p = part(assets, slot, id);
    return p && { z: p.zPos, path: p.paths[a.body] || p.paths.male, recolor };
  }).filter((l) => l?.path).sort((x, y) => x.z - y.z);
}

const sheetCache = new Map();
/** One composited, recolored sprite sheet (all 4 directions) for an animation + facial expression. */
export function characterSheet(assets, avatar, anim, face, gear = null) {
  const key = JSON.stringify([avatar, anim, face, gear]);
  if (sheetCache.has(key)) return sheetCache.get(key);
  const p = (async () => {
    const frames = ANIM_FRAMES[anim];
    const out = document.createElement('canvas');
    out.width = frames * FRAME; out.height = 4 * FRAME;
    const ctx = out.getContext('2d');
    for (const layer of layersFor(assets, avatar, face, gear)) {
      const use = layer.path.anims.includes(anim) ? anim : FALLBACK[anim];
      if (!layer.path.anims.includes(use)) continue;
      const sheet = await recolored(`${assets.base}/${layer.path.dir}${use}.png`, buildColorMap(assets, layer.recolor));
      if (use === anim) ctx.drawImage(sheet, 0, 0);
      else { // remap borrowed frames onto this animation's grid
        const n = ANIM_FRAMES[use];
        for (let f = 0; f < frames; f++) ctx.drawImage(sheet, (f % n) * FRAME, 0, FRAME, 4 * FRAME, f * FRAME, 0, FRAME, 4 * FRAME);
      }
    }
    return out;
  })();
  sheetCache.set(key, p);
  if (sheetCache.size > 60) sheetCache.delete(sheetCache.keys().next().value);
  return p;
}

// ---- T1D gear and props, drawn in 64x64 frame space (down-facing poses only) ----
export function px(ctx, color, x, y, w = 1, h = 1) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

export const GEAR_SPOTS = {
  idle: { cgm: [42, 38], pump: [35, 48], hand: [17, 46] },
  sit: { cgm: [39, 45], pump: [34, 52], hand: [18, 47] },
};

export function drawCgm(ctx, x, y) {
  px(ctx, '#5b6472', x, y, 4, 4);
  px(ctx, '#f1f3f5', x + 1, y, 2, 4);
  px(ctx, '#f1f3f5', x, y + 1, 4, 2);
  px(ctx, '#a3acb9', x + 1, y + 1, 2, 2);
}
export function drawPump(ctx, x, y) {
  px(ctx, '#1f2937', x, y, 5, 4);
  px(ctx, '#374151', x + 1, y + 1, 3, 2);
  px(ctx, '#5eead4', x + 1, y + 1, 2, 1);
}
export function drawJuice(ctx, x, y) {
  px(ctx, '#7c2d12', x - 1, y - 1, 6, 8);
  px(ctx, '#fb923c', x, y, 4, 6);
  px(ctx, '#fde68a', x, y + 2, 4, 2);
  px(ctx, '#dc2626', x + 1, y + 2, 1, 1);
  px(ctx, '#f8fafc', x + 3, y - 4, 1, 4);
}
export function drawWater(ctx, x, y) {
  px(ctx, '#1e3a5f', x - 1, y - 3, 5, 11);
  px(ctx, '#93c5fd', x, y - 1, 3, 8);
  px(ctx, '#dbeafe', x, y - 1, 1, 6);
  px(ctx, '#2563eb', x, y - 2, 3, 1);
  px(ctx, '#1e40af', x, y + 3, 3, 2);
}

/** Attribution lines for the parts this avatar uses (CC-BY-SA / OGA-BY / GPL require credit). */
export function creditsFor(assets, avatar) {
  const a = { ...DEFAULT_AVATAR, ...avatar };
  const dirs = [];
  for (const [slot, id] of [['body', 'body'], ['head', 'head'], ['hair', a.hair], ['shirt', a.shirt], ['legs', a.legs], ['shoes', a.shoes], ['face', 'happy']]) {
    const p = part(assets, slot, id);
    const path = p?.paths[a.body] || p?.paths.male;
    if (path) dirs.push(path.dir);
  }
  return assets.credits.filter((c) => dirs.some((d) => d.startsWith(c.file) || c.file.startsWith(d.replace(/\/$/, ''))));
}
