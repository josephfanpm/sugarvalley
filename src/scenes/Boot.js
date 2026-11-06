// Loads art, builds generated textures, waits for the pixel font, loads the valley, then starts.
import { makeSprites } from '../world/pixels.js';
import { loadView, MODE } from '../net.js';
import { setSampler } from '../audio.js';
import { makeTownArt } from '../world/town-art.js';
import { makeInteriorArt } from '../world/interior-art.js';

const ART = '../art/';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const bar = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 0, 6, 0xf2cf8c).setOrigin(0.5);
    this.load.on('progress', (p) => bar.setSize(220 * p, 6));
    const sheet = (key, file, w, h) => this.load.spritesheet(key, ART + file, { frameWidth: w, frameHeight: h });
    sheet('player', 'player.png', 48, 48);
    sheet('player-actions', 'player-actions.png', 48, 48);
    sheet('chicken', 'chicken.png', 16, 16);
    sheet('cow', 'cow.png', 32, 32);
    sheet('water', 'water.png', 16, 16);
    sheet('fences', 'fences.png', 16, 16);
    sheet('soil-sheet', 'soil.png', 16, 16);
    for (const k of ['ui-click', 'ui-confirm', 'ui-error', 'ui-open', 'ui-close', 'item-drop', 'item-pluck', 'sparkle']) this.load.audio(k, `../audio/${k}.ogg`);
    for (const k of ['grass', 'nature', 'paths', 'bridge', 'coop', 'chest', 'egg-nest', 'house-roof', 'house-walls', 'doors', 'plants', 'furniture', 'milk-grass'])
      this.load.image(k, `${ART}${k}.png`);
  }

  async create() {
    makeSprites(this);
    makeTownArt(this);
    makeInteriorArt(this);
    setSampler((key, volume) => { if (!this.cache.audio.exists(key)) return false; this.sound.play(key, { volume }); return true; });
    try { await Promise.race([document.fonts.load('16px "DotGothic16"'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fall back */ }
    try {
      this.registry.set('view', await loadView());
    } catch (e) {
      const msg = MODE === 'viewer' ? 'This link was turned off or never existed.' : e.message;
      this.add.text(this.scale.width / 2, this.scale.height / 2 + 24, msg, { fontFamily: '"DotGothic16"', fontSize: '20px', color: '#f3e5c2' }).setOrigin(0.5);
      return;
    }
    this.scene.start('World');
  }
}
