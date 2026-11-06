import { Boot } from './scenes/Boot.js';
import { World } from './scenes/World.js';
import { Hud } from './scenes/Hud.js';
import { Interior } from './scenes/Interior.js';

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#2b2d42',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  input: { activePointers: 2 },
  scene: [Boot, World, Hud, Interior],
});


// Installable web app: offline shell (not in demo/test mode, so screenshots always load fresh code).
if ('serviceWorker' in navigator && !new URLSearchParams(location.search).has('demo')) {
  navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
}
