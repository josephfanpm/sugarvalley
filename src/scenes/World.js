// The Forest hamlet: terrain, props, player, animals, lighting, restoration and the Garden of Days.
import { TILE, COLS, ROWS, buildWater, buildPaths, floodEast, grassIndex, rng } from '../world/terrain.js';
import { buildCottage } from '../world/house.js';
import { plantTexture } from '../world/plants.js';
import { PAL, hex } from '../data/palette.js';
import { GIFT_KINDS } from '../data/balance.js';
import { RESTORE_BY_ID, nextRestorable, CHORES, suggestRecipe, ITEMS } from '../data/valley-rules.js';
import { registerFrames, buildFarm, refreshFarmVisuals, SPOTS, ITEM_ICON } from '../world/farm.js';
import { Actor, Autopilot } from '../world/autopilot.js';
import { buildTown, updateTown, Dog } from '../world/town.js';
import { sfx, unlockAudio, ambience, music } from '../audio.js';
import { Music } from '../music.js';
import { loadView, act } from '../net.js';
import { liveState, isUrgent } from '../data/cgm.js';

const W = COLS * TILE, H = ROWS * TILE;
const SPEED = 72;
const params = new URLSearchParams(location.search);
const GIFT_SPOTS = [[-20, 6], [20, 6], [-26, -2], [26, -2], [-12, 12], [12, 12]];
const IDLE_BEFORE_AUTOPILOT = 7; // seconds without input before the character does their own thing

// Nature sheet frames (pixel rects in nature.png)
const NATURE = {
  treeSmall: [0, 0, 16, 32], treeBig: [16, 0, 32, 32], treeApple: [48, 0, 32, 32],
  mushRed2: [80, 0, 16, 16], mushRed: [96, 0, 16, 16], mushPurple: [112, 0, 16, 16], mushPurple2: [128, 0, 16, 16],
  sprout: [80, 16, 16, 16], sprout2: [96, 16, 16, 16], rockSmall: [112, 16, 16, 16], rockBig: [128, 16, 16, 16],
  stump: [48, 32, 16, 16], stump2: [64, 32, 16, 16], log: [80, 32, 16, 16],
  flowerY: [96, 32, 16, 16], flowerY2: [112, 32, 16, 16], sunflower: [128, 32, 16, 32],
  bushBerry: [0, 48, 16, 16], bush: [16, 48, 16, 16],
  flowerBlue: [80, 48, 16, 16], flowerPink: [96, 48, 16, 16], flowerPink2: [112, 48, 16, 16],
  longBushA: [0, 64, 32, 16], longBushB: [32, 64, 32, 16],
};
// Trunk colliders (relative to bottom-center), [w, h]
const TRUNK = { treeSmall: [6, 4], treeBig: [10, 5], treeApple: [10, 5], rockBig: [12, 6], rockSmall: [8, 4], stump: [10, 5], stump2: [10, 5], bushBerry: [12, 5], bush: [12, 5], longBushA: [28, 5], longBushB: [28, 5], sunflower: [4, 3], log: [12, 4] };

// Time-of-day multiply colors by hour.
const SKY = [
  [0, '#454f9e'], [4.5, '#454f9e'], [5.5, '#7a6aa8'], [6.5, '#e8b2a0'], [7.5, '#f8e4d0'], [8.5, '#ffffff'],
  [16.5, '#ffffff'], [17.5, '#fde2c4'], [18.5, '#f1a98e'], [19.3, '#b07fb4'], [20.2, '#6d68b0'], [21.5, '#5058a8'], [24, '#454f9e'],
];

function lerpColor(a, b, t) {
  const pa = hex(a), pb = hex(b);
  const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
function skyAt(hour) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, c0] = SKY[i], [h1, c1] = SKY[i + 1];
    if (hour >= h0 && hour <= h1) return lerpColor(c0, c1, (hour - h0) / (h1 - h0 || 1));
  }
  return hex(SKY[0][1]);
}

export class World extends Phaser.Scene {
  constructor() { super('World'); }

  create() {
    this.view = this.registry.get('view');
    this.view.state = liveState(this.view);
    this.owner = this.view.role === 'owner';
    this.giftsSent = 0;
    this.visited = { garden: false, pet: false };
    this.restorableAt = {};
    this.onRestore = {};
    this.farmSprites = {};
    this.farm = this.view.farm || { inventory: {}, chores: {}, cookbook: {}, ripeness: 0, dishesToday: 0 };
    this.idle = 0;
    this.rnd = rng(11);
    this.colliders = [];
    this.interactables = [];
    this.lights = [];
    this.eastObjects = [];
    this.water = buildWater();
    this.path = buildPaths(this.water);
    this.east = floodEast(this.water);
    const nature = this.textures.get('nature');
    for (const [name, [x, y, w, h]] of Object.entries(NATURE)) nature.add(name, 0, x, y, w, h);
    registerFrames(this);
    this.createAnims();

    this.buildData();
    this.buildGround();
    this.buildProps();
    this.buildCottage();
    this.buildGarden();
    this.buildRestorables();
    this.buildAnimals();
    buildFarm(this);
    buildTown(this);
    this.buildPlayer();
    this.buildVillager();
    this.buildLighting();
    this.buildParticles();
    this.rebuildWalkGrid();
    this.buildAutopilot();
    this.buildDog();
    this.refreshFarm();
    this.applyEastFade(this.restored('bridge') ? 0 : 1);
    this.renderGifts();
    this.buildFloatingLanterns();
    this.celebrate();
    this.arrow = this.add.image(0, 0, 'arrow').setOrigin(0.5, 1).setDepth(100004).setVisible(false);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.setRoundPixels(true);
    this.fitZoom();
    this.scale.on('resize', () => this.fitZoom());
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.fadeIn(600, 30, 24, 40);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER');
    this.input.keyboard.on('keydown', () => unlockAudio());
    this.input.on('pointerdown', (p) => {
      unlockAudio();
      if (p.event?.target?.tagName !== 'CANVAS') return;
      this.moveTarget = { x: p.worldX, y: p.worldY };
    });
    for (const k of ['E', 'SPACE', 'ENTER']) this.keys[k].on('down', () => this.interact());
    this.game.events.on('hud-interact', () => this.interact(), this);
    this.events.once('shutdown', () => this.game.events.off('hud-interact', undefined, this));

    this.scene.launch('Hud');
    this.music = new Music(this); // loads in the background
    this.time.delayedCall(50, () => this.emitStatus());
    this.game.events.on('farm-action', (a) => this.handleHudAction(a), this);
    this.events.once('shutdown', () => this.game.events.off('farm-action', undefined, this));
    if (this.owner && this.view.valley.gifts > 0) {
      this.time.delayedCall(1200, () => this.game.events.emit('toast', `${this.view.valley.gifts === 1 ? 'A visitor left you a gift' : `Visitors left you ${this.view.valley.gifts} gifts`} at the Sun Well.`));
    }
  }

  fitZoom() {
    const { width, height } = this.scale;
    const forced = Number(params.get('zoom'));
    let z = forced || Math.max(2, Math.round(Math.min(width / 300, height / 210)));
    while (W * z < width || H * z < height) z++;
    this.cameras.main.setZoom(z);
    this.zoom = z;
    this.game.events.emit('zoom', z);
  }

  // ---------- data ----------
  buildData() {
    this.days = this.view.days.map((d) => ({ start: d.start, stats: d }));
    this.pending = this.view.valley.pending || 0;
  }

  restored(id) { return !!this.view.valley.restored?.[id]; }
  get gifts() { return this.view.valley.gifts || 0; }

  emitStatus() {
    this.game.events.emit('status', { view: this.view, pending: this.pending });
  }

  /** Apply a fresh view from the server (poll or action result). */
  setView(view) {
    view.state = liveState(view);
    this.view = view;
    this.pending = view.valley.pending || 0;
    this.well?.setTexture(this.pending > 0 || (this.owner && this.gifts > 0) ? 'well-full' : 'well');
    this.renderGifts();
    this.farm = view.farm || this.farm;
    this.refreshFarm();
    this.renderRibbons?.();
    this.celebrate();
    this.emitStatus();
  }

  refreshFarm() { refreshFarmVisuals(this); }

