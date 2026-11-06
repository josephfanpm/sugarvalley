// Game cosmetics drawn in world space: pets that follow the character, trail particles,
// cheer reactions and confetti. Original pixel art for Sugar Peek (CC-BY-SA 3.0).
import { px } from './avatar.js';

// Each pet: palette + two frames of pixel rows ('.' = transparent). Drawn facing right; mirrored for left.
const PETS = {
  pet_chick: {
    pal: { y: '#facc15', Y: '#ca8a04', k: '#111827', o: '#f97316' },
    frames: [
      ['....yyyy....', '...yyyyyy...', '...yykyyyoo.', '...yyyyyy...', '..yyyyyyyy..', '.Yyyyyyyyyy.', '..YyyyyyyY..', '...YYYYYY...', '....o..o....'],
      ['....yyyy....', '...yyyyyy...', '...yykyyyoo.', '...yyyyyy...', '..yyyyyyyy..', '.yyyyyyyyyY.', '..YyyyyyyY..', '...YYYYYY...', '...o....o...'],
    ],
  },
  pet_cat: {
    pal: { o: '#f59e0b', O: '#b45309', w: '#fff7ed', k: '#111827', p: '#f9a8d4' },
    frames: [
      ['.........o.o..', '.........ooo..', 'o.......okoko.', 'o.......ooooo.', '.o.....oowpwo.', '.ooOoOoooooo..', '..oooooooooo..', '..oOoOoOoooo..', '..oo..oo.oo...'],
      ['.........o.o..', '.........ooo..', '.o......okoko.', 'o.......ooooo.', 'o......oowpwo.', '.ooOoOoooooo..', '..oooooooooo..', '..oOoOoOoooo..', '...oo..oo.oo..'],
    ],
  },
  pet_dog: {
    pal: { b: '#a16207', B: '#713f12', w: '#fef3c7', k: '#111827', t: '#f87171' },
    frames: [
      ['.........BB...', '........bbbb..', 'b.......bkbkB.', '.b......bbbbbk', '.bbbbbbbbbbwt.', '.bbwwbbbbbbb..', '.bbwwbbbbbbb..', '..bb..bb.bb...', '..BB..BB.BB...'],
      ['.........BB...', '........bbbb..', '.b......bkbkB.', 'b.......bbbbbk', '.bbbbbbbbbbwt.', '.bbwwbbbbbbb..', '.bbwwbbbbbbb..', '...bb..bb.bb..', '...BB..BB.BB..'],
    ],
  },
  pet_slime: {
    pal: { g: '#4ade80', G: '#16a34a', h: '#dcfce7', k: '#14532d' },
    frames: [
      ['....gggg....', '..gghhgggg..', '.gghgggggggg', '.ggkgggkgggg', 'gggggggggggg', 'ggggGGGGgggg', '.GGGGGGGGGG.'],
      ['............', '...gggggg...', '.gghhgggggg.', 'gghgggggggggg', 'gggkgggkgggg', 'gggggGGggggg', 'GGGGGGGGGGGG'],
    ],
  },
  pet_drone: {
    fly: true,
    pal: { s: '#cbd5e1', S: '#475569', c: '#22d3ee', k: '#0f172a' },
    frames: [
      ['SSS......SSS', '..S......S..', '..SSSSSSSS..', '.SssssssssS.', '.Ssscckssss.', '.SssssssssS.', '..SSSSSSSS..'],
      ['.SSS....SSS.', '..S......S..', '..SSSSSSSS..', '.SssssssssS.', '.Sssckcssss.', '.SssssssssS.', '..SSSSSSSS..'],
    ],
  },
  pet_dragon: {
    fly: true,
    pal: { r: '#7c3aed', R: '#4c1d95', y: '#fde68a', k: '#111827', w: '#c4b5fd', f: '#f97316' },
    frames: [
      ['w...........w.', 'ww....rrr..ww.', 'www..rrkrrwww.', '.wwwrrrrrrwwf.', '..rrryyyrrr...', '..rryyyyyrr...', '...rryyyrr.rr.', '....rrrrr...r.', '....R...R.....'],
      ['..............', '......rrr.....', '.....rrkrr..f.', 'wwwwrrrrrrwww.', '.wwryyyyyrrww.', '..wryyyyyrw...', '...rryyyrr.rr.', '....rrrrr...r.', '....R...R.....'],
    ],
  },
};

export function drawPet(c, id, x, y, facing, t, sitting) {
  const pet = PETS[id];
  if (!pet) return;
  const f = pet.frames[sitting && !pet.fly ? 0 : Math.floor(t * (pet.fly ? 8 : 6)) % 2];
  const w = f[0].length, h = f.length, lift = pet.fly ? 14 + Math.round(Math.sin(t * 4) * 2) : 0;
  const shadowW = Math.max(3, Math.round(w / 2) - (pet.fly ? 2 : 0));
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(Math.round(x - shadowW), Math.round(y - 1), shadowW * 2, 2);
  const ox = Math.round(x - w / 2), oy = Math.round(y - h - lift);
  for (let r = 0; r < h; r++) for (let col = 0; col < w; col++) {
    const ch = f[r][facing === 'left' ? w - 1 - col : col];
    if (ch && ch !== '.') px(c, pet.pal[ch], ox + col, oy + r);
  }
}

