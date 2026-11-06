# Sugar Valley

A cozy village-restoration game for people with type 1 diabetes. Every CGM reading in range brings
sunlight back to a faded valley. Spend it to restore the village, and watch each day's glucose
curve grow a one-of-a-kind plant in your Garden of Days.

It is not a medical device and does not send alerts. See [design/gdd/safety.md](design/gdd/safety.md).

**Status:** one area (the Forest hamlet), playable with real CGM data. Owners set up an account and
play; visitors play in the owner's valley from the share link. Screenshots: `production/qa/evidence/`.

## Run it

Requires Node 22.13 or newer. No npm dependencies.

```bash
npm run assets   # once: copy Sprout Lands sheets from assets/Sprout Lands - Sprites - Basic pack/
npm start        # http://localhost:8787 → opens the game at /game/
npm test         # CGM connector, rewards and safety-rule tests
```

`PORT=8790 npm start` runs on another port.

1. Open `/game/setup.html`: name, CGM (pick **Demo** to try it without a sensor), visitors.
2. **Enter your valley.** Your key stays in this browser.
3. Send the share link. Visitors open it and play in your valley. See [design/gdd/visitors.md](design/gdd/visitors.md).

`/game/?demo` plays offline with demo data and a browser save (add `&viewer` to play as a visitor).

### Sign in with Google / Apple (optional)

Without these, setup uses a key stored in the browser. With them, people can sign in on any device.

- **Google** (free, works on localhost): Google Cloud Console → APIs & Services → Credentials → Create
  OAuth client ID → Web application. Add `http://localhost:8787` (and your real domain) to
  Authorized JavaScript origins. Then `GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com npm start`.
- **Apple** (needs the $99/yr Apple Developer Program and an HTTPS domain, so not on localhost):
  create a Services ID with Sign in with Apple, register your domain and return URL, then set
  `APPLE_CLIENT_ID=<services id>` and `APPLE_REDIRECT_URI=https://your.domain/game/setup.html`.

The server verifies the provider's ID token against its public keys (`server/auth.js`). Signing in
while already set up links the provider to your existing valley.

### Controls

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Walk | WASD or arrow keys | Tap where to go |
| Interact | E, Space or Enter | Tap the prompt |
| Mute | M | Music note button |
| Glucose graph | G (Esc closes) | Tap the reading |
| How it works | H | ? button |
| Settings (owner) | — | Gear button |

### Test URLs

Add these to `/game/`:

| Parameter | Effect |
|---|---|
| `?demo` | Offline demo data (the knobs below except `t`, `x`, `y`, `zoom` need it) |
| `&viewer` | Play the demo as a visitor |
| `&hidden` | Visitor with numbers hidden |
| `&restored=bridge,coop` | Start with these restored |
| `&inv=egg:3,milk:1` | Start with this in the basket |
| `&nointro`, `&norecap` | Skip the intro card / morning recap |
| `&cooked=pancakes,bread`, `&ribbons=3` | Preview the cottage with dishes and ribbons |
| `&fresh` | Ignore the demo save |
| `&sun=400` | Start with this much sunlight (with `fresh`) |
| `&t=20.5` | Freeze the clock at this hour (lighting) |
| `&bg=48` | Force the current reading (48 shows the urgent-low screen) |
| `&x=28&y=15` | Start at this tile |
| `&zoom=3` | Force the pixel zoom |

`npm run shot -- <url> <out.png> [width] [height] [waitMs] [keys]` takes a headless-Chrome
screenshot and prints console errors. Keys look like `e:100,d:2000` (key:held ms). Set `SHOT_KEY`
to an owner key to sign in first.

## How it plays

- **Sunlight:** each in-range reading adds 1 to the Sun Well. Getting back in range quickly adds a
  small bonus. Lows never earn anything.
- **Restore:** walk to a faded thing (footbridge, lantern path) and spend sunlight to bring it back.
  The footbridge opens the east meadow.
