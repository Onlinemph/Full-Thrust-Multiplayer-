# Kinetic and exotic weapons, turrets and spinal mounts (5.14 – 5.23)

Everything in sections 5.14 – 5.23 of *Full Thrust: Project Continuum* v1.1.4, written out with
every number and its rule reference. This is the specification
`src/engine/weapons/kinetics.ts` is checked against; `src/engine/weapons/kinetics.test.ts` tests
the numbers below.

Quotations are from `continuum-rulebook-extract.txt`, lines 1041–1274.

---

## 0. What these weapons have in common

Most of this section is **projectile** weapons, and a projectile differs from a beam in the
mechanism, not just the numbers:

| | Beam (4.5) | Projectile (5.14, 5.16, 5.18) |
| --- | --- | --- |
| Dice | class, −1 die per 12 MU band | one die to hit |
| Hit and damage | one roll, read off the beam table | two rolls: hit, then damage |
| Standard Screens (7.2) | reduce damage | **no effect** |
| Advanced Screens (7.3) | reduce damage | reduce damage, per the weapon |

7.2 states the screen rule for the whole family: *"Screens only protect against fire from beams
and similar weapons such as Grasers and fighters. Other weapons such as Pulse Torpedoes and
missiles are able to penetrate screens with no degradation of their damage effects."*

7.3 then gives Advanced Screens two separate rules, and which one a weapon takes depends on how it
rolls its damage:

- *"SMPs and similar weapons that ignore Standard Screens and roll a combined hit and damage D6
  are affected by Advanced Screens as if they were beams."* — the Submunition Pack and the Fusion
  Array's BD\*.
- *"Pulse Torpedoes, missiles, and other weapons that are unaffected by Standard Screens and roll
  one or more D6 for damage subtract 1 from each damage die against level-1 Advanced Screens.
  Against level-2 Advanced Screens, subtract 2 from each die. Negative damage is treated as zero."*
  — Pulse Torpedoes and the VPT.

A weapon whose damage is **not rolled** (the MKP's flat 4, the K-Gun's class) is caught by neither
clause. The K-Gun says in its own text what Advanced Screens do to it; the MKP says nothing, so
nothing happens to it.

### Damage modes (4.9)

- **(P)** penetrating: a natural 6 damages *and* re-rolls; re-roll damage skips screens and armour.
- **(AP)**: one point per armour layer, the rest straight to the hull.
- **(SAP)**: half the damage of a hit, rounding up, on the armour; the remainder to the hull or the
  next layer.

A section heading carrying no letters and no BD\* means plain BD — 4.6: *"If a beam type weapon
does not cause re-rolls it will be designated simply BD."* That is how the Gravitic Gun (5.20) is
read as having no re-rolls.

---

## 1. The Projectile Weapon Hit Probability Table — RECONSTRUCTED

**This is the one table in this domain that could not be read.** 5.14, 5.16 and 5.18 all defer to
the *"Projectile Weapon Hit Probability Table (page 153)"*, and the text extract we work from stops
part-way through page 81 (see `SOURCES.md`). Nothing else in the extract prints a line of it.

The table below is a reconstruction from what the extract *does* say. It is one constant,
`PROJECTILE_HIT_TABLE`, and every projectile weapon in the module reads it; dropping in the real
page-153 numbers is a one-line change with no other edits anywhere.

| Range (MU) | Short range line | Standard line | Long range line |
| --- | --- | --- | --- |
| 0 – 6 | 2+ | 2+ | 2+ |
| 6 – 12 | 3+ | 3+ | 3+ |
| 12 – 18 | — | 4+ | 4+ |
| 18 – 24 | — | — | 5+ |
| beyond | out of range | out of range | out of range |

The evidence, in order of weight:

1. **Reach: 12 / 18 / 24 MU.** 5.16's Flak barrage places its Blast Marker *"up to 24 MU away for
   long range guns, 18 for standard and 12 for short"*. The barrage is thrown by the gun itself, so
   those are the three distances a K-Gun shoots, one 6 MU band apart.
2. **Band width: 6 MU.** The Fusion Array *"hits as a modified projectile weapon"* (5.19) and its
   table is banded 0–6, 6–12, 12–18, 18–24, 24–30, 30–36. The Flak numbers are all multiples of 6.
3. **Accuracy falls one point per band.** The shape of every ranged table in the book that *is*
   printed (4.5's beam dice, 5.19's two Fusion tables).