/** Small icon of an item for the rewards UI. */
export function drawPetIcon(canvas, id) {
  const pet = PETS[id], c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  if (!pet) return;
  const f = pet.frames[0], s = Math.floor(Math.min(canvas.width / f[0].length, canvas.height / f.length) * 0.8);
  const ox = Math.floor((canvas.width - f[0].length * s) / 2), oy = Math.floor((canvas.height - f.length * s) / 2);
  for (let r = 0; r < f.length; r++) for (let col = 0; col < f[r].length; col++) if (f[r][col] !== '.') { c.fillStyle = pet.pal[f[r][col]]; c.fillRect(ox + col * s, oy + r * s, s, s); }
}

// ---------- trails ----------
const RAINBOW = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
export const TRAILS = {
  trail_sparkles: (p, t) => ({ color: Math.sin(t * 20 + p.seed) > 0 ? '#fef08a' : '#ffffff', size: 1 + (p.seed % 2), vy: -6 }),
  trail_leaves: (p) => ({ color: ['#16a34a', '#65a30d', '#ca8a04'][p.seed % 3], size: 2, vy: 10, sway: true }),
  trail_bubbles: (p) => ({ color: 'rgba(147,197,253,0.8)', ring: true, size: 3, vy: -14 }),
  trail_hearts: (p) => ({ heart: true, color: '#f472b6', vy: -12 }),
  trail_rainbow: (p) => ({ color: RAINBOW[p.seed % RAINBOW.length], size: 2, vy: -2 }),
};

export class Particles {
  constructor() { this.list = []; this.n = 0; }
  emit(x, y, kind, extra = {}) { this.list.push({ x, y, kind, age: 0, life: extra.life ?? 0.9, seed: this.n++, vx: extra.vx ?? (Math.random() - 0.5) * 8, vy0: extra.vy, ...extra }); }
  update(dt) {
    for (const p of this.list) p.age += dt;
    this.list = this.list.filter((p) => p.age < p.life);
  }
  draw(c, t, filter = () => true) {
    for (const p of this.list) {
      if (!filter(p)) continue;
      const a = 1 - p.age / p.life;
      if (p.kind === 'confetti') {
        const x = p.x + p.vx * p.age, y = p.y + p.vy0 * p.age + 60 * p.age * p.age;
        c.globalAlpha = Math.min(1, a * 2); px(c, p.color, x, y, 2, Math.sin(t * 10 + p.seed) > 0 ? 2 : 1); c.globalAlpha = 1;
        continue;
      }
      const style = TRAILS[p.kind]?.(p, t);
      if (!style) continue;
      const x = p.x + (style.sway ? Math.sin(p.age * 6 + p.seed) * 3 : p.vx * p.age * 0.3), y = p.y + style.vy * p.age;
      c.globalAlpha = a;
      if (style.heart) { px(c, style.color, x - 2, y - 1, 2, 2); px(c, style.color, x + 1, y - 1, 2, 2); px(c, style.color, x - 2, y, 5, 2); px(c, style.color, x - 1, y + 2, 3, 1); px(c, style.color, x, y + 3, 1, 1); }
      else if (style.ring) { px(c, style.color, x - 1, y - 2, 3, 1); px(c, style.color, x - 1, y + 2, 3, 1); px(c, style.color, x - 2, y - 1, 1, 3); px(c, style.color, x + 2, y - 1, 1, 3); }
      else px(c, style.color, x, y, style.size, style.size);
      c.globalAlpha = 1;
    }
  }
}

export function drawTrailIcon(canvas, id) {
  const c = canvas.getContext('2d'), parts = new Particles();
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.save(); c.scale(3, 3);
  for (let i = 0; i < 7; i++) parts.emit(4 + i * 2, canvas.height / 3 - 3 - (i % 3) * 3, id, { life: 10, vx: 0 });
  parts.list.forEach((p, i) => { p.age = (i % 3) * 0.2; });
  parts.draw(c, 1);
  c.restore();
}

// ---------- cheer reactions ----------
const CHEER_ICONS = {
  heart: (c, x, y) => { px(c, '#e11d48', x - 3, y - 2, 3, 3); px(c, '#e11d48', x + 1, y - 2, 3, 3); px(c, '#e11d48', x - 3, y, 7, 3); px(c, '#e11d48', x - 2, y + 3, 5, 1); px(c, '#e11d48', x - 1, y + 4, 3, 1); px(c, '#fda4af', x - 2, y - 1, 1, 1); },
  party: (c, x, y) => { px(c, '#a855f7', x - 3, y + 1, 4, 4); px(c, '#facc15', x - 2, y - 3, 2, 2); px(c, '#22c55e', x + 2, y - 2, 2, 2); px(c, '#3b82f6', x + 1, y + 2, 2, 2); px(c, '#ef4444', x - 4, y - 1, 1, 2); },
  muscle: (c, x, y) => { px(c, '#f59e0b', x - 3, y, 7, 4); px(c, '#f59e0b', x + 1, y - 3, 3, 4); px(c, '#b45309', x - 3, y + 3, 7, 1); },
  star: (c, x, y) => { px(c, '#facc15', x - 1, y - 4, 3, 9); px(c, '#facc15', x - 4, y - 1, 9, 3); px(c, '#fde68a', x - 2, y - 2, 5, 5); },
};
export function drawCheerBubble(c, kind, x, y, t) {
  const by = Math.round(y + Math.sin(t * 5) * 1.5);
  px(c, '#111827', x - 7, by - 7, 15, 14); px(c, '#ffffff', x - 6, by - 6, 13, 12); px(c, '#111827', x - 1, by + 7, 3, 2);
  CHEER_ICONS[kind]?.(c, x, by);
}
