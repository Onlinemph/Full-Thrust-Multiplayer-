# Defences: passive and active (sections 7.2 – 7.16)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 7 "Command School —
Defensive systems, Advanced rules" (`continuum-rulebook-extract.txt` lines 1513–1702), plus the
rules those sections point at and depend on:

| Also quoted | Lines | Why it is here |
| --- | --- | --- |
| 4.7 Defensive screens | 645–656 | the beam damage table screens act on |
| 4.8 Armor / 4.9 how weapons inflict damage | 657–692 | the armour ladder 7.6/7.7 extends |
| 2.6 phase 9, Point Defense fire | 279–315 | when point defence happens and the "divide before rolling" rule |
| 6.4 Point defense vs. missiles | 1315–1333 | the missile kill tables |
| 6.5 Damage, worked example | 1349–1367 | the PD-allocation worked example |
| 8.8 Point defense (allocating) | 2025–2047 | who may engage what, and the ADFC worked example |
| 6.x Anti-Matter Missiles | 1420–1443 | 7.9 says the suicide charge explodes "like a full strength Antimatter Missile" |
| 5.5 Plasma Cannon | 5.5 | 7.16's plasma DRM only makes sense against 5.5's `1d6-2 minus 1 per screen level` |

Implemented in `src/engine/defences.ts`. Tested in `src/engine/defences.test.ts`.

What lives elsewhere and is *used*, not re-implemented:

| Thing | Where |
| --- | --- |
| The beam damage table (4.5–4.7) | `dice.ts` `beamDamage`, `rollBeamVolley` |
| The PD/beam/fighter kill tables (6.4, 8.8) | `dice.ts` `pointDefenceKills` |
| Range bands, arcs, distance | `geometry.ts` |
| Applying hull damage and threshold rows | `combat.ts` / `threshold.ts` |

---

## 7.2 Defensive Screens

> *"The maximum active screen level for any ship is 2. Extra screen generators may be fitted but
> will only be useful as backups should one of the main screens be lost through damage."*

Each level is one screen generator symbol on the SSD (4.7). Generators take threshold checks like
any other system, so:

```
effective level = min(2, built level, generators still operational)
```

Backups are generators *beyond* the built level; they do nothing until a main generator is lost,
at which point the count of survivors is still ≥ the level and nothing drops.

**What screens stop.**

> *"Screens only protect against fire from beams and similar weapons such as Grasers and fighters.
> Other weapons such as Pulse Torpedoes and missiles are able to penetrate screens with no
> degradation of their damage effects."*

**The table (4.7), which `dice.beamDamage` owns:**

| Die | Unscreened | Level 1 | Level 2 |
| --- | --- | --- | --- |
| 1–3 | 0 | 0 | 0 |
| 4 | 1 | 0 | 0 |
| 5 | 1 | 1 | 1 |
| 6 | 2 | 2 | 1 |

Re-rolls (4.6) are scored as if unscreened: *"the re-roll is assumed to have already penetrated the
screen"*.

**Cost.** 5% of total ship mass per level, no minimum mass. 3 points per mass.

## 7.3 Advanced Screens

> *"Advanced Screens not only protect against beam weapons, but also against Pulse Torpedoes,
> missiles, and other weapons that normally ignore screens."*

Three behaviours, by how the attacking weapon rolls:

1. **Beams, grasers, fighters** — *"affected in the same way when attacking a ship with Advanced
   Screens"*. Same table as 7.2.
2. **Combined hit-and-damage dice (SMPs "and similar")** — treated as beams:
   > *"Against level-1 Advanced Screens a roll of 5 inflicts 1 damage point, and a roll of 6
   > inflicts 2. Against level-2 Advanced Screens a roll of 5 or 6 inflicts 1 damage point."*

   That is exactly the 4.7 table, so `beamDamage(face, advancedLevel)` covers it.
3. **Weapons that roll separate damage dice (pulse torpedoes, missiles)** —
   > *"subtract 1 from each damage die against level-1 Advanced Screens. Against level-2 Advanced
   > Screens, subtract 2 from each die. Negative damage is treated as zero; the target ship cannot
   > regain damage points!"*

   Per **die**, floored at 0 — not per volley.

