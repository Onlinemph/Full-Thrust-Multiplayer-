# Terrain effects — section 17, and 12.11

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 17 in full (17.1 – 17.11,
`continuum-rulebook-part2.txt` lines 1829–2041, pages 131–138) and 12.11 "Knocked off course" by
Rich Mcgee (line 597, page 100). Rules those sections delegate to and that are quoted here where
they bite: 2.1 measurement, 3.2 and 3.4 cinematic movement, 4.2 fire arcs, 4.5–4.7 the beam damage
table, 4.6 penetrating damage, 4.11 threshold checks, 5.2 FireCon, 7.2–7.3 screens, 12.2 the
advanced sensor rules, 13.11 atmospheric streamlining, 16.7 ramming.

Implementation: `src/engine/terrain.ts`. Tests: `src/engine/terrain.test.ts`.

Readings taken where the text genuinely admits more than one are marked **[reading]** with the
alternative that was rejected and why. There are twenty-two of them, which is high for one
section, and the reason is section 17's own opening: *"The following suggestions are mostly pure
space opera"*. It is written as suggestions to a games master, not as procedure, and a great deal of
it names a quantity without saying how to measure it.

---

## A note on the source text

Section 17 is set in two columns, and the PDF extractor that produced `continuum-rulebook-part2.txt`
walked the two columns **interleaved**, alternating chunks. Lines 1855–1861 even merge the two
columns word-run by word-run on a single line. So the raw file reads, in order:

```
17.4 Asteroid Fields, Meteor swarms
When an asteroid is reduced to zero damage, it disintegrates into 1D6 smaller chunks, …
and debris These may cover areas of between 6 MU and 12 MU diameter …
17.2 Dust or Nebulae clouds These have the following effects:
Any ship that enters or is hit by such an asteroid field, meteor swarm, or debris field has 1 D6 rolled for
1. Travel through a cloud is restricted to a maximum safe velocity of 12; any ship attempting to exceed this
every full 6 MU of velocity, with the actual score rolled equaling the (penetrating) damage sustained.
in a cloud will suffer potential damage – roll 1 D6 and apply damage as for beam weapons fire. Standard
Screens offer no protection, but armor and Advanced
Up to velocity 5 = no damage, 6-11 = 1 D6, 12-17 = 2 D6, etc.
Screens do.
```

