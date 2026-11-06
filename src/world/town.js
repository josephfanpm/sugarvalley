// The town south of the hamlet: coffee shop, bakery, restaurant, gym, market stalls, fountain plaza,
// running track and dog park, plus townsfolk and the owner's dog. Exposes named spots the autopilot
// walks to (design/gdd/town.md).
import { TILE } from './terrain.js';
import { PAL, hex } from '../data/palette.js';
import { buildCottage } from './house.js';
import { canvasTexture, px } from './pixels.js';
import { Actor } from './autopilot.js';
import { sfx } from '../audio.js';

const T = (n) => n * TILE;

const SHOPS = [
  { id: 'coffee', name: 'The Sunny Cup', x: 7, bottom: 33.3, W: 4, awning: [PAL.peachDark, '#fbf4df'], icon: 'icon-coffee' },
  { id: 'bakery', name: 'Rise & Shine Bakery', x: 11.6, bottom: 33.3, W: 4, awning: [PAL.goldDark, '#fbf4df'], icon: 'icon-croissant' },
  { id: 'restaurant', name: 'Valley Kitchen', x: 22, bottom: 33.3, W: 5, awning: [PAL.roseDark, '#fbf4df'], icon: 'icon-forkknife' },
  { id: 'gym', name: 'Steady Strength Gym', x: 24, bottom: 49.6, W: 5, awning: [PAL.blueDark, '#fbf4df'], icon: 'icon-dumbbell' },
];

const FOLK = [
  { id: 'barista', name: 'Pip the barista', tint: PAL.peachLight, at: [6.2, 34.9], lines: ['"Cocoa or coffee? Either way, take a seat!"', '"Mornings are better with a warm mug."', '"The window seat gets the best sunlight."'] },
  { id: 'baker', name: 'Juniper the baker', tint: PAL.yellowLight, at: [12.6, 34.9], lines: ['"Fresh bread just came out!"', '"I count carbs like I count loaves: carefully."', '"Croissants are folded 27 times. Patience!"'] },
  { id: 'chef', name: 'Basil the chef', tint: '#fbf4df', at: [23.4, 34.9], lines: ['"Tonight\'s special: whatever the valley grew!"', '"A good meal is a good friend."', '"Table for one? Right this way."'] },
  { id: 'coach', name: 'Coach Rowan', tint: PAL.leafLight, at: [26.4, 50.8], lines: ['"Every lap counts!"', '"Stretch first, thank me later."', '"Water break! Hydration is a team sport."'] },
  { id: 'florist', name: 'Fern the florist', tint: PAL.violetLight, at: [20.6, 45.4], lines: ['"Sunflowers today. They match the weather."', '"Flowers make any day a good day."'] },
  { id: 'vendor', name: 'Mo at the juice stand', tint: PAL.roseLight, at: [6, 45.4], lines: ['"Juice for when you need a lift!"', '"Apple, orange, or grape?"'] },
];

/** Awning strip for a shop wall, W tiles wide. */
function awningTexture(scene, key, W, [a, b]) {
  const w = W * TILE + 4;
  canvasTexture(scene, key, w, 10, (c) => {
    px(c, PAL.woodDark, 0, 0, w, 1);
    for (let x = 0; x < w; x++) {
      const col = Math.floor(x / 4) % 2 ? b : a;
      px(c, col, x, 1, 1, 6);
      const scal = x % 4 === 0 || x % 4 === 3 ? 7 : 8;
      px(c, col, x, 7, 1, scal - 7);
      px(c, PAL.woodDark, x, scal, 1, 1);
    }
    px(c, 'rgba(255,255,255,0.35)', 0, 1, w, 1);
  });
}

