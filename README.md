# Full Thrust: Project Continuum — Digital Tabletop

A browser implementation of **Full Thrust: Project Continuum** (version 1.1.4, April 2017), the
fleet-scale starship combat rules by Jim Klein, Clint Kozell and Hugh Fisher, built on Jon
Tuffley's *Full Thrust*.

Hot-seat on one screen or remote play between two browsers, with no server and no accounts either
way. Battles autosave on every action, rewind exactly with undo, and travel as small files. The
rules engine is a standalone TypeScript library with no UI dependencies.

## Quick start

Node 20 or newer (the repo pins 22 in `.nvmrc`).

```bash
npm install
npm run dev          # play at http://localhost:5173
```

There is no server to start, no database and no API keys — the game is a single static page and the
rules engine runs in your browser.

```bash
npm test             # rules engine tests
npm run typecheck
npm run check        # both
npm run build        # static site in dist/
npm run serve        # preview the built site on your network at :4173
```

To play on a tablet or a second screen, run `npm run dev -- --host` and open the printed LAN
address.

## Deploying

The build is a folder of static files with no server behind it, so anything that serves a
directory will do. `BASE_PATH` is the only knob: leave it unset for a domain root, set it to the
subfolder for anything else.

```bash
npm ci
npm run build                                  # dist/, served from /
BASE_PATH=/my-subfolder/ npm run build         # dist/, served from /my-subfolder/
```

### GitHub Pages

`.github/workflows/pages.yml` builds and publishes on every push to the default branch, and can
be run by hand from **Actions → Deploy to GitHub Pages → Run workflow**. It works out the base
path from the repository name itself, so a project site under `/<repo-name>/` needs no
configuration — which matters more than it sounds, because getting that path wrong does not fail
the build. It ships a page whose every asset 404s.

One setting has to be right, and it is the one that catches people out. **Settings → Pages →
Source** must be **GitHub Actions**, not *Deploy from a branch*:

- *Deploy from a branch* publishes the repository's **source** through Jekyll. Jekyll cannot build
  a Vite app, so what gets served is `index.html` with no bundle behind it — which is why that
  file carries a visible boot message explaining the situation rather than showing a blank page.
- *GitHub Actions* means "a workflow in this repository publishes the site". It does nothing on
  its own. Selecting it without a workflow that calls `actions/deploy-pages` is the state where
  the setting looks correct and nothing whatsoever happens.

Both halves are needed, and the setting is the half you have to do by hand: the workflow cannot
select itself as the source.

Once it has run, the site is at `https://<user>.github.io/<repo-name>/`.

### Multiplayer through Supabase

Remote play works out of the box with no server: the host makes an invite code, the guest answers
with a reply code, and the two consoles talk over WebRTC. That is a couple of kilobytes of pasted
text each way, and a closed tab ends the match.

With a Supabase project behind the build, a match is a six-letter code instead, and the battle
lives on the server between sessions — either player can close the tab and come back to it.

