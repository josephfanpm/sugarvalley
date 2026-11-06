// Inside a building. One scene for all of them: the room and fixtures come from world/buildings.js.
// The owner's character can be driven by a script (walked in automatically, went idle inside, or the
// player asked: "Order a hot cocoa"). Any movement takes control back. Visitors who walk in on Sam
// see Sam's visit play out.
import { canvasTexture } from '../world/pixels.js';
import { PAL, hex } from '../data/palette.js';
import { BUILDINGS, registerFurniture } from '../world/buildings.js';
import { Actor, findPathGrid, ACTION_COOLDOWN } from '../world/autopilot.js';
import { folkInside } from '../world/town.js';
import { sfx, unlockAudio } from '../audio.js';

const T = 16;
const CELL = 8; // pathfinding grid indoors (finer than the valley's 16-px tiles)
const SPEED = 60;
const IDLE_BEFORE_AUTO = 7;
const CANCEL = Symbol('cancel');
const PURPOSE = { coffee: 'low', bakery: 'low', restaurant: 'low', gym: 'high' };

export class Interior extends Phaser.Scene {
  constructor() { super('Interior'); }

  init(data) { this.id = data.building || 'cottage'; this.autoEnter = !!data.auto; }

  create() {
    this.world = this.scene.get('World');
    this.view = this.world.view;
    this.cfg = BUILDINGS[this.id];
    this.RW = this.cfg.w; this.RH = this.cfg.h;
    this.colliders = []; this.interactables = []; this.seats = []; this.staff = {}; this.machines = {}; this.lights = [];
    this.actors = [];
    this.dead = false; this.leaving = false; this.idle = 0; this.playerRun = null;
    registerFurniture(this);
    this.buildRoom();
    this.cfg.build(this);
    this.buildGrid();
    for (const l of this.lights) this.add.image(l.x, l.y, 'light').setScale(0.6).setTint(hex(PAL.gold)).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(5001);
    this.buildPlayer();

    const cam = this.cameras.main;
    cam.setBackgroundColor('#1d1e2e');
    this.fit();
    this.scale.on('resize', this.fit, this);
    this.events.once('shutdown', () => { this.dead = true; this.scale.off('resize', this.fit, this); });
    cam.fadeIn(350, 20, 16, 30);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER');
    for (const k of ['E', 'SPACE', 'ENTER']) this.keys[k].on('down', () => this.interact());
    this.input.on('pointerdown', (p) => { unlockAudio(); if (p.event?.target?.tagName === 'CANVAS') { this.takeControl(); this.moveTarget = { x: p.worldX, y: p.worldY }; } });
    this.onHudInteract = () => this.interact();
    this.game.events.on('hud-interact', this.onHudInteract);
    this.events.once('shutdown', () => this.game.events.off('hud-interact', this.onHudInteract));
    if (this.id !== 'cottage') this.game.events.emit('toast', this.cfg.name);

    if (!this.world.owner && this.world.samInside === this.id) this.spawnSam();
    for (const f of folkInside(this.world, this.id)) this.spawnFolk(f);
    if (this.autoEnter && this.cfg.script) this.time.delayedCall(400, () => this.runPlayerScript({ auto: true }));
  }

  fit() {
    const { width, height } = this.scale;
    const z = Math.max(2, Math.floor(Math.min(width / (this.RW * T + 40), height / (this.RH * T + 110))));
    this.cameras.main.setZoom(z);
    this.cameras.main.centerOn((this.RW * T) / 2, (this.RH * T) / 2 - 16);
  }