export function buildTown(s) {
  const spots = {};
  // ---------- shops ----------
  for (const shop of SHOPS) {
    const c = buildCottage(s, `shop-${shop.id}`, shop.W);
    const x = T(shop.x), bottom = T(shop.bottom), left = x - c.w / 2, top = bottom - c.h;
    s.add.image(x, bottom, `shop-${shop.id}`).setOrigin(0.5, 1).setDepth(bottom);
    s.add.image(x, bottom - 1, 'shadow').setDepth(-4).setScale(c.w / 14, 1.5);
    awningTexture(s, `awning-${shop.id}`, shop.W, shop.awning);
    s.add.image(x, top + c.wallY + 1, `awning-${shop.id}`).setOrigin(0.5, 0).setDepth(bottom + 1);
    s.add.image(x, top + c.wallY - 3, 'sign-board').setOrigin(0.5, 1).setDepth(bottom + 2);
    s.add.image(x, top + c.wallY - 9, shop.icon).setOrigin(0.5).setDepth(bottom + 3);
    s.colliders.push({ x: left + 2, y: top + c.wallY - 6, w: c.w - 4, h: c.h - c.wallY + 4 });
    s.colliders.push({ x: left + 2, y: top + 8, w: c.w - 4, h: c.wallY - 14 });
    for (const win of c.windows) {
      const wx = left + win.x, wy = top + win.y;
      s.lights.push({ x: wx, y: wy + 6, r: 28, warm: true, on: () => true });
      s.windowGlows.push(s.add.image(wx, wy, 'window-lit').setDepth(100001).setAlpha(0));
    }
    spots[shop.id] = { x, y: bottom + 10, name: shop.name };
    s.interactables.push({ x, y: bottom + 8, r: 14, label: () => ({ text: shop.name }) });
  }

  // ---------- plaza ----------
  const fx = T(15.5), fy = T(39.4);
  const fountain = s.add.sprite(fx, fy, 'fountain-0').setOrigin(0.5, 1).setDepth(fy);
  s.add.image(fx, fy - 1, 'shadow').setDepth(-4).setScale(2.2, 1.6);
  s.time.addEvent({ delay: 300, loop: true, callback: () => fountain.setTexture(fountain.texture.key === 'fountain-0' ? 'fountain-1' : 'fountain-0') });
  s.colliders.push({ x: fx - 14, y: fy - 11, w: 28, h: 10 });
  spots.fountain = { x: fx, y: fy + 10 };
  spots.fountainDrink = { x: fx - 18, y: fy - 2 };
  s.interactables.push({ x: fx, y: fy + 8, r: 16, label: () => ({ text: 'Make a wish at the fountain' }), action: () => { sfx.collect(); s.sparkles.explode(10, fx, fy - 14); s.toast('You toss a pebble in. The wish is between you and the fountain.'); } });

  const prop = (key, tx, ty, collide = [0, 0]) => {
    const img = s.add.image(T(tx), T(ty), key).setOrigin(0.5, 1).setDepth(T(ty));
    if (collide[0]) s.colliders.push({ x: T(tx) - collide[0] / 2, y: T(ty) - collide[1] - 1, w: collide[0], h: collide[1] });
    return img;
  };
  prop('bench', 10.6, 40.6, [20, 4]); prop('bench', 20.4, 40.6, [20, 4]);
  spots.benchW = { x: T(10.6), y: T(40.6) + 6 }; spots.benchE = { x: T(20.4), y: T(40.6) + 6 };
  for (const [tx, ty] of [[4.5, 36.4], [9.2, 36.6], [19.4, 36.4], [24.8, 36.6]]) prop('umbrella', tx, ty, [16, 4]);
  spots.coffeeSeat = { x: T(4.5) + 14, y: T(36.4) - 4 };
  spots.restaurantSeat = { x: T(24.8) - 14, y: T(36.6) - 4 };
  prop('stall-juice', 6, 44.4, [24, 6]); prop('stall-icecream', 9.9, 44.4, [24, 6]); prop('stall-flowers', 20.6, 44, [24, 6]);
  spots.juice = { x: T(6) + 12, y: T(44.4) + 12 }; spots.icecream = { x: T(9.9) + 12, y: T(44.4) + 12 }; spots.flowers = { x: T(20.6) - 12, y: T(44) + 12 };
  for (const [tx, ty] of [[7.2, 37.6], [13, 42.3], [18, 42.3], [23.6, 37.6]]) {
    prop('lantern-on', tx, ty, [6, 3]);
    s.lights.push({ x: T(tx), y: T(ty) - 15, r: 38, warm: true, on: () => true });
  }

  // ---------- gym, track, dog park ----------
  prop('weight-bench', 19.6, 49.8, [20, 5]);
  spots.gym = { x: T(19.6), y: T(49.8) + 8 };
  spots.yoga = { x: T(11), y: T(51.6) };
  spots.track = [[11, 47.9], [16, 48.6], [17.9, 51.5], [16, 54.4], [11, 55.1], [6, 54.4], [4.1, 51.5], [6, 48.6]].map(([x, y]) => ({ x: T(x), y: T(y) }));
  for (const [tx, ty] of [[4.6, 49.2], [17.4, 49.2], [4.6, 54.2], [17.4, 54.2]]) prop('track-cone', tx, ty);
  // dog park fence with a gate at the top
  const set = new Set(), x0 = 20, y0 = 51, x1 = 28, y1 = 56, gate = [23, 24];
  for (let x = x0; x <= x1; x++) { if (!gate.includes(x)) set.add(`${x},${y0}`); set.add(`${x},${y1}`); }
  for (let y = y0; y <= y1; y++) { set.add(`${x0},${y}`); set.add(`${x1},${y}`); }
  for (const k of set) {
    const [x, y] = k.split(',').map(Number);
    const n = set.has(`${x},${y - 1}`), so = set.has(`${x},${y + 1}`), e = set.has(`${x + 1},${y}`), w = set.has(`${x - 1},${y}`);
    const row = so && n ? 1 : so ? 0 : n ? 2 : 3, col = e && w ? 2 : e ? 1 : w ? 3 : 0;
    const by = T(y) + 16;
    s.add.image(T(x) + 8, by, 'fences', row * 4 + col).setOrigin(0.5, 1).setDepth(by - 2);
    s.colliders.push({ x: T(x) + (w ? 0 : 5), y: by - 6, w: e && w ? 16 : 7 + (e ? 4 : 0) + (w ? 4 : 0), h: 4 });
  }
  spots.dogPark = [[24, 52.6], [26.6, 53.4], [26, 55.2], [22, 55.2], [21.4, 53.4], [24, 52.6]].map(([x, y]) => ({ x: T(x), y: T(y) }));
  spots.dogWalk = [[16.5, 14.6], [15.6, 22], [15.6, 30], [15.5, 41.5], [24, 50.6], [24, 53.6], [15.5, 45.5], [15.6, 30], [15.6, 20]].map(([x, y]) => ({ x: T(x), y: T(y) }));
  spots.pondWalk = [[18.6, 19.6], [24.6, 20.2], [25.6, 23.6], [21.6, 25.4], [17.8, 24.2], [18.6, 19.6]].map(([x, y]) => ({ x: T(x), y: T(y) }));

  // ---------- townsfolk ----------
  s.folk = FOLK.map((f) => {
    const sp = s.add.sprite(T(f.at[0]), T(f.at[1]), 'player').setOrigin(0.5, 32 / 48).setTint(hex(f.tint));
    const sh = s.add.image(0, 0, 'shadow').setDepth(-4).setScale(0.8, 0.9);
    sp.play('idle-down');
    const actor = new Actor(s, sp, sh);
    actor.sync();
    const npc = { ...f, sprite: sp, actor, home: { x: sp.x, y: sp.y }, wait: 2 + Math.random() * 4, said: 0 };
    s.interactables.push({
      x: 0, y: 0, r: 14, follow: { s: sp },
      label: () => ({ text: `Chat with ${f.name}` }),
      action: () => {
        actor.faceToward(s.player.x, s.player.y); sp.play(`idle-${actor.facing}`);
        actor.bubbleIcon('icon-chat'); sfx.open();
        s.toast(`${f.name.split(' ')[0]}: ${f.lines[npc.said++ % f.lines.length]}`);
        s.time.delayedCall(2500, () => actor.clearBubble());
      },
    });
    return npc;
  });
  // A jogger who always runs the track
  const jog = s.add.sprite(spots.track[0].x, spots.track[0].y, 'player').setOrigin(0.5, 32 / 48).setTint(hex(PAL.blue));
  const jogActor = new Actor(s, jog, s.add.image(0, 0, 'shadow').setDepth(-4).setScale(0.8, 0.9));
  s.jogger = { actor: jogActor, i: 0 };

  s.town = { spots };
  return spots;
}