Every quotation below is the **reconstructed** column, not the raw file order. The reconstruction is
forced in almost every case — sentences resume mid-clause across the interleave ("any ship
attempting to exceed this" / "in a cloud will suffer potential damage"), and the two numbers in play
belong to different rules ("maximum safe velocity of 12" is the cloud; "6-11 = 1 D6, 12-17 = 2 D6"
is the 6-MU-per-die meteor ladder). Exactly one sentence lands ambiguously, and it is **[reading] 1**
below.

The same extractor also drops 17.11's results table three paragraphs above 17.11's own heading
(lines 2017–2019, above the section that uses them); they are quoted back into 17.11 here.

---

## Vocabulary

| Word | Meaning here |
| --- | --- |
| **Planetoid** | 17.1's own word: *"all large asteroids, small moons, comets, starbases, orbitals, and all other Really Big Things"* |
| **Body** | anything on the table with a position and a radius — the only shape section 17 measures against |
| **Path** | the track a ship or asteroid actually covers in phase 5. Under 3.4 that is two straight legs, not one |
| **Zone strength** | 17.9's gravity number: 1, 2, 4 or 8, used both as a velocity change and as a count of clock points turned |
| **Orbit speed** | 17.8's number, in *clock points per turn* around the orbit track — not an MU velocity |
| **Entry / orbital velocity** | 17.8's other number, an MU velocity. See **[reading] 12** |

Damage is **reported, never applied**, exactly as in `gunboats.ts`: every function here returns the
dice and the number, and `combat.ts` decides what armour and screens do with it (4.8, 4.9).

---

## 12.11 Knocked off course (by Rich Mcgee)

> *"Whenever a ship passes a damage threshold, while using the cinematic movement rules, after
> checking for systems failures make one further roll at the same odds (so 6+ for first threshold,
> 5+ for second, etc.) to determine if the ship has been knocked off course. … Regardless of the
> exact cause, if the threshold is failed, then roll 1d6. On a 1-3, immediately change the ship's
> facing by 30 degrees to starboard, on a 4-6 change facing 30 degrees to port."*

This is the same family of rule as terrain — an external shove on a ship's heading that no order
asked for — which is why it lives here rather than in `threshold.ts`.

Two dice, in order:

1. **The threshold roll.** Same target number as 4.11: `max(2, 7 − rowsLost)`, so 6+ at the first
   threshold point, 5+ at the second, 4+ at the third. A roll at or above the target *fails* the
   threshold — 4.11's convention, and `dice.thresholdTarget` is the one place it is computed.
2. **The direction roll.** 1–3 starboard, 4–6 port. 30 degrees is exactly one clock point
   (`geometry.DEGREES_PER_POINT`), so the ship's facing moves one point.

Note the asymmetry a reader will get wrong: the direction roll is **not** an even split of the die
across the two sides in the intuitive order — 1–3 is *starboard*, which is the clockwise/positive
direction in `geometry.turnCourse`. Half the die, but the low half.

> **[reading] 20 — the extra-rows modifier carries over.** 4.11 adds +1 per additional row crossed
> in the same attack rather than rolling again per row. 12.11 says *"at the same odds"*, so the
> knock-off-course roll takes the same `extraRows` bonus and the same DRM (a Flawed Design's, say).
> *Rejected:* reading "the same odds" as only the target number, so a ship that lost three rows at
> once rolls a bare 4+ for its course. That reading makes the rule *easier* on a ship the harder it
> is hit, which inverts what the rule is for.

**Vector movement.** 12.11 continues:

> *"Under the vector movement rules a ship's facing … may not be the same as its heading … In this
> case, make two threshold checks. … The second check determines whether the ship's heading changes.
> If failed, roll a further 1d6. On a 1-3 move the vector marker (but not the mini) 30 degrees to
> starboard. On a 4-6, move the vector marker 30 degrees to port."*

Implemented — it is the same pair of dice a second time — but only reachable by passing an explicit
`heading`, because `ShipState` has no heading field (12.12 vector movement is not implemented
anywhere in the engine). See the spine gaps at the foot of this document.

---

## 17.1 Planetoids and dense asteroid fields

> *"Planetoid is used in this section for all large asteroids, small moons, comets, starbases,
> orbitals, and all other Really Big Things."*

> *"Asteroids can either be stationary, or be thrust 0 objects with a predetermined course and
> velocity."*

That second sentence is 16.1's rule, and `ShipState.fixedPath` already carries it: *"Ships with
thrust 0 drives, and any asteroids or similar object … never write orders. … Each turn, the ship or
asteroid moves along this predetermined course before all other ships"* (16.1).

### Blocking

> *"Ships cannot block line of sight or line of fire, but bodies such as asteroids do have a
> significant size in relation to the playing area and therefore are able to block lines of fire or
> sensor detection and pose a collision risk. If you are using round or spherical objects to
> represent the asteroids then it is simple: any line between two ships that crosses any part of the
> asteroid is blocked. (Between center points of models, remember.)"*

> *"…it is necessary to mount them on bases, perhaps 1 to 6 MU across, depending on the asteroid
> size. A line between two ships is then blocked if it crosses any part of the asteroid's base…"*

So: **centre point to centre point, against the body's disc.** A base is 1 to 6 MU *across*, i.e. a
radius of 0.5 to 3 MU.

> *"If the line of sight between opposing ships is blocked by an asteroid, those ships may not fire
> at each other with any weapons, or place missiles along that line. Fighters may still fly around
> the asteroid to attack as normal."*

Three consequences, and the third is the one people forget: **fighters ignore the block entirely.**
Not "may fire through it" — they fly round. A blocked line stops every weapon and stops a missile
being *placed* along it, which reaches into 6.2's launch rules.

> *"Sensor scans are also blocked by asteroids. At the start of the game, some ships may be hidden
> behind bodies in an asteroid field; they are represented by Bogey Markers in the usual way for
> unconfirmed contacts, but do not have to be revealed until an enemy ship comes within scan range
> and can get a clear line of sight onto the bogey. (Note that this blocking applies equally to
> active scan attempts as to passive.)"*

One predicate answers fire, missile placement and both kinds of scan. `hasLineOfFire` is that
predicate; `blockingBodies` names what is in the way, for the log.

### Damage to asteroids

> *"The normal rules assume that asteroids cannot be destroyed by weapons fire or by ships impacting
> with them. However, if the players wish, they may give each asteroid a large damage point value
> (perhaps 50 for a very small chunk, 100 for a larger one, etc.) and then allow players to fire at
> them."*

> *"When an asteroid is reduced to zero damage, it disintegrates into 1D6 smaller chunks, which all
> move at random courses and speeds out from the point of destruction. Try to avoid that lot. . ."*

| | Damage points |
| --- | --- |
| A very small chunk | 50 |
| A larger one | 100 |
| Anything else | *"etc."* — the scenario's call |

> **[reading] 21 — a chunk's course is a clock point drawn uniformly from the twelve; its speed is
> not rolled at all.** "Random courses" has exactly one representation in this engine, the twelve
> point clock of 3.1, so a chunk gets `rng.int(12) + 1`. "Random … speeds" has no range anywhere in
> the book — no minimum, no maximum, no die named — so `shatterAsteroid` reports the count and the
> courses and leaves velocity to the scenario. *Rejected:* inventing a spread (1D6 MU, or the
> destroying weapon's damage) — that is a number the book does not contain, and this module does not
> invent numbers.

---

## 17.2 Dust or nebula clouds

> *"These have the following effects:"*
>
> *"1. Travel through a cloud is restricted to a maximum safe velocity of 12; any ship attempting to
> exceed this in a cloud will suffer potential damage – roll 1 D6 and apply damage as for beam
> weapons fire. Standard Screens offer no protection, but armor and Advanced Screens do."*
>
> *"2. Clouds inhibit beam weapons and fire control lock on: when attempting to fire at a ship in a
> dust cloud, or if the firing ship is itself in a cloud, roll a D6 after nominating the target. On
> a roll of 1-3 the dust has prevented a successful target lock-on and the ship may not be fired at.
> On a 4-6 the shot may be fired as normal, but if using beams or Grasers treat the target as having
> one screen level higher than normal due to beam attenuation caused by the dust. (Screen levels
> above 2 remain at 2.)"*
>
> *"3. Fighters always lock on, but treat the target as having one screen level higher as for beam
> weapons."*

> *"Note that this rule may, if desired, also be used to simulate the effects of ships operating in
> the fringes of planetary atmospheres, such as when skimming gas giants."*

| | Value |
| --- | --- |
| Maximum safe velocity | 12 |
| Damage over that | 1D6, read off the beam table |
| Lock-on | D6, 1–3 fails, 4–6 succeeds |
| Attenuation on a success | target counts one screen level higher, capped at 2 |
| Fighters | always lock on; still take the attenuation |

**The cap is the trap.** *"(Screen levels above 2 remain at 2.)"* means an unscreened ship in a
cloud is screen-1 and a screen-1 ship is screen-2, but a screen-2 ship gains nothing — a cloud helps
the ships that need it least not at all. And on the 4.7 table, going from screen 1 to screen 2 costs
the shooter only the *sixes* (2 damage becomes 1); going from 0 to 1 costs it the *fours*. The
cheapest screen buys the most from a nebula.

> **[reading] 1 — *"Standard Screens offer no protection, but armor and Advanced Screens do"*
> belongs to 17.2, not to 17.4.** Both the column reconstruction and the sense of the rule say so.
> The sentence resumes mid-word across the interleave from 17.2's rule 1 ("…but armor and Advanced"
> / "Screens do."), and semantically it is an *exception* in 17.2, where damage is *"as for beam
> weapons fire"* and screens would otherwise apply — while in 17.4 it would flatly contradict that
> section's own *"(penetrating)"*, which by 4.6 bypasses armour and screens alike. *Rejected:*
> attaching it to 17.4, which would make 17.4 self-contradictory in the space of one sentence.

> **[reading] 2 — cloud damage is one die read off the 4.5 table, and a natural 6 does not re-roll.**
> *"Apply damage as for beam weapons fire"* is read as the beam **damage table** (4.5, 4.7), not the
> whole beam weapon. 4.6's re-roll is a property of a (P) weapon, and re-roll damage *"ignores
> screens and armour"* — which would contradict 17.2's own sentence that armour protects. So one
> die, `beamDamage(face, screens)`, reported as `standard` damage for armour to answer. *Rejected:*
> `rollBeamVolley` with `penetrating: true`, the way `beams.ts` fires a Beam-1. That is the more
> literal reading of "as for beam weapons fire" and it is why this is marked, but it makes the
> quoted armour rule dead text.

> **[reading] 3 — one die per ship per turn, not per MU and not per cloud crossed.** The rule says
> *"roll 1 D6"*, flat, with no multiplier — unlike 17.4 immediately opposite it, which is explicitly
> per 6 MU of velocity. The two rules sit side by side on the page and only one of them counts dice
> by speed. *Rejected:* scaling by the excess over 12, which would import 17.4's ladder into a rule
> that pointedly does not have one.

> **[reading] 4 — the lock-on die is rolled once per target nomination, by the firing ship.** *"Roll
> a D6 after nominating the target"* — a nomination is a firing ship choosing a target (4.4, 5.2),
> so one die covers everything that ship shoots at that target in that phase. *Rejected:* one die
> per weapon, which would let a ship with six mounts fire five of them through a cloud that stopped
> the sixth, and turn a 50/50 rule into near-certainty for a big hull.

> **[reading] 5 — the +1 screen level applies only to beams and grasers, and to fighters.** Taken
> literally from *"if using beams or Grasers"* and from rule 3. Everything else that passes the
> lock-on roll — missiles, K-guns, pulse torpedoes — shoots at the target's real screen level. The
> caller says which it is with a flag; the module will not guess from a weapon class it is not
> allowed to import. *Rejected:* attenuating everything, on the grounds that "beam attenuation" is
> flavour for a general effect. The rule names two weapon families and a third case; naming three
> things and meaning all things is not how the rest of the book is written.

---

## 17.3 Solar flares

> *"Flares may occur at random, perhaps diced for each turn, if the battle is happening fairly close
> to a very active star. They may be assumed to affect the entire table, or just a specific area as
> the player's desire. Any ship that is caught in a flare rolls a D6 for each of its FireCon and
> sensor systems (if the advanced sensor rules are being used), adding 1 to the score per active
> screen level. On a score of 4+ the system is undamaged; otherwise it is knocked out as if by a
> threshold check."*

| | Value |
| --- | --- |
| Dice | one per FireCon, one per sensor system |
| Modifier | +1 per **active** screen level |
| Survives on | 4+ |
| On a failure | knocked out *"as if by a threshold check"* — 4.11's outcome, not 4.11's dice |

Screens here are a straight bonus, not the 4.7 table: a screen-2 ship rolls 3+ and only a natural 1
or 2 costs it a FireCon. A screen-2 ship is nearly flare-proof; an unscreened one loses a third of
its fire control every time the star burps.

Note *"active"*. A screen generator that is fitted but switched off, or destroyed, adds nothing —
which is `ScreenLevel` as this engine already carries it, so the caller passes the level in effect
rather than the level built.

> **[reading] 6 — the parenthetical governs sensors, not FireCons.** *"…for each of its FireCon and
> sensor systems (if the advanced sensor rules are being used)"*: sensor systems only exist as
> distinguishable boxes when 12.2's advanced sensor rules are in play, so the condition attaches to
> the nearer noun. FireCons are rolled for either way. *Rejected:* reading the condition as governing
> the whole clause, which would make 17.3 do nothing at all in a game that is not using an optional
> rule from a different section — a flare with no effect is not a rule.

> Not implemented: *"perhaps diced for each turn"*. No frequency, no target number, no area. The
> scenario decides whether there is a flare this turn and who is in it; this module resolves one.

---

## 17.4 Asteroid fields, meteor swarms and debris

> *"These may cover areas of between 6 MU and 12 MU diameter (or other shapes/sizes at players
> discretion) and may be stationary on the table or moving in a similar way to the moving asteroid
> rules."*

> *"Any ship that enters or is hit by such an asteroid field, meteor swarm, or debris field has 1 D6
> rolled for every full 6 MU of velocity, with the actual score rolled equaling the (penetrating)
> damage sustained."*

> *"Up to velocity 5 = no damage, 6-11 = 1 D6, 12-17 = 2 D6, etc."*

> *"This rule may also cover the effects of the debris in the rings of a planet such as Saturn, in
> which case a large arc of it could be depicted on the table to cause all sorts of problems!"*

| Velocity | Dice |
| --- | --- |
| 0 – 5 | none |
| 6 – 11 | 1D6 |
| 12 – 17 | 2D6 |
| 18 – 23 | 3D6 |
| … | `floor(velocity / 6)` |

**The number nobody expects: the face *is* the damage.** This is not the beam table. A single die
showing 5 does five points, and it is penetrating — screens and armour do nothing (4.6). A cruiser
crossing a meteor swarm at velocity 12 rolls 2D6 straight into its hull, averaging 7, with 12
possible. That is a threshold point or two on most hulls, from terrain, with no weapon fired. It is
by a wide margin the most dangerous thing in section 17 that does not simply destroy you outright.

The printed ladder and the printed formula agree exactly, which is worth stating because they are
two different sentences that could have disagreed: `floor(5/6) = 0`, `floor(6/6) = 1`,
`floor(11/6) = 1`, `floor(12/6) = 2`, `floor(17/6) = 2`. The boundaries are 6, 12, 18 — and 11 and
17 are the last velocities in their bands, which the test asserts in both directions.

---

## 17.5 Battle debris

> *"When a ship is destroyed by enemy fire, i.e. reduced to zero damage points or less, it may
> simply become a drifting hulk, or it may actually explode into a cloud of debris."*

> *"To determine if this happens, note the amount of excess damage inflicted (over that required to
> reduce the ship to zero points) and roll a D6. If the score is less than or equal to the excess
> damage then the remains of the ship explode. For example, if a ship has 2 hull boxes left and
> suffers a further 5 points of damage, a die roll of 5 - 2 = 3 or less will cause it to explode."*

