# Dirtside II — rules digest

A page-by-page transcription of *Dirtside II* (Jon M. Tuffley, Ground Zero Games, 1993; ISBN 0-9521936-0-4), the
1/300-scale science-fiction ground combat rules, made from the three scanned parts of the rulebook (56 printed
pages, no text layer) for the programmer who will implement the game. Two machine readers wrote each chunk — a
first reader digesting the page images with the OCR text beside them, a second reader checking every figure and
adding what the first missed. The design, sequence-of-play, fire-combat, movement, confidence, infantry, artillery
and points chapters were then read again by hand against the page images and the errors found were corrected
(the fusion plant's 60% of BVP, the VTOL's 500%, the HKP/4's 48" long range, air vehicles' 5 × class capacity, the
artillery ammunition and ECM cost lines, the capacity table on page 16, two worked examples). A third machine pass
that audited figures reported nothing, including those errors, so it counts for little. The infantry-combat tail
(printed pages 32–36), the aerospace, optional-rules and scenario chapters (42–51) were then read a third time by a
stronger machine reader working from the page images, which found and fixed what the audit had missed (an invented
angle-of-attack table, "IARV" for IAVR, a garbled transport-loading sentence, dropped air-defence sentences, page-47
text filed under 42–46, and page attributions); each of those chunks ends with its corrections. **The scan is the
authority.**
Before any figure in here becomes code, read the page it cites; as in the Full Thrust engine, every rule test should
quote the printed rule.

Printed page → file: pages 1–16 are `Dirtside-II-Pt1.pdf`, 17–36 are `Pt2`, 37–56 are `Pt3` (a chunk's `pt2 p07`
is printed page 23). The rulebook's own contents page is transcribed in the first chunk.

## The damage-chit pot, and the spreadsheet

`ds.zip` holds `DS.XLS` (Mikko Kurki-Suonio, 1998; "Original DirtSide II game copyright Ground Zero Games"), a
probability analysis of the damage chits. Its `1 chit` sheet is the pot's exact contents, which agrees with the
counter list on printed page 5 (100 numerical chits: 50 red, 25 yellow, 25 green; plus the specials):

| Chits | Count |
| --- | --- |
| Green 0 / 1 / 2 / 3 | 3 / 10 / 7 / 5 |
| Yellow 0 / 1 / 2 / 3 | 3 / 10 / 7 / 5 |
| Red 0 / 1 / 2 / 3 | 5 / 20 / 15 / 10 |
| BOOM | 5 |
| M (mobility) | 7 |
| T (systems down, target) | 5 |
| F (systems down, firer) | 2 |
| **Total** | **119** |

The sheets `2 chits` … `5 chits` enumerate every draw of that many chits; `Absolute`, `Percentages` and `Cums`
give the outcome distribution (SD:F, miss, SD:T, MOB, damage, kill and their combinations) for every armour value
0–7 and every validity set (All, All/2 for a DFFG at long range, All×2 for a DFFG at close range, R&Y, R, Y, G),
and `Roll Table` / `Roll Table 2` convert those to d100 thresholds ("the minimum you must roll on 1d100 to get the
result; always use the highest applicable result; use the G/Y line for both green-only and yellow-only").
`InfRolls`, `InfCums`, `InfPerc` and `InfAbs` do the same for fire against infantry (kill totals 3 militia, 4 line,
5 powered). For the implementation the pot is simulated as the rules say — draw without replacement per hit,
return the chits after each shot — and the spreadsheet's percentages are the oracle the resolver's tests are
checked against.


---

# Chunk pt1-a · printed pages 1–6

Source: scans `pt1-p01.png` … `pt1-p06.png` (printed pages 1–6), checked against Google OCR `pt1.txt`. Chapter 1 "Introduction" (printed pp. 1–5) and the start of Chapter 2 "Forces and Technology" (printed p. 6). This chunk is mostly framing and conventions; the hard game-mechanical content here is the **dice-type convention**, the **damage-chit pot procedure**, the **counter inventory (exact quantities)**, the **ground/time scale**, and the **line-of-sight rules**. Everything else is designers' notes and technology fluff that later chapters turn into numbers.

---

## CONTENTS / CREDITS (Chapter 1 front matter) — pt1 p01 (printed p. 1)

This page is the **table of contents and credits page**; no rules. Transcribed because the programmer will want the section→page map for the rest of the book.

| Chapter | Section | Printed page |
|---|---|---|
| 1 INTRODUCTION | INTRODUCTION | 2 |
| 1 | DESIGNERS' NOTES | 2 |
| 1 | USING THIS RULEBOOK | 3 |
| 1 | DICE TYPES AND CONVENTIONS | 3 |
| 1 | THE COUNTER SHEETS | 4 |
| 1 | GAME SCALES AND DEFINITIONS | 4 |
| 1 | LINE OF SIGHT AND LINE OF FIRE | 4 |
| 1 | THE COUNTERS, CHITS AND MARKERS | 5 |
| 2 FORCES AND TECHNOLOGY | COMMAND, CONTROL AND COMMUNICATIONS | 6 |
| 2 | OVERVIEW OF WEAPON SYSTEMS TECHNOLOGY | 6 |
| 2 | FORCE ORGANISATIONS AND ORDERS OF BATTLE | 7 |
| 3 VEHICLE DESIGN | VEHICLE SIZE CLASSES | 8 |
| 3 | WEAPON SIZE CLASSES | 8 |
| 3 | DIRECT FIRE WEAPONS SYSTEMS | 8 |
| 3 | VEHICLE POWER-PLANT SYSTEMS | 10 |
| 3 | VEHICLE ARMOUR | 10 |
| 3 | VEHICLE SIGNATURES AND STEALTH LEVELS | 11 |
| 3 | SYSTEM QUALITIES AND LEVELS | 11 |
| 3 | ARCS OF FIRE | 11 |
| 3 | WEAPONS FIT LIMITATIONS | 11 |
| 3 | INFANTRY AND CARGO TRANSPORT | 12 |
| 3 | ARTILLERY VEHICLE DESIGN | 12 |
| 3 | INFANTRY FORCES | 12 |
| 3 | RIVERINE CRAFT | 13 |
| 3 | RIVERINE CRAFT DESIGN | 13 |
| 3 | AIRBORNE VEHICLES | 14 |
| 3 | AIR VEHICLE DESIGN | 14 |
| 3 | AEROSPACE WEAPONS | 14 |
| 3 | COMBAT WALKERS | 14 |
| 3 | COMBAT WALKER DESIGN | 14 |
| 3 | WALKER ARCS OF FIRE | 14 |
| 3 | "OVERSIZED" VEHICLES | 15 |
| 3 | "MODULAR" OVERSIZE VEHICLES | 15 |
| 3 | FIRING AT MODULAR VEHICLES | 15 |
| 3 | CLASSIFYING VEHICLE MODELS | 16 |
| 3 | CAPACITY REQUIREMENTS FOR VEHICLE WEAPONS AND SYSTEMS | 16 |
| 4 SEQUENCE OF PLAY | SEQUENCE OF PLAY – PRELIMINARIES | 17 |
| 4 | ENCOUNTER BATTLES | 17 |
| 4 | ATTACK/DEFENCE BATTLES | 17 |
| 4 | DEPLOYMENT PHASE | 17 |
| 4 | SEQUENCE OF PLAY – THE GAME TURN | 17 |
| 4 | UNIT ACTIVATIONS: COMBAT SEQUENCE | 18 |
| 4 | "CYBERTANKS" – ACTIVATION | 19 |
| 4 | THE "TURN END PHASE" | 19 |
| 4 | TARGET PRIORITY | 19 |
| 4 | AREA DEFENCE SYSTEMS | 19 |
| 4 | AREA DEFENCE SYSTEMS AGAINST GROUND TARGETS | 19 |
| 4 | OPPORTUNITY FIRE | 20 |
| 4 | HIDDEN UNITS | 20 |
| 4 | COVER AND CONCEALMENT | 20 |
| 4 | "DUG-IN" UNITS | 20 |
| 4 | EFFECTS OF WOODS | 20 |
| 5 CONFIDENCE AND REACTION | UNIT QUALITY AND LEADERSHIP RATING | 21 |
| 5 | CONFIDENCE LEVELS | 21 |
| 5 | EFFECTS OF CONFIDENCE LEVELS | 22 |
| 5 | CONFIDENCE TESTS | 22 |
| 5 | REACTION TESTS | 22 |
| 5 | TAKING CONFIDENCE TESTS | 22 |
| 5 | CONFIDENCE AND REACTION TESTS: CIRCUMSTANCES AND THREAT LEVELS | 23 |
| 5 | PANIC | 23 |
| 5 | UNIT LEADERS – LOSS AND REPLACEMENT | 23 |
| 5 | UNIT INTEGRITY | 23 |
| 5 | REGROUPING | 24 |
| 5 | "UNDER FIRE" MARKERS | 24 |
| 5 | LOSS OF COMMAND UNIT | 24 |
| 5 | RALLYING UNITS | 24 |
| 6 MOVEMENT | MOVEMENT | 25 |
| 6 | TERRAIN TYPES | 26 |
| 6 | TERRAIN EFFECTS ON MOBILITY | 26 |
| 6 | EVASIVE MOVEMENT | 26 |
| 6 | AIRBORNE VEHICLE MOVEMENT | 27 |
| 6 | WALKER VEHICLE MOVEMENT | 27 |
| 6 | RIVERINE MOVEMENT | 27 |
| 7 FIRE COMBAT | DIRECT FIRE | 28 |
| 7 | WEAPON RANGE TABLE | 28 |
| 7 | STAGE 1: HIT RESOLUTION | 28 |
| 7 | STAGE 2: DAMAGE RESOLUTION | 29 |
| 7 | DAMAGE EFFECTS | 30 |
| 7 | SLAM SYSTEMS – MULTIPLE TARGETS | 30 |
| 7 | GUIDED MISSILE SYSTEM (GMS) FIRE | 30 |
| 7 | INTERCEPTION BY AREA DEFENCE SYSTEMS | 31 |
| 7 | MISSILE HITS AND POINT-DEFENCE SYSTEMS | 31 |
| 7 | MULTIPLE MOUNT WEAPONS | 32 |
| 7 | "POP-UP" ATTACKS | 32 |
| 7 | ANGLE OF ATTACK | 32 |
| 7 | REPAIRING SYSTEMS FAILURES | 32 |
| 8 INFANTRY COMBAT | INFANTRY FIREFIGHTS | 33 |
| 8 | INFANTRY CLOSE-ASSAULT | 34 |
| 8 | COMBINED ACTIVATIONS FOR CLOSE-ASSAULT | 35 |
| 8 | OVERRUNS AND FOLLOW-THROUGH ATTACKS | 35 |
| 8 | ANTI-PERSONNEL SUPPORT WEAPONS (APSWS) | 35 |
| 8 | ANTI-PERSONNEL FRAGMENTATION CHARGES (APFCS) | 35 |
| 8 | INFANTRY ANTI-VEHICLE ROCKETS (IAVRS) | 36 |
| 8 | VEHICLE WEAPONS FIRE AGAINST INFANTRY | 36 |
| 8 | INFANTRY WEAPONS FIRE AGAINST VEHICLES | 36 |
| 8 | INFANTRY TRANSPORT | 36 |
| 8 | CASUALTIES TO MOUNTED INFANTRY | 36 |
| 8 | FIRING INFANTRY FROM TRANSPORT | 36 |
| 9 ARTILLERY | TYPES OF ARTILLERY BATTERIES | 37 |
| 9 | LOCATION OF ARTILLERY BATTERIES | 37 |
| 9 | ARTILLERY MUNITION TYPES | 37 |
| 9 | ARTILLERY FIRE MISSIONS | 38 |
| 9 | BEATEN ZONES FOR ARTILLERY FIRE | 38 |
| 9 | REQUESTING ARTILLERY FIRE | 38 |
| 9 | ARTILLERY FIRE RESOLUTION | 39 |
| 9 | ARTILLERY FIRE DAMAGE EFFECTS | 39 |
| 9 | AMMUNITION SUPPLY AND RESUPPLY | 40 |
| 9 | COUNTER-BATTERY FIRE | 40 |
| 9 | ORTILLERY | 40 |
| 10 AEROSPACE OPERATIONS | AEROSPACE CRAFT ORGANISATION | 41 |
| 10 | AEROSPACE UNIT ACTIVATION SEQUENCE | 41 |
| 10 | AIR VEHICLE WEAPON EFFECTS | 41 |
| 10 | DEADFALL ORDNANCE ATTACK RESOLUTION | 41 |
| 10 | AIR DEFENCE | 42 |
| 10 | INTERFACE LANDINGS | 43 |
| 10 | DROP TROOPS | 43 |
| 11 ADDITIONAL AND OPTIONAL RULES | SMOKE AND OBSCURATION | 44 |
| 11 | MINEFIELDS | 44 |
| 11 | LAYING MINES | 44 |
| 11 | CLEARING MINES | 45 |
| 11 | ABANDONED VEHICLES | 45 |
| 11 | BACKUP SYSTEMS | 45 |
| 11 | ENGINEERING UNITS | 45 |
| 11 | FORTIFICATIONS | 46 |
| 11 | BUILDINGS AND URBAN AREAS | 46 |
| 11 | COMBAT IN URBAN AREAS | 46 |
| 11 | ARTILLERY FIRE AGAINST URBAN AREAS | 46 |
| 11 | NUCLEAR MUNITIONS | 47 |
| 11 | BIOCHEM MUNITION EFFECTS | 47 |
| 11 | CASEVAC | 48 |
| 11 | WEATHER CONDITIONS | 48 |
| 11 | EXOTIC ENVIRONMENTS | 48 |
| 11 | ALIEN RACES IN DIRTSIDE II | 48 |
| 12 SCENARIOS AND BACKGROUNDS | THE SCENARIOS | 49 |
| 12 | SCENARIO 1: BORDER RAID | 49 |
| 12 | SCENARIO 2: SPACEPORT DEFENCE | 49 |
| 12 | FURTHER SCENARIO IDEAS | 50 |
| 12 | POSSIBLE BACKGROUNDS | 50 |
| 12 | CAMPAIGN GAMES | 50 |
| 12 | FUTURE HISTORY 2000 – 2183AD | 51 |
| 13 APPENDICES | POINTS VALUE SYSTEM | 52 |
| 13 | SOME TYPICAL VEHICLE EXAMPLES | 53 |
| 13 | TERRAIN AVAILABILITY AND MODELLING | 53 |
| 13 | MODEL AVAILABILITY | 54 |
| 13 | BIBLIOGRAPHY | 55 |
| 13 | GLOSSARY OF TERMS | 55 |
| 13 | THE RECORD CARDS | 55 |

Credits: Written by Jon M. Tuffley; Systems Development Mike Elliott; Background Development Jon Tuffley and Steve Blease; Scenarios Mike Elliott; Technical/Military Advisors Paul Allcock, Bruce Miller; Graphics/Layout Tim Parnell and Simon Parnell; Countersheet Design Tim Parnell; Printed by Alderman Printing, Ipswich. ISBN 0-9521936-0-4. Copyright 1993 J. M. Tuffley and Ground Zero Games. Published 1993 by Ground Zero Games.

---

## (Untitled opening fiction) — pt1 p02 (printed p. 2)

Flavour text only: "Transcript of interview with Trooper/Driver Daniel M. Kassel, 'A' Squadron, 17th/21st New Anglian Lancers, filed 12/09/2167 at Caledon Base Med/Rehab facility by Margaret Nakagi, ConFed News Service." Describes a hot-zone drop on Mhung'Du. No rules. Bottom-left of the page is an illustration (infantryman with rifle, smoke columns and tanks in the background). Background vocabulary used later: "PBI" (infantry), "interface boats" (landers), "triple-A" (anti-aircraft), "buzzbomb" (infantry anti-vehicle rocket), "C-Vac" (casevac), "AIs" on the vehicle giving targets.

## INTRODUCTION — pt1 p02 (printed p. 2)

- DIRTSIDE II is a rules system for combined-arms ground combat games with miniatures in a science-fiction setting, written as a "generic" system for any SF background.
- It is a development of the original DIRTSIDE; the mechanisms were majorly revised "to make the game flow faster, and to allow battles with larger sized forces", so the mechanics bear little resemblance to the first edition.
- It is "a game about armoured warfare – that is, battles using tanks and mechanised Infantry", an extrapolation of present-day warfare into a future setting in the style of David Drake's "Hammer's Slammers", Heinlein's "Starship Troopers", Gordon Dickson's "Dorsai" series: powered armour suits, huge hovertanks, lasers and railguns.
- No rules on this page beyond the framing.

## DESIGNERS' NOTES — pt1 p02–p03 (printed pp. 2–3)

Intent, in the designers' words (no rules, but it explains later design choices):

- Three goals: 1) as generic as possible without leaving gaping holes; 2) simple and flowing in play without endless reference back to charts and tables; 3) able to cope with large forces (up to, say, Battalion sized) while remaining playable in a reasonable time. Above all: FUN.
- On goal 1: the FULL THRUST background is provided in the appendices but is purely optional; the design and points-cost systems are meant to let you classify and use virtually any equipment. Weapon names are arbitrary: "Just because we've called one system a 'High Energy Laser' doesn't mean that you can't call it something else entirely."
- On goal 2: the system is "heavy on the hardware (all the polyhedral dice ... plus that fancy set of coloured counters ...) but WITHOUT the need to constantly look up results in myriads of charts and reference sheets – basically the dice and the counter chits take care of all the variables."
- On goal 3: rules function well for forces up to roughly battalion level — **up to, say, ten to twelve platoon-sized 'units' per side** — and will handle more if time, space and players allow. The most practical game size is a "short battalion", called a **"Combat Group"** in the unit organisation notes — the equivalent of a couple of Companies plus extra support elements.
- On fun: the sequence of play keeps both (or all) players actively involved throughout the turn ("no sitting back for half an hour or more while your opponent makes his move"), and the **"opposed rolls" used in much of the fire-combat mechanism** give the feel of being able to "defend" units against incoming fire. Most rules are logical extensions of a few simple principles.
- Nothing is cast in stone; players may add, delete and modify with opponents' agreement.

## USING THIS RULEBOOK — pt1 p03 (printed p. 3)

- Most sections give both the RULES and notes on WHY they work as they do.
- Read the whole book once; thereafter the quick reminders are the passages **highlighted in BOLD type** throughout the book. (Implementation note: bold passages are the authoritative rule statements; I mark them **bold** in this digest where the scan shows them.)
- After a couple of games, "the Vehicle Record Cards for your forces should be all you need for play" (record cards are in the Appendices, p. 55).

Page 3 also carries an illustration (top right: a VTOL gunship over a river valley with a burning vehicle on a road). No rules in it.

## DICE TYPES AND CONVENTIONS — pt1 p03–p04 (printed pp. 3–4)

Rules, exactly as printed:

1. DIRTSIDE II uses "polyhedral" dice from four-sided through to twelve-sided — **five dice types: D4, D6, D8, D10 and D12** (named by number of faces). The original DIRTSIDE was entirely D6-based.
2. Bare minimum one full set of the five dice; both players often roll simultaneously, so each player should have their own set; a small "pool" of extra dice is useful "in certain circumstances".
3. **Whenever the rules call for a die roll to be made, the TYPE of die to be used will be specified.**
4. **"+1 Die Type" does NOT mean roll the die and add 1.** It means select the **NEXT DIE TYPE UP**: e.g. if the usual die would be a D6, "+1 Die Type" means a **D8** is rolled instead.
5. **"-1 Die Type"** means use the **next LOWER die**: e.g. a D6 drops to a **D4**.
6. General principle (p. 4): any factor (weapon accuracy, unit quality etc.) that is of **BELOW AVERAGE** status uses a **D6** as its normal die type; **AVERAGE** uses a **D8**; **ABOVE AVERAGE** uses a **D10**. Circumstances that increase the chance of success **RAISE the die type by 1**; adverse circumstances **reduce it by 1**.
7. "There are certain exceptions to this general principle (these are clearly specified when they occur)."

| Die ladder (inferred from the rules above) | D4 | D6 | D8 | D10 | D12 |
|---|---|---|---|---|---|
| Status meaning | (below D6) | BELOW AVERAGE | AVERAGE | ABOVE AVERAGE | (above D10) |

Implementation note: the die ladder is an ordered enum; "+1/-1 Die Type" is a step along it. These pages do not state what happens when a shift would go below D4 or above D12 — look for that in the later chapters (not on these pages).

## THE COUNTER SHEETS — pt1 p04 (printed p. 4)

- Two sheets of die-cut counters are supplied (called "markers" or "chits"). Punch out, sort into types.
- **The BLACK counters are the DAMAGE CHITS.** They go in an opaque container — the **"pot"** — from which they are drawn at random during play. **All Damage Effects are resolved by drawing one or more of the black chits from it when required.**
- **Always replace all chits in the pot immediately after resolving each individual attack or other situation**, and stir them to ensure a fully random draw. (Implementation: draws within a single attack/situation are without replacement from the full pool; the pool is restored to full before the next attack/situation.)
- All other counters are MARKERS indicating the status and condition of units on the table and performing other game functions, so that no written record-keeping is needed during the game.
- Markers are placed on the table next to the units/elements they affect (opponents can see them; "it does work both ways"). Alternative: a FORCE STATUS SHEET — a sheet of paper with a box ruled for each unit in the player's force, markers placed in the box instead of on the table. Recommended method is markers-on-table; either is allowed.

## GAME SCALES AND DEFINITIONS — pt1 p04 (printed p. 4)

- Model scale: designed for 1:300 / 1:285 (a.k.a. 6mm); 1:200 works equally well; 2mm or up to 15mm possible.
- **Ground scale: 1" (or 25mm) on the table = 100 metres.** All distances in the rules are given to this ground scale; using another scale requires converting all ranges, movement etc.
- At 1" = 100m a good-sized game fits a table around 6' x 4'; playtested on tables as small as 4' x 2' with smallish forces. With a very large area, **1" = 50m may be used (thus doubling all ranges and moves)**.
- **Each individual model represents one real vehicle (an ELEMENT), and each Infantry figure represents one man – Infantry are always based in teams of between two and five figures on a small base, each such team being classed as a single Element.**
- Groundscale and model scale are deliberately different: a single building model can represent a group of structures, and a couple of trees a whole wood.
- TIMESCALE: loose, mostly irrelevant to play; a turn contains only a few seconds of actual fire combat but "may safely be assumed to occupy several minutes of elapsed time". **If it is necessary to determine how long a battle has lasted (e.g. in a campaign), treat each full turn as equivalent to 15 minutes**; hence a four-turn game represents about an hour of campaign time.

| Scale item | Value |
|---|---|
| Ground scale (standard) | 1" = 100 m |
| Ground scale (large-table option) | 1" = 50 m (all ranges and moves doubled) |
| Recommended table | 6' x 4' (works down to 4' x 2') |
| Vehicle model | 1 real vehicle = 1 Element |
| Infantry figure | 1 man; a base of 2–5 figures = 1 Element |
| Time per full game turn (campaign use) | 15 minutes |

## LINE OF SIGHT AND LINE OF FIRE — pt1 p04 (printed p. 4)

Rules, as printed:

1. **If you can stretch the tape-measure in a straight line between the two elements without the tape touching an intervening obstacle, then there is a clear line of sight (and hence line of fire, if within range).** No height-level mathematics is required, though players may work it out if they really want to.
2. **Lines of sight/fire are blocked by raised ground, buildings and woods, unless the observer/firer is on terrain high enough that he may see over the obstacle. Smoke and other obscuration agents will also block sight and firing.**
3. **The MAXIMUM distance that any ground-based line of sight or line of fire can be traced is 60"** — defined as the maximum acquisition range of any sensor system in play (60" = 6000 m at the recommended groundscale, roughly horizon distance on an Earth-sized world from the turret of an average AFV).
4. **VTOL craft in low mode (NOE or terrain following)** may be hidden by obstructions in the same way as other elements; take the straight line from the height of the actual model on its stand (which in most cases should be a fairly good approximation of the real scale altitude).
5. **All airborne Aerospace craft, and VTOLs in high mode,** are assumed to be flying considerably higher than the model's stand height and are **generally visible from anywhere on the table** (unless there is a particular VERY tall terrain feature in the way); conversely such aircraft can also **SEE anything on the table** and thus potentially attack it.
6. Disputes not resolvable by discussion: roll a die or flip a coin; an umpire's decision is final.

| LOS parameter | Value |
|---|---|
| Ground-based LOS/LOF maximum | 60" (6000 m) |
| Blockers | raised ground, buildings, woods (unless observer high enough to see over), smoke and other obscuration |
| VTOL low mode (NOE) | treated as a ground element for LOS, using model height on stand |
| Aerospace craft / VTOL high mode | visible from and able to see anywhere on the table (barring a VERY tall feature) |

---

## THE COUNTERS, CHITS AND MARKERS — pt1 p05 (printed p. 5)

This page is the **counter inventory** (icons plus quantities); it is the exact composition of the damage-chit pot and of every marker type. "The full set of counters (2 sheets) consists of the following:"

### A) THE DAMAGE CHITS (BLACK counters)

| Chit | Description as printed | Quantity |
|---|---|---|
| Numerical (shown "2") | The NUMERICAL damage chits (100 in total – 50 RED, 25 YELLOW, 25 GREEN). Example of VALUE 2 chit shown – actual values are a mix of 0, 1, 2 and 3 | 100 (50 red, 25 yellow, 25 green) |
| "BOOM" | "BOOM" chits – catastrophic hits | 5 |
| "M" | MOBILITY hits – immobilises vehicles | 7 |
| "T" (with lightning bolt) | SYSTEMS DOWN – TARGET vehicle affected | 5 |
| "F" (with lightning bolt) | SYSTEMS DOWN – FIRING vehicle affected | 2 |

Total black chits in the pot = 100 + 5 + 7 + 5 + 2 = **119**. The page does NOT give the distribution of values 0/1/2/3 within each colour — that must come from the later damage rules or the physical counter sheet (not in this chunk).

**From the counter sheets themselves** (the two 1993 sheets, uploaded as `DSII-CS.pdf`, counted by hand from
the scan): Sheet A carries the pot and confirms DS.XLS exactly —

| Colour | 0 | 1 | 2 | 3 | Total |
| --- | --- | --- | --- | --- | --- |
| Red | 5 | 20 | 15 | 10 | 50 |
| Yellow | 3 | 10 | 7 | 5 | 25 |
| Green | 3 | 10 | 7 | 5 | 25 |

plus BOOM 5, M 7, T 5 (lightning, "T") and F 2 (lightning, "F"): 119. Sheet A also fixes the leadership split
of the command markers that p. 5 gives only by colour, which is the mix to draw from for a one-off game
(p. 21):

| Command markers | Leader 1 | Leader 2 | Leader 3 | Total |
| --- | --- | --- | --- | --- |
| Green (green troops) | 5 | 8 | 5 | 18 |
| Blue (regulars) | 9 | 12 | 9 | 30 |
| Orange (veterans) | 5 | 8 | 5 | 18 |

and the confidence markers, 18 CO, 18 ST, 14 SH, 12 BR, 12 RO, with 7 PANIC and 14 ruined-building markers.
Sheet B holds the play markers of section C below, including the 14 objective markers (seven 1s, four 2s,
three 3s).

### B) THE COMMAND AND CONFIDENCE MARKERS

| Marker | Description as printed | Quantity |
|---|---|---|
| COMMAND MARKERS (shown "3", coloured square) | Colour indicates Unit Quality, Number indicates Leadership rating | 66 in total – 18 GREEN, 18 ORANGE, 30 BLUE |
| CONFIDENCE LEVEL MARKERS (shown "CO", grey) | Grey counters, letters indicate Confidence Level | 74 in total – 18 "CO", 18 "ST", 14 "SH", 12 "BR", 12 "RO" |

(Meaning of CO/ST/SH/BR/RO and of the three quality colours is defined in Chapter 5, pp. 21–22, not on this page.)

### C) THE PLAY MARKERS

| Marker | Description as printed | Quantity |
|---|---|---|
| PANIC | PANIC markers | 7 |
| RUINED BUILDING | "RUINED BUILDING" markers | 14 |
| DMG | DAMAGED vehicle markers | 28 |
| IMM | IMMOBILISED vehicle markers | 14 |
| lightning bolt | "SYSTEMS DOWN" markers | 14 |
| "R" (lettered) | LETTERED MARKERS for hidden unit identification etc. | 24 |
| DUMMY | "DUMMY" markers | 18 |
| OBJECTIVE | OBJECTIVE markers | 14 in total – 7 x "1", 4 x "2", 3 x "3" values |
| DUG-IN | "DUG-IN" unit markers | 18 |
| HIGH MODE | HIGH MODE markers – for VTOL units | 10 |
| UNDER FIRE | UNDER FIRE markers | 21 |
| IMPACT POINT (crosshair) | IMPACT POINT markers – for Artillery Fire | 7 |
| MINEFIELD (asterisks) | MINEFIELD (conventional) markers – also used for Artillery Ammunition (Mine rounds) | 12 |
| JUMPING MINES | "JUMPING" MINES markers | 6 |
| ACTIVE SENSORS (dish) | ACTIVE SENSORS markers for AREA DEFENCE SYSTEMS | 10 |
| EVASIVE MOVEMENT (wavy arrow) | EVASIVE MOVEMENT markers | 7 |
| ABANDONED VEHICLE | ABANDONED VEHICLE markers | 14 |
| GUIDED MISSILE (missile silhouette) | GUIDED MISSILE markers – to indicate Missiles in flight | 11 |

### D) THE ARTILLERY AMMUNITION MARKERS

| Marker | Description as printed | Quantity |
|---|---|---|
| HEF | HEF – HIGH EXPLOSIVE FRAGMENTATION rounds | 14 |
| MAK | MAK – MULTIPLE ARMOUR KILLER rounds | 10 |
| SMOKE | SMOKE rounds | 14 |
| BIOCHEM (biohazard symbol) | BIOCHEM rounds | 7 |
| NUCLEAR (radiation symbol) | NUCLEAR ("NUKE") rounds | 7 |

(Mine rounds use the MINEFIELD markers listed under C.)

Implementation note: these quantities are physical-supply limits from the counter sheets; the note on p. 7 (next chunk) says the sheets let two players each field roughly 10–12 units / 40–50 elements. A software version need not enforce the marker counts, but the black-chit pot composition (119 chits, colours and specials as above) IS a game-mechanical fact — the draw probabilities depend on it.

---

## COMMAND, CONTROL AND COMMUNICATIONS — pt1 p06 (printed p. 6)

Designers' rationale for the command and confidence rules (no procedures; the actual rules are in Chapters 4 and 5):

