# Game Concept: Sugar Valley

*Rigor: minimal. Owner: Joseph. Last updated: 2026-11-06.*

## Elevator Pitch

A cozy village-restoration game for people with type 1 diabetes. Every CGM reading in range
brings a little sunlight back to a faded valley. You spend that sunlight to restore the village,
and each day's glucose curve grows a one-of-a-kind plant in your Garden of Days.

## Core Identity

- **Genre:** cozy life sim / restoration, top-down pixel art
- **Platform:** web app (installable PWA), phone first, works on desktop
- **Audience:** people of all ages with T1D, plus friends and family who visit
- **Session:** 2–5 minutes a day of active play; the world advances from real data

## Core Fantasy

"Taking care of my diabetes makes something beautiful grow." The work is invisible in real life.
Here it becomes a place you can walk through.

## Unique Hook

**The Garden of Days.** At the end of each day, that day's CGM curve grows a plant. Stem shape
follows the curve, bloom size follows time in range, and rough days still grow something hardy.
Months of care become a garden you can walk through and show your care team.

## Core Loop

- **Passive (real time):** each in-range reading = 1 Sunlight (max 288/day). Coming back into range
  quickly after a high or low adds a Recovery bonus. A low never earns anything.
- **Moment to moment (30 s):** walk the valley, collect Sunlight that has gathered at the well,
  greet villagers, water today's sprout.
- **Session (2–5 min):** spend Sunlight to restore one thing (a bridge, a cottage, a lantern
  row). It fades back into color with a small celebration.
- **Daily:** chores (eggs, milk, harvest, apples) and cooking at the campfire. Crops ripen with
  in-range time. A morning recap shows yesterday's plant; the Garden Journal records what helped.
- **Week:** Maple gives a pattern goal based on your own data ("3 steady mornings").
- **Living character:** when you stop moving them, your character acts out your blood sugar (petting
  animals and cooking in range, snacking when low, jogging when high, treating when urgent, napping
  when there's no data). Visitors see them walking around.
- **Month:** a festival (Lantern Night, Harvest Fair) decorates the whole valley.
- **Long term:** unlock districts (Forest hamlet → Beach cove → Town square → Snow village → Night
  market), fill the garden, collect outfits and decor.

## Game Pillars

1. **Care, not score.** The game reflects effort kindly. Nothing decays, nothing is lost.
2. **Your data is the world.** Almost every reward traces back to a real reading. Chores, cooking
   and journaling add small, daily-capped extras, never enough to outpace time in range.
3. **Cozy over clinical.** No graphs in the world view. Numbers live behind one tap.
4. **Safety first, always.** Urgent states show a banner that always wins. See `safety.md`.

### Anti-Pillars

- Not a medical device. No dosing advice, no alerts.
- No punishment: no lost streaks, no withering, no shame copy.
- No pay-to-win, no ads, no energy timers outside real data.
- No combat.

## Target Player

All ages. Kids play with parents; teens and adults play on their own. Text is short and readable
at a glance; everything important is also shown with icons.

## MVP

The **Forest hamlet**: restore 3 things, Garden of Days working, Sunlight from real or demo CGM,
one villager with pattern quests, day/night from the local clock, friend-visit link.

## Risks

- **Art breadth:** the free Sprout Lands pack is small. Mitigation: build missing pieces in its
  palette, buy the Premium pack later if the game ships commercially (Basic is non-commercial).
- **Motivation backfire:** rewards could pressure people on hard days. Mitigation: `safety.md`.
- **Audio:** no audio in the pack. Interim: synthesized SFX; music from a CC0 pack later.
