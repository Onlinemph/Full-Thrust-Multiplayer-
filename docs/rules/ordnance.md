# Ordnance (section 6)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, sections 6.2 – 6.10
(`continuum-rulebook-extract.txt` lines 1275–1512), plus the rules they lean on: 2.6 the sequence
of play, 4.9 damage modes, 4.10 the optional rear-arc rule, 4.11 threshold checks, 5.2 FireCon,
5.16 the K-gun's point-defence DRM and flak barrages, 7.3 advanced screens, 7.10–7.15 ADFC, PDS,
ADS, scatterguns and grapeshot, 8.8 fighters as point defence.

Implemented in `src/engine/ordnance.ts`. Tested in `src/engine/ordnance.test.ts`.

Ordnance is the one weapon family that does not resolve in the phase it is fired. A missile is
**launched in phase 3**, sits on the table as a marker while **ships move in phase 5**, **finds a
target in phase 7**, is **shot at in phase 9** and only then **attacks in phase 10** (2.6). It
therefore needs state of its own — `MissileMarker` — which outlives every one of those phases.

What lives elsewhere and is *used* here rather than re-implemented:

| Thing | Where | Why |
| --- | --- | --- |
| The d6, `sumD6`, the beam damage table | `dice.ts` | one place a die can enter the engine |
| The point-defence tables, salvo and heavy | `dice.ts` (`pointDefenceKills`) | 6.4 and 8.8 are the same table |
| Distance, arcs, clock courses | `geometry.ts` | 2.1 is measurement |
| Where damage lands (armour, hull, thresholds) | `combat.ts` (`applyDamage`) | 4.9: that depends on the *target* |

**Vocabulary.** A *salvo* is one marker holding up to six missiles (6.2). *Lock-on* is the
attacker's D6 that says how many of those missiles are actually on target (6.4). A *kill* is a
missile shot down by point defence. A *hit* is a missile that gets through. *Damage* is what a hit
does — 1D6 for a salvo missile, 3D6 for a Heavy Missile, 1D3 for a rocket (6.5, 6.7).

---

## 6.2 Missiles (SAP)

> *"A Salvo Missile Launcher (SML) system fires salvos of anti-ship missiles. Normally there are six
> missiles in one salvo."*

> *"Heavy Missiles are long range homing weapons fired individually, with more powerful warheads and
> armor or counter measures that make them harder to shoot down. Heavy Missiles are always fired
> from one-shot launcher racks."*

> *"There are two grades of missile available: standard and extended range (ER). Both grades work in
> the same way, but the ER missiles have … a greater range."*

| | Value | Rule |
| --- | --- | --- |
| Missiles in a full salvo | 6 | 6.2 |
| Grades | standard, extended range (ER) | 6.2 |
| Damage mode | SAP — half rounded up on armour, remainder on the hull | 6.5, 4.9 |

Missiles attack **ships**, not fighters or other ordnance: 6.3 says the marker attacks *"an enemy
ship within 6 MU"*, and nothing in section 6 lets a missile home on a fighter group.

---

## 6.3 Launching missiles — phase 3

> *"Ships launch missiles in phase 3 of the turn. The firing player selects a ship, announces the
> launch of a missile or salvo, and places a Salvo Missile marker at the intended point of aim. This
> may be anywhere up to a maximum range of 24 MU from the firing ship, or 36 MU for extended range
> missiles, but must be within the boundaries of the fire arcs through which the launcher system may
> bear. (And not obstructed by any asteroids, planets, or similar obstacles.) The missile salvo
> marker is left in place while all ships are moved."*

| Launch | Max placement range | Rule |
| --- | --- | --- |
| Standard salvo or Heavy Missile | 24 MU | 6.3 |
| Extended range (ER) | 36 MU | 6.3 |
| Two-stage (multi-stage option) | 16–24 MU this turn, 48 MU total over two legs | 6.6 |
| Antimatter missile | 18 MU | 6.6 |

