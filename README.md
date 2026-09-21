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

Two readings to know about: a computer player's fleets are fought by the computer at the table but
are not moved by it between battles (whoever runs the campaign moves them from the console), and
an assault takes a colony when the landing brings more Marine parties than its defences are worth
— one a PDU, two an advanced PDU — since the rules say a landing is repulsed by PDUs and nothing
about how they are reduced. Espionage, emigration and technology trading are in the library and
not yet on the console.

One thing to flag about the source: the campaign document's economy section says *1 million
population = 20 RP*, and its production phase says *50 RP for every 1 million population*.
Production uses the 50, since that is the rule in the phase that spends it, and
`src/campaign/economy.ts` notes the discrepancy at the constant rather than quietly picking one.

## Architecture

See `docs/architecture.md` for the full account. In brief:

```
src/
  engine/    Pure rules. No React, no I/O. Fully unit tested
  data/      Game content, authored as data: the construction catalogue, ships, scenarios
  ui/        React. The only mutable-state boundary is store.ts
  campaign/  The strategic layer
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
