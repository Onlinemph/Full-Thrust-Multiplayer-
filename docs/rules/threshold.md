# Threshold points, Core Systems and damage control (4.11, 10.3, 10.4)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 4.11 and the boxed **Drive
Damage (optional)** rule that follows it (`continuum-rulebook-extract.txt` lines 695–712 and
719–735), plus the threshold sentences scattered through sections 2.4, 2.6, 6.6, 7.9 and 7.21 that
say which symbols are rolled for and how often.

**Core Systems (bridge, life support, power core) and damage control are NOT in the text extract.**
The extract is the text layer of the PDF and stops part-way through 9.2, so sections 10.3 and 10.4
are missing (see `SOURCES.md`). Everything in part 6 and part 7 below is taken from the **Full
Thrust XD Quick Reference**, cross-checked against the three places the rulebook text does touch
these systems (2.4, 5.13, 7.9). Every such rule is marked **[XD]**. Rules marked **[reading]** are
places where the sources are silent or self-contradictory and the engine has had to choose; each
one says which way it went and why.

Implemented by `src/engine/threshold.ts`; tested by `src/engine/threshold.test.ts`.

---

## 1. What a threshold point is (4.11)

> "A threshold point occurs each time the accumulated damage points reach (or pass) the end of one
> row of hull boxes on the ship's damage track."

> "At this point, the player must roll one D6 for each system on the ship not already destroyed."

Two things follow that the engine leans on:

- the check is per **row of the hull track**, not per point of damage, and not per attack;
- a system that is already crossed off is not rolled for again.

The hull track itself (which box is marked next, where the rows end) is `game.ts`'s
`markHullBoxes` / `hullRowBoundaries`; this document starts where that leaves off.

### 1.1 The target numbers

| Threshold point | Row just finished | System knocked out on |
| --: | --- | --- |
| 1st | end of row 1 | **6** |
| 2nd | end of row 2 | **5, 6** |
| 3rd | end of row 3 | **4, 5, 6** |
| 4th | end of row 4 | *no check — the ship is destroyed* |

> "At the first threshold point (the end of the first row of hull boxes), any system for which a 6
> is rolled is knocked out. At the next threshold point (end of the second row) a system is lost on
> a roll of 5 or 6; at the end of the third a roll of 4, 5, or 6. (No threshold checks need to be
> made at the end of the last hull row, since the ship is considered to be destroyed!)"

Arithmetically the target is `7 − rowsLost`, floored at 2 — `thresholdTarget()` in `dice.ts`. The
floor matters only for the 5- and 6-row hulls of 13.7, which reach a 5th and 6th threshold point:
the book stops writing targets out at the third, and 7 − 5 = 2 would otherwise become 1, i.e. an
automatic loss. **[reading]** A 2+ at the fifth row is kept (`Math.max(2, …)` in `dice.ts`)
because a check nothing can pass is not a check.

Failure is on a **high** roll, and the book says why:

> "(Threshold check failures occur on high rolls rather than low to help balance good and bad game
> outcomes across die rolls, and to provide extra opportunities for players to grumble about the
> iniquities of fate.)"

That sign convention decides what every DRM below means, so it is worth stating plainly: **a plus
on the die makes a system easier to lose; a minus protects it.**

### 1.2 Crossing several rows at once

> "If a ship suffers enough damage in a single phase (such as the Missile/Fighter phase or the Ship
> Fire Phase) to push it over more than one threshold check, make only one check (for the last row
> destroyed) but add 1 to each die roll for each extra threshold point passed in that attack."

One check, at the **last** row's target, **+1 per extra row**. Not one check per row.

**Worked example (4.11), implemented as a test:**

> "A ship with 12 hull boxes in four rows of three takes 7 damage points from another ship in one
> attack, crossing off two complete rows. At the end of the second row systems are normally lost on
> a roll of 5 or 6, but this time they will be lost on 4-6. If the ship is fired on again and takes
> 3 more points of damage, the third row will be crossed off, but since only one row was lost the
> threshold check rolls will be as normal, 4+."

| Event | Hull marked | Rows crossed | Check | Target | Effective |
| --- | --: | --: | --- | --: | --- |
| 7 damage | 7 / 12 | rows 1 and 2 | `rowsLost 2, extraRows 1` | 5+ | **4+** on the natural die |
| 3 more damage | 10 / 12 | row 3 | `rowsLost 3, extraRows 0` | 4+ | **4+** |
| 2 more damage | 12 / 12 | row 4 | — | — | ship destroyed, no check |

### 1.3 When the checks are rolled (2.6)