  /** Lantern Night: one floating lantern per good day this month, on the stream and ponds. */
  buildFloatingLanterns() {
    const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const good = this.view.days.filter((d) => d.good && d.start >= monthStart);
    this.goodThisMonth = good.length;
    // Water spots: open water (not next to land), spread out, deterministic.
    const spots = [];
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      if (!this.water[y][x]) continue;
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => this.water[y + dy][x + dx]);
      if (open && (x + 2 * y) % 3 === 0) spots.push({ x: x * TILE + 8, y: y * TILE + 9 });
    }
    const r = rng(42);
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    this.floatLanterns = good.slice(0, spots.length).map((d, i) => {
      const p = spots[i];
      const img = this.add.image(p.x, p.y, 'float-lantern').setOrigin(0.5, 1).setDepth(-3);
      this.tweens.add({ targets: img, y: p.y - 1.5, x: p.x + 1, duration: 1400 + (i % 5) * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.lights.push({ x: p.x, y: p.y - 4, r: 16, warm: true, on: () => true });
      return img;
    });
    const yesterday = this.view.days[this.view.days.length - 1];
    let seen = '';
    try { seen = localStorage.getItem('sugar-valley-lantern') || ''; } catch { /* blocked */ }
    if (yesterday?.good && yesterday.start >= monthStart && seen !== String(yesterday.start) && !isUrgent(this.view.state)) {
      try { localStorage.setItem('sugar-valley-lantern', String(yesterday.start)); } catch { /* blocked */ }
      const who = this.owner ? 'Yesterday was' : `${this.view.name}'s yesterday was`;
      this.time.delayedCall(2600, () => this.toast(`${who} a good day. A new lantern floats on the stream (${good.length} this month).`));
    }
  }

  /** Comebacks get a moment; a steady streak brings out butterflies. */
  celebrate() {
    const v = this.view;
    this.butterflies?.[(v.steady || 0) >= 180 && v.state === 'in_range' ? 'start' : 'stop']();
    const key = `sugar-valley-comeback-${v.role}`;
    let seen = 0;
    try { seen = Number(localStorage.getItem(key)) || 0; } catch { /* blocked */ }
    const fresh = (v.comebacks || []).filter((c) => c.ts > seen);
    if (!fresh.length || isUrgent(v.state)) return;
    const c = fresh[fresh.length - 1];
    try { localStorage.setItem(key, String(c.ts)); } catch { /* blocked */ }
    if (seen === 0 && fresh.length > 1) return; // first visit: don't replay the whole day
    const who = this.owner ? 'You are' : `${v.name} is`;
    this.time.delayedCall(900, () => {
      sfx.collect();
      const p = this.owner ? this.player : this.sam || this.player;
      this.sparkles.explode(20, p.x, p.y - 16);
      this.toast(`Comeback! ${who} back in range ${c.minutes} min after a ${c.from}.`);
    });
  }
  toast(msg) { this.game.events.emit('toast', msg); }

  /** Called by the HUD every minute (the HUD's clock keeps running even if this scene is paused). */
  async refresh() {
    try { this.setView(await loadView()); } catch {
      // Offline: keep the last view, but never let old data look fine (safety.md #3).
      const s = liveState(this.view);
      if (s !== this.view.state) this.setView({ ...this.view, state: s });
    }
  }

  // Gifts visitors left, waiting by the Sun Well until the owner collects them.
  renderGifts() {
    if (!this.giftSprites) this.giftSprites = [];
    const kinds = this.owner ? (this.view.valley.giftKinds || []) : GIFT_KINDS.slice(0, Math.min(this.gifts, 6)).map((_, i) => GIFT_KINDS[i % 4]);
    const n = Math.min(6, this.owner ? kinds.length : this.gifts);
    while (this.giftSprites.length > n) this.giftSprites.pop().destroy();
    while (this.giftSprites.length < n) {
      const i = this.giftSprites.length, [dx, dy] = GIFT_SPOTS[i];
      const kind = kinds[i] || GIFT_KINDS[i % 4];
      const s = this.add.image(this.wellPos.x + dx, this.wellPos.y + dy, `gift-${kind}`).setOrigin(0.5, 1).setDepth(this.wellPos.y + dy);
      this.tweens.add({ targets: s, y: s.y - 2, duration: 900 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.giftSprites.push(s);
    }
  }

  // ---------- ground ----------
  buildGround() {
    this.waterFrames = [0, 1, 2, 3].map((f) => this.add.tileSprite(0, 0, W, H, 'water', f).setOrigin(0).setDepth(-20).setVisible(f === 0));
    this.time.addEvent({ delay: 320, loop: true, callback: () => {
      this.waterFrame = ((this.waterFrame || 0) + 1) % 4;
      this.waterFrames.forEach((s, i) => s.setVisible(i === this.waterFrame));
    } });

    const dirt = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(-15);
    const dr = rng(5);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) => this.path[y + dy]?.[x + dx]);
      if (near && !this.water[y][x]) dirt.draw('dirt-tile', x * TILE, y * TILE);
    }
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(dr() * COLS), y = Math.floor(dr() * ROWS);
      if (this.path[y][x]) dirt.draw(dr() < 0.5 ? 'pebble' : 'pebble2', x * TILE + Math.floor(dr() * 12), y * TILE + Math.floor(dr() * 12));
    }
    const map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: COLS, height: ROWS });
    const ts = map.addTilesetImage('grass', 'grass', TILE, TILE, 0, 0);
    this.ground = map.createBlankLayer('ground', ts).setDepth(-10);
    const r = rng(3);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const idx = grassIndex(this.water, x, y, r, this.path);
      if (idx < 0 || this.path[y][x]) continue;
      this.ground.putTileAt(idx, x, y);
    }
    // Faded-valley veil over the unrestored east side (no shader FX: cheaper on phones).
    this.fog = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(99990);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (this.east[y][x]) this.fog.draw('fog-tile', x * TILE, y * TILE);

    // Ground decals: grass blobs, tufts, tiny flowers (transparent tiles in Grass.png)
    const g = this.textures.get('grass');
    const DEC = { blobD1: [96, 80], blobD2: [112, 80], blobL1: [96, 96], blobL2: [112, 96], tuft: [128, 80], bloom: [144, 80], tuft2: [128, 96] };
    for (const [k, [x, y]] of Object.entries(DEC)) g.add(k, 0, x, y, 16, 16);
    const keys = ['blobD1', 'blobD2', 'blobL1', 'blobL2', 'tuft', 'tuft', 'tuft2', 'tuft2', 'bloom'];
    for (let i = 0; i < 230; i++) {
      const x = Math.floor(r() * COLS), y = Math.floor(r() * ROWS);
      if (this.water[y][x] || this.path[y][x]) continue;
      if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => this.water[y + dy]?.[x + dx] || this.path[y + dy]?.[x + dx])) continue;
      const d = this.add.image(x * TILE + 8, y * TILE + 8, 'grass', keys[Math.floor(r() * keys.length)]).setDepth(-9);
      if (this.east[y][x]) this.eastObjects.push(d);
    }

    // lily pads & reeds on the water
    for (const [x, y, f] of [[33, 5, 'sprout'], [36, 6, 'sprout2'], [21, 22, 'sprout']]) {
      this.add.image(x * TILE + 8, y * TILE + 10, 'nature', f).setDepth(-8).setAlpha(0.9).setTint(0xb7e3c6);
    }
  }

  // ---------- props ----------
  prop(frame, x, y, { collide = true, east = this.isEast(x, y - 4), depthOffset = 0, shadow = true } = {}) {
    const img = this.add.image(Math.round(x), Math.round(y), 'nature', frame).setOrigin(0.5, 1);
    img.setDepth(y + depthOffset);
    const [, , fw] = NATURE[frame];
    if (shadow) {
      const sh = this.add.image(Math.round(x), Math.round(y) - 1, 'shadow').setDepth(-4).setScale(fw / 16, 1);
      if (east) this.eastObjects.push(sh);
    }
    if (collide && TRUNK[frame]) {
      const [tw, th] = TRUNK[frame];
      this.colliders.push({ x: x - tw / 2, y: y - th - 2, w: tw, h: th });
    }
    if (east) this.eastObjects.push(img);
    return img;
  }

  isEast(px, py) {
    const tx = Math.max(0, Math.min(COLS - 1, Math.floor(px / TILE))), ty = Math.max(0, Math.min(ROWS - 1, Math.floor(py / TILE)));
    return this.east[ty][tx];
  }

  isWater(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    return this.water[ty][tx];
  }

  buildProps() {
    const r = this.rnd;
    const reserved = [
      [10, 1, 23, 12], // cottage + plaza
      [2, 15, 15, 27], // garden
      [3, 3, 10, 10], // coop yard
      [26, 13, 37, 17], // bridge approach
      [20, 3, 27, 8], // veggie patch
      [16, 16, 22, 20], // campfire kitchen
      [35, 16, 43, 23], // pasture
      [34, 8, 42, 14], // orchard
      [9, 10, 13, 14], // notice board
      [22, 9, 25, 11], // dog house
      [3, 27, 28, 47], // town: shops, plaza, stalls
      [3, 46, 29, 57], // track, gym, dog park
      [14, 14, 17, 34], // main street
    ];
    const free = (tx, ty) => !this.water[ty]?.[tx] && !this.path[ty]?.[tx] && !reserved.some(([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1);

    // Forest border: big trees in staggered rows around the edges
    const border = [];
    for (let x = -0.5; x < COLS + 1; x += 1.6 + r() * 0.6) { border.push([x, 1.4]); border.push([x + 0.8, ROWS + 0.6]); }
    for (let y = 2.5; y < ROWS; y += 1.5 + r() * 0.5) { border.push([0.2, y]); border.push([COLS - 0.2, y]); }
    for (let x = 0; x < COLS; x += 2.2 + r()) border.push([x, 2.6 + r() * 0.5]);
    for (const [tx, ty] of border) {
      const cx = Math.floor(tx), cy = Math.min(ROWS - 1, Math.floor(ty - 0.5));
      if (this.water[cy]?.[Math.max(0, Math.min(COLS - 1, cx))]) continue;
      const f = r() < 0.18 ? 'treeSmall' : r() < 0.15 ? 'treeApple' : 'treeBig';
      this.prop(f, tx * TILE, ty * TILE);
    }
    // Interior groves
    const groves = [[27.6, 9.6, 'treeSmall'], [5, 13, 'treeBig'], [7.2, 12.6, 'treeSmall'],
      [18, 26, 'treeBig'], [25, 26.5, 'treeApple'], [27.5, 24.5, 'treeSmall'],
      [38.5, 24.6, 'treeBig'], [36, 27, 'treeApple'], [29, 3.5, 'treeSmall'], [42.2, 15.4, 'treeSmall'],
      [36, 33, 'treeBig'], [39.5, 37, 'treeApple'], [35.5, 42, 'treeSmall'], [40.5, 46, 'treeBig'], [37, 51, 'treeApple'], [2, 30, 'treeSmall']];
    for (const [x, y, f] of groves) this.prop(f, x * TILE, y * TILE);

    // Bushes, rocks, stumps, flowers, mushrooms
    const scatter = (frames, n, opts) => {
      let placed = 0, guard = 0;
      while (placed < n && guard++ < 400) {
        const tx = 2 + Math.floor(r() * (COLS - 4)), ty = 4 + Math.floor(r() * (ROWS - 6));
        if (!free(tx, ty) || !free(tx + 1, ty)) continue;
        this.prop(frames[Math.floor(r() * frames.length)], tx * TILE + 8 + Math.round(r() * 6 - 3), ty * TILE + 14, opts);
        placed++;
      }
    };
    scatter(['bushBerry', 'bush', 'bush', 'longBushA', 'longBushB'], 10);
    scatter(['rockBig', 'rockSmall', 'stump', 'stump2', 'log'], 9);
    scatter(['flowerY', 'flowerY2', 'flowerBlue', 'flowerPink', 'flowerPink2', 'flowerPink', 'flowerY'], 34, { collide: false, shadow: false });
    scatter(['mushRed', 'mushRed2', 'mushPurple', 'mushPurple2'], 8, { collide: false, shadow: false });
    scatter(['sprout', 'sprout2'], 12, { collide: false, shadow: false });

    // Sunflowers flank the well plaza
    this.sunflowerSpots = [[13, 12.4], [19.6, 12.4]].map(([x, y]) => { this.prop('sunflower', x * TILE, y * TILE); return { x: x * TILE, y: y * TILE }; });

    // Sun Well
    this.wellPos = { x: 16.5 * TILE, y: 13 * TILE };
    this.well = this.add.image(this.wellPos.x, this.wellPos.y, this.pending > 0 || (this.owner && this.gifts > 0) ? 'well-full' : 'well').setOrigin(0.5, 1).setDepth(this.wellPos.y);
    this.add.image(this.wellPos.x, this.wellPos.y - 1, 'shadow').setDepth(-4).setScale(1.7, 1.2);
    this.colliders.push({ x: this.wellPos.x - 11, y: this.wellPos.y - 9, w: 22, h: 8 });
    this.lights.push({ x: this.wellPos.x, y: this.wellPos.y - 8, r: 34, warm: true, on: () => this.pending > 0 });
    this.interactables.push(this.owner ? {
      x: this.wellPos.x, y: this.wellPos.y + 4, r: 22,
      label: () => (this.pending > 0 || this.gifts > 0
        ? { text: this.gifts ? `Collect sunlight and ${this.gifts} gift${this.gifts > 1 ? 's' : ''}` : 'Collect sunlight', cost: `+${this.pending + this.gifts * 3}` }
        : { text: 'The Sun Well fills as you stay in range', noKey: true }),
      action: () => this.collectSun(),
    } : {
      x: this.wellPos.x, y: this.wellPos.y + 4, r: 22,
      label: () => ({ text: `Leave a gift for ${this.view.name}` }),
      action: () => this.leaveGift(),
    });
  }

  buildCottage() {
    const c = buildCottage(this, 'cottage', 5);
    const x = 16.5 * TILE, bottom = 9 * TILE;
    const left = x - c.w / 2, top = bottom - c.h;
    this.add.image(x, bottom, 'cottage').setOrigin(0.5, 1).setDepth(bottom);
    this.add.image(x, bottom - 1, 'shadow').setDepth(-4).setScale(c.w / 14, 1.5);
    this.colliders.push({ x: left + 2, y: top + c.wallY - 6, w: c.w - 4, h: c.h - c.wallY + 4 });
    this.colliders.push({ x: left + 2, y: top + 8, w: c.w - 4, h: c.wallY - 14 });
    this.windowGlows = [];
    for (const w of c.windows) {
      const wx = left + w.x, wy = top + w.y;
      this.lights.push({ x: wx, y: wy + 6, r: 30, warm: true, window: true, on: () => true });
      this.windowGlows.push(this.add.image(wx, wy, 'window-lit').setDepth(100001).setAlpha(0));
    }
    // Mailbox-ish chest by the door
    const chest = this.textures.get('chest'); chest.add('closed', 0, 16, 16, 16, 16);
    this.add.image(x + 52, bottom + 6, 'chest', 'closed').setOrigin(0.5, 1).setDepth(bottom + 2);
    this.journalBox = { x: x + 52, y: bottom + 6 };
    this.cottageDoor = { x, y: bottom + 6 };
    this.interactables.push({
      x, y: bottom + 6, r: 12,
      label: () => ({ text: this.owner ? 'Go inside' : `Visit ${this.view.name}'s cottage` }),
      action: () => this.enterBuilding('cottage'),
    });
    this.colliders.push({ x: x + 46, y: bottom, w: 12, h: 5 });
  }

  // ---------- garden of days ----------
  buildGarden() {
    const gx0 = 3, gy0 = 16, gx1 = 14, gy1 = 26;
    const gate = new Set([8, 9]);
    const fence = new Set();
    for (let x = gx0; x <= gx1; x++) { if (!gate.has(x)) fence.add(`${x},${gy0}`); fence.add(`${x},${gy1}`); }
    for (let y = gy0; y <= gy1; y++) { fence.add(`${gx0},${y}`); fence.add(`${gx1},${y}`); }
    for (const k of fence) {
      const [x, y] = k.split(',').map(Number);
      const n = fence.has(`${x},${y - 1}`), s = fence.has(`${x},${y + 1}`), e = fence.has(`${x + 1},${y}`), w = fence.has(`${x - 1},${y}`);
      const row = s && n ? 1 : s ? 0 : n ? 2 : 3;
      const col = e && w ? 2 : e ? 1 : w ? 3 : 0;
      const by = y * TILE + 16;
      this.add.image(x * TILE + 8, by, 'fences', row * 4 + col).setOrigin(0.5, 1).setDepth(by - 2);
      this.colliders.push({ x: x * TILE + (w ? 0 : 5), y: by - 6, w: e && w ? 16 : 7 + (e ? 4 : 0) + (w ? 4 : 0), h: 4 });
    }
    // Soil beds
    const bed = this.add.graphics().setDepth(-7);
    for (let row = 0; row < 3; row++) {
      const y = (gy0 + 3.3 + row * 2.9) * TILE;
      bed.fillStyle(hex(PAL.woodMid), 0.55).fillRoundedRect((gx0 + 1.2) * TILE, y - 4, (gx1 - gx0 - 1.4) * TILE, 9, 3);
      bed.fillStyle(hex(PAL.wood), 0.45).fillRoundedRect((gx0 + 1.4) * TILE, y - 3, (gx1 - gx0 - 1.8) * TILE, 3, 2);
    }
    // Plants: past days in rows of 10, oldest top-left
    const perRow = 10;
    const past = this.days.slice(-30);
    past.forEach((d, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const x = (gx0 + 1.5 + col) * TILE, y = (gy0 + 3.3 + row * 2.9) * TILE + 4;
      const key = `plant-${d.start}`;
      plantTexture(this, key, d.stats, d.start / 86_400_000);
      const img = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
      (this.gardenPlants ||= []).push({ x, y });
      this.tweens.add({ targets: img, scaleX: { from: 1, to: 1.06 }, duration: 1600 + (i % 5) * 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 90 });
      this.interactables.push({ x, y: y + 2, r: 9, plant: true, label: () => ({ text: plantLabel(d) }) });
    });
    // Today's sprout grows in the next free slot
    const progress = this.view.todayProgress || 0;
    const slot = past.length;
    const tx = (gx0 + 1.5 + (slot % perRow)) * TILE, ty = (gy0 + 3.3 + Math.floor(slot / perRow) * 2.9) * TILE + 4;
    plantTexture(this, 'plant-today', null, 1, progress);
    this.todayPlant = this.add.image(tx, ty, 'plant-today').setOrigin(0.5, 1).setDepth(ty);
    this.interactables.push({
      x: tx, y: ty + 4, r: 14,
      label: () => (!this.owner ? { text: `${this.view.name}'s sprout for today` }
        : this.view.valley.wateredToday ? { text: "Today's sprout · it grows as your day goes" } : { text: "Water today's sprout", water: true }),
      action: this.owner ? () => this.waterSprout() : null,
    });
  }

  // ---------- restorables ----------
  buildRestorables() {
    // Footbridge across the stream (row 15)
    const by = 15;
    const xs = [];
    for (let x = 0; x < COLS; x++) if (this.water[by][x]) xs.push(x);
    const x0 = xs[0] - 1, x1 = xs[xs.length - 1] + 1;
    const bridge = this.textures.get('bridge');
    bridge.add('bl', 0, 32, 0, 16, 16); bridge.add('bm', 0, 48, 0, 16, 16); bridge.add('br', 0, 64, 0, 16, 16);
    this.bridgeParts = [];
    for (let x = x0; x <= x1; x++) {
      const f = x === x0 ? 'bl' : x === x1 ? 'br' : 'bm';
      this.bridgeParts.push(this.add.image(x * TILE + 8, by * TILE + 8, 'bridge', f).setDepth(-5));
    }
    this.bridgeTiles = { y: by, x0, x1 };
    this.addRestorable('bridge', this.bridgeParts, { x: (x0 + 0.5) * TILE, y: by * TILE + 10 });
    this.onRestore.bridge = () => { this.tweens.addCounter({ from: 1, to: 0, duration: 1600, delay: 300, onUpdate: (t) => this.applyEastFade(t.getValue()) }); this.rebuildWalkGrid(); };

    // Lantern path
    const spots = [[13.6, 9.6], [19.4, 9.6], [20.2, 13.4], [25.8, 14.6]];
    this.lanterns = spots.map(([x, y]) => {
      const img = this.add.image(x * TILE, y * TILE, this.restored('lanterns') ? 'lantern-on' : 'lantern-off').setOrigin(0.5, 1).setDepth(y * TILE);
      this.colliders.push({ x: x * TILE - 3, y: y * TILE - 4, w: 6, h: 4 });
      this.lights.push({ x: x * TILE, y: y * TILE - 15, r: 40, warm: true, on: () => this.restored('lanterns') });
      return img;
    });
    this.addRestorable('lanterns', this.lanterns, { x: spots[2][0] * TILE, y: spots[2][1] * TILE + 6 });
    this.onRestore.lanterns = () => this.lanterns.forEach((l) => l.setTexture('lantern-on'));
  }

  addRestorable(id, parts, at) {
    const r = RESTORE_BY_ID[id];
    if (!this.restored(id)) for (const p of parts) this.ghost(p);
    this.restorables = this.restorables || {};
    this.restorables[id] = parts;
    this.restorableAt[id] = { x: at.x, y: at.y - 18 };
    this.interactables.push({
      x: at.x, y: at.y, r: 20,
      enabled: () => !this.restored(id),
      label: () => {
        if (!this.owner) return { text: `${this.view.name} can restore the ${r.name} with sunlight` };
        if (r.requires && !this.restored(r.requires)) return { text: `Restore the ${RESTORE_BY_ID[r.requires].name} first`, noKey: true };
        return { text: `Restore the ${r.name} · ${r.unlocks}`, cost: `${r.cost}`, sun: true };
      },
      action: this.owner ? () => this.restore(id, parts) : null,
    });
  }

  ghost(img) {
    img.setTint(hex(PAL.blueLight)).setAlpha(0.45);
    img.ghostTween = this.tweens.add({ targets: img, alpha: 0.65, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  async restore(id, parts) {
    const r = RESTORE_BY_ID[id], cost = r.cost;
    if (r.requires && !this.restored(r.requires)) { sfx.deny(); this.toast(`Restore the ${RESTORE_BY_ID[r.requires].name} first.`); return; }
    if (this.view.valley.sun < cost) {
      sfx.deny();
      this.game.events.emit('toast', `${cost - this.view.valley.sun} more sunlight needed. Collect it at the Sun Well.`);
      return;
    }
    if (this.busyNet) return;
    this.busyNet = true;
    let res;
    try { res = await act('restore', { id }); } catch (e) {
      this.busyNet = false; sfx.deny(); this.game.events.emit('toast', e.message); return;
    }
    this.busyNet = false;
    this.setView(res.view);
    sfx.restore();
    this.cameras.main.flash(300, 255, 236, 190, false);
    parts.forEach((p, i) => {
      p.ghostTween?.remove();
      this.time.delayedCall(i * 70, () => {
        p.clearTint();
        this.tweens.add({ targets: p, alpha: 1, duration: 200 });
        this.tweens.add({ targets: p, scaleY: { from: 0.7, to: 1 }, scaleX: { from: 1.25, to: 1 }, duration: 420, ease: 'Back.easeOut' });
        this.sparkles.explode(14, p.x, p.y - 6);
      });
    });
    this.onRestore[id]?.();
    this.toast(`The ${r.name} is back! ${r.unlocks}.`);
  }

  applyEastFade(amount) {
    this.fog.setAlpha(amount).setVisible(amount > 0.001);
  }

  // ---------- animals ----------
  buildAnimals() {

    this.anims.create({ key: 'chick-idle', frames: this.anims.generateFrameNumbers('chicken', { frames: [0, 1] }), frameRate: 2, repeat: -1 });
    this.anims.create({ key: 'chick-walk', frames: this.anims.generateFrameNumbers('chicken', { frames: [4, 5, 6, 7] }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'cow-idle', frames: this.anims.generateFrameNumbers('cow', { frames: [0, 1, 0, 2] }), frameRate: 2, repeat: -1 });
    this.anims.create({ key: 'cow-walk', frames: this.anims.generateFrameNumbers('cow', { frames: [3, 4] }), frameRate: 4, repeat: -1 });

    this.animals = [];
    const add = (kind, x, y, home, east = false) => {
      const s = this.add.sprite(x, y, kind).setOrigin(0.5, 1).play(`${kind === 'cow' ? 'cow' : 'chick'}-idle`);
      const sh = this.add.image(x, y, 'shadow').setDepth(-4).setScale(kind === 'cow' ? 1.5 : 0.7, kind === 'cow' ? 1.2 : 0.8);
      const a = { s, sh, kind, home, wait: 1 + Math.random() * 3, target: null };
      this.animals.push(a);
      if (east) this.eastObjects.push(s, sh);
      if (kind === 'chicken') this.interactables.push({ x: 0, y: 0, r: 12, follow: a, label: () => ({ text: 'Pet the chicken' }), action: () => this.pet(a) });
      else this.interactables.push({
        x: 0, y: 0, r: 16, follow: a,
        label: () => (this.owner && this.restored('bridge') && !this.farm.chores?.milk ? { text: 'Milk the cow' } : { text: 'Pet the cow' }),
        action: () => (this.owner && this.restored('bridge') && !this.farm.chores?.milk ? this.doChore('milk', { x: a.s.x, y: a.s.y }) : this.pet(a)),
      });
      return a;
    };
    add('chicken', 8 * TILE, 9.5 * TILE, { x: 7 * TILE, y: 9.5 * TILE, r: 40 });
    add('chicken', 5 * TILE, 10.5 * TILE, { x: 7 * TILE, y: 9.5 * TILE, r: 40 });
    add('chicken', 10 * TILE, 8.5 * TILE, { x: 7 * TILE, y: 9.5 * TILE, r: 40 });
    add('cow', 39 * TILE, 19.5 * TILE, { x: 39 * TILE, y: 19.8 * TILE, r: 30 }, true);
  }

  petAnimal(a, quiet) {
    if (!quiet) sfx.cluck();
    this.tweens.add({ targets: a.s, y: a.s.y - 4, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    this.hearts.explode(3, a.s.x, a.s.y - 14);
  }

  pet(a) {
    this.visited.pet = true;
    sfx.cluck();
    this.tweens.add({ targets: a.s, y: a.s.y - 4, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    this.hearts.explode(3, a.s.x, a.s.y - 14);
  }

  updateAnimals(dt) {
    for (const a of this.animals) {
      if (a.target) {
        const dx = a.target.x - a.s.x, dy = a.target.y - a.s.y, d = Math.hypot(dx, dy);
        const sp = a.kind === 'cow' ? 10 : 18;
        if (d < 1.5) {
          a.target = null; a.wait = 1.5 + Math.random() * 4;
          a.s.play(`${a.kind === 'cow' ? 'cow' : 'chick'}-idle`, true);
        } else {
          a.s.x += (dx / d) * sp * dt; a.s.y += (dy / d) * sp * dt;
          a.s.setFlipX(a.kind === 'cow' ? dx < 0 : dx > 0);
        }
      } else if ((a.wait -= dt) <= 0) {
        const ang = Math.random() * Math.PI * 2, rr = Math.random() * a.home.r;
        const tx = a.home.x + Math.cos(ang) * rr, ty = a.home.y + Math.sin(ang) * rr * 0.6;
        if (!this.blocked(tx, ty, 5, 3)) {
          a.target = { x: tx, y: ty };
          a.s.play(`${a.kind === 'cow' ? 'cow' : 'chick'}-walk`, true);
        } else a.wait = 0.5;
      }
      a.s.setDepth(a.s.y);
      a.sh.setPosition(Math.round(a.s.x), Math.round(a.s.y) - 1);
    }
  }

  // ---------- player ----------
  /** Character animations (player, villagers, townsfolk all share the base sprite). */
  createAnims() {
    if (this.anims.exists('idle-down')) return;
    const dirs = ['down', 'up', 'left', 'right'];
    dirs.forEach((d, r) => {
      this.anims.create({ key: `idle-${d}`, frames: this.anims.generateFrameNumbers('player', { frames: [r * 4, r * 4 + 1] }), frameRate: 1.6, repeat: -1 });
      this.anims.create({ key: `walk-${d}`, frames: this.anims.generateFrameNumbers('player', { frames: [r * 4 + 2, r * 4 + 3] }), frameRate: 7, repeat: -1 });
      this.anims.create({ key: `water-${d}`, frames: this.anims.generateFrameNumbers('player-actions', { frames: [16 + r * 2, 17 + r * 2] }), frameRate: 3, repeat: 2 });
    });
  }

  buildPlayer() {
    const sx = Number(params.get('x')) || 16.5, sy = Number(params.get('y')) || 11.4;
    this.player = this.add.sprite(sx * TILE, sy * TILE, 'player').setOrigin(0.5, 32 / 48);
    if (!this.owner) this.player.setTint(hex(PAL.blueLight)); // visitors look a little different
    this.playerShadow = this.add.image(0, 0, 'shadow').setDepth(-4).setScale(0.8, 0.9);
    this.facing = 'down';
    this.player.play('idle-down');
    this.lights.push({ x: 0, y: 0, r: 26, follow: this.player, on: () => true, soft: true });
  }

  blocked(x, y, hw = 5, hh = 3) {
    const pts = [[x - hw, y - hh], [x + hw, y - hh], [x - hw, y + 1], [x + hw, y + 1]];
    for (const [px, py] of pts) {
      if (px < 4 || py < 8 || px > W - 4 || py > H - 2) return true;
      if (this.isWater(px, py)) {
        const t = this.bridgeTiles;
        const onBridge = this.restored('bridge') && Math.floor(py / TILE) === t.y && px >= t.x0 * TILE && px <= (t.x1 + 1) * TILE;
        const d = this.dockTiles;
        const onDock = d && this.restored('dock') && Math.floor(px / TILE) === d.x && Math.floor(py / TILE) >= d.y0 && Math.floor(py / TILE) <= d.y1;
        if (!onBridge && !onDock) return true;
      }
    }
    for (const c of this.colliders) {
      if (x + hw > c.x && x - hw < c.x + c.w && y + 1 > c.y && y - hh < c.y + c.h) return true;
    }
    return false;
  }

  updatePlayer(dt) {
    if (this.busy) return;
    if (this.inputLocked) { this.moveTarget = null; this.player.play(`idle-${this.facing}`, true); return; }
    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (vx || vy) this.moveTarget = null;
    if (vx || vy || this.moveTarget) {
      this.idle = 0;
      if (this.piloting) { this.piloting = false; this.selfPilot?.reset(); }
    } else if (this.selfPilot && (this.idle += dt) > IDLE_BEFORE_AUTOPILOT) {
      if (!this.piloting) { this.piloting = true; this.selfPilot.reset(); }
      this.selfPilot.update(dt, this.view.state);
      this.facing = this.selfActor.facing;
      return;
    }
    if (this.moveTarget) {
      const dx = this.moveTarget.x - this.player.x, dy = this.moveTarget.y - this.player.y;
      if (Math.hypot(dx, dy) < 3) this.moveTarget = null;
      else { vx = dx; vy = dy; }
    }
    const len = Math.hypot(vx, vy);
    const p = this.player;
    if (len) {
      vx /= len; vy /= len;
      const nx = p.x + vx * SPEED * dt, ny = p.y + vy * SPEED * dt;
      let moved = false;
      if (!this.blocked(nx, p.y)) { p.x = nx; moved = true; }
      if (!this.blocked(p.x, ny)) { p.y = ny; moved = true; }
      if (!moved && this.moveTarget) this.moveTarget = null;
      this.facing = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
      p.play(`walk-${this.facing}`, true);
      this.stepTimer = (this.stepTimer || 0) - dt;
      if (this.stepTimer <= 0) { this.stepTimer = 0.28; this.stepAlt = !this.stepAlt; sfx.step(this.stepAlt); }
    } else p.play(`idle-${this.facing}`, true);
    p.setDepth(p.y);
    this.playerShadow.setPosition(Math.round(p.x), Math.round(p.y) + 1);
  }

  // ---------- interaction ----------
  nearest() {
    const p = this.player;
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const ix = it.follow ? it.follow.s.x : it.x, iy = it.follow ? it.follow.s.y : it.y;
      const d = Math.hypot(ix - p.x, iy - p.y);
      if (d < it.r + 8 && d < bd) { best = it; bd = d; }
    }
    return best;
  }

  // ---------- goals: always show the next thing to do ----------
  computeGoal() {
    const v = this.view.valley, f = this.farm, name = this.view.name;
    if (this.view.state === 'urgent_low' || this.view.state === 'urgent_high') {
      return this.owner ? { id: 'urgent', text: 'Take care of yourself first' } : { id: 'urgent', text: `Check on ${name}` };
    }
    const well = { x: this.wellPos.x, y: this.wellPos.y - 24 };
    if (this.owner) {
      if (this.pending > 0 || this.gifts > 0) return { id: 'collect', text: 'Collect sunlight at the Sun Well', target: well };
      const q = this.view.quest;
      if (q?.claimable) return { id: 'claim', text: 'Claim your ribbon from Maple', target: this.mapleTarget() };
      if (q && !this.questSeen()) return { id: 'quest', text: "Meet Maple for this week's goal", target: this.mapleTarget() };
      const next = nextRestorable(v.restored);
      if (next && v.sun >= next.cost) return { id: `restore-${next.id}`, text: `Restore the ${next.name}`, target: this.restorableAt[next.id] };
      for (const [id, c] of Object.entries(CHORES)) {
        if (!this.restored(c.needs) || f.chores?.[id]) continue;
        if (c.ripe && f.ripeness < 1) continue;
        return { id: `chore-${id}`, text: c.label, target: this.choreTarget(id) };
      }
      if (this.restored('kitchen') && (f.dishesToday || 0) < 3 && suggestRecipe(f)) return { id: 'cook', text: `Cook ${suggestRecipe(f).name.toLowerCase()}`, target: { x: this.kitchenAt.x, y: this.kitchenAt.y - 30 } };
      if (!v.wateredToday) return { id: 'water', text: "Water today's sprout", target: { x: this.todayPlant.x, y: this.todayPlant.y - 26 } };
      const j = this.view.journal;
      if (j && !j.recent?.[0]?.tags?.length && !j.recent?.[1]?.tags?.length) return { id: 'journal', text: 'Tag your day in the Garden Journal', target: { x: this.journalBox.x, y: this.journalBox.y - 18 } };
      const growing = Object.entries(CHORES).find(([id, c]) => c.ripe && this.restored(c.needs) && !f.chores?.[id] && f.ripeness < 1);
      if (growing) return { id: 'ripen', text: `${growing[1].label.replace(/^\w+ /, (w) => w)} when ripe`, sub: 'Crops grow while you stay in range', progress: [Math.round(f.ripeness * 100), 100], unit: '%' };
      if (next) return { id: `save-${next.id}`, text: `Save up for the ${next.name}`, sub: 'Stay in range to fill the Sun Well', progress: [v.sun, next.cost] };
      return { id: 'done', text: 'All done for today', sub: 'The well refills as you stay in range' };
    }
    if (!this.giftsSent) return { id: 'gift', text: `Leave a gift for ${name}`, target: well };
    if (!this.visited.sam && this.sam) return { id: 'sam', text: `Say hi to ${name}`, follow: { s: this.sam } };
    if (!this.visited.garden) return { id: 'garden', text: `Visit ${name}'s Garden of Days`, target: { x: 8.5 * TILE + 8, y: 17.6 * TILE } };
    const hen = this.animals.find((an) => an.kind === 'chicken');
    if (!this.visited.pet && hen) return { id: 'pet', text: 'Say hi to the chickens', follow: hen };
    return { id: 'explore', text: `Explore ${name}'s valley`, sub: 'Come back tomorrow to see a new plant' };
  }

  choreTarget(id) {
    if (id === 'eggs') return { x: SPOTS.coop.x * TILE + 22, y: SPOTS.coop.y * TILE - 8 };
    if (id === 'milk') { const cow = this.animals.find((a) => a.kind === 'cow'); return cow ? { x: cow.s.x, y: cow.s.y - 26 } : null; }
    if (id === 'harvest') return { x: (SPOTS.patch.x0 + SPOTS.patch.w / 2) * TILE, y: SPOTS.patch.y0 * TILE + 8 };
    if (id === 'apples') return { x: 38.4 * TILE, y: 11 * TILE };
    return null;
  }

  mapleTarget() { return this.maple ? { x: this.maple.x, y: this.maple.y - 26 } : null; }
  questKey() { return `sugar-valley-quest-seen-${this.view.quest?.week}`; }
  questSeen() { try { return !!localStorage.getItem(this.questKey()); } catch { return true; } }

  updateGoal(time) {
    let g = this.computeGoal();
    // While the character does their own thing, say what they're doing.
    if (this.owner && this.piloting && this.selfPilot.label && g.id !== 'urgent') g = { id: `auto-${this.selfPilot.label}`, text: this.selfPilot.label, sub: 'Move to take over' };
    if (!this.owner && this.samPilot?.label && ['explore', 'pet', 'garden'].includes(g.id)) g = { ...g, sub: this.samPilot.label };
    const sig = `${g.id}|${g.progress}|${g.text}`;
    if (sig !== this.goalSig) this.goalSig = sig;
    const t = g.follow ? { x: g.follow.s.x, y: g.follow.s.y - 16 } : g.target;
    const p = this.player;
    const show = !!t && Math.hypot(t.x - p.x, t.y + 20 - p.y) > 34;
    this.arrow.setVisible(show);
    if (!show) return;
    const v = this.cameras.main.worldView, m = 10;
    const inView = t.x > v.x + m && t.x < v.right - m && t.y > v.y + m + 8 && t.y < v.bottom - m;
    const bob = Math.sin(time / 180) * 3;
    if (inView) {
      this.arrow.setOrigin(0.5, 1).setRotation(0).setPosition(Math.round(t.x), Math.round(t.y - 2 + bob));
    } else {
      // Off screen: pin to the edge, pointing toward the target.
      const ang = Math.atan2(t.y - p.y, t.x - p.x);
      const cx = Phaser.Math.Clamp(t.x, v.x + m, v.right - m), cy = Phaser.Math.Clamp(t.y, v.y + m, v.bottom - m);
      this.arrow.setOrigin(0.5).setRotation(ang - Math.PI / 2)
        .setPosition(Math.round(cx - Math.cos(ang) * bob), Math.round(cy - Math.sin(ang) * bob));
    }
  }

  promptFor(it) {
    const l = it.label();
    return { ...l, action: !!it.action && !l.noKey };
  }

  interact() {
    unlockAudio();
    if (this.inputLocked || this.sys.isSleeping()) return;
    if (this.busy) return;
    const it = this.nearest();
    if (it?.action) it.action();
  }

  async runAct(action, body) {
    if (this.busyNet) return null;
    this.busyNet = true;
    try { const res = await act(action, body); this.setView(res.view); return res; } catch (e) {
      sfx.deny(); this.toast(e.message); return null;
    } finally { this.busyNet = false; }
  }

  async doChore(id, at) {
    const res = await this.runAct('chore', { id });
    if (!res) return;
    ({ eggs: sfx.eggs, milk: sfx.milk, harvest: sfx.harvest, apples: sfx.harvest }[id] || sfx.collect)();
    const gives = Object.entries(res.gives || {});
    gives.forEach(([k, n], i) => this.flyItem(k, at, i));
    this.toast(`+${gives.map(([k, n]) => `${n} ${n > 1 ? ITEMS[k].plural : ITEMS[k].name.toLowerCase()}`).join(', ')} for your basket`);
  }

  async doCook(recipe) {
    const k = this.kitchenAt;
    this.busy = true;
    this.player.play(`idle-${this.facing}`);
    this.steam.explode(8, k.x, k.y - 20);
    const res = await this.runAct('cook', { id: recipe.id });
    this.time.delayedCall(600, () => { this.busy = false; });
    if (!res) return;
    sfx.sizzle();
    this.sparkles.explode(16, k.x, k.y - 18);
    const sun = res.sun ? ` +${res.sun} sunlight` : '';
    this.toast(res.first ? `New recipe: ${recipe.name}!${sun}` : `You cooked ${recipe.name.toLowerCase()}.${sun}`);
    this.game.events.emit('sun-collected');
  }

  flyItem(kind, at, i) {
    const [key, frame] = ITEM_ICON[kind] || ['icon-sun'];
    const img = this.add.image(at.x, at.y - 10, key, frame).setDepth(100006);
    this.tweens.add({ targets: img, y: at.y - 34 - i * 4, x: at.x + (i - 0.5) * 10, duration: 450, ease: 'Quad.easeOut', delay: i * 120 });
    this.tweens.add({ targets: img, alpha: 0, duration: 300, delay: 900 + i * 120, onComplete: () => img.destroy() });
  }

  async handleHudAction(a) {
    if (a.type === 'journal') { const res = await this.runAct('journal', { day: a.day, tags: a.tags }); if (res?.sun) { this.toast(`Thanks for reflecting. +${res.sun} sunlight`); this.game.events.emit('sun-collected'); } }
    if (a.type === 'claim') {
      const res = await this.runAct('quest');
      if (res) { sfx.fanfare(); this.sparkles.explode(24, this.maple.x, this.maple.y - 20); this.toast(`Ribbon earned! +${res.sun} sunlight`); this.game.events.emit('sun-collected'); }
    }
  }

  // ---------- villager: Maple and her notice board ----------
  buildVillager() {
    const { x, y } = SPOTS.maple;
    this.maple = this.add.sprite(x * TILE, y * TILE, 'player').setOrigin(0.5, 32 / 48).setTint(hex(PAL.roseLight));
    this.mapleShadow = this.add.image(0, 0, 'shadow').setDepth(-4).setScale(0.8, 0.9);
    this.maple.play('idle-down');
    this.mapleActor = new Actor(this, this.maple, this.mapleShadow);
    this.mapleActor.sync();
    this.mapleHome = { x: x * TILE, y: y * TILE };
    this.mapleWait = 3;
    this.lights.push({ x: 0, y: 0, r: 18, follow: this.maple, on: () => true, soft: true });
    this.interactables.push({
      x: 0, y: 0, r: 16, follow: { s: this.maple },
      label: () => (this.owner ? { text: this.view.quest?.claimable ? 'Claim your ribbon from Maple' : "Talk to Maple · this week's goal" } : { text: 'Say hi to Maple' }),
      action: () => {
        this.mapleActor.faceToward(this.player.x, this.player.y);
        this.maple.play(`idle-${this.mapleActor.facing}`);
        if (this.owner) { try { localStorage.setItem(this.questKey(), '1'); } catch { /* blocked */ } this.goalSig = null; this.game.events.emit('open-quest'); }
        else { this.mapleActor.bubbleIcon('gift-heart'); this.toast(`Maple: "Any friend of ${this.view.name}'s is a friend of mine!"`); }
      },
    });
  }

  updateVillager(dt) {
    const a = this.mapleActor;
    if (a.path?.length) a.walk(dt, 0.6);
    else {
      this.maple.play(`idle-${a.facing}`, true);
      if ((this.mapleWait -= dt) <= 0) {
        this.mapleWait = 4 + Math.random() * 5;
        const h = this.mapleHome;
        a.goTo(h.x + (Math.random() * 40 - 20), h.y + (Math.random() * 16 - 4));
        if (a.bubble) a.clearBubble();
      }
    }
    a.sync();
  }

  // ---------- autopilot: the character lives on their own ----------
  rebuildWalkGrid() {
    this.walk = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => !this.blocked(x * TILE + 8, y * TILE + 12, 4, 2)));
  }

  nearestWalkable(tx, ty) {
    for (let r = 0; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (this.walk[y]?.[x]) return { x, y };
    }
    return null;
  }

  randomWalkable(actor) {
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(actor.x / TILE) + Math.floor(Math.random() * 17) - 8, y = Math.floor(actor.y / TILE) + Math.floor(Math.random() * 13) - 6;
      if (this.walk[y]?.[x] && (!this.east[y]?.[x] || this.restored('bridge'))) return { x: x * TILE + 8, y: y * TILE + 12 };
    }
    return null;
  }

  buildAutopilot() {
    if (this.owner) {
      this.selfActor = new Actor(this, this.player, this.playerShadow);
      this.selfPilot = new Autopilot(this, this.selfActor, { real: true });
      this.footstep = (a) => { if (a === this.selfActor && this.cameras.main.worldView.contains(a.x, a.y)) sfx.step(Math.random() < 0.5); };
      return;
    }
    // Visitors: Sam lives in the valley, acting out their blood sugar.
    const w = this.wellPos;
    this.sam = this.add.sprite(w.x + 24, w.y + 14, 'player').setOrigin(0.5, 32 / 48);
    this.samShadow = this.add.image(0, 0, 'shadow').setDepth(-4).setScale(0.8, 0.9);
    this.samTag = this.add.text(0, 0, this.view.name, { fontFamily: '"Pixelify Sans"', fontSize: '8px', color: '#f3e5c2', stroke: '#645552', strokeThickness: 2, resolution: 4 }).setOrigin(0.5, 1).setDepth(100004);
    this.samActor = new Actor(this, this.sam, this.samShadow);
    this.samPilot = new Autopilot(this, this.samActor, { name: this.view.name });
    this.lights.push({ x: 0, y: 0, r: 22, follow: this.sam, on: () => true, soft: true });
    this.interactables.push({
      x: 0, y: 0, r: 16, follow: { s: this.sam },
      label: () => ({ text: `Wave at ${this.view.name}` }),
      action: () => { this.visited.sam = true; this.samActor.bubbleIcon('gift-heart'); this.tweens.add({ targets: this.sam, y: this.sam.y - 5, duration: 140, yoyo: true }); sfx.open(); },
    });
  }

  // ---------- the dog ----------
  buildDog() {
    const home = { x: 23.5 * TILE, y: 10.6 * TILE };
    this.add.image(home.x, home.y, 'dog-house').setOrigin(0.5, 1).setDepth(home.y);
    this.add.image(home.x, home.y - 1, 'shadow').setDepth(-4).setScale(1.4, 1.2);
    this.colliders.push({ x: home.x - 9, y: home.y - 8, w: 18, h: 7 });
    this.rebuildWalkGrid();
    this.dog = new Dog(this, home);
    this.interactables.push({
      x: 0, y: 0, r: 14, follow: { s: this.dog.sprite },
      label: () => ({ text: 'Pet the dog' }),
      action: () => { sfx.cluck(); this.hearts.explode(4, this.dog.x, this.dog.y - 12); this.tweens.add({ targets: this.dog.sprite, y: this.dog.y - 5, duration: 120, yoyo: true }); },
    });
  }

  updateDog(dt) {
    const owner = this.owner ? this.player : this.sam;
    const pilot = this.owner ? (this.piloting ? this.selfPilot : null) : this.samPilot;
    this.dog.update(dt, owner, { leash: !!pilot?.leash, napping: this.view.state === 'stale' });
  }

  throwBall(actor, spot) {
    const ball = this.add.image(actor.x, actor.y - 14, 'p-dot').setScale(2).setTint(hex(PAL.roseDark)).setDepth(100000);
    this.tweens.add({ targets: ball, x: spot.x, duration: 650, ease: 'Linear' });
    this.tweens.add({ targets: ball, y: { from: actor.y - 14, to: spot.y - 2 }, duration: 650, ease: 'Quad.easeIn',
      onComplete: () => this.dog.fetch({ x: spot.x, y: spot.y }, () => ball.destroy()) });
    this.dog.sprite.setTexture('dog-0');
    this.time.delayedCall(8000, () => ball.destroy());
  }

  /** Real tasks the owner's character does on their own while in range (they earn sunlight). */
  autoTask() {
    if (!this.owner || this.busyNet || this.busy || this.inputLocked) return null;
    const v = this.view.valley, f = this.farm, w = this.wellPos;
    if (this.pending >= 15 || this.gifts > 0) {
      return { label: 'Collecting sunlight at the Sun Well', target: { x: w.x, y: w.y + 8 }, look: w, duration: 1.8, begin: () => this.collectSun() };
    }
    const spot = {
      eggs: { x: SPOTS.coop.x * TILE + 22, y: SPOTS.coop.y * TILE + 10 },
      harvest: { x: (SPOTS.patch.x0 + SPOTS.patch.w / 2) * TILE, y: (SPOTS.patch.y0 + SPOTS.patch.h) * TILE + 8 },
      apples: { x: 38.4 * TILE, y: 13.9 * TILE },
    };
    const label = { eggs: 'Collecting eggs', milk: 'Milking the cow', harvest: 'Harvesting the veggie patch', apples: 'Picking apples' };
    for (const [id, c] of Object.entries(CHORES)) {
      if (!this.restored(c.needs) || f.chores?.[id] || (c.ripe && f.ripeness < 1)) continue;
      if (id === 'milk') {
        const cow = this.animals.find((an) => an.kind === 'cow');
        if (!cow) continue;
        return { label: label.milk, target: { x: cow.s.x - 14, y: cow.s.y + 2 }, followAnimal: cow, duration: 1.8, begin: () => this.doChore('milk', { x: cow.s.x, y: cow.s.y }) };
      }
      const at = spot[id];
      return { label: label[id], target: at, duration: 1.8, begin: () => this.doChore(id, at) };
    }
    const recipe = this.restored('kitchen') && (f.dishesToday || 0) < 3 && suggestRecipe(f);
    if (recipe) {
      const k = this.kitchenAt;
      return { label: `Cooking ${recipe.name.toLowerCase()}`, target: { x: k.x, y: k.y + 2 }, look: { x: k.x, y: k.y - 10 }, duration: 2.2, begin: () => this.doCook(recipe) };
    }
    if (!v.wateredToday) {
      const p = this.todayPlant;
      return { label: "Watering today's sprout", target: { x: p.x, y: p.y + 12 }, look: { x: p.x, y: p.y }, duration: 2, begin: () => this.waterSprout() };
    }
    return null;
  }

  // ---------- cottage interior ----------
  /** Go inside a building (cottage, coffee, bakery, restaurant, gym). auto: the character walked in on their own. */
  enterBuilding(id, { auto = false } = {}) {
    if (this.inside) return;
    this.inside = id;
    sfx.open();
    this.game.events.emit('prompt', null);
    this.cameras.main.fadeOut(250, 20, 16, 30);
    this.time.delayedCall(260, () => {
      this.scene.sleep();
      this.scene.launch('Interior', { building: id, auto });
      this.scene.bringToTop('Hud');
    });
  }

  doorOf(id) { return id === 'cottage' ? this.cottageDoor : this.town.spots[id]; }

  exitedBuilding(id, { auto = false } = {}) {
    this.inside = null;
    const d = this.doorOf(id);
    this.player.setPosition(d.x, d.y + 4);
    this.facing = 'down';
    this.player.play('idle-down');
    this.selfPilot?.reset();
    // Came out on their own: keep doing their own thing. Walked out by hand: back in control.
    if (auto) { this.piloting = true; this.idle = 99; } else { this.idle = 0; this.piloting = false; }
    this.cameras.main.fadeIn(300, 20, 16, 30);
    this.goalSig = null; this.lastNear = undefined;
  }

  // Visitors: Sam goes into a building (and comes back out when their visit ends)
  samEnter(id) {
    this.samInside = id;
    for (const o of [this.sam, this.samShadow, this.samTag]) o.setVisible(false);
  }
  samExit(id) {
    if (this.samInside !== id) return;
    this.samInside = null;
    const d = this.doorOf(id);
    this.sam.setPosition(d.x, d.y + 4);
    for (const o of [this.sam, this.samShadow, this.samTag]) o.setVisible(true);
  }

  async collectSun() {
    if ((this.pending <= 0 && this.gifts <= 0) || this.busyNet) { sfx.blip(); return; }
    this.busyNet = true;
    let res;
    try { res = await act('collect'); } catch (e) { this.busyNet = false; this.game.events.emit('toast', e.message); return; }
    this.busyNet = false;
    this.setView(res.view);
    sfx.collect();
    this.sparkles.explode(24, this.wellPos.x, this.wellPos.y - 12);
    this.tweens.add({ targets: this.well, scaleY: { from: 0.85, to: 1 }, scaleX: { from: 1.12, to: 1 }, duration: 380, ease: 'Back.easeOut' });
    const gifts = res.gifts ? ` and ${res.gifts} gift${res.gifts > 1 ? 's' : ''}` : '';
    this.game.events.emit('toast', `+${res.collected} sunlight from your readings${gifts}`);
    this.game.events.emit('sun-collected', res.collected);
  }

  async leaveGift() {
    if (this.busyNet) return;
    const kind = GIFT_KINDS[this.giftsSent % GIFT_KINDS.length];
    this.busyNet = true;
    let res;
    try { res = await act('gift', { kind }); } catch (e) { this.busyNet = false; sfx.deny(); this.game.events.emit('toast', e.message); return; }
    this.busyNet = false;
    this.giftsSent++;
    this.goalSig = null;
    this.setView(res.view);
    sfx.collect();
    this.sparkles.explode(16, this.wellPos.x, this.wellPos.y - 8);
    this.game.events.emit('toast', `Gift left for ${this.view.name}. It turns into sunlight when they visit the well.`);
  }

  async waterSprout() {
    if (this.view.valley.wateredToday || this.busyNet) { sfx.blip(); return; }
    const ok = this.runAct('water');
    this.busy = true;
    const p = this.player;
    const dir = this.todayPlant.x < p.x - 6 ? 'left' : this.todayPlant.x > p.x + 6 ? 'right' : this.todayPlant.y < p.y ? 'up' : 'down';
    this.facing = dir;
    p.play(`water-${dir}`);
    sfx.water();
    this.drops.explode(10, this.todayPlant.x, this.todayPlant.y - 10);
    this.time.delayedCall(1700, async () => {
      this.busy = false;
      if (!(await ok)) return;
      this.tweens.add({ targets: this.todayPlant, scaleY: { from: 0.6, to: 1 }, duration: 500, ease: 'Back.easeOut' });
      this.sparkles.explode(8, this.todayPlant.x, this.todayPlant.y - 8);
      this.game.events.emit('toast', "Watered. Today's plant blooms at midnight.");
    });
  }

  // ---------- lighting ----------
  buildLighting() {
    this.dark = this.add.renderTexture(0, 0, 10, 10).setOrigin(0).setDepth(100000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.lightStamp = this.make.image({ key: 'light', add: false });
    this.glows = this.add.group();
    this.glowPool = [];
  }

  hourNow() {
    if (params.get('t')) return Number(params.get('t'));
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  updateLighting() {
    const cam = this.cameras.main, v = cam.worldView;
    const color = skyAt(this.hourNow());
    const lum = (((color >> 16) & 255) * 0.3 + ((color >> 8) & 255) * 0.59 + (color & 255) * 0.11) / 255;
    this.night = Math.max(0, Math.min(1, (1 - lum) * 1.7));
    const w = Math.ceil(v.width) + 4, h = Math.ceil(v.height) + 4;
    if (this.dark.width !== w || this.dark.height !== h) this.dark.resize(w, h);
    this.dark.setPosition(Math.floor(v.x) - 2, Math.floor(v.y) - 2);
    this.dark.setVisible(this.night > 0.01 || color !== 0xffffff);
    this.dark.clear();
    this.dark.fill(color, 1);
    let gi = 0;
    for (const l of this.lights) {
      if (!l.on()) continue;
      const lx = l.follow ? l.follow.x : l.x, ly = l.follow ? l.follow.y - 8 : l.y;
      if (lx < v.x - 60 || lx > v.right + 60 || ly < v.y - 60 || ly > v.bottom + 60) continue;
      const flick = l.warm ? 1 + Math.sin(this.time.now / 140 + lx) * 0.03 : 1;
      const r = l.r * flick * (l.soft ? 0.8 : 1);
      this.lightStamp.setScale((r * 2) / 128).setAlpha(Math.min(1, this.night * (l.soft ? 0.5 : 1.1)));
      this.dark.erase(this.lightStamp, lx - this.dark.x, ly - this.dark.y);
      if (l.warm && this.night > 0.15) {
        let g = this.glowPool[gi];
        if (!g) { g = this.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(100001).setTint(hex(PAL.gold)); this.glowPool[gi] = g; }
        g.setVisible(true).setPosition(lx, ly).setScale((r * 1.4) / 128).setAlpha(0.32 * this.night * flick);
        gi++;
      }
    }
    for (let i = gi; i < this.glowPool.length; i++) this.glowPool[i].setVisible(false);
    this.fireflies.setAlpha(Math.max(0, (this.night - 0.35) * 1.6));
    for (const g of this.windowGlows) g.setAlpha(Math.min(1, this.night * 1.4) * (0.92 + Math.sin(this.time.now / 300) * 0.04));
    this.leaves.setAlpha(Math.max(0, 1 - this.night * 2));
  }

  // ---------- particles ----------
  buildParticles() {
    this.sparkles = this.add.particles(0, 0, 'p-spark', {
      speed: { min: 20, max: 70 }, angle: { min: 200, max: 340 }, gravityY: 60, lifespan: { min: 500, max: 900 },
      scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', emitting: false,
    }).setDepth(100002);
    this.drops = this.add.particles(0, 0, 'p-dot', {
      speed: { min: 10, max: 30 }, angle: { min: 60, max: 120 }, gravityY: 180, lifespan: 500, tint: hex(PAL.waterLight),
      scale: { start: 1, end: 0.5 }, emitting: false,
    }).setDepth(100002);
    this.hearts = this.add.particles(0, 0, 'p-petal', {
      speed: { min: 8, max: 20 }, angle: { min: 250, max: 290 }, lifespan: 900, alpha: { start: 1, end: 0 }, scale: { start: 1.5, end: 1 }, emitting: false,
    }).setDepth(100002);
    this.fireflies = this.add.particles(0, 0, 'p-firefly', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: { min: 3000, max: 6000 }, speedX: { min: -6, max: 6 }, speedY: { min: -6, max: 4 },
      alpha: { values: [0, 1, 0.3, 1, 0] }, frequency: 35, blendMode: 'ADD', maxAliveParticles: 160,
    }).setDepth(100003);
    this.leaves = this.add.particles(0, 0, 'p-leaf', {
      x: { min: 0, max: W }, y: { min: -10, max: H * 0.6 }, lifespan: 7000, speedX: { min: 6, max: 18 }, speedY: { min: 8, max: 16 },
      rotate: { min: 0, max: 360 }, alpha: { values: [0, 1, 1, 0] }, frequency: 420,
    }).setDepth(99999);
    this.steam = this.add.particles(0, 0, 'p-dot', {
      speedY: { min: -18, max: -8 }, speedX: { min: -4, max: 4 }, lifespan: 1400, alpha: { start: 0.7, end: 0 }, scale: { start: 1, end: 2.5 }, tint: 0xf3f4e7, emitting: false,
    }).setDepth(100002);
    this.sweat = this.add.particles(0, 0, 'icon-sweat', { speedX: { min: -12, max: 12 }, speedY: { min: -20, max: -10 }, gravityY: 90, lifespan: 600, emitting: false }).setDepth(100002);
    this.zzz = this.add.particles(0, 0, 'icon-z', { speedY: { min: -10, max: -6 }, speedX: { min: 2, max: 6 }, lifespan: 2200, alpha: { start: 1, end: 0 }, scale: { start: 0.4, end: 0.8 }, emitting: false }).setDepth(100005);
    // Butterflies come out after 3+ hours steady in range
    this.butterflies = this.add.particles(0, 0, 'p-butterfly', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: { min: 5000, max: 9000 }, speedX: { min: -14, max: 14 }, speedY: { min: -10, max: 6 },
      scaleX: { values: [1, 0.2, 1, 0.2, 1, 0.2, 1, 0.2, 1, 0.2, 1] }, alpha: { values: [0, 1, 1, 1, 0] },
      tint: [hex(PAL.rose), hex(PAL.yellow), hex(PAL.blue), hex(PAL.violet), hex(PAL.peach)], frequency: 120, maxAliveParticles: 40, emitting: false,
    }).setDepth(99998);
    this.motes = this.add.particles(this.wellPos.x, this.wellPos.y - 12, 'p-dot', {
      x: { min: -8, max: 8 }, speedY: { min: -14, max: -6 }, lifespan: 1600, alpha: { start: 1, end: 0 }, tint: hex(PAL.goldLight),
      frequency: 160, blendMode: 'ADD',
    }).setDepth(100002);
  }

  update(time, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.updatePlayer(dt);
    this.updateAnimals(dt);
    this.updateVillager(dt);
    updateTown(this, dt);
    this.updateDog(dt);
    if (this.samPilot) {
      this.samPilot.update(dt, this.view.state);
      this.samTag.setPosition(Math.round(this.sam.x), Math.round(this.sam.y) - 22);
    }
    this.updateLighting();
    this.motes.emitting = this.pending > 0;
    const it = this.nearest();
    if (it?.plant) this.visited.garden = true;
    this.updateGoal(time);
    if (it !== this.lastNear) {
      this.lastNear = it;
      this.game.events.emit('prompt', it ? this.promptFor(it) : null);
    } else if (it && (this.promptTick = (this.promptTick || 0) + dt) > 0.5) {
      this.promptTick = 0;
      this.game.events.emit('prompt', this.promptFor(it));
    }
    this.ambT = (this.ambT || 0) + dt;
    if (this.ambT > 0.25) { ambience(this.night, this.ambT); this.ambT = 0; }
    if (this.music.useFallback) music(dt); else this.music.update(this.hourNow());
  }
}

function plantLabel(d) {
  const date = new Date(d.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const s = d.stats;
  if (!s.enough) return `${date} · not enough data`;
  if (s.hidden) return `${date}`;
  return `${date} · ${Math.round(s.tir)}% in range`;
}