> *"An operational FireCon is necessary to launch Heavy Missiles, Salvo Missile Racks, or Salvo
> Missile Launchers."* (6.3)

5.2 says how that FireCon is spent: *"An operational FireCon is needed for each of the following in
each phase of a turn: … Launching Salvo or Heavy Missiles. To avoid the need for record keeping
these limitations are per phase, not per turn, so a FireCon used to launch missiles can also be used
to direct other weapons in the Ship Fire Phase of the same turn."* So **one FireCon per launch**,
counted within phase 3 only; an Advanced FireCon counts as two (5.2). Rocket pods (6.7) and Plasma
Bolt Launchers (6.8) are *not* on 6.3's list and need none.

Arcs: *"All missiles have 3 arcs"* (6.6) — three of the six 60-degree arcs (4.2), the 180-degree
forward field the multi-stage rule calls *"the normal 180° arc for missile launch"*.

### The seeker rule — after ship movement

> *"If after ship movement there is an enemy ship within 6 MU of the marker (in any direction) then
> the missile(s) will attack it. If there is more than one potential enemy target within 6 MU then
> the missiles will go for the closest of them."*

> *"Move the missile marker next to the target ship and apply point defense fire before resolving
> missile hits. Note that if there is no valid target within 6 MU at the end of movement, the missile
> launch was wasted and the marker is removed from play."*

| | Value | Rule |
| --- | --- | --- |
| Attack radius | 6 MU, any direction | 6.3 |
| Attack radius vs a vector-movement ship (optional) | 3 MU | 6.3 |
| Target choice | the **closest** eligible enemy ship | 6.3 |
| Nothing in radius | marker removed — launch wasted | 6.3 |

The seeker is not a choice the owner makes: the marker attacks the closest enemy ship, full stop.

> *"Optional: If you choose to use vector movement … we strongly suggest reducing the attack radius
> of missiles from 6 MU to 3 MU … allow missiles to attack if within 6 MU of a cinematic drive ship
> but only within 3 MU of a vector drive ship."*

So the radius is a property of the **target**, not of the game: in a mixed game each ship carries
its own radius.

---

## 6.4 Point defence against missiles — phase 9

> *"When resolving missile fire, the defending player must first decide what defenses to allocate
> against each Heavy Missile or Salvo Missile marker. Once that has been done for all ships, resolve
> defensive fire as follows."*

### Against Salvo Missiles

| Weapon | Die | Rule |
| --- | --- | --- |
| PDS (and ADS, which *"fires like a PDS"*, 7.13) | 4 or 5 kills one; **6 kills two and re-rolls** | 6.4, 7.13 |
| Beam-1 or fighter | 5 or 6 kills one; **re-roll on 6** | 6.4 |
| K-1 used as PDS | as PDS at −1 DRM | 5.16 |
| Scattergun | 1D6 kills, no roll to hit | 7.14 |
| Grapeshot launcher | 4 PDS dice | 7.15 |

> *"The attacking player then rolls a D6 for each Salvo Missile marker. The result is the number of
> missiles in the salvo that are actually on target. Subtract the number of missiles killed from the
> D6 score that the attacker rolled. Any positive number is the number of missiles that actually get
> through the defenses and hit the target."*

> *"If defensive fire killed more missiles than were in the salvo then the extras are 'overkill';
> they cannot be allocated to other salvos or Heavy Missiles. If there are no defenses at all, at
> least one missile in a salvo will always get through."*

So: `hits = max(0, lockOn − kills)`, and kills never travel between markers.

### Against Heavy Missiles

| Weapon | Die | Rule |
| --- | --- | --- |
| PDS | kills the missile on 5 or 6 | 6.4 |
| Beam-1 or fighter | kills the missile on 6 | 6.4 |

One kill destroys a Heavy Missile outright; there is no lock-on roll. An **antimatter** missile is
the exception and takes three (6.6).

