# The Imperial Tech Base — section 15

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 15 in full — the preamble,
15.1 Master Tech Base Reference, 15.8 Gunboats and 15.2 Example Factions — quoted from
`continuum-rulebook-part2.txt` lines 1637–1735 (book pages 125–127). Cross-references to sections
5, 6, 7, 8, 9, 13 and 14 are named where 15.1 delegates to them.

Implementation: `src/engine/techbase.ts`. Tests: `src/engine/techbase.test.ts`.

Readings taken where the text genuinely admits more than one meaning are marked **[reading]** with
the alternative that was rejected and why.

---

## About the extract, before anything else

Section 15 is printed in two columns and the PDF text extraction reads across them, so in
`continuum-rulebook-part2.txt` the lists are *interleaved*. Line 1673 is

> "Targeting systems 1. Fire Control (0 technology choices)"

and line 1675 is

> "Ordnance weapons 2. Advanced fire Control (1 technology choice)"

— the "2. Advanced fire Control" belongs to Targeting systems, not to Ordnance weapons, and the
Ordnance list restarts at its own "1. Antimatter Missile" on line 1677. The same happens to Direct
fire weapons against Ordnance weapons (lines 1677–1685), and to Fighters against Spinal Mounts
(line 1687), and to 15.2's faction tables against the 15.8 gunboat list (lines 1695–1729).

Every list in this document has been de-interleaved by following the item numbers: each column's
numbering runs 1, 2, 3… without gaps, so a stray "2." next to a list that has just reached "8." is
the other column. Nothing was added and nothing was dropped — the eight lists below account for
every numbered item in those lines, and the two example factions' printed TOTAL lines are checked
against the rows above them.

---

## Why the section exists

> "The technology and various systems outlined in the rules are designed to give players the
> flexibility to design their ships to match whatever genre they wish to play in… Players are
> naturally limited in what tech systems they can put on their ships by the genre, movie, TV show,
> etc., they are emulating and thus (probably) cannot 'uber-build' a game winner."

The problem is the player who has no genre to be limited by:

> "But what if a player has a collection of generic models that doesn't already go with a 'known
> universe'? By the rules he/she can build whatever they want, opening up the door to abusive play.
> For example - who wants to play against an opponent that uses spinal mounts, cloaking devices,
> fighters, gunboats, scatter packs and advanced drives all on the same ship? The best way to limit
> players is to generate a Tech Base for the player's empire using the following lists."

So section 15 is not a combat rule. It is a **design-time predicate**, and that is exactly the
shape the module has: no dice, no state, no phase. Values in, verdict out.

---

## How a tech base is built

Three sentences carry the whole mechanism.

**The budget.**

> "Players may choose whatever systems they wish but are limited to a number of choices as
> determined by their player group. We recommend no more than ten but it's up to the players."

**Free systems.**

> "Some systems come for free and are marked with a '0' cost. Every empire has those systems and
> they do not count as one of their tech choice choices."

**Prerequisites.**

> "Some systems also have prerequisites meaning you must purchase one system in order to be able to
> have another. For example, Pulse Batteries require the empire to have beam weapons as well since
> Pulse Weapons are an advanced version of standard beam weaponry."

("Pulse Batteries" here is the list's "Pulsers", 5.21 — the only place in the book the weapon is
called a battery. The example matches the list entry: Pulsers, prerequisite is Beams.)

### [reading] A cost of zero means two different things

The preamble says a 0-cost system is one "every empire has". But eight entries in 15.1 cost nothing
and are plainly *not* universal, because their printed text names a parent:

> "17. Area ECM (comes with ECM technology)"
> "3. Salvo Missile Rack (comes with Salvo Missile Launcher)"
> "11. Meson Projector (comes free with either Twin Particle Array or Gatling Batteries)"
> "6. Interceptor (comes with standard fighter technology)"
> "18. Fighter Racks (come with Robot Fighter technology)"
> "2. Gunboat Rack (comes with Gunboats)"

— plus every armament in the 15.8 list, all of which read "comes with X technology".

**The reading.** Zero-cost entries split into two kinds, and the module types them that way:

- `universal` — printed "(0 technology choices)". Every empire has it, unconditionally, before it
  spends anything. Fire Control, ADFC, FTL Drive, the standard hull and drive, Standard Mines and
  all eleven Secondary ship systems that are marked 0.
- `bundled` — printed "comes with X". Costs 0 choices **and** is unavailable until X is held.

**The alternative, rejected.** Read the preamble literally, so that every 0-cost entry is universal.
That gives every empire Area ECM without ECM, Salvo Missile Racks with no launcher to feed them,
Fighter Racks with no robot fighters and Gunboat Racks with no gunboats, and it makes the
parenthetical text of six entries dead letters. The preamble is a summary of the common case; the
per-entry text is the rule.

### [reading] "Beams is prerequisite" means Class 1–3

Grasers, Gatling Batteries, Twin Particle Arrays, Pulsers and the Beam spinal mount all name
"Beams" as a prerequisite with no class. The list has no entry called plain "Beams" — it has
"Beams, Class 1, 2 and 3" and "Beams, Class 4, 5 and 6".

**The reading.** The bare "Beams" prerequisite is `beams-1-3`. Since Class 4–6 has Class 1–3 as its
own prerequisite, an empire that can field any beam at all satisfies it, so the two possible
readings ("Class 1–3" and "either entry") are the same set of legal tech bases.

**The alternative, rejected.** Requiring *both* beam entries. Nothing says so, and it would make a
Graser cost three choices in practice. The New Anglian Confederation buys both beam entries and
Standard Grasers as three separate one-choice rows, which is what the master reference charges.

### [reading] Gunboat armaments also require Gunboats

15.8 items 4–21 print only a ship-side parent — "Beams (comes with Beam technology)". Item 22,
"Heavy or Screened Gunboat (+mod) (1 Technology choice)", prints no prerequisite at all. Only item
3 spells out "prerequisite is Gunboats".

**The reading.** Every entry in the 15.8 list except "Gunboats" itself also requires `gunboat`. A
Beam Gunboat technology held by an empire that cannot build gunboats is not a technology.

**The alternative, rejected.** Read items 4–22 literally, so an empire with Beams "has" Beam Gunboat
technology whether or not it has gunboats. Harmless in play, but `availableTech` would then report
armaments the fleet cannot field, and the Heavy modification would be purchasable by an empire with
nothing to modify.

### [reading] The fighter/gunboat exclusion is checked over the whole tech base

15.8's heading:

> "(Optional - Gunboats may not be purchased if the Empire is using fighters)"

**The reading.** Holding *any* paid choice in the Fighters category bars every choice in the
Gunboats category, and vice versa; the check is on the tech base, not on a fleet list or a battle.
"Any choice in the Fighters category" is taken at the book's own word — the section draws exactly
one line, around the category, so Assault Shuttles and the Fighter Package Deal count as fighters
even though a shuttle is not a fighter in any other sense.

