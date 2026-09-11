# Sequence of play — the game turn (2.5, 2.6)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 2.5 and 2.6
(`continuum-rulebook-extract.txt` lines 229–328), plus the two rules elsewhere in the book that
decide what a phase may spend: FireCon allocation (4.4, 5.2) and threshold points (4.11).

Implemented by `src/engine/game.ts`; tested by `src/engine/game.test.ts`.

---

## 1. The game turn (2.5)

> "A game turn in Full Thrust represents about five to ten minutes of action."

> "Both (or all) sides perform the same actions in a single turn. **When the order matters, players
> alternate one ship at a time, not by entire fleet.**"

That last sentence is the rule the whole sequence hangs on. Wherever a phase says players alternate,
the unit of alternation is one **ship** (phases 3 and 11) or one **fighter/gunboat group**
(phases 4 and 6) — never a whole fleet, never a whole salvo, never a whole squadron.

> "Full Thrust does not track power consumption, fuel consumption, or ammunition supply other than
> for one-shot weapons."

So the engine carries no fuel or power counters. `WeaponDef.ammo` exists only for one-shot and
magazine-fed systems (6.6, 7.14).

---

## 2. The fifteen phases (2.6)

Phase numbers below are the rulebook's own. `Phase` and `PHASE_ORDER` are defined in
`src/engine/types.ts`; this document only says what happens in each and **who goes first**.

| # | Phase | `Phase` id | Order within the phase | Alternates by |
| --: | --- | --- | --- | --- |
| 1 | Write orders | `orders` | Simultaneous and secret | — |
| 2 | Roll for initiative | `initiative` | Simultaneous (one D6 each) | — |
| 3 | Launch missiles / ordnance / fighters / gunboats | `launch-missiles` | **Initiative loser first** | ship |
| 4 | Move fighter groups / gunboat squadrons | `move-fighters` | **Initiative loser first** | fighter group |
| 5 | Ship movement | `move-ships` | Simultaneous, with a fixed sub-order (below) | — |
| 6 | Secondary fighter / gunboat moves | `secondary-fighter-moves` | Same order as phase 4 → **loser first** | fighter group |
| 7 | Allocate missile and fighter/gunboat attacks | `allocate-attacks` | Simultaneous | — |
| 8 | Fighters against fighters or missiles | `fighter-vs-fighter` | Simultaneous | — |
| 9 | Point defence fire | `point-defence` | Simultaneous — declare all targets, then roll | — |
| 10 | Missiles and fighters attack ships | `ordnance-vs-ships` | Simultaneous | — |
| 11 | Ships fire | `ship-fire` | **Initiative winner first** | ship |
| 12 | Boarding actions | `boarding` | Simultaneous | — |
| 13 | Threshold checks | `threshold` | Simultaneous | — |
| 14 | Damage control | `damage-control` | Simultaneous | — |
| 15 | Roll for reactor explosions | `reactor-explosions` | Simultaneous | — |

**Initiative is not the same answer in every phase.** The winner launches and moves *last* (phases
3, 4, 6) and fires *first* (phase 11). Reading the book in order:

- Phase 3: *"The player who lost initiative launches first."*
- Phase 4: *"The player who lost initiative moves first."* — restated from the other end in 8.5:
  *"Players alternate in moving one fighter group each until all have been moved (if desired), with
  the player who won initiative for this turn moving second."*
- Phase 6: 8.5 — *"Whoever moved first in the main Fighter Movement Phase must also move first in
  the Secondary Move Phase."* So phase 6 inherits phase 4's order, i.e. loser first.
- Phase 11: *"Starting with the player who won initiative, each player alternates in firing any/all
  weapon systems on one ship…"*

In the engine these three cases are `'initiative-last'`, `'initiative-first'` and `'simultaneous'`
in `PHASE_SEQUENCE`.

### Phase-by-phase detail

**1. Write orders.** *"Each game turn starts with both players simultaneously (and secretly)
writing the movement orders for all the ships they control."* Also in this phase:
*"Announce ships entering by FTL and place markers at each designated entry point"* and *"Announce
ships entering or leaving a squadron"* — which matches 3.7: *"Squadrons can be formed or broken at
the start of the game turn, before writing movement orders."*
Orders are secret, so an order log entry is visible only to the side that wrote it.

