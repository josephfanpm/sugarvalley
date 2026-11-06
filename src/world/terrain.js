// Terrain for the valley: the Forest hamlet (north) and the town (south). Land/water grid and blob
// autotiling for Sprout Lands Grass.png.
export const TILE = 16;
export const COLS = 44, ROWS = 58;

// mask (N1 E2 S4 W8 NE16 SE32 SW64 NW128, corners only when both sides set) -> Grass.png index.
// Derived by sampling the edge and corner pixels of each tile for opacity.
const GRASS = {0:36,1:25,2:33,3:37,4:3,5:14,6:4,7:48,8:35,9:40,10:34,11:41,12:7,13:51,14:8,15:52,19:22,23:15,27:39,31:42,38:0,39:26,46:6,47:31,55:11,63:50,76:2,77:29,78:5,79:32,95:9,110:1,111:30,127:28,137:24,139:38,141:18,143:43,155:23,159:19,175:20,191:17,205:13,207:49,223:16,239:27,255:12};
const FULL_VARIANTS = [12, 12, 12, 12, 12, 12, 55, 56, 57, 66, 67, 68, 58, 69, 70];

/** Water layout: a stream down the east side, a pond in the north-east, a small pond west. */
export function buildWater() {
  const water = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  for (let y = 0; y < ROWS; y++) {
    const cx = 31 + Math.round(1.6 * Math.sin((y - 15) / 3.6));
    for (let x = cx - 1; x <= cx + 1; x++) water[y][x] = true;
  }
  const ellipse = (cx, cy, rx, ry) => {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) water[y][x] = true;
    }
  };
  ellipse(34.5, 5.5, 4.2, 2.6);
  ellipse(21.5, 22.5, 3.3, 2.3);
  return water;
}

/** Dirt paths painted with a round brush along polylines (tile coords), plus the well plaza. */
export function buildPaths(water) {
  const path = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const brush = (cx, cy, r) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (y < 0 || x < 0 || y >= ROWS || x >= COLS || water[y][x]) continue;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) path[y][x] = true;
    }
  };
  const line = (pts, r = 0.7) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
      for (let k = 0; k <= n; k++) brush(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r);
    }
  };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (((x + 0.5 - 16.5) / 2.7) ** 2 + ((y + 0.5 - 12.9) / 1.9) ** 2 <= 1) path[y][x] = true;
  }
  line([[16.5, 8.6], [16.5, 11]], 0.8);
  line([[18.5, 13.6], [21.5, 14.8], [25, 15.5], [29, 15.5]]);
  line([[14, 13.8], [11.5, 15], [9, 16.5]]);
  line([[14.2, 12], [11.5, 10.8], [8.5, 9.6]], 0.6);
  line([[33.5, 15.5], [36, 16], [38.5, 17.5]], 0.6);
  // ---- Town (south) ----
  line([[15.6, 14.6], [15.6, 20], [15.4, 26], [15.5, 34]], 0.85); // main street from the hamlet
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    // town plaza around the fountain
    if (((x + 0.5 - 15.5) / 9.4) ** 2 + ((y + 0.5 - 37.6) / 3.8) ** 2 <= 1) path[y][x] = true;
    // running track: an oval ring with grass inside
    const d = ((x + 0.5 - 11) / 7) ** 2 + ((y + 0.5 - 51.5) / 3.6) ** 2;
    const di = ((x + 0.5 - 11) / 5.2) ** 2 + ((y + 0.5 - 51.5) / 2.1) ** 2;
    if (d <= 1 && di > 1) path[y][x] = true;
  }
  line([[15.5, 41], [15.5, 45.5], [19.5, 46.5], [24, 50.4]], 0.75); // to the gym
  line([[15.5, 45.5], [12, 47.6]], 0.7); // to the track
  line([[24, 50.4], [24, 52]], 0.6); // dog park gate
  // Smooth: grass tiles mostly surrounded by path become path (no one-tile bumps).
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      if (path[y][x] || water[y][x]) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => path[y + dy][x + dx]).length;
      if (n >= 3 || (n === 2 && ((path[y][x - 1] && path[y][x + 1]) || (path[y - 1][x] && path[y + 1][x])))) path[y][x] = true;
    }
  }
  return path;
}

/** Land tiles reachable from the east edge without crossing water. */
export function floodEast(water) {
  const east = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const q = [];
  for (let y = 0; y < ROWS; y++) if (!water[y][COLS - 1]) { east[y][COLS - 1] = true; q.push([COLS - 1, y]); }
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || east[ny][nx] || water[ny][nx]) continue;
      east[ny][nx] = true; q.push([nx, ny]);
    }
  }
  return east;
}

export function grassIndex(water, x, y, rnd, path) {
  const land = (xx, yy) => xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS || (!water[yy][xx] && !path?.[yy][xx]);
  if (!land(x, y)) return -1;
  let m = 0;
  if (land(x, y - 1)) m |= 1;
  if (land(x + 1, y)) m |= 2;
  if (land(x, y + 1)) m |= 4;
  if (land(x - 1, y)) m |= 8;
  if (m & 1 && m & 2 && land(x + 1, y - 1)) m |= 16;
  if (m & 4 && m & 2 && land(x + 1, y + 1)) m |= 32;
  if (m & 4 && m & 8 && land(x - 1, y + 1)) m |= 64;
  if (m & 1 && m & 8 && land(x - 1, y - 1)) m |= 128;
  if (m === 255) return FULL_VARIANTS[Math.floor(rnd() * FULL_VARIANTS.length)];
  return GRASS[m] ?? 12;
}

export function rng(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
