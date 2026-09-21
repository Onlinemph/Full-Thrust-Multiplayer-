# Architecture

This is StarForce Commander's architecture, carried across to a different game. What follows is
what was taken, what had to change because Full Thrust is not StarForce, and why each decision is
the way it is.

## The one fact everything else falls out of

**A battle is `(setup + action journal)` and nothing else.**

The engine is deterministic and the RNG is seeded, so replaying the same actions over the same
setup reconstructs the same game exactly — every die, every threshold check, every re-roll. That
single property is what gives you:

- **Autosave.** Every action is saved as it happens. Close the tab mid-volley, come back tomorrow.
- **Undo.** Take back the last action by exact replay. A rewound beam volley re-rolls to the same
  faces, so undo cannot be used to fish for a better result.
- **Battle files.** A save is JSON: the setup and the list of actions. It opens on any machine.
- **Remote play.** Two browsers exchanging actions stay in step with no server and no authority
  beyond the host's journal. The protocol (`ui/link.ts`) does not know the wire; WebRTC
  (`ui/net.ts`) and a Supabase Realtime channel (`ui/supabaseLink.ts`) both carry it, and the
  Supabase wire also keeps the saved game in a row so a match survives a closed tab.
- **Auditing a volley.** Both players can replay the turn and see the same dice.

Two rules keep replay honest, and they are not negotiable:

1. **Action payloads carry ids and player choices only — never derived state.** Each handler
   re-derives its context (cloak state, ECM, screen level, arcs, range) from the game itself, so a
   stale or hand-edited payload cannot make a replay disagree with the original battle.
2. **A refused action mutates nothing and is refused identically on replay**, so journalling
   refusals is harmless — and necessary, because a later fix that turns yesterday's refusal into
   today's success would otherwise rewrite every old battle. That is what the rules-version stamp
   on a setup is for.

## Layers

```
src/
  engine/          Pure rules. No React, no I/O, no globals. Fully unit tested.
    types.ts         SSD schema, orders, the fifteen-phase sequence of play
    dice.ts          Seeded RNG, d6, the beam damage table, threshold and damage-control rolls
    geometry.ts      Clock-face courses, six 60-degree fire arcs, range bands, cinematic movement
    game.ts          Game state, turn and phase advance, initiative, the battle log
    movement.ts      Orders, thrust budgets, course changes, emergency thrust, squadrons
    combat.ts        FireCon allocation and the damage pipeline: screens, armour, hull, rows
    threshold.ts     Threshold checks, system knockout, core systems, damage control
    weapons/         One module per weapon family, each implementing WeaponSpec
      contract.ts      The interface. Resolvers say what the dice did; combat.ts applies it
      beams.ts         Beams, EMP, plasma cannon, grasers, phasers, needle, gatling, TPA, meson
      kinetics.ts      Pulse torpedoes, K-guns, MKP, fusion, gravitic, pulsers, turrets, spinal
    ordnance.ts      Missiles, salvo racks, rocket pods, plasma bolts, mines — launched, then flown
    defences.ts      Screens, armour ladders, PDS, ADS, scattergun, grapeshot, ADFC
    ew.ts            ECM, holofields, the three cloaks, nova cannon, wave gun, reflex field
    fighters.ts      Fighter groups, CEF, dogfights, attack runs, interception, re-arming
    gunboats.ts      Gunboat squadrons: fly like fighters, are shot at like ships
    ai.ts            One-ply search over the orders a ship may legally write
    victory.ts       The damage ladder and the points a hull concedes
    actions.ts       Every mutation the game accepts, as a named serializable record
  data/            Game content, authored as data
    buildCatalog.ts    Every hull, drive, system and weapon/arc combination with its mass and points
    designPricing.ts   The construction model: the mass fixed point, 13.5's rounding, the cost rows, validation
    generatedShips.ts  The roster, emitted by tools/build_roster.py — never hand-edited
    ships.ts           Ship designs
    scenarios.ts       Scenarios and force setup
    savedGame.ts       (setup + actions) — build, replay, parse, embed custom designs
  ui/              React. The only mutable-state boundary is store.ts
  campaign/        The strategic layer, above the tactical one
```

