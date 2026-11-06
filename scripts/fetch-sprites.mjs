// Downloads the curated set of LPC (Liberated Pixel Cup) parts used by the avatar builder,
// plus their palettes and credits. Output: extension/sprites/
//   sprites/<lpc path>/<anim>.png   source sheets (base palette colors)
//   sprites/catalog.json            parts, layer order, paths per body type, recolor info
//   sprites/palettes.json           body / hair / cloth / eye palettes
//   sprites/credits.json            attribution required by CC-BY-SA / OGA-BY / GPL
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'extension', 'sprites');
const REPO = 'https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master';
const ANIMS = ['idle', 'sit', 'walk', 'run', 'jump', 'spellcast'];
const BODIES = ['male', 'female'];

// slot -> [id, sheet definition path]
const PARTS = {
  body: [['body', 'body/body.json']],
  head: [['head', null]], // resolved per body type below
  face: [
    ['neutral', 'head/faces/face_neutral.json'],
    ['happy', 'head/faces/face_happy.json'],
    ['sad', 'head/faces/face_sad.json'],
    ['shock', 'head/faces/face_shock.json'],
    ['closed', 'head/faces/face_closed.json'],
  ],
  hair: [
    ['plain', 'hair/short/hair_plain.json'],
    ['messy', 'hair/short/hair_messy1.json'],
    ['pixie', 'hair/short/hair_pixie.json'],
    ['buzzcut', 'hair/bald/hair_buzzcut.json'],
    ['spiked', 'hair/spiky/hair_spiked.json'],
    ['bob', 'hair/bob/hair_bob.json'],
    ['curly', 'hair/curly/hair_curly_short.json'],
    ['afro', 'hair/afro/hair_afro.json'],
    ['ponytail', 'hair/braids/hair_ponytail.json'],
    ['long', 'hair/long/hair_long.json'],
  ],
  shirt: [
    ['tshirt', 'torso/shirts/shortsleeve/torso_clothes_tshirt.json'],
    ['longsleeve', 'torso/shirts/longsleeve/torso_clothes_longsleeve.json'],
  ],
  legs: [
    ['pants', 'legs/pants/legs_pants.json'],
    ['shorts', 'legs/shorts/legs_shorts.json'],
    ['skirt', 'legs/skirts/legs_skirts_plain.json'],
  ],
  shoes: [['basic', 'feet/shoes/feet_shoes_basic.json']],
  // unlockable cosmetics (game rewards)
  hat: [
    ['bandana', 'headwear/coverings/bandana/hat_bandana.json'],
    ['headband', 'headwear/coverings/headbands/hat_headband_thick.json'],
    ['bowler', 'headwear/hats/formal/hat_formal_bowler.json'],
    ['tophat', 'headwear/hats/formal/hat_formal_tophat.json'],
    ['elf', 'headwear/hats/holiday/hat_holiday_elf.json'],
    ['santa', 'headwear/hats/holiday/hat_holiday_santa.json'],
    ['wizard', 'headwear/hats/magic/hat_magic_wizard.json'],
    ['tiara', 'headwear/hats/formal/hat_formal_tiara.json'],
    ['crown', 'headwear/hats/formal/hat_formal_crown.json'],
  ],
  glasses: [
    ['round', 'headwear/accessories/glasses/facial_glasses_round.json'],
    ['nerd', 'headwear/accessories/glasses/facial_glasses_nerd.json'],
    ['sunglasses', 'headwear/accessories/glasses/facial_glasses_sunglasses.json'],
  ],
};
const HEADS = { male: 'head/heads/human/heads_human_male.json', female: 'head/heads/human/heads_human_female.json' };

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
async function download(rel) {
  const dest = path.join(OUT, rel);
  try { await fs.access(dest); return true; } catch {}
  const r = await fetch(`${REPO}/spritesheets/${rel}`);
  if (!r.ok) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.slice(1, 4).toString() !== 'PNG') return false;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  return true;
}

function materialOf(recolors) {
  // "recolors" is either {material, palettes} or {color_1: {...}, color_2: {...}}
  if (!recolors) return [];
  if (recolors.material) return [recolors.material];
  return Object.keys(recolors).sort().map((k) => recolors[k].material);
}

const catalog = { frame: 64, anims: {}, slots: {} };
const credits = new Map();

function addCredits(def, usedPaths) {
  for (const c of def.credits || []) {
    if (!usedPaths.some((p) => p.startsWith(c.file) || c.file.startsWith(p.replace(/\/$/, '')))) continue;
    const key = c.file;
    if (!credits.has(key)) credits.set(key, { file: c.file, authors: c.authors, licenses: c.licenses, urls: c.urls });
  }
}

async function resolvePart(slot, id, defPath, body) {
  const def = await getJson(`${REPO}/sheet_definitions/${defPath}`);
  let dir = def.layer_1?.[body];
  if (!dir) return null;
  dir = dir.replace('${head}', body); // faces: head/faces/${head}/happy/
  const anims = [];
  for (const a of ANIMS) if (await download(`${dir}${a}.png`)) anims.push(a);
  if (!anims.length) return null;
  addCredits(def, [dir]);
  return { def, dir, anims };
}

await fs.mkdir(OUT, { recursive: true });
for (const [slot, list] of Object.entries(PARTS)) {
  catalog.slots[slot] = [];
  for (const [id, defPath] of list) {
    const entry = { id, name: null, zPos: 0, materials: [], paths: {} };
    for (const body of BODIES) {
      const dp = slot === 'head' ? HEADS[body] : defPath;
      const res = await resolvePart(slot, id, dp, body);
      if (!res) { console.warn(`  skip ${slot}/${id} for ${body}`); continue; }
      entry.name = slot === 'head' ? 'Human' : res.def.name;
      entry.zPos = res.def.layer_1.zPos;
      entry.materials = materialOf(res.def.recolors);
      if (slot === 'body') entry.materials = ['body'];
      entry.paths[body] = { dir: res.dir, anims: res.anims };
      console.log(`  ok ${slot}/${id} ${body}: ${res.dir} [${res.anims}]`);
    }
    if (Object.keys(entry.paths).length) catalog.slots[slot].push(entry);
  }
}

const palettes = {};
for (const m of ['body', 'hair', 'cloth', 'eye']) {
  const meta = await getJson(`${REPO}/palette_definitions/${m}/meta_${m}.json`);
  palettes[m] = { base: meta.base, colors: await getJson(`${REPO}/palette_definitions/${m}/${m}_ulpc.json`) };
}

await fs.writeFile(path.join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2));
await fs.writeFile(path.join(OUT, 'palettes.json'), JSON.stringify(palettes, null, 2));
await fs.writeFile(path.join(OUT, 'credits.json'), JSON.stringify([...credits.values()], null, 2));
console.log(`done: ${credits.size} credit entries`);
