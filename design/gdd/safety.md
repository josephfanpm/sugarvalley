# Safety Rules: Sugar Valley

*These override every other design document. Any system that conflicts with them is wrong.*

## Medical

1. **Not a medical device.** No alerts, no dosing or treatment advice, no "you should eat/bolus."
2. **Urgent states win.** Urgent low (< 55 mg/dL by default) or urgent high shows a banner that
   can't be dismissed, with a plain message ("Take care of yourself first" / "Check on Sam", plus
   Text/Call for visitors when a number was added). The game keeps running so it never feels like a
   punishment, but the character sits and treats, the goal arrow goes away,
   and jokes, gifts and prompts step aside.
3. **Stale data is never "fine."** The client re-checks this every minute itself, so a dropped
   connection can't freeze an old "in range" on screen. If the newest reading is more than 15 minutes old, nothing in
   the world says or implies the player is OK. The character naps; the HUD says when the last
   reading was.
4. **Never reward lows.** Readings below range earn 0 Sunlight. Recovery bonus is only paid when
   the player returns to range, and is capped so it can never exceed staying in range.
5. **Good day = clinical consensus.** Time in range ≥ the player's goal (default 70%) **and** time
   below range < 4%. A day with < 50% of expected readings is "not enough data" and is ignored.

## Emotional

6. **Nothing decays.** Restored things stay restored. Garden plants never wither.
7. **Streaks bend.** Missed days pause progress; they never reset it to zero.
8. **Sick-day pause.** One tap pauses quests and festivals for up to 3 days, no questions.
9. **No shame copy.** Rough days are described neutrally ("A windy day"), never as failures.
10. **Quests are goals, not instructions.** "Aim for 3 steady mornings," never "reduce your carbs."

## Privacy

11. Friend links show the valley and garden. With numbers off, visitors get no readings, no graph
    and no percentages; garden plants still grow from rounded daily values (TIR to the nearest 10%,
    mean to the nearest 20 mg/dL) so the garden can be drawn.
12. The urgent contact number is sent to visitors only while an urgent low or high is happening.
13. Visitors can't spend the owner's sunlight. Gifts are capped and blocked during urgent states.
