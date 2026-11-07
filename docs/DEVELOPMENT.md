# Developing Sugar Valley

Build, run and test instructions. Back to the [README](../README.md).

## Run it

Requires Node 22.13 or newer. No npm dependencies.

```bash
npm run assets   # optional: refresh assets/art from the raw Sprout Lands pack (already included)
npm start        # http://localhost:8787 → opens the game at /game/
npm test         # CGM connector, rewards and safety-rule tests
```

`PORT=8790 npm start` runs on another port.

1. Open `/game/setup.html`: name, CGM (pick **Demo** to try it without a sensor), visitors.
2. **Enter your valley.** Your key stays in this browser.
3. Send the share link. Visitors open it and play in your valley. See [design/gdd/visitors.md](../design/gdd/visitors.md).

`/game/?demo` plays offline with demo data and a browser save (add `&viewer` to play as a visitor).

### Sign in with Google / Apple (optional)

Without these, setup uses a key stored in the browser. With them, people can sign in on any device.

- **Google** (free, works on localhost): Google Cloud Console → APIs & Services → Credentials → Create
  OAuth client ID → Web application. Add `http://localhost:8787` (and your real domain) to
  Authorized JavaScript origins. Then `GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com npm start`.
- **Apple** (needs the $99/yr Apple Developer Program and an HTTPS domain, so not on localhost):
  create a Services ID with Sign in with Apple, register your domain and return URL, then set
  `APPLE_CLIENT_ID=<services id>` and `APPLE_REDIRECT_URI=https://your.domain/game/setup.html`.

The server verifies the provider's ID token against its public keys ([server/auth.js](../server/auth.js)).
Signing in while already set up links the provider to your existing valley.

## Controls

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Walk | WASD or arrow keys | Tap where to go |
| Interact | E, Space or Enter | Tap the prompt |
| Mute | M | Music note button |
| Glucose graph | G (Esc closes) | Tap the reading |
| How it works | H | ? button |
| Inventory (basket, cookbook, ribbons) | I | Bag button |
| Settings (owner) | — | Gear button |

## Test URLs

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

## How it plays (feature reference)

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
  in-range time. See [design/gdd/farm.md](../design/gdd/farm.md).
- **Maple's weekly goal:** built from your weakest time of day over the last two weeks.
- **Garden Journal:** tag what happened on a day; insights show which tags line up with better days.
- **Comebacks, steady streaks, morning recap:** see [design/gdd/quests-journal.md](../design/gdd/quests-journal.md).
- **Buildings:** every building can be entered. Order and pay at The Sunny Cup and the bakery, get
  seated and served at Valley Kitchen, check in and use the treadmill, squat rack, bench press, bike
  and dumbbells at the gym. Your character does this on its own when low or high.
- **Cottage:** walk in through the door. Ribbons from weekly goals hang on the wall and every recipe
  you've cooked sits on the table. Visitors can come in too.
- **Town:** down Main Street: coffee shop, bakery, restaurant, market, fountain plaza, gym, running
  track and dog park, with townsfolk to chat with and a dog that follows you.
- **Living character (33 automatic actions):** stop moving and your character takes over. In range it
  collects sunlight, does chores, cooks and waters on its own, then plays fetch, fishes, chats… Low, it
  goes into town to eat until you're back in range. High, it hits the gym, runs the track or walks the
  dog. See [design/gdd/town.md](../design/gdd/town.md).
- **Knowing what to do:** a how-it-works card on first visit (? to reopen) and an arrow over the next
  thing to do (pinned to the screen edge when it's off screen).
- **One-liners:** a caption like "Sam's blood sugar is 112 mg/dL. Flat line, full heart." changes with
  each reading ([src/data/captions.js](../src/data/captions.js)). Plain wording for urgent states, no
  value when stale or hidden.

## Project layout

```
src/                 the game (Phaser 3.90, ES modules, no build step) — served at /game/
  setup.html/.js     account setup
  net.js, demo.js    data for owner / visitor / offline demo / GitHub Pages prototype
  scenes/            Boot, World (the hamlet and town), Hud, Interior (every building)
  ui/graph.js        pixel-art glucose graph
  world/             terrain + autotiling, cottage, buildings, town, autopilot, Garden of Days plants
  data/              palette, balance knobs, CGM math (scoring, sunlight, demo data), captions, insights
  audio.js, music.js sound effects (Kenney CC0 + synthesized), ambience, CC0 music (assets/audio/CREDITS.md)
assets/art/          Sprout Lands sheets used by the game (from `npm run assets`)
server/              Node server: CGM connectors (Nightscout, Dexcom Share, LibreLinkUp, demo), poller, API
  valley.js          valley state: sunlight (computed from readings), restore, water, visitor gifts
scripts/             asset copy, screenshots, publish-readings (GitHub Pages prototype)
.github/workflows/   pages.yml (static prototype), readings.yml (scheduled readings publish)
design/              concept, safety rules, art bible, system docs
production/qa/       screenshot evidence
tests/               unit tests for the game's CGM math
extension/, web/     legacy Sugar Peek prototype (no longer linked; safe to remove)
```

This repo uses [Claude Code Game Studios](https://github.com/donchitos/claude-code-game-studios) at
`minimal` rigor. Start a Claude Code session in this folder to use its agents and slash commands.
The framework's files (`.claude/`, `CLAUDE.md` files, `project.yaml`, and in `docs/`: `WORKFLOW-GUIDE.md`,
`COLLABORATIVE-DESIGN-PRINCIPLE.md`, `skill-flow-diagrams.md`, `migration-guide-v1.1.md`,
`engine-reference/`, `registry/`, `architecture/`) are tooling, not product docs.

## CGM sources

| Source | Endpoint | Notes |
|---|---|---|
| Nightscout | `/api/v1/entries/sgv.json` | Use a read-only token |
| Dexcom | Dexcom Share (unofficial) | Share must be on in the Dexcom app |
| Libre | LibreLinkUp follower API (unofficial) | Log in as a follower account |
| Demo | Simulated | Used by the quality slice |

Credentials are encrypted at rest (AES-256-GCM, key in `data/secret.key` or `SUGARPEEK_KEY`).

## GitHub Pages prototype

[.github/workflows/readings.yml](../.github/workflows/readings.yml) runs every 10 minutes, polls Dexcom
with credentials from repo secrets (`DEXCOM_USERNAME`, `DEXCOM_PASSWORD`, `DEXCOM_REGION`) and commits
readings only to the orphan `data` branch. [.github/workflows/pages.yml](../.github/workflows/pages.yml)
publishes `src/` as a static site with no setup, sign-in or sign-out pages. On `github.io` the game runs
in prototype mode ([src/net.js](../src/net.js)).

## Deploying

See [DEPLOY.md](../DEPLOY.md) (Docker, Fly.io).
