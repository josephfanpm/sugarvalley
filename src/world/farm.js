// Farm content for the Forest hamlet: coop, veggie patch, campfire kitchen, pasture, orchard,
// pond dock, Maple's notice board and the Garden Journal box. Each is a restorable that unlocks
// a daily activity (design/gdd/farm.md).
import { TILE, fenceCollider } from './terrain.js';
import { PAL, hex } from '../data/palette.js';
import { CHORES, suggestRecipe, RESTORE_BY_ID, ITEMS } from '../data/valley-rules.js';

// Positions in tiles
export const SPOTS = {
  coop: { x: 6.5, y: 7.6 },
  patch: { x0: 21, y0: 4, w: 6, h: 4 },
  kitchen: { x: 19, y: 18.4 },
  pasture: { x0: 36, y0: 17, x1: 42, y1: 22, gate: [38, 39] },
  orchard: [[35.6, 10.6], [37.8, 10.4], [40, 10.7], [36.6, 13], [38.9, 12.8], [41.1, 13.1]],
  dock: { x: 21, y0: 20, len: 3 },
  board: { x: 11.4, y: 11.9 },
  maple: { x: 10.4, y: 13.3 },
};

/** Frames for items and crops used across the game. */
export function registerFrames(scene) {
  const add = (key, name, x, y, w = 16, h = 16) => { const t = scene.textures.get(key); if (!t.has(name)) t.add(name, 0, x, y, w, h); };
  add('egg-nest', 'egg', 0, 0); add('egg-nest', 'eggs-nest', 32, 0);
  add('milk-grass', 'water', 0, 0); add('milk-grass', 'milk', 16, 0);
  add('plants', 'wheat', 80, 0); add('plants', 'eggplant', 80, 16);
  for (let i = 1; i <= 4; i++) { add('plants', `wheat-${i}`, i * 16, 0); add('plants', `eggplant-${i}`, i * 16, 16); }
  add('nature', 'apple', 32, 32);
  add('furniture', 'table', 48, 48); add('furniture', 'chair-r', 64, 32); add('furniture', 'chair-l', 80, 32);
  add('bridge', 'dv-top', 0, 0); add('bridge', 'dv-mid', 0, 16); add('bridge', 'dv-bot', 0, 32);
}

export const ITEM_ICON = { egg: ['egg-nest', 'egg'], milk: ['milk-grass', 'milk'], wheat: ['plants', 'wheat'], eggplant: ['plants', 'eggplant'], apple: ['nature', 'apple'] };

export function buildFarm(s) {
  buildCoop(s);
  buildPatch(s);
  buildKitchen(s);
  buildPasture(s);
  buildOrchard(s);
  buildDock(s);
  buildBoard(s);
  buildJournalBox(s);
}

const T = (n) => n * TILE;

function choreInteract(s, id, at, r = 16, extra = {}) {
  const c = CHORES[id];
  s.interactables.push({
    x: at.x, y: at.y, r,
    enabled: () => s.owner && s.restored(c.needs) && !s.farm.chores?.[id],
    label: () => (c.ripe && s.farm.ripeness < 1
      ? { text: `${c.label} · ${Math.round(s.farm.ripeness * 100)}% ripe (grows while you're in range)`, noKey: true }
      : { text: c.label }),
    action: () => (c.ripe && s.farm.ripeness < 1 ? s.toast('Not ripe yet. Crops grow while you stay in range.') : s.doChore(id, at)),
    ...extra,
  });
}

// ---------- coop: eggs ----------
function buildCoop(s) {
  const { x, y } = SPOTS.coop, cx = T(x), cy = T(y);
  const coop = s.add.image(cx, cy, 'coop').setOrigin(0.5, 1).setDepth(cy);
  s.add.image(cx, cy - 1, 'shadow').setDepth(-4).setScale(2.6, 1.4);
  s.colliders.push({ x: cx - 18, y: cy - 20, w: 36, h: 19 });
  s.nest = s.add.image(cx + 26, cy + 2, 'egg-nest', 'eggs-nest').setOrigin(0.5, 1).setDepth(cy + 2);
  s.addRestorable('coop', [coop, s.nest], { x: cx, y: cy + 8 });
  s.onRestore.coop = () => s.refreshFarm();
  choreInteract(s, 'eggs', { x: cx + 22, y: cy + 8 }, 18);
  s.farmSprites.nest = s.nest;
}