Continuum moves the roll to a phase of its own, and the optional Drive Damage box confirms it —
"In the original version of Full Thrust a ship made threshold checks every time it crossed off one
row of hull boxes **instead of rolling at the end of the turn**".

| Phase | Rulebook text | Engine |
| --- | --- | --- |
| 10 Missiles and fighters attack ships | "Damage resulting from these attacks is applied immediately, **including threshold point checks if applicable**." | roll the sweep at once |
| 11 Ships fire, 12 Boarding | — | accumulate |
| 13 Threshold checks | "All ships roll threshold checks from damage incurred in phase 11 and 12 if required. Note - do not roll for enemy boarders that 'landed' on the current turn." | one sweep per ship |
| 15 Reactor explosions | "If the reactor explodes apply damage to adjacent ships if necessary and **roll additional threshold checks for them**." | roll the sweep at once |

`game.ts`'s `thresholdResolution(phase)` already encodes that split; `rollThresholdChecks()` is the
same function in all three cases, which is why it takes a ship and not a phase
(`thresholdCheckForShip()` is the same roll against a live game, with the battle log written).
Rows crossed in phase 10 are therefore checked before, and separately from, rows crossed in phase
11 — exactly what "in a single phase" in 4.11 asks for.

### 1.4 Which symbols are rolled for

"One D6 for each system on the ship not already destroyed" (4.11), where a *system* is a symbol on
the SSD (2.4). The engine's list, in the order it rolls them:

| Order | Symbols | Authority |
| --: | --- | --- |
| 1 | main drive | 4.11, 2.4 ("the bottom row of the SSD are the symbols for the FTL and main drive") |
| 2 | every weapon mount | 4.11; 6.6 "Each counts as one system for threshold point checks" |
| 3 | every turret | 5.22: "A turret is a system that appears on the SSD with the weapons within. If the turret is damaged due to a threshold test … it remains stuck in its current facing until repaired." The turret **and** the weapons inside it are separate symbols and each rolls. |
| 4 | every other system box: FireCon, PDS/ADS/ADFC, ECM, screens *(one die per generator)*, sensors, hangar bays, magazines, damage control parties, marine parties, cargo … | 4.11; 6.6 "Magazines and launchers are considered separate systems for threshold point checks" and "one magazine is rolled for as a single system, regardless of its capacity" |
| 5 | FTL drive | 2.4 |
| 6 | Core Systems: bridge, life support, power core | 2.4 "the optional Core Systems" are on the SSD |

Not rolled for:

- **armour** — 4.8: "There is no threshold check roll (see below) made at the end of the row of
  armor"; armour boxes are not systems;
- **hull boxes** — they *are* the track;
- **a mount already crossed off** — 4.11; 6.6 says a fired Heavy Missile or SMR "is crossed off and
  cannot be used again", so the engine skips a one-shot mount whose ammunition is spent
  (`ammo === 0`). **[reading]** the book never says to keep rolling for a symbol that is already
  struck through.

Ordering within the sweep only matters for reproducibility — the same seed must give the same
battle — but the book does have advice on it, and the engine follows it where it can:

> "In the same way you should roll as many threshold checks at once as you can, rather than one by
> one. If a ship has three PDS, or FireCon, or similar systems, just roll three dice at once and
> cross off the destroyed systems from left to right. For weapons with limited fire arcs, it does
> matter if, for example, the port beam is knocked out rather than the starboard. … If there are
> three Beam-3 symbols arranged left to right, then roll three dice: the one that lands most to the
> left is for the corresponding leftmost symbol."

The engine rolls one die per symbol in **SSD order** (the order the mounts appear in the design),
which is the "left to right" the text asks for, so an arc-limited mount is knocked out as its own
die says and never as a sibling's.

### 1.5 Systems with more than one damage box

7.21, of the Cloaking Field:

> "A Cloaking Field has two 'damage points' or boxes. If both boxes remain unchecked the system
> operates as above. If one of its damage boxes has been checked off for any reason the cloak
> operates as a standard cloak. **When making threshold checks roll for BOTH damage boxes**, it is
> possible, and perhaps likely, that a ship receiving crippling damage in a single turn will lose
> its cloaking ability altogether."

So a multi-box symbol rolls one die **per box**. The engine holds a per-`SystemKind` box count
(only the Cloaking Field has one today) and records part-damaged boxes as `id#1`, `id#2` … in the
same `destroyedSystems` set the rest of the engine reads, adding the bare `id` only when the last
box goes. Any module that asks `isSystemDestroyed(ship, id)` therefore sees the cloaking field die
only when both boxes are gone, which is what 7.21 describes.

### 1.6 Modifiers on the check