**Exclusivity.** *"A ship cannot be fitted with both Advanced and Standard Screens."* Level is
capped at 2 *"even if it has additional generators"* — the same backup rule as 7.2.

**Cost.** 7.5% of total ship mass per level, no minimum. 4 points per mass.

## 7.4 Stealth Hull

Stealth shrinks the **range brackets** of everything shooting at the stealthy ship.

> *"Level 1 Stealth reduces the size of range brackets by one-sixth. Level 2 Stealth reduces the
> size of range brackets by one-third."*

So bracket size is multiplied by 5/6 at level 1 and 2/3 at level 2. The printed table:

| Original bracket | Stealth-1 | Stealth-2 |
| --- | --- | --- |
| 12 MU | 10 MU | 8 MU |
| 9 MU | 7.5 MU | 6 MU |
| 6 MU | 5 MU | 4 MU |
| 4 MU | 3.33 MU | 2.66 MU |

> *"Example: A class 3 beam normally has a range of 36 MU. Against a Stealth-1 target it would have
> a range of 30 MU; against a Stealth-2 target it would have a range of 24 MU. The reduction of
> effective range also applies to missile lock-on range."*

**Losing stealth to hull damage.**

> *"A Stealth-1 ship has a Stealth marker at the end of the second row of hull boxes. Once the
> second row of hull has been destroyed it negates the ship's stealth. A Stealth-2 ship has a marker
> at the end of the first and third rows of hull boxes. The loss of the first row reduces the ship
> to Stealth-1; the loss of the third row removes all stealth benefits. Note: these markers are
> placed on the hull rows as indicated here regardless of how many rows of hull the ship has."*

| Built | Rows lost 0 | 1 | 2 | 3+ |
| --- | --- | --- | --- | --- |
| Stealth-1 | 1 | 1 | 0 | 0 |
| Stealth-2 | 2 | 1 | 1 | 0 |

**Stealth-2's targeting price.**

> *"To gain the benefits of Stealth-2 the ship may only target units out to 24 MU."*
>
> *"A Stealth-2 ship can write orders to 'go active,' this brings the FireCon systems into
> full-power active-scan mode, allowing the ship to target its weapons out to the normal FireCon
> range of 54 MU. This does reduce much of the protective power of the Stealth systems, however,
> and the ship is only treated as being Stealth-1 as long as the FireCon is in active mode."*

Passive targeting limit 24 MU; active FireCon range 54 MU; going active drops the ship to
Stealth-1 for as long as it stays active.

**Cost.** No mass. Stealth-1 costs +2 per point of hull *and armour*; Stealth-2 costs +4 per point.
Stealth-2 is the maximum.

## 7.5 Stealth Fields

> *"the effects of Stealth Fields are identical to a Stealth Hull of the same level"*

The difference is that a field is a **system**: it has an SSD icon, takes threshold tests, and can
be picked off by needle beams — *"unlike Stealth Hulls which are only disabled by loss of complete
rows of hull boxes"*. It can be switched on and off by written order.

> *"Stealth Fields and Stealth Hulls can be combined, but the aggregate Stealth level cannot exceed
> 2."*

A level-2 field carries the same 24 MU passive-targeting limit as a Stealth-2 hull.

**Cost.** 5% of ship mass per level; 6 points per mass.

## 7.6 Armor

> *"Armor requires 1 mass per box of protection. The total number of armor boxes is called the
> grade."*
>
> *"The points cost of standard armor is twice the grade; 2 points per box."*

Armour boxes are crossed off before hull boxes (4.8) and **no threshold check** is made at the end
of the armour row — only hull rows trigger checks (4.8, 4.11).

## 7.7 Shell or Layered armor

Layers are stored inner-first (`ArmourDef.layers[0]` is the innermost), so the *last* entry is the
outermost shell — the one damage meets first.

| Weapon mode | What the armour does |
| --- | --- |
| **Standard** | All the volley's non-re-roll damage lands on armour, outermost intact layer first, cascading inward; the excess hits the hull (4.8). |
| **AP** | *"one point of damage to each shell, and then deposits the remainder of its damage into the hull"* — one box off **every** layer that still has boxes, remainder straight to hull (also 4.9). |
| **SAP** | *"half their damage to the outermost layer of Shell Armor (rounded up), and the remaining half of their damage to the next shell layer"* — 4.9 adds *"the remainder to the hull OR next layer of armor if present"*. |
| **Re-roll / penetrating (P)** | 4.6: *"any damage caused by the re-roll die(s) is applied directly to the ship's ordinary hull (or next layer of armor if it has multiple layers)"* — one layer **inward** of whichever layer the initial damage was landing on. |