**The alternative, rejected.** Read "is using" as a per-battle condition: an empire owns both
technologies and simply never fields them in the same game. That is unenforceable in a design-time
predicate — which is all section 15 is — and would reduce the only hard restriction in the section
to advice.

### [reading] The Fighter Package Deal grants six *choices*, poolable

> "21. Fighter Package Deal — This technology 3 choice package 'fighter specialists' allows the user
> to pick 6 choices of fighter technology."

**The reading.** The package costs 3 from the empire's main allowance and creates a separate
6-choice pool that may only be spent on Fighters-category entries. The pool is a quantity of
choices, not a count of items: Multi-Role Fighters draw 3 of the 6, and an entry may be *part* paid
from the pool with the overflow charged to the main allowance. Prerequisites outside the Fighters
category (Pulse Torpedoes for a Torpedo Fighter, Salvo Missiles for a Missile Fighter) are still
bought from the main allowance — the package buys "fighter technology", and a pulse torpedo is not.

**The alternatives, rejected.** (a) "Six items regardless of their printed cost", which would make
the package worth 3 choices for up to 3 + 17 = 20 choices' worth of fighter tech, and would make
Multi-Role Fighters — the one 3-choice fighter entry — cost the same as an Interceptor. (b) Atomic
entries, where an entry that does not fit in the remaining pool must be paid in full from the main
allowance; that makes the package's value depend on the order the choices were written down, and
nothing in the section has an order.

### [reading] The recommended ten is a default, not a limit

**The reading.** `RECOMMENDED_TECH_CHOICE_LIMIT` is 10 and is the default budget, but the limit is
a parameter and going over it is a **warning**, never an error.

**The alternative, rejected.** Enforce 10. The section's own two example factions print totals of
12 and 11, so a hard ten makes the book illegal by its own examples. "It's up to the players" is
the rule; ten is the recommendation.

---

## 15.1 Master Tech Base Reference

Nine lists, 123 entries. In each table: **Choices** is what the entry costs; `0 (u)` is universal
and `0 (b)` is bundled, per the reading above. **Engine** names the exact `SystemKind`,
`WeaponClass` or other `src/engine/types.ts` handle the entry unlocks; an em-dash means the engine
has no name for it, and every one of those is listed again under "Where 15.1 and the engine's
unions disagree".

### Primary ship systems

> "Primary ship systems 1. Standard 4, 5 and 6 row Hull (0 technology choices) 2. Advanced 3 row
> Hull (1 technology choice) 3. Hangar bay and launch tube/flight deck (0 technology choices)
> 4. Launch tube catapult (1 technology choice) 5. Standard drive system (0 technology choices)
> 6. Advanced gravity drive (3 technology choices) 7. FTL Drive (0 technology choices) 8. Advanced
> FTL Drives (1 technology choice)"

| # | As printed | Choices | Prerequisite | Tech id | Engine |
| --- | --- | --- | --- | --- | --- |
| 1 | Standard 4, 5 and 6 row Hull | 0 (u) | — | `hull-standard` | `HullRows` 4, 5, 6 |
| 2 | Advanced 3 row Hull | 1 | — | `hull-advanced-3-row` | `HullRows` 3 |
| 3 | Hangar bay and launch tube/flight deck | 0 (u) | — | `hangar-bay` | `hangar-bay`, `launch-tube` |
| 4 | Launch tube catapult | 1 | — | `launch-tube-catapult` | `catapult` |
| 5 | Standard drive system | 0 (u) | — | `drive-standard` | `DriveDef.advanced = false` |
| 6 | Advanced gravity drive | 3 | — | `drive-advanced-gravity` | `DriveDef.advanced = true` |
| 7 | FTL Drive | 0 (u) | — | `ftl-drive` | `FtlKind` `'standard'` |
| 8 | Advanced FTL Drives | 1 | — | `ftl-drive-advanced` | `FtlKind` `'advanced'` |

The advanced gravity drive at **3** is the most expensive single entry in the section outside Area
Screens, and the only 3-choice entry among primary systems. 13.9's advanced drive turns its full
rating instead of half, so the section prices manoeuvre as the rarest thing an empire can have.

### Defensive systems

> "Defensive systems 1. Armor (1 technology choice) 2. Layered or Shell Armor (1 technology choice,
> prerequisite is Armor) 3. Regenerative Armor (2 technology choices) 4. Stealth Hull (1 technology
> choice) 5. ADFC (0 technology choice) 6. Advanced ADFC (1 technology choice) 7. PDS (1 technology
> choice) 8. ADS (1 technology choice, PDS is prerequisite) 9. Scattergun (1 technology choice,
> prerequisite is Grape Shot) 10. Grapeshot (1 technology choice) 11 Screens (1 technology choice)
> 12. Advanced Screens (2 technology choices prerequisite is Screens) 13. Area Screens (3 technology
> choices, Advanced Screens is prerequisite) 14. Holofield (1 technology choice) 15. Stealth Fields
> (1 technology choice) 16. ECM (2 technology choices) 17. Area ECM (comes with ECM technology)
> 18. Cloaking Device (1 technology choice, Stealth Field is prerequisite) 19. Cloaking Field
> (1 technology choice, Stealth Field is prerequisite) 20. Tuffley Cloak Device (1 technology choice,
> Stealth Field is prerequisite) 21. Antimatter Suicide Charge (1 technology choice)"

| # | As printed | Choices | Prerequisite | Tech id | Engine |
| --- | --- | --- | --- | --- | --- |
| 1 | Armor | 1 | — | `armour` | `ArmourDef.layers` |
| 2 | Layered or Shell Armor | 1 | Armor | `armour-layered` | `ArmourDef.layers.length > 1` |
| 3 | Regenerative Armor | 2 | — | `armour-regenerative` | `ArmourDef.regenerative` |
| 4 | Stealth Hull | 1 | — | `stealth-hull` | `stealth-hull` |
| 5 | ADFC | 0 (u) | — | `adfc` | `adfc` |
| 6 | Advanced ADFC | 1 | — | `advanced-adfc` | `advanced-adfc` |
| 7 | PDS | 1 | — | `pds` | `pds` |
| 8 | ADS | 1 | PDS | `ads` | `ads` |
| 9 | Scattergun | 1 | Grape Shot | `scattergun` | `scattergun` |
| 10 | Grapeshot | 1 | — | `grapeshot` | `grapeshot` |
| 11 | Screens | 1 | — | `screens` | `screen-generator`, `ScreenDef.level` |
| 12 | Advanced Screens | 2 | Screens | `advanced-screens` | `ScreenDef.advanced` |
| 13 | Area Screens | 3 | Advanced Screens | `area-screens` | `ScreenDef.area` |
| 14 | Holofield | 1 | — | `holofield` | `holofield` |
| 15 | Stealth Fields | 1 | — | `stealth-field` | `stealth-field` |
| 16 | ECM | 2 | — | `ecm` | `ecm` |
| 17 | Area ECM | 0 (b) | ECM | `area-ecm` | `area-ecm` |
| 18 | Cloaking Device | 1 | Stealth Field | `cloaking-device` | `cloaking-device` |
| 19 | Cloaking Field | 1 | Stealth Field | `cloaking-field` | `cloaking-field` |
| 20 | Tuffley Cloak Device | 1 | Stealth Field | `tuffley-cloak` | `tuffley-cloak` |
| 21 | Antimatter Suicide Charge | 1 | — | `antimatter-charge` | `antimatter-charge` |

