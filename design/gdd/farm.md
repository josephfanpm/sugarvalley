# Farm: Restorables, Chores, Cooking

Rules live in `src/data/valley-rules.js` (shared by server and demo). Costs in `src/data/balance.js`.

## Restore order (NEXT box suggests in this order)

| # | Restorable | Cost | Needs | Unlocks |
|---|---|---|---|---|
| 1 | Footbridge | 150 | — | East meadow and the cow (milk) |
| 2 | Chicken coop | 200 | — | Eggs every day |
| 3 | Veggie patch | 200 | — | Wheat + eggplant, ripen with in-range time |
| 4 | Campfire kitchen | 300 | — | Cooking |
| 5 | Lantern path | 250 | — | Light at night |
| 6 | Cow pasture | 250 | Footbridge | Twice the milk |
| 7 | Apple orchard | 350 | Footbridge | Apples, ripen with in-range time |
| 8 | Pond dock | 300 | — | A walkable spot on the pond |

Total 2,000 sunlight ≈ 9–12 days for someone around 70% in range. Weekly goals, journal and cooking
add a little on top.

## Daily chores (once per day each)

| Chore | Needs | Gives | Ripens with in-range time? |
|---|---|---|---|
| Collect eggs | Coop | 3 eggs | — |
| Milk the cow | Footbridge (pasture doubles) | 1–2 milk | — |
| Harvest the veggie patch | Patch | 2 wheat, 1 eggplant | Yes: 72 in-range readings today (6 h) |
| Pick apples | Orchard | 2 apples | Yes |

Crop stages on the patch show ripeness live, so in-range time visibly grows the food.

## Cooking

The campfire suggests a new recipe first, else the first you can make. Each dish adds 5 sunlight
(first 3 a day); a new recipe adds 20 once. Recipes: pancakes, apple pie, omelette, roasted eggplant,
bread, warm apple cider, warm milk.

**Why rewards here are small:** sunlight must come mostly from readings (pillar 2). Daily chores and
cooking give a reason to come back and something to do, capped so they can never outpace time in range.
