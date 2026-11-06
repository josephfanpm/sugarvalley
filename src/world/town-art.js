// Hand-made pixel art for the town, the dog and activity bubbles. Palette colors only.
import { PAL } from '../data/palette.js';
import { canvasTexture, art, px } from './pixels.js';

const FUR = '#e8cfa6', FUR_D = PAL.woodLight, INK = PAL.inkDark;

export function makeTownArt(scene) {
  const T = (key, w, h, rows, map) => canvasTexture(scene, key, w, h, (c) => art(c, rows, map));

  // ---------- dog (faces right; flip for left) ----------
  const DOG = { k: PAL.woodDark, w: FUR, b: FUR_D, e: INK, n: INK, t: PAL.rose };
  const dogBody = [
    '.........kk...',
    '........kbbk..',
    '........kwwwkk',
    'k.......kwwewk',
    'kk......kwwwwn',
    '.kkkkkkkkwwwk.',
    '.kwwwwwwwwwk..',
    '.kwwbbwwwwwk..',
    '.kwwbwwwwwwk..',
  ];
  T('dog-0', 14, 11, [...dogBody, '.kwk.kwk.kwk..', '.kk..kk..kk...'], DOG);
  T('dog-1', 14, 11, [...dogBody, '..kwkkwk.kwk..', '..kk.kk...kk..'], DOG);
  T('dog-sit', 14, 11, [
    '.........kk...', '........kbbk..', '........kwwwkk', '........kwwewk', '........kwwwwn', '.......kkwwwk.',
    'k.....kwwwwk..', 'kk...kwwbwwk..', '.kkkkwwbwwwk..', '.kwwwwwwwwkk..', '.kkkkkkkkkk...',
  ], DOG);
  T('dog-house', 20, 18, [
    '.........kk.........', '.......kkrrkk.......', '.....kkrrRRrrkk.....', '...kkrrRRrrRRrrkk...', '.kkrrRRrrrrrrRRrrkk.',
    'kkkkkkkkkkkkkkkkkkkk', '.kwwwwwwwwwwwwwwwwk.', '.kwlwwwwkkkkwwwwlwk.', '.kwlwwwkddddkwwwlwk.', '.kwlwwkddddddkwwlwk.',
    '.kwlwwkddddddkwwlwk.', '.kwlwwkddddddkwwlwk.', '.kwlwwkddddddkwwlwk.', '.kwwwwkddddddkwwwwk.', '.kkkkkkkkkkkkkkkkkk.',
    '....................', '....................', '....................',
  ], { k: PAL.woodDark, r: PAL.roseDark, R: PAL.rose, w: PAL.wood, l: PAL.woodLight, d: PAL.inkDark });

  // ---------- town props ----------
  const fountain = (key, f) => canvasTexture(scene, key, 32, 26, (c) => {
    art(c, [
      '..............kk..............', '.............kSSk.............', '.............kssk.............', '.............kssk.............',
      '...........kkkSSkkk...........', '..........kSSSSSSSSk..........', '...........kkkkkkkk...........',
    ], { k: PAL.stoneDeep, S: PAL.stoneLight, s: PAL.stone }, 1, 6);
    art(c, [
      '......kkkkkkkkkkkkkkkkkk......', '...kkkSSSSSSSSSSSSSSSSSSkkk...', '.kkSSkkkkkkkkkkkkkkkkkkkkSSkk.', 'kSSkbbbbbbBbbbbbbbbBbbbbbbkSSk',
      'kSkbbBbbbbbbbbBbbbbbbbbBbbbkSk', 'kSSkbbbbbbbbbbbbbbbbbbbbbbkSSk', 'ksSSkkkkkkkkkkkkkkkkkkkkkkSSsk', 'kssSSSsSSSsSSSsSSSsSSSsSSSssk.',
      '.kksssssssssssssssssssssskk...', '...kkkkkkkkkkkkkkkkkkkkkk.....',
    ], { k: PAL.stoneDeep, S: PAL.stoneLight, s: PAL.stone, b: PAL.water, B: PAL.waterLight }, 1, 15);
    // water arcs
    const W = PAL.waterLight;
    if (f) { px(c, W, 11, 3, 2, 1); px(c, W, 9, 5, 1, 3); px(c, W, 19, 3, 2, 1); px(c, W, 22, 5, 1, 3); px(c, '#ffffff', 15, 0, 2, 2); }
    else { px(c, W, 10, 4, 2, 1); px(c, W, 8, 6, 1, 4); px(c, W, 20, 4, 2, 1); px(c, W, 23, 6, 1, 4); px(c, '#ffffff', 15, 1, 2, 2); }
  });
  fountain('fountain-0', 0); fountain('fountain-1', 1);
  T('bench', 22, 12, [
    '.kkkkkkkkkkkkkkkkkkkk.', 'kwwwwwwwwwwwwwwwwwwwwk', 'kllllllllllllllllllllk', 'kkkkkkkkkkkkkkkkkkkkkk', 'kwwwwwwwwwwwwwwwwwwwwk',
    'kllllllllllllllllllllk', 'kkkkkkkkkkkkkkkkkkkkkk', '.kk................kk.', '.kk................kk.', '.kk................kk.', '.kk................kk.', '......................',
  ], { k: PAL.woodDark, w: PAL.woodLight, l: PAL.wood });
  const stall = (key, a, b) => T(key, 26, 26, [
    '.kkkkkkkkkkkkkkkkkkkkkkkk.', 'kaaabbbaaabbbaaabbbaaabbbk', 'kaaabbbaaabbbaaabbbaaabbbk', 'kaaabbbaaabbbaaabbbaaabbbk',
    '.kakkbkakkbkakkbkakkbkakk.', '..k.k...k.k...k.k...k.k...', '..k......................k', '..k......................k',
    '..k......................k', '..k......................k', '..k......................k', '..k......................k',
    '.kkkkkkkkkkkkkkkkkkkkkkkkk', '.kwwwwwwwwwwwwwwwwwwwwwwwk', '.kllllllllllllllllllllllk.', '.kwwwwwwwwwwwwwwwwwwwwwwwk',
    '.kllllllllllllllllllllllk.', '.kwwwwwwwwwwwwwwwwwwwwwwwk', '.kkkkkkkkkkkkkkkkkkkkkkkkk', '..kk..................kk..',
    '..kk..................kk..', '..kk..................kk..', '..........................', '..........................', '..........................', '..........................',
  ], { k: PAL.woodDark, a, b, w: PAL.woodLight, l: PAL.wood });
  stall('stall-juice', PAL.peach, '#fbf4df');
  stall('stall-icecream', PAL.blue, '#fbf4df');
  stall('stall-flowers', PAL.rose, '#fbf4df');
  T('umbrella', 20, 26, [
    '.......kkkkkk.......', '....kkaabbaabbkk....', '..kkaabbaabbaabbkk..', '.kaabbaabbaabbaabbk.', 'kaabbaabbaabbaabbaak',
    'kkkkkkkkkkkkkkkkkkkk', '.........kk.........', '.........kk.........', '.........kk.........', '.........kk.........',
    '.........kk.........', '.........kk.........', '..kkkkkkkkkkkkkkkk..', '..kwwwwwwwwwwwwwwk..', '..kkkkkkkkkkkkkkkk..',
    '...kk..........kk...', '...kk..........kk...', '...kk..........kk...', '....................', '....................',
    '....................', '....................', '....................', '....................', '....................', '....................',
  ], { k: PAL.woodDark, a: PAL.peachDark, b: '#fbf4df', w: PAL.woodLight });
  T('weight-bench', 22, 14, [
    'kk..................kk', 'kmk................kmk', 'kmkkkkkkkkkkkkkkkkkkmk', 'kmk................kmk', 'kk..................kk',
    '.....kkkkkkkkkkkk.....', '....kRRRRRRRRRRRRk....', '....kkkkkkkkkkkkkk....', '.....k..........k.....', '.....k..........k.....',
    '.....k..........k.....', '....kkk........kkk....', '......................', '......................',
  ], { k: PAL.stoneDeep, m: PAL.stoneDark, R: PAL.roseDark });
  T('sign-board', 18, 14, [
    '.kkkkkkkkkkkkkkkk.', 'kwwwwwwwwwwwwwwwwk', 'kwccccccccccccccwk', 'kwccccccccccccccwk', 'kwccccccccccccccwk', 'kwccccccccccccccwk',
    'kwccccccccccccccwk', 'kwccccccccccccccwk', 'kwccccccccccccccwk', 'kwccccccccccccccwk', 'kwwwwwwwwwwwwwwwwk', '.kkkkkkkkkkkkkkkk.', '........kk........', '........kk........',
  ], { k: PAL.woodDark, w: PAL.wood, c: PAL.cream });
  T('track-cone', 6, 7, ['..k...', '.kok..', '.kwk..', 'kooOk.', 'kwwwk.', 'kkkkkk', '......'], { k: PAL.peachDark, o: PAL.peach, O: PAL.peachLight, w: '#fbf4df' });

  // ---------- icons (signs and thought bubbles) ----------
  T('icon-coffee', 11, 10, ['...s.s.....', '..s.s......', '...........', 'kkkkkkkk...', 'kcccccckkk.', 'kcwwwwck.k.', 'kcwwwwckkk.', 'kcwwwwck...', '.kkkkkk....', 'kkkkkkkkk..'],
    { k: PAL.woodDark, c: '#fbf4df', w: PAL.woodMid, s: PAL.stoneLight });
  T('icon-croissant', 12, 8, ['....kkkk....', '..kkOOOOkk..', '.kOOoOOoOOk.', 'kOoOOoOOoOOk', 'kOOoOOoOOoOk', '.kkOOoOOoOkk', '...kkkkkkk..', '............'],
    { k: PAL.peachDark, O: PAL.goldLight, o: PAL.goldDark });
  T('icon-meal', 13, 10, ['....s..s.....', '.....s..s....', '...kkkkkk....', '..kgyyrryk...', '.kgyyyrrryk..', '.kyyggyyyyk..', 'kkkkkkkkkkkk.', 'kpppppppppppk', '.kkkkkkkkkkk.', '.............'],
    { k: PAL.stoneDark, p: PAL.stoneLight, y: PAL.yellow, g: PAL.leafMid, r: PAL.roseDark, s: PAL.stoneLight });
  T('icon-icecream', 8, 12, ['..kkkk..', '.kppppk.', 'kpPppppk', 'kppppPpk', '.kkkkkk.', '.kwowow.', '.kowowk.', '..kwok..', '..kowk..', '...kk...', '...k....', '........'],
    { k: PAL.peachDark, p: PAL.rose, P: PAL.roseLight, w: PAL.goldLight, o: PAL.goldDark });
  T('icon-forkknife', 11, 11, ['.k.k.k...k.', '.k.k.k..kk.', '.k.k.k..kk.', '.kkkkk..kk.', '..kkk...kk.', '...k....kk.', '...k.....k.', '...k.....k.', '...k.....k.', '...k.....k.', '...........'],
    { k: PAL.stoneDeep });
  T('icon-dumbbell', 13, 7, ['kk.......kk..', 'kmk.....kmk..', 'kmkkkkkkkmk..', 'kmk.....kmk..', 'kk.......kk..', '.............', '.............'], { k: PAL.stoneDeep, m: PAL.stoneDark });
  T('icon-shoe', 11, 7, ['....kkk....', '...kwwwk...', '..kwrwwkkk.', 'kkwwwwwwwwk', 'kwwwwwwwwwk', 'kkkkkkkkkkk', '...........'], { k: PAL.blueDark, w: PAL.blueLight, r: PAL.roseDark });
  T('icon-paw', 9, 9, ['.k..k....', 'kkkkkk...', '.k..k.k..', '.......kk', '..kkk..k.', '.kkkkk...', '.kkkkk...', '..kkk....', '.........'], { k: PAL.woodDark });
  T('icon-book', 11, 9, ['.kkkk.kkkk.', 'krrrrkbbbbk', 'krwwrkbwwbk', 'krrrrkbbbbk', 'krwwrkbwwbk', 'krrrrkbbbbk', 'kkkkkkkkkkk', '...........', '...........'],
    { k: PAL.woodDark, r: PAL.roseDark, b: PAL.blueDark, w: '#fbf4df' });
  T('icon-fish', 12, 7, ['....kkkk..k.', '..kkbbbbkkk.', '.kbbBbbbbbk.', 'kbebbbbbbbkk', '.kbbbbbbbbk.', '..kkbbbbkkk.', '....kkkk..k.'], { k: PAL.blueDark, b: PAL.blue, B: PAL.blueLight, e: INK });
  T('icon-chat', 11, 8, ['.kkkkkkkk..', 'kwwwwwwwwk.', 'kwkwkwkwwk.', 'kwwwwwwwwk.', '.kkkwkkkk..', '...kwk.....', '...kk......', '...........'], { k: PAL.ink, w: '#fbf4df' });
  T('icon-flower', 9, 10, ['..k.k....', '.kpkpk...', 'kpPyPpk..', '.kpkpk...', '..kgk....', '...g.l...', '..lg.l...', '...gl....', '...g.....', '.........'],
    { k: PAL.violetDark, p: PAL.violet, P: PAL.violetLight, y: PAL.goldLight, g: PAL.leaf, l: PAL.leafMid });
}
