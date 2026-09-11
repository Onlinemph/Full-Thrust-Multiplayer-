# Combat: firing and damage (section 4)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 4 "Cadet Training"
(`continuum-rulebook-extract.txt` lines 529–713), plus 7.6–7.8 (armour, shell/layered armour,
regenerative armour, lines 1575–1611) and the "Rolling dice" sidebar at line 738.

Implemented in `src/engine/combat.ts`. Tested in `src/engine/combat.test.ts`.

What lives elsewhere and is *used* by this module, not re-implemented:

| Thing | Where | Why |
| --- | --- | --- |
| The beam damage table and re-rolls | `dice.ts` (`beamDamage`, `rollBeamVolley`) | one place a die can enter the engine |
| Range bands and dice-at-range | `geometry.ts` (`rangeBand`, `beamDiceAtRange`) | 4.3 is measurement, not damage |
| Fire arcs | `geometry.ts` (`arcTo`, `bearsOn`, `isRearArcAttack`) | same |
| The threshold check roll itself | `dice.ts` (`thresholdTarget`, `thresholdCheck`) | phase 13 rolls it; this module only says *when* and *how many rows* |
| Per-weapon dice, ranges and quirks | `weapons/*` | this module takes a finished `WeaponResult` (4.9: "the damage inflicted by those hits depends on the nature of the weapon used") |

---

## 4.1 Beam weapons — what a class is

> *"Beams are classed numerically. The higher the class, the longer the effective range and the more
> damage inflicted at closer ranges."*

A beam's class is both its number of range bands (4.3) and its dice at point-blank (4.5). Class 1–3
are shipboard, class 4 is for very large vessels, class 5 is for starbases.

> *"Each beam on a ship can potentially fire independently of the others, but the total number of
> different targets that can be engaged during one turn of firing depends on the number of FireCon
> systems."*

## 4.2 Fire arcs — what this module enforces

Six 60° arcs: `F`, `FS`, `AS`, `A`, `AP`, `FP` (`geometry.ts` does the trigonometry).

> *"A given target ship may only be in one fire arc of the firing ship."*

Ties: *"If the line dividing the arcs passes so nearly through the center of the target that it is
impossible to determine which arc it is in, then decide by a random D6 roll, odds = one arc, evens =
the other."* — `arcTo` is exact arithmetic, so a tie never arises in a digital game and no die is
rolled. Recorded here so the omission is deliberate.

**The aft-arc ban.**

> *"No ship may fire offensive weaponry through its aft arc due to the interference of the ship's
> main drive."*
>
> *"Optional rule: Aft arc fire is permitted on any game turn in which the firing ship did not use any
> thrust from its main drive to accelerate, decelerate, or change course"*

`planFireControl` refuses any **offensive** order into arc `A` unless `aftArcFire: true` is passed
for that turn (the movement module knows whether thrust was spent). Point-defence orders are exempt:
PD is not offensive weaponry, and 4.2 says systems with no directionality — *"e.g. PDS"* — *"have
all-round (6-arc) fire capabilities"*.

Weapons are otherwise checked only against the arcs they are built with. Broadside mountings
(*"the two Port and two Starboard arcs but not the Fore and Aft"*) are stored as that pair of arc
lists on the `WeaponDef`, so nothing special is needed here. Beta orientation (arcs offset 30°) is a
ship-design property and is likewise just a different arc list.

## 4.3 / 4.5 Range bands and beam dice

> *"A beam weapon rolls a number of dice equal to the class, minus 1 die for each range band beyond
> the closest."*

| Class | 0–12 MU | 12–24 | 24–36 | 36–48 | 48–60 |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | — | — | — | — |
| 2 | 2 | 1 | — | — | — |
| 3 | 3 | 2 | 1 | — | — |
| 4 | 4 | 3 | 2 | 1 | — |
| 5 | 5 | 4 | 3 | 2 | 1 |