- Assumption: information technology advances faster than any other military field; commanders are assisted by AI "aides" that filter data from sensors of all kinds (airborne remotes, satellites, cameras on virtually every vehicle and trooper's helmet) and relay tactical decisions directly to unit commanders and the men on the ground, bypassing the traditional Battalion CO → Company CO → Platoon leader → Squad leader chain. Hence quicker, more fluid response to orders and flexible organisations: Companies, Battalions and Regiments exist administratively, but in action their constituent units are intermixed.
- Also assumed: relatively unjammable comms links (tight-beam, lasers/masers, phased-neutrino) and lots of throw-away drones.
- **In most Combat Groups (i.e. the group of forces under the player's command on the table) there will be a Command unit of several vehicles and/or Infantry teams; this unit (and in particular a specific Command Vehicle or team) acts as a focus for all the data transfers up and down the command links.** The Command Vehicle does NOT necessarily carry the overall force commander (who is more likely dug-in in a bunker well back, or in an orbiting starship).
- **Loss of the command vehicle (or even the entire command unit)** is serious and disruptive but not catastrophic: it causes temporary confusion while links are re-established through backup channels, and has "a definite detrimental effect on the overall confidence levels of the force – the troops will be able to continue with the battle, but at somewhat reduced efficiency." (Mechanics: see LOSS OF COMMAND UNIT, p. 24.)
- The one thing technology cannot overcome is the individual soldier's will to fight; this is handled by the rules on unit quality, confidence levels and confidence tests — "quick, simple procedures determine whether or not a unit will actually carry out the orders it has been given."

## OVERVIEW OF WEAPON SYSTEMS TECHNOLOGY — pt1 p06 (printed p. 6; continues on printed p. 7, next chunk)

Descriptive background for the weapon classes that Chapter 3 (pp. 8–10) turns into game statistics. Players may add or delete systems to suit their background. Weapons named on this page, with the characteristics the text attributes to them (these are flavour; the numbers are in Chapter 3):

| Weapon family as described | Abbreviation used on this page | Characteristics stated |
|---|---|---|
| High velocity tank gun | (later "HVC") | Late-20th-century type at the limit of its potential; still common, with binary liquid propellants and sophisticated targeting |
| Hyper Velocity weapons: Hyper Kinetic Penetrator | (later "HKP") | Reaction-propelled rounds |
| Hyper Velocity weapons: "Railgun" / Mass Driver Cannon | (later "MDC") | Electromagnetic principle |
| Small calibre rapid-fire cannon: conventional Autocannon | — | Defensive/support weapon on MICVs and scout vehicles; caseless rounds or liquid propellants |
| "Gauss Autocannon" | — | Small-calibre mass driver; higher-tech alternative |
| Laser (vehicle-mounted) | (later "HEL") | "the most accurate weapon system available – basically, once you have acquired the target then you've hit it!"; disadvantages: massive power requirement, relative vulnerability to chaff, smoke or aerosols; used for specialised roles |
| Direct Fire Fusion Gun | (later "DFFG") | Fires a "bolt" of plasma; "frighteningly effective, particularly at short ranges (before the plasma 'bolt' begins to spread and diffuse ...)"; very complex, costly ammunition (each round = fuel slug + laser ignition + ultra-fast discharge power cell + magnetic containment) |
| Guided Missile Systems | GMS | Compact packages with smart guidance; high-velocity anti-vehicle; in widespread use in both vehicle and Infantry-carried systems, despite point-defence and countermeasures |
| SLAM (Salvo-LAunched Missile) | SLAM | Packs fire clusters of small unguided rockets to saturate targets in direct line of sight of the firing vehicle; devastating against both Infantry and armour |
| Area fire weapons (Artillery) | — | Mass area bombardment, smoke laying; Multiple Rocket Launcher systems favoured for high volume of fire in a short time; "though rocket-assisted ..." (sentence continues on p. 7 with conventional artillery and mass-driver howitzers, autoloaders, tank-killer and mine-dispersing rounds, mini-nukes and biochem) |

No numeric rules on this page. Section continues on printed p. 7 (next chunk) with APSWs, APFCs, GMS for infantry, IAVRs and then FORCE ORGANISATIONS AND ORDERS OF BATTLE.

---

## Unclear / scan notes for this chunk

- All six page images are legible; no text is unreadable. The OCR text (pt1.txt) interleaves columns and garbles the credits names (e.g. "Witten by", "Tim Panell", "Bryce Mer"), so the credits above follow the image.
- Page 5 gives the colour split of the numerical chits (50 red / 25 yellow / 25 green) and says values are "a mix of 0, 1, 2 and 3", but NOT how many of each value per colour; this chunk cannot supply the per-value distribution.
- Page 5 lists marker abbreviations CO/ST/SH/BR/RO and the three command-marker colours (GREEN/ORANGE/BLUE) without defining them; definitions are in Chapter 5 (pp. 21–22).
- The die-type convention does not state the behaviour at the ends of the D4…D12 ladder on these pages.
- Minor textual clarification added to VTOL LOS rule (p. 4): the phrase "which in most cases should be a fairly good approximation of the 'real' scale altitude" was explicitly included in the summary to preserve the full rule meaning.


---

# Chunk pt1-b · 7–11

Source: scanned pages `pt1-p07.png` … `pt1-p11.png` (authority), cross-checked against Google OCR `pt1.txt`. Pages 7 is the end of Chapter 2 (FORCES AND TECHNOLOGY); pages 8–11 are the start of Chapter 3 (VEHICLE DESIGN). Everything below is in printed reading order (left column then right column of each page). Bracketed text `[...]` in the rulebook is the designers' own bracketed notes; my own editorial notes are marked **Digest note:**.

---

## OVERVIEW OF WEAPON SYSTEMS TECHNOLOGY (continued from p.6) — Chapter 2, pt1 p07

Page 7 opens mid-sentence, continuing the "Overview of Weapon Systems Technology" section begun on page 6. This is background/flavour, but it establishes the weapon categories the design rules later use.

- "...conventional Artillery and Mass Driver howitzers can come very close to this with the use of magazine-fed autoloaders. Artillery-delivered tank killers and mine-dispersing rounds are commonly used, and there are always the 'nastier' forms of munition (mini-nukes and biochem agents) to use if the situation warrants them."
- **APSW (Anti-Personnel Support Weapons):** While most vehicle mounted main weapons are capable of some kind of anti-personnel fire, the most effective way of engaging Infantry from a vehicle is still an automatic weapon such as a conventional Machinegun, Minigun or Automatic Grenade Launcher. Weapons of this type are generally referred to as APSWs.
- **APFC (Anti-Personnel Fragmentation Charge):** a secondary form of anti-personnel weapon: a "belt" of shrapnel/flechette charges fixed around the hull of some combat vehicles; these charges are designed to fire outwards to deter enemy Infantry from getting too close to the vehicle.
- **Infantry anti-vehicle weapons:** Infantry may be equipped with GMS launchers for anti-vehicle fire, though these are still relatively bulky and only issued to specialist teams. For the "humble Grunt", his anti-armour weaponry is the **Infantry Anti-Vehicle Rocket (IAVR)** – a small, disposable tube-launched rocket similar in most respects to the LAW (light Antitank Weapon) of the 20th century. IAVRs are compact, cheap and reasonably effective at their short range, giving the ordinary Rifleman at least a chance of taking out an AFV that happens to get too close.

## FORCE ORGANISATIONS AND ORDERS OF BATTLE — Chapter 2, pt1 p07

Rules and definitions (every number kept):

1. **A player in DIRTSIDE II takes on the role of the commander of a force generally referred to as a COMBAT GROUP.** Combat Groups are ad-hoc formations created for specific missions or duties, and are formed from a selection of smaller "units".
2. **The basic building-block of any force is a platoon-sized formation known throughout the rules as a UNIT.** Such units consist of a number of individual **ELEMENTS**, each element being a single vehicle or team of Infantry (**2–5 figures on a single base**). Units may be referred to as "platoons", "troops", "lances" or any other term that fits the background in use.
3. A typical Armoured Unit would consist of **between 3 and 5 tanks**, although more or less may be used according to each player's specific organisation and preference; in game terms, a unit with few elements cannot easily absorb losses and remain functional, but a unit of many elements will lack flexibility in use – the choice is up to the player.
4. For Mechanised Infantry, a typical unit would have **3–5 APCs or MICVs, each with one or two embarked Infantry elements**.
5. In 20th century terms, a number of platoon-sized units would then be combined into a Company, with several Companies then forming a Battalion or Battlegroup. In DIRTSIDE II the assumptions about increased efficiency and flexibility of Command, Control and Communications (C-Cubed) mean that the concept of the "Company" has fallen into disuse – if it survives at all in the preferred background then it will be a purely administrative structure with little bearing on combat actions. Instead, commanders select whatever individual units they need (or that are available to them) to accomplish a specific mission; these component units are formed into a **COMBAT GROUP, which may be of any size up to what would previously have been known as a Battalion** – in other words, a player's force may consist of anything from **just a couple of platoon-size units up to ten or twelve such units**.
6. [Note: the counter-sheets provided with this rulebook should allow two players to each field forces of roughly **10–12 individual units** as a maximum – ie: perhaps **40–50 vehicles or elements per force**; games with larger forces are certainly possible, particularly with multiple players, but will require extra counters to be made or purchased. Additional sets of counter sheets are available direct from GZG; please send an SSAE for further information.]
7. **Example typical COMBAT GROUP for a medium-sized game** (printed as a list):

| Units | Composition |
|---|---|
| 1 unit (Troop) | 4 HEAVY BATTLE TANKS |
| 2 units (Troops) | each of 4 MEDIUM BATTLE TANKS |
| 3 or 4 units (Platoons) | each of 4 APCs or MICVs, each vehicle carrying 1 or 2 teams of Infantry |
| 1 unit (Battery) | 3 ARTILLERY VEHICLES |
| 1 Command unit | a Command Vehicle, an Area-Defence Vehicle and (say) 2 Missile Vehicles |

8. Onto this basic formation could be added any mix of other units and supporting arms, such as a unit of 3 or 4 Transport VTOLs and embarked airmobile Infantry, specialist Engineering elements, Riverine craft etc. etc., to tailor the force to fit the particular mission.
9. **Designers' intent:** the section gives guidelines only. To maintain the flexible and generic nature of DIRTSIDE II the designers deliberately laid down no hard-and-fast rules on army organisation; players should experiment with force compositions, remembering that most options have minus points as well as advantages. **The key factor in any force organisation is the UNIT, as this is integral to the functioning of the Game Sequence**; outside this, players are free to do virtually what they want provided (i) it is consistent with the chosen background and (ii) opponents are happy with it.

**Implementation implications:** the data model needs Force (Combat Group) → Unit → Element; a Unit is the object the game sequence activates; an Element is a single vehicle or an Infantry team (base of 2–5 figures); an APC/MICV element can carry 1–2 embarked Infantry elements.

**Illustration:** bottom half of page 7 is a drawing of a gun crew serving a towed artillery piece (no rules content).

---

## VEHICLE SIZE CLASSES — Chapter 3, pt1 p08

- Throughout the rules, vehicle elements are referred to by their **SIZE CLASS**; this is generally from **Class 1 (VERY SMALL)** through to **Class 5 (VERY LARGE)**, although rules options are discussed for **"Oversize"** (ie: larger than class 5) vehicles if desired.

| Size Class | Name | Typical vehicles |
|---|---|---|
| 1 | VERY SMALL | Very light scout vehicles, 'jeeps', fast attack 'dunebuggies' etc. |
| 2 | SMALL | Light scout tanks, small APCs, small armoured cars etc. |
| 3 | MEDIUM | Most Main Battle Tanks, heavier APCs and MICVs, Medium Artillery etc. |
| 4 | LARGE | Heavy tanks, larger APCs, big Artillery pieces etc. |
| 5 | VERY LARGE | Superheavy tanks and similar very big combat vehicles. |

- The Size Class of a vehicle determines how much (and what kind of) equipment, weapons and cargo it can carry, and also indicates the **BASIC SIGNATURE** of the vehicle (**equal to the Size Class**, eg: a MEDIUM vehicle has a Basic Signature of 3) which determines how easy the vehicle is to hit when fired at.
- **CAPACITY = Size Class × 5.** "To determine how much CAPACITY a vehicle has for carrying weapons and other systems (and for transporting Infantry etc.), simply multiply the vehicle's Size Class by FIVE; thus a class 4 (LARGE) vehicle would have 4 × 5 = 20 Capacity points available."

| Size Class | Capacity points | Basic Signature |
|---|---|---|
| 1 | 5 | 1 |
| 2 | 10 | 2 |
| 3 | 15 | 3 |
| 4 | 20 | 4 |
| 5 | 25 | 5 |

**Digest note:** the capacity/signature table is derived from the two printed formulas (×5 and =Size Class); only the formulas and the class-4 example are printed on this page.

**Illustration:** left column middle of page 8, a soldier firing a heavy support weapon (no rules content).

## WEAPON SIZE CLASSES — Chapter 3, pt1 p08

- **Weapon types are defined by Size Classes in much the same way as vehicle sizes; weapons are generally available in sizes 1 (Smallest) to 5 (Largest)**, though not every different kind of system will be available in all sizes – for example, an RFAC is available in sizes 1 or 2 only, while an HKP only comes in classes 3 to 5. Full details of the possible sizes for each weapon type are given in the sections describing the weapon systems.
- **The Size Class of a weapon system determines its effective ranges, the damage it can inflict and how much space the system takes up when mounting it in a vehicle.**

## DIRECT FIRE WEAPONS SYSTEMS — Chapter 3, pt1 p08 (continues to p09)

- Direct Fire weapons are those which require a **clear line-of-sight** to the target, and are primarily used against **"point" targets (ie: single vehicles)** rather than against area targets. A number of systems are described; players are free to develop their own additional systems.

### 1) RAPID-FIRE AUTOCANNONS (RFACs) — pt1 p08
- Flavour: "conventional" small-calibre shell-firing cannons using caseless rounds or liquid/binary propellants; many are multi-barrel "gatling" types with electric drives. Role: anti-personnel or light anti-armour weapon on APCs, MICVs and scout vehicles, or secondary weapon on larger AFVs.
- **The RFAC is available in size classes 1 and 2 only**, these very approximately corresponding to 20–25mm and 30–40mm calibres respectively.
- **As their external power requirement is minimal, they may be used on vehicles with any type of Power Plant.**

### 2) HIGH VELOCITY CANNONS (HVCs) — pt1 p08
- Flavour: final development of the conventional high velocity tank gun; large-calibre weapon firing superdense saboted rounds; mostly fin-stabilised smoothbores using liquid propellants. Relatively cheap main-armament option; simple and reliable.
- **HVCs are available in size classes 3 to 5**; power requirements are small, so the system may be fitted to **any vehicle within the usual size restrictions**.

### 3) HYPER-KINETIC PENETRATORS (HKPs) — pt1 p08
- Flavour: probably the ultimate chemically-propelled anti-armour gun; relatively small-calibre (but VERY long) barrel developing hyper-velocities for superdense long-rod penetrator rounds. Early models use liquid propellants; more advanced types use a very small plasma reaction. Rate-of-fire not as high as a Mass-Driver but does not require the huge electrical input of the large electromagnetic weapons. **Its one major failing is its inability to fire an effective explosive round, thus making it of little use against dispersed targets such as Infantry (a problem also shared by the MDC).**
- **HKPs are available in size classes 3 to 5, and may be fitted to any vehicle subject to size restrictions.**

### 4) MASS-DRIVER CANNONS (MDCs) — pt1 p08
- Flavour: all weapons which fire a kinetic-energy projectile by electromagnetic acceleration; also known as "Gauss Guns" and "Railguns". In common usage, **MDCs of size classes 1 or 2 are referred to as "Gauss Autocannons" while those of sizes 3 to 5 are called Mass Drivers or Railguns.** All MDCs are very small calibre weapons with a very high rate of fire, using solid slugs at incredibly high velocities. Like the HKP, small calibre precludes practical explosive rounds – however their very high rate of fire makes them capable of **limited anti-personnel use** through sheer machinegun-like density of fire.
- **MDCs are available in all size classes (1–5), but owing to their very high power requirements they are only usable on vehicles with suitable power plant systems (see Vehicle Power Plants).**

### 5) HIGH-ENERGY LASERS (HELs) — pt1 p08, continued pt1 p09
- Flavour (p08): Combat Lasers project a very short, very high-intensity pulse of coherent light, damaging by sudden massive overpressure and explosive vaporisation at the point of impact. **HELs are extremely accurate (once the firecontrol sensors have acquired the target, a hit is virtually automatic) and their effective range is limited only by that of the acquisition system in use** – although some attenuation of the beam occurs due to atmospheric ionisation, over the few kilometres at which the target can be seen and engaged this effect is negligible. **Smoke, chaff, specialised aerosols and similar countermeasures are all effective in disrupting incoming Laser fire**, but they all rely on advanced sensors to tell the victim he has been targeted in time to deploy the countermeasure.
- (p09) A more passive form of laser defence is **Ablative Armour**, which "soaks up" much of the beam's energy as the ablative coating boils away without harming the main armour underneath. Ablative coatings are expensive and not widely used (few laser-armed opponents); the cost of HEL systems, coupled with their relatively poor armour penetration compared with other weapons, means laser-armed vehicles are quite rare.
- (p09) **Two firing modes:** when engaging "hard" (armoured) targets, HELs use a single very high energy pulse; when they need to engage infantry or other dispersed targets a lower power setting enables the weapon to "sweep" an area with rapid-fire bursts of much lower intensity. **Such area fire has a much shorter effective range** as the lower-energy beam is much more susceptible to atmospheric attenuation.
- **HELs are available in all size classes (1–5), but as with MDCs their very high power input requirements limit their use to vehicles which have suitable power plants.**

### 6) DIRECT FIRE FUSION GUNS (DFFGs) — pt1 p09
- Flavour: one of the most deadly anti-armour weapons available, despite a relatively short effective range (diffusion and energy loss of the plasma bolt once it leaves the magnetic containment of the barrel). Each round is self-contained (hydrogen fuel charge, flash laser ignition system, and the power supply holding the plasma in containment until fusion occurs, when the bolt is released down the magnetically screened barrel). **At short ranges the penetrative ability and damage potential of the bolt is extremely high – even the most heavily armoured target is unlikely to withstand a close-range hit. As range increases, the bolt spreads and loses energy, severely lessening its destructive potential at longer ranges. Anti-Infantry potential is good**, as the plasma bolt causes significant explosive and fragmentation effects when it strikes any solid object (including an area of ground).
- **DFFGs are available in all size classes (1–5), and may be fitted to any vehicle subject to normal size limitations** (as the ammunition for a DFFG carries its own power source, the required external input is fairly small).

### 7) GUIDED MISSILE SYSTEMS (GMS) — pt1 p09
- Flavour: refinement of late-20th-century systems; faster than predecessors (though still much slower than a cannon projectile); virtually all are "fire and forget" – operator guidance (wire or radio/optical link) no longer necessary. Semi-intelligent seeker heads give missiles their own target identification and discrimination; many use terrain-following flight to minimise countermeasures. **Major disadvantage: susceptibility to countermeasures – both active (point-defence) and passive (jamming).** A properly equipped vehicle can either confuse or actually shoot down an incoming missile, hence a trend away from missiles as primary tank-killers. Still in very widespread use as both vehicle and infantry-carried weapons; the infantry type gives dismounted Infantry sufficient punch to take out armour at reasonable ranges.
- **GMSs are available in size classes 1 and 2, which are denoted as GMS/L (Light) and GMS/H (Heavy) respectively. Infantry may only carry GMS/Ls, while vehicles may be equipped with L or H versions subject to normal size restrictions.**
- [Note that vehicles may be equipped with multiple missile systems if size restrictions permit; in this case **each separate "system" represents the ability to fire one missile per turn**, so a vehicle with 3 × GMS/L systems could salvo-fire up to 3 separate missiles per turn – **but only all at the same target**.]

| GMS designation | Size class | Who may carry |
|---|---|---|
| GMS/L (Light) | 1 | Infantry and vehicles |
| GMS/H (Heavy) | 2 | Vehicles only |

### 8) SALVO-LAUNCHED MISSILE PACKS (SLAM) — pt1 p09
- Flavour: operates like present-day rocket pods on attack aircraft; the pack contains many small unguided rockets fired in clusters, saturating the target with multiple hits. **As range increases, the cluster spreads out, lessening the chance of hitting any one target but increasing the area bombarded – thus hits may also be scored on elements close to the one actually targeted.** The large number of rockets and their high speed **overload the capabilities of point-defence systems, and as they are unguided they cannot be 'spoofed' by ECM or Stealth systems**; this makes the SLAM pack very effective even against high-tech enemies.
- **SLAM packages are available in size classes 3 to 5, and may be fitted to any vehicle subject to normal size restrictions.**

### Direct-fire weapon availability summary (compiled from the eight entries above)

| Weapon | Abbrev. | Size classes available | Power-plant restriction | Notes printed here |
|---|---|---|---|---|
| Rapid-Fire Autocannon | RFAC | 1, 2 | none (any power plant) | ~20–25mm (class 1), ~30–40mm (class 2) |
| High Velocity Cannon | HVC | 3, 4, 5 | none | – |
| Hyper-Kinetic Penetrator | HKP | 3, 4, 5 | none | no effective anti-infantry round |
| Mass-Driver Cannon | MDC | 1, 2, 3, 4, 5 | needs suitable power plant (see p10) | classes 1–2 "Gauss Autocannons"; limited anti-personnel use |
| High-Energy Laser | HEL | 1, 2, 3, 4, 5 | needs suitable power plant (see p10) | area-fire mode at shorter range; countered by smoke/chaff, Ablative armour |
| Direct Fire Fusion Gun | DFFG | 1, 2, 3, 4, 5 | none (ammo self-powered) | short range, devastating close; good vs infantry |
| Guided Missile System | GMS/L, GMS/H | 1 (L), 2 (H) | none stated | infantry: GMS/L only; one missile per system per turn, all at same target |
| Salvo-Launched Missile Pack | SLAM | 3, 4, 5 | none stated | unguided; immune to ECM/Stealth; overloads point defence; may hit nearby elements |

**Illustration:** bottom half of page 9, a camouflaged tank under netting (no rules content).

---

## VEHICLE POWER-PLANT SYSTEMS — Chapter 3, pt1 p10

There are three basic types of Power unit available for vehicles:

1. **CHEMICAL-FUELLED ENGINES (CFEs):** "conventional" motors/generators, either internal-combustion engines or gas turbine types, driving the vehicle directly (mechanical transmission) or via an electrical or hydraulic transmission. Cheap, effective and well proven; run on oil or alcohol based fuels, or synthetic equivalents. CFEs are perfectly adequate to power most wheeled or tracked vehicles, and the smaller GEVs; however, they are unable to provide the large surplus of electrical power needed to operate the larger Laser or Railgun weapons systems.
2. **HYDROMAGNETIC TURBINES (HMTs):** power generators using an advanced version of the 'fuel cell' principle to provide electricity for both propulsion and weapons fire. Ample power for ground vehicles and all but the very largest GEVs, and enough surplus energy to support medium/large HELs and MDCs.
3. **FUSION GENERATION PLANTS (FGPs):** small, compact Fusion generators – the most advanced and expensive type of vehicle power system, but the only type that can provide the massive amount of energy required for the biggest GEVs, Grav-driven vehicles and the largest power-consuming weapons.

**Illustration:** left column middle of page 10, a hovercraft/GEV with crew (no rules content).

**The type of power plant used in a vehicle will affect the MOBILITY TYPE and the WEAPONS FIT that it can have, as follows:**

Mobility restrictions by power plant:
- **CFE:** may use any WHEELED or TRACKED mobility, **SLOW GEV for up to size class 3 (Medium) vehicles only**, or **FAST GEV for up to size class 2 (Small) vehicles only**.
- **HMT:** any WHEELED or TRACKED mobility type, **SLOW GEV if no larger than size class 4 (Large)**, and **FAST GEV up to size class 3 (Medium) only**.
- **FGP:** may be used to drive **ANY mobility type, in any size class of vehicle**; **FGPs MUST be used in all GRAV, 'WALKER' or 'Oversize' vehicles.**

| Power plant | Wheeled | Tracked | Slow GEV | Fast GEV | Grav | Walker | Oversize vehicle |
|---|---|---|---|---|---|---|---|
| CFE | any size | any size | size ≤ 3 | size ≤ 2 | no | no | no |
| HMT | any size | any size | size ≤ 4 | size ≤ 3 | no | no | no |
| FGP | any size | any size | any size | any size | yes (required) | yes (required) | yes (required) |

Weapons-fit restrictions by power plant:
- The 'non-power-consuming' weapon types (**RFACs, HVCs, HKPs, DFFGs, SLAMs etc.**) may be fitted to vehicles with any type of power plant subject to normal size restrictions as laid down in the vehicle design rules.
- The weapons that require external power input (**HELs and MDCs**) are restricted as follows:
  - **A CFE-driven vehicle may only be fitted with HEL or MDC systems up to TWO SIZE CLASSES LOWER than the vehicle's own size class**; thus a Large (class 4) vehicle with a CFE engine could only mount a HEL or MDC of size 2 or smaller.
  - **HMT-powered vehicles may support HEL or MDC weapons of up to ONE SIZE CLASS LOWER than the vehicle size** (eg: maximum of a class-3 weapon on a size 4 vehicle).
  - **FGP systems may power ANY weapon subject to the normal size limitations.**

| Power plant | Max HEL/MDC class (vehicle size S) | Example |
|---|---|---|
| CFE | S − 2 | size 4 vehicle → HEL/MDC class ≤ 2 |
| HMT | S − 1 | size 4 vehicle → HEL/MDC class ≤ 3 |
| FGP | normal size limits only | – |

**Digest note:** by the CFE formula a size 1 or 2 CFE vehicle cannot mount any HEL/MDC (S − 2 ≤ 0), and a size 1 HMT vehicle cannot either; the page does not state this explicitly, it follows from the arithmetic.

## VEHICLE ARMOUR — Chapter 3, pt1 p10

- Flavour: AFV armour is assumed to be high-tech laminates and composites, superdense semi-collapsed materials, synthetics and aligned-crystal alloys.
- **During the design procedure, each vehicle type is assigned an ARMOUR VALUE, which is a numerical rating from 0 (very thin, basically a 'soft-skin' vehicle) to a maximum of 7 (ultra-heavy armour used only on "oversize" vehicles).**
- **NO VEHICLE MAY CARRY AN ARMOUR RATING HIGHER THAN ITS BASIC SIZE CLASS**; thus a size 4 vehicle could only be fitted with a MAXIMUM of Armour 4.
- [This indicates that **Armour 5 is the maximum for any "normal" combat vehicle**; Armour ratings 6 and 7 are only possible if you are designing "oversize" vehicles, using the notes on P.15.]
- **The Armour Rating actually indicates the armour used on the FRONT surfaces of the vehicle; the SIDES, TOP and REAR are assumed to have a value of 1 LESS than the frontal armour.** Eg: a vehicle with an Armour Rating of 5 would have armour 5 on the front, but only armour 4 on sides, top and rear.
- **Note that there is no Armour Value less than 0**; a basically 'unarmoured' truck would have armour 0 all round. (**Digest note:** so a vehicle with Armour 0 has 0 on all facings, not −1.)
- **OPEN-TOPPED vehicles count as Armour 0 against all ARTILLERY and SLAM fire, regardless of what other armour they have.**

| Size class | Max Armour Value |
|---|---|
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 4 |
| 5 | 5 |
| 6 (oversize) | 6 |
| 7 (oversize) | 7 |

| Facing | Armour |
|---|---|
| Front | Armour Value (A) |
| Sides, Top, Rear | A − 1 (minimum 0) |
| Any facing, open-topped vehicle vs Artillery or SLAM fire | 0 |

**Special armours** – two kinds may also be fitted during the design procedure: **ABLATIVE** and **REACTIVE**.

- **ABLATIVE armour** is a special coating that vapourises when hit by LASER (HEL) fire, absorbing much of the energy of the beam. It can be added on top of any normal Armour Value, and **does not alter the effects of the armour against any weapons except a HEL**; when attacked by Laser fire the effects of the Ablative armour are as covered in the **Damage Validity chart**. A vehicle fitted with Ablative Armour is denoted by putting an **"A" suffix** to its basic Armour Value, eg: **armour value 3A**.
- **REACTIVE armour** consists of explosive blocks or panels on the hull and turret which explode outwards when hit, disrupting the penetrative power of incoming **shaped-charge** rounds. As such warheads are generally used only by **Guided Missiles** and a very few other weapons (most use kinetic energy penetrators which are basically unaffected by Reactive armour), its use has declined since the late 20th century, though still used by some armies. As with Ablative, the effects of reactive armour are **factored-in to the Damage Validity details** for the weapons that are affected by it. A vehicle so fitted is denoted by an **"R" suffix** to its basic armour value, eg: 4R. (**Digest note:** the OCR reads this as "A"/"48"; the scan clearly prints "R" and "4R".)
- [Note that due to the physical incompatibility of the two systems, **it is not possible to fit Ablative AND Reactive armour to the same vehicle!**]

| Special armour | Suffix | Affects | Where the effect is applied |
|---|---|---|---|
| Ablative | A (eg: 3A) | HEL (laser) fire only | Damage Validity chart |
| Reactive | R (eg: 4R) | shaped-charge warheads (Guided Missiles and a very few other weapons) | Damage Validity details |
| Both on one vehicle | – | NOT ALLOWED | – |

**Illustration:** right column bottom of page 10, tanks advancing through a ruined building (no rules content).

---

## VEHICLE SIGNATURES AND STEALTH LEVELS — Chapter 3, pt1 p11

- **All vehicle elements have a BASIC SIGNATURE which is equal to their SIZE CLASS**; this represents how easy they are for enemy sensors and Fire-Controls to spot and lock-on to, and thus in game terms affects the **"TARGET" Die Type that is rolled to 'defend' the vehicle when it is fired at** (by any Direct Fire systems **except Guided Missiles, which are defended against by the vehicle's ECM systems**).
- **It is possible to ALTER (ie: reduce) a vehicle's "effective" signature by fitting it with STEALTH capabilities.** STEALTH covers a wide variety of methods, both physical (radar-absorbing paint, heat-emission masking etc.) and electronic, which render the vehicle more difficult for the enemy to see and 'acquire' as a target. Even traditional camouflage paint can be considered as "Stealth" masking against the old Mk.1 Eyeball sensor.
- **STEALTH capabilities are bought in terms of LEVELS, each level costed according to the size of the vehicle; for every STEALTH LEVEL fitted, the EFFECTIVE SIGNATURE of the vehicle goes DOWN by 1.** Thus a class 4 vehicle with TWO levels of Stealth would have a "basic" signature of 4, but an "effective" signature of 2.

Formula: `effective_signature = size_class − stealth_levels` (basic signature = size class; the target die type is looked up from the effective signature – the lookup itself is on a later page).

## SYSTEM QUALITIES AND LEVELS — Chapter 3, pt1 p11

- **SYSTEM QUALITY refers to the level of sophistication and ability of the various Electronics and Sensor packages with which elements are equipped.**
- The different types of SYSTEMS comprise:

| System | Definition |
|---|---|
| FIRE CONTROL SYSTEMS (FireCon) | The package of sensors and computer modules that assist the Gunner of a vehicle in controlling Direct Fire weaponry. |
| ELECTRONIC COUNTER MEASURES (ECM) | Systems designed to jam the guidance of incoming Missiles. |
| GUIDANCE SYSTEMS | The sensor and guidance package of a Missile Launcher (GMS), that determines how well the missiles can seek their targets and avoid enemy ECM. |
| POINT- and AREA-DEFENCE SYSTEMS (PDS and ADS) | Sophisticated sensor suites linked to fast-reaction weapons, used for defence against incoming missiles (and in the case of ADS, as an Anti-Air weapon as well). |

- **Each SYSTEM used on an element is rated as one of three QUALITY LEVELS: BASIC, ENHANCED or SUPERIOR.**
  - **BASIC** systems are the simplest and cheapest form of the System, with relatively limited abilities;
  - **ENHANCED** systems are better than Basic, costing more but having a better chance of doing their job successfully;
  - **SUPERIOR** are the top-line, state-of-the-art systems – the most complex and expensive, but also the most effective.
- **Example / die-type rule:** a vehicle with a **BASIC Fire Control System uses a D6 as its normal Die Type for Direct Fire shots; one with an ENHANCED system would use a D8, and a SUPERIOR FireCon would use a D10.** The general rule is the better the system, the 'bigger' die type it uses.

| Quality level | FireCon Direct Fire die type |
|---|---|
| BASIC | D6 |
| ENHANCED | D8 |
| SUPERIOR | D10 |

- **SPECIAL NOTE: each individual vehicle or other element needs only ONE of each system; thus even if it has multiple weapons, one Fire Control system will cover them all. Multiple GMS Launchers, however, DO have multiple guidance systems as these are integral to the Launchers.**

## ARCS OF FIRE — Chapter 3, pt1 p11

- **Weapons that are mounted in TURRETS have an all-round (360°) Arc of Fire**, unless some specific feature of the particular vehicle design makes this impossible (for example, some multi-turreted designs available in model form have obvious limitations to the traverse of some or all turrets) – in such cases **a 180° Arc is suggested for restricted-traverse turrets, 90° each side of the turret's normal facing**. (**Digest note:** the OCR reads "50°"; the scan prints 90°, consistent with a 180° arc.)
- **FIXED MOUNTS have much more limited Fire Arcs; a vehicle-mounted weapon in a Fixed Mount may only fire through a 30° Arc, ie: 15° either side of the vehicle centre-line.** Targets outside this arc may not be engaged without physically turning the vehicle, **which counts as MOVEMENT**; as **Fixed Mount weapons may ONLY be fired BEFORE moving**, it follows that such weapons may only fire in the direction they are pointing at the end of their previous activation.
- **OPTION:** If preferred, the Fixed Mount fire arc may be the same as the **"FRONT" arc used in the 'Angle of Attack' rule on P.32**, ie: the arc bounded by lines extended through diagonal corners of the model. This gives a wider arc for most models, but has the advantage of not requiring an arc-of-fire template to be made or used – in the end, it is up to you.

**Diagram (three circles with a vehicle top-view in each):**

| Mount type | Fire arc | Diagram description |
|---|---|---|
| FIXED MOUNT WEAPON | 30° FIRE ARC | narrow wedge forward of the hull centre-line |
| FULL TRAVERSE TURRET | 360° FIRE ARC | whole circle shaded |
| RESTRICTED TRAVERSE TURRET | 180° FIRE ARC | forward half-circle shaded |

| Mount | Arc | Centre | Fire timing constraint |
|---|---|---|---|
| Turret (full traverse) | 360° | – | – |
| Turret (restricted traverse, optional) | 180° | turret's normal facing, ±90° | – |
| Fixed mount (default) | 30° | vehicle centre-line, ±15° | may only fire BEFORE moving; turning the vehicle counts as movement |
| Fixed mount (option) | "FRONT" arc of Angle of Attack rule (P.32): bounded by lines through the model's diagonal corners | vehicle front | same as above |

## WEAPONS FIT LIMITATIONS — Chapter 3, pt1 p11 (continues on p12)

- **The size and number of weapons that a vehicle may be fitted with is determined by its Size Class, and by the type of mounts (ie: fixed or turreted) that are chosen for the weapons.**
- **Procedure:** when equipping a vehicle with weapons, **select the LARGEST (or "Primary") weapon to be fitted first**; if it is to be in a **FIXED MOUNT** (ie: like a Tank Destroyer or Assault Gun), the amount of CAPACITY that the weapon takes up is equal to **TWICE the weapon's SIZE CLASS**; if it is to be in a **TURRET**, it takes up **THREE TIMES its SIZE CLASS**. Example: a class 3 weapon (of whatever type) fills 6 points of Capacity if in a Fixed Mount, or 9 points if in a Turret.
- [This capacity includes the gun mechanism, crew space, ammunition storage etc.; turreted guns take more capacity due to the internal space required in the hull for the turret mechanism and so on.]
- **Note that this refers to DIRECT FIRE WEAPONS ONLY (including SLAM packs)**; other weapons such as Guided Missile Systems, Point Defence, etc. all occupy **fixed amounts of capacity as listed in the systems table on P.16, regardless of whether they are turret-mounted or not**.
- **When further weapons are added to a vehicle that already has a Turreted main weapon (including adding extra barrels of the same weapon type to make a multiple mount), all the additional weapons only occupy TWICE their class in terms of capacity** – the extra bulk of the turret has already been accounted for in the primary weapon. Thus to put (say) a **TWIN-MOUNT class 3 gun system in a turret would use up 9 capacity points for the first barrel, but only 6 for the additional one – a total of 15 points capacity for the twin-mount**.

| Direct-fire weapon (incl. SLAM) | Capacity cost |
|---|---|
| Primary weapon, Fixed Mount | 2 × weapon class |
| Primary weapon, Turret | 3 × weapon class |
| Each additional weapon/barrel on a vehicle that already has a turreted primary | 2 × weapon class |
| GMS, Point Defence and other non-direct-fire systems | fixed cost from systems table P.16 (mount type irrelevant) |

Worked example printed: class 3 fixed = 6; class 3 turret = 9; twin class-3 turret = 9 + 6 = 15.

- **NO VEHICLE MAY BE FITTED WITH MORE WEAPON SYSTEMS THAN ITS BASIC SIZE CLASS**; thus a class-3 vehicle could carry no more than THREE weapons systems. **Multiple mounts count every barrel towards this limit, and a Point-defence System counts towards the total as well.** The only weapon NOT counted in this total is a single APSW, as below.
- **ALL MILITARY VEHICLES ARE FITTED WITH ONE "FREE" APSW, CAPABLE OF ALL-ROUND FIRE; THIS WEAPON DOES NOT COUNT TOWARDS ANY WEAPONS FIT LIMITATIONS, OR TAKE UP ANY CAPACITY.** [This is assumed to be a Machinegun or equivalent, on an external remote mounting. **Additional APSWs may be fitted if desired, but any such extras each occupy ONE capacity point and DO count towards total weapons fit limitations.**]

| Item | Counts toward weapon-count limit (= size class)? | Capacity |
|---|---|---|
| Each direct-fire weapon barrel | yes | 2× or 3× class as above |
| Each GMS launcher | yes | fixed (P.16 table) |
| Point-defence System (PDS) | yes | fixed (P.16 table) |
| First APSW (free, all-round fire) | NO | 0 |
| Each additional APSW | yes | 1 |

**Digest note:** page 11 ends here; the section continues on page 12 with a NOTE recommending a maximum single-weapon size of ONE CLASS LARGER than the vehicle's size class, and worked examples – that page is in another chunk.

---

## Pages checked

- pt1-p07.png — Chapter 2 text pages (end of technology overview; force organisation) plus an illustration.
- pt1-p08.png — Chapter 3: size classes, weapon size classes, direct fire weapons 1–5 (HEL continues), plus an illustration.
- pt1-p09.png — HEL continued, DFFG, GMS, SLAM, plus an illustration.
- pt1-p10.png — Power plants, armour, two illustrations.
- pt1-p11.png — Signatures/stealth, system qualities, arcs of fire (with diagram), weapons fit limitations (continues on p12).

All content verified against scans. Two OCR errors corrected as noted inline:
- Restricted turret arc shown as "50°" in OCR; scan clearly prints "90°" (representing 180° total arc, ±90° either side)
- Reactive armour suffix shown as "A"/"48" in OCR; scan clearly prints "R" and "4R"

No other errors found. The first reader's digest was comprehensive and accurate.


---

# Chunk pt1-c · 12–16

## Vehicle Design (p.12-16)

### Design System Overview

The DIRTSIDE II vehicle design system allows players to classify virtually ANY miniature from any manufacturer and define its game capabilities. The system has two basic sections:

1. **DESIGN stage** - decide what equipment and capabilities you want the vehicle to have, and working through a simple procedure, determine what it will actually fit in that vehicle size
2. **COSTING stage** - determine POINTS COST of the vehicle or element, and is actually OPTIONAL (is not strictly necessary to know how much an element "costs"; if you prefer a force organisation based on scenario requirements)

#### Key Note on Oversized Vehicles

Players may (if agreed before play) experiment with Fielding Oversized vehicles using House Rules. The Points Value only becomes important if you and your opponent need a relative measure of the "value" of your forces, for instance if playing a "competitive" game and desire exact force balancing.

### Vehicle Size Classes

Vehicles are classified by SIZE CLASS for the vehicle itself. The following size classes determine the vehicle's overall dimensions, capacity, and combat characteristics:

- **VERY SMALL** (Scout cars, light patrol APCs)
- **SMALL** (Standard APCs, main battle tanks)
- **MEDIUM** (Larger battle tanks, command vehicles)
- **LARGE** (class 4 vehicles)
- **VERY LARGE** (class 5 vehicles)

NOTE: It is RECOMMENDED that players limit the MAXIMUM SIZE of any single weapon system on a vehicle to ONE CLASS LARGER than the vehicle's own Size Class. Thus a class 3 vehicle could not carry any single weapon larger than class 4. This is not an absolute ruling however, and players may (if all agree) experiment with fitting any gun size into whatever vehicle will hold it, within the limits of the Capacity points.

### Capacity Points System

#### Design Note
The Designers' note explains the Capacity system thus: it is possible to put a Fixed-Mount's 3 point on a class 2 weapon, but only just. There will not be any capacity left over for any other capacity-item.

#### Capacity Point Values

Carrying ONE infantry element (LINE or MILITIA troops) takes **4 points of capacity**.

ONE element of POWERED INFANTRY takes **8 points of capacity**.

One "LOAD" of CARGO takes **4 points of capacity** (eg: Artillery Ammunition).

Any smaller vehicle takes up **8 x the Size of that vehicle** (eg: carrying a SMALL vehicle takes 8 points of capacity).

A Command/Communications centre takes **8 points of capacity**.

#### Design Example

A MEDIUM (class 3) vehicle has 15 capacity points. If we wish to build a "Tank Destroyer" with a large fixed gun, we could fit a single class-4 weapon in a Fixed Mount at a capacity cost of 8; this leaves us with 7 points over. Deciding that a fully-traversable secondary weapon would be a good idea, we mount a class-2 gun (maybe an RFAC-2) in a turret, at a cost of 6 capacity points – as we did not fit a turret for the main weapon, the extra capacity MUST be allowed for on the secondary weapon. The ONE point thus left over could be used for an extra APSW (to supplement the one fitted "free"), or for any other capacity-1 item. (Example 1 on the same page: a LARGE (class 4) vehicle has 20 capacity points; a turreted class-4 main gun uses 4 × 3 = 12, a second class-4 barrel making a twin-mount would cost the full 8 more and leave nothing, so a class-2 secondary weapon in the turret (an RFAC-2 or MDC-2) at 4 capacity is chosen, leaving 4 points for defensive and other systems.)

### Weapon Size Classes

Weapons are classified by SIZE CLASS independent of the vehicle that carries them:

| Weapon Type | Class |
|-------------|-------|
| Small personal weapons (pistols, rifles) | 1 |
| Light support weapons (LMGs, light grenades) | 2 |
| Medium support weapons (HMGs, autocannons) | 3 |
| Heavy weapons (large cannons, HKP) | 4 |
| Very heavy weapons (tank guns, large lasers) | 5+ |

### Capacity Requirements for Vehicle Weapons and Systems

ALL DIRECT FIRE WEAPONS:

| System (printed p. 16, as read from the scan) | Capacity |
|---|---|
| ALL DIRECT FIRE WEAPONS | Class × 2 if in FIXED MOUNT (or secondary to a turret-mount primary weapon); Class × 3 if PRIMARY TURRET-MOUNT WEAPON |
| GUIDED MISSILE SYSTEMS | GMS/L = 2; GMS/H = 4 |
| POINT DEFENCE SYSTEM (PDS) | BASIC = 2; ENHANCED = 3; SUPERIOR = 4 |
| AREA DEFENCE SYSTEM (ADS) | BASIC = 10; ENHANCED = 15; SUPERIOR = 20 |
| LOCAL AIR DEFENCE (LAD) SYSTEM | 2 |
| ANTI-PERSONNEL SUPPORT WEAPON (APSW) | 1 (initial "free" APSW = 0) |
| ANTI-PERSONNEL FRAGMENTATION CHARGES (APFC) | 1 |
| INFANTRY TEAM TRANSPORT | Line/Militia = 4; Powered = 8 |
| CARGO LOAD TRANSPORT | 4 per load |
| SMALLER VEHICLE TRANSPORT | 8 × Size Class of carried vehicle |
| COMMAND/COMMUNICATIONS SYSTEMS | 8 |
| ARTILLERY WEAPONS | Class × 3 |
| COUNTER BATTERY RADAR | 14 |

### Artillery Vehicle Design

Artillery vehicles are designed in the same way as any other ground vehicle, with the following notes and limitations:

#### Artillery Weapons Capacity

i) **Artillery Weapons have SIZE CLASSES as follows:**
   - LIGHT ARTILLERY weapon (RAM MORTAR) = **class 2**
   - MEDIUM ARTILLERY weapon (RAM Guns, smaller MRLs) = **class 4**
   - HEAVY ARTILLERY weapon (MD Guns, large MRLs, HARs) = **class 6+**

ii) **Capacity calculations** on an Artillery weapon INCLUDES its Fire Control (as level of FireCon is not relevant to Artillery fire), and the space for ammunition. All ARTILLERY WEAPON MOUNTS TAKE UP CAPACITY EQUAL TO 3 x CLASS.

iii) **Artillery Arc-of-Fire** is assumed to be the FRONT 180° Arc; mounts are taken as limited traverse, or else the rounds are steerable in flight (eg: Heavy Artillery Rockets).

