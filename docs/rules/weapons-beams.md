# Energy weapons (sections 5.2 – 5.13)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, sections 5.2–5.13
(`continuum-rulebook-extract.txt` lines 815–1040), plus the rules they lean on: 4.3 range bands,
4.5–4.7 beam fire, re-rolls and screens, 4.9 damage modes, 4.11 threshold checks, 7.2/7.3 screens,
7.12/7.13 PDS and ADS, 7.16 area screens, 7.17 holofields, 7.20 cloaks.

Implemented in `src/engine/weapons/beams.ts`. Tested in `src/engine/weapons/beams.test.ts`.

What lives elsewhere and is *used* here rather than re-implemented:

| Thing | Where | Why |
| --- | --- | --- |
| The beam damage table, re-rolls, the d6 | `dice.ts` (`beamDamage`, `rollBeamVolley`, `d6`) | one place a die can enter the engine |
| Range bands and dice-at-range | `geometry.ts` (`rangeBand`, `beamDiceAtRange`) | 4.3 is measurement |
| Arc checking | `geometry.ts` (`bearsOn`), `combat.ts` (`planFireControl`) | fire control is bookkeeping, not gunnery |
| Where damage lands (armour, hull, thresholds) | `combat.ts` (`applyDamage`, `applyVolley`) | 4.9: that depends on the *target* |
| The threshold check roll | `dice.ts` (`thresholdCheck`) | phase 13 rolls it — except EMP, which rolls its own (5.4) |

**Vocabulary used throughout.** A *die* is one D6 of a weapon's fire. A **hit** is what one die
scores off the beam table (4.5: 4 or 5 = 1, 6 = 2, reduced by screens). **Damage** is what a hit
does to the target: for a beam 1 point per hit, for a graser or phaser 1D3 per hit, for a Heavy
Graser 1D6 per hit, for a transporter beam one boarding party per hit, for an EMP projector one
threshold test per hit. 5.9 fixes this vocabulary — *"Transporter Beams generate a BD hits … Every
hit generated allows the player to send one unit of Marines"* — and 5.6/5.7/5.8 all use it the same
way, so hits and damage are tracked separately everywhere in `beams.ts`.

---

## 5.2 Targeting systems — not weapons

These are exported as data and helper functions, not as a `WeaponSpec`.

### Standard FireCon

> *"An operational FireCon is needed for each of the following in each phase of a turn:*
> *• Firing ship weapons (not point defense) at a single ship or fighter group.*
> *• Firing Needle Beam weapons against a single ship system.*
> *• Launching Salvo or Heavy Missiles."*

> *"To avoid the need for record keeping these limitations are per phase, not per turn, so a FireCon
> used to launch missiles can also be used to direct other weapons in the Ship Fire Phase of the same
> turn."*

Mass 1, cost 4 per mass (= 4 points). Tracks **1** target.

**It confers no DRM.** 5.2 gives the standard FireCon no die roll modifier at all; it is a permission
to fire, not a bonus. `STANDARD_FIRECON.drm` is therefore `0`, stated explicitly so that the absence
is visible rather than merely missing.

### Advanced Fire Control (AFC)

> *"Advanced FireCon systems can track two separate targets each, acting just like two normal
> FireCons."*
>
> *"Advanced FireCon can also track and scan enemy ships out to a range of 72 MU for detection
> purposes."*
>
> *"Note: some weapon systems require AFCs to function."*

Mass 1, cost 5 per mass (= 5 points). Tracks **2** targets. Scan range **72 MU**. Again **no DRM**:
5.2 says "more range and tracking capability", which is spent as targets tracked and detection
range, not as a to-hit bonus.

`fireConCapacity(standard, advanced) = standard + 2 × advanced` — the number of targets a ship may
engage in one phase (4.4).

Weapons in this section that need an AFC (5.8): a phaser firing in **needle-beam mode**, and a
phaser firing as an **ADS**. *"One AFC must be dedicated if used in this way and will provide enough
control for unlimited targets."*

---

## The common pattern