Four things here are the wrong way round from what a reader expects, and all four are tested:

- **Scattergun's prerequisite is printed one line before Grapeshot is defined.** #9 requires #10.
  7.14 calls the Scattergun the more effective of the pair, so the cheaper weapon gates the better
  one, but the list order hides it.
- **ADFC is free and PDS is not.** Area *defence* fire control costs nothing; the guns it directs
  cost a choice each.
- **ECM costs 2** where every other electronic-warfare entry — holofield, stealth field, all three
  cloaks — costs 1. Area ECM then comes free on top of it.
- **Regenerative armour costs 2 and has no prerequisite.** Layered armour, at 1, does require plain
  Armor. So an empire may field regenerating armour without ever buying ordinary armour. That is as
  printed and the module does not "fix" it; a test pins it so nobody does later.

### Targeting systems

> "Targeting systems 1. Fire Control (0 technology choices) 2. Advanced fire Control (1 technology
> choice)"

| # | As printed | Choices | Prerequisite | Tech id | Engine |
| --- | --- | --- | --- | --- | --- |
| 1 | Fire Control | 0 (u) | — | `firecon` | `firecon` |
| 2 | Advanced fire Control | 1 | — | `advanced-firecon` | `advanced-firecon` |

### Direct fire weapons

> "Direct fire weapons 1. Beams, Class 1, 2 and 3 (1 technology choice) 2. Beams, Class 4, 5 and 6
> (1 technology choice, prerequisite is Beams Class 1, 2 and 3) 3. EMP Projectors (1 technology
> choice) 4. Plasma Cannon (1 technology choice) 5. Standard Grasers (1 technology choice, Beams is
> prerequisite) 6. Heavy Grasers (1 technology choice, prerequisite is Standard Grasers) 7. Phasers
> (1 technology choice, prerequisites are Beams, and Grasers) 8. Transporter Beams (1 technology
> choice) 9. Gatling Battery (1 technology choice, Beams is prerequisite) 10. Twin Particle Array
> (1 technology choice, Beams is prerequisite) 11. Meson Projector (comes free with either Twin
> Particle Array or Gatling Batteries) 12. Needle Beams (1 technology choice) 13. Pulse Torpedoes -
> Standard and Short Range (1 technology choice) 14. Overloaded Pulse Torpedo (1 technology choice,
> prerequisite is Pulse Torpedo) 15. Long Range Pulse Torpedo (1 technology choice, prerequisite is
> Pulse Torpedo) 16. Variable Strength Pulse Torpedo (1 technology choice, prerequisite is Pulse
> Torpedo) 17. Fusion Array (1 technology choice) 18. Submunition Pack (1 technology choice)
> 19. K-Guns Standard and Short Range (1 technology choice) 20. Long Range K-Gun (1 technology
> choice, prerequisite is K-Gun) 21. Flak Ammo (1 technology choice) 22. Gravitic Guns (1 technology
> choice) 23. Boarding Torpedoes (1 technology choice) 24. Pulsers (2 technology choices,
> prerequisite is Beams) 25. Turrets (1 technology choice)"

| # | As printed | Choices | Prerequisite | Tech id | Engine |
| --- | --- | --- | --- | --- | --- |
| 1 | Beams, Class 1, 2 and 3 | 1 | — | `beams-1-3` | `beam` ratings 1–3 |
| 2 | Beams, Class 4, 5 and 6 | 1 | Beams Class 1, 2 and 3 | `beams-4-6` | `beam` ratings 4–6 |
| 3 | EMP Projectors | 1 | — | `emp` | `emp` |
| 4 | Plasma Cannon | 1 | — | `plasma-cannon` | `plasma-cannon` |
| 5 | Standard Grasers | 1 | Beams | `graser` | `graser` |
| 6 | Heavy Grasers | 1 | Standard Grasers | `heavy-graser` | `heavy-graser` |
| 7 | Phasers | 1 | Beams **and** Grasers | `phaser` | `phaser` |
| 8 | Transporter Beams | 1 | — | `transporter` | `transporter` |
| 9 | Gatling Battery | 1 | Beams | `gatling` | `gatling` |
| 10 | Twin Particle Array | 1 | Beams | `twin-particle-array` | `twin-particle-array` |
| 11 | Meson Projector | 0 (b) | Twin Particle Array **or** Gatling Batteries | `meson-projector` | `meson-projector` |
| 12 | Needle Beams | 1 | — | `needle-beam` | `needle-beam` |
| 13 | Pulse Torpedoes - Standard and Short Range | 1 | — | `pulse-torpedo` | `pulse-torpedo` variants `standard`, `short` |
| 14 | Overloaded Pulse Torpedo | 1 | Pulse Torpedo | `pulse-torpedo-overloaded` | `pulse-torpedo`, **no variant** |
| 15 | Long Range Pulse Torpedo | 1 | Pulse Torpedo | `pulse-torpedo-long` | `pulse-torpedo` variant `long` |
| 16 | Variable Strength Pulse Torpedo | 1 | Pulse Torpedo | `pulse-torpedo-variable` | `pulse-torpedo` variant `variable` |
| 17 | Fusion Array | 1 | — | `fusion-array` | `fusion-array` |
| 18 | Submunition Pack | 1 | — | `submunition-pack` | `submunition-pack` |
| 19 | K-Guns Standard and Short Range | 1 | — | `k-gun` | `k-gun` variants `standard`, `short` |
| 20 | Long Range K-Gun | 1 | K-Gun | `k-gun-long` | `k-gun` variant `long` |
| 21 | Flak Ammo | 1 | — | `flak-ammo` | — |
| 22 | Gravitic Guns | 1 | — | `gravitic-gun` | `gravitic-gun` |
| 23 | Boarding Torpedoes | 1 | — | `boarding-torpedo` | `boarding-torpedo` |
| 24 | Pulsers | 2 | Beams | `pulser` | `pulser` |
| 25 | Turrets | 1 | — | `turrets` | `TurretDef` |

Three things worth pinning:

- **Both range variants come in the base entry.** #13 is "Pulse Torpedoes - Standard *and* Short
  Range" and #19 is "K-Guns Standard *and* Short Range". Only the long-range versions are extra.
  Short-range mountings are half mass (14.4), so the cheap option is the free one.
