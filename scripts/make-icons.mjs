// Generates the toolbar icons (a pixel blood drop) as PNGs with no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'extension', 'icons');
const ART = [
  '................',
  '.......##.......',
  '......#rr#......',
  '......#rr#......',
  '.....#rrrr#.....',
  '.....#rrrr#.....',
  '....#rrrrrr#....',
  '...#rrwrrrrr#...',
  '...#rwwrrrrr#...',
  '..#rrwrrrrrrr#..',
  '..#rrrrrrrrrd#..',
  '..#rrrrrrrrrd#..',
  '...#rrrrrrdd#...',
  '....#ddddddd....',
  '.....#######....',
  '................',
];
const C = { '#': [61, 12, 18, 255], r: [224, 49, 49, 255], d: [168, 28, 36, 255], w: [255, 236, 236, 255], '.': [0, 0, 0, 0] };

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size) {
  const s = size / 16, rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) row.push(...C[ART[Math.floor(y / s)][Math.floor(x / s)]]);
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync(OUT, { recursive: true });
for (const size of [16, 32, 48, 128]) fs.writeFileSync(path.join(OUT, `icon${size}.png`), png(size));
console.log('icons written');