4. **The three lines are equally accurate inside a band they share.** The trade the book describes
   between them is *mass for reach* and nothing else: an SRK-3 is mass 3, a K-3 mass 5, an LRK-3
   mass 10, for the same class-3 damage. Nowhere is a short-range mount described as more accurate
   up close, only as cheaper. Under this reading the Variable Strength Pulse Torpedo's settings
   (5.14) also make sense: you set it for the range you expect to shoot at, and the shorter the
   setting the heavier the warhead.
5. **Overloading fits.** 5.14 has an overloaded torpedo read *"the Projectile Weapon Hit Table of
   the next smaller class of weapon"*, which under this reading costs it one band of reach and
   nothing else — range traded for warhead, which is exactly how the rule is described.

A band boundary — exactly 6 MU, exactly 12 MU — is read as the **nearer** band, matching
`geometry.rangeBand` and the printed *"0 to 6 MU"* / *"6 to 12 MU"* labels of 5.19.

DRMs (1.7) apply to the to-hit roll, and to the to-hit roll only: hit and damage are separate rolls
for a projectile, so charging a jammer's −1 against both would count it twice.

---

## 2. Pulse Torpedoes (SAP) — 5.14

*"As a projectile weapon, Pulse Torpedoes ignore Standard Screens. If a Pulse Torpedo hits, it
inflicts 1d6 point of damage, Semi-Armor piercing (SAP)."*

| | To hit | Damage | Mode |
| --- | --- | --- | --- |
| SR Pulse Torpedo | SR line (to 12 MU) | 1D6 | SAP |
| Pulse Torpedo | standard line (to 18 MU) | 1D6 | SAP |
| LR Pulse Torpedo | long line (to 24 MU) | 1D6 | SAP |

Advanced Screens (7.3): −1 per level from the damage die, minimum 0.

**Mass and cost.** All Pulse Torpedoes cost **3 points per mass**; maximum 3 arcs.

| Mount | 1 arc | additional arcs |
| --- | --- | --- |
| SR Pulse Torpedo | 2 | *"+1 mass for 2 additional arcs"* → 3 mass for 3 arcs |
| Pulse Torpedo | 4 | +1 mass per arc |
| LR Pulse Torpedo | 8 | +2 mass per arc |
| Variable Strength (VPT) | 8 | +2 mass per arc, **5 points per mass** |

*Reading:* the SR mount's *"+1 mass for 2 additional arcs"* is one upgrade that buys both extra
arcs, so 2 arcs and 3 arcs both cost 3 mass.

### Overloaded Pulse Torpedoes (AP)

- Must be *"noted in the orders"*, and the tube *"may not have fired in the previous turn"*.
- **Short Range Pulse Torpedoes may not be fired overloaded.**
- Hit on *"the Projectile Weapon Hit Table of the next smaller class of weapon"*: LR reads the
  standard line, standard reads the SR line.
- Damage: *"roll a 1D6 as normal with a +2DRM, giving a damage range between 3 and 8 points"*, and
  the damage becomes **AP**.
- Misfire: *"If the Pulse Torpedo rolls a 1, roll a second 1D6. On a second result of 1 the Pulse
  Torpedo tube is destroyed and may not be repaired by DCPs."*
- *"If the Pulse Torpedo is not fired it is ejected by the crew and counts as having fired."*
- Upgrade costs **+1 point per mass**, and *"Every Pulse Torpedo in the fleet must be upgraded
  (except Short Range Pulse Torpedoes) or none at all."*

*Reading:* the misfire check hangs off the damage roll, and the damage roll only happens on a hit —
*"If the Pulse Torpedo hits, roll a 1D6 … If the Pulse Torpedo rolls a 1"*. A torpedo that misses
does not risk its tube. The +2 and the Advanced Screen penalty are both modifiers on that one die
(net `+2 − screens`, floored at 0); the misfire test is on the **natural** 1.

### Variable Strength Pulse Torpedoes (SAP/AP)

One launcher, a setting chosen in the Write Orders Phase — *"'S' for short, 'L' for long"*, and
*"If a setting is not selected it is assumed the VPT is set to standard."*

| Setting | To hit | Damage | Screens bypassed |
| --- | --- | --- | --- |
| long | long line | 1D3 SAP | Standard |
| standard | standard line | 1D6 SAP | Standard |
| short | SR line | 1D6+2 **AP** | Standard **and Advanced** |