// ---------- veggie patch: crops ripen with in-range time ----------
function buildPatch(s) {
  const { x0, y0, w, h } = SPOTS.patch;
  const soil = s.add.renderTexture(T(x0), T(y0), T(w), T(h)).setOrigin(0).setDepth(-8);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const top = y === 0, bot = y === h - 1, left = x === 0, right = x === w - 1;
    const idx = top ? (left ? 4 : right ? 7 : x % 2 ? 5 : 6) : bot ? (left ? 37 : right ? 40 : x % 2 ? 38 : 39)
      : left ? (y % 2 ? 15 : 26) : right ? (y % 2 ? 18 : 29) : 12;
    soil.drawFrame('soil-sheet', idx, T(x), T(y));
  }
  const crops = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < w - 1; i++) {
    const kind = row === 0 ? 'wheat' : 'eggplant';
    const c = s.add.image(T(x0 + 1 + i), T(y0 + 1.95 + row * 1.1), 'plants', `${kind}-1`).setOrigin(0.5, 1).setDepth(T(y0 + 1.95 + row * 1.1));
    c.kind = kind;
    crops.push(c);
  }
  s.farmSprites.crops = crops;
  s.addRestorable('patch', [soil, ...crops], { x: T(x0 + w / 2), y: T(y0 + h) + 6 });
  s.onRestore.patch = () => s.refreshFarm();
  choreInteract(s, 'harvest', { x: T(x0 + w / 2), y: T(y0 + h) + 6 }, 26);
}

// ---------- campfire kitchen: cooking ----------
function buildKitchen(s) {
  const { x, y } = SPOTS.kitchen, kx = T(x), ky = T(y);
  const fire = s.add.sprite(kx, ky, 'campfire-0').setOrigin(0.5, 1).setDepth(ky);
  const pot = s.add.image(kx + 24, ky - 9, 'icon-pot').setOrigin(0.5, 1).setDepth(ky + 3);
  const table = s.add.image(kx + 26, ky + 2, 'furniture', 'table').setOrigin(0.5, 1).setDepth(ky + 2);
  const c1 = s.add.image(kx + 13, ky + 2, 'furniture', 'chair-r').setOrigin(0.5, 1).setDepth(ky + 1);
  const c2 = s.add.image(kx + 39, ky + 2, 'furniture', 'chair-l').setOrigin(0.5, 1).setDepth(ky + 1);
  s.colliders.push({ x: kx - 7, y: ky - 5, w: 14, h: 5 }, { x: kx + 18, y: ky - 5, w: 16, h: 6 });
  s.time.addEvent({ delay: 260, loop: true, callback: () => { if (s.restored('kitchen')) fire.setTexture(fire.texture.key === 'campfire-0' ? 'campfire-1' : 'campfire-0'); } });
  s.lights.push({ x: kx, y: ky - 8, r: 44, warm: true, on: () => s.restored('kitchen') });
  s.kitchenAt = { x: kx, y: ky + 10 };
  s.addRestorable('kitchen', [fire, pot, table, c1, c2], { x: kx, y: ky + 10 });
  s.interactables.push({
    x: kx, y: ky + 10, r: 18,
    enabled: () => s.owner && s.restored('kitchen'),
    label: () => {
      const r = suggestRecipe({ inventory: s.farm.inventory, cookbook: s.farm.cookbook });
      if (!r) return { text: 'Cook · gather eggs, milk, crops or apples first', noKey: true };
      const needs = Object.entries(r.needs).map(([k, n]) => `${n} ${n > 1 ? ITEMS[k].plural : ITEMS[k].name.toLowerCase()}`).join(', ');
      return { text: `Cook ${r.name.toLowerCase()}${s.farm.cookbook?.[r.id] ? '' : ' (new!)'} · ${needs}` };
    },
    action: () => { const r = suggestRecipe({ inventory: s.farm.inventory, cookbook: s.farm.cookbook }); if (r) s.doCook(r); },
  });
}