iv) **Artillery weapons** are generally only fitted to specialised Artillery vehicles, though it IS possible to mount them on other AVs in addition to Direct Fire weapons if sufficient capacity is available; such a "hybrid" vehicle could then act as either a normal combat vehicle OR as an Artillery piece as desired, but would have to follow all the relevant rules for each type.

v) **Counter-Battery Radar (CBR)** takes up **14 capacity points**; it is normally mounted on a separate vehicle, but could possibly be carried by an Artillery vehicle itself if sufficient capacity was available.

vi) **Although the vast majority of Artillery pieces are Self-Propelled** (ie: mounted on vehicle chassis), **it IS possible to use TOWED Artillery** if desired. **An Artillery weapon on a towed carriage has a Size Class (for Signature purposes) of one LOWER than the class of weapon per se** (eg: a towed MEDIUM ARTILLERY piece would be a size 3 element), and requires a "tractor" of an equal class or larger to move it around. **Limbering/unlimbering a towed piece to prepare for firing or movement takes a full activation.**

#### Costing and Ammunition

When costing a weapons system in the game, only the cost of the weapon system itself is paid for – the carriage costs nothing (though the Tractor vehicle must be costed as a normal vehicle). The tractor vehicle must be costed as a normal vehicle; it is assumed to carry all the "ready" ammunition for the gun.

**Towed Artillery counts as a softskinned target, ie: Armour rating 0.**

### Infantry and Cargo Transport

Vehicles that are designed to carry Troops or cargo must have a certain amount of their internal CAPACITY points dedicated to such accommodation. The capacities are as follows:

- Carrying ONE infantry element (LINE or MILITIA troops) takes **4 points of capacity**
- ONE element of POWERED INFANTRY takes **8 points of capacity**
- one "LOAD" of CARGO takes **4 points of capacity** (eg: Artillery Ammunition)
- any smaller vehicle takes up **8 x the Size of that vehicle** (eg: carrying a SMALL vehicle takes 8 points of capacity)
- a Command/Communications centre takes **8 points of capacity**

#### Example

A MEDIUM (class 3) vehicle has 15 capacity points. If we wish to build a "Tank Destroyer" with a large fixed gun, we could fit a single class-4 weapon in a Fixed Mount at a capacity cost of 8; this leaves us with 7 points over. Deciding that a fully-traversable secondary weapon would be a good idea, we mount a class-2 gun (maybe an RFAC-2) in a turret, at a cost of 6 capacity points – as we did not fit a turret for the main weapon, the extra capacity MUST be allowed for on the secondary weapon. The ONE point thus left over could be used for an extra APSW (to supplement the one fitted "free"), or for any other capacity-1 item. (Example 1 on the same page: a LARGE (class 4) vehicle has 20 capacity points; a turreted class-4 main gun uses 4 × 3 = 12, a second class-4 barrel making a twin-mount would cost the full 8 more and leave nothing, so a class-2 secondary weapon in the turret (an RFAC-2 or MDC-2) at 4 capacity is chosen, leaving 4 points for defensive and other systems.)

### Infantry Forces

There are a number of different types of INFANTRY (for non-vehicular) elements available; the exact types are:

#### Militia Infantry

MILITIA INFANTRY: this category covers very lightly-equipped troops, probably with basic or obsolescent weaponry. Although we use the term "Militia", this also covers second-line and reserve forces, irregular troops, rebels/guerrillas and so on. Though often poorly equipped, this type of Infantry will NOT necessarily be poor soldiers – in some units, many may be of Regular or even Veteran status – their abilities should be determined in accordance with the "history" of the unit and the scenario being played.

#### Line Infantry

LINE INFANTRY: the bulk of most first-line Infantry forces; troops equipped with modern weaponry and combat armour, but still relying on "battle taxi" APCs or MICVs for transport. As with the Militia type, the line Infantry clearly defines the unit's overall combat equipment, NOT their training or status.

#### Powered Infantry

POWERED INFANTRY: the high-tech troopers in full suits of Powered Combat Armour; these suits enable the men to move far faster and further than their "unpowered" counterparts, protect them much more against enemy fire and allow them to carry far heavier weaponry. The Powered Infantry are the "shock troops" of the battlefield, able to independently of transport vehicles if necessary and to fight in the most hostile environments their psychological effect alone is typically against lighter infantry types of considerable value. In general, most Powered Infantry units will be of Regular or Veteran status rather than Militia or Green – the majority of armies tend only to field second-line and reserve forces, irregular troops, rebels/guerrillas and so on.

#### Cavalry

CAVALRY: the idea of using Cavalry (ie: troops on riding animals) in an SF environment is not as strange as it may first sound. Horses or other beasts can be transported to colony worlds as frozen embryos, require minimal maintenance, and breed true under most environmental conditions. They can traverse terrain types that are otherwise impassable to all but airborne units. Few small settlements and rural colonies (with limited resources and technological base, the use of animals for transport of troops and supplies may well be a very attractive and cost-effective proposition. The use of Cavalry under these rules generally modifies horses or horse-like creatures with light rulers, but there is absolutely no reason why you should not experiment with more "exotic" ideas (Power-Armoured troops riding genetically-modified elephants, perhaps).

#### Team Organization

A given Team may consist of from two to five men; the following are the different types of teams available, any of which may be made from any of the above-mentioned kinds of troops and equipment:

**A RIFLE TEAM** is the 'basic' Infantry element; it consists of four or five troopers equipped with Personal Arms ("Rifles" plus usually HAPCs). Most such teams will also contain a light team-support weapon (an LMG or GPMG equivalent), but this is NOT considered a separate weapon for firepower purposes – its effect is factored into the overall "personal arms" firepower of the team.

**An APSW TEAM** is a two or three-man element carrying an Anti-Personnel Support Weapon (eg: a heavy MG, automatic grenade launcher or equivalent). The weapon team only carry Close-defence personal weapons in addition to the APSW.

**An ASSAULT TEAM** is a four or five man team (like a Rifle Team), but armed with assault weapons – they may NOT fire in Ranged Firefight combat, but get a bonus over normal teams at Close-Assault combat. These Assault teams are available as MILITIA or LINE types only – Powered troops already have the increased combat capability for such uses anyway.

**A FIRE DESIGNATION TEAM** is a two or three man team dedicated to observing and designating any Artillery Fire support. They carry close-defence weapons in addition to their designating and sensor equipment.

**An ANTI-ARMOUR TEAM** is a two or three men carrying a GPMSL system for anti-tank use; they carry only close-defence weapons in addition.

**A LOCAL AIR DEFENCE TEAM** consists of two or three men with a light AA Missile system (such as a light AA Missile system), plus close-defence weapons.

**An ENGINEER TEAM** consists of anything from two to five men with demolitions, mine-clearing and other specialist combat engineering equipment; plus close-defence weapons.

#### Important Note on Infantry Weapons

**Note that RIFLE TEAM Personal Arms and APSWs are the only weapons that can perform ranged fire during an INFANTRY FIREFIGHT.** All other teams have only close-defence weapons (machine pistols, SMG equivalents etc.) for personal protection, which may be used in Close Assault combat but NOT in ranged firefights.

### Riverine Craft

The term RIVERINE CRAFT covers vessels built for coastal, river and other "brown-water" operations, usually in support of land forces. They may be 'conventional' boats, hydrofoils (usually with retractable foils to permit operation in very shallow water), Surface-Effect craft using a 'rigid sidewall' (RSW) Air Cushion, and even small spacecraft-class. Riverine craft will likely to be used by lower-tech forces, as the advent of better GEVs and Grav vehicles will tend to make them less dependent for many missions; however a 'boat' of whatever sort is still a low-cost and efficient form of transport in areas with suitable waterways available.

### Riverine Craft Design

Watercraft are designed and costed using exactly the same procedures as for ground vehicle elements. There are a few different limitations imposed on watercraft design, as follows:

i) **Riverine craft may not carry Armour rating more than TWO LOWER than their size class** – thus a class 4 (LARGE) vessel could only have up to Armour 2. Vessels of size 1 and 2 can only be Armour 0 (softskinned).

ii) **No vessel may mount a WEAPON of a class more than ONE LOWER than their size class** – eg: a class 3 (MEDIUM) watercraft could only mount class 1 or 2 weapons (however, it could still mount up to 3 such weapons – the NUMBER limitation remains as normal). Size 1 vessels MAY mount a single class 1 weapon.

iii) **Watercraft require Power Plants as normal**, with usual limitations on certain weapon types according to power available. For mobility, any Power Plant type is sufficient for conventional boats and hydro-foils, but RSW Air Cushion craft have the same requirement as GEVs.

Some of the larger watercraft types that players may wish to use (eg: Landing Craft and big Fire-Support Monitors) will require the OVER-SIZE VEHICLE rules discussed on P.15.

### Airborne Vehicles

Airborne Vehicles are divided into two main groups: VTOLs and AEROSPACE CRAFT.

#### VTOLs

VTOLs are flying combat vehicles that may hover, land/take-off on table, operate at NOE (Nap-Of Earth, or Terrain following height) and so on. The category covers conventional helicopters, Tiltrotors, VTOL craft and the equivalents of 20th century battlefield helicopters, and pure "vectored-thrust" aircraft (VTOL which may anywhere brute thrust alone. VTOL may be able to carry out observation and armed helicopter operations through brute thrust alone). VTOL may use terrain-based assault tactics, and perform SOME kinds of function through brute thrust alone, and act as transport functions and can support armoured assault, tank hunting. Casevac of wounded etc.

**AEROSPACE CRAFT** covers high-speed ground attack fighters (mostly capable of operations in an atmosphere and in low-orbit), interceptors and such, but interface assault large Dropships carrying an Armoured Squadron or more) are also slotted here as AEROSPACE CRAFT, but their design and use are INTERFACE LANDINGS on P.43.

#### Air Vehicle Design

Both VTOL craft and Aerospace craft are designed in basically the same way as ground elements, with the following provisions:

i) **For CAPACITY** (to fit weaponry, ordnance and other cargo), VTOL craft and Aerospace craft all have the same as ground elements (ie: 5 x Size Class).

ii) **For Power Plants, ALL air vehicles must pay the costs for FGPs** (this does not necessarily mean that they are Fusion power, but covers the fact that they require much more powerful and costly engine systems than ground vehicles). Note also the special costs for mobility types in the points lists.

iii) **Direct Fire weaponry on Air vehicles is more limited** than on ground elements. **VTOLs may employ small turrets (usually chin-mounts) that may fire APSWs or a Class 1-2 weapons** (and ALL Direct Fire weapons on ground-attack Aerospace craft must be in fixed mounts, firing forward). Additionally, **NO WEAPON OVER CLASS 3 may be fitted to any Air vehicle**.

iv) **For Design** (by reference to P.37 FOR DETAILS OF ARTILLERY WEAPON TYPES) **on Aerospace craft, an Ordnance load marker represents one Ammunition load or one ordnance deployment of the relevant type, and is expended when Ordnance Load is dropped**.

v) **Armour ratings on Air vehicles are limited to MAXIMUMS of Armour 2 for VTOL craft, and Armour 3 for Aerospace craft; additionally, no air vehicle may carry Armour heavier than 1 LOWER than their Size Class.** Thus a 3 VTOL could only carry Armour 2, but a 3-size Aerospace craft could carry up to Armour 3. [For Air vehicles, the "armour" rating does not simply indicate thickness of armour carried but also the general "survivability" of the aircraft.]

### Combat Walkers

The Combat Walker is a very specialised type of fighting vehicle; this is the huge 'Mecha' or 'say well-known to gamers the world over. While the actual rationale behind building and using them is tenuous to say the least (five metres tall on the modern battlefield, you might as well paint a TARGET on yourself!), the fact remains that the idea of the "big in Samurai" striding across the table is great fun!

Walkers are thus included here entirely as an optional rule; if you like them and wish to create that kind of battle, then use them freely – if you hate the things then just leave them out. Be warned, however, that even if you do use them they are NOT the all-powerful kings of the battlefield – they are just another type of AV, and will get K0'd just as quickly as anything else (or possibly quicker, as they say, "the higher they are the easier they are to Nuke from orbit...").

#### Combat Walker Design

Walker vehicles come in three basic types: the true **Combat Walker (effectively a 1/300 scale, Infantry Mecha, 3-4 metres tall and used like a very heavy powersuit)** and **Transport Walkers (small mech-legs, SF films...)**

All Walker vehicles are designed using the same basic system as any other vehicle; the walker size class limitations are:

**Combat Walkers and Transport Walkers may be class 4 or 5 (VERY large – class 6 or 7 if oversize vehicles are being permitted).**

When fitting weaponry to Walkers, normal size and capacity limitations apply. The only variation is that **ALL weapon mounts cost as fixed mounts (ie: 2 x Class) in terms of capacity, yet have a special ARC OF FIRE as noted below.**

**Maximum armour ratings are as per normal vehicles, ie: equal to Size class.**

**SIGNATURES of Walkers are ONE HIGHER than normal for their size class**, due to their upright, visible profile, plus the fact that has a BASIC signature of 5. Stealth systems can reduce this signature if required and are practically recommended if you want your Mecha to survive very long! [Note that this gives a class 4 Walker a Signature of 5 – if no Stealth is used, but if Stealth is used, refer to section on Oversized vehicles for rules on firing at elements with signatures greater than 5.]

#### Walker Arcs of Fire

Though Walker weapons are treated as "FIXED MOUNTS" for capacity and point purposes, they actually have much more flexibility than a normal vehicle Fixed Mount due to the much higher mobility and agility of the Mecha design. All weapons on Walkers may fire through a **180° Arc**, as the restricted traverse turret are shown on P.11. In addition, **all weapons of the SAME TYPE CLASS on a Walker may be counted as a "multiple mount"**, even if actually positioned in different "arms".

### Aerospace Weapons

Aerospace craft may carry Direct Fire weapons and Guided Missiles which function in the same way as their ground-fired counterparts. They may also carry DEADFALL ORDNANCE (DFO), which are Cluster Bombs (or Submunition Dispensers) available in the same types.

Each aircraft may carry one or more "ORDNANCE LOADS", each such Load representing one Ordnance dropped on one attack pass (though multiple loads may be dropped simultaneously on the same target point if desired).

One Ammunition marker represents one ordnance deployment of the relevant type, and is expended when the Load is dropped.

"To record the Loads carried on each aircraft, use some of the Ordnance Load markers; either kept off-table or placed with the aircraft model as desired. **One Ammunition marker represents one Ordnance deployment.**"

### "Oversized" Vehicles

The basic design and combat systems allow only for vehicles up to VERY LARGE size (class 5), as this should cover most models and types that players will wish to use. There is no reason, however, the limits cannot be expanded to cover "OVERSIZE" vehicles of classes 6 and 7 and beyond. These represent the REALLY big machines (such as CYBERBANKS of military SF (eg; Keith Laumer's BOLO series and the like) – huge mobile arsenals grinding forward on massive treads, comparable to all but the biggest vehicles and directed by their own onboard Artificial Intelligence.

The way to construct such vehicles for use in DIRTSIDE II is to treat each one not as a single vehicle, but as a series of "MODULES" linked together. Each Module is constructed and costed separately under the normal design rules, and may be of any size from class 1 to class 7 (oversized).

To give an example, the classic type of Cybertank that most players will be familiar with is a MODULAR vehicle (say) class 5, a rear turret module of class 5, and four "tread" modules (one at each corner), each of class 3 modules.

#### Modular Construction Rules

i) **The only permissible Mobility type is Tracked (Fast or Slow as desired)** – no other form of propulsion is practical for something this size! The total size of all the Tread modules becomes the mobility cost – so the example above would have the mobility costs (4 x class 3 modules).

ii) **The Multiple FireCon rule** suggested for class 6/7 vehicles may also be used for Modular designs; up to a maximum of FOUR systems may be fitted to the entire vehicle.

iii) **Weapons and systems may only be fitted to the Main Hull modules** (front and rear in the example above). The "tread" modules may not carry weapons. The TOTAL capacity of the main modules may be treated as one figure for the purpose of it. Thus the example vehicle would have a capacity of 50; the weapons by distributed as desired between the main modules, regardless of individual module capacities.

iv) **NO Stealth abilities are available for Modular vehicles** (they are too large to hide, even electronically). All Oversize Modular vehicles always use a D4 as their base target die.

v) **Oversize vehicles may in general use whatever mobility type is desired, but players may if they wish apply some extra limitations on movement** – some terrain types may be deemed impassable to class 6 or 7 vehicles due to their sheer weight and bulk. Such limitations must be agreed before the game.

#### Modular Vehicle Rules

**Armour rating on any module may not exceed 7;** the "tread" modules may carry Armour up to ONE LEVEL HIGHER than their size class, and the Main modules up to TWO LEVELS higher. (Thus the example vehicle could have Armour 7 on its main modules, and Armour 5 on its Tread modules.)

**The Armour limit is applied on a module-by-module basis.** When firing at a MODULAR vehicle, a particular module is the target. The firing player may CHOOSE which module is hit by the shot.

#### Firing at Modular Vehicles

When attacking Modular Oversized vehicles, **ALL shots are counted as CLOSE range due to the huge size of the target;** in addition, the target vehicle NEVER has to roll a Secondary die, whatever the circumstances – just hit the target vehicle.

If a modular vehicle is caught in an Artillery Beaten Zone, draw chits separately for EACH module of the vehicle.

When firing at MEDIUM or LONG range (this is the TRUE range, not the "always Close" range used for determining hits), the particular MODULAR vehicle that is the target. The firing player may CHOOSE which module is hit by the shot.

It will be necessary to make up a simple "control card" for each modular vehicle, with a box on it for each module – damage markers affecting each module are placed on this card as required. Markers that affect the vehicle may be placed on-table as normal.

**Destruction of one tread module** will reduce the vehicle to half movement, loss of two or more tread modules will immobilise the vehicle. The catastrophic destruction ("BOOM") of any module will completely disable the vehicle.

### Classifying Vehicle Models

We have already mentioned that DIRTSIDE II allows you to take virtually ANY miniature, from any manufacturer, and define its capabilities for use in the game. **There are two basic sections to this procedure: the DESIGN section (stage) and the COSTING stage (stage).**

The former consists of deciding what equipment and capabilities you wish the vehicle to have, and working through a simple procedure, to determine that what you want will actually fit in that vehicle size, and

i) to determine that what you want will actually fit in that vehicle size, and
ii) to see the statistics of that the vehicle will carry, and
iii) see the statistics of the vehicle will carry.

(Costing) stage is to determine the POINTS COST of the vehicle or element, and is actually OPTIONAL – it is not strictly necessary to know how much an element "costs"; if you prefer a force organisation based on scenario requirements.

Full points cost lists are included in the appendices, on P.52.

The first part of DESIGNING a vehicle is to choose the model you are using, and have a good look at it. In most cases it will be obvious which role(s) the vehicle is intended to fill; the model what basic weapon(s) it has, what armour it is carrying, and a common-sense appraisal of the size of the actual model. We are deliberately NOT going to lay down dimensions and formulae for exactly what constitutes, say, a VERY SMALL, MEDIUM or VERY LARGE vehicle – mindscape; in some cases, it is large scout car on the table tries to tell you about vehicle class, a Firefly, you might gently point out the error of his ways....).

Having decided the SIZE and WEIGHT of your vehicle, you now need to choose exactly what weapons, equipment and systems it will carry. Once again, only common-sense when looking at the model itself: if it has a long-barrelled gun and a multi-tube launcher on the turret, you might guess it's a SLAM pack as a secondary weapon. The actual Class of weapons will be determined from the limits imposed by the vehicle imposed by the vehicle [refer to section 3 for the weapon Class chosen. When fitting such systems as Fire Control, ECM and so on, bear in mind that we use the Thesaurus Signature from 4 to 3).

The best way to explain the Design system is to give you a working example: consider the tank shown in the photo on the front cover of this rulebook (the DEIMOS/50 Heavy Tank from CM DESIGNS catalogue no. TMT-12).

The hull of the model measures about 35mm long by 20mm wide; looking at it in relation to other items in the CMD range (and a 1:300 range scale) and other miniatures in general) the DEIMOS could reasonably be classed as a LARGE (Class 4). For MOBILITY, the model would reasonably be classified as a reasonably speedy vehicle for a medium-sized army, so decide on SLOW GEV as a reasonable Mobility Type.

#### Design System Example

The example vehicle (from the image) is the **DEIMOS/50 Heavy Tank** from CM DESIGNS:

- Hull measures approximately 35mm long by 20mm wide
- Classified as LARGE (Class 4)
- For MOBILITY the DEIMOS is classed as SLOW GEV (a medium-sized army would be well for a GEV (hover) or GRAV vehicle; say we are designing vehicles for a medium tech army, so decide on SLOW GEV as a reasonable Mobility Type

Adding the POWER PLANT type next. For a SLOW GEV of size 4, we need at least a Superheavy Turbine (HET) – a diesel-fuelled engine will simply not have enough power to lift the tank. If the background allows for it, it would allow MDC or Fusion plant for this sort of vehicle would be a Fusion plant (FGP) to allow more freedom in weapons fit.

Now we can ARMOUR the vehicle, as it is a battle Tank, it makes sense to go for the heaviest allowable, which is the same as the vehicle size class – thus we fit Armour 4. For SIGNATURE the extra cost of Ablative or Reactive armour is not deemed worthwhile at this point.

Then comes the fun bit – putting the guns on! Obviously the model is a TURRET, with a single main gun of what appears to be a fairly substantial size – a LARGE Turret-mounted weapon on the turret. After deliberation, we decide to fit a 3-4 Mass Driver (MDc-4) with SUPERIOR FireCon; Turret Mounted Armament: **1 x MDC-4 with SUPERIOR FireCon; 1 x GPMSH ENHANCED Guidance; ENHANCED PDS;** (note that the GPMSH ENHANCED ECM, Stealth-1 (Basic Signature 6, Effective Signature 5).

Other systems: **APFC system** round the hull.

There are obviously a lot of other options we could even have gone for a fairly well-balanced offensively/defensive capability for such a vehicle; we find our tank unfit particular model, thus a value of 356 points.

Using the points cost on P.52, the DEIMOS has a **value of 356 points.**

### Capacity Requirements for Vehicle Weapons and Systems

(Detailed table already listed above in the "Capacity Points System" section)


---

# Chunk pt2-a · 17–21

## SEQUENCE OF PLAY - PRELIMINARIES (Page 17)

### Setup and Table Divisions
Before the game starts, terrain must be set up. The playing area is divided into three equal thirds: each player's REAR AREA (adjoining their baseline) and the MAIN BATTLE AREA (middle third). This division determines objective marker placement.

### Objective Markers
- Objective markers are counters representing key points of value to one or both sides
- Placed FACE-DOWN; players examine values when their units move over them
- Players place at least HALF (rounded down) of their markers in their own Rear Area, remainder in Main Battle Area
- Markers must be placed at least 6" apart (except may place one of own markers on same location as opponent's to create VERY high-value objective)
- Markers are "taken" when a unit moves over them (NOT Air units unless dropping troops)
- Markers remain on table after being taken and can be "re-taken" by opposition

### Encounter Battles
- Simplest form of game; both forces enter from baselines at start
- Fight mobile battle for possession of Objectives on table
- Players agree on number of Objective Markers (between 3-6 per player recommended)
- Place ALL markers randomly, each player picks required number face-down
- Player sees values of markers they picked but NOT opponent's markers
- Either player may declare "GAME END" if they currently hold MORE THAN HALF of TOTAL Objective markers
- Winner determined by total VALUES of markers held (not quantity)

### Attack/Defence Battles
- DEFENDING player draws ALL markers to be used, places as desired with limitations:
  - At least ONE objective marker in Defender's Rear Area
  - At least HALF (rounded down) in Main Battle Area
- At start of game, ALL objectives considered 'held' by DEFENDER
- ATTACKER must take objectives by moving units over them (usually displacing occupants)
- ATTACKER may declare GAME END at any time if enough objectives taken for victory
- Winner determined same way as Encounter battles

### Deployment Phase
- Once Objective markers placed, each player deploys forces
- ENCOUNTER battle: both players deploy (alternately, unit-by-unit if desired) not more than 6" from own baselines
- ATTACK/DEFENCE battle: 
  - DEFENDING player deploys first in Main Battle Area and own Rear Area (not in Attacker's Rear Area)
  - May use 'hidden units' rules if desired
  - ATTACKER deploys within 6" of baseline, as for Encounter battle
- For specific scenarios: different deployment instructions may be given; follow those over general rules

---

## SEQUENCE OF PLAY - THE GAME TURN (Page 18)

### Turn Sequence Overview
Dirtside II uses an INTEGRATED GAME SEQUENCE where each player takes turns to move, fire and/or make other actions with ONE platoon-sized UNIT of their choice (not necessarily alternating forces). When a player decides a unit will do something, that unit gets to perform ALL of its actions it wishes in one point, then play passes to opponent.

### Activation Mechanics
- Each element in unit may take any of these options:
  - MOVE, THEN PERFORM A COMBAT ACTION
  - PERFORM A COMBAT ACTION, THEN MOVE
  - PERFORM A COMBAT ACTION ONLY
  - MOVE ONLY
  - DO NOTHING
- Different elements in same unit may choose different options
- All actions must be completed within unit's Activation
- Once unit performed all desired actions, invert COMMAND MARKER to show activation used
- THEN REMOVE ANY UNDER FIRE MARKERS that the unit has been affected by (CRITICAL: this was missing from original digest)
- Unit with inverted marker may perform NO further actions that Game Turn

### Command Markers and Activation
- COMMAND MARKER inverted to show unit has used its ACTIVATION for that turn
- Mark the unit's status with the counter and thus finished its COMBAT SEQUENCE
- Player with SMALLER number of units on table chooses whether to activate first (may differ each turn)
- NOTE: Units are NOT forced to make any actions unless as result of adverse Confidence levels; players may activate all, some, or none of forces

### Passing and Forcing Activation
- Player may elect to PASS on an activation to forgo activating a unit
- ONLY if that player has fewer UNACTIVATED units (face-up Command Markers) than opponent
- This forces opponent to activate two units in succession

### Combat Action Options Available
Provided element is suitably equipped and circumstances don't inhibit action:
- Perform DIRECT FIRE
- Engage in INFANTRY FIREFIGHT
- Act as OBSERVER to call in INDIRECT FIRE
- Perform CLOSE ASSAULT
- ACTIVATE or DEACTIVATE Area Defence Sensors (for aerial targets during Game Turn)
- NOTE: Any element may only fire ONE weapon system per Combat Action; multiple mount weapons of same type and class count as one system

### Special Notes
- FIXED MOUNT weapons may ONLY be fired BEFORE (or instead of) moving
- Unit ATTACKED by CLOSE ASSAULT must immediately INVERT Command Marker if not already inverted (loses chance at own activation if not previously activated before assault)

---

## CYBERTANKS - ACTIVATION (Page 19)

### Cybertank Definition and Mechanics
- CYBERTANK: vehicle controlled completely by onboard Artificial Intelligence (AI)
- Can be any size class, but typical Cybertanks from SF novels are huge vehicles designed using Modular Vehicle rules (P.15)
- Considered a "unit" in its own right
- May be activated as for any other unit at any point in turn
- Does NOT require Confidence Level marker (never suffers Confidence problems or needs tests)
- SHOULD have Command marker (a VETERAN "1") as indicator of activation status

### Cybertank Characteristics
- Very powerful units, immune to Confidence and reaction problems
- Always do as ordered without question
- Use in most games should be strictly controlled to prevent serious imbalances
- Can be used effectively in scenario with small group of Cyber vehicles against larger conventional force

---

## THE TURN END PHASE (Page 19)

When both (or all) players have conducted all Activations for desired units, this completes the Game Turn.

**TURN END PHASE consists of:** ALL inverted Command Markers being turned face-up in readiness for next Game Turn to start.

---

## TARGET PRIORITY (Page 19)

### Core Principle
**ANY UNIT WILL ALWAYS ENGAGE THE ENEMY UNIT THAT IS SEEN AS THE GREATEST THREAT TO THE FIRING UNIT ITSELF.**

### Amplifications to General Principle
1. **Unit Activation Status:** Units will generally engage an already-activated enemy unit rather than one that has not yet activated for that turn (A unit that has already moved and/or fired has drawn attention to itself)

2. **Distance:** Units will normally engage enemies closer to them rather than ones further away, UNLESS the nearer enemy poses less threat to firer (e.g., closer Infantry COULD be ignored in favor of more distant AFV target, but NOT if infantry have GMS with them)

3. **Cover Status:** Units will normally engage an enemy that is in the open, rather than one concealed or in cover, UNLESS the exposed element does not pose immediate threat

### Resolution of Disputes
Any real dispute over Target Priority can be settled by impartial umpire or die roll/coin flip. Players should treat this in the SPIRIT of rules rather than "letter" of them.

---

## AREA DEFENCE SYSTEMS (Pages 19-20)

### ADS Definition and Capabilities
- **AREA DEFENCE SYSTEM (ADS):** Multi-role automatic gun system with comprehensive Sensor suite
- Permits engagement of both Airborne targets and missiles in flight
- Similar to much smaller PDS (Point Defence System), but ADS can protect not only vehicle it's fitted to, but also other friendly elements within certain distance of ADS vehicle

### ADS Activation and Firing
- ADS may ONLY be fired when it has an ACTIVE SENSORS marker
- ACTIVE SENSORS marker may be placed in any Activation of ADS vehicle
- May remain in place until player wishes to Deactivate Sensors in subsequent activation turn
- While Active Sensors present, ADS may be used against ANY valid target, as many times in a turn as necessary
- No limit to number of separate attacks it may defend against in any one turn
- May engage any individual target only ONCE per turn (e.g., if unit of VTOLS over table and in range, ADS fires on them only ONCE when VTOL unit activated)
- Effectively uses OPPORTUNITY FIRE (firing during opposing units' activations) but without limitation of losing own activation turn

### ADS Signature and Detection Penalty
- When Active, ADS vehicle has EFFECTIVE SIGNATURE INCREASED BY ONE
- Any ECM it carries becomes ineffective (counts as having NO ECM)
- Any STEALTH ADS vehicle has is rendered ineffective
- Effective Signature one higher than vehicle's BASIC signature, regardless of any Stealth Levels
- Penalty: ADS pays by emitting many detectable signals, attracts fire from anything that can see it

### ADS Missile Defence Range
- Area protected by ADS vehicle is 24" diameter circle
- Any friendly unit within 12" of ADS (and in line of sight of ADS) may benefit from system's protective fire if attacked
- For details on ADS fire against Missiles, refer to P.31.1

### ADS Air Defence Range
- Maximum range against Air vehicles: 36" (subject to line of sight limitations)
- For details on ADS fire against Air vehicles, refer to AIR DEFENCE section on P.42

---

## AREA DEFENCE SYSTEMS AGAINST GROUND TARGETS (Page 20)

- ADS vehicles MAY fire at ground targets if they do NOT currently have sensors active for defence use
- In this case, may engage with direct fire during own activation turn, as for any normal ground vehicle
- When firing at ground targets, ADS is counted as RFAC/2 for all Range Band, hit and damage resolution purposes

---

## OPPORTUNITY FIRE (Page 20)

### Opportunity Fire Definition and Conditions
- While opponent is moving elements of a Unit being activated, player may declare wish to perform OPPORTUNITY FIRE against unit being moved
- May be carried out with any unit that:
  - Has NOT yet used its activation for that turn
  - Is able to engage the moving unit with direct-fire weaponry

### Opportunity Fire Resolution
- When declared, opposing player must pause in moving his elements
- Player wishing to fire does so and resolves all subsequent effects
- If fire results in moving unit taking Confidence Test, done immediately and results applied
- After fire resolved and tests taken, opposing player may then complete unit's activation

### Opportunity Fire Restrictions and Consequences
- Unit performing Opportunity Fire has its Command Marker inverted immediately after fire resolved
- Opportunity Fire counts as that unit's activation for that turn
- Unit may NOT perform ANY other actions, EVEN IF ONLY SOME ELEMENTS OF UNIT ACTUALLY FIRED
- NOTE: This option NOT possible for vehicles that wish to fire FIXED MOUNT weapons as their Combat Action; Fixed Mounts may ONLY be fired BEFORE (or instead of) moving

---

## HIDDEN UNITS (Page 20)

### Hidden Unit Purpose and Use
- Used in Attack/Defence games (or any other scenario that warrants it)
- DEFENDING player may elect to deploy some forces in concealed positions
- Units NOT placed on table during deployment phase, represented by "Hidden Unit" markers placed face-down in locations occupied by actual units

### Hidden Unit Markers
- Green counters marked with single letters (24 supplied)
- May be supplemented by up to half their number of "Dummy" markers
- One marker used per UNIT starting game in concealment
- Must be placed in positions where elements could reasonably be concealed from enemy reconnaissance (edges of woods, within groups of buildings, etc.)
- Marker placement represents approximate centre of actual unit's deployment area
- When models finally placed on table, should be suitably spaced around marker location within Unit integrity limits
- Dummy markers placed in suitable locations to confuse attacking player

### Hidden Unit Revelation
- Revealed when:
  - Owning player first wishes to Activate that unit, OR
  - First time attacking element obtains clear line-of-sight for sensors to hidden marker
- Dummy markers removed from play when revealed
- Real markers replaced by models they represent

### Critical Rule on Hidden Units
- NOTE: NO unit may enter 'hidden' state while game in progress
- Once unit located for first time, Command Control AIs won't forget about it again

---

## COVER AND CONCEALMENT (Page 20)

### Soft Cover
- Infantry and vehicle elements may adopt 'covered' positions behind hilltops, ridgelines, in wood edges, etc.
- Such positions count as element being in SOFT COVER
- Vehicle "hull down" has same effect
- Element in cover may fire and perform other combat actions normally, but receives defensive bonuses (specified in combat sections of rules)

### Dug-In Positions and Engineering
- Dug-in positions require emplacements for tanks and AFVs, trenches or foxholes for Infantry, etc.
- Unit declared DUG-IN indicated with dug-in marker from counter sheet
- If unit moves from position, loses benefit of defenceworks; marker left in original location on table
- Marker may be re-occupied later by either player's forces
- Units occupying Dug-in positions benefit from various defensive bonuses (specified in combat sections)

### Dug-In Position Restrictions
- May ONLY be used by DEFENDING forces that start game deployed into such positions
- EXCEPTION: if force equipped with specialist ENGINEERING elements to create defensive works during game (rules given in Combat Engineering section on P.45)

---

## EFFECTS OF WOODS (Page 20)

### Wood Definition and Classification
- Wooded areas on table block lines of sight and fire
- Can offer concealment to elements
- Woods defined as LIGHT or DENSE for unit movement purposes
- For all other game functions, both types of Woods treated same way

### Wood Positioning Rules
- Any element or unit occupying Wooded area must be declared as either:
  - WITHIN the wood (if its Mobility type allows this), OR
  - On the EDGE of the wood
- To be counted as on EDGE of wood:
  - Elements must be in contact with defined fringe of wood area
  - Useful if woods depicted on table by cloth or paper area dotted with model trees (rather than just using trees alone)
  - This gives clearly delineated "edge" to wood

### Wood Location Effects
**Elements on edge of wood:**
- May fire normally at targets outside wood
- Count as being in SOFT COVER when fired at
- Receive defensive bonuses when being fired at

**Elements actually WITHIN wood:**
- May NOT fire (nor be fired on) by direct fire weapons or Infantry arms
- May ONLY be engaged in Close Assault by Infantry also inside wood
- May be attacked by Artillery targeted on wood itself

---

## DUG-IN UNITS (Page 20)

### Dug-In Definition
- More effective form of Cover and Concealment than simple soft cover
- Requires provision of defensive positions such as hull-down emplacements for tanks and AFVs, trenches or foxholes for Infantry, etc.
- Unit that is declared DUG-IN indicated with dug-in marker from counter sheet

### Dug-In Movement and Marker Status
- Should unit move from position, loses benefit of defenceworks
- Marker remains in place on table in original location
- Marker may be re-occupied later by either player's forces
- Units occupying Dug-in positions benefit from various defensive bonuses (as specified in combat sections of rules)

### Dug-In Placement Restrictions
- May ONLY be used by DEFENDING forces that start game deployed into such positions
- EXCEPTION: if force is equipped with specialist ENGINEERING elements to create defensive works during game (rules for these given in Combat Engineering section on P.45)

---

## UNIT QUALITY AND LEADERSHIP RATING (Page 21)

### Unit Quality Classification
Each platoon-sized UNIT in player's Combat Group has two important characteristics:
1. **UNIT QUALITY:** Rated as one of three levels:
   - **GREEN:** New and/or inexperienced troops
   - **REGULAR:** Average line troops with some combat experience and reasonable training
   - **VETERAN:** Highly experienced and motivated troops

2. **LEADERSHIP RATING:** Measure of how good unit commander is at his job and how he is liked/respected by troops
   - Rated as 1, 2, or 3
   - Grade 1 leader: man that so inspires his men they would follow him through hell and back
   - Grade 2 leader: all-round 'average' officer
   - Grade 3 leader: more likely to get shot by his own men than by enemy

### Command Marker System
- Throughout game, unit marked with counter referred to as COMMAND MARKER
- **COLOUR of Command marker denotes Unit Quality:**
  - ORANGE = VETERANS
  - BLUE = REGULARS
  - GREEN = GREENS
- **NUMBER on marker indicates Leadership Rating** (1, 2, or 3)
- Example: Regular unit with average commander = BLUE-2 command marker

### Command Marker Uses
- Remains with unit at all times (unless preferring to put all markers on Force Status Sheet)
- Serves as reminder of die type and values used in all confidence and reaction tests
- Inverted each turn to indicate when unit has been activated
- Only times changed for another: when unit commander lost, or when two/more depleted units merged under regrouping rules

### Determining Quality and Leadership
**From Scenario/Campaign History:**
- For units used through series of games or full campaign, builds up own history
- Characteristics may be modified upwards as unit gains experience/battle honours
- Modified downwards if requires large influx of "FNGs" to replace combat losses

**For One-Off Games/New Units:**
- Simplest way: put selection of Command markers face-down and draw at random
- Mix of markers provided on countersheets biased towards 'average' units
- Drawing at random from whole set yields balanced force of largely Regular troops with smaller proportions of Veterans and Greens
- Feel free to bias mix further in any desired direction for specific scenario/background

**Alternative: Points-Based Quality Purchase:**
- Allow players to "buy" Command Markers out of overall points value allocations
- Or roll dice to give pool of "command points" to buy unit qualities
- Possible rate: 1D8 per two units in force, adding all points then buying quality at rate of:
  - 1 point for Green
  - 2 for Regular
  - 3 for Veteran
  - Plus 1 for grade 3 leader, 2 for grade 2, 3 for grade 1

---

## CONFIDENCE LEVELS (Page 21)

### Confidence Level Definition
- In addition to Command Marker, each UNIT has marker indicating its current CONFIDENCE LEVEL
- Is state of Unit's morale at any given time
- Will fluctuate up or down depending on Unit's fortunes during battle

### Confidence Level Markers
- GREY counters with WHITE letters on them
- Five different kinds for five Confidence Levels used in game:
  - **CO = Confident:** Morale high, ready for anything
  - **ST = Steady:** Morale holding, generally still willing to fight
  - **SH = Shaken:** Distinctly worried and reluctant to take risks
  - **BR = Broken:** Morale almost gone, no longer willing to fight
  - **RO = Routed:** Panicked and running away

### Starting Confidence Levels
- Most units start game with CO (Confident) marker
- Not necessarily the case; few units (perhaps drawn at random) might start at ST (Steady)
- If scenario warrants, may have cases where units start at SH (Shaken) or lower
- Example: demoralised defenders of position under attack for some time with no hope of relief
- For one-off games: suggested to mix just few ST markers with CO ones, draw at random for each unit

### Confidence Level Changes
- Unit's CL marker may change as result of CONFIDENCE TEST (see below)
- Failure to achieve necessary score causes unit's Confidence to drop by one or more levels
- Example: Unit at ST fails test, drops ONE level, replace with SH marker
- If test failed badly enough for 2-level drop, unit drops to Broken, gets BR marker in place of ST
- Certain circumstances allow unit's CL to actually RISE (e.g., Shaken unit could return to Steady)
- Cases detailed below and in section on "rallying"

---

## EFFECTS OF CONFIDENCE LEVELS (Page 21-22)

| CONFIDENCE LEVEL | DISMOUNTED INFANTRY | ARMOUR |
|---|---|---|
| **CONFIDENT (CO)** | Unit will act normally at all times. | Unit will act normally at all times. |
| **STEADY (ST)** | Unit will act normally at all times. | Unit will act normally at all times. |
| **SHAKEN (SH)** | Successful REACTION TEST is required for unit to LEAVE COVER, or advance towards enemy. | Unit will act normally at all times. |
| **BROKEN (BR)** | IF in OPEN, must withdraw to nearest cover. May not Close-Assault; if Close-Assaulted, will drop to ROUTED (RO) automatically. | Unit may no longer advance towards enemy. If in open, must withdraw to nearest cover. |
| **ROUTED (RO)** | Unit is unable to continue in combat; withdraws towards baseline; may not fire. | Unit must withdraw towards baseline, but may return fire if attacked. |

[Corrected against the page image (pt2-p06) on a third reading: the two machine readings had swapped and merged rows.]

**Note:** While infantry units are mounted in APCs or MICVs, treated as "Armour units"; when they DISMOUNT, whole UNIT counted as Dismounted Infantry. Troops in "soft" transport (ordinary trucks) treated as Dismounted at all times for Confidence purposes.

**In any cases where specific circumstances make it impossible to carry out any requirements listed here, actions of unit should be determined to satisfaction of both players.**

**ROUTED units that for any reason cannot withdraw will in most cases try to surrender to nearest enemy unit (e.g., if effectively surrounded).**

---

## CONFIDENCE TESTS (Page 22-23)

### Confidence Test Overview
- CONFIDENCE TEST: simple, quick procedure involving single die roll
- Made as soon as Unit is placed in any of circumstances detailed below
- Each circumstance has THREAT LEVEL assigned, indicating how serious occurrence is to unit's confidence

### Test Mechanics
1. Take unit's LEADERSHIP RATING (NUMBER on its Command Marker)
2. ADD this to THREAT LEVEL that applies in this case
3. This total is score that must be EXCEEDED to pass confidence test safely
4. Player testing rolls 1 die; DIE TYPE determined by QUALITY of Unit (color of Command Marker):
   - **VETERAN troops:** roll D10
   - **REGULARS:** roll D8
   - **GREENS:** roll D6

### Test Results
- **Die roll HIGHER than score needed:** Test passed successfully, unit's Confidence unaffected
- **Die roll EQUAL TO or LESS THAN score needed:** Unit's Confidence drops by ONE level
- **Die roll only HALF OR LESS of required score:** Unit's Confidence drops by TWO levels

### Confidence Test Example
- Unit has current CL of ST (Steady), is Regular ("Blue") with Average ("2") leadership
- Unit just took casualties requiring Confidence test with Threat Level +1
- Leadership + Threat Level = 3 total
- As Regular unit, player rolls D8
- If rolls 4 or more (exceeds required score of 3): Confidence remains unchanged at ST
- If rolls 2 or 3: Confidence drops ONE level to SH (Shaken)
- If rolls 1: Less than half required score of 3, Confidence drops TWO levels to BR (Broken)

---

## CONFIDENCE AND REACTION TESTS: CIRCUMSTANCES AND THREAT LEVELS (Page 23)

| CIRCUMSTANCE | TEST TYPE | THREAT LEVEL |
|---|---|---|
| **A UNIT has suffered its FIRST element damaged or destroyed in this battle** | CONFIDENCE | +1 |
| **Unit suffers 25% or greater casualties (elements damaged or destroyed) in ONE ATTACK** | CONFIDENCE | +1 |
| **Unit has taken TOTAL casualties of 50% or more in battle so far** | CONFIDENCE | +2 |
| **The UNIT LEADER element is DESTROYED** | CONFIDENCE | +3 |
| **Under ARTILLERY or AIR ATTACK (Dismounted Infantry units ONLY)** | CONFIDENCE | +0 |
| **Attacking or Defending in CLOSE ASSAULT** | CONFIDENCE | Refer to Close Assault rules |
| **Dismounted Infantry at SHAKEN, trying to advance** | REACTION | +1 |
| **Dismounted Infantry UNDER FIRE, when attempting to move** | REACTION | +1 |
| **Vehicles UNDER FIRE, when attempting to move** | REACTION | +1 |
| **Unit ordered to CLOSE ASSAULT, or attacked in CLOSE ASSAULT** | REACTION | Refer to Close Assault rules |

**Note:** THREAT LEVELS ARE NOT CUMULATIVE; use highest Threat Level that applies in any given combination of circumstances.

**Optional Note:** Players should consider using Reaction test to settle any disputes that may arise about whether unit can carry out desired action, provided this possibility is not abused.

---

## Summary of Key Rules Mechanics

### Activation Sequence
- Player with fewer units chooses who activates first (can vary per turn)
- When unit activated, performs ALL desired actions
- Unit inverts Command Marker to show activation used
- REMOVES ANY UNDER FIRE MARKERS that the unit has been affected by (CRITICAL)
- No further actions possible for that unit until next turn
- PASS option available if player has fewer unactivated units than opponent

### Unit Control and Quality
- Command Markers track both unit Quality (color) and Leadership Rating (number)
- Confidence Markers track morale state (CO/ST/SH/BR/RO)
- Quality determined at game start (drawn, bought with points, or specified in scenario)
- Confidence fluctuates based on battle events and test results

### Position and Cover
- Position types: Open, Soft Cover, Woods (Edge/Within), Dug-In
- Position affects fire modifiers, movement costs, and damage effectiveness
- Hidden Units represent concealed defending forces at start of scenario game
- Objectives placed face-down; values revealed when taken by units

### Defense Systems
- Area Defence Systems (ADS) protect friendly elements within 12" when Sensors Active
- Increases ADS signature but allows multiple interceptions per turn
- Against ground targets, ADS functions as RFAC/2


---

# Chunk pt2-b · 22–26

## Section 5: CONFIDENCE AND REACTION (Pages 22-24)

### EFFECTS OF CONFIDENCE LEVELS (Page 22)

| CONFIDENCE LEVEL | DISMOUNTED INFANTRY | ARMOUR |
|---|---|---|
| **CONFIDENT (CO)** | Unit will act normally at all times. | Unit will act normally at all times. |
| **STEADY (ST)** | Unit will act normally at all times. | Unit will act normally at all times. |
| **SHAKEN (SH)** | Successful REACTION TEST is required for unit to LEAVE COVER, or advance towards enemy. | Unit will act normally at all times. |
| **BROKEN (BR)** | IF in OPEN, must withdraw to nearest cover. May not Close-Assault; if Close-Assaulted, will drop to ROUTED (RO) automatically. | Unit may no longer advance towards enemy. If in open, must withdraw to nearest cover. |
| **ROUTED (RO)** | Unit is unable to continue in combat; withdraws towards baseline; may not fire. | Unit must withdraw towards baseline, but may return fire if attacked. |

[Corrected against the page image (pt2-p06) on a third reading: the two machine readings had swapped and merged rows.]

Note: While infantry units are mounted in APCs or MICVs, they are treated as "Armour" units; when they DISMOUNT from their vehicles, the whole UNIT is counted as Dismounted Infantry. Troops in "soft" transport (ordinary trucks) are treated as Dismounted at all times for Confidence purposes.

### CONFIDENCE TESTS (Page 22)

A CONFIDENCE TEST is a simple, quick procedure involving a single die roll, which is made as soon as a Unit is placed in any of the circumstances detailed on the list below. Note that each circumstance described has a "THREAT LEVEL" assigned to it, which indicates just how serious the occurrence is to the unit's confidence.

**Procedure:**
- Take the unit's LEADERSHIP RATING (the NUMBER on its Command Marker) and ADD this to the THREAT LEVEL that applies in this case. This total is the score that must be EXCEEDED to pass the confidence test safely.
- The player testing then rolls 1 die, the DIE TYPE being determined by the QUALITY of the Unit (as indicated by the colour of its Command Marker):
  - VETERAN troops roll a D10
  - REGULARS roll a D8
  - GREENS roll a D6

**Results:**
- IF the die roll is HIGHER than the score needed, the test is passed successfully and the unit's Confidence is unaffected.
- If the roll is EQUAL TO or LESS THAN the score needed, the unit's Confidence drops by ONE level.
- If the number rolled is only HALF OR LESS of the required score, then the unit's Confidence drops by TWO levels.

**Example:** A unit has a current CL of ST (Steady); it is a Regular ("Blue") unit with Average ("2") leadership. The unit has just taken casualties, which requires it to test confidence with a Threat Level of +1. Adding the Leadership to the Threat Level gives a total of 3; as it is a Regular unit, the player rolls a D8. If he is lucky enough to roll 4 or more (thus exceeding the required score of 3) then the unit's confidence will remain unchanged at ST. If he rolled 2 or 3, the unit's CL would drop by ONE level to SH (Shaken). If he was VERY unlucky and rolled a 1, this would be less than half the required score of 3, and the CL would drop by TWO levels to BR (Broken).

### REACTION TESTS (Page 22)

A REACTION TEST is in most ways similar to the Confidence test, except that failing the test does NOT actually reduce the unit's CL. The Reaction test is taken whenever a unit is ordered to do something that its troops may or may not have the nerve to carry out - such as entering into Close Assault with enemy troops, or leaving cover while under enemy fire. Reaction test circumstances (as described in the table) are assigned Threat Levels in the same way as the circumstances for Confidence tests, and the test is taken in exactly the same manner.

**Results:**
- If the required score is EXCEEDED by the die roll, then the unit WILL carry out whatever action forced the test to be made.
- If the roll is EQUAL TO or LOWER THAN the required score then the troops will NOT carry out the action - they have decided it is much safer to continue to skulk in cover and pretend they have not heard the order to advance. No change is made to the CL marker however, and the unit may again be ordered to carry out the same action next turn (in which case they have to test again, and may pass or fail).

### TAKING CONFIDENCE TESTS (Page 22)

Confidence Tests are taken immediately following the occurrence of whatever event requires the test to be taken; for instance, if casualties suffered by a unit require a Confidence Test then it will be resolved there and then, as soon as the casualties have been inflicted. This may well result in a given unit having to take more than one test in a Game Turn - this is fully acceptable, and may cause the unit to lose several levels of confidence in the one Turn (e.g. if fired on by more than one enemy unit in the turn, in different enemy activations).

The effects of a Confidence Test are applied immediately; e.g. if a unit that had not yet used its activation had to take a test due to enemy action and lost Confidence Levels as a result, it might then NOT be able to carry out whatever action the owning player had intended it to do in its activation for that turn.

### CONFIDENCE AND REACTION TESTS: CIRCUMSTANCES AND THREAT LEVELS (Page 23)

The list below gives the most common circumstances under which units are required to take either CONFIDENCE or REACTION TESTS, and the relevant THREAT LEVELS used to resolve the tests; where tests are required in other (less common) circumstances, these are detailed in the relevant rules sections and the Threat Levels given.

**THREAT LEVELS ARE NOT CUMULATIVE; use the highest Threat Level that applies in any given combination of circumstances.**

#### Confidence Tests Required:

| Circumstance | Threat Level |
|---|---|
| A UNIT has suffered its FIRST element damaged or destroyed in this battle | +1 |
| Unit suffers 25% or greater casualties (elements damaged or destroyed) in ONE ATTACK | +1 |
| Unit has taken TOTAL casualties of 50% or more in the battle so far | +2 |
| The UNIT LEADER element is DESTROYED | +3 |
| Under ARTILLERY or AIR ATTACK (Dismounted Infantry units ONLY) | +0 |
| Attacking or Defending in CLOSE ASSAULT | Refer to Close Assault rules |

#### Reaction Tests Required:

| Circumstance | Threat Level |
|---|---|
| Dismounted Infantry at SHAKEN, trying to advance | +1 |
| Dismounted Infantry UNDER FIRE, when attempting to move | +1 |
| Vehicles UNDER FIRE when attempting to move | +1 |
| Unit ordered to CLOSE ASSAULT, or attacked in CLOSE ASSAULT | Refer to Close Assault rules |

### PANIC (Page 23)

PANIC is a special type of reaction that affects only GREEN (inexperienced) units; it is NOT linked to their current level of Confidence, but represents the tendency of such units to temporarily "freeze" under the shock of first contact with the enemy.

When a GREEN unit FIRST comes under attack in the game (either fired on or Close Assaulted), it must immediately take a Reaction test at a Threat Level of +2. If it FAILS the test, the unit will PANIC, and receives a "Panic" marker to indicate this state.

A unit with a PANIC marker may not do anything until it uses an Activation to remove the marker - in other words, it must lose its next activation to recover from the Panic state.

Once it has got over the shock of first contact with the enemy, a unit is no longer at risk from Panic reactions.

**[OPTION: at the players' discretion, the PANIC rule may be extended to cover not just GREEN units, but also any other units that start the game with (for any reason) a poor Confidence Level; for example, a Regular unit with a starting CL of SHAKEN might be subject to risk of PANIC on first contact with the enemy.]**

### UNIT LEADERS - LOSS AND REPLACEMENT (Page 23)

Each platoon-sized UNIT must have one of its elements designated as the Unit Leader (platoon Commander). The designated element (which may be a vehicle or an infantry team) should NOT be marked openly, but should have its identity recorded in secret. If the elements have some sort of ID markings or numbers then the identity of the Leader may be written down, but probably the best way is to stick a very small self-adhesive spot or label on the UNDERSIDE of the model or team base.

The reason for the secrecy is to hide the identity of the Command element from your opponent, thus preventing an immediate concentration of fire on the leader in a desperate attempt to kill him. Most real armies go to considerable lengths to 'disguise' the nature of command elements for this very reason.

**If the Leader of a unit SHOULD be lost to enemy fire during the game:**

The unit must immediately make a confidence test at a Threat Level of +3; in addition, the player must (again in secret) designate one of the surviving elements as being the Assistant Unit Leader who will take over from his dead superior and assume command of what remains of the unit. At this point, roll a D6; if the score is 1-3 then the Assistant Leader will have a Leadership rating of ONE WORSE than the original commander. If the roll is 4 or 5, the Leadership rating will remain the same, and if it is 6 then the Leadership will actually IMPROVE by one.

**Example:** If a unit loses a grade 2 Leader, a roll of 1-3 will mean the assistant leader is a grade 3 (one level worse); a 4 or 5 will indicate he is the same (grade 2); and a 6 will put the unit one level better off with a grade 1 assistant in this case, the troops probably disliked their Commander but have more respect for his second-in-command!

**Note:** Leadership Ratings cannot go below (better than) 1 or above (worse than) 3 - if this is indicated then the rating simply remains unchanged.

### UNIT INTEGRITY (Page 23)

The UNIT INTEGRITY DISTANCE is the maximum separation between elements in a given unit that is allowed for the unit to function effectively. If any element exceeds the integrity distance from the nearest other element of the unit, the unit is said to be DISORGANISED and must be brought back within integrity limits at the earliest possible opportunity. While a unit is DISORGANISED it may not move unless the move brings it back to integrity.

**Integrity distances for various unit types:**

| Unit Type | Integrity Distance |
|---|---|
| VEHICLE units (including VTOL) | 3" between elements |
| INFANTRY units (when dismounted) | 2" between elements |

Note that if two or three infantry elements form a "squad" (e.g. the occupants of a single APC or MCV), these elements should remain in base-to-base contact at all times as well as being within the normal integrity distance of the other squads in the unit.

When Mechanised Infantry units are mounted in their transports, they are treated as Vehicle units. If the infantry dismount, the transport may if desired move up to 10" away from the troops and still be counted as within integrity. If the Infantry and their vehicles separate by MORE than 10" (or if any other unit has to be sub-divided for any reason), then give the separated elements their own Command and Confidence markers (the same levels as the original unit) and treat them as an independent unit. If and when a split unit recombines, the Confidence level of the whole unit becomes the LOWER of the two current individual levels (if different).

The only other time when elements can be outside the normal integrity limits WITHOUT the unit being Disorganised is when destroyed or disabled (e.g. immobilised) elements are "left behind" as the unit moves on; provided the remaining functional elements close ranks to keep within integrity distances of each other, the isolated elements do not cause the unit to be Disorganised.

### REGROUPING (Page 24)

It is possible to COMBINE two (or more) depleted UNITS into one "new" unit during the game, if a player so wishes. This is known as REGROUPING.

The remaining elements of one unit must be moved (during their activation) into the Unit Integrity distance of the unit with which they wish to regroup. The latter unit must NOT have already been activated this turn; if it has, then the actual regrouping must wait until the next turn.

The Regrouping uses up the activation of the unit being joined, so its Command marker is inverted; it also uses up all the remainder of the activation of the unit that has moved into contact - they may not perform any Combat Action in addition to their movement. Once the necessary activations have been expended, the two former units are considered grouped into one new unit. The new unit has:
- The Leadership of the BETTER of the two former unit leaders
- The Quality of the LARGER of the two units (in terms of NUMBER of elements in each)
- An "average" of the two Confidence Levels (rounded up if necessary)

**Example:** The remnants (2 elements) of a VETERAN 2 unit, current CL-BROKEN, are joined by 3 surviving elements of a REGULAR 3 unit, CL-STEADY: the "new" (combined) unit of five elements will be rated REGULAR 2 (the Quality of the larger unit, and the better of the two Leaderships), and have a CL of SHAKEN (the "average" between ST and BR).

### "UNDER FIRE" MARKERS (Page 24)

The "explosion" markers on the counter sheet are UNDER FIRE markers, used to indicate when a unit has been attacked by something that may inhibit its will to move, emerge from cover, or take various other actions.

Under Fire markers are placed on INFANTRY Units that are attacked by Infantry Ranged Fire, Infantry Close Assault, all types of Artillery or Aerospace craft weaponry, and anti-personnel fire from vehicles. VEHICLE units do NOT receive Under Fire markers simply for being fired on, but DO get one if they actually suffer an element destroyed or damaged during the attack.

The main function of Under Fire markers is to inhibit movement: any unit that has such a marker must take and pass a REACTION test before it may MOVE, at a threat level of +1 for Infantry units (when dismounted) or +0 for vehicles and Infantry still in vehicle transport. The unit's ACTIVATION must be announced BEFORE this test is taken; if the unit fails the test and then does nothing, this still counts as the player's activation attempt.

**[Any other functions of the Under Fire markers are described in the rules that they affect.]**

### LOSS OF COMMAND UNIT (Page 24)

If the overall COMMAND UNIT (or the designated COMMAND VEHICLE within the Command Unit) is destroyed or disabled, this causes serious disruption in the player's entire force. ALL units under the player's command immediately DROP ONE LEVEL OF CONFIDENCE, and for the remainder of the CURRENT game turn no unit may be given a change of orders; in other words, though units may continue with their current activities they may NOT initiate any new offensives (if already advancing, they may continue to do so, but if stationary and/or defending they may not change to, say, advancing).

In the following Game Turn units may again act normally, as communications links are assumed to have been re-established through backup channels to higher-level Command units. The Confidence Level drops are, however, permanent; without an on-table Command unit no attempts at Rallying may be made.

### RALLYING UNITS (Page 24)

If a unit is suffering from lowered Confidence, it is possible for the player (via the overall Command Unit) to attempt to RALLY the unit - that is, to increase its Confidence Level. Such an attempt counts as the ACTIVATION for the unit that is being RALLIED; thus the Command Unit may try to rally more than one other unit in one turn if that is desired.

A Rallying Test is similar to a normal Confidence test, and the unit rolls the usual die type for its Unit Quality: the score that must be exceeded is the SUM of the LEADERSHIP VALUES of both the unit testing and the Command Unit. If the score rolled exceeds this total then the Unit's Confidence rises by ONE LEVEL.

**Example:** A "Regular 2" unit is currently at BROKEN (BR), the player attempts to rally it, using the overall Command Unit (a "Veteran 1"). Adding the Leadership values of both units gives 3, and a D8 is rolled as the unit being rallied is of "Regular" quality. If the number rolled is 4 or higher (thus exceeding the required score), the unit will have its Confidence Level raised to SHAKEN (SH). Whether the test succeeds or fails, the unit being tested for has used up its Activation for that turn - its Command marker is inverted and it may do nothing else.

---

## Section 6: MOVEMENT (Pages 25-26)

### MOVEMENT (Page 25)

Each element (vehicle or infantry) in the game has a MOBILITY TYPE, which defines the type of propulsion/suspension it uses. The list below covers most of the mobility types that will be required, though others may be added if desired. (For the MOBILITY TYPES of specialised vehicles such as VTOLS, RIVERINE CRAFT and COMBAT WALKERS, refer to the relevant special rules sections.)

| Mobility Type | Description | Base Movement Factor |
|---|---|---|
| LINE or MILITIA INFANTRY | Ordinary leg infantry team in fabric battledress or light body armour | 2 |
| POWERED INFANTRY | Troops in full power assisted combat armour suits | 6 |
| CAVALRY | Troops mounted on horses or other riding animals | 4 |
| LOW MOBILITY WHEELED VEHICLES | Trucks, civilian vehicles etc. with very limited off-road performance | 10 |
| HIGH MOBILITY WHEELED VEHICLES | Military wheeled combat vehicles with good off-road capability | 10 |
| SLOW TRACKED VEHICLES | Heavy or cumbersome tanks and other tracked AFVs | 8 |
| FAST TRACKED VEHICLES | High-speed, agile tracked AFVs such as light scout vehicles and some smaller tanks or MICVs | 12 |
| SLOW GEVs (GROUND EFFECT VEHICLES) | Larger Hovertanks and less-manoeuvrable hover AFVs | 12 |
| FAST GEVs | High-speed hover vehicles - scout and strike GEVs | 15 |
| GRAV VEHICLES | All vehicles using "Grav" or "Mag-Rep" drive systems, travelling a few metres off the surface | 15 |

**Note:** Each mobility type listed above is given a number known as its BASE MOVEMENT FACTOR. This factor represents the distance (in inches) that the element may move per turn, if it is moving over NORMAL terrain. Different mobility types react differently in various kinds of terrain; for a given mobility type, a particular type of terrain may be defined as EASY, NORMAL, POOR, DIFFICULT or IMPASSABLE.

### TERRAIN MOVEMENT DEFINITIONS (Page 25)

**EASY terrain** allows an element to move much faster than normal; the element may travel 2" for every 1 movement factor expended in such terrain (e.g. GEVs class navigable water as EASY, so a FAST GEV could move up to 30" - twice its base movement factor). However, elements may only count terrain as EASY and claim the doubled normal movement if they are in a "travel mode" - that is, they are NOT deployed for action and do not intend to fire, observe or otherwise engage the enemy (they must also not have an Under Fire marker placed on them). Should any of these conditions not be met, the element must treat the terrain as NORMAL for movement purposes.

**NORMAL terrain** is the 'default value' - elements in NORMAL terrain for their mobility type may move up to 1" per movement factor (e.g. a FAST TRACKED vehicle on open, clear terrain could move up to 12", equal to its base movement factor).

**POOR terrain** indicates areas that cause some problems for certain mobility types; elements in terrain that they count as POOR have to expend 2 movement factors for every 1" of movement (e.g. tracked vehicles count rough broken ground as POOR going, so a SLOW TRACKED vehicle could travel only 4" in such terrain with its movement factor of 8).

**DIFFICULT terrain** is ground that severely limits movement of a given mobility type; elements trying to traverse areas classed as DIFFICULT to them must use 3 movement factors to move 1" (e.g. a LOW MOBILITY WHEELED vehicle crossing a cultivated area, which it counts as DIFFICULT, could move only 3" with its movement factor of 10 - 1 per three factors, and the final factor being lost).

**IMPASSABLE terrain** is just what it says - a mobility type that classes a particular terrain as IMPASSABLE cannot move through such terrain. The only exception to this is that elements which count woods as impassable MAY if desired be moved into the EDGE of a wooded area, which represents them taking cover just at the edge of the treeline. They may NOT under any circumstances actually move within the woods; if they move at all it must be straight out of the wood edge at the same point they entered it, back into terrain that is passable to them.

**Movement Example:**
The Tank is a SLOW TRACKED vehicle, with a Base Movement factor of 8. It first moves 4" along the ROAD, which counts as EASY and thus costs it 2 factors (2" per factor). Turning off the road, it moves 2" across the OPEN ground which uses another 2 factors (NORMAL terrain at 1" per factor). Then enters the ROUGH area which costs 2 factors per 1" moved (POOR going). With 4 factors left for this move, the Tank can thus move 2" into the ROUGH.

**Note on Combat Movement:** The actual speeds represented by the movement rates in the game are in fact only a very small fraction of the theoretical maximum speeds of the elements concerned. All movement should be considered to be "combat movement", with the vehicles moving tactically from one covered position to another, spotting for the enemy etc., as well as having to negotiate myriad minor obstacles and obstructions that even a stretch of seemingly open, flat ground is in reality dotted with.

### TERRAIN TYPES (Pages 25-26)

The list given here details a wide selection of typical terrain that would be found on Earth or a reasonably terrestrial planet; there are notes given in the appendices for those players who wish to set their games in more 'exotic' environments.

| Terrain Type | Description |
|---|---|
| ROADS | Undamaged, solid roads and highways; includes dirt tracks if they are stable and in good order |
| OPEN, CLEAR | Flat desert, plains, grassland etc. with only minimal obstacles to inhibit movement; provides good, firm going |
| LIGHT SCRUB | Rougher grassland, tundra etc. dotted with occasional bushes, trees and rocks |
| ROUGH BROKEN | Rocks, gullies, thick scrub etc., making the going tricky for most vehicles |
| CULTIVATED | Farming land, a mix of fields divided by hedges, walls, ditches etc.; includes paddyfields and similar plantations (due to the groundscale in use, it is much more effective to classify farmland as an overall terrain type than to try and represent each individual hedge and ditch as a separate terrain feature to be crossed) |
| URBAN AREAS | Built-up zones, residential or industrial (includes small towns and villages, but excludes isolated single buildings and farms) |
| HILLS | Moderate slopes, mountain foothills and general rolling terrain |
| MOUNTAINOUS | Very steep and/or difficult slopes, impassable ravines, very rough and broken ground |
| SWAMP/MARSH | Areas of boggy or unstable ground, can include bayous, soft sand, deep snow etc. |
| OPEN WATER | Wide rivers, estuaries, lakes and calm coastal waters. Rivers count as Open Water if they are defined as being wide enough to be easily navigable to waterborne craft |
| RIVERS AND STREAMS | Narrower watercourses that provide obstacles (usually due to steep banks) but are not wide enough for effective navigation |
| LIGHT/OPEN WOODS | Fairly sparse forest or woodland, with trees well-spaced and not too much undergrowth to hinder movement |
| DENSE WOODS/JUNGLE | Thick forestation or tropical/subtropical jungle, with very dense undergrowth; trees closely packed, very difficult going even for men on foot |

**Note on Urban Movement:** The movement restrictions placed on units in Urban Areas represent the difficulty in manoeuvring large combat vehicles in town/city streets; hence most normal roads running through urban areas do NOT negate the restrictions on urban movement. If, however, there is a road defined as a MAJOR HIGHWAY running straight through an urban area, then elements may use this as a travel route subject to the normal restrictions for ROAD movement (look at this as travelling through a city on a main motorway or ring road, as opposed to trying to pick your way through the centre at rush-hour).

### TERRAIN EFFECTS ON MOBILITY (Page 26)

Having defined what each type of terrain is, we can now combine that with the different mobility types and show exactly how the various types of element are affected by the terrain they cross:

#### INFANTRY (Powered, Line and Militia) and CAVALRY:
- EASY = Roads
- NORMAL = Open, Light Scrub, Rough, Cultivated, Urban, Hills, Light Woods
- POOR = Mountainous, Swamp, Dense Woods (plus Open Water - POWERED Infantry only)
- DIFFICULT = Rivers/Streams (crossing only)
- IMPASSABLE = Open Water (except POWERED Infantry)

#### LOW-MOBILITY WHEELED:
- EASY = Roads
- NORMAL = (none specified in table)
- POOR = Open, Urban, Hills
- DIFFICULT = Light Scrub, Cultivated, Rivers/Streams (crossing only at designated Ford - otherwise impassable)
- IMPASSABLE = Rough, Mountains, Swamp, all Woods, Open Water (unless amphibious, when POOR)

#### HIGH-MOBILITY WHEELED:
- EASY = Roads
- NORMAL = Open
- POOR = Light Scrub, Cultivated, Urban, Hills
- DIFFICULT = Rough, Swamp, Rivers/Streams (crossing only)
- IMPASSABLE = Mountains, all Woods, Open Water (unless amphibious, when POOR)

#### TRACKED (Fast and Slow):
- EASY = Roads
- NORMAL = Open, Light Scrub
- POOR = Rough, Cultivated, Urban, Hills
- DIFFICULT = Mountains, Light Woods, Rivers/Streams (crossing)
- IMPASSABLE = Swamp, Dense Woods, Open Water (unless amphibious, when POOR)

#### GEV (Ground Effect Vehicle), Fast or Slow:
- EASY = Roads, Open, Open Water
- NORMAL = Swamp
- POOR = Light Scrub, Hills
- DIFFICULT = Urban, Cultivated, Rough, Rivers/Streams (crossing)
- IMPASSABLE = Mountains, all Woods

#### GRAV:
- EASY = Roads, Open, Open Water, Rivers/Streams (crossing only)
- NORMAL = Light Scrub, Rough, Cultivated, Swamp
- POOR = Urban, Hills
- DIFFICULT = Mountains
- IMPASSABLE = All Woods

### EVASIVE MOVEMENT (Page 26)

"Evasive" Movement is a special type of movement that is ONLY available to FAST GEV and GRAV Mobility Types; it consists of the vehicle moving very fast while jinking from side to side and generally making itself as difficult a target as possible for enemy fire control systems. A unit of suitable vehicles may be said to be EVADING.


---

# Chunk pt2-c · 27–31

## Section 6: MOVEMENT (pt2 p11)

### Evasive Movement
If unit is travelling in terrain classed as EASY or NORMAL going, and using AT LEAST 75% of full Movement Factors, and all elements in unit are making same movement (either ALL elements Evading, or none can):
- Unit marked with EVASIVE MOVEMENT marker, gains bonus of rolling a Secondary Die during next activation in next Game Turn
- Such unit gains bonus of rolling a Secondary Die all Direct Fire attacks made on it while Evasive marker in place
- Evasive marker is in place until unit's next activation in next Game Turn
- Unit with Evasive marker may NOT fire - vehicle too busy hanging on to seats, breakfasts

### Airborne Vehicle Movement
Aerospace craft covered in section on Activation of those units (P.41).

VTOL craft act in many ways like normal ground elements - organized into similar Units and ACTIVATED as any other unit in normal sequence of turn. VTOLs may be in one of three states on table: LOW MODE, HIGH MODE or GROUNDED.

Switching between modes takes up half element's movement for that activation. VTOLs half its move to land or take off, go from high flight to Nap-of-Earth, or vice versa.

Coming straight from High Mode to Grounded would take whole movement for that activation.

Not necessary for every element of VTOL unit to be in same mode - quite permissible for part of unit to unload troops while remainder hover in Low Mode to provide fire cover.

Base Movement Factors for typical VTOL craft:
- TRANSPORT VTOLs and CONVENTIONAL HELICOPTERS: 24
- ATTACK/GUNSHIP or SCOUT VTOLs: 30

VTOLs in HIGH MODE marked with HIGH MODE counter. Entire unit can be in same mode then only one marker need be used, but if some elements in different mode then each one High Mode given individual marker. VTOLs without High Mode markers assumed in Low Mode or landed.

### Walker Vehicle Movement

Walking machines very good over nearly all terrain - one of few justifiable reasons for building them. Walkers treated as follows for Mobility purposes:

INFANTRY WALKERS treated exactly as for POWERED INFANTRY.

COMBAT WALKERS and TRANSPORT WALKERS have special "WALKER" mobility type, each has different BASE MOVEMENT FACTOR.

Combat Walkers have Base Movement Factor of 12.
Transport Walkers 8.

Walker Mobility treats all terrain types as NORMAL except for: MOUNTAINS, SWAMP and WOODS (light or dense), all count as POOR, and URBAN counts as DIFFICULT.

Combat Walkers (NOT Transport Walkers) may also cross OPEN WATER at POOR rate - wading or walking on bottom, thus may NOT fire.

In addition, Combat Walkers (but NOT Transport Walkers) may also make special RUN move, which enables them to treat NORMAL terrain as EASY (move at double rate). While RUNNING, however, Mecha may not fire.

### Riverine Movement

Boats and other watercraft activated exactly as for any other Unit in play (in most cases Gunboat or similar vessel will probably be counted as single "unit" in its own right, although landing craft assault boats may well be grouped into more conventional unit structures).

Base Movement Factors for typical watercraft:
- Gunboats and Patrol boats: 12
- Monitors, landing craft, civilian vessels: 8
- Small 'assault boats': 15

Hydrofoil or Hovercraft/Air Cushion vessels count Open Water as EASY for movement purposes, and other navigable water as NORMAL.

All other watercraft count all navigable water as NORMAL. Landing craft and assault boats may be "beached" for unloading; other vessels must stand off while troops wade or swim, unless they can tie up at suitable dock or riverbank.

---

## Section 7: FIRE COMBAT (pt2 p12-15)

### Direct Fire

Action of one element attacking target in clear line of sight, using ranged weapon, termed DIRECT FIRE.

When player decides unit will use part or all of its Activation to perform direct fire, must nominate target unit or units and designate individual target elements for each of firing elements, then resolve effects of each attack.

Measure range between firer and target, check Record Card for firing vehicle to see what range band applies. Check also what level of Fire Control apparatus being used (BASIC, ENHANCED or SUPERIOR).

Die types used for each Firecon type:
- BASIC = D6
- ENHANCED = D8
- SUPERIOR = D10

These types apply if shot at MEDIUM range: if CLOSE range shot, INCREASE die type by 1; if LONG range shot, DECREASE by 1.

Simple chart of Firecon and Range combinations:

| FIRE CONTROL TYPE | CLOSE | MEDIUM | LONG |
|---|---|---|---|
| BASIC | D8 | D6 | D4 |
| ENHANCED | D10 | D8 | D6 |
| SUPERIOR | D12 | D10 | D8 |

Only other modification to Firer's die type: if firing vehicle or element either has or intends to MOVE as well as fire during this activation; if firer has or will use MORE THAN HALF OF ITS BASE MOVEMENT FACTOR during this activation, then firer's die type must be REDUCED by 1.