- **Flak Ammo has no printed prerequisite**, even though 5.16 only lets a K-gun of class 2 or larger
  carry it ("K-Guns of class 2 or larger can be equipped to fire high explosive shells"). The module
  encodes it exactly as printed — 1 choice, no prerequisite — rather than inventing the K-Gun
  prerequisite the construction rules imply. This is deliberately *not* a [reading]: the text is not
  ambiguous, it is merely odd, and inventing a prerequisite would be inventing a rule. A test pins it.
- **Turrets are a technology.** 5.22's mounting costs a choice, so an empire without it fires
  everything on fixed arcs.

### Ordnance weapons

> "Ordnance weapons 1. Antimatter Missile (1 technology choice) 2. Salvo Missile Launcher (1
> technology choice) 3. Salvo Missile Rack (comes with Salvo Missile Launcher) 4. Extended Range
> Salvo Missiles (1 technology choice) 5. Rocket pods (1 technology choice) 6. Heavy missiles (1
> technology choice) 7. Mine Layer Rack (1 technology choice) 8. Standard Mines (0 technology
> choices) 9. Multiple Kinetic Penetrators (1 technology choice, prerequisite is K-Guns) 10. Plasma
> Bolt Launcher (1 technology choice)"

| # | As printed | Choices | Prerequisite | Tech id | Engine |
| --- | --- | --- | --- | --- | --- |
| 1 | Antimatter Missile | 1 | — | `antimatter-missile` | `antimatter-missile` |
| 2 | Salvo Missile Launcher | 1 | — | `salvo-missile-launcher` | `salvo-missile-launcher` |
| 3 | Salvo Missile Rack | 0 (b) | Salvo Missile Launcher | `salvo-missile-rack` | `salvo-missile-rack` |
| 4 | Extended Range Salvo Missiles | 1 | — | `salvo-missile-extended` | `salvo-missile-launcher` variant `extended` |
| 5 | Rocket pods | 1 | — | `rocket-pod` | `rocket-pod` |
| 6 | Heavy missiles | 1 | — | `heavy-missile` | `heavy-missile` |
| 7 | Mine Layer Rack | 1 | — | `mine-rack` | `mine-rack` |
| 8 | Standard Mines | 0 (u) | — | `mines-standard` | — (the rack carries them) |
| 9 | Multiple Kinetic Penetrators | 1 | K-Guns | `mkp` | `mkp` |
| 10 | Plasma Bolt Launcher | 1 | — | `plasma-bolt-launcher` | `plasma-bolt-launcher` |

- **MKP reaches across categories.** It is an Ordnance entry whose prerequisite, K-Guns, is a Direct
  fire entry. It is the only cross-category prerequisite outside Fighters and Gunboats, and it is
  the one most likely to be missed by an implementation that validates each list separately.
- **Extended Range Salvo Missiles has no printed prerequisite**, even though it is by name a variant
  of the Salvo Missile the next entry up gates. As printed, and pinned by a test, for the same
  reason as Flak Ammo.
- **Standard Mines are free but the rack is not.** Mines cost nothing; the Mine Layer Rack that lays
  them costs 1. 6.9's minefield is available to any empire that buys the launcher.

### Spinal Mounts

> "Spinal Mounts 1. Point Singularity Projector (2 technology choices, Gravitic Gun is prerequisite)
> 2. Beam (1 technology choice, Beams is prerequisite) 3. Plasma (1 technology choice, Plasma Cannon
> is prerequisite)"

| # | As printed | Choices | Prerequisite | Tech id | Engine |
| --- | --- | --- | --- | --- | --- |
| 1 | Point Singularity Projector | 2 | Gravitic Gun | `spinal-psp` | `spinal-psp` |
| 2 | Beam | 1 | Beams | `spinal-beam` | `spinal-beam` |
| 3 | Plasma | 1 | Plasma Cannon | `spinal-plasma` | `spinal-plasma` |

Every spinal mount requires the ship-scale weapon it is an enlargement of, so a spinal mount is
never an empire's first weapon. The Point Singularity Projector at 2 choices *plus* the Gravitic Gun
at 1 is the most expensive weapon path in the section: three choices before a shot is fired.

### Fighters

> "Fighters 1. Standard Beam fighter (1 technology choice, prerequisite is Beams) 2. Standard Gun
> fighter (1 technology choice, prerequisite is K-Guns) 3. Heavy (+mod) (1 technology choice)
> 4. Fast (+mod) (1 technology choice) 5. Long Range (+ mod) (1 technology choice) 6. Interceptor
> (comes with standard fighter technology) 7. Attack Fighter (1 technology choice) 8. Torpedo Fighter
> (1 technology choice, prerequisite is Pulse Torpedoes) 9. EMP Fighter (1 technology choice,
> prerequisite is EMP Projectors) 10. Graser Fighter (1 technology choice, prerequisite is Standard
> Grasers) 11. Plasma Fighter (1 technology choice, prerequisite is Plasma Cannon) 12. MKP Fighter
> (1 technology choice, prerequisite is MKP Packs) 13. Needle Fighter (1 technology choice,
> prerequisite is Needle Beams) 14. Missile Fighters (1 technology choice, prerequisite is Salvo
> Missiles) 15. Rocket Fighter (1 technology choice, prerequisite is Rocket Pods) 16. Multi-Role
> Fighters (3 technology choices, prerequisite is Standard and Attack Fighters) 17. Robot Fighters
> (1 technology choice) 18. Fighter Racks (come with Robot Fighter technology) 19. FTL Fighters (1
> technology choice) 20. Assault Shuttles (1 technology choice) 21. Fighter Package Deal — This
> technology 3 choice package 'fighter specialists' allows the user to pick 6 choices of fighter
> technology."

| # | As printed | Choices | Prerequisite | Tech id | Engine |
| --- | --- | --- | --- | --- | --- |
| 1 | Standard Beam fighter | 1 | Beams | `fighter-standard-beam` | fighter type `standard`, armament `beam` |
| 2 | Standard Gun fighter | 1 | K-Guns | `fighter-standard-gun` | fighter type `standard`, armament `cannon` |
| 3 | Heavy (+mod) | 1 | — | `fighter-heavy` | modifier `heavy` |
| 4 | Fast (+mod) | 1 | — | `fighter-fast` | modifier `fast` |
| 5 | Long Range (+ mod) | 1 | — | `fighter-long-range` | modifier `long-range` |
| 6 | Interceptor | 0 (b) | standard fighter technology | `fighter-interceptor` | fighter type `interceptor` |
| 7 | Attack Fighter | 1 | — | `fighter-attack` | fighter type `attack` |
| 8 | Torpedo Fighter | 1 | Pulse Torpedoes | `fighter-torpedo` | fighter type `torpedo` |
| 9 | EMP Fighter | 1 | EMP Projectors | `fighter-emp` | — |
| 10 | Graser Fighter | 1 | Standard Grasers | `fighter-graser` | fighter type `graser` |
| 11 | Plasma Fighter | 1 | Plasma Cannon | `fighter-plasma` | fighter type `plasma` |
| 12 | MKP Fighter | 1 | MKP Packs | `fighter-mkp` | fighter type `mkp` |
| 13 | Needle Fighter | 1 | Needle Beams | `fighter-needle` | — |
| 14 | Missile Fighters | 1 | Salvo Missiles | `fighter-missile` | fighter type `missile` |
| 15 | Rocket Fighter | 1 | Rocket Pods | `fighter-rocket` | — |
| 16 | Multi-Role Fighters | 3 | Standard **and** Attack Fighters | `fighter-multi-role` | fighter type `multi-role` |
| 17 | Robot Fighters | 1 | — | `fighter-robot` | modifier `robot` |
| 18 | Fighter Racks | 0 (b) | Robot Fighter technology | `fighter-rack` | `fighter-rack` |
| 19 | FTL Fighters | 1 | — | `fighter-ftl` | modifier `ftl` |
| 20 | Assault Shuttles | 1 | — | `assault-shuttle` | fighter type `assault-shuttle` |
| 21 | Fighter Package Deal | 3 | — | `fighter-package-deal` | — (a budget rule) |