- **Garden of Days:** one plant per day. Stem follows the day's curve, bloom size follows time in
  range, color follows the average. Rough days grow a hardy shrub; days without enough data leave a
  stone. Walk up to a plant to see its day.
- **Time of day:** lighting follows your clock. Windows and lanterns glow at night; fireflies come out.
- **Urgent states:** a banner that can't be dismissed; the game keeps running while the character treats.
- **Farm:** restore the coop, veggie patch, campfire kitchen, pasture, orchard and dock. Daily
  chores (eggs, milk, harvest, apples) fill your basket; cook recipes at the campfire. Crops ripen with
  in-range time. See [design/gdd/farm.md](design/gdd/farm.md).
- **Maple's weekly goal:** built from your weakest time of day over the last two weeks.
- **Garden Journal:** tag what happened on a day; insights show which tags line up with better days.
- **Comebacks, steady streaks, morning recap:** see [design/gdd/quests-journal.md](design/gdd/quests-journal.md).
- **Cottage:** walk in through the door. Ribbons from weekly goals hang on the wall and every recipe
  you've cooked sits on the table. Visitors can come in too.
- **Living character:** stop moving and your character acts out your blood sugar; visitors see Sam
  walking around.
- **Knowing what to do:** a how-it-works card on first visit (? to reopen), a NEXT box with the next
  step and progress toward the next restore, and an arrow over the target (pinned to the screen edge
  when it's off screen).
- **One-liners:** a caption like "Sam's blood sugar is 112 mg/dL. Flat line, full heart." changes with
  each reading (`src/data/captions.js`). Plain wording for urgent states, no value when stale or hidden.

## Project layout

```
src/                 the game (Phaser 3.90, ES modules, no build step) — served at /game/
  setup.html/.js     account setup
  net.js, demo.js    data for owner / visitor / offline demo
  scenes/            Boot, World (the hamlet), Hud
  ui/graph.js        pixel-art glucose graph
  world/             terrain + autotiling, cottage builder, Garden of Days plants, pixel helpers
  data/              palette, balance knobs, CGM math (scoring, sunlight, demo data)
  audio.js, music.js sound effects (Kenney CC0 + synthesized), ambience, CC0 music (assets/audio/CREDITS.md)
  scenes/Interior.js the cottage interior
assets/art/          Sprout Lands sheets used by the game (from `npm run assets`)
server/              Node server: CGM connectors (Nightscout, Dexcom Share, LibreLinkUp, demo), poller, API
  valley.js          valley state: sunlight (computed from readings), restore, water, visitor gifts
design/              concept, safety rules, art bible, system docs (Claude Code Game Studios, minimal rigor)
production/qa/       screenshot evidence
tests/               unit tests for the game's CGM math
extension/, web/     legacy Sugar Peek prototype (no longer linked; safe to remove)
```

This repo uses [Claude Code Game Studios](https://github.com/donchitos/claude-code-game-studios) at
`minimal` rigor. Start a Claude Code session in this folder to use its agents and slash commands.

## CGM sources

| Source | Endpoint | Notes |
|---|---|---|
| Nightscout | `/api/v1/entries/sgv.json` | Use a read-only token |
| Dexcom | Dexcom Share (unofficial) | Share must be on in the Dexcom app |
| Libre | LibreLinkUp follower API (unofficial) | Log in as a follower account |
| Demo | Simulated | Used by the quality slice |

Credentials are encrypted at rest (AES-256-GCM, key in `data/secret.key` or `SUGARPEEK_KEY`).

## Credits and licenses

- **Art:** [Sprout Lands](https://cupnooble.itch.io/sprout-lands-asset-pack) by Cup Nooble. The
  free Basic pack is licensed for **non-commercial use only**, with credit. A commercial release
  needs the Premium license. The raw pack is gitignored and must not be redistributed.
- **Font:** Pixelify Sans (SIL Open Font License, `src/fonts/OFL.txt`).
- **Engine:** [Phaser](https://phaser.io) (MIT).
- New pixel art (Sun Well, lanterns, icons, UI panel, plants) is original to this project and uses
  only the Sprout Lands palette.