Unless a weapon's own section says otherwise:

* **Range bands are 12 MU** (4.3), band 1 is `0 < r ≤ 12`, and a mount rolls
  `class − (band − 1)` dice, zero at longer range (4.5). Maximum range is `class × 12 MU`.
* **Screens** reduce each die by the 4.7 table: level 1 ignores 4s, level 2 makes 5s and 6s score 1.
* **(P) / BD\*** weapons re-roll every **natural** 6, forever; re-roll dice ignore screens and
  armour and their damage goes straight to the hull (4.6). A plain `BD` weapon does not re-roll.
* A DRM shifts what a die *scores* but never earns a re-roll (4.6: *"Re-rolls are made for a natural
  (unmodified) 6 only"*). The modified face is clamped to 1–6, as in `dice.rollBeamVolley`.

Two optional/defensive rules the resolvers honour when the caller flags them:

* 7.16 area screens: *"In the case of ships with level two screens being protected by an area screen
  weapons that would normally penetrate do not get their re-rolls."* → `areaScreen` with
  `targetScreens: 2` suppresses re-rolls for every (P) weapon here.
* 7.16 for plasma: *"Plasma weapons would be at -3 on their die rolls in addition to any shields the
  target ship mounts"* — that is just the −1 per screen level of 5.5 applied at the three levels an
  area screen can stack to, so `areaScreen` adds one level to the plasma penalty (max 3).

---

## 5.3 Beam weapons (P)

Dice, ranges, screens and re-rolls are exactly 4.5–4.7; 5.3 adds only the mounting rules.

| Class | 0–12 | 12–24 | 24–36 | 36–48 | 48–60 | Max range |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | — | — | — | — | 12 |
| 2 | 2 | 1 | — | — | — | 24 |
| 3 | 3 | 2 | 1 | — | — | 36 |
| 4 | 4 | 3 | 2 | 1 | — | 48 |
| 5 | 5 | 4 | 3 | 2 | 1 | 60 |

1 damage point per hit. Damage mode **(P)**.

Point defence: a **Beam-1 only** — 7.12: *"Beam-1 systems, K-1 guns and other small weapons are dual
purpose and can also be used for point defense."* It is the weaker PD die of 8.8 (kills on 5 or 6,
re-roll on 6), which `dice.ts` calls `PdMode` `'beam-1'`.

> *"Class 2 beams may be purchased with two arcs but may only be placed in broadside positions."*

Cost 3 points per mass.

| Mount | Mass | Arcs |
| --- | --- | --- |
| Beam-1 | 1 | 6 |
| Beam-2 | 2 | 3 (+1 mass for 3 more) |
| Beam-2 broadside | 1 | 2 (port or starboard pair) |
| Beam-3 | 4 | 1 (+1 mass per extra arc) |
| Beam-4 | 8 | 1 (+2 mass per extra arc) |
| Beam-5 | 16 | 1 (+4 mass per extra arc) |

**Worked example (4.6), used as a test.** Two mounts at 18 MU, a Beam-3 (2 dice) and a Beam-2
(1 die), unscreened. Faces 1, 5, 6 → 0 + 1 + 2 = 3 damage, the 6 earns a re-roll of 4 → 1 more
point, penetrating. Total 4, of which 1 bypasses screens and armour.

**Worked example (4.7), used as a test.** Six dice against level-2 screens: 2, 3, 3, 4, 6, 6 → the 4
is a miss, each 6 does 1 = 2 points. Re-rolls 4 and 6 (scored unscreened) = 1 + 2, and the further
re-roll 3 = 0. Penetrating total 3... **read carefully**: the rulebook says *"the 4 inflicts 1 damage
point and the 6 another 2 for a total of 5"* — it is totalling the whole attack, 2 normal + 3
penetrating = 5. The engine reports `normalDamage: 2, penetratingDamage: 3`.

---

## 5.4 EMP Projectors / Ion Cannons

> *"EMP projectors are the same size and mass as beam weapons, and generate a similar number of BD\*
> in each range bracket."*