- **"Standard fighter" is two entries, not one.** #1 rides on Beams, #2 on K-Guns. 8.15's armament
  split ("If equipped with beams they inflict BD\* hits… If equipped with cannon they inflict BD
  hits… but ignore the effects of screens") is the same split, sold separately. The Interceptor
  bundles off *either* of them, and Multi-Role Fighters need *either* one plus the Attack Fighter.
- **Fighter Racks come with Robot Fighters, not with fighters.** An empire with hangar bays and
  standard fighters cannot mount racks; it needs the robot technology first. 13.12's rack is the
  unmanned launcher, which is why.
- **Multi-Role at 3** is the only 3-choice fighter entry, and its two prerequisites are themselves
  1 choice apiece, so the full multi-role capability is 5 choices — half a recommended tech base.

### 15.8 Gunboats

The section is numbered 15.8 but printed inside 15.1, between Fighters and Secondary ship systems.
That is the book's own layout and the table of contents agrees ("15.8 Gunboats … 127" sits between
"Fighters … 126" and "Secondary ship systems … 127"). There are no 15.3–15.7.

> "15.8 Gunboats (Optional - Gunboats may not be purchased if the Empire is using fighters)
> 1. Gunboats (1 technology choice) 2. Gunboat Rack (comes with Gunboats) 3. FTL Gunboats (1
> technology choice, prerequisite is Gunboats) 4. Beams (comes with Beam technology) 5. EMP (comes
> with EMP Projector technology) 6. Plasma (comes with Plasma Cannon technology) 7. Graser (comes
> with Graser technology) 8. Gatling/Pulser (comes with either Gatling battery or Pulser technology)
> 9. Needle (comes with Needle Beam technology) 10. Pulse Torpedo (comes with Pulse Torpedo
> technology) 11. Submunition (comes with Submunition Pack technology) 12. MKP (comes with MKP
> technology) 13. K-Gun (comes with K-Gun technology) 14. Gravitic Gun (come with Gravitic Gun
> technology) 15. Missile (comes with standard missile technology) 16. Rocket (comes with Rocket Pod
> technology) 17. Boarding Torpedo (comes with boarding torpedo technology) 18. Area Defense (comes
> with ADS technology) 19. ECM (comes with ECM or Area ECM technology) 20. Scatterpack (comes with
> Scatterpack technology) 21. Plasma Bomber (comes with Plasma Bolt Launcher technology) 22. Heavy
> or Screened Gunboat (+mod) (1 Technology choice)"

Every entry from 4 onward also requires `gunboat`, per the reading above.

| # | As printed | Choices | Prerequisite (plus Gunboats) | Tech id | Engine |
| --- | --- | --- | --- | --- | --- |
| 1 | Gunboats | 1 | — | `gunboat` | `GunboatSquadron` |
| 2 | Gunboat Rack | 0 (b) | Gunboats | `gunboat-rack` | `gunboat-rack` |
| 3 | FTL Gunboats | 1 | Gunboats | `gunboat-ftl` | gunboat modifier `ftl` |
| 4 | Beams | 0 (b) | Beam technology | `gunboat-beam` | gunboat type `beam` |
| 5 | EMP | 0 (b) | EMP Projector technology | `gunboat-emp` | — |
| 6 | Plasma | 0 (b) | Plasma Cannon technology | `gunboat-plasma` | gunboat type `plasma` |
| 7 | Graser | 0 (b) | Graser technology | `gunboat-graser` | gunboat type `graser` |
| 8 | Gatling/Pulser | 0 (b) | Gatling battery **or** Pulser | `gunboat-gatling` | gunboat type `gatling` |
| 9 | Needle | 0 (b) | Needle Beam technology | `gunboat-needle` | gunboat type `needle` |
| 10 | Pulse Torpedo | 0 (b) | Pulse Torpedo technology | `gunboat-pulse-torpedo` | gunboat type `pulse-torpedo` |
| 11 | Submunition | 0 (b) | Submunition Pack technology | `gunboat-submunition` | gunboat type `submunition` |
| 12 | MKP | 0 (b) | MKP technology | `gunboat-mkp` | gunboat type `mkp` |
| 13 | K-Gun | 0 (b) | K-Gun technology | `gunboat-k-gun` | gunboat type `k-gun` |
| 14 | Gravitic Gun | 0 (b) | Gravitic Gun technology | `gunboat-gravitic` | — |
| 15 | Missile | 0 (b) | standard missile technology | `gunboat-missile` | gunboat type `missile` |
| 16 | Rocket | 0 (b) | Rocket Pod technology | `gunboat-rocket` | gunboat type `rocket` |
| 17 | Boarding Torpedo | 0 (b) | boarding torpedo technology | `gunboat-boarding-torpedo` | — |
| 18 | Area Defense | 0 (b) | ADS technology | `gunboat-ads` | gunboat type `ads` |
| 19 | ECM | 0 (b) | ECM **or** Area ECM | `gunboat-ecm` | gunboat modifier `ecm` |
| 20 | Scatterpack | 0 (b) | Scatterpack technology | `gunboat-scatterpack` | gunboat type `scatterpack` |
| 21 | Plasma Bomber | 0 (b) | Plasma Bolt Launcher | `gunboat-plasma-bomber` | gunboat type `plasma-bomber` |
| 22 | Heavy or Screened Gunboat (+mod) | 1 | Gunboats | `gunboat-heavy` | gunboat modifier `heavy` |

**"Scatterpack technology" is the Scattergun.** There is no entry called Scatterpack anywhere in
15.1, which looks like a dangling reference until 7.14 settles it outright:

> "Scatterguns (also known as Scatterpacks) are a one-shot weapon derived from Gravitic/kinetic
> weapon technologies."

