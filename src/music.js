// Background music: CC0 tracks (assets/audio/CREDITS.md), loaded after the game starts so they
// never delay it. Day tracks alternate; evening and night use the softer title track. Crossfades on
// changes. If loading fails, the synthesized music box in audio.js keeps playing instead.
const TRACKS = {
  day: ['../audio/music-day.ogg', '../audio/music-day.mp3'],
  day2: ['../audio/music-day2.ogg', '../audio/music-day2.mp3'],
  evening: ['../audio/music-evening.ogg', '../audio/music-evening.mp3'],
};
const VOLUME = { day: 0.32, day2: 0.32, evening: 0.24 };
const FADE_MS = 2500;

export class Music {
  constructor(scene) {
    this.scene = scene;
    this.ready = false;
    this.failed = false;
    this.current = null; // { key, sound }
    this.dayFlip = false;
    const load = scene.load;
    for (const [k, urls] of Object.entries(TRACKS)) load.audio(`music-${k}`, urls);
    load.once('complete', () => { this.ready = Object.keys(TRACKS).some((k) => scene.cache.audio.exists(`music-${k}`)); this.failed = !this.ready; });
    load.once('loaderror', () => {});
    load.start();
  }

  /** Synth fallback should play when real music isn't available. */
  get useFallback() { return this.failed || !this.ready; }

  wanted(hour) {
    if (hour >= 6.5 && hour < 17.5) return this.dayFlip ? 'day2' : 'day';
    return 'evening';
  }

  update(hour) {
    if (!this.ready) return;
    const key = this.wanted(hour);
    if (this.current?.key === key) return;
    if (!this.scene.cache.audio.exists(`music-${key}`)) return;
    const old = this.current;
    const sound = this.scene.sound.add(`music-${key}`, { volume: 0, loop: key === 'evening' });
    sound.play();
    // Day tracks alternate when one finishes.
    if (key !== 'evening') sound.once('complete', () => { this.dayFlip = !this.dayFlip; this.current = null; sound.destroy(); });
    this.scene.tweens.add({ targets: sound, volume: VOLUME[key], duration: FADE_MS });
    if (old) this.scene.tweens.add({ targets: old.sound, volume: 0, duration: FADE_MS, onComplete: () => old.sound.destroy() });
    this.current = { key, sound };
  }
}