> *"An exploding ship creates a cloud of debris 2 MU in diameter for an escort, 4 MU for a cruiser,
> or 6 MU for a capital ship. The debris cloud exists for only 1 turn after the explosion, during
> which it moves on the same course and velocity as the ship was travelling at the point of
> destruction."*

> *"In this turn any ship encountering the cloud treats it exactly as for the meteor and debris
> rules given in the section above. After the one turn the debris is assumed to have spread out
> sufficiently to present little risk to other ships, and is removed from play."*

Excess damage is `damageInflicted − hullBoxesRemaining`, and the worked example fixes it: 5 damage
onto 2 remaining boxes is an excess of 3, and 3 or less explodes. So the die is rolled *at or below*
the excess — the opposite direction from every other roll in section 17.

| Excess | Chance of exploding |
| --- | --- |
| 0 | none — a D6 cannot roll 0 |
| 1 | 1 in 6 |
| 3 | 1 in 2 |
| 5 | 5 in 6 |
| 6 or more | certain |

| Ship | Cloud diameter |
| --- | --- |
| Escort | 2 MU |
| Cruiser | 4 MU |
| Capital | 6 MU |

The cloud then does 17.4's damage — the face-value penetrating dice — to anything that meets it, for
one turn, while drifting on the dead ship's last course and velocity.