*Reading (cascade):* the rulebook names only "the next layer" for SAP overflow and for penetrating
damage. Where that layer runs out of boxes mid-volley the text is silent; at the table the damage
carries on to the layer below and then the hull, because damage never simply evaporates. The
implementation cascades.

*Reading (which layer is "outermost"):* the outermost layer **with boxes remaining**. A shell that
is already stripped cannot soak, and cannot count as the reference point for the penetrating step.

**Worked example (4.9, AP).** *"a large kinetic gun hits a ship with two rows of layered armor. The
hit scores 10 damage points. 1 is applied to each layer of armor with the remaining 8 to the hull."*

**Worked example (4.9, SAP).** *"a missile strikes a ship for 7 points of damage. 4 points is
applied to the armor, remaining 3 points are applied to the next row of armor."*

**Worked example (4.9, penetrating).** A cruiser with one standard screen, two armour layers, hit by
a Class-3 beam at 12 MU rolling 4, 5, 6: the 4 is screened out, the 5 and the 6 put **3** on the
outer layer; the 6's re-roll is another 6 → **2** to the next layer in; that re-roll's re-roll is a
6 → **2** to the hull; its re-roll of 4 → **1** more to the hull.

**Cost.** One mass per point, as normal armour. Shell armour costs +2 points per mass per layer:

| Layer | Points per mass | Regenerative (7.8) |
| --- | --- | --- |
| Inner | 2 | 4 |
| First shell | 4 | 6 |
| Second shell | 6 | 8 |
| Third shell | 8 | 10 |
| Fourth shell | 10 | 12 |

## 7.8 Regenerative Armor

> *"During the End Phase roll a d6 for each point of Regenerative Armor that has been damaged. On a
> 5 or 6 the armor box is repaired. On a 1 the armor has sustained too much damage and it cannot
> regenerate further this battle."*

Per damaged box, once per turn:

| Roll | Result |
| --- | --- |
| 1 | that box is **burnt out** — permanently gone for the rest of the battle, never rolled again |
| 2–4 | nothing; it is rolled again next turn |
| 5–6 | the box comes back |