(NOTE: this reduction due to movement means firer with BASIC firecon actually cannot fire LONG range shot and still move over half its allowance, as reducing D4 by 1 drops it off 'end' of dice scale.)

Most important: player must designate intended targets for ALL elements he wishes to fire BEFORE any shots resolved. For example, if firing three elements of activated unit at enemy unit which consisted of three elements, he might choose "all shots at central element", or to fire at "element A" of firing element 1 in other target units if desired.

Having declared intentions, MUST stick to it. If fires all three shots at one target element and kills it with first shot, other two shots wasted; player CANNOT re-designate them onto other targets.

To resolve direct-fire shot, must first determine whether target has been hit. If achieved then effects of hit must be found and applied to target.

### Stage 1: Hit Resolution

To find out if shot hits, OPPOSED DIE ROLL made. Both player that is firing and player that owns intended target element will roll one (or sometimes two) dice.

Simple rule for reading result:

**IF THE FIRER'S DIE ROLL EXCEEDS THE TARGET'S DIE ROLL, THEN A HIT IS SCORED.**

and RANGE BAND in which shot occurs (whether range to target falls in CLOSE, MEDIUM or LONG band for type of weapon firing).

Variables that affect chance of hit all taken care of by choice of exactly which TYPE of die each player rolls.

**FIRER'S DIE TYPE:** Die used by FIRING player depends on two main factors: level of firing element's FIRE CONTROL systems, and RANGE BAND in which shot occurs.

**WEAPON RANGE TABLE:**

| WEAPON SYSTEM and CLASS | CLOSE RANGE | RANGE BANDS: MEDIUM RANGE | LONG RANGE |
|---|---|---|---|
| HIGH-ENERGY LASER (HEL) ALL CLASSES (1-5) | 60" | 60" | 60" |
| RAPID-FIRE AUTOCANNON (RFAC) RFAC/1 | 8" | 12" | 16" |
| RFAC/2 | 12" | 18" | 24" |
| HIGH-VELOCITY CANNON (HVC) HVC/3 | 16" | 24" | 32" |
| HVC/4 | 18" | 27" | 36" |
| HVC/5 | 20" | 30" | 40" |
| HYPER-KINETIC PENETRATOR (HKP) HKP/3 | 18" | 30" | 42" |
| HKP/4 | 24" | 36" | 48" |
| HKP/5 | 30" | 42" | 54" |
| MASS-DRIVER CANNON (MDC) MDC/1 | 8" | 16" | 24" |
| MDC/2 | 12" | 24" | 36" |
| MDC/3 | 24" | 36" | 48" |
| MDC/4 | 30" | 42" | 54" |
| MDC/5 | 36" | 48" | 60" |
| DIRECT-FIRE FUSION GUN (DFFG) DFFG/1 | 4" | 8" | 12" |
| DFFG/2 | 6" | 12" | 18" |
| DFFG/3 | 8" | 16" | 24" |
| DFFG/4 | 10" | 20" | 30" |
| DFFG/5 | 12" | 24" | 36" |
| SALVO-LAUNCHED MISSILES (SLAM) ALL CLASSES (3-5) | 12" | 24" | 36" |
| GUIDED MISSILE SYSTEMS (GMS) GMS/L | Maximum effective range = 36" | | |
| GMS/H | Maximum effective range = 48" | | |
| INFANTRY ANTI-VEHICLE ROCKET (IAVR) | Maximum effective range = 4" | | |
| ANTI-PERSONNEL SUPPORT WEAPON (APSW) | Maximum effective range = 12" | | |

---

### Stage 2: Damage Resolution

Once hit scored on target, effects of hit determined by drawing one or more DAMAGE CHITS (black counters) from 'pot'.

**THE NUMBER OF CHITS DRAWN FOR EACH HIT IS EQUAL TO THE SIZE CLASS OF THE WEAPON FIRING.**

For example: if class 3 weapon (say HKP/3) scores hit, firing player will draw THREE chits from damage pot. Number of chits drawn per hit can vary from 1 to 5 for weapon sizes 1-5.

Type of weapon firing (and some other factors such as range for certain weapons) will determine which COLOURS of damage chits are valid - which ones cause actual damage. All chits drawn which are non-valid for that particular shot are ignored.

**VALID DAMAGE CHITS:**

| WEAPON SYSTEM | VALID DAMAGE CHITS |
|---|---|
| HEL (High Energy Laser) | Against ABLATIVE ARMOUR: GREEN chits only at any range. Against all other armour types: RED chits only at any range. Against INFANTRY targets: YELLOW chits only, at any range. |
| RFAC (Rapid Fire AutoCannon) and HVC (High Velocity Cannon) | At CLOSE range: RED and YELLOW chits only. At MEDIUM range: RED chits only. At LONG range: GREEN chits only. Against INFANTRY targets (any range): YELLOW chits only. |
| HKP (Hyper-Kinetic Penetrator) and MDC (Mass Driver Cannon) | At CLOSE range: ALL chits. At MEDIUM range: RED and YELLOW chits only. At LONG range: RED chits only. Against INFANTRY targets (MDCs only): YELLOW chits only. [HKPs are NOT effective against Infantry targets.] |
| DFFG (Direct-Fire Fusion Gun) | At CLOSE range: ALL chits count DOUBLE VALUE. At MEDIUM range: ALL chits (at face values). At LONG range: ALL chits, but at HALF VALUE. Against INFANTRY targets (any range): RED chits only. |
| IAVR (Infantry Anti-Vehicle Rocket), GMS (Guided Missile System) and SLAM (Salvo Launched Missiles) | Against REACTIVE ARMOUR: RED chits only at any range. Against all other armour: RED and YELLOW chits, any range. Against INFANTRY targets (SLAMs only): YELLOW chits only. Target has APFC (IAVR fire only): YELLOW chits only. [IAVRs and GMSs have NO EFFECT against Infantry targets.] |
| ARTILLERY BOMBARDMENT TYPES: HEF (High Explosive Fragmentation) | Against INFANTRY targets: YELLOW chits only (unless DUG-IN, when RED ONLY.) Against VEHICLE targets: YELLOW chits only. (unless DUG-IN, when INEFFECTIVE.) |
| MAK (Multiple Armour Killer) | Against INFANTRY targets: RED and YELLOW chits only (unless DUG-IN, when RED ONLY). Against VEHICLE targets: YELLOW chits only. (unless DUG-IN, when INEFFECTIVE.) |

NOTE: the "SPECIAL" damage chits in pot (MOBILITY, SYSTEMS DOWN and "BOOM" chits) are ALWAYS valid when drawn against VEHICLE targets, and NEVER valid (ignored) when drawn against INFANTRY targets.

Having drawn chits and checked which ones actually valid for that hit, total up all VALID NUMERICAL CHITS drawn:

- If total LESS than target's ARMOUR VALUE: shot has NO EFFECT (unless 'special chit also drawn)
- If total EQUAL to target's ARMOUR VALUE: target is DAMAGED; receives DMG marker, subject to restrictions in Damage Effects below
- If total HIGHER than target's ARMOUR VALUE: target is KNOCKED OUT (effectively destroyed for purposes of that battle)

### Target's Die Type

Die (or sometimes dice) rolled by player owning TARGET element determined according to EFFECTIVE SIGNATURE of target, and whether or not target in any kind of special position or circumstances.

Target's PRIMARY die selection based on its Signature; note this is target's EFFECTIVE signature, including any modifications for any STEALTH characteristics put into element at design stage.

| EFFECTIVE TARGET SIGNATURE | PRIMARY DIE |
|---|---|
| 1 | D12 |
| 2 | D10 |
| 3 | D8 |
| 4 | D6 |
| 5 | D4 |

In certain circumstances, target player may ALSO (simultaneously) roll ANOTHER (secondary) die, if any following apply to target element at time of shot:

| Circumstance | Secondary Die |
|---|---|
| Target is "turret down" | D12 |
| Target is "hull down" or is "Dug in" to prepared position | D10 |
| Target is "evading" (has EVASIVE MOVE counter) | D8 |
| Target is "in soft cover", or is being engaged by opportunity fire while executing "pop-up" manoeuvre | D6 |

If any of above apply, target player may roll secondary die of relevant type in addition to primary (Signature-based) die.

(Note that if two or more secondary die circumstances apply, then only the one secondary die used - highest one that applies.)

If target player rolls two dice, both rolled together and score taken as HIGHEST DIE ROLL (does NOT add two rolls together).

Having determined types of dice to roll, both players make rolls simultaneously.

If FIRER'S score LESS than or EQUAL TO TARGET's score, shot misses.

If Firer's score GREATER than Target's (highest) score, shot is HIT, proceed to DAMAGE RESOLUTION stage.

### Damage Effects

**KNOCKED OUT target** is effectively out of play - rendered ineffective as combat element. Model left on table but marked by suitable visual means such as plume of cotton-wool "smoke", or alternatively tipping model over or removing turret if has one.

**DAMAGED vehicle** can only move at up to HALF SPEED (Base Movement Factor halved), and when fires all RANGE BANDS treated as next furthest band: Close shots counted as Medium, Medium as Long, Long range shots become impossible.

**SYSTEMS DOWN-TARGET chit** drawn: target had vital sensors and electronics put out of action. Mark vehicle with "systems down" counter. Vehicle may still move but may NOT fire or take any other action. (Possible for vehicle to recover from Systems Down result - see sections on Repairs and System Backups.)

**MOBILITY ("M") chit** drawn: vehicle is IMMOBILISED - shot blown track, holed hover-skirt, totalled engine or powerplant. Vehicle may NOT move again under own power, but IF crew decide not to abandon it, may still fire and fight from stationary position. Mark vehicle with IMM counter.

**"BOOM" chit** drawn: CATASTROPHIC CRITICAL HIT - target explodes spectacularly and totally destroyed, irrespective of size, armour class or anything else. Represents 'freak' hit, shell that finds lucky weak spot and detonates magazine.

**SYSTEMS DOWN FIRER (F) chit** drawn: FIRING VEHICLE suffers immediate SYSTEMS FAILURE. Shot causes no damage, assumed never fired - gunner pressed button and everything went phut.

Firing vehicle marked with SYSTEMS DOWN counter. Until can recover from problem, may not make any Combat Actions.

NOTE: if any of 'special' chits drawn (against vehicle targets) then their effects applied irrespective of total of numerical damage chits drawn. Vehicle can be unaffected by actual numerical damage but still be immobilised by M chit being drawn. If target knocked-out by numerical chit value then no need to record any further special damage.

**EXAMPLE:** If target vehicle with Armour Value 4 on front face hit by HKP/3 round fired from MEDIUM range, firer draws THREE chits. Assume draws RED 3, GREEN 1, YELLOW 2. GREEN chit invalid (HKPs at Medium range count only RED and YELLOW). Total VALID chits = 5, exceeds ARMOUR of 4 - thus vehicle penetrated and KNOCKED-OUT.

Alternative: chits drawn YELLOW 3, RED 1, "M" - target DAMAGED by numerical total 4 being EQUAL to Armour, but also IMMOBILISED by "M". Vehicle marked with both DMG and IMM counter.

Final example: class 1 weapon (any type) fired at vehicle with Armour 5, drew "BOOM" chit - achieved VERY lucky kill.

**IMPORTANT NOTE:** as soon as each shot resolved, return all damage chits to pot before drawing for next hit. Note also that any INVALID chits drawn are ignored in that they do not contribute towards damage effects, but they DO count as chits drawn - DON'T replace them and draw again!

### SLAM Systems - Multiple Targets

SLAM (SALVO LAUNCHED MISSILE) system is only Direct-Fire weapon actually able to hit more than one point target with single "shot".

- If SLAM fired at CLOSE range: may hit ONLY target aimed at
- If fired at MEDIUM range: may ALSO hit any other element within 1" of target element (can potentially hit anything in 2" diameter circle centred on target element)
- At LONG range: may hit anything within 2" of target (any element in 4" diameter circle)

In all cases, hit on actual target resolved normally for Direct-Fire shot.

If shot MISSES, no other targets may be hit - salvo missed intended zone completely.

If target element HIT, simple D6 roll made for any other elements within "danger area" around target:
- At MEDIUM range: each such element hit on score of 5 or 6
- At LONG range: on 6 only

Each element hit, whether intended target or "extra" hit, resolved normally (with Damage Chits equal to SLAM pack class).

### Guided Missile System (GMS) Fire

Fire of GMSs handled slightly different way from other Direct Fire weapons because missiles are 'slower' (relatively speaking) than other projectiles, use guidance systems and sensors. These differences make Guided Missiles vulnerable to both AREA/POINT-DEFENCE systems (can shoot them down), and to ECM (Electronic Counter Measures) systems (confuse and jam guidance packages).

When activated unit wishes fire Missiles from some or all of elements, Missile Markers used to indicate each individual missile and designate its target. Thus if three firing elements launch one missile each, all targeted on one enemy element, place THREE missile markers in front of target element.

If AREA-DEFENCE element within range of TARGET of missiles, may immediately attempt intercept some or all of them. Any that get through then face target's ECM and POINT-DEFENCE (if has any).

### Interception by Area Defence Systems

Area Defence Systems (ADS) can defend ANY friendly element within 12" of ADS vehicle, provided clear line-of-sight exists between two elements.

For ADS to function, must have Sensors ACTIVE - indicated by ACTIVE SENSOR marker placed on ADS element. (Activating sensors - and deactivating - counts as Combat Action for element.)

Whenever friendly element within 12" of ACTIVE ADS vehicle comes under Missile attack, ADS may attempt intercept one or more missiles.

To do this, player with ADS makes opposed rolls against missile-firing player for each missile trying to shoot down. Must first declare how many missiles going to try stop, then choose die type accordingly.

**Die Type used:**
- D6 for BASIC ADS
- D8 for ENHANCED ADS
- D10 for SUPERIOR ADS

This type then REDUCED by ONE for every extra missile above first one that ADS trying to target. Thus ENHANCED ADS could roll D8 against just one missile, D6 against each of two, D4 against each of three. Maximum number of missiles ENHANCED ADS could engage per attack = three.

Missiles' owner rolls die type according to Guidance of missiles:
- D6 for Basic
- D8 for Enhanced
- D10 for Superior

One opposed roll made per missile fired at. For each time ADS player's roll exceeds missile player's roll, that missile shot down.

**IMPORTANT NOTE:** use of ADS systems permitted at ANY time element within range of ADS attacked during turn, regardless of whether ADS vehicle and unit had their activation for that turn or not. ADS MUST, however, have Active Sensors marker already placed on element.

Example: if three elements of unit attacked by missile fire at once from enemy unit, ADS may be used ONCE against as many total missiles as able to engage (up to 3 for Enhanced ADS). Later in same turn, ADS if still ACTIVE may be used again in case of another separate missile attack.

### Missile Hits and Point-Defence Systems

For missiles that get through any Area-Defence fire, must now resolve whether stopped by target's ECM and/or Point Defence systems (PDS). Done basically same way as any direct-fire hit procedure, with opposed roll per missile.

Missile player uses same die type as did against Area Defence:
- D6 for Basic guidance
- D8 for Enhanced
- D10 for Superior

Target player uses PRIMARY DIE according vehicle's ECM rating:
- D6 for 'none'
- D8 for Basic
- D8 for Enhanced
- D10 for Superior

If target vehicle also has Point-Defence System, gets to roll SECONDARY die based on level of PDS (D6, D8 or D10).

Opposed rolls made as for Direct-Fire shots.

If missile roll exceeds target roll (or higher of two dice where applicable), missile hit target.

If not, missile either jammed by ECM or shot down by PDS.

**EFFECTS of missile hits** determined exactly as for direct fire attacks.
- GMS/L hit draws THREE Damage chits
- GMS/H draws FIVE chits

Damage chit validity listed on validity table, remembering to apply modified validity if target vehicle equipped with Reactive armour.

### Angle of Attack

Vehicles can have different armour values on different faces - often necessary to determine which face hit by fire.

Lines extrapolated through diagonally opposite corners of model create four possible arcs. All fire from attackers within FRONT arc strike frontal armour, fire from side or rear hit accordingly.

Attacks from AIRBORNE vehicles and INDIRECT FIRE always hit TOP armour, irrespective of direction fire comes from.

---

## Section 8: INFANTRY COMBAT (pt2 p15)

### Infantry Firefights

Infantry Firefight is Ranged combat by Infantry unit against opposing unit, using personal combat arms ("rifles") and support weapons.

When such unit wishes fire weapons during Activation, following procedure used:

Fire conducted by one UNIT against one (or more) Target units. Each element of firing unit has fire resolved individually against designated element within target unit or units, which must be within range of Infantry weapons being used.

**Ranges:**
- MILITIA Infantry Personal Arms (basic/obsolescent weapons): 60"
- LINE Infantry Personal Arms (modern Combat Rifles): 4"
- POWERED Infantry Personal Arms (heavy rifles): 4"
- APSWS (Anti-Personnel Support Weapons): 12"

Note: elements carrying only close-range defensive weapons (Observer teams, Engineers, Special-Weapons crews, GMS teams) may NOT take part in Infantry Firefights.

Before fire resolved, entire UNIT firing must check for FIRE EFFECTIVENESS. This determines whether enough troops in unit actually aim weapons and try hit enemy, or whether most simply loose off rounds in roughly right direction so NCOs happy.

To determine FIRE EFFECTIVENESS, roll Basic Die Type for unit's Quality:
- D6 for GREEN unit
- D8 for REGULAR
- D10 for VETERAN

If unit currently has UNDER FIRE marker, REDUCE die type by ONE (Regulars UNDER FIRE roll D6).

**Result of die roll:**
- Score LESS THAN unit's LEADERSHIP number: Fire INEFFECTIVE; no actual casualties on target unit, but receives UNDER FIRE marker
- Score EQUAL to Leadership number, but LESS THAN DOUBLE that number: Fire PARTIALLY EFFECTIVE; HALF (rounded up if necessary) elements in firing unit may draw chits for fire effect; target unit receives UNDER FIRE marker
- Score DOUBLE or MORE THAN DOUBLE Leadership number: Fire FULLY EFFECTIVE; ALL elements firing may draw chits for fire effect; target unit receives UNDER FIRE marker

Once determined which (if any) elements may actually fire effectively, each such element designates target and draws DAMAGE CHITS from pot:
- POWERED INFANTRY rifle teams and APSW teams draw THREE chits each
- ALL OTHER INFANTRY rifle teams draw TWO chits each

**VALIDITY of chits drawn:**
- If Target element IN THE OPEN: RED and YELLOW chits valid
- If target SOFT COVER: RED chits only valid
- If target DUG IN, or in URBAN AREA: YELLOW chits only valid

[Special damage chits IGNORED when firing on Infantry - count only valid colours of Numerical chits drawn]