> **[reading] 7 — station, civilian and monster hulls take the capital ship's 6 MU cloud, except
> that a civilian takes the cruiser's 4 MU.** 17.5 names three of `ShipGroup`'s six members. 17.1
> already files *"starbases, orbitals"* under Really Big Things, and a `monster` is capital-sized by
> construction, so both take 6 MU. `civilian` spans everything from a courier to a colony ship, and
> the middle of three bands is the least wrong single answer for a group the book never sizes.
> *Rejected:* deriving the diameter from hull mass, which would be a fourth rule the book does not
> have; and refusing to answer, which would leave the integrator making the same guess with less
> information.

> **[reading] 8 — an excess of zero never explodes, and negative excess is clamped to zero.** A ship
> reduced to exactly zero has no excess, and a D6 cannot roll at or below 0. Overkill *"of or less"*
> is the whole mechanism, so no overkill is no explosion. *Rejected:* treating "reduced to zero
> damage points or less" as itself qualifying, i.e. always rolling — that reads the trigger sentence
> as the test, when the following sentence states the test explicitly.

---

## 17.6 Collisions

> *"Collisions can occur between ships and asteroids. If the asteroid is stationary – i.e. never
> changes position on the playing area – then a ship risks collision with the asteroid if its path
> during the Ship Movement Phase crosses any edge of the asteroid."*

> *"If the asteroid is itself moving, a collision risk can occur under either of these
> circumstances: • The movement path of the asteroid brings it into contact with a ship at any
> point. (This is before the ship itself has moved, at the beginning of the Ship Movement Phase.) •
> The final position of a ship after making its move is inside the asteroid."*

> *"Collisions do not occur if the movement paths of the asteroid and ship merely cross. Use the base
> or model edges of the asteroid and the center point of the ship model to determine collisions, not
> the edges of the ship model."*

> *"These collision rules are simple rather than physically accurate, but do ensure that as the
> movement of both asteroids and ships is completely predictable, you have only yourself to blame if
> you run into one!"*

So there are two quite different tests, and the difference is the whole point of the rule:

| The asteroid | The test |
| --- | --- |
| **Stationary** | the **ship's whole path** crosses the disc |
| **Moving** | the **asteroid's whole path** touches the ship's **pre-move point**, *or* the ship's **final point** is inside the disc |

A moving asteroid does **not** sweep up ships along their tracks. Two paths that cross are not a
collision. That is stated twice, and it is what makes both movements predictable enough to be your
own fault.

### Avoiding it

> *"To determine if the ship manages to avoid a fatal collision, subtract the ship's total available
> thrust rating from its current velocity. This number must be equaled or exceeded by the roll of
> 1D6 in order for the ship to have avoided the collision. Ships with Advanced Drives double their
> engine rating. Example: If a cruiser with a thrust rating of 4 is travelling at velocity 9 and its
> movement intersects with an asteroid body, subtract the thrust (4) from the velocity (9) to give 5.
> Thus a 5 or 6 must be rolled for the cruiser to evade the asteroid – on a roll of 4 or less, exit
> one cruiser!"*

> *"If the needed number for avoidance is 1 or less, then the ship is automatically able to avoid a
> collision; if the number is greater than 6, then a crash is inevitable. When any ship, regardless
> of its class, hits an asteroid, the ship is completely destroyed. Ramming a billion tons of rock
> at any speed is not recommended, even in a superdreadnought!"*

`avoidance = velocity − thrust`, with an Advanced Drive doubling the thrust (3.3's drives, priced in
13.10). Roll 1D6; **at or above** avoids.

| Avoidance number | Result |
| --- | --- |
| 1 or less | avoided, no roll |
| 2 – 6 | roll 1D6, at or above avoids |
| 7 or more | destroyed, no roll |

And the outcome has no gradations: *"the ship is completely destroyed"*. Not damage, not a threshold
check — 16.7's ramming table does not apply, because a billion tons of rock has no hull boxes to
multiply.