The short setting is the only weapon in the section that ignores Advanced Screens outright, so it
takes no −1/−2 damage penalty; the other two do.

*Reading:* a D3 is a d6 halved and rounded up. Full Thrust is a pure d6 game (1.7) and that is the
only even split of six faces into three results.

---

## 3. Turreted Submunition Pack (P) — 5.15

*"Submunitions are one-shot weapons… Once a Submunition Pack has been fired, it is crossed off the
ship SSD and cannot be used again."*

| Range | Dice |
| --- | --- |
| to 6 MU | 3 BD, re-rolling 6s |
| to 12 MU | 2 BD |
| to 18 MU | 1 BD |
| beyond 18 MU | out of range |

- Ignores Standard Screens; against Advanced Screens it is 7.3's *"SMPs and similar weapons"* and
  reads the beam table at the Advanced level.
- **Mass 1, 3 arcs, 3 points per mass.**

---

## 4. K-Guns (AP) — 5.16

*"K-Guns are projectile weapons, and as such their chance of hitting decreases with range, but they
are unaffected by screens. All K-Guns are Armor Piercing (AP)."*

- Hit on the projectile line for the variant.
- Damage = **the class of the gun**. *"a hit from a K-3 will inflict at least 3 points of damage"*.
- Doubling: *"Roll a d6, if the result is equal to or less than the class of the K-Gun, the damage
  done is doubled. A roll of a 6 is always a failure, so K-6's and larger do not automatically
  double, but a K-6 that does (on a roll of 1-5) inflicts 12 points of armor piercing damage!"*
- Advanced Screens: *"deduct the advanced screen level from the class of the K-gun to give the
  final number for the die roll."* Worked example from the text: *"if a ship with level 2 advanced
  screens is hit by a class 4-Gun the K-Gun would need to roll a 1 or 2 to double its damage instead
  of the normal 1-4. In this example a class 1 or 2 K-Gun would not be able to get doubling damage
  at all."* The base damage is **not** reduced.

**K-1 as point defence.** *"Like a Beam-1, a K-1 can be used as a PDS, but with a -1 DRM. It cannot
fire into the aft arc of the ship, however."* One PDS die at −1 — which makes a natural 6 kill one
rather than two. It still re-rolls, because 4.6 makes the re-roll test a **natural** six and says
nothing about a DRM taking one away.

*"When engaging missiles and other attacking ordnance the K-1 gunner always waits until the missile
has entered the closest range bracket to achieve the best chance of hitting. When engaging fighters
or gunboats (which are not attacking the ship) the hit probability of the K-1 is based on the range
bracket of the target."*

**Mass, by the printed table.** K-Guns cost **4 points per mass**.

| Class | Standard | Short (SRK) | Long (LRK) |
| --- | --- | --- | --- |
| 1 | 2, 6 arcs | 1.5, 6 arcs | 4, 6 arcs |
| 2 | 3, 1 arc (+1 for a 2nd, max 2) | 2, 2 arcs | 6, 1 arc (+2 for a 2nd, max 2) |
| 3 | 5, 1 arc | 3 | 10 |
| 4 | 8, 1 arc | 4 | 16 |
| 5 | 11, 1 arc | 6 | 22 |
| 6 | 14, 1 arc | 7 | 28 |

*"Short range K-Guns are half the mass, rounded up, of a conventional K-Gun"* and *"Long range
K-Guns are double the mass"*. The printed table wins where the rule of thumb disagrees: half of a
K-1's 2 would be 1, but the table prints 1.5 and then sells them *"in pairs for 3 mass"*.

### Flak ammunition / barrage fire

*"K-Guns of class 2 or larger can be equipped to fire high explosive shells timed to detonate away
from the ship."*

- **When:** *"At the beginning of the Launch Missile Phase"* (2.6 phase 3).
- **Where:** one Blast Marker per barraging gun, *"up to 24 MU away for long range guns, 18 for
  standard and 12 for short"*.
- **Cost to fire:** *"One FireCon is required to fire a barrage."*
- **Effect:** *"The Flak round will detonate against any fighter or missile travelling through or
  within 2 MU of the Blast Marker and are attacked with a number of PDS dice equal to the class of
  the gun that fired the barrage (at a -1 DRM). It is possible to affect multiple targets including
  your own ordnance or fighters."*
- **Against missiles:** *"do not roll for the number of missiles that lock on until the Missile
  Attack Phase. Simply roll to see how many hits the Flak barrage scores on the missile marker and
  keep track of it until the Missile Attack Phase. Then subtract that from the number of missiles
  that lock on."*