*Reading ("it cannot regenerate further"):* per-box, not per-ship. The sentence's subject is the
single box that just rolled — the whole paragraph is written one box at a time (*"roll a d6 for each
point ... that has been damaged"*). Treating a single 1 as switching off the entire ship's
regeneration would make grade-10 regenerative armour worse than grade-2, which no player would
accept at the table.

*Reading ("End Phase"):* the 2.6 sequence has no phase called End Phase; its last phase is 15,
reactor explosions. Regeneration is therefore resolved after phase 15, at the end of the turn — the
last thing before the next turn's orders. This matters only in that a box repaired now is available
to soak damage from the following turn, not from the turn just fought.

Regenerative and non-regenerative armour may be combined on one ship, and regenerative shell armour
exists (*"simply add +2 to the cost of the Shell Armor to make it Regenerative Shell"*).

**Cost.** 1 mass per point; +2 points per mass over standard armour (4 per mass for the inner
layer), see the table under 7.7.

## 7.9 Antimatter Suicide Charge

Mass 1, 5 points per mass.

**Blast.** *"3d6 explosion like a full strength Antimatter Missile"* with a 3 MU radius. The
antimatter missile's falloff (6.x) is 3d6 within 1 MU, 2d6 within 2 MU, 1d6 within 3 MU. Multiple
charges are additive in dice, not in radius:

> *"a ship with 3 charges would do 9d6 damage to 1 MU, 6d6 to 2 MU and 3d6 to 3 MU"*

| Range from the exploding ship | Dice, per charge |
| --- | --- |
| ≤ 1 MU | 3d6 |
| > 1 and ≤ 2 MU | 2d6 |
| > 2 and ≤ 3 MU | 1d6 |
| > 3 MU | none |

Screens reduce the blast on *other* ships the way they reduce an antimatter missile: −1 per die per
screen level (6.x, *"a ship with screen-2 caught in a 3d6 Antimatter Missile blast would only take
3d6−6 damage"*). They do **not** protect the carrier:

> *"The detonation of an Antimatter Suicide Charge causes damage directly to the hull of the carrying
> ship, it is not reduced by armor or screens (the explosion starts within)."*

**Deliberate detonation.** *"A ship may write 'detonate' orders during phase 1. At the beginning of
phase 13 just before threshold checks are rolled, the ship explodes."* If the ship was destroyed
before phase 12 it explodes at the end of the phase in which it was destroyed, at full strength.

**Accidental detonation.** The charge is marked damaged like any system; damage control (phase 14)
may repair it.

> *"If the Antimatter Suicide Charge is not repaired by the end of the turn roll a die. On a 5 or 6
> the Antimatter Suicide Charge explodes ... Roll every turn until the damage is repaired or an
> explosion occurs."*

*Reading:* only charges that are actually damaged and unrepaired roll, one die each, and a single
detonation sets off the ship's full complement (7.9 gives the multi-charge damage as one additive
blast, and *"there is plenty of matter around ... for the antimatter to annihilate"*). A large ship
may survive its own charge, which is why the self-damage is rolled rather than assumed lethal.

**Threshold.** −1 DRM on threshold tests, *"like Core Systems"*. Needle beams may target it normally.

## 7.10 ADFC — Area Defense Fire Control

> *"a high speed computer controlled tracking and data assimilation system designed to allow
> point-defense weapons (PDS, ADS and weapons that can fire as a PDS - Pulsers, Gatling Batteries,
> Twin Particle Arrays and Meson Projectors) to engage fighters and missiles making attacking runs
> against allied ships within 6 MU. A ship with ADFC may support ONE allied ship within 6 MU, with
> each PDS/ADS etc., only firing once per turn."*

8.8 adds the second, separate capability:

> *"Ships with ADFC may also target unengaged fighter groups within 6 MU. Each group targeted
> requires one ADFC."*

So **each ADFC buys one of**: cover for one allied ship within 6 MU, or a shot at one unengaged
fighter group within 6 MU. A ship with two ADFC may do one of each, or two of either.

**Lockout.** *"An ADFC may not be used if the ship launched or recovered any fighters (section 8)
during the turn."* All of the ship's ADFC are locked out, not just one.

**Never allowed through ADFC:** Beam-1s. 8.8: *"Beam-1s may not be used for area defense."*

**The dogfight bar.** 8.8: *"In either case, the fighter group targeted must not be engaged by other
fighters."* — 8.10: *"Ships may not fire into a dogfight."* This applies to a ship's own defence as
well as to area defence.

**Cost.** Mass 2, 4 points per mass (8 points). Optional rule, by agreement: no mass for hulls over
20 mass, still 8 points.

## 7.11 Advanced ADFC

> *"A ship with AADFC may support ANY number of allied ships within 6 MU, though each PDS/ADS etc.,
> may still only fire once a turn."*

One AADFC removes the one-ally limit entirely. The 6 MU radius, the once-per-turn rule, the
flight-operations lockout and the Beam-1 bar are unchanged.

*Reading:* 8.8's *"one other ship per ADFC carried"* and *"each group targeted requires one ADFC"*
are the standard-ADFC budget. An AADFC supersedes the ally budget (*"ANY number"*); it is read as
also lifting the one-group-per-ADFC limit on unengaged groups within 6 MU, since both clauses are
the same budget and 7.11 says the AADFC is "an advanced version" that differs only in how many
things it may cover.

**Cost.** Mass 2, 5 points per mass (10 points).

## 7.12 Point Defense Systems

> *"Point Defense fire does not require a FireCon."*
>
> *"Point Defense Systems can be fired through any arc, including the rear arc even if the ship has
> used the main drive in this turn."*

A PDS has no directionality on the SSD, so it has all-round coverage (4.2). Dual-purpose mounts
(Beam-1, K-1, Gatling, TPA, Meson Projector, Pulser) are limited to **their own** arcs in PD mode,
per their own descriptions in section 5 — the PD allocator honours whatever arcs it is handed.

**Against ordnance and fighters** (6.4, 8.8) — `dice.pointDefenceKills` rolls these:

| Firer | vs fighters | vs salvo missiles | vs heavy missiles |
| --- | --- | --- | --- |
| PDS | 4–5 kills one; 6 kills two + re-roll | 4–5 kills one; 6 kills two + re-roll | 5–6 kills it |
| Beam-1 / fighter | 5–6 kills one, re-roll on 6 | 5–6 kills one, re-roll on 6 | 6 kills it |

*"'Wasted' shots when point defense fire kills more fighters than are in the group may not be
reallocated to other groups"* (8.8), and the same for salvoes (6.4: *"they cannot be allocated to
other salvos or Heavy Missiles"*). 6.4 also guarantees *"If there are no defenses at all, at least
one missile in a salvo will always get through."*

**Against ships.**

> *"Point Defense Systems can be fired against ships with a maximum range of 6 MU, and do not
> require an operational FireCon to do so."*
>
> *"Point Defense Systems can only be fired against ships without an operational screen/field (of any
> type) or any remaining armor boxes – i.e. undamaged warships are not vulnerable to such light
> weapons."*
>
> *"Each Point Defense System rolls only 1D6, with a roll of 6 inflicting 1 damage point with no
> re-roll."*