So `gunboat-scatterpack` bundles off `scattergun` — a citation, not a reading. The consequence is
worth noting because it is easy to miss: Scattergun's own prerequisite is Grapeshot, so a Scatterpack
Gunboat costs an empire Gunboats (1) + Grapeshot (1) + Scattergun (1) = 3 choices, more than any
other gunboat armament.

**"Standard missile technology" is the Salvo Missile Launcher.** 9.2's Missile Gunboat "carries a
salvo of 4 missiles", and the Salvo Missile Launcher is the only entry in the Ordnance list that
fires a salvo; Heavy Missiles (6.2) are single missiles and Antimatter Missiles are a warhead
option. The nearest-name reading is unambiguous enough not to need marking, but it is recorded here
because "standard missile" is not the name of any entry.

**ECM bundles off either ECM or Area ECM,** and since Area ECM itself bundles off ECM, the OR is
redundant as written — an empire that has Area ECM necessarily has ECM. Encoded as the printed OR
anyway; the module's expansion is a fixpoint, so a bundled entry gating on another bundled entry
resolves.

### Secondary ship systems

> "Secondary ship systems 1. Enhanced Sensors (0 technology choice) 2. Superior Sensors (1
> technology choice) 3. Minesweeper (1 technology choice) 4. Boat bay (0 technology choices)
> 5. Cargo holds (0 technology choices) 6. Troop and passenger berthing (0 technology choices)
> 7. Shipyard facilities (0 technology choices) 8. Marine Boarding Parties (0 technology choices)
> 9. Damage Control Parties (0 technology choices) 10. Ortillery (0 technology choices) 11. Weasel
> Emitters (0 technology choices)"

| # | As printed | Choices | Prerequisite | Tech id | Engine |
| --- | --- | --- | --- | --- | --- |
| 1 | Enhanced Sensors | 0 (u) | — | `enhanced-sensors` | `enhanced-sensors` |
| 2 | Superior Sensors | 1 | — | `superior-sensors` | `superior-sensors` |
| 3 | Minesweeper | 1 | — | `minesweeper` | `minesweeper` |
| 4 | Boat bay | 0 (u) | — | `boat-bay` | `boat-bay` |
| 5 | Cargo holds | 0 (u) | — | `cargo` | `cargo` |
| 6 | Troop and passenger berthing | 0 (u) | — | `berthing` | `troop-berthing`, `passenger-berthing` |
| 7 | Shipyard facilities | 0 (u) | — | `shipyard` | `shipyard` |
| 8 | Marine Boarding Parties | 0 (u) | — | `marine-party` | `marine-party` |
| 9 | Damage Control Parties | 0 (u) | — | `damage-control-party` | `damage-control-party` |
| 10 | Ortillery | 0 (u) | — | `ortillery` | `ortillery` |
| 11 | Weasel Emitters | 0 (u) | — | `weasel-emitter` | `weasel-emitter` |

Nine of eleven are free, which is the section saying that a tech base restricts *how an empire
fights*, not what it can carry. Ortillery bombards planets and Weasel Emitters spoof sensors, and
neither costs a choice; the only paid entries here are the sensor upgrade and the minesweeper.

---

## Prerequisites, as a graph

Prerequisites are stored as a conjunction of disjunctions — an AND of OR-groups — because five
entries need it:

| Entry | As printed | Groups |
| --- | --- | --- |
| Phasers | "prerequisites are Beams, and Grasers" | `[beams-1-3]` AND `[graser]` |
| Meson Projector | "comes free with either Twin Particle Array or Gatling Batteries" | `[twin-particle-array, gatling]` |
| Interceptor | "comes with standard fighter technology" | `[fighter-standard-beam, fighter-standard-gun]` |
| Multi-Role Fighters | "prerequisite is Standard and Attack Fighters" | `[fighter-standard-beam, fighter-standard-gun]` AND `[fighter-attack]` |
| Gunboat Gatling/Pulser | "either Gatling battery or Pulser technology" | `[gunboat]` AND `[gatling, pulser]` |
| Gunboat ECM | "comes with ECM or Area ECM technology" | `[gunboat]` AND `[ecm, area-ecm]` |

The deepest chain in the section is five entries long and costs seven choices:

    beams-1-3 (1) → graser (1) → gunboat-graser needs gunboat (1)

and, on the defensive side,

    grapeshot (1) → scattergun (1) → gunboat-scatterpack, needing gunboat (1)

with the longest *paid* chain being

    beams-1-3 (1) → graser (1) → phaser (1)   — three entries, three choices

and the most expensive single capability

    gravitic-gun (1) → spinal-psp (2)          — two entries, three choices.

---

## 15.2 Example Factions

> "Note: the examples presented here are not strictly the same as any of the published Fleet Books.
> They are merely presented here as examples."

Two factions are printed. Both tables are reproduced exactly as they appear, including their printed
TOTAL lines, and both are stored in the module with the row labels verbatim so a reader can check
the mapping.

### New Anglian Confederation

| Tech type (as printed) | #CHOICES | Mapped to |
| --- | --- | --- |
| BEAM WEAPONS CLASS 1, 2 AND 3 | 1 | `beams-1-3` |
| BEAM WEAPONS CLASS 4, 5, AND 6 | 1 | `beams-4-6` |
| STANDARD GRASERS | 1 | `graser` |
| PDS | 1 | `pds` |
| STANDARD SCREENS | 1 | `screens` |
| ADVANCED SCREENS | 2 | `advanced-screens` |
| SALVO MISSILE LAUNCHER | 1 | `salvo-missile-launcher` |
| PULSE TORPEDO | 1 | `pulse-torpedo` |
| SUBMUNITION PACKS | 1 | `submunition-pack` |
| STANDARD FIGHTER | 1 | `fighter-standard-beam` |
| TORPEDO FIGHTER | 1 | `fighter-torpedo` |
| **TOTAL** | **12** | computed from 15.1: **12** ✔ |

Every prerequisite is met: Grasers off the beams, Advanced Screens off Standard Screens, the
Torpedo Fighter off the Pulse Torpedo, the Standard Fighter off the beams. Nothing in the list has
an unmet parent, and the printed total is exactly what the master reference charges.

### Eurasian Solar Union

| Tech type (as printed) | #CHOICES | Mapped to |
| --- | --- | --- |
| BEAM WEAPONS CLASS 1, 2 AND 3 | 1 | `beams-1-3` |
| BEAM WEAPONS CLASS 4 AND 5 | 1 | `beams-4-6` |
| PDS | 1 | `pds` |
| STANDARD SCREENS | 1 | `screens` |
| SPINAL MOUNT BEAMS | 1 | `spinal-beam` |
| ATTACK FIGHTER | 1 | `fighter-attack` |
| STANDARD FIGHTER | 1 | `fighter-standard-beam` |
| INTERCEPTOR FIGHTER | 1 | `fighter-interceptor` |
| LONG RANGE FIGHTER | 1 | `fighter-long-range` |
| FAST FIGHTER | 1 | `fighter-fast` |
| ASSAULT SHUTTLES | 1 | `assault-shuttle` |
| **TOTAL** | **11** | computed from 15.1: **10** ✘ |