export function updateTown(s, dt) {
  for (const f of s.folk) {
    const a = f.actor;
    if (a.path?.length) a.walk(dt, 0.5);
    else {
      a.sprite.play(`idle-${a.facing}`, true);
      if ((f.wait -= dt) <= 0) {
        f.wait = 5 + Math.random() * 7;
        a.goTo(f.home.x + (Math.random() * 28 - 14), f.home.y + (Math.random() * 10 - 2));
      }
    }
    a.sync();
  }
  const j = s.jogger, track = s.town.spots.track;
  if (!j.actor.path?.length) { j.i = (j.i + 1) % track.length; j.actor.path = [{ ...track[j.i] }]; }
  j.actor.walk(dt, 1.4);
  j.actor.sync();
}

// ---------- the owner's dog ----------
export class Dog {
  constructor(s, home) {
    this.s = s;
    this.home = home;
    this.sprite = s.add.image(home.x + 12, home.y + 8, 'dog-sit').setOrigin(0.5, 1);
    this.shadow = s.add.image(0, 0, 'shadow').setDepth(-4).setScale(0.8, 0.7);
    this.frame = 0; this.t = 0; this.mode = 'follow'; this.target = null; this.wait = 0;
    this.leash = s.add.graphics().setDepth(99000);
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  update(dt, owner, { leash = false, napping = false } = {}) {
    let tx = null, ty = null;
    if (this.mode === 'fetch' && this.target) { tx = this.target.x; ty = this.target.y; }
    else if (napping) { tx = this.home.x + 14; ty = this.home.y + 10; }
    else if (owner) {
      const d = Math.hypot(owner.x - this.x, owner.y - this.y);
      if (d > (leash ? 18 : 30)) { tx = owner.x - 14; ty = owner.y + 2; }
    }
    let moving = false;
    if (tx !== null) {
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
      if (d > 2) {
        const sp = (this.mode === 'fetch' ? 110 : 64) * Math.min(1.6, 0.7 + d / 60) * dt;
        this.sprite.x += (dx / d) * Math.min(sp, d); this.sprite.y += (dy / d) * Math.min(sp, d);
        this.sprite.setFlipX(dx < 0);
        moving = true;
      } else if (this.mode === 'fetch') { this.mode = 'return'; this.target = null; this.onFetched?.(); }
    }
    if (this.mode === 'return' && owner && Math.hypot(owner.x - this.x, owner.y - this.y) < 20) this.mode = 'follow';
    if (moving) {
      if ((this.t += dt) > 0.12) { this.t = 0; this.frame ^= 1; this.sprite.setTexture(`dog-${this.frame}`); }
    } else this.sprite.setTexture(napping ? 'dog-sit' : this.sprite.texture.key === 'dog-sit' ? 'dog-sit' : 'dog-0');
    if (!moving && (this.wait += dt) > 1.5) this.sprite.setTexture('dog-sit');
    if (moving) this.wait = 0;
    this.sprite.setDepth(this.y);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    // leash during walks
    this.leash.clear();
    if (leash && owner) {
      this.leash.lineStyle(1, hex(PAL.roseDark), 1);
      this.leash.lineBetween(owner.x + (this.x < owner.x ? -4 : 4), owner.y - 8, this.x + (this.sprite.flipX ? -4 : 4), this.y - 7);
    }
  }

  fetch(spot, onFetched) { this.mode = 'fetch'; this.target = spot; this.onFetched = onFetched; }
}
