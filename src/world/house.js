// Builds the cottage texture from Sprout Lands roof, wall and door tiles.
import { PAL } from '../data/palette.js';
import { canvasTexture, px } from './pixels.js';

const T = 16;

/** W tiles wide. Returns { key, w, h, doorX, windows: [{x,y}] } in texture pixels. */
export function buildCottage(scene, key, W = 5) {
  const roof = scene.textures.get('house-roof').getSourceImage();
  const walls = scene.textures.get('house-walls').getSourceImage();
  const doors = scene.textures.get('doors').getSourceImage();
  const OVER = 2; // roof overhang each side
  const CAP = 6; // scalloped top
  const w = W * T + OVER * 2, h = CAP + 3 * T + 2 * T;
  const roofY = CAP, wallY = CAP + 3 * T;
  const tile = (img, i, cols, sx = 0, sw = T) => [img, (i % cols) * T + sx, Math.floor(i / cols) * T, sw, T];
  const windows = [];
  const doorCol = Math.floor(W / 2);

  canvasTexture(scene, key, w, h, (c) => {
    const draw = (src, dx, dy, dw = src[3]) => c.drawImage(src[0], src[1], src[2], src[3], src[4], dx, dy, dw, T);
    // Walls: eave row then plank row
    for (let i = 0; i < W; i++) {
      const x = OVER + i * T;
      if (i === 0) { draw(tile(walls, 3, 5), x, wallY); draw(tile(walls, 8, 5), x, wallY + T); }
      else if (i === W - 1) { draw(tile(walls, 4, 5), x, wallY); draw(tile(walls, 9, 5), x, wallY + T); }
      else {
        draw(tile(walls, 3, 5, 6, 8), x, wallY); draw(tile(walls, 3, 5, 6, 8), x + 8, wallY);
        draw(tile(walls, 8, 5, 6, 8), x, wallY + T); draw(tile(walls, 8, 5, 6, 8), x + 8, wallY + T);
      }
    }
    // Door (fill behind the frame gap) and windows
    const dx = OVER + doorCol * T;
    px(c, PAL.woodDark, dx + 2, wallY + T, 12, T);
    draw(tile(doors, 1, 1), dx, wallY + T);
    for (const col of [1, W - 2]) {
      if (col === doorCol) continue;
      const wx = OVER + col * T;
      px(c, PAL.blueDark, wx + 4, wallY + T + 4, 8, 7);
      px(c, PAL.blueLight, wx + 5, wallY + T + 5, 3, 2);
      draw(tile(walls, 13, 5), wx, wallY + T);
      windows.push({ x: wx + 8, y: wallY + T + 8 });
    }
    // Roof body: 3 rows, alternating middle tiles, stretched over the overhang
    const rows = [[17, 18, 19, 20], [24, 25, 26, 27], [31, 32, 33, 34]];
    rows.forEach((row, r) => {
      for (let i = 0; i < W; i++) {
        const ti = i === 0 ? row[0] : i === W - 1 ? row[3] : row[1 + (i % 2)];
        draw(tile(roof, ti, 7), OVER + i * T, roofY + r * T);
      }
      // overhang: repeat edge columns
      c.drawImage(roof, (row[0] % 7) * T, Math.floor(row[0] / 7) * T, OVER, T, 0, roofY + r * T, OVER, T);
      c.drawImage(roof, (row[3] % 7) * T + T - OVER, Math.floor(row[3] / 7) * T, OVER, T, w - OVER, roofY + r * T, OVER, T);
    });
    // Scalloped top cap
    for (let x = 0; x < w; x++) {
      const bump = (x % 5);
      const top = bump === 0 || bump === 4 ? 3 : bump === 2 ? 1 : 2;
      px(c, PAL.woodMid, x, roofY - CAP + top + 1, 1, CAP - top - 1);
      if (bump === 2) px(c, PAL.woodLight, x, roofY - CAP + top + 1);
    }
    // Roof outline left/right/top, eave shadow on the wall
    px(c, PAL.woodDark, 0, roofY - 3, 1, 3 * T + 3);
    px(c, PAL.woodDark, w - 1, roofY - 3, 1, 3 * T + 3);
    for (let x = 0; x < w; x++) {
      const bump = (x % 5);
      const top = bump === 0 || bump === 4 ? 3 : bump === 2 ? 1 : 2;
      px(c, PAL.woodDark, x, roofY - CAP + top);
    }
    px(c, PAL.woodDark, 0, wallY - 1, w, 1);
    c.fillStyle = 'rgba(80,64,134,0.35)';
    c.fillRect(OVER, wallY, W * T, 2);
    // Chimney
    c.drawImage(roof, 5 * T, 0, T, 11, OVER + T + 4, 0, T, 11);
  });
  return { key, w, h, doorX: OVER + doorCol * T + 8, windows, wallY };
}