- **Against ships:** *"If a ship, friendly or enemy, is within the blast range it will take a single
  point of damage on a roll of 1."*
- *"All 'Blast Markers' are removed at the end of the turn."*
- **Cost:** *"For an additional 2 points a K-Gun may be equipped with Flak ammunition. All the
  K-Guns on a ship (except K-1s) must be so equipped."*

*"Travelling through"* is tested against the whole move, not just the end point — the marker is
placed in phase 3, before anything moves.

---

## 5. Multiple Kinetic Penetrators — 5.17

*"An MKP has a range of 12 MU, and hits on a roll of 4+. On a roll of a 6 it hits twice. Each hit
inflicts 4 points of damage (AP)."*

- One-shot. *"As projectiles, MKPs ignore screens; furthermore they are armor piercing weapons."*
- Flat range: no bands, no falloff, nothing past 12 MU.
- **Mass 1, 1 arc, 4 points per mass.**

*Reading:* MKPs ignore Advanced Screens as well. 5.17 says "screens" without qualification, and
both of 7.3's clauses bite on a *damage die* — the MKP rolls none, its damage is flat.

---

## 6. Boarding Torpedoes — 5.18

- Magazine fed: *"Every time it fires, hit or miss, it expends one of the Boarding Torpedoes in the
  magazine."* An empty magazine, a disabled magazine or a disabled launcher stops it firing.
- *"There are no long-range or short-range versions available"* — the standard line only.
- On a hit: *"one point of damage to the target's hull, bypassing any armor, and two 'Marine'
  markers are placed on the enemy ship."*
- **Launcher 2 mass, 3 arcs; torpedoes 1 mass each; 3 points per mass.**

*Reading:* that one point is reported as penetrating damage rather than normal AP damage. 4.9's AP
rule would put the first point *on* an armour layer, which is the opposite of *"bypassing any
armor"*; the engine's penetrating pile is the one that skips armour.

---

## 7. Fusion Array — 5.19

*"The Fusion Array … fires and hits as a modified projectile weapon, yet does damage in BD\*. It is
possible for a fusion projectile to hit, and yet do no damage."*

Configured as a **Fusion Flare** launcher or a **Fusion Torpedo** launcher: *"The array must be
configured before combat begins. It can be changed during a game by taking the weapon 'off line' for
one turn."*

| Range | Flare: hits on / damage | Torpedo: hits on / damage |
| --- | --- | --- |
| 0 – 6 MU | 1+ / 1 BD\* | 6 / 6 BD\* |
| 6 – 12 MU | 2+ / 2 BD\* | 5+ / 5 BD\* |
| 12 – 18 MU | 3+ / 3 BD\* | 4+ / 4 BD\* |
| 18 – 24 MU | 4+ / 4 BD\* | 3+ / 3 BD\* |
| 24 – 30 MU | 5+ / 5 BD\* | 2+ / 2 BD\* |
| 30 – 36 MU | 6 / 6 BD\* | 1+ / 1 BD\* |

- *"Because the Fusion Array hits as a projectile, it ignores Standard Screens. Advanced Screens
  will prevent damage the same way they would against beam weapons."*
- Against fighters: *"both the Flare and Fusion Torpedo deliver a single hit, on a 6+ destroying one
  fighter."*
- **Mass 3 for 1 arc, +1 mass per additional arc, 3 arcs maximum; 3 points per mass.**

---

## 8. Gravitic Guns — 5.20

*"Gravitic Guns generate beam dice, and hit like a normal beam weapon… As a beam-type weapon, the
effects of a Gravitic Gun can be reduced by screens."*

- Beam dice: class dice at 0–12 MU, −1 per further 12 MU band (4.3, 4.5). Grav-1 reaches 12 MU,
  Grav-4 reaches 48.
- Screens of either kind reduce them as they would a beam (7.3).
- No (P) on the heading and no BD\* in the text, so **no re-rolls** (4.6).
- **Cost 3 points per mass.** Grav-1 mass 1, 6 arcs. Grav-2 mass 2, 3 arcs, *"+1 mass for 3
  additional arcs"*. Grav-3 mass 4, 1 arc, +1 per arc. Grav-4 mass 8, 1 arc, +2 per arc.

