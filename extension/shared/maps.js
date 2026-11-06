// Tile layouts for the scenes (40 x 28 tiles of 32 px). Themes reuse a layout and restyle it.
//
// Terrain:  .  ground          ,  ground variant    #  path / sidewalk / boardwalk
//           X  crosswalk       T  tree / pillar     W  water            B  building
//           R  road            F  fence / dunes     (T W B R F block walking)
// Places (walkable spots the character stands on; their prop sits on the tile above):
//           f  food stand      d  drink stand       c  cafe table       g  gym / weights
//           j  jump-rope spot  s  shop door         h  home door        m  mailbox
//           b  bench           w  water fountain    v  viewpoint        r  running-loop corner

export const COLS = 40, ROWS = 28, TILE = 32;

const PARK = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTT....BBB....TTT.......TTTT..WWWWW..TTT',
  'TT.....BBB...........g.......WWWWWWW..TT',
  'TT.....BBB....BBBB...........WWWWWWW..TT',
  'TT......h.m...BBBB.....j.....WWWWWWW..TT',
  'TT.....b.......s...........d..WWWWW.v.TT',
  'TT...r##########################r.....TT',
  'TT...#..........................#.....TT',
  'TTT..#...TTT.........,....TTT...#..b..TT',
  'TTT..#..TTTTT..............T....#.....TT',
  'TT...#...TTT....g.......,.......#.....TT',
  'TT...#..............j...........#..f..TT',
  'TT...#.....,..............TTT...#.....TT',
  'TT.c.#...........WWWW....TTTTT..#.....TT',
  'TT...#..........WWWWWW....TTT...#.....TT',
  'TT...#..........WWWWWW..........#..w..TT',
  'TT...#.....b.....WWWW.....,.....#.....TT',
  'TTT..#..........................#.....TT',
  'TTT..#....TTT..........f.....TT.#....TTT',
  'TT...#...TTTTT..............TTTT#.....TT',
  'TT...r##########################r.....TT',
  'TT.......,.....d.......c..........m...TT',
  'TT..TTT...............................TT',
  'TT.TTTTT.....j....b.......TTT.....v...TT',
  'TT..TTT................g.....TTTTT....TT',
  'TTT.........TTT................TTT..TTTT',
  'TTTTT....TTTTTTTTT.......TTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

const URBAN = [
  'BBBBBBBBBBB.BBBBBBBBBBBBB.BBBBBBBBBBBBBB',
  'BBBBBBBBBBB.BBBBBBBBBBBBB.BBBBBBBBBBBBBB',
  'BBBBBBBBBBB.BBBBBBBBBBBBB.BBBBBBBBBBBBBB',
  'BBBB.BBBBBB.BBBBBB.BBBBBB.BBBBB.BBBBBBBB',
  '..h..s..f.....d..c..s.......h...g..m....',
  '########################################',
  'RRRRXRRRRRRRRRRRRRRRRXRRRRRRRRRRRRRXRRRR',
  'RRRRXRRRRRRRRRRRRRRRRXRRRRRRRRRRRRRXRRRR',
  '########################################',
  '..b......T....T.....j.......T...b.......',
  '....r###########################r.......',
  '..T.#...,,,,,,......WWWW........#,,..T..',
  '....#...,,T,,,.....WWWWWW.......#T,.....',
  '..c.#...,,,,,,.....WWWWWW.......#,,..f..',
  '....#......g........WWWW........#...w...',
  '....r######################v####r.......',
  '..b.......T......j.......T.......b......',
  '########################################',
  'RRRRXRRRRRRRRRRRRRRRRXRRRRRRRRRRRRRXRRRR',
  'RRRRXRRRRRRRRRRRRRRRRXRRRRRRRRRRRRRXRRRR',
  '########################################',
  '..f...........d.........c.........b.....',
  '....T.....j......T..........g......T....',
  '..T.......,,,,,,.......T.......,,,......',
  '......b...,,g,,,..............,,j,..m...',
  '..T.......,,,,,,....T....v........T.....',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

const BEACH = [
  'FFBBBBBFFBBBBBBFFFBBBBBFFFBBBBBBFFBBBBFF',
  'FFBBBBBFFBBBBBBFFFBBBBBFFFBBBBBBFFBBBBFF',
  'F.BBBBB..BBBBBB...BBBBB...BBBBBB..BBBB.F',
  'F...h......s........f.......s....d...m.F',
  'F######################################F',
  'F.....b........d.......c.........b.....F',
  'F..T.......,........T..........T.......F',
  'F.....r#####################r......v...F',
  'F.....#....T.....g..........#......T...F',
  'F....T#.....................#....T.....F',
  'F.....#...j.........T.......#f.........F',
  'F...c.#.....................#...w......F',
  'F.....#T.........T.......g..#....T.....F',
  'F.....r#####################r..........F',
  'F..T..........b.........T.......j......F',
  'F.........,............................F',
  'F....d.........T...........b.......T...F',
  'F......................................F',
  'F.......T..........v.............T.....F',
  'F......................................F',
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

export const LAYOUTS = { park: PARK, urban: URBAN, beach: BEACH };
export const BLOCKING = new Set(['T', 'W', 'B', 'R', 'F']);
export const PLACE_KINDS = new Set(['f', 'd', 'c', 'g', 'j', 's', 'h', 'm', 'b', 'w', 'v', 'r']);
// Places whose prop stands on the tile above (and blocks it).
export const PROP_ABOVE = new Set(['f', 'd', 'g', 'm', 'b', 'w', 'v']);

/** Parses a layout into a grid plus the list of places. Rows are padded/trimmed to size. */
export function parseLayout(name) {
  const src = LAYOUTS[name] || PARK;
  const fill = src[0][0];
  const rows = Array.from({ length: ROWS }, (_, y) => (src[y] || fill.repeat(COLS)).padEnd(COLS, fill).slice(0, COLS));
  const grid = rows.map((r) => r.split(''));
  const places = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const ch = grid[y][x];
    if (!PLACE_KINDS.has(ch)) continue;
    const above = y > 0 ? grid[y - 1][x] : 'T';
    places.push({ kind: ch, tx: x, ty: y, x: x * TILE + 16, y: y * TILE + 24, onBuilding: above === 'B' });
  }
  const blocked = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (BLOCKING.has(grid[y][x])) blocked[y * COLS + x] = 1;
  for (const p of places) if (PROP_ABOVE.has(p.kind) && !p.onBuilding && p.ty > 0) blocked[(p.ty - 1) * COLS + p.tx] = 1;
  return { grid, places, blocked };
}