### Fighters flying point defence

> *"Note that fighters get one roll each in screening groups, so a full strength group will roll 6
> dice. For each Salvo Missile or Heavy Missile killed by a fighter roll an additional D6: on a roll
> of 6 the fighter is destroyed as well."*

One extra D6 **per kill**, not per die rolled, and only for kills scored by fighters.

### Order of rolling

6.4 resolves defensive fire first and then has the attacker roll lock-on; the worked example in 6.5
narrates the lock-on first. Both orders give the same distribution because allocation is fixed
before either roll, and the engine follows the rule text: **defence dice, then lock-on**.

A PDS that rolls a 6 always takes its re-roll even when the salvo is already dead — the engine
cannot know the lock-on yet — and the surplus is discarded as overkill.

---

## 6.5 Damage (SAP)

> *"Each Heavy Missile inflicts 3D6 of damage on the target. (As usual, half rounded up can be taken
> on armor, the remainder on the hull.)"*

> *"Each missile in a salvo that hits the target ship inflicts 1D6 of SAP damage. Standard Screens
> have no effect on missiles. Advanced level-1 Screens subtract 1 from each damage roll, Advanced
> level-2 Screens subtract 2."*

| | Damage | Rule |
| --- | --- | --- |
| Heavy Missile | 3D6, SAP | 6.5 |
| Each salvo missile that hits | 1D6, SAP | 6.5 |
| Standard screens | no effect | 6.5 |
| Advanced screens level 1 / 2 | −1 / −2 per damage **die**, floored at 0 per die | 6.5, 7.3 |
| Missile damage dice | never re-roll | 6.5 worked example |
| Optional rear-arc rule | missiles do **not** ignore armour | 6.5, 4.10 |

7.3 is the floor: *"Negative damage is treated as zero; the target ship cannot regain damage
points!"* — applied per die, because 7.3 subtracts *"from each damage die"*.

6.5's closing line reads *"missiles do not do ignore armor"* in the text layer of the PDF; 4.10
settles the typo — *"(Missiles or fighters do not benefit from rear arc attacks. At short ranges the
engines of a spaceship emit a considerable amount of energy, enough to melt a missile or fighter
before it can finish an attack.)"*

### Worked example (6.5), implemented as a test

> *"Two missile salvoes are fired at a single target ship. The ship has … one Point Defense System
> (PDS) and two Beam-1 batteries … The defender chooses to use the PDS alone against one incoming
> salvo, and the 2 Beam-1 batteries to combine fire against the second salvo. … For the first the
> roll is 2, but the second is luckier and rolls 5. The first salvo has only two missiles on target,
> and the defending player rolls the PDS die and gets a 6, thus shooting them both down. … For the
> second salvo with five missiles incoming, the defender gets to roll 2 dice for the 2 Beam-1
> batteries, and rolls a 4 and a 6. The 6 allows a re-roll, but this only gets a 2. So the defender
> has killed only one incoming missile from this salvo of five. The end result is that four missiles
> of the second salvo get past all the defenses … A D6 is rolled for each of them, scoring 3, 1, 3,
> and 6; missile hits don't re-roll so this gives a grand total of 13 damage points … If the ship has
> four boxes of armor, 4 points of damage will be taken on the armor and the remaining 9 on the hull
> boxes."*

| Salvo | Lock-on | Defence | Kills | Hits | Damage |
| --- | --- | --- | --- | --- | --- |
| 1 | 2 | 1 PDS die: 6 | 2 (overkill 0 usable elsewhere) | 0 | — |
| 2 | 5 | 2 Beam-1 dice: 4, 6 → re-roll 2 | 1 | 4 | 3+1+3+6 = **13** |

13 SAP against 4 armour boxes: half rounded up is 7, but only 4 boxes exist, so 4 on armour and 9
on the hull.

---

## 6.6 Mountings and magazines