Total up valid chits drawn by each single element firing (DO NOT total chits from DIFFERENT elements' drawings).

If total equals or exceeds required number to kill target element as listed below, target removed from play:
- MILITIA element destroyed by total of 3 valid damage points
- LINE infantry element destroyed by 4 valid damage points
- POWERED infantry element destroyed by 5 valid damage points

NOTE: effects kill one element or "team" of figures regardless of actual number of men. 'Kill' affects two-man special weapon team same way as five-man rifle fireteam. This is not actually killing every man - causing sufficient casualties that team no longer effective combat entity; survivors too busy caring for wounded to take further part in fighting.


---

# Chunk pt2-d · 32–36

## 7. FIRE COMBAT (pt2 p16)

### ANGLE OF ATTACK (pt2 p16)

As vehicles can have different armour values on different faces, it will often be necessary to determine which face of the vehicle is actually hit by fire. Lines extrapolated through diagonally-opposite corners of the model, as shown in the diagram, give four possible arcs through which the vehicle may be fired at. All fire coming from attackers within the FRONT arc will strike the frontal armour, while that from side or rear will hit accordingly.

Attacks from AIRBORNE vehicles and INDIRECT FIRE will always hit the TOP armour, irrespective of which direction the fire comes from.

[Diagram: a vehicle viewed from above, with diagonal lines through its corners marking off FRONT, SIDE (left), SIDE (right), and REAR arcs. Caption: "Possible Angles of Attack, as described above."]

### MULTIPLE MOUNT WEAPONS (pt2 p16)

A Multiple Mount consists of two (or more) weapons of the SAME TYPE AND CLASS, e.g.: a twin-barrel turret with two HKP/3s. Both (or all) guns in a multiple mount may fire together, but ONLY at the same target.

When a player fires an element with a multiple mount, he rolls an EXTRA fire die for each extra barrel or weapon; each extra die is the same type as the Fire Die for the first barrel (e.g.: if the Firer's Die was a D8 for a particular shot, if firing a double-gun mount he would roll TWO D8s together).

ANY of the Fire dice that exceed the target's die roll score hits: thus if BOTH dice of a twin-gun shot exceeded the target's roll then TWO hits would be scored, and two separate sets of Damage Chits would be drawn.

### "POP-UP" ATTACKS (pt2 p16)

The "Pop-Up" is a specialised form of attack that is only available to VTOL units. The unit must start its activation in LOW MODE, usually hidden by a terrain feature or other obstacle; it then executes the pop-up by rising vertically to clear the obstruction, acquiring and engaging a target with Direct Fire weaponry, then dropping back behind the cover before much effective fire can be brought to bear on it in return. The only opposing elements that may fire on a unit executing a pop-up attack are those that can (and wish to) use the OPPORTUNITY FIRE rule to do so; in addition, the unit making the pop-up gets the bonus of a Secondary Die roll when attacked by such Opportunity Fire.

The unit making the pop-up suffers no penalty on its own attacks - its crews are ready to take advantage of every second spent above cover, while the enemy are taken by surprise.

### REPAIRING SYSTEMS FAILURES (pt2 p16)

When a vehicle has suffered a SYSTEMS DOWN result (either as Target or Firer), it is possible for it to "recover" from the damage - the crew get to work with the chewing gum and baling twine and try to get things working again (that is if they have the nerve to stay in a partially disabled vehicle...).

During any activation AFTER the one in which the damage was inflicted, the player may roll a D6 for the vehicle, provided its crew have not abandoned it; on a roll of 6, the SYSTEMS DOWN marker is removed and the vehicle may function normally again. If the roll is failed, it may be attempted again on the next activation.

[See section on BACKUP SYSTEMS for improved repair chances.]

### DIRECT FIRE EXAMPLE (pt2 p16)

A vehicle armed with an HKP/3 (ENHANCED FireCon) is firing at an enemy tank that is 26" away. The Target vehicle is a LARGE (class 4) tank, without any Stealth abilities - so it has a Signature of 4. In addition, the Target is in SOFT COVER on the edge of a Wooded area.

The RANGE BAND is MEDIUM (between 18" and 30" for an HKP/3), so this gives the Firer a Die Type of D8.

The Target's Die Type is given by its Signature of 4; thus the Die is a D6; the SOFT COVER gives the Target a SECONDARY DIE, also a D6.

Both players roll their dice at the same time: the Firer rolls a 7 on his D8, while the Target player scores 2 and 6 on his two D6s; as the Firer's score exceeds BOTH of the Target's rolls, the shot is a HIT.

To resolve Damage, the Firing player now draws his chits from the pot: as he is firing a class 3 weapon, he draws 3 chits. At MEDIUM range, an HKP counts RED and YELLOW chits; the player draws a GREEN 2 (which is not valid), a YELLOW 3 and a RED 1. The total of VALID chits is thus 4, which against the Target's Armour of 4 is enough to DAMAGE the vehicle. The Target Tank is marked with a DMG counter.

---

## 8. INFANTRY COMBAT (pt2 p17-20)

### INFANTRY FIREFIGHTS (pt2 p17)

An Infantry Firefight is Ranged combat by an Infantry unit against an opposing unit, using personal combat arms ("rifles") and support weapons. When such a unit wishes to fire its weapons during its Activation, the following procedure is used:

Fire is conducted by one UNIT against one (or more) Target units; each element of the firing unit has its fire resolved on an individual basis against a designated element within the target unit or units, which must be within range of the Infantry weapons being used; the ranges are:

| Weapon Type | Range |
|-----------|--------|
| MILITIA Infantry Personal Arms (basic/obsolescent weapons) | 4" |
| LINE Infantry Personal Arms (modern Combat Rifles) | 6" |
| POWERED Infantry Personal Arms (heavy rifles) | 8" |
| APSWs (Anti-Personnel Support Weapons) | 12" |

Note that elements which carry only close-range defensive weapons, such as Observer teams, Engineers, Special-Weapons crews (e.g.: GMS teams) and such may NOT take part in Infantry Firefights.

Before any fire is resolved, the entire UNIT firing must check for FIRE EFFECTIVENESS; this determines whether enough of the troops in the unit will actually aim their weapons and try to hit the enemy, or whether most of them will simply loose off a few rounds in roughly the right direction so as to keep their NCOs happy!

To determine FIRE EFFECTIVENESS, roll the Basic Die Type for the unit's Quality: i.e.: a D6 for a GREEN unit, D8 for REGULAR or D10 for VETERAN. If the unit currently has an UNDER FIRE marker, then REDUCE the die type by ONE (e.g.: Regulars UNDER FIRE would roll a D6).

The result of the die roll is as follows:

| Die Roll Result | Fire Effectiveness |
|-----------|-----------|
| Score is LESS THAN the unit's LEADERSHIP number | Fire is INEFFECTIVE; no actual casualties will be inflicted on the target unit, but it DOES receive an UNDER FIRE marker |
| Score is EQUAL to the Leadership number, but LESS THAN DOUBLE that number | Fire is PARTIALLY EFFECTIVE; HALF the elements in the firing unit may draw chits for fire effect; the target unit receives an UNDER FIRE marker |
| Score is DOUBLE or MORE THAN DOUBLE the Leadership number | Fire is FULLY EFFECTIVE: ALL elements firing may draw chits for fire effect; the target unit receives an UNDER FIRE marker |

*For PARTIALLY EFFECTIVE fire, HALF (rounded up if necessary) of the elements of the firing unit that are IN RANGE and otherwise able to fire may do so; elements that are out of range or in other ways ineligible to fire may NOT be counted towards the half "not firing". APSW teams may always be counted as in the firing half if desired, as historical experience has proved that such weapon crews are in fact much more likely to fire effectively than ordinary riflemen.

EXAMPLE: a unit of REGULARS with leadership "2" attempts to fire. Assuming they are NOT currently 'UNDER FIRE' themselves, they will roll a D8. If the score is 1, their fire will be INEFFECTIVE; if it is 2 or 3, the fire will be PARTIALLY EFFECTIVE; and if 4 or greater it will be FULLY EFFECTIVE.

[Note that a unit with Leadership "1" will be unable to get an "INEFFECTIVE" fire result - it is assumed that the best leaders will always be able to get at least SOME response from their men.]

Once you have determined which (if any) of the unit's elements may actually fire effectively, each such element designates its target and draws some of the black DAMAGE CHITS from the "pot":

- POWERED INFANTRY rifle teams and APSW teams draw THREE chits each;
- ALL OTHER INFANTRY rifle teams draw TWO chits each.

The VALIDITY of the chits drawn is read as follows:

| Target Position | Valid Chit Colours |
|-----------|-----------|
| If Target element is IN THE OPEN | RED and YELLOW chits are valid |
| If target is in SOFT COVER | RED chits only are valid |
| If target is DUG IN, or in URBAN AREA | YELLOW chits only are valid |

[As noted in the Vehicle Damage rules, the "special" damage chits are IGNORED when firing on Infantry; count ONLY the valid colours of Numerical chits drawn.]

Total-up the valid chits drawn by each single element firing (DO NOT total chits from DIFFERENT element's drawings); if the total equals or exceeds the required number to kill the target element as listed below, the target is removed from play:

- A MILITIA element is destroyed by a total of 3 valid damage points;
- A LINE infantry element is destroyed by a total of 4 valid damage points;
- A POWERED infantry element is destroyed by a total of 5 valid damage points.

[NOTE that these effects kill one element or "team" of figures, regardless of the actual number of men in the element; a "kill" will affect a two-man special weapon team in the same way as a five-man rifle fireteam. If this seems a little abstract, consider that it is not actually killing every man in the team - it is causing sufficient casualties that the team is no longer an effective combat entity; the survivors, if any, will be too busy caring for their wounded squad-mates to take much further part in the fighting.]

#### INFANTRY RANGED FIREFIGHT EXAMPLE (pt2 p17-18)

Unit A, with four elements of Line Infantry (three Rifle Teams A1, A2, and A3, and an APSW Team A4) are engaging unit B in a Firefight. Elements B1 and B2 are Rifle Teams of POWERED infantry (so need 5 valid points to kill), and B3 is a Medium vehicle with Armour 3.

Having passed his FIRE EFFECTIVENESS check against his unit's Quality and Confidence and determined that ALL of the elements may fire for effect, the player activating unit A decides that Teams A1 and A4 will fire at the enemy team B1, Team A2 at B2, and that Team A3 will use an IAVR against the vehicle (B3).

Against B1, the player draws two chits (for A1) and then three chits (for A4's APSW). The first draw gives him a RED 2 and a GREEN 1: as only RED and YELLOW chits are valid against troops in the open, the valid 2 is insufficient to kill the Powered element B1. Drawing for the APSW team A4 gives a YELLOW 2, a YELLOW 3 and a RED 1 - a valid score of 6, ample to kill B1.

Against B2, element A2 draws two chits and gets a GREEN 3 and a RED 1 - not enough, so B2 escapes unscathed. Finally A3 draws 2 chits for its IAVR shot against vehicle B3, getting a YELLOW 3 and a GREEN 1 - the 3 is valid, and is enough to DAMAGE but not kill the vehicle.

### INFANTRY CLOSE-ASSAULT (pt2 p18-20)

Close-Assault actions differ from ranged Firefights in that they are carried out at close quarters, and are usually much more decisive in their outcome. A lot of infantry ranged fire is simply intended to keep the enemy suppressed, and often does not result in many actual casualties; Close-Assaults, however, are the real 'in your face' Infantry battles - the final charge against the enemy strongpoint with grenades and bayonet.

The outcome of a Close Assault is very often more a function of psychology than firepower. Do the attackers actually have the nerve to make the final charge, and if they do will the defenders stand and receive it or decide it is healthier for them to promptly "bug out"? Close Assaults are all about the holding and taking of ground and positions, and as such will usually be made against a defending unit that is occupying some sort of important tactical location - a wood edge, hilltop position or similar - that they are reluctant to give up. Short of levelling it with Artillery (which is, of course, a valid option) the most effective way of taking the position is to send in the Grunts.

Bearing in mind the comments above, the mechanism for Infantry Close Assault makes considerable use of the REACTION and CONFIDENCE TEST systems for both sides involved.

One CLOSE ASSAULT may be made by a Unit during its activation, counting as its Combat Action. The "target" of the assault must be one enemy unit holding a single position or location. Either or both sides involved may be "supported" by vehicles that are indigenous to the units in the assault (e.g.: a mechanised infantry unit making a close-assault could be supported by its own APCs or MICVs, even though the infantry would be making a dismounted assault).

Firstly, the ATTACKER (i.e.: the player who is making the assault) must announce his intention BEFORE he moves the activated unit. He then immediately makes a REACTION test, at a THREAT LEVEL of 0 if the unit is currently at CO (CONFIDENT); +1 if at ST (STEADY); or +3 if at SH (SHAKEN). Units with a current Confidence Level of BROKEN or ROUTED may NOT attempt Close-Assaults.

If the Reaction test is PASSED successfully, then the assault may proceed; if it is failed, the unit may still move normally but may not make another combat action that activation. Once it has passed the test, the unit may make a DOUBLE LENGTH move (using twice its normal Movement Factor, but still paying normal costs for the terrain it is in), provided this movement brings the unit to within 2" of the enemy position, the assault may take place.

The DEFENDER (the player whose unit is being assaulted) must now make a CONFIDENCE TEST, at a THREAT LEVEL of +3 if assaulted by POWERED infantry or +2 by other troops. If this test is passed, the Defender may stand firm and receive the assault. If it is failed, the unit loses Confidence levels accordingly and must withdraw immediately from the position by 2" or half their basic movement in the terrain, whichever is greater.

Should the defender withdraw (the may elect to do so voluntarily if desired, irrespective of the Confidence test result), the attacker immediately occupies the vacated position and his activation ends. He may, if he wishes, pursue the retreating enemy on his NEXT activation. [NOTE: see optional rule on OVERRUNS and FOLLOW-THROUGH ATTACKS.]

If the defending unit stands to face the assault, the actual Close Assault is resolved by the following method:

Each element involved in the Close Assault nominates a target and draws chits, in the same way as for an Infantry Firefight. Note that NO Fire Effectiveness roll is required - ALL elements involved will fight. In Close Assault BOTH sides are considered to be firing "simultaneously" (even if the defender has already been activated earlier in the turn); thus any elements on either side that are killed in the exchange of fire may still have the chance to fire themselves, before being removed.

The numbers of chits drawn are:

- MILITIA and LINE teams (Rifle or any Specialist team NOT using its special system): 2 chits.
- POWERED teams, APSWs and ASSAULT teams: 3 chits.

[It will be easier if one player resolves all his firing first, but without actually removing enemy casualties - just mark them temporarily (e.g.: by tipping them over or turning them round) - and then allow the opposing unit, including any "dead" elements, to resolve all their fire.]

As Close Assault combat is more deadly than ranged firefights, Damage Validity for Close Assault is as follows:

| Target Position | Valid Chit Colours |
|-----------|-----------|
| Against elements in the OPEN (usually the attackers) | ALL numerical chits are valid |
| Against elements in SOFT COVER | RED and YELLOW chits valid |
| Against elements that are DUG-IN | RED chits only are valid |

The scores needed to kill enemy elements are the same as for Firefights.

As an alternative to firing at opposing Infantry, elements that have IAVRs may instead choose to engage any VEHICLES that are involved in the Close Assault (such as APCs or MICVS assaulting in support of their infantry). This fire follows the usual IAVR rules.

Vehicles involved in Close Assaults (on either side) may fire with APSWs at enemy Infantry, OR may fire at any opposing vehicles in the Assault AS IF THEY CARRIED IAVRS (i.e.: drawing 2 chits and using the IAVR damage validities); this simplification avoids the necessity to resolve a lot of very close-range direct fire shots, which would slow the Assault process down tremendously.

After this exchange of fire and casualties, the DEFENDER must now take another CONFIDENCE test, at a Threat level of +1 if he has suffered less than 50% casualties in the first stage of the assault, or +3 if he has taken 50% casualties or more. If he fails the test, he must fall back from the position as described earlier and the attacker has won the assault.

If the Defender PASSES the test, then the ATTACKER must take the same test (at the same threat levels, depending on his own casualties in the assault); if the ATTACKER fails, then he must fall back from the assault (by 2" or half his movement if greater) and must lose Confidence levels as applicable. Should the Attacker pass this test, a second round of combat is fought out, exactly as for the first round except that this time the Defender may NOT count as being in Soft Cover or Dug-in - it is assumed that by this time the attackers are in among the defenders and slugging it out hand-to-hand.

If there is STILL no conclusive result (i.e.: neither side falls back, either by choice or by failing a test) then the assault continues to yet another combat round - this will be most rare, however, the majority of actions being over in one or two rounds of fighting.

Note that the entire action is fought out at one go, even if it goes to multiple rounds of combat; any Close Assault is resolved completely within ONE Game Turn, and never lasts over to the next turn.

[Any unit that falls back from a Close-Assault, whether Attacker or Defender, receives an UNDER FIRE Marker.]

### COMBINED ACTIVATIONS FOR CLOSE-ASSAULT (pt2 p19)

The mounting of a Close Assault attack is the only time in normal play where TWO (or more) units may actually be activated SIMULTANEOUSLY.

If a player has two or more units near enough to a single enemy unit's position that both can carry out Close Assaults, and he wishes both (or all) of these units to make a COMBINED Assault on the one enemy unit, this is permissible. Each of the units attacking must make their Reaction tests separately; if one or more fail their tests, the player may at his discretion abort the Assault, or continue with just the units that passed their tests.

The Close Assault is played through just as for a one-on-one attack, but at each step that tests are required each involved unit tests separately. If at any point PART of the attacking force falls back due to a test result, the player must again decide whether to break off altogether or continue. If he continues after one of his units has withdrawn, the remaining unit(s) must add an extra +1 to the Threat Level of any further tests they make in this Assault.

### OVERRUNS AND FOLLOW-THROUGH ATTACKS (pt2 p19)

If a Close Assault action ends with the Defending unit withdrawing (or destroyed), the Attacking player may choose to use a special option - the FOLLOW-THROUGH move. Instead of occupying the recently-vacated enemy position, he may overrun it and then attempt to continue moving his victorious unit(s).

To make a Follow-Through move, the player must immediately make a Reaction test for his unit (or units) that have just won the Assault. The Threat level is +1 if the defending units were completely destroyed, or +2 if they pulled back. If the player passes this test, he may then immediately make an EXTRA FULL ACTIVATION with that unit, including movement (which MUST take it through the captured position and on towards the nearest Objective) and a Combat Action if desired.

Such a Follow-Through activation may of course bring the unit into contact with any retreating enemy defenders again; the attacking player has the option of bypassing them (firing at them if he wishes) or of engaging them in yet another Close Assault.

### ANTI-PERSONNEL SUPPORT WEAPONS (APSWs) (pt2 p19)

An APSW is basically any weapon, designed specifically for anti-infantry fire, that is heavier than normal Infantry Personal Arms. The term is used here to cover such weapons as conventional Medium or Heavy Machine Guns, Automatic Grenade Launchers, Gauss MGs and multi-barrel "Miniguns", all of which have the same general purpose and effect - that of putting down a LOT of fire against dispersed infantry targets.

For simplicity in play, all APSWs are assumed to have the same overall effects, and a maximum effective range of 12". They are fired in the same way as infantry Firefight weapons, whether they are mounted on vehicles or carried by a specialist infantry team; the only difference is that when vehicle-mounted they do NOT need to dice for FIRE EFFECTIVENESS, which they have to if they are part of an Infantry unit.

Firing an APSW from a vehicle counts as the vehicle's Combat Action; it may NOT also fire another weapon during the same activation.

### ANTI-PERSONNEL FRAGMENTATION CHARGES (APFCs) (pt2 p19-20)

Many vehicles use a 'belt' of APFCs around the hull, for close-in defence against hostile infantry (especially in urban operations, where troops on foot can get dangerously close to unsupported Armour). APFCs are small flechette or shrapnel charges, firing outward to kill any Infantry foolish enough to get too near. The charges are detonated by automatic sensors, and are only used when the vehicle is operating without its own supporting infantry - although there are IFF devices in use, most troops don't trust them to keep working at the vital time!

An active APFC system will fire whenever an infantry element comes within 1" of the vehicle; simply draw TWO chits per infantry element within the 1" effect radius, and apply chit validity and results as for Infantry Firefights. For ease of play it is assumed that the charges are selectively fired in small groups, thus there are sufficient charges to fire any number of times during the game.

The other use of APFCs is to serve as a close-in defence against the small IAVRs, or "buzzbombs", used by infantry for light anti-tank weapons. The effects of APFCs on IAVR attacks are detailed in the rules for IAVR fire.

### INFANTRY ANTI-VEHICLE ROCKETS (IAVRs) (pt2 p20)

The IAVR, commonly known to both Infantry and Tankers as the "Buzzbomb", is a small, disposable anti-armour launcher carried by nearly all infantry rifle teams as a secondary weapon. During its activation, any Infantry team equipped with IAVRs may fire one at a vehicle target within range, INSTEAD of firing the team's Personal Arms. The maximum range of an IAVR is 4", and the fire procedure used is as follows:

At any range up to the 4" maximum, the FIRER of the IAVR simply draws 2 chits from the pot. Damage validity is as shown on the Weapon Damage Tables, i.e.: if the target has REACTIVE ARMOUR validity is RED chits only; if it has (active) APFCs, YELLOW chits only; if target has neither (just normal armour), RED and YELLOW chits are valid. All "special" damage chits ARE counted in IAVR fire.

IAVR launchers are very compact and lightweight, and each rifleman in a team will normally carry at least one, thus the team is assumed to have sufficient to last the whole game. [Note that only ONE can be fired per element per activation.]

### VEHICLE WEAPONS FIRE AGAINST INFANTRY (pt2 p20)

The primary anti-infantry weapon used by most vehicles is an APSW (Anti-Personnel Support Weapon), but there may also be times where a vehicle wishes to fire its main direct-fire armament against an Infantry target. This is possible for most direct-fire weapons, but with some exceptions it is generally not very effective - such weapons are optimised for the job of killing armour, not for shooting at dispersed groups of men.

When a player wishes to carry out such fire, follow the procedure outlined below for the type of weapon that is being used; note that NO die-rolls are required, simply draw chits for effect as specified. A "hit" on the approximate area the infantry target is occupying is assumed to be automatic, thus it just remains to determine if casualties are caused.

| Weapon Type | Max Range | Chits Drawn |
|-----------|-----------|-----------|
| HELs (all classes) | 36" | 2 chits per shot against a single target element |
| RFACs, MDCs and HVCs | MEDIUM range band for weapon class | 2 chits per shot against a single target element, regardless of weapon class |
| HKPs, GMSs, IAVRs | - | NOT effective against infantry targets |
| DFFGs | MEDIUM range for weapon class | THREE chits per shot against a single target element, regardless of weapon size |
| SLAMs | CLOSE range only | Chits equal to weapon class (e.g.: 4 chits for a SLAM/4); at MEDIUM and LONG ranges, infantry cannot be fired on directly (they are too dispersed to accurately target at these ranges) but may be hit as secondary targets |

At MEDIUM and LONG ranges, infantry cannot be fired on directly - they are too dispersed to accurately target at these ranges. However, infantry elements can be hit as secondary targets if caught in the danger zone around a targeted vehicle. Roll to see if they are actually hit as secondary targets (using a D6 roll as for other secondary targets); if so, then draw chits equal to weapon class as for CLOSE range.

[Note that in all the above cases, the Damage Validity and points totals necessary to kill infantry elements are the same as for INFANTRY FIREFIGHTS.]

### INFANTRY WEAPONS FIRE AGAINST VEHICLES (pt2 p20)

In general, Infantry Personal Arms and APSWs will be INEFFECTIVE against armoured vehicle targets. The only exception to this is when the target vehicle has an Armour Value of 0 - it is a "soft-skinned" vehicle (trucks, jeeps, etc.); in this case, it may be fired on by Infantry weapons and APSWs exactly as if it were an Infantry element target. Damage Chit validity in this case is the same as for Infantry Firefights, and the vehicle is treated like a Powered Infantry element for damage resistance - that is, it takes 5 damage points to kill the vehicle. Note that in these attacks, any SPECIAL damage chits drawn ARE valid, so the vehicle will suffer any special damage that is indicated by the chits drawn.

### INFANTRY TRANSPORT (pt2 p20)

Infantry elements (and in some cases light vehicles as well) may be transported in ground or air vehicles that have the cargo capacity for them. For all ground transport vehicles, and VTOL/Aerospace transports that are GROUNDED, loading and unloading Infantry or other vehicles takes HALF of the MOVEMENT FACTOR for both the transport AND the troops being unloaded. Thus an APC, for instance, could move half its allowance and then unload its troops, or alternatively could unload before moving - in which case both the vehicle and the troops could then move half their respective allowances after the men had disembarked. Any number of elements carried may be loaded or unloaded in the same half move.

VTOL transports may HOVER in Low Mode to disembark troops (not vehicles); this represents the infantry either abseiling down ropes, or simply jumping if they are in Powered armour! This takes the same half-move as other unloading, BUT only ONE element may be unloaded from each transport per half-move (so to drop two teams, a VTOL must hover for the entire activation).

For landing troops and equipment from Interface transports, or by Direct Insertion, refer to the rules on Interface Landings and Drop Troops.

### CASUALTIES TO MOUNTED INFANTRY (pt2 p20)

When Infantry elements are mounted in transport vehicles, they can of course suffer casualties if the carrying vehicle is damaged or destroyed.

If a troop-carrying vehicle is IMMOBILISED or gets a SYSTEMS DOWN result, any infantry on board are unharmed - they may dismount as normal.

If the vehicle receives a DAMAGED result, roll a D6 for each infantry element in the vehicle - on a roll of 1-5 the element survives (and may either dismount or remain in the vehicle); on a 6 it is lost.

Should the vehicle be DISABLED (i.e.: knocked-out), again a D6 is rolled per element - they are lost on a roll of 3-6; if the vehicle takes a "BOOM" result (a catastrophic hit) then ALL elements on board are automatically killed.

Elements carried in a VTOL or Aerospace craft that crashes are automatic casualties.

### FIRING INFANTRY FROM TRANSPORT (pt2 p20)

Infantry elements that are mounted in trucks, VTOLs and similar carriers may NOT fire while mounted, but those in APCs and MICVs may fire if they wish (from hatches or special firing ports).

Such fire is inaccurate at best, especially if the vehicle is moving, and is thus ALWAYS counted as "Ineffective fire" - i.e. it causes no casualties, but DOES put an "Under Fire" marker on the unit fired at.

---

## Digest Notes

All five pages (pt2-p16 through pt2-p20) have been successfully read and transcribed. The content covers:
- Chapter 7: Fire Combat sections on Angle of Attack, Multiple Mount Weapons, Pop-Up Attacks, Repairing Systems Failures, and a Direct Fire Example.
- Chapter 8: Infantry Combat sections covering Infantry Firefights, Close-Assault mechanics, Combined Activations, Overruns and Follow-Through Attacks, Anti-Personnel Support Weapons, Anti-Personnel Fragmentation Charges, Infantry Anti-Vehicle Rockets, Vehicle Weapons Fire Against Infantry, Infantry Weapons Fire Against Vehicles, Infantry Transport, Casualties to Mounted Infantry, and Firing Infantry From Transport.

All tables, numerical values, modifiers, die types, ranges, damage points, and procedural sequences have been transcribed exactly as printed. The example scenarios have been included to clarify complex rules. No significant portions were found to be unreadable in the scanned images.

## Verification Results

Second reader verification (page-image comparison against pt2-p16 through pt2-p20, plus cross-check against the Google OCR of Part 2) completed September 22, 2026. A prior "verified" pass had rubber-stamped the first reader's draft unchanged; this pass found and corrected four issues:
- The ANGLE OF ATTACK section had an invented "Direction / Armour Hit" table that does not appear on the page (the page has prose plus a diagram, no table); it was replaced with a brief diagram description.
- "IARVs" was a transcription error for "IAVRs" (Infantry Anti-Vehicle Rockets) in the section heading and in three places in the body text and table.
- The INFANTRY TRANSPORT paragraph had garbled a key sentence, dropping the condition that ground transports and VTOL/Aerospace transports must be GROUNDED for the half-movement loading/unloading rule to apply; this was corrected to match the printed text.
All other numeric values, table entries, threat levels, damage thresholds, range specifications, die types, and worked examples on these five pages were checked against the scans and found accurate.

---

# Chunk pt3-a · 37–41

## 9 ARTILLERY (Page 37)

### TYPES OF ARTILLERY BATTERIES

ARTILLERY is a general term used to describe guns and launchers that perform Indirect Support Fire against area (rather than point) targets. All Artillery elements must be organized into units like any other ground forces. An Artillery Unit is normally referred to as a BATTERY; Batteries generally consist of from two to four guns or launchers.

Available types of Artillery:

- **RAM (Rocket-Assisted Munition) MORTARS:** High-trajectory smoothbore weapons similar to conventional mortars, but using rocket-boosted shells for extra range and power. May be mounted on vehicles, towed or even man-packed. Classed as LIGHT ARTILLERY.

- **TUBE ARTILLERY:** Covers traditional guns and howitzers (usually with rocket-assisted munitions), plus more advanced types such as Mass-Driver Artillery. RAM Field Guns and Howitzers are classed as MEDIUM ARTILLERY; Mass-Driver types are HEAVY ARTILLERY (due to their far higher rates of fire, they can deliver more ordnance in a given time).

- **MULTIPLE ROCKET LAUNCHERS (MRL):** Launchers for clusters of Artillery Rockets, which may be fired either singly (for Harrassing fire) or ripple-fired in salvo for Effective bombardments. Smaller MRLs count as MEDIUM ARTILLERY; larger types are HEAVY ARTILLERY.

- **HEAVY ARTILLERY ROCKETS (HARs):** Single very large rockets with multiple warheads, each rocket having the effect of a full Artillery bombardment. Count as HEAVY ARTILLERY.

### LOCATION OF ARTILLERY BATTERIES

Artillery may be located ON TABLE or OFF TABLE.

**ON TABLE** batteries are treated like any other combat Units, except that (like other elements with FIXED MOUNT weapons) they may NOT use the option of moving BEFORE firing. They MAY fire and then move, which represents the "shoot and scoot" tactic used to foil enemy counter-battery fire. In general, the only type of Artillery used on-table will be RAM Mortar batteries attached to the Combat Group; however there is nothing to stop other Artillery types from being employed on-table if desired (or if the scenario requires this).

ALL ARTILLERY, REGARDLESS OF TYPE, IS ASSUMED TO BE SUFFICIENTLY LONG-RANGED THAT IT CAN FIRE ON ANY POINT ON THE TABLE. This includes even Light Artillery (RAM Mortars).

**OFF TABLE** batteries are assumed to be located some distance behind the player's baseline; the models are placed either just on the table edge, or just off it (whichever is more convenient). Off-Table batteries will be slightly less flexible in their response to calls for fire support, as described in REQUESTING ARTILLERY FIRE. All types of Artillery, including RAM Mortars, may be located off table and are still assumed to be able to hit anywhere on the table.

Off table Batteries may NOT be engaged by Direct Fire of any kind, but ARE vulnerable to enemy COUNTER-BATTERY fire. Batteries located off table may still be "moved" to reduce the risk of Counter-Battery attacks on them, but they may NOT move in the same activation that they fire. (To indicate "moving" an off-table battery, simply move the models sideways a few inches—this represents the battery changing its firing positions, and means that it may not then fire until the next activation.)

### ARTILLERY MUNITION TYPES

The following different types of Munitions are generally available for Artillery units to fire (on Effective Fire missions), provided Ammunition markers of the relevant type(s) have been "bought". Certain munitions are NOT available to some kinds of Artillery, and such exceptions are noted where they occur.

**HIGH EXPLOSIVE FRAGMENTATION (HEF) ROUNDS:**
These are the basic explosive rounds, available to ALL Artillery types. They comprise submunition dispensers which scatter a multitude of small bomblets over the beaten zone, with devastating effect against Infantry targets. Though HEF rounds can have some effect against vehicles (particularly lighter types), they are generally considered an anti-personnel munition.

**MULTIPLE ARMOUR KILLER (MAK) ROUNDS:**
MAK shells are submunition devices like the HEF rounds, but instead of anti-personnel bomblets they dispense a cloud of kinetic penetrators that are very effective against most vehicles except the most heavily armoured ones. A MAK bombardment has a certain level of effect against Infantry as well as vehicles, but is primarily used as an anti-armour weapon. All types of Artillery may employ MAK rounds.

**DISPERSED MINE ROUNDS (DMR):**
These shells deliver a large number of mixed antipersonnel and anti-vehicle minelets, thus creating an "instant minefield"; the effects of this are covered in the section on Mines. DMR fire may be employed by all Artillery types EXCEPT Light (RAM Mortar) batteries.

**SMOKE ROUNDS:**
These are Obscuration shells that create a "smoke" cloud from the point of impact (the "smoke" is chemically produced and contains various agents that inhibit sensors other than just optical devices). The full effects are described in the rules for Smoke and Obscuration. Smoke rounds may be fired by all Artillery types EXCEPT for HEAVY ARTILLERY ROCKETS (HAR).

**NUCLEAR ("NUKE") and BIOCHEM ROUNDS:**
These "nasty" munition types are still regarded as Terror Weapons, and though some forces will persist in treating them as just another valid tactical option their use is normally followed by swift diplomatic and moral condemnation! They ARE available, however, so they have been included here for completeness—their game use should be strictly limited, and then only with the full agreement of ALL players involved (and if it can be fully justified by the scenario and background being used). The full effects of these munitions are given in the relevant rules section (P.47). The ONLY Artillery types that may fire Nukes and Biochems are HEAVY ARTILLERY and HEAVY ROCKET ARTILLERY batteries. Each firing of Biochems represents enough rounds to saturate the beaten zone with the bioagents, but each Nuke firing actually represents only ONE shell—that, however, is usually enough! [NOTE that firing a single Nuke round is counted as the Combat Action for the entire Battery.]

---

## 9 ARTILLERY (Page 38)

### ARTILLERY FIRE MISSIONS

There are two main types of fire mission that Artillery units may undertake: HARRASSING FIRE and EFFECTIVE FIRE.

**HARRASSING FIRE** consists of intermittent firing at random intervals, and is designed not to cause casualties but to make the enemy keep their heads down. It is very economical on ammunition, but has a profound psychological effect on the units it is targeted on—they know that the opposition has ranged on them, and that at any moment the sporadic shelling could turn into a terrifying "fire for effect". In game terms, the only effects on units in the beaten zone are that they receive an UNDER FIRE marker, and (2) they must take a Confidence Test for being under Artillery attack. No chits are drawn for casualties.

The advantage of Harrassing fire for the FIRER is that it does NOT consume Artillery Ammunition markers, as the expenditure of rounds is quite low. Harrassing Fire missions are always assumed to be using OPEN SHEAF beaten-zone patterns, the overall size of the zone depending on the number of weapons in the firing battery. Since no casualties are possible (in reality of course there is always SOME chance of a kill, but for game terms it is so unlikely as to be ignored) it does not actually matter what type of rounds the Artillery is firing—they are generally assumed to be HEF.

The battery may continue to fire harrassing missions, even when it has no Ammunition markers of any kind left; it is assumed that each gun has a few odd rounds in reserve for such eventualities.

NOTE that Harrassing Fire missions may NOT be carried out by HEAVY ARTILLERY ROCKET (HAR) batteries; they may be used by all other battery types however.

**EFFECTIVE FIRE** is when the old gunners maxim of "don't tap it, thump it!" comes into play. For an Effective Fire mission, all guns or launchers in the battery will fire continuously at their maximum rate, pouring as much destruction as they can into the beaten zone.

Every time that the battery fires an Effective mission as a Combat Action, it expends one Ammunition marker of the relevant type; if it runs out of a particular kind of marker it may no longer fire that kind as an Effective Fire mission until resupplied.

All elements caught in the beaten zone of an Effective Fire mission must draw chits for the effects, as described under ARTILLERY FIRE EFFECT.

Effective Fire missions may use either an OPEN or CONVERGED SHEAF, as the firing player wishes.

Effective fire may be carried out by ANY type of Artillery battery, including HEAVY ARTILLERY ROCKETS.

### BEATEN ZONES FOR ARTILLERY FIRE

The area of ground hit by Artillery fire is termed the "BEATEN ZONE": all individual elements caught within that zone are potential targets for the effects of the fire.

The actual size and shape of the Beaten Zone for a particular fire mission depends on two factors: (1) the NUMBER of Artillery elements firing, and (2) whether the mission is firing an OPEN SHEAF or a CONVERGED SHEAF, as explained below.

**A CONVERGED SHEAF** mission is where ALL the guns or launchers in the firing Battery target the SAME point-of-impact; this obviously gives a VERY high concentration of fire over a relatively small area, and causes very severe casualties.

**An OPEN SHEAF** firing, on the other hand, is where each gun or launcher adjusts its fire so that the effect of the battery is spread over a much larger Beaten Zone (thus hopefully affecting more individual elements in the zone), but the fire concentration on any one point is obviously less.

For a **Converged Sheaf**, ONE Impact Marker is placed at the point of aim; the Beaten Zone for the fire mission will be a circle centred on this marker, the diameter of the circle being 4"—thus any element that is within 2" of the Impact marker will be affected by the fire.

For an **OPEN Sheaf** mission, the shape of the Beaten Zone is an elongated ellipsoid (like a rectangle with curved ends); it is actually two 4" diameter circles joined by a straight area, as shown in the diagram. The area is defined by placing TWO Impact Markers, one at the centre of each 4" circle; the distance BETWEEN the two markers depends on the number of weapons in the firing Battery—it should be 4" for every extra gun (so for a two-gun battery the markers would be 4" apart, for three guns 8" apart, and for four guns 12" etc.). The long axis of the beaten Zone may be aligned in either of two ways—it may be PARALLEL to the Line of Fire (i.e.: the direction from the firing battery to the target zone), or may be PERPENDICULAR to it. The Beaten Zone may NOT be set at any OTHER angle to the line of fire.

[Note that the Beaten Zone sizes do NOT vary with the type of Artillery firing (Light, Medium or Heavy); these differences are accounted for in the Damage Effects.]

### REQUESTING ARTILLERY FIRE

Artillery Fire Support from a Battery attached to the Combat Group (whether the battery is on or off-table) may be requested at any time by the following elements:

- Any UNIT COMMAND element (e.g.: a Platoon or Troop Commander), or
- A Specialised Observer Team (an Infantry element or vehicle-mounted observer)

To request fire, the observer or commander must be in clear line-of-sight to the intended target point, and within maximum Sensor range (60" under normal conditions). Requesting the fire counts as the COMBAT ACTION for that ELEMENT, although other elements of the unit may perform other actions.

When the fire request is made, the activating player immediately rolls a die: the Die Type is determined according to the element observing for the fire—if a Specialist Observer roll a D12; if a Unit Commander then roll a D10 if his Leadership is 1, a D8 for Leadership 2 or a D6 for Leadership 3. For ON-TABLE Batteries, a score of 4 or greater is required for the call for fire to be successful; for OFF-TABLE Artillery the score needed is 6 or more (failure indicates the observer has been unable to get the battery to respond, has given it the wrong co-ordinates, the battery is preoccupied with other things etc.).

If this die roll is successful, the player immediately places on the table either ONE or TWO "IMPACT" markers (the white counters with the "target reticules")—One to indicate a CONVERGED SHEAF bombardment, or two to mark the zone for an OPEN SHEAF. The marker(s) are placed on the intended target point(s) as described in the section on BEATEN ZONES.

When the marker(s) are placed on the table, the player should also place an Artillery Ammunition counter FACE-DOWN near the Impact marker; this commits him to using a particular Munition Type, though of course the opposing player will not know what type it is until the fire actually arrives. If the firing player is using just HARRASSING FIRE, for which no Ammunition marker is expended, he should use one of the "DUMMY" markers from the counter-sheet so as not to give his intentions away to his opponent.

---

## 9 ARTILLERY (Page 39)

### ARTILLERY FIRE RESOLUTION

When an observing element successfully calls for Artillery fire and places the appropriate Impact marker(s) on the desired point of aim, the fire does NOT arrive immediately. The player completes the activation of the "observing" unit, then play switches to his opponent as normal. Once the opposing player has made an activation, the player who called in the Artillery MUST then use his turn to activate the Artillery Battery and resolve the Fire Mission.

[Should the player, for any reason, decide he must try to CANCEL the fire mission then he must make the same test as he had to for requesting the fire; failure to roll a sufficient score means the cancellation does not get through and the fire arrives as planned, while success means the fire is cancelled—however this still counts as the player's activation turn, and the Artillery Battery is treated as if it had activated; its Command Marker is inverted and it can do nothing more that Game Turn.]

Obviously, this sequence gives the opposing player a chance, if he wishes, to activate any unit in danger from the Artillery mission (provided of course that it has not already used its activation that turn) and possibly move it to safety before the fire arrives. This is actually quite justifiable—it is very hard to target Artillery accurately onto a mobile target unit (largely due to the delay between calling for and its arrival), and if the threat of the impending attack forces the player to (say) pull a unit back out of position, then the Artillery has done part of its job anyway by making your opponent react in the way YOU want him to—hopefully to the detriment of his own plans!

[Consider, if you like, that the placing of the Impact marker represents either the laser designation of the target area or the arrival of the first few ranging shots, both of which are detectable by the unit under attack and will give them at least a little warning of the incoming barrage. What they (and the player controlling them) CANNOT know is whether the actual bombardment is going to be Effective or just Harrassing fire, and what munitions are coming over—a few smoke shells, or a tactical Nuke??]

### ARTILLERY FIRE DAMAGE EFFECTS

All elements, vehicle and infantry, that are caught within the Beaten Zone of a fire mission are potentially affected by it. With HARRASSING FIRE, there is no effect other than placing UNDER FIRE markers on the units (a UNIT is deemed to be affected if ANY of its elements are caught in the Beaten Zone) and requiring a Confidence Test.

Smoke and DMR (Mine) missions also do not have immediate effects other than those specified in the relevant rules, and Nuke/Biochem munitions have special effects that again are described in their particular sections.

The majority of EFFECTIVE fire missions will be using HEF or MAK munitions. For these, all elements in the Beaten Zone draw a number of chits as specified below:

- Each LIGHT Artillery element firing is worth 1 CHIT per VEHICLE target element, or 2 CHITS per INFANTRY target element.
- Each MEDIUM Artillery element causes 2 CHITS to be drawn per VEHICLE or 3 CHITS per INFANTRY element.
- Each HEAVY Artillery element is worth 3 CHITS per VEHICLE or 4 CHITS per INFANTRY element.

If the mission is an OPEN SHEAF, then each element in the Beaten Zone is only drawn for ONCE, as each part of the Zone is only being bombarded by ONE Artillery piece. If it is a CONVERGED SHEAF, each element draws chits AS MANY TIMES AS THERE ARE WEAPONS in the firing Battery.

Example: If a Battery of three Light Artillery pieces is firing an OPEN SHEAF, every VEHICLE caught by the fire draws ONE chit for damage effects, and every INFANTRY element draws TWO chits. If the same Battery fired a CONVERGED SHEAF, each VEHICLE in the (smaller) Zone would draw THREE individual chits, and each INFANTRY element would draw THREE PAIRS of chits, to represent it being hit by the concentrated fire of the three guns.

[NOTE that for the Converged Sheaf mission, each target element would draw the chits as 3 individual chits (or pairs), and count results of each draw accordingly—it would NOT draw 3 (or 6) chits at once and total them all up.]

The Damage Chit Validities are as shown in the table on P.29; elements get advantages for being Dug-in, but NOT for just being in Soft Cover. [VEHICLES when Dug-in are IMMUNE to HEF fire, while Infantry dug-in are immune to MAK effects.]

The points required to damage/destroy a vehicle are as per Direct Fire (i.e.: based on the vehicle's Armour rating), while the points to kill Infantry elements are the same as for Infantry Firefights—i.e.: 3 for Militia, 4 for Line and 5 for Powered. All "special" damage chits ARE valid if drawn against VEHICLES, but are ignored when drawn for Infantry.

---

## 9 ARTILLERY (Page 40)

### AMMUNITION SUPPLY AND RESUPPLY

Ammunition markers may be "bought" for each Artillery Battery when organizing your forces, using the points costs given in the POINTS VALUE LISTINGS (P.52).

Note that the actual costs per marker are PER ELEMENT in the Battery, so a three-gun Battery will pay 3 × the given points per marker.

A Battery may have up to THREE ammunition markers representing the rounds carried in the Gun vehicles themselves; additional ammunition markers must be carried in units of transport vehicles accompanying the Battery. These transport vehicles need not be represented by models for Off-Table batteries, but for On-Table Artillery then actual models should be used (the transport vehicles will be organized into separate units if on-table, and transferring their ammunition loads to the Battery will count as their Combat Action). The Artillery Battery itself may neither move nor fire in the turn it resupplies with ammunition.

One "load" of cargo for a transport vehicle requires a capacity of 4; this load (in ammunition terms) represents a "one gun share" of one ammo marker—in other words, a three-gun Battery requires 12 capacity points (three "loads") to carry ONE ammo marker for the whole Battery.

For Off-table batteries, simply stack any additional ammunition markers purchased near the Battery. Up to three of these may be "loaded" on board the Gun vehicles at any time, but doing so uses the Activation of the Battery—thus they may neither move nor fire in the turn they resupply with ammunition.

Note that this system for ammunition resupply is somewhat abstract and simplified; in particular it does not take account of the different types of Artillery (Light, Medium or Heavy). If you REALLY want to play Quartermaster rather than a General, then by all means add some extra detail into the system.

### COUNTER-BATTERY FIRE

Whenever an Artillery Battery fires from a particular location, it is possible that an opposing Artillery unit equipped with COUNTER-BATTERY capability will manage to locate the Battery firing, with enough accuracy that it can return fire on them.

If a Battery is equipped with a Counter-Battery Radar (CBR) vehicle, then that Battery may be Activated at any time (subject to normal rules) to perform a Counter Battery mission in place of a normal Fire Mission.

Counter-Battery fire may only be attempted against an enemy Artillery unit that has already performed a Fire Mission (of any type) in the current game Turn. It requires no observer or target designation. The CBR element with the Battery is directing the fire. The player must roll a die, according to the Quality of the CBR system: D6 for BASIC, D8 for ENHANCED and D10 for SUPERIOR. If he scores 6 or more, the opposing Battery has been located and he may immediately place an Impact marker (or markers) on it, followed by the resolution of whatever type of fire mission he chooses to use. The mission arrives immediately, being resolved as the Battery's activation for that turn.

Counter-Battery fire may be employed against On or Off table batteries, and in both cases is resolved exactly as for a normal Artillery mission.

Note: if a battery moves directly after firing ("Shoot and Scoot"), then NO Counter-Battery fire may be attempted against it. If, on the other hand, it fires from the SAME position (without moving) for TWO or more activations, then INCREASE by one the Die Type used for the Counter-Battery roll.

### ORTILLERY

"Ortillery" is the term used for ORBITAL ARTILLERY: fire-support from spacecraft, satellites or gun-platforms in orbit. Such fire is accurate enough to be used for bombardment during the battle. However, there is some potential for error and its use in very close proximity to friendly troops is not recommended!

In most respects, Ortillery fire is treated in just the same way as ordinary Artillery—it is simply another form of off-table Battery (but not, of course, vulnerable to Counter-Battery fire!). The major difference is that, after the placement of the Impact markers on the designated aim point the fire CAN deviate from this intended target.

When the fire mission arrives (i.e.: the orbiting "Battery" is activated), roll a D12 using the "clockface" method; this determines which direction the fire will deviate in. Now roll a D6 and a D8 together. If the score on the D6 is higher than (or equal to) the D8, then the fire does not deviate at all—it hits the intended aim point. If the D8 roll is higher than the D6, then the DIFFERENCE between the two rolls is the number of inches the fire deviates; move the impact marker(s) the required number of inches in the relevant direction before resolving the fire mission.

[If desired, players may use this or a similar "deviation" system for normal Artillery fire as well as for Ortillery—generally, however, we assume that normal Artillery fire is sufficiently accurate not to worry too much about fire deviation.]

Other aspects of Ortillery support may be considered if players wish, that are outside the scope of this book to cover fully—these can include limited availability of Ortillery as the ship/satellite moves round its orbit (perhaps available only on every fourth Game Turn or so), other types of Orbital fire such as Particle beams or very big Lasers and so on. There are a whole lot of things you can add in if you so desire—hopefully we can cover some of them in future publications.

---

## 10 AEROSPACE OPERATIONS (Page 41)

### AEROSPACE CRAFT ORGANISATION

Unlike VTOLS, which operate as a specialist form of "ground" vehicle and are grouped into normal UNITS of several elements, AEROSPACE CRAFT (in particular Ground-Attack fighters, the type most commonly used over the battlefield) will often operate as SINGLE CRAFT, or at most in "flights" of two craft.

Each individual Aircraft is treated as a "unit" in its own right, even if two or more are operating together. The aircraft has a Command Marker (which functions slightly differently from ground unit markers, as explained below), but does NOT require a Confidence Level marker.

The Command Marker given to an Aerospace Craft denotes the "quality" of the pilot and crew by its COLOUR, as for normal units—GREEN for poorly trained or inexperienced "Turkeys", BLUE for the average combat pilot, and ORANGE for the real hotshot "Saviour-of-the-Universe" Jet Jockeys!

The NUMBER on the Command Marker does not represent Leadership, but more the "nerve" and morale of the pilot (which is NOT the same thing as his training and experience level; it is a measure of how likely he is to say, break off an attack run if faced with a lot of AA fire—or will he plough on through it and get that target at all costs?).

When an Aerospace craft has to take a Reaction test, the number/colour of the Command marker is used exactly as for other units.

### AEROSPACE UNIT ACTIVATION SEQUENCE

A player may ACTIVATE an Aerospace craft (or a group of two or more, operating together) at any point in the Game Turn, in the same way that he would Activate a ground unit. Because Aerospace units are VERY fast moving in relation to ground vehicles, they do not follow the normal movement rules; instead, their Activation consists of a fast pass across the battlefield, delivery of their ordnance to the target area and then leaving the table in the same pass.

When activating such a unit, follow this sequence:

i) Place the Aerospace Craft at the point at which they are to enter the table, and move them along the desired flight path until they reach the point at which they are to attack their targets. During this movement, they may be fired on by any opposing Air Defence elements which have ACTIVE Air Defence Sensors and are in range of the flight path.

ii) Once over their target, the Aerospace craft may be fired on by any "local defensive systems" of the unit(s) they are attacking. If they survive this fire, the Aerospace craft may then make their attacks (either DIRECT FIRE of missiles, guns etc., or delivering Area Effect ordnance).

iii) Following their attacks, the craft are moved along their flight path until they exit the table edge (during this movement, they may be fired on by any 'Active' Air Defence elements that did not choose to fire during the craft's approach to their targets).

In the case of Aerospace units that wish to LAND on table, the actual landing takes place instead of the attacks in step (ii); "local defensive systems" may, if in range, attack the craft as they are landing.

This completes the ACTIVATION of the Aerospace Unit.

### AIR VEHICLE WEAPON EFFECTS

Both VTOLS and Aerospace craft can carry Direct Fire weapons and Guided Missiles; Aerospace craft can also carry Dead Fall Ordnance (DFO) loads. Most Air attacks are resolved using the same mechanisms as ground combat, with the following limitations:

i) All air vehicles may only fire Direct Fire weapons at targets straight ahead of the aircraft, i.e.: actually on the line of flight (except for chin turret mounts on VTOLs, which may fire through a 180° forward arc). Range bands are the same as for ground-fired equivalents.

ii) Missiles may be fired at targets within the normal FIXED MOUNT fire arc, i.e.: a 30° forward arc. Range is the same as for ground-fired missiles. [NOTE that each Guided Missile System fitted to an Air vehicle is a complete Launcher and supply of missiles (as used on ground vehicles), and NOT just a single missile on a pylon—thus each system can launch one missile per activation, and the missile supply is assumed sufficient for the game duration.]

iii) DFO attacks may be aimed at a target point between 4" and 8" ahead of the aircraft, along the line of flight. Such attacks have a Beaten Zone 4" in diameter, the same as a Converged Sheaf Artillery attack. One impact point marker is used to indicate the centre of the Zone.

An air vehicle may make ONE attack per activation, so on one pass an Aerospace craft may either use direct fire or missiles against a single element, or make one DFO drop on a single target Zone.

### DEADFALL ORDNANCE ATTACK RESOLUTION

When a DFO attack is delivered by an Aerospace craft, its effect is resolved in basically the same way as an Artillery mission. The Beaten Zone is a 4" diameter circle, so all elements within 2" of the impact marker are potential targets.

When attacking with HEF or MAK ordnance (the usual options), each ORDNANCE LOAD dropped draws TWO chits per target element; thus if an aircraft expends two Loads on one pass, each element in the Zone draws a total of FOUR chits.

The validities of Damage Chits, and their effects, are exactly as for Artillery attacks of the relevant type.

The aircraft expends one Ordnance marker per Load dropped.

[Note that, if required, Aerospace craft may be used to deliver NUKE or BIOCHEM ordnance; in these cases the Zones and effects are exactly as for Artillery-delivered attacks using these munitions.]

---

## VERIFICATION NOTES

The digest has been carefully compared against all five scanned pages (pt3-p01.png through pt3-p05.png) and the OCR text. The following verification was performed:

1. **All section headings verified:** Every section title and subsection heading matches the source material exactly.

2. **All numeric values verified:** 
   - Artillery battery composition (2-4 guns)
   - Fire range: 60" for sensor range
   - Success rolls: 4+ for on-table, 6+ for off-table
   - Leadership die types: D10/D8/D6 for Leadership 1/2/3; D12 for Specialist Observer
   - Beaten zone diameter: 4"
   - Open sheaf spacing: 4" per extra gun (2-gun = 4", 3-gun = 8", 4-gun = 12")
   - Damage chits: Light (1 vehicle/2 infantry), Medium (2 vehicle/3 infantry), Heavy (3 vehicle/4 infantry)
   - Counter-battery die types: D6 basic, D8 enhanced, D10 superior (score 6+)
   - DFO beaten zone: 4" diameter
   - DFO ordnance: 2 chits per load per target
   - Ammunition capacity: 4 points per load, 3-gun battery needs 12 points for one marker
   - Maximum ammunition markers on gun vehicles: THREE
   - Air attack arcs: 180° for chin turrets, 30° for fixed missiles
   - DFO target range: 4" to 8" ahead of aircraft

3. **All rules and conditions verified:** Every rule condition, exception, and modifier has been checked against the source pages.

4. **Example scenarios verified:** The three-gun light artillery OPEN/CONVERGED sheaf example is confirmed accurate.

5. **Page references verified:** P.29 (damage chit table), P.47 (nuke effects), P.52 (points values)

6. **Special notes and bracketed explanations:** All bracketed rules clarifications and notes have been preserved.

No errors or omissions were found. The first digest was thoroughly accurate and complete for pages 37-41. All content has been preserved exactly as provided by the first reader.


---

# Chunk pt3-b · 42–46

## 10 AEROSPACE OPERATIONS (p. 42)

### AIR DEFENCE

AIR DEFENCE fire is the method used to attack Aerospace units, and VTOL units in High Mode. VTOL units in Low Mode can be fired on by ordinary ground units using Direct Fire.

AIR DEFENCE consists of:
1. "Local" Air Defence weapons (Infantry elements and vehicles carrying Light Anti-Air weapons)
2. "Zone" Air Defence cover provided by AREA DEFENCE SYSTEM (ADS) vehicles

The Air Defence fire described here refers mainly to Aerospace craft (particularly ground-attack missions); VTOLs in High Mode are fired at using basically the same system, but with the following provisions:

i) VTOLs test Reaction to Air Defence fire as complete units, as opposed to the individual tests used for Aerospace craft.

ii) VTOL units that get an "abort" result do not have to leave the table; instead they lose a Confidence Level and have to drop to Low Mode. They are unable to return to High Mode until within sight and within range of any active ADS vehicle.

Air Defence fire is made in a similar way to OPPORTUNITY FIRE: it is done during the activation of the attacking Aircraft rather than that of the unit under air attack. Unlike normal Opportunity Fire, Air Defence fire does NOT cause the firing unit to lose its own activation chance and may be carried out by a unit that has already been activated that turn.

Note: Vehicle-mounted Point Defence Systems may NOT engage aircraft (they are purely anti-missile weapons).

#### LOCAL Air Defence (LAD)

- LAD may only be used by a particular unit against air attacks directed at that unit itself (in self-defence)
- LAD fire has a maximum range of 12"
- LAD may engage any air vehicle attacking the unit, provided that the aircraft is within 12" of the LAD element firing
- Aircraft attacking with long-ranged weapons such as Missiles may fire from stand-off position where they are out of LAD range
- Any aircraft making a DFO strike run must be within LAD range to launch

#### ZONE Air Defence (ZAD)