**2. Roll for initiative.** *"Players roll a D6 each; highest roll has initiative for this turn. (If
there are more than two players, the winner decides the order for the others.)"*
Rolled fresh **every turn**.
*Ties:* the book does not say. The table reading, and the one implemented, is that the tied leaders
roll again — only among themselves, so the rest of the ranking is untouched — until one is highest.
*More than two players:* the engine seeds the order from the first round's rolls (highest first,
declaration order breaking equal rolls) and `setInitiativeOrder` lets the winner rearrange everyone
behind them, which is exactly the discretion the rule grants.

**3. Launch.** *"Both players alternate in announcing and placing Heavy Missiles, Salvo Missiles, or
any similar ordnance weapons as well as fighters/gunboats. **Players alternate by ships, not by
missile salvo or squadron.** The player who lost initiative launches first."*
Launching a salvo or heavy missile needs an operational FireCon (5.2, 6.3) — see §4 below.

**4. Move fighter groups.** *"Both players alternate moving one previously launched fighter/gunboat
group each, until all fighter groups in play have been moved (if desired). **All fighter groups
being launched this turn must be moved before those already in flight.** The player who lost
initiative moves first. Any group may declare it is screening or pursuing instead of making a normal
move."*

**5. Ship movement.** Simultaneous — *"Both players simultaneously move their ships strictly in
accordance with orders written in phase 1"* — but with an internal ordering that the engine encodes
as a rank:

1. *"Any asteroids, starbases, or other objects with fixed movement paths are moved first."*
2. *"Ships laying mines are moved before all others."*
3. Everything else.
4. *"Ships entering or exiting FTL are moved or placed last."*

*"Screening or pursuing fighter groups are moved at the same time with the appropriate ship"* (also
8.6), and *"Resolve collisions, mine sweeping, or mine attacks as they occur."*

**6. Secondary fighter moves.** *"Fighter groups may, if desired, make a secondary move in this
phase."* 8.5 puts it at up to 12 MU and costs 1 CEF.

**7. Allocate missile and fighter attacks.** *"All missiles and fighter groups that are within the
specified attack ranges of suitable targets (and wish to attack …) are moved into attack positions."*
This is a declaration phase: nothing is rolled.

**8. Fighters against fighters or missiles.** *"Fighter vs. fighter actions (dogfights), attempted
fighter interceptions, fighter groups defending against missile attacks, and screening actions by
fighters are resolved **before** actual point defense fire is allocated to surviving ships."*