> *"Heavy Missiles and Salvo Missile Racks (SMR) have individual symbols on the ship SSD. Once fired,
> it is crossed off and cannot be used again. Each counts as one system for threshold point checks."*

> *"A Salvo Missile Launcher (SML) may fire one salvo per turn provided ammunition is left in the
> magazine."*

> *"Each magazine has a mass rating, which determines the number of Salvo Missile loads carried: mass
> 2 for a standard salvo, mass 3 for ER. … Magazines and launchers are considered separate systems
> for threshold point checks."*

| Item | Mass | Cost | Rule |
| --- | --- | --- | --- |
| Single-shot Salvo Missile Rack (SMR) | 4 | 3 per mass | 6.6 |
| Salvo Missile Launcher (SML) | 3 | 3 per mass | 6.6 |
| Magazine load, standard salvo | 2 | 3 per mass | 6.6 |
| Magazine load, ER salvo | 3 | 3 per mass | 6.6 |
| Arcs | 3 arcs, all missiles | 6.6 |
| Rack-mounted antimatter missile | 2 | 5 per mass | 6.6 |
| Mine rack | 2 | 3 per mass | 6.9 |
| Mine (load) | 1 | 2 points each, minimum 2 per rack | 6.9 |
| Rocket pod | 1 | 3 points | 6.7 |
| Plasma Bolt Launcher, class *n* | 3*n*, +*n* per extra arc (max 3 arcs) | 3 per mass | 6.8 |

**Not in the extract:** the mass of an *extended-range* single-shot rack, and the mass of a **Heavy
Missile** rack. The caption reads *"Single shot SMLs are 4 mass / SML launchers are 3 mass /
Extended range single shot SMLs"* and then breaks off into the magazine-load line; the Heavy Missile
rack is never priced in section 6 at all (section 14.6's table is past the extract's last page).
`ORDNANCE_MOUNTS` records both masses as `null` rather than guessing one.

### Magazine capacity

> *"The mass allocated to magazine space … may be broken down into separate magazines at the
> designer's discretion, but with the following important limitation: any one launcher system may
> only be fed from one magazine, though a single magazine may feed more than one launcher."*

> *"…the ship with a single mass 8 magazine could choose its load as 4 standard salvoes, or 1
> standard and 2 ER salvoes. (A 2 standard and 1 ER load is also allowed, but wastes 1 space in the
> magazine.)"*

So a magazine of mass *M* is packed load by load, each load costing 2 (standard) or 3 (ER), and
leftover mass is simply wasted. One magazine may feed several launchers; one launcher draws from
exactly one magazine, and *"if one launcher is lost while it still has missiles in its dedicated
magazine, those missiles are useless."*

A magazine *"is rolled for as a single system, regardless of its capacity or the number of Salvo
Missile loads in it"* (4.11 threshold checks).

### Optional: Multi-Stage Missiles

> *"An extra stage for a Heavy Missile, Salvo Missile Rack, or Salvo Missiles increases the mass by 2
> and doubles the points cost. Only standard missiles may be multistage, not ER; and a magazine may
> only carry either regular missiles or multi-stage missiles, not a mixture."*

> *"The extra stage increases the range by 24 MU and the 'duration' by 1 turn."*

> *"On the turn fired, a two stage missile marker is placed between 16 and 24 MU from the launching
> ship and within the normal 180° arc for missile launch. The marker itself has a facing, which must
> be the nearest clock facing to the direction from the launching ship to the missile marker."*

> *"If no enemy ship is within 6 MU of a missile marker at the end of ship movement, it is not
> removed. Instead in the Missile Launch Phase of the following turn the missile marker is placed at
> the intended point of aim, anywhere from 16 to 24 MU within the 60° front arc of the marker."*

> *"Multi-stage missiles only have the full 180° firing arc on the launch turn, and must always be
> moved at least 16 MU each turn."*

> *"While the missile is 'in flight' the marker may be fired on by fighters or ADFC."*