| Modifier | Value on the die | Source |
| --- | --: | --- |
| extra rows crossed in this attack | **+1 each** | 4.11 |
| Core System (bridge, life support, power core) | **−1** | 7.9, in the Antimatter Suicide Charge's rules: charges "get a -1 DRM whenever they take threshold tests **(like Core Systems)**" — the parenthesis is the only statement of the Core Systems DRM anywhere in the extract, and it is unambiguous |
| Antimatter Suicide Charge | −1 | 7.9 — carried by the `antimatter-charge` system kind |
| Flawed Design (13.13) | **+1** **[reading]** | see below |

**[reading] Flawed Design.** Section 13.13 is not in the extract. `types.ts` records the trait as
"+10% mass, −20% points, **−1 DRM on threshold checks**". Taken as −1 on the die that would make a
flawed ship's systems *harder* to knock out, i.e. a flaw that improves the ship, which cannot be
the intent next to a −20% points rebate. The engine reads "−1 DRM" as −1 on the **target number**
(systems lost on 5+ at the first threshold point instead of 6), which is arithmetically the same as
+1 on the die and is what the trait is charged for. `ThresholdSweepOptions.flawedDrm` overrides it
for a group that reads 13.13 the other way.

---

## 2. The main drive is the exception (4.11)

> "As each system is knocked out as a result of a threshold check it is crossed off the diagram,
> with the exception of the ship's main drive system. When the drive first suffers a 'destroyed'
> roll on a threshold check it is reduced to half the original thrust rating, provided it has a
> drive rating above 1. If it is then hit a second time on a subsequent threshold check, it is
> disabled completely. A drive rated only 1 is immediately disabled by the first threshold
> failure."

| Failures | Thrust |
| --: | --- |
| 0 | printed rating |
| 1 | **half** the *original* rating — half of the printed number, never half of half |
| 2 | 0, disabled |
| 1, on a rating-1 drive | 0, disabled |

**[reading] Which way half rounds** is not stated. Down: it is the only reading under which the
last sentence is a restatement rather than an exception, since half of 1 rounded down is already 0.
`movement.ts` (`currentThrust`) and `game.ts` (`currentThrust`) both round down; this module records
hits through `game.ts`'s `destroySystem(ship, 'drive')`, so all three agree by construction.

Drive damage is **repairable** — 3.6, on emergency thrust: "Damage to the main drive from ET may be
repaired normally by Damage Control Parties." One successful repair takes back one hit.

### 2.1 Drive Damage (optional) — the boxed rule after 4.11

> "In the original version of Full Thrust a ship made threshold checks every time it crossed off one
> row of hull boxes instead of rolling at the end of the turn. Ships also fired at each other in
> initiative order as opposed to simultaneously. This made it more likely for ships to lose their
> drives than the current system. To correct this, players should make **two threshold rolls for the
> drive during phase 13 IF the ship lost two or more rows of hull boxes**. The first hit reduces the
> available thrust by half; the second reduces it to 0."

Behind `ThresholdSweepOptions.driveDamage`. Off by default: it is an optional rule.

**[reading] "lost two or more rows"** is read as *rows crossed since the last check* — i.e. this
check covers two or more rows (`extraRows >= 1`) — not *rows lost over the ship's life*. The box
states its own rationale: under the original rules a ship that crossed two rows in a turn made two
separate sets of checks, and therefore two drive rolls, where Continuum's single check with a +1
gives it one. Restoring the second roll exactly where the old sequence had one is what "to correct
this" asks for. The cumulative reading would also fire on a single-row check, which the old rules
never did. Both rolls are made even if the first disables the drive, because the rule says two.

---

## 3. What a threshold check never does

- It does not destroy the ship. A ship dies when the last hull box is crossed off (2.4), which is
  also why there is no check at the end of the last row.
- It does not damage armour or hull.
- It does not repair anything.
- It is not rolled for a ship already destroyed, nor for one that owes no rows.

---

## 4. Damage control (10.4, phase 14) **[XD]**

> Phase 14 (2.6): "Damage control Phase. Make any Damage Control repair rolls. If the Core System
> rules are being used, proceed to the next step."

Rules, from the XD quick reference:

- up to **three** damage control parties may work on **one** system;
- the system is repaired on a **d6 at or below the number of parties assigned**;
- damage control can fix bridge, life support and power core damage as well as ordinary systems —
  everything except a ship that is **permanently** out of control.

| Parties on the system | Repaired on | Chance |
| --: | --- | --: |
| 1 | 1 | 1/6 |
| 2 | 1–2 | 2/6 |
| 3 | 1–3 | 3/6 |