> **[reading] 9 — the ship's path is its actual cinematic track, passed as a polyline.** 3.4 moves a
> turning ship in two legs, *"half the distance on the old course, then the turn, then the rest on
> the new one"*, and `geometry.moveShip` already builds exactly that. 17.6 says *"its path during
> the Ship Movement Phase"*, which is the track, not the chord. So `stationaryCollisionRisk` takes
> `readonly Point[]` and tests every leg. *Rejected:* the straight line from start to finish, which
> is cheaper and wrong in precisely the case the rule was written for — a ship turning *around* an
> asteroid would be scored as hitting it.

> **[reading] 10 — "total available thrust rating" is the drive's rating, not the thrust left
> unspent.** *"Total available"* reads as the rating the drive can deliver — the same phrase 16.3
> uses for a tug's *"available thrust"*, which is a rating and not a remainder — and the worked
> example uses a cruiser's bare *"thrust rating of 4"* with no mention of what its orders spent.
> *Rejected:* thrust not yet spent this turn, which would be tactically richer and would punish a
> ship that had already manoeuvred, but requires reading "available" against the example rather than
> with it. A drive knocked down by threshold damage does reduce the rating, and the caller passes
> the effective rating for that reason.

---

## 17.7 Planets, and the orbital table

> *"For Full Thrust purposes a planet includes not just planets but also major moons and even suns
> at the larger scales: any stellar body with a significant gravitational effect on spaceships."*

> *"In this section we present three different possible systems for representing planets at varying
> scales. Pick the one that best suits your scale or scenario."*

The first of them is the **orbital table**:

> *"At this scale the table represents an area at a given orbit radius above a planet (plus or minus
> some distance – higher velocities are 'lower'), with the equatorial orbit path running between the
> centers of the short edges and a polar orbit across. The planet itself would be underneath the
> table."*

> *"A ship can leave the table at any time to make an orbit around the planet. When it does so,
> record the ship velocity, course, and distance from the nearest table corner at the point of exit.
> A number of turns later, the ship can enter again by being placed before orders on the opposite
> edge, at the same velocity and course, and within 6 MU of the same distance from the diagonally
> opposite corner edge."*

> *"Thrust 0 or 1 ships cannot enter until the 5th turn after exiting, thrust 2 to 4 until the 4th,
> and thrust 5 or greater the 3rd (This assumes that the ship is making a powered atmosphere
> skimming circumnavigation rather than a genuine orbit, plus a bit of dramatic license). Whether
> fighter groups can orbit is optional but not recommended: making the orbit would consume too much
> fuel for such small craft."*

| Thrust | Turns away |
| --- | --- |
| 0 – 1 | 5 |
| 2 – 4 | 4 |
| 5 or more | 3 |

Re-entry placement: the **opposite edge**, the **same velocity and course**, and within **6 MU** of
the recorded distance from the **diagonally opposite** corner. The velocity and course are the ones
recorded at exit, unchanged — a lap of the planet is not a chance to re-plot.

> **[reading] 11 — "the 5th turn after exiting" is `exitTurn + 5`.** A ship that leaves on turn 3
> may re-enter on turn 8 at the earliest. *Rejected:* counting the exit turn as the first, giving
> `exitTurn + 4`. The literal words are "after exiting", and the three delays are stated as an
> ordinal series where the intent is plainly "a thrust-5 ship is back two turns sooner than a
> thrust-0 one" — which both readings preserve, so the literal one wins.

The distance-from-corner half is **not implemented**: `GameState` has no table bounds, so there are
no corners to measure from. `orbitReentryPlacementLegal` takes the two distances as numbers and
answers the 6 MU tolerance, which is the part of the rule that is a rule rather than a measurement.

---

## 17.8 Medium scale

> *"At medium scale a planet should be represented on the table by a half sphere, although a plate
> or disk will suffice."*

> *"Decide whether the planet can be landed on or that contact with the planet will be a fatal
> collision."*

> *"The edge of the planet is the orbit track and should be marked with 12 clock face points. The
> orbit track has an entry velocity and an orbital speed in clock faces per turn."*

> *"A planet may have satellites or starbases in orbit. These move at the orbit speed of points per
> turn around the orbital track, and always face 'away' from the center of the planet."*

> *"A ship enters orbit with any movement that intersects the orbit track at the entry velocity and
> is placed at the nearest marker point. While in orbit, the ship does not have to have any course
> change orders written for it. The player simply notes that it is in orbit and moves the ship by a
> number of points equal to the orbit speed around the track. Any velocity change will cause the
> ship to leave orbit, either down or up."*

> *"If using cinematic movement, ships in orbit face forward in the closest course facing to the
> orbit path at that point. In vector movement, ships may change facing as usual."*

> *"Ships in orbit may fire at any ships outside the orbit track, or at ships at the point
> immediately in front or behind."*

> *"For simplicity we recommend only one ship or starbase may occupy each marker point, or only
> ships from the same side. If you do allow hostile ships within the same point, they may fire at
> each other as if at 1 MU range, through any arc the firing ship chooses. Missiles home in on a
> target chosen by random die roll."*

### Entering and leaving orbit

> *"If the ship hits the orbital distance at less than the orbital velocity, it will enter an
> automatically decaying orbit and start to enter the atmosphere (section 13.9). If it arrives with
> greater than the correct velocity it will ram straight into the atmosphere in an uncontrolled entry
> – you have been warned!"*

> *"If the ship decelerates to less than the orbital velocity, its orbit will decay and it will start
> to enter the atmosphere. If it accelerates to above the orbital velocity it will leave orbit and
> move normally, in a straight line at the clock face heading that is the closest tangent to its
> orbital path."*

> *"Any ship that suffers a drive or bridge threshold failure while in orbit must make a second
> threshold check to stay in orbit. If this too fails, the ship orbit has decayed and it enters the
> atmosphere."*

| Arriving at the track | Result |
| --- | --- |
| below the orbital velocity | decaying orbit → atmospheric entry (17.11) |
| exactly the orbital velocity | in orbit, at the nearest marker point |
| above the orbital velocity | uncontrolled entry (17.11), which is nearly always fatal |

