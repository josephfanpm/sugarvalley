# Sunlight Economy & Restoration

## Earning (server-side, from readings)

| Event | Sunlight |
|---|---|
| Reading in range (5-min CGM) | +1 |
| Back in range within 60 min of leaving it (high or low) | up to +6 once per excursion, never more than the readings spent out of range |
| Reading above or below range | 0 |
| Maple's weekly goal | +75 (once a week) |
| Garden Journal (first tags on a day) | +10 (once per day tagged) |
| Cooking | +5 per dish (first 3 a day), +20 for a new recipe |
| Visitor gift | +3 (first 5 a day) |

- Max from readings: 288/day. A typical 70%-TIR day earns ~200 from readings and ~30–50 from extras.
- Recovery is capped at 4 per day, and each bonus is capped at the number of out-of-range readings,
  so an excursion can never earn more than staying in range would have.
- Collecting counts readings up to the newest one received (not the clock), so delayed CGM uploads
  still count next time.
- Sunlight banks at the **Sun Well**; walking to it collects with a burst. It never expires.

## Spending (restoration)

Each restorable object has a cost and a faded/restored state. Restoring plays a 1.2 s sequence:
sparkle burst, color sweeps in from the center, object squashes and settles, chime.

The 8 restorables, their costs, requirements and unlocks are in `farm.md`.

## Tuning knobs

`SUN_PER_READING`, `RECOVERY_BONUS`, `RECOVERY_WINDOW_MIN`, `RECOVERY_DAILY_CAP`, `GOOD_DAY_BONUS`,
object costs. All in `src/data/balance.js`.