*Reading:* "without X or any Y" is read as *neither* — the target must have **no** operational
screen or field of any type **and** zero armour boxes left. The gloss that follows settles it:
undamaged warships are not vulnerable.

**Cost.** Mass 1, 3 points per mass.

## 7.13 Area Defense System

> *"capable of engaging enemy units out to a range of 12 MU ... It can fire once to a range of 12
> MU, or twice to a range of 6 MU. Inside 6 MU the two PDS dice may be targeted at different enemy
> units. ADS can also be used to target enemy ships; like a PDS it inflicts one hit on a roll of 6."*

So one ADS is: 1 PDS die out to 12 MU, **or** 2 PDS dice out to 6 MU which may be split between two
threats. It fires into the aft arc if its arcs reach there.

*Reading (the "12 MU Aegis"):* 7.13's aside — *"a central 'Aegis Cruiser' which can cover a ship up
to 12mu away"* — contradicts 7.10, 7.11 and 8.8, which all say the ADFC bubble is 6 MU. The three
explicit statements win: the **ally** must be within 6 MU of the ADFC ship; the **ADS** may then
reach a threat up to 12 MU from itself. That is how the 12 MU figure gets used at the table without
overruling the number the ADFC rule actually states.

**Cost.** Mass 2 with 3 arcs; +1 mass for all 6 arcs. 3 points per mass.

## 7.14 Scattergun

A **one-shot** weapon: *"When a Scattergun is used, cross it out. It is a one-shot weapon and may not
be used again during this battle."*

- Range 6 MU; fires into the aft arc like a PDS.
- *"The Scattergun has its own miniature integral FireCon system"* — no FireCon needed.
- *"Scatterguns have an in-built ADFC capability, and they can be used to support allied ships
  within 6 MU"* — a scattergun does **not** consume one of the ship's ADFC, and works on a ship with
  no ADFC at all.

| Target | Effect |
| --- | --- |
| Fighters and missiles, *"including Salvo Missiles"* | 1d6 hits |
| Heavy Fighters | 1d3 hits |
| Plasma Bolts and gunboats | 1 BD\* hit |
| Enemy ships, direct fire | 1 BD\*, *"unaffected by screens"* |

A "hit" here is a kill outright — there is no separate to-hit roll.

**Friendly fire in ADFC mode.**

> *"Scatterguns used in ADFC-mode have a chance of causing some damage to the ship being assisted. On
> a roll of '1' the allied ship suffers one point of damage, in addition to the effect of the
> Scattergun on the attacking fighter/missile."*

*Reading:* the roll in question is the scattergun's own hits die — it is the only die the scattergun
rolls. A natural 1 therefore scores 1 hit on the attacker **and** 1 point of damage on the ship being
covered. `1d3` is `ceil(1d6 / 2)`, the usual table substitute for a three-sided die, so a heavy
fighter shot rolls the same die and a 1 or 2 reads as 1.

**Cost.** Mass 1, 5 points per mass.

## 7.15 Grapeshot

> *"Grapeshot Launchers are similar in function to a Kra'Vak Scattergun but not quite as effective.
> When fired the player rolls 4 PDS dice for each launcher."*

