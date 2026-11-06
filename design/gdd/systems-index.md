# Systems Index: Sugar Valley

| # | System | Layer | Priority | Doc | Status |
|---|---|---|---|---|---|
| 1 | CGM data (connectors, poller) + valley state API | Foundation | MVP | `server/valley.js` | Built |
| 2 | Safety rules | Foundation | MVP | `safety.md` | Designed |
| 3 | World rendering (tiles, depth, light, weather) | Foundation | MVP | `art-bible.md` | Slice built |
| 4 | Player & movement (keyboard, tap-to-move) | Core | MVP | — | Slice |
| 5 | Sunlight economy | Core | MVP | `sunlight.md` | Designed |
| 6 | Restoration (faded → restored objects) | Core | MVP | `sunlight.md` | Slice |
| 7 | Garden of Days | Feature | MVP | `garden-of-days.md` | Slice |
| 8 | Villagers & pattern quests | Feature | MVP | `quests-journal.md` | Built (Maple) |
| 9 | Day/night & weather from local clock | Presentation | MVP | `art-bible.md` | Slice |
| 10 | HUD & menus | Presentation | MVP | `art-bible.md` | Slice |
| 11 | Audio (SFX, ambience, music) | Polish | MVP | — | Built (CC0 + synth) |
| 12 | Visitors (share link, gifts) + account setup | Feature | MVP | `visitors.md` | Built |
| 13 | Festivals | Feature | Post-MVP | — | Not started |
| 14 | Districts 2–5 | Content | Post-MVP | — | Not started |
| 15 | Migration from Sugar Peek rewards | Foundation | MVP | — | Not started |
| 16 | Farm: restorables, chores, cooking | Core | MVP | `farm.md` | Built |
| 17 | Garden Journal, comebacks, streak, recap | Feature | MVP | `quests-journal.md` | Built |
| 18 | Living character (autopilot) | Presentation | MVP | `src/world/autopilot.js` | Built |
| 20 | Cottage interior (ribbons, dishes) | Feature | MVP | `src/scenes/Interior.js` | Built |
| 21 | Music (CC0) | Polish | MVP | `assets/audio/CREDITS.md` | Built |
| 22 | Town (shops, plaza, gym, track, dog park, townsfolk, dog) | Content | MVP | `town.md` | Built |
| 23 | 33 automatic actions by glucose state | Presentation | MVP | `town.md` | Built |
| 19 | Sign in with Google / Apple | Foundation | MVP | `server/auth.js` | Built (needs client IDs) |

## Build order

Quality slice (3, 4, 6, 7, 9, 10, 11 on one screen) → approval → vertical slice (adds 1, 5, 8 with
real data) → full game.
