// The character lives in the valley on their own, acting out their blood sugar:
//   in range: does real tasks that earn sunlight (owner only), then pets animals, plays fetch, fishes,
//             chats with townsfolk, reads, tends the garden…
//   low: walks into town and eats (coffee shop, restaurant, bakery, juice, ice cream) until back in range
//   high: gym, track laps, walks the dog, yoga, water at the fountain, walks around the pond
//   urgent low/high: sits and treats (juice / water), with a "!" bubble
//   no recent data: naps by the cottage
// Drives the owner's character after a few idle seconds, and Sam's character for visitors.
import { TILE, COLS, ROWS } from './terrain.js';
import { PAL, hex } from '../data/palette.js';

const BASE_SPEED = 52;

// Weighted activity choices per state. In range, the owner's character first does real tasks that
// earn sunlight (World.autoTask); these are the in-between activities. 33 activities in all.
const PLAN = {
  in_range: [['pet', 3], ['fetch', 2], ['garden', 2], ['wander', 1], ['sunflowers', 1], ['pond', 1], ['fish', 1], ['chat', 2],
    ['fountain', 1], ['read', 1], ['flowers', 1], ['maple', 1], ['chickens', 1]],
  low: [['coffee', 3], ['restaurant', 3], ['bakery', 2], ['juice', 2], ['icecream', 1], ['homeSnack', 1]],
  high: [['gym', 4], ['track', 3], ['walkDog', 3], ['yoga', 1], ['fountainDrink', 2], ['pondWalk', 1], ['stretch', 1], ['benchOutside', 1]],
  urgent_low: [['treat_low', 1]],
  urgent_high: [['treat_high', 1]],
  stale: [['nap', 1]],
};
const SPEED_MUL = { low: 0.75, high: 1.25, urgent_low: 0.6, urgent_high: 0.7, stale: 0.8 };
// Between actions the character just hangs out. A new glucose range starts a new action right away.
export const ACTION_COOLDOWN = 300;

function pickWeighted(list) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of list) { if ((r -= w) <= 0) return k; }
  return list[0][0];
}