1. Create a project at [supabase.com](https://supabase.com) and open its SQL editor.
2. Run [`supabase/schema.sql`](supabase/schema.sql). It creates the `matches` table and three
   functions keyed on the match code, the `designs` table and its two functions, and locks both
   tables down so the anon key can reach nothing else. Already ran an older copy? Run it again;
   every statement is `if not exists` or `or replace`.
3. Build with the project's URL and anon key:

   ```bash
   VITE_SUPABASE_URL=https://<ref>.supabase.co \
   VITE_SUPABASE_ANON_KEY=<anon key> \
   npm run build
   ```

   For GitHub Pages, add both as repository **Variables** (Settings → Secrets and variables →
   Actions → Variables); the deploy workflow passes them to the build. For local work put them in
   `.env.local`, which is ignored by git.

The **Remote play** panel then offers *Create a match* and *Join*. A match opens in a **lobby**:
the host has the setup form (scenario, table, optional rules, factions, tech bases) and every
change reaches the guest as it is made; each console picks its own side's fleet in the fleet
picker, home-built hulls included, and presses *Ready*; the host starts the battle once both
have, and it opens at turn 1 built from those picks. A rule change takes everyone's *Ready*
back. The same lobby runs over the WebRTC link.

The server never sees the rules: what it stores is the same JSON a battle file holds — with the
lobby on it until the battle starts — and the host's console is still the ordering authority,
exactly as over WebRTC. The anon key is meant to ship in a browser bundle; the schema's
row-level security is what guards the data, and the code is the only secret.

### The community shelf

The same schema adds a `designs` table and two functions, `publish_design` and `list_designs`.
With them, the **Ship library** has a third shelf beside the fleet book and your own yard:
anyone can publish a design from their yard under a name, and anyone can take one down into
theirs. Every hull that comes off the shelf is repriced from the construction tables and run
through the shipyard's validator before it is shown, so a published design cannot lie about its
points. There is no delete from the browser; take a design down in the SQL editor:

```sql
delete from public.designs where id = '<id>';
```

Without a project the library still has the yard, and a design file (the shipyard's *Download*)
can be uploaded into it, checked the same way.

## What is implemented

The tactical game is playable end to end: write orders, roll initiative, move, fire, take
threshold checks, make repairs, and score the result — hot-seat, against the computer, or between
two browsers.

- **Cinematic movement** (3) — velocity and a twelve-point course clock, thrust ratings and advanced
  drives, the two-leg course change, written orders in the book's own notation (`8P2+4: 12`),
  double course changes, emergency thrust with its damage roll and forced re-plot, squadron
  operations, and ships leaving the table.
- **Direct fire** (4, 5) — the beam table and penetrating re-rolls, fire arcs and range bands,
  FireCon allocation, screens, armour and the shell/layered ladder, P/AP/SAP damage, the optional
  rear-arc rule, and threshold checks with the drive's two-stage failure. Every weapon in section
  5: beams, EMP projectors, plasma cannons, grasers and heavy grasers, phasers, transporters,
  gatling batteries, twin particle arrays, meson projectors, needle beams, pulse torpedoes in all
  their variants, submunition packs, K-guns with flak, MKP, boarding torpedoes, fusion arrays,
  gravitic guns, pulsers, turrets and spinal mounts.
- **Ordnance** (6) — salvo missiles and their racks and launchers, magazines that feed the
  launchers and are rolled for as one system, extended and antimatter grades, heavy missiles,
  multi-stage missiles, rockets, plasma bolts and minefields: launched in phase 3,
  flying as markers on the table with their own facing, and attacking in phase 10 after point
  defence has had its say.
- **Defences** (7) — screens, advanced screens and area screens, ablative and regenerative armour,
  antimatter charges, PDS, ADS, scatterguns and grapeshot, area defence fire control, and the
  stealth hull with its range-band shrinking.
- **Fighters** (8) — the ten fighter types and their modifications, launch and recovery, the
  scramble table, combat endurance, the two movement phases, attack runs, dogfights and furballs,
  missile interception, morale and aces. Groups are flown on the table, not from a form.
- **Gunboats** (9) — squadrons of six that fly like fighters and are shot at like ships: 18 MU,
  12 MU of fire control, one gunboat dead per anti-ship hit, and a PDS that only scores on a 6.
- **Electronic warfare and the weird weapons** (7.17 – 7.25) — holofields, ECM and area ECM, the
  three cloaks and their state machines, the Nova Cannon's three-turn template, the Wave Gun's
  charge, and the Reflex Field. Each is separately bannable, and the campaign bans three by default.
- **Threshold and repair** (4.11, 10) — the 6 / 5+ / 4+ ladder, one check per attack with +1 per
  extra row crossed, the drive's two-stage failure, Core Systems, and damage control parties.
- **Victory** (4.12) — the damage ladder, including the part that is easy to miss: *crippled* is
  four conditions joined by OR, and three of them are about systems rather than hull.
- **Ship data** — eighteen designs across two fleets, generated from the section 14 construction
  tables so no cost is ever typed by hand, plus the two introductory hulls.

Run `npx vitest run src/engine/coverage.test.ts` to see exactly which weapon classes the engine can
currently resolve. The registry refuses an unknown gun by name rather than treating it as a beam,
and a test fails the build if any ship in the roster carries one.

### What is not

**The rules text this engine was built from stops at page 81 of 151**, so sections 10–22 are not
available as quoted prose. That is a limit of the Google Drive connector that extracted it — it
caps PDF text at around 270,000 characters, and this book is about twice that — and not of the
rulebook, whose later pages are ordinary text. `docs/rules/SOURCES.md` shows the measurements and
what closes the gap; the short version of what is missing:

| Section | Status |
| --- | --- |
| 10 Threshold points | Covered — 4.11 states the rules in full; Core Systems come from the XD quick reference, marked `[XD]` |
| 11 Faster Than Light | Exit implemented: the warm-up turn, the half move, the proximity roll and what it does to bystanders. Jump gates, tenders and battleriders are in the module, not yet in a scenario |
| 12 Optional rules | Boarding combat, fleet morale, striking the colors and civil wars, from the section itself |
| 13, 14 Ship construction | Covered — the construction tables encode every cost these sections state |
| 15 Imperial Tech Base | The tables and the availability predicate are in `techbase.ts`; the fleet picker does not yet enforce them |
| 16 Special moves | Implemented and tested in `specialmoves.ts`; ramming is wired to orders and phase 5, the rest wait on a phase to call them |
| 17 Terrain | Implemented and tested in `terrain.ts`; a planet or planetoid now blocks fire, and the border skirmish has a rock to hide behind |
| 18 Battles and CPV | Points are computed and CPV is the default currency; deployment and tournament composition are in `battles.ts` and advisory in the picker |

Section 9's own gap: the extract stops mid-way through the list of gunboat types, so whatever 9.2
catalogues after the Needle Gunboat is missing. The five types that are quoted are implemented.

Appending the missing pages to `docs/rules/continuum-rulebook-extract.txt` is what it takes to
close these: the engine is written against the spec documents in `docs/rules/`, not against the
PDF. Splitting the book in two before extracting it is the reliable way to get them, since the
ceiling counts characters rather than megabytes.

Rules whose source is silent are marked `[reading]` in the spec docs with the reading taken and
why — what life-support failure costs a ship, for instance, or which way round Flawed Design's
−1 DRM runs. A `[reading]` is a decision, not a guess, and each one names the alternative.

## The look of the battle

Ships are drawn two ways, joined by zoom. At the zoom a battle opens at, each counter is luminous line
art in its side's colour: the outline its own sheet gives it, frame ribs where its batteries sit, turret
rings, a bridge block and engine bells with a glow, and a minimum on-screen size so a frigate still reads
as a ship. Zoomed in, it cross-fades into a painted model: a gunmetal hull shaded from the bow, the side's
colour as rim and markings, turrets with barrels at the battery positions, a bridge tower and nacelles.
Both show damage as scorch in red, destroyed ships as drifting wreckage, screens as a halo and the
selected ship with a ring in its own colour; custom counter art from the Shipyard still wins. Names are
chips drawn above the fire rose and nudged apart where ships crowd, the map has zoom buttons and a
range ruler, and tracks end in arrowheads.

Around the map, the header keeps the everyday buttons and folds the file actions under More; a phase strip
shows where the turn stands, what the phase needs and the one orange button that ends it, with
requirements in orange rather than damage red. Order rows fit on one line, the fire panel lists the
weapons that bear first, the log marks each line with the acting fleet's initials and colour, and the
sheet can open large. The main menu is grouped, New battle keeps its rules text behind "why?", and the
fleet picker, library and lobby show each ship's counter. Section 1 of `tokens.css` is unchanged: sides
stay cyan, amber and violet, orange is thrust and the next thing to press, red is damage.

### In 3D

*Map: 3D* under the board swaps the flat map for a three.js view of the same battle, the way the sibling
StarForce table does; *Map: 2D* swaps back, and the choice is remembered in this browser. Nothing in the rules
knows which view is on screen: the 3D view reads the same game state, and every click in it goes through the
same actions the flat map uses.

- Hulls are extruded from the same sheet silhouettes the counters draw: gunmetal plating with the side's colour
  as trim and running lights, a spine sized by mass and engine glow by thrust spent. Screens are a faint rim-lit
  shell, stronger at level 2; damage washes the plating, a crippled ship throws sparks, a wreck goes dark and
  cloaked ships are ghosts. Fighter wings and gunboat squadrons fly as formations of small craft.
- Salvo missiles fly as clusters of the missiles actually left, plasma bolts and antimatter carry their blast
  radius, and mines, flak and the Nova Cannon's sweeps are drawn where they are. Asteroid fields are real rock
  fields, planets are lit worlds with atmospheres, dust clouds and nebulae are volumes, and beams, gunfire and
  explosions play out as the dice fall.
- Phase 1's order compass floats over the selected ship and follows the camera, with the ghost of a course
  change drawn before it is written; phase 11's fire rose rings the ship and lights an arc from the ring or its
  legend. Range bands, plotted tracks, deployment, aiming ordnance, placing terrain and bringing a ship back
  onto the table work as on the flat map, and a side's view hides what the flat map hides.
- The camera orbits, pans and zooms; Tilt, Top, Low and Follow are one click each and a double-click flies to
  a ship. three.js loads only when 3D is picked, and a browser without WebGL is offered the flat map instead.
  `tools/visual_3d.mjs` checks the view in a browser.

## Playing against the computer

Hand either fleet to the computer in **New battle**. It writes its orders in
phase 1 like everyone else, and its actions go through the same journal yours do —
so you can take its turn back with Undo, and a battle against it saves and replays
like any other.

It plays the geometry rather than the odds, which is what a Full Thrust captain
actually does: one-ply search over every order it may legally write, scored on
where the enemy is predicted to be — the range its doctrine wants, how many guns
will bear, whether it is showing its engines, and whether it is about to fly off
the table. Its prediction of the enemy is deliberately naive (straight ahead),
because orders are written simultaneously and in secret and anything cleverer
would be the computer reading your orders rather than guessing them.

Its small craft are simpler on purpose. A fighter group has no course, no
velocity and no written order, so there is no simultaneity to model and nothing
for a search to do; what is left is the standoff decision, and the computer
takes it — its carriers hold station on the turn they launch, as 8.1 requires,
and its wings and gunboat squadrons fly to the range their guns work at rather
than onto the hull.

### Playtests

`src/engine/playtest` plays whole battles with the computer on both sides and keeps a
referee's books: what each weapon class fired and what it marked, every computer action the
engine refused, and whether the sequence of play ever stopped. One eight-turn battle runs with
`npm test`; the full matrix, every fleet against the next and every fleet against a mirror of
itself that holds course and fire, runs on demand:

```bash
PLAYTEST=1 npx vitest run src/engine/playtest
```

A refusal in that report is the computer's copy of the rules disagreeing with the engine's,
and a weapon class listed as present but never fired is a gun the computer has not been taught.

`tools/drive_vs_computer.mjs` plays the other kind of game: a person against the computer,
through the real console in a browser. It ends every phase with the header button, fires every
one of our ships from the phase-11 panel by clicking its counter and its weapon chips, and fails
if the turn ever sits with the computer while our guns are loaded, or a phase cannot be ended
with nothing left to do:

```bash
npx vite --port 5199 --strictPort &
node tools/drive_vs_computer.mjs 6
```

`tools/drive_campaign.mjs` drives the campaign console the same way: sets one up from the menu,
ends the phases of a turn, plots a course on the chart, buys and researches on turn 4, has the
computers fight a meeting, opens another on the table and brings it back, and reloads the page to
check the campaign came back the same.

```
node tools/drive_campaign.mjs
```

`tools/drive_ground.mjs` walks ground units: a tank platoon and a powered platoon raised from the
purchase form, embarked on a liner, carried to an enemy colony and landed, their craft placed and
brought down on the Dirtside table and the dropship unloaded, and the battle returned to the
campaign with the units' experience.

```
node tools/drive_ground.mjs
```

`tools/drive_landing.mjs` walks a landing: a fleet reaches an undefended enemy home and lands its
Marines, the landing is opened on the Dirtside table from the planetary phase with the computer
playing the garrison, platoon leaders call fire from orbit until one is answered, the strike is
brought down and leaves its marker, the battle goes back to the campaign and is reviewed; then a
second campaign lets the computers fight its landing and survives a reload.

```
node tools/drive_landing.mjs
```

## Playing

A battle is **(setup + action journal)**: the engine is deterministic and the dice are seeded, so
replaying the journal reconstructs the game exactly, rolls included. Everything below falls out of
that one fact.

- **Autosave.** Every action is saved as it happens. Refresh, close the tab, come back tomorrow.
- **Undo** takes back the last action by exact replay. Dice included: a rewound volley re-rolls to
  the same faces, so undo cannot be used to fish for a better result.
- **Battle files.** Save downloads the battle as JSON; load resumes it, on this machine or any
  other. Custom ship designs are embedded in the file, so it replays on a browser that has never
  seen them.
- **Auditing a volley.** Both players can replay a turn and see the same dice — useful when a
  threshold check decides a battle.
- **Scrubbing.** The slider above the phase controls replays the battle to any earlier moment
  without discarding the present. It costs nothing to provide: an earlier moment is just the
  journal replayed to a shorter length.
- **Ship library.** *Ships* in the top bar shows every design's real SSD on three shelves: the
  fleet book, your own yard, and the community shelf. A design file can be uploaded into the
  yard, and a yard design published for anyone to use.
- **Scenarios of your own.** *New custom scenario…* in the scenario menu opens a builder on the
  New battle form: the situation as a briefing, the table, a turn limit, two sides and what each
  may spend, rocks and clouds placed by clicking a plan of the table, and 4.12's ladder of what a
  hull is worth. Fleets are picked against the budget with the fleet picker, deployment is the
  setup's own 18.1 choice, and a saved scenario sits under *My scenarios* in the menu. A battle
  file carries the scenario whole.
- **After-action report.** *Report* in the top bar, and the result screen at the end, show how the
  battle went hull by hull: shots fired, damage put through, damage taken, kills, drawn from a
  ledger the engine keeps as the damage goes through it. It copies as text or downloads as
  Markdown for the group chat.
- **Sheets on paper.** *Print sheets* in the top bar prints the fleet as it stands, damage and
  all, with a roster page in front; the shipyard, the library and the fleet picker each print
  their own. The print stylesheet turns the plotting table's colours into ink on paper and keeps
  every hull to one block.
- **Your own designs.** *Shipyard* builds a hull against the section 14 tables, with the mass bar
  fighting you the whole way, the points working a click below it, and saves the result into the
  fleet picker beside the shipped roster. Hull integrity is a number of boxes you pick (13.7 sets
  a floor of a tenth of the mass and nothing else), and the class name is what the book calls
  that share. The
  symbols can be dragged about the sheet to give it a look of its own, and a counter image URL
  puts your own picture on the table in place of the silhouette. A battle that uses a yard
  design carries its own copy, so the save file opens on a browser that has never seen it.

## Ship construction

The section 14 tables — every hull row option, drive, system and weapon-at-each-arc-count — come
from the *Full Thrust Continuum Ultimate Ship Builder* spreadsheet, which encodes every cost the
rulebook's missing sections state.

Fitting a hull is a fixed point rather than a sum, because hull boxes, the main drive, FTL,
streamlining and screens are all fractions of *total mass*: a thrust-6 drive is 30% of the ship
whatever the ship, and hull boxes are 10–50% by integrity class. Each of those shares is then
rounded to whole mass the way 13.5 says — nearest, never below 1 — which is what makes the book's
86-mass design example come to 86 mass exactly and 294 points. `tools/build_roster.py` solves for
the smallest hull that carries a declared loadout and emits `src/data/generatedShips.ts`, so no mass
or points figure in the roster is hand-written and a design cannot drift from what it costs.

The shipyard's *Points working* sheet is that arithmetic written out: a row for each decision with
its mass and points and the sum beside it ("10% of 86 = 8.6 → 9 × 2"), sub-totals by group, the
Combat Points Value in 18.3's three steps, and carried craft listed apart from the hull the way
the Fleet Books print a carrier. The rows are what the header adds up, so a total that disagrees
with a printed fleet list can be run down to the line that differs.

Combat Points Value (18.3) is the currency the table prices in: it is the figure a hull shows
first in the shipyard, the library, on its sheet and in the fleet picker, and a new battle is
bought and scored in it unless the setup switches it off, in which case everything reads in the
printed points instead. The printed figure is always alongside, since the Fleet Books print it.

## Factions

Fourteen factions with mechanical traits, from the campaign supplements, are written up in
`docs/rules/factions.md` — each trait typed as a design rule, a tactical rule, a campaign rule or an
outright prohibition. Several are strong enough to bend the points model, which is why they are
written down before being wired in.

## House rules: presets of gear and rules

Full Thrust has been played many ways since 1992, and Continuum keeps all of it in one catalogue. A
**rules preset** is how a table says which of it is on: a named list of what may be fitted and
fielded, by the catalogue's own ids, and which of the optional rules are on. It is data, not code
(`src/data/rulesPreset.ts`), so it can be kept, sent and clicked.

- **House rules** on the main menu opens the editor: tick the gear a table allows (as a ban list or
  as an allow list, whichever reads better), set each optional rule on, off or "leave as the table
  has it", the table size, the movement system, 11.8's non-FTL hulls and a tech base. Save it to this
  browser's shelf, save it as a `.rules.json` file, open a file, or copy a link: anyone who opens
  the link gets the editor with the preset in it, ready to save.
- Four presets ship: the whole Continuum catalogue, the Stellar Imperium campaign's bans, our reading
  of the Fleet Books' kit, and our reading of the 1992 second edition. Edit any of them and save; your
  version takes the shipped one's place on your shelf.
- The **Shipyard** designs under the active preset (the Rules select in its header): barred gear is
  greyed in the catalogue and refused by the validator, so a hull built there is a hull the table
  will accept.
- The **New battle** form and the match **lobby** apply a preset to the table with one select. Applying
  writes the preset's bans and options into the setup field by field, so the battle file carries them
  and replays the same whether or not the preset still exists; an edit to any rule takes the table
  off the preset and the select reads "custom". The fleet picker refuses hulls carrying barred gear.
- With a Supabase project configured (see "Multiplayer through Supabase"), presets can be published
  to a community shelf and taken from it, the way designs are; `supabase/schema.sql` carries the two
  functions.

## Campaign

The strategic layer above the tactical one — economy, FTL movement, exploration, production,
research, admirals, detection and espionage — is written up in `docs/rules/campaign.md` from the
*Stellar Imperium* campaign rules. One Full Thrust point costs one Resource Point, so the tactical
points model is also the strategic price list.

`src/campaign/` implements the *Stellar Imperium* strategic layer: the star map and its d100
generation tables, the economy and production phase, the eight-phase campaign turn with its
Engage/Stand Off/FTL Move encounter matrix, research, admirals, detection and espionage. A campaign
is `(setup + move journal)` exactly as a battle is `(setup + action journal)`: `campaign.ts` holds
`createCampaign`, `applyMove` (the one door every change goes through, refused moves journalled
too) and `replayCampaign`, so a campaign file is its setup and its moves and nothing else.

**Campaign** on the main menu sets one up: two to four players, hot-seat from one console, each
with a name, a faction, a home world (population, factories and an orbital yard — the rules leave
the home system to the GM, so it is on the form), 2,000 RP of ships picked with the fleet picker
and 20 colony transports; a map radius, a star count and a seed. The console is a hex chart on
the left — stars, colonies as rings in their owner's colour, task-force counters, plotted tracks
— and the books on the right: what the phase has done and what it asks, the selected hex with its
worlds, colonies and forces, the player's RP and research, and the log. Courses are plotted by
clicking the chart hex by hex, held to the admiral's lead (or three turns ahead without one) and
the FTL rate; orders, flags, detaching and merging, detection checks, landings, command posts,
assaults, purchases at the price schedule, research and admirals are all buttons on the panels,
and every refusal is shown with the rule that refused it. *End phase* turns the clock: fleets fly,
systems are explored, meetings become battles, colonies produce every fourth turn.

**Battles.** When fleets meet, the combat phase lists the battle. *Fight on the table* opens it on
the battle screen as an ordinary Continuum battle — the fleets as they stand in the campaign,
damage carried over, the system's terrain, the campaign's bans, the computer at the helm of any
side marked as such — with a banner naming the campaign it belongs to. *Return to campaign* hands
the battle file back: the campaign replays it, writes the end state onto its hulls (losses struck
off, damage kept until a yard mends it, an admiral rolled for when a flagship is lost), names the
winner and lets the phase end. *Let the computers fight it* does the same without opening the
table, through `src/engine/playtest/autoplay.ts`. The campaign autosaves to this browser and
saves to a file from the header.

Ground battles are the second engine. `docs/rules/dirtside.md` is a page-by-page digest of *Dirtside II*, the
1/300-scale ground combat rules from the same publisher, with the damage-chit pot's exact contents from a 1998
probability analysis; it is the reference for the Dirtside game in `src/dirtside/`, which the campaign now
hands its planetary assaults to through the same battle-file-in, result-file-out seam (see **Landings** below).

Two more references sit beside it. `docs/rules/stargrunt.md` digests *Stargrunt II*, the 25mm infantry game
of the same universe, all 75 pages with its quick reference and counter sheets; it shares Dirtside's heavy
weapons and vehicle design, so the Motor Pool's vehicles will carry over, and its campaign chapter says
what a ground unit carries between battles (quality earned, replacements, fatigue, repairs). And
`docs/rules/more-thrust.md` digests *More Thrust*, Full Thrust's 1994 supplement, against the engine: its
chapter on combining space and ground games is the conversion the campaign uses to put a fleet's
Marines and orbital fire onto a Dirtside table.

## Dirtside II

The ground game, built in the same repository and to the same rules as the fleet game: a pure engine under
`src/dirtside/`, content as data, every figure tested against the printed page. What exists so far is the
first step of the plan: vehicle design (Chapter 3) and the points value system (Appendix), and the **Motor
Pool** on the main menu to use them.

- `design.ts` is the design system: capacity (five points a size class), what a weapon takes (3 × class for
  the primary in a turret, 2 × class otherwise), the "no more weapon systems than the size class" limit, the
  power plant's say over GEV size and over lasers and mass drivers, armour ceilings ashore, afloat and in the
  air, the walkers' and air vehicles' provisions. `validateDesign` names the page for every refusal and marks
  the book's recommendations as advisory rather than refusing them.
- `pricing.ts` is the points value system line by line, each line rounded to the nearest point before it is
  added, as the book's own worked hull is (9.6 to 10). All eight vehicles on p. 53 price to the printed figure,
  the DEIMOS to 356 with p. 16's working, and the three unit totals on p. 53 add up.
- `recordCard.ts` fills the record card of p. 55 from a design: signatures and the target die, the firer's
  die in each range band by fire control, the range bands themselves and which chits count, missiles, point
  defence and the notes box.
- The Motor Pool is the Shipyard's shape: the decisions down the left in the book's order, the card, the
  capacity bar, the faults and the cost sheet on the right, a shelf that always carries the book's eight
  vehicles and keeps your own in this browser, and record cards on paper one at a time or the whole shelf.

The second step is the fire itself: the dice, the chit pot and direct fire (pp. 28–32, p. 36), with the
**Firing Range** off the Motor Pool to try any gun on the shelf against any target.

- `dice.ts` is a seeded stream in the campaign's `{ seed, cursor }` shape, handing out D4 to D12; the die
  *type* is the game's whole modifier system, so nothing here adds to a roll.
- `chits.ts` is the pot of 119 black chits as the counter sheet prints them, drawn without replacement and
  returned after every shot; `resolveVehicleHit` reads a draw as p. 30 does (total the valid colours, less
  than the armour is nothing, equal is damaged, more is knocked out, the specials always count, a BOOM
  always kills, an F voids the shot) and `resolveInfantryHit` as p. 33 does (specials ignored, 3, 4 or 5
  points to remove militia, line or powered troops).
- `odds.ts` is the exact arithmetic: the opposed roll summed outright, one target die or the higher of two,
  the barrels of a multiple mount sharing one target roll; and every draw of up to five chits enumerated
  and put through the same resolver the game uses. The 1998 spreadsheet in the user's zip tabulates that
  distribution for every armour value and validity set, and `odds.test.ts` reproduces all 56 vehicle rows
  and 24 infantry rows to its six printed decimals.
- `fire.ts` plans a shot before it is rolled — the band (a damaged firer's bands one worse), the firer's die
  by fire control, band and movement (off the end of the scale is a refusal), the target's die by
  signature and the one secondary die its posture allows, the validity for the weapon, band and any
  ablative or reactive armour — and refuses with the page when the book does. Against infantry there is no
  roll (p. 36): a fixed number of chits at a shorter reach, an HKP nothing at all.
- The Firing Range shows the plan and the odds — hit, knocked out, damaged, immobilised, either side's
  systems down — with the same gun at the edge of each band beside it, then rolls it on a seed and logs
  the dice and the chits drawn. The seed can be rewound to replay a run.

The third step is the table itself, under `src/dirtside/table/`, and the **Dirtside table** on the main menu
to play it hot-seat: a skirmish of the book's vehicles and infantry (or your own, off the Motor Pool shelf)
over a seeded spread of terrain, with objectives placed as p. 17 says.

- `types.ts` and `game.ts`: a battle is a setup plus a journal of actions, and `applyAction` is the one door.
  Deployment within 6" of the baseline; the side with fewer units choosing who activates first; the
  integrated sequence of one unit at a time, a pass allowed only with fewer unactivated units and paid for
  with two activations in succession (pp. 17–18); a unit's activation as moves and one combat action per
  element, fixed mounts before moving, a volley declared whole with shots at a dead target wasted (p. 28);
  the opponent's opportunity window after each move, its fire spending that unit's activation (p. 20);
  under-fire markers, the panic of green troops, casualty tests at the p. 23 threat levels, a fallen leader
  replaced on a D6, the loss of the command unit; rallying through the command unit and repairs on a 6
  (pp. 22–24, p. 32); objectives taken by moving over them, a declared game end or a turn limit.
- `terrain.ts`: the ground as irregular outlines, circles, rectangles and wide paths (see the ground section below); a wood's edge is its first inch (p. 20);
  line of sight to 60" blocked by woods, buildings and high ground unless one end stands on the high
  ground (p. 4); a path costed by the going each quarter inch of it meets, easy only in travel mode (p. 25).
- `confidence.ts`: the quality dice, the confidence, reaction and rally tests, what each level forbids as
  the page prints it (the digest's two copies of that table were both wrong; the engine follows the scan).
- `tableFire.ts`: the shot from the table — the angle of attack (p. 32), posture and cover for the target's
  dice, rifles, APSW and IAVR fire (pp. 33–36) with the infantry unit's fire-effectiveness roll first.
- `autoplay.ts` plays both sides with random legal actions; five seeded skirmishes replay from their
  journals exactly. `setupCheck.ts` faults a setup whose objectives break p. 17's placement quotas.
  `tools/drive_dirtside_table.mjs` walks the screen in a browser.

The engine was then read against the page scans by five readers, one chapter each, every finding put to two
skeptics with the page in front of them; the nine that survived are in (regrouping, the attacker alone ending
an attack/defence battle, a marker in the enemy's rear area to end an encounter, prepared positions kept and
re-occupied, cover claimed by contact, one reaction test per move at the highest threat, a SLAM salvo
catching elements within 1" or 2" of its target, the fire-effectiveness cap counted over the whole platoon,
no new offensive in the turn a command unit is lost, fixed mounts' 30° arc).

**The table's look and guidance.** The screen was rebuilt to read like a miniatures board and to teach
the game as it goes. The map (`src/ui/dirtside/TableMap.tsx` and `map/`) draws every terrain type with its
own texture, edge and label; counters are models on bases, a silhouette per mobility and role, with a
pennant carrying the unit's code (N1, S2…), its quality and leadership, and a tick once it has acted;
status shows as table markers (berms for hull down, sandbags for dug in, damage and systems-down marks).
Picking a weapon lights every enemy it can shoot and dims the rest; pointing at one draws the sight line
with the odds, or outlines what blocks it. Plotting a move shows a ghost path coloured by the going, the
cost at the pointer, and the engine's own answer when a move would be refused. The play screen
(`TableScreen.tsx` and `play/`) puts a strip above the map that says whose turn it is, what to do now and
which one orange button does it; the side column shows the acting unit, the selected element as a card
(armour, dice, a movement bar, weapons with their range bands), both rosters in plain words, what the
last action did (the computer's included), and a log grouped by turn. How to play explains the turn, an
activation, shooting and morale. Keys: Enter presses the orange button, A activates, M plots a move, E
ends the activation, 1–4 arm a weapon, F fires, U, H and T set the stance, Tab or N moves to the next element, Backspace removes a
waypoint, Esc cancels, Ctrl+Z takes back a move that rolled no dice, ? opens the guide; none of them act
while a window or a text field has the keyboard. The skirmish setup builds forces as unit cards with
their points, offers a first game against the computer, and previews the table. Sides are cyan (north)
and amber (south) as in the fleet game; red marks damage and nothing else. A review played whole games
through the screen as a newcomer and checked every screen at four sizes; its 33 findings are fixed.

Readings to know about. The book's own Light MICV (p. 53) puts an MDC/2 on a class 2 hull with an HMT, which
p. 10 forbids; it is kept as printed and the Motor Pool shows the fault. Vehicle guns firing on infantry have
two printed validity rules — a colour per weapon on p. 29 and the record card, and "as for infantry
firefights", by cover, on p. 36 — which cannot both hold; the range offers either, with the card's as the
default. Three readings only matter against armour 0 and follow the spreadsheet: an F voids a BOOM drawn with
it, an invalid colour is a total of 0 and so damages a soft skin, and a draw of specials alone has no total
to compare. On the table: vehicles moving under fire test at +0 as p. 24's marker section says, where
p. 23's table prints +1; "withdraw to the nearest cover" is enforced as not ending a move nearer the enemy;
a disorganised unit's moves must each close up on a unit-mate; a wood a mobility type cannot enter may be
entered to its edge at poor going; a vehicle turret down cannot shoot (the book gives turret-down only as the
target's die); the target's front arc is a square model's 90°; opportunity fire is guns and IAVRs, not a
firefight. Interface landings (p. 43) are on the table: craft in orbit with units aboard, brought down any
number to an activation 12" from the nearest enemy in sight, landers unloading at once and dropships
in a later activation, and craft lost to the defence's D6. Not yet on the table: missiles and area
defence, artillery beyond fire from orbit, aircraft and VTOL modes, drop troops, close assault and
mounted infantry, hidden units, smoke and engineering.

## Landings: the campaign on the ground

A new campaign is played under campaign rules reading 2, in which an assault is a landing fought on
the Dirtside table, as *More Thrust*'s Full Thrust / Dirtside II interface (pp. 15–18) has it.
`src/campaign/ground.ts` builds the battle and reads it back; campaign files from before reading 2
replay as they were played.

**Land Marines** on an enemy colony in the planetary phase, from a task force holding the orbit.
Every warship of frigate size or more carries a Marine contingent of its mass × 4 in cargo space
(p. 17), and at 16 CS a team (four men at 4 CS each, p. 15) that is mass ÷ 4 teams: the frigate's
squad of two, the heavy cruiser's eight, the battlecruiser's ten, six of the seven contingents p. 18
prints. They land in powered armour, two rifle teams to a squad and an odd team a specialist (the
force's first an observer, then anti-armour, then APSW), in platoons of four, the largest ship's
platoon commanding. A damaged ship loses Marines on the way down: each team has the chance of the
share of hull lost (p. 18), rolled once for that damage. Teams lost stay lost until the ship is
repaired at a friendly yard.

The colony answers with what the campaign rules give it, read onto the table: a PDU is a platoon of
line infantry dug in (three rifle teams, APSW, anti-armour), an advanced PDU three Medium Battle Tanks
dug in, and every million loyal colonists a team of green militia, to twenty; subject population does
not fight. A colony nobody defends falls at once; an intact planet shield stops the landing.

The battle is an attack/defence game of eight turns on a 48" × 36" table: the town in the defender's
rear area with an objective at its heart and two more in the main battle area, the defenders on the
town's front edge and the flank objectives, the Marines on the north baseline. The planetary phase
lists it: **Fight on the Dirtside table** opens it with the computer at the helm of any computer
player's side, and **Return to campaign** brings it back; **Let the computers fight it** plays both
sides with `src/dirtside/table/ai.ts`. The campaign replays the battle file's journal over the
landing's own setup, fixed when the Marines went down, so a file from another battle or an edited
setup is refused. The winner of the battle has the ground: a colony taken changes hands as 6.4 says;
a PDU whose platoon lost half its elements is gone; Marines lost are struck off their ships. An
unfinished battle goes to whoever holds more objective value, the garrison on a tie.

**Fire from orbit.** The task force's ships support the landing (More Thrust p. 17, Dirtside
pp. 38–40). They are overhead on a turn rolled on a D6 as the battle opens and every sixth turn
after. Each turn overhead an escort fires one converged sheaf, a cruiser two and a capital ship three
(by 13.4's mass classes), and a ship with ortillery makes a bombardment attack for each working
system. A unit commander (D10, D8 or D6 by leadership 1 to 3) or an observer team (D12) calls it as
its combat action, needing sight of the aim point and 6 or more; the impact marker goes down and the
fire arrives after the enemy's next activation, bringing it down being that side's turn. It deviates
on a D12 clock face and a D6 against a D8, the D8's excess in inches; every element within 2" of a
sheaf or 4" of ortillery draws three or four chits, HEF against infantry and MAK against vehicles
(p. 29's validities: yellow, red only against dug-in infantry, nothing against a dug-in vehicle), and
a NUKE marker at ground zero keeps unprotected troops and vehicles 2" away.

**Ground units.** Players raise their own Dirtside platoons (`src/campaign/army.ts`). In the
production phase a colony's purchase form offers a *ground unit*: up to eight of any design on the
Motor Pool's shelf, the book's or your own, or an infantry platoon of militia, line or powered
troops, priced at one RP a Dirtside point (the campaign's own prices bear it out: its PDU at 200 RP
against 130 points for the line platoon it stands for, its advanced PDU at 500 against 516 for three
tanks). Ticking *lands from orbit* adds the quarter Dirtside charges on each element for interface
landing (pp. 43, 52). A new unit draws its command marker at random from the counter sheet's mix,
which sets its quality and leadership (p. 21).

Units stand garrison at their colony, and fight beside its PDUs and militia when it is attacked. They
embark into a ship's cargo holds or troop berthing at More Thrust's 50 CS a mass, a vehicle taking its
size × 4 and its crew, a team its four men (p. 15), and disembark at a friendly colony; any ship with
holds will carry them, a Shipyard transport included. When a task force lands, the units aboard that
can land from orbit come down during the battle in Dirtside's interface craft (p. 43): each ship's
armour in dropships, five units at most to one, and each infantry unit in its own assault lander.
Craft wait in orbit off the table; bringing any number down is one activation, each at least 12" from
the nearest enemy that can see the spot; a lander's unit comes straight out, a dropship's unloads in
a later activation as a full activation of its own. The colony's PDUs fire at craft coming in, a D6
bringing one down on a 6 while a PDU platoon is in action and on 5–6 while an advanced PDU's tanks are.

After the battle, lost elements are struck off; the attacker's units that got down stay as the
captured colony's garrison, or go back up to their ships if it held; a garrison surrenders with its
colony; troops aboard a ship that is lost go with it, and troops going down from a damaged ship roll
for transit losses (More Thrust p. 18). Every unit that fought earns Stargrunt II's experience
(pp. 60–61, the same publisher's rules for the same universe, since Dirtside only says units build
up a history): 3 points on the winning side, 1 on the losing, 1 more for taking an objective itself;
a green unit turns regular at 5 points and a regular one veteran at 8. A depleted unit at a colony
buys its lost elements back in the production phase, and rolls the die nearest its remaining
strength: no higher than the number of replacements and the new men cost it a level.

Readings for ground units. A vehicle's crew is four men, or two in a vehicle of size 2 or less (More
Thrust counts crews man by man; this matches its Medium Battle Tank and its size-2 command vehicle).
Units come down by Dirtside's element-side costing, not More Thrust's ship-side dropships and hangar
bays (pp. 15–16), so no ship needs new systems to land them. A hull marked civilian (the mark that
already gives a merchant 10.4's smaller crew) carries troops, not Marines, and fires no support; no
roster ship carries the mark and the Shipyard can't set it yet, so the SAMC's armed liner lands Marines
as the capital ship its data says it is. A task force lands once a turn. The 12" is measured to the
craft, and its units come out on the craft's far side from the nearest enemy, so none stands nearer
than the craft. Unloaded units still have their activation to make. Aircraft are not yet on the
Dirtside table, so the form leaves them off. Stargrunt's fatigue is not carried.

Ground units went through the same review: three readers (the landing rules on the table, the campaign
side, the screens), every finding put to a skeptic. Six survived and are fixed: units unloading beside
a craft set down at exactly 12" could come out inside the 12"; one task force could land the same
platoon on two colonies of one system at once; a placement left open when a side passed turned the next
click on the table into a landing; Buy and Reinforce stayed clickable when the order was invalid or
unaffordable; and the civilian-hull reading above now says plainly that no roster ship is civilian. A
seventh, that a dropship waiting on the ground should check the 12" again before unloading, was
refuted: p. 43 places the craft, not the unloading.

The landing was then read against the pages and the code by three reviewers, one for the fire from
orbit, one for the campaign side and one for the screens and the computer player, every finding put to
a skeptic; the six that survived are in (a vehicle unit caught by a strike that does it no harm is not
under fire, p. 24; fire that is due must be brought down before a rally too, p. 39; defenders and
Marines each get ground of their own however large the garrison or the fleet; nothing on the screen
acts for a side the computer plays; and opening another landing over one still on the table asks
first).

Readings to know about. The garrison is ours: the campaign rules print no ground forces. The
contingent's make-up is ours within More Thrust's space: the book's examples are illustrative, and
powered Marines without vehicles need no drop capacity, which is why assault transports, dropships
and hangar bays (pp. 15–16) are not yet in the Shipyard. One D6 is rolled for the whole task force's
orbit, not one a ship. A bombardment is read against a vehicle's top armour, one less than the
front. Protected from fallout means powered infantry and armoured vehicles. Where p. 39 and p. 29
disagree on MAK against dug-in vehicles, p. 29's table is followed. More Thrust's fighters flying
ground attack wait for Dirtside's aerospace rules.

Two readings to know about: a computer player's fleets are fought by the computer at the table but
are not moved by it between battles (whoever runs the campaign moves them from the console), and,
in a campaign under rules reading 1, an assault takes a colony when the landing brings more Marine
parties than its defences are worth — one a PDU, two an advanced PDU — since the rules say a
landing is repulsed by PDUs and nothing about how they are reduced. Espionage, emigration and technology trading are in the library and
not yet on the console.

One thing to flag about the source: the campaign document's economy section says *1 million
population = 20 RP*, and its production phase says *50 RP for every 1 million population*.
Production uses the 50, since that is the rule in the phase that spends it, and
`src/campaign/economy.ts` notes the discrepancy at the constant rather than quietly picking one.

## Stargrunt II

The squad game, the third in the repository: 25mm troopers instead of Dirtside's platoons of vehicles,
played on the same ground with the same seeded dice and the same shape of engine, under `src/stargrunt/`.
The **Stargrunt table** on the main menu sets up a battle between two of chapter 25's forces and plays it
hot seat or against the computer. The rules digest is `docs/rules/stargrunt.md`, read page by page from the
1996 book and its quick reference; the engine cites the printed page on every refusal and every log line.

- `types.ts` and `dice.ts` are the contract. A battle is a setup plus a journal of actions, `applyAction`
  is the one door, and every roll comes out of the state's own stream, so a saved battle replays exactly.
  The dice are Dirtside's D4 to D12 with Stargrunt's three rolls (p. 6): against a target, opposed, and the
  multiple opposed roll, with closed and open die shifts.
- `data/` is the kit and the forces: the generic weapons table (p. 34), armour dice, mobility, range bands
  by quality, the firepower die a squad's summed firepower buys, and chapter 25's four platoons (New Anglian
  Confederation marines, Neu Swabian panzergrenadiers, Eurasian Solar Union naval infantry, and the
  "Federal Stats Europa" colonial legion, the book's own spelling on p. 69). There is no points
  system, because the book has none.
- `checks.ts` holds the morale: both threat tables, the confidence test (one level lost on a failure, two
  on less than half the target), the reaction test, panic, communications a die type worse for each rung
  bypassed, transfers, rallying, removing suppression, going in position, and the new leader's D6 (p. 10).
- `fire.ts` is fire against a dispersed target (pp. 33–38): the range die from the bands, cover and in
  position; the firer's quality die, firepower die and any support weapons joining in; the multiple opposed
  roll for suppression or a fully effective shot; potential hits, impact against armour shifted by cover,
  wound or kill, and random allocation among the figures.
- `assault.ts` and `medical.ts` are close combat (pp. 41–43: the charge test, the defender's stand test on
  the odds, pairing off, rounds with weapon and cover shifts, power armour's doubled roll, casualties rolled
  when it is over) and treating the wounded in a reorganise (p. 39). On the table a charge takes both
  actions: a failed nerve test costs only the first; a defender who will not stand withdraws; one who does
  makes the attackers roll their combat move, and if it falls short they take final defensive fire, may be
  turned back suppressed, and roll again with the second action (p. 43).
- `table/cover.ts` and `table/movement.ts` read Dirtside's terrain the Stargrunt way: soft and hard cover,
  the majority rule for a squad split across cover (p. 12), wood edges and wood interiors, line of sight,
  range between units, integrity as a 6" circle or a 2" chain (p. 11), and the cost of a figure's path by
  the going.
- `table/game.ts` is the battle: deployment, the side with fewer units choosing who goes first, alternate
  activations with a pass paid for by two in a row (p. 15), two actions a squad checked against the actions
  table, every action the core rules give a squad (normal, combat and travel moves; small-arms fire with
  support weapons joining or a support weapon alone; close assault; reorganise; removing suppression; in
  position; transfer; rally; recovering from panic), the confidence cascade fire and assault set off, what
  each confidence level and suppression forbids, objectives, and the end of the battle. `allowedActions`,
  `planMove`, `planFire` (the odds, exact by enumerating the dice) and `planAssault` tell the screen and the
  computer what an action would meet before it is tried.
- `table/ai.ts` is the computer player: it takes cover, heads for objectives, fires the weapon with the
  best odds, shakes off suppression, reorganises, rallies and charges only when the odds and the reach are
  good, and never sends an action the engine refuses. `table/autoplay.ts` plays random legal battles; the
  tests play hundreds of battles with each to a result and replay every journal exactly.

A review then played the game through the screen and read the engine against the book, every finding put
to a skeptic; the eleven that survived are fixed (among them objectives scored for a side whose troops on
them had been shot, the defender's first-round cover bonus given in the open, a support weapon firing twice
in a turn, and a squad travelling in column and pinned in the open with no legal action left).

The screen (`src/ui/stargrunt/`) is built from the Dirtside table's parts: the same board and terrain, the
status strip that says whose turn it is and which one orange button to press, the docked log grouped by
turn, the keys. Each trooper is a small base in the side's colour with a mark for its kit (the leader's
star, a support weapon, a medic), wounded and dead marked where they fell; each squad has a pennant with its
code, quality die, leadership, confidence and up to three suppression pips. The side column shows the active
squad's figures and every action, greyed out with the engine's reason when it would be refused; pointing at
an enemy draws the line of fire with the chance of suppression and of a fully effective shot; a charge shows
each figure's path to its opponent, coloured by whether one roll or two will get it there, the odds, the
defender's stand test and the choice if the charge falls short. The
setup offers a first game (one squad a side against the computer), full platoons, or any mix of chapter 25's
units at any quality and leadership, with a live preview of the table. `tools/drive_stargrunt_table.mjs`
walks it in a browser.

Readings to know about. Both battle types have a pregame deployment 6" deep, as Dirtside's does, although the
book's encounter battle has the forces enter over their baselines on turn 1. A transfer spends the
commander's whole activation, where the book lets the commander keep one action; the contract has no way yet
to pause one activation inside another. A broken unit fires only at a unit that fired on it this turn or
last. Attackers turned back by final defensive fire return to where the charge began, not to the nearest
cover the book also allows, and the defenders' free volley may use weapons already fired that turn. Panic is tested the first time a unit is attacked, for untrained and green troops (regulars panic only
at terror, which is not in yet). Objectives are taken by moving within 1" with no enemy nearer, Dirtside's
rule, since Stargrunt's scenarios each set their own. Not yet on the table: vehicles, heavy weapons and
guided missiles, artillery and air support, observation and hidden units, snipers, detached elements,
field defences, encumbrance, prisoners (a captured trooper counts as dead), and the campaign.

## The ground: irregular terrain, buildings and towns

Both ground games lay out their tables with one generator, `src/dirtside/table/ground/`, at two scales: Dirtside's
platoons, where a building is under an inch across and a town is a few inches of urban ground, and Stargrunt's
squads, where a building is several inches across and walls and hedges matter. The setups offer six styles: open,
rural light, rural dense, a village strung along a road, a town of blocks and streets round a square, and a city
across most of the table with parks, plazas and ruined blocks. At Stargrunt's scale a town is twelve to twenty
buildings in terraced rows along lanes, with yards walled or hedged behind them, and a city twenty-two to forty. The deployment strips stay clear of buildings, and
the same seed always lays out the same table.

- Woods, hills, rough ground, scrub and swamp are irregular outlines (a closed curve of smoothed noise), hills
  drawn with terraced contours, fields as skewed quadrilaterals with furrows and hedgerows, rivers meandering to
  a ford, roads curving. Circles and rectangles still work, so a saved battle or a typed-in scenario plays as
  before.
- A town is one urban area with its streets, buildings, ruins and garden walls laid out inside it, each marked
  as part of it. Dirtside plays the town as the book does, as urban ground treated like a wood (p. 46), and
  passes over the pieces; a building standing on its own is the book's isolated building (it blocks sight, gives
  soft cover to an element in contact, and does not slow movement) and rubble is cover but no screen. Stargrunt
  plays the pieces: inside a building or in rubble is hard cover, a wall hard and a hedge soft cover but only
  against fire from beyond them (pp. 12–13), the streets open ground; buildings block sight, though a trooper
  inside one sees out of it.
- Campaign landings build the colony's settlement at platoon scale, a village, a town or a city by its population
  and industry, and post the defenders along its front and through it.
- Every shape carries a cached bounding box, so a city of several hundred features stays quick to query for sight
  and movement, and the move reach ring is computed against only the features near the unit.

A review read the new rules against both books, every finding put to a skeptic; the five that survived are fixed
(a lone building an element standing in it could see through, a figure on a wall's own line covered from both
sides, the cover checks that name no firer ignoring walls, the computer heading for the notch of an L-shaped
building, and a cache warning).

## The ground games in 3D

Both ground tables have *Map: 2D / 3D* over the board too, remembered per game, three.js loaded only when 3D
is picked. The view, in `src/ui/ground3d/`, reads the same battle and sends every click through the same
actions as the flat map; the rules are untouched. Elevation is what it shows best: hills stand as terraced
wargame hills and whatever is on them stands on their terraces, buildings rise in storeys under pitched or flat
roofs (merged by colour, so a city of several hundred draws in a handful of calls), woods are stands of trees
with their edge readable, rivers sit sunken between banks, rubble lies in heaps, and roads, fields, walls and
hedges lie on the ground. Dirtside is built at 6mm scale and Stargrunt at 25mm, so a building and a hill are the
size each game means. Both books keep height simple, high ground or not (Dirtside p. 4, p. 20; Stargrunt
p. 11), and the whole of a hill still counts as high ground; the terraces are its look.

- Dirtside's elements are small models by mobility (tracked, wheeled, hover skirts, grav with a glow, walkers,
  VTOL rotors) with their turrets, infantry stands by team, dug-in and hull-down marks, damage and
  systems-down pips and the unit pennants. The plotted path is draped on the ground and coloured by the going,
  with the move ghost following the pointer and its cost; the reach, the range bands, each target's verdict
  and odds with the fire line, orbital aim and beaten zones, landing clearance and recent fire are drawn as on
  the flat map, with its legend and a two-click ruler.
- Stargrunt's troopers are small soldiers carrying their kit (rifle, SAW, support weapon, a medic's pack, the
  leader's mark), wounded and stabilised figures lie pale and the dead dark, and each squad's pennant carries
  its quality, confidence and suppression and selects the squad. The selected squad's integrity, the move
  ghost, the charge plan's paths coloured by roll, fire lines with the engine's odds, deployment zones and
  objectives are drawn on the ground.
- Tilt, Top, Low (eye level) and Follow frame the table; a double-click on a unit flies to it. Clicks snap to
  the flat map's quarter-inch grid, labels declutter on screen, and a browser without WebGL keeps the flat map.
  `tools/visual_ground3d.mjs`, `tools/visual_dirtside3d.mjs` and `tools/visual_stargrunt3d.mjs` check the views.

A review played both games in 3D and read the code against the flat maps and the Full Thrust view's own fixes,
every finding put to a skeptic; the thirteen that survived are fixed (among them buildings and woods on a hill
drawn sunk into it, clicks off the quarter-inch grid, a WebGL context kept after closing the view, every render
re-running every layer, and presets that left corner units out of frame).

## Architecture

See `docs/architecture.md` for the full account. In brief:

```
src/
  engine/    Pure rules. No React, no I/O. Fully unit tested
  data/      Game content, authored as data: the construction catalogue, ships, scenarios
  ui/        React. The only mutable-state boundary is store.ts
  campaign/  The strategic layer
  dirtside/  Dirtside II: the ground game's engine — design, pricing, dice, chits, direct fire, and table/ the battle
  stargrunt/ Stargrunt II: the squad game's engine — kit and forces, morale, fire, close assault, and table/ the battle
docs/rules/  Where every rule in the engine comes from, and what is missing
```

The dependency arrow never reverses: `ui` may import `engine` and `data`; `engine` imports neither.
The engine mutates ship state in place — it marks boxes the way a player marks a dry-erase SSD —
and the UI subscribes to a version counter rather than diffing immutable trees.

This architecture is carried across from
[StarForce Commander — Digital Tabletop](https://github.com/Onlinemph/Starforce-Commander-Tabletop-Game),
a sibling project implementing a different game. `docs/architecture.md` says what was taken and
what had to change.

## Credits

**Full Thrust** was designed and written by Jon Tuffley and is published by Ground Zero Games.
**Cross Dimensions** was developed by Hugh Fisher. **Project Continuum** is by Jim Klein, Clint
Kozell, Hugh Fisher and Jon Tuffley, with the Emerald Coast Skunkworks, and is distributed by them
as a free amateur work with GZG's permission. This repository is a digital implementation of those
rules; the game itself and its setting are the property of their authors.