| | Value | Rule |
| --- | --- | --- |
| Extra stage | +2 mass, points × 2 | 6.6 |
| Extra range | +24 MU (48 MU over two legs) | 6.6 |
| Extra duration | +1 turn | 6.6 |
| Leg length, every turn | 16 MU minimum, 24 MU maximum | 6.6 |
| Arc, launch turn | the launcher's 180-degree field | 6.6 |
| Arc, later turns | the 60-degree front arc of the **marker** | 6.6 |
| Marker facing at launch | nearest clock point to launcher → marker | 6.6 |
| ER may be multi-stage | no | 6.6 |
| Mixed magazine | no | 6.6 |

*Duration* is modelled as `endurance`: turns of flight left. A single-stage missile has 1 — it seeks
once and is gone. A two-stage missile has 2, so one failed seek leaves it on the table to be
re-aimed in phase 3 of the next turn. The marker keeps its facing between turns because the next
leg is measured from it.

### Antimatter Missiles (AMT torpedoes)

> *"Antimatter Missiles are a Heavy Missile body fitted with an antimatter warhead. … mounted in
> external racks. The Antimatter Missile rack has 3-arc coverage, with a range of 18 MU. The unique
> decay products … makes the Antimatter Missile distinguishable from other capital missiles, so enemy
> point defense may concentrate on them."*

> *"Antimatter Missiles take multiple 'hits' to kill. Each hit from point defense fire reduces the
> warhead strength by 1d6 and the blast radius by 1 MU. Three hits will disrupt the warhead
> sufficiently to prevent any meaningful explosion."*

> *"If an Antimatter Missile impacts at full strength it explodes, doing 3d6 damage to the target
> ship and any other unit within 1 mu. It does 2d6 damage to any ship or unit within 2 MU, and 1d6
> damage to any ship or unit within 3 MU."*

> *"Screens reduce the damage of Antimatter Missile blasts. Apply a -1 DRM to each die of Antimatter
> Missile damage per level of screen. So a ship with screen-2 caught in a 3d6 Antimatter Missile
> blast would only take 3d6-6 damage."*

At full strength the blast is a staircase: 3D6 out to 1 MU, 2D6 out to 2 MU, 1D6 out to 3 MU. Each
point-defence hit takes one die off the top *and* one MU off the radius, so the staircase keeps its
shape as it shrinks:

| PD hits | Warhead | ≤1 MU | ≤2 MU | ≤3 MU |
| --- | --- | --- | --- | --- |
| 0 | 3D6, radius 3 | 3D6 | 2D6 | 1D6 |
| 1 | 2D6, radius 2 | 2D6 | 1D6 | — |
| 2 | 1D6, radius 1 | 1D6 | — | — |
| 3 | disrupted | — | — | — |

> *"Antimatter Missiles may also be fused to detonate in open space, without making an attack run.
> This can be done to try and destroy large waves of incoming missiles, or blow holes in dense
> minefields. Any enemy ship and fighters may still fire at the missile if it is within 3 MU range,
> before it detonates."*

> *"If an Antimatter Missile fails a threshold test it explodes on the rack, immediately doing 1d6
> damage to the carrying ship, and 1d6 damage to any unit within 1 MU. A missile that explodes on the
> rack obviously cannot be later repaired by damage control. Screens and armor will not protect a
> ship from its own exploding missiles."*

**[reading]** Ordnance markers caught in an antimatter blast are destroyed. 6.6 states the purpose —
*"to try and destroy large waves of incoming missiles, or blow holes in dense minefields"* — without
a mechanic, and 6.8 sets the house precedent for blast weapons: *"Missiles and gunboats are
destroyed."*

---

## 6.7 Rocket Pods

> *"Rocket Pods are one-shot weapons that are crossed off the SSD once fired. They are fired during
> ordnance launch, but they use a different attack mechanic. Select an enemy ship within range and
> firing arc of the rocket pod. The Rocket Pod fires TWO rockets at the target ship."*