The dependency arrow never reverses: `ui` may import `engine` and `data`; `engine` imports neither.

## What was taken unchanged

**The mutation boundary.** The UI never mutates the game. It dispatches a `GameAction`, and one
function — `store.dispatch` — applies it, journals it, autosaves and notifies. The human, the
computer opponent and the remote peer all funnel through the same door, which is why a weapon
fired by the AI flashes on the map exactly like one you fired yourself.

**In-place mutation with a version counter.** The engine marks boxes on a ship the way a player
marks a dry-erase SSD, and the UI subscribes to a counter rather than diffing immutable trees.
Rule code reads like the rulebook because of it, and there is no reconciliation cost.

**Data, not code.** A ship is a `ShipDesign` object. Adding a fleet book means adding data. The
schema has a home for everything a printed SSD can show, so importing designs never requires an
engine change.

**Seeded, replayable dice.** Every roll goes through the `Rng` handed to it. Nothing in the engine
calls `Math.random`.

**Embedding designs in saves.** A battle file carries every non-canon ship design it references,
whole, so a save opens on a browser that has never seen the design.

## What had to change

The two games have nothing in common mechanically, so everything below the architecture is new.

| | StarForce Commander | Full Thrust |
| --- | --- | --- |
| Dice | Four coloured attack dice with lettered faces | Plain d6, read off the beam table |
| Damage | A 56-card damage deck drawn per hit | Damage points crossed off a hull track |
| Critical hits | Cards single out a named system | Threshold checks roll every system at once, at the end of a hull row |
| Ship economy | Power allocation each round across FUNCTIONS lines | Mass at design time; nothing is allocated in play |
| Geometry | Headings in degrees, eight 45-degree arcs | A twelve-point clock face, six 60-degree arcs |
| Movement | Turn templates by speed, plotted per phase | Cinematic: velocity plus a course change, plotted once a turn |
| Turn shape | Five phases, each with several segments | Fifteen phases in a fixed order |
| Defences | Shields per facing, reinforced and repaired with power | Screens as a global level, armour as ablative boxes |

Two consequences worth calling out:

**There is no resource allocation segment**, so there is no arming, no batteries and no power
model. A Full Thrust weapon fires once a turn and that is the whole rule — which is why a beam
used for point defence in phase 9 is a beam that does not fire in phase 11. That single-fire
constraint lives in `game.ts` as a per-turn set, not in each weapon.

**Damage lands on one shared track**, so `combat.ts` owns a single `applyDamage` and every weapon
family funnels into it. The `WeaponSpec` contract exists to keep that boundary honest: a resolver
says what the dice did and hands back damage; it never touches the target. How the damage lands
depends on the target's armour, its screens, and the arc it was hit from — properties of the ship,
not of the gun.

## Determinism hazards, and how they are handled

**Asking the defender a question mid-resolution.** Full Thrust asks far fewer questions than
StarForce does — there is no damage deck handing the defender a choice on every hit. Where a
choice does arise (which system a needle beam took out, which of several legal targets a missile
marker attacks), the answer must reach the journal or a replay will quietly make a different one.
The pattern is the same one StarForce uses: put the question first, on a throwaway copy of the
battle; the engine is deterministic, so the copy draws exactly what the real one is about to. The
answers are journalled as a script immediately ahead of the action that consumes it, and a scripted
answer is checked against the legal options before it is used — so a hand-edited save cannot make
a choice the rules would refuse.

**Simultaneous fire.** Full Thrust resolves ship fire in initiative order, ship by ship, with
threshold checks after each (2.6). That is an ordering, so it replays — but it means fire cannot
be batched, and the engine must not "optimise" a fleet's fire into one roll.

**Floating point on the plotting surface.** Positions are floats and ranges are compared against
band boundaries, so a course change that lands a ship at exactly 12.0 MU must resolve the same way
every time. `rangeBand` biases by a tiny epsilon so a boundary always falls in the nearer band,
and it is the only place that decision is made.

## Testing

Tests live beside the module. The rulebook's own worked examples are the best test cases that
exist — sections 3.6, 4.5, 4.6, 4.7, 4.9 and 4.11 each work a numeric example through to a stated
answer — so each one is a test, and a change that breaks a rulebook example is a change that broke
a rule.