### Where the examples disagree with 15.1

Three disagreements, all of them in the Eurasian table, and all of them resolved in favour of the
master reference with the faction's printed figures preserved beside the computed ones.

**[reading] "BEAM WEAPONS CLASS 4 AND 5" is the Class 4, 5 and 6 entry.**
No entry in 15.1 sells classes 4 and 5 without 6, and the Eurasian table pays 1 choice, which is
exactly what "Beams, Class 4, 5 and 6" costs. The row is mapped to `beams-4-6` and its printed label
kept verbatim.
*The alternative, rejected:* invent a `beams-4-5` entry to match the label. That is a number — a
tech entry with a cost — that does not appear in the master reference, and section 15's whole point
is that the master reference is the catalogue.

**[reading] "INTERCEPTOR FIGHTER 1" contradicts "Interceptor (comes with standard fighter
technology)".**
15.1 gives the Interceptor away with either standard fighter; the Eurasian table charges 1 choice
for it, and the printed TOTAL of 11 depends on that charge — recompute the row costs from the master
reference and the Eurasian tech base comes to 10.
*The reading:* the master reference governs the catalogue. `fighter-interceptor` stays bundled at 0,
the Eurasian faction's `printedTotal` stays 11, and `validateTechBase` raises a **warning** naming
the difference rather than silently correcting either number.
*The alternative, rejected:* reprice the Interceptor at 1 choice so the example adds up. That
contradicts 15.1's own entry, and it would also change the New Anglian Confederation, whose printed
total of 12 is already correct and which does not list an Interceptor at all — the fix for one
example would break nothing there but would make the catalogue disagree with itself for no textual
reason. The Eurasian table is a worked example with an arithmetic slip; the catalogue is the rule.

**[reading] "STANDARD FIGHTER" is the Standard Beam Fighter, in both tables.**
15.1 has no generic standard fighter: it has "Standard Beam fighter (prerequisite is Beams)" and
"Standard Gun fighter (prerequisite is K-Guns)". Both example factions buy beams and neither buys
K-Guns, so the beam version is the only one whose prerequisite they meet.
*The alternative, rejected:* leave the row unmapped, or add a third generic entry. The first makes
both example factions fail prerequisite validation for no reason; the second adds an entry the
master reference does not have.

### What both examples have in common

- **Both printed totals exceed the recommended ten** (12 and 11), which is the strongest evidence
  in the section that ten is advice rather than a rule. Recomputed from the master reference the
  New Anglian Confederation still spends 12 and raises a budget warning; the Eurasian Solar Union
  comes to exactly 10 and does not — the one choice that would put it over is the Interceptor
  charge that 15.1 never makes. Neither is illegal either way.
- **Neither may field gunboats.** Both buy fighter technology, and 15.8's heading bars gunboats to
  an empire "using fighters". Every gunboat query against either faction returns false, with the
  heading quoted as the reason.
- **Neither buys armour, and neither buys ECM.** Nine of the New Anglian's twelve choices are
  weapons and screens.

---

## Where 15.1 and the engine's unions disagree

Section 15 is a catalogue and `src/engine/types.ts` is a catalogue, and they were written from
different parts of the book, so they do not line up. Everything below is recorded rather than
reconciled — the module never invents a tech entry to cover an engine symbol, and never invents an
engine symbol to cover a tech entry.

### In the engine, absent from section 15 — unbuyable under a tech base

| Engine symbol | Where it comes from | Consequence |
| --- | --- | --- |
| `WeaponClass` `'nova-cannon'` | 5.23 / 7.24 spinal mounts | 15.1's Spinal Mounts list has three entries and this is not one. No tech base can grant it. |
| `WeaponClass` `'wave-gun'` | 5.23 spinal mounts | Same. |
| `SystemKind` `'reflex-field'` | 7.20–7.22 cloaks | 15.1's defensive list names Cloaking Device, Cloaking Field and the Tuffley Cloak, and stops. |
| `SystemKind` `'dummy-bogey'` | 12.1/12.2 sensors | Not in the Secondary ship systems list. |
| `SystemKind` `'tender'` | 13.12 carrier plant | Not in Primary or Secondary. |
| `SystemKind` `'gunboat-bay'` | 9.1 "Bays are 24 mass" | 15.8 sells a Gunboat *Rack* and nothing else. |
| `FtlKind` `'tug'` | 11.3 | 15.1 sells FTL Drive and Advanced FTL Drives. |
| `WeaponVariant` `'two-stage'` | 6.6 optional multi-stage missiles | No tech entry. |
| fighter modifier `'light'` | 8.15, priced in 14.7 | 15.1's Fighters list has twenty entries and Light Fighter is not among them. |
| gunboat type `'point-defence'` | 9.2 PDS Gunboat, priced in 14.8 | 15.8 sells an "Area Defense" gunboat off ADS but has no entry for the plain PDS gunboat. |

`mayField` answers **false** for every one of these against every tech base, with a reason naming
15.1's silence rather than pretending the query was malformed. That is the honest answer: a system
the master reference does not list cannot be chosen, because choosing is all section 15 does.

### In section 15, absent from the engine — a tech entry with nothing to unlock