| Range | Hits on |
| --- | --- |
| up to 6 MU | 2+ |
| up to 12 MU | 3+ |
| up to 18 MU | 4+ |

> *"If the rockets 'hit' then place an appropriate number of rocket markers next to the ship. These
> will attack at the same time as other missiles, and the rockets can be shot down by point defense
> weapons as if they were conventional missiles. As the rockets fly straight in, they hit in the arc
> visible at the moment of launch."*

> *"Rocket Pods can be fired at gunboats. They suffer a -1 DRM to target the gunboat."*

> *"Rockets do 1d3 damage (Semi-AP) each. Mass 1 and cost 3 points"*

| | Value | Rule |
| --- | --- | --- |
| Rockets per pod | 2 | 6.7 |
| Maximum range | 18 MU | 6.7 |
| Damage | 1D3 SAP per rocket that gets through | 6.7 |
| Against a gunboat | −1 DRM on the to-hit die | 6.7 |
| Mass / points | 1 / 3 | 6.7 |

A rocket that hits does not seek: it is placed next to the ship it was aimed at and attacks in
phase 10 with everything else. The launch arc is stored on the marker because it decides which of
the target's point-defence weapons can bear.

**[reading]** *"as if they were conventional missiles"* means the **salvo** table of 6.4 (PDS 4-5
one / 6 two and re-roll; Beam-1 or fighter 5-6 with a re-roll on 6), not the Heavy Missile table.
The harder table is explicitly the price of a Heavy Missile's *"armor or counter measures"* (6.2),
which a rocket does not have. There is no lock-on roll — the to-hit dice at launch have already
decided how many rockets are coming — so kills simply subtract from the rockets on the marker.

**[reading]** 1D3 is rolled as one D6 halved and rounded up (1-2 → 1, 3-4 → 2, 5-6 → 3), the
standard tabletop substitute; `dice.ts` has no D3.

---

## 6.8 Plasma Bolt Launchers

> *"While not technically ordnance, in that PBLs have no expendable ammunition, they follow similar
> mechanics to missiles."*

> *"a ship can mount only one 1 launcher per 50 mass of ship. So a mass 101-150 ship could mount 3
> launchers, while a mass 1-50 ship could only mount 1. … The second limitation is that a PBL may only
> fire every other turn."*

> *"The PBL is fired during the Ordnance Launch Phase. A marker showing the detonation point is
> placed anywhere within arc and line of sight of the launcher, out to a range of 30 MU. PBLs explode
> with a blast radius of 6 MU (12 MU diameter), and every ship, missile, fighter and gunboat within
> the blast radius will be damaged."*

| | Value | Rule |
| --- | --- | --- |
| Launchers allowed | one per 50 mass, rounded up | 6.8 |
| Rate of fire | every other turn | 6.8 |
| Marker range | up to 30 MU, within arc and line of sight | 6.8 |
| Blast radius | 6 MU | 6.8 |
| Damage | 1D6 per class, rolled separately for each target | 6.8 |
| Screens | −1 DRM per level (max 2) on **each** die | 6.8 |
| Stealth, holofields | no defence | 6.8 |
| Fighters in the blast | 1D6 casualties per die of plasma damage | 6.8 |
| Missiles and gunboats in the blast | destroyed | 6.8 |
| Mass | 3 per class, +1 × class per extra arc, 3 arcs maximum | 6.8 |
| Cost | 3 per mass | 6.8 |

### Shooting the bolt down

> *"Any ship or other unit within the blast radius may fire at the PBL to try and shoot it down, but
> this is quite difficult. PDS fire suffers a -2 DRM, so they only score hits on a die roll of a 6.
> Scatterpacks and Interceptor Pods do 1 BD* of hits. Each hit on the PBL reduces its strength by 1.
> So a class 1 PBL is destroyed by a single hit, while a huge class 6 will take 6 points of damage to
> completely destroy."*