`damageControlRoll()` in `dice.ts` is that roll and caps the parties at three; `assignDamageControl()`
in `game.ts` enforces the per-system limit and stops a ship from assigning parties it does not have.
Parties are themselves symbols on the SSD (`damage-control-party`), so a threshold check can cross
them off and a ship can lose its ability to repair.

Repairs the engine refuses, each with a rule behind it:

| Refused | Why |
| --- | --- |
| a system that is not damaged | nothing to fix |
| a ship that is destroyed | — |
| a ship whose life support has already failed **[reading]** | there is no crew left to send |
| the bridge of a ship that is **permanently** out of control | XD: damage control fixes all of these "except permanently out of control" |
| anything the caller lists as unrepairable | 5.13 "Systems destroyed by Needle Beam fired cannot be repaired by Damage Control Parties"; 5.14 a Pulse Torpedo tube that self-destructs on a double 1 "may not be repaired by DCPs"; 6.x an Antimatter Missile that explodes on the rack "obviously cannot be later repaired by damage control". The weapon modules own those facts, so they pass the ids in — this module invents no list of its own. |

A repair takes back **one** box: one drive hit, one box of a multi-box symbol, or the whole symbol
for an ordinary single-box system.

---

## 5. Core Systems (10.3) **[XD]**

The block is optional (2.4 calls it "the optional Core Systems") and is carried on
`ShipDesign.coreSystems`. Each of the three is a symbol on the SSD, is rolled for in every threshold
check at **−1 DRM** (7.9), and cannot be singled out by a Needle Beam — 5.13 says needle beams may
target "any system that appears on the SSD (the only exceptions being Stealth Hulls, Biotech
generators and Core Systems)".

### 5.1 Bridge **[XD]**

Roll one d6 when the bridge box is knocked out:

| d6 | Result |
| --: | --- |
| 1–5 | the ship is **out of control for that many turns** |
| 6 | the ship is **permanently out of control** |

**[reading] What "out of control" costs.** The quick reference names the state but not its effects.
The engine takes the plainest table meaning — nobody is left to give the ship orders — so while it
lasts the ship writes no movement order and spends no thrust: it holds its course and velocity. It
is modelled as an `OngoingEffect` with `source: 'bridge'` carrying a `thrustPenalty` equal to the
printed drive rating, so `currentThrust()` reads 0 without any other module needing to know why, and
`isOutOfControl()` says so explicitly. The engine does **not** stop the ship firing: gunnery runs off
FireCon (4.4), which is a separate symbol with its own check.

The count starts with the **next** turn: orders for the current turn were written in phase 1, long
before the bridge was hit in phase 13. A roll of 3 in turn 4 leaves the ship out of control for
turns 5, 6 and 7 (`expiresAfterTurn = 7`), and `game.ts`'s turn rollover retires the effect.

### 5.2 Life support **[XD]**

Roll one d6 when the life support box is knocked out: **life support fails after that many turns.**
A roll of 1 in turn 4 means the ship is still fighting for turn 4 and the crew is lost in turn 5; a
roll of 6 gives it six more turns. Damage control can repair the box at any point before then and
the countdown is cancelled.

**[reading] What failure costs.** Not stated. The engine marks the ship a derelict: a permanent
`OngoingEffect` (`source: 'life-support-failed'`) that zeroes thrust and takes every weapon offline,
and `isDerelict()` returns true. The ship is **not** removed from play — it is a hulk, not a wreck,
and the scenario rules on what a hulk is worth (18.3 counts a crippled ship at 50%). Nothing else in
the engine is allowed to assume more than that.

### 5.3 Power core **[XD]**

When the power core box is knocked out, the ship is left with a breached core: **at the end of each
turn roll a d6, and on a 5 or 6 the core explodes and destroys the ship.** The roll is phase 15,
"Roll for Reactor explosions Phase", and it repeats every turn until the core is repaired or the ship
goes up.

The rulebook's only comparable rule, 7.9's Antimatter Suicide Charge, works the same way and is
worth quoting because it settles the timing and the ordering against damage control:

> "Mark the Antimatter Suicide Charge as damaged as you would any other system. **During the Damage
> Control Phase the player may attempt to repair it. If the Antimatter Suicide Charge is not repaired
> by the end of the turn roll a die. On a 5 or 6 the Antimatter Suicide Charge explodes** … Roll
> every turn until the damage is repaired or an explosion occurs."

So: phase 13 knocks the core out, phase 14 is the chance to save it, phase 15 rolls. A core repaired
in phase 14 is never rolled for.