**MISSING FROM THE SOURCE.** *"The damage inflicted by the hits depends on the speed of the
target"* — and the speed/damage table is nowhere in the extract. No number is invented for it: each
hit does 1 point, which makes the weapon behave as a plain beam, unless the caller supplies
`graviticDamagePerHit(targetVelocity)`. That hook is where the table goes when it is found.

---

## 9. Pulsers (P) — 5.21

*"The Pulser is an adaptable weapon system that can be configured before a battle to optimize it for
long, short or medium range combat."*

| Setting | Dice | Range |
| --- | --- | --- |
| short | 6 BD\* | to 12 MU |
| medium | 2 BD\* | to 24 MU |
| long | 1 BD\* | to 48 MU |

A single range band each — the dice do not fall off, they stop.

**Point defence.** *"The Pulser, in any mode, can also be used as a PDS. In PDS mode the Pulser is
limited to the fire arcs of the weapon mount, but if the arcs permit it may fire into the aft arc of
the ship. In PDS mode the Pulser delivers a single dice of point defense fire. A Pulser configured
for short range cannot use its beam dice for defensive fire."*

*Reading:* every Pulser gets the one PD die. The last sentence is a clarification, not an exception
— what a short Pulser may not do is throw its six **beam** dice at fighters, which the six-dice
setting would otherwise invite.

**Mass and cost.** 5 points per mass. Mass 2 for 1 arc, mass 3 for 3 arcs, mass 4 for 6 arcs.

---

## 10. Turrets — 5.22

*"While not technically a 'weapon system', turrets are mechanical assemblies into which entire
weapon mounts are fitted."*

| Turret arcs | Mass of weapons per 1 mass of turret |
| --- | --- |
| 2 | 6 |
| 3 | 5 |
| 4 | 4 |
| 5 | 3 |
| 6 | 2 |

- *"When determining turret size, round all fractions up."* A 9-mass weapon in a 4-arc turret needs
  ⌈9/4⌉ = 3 mass of turret.
- **Turrets cost 3 per mass.**
- *"A ship is limited to one turret per size 50 mass of ship."*
- *"Like multi-arc weapons, turret arcs do not have to be contiguous."*
- Facing is written in the Write Orders Phase and *"revealed after ship movement before fighters
  take any secondary moves"* (2.6 phases 1, 5, 6).
- *"The weapons in a turret can fire into the single 60-degree arc that the turret is facing.
  Weapons with more than 1 arc that are mounted in a turret lose their additional arcs, and are
  limited to the single turret arc. All the weapons mounted in a single turret must be fired at the
  same target."*
- *"If the turret is damaged due to a threshold test or a Needle Beam hit, it remains stuck in its
  current facing until repaired."*

So a turret **replaces** a weapon's arcs with its own: it widens a 1-arc gun to the turret's
coverage and narrows a 3-arc gun to it. In any one turn the weapon fires into the single recorded
arc.

---

## 11. Spinal Mounts — 5.23

*"Spinal Mounts are weapons so immense and powerful that the gun forms the central core around which
the rest of the ship is assembled."*

| Size | Mass | Range | Beam width |
| --- | --- | --- | --- |
| Small | 8 | 24 MU | 1 MU |
| Medium | 16 | 36 MU | 1.5 MU |
| Large | 32 | 48 MU | 2 MU |

Restrictions, all from 5.23:

- *"A ship may only mount up to 16 mass of Spinal Mount weapon per 50 mass of ship. So a battleship
  (mass 101-150) could mount up to three Medium Spinal Mounts."*
- *"Spinal Mounts must face forward, cannot be turret mounted, and have a fire arc that is half the
  normal width (30 degrees)."*
- *"The turn after a Spinal Mount if fired a ship cannot maneuver at all, apply thrust, nor can it
  charge its FTL drive."*
- *"Spinal Mounts may only be fired every other turn, though a ship with multiple Spinal Mounts
  could alternate firing the weapons to keep up a continuous barrage."*
- *"Larger Spinal Mounts generate beams that are longer and wider… Spinal Mounts deliver the same
  number of damage dice along their entire range."*
- *"Missiles, fighters, gunboats and even Plasma Bolts caught within can also be hit. Their chances
  of being hit are the same as for a ship; there is no negative DRM for shooting anti-ship weapons
  at small targets. If multiple ships are within the beam area, they all sustain the same number of
  dice of hits, but roll dice separately for each target."*
- *"Only a planet or other large body can block a Spinal Mount."*
- *"Spinal Mounts ignore the range reduction of Stealth and DRM of Holofields."*
- *"Spinal Mounts can be targeted at an 'empty point of space'… It still requires a FireCon."*