| Changing velocity while in orbit | Result |
| --- | --- |
| slower | orbit decays → atmospheric entry |
| unchanged | stays in orbit |
| faster | leaves orbit on the tangent |

The cross-reference *"(section 13.9)"* is the book's own, and it is stale — 13.9 is Drives. The
section it means is 17.11, which is where deliberate and uncontrolled entries are resolved, and the
same stale numbering shows up in 13.11: *"Streamlining allows ships to safely enter a planet's
atmosphere as described in section 13"*.

> **[reading] 12 — "entry velocity" and "orbital velocity" are one number.** The track is introduced
> with *"an entry velocity and an orbital speed in clock faces per turn"*, two quantities. Everything
> afterwards says "the orbital velocity" or "the correct velocity" for the MU one, and "orbit speed"
> for the clock-point one. Reading them as three quantities would leave "orbital velocity" undefined
> at first use. *Rejected:* a distinct orbital velocity, which would need a third number the track is
> never given.

> **[reading] 13 — a ship in orbit faces the tangent three clock points ahead of its marker, in the
> direction it is travelling.** *"The closest course facing to the orbit path at that point"*: the
> tangent to a circle at a point is perpendicular to the radius, and a quarter of the twelve-point
> clock is exactly three points, so the facing is `marker + 3` clockwise or `marker − 3`
> anticlockwise. Exact, not approximate, because both the clock and the markers have twelve
> divisions. The same tangent is the course a ship leaves orbit on. *Rejected:* nothing, really —
> but it is marked because "closest course facing" invites an approximation, and here there is none
> to make.

A satellite's facing is a different rule and reads the other way: *"always face 'away' from the
center of the planet"*, so a satellite at marker 4 faces course 4, outward, whatever the orbit speed.

---

## 17.9 Large scale

> *"These rules are for those who prefer their space battles on a grand scale with the table
> representing a significant chunk or all of an entire solar system."*

> *"Represent planets by small disks up to several MU in diameter, much smaller than for medium
> scale. A planet is surrounded by three concentric gravity zones, each extending the radius by at
> least 1 MU. The outer zone is strength 1, the middle strength 2, and the innermost 4. For large
> planets increase the radius of the zones; treat a sun as a large planet with an extra inner zone of
> strength 8."*

| Zone | Strength |
| --- | --- |
| Outer | 1 |
| Middle | 2 |
| Inner | 4 |
| A sun's extra inner zone | 8 |

> *"If the movement path of a ship intersects a gravity zone, pause the ship in the innermost zone
> contacted and adjust the speed and course as follows. First, determine where the center of the
> planet is relative to the ship."*
>
> *"• If the center is in the fore arc of the ship, add the zone strength to the ship velocity."*
> *"• If the center is in the aft arc, subtract the zone strength from velocity."*
> *"• If the center is in a port or starboard arc, add half the zone strength to the velocity, and
> turn the ship towards the center by a number of points equal to the strength of the zone."*

> *"If the ship ends the Ship Movement Phase in a gravity zone, apply the changes in velocity and
> course to the start of the next turn movement instead."*

> *"A ship that has unused thrust points for changing course may use them to change the gravity zone
> turn. In Figure 37, the ship changes course by 2. If it were a ship with thrust 4 drive and had not
> changed course, it could increase this up to 4 or decrease it down to none."*

> *"The velocity increase may not seem very high, but remember at this scale, the ship must already
> be moving at considerable speed."*

> *"The ship is considered to make a partial orbit within the zone while changing course, so cannot
> collide with the planet or enter another zone even if the straight line path would indicate
> otherwise. After leaving it can however intersect the gravity zone of another planet which will
> change the course and velocity again – clever players may be able to bounce their ships around like
> billiard balls."*

The last paragraph is a **rule, not colour**: a ship resolving a gravity zone is immune to 17.6's
collision and to every other zone of the same well for that pass. Without it a dive at a sun would
chain through four zones in one move.

> **[reading] 14 — fore, aft and the sides are 4.2's six arcs: `F` is fore, `A` is aft, `FS`/`AS`
> are starboard, `FP`/`AP` are port.** 17.9 names three regions; the engine has six 60° arcs and
> nothing else. Mapping the bow arc to fore and the stern arc to aft leaves the four beam arcs as the
> sides, 120° a side, which is the only mapping that leaves all three of the book's cases reachable.
> *Rejected:* three 120° sectors (fore = `F`+`FS`+`FP`, aft = `A`+`AS`+`AP`), which is a natural
> reading of "fore arc" in isolation but deletes the port-and-starboard case the rule spends its
> longest bullet on.

> **[reading] 15 — "half the zone strength" rounds down.** Zone strengths are 1, 2, 4 and 8, so only
> strength 1 is odd, and it gives +0 velocity with a 1-point turn. Cinematic velocity is an integer
> (3.2), and 3.4 already rounds a split move's first leg down, so down is the book's habit.
> *Rejected:* rounding up, which would make the outer zone of every planet accelerate a passing ship
> as much as the middle zone does, flattening the ladder the section just built.

> **[reading] 16 — a thrust-adjusted gravity turn is capped at the greater of the zone strength and
> the unused thrust, and costs the difference in thrust.** The printed example is the constraint: a
> base turn of 2 and a thrust-4 drive gives *"up to 4 or … down to none"*, not up to 6. So the legal
> range is `[max(0, base − thrust), min(max(base, thrust), base + thrust)]`, which reproduces "0 to
> 4" for base 2 / thrust 4, and "4 to 8" for a sun's inner zone at thrust 4. *Rejected:* range
> `[0, base + thrust]` at one thrust per point, the obvious mechanic, which would read "up to 6" in
> the book's own example. When a worked example and an obvious mechanic disagree, the example is the
> rule.

> **[reading] 22 — velocity cannot be driven below zero by a gravity zone.** An aft-arc pass
> subtracts the zone strength, and a sun's inner zone subtracts 8; nothing in 3.2 gives a cinematic
> ship a negative velocity. *Rejected:* allowing negative velocity as "falling back", which the
> movement rules cannot express and `movement.ts` does not accept.