> *"Class 1 beams and class 1 K-guns may NOT be used in their secondary PDS role against Plasma
> Bolts, but Kra'Vak Scatterguns may, and they are even more effective than standard PDS: they roll
> like a 'beam' die, removing 1 strength from a bolt on a 4 or 5 result, and 2 strength classes on a 6
> (NO reroll)."*

> *"Fighter groups may target Plasma Bolts if they are within 6 MU; roll for each fighter as if it was
> a PDS (i.e.: each roll of 6 counts as a hit)."*

> *"Ships with ADFC capability may add their PDS fire in support of any ships within 6 MU of them that
> are within the effect radius of a Plasma Bolt, even if the ADFC-equipped ships is itself outside the
> danger area."*

| Defender | Effect on the bolt |
| --- | --- |
| PDS | −2 DRM: one strength on a natural 6 |
| Fighter (within 6 MU) | one strength on a 6 |
| Scattergun / Interceptor Pod | beam die: 1 strength on 4-5, 2 on 6, **no re-roll** |
| Class-1 beam, class-1 K-gun | may not engage a plasma bolt at all |

A bolt whose strength reaches 0 does nothing; otherwise it explodes at its reduced class, so damage
is `strength` D6 per target.

### Shaped-charge mode (optional)

> *"As an option a PBL may be fired as a type of shaped charge projectile. If fired in this mode it
> must be noted the turn of firing during the Write Orders Phase. The firing player uses the
> Projectile Weapon to Hit Chart to determine if the PBL hits. A hit will generate 1D3 points of
> damage per size class of the Plasma Bolt. Standard Screens will have no effect but Advanced Screens
> will at -1 DRM for each level of screens. Damage is Semi-Armor Piercing."*

**Not implemented: the to-hit roll.** The Projectile Weapon Hit Probability Table is *"page 153"*
(5.16), and the text extract ends at page 80, so the chart's numbers are not available. The damage
half is implemented and takes the hit as an input the caller supplies.

---

## 6.9 Mines and mine racks

> *"The detection range of a mine is 3 MU. All enemy vessels that enter the radius from the mine
> marker, at any point during movement, not just at the end of a move, will be detected and fired on
> by the mine. Roll 4D6 and apply damage as for normal beam fire, reducing accordingly if the target
> is screened. After a mine has detonated, remove its marker from the table at the end of the movement
> phase."*

| | Value | Rule |
| --- | --- | --- |
| Detection radius | 3 MU | 6.9 |
| Trigger | entering the radius at **any point** during the move | 6.9 |
| Attack | 4D6 read off the beam table, screens apply | 6.9 |
| After detonation | marker removed at the end of the movement phase | 6.9 |
| Mine rack | mass 2, 3 points per mass | 6.9 |
| Mine | mass 1, 2 points each, minimum 2 per rack | 6.9 |

**[reading]** *"apply damage as for normal beam fire"* is taken literally, so the four dice are
penetrating (P): 5.3 beams re-roll a natural 6 and 6.9 describes the warhead as *"a focused pulse of
energy … it does similar damage to a close range hit from a beam weapon."* The mine is a beam, and
beams in this game penetrate.

Because a ship's move is a path and not a point, the trigger test is the **shortest distance from
the mine to any leg of the ship's move** — under cinematic movement that is two legs, half the
velocity on the old course and the rest on the new (3.4).

---

## 6.10 Minelaying — phase 5

> *"Ships equipped with minelaying systems may deposit mine markers on the table during the Ship
> Movement Phase. The player must note in the order for that ship that it will deploy mines in that
> turn by writing 'mine' in the order box."*

> *"Individual mines are carried as loads within a magazine. Each minelayer system fitted may deploy
> one mine per turn, so a ship with two mine systems may drop two markers during its movement, either
> both at the same spot, or at different points. The mines may be placed anywhere along the ship's
> course during that movement. Ships dropping mines are moved first after writing orders."*

