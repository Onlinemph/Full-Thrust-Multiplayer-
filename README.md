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
- **Ordnance** (6) — salvo missiles and their racks and launchers, extended and antimatter grades,
  heavy missiles, multi-stage missiles, rockets, plasma bolts and minefields: launched in phase 3,
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
| 11 Faster Than Light | **Not implemented.** FTL is priced and sits on the SSD; entry and exit are out |
| 12 Optional rules | Partly — sensors and ECM from 7.18/7.19, boarding from 5.9/5.18. Vector movement (12.12) is **out** |
| 13, 14 Ship construction | Covered — the construction tables encode every cost these sections state |
| 15 Imperial Tech Base | **Not implemented.** No faction availability restrictions |
| 16 Special moves | **Not implemented** — thrust-0 drives, rolling, towing, docking, ramming |
| 17 Terrain | **Not implemented** |
| 18 Battles and CPV | Points are computed; fleet-composition guidance is advisory in the fleet picker |

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
- **Ship library.** *Ships* in the top bar shows every design's real SSD, grouped by fleet.
- **Your own designs.** *Shipyard* builds a hull against the section 14 tables, with the mass bar
  fighting you the whole way, and saves it into the fleet picker beside the shipped roster. A
  battle that uses one carries its own copy, so the save file opens on a browser that has never
  seen the design.

## Ship construction

The section 14 tables — every hull row option, drive, system and weapon-at-each-arc-count — come
from the *Full Thrust Continuum Ultimate Ship Builder* spreadsheet, which encodes every cost the
rulebook's missing sections state.

Fitting a hull is a fixed point rather than a sum, because hull boxes, the main drive, FTL,
streamlining and screens are all fractions of *total mass*: a thrust-6 drive is 30% of the ship
whatever the ship, and hull boxes are 10–50% by integrity class. `tools/build_roster.py` solves for
the smallest hull that carries a declared loadout and emits `src/data/generatedShips.ts`, so no mass
or points figure in the roster is hand-written and a design cannot drift from what it costs.

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
is `(setup + move journal)` exactly as a battle is `(setup + action journal)`, and it hands battles
to the tactical engine as ordinary scenarios.

**It has no user interface yet** — it is a tested library, not a playable campaign.

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
