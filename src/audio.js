// Synthesized sound until we add a CC0 audio pack. WebAudio only, starts after the first input.
let ctx = null, master = null, sfxBus = null, ambBus = null, musicBus = null;
let muted = false;
const amb = { wind: null, crickets: null, birds: null, music: null };

function delayFx(input, time = 0.28, feedback = 0.32, wet = 0.35) {
  const d = ctx.createDelay(1), fb = ctx.createGain(), w = ctx.createGain();
  d.delayTime.value = time; fb.gain.value = feedback; w.gain.value = wet;
  input.connect(d); d.connect(fb); fb.connect(d); d.connect(w);
  return w;
}

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  delayFx(sfxBus).connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 0.35; ambBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
  delayFx(musicBus, 0.42, 0.4, 0.5).connect(master);
  startWind();
}

export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05); }
export const isMuted = () => muted;

function tone(freq, { type = 'triangle', at = 0, dur = 0.3, vol = 0.3, bus = sfxBus, slide = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, { at = 0, vol = 0.2, freq = 1200, q = 0.8, bus = sfxBus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(bus); s.start(t);
}

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

// Recorded CC0 sounds (Kenney) when the game has loaded them; synthesized otherwise.
let sampler = null;
export function setSampler(fn) { sampler = fn; }
const sample = (key, vol = 0.5) => !muted && !!sampler && sampler(key, vol);
export const sfx = {
  step(alt) { noise(0.06, { vol: 0.12, freq: alt ? 900 : 700, q: 1.2 }); },
  blip() { if (!sample('ui-click', 0.4)) tone(NOTE(84), { dur: 0.08, vol: 0.12, type: 'square' }); },
  open() { if (!sample('ui-open', 0.45)) { tone(NOTE(76), { dur: 0.12, vol: 0.14 }); tone(NOTE(83), { at: 0.06, dur: 0.16, vol: 0.12 }); } },
  deny() { if (!sample('ui-error', 0.4)) tone(NOTE(60), { dur: 0.18, vol: 0.14, type: 'square', slide: 0.8 }); },
  collect() { sample('sparkle', 0.35); [79, 83, 86, 91].forEach((n, i) => tone(NOTE(n), { at: i * 0.05, dur: 0.25, vol: 0.13 })); },
  restore() {
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), { at: i * 0.07, dur: 0.6, vol: 0.14 }));
    tone(NOTE(48), { dur: 1.2, vol: 0.12, type: 'sine' });
    noise(0.8, { at: 0.1, vol: 0.06, freq: 6000, q: 0.5 });
  },
  water() { for (let i = 0; i < 6; i++) noise(0.09, { at: i * 0.08, vol: 0.08, freq: 2500 + Math.random() * 1500, q: 2 }); },
  pickup() { if (!sample('item-pluck', 0.5)) tone(NOTE(84), { dur: 0.1, vol: 0.1, slide: 1.3 }); },
  confirm() { if (!sample('ui-confirm', 0.45)) tone(NOTE(79), { dur: 0.15, vol: 0.12 }); },
  eggs() { [0, 0.1, 0.2].forEach((at, i) => tone(NOTE(79 + i * 3), { at, dur: 0.09, vol: 0.12, type: 'sine', slide: 1.4 })); },
  milk() { for (let i = 0; i < 5; i++) noise(0.12, { at: i * 0.07, vol: 0.06, freq: 900 + i * 120, q: 4 }); tone(NOTE(72), { at: 0.3, dur: 0.2, vol: 0.08, type: 'sine' }); },
  harvest() { noise(0.25, { vol: 0.1, freq: 3200, q: 0.7 }); tone(NOTE(76), { at: 0.15, dur: 0.15, vol: 0.1 }); tone(NOTE(81), { at: 0.25, dur: 0.2, vol: 0.1 }); },
  sizzle() { noise(0.9, { vol: 0.08, freq: 5000, q: 0.4 }); noise(0.6, { at: 0.3, vol: 0.06, freq: 4200, q: 0.6 }); },
  fanfare() { [[72, 0], [76, 0.12], [79, 0.24], [84, 0.4], [79, 0.55], [84, 0.7]].forEach(([n, at]) => tone(NOTE(n), { at, dur: 0.35, vol: 0.14 })); },
  moo() { tone(NOTE(45), { dur: 0.7, vol: 0.16, type: 'triangle', slide: 0.85 }); tone(NOTE(52), { dur: 0.5, vol: 0.06, type: 'triangle', slide: 0.9 }); },
  cluck() { tone(NOTE(74), { dur: 0.07, vol: 0.06, type: 'square', slide: 1.3 }); tone(NOTE(76), { at: 0.09, dur: 0.06, vol: 0.05, type: 'square', slide: 1.2 }); },
};

function startWind() {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  s.buffer = buf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0.25;
  lfo.frequency.value = 0.07; lg.gain.value = 0.15; lfo.connect(lg); lg.connect(g.gain);
  s.connect(f); f.connect(g); g.connect(ambBus); s.start(); lfo.start();
  amb.wind = g;
}

/** Called each second with the day phase: 0 = full day, 1 = full night. */
export function ambience(night, dt) {
  if (!ctx) return;
  if (Math.random() < dt * (night > 0.5 ? 2.2 : 0)) {
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 4; i++) tone(f, { at: i * 0.045, dur: 0.03, vol: 0.025 * night, type: 'sine', bus: ambBus });
  }
  if (Math.random() < dt * (night < 0.4 ? 0.25 : 0)) {
    const f = NOTE(88 + Math.floor(Math.random() * 6));
    tone(f, { dur: 0.12, vol: 0.05, type: 'sine', slide: 1.25, bus: ambBus });
    tone(f * 1.1, { at: 0.14, dur: 0.1, vol: 0.04, type: 'sine', slide: 0.85, bus: ambBus });
  }
}

// Gentle music box: pentatonic phrases, sparse, in a slow loop.
const SCALE = [0, 2, 4, 7, 9];
let musicTimer = 0, bar = 0;
export function music(dt) {
  if (!ctx) return;
  musicTimer -= dt;
  if (musicTimer > 0) return;
  musicTimer = 2.4;
  const root = [60, 57, 62, 55][bar++ % 4];
  tone(NOTE(root - 12), { dur: 2.2, vol: 0.18, type: 'sine', bus: musicBus });
  let at = 0;
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const deg = SCALE[Math.floor(Math.random() * SCALE.length)] + (Math.random() < 0.3 ? 12 : 0);
    tone(NOTE(root + 12 + deg), { at, dur: 0.9, vol: 0.16, type: 'triangle', bus: musicBus });
    at += [0.3, 0.6, 0.45][Math.floor(Math.random() * 3)];
  }
}