  // ---------- room and fixtures (used by buildings.js) ----------
  buildRoom() {
    const walls = this.textures.get('house-walls').getSourceImage();
    const { RW, RH } = this;
    const door = Math.floor(RW / 2) - 1;
    canvasTexture(this, `room-${this.id}`, RW * T, RH * T, (c) => {
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
        const row = y === 0 ? 0 : y === RH - 1 ? 2 : 1, col = x === 0 ? 0 : x === RW - 1 ? 2 : 1;
        const i = row * 5 + col;
        c.drawImage(walls, (i % 5) * T, Math.floor(i / 5) * T, T, T, x * T, y * T, T, T);
      }
      c.fillStyle = PAL.woodDark; c.fillRect(door * T + 2, (RH - 1) * T, 2 * T - 4, T);
      c.fillStyle = '#e8cfa6'; c.fillRect(door * T + 4, (RH - 1) * T, 2 * T - 8, 6);
    });
    this.add.image(0, 0, `room-${this.id}`).setOrigin(0).setDepth(-10).setTint(this.cfg.tint);
    if (this.cfg.rug) this.add.image((RW * T) / 2, (RH * T) / 2 + 12, 'furniture', this.cfg.rug).setScale(2.4, 2).setDepth(-6).setAlpha(0.9);
    this.bounds = { top: 22, left: 6, right: RW * T - 6, bottom: (RH - 1) * T + 2 };
    this.door = { x: (door + 1) * T, y: (RH - 1) * T + 6 };
    this.interactables.push({ x: this.door.x, y: this.door.y - 6, r: 16, label: () => ({ text: 'Go outside' }), action: () => this.leave() });
    this.add.image((RW * T) / 2, (RH * T) / 2, 'light').setScale(RW / 5, RH / 5).setTint(hex(PAL.gold)).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(5000);
  }

  piece(frame, tx, ty, { wall = false } = {}) {
    const img = this.add.image(tx * T, ty * T, 'furniture', frame).setOrigin(0.5, 1).setDepth(wall ? -5 : ty * T);
    if (!wall) { const w = img.width; this.colliders.push({ x: tx * T - w / 2, y: ty * T - 6, w, h: 6 }); }
    return img;
  }

  wallItem(key, tx, ty, furniture = false) {
    return (furniture ? this.add.image(tx * T, ty * T, 'furniture', key) : this.add.image(tx * T, ty * T, key)).setOrigin(0.5, 1).setDepth(-5);
  }

  counterBar(key, tx, ty) {
    const img = this.add.image(tx * T, ty * T, key).setOrigin(0.5, 1).setDepth(ty * T);
    this.colliders.push({ x: tx * T - img.width / 2, y: ty * T - 12, w: img.width, h: 12 });
    return img;
  }

  table(tx, ty, key = 'table') {
    const img = key === 'table' ? this.add.image(tx * T, ty * T, 'furniture', 'table') : this.add.image(tx * T, ty * T, key);
    img.setOrigin(0.5, 1).setDepth(ty * T);
    this.add.image(tx * T, ty * T - 6, 'furniture', 'armchair').setOrigin(0.5, 1).setDepth(ty * T - 12).setScale(0.9);
    this.colliders.push({ x: tx * T - img.width / 2, y: ty * T - 8, w: img.width, h: 8 });
    this.seats.push({ x: tx * T, y: ty * T - 9, table: { x: tx * T, y: ty * T, depth: ty * T }, taken: null });
    return img;
  }

  staffAt(id, tx, ty, tint, lines, { behindWall = false } = {}) {
    const sp = this.add.sprite(tx * T, ty * T, 'player').setOrigin(0.5, 32 / 48).setTint(hex(tint));
    sp.play('idle-down');
    const act = new Actor(this, sp, behindWall ? null : this.add.image(0, 0, 'shadow').setDepth(-4).setScale(0.8, 0.9));
    act.home = { x: sp.x, y: sp.y };
    this.staff[id] = act;
    this.actors.push(act);
    let said = 0;
    this.interactables.push({
      x: 0, y: 0, r: 14, follow: sp,
      label: () => ({ text: `Chat with the ${id}` }),
      action: () => { this.bubble(act, 'icon-chat'); sfx.open(); this.game.events.emit('toast', `${lines[said++ % lines.length]}`); this.time.delayedCall(2500, () => this.clearBubble(act)); },
    });
    return act;
  }

  machine(id, key, tx, ty, opts) {
    const img = this.add.image(tx * T, ty * T, key).setOrigin(0.5, 1).setDepth(opts.flat ? -5 : ty * T);
    if (!opts.flat) this.colliders.push({ x: tx * T - img.width / 2, y: ty * T - 6, w: img.width, h: 6 });
    const m = { id, key, img, opts, x: opts.spot[0] * T, y: opts.spot[1] * T, busy: null };
    if (opts.bar) { m.barRest = { x: tx * T + opts.bar[0], y: ty * T + opts.bar[1] }; m.bar = this.add.image(m.barRest.x, m.barRest.y, 'barbell').setDepth(img.depth + 0.5); }
    this.machines[id] = m;
    if (this.world.owner) {
      this.interactables.push({ x: m.x, y: m.y + 10, r: 14, enabled: () => !m.busy, label: () => ({ text: opts.label }), action: () => this.playerDo((a, v) => v.useMachine(a, m, 8)) });
    }
    return m;
  }

  // ---------- script helpers (called through a per-run view, so one run can be cancelled alone) ----------
  check() { if (this.dead || this.run?.cancelled) throw CANCEL; }

  wait(sec) {
    const run = this.run;
    return new Promise((res, rej) => {
      const entry = { rej };
      entry.timer = this.time.delayedCall(sec * 1000, () => { run?.pending?.delete(entry); (this.dead || run?.cancelled) ? rej(CANCEL) : res(); });
      run?.pending?.add(entry);
    });
  }

  go(a, x, y, speed = 1) {
    this.check();
    const path = this.route(a.x, a.y, x, y);
    return new Promise((res, rej) => { a.path = path; a.speed = speed; a.onArrive = res; a.onCancel = rej; a.runRef = this.run; });
  }

  // ---------- pathfinding and collisions indoors ----------
  buildGrid() {
    this.cols = Math.ceil((this.RW * T) / CELL); this.rows = Math.ceil((this.RH * T) / CELL);
    this.grid = Array.from({ length: this.rows }, (_, cy) => Array.from({ length: this.cols }, (_, cx) => !this.blocked(cx * CELL + CELL / 2, cy * CELL + CELL / 2 + 2)));
  }

  cellNear(x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let r = 0; r < 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (this.grid[cy + dy]?.[cx + dx]) return { x: cx + dx, y: cy + dy };
    }
    return null;
  }

  /** Waypoints around furniture, ending exactly on the target (the last hop may step onto a seat or machine). */
  route(fx, fy, tx, ty) {
    const from = this.cellNear(fx, fy), to = this.cellNear(tx, ty);
    const cells = from && to ? findPathGrid(this.grid, from, to) : null;
    const pts = (cells || []).slice(1).map((c) => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 + 2 }));
    pts.push({ x: tx, y: ty, final: true });
    return pts;
  }

  blockedFor(who, x, y, { staticOk = false } = {}) {
    if (!staticOk && this.blocked(x, y)) return true;
    return this.bodyInTheWay(who, x, y);
  }

  bodyInTheWay(who, x, y) {
    const me = who?.sprite || who;
    for (const a of this.actors) {
      const o = a.sprite;
      if (o === me || !o.visible) continue;
      const inside = ((x - o.x) / 10) ** 2 + ((y - o.y) / 5.5) ** 2 < 1;
      if (inside && Math.hypot(x - o.x, y - o.y) < Math.hypot(me.x - o.x, me.y - o.y)) return true;
    }
    return false;
  }

  face(a, dir) { a.facing = dir; a.sprite.play(`idle-${dir}`, true); }
  faceStaff(staff, a) { staff.faceToward(a.x, a.y); staff.sprite.play(`idle-${staff.facing}`, true); }
  bubble(a, key, frame) { a.bubbleIcon(key, frame); }
  clearBubble(a) { a.clearBubble(); }

  place(key, x, y, depth = 50000, frame) {
    const img = this.add.image(x, y, key, frame).setOrigin(0.5, 1).setDepth(depth);
    this.run?.items.push(img);
    return img;
  }

  carry(a, key) {
    const img = this.add.image(a.x, a.y - 20, key).setDepth(60000);
    a.carrying = img;
    this.run?.items.push(img);
    return { destroy: () => { img.destroy(); a.carrying = null; } };
  }

  sit(a, seat) { a.sprite.setPosition(seat.x, seat.y); a.seat = seat; this.face(a, 'down'); }
  stand(a) { if (a.seat) { a.seat.taken = null; a.sprite.setPosition(a.seat.table.x - 16, a.seat.y); a.seat = null; } }

  bob(a, scaleY = 0.9, ms = 400) {
    this.unbob(a);
    a.tw = this.tweens.add({ targets: a.sprite, scaleY, scaleX: 1 + (1 - scaleY) * 0.6, duration: ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  unbob(a) { if (a.tw) { a.tw.remove(); a.tw = null; a.sprite.setScale(1); } }

  freeSeat(a) {
    const open = this.seats.filter((s) => !s.taken);
    const seat = open[Math.floor(Math.random() * open.length)] || this.seats[0];
    seat.taken = a;
    return seat;
  }

  shuffle(arr) { return arr.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v); }

  async useMachine(a, m, sec) {
    m.busy = a;
    let belt = null;
    try {
      const o = m.opts;
      await this.go(a, m.x, m.y); // step up next to the machine
      this.bubble(a, o.icon);
      this.startPose(a, m);
      if (o.belt) { let f = 0; belt = this.time.addEvent({ delay: 110, loop: true, callback: () => { f ^= 1; m.img.setTexture(`treadmill-${f}`); } }); }
      await this.wait(sec);
    } finally {
      belt?.remove(); if (m.opts.belt) m.img.setTexture('treadmill-0');
      this.endPose(a, m);
      this.clearBubble(a);
      m.busy = null;
    }
  }

  /** Put the character on the machine: running on the belt, on the bike seat, under the bar, on the bench. */
  startPose(a, m) {
    const sp = a.sprite, mx = m.img.x, my = m.img.y;
    const pose = { kind: m.opts.pose, depth: m.img.depth + 1, back: { x: m.x, y: m.y } };
    a.posed = pose; a.inPlace = true;
    a.shadow?.setVisible(false);
    switch (pose.kind) {
      case 'treadmill': // on the belt, facing the console, running in place
        sp.setPosition(mx + 3, my - 11); this.face(a, 'left'); sp.play('walk-left', true); sp.anims.timeScale = 1.9; break;
      case 'bike': // on the seat, pedaling toward the handlebars
        sp.setPosition(mx + 4, my - 3); this.face(a, 'left'); sp.play('walk-left', true); sp.anims.timeScale = 0.9; break;
      case 'squat': { // bar on the shoulders, down and up
        sp.setPosition(mx, my - 5); this.face(a, 'down');
        pose.shoulder = true;
        a.tw = this.tweens.add({ targets: sp, scaleY: 0.78, scaleX: 1.08, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      case 'bench': { // lying on the bench, pressing the bar over the chest
        sp.setOrigin(0.5, 0.5).setAngle(-90);
        sp.setPosition(mx - 2, my - 11); a.facing = 'down'; sp.play('idle-down', true);
        m.bar.setPosition(mx - 1, my - 15).setDepth(pose.depth + 1);
        pose.press = this.tweens.add({ targets: m.bar, y: my - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      default: break;
    }
  }

  endPose(a, m) {
    const pose = a.posed;
    if (!pose) return;
    pose.press?.remove();
    this.unbob(a);
    const sp = a.sprite;
    sp.setOrigin(0.5, 32 / 48).setAngle(0).setScale(1);
    sp.anims.timeScale = 1;
    if (m.bar) m.bar.setPosition(m.barRest.x, m.barRest.y).setDepth(m.img.depth + 0.5);
    sp.setPosition(pose.back.x, pose.back.y); // step off
    a.shadow?.setVisible(true);
    a.posed = null; a.inPlace = false;
    this.face(a, 'down');
  }

  // ---------- running scripts ----------
  runView(run) { const v = Object.create(this); v.run = run; return v; }

  keepGoingFor(start) {
    const purpose = PURPOSE[this.id];
    const st = () => this.world.view.state;
    return () => {
      if (this.dead) return false;
      if (st() === 'urgent_low' || st() === 'urgent_high') return false;
      if (purpose && st() === purpose) return true; // stay until back in range
      return this.time.now - start < 14000; // otherwise a short visit
    };
  }

  runPlayerScript({ auto = false } = {}) {
    if (!this.cfg.script || this.playerRun) return;
    this.playerDo((a, v) => this.cfg.script(v, a, { keepGoing: this.keepGoingFor(this.time.now) }), { leaveAfter: auto });
  }

  playerVisit() { this.runPlayerScript({ auto: false }); }

  async playerDo(fn, { leaveAfter = false } = {}) {
    if (this.playerRun) return;
    const run = { cancelled: false, items: [], pending: new Set() };
    this.playerRun = run;
    const a = this.playerActor;
    try { await fn(a, this.runView(run)); } catch (e) { if (e !== CANCEL) console.error(e); }
    this.cleanupRun(a, run);
    if (this.playerRun === run) this.playerRun = null;
    if (leaveAfter && !run.cancelled && !this.dead) this.leave(true);
  }

  cleanupRun(a, run) {
    for (const i of run.items) i.destroy();
    run.items = [];
    for (const m of Object.values(this.machines)) if (m.busy === a) { this.endPose(a, m); m.busy = null; }
    this.stand(a); this.unbob(a); this.clearBubble(a); a.inPlace = false; a.sprite.anims.timeScale = 1;
    a.carrying?.destroy(); a.carrying = null;
    for (const s of Object.values(this.staff)) if (s.runRef === run) { s.path = this.route(s.x, s.y, s.home.x, s.home.y); s.onArrive = null; s.onCancel = null; s.runRef = null; this.clearBubble(s); }
  }

  takeControl() {
    this.idle = 0;
    const run = this.playerRun;
    if (!run) return;
    run.cancelled = true;
    for (const e of run.pending || []) { e.timer.remove(); e.rej(CANCEL); }
    run.pending?.clear();
    for (const act of this.actors) if (act.runRef === run && act.onCancel) { const c = act.onCancel; act.path = null; act.onArrive = null; act.onCancel = null; c(CANCEL); }
    this.world.piloting = false;
  }

  // Townsfolk visiting this building while you're here
  spawnFolk(f) {
    const sp = this.add.sprite(this.door.x + (Math.random() * 30 - 15), this.door.y - 14, 'player').setOrigin(0.5, 32 / 48).setTint(hex(f.tint));
    const act = new Actor(this, sp, this.add.image(0, 0, 'shadow').setDepth(-4).setScale(0.8, 0.9));
    this.actors.push(act);
    let said = 0;
    this.interactables.push({ x: 0, y: 0, r: 14, follow: sp, label: () => ({ text: `Chat with ${f.name}` }),
      action: () => { this.bubble(act, 'icon-chat'); sfx.open(); this.game.events.emit('toast', `${f.name}: ${f.lines[said++ % f.lines.length]}`); this.time.delayedCall(2500, () => this.clearBubble(act)); } });
    const run = { cancelled: false, items: [], pending: new Set() };
    const script = this.cfg.npcScript || this.cfg.script;
    (async () => {
      try { await script(this.runView(run), act, { keepGoing: () => !this.dead && Date.now() < f.until - 4000 }); } catch (e) { if (e !== CANCEL) console.error(e); }
      if (this.dead) return;
      this.cleanupRun(act, run);
      try { await this.runView(run).go(act, this.door.x, this.door.y + 4); } catch { /* closed */ }
      if (!this.dead) { sp.setVisible(false); act.shadow?.setVisible(false); }
    })();
  }

  // Visitors walking in on Sam
  spawnSam() {
    const sp = this.add.sprite(this.door.x, this.door.y - 12, 'player').setOrigin(0.5, 32 / 48);
    const act = new Actor(this, sp, this.add.image(0, 0, 'shadow').setDepth(-4).setScale(0.8, 0.9));
    this.samTag = this.add.text(0, 0, this.view.name, { fontFamily: '"Pixelify Sans"', fontSize: '8px', color: '#f3e5c2', stroke: '#645552', strokeThickness: 2, resolution: 4 }).setOrigin(0.5, 1).setDepth(100004);
    this.sam = act;
    this.actors.push(act);
    const run = { cancelled: false, items: [], pending: new Set() };
    (async () => {
      try { await this.cfg.script(this.runView(run), act, { keepGoing: this.keepGoingFor(this.time.now) }); } catch (e) { if (e !== CANCEL) console.error(e); }
      if (this.dead) return;
      this.cleanupRun(act, run);
      try { await this.runView(run).go(act, this.door.x, this.door.y); } catch { /* scene closed */ }
      if (!this.dead) { sp.setVisible(false); act.shadow?.setVisible(false); this.samTag.setVisible(false); }
    })();
  }

  // ---------- player ----------
  buildPlayer() {
    this.player = this.add.sprite(this.door.x, this.door.y - 10, 'player').setOrigin(0.5, 32 / 48);
    if (!this.world.owner) this.player.setTint(hex(PAL.blueLight));
    this.playerActor = new Actor(this, this.player, this.add.image(0, 0, 'shadow').setDepth(-3).setScale(0.8, 0.9));
    this.playerActor.facing = 'up';
    this.player.play('idle-up');
    this.actors.push(this.playerActor);
  }

  blocked(x, y) {
    const b = this.bounds;
    if (x < b.left + 4 || x > b.right - 4 || y < b.top + 4) return true;
    if (y > b.bottom && Math.abs(x - this.door.x) > 12) return true;
    return this.colliders.some((c) => x + 5 > c.x && x - 5 < c.x + c.w && y + 1 > c.y && y - 3 < c.y + c.h);
  }

  update(time, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    for (const a of this.actors) {
      if (a.path?.length) {
        a.walk(dt, a.speed || 1);
        if (!a.path.length) { const f = a.onArrive; a.onArrive = null; a.onCancel = null; a.sprite.play(`idle-${a.facing}`, true); f?.(); }
      } else if (!a.inPlace && a !== this.playerActor) a.sprite.play(`idle-${a.facing}`, true);
      a.sync();
      if (a.seat) a.sprite.setDepth(a.seat.table.depth - 1);
      if (a.posed) {
        a.sprite.setDepth(a.posed.depth);
        if (a.posed.shoulder) { const m = Object.values(this.machines).find((x) => x.busy === a); if (m?.bar) m.bar.setPosition(a.x, a.y - 14 * a.sprite.scaleY).setDepth(a.posed.depth + 1); }
        if (a.bubble) a.bubble.setPosition(Math.round(a.x), Math.round(a.y) - (a.posed.kind === 'bench' ? 18 : 30));
      }
      if (a.carrying) a.carrying.setPosition(a.x, a.y - 22);
    }
    if (this.sam && this.samTag) this.samTag.setPosition(Math.round(this.sam.x), Math.round(this.sam.y) - 22);

    const p = this.player, pa = this.playerActor;
    if (!this.leaving && !this.world.inputLocked) {
      const k = this.keys;
      let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      if (vx || vy) { this.takeControl(); this.moveTarget = null; }
      else if (this.moveTarget && !this.playerRun) { const dx = this.moveTarget.x - p.x, dy = this.moveTarget.y - p.y; if (Math.hypot(dx, dy) < 3) this.moveTarget = null; else { vx = dx; vy = dy; } }
      const len = Math.hypot(vx, vy);
      if (len && !this.playerRun) {
        vx /= len; vy /= len;
        const nx = p.x + vx * SPEED * dt, ny = p.y + vy * SPEED * dt;
        let moved = false;
        const stuckIn = this.blocked(p.x, p.y); // started inside something: let them walk out
        if ((stuckIn || !this.blocked(nx, p.y)) && !this.bodyInTheWay(p, nx, p.y)) { p.x = nx; moved = true; }
        if ((stuckIn || !this.blocked(p.x, ny)) && !this.bodyInTheWay(p, p.x, ny)) { p.y = ny; moved = true; }
        if (!moved) this.moveTarget = null;
        pa.facing = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
        p.play(`walk-${pa.facing}`, true);
        if ((this.step = (this.step || 0) - dt) <= 0) { this.step = 0.3; sfx.step(Math.random() < 0.5); }
        if (p.y > this.bounds.bottom + 6) this.leave();
      } else if (!this.playerRun && !pa.path?.length) {
        p.play(`idle-${pa.facing}`, true);
        // Idle inside: the character does what people do here
        const fits = PURPOSE[this.id] && PURPOSE[this.id] === this.world.view.state;
        if (this.world.owner && this.cfg.script && (this.idle += dt) > (fits ? IDLE_BEFORE_AUTO : ACTION_COOLDOWN)) { this.idle = 0; this.runPlayerScript({ auto: true }); }
      }
    }

    if (this.playerRun) {
      const m = Object.values(this.machines).find((x) => x.busy === pa);
      const text = m ? 'Get off' : pa.seat ? 'Stand up' : 'Stop';
      if (this.lastRunPrompt !== text) { this.lastRunPrompt = text; this.lastNear = undefined; this.game.events.emit('prompt', { text, action: true }); }
      return;
    }
    this.lastRunPrompt = null;
    const it = this.nearest();
    if (it !== this.lastNear || (it && (this.tick = (this.tick || 0) + dt) > 0.5)) {
      this.tick = 0; this.lastNear = it;
      this.game.events.emit('prompt', it ? { ...it.label(), action: !!it.action } : null);
    }
  }

  nearest() {
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const ix = it.follow ? it.follow.x : it.x, iy = it.follow ? it.follow.y : it.y;
      const d = Math.hypot(ix - this.player.x, iy - this.player.y);
      // Tight zones for things; people and animals keep you at arm's length, so a bit past their body.
      const reach = it.follow ? it.r + 4 : Math.max(10, it.r * 0.6);
      if (d < reach && d < bd) { best = it; bd = d; }
    }
    return best;
  }

  interact() {
    if (this.world.inputLocked || this.leaving) return;
    if (this.playerRun) { this.takeControl(); sfx.blip(); return; } // E: get off the machine / stand up
    this.idle = 0;
    this.nearest()?.action?.();
  }

  rest() {
    if (this.resting) return;
    this.resting = true;
    sfx.open();
    this.cameras.main.fadeOut(500, 20, 16, 30);
    this.time.delayedCall(900, () => {
      this.cameras.main.fadeIn(600, 20, 16, 30);
      this.resting = false;
      this.game.events.emit('toast', 'A little rest. The valley is still growing while you\'re away.');
    });
  }

  async leave(walkOut = false) {
    if (this.leaving) return;
    this.leaving = true;
    if (walkOut) { try { await this.runView({ cancelled: false, items: [] }).go(this.playerActor, this.door.x, this.door.y + 4); } catch { /* closing */ } }
    sfx.open();
    this.game.events.emit('prompt', null);
    this.cameras.main.fadeOut(250, 20, 16, 30);
    this.time.delayedCall(260, () => {
      this.scene.stop();
      this.scene.wake('World');
      this.world.exitedBuilding(this.id, { auto: walkOut });
    });
  }
}