---

## 17.10 The super simple and totally unrealistic way

> *"A ship may enter planetary orbit (or other large celestial body) by the following rules: Ships
> desiring to make orbit must be travelling at a thrust no greater than 8 and no less than 6. Their
> course must also bring them within 3" of the objective but no closer than 2". That is the 3"
> gravity well mentioned earlier. If the ship is beyond the 3" it will go past the objective and not
> make orbit. If it is closer than 2" it will be caught in the gravity well and crash (i.e. it is
> destroyed). Remember all measurements are taken from the model's stem."*

| Closest approach | Velocity 6 – 8 | Any other velocity |
| --- | --- | --- |
| under 2 | destroyed | destroyed |
| 2 to 3 inclusive | enters orbit | flies past |
| over 3 | flies past | flies past |

Both band edges are inclusive: *"within 3""* and *"no closer than 2""* both include their number,
and the two failure clauses are strictly *"beyond the 3""* and *"closer than 2""*.

> **[reading] 17 — "travelling at a thrust no greater than 8 and no less than 6" means velocity 6 to
> 8.** A ship travels at a velocity; a thrust rating is what its drive can change that velocity by
> (3.2). The rest of the rule is about where the ship's *course* takes it, so the condition is on the
> approach, not on the hull's specification. *Rejected:* the drive rating, which would make the rule
> a fleet-list restriction — only thrust-6-to-8 hulls may ever orbit — and would leave the speed of
> the approach, the thing that decides whether an orbit is possible, unconstrained.

> **[reading] 18 — the inch marks are MU.** 17.10 is the only place in section 17 that measures in
> inches; every other distance in the section, and 2.1 itself, is in MU. One MU is one inch on a
> standard table. *Rejected:* treating inches as a distinct unit, which the engine has no concept of
> and which would make 17.10's 3-unit gravity well incomparable with 17.9's 1-MU zone widths.

