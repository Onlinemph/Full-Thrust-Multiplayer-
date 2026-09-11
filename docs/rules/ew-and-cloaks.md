# Electronic warfare, cloaks and the two superweapons (sections 7.17 – 7.25)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 7 "Command School — Defensive
systems, Advanced rules" (`continuum-rulebook-extract.txt` lines 1703–1908), plus the rules those
sections point at and depend on:

| Also quoted | Lines | Why it is here |
| --- | --- | --- |
| 4.5 – 4.7 the beam damage table | 645–656 | what the Holofield's "one hit on a 5 or 6" replaces |
| 5.13 Needle Beams | 1019–1029 | 7.17 and 7.20 both switch needle beams off |
| 5.23 Spinal Mounts | 1176–1190 | *"there is no -1 for Holofields, which are ignored by area of effect weapons"* — the one place the book prints the Holofield modifier as a number |
| 6.3 Launching missiles | 1299–1311 | the 6 MU missile attack radius that ECM and Holofields cut |
| 6.7 Rocket Pods | 1455–1459 | 7.18: *"ECM has no effect on rockets"* |
| 7.3 Advanced Screens | 1527–1545 | the only screen a Wave Gun feels, and *"Negative damage is treated as zero"* |
| 8.9 Fighter attacks | 2021 | the 6 MU fighter attack radius ECM and Holofields cut |
| 7.4 / 7.5 Stealth | 1547–1573 | 7.20: *"The ship does not gain any bonuses for stealth while the cloak is active"* |

Implemented in `src/engine/ew.ts`. Tested in `src/engine/ew.test.ts`.

What lives elsewhere and is *used*, not re-implemented:

| Thing | Where |
| --- | --- |
| The beam damage table and the d6 | `dice.ts` `beamDamage`, `rollBeamVolley`, `rollD6` |
| Screens, stealth, armour, point defence (7.2 – 7.16) | `defences.ts` |
| Arcs, courses, distance | `geometry.ts` |
| Applying damage to armour and hull | `combat.ts` |
| Threshold checks, including the Cloaking Field's two boxes | `threshold.ts` |
| Needle-beam resolution (the *shot*; 7.17/7.20 only say whether it may pick a system) | `weapons/beams.ts` |

---

## 7.17 Holofield

> *"Shooting at a ship with direct fire weapons that use beam dice will only score one hit on a 5
> or 6 with a re-roll for the 6 if applicable. The Holofield will affect all re-rolls as well.
> Weapons that do not use beam dice add 12mu to the range. If this modifies the range beyond the
> weapons maximum range the shot automatically misses. Needle Beams and similar weapons, are
> ineffective against a ship protected by Holofields."*

> *"Graviton Beams and any area effect type weapons (i.e. Spinal Mounts, PBLs etc.) ignore
> Holofields."*

> *"The closer the firing ship is the less effective the Holofield will be. Any ships firing at 6 MU
> or less will ignore Holofields."*

> *"Holofields also confuse the miniature FireCon systems used by missiles, fighters and ordnance.
> Their attack range is reduced by 1 MU. Holofields cannot be combined with other screen or field
> technology. Holofields can be combined with up to 3 levels ECM; this would reduce fighter/missile
> lock-on range to 2 MU."*

### The beam-dice effect is exactly −1 DRM

7.17 states the effect as a replacement table, not as a modifier. It is the same thing, and the
engine implements it as **−1 DRM**, which is what `FiringContext.drm` carries.

