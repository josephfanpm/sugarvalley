// The character lives in the valley on their own, acting out their blood sugar:
//   in range: pets animals, waters the garden, cooks, wanders, sits by the pond
//   low: heads for a snack (juice box, apple), moves slower
//   high: jogs laps, drinks water at the well
//   urgent low/high: sits and treats (juice / water), with a "!" bubble
//   no recent data: naps by the cottage
// Drives the owner's character after a few idle seconds, and Sam's character for visitors.
import { TILE, COLS, ROWS } from './terrain.js';
import { PAL, hex } from '../data/palette.js';

const BASE_SPEED = 52;

// Weighted activity choices per state.
const PLAN = {
  in_range: [['pet', 3], ['garden', 2], ['wander', 2], ['sunflowers', 1], ['pond', 1], ['cook', 1], ['chickens', 1]],
  low: [['snack', 6], ['rest', 2], ['garden', 1]],
  high: [['jog', 4], ['drink', 3], ['wander', 1], ['pet', 1]],
  urgent_low: [['treat_low', 1]],
  urgent_high: [['treat_high', 1]],
  stale: [['nap', 1]],
};
const SPEED_MUL = { low: 0.75, high: 1.25, urgent_low: 0.6, urgent_high: 0.7, stale: 0.8 };

function pickWeighted(list) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of list) { if ((r -= w) <= 0) return k; }
  return list[0][0];
}

