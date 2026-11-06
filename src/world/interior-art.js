// Pixel art for building interiors: counters, café and bakery fixtures, restaurant tables,
// gym machines and a few small icons. Palette colors only.
import { PAL } from '../data/palette.js';
import { canvasTexture, art, px } from './pixels.js';

export function makeInteriorArt(scene) {
  const T = (key, w, h, rows, map) => canvasTexture(scene, key, w, h, (c) => art(c, rows, map));
  const WOOD = { k: PAL.woodDark, w: PAL.wood, l: PAL.woodLight, m: PAL.woodMid };

  // Counter: wooden top and paneled front, any width
  const counter = (key, w, top = PAL.woodLight) => canvasTexture(scene, key, w, 20, (c) => {
    px(c, PAL.woodDark, 0, 0, w, 20);
    px(c, top, 1, 1, w - 2, 5);
    px(c, '#e8cfa6', 1, 1, w - 2, 1);
    px(c, PAL.woodDark, 1, 6, w - 2, 1);
    px(c, PAL.wood, 1, 7, w - 2, 12);
    for (let x = 6; x < w - 2; x += 10) { px(c, PAL.woodMid, x, 8, 1, 10); px(c, PAL.woodLight, x + 1, 8, 1, 10); }
    px(c, PAL.woodMid, 1, 18, w - 2, 1);
  });
  counter('counter-64', 64); counter('counter-48', 48); counter('counter-desk', 40, PAL.stoneLight);

  T('espresso', 14, 14, [
    '..kkkkkkkkkk..', '.kSSSSSSSSSSk.', '.kSmmmmmmmmSk.', '.kSmrrmmggmSk.', '.kSmmmmmmmmSk.', '.kSSSSSSSSSSk.', '.kSkkSSSSkkSk.',
    '.kSk.kSSk.kSk.', '.kSk......kSk.', '.kSk.kwwk.kSk.', '.kSk.kwwk.kSk.', '.kSSSSSSSSSSk.', '.kkkkkkkkkkkk.', '..............',
  ], { k: PAL.stoneDeep, S: PAL.stone, m: PAL.stoneDark, r: PAL.roseDark, g: PAL.leafMid, w: '#fbf4df' });
  T('register', 12, 10, ['..kkkkkkkk..', '..kgggggggk.', '..kkkkkkkk..', '.kmmmmmmmmk.', '.kmwmwmwmmk.', '.kmmwmwmwmk.', 'kkkkkkkkkkkk', 'kmmmmmmmmmmk', 'kkkkkkkkkkkk', '............'],
    { k: PAL.stoneDeep, m: PAL.stoneDark, g: PAL.leafLight, w: PAL.stoneLight });
  T('pastry-case', 26, 12, [
    'kkkkkkkkkkkkkkkkkkkkkkkkkk', 'kbbbbbbbbbbbbbbbbbbbbbbbbk', 'kbOObbppbbOObbyybbppbbOObk', 'kbOObbppbbOObbyybbppbbOObk', 'kbbbbbbbbbbbbbbbbbbbbbbbbk',
    'kbyybbOObbppbbOObbyybbOObk', 'kbyybbOObbppbbOObbyybbOObk', 'kkkkkkkkkkkkkkkkkkkkkkkkkk', 'kwwwwwwwwwwwwwwwwwwwwwwwwk', 'kkkkkkkkkkkkkkkkkkkkkkkkkk', '..........................', '..........................',
  ], { k: PAL.woodDark, b: PAL.blueLight, O: PAL.goldLight, p: PAL.rose, y: PAL.peachDark, w: PAL.wood });
  T('menu-board', 30, 18, [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', 'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwk', 'kwggggggggggggggggggggggggggwk', 'kwgcccccgggggggggggccccgggggwk', 'kwggggggggggggggggggggggggggwk',
    'kwgccccgcccggggggggcccgccggggwk'.slice(0, 30), 'kwggggggggggggggggggggggggggwk', 'kwgcccgccccgggggggggccccgccggwk'.slice(0, 30), 'kwggggggggggggggggggggggggggwk', 'kwgccccccggggggggggcccccgggggwk'.slice(0, 30),
    'kwggggggggggggggggggggggggggwk', 'kwgcccgcccccggggggggcccgccgggwk'.slice(0, 30), 'kwggggggggggggggggggggggggggwk', 'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwk', 'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', '..............................', '..............................', '..............................',
  ], { k: PAL.woodDark, w: PAL.wood, g: PAL.leafDark, c: '#dfe8d0' });
  T('bread-shelf', 32, 30, [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', 'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk', 'kw..oOOo..oOOo...ooooo...oOOo.wk', 'kw.oOOOOo.oOOo..oOOOOOo.oOOOOo.wk'.slice(0, 32), 'kwkkkkkkkkkkkkkkkkkkkkkkkkkkkkwk',
    'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk', 'kw.oooo....oOo..oooo.....oOOo..wk', 'kwoOOOOo..oOOOo.oOOOo...oOOOOo.wk', 'kwkkkkkkkkkkkkkkkkkkkkkkkkkkkkwk', 'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk',
    'kw..oOOo..ooooo...oOOo..oooo..wk', 'kw.oOOOOooOOOOOo.oOOOOo.oOOOo.wk'.slice(0, 32), 'kwkkkkkkkkkkkkkkkkkkkkkkkkkkkkwk', 'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk', 'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ], { k: PAL.woodDark, w: PAL.wood, o: PAL.peachDark, O: PAL.goldLight });
  T('oven', 24, 24, [
    '........kkkkkkkk........', '......kkrrRrrRrrkk......', '....kkrRrrrrrrrrRrkk....', '...krrrrRrrrrrRrrrrrk...', '..krRrrrrrrRrrrrrrRrrk..', '.krrrrRrkkkkkkkkrrrrrrk.',
    '.krRrrrkddddddddkrRrrrk.', 'krrrrrkdyyddddyydkrrrrrk', 'krRrrrkdyoOOOoyydkrrRrrk', 'krrrrrkdoOWWWOoydkrrrrrk', 'krrRrrkddoOOOoddkrrrrRrk', 'kkkkkkkkkkkkkkkkkkkkkkkk',
    'kSSSSSSSSSSSSSSSSSSSSSSk', 'kssssssssssssssssssssssk', 'kSSSSSSSSSSSSSSSSSSSSSSk', 'kkkkkkkkkkkkkkkkkkkkkkkk', '........................', '........................',
    '........................', '........................', '........................', '........................', '........................', '........................',
  ], { k: PAL.woodDark, r: PAL.roseDark, R: PAL.rose, d: PAL.inkDark, y: PAL.goldDark, o: PAL.gold, O: PAL.yellow, W: PAL.sun, S: PAL.stoneLight, s: PAL.stone });
  T('cloth-table', 26, 18, [
    '.kkkkkkkkkkkkkkkkkkkkkkkk.', 'kcrcrcrcrcrcrcrcrcrcrcrcrk', 'krcrcrcrcrcrcrcrcrcrcrcrck', 'kcrcrcrcrcrcrcrcrcrcrcrcrk', 'krcrcrcrcrcrcrcrcrcrcrcrck', 'kcrcrcrcrcrcrcrcrcrcrcrcrk',
    'krrrrrrrrrrrrrrrrrrrrrrrrk', 'kRrRrRrRrRrRrRrRrRrRrRrRrk', 'kkkkkkkkkkkkkkkkkkkkkkkkkk', '..kk..................kk..', '..kk..................kk..', '..kk..................kk..',
    '..kk..................kk..', '..........................', '..........................', '..........................', '..........................', '..........................',
  ], { k: PAL.woodDark, c: '#fbf4df', r: PAL.rose, R: PAL.roseDark });
  T('host-stand', 14, 20, ['.kkkkkkkkkkkk.', 'kllllllllllllk', 'kwwwwwwwwwwwwk', 'kkkkkkkkkkkkkk', '..kwwwwwwwwk..', '..kwlwwwwlwk..', '..kwlwwwwlwk..', '..kwlwwwwlwk..', '..kwlwwwwlwk..', '..kwlwwwwlwk..',
    '..kwlwwwwlwk..', '..kwlwwwwlwk..', '..kwlwwwwlwk..', '..kwwwwwwwwk..', '.kkkkkkkkkkkk.', '.kwwwwwwwwwwk.', '.kkkkkkkkkkkk.', '..............', '..............', '..............'], WOOD);
  T('kitchen-pass', 44, 16, [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', 'kSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSk', 'kSddddddddddddddddddddddddddddddddddddddddSk', 'kSdddsdddddddddsddddddddddsdddddddddsdddddSk',
    'kSddsddddddddddsdddddddddsdddddddddddsddddSk', 'kSddddddddddddddddddddddddddddddddddddddddSk', 'kSddddddddddddddddddddddddddddddddddddddddSk', 'kSddddddddddddddddddddddddddddddddddddddddSk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', 'kllllllllllllllllllllllllllllllllllllllllllk', 'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk', 'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    '............................................', '............................................', '............................................', '............................................',
  ], { k: PAL.woodDark, S: PAL.stoneLight, d: PAL.inkDark, s: PAL.stone, l: PAL.woodLight, w: PAL.wood });

  // ---------- gym ----------
  const treadmill = (key, f) => T(key, 28, 20, [
    '..kk......................', '.kmmk.....................', '.kmmk.....................', '.kmmk.....................', '.kmkkkkkkkkkkkkkkkkkkkkkkk', '.kmmmmmmmmmmmmmmmmmmmmmmmmk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkk', f ? 'kbBbbbBbbbBbbbBbbbBbbbBbbbbk' : 'kbbBbbbBbbbBbbbBbbbBbbbBbbbk', f ? 'kbbbBbbbBbbbBbbbBbbbBbbbBbbk' : 'kBbbbBbbbBbbbBbbbBbbbBbbbBbk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkk', '.kmmmmmmmmmmmmmmmmmmmmmmmmk.', '.kkkkkkkkkkkkkkkkkkkkkkkkkk.', '..kk...................kk...', '..kk...................kk...',
    '............................', '............................', '............................', '............................', '............................', '............................',
  ], { k: PAL.stoneDeep, m: PAL.stoneDark, b: PAL.inkDark, B: PAL.stoneDark });
  treadmill('treadmill-0', 0); treadmill('treadmill-1', 1);
  T('squat-rack', 26, 30, [
    'kk....................kk', 'km....................mk', 'km....................mk', 'km....................mk', 'kmkkkkkkkkkkkkkkkkkkkkmk', 'km....................mk',
    'kmk..................kmk', 'km....................mk', 'km....................mk', 'km....................mk', 'km....................mk', 'km....................mk',
    'km....................mk', 'km....................mk', 'km....................mk', 'km....................mk', 'km....................mk', 'km....................mk',
    'km....................mk', 'km....................mk', 'km....................mk', 'km....................mk', 'kmkkkkkkkkkkkkkkkkkkkkmk', 'kkkkkkkkkkkkkkkkkkkkkkkk',
  ], { k: PAL.stoneDeep, m: PAL.stoneDark, R: PAL.roseDark });
  T('bench-press', 30, 18, [
    '..............................', '..............................', '..............................', '..............................', '..............................',
    '...kk..................kk.....', '...km..................mk.....', '...km..................mk.....', '...km...kkkkkkkkkkkk...mk.....', '...km..kbbbbbbbbbbbbk..mk.....',
    '...km..kBBBBBBBBBBBBk..mk.....', '...kk..kkkkkkkkkkkkkk..kk.....', '.........k........k...........', '.........k........k...........', '........kkk......kkk..........', '..............................', '..............................', '..............................',
  ], { k: PAL.stoneDeep, m: PAL.stoneDark, R: PAL.roseDark, b: PAL.blueDark, B: PAL.blue });
  // Stationary bike, facing left: handlebars and flywheel at the front, seat at the back
  T('bike', 26, 19, [
    '..........................', '..kkk.....................', '..kmk.....................', '...kk.....................', '....k.........kkkkkk......',
    '....k.........kbbbbk......', '....k..........kkkk.......', '....k...........km........', '...kkk..........km........', '..kmmmk.........km........',
    '.kmBBBmk........km........', '.kmBkBmk.......kmmk.......', '.kmBBBmkkkkkkkkkmmk.......', '..kmmmk.......kkmmkk......', '...kkk.........kpk........',
    '...k............k.........', '.kkkkkkkkkkkkkkkkkkkkkk...', '.kmmmmmmmmmmmmmmmmmmmmk...', '.kkkkkkkkkkkkkkkkkkkkkk...',
  ], { k: PAL.stoneDeep, m: PAL.stoneDark, b: PAL.blueDark, B: PAL.stone, p: PAL.roseDark });
  T('dumbbell-rack', 30, 14, [
    '.kk.kk.kk.kk.kk.kk.kk.kk.kk.', 'kRkkRkkBkkBkkGkkGkkRkkBkkGk.', '.kk.kk.kk.kk.kk.kk.kk.kk.kk.', 'kkkkkkkkkkkkkkkkkkkkkkkkkkkk', 'kmmmmmmmmmmmmmmmmmmmmmmmmmmk', 'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    '.km......................mk.', '.km......................mk.', '.km......................mk.', '.kk......................kk.', '............................', '............................', '............................', '............................',
  ], { k: PAL.stoneDeep, m: PAL.stoneDark, R: PAL.roseDark, B: PAL.blueDark, G: PAL.leaf });
  T('yoga-mat', 26, 10, ['kkkkkkkkkkkkkkkkkkkkkkkkkk', 'kvvvvvvvvvvvvvvvvvvvvvvvvk', 'kvVvvvvvvvvvvvvvvvvvvvvVvk', 'kvvvvvvvvvvvvvvvvvvvvvvvvk', 'kvvvvvvvvvvvvvvvvvvvvvvvvk', 'kvVvvvvvvvvvvvvvvvvvvvvVvk', 'kvvvvvvvvvvvvvvvvvvvvvvvvk', 'kkkkkkkkkkkkkkkkkkkkkkkkkk', '..........................', '..........................'],
    { k: PAL.violetDark, v: PAL.violet, V: PAL.violetLight });
  T('mirror', 60, 12, ['k'.repeat(60), 'k' + 'b'.repeat(58) + 'k', 'k' + 'bB'.repeat(29) + 'k', 'k' + 'b'.repeat(58) + 'k', 'k' + 'Bb'.repeat(29) + 'k', 'k' + 'b'.repeat(58) + 'k', 'k' + 'b'.repeat(58) + 'k', 'k' + 'b'.repeat(58) + 'k', 'k'.repeat(60), '', '', ''],
    { k: PAL.stoneDark, b: PAL.blueLight, B: '#ffffff' });
  T('water-cooler', 12, 22, ['..kkkkkkkk..', '.kbbbbbbbbk.', '.kbBbbbbbbk.', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kkkkkkkk..', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '.kwkkwwwwwk.', '.kwkrwwwwwk.', '.kwwwwwwwwk.',
    '.kwwwwwwwwk.', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............', '............', '............', '............', '............'],
    { k: PAL.stoneDark, b: PAL.blue, B: PAL.blueLight, w: '#fbf4df', r: PAL.roseDark });
  T('computer', 12, 10, ['.kkkkkkkkkk.', '.kbbbbbbbbk.', '.kbgggbbbbk.', '.kbbbbbbbbk.', '.kkkkkkkkkk.', '.....kk.....', '...kkkkkk...', 'kkkkkkkkkkkk', 'kmmmmmmmmmmk', 'kkkkkkkkkkkk'],
    { k: PAL.stoneDeep, b: PAL.blueDark, g: PAL.leafLight, m: PAL.stoneDark });

  T('barbell', 28, 7, [
    '.kk....................kk.', 'kRRk..................kRRk', 'kRRkkkkkkkkkkkkkkkkkkkkRRk', 'kRRkmmmmmmmmmmmmmmmmmmkRRk', 'kRRkkkkkkkkkkkkkkkkkkkkRRk', 'kRRk..................kRRk', '.kk....................kk.',
  ], { k: PAL.stoneDeep, m: PAL.stoneLight, R: PAL.roseDark });

  // ---------- icons ----------
  T('icon-coin', 9, 9, ['..kkkkk..', '.kyyyyyk.', 'kyYyyyyyk', 'kyyYkYyyk', 'kyyykyyyk', 'kyyYkYyyk', 'kyyyyyyyk', '.kyyyyyk.', '..kkkkk..'], { k: PAL.goldDark, y: PAL.gold, Y: PAL.sun });
  T('icon-card', 11, 8, ['kkkkkkkkkkk', 'kbbbbbbbbbk', 'kkkkkkkkkkk', 'kwwwwwwwwwk', 'kwggwwwwwwk', 'kwggwkkkkwk', 'kwwwwwwwwwk', 'kkkkkkkkkkk'], { k: PAL.blueDark, b: PAL.blue, w: '#fbf4df', g: PAL.leafMid });
  T('icon-plate', 12, 8, ['...........', '...kkkkk....', '..kyyrryk...', '.kgyyyrryk..', 'kkkkkkkkkkk.', 'kppppppppppk', '.kkkkkkkkkk.', '............'], { k: PAL.stoneDark, p: PAL.stoneLight, y: PAL.yellow, r: PAL.roseDark, g: PAL.leafMid });
}