So: class dice, 12 MU bands, maximum range `class × 12`, re-rolls on natural 6s (BD\*).

> *"Their hits do not damage the hull and armor of target ship, rather they make that ship take
> threshold tests against some systems. They also ignore Standard screens and armor."*

* Hull damage: **none**, ever. `normalDamage` and `penetratingDamage` are always 0.
* Standard screens: **ignored** — rolled as though the target were unscreened.
* Advanced screens (7.3): *"SMPs and similar weapons that ignore Standard Screens and roll a combined
  hit and damage D6 are affected by Advanced Screens as if they were beams."* An EMP die is exactly
  such a combined die, so against **Advanced** screens the 4.7 table applies normally. This is the
  reading a table would use; 5.4 only claims immunity to *Standard* screens.
* Armour: ignored (there is no damage to absorb).

### The EMP threshold test

> *"A single EMP hit requires a threshold test on a 6, two hits require a test on a 5+, and three or
> more hits require a test on a 4+. Modify the roll by +1 for each row of hull boxes checked off in
> phase 11 and 12 (ships fire and boarding phases)."*

| EMP hits on the ship this turn | Test |
| --- | --- |
| 1 | 6 |
| 2 | 5+ |
| 3 or more | 4+ |

Modifier: **+1 per row of hull boxes crossed off in phases 11 and 12 that turn.**

> *"EMP hits from multiple ships can be combined to produce more dramatic effects."*

The difficulty is set by the **total** hits the target took that turn, from every attacker, not by
one mount's hits.

> *"The number of systems that can be affected is equal to the total number of EMP hits delivered
> that turn. The attacker (person who fired the EMP weapon) chooses the allocation of EMP hits to
> valid target systems."*