// ---------- pasture: fence ring, twice the milk ----------
function buildPasture(s) {
  const { x0, y0, x1, y1, gate } = SPOTS.pasture;
  const set = new Set();
  for (let x = x0; x <= x1; x++) { if (!gate.includes(x)) set.add(`${x},${y0}`); set.add(`${x},${y1}`); }
  for (let y = y0; y <= y1; y++) { set.add(`${x0},${y}`); set.add(`${x1},${y}`); }
  const parts = [];
  for (const k of set) {
    const [x, y] = k.split(',').map(Number);
    const n = set.has(`${x},${y - 1}`), so = set.has(`${x},${y + 1}`), e = set.has(`${x + 1},${y}`), w = set.has(`${x - 1},${y}`);
    const row = so && n ? 1 : so ? 0 : n ? 2 : 3, col = e && w ? 2 : e ? 1 : w ? 3 : 0;
    const by = T(y) + 16;
    const img = s.add.image(T(x) + 8, by, 'fences', row * 4 + col).setOrigin(0.5, 1).setDepth(by - 2);
    s.eastObjects.push(img);
    parts.push(img);
  }
  s.addRestorable('pasture', parts, { x: T(gate[0]) + 8, y: T(y0) - 4 });
  s.onRestore.pasture = () => {
    for (const k of set) {
      const [x, y] = k.split(',').map(Number);
      const e = set.has(`${x + 1},${y}`), w = set.has(`${x - 1},${y}`);
      s.colliders.push(fenceCollider(T(x), T(y), { n: set.has(`${x},${y - 1}`), s: set.has(`${x},${y + 1}`), e, w }));
    }
    s.rebuildWalkGrid();
  };
  if (s.restored('pasture')) s.onRestore.pasture();
}

// ---------- orchard: apples ripen with in-range time ----------
function buildOrchard(s) {
  const trees = SPOTS.orchard.map(([x, y]) => s.prop('treeApple', T(x), T(y), { east: true }));
  s.addRestorable('orchard', trees, { x: T(38.4), y: T(13.6) });
  choreInteract(s, 'apples', { x: T(38.4), y: T(13.8) }, 24);
}

// ---------- pond dock: a quiet spot ----------
function buildDock(s) {
  const { x, y0, len } = SPOTS.dock;
  const parts = [];
  for (let i = 0; i < len; i++) {
    const f = i === 0 ? 'dv-top' : i === len - 1 ? 'dv-bot' : 'dv-mid';
    parts.push(s.add.image(T(x) + 8, T(y0 + i) + 8, 'bridge', f).setDepth(-5));
  }
  s.dockTiles = { x, y0, y1: y0 + len - 1 };
  s.dockSpot = { x: T(x) + 8, y: T(y0 + len - 1) + 6 };
  s.addRestorable('dock', parts, { x: T(x) + 8, y: T(y0) - 2 });
  s.onRestore.dock = () => s.rebuildWalkGrid();
}

// ---------- Maple's notice board (weekly goal) ----------
function buildBoard(s) {
  const { x, y } = SPOTS.board;
  s.add.image(T(x), T(y), 'notice-board').setOrigin(0.5, 1).setDepth(T(y));
  s.add.image(T(x), T(y) - 1, 'shadow').setDepth(-4).setScale(1.3, 1);
  s.colliders.push({ x: T(x) - 9, y: T(y) - 4, w: 18, h: 4 });
  s.boardAt = { x: T(x), y: T(y) + 6 };
  // Ribbons from finished weekly goals are pinned to the board.
  s.ribbonSprites = [];
  s.renderRibbons = () => {
    const n = Math.min(6, s.view.valley.ribbons || 0);
    while (s.ribbonSprites.length < n) {
      const i = s.ribbonSprites.length;
      s.ribbonSprites.push(s.add.image(T(x) - 7 + (i % 3) * 7, T(y) - 22 + Math.floor(i / 3) * 9, 'ribbon').setDepth(T(y) + 1));
    }
  };
  s.renderRibbons();
}

// ---------- Garden Journal box (the chest by the cottage) ----------
function buildJournalBox(s) {
  s.interactables.push({
    x: s.journalBox.x, y: s.journalBox.y + 6, r: 14,
    enabled: () => s.owner,
    label: () => ({ text: 'Open the Garden Journal' }),
    action: () => s.game.events.emit('open-journal'),
  });
}

/** Update farm visuals from the latest view. */
export function refreshFarmVisuals(s) {
  const f = s.farm;
  if (s.farmSprites.crops && s.restored('patch')) {
    const stage = f.chores?.harvest ? 1 : f.ripeness >= 1 ? 4 : f.ripeness >= 0.67 ? 3 : f.ripeness >= 0.34 ? 2 : 1;
    for (const c of s.farmSprites.crops) c.setFrame(`${c.kind}-${stage}`);
  }
  if (s.farmSprites.nest && s.restored('coop')) s.farmSprites.nest.setFrame(f.chores?.eggs ? 'egg' : 'eggs-nest').setVisible(!f.chores?.eggs);
}

export { hex, PAL, RESTORE_BY_ID };
