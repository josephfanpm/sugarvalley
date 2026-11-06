# Visitors & Accounts

## Two ways to play

| | Owner (person with T1D) | Visitor (anyone with the share link) |
|---|---|---|
| How they get in | Account from `/game/setup.html`; key kept in the browser | Opens `/s/<token>`; no account |
| Character | Default colors | Light-blue tint, so it reads as a guest |
| Sun Well | Collects sunlight and gifts | Leaves a gift (flower, heart, star, sun, in turn) |
| Restorables | Spends sunlight to restore | Sees "Sam can restore this" |
| Garden | Sees date and % in range | Sees date; % only if numbers are shared |
| Today's sprout | Waters it | Looks at it |
| Reading chip + graph | Always; big graph shows 24 h | Only if numbers are shared; big graph shows 12 h |
| Urgent state | Banner: take care of yourself first (game keeps running) | Banner: check on Sam; Text/Call if a number was added |
| Sam's character | Player-controlled; acts out blood sugar after 7 s idle | Walks around on their own acting out blood sugar, with a name tag; "Wave at Sam" |
| Maple (villager) | Weekly goal, claim ribbons | Says hi |
| Farm, kitchen, journal | Chores, cooking, Garden Journal | Can look; can't act |

## Knowing what to do

The NEXT box always shows one step, and an arrow points at it.

| Owner, in order | Visitor, in order |
|---|---|
| Collect sunlight (when the well or gifts have any) | Leave a gift |
| Restore the next thing you can afford | Visit the Garden of Days |
| Water today's sprout | Say hi to the chickens |
| Save up for the next thing (progress bar) | Explore (come back tomorrow) |
| All done for today | |

A how-it-works card shows once per role per browser (? or H reopens it).

## Gifts

- A gift adds 3 sunlight when the owner collects at the well; only the first 5 gifts a day add
  sunlight (more still show up).
- One gift per visitor every 10 seconds (server rate limit).
- No gifts during urgent states.
- Gifts wait by the well as small sprites; the owner gets a toast on arrival.

## Account setup (`/game/setup.html`)

1. **You:** name, units.
2. **CGM:** Dexcom, Libre, Nightscout or Demo. A connection that fails its first check isn't saved.
3. **Visitors:** show numbers and graph (on by default), optional urgent contact number, ranges and
   daily goal (collapsed).
Then the share link and "Enter your valley". Returning owners see the three steps collapsed with Edit.