**[reading] Blast damage to neighbours.** Phase 15 says "apply damage to adjacent ships if necessary
and roll additional threshold checks for them", but neither the rulebook extract nor the quick
reference gives the power core's blast radius or dice. The engine therefore destroys the ship and
reports it; it invents no blast. (7.9's charge does state one — 3d6 at 1 MU falling to 1d6 at 3 MU —
but that is a different system, deliberately fitted as a weapon, and its rules belong to the module
that owns 7.9.) When another module does apply blast damage, the threshold checks phase 15 asks for
are `rollThresholdChecks()` again, on the neighbours, immediately.

**[reading] A breached core before it explodes** is assumed to do nothing else. `game.ts` speculates
about "a power core running at half output (10.3)"; no source in this repository states such a rule,
so none is implemented.

---

## 6. Order of play within phases 13–15

1. **Phase 13**, per ship, in the order the ships sit in the game state:
   1. advance the Core Systems clocks (a life-support countdown that has run out kills the crew now);
   2. if rows are owed, roll the sweep: drive first, then weapons, turrets, systems, FTL, Core
      Systems, one die per box;
   3. apply each failure as it is rolled — a failed Core System rolls its own d6 immediately;
   4. mark the owed rows as checked.
2. **Phase 14**, per ship: resolve each damage control assignment, then clear the assignments.
3. **Phase 15**, per ship with a breached core: one d6, 5–6 destroys it.

---

## 7. What `threshold.ts` exports

| Export | Rule |
| --- | --- |
| `thresholdPhase(state, opts?)` | phase 13 over the whole fleet (2.6, 4.11) |
| `thresholdCheckForShip(state, ship, opts?)` | one ship's check against a live game, for the immediate checks of phases 10 and 15 |
| `rollThresholdChecks(ship, rng, opts)` | the pure sweep: no game state, no log |
| `checkableSystems(ship)` | the symbols that owe a die, in SSD order (4.11) |
| `damageControlPhase(state, opts?)` | phase 14 over the whole fleet (10.4) |
| `repairSystem(ship, id, parties, rng, opts)` | one repair attempt (10.4) |
| `reactorExplosionPhase(state)` | phase 15 (10.3) |
| `knockOutCoreSystem(ship, which, turn, rng)` | a Core System's consequence roll, for anything that kills one outside a threshold check — a needle beam cannot, but boarders and scenario events can (10.3) |
| `advanceCoreSystems(ship, turn)` | the Core Systems clocks (10.3) |
| `isOutOfControl`, `isPermanentlyOutOfControl`, `outOfControlTurnsRemaining`, `lifeSupportFailsOnTurn`, `isDerelict` | what the movement, fire and UI modules ask (10.3) |
| `systemBoxesLost(ship, id, boxes)` | how far through a multi-box symbol the damage has got (7.21) |
| `CORE_SYSTEM_IDS`, `DRIVE_SYSTEM_ID`, `FTL_SYSTEM_ID`, `THRESHOLD_EFFECT_SOURCES`, `SYSTEM_DAMAGE_BOXES`, `CORE_SYSTEM_DRM`, `FLAWED_DESIGN_DRM` | the constants the rest of the engine needs to name the same things |

State lives on `ShipState` in `game.ts` and nowhere else: `hullMarked`, `pendingThresholdRows`,
`hullRowsChecked`, `destroyedSystems`, `driveHits`, `core` and `ongoing`. A half-damaged multi-box
symbol is held in the same `destroyedSystems` set as `id#1`, `id#2` … so nothing new has to be
saved, loaded or replayed.

---

## 8. Cross-references this module deliberately does not implement

| Rule | Owner |
| --- | --- |
| 5.4 EMP threshold tests (their own target numbers, "+1 for each row of hull boxes checked off") | the EMP weapon module — it is a different check with a different trigger, not a threshold point |
| 5.13 Needle beams picking a single system | the needle beam module; it destroys a system outright and passes the id here as unrepairable |
| 7.9 Antimatter Suicide Charge detonation | the system's own module; this module only gives it its −1 DRM |
| 7.23 Wave gun discharge when knocked out while charged ("the carrying ship suffers damage equal to the current charge") | the spinal mount module, off `ThresholdSweepResult.destroyedIds` |
| 6.6 a destroyed magazine's loads, and "If an Antimatter Missile fails a threshold test it explodes on the rack, immediately doing 1d6 damage to the carrying ship, and 1d6 damage to any unit within 1 MU" | the ordnance module, off `ThresholdSweepResult.destroyedIds` |
| 3.6 emergency thrust inflicting drive hits "as if it had failed a threshold roll" | `movement.ts`, which applies them through the same one-hit-halves, two-hits-disables ladder |