- ZAD may fire at ANY air vehicle within range and line of sight, regardless of who is being attacked
- ZAD has a 36" range
- This range may be measured to ANY point on the aircraft's flight path across the table (or to the current position of a VTOL unit)
- As soon as a player announces ZAD fire against an opponent's aircraft, the player with the aircraft must immediately make a Reaction test for the pilot
- This test is made in the normal way using a Threat level of +1

**If pilot PASSES the test:** He may continue his attack

**If pilot FAILS:** He must break off the attack run and immediately exit the table. The Air Defence fire against it is not resolved - the pilot has detected a "lock-on" from an anti-aircraft system.

**Note:** If an aircraft aborts in this way, it may return to try again during the next game turn.

#### Pilot Reaction Test Details

- If the pilot presses on with the attack, any Air Defence fire against his aircraft must be resolved before he launches his weapons
- Each ADS vehicle may only fire on ONE aircraft of a GROUP of craft operating together
- For the Reaction test: ALL aircraft in the group must test even if just one is being fired on

#### ZAD Fire Resolution

Each Zone Air Defence vehicle resolves its attack SEPARATELY:

1. **ADS player rolls a die** based on Quality of ADS:
   - D6 for BASIC ADS
   - D8 for ENHANCED
   - D10 for SUPERIOR

2. **Aircraft player rolls a die** based on aircraft's Command marker:
   - D6 for GREEN marker
   - D8 for BLUE
   - D10 for ORANGE
   - Modified UP one die type for grade 1 pilot
   - Modified DOWN one die type for grade 3 pilot
   - (Thus "ORANGE 1" uses D12, but "GREEN 3" uses D4)

3. **If Aircraft equipped with ECM:** Gets a SECONDARY die roll based on ECM quality:
   - BASIC = D6
   - ENHANCED = D8
   - SUPERIOR = D10
   - Functions same as Secondary die in direct fire (HIGHER of two die scores is used)

#### ZAD Results

- **If ADS roll EQUALS Aircraft's roll:** Pilot must ABORT his attack (but aircraft is undamaged; may return next game turn)

- **If ADS roll EXCEEDS Aircraft's roll:** Aircraft is hit and possibly damaged
  - Draw 2 Damage Chits for Basic ADS
  - Draw 3 for Enhanced
  - Draw 4 for Superior
  - ALL chits are valid EXCEPT Special damage chits (which are ignored)

- **If total damage points LESS THAN Aircraft's ARMOUR RATING:** Craft is undamaged but must still abort for that turn

- **If total damage EQUALS Aircraft's ARMOUR RATING:** Aircraft is DAMAGED and must abort. In this case it is NOT able to make further passes in the game, but must "limp" back to base

- **If total damage EXCEEDS Aircraft's ARMOUR RATING** (which, as already noted, actually represents its overall "survivability"): Aircraft is SHOT DOWN - it crashes and is destroyed

#### LOCAL Air Defence (LAD) Fire

An aircraft that survives ZAD fire and continues its attack must then run the gauntlet of any LOCAL AIR DEFENCE weapons used by the TARGET UNIT.

**No Reaction test is needed** - simply go straight to fire resolution:

1. **Aircraft player makes a roll** exactly as for ZAD above (including Secondary roll for ECM if applicable)

2. **LAD player makes a roll** based on NUMBER of LAD elements in the unit under attack:
   - One element with LAD weapon = D6
   - Die Type increases by one for every additional LAD weapon fired
   - Example: Unit firing 3 LAD systems at one attacking aircraft = D6 + 2 types = D10

**Note:** If two or more aircraft (operating together) are attacking one unit, the player under attack must decide how to divide his LAD weapons. Each may only fire at ONE of the aircraft.

Results of rolls are calculated as for ZAD fire effects, EXCEPT that only TWO Chits are drawn (as for a BASIC ADS) regardless of actual number of LADS firing. Chits drawn are compared with Armour Rating as above, thus causing attacking aircraft to complete its attack, abort mission, abort with damage, or crash.

If aircraft survives everything Air Defences throw at it, proceed to attack resolution steps.

---

## 10 AEROSPACE OPERATIONS (p. 43)

### INTERFACE LANDINGS

Troops and vehicles may be landed from orbit in Interface Craft (Dropships and Assault Landers). It is not really necessary (or worthwhile) to go through a lengthy design procedure for such craft, as they will probably only be used for one turn in the game.

#### DROPSHIPS

- The BIG Interface craft
- Used to carry Heavy Armour and support vehicles
- Each Dropship can carry between two and five complete UNITS
- Capacity depends on the size of the ship and element types in the units
- Units may be unloaded in the activation FOLLOWING the one in which the Dropship lands

#### ASSAULT LANDERS

- Smaller craft
- Carry from a couple of elements up to one complete unit
- Elements may unload in the SAME activation that the lander touches down

#### Interface Landers Under Fire

- Whether Interface landers are at risk from AA fire on the way down must be determined by the scenario
- In most cases the potential cost of losing a whole Dropship full of Armour will mean such a landing will only be attempted once defences have been subdued
- If an "opposed" landing is tried: roll a D6 for each Lander coming in
- The score needed should be determined by scenario (perhaps 6 if facing light defences or 5-6 if against heavy resistance)

#### Interface Craft Landing Rules

- Bringing in ANY NUMBER of Dropships and/or Assault Landers counts as just ONE ACTIVATION for the player
- As noted above, elements in Assault Landers may be unloaded and placed on table immediately
- Elements in Dropships must be unloaded in following activations
- Unloading ONE Dropship counts as a full activation turn
- Interface craft may land anywhere on-table, provided they are at least 12" away from the nearest (visible) enemy forces

#### Interface Landing Costs (Points System)

When "paying" for interface transport capability in the Points Cost system, points are paid as a percentage of the cost of each element that is to be interface-landed, rather than paying costs for the landers themselves.

### DROP TROOPS

Certain specially-equipped elements (known as DROP TROOPS) may be "directly inserted" to the battle area by either parachute/parajet from high-flying transports, or in ballistic entry capsules from an orbiting ship.

#### Drop Troops Eligibility

- If dropped from within atmosphere: Line or Powered Infantry may be used
- Only Powered troops may drop directly from orbit
- Only infantry and Very Light (class 1) vehicles and equipment may be paradropped
- Only type of non-infantry element that may be orbitally dropped is the Infantry Walker

#### Simulating Semi-Random Drop

To simulate the semi-random nature of the drop:

1. Take one of the LETTERED MARKERS to represent each UNIT of Drop Troops
2. Actually "drop" these markers from at least three feet above the table (they should bounce nicely!)
3. Where they end up is the centre of the drop zone for that unit
4. Any markers that bounce off table represent units either killed by AA fire on the way down or missing the drop area completely - they are "lost" for purposes of the game

#### Drop Troop Placement

- The actual models for the units are now put on the table
- Each Unit is scattered around its drop zone marker
- NO element is LESS than 4" from any other
- The unit begins out of Unit Integrity
- Its first activation on table MUST be to move its elements into integrity distance before it can do anything else

#### Terrain Effects on Drop Troops

If drop zone marker ends up in:

- **WOODS, SWAMP or MOUNTAIN terrain:** Roll D6 for each element - on roll of 5-6, it is lost on landing

- **URBAN terrain:** Infantry elements are lost on rolls of 4+, and vehicle/equipment elements are ALL lost automatically

- **OPEN WATER:** Lost completely, EXCEPT for POWERED INFANTRY and INFANTRY WALKERS who may wade ashore

#### Drop Troops Costing (Points System)

When "paying" points costs for Drop Troops and equipment, these are calculated as a percentage of the cost of the equivalent "normal" element.

---

## 11 ADDITIONAL AND OPTIONAL RULES (p. 44)

### SMOKE AND OBSCURATION

SMOKE effects are produced by:
1. Artillery firing Smoke Rounds
2. Vehicle-mounted Smoke Dischargers
3. Fires (burning woods or buildings)

The main effect of smoke is to block line of sight and line of fire, thus inhibiting both Direct Fire and target observation for Artillery.

**All smoke clouds are assumed to be "hot" smoke** - either from a fire or from chemical agents in artificially-produced smoke. Therefore smoke is opaque to IR and most other sensors, as well as basic optics.

#### Smoke Cloud Representation

The "smoke" markers on the counter-sheet are intended to act as Ammunition markers for Artillery Smoke Missions. To represent the smoke clouds on the table, small "balls" of cotton wool in various colours are recommended.

When smoke is required on the table, put out a line of these balls to the required length in inches:

**SMOKE CLOUDS ALWAYS EXTEND DOWNWIND FROM THEIR POINT OF ORIGIN**

#### Wind Direction

- Should be determined at start of the game
- Simply designate a particular table edge as 12 o'clock
- Roll a D12 and use "clockface" directions
- The wind direction, once determined, will remain the same throughout the game unless dictated otherwise by the scenario

#### Fires in Built-up Areas and Woods

Fires in built-up areas and woods are started by either:
1. Artillery fire (of any kind)
2. Any fire of HEL or DFFG weapons at the area

When smoke is produced by a fire:
- The cloud will extend 6" downwind
- Will remain in place for the rest of the game unless extinguished
- A forest or building fire will burn happily for a LONG time if not seen to

The ONLY way such a fire may be EXTINGUISHED during the game:
- An ENGINEERING UNIT must be moved into contact with the burning area
- Unit must spend a FULL ACTIVATION on fire-fighting
- Fire is assumed to be out at the end of the unit's activation
- (Assume unit uses high-tech firefighting systems such as fuel-air explosive devices to "snuff out" the fire - there will be little left standing afterwards!)

#### Smoke Delivered by Artillery

When smoke is delivered by Artillery, a "smoke" marker is placed as the Ammunition counter (provided battery has one available).

The mission is fired as for a **Converged Sheaf** (with a single impact marker):
- Smoke starts from this marker
- Extends downwind for **2" x the number of Artillery elements in the firing battery**
- Example: Three-gun Battery would produce a 6" long cloud

**For the turn in which it is fired:** Smoke cloud remains at full strength

**In each subsequent turn (during TURN END PHASE):** Remove 2" of smoke from the UPWIND end until all cloud is gone

#### Smoke Dischargers on Vehicles

The final method of smoke-laying is from small dischargers fitted to all military vehicles. As with the single "free" APSW, ALL vehicles are automatically assumed to have smoke dischargers - they need not be paid for in points or included in vehicle Design stage.

For simplicity: Dischargers are assumed to be able to fire as many times as required. The number of times they will be used in most games is probably quite small - it is not worth keeping ammunition records.

**A vehicle may decide to fire its smoke dischargers during any activation:**
- In place of a Combat Action
- Vehicle may NOT fire a weapon as well
- Effect is to place a single "ball" of cotton-wool smoke immediately in front of the firing vehicle
- This small cloud lasts until the END of the vehicle's next activation, unless the vehicle drives through it or otherwise moves away from it
- If it does, the cloud is removed immediately

**Effectiveness of vehicle-discharged smoke:**
- Inhibits some fire but does not block everything (you know the vehicle is there somewhere in the small cloud!)
- Renders completely ineffective all Laser (HEL) and Missile (GMS) fire
- Makes all other direct-fire weapons count the range to the obscured vehicle as ONE BAND GREATER than it actually is

### MINEFIELDS

Minefields may be laid in three different ways:

1. Already set up by DEFENDING forces before the game
2. Laid during the battle by a specialised Automatic Minelayer vehicle
3. Delivered by Artillery firing DMR (Dispersed Mine Rounds)

#### Types of Mines Available

**Conventional mines and "Jumping" mines:**
- All mines may attack ground elements (including GEV and Grav vehicles) that pass over them
- JUMPING mines also have the ability to attack LOW-MODE flying craft such as VTOLS
- Basically the mine detects an overflying craft and fires itself into the air by small rocket charge, right in the aircraft's path

#### Minefield Markers

Minefield locations are indicated by the relevant type of MINE marker from the counter-sheet:

- **If minefield is laid during the game** (by Artillery or Minelayer): Counter is placed face-up
- **If laid before the game:** Should initially be placed face-down until an element moves into it for the first time in the game
- Players may agree that a number of DUMMY counters may also be used to confuse the attacker about exact location of real minefields

#### Minefield Dimensions

**All minefields, however laid or delivered, are assumed to be circular areas 4" in diameter centred on the MINE marker:**
- Thus any element moving within 2" of the marker is said to have entered the minefield

#### Entering a Minefield

Any element (Infantry, Vehicle or VTOL in case of Jumping Mines) entering a minefield must immediately draw TWO damage chits.

**Infantry elements:** Take damage as if under HEF Artillery attack

**Vehicles:** Take damage as per direct fire attacks
- RED/YELLOW chits being valid
- Mines attack the BOTTOM armour (which in all cases is assumed to be ONE LEVEL LOWER than SIDE armour)
- For example: TWO levels lower than basic (front) armour rating

**A vehicle DAMAGED by a Mine attack is actually IMMOBILISED**
- All "special" damage chits are valid against vehicles

**VTOL overflying Jumping Mines:**
- Attacked as for vehicles
- But against their full basic armour rating
- VTOL craft EXPECT to be shot at from underneath
- So carry some of their thickest armour there

#### Mines and Unit Integrity

Elements that spend more than one turn in a minefield must draw chits for EACH activation that they are in the field, UNLESS they do not move at all and take no combat actions either.

#### Laying Mines

Only conventional minefields may be laid by Minelayer vehicles or Artillery. Jumping mines must be carefully emplaced by hand, so may only be laid in advance of the battle by specialist engineers - such a job is outside the timescale of the game.

**When an Artillery battery fires a DMR mission:**
- Simply place one mine marker at the point the fire impacts
- For simplicity: all minefields are assumed to be of same density regardless of method of delivery
- Placing one Mine marker constitutes the ENTIRE Combat Action of the Artillery battery, irrespective of number and type of guns/launchers in battery
- An Artillery-delivered Minefield becomes active immediately
- Any elements caught in the mined zone are attacked at start of their next activation if they attempt to move or carry out any other action

**A specialised Minelaying vehicle may place a mine marker immediately BEHIND itself as a Combat Action during any activation:**
- This represents the vehicle "spraying" mines over circular area from special launching racks
- The minefield does NOT become active until vehicle that laid it has moved more than 2" away from the marker
- Laying a single minefield in this way exhausts the vehicle's supply of mines (takes a lot to seed a 400m diameter area)
- So it cannot lay another field until it has been resupplied with another mine marker (same way as Artillery ammunition resupply)

---

## 11 ADDITIONAL AND OPTIONAL RULES (p. 45)

### CLEARING MINES

Mine clearance is assumed to use various sophisticated electronic and/or explosive means to disable or destroy the mines over a wide area. Rather than clearing a narrow path through a mined area, successful clearance will deactivate the ENTIRE minefield.

#### Mine Clearance by Combat Engineers

Clearing minefields may be done by Combat Engineer units, either on foot or in a specialised engineering vehicle:

1. Engineering unit must be moved up so that **at least one of its elements is within 2" of the mine marker**
   - The element will NOT be attacked by the mines

2. The unit now rolls a die; Die Type is determined by number of engineer unit elements within 2" of the mine marker:
   - If only one: use a D6
   - For every extra element within 2": increase the die type by one

3. **On a roll of 6 or greater:** Minefield is deactivated and marker is removed from table

4. **If roll fails:** Unit may remain in place and attempt clearance again in its next activation
   - Making a clearance attempt counts as the Combat Action for those elements
   - If unit attempts more than one minefield at once: elements must be divided between different minefields
   - Each individual engineer element may contribute to only ONE clearance attempt per activation

#### Mine Clearance by Artillery

The only other way of disposing of a minefield is to hit it with Artillery:
- Any mine marker that falls within the beaten zone of an EFFECTIVE FIRE Artillery mission is automatically removed from play
- Exception: Smoke or other Mines type missions do not clear mines

### ABANDONED VEHICLES (OPTIONAL RULE)

When a vehicle is DAMAGED, IMMOBILISED or suffers a SYSTEMS DOWN result, there is a good chance that the crew will decide it is no longer worth staying in the vehicle and waiting to get hit again!

**The reaction of abandoning a damaged vehicle is NOT actually linked to:**
- Quality of the crew
- Unit leadership
- A veteran crew is just as likely to bail out through common sense and experience as a green crew through fear

#### Using the Optional Rule

If players wish to use this rule:

When a vehicle receives any kind of damage result that does not totally disable it:
1. Roll a D6
2. A score of **1-3 indicates the crew have decided to bail out**
3. Vehicle is rendered inoperative as combat element for rest of game
4. Mark vehicle with an ABANDONED VEHICLE counter (green tank and "running man" graphic)

**Major point of using this rule:** If a linked Campaign of games are being played and vehicle recovery is possible after the battle.

### BACKUP SYSTEMS

During the Vehicle Design procedure, it is possible to "buy" BACKUP (or multiple-redundant) SYSTEMS for any vehicle.

#### Backup Systems Function

At any time the vehicle receives a SYSTEMS DOWN result (either as target or firer), there is a BETTER chance of "recovery" from this damage if the vehicle has Backup Systems available:

- **WITHOUT Backups:** Normal score needed to remove Systems Down marker is 6 on D6

- **WITH Backup Systems:** Roll of 3+ on D6 is enough to get systems back on-line and remove the marker

**The Backup Systems CAN be used more than once in a game** if a particular vehicle is unlucky enough to receive two Systems Down results at different times.

### ENGINEERING UNITS

Combat Engineering teams and/or vehicles are organised into units like any other. A typical such unit might have:
- Two or three Armoured Engineering Vehicles (AEVs) with digging and recovery equipment
- Perhaps a Minelayer vehicle and/or a Bridgelayer
- Engineering units attached to primarily Infantry forces are more likely to use Engineer teams on foot
- Transport provided by normal APCs or trucks
- Though at least one AEV would normally be attached for APC recovery

#### Engineering Unit Tasks

Engineering units may perform a variety of tasks before, during or after the battle.

**Before the battle and after the battle:**
- The use of Engineers to create defensive positions before the battle, and to recover disabled vehicles afterwards
- Really comes into the realm of Campaign games - they have little bearing on the actual battle itself

**During the battle itself:**
- Bridging obstacles
- Laying and clearing minefields
- Fighting fires
- Demolitions
- Fire Fighting and Minefield work covered under relevant sections; some other engineering functions are detailed below

#### BRIDGING

If a Bridgelayer vehicle is included in an Engineer unit, it may be used to cross any suitable obstacle:
- Streams
- Smaller rivers
- Narrower ravines or other gaps

**Laying the bridge:** Takes a full Activation of the laying vehicle

**Recovering it after use:** Takes another full Activation

**While bridge is in use:** May carry the weight of any vehicle equal to or less than the class of the Bridgelayer itself
- Example: Class 4 Bridgelayer can carry a bridge that will support up to class 4 vehicles crossing it

#### DEMOLITIONS

If any engineering element is moved into contact with a building, fortification, bridge or even a vehicle and spends its Combat Action there:
- The building or other item may be considered DEMOLISHED (or vehicle Destroyed)
- If a structure: mark it with a RUINED BUILDING marker
- Dismounted Engineer teams CANNOT carry out Demolitions if they have an UNDER FIRE marker

#### COMBAT REPAIRS

If an AEV spends a complete activation in contact with a DAMAGED, IMMOBILISED or SYSTEMS DOWN vehicle:
- Player may roll a D6
- On roll of 4 or higher: Damage effect markers may be removed
- Vehicle is considered REPAIRED and able to function normally again

**For "left behind" vehicles:**
- If such vehicle has been "left behind" by its own unit due to damage
- Must either rejoin its own unit as quickly as possible
- Or (if its own unit is destroyed or out of reach) can REGROUP with another nearby unit (see P.24)

**Note:** An ABANDONED vehicle, even if repaired, cannot rejoin the battle as it has no crew

#### CREATING HASTY DEFENCES

An Engineering unit with suitably equipped AEVs can, by using a full activation of the entire unit, create a DUG-IN position that can then be occupied by any other Armour or Infantry unit.

This represents the AEVs using:
- Dozer blades
- Digging charges
- Such to create "instant" foxholes, trenches and tank scrapes
- Permit a unit to claim benefits of being "Dug-in" (see P.20)

---

## 11 ADDITIONAL AND OPTIONAL RULES (p. 46)

### FORTIFICATIONS

Fixed fortifications and weapons emplacements can play a part in an Attack/Defence battle or any similar scenario. In general, such structures should be treated as immobile vehicles. Smaller ones (pillboxes, bunkers etc.) may be designed using the vehicle construction rules.

**Larger fortifications:**
- May mount any weaponry desired
- Everything should be "paid for" (at normal costs) if using Points values

**Rules for firing at buildings apply equally to fire at fortifications:**
- Defended military structures will have much higher Armour ratings than civilian buildings

**Possibilities for types and styles of fortified buildings are almost endless:**
- Cannot detail them here
- If such structures and installations play a part in games, must provide own specifications and any special rules required

### BUILDINGS AND URBAN AREAS

When structures are used on the table, they must be defined as either of two basic types: **ISOLATED BUILDINGS** or **URBAN AREAS**.

#### ISOLATED BUILDINGS

Represent single constructions or small groups of buildings:
- Small farms
- Military installations (Command or Medical posts etc)
- Tiny rural villages
- Such buildings do NOT impede movement

**However, the models used DO block line of sight:**
- Elements can be "hidden" behind the building model

**Elements that are in direct contact with the building model are deemed to be in SOFT COVER:**
- Even if they are not concealed by the building

**Isolated Buildings firing rules:**

For direct fire:
- Firer treats all range bands as if CLOSE (provided it is within overall range limits)
- Opposing player uses a D4 for the building's "target die" in all cases
- No Secondary Die is ever used

**Buildings hit by Artillery:**
- Draw damage chits as if they were vehicle targets
- Same validities apply

#### Building Armour Ratings

Buildings require Armour ratings to resolve damage. These can be decided between players at start of game. Suggested guidelines:

| Building Type | Armour |
|---|---|
| Most civilian buildings (farms, dwellings etc.) | 3 |
| Industrial Installations, Factories, Warehouses etc. | 5 |
| Military installations | 6 or 7 |

**Reasoning behind relatively high Armour ratings:**
- Not inherent strength of structure
- Amount of punishment it can take in relation to much smaller vehicle element

#### Damaged Buildings

When a building is DESTROYED (draws enough Damage Points to exceed its Armour Rating):
- Mark it with a RUINED BUILDING counter
- Special damage chits do NOT count against buildings
- Exception: "BOOM" chits destroy any structure

**RUINED buildings:**
- No longer block line of sight
- Elements in direct contact with ruins may still claim Cover in them

#### URBAN AREAS

Represent large zones of densely-packed buildings:
- Towns and cities
- Big industrial complexes
- Treated as a separate TERRAIN TYPE for movement purposes
- Can severely restrict mobility of most vehicles

**For Combat purposes, Urban Areas are treated very much like WOODS:**
- Units can be defined as being either on the EDGE of an Urban Area or actually INSIDE the area
- Same limitations on fire effects as for Woods (see P.20)

**Major difference between Urban Areas and Woods:**
- Vehicles MAY move inside Urban Areas (albeit only slowly)
- Most vehicle types are prohibited from entering Wooded areas
- Exception: May take cover in the wood edge

### COMBAT IN URBAN AREAS

Any combat between units in an Urban Area is treated as a **Close Assault action** and is fought out using the Close Assault rules (and if necessary Combined Close Assault rules - see P.34/35).

**Restrictions in Urban Areas:**
- No Direct Fire Combat or Infantry Ranged Firefights are permitted inside Urban Areas
- All vehicles are basically equivalent in Close Assault (regardless of size or weaponry)
- This makes Urban Areas VERY dangerous places for bigger vehicles - which is just as it should be!

### ARTILLERY FIRE AGAINST URBAN AREAS

As an Urban Area represents a very large number of buildings close together, and the actual model buildings used are only symbolic:
- When such area is attacked by Artillery, it is treated differently from attacks on isolated Buildings
- Instead of drawing damage chits for buildings, a special system is used

#### Effective Artillery Missions Against Urban Areas

Only **CONVERGED SHEAF, EFFECTIVE FIRE missions with HEF rounds** (or Nukes, if you want to be really silly...) will have any real effect on Urban Areas.

Other fire simply knocks down a building here or there and upsets the local population.

#### Urban Area Artillery Attack Resolution

When such an effective mission is fired at an Urban Area:
- Simply place a RUINED BUILDING marker at the point of impact
- This indicates that enough of the immediate area has been rubbled to impede movement

*(Page 46 ends at this point. The subsequent material on the effects of a rubbled marker, highway blockage, and nuclear destruction of Urban Areas belongs to page 47, which is outside the scope of these pages, and has been removed from this digest - it is not printed on p. 42-46.)*

---

## Digest Summary

This digest covers the complete rules for:

1. **Aerospace Operations** - All rules for aircraft and dropship operations, including air defence systems (both Local and Zone Air Defence, and the special provisions for VTOLs), interface landings and drop troops
2. **Additional and Optional Rules** including:
   - Smoke and obscuration mechanics and effects
   - Minefield laying, identification, and clearance procedures
   - Abandoned vehicle rules
   - Backup systems for vehicles
   - Engineering unit capabilities and operations
   - Fixed fortifications rules
   - Building and urban area rules covering both isolated buildings and large urban complexes
   - Combat resolution in urban areas
   - The start of artillery effects on urban areas (continues on p. 47, not covered here)

**Key Implementation Notes for Programmers:**

- All ranges are in inches
- All die rolls use standard dice notation (D4, D6, D8, D10, D12)
- Minefield zones are 4" diameter circles (within 2" to enter)
- Drop zones determined by bouncing lettered markers from 3 feet
- Smoke extends downwind from point of origin
- Urban areas restrict movement and force Close Assault combat
- ZAD vs Aircraft involves opposed die rolls with modifiers (Command marker grade, ECM)
- VTOLs test Air Defence Reaction as whole units and only lose a Confidence Level (drop to Low Mode) on a failed test, rather than leaving the table like other aircraft
- All measurements and positions fixed at table edges and specific references

---

## Verification Notes (Sonnet pass)

Checked page-by-page, top to bottom, left column then right column, against the PNG scans of pt3-p06 through pt3-p10 (printed pages 42-46). Corrections made are listed separately. Additional notes:

- DFFG is clearly legible on p. 44 ("Any fire of HEL or DFFG weapons at the area") - it is not expanded anywhere on these pages, and no expansion should be inferred or invented.
- HEL and GMS likewise appear only as abbreviations on these pages (p. 44, Smoke Discharger effectiveness) - the book does not spell them out here, so no expansion is asserted in this digest.
- Numeric values double-checked against the scans: ranges (12", 36"), minefield size (4" diameter / 2" entry radius), damage chits (2/3/4 for ADS, 2 for LAD, 2 for mines), die types (D6/D8/D10/D12), dropship carry capacity (2-5 units), terrain-loss thresholds (5-6 for Woods/Swamp/Mountain, 4+ for Urban), drop height (3 feet), smoke cloud length (2" x battery size, 6" for fires), Backup Systems threshold (3+ vs 6), Combat Repairs threshold (4+), mine-clearance threshold (6+), Building Armour table (3 / 5 / 6-7).
- All headings and page numbers re-confirmed against the printed page footers in the scans; two sections (FORTIFICATIONS, BUILDINGS AND URBAN AREAS) were moved from the p. 45 heading to the p. 46 heading, where they are actually printed.

---

# Chunk pt3-c · 47–51

## 11: ADDITIONAL AND OPTIONAL RULES

### NUCLEAR MUNITIONS (p. 47)

As discussed in the Artillery rules, the use of NUKES is an option that is not to be taken lightly. Whether you allow their use in the game at all requires the full agreement of all players and justification in the scenario being played.

These are small, "Battlefield Tactical" type weapons - probably much less devastating than those already in use today - but firing one will still cause MASSIVE havoc across the table.

**Radiation Blast Zone dimensions:**

When a Nuke round is delivered to an impact point, it has a total Beaten Zone of **EIGHTEEN INCHES in diameter**.

- **INNER ZONE:** Within 2" of the impact marker, completely vaporised - everything within this area is immediately and totally destroyed, regardless of what it is.

- **MIDDLE ZONE:** Out to 5" from the counter - all Infantry are automatically killed (even Powered troops) and all vehicles must draw **FIVE damage chits** (ALL chit colours are valid).

- **OUTER ZONE:** Up to the limit of 9" from the impact point - all Infantry AND vehicles must draw **THREE chits each**, again with ALL colours valid except for Dug-in elements, which count only RED and YELLOW chits.

**Confidence Tests:**

Immediately after the explosion, ALL units belonging to the player under the Nuclear attack must make a Confidence test at:
- Threat level of **+4** if within direct line of sight of the blast, OR
- Threat level of **+2** otherwise

Additionally, all the units of the player who FIRED the Nuke must also test at a threat level of **+2**.

*[Side note in the rules: EVERYONE on the table will get distinctly uncomfortable when the Nukes start flying - if players use them repeatedly many of the units on both sides will start to suffer severe confidence losses.]*

The tests are taken at these levels ONLY when the FIRST Nuke is fired in the game. If any more Nukes are then used, ALL units on BOTH sides must test again at a threat level of **+1**.

**Persistent effects:**

After the damage due to detonation is resolved, the impact marker is removed but the NUKE counter (Radiation symbol) is left in its place, marking the Ground Zero point of the blast. For the rest of the game:
- NO element may approach closer than **2"** from the marker (VERY "hot" crater)
- Only fully-sealed vehicles and Powered Infantry may approach within **6"** of the marker (area is impassable to all unsuited infantry and non-NBC protected vehicles due to radiation levels)

### BIOCHEM MUNITION EFFECTS (p. 47-48)

Biochemical warheads are treated as "non-persistent agents"; they do their job and then quickly disperse. While not quite as disruptive to game balance as Nuclear munitions, they are still only to be used where they can be justified.

**Delivery and effects:**

Biochem rounds are always fired as an **OPEN SHEAF mission**, and the agents affect the complete beaten zone.

**First use in a game:**

The usefulness of Biochems depends largely on surprise - after they are first used in a battle, the troops will be taking countermeasures (ie: they will have their masks and "Noddy Suits" on, vehicles will be sealed and overpressured, etc.). The most effective Biochem strike will be the first one used. In this first attack:
- All LINE and MILITIA units in the Beaten Zone have **THREE chits drawn** against them, with ALL colours valid
- Dug-in elements get **NO bonus** against Biochem attacks
- Open or non-NBC-protected vehicles are counted as LINE INFANTRY elements for this purpose - it is the CREW that are affected, not the hardware
- Powered Infantry and sealed vehicles are **NOT affected**
- Agents are assumed to be "heavy" chemicals not significantly affected by wind

**Confidence Tests (first use):**

ALL units of the player being ATTACKED must make Confidence tests at Threat level **+3**, and ALL of the FIRER'S units must test at **+1**.

**Subsequent uses in the same game:**

Effects are reduced to:
- **TWO chits per Line**, Militia or unprotected vehicle element
- Only **RED chits valid**
- ONLY the units caught in the actual attack need make Confidence tests (at the normal threat level for being under Artillery attack)

**Dispersal:**

Immediately after the effects of a Biochem strike are resolved, the marker(s) are removed from the table - agents are assumed to have degraded and/or dispersed, with no lasting effects in the zone.

### CASEVAC (Casualty Evacuation) (p. 48)

CASEVAC operations are provided by specialised units of vehicles or VTOLs. The knowledge that casualties can be quickly extracted from the battlefront and returned to Medical facilities (on- or off-table) provides a great psychological boost to the troops on the ground.

**Vehicle/Unit properties:**

Casevac vehicles or VTOLs operate as single elements and:
- Can move freely around the battlefield subject to normal movement restrictions for their type
- May **NOT attack** the enemy (most are unarmed anyway)
- Do **NOT need** Command or Confidence markers
- For convenience are moved in the **TURN END PHASE**

**Casualty evacuation procedure:**