A Holofield ship has no screens at all (*"cannot be combined with other screen or field
technology"*), so the table it replaces is always the unscreened column of 4.7:

| Natural die | 4.7 unscreened | 7.17 Holofield | Unscreened at −1 DRM |
| --- | --- | --- | --- |
| 1–3 | 0 | 0 | 0 |
| 4 | 1 | 0 (only 5 or 6 score) | modified 3 → 0 |
| 5 | 1 | 1 | modified 4 → 1 |
| 6 | 2 + re-roll | 1 + re-roll | modified 5 → 1, re-roll on the natural 6 (4.6) |

The two right-hand columns agree on every face, and because `dice.rollBeamVolley` applies the DRM
to re-roll dice as well and tests the re-roll on the **natural** face (4.6), so does *"The Holofield
will affect all re-rolls as well"*: a re-rolled 6 scores 1 instead of 2 and rolls again.

5.23 confirms the arithmetic from the other side, when it excuses Plasma Spinal Mounts:
*"Note that there is no -1 for Holofields, which are ignored by area of effect weapons."*

### Everything the Holofield does

| Against | Effect | Note |
| --- | --- | --- |
| Direct fire that rolls beam dice | −1 DRM, re-rolls included | the table above |
| Direct fire that does not roll beam dice (projectile to-hit tables, 5.14/5.16/5.18/5.19) | +12 MU to the range | past the mount's maximum range the shot **automatically misses** |
| Needle Beams "and similar weapons" | ineffective — may not pick a system | the shot itself is resolved by 5.13 |
| Graviton Beams | no effect | *"ignore Holofields"* |
| Area-effect weapons — Spinal Mounts, PBLs, and by the same token the Nova Cannon and Wave Gun | no effect | 5.23, 7.17 |
| Any weapon fired from **6 MU or less** | no effect at all | *"Any ships firing at 6 MU or less will ignore Holofields"* |
| Missile, fighter and gunboat lock-on | −1 MU | 6 MU attack radius becomes 5 MU |

Mass 10% of ship mass; 5 points per mass.

---

## 7.18 ECM

> *"For every level of ECM your ship has subtracts 6 MU from the 'de-blip' range of enemy sensors.
> This will also decrease the effective information range of the more advanced sensors by a similar
> amount."*

> *"Every level of ECM reduces the lock-on range by 1 MU, meaning missiles and fighters need to be
> closer to attack."*

> *"The aggregate ECM level of a ship (its own plus any Area ECM) cannot exceed 3. ECM can be
> combined with Holofields to produce a net -4 MU range reduction for missiles, fighters and
> gunboats. ECM has no effect on rockets."*

| Effect | Number |
| --- | --- |
| Enemy sensor de-blip / information range | −6 MU **per level** |
| Missile, fighter and gunboat lock-on range | −1 MU **per level** |
| Direct-fire to-hit DRM | **none** — 7.18 gives ECM no to-hit modifier |
| Rockets (6.7) | no effect |
| Aggregate cap (own + Area ECM) | 3 |

Mass 1 per level, 3 points per mass. Each level is its own SSD box, so it is lost progressively and
can be targeted by EMP attacks (5.4).

**ECM carries no to-hit DRM in this edition.** This is worth saying out loud because earlier
editions of *Full Thrust* gave ECM a −1 against direct fire and players remember it. 7.18 lists two
effects and neither is a to-hit modifier; 7.17 is the section that carries the −1, and it belongs to
the Holofield. The one place the book suggests otherwise is 5.13, *"If a ship is facing a foe
protected by Stealth or ECM the Needle Beams will be affected as normal so they will only be useful
at very close range"* — read here as pointing at Stealth's range-band shrinkage (7.4) and at the
needle beam's own sensor-range requirements, since 7.18 states no modifier for ECM to apply.

---

## 7.19 Area ECM

> *"Area ECM functions like conventional ECM, however it covers the ship mounting the system and all
> allied ships within 6 MU. The aggregate ECM level of a ship (its own plus any Area ECM) cannot
> exceed 3."*

> *"When Area ECM is turned on, the carrying ship cannot use its own FireCon systems. The
> shorter-range FireCon systems in PDS, ADS, Scatterpacks, Grapeshot, and ADFC still function
> normally."*

| | |
| --- | --- |
| Bubble | 6 MU, the carrier and **allied** ships inside it |
| Aggregate cap with own ECM | 3 |
| Side effect | the carrier's own FireCons are unusable while it is on |
| Still usable while it is on | PDS, ADS, Scattergun/Scatterpack, Grapeshot, ADFC (and Advanced ADFC) |
| Mass / cost | 2 mass per level, 3 points per mass |
| SSD | one box per level; EMP-targetable |

A ship under a cloak cannot run Area ECM at all: 7.20, *"Area ECM will not function as well."*

---

## Stacking: what combines with what

This is the question the section is really about, and the book answers it three times.

| Pair | Combine? | Rule |
| --- | --- | --- |
| ECM + Area ECM | Yes, additively, **capped at aggregate 3** | 7.18, 7.19 |
| ECM + Holofield | **Yes** — and the effects are added, not "best wins": *"a net -4 MU range reduction"* = 1 (Holofield) + 3 (ECM) | 7.17, 7.18 |
| Holofield + screens, advanced screens, stealth fields, area screens | **No** — *"Holofields cannot be combined with other screen or field technology"* | 7.17 |
| Cloak + any field or screen | **No** — *"The Cloaking Device may not be combined with any fields or screens"* | 7.20 |
| Cloak + stealth | Allowed to be fitted, but *"The ship does not gain any bonuses for stealth while the cloak is active"* | 7.20 |
| Cloak + Area ECM | Fitted, but *"Area ECM will not function"* while cloaked | 7.20 |

So the only DRM stack that can legally arise is a single source: **−1 from a Holofield, or −2 from a
Cloaking Device, never both**. ECM contributes 0. The worked number the book gives for the one
legal combination is the lock-on range:

> *"Holofields can be combined with up to 3 levels ECM; this would reduce fighter/missile lock-on
> range to 2 MU."*

6 MU base (6.3, 8.9) − 1 (Holofield) − 3 (ECM levels) = **2 MU**. This is the only arithmetic
example in 7.17 – 7.25 and it is a test.

---

## 7.20 – 7.22 The three cloaks

### 7.20 Cloaking Device — the partial cloak

> *"When orders are written, the player must note if the ship will cloak or not. When a ship wishes
> to 'cloak' the player must note this in orders for that turn, and the number of turns the ship is
> to remain cloaked, e.g. 3 turns."*

> *"Ships will cloak and uncloak at the end of the Ship Movement Phase. Note: The player does not
> remove the ship model from the table and moves it in the Ship Movement Phase as normal."*

While it is up, the cloaked ship:

- may not launch or land fighters;
- may not fire its weapons;
- may not enter hyperspace;
- may not receive communications;
- may not raise its screens;
- gets no Area ECM (*"Area ECM will not function as well"*);
- gets no stealth bonus;
- is **destroyed** if it strikes a planet or other large solid object;
- **may not exceed velocity 24** *"without voiding the Cloaking Device"*.

What an enemy suffers:

| | |
| --- | --- |
| Missiles and fighters | *"will not lock at all"* |
| All direct fire weapons | range counts as **twice the actual range**, **and −2 DRM**, *"including re-rolls for penetrating weapons"* |
| Needle Beams | *"may not target any specific systems while the ship is under cloak"* |

> *"If the cloak is hit due to a threshold check the ship uncloaks at the end of the turn."*

Mass 1. Points = **50% of the ship's mass** — *"For example a 100 mass ship would pay 50 points for
a Cloaking Device."*

### 7.21 Cloaking Field — the total cloak

> *"Cloaking Fields are systems that render ships totally invisible and undetectable on all forms of
> sensors and visual scanning … though the cloaked ship cannot be seen, it also cannot see out."*

> *"At the start of its movement for that turn, the ship model is removed from the table and a marker
> of some kind is placed to mark its location on entering cloaked mode. This marker then remains
> stationary until the ship de-cloaks, when it can be removed."*

> *"For each turn the ship is in cloaked mode, the player writes movement orders for it exactly as
> normal … After the required numbers of turns in cloak have elapsed, the player returns to the
> cloaking marker and proceeds to plot out all the moves written for the ship while cloaked, finally
> placing the ship wherever it actually ends up."*

The number of turns must be declared in advance, *"to prevent ships choosing to de-cloak just
because a juicy target has wandered into range"*.

> *"A Cloaking Field has two 'damage points' or boxes. If both boxes remain unchecked the system
> operates as above. If one of its damage boxes has been checked off for any reason the cloak
> operates as a standard cloak. When making threshold checks roll for BOTH damage boxes."*

Mass 1. Points = **the mass of the ship** (100%).

### 7.22 The Tuffley Cloak

> *"The Tuffley Cloak (named after its creator Jon Tuffley) works exactly as the Cloaking Field but
> does not have a 'damaged level'. If the Tuffley Cloak is damaged it ceases to function."*

Mass 10% of ship mass; 10 points per mass.

### The three side by side

| | Cloaking Device (7.20) | Cloaking Field (7.21) | Tuffley Cloak (7.22) |
| --- | --- | --- | --- |
| Mode | partial | total | total |
| Damage boxes | 1 | 2 | 1 |
| One box lost | gone | degrades to partial (7.20) | gone |
| Model on the table | yes, moves normally | **removed**, stationary marker at entry point | removed |
| Goes up | end of Ship Movement Phase | **start** of its movement | start of its movement |
| Comes down | end of Ship Movement Phase | end of Ship Movement Phase, moves then plotted | as the Field |
| Can be shot at | yes, at ×2 range and −2 DRM | no — it is not on the table | no |
| Velocity limit | 24 | none stated | none stated |
| Mass | 1 | 1 | 10% of ship mass |
| Points | 50% of ship mass | 100% of ship mass | 10 per mass |

### The state machine

States are `inactive` / `active`, plus the damage count; `cloakCapability` reads the damage count
and says what the system can still do (`total`, `partial`, `none`), and `cloakMode` is that
capability when active and `none` when not.

```
orders (phase 1)          orderCloak(state, turns)      records "cloak for N turns"
start of movement (5)     cloakStartOfMovement(...)     a *total* cloak goes up, marker placed
end of movement (5)       cloakEndOfMovement(...)       a *partial* cloak goes up;
                                                        an active cloak ticks one turn off;
                                                        at zero it comes down;
                                                        velocity > 24 voids a partial cloak
threshold (13)            applyCloakDamage(...)         a hit box; a killed cloak flags decloak
end of turn               cloakEndOfTurn(...)           the flagged decloak happens
```

Counting turns: the cloak lasts exactly `N` turns of elapsed game time from going up to coming
down. A device ordered "3 turns" in turn 1 goes up at the end of turn 1's movement and comes down at
the end of turn 4's movement, so it is cloaked for the fire phases of turns 1, 2 and 3. A Field
ordered "3 turns" in turn 1 goes up at the *start* of turn 1's movement and comes down at the end of
turn 3's movement — three plotted, unseen moves, which is what *"for each turn the ship is in
cloaked mode, the player writes movement orders"* asks for.

---

## 7.23 Spinal Mount Nova Cannon

> *"The Nova Cannon is a massive weapon that can only be mounted in the spinal core of a capital
> ship, and fires only directly forward – not just through the fore arc, but actually on the center
> line of the ship only."*

**Arming.** Written in orders on the turn it is to fire, and *"the ship may not expend any other
power at all for that turn: it may not apply any thrust to accelerate or maneuver, it may not fire
any other weapons, and even its screens do not function for that turn! If the Nova Cannon is then
not fired that turn, for any reason, then its 'arming' is lost and it must be re-armed the next
turn."*

**The template schedule.** The round is thrown 6 MU ahead of the bow — its *"minimum arming
distance"* — and detonates there.

| Turn | Template | Sweeps from | to | Distance moved | Damage |
| --- | --- | --- | --- | --- | --- |
| the firing turn | 2 MU diameter | 6 MU | 24 MU | 18 MU (*"its total 24 MU move"* counted from the bow) | **6D6** |
| next turn, start of the firing phase | 4 MU diameter | 24 MU | 48 MU | 24 MU | **4D6** |
| third turn | 6 MU diameter | 48 MU | 72 MU | 24 MU | **2D6** |

*"At the end of the third turn of movement the nova reaction exhausts its fuel and burns out – the
template is removed from play."* Between sweeps the template is *"left in place on the table"*, so
distances are measured from the **firing ship's position when it fired**, along the course its bow
pointed then — not from the ship, which is free to move on later turns.

*"Any and all ships or other objects that are contacted by the template during its flight"* are hit:
the test is whether the swept disc touches the target at any point of the sweep, i.e. whether the
target lies within the template's radius of the swept line segment. `novaContact` answers that and
returns the target's distance along the line of flight, which is what a `FiringContext.range` must
carry for the Nova Cannon's `WeaponSpec` — **not** the target's range from the firing ship, which
after the first turn is a different number entirely.

> *"Damage from a Nova Cannon is Penetrating damage; neither type of screen nor armor has any
> effect."*

20 mass, 60 points.

---

## 7.24 Wave Gun

> *"As with the Nova Cannon, the Wave Gun may fire only along the main axis of the carrying ship …
> The ship may not fire any other weaponry in the turn that it fires the Wave Gun, and also counts as
> being unscreened through its entire frontal arc while the weapon is being fired."*

> *"Note that a ship fitted with a Wave Gun may apply thrust or change course in the same turn that it
> fires the weapon, unlike the Nova Cannon."*

**Charging.**

> *"Each turn that the player orders the weapon to charge, roll one D6 and write the result down;
> when the accumulated rolls reach six or more the weapon is fully charged and may then be fired on
> any turn. Firing the Wave Gun totally discharges the capacitors, which must then recharge from
> zero again."*

> *"If the Wave Gun is knocked out by a threshold roll or a Needle Beam hit while it is charging or
> charged, the carrying ship suffers damage equal to the current charge in the weapon's
> capacitors."*

**The burst**, which lives one turn only. Full range 36 MU:

| Range band | Template | Damage |
| --- | --- | --- |
| 0 – 12 MU | 2 MU diameter | **4D6** |
| 12 – 24 MU | 3 MU diameter | **3D6** |
| 24 – 36 MU | 4 MU diameter | **2D6** |

> *"Advanced Screens affect Wave Gun damage rolls (-1 DRM per level), but will ignore Standard
> Screens and armor."*

so each damage die is reduced by the target's Advanced Screen level, and 7.3's *"Negative damage is
treated as zero"* floors each die at 0.

12 mass, 36 points.

---

## 7.25 Reflex Field

> *"'Energy weapon' includes beams, Grasers, fighters, and any other weapon affected by Standard
> Screens."*

**Activation.** Written in orders; *"The opposing player is not told of the field's status until the
ship is fired upon, by which time it may be too late."* While it is on, the carrying ship *"may not
use any weaponry of its own that turn, thought it may move and maneuver normally. Other specialized
actions, e.g. launching or recovering fighters, are also prohibited."*

**The roll.** Damage is rolled normally first; then the target's owner rolls 1 D6:

| D6 | Effect | To target | To firing ship |
| --- | --- | --- | --- |
| 1 | *"the field has no effect: full damage is applied to the target ship as normal"* | full | — |
| 2 | *"the target receives only half the normal damage, rounded up"* | ⌈d/2⌉ | — |
| 3–4 | *"the field absorbs all the damage and none is applied to the target"* | 0 | — |
| 5 | *"no damage is applied to the target, but half (Rounded up) is reflected back to the firing ship"* | 0 | ⌈d/2⌉ |
| 6 | *"the field reflects the full damage back to the firing ship"* | 0 | full |

**Against a fighter group**: *"roll a single D6 for the entire group after rolling fighter attack
damage. Rolls of 1-4 have the effect described above. On a roll of 5 or 6, each fighter that inflicts
any damage is destroyed by the reflected energy."*

10% of ship mass, 6 points per mass.

**Which weapons it answers.** 7.2 defines the same set from the other end — *"Screens only protect
against fire from beams and similar weapons such as Grasers and fighters. Other weapons such as
Pulse Torpedoes and missiles are able to penetrate screens with no degradation of their damage
effects"* — so the reflex field's list is read off each weapon's own section:

| Energy (reflex field applies) | Not energy (it does not) |
| --- | --- |
| Beams (5.3), Plasma Cannon (5.5), Grasers (5.6), Heavy Grasers (5.7), Phasers (5.8), Transporter beams (5.9), Gatlings (5.10), Twin Particle Arrays (5.11), Meson Projectors (5.12), Needle Beams (5.13), Gravitic Guns (5.20, *"As a beam-type weapon, the effects of a Gravitic Gun can be reduced by screens"*), Pulsers (5.21), Beam and Plasma Spinal Mounts (5.23), mines (6.9, *"apply damage as for normal beam fire, reducing accordingly if the target is screened"*), fighters (8) | EMP projectors (5.4, ignore standard screens), Pulse Torpedoes (5.14), Submunition Packs (5.15), K-Guns (5.16), MKPs (5.17), Boarding Torpedoes (5.18), Fusion Arrays (5.19), Point Singularity Projectors (5.23), missiles (6.2/6.5, *"Standard Screens have no effect on missiles"*), rockets (6.7), Plasma Bolts (6.8), and the two systems here — Nova Cannon (7.23) and Wave Gun (7.24) |

Two edge cases in that table are readings rather than readings-off:

- **Mines (6.9)** are scored *"as for normal beam fire, reducing accordingly if the target is
  screened"*, so 7.25's *"any other weapon affected by Standard Screens"* catches them — but a mine
  has no firing ship for a 5 or a 6 to reflect damage back at. The engine returns the reflected
  total as usual and a caller with no attacker simply has nowhere to put it; the target still takes
  nothing, which is the half of the result that matters.
- **Antimatter Missiles (6.x)** have screens subtract 1 per level from each damage die, which would
  read as *"affected by Standard Screens"* if the phrase were taken literally. They are still
  ordnance, and 7.2 is explicit that *"missiles are able to penetrate screens"* as a family; the
  antimatter blast is a special case written into its own paragraph, not membership of the energy
  weapons. `isEnergyWeapon('antimatter-missile')` is therefore false.

---

## Mass and cost, as printed

| System | Mass | Points |
| --- | --- | --- |
| Holofield (7.17) | 10% of ship mass | 5 per mass |
| ECM (7.18) | 1 per level | 3 per mass |
| Area ECM (7.19) | 2 per level | 3 per mass |
| Cloaking Device (7.20) | 1 | 50% of ship mass |
| Cloaking Field (7.21) | 1 | 100% of ship mass |
| Tuffley Cloak (7.22) | 10% of ship mass | 10 per mass |
| Nova Cannon (7.23) | 20 | 60 |
| Wave Gun (7.24) | 12 | 36 |
| Reflex Field (7.25) | 10% of ship mass | 6 per mass |

---

## Bannable systems

7.22 onward is explicitly optional and the book says so itself, twice:

> *"The intention behind these optional (extremely optional) rules is to simulate some of the weird
> and wonderful weapons seen in television and film that operate with a blatant disregard for the
> laws of physics and common sense … We strongly recommend that these systems are used with
> discretion, and then only with the express agreement of all players. They are not recommended for
> games where there is any kind of competitive element in play or in fleet design."*

> *"Note: This version of the Cloaking Device is included here for those players wishing to use the
> original rules. It is possible for a player group to use both versions but should do so with
> caution."* (7.22)

**The campaign these rules are played under bans the Reflex Shield, the Cloaking Field and the Wave
Gun outright** (`src/campaign/turn.ts` `CAMPAIGN_BANNED_SYSTEMS`). Each ban is individually
toggleable: `ew.ts` exports `BANNABLE_SYSTEMS`, one entry per optional system with its rule
reference and whether the campaign bans it by default, and `DEFAULT_CAMPAIGN_BANS` — the three ids
`reflex-field`, `cloaking-field`, `wave-gun`, which are the same strings the campaign layer uses.
Nothing in the engine bans anything on its own; a scenario or campaign passes the set it wants and
`isSystemBanned` answers.

---

## Readings taken where the text is ambiguous

1. **The Holofield is −1 DRM.** 7.17 prints a replacement table; 5.23 prints *"there is no -1 for
   Holofields"*. Since a Holofield ship can have no screens, the replacement table and −1 on the
   unscreened column agree face for face (table above), and −1 is what a `FiringContext.drm` can
   carry. A player at the table says "−1 for the holofield", which is why 5.23 phrases it that way.
2. **The 6 MU exemption lifts the whole Holofield clause**, not just the DRM: inside 6 MU a needle
   beam may pick systems again and a projectile weapon gets no +12 MU. *"Any ships firing at 6 MU or
   less will ignore Holofields"* — ignore, singular and total.
3. **ECM carries no to-hit DRM** (see 7.18 above). 5.13's aside about ECM affecting needle beams
   *"as normal"* is read as pointing at Stealth's range shrinkage and the needle beam's sensor
   requirements, because 7.18 states no modifier for it to mean.
4. **Rockets have no lock-on range to reduce.** 7.18 exempts them from ECM outright; 6.7 has rockets
   fly straight in and roll on a to-hit table rather than locking on, so the Holofield's −1 MU has
   nothing to bite on either. `lockOnRange('rocket', …)` returns the base range unchanged.
5. **Cloak turn counting** is elapsed turns from going up to coming down (worked through above).
   The book fixes both ends of the interval — the Device at *"the end of the Ship Movement Phase"*,
   the Field at *"the start of its movement"* — and says only *"the number of turns the ship is to
   remain cloaked"* about the middle.
6. **The velocity-24 limit belongs to the partial cloak.** 7.20 states it of the Cloaking Device;
   7.21 and 7.22 never mention speed, and a totally cloaked ship is not on the table to be measured.
   A Cloaking Field degraded to one box *"operates as a standard cloak"* and so picks the limit up.
7. **A killed cloak uncloaks at the end of the turn** — 7.20's timing — for all three systems, since
   7.21 and 7.22 give no timing of their own and *"the ship uncloaks at the end of the turn"* is the
   only one printed.
8. **The Nova Cannon needs no FireCon.** 5.23 requires one for a Spinal Mount aimed at a point in
   space; the Nova Cannon is not aimed at anything — *"the weapon fires in whatever direction the
   ship's bow is pointing"* — and there is no to-hit roll to direct. Same for the Wave Gun.
9. **A template hits a target if the swept disc touches it**, i.e. if the target point is within the
   template's radius of the swept segment. Ships are points everywhere else in this engine
   (`weapons/kinetics.ts` does the same for spinal-mount beam width), so a template contact test is
   a point-to-segment distance.
10. **The Wave Gun's damage bracket is set by the target's distance along the line of fire**, and the
    template radius used for the contact test is that bracket's. The template only ever expands, so
    this is what a player measuring with a tape does.
11. **The Reflex Field is rolled once per attacking unit's damage**, after that unit's damage is
    rolled — *"roll for hits and damage in the normal way … and rolls 1 D6"* — which is also what the
    fighter clause implies by insisting on *"a single D6 for the entire group"*. `rollReflexField`
    takes a damage total and rolls once, so a caller can choose a coarser or finer granularity if a
    group agrees a different reading.
12. **On a fighter-group 5 or 6, no damage reaches the target either.** 7.25 says *"Rolls of 1-4 have
    the effect described above"* and then gives 5–6 their own sentence about destroying fighters. The
    reading taken is that 5 and 6 keep the reflection they have in the main table — the target takes
    nothing — and the reflected energy lands on the fighters instead of on a firing ship, because
    there is no firing ship to send it back to.
13. **A cloak killed by a threshold check goes on hiding the ship until the end of the turn.**
    7.20 fixes the timing and nothing else does, so `CloakState` carries the mode it is *running*
    in as well as what its surviving boxes could still do: a destroyed cloak keeps running until
    `cloakEndOfTurn`. A Cloaking Field that loses only its first box degrades at once instead —
    7.21's *"If one of its damage boxes has been checked off **for any reason** the cloak operates
    as a standard cloak"*, where the end-of-turn timing is reserved for a cloak that has failed
    outright.
14. **Nova Cannon and Wave Gun damage is reported as `penetratingDamage`** in a `WeaponResult`. The
    shared contract has no "ignores armour entirely" mode: `AP` puts one point on each armour layer
    and `standard` lets armour soak. The penetrating pile is the only pile `combat.ts` sends past the
    outer armour layer, so it is the closest fit to *"neither type of screen nor armor has any
    effect"*. Against a ship with shell armour (7.7) `combat.ts` will still soak the pile into an
    inner shell — noted as a known divergence rather than worked around, because the fix belongs in
    the damage contract.

---

## Not implemented, and why

- **Sensor de-blip ranges** (7.18's first effect) are expressed as a function of a base range the
  caller supplies, `ecmSensorRange(base, level)`. The base numbers live in section 12, which is not
  in the rulebook extract (`SOURCES.md`); the engine has 5.2's FireCon 54 MU and Advanced FireCon 72
  MU and nothing else, so inventing a de-blip table here would be invention.
- **Plotting a totally cloaked ship's unseen moves** (7.21) is a movement-and-orders job:
  `ew.ts` records that the ship is off the table and where its marker stands, and
  `movement.ts` owns the moves themselves.
- **"Strikes a planet or other large solid object"** (7.20) is reported as a restriction
  (`destroyedByCollision`); terrain and collisions are section 17, which the engine does not model
  (`SOURCES.md`).
- **Which specific system a Needle Beam or threshold check knocked out** is `threshold.ts`'s;
  `applyCloakDamage` and `waveGunKnockOutDamage` are the hooks it calls into.
