# Town & Automatic Actions

The map now runs 44 × 58 tiles: the Forest hamlet in the north, the town to the south down Main Street.
Code: `src/world/town.js` (places, townsfolk, dog), `src/world/town-art.js` (sprites),
`src/world/autopilot.js` (what the character does).

## Places

| Place | What's there |
|---|---|
| The Sunny Cup (coffee shop) | Cocoa and croissants at the umbrella tables; Pip the barista |
| Rise & Shine Bakery | Fresh bread; Juniper the baker |
| Valley Kitchen (restaurant) | Full meals at the umbrella tables; Basil the chef |
| Fountain plaza | Fountain (make a wish), benches, lamps |
| Market | Juice stand (Mo), ice cream stand, flower stall (Fern) |
| Steady Strength Gym | Weight bench outside; Coach Rowan |
| Running track | Oval track with cones; a jogger always running laps |
| Dog park | Fenced, at the bottom of town |
| Dog house | Next to the veggie patch; the dog follows you everywhere |

## Automatic actions (33)

After 7 idle seconds the owner's character takes over (any input hands control back); visitors
always see Sam doing these. The NEXT box says what's happening ("Lifting at Steady Strength Gym").

**In range: real work first (owner only, earns sunlight)**
1. Collect sunlight at the Sun Well (when 15+ is waiting, or gifts)
2. Collect eggs · 3. Milk the cow · 4. Harvest the veggie patch · 5. Pick apples
6. Cook at the campfire (up to 3 dishes a day) · 7. Water today's sprout

**In range: in between**
8. Pet a chicken or the cow · 9. Play fetch with the dog · 10. Tend the Garden of Days
11. Admire the sunflowers · 12. Watch the pond · 13. Fish off the dock · 14. Chat with townsfolk
15. Sit by the fountain · 16. Read on a bench · 17. Pick out flowers · 18. Say hi to Maple
19. Visit the chickens · 20. Take a stroll

**Low: eat until back in range** (each lasts until the reading returns to range)
21. Cocoa and a croissant at The Sunny Cup · 22. A meal at Valley Kitchen · 23. A snack at the bakery
24. Juice at the stand · 25. An ice cream · 26. A snack at home

**High: move to bring it down**
27. Lift at the gym · 28. Run laps at the track · 29. Walk the dog (on a leash, to the dog park)
30. Yoga in the park · 31. Water at the fountain · 32. Walk around the pond · 33. Stretch by the gym

**Urgent and no data** (unchanged): treat a low at home with juice; rest with water when urgently
high; nap by the cottage when there's no recent reading.

## Safety notes

- These are what the *character* does, not advice. No copy tells the player what to eat or do.
- Real tasks only collect what readings earned (sunlight) or the capped farm extras; the autopilot
  never spends sunlight.
- Urgent states still override everything (safety.md #2).