Four ordinary PDS dice (8.8 confirms: *"Grapeshot rolls four D6 with results as for PDS"*), one-shot.
The text gives grapeshot no integral ADFC and no ship-attack mode, so it has neither.

**Cost.** Mass 1, 4 points, one-shot only.

## 7.16 Area Screens

> *"An area screen counts as one additional level of screen for the generating ship and any ship
> inside it's 6mu 'bubble' and will 'stack' with any screens those ships have up to a maximum of
> three."*
>
> *"Example: a frigate with a level one screen is being protected by a ship generating an area
> screen. The frigate would count as having a level two screen against any incoming fire."*

- The umbrella covers the generator itself and every ship within 6 MU of it.
- It stacks with the covered ship's own screens, **capped at 3**.
- *"the 'bubble' will not affect any fire coming from inside the 6mu radius"* — an attacker inside
  the bubble shoots at the covered ship's own screen level.

**What level 3 does.** The 4.7 table stops at level 2, and 7.16 does not extend it. What it adds is:

> *"In the case of ships with level two screens being protected by an area screen weapons that would
> normally penetrate do not get their re-rolls."*

So an effective level of 3 is the level-2 damage table **plus** no re-rolls at all — the (P) /
BD\* re-roll of 4.6 is switched off.

> *"Plasma weapons would be at -3 on their die rolls in addition to any shields the target ship
> mounts."*

*Reading:* a plasma cannon is already at −1 per level of screen (5.5), so −3 is exactly what an
effective screen level of 3 gives. The trailing clause is read as *the area screen's level counts
alongside the ship's own*, not as a second −3 stacked on top; taking it literally would put plasma
at −6 against a level-3 umbrella, which the sentence's own number contradicts. The implementation
uses `plasmaDrm = −effectiveLevel`.

*Reading (area screen level):* the mass line prices area screens *"per level (max of 2)"*, while the
opening sentence says an area screen counts as *one* additional level. A projector built at level *n*
contributes *n* levels to the umbrella, with the total still capped at 3; "one additional level" is
the level-1 case. `ScreenDef.area` in `types.ts` carries no level, so the engine defaults an area
screen to level 1 and lets a caller pass a level explicitly.

*Reading (advanced area screens):* the mass line prices *"30% for Advanced Screen"*, so advanced area
screens exist. An advanced area screen's levels count as advanced levels for every ship under it —
that is, they blunt ordnance per 7.3 — because that is the only thing "advanced" means for a screen.

**Cost.** 20% of the generating ship's mass per level (minimum 15) for a standard area screen, 30%
per level (minimum 20) for an advanced one, max level 2. 3.5 points per mass.

---

## Point defence: the allocation step (2.6 phase 9, 6.4, 7.10 – 7.15, 8.8)

Phase 9 has a strict order, and it is the reason allocation is a separate exported step from
resolution:

> *"Any ship under missile and/or fighter/gunboat attack allocates its defenses against attacking
> elements, then rolls for effect. As with ship fire, announce all targets before rolling any
> dice."*
>
> *"A ship that wishes to shoot at multiple fighter groups or missiles must divide point defense
> weapons between them before rolling any dice."*
>
> *"When resolving missile fire, the defending player must first decide what defenses to allocate
> against each Heavy Missile or Salvo Missile marker. Once that has been done for all ships, resolve
> defensive fire as follows..."* (6.4)

### Who may engage what

| Defender | May engage |
| --- | --- |
| Any ship | fighters, gunboats and ordnance making an attack run **on itself** |
| A ship with *n* ADFC | the above, **plus** for each ADFC either (a) everything attacking one nominated allied ship within 6 MU, or (b) one unengaged fighter group within 6 MU |
| A ship with an AADFC | the above with no limit on the number of allied ships within 6 MU |
| A ship with a scattergun | the scattergun alone may cover an allied ship within 6 MU without spending an ADFC (7.14) |

Barred in every case: a fighter group already *"engaged by other fighters"* (8.8, 8.10). Beam-1s may
only defend their own ship (8.8). A ship that launched or recovered fighters this turn cannot use any
ADFC (7.10) — its scatterguns still work, since their ADFC capability is their own.

### Once per turn, and what it costs