| Tech entry | What the engine lacks |
| --- | --- |
| `flak-ammo` (direct fire #21) | 5.16's flak ammunition is a per-K-gun option costing "+2 points per gun", not a `WeaponClass` or `SystemKind`. The engine has no field for it. |
| `pulse-torpedo-overloaded` (#14) | `WeaponVariant` has `standard`, `short`, `long`, `extended`, `two-stage` and `variable` — no `overloaded`. 5.14's Overloaded Pulse Torpedo (AP) has no variant to select. |
| `fighter-emp` (#9), `fighter-needle` (#13), `fighter-rocket` (#15) | `FighterTypeId` has ten members and none of these. 14.7 does not price them either, so this is the book disagreeing with itself, not the engine lagging. |
| `gunboat-emp` (15.8 #5), `gunboat-gravitic` (#14), `gunboat-boarding-torpedo` (#17) | `GunboatTypeId` has fifteen members and none of these. 9.2 does not describe them and 14.8 does not price them — again the book against itself. |
| `mines-standard` (ordnance #8) | Mines are carried by `mine-rack`; there is no separate handle. |
| `turrets` (direct fire #25) | `TurretDef` exists but is not a `SystemKind`, so the unlock is typed as its own kind. |
| `hull-standard` / `hull-advanced-3-row` | `HullRows` is a numeric union, not a system. Note that 15.1 governs *rows* only: `HullClass` (fragile … super, 13.7) is not a technology at all, so any empire may build any hull strength. |
| `fighter-package-deal` | Not a system: a budget rule. Its unlock list is empty and it is handled entirely in the cost model. |

### Things 15.1 does not govern at all

Core Systems (10.3), Flawed Design (13.13), emergency thrust (3.6), streamlining (13.11), hull class
(13.7), crew and additional damage-control parties beyond the free entry, starbases and monster
ships (13). None of them appears in any of the nine lists, so a tech base is silent on them and the
module does not gate them. `validateDesignAgainstTechBase` walks only what section 15 names.

---

## Where this document and `docs/rules/factions.md` disagree

`factions.md` was written from different sources — *Factions of the Continuum: A Campaign
Supplement* and *Faction Sourcebook: The Askvarian Hegemony*, both the user's own campaign material
— and describes fourteen factions with named traits, prohibitions and starting tech. This document
is section 15 of the rulebook and describes two. **Neither supersedes the other**, and nothing in
`factions.md` was changed:

| | `factions.md` | `techbase.md` (15) |
| --- | --- | --- |
| Source | Campaign supplements, outside the rulebook | *Project Continuum* §15, pages 125–127 |
| Factions | 14 (Goliath, Aethelgard, Chytrid, …) plus 4 Askvarian clans | 2 (New Anglian Confederation, Eurasian Solar Union) |
| Overlap | none — no faction is named in both | |
| Mechanism | four trait kinds (design / tactical / campaign / prohibition), applied per faction | one mechanism: a budget of technology choices with prerequisites |
| Restriction style | *prohibition*: a named system a faction may not field, on top of anything else it can build | *omission*: a faction may field only what it has chosen; everything else is simply absent |
| Enforcement | `designPricing.validateDesign()` (per `factions.md`) | `validateDesignAgainstTechBase()` in this module |

The two models are complementary and can be run together: a tech base says what an empire *may*
build, a prohibition removes something from what it otherwise could. They also disagree in emphasis
in one visible place — `factions.md`'s Sol-Federation Marine Corps has starting tech "gunboat racks,
beam gunboats, ADFC, pulsers" and a prohibition on hangar bays, which is 15.8's fighter/gunboat
exclusion arrived at from the other direction: the supplement forbids the carrier, the rulebook
forbids the purchase. A fleet built to that faction passes both checks.

One genuine conflict is worth naming rather than hiding. `factions.md` lists starting tech for
several factions that section 15 would price above the recommended ten if all of it were bought at
once (the Silent Sisterhood's "Tuffley cloak, needle beams, ECM, advanced FTL" is 1 + 1 + 2 + 1 = 5
choices before any weapon or screen, and the Tuffley cloak needs Stealth Fields, a sixth). Nothing
resolves this: the supplements were not written against a choice budget. Anyone running both should
treat `factions.md`'s starting tech as a tech base already chosen and set the limit to fit, which is
what "a number of choices as determined by their player group" allows.

---

## Readings, collected

| # | Reading | Rejected alternative |
| --- | --- | --- |
| 1 | A cost of 0 is either `universal` ("0 technology choices") or `bundled` ("comes with X"); bundled entries are free but gated | Every 0-cost entry is universal, per the preamble's letter — which hands every empire Area ECM, Salvo Missile Racks, Fighter Racks and Gunboat Racks with no parent system |
| 2 | A bare "Beams" prerequisite means `beams-1-3` | Requiring both beam entries, making a Graser cost 3 choices in practice |
| 3 | Every 15.8 entry from #2 on also requires `gunboat` | Reading #4–#22 literally, so an empire with Beams "has" Beam Gunboats without having gunboats |
| 4 | The fighter/gunboat exclusion is checked over the whole tech base, and any Fighters-category choice counts as "using fighters" | Reading "is using" per battle, which no design-time predicate can enforce |
| 5 | The Fighter Package Deal costs 3 and grants a poolable 6-choice allowance spendable only in the Fighters category, partial payment allowed | (a) six items at any cost; (b) atomic entries, making the package's value depend on purchase order |
| 6 | Ten is the default budget and exceeding it is a warning | A hard ten, which makes both of the book's own examples illegal |
| 7 | Eurasian "BEAM WEAPONS CLASS 4 AND 5" is `beams-4-6` | Inventing a `beams-4-5` entry the master reference does not have |
| 8 | Eurasian "INTERCEPTOR FIGHTER 1" is an arithmetic slip; the catalogue keeps the Interceptor bundled at 0 and the mismatch is warned about | Repricing the Interceptor at 1 choice to make the example add up, contradicting 15.1 |
| 9 | "STANDARD FIGHTER" in both faction tables is `fighter-standard-beam` | Leaving the row unmapped, or adding a generic standard-fighter entry |

Not readings, though they look like them, and each pinned by a test so nobody "fixes" them:
Flak Ammo has no printed prerequisite; Extended Range Salvo Missiles has no printed prerequisite;
Regenerative Armor has no printed prerequisite while Layered Armor does; the Scattergun's
prerequisite is Grapeshot and not the reverse; "Scatterpack technology" is the Scattergun, which
7.14 states outright; "standard missile technology" is the Salvo Missile Launcher, the only entry
that fires a salvo.

---

## Not implemented, and why

| Rule | Why |
| --- | --- |
| Charging a tech base against a points budget | Section 15 counts *technology choices*; 14 and 18.3 count *points*. They are separate currencies and the section never converts between them. `techBaseCost` reports choices; CPV stays with the construction tables. |
| Enforcing the tech base at fleet-list level | `validateDesignAgainstTechBase` checks one `ShipDesign`. A fleet is a list of designs, and the caller is the natural place to fold the results — this module holds no fleet type and inventing one would be spine work. |
| Flak Ammo, Overloaded Pulse Torpedoes, EMP/Needle/Rocket fighters, EMP/Gravitic/Boarding-Torpedo gunboats, Light Fighters, PDS Gunboats | Each is named in exactly one of section 15 and the engine's unions, never both. The tech entries exist where 15.1 lists them and carry no unlock; the engine symbols exist where the engine has them and no tech entry grants them. Both directions are tabulated above, and closing either one means changing a file this module may not touch. |
| Nova Cannon, Wave Gun, reflex fields, dummy bogeys, tenders, gunboat bays, FTL tugs, two-stage missiles | Same, in the engine-has-it direction. `mayField` refuses them for every tech base, which is the correct answer for a system the master reference does not sell, not a gap in the predicate. |
| Hull class, Core Systems, Flawed Design, emergency thrust, streamlining | Section 15 does not list them, so a tech base is silent and the design check does not gate them. |
| Prices in mass or points | Section 15 has none. Every number in this document is a count of technology choices. 14.1–14.8 is where mass and points live and nothing here duplicates it. |
| The published Fleet Books | 15.2 opens by disclaiming them: *"the examples presented here are not strictly the same as any of the published Fleet Books."* Only the two printed examples are encoded. |
| Sections 15.3–15.7 | They do not exist. The book numbers 15.1, then 15.8 inside it, then 15.2; the table of contents agrees. Nothing is missing from the extract. |
