# Art Bible: Sugar Valley

## 1. Visual Identity

Soft, rounded, low-contrast pixel art in the Sprout Lands style: warm, gentle, never harsh.
The bar is the polish of Stardew Valley and Sun Haven: depth, light, motion and sound on every
interaction. The look is our own, not a copy.

## 2. Mood & Atmosphere

- **Faded (unrestored):** desaturated, slightly blue, still. Quiet but never spooky.
- **Restored:** full palette, things sway and move, birds and fireflies.
- **Time of day** follows the player's clock: morning gold, midday clear, dusk amber-violet,
  night deep blue with warm window and lantern light.

## 3. Shape Language

Round everything. Pillowy tree canopies, soft rock edges, chunky outlines in a darker shade of the
fill color, never black.

## 4. Color System

- **Palette:** Sprout Lands default palette, 97 colors (`assets/.../Sprout Lands defautlt palette.png`).
  Any new pixel art uses only these colors.
- **UI:** cream panels `#f3e5c2` with brown frame `#754c60` / `#aa7959`, ink `#645552`.
- **Glucose states (UI only):** in range `#78a158`, high `#d79e61`, low `#a35b70`. Icons and
  text always accompany color.
- **Dusk grade:** multiply `#504086` at ~35%, lights add `#f2cf8c`.

## 5. Characters

- Sprout Lands base character (48×48 frame, 4 directions) is the player.
- Villagers: palette swaps and accessories on the same base until we have more art.
- Animals (chickens, cows) wander and react to the player.

## 6. Environment

- 16×16 tiles, drawn at a whole-number zoom (3× desktop, 2–4× phone by screen size).
- Autotiled grass/water edges; layered depth so the player walks behind trees and roofs.
- Every scene has motion: water frames, swaying grass, drifting particles, animals.

## 7. UI / HUD

- Pixel font **Pixelify Sans** (OFL), sized to whole-pixel multiples.
- 9-slice cream-and-brown panels drawn in palette colors, with a 1-pixel inner highlight.
- HUD: Sunlight counter (sun icon), current reading chip (tap for detail), clock. Nothing else
  on screen during play.

## 8. Asset Standards

- PNG, 16-px grid, no anti-aliasing, no scaling except whole-number zoom.
- Source pack stays in `assets/Sprout Lands - Sprites - Basic pack/` (gitignored).
  `npm run assets` copies the used sheets to `assets/art/` with stable kebab-case names.
- Credit line in game and README: "Assets — From: Sprout Lands — By: Cup Nooble".

## 9. Reference Direction

Stardew Valley (depth, interiors, lighting), Sun Haven (UI warmth, festival decoration),
Graveyard Keeper (night lighting), Sprout Lands (our base style).
