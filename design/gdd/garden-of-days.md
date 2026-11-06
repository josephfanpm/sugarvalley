# Garden of Days

One plant per scored day, planted in the garden in date order.

## Generation (deterministic from the day's readings)

| Input | Plant trait |
|---|---|
| Time in range | Bloom size and petal count (0–5) |
| Glucose curve, resampled to the stem height | Stem sway — the stem bends left/right with the curve |
| Coefficient of variation | Leaf count (steadier = fuller, tidier leaves) |
| Mean glucose | Flower hue (warm for higher, cool for lower, always a palette color) |
| Date | Random seed for small details |

- **Every day grows something.** Below the goal, the plant is a sturdy shrub or cactus, not a
  dead plant. Days without enough data leave a small stone marker instead.
- Plants are drawn at native 16-px pixel scale using only palette colors, 16×32 px.
- Today's sprout grows through the day as readings come in, then sets at midnight.

## Interaction

Walk up to a plant to see its date and a one-line summary ("Mon Nov 3 — 78% in range"). Tap for
the day's graph.