// ---------- grid A* ----------
export function findPath(walk, from, to) {
  const key = (x, y) => y * COLS + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  if (!inb(to.x, to.y) || !walk[to.y][to.x]) return null;
  const open = [{ x: from.x, y: from.y, g: 0, f: 0 }];
  const came = new Map(), g = new Map([[key(from.x, from.y), 0]]);
  const h = (x, y) => Math.hypot(x - to.x, y - to.y);
  let guard = 0;
  while (open.length && guard++ < 4000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === to.x && cur.y === to.y) {
      const path = [];
      let k = key(cur.x, cur.y);
      while (k !== undefined) { path.unshift({ x: k % COLS, y: Math.floor(k / COLS) }); k = came.get(k); }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inb(nx, ny) || !walk[ny][nx]) continue;
      if (dx && dy && (!walk[cur.y][nx] || !walk[ny][cur.x])) continue; // no corner cutting
      const ng = g.get(key(cur.x, cur.y)) + (dx && dy ? 1.414 : 1);
      if (ng < (g.get(key(nx, ny)) ?? Infinity)) {
        g.set(key(nx, ny), ng);
        came.set(key(nx, ny), key(cur.x, cur.y));
        open.push({ x: nx, y: ny, g: ng, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}

/** A walking character (player or NPC) the autopilot can drive. */
export class Actor {
  constructor(scene, sprite, shadow) {
    this.s = scene; this.sprite = sprite; this.shadow = shadow;
    this.facing = 'down';
    this.path = null; this.activity = null; this.timer = 0; this.bubble = null;
    this.stepTimer = 0;
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  tile() { return { x: Math.floor(this.x / TILE), y: Math.floor((this.y - 2) / TILE) }; }

  goTo(px, py) {
    const to = this.s.nearestWalkable(Math.floor(px / TILE), Math.floor(py / TILE));
    const from = this.s.nearestWalkable(this.tile().x, this.tile().y);
    if (!to || !from) return false;
    const p = findPath(this.s.walk, from, to);
    if (!p) return false;
    this.path = p.slice(1).map((t) => ({ x: t.x * TILE + 8, y: t.y * TILE + 12 }));
    if (this.path.length) { const last = this.path[this.path.length - 1]; last.x = px; last.y = py; }
    return true;
  }

  stop() { this.path = null; this.clearBubble(); this.activity = null; this.timer = 0; }

  face(dx, dy) { this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  faceToward(x, y) { this.face(x - this.x, y - this.y); }

  bubbleIcon(key, frame) {
    this.clearBubble();
    const b = this.s.add.container(this.x, this.y - 30).setDepth(100005);
    const bg = this.s.add.image(0, 0, 'bubble').setOrigin(0.5, 1);
    const icon = this.s.add.image(0, -11, key, frame).setOrigin(0.5);
    const max = Math.max(icon.width, icon.height);
    if (max > 13) icon.setScale(13 / max);
    b.add([bg, icon]);
    b.setScale(0.2);
    this.s.tweens.add({ targets: b, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.bubble = b;
  }
  clearBubble() { this.bubble?.destroy(); this.bubble = null; }

  /** Walk along the path. Returns true while moving. */
  walk(dt, speedMul = 1) {
    if (!this.path?.length) return false;
    const t = this.path[0];
    const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy);
    const step = BASE_SPEED * speedMul * dt;
    if (d <= step) { this.sprite.x = t.x; this.sprite.y = t.y; this.path.shift(); }
    else { this.sprite.x += (dx / d) * step; this.sprite.y += (dy / d) * step; }
    this.face(dx, dy);
    this.sprite.play(`walk-${this.facing}`, true);
    this.sprite.anims.timeScale = speedMul;
    if ((this.stepTimer -= dt) <= 0) { this.stepTimer = 0.3 / speedMul; this.s.footstep?.(this); }
    return true;
  }

  sync() {
    this.sprite.setDepth(this.sprite.y);
    this.shadow?.setPosition(Math.round(this.x), Math.round(this.y) + 1);
    if (this.bubble) this.bubble.setPosition(Math.round(this.x), Math.round(this.y) - 30);
  }
}

/** Chooses and runs activities for an Actor based on the current glucose state. */
export class Autopilot {
  constructor(scene, actor, { name = null } = {}) {
    this.s = scene; this.a = actor; this.name = name;
    this.phase = 'idle'; this.wait = 0.5; this.current = null; this.lastState = null;
  }

  reset() { this.a.stop(); this.phase = 'idle'; this.wait = 0.4; this.current = null; this.a.sprite.anims.timeScale = 1; }

  update(dt, state) {
    if (state !== this.lastState) { this.lastState = state; if (this.current) this.reset(); }
    const mul = SPEED_MUL[state] || 1;
    const a = this.a;
    if (this.phase === 'walking') {
      if (this.current?.followAnimal) {
        const an = this.current.followAnimal;
        if (Math.hypot(an.s.x - a.x, an.s.y - a.y) < 14) { a.path = null; this.arrive(); }
      }
      if (this.phase === 'walking' && !a.walk(dt, this.current?.speed ?? mul)) this.arrive();
    } else if (this.phase === 'doing') {
      this.current.tick?.(dt);
      if ((this.wait -= dt) <= 0) { this.current.end?.(); a.clearBubble(); this.phase = 'idle'; this.wait = 0.6 + Math.random() * 1.4; a.sprite.anims.timeScale = 1; }
    } else if ((this.wait -= dt) <= 0) {
      this.start(state);
    } else a.sprite.play(`idle-${a.facing}`, true);
    a.sync();
  }

  start(state) {
    const plan = PLAN[state] || PLAN.in_range;
    for (let tries = 0; tries < 4; tries++) {
      const kind = pickWeighted(plan);
      const act = this.make(kind);
      if (!act) continue;
      this.current = act;
      if (act.target && !this.a.goTo(act.target.x, act.target.y)) continue;
      this.phase = 'walking';
      return;
    }
    this.wait = 1; // nothing possible; try again soon
  }

  arrive() {
    const act = this.current;
    this.phase = 'doing';
    this.wait = act.duration ?? 3;
    if (act.look) this.a.faceToward(act.look.x, act.look.y);
    this.a.sprite.play(`idle-${this.a.facing}`, true);
    act.begin?.();
    // jog keeps going around the loop
    if (act.loop?.length) { this.phase = 'walking'; this.a.goTo(act.loop[0].x, act.loop[0].y); act.loop.shift(); }
  }

  make(kind) {
    const s = this.s, a = this.a;
    const P = (x, y) => ({ x: x * TILE, y: y * TILE });
    const door = s.cottageDoor;
    switch (kind) {
      case 'wander': {
        const t = s.randomWalkable(a);
        return t && { target: t, duration: 1.5 + Math.random() * 2.5 };
      }
      case 'pet':
      case 'chickens': {
        const pool = s.animals.filter((an) => (kind === 'chickens' ? an.kind === 'chicken' : true) && (!s.isEast(an.s.x, an.s.y) || s.restored('bridge')));
        const an = pool[Math.floor(Math.random() * pool.length)];
        if (!an) return null;
        return { target: { x: an.s.x + (Math.random() < 0.5 ? -12 : 12), y: an.s.y + 2 }, followAnimal: an, duration: 2.2,
          begin: () => { a.faceToward(an.s.x, an.s.y); a.sprite.play(`idle-${a.facing}`, true); s.petAnimal(an, true); a.bubbleIcon('gift-heart'); } };
      }
      case 'garden': {
        const plants = s.gardenPlants || [];
        const p = plants[Math.floor(Math.random() * plants.length)];
        if (!p) return null;
        return { target: { x: p.x, y: p.y + 12 }, look: { x: p.x, y: p.y }, duration: 2.4,
          begin: () => { a.sprite.play(`water-${a.facing}`); s.drops.explode(6, p.x, p.y - 8); } };
      }
      case 'sunflowers': {
        const f = s.sunflowerSpots?.[Math.floor(Math.random() * s.sunflowerSpots.length)];
        return f && { target: { x: f.x, y: f.y + 10 }, look: f, duration: 3, begin: () => a.bubbleIcon('icon-note') };
      }
      case 'pond': {
        const spot = s.restored('dock') ? s.dockSpot : P(21.5, 19.6);
        return { target: spot, look: { x: spot.x, y: spot.y + 30 }, duration: 4, begin: () => a.bubbleIcon('icon-note') };
      }
      case 'cook': {
        if (!s.restored('kitchen')) return null;
        const k = s.kitchenAt;
        return { target: { x: k.x, y: k.y + 2 }, look: { x: k.x, y: k.y - 10 }, duration: 4.5,
          begin: () => a.bubbleIcon('icon-pot'), tick: () => { if (Math.random() < 0.15) s.steam.emitParticleAt(k.x + (Math.random() * 6 - 3), k.y - 20); } };
      }
      case 'snack': {
        const k = s.restored('kitchen') ? s.kitchenAt : door;
        return { target: { x: k.x + 8, y: k.y + 4 }, duration: 5, speed: SPEED_MUL.low,
          begin: () => { if (Math.random() < 0.6) a.bubbleIcon('icon-juice'); else a.bubbleIcon('nature', 'apple'); } };
      }
      case 'rest': {
        return { target: { x: door.x - 14, y: door.y + 6 }, duration: 5, begin: () => a.bubbleIcon('icon-juice') };
      }
      case 'jog': {
        const loop = [P(16.5, 14.6), P(24.5, 15.3), P(21, 13.2), P(14.2, 13.6), P(10.5, 15.6), P(16.5, 14.6)];
        return { target: loop.shift(), loop, speed: 1.6, duration: 0.2,
          begin: () => { if (Math.random() < 0.6) s.sweat.emitParticleAt(a.x + 4, a.y - 22); } };
      }
      case 'drink': {
        const w = s.wellPos;
        return { target: { x: w.x + 16, y: w.y + 8 }, look: w, duration: 3.5, begin: () => a.bubbleIcon('milk-grass', 'water') };
      }
      case 'treat_low':
        return { target: { x: door.x - 14, y: door.y + 6 }, duration: 6, speed: 0.6,
          begin: () => a.bubbleIcon('icon-juice'), tick: () => { if (!a.bubble || Math.random() < 0.004) a.bubbleIcon(Math.random() < 0.5 ? 'icon-bang' : 'icon-juice'); } };
      case 'treat_high':
        return { target: { x: door.x + 14, y: door.y + 6 }, duration: 6, speed: 0.7,
          begin: () => a.bubbleIcon('milk-grass', 'water'), tick: () => { if (Math.random() < 0.004) { if (Math.random() < 0.5) a.bubbleIcon('icon-bang'); else a.bubbleIcon('milk-grass', 'water'); } } };
      case 'nap':
        return { target: { x: door.x - 18, y: door.y + 8 }, look: { x: door.x - 18, y: door.y + 30 }, duration: 8,
          begin: () => a.bubbleIcon('icon-z'), tick: () => { if (Math.random() < 0.02) s.zzz.emitParticleAt(a.x + 6, a.y - 22); } };
      default: return null;
    }
  }
}

export { hex, PAL };