The beam is therefore a swathe: a model is caught when it is within half the mount's beam width of
the line laid from the firing ship through its aim point, and no further along that line than the
mount's range.

### Beam Spinal Mount (P)

*"Beam Spinal Mounts generate 12 BD\* hits within the beam area. Screens have their normal effect on
these hits."* **4 points per mass.**

### Plasma Spinal Mount

*"They generate 6 Plasma Cannon dice within the beam area. These inflict 1d6-2-screens hits to all
targets within the beam area, with rerolls on sixes. Note that there is no -1 for Holofields, which
are ignored by area of effect weapons."* **4 points per mass.**

Plasma Cannon dice are 5.5's: *"on a roll of 3 it inflicts 1 hit, on a 4 it inflicts 2 hits, on a 5
it inflicts 3 hits, on a 6 it inflicts 4 hits, penetrates, and gets a reroll"* — `face − 2 −
screens` hits, minimum 0, one damage per hit. Re-roll dice are scored without the screen
subtraction, and their damage is penetrating (4.6).

### Point Singularity Projector (AP)

*"The PSP only generates 2 BD (no rerolls) of hits along its flight path."* Two beam dice read for
**hits** — 4 or 5 is one hit, 6 is two — and *"The damage from a PSP is armor piercing, and is not
affected by screens of any type"*, so they are read unscreened.

- Against small craft: *"It does 1 damage point per hit to small craft, missiles, fighters, and
  gunboats."*
- Against ships: *"the damage per hit is 1d6 per 50 mass of ship."*

**5 points per mass.**

> **The rulebook's example contradicts its own rule.** *"So if two hits were scored against a mass
> 100 BC it would suffer 2d6 damage."* Under "1d6 per hit per 50 mass" two hits on a mass-100 ship
> is 4d6. 2d6 is what you get from *either half* of that sentence taken alone — 1d6 per hit ignoring
> the mass, or 2d6 for the mass ignoring the hits — and never from both together.
>
> **Reading taken:** the rule sentence, `max(1, ⌊mass / 50⌋)` damage dice per hit, because the mass
> scaling is the whole point of the weapon (*"The bigger the ship is, the worse the damage
> inflicted"*) and dropping it would leave the PSP a strictly worse buy than the Beam Spinal Mount
> it costs more than. The minimum of one die keeps an escort from being immune. The example is read
> as an arithmetic slip.

---

## 12. Summary of costs (points per mass)

| System | Cost | Rule |
| --- | --- | --- |
| Pulse Torpedo (all ranges) | 3 | 5.14 |
| Variable Strength Pulse Torpedo | 5 | 5.14 |
| Overload upgrade | +1 | 5.14 |
| Submunition Pack | 3 | 5.15 |
| K-Gun (all ranges) | 4 | 5.16 |
| Flak ammunition | +2 points flat | 5.16 |
| Multiple Kinetic Penetrator | 4 | 5.17 |
| Boarding Torpedo (launcher and rounds) | 3 | 5.18 |
| Fusion Array | 3 | 5.19 |
| Gravitic Gun | 3 | 5.20 |
| Pulser | 5 | 5.21 |
| Turret | 3 | 5.22 |
| Beam Spinal Mount | 4 | 5.23 |
| Plasma Spinal Mount | 4 | 5.23 |
| Point Singularity Projector | 5 | 5.23 |

---

## 13. What is not implemented

| Rule | Why |
| --- | --- |
| Projectile Weapon Hit Probability Table | Page 153, outside the text extract. Reconstructed above; one constant to replace. |
| Gravitic Gun speed/damage table | 5.20 states the rule and prints no table anywhere in the extract. The mechanism is implemented with an injectable damage function; no number is invented. |
| *"All the K-Guns on a ship (except K-1s) must be so equipped"* / *"Every Pulse Torpedo in the fleet must be upgraded … or none at all"* | Fleet-level and ship-level build validation, not firing rules. The predicates (`canMountFlak`, `canFireOverloaded`) are exported for a validator to use. |
| Turret facing orders, Blast Marker placement and removal, the spinal mount's post-fire lockout | These are turn state, not weapon resolution. The rules are implemented as predicates (`turretFiringArcs`, `flakCatchesPath`, `spinalCanFire`, `spinalLocksShip`); holding the state across turns belongs to `game.ts`. |