> *"A mine marker does not become active until the game turn after the one in which it is deployed.
> Once placed, the marker will remain on the table (completely stationary) until it detonates, or is
> cleared by a minesweeping system."*

| | Value | Rule |
| --- | --- | --- |
| Declared | in the written order, phase 1 | 6.10 |
| Laid | during phase 5, before any other ship moves | 6.10, 2.6 |
| Mines per system per turn | 1 | 6.10 |
| Placement | anywhere along that ship's course this turn | 6.10 |
| Active from | the game turn **after** the one it was laid in | 6.10 |
| Movement | none, ever | 6.10 |

**Not implemented: minesweeping.** 6.10 says a mine may be *"cleared by a minesweeping system"* and
2.6 phase 5 says to *"resolve collisions, mine sweeping, or mine attacks as they occur"*, but
neither the sweeper's range nor its die roll appears anywhere in the extract (the minesweeper is a
secondary system of 13.13, which is beyond the extract's last page). `clearMine` removes a marker
on request and rolls nothing, so the rule can be finished when the table arrives.

---

## What this module does not decide

- **Where damage lands.** Every attack here returns a `WeaponResult` (`weapons/contract.ts`) with
  `mode: 'SAP'` for missiles and rockets, `'standard'` for a plasma bolt blast, `'P'` for a mine.
  `combat.applyDamage` splits it across armour, layers and hull (4.9) and reports threshold rows
  (4.11).
- **Which defences a ship allocates.** 6.4 makes that a player decision taken before any dice are
  rolled; the engine takes the allocation as input.
- **Whether a marker's line of aim is blocked.** 6.3 bars aim points *"obstructed by any asteroids,
  planets, or similar obstacles"*; terrain (17) is not implemented anywhere in the engine, so the
  launch functions take an `obstructed` flag the caller may set.

---

## Integration notes

- **`ORDNANCE_WEAPON_SPECS`** is a `WeaponSpecTable` covering `heavy-missile`, `salvo-missile-rack`,
  `salvo-missile-launcher`, `antimatter-missile`, `rocket-pod`, `plasma-bolt-launcher` and
  `mine-rack`. Each spec answers `maxRange`, `requiresFireCon`, `damageMode` and `ordnance: true`,
  and its `fire()` always returns `null` because no ordnance is fired in phase 11. `weapons/index.ts`
  can merge it in beside `BEAM_WEAPON_SPECS` and `KINETIC_WEAPON_SPECS` with one import.
- **What `game.ts` calls, in sequence order:** `launchMissile` / `fireRocketPod` /
  `launchPlasmaBolt` / `relocateMultiStageMarker` (phase 3) → `moveOrdnanceMarkers`, `layMines`,
  `minesTriggeredBy` + `resolveMineAttack` (phase 5) → `acquireMissileTargets` (phase 7) →
  `resolveMissilePointDefence` / `resolvePlasmaBoltDefence` (phase 9) → `resolveOrdnanceAttack`,
  `resolveAntimatterDetonation`, `resolvePlasmaBoltDetonation` (phase 10).
- **Defined here because the spine does not carry them:** `d3` (no D3 in `dice.ts`),
  `nearestCourse` (no degrees-to-clock in `geometry.ts`), `distanceToSegment` / `distanceToPath`
  (point-to-point measurement only), and a point-defence roll that honours a DRM
  (`dice.pointDefenceKills` takes none, which the K-1 of 5.16 needs). The un-modified case still goes
  through `dice.pointDefenceKills` so the 6.4 table lives in one place.
- **Reading taken on a modified point-defence die:** the re-roll is earned by the **natural** 6, in
  line with 4.6 — *"a +1 DRM makes a 5 hit as though it were a 6 but does not earn the extra die"* —
  so a K-1's natural 6 scores as a 5 and still re-rolls.
