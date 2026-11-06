// Inside the cottage: a cozy room that fills up with what you've earned. Ribbons from Maple's weekly
// goals hang on the wall; every recipe you've cooked sits on the table. Owners and visitors can come in.
import { canvasTexture } from '../world/pixels.js';
import { PAL, hex } from '../data/palette.js';
import { RECIPES } from '../data/valley-rules.js';
import { sfx, unlockAudio } from '../audio.js';

const T = 16, RW = 12, RH = 8; // room in tiles (walls included)
const SPEED = 60;
const FURN = {
  bed: [1, 26, 14, 22], dresser: [49, 32, 14, 16], table: [49, 49, 14, 14], smallTable: [67, 51, 10, 9],
  chairR: [67, 33, 10, 13], chairL: [83, 33, 10, 13], armchair: [99, 33, 10, 13], clock: [81, 48, 13, 15],
  lampG: [51, 16, 10, 11], plantBig: [51, 0, 11, 15], plantSmall: [84, 1, 7, 12],
  pic1: [1, 6, 15, 7], pic2: [19, 6, 11, 7], pic3: [35, 5, 12, 8], rug: [52, 82, 24, 13],
};

export class Interior extends Phaser.Scene {
  constructor() { super('Interior'); }

  create() {
    this.world = this.scene.get('World');
    this.view = this.world.view;
    const fur = this.textures.get('furniture');
    for (const [k, [x, y, w, h]] of Object.entries(FURN)) if (!fur.has(k)) fur.add(k, 0, x, y, w, h);
    this.colliders = [];
    this.interactables = [];
    this.buildRoom();
    this.buildFurniture();
    this.buildTrophies();
    this.buildPlayer();

    const cam = this.cameras.main;
    cam.setBackgroundColor('#1d1e2e');
    this.fit();
    this.scale.on('resize', this.fit, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fit, this));
    cam.fadeIn(350, 20, 16, 30);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER');
    for (const k of ['E', 'SPACE', 'ENTER']) this.keys[k].on('down', () => this.interact());
    this.input.on('pointerdown', (p) => { unlockAudio(); if (p.event?.target?.tagName === 'CANVAS') this.moveTarget = { x: p.worldX, y: p.worldY }; });
    this.onHudInteract = () => this.interact();
    this.game.events.on('hud-interact', this.onHudInteract);
    this.events.once('shutdown', () => this.game.events.off('hud-interact', this.onHudInteract));
  }

  fit() {
    const { width, height } = this.scale;
    const z = Math.max(2, Math.floor(Math.min(width / (RW * T + 40), height / (RH * T + 110))));
    const cam = this.cameras.main;
    cam.setZoom(z);
    cam.centerOn((RW * T) / 2, (RH * T) / 2 - 16); // sit below the top HUD
  }

  buildRoom() {
    const walls = this.textures.get('house-walls').getSourceImage();
    canvasTexture(this, 'room', RW * T, RH * T, (c) => {
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
        const row = y === 0 ? 0 : y === RH - 1 ? 2 : 1, col = x === 0 ? 0 : x === RW - 1 ? 2 : 1;
        const i = row * 5 + col;
        c.drawImage(walls, (i % 5) * T, Math.floor(i / 5) * T, T, T, x * T, y * T, T, T);
      }
      // doorway in the bottom wall
      c.fillStyle = PAL.woodDark; c.fillRect(5 * T + 2, (RH - 1) * T, 2 * T - 4, T);
      c.fillStyle = '#e8cfa6'; c.fillRect(5 * T + 4, (RH - 1) * T, 2 * T - 8, 6);
    });
    this.add.image(0, 0, 'room').setOrigin(0).setDepth(-10);
    // Walls block; the doorway is the exit
    const top = 22, left = 6, right = RW * T - 6, bottom = (RH - 1) * T + 2;
    this.bounds = { top, left, right, bottom };
    this.door = { x: 6 * T, y: (RH - 1) * T + 6 };
    this.interactables.push({ x: this.door.x, y: this.door.y - 6, r: 16, label: () => ({ text: 'Go outside' }), action: () => this.leave() });
    // warm light pool
    this.add.image(RW * T / 2, RH * T / 2, 'light').setScale(2.4, 1.6).setTint(hex(PAL.gold)).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(5000);
  }

  piece(frame, x, y, { collide = true, wall = false } = {}) {
    const img = this.add.image(x, y, 'furniture', frame).setOrigin(0.5, 1).setDepth(wall ? -5 : y);
    if (collide) { const [, , w] = FURN[frame]; this.colliders.push({ x: x - w / 2, y: y - 6, w, h: 6 }); }
    return img;
  }

  buildFurniture() {
    this.add.image(6 * T, 5.2 * T, 'furniture', 'rug').setScale(2, 2).setDepth(-6);
    this.piece('bed', 1.6 * T, 3.4 * T);
    this.piece('dresser', 3.2 * T, 2.4 * T);
    this.piece('lampG', 4.3 * T, 2.3 * T);
    this.piece('plantBig', 10.4 * T, 2.4 * T);
    this.piece('plantSmall', 1.2 * T, 6.6 * T);
    this.piece('armchair', 10.2 * T, 6.4 * T);
    this.piece('clock', 8.8 * T, 1.45 * T, { collide: false, wall: true });
    this.piece('pic1', 5.4 * T, 1.2 * T, { collide: false, wall: true });
    this.piece('pic3', 6.7 * T, 1.25 * T, { collide: false, wall: true });
    // dining table (two tables pushed together) with chairs
    this.tableAt = { x: 7.5 * T, y: 4.6 * T };
    this.piece('table', 7 * T, 4.6 * T);
    this.piece('table', 7.875 * T, 4.6 * T);
    this.piece('chairR', 5.9 * T, 4.7 * T);
    this.piece('chairL', 9 * T, 4.7 * T);
    // bed and dresser interactions
    this.interactables.push({ x: 1.6 * T, y: 3.6 * T, r: 16, label: () => ({ text: this.world.owner ? 'Rest a moment' : `${this.view.name}'s bed` }), action: this.world.owner ? () => this.rest() : null });
    if (this.world.owner) this.interactables.push({ x: 3.2 * T, y: 2.7 * T, r: 14, label: () => ({ text: 'Open the Garden Journal' }), action: () => this.game.events.emit('open-journal') });
  }

  buildTrophies() {
    // Ribbons on the back wall
    const ribbons = Math.min(10, this.view.valley.ribbons || 0);
    for (let i = 0; i < ribbons; i++) this.add.image((1.4 + i * 0.5) * T + (i > 4 ? 0.5 * T : 0), 0.95 * T + (i % 2) * 3, 'ribbon').setDepth(-4);
    // Every recipe cooked sits on the table
    const book = this.view.farm?.cookbook || {};
    const cooked = RECIPES.filter((r) => book[r.id]);
    cooked.forEach((r, i) => {
      const x = this.tableAt.x - 9 + (i % 4) * 7, y = this.tableAt.y - 8 - Math.floor(i / 4) * 5;
      this.add.image(x, y, `dish-${r.id}`).setOrigin(0.5, 1).setDepth(this.tableAt.y + 1 + i);
    });
    this.interactables.push({
      x: this.tableAt.x, y: this.tableAt.y + 4, r: 18,
      label: () => ({ text: cooked.length ? `Cookbook · ${cooked.length} of ${RECIPES.length} recipes: ${cooked.map((r) => r.name.toLowerCase()).join(', ')}` : 'Dishes you cook will show up here' }),
    });
    if (ribbons) this.interactables.push({ x: 2.6 * T, y: 1.9 * T, r: 18, label: () => ({ text: `${ribbons} ribbon${ribbons > 1 ? 's' : ''} from Maple's weekly goals` }) });
  }

  buildPlayer() {
    this.player = this.add.sprite(this.door.x, this.door.y - 10, 'player').setOrigin(0.5, 32 / 48);
    if (!this.world.owner) this.player.setTint(hex(PAL.blueLight));
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(-3).setScale(0.8, 0.9);
    this.facing = 'up';
    this.player.play('idle-up');
  }

  blocked(x, y) {
    const b = this.bounds;
    if (x < b.left + 4 || x > b.right - 4 || y < b.top + 4) return true;
    if (y > b.bottom && Math.abs(x - this.door.x) > 12) return true;
    return this.colliders.some((c) => x + 5 > c.x && x - 5 < c.x + c.w && y + 1 > c.y && y - 3 < c.y + c.h);
  }

  update(time, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    const p = this.player;
    if (!this.busy && !this.world.inputLocked) {
      const k = this.keys;
      let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      if (vx || vy) this.moveTarget = null;
      else if (this.moveTarget) { const dx = this.moveTarget.x - p.x, dy = this.moveTarget.y - p.y; if (Math.hypot(dx, dy) < 3) this.moveTarget = null; else { vx = dx; vy = dy; } }
      const len = Math.hypot(vx, vy);
      if (len) {
        vx /= len; vy /= len;
        const nx = p.x + vx * SPEED * dt, ny = p.y + vy * SPEED * dt;
        let moved = false;
        if (!this.blocked(nx, p.y)) { p.x = nx; moved = true; }
        if (!this.blocked(p.x, ny)) { p.y = ny; moved = true; }
        if (!moved) this.moveTarget = null;
        this.facing = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
        p.play(`walk-${this.facing}`, true);
        if ((this.step = (this.step || 0) - dt) <= 0) { this.step = 0.3; sfx.step(Math.random() < 0.5); }
      } else p.play(`idle-${this.facing}`, true);
      if (p.y > this.bounds.bottom + 6) this.leave();
    }
    p.setDepth(p.y);
    this.shadow.setPosition(Math.round(p.x), Math.round(p.y) + 1);
    const it = this.nearest();
    if (it !== this.lastNear || (it && (this.tick = (this.tick || 0) + dt) > 0.5)) {
      this.tick = 0; this.lastNear = it;
      this.game.events.emit('prompt', it ? { ...it.label(), action: !!it.action } : null);
    }
  }

  nearest() {
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      const d = Math.hypot(it.x - this.player.x, it.y - this.player.y);
      if (d < it.r + 8 && d < bd) { best = it; bd = d; }
    }
    return best;
  }

  interact() {
    if (this.world.inputLocked || this.busy) return;
    this.nearest()?.action?.();
  }

  rest() {
    this.busy = true;
    sfx.open();
    this.cameras.main.fadeOut(500, 20, 16, 30);
    this.time.delayedCall(900, () => {
      this.cameras.main.fadeIn(600, 20, 16, 30);
      this.busy = false;
      this.game.events.emit('toast', 'A little rest. The valley is still growing while you\'re away.');
    });
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    sfx.open();
    this.game.events.emit('prompt', null);
    this.cameras.main.fadeOut(250, 20, 16, 30);
    this.time.delayedCall(260, () => {
      this.scene.stop();
      this.scene.wake('World');
      this.world.exitedCottage();
    });
  }
}