> *"In Full Thrust weapons can only be used once per turn, so any system used for point defense can
> only be directed against a single fighter group or missile, and cannot be used again in that turn
> against a ship."* (2.6)

The one exception is the ADS inside 6 MU, which is explicitly *"twice to a range of 6 MU"* with the
two dice targetable separately (7.13). Beam-1s used in point defence *"may not fire in the Ship Fire
Phase"* (8.8).

### Dice each mount contributes

| Mount | Dice | Kill table | Envelope |
| --- | --- | --- | --- |
| PDS | 1 | PDS | 6 MU |
| ADS | 1 at ≤ 12 MU, or 2 at ≤ 6 MU (splittable) | PDS | 12 MU |
| Beam-1 (and other dual-purpose mounts in PD mode) | 1 | Beam-1 | own arcs, 12 MU |
| Fighter in a screening group | 1 per fighter | Beam-1 table | — |
| Grapeshot | 4 | PDS | 6 MU, one-shot |
| Scattergun | 1d6 kills outright | — | 6 MU, one-shot |

*Reading (PDS envelope against ordnance and fighters):* 7.12 gives a PDS a 6 MU reach only for its
anti-ship mode; against attackers it says nothing, because an attack run is by definition adjacent.
6 MU is used throughout, which is also the ADFC radius, so nothing a PDS can legally be pointed at
lies outside it.

### Worked example (8.8)

> *"Ship A is under attack by fighter group X which is 2 MU away. Fighter group Y could attack ship B
> but has chosen not to, and Z is too far away. Ship B is carrying PDS and an ADFC, while ship A has
> PDS only. Ship A can engage fighter group X with its own PDS. Ship B can also engage group X, as
> although the fighters are more than 6MU away, they are currently attacking a ship which is within
> ship B's protective ADFC range of 6 MU; or group Y because it is within 6 MU. Fighter group Z is
> safe from point defense fire."*

Note what this fixes: for ADFC mode (a) the range test is **ADFC ship → covered ally**, not ADFC
ship → threat. Group X is more than 6 MU from ship B and is still a legal target.

### Worked example (6.5)

> *"Two missile salvoes are fired at a single target ship. The ship has ... one Point Defense System
> (PDS) and two Beam-1 batteries ... The defender chooses to use the PDS alone against one incoming
> salvo, and the 2 Beam-1 batteries to combine fire against the second salvo. The attacking player
> now rolls for each missile salvo. For the first the roll is 2, but the second is luckier and rolls
> 5. The first salvo has only two missiles on target, and the defending player rolls the PDS die and
> gets a 6, thus shooting them both down. ... For the second salvo with five missiles incoming, the
> defender gets to roll 2 dice for the 2 Beam-1 batteries, and rolls a 4 and a 6. The 6 allows a
> re-roll, but this only gets a 2. So the defender has killed only one incoming missile from this
> salvo of five. The end result is that four missiles of the second salvo get past all the defenses
> ... A D6 is rolled for each of them, scoring 3, 1, 3, and 6; missile hits don't re-roll so this
> gives a grand total of 13 damage points to the target ship. ... If the ship has four boxes of
> armor, 4 points of damage will be taken on the armor and the remaining 9 on the hull boxes."*

### Anti-matter missiles

An antimatter missile is a heavy-missile body, so PD rolls against it use the heavy-missile column,
but each success is a **hit**, not a kill: *"Each hit from point defense fire reduces the warhead
strength by 1d6 and the blast radius by 1 MU. Three hits will disrupt the warhead sufficiently to
prevent any meaningful explosion."* The allocator therefore caps recorded hits at 3.

---

## Not implemented here, and why

| Rule | Where it went |
| --- | --- |
| The beam damage table itself | `dice.beamDamage` (4.5–4.7) |
| Applying hull damage, rows and threshold checks | `combat.ts`, `threshold.ts` |
| What a plasma bolt, gunboat or heavy fighter *is* | sections 6.8, 9, 8.15 — other modules; this module takes the target category as an input |
| Per-weapon PD quirks (K-1's −1 DRM and aft-arc bar, EMP-1's −1, Interceptor's +1) | the weapon modules own the numbers; `PdMount.drm` carries whatever they say |
| Holofield (7.17) onward | outside 7.2–7.16 |