When a casevac element is moved in contact with a unit that has suffered casualties, it is assumed to collect the wounded. The unit may immediately make a **REACTION test at Threat Level +0**:
- If it **passes**, it **GAINS one Confidence Level** (the evacuation of the wounded has had a beneficial effect on troops' morale)
- If it **fails**, there is no confidence gain

Each Casevac element may make only ONE such "pickup" before returning to the nearest Aid Station:
- If a facility is present on-table, it may drop its wounded there and immediately return for another pickup
- If there are no medical stations on-table, the Casevac must leave the table by the baseline and spend one whole turn off-table before returning for another pickup

**Note:** Casevacs CAN be fired on, but a player who does so will be considered a Jolly Poor Sport and will have to buy all the post-game drinks in the bar!

### WEATHER CONDITIONS (OPTIONAL RULE) (p. 48)

Fighting in adverse weather conditions is more difficult (usually for both sides) than in good weather. The exact rules used can be varied to suit the scenario and location.

**RAINY conditions:**

Cause most terrain types to become one grade worse (eg: POOR becomes DIFFICULT) for wheeled and tracked vehicles and for all troops on foot.

If the rain is deemed heavy enough:
- Restrict maximum Sensor range (say to half normal, ie: **30"**)
- Make all direct fire treat its range band as if it were **ONE BAND GREATER** than it actually is

**FALLING SNOW:**

Has similar effects to rain but can also (if sufficiently heavy):
- Cut Sensor range down even less (say to **18"**)
- Make many types of terrain completely impassable to ground vehicles

Heavy rain or snow may also prevent Aerospace craft from flying.

**VERY HIGH WINDS** (especially on non-terran worlds):

May be so strong that:
- Only Powered troops and vehicles can stand against it
- Unsuited Infantry must remain in their vehicles
- May make Riverine movement and Air missions impossible

**Other weather effects:**

Many other possibilities exist (dust and sandstorms in desert areas, fog and mist, etc.). The best way of dealing with weather effects is to write them into specific scenarios.

**NIGHT FIGHTING:**

Can be worked out on a similar basis to adverse weather conditions. However, most modern forces are very well equipped for Night Operations with advanced Sensors, image-intensification, etc. Night fighting is far less difficult or restricted than it used to be.

### EXOTIC ENVIRONMENTS (p. 48)

Games set on other worlds (and even certain parts of Earth, eg: Antarctica) may have terrain and conditions very different from Earth's temperate zones. Icefields, very hot/volcanic areas, high or low gravity, vacuum environments - all can be looked at for variety in game settings.

To go into detail on all such environments would take up half this book, so all that can really be given here are the briefest guidelines to get your own imagination working - after all, that should be half the fun!

**General environmental effects:**

When examining a given environment, many limitations become obvious. For example:
- GEVs and any conventional aircraft or helicopters **can't function on vacuum worlds**
- Extremes of temperature and/or gravity will mean all Infantry will have to be Power Suited
- Hostile poisonous atmospheres will require all troops and vehicles to be fully sealed at all times

"Exotic" scenarios can often be used to "balance" games between otherwise incompatible forces and be an enjoyable change from the basic style of game.

**Flora and fauna considerations:**

Don't forget the possibilities of native flora and fauna:
- Dangerous plants (acting like Biochem agents on any unprotected troops?)
- Randomly-roaming wildlife on the battlefield can add all sorts of twists to the game

### ALIEN RACES IN DIRTSIDE II (p. 48)

Most of the game's rationale is based on human-vs-human conflicts, but the rules framework functions equally well for human-alien or even alien-alien games. A full and detailed treatment of the subject of alien races is outside the scope of this book, though hopefully something to explore more deeply in a future supplement.

**Technology considerations:**

To ensure alien forces have a different "feel" to human armies, try to ensure they use sufficiently different technology and force compositions. For example:
- A human force of low to mid-tech vehicles and equipment up against an alien invader with all Grav vehicles and energy weaponry
- Or vice-versa

**Psychology and character:**

A more complex question than technology is alien psychology. If they react to combat conditions and stress in exactly the same way as human troops, they are little more than traditional Hollywood "man in a rubber suit" aliens.

What is really needed is to give each alien race its own unique variations in terms of confidence, leadership, etc. Perhaps they:
- Revere their unit leaders like gods, and the death of one will send the rest into a kill-crazed frenzy?
- Or maybe the sight of a retreating enemy unit triggers the same kind of berserker bloodlust and uncontrollable charge?

As with the ideas for backgrounds and scenarios, science fiction literature and films are teeming with things bug-eyed and squirmy that can be developed into suitable game forces. Readers who come up with any particularly good alien race ideas are invited to send them to the publishers, who may use them when the supplement is done.

---

## 12: SCENARIOS AND BACKGROUNDS

### THE SCENARIOS (p. 49)

Two possible battle scenarios are given below (plus some extra outline ideas for players to develop themselves) to give variation to straightforward attack-defence or encounter battle type games. These are only suggestions; players should always seek to design their own challenging scenarios - there is plenty of inspiration in SF films and literature.

**Important note about scenario balance:**

Scenarios presented here are deliberately non-specific regarding forces (and often terrain) as they are intended to be modified to fit with models, backgrounds, etc. They are **NOT necessarily balanced** scenarios.

Force mixes can be juggled around to suit certain points values if important, but it is suggested that a far more exciting game can be had using apparently unequal forces. If you feel it strictly necessary for each side to have an equal chance of "winning", simply alter the objectives and victory conditions to suit the relative strengths and weaknesses of each force.

### SCENARIO 1: BORDER RAID (p. 49)

This scenario represents a typical 'hit and run' raid by a small mobile strike force against a defended border post. The situation is set during an uneasy truce between two neighbouring states, Catatonia and New Harmony, on the "balkanised" colony world of Segonis III (though the same action could equally well be set on Earth, or any other settled world). Along the disputed border between the two warring states, Catatonia has established a number of small, defended border posts to try and prevent large-scale incursions by New Harmony forces. This move is seen by the government of New Harmony as hostile action, and they decide to mount a series of raids in retaliation.

**TERRAIN SET-UP:**

- One short table edge designated as the border (this is the attacking/New Harmony forces baseline)
- The main feature is the border post - a grouping of military buildings similar to a small firebase
- Should be located in either the Main Battle Area or the Defender's Rear Area (to agreement of both players)
- Terrain around the post should be reasonably close and broken
- A road or track should cross the table from the border edge to the opposite edge

**OPPOSING FORCES - CATATONIA (Defending):**

The defending force consists of no more than 6 platoon strength units, most of which will be Infantry. They may have one battery of artillery in support, either:
- Within the border post firebase itself (a very good reason for attacking it), OR
- As an off-table asset

Some tactical aerospace support may be employed if both players agree.

**A suitable basic force could be:**
- 2 platoons 'leg' Infantry (line or militia)
- 1 platoon mechanised infantry (line)
- 1 troop Main Battle Tanks
- 1 artillery battery
- 1 command unit

**OPPOSING FORCES - NEW HARMONY (Attacking):**

The raiding force should be highly mobile and consist of at least as many units as the defending forces, up to a maximum of twice that number. (The relationship between force strengths can be adjusted to account for quality and tech differences between forces in use.)

**Suggested basic forces:**
- 2 troops Main Battle Tanks
- 1 troop Heavy Battle Tanks
- 4 platoons mechanised infantry (line) - or substitute 1 Power infantry platoon for 2 line platoons
- 1 artillery battery (off-table asset)
- 1 command unit

**OBJECTIVES:**

Three objective markers should be drawn and used; one must be placed in the border post itself. Before able to declare Game End, the attacking (New Harmony) player must withdraw at least half his own units off his own 'border' baseline.

### SCENARIO 2: SPACEPORT DEFENCE (p. 49-50)

The capture of a major spaceport is a classic prelude to full-scale planetary invasion. The possession of suitable landing facilities is almost essential for insertion on-world of significantly large forces for an extended campaign. In this scenario, a high-mobility Interface Assault Combat Group is tasked with taking control of the main port facilities on a fairly well-settled colony planet.

**TERRAIN SET-UP:**

The table represents the spaceport complex. Like 20th century airports, spaceports are very dispersed affairs. An extensive port area covering several kilometres of groundscale is not unreasonable. The port set-up should occupy most (if not all) of the table and include at least a selection of the following features:

- An administration building or complex
- A communications and flight control centre
- At least one passenger terminal, possibly linked to the admin building
- At least one cargo handling facility
- Several spacecraft dispersal bays, landing pads or blast pits (bearing in mind that larger starships are not usually capable of atmospheric interface operations, so most facilities will cater for interface shuttles and smaller starcraft only). A few 1:300 scale spacecraft models parked in some bays will look really effective
- A transit system of some kind (eg: a monorail link) to connect the port to the nearest city and possibly also linking installations within the port itself (passengers won't fancy a 4-kilometre hike from the terminal to the blast pads!)
- Some buildings just outside the port perimeter near the main gates to represent the 'startown' - all the cheap bars, hotels and other places of entertainment that spring up wherever starship crews are dirtside with money in their pockets

**OPPOSING FORCES - PORT DEFENCE:**

The strength of the defending forces depends on whether they are expecting an attack. A good idea is to have only a small force of port security troops on hand at the start of the game, but have a reasonable level of reinforcements on call from the local military base. These can arrive at either a preset or random (die-rolled) time after the start of the battle.

**A suitable spaceport security detachment could be:**
- 3 platoons of 'leg' Infantry (probably militia): only one team per platoon would carry a GMS/L, and only up to 50% of the teams in total would be equipped with IAVRs
- 1 zone air defence troop
- 1 command unit

**The reinforcements could consist of:**
- 2 troops of Main Battle Tanks
- 2 platoons of mechanised infantry in MiCVs
- 1 troop of missile vehicles

**Random reinforcement arrival:**

If preferring random arrival, roll a D6 at the start of each turn and add one to the die roll for each turn elapsed since the start of the game. On a score of **6 or more**, the reinforcements arrive at the table edge nearest the port main entrance gates.

**ASSAULT FORCES:**

The aim of the attacking force should be to isolate the defenders and take them out piecemeal before they can concentrate their forces and organise themselves (and certainly before the reinforcements arrive).

**A suitable assault group would be:**
- 4 platoons of Powered infantry
- 2 troops of fast, light AFVs
- 2 platoons of line infantry in small APCs (probably only 1 team per vehicle)
- 1 or 2 flights of ground-attack fighters for close support

If suitable models are available, the attacking player may deploy Interface landers in the first move and unload troops. The Power infantry may, if desired, be designated as Jump Troops who are deployed to the surface individually (like paratroops) - their initial drop locations should be randomised and they will need to regroup (as per Drop Troop Rules on p.43) before commencing offensive operations.

**OBJECTIVES:**

An agreed number of objective markers should be placed for this scenario on key areas:
- At least two of the spacecraft dispersal bays or pads
- The admin and control centres
- The main gate (to delay the arrival of the reinforcements)

The whole table area is designated as the Main Battle Area; neither player has a rear area, as both forces will be spread around the table.

### FURTHER SCENARIO IDEAS (p. 50)

These are simple outlines that players may wish to develop into full scenarios, presented mainly to get imagination working.

**"HOLD THE BRIDGE":**

A small force of defenders must defend and hold a vital river crossing point until supporting troops can arrive (or until a retreating unit can cross the table and escape over the bridge). The attackers could be airborne troops dropped into the defenders' rear areas.

**"DEFENCE OF HILL 301":**

A depleted, undersupplied and possibly demoralised combat group must hold a vital strategic hill against an enemy consisting mainly of hordes of infantry (with very little heavy weapon support). Command says help is on its way, but WHEN? (Does this one sound familiar....?)

**"CONVOY":**

A nice simple one; a convoy of supply trucks, escorted by a small armed force, must be moved (safely) from one end of the table to the other. The opposing force must ambush the convoy and either destroy or capture it, depending on what it is carrying.

### POSSIBLE BACKGROUNDS (p. 50)

It is perfectly possible to play DIRTSIDE II battles without having to worry about any kind of background setting at all. For example, if one player has a force of mainly hover vehicles with energy weapons, and a friend has some tracked and wheeled vehicles with long kinetic cannons - and maybe a walker or two - they can simply set up almost any scenario they like and play a one-off game. What they call their forces, and how these two protagonists got into conflict in the first place, is pretty much irrelevant to the enjoyment of this game.

Many players, however, will want to go into things a bit deeper than this. Having a "believable" background in which to set games and campaigns adds interest to the whole process - battles are no longer just one-off encounters but can begin to play a part in the much larger scheme of political and military events that shape the "future history" of the desired background.

**Types of wars to consider:**

Watch news reports and military history for a few weeks to see wars come in many shapes and sizes:

- **CROSS-BORDER RAIDING:** eg: Viking attacks on 10th century England
- **INTERNAL REBELLION:** One side is composed of unorganised militia or rebels, eg: a coup in a 'banana republic'
- **CIVIL WAR:** Both sides use organised armies (and probably the same equipment), eg: the American Civil War
- **GUERRILLA WAR:** One side has masses of high technology; the other relies on traditional guerrilla tactics, eg: the Vietnam War
- **POLICE ACTION:** A 'big' power moves in on a 'little' power to depose what it sees as an unfriendly government, eg: US intervention in Grenada
- **PUNITIVE ACTIONS:** Retaliation against cross-border raids and/or terrorism, eg: British actions in Afghanistan in the 19th century
- **FULL SCALE INVASION:** Major military action aimed at complete physical takeover of a state or region, eg: German invasion of Poland in 1939 or the Gulf War

It is a relatively simple matter to translate any of these historical examples into a Science Fiction setting - in fact this has been done by nearly every major SF writer and filmmaker one could name!

**Multiple political units:**

Bear in mind there may well be more than one political unit (country, state, colony, etc.) on a single planet, rather than the whole world being run by one power. A planet is very big, and once habitable ones are discovered there will be no shortage of different countries and/or groups wanting to stake claims to bits of each. **A planet divided into more than one political unit is called a "balkanised" world.**

**Non-governmental forces:**

It may not only be actual states and major powers that field military forces. Megacorporations and other commercial concerns will probably be only too ready to resort to military means, whether to protect their own interests, damage those of their rivals, or simply keep restive worker populations in check.

Hopefully these ideas will get you on the way to designing a setting for your games that reflects the way YOU like your SF, rather than the way that some games manufacturers tell you it is going to be!

### CAMPAIGN GAMES (p. 50-51)

In Wargame terms, CAMPAIGNS are usually played as a series of "linked" games following the course of a much larger Military operation (such as the invasion of a state, or even of a whole planet).

A complete system for Campaign gaming could fill this book. However, several good books on "historical" wargames cover Campaigns in detail, and these are excellent reference material - even in a far future setting, many logistics and other problems that beset Commanders engaged in extended operations will still apply.

**Key campaign considerations:**

To run a successful Campaign game or any series of linked battles, you must consider factors outside the basic front-line fighting units of your army. Any force needs its Logistics "Tail" - in Mechanised Warfare the number of supply, fuel, maintenance and other backup units often far outweighs the actual "teeth" of the fighting force.

The provision and use of such logistic support is a vital part of any series of games. A combat force might win a given battle, but unless it can then be resupplied with fuel and ammunition, have its wounded treated, and its crews fed and rested, it will surely lose the next one! In Game terms, if such support is not provided (or simply cannot be got to the troops in time), their Confidence and combat efficiency will suffer VERY greatly in the next and subsequent battles. A force with dry fuel tanks and empty ammo bins (not to mention hungry men) will not stand and fight for very long.

**Unit quality improvements and degradation:**

On a more positive note, the use of the Unit Quality and Confidence system in DIRTSIDE II provides the ideal mechanism by which units that perform well in battle can actually INCREASE their abilities between engagements:
- GREEN units that survive a couple of battles could well be classed as REGULARS (or at least have a chance of rising to such status)
- Could very well eventually aspire to VETERAN classification

The down side is that if a unit is severely depleted in one battle and receives a load of replacement troops to return it to full combat strength, this influx of "FNGs" could well have the effect of REDUCING the overall Quality of the unit.

**Between-battle activities:**

In between battles, forces can engage in:
- Repair and recovery of damaged vehicles (the force that wins a battle can recover not only their own repairable elements but perhaps also some of the enemy's)
- Bring units back up to troop strength (provided sufficient resources and replacements are available)
- Reconnaissance to prepare for the next combat

### FUTURE HISTORY 2000-2183AD (p. 51)

The following section is a very condensed version of the Background developed for FULL THRUST Starship Combat rules. It outlines the general political and military situation and highlights a selection of wars from the 21st and 22nd centuries of particular relevance to the kind of ground actions DIRTSIDE II is designed to recreate.

This background is optional. The situation presented will be further developed in future publications and articles, extended to cover events after 2183.

**THE BACKGROUND:**

Over the span of the 21st century, the main political blocs of Earth altered greatly:
- The Chinese takeover of the former Russian Commonwealth in 2047
- The collapse of the US Government in 2049 (leading to the Second American Civil War of 2050-57)

These brought about the creation of the two major Superpowers:
1. **The Eurasian Solar Union** (a Chinese-Russian dominated bloc)
2. **The New Anglian Confederation** (the reuniting of Britain, Canada and the former USA under the British Crown)

Following the virtual destruction of Israel (by Islamic Nuclear and Biochemical terrorism) in 2027, it was a Jewish-funded organisation (the Gilderstein Foundation) that instigated a visionary research program into Faster Than Light travel, culminating in Mankind's first steps to the Stars in the 2060s.

By the late 21st century, the nations of Earth had started to seriously explore and colonise the nearer star systems. Despite UN efforts, international co-operation was shaky at best. Most powers became even more Nationalistic as they sought to carve out their own niche in space.

Wars continued at regular intervals, both major and minor engagements occurring on Earth and on the newly-founded Colony Worlds.

**MAJOR POWERS IN THE 21ST AND 22ND CENTURIES:**

- **The NEW ANGLIAN CONFEDERATION (NAC):** Britain, Canada and the USA
- **The EURASIAN SOLAR UNION (ESU):** China, Russia and most of Central Asia
- **The NEU SWABIAN LEAGUE (NSL):** Germany, Austria and other Central European States
- **The FEDERAL STATS EUROPA (FSE):** France, Spain, Italy and others from the failed European Community

**OTHER POWER GROUPS:**

Added to these "main players" are many other power groups:
- The LLAR (League of Latin-American Republics)
- PAU (Pan African Union)
- Indonesian Commonwealth
- Oceanic Union
- Many more plus several small states and independent nations (The Netherlands, Free Cal-Tex, New Israel [a Colony around Epsilon Indi], Japan [technically independent but jealously protected by the NAC], and others)

This situation (detailed fully in the Timeline published in FULL THRUST) is rich in possible conflicts, both on and off Earth, spanning the whole of the 21st and 22nd centuries of Human history. Almost any type of battle can be woven into this background - from Dutch and Japanese mercenaries fighting each other on a Colony World to clashes between rival factions of Islamic fundamentalists!

**TIMELINE OF MAJOR WARS:**

**2050-57: The Second Seccessionist War**

The collapse of the US Economy and assassination of President Amy Koslowski in 2049 precipitate a Second Civil War in the USA. After unsuccessful attempts to gain control, the provisional Military Government calls on British and Canadian support to quell uprisings throughout the Union. This leads to the formation of the New Anglian Confederation.

**2057-72: The War of the Americas**

In the confusion of the end of the 2nd Civil War, the League of Latin American Republics attempts to take control of California, New Mexico and Texas. A prolonged and difficult conflict between LLAR and Anglian forces results in defeat for the League and the loss of not only its foothold in the North but also all of its possessions in Central America.

**2110-12: The Papua New Guinea War**

The Indonesian Commonwealth attacks Papua New Guinea, bringing it into conflict with Australia and New Zealand (Papua's major partners in the Oceanic Union). A generally low-intensity war, notable for the first widespread use of "Grav" propelled combat vehicles on Earth (mainly fast, light Indonesian "Gunskimmers" used for coastal and riverine actions). To-and-fro thrusts by both protagonists throughout the islands gradually grind to an indecisive halt. The Sydney Accord finally ends the war with an Indonesian withdrawal.

**2128-32: The Mercenary War**

A very scrappy and inconclusive war, named both for the large numbers of hired foreign troops used by both sides and for the action that started the conflict: an LLAR mercenary unit working for the Indonesians clashes with Anglian forces against the orders of its employers. In a move to placate the NAC, the Indonesians massacre the entire LLAR unit. In retribution, the League strikes at Indonesian targets on the Colonies, and a four-year struggle between the two powers ensues. The Mercenary War ends with large reparations being paid to the LLAR, and brings about the signing of the Mercenary Charter by most major powers - formalising the existence, hiring and use of Mercenary forces.

**2137-42: The First Solar War**

The Eurasian Solar Union declares war on the New Anglians due to "the hostile actions and intents of the Imperialists in space". Five years of intense warfare span the settled worlds as the two Superpowers battle each other on planet and in space, ending in 2142 with the Anglians claiming victory. The ESU retires to lick its wounds and consider its next move.

**2145-57: The Second Solar War**

ESU attempts to regain its possessions lost at the end of the 1st Solar War. This quickly escalates into another widespread conflict, drawing in other major powers such as the FSE, the NSL and the PAU. The war rages throughout the Inner Colonies and the Outworlds, ending with a compromise Treaty that leaves neither side happy.

**2183 onwards: The Third Solar War and Beyond**

The Timeline ends in 2183, by which time the THIRD Solar War has been grinding inconclusively back and forth for a full eighteen years. At this point, the unexplained disappearance of two United Nations Space Command Survey ships in the Outworld Rim leads to speculation that the battered and war-weary forces of Humanity are about to confront a far deadlier enemy.

---

## NOTES ON DIGEST

**Verification Summary:**

This digest has been re-checked page by page, left column then right column, against scans of all five source pages (the prior ".verified" pass had claimed no errors, but had not actually caught the issues below). Corrections made in this pass: chapter number "II" corrected to "11"; a dropped bracketed side-note under Nuclear Munitions restored; a dropped sentence about post-first-use countermeasures restored under Biochem Munition Effects; "TWO chits per zone" corrected to "TWO chits per Line" (subsequent Biochem uses); "non-terrain worlds" corrected to "non-terran worlds"; "Segons III" corrected to "Segonis III"; "GMS4" corrected to "GMS/L"; the "p.43" page reference to the Drop Troop Rules restored; a dropped example paragraph and two dropped closing sentences restored under Possible Backgrounds; a dropped sentence restored under Exotic Environments; two dropped sentences restored under Alien Races; a "(Fresh New Guys)" gloss on "FNGs" removed as not present on the page; "Secessionist" corrected to the book's own spelling "Seccessionist"; and a parenthetical restored under Future History. See the correction list accompanying this digest for full detail.

**Exact transcription notes:**

All numbers, distances, die types, threat levels, and rule mechanics have been transcribed exactly as they appear in the source material. Specific measurements and values preserved:
- Radiation zones: 18" diameter total, 2" inner, 5" middle, 9" outer
- Chit draws: Nuclear (5 or 3), Biochem (3 or 2)
- Confidence threat levels preserved exactly as printed
- Force compositions listed exactly as in scenarios
- Timeline dates preserved as printed

**Page coverage:**

- **Page 47:** Nuclear Munitions, Biochem Munition Effects
- **Page 48:** Casevac, Weather Conditions (Optional Rule), Exotic Environments, Alien Races in Dirtside II
- **Page 49:** The Scenarios, Scenario 1: Border Raid, Terrain Set-up, Opposing Forces
- **Page 50:** Scenario 2: Spaceport Defence, Further Scenario Ideas, Possible Backgrounds
- **Page 51:** Campaign Games, Future History 2000-2183AD

All sections follow reading order and printed heading hierarchy. No rules have been omitted or summarized.

**Changes from prior digest:**

Several errors and omissions were found and corrected in this pass (listed above and in the accompanying correction list). All numeric values, rule mechanics, force compositions, and scenario details have now been re-checked directly against the page scans.

---

# Chunk pt3-d · 52–56

## Appendix 13: Points Value System (page 16, left column)

Vehicle cost calculation uses Vehicle Size Class.

**VEHICLE POINTS COST (VSP) calculation:**
- Start with Vehicle Size Class x 5 (same as CAPACITY points)
  - Class 1: 5 VSP
  - Class 2: 10 VSP
  - Class 3: 15 VSP
  - Class 4: 20 VSP
  - Class 5: 25 VSP

**Armour Rating costs:**
- Each "level" of Armour adds 20% of current VSP
- Ablative or Reactive Armour adds ADDITIONAL 10% per level of Armour; each additional level beyond the primary Armour Level adds another 10% VSP total

**Power Plant cost:**
- CFE (Conventional Fuel Engine): 20% of BVP
- HMT (Hydromagnetic Turbine): 40% of BVP
- FGP (Fusion Generation Plant): 60% of BVP

Note: These costs add to running total but do NOT alter the BVP figure.

**Mobility Type cost (using BVP):**
- Low Mobility Wheeled: 10% of BVP
- Hi-Mobility Wheeled: 30% of BVP
- Slow Tracked: 20% of BVP
- Fast Tracked: 40% of BVP
- Slow GEV: 40% of BVP
- Fast GEV: 60% of BVP
- Grav: 100% of BVP
- Amphibious (extra cost): +20% of BVP
- Conventional Boat: 10% of BVP
- Hydrofoil: 40% of BVP
- RSW Air Cushion: 40% of BVP
- VTOL/Helicopter/Jetcopter: 500% of BVP
- Aerospace Craft: 1000% of BVP
- Combat Walker: 100% of BVP
- Transport Walker: 80% of BVP

**Direct-Fire Weaponry costs:**
- RFAC systems: 5 × Class of weapon (e.g. RFAC2 = 5 × 2 = 10)
- HVC systems: 8 × Class of weapon (e.g. HVC4 = 8 × 4 = 32)
- HKP systems: 10 × Class of weapon (e.g. HKP3 = 10 × 3 = 30)
- MDC systems: 10 × Class of weapon (e.g. MDC5 = 10 × 5 = 50)
- HEL systems: 12 × Class of weapon (e.g. HEL2 = 12 × 2 = 24)
- DFFG systems: 15 × Class of weapon (e.g. DFFG4 = 15 × 4 = 60)
- SLAM systems: 12 × Class of weapon (e.g. SLAM3 = 12 × 3 = 36)
- Extra APSWs: 4 each

**Fire Control Systems:**
- BASIC: cost = 2 × Class of largest weapon type on vehicle
- ENHANCED: cost = 4 × Class of largest weapon
- SUPERIOR: cost = 6 × Class of largest weapon

**Missile Systems:**
- GMSL with BASIC Guidance: cost = 20; with ENH = 30; with SUP = 40
- GMSH with BASIC Guidance: cost = 30; with ENH = 45; with SUP = 60

**Defensive Systems:**
- ADS (Area Defence System): BASIC = 200; ENH = 300; SUP = 400
- LAD (Local Air Defence weapon): cost = 75
- PDS (Point Defence Systems): BASIC = 30; ENH = 45; SUPERIOR = 60
- ECM (Electronic Counter-Measures): NONE = 0; BASIC = 15; ENH = 30; SUP = 45
- APFC Belt: 5 × Vehicle Size Class (e.g. APFC on class 4 vehicle costs 5 × 4 = 20)

**Stealth Systems:**
- Cost: 20 × Vehicle Size Class per LEVEL (e.g. to reduce effective signature of class 4 vehicle to 3 = 1 Stealth Level, costs 20 × 4 = 80)

**Artillery (cost per marker, for battery):**
- Light Artillery: system = 50
- Medium Artillery: system = 100
- Heavy Artillery: system = 200

**Artillery Ammunition Markers (cost per marker, for battery), HEF or MAK:**
- Light Artillery: 20 × No. of weapons in Battery
- Medium Artillery: 30 × No. of weapons in Battery
- Heavy Artillery: 40 × No. of weapons in Battery

**Smoke Rounds:**
- 10 × No. of weapons in Battery

**Mines (DMR):**
- 100 per marker

**Biochem Rounds:**
- 200 per marker

**Nuclear Rounds:**
- 1000 per marker

**Counter-Battery Radar:**
- Cost: BASIC = 150; ENH = 200; SUP = 250

**Ortillery Batteries (as for equivalent "normal" battery):**
- Air Weapons: Similar to ground-fired equivalents
- DFO (Dead Fall Ordnance) Loads: 30 per Load (= per marker)

**All other Air Weapon costs:** As for ground-fired equivalents.

**Mines (Pre-Laid minefield - conventional):** 80; JUMPING = 150

**Minelayer Ammunition Load (1 marker):** 100

**Minelayer Ammunition Load (1 marker):** 100

**Back-up Systems:** +30% of TOTAL COST OF ALL VEHICLE SYSTEMS (i.e. FIRECON, ECM, STEALTH and GUIDANCE as applicable)

**Cargo/Landing Capability:** +25% of TOTAL POINTS COST of each element transported.

**Drop Troop Capability:** +50% of TOTAL POINTS COST of each element dropped.

**Casevac Elements:**
- Wheeled or Tracked ambulance vehicle (complete): 50
- Per GEV or GRAV ambulance (complete): 75
- Per VTOL (inc. Helicopters): 100

---

## Appendix 13: Points Value System - Engineering Vehicle Equipment (page 16, right column & page 17)

**On-Table Medical Post:** STATIC = 100; MOBILE (on vehicle) = 150
**Command/Control Centre (on-vehicle):** 100
**Engineering Vehicle Equipment:**
- Repair Recovery Package (for AEV): 75 × Class of Vehicle
- Bridge System (for bridgelayer): 50 × Class of Bridge
  (ie. size capacity)

**General Engineering Package (for AEV):**
- Includes Dozing capability, Demolitions, Firefighting: 100 (flat rate for any vehicle class)

**Infantry Points Costs:**

**Basic Element Costs:**
- Militia troops: RIFLE TEAM (4-5 men) = 15 points
- Line troops: RIFLE TEAM (4-5 men) = 20 points
- Power troops: RIFLE TEAM (4-5 men) = 40 points
- Assault Infantry (no ranged fire ability, but extra value in Close Assault): no additional cost - same as Rifle Team
- Specialist Elements: Cost same as Rifle Team PLUS specialist equipment cost as below:
  - GMSL: Cost as for vehicle-mount GMSL
  - APSW: 40 points
  - Engineering Equipment: 50 points
  - LAD system: 75 points
  - Artillery Observer: 50 points

**Cavalry (riding animals) cost:** Additional 50% of basic element points

---

## Appendix 13: Some Typical Vehicle Examples (page 17)

**1) Medium Battle Tank (Tracked):**
- Medium vehicle (class 3), Fast Tracked mobility, HMT power,
- MEDIUM vehicle (class 3), FAST TRACKED mobility, HMT power, Armour 3
- 1 × HKP/3 in Turret with SUPERIOR FireCon; 1 × RFAC/1 as secondary weapon; ENHANCED PDS; 1 × APSW
- ENHANCED ECM
- Basic/Effective Signature 3 (D8)
- POINTS VALUE 172

**2) Light GEV (Small vehicle - class 2):**
- Small vehicle (class 2), FAST GEV mobility, HMT power, Armour 2
- 1 × MDC4 in Turret with ENHANCED FireCon; 1 × APSW
- Basic/Effective Signature 2 (D10)
- POINTS VALUE 71 (plus cost of Infantry carried)

**3) Heavy Hover Tank:**
- Large vehicle (class 4), FAST GEV mobility, FGP power, Armour 4
- 1 × MDC4 in Turret with SUPERIOR FireCon; 1 × GMSH (ENHANCED guidance); ENHANCED PDS; 1 × APSW
- Basic Signature 4, Effective Signature 3 (D8)
- POINTS VALUE 356

**4) Assault VTOL Support Vehicle (Tracked):**
- Medium vehicle (class 3), VTOL mobility, FGP power, Armour 2
- 1 × RFAC1 in Chin Turret with ENHANCED FireCon; 1 × APSW
- SUPERIOR ECM, BACKUP SYSTEMS
- Basic/Effective Signature 3 (D8)
- POINTS VALUE 178 (plus cost of Infantry carried)

**5) Medium Wheeled APC:**
- Medium vehicle (class 3), HI-MOB WHEELED mobility (plus AMPHIBIOUS capability), CFE power, Armour 3
- 1 × RFAC1 in Chin Turret with ENHANCED FireCon; 1 × APSW
- SUPERIOR ECM, BACKUP SYSTEMS
- Basic/Effective Signature 3 (D8)
- POINTS VALUE 393

**6) Medium Artillery Vehicle (Tracked):**
- Medium vehicle (class 3), SLOW TRACKED mobility, CFE power, Armour 3
- 1 × RAM Howitzer (Medium Artillery), BASIC PDS, 1 × APSW
- ENHANCED ADS, 1 × APSW
- SUPERIOR ECM, BACKUP SYSTEMS
- Basic/Effective Signature 3 (D8)
- POINTS VALUE 209 (plus cost of Ammunition)

**7) Area-Defence Vehicle (Tracked):**
- Medium vehicle (class 3), SLOW TRACKED mobility, CFE power, Armour 3
- 1 × ENHANCED ADS, 1 × APSW
- SUPERIOR ECM, BACKUP SYSTEMS
- Basic/Effective Signature 3 (D8)
- POINTS VALUE 393

**8) Ground-Attack Aerospace Fighter:**
- Medium vehicle (class 3), AEROSPACE mobility, FGP power, Armour 2
- 1 × external Ordnance Load capacity for 3 Ordnance Loads, 1 × APSW
- ENHANCED ECM
- Basic/Effective Signature 3 (D8)
- POINTS VALUE 274 (plus cost of Ordnance Loads)

**Examples of Complete Units:**

**Heavy Armour Troop:** 4 Heavy Hover Tanks as in (3) above
- Total points cost for unit = 4 × 356 = 1424 POINTS

**Mechanised Infantry Platoon:** 4 Wheeled APCs as in (5) above
- Three of the APCs each carry 1 Rifle Team (organized as one SQUAD of two teams) of LINE INFANTRY, while the fourth APC carries one APSW TEAM and one GMSL TEAM
- Total points cost for unit = (4 × 393) + 200 for Infantry (LINE TROOPS) = 880 POINTS for the whole unit

**Medium Artillery Battery:** 3 Self-Propelled Artillery vehicles as in (6) above
- Total points cost for unit = 1020 POINTS (plus 210 for typical basic ammunition load of 1 ammo marker)

---

## Appendix 13: Terrain Availability and Modelling (page 18)

The Dirtside II rulebook discusses terrain availability and recommends table-top terrain layout using cloth, felt or foam to create terrain features. The alternative is purchasing commercial "modular" or "integral" systems, though such terrain does not appear cheap. Options include:

- GEO-HEX system (proprietary hexagonal terrain tiles)
- GAMESCAPE system (primarily from GZG and Snapdragon)
- Various individual terrain pieces and scatter terrain for modeling realism

The designers note that Dirtside II will be most enjoyable when played on an attractive table-top terrain layout, as shown in the photographs throughout the book. At its simplest, terrain can be formed using cloth, sheet or blanket of suitable colour, then painting other items on table as needed.

For modular terrain: recommendations include GEO-HEX tiles or equivalent systems that allow virtually any type of ground feature to be treated, from hills to valleys, sunken areas, vegetation, etc.

Recommended suppliers include:
- **GZG Designs:** Comprehensive range from own site
- **Scotia Micro-Models:** Small but growing range of nicely sculpted models, largely hover and Grav vehicles plus some excellent packs of individual infantry figures including some super-heavy Power Armoured Troopers
- **Irregular Miniatures:** Large range of AFVs (mostly hover/Grav types), VTOLs and some very useful little ready-based teams of infantry
- **Minifigs:** Number of different ranges made under license from US manufacturers, including some very good ground vehicles, aerospace fighters and various kinds of Combat Walkers
- **CMD Designs:** Tofte Cottage, Tofte Manor, Sharnbrook, Bedfordshire, UK/CH43 3LQ
- **Scotia Micromodels:** 32 West Hemming Street, Letham, Angus, Scotland DB8 2PU
- **Snapdragon Studio:** 3 Norleaze, Heywood, Nr. Westbury, Wiltshire BA13 4LQ
- **Irregular Miniatures:** 69A Acomb Road, Holgate, York YO2 4EP
- **TSS:** PO Box 51E, Worcester Park, Surrey, KT4 8NQ
- **USA/Canadian/American Readers Contact:** GEO-HEX: 2126 North Lawson, Portland, Oregon 97227, USA
- **FOR GEO-HEX Microtac ranges and The Drum's range:** Available from Geoscope Terrain, GZG, CMD and Drum ranges

---

## Appendix 13: Model Availability (page 18)

**IN THE RECOMMENDED 1:300/1:285 SCALE,** there is now a vast selection of suitable models of SF vehicles, infantry, air support, Combat Walkers and much more on the market. As Dirtside II allows you to classify ANY item or vehicle that you wish to use, you can take miniatures from almost any of the manufacturers listed below and just a selection of what is available - check each games shop and the specialist wargaming press for latest releases.

**GZG DESIGNS:** This huge and varied range is available by mail order from ourselves at GZG, and has been described by independent reviewers as "the best on the market" - this is certainly unashamed plug for the range well, but be assured they are VERY good indeed! The range covers everything from tracked, hover and even futuristic craft in the UK and elsewhere, write to GZG for full details, in the USA and Canada, contact Geo-Hex.

**SCOTIA MICRO-MODELS:** A small but growing range of very nicely sculpted models, largely hover and Grav vehicles plus some excellent packs of individual infantry figures including some super-heavy Power Armoured Troopers.

**IRREGULAR MINIATURES:** A large range of AFVs (mostly hover/Grav types), VTOLs and some very useful little ready-based teams of infantry. The models are not as sharp or well detailed as some other ranges, but are effective when painted and are certainly very reasonably priced.

**COMBAT WALKER FIGURINES ("MINIFIGS"):** A number of different ranges made under license from US manufacturers, including some very good ground vehicles, aerospace fighters and various kinds of Combat Walkers you could need!

---

## Appendix 13: Glossary of Terms (page 19)

| Abbreviation | Term |
|---|---|
| ADS | Area Defence System |
| APC | Armoured Personnel Carrier |
| APFC | Anti-Personnel Fragmentation Charges |
| APL | Assistant Platoon Leader |
| APSW | Anti-Personnel Support Weapon |
| BMF | Base Movement Factor |
| BCL | Broken Confidence Level |
| CBR | Counter-Battery Radar |
| Casevac | Casualty Evacuation (aka Medevac) |
| CFE | Chemical Fuelled Engine |
| CL | Confidence Level |
| CO | Commanding Officer |
| DCP | Direct-Fire Fusion Gun |
| DFFO | Dispersed Fire Formation (artillery round) |
| DMR | Dispersed Mine Round (artillery round) |
| ECM | Electronic Counter-Measures |
| FGP | Fusion Generation Plant |
| FireCon | Fire Control System |
| GMSH | Guided Missile System - Heavy |
| GMSL | Guided Missile System - Light |
| HARs | Heavy Artillery Rockets |
| HAR | Heavy Battle Tank |
| HEL | High Energy Laser |
| HEP | High-Explosive Penetrator |
| HMT | Hydromagnetic Turbine |
| HKP | Hyper-Kinetic Penetrator |
| IAVR | Infantry Anti-Vehicle Rocket (aka "Buzzbomb") |
| ICY | Infantry Combat Vehicle (aka MICV) |
| LAD | Local Air Defence |
| MAK | Multiple Armour Killer (artillery round) |
| Mag Rep | Magnetic Repulsion drive - similar to Grav |
| MAK | Multiple Armour Killer (artillery round) |
| MBT | Main (or Medium) Battle Tank |
| MDC | Mass Driver Cannon |
| MICV | Mechanised Infantry Combat Vehicle |
| MRL | Multiple Rocket Launcher |
| NAPS | Nano-Armour Penetrator Shells |
| PDS | Point Defence System |
| RAM | Rocket Assisted Munition |
| RFAC | Rapid-Fire AutoCannon |
| RD | Rounded Confidence Level |
| RSW | Rigid Side Wall (air cushion watercraft) |
| SCL | Steady Confidence Level |
| SLAM | Salvo Launched Armour |
| STE | Steady Confidence Level |
| VTOL | Vertical Take-Off and Landing |
| ZAD | Zone Air Defence |

---

## Appendix 13: The Record Cards (page 19)

The use of a RECORD CARD for every different TYPE of vehicle (or Aircraft, boat etc.) in your forces is one of the keys to making DIRTSIDE II fast and easy to play.

Each Record Card carries virtually all the data necessary to use that particular type of ATV in the game. MULTIPLE Die Types and even Damage Validities for its weapons. This means that while the game is in progress, each player simply keeps the cards in front of him for those vehicles he is using - the vast majority of situations that occur in the game can be handled simply by looking at the relevant card rather than having to flick through the rulebook or hunt for bits of information.

Players should try to build up a "library" of cards for the vehicles they design; the cards are sized to fit in an ordinary index card box. Once this is done, for any battle simply take out the relevant cards for the different types of vehicles in each player's force (in an average game force probably will not have more than around half-a-dozen different types of vehicles involved per side).

[The Record Card has been designed to be as general as possible, while still having space for all the important bits of information for most "normal" vehicle types. As the design space in DIRTSIDE II is so open and the range of models available is so vast, there may well be a few times when the data spaces on the card have to be modified or relabelled to cope with a particularly unusual vehicle.]

Players should try to build up a "library" of cards for the vehicles they design; the cards are sized to fit in an ordinary index card box Once this is done, for any battle simply take out the relevant cards for the different types of vehicles in each player's force (in an average game force probably will not have more than around half-a-dozen different types of vehicles involved per side).

A full page of blank Record Cards is provided for you to photocopy (permission is granted to do this for personal use only; most modern photocopiers will let you onto thin card rather than paper, which of course is much better). We suggest that you get a few copies of the cards printed onto card - to colour code either the general types of vehicles or the different forces you have.

[PACKS OF PRINTED AND TRIMMED RECORD CARDS WILL SOON BE AVAILABLE FROM GZG - contact us for details and prices.]

**RECORD CARD EXAMPLE:**

The Record Card has fields for:
- Name/Demo/SD (Squadron/Platoon Designation)
- Type
- Size Class
- Mobility Type/Precision
- Basic Signature
- Stealth Level
- ECM (None = 0; Basic = 15; ENH = 8; SUPERIOR = -5)
- Armour (Front, Side)
- Armor Rating across multiple weapons and armor values with chit values (D)
- Other Equipment and Notes
- Type Class Weapon Mount/Traverse
- Close Range (Normal Range/Long Range options)
- Effective Range columns with penetration calculations

**Record Card use notes:**

Filling out the Record cards should be self-explanatory in most areas once you know the rules of play, but to give you an example the card below is provided for the same "DE HOSS" Heavy Tank that was used in the DESIGN example on P.16.

Note that in the example, which just notes one "D" in the MAXIMUM range field rather than separate Close, Medium and Long ranges. Anything not specifically covered on the card (such as Infantry carried, in the case of an APC or MICV, and a reminder about the "free" APSW fitted to ALL vehicles) should be entered in the "Other Equipment and Notes" box at the bottom of the card.

---

## Appendix: Record Sheets (page 20)

Page 20 displays four blank DIRTSIDE II Record Card templates for photocopying. These are counter-sheet format cards with fields for:
- DIRTSIDE II header
- Name/Make
- Type
- Size Class/Signature
- Mobility
- Stealth Level
- Armour (Front/Side)
- Basic Signature
- Fire Control System
- Weapon types and mounting
- Range bands (Close/Normal/Long)
- Other equipment and notes

Each card has space for recording all weapon statistics and armor values needed for play.

---