**9. Point defence fire.** *"Any ship under missile and/or fighter/gunboat attack allocates its
defenses against attacking elements, then rolls for effect. As with ship fire, **announce all
targets before rolling any dice**. … A ship that wishes to shoot at multiple fighter groups or
missiles must divide point defense weapons between them before rolling any dice."* Ships with ADFC
may fire in defence of other ships. Point defence does **not** need a FireCon (4.4: *"Point defense
fire against fighters or missiles does not require the use of the ship's main FireCon systems"*).

**10. Missiles and fighters attack ships.** *"All missiles and fighter/gunboat groups that survived
defensive fire in the previous phase now have their attacks resolved. **Damage resulting from these
attacks is applied immediately, including threshold point checks if applicable.**"* — the one place
a threshold check happens outside phase 13.

**11. Ships fire.** *"Starting with the player who won initiative, each player alternates in firing
any/all weapon systems on one ship at one or more targets (ships or fighter/gunboat groups) subject
to available fire control. Armor and hull damage caused is applied immediately but **all fire is
considered simultaneous**."*
*"The player must declare all the fire for his ship, before any dice are rolled."*
*"**After a ship has fired some or all of its weaponry and play has moved on to another ship that
ship may not fire any other ship to ship weapons in that game turn.**"* — one firing activation per
ship per turn; passing on a weapon spends it.
*"A single target ship may, of course, be fired on more than once in the turn by different
attackers."*

**12. Boarding actions.** *"All ships that have enemy boarders onboard roll for effects in
accordance with the Boarding rules."*

**13. Threshold checks.** *"All ships roll threshold checks from damage incurred in **phase 11 and
12** if required. Note - do not roll for enemy boarders that 'landed' on the current turn."*
So checks are batched at the end of the turn, after all fire, not during it. The engine keeps
`pendingThresholdRows` on each ship and only phase 13 (or phase 10, per the quote above) drains it.
The boarder note is carried as `BoardingParty.landedTurn`.

**14. Damage control.** *"Make any Damage Control repair rolls. If the Core System rules are being
used, proceed to the next step."*

**15. Reactor explosions.** *"If the reactor explodes apply damage to adjacent ships if necessary and
roll **additional threshold checks for them**."* Damage dealt here therefore resolves its checks
immediately — phase 13 is already past.

### The rule that ties the phases together

> "In Full Thrust weapons can only be used once per turn, so **any system used for point defense can
> only be directed against a single fighter group or missile, and cannot be used again in that turn
> against a ship.**"

A weapon spent on point defence in phase 9 is not available in phase 11. The engine tracks this per
weapon id as `ShipState.weaponsFired: Map<weaponId, Phase>` — the phase is kept so the battle log
can say *why* a beam was unavailable. Cleared at the start of each turn, never between phases.

### Variations and information (2.6)

> "Many players combine the Point Defense Phase and Missile/Fighter attack Phases."

Not implemented as a mode; phases 9 and 10 stay separate.

> "Before writing movement orders, players can ask opponents for the last known velocity and course
> (i.e. at the end of the previous turn's Ship Movement Phase) of any ships. **Ships that were under
> cloak the previous turn are exempt from this requirement.**"

Implemented: leaving phase 5 stamps each uncloaked ship's course and velocity into
`ShipState.lastKnown`; `lastKnownVector` returns `null` for a ship that was cloaked when the stamp
was taken.

> "Most games are played as 'open book' … Players do not have access to enemy SSDs when using the
> optional Sensors and ECM rules in section 12.0."

So the battle log defaults to `visibleTo: 'all'`, and entries that are genuinely secret (written
orders) name the sides that may read them.

### Introductory scenario

> "For the Introductory Scenario you will need only phases 1, 2, 5, 11, and 13."

`INTRODUCTORY_PHASES` is exactly that list, and a `GameState` built with it skips every other phase
when advancing.

---

## 3. Initiative — the numbers

| Item | Value | Rule |
| --- | --- | --- |
| Dice | 1D6 per side, re-rolled every turn | 2.6 phase 2 |
| Winner | Highest roll | 2.6 phase 2 |
| Tie | Tied sides re-roll among themselves (table reading; book silent) | 2.6 phase 2 |
| >2 players | Winner decides the order of the others | 2.6 phase 2 |
| Effect, phases 3/4/6 | Winner acts **last** | 2.6, 8.5 |
| Effect, phase 11 | Winner acts **first** | 2.6 |

---

## 4. What a phase may spend

### FireCon (4.4, 5.2) — per phase, not per turn

> "Each FireCon system permits the ship to engage one target during the firing portion of a turn."
> (4.4)

> "An operational FireCon is needed for each of the following **in each phase of a turn**: firing
> ship weapons (not point defense) at a single ship or fighter group; firing Needle Beam weapons
> against a single ship system; launching Salvo or Heavy Missiles. **To avoid the need for record
> keeping these limitations are per phase, not per turn, so a FireCon used to launch missiles can
> also be used to direct other weapons in the Ship Fire Phase of the same turn.**" (5.2)

Consequences encoded in `game.ts`:

- Capacity: one per operational `firecon`, **two** per operational `advanced-firecon`
  (5.2: *"Advanced FireCon systems can track two separate targets each, acting just like two normal
  FireCons"*).
- Assignments are cleared on every phase boundary, so a FireCon used in phase 3 is free again in
  phase 11.
- Two weapons firing at the same target in the same phase share one FireCon; a second target costs a
  second (4.4).
- Point defence consumes no FireCon (4.4).
- Each fighter group engaged counts as a target: *"Each fighter group targeted requires a FireCon as
  if it were a ship"* (4.4).

### Weapons — once per turn

Tracked per weapon id for the whole turn (2.6, quoted above). Ship-level, one firing activation per
turn in phase 11 (`hasFiredThisTurn`).

### Damage control parties (10.4)

Up to three parties may be assigned to one system, and `damageControlRoll` in `dice.ts` repairs on a
D6 at or below the number assigned. Section 10 is **not** in the text extract (see `SOURCES.md`), so
the engine only holds the assignments; the rule itself is cited from the XD quick reference via
`dice.ts`.

---

## 5. The hull track, rows and threshold accounting (2.4, 4.11)

> "When damage is inflicted, these points are marked off the target ship's hull boxes on its SSD,
> starting at the top left and crossing out one box per damage point inflicted. **When you reach the
> end of one line of boxes, this is a threshold point** … When a ship has had all of its hull boxes
> crossed out (i.e. it is reduced to 0 damage points or less) then it is considered destroyed and
> removed from play." (2.4)

> "If a ship suffers enough damage in a single phase … to push it over more than one threshold
> check, **make only one check (for the last row destroyed) but add 1 to each die roll for each
> extra threshold point passed in that attack**." (4.11)

> "(No threshold checks need to be made at the end of the last hull row, since the ship is considered
> to be destroyed!)" (4.11)

**Row sizes.** The rulebook prints a track of `hullRows` rows; where `hullBoxes` does not divide
evenly, the engine puts the spare boxes in the *earlier* rows, which is how the printed SSDs read
(26 boxes in 4 rows → 7, 7, 6, 6; boundaries at 7, 14, 20, 26). An imported SSD that splits them
differently can override with `hullRowSizes`.

**Worked example (4.11), implemented as a test:**

> "A ship with 12 hull boxes in four rows of three takes 7 damage points from another ship in one
> attack, crossing off two complete rows. At the end of the second row systems are normally lost on a
> roll of 5 or 6, but this time they will be lost on 4-6. If the ship is fired on again and takes 3
> more points of damage, the third row will be crossed off, but since only one row was lost the
> threshold check rolls will be as normal, 4+."

| Step | `hullMarked` | rows crossed | pending check | target (`thresholdTarget`) | effective |
| --- | --: | --: | --- | --: | --- |
| 7 damage | 7 | 2 | `rowsLost 2, extraRows 1` | 5 | 4+ |
| resolve | 7 | — | none | — | — |
| +3 damage | 10 | 1 | `rowsLost 3, extraRows 0` | 4 | 4+ |

`pendingThresholdCheck(ship)` returns `{ rowsLost, extraRows }` for `thresholdCheck()` in `dice.ts`
and `resolvePendingThreshold(ship)` clears it. The *when* is `thresholdResolution(phase)`:

| Phase | Resolution | Rule |
| --- | --- | --- |
| 10 `ordnance-vs-ships` | immediate | 2.6 phase 10 |
| 15 `reactor-explosions` | immediate | 2.6 phase 15 |
| every other phase (11 and 12 among them) | deferred to phase 13 | 2.6 phase 13 |

Damage from a source the book does not name in this context — a phase-5 collision (3.8), say —
falls through to the default and is checked in phase 13, which is the nearest reading of *"All ships
roll threshold checks from damage incurred in phase 11 and 12."*

---

## 6. State model

`GameState` holds: `turn`, `phase`, the `phases` actually in play, the seeded `Rng`, `sides`,
`ships`, `fighterGroups`, `missiles`, `terrain`, this turn's `initiative`, and the `log`.

`ShipState` is the mutable dry-erase SSD: `placement` + `velocity` + this turn's `order` and
`thrustUsed`; `hullMarked`, `armourMarked` per layer, `destroyedSystems`, `driveHits`;
`weaponsFired`, `hasFiredThisTurn`, `fireconAssignments`, `damageControl`; `core` (bridge, life
support, power core and a pending reactor explosion) plus `ongoing` effects with an expiry turn;
`boarders`; and the `destroyed` / `offTable` flags that take a ship out of `activeShips`.

**Per-turn reset** (start of phase 1): `order`, `thrustUsed`, `weaponsFired`, `hasFiredThisTurn`,
`layingMines`, `ftlTransit`, fighter `movedThisTurn` / `secondaryMovedThisTurn` /
`attackedThisTurn` / `dogfightWith`, and expired ongoing effects.
**Per-phase reset**: `fireconAssignments` only (5.2).
`pendingThresholdRows` is deliberately *not* reset by the clock — only by
`resolvePendingThreshold`.

---

## 7. Not implemented here, and why

| Thing | Status |
| --- | --- |
| FTL entry and exit (phases 1 and 5) | State only: `ftlTransit` flags a ship and ranks it last in phase 5. Section 11 is not in the text extract (`SOURCES.md`). |
| Terrain effects | `TerrainFeature` carries position, radius and kind so phase 5 can move fixed-path objects first; section 17 is not in the extract, so no effects are applied. |
| Squadron movement (3.7) | `ShipState.squadronId` records membership and phase 1 is where it may change; moving a squadron as one unit belongs to the movement module. |
| Combined phases 9+10 ("Variations", 2.6) | Not offered; the phases stay separate. |
| Vector movement (3.10, 12.12) | Not implemented anywhere in the engine. `placement.facing` therefore doubles as the ship's course. |
