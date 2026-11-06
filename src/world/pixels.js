// Small pixel-art helpers and the hand-made sprites the Sprout Lands pack doesn't include.
// All art uses palette colors only (design/art-bible.md §4).
import { PAL } from '../data/palette.js';

export function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx, tex);
  tex.refresh();
  return tex;
}

export function px(ctx, color, x, y, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Draw string art: each char maps to a color in `map`; '.' is transparent. */
export function art(ctx, rows, map, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = map[row[x]];
      if (c) px(ctx, c, ox + x, oy + y);
    }
  });
}

/** 1-px outline around opaque pixels, in `color`. */
export function outline(ctx, w, h, color) {
  const img = ctx.getImageData(0, 0, w, h), a = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 0;
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) add.push([x, y]);
  }
  for (const [x, y] of add) px(ctx, color, x, y);
}

// ---------- custom sprites ----------
const LANTERN = [
  '...kk...',
  '..kmmk..',
  '.kmmmmk.',
  '.kgGGgk.',
  '.kgGGgk.',
  '.kggggk.',
  '.kmmmmk.',
  '..kkkk..',
  '...kw...',
  '...wl...',
  '...wl...',
  '...wl...',
  '...wl...',
  '...wl...',
  '...wl...',
  '...wl...',
  '..kwlk..',
  '.kwwllk.',
  '.kkkkkk.',
];

const WELL = [
  '.....kkkkkkkkkkkkkk.....',
  '...kkrrrrrrrrrrrrrrkk...',
  '.kkrRrrRrrRrrRrrRrrRrkk.',
  'krrRrrRrrRrrRrrRrrRrrRrk',
  'kkkkkkkkkkkkkkkkkkkkkkkk',
  '..kwlk....kkkk....kwlk..',
  '..kwlk.....kk.....kwlk..',
  '..kwlk.....kk.....kwlk..',
  '..kwlk....kmmk....kwlk..',
  '..kwlk....kmmk....kwlk..',
  '..kwlk.....kk.....kwlk..',
  '..kkkkkkkkkkkkkkkkkkkk..',
  '.kSSSSSSSSSSSSSSSSSSSSk.',
  'kSskbbbBBbbbbbbbBbbbkssk',
  'kSsskkkkkkkkkkkkkkkksssk',
  'kSSSSdSSSSSdSSSSSdSSSSSk',
  'kssssdsssssdsssssdsssssk',
  'kddddddddddddddddddddddk',
  'kSdSSSSSdSSSSSdSSSSSdSSk',
  'ksdsssssdsssssdsssssdssk',
  '.kkkkkkkkkkkkkkkkkkkkkk.',
];