One allocated hit = one test. Several hits may be stacked on one system, which then takes that many
tests (the rulebook's own example).

**Systems that can be affected** — the list is closed:

> *"drives, FTL, FireCon, screens, turrets, ECM, Area ECM, any fields (Stealth, Holofield), and
> cloaking systems."*

`EMP_VULNERABLE_SYSTEMS` is exactly that: `drive`, `ftl-drive`, `firecon`, `advanced-firecon`,
`screen-generator`, `turret`, `ecm`, `area-ecm`, `stealth-field`, `holofield`, `cloaking-device`,
`cloaking-field`, `tuffley-cloak`. The Reflex Field (7.25) is **not** included: 5.4 names Stealth and
Holofield as the fields it means, and 7.25 calls the reflex field *"a variation on conventional
screen technology"* rather than one of them. Extend the exported array if your group rules otherwise.

**Worked example (5.4), used as a test.** A battlecruiser takes 7 EMP hits in a turn: 7 threshold
tests on **4+**. Three FireCons; the attacker puts 2 hits on each FireCon (two tests each on 4+) and
the last hit on a screen generator (one test on 4+). *"Allocating all 7 hits to the drive would have
almost certainly taken the drive out (7 chances of a 4+ threshold, with two hits being necessary to
completely cripple the drive)"* — the drive follows 4.11: first failure halves thrust, second
disables it, so `EmpTestResult.failures` is reported and not collapsed to a boolean.

> *"Systems knocked out by EMP attacks can be repaired by damage control like any other threshold
> damage."*

(Unlike needle-beam and commando-raid kills, which cannot.)

### EMP in point defence

> *"EMP pulses can also effectively burn out the smaller electronic systems on missiles, fighters and
> gunboats … EMP-1s can be used in point defense like a beam 1, inflicting a BD hits with a -1 DRM."*

An **EMP-1 only**, as the beam-1 PD die (kills on 5 or 6, re-roll on a 6) with −1 applied to each
face — so in practice only a natural 6 kills, and it still re-rolls. Against a heavy missile the
beam PD die already needs a 6 (6.4), so an EMP-1 cannot hurt one at all; that falls out of the
arithmetic and is reported rather than patched.

Cost 3 per mass. EMP-1 mass 1 / 6 arcs; EMP-2 mass 2 / 3 arcs, +1 mass for 3 more; EMP-3 mass 4 /
1 arc, +1 per extra arc; EMP-4 mass 8 / 1 arc, +2 per extra arc. (No EMP-5 is listed.)

---

## 5.5 Plasma Cannon

> *"Plasma Cannon inflict 1d6-2 (plus an additional -1 per level of screen) hits, with each hit
> inflicting 1 damage. So, on a roll of 3 it inflicts 1 hit, on a 4 it inflicts 2 hits, on a 5 it
> inflicts 3 hits, and on a 6 it inflicts 4 hits, penetrates, and gets a reroll!"*
>
> *"Like beam weapons, they generate a number of dice equal to the size class of the Plasma Cannon up
> to 12 MU, and lose one dice of damage for each additional 12 MU."*

Hits per die = `max(0, face − 2 − screenLevel)`, 1 damage each:

| Face | Unscreened | Level 1 | Level 2 | Level 3 (area screen, 7.16) |
| --- | --- | --- | --- | --- |
| 1 | 0 | 0 | 0 | 0 |
| 2 | 0 | 0 | 0 | 0 |
| 3 | 1 | 0 | 0 | 0 |
| 4 | 2 | 1 | 0 | 0 |
| 5 | 3 | 2 | 1 | 0 |
| 6 | 4 + re-roll | 3 + re-roll | 2 + re-roll | 1 + re-roll |

Class dice, 12 MU bands, maximum range `class × 12`.

**Reading taken on "penetrates":** *"on a 6 it inflicts 4 hits, penetrates, and gets a reroll"* is
the ordinary (P) designation of 4.6 — the 6's own 4 points land on armour like any other die, and it
is the **re-roll** dice whose damage ignores screens and armour. Reading it as "the 6's four points
themselves bypass armour" would make a plasma cannon strictly better than every other (P) weapon in
the book against armour, which nothing else in 5.5 suggests. Re-roll dice are scored with **no**
screen penalty (4.6: the re-roll *"is assumed to have already penetrated the screen"*), so a re-rolled
6 is 4 more points however heavily screened the target is.

> *"Because of their heavy and somewhat unwieldy mounts, Plasma Cannon cannot be effectively used in
> defensive fire mode."*

No point defence. Damage mode **(P)**.

Cost 3 per mass; *"double the mass of normal beam weapons"*. Plasma-1 mass 1 / 3 arcs; Plasma-1 mass
2 / 6 arcs; Plasma-2 mass 4 / 3 arcs, +2 mass for 3 more; Plasma-3 mass 8 / 1 arc, +2 per extra arc;
Plasma-4 mass 16 / 1 arc, +4 per extra arc.

---

## 5.6 Standard Grasers (SAP)

> *"Grasers inflict a number of BD\* hits in the closest 12 MU range bracket as the size of the
> Graser. So a Graser-3 would inflict 3 BD\* to 12 MU, 2 BD\* to 24 MU, and 1 BD\* to 36 MU, with each
> hit doing 1d3 damage semi-AP."*

* Class dice, 12 MU bands, max range `class × 12`. Screens per 4.7.
* BD\*: natural 6s re-roll, re-roll hits ignore screens and their damage is penetrating (4.6).
* **1D3 damage per hit**, not per die: a 6 against an unscreened target is 2 hits and therefore
  2D3 damage.
* Damage mode **SAP** (4.9: half the damage of a hit, rounded up, on armour; the rest to the hull or
  the next layer).

1D3 is rolled as a D6 halved rounding up (1–2 → 1, 3–4 → 2, 5–6 → 3) — the rulebook does not say how
to roll a D3 and that is how a table does it with the dice in front of them. It also keeps every
face in the battle log a real D6 face.

No point defence: 5.6 grants none, and 7.12 lists only Beam-1s, K-1s *"and other small weapons … as
noted in their descriptions"*.

Cost 3 per mass. Graser-1 mass 1 / 3 arcs; Graser-1 mass 2 / 6 arcs; Graser-2 mass 4 / 3 arcs, +2
mass for 3 more; Graser-3 mass 8 / 1 arc, +2 per extra arc; Graser-4 mass 16 / 1 arc, +4 per extra
arc.

---

## 5.7 Heavy Grasers (SAP)

> *"The range bands for Heavy Grasers are 18 MU, not 12, so a class 2 Heavy Graser rolls 2D6 at 0-18
> MU, 1D6 at up to 36 MU."*

| Class | 0–18 | 18–36 | 36–54 | Max range |
| --- | --- | --- | --- | --- |
| 1 | 1 | — | — | 18 |
| 2 | 2 | 1 | — | 36 |
| 3 | 3 | 2 | 1 | 54 |

> *"Heavy Grasers score hits as beam weapons: against unscreened targets rolls of 4 or 5 inflict 1
> hit; rolls of 6 inflict 2. Against level-1 screens rolls of 4 do no damage, and against level-2
> screens rolls of 5 or 6 inflict only 1 hit."*

— i.e. the ordinary 4.7 table, restated.

> *"Heavy Grasers are not penetrating weapons and do not re-roll on a 6."*
>
> *"However Heavy Graser may be upgraded to weapons that re-roll on 6s. These 'High Intensity
> Grasers' (HiGs) are devastating and cost more than normal Heavy Grasers."*

> *"Unlike beams each hit from a Heavy Graser inflicts 1D6 points of damage."*

* Standard Heavy Graser: `BD`, no re-rolls, all damage normal (armour may absorb it, SAP-split).
* HiG: `BD*`, natural 6 re-rolls, re-roll hits scored unscreened and their 1D6s are penetrating.
* Damage mode **SAP** either way.
* *"Heavy Graser-1s cannot be used for point defense."* Nothing in 5.7 allows any Heavy Graser as PD.

**Worked example (5.7), used as a test.** Two Heavy Graser-2 mounts, target at 24 MU with a level-1
screen. Each mount rolls 1D6. The faces are 4 and 6. The 4 is a miss (level-1 screen), the 6 scores
**two hits and no re-roll**. Damage is then 2D6: 4 and 3 = **7 points**.

Cost 3 points per mass, **4 per mass for HiGs**. Heavy Graser-1 mass 2 / 1 arc, mass 3 / 3 arcs,
mass 4 / 6 arcs; Heavy Graser-2 mass 9 / 1 arc, +3 mass per extra arc; Heavy Graser-3 mass 24 /
1 arc, +6 mass per extra arc. (The rulebook prints these mounts as "Graser-1/2/3" under the Heavy
Graser heading; they are the heavy mounts, as the masses show.)

---

## 5.8 Phasers (SAP)

Anti-ship fire is identical to a standard Graser (5.6):

> *"Phasers inflict a number of BD\* hits in the closest 12 MU range bracket as the size of the
> Phaser. So a Phaser-3 would inflict 3 BD\* to 12 MU, 2 BD\* to 24 MU, and 1 BD\* to 36 MU, with each
> hit doing 1d3 damage semi-AP."*

Class dice, 12 MU bands, max range `class × 12`, BD\* re-rolls, 1D3 per hit, mode **SAP**.

Its other modes:

> *"They may also be used as a Needle Beam weapon of the same class if the ship also mounts an
> Advanced FireCon (AFC)."*
>
> *"Lastly each mount may be used as a single PDS instead of firing in anti-ship mode. If the ship
> also mounts an Advanced FireCon (AFC) each Phaser may be used as an ADS instead. One AFC must be
> dedicated if used in this way and will provide enough control for unlimited targets."*

* Needle-beam mode: resolved exactly as 5.13 at the same class — **requires an AFC**, and the
  resolver returns `null` without one.
* PD mode: one **PDS** die (7.12: 1D6, and the 8.8 PDS table against fighters and salvoes).
* ADS mode: requires a dedicated AFC (7.13: one die to 12 MU, or two to 6 MU).
* A mount does one of these per turn, never two — a weapon fires once a turn (2.6, 4.5).

> *"Phasers cost 3 points per mass +2 for each weapon. (6 points per mass if ship has AFC)"*
>
> *"For example a Phaser-2 (3 arc) would be mass 4 and cost 14 points, 24 points if the ship had AFC."*

So 4 × 3 + 2 = **14**, and with an AFC 4 × 6 = **24** — the +2 per weapon is *replaced* by, not added
to, the AFC rate, which is what the worked example shows. Phaser-1 mass 1 / 3 arcs; Phaser-1 mass 2 /
6 arcs; Phaser-2 mass 4 / 3 arcs, +2 mass for 3 more; Phaser-3 mass 8 / 1 arc, +2 per extra arc;
Phaser-4 mass 16 / 1 arc, +4 per extra arc.

---

## 5.9 Transporter Beams

> *"Transporter Beams generate a BD hits (no rerolls) against targets within range. Their number of
> BD at range is the same as any other beam mount."*

Class dice, 12 MU bands, max range `class × 12`. **No re-rolls** (plain `BD`).

> *"Transporter Beams are affected by screens like normal beams."*

Screens apply per 4.7. **No hull damage at all** is inflicted.

> *"Every hit generated allows the player to send one unit of Marines or a Damage Control Party over
> to the enemy ship."*

So hits = boarding parties delivered (`WeaponResult.boarders`), for a capture attempt under 12.7.

> *"If a ship runs out of Damage Control Parties and Marines, it may no longer use transporters."*
>
> *"The transporters can be used to send Marines to help in the defense of an allied ship. Roll to hit
> normally."*

> *"They cannot be used to target fighters, gunboats or other ordnance, and thus cannot be used in
> defensive fire."*

No point defence.

### Commando raids

> *"Marines can be sent to an enemy ship to destroy any one system on the SSD. If successful the
> system is destroyed and may not be repaired during the battle."*
>
> *"Only Transporter Beams may send Marines on Commando Raids and ONLY Marines may be used for such
> actions. Regular crewmen (DCPs) do not have the equipment or training for such operations."*
>
> *"Any ONE hit from each Transporter Beam sends over ONE Marine Boarding Party and grants the player
> a 1D6 roll on the chart below"*

**One raid per mount, however many hits that mount scored** — that is the load-bearing word "ONE"
in "Any ONE hit from each Transporter Beam". A mount that scores no hits sends nobody.

| 1D6 | Result |
| --- | --- |
| 1 | *"Nothing happens. The Transporter technician is unable to lock onto the target system."* The marine party is not spent. |
| 2–3 | *"The Marines transport onto the ship but are unable to reach the target system and are killed."* |
| 4 | *"The Marines transport onto the ship but are unable to reach the target system. On a 4+ they return to the ship otherwise they are killed."* (a second D6) |
| 5 | *"The Marines transport aboard and destroy the target system but are killed in the process."* |
| 6 | *"The Marines transport aboard and destroy the target system and return safely to the ship."* |

> *"Marines may not be sent to attack any Core or otherwise protected systems, such as Antimatter
> Suicide Bombs"*

On a 1 the party never leaves the ship, so it is not consumed — *"Nothing happens"*, twice over. On
a 4 the party is spent for the turn and survives only on a second roll of 4+. Systems destroyed by a
raid *"may not be repaired during the battle"*.

The rulebook points at *"the procedure in section 5.8.1"*, which does not exist — the procedure is
the chart printed immediately below it in 5.9. Noted so the dangling reference is not mistaken for a
missing rule.

Cost 3 per mass. TB-1 mass 1 / 6 arcs; TB-2 mass 2 / 3 arcs, +1 mass for 3 more; TB-3 mass 4 / 1 arc,
+1 per extra arc; TB-4 mass 8 / 1 arc, +2 per extra arc.

---

## 5.10 Gatling Battery (P)

> *"A Gatling Battery used in anti-ship fire generates 6 beam dice (BD\*) out to a range of 12 MU.
> These dice must all be directed at the same target."*

**6 dice, one band, 12 MU, nothing beyond.** There is no class: the rating on the mount is ignored.
1 damage per hit, mode **(P)**, screens per 4.7.

> *"The Gatling Battery may also be used as a PDS, at which point it fully follows the rules for PDS.
> The one exception is that the Gatling Battery may have limited fire arcs, and if the ordnance or
> fighter is attacking from outside its arc, the Gatling Battery cannot fire in PDS mode."*

PD mode is a full **PDS** die (`PdMode` `'pds'`), limited to the mount's arcs.

> *"Gatling Batteries with arcs to the rear of the ship may fire in PDS mode into the aft arc, but
> they may not fire in anti-ship mode into the aft arc."*

That is the general aft-arc ban of 4.2, which `combat.planFireControl` already enforces (and already
exempts PD from). Note that 5.10 states it flatly, with no nod to the 4.2 optional "no thrust this
turn" exception.

Cost 4 per mass. Mass 2 / 1 arc, mass 3 / 3 arcs, mass 4 / 6 arcs. *"Broadside Gatling Batteries may
be purchased for 5 mass for two batteries. Each Gatling Battery will have only two arcs firing either
port or starboard."*

---

## 5.11 Twin Particle Array (P)

> *"The TPA generates 2 beam dice (BD\*) to a range of 24 MU."*

**2 dice at any range out to 24 MU** — one 24 MU band, not two 12 MU bands, so it does not lose a die
at 12 MU. 1 damage per hit, mode **(P)**, screens per 4.7.

> *"The TPA can also be used in PDS mode very effectively. In this mode it acts just as a PDS, with
> the exception that if the TPA has limited arcs, then the point defense coverage is also limited to
> those arcs."*

Cost 4 per mass. Mass 2 / 1 arc, mass 3 / 3 arcs, mass 4 / 6 arcs; broadside pair 5 mass for two,
2 arcs each.

---

## 5.12 Meson Projector (P)

> *"The Meson Projector generates 1 BD\* out to a range of 48 MU. Like the Gatling Battery, the Meson
> Projector can also be used as a PDS, limited only by the arc of the projector."*

**1 die at any range out to 48 MU.** 1 damage per hit, mode **(P)**, screens per 4.7, PDS mode.

Cost 4 per mass. Mass 2 / 1 arc, mass 3 / 3 arcs, mass 4 / 6 arcs.

---

## 5.13 Needle Beams

> *"Needle Beams have range bands of 12 MU, like all other beam weapons. Larger Needle Beam mounts
> generate extra Needle Beam dice at close range."*

Class dice, 12 MU bands, max range `class × 12` — an NB-2 rolls 2 dice to 12 MU and 1 to 24 MU.

> *"On a roll of 4+ they inflict a single point of damage. On a roll of a natural 6 they inflict a
> single point of damage, and destroy the targeted system."*

| Die | Effect |
| --- | --- |
| 1–3 | nothing |
| 4–5 | 1 point of damage |
| natural 6 | 1 point of damage **and** the targeted system is destroyed |

Note the asymmetry, which is deliberate in the text: the point of damage is scored on the **modified**
face (a DRM can take a 4 down to a 3), but system destruction needs a **natural** 6 — the same rule
4.6 applies to re-rolls, and 5.13's own "rolls of a 6 do not damage the targeted system" clause for
badly-informed shooters is written about the natural face.

> *"The focus and intensity of Needle Beams means that they are not affected by screens."*

No screen level of any kind applies — read as categorical, since 5.13 grounds it in the weapon's
focus rather than in screen technology, so Advanced Screens (7.3) do not blunt it either. Armour is
*not* mentioned and so still absorbs the point of damage: damage mode **standard**.

**Targeting information (the sensor ladder).**

> *"With basic sensors you know what types of weapons the opponent has, but not the particulars of
> the mounts (size, arc). So for example, with that limited information you could target 'a beam
> mount', and if a hit was scored, a random beam mount would be destroyed."*
>
> *"Without at least the information of basic sensors, the Needle Beam is relatively ineffective.
> While it can still do a point of damage to the target, rolls of a 6 do not damage the targeted
> system."*
>
> *"For a ship to use Needle Beams effectively beyond 12 MU it must have Enhanced Sensors. If the
> weapon is fired at a target more than 24 MU it must mount either Superior Sensors or two Enhanced
> Sensors."*

| Range | Needed to destroy systems |
| --- | --- |
| ≤ 12 MU | basic sensor information on the target |
| > 12 and ≤ 24 MU | Enhanced Sensors |
| > 24 MU | Superior Sensors, or two Enhanced Sensors |

**Reading taken:** failing the sensor requirement does not stop the shot, it removes the system kill —
the same degradation 5.13 spells out for a shooter without basic information ("it can still do a
point of damage … rolls of a 6 do not damage the targeted system"). "Effectively" is the word the
rulebook uses for both cases.

> *"Like the restrictions for FireCon these sensors may only focus the Needle Beam weapons on one
> enemy ship's system per turn."*
>
> *"A FireCon must be designated for every Needle Beam target, though multiple Needle Beams firing at
> the same target may share a FireCon. Other weapons can share the FireCon to target the same ship
> normally."*

**Also blocked from destroying systems:**

* Holofields (7.17): *"Needle Beams and similar weapons, are ineffective against a ship protected by
  Holofields"* — but 7.17 also says *"Any ships firing at 6 MU or less will ignore Holofields"*, so
  the block lifts inside 6 MU.
* Cloaks (7.20): *"Needle Beams may not target any specific systems while the ship is under cloak."*

**Legal targets:** *"any system that appears on the SSD (the only exceptions being Stealth Hulls,
Biotech generators and Core Systems)"*. Turrets are explicitly needlable (5.22: *"If the turret is
damaged due to a threshold test or a Needle Beam hit, it remains stuck in its current facing"*).

> *"Systems destroyed by Needle Beam fired cannot be repaired by Damage Control Parties."*

**One system per mount.** A mount nominates one system; a second natural 6 from the same mount still
scores its point of damage but has nothing left to destroy. (The rulebook never lets a single mount
nominate more than one system — 5.2 charges a FireCon per *"single ship system"* — so this is the
table-legible reading.)

No point defence: a needle beam shoots at systems, not at ordnance.

Cost 3 per mass, **maximum 3 arcs** on any mount. NB-1 mass 2 / 2 arcs, +1 mass per extra arc; NB-2
mass 4 / 1 arc, +2 per extra arc; NB-3 mass 8 / 1 arc, +4 per extra arc; NB-4 mass 16 / 1 arc, +8 per
extra arc.

---

## Where this module deviates, and why

1. **SAP is halved per mount, not per hit, by `combat.applyDamage`.** 4.9 says *"If a SAP hit
   inflicts multiple points of damage, then half is applied to the armor"* — per hit. `WeaponResult`
   carries one aggregate `normalDamage` per mount, so a Graser-2 scoring two hits of 3 has its 6
   points halved once (3 on armour) instead of twice (2 + 2 = 4 on armour). `fireSapHits()` is
   exported alongside `fire()` for callers that want the per-hit split: it returns one `WeaponResult`
   per hit, which `combat.applyVolley` then soaks one at a time, giving the rule-exact answer.
2. **Per-rating point defence.** `WeaponSpec.pointDefence` is one `PdMode` for a whole weapon class,
   but only Beam-1s and EMP-1s may point-defend. `canPointDefend(weapon)` applies the rating test.
3. **The EMP-1's −1 DRM** is not expressible through `dice.pointDefenceKills`, which takes no DRM, so
   `empPointDefence()` implements the beam-1 PD die with the modifier applied.
4. **High Intensity Grasers** have no home in `WeaponVariant`, so `BeamWeaponDef` adds an optional
   `highIntensity` flag.
5. **Turret-mounted weapons skip the arc check** in `fire()`: 5.22 makes the turret's recorded facing
   the arc that matters, and only fire control knows it.