// ---------- grid A* (any grid: the valley in 16-px tiles, interiors in 8-px cells) ----------
export function findPathGrid(walk, from, to) {
  const rows = walk.length, cols = walk[0].length;
  const key = (x, y) => y * cols + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  if (!inb(to.x, to.y) || !walk[to.y][to.x]) return null;
  const open = [{ x: from.x, y: from.y, f: 0 }];
  const came = new Map(), g = new Map([[key(from.x, from.y), 0]]);
  const h = (x, y) => Math.hypot(x - to.x, y - to.y);
  let guard = 0;
  while (open.length && guard++ < 6000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === to.x && cur.y === to.y) {
      const path = [];
      let k = key(cur.x, cur.y);
      while (k !== undefined) { path.unshift({ x: k % cols, y: Math.floor(k / cols) }); k = came.get(k); }
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
        open.push({ x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}
export const findPath = findPathGrid;

/**
 * One collision-checked step toward (tx, ty) for a body at (x, y). Slides along walls; returns the
 * new position, or null if fully blocked. `blocked(x, y)` is the scene's check for this body.
 */
export function stepToward(x, y, tx, ty, step, blocked) {
  const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
  if (d < 0.001) return { x, y, arrived: true };
  const s = Math.min(step, d);
  const nx = x + (dx / d) * s, ny = y + (dy / d) * s;
  if (!blocked(nx, ny)) return { x: nx, y: ny, arrived: s >= d };
  if (Math.abs(dx) > 0.01 && !blocked(nx, y)) return { x: nx, y, arrived: false };
  if (Math.abs(dy) > 0.01 && !blocked(x, ny)) return { x, y: ny, arrived: false };
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
    // finish on the exact spot (a seat, a door, a counter) — the last short hop may step onto it
    if (this.path.length) this.path.push({ x: px, y: py, final: true });
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

  /** Walk along the path, colliding with the world and other bodies. Returns true while moving. */
  walk(dt, speedMul = 1) {
    if (!this.path?.length) return false;
    const t = this.path[0];
    const dx = t.x - this.x, dy = t.y - this.y;
    const step = BASE_SPEED * speedMul * dt;
    // The last hop onto an exact spot (seat, machine, door) may enter furniture; people still block.
    const check = (x, y) => (this.s.blockedFor ? this.s.blockedFor(this, x, y, { staticOk: t.final && Math.hypot(t.x - x, t.y - y) < 14 }) : false);
    const r = stepToward(this.x, this.y, t.x, t.y, step, check);
    if (r) {
      this.sprite.x = r.x; this.sprite.y = r.y; this.stuck = 0;
      if (r.arrived) this.path.shift();
    } else if ((this.stuck = (this.stuck || 0) + dt) > 0.7) {
      // Someone's in the way or a corner is tight: skip this waypoint (or give up on the last one).
      this.stuck = 0;
      this.path.shift();
      this.blockedOut = (this.blockedOut || 0) + 1;
    }
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
  constructor(scene, actor, { name = null, real = false } = {}) {
    this.s = scene; this.a = actor; this.name = name; this.real = real;
    this.phase = 'idle'; this.wait = 0.5; this.current = null; this.lastState = null; this.label = null; this.last = null;
  }

  reset({ cooldown = false } = {}) {
    this.current?.end?.();
    this.a.stop(); this.phase = 'idle'; this.wait = cooldown ? ACTION_COOLDOWN : 0.4; this.current = null; this.label = null;
    this.a.sprite.anims.timeScale = 1;
    this.tweenStop();
  }
  tweenStop() { if (this.tw) { this.tw.remove(); this.tw = null; this.a.sprite.setScale(1); } }
  get leash() { return this.phase !== 'idle' && !!this.current?.leash && (this.routeIdx > 1 || this.phase === 'doing'); }

  update(dt, state) {
    if (state !== this.lastState) { this.lastState = state; if (this.current) this.reset(); }
    const mul = SPEED_MUL[state] || 1;
    const a = this.a, act = this.current;
    if (this.phase === 'walking') {
      if (act?.followAnimal) {
        const an = act.followAnimal;
        if (Math.hypot(an.s.x - a.x, an.s.y - a.y) < 14) { a.path = null; this.arrive(); }
      }
      if (this.phase === 'walking' && !a.walk(dt, act?.speed ?? mul)) {
        if (act.route && this.routeIdx < act.route.length) this.stepRoute();
        else this.arrive();
      }
    } else if (this.phase === 'doing') {
      act.tick?.(dt);
      if ((this.wait -= dt) <= 0) {
        act.end?.(); a.clearBubble(); this.tweenStop();
        this.phase = 'idle'; this.wait = ACTION_COOLDOWN; a.sprite.anims.timeScale = 1; this.current = null; this.label = null;
      }
    } else if ((this.wait -= dt) <= 0) {
      this.start(state);
    } else a.sprite.play(`idle-${a.facing}`, true);
    a.sync();
  }

  start(state) {
    if (this.real && state === 'in_range') {
      const task = this.s.autoTask?.();
      if (task && this.begin(task)) return;
    }
    const plan = PLAN[state] || PLAN.in_range;
    for (let tries = 0; tries < 6; tries++) {
      const kind = pickWeighted(plan);
      if (kind === this.last && plan.length > 1) continue; // vary it up
      const act = this.make(kind);
      if (act && this.begin(act)) { this.last = kind; return; }
    }
    this.wait = 1;
  }

  begin(act) {
    this.current = act;
    this.label = act.label || null;
    this.routeIdx = 0;
    if (act.route) { act.route = act.route.map((p) => ({ ...p })); return this.stepRoute(); }
    if (act.target && !this.a.goTo(act.target.x, act.target.y)) { this.current = null; this.label = null; return false; }
    if (act.target) this.phase = 'walking'; else this.arrive();
    return true;
  }

  stepRoute() {
    const p = this.current.route[this.routeIdx++];
    this.current.onWaypoint?.(this.routeIdx);
    if (!this.a.goTo(p.x, p.y)) { this.arrive(); return true; }
    this.phase = 'walking';
    return true;
  }

  arrive() {
    const act = this.current;
    this.phase = 'doing';
    this.wait = act.duration ?? 3;
    if (act.look) this.a.faceToward(act.look.x, act.look.y);
    this.a.sprite.play(`idle-${this.a.facing}`, true);
    act.begin?.();
  }

  /** Gentle bobbing (squats, eating, breathing). */
  bob(scaleY = 0.9, ms = 380) {
    this.tweenStop();
    this.tw = this.s.tweens.add({ targets: this.a.sprite, scaleY, scaleX: 1 + (1 - scaleY) * 0.6, duration: ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Eat until back in range: cycles foods; never ends on its own (a state change ends it). */
  eatAt(spot, label, foods) {
    const a = this.a;
    let t = 0, i = 0;
    const show = () => { const [k, f] = foods[i++ % foods.length]; a.bubbleIcon(k, f); };
    return {
      label, target: spot, look: { x: spot.x, y: spot.y - 30 }, duration: Infinity, speed: SPEED_MUL.low,
      begin: () => { show(); this.bob(0.95, 520); },
      tick: (dt) => { if ((t += dt) > 4.5) { t = 0; show(); } },
    };
  }

  /** Walk to a building's door and go in. The owner's character enters for real; for visitors, Sam
   *  disappears inside (visitors can follow them in) until the visit ends. */
  visit(id, label) {
    const s = this.s, door = s.town?.spots?.[id];
    if (!door) return null;
    return {
      label, target: { x: door.x, y: door.y - 2 }, look: { x: door.x, y: door.y - 20 }, duration: Infinity,
      begin: () => { if (this.real) s.enterBuilding(id, { auto: true }); else s.samEnter(id); },
      end: () => { if (!this.real) s.samExit(id); },
    };
  }

  /** "You are…" for the owner, "Sam is…" for visitors. */
  say(you, them) { return this.name ? `${this.name} is ${them}` : you; }

  make(kind) {
    const s = this.s, a = this.a, sp = s.town?.spots || {};
    const P = (x, y) => ({ x: x * TILE, y: y * TILE });
    const door = s.cottageDoor;
    switch (kind) {
      // ---------- in range ----------
      case 'wander': {
        const t = s.randomWalkable(a);
        return t && { label: this.say('Taking a stroll', 'taking a stroll'), target: t, duration: 1.5 + Math.random() * 2.5 };
      }
      case 'pet':
      case 'chickens': {
        const pool = s.animals.filter((an) => (kind === 'chickens' ? an.kind === 'chicken' : true) && (!s.isEast(an.s.x, an.s.y) || s.restored('bridge')));
        const an = pool[Math.floor(Math.random() * pool.length)];
        if (!an) return null;
        return { label: this.say(`Petting the ${an.kind}`, `petting the ${an.kind}`), target: { x: an.s.x + (Math.random() < 0.5 ? -12 : 12), y: an.s.y + 2 }, followAnimal: an, duration: 2.4,
          begin: () => { a.faceToward(an.s.x, an.s.y); a.sprite.play(`idle-${a.facing}`, true); s.petAnimal(an, true); a.bubbleIcon('gift-heart'); } };
      }
      case 'fetch': {
        if (!s.dog) return null;
        const d = s.dog, near = { x: d.x + 16, y: d.y + 4 };
        return { label: this.say('Playing fetch with the dog', 'playing fetch with the dog'), target: near, look: { x: d.x, y: d.y }, duration: 5,
          begin: () => {
            a.bubbleIcon('icon-paw');
            const spot = s.randomWalkable({ x: d.home.x, y: d.home.y + 24 });
            if (spot) s.throwBall(a, spot);
          } };
      }
      case 'garden': {
        const plants = s.gardenPlants || [];
        const p = plants[Math.floor(Math.random() * plants.length)];
        if (!p) return null;
        return { label: this.say('Tending the Garden of Days', 'tending the Garden of Days'), target: { x: p.x, y: p.y + 12 }, look: { x: p.x, y: p.y }, duration: 2.6,
          begin: () => { a.sprite.play(`water-${a.facing}`); s.drops.explode(6, p.x, p.y - 8); } };
      }
      case 'sunflowers': {
        const f = s.sunflowerSpots?.[Math.floor(Math.random() * s.sunflowerSpots.length)];
        return f && { label: this.say('Admiring the sunflowers', 'admiring the sunflowers'), target: { x: f.x, y: f.y + 10 }, look: f, duration: 3, begin: () => a.bubbleIcon('icon-note') };
      }
      case 'pond': {
        const spot = P(21.5, 19.6);
        return { label: this.say('Watching the pond', 'watching the pond'), target: spot, look: { x: spot.x, y: spot.y + 30 }, duration: 4, begin: () => a.bubbleIcon('icon-note') };
      }
      case 'fish': {
        if (!s.restored('dock')) return null;
        const spot = s.dockSpot;
        return { label: this.say('Fishing off the dock', 'fishing off the dock'), target: spot, look: { x: spot.x, y: spot.y + 30 }, duration: 7,
          begin: () => a.bubbleIcon('icon-note'),
          tick: () => { if (Math.random() < 0.006) { a.bubbleIcon('icon-fish'); s.drops.explode(5, spot.x, spot.y + 12); } } };
      }
      case 'chat': {
        const folk = (s.folk || []).filter((f) => !f.inside && f.sprite.visible);
        const f = folk[Math.floor(Math.random() * folk.length)];
        if (!f) return null;
        const first = f.name.split(' ')[0];
        return { label: this.say(`Chatting with ${first}`, `chatting with ${first}`), target: { x: f.sprite.x + 14, y: f.sprite.y + 2 }, look: f.sprite, duration: 3.5,
          begin: () => { a.bubbleIcon('icon-chat'); f.actor.faceToward(a.x, a.y); f.sprite.play(`idle-${f.actor.facing}`); f.actor.bubbleIcon('icon-chat'); s.time.delayedCall(3000, () => f.actor.clearBubble()); } };
      }
      case 'maple':
        return s.maple && { label: this.say('Saying hi to Maple', 'saying hi to Maple'), target: { x: s.maple.x + 14, y: s.maple.y + 2 }, look: s.maple, duration: 3,
          begin: () => { a.bubbleIcon('icon-chat'); s.mapleActor.bubbleIcon('gift-heart'); } };
      case 'fountain':
        return sp.fountain && { label: this.say('Sitting by the fountain', 'sitting by the fountain'), target: sp.fountain, look: { x: sp.fountain.x, y: sp.fountain.y - 20 }, duration: 4.5, begin: () => a.bubbleIcon('icon-note') };
      case 'read': {
        const b = Math.random() < 0.5 ? sp.benchW : sp.benchE;
        return b && { label: this.say('Reading on a bench', 'reading on a bench'), target: b, look: { x: b.x, y: b.y + 20 }, duration: 6, begin: () => { a.bubbleIcon('icon-book'); this.bob(0.97, 900); } };
      }
      case 'flowers':
        return sp.flowers && { label: this.say('Picking out flowers', 'picking out flowers'), target: sp.flowers, look: { x: sp.flowers.x, y: sp.flowers.y - 20 }, duration: 3.5, begin: () => a.bubbleIcon('icon-flower') };

      // ---------- low: eat until back in range ----------
      case 'coffee':
        return this.visit('coffee', this.say('Getting cocoa and a croissant at The Sunny Cup', 'getting cocoa and a croissant at The Sunny Cup'));
      case 'restaurant':
        return this.visit('restaurant', this.say('Eating at Valley Kitchen', 'eating at Valley Kitchen'));
      case 'bakery':
        return this.visit('bakery', this.say('Grabbing a snack at the bakery', 'grabbing a snack at the bakery'));
      case 'juice':
        return sp.juice && this.eatAt(sp.juice, this.say('Having juice at the stand', 'having juice at the stand'), [['icon-juice']]);
      case 'icecream':
        return sp.icecream && this.eatAt(sp.icecream, this.say('Having an ice cream', 'having an ice cream'), [['icon-icecream']]);
      case 'homeSnack': {
        const k = s.restored('kitchen') ? s.kitchenAt : door;
        return this.eatAt({ x: k.x + 8, y: k.y + 4 }, this.say('Having a snack at home', 'having a snack at home'), [['icon-juice'], ['nature', 'apple']]);
      }

      // ---------- high: move to bring it down ----------
      case 'gym':
        return this.visit('gym', this.say('Working out at Steady Strength Gym', 'working out at Steady Strength Gym'));
      case 'benchOutside':
        return sp.gym && { label: this.say('Lifting outside the gym', 'lifting outside the gym'), target: sp.gym, look: { x: sp.gym.x, y: sp.gym.y - 20 }, duration: 9,
          begin: () => { a.bubbleIcon('icon-dumbbell'); this.bob(0.86, 420); },
          tick: () => { if (Math.random() < 0.02) s.sweat.emitParticleAt(a.x + 4, a.y - 22); } };
      case 'track':
        return sp.track && { label: this.say('Running laps at the track', 'running laps at the track'), route: [...sp.track, ...sp.track, sp.track[0]], speed: 1.7, duration: 1.5,
          onWaypoint: (i) => { if (i % 3 === 1) a.bubbleIcon('icon-shoe'); if (Math.random() < 0.5) s.sweat.emitParticleAt(a.x + 4, a.y - 22); } };
      case 'walkDog':
        return s.dog && sp.dogWalk && { label: this.say('Walking the dog', 'walking the dog'), route: [{ x: s.dog.home.x + 20, y: s.dog.home.y + 12 }, ...sp.dogWalk, ...sp.dogPark], speed: 1.15, leash: true, duration: 3,
          onWaypoint: (i) => { if (i % 3 === 1) a.bubbleIcon('icon-paw'); } };
      case 'yoga':
        return sp.yoga && { label: this.say('Doing yoga in the park', 'doing yoga in the park'), target: sp.yoga, duration: 8, begin: () => { a.bubbleIcon('gift-heart'); this.bob(0.92, 1400); } };
      case 'fountainDrink':
        return sp.fountainDrink && { label: this.say('Drinking water at the fountain', 'drinking water at the fountain'), target: sp.fountainDrink, look: sp.fountain, duration: 3.5, begin: () => a.bubbleIcon('milk-grass', 'water') };
      case 'pondWalk':
        return sp.pondWalk && { label: this.say('Walking around the pond', 'walking around the pond'), route: sp.pondWalk, speed: 1.2, duration: 1, onWaypoint: (i) => { if (i === 1) a.bubbleIcon('icon-shoe'); } };
      case 'stretch':
        return sp.gym && { label: this.say('Stretching by the gym', 'stretching by the gym'), target: { x: sp.gym.x - 26, y: sp.gym.y }, duration: 5, begin: () => { a.bubbleIcon('icon-shoe'); this.bob(0.88, 700); } };

      // ---------- urgent and no data ----------
      case 'treat_low':
        return { label: this.say('Treating a low at home', 'treating a low at home'), target: { x: door.x - 14, y: door.y + 6 }, duration: Infinity, speed: 0.6,
          begin: () => a.bubbleIcon('icon-juice'),
          tick: () => { if (Math.random() < 0.004) { if (Math.random() < 0.5) a.bubbleIcon('icon-bang'); else a.bubbleIcon('icon-juice'); } } };
      case 'treat_high':
        return { label: this.say('Resting and drinking water at home', 'resting and drinking water at home'), target: { x: door.x + 14, y: door.y + 6 }, duration: Infinity, speed: 0.7,
          begin: () => a.bubbleIcon('milk-grass', 'water'),
          tick: () => { if (Math.random() < 0.004) { if (Math.random() < 0.5) a.bubbleIcon('icon-bang'); else a.bubbleIcon('milk-grass', 'water'); } } };
      case 'nap':
        return { label: this.say('Napping by the cottage', 'napping by the cottage'), target: { x: door.x - 18, y: door.y + 8 }, look: { x: door.x - 18, y: door.y + 30 }, duration: Infinity,
          begin: () => a.bubbleIcon('icon-z'), tick: () => { if (Math.random() < 0.02) s.zzz.emitParticleAt(a.x + 6, a.y - 22); } };
      default: return null;
    }
  }
}

export { hex, PAL };