Standard band is 12 MU (4.3: *"Typically each beam range band is 12 MU but there are a few
exceptions"*).

**Band boundaries are closed at the top: band 1 is 0 < r ≤ 12.** 4.5 says *"3 D6 at less than 12 MU,
2 at 12-24 MU"*, which would put exactly 12 MU in band 2 — but 4.3 says a Beam-1 *"has a maximum
range of 12 MU"* (so it must still fire *at* 12), and the worked example in 4.9 has a Class-3 beam
*"at 12mu"* rolling **three** dice. Two statements against one: 12 MU is band 1. This is
`geometry.rangeBand`'s convention already; `combinedBeamDice` inherits it.

**Volley dice.** The 4.12 sidebar tells players to *"roll for all weapon systems of a particular type
together and add up the results"*: for two Beam-1s, four Beam-2s and one Beam-3 at 9 MU, *"just roll
2 + 8 + 3 = 11 dice at once"*. `combinedBeamDice(ratings, range)` is that sum — and it returns **13**,
because the three addends the book gives are the right ones (2 Beam-1 dice, 4 x 2 Beam-2 dice, 3
Beam-3 dice) and only the printed total is wrong. An arithmetic slip in the source is not a rule; the
engine follows the weapons.

## 4.4 Fire control

| Rule | Value |
| --- | --- |
| Targets engaged per turn | one per **operational** FireCon |
| Weapons per target | any split, *"fire from the ship's various weapons may be divided in any way between the targets"* |
| Arc restriction | still applies to each weapon separately |
| Same weapon, two targets | forbidden (4.5, below) |
| Fighter group as a target | *"Each fighter group targeted requires a FireCon as if it were a ship."* |
| Point defence | *"Point defense fire against fighters or missiles does not require the use of the ship's main FireCon systems."* |
| FireCon ↔ weapon binding | none. *"Individual FireCon systems are not specifically linked to individual weapon systems."* |

Typical fits (not enforced, they are design guidance): escorts 1, cruisers 2, capitals 3+.

> 4.5: *"No single weapon may split its die rolls between targets in any circumstances, e.g. a Beam-3
> at close range must roll all three dice against the same target ship. Two separate Beam-3 weapons
> may each engage a separate target, provided that two FireCon systems are available."*

`planFireControl` walks the orders in the order written and refuses each illegal one with a reason,
rather than failing the whole plan — a player at the table fixes one order, not the turn. Reasons:
`unknown-weapon`, `unknown-target`, `weapon-already-firing`, `out-of-arc`, `aft-arc`, `no-firecon`.
Targets are engaged first-come-first-served; once the FireCons run out, orders naming a *new* target
are refused, while further orders against an already-engaged target are still accepted (they cost
nothing more).

## 4.6 Re-rolls (penetrating damage)

> *"Any roll of six inflicts the usual damage and allows a re-roll... The re-rolls ignore any
> defensive screens or armor and damage is applied directly to the hull. If a re-roll is also a six,
> then apply the damage and roll again. There is no limit to the number of re-rolls you can make if
> you keep throwing sixes."*
>
> *"Re-rolls are made for a natural (unmodified) 6 only. For example if the die roll is modified by +1
> then a roll of 5 inflicts 2 damage points as if it were a 6, but does not reroll."*
>
> *"If the target ship has screens active, then the effects of the screen are deducted from the
> initial attack dice as usual... but not from the result of any re-roll dice — the re-roll is assumed
> to have already penetrated the screen."*

Weapons that do this are marked **BD\*** or **(P)**; a plain **BD** weapon scores and stops.

Every attack therefore produces **two numbers**, exactly as the 4.12 sidebar has players sort their
dice into two piles: *"the initial damage that can be absorbed by armor or screens and the
penetrating damage from re-rolls."* That is the `WeaponResult.normalDamage` /
`WeaponResult.penetratingDamage` pair in `weapons/contract.ts`, and it is what `applyDamage` consumes.

## 4.7 Screens

| Screen level | 1, 2, 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- |
| none | 0 | 1 | 1 | 2 (+re-roll) |
| level 1 | 0 | **0** | 1 | 2 (+re-roll) |
| level 2 | 0 | **0** | **1** | **1** (+re-roll) |

Screen level is capped at 2 (7.2); extra generators are backups. Screens are applied by
`dice.beamDamage` before this module ever sees the damage — `applyDamage` never touches screens.
Re-roll dice are scored at level 0 (4.6).

## 4.8 / 4.9 Armour and how damage lands

> 4.9: *"Damage is normally applied from left to right, starting with the armor. Once all the armor is
> gone, damage is applied to the first row of hull boxes. If the last box in a row of hull is
> destroyed, the ship will need to make threshold check rolls for all its systems. If the ship loses
> its last hull box, it is destroyed."*
>
> 4.8: *"When one ship fires on another, add up the damage inflicted (except for re-rolls). All of
> this damage is taken on armor. Any excess damage is applied directly to the hull."*
>
> 4.8: *"There is no threshold check roll made at the end of the row of armor, but any further damage
> is applied to the first row of hull (or next row of armor if the ship has Layered/Shell Armor)."*

Armour layers are stored inner-first in `ArmourDef.layers` (types.ts), so the **outermost** layer is
the last entry and is the rulebook's *"first layer of armor"*.

### The four damage modes (4.9, 7.7)

`d` is the damage of one weapon's hit after screens. Layers are walked outermost → inward.

| Mode | Rule | Text |
| --- | --- | --- |
| `standard` | fill the outermost intact layer, overflow inward layer by layer, remainder to the hull | 4.8 *"All of this damage is taken on armor. Any excess damage is applied directly to the hull."* |
| `P` | the initial dice behave exactly like `standard`; only the re-roll pile is special (below) | 4.9 *"The damage from that initial roll of 6 is applied to the armor"* |
| `AP` | **1 point to each intact layer**, everything else to the hull | 4.9 *"one point of damage is applied to each layer of [armor], if the ship carries layered armor, with the remaining being applied to the hull"* / 7.7 *"does one point of damage to each shell, and then deposits the remaind[er] of its damage into the hull"* |
| `SAP` | **⌈d/2⌉ to the outermost intact layer**, the remainder to the next layer inward, then inward, then the hull | 4.9 *"half is applied to the armor (rounding up), and the remainder to the hull OR next layer of armor if present"* / 7.7 *"half their damage to the outermost layer of Shell Armor (rounded up), and the remaining half of their damage to the next shell layer"* |

Notes on the readings taken:

* **AP counts intact layers only.** A layer with no boxes left absorbs nothing — it is crossed off the
  SSD, and a hit cannot spend a point on something that is not there. With one point of damage and
  two layers, the single point stops on the outer layer and the hull takes nothing.
* **SAP does not re-halve.** 7.7 says *"the remaining half of their damage to the next shell layer"*,
  flat, and the 4.9 example puts all 3 leftover points on the next row rather than splitting them
  again. If ⌈d/2⌉ is more than the outer layer has left, the unabsorbed part simply flows inward with
  the remainder.
* **Penetrating (re-roll) damage steps in one layer.** 4.6: *"applied directly to the ship's ordinary
  hull (**or next layer of armor if it has multiple layers**) damage track irrespective of whether it
  still has armor remaining."* So the whole re-roll pile skips the layer the initial dice were hitting
  — even if that layer survived — lands on the next layer in, fills inward, then reaches the hull.
  With the usual single layer of armour that is the same thing as "ignores armour, hits the hull",
  which is why 4.6's summary sentence can say exactly that.
  The layer skipped is the outermost layer that was **intact when the hit landed**, sampled before the
  hit's own normal damage is applied — otherwise a volley that happened to strip the outer layer would
  push its re-rolls a layer deeper than the rulebook's *"irrespective of whether it still has armor
  remaining"* allows.
* **Rejected reading.** One could read 4.9's example as each *successive* re-roll die stepping one
  more layer inward (6 → layer 2, 6 → layer 3, ...). It is not implementable against
  `WeaponResult`, which — following the 4.12 sidebar's two piles — carries re-roll damage as a single
  total with no per-die depth, and 4.6 names only *"next layer"*, one step. See the worked example
  below for the arithmetic that makes both readings agree.
* **Rejected default: half-per-layer for normal damage.** `ArmourDef` in `types.ts` describes shell
  armour as taking *"up to half the damage in a volley... on the outermost intact layer, then half of
  what remains on the next"*. The worked example in 4.9 rules that out as the default: a Class-3 beam
  scores 3 points on a cruiser that demonstrably has a *"next row of armor"*, and the text says all
  three are *"scored against the first layer of armor"* — not two and one. Sequential filling is the
  default; the half-per-layer reading is available as `layeredHalfAbsorption: true` in
  `DamageOptions` for groups that play it that way.
* **Regenerative armour (7.8)** repairs in the End Phase (*"roll a d6 for each point of Regenerative
  Armor that has been damaged. On a 5 or 6 the armor box is repaired. On a 1 the armor has sustained
  too much damage and it cannot regenerate further"*). That is phase 14/15 work and is **not** in this
  module; `applyDamage` only records which layers lost boxes.

### Hull rows and what phase 13 is told

Hull boxes are crossed off **left to right** (4.9) and the track is divided into `hullRows` rows
(13.7). The SSD in the rulebook's example is *"12 hull boxes in four rows of three"*. Where the
boxes do not divide evenly the engine gives the **earlier** rows the extra box (14 boxes in 4 rows →
4/4/3/3), matching how an SSD is drawn top-down with a short last row.

`applyDamage` returns `rowsCrossed`, the 1-based indices of every row **completed** by that attack,
and from it:

> 4.11: *"If a ship suffers enough damage in a single phase... to push it over more than one threshold
> check, make only one check (for the last row destroyed) but add 1 to each die roll for each extra
> threshold point passed in that attack."*

so `threshold = { row: last(rowsCrossed), extraRows: rowsCrossed.length - 1 }`, which feeds
`dice.thresholdCheck(row, extraRows, rng, drm)` directly. Two cases give `threshold: null`:

* no row was completed;
* the ship was destroyed — *"No threshold checks need to be made at the end of the last hull row,
  since the ship is considered to be destroyed"* (4.11).

The rolling itself, and what a knocked-out system does, belong to phase 13 and to the systems module;
the drive's two-stage failure (*"reduced to half the original thrust rating... hit a second time...
disabled completely"*) is `movement.ts`'s.

Damage beyond the last hull box is reported as `overkill` rather than discarded, because scenario and
campaign rules care about how thoroughly a ship died.

## 4.10 Optional rule: rear-arc attacks

> *"Any ship firing from within the rear arc of the target ship automatically ignores the targets
> armor."*
>
> *"This rule does not apply when firing at starbases (section 17) or other Really Big Things.
> (Missiles or fighters do not benefit from rear arc attacks. At short ranges the engines of a
> spaceship emit a considerable amount of energy, enough to melt a missile or fighter before it can
> finish an attack.)"*

Off by default — it is flagged "optional rule" in the book. Switched on with
`rearArcRule: true`, it applies only when **all** of these hold:

* the shot came from inside the target's rear arc (`geometry.isRearArcAttack`, arc `A` of the target);
* the source is direct fire, not `'ordnance'` or `'fighter'`;
* the target is not a starbase / Really Big Thing (`targetIsBigThing`).

"Ignores armour" is total: normal *and* penetrating damage go straight to the hull, and no armour box
is crossed off.

## 4.11 Threshold points — the row arithmetic

Target numbers (rolled in phase 13, `dice.thresholdTarget`):

| Row completed | System destroyed on |
| --- | --- |
| 1st | 6 |
| 2nd | 5, 6 |
| 3rd | 4, 5, 6 |
| 4th | 3+ (extrapolated: `7 − rowsLost`, floored at 2) |
| last row | no check — the ship is destroyed |

---

## Worked examples, and what the tests assert

Every example below is in the test file as a named case.

### E1 — 4.5, dice at range

*"A class 3 beam rolls 3 D6 at less than 12 MU, 2 at 12-24 MU, and 1 only at 24-36 MU. At ranges
greater than 36 MU the weapon is out of range. A class 1 beam rolls 1 D6 at ranges 0-12 MU, and is out
of range beyond 12 MU."*
→ `combinedBeamDice([3], r)` = 3 / 2 / 1 / 0 at r = 6 / 18 / 30 / 42; `[1]` = 1 at 6, 0 at 18.
The mixed battery from the 4.12 sidebar is checked addend by addend (2, 8, 3) as well as in total.

### E2 — 4.6, two mounts at 18 MU, unscreened

*"one Beam-3 and one Beam-2... The Beam-3 has firepower of 2 dice at a range of 12-24 and the Beam-2
has 1 die at the same range; thus the firepower total against the target is 3 dice. Rolling the 3D6,
the firing player scores 1, 5, and 6. This inflicts a total of three points of damage on the target –
the 1 is a miss, the 5 does 1 point of damage and the 6 does 2 points and a re-roll. The re-roll is 4,
inflicting 1 more point."*

→ dice = 3; normal damage 3; penetrating damage 1; **total 4**. Against an unarmoured hull, 4 hull
boxes.

### E3 — 4.7, six dice against level-2 screens

*"The player rolls 2, 3, 3, 4, 6, and 6. Against level-2 screens the 4 is a miss and each 6 does 1
damage point, for a total of 2. The re-rolls are 4 and 6, and the further re-roll is 3: because this
is penetrating damage which ignores screens, the 4 inflicts 1 damage point and the 6 another 2 for a
total of 5."*

→ normal 2, penetrating 3, **total 5**.

### E4 — 4.9, penetrating damage against layered armour

*"A typical cruiser with one Standard Screen is hit by a Class 3 Beam at 12mu. The attacking player
rolls a 4, a 5 and a 6. The 4 ... is discounted. The 5 cause's one point of damage and the 6 causes
two points all scored against the first layer of armor (green). The 6 grants a re-roll and the result
is another 6 ... another 2 points of damage that penetrate to the next row of armor (blue). The 6
grants another re-roll resulting in another 6 ... another two points of damage which penetrates
directly to the hull. The attacking player then re-rolls the 6 and the result is a 4. The 4 does one
point of damage (all marked in red)."*

→ 3 dice at 12 MU; normal 3, penetrating 5. Against layers **inner 2 / outer 4**: outer armour −3,
inner armour −2, hull −3. The SSD illustration is not in the text layer, so the layer sizes are chosen
to reproduce the narrated result exactly; with an inner layer of exactly 2 boxes the two readings of
4.6 discussed above agree, which is why this is the case pinned by the test.

### E5 — 4.9, armour piercing

*"a large kinetic gun hits a ship with two rows of layered armor. The hit scores 10 damage points. 1
is applied to each layer of armor with the remaining 8 to the hull."*

→ mode `AP`, d = 10, layers [4, 4] → outer −1, inner −1, hull −8.

### E6 — 4.9, semi armour piercing

*"a missile strikes a ship for 7 points of damage. 4 points is applied to the armor, remaining 3
points are applied to the next row of armor."*

→ mode `SAP`, d = 7, layers [4, 4] → outer −4 (⌈7/2⌉), inner −3, hull 0.

### E7 — 4.11, rows crossed in one attack

*"A ship with 12 hull boxes in four rows of three takes 7 damage points from another ship in one
attack, crossing off two complete rows. At the end of the second row systems are normally lost on a
roll of 5 or 6, but this time they will be lost on 4-6. If the ship is fired on again and takes 3 more
points of damage, the third row will be crossed off, but since only one row was lost the threshold
check rolls will be as normal, 4+."*

→ first attack: `rowsCrossed [1, 2]`, `threshold { row: 2, extraRows: 1 }` →
`thresholdTarget(2) = 5`, +1 per extra row ⇒ effective 4+. Second attack: `rowsCrossed [3]`,
`threshold { row: 3, extraRows: 0 }` ⇒ 4+.

---

## Not implemented here, and why

| Rule | Status |
| --- | --- |
| 4.2 random D6 for an ambiguous arc | unnecessary — `arcTo` is exact |
| 4.2 Beta (30°-offset) arcs | a ship-design arc list, nothing for combat to do |
| 4.11 the threshold roll itself, and system knock-out | `dice.thresholdCheck` + phase 13; this module supplies the row count |
| 7.8 regenerative armour repair | End Phase, not the damage step |
| Per-weapon dice, ranges, ammunition | `weapons/*` behind `WeaponSpec` |
| Screen reduction | `dice.beamDamage`, upstream of `applyDamage` |
