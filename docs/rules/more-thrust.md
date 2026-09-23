# More Thrust — digest and comparison with the engine

*More Thrust* (Jon M. Tuffley, Ground Zero Games, 1994) is the first supplement to the second edition of Full
Thrust: 40 pages of new weapons and systems, optional rules, expanded fighters, planets and atmospheres, the
interface between space and ground games, tournament play, new designs, and the first two alien races, the
Kra'Vak and the Sa'Vasku. It predates Full Thrust: Continuum, the edition this engine implements, by many
years, so it is a source of **second-edition readings** (for the "second edition" rules preset) and of
**rules Continuum does not have** (the ground interface, the Sa'Vasku, the 1994 Kra'Vak).

How it was read: the PDF has a text layer but its two columns come out scrambled, so each chunk was digested
by one machine reader from the page images with the text beside it, then checked figure by figure against
the images by a second reader, who corrected it (each chunk ends with the checker's list, folded). Each chunk
closes with an **"Against the engine"** table saying, for every weapon, system and rule, whether the engine
already has it, has a different version, or lacks it; the checker spot-checked those claims against the
code. Page numbers are the PDF's, which match the printed pages. **The scan is the authority.**

The chapter that matters most is chunk 3, **Combining with ground combat games** (pp. 15–20): it converts a
ship's cargo mass into Dirtside II cargo space, prices drop capability and interface craft, puts orbital
bombardment on the Dirtside table in Dirtside's own damage chits, times a ship's passes overhead, sizes
marine contingents by hull, and kills embarked troops in proportion to a transport's damage. That is the
seam the campaign uses to hand a planetary battle to the ground game.

---

# Chunk 1 · pp. 1–8 · errata, new weapons and systems, optional rules

Source: *MORE THRUST*, the Full Thrust (2nd edition) supplement, Ground Zero Games, 1994.
ISBN 0-9521936-1-2. Compiled/Written by Jon Tuffley. Read from page images `mt-p01.png`–`mt-p08.png`
(the text layer in `mt.txt` is present but its two-column layout is scrambled, so all reading order
and every table below were taken from the images).

Pages covered: 1 (Contents/Credits), 2 (Introduction, Designer's Notes, Design Credits, Full Thrust
Errata), 3–4 (Section 2: New Weapons and Systems), 5–8 (Section 3: New Optional Rules, through
Squadron Operations; "Terrain" Effects on p.9 is out of range and not digested).

---

## p.1 — Contents and Credits

Standard front matter: table of contents for all 13 sections of the book, and the credits block
(Jon Tuffley — compiled/edited/written; Barrie Quin, Paul Copeland, Simon Parnell — artwork; Alderman
Printing & Bookbinding — printer; ISBN 0-9521936-1-2; First Edition 1994). No rules content.

## p.2 — Introduction, Designer's Notes, Design Credits, Full Thrust Errata

**Introduction / Designer's Notes.** More Thrust is a *supplement*, not an official rules
replacement: "very few of the rules herein are the dreaded 'OFFICIAL RULE AMENDMENTS' — this is a
compendium of IDEAS, for players to use (or not) as they see fit." Sections should "only be used to
supersede the originals IF you like them better," including the Competitive/Tournament rules later
in the book, which are offered as suggestions only.

**Design Credits.** Named contributors include Mike Elliott (Dirtside II interface), Jim Webster
(Hellfire interface/scenario), Phillip Gray (photos, ship designs), Steve Blease ("Liberté"
scenario), Garry Milton ("Assault on Starbase 13" scenario), plus a long list of other contributors.

**FULL THRUST ERRATA** (heading, printed with all four words deliberately misspelled as a joke about
the errata itself: *"or: SOMEWHURE IN THIS BOK YOU WILL FIND A DELIFERATE MASTIKE...."*):

1. On the photo on page 16, the letters identifying the two major ships are transposed — the one
   marked "A" is the Battleship referred to as "B" in the caption, and vice versa with the Heavy
   Cruiser. (Cosmetic; not a rule.)
2. The shaded boxes on pages 17 and 18 (right-hand column) both have the **same error** — page 18
   reads "...**5,6** = 1 damage point, 6 = 2 damage points." It should read "...**4,5** = 1 damage
   point, 6 = 2 damage points." The page 17 box (referring to fighters) has exactly the same error.
3. "There are a couple of other very minor typos" — deliberately not identified.

---

## p.3–4 — SECTION 2: New Weapons and Systems

### Missiles (p.3)

Unlike Pulse Torpedoes (assumed high-power plasma bursts, not projectiles), a **Missile** is "a
small, unmanned craft in their own right ... guided by an onboard AI." One-shot weapon, crossed off
the ship diagram when fired.

**Missile fire.** Launched in a special **Missile Phase**, after both players write orders but
*before* any ships move. Missiles are launched directly forward (along the firing ship's current
course) but may manoeuvre afterward. They move up to **18" per turn**, with a **2-point (60°)
course change allowed at the mid-point of movement**. A missile has a **"life" of 3 turns**, after
which it runs out of power, becomes inert, and is removed. Any ship may launch any number of
missiles per turn, up to the number it carries; each missile may have its own target (independent
AI/FireCon guidance).

**Missile attacks.** When a ship ends its plotted movement within 6" of an active enemy missile,
the missile may attack — resolved at the same point in the turn as fighter-group attacks (i.e. when
the ship itself fires, or after all other firing if the ship does not fire). Before the attack, the
target ship may try to intercept using any PDAF system, in a similar way to firing on fighter groups;
a PDAF (or ADAF) may attempt one missile interception per turn (and may not also be used against
fighters that same turn); a **roll of 6** is needed to kill the missile (versus lower rolls needed
against fighters — missiles are smaller/more agile).

**Warheads**, selected when the missile is built:

- **Normal**: assumed nuclear detonation. Rolls **2 dice**; total score = damage points inflicted.
  **NOT reduced by screens.**
- **EMP**: Electro-Magnetic Pulse, meant to scramble systems without structural damage. Roll 1 die,
  **subtract 1 per level of screens** the target has, then read the result:
  | Roll (after screen subtraction) | Effect |
  | --- | --- |
  | 1–2 | No effect |
  | 3–4 | Roll for EVERY system on the ship, as for a Threshold Roll; systems knocked out on 5 or 6 |
  | 5–6 | Roll as for a Threshold Roll, but systems knocked out on 4, 5 or 6 |
- **Needle**: like a Needle Beam, targets one specific system (chosen by the missile's owner) on
  the target ship. Roll 1 die: **1–3** misses the intended system but still does **ONE die-score**
  of normal damage (1–6); **4–6** hits the intended system, knocking it out **IN ADDITION** to
  doing 1 die of normal damage.

| System | Missile |
| --- | --- |
| Mass | 2 (per missile) |
| Points cost | 6 |
| Symbol | 3 variants: Normal, EMP, Needle |

### "AA" Megabatteries (p.3)

An experimental super-powered Beam system with extended range and damage:

| Range band | Dice rolled |
| --- | --- |
| 0–18" | FOUR dice |
| 18–36" | THREE dice |
| 36–54" | TWO dice |

Hits scored and screen deductions as normal beam fire. **Disadvantage**: on any single shot, if
**TWO or more ONES** are rolled, the battery overloads and burns out — no damage to the carrying
ship, but the weapon is out of action for the rest of the game (deliberately more likely to burn
out on short-range, higher-dice shots).

AA Batteries may only be fitted to **CAPITAL classes** (plus Superships and stationary
installations), and only to bear through a **SINGLE fire arc**.

| System | AA Megabattery |
| --- | --- |
| Mass | 5 |
| Points cost | 15 |

### Wave Gun (p.3–4)

A smaller, "slightly less over-the-top" variant of the Nova Cannon. Fires a plasma charge that
expands as it travels along the carrying ship's main axis only (straight ahead), causing damage to
everything in its path. As with the Nova Cannon: may not fire any other weapon that turn, and
counts as **unshielded through its entire frontal arc** while firing. Unlike the Nova Cannon, a ship
firing the Wave Gun **may still apply thrust or change course that same turn**.

Burst has a "life" of one turn; full range **36"**:

| Range band | Template diameter | Damage |
| --- | --- | --- |
| 0–12" | 2" | **4D6** |
| 12"–24" | 3" | **3D6** |
| 24"–36" | 4" | **2D6** |

No defences apply — "there are NO defences against Wave Gun fire — neither Screens nor Armour
reduce the damage inflicted."

**Charging**: each turn ordered to charge, roll 1 die and accumulate; when the running total
reaches **6 or more**, the weapon is fully charged and may be fired on any subsequent turn. Firing
totally discharges the capacitors (must recharge from zero again). If knocked out by a threshold
roll or a Needle Beam hit while charging/charged, the carrying ship suffers damage equal to the
**current charge** in the capacitors.

| System | Wave Gun |
| --- | --- |
| Mass | 10 |
| Points cost | 30 |

### Planetary Bombardment System / Ortillery (p.4)

Ground-support fire from orbiting ships/Monitors. **No function in Space Combat and cannot be used
as an anti-ship weapon.** Full mechanics given in the "Ortillery Fire" section of the Dirtside II
interface rules (p.17, out of range of this digest); if using a different ground-combat system,
relate it "with a little thought."

| System | Planetary Bombardment System (Ortillery) |
| --- | --- |
| Mass | 3 |
| Points cost | 10 |

### Reflex Field (p.4)

A variation on Screen technology: partially protects against energy-weapon attack (standard Beam
Batteries) and can *reflect* some of the attacking beam's energy back at the firer. Activated in the
carrying ship's written movement orders for any desired turn (opponent not told the Field's status
until it is fired on — may be too late for them). While active, the carrying ship **may NOT use any
weaponry of its own that turn**, though it may move/manoeuvre normally; other specialised actions
(launching/recovering fighters, etc.) are also prohibited.

When a ship with an active Reflex Field is fired on by beam weapons, roll for hits/damage normally,
then the target's owner rolls one die:

| Roll | Effect |
| --- | --- |
| 1 | No effect — full damage applied to target as normal |
| 2 | Field stops some damage — target receives only **HALF** normal damage (rounded up) |
| 3 or 4 | Field absorbs **ALL** the damage — none applied to target |
| 5 | No damage applied to target, but **HALF** (rounded up) is reflected back to the firing ship |
| 6 | Field reflects the **FULL** damage back to the firer |

| System | Reflex Field |
| --- | --- |
| Mass | 6 |
| Points cost | 40 |

### Cloaking Field (p.4)

Renders a ship totally invisible/undetectable to all sensors and visual scanning; the cloaked ship
also cannot "see out" while cloaked. To cloak, the player must note in that turn's orders that the
ship is cloaking, and the number of turns it will remain cloaked (e.g. "3 turns"); the ship model is
removed from the table and a marker placed at its location. The marker stays stationary while the
ship remains cloaked; the player continues writing normal movement orders for the (invisible) ship
each turn. After the declared number of turns elapses, the player returns to the marker and plots
out **all** the accumulated moves at once, placing the ship wherever it actually ends up (which may
put it only halfway into the next room if planning was off — the text's own joke, not a hex-grid
reference; Full Thrust movement is not hex-based). The number of turns must be
declared in advance specifically to stop players decloaking early just because a target has
wandered into range.

| System | Cloaking Field |
| --- | --- |
| Mass | 1 per 10 mass of ship |
| Points cost | 2 × mass of ship |

---

## p.5–8 — SECTION 3: New Optional Rules

### Basic Rules Revisions (p.5)

Discursive design commentary, not a numbered rule: acknowledges an "artificial split" in the
Escort/Cruiser/Capital mass classes lets a top-end cheap class sometimes out-perform a
bottom-end expensive class of the next bracket up. States the designer's preference is to **leave
the break points as they are** ("if you want to... build... a particular optimum class then go
ahead, but do not be surprised if a better tactician with a more balanced force beats you"), while
noting a separate house-fix (raising A/B battery cost relative to C battery) is possible if desired.
No new numbers are given here; the actual anti-fighter/anti-missile fix for "C" batteries follows
as its own rule below.

### Using "C" Batteries as Anti-Fighter/Anti-Missile Weapons (p.5)

The big Beam Batteries are too heavy for use against small, agile targets (fighters, and the
Missiles introduced above); "C" beams **may**, if desired, be permitted to fire in this defensive
role. When used this way, a "C" battery fires **as if it were a PDAF system**, using the same rules,
restrictions and range (**6"**) as PDAF — except it is **somewhat less effective**: it scores only
**1 kill on rolls of 5 or 6** (none on 4 or less) against fighters. Against **MISSILES**, a **6** is
required, exactly as for PDAFs.

On a turn a "C" battery is used defensively, it may **NOT** also fire in its normal anti-ship role
that turn.

Unlike PDAFs, a "C" battery used defensively **DOES require an operating FireCon** (it lacks
PDAF's built-in systems); however, **any number** of batteries may fire at **any number** of
different fighter/missile targets (up to 1 target per battery firing) using just the **ONE**
FireCon — e.g. a ship with 3 "C" batteries can engage up to 3 separate fighter groups or missiles in
one turn off a single FireCon.

### Sensors — Expanded Rules (p.5–6)

In the base rules, sensors are abstract: **PASSIVE** sensors (all ships) just give a rough contact;
**ACTIVE** sensors (all military ships) reveal the actual model/class on the table. This section adds
detail for what a *deliberate scan* with Active sensors can reveal, and grades Active sensors into
three tiers:

| Sensor Type | Mass | Cost |
| --- | --- | --- |
| BASIC* | Nil* | Nil* |
| ENHANCED | 1 | 15 |
| SUPERIOR | 2 | 30 |

\* Basic-level active sensors are inherent to all military ships at no extra Mass/Points cost.

**Scanning.** A scan is a deliberate act, once per turn per target (ship or bogey). Basic active
sensors just place the actual model on the table as before (per original rules). Enhanced or
Superior sensors additionally roll 1 die: Enhanced sensors use the die score as-is; Superior sensors
**ADD 2** to the die score. Apply the final adjusted score to:

| Die score | Result disclosed |
| --- | --- |
| 1–2 | No information disclosed |
| 3 | MASS only of ship disclosed, and whether Military or Merchant |
| 4 | Data on Mass, Propulsion and Screening systems (original values) |
| 5 | Data on ALL onboard systems (original values) |
| 6+ | As 5, PLUS current Damage Status and systems functional — ALL data about the vessel |

The scanned player must disclose the required info **verbally** (not by showing the record sheet),
once per successful scan; the scanning player must remember/note what he was told. In a competitive
game the umpire, not the opposing player, should check and relay the info to preserve trust.

### Sensor Jamming — Electronic Counter Measures (p.6)

If the expanded sensor rules above are used, ships may fit **ECM** to jam enemy sensor scans:

| System | Mass | Cost | Coverage |
| --- | --- | --- | --- |
| Individual ECM package | 2 | 20 | Protects the carrying ship only |
| Area-Effect ECM package | 3 | 30 | Protects itself + friendly ships within **12"** |

In general, Area-Effect ECM is only fitted to dedicated Electronic Warfare ships that would
accompany a flotilla of non-ECM-equipped vessels.

Individual ECM jams sensors aimed at the ship carrying it; Area-Effect ECM jams sensor scans aimed
at *any* friendly vessel within 12" of the ECM ship. While active use is on, the carrying (or
covered) ship also suffers the jamming effect if **it** tries to use its own active sensors to scan
(a "blanket effect," friend or foe). A ship's orders must note that ECM is active that turn, or it
is assumed switched off.

**Mechanic**: when an active ECM system (individual or area) is protecting a ship, the *scanning*
player rolls his sensor die as normal (per the Sensors table above), then the jamming player rolls
1 die, which is **SUBTRACTED** from the scanner's roll before applying the Sensors — Expanded table.
(Worked example: Superior sensors [+2] roll a 6 → 8 total; opposing ECM rolls a 1 → final result 7:
still enough to reveal everything.) If a player scans while effectively jammed by a **FRIENDLY**
ECM system, he rolls **twice**, subtracting the second roll from the (modified) first roll — i.e. the
first roll is the one that already carries the Enhanced/Superior sensor bonus, and the second roll
is subtracted from it.

### Damage Control (p.6–7)

The original rules had **no provision** for repairing systems mid-battle. This rule adds **Damage
Control Parties (DCPs)** to each ship's crew:

| Ship class | Normal (free) DCP complement |
| --- | --- |
| Escorts, Corvette-class and above (Scouts, Couriers, Fighters excluded — no crew to spare) | 1 |
| Cruisers | 2 |
| Capital Ships | 3 |

Additional teams may be bought, up to **TWICE** the basic (free) allowance, at a **Points Cost of 10
per additional DCP** — e.g. a Capital ship could carry a maximum of **6** DCPs total, for an extra
cost of **30 points**. DCPs consume no Mass (part of the normal crew, with extra training).

| System | Damage Control Party (Additional) |
| --- | --- |
| Mass | Nil |
| Points cost | 10 |

**Procedure.** At the end of each turn, before writing next turn's orders, both players may attempt
Damage Control rolls for any ship that has lost systems to a Threshold check. DCPs **cannot** repair
lost structural hull Damage Points, nor repair systems knocked out by **Needle Beams** or other
"selective" weaponry.

Each DCP may attempt to bring **ONE** system back on-line per turn; multiple DCPs may be allocated
to the same job to raise the odds. **For each DCP working, roll one die: a roll of 6 brings the
system back online.** A failed repair may be re-tried next turn; all DCPs on one ship must be
allocated for that turn before results are known (can't roll one DCP, see the result, then decide
where to send a second). A repaired system may fail again at a later Threshold point exactly as any
other system, and a DCP lost to a Threshold roll is permanently gone (cannot be "repaired" by
another).

A successful Damage Control roll on a ship's **Drives** repairs only **HALF** the drive strength;
**TWO** rolls of 6 (same or different turns) are needed to bring a fully-out drive back to full
power.

### Boarding Actions (p.7–8)

A Boarding Party is normally part of the attacking ship's Marine contingent (Combat Vacc Suits or
Powered Armour). To launch a boarding action, the attacking ship must close to within **6"** of the
target at the **end** of the turn's movement, travelling at a velocity within **1 factor** of the
target's velocity, and on a course within **1 point (30°)** of the target's course. (Worked example:
target ends at velocity 6 course 4 → attacker must end within 6" at final velocity 5–7 and course
3–5.) Marines cross between ships in small assault pods, or in their own Powered Armour suits.

**Marine strength.** Reasonable assumption: not all of a ship's Marine detachment (1 man per MASS of
the ship, per p.17) is available for boarding — some stays back for ship security. A Warship may
launch a boarding party with strength of **1 man per 2 MASS** of the ship — or, in the page's own
words, **1 man per Damage Point the ship has** (since a ship's Damage Points equal half its Mass) —
e.g. a Heavy Cruiser has a 16-man boarding unit, a Battleship 24 men.

If the boarding ship has taken damage, assume crew (and Marine) casualties in proportion: available
troops = **CURRENT damage points remaining** on the ship. This strength is divided into **4-man
Teams** (rounding down); the number of Teams is the **Boarding Factor** of the assault force (e.g. 4
for a Heavy Cruiser, 6 for a Battleship — i.e. Boarding Factor = current Damage Points ÷ 4, rounded
down).

**Defenders.** To find the target's Defensive Factor: if a Military vessel, **1 Defensive Factor per
4 remaining Damage Points**; if a Merchant craft, only **1 Defensive Factor per 10 remaining Damage
Points** (far fewer/poorer-armed crew).

**Resolving combat.** Roll 1 die per Factor per side and total. If either side's total is **MORE
THAN TWICE** the other's, that side wins outright. Otherwise, the **lower-scoring** side loses **1
Factor**, and both sides roll again (if this leaves a side with 0 Factors, it has lost). Combat
repeats in rounds until one side is clearly the winner. Worked example: Attackers roll 2,5,1,3 = 11
(4 factors); Defenders roll double-6 = 12 (2 factors) — not more than double, so the lower-scoring
Attackers drop to 3 Factors and re-roll against the Defenders' 2.

If the Attackers lose and are repulsed, they may return **HALF** (rounded up) of their surviving
Factors (Teams) of Marines to their own ship; the remainder are captured or killed in the withdrawal.
If the Defenders lose, the ship is "locked below decks" and a prize crew is sent from the attacker to
take full control. The entire action resolves within the **one** game turn (does not carry over
multiple turns).

### Fleet Morale (p.8)

If playing a simple engagement or competitive game, it is suggested that the loss of **50%** of a
player's overall force (**calculated in MASS of ships destroyed**) is enough to cause the commander
to withdraw from battle. For other game types, the loss threshold to force withdrawal should be
written into the scenario, bearing the storyline in mind.

### Striking the Colours (p.8)

Distinct from a fleet-wide withdrawal: an individual ship's captain may decide to surrender. Make an
**extra roll** at the same time as each Threshold check, using the **normal Threshold scores for
losing systems** (i.e. **6** the first time, **5 or 6** the second time, etc.); if the ship **fails**
this roll, its captain "strikes the colours" and offers surrender to the **nearest enemy vessel**.
Whether the surrender is **accepted** is up to the opposing player. This can result in a relatively
undamaged ship surrendering — deliberately modelled on naval-history precedent for prematurely
struck colours. Use of this rule is strongly dependent on which two fleets are fighting (using the
GZG background, a Human ship would be very unlikely to attempt surrender to a Kra'Vak, or
vice-versa, as neither expects to survive capture).

### Squadron Operations (Large Fleets) (p.8)

A "shortcut" for large multi-player games with several dozen ships per side: divide fleets into
**Squadrons** of several ships that then move and fight as cohesive units (especially suited to
groups of smaller escort ships, though larger ships may squadron too). A Squadron moves together
using **just one movement order** — all ships change velocity/course together, keeping formation.
**Procedure**: the player plots the move for **ONE** ship in the squadron (the leading ship, or one
in the middle of the formation, as desired); the rest of the squadron are then placed in suitable
relative positions to the moved ship, retaining formation. (Requires tolerance between players when
a particular placement is critical to range/arc of fire — for that reason, squadron movement is
specifically **NOT recommended for competitive or tournament play**.)

Worked example: a fleet of 4 capital ships, 6 cruisers and 20 assorted escorts could be organised as
2 cruiser squadrons of 3 ships each, escorts divided into 3–4 squadrons, and the capitals operating
individually or as one "Battle Squadron" (or split among task groups, each group then manoeuvring
at the rate of its **least agile ship**). Firing may optionally also be done by squadron/group (all
ships in a squadron fire at once) rather than ship-by-ship as in the normal rules — left to personal
preference.

---

## Against the engine

Engine sources consulted: `docs/rules/*.md` (Full Thrust: Project Continuum v1.1.4, the edition the
engine implements) and `src/engine/*.ts`, `src/data/*.ts`.

| MORE THRUST item (p.) | Kind | Engine status and numbers |
| --- | --- | --- |
| **Missile** (p.3): AI drone, Mass 2/pt 6, moves 18"/turn on table, 3-turn life, 2d6 undegraded-by-screens damage, PDAF kills on 6, EMP/Needle warhead variants | **differs-from-engine** | Engine's ordnance (Continuum 6.2–6.10, `ordnance.ts`) is a different weapon family: a Salvo Missile Launcher/Heavy Missile is placed at a fixed point of aim when fired (phase 3), sits inert, then homes on the nearest ship within 6 MU after ship movement (phase 5) and is shot at by point defence (phase 9) before dealing 1D6 (salvo, SAP) or 3D6 (Heavy Missile, SAP) damage — it never independently manoeuvres 18"/turn like More Thrust's AI drone. The **Heavy Missile (standard)** entry in `buildCatalog.ts` is coincidentally **Mass 2 / Points 6**, matching this page's box exactly, but the mechanic is unrelated. No EMP or Needle missile warhead exists anywhere in the engine (`grep` for `emp-missile`/`needle-missile` finds nothing) — those two variants are **new-to-engine**. |
| **"AA" Megabattery** (p.3): Mass 5/pt 15, 4/3/2 dice at 0–18/18–36/36–54", burns out on 2+ ones, Capital-only, single arc | **new-to-engine** | No `MegaBattery`/"AA battery" system exists anywhere in `src/` (`grep -ri megabattery` and `grep -ri "AA.?Battery"` both return no matches). The engine has no ranged-tiered, self-disabling super-beam system. |
| **Wave Gun** (p.3–4): Mass 10/pt 30; 36" range; 4D6 at 0–12", 3D6 at 12–24", 2D6 at 24–36"; no defence; charges on accumulated d6≥6 | **differs-from-engine** | Engine implements the Wave Gun (Continuum 7.24, `ew.ts`, `wavegun.test.ts`) with the **identical** range bands and damage dice (4D6/3D6/2D6 at 0–12/12–24/24–36 MU) and the identical "may still thrust/turn, unlike Nova Cannon" rule — but at **Mass 12 / Points 36** (`buildCatalog.ts` line 132), not this page's Mass 10 / Points 30. The engine version also lets Advanced Screens reduce Wave Gun damage (-1 DRM/die), which this page does not mention (screens/armour are said to have no effect at all here). |
| **Planetary Bombardment System / Ortillery** (p.4): Mass 3/pt 10, no space-combat use | **differs-from-engine** | `buildCatalog.ts` line 158: `ortillery`, **Mass 3 / Points 9** — mass matches exactly, points cost is 1 lower than this page's 10. The referenced Dirtside-interface deviation mechanic (p.17, out of scope here) is present almost verbatim in `docs/rules/dirtside.md` line 2647 ("fire-support from spacecraft... satellites or gun-platforms in orbit... fire CAN deviate from this intended target"), confirming the engine's Ortillery derives from the same More Thrust text. |
| **Reflex Field** (p.4): flat Mass 6/pt 40; 1-6 table (no effect / half / absorb / absorb+reflect half / reflect full) | **differs-from-engine** | Engine implements Reflex Field (Continuum 7.25, `ew.ts` `rollReflexField`) with the **exact same 6-entry damage table** (1 no effect, 2 half rounded up, 3–4 absorbed, 5 absorbed+half reflected, 6 full reflected) and the same firing restrictions (no weapons that turn; may move/manoeuvre) — but costs **10% of ship mass (Mass) and 6 points per mass point** (a scaling formula), not this page's flat **Mass 6 / Points 40**. Also notable: a comment in the engine's own `techbase.ts` records that the engine's Reflex Field `SystemKind` is not in Continuum's own Secondary Systems purchase list at all — "cannot be bought by anyone" in that edition's design rules — and the campaign layer (`turn.ts` `CAMPAIGN_BANNED_SYSTEMS`, which lists `reflex-field` by name) bans it outright. |
| **Cloaking Field** (p.4): Mass = ship mass ÷ 10 (scales), Points = 2 × ship mass; on/off marker system, turns declared in advance, no damage boxes mentioned | **differs-from-engine** | The engine has three different cloaks (Continuum 7.20–7.22). Its own system literally named **"Cloaking Field" (7.21)** is Mass **1 (flat)**, Points **= 100% of ship mass**, and unlike this page, has **two damage boxes** that degrade it to a partial cloak if one is lost. The engine's **"Tuffley Cloak" (7.22)** — named for this book's own author, Jon Tuffley (credited p.1–2) — is the closer mass match, at **Mass = 10% of ship mass**, but its cost is **10 points per mass point of the cloak** (≈1× ship mass overall), not this page's 2× ship mass. Neither engine cloak matches this page's numbers exactly, and the marker/advance-declaration mechanic described here maps to the engine's *total*-cloak handling (7.21/7.22), not its partial "Cloaking Device" (7.20, on-table, shootable at ×2 range/−2 DRM) which this page does not describe at all. |
| **Basic Rules Revisions** (p.5): design commentary on Escort/Cruiser/Capital break points and A/B/C battery cost-effectiveness | **rule** (no numbers to compare) | Discursive designer's note, not a codified rule; the engine's mass-class thresholds (Escort/Cruiser/Capital) and weapon-class costs are a fixed part of `techbase.ts`/`designPricing.ts` and are not adjustable per this page's suggested house-fix. |
| **"C" Battery as anti-fighter/anti-missile** (p.5): fires as PDAF at 6" range; kills 1 fighter flat on 5–6 (none on 4−); needs 6 vs missiles; loses its anti-ship shot that turn; needs a FireCon but 1 FireCon covers unlimited "C" batteries against unlimited separate targets | **differs-from-engine** | Continuum's closest analogue (8.8, `fighters.md`) lets **Beam-1** weapons serve as point defence against fighters: kills on **5 or 6, with a re-roll (and a possible second kill) on a natural 6** — better odds than this page's flat "1 kill on 5–6" — and, matching this page, a Beam-1 used for PD "may not fire in the Ship Fire Phase" that turn. But the engine text also says "**Beam-1s may not be used for area defense**," which does not reproduce this page's specific allowance of one FireCon covering fire from several separate "C" batteries at several separate targets simultaneously. Point defence against **missiles** in the engine (Continuum 6.4) uses its own salvo/heavy-missile kill tables (`dice.ts` `pointDefenceKills`), not a flat "6 to kill" rule tied to the anti-fighter beam. |
| **Sensors — Expanded Rules** (p.5–6): tactical, per-scan die table; Basic free, Enhanced Mass 1/pt 15, Superior Mass 2/pt 30; scan die (+0/+2) read off a 1–2/3/4/5/6+ ladder | **differs-from-engine** | The engine has systems named `enhanced-sensors` and `superior-sensors` (`techbase.ts`), but priced at **Mass 2 / Points 8** and **Mass 4 / Points 16** respectively (`buildCatalog.ts` lines 149, 165) — both double this page's Mass and roughly half its Points. More fundamentally, the engine's campaign-layer intel roll (`campaign/intel.ts` `SensorGrade` — actually typed `'none' | 'advanced' | 'superior'`, not `'enhanced'`, though a code comment there notes the `+1` grade is "the same fit" as the tactical layer's `enhanced-sensors` under a different name; `SENSOR_BONUS`) is a **strategic, between-battles spying roll** (a 2d6 "information ladder": 7 or less nothing, 8 ship counts, 9 hull categories, 10 hull masses, 11 class designations, 12+ full identity) — not a **tactical, once-per-turn ship-to-ship scan** resolved on a d6 with a 1–2/3/4/5/6+ table as this page describes. The two systems share only their names and general "better sensor = more info" concept. |
| **Sensor Jamming / ECM** (p.6): Individual Mass 2/pt 20 (self only), Area Mass 3/pt 30 (12" radius); jamming die subtracted from the *scanner's* sensor-table roll | **differs-from-engine** | Continuum's ECM (7.18–7.19, `ew-and-cloaks.md`) is **Mass 1 per level / 3 points per mass** for individual ECM and **Mass 2 per level / 3 points per mass** for Area ECM (radius **6 MU**, not 12"), and works by subtracting flat amounts from **sensor de-blip range (−6 MU/level)** and **missile/fighter/gunboat lock-on range (−1 MU/level)** — explicitly **no to-hit DRM** and no interaction with any scan die-roll. This page's mechanic (an opposed die roll subtracted from the scanning player's Sensors-table result) does not exist in the engine at all; the two ECM systems are conceptually related (jam the enemy's sensors) but mechanically distinct, with different Mass/Points and different effects. |
| **Damage Control** (p.6–7): free DCPs by class (Escort+ 1, Cruiser 2, Capital 3), buyable to 2× at 10 pts/DCP (Mass nil); one d6 per DCP, success on a 6; can't fix hull or Needle-Beam kills; drive needs 2 successes for full repair | **differs-from-engine** | The engine already has Damage Control Parties (`damage-control-party` `SystemKind`, `damageControlRoll()` in `dice.ts`) and, matching this page, **cannot repair systems a Needle Beam destroyed** (`docs/rules/threshold.md`) — but its actual roll is **one d6, success if the result is ≤ the number of parties assigned (capped at 3)**, not this page's "one d6 per DCP, each needing a natural 6." For 2 parties this gives the engine a 2-in-6 (33%) success chance versus this page's ~2.8-in-6 (30.6%, 1 − (5/6)²); for 3 parties, 3-in-6 (50%) versus ~4.2-in-6 (42.1%, 1 − (5/6)³). The engine also has no costed "buy extra DCPs at 10 points each, up to double" system in `buildCatalog.ts`, and no special half-strength/two-successes-for-full-repair rule for Drives is present in the reviewed damage-control code. |
| **Boarding Actions** (p.7–8): abstract Boarding Factor = current Damage Points ÷ 4 (attacker), Defensive Factor = remaining DP ÷ 4 (military) or ÷ 10 (merchant); opposed dice-pool totals, "more than double wins," else loser drops 1 Factor and re-rolls | **differs-from-engine** | Continuum's boarding (12.7, `boarding.ts`/`boarding.md`) is a completely different, per-unit system: each Boarding Party/Marine is a single indivisible counter, not a pooled "Factor." Defending **DCPs** kill an attacking unit on **6** (1 DCP), **5–6** (2 DCPs), or **4+** (3 DCPs, the engine's hard cap); a defending **Marine** kills an attacking unit on **4+** solo; an attacking unit (Marine or DCP-as-boarder) kills a defending Marine on **4+**. There is no "roll dice equal to a mass-derived Factor and total the score" mechanic anywhere in the engine's boarding code — the whole resolution shape (pooled dice vs. per-counter kill tables) differs from this page. |
| **Fleet Morale** (p.8): 50% of a side's force **mass** destroyed → suggested withdrawal; not a die roll | **already-in-engine** | Continuum 12.8 (`boarding.md`) is a near word-for-word match: "the loss of **50%** of a player's overall force (calculated in **mass** of ships destroyed) would be enough to cause the commander to withdraw from battle" — reproduced by `fleetMorale()`, which reports the threshold crossing (not a die roll) and takes the 50% fraction as a per-scenario option, exactly as this page allows ("for other games... written into the scenario"). |
| **Striking the Colours** (p.8): extra roll at each Threshold check, same score ladder as losing systems (6 first time, 5–6 second, etc.); failure = surrender to nearest enemy, acceptance optional | **already-in-engine** | Continuum 12.9 (`boarding.md`) quotes this rule almost verbatim, including the identical die-ladder (6 / 5–6 / 4+ / 3+ / 2+ for 1st–5th hull row lost) and `strikeColorsTarget(rows) = 7 − rows`. The engine adds a `noQuarterWith` refinement (a crew that expects no quarter never rolls) that is not on this page (it appears to draw on this book's later Xeno File sections, out of the pp.1–8 range digested here). |
| **Squadron Operations (Large Fleets)** (p.8): any-size squadron, one order moves the group, lead ship can be anywhere in the formation, no stated thrust/drive restriction, explicitly *not* for competitive play | **already-in-engine**, extended | Continuum 3.7 (`movement.md`) keeps the core idea (one order for the whole squadron; the rest keep the lead's relative position) but **codifies it much more tightly** than this page: squadron size is capped at **2–4 ships** (or one large ship + up to 6 escorts) in one of four named formations (line ahead/abreast, wedge, diamond); thrust is **restricted to the squadron's lowest current drive rating**; squadrons **cannot mix standard and Advanced Drives**; and a ship that "cannot keep up... is considered destroyed" (a straggler rule this page never states). This page's looser, no-size-limit, no-drive-restriction version (and its explicit "not recommended for competitive or tournament play" caveat) is not what the engine implements. |
| **Full Thrust Errata #2** (p.2): beam damage table correction, "4,5 = 1 damage point, 6 = 2 damage points" | **errata** — confirmed in engine | `dice.ts` `beamDamage()` implements exactly this corrected table for an unscreened target: face 4 or 5 → 1 damage, face 6 → 2 damage (screened cases shift the thresholds up by level). The engine's damage table matches the **errata's corrected** reading, not the erroneous printed text it was fixing. |
| **Full Thrust Errata #1** (p.2): p.16 photo caption transposes ship "A"/"B" labels | **errata** — not engine-relevant | Purely a photo-caption/physical-book error; no game rule or number involved. |

---

<details><summary>Checker's corrections</summary>

Checked page-by-page against `mt-p01.png`–`mt-p08.png` (the text layer in `mt.txt` was not used, per
the digest's own note that its column order is scrambled). All Mass/Points/dice/range numbers in
every system box and table on pp.1–8 were re-read directly off the page images and matched the
digest; the following wording, omission and citation problems were found and fixed. No content on
pp.1–8 was found that the digest fabricated wholesale, and no rule content was missing entirely —
the errors below are wording/attribution slips and a handful of omitted secondary sentences.

**Wording/transcription fixes (p.2–7):**

1. **p.2, Errata heading** — the digest silently "corrected" the spelling of the joke heading, giving
   *"or: somewhere in this book you will find a deliberate mastike...."* The page actually prints
   **four** deliberately misspelled words (the joke is that the errata notice itself contains an
   error): *"or: SOMEWHURE IN THIS BOK YOU WILL FIND A DELIFERATE MASTIKE...."* ("somewhere"→
   "somewhure", "book"→"bok", "deliberate"→"deliferate", "mistake"→"mastike"). Restored the actual
   printed (mis)spelling since the digest presents it as a direct quote.
2. **p.3, Missile attacks** — the digest said the target ship may intercept a missile "exactly as for
   fighter defence." The page says only "in a similar way to firing on fighter groups," not "exactly
   as" — softened to match.
3. **p.4, Cloaking Field** — the digest wrote that a mis-planned decloak may leave the ship "halfway
   into the next **hex**/room." The page says only "halfway into the next **room**" (a joke about the
   ship's marker literally ending up off the table) — Full Thrust has no hex grid, so "hex" was an
   invented word. Fixed to "room" and noted this isn't a hex-grid reference.
4. **p.6, ECM / friendly jamming** — the digest wrote "subtracting the second **(modified)** roll from
   the first," but the page says "subtracting the second roll from the **(modified) first** roll" —
   i.e. the *first* roll (which already carries the Enhanced/Superior sensor bonus) is the modified
   one, not the second. The digest had swapped which roll the parenthetical modifies; corrected and
   spelled out which roll is which.

**Omissions restored (content on the page that the digest left out):**

5. **p.6, ECM table** — the page states "Area-Effect ECM is only fitted to dedicated Electronic
   Warfare ships that would accompany a flotilla of non-ECM-equipped vessels"; this sentence was
   missing from the digest and has been added back.
6. **p.7, Boarding Actions / Marine strength** — the page states that a Warship's boarding strength of
   "1 man per 2 MASS" is "in other words 1 man per Damage Point the ship has" (i.e. Damage Points =
   Mass ÷ 2 in this system). The digest gave the "1 man per 2 MASS" figure but dropped this explicit
   equivalence, which is the detail that makes the next paragraph's "available troops = current
   Damage Points" rule click into place. Restored.

**"Against the engine" section — spot-checked against the repository, 4 citation/naming errors found
(the underlying numeric claims were all verified correct: `buildCatalog.ts` lines 132, 149, 158, 165
all check out exactly as stated, as do the `ew.ts` Wave Gun/Reflex Field/Cloak cost constants, the
`dice.ts` `beamDamage()`/`damageControlRoll()`/`pointDefenceKills()` functions, the `boarding.ts` kill
targets and `strikeColorsTarget`/`fleetMorale` functions, the `docs/rules/movement.md` squadron caps,
and the `docs/rules/dirtside.md` line 2647 Ortillery quote):**

7. **Wave Gun row** — cited the implementation as living in `weapons/beams.ts`; `grep` shows no Wave
   Gun code there at all. The Wave Gun (spec, costs, damage bands) is actually in `src/engine/ew.ts`.
   Fixed the file reference; `wavegun.test.ts`'s own location is `src/engine/wavegun.test.ts`, not
   nested under `weapons/`, which the digest's phrasing also implied — now written as a bare filename
   to avoid that implication.
8. **Reflex Field row** — cited `rollReflexField` as living in `techbase.ts`; it is actually defined
   in `src/engine/ew.ts` (confirmed by `grep -n "export function rollReflexField" src`). Fixed.
9. **Reflex Field row** — attributed the "cannot be bought by anyone" quote to `docs/rules/techbase.md`
   (the prose docs); it is actually a code comment inside `src/engine/techbase.ts` line 578. Fixed the
   citation to point at the source file rather than the docs file.
10. **Sensors — Expanded Rules row** — described the campaign layer's strategic sensor grades as
    "Enhanced/Superior," but `campaign/intel.ts`'s `SensorGrade` type is actually
    `'none' | 'advanced' | 'superior'` — the middle grade is named `advanced`, not `enhanced`, in that
    file (a code comment there does note it is "the same fit" as the tactical layer's
    `enhanced-sensors`, which is presumably where the digest's word choice came from). Corrected the
    naming and kept the note about the two layers sharing a concept under different names.

</details>

---

# Chunk 2 · pp. 9–14 · expanded fighters, planets and atmospheres

Source: *Full Thrust: More Thrust* (GZG, 2nd-edition supplement, 1994), text layer
`/tmp/claude-0/-home-user/b4c2eaa8-67cf-5a8e-844a-e5559c6a5d7d/scratchpad/stargrunt/mt/mt.txt`
(page markers `===== PAGE N =====`, PDF page = printed page), cross-checked page by page against
the page images `mt-p09.png`–`mt-p14.png`. Printed page numbers match PDF page numbers throughout
(p.9 through p.14).

**A note on the source text.** Pages 9, 10 and 11 extract in correct column order (left column
top‑to‑bottom, then right column). **Pages 12 and 13 do not.** On p.13 the extractor pulled the
right‑column paragraph beginning *"When in orbit, a ship must be travelling…"* out and placed it
immediately after the page's section header, ahead of the left‑column heading **"PLANETS AND OTHER
LARGE BODIES:"** that actually opens the page. On p.12 the extractor interleaves the columns
mid‑paragraph: the tail end of the **ATTACK FIGHTERS** entry ("...with rolls of 3 or 4, and 2 DP
with 5 or 6. Because anti-ship capabilities...an additional 6 points...") is pulled out of the top
of the right column and dropped immediately after **THE TROUBLE WITH TURKEYS** on the left column,
ahead of the SYMBOLS box and the **ADVANCED AND SPECIALISED FIGHTER TYPES** / FAST / HEAVY /
INTERCEPTORS / ATTACK FIGHTERS entries that actually precede it on the page (confirmed against the
image: left column runs Turkeys → Symbols box → Advanced and Specialised heading → Fast → Heavy →
Interceptors → Attack Fighters, cut off mid-sentence at the column break; right column continues
that sentence, then Long-Range → Torpedo → photo → closing notes). The reading below follows the
image (left column, then right column) for both pages; the true order for p.13 is given in full
under p.13, and the Advanced/Specialised Fighter Types table below already reflects the correct
p.12 assembly, not the raw extraction order.

---

## p.9 — Section 3, New Optional Rules (cont.): "Terrain" effects

Carried over for completeness since it falls inside the requested page range, though it is not one
of the two named topics.

- **Dust clouds or nebulae** (p.9): (i) travel through a cloud is capped at a **maximum safe
  velocity of 12**; exceeding it risks damage — roll **1 die**, apply as for **Beam weapons fire**;
  **Screens offer no protection, but Hull Armour does**. (ii) Dust inhibits beam fire and lock-ons:
  after nominating a target in/through a cloud, roll a die — **1–3** fails (target may not be fired
  at), **4–6** the shot may be fired, but if using Beams treat the target as **one Screen level
  higher** (Screen levels **above 3 remain at 3**). Note: this rule may also be used to simulate the
  effects of ships operating in the **very fringes of a planetary atmosphere**, such as when
  "skimming" Gas Giants.
- **Solar flares** (p.9): any ship caught in a flare rolls **1 die per FireCon and per Sensor
  system** (Sensor systems only if advanced sensor rules in use), **+1 per active Screen level**;
  **4+ = undamaged**, otherwise the system is knocked out.
- **Meteor swarms and debris** (p.9): areas of **6"–12" diameter**; a ship entering/hit rolls **1 die
  per FULL 6" of velocity** — velocity **0–5 = no damage, 6–11 = 1 die, 12–17 = 2 dice**, etc.; may
  also model planetary ring debris.
- **Battle debris** (p.9): a destroyed ship (0 DP or less) may explode. Note **excess damage**
  (damage beyond what was needed to reach zero) and roll a die: **roll ≤ excess ⇒ explodes**.
  Worked example: 2 DP left, +5 damage ⇒ excess 3 ⇒ **3 or less** explodes. Debris cloud diameter:
  **Escort 2", Cruiser 4", Capital Ship 6"**; lasts **1 turn**, moves on the dead ship's last
  course/velocity, and is treated as a Meteor/Debris field for that turn only.

---

## pp.10–12 — Section 4: Expanded Fighter Rules

### Optional Fighter Turn Sequence (p.10)

Move the **Fighter Movement Phase** from the **end** of the turn to **before** all ship movement
(but still after both players write movement orders). No written orders for fighter groups (except a
launch note in the carrier's orders). If both sides have fighters active, alternate moving groups,
**starting with whoever has the most groups in flight**. To attack, a group must end movement within
**6"** of the target and in its forward arc.

### Fighter Group Morale (p.10)

Before a fighter group that has **lost one or more members** attacks, roll **1 die**: result **≤
fighters remaining ⇒ attack proceeds**; **> remaining ⇒ attack aborted**, no fire, group holds
position and may try again next turn. **THREE consecutive failed attack rolls** (same or different
targets) ⇒ **morale broken**: the group must disengage and return to its carrier by the fastest
route and **may not attack again that game**. (If the Endurance rule is also in use, a failed/aborted
attack roll does **not** spend an endurance turn; a morale break spends **all** remaining endurance.)
**Ace-crewed groups subtract 1** from every morale roll; **"Turkey" groups always add 1** (so even a
full-strength group of 6 fails on a roll of 6+1=7).

### "Scrambling" Fighter Groups (p.11)

Only when an enemy fighter group has just moved into position to attack the carrier itself, and only
if the carrier still has groups aboard. Roll **1 die**:

| Roll | Result |
| --- | --- |
| 1 | Mishap: one fighter bay (and its fighters) out of action for the rest of the game, unless Damage Control (P.6) fixes it |
| 2–3 | No groups launch this turn |
| 4 | One group launches too late — attackers fire on the carrier first, then the scrambled group may attack |
| 5 | One group scrambles in time to intercept — dogfights the attackers before they can fire on the carrier |
| 6 | **TWO** groups scramble in time to intercept |

The "6" result (two groups) is capped by the carrier's real launch capacity — a ship able to launch
only one group per turn can only scramble one, even on a 6.

### Fighter Endurance (p.11)

A normal fighter group has **THREE turns** of "active" (combat) operation as its fuel/ordnance/life
support limit. A turn with **no combat** ("loitering") **does not** consume endurance. Once the three
active turns are spent, the group **must** return to carrier/base by the shortest safe route. If
intercepted while returning, roll **1 die**: **1–2** = takes the attack, **may not return fire**;
**3–4** = evades, continues on course; **5–6** = dogfights normally (burning emergency reserves).
Any group that fails to reach its carrier within **THREE turns** of exhausting endurance (distance or
interception) is **lost** (pilots assumed to eject). Suggested tracking: three small counters per
group, one removed per active-combat turn used.

### Fighter Pilot Quality — Aces and Turkeys (p.11–12)

Roll once per fighter group at the start of the game/campaign: **6 = Ace** present in the group;
**1 = Turkey** group; **2–5 = average**.

**Using Aces:**

- A group with an Ace gets **ONE EXTRA DIE** on normal attacks — a full 6-fighter group with an Ace
  rolls **SEVEN** dice.
- The Ace's morale bonus is the **−1 to morale rolls** noted above.
- Instead of contributing to the volley, the Ace may make **one Needle Beam-style attack** (P.18 of
  the main rulebook) per turn on **one specific system**, rolling **just 1 die**; in that case the
  rest of the group does **not** get the extra die (e.g. 5 fighters incl. Ace: either 6 dice normal,
  or 4 dice normal + 1 needle-beam die at a system).
- In dogfights, the Ace may add an extra die to the group's attack, **or** target an opposing Ace
  one-for-one with 1 die.
- **Special note**: in ordinary losses the Ace is always the **last** fighter to die; the only
  exception is being specifically singled out by an opposing Ace.

**The trouble with Turkeys** (p.12): Turkeys attack ships normally (computerised targeting), but in a
**dogfight** they **subtract 1** from every die roll. A Turkey group must "bug out" after **TWO**
consecutive failed morale rolls (vs. three for an average group).

### Advanced and Specialised Fighter Types (p.12)

Base fighter group cost referenced throughout this section is the **"normal 20 points"** per
6‑fighter group (the original rulebook's cost).

| Type | Rule | Extra cost |
| --- | --- | --- |
| **Fast Fighters** | Move **18"**/turn instead of 12" | **+2 pts/fighter** (32 total) |
| **Heavy Fighters** | Same offense/drive; treated as having **Level‑1 Screens** vs. PDAF/ADAF/fighter fire (a roll of "4" has no effect) | **+2 pts/fighter** (32 total) |
| **Interceptors** | **No anti-ship capability at all** — may only fire on other fighter groups; in dogfights **add 1** to every die: kills 1 on **3–4**, kills **2 on 5–6** | **no extra cost** |
| **Attack Fighters** | Opposite of Interceptors: in a dogfight only kill (1 fighter) on a **6**; vs. ships **add 1** to every die — an unscreened target takes **1 DP on 3–4, 2 DP on 5–6** | **+1 pt/fighter** (26 total) |
| **Long-Range Fighters** | Requires the Endurance rule; combat endurance **3 → 5 turns** via extra fuel/life support | **+2 pts/fighter** (32 total) |
| **Torpedo Fighters** | Further Attack specialisation: one single-shot heavy weapon per fighter; roll once per fighter, **4+ to hit**, damage = the number rolled (e.g. roll of 5 = 5 DP); whole group fires **once**, same target, all-or-nothing; once expended, fights only in the anti-fighter mode of Attack Fighters (kills on 6 only) and may make no further ship attacks | **+3 pts/fighter** (38 total) |

All fighter types share the same mass/hangar footprint and normal launch/recovery/turn-sequence
rules. Use the standard fighter symbol with a type letter substituted for the "spot" (e.g. "H" =
Heavy, "T" = Torpedo).

---

## pp.13–14 — Section 5: Planets and Atmospheric Operations

### Planets and other large bodies (p.13, left column)

Represent a planet/large body on the table with any round/spherical object (a dinner-plate or large
football/soccer-ball size is suggested); scale is deliberately abstract/symbolic, no fixed ratio to
ship models is defined. **Orbit distance**: measure the model's radius; the orbit is a circle of
**twice this radius** — example given: a **12" diameter (6" radius)** disc gives an orbit of **24"
diameter (12" radius)**, i.e. ships orbit **6" above the surface**. Diagram: **Entering Orbit at
velocity 6**, **In Orbit at velocity 6**, **Leaving Orbit at velocity 7+**.

### In orbit / entering and leaving (p.13, right column)

While in orbit, a ship travels at a **velocity equal to the orbital distance above the surface**
(velocity 6 in the example ⇒ 6" per turn along the arc, measured with a flexible tape). **Decelerate
below** orbital velocity ⇒ orbit decays, atmospheric entry begins (see p.14). **Accelerate above** ⇒
ship leaves orbit and moves in a straight line **tangent** to the orbital path. No course orders are
needed while "in orbit" — any velocity change ends it. Gravitational effects outside orbit are
ignored by default (a gravity well may optionally be plotted).

**Entering/leaving orbit, restated**: to leave, accelerate over orbital velocity (tangent departure,
as diagrammed). To enter, approach at the **correct orbital velocity**; at the orbital distance the
ship may join the orbital path (clockwise or anticlockwise) **without spending thrust to turn**. If
the ship reaches the orbital distance **below** orbital velocity ⇒ automatically-decaying orbit,
atmosphere entry begins. If it arrives at **greater** velocity ⇒ rams straight into the atmosphere as
an **uncontrolled entry**.

**An alternative** (p.13): if not modelling planets physically, use Jim Webster's scenario system
(P.37 of the book): one table edge = "Deep Space", the **opposite** edge = "Planetary Orbit." To
safely enter orbit a ship must exit the Planetary edge through a **~6"-wide window** at a
scenario-set velocity **or less** (suggested no greater than **6**); exiting faster or missing the
window causes an uncontrolled atmospheric entry. The Deep Space edge may double as the "safe Jump
limit" from the planet's gravity well.

### Atmospheric streamlining (p.13–14)

Most starships are **not streamlined** (never enter atmosphere; built/serviced in space). A **Fully
Streamlined** ship is completely atmosphere-capable and "flies" like an aerospace craft; a
**Partially Streamlined** one has some landing/atmosphere capability, mostly via brute thrust rather
than aerodynamic lift.

For an Earth-like-gravity world:

- **Fully Streamlined** needs **Thrust rating ≥ 4** to operate in atmosphere/interface mode.
- **Partially Streamlined** needs **Thrust rating ≥ 6** to safely land/take off.
- These thresholds scale with the scenario's chosen world size/gravity.

**Points cost** (optional, p.14): **Partially streamlined** hull = **+25%** of the hull's points
cost; **Fully streamlined** = **+50%**. Worked example: a Mass-40 Warship hull costing 80 points
costs **100** partially streamlined or **120** fully streamlined; the same Mass on a Merchant hull
(60 non-streamlined) costs **75** partially or **90** fully streamlined. Whether a given miniature
counts as Full/Partial/Non-streamlined is down to its actual shape: a true aerodynamic shape with
wings or a lifting-body structure counts as **Fully Streamlined** (example given: the CMD FT 307
Intrasystem Shuttle, "which looks like an oversized Space Shuttle orbiter"); a shape that looks like
it could stand some atmospheric entry without being truly aerodynamic counts as **Partially
Streamlined** (example: most of the Eurasian FT 200-series ships); typical **Non-Streamlined** ships
with no atmospheric capability at all are exemplified by the CMD Neu Swabian FT 500-series designs.

### Atmospheric entry — planned and accidental (p.14)

A ship enters atmosphere either deliberately (if streamlined, to land) or is **forced** to by (a) a
decaying orbit, or (b) approaching too fast / missing an orbital insertion window.

**Deliberate safe entry**: enter orbit, then decelerate below orbital velocity for a controlled
descent; if drive thrust is sufficient for the ship's streamlining configuration, it lands safely.
Sufficient configuration but **insufficient thrust** (e.g. drive damage) ⇒ safe entry but a
**crash-landing**, effects left to the scenario.

**Uncontrolled entry**: roll **1 die** and apply modifiers:

| Modifier | Value |
| --- | --- |
| Non-streamlined | **+4** |
| Partially streamlined | **0** |
| Fully streamlined | **−2** |
| Per 1 point of velocity over safe orbital velocity | **+1** |
| Per full 6" the orbital insertion window was missed by | **+1** |
| Drive damaged | **+1** |
| Drive knocked out | **+3** |

| Final result | Outcome |
| --- | --- |
| **2 or less** | Miraculous ballistic entry, crash-lands (survival/aftermath up to the scenario) |
| **3 to 5** | Burns up in upper atmosphere, but interface craft/fighters aboard get time to launch (see the "STIG IV" scenario table, P.37) |
| **6 or above** | Burns up; all crew, passengers and equipment lost |

---

## Against the engine

Engine sources checked: `docs/rules/fighters.md` (section 8) and `src/engine/fighters.ts`;
`docs/rules/terrain.md` (section 17, and 12.11) and `src/engine/terrain.ts`; `src/data/optionalRules.ts`,
`src/data/designPricing.ts`. The engine's rule text is *Full Thrust: Project Continuum* v1.1.4
(2017), a later consolidation, not More Thrust verbatim — differences below are genuine edition
drift, not extraction error.

**Optional Fighter Turn Sequence** — **already-in-engine**, but no longer optional. Continuum's fixed
sequence of play already runs "Move fighters" as phase 4 **before** "Move ships" as phase 5
(`docs/rules/fighters.md` §8.5; `PHASE_ORDER`/`PHASE_LABELS` in `src/engine/types.ts`, consumed by
`game.ts`); there is no separate toggle for it in `src/data/optionalRules.ts`. What More Thrust
offered as an optional house rule is the engine's only phase order.

**Fighter Group Morale** — **differs-from-engine**. The engine's 8.17 (`fighterMoraleCheck`,
`src/engine/fighters.ts:2560`) implements only the single per-attack roll (≤ remaining fighters ⇒
attacks; else aborts and spends no endurance) — that much matches More Thrust exactly. But the
engine has **no "three consecutive failures ⇒ morale broken / must disengage" mechanism at all**
(no counter, no broken/routed state anywhere in `fighters.ts`), and **no Ace/Turkey modifier on the
morale roll** — `fighterMoraleCheck` never reads `group.pilots`. More Thrust's Ace **−1**/Turkey
**+1** morale DRM and the Turkey's **two-failure** break threshold (vs. three for average groups) are
present in the 1994 text but absent from both `docs/rules/fighters.md` §8.17/8.18 and the code.

**"Scrambling" Fighter Groups** — **already-in-engine, numbers agree**. `docs/rules/fighters.md`
§8.3 quotes the identical 1/2–3/4/5/6 die table verbatim, and the "only possible for ships that can
launch two (or more) groups a turn" cap matches. The engine **adds** two constraints More Thrust
doesn't have: scrambling is blocked if the carrier applied thrust that turn, and a scrambled group
mid-rearm launches at half fuel with no reloadable ordnance (`scrambleFighters`, §8.3) — new-to-engine
extensions, not contradictions.

**Fighter Endurance** — **differs-from-engine** in its whole accounting method. More Thrust spends
one of **3 turns** of endurance per **active combat turn**, regardless of how many actions that turn
contains, and imposes a hard **3-turn** return deadline after which unreturned groups are **lost**.
The engine's CEF system (§8.13) instead charges **6 CEF total**, spent **per action** (1 for an
attack, 1 for a secondary move, 1 for an evade — so a single turn can burn more than one factor), and
explicitly states **"There is no time limit on a group returning to its carrier after exhausting its
CEF"** — the opposite of More Thrust's 3-turn-or-lost rule. The interception-while-returning table
also differs: More Thrust rolls 1–2/3–4/5–6 for no-return-fire/evade/fight-normally; the engine
instead always lets an exhausted group fight back, but only "scores one kill on rolls of 6" (its own,
weaker, fixed table) — a different mechanic, not a renumbering of the same one.

**Fighter Pilot Quality — Aces and Turkeys** — **already-in-engine, numbers agree** for the
assignment roll (6 = Ace, 1 = Turkey, `rollPilotQuality`, `fighters.ts:2586`) and for the Ace's core
kit: the extra die (`attackDiceCount`, `strength + 1`), the Ace-always-dies-last rule (`hasAce`,
`aceKilled`), the needle-beam special attack withholding the extra die, and the dogfight
extra-die-or-target-the-enemy-Ace choice. The Turkey's dogfight/intercept **−1** DRM also matches
(`fighters.ts:1970, 2313, 2418, 2502`). **Differs-from-engine**: Turkey's morale interaction (see
above) and the "bugs out after two failures" rule are not carried over — the engine's Turkey is
pilot-quality-for-combat-dice only, with no separate morale behaviour.

**Advanced and Specialised Fighter Types** — mixed, itemised:

- *Fast Fighters* — **differs-from-engine**. More Thrust: **+2 pts/fighter** (32/group on a 20-point
  base). Engine `FIGHTER_MODIFIERS.fast.pointsPerFighter = 1` (`fighters.ts:529`), i.e. **+1
  pt/fighter** (24/group on an 18-point base). Both the modifier and the base group cost changed.
- *Heavy Fighters* — **differs-from-engine**, in mechanism and price. More Thrust: **Level-1
  Screens** vs. attack (a natural "4" is harmless) for **+2 pts/fighter**. Engine Heavy is a flat
  **−1 DRM** on point-defence/other-fighter fire against them (not a screen-table effect, and a code
  comment on `shipFireAtFighters` notes it explicitly does *not* soften full-strength ship weapons —
  `fighters.ts:1560-1564`: "Heavy anti-ship weapons used in defensive fire (beams, K-1) have only
  their normal -1 DRM … it does little against a full strength anti-ship weapon"), for
  `pointsPerFighter = 3`, i.e. **+3 pts/fighter** (`fighters.ts:520`).
- *Interceptors* — **differs-from-engine**. More Thrust interceptors have **zero** anti-ship
  capability (cannot fire on ships at all) and gain **+1 to the die** in dogfights (kills on 3–4, 2
  kills on 5–6), for **no extra cost**. The engine's Interceptor can still shoot at ships, just at a
  **−2 DRM** penalty, and its anti-fighter bonus is **+1 DRM** rather than a die-roll shift
  (`fighters.md` §8.15 table); its `pointsPerFighter` is 3, same as Standard, so the "no extra cost"
  part is preserved but the underlying mechanic (hard restriction vs. DRM penalty) is not.
- *Attack Fighters* — **already-in-engine for the cost delta**, differs on the mechanic's edges.
  More Thrust: **+1 pt/fighter** (26/group total); engine `pointsPerFighter = 4` vs. Standard's 3, the
  same **+1/fighter** delta (`fighters.ts:356`), and the quoted worked example — "1 DP on 3–4, 2 DP on
  5–6" for an unscreened target — is reproduced in substance in `docs/rules/fighters.md` (§8.15, as
  "one damage point with rolls of 3 or 4, and two damage points with 5 or 6"). Totals differ only
  because the base group cost changed (20 → 18). The dogfight-only-kill-on-6 half of the rule also
  matches.
- *Long-Range Fighters* — **differs-from-engine**. More Thrust: endurance **3 → 5 turns** for **+2
  pts/fighter** (32/group). Engine: CEF **6 → 9** for **+1 pt/fighter** (24/group,
  `fighters.ts:535-543`) — different units (turns vs. CEF) and a different price.
- *Torpedo Fighters* — **already-in-engine for the cost delta**, mechanic elaborated. More Thrust:
  **+3 pts/fighter** (38/group); engine `pointsPerFighter = 6` vs. Standard's 3, the same **+3/fighter**
  delta (`fighters.ts:375`). Totals differ (36 vs. 38) only via the base-cost drift. The 4+-to-hit,
  damage-equals-die-roll, one-shot-all-fighters-same-target mechanic matches; the engine adds Semi
  -Armour-Piercing/ignores-screens wording and a fixed range of 6 MU not stated in More Thrust's text.

**Base fighter group cost** — **differs-from-engine**: More Thrust's own arithmetic implies a base
group cost of **20 points** (stated directly for Fast Fighters: "+2/fighter on top of the normal 20
points"); the engine's Standard Fighter is **18 points** (3/fighter, `fighters.ts:320`). Every
specialised type's *modifier* lines up with More Thrust's per-fighter deltas for Attack and Torpedo;
only the shared base has moved.

**"Terrain" effects, p.9** (context, not a named topic but same page range):

- *Dust clouds* — **differs-from-engine** on one number: More Thrust caps the beam-attenuation
  screen bonus at **"Screen levels above 3 remain at 3"**; the engine's `attenuatedScreens`
  (`terrain.ts:394`, `CLOUD_SAFE_VELOCITY = 12` at line 331) caps at **level 2**
  ("Screen levels above 2 remain at 2"). The **12** MU/inch safe-velocity threshold, the 1-die
  beam-table damage, and the 1–3-fail/4–6-succeed lock-on roll all match exactly
  (**already-in-engine**). New-to-engine: Continuum's dust-cloud rule exempts **Advanced Screens**
  from the "no protection" clause (More Thrust's 1994 text makes no Standard/Advanced distinction —
  Advanced Screens postdate this supplement) and states fighters "always lock on."
- *Solar flares* — **already-in-engine, numbers agree**: 1 die per FireCon/sensor system, **+1** per
  active screen level, **4+** survives (`resolveSolarFlare`, `terrain.md` §17.3).
- *Meteor swarms and debris* — **already-in-engine, numbers agree**: 6–12 MU diameter
  (`ASTEROID_FIELD_DIAMETER`, `terrain.ts:543`), and the exact velocity ladder 0–5 none / 6–11 = 1D6 /
  12–17 = 2D6 (`resolveMeteorField`, `terrain.ts:584`). New-to-engine: Continuum makes the damage
  explicitly **penetrating** (ignores screens and armour); More Thrust's text is silent on the point
  for this specific rule (it only states "Screens offer no protection" for dust clouds).
- *Battle debris* — **already-in-engine, numbers agree**: same excess-damage-≤-roll test and the
  identical worked example (2 DP left + 5 damage ⇒ roll of 3 or less explodes), same cloud sizes
  Escort 2 / Cruiser 4 / Capital 6 MU, 1-turn duration (`explosionCheck`, `createDebrisCloud`,
  `terrain.md` §17.5). New-to-engine: sizing rules for hull categories (station, monster, civilian)
  More Thrust doesn't have.

**Planets and other large bodies / orbit geometry, p.13** — **lacks** (minor). More Thrust's specific
tabletop convention — measure the planet model's radius, set orbit radius to **twice** it (so
altitude above the surface equals the planet's own radius) — has no equivalent formula anywhere in
`terrain.ts`. `OrbitTrack` (`terrain.ts:956-964`, §17.8) instead takes the planet's edge as the orbit
track directly, with `radius` a caller-supplied number and no function deriving it from a model's
own radius — a different, simpler geometry, not an encoding of More Thrust's doubling convention.
Separately, and for an unrelated reason, §17.7's alternate orbital-table system admits its own gap:
`terrain.md` notes "the distance-from-corner half is not implemented: `GameState` has no table
bounds, so there are no corners to measure from" — a second, different geometry omission in the same
section, not the one this paragraph is about.

**Entering/leaving orbit** — **already-in-engine, numbers agree** for the core three-way branch:
arriving below orbital velocity ⇒ decaying orbit/atmosphere entry; at it ⇒ in orbit; above ⇒ leaves
on the tangent (`orbitTrackArrival`, `terrain.md` §17.8, matching More Thrust's p.13 text almost
verbatim, including "no course orders needed while in orbit" and "any velocity change ends orbit").
**Differs-from-engine** on the underlying mechanic for moving around the orbit: More Thrust measures
continuous arc distance in inches equal to velocity (`"move round the arc with a flexible tape"`);
Continuum's medium-scale rule instead discretises the track into a **12-point clock face**
(`ORBIT_TRACK_POINTS = 12`, `terrain.ts:937`) with a separate "orbit speed in points per turn," a
different geometric abstraction from More Thrust's continuous-arc method (the same difference is
already flagged as reading [12] in `terrain.md`, since Continuum itself treats "entry velocity" and
"orbital velocity" as one number where its own text briefly implies two).

**"An alternative" (table-edge orbit), p.13** — **lacks** direct equivalent. More Thrust's Jim
Webster table-edge system (Deep Space edge / opposite Planetary Orbit edge, ~6"-wide safe-entry
window, doubling as the "safe Jump limit") is a different mechanic from Continuum's §17.7 orbital
table, which concerns a ship **leaving and later re-entering the same table edge** within a
turn-count window (`terrain.md` §17.7, "opposite edge… within 6 MU… diagonally opposite corner").
Both use a magic number of 6, but for different purposes; the engine's `orbitReentryPlacementLegal`
implements Continuum's version only.

**Atmospheric streamlining** — **differs-from-engine**, sharply, on both halves of the rule:

- *Thrust requirement to land*. More Thrust: **fixed absolute thresholds** for an Earth-like world —
  Fully Streamlined needs **Thrust ≥ 4**, Partially Streamlined needs **Thrust ≥ 6**. Continuum's
  §17.11 (`deliberateLanding`, `terrain.ts:1553`): Fully Streamlined lands with **"some main drive
  thrust"** — i.e. any thrust at all, no fixed minimum — while Partially Streamlined needs thrust **≥
  the planet's gravity in Earth Gs**, a variable tied to the world rather than a flat "6."
- *Points cost*. More Thrust prices streamlining as **+25% (partial) / +50% (full) of the hull's
  points cost**, worked through a Mass-40/80-point example to 100/120 points. The engine's
  `streamliningMass` (`designPricing.ts:137-140`) instead adds **5% (partial) / 10% (full) of the
  ship's mass** to the hull, at **zero extra points per mass** for streamlining itself — the code
  comment states outright **"No points"** — relying on the mass increase to raise the hull's points
  only indirectly through the normal mass-based pricing formula. The two pricing schemes cannot
  agree on the same hull: More Thrust's Mass-40/80-point example prices partial streamlining at 100
  points; the engine's method has no direct points line for streamlining to compare against at all.

**Atmospheric entry — planned and accidental, p.14** — **already-in-engine, numbers agree** almost
exactly. The uncontrolled-entry DRM table matches term for term: non-streamlined **+4**, partial
**0**, full **−2**, **+1** per point of velocity over orbital velocity, **+1** drive damaged / **+3**
drive knocked out (`STREAMLINING_ENTRY_DRM`, `resolveAtmosphericEntry`, `terrain.ts:1446-1521`,
`terrain.md` §17.11), and the three outcome bands are identical: **≤2** crash-lands, **3–5** burns up
but interface craft/fighters escape, **6+** total loss. The engine drops More Thrust's "missed
orbital insertion window by every full 6″ ⇒ +1" line (there being no table-edge window in the
engine's own model) and adds "life pods" to the craft that can escape on a 3–5 result, which More
Thrust's p.14 text does not mention.

---

<details><summary>Checker's corrections</summary>

Checked against the page images `mt-p09.png`–`mt-p14.png` and the source text `mt.txt` pp.9–14, and
five-plus "Against the engine" claims spot-checked against the repository (`src/engine/fighters.ts`,
`src/engine/terrain.ts`, `src/engine/types.ts`, `src/data/optionalRules.ts`,
`src/data/designPricing.ts`, `docs/rules/fighters.md`, `docs/rules/terrain.md`). No number, die
type, range, threat level, count or table cell drawn from the 1994 text was wrong; the corrections
below are (a) one under-reported source-text extraction quirk, (b) two omitted-from-page details
restored, and (c) a cluster of wrong or imprecise repository citations in the "Against the engine"
section, found by checking every cited line number and file/section reference against the actual
code.

1. **Source-text note was incomplete.** The original preamble said only p.13 has a column/reading-
   order problem in the raw text extraction. Checking the p.12 image against `mt.txt` shows p.12 has
   the same kind of problem: the tail of the ATTACK FIGHTERS paragraph ("...with rolls of 3 or 4, and
   2 DP with 5 or 6...") is extracted out of sequence, appearing right after "THE TROUBLE WITH
   TURKEYS" instead of after the Fast/Heavy/Interceptors/Attack Fighters entries it actually follows
   on the page. The finished write-up already used the correct (image) order for its Advanced and
   Specialised Fighter Types table, so no rule content was wrong — only the "note on the source text"
   undercounted which pages needed reordering. Expanded the note to cover p.12.
2. **Dust-cloud "Gas Giants" note over-compressed.** The original read "Note: may double as
   'skimming Gas Giants.'" The page (and text) actually frames this as simulating "ships operating in
   the very fringes of planetary atmosphere, such as when 'skimming' Gas Giants" — the Gas Giant is
   one example of the broader case, not the whole note. Restored the fuller framing.
3. **Named streamlining examples dropped.** The summary of "whether a miniature counts as Full/
   Partial/Non-streamlined" left out the three named example hulls the page actually gives: the CMD
   FT 307 Intrasystem Shuttle (Fully Streamlined), most Eurasian FT 200-series ships (Partially
   Streamlined), and the CMD Neu Swabian FT 500-series designs (Non-Streamlined). Restored them.
4. **Wrong line citation for the Heavy Fighter "does not soften full-strength weapons" claim.** The
   draft cited `fighters.ts:466-472` for this point; those lines are actually part of the unrelated
   Multi-Role Fighter type definition. The real source is the doc comment on `shipFireAtFighters`
   at `fighters.ts:1560-1564`, which quotes "Heavy anti-ship weapons used in defensive fire (beams,
   K-1) have only their normal -1 DRM … it does little against a full strength anti-ship weapon."
   Fixed the citation; the underlying claim itself was correct.
5. **Off-by-one line citations for two `pointsPerFighter` values.** `fighters.ts:528` (cited for
   Fast Fighters) is the `label: 'Fast'` line; the `pointsPerFighter: 1` value is on line 529.
   `fighters.ts:519` (cited for Heavy Fighters) is the `label: 'Heavy'` line; `pointsPerFighter: 3`
   is on line 520. Fixed both.
6. **Long-Range Fighters citation range too wide.** `fighters.ts:537-547` was cited for the
   `long-range` modifier's `pointsPerFighter = 1` (CEF 6→9); the actual `long-range` block runs
   537-543, and 544-547 belongs to the separate, unrelated `ftl` modifier. Tightened to 535-543.
7. **Orbit-geometry citation conflated two different gaps.** The draft cited the engine's admission
   at `terrain.md` §17.7 ("no table bounds, so there are no corners to measure from") as evidence
   that More Thrust's radius-doubling orbit convention has no engine equivalent. That §17.7 passage
   is actually about a different mechanic (the table-edge re-entry system's corner-distance check).
   The correct location for the radius point is `OrbitTrack` in `terrain.ts:956-964` (§17.8), whose
   `radius` field is simply caller-supplied with no derivation formula. Rewrote the paragraph to cite
   the right passage and note the §17.7 gap separately as a related-but-distinct point.
8. **Phase-order citation imprecise.** "`game.ts` phase order" was cited for the fixed Move-fighters-
   before-Move-ships sequence; the `PHASE_ORDER`/`PHASE_LABELS` arrays that actually encode this are
   defined in `src/engine/types.ts` (confirming "Move fighters" is phase 4 and "Move ships" is phase
   5) and merely consumed by `game.ts`. Corrected the citation.
9. **"Reproduced verbatim" overstated.** The Attack Fighters worked example ("1 DP on 3–4, 2 DP on
   5–6") was said to be reproduced "verbatim" in `docs/rules/fighters.md` §8.15; the doc actually
   paraphrases it as "one damage point with rolls of 3 or 4, and two damage points with 5 or 6" —
   the same numbers, not the same words. Softened "verbatim" to "in substance," with the actual
   wording quoted.
10. **`streamliningMass` citation range.** Cited as `designPricing.ts:127-140`; the function itself
    is lines 137-140 (127-136 is its doc comment). Tightened the citation to the function's own lines.
11. **`STREAMLINING_ENTRY_DRM` citation start line.** Cited as starting at `terrain.ts:1441`; the
    constant is actually declared at line 1446. Corrected to 1446-1521.

All other numbers, dice, ranges, table cells and rule conditions in the draft — including the full
Scrambling table, the Endurance interception table, the Aces/Turkeys mechanics, the Advanced Fighter
Types cost table, the orbit-diagram velocities, the streamlining thresholds and points formula, and
the uncontrolled-atmospheric-entry DRM/outcome tables — were checked word-for-word and number-for-
number against the p.9–p.14 page images and matched exactly; nothing else needed correction.

</details>

---

# Chunk 3 · pp. 15–20 · combining with ground combat games

Transcribed from the page images (the text layer's column order is scrambled and was not used).

## Interfacing Space and Ground Combat Actions (p. 15)

This chapter has two independent systems for linking Full Thrust starship combat to ground-action
games: the **Full Thrust / Dirtside II interface** (design lead: Mike Elliott, one of DS2's own
designers, with additional input from the author himself) and the **Full Thrust / Hellfire interface**
(written by Jim Webster, author of Hellfire). Notably, the Hellfire system allows ships to carry a lot
more troops than the Dirtside II version — this comes down to the differing views of the two
interfaces' authors, and the two are deliberately left inconsistent with each other — "we have never
actually defined what a Full Thrust MASS point equals in terms of real tonnage" — because the
Dirtside II interface goes deep into design and costing, while the Hellfire interface is "a much more
loose and open system." Either is as valid as the other; use whichever fits your table.

Dirtside II is GZG's own 1/300 combined-arms ground rules; it is designed to share Full Thrust's
background so the two work together for full campaigns. Uses suggested: launch a full invasion fleet
against a defended system, or land a couple of platoons for a "surgical strike," or (for 15/25mm
infantry action) use STARGRUNT (or the "forthcoming STARGRUNT II" — not yet published at time of
writing).

## Transporting Ground Troops (p. 15)

Troop transport between star systems can use almost any ship with spare cargo space, but the
standard method is a specialised **Assault Transport**. The worked example is built on a standard
Heavy Freighter hull.

An Assault Transport is a Merchant ship and subject to the Merchant design rules: up to **10%** of
total Mass on weapons/other systems; **50%** of total Mass is assumed taken by structure, drives,
fuel, crew, etc.; this leaves **40%** of total Mass as **Cargo Mass**, which pays for both troop/vehicle
accommodation and the means of getting them down to the surface.

### Worked example — the transport hull

| Field | Value |
| --- | --- |
| Type | ASSAULT TRANSPORT |
| Total Mass | 60 |
| Classification | MERCHANT |
| Thrust Rating | 2 |
| Standard FireCons | 1 |
| Mass available for weapons/systems | 6 |

| Mass used | Mass | Cost |
| --- | --- | --- |
| Hull, Drives etc. | 30 | 270 |
| 1× "C" Battery (3 arc) | 1 | 5 |
| 2× PDAF | 2 | 6 |
| 1× Level-1 screen | 3 | 25 |
| Cargo Mass available | 24 | * |
| **Total Mass** | **60** | |

\* Cargo's points cost depends on how it is allocated between accommodation and "drop" capability
(below).

### Cargo Space (CS)

- **1 MASS of cargo capacity = 50 units of Cargo Space (CS).**
- Vehicle CS by DIRTSIDE II Size class: **CS = Size class × 4.** A Class-3 (Medium) vehicle needs
  CS 12.
- **1 man = 4 CS** (this represents room for living accommodation, mess, life support, recreation
  etc.), the same rate as for vehicle crews.
- **Troops frozen in Cryosleep need only 1 CS per man** (with extra support equipment required, at
  extra cost — see below).

**CS requirements table, as printed:**

| Element | CS |
| --- | --- |
| Class 5 vehicle (less crew) | 20 CS |
| Class 4 vehicle " " | 16 CS |
| Class 3 vehicle " " | 12 CS |
| Class 2 vehicle " " | 8 CS |
| Class 1 vehicle " " | 4 CS |
| One man (normal accommodation) | 4 CS |
| One man in Cryosleep | 1 CS |

### Points cost of accommodation

- **Normal troop/vehicle accommodation: 1 point per 50 CS** — i.e. 1 point per full 1 MASS.
- **Cryosleep berths ("frozen" troops): 1 point per 5 CS** — i.e. 10 points per full 1 MASS: "there
  are thus many more expensive per mass, but you can cram more troops into the given space."

### Getting troops to the surface

Troops and vehicles come down via **interface-capable craft** — shuttles, or the military term
"Dropships" (or Drop Capsules for jump troops, as in Heinlein's *Starship Troopers*, or teleporters if
the setting allows). For simplicity, all such delivery systems are treated as equivalent in terms of
the space they occupy on the Transport:

- **Each drop system requires 1 MASS factor** (Full Thrust terms) **to deliver 10 Cargo Space
  factors** to the surface.
- Vehicle crews and infantry mounted in APCs/MICVs travel Dirtside "mounted up" in their vehicles,
  so the drop capacity needed is only for the vehicles; dropping "leg" infantry without their
  vehicles needs 1 CS drop capacity per man.
- Example: a typical DIRTSIDE II platoon of 4 × Class 3 (medium) vehicles takes 48 CS total, and thus
  requires **4.8 (rounded up to 5) MASS of drop systems** — probably one fairly large Dropship of
  Mass 5.

**Practical note:** it will usually be impractical to give a Transport enough drop capability to land
its whole troop complement in one load, so standard tactics will be to seize/hold a "beach-head"
("planethead"??) with light forces first, then shuttle the heavy stuff down over several trips once
the LZ is secure. (The text notes this is quite accurate to "historical" precedent — the Royal Navy's
old Assault ships HMS *Fearless* and *Intrepid* each carried only two landing craft, "at least that's
what I got in my Airfix kit!" — and that Vietnam-era gamers will have noticed there are never enough
Hueys to fit all your troops in.)

- **Cost of drop capability: 2 points per MASS** of drop capacity, i.e. 2 points per 10 CS of drop
  capacity.

### Continuing the worked example

Allocate the Assault Transport enough drop capability for 100 CS at once (about two average
platoons): that needs **10 MASS**, costing **20 points**, plus the hangar bay cost (see Interface
Craft, below).

Deducting that 10 MASS from the 24 available Cargo Mass leaves **14 MASS** for actual cargo/troop
accommodation, i.e. **700 CS** (1 MASS = 50 CS accommodation).

- Drop capability cost: 20 points, plus 3 points for the (Mass-10) bay.
- Accommodation cost: 14 points (no Cryosleep berths used).
- **Total ship cost: 306 (hull + weapons/systems) + 20 + 3 + 14 = 343 points.**

This method generalises to any Merchant hull: weigh carrying capacity against operational
flexibility, since a single large ship is the most cost-effective way to move lots of troops, but a
single loss can cost you everything — split your troops between several smaller ships instead.

### A full DIRTSIDE II Combat Group, costed in CS

Example force: 1 platoon of 4 Heavy Battle Tanks (5 crew each); 2 platoons of 4 Medium Battle Tanks
(4 crew each); 3 platoons of Mechanised Infantry in 4 MICVs (2 crew + 8 troops each); 1 battery of 3
SP Artillery vehicles (4 crew each); 1 command platoon of 1 command vehicle, 1 AA vehicle, 2 missile
vehicles (13 crew total).

| Vehicle | No. | Class | Total CS (vehicles) | Crew | Total CS (crew) |
| --- | --- | --- | --- | --- | --- |
| HBTs | 4 | 4 | 64 | 20 | 80 |
| MBTs | 8 | 3 | 96 | 32 | 128 |
| MICVs | 12 | 3 | 144 | 120 | 480 |
| SP Arty | 3 | 4 | 48 | 12 | 48 |
| Command | 1 | 3 | 12 | 4 | 16 |
| AA Vehicle | 1 | 3 | 12 | 3 | 12 |
| Missile Vehicles | 2 | 4 | 32 | 6 | 24 |
| **Vehicle total: 31** | | | **CS totals: 408** | | **788** |

(Combat Personnel total: 197.) Final Cargo Space total: **408 + 788 = 1,196**. Since the example
MASS-60 Assault Transport has a CS capacity of 700, a pair of these ships could comfortably carry the
whole group with leftover space for stores, ammunition, spares and non-combatant personnel — but
loading should be planned carefully to minimise the effect of losing one transport in battle. As far
as drop capability goes, the two Transports between them could drop 100 CS of troops per trip using
their combined total of four platoon-sized dropships; since it is only the 408 CS of vehicles that
needs to reach the surface (crews and troops riding down mounted-up), this comes to basically **four
shuttle runs (plus one final trip by a single dropship)** to get the whole group Dirtside.

## Interface Craft (p. 16)

The rules above give the necessary Drop capacities for moving units to the surface; here are the
craft themselves. Whatever size of craft you choose, its Mass depends on the carrying capacity you
need it to have, as above. A craft of **1 MASS can transport 10 CS of troops and equipment**.

Dropships, Shuttles and Landers may be built to any size, provided there is enough Mass available on
the Transporter to fit them in.

- **Hangar Bays come in sizes of MASS 6 (like a Fighter Group Bay) and upwards**, and are assumed to
  hold an equivalent Mass of small craft or interface craft — e.g. a standard Mass-6 Bay could hold
  up to six Mass-1 squad-size landers, two Mass-3 Dropships (30 CS capacity each), or a single big
  Mass-6 Dropship with 60 CS capacity.
- Larger Bays may hold bigger interface craft — e.g. a huge Mass-20 Dropship (200 CS capacity) needs
  20 spare Mass on the Transporter for its hangar bay.
- The smallest available Bay is Mass 6 — even a single Mass-1 lander aboard still needs a whole
  Mass-6 Bay allocated (though the spare bay space could then also hold 3 Fighters).
- Interface craft smaller than Mass 6 must be grouped into full Bays where possible (e.g. a Transport
  with four Mass-4 Dropships would accommodate them in pairs, in two bays of Mass 8 each).
- When a threshold point is reached, each individual **Bay** (regardless of size) is rolled for one
  die; loss of a bay loses any craft in that bay.
- **All Interface Craft are costed at 2 points per MASS**, same as the drop-capability rate above.
- **Hangar Bay costs:** 2 points for a standard Mass-6 bay; 3 points for a Mass-7 to -12 bay; 4 points
  for a Mass-13 to -18 bay, and so on (a step in cost per 6 Mass of bay size).
  - Example: a single Mass-6 Dropship costs 12 points (Mass × 2) plus 2 points for the bay = **14
    points** total.
  - Example: a pair of Mass-4 Dropships costs 16 points (8 each) plus 3 points for the Mass-8 bay =
    **19 points** total.

The illustrated example ship is the Mass-60 Assault Transport from p. 15, fitted with one Mass-10
Hangar Bay containing two Mass-5 Dropships; total points cost of ship = **343 points**.

## Ground Support for Dirtside II Games (p. 17)

Beyond transport, orbiting Space Naval assets may give direct fire support to the planetary battle.
This was briefly covered in the DIRTSIDE II rulebook under "Ortillery" (Orbital Artillery); the
recommended Full Thrust-side system:

Starships in orbit may provide direct support fire in two forms — support from **non-specialised**
ships, using their normal space-combat armament, and fire from specialised **Planetary Bombardment
Monitors**.

### Non-specialised warship fire

A simplified, abstracted resolution: assume the strength of the attack depends on the class of ship
firing.

- **Escorts** (Frigates and larger) may fire **ONE** "converged sheaf" burst pattern at any point on
  the battlefield.
- **Cruiser** classes may fire **TWO** separate sheafs.
- **Capital** ships may fire **THREE**.

Each burst has a **4" diameter beaten zone**. Incoming fire is subject to the deviation rules in the
Ortillery section of DIRTSIDE II (p. 40 of that rulebook); elements within the final impact zone are
treated as if under attack from ordinary Artillery, drawing **THREE chits per element** in the zone;
damage effects are as if under **HEF** fire for infantry elements hit, and as if under **MAK** fire
for vehicles.

After an orbital fire attack, place a **NUKE counter** at the point of impact; unprotected troops and
vehicles may not approach within **2"** of this marker for the rest of the game, due to radiation
from the Particle Beam strike.

### Planetary Bombardment Monitors (PBM)

Specialised ships dedicated to orbital fire support, equipped with special Ortillery weapons systems
much more effective than an ordinary ship's main weapons used in this role.

- Each turn it spends over the DIRTSIDE II battle area, a PBM may make **ONE attack per Ortillery
  system it has aboard**.
- Each attack targets a point, exactly as for other Artillery fire, subject to the same deviation
  rules.
- An Ortillery attack's beaten zone is larger: **4" radius (8" diameter)** around the target point.
- All elements caught within the zone have **FOUR chits** drawn against them (same validities as
  Beam fire above).
- After an Ortillery attack, a NUKE marker is placed as above, though it still only affects a **2"
  radius** as for Beam attacks.

The text notes orbital fire support is very powerful, and recommends players limit its use to
justified scenarios — an optional twist follows:

### Orbit timing (low orbit)

To give orbital fire support, a ship must be in low orbit; "geostationary" orbit is too high for
effective ground support fire, so the ship will orbit fast and be over the site only briefly each
orbit.

- At the start of the game, **roll a D6**: the result is the turn number in which the orbiting ship
  is directly over the table and can give supporting fire.
- Given the length of most DIRTSIDE II games, the ship will likely be available for only one turn in
  the whole game.
- If the game runs long, assume the ship comes round again **every SIXTH turn** following its first
  appearance (e.g. if a 3 is rolled, the ship supports on turn 3, then again on turn 9, etc.).

### "Full Thrust" Fighters in Ground Support

Most Full Thrust Fighter types may be assumed atmosphere-capable and streamlined, so it is
permissible to use them directly as Aerospace Fighters in DIRTSIDE II games (ground-attack or CAP
role) with **no conversion needed**.

- While in atmosphere, such fighters are subject to all the usual DIRTSIDE II rules for Aerospace
  operations; they revert to Full Thrust rules as soon as they return to orbit.
- Due to higher atmospheric fuel needs, **fighters may only fly one ground-attack mission per whole
  game** (not per turn), and only from a Carrier or mothership that is in orbit.
- Optionally, the same rule can apply to orbital fire support: the carrier need only be over the
  table for one turn in the game, during which its fighters may spend only that one turn over the
  battlefield before climbing back to the carrier — limiting the power of six-or-more fighters
  appearing at once.

## Marine Contingents (p. 17–18)

Most Naval Starships of Frigate class and larger carry small detachments of **Marines** — part of
the ship's crew (not "transported troops") used for ship/shore security, policing, and boarding
actions against other vessels.

- Marines are typically equipped with a few small **light interface-portable vehicles** (LIPPCs —
  Light Interface-Portable Personnel Carriers, usually Hi-Mobility Wheeled), where ship size allows.
- The ship's own standard auxiliary craft (shuttles/launches/boats every non-atmosphere-capable ship
  is fitted with, for general landing/resupply) are assumed to carry the Marines down; these are not
  armoured/armed like a Military Dropship.
- Given small numbers, Marine detachments are often issued **Powered Armour** for combat potential;
  a Powered detachment takes no more onboard space than a normal "light" unit would, since the suits
  are stored in bays most of the time. Powered Marine detachments are **NOT** usually equipped with
  vehicles as well.
- Marine personnel/equipment space is covered by the **50%** of ship Mass already allocated to
  Structure/Drives/non-combat systems (the Full Thrust design rule that 50% of a warship's Mass is
  Hull, Propulsion, Fuel, Crew space etc.).

### Sizing the contingent

**To find Marine contingent size: multiply the ship's total MASS by 4** to get the CS available for
the Marine detachment (using the Troop Transport CS figures above). E.g. a MASS-40 ship (a typical
Battlecruiser class) has **160 CS** available for its Marine group — this space must cover both
personnel and vehicles if used, per the standard DIRTSIDE II Cargo Space rules; such a ship could have
a detachment of 40 Marine personnel (Line or Powered Infantry), or fewer if also equipped with light
vehicles.

It is **not** necessary to cost Marine drop capability separately — it is assumed to come out of the
ship's standard auxiliary-craft allocation.

### Example Marine contingents by class (as printed; illustrative, not exhaustive)

**1) LIGHT CARRIER, MASS 70, Marine Capacity 280 CS.**
- 5 Squads × 2 Fireteams each, mounted in Size-2 vehicles @ 40 CS = 200; 1 Command team in Size-2
  vehicle @ 24 CS; 2 Specialist teams each in Size-2 vehicle @ 20 CS each = 40. Total CS used: 264.
- OR: 6 Squads of 2 Fireteams Powered Infantry @ 32 CS = 192; 2 Command teams Powered Infantry @
  16 CS = 32; 4 Specialist teams Powered Infantry @ 12 CS = 48. Total CS used: 272.

**2) BATTLESHIP, MASS 48, Marine Capacity 192 CS.**
- 3 Squads of 2 Fireteams each, mounted in Size-2 vehicles @ 40 CS = 120; 1 Command team in Size-2
  vehicle @ 24 CS; 2 Specialist teams each in Size-2 vehicle @ 20 CS each = 40. Total: 184.
- OR: 4 Squads of 2 Fireteams Powered Infantry @ 32 CS = 128; 1 Command team Powered Infantry @
  16 CS; 3 Specialist teams Powered Infantry @ 12 CS each = 36. Total: 180.

**3) BATTLECRUISER, MASS 40, Marine Capacity 160 CS.**
- 3 Squads of 2 Fireteams each, in Size-2 vehicles @ 40 CS = 120; 1 Command vehicle, Size 2, 2 crew
  @ 16 CS; 1 Specialist team in Size-2 vehicle @ 20 CS. Total: 156.
- OR: 4 Squads of 2 Fireteams Powered Infantry @ 32 CS = 128; 1 Command team Powered Infantry @
  16 CS; 1 Specialist team Powered Infantry @ 12 CS. Total: 156.

**4) HEAVY CRUISER, MASS 32, Marine Capacity 128 CS.**
- 3 Squads of 2 Fireteams each, in Size-2 vehicles @ 40 CS = 120.
- OR: 4 Squads of 2 Fireteams Powered Infantry @ 32 CS = 128.

**5) ESCORT CRUISER, MASS 26, Marine Capacity 104 CS.**
- 2 Squads of 2 Fireteams each, in Size-2 vehicles @ 40 CS = 80; 1 Command team in Size-2 vehicle @
  24 CS. Total: 104.
- OR: 3 Squads of 2 Fireteams Powered Infantry @ 32 CS = 96.

**6) LIGHT CRUISER, MASS 22, Marine Capacity 88 CS.**
- 2 Squads of 2 Fireteams each, in Size-2 vehicles @ 40 CS = 80.
- OR: 2 Squads of 2 Fireteams Powered Infantry @ 32 CS = 64; 1 Specialist team Powered Infantry @
  12 CS = 12. Total: 76.

**7) FRIGATE, MASS 10, Marine capacity 40 CS.**
- 1 Squad of 2 Fireteams (Line or Powered Infantry) @ 32 CS.

These lists are examples only; players may configure Marine units as desired within the CS limits
available.

As will be seen, these contingents have about the right "feel" for the size of ship concerned: the
larger ships' Marine detachments give enough force for a small DIRTSIDE II engagement to be fought
against (say) local insurgent forces, while the smaller contingents on lighter vessels may be used for
"surgical strike" or security teams for games using perhaps a 15/25mm scale combat system such as
STARGRUNT.

The other use for Marine units aboard Starships is **Boarding Party** duty (see p. 7 rules), fought
either abstractly or man-to-man on a deck plan of the ship (e.g. a modified Space Hulk™ from Games
Workshop).

## Damage to Troop Transports (p. 18)

When a loaded Transport ship takes damage, it should be treated the same as the "damage to cargo"
notes for Freighters (p. 23 of the Full Thrust rulebook): **troops, vehicles etc. are assumed lost in
proportion to the damage taken by the ship.**

- Suggested method: if a transport has lost, say, **30% of its Damage Points**, roll percentile dice
  for each individual unit/element on board, with a **30% chance** of it being among the casualties.
  This may give a few more or fewer actual casualties than the straight percentage of damage points,
  "but there is nothing wrong with that."
- Such rolls should be made **only once**, either at the end of the game or at the point troops are
  deployed on-planet — not every time the transport takes another point of damage.
- Losses to Shuttles/Dropships etc. can occur in the normal threshold-point damage rolls, since they
  (or at least their hangar bays) are represented as individual items on the ship diagram.

## Full Thrust / Hellfire Interface (p. 19–20)

Author's note: HELLFIRE is a generic 1/300 SF ground rules set by Jim Webster (Wessex Games). It is
a "low-down and dirty" system for the scruffy/disreputable end of SF ground combat — planetary militia
and police units, to whom "a hover pickup with a mining laser on the back is a heavy combat vehicle."
It does not contain hard-and-fast points details (unlike Dirtside II), and certain things in what
follows may also contravene the normal Full Thrust design rules; "so what? My thanks to Jim Webster
for contributing this interface system."

### Ship types for Hellfire troop transport

- **In-System Troopship** — purely for moving stuff within one solar system; no FTL drive; almost
  certainly a converted bulk carrier capable of atmospheric operation.
- **Marine contingent aboard a Warship** — a Cruiser or larger ship could carry a shuttle/dropship
  bay in place of some of its regular weaponry.
- **Space Marine Troopship** — a specialist ship built solely as a troop transport; hull perhaps
  based on a Fleet Carrier, with shuttle bays replacing the fighter bays; could carry as much as a
  Division.
- **Converted Bulk Carrier** ("the Satyr" example below) — a common method of interstellar troop
  transport; ships could be converted back to merchant duty in peacetime, or kept on fleet strength
  and used for bulk supply runs.
- **Container Freighter** — a standard FTL tender-type ship that picks up and delivers a number of
  large (perhaps battalion-sized) landing ships; e.g. four loading hardpoints, taking three cargo
  modules and one military lander on peacetime rotation, swapping to three landers or a container of
  supplies in wartime; the landing craft are self-contained transports in their own right, with their
  troop contingents remaining aboard them throughout the voyage.

### Worked example — the "SATYR"

A converted merchant Bulk Tanker, upgraded/outfitted as a Troopship, mounting:

- **One fighter bay with 6 fighters embarked**
- **Five shuttle bays, each with 6 interface shuttles** (i.e. 30 shuttles total)
- **A level-3 screen system**
- **Three PDAF systems**
- **One "C" Battery**

Modular construction means fighter and shuttle bays can be dropped or removed as required, leaving
cargo space — suitable for government subsidy of private companies to build merchantmen on
military-style hulls, for later wartime requisitioning.

### Housing troops aboard

Troops must be accommodated aboard, factored into the design. Mechanised/armoured units are stored
in their shuttles (counted there); infantry need dedicated room built into the ship (crew facilities
may optionally be assumed shared).

- **Ordinary infantry housed at a rate of 8 bases per point of (spare) Mass on ships with Military
  hulls, or 16 bases per point of Mass on Merchant-hulled ships** (merchant ships have less
  compartmentalisation/redundancy).
- These figures are for **spare** Mass not used for anything else, **not** the ship's total/overall
  Mass — an extra limiting factor: **no ship may carry more than 1 base per point of OVERALL Mass**
  (even infantry need room to stretch). A Mass-40 ship could carry no more than 40 bases even with
  enough spare Mass capacity for many more.

### Shuttle troop capacity

Returning to the Satyr example: each of its shuttles can transport (in Hellfire terms) **a
half-company of infantry (4 bases), a mechanised infantry section with its vehicle (1 APC plus 1
base of troops), or a single Armoured Combat Vehicle.** This may seem harsh for vehicles, but fuel,
spares and expendables take a lot of room; crews also need in-flight maintenance access.

### The "Satyr Brigade" — standard mission load-out (all stats in HELLFIRE terms)

**1st Light Battalion:**
- A Company — Reaction 3,3,2,2,3,2,2,2 — 19 pts — 8 bases of infantry, Ablat armour, personal energy
  weapons.
- B Company — Reaction 3,3,2,2,3,2,2,2 — 19 pts — same as A.
- C Company — Reaction 3,3,2,2,3,2,2,2 — 19 pts — same as A.
- D (Mechanised) Company — Reaction 3,3,2,2,3,2,2,2 — 19 pts — 6 bases of infantry, Ablat armour +
  personal energy weapons, each riding in a light armoured APC mounting a crew-served projectile
  weapon, full vehicle NBC and ECM.

**2nd Light Battalion:** four companies (A–D) organised exactly as 1st Battalion but all with
Reaction 3,3,2,2,2,2,1 — 17 pts.

The fifth shuttle bay carries the **1st Independent Armoured Company** — Reaction 5,5,5,5,1,1,1,1 — 24
pts — 6 Grav tanks with Heavy armour, full vehicle NBC and ECM, mounting crew-served energy weapons.

The Brigade is supported on the ground by a Fighter Group carried in the Satyr's own fighter bay:
**The Fighter Wing** — Reaction 5,5,5,5,1,1,1,1 — 24 pts — 6 atmosphere-capable fighters, each mounting
a crew-served energy weapon with full vehicle NBC and ECM; in ground-attack configuration they can
also be fitted with a rack of two man-portable guided missiles, normally with conventional warheads.

The Satyr Brigade, while small, is flexible: the 1st Independent Armoured Coy. can be combined with
the "D" companies from both battalions to form a small mechanised battalion — though that leaves the
rest of the infantry to play a very "leg" role.

### Ground Support in "Hellfire"

Space forces can help the ground troops beyond transport:

- **Orbital artillery** — not much use in police actions/counter-insurgency unless things get very
  bad, but useful in a proper war.
- **Local defence backup** — ship's crews are trained personnel who can bolster an isolated outpost;
  e.g. a Cruiser (or similar) fitted with a shuttle bay can land, for example, **24 bases of marines**
  in support of local forces.
- Even merchant ships carry a small security contingent (companies won't pay for large crews, "but
  one base of security men per ship is not unreasonable" — better trained/equipped than most
  paramilitary forces, but not up to regular-military standard.
- Naval vessels are different: on top of any Marine detachment carried, a Naval ship could spare
  **one base of armed crewmen per 10 Mass of the ship** — better trained/equipped than most
  paramilitary forces, though still not regular-military standard.
- **Loaning heavy weapons:** while A and B naval Batteries would be hard to use outside fixed
  emplacements/wired directly into a city's power grid, smaller weapons such as C batteries could
  conceivably be stripped from the ship's mounts and fitted on improvised carriages to create
  makeshift armoured vehicles or direct-fire artillery. Similarly, PDAF/ADAF systems could be
  cannibalised to provide jury-rigged anti-air defences or crew-served weapons.

## Interfacing With Other Systems (p. 20)

The Dirtside II and Hellfire interface rules given here should give sufficient guidelines/ideas to
work out interfaces for **other** ground-combat systems of choice (the text specifically anticipates
1/300 combined-arms systems and larger-scale infantry systems such as **15mm or 25mm — i.e.
Stargrunt/the forthcoming Stargrunt II**). In most cases the troop-transport rules and CS/MASS
calculations here can be used as they stand, and the text suggests the DIRTSIDE II conversion system
is probably the easier one to relate unit and vehicle sizes in other rules to, where points values
matter. "There are a lot of other good SF ground-combat rules about... it would be unfair to mention
some and leave out others... use the set you are personally happiest with."

---

## Against the repository

The repository's Full Thrust engine (`src/engine/`), campaign layer (`src/campaign/`) and Dirtside II
engine (`src/dirtside/`) were checked against every rule/table above.

### 1. Cargo Space (CS) unit and conversion (1 MASS = 50 CS) — MISSING

**MT rule:** 1 MASS of a Transport's cargo capacity = 50 CS. Vehicle CS = Size class × 4; 1 man =
4 CS normal / 1 CS Cryosleep.

**Repository state:** There is no CS concept anywhere. `src/engine/types.ts`/`techbase.ts` define a
`cargo` FT system (Cargo holds, universal tech, 0 technology choices) used for generic freight, and a
separate `troop-berthing`/`passenger-berthing` pair (`src/data/buildCatalog.ts:167`: `{ kind:
'troop-berthing', label: "Troops", mass: 1, points: 0 }`), which implements the *Continuum rulebook*
13.13 rate (1 mass = 3 Marines, 0 points/mass, Marines bought separately) — a different, unrelated
troop-carrying system from More Thrust's Assault-Transport/CS design. Neither is connected to
Dirtside II's Cargo Space units, and `src/dirtside/design.ts`'s own `capacityOf()`/`transport.*`
fields (line/powered teams, cargo loads, carried vehicle sizes) are DS2's internal *vehicle* capacity
system (p. 8 of the DS2 book — a vehicle's own hold, e.g. an APC), not the interstellar
ship-to-planet CS conversion. **Plug-in point:** a new pure function, e.g.
`src/campaign/interface.ts`, exporting `cargoSpaceOf(vehicleSize)`, `cargoSpaceOfTroop(frozen:
boolean)`, and `massToCs(mass)` (× 50), consumed by a ship→battle handoff function.

### 2. Assault Transport troop/vehicle accommodation points cost (1 pt/50 CS; 10 pt/MASS cryo) — MISSING

**MT rule:** normal accommodation costs 1 point per 50 CS (= 1 point per MASS); Cryosleep costs 1
point per 5 CS (= 10 points per MASS).

**Repository state:** `src/data/designPricing.ts` prices `marineParties` (a boarding-party stat; the
code cites FT rule "12.7, 14.3" at `designPricing.ts:762`, with 13.13 governing the related
parties-vs-crew cap) and `troop-berthing` (0 points/mass, Continuum 13.13), but nothing prices Cargo Mass
allocated to Dirtside-style troop accommodation at these two rates. **Plug-in point:** an addition to
`designPricing.ts`'s per-system pricing table, gated behind a campaign/Dirtside-interface flag so it
does not perturb the plain Full Thrust point costs.

### 3. Drop capability (interface craft): 1 MASS delivers 10 CS; costs 2 points/MASS — MISSING

**MT rule:** a drop system (shuttle/Dropship/etc.) needs 1 MASS to deliver 10 CS of troops/vehicles
to the surface, at a cost of 2 points per MASS of drop capacity.

**Repository state:** no drop-capability concept exists in `src/engine/` or `src/campaign/`. The only
adjacent Dirtside-side idea is `INTERFACE_LANDING_PERCENT = 25` in `src/dirtside/data/costs.ts:43`
(DS2's own p. 52–53 points system: interface-landing capability costs +25% of the *landed element's*
total points cost) and `DROP_TROOP_PERCENT = 50` (drop-troop capability, +50%) — both are DS2-side
percentages, and **neither constant is referenced anywhere else in the codebase** (`grep` for
`INTERFACE_LANDING_PERCENT`/`DROP_TROOP_PERCENT` outside `costs.ts` returns nothing), so even DS2's
own interface-landing cost is unwired dead data. The FT-side "2 points/MASS, 10 CS/MASS" rate from
More Thrust has no counterpart at all. **Plug-in point:** `src/campaign/interface.ts` (new) for the
FT-side rate, and wiring `INTERFACE_LANDING_PERCENT`/`DROP_TROOP_PERCENT` into
`src/dirtside/pricing.ts` for the DS2-side rate — the two are meant to be alternatives for the two
directions of the same conversion, not duplicates.

### 4. Interface Craft and Hangar Bays (2 pts/MASS craft; 2/3/4-pt bay tiers) — MISSING

**MT rule:** interface craft cost 2 points/MASS; hangar bays come in MASS-6+ sizes, costing 2 points
(MASS 6), 3 points (MASS 7–12), 4 points (MASS 13–18), etc.

**Repository state:** the FT engine already has a generic Hangar Bay / Fighter Group Bay system
(`src/engine/fighters.ts`, `docs/rules/fighters.md`) with its own MASS-6 bay convention and its own
threshold/loss rules, which the interface craft rule explicitly piggybacks on ("MASS 6, like a
Fighter Group Bay"). That existing bay machinery is reusable, but there is no "Interface Craft" ship
system distinct from a Fighter, no 2-points/MASS craft costing, and no bay-size cost ladder (2/3/4
points per 6-MASS step) anywhere in `src/engine/` or `src/data/designPricing.ts`. **Plug-in point:**
extend `src/engine/fighters.ts`'s bay-sizing logic (or add a sibling module) with an "interface craft"
craft kind, and add the bay-size cost ladder to `designPricing.ts`.

### 5. Ortillery from ordinary warships (Escort=1 sheaf, Cruiser=2, Capital=3; 4" beaten zone; 3 chits/element) — MISSING

**MT rule:** non-specialised Escorts/Frigates fire one converged-sheaf burst (4" diameter beaten
zone), Cruisers two, Capitals three; elements in the zone draw 3 chits each, resolved as HEF
(infantry) or MAK (vehicles); a NUKE marker (2" no-approach) follows.

**Repository state:** `docs/rules/dirtside.md` already digests DS2's own Ortillery section in full
(`### ORTILLERY`, lines 2645–2655, plus the deviation description and "Ortillery Batteries" cost entry
at line 3939) — but this is prose documentation only, with **no corresponding resolver anywhere in the
code**: `grep` for "deviation" across `src/dirtside/` returns zero matches, and `src/dirtside/table/
tableFire.ts` (`planTableShot`, `resolveChitShot`) resolves only direct, on-table small-arms/vehicle
fire, not an off-table indirect-fire mission with a D12 clockface + D6-vs-D8 deviation roll. The only
"artillery" the engine currently models (`src/dirtside/pricing.ts`, `design.ts`, `types.ts`'s
`ArtilleryClass`) is a vehicle's on-board direct-fire weapon mount, unrelated to an off-table battery.
Nor does anything in `src/engine/` (Full Thrust side) derive an Ortillery "sheaf count" from a ship's
hull class the way More Thrust does; `src/campaign/campaign.ts`'s `bombard()` function only implements
the *campaign strategic-layer* bombardment (kills population by ortillery-system count, `campaign.md`'s
own abstracted rule — unrelated to a tactical DS2 table's beaten zone/chits). **Plug-in point:** a
`sheafCountForHullClass()` helper in `src/campaign/interface.ts`, feeding a **new** off-table
Artillery/Ortillery resolver (implementing the D12/D6-vs-D8 deviation roll and chit draw from
`docs/rules/dirtside.md`'s ORTILLERY section) that does not yet exist anywhere in `src/dirtside/table/`
— there is no existing function to extend, so this is new machinery, not a hookup to `tableFire.ts`.

### 6. Planetary Bombardment Monitor (1 attack/Ortillery system/turn; 8" beaten zone; 4 chits/element) — MISSING

**MT rule:** a PBM makes one attack per Ortillery system aboard per turn; beaten zone is 4" radius (8"
diameter, twice the ordinary-warship zone); 4 chits per element in the zone.

**Repository state:** no PBM ship type, system kind, or attack-count rule exists in `src/engine/` (no
`ortillery` count → attacks/turn mapping) or `src/dirtside/`. `docs/rules/dirtside.md` covers the
DS2-side Ortillery battery mechanics generically but has no notion of a specialised orbital-monitor
ship distinct from an ordinary warship's converged sheaf. **Plug-in point:** same
`src/campaign/interface.ts` module — a PBM is simply "ortillery systems aboard × 1 attack, 8"
zone, 4 chits" versus the ordinary-warship "hull class → 1/2/3 sheafs, 4" zone, 3 chits" — both
would call into the same new off-table resolver described under item 5 above (not `tableFire.ts`,
which has no off-table-fire logic to call into).

### 7. Orbital availability (d6 turn roll; recurs every 6th turn) — MISSING

**MT rule:** roll 1d6 at game start for which DS2 turn number the orbiting ship is overhead and can
give support; it recurs every 6th turn thereafter.

**Repository state:** `src/dirtside/dice.ts` has the generic dice-stream primitives this would need,
and `src/dirtside/table/game.ts` runs the turn loop, but there is no "orbital window" concept at all.
**Plug-in point:** a small helper (e.g. `orbitalSupportWindow(roll: number, turn: number): boolean`)
in `src/campaign/interface.ts`, called from the DS2 table setup/turn loop when a scenario grants
orbital support.

### 8. Full Thrust Fighters used directly as DS2 Aerospace units (no conversion; 1 mission/turn from an orbiting carrier) — MISSING

**MT rule:** most FT Fighter types double as DS2 Aerospace Fighters with no stat conversion; limited
to one ground-attack mission per turn, launched from a carrier/mothership in orbit, reverting to FT
rules on return to orbit.

**Repository state:** `src/engine/fighters.ts` is the FT fighter engine; `src/dirtside/types.ts` and
`src/dirtside/data/mobility.ts` define DS2's own `aerospace`/`vtol` mobility kinds and
`docs/rules/dirtside.md`'s Aerospace Operations chapter (§10, p. 41–43) as an independent DS2 vehicle
design (a DS2 aerospace craft is *designed* with the DS2 vehicle-design rules — size class, weapons,
armour — not read off an FT Fighter's stat line). There is no bridge converting one `FighterFlight`
(`src/engine/fighters.ts`) into one DS2 `VehicleDesign`/`ElementSetup` (`src/dirtside/table/types.ts`),
and no one-mission-per-turn / orbit-return bookkeeping. **Plug-in point:** a converter function
mapping an FT fighter design to a DS2 `VehicleDesign` stub (mobility `'aerospace'`, weapons carried
over), living beside `src/dirtside/design.ts`, plus a per-turn flag on the DS2 `GameState` (limits
already exist for other one-shot-per-activation abilities, e.g. `OpportunityWindow` in
`src/dirtside/table/types.ts`, that this could follow the shape of).

### 9. Marine contingent sizing (ship MASS × 4 = CS) and per-class contingent tables — PARTIALLY PRESENT, DIFFERENT MODEL

**MT rule:** a warship's Marine contingent size in CS = total ship MASS × 4, spent per the CS rules
above; printed example tables give exact unit compositions for seven hull classes from Frigate
(MASS 10, 40 CS) up to Light Carrier (MASS 70, 280 CS).

**Repository state:** the repo already has a real, wired-in `marineParties` stat on every ship design
(`src/engine/types.ts:475`; populated for every ship in `src/data/generatedShips.ts` and
`src/data/ships.ts`; priced in `src/data/designPricing.ts:760`; consumed by Full Thrust boarding
combat in `src/engine/boarding.ts` and `src/engine/weapons/beams.ts:929` for commando-raid mode) —
but this is FT's own rule 12.7 (priced under "12.7, 14.3", per `designPricing.ts:762`) Marine-party
count for *ship-to-ship boarding*, not the
More-Thrust "MASS × 4 = CS, spend on a DS2 unit roster" system. The campaign layer's `assault()`
(`src/campaign/campaign.ts:742`) and `resolveAssault()` (`src/campaign/turn.ts:951`) reuse the same
`marineParties` number as a bare headcount thrown against a PDU/Advanced-PDU/shield gate — the code's
own comment at `campaign.ts:748` flags this as a reading-gap fill-in ("the rules say PDUs repulse a
landing and nothing about how they are reduced... [this] is here"), not a transcription of any DS2
rule. **No** CS-based sizing, no per-hull-class roster table, and no actual DS2 battle is ever
generated from a boarding force. **Plug-in point:** `marineContingentCs(mass) = mass * 4` in
`src/campaign/interface.ts`, and a converter from that CS budget into a DS2 `UnitSetup` roster
(`src/dirtside/table/types.ts`) — this is the natural place the "hand a campaign's planetary battle
to Dirtside II" pipeline the task describes would start.

### 10. Damage to Troop Transports (percentile roll per element, chance = ship's % Damage Points lost) — MISSING

**MT rule:** when a loaded Transport is damaged, roll percentile dice per embarked unit/element, with
a chance equal to the percentage of the ship's Damage Points already lost; roll once, at game end or
at deployment.

**Repository state:** the Full Thrust Freighter cargo-loss rule this is explicitly modelled on (FT
rulebook p. 23) is implemented for generic cargo in `src/engine/` (`cargo` system + threshold/damage
plumbing in `src/engine/threshold.ts`), but nothing extends it to a troop/vehicle roster attached to
a transport, and there is no board manifest of "embarked units" on any `CampaignShip`
(`src/campaign/types.ts:346`) or FT `ship` type to roll against. **Plug-in point:** add an
`embarkedUnits` list to `CampaignShip`/`TaskForce` (`src/campaign/types.ts`) and a
`troopTransportLosses(percentDamage, units, rng)` function in `src/campaign/interface.ts`, reusing
`src/campaign/intel.ts`'s `CampaignRng` plumbing for the percentile rolls.

### 11. Full Thrust / Hellfire interface (ship types, Satyr example, infantry housing rates, Satyr Brigade roster) — MISSING (and no Hellfire support of any kind in the repo)

**MT rule:** an entire second, looser interface system (In-System Troopship / Marine-shuttle warship
/ Space Marine Troopship / Converted Bulk Carrier / Container Freighter ship types; infantry housed
at 8 bases/spare-Mass on military hulls or 16 bases/spare-Mass on merchant hulls, capped at 1
base/overall-Mass; a full worked example, the Satyr, with its Brigade roster in Hellfire stats).

**Repository state:** the repository has no Hellfire data at all — `grep` for "Hellfire" anywhere
under `src/` or `docs/rules/` returns nothing. This is expected, since Hellfire is a third-party ruleset
the project has not otherwise ingested, and the task's stated destination is Dirtside II → Stargrunt
II, not Hellfire. No plug-in point is recommended unless the project later adds Hellfire as a
supported ground system.

### 12. "Interfacing with other systems" (guidance to reuse the DS2 CS/points conversion for a system such as Stargrunt) — GUIDANCE ONLY, NO CODE TO PLUG IN YET

**MT rule:** points-based ground systems generally, and the (at time of writing, forthcoming)
STARGRUNT II specifically, are expected to reuse the DIRTSIDE II CS/MASS conversion above rather than
needing a new one.

**Repository state:** there is no `src/stargrunt/` (or equivalent) module yet — `src/dirtside/` is the
only ground-combat engine — so this rule is presently just the intended justification for point 9's
"MASS × 4 = CS → unit roster" pipeline being written generically enough to target either
`src/dirtside/table/types.ts`'s `UnitSetup`/`ElementSetup` today or an equivalent Stargrunt II type
later, rather than a Dirtside-specific one-off. Once a Stargrunt II engine exists, the same
`src/campaign/interface.ts` CS/MASS functions (items 1–3, 9) should be the shared numeric core for
both targets, per the source's own recommendation that "the DIRTSIDE II conversion system where
points values are important" is "probably the easier one to relate" other systems' units to.

<details><summary>Checker's corrections</summary>

Checked against `mt/mt-p15.png` through `mt-p20.png` (image inspection, with targeted high-resolution
crops for every stat block and table cell) and, for the repository section, against the actual
`Full-Thrust-Multiplayer-` source tree. Changes made to the first reader's draft:

**Numbers/stats wrong on the page:**
1. **Hellfire "Reaction" stats, 1st Battalion companies (p. 20):** A/B/C/D Company were each given as
   `Reaction 3,3,2,2,3,2,2` (7 values); the page prints 8 values, `3,3,2,2,3,2,2,2`, for all four
   companies — corrected.
2. **D (Mechanised) Company's points cost (p. 20):** the draft gave D Company a Reaction line but no
   points value; the page prints **19 pts** for D Company too (identical to A/B/C) — added.
3. **1st Independent Armoured Company Reaction (p. 20):** given as `5,5,5,1,1,1` (6 values); the page
   prints 8 values, `5,5,5,5,1,1,1,1` — corrected.
4. **The Fighter Wing Reaction (p. 20):** same error as #3 — `5,5,5,1,1,1` corrected to
   `5,5,5,5,1,1,1,1`.
5. **Missile Vehicles' Size Class in the DIRTSIDE II Combat Group CS table (p. 16):** given as Class 3;
   the page prints Class **4** (consistent with the printed CS figure of 32 for 2 vehicles: 2 × 4 × 4 =
   32, not 2 × 3 × 4 = 24) — corrected.
6. **Hangar-bay size in the worked-example cost breakdown (p. 16):** "plus 3 points for the (Mass-6)
   bay" — the example's drop capability is 10 MASS (two Mass-5 Dropships in one bay, per the p. 16
   diagram caption "one MASS 10 Hangar Bay containing two MASS 5 Dropships"), so the bay is Mass-10,
   not Mass-6 (the 3-point cost itself was already correct, since Mass 10 falls in the "7 to 12" cost
   bracket) — corrected to "(Mass-10) bay".
7. **Fighters' ground-attack sortie rate (p. 17):** the draft said fighters "may only fly one
   ground-attack mission per game **turn**"; the page says one mission per **game** (i.e. once for the
   whole game, not once per turn) — corrected, since this reverses the rule's restrictiveness.

**Wrong/misattributed on the page:**
8. **DIRTSIDE II interface authorship (p. 15):** the draft credited the DS2 interface as written by
   Mike Elliott "with input from Jim Webster." The page says the DS2 interface had "additional input
   from myself" (the book's own author) — Jim Webster is credited only for writing the separate
   Hellfire interface. Corrected the attribution and restored the adjacent sentence the draft had
   dropped, that the Hellfire system lets ships carry more troops than the DS2 version (the actual
   stated reason the two interfaces were left inconsistent).

**Invented text not on the page:**
9. **DS2 Combat Group drop-capability paragraph (p. 16):** the draft added "(since each dropship in the
   example carries a Mass-10 hangar bay's worth, see below)" — this clause is not in the source and is
   also confusing/wrong as stated (the Mass-10 bay in the worked example holds *two* Mass-5 Dropships
   together per ship, not one dropship per Mass-10 bay). Removed and the surrounding sentence
   reworded to track the page's actual wording.

**Left out of the draft (restored):**
10. A whole paragraph on p. 18 was dropped entirely: that the Marine contingent tables have the right
    "feel" for their ship's size — larger ships' detachments fielding a small DIRTSIDE II engagement,
    smaller ones fielding "surgical strike"/security teams for a 15/25mm system such as STARGRUNT.
    Restored.
11. The Heinlein *Starship Troopers* reference for Drop Capsules (p. 15), the Royal Navy
    *Fearless*/*Intrepid* and Vietnam-Huey aside on why full-load drops are impractical (p. 15–16), the
    "Games Workshop" attribution for Space Hulk (p. 18), the Hellfire author's-note caveat that the
    interface may "contravene the normal Full Thrust design rules" and its "hover pickup with a mining
    laser" simile (p. 19), and the Container Freighter's point that troop contingents stay aboard their
    landing craft the whole voyage (p. 19) were all present on the page but dropped from the draft.
    Restored (condensed marketing/ordering details — GZG's price, postage and mail-order address for
    Dirtside II and Hellfire — were left out on purpose, as non-rule content).

**Against-the-repository section, spot-checked with `grep`/`sed` against `Full-Thrust-Multiplayer-`:**
12. **Points 5 and 6 overstated the engine's state.** They claimed `src/dirtside/table/tableFire.ts`
    has "existing artillery/deviation resolution... already used for Ortillery batteries," and that a
    new sheaf-count/PBM helper would be "callable from `tableFire.ts`." This is wrong: `grep` for
    "deviation" across all of `src/dirtside/` returns **zero** matches, and `tableFire.ts` only exports
    direct/on-table shot functions (`planTableShot`, `resolveChitShot`, `rifleRange`, etc.) — there is
    no off-table Artillery/Ortillery fire-mission resolver (D12 clockface deviation, D6-vs-D8 roll,
    chit draws) anywhere in the codebase to plug into. The engine's only "artillery" (`pricing.ts`,
    `design.ts`, `types.ts`'s `ArtilleryClass`) is a vehicle's on-board direct-fire weapon mount, not an
    off-table indirect-fire mission. Corrected both entries to say the sheaf-count/PBM helpers would
    need a **new** resolver module, since none exists to extend.
13. **Points 2 and 9 mis-cited the rule reference on `marineParties` pricing.** Both said the code cites
    "FT rule 12.7/13.13." The actual line, `designPricing.ts:762`, reads
    `add('crew', 'Marine parties', '12.7, 14.3', ...)` — the pricing rule cited in code is 12.7/14.3;
    13.13 governs the separate parties-vs-crew cap (`designPricing.ts:753`, `:1434`), not this specific
    price line. Corrected the citations in both places.
14. All other spot-checked claims held up: `troop-berthing` at `buildCatalog.ts:167` matches verbatim;
    `INTERFACE_LANDING_PERCENT`/`DROP_TROOP_PERCENT` at `costs.ts:43-44` are real and, confirmed by
    `grep`, referenced nowhere else in the codebase; `marineParties` on `types.ts:475`, priced at
    `designPricing.ts:760`, and consumed in `campaign.ts:742`, `turn.ts:951`, `beams.ts:929` all check
    out, including the `campaign.ts:748` "reading-gap" comment; `docs/rules/dirtside.md`'s `### ORTILLERY`
    header is at line 2645 and its "Ortillery Batteries" cost entry at line 3939, both exactly as cited;
    a repo-wide `grep` for "Hellfire" and for `*stargrunt*` paths both return nothing, confirming points
    11 and 12; and `OpportunityWindow`, DS2's `aerospace`/`vtol` mobility kinds, `docs/rules/fighters.md`,
    and `CampaignRng` in `intel.ts` all exist as described.

</details>

---

# Chunk 4 · pp. 21–27 · tournament games, ship designs, the Kra'Vak

Source: *More Thrust* (Full Thrust supplement, GZG), pages 21–27, read from the page images
(`mt-p21.png`…`mt-p27.png`) because the PDF's text layer has scrambled column order. Page 20
(`mt-p20.png`) was also opened, off-range, only to confirm the meaning of the lettered "A/B/C"
battery icons used on p.23 (it names "A and B batteries" and "C batteries" in passing) — nothing
from p.20's own content (Combining With Ground Combat Games) is digested below.

---

## 7. COMPETITIVE AND TOURNAMENT GAMES (p.21)

Framing: Full Thrust "was never intended to be a 'Competition' style game," but its simplicity has
made it a viable tournament base; the notes are a **guide**, not a mandate — organizers may modify
or ignore them.

**Ship design and fleet composition** — two options:
- **(a) LIMITED**: players use only the stock ship classes from the core rulebook, unmodified, up to
  an agreed Mass cap for their class. Free choice of weapons/systems within a class's normal limits,
  but the class's Hull Mass is fixed to what the rulebook prints — no exploiting the gap between
  Escort/Cruiser/Capital break points (cross-ref: "see notes on P.5 of this supplement"). Example
  given: a Destroyer hull is Mass 14, and a player may arm it however they like *within that hull*
  but may **not** stretch it to a "special" Mass-18 hull.
- **(b) OPEN**: players may design their own ships, but it's suggested entrants stay within the
  standard Hull Mass ratings for Escort/Cruiser/Capital (again to block break-point abuse).
- A stricter, "fixed identical force" variant of (a) is also suggested for one-day/"turn up and
  play" events, where every player gets the same pre-built fleet.
- Recommendation: models should carry a hidden ID marking their actual hull class (e.g. "FF-1",
  "CL-2") on the base, visible only to the opponent, so mass/class is knowable without revealing the
  exact build.

**Size of fleets**: suggested **≈1500 points** total for a playable, completable game; **1000
points** is workable; **2000+ points** is "probably a bit large unless plenty of time and table
space is available."

**Type of game and scenario**: most competitive games are "meeting engagements" — fleets enter from
different table edges at a pre-agreed velocity, ideally from *slightly converging* vectors off
opposite edges rather than dead-on opposite edges. A few randomly-placed asteroids can be added for
flavor (optionally with movement, "if the organisers are REALLY feeling nasty").

**Suggested special rules and limitations (i–viii)**:
1. **No FTL** entry/exit during the game (assume combat is too deep in-system); all ships must be
   FTL-capable (System Defence ships barred).
2. **No stationary installations**, unless part of a specific scenario.
3. **Fighter Morale** rules (ref: "P.10 of this volume") should be used even in LIMITED games,
   including their Endurance limits, at the organizers' discretion.
4. **Sensors**: organizers' discretion — either the simple core-rulebook sensor rule or this
   supplement's more detailed one; recommendation is to skip sensors and play with all ships visible
   at all times.
5. An **umpire** (ideally two) should adjudicate written movement orders; umpire decisions on
   position disputes and "creative"/deliberately vague order-writing are final.
6. Ships that leave the table (deliberately or by accident) may **not** return during that game.
7. **Damage Control**: base-book DCP rules may be permitted at organizer's discretion, "in a
   slightly modified form": DCP teams are capped by class — **1 DCP for Escort/Corvette-size and
   larger, 2 for Cruisers, 3 for Capital ships**; these teams are automatically included at **no
   points cost and no Mass cost**; extra DCPs may **not** be bought with points; DCPs **cannot** be
   lost to threshold rolls and are not marked on the ship record diagram. All other DCP rules apply
   as in this book.
8. Anoraks are **not** to be worn at the table ("the hoods won't fit over the Space Helmets").

**Reproduction note**: organizers are granted permission to copy limited portions of this book and
the core rulebook for competition use (ship record charts, quick-reference sheets), but **not** full
or partial rulebook reproduction for supplying to entrants or any other purpose; bulk rulebook orders
should go through the publisher.

---

## 8. SHIP DESIGNS (pp.22–23)

### Superships (over Mass 100)
1. Ships **over Mass 100** are "Superships." Hull cost is the same rate as any other ship: **2×Mass
   for Warships, 1.5×Mass for Merchants.**
2. FTL drives cost the same as any ship (= Mass of the ship). **Normal-space drives cost 2×Mass per
   1 thrust factor** (example given: a Mass-150 Supership with 2 thrust pays 2×150 = 300 points per
   thrust factor, × 2 thrust = **600 points** total for its drives — the book's own example, "300 x 2
   = 600 points"; the digest this file corrects had mis-copied this as "300 points").
3. All Superships get the standard **3 FireCons** of a Capital ship, **plus 1 extra FireCon per full
   50 Mass over 100** (e.g. Mass 150–199 → 4 FireCons, Mass 200–249 → 5, and so on); more FireCons
   may be bought as normal for any design.
4. Weapon-fit cap: Military Superships may spend up to **50%** of Mass on weapons/systems (**75%** if
   the ship has no FTL drive); Merchant Superships up to **10%**.
5. Damage boxes are at the **standard rate of all ships: 1 box per 2 Mass.** Superships of **101–150
   Mass use 5 lines** of damage boxes; **151–200 use 6**, "and so on, adding one extra line per 50
   additional Mass." Threshold rolls at the end of each line: **6+ on line 1** (as usual), **drops to
   4+ by line 3**, then **remains 4+ for every following line**.

### Expanded space installation rules
- (i) For installations over Mass 100, use the Supership rules above to size damage boxes/FireCons.
- (ii) For *very* large bases, treat them as several independently-tracked sections joined together,
  each with its own Damage Points and FireCon systems. Worked example: a Mass-600 station split into
  **6 sections of Mass 100 each** (5 outer + 1 central "core"); outer sections get a limited
  (one-fifth-arc) fire arc each, the core has all-round fire. Random-hit rule for incoming fire:
  sections numbered 1–6, hit location is randomised by die roll; fire from **18"+** targets a
  section at random, fire from **closer than 18"** may be specifically targeted. If one section of a
  multi-unit station is reduced to 0 Damage Points, **every adjacent section immediately takes damage
  equal to the roll of a number of dice equal to the number of damage-box ROWS the destroyed section
  had** — worked example: destroying section 3 (of the six) would deal **5d6** each to adjacent
  sections 2, 4 and 6.

### New General Designs (14 ships, p.23)
Designer's note: the "official" CMD-range ship stats (NAC, ESU, FSE, NSL, etc.) were deliberately
left out of this book — a separate lower-budget "Book of Fleets" was planned for those (a facing note
on p.23 gives its expected release as **"mid-late summer 1994"**). The new designs below are meant to be **generic**, usable with any background; the
only exception to "generic-only" is the Kra'Vak designs on p.27, included because they illustrate
this section's new race-specific rules.

Each stat line below is **Name / Mass / Points / Thrust rating** (the boxed number on the SSD),
followed by the weapon/system fit read off the diagram icons. **Icon key used** (reconstructed from
context inside pp.20–27, since the actual symbol legend is on an earlier page not in this excerpt):
`⊗` = a Beam Battery (undifferentiated); a circled letter **A/B/C** = a Beam Battery of a specified
class (A = heaviest/class-3, B = medium/class-2, C = lightest/class-1 — the same three ratings the
book equates to the Kra'Vak's class-1/2/3 Railguns on p.25); a small tick line above a symbol = the
weapon is bow/forward-arc mounted, a dash beside it = broadside (Port/Starboard); a vertical
half-black/half-white bar = a Pulse Torpedo tube; a finned dart shape = a Salvo Missile launcher; a
solid triangle over a small ring = (very likely) also a missile-type launcher; a solid triangle with
a dot *inside* it = a Fighter Bay; the antenna-arcs-over-a-dot icon = a Sensor; the small square with
a centred dot = a FireCon; a plain solid dot on a straight mast (no arcs) = an uncertain system,
tentatively a **Needle Beam** (this supplement's armour-piercing beam upgrade — it appears only on
the two ships whose names reference it, Needle Cruiser and the raider-flavoured Privateer). Hull
damage-box grids are also sketched below (rows × open/filled boxes as drawn) for completeness, but
their exact rules meaning (why some boxes are drawn filled) is not explained on pp.21–27 itself, so
treat those counts as a description of the diagram, not a verified formula.

| Ship | Mass | Points | Thrust | Weapon/system fit (icons) | Hull box grid (as drawn) |
|---|---|---|---|---|---|
| **Strikeboat** | 4 | 26 | 8 | 1× triangle-over-ring (missile?), 1× ⊗ beam, 1× FireCon | 2 rows × 5 (1 open + 4 filled each row) |
| **Lancer** | 6 | 39 | 8 | 1× ⊗ beam, 2× triangle-over-ring (missile?), 1× FireCon | 2 rows × 5 (row1: 1 open+4 filled; row2: 2 open+3 filled) |
| **Torpedo Destroyer** | 14 | 86 | 6 | 1× Pulse-Torpedo bar, 1× C-class beam, 1× ⊗ beam, 1× FireCon | 2 rows × 5 (≈7 open + 3 filled total) |
| **Super Destroyer** | 16 | 105 | 6 | 3× B-class beam (1 nose + 2 wing), 2× ⊗ beam (corners), 1× FireCon | 2 rows × 5 (8 open + 2 filled) |
| **Privateer** | 18 | 137 | 8 | 1× mast icon (Needle Beam?), 1× A-class beam, 1× ⊗ beam, 1× Sensor, 1× FireCon | 2 rows × 5 (9 open + 1 filled) |
| **Needle Cruiser** | 22 | 187 | 6 | 1× mast icon (Needle Beam?), 2× B-class beam, 1× Sensor, 2× ⊗ beam, 2× FireCon | 3 rows × 6 (11 open + 7 filled: row1 3+3, row2 4+2, row3 4+2) |
| **Strike Cruiser** | 28 | 198 | 4 | 1× ⊗ beam, 2× Pulse-Torpedo bars, 1× Sensor, 2× FireCon | 3 rows × 6 (14 open + 4 filled: row1 4+2, row2 5+1, row3 5+1) |
| **Missile Cruiser** | 26 | 187 | 4 | 1× C-class beam, 4× finned-dart Salvo Missile launchers, 1× Sensor, 1× ⊗ beam, 2× FireCon | 3 rows × 6 (13 open + 5 filled) |
| **Planetary Bombardment Monitor** | 32 | 198 | 2 | 1× B-class beam, 3× triangle ordnance icons (bombardment/missile), 1× Sensor, 2× ⊗ beam, 2× FireCon | 3 rows × 6 (16 open + 2 filled: row1 5+1, row2 5+1, row3 6+0) |
| **System Defence Cruiser** | 32 | 252 | 4 | 5× A-class beam (1 nose + 2+2 wing), 3× ⊗ beam, 2× Sensor, 2× FireCon | 3 rows × 6 (16 open + 2 filled) |
| **Escort/Patrol Carrier** | 40 | 286 | 2 | 3× C-class beam, 2× ⊗ beam, 2× Fighter Bays, 1× Sensor, 3× FireCon | 4 rows × 14 (largest grid of the fourteen; uniform 5 open + 9 filled per row, 20 open + 36 filled total — not gradated toward the aft rows) |
| **Free Trader** | 10 | 50 | 2 | 1× C-class beam, 1× FireCon (no Sensor, no second weapon) | 2 rows × 5 (3 open + 7 filled) |
| **Medium Tug** | 32 | 224 | 2 | 2× C-class beam, 2× ⊗ beam, 1× FireCon | 3 rows × 6 (2 rows part-filled, 3rd row fully filled) |
| **Armed Merchantman** | 36 | 178 | 2 | 2× C-class beam, 2× ⊗ beam, 1× FireCon (no Sensor) | 3 rows × 6 (≈9 open + 9 filled) |

Note the visible design logic: escort/attack boats favor high Thrust (6–8) with light armament;
the two purpose-named ordnance ships (Missile Cruiser, Planetary Bombardment Monitor) carry the
most launcher icons; merchant/utility hulls (Free Trader, Medium Tug, Armed Merchantman) all sit at
Thrust 2 with a single beam pair for self-defence and no Sensor fit.

---

## 9. XENO FILE 1: THE KRA'VAK (pp.24–27, start of the file)

### Contact! (p.24, fiction)
In-universe vignette: the Pan-African Union Battlecruiser *Kinshasa* (Capt. Joshua N'goka) makes
first contact with an unidentified, non-human-built ship near the New Lusaka system. The alien has
no IFF transponder, no response to hails, a "twin-boomed hull" roughly the tonnage of a human
destroyer but greater hull density, no detectable energy-screen or beam-weapon emission signature,
and an odd "muon flux" reading. Mid-hail, the alien ship opens fire without warning: **"the colossal
kinetic impact of the hypervelocity penetrators fired from the Kra'Vak ship's long forward
railguns"** wrecks the *Kinshasa*'s bridge and forward structure — establishing, narratively, that
Kra'Vak weapons are solid kinetic penetrators, not beams, and that they fire from the bow.

### Overview of Kra'Vak technology (p.25)
- Kra'Vak ships use **no energy weapons**; instead **electromagnetically-accelerated guns
  ("Railguns")** firing solid penetrators at very high velocity. A "small kinetic penetrator can
  cause quite massive damage... an energy screens used on human ships provide no effective defence
  against such weapons."
- Railgun accuracy **degrades with range** (targeting lag), but hit **probability and effective
  range are the same for every class** of railgun; only **damage** scales with class/calibre.
- Kra'Vak **normal-space manoeuvre drives are more efficient** than human ones: for the **same
  Mass/Points cost**, Kra'Vak ships get **better overall thrust ratings** than human classes, and can
  apply **more of their available thrust to course changes** (below).
- Kra'Vak ships **carry no Screens** — "of no use against the weapons they use for themselves (and
  therefore, as with most races, naturally assume that everyone else will use as well!)." Instead their hulls are
  built with **much heavier structural armour**, which protects against both projectile *and* energy
  fire; unlike a Screen generator, this **armour is integral to the hull** and is **not** a separate
  "system" that can be lost, nor can it be lost to a threshold roll.

### Kra'Vak thrust and manoeuvre (p.25)
- Kra'Vak ships move/manoeuvre by the normal rules, with **one exception**: they may use **more than
  half** their available thrust for **course changes**, up to **ALL** of their thrust rating. Example:
  a Kra'Vak ship of thrust 6 could make a full **180° "about-face" in a single move** (though this is
  actually an L-shaped manoeuvre, not a turn-in-place, since course changes still split between the
  start and midpoint of the move as normal).
- This does **not** grant extra thrust: a ship that spends all its thrust on the course change has
  **none left** to accelerate or decelerate that turn.
- Effect: Kra'Vak ships are potentially far more manoeuvrable than human ships of the same thrust
  rating, which **partially compensates** for the Kra'Vak's more restricted weapon fire arcs (below).
- Kra'Vak Normal Space Drives are **costed at the same price as human drives** — the extra
  manoeuvrability is a free bonus, not a paid-for upgrade.

### Kra'Vak armoured hull costs (p.25)
When costing a Kra'Vak (or any other race's) armoured hull, apply these Hull-cost multipliers:
- **Level-1 armour** (as on Kra'Vak Cruiser classes) costs an additional **25%** of normal Hull
  points, i.e. **2.5 × Mass of ship**.
- **Level-2 armour** (as on Kra'Vak Capital Ships) costs an additional **50%**, i.e. **3 × Mass of
  ship**.
(Ordinary, unarmoured Hull is the baseline 2× Mass from the core game.)

### Beam weapon fire against Kra'Vak armour (p.25)
When human ships fire **beam weapons** at armoured Kra'Vak hulls, the armour **does** reduce beam
damage, treated as an equivalent **Screen** level even though the Kra'Vak carry no actual screens:
- **Kra'Vak Cruisers**: treat as if they have **level-1 screening** against beam fire.
- **Kra'Vak Capital ships**: treat as if they have **level-2 screening** against beam fire.

### Kra'Vak Railguns (p.25)
- Available in **three classes: 1, 2, 3** (surprisingly numbered the same as human battery classes);
  a **class-1** railgun ≈ a human **"C" battery** in Mass terms; class-2/3 are heavier equivalents
  (≈ human "B"/"A").
- **All railgun classes share the same to-hit table and effective range**; only damage differs by
  class.
- **To-hit**: measure range, roll 1d6. **At 0–6" range, hit on 2+.** For **every additional 6" (or
  part thereof)**, the score needed **rises by 1**. Maximum effective range is **24–30"**, hit only
  on a **6**.
- **Damage** (on a hit): roll a second d6. **Score 1–3** → damage **equals the class** of the gun
  (1, 2 or 3 points). **Score 4–6** → damage is **doubled** (2, 4 or 6 points).
- **Vs. an ARMOURED hull** (Kra'Vak Cruiser/Capital targets always have this automatically):
  **subtract 1 from the damage die per level of armour**, before reading the 1–3/4–6 split — e.g. a
  Cruiser (armour level 1) only doubles railgun damage on a **5 or 6** roll; a Capital ship (armour
  level 2) only doubles on a natural **6**; all other rolls count as plain (un-doubled) damage equal
  to the gun's class.

### Railgun fire arcs (p.25)
Railguns are powerful but have **one major limitation**: each battery may only fire through **ONE**
fire arc — **Forward, Port, or Starboard** (never a combined/turret arc). Kra'Vak ships therefore
concentrate most of their heavy guns in the **Forward** arc and rely on manoeuvrability (above) to
keep enemies there; opposing ships that stay out of a Kra'Vak's forward arc face comparatively little
return fire.

### Railguns against screened targets (p.25)
Human (or other) ships that carry **Screens** as defence get **NO benefit** from them against
railgun fire: damage is rolled as if firing at an **unprotected/unscreened** ship, since energy
screens are designed against beam weapons and have no effect against kinetic penetrators.

### Kra'Vak "Scatterguns" (p.26)
- A close-in weapon unique to Kra'Vak warships: a **single-shot** device, "very like a giant shotgun
  blast," firing a cloud of many thousands of small hypervelocity penetrators. Kra'Vak ships carry
  only a **strictly limited number of Scattergun charges**.
- **Anti-ship mode**: **requires a FireCon**; effective range **12"**; nominate target and roll
  **1d6** — the score rolled **is** the number of Damage Points inflicted (a Scattergun shot is
  **guaranteed** to do at least 1 point — "its wide-cone effect... ensures that at least some [shots]
  will always find the target"). Several charges may be fired the same turn (each needs its own
  FireCon if aimed at separate targets).
- **Anti-fighter mode**: range **6"**, does **not** need a FireCon, may only engage **one fighter
  group that is actively attacking that ship**; roll **1d6** = number of fighters destroyed. **Heavy
  Fighter groups suffer only HALF (rounded down)** of that casualty count. (Optional "Advanced
  Fighter" rule cross-ref, p.12 of this book.)
- Once fired (either mode), the charge's symbol is **crossed off** the SSD and **may not be used
  again that battle**.
- Scatterguns are **turret-mounted**: unlike Railguns, they may fire into **ANY arc, including the
  rear** — "their scatter effect requires less positive targetting than most other weapons"; the
  symbol's orientation on the diagram has no bearing on its firing arc.

### Kra'Vak fighters (p.26, section header not legibly printed in the scan — a solid black banner
with no visible text; inferred topic from the paragraph beneath it)
Kra'Vak fighter groups are mechanically the same as human fighter groups, **except** they are always
treated as **Heavy Fighters** (per the Advanced Fighter rules, "P.12 of this book") due to their
heavier, armoured construction. Kra'Vak fighters use a kinetic-projectile weapon that, for
simplicity, is diced for exactly as a Railgun, **except it ignores Screens entirely** on the target
(damage rolled as if the target were unscreened); against an **armoured** target, the same
per-armour-level die subtraction as ship Railgun fire applies.

### Technological parity between the sides (p.26, section header likewise unreadable in the scan —
a solid black banner with no visible text; content inferred from the paragraph beneath it)
At the start of the "Xeno War" neither humans nor the Kra'Vak have any experience fighting the
other's technology. As the war progresses, both sides recover salvage/derelicts/prisoners and start
to learn the opponent's weapons and systems. The book explicitly says there is **no rule against**
mixing Human ship designs with Kra'Vak-style weapons/systems (or vice versa) if players agree, though
it suggests any resulting oddities be resolved "by amicable discussion," and that if one side adopts
"experimental" enemy tech it should cost noticeably more points (the visible fragment suggests **as
much as 50% more**) to reflect its unfamiliarity/incomplete understanding.

### Kra'Vak Basic Ship Designs (p.27)
Framed as **suggested example designs only** ("using the classes in the CMD model range"); players
may freely re-spec them. Kra'Vak vessels are noted as typically being built as **modular
assemblies** reconfigurable to mission needs (reflected in the CMD model kits). The Superdreadnought
and (Strike) Carrier classes are given **two points costs**, for two different Thrust options.

Icon key on this page (confirmed directly from the diagrams' own inline legends on pp.25–26): a
boxed number **1/2/3** = a **Railgun of that class**; a small tick above the box = **Forward-arc**
mount, a dash beside it = **Port/Starboard broadside** mount; a solid black inverted-teardrop = a
**Scattergun** charge; a filled circle-in-circle icon ("●" pair) = a **Sensor/FireCon-type system**
(exact identity not stated on this page); a triangle marked **"H"** = a **Hangar/Fighter (or
Strike-craft) Bay**. Hull grids again show a mix of open/filled boxes per row; given p.25's armoured-
hull rule, the filled portion plausibly represents the ship's **armour allocation**, but this isn't
stated explicitly for these specific diagrams either.

| Class | Type | Mass | Points | Thrust | Railguns | Scatterguns | Sensor/FireCon dots | Hangar ("H") |
|---|---|---|---|---|---|---|---|---|
| **Lu'Dak** | Intruder (Scoutship) | 4 | 29 | 8 | 1× Class-1 (Fwd) | 1 | 1 | — |
| **Ka'Tak** | Striker (Corvette) | 8 | 58 | 8 | 2× Class-1 (Fwd, one per side) | 2 | 1 | — |
| **Da'Kak** | Frigate | 12 | 86 | 8 | 2× Class-2 (Fwd, one per side) | 2 | 1 | — |
| **Di'Tok** | Destroyer | 16 | 114 | 8 | 2× Class-2 (Fwd, one per side) + 2× Class-1 (broadside, one per side) → 4 total | 2 | 1 | — |
| **Vo'Bok** | Hunter (Light Cruiser) | 24 | 232 | 8 | 2× Class-3 (Fwd) + 2× Class-1 (broadside) | 4 | 2 | — |
| **Si'Tek** | Patrol Cruiser | 28 | 242 | 6 | 2× Class-3 (Fwd) + 2× Class-2 (broadside) | 4 | 2 | — |
| **Va'Dok** | Heavy Cruiser | 36 | 310 | 6 | per side: Class-3 (Fwd) + Class-2 (Fwd) + Class-2 (broadside) → 2×C3 + 4×C2 total | 4 | 2 | — |
| **Ti'Dak** | Battlecruiser | 44 | 446 | 6 | per side: Class-3 + Class-3 (Fwd) + Class-2 (broadside) → 4×C3 + 2×C2 total | 6 | 3 | — |
| **Ko'Vol** | Battleship | 56 | 566 | 4 | per side: 2×Class-3 (Fwd) + Class-2 + Class-1 (broadside) → 4×C3 + 2×C2 + 2×C1 total | 6 | 3 | — |
| **Lo'Vok** | Battledreadnought (Heavy Battleship) | 64 | 662 | 4 | per side: 3×Class-3 (Fwd) + Class-2 (broadside) → 6×C3 + 2×C2 total | 6 | 3 | 1 |
| **Yu'Kas** | Superdreadnought | 92 | 752 (or **936** at Thrust 4) | 2 (or 4) | per side: 3×Class-3 (Fwd) + Class-2 + Class-1 (broadside) → 6×C3 + 2×C2 + 2×C1 total | 8 | 3 | 2 |
| **Ko'San** | Strike Carrier | 96 | 822 (or **1014** at Thrust 4) | 2 (or 4) | per side: 3×Class-1 (Fwd/broadside mix) → 6×C1 total | 6 | 3 | 6 (2 rows of 3) |

Points scale sharply with the alternate-thrust option on the two largest hulls (Yu'Kas: +184 points
for +2 thrust; Ko'San: +192 points for +2 thrust). These deltas do **not** actually match the p.22
Supership drive-cost rule when it's applied consistently: that rule prices drives at **2×Mass per
1 thrust factor**, so raising thrust by 2 factors on a Mass-92–96 hull should add 2×(2×Mass) ≈
368–384 points, not 184–192 — the observed deltas are only half that, equal to a single "2×Mass"
step rather than two. So the p.27 thrust-option pricing isn't fully explained by the p.22 Supership
formula as printed; either Kra'Vak drives (despite p.25's claim they're "costed at the SAME prices as
Human drive systems") are priced differently in practice, or these two entries use some other
shortcut not shown on pp.21–27.

---

## Against the engine

This repository (`Full-Thrust-Multiplayer-`) does **not** implement the 1994 GZG *Full Thrust*
rulebook or *More Thrust* directly — its `docs/rules/*.md` are written against a different, later
fan ruleset, *Full Thrust: Project Continuum v1.1.4* (see `docs/rules/combat.md`,
`weapons-kinetic.md`, etc.), which reworks and renames a lot of this material. Kra'Vak lore is
present only as **flavour citations** inside that ruleset's own rules (Scattergun, Grapeshot,
boarding "no quarter," robot-fighter morale) — it is not a playable faction, race, or tech-base.
Findings below compare *More Thrust*'s actual text (pp.21–27) against what the engine currently has.

- **Kra'Vak Railgun (class 1/2/3, C/B/A-equivalent) — new-to-engine.** `grep`ing the whole repo for
  "railgun" only turns up `docs/rules/dirtside.md` (a *ground*-combat MDC/Railgun reference,
  unrelated). The engine's naval kinetic weapon is the **K-Gun** (`docs/rules/weapons-kinetic.md`
  §5.16), and it works quite differently from More Thrust's Railgun: K-Gun base damage is a **flat
  value equal to the gun's class** (undiced — only whether it *doubles* is rolled, unlike the
  Railgun's own damage die), with a **doubling chance that scales with class**
  (roll ≤ class on 1d6 doubles, so a K-1 doubles 1-in-6 of the time but a K-6 doubles 5-in-6) — versus
  the Railgun's flat **50% double chance regardless of class** (damage die 4–6 doubles, for any
  class). K-Guns are **AP** (1 point bypasses each armour layer, rest to hull); the Railgun instead
  **subtracts 1 from its damage die per armour level** before checking the 1-3/4-6 split. K-Guns also
  hit via a per-variant range-banded "Projectile Weapon Hit Probability Table" (itself a
  reconstruction — see that doc's caveat), whereas the Railgun's to-hit is one shared table for every
  class (2+ at 0–6", rising 1 per further 6" band, capped at needing a 6 past 24–30"). None of this
  is a small numbers tweak; it's a different core mechanic for what pg.25 calls the Kra'Vak's
  signature weapon.

- **Railgun's single-fire-arc restriction — new-to-engine.** More Thrust explicitly limits every
  Railgun battery to firing through **one** arc only (Fwd/Port/Stbd, never a wider mount), which is
  the p.25 justification for why Kra'Vak rely on manoeuvrability. `BATTERY_CLASSES` in
  `src/data/factions.ts` lists direct-fire families with a class ladder (`beam, graser,
  heavy-graser, phaser, plasma-cannon, emp, gravitic-gun, k-gun`) but nothing in the engine's docs
  singles out K-Guns (or any weapon) as arc-restricted the way the Railgun is; K-Gun arcs follow the
  normal mount-arc-cost table in §5.16 instead.

- **Kra'Vak Scattergun is race-exclusive; the engine's Scattergun is a generic tech-tree
  weapon — differs-from-engine.** More Thrust is explicit that *"Kra'Vak warships only carry a
  strictly limited number of Scattergun charges"* — implying humans in this book don't have one at
  all except by the "amicable discussion" tech-parity house rule on p.26. The engine's Scattergun
  (`docs/rules/defences.md` §7.14, `docs/rules/techbase.md` — tech #9, gated behind Grapeshot) is
  available to **any** faction that researches it, and several numbers differ outright from the More
  Thrust original:
  - **Arc**: engine — "fires into the aft arc like a PDS" (i.e. one arc only). More Thrust — "assumed
    to be turret-mounted... may fire in ANY arc including the rear arc," explicitly *unlike* Railguns.
  - **FireCon**: engine — "has its own miniature integral FireCon system... no FireCon needed" in
    *both* modes. More Thrust — anti-ship mode explicitly **does require** a FireCon; only the
    anti-fighter mode skips it.
  - **Anti-ship damage**: engine — "1 BD*" (looked up on the beam-damage table). More Thrust — a
    flat, un-looked-up 1d6 = damage points, guaranteed at least 1 ("no separate to-hit roll" either
    way, so this difference is specifically in how the *damage number* is derived, not whether it
    hits).
  - **Heavy-fighter casualties**: engine models this as a fresh **1d3** roll (defined in the docs as
    `ceil(1d6/2)`, i.e. always ≥1). More Thrust says take the scattergun's own casualty roll and
    **halve it, rounded DOWN** — i.e. a roll of "1" against Heavy Fighters yields **zero** kills,
    which the engine's ceil-based 1d3 can never produce. Same idea, different tail behaviour.
  - Where the two do line up: both are **one-shot**, "crossed off" after use (engine's `PdMount.expended` flag
    exists specifically because base `SystemDef` "has no ammunition or one-shot flag" — noted in
    `defences.md`'s own gap table); both give Scattergun an ADFC-like ability to cover an allied ship
    within 6 MU/6" without spending a normal ADFC slot; and the "roll like a beam die, 4-5 removes 1
    strength, 6 removes 2, no re-roll" Plasma-Bolt-shootdown rule the engine quotes verbatim
    attributes itself to "Kra'Vak Scatterguns," matching this book's flavour even though the numeric
    Scattergun rules above don't match.

- **Kra'Vak armoured-hull cost multiplier (2.5×/3×Mass by armour level) — new-to-engine.** The
  engine's armour system (`continuum-rulebook-extract.txt` §7.6–7.8, mirrored in
  `docs/rules/combat.md`) prices armour as **discrete boxes** — flat **1 Mass / 2 points per box** for
  plain armour; plain Regenerative Armour is a separate flat rate, **4 points per mass** (no layers).
  Shell (Layered) Armour instead prices **per shell layer** — inner layer 2, first shell 4, second
  shell 6, third shell 8, fourth shell 10 (points per mass) — and Shell can be combined with
  Regenerative by adding +2 per mass to each of those Shell figures ("Regenerative Shell": 4/6/8/10/12
  points per mass). So the 4/6/8/10/12 ladder belongs to combined Regenerative-Shell armour, not to
  plain Regenerative Armour on its own. Either way there is no race lock and no
  distinction between a "Cruiser-tier" and "Capital-tier" armour rating. More Thrust's Kra'Vak rule is
  a completely different shape: it's a **flat multiplier on the whole Hull cost** (2.5×Mass at
  "Level-1"/Cruiser, 3×Mass at "Level-2"/Capital) rather than a per-box purchase, and it's explicitly
  tied to hull *class* rather than to a chosen number of layers. The `FactionDesignRule` union in
  `src/data/factions.ts` has no variant that could express "hull cost multiplier tied to ship class"
  at all — the closest existing kinds are `hull-classes` (which restricts *which* hull grades a
  faction may build, e.g. "Fragile/Weak only") and `thrust-modifier`, neither of which fits.

- **Armour is threshold-proof — already-in-engine (as a general rule, not Kra'Vak-specific).** More
  Thrust states Kra'Vak armour "is considered integral to structure and cannot be lost as a result of
  threshold rolls." The engine's `docs/rules/threshold.md` already has this as a **universal** armour
  rule for anyone's armour: *"There is no threshold check roll... made at the end of the row of
  armor; armour boxes are not systems."* So this specific piece of Kra'Vak flavour already matches
  engine behaviour, just as a general mechanic rather than a race trait.

- **"Beam fire treats armoured Kra'Vak hulls as if screened" (Cruiser = level-1, Capital = level-2
  screen-equivalent) — new-to-engine.** This cross-conversion (an armour rating that acts like a
  Screen level, but *only* against beams, while acting like flat armour against everything else) has
  no equivalent in the engine's model: Continuum's armour boxes apply uniformly to whatever weapon
  hits them (subject to that weapon's own AP/SAP/P damage mode), and Standard/Advanced Screens are a
  wholly separate system from armour, not something armour ever emulates.

- **Kra'Vak "spend up to full thrust on course changes" — new-to-engine.** The engine's course-change
  cap is a flat, race-blind rule: `docs/rules/movement.md` — *"Course change: up to half the rating,
  rounded down."* No faction in `src/data/factions.ts` (14 factions checked: goliath, aethelgard,
  chytrid, sisterhood, durani, void-corsairs, cygnan, sol-marines, samc, izotrope, shard-swarm,
  tyrant, xxcha, askvarian) carries a trait that lifts this cap, and the `FactionDesignRule` union has
  no "course-change budget" variant to express one — the nearest existing kind, `thrust-modifier`,
  changes the thrust *rating* itself, not how much of it may go to turning. More Thrust's version
  (use up to 100% of thrust on a course change, with no extra thrust granted and nothing left for
  acceleration if you do) is a distinct, un-modelled capability.

- **Kra'Vak fighters as always-Heavy, with screen-ignoring kinetic weapons — new-to-engine.** The
  engine's fighter rules (`docs/rules/fighters.md`) do quote *"Robot Fighters are always immune to
  the morale rules"* as a Kra'Vak ("Ro'Kah") citation, but that's the full extent of the overlap —
  there's no engine rule forcing a race's fighters to be Heavy-Fighter-only, and no fighter weapon
  modelled on "dice exactly like a Railgun, but ignoring Screens entirely."

- **Basic Kra'Vak fleet (the twelve p.27 hull classes, Lu'Dak through Ko'San) — new-to-engine.**
  None of these class names appear anywhere in the repo; there is no Kra'Vak faction entry in
  `src/data/factions.ts` and no ship data for them in `src/data/ships.ts` /
  `src/data/generatedShips.ts`.

- **Supership rules (Mass 100+, 2 Mass/thrust drive cost, extra FireCon per 50 Mass, 1 box/2 Mass
  with damage-line scaling and a 6→4+→4+ threshold curve) and the "6 sections of Mass 100, adjacent-
  section splash damage" giant-installation rule — new-to-engine as a named ruleset.** The engine's
  Continuum construction rules price drives, FireCons and armour on their own separate schedules
  (see the K-Gun/armour numbers above) with no "Supership" tier or Mass-100 breakpoint that this
  digest found in `docs/rules/`; a search of the same docs turned up no equivalent "sectioned
  installation" mechanic either.

- **Competitive/tournament framework (pp.21) — new-to-engine, and largely orthogonal to it.** The
  1500-point fleet-size guideline, the "meeting engagement from converging vectors" scenario default,
  the capped/free Damage-Control-team house rule (1/2/3 DCPs by hull size, free and un-losable), and
  the LIMITED-vs-OPEN ship-design split are tournament-organizer conventions, not simulation rules;
  nothing in `src/campaign` or the shipyard/design-pricing code implements or references them.

---

<details><summary>Checker's corrections</summary>

Checked figure-by-figure and line-by-line against `mt-p21.png`–`mt-p27.png` (and `mt.txt`'s
page-21–27 span for cross-reference), plus a spot-check of the "Against the engine" section's claims
by grepping `/home/user/Full-Thrust-Multiplayer-`. Everything not listed below — all 14 p.23 ship
Mass/Points/Thrust/weapon-fit entries, all 12 p.27 Kra'Vak ship stat lines except Di'Tok, every rule
paraphrase in sections 7 and 9, and every other "Against the engine" claim I spot-checked (more than
the requested five: the K-Gun doubling rule, `BATTERY_CLASSES`, K-Gun arc-cost table, Scattergun's
arc/FireCon/damage/heavy-fighter numbers, `PdMount.expended`, the Plasma-Bolt shoot-down quote, the
armour-threshold quote, the movement.md course-change quote, the fighters.md "Robot Fighters" quote,
the 14-faction list, and the absence of Kra'Vak ship/faction data) — checked out accurate and is
unchanged.

1. **Supership drive cost arithmetic (p.22, §8 item 2) — numeric error.** The digest read the book's
   own worked example ("a Mass 150 Supership with 2 thrust would pay 300 x 2 = 600 points for its
   Drives") as if it stopped at the first multiplication, reporting **300 points** as the total drive
   cost. The book's formula is 2×Mass *per thrust factor*, so a Mass-150, thrust-2 ship pays 300
   points per thrust factor × 2 factors = **600 points** total. Fixed.

2. **Di'Tok class railgun fit (p.27 table) — wrong and incomplete.** The digest listed only "2×
   Class-2 (broadside, one per side)". The diagram actually shows two mounts per side: a
   tick-marked (forward-arc) **Class-2** box and a dash-marked (broadside) **Class-1** box — i.e.
   **2× Class-2 (Fwd) + 2× Class-1 (broadside), 4 railguns total**, the same "Fwd class + broadside
   class" pattern the digest correctly captured for every other cruiser-and-up Kra'Vak hull
   (Vo'Bok, Si'Tek, Va'Dok, etc.). Fixed.

3. **Needle Cruiser hull-box grid (p.23 table) — wrong count.** Digest said "≈13 open + 5 filled".
   Direct count from the diagram: row 1 = 3 open/3 filled, row 2 = 4/2, row 3 = 4/2 → **11 open + 7
   filled**. Fixed.

4. **Strike Cruiser hull-box grid (p.23 table) — wrong count.** Digest said "≈13 open + 5 filled"
   (the same figure as Needle Cruiser and Missile Cruiser, apparently copied across rows). Direct
   count: row 1 = 4/2, row 2 = 5/1, row 3 = 5/1 → **14 open + 4 filled**. Fixed.

5. **Planetary Bombardment Monitor hull-box grid (p.23 table) — wrong count.** Digest said "≈14
   open + 4 filled". Direct count: row 1 = 5/1, row 2 = 5/1, row 3 = 6/0 → **16 open + 2 filled**
   (identical to System Defence Cruiser's grid, which the digest already had right). Fixed.
   (Missile Cruiser's own "≈13 open + 5 filled" and System Defence Cruiser's "≈16 open + 2 filled"
   were both already correct and are unchanged.)

6. **Escort/Patrol Carrier hull-box grid description (p.23 table) — inaccurate characterization.**
   Digest said the 4-row grid was "mostly filled toward the aft rows," implying an increasing fill
   gradient. All four rows are in fact identical: 5 open + 9 filled each (14 cells/row, 56 total,
   20 open + 36 filled overall). Fixed to describe the grid as uniform rather than gradated.

7. **Yu'Kas/Ko'San alternate-thrust point deltas "match" claim (end of §9's Kra'Vak table) — faulty
   arithmetic.** The digest claimed the +184/+192-point deltas for the Thrust-4 option "match almost
   exactly" the p.22 Supership drive rule (2×Mass per thrust factor). Applied consistently, that rule
   predicts a 2-thrust-factor increase should cost 2×(2×Mass) ≈ 368–384 points for a Mass 92–96 hull —
   roughly double the actual 184/192-point deltas. The actual deltas equal only a single "2×Mass" step,
   not two, so the claimed match doesn't hold; the paragraph now says so instead of asserting a false
   match (this is the same "stopped at the first multiplication" mistake as correction #1, just applied
   in reverse to back-check the p.27 numbers).

8. **"Book of Fleets" release date (p.22–23, New General Designs designer's note) — imprecise.**
   Digest wrote "expected mid/late 1994"; the actual facing-page note (p.23) says **"mid-late summer
   1994."** Fixed to quote it directly.

9. **Screens quote (p.25, Overview of Kra'Vak technology) — not verbatim.** Digest quoted "of no use
   against the weapons they use themselves... with most races, naturally assume that everyone else
   will use them as well!" The book's actual (slightly awkward) wording is "of no use against the
   weapons they use *for* themselves (and therefore, as with most races, naturally assume that
   everyone else will use as well!)." Fixed to match the source exactly rather than smoothing it.

10. **Regenerative Armour pricing (Against the engine, armoured-hull-cost-multiplier entry) —
    conflated two different things.** Digest described the engine as pricing "Regenerative Armour"
    itself on a 4/6/8/10/12-points-per-mass ladder "per shell layer." Per the engine's own rules text
    (`continuum-rulebook-extract.txt` §7.7–7.8), plain Regenerative Armour has no layers and is a flat
    **4 points/mass**; the 4/6/8/10/12 ladder is specifically **Regenerative Shell** armour (ordinary
    Shell Armour's 2/4/6/8/10-per-layer schedule with +2/mass added for regeneration). Reworded to
    keep the two separate.

11. **K-Gun damage description (Against the engine, Railgun entry) — minor precision fix.** "Not a
    second d6 roll" was ambiguous, since the K-Gun's doubling *is* determined by a die roll; reworded
    to make clear it's the base damage value that's undiced, not the doubling check.

</details>

---

# Chunk 5 · pp. 28–40 · the Sa'Vasku, background, scenarios

Source: page images `mt-p28.png`–`mt-p40.png` (text layer column order is scrambled, so this digest is built entirely from the images).

**Correction to the requested scope up front:** pages 28–40 do **not** contain "the rest of XENO FILE 1 – THE KRA'VAK." Page 28 opens directly on **Section 10, XENO FILE 2: THE SA'VASKU** — the Kra'Vak chapter has already ended by page 27 (a scenario on p.36 cites "Kra'Vak designs as given on P.27"). The only Kra'Vak-specific material inside pp. 28–40 is (a) that page-27 cross-reference and (b) one scenario-only special rule for self-destructing Kra'Vak corvettes (see Scenario 1 below). The actual Kra'Vak weapons/systems/design tables that were the bulk of this task's ask live on pages before 28 and are outside this batch.

---

## XENO FILE 1 – THE KRA'VAK (pp. 28–40 content only)

No weapons/systems/design tables appear in this range. Two fragments:

- **P.27 cross-reference**: Kra'Vak ship classes used in the Starbase 13 scenario — Yu'Bakh (Superdreadnought), Si'Vak/Si'Aat (Patrol Cruisers), Da'Zar/Da'Fakh (Frigates), Ka'Sku/Ka'Uch/Ka'Khe (Strikers/Corvettes) — are stated to be "basic Kra'Vak designs as given on P.27," i.e. printed earlier, not restated here.
- **"Expendable" Strikers (p.36, Assault on Starbase 13 scenario rule)**: the three Kra'Vak Striker-class Corvettes in that scenario are crewed by "Expendables" — crew whose Subfamilies have failed the War Family in some way. At any time the Kra'Vak player chooses, a Striker may self-destruct by deliberately overloading its jump core: this vaporizes the ship and causes **2D6 damage (2–12 points)** to any other vessel within 3", or **1D6 (1–6 points)** to any vessel within 6".
- **No-quarter clause reference** (background text, p.32–33; the actual rule 12.9 is earlier in the book, not on these pages): the Kra'Vak's implacable hostility is reiterated in the narrative — captured Human/Kra'Vak crews on either side essentially expect no quarter.

---

## XENO FILE 2 – THE SA'VASKU (pp. 28–31)

### Concept
The Sa'Vasku are an ancient, technologically/culturally "plateaued" starfaring species with bio-engineered rather than mechanical technology; author's note credits inspiration from H.R. Giger, *Gunbuster*, and Johji Manabe's *Outlanders*. Presented explicitly as a preview/beta: no points values are given for balancing Sa'Vasku fleets against **either Human or Kra'Vak** fleets (the text explicitly says both).

### Ship nature and Mass
Each Sa'Vasku warship is **a single living creature** in symbiotic relationship with other lifeforms performing shipboard functions; the "crew" (including Sa'Vasku themselves) are part of the vessel rather than simply occupants. Ships are grown through genetic engineering, not built, so individual craft vary widely in capability. They have no human-style class subdivisions — they are referred to purely by **MASS** (a Mass ~20–40 ship would loosely be called "Cruiser"-sized by a human observer, informally).

### Power Factor and Power Points (the core mechanic)
- **Power Factor (PF) = MASS ÷ 10, rounded up** to the nearest whole number (Mass 24 → PF 3; Mass 76 → PF 8). PF represents the ship's *potential* to generate power for everything: drives, screens, weapons, all systems.
- **Actual power each turn is random**: roll a number of D6 equal to PF and sum the results — that total is the ship's usable Power Points for that turn only (e.g. PF 3 rolls 3D6, might get 1+5+4 = 10 points one turn, or as few as 3, or as many as 18).
- Power scores are noted by the Sa'Vasku player on his order sheet and are **not disclosed** to the opponent — the human player never knows what a given Sa'Vasku ship can do this turn, or will be able to do next turn.
- **Storage**: unused power may be "carried over" (stored in biocapacitors) to next turn, but the carry-over cap equals the ship's Power Factor (as points, not as extra dice) — a PF 3 ship can bank at most 3 points.

### Spending power — Thrust/Movement
Sa'Vasku ships move/maneuver exactly as Human ships do, but the power cost is **HALF the ship's Power Factor (rounded up) per 1" of velocity change or per point of course change**. Example: PF 5 needs 3 power per point of thrust or turn. **There is no upper limit on thrust applied in a turn** (unlike Human ships' fixed thrust rating) — a Sa'Vasku ship could in principle burn its whole turn's power (up to 30 points possible on a big ship, or even more with carry-over) on maneuver alone, if the dice cooperate.

### Weapons — Energy Pulse
Two weapon types exist: a directed **Energy Pulse** (short-ranged Beam-equivalent) and small bio-craft **Drone Pods**.
- No FireCon systems exist or are needed — everything is handled by the ship's "brain."
- **Target cap**: a ship may engage a number of separate targets equal to **HALF its PF, rounded up** (PF 3 or 4 → up to 2 targets; PF 5 or 6 → up to 3 targets). This cap is reduced by damage: if PF drops (from lost damage rows) below the threshold, the target cap drops too (e.g. a PF 3 ship reduced to effective PF 2 can only engage ONE target).
- **Range bands and power cost per die**: CLOSE 0–8" costs **1 power point/die**; MEDIUM 8–16" costs **2 power points/die**; LONG 16–24" costs **3 power points/die**. A player buys as many dice as he can afford per target, split however he likes across engaged targets, up to total power available.
  - Example: 4 power points → 4 dice at CLOSE, 2 dice at MEDIUM, or only 1 die at LONG (wasting a point); 6 points needed for 2 dice at LONG.
- **Damage per die**: identical to a normal Beam weapon — 0 DP on 1–3, 1 DP on 4 or 5, 2 DP on a 6 — modified by target screens as normal.
- **Anti-fighter fire**: a Sa'Vasku ship may engage fighters with its Energy Pulse but only at CLOSE range, and it costs **double**: 2 power points per die rolled against a fighter group (vs. 1 for a ship target at the same range). Each die against a fighter group causes normal fighter losses.

### Drone Pods
Small, unpiloted bio-organisms functioning like a fighter group, with their own onboard "brains," fully expendable at mission's end. They operate in **clusters of six**, take losses like a normal fighter group, and are **not carried aboard a mothership** — they are grown/assembled from raw genetic material immediately before launch. Once launched they cannot return to the mother ship; when their combat endurance runs out, they simply die and are removed.
- **Growing a cluster costs 20 power points** (a whole-turn commitment, only available to a ship that can generate that much power that turn); the player notes in orders that a cluster is being grown. It is then ready to launch the *next* turn at **no further power cost**, or may be stored/held for a later launch.
- Movement: exactly like normal fighter groups, up to 12"/turn. Attack: 1 die roll per surviving Pod in the cluster (so up to 6 dice for a full cluster), using standard hit/damage resolution.
- Drone Pod clusters use the same fighter **Endurance** rules referenced elsewhere in the book (p.11): **3 active combat turns** of Combat Life before they run out of power and are removed from play. They may be engaged by anti-fighter defenses and may dogfight with enemy fighter groups in the normal way, both counting against their endurance.

### Damage, Damage Points, and the absence of Threshold checks
- Ship Record Diagrams use rows of damage boxes: **number of rows = the ship's Power Factor** (a Mass 36, PF 4 ship has 4 rows). Total Damage Points = **1 DP per 2 Mass** (rounded), spread as evenly as possible across the rows (Mass 36 → 18 DP → two rows of 5 and two rows of 4).
- **Sa'Vasku ships never make Threshold checks and never lose specific systems** the way Human ships do. Instead: **losing a complete row of damage boxes permanently reduces the ship's Power Factor by 1** — which means fewer power dice rolled on all future turns, a reduced target cap, and reduced maximum affordable screen level.
- **Important asymmetry**: reduction of PF from damage does **not** make PF-dependent systems (screens, drives) cheaper — their power costs are always calculated on the ship's **original, undamaged** Power Factor, regardless of how much actual damage-reduced capability remains.

### Screens
Sa'Vasku screens are bioelectric rather than electromagnetic but functionally equivalent to Human screens in their effect on incoming fire. Unlike Human ships (fixed one-time construction cost), Sa'Vasku screening is paid **fresh every turn out of that turn's Power Points**, scaling with the ship's own Power Factor:
- Level-1 screen: power points equal to the ship's **Power Factor**.
- Level-2: **double** the level-1 cost.
- Level-3: **triple** the level-1 cost.
- Example, Mass 36 (PF 4) ship: level-1 = 4 pts, level-2 = 8 pts, level-3 = 12 pts.
- The screen level to be used (if any) must be declared in that turn's written orders with power deducted accordingly; forgetting to write one down means **no screen** that turn. There is no fixed maximum screen a ship "owns" — any ship can in principle run level-3 if it commits nearly all its power to it that turn.

### FTL Drives
Engaging FTL costs **power points equal to 4 × the ship's Power Factor** (Mass 36 / PF 4 needs 16 points to jump). A ship can only engage FTL on a turn where it rolled enough power, and if damage has reduced its *effective* PF so low that 4× that value can never be rolled/stored (e.g. after losing 2 Power Factors), the ship is **locked out of FTL entirely** until it repairs ("regenerates") enough Power Factor.

### Ship Record Diagram
The suggested diagram has **three rows of Power Point boxes** per turn: row 1 = power spent on Thrust (incl. course changes), row 2 = power spent on Screens, row 3 = remaining power for weapons fire/storage. Total power rolled is written in the Orders boxes each turn, including any carried-over surplus. Drone Pod clusters are drawn onto the diagram as they're grown and crossed out/erased on launch. Three sample diagrams are given by rough ship size: "Capital," "Cruiser," and "Escort," differing only in box counts.

### Worked examples given in the text
- A Mass 46 (PF 5, 23 DP across 3 rows of 5 + 2 rows of 4) ship rolling 4,5,2,2,3 = 16 power: first spends **6 points accelerating 2"** (half-PF-rounded-up = 3 power per point of thrust, ×2), leaving 10; then spends 5 (=PF) on a level-1 screen, leaving 5; then 4 points on a single MEDIUM-range shot = 2 dice, leaving 1 point (either a 1-die CLOSE shot, or stored).
- The same 16-point turn, spent entirely on offense: 5 dice at LONG, 8 dice at MEDIUM, or **16 dice at CLOSE** range — with no thrust or screens that turn at all.
- A small Mass 12 (PF 2) ship rolling a lucky double-6 (12 power) could throw a 6-dice shot even at MEDIUM range, "enough to cripple many human ships of far greater tonnage" — but then has no power left for movement or screens that turn.

---

## BACKGROUND (Section 11, pp. 32–35)

The chapter narrates Humanity's discovery that it is not alone: non-Human ruins found on Malak in 2176 are followed by real first contact in 2183, when the UNSC survey ship *Niven* is destroyed and the *McCaffrey* vanishes near Lagos IV, and the PAU warship *Kinshasa* is lost at New Lusaka to an unidentified hostile; within months these attacks are traced to a new alien race, the **Kra'Vak**, whose motivation is theorized to be a "racial paranoia" — kill or be killed, possibly bred by a harsh, predator-ridden homeworld — and with whom no dialogue has ever been achieved (analysts separately note the Kra'Vak seem to want planetary territory rather than simply destroying it, since they have so far avoided orbital bombardment of any world). A slow-burning, low-intensity "Third Solar War" between Human factions (NAC vs. ESU/FSE) is overtaken by the need to face this common threat, and a **Timeline Continuation** (2183–2188) tracks the escalating "First InterSentient War": joint human counter-attacks (Battle of Sulaxar, 2185) followed that same year (28.07.2185) by the UN's **official declaration of war against the Kra'Vak**, the first successful defense of a Human world against Kra'Vak ground troops (Rheinhold, 2187), and mounting civilian panic over unconfirmed reports of massacre on occupied worlds — before ending, in 2188, on the discovery of a *second* alien species, the Sa'Vasku, who make contact by returning a lost human survivor (Technician Lisa Piersen) with a single cryptic spoken message: "The Sa'Vasku will meet with the Mankind." The chapter closes with two extended designer's-notes sections rather than further lore: **"Science and Technology in Full Thrust"** — explaining that the game's weapons are meant to represent lasers (Beams), railguns (Kinetic/K-guns), and particle beams, that missiles carry nuclear or laser warheads, that Screens are hand-waved as EM fields (or force fields, if preferred), and that FTL is deliberately left vague but the "official" background assumes a short-hop **Tsukada-Krensberg Drive** requiring "recovery time" after each jump — and **"Using Full Thrust in Other Backgrounds"**, which pitches Victorian-SF and Anime/Mecha reskins of the same rules (with a note on treating giant Mecha as small "ships" with sub-munition packs) and a short essay on keeping games humorously light-hearted.

---

## SCENARIOS (Section 12, pp. 36–39)

### 1. The Assault on Starbase 13 (New Anglian Confederation vs. Kra'Vak)
- **Set-up**: Starbase 13 within 12" of the planetary table edge; CNS Bulwark externally docked to it; all other NAC ships (incl. a visiting FSE cruiser) parked within 12" of the station, ≥6" apart. Kra'Vak enter from the opposite (Deep Space) edge at velocity 8, heading straight for the station, just having dropped from FTL. No ship may leave via the planetary edge (would mean an uncontrolled atmospheric entry).
- **Forces — NAC**: Starbase 13 (Mass 400, DP 100, 2 fighter bays w/ standard groups, Level-3 screens, 4×PDAF, 5×A batteries all-round, stationary); CNS Bulwark (Light Carrier, powered down at start); CNS Reliant (Escort Cruiser); CNS Truro, CNS Vincennes (Destroyers); CNS Bristol, CNS Ardent (Frigates); FSE Light Cruiser *Affondatore* (guest, on stopover).
  - *Special rules*: Bulwark is fully powered-down at the start — each turn roll 1D6 per system (5–6 brings it online; a roll of 1 shuts that system down for the rest of the game). Its Drives (normal and FTL) are the one exception: they ignore rolls of 1 and come online on a **4, 5, or 6** (not 5–6 like other systems), and need **two** such successes — the first brings normal-space Drives to half thrust, the second to full — the reverse of the normal damage-repair procedure. All other parked NAC ships roll 1D6/turn **per whole ship** (a single roll for the entire vessel, not one per system class): 4–6 brings that ship up to full combat readiness and lets it move and fight; until then it has only its DEFENSIVE systems (PDAFs and screens where fitted) live. The FSE cruiser rolls 1D6 on turn 1 only: 1–2 attempts to withdraw off the Deep Space edge without engaging; 3–6 it fights alongside the NAC, with a further "6" on any later re-roll triggering a withdrawal attempt.
- **Forces — Kra'Vak** (designs per p.27): Yu'Bakh (Superdreadnought); Si'Vak, Si'Aat (Patrol Cruisers); Da'Zar, Da'Fakh (Frigates); Ka'Sku, Ka'Uch, Ka'Khe (Strikers/Corvettes, "Expendable"-crewed, may self-destruct — see Xeno File 1 section above).
- **Victory conditions**: Kra'Vak win fully by destroying/capturing every NAC ship and every launched fighter, then reducing the Starbase at leisure. NAC's overriding priority is getting the Bulwark to safety: Bulwark escapes off the Deep Space edge = clear NAC win; other NAC ships escaping without the Bulwark = a draw; the FSE ship escaping is treated as "probably a diplomatic incident" rather than a victory condition either way.

### 2. Liberté (Federal Stats Europa vs. Separatist French colonists, with secret Dutch option) — by Steve Blease. Backstory runs 2133 (French Separatist declaration of independence on Bretonneux/Doullens/Compville) through 2165 (Third Solar War breaks out; FSE joins ESU) to 2169 (Bretonneux/Doullens Separatists win independence); the raid itself is one of many during the roughly four-year French Republic period that follows 2169, before the FSE retakes the colonies.
- **Set-up**: FSE convoy enters one table end at velocity 12 and must reach the far end (Compville's atmosphere) at velocity 3; Separatist French ships may enter from either side, at the French player's discretion and chosen velocity. Optional: use the book's Planetary Orbit rules to represent Compville realistically.
- **Forces — FSE**: 3× Heavy Freighters (Mass 60, 15 DP, thrust **2**, Level-1 screen, 1×C battery 3-arc, 2×PDAF); 2× Escort Cruisers (Mass 26, 13 DP, thrust 4, Level-1 screen, 3×B batteries 3-arc, 1×ADAF, 1×PDAF); 3× Frigates (Mass 10, 5 DP, thrust 6, 1×B + 1×C battery 3-arc, 2×PDAF).
- **Forces — Separatist French**: 3× Light Cruisers (Mass 22, 11 DP, thrust 6, Level-1 screen, 3×B batteries 3-arc, 2×PDAF); 3× Destroyers (Mass 14, 7 DP, thrust 6, 2×B batteries 3-arc, 2×PDAF). Secret optional Dutch aid (French player's choice, hidden from the FSE unless suspected): 2× Heavy Cruisers (Mass 32, 16 DP, thrust 4, Level-1 screen, 1×A + 3×B batteries 3-arc + 1×C battery 3-arc, 1×ADAF, 1×PDAF) — enter from either side, no more than halfway across, and must not let any FSE ship reach FTL/escape once committed.
- **Victory conditions**: FSE wins by getting at least 2 of 3 Freighters into Compville's orbital/ground defense protection. Separatists win by boarding and capturing at least 2 Freighters (using the Boarding rules); falling short of capture but still preventing the FSE objective counts as a French "winning draw."

### 3. The Battle of Stig IV (Ingamoan Consolidated vs. H.O.V. Corp) — by Jim Webster, joint FT/Hellfire scenario (this is the space-combat half only; ground fighting uses Hellfire); no points values assigned, forces are fixed as printed.
- **Forces — Ingamoan**: Troop Transport *Satyr* carrying the Satyr Brigade; Scout ships *Molieire*, *N'aga*, *Showna* (each 1×C battery, 1×PDAF); Frigate *Ingamoan* (1×B, 1×C battery, 2×PDAF); Q-Ship *Vasquo* on an Exploration Cruiser hull (1×A, 2×B batteries, 2×PDAF, an extra FireCon, Level-2 screen, 1 fighter bay whose fighters won't join ground support but will fight in the space battle).
- **Forces — H.O.V. Corp**: Heavy Freighters H.O.V. 11, 13, 24 (each 1×C battery, 2×PDAF); Q-Ship *Upholder* (flagship, Exploration Cruiser hull, 1×A, 2×B batteries, 2×ADAF, extra FireCon); Planetary Interface Shuttle *Stigian Dirt Rat* (Mass 50, thrust 6, no FTL, 2×C + 1×B battery + 1×PDAF).
- **Set-up**: H.O.V. 11 and 24 plus the Upholder start near the Deep Space edge; H.O.V. 13 is loading in orbit at the opposite Planetary edge; the Dirt Rat is en route from the surface and arrives in 1D6 turns to rendezvous with H.O.V. 13. Ingamoan enters from the Deep Space edge on turn 1; their objective is to fly the Satyr through a 6"-wide Orbital Entry Window at velocity ≤2, with enough maneuvering power left to make orbit.
- **Victory conditions**: Satyr reaches orbit intact = clear Ingamoan win (space battle as standalone; ground battle follows under Hellfire). Satyr crippled/destroyed = clear H.O.V. win. Satyr reaches the Planetary edge but misses the window or arrives too fast: roll 1D6 per shuttle/fighter aboard — 1–2 destroyed on launch, 3–4 force-lands on the wrong continent, 5–6 lands correctly — giving a partial/marginal result either way.
- **Roleplaying note (not in the first pass)**: the text also suggests specific motivations for referees to play the named commanders — Company Admiral Shulkov (H.O.V. *Upholder*) wants above all to stop any landing, but if troops do get down must fall back to the Deep Space edge to save the freighters while the *Upholder* itself lurks as a threat-in-being; Company Admiral Koronka (*Ingamoan*) wants to wreck as much H.O.V. shipping as possible while still getting the Satyr Brigade down safely, and treats his own ship (and its scoutship escorts) as expendable by comparison; Company Commodore Steenkamp (*Vasquo*) is contracted to support the landing but must not risk his ship seriously for another corporation's sake.

### Brief scenario outlines (unfleshed ideas, for building your own)
- **"You Call, We Haul"**: recover a crippled, under-tow Superdreadnought (being towed by a Heavy Freighter with 2 Escort Cruiser escorts, 2" apart, moving at velocity 4) against a small raider force (~2 Destroyers, 1–2 Frigates, up to 4 Corvettes), who don't know the Dreadnought still has any fight in it. At the scenario's start the Dreadnought's salvage crew has already brought one FireCon back online, restored one "A" Battery to full power, and gotten two more Batteries working at "C" class (the hulk has 10 DP left) — nothing else on it is ever repairable. Each turn thereafter, the Recovery player may roll once (needing a 6) to bring a *second* FireCon online. Attackers win by destroying both the Dreadnought and the Freighter; they lose if driven off the table or if they take over 50% losses.
- **"Brought to Bay"**: a Battleship raider has lost its FTL drive after a Q-Ship encounter and is pursued by 2 Heavy Cruisers and 2 Destroyers; each turn the Battleship side rolls 1D6, and only on a 6 do reinforcements arrive at all — a second D6 then determines what shows up: 1 a Frigate, 2 a Destroyer, 3 **two** Destroyers, 4 an Escort Cruiser, 5 **two** Escort Cruisers, 6 a Heavy Cruiser. Victory hinges on protecting or destroying the Battleship.
- **"Rescue Under Fire"**: a small exploration team on an asteroid (optionally a moving one) must be extracted by a pickup ship (an Escort Cruiser is suggested) while a small enemy force (a Light Cruiser plus escorts) tries to prevent the pickup or destroy the rescue ship afterward.
- **"Free-For-All"**: not really a scenario — every player (up to 8 have been used) gets an identical ship (a Heavy Cruiser is suggested) and it's an open melee; recommended as an easy way to teach new players.

---

## MODEL AVAILABILITY (Section 13, p.40)

Written ~2 years after the original rulebook, this chapter surveys the miniatures market at the time (prices in UK £, subject to change, per the text's own disclaimer). The whole chapter — narrative plus the full per-faction catalogue — fits on this single page and ends cleanly with a footnote about not-yet-produced models; nothing here is cut off:
- **CMD (Copeland's Models)**: the "official" FULL THRUST range, sold via GZG mail order in the UK and under license by Geo-Hex in the USA; described as growing fast. Ground Zero Games themselves are starting to produce some resin/metal ranges of their own to complement it.
- **Irregular Miniatures**: budget resin "large fighters" and a few larger ships — cheap and cheerful.
- **Citadel Miniatures/Games Workshop**: had discontinued their *Space Fleet* boardgame and were clearing out its miniatures line — still findable secondhand to pad out a fleet.
- **I.C.E.**: added "bio-alien" style craft to their *Silent Death* spacefighter range — explicitly recommended as good proxies for Sa'Vasku ships.
- **RAFM**: just released the first official *Traveller: The New Era* starships under license from GDW, imported to the UK by Robinson Imports — larger scale (~1/600–1/700) but some compatible with other lines, especially as merchant ships.
- **Mercury Miniatures** (new imprint, run by Jim Langler): about to start producing "different" starships, including some "Bioship"-style models compatible with the CMD range and intended for use with the new Sa'Vasku rules.
- **Micro Machines Star Trek** collections: small pre-painted plastic ship sets (TOS, movies, TNG, and a Deep Space Nine set) — similar relative scale to each other, a useful cheap acquisition while available.
- **The FULL THRUST starship range proper**: cast in white metal by CM Designs under GZG license; UK/Europe customers buy direct from GZG mail order (£1 catalogue, 10% P&P surcharge on orders); US/Canadian customers buy through Capricorn Space (a division of Geo-Hex), Portland OR, distributed via the hobby trade.
- **Per-faction model catalogue**, printed in this order — NAC, ESU, **Kra'Vak**, NSL, Merchant/Support/Civilian ships, and FSE — each with a code (FTxxx), pack size, and price, and complete within this one page. The **Kra'Vak line (FT401–413)** is the xeno-relevant entry: fighters, scoutships ("Intruders"), corvettes ("Strikers"), frigates, destroyers, and a full cruiser-to-superdreadnought/strike-carrier progression, priced from roughly £0.95 (fighter 12-pack) up to about £7.95 (Superdreadnought / Strike Carrier) — transcribed from small print, so treat exact code numbers/spellings as approximate rather than a verbatim catalogue.

---

## Comparison notes vs. the codebase

`grep`s run against `docs/rules/*.md`, `src/engine/`, `src/data/` for `kra`, `vak`, `sa'vasku`/`savasku`, `organic`, `kinetic`:

- **Kra'Vak** appears only as narrative/flavor citations, never as an implemented alien ship-design system:
  - `src/engine/boarding.ts` (and `docs/rules/boarding.md`) implement rule 12.9's no-quarter clause directly: `strikeColorsCheck`'s `noQuarterWith` option skips the surrender roll entirely for "this crew does not expect to survive capture by [side]," quoting *"it is very unlikely that any human ship would even attempt to surrender to a Kra'Vak."*
  - `docs/rules/ordnance.md:429-449` cites a **Kra'Vak Scattergun** as able to intercept Plasma Bolts on a beam-style die (1 strength on 4–5, 2 on a 6, no reroll); the underlying raw source text it's drawn from (`docs/rules/continuum-rulebook-extract.txt:1471`) adds, in the same sentence, that a **Sa'Vasku Interceptor Pod** rolls identically — but that "Sa'Vasku" name never actually appears in `ordnance.md` itself, and `docs/rules/defences.md` doesn't mention this interaction at all (its line 416 is an unrelated Scattergun friendly-fire-in-ADFC-mode rule). None of it is from pp. 28–40 of MORE THRUST, which contain no Scattergun or Interceptor Pod stats at all — it's sourced from the different *Full Thrust: Project Continuum* rulebook the engine is actually built against.
  - `docs/rules/fighters.md:512` explicitly flags a gap: *"Kra'Vak fighters use Ro'Kah rules from Fleet Book 2, which is not one of this project's sources."* Pages 28–40 do not supply those Ro'Kah rules either — this remains an acknowledged, unresolved gap after this digest.
  - `src/data/factions.ts`'s 14 campaign factions are wholly invented ("Goliath Corporate Hegemony," "Aethelgard Ascendancy," etc.) — none of them are Kra'Vak or Sa'Vasku, and the module's own header says every trait "names something the engine already models," i.e. this is a deliberately separate, non-canon faction layer.
- **Sa'Vasku**: zero hits anywhere in `src/`. In `docs/`, the name appears only in the two raw rulebook-extract text files (`continuum-rulebook-part2.txt`, `continuum-rulebook-extract.txt`), never in any of the curated `docs/rules/*.md` files — so even the one indirect citation above (Interceptor Pod) never actually names the Sa'Vasku in the project's own rules docs. None of the bio-ship mechanics above (random per-turn power pool, PF-based damage, power-costed screens/FTL, Drone Pods) exist in the codebase in any form.
- **"organic"**: only one hit, in `docs/rules/continuum-rulebook-extract.txt`, describing a *Human* self-repairing "organic carapace" armor option — unrelated to Sa'Vasku bio-ships.
- **"kinetic"**: extensively implemented (`src/engine/weapons/kinetics.ts`, `docs/rules/weapons-kinetic.md`) — K-guns, Multiple Kinetic Penetrators, Fusion Arrays, Pulse Torpedoes, Gravitic Guns, etc. — but this is the Human kinetic-weapons family (rules 5.14–5.23) and has no connection to Sa'Vasku Energy Pulse weapons, which are a Beam-family analog, not kinetic.
- Related supporting systems that already exist and would matter if a Sa'Vasku implementation were attempted: `src/data/designPricing.ts::screenMass` (fixed one-time screen cost by mass/level — the opposite of Sa'Vasku's per-turn power-funded screens); `src/engine/threshold.ts` (Human per-row specific-system-loss model — the opposite of Sa'Vasku's "lose a row → PF drops by 1, nothing else"); `docs/rules/terrain.md` + `src/engine/actions.ts` orbit/atmospheric-entry functions (`orbitTrackArrival`, `resolveAtmosphericEntry`, etc. — already cover the "Planetary Orbit rules on P.13" that scenario 2 references); `src/data/scenarios.ts` / `customScenario.ts` (a generic objective + `VictoryLadder` scenario framework with no primitive yet for gradual system-readiness rolls, hidden/secret reinforcements, or scuttle-for-splash-damage orders — all three of which pp. 36–39's scenarios use).
- Minor terminology mismatch: the Liberté and Stig IV scenarios' ship stat-lines use **"ADAF"/"PDAF"** for anti-fighter defenses, where the engine's own vocabulary (`src/engine/ew.ts`, `src/data/*`) uses **"pds"/"ads"** exclusively — likely just this guest author's (Steve Blease's) own period shorthand rather than a distinct system, but worth flagging in case a stat converter ever needs to map it.

## Against the engine

The engine ("Full Thrust: Project Continuum") has built a substantially more modern, entirely point-buy fleet-construction and combat system, with its own 14-faction campaign layer, robust orbital/atmospheric mechanics, and a detailed per-hull threshold/system-loss damage model — none of which have any hook for MORE THRUST's two headline alien races. Kra'Vak content is present only as flavor citations grafted onto otherwise-Human rules (the 12.9 no-quarter clause, a Scattergun/Interceptor-Pod PDS interaction borrowed from a different sourcebook), and the codebase's own fighters.md openly admits it is missing the Ro'Kah robot-fighter rules that would make Kra'Vak fighters behave distinctly — a gap this page range does not close, since the real Kra'Vak design chapter is on pages before 28. The Sa'Vasku, meanwhile, are entirely absent, and their central mechanic — a random per-turn Power Point pool (roll PF d6, spend on thrust/screens/weapons/FTL/Drone-Pod-growing at different rates, with no FireCons, no thresholds, and PF itself degrading as a permanent damage marker) — is architecturally incompatible with the existing pipeline: `designPricing.ts` prices ships once at build time (including screens, at a flat mass-scaled cost), and `threshold.ts` resolves damage by losing named systems off a fixed table, whereas a Sa'Vasku ship has no named systems to lose and pays for its screens fresh every turn out of a dice-rolled pool. Bolting this on would mean a second, parallel per-turn resolution path (a "power pool" phase before the normal weapons/movement phases) gated to ships flagged as Sa'Vasku, rather than an extension of the existing weapon/threshold modules. Smaller, more tractable pickups from this range: a generic "scuttle for splash damage" order (the Kra'Vak Expendable-crewed Striker's self-destruct, 2D6/3" or 1D6/6") would be a small, reusable addition to `actions.ts`; and the scenario framework (`scenarios.ts`/`customScenario.ts`) currently has no primitive for the recurring bespoke patterns seen on pp. 36–39 — gradual per-turn system-readiness rolls for a powered-down ship, a hidden/secret reinforcement force revealed only under conditions the opposing player must guess at, and random mis-landing tables for a boarding/drop craft that misses its target window — all of which are handled here as one-off prose rather than as anything the current `VictoryLadder`/objective model could express directly.

<details><summary>Checker's corrections</summary>

Checked every line against `mt-p28.png`–`mt-p40.png` (and the corresponding `mt.txt` pages, which for pp. 28–40 turned out to be in correct reading order, not scrambled). Corrections made:

1. **Sa'Vasku worked example, arithmetic error**: the digest's Mass-46/PF-5 example dropped the ship's thrust expenditure entirely and its running total didn't even add up on its own terms (it claimed "spends 5 on screen leaving 11 ... then 4 on a MEDIUM shot, leaving 1," but 11 − 4 = 7, not 1). The source spends power in order thrust → screen → weapons: 16 total − 6 (2" of thrust, at 3 power/point for PF 5) = 10 − 5 (level-1 screen) = 5 − 4 (MEDIUM shot, 2 dice) = 1 left. Fixed to include the thrust step and correct running totals.
2. **Bulwark power-up rule, missing detail**: the digest said "5–6 brings it online" for all systems without noting that the ship's **Drives** are the explicit exception, coming online on a **4, 5, or 6** (not 5–6 like every other system), and needing two such successes (half thrust, then full). Added.
3. **Other NAC ships' readiness roll, wrong mechanic**: the digest said the crews roll "1D6/turn per system class." The text is clear it's **one roll per whole ship** (not per system), 4–6 bringing the entire ship to readiness. Corrected.
4. **Declaration of war date, wrong year**: the digest dated the UN's declaration of war on the Kra'Vak to "2186." The source's own timeline places it under the **2185** entry, dated 28.07.85 (i.e., 28 July 2185), immediately after the Battle of Sulaxar in the same year. Corrected.
5. **Invented qualifier on Kra'Vak motivation**: the digest called the racial-paranoia theory "an almost religious" paranoia and framed it as "rather than conquest or resources." Neither qualifier is in the text, which just says "a kind of 'racial paranoia'" and separately notes analysts think the Kra'Vak want territory (not that they don't want conquest/resources). Reworded to track the source and folded in that separate territory observation instead of the invented contrast.
6. **Misspelled drive name**: "Tsukada-Kresberg Drive" → **Tsukada-Krensberg Drive** (confirmed against the page-34 image).
7. **FSE Heavy Freighters, wrong thrust rating**: the digest gave them "thrust 4." The text states thrust rating **2** for the three Heavy Freighters (the Escort Cruisers in the same scenario are thrust 4, which is likely how the two got merged). Corrected.
8. **Stigian Dirt Rat, missing weapon**: the digest listed "2×C + 1×B battery" and dropped its **1×PDAF**, which the text also lists. Added.
9. **"You Call, We Haul," mechanic misattributed**: the digest implied the Dreadnought's 1 FireCon + 2 "C"-class batteries were obtained "by rolling a 6 each turn." In the text these are the ship's **starting** condition (along with a fully-restored "A" Battery and 10 DP remaining, both of which the digest omitted); the roll-a-6-per-turn mechanic only brings back a **second, additional** FireCon. Rewritten to match, and the missing "A" Battery/10 DP facts restored.
10. **"Brought to Bay," oversimplified reinforcement table**: the digest described a single "1D6 for reinforcements (escalating table from 1 Frigate up to 1 Heavy Cruiser)." The actual mechanic is a **gated two-roll** process (reinforcements only arrive at all on an initial roll of 6, then a second D6 sets what shows up), and two of the six results are **two** ships, not an escalating single-ship table (3 = two Destroyers, 5 = two Escort Cruisers). Corrected.
11. **Model Availability, false "cut off" claim**: the digest's section header and closing bullet both claimed the model catalogue "continues past p.40" and is "cut off at the page boundary of this batch." The p.40 page image shows the entire catalogue (NAC through FSE) plus all of the surrounding retailer/manufacturer prose complete on that single page, ending cleanly with its own footnote — nothing is cut off. Also fixed the catalogue's printed faction order, which the digest gave as "NAC, ESU, NSL, Kra'Vak, ..." — the actual page order is **NAC, ESU, Kra'Vak, NSL, ...**.
12. **Wrong citation in "Comparison notes"**: the digest cited `docs/rules/defences.md:416` as (jointly with `ordnance.md:434`) citing a "Sa'Vasku Interceptor Pod" intercepting Plasma Bolts. Grepping the repo shows `defences.md` never mentions "Interceptor Pod" or "Sa'Vasku" anywhere — line 416 there is an unrelated Scattergun ADFC friendly-fire rule. The Interceptor Pod/Plasma-Bolt material is only in `ordnance.md` (lines 429–449) plus the raw `continuum-rulebook-extract.txt:1471`; the "Sa'Vasku" name itself appears only in the raw extract file, not in any `docs/rules/*.md` file. Rewrote the bullet (and the parallel note under "Sa'Vasku: zero hits...") to cite the real locations.
13. **Missing content — Stig IV commander roleplaying notes**: the source (p.39) gives named play-motivations for Admiral Shulkov, Admiral Koronka, and Commodore Steenkamp that the digest omitted entirely. Added as a short note under Scenario 3.
14. **Missing/garbled Liberté backstory dating**: the digest's scenario header said "set 2133–2169," but 2133/2165/2169 are backstory beats, not the scenario's own date — the raid itself takes place during the roughly four-year French Republic period that follows 2169. Reworded the header to make this clear.
15. **Sa'Vasku "Concept" section, incomplete comparison**: the digest said no points values are given "for balancing Sa'Vasku fleets against Human ones," dropping the source's explicit "and Kra'Vak" from the same sentence. Corrected.

Everything else checked — every die-roll/range/DP/threat-level number in the Sa'Vasku rules (Power Factor formula, storage cap, thrust cost, target caps, range-band power costs, damage-per-die, anti-fighter costs, Drone Pod cluster size/cost/endurance, screen costs, FTL cost), the Starbase 13 forces/self-destruct numbers, the Liberté and Stig IV force lists apart from the two errors above, and the "Against the engine/repository" claims (`boarding.ts`/`strikeColorsCheck`/`noQuarterWith` and its quote, `fighters.md:512`'s Ro'Kah quote, the 14-entry `factions.ts` with "Goliath Corporate Hegemony"/"Aethelgard Ascendancy," `designPricing.ts::screenMass`, `threshold.ts`, `actions.ts`'s `orbitTrackArrival`/`resolveAtmosphericEntry`, `scenarios.ts`'s `VictoryLadder`, `customScenario.ts`, the single "organic" hit, the `kinetics.ts` weapons list and its 5.14–5.23 rule range, and the `ew.ts` "pds"/"ads" vocabulary) — all confirmed accurate by direct inspection of the page images and by grepping `/home/user/Full-Thrust-Multiplayer-`.

</details>