> **[reading] 19 — a ship in the 2-to-3 band at the wrong velocity flies past.** The velocity
> condition is stated as a requirement for *"ships desiring to make orbit"*, and only two outcomes
> are named for a failed approach: past, or crash. The crash clause is keyed strictly to distance
> (*"if it is closer than 2""*), so a wrong-velocity ship in the safe band has nothing left to do but
> keep going. *Rejected:* crashing it, which would punish a slow careful approach harder than a fast
> one.

---

## 17.11 Atmospheric entry

> *"A fully or partially streamlined ship may enter atmosphere deliberately in order to land on the
> world's surface. Alternatively, a ship of any configuration may be forced to enter atmosphere due
> to either a decaying orbit or approaching a planet at too high a velocity."*

> *"To make a deliberate safe atmospheric entry, a ship must first enter orbit as described above and
> then decelerate to less than orbital velocity. A fully streamlined (capable of aero braking or
> gliding) ship can land provided it has some main drive thrust. A partially streamlined ship can
> land if it has main drive thrust at least equal to the planet gravity in Earth Gs; if it has
> insufficient thrust it will make a crash landing with the effects being up to the individual
> scenario."*

| Fit (13.11) | Deliberate landing |
| --- | --- |
| Full (10% of mass) | lands with **any** main drive thrust at all |
| Partial (5% of mass) | lands with thrust **at least the planet's gravity in Gs**; otherwise a crash landing |
| None | no deliberate entry — the uncontrolled table below |

> *"If any ship without streamlining enters atmosphere, or a streamlined ship makes an uncontrolled
> entry, roll a D6 and apply the following modifiers:"*
>
> *"• If the ship is non-streamlined, add 4."*
> *"• If partially streamlined, no modifier."*
> *"• If fully streamlined, subtract 2."*
> *"• Add 1 for every 1 point of velocity in excess of entry orbital velocity."*
> *"• Add 1 if the ship's drive is damaged (half normal thrust), or add 3 if drive knocked-out."*

| Modifier | Value |
| --- | --- |
| Non-streamlined | +4 |
| Partially streamlined | 0 |
| Fully streamlined | −2 |
| Per point of velocity over the entry orbital velocity | +1 |
| Drive damaged (half thrust, 4.11's first drive hit) | +1 |
| Drive knocked out (4.11's second) | +3 |

> *"On a final result of 2 or less, the ship manages to miraculously survive a ballistic entry, and
> crash-lands on the planetary surface. The chances of survival for crew/passengers and subsequent
> events are up to the individual scenario."*
>
> *"On a final score of 3 to 5, the ship burns up in the upper atmosphere, but there is enough time
> for any interface craft (shuttles, drop ships, etc.), fighters, or life pods on board to launch."*
>
> *"On a final score of 6 or above, the ship burns up and all crew, passengers, and equipment on
> board are lost."*

| Final result | Outcome |
| --- | --- |
| 2 or less | survives a ballistic entry and crash-lands |
| 3 – 5 | burns up; interface craft, fighters and life pods get away |
| 6 or more | burns up; everything and everyone is lost |

**Read the arithmetic before trusting it.** A non-streamlined ship starts at +4 on a D6, so its best
possible total is 5 and it can never crash-land: an unstreamlined hull entering atmosphere is dead,
and the only question is whether the fighters get out. Even a fully streamlined ship at −2 needs a
4 or less on the die once it is 2 points over orbital velocity. Nothing here is survivable at speed.

---

## Readings, in one place

| # | Rule | Reading taken |
| --- | --- | --- |
| 1 | 17.2 / 17.4 | *"Standard Screens offer no protection, but armor and Advanced Screens do"* belongs to 17.2 |
| 2 | 17.2 | cloud damage is one die on the 4.5 table, no 4.6 re-roll, `standard` mode |
| 3 | 17.2 | one damage die per ship per turn |
| 4 | 17.2 | one lock-on die per target nomination |
| 5 | 17.2 | the +1 screen level is for beams, grasers and fighters only |
| 6 | 17.3 | the advanced-sensor proviso governs sensors, not FireCons |
| 7 | 17.5 | station and monster take 6 MU, civilian 4 MU |
| 8 | 17.5 | zero or negative excess never explodes |
| 9 | 17.6 | a ship's path is its two-leg cinematic track |
| 10 | 17.6 | *"total available thrust rating"* is the drive rating |
| 11 | 17.7 | *"the Nth turn after exiting"* is `exitTurn + N` |
| 12 | 17.8 | entry velocity and orbital velocity are one number |
| 13 | 17.8 | orbit facing is the exact tangent, three clock points round |
| 14 | 17.9 | fore = `F`, aft = `A`, sides = `FS`/`AS` and `FP`/`AP` |
| 15 | 17.9 | half the zone strength rounds down |
| 16 | 17.9 | the adjusted gravity turn caps at `max(strength, unused thrust)` |
| 17 | 17.10 | *"travelling at a thrust"* is velocity |
| 18 | 17.10 | inches are MU |
| 19 | 17.10 | wrong velocity in the 2–3 band flies past |
| 20 | 12.11 | 4.11's extra-rows modifier carries into the knock-off-course roll |
| 21 | 17.1 | chunk courses are uniform clock points; speeds are not rolled |
| 22 | 17.9 | gravity cannot drive velocity below zero |
| 23 | 17.9 | the partial-orbit immunity belongs only to a pass that actually changes course |

---

## Not implemented, and why

| Rule | Why |
| --- | --- |
| **Whether a flare happens** (17.3 *"perhaps diced for each turn"*) | No frequency, no target number and no area are given. The scenario says who is caught in a flare; `resolveSolarFlare` says what it costs them. |
| **A destroyed asteroid's chunk speeds** (17.1) | *"Random … speeds"* names no range, no die and no bound. The count and the courses are rolled; velocity is left to the scenario rather than invented. |
| **Asteroid damage tracking** (17.1) | The 50/100 damage-point values are exported, but an asteroid is a `TerrainFeature`, which has no damage track. Adding one means changing `game.ts`. See the spine gaps. |
| **Bogey markers behind asteroids** (17.1) | The hiding rule is 12.1's; `ew.ts` owns bogeys. What this module contributes is the blocking predicate that rule needs, and it is exported for `ew.ts` to call. |
| **Missiles "homing on a target chosen by random die roll"** at a shared orbit marker (17.8) | Target acquisition is `ordnance.ts`'s `acquireMissileTargets`; a random choice among co-located targets belongs there, not here. |
| **One-ship-per-marker occupancy** (17.8) | *"For simplicity we recommend"* — a recommendation, and a scenario-setup one. `orbitMarkersAdjacent` and `ORBIT_SAME_POINT_RANGE` give the two rules that follow from allowing it. |
| **The orbital table's corner geometry** (17.7) | `GameState` has no table bounds, so "distance from the nearest table corner" and "the opposite edge" have nothing to measure against. The turn-count rule and the 6 MU tolerance are implemented as pure predicates over distances the caller supplies. |
| **Fighter groups orbiting** (17.7) | *"Optional but not recommended"*, with no rule attached either way. |
| **Vector movement's heading** (12.11, 17.8) | 12.12 is not implemented anywhere in the engine and `ShipState` carries no heading. The heading check *is* implemented, but only fires when the caller passes a heading explicitly. |
| **The consequences of a crash landing** (17.11) | *"The effects being up to the individual scenario"*, twice. The module reports `crash-landing`; what that costs is not a rule. |
| **Launching interface craft on a 3–5 entry result** (17.11) | The outcome is reported; getting the fighters off a dying hull is `fighters.ts`'s launch path, and 17.11 gives it no timing beyond *"there is enough time"*. |
| **Planet gravity in Earth Gs** (17.11) | Read as an input, because it is a property of the world the scenario places, not of anything the engine models. |
| **Table representation** (17.5 *"Depicting spatial phenomena"*) | Cork-bark chips and acetate. Not a rule. |
| **Ramming ships** (16.7) | Out of this domain — 17.6 is ships against rock, and rock always wins; 16.7 is ships against ships and has an entirely different resolution. |

---

## Integration notes

- **Nothing here mutates.** Every function takes values and returns new values, in the shape
  `gunboats.ts` established: dice reported, damage reported, state returned rather than written.
- **Where each function belongs in the sequence of play (2.6):**

  | Phase | Function |
  | --- | --- |
  | 5 move-ships (before all others, 16.1) | `moveDebrisCloud`, `debrisCloudExpired`, moving-asteroid paths |
  | 5 move-ships | `stationaryCollisionRisk`, `movingCollisionRisk`, `resolveCollision`, `resolveGravityZone`, `simpleOrbitApproach`, `orbitTrackArrival`, `advanceOrbit`, `cloudSpeedDamage`, `resolveMeteorField` |
  | 9 point-defence / 11 ship-fire | `hasLineOfFire`, `cloudTargetLock`, `attenuatedScreens`, `canFireFromOrbit` |
  | 11 ship-fire (target acquisition) | `hasLineOfFire` again, for missile placement (6.2) and for scans (12.1) |
  | 13 threshold | `resolveKnockedOffCourse` (12.11), `orbitDecayCheck` (17.8) |
  | any | `resolveSolarFlare`, `explosionCheck` + `createDebrisCloud` at the moment of destruction (4.9) |
- **`resolveKnockedOffCourse` runs after `threshold.ts` has resolved the row**, not instead of it:
  12.11 says *"after checking for systems failures make one further roll"*. It needs the same
  `rowsLost` / `extraRows` that `threshold.ts` used, so it is one more call in the same loop.
- **`resolveSolarFlare` reports which systems are knocked out** and leaves the crossing-off to
  `game.ts`'s `destroySystem`, because *"knocked out as if by a threshold check"* is 4.11's outcome
  and `threshold.ts` owns it.
- **The threshold target number is imported, never re-derived.** `dice.thresholdTarget` is the one
  place `max(2, 7 − rowsLost)` lives, and both 12.11 and 17.8's orbit-decay check call it.
