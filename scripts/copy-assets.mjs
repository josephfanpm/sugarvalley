// Copies the Sprout Lands sheets the game uses from the raw pack (gitignored) into assets/art/
// with stable kebab-case names. Run: npm run assets
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACK = path.join(ROOT, 'assets', 'Sprout Lands - Sprites - Basic pack', 'Sprout Lands - Sprites - Basic pack');
const OUT = path.join(ROOT, 'assets', 'art');

const FILES = {
  'player.png': 'Characters/Basic Charakter Spritesheet.png',
  'player-actions.png': 'Characters/Basic Charakter Actions.png',
  'chicken.png': 'Characters/Free Chicken Sprites.png',
  'cow.png': 'Characters/Free Cow Sprites.png',
  'egg-nest.png': 'Characters/Egg_And_Nest.png',
  'tools.png': 'Characters/Tools.png',
  'nature.png': 'Objects/Basic_Grass_Biom_things.png',
  'plants.png': 'Objects/Basic_Plants.png',
  'furniture.png': 'Objects/Basic_Furniture.png',
  'items.png': 'Objects/Basic_tools_and_meterials.png',
  'chest.png': 'Objects/Chest.png',
  'coop.png': 'Objects/Free_Chicken_House.png',
  'paths.png': 'Objects/Paths.png',
  'bridge.png': 'Objects/Wood_Bridge.png',
  'milk-grass.png': 'Objects/Simple_Milk_and_grass_item.png',
  'grass.png': 'Tilesets/Grass.png',
  'hills.png': 'Tilesets/Hills.png',
  'water.png': 'Tilesets/Water.png',
  'soil.png': 'Tilesets/Tilled_Dirt.png',
  'fences.png': 'Tilesets/Fences.png',
  'doors.png': 'Tilesets/Doors.png',
  'house.png': 'Tilesets/Wooden House.png',
  'house-roof.png': 'Tilesets/Wooden_House_Roof_Tilset.png',
  'house-walls.png': 'Tilesets/Wooden_House_Walls_Tilset.png',
};

if (!fs.existsSync(PACK)) {
  console.error(`Sprout Lands pack not found at:\n  ${PACK}\nDownload the Basic pack from https://cupnooble.itch.io/sprout-lands-asset-pack and unzip it into assets/.`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
for (const [name, rel] of Object.entries(FILES)) fs.copyFileSync(path.join(PACK, rel), path.join(OUT, name));
console.log(`Copied ${Object.keys(FILES).length} sheets to assets/art/`);