export function makeSprites(scene) {
  const lantern = (key, lit) => canvasTexture(scene, key, 8, 19, (c) => art(c, LANTERN, {
    k: PAL.woodDark, w: PAL.wood, l: PAL.woodLight, m: PAL.stoneDark,
    g: lit ? PAL.gold : PAL.stoneDeep, G: lit ? PAL.sun : PAL.stoneDark,
  }));
  lantern('lantern-on', true);
  lantern('lantern-off', false);

  const well = (key, full) => canvasTexture(scene, key, 24, 21, (c) => art(c, WELL, {
    k: PAL.woodDark, r: PAL.woodMid, R: PAL.wood, w: PAL.wood, l: PAL.woodLight, m: PAL.stoneDark,
    S: PAL.stoneLight, s: PAL.stone, d: PAL.stoneDark,
    b: full ? PAL.gold : PAL.blueDark, B: full ? PAL.sun : PAL.blue,
  }));
  well('well', false);
  well('well-full', true);

  // UI: sun icon (9x9) and drop icon (7x9)
  canvasTexture(scene, 'icon-sun', 11, 11, (c) => art(c, [
    '.....y.....',
    '..y..y..y..',
    '...kkkkk...',
    '..kGGggok..',
    'yykGggggkyy',
    '..kggggok..',
    '..kgggook..',
    '...kkkkk...',
    '..y..y..y..',
    '.....y.....',
    '...........',
  ], { y: PAL.goldDark, k: PAL.peachDark, g: PAL.gold, G: PAL.sun, o: PAL.goldDark }));
  canvasTexture(scene, 'icon-drop', 7, 10, (c) => art(c, [
    '...k...',
    '..kbk..',
    '..kbk..',
    '.kbbbk.',
    '.kBbbk.',
    'kBbbbbk',
    'kBbbbbk',
    'kbbbbbk',
    '.kbbbk.',
    '..kkk..',
  ], { k: PAL.roseDark, b: PAL.rose, B: PAL.roseLight }));

  // 9-slice panel: cream fill, brown frame, light inner bevel. 12x12, slice 4.
  canvasTexture(scene, 'panel', 12, 12, (c) => art(c, [
    '.kkkkkkkkkk.',
    'kwwwwwwwwwwk',
    'kwllllllllwk',
    'kwlcccccccwk',
    'kwlcccccccwk',
    'kwlcccccccwk',
    'kwlcccccccwk',
    'kwlcccccccwk',
    'kwlcccccccwk',
    'kwddddddddwk',
    'kwwwwwwwwwwk',
    '.kkkkkkkkkk.',
  ], { k: PAL.woodDark, w: PAL.wood, l: PAL.creamLight, c: PAL.cream, d: PAL.creamDark }));

  // Soft shadow ellipse 16x6
  canvasTexture(scene, 'shadow', 16, 6, (c) => art(c, [
    '....ssssssss....',
    '..ssssssssssss..',
    '.ssssssssssssss.',
    '.ssssssssssssss.',
    '..ssssssssssss..',
    '....ssssssss....',
  ], { s: 'rgba(80,64,134,0.28)' }));

  // Radial light (used to erase darkness and for additive glow)
  canvasTexture(scene, 'light', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });

  // Thought bubble (icons drawn on top) and bubble icons
  canvasTexture(scene, 'bubble', 20, 20, (c) => art(c, [
    '...kkkkkkkkkkkkkk...', '..kwwwwwwwwwwwwwwk..', '.kwwwwwwwwwwwwwwwwk.', 'kwwwwwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwwwwwk', 'kwwwwwwwwwwwwwwwwwwk', 'kwwwwwwwwwwwwwwwwwwk', 'kwwwwwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwwwwwk', 'kwwwwwwwwwwwwwwwwwwk', 'kwwwwwwwwwwwwwwwwwwk', 'kwwwwwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwwwwwk', '.kwwwwwwwwwwwwwwwwk.', '..kwwwwwwwwwwwwwwk..', '...kkkkkwwwkkkkkk...',
    '........kwwk........', '........kwk.........', '........kk..........', '....................',
  ], { k: PAL.ink, w: '#fbf4df' }));
  canvasTexture(scene, 'icon-juice', 9, 12, (c) => art(c, [
    '......s..', '.....s...', '..kkkskk.', '.kPPPPPk.', '.kPpppPk.', '.kpyyypk.', '.kpyGypk.', '.kpyyypk.', '.kppppPk.', '.kPPPPPk.', '.kkkkkkk.', '.........',
  ], { k: PAL.peachDark, P: PAL.peachLight, p: PAL.peach, y: PAL.yellow, G: PAL.leafMid, s: PAL.stoneDark }));
  canvasTexture(scene, 'icon-pot', 12, 10, (c) => art(c, [
    '..s..s..s...', '...s..s..s..', '..s..s..s...', 'kkkkkkkkkkkk', '.kmmmmmmmmk.', 'kkmMMMMMMmkk', '.kmmmmmmmmk.', '.kmmmmmmmmk.', '..kmmmmmmk..', '...kkkkkk...',
  ], { k: PAL.stoneDeep, m: PAL.stoneDark, M: PAL.stone, s: PAL.stoneLight }));
  canvasTexture(scene, 'icon-bang', 5, 11, (c) => art(c, [
    '.kkk.', 'krrrk', 'krrrk', 'krrrk', '.krk.', '.krk.', '.kk..', '.....', '.kkk.', 'krrrk', '.kkk.',
  ], { k: PAL.roseDark, r: PAL.rose }));
  canvasTexture(scene, 'icon-z', 13, 11, (c) => art(c, [
    '.......kkkkk.', '..........k..', '.........k...', '........kkkkk', 'kkkkkk.......', '....k........', '...k.........', '..k..........', '.k...........', 'kkkkkk.......', '.............',
  ], { k: PAL.blueDark }));
  canvasTexture(scene, 'icon-note', 9, 10, (c) => art(c, [
    '...kkkkkk', '...kkkkkk', '...k....k', '...k....k', '...k....k', '.kkk..kkk', 'kkkk.kkkk', 'kkkk.kkkk', '.kk...kk.', '.........',
  ], { k: PAL.violetDark }));
  canvasTexture(scene, 'icon-sweat', 4, 6, (c) => art(c, ['.b..', '.b..', 'bBb.', 'bBb.', '.b..', '....'], { b: PAL.blue, B: PAL.blueLight }));

  // Campfire kitchen (2 flame frames) and the notice board
  const campfire = (key, f) => canvasTexture(scene, key, 16, 16, (c) => art(c, f ? [
    '................', '.......y........', '......yo........', '......yoy.......', '.....yoOoy......', '....yoOOOoy.....', '....yoOWOoy.....', '...kyoOWWOoyk...',
    '..kwwoOWWOowwk..', '.kwlwwoOOowwlwk.', '.kswwwwwwwwwwsk.', 'kSssSkwwwwkSssSk', 'kssssSkkkkSssssk', '.kkkksssssskkkk.', '....kkkkkkkk....', '................',
  ] : [
    '................', '........y.......', '........oy......', '.......yoy......', '......yoOoy.....', '.....yoOOOoy....', '.....yoOWOoy....', '...kyoOWWOoyk...',
    '..kwwoOWWOowwk..', '.kwlwwoOOowwlwk.', '.kswwwwwwwwwwsk.', 'kSssSkwwwwkSssSk', 'kssssSkkkkSssssk', '.kkkksssssskkkk.', '....kkkkkkkk....', '................',
  ], { k: PAL.woodDark, w: PAL.wood, l: PAL.woodLight, s: PAL.stone, S: PAL.stoneLight, y: PAL.yellow, o: PAL.goldDark, O: PAL.gold, W: PAL.sun }));
  campfire('campfire-0', 0);
  campfire('campfire-1', 1);
  canvasTexture(scene, 'notice-board', 20, 24, (c) => art(c, [
    '.kkkkkkkkkkkkkkkkkk.', 'kwwwwwwwwwwwwwwwwwwk', 'kwlllllllllllllllwwk', 'kwlppppppl.ppppplwwk', 'kwlpiiiipl.piiiplwwk', 'kwlppppppl.ppppplwwk',
    'kwlpiiiipl.piiiplwwk', 'kwlppppppl.ppppplwwk', 'kwl.......ppppplwwk.', 'kwl.ppppp.piiiplwwk.', 'kwl.piiip.ppppplwwk.', 'kwl.ppppp.......wwk.',
    'kwwwwwwwwwwwwwwwwwwk', 'kkkkkkkkkkkkkkkkkkkk', '...kwk........kwk...', '...kwk........kwk...', '...kwk........kwk...', '...kwk........kwk...',
    '...kwk........kwk...', '...kwk........kwk...', '...kwk........kwk...', '..kkwkk......kkwkk..', '..kwwwk......kwwwk..', '..kkkkk......kkkkk..',
  ], { k: PAL.woodDark, w: PAL.wood, l: PAL.woodMid, p: PAL.cream, i: PAL.stoneDark }));

  // Goal arrow and help icon
  canvasTexture(scene, 'arrow', 11, 10, (c) => art(c, [
    '..kkkkkkk..', '..kYyyyyk..', '..kYyyyyk..', 'kkkYyyyykkk', 'kYYyyyyyyyk', '.kYyyyyyyk.', '..kYyyyyk..', '...kYyyk...', '....kyk....', '.....k.....',
  ], { k: PAL.peachDark, y: PAL.gold, Y: PAL.sun }));
  canvasTexture(scene, 'icon-help', 7, 9, (c) => art(c, [
    '.kkkkk.', 'kk...kk', '.....kk', '....kk.', '...kk..', '...kk..', '.......', '...kk..', '...kk..',
  ], { k: PAL.woodDark }));

  // Visitor gifts left at the Sun Well
  canvasTexture(scene, 'gift-flower', 9, 11, (c) => art(c, [
    '..k.k....', '.kpkpk...', 'kpPyPpk..', '.kpkpk...', '..kgk....', '...g.l...', '..lg.l...', '...gl....', '...g.....', '.bbbbb...', '..bbb....',
  ], { k: PAL.roseDark, p: PAL.rose, P: PAL.roseLight, y: PAL.goldLight, g: PAL.leaf, l: PAL.leafMid, b: PAL.woodMid }));
  canvasTexture(scene, 'gift-heart', 9, 8, (c) => art(c, [
    '.kk...kk.', 'kRrk.kRrk', 'kRrrkrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....',
  ], { k: PAL.roseDark, r: PAL.rose, R: PAL.roseLight }));
  canvasTexture(scene, 'gift-star', 9, 9, (c) => art(c, [
    '....k....', '...kyk...', 'kkkyYykkk', 'kyyyYyyyk', '.kyyyyyk.', '..kyyyk..', '.kyykyyk.', '.kyk.kyk.', '.kk...kk.',
  ], { k: PAL.yellowDark, y: PAL.yellow, Y: PAL.yellowLight }));
  canvasTexture(scene, 'gift-sun', 11, 11, (c) => c.drawImage(scene.textures.get('icon-sun').getSourceImage(), 0, 0));
  canvasTexture(scene, 'icon-gear', 9, 9, (c) => art(c, [
    '...k.k...', '..kwkwk..', '.kwwwwwk.', 'kwwkkkwwk', '.wwk.kww.', 'kwwkkkwwk', '.kwwwwwk.', '..kwkwk..', '...k.k...',
  ], { k: PAL.woodDark, w: PAL.wood }));

  // Veil over unrestored areas
  canvasTexture(scene, 'fog-tile', 16, 16, (c) => { c.fillStyle = 'rgba(221,213,222,0.62)'; c.fillRect(0, 0, 16, 16); });

  // Lit window pane overlay (drawn above the night layer)
  canvasTexture(scene, 'window-lit', 10, 9, (c) => {
    px(c, PAL.gold, 1, 1, 8, 7);
    px(c, PAL.sun, 2, 2, 3, 2);
    px(c, PAL.goldLight, 5, 4, 3, 3);
  });

  // Dirt path tile and pebbles (palette tans)
  canvasTexture(scene, 'dirt-tile', 16, 16, (c) => {
    px(c, PAL.creamDark, 0, 0, 16, 16);
    const dots = [[2, 3], [9, 1], [13, 6], [5, 10], [11, 12], [1, 14], [7, 6], [14, 14]];
    for (const [x, y] of dots) { px(c, PAL.woodLight, x, y, 2, 1); px(c, '#e8cfa6', x, y - 1, 1, 1); }
  });
  canvasTexture(scene, 'pebble', 4, 3, (c) => art(c, ['.ss.', 'sSSs', '.dd.'], { s: PAL.stone, S: PAL.stoneLight, d: PAL.stoneDark }));
  canvasTexture(scene, 'pebble2', 3, 2, (c) => art(c, ['sS.', 'dds'], { s: PAL.woodLight, S: '#e8cfa6', d: PAL.wood }));

  // Particles
  canvasTexture(scene, 'p-dot', 2, 2, (c) => px(c, '#ffffff', 0, 0, 2, 2));
  canvasTexture(scene, 'p-spark', 5, 5, (c) => art(c, ['..w..', '..w..', 'wwWww', '..w..', '..w..'], { w: PAL.goldLight, W: '#ffffff' }));
  canvasTexture(scene, 'p-firefly', 3, 3, (c) => art(c, ['.g.', 'gWg', '.g.'], { g: PAL.yellow, W: PAL.yellowLight }));
  canvasTexture(scene, 'p-leaf', 3, 2, (c) => art(c, ['ll.', '.LL'], { l: PAL.leafMid, L: PAL.leafLight }));
  canvasTexture(scene, 'float-lantern', 7, 9, (c) => art(c, [
    '...k...', '.kkkkk.', 'kGGgggk', 'kGgggok', 'kgggook', 'kggoook', '.kkkkk.', '.wwwww.', 'wwwwwww',
  ], { k: PAL.peachDark, G: PAL.sun, g: PAL.gold, o: PAL.goldDark, w: 'rgba(255,255,255,0.35)' }));
  // Dishes for the cottage table (one per recipe cooked)
  const PLATE = ['..........', '..........', '..........', '..........', '.kpppppPk.', 'kpPPPPPPpk', '.kkkkkkkk.', '..........'];
  const dish = (id, top, map) => canvasTexture(scene, `dish-${id}`, 10, 8, (c) => {
    art(c, PLATE, { k: PAL.stoneDark, p: PAL.stoneLight, P: '#fbf4df' });
    art(c, top, map);
  });
  dish('pancakes', ['..........', '...yyyy...', '..oOOOOo..', '..oyyyyo..', '..oOOOOo..'], { y: PAL.yellow, o: PAL.peachDark, O: PAL.peach });
  dish('applepie', ['..........', '..........', '..oOOOOo..', '.oRoRoRoo.', '..oooooo..'], { o: PAL.peachDark, O: PAL.peach, R: PAL.roseDark });
  dish('omelette', ['..........', '..........', '...yyyy...', '..yYYYYy..', '..yyyyyy..'], { y: PAL.goldDark, Y: PAL.yellow });
  dish('roast', ['..........', '..........', '...vvvg...', '..vVVvvv..', '..vvvvv...'], { v: PAL.violetDark, V: PAL.violet, g: PAL.leafMid });
  dish('bread', ['..........', '..........', '...wwww...', '..wWlWlw..', '..wwwwww..'], { w: PAL.wood, W: PAL.woodLight, l: '#e8cfa6' });
  const MUG = (fill, foam) => ['..........', '..kkkkk...', '..kffffkk.', '..kFFFFk.k', '..kFFFFkk.', '..kFFFFk..', '...kkkk...', '..........'].map((r) => r);
  canvasTexture(scene, 'dish-cider', 10, 8, (c) => art(c, MUG(), { k: PAL.woodDark, f: PAL.goldLight, F: PAL.goldDark }));
  canvasTexture(scene, 'dish-cocoa', 10, 8, (c) => art(c, MUG(), { k: PAL.woodDark, f: '#fbf4df', F: PAL.cream }));

  canvasTexture(scene, 'ribbon', 5, 8, (c) => art(c, ['.kkk.', 'kgGgk', 'kgggk', '.kkk.', '.r.r.', '.r.r.', 'r...r', '.....'], { k: PAL.goldDark, g: PAL.gold, G: PAL.sun, r: PAL.roseDark }));
  canvasTexture(scene, 'p-butterfly', 5, 4, (c) => art(c, ['ww.ww', 'wwkww', '.wkw.', '.w.w.'], { w: '#ffffff', k: PAL.inkDark }));
  canvasTexture(scene, 'p-petal', 2, 2, (c) => art(c, ['pP', 'p.'], { p: PAL.rose, P: PAL.roseLight }));
}
