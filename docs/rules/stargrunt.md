# Stargrunt II — rules digest

*Stargrunt II* (Jon M. Tuffley, Ground Zero Games, 1996) is the 25mm science-fiction infantry game of the
same universe as Full Thrust and Dirtside II: platoon-level actions fought squad by squad, where Dirtside
fights company-level actions element by element. It is the game the campaign will hand its special actions
to — raids, boardings on the ground, the fights too small for Dirtside.

This file is a chapter-by-chapter transcription for the programmer who will implement it, made from:

| Source | What it is | Where below |
| --- | --- | --- |
| The rulebook | 75 scanned pages with no text layer, uploaded in five parts; the PRINTED page number is the PDF page less one (the cover is unnumbered) | Chunks 01–19, then the five closing chapters |
| The quick reference | GZG's own two-page summary of the rules (1996) | "Quick reference" |
| The counter sheets | The two 1996 sheets, 560 counters | "Counter sheets" |

How it was read: every chunk was digested from the page images by one machine reader and then checked
line by line against the same images by a second reader, who corrected it; the checker's list of changes is
folded at the end of each chunk. The quick reference and the counters were done the same way. Each rulebook
chunk also ends with **"Against the quick reference"**: the places where the full rules say more than, or
something different from, the summary — which is where a program written from the summary alone would go
wrong. **The scan is the authority.** Before a figure here becomes code, read the page it cites.

Things worth knowing before reading on:

- **The dice are Dirtside's dice with a different engine.** The same D4–D12 scale and die-type shifts, but
  no damage chits: fire is a multiple opposed roll, firer's dice against the target's range die, then
  impact dice against armour dice. The rulebook adds a distinction the summary leaves out — *closed* shifts
  stop at D4 and D12, *open* shifts (impact against armour) carry the excess over to the opponent's die.
- **Vehicles are Dirtside's vehicles.** Chapter 13 designs them with the same size classes, capacity of
  five points a class, fixed mounts at twice the weapon's class and turrets at three times, and chapter 12
  arms them with Dirtside's heavy weapons (RFAC, HVC, HKP, MDC, HEL, DFFG, GMS) plus a gatling autocannon,
  each with an impact die. A vehicle from the Motor Pool should need only its Stargrunt fire numbers.
- **The command markers settle the colours.** Chapter 3 (p. 9) gives the five qualities and their dice:
  Untrained yellow D4, Green green D6, Regular blue D8, Veteran orange D10, Elite red D12; the number on the
  marker is the leadership value. The counter sheets carry 84 of them — 10 yellow, 18 green, 28 blue, 18
  orange, 10 red — and 84 confidence markers (21 CO, 21 ST, 18 SH, 14 BR, 10 RO), exactly as p. 7 lists.
- **There is no points system**, by the designer's choice (p. 10): forces are balanced by scenario. The
  campaign chapter (pp. 60–61) is how quality, replacements and fatigue carry between battles.

---

# Quick reference · page 1 · actions, cover and integrity, observation, EW, movement, confidence, armour

## ACTIONS

All units can perform TWO ACTIONS when activated; SOME actions require a REACTION TEST to be passed before they may be carried out, others may be done without a die roll.
Unit may perform TWO fire actions, but only with DIFFERENT weapons; any single weapon may only fire ONCE per game turn.

**COMMUNICATIONS:** Roll QUALITY DIE of SENDER - for success, EXCEED POORER LV (out of sender and receiver). SHIFT DIE TYPE DOWN one type per Command Level being BYPASSED.

**TRANSFERRING ACTIONS:** Roll as for COMMUNICATIONS, with Commander as "sender". If successful, receiver unit may immediately make full activation (2 actions). Commander can attempt to re-activate 2 subordinate units per turn, each with one Communication action.

**REORGANISE:** allows repositioning of individual figures, restoring unit integrity and medical treatment of casualties. MAY be done while SUPPRESSED, only if unit is IN COVER.

**RALLYING:** Successful COMMUNICATION required first, then roll QUALITY die to exceed SUM of leaderships of rallied and rallying units. Success = Confidence rises ONE level.

**REGROUPING:** joins two depleted units into one; new unit gets BEST of LVs, QUALITY of larger no. of figures, and AVERAGE of Confidence Levels.

**DETACHED ELEMENTS:** take 1 action to form. They must be ACTIVATED by a successful transfer of action by the unit leader each turn.

**SUPPRESSION:** prevents INFANTRY units from taking most actions except Observe, Communicate, Reorganise (if in cover) and Remove Suppression, and VEHICLES from taking any action that requires occupants to exit the vehicle. Removing 1 suppression marker takes 1 action, and roll of Quality die - exceed LV to succeed. Multiple suppressions (up to 3 at one time) are allowed.

## COVER AND INTEGRITY

Unit integrity is EITHER all in 6" diameter cicle or each within 2" of next figure. If out of integrity, must REORGANISE.

In SOFT cover = shift both Range and Armour dice up one type.
In HARD cover = shift Range and Armour dice up TWO types.

One action to go "in position"; roll Quality die, exceed LV+0 in cover, LV+2 in open. Must REMOVE IP marker before moving; if trying to move without removing IP first then need reaction test first (LV+2). When in postion, shift Range Die up one type when fired at by Direct fire, and shift Armour Die up one type for Indirect fire. Normal COVER shifts apply.

## OBSERVATION

**OBSERVE:** action used to spot hidden units; roll Quality and Sensor dice, "target" rolls D4 shifted up for cover and for every 12" range. Minor success = counter flipped (if unit), dummies removed. Major success = figures placed if unit. Mines etc. only detected with Major success when within 6".

**RECON BY FIRE:** Roll as normal fire; Major success = counter flipped (if unit) and suppressed. No other effects possible.

**DRONES:** One action to launch. Move 24" per action or may SPOT. Roll spotting as other air units.
Shooting down drones: if within 1 range band, opposed roll unit quality vs. drone level.

## ELECTRONIC WARFARE

EW systems D6, D8 or D10; one EW marker to attempt task, shift die up for every EXTRA marker used.

To JAM Communications, exceed opponent's Comms roll.
To SPOT, exceed D4 in open, D6 in cover. Shift up 1 die if out of sight of EW unit.
To SPOOF sensors/guidance, exceed ONE of opponent's rolls.
To JAM EW, exceed opposing EW roll.

© 1996 Ground Zero Games.

## MOVEMENT

**NORMAL MOVEMENT:** up to Base Mobility per action.

**COMBAT MOVEMENT:** is 2 x Mobility Die roll per action, but must indicate destination and then move full distance rolled.

BASE MOBILITY DISTANCES:

| | | |
|---|---|---|
| Normal troops on foot: | 6" | (Combat movement D6x2") |
| Very light troops: | 8" | (Combat movement D8x2") |
| Troops in "Slow" Power Armour: | 6" | (Combat movement D6x2") |
| Troops in "Fast" Power Armour: | 12" | (Combat movement D12x2") |
| All vehicles: | 12" | (Combat movement D12x2") |

Reduce movement one die type if encumbered.

**TRAVEL MOVE:** twice Normal move; in column only, no other actions. REORGANISE required to return to combat state.
If engaged, shift Range Die down one; unit automatically suppressed.

**TROOP TRANSPORT:** must be within 6" of carrier to embark; 1 action to load 1 squad.

## CONFIDENCE AND REACTION

**CONFIDENCE TEST:** taken as soon as required. Roll Quality die, exceed LV+ Threat Level to pass test. Failure = drop one CL; score less than HALF needed number = drop TWO CLs.

**CONFIDENT** = Any action.
**STEADY** = Any action.
**SHAKEN** = Reaction Test to leave cover.
**BROKEN** = Move to cover; leave cover only to retreat; may only fire if fired upon.
**ROUTED** = Withdraw, no fire. Surrender if enemy within 12".

THREAT LEVELS FOR CONFIDENCE TESTS:

| MISSION MOTIVATION: | LOW | MED | HIGH |
|---|---|---|---|
| FIRST time unit is SUPPRESSED by fire | 2 | 1 | NTR |
| Unit takes casualties from fire | 2 | 1 | NTR |
| Unit takes MORE casualties in one attack than it has surviving members afterwards | 4 | 3 | 1 |
| Unit Leader becomes casualty | 4 | 3 | 2 |
| Unit is under Artillery or Aerospace attack | +2 | +1 | +0 |
| For each currently UNTREATED CASUALTY in unit | +1 | +0 | NTR |
| Unit is forced to ABANDON WOUNDED** | +3 | +2 | +1 |

**REACTION TEST:** taken as soon as required. Roll Quality die, exceed LV+ Threat Level to pass test.
NO drop in CL for failing Reaction Test.

THREAT LEVELS FOR REACTION TESTS:

| | |
|---|---|
| Unit attempts to go IN POSITION while IN OPEN | 2 |
| Unit attempts to go IN POSITION while IN COVER | 0 |
| Unit attempts to MOVE without removing IP marker first | 2 |
| SHAKEN Unit attempts to leave cover and advance | 2 |

**PANIC:** UNTRAINED test when first sight enemy; GREENS when first fired on or see AFVs/PA; REGULARS when first attacked by TERROR units. Roll Reaction test, TL 0.
Fail = PANIC. NO actions while panicked. Takes 2 actions to remove - roll Reaction, TL 0 - score 1 = lose 1 CL.

## ARMOUR

| Type of armour worn: | Armour Die |
|---|---|
| Basic Battledress | D4 |
| Partial Light Armour | D6 |
| Full-Suit Light Armour | D8 |
| Combat Power Suit ("Light" Power Armour) | D10 |
| Heavy Power Armour | D12 |
| Vehicle Armour | D12 x Armour Class |

<details><summary>Reader's notes</summary>

- "diameter cicle" (COVER AND INTEGRITY box): printed exactly as shown on the page; appears to be a printing typo for "circle," transcribed verbatim per instructions.
- In the THREAT LEVELS FOR CONFIDENCE TESTS table, the MED-column cell for "Unit is under Artillery or Aerospace attack" reads "+1" followed by a small mark that may be an unintended print speck/artifact rather than a character; transcribed as "+1".
- The row "Unit is forced to ABANDON WOUNDED**" carries a double-asterisk in the printed text; no corresponding footnote text was visible elsewhere on this page (it may appear on page 2 or was cut off).

</details>

<details><summary>Checker's corrections</summary>

Checked figure-by-figure and line-by-line against qr-p1-300.png and all four quadrant crops (qr-p1-tl/tr/bl/br.png), including 2x–3x pixel-level zooms on every numeric table cell, the "Artillery or Aerospace attack" MED-column mark, and other small marks on the page. Also scanned the page's top/bottom/left/right margins for any page number, footnote, or other text outside the boxed sections.

Result: no content errors found. Every number, die type, range, threat level, count, and table cell in the file matches the source exactly, and every rule's wording and conditions match verbatim, including the two printed typos ("cicle" for "circle", and "postion" for "position" in the COVER AND INTEGRITY box), both of which the file correctly preserves as printed rather than silently fixing. Nothing on the page was omitted, and no rules text in the file is invented, paraphrased, or misplaced relative to its source box.

Specifically re-verified and confirmed correct (no change made):
- All values in the BASE MOBILITY DISTANCES table (6", 8", 6", 12", 12" and their D6x2"/D8x2"/D6x2"/D12x2"/D12x2" combat-movement figures).
- All values in the THREAT LEVELS FOR CONFIDENCE TESTS table (2/1/NTR twice; 4/3/1; 4/3/2; +2/+1/+0; +1/+0/NTR; +3/+2/+1), including the stray mark after "+1" in the Artillery/Aerospace row, which is confirmed (at pixel zoom) to be a print speck rather than a minus sign or second digit — the file's "+1" transcription is correct.
- All values in the THREAT LEVELS FOR REACTION TESTS table (2, 0, 2, 2).
- All Armour Die values in the ARMOUR table (D4, D6, D8, D10, D12, D12 x Armour Class), and confirmed the small mark near "Basic Battledress" is dust/artifact, not a character.
- The double asterisk on "ABANDON WOUNDED**" is present on the source page with no footnote visible anywhere on page 1, confirming the first reader's note that it is undefined on this page.

One non-substantive observation, not treated as an error: the title line's "(page 1)" is an editorial label added for navigation purposes and does not appear on the printed page (the page itself has no page number). It does not misstate any rule and is left in place.

</details>

---

# Quick reference · page 2 · fire combat, heavy weapons against vehicles, generic weapons, close assault, artillery

## FIRE COMBAT

MULTIPLE OPPOSED ROLL used for all DIRECT FIRE RESOLUTION:
FIRER rolls TWO or more dice, TARGET rolls ONE die.

Firer rolls less than or equal to target score with ALL his dice = FAILED.

Firer exceeds target score with ONE die only = MINOR SUCCESS.

Firer exceeds target score with TWO dice or more = MAJOR SUCCESS.

FIRING SMALL ARMS:
FIRER'S DICE:    Quality die, Small Arms Firepower die,
                 plus any relevant Support Firepower dice.
TARGET'S DIE:  Range Die (Range Band = Troop Quality)

FIRING SUPPORT WEAPONS:
FIRER'S DICE:    Quality die, Support Firepower die.
TARGET'S DIE:  Range Die (Range Band = Troop Quality)

FIRING HEAVY WEAPONS:
FIRER'S DICE:    Quality die, Fire Control die.
TARGET'S DIE:  Range Die (Range Band = 12" x Weapon Size)

FIRING GUIDED MISSILES:
FIRER'S DICE:    Quality die, Missile Guidance die.
TARGET'S DIE:  ECM Systems Die

**SUMMARY OF INFANTRY FIRE PROCEDURE:**

STEP 1: Opposed roll made; if NONE of firer's dice exceed target's score, NO EFFECT. If ONE of firer's dice exceeds target's score, SUPPRESSION ONLY. If TWO of firer's dice exceed target's roll, fire is FULLY EFFECTIVE (Suppression + potential casualties).

STEP 2: Divide firer's TOTAL DICE SCORE from step 1 by target's RANGE DIE TYPE: result, rounded down to whole number, is number of POTENTIAL HITS scored. 1 extra roll (using range die type) may give 1 extra hit from left-over score.

STEP 3: For every Potential Hit from step 2, make opposed roll: firer rolls IMPACT DIE for weapon type, target rolls ARMOUR DIE. No modifiers used. If Firer's roll LESS THAN or EQUAL TO target's, NO EFFECT; if firer's EXCEEDS target's, WOUND scored; if firer's MORE THAN TWICE target's, KILL scored.

STEP 4: Allocate any WOUNDS or KILLS from step 3 at random among members of target squad.

**WOUNDED:** may be treated in Reorganise action. Roll D6 per man: 1-2 = DEAD, 3-5 = STABILISED, 6 = OK.
Add 1 to die if MEDIC, or 2 if specialised MEDICAL UNIT.

**SMALL ARMS FIRE AGAINST VEHICLES:** Roll as for ordinary small arms fire. one-die success = Suppression, two-die success = roll for penetration as MINOR HIT. If impact beats Armour, roll for casualties; if twice or more, casualties PLUS vehicle disabled.

Casualty roll: Armour die per figure,
1 = DEAD, 2 = WOUNDED, 3+ = OK.

## CLOSE ASSAULT

Attackers take reaction test: Threat Level +0 if CO, +1 if ST, +3 if SH. If test passed, may COMBAT MOVE to assault.

Defenders take confidence test: Threat Level is ODDS, ie: 1:1 = +1, 2:1 = +2 etc. Power Armour count as 2 troops in odds calculation. DOUBLE threat level for TERROR effect. If test failed, withdraw 6" or base move, plus lose CL.

"Pair off" figures then roll die for each figure - any that exceed their opponent's roll win their fight. Die type is Quality, shift up one for close combat weapon, two for flamer or shotgun. One die shift up for defenders in cover or in position, for first round only. DOUBLE roll for Power Armour. Mark all losing figures with white skull.

Roll for casualty effects when close assault is over; 1-2 = DEAD, 3-4 = WOUNDED (need attention), 5-6 = stunned, now OK.

Side with most casualties after each round tests Confidence: Threat Level +1 per casualty in this close assault. If test failed, fall back and lose CL; if passed, other player must test in same way, with same results.

If both hold, fight second round of close combat - continue until one side breaks or is destroyed.

If attackers do not make distance in first action, defenders may fire - reaction test to fire if suppressed (TL = no. of suppressions).

Fire only has effect if casualties inflicted - then attackers must test reaction at TL of +1 per casualty; if failed, abandon assault and withdraw (also suppressed). If passed, roll combat move for second action.

## HEAVY WEAPONS FIRE AGAINST VEHICLES

**HEAVY WEAPONS FIRE AGAINST VEHICLES:** Roll IMPACT vs. ARMOUR (both with appropriate multipliers - DOUBLE impact roll if MAJOR hit).

If Impact exceeds Armour, DISABLED; if more than twice Armour, DESTROYED.

Vehicle DISABLED: roll occupants' Armour die, exceed Weapon Size to save, otherwise casualty. If vehicle DESTROYED, double size class of weapon for this roll. Roll D6 for each casualty - 1-3 DEAD, 4-6 WOUNDED.

## NON-PENETRATING HITS

**NON-PENETRATING HITS:**
Roll D6: 1-2 = SUSPENSION, 3-5 = HULL (No Effect), 6 = SYSTEMS.

SUSPENSION HIT: roll Impact vs. Suspension type die (Civ. wheeled D6, Mil. wheeled D10, Tracked D10, Hover D8); success = IMMOBILISED. Crew take Conf. Test at TL 3; fail = bail out.

SYSTEMS HIT: all systems off-line; 1 action for repair attempt, roll D6 - 5 or 6 gets backups online.

## SNIPERS

**SNIPERS:** fire normally, but RANGE BAND 2 x Quality. Minor Success means hit random figure, Major success means hit specified figure. If ONE rolled on Quality die, position revealed.

## GENERIC WEAPONS TABLE

### Small Arms

| Weapon Type | Range limitations | FIREPOWER | IMPACT |
|---|---|---|---|
| **SMALL ARMS:** | | | |
| Improvised Firearm | Close only | 0.5 | D4 |
| Light Autopistol | Close only | 1 | D6 |
| Heavy Autopistol | Close only | 1 | D10 |
| Machine Pistol/SMG | Close only | 3 | D8 |
| Assault Shotgun | Close only | 3 | D8 |
| Hunting Rifle | | 1 | D10 |
| Low-Tech Assault Rifle | | 2 | D8 |
| Low-Tech Assault Rifle (with GL) | | 3 | D8 |
| Advanced Assault Rifle | | 2 | D10 |
| Advanced Assault Rifle (with GL) | | 3 | D10 |
| Gauss Rifle | | 2 | D12 |
| Gauss Rifle (with GL) | | 3 | D12 |

### Support Weapons

| Weapon Type | Support Firepower | IMPACT |
|---|---|---|
| **SUPPORT WEAPONS:** | | |
| Conventional Machine Gun (SAW) | D8 | D10 |
| Rotary (Gatling type) Machine Gun (SAW) | D10 | D10 |
| Gauss Machine Gun (SAW) | D10 | D12 |
| Infantry Plasma Gun | D6 | D12* |
| Automatic Grenade Launcher | D12 | D8* |
| Multiple Launcher Pack (MLP) | D8 | D8* |
| Infantry Rocket (IAVR) | D10 | D12* |

\* Impact value against Dispersed targets or for MINOR hits on point targets - DOUBLE this for MAJOR hits on point targets.

## ARTILLERY SUPPORT

**REQUESTING SUPPORT:** Roll D8, shifted down one type per command level bypassed and up one type per SUPPORT REQUEST chit.

For success, exceed LV plus:
Artillery support: +0 with Forward Observer, otherwise +2.
Orbital support: +3 with Orbital Liaison, otherwise +6.
Air Support: +2 with Air Liaison, otherwise +4.

**IMPACT ACCURACY:** Roll Quality die of observer; if specialist AND can see target, exceed LV for accuracy; if not, exceed 2 x LV. IF INACCURATE, roll D12 for direction and D8 for distance - multiply distance by score rolled in accuracy test.

First round hits impact point; for each other roll D12 (direction) and D6 (distance) for deviation from main impact point.

| DELIVERY SYSTEM | BURST RADIUS |
|---|---|
| SMALL (light mortars) | 3" |
| MEDIUM (medium mortars, light artillery) | 4" |
| LARGE (heavy mortars, field artillery) | 6" |
| VERY LARGE (superheavy artillery) | 10" |

| IMPACT VALUES | vs. Dispersed | vs. Point |
|---|---|---|
| GENERAL PURPOSE EXPLOSIVE | D8 | D8 |
| ANTI-PERSONNEL SUBMUNITIONS | D12 | D8 |
| ANTI-ARMOUR SUBMUNITIONS | D6 | D12x2 |

Roll for ALL figures/vehicles in burst area - if bursts overlap roll for each one. Opposed roll Impact vs. Armour, wound/kill as for small arms, usual cover modifiers. All in burst area are SUPPRESSED. Vehicles roll Impact vs. Armour as for MINOR HIT.

<details><summary>Reader's notes</summary>

- Page layout is two bordered boxes per column. The left column is one box headed **FIRE COMBAT** (running through the "Casualty roll" line) followed by a second box headed **CLOSE ASSAULT**. The right column is one box that starts directly with "HEAVY WEAPONS FIRE AGAINST VEHICLES:" (no large stylised title of its own) and runs through the **GENERIC WEAPONS TABLE**, followed by a second box headed **ARTILLERY SUPPORT**. The ## headings for HEAVY WEAPONS FIRE AGAINST VEHICLES, NON-PENETRATING HITS, and SNIPERS were added for structure per the task's requested breakdown — in the original these are bold-lead-in paragraphs inside the single right-hand-top box, not separately bordered boxes, so the original lead-in phrase is repeated as the first words of the paragraph beneath each added heading.
- In the Generic Weapons Table, the printed header row reads "Weapon Type / Range limitations / FIREPOWER / IMPACT" once at the top; when the table switches to the Support Weapons section, the printed sub-header changes to "Support Firepower / IMPACT" without reprinting a "Weapon Type" label — I carried "Weapon Type" down into the second table's header for markdown validity only.
- Blank cells in the "Range limitations" column (Hunting Rifle through Gauss Rifle (with GL)) are blank in the original — no range-limitation text is printed for those rows.
- The body text is set in a rounded sans-serif font that is uniformly fairly heavy, but there IS a genuine bolder weight used within it for the lead-in term/phrase that opens certain rule paragraphs (confirmed at 300dpi by direct same-line contrast against the regular-weight text that follows it): "SUMMARY OF INFANTRY FIRE PROCEDURE:", "WOUNDED:", "SMALL ARMS FIRE AGAINST VEHICLES:", "HEAVY WEAPONS FIRE AGAINST VEHICLES:", "NON-PENETRATING HITS:", "SNIPERS:", "REQUESTING SUPPORT:", and "IMPACT ACCURACY:" are all printed in this heavier weight and are marked with markdown bold above. Other similar-looking colon-terminated lead-ins that are NOT printed bold (and are left as plain text) include "FIRING SMALL ARMS:", "FIRING SUPPORT WEAPONS:", "FIRING HEAVY WEAPONS:", "FIRING GUIDED MISSILES:", "FIRER'S DICE:", "TARGET'S DIE:", "STEP 1:" through "STEP 4:", "SUSPENSION HIT:", "SYSTEMS HIT:", "Vehicle DISABLED:", and "Casualty roll:" — confirmed regular weight by the same method. CAPITALS remain the only other emphasis marker reproduced here.
- At the very bottom of the page, outside any box, is the footer line "© 1996 Ground Zero Games" — not part of a box, so left out of the transcription above.
- One stray mark appeared after "...multiply distance by score rolled in accuracy test." in the source scan (looked like a small slash/comma artifact); treated as a scan/print artifact and not transcribed.
- All die types, thresholds, and table values were legible at 300 dpi; nothing was marked [illegible].

</details>

<details><summary>Checker's corrections</summary>

Checked figure-by-figure and line-by-line against qr-p2-300.png and all four quadrant crops (qr-p2-tl/tr/bl/br.png), with additional 2x–4x pixel-level zoom crops made for this check on lines where font weight or a stray mark needed to be confirmed.

**Content (numbers, dice, ranges, tables, rule wording): no errors found.** Every entry in the Small Arms table (12 rows: firepower 0.5/1/1/3/3/1/2/3/2/3/2/3, impact D4/D6/D10/D8/D8/D10/D8/D8/D10/D10/D12/D12) and the Support Weapons table (7 rows, firepower and impact dice including the four asterisked D12*/D8*/D8*/D12* entries and their footnote) match the scan exactly, with no transposed values. The Artillery Support tables (BURST RADIUS 3"/4"/6"/10" and IMPACT VALUES D8/D8, D12/D8, D6/D12x2) also match exactly. All named thresholds (Threat Level modifiers in CLOSE ASSAULT, the +0/+2, +3/+6, +2/+4 support-request modifiers, the casualty rolls, the D6 sub-tables for WOUNDED/casualty/non-penetrating-hit results) match the source verbatim, including quirks the first reader correctly preserved as printed (e.g. STEP 1 says firer's dice exceed target's "roll" while STEP 3 phrasing uses "target's" without repeating "roll"; "Firer" vs "FIRER" capitalization varies exactly as printed). Nothing on the page was found to be omitted, and no rule text in the file is invented or misplaced relative to its source box.

**One correction made: missing bold emphasis, and an inaccurate reader's note about it.** The first reader's note stated flatly that "there is no separate typographic bold used for emphasis within body paragraphs" on this page. Pixel-level zooms show this is incorrect: eight lead-in terms/phrases are printed in a visibly heavier weight than the body text that follows them on the same line (confirmed by direct same-line contrast, not merely cross-line impression): **SUMMARY OF INFANTRY FIRE PROCEDURE:**, **WOUNDED:**, **SMALL ARMS FIRE AGAINST VEHICLES:**, **HEAVY WEAPONS FIRE AGAINST VEHICLES:**, **NON-PENETRATING HITS:**, **SNIPERS:**, **REQUESTING SUPPORT:**, and **IMPACT ACCURACY:**. The first reader's file left all eight as plain text. I added markdown bold to each of these eight and rewrote the relevant reader's note to describe the actual pattern, also recording the checked-and-confirmed-regular-weight lead-ins (FIRING SMALL ARMS:, FIRER'S DICE:, TARGET'S DIE:, STEP 1–4:, SUSPENSION HIT:, SYSTEMS HIT:, Vehicle DISABLED:, Casualty roll:) so the distinction is traceable. This is a formatting/emphasis correction only — it does not change any rule, number, or wording.

Specifically re-verified and confirmed correct as originally transcribed (no change made):
- All twelve Small Arms table rows and all seven Support Weapons table rows, cell by cell, including the "0.5" firepower value and every die type (D4 through D12, and the D12x2 in the Artillery Impact Values table).
- The two blank-vs-"Close only" patterns in the Range limitations column, and the table-header carry-down noted by the first reader (both confirmed intentional and correctly explained).
- The FIRE COMBAT step-by-step procedure (STEP 1–4) wording and thresholds, the WOUNDED and casualty D6 tables, and the SMALL ARMS FIRE AGAINST VEHICLES paragraph.
- The CLOSE ASSAULT box in full, including the Threat Level/odds/TERROR/CL rules and the two-stage reaction-test-after-failed-assault sequence.
- The HEAVY WEAPONS FIRE AGAINST VEHICLES, NON-PENETRATING HITS (including the Civ. wheeled D6/Mil. wheeled D10/Tracked D10/Hover D8 suspension dice), and SNIPERS paragraphs.
- The ARTILLERY SUPPORT box in full, including the D8 request roll, the three support-type modifiers, the IMPACT ACCURACY procedure and its D12/D8 deviation dice, and both delivery-system and impact-value tables.
- The footer copyright line and the stray mark after "...accuracy test.", both correctly identified by the first reader as outside the transcribed content / a print artifact.

</details>

---

# Counter sheets · the two 1996 sheets, 560 counters

Read directly from the 300 dpi scans:
- Sheet B = `SGII-Counters1-left.png` + `SGII-Counters1-right.png` (confirmed by the "SHEET B" print mark, bottom‑left of the left half)
- Sheet A = `SGII-Counters2-left.png` + `SGII-Counters2-right.png` (confirmed by the "SHEET A" print mark)
- Cross‑checked against the Quick Reference: `qr-p1-300.png` (own reading; no `qr-p1.md`‑style transcription existed for page 2, so `qr-p2-300.png` was also read directly)

Each half‑image is a grid of **7 columns**; each sheet is built from ten 4‑row×7‑column blocks (five per half), so each full sheet totals **280 counters**. Counts below were taken row‑by‑row within each block and cross‑summed against the 28‑per‑block/140‑per‑half arithmetic as a check (all blocks reconciled exactly).

Colour names are the printed background/ink colour of the counter. "Rule" cites the Quick Reference wording when the sheet's text/abbreviation matches it directly; where the two QR pages provided don't name the marker, that is stated explicitly rather than guessed.

---

## Sheet B (`SGII-Counters1`) — 280 counters

| Printed text / icon | Colour | Count | Rule it serves |
|---|---|---|---|
| **TURN** | Red square, white text | 1 | Game‑turn tracker (housekeeping; not a combat rule) |
| **HOVER** | Blue square, black text | 6 | Marks a vehicle operating in hover mode (vehicle movement/terrain state; not detailed on the two QR pages provided) |
| **DET** | Grey, black italic text | 14 | "DETACHED ELEMENTS: take 1 action to form. They must be ACTIVATED by a successful transfer of action..." (Actions, QR p1) — marks a detached element |
| **SNIPER** (crosshair icon + text) | Grey, black text, red crosshair | 7 | "SNIPERS: fire normally, but RANGE BAND 2 x Quality... If ONE rolled on Quality die, position revealed." (Fire Combat, QR p2) |
| **LAST STAND** | Grey, black italic text | 7 | Not named on the two provided QR pages (special unit state, likely covered in the full rulebook) |
| **EW** (radio‑wave/antenna icon) | Grey, black text, red icon | 21 | "ELECTRONIC WARFARE: EW systems D6, D8 or D10; one EW marker to attempt task, shift die up for every EXTRA marker used." (QR p1) |
| **A–Z** (unit‑ID letters) | Green, black bold letter | 26 (1 each) | Unit/squad identification for record‑keeping; not tied to one specific chart |
| **DUMMY** | Green, black italic text | 30 (2 in the letter block + 28 in a dedicated block) | "OBSERVE... Minor success = counter flipped (if unit), dummies removed." (Observation, QR p1) — decoy/bluff unit markers |
| **SUPPORT REQUEST** (rocket/flare icon) | Grey, red text, yellow/black icon | 21 | "REQUESTING SUPPORT: Roll D8, shifted... up one type per SUPPORT REQUEST chit." (Artillery Support, QR p2) |
| **PANIC** | Grey, red italic text | 7 | "PANIC: UNTRAINED test when first sight enemy... Fail = PANIC." (Confidence and Reaction, QR p1) |
| Solid red vertical arrow/pennant, no text | Khaki | 28 | Not named on the two QR pages; by placement/shape most likely a facing or fire‑direction indicator (e.g. for the D12 "direction" rolls in Artillery Support) — **inferred, not confirmed** |
| Black open crosshair/reticle circle, no text | Khaki | 14 | Not named on the two QR pages; plausibly a target/aim‑point marker for observed or indirect fire — **inferred, not confirmed** |
| **SMOKE** (cloud icon) | Khaki, grey cloud, black text | 7 | Smoke round/screen marker (cover‑modifying terrain effect; smoke mechanics not detailed on the two QR pages provided) |
| **BOOBY TRAP** (starburst icon) | Khaki, orange/red burst, black text | 7 | Concealed hazard marker (mine/trap rules; "Mines etc. only detected with Major success when within 6"." — Observation, QR p1) |
| White "feather‑burst over dot" icon, no text | Khaki | 7 | Not named on the two QR pages — **rule unclear** |
| Cluster of 3 small black stars, no text | Khaki | 7 | Not named on the two QR pages — **rule unclear** |
| Cluster of 3 small red stars, no text | Khaki | 7 | Not named on the two QR pages — **rule unclear** |
| Cluster of 3 stars, black/red/black, no text | Khaki | 7 | Not named on the two QR pages — **rule unclear** |
| **IMM** (green‑over‑red hull icon) | Khaki, black text | 5 | "SUSPENSION HIT: ...success = IMMOBILISED." (Fire Combat, QR p2) |
| **DIS** (red hull icon, crossed out) | Khaki, black text | 5 | "Vehicle DISABLED: roll occupants' Armour die..." (Fire Combat, QR p2) |
| **SYS** (green hull icon, red turret band) | Khaki, black text | 4 | "SYSTEMS HIT: all systems off‑line; 1 action for repair attempt..." (Fire Combat, QR p2) |
| **DECOY** | Khaki, black italic text | 7 | Not named on the two QR pages; plausibly ties to sensor/EW deception ("To SPOOF sensors/guidance..." QR p1) — **inferred, not confirmed** |
| **DRONE** | Khaki, black italic text | 7 | "DRONES: One action to launch. Move 24" per action or may SPOT..." (Observation, QR p1) |
| White‑outlined sun/ray‑burst circle, no text | Brown | 14 | Not named on the two QR pages — **rule unclear** (possibly illumination/flare or a heat‑source marker) |
| Flame icon, no text | Black | 14 | Not named on the two QR pages; consistent with a vehicle/terrain "on fire" status following a destroyed‑vehicle result — **inferred, not confirmed** |

Sheet B total check: 1+6+14+7+7+21+26+30+21+7+28+14+7+7+7+7+7+7+5+5+4+7+7+14+14 = **280**

---

## Sheet A (`SGII-Counters2`) — 280 counters

### Command markers (coloured squares, number 1/2/3)

| Colour | "1" | "2" | "3" | Colour total | Quality this colour represents |
|---|---:|---:|---:|---:|---|
| Yellow | 3 | 4 | 3 | 10 | Unclear — nothing on the sheets or the two QR pages ties colour to quality |
| Green | 5 | 8 | 5 | 18 | Unclear |
| Blue | 8 | 12 | 8 | 28 | Unclear |
| Orange | 6 | 7 | 5 | 18 | Unclear |
| Red | 4 | 4 | 2 | 10 | Unclear |
| **All colours** | **26** | **35** | **23** | **84** | — |

Note: the counters carry only a colour and a number 1–3, no letter or name. Neither Quick Reference page (which never mentions counter colour at all) nor the sheet itself states which of the five colours corresponds to which of Stargrunt II's five troop qualities (Untrained, Green, Regular, Veteran, Elite) — reported as **unclear** rather than guessed, per instructions. (The numbers 1–3 most likely represent something other than the 5 qualities — e.g. a squad/fireteam index within a unit of that quality colour — but that mapping is likewise not stated on these two pages.)

### Confidence markers (CO / ST / SH / BR / RO)

| Marker | Count | Rule it serves |
|---|---:|---|
| **CO** (Confident) | 21 | "CONFIDENT = Any action." (Confidence and Reaction, QR p1); abbreviation confirmed in Close Assault, QR p2: "Threat Level +0 if CO" |
| **ST** (Steady) | 21 | "STEADY = Any action." (QR p1); "+1 if ST" (QR p2) |
| **SH** (Shaken) | 18 | "SHAKEN = Reaction Test to leave cover." (QR p1); "+3 if SH" (QR p2) |
| **BR** (Broken) | 14 | "BROKEN = Move to cover; leave cover only to retreat; may only fire if fired upon." (QR p1) |
| **RO** (Routed) | 10 | "ROUTED = Withdraw, no fire. Surrender if enemy within 12"." (QR p1) |
| **All confidence markers** | **84** | — |

All five are plain white text on a uniform grey counter — colour carries no information here (unlike the command markers), it's simply the sheet's "status marker" background.

### Other Sheet A markers

| Printed text / icon | Colour | Count | Rule it serves |
|---|---|---|---|
| Red cross in white circle, no text | Grey/white | 28 | "WOUNDED: may be treated in Reorganise action... Add 1 to die if MEDIC." (Fire Combat, QR p2) — medical/treatment marker |
| Black skull, no text | Red | 28 | Casualty marker — matches the DEAD/WOUNDED casualty rolls in Fire Combat (QR p2), but which colour marks which result is **unclear** from the two QR pages |
| White skull, no text | Red | 28 | Casualty marker — see note above; **unclear** which of black/white = DEAD vs WOUNDED |
| **SUPP** (orange starburst icon) | Black, orange/red icon | 28 | "SUPPRESSION: ... Removing 1 suppression marker takes 1 action... Multiple suppressions (up to 3 at one time) are allowed." (Actions, QR p1) |

Sheet A total check: Command markers 84 + Confidence markers 84 + medical 28 + black skull 28 + white skull 28 + SUPP 28 = **280**

---

## Totals (both sheets combined)

| Category | Count |
|---|---:|
| Sheet B (Counters1) total counters | 280 |
| Sheet A (Counters2) total counters | 280 |
| **Grand total, both sheets** | **560** |
| — Command markers (all 5 colours × 1/2/3) | 84 |
| — Confidence markers (CO/ST/SH/BR/RO) | 84 |
| — Casualty/medical markers (medic cross + 2 skull colours) | 84 |
| — Suppression (SUPP) | 28 |
| — Vehicle status (IMM/DIS/SYS) | 14 |
| — Unit‑ID letters (A–Z) | 26 |
| — DUMMY | 30 |
| — All other named/iconic markers on Sheet B | 210 |

### Command marker colour → quality mapping: **unclear**
Five colours (Yellow, Green, Blue, Orange, Red) exist for exactly Stargrunt II's five troop qualities (Untrained, Green, Regular, Veteran, Elite), which is suggestive, but neither the counter sheet nor the two Quick Reference pages read for this task print a legend tying a specific colour to a specific quality name, so no mapping is asserted. The only pattern visible in the counts themselves is that Blue (28) is exactly double the size of Yellow and Red (10 each), with Green and Orange (18 each) in between — consistent with a bell‑curve allocation where a "middle" quality gets the most counters and the two extremes get fewest, but this is an observation about quantities, not a confirmed colour‑to‑quality identification.

### Confidence marker colour: not a variable
Unlike the command markers, CO/ST/SH/BR/RO are all printed in the same white‑on‑grey style — no colour‑coding is used to distinguish them from each other.

---

<details><summary>Checker's corrections</summary>

Checked figure‑by‑figure and line‑by‑line against the four 300 dpi half‑scans (`SGII-Counters1-left/right.png`, `SGII-Counters2-left/right.png`) and the two downscaled whole‑sheet overviews. Method: each half was cropped into its five 4‑row blocks and re‑examined at 1.3×–6× zoom, row by row and cell by cell; every marker type was recounted independently from these crops rather than by trusting the first reader's totals. Rule‑text quotations in the file were also checked word‑for‑word against `qr-p1.checked.md` and `qr-p2.md`.

**Counts: all correct, nothing to fix.** Every one of the 25 Sheet B rows and every cell of the Sheet A command‑marker grid (yellow/green/blue/orange/red × 1/2/3) and confidence‑marker grid (CO/ST/SH/BR/RO) was recounted from the full‑resolution crops and matched the file exactly, including the color transitions mid‑row (e.g. the yellow→green split in command‑marker row 2, and the SH→BR and BR→RO splits in the confidence‑marker grid). Both sheet totals (280 + 280 = 560) and every subtotal in the "Totals" table check out arithmetically and against the source.

**Rule quotations: all correct, nothing to fix.** Every quoted rule fragment attributed to the Quick Reference pages was verified verbatim against `qr-p1.checked.md`/`qr-p2.md` (DETACHED ELEMENTS, SNIPERS, ELECTRONIC WARFARE, OBSERVE, REQUESTING SUPPORT, PANIC, SUSPENSION HIT, Vehicle DISABLED, SYSTEMS HIT, SPOOF, DRONES, CONFIDENT/STEADY/SHAKEN/BROKEN/ROUTED plus their Close Assault threat‑level lines, WOUNDED, SUPPRESSION). No wording was found altered, invented, or misattributed.

**Two icon‑colour errors found and fixed on Sheet B:**

1. **SUPPORT REQUEST** (21 counters) — the file described the icon as a "red/yellow icon," but pixel‑level zoom shows the rocket/bullet icon itself is solid **yellow/gold with a black nose tip**; there is no red anywhere in the icon graphic. (The accompanying "SUPPORT REQUEST" wordmark is red — that part of the file was already correct — but the icon color was wrong.) Corrected the Colour column to "Grey, red text, yellow/black icon."

2. **SYS** (4 counters) — the file described the vehicle icon as "plain green hull icon," but zoomed crops show it actually has a distinct **red band at the top (turret position)** above the green hull body — visually the same red used for the DIS icon's turret, not plain green throughout. Corrected the parenthetical to "green hull icon, red turret band," and for consistency also added the (previously unstated) icon colour for **DIS**, which zoomed crops confirm is a uniformly **red** hull icon (turret and body both red) crossed out with a black X — changed its parenthetical from "hull icon crossed out" to "red hull icon, crossed out." IMM's existing description ("green‑over‑red hull icon" — green turret/hull over a red undercarriage bar) was re‑verified and is correct as written.

**Nothing found omitted from the source pages**, and no text or numbers in the file were found that are not actually on the sheets (no invented or misplaced content beyond the two icon‑colour descriptions above). The sheet‑identification marks ("SHEET B" bottom‑left of Counters1‑left, "SHEET A" bottom‑left of Counters2‑left, and the "STARGRUNT II COUNTER SHEET © 1996 Ground Zero Games" imprint on both right halves) were re‑confirmed in place and correctly attributed.

</details>

---

# Chunk 01 · printed pp. 1–4 · contents, credits, 1 Introduction

Source: `sg-p02.png` (printed p.1, CONTENTS), `sg-p03.png` (printed p.2), `sg-p04.png` (printed p.3), `sg-p05.png` (printed p.4). All page citations below are PRINTED page numbers. No text on these four pages was illegible; all numbers below were confirmed by cropping the contents page into three columns and re-reading each at 2–4x magnification.

---

## CONTENTS (printed p.1)

The full table of contents, transcribed cell-for-cell (Chapter / Section / Page). Chapter header lines from the original (bold, no page number of their own — the chapter opens on the page of its first listed section) are repeated in the Chapter column for every section under them. Text is reproduced exactly as printed, including inconsistent trailing punctuation (some entries end with a colon in print, some don't, some end with "!") and the printed spelling "PRISONERS" (not "PRISONER'S").

| Chapter | Section | Page |
|---|---|---|
| CHAPTER 1: INTRODUCTION | DESIGNERS' NOTES: | 2 |
| CHAPTER 1: INTRODUCTION | RELATIONSHIP BETWEEN STARGRUNT II AND DIRTSIDE II: | 3 |
| CHAPTER 1: INTRODUCTION | USING THIS RULEBOOK: | 3 |
| CHAPTER 1: INTRODUCTION | THE SPIRIT OF THE GAME: | 3 |
| CHAPTER 1: INTRODUCTION | THE ROLE OF THE UMPIRE: | 4 |
| CHAPTER 1: INTRODUCTION | YOUR FIRST GAMES OF STARGRUNT II: | 4 |
| CHAPTER 1: INTRODUCTION | TACTICAL NOTES AND SUGGESTIONS: | 4 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | FIGURE SCALE: | 5 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | BASING YOUR FIGURES: | 5 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | GROUNDSCALE: | 5 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | TIMESCALE: | 5 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | EQUIPMENT NEEDED: | 5 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | DICE TYPES AND CONVENTIONS: | 5 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | DIE TYPE SHIFTS: | 6 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | TYPES OF DIE ROLLS: | 6 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | THE "CLOCKFACE" DIRECTION METHOD: | 6 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | THE COUNTER SHEETS: | 6 |
| CHAPTER 2: GAME SCALES AND DEFINITIONS | THE COUNTERS AND MARKERS: | 7 |
| CHAPTER 3: ORGANISING YOUR FORCES | ORGANISING YOUR FORCES: | 8 |
| CHAPTER 3: ORGANISING YOUR FORCES | SAMPLE FORCE ORGANISATION: | 8 |
| CHAPTER 3: ORGANISING YOUR FORCES | COMMAND LEVELS: | 8 |
| CHAPTER 3: ORGANISING YOUR FORCES | ACTIVATION MARKERS: | 9 |
| CHAPTER 3: ORGANISING YOUR FORCES | UNIT QUALITY AND LEADERSHIP VALUE: | 9 |
| CHAPTER 3: ORGANISING YOUR FORCES | DETERMINING QUALITY AND LEADERSHIP: | 10 |
| CHAPTER 3: ORGANISING YOUR FORCES | UNDER-STRENGTH UNITS: | 10 |
| CHAPTER 3: ORGANISING YOUR FORCES | LOSS OF UNIT LEADER: | 10 |
| CHAPTER 3: ORGANISING YOUR FORCES | BALANCING FORCES: | 10 |
| CHAPTER 4: BASIC PRINCIPLES OF PLAY | UNIT INTEGRITY: | 11 |
| CHAPTER 4: BASIC PRINCIPLES OF PLAY | LINE OF SIGHT AND LINE OF FIRE: | 11 |
| CHAPTER 4: BASIC PRINCIPLES OF PLAY | MEASURING RANGES BETWEEN UNITS: | 11 |
| CHAPTER 4: BASIC PRINCIPLES OF PLAY | TARGET PRIORITY: | 12 |
| CHAPTER 4: BASIC PRINCIPLES OF PLAY | EFFECTS OF WOODS: | 12 |
| CHAPTER 4: BASIC PRINCIPLES OF PLAY | COVER AND CONCEALMENT: | 12 |
| CHAPTER 4: BASIC PRINCIPLES OF PLAY | UNITS IN POSITION: | 13 |
| CHAPTER 4: BASIC PRINCIPLES OF PLAY | BENEFITS OF BEING IN POSITION: | 13 |
| CHAPTER 4: BASIC PRINCIPLES OF PLAY | FIELD DEFENCES: | 13 |
| CHAPTER 5: SETTING UP THE GAME | PRELIMINARIES - SETTING UP THE GAME: | 14 |
| CHAPTER 5: SETTING UP THE GAME | TERRAIN SET-UP: | 14 |
| CHAPTER 5: SETTING UP THE GAME | DEFINING TERRAIN EFFECTS: | 14 |
| CHAPTER 5: SETTING UP THE GAME | ENCOUNTER BATTLES: | 14 |
| CHAPTER 5: SETTING UP THE GAME | ATTACK/DEFENCE BATTLES: | 14 |
| CHAPTER 5: SETTING UP THE GAME | OBJECTIVES AND VICTORY CONDITIONS: | 14 |
| CHAPTER 6: GAME SEQUENCE | OVERVIEW OF GAME SEQUENCE: | 15 |
| CHAPTER 6: GAME SEQUENCE | ACTIONS AND ACTIVATIONS: | 15 |
| CHAPTER 6: GAME SEQUENCE | SEQUENCE OF PLAY - THE GAME TURN: | 15 |
| CHAPTER 6: GAME SEQUENCE | THE "TURN END PHASE": | 15 |
| CHAPTER 7: ACTIONS | AVAILABLE ACTIONS: | 16 |
| CHAPTER 7: ACTIONS | COMMUNICATIONS: | 16 |
| CHAPTER 7: ACTIONS | TRANSFERRING ACTIONS: | 16 |
| CHAPTER 7: ACTIONS | THE REORGANISE ACTION: | 17 |
| CHAPTER 7: ACTIONS | THE RALLY ACTION: | 17 |
| CHAPTER 7: ACTIONS | REGROUPING: | 17 |
| CHAPTER 7: ACTIONS | DETACHED ELEMENTS: | 17 |
| CHAPTER 7: ACTIONS | SUPPRESSION: | 18 |
| CHAPTER 7: ACTIONS | SUPPRESSION OF INFANTRY UNITS: | 18 |
| CHAPTER 7: ACTIONS | SUPPRESSION OF VEHICLES AND BUILDINGS: | 18 |
| CHAPTER 7: ACTIONS | MULTIPLE SUPPRESSIONS: | 18 |
| CHAPTER 8: CONFIDENCE AND REACTION | MISSION MOTIVATION: | 19 |
| CHAPTER 8: CONFIDENCE AND REACTION | FATIGUE LEVEL: | 19 |
| CHAPTER 8: CONFIDENCE AND REACTION | CONFIDENCE LEVELS: | 20 |
| CHAPTER 8: CONFIDENCE AND REACTION | CONFIDENCE TESTS: | 20 |
| CHAPTER 8: CONFIDENCE AND REACTION | THREAT LEVEL TABLE FOR CONFIDENCE TESTS: | 20 |
| CHAPTER 8: CONFIDENCE AND REACTION | RESULTS OF REDUCED CONFIDENCE LEVELS: | 21 |
| CHAPTER 8: CONFIDENCE AND REACTION | REACTION TESTS: | 21 |
| CHAPTER 8: CONFIDENCE AND REACTION | THREAT LEVEL TABLE FOR REACTION TESTS: | 21 |
| CHAPTER 8: CONFIDENCE AND REACTION | PANIC: | 21 |
| CHAPTER 9: MOVEMENT | MOVING UNITS: | 22 |
| CHAPTER 9: MOVEMENT | MOVEMENT: TROOPS ON FOOT: | 22 |
| CHAPTER 9: MOVEMENT | TERRAIN MODIFICATIONS TO BASE MOBILITY: | 22 |
| CHAPTER 9: MOVEMENT | TERRAIN TYPES AND EFFECTS: | 22 |
| CHAPTER 9: MOVEMENT | TERRAIN EFFECTS ON MOBILITY: | 23 |
| CHAPTER 9: MOVEMENT | VEHICLE MOVEMENT: | 23 |
| CHAPTER 9: MOVEMENT | BASE MOBILITY DISTANCE FOR VEHICLES: | 23 |
| CHAPTER 9: MOVEMENT | TRANSPORT OF INFANTRY: | 24 |
| CHAPTER 9: MOVEMENT | TRAVEL MOVEMENT: | 24 |
| CHAPTER 9: MOVEMENT | MOVING CASUALTIES: | 24 |
| CHAPTER 10: OBSERVATION AND HIDDEN UNITS | HIDDEN UNITS: | 25 |
| CHAPTER 10: OBSERVATION AND HIDDEN UNITS | SPOTTING HIDDEN UNITS: | 25 |
| CHAPTER 10: OBSERVATION AND HIDDEN UNITS | FIRING AT UNLOCATED TARGETS: | 25 |
| CHAPTER 10: OBSERVATION AND HIDDEN UNITS | DRONES: | 25 |
| CHAPTER 11: SNIPERS AND CHARACTERS | INDEPENDENT FIGURES: | 26 |
| CHAPTER 11: SNIPERS AND CHARACTERS | FIRING AT INDEPENDENT FIGURES: | 26 |
| CHAPTER 11: SNIPERS AND CHARACTERS | REACTION OF INDEPENDENT FIGURES: | 26 |
| CHAPTER 11: SNIPERS AND CHARACTERS | SNIPERS: | 27 |
| CHAPTER 11: SNIPERS AND CHARACTERS | SNIPER FIRE: | 27 |
| CHAPTER 11: SNIPERS AND CHARACTERS | SNIPERS - CONCEALED MOVEMENT: | 27 |
| CHAPTER 11: SNIPERS AND CHARACTERS | SNIPERS GOING INTO HIDING: | 27 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | PERSONAL ARMOUR: | 28 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | SYSTEM QUALITIES AND LEVELS: | 28 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | WEAPONS SYSTEMS: | 28 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | WEAPONS TECHNOLOGY: | 28 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | HEAVY WEAPONS: | 29 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | HEAVY WEAPONS SYSTEMS: | 29 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | CREW-SERVED WEAPONS: | 30 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | AMMUNITION SUPPLY: | 30 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | GRENADES: | 30 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | MULTIPLE LAUNCHER PACKS: | 30 |
| CHAPTER 12: WEAPONS AND EQUIPMENT | POWER ARMOURED TROOPS: | 30 |
| CHAPTER 13: VEHICLES | USE OF VEHICLES IN STARGRUNT II GAMES: | 31 |
| CHAPTER 13: VEHICLES | VEHICLE TYPES AND TECHNOLOGY: | 31 |
| CHAPTER 13: VEHICLES | VEHICLE SIZE CLASSES: | 31 |
| CHAPTER 13: VEHICLES | VEHICLE DESIGN AND CLASSIFICATION: | 31 |
| CHAPTER 13: VEHICLES | ARCS OF FIRE: | 32 |
| CHAPTER 13: VEHICLES | FIRE CONTROL SYSTEMS: | 32 |
| CHAPTER 13: VEHICLES | ECM: | 32 |
| CHAPTER 13: VEHICLES | CAPACITY FOR WEAPONS AND SYSTEMS: | 32 |
| CHAPTER 14: FIRE COMBAT | GENERAL FIRE PROCEDURE: | 33 |
| CHAPTER 14: FIRE COMBAT | RANGE BANDS: | 33 |
| CHAPTER 14: FIRE COMBAT | TARGET SIZE: | 33 |
| CHAPTER 14: FIRE COMBAT | SMALL ARMS RANGES: | 33 |
| CHAPTER 14: FIRE COMBAT | FIREPOWER: | 34 |
| CHAPTER 14: FIRE COMBAT | IMPACT VALUE: | 34 |
| CHAPTER 14: FIRE COMBAT | GENERIC WEAPONS TABLE: | 34 |
| CHAPTER 14: FIRE COMBAT | FIRE RESOLUTION: | 35 |
| CHAPTER 14: FIRE COMBAT | ADDING SUPPORT FIREPOWER: | 35 |
| CHAPTER 14: FIRE COMBAT | FIRE AGAINST DISPERSED TARGETS: | 35 |
| CHAPTER 14: FIRE COMBAT | THE QUICK-AND-DIRTY OPTION: | 36 |
| CHAPTER 14: FIRE COMBAT | INDIVIDUAL FIRE OF SUPPORT WEAPONS: | 37 |
| CHAPTER 14: FIRE COMBAT | FIRING SMALL ARMS AT POINT TARGETS: | 37 |
| CHAPTER 14: FIRE COMBAT | HEAVY WEAPONS RANGE BANDS: | 37 |
| CHAPTER 14: FIRE COMBAT | IMPACT VALUES FOR HEAVY WEAPONS: | 38 |
| CHAPTER 14: FIRE COMBAT | ARMOUR VALUES OF POINT TARGETS: | 38 |
| CHAPTER 14: FIRE COMBAT | ANGLE OF ATTACK: | 38 |
| CHAPTER 14: FIRE COMBAT | HEAVY WEAPON FIRE AT POINT TARGETS: | 38 |
| CHAPTER 14: FIRE COMBAT | ARMOUR PENETRATION AND HIT EFFECTS: | 38 |
| CHAPTER 14: FIRE COMBAT | NON-PENETRATING HITS ON VEHICLES: | 39 |
| CHAPTER 14: FIRE COMBAT | INDICATING DAMAGED VEHICLES: | 39 |
| CHAPTER 14: FIRE COMBAT | CASUALTIES TO VEHICLE OCCUPANTS: | 39 |
| CHAPTER 14: FIRE COMBAT | MEDICAL TREATMENT OF WOUNDED TROOPS: | 39 |
| CHAPTER 14: FIRE COMBAT | POWER ARMOUR TROOP CASUALTIES: | 40 |
| CHAPTER 14: FIRE COMBAT | GUIDED MISSILE FIRE: | 40 |
| CHAPTER 14: FIRE COMBAT | REMOTE MISSILE LAUNCHERS: | 40 |
| CHAPTER 14: FIRE COMBAT | UNGUIDED ROCKETS: | 40 |
| CHAPTER 14: FIRE COMBAT | HEAVY WEAPONS FIRE AGAINST INFANTRY: | 40 |
| CHAPTER 15: INFANTRY CLOSE ASSAULT | INITIATING CLOSE ASSAULT: | 41 |
| CHAPTER 15: INFANTRY CLOSE ASSAULT | CLOSE COMBAT RESOLUTION: | 41 |
| CHAPTER 15: INFANTRY CLOSE ASSAULT | CASUALTIES IN CLOSE COMBAT: | 42 |
| CHAPTER 15: INFANTRY CLOSE ASSAULT | ENDING CLOSE COMBAT: | 42 |
| CHAPTER 15: INFANTRY CLOSE ASSAULT | FINAL DEFENSIVE FIRE: | 43 |
| CHAPTER 15: INFANTRY CLOSE ASSAULT | TERROR EFFECTS: | 43 |
| CHAPTER 15: INFANTRY CLOSE ASSAULT | COMBINED CLOSE-ASSAULT ACTIVATIONS: | 43 |
| CHAPTER 15: INFANTRY CLOSE ASSAULT | OVERRUNS AND FOLLOW-THROUGH ATTACKS: | 43 |
| CHAPTER 16: OFF TABLE SUPPORT | ARTILLERY SUPPORT: | 44 |
| CHAPTER 16: OFF TABLE SUPPORT | CALLING FOR ARTILLERY FIRE SUPPORT: | 44 |
| CHAPTER 16: OFF TABLE SUPPORT | REQUESTING AIR SUPPORT: | 44 |
| CHAPTER 16: OFF TABLE SUPPORT | THE INBOUND CHART: | 44 |
| CHAPTER 16: OFF TABLE SUPPORT | STARTING POSITIONS ON INBOUND CHART: | 45 |
| CHAPTER 16: OFF TABLE SUPPORT | UNITS LEAVING THE BATTLE AREA: | 45 |
| CHAPTER 16: OFF TABLE SUPPORT | THE TURN TRACK: | 45 |
| CHAPTER 17: ARTILLERY FIRE | ARRIVAL OF FIRE SUPPORT: | 46 |
| CHAPTER 17: ARTILLERY FIRE | FIRE SUPPORT ACCURACY: | 46 |
| CHAPTER 17: ARTILLERY FIRE | MULTIPLE INCOMING ROUNDS: | 46 |
| CHAPTER 17: ARTILLERY FIRE | DELIVERY SYSTEMS AND WARHEAD TYPES: | 46 |
| CHAPTER 17: ARTILLERY FIRE | CASUALTIES FROM ARTILLERY FIRE: | 47 |
| CHAPTER 17: ARTILLERY FIRE | ON-TABLE ARTILLERY FIRE: | 47 |
| CHAPTER 18: AEROSPACE OPERATIONS | AEROSPACE AND ANTI-AIR OPERATIONS: | 48 |
| CHAPTER 18: AEROSPACE OPERATIONS | THE AIR DEFENCE ENVIRONMENT: | 48 |
| CHAPTER 18: AEROSPACE OPERATIONS | EFFECTS OF THE AIR DEFENCE ENVIRONMENT: | 48 |
| CHAPTER 18: AEROSPACE OPERATIONS | EFFECTS OF ON-TABLE ANTI-AIR FIRE: | 48 |
| CHAPTER 18: AEROSPACE OPERATIONS | FACING OF AIR VEHICLES: | 49 |
| CHAPTER 18: AEROSPACE OPERATIONS | AIR VEHICLE MOVEMENT: | 49 |
| CHAPTER 18: AEROSPACE OPERATIONS | FIRE FROM AIRBORNE VEHICLES: | 50 |
| CHAPTER 18: AEROSPACE OPERATIONS | SPOTTING FROM AIR VEHICLES: | 50 |
| CHAPTER 18: AEROSPACE OPERATIONS | LANDING ZONES: | 50 |
| CHAPTER 18: AEROSPACE OPERATIONS | DROPPING TROOPS FROM HOVERING CRAFT: | 51 |
| CHAPTER 18: AEROSPACE OPERATIONS | A TYPICAL AIR MISSION | 51 |
| CHAPTER 18: AEROSPACE OPERATIONS | HIGH-ALTITUDE OR ORBITAL INSERTION: | 51 |
| CHAPTER 18: AEROSPACE OPERATIONS | INTERFACE LANDINGS FROM ORBIT: | 51 |
| CHAPTER 19: ELECTRONIC WARFARE | ELECTRONIC WARFARE, ECM AND JAMMING: | 52 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | REACTION FIRE: | 53 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | THE LAST STAND: | 53 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | SURRENDER AND TAKING PRISONERS: | 53 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | INTERROGATION OF PRISONERS: | 53 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | CASUALTY EVACUATION (CASEVAC): | 54 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | RULES OF ENGAGEMENT: | 55 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | MINES: | 55 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | CONVENTIONAL MINEFIELDS: | 55 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | MINE CLEARING: | 55 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | COMMAND-DETONATED MINES: | 55 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | BOOBY TRAPS: | 56 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | DECOYS: | 56 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | BUILDINGS AND FORTIFICATIONS: | 56 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | FIRES, FLAME AND INCENDIARY WEAPONS: | 57 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | SMOKE: | 57 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | WEATHER CONDITIONS: | 57 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | EXOTIC ENVIRONMENTS: | 57 |
| CHAPTER 20: ADVANCED AND OPTIONAL RULES | ALIEN RACES IN STARGRUNT II: | 58 |
| CHAPTER 21: RECORD CARDS | MISSION CARDS: | 59 |
| CHAPTER 21: RECORD CARDS | VEHICLE CARDS: | 59 |
| CHAPTER 21: RECORD CARDS | SQUAD CARDS: | 59 |
| CHAPTER 21: RECORD CARDS | KEEPING OTHER RECORDS OF YOUR UNITS: | 59 |
| CHAPTER 22: CAMPAIGN GAMES | SUGGESTED CAMPAIGN STYLE: | 60 |
| CHAPTER 22: CAMPAIGN GAMES | IMPROVING TROOP QUALITY: | 60 |
| CHAPTER 22: CAMPAIGN GAMES | REPLACEMENT TROOPS: | 60 |
| CHAPTER 22: CAMPAIGN GAMES | REST AND RECOVERY: | 61 |
| CHAPTER 23: SCENARIOS | SCENARIO 1: RECON IN FORCE | 62 |
| CHAPTER 23: SCENARIOS | SCENARIO 2: AMBUSH! | 62 |
| CHAPTER 23: SCENARIOS | SCENARIO 3: THE REARGUARD | 63 |
| CHAPTER 24: BACKGROUND | TIMELINE: | 65 |
| CHAPTER 25: ORGANISATION AND EQUIPMENT | FORCE ORGANISATIONS: | 67 |
| CHAPTER 25: ORGANISATION AND EQUIPMENT | NEW ANGLIAN CONFEDERATION: | 67 |
| CHAPTER 25: ORGANISATION AND EQUIPMENT | NEU SWABIAN LEAGUE: | 68 |
| CHAPTER 25: ORGANISATION AND EQUIPMENT | EURASIAN SOLAR UNION: | 69 |
| CHAPTER 25: ORGANISATION AND EQUIPMENT | FEDERAL STATS EUROPA: | 69 |
| CHAPTER 26: APPENDICES | TERRAIN AVAILABILITY AND MODELLING: | 70 |
| CHAPTER 26: APPENDICES | AVAILABILITY OF SUITABLE FIGURES: | 70 |
| CHAPTER 26: APPENDICES | RECORD CARD BLANKS: | 71 |
| CHAPTER 26: APPENDICES | INBOUND CHART: | 72 |

Notes on the Contents transcription:
- "FEDERAL STATS EUROPA:" is printed exactly that way (confirmed at 4x zoom) — not "STATES"; transcribed verbatim as a possible in-house abbreviation/typo, not corrected.
- "A TYPICAL AIR MISSION" and the three SCENARIO lines under Chapter 23 are the only section entries printed without a trailing colon; this is reproduced as printed.
- A small dot/speck appears above the "CHAPTER 1" line in the printed column; at magnification this is a print/scan artifact (or stray mark on the original page), not a character, and carries no content.
- The book runs to 72 printed pages (per the last Contents entry, INBOUND CHART: 72), plus this front Contents page and the credits block beneath it (unnumbered).

### CREDITS block (below Contents, printed p.1)

Not a rule; summarised. Written by Jon Tuffley (main rules development with Mike Elliott; background development with Steve Blease). Graphics/typesetting by Smart Graphics (Tim and Simon Parnell, Needham Market, Suffolk). Artwork by Barrie Quin, Tim Osborne, Peter Barfield, Malcolm Yaxley, David Garnham, Aaron Alderson; photos by John Treadaway, Kevin Dallimore, Penny Tuffley; miniature painting by Kevin Dallimore (Special Forces) and others. Lists main in-house testers and external playtest groups (Bath/Bristol, Hull University, Cardiff, Portland USA, N. Ireland, and named individuals). Printed by Kingfisher Press, Bury St. Edmunds. Copyright © 1996 J.M. Tuffley and Ground Zero Games; ISBN 0-9521936-2-0; standard reproduction-rights/resale legal boilerplate; published 1996 by Ground Zero Games.

---

## CHAPTER 1: INTRODUCTION (printed pp.2–4)

This chapter is entirely prose (scene-setting, design philosophy, and practical advice on using the book); it contains no dice mechanics, tables, or numeric thresholds of the kind used elsewhere in the rules. Rule-relevant statements are called out explicitly below; everything else is condensed.

### Opening flavour text (printed p.2)

An illustrated in-fiction vignette (Sergeant Thrasher's squad moving through brush, Private Funk spotting an ambush, calling in a target, the squad's SAW gunner Anderson opening fire, a casualty needing "C-Vac") — scene-setting only, not transcribed. This is followed by a page of prose framing the game's premise: infantry ("Grunts, Squaddies, Pongoes, Footsloggers") remain the ones who do the dirty, dangerous work regardless of future technology; STARGRUNT II is explicitly **not** meant to be a prediction of "how war will be fought in the far future," but is styled after Combat SF novels/films/TV (comparing e.g. the Aliens Colonial Marines to present-day US Marines), on the premise that basic human nature and small-unit behaviour don't change even as equipment does. The design goal stated is a system where "ordinary soldiers are not too unlike those tramping across the battlefields of yesterday or today," carrying different hardware but thinking the same way, with supporting tanks/artillery/air support still filling the same battlefield roles as 20th-century counterparts.

### DESIGNERS' NOTES (printed p.2)

Prose design-philosophy note, summarised: The original STARGRUNT was a small-press booklet (about six years prior to SGII, i.e. ~1990) with limited availability; SGII is a full revision that keeps its "essential feel" while modernising the mechanisms. Explicit stated design goal: encourage players to **think tactically** — the Confidence, Motivation and Suppression rules are deliberately built so that a naive "line 'em all up at the baseline and advance across the table" frontal assault will **not** work except with overwhelming force superiority. States the game rewards good planning/command and is "pretty unforgiving on poor decisions," and that players "actually have to work for" victory rather than relying on firepower and lucky dice. SGII is stated to be a **generic** rules set, intended to be tailored to the player's own forces/figures/background; an "official" background is provided in a separate section (Chapters 24–25) precisely so it doesn't intrude on the generic core rules. Players adapting their own background (from film/book/TV) are advised that "realism" for a SF game means fidelity to their own chosen source material, not to real-world physics. Notes that DIRTSIDE II (the designers' preceding 1/300 SF armour rules) players will recognize many retained mechanisms and principles, partly deliberately (to ease switching between the two games) and partly because "the principles worked very well in DSII." The chapter's closing sentence runs on past the page break, appearing at the top of printed p.3 ahead of the next section's header: **"Read the rules through, then use them as you wish - you've paid out the money, and it's now your game as much as ours!"**

### RELATIONSHIP BETWEEN STARGRUNT II AND DIRTSIDE II (printed p.3)

Mostly prose; contains specific comparative/compatibility facts worth preserving:
- The two games share a common (optional) background and simulate the same warfare at different operational scales; many rules mechanisms are conceptually shared between them.
- Ground-scale comparison (numeric, as printed): **"an average 6' x 4' play table in SGII equates to an area no more than about 7" x 5" on a DSII battlefield."** A typical SGII battle represents, in much greater tactical detail, the kind of action that DSII would resolve abstractly.
- SGII is **not** claimed to exactly recreate what happens in a DSII infantry assault; SGII intentionally has much more weapon/technology detail and variation than DSII's more abstract equipment categories (for playability with large armies in DSII).
- Vehicle design is deliberately kept as consistent as possible between the two games: vehicle designs from DIRTSIDE II can be used directly in SGII without modification. SGII includes its own (simplified) vehicle design notes so the book is self-contained and DIRTSIDE II is **not required** to use vehicles in SGII.
- Explicit statement: SGII is **primarily an infantry game with vehicles in a supporting role**; players wanting to fight massed-armour battles are advised to use DSII (at 1/300 scale) instead.

### USING THIS RULEBOOK (printed p.3)

Prose, but describes book structure relevant to a reader/implementer: brief **RULE SUMMARIES** are given throughout in highlighted panels; the main body text is discussion/explanation of *why* and *how* a rule works, and once understood, only the highlighted summary need be consulted during play. Separately, "for convenient reference during the game," all the most important summary boxes are collected together onto a **PLAYSHEET**, so that once reasonably familiar with SGII, most games can be played with minimal reference to the full rulebook, using only the Playsheet. (This is the "quick reference" material referenced elsewhere in this project.)

### THE SPIRIT OF THE GAME (printed p.3)

Prose statement of play philosophy, summarised: the primary purpose of play is stated to be fun, not min-maxing or exploiting rules loopholes ("Power Gamers and Rules Lawyers"); recommends using an impartial umpire for disputes given the complexity of "realistically" gaming small-unit actions. Absent an umpire, players are told to resolve undefined situations by working out the most likely real outcome given the game's background, or rolling a die, rather than arguing the letter of the rules; closing maxim printed in caps: **"DON'T PLAY THE RULES, PLAY THE GAME!!"** A short "Quick Note on Gender" clarifies that masculine pronouns are used for convenience only and are not meant to imply anything about the composition of forces.

### THE ROLE OF THE UMPIRE (printed p.4)

Prose, summarised: the SGII umpire's role is likened to a roleplaying-game GM — designing/running the scenario, controlling information given to each side (players only know what they've been told, filtered by their side's intelligence-gathering), and adjudicating disputes; described as less demanding than running an RPG since players handle most turn-by-turn mechanics themselves. Umpires are told to be fair/impartial, and may deliberately bias scenario design to balance mismatched forces (a small, elite/well-equipped force vs. a larger, poorer one) by giving the weaker side an easier objective. One explicit rules-adjacent mechanism is offered as an umpire technique for on-the-fly adjudication of anything not covered by the rules: have the acting player roll his unit's **Quality die** in an opposed roll against a die rolled by the umpire; if the player wins, the action succeeds, if he loses, the umpire may invent an appropriate negative side-effect.

### YOUR FIRST GAMES OF STARGRUNT II (printed p.4)

Prose advice with concrete, rule-adjacent recommendations for new players:
- Read through the main sections first (turn sequence, actions/activations, confidence/reaction systems, infantry weapons/combat) and skip the advanced/optional rules initially.
- For a first game or two, use **very small, simple forces**: suggested **no more than three or four small squads (five or six figures per unit) per side**, without vehicles, aircraft, or off-table support.
- Suggested first-game scenario types: **Encounter battles** or basic **Attack/Defence actions**, described in the section on page 14 (Chapter 5).
- SGII is stated to be capable of handling forces up to full Company strength "and maybe even beyond," but the designers recommend Platoon-strength games as more fun and tactically challenging, and cheaper in figures; the system scales down as well as up.
- If using only a few figures, the book recommends splitting them into a **greater number of smaller units** rather than fewer larger ones, to allow more flexibility/more activations per turn in the game's turn sequence. Worked examples given (numeric, as printed): with **thirty or more troops**, organise as **6- or 8-man squads**; with **about a dozen** troops, organise as **three four-man fireteams**, specifically so as to give **three units to activate each turn** rather than one.

### TACTICAL NOTES AND SUGGESTIONS (printed p.4)

Prose tactical advice column, summarised, keeping the concrete claims:
- Every turn involves trade-off decisions (which unit to activate, whether to combine support weapons' firepower with the rest of a unit's fire or fire them separately at another target, whether to risk a Combat Move) — the game structure is said to reward good planning and punish poor decisions; players shouldn't expect lucky dice alone to carry a game.
- Poor-quality troops are a problem, but **poor leadership is worse**; the text explains the three Leadership levels qualitatively (mechanics for LV itself are defined elsewhere in the book, not on this page): **Level 1** leaders are described as charismatic "hero" types who lead their men "through hell and back"; **Level 2** as average, competent, unremarkable officers/NCOs; **Level 3** as leaders who constantly defer decisions to their senior NCO ("what do you think I should do now, Sergeant?"). Level 3 leaders are called "BAD NEWS," and players stuck with one are advised to place them where they can do the least harm.
- Advises making good use of higher command levels — successfully re-activating subordinate units via a senior officer's actions ("Transferring Actions," covered in Chapter 7) is said to be able to "tip the balance" of a game.
- Explicit design statement: ranged firefights between troops of average quality/armour are **deliberately** intended to produce relatively few casualties; the stated purpose of small-arms fire in SGII is primarily to **keep the enemy suppressed/pinned down** while friendly troops manoeuvre, rather than to win the game by attrition — getting real casualties is said to typically require heavier weapons or close assault.
- Closes with the observation that battles are more often lost than won, and a quoted maxim attributed to Mary Gentle: **"Victory usually goes to the side that screws up NEXT to last...."**

---

## quickRefDisagreements

No numeric or mechanical disagreements were found between this chunk and the two-page quick reference summary: printed pages 1–4 are the Contents page and the (entirely prose) Introduction chapter, and contain no dice types, thresholds, ranges, or tables that overlap with anything in the Quick Reference. The one point of contact is structural, not a disagreement: the Introduction (p.3, "USING THIS RULEBOOK") explains that the rulebook's own highlighted summary boxes are collected onto a "PLAYSHEET" for at-the-table reference — this appears to be exactly the document already transcribed as the Quick Reference (`qr-p1`/`qr-p2`), confirming its role rather than contradicting it.

<details><summary>Checker's corrections</summary>

Checked line by line against `sg-p02.png` (printed p.1), `sg-p03.png` (printed p.2), `sg-p04.png` (printed p.3) and `sg-p05.png` (printed p.4). The full CONTENTS table was re-verified entry-for-entry and column-for-column against zoomed crops of all three columns (including every page number, every chapter/section title, every deliberately-preserved printed quirk such as "FEDERAL STATS EUROPA," the missing trailing colons on "A TYPICAL AIR MISSION" and the three Chapter 23 scenario titles, and the unlabelled printed spelling "PRISONERS"), and the CREDITS block was re-checked against the printed names, address, ISBN and legal boilerplate. All of it was already correct in the first reading — no changes were needed to the CONTENTS table or the CREDITS summary. The prose of Chapter 1 itself was also essentially accurate; the few corrections below are all either an inexact quotation or a minor invented/omitted detail, not a substantive misreading of the chapter's content.

- **Where:** DESIGNERS' NOTES (printed p.2), the "line 'em up" quote. — **Was:** "a naive \"line 'em up and advance across the table\" frontal assault will not work..." — **Now:** "a naive \"line 'em all up at the baseline and advance across the table\" frontal assault will not work..." (the printed quote reads "line 'em **all** up **at the baseline** and advance across the table"; the first reading dropped "all" and "at the baseline" from a phrase presented in quotation marks as if verbatim).
- **Where:** DESIGNERS' NOTES (printed p.2), end of section. — **Was:** section ended with the DSII "if it ain't broke, don't fix it....." sentence, with no mention of the next line. — **Now:** added a closing note that the chapter's last sentence runs on past the page break onto the top of printed p.3, ahead of the "RELATIONSHIP BETWEEN..." header: "Read the rules through, then use them as you wish - you've paid out the money, and it's now your game as much as ours!" (this sentence was present on the page but omitted from the digest entirely).
- **Where:** THE ROLE OF THE UMPIRE (printed p.4), umpire-balancing sentence. — **Was:** "...by giving the weaker side an easier objective, rather than trying to make army point values match exactly." — **Now:** "...by giving the weaker side an easier objective." (the printed text says nothing about "point values" or matching army costs; this clause was invented commentary not supported by the page and has been removed).
- **Where:** TACTICAL NOTES AND SUGGESTIONS (printed p.4), Mary Gentle quote. — **Was:** closing quotation mark placed after a single period: "...screws up NEXT to last." — **Now:** "...screws up NEXT to last...." (the printed quote trails off with four dots before the closing quotation mark, not a single full stop).

Everything else checked against the page images — every date, name, number, and quoted phrase in the Contents table, the Credits block, and the rest of the Chapter 1 prose summary (the opening vignette, RELATIONSHIP BETWEEN STARGRUNT II AND DIRTSIDE II including the "6' x 4'" / "7\" x 5\"" ground-scale comparison, USING THIS RULEBOOK, THE SPIRIT OF THE GAME including the exact "DON'T PLAY THE RULES, PLAY THE GAME!!" maxim, the rest of THE ROLE OF THE UMPIRE, and YOUR FIRST GAMES OF STARGRUNT II including the "three or four small squads (five or six figures per unit)," "thirty or more troops... 6- or 8-man squads," and "about a dozen... three four-man fireteams" figures) — matched the source exactly, with nothing found to be illegible.

</details>

---

# Chunk 02 · pp. 5–7 · 2 Game scales and definitions

*(Source: STARGRUNT II, Jon Tuffley, Ground Zero Games, 1996. Printed pages 5–7, scanned as sg-p06.png, sg-p07.png, sg-p08.png.)*

## FIGURE SCALE: (p.5)

The game is designed for play with 25mm scale miniature figures and vehicles, which the designers feel provide the most visually attractive game; if limited on either space or budget, 15mm figures are a viable alternative. 20mm figures are a possibility, though very few SF models are made in 20mm — however, the wealth of "modern" ranges in this scale allows good conversion potential.

Each individual miniature figure represents one real trooper, and as a general convention all troops are taken as being equipped with whatever the actual miniature is depicted as carrying.

## BASING YOUR FIGURES: (p.5)

Assuming 25mm scale miniatures on the recommended groundscale of 1" = 10m, each figure should be mounted on a circular base approximately 1" in diameter (a metal washer about the size of a 2p coin is ideal, or the round plastic bases available from some manufacturers). A base size like this makes the figures look much better, allows them to stand well on most model terrain, and is a great help in play, as it gives a clear reference of distance for figures close together; base-to-base contact is equivalent to 10m or less (quite close on the high-tech battlefield). If figures are on smaller bases (e.g. if using 15mm figures), then whenever the rules state "figures in base-to-base contact" the figures must actually be within 1" measured from the CENTRES of their bases.

**MODELLING NOTE:** Using a washer or disc as a base is a good way of disguising slight height differences between figures from different ranges and manufacturers, as for shorter figures putty can be packed between the miniature's cast-on base and the washer to gain height without it being too noticeable — useful given today's great variation in figure sizes. Once the bases are finished off with sculpted putty and flock powder, even quite diverse ranges can look surprisingly compatible.

*Photo caption: "Figure scale examples - from left to right, a 25mm figure with cast-on base as supplied, two 25mm figures based as suggested and finally two 15mm figures to give a size comparison (all GZG figures, painted by Carl Desforges and Colin Sturdy)."*

## GROUNDSCALE: (p.5)

For the intended 25mm scale, the recommended ground scale is 1" on the table equals 10 metres. All distances in the rules are given to this ground scale; using a different scale requires converting all ranges, movement etc. accordingly. Although the "real" distances are quoted in metres, on-table distances are deliberately kept in inches because they give a better feel when using figures that are nominally 1" tall — fiddling with centimetres and millimetres is considered too "fine" for games at this scale. Metric players may simply convert all game distances at 1" = 25mm.

At the recommended groundscale of 1" = 10m, a good-sized game may be fought on a table around 4' x 6', representing a battlefield of 480 x 720 metres. For a very large playing area, or small forces in very "close" terrain (such as dense jungle, or within a building complex), 1" = 5m may be used (doubling all ranges and moves). For games in very limited space it is possible to use 15mm figures and a groundscale of 1cm = 10 metres, though some parts of the action may look rather cramped.

**[Sidebar, right column, top of p.5]** As a note to readers unfamiliar with some of the conventions of miniatures gaming: the "groundscale" and "figure scale" are two different things; if the groundscale (and thus ranges etc.) were to be the same as the figure scale, then even the lightest weaponry would be able to fire from one end of the table to the other. Thus it is necessary to distort the relationship between model size and terrain to achieve a playable system — so a single building can actually represent a group of structures, and a couple of trees can represent a small wood.

## TIMESCALE: (p.5)

The TIMESCALE is the amount of "game time" that a full turn is assumed to last. In STARGRUNT II, the timescale is fairly loose, and in most cases pretty irrelevant to normal play; most real combat consists of sudden bursts of frantic firefight, separated by long periods of movement, scouting, observation and general inactivity. Although a game turn might contain only a few seconds' worth of actual fire combat, the full turn may safely be assumed to occupy one or even several minutes of elapsed time. If it is necessary to determine how long a battle has lasted in game terms (e.g. if it is part of a campaign) then treat each full turn as being equivalent to approximately **5 minutes**; hence a **six-turn** game would represent a battle lasting about half an hour of campaign time, which could be an important factor if either side is trying to bring reserve forces up to the battlefield.

## EQUIPMENT NEEDED: (p.5)

STARGRUNT II is a miniatures combat game, so the most important requirement is a selection of model figures (and vehicles, if desired) in whatever scale has been decided on. Some sort of battlefield to play on is needed, anything from a simple cloth to a fully detailed model terrain. Notes on miniatures and terrain are given in the appendices to the book.

For the actual mechanics of play, players will need a selection of dice (as fully described below), the sets of die-cut counters that come in the book, and a tape-measure or long rule graduated in inches (or centimetres if preferred).

## DICE TYPES AND CONVENTIONS: (p.5–6)

STARGRUNT II makes use of the full range of "polyhedral" dice from four-sided through to twelve-sided — thus giving **five** different dice types, commonly referred to as **D4, D6, D8, D10 and D12** according to their respective numbers of faces.

While this selection of dice may be unusual at first to some new players, anyone with any involvement in the Roleplaying side of gaming should be familiar with them and will almost certainly have access to a full set; in any case they are readily (and inexpensively) available from virtually any games shop or mail-order supplier, either individually or as sets.

**[Bracketed note]** Most sets of dice sold will also include a twenty-sided die (D20) which is **NOT** used in SGII, but it's always handy for other games.

*Photo caption: "The five types of dice used in STARGRUNT II - from left to right: D4, D6, D8, D10, D12."*

As a minimum, one full set of the five dice is required to play the game. If possible, however, it is best to have as many dice on hand as possible — in many cases it will be necessary for both players to roll dice simultaneously, and often with several dice at once — hence it will be much simpler and quicker if each player involved has his own set(s) of dice (a full set costs no more than a couple of figures for your army, so it is not a big outlay). A "pool" of extra dice for use in certain circumstances is also recommended.

As far as possible, the die-rolling in STARGRUNT II has been made a **WYSIWYG** (What You See Is What You Get) system — whenever a die is rolled, the number actually rolled is the number used, rather than having to add or subtract numerical modifiers to get a final result. There are admittedly a few exceptions to this, but these only occur in special circumstances and are clearly explained where they crop up.

In very general terms, any factor (weapon accuracy, unit quality etc.) that is of **BELOW AVERAGE** status will use a **D6** as its normal die type; those that rank **AVERAGE** will use a **D8**, and those **ABOVE AVERAGE** a **D10**; the real extremes of worst and best will use a **D4** or **D12** respectively. Circumstances that increase the chance of success will **RAISE** the die type, while adverse conditions will **REDUCE** it.

## DIE TYPE SHIFTS: (p.6)

Whenever the rules call for a die roll to be made, the TYPE of die to be used will be specified. When a rule tells you to "shift up one Die Type" this means selecting the **NEXT LARGEST** die, e.g. if the usual die for that roll would be a D6, then "shift up one Die Type" indicates that a D8 is rolled instead. Similarly, if "shift down one Die Type" is specified, then the next **SMALLER** die is used (e.g. a D6 drops to a D4).

There are two kinds of die shift used in the rules — **CLOSED SHIFTS** and **OPEN SHIFTS**.

In a **CLOSED SHIFT**, if cumulative shifts would move the die type outside the range of available dice — i.e. less than a D4 or more than a D12 — then any excess shifts are ignored and the D4 or D12 is used as appropriate.

In an **OPEN SHIFT**, any excess shifts are applied as **OPPOSITE** shifts to the OPPONENT'S die type in an opposed roll — thus if one player's die type should shift one type above a D12, the opponent's die is instead shifted **DOWN** one level, or vice-versa if the first player's die should drop below a D4.

The rules assume **CLOSED** shifts are used in most cases — those that use **OPEN** shifts are clearly specified, such as **IMPACT vs. ARMOUR opposed rolls (see P.38)**.

## TYPES OF DIE ROLLS: (p.6)

The dice, and combinations of dice, are used in STARGRUNT II in a number of different ways; the most important of these methods are explained below, along with the conventions as to what gives a "successful" score in each type of roll:

**i) ROLL VS. TARGET NUMBER:** This is the simplest type of roll. A single die (of whatever type is specified by the circumstances) is rolled, in an attempt to roll HIGHER than a fixed, "target" number. A die score of greater than the required number is a SUCCESS, while one lower or equal to the target number is a failure. The most common use of this type of roll in SGII is for confidence or reaction tests, where the target number is usually the Leadership Value (plus a Threat Level modifier if appropriate) and the die type is determined by the unit's Quality and circumstances.
*Worked example:* a REGULAR unit with an LV of 2 would roll a D8, needing to exceed the target number of 2 (assuming no threat modifier) — so a score of 1 or 2 would be a failure, and 3 or more a success.

**ii) OPPOSED ROLL:** An "opposed roll" is so-called because BOTH players involved (e.g. the player who is firing, and the player whose unit he is firing at) roll dice simultaneously, and compare their scores to determine whether the action has been successful. The type of die rolled by each player depends on the particular circumstances of that action. The objective in a Single Opposed Roll is for the player attempting the action (e.g. the player firing) to try and roll HIGHER than the score rolled by his opponent (e.g. the player being fired at) — if he does so, the action succeeds; if he rolls equal to or less than his opponent, the action fails.

**iii) MULTIPLE OPPOSED ROLL:** This is a variation on the simple Opposed Roll that is used quite a lot through these rules, especially in the Fire Combat sections. Instead of the players involved rolling one die each, the player making the action rolls TWO dice, or sometimes more (the dice may be all the same type or different, depending on individual circumstances) while his opponent still rolls just one. If TWO (or more) of the player's dice score HIGHER than the opponent's single roll, then the result is a MAJOR SUCCESS (e.g. effective fire which causes casualties); if only ONE of the player's rolls exceeds his opponent's score, while the other is equal or lower, then it is a MINOR SUCCESS (e.g. the fire causes suppression only). If BOTH (or all, if more than two dice rolled) the player's scores are equal to or less than the opponent's roll, then the action has failed altogether (e.g. the fire has no effect).

**GENERAL RULE:** Whenever you are comparing your die roll to another number (either a fixed value, or another die score) you must **EXCEED** that number to succeed; scoring equal or less is a failure.

## THE "CLOCKFACE" DIRECTION METHOD: (p.6)

The are [*sic*, printed exactly this way] a number of times during the game when players will need to determine a DIRECTION for something — where support fire deviates if it does not hit its intended target, the direction the wind is blowing (for smoke effects) and so on. The simplest way of deciding random directions on the table is to nominate one direction as "12 o'clock", roll a D12 and use the "clockface" numbers to point the direction of the event. Whenever the CLOCKFACE METHOD is referred to in these rules, this is what should be used.

**[Diagram, p.6]** A clockface graphic showing a central point ("REFERENCE DIRECTION", with an arrow pointing to 12) surrounded by 12 numbered radiating arrows (12 at top, running clockwise 1 through 11), depicting the 12 compass-like directions. Caption beside the diagram:

> **Clockface Direction Method**
> Direction "12" towards an agreed edge of table – roll a D12 whenever a random direction is called for.

## THE COUNTER SHEETS: (p.6)

With the book, two sheets of die-cut counters are supplied. All counters should be carefully punched out and sorted into types and stored safely — small grip-top plastic bags or a segmented storage tray are the best ways.

Most of the counters on the sheets are MARKERS for use in play; they are designed to indicate the status and condition of units on the table, and to perform other game functions to effectively remove the need for written record-keeping during the game. This speeds up the flow of play and prevents important information from being overlooked.

The markers are designed to actually be placed on the table next to the units and elements they affect, thus showing at a glance the exact status of any given unit. While this allows an opponent to see the condition of a player's units, it does work both ways, and this is considered a small price for the ease of play that the markers allow.

Some players may prefer NOT to have the markers placed on the table (perhaps for aesthetic reasons); it is suggested that if preferred, players may put the counters on a sheet of paper ruled up with a box per unit in the player's force. The relevant markers for each unit are simply placed in the boxes on the sheet relating to that unit, rather than on the table itself. This method still dispenses with the need to make any written records, but does also remove the immediate visual link between the markers and the models they affect.

While the 'markers on table' method is recommended, the record sheet method may be used if preferred.

## THE COUNTERS AND MARKERS: (p.7)

The full set of counters for SGII consists of the following, printed on two sheets:

### A) THE ACTIVATION AND CONFIDENCE MARKERS:

| Counter | Description | Quantity |
|---|---|---|
| ACTIVATION MARKERS (icon: grey square with large white number, e.g. "2") | Colour indicates Unit Quality, Number indicates Leadership rating. | 84 in total – 10 YELLOW, 18 GREEN, 28 BLUE, 18 ORANGE, 10 RED |
| CONFIDENCE LEVEL MARKERS (icon: grey square, white letters, e.g. "CO") | Grey counters, white letters indicate Confidence Level. | 84 in total – 21 "CO", 21 "ST", 18 "SH", 14 "BR", 10 "RO" |

### B) CASUALTY AND FIRE EFFECT MARKERS:

| Counter | Description | Quantity |
|---|---|---|
| TREATED CASUALTY MARKERS (icon: grey square, white circle, dark cross) | "Red Cross" medical symbol, used to show when a wounded figure has been stabilised by medical attention. | 28 |
| UNTREATED CASUALTY MARKERS (icon: grey square, white skull) | White "skull" symbol, for wounded troops not yet given medical aid. | 28 |
| DEAD MARKERS (icon: grey square, black skull) | Black "skull" symbol – indicates figure is dead. | 28 |
| SUPPRESSION MARKERS (icon: black square, white starburst, "SUPP") | Indicates unit has been suppressed by fire. | 28 |

### C) PLAY MARKERS:

| Counter | Description | Quantity |
|---|---|---|
| TURN COUNTER ("TURN") | Used on the Turn Track to record elapsed Game Time. | 1 |
| HOVER MARKERS ("HOVER") | To indicate air vehicles in HOVER mode. | 6 |
| DETACHED ELEMENT MARKERS ("DET") | To indicate sub-units detached from their Squads. | 14 |
| SNIPER MARKERS ("SNIPER", target-symbol icon) | To represent "hidden" snipers. | 7 |
| LAST STAND MARKERS ("LAST STAND") | To indicate units subject to the LAST STAND rules. | 7 |
| ELECTRONIC WARFARE CHITS ("EW", antenna icon) | Issued to active EW elements. | 21 |
| LETTERED MARKERS ("T") | To represent hidden units, incoming fire missions etc. | 26 |
| DUMMY MARKERS ("DUMMY") | To confuse enemy intelligence. | 30 |
| SUPPORT REQUEST CHITS (arrow icon, "SUPPORT REQUEST") | Issued to command units for calling support fire. | 21 |
| PANIC MARKERS ("PANIC") | Used to indicate units subject to a PANIC reaction. | 7 |
| MISSILE MARKERS (arrow/missile icon) | To indicate missiles in flight and record missile ammunition supplies. | 28 |
| IMPACT MARKERS (crosshair icon) | For indicating impact points of explosive fire. | 14 |
| SMOKE MARKERS ("SMOKE", cloud icon) | Used to indicate the centre point of smoke clouds and the impact point of smoke rounds. | 7 |
| BOOBY TRAP MARKERS ("BOOBY TRAP", starburst icon) | To indicate concealed booby-traps. | 7 |
| COMMAND-DETONATED MINE MARKERS (spike/flower icon) | To indicate concealed CDMs. | 7 |
| ANTI-PERSONNEL MINEFIELD MARKERS (three black mine-star symbols) | BLACK mine symbols; indicates centre point of AP minefield. | 7 |
| ANTI-VEHICLE MINEFIELD MARKERS (three solid grey mine-star symbols) | RED mine symbols; indicates centre point of AV minefield. | 7 |
| MIXED AP/AV MINEFIELD MARKERS (mixed black/grey mine-star symbols) | BLACK/RED mine symbols; indicates centre point of mixed minefield. | 7 |
| IMMOBILISED VEHICLE MARKERS ("IMM", vehicle icon) | To indicate vehicles immobilised by suspension hits. | 5 |
| DISABLED VEHICLE MARKERS ("DIS", vehicle icon with cross) | To indicate vehicles completely disabled. | 5 |
| VEHICLE "SYSTEMS OUT" MARKERS ("SYS", vehicle icon) | To indicate vehicles with weapons and system knocked-out. | 4 |
| DECOY MARKERS ("DECOY") | To indicate anti-guided-weapon decoys when used. | 7 |
| DRONE COUNTERS ("DRONE") | To represent recon drones in flight. | 7 |
| IN POSITION (IP) MARKERS (sun/burst icon) | To indicate units that are "in position". | 14 |
| FIRE/FLAME MARKERS (flame icon, black background) | To indicate the centre point of a fire or incendiary burst. | 14 |

## quickRefDisagreements

- The quick reference summarises die-type-shift meaning implicitly (via COVER/ARMOUR entries) but never states the general CLOSED vs. OPEN shift distinction found here (p.6): closed shifts clamp excess at D4/D12, while open shifts (explicitly used for IMPACT vs. ARMOUR, p.38) instead apply the excess as an opposite shift to the opponent's die in the same opposed roll. A programmer working only from the QR summary would not know that some die-type shifts (e.g. Impact vs Armour) can push the *opponent's* die type in the other direction rather than simply clamping.
- The QR's "GENERAL RULE" wording for Multiple Opposed Rolls (qr-p2, FIRE COMBAT box) matches this chapter's iii) MULTIPLE OPPOSED ROLL and the boxed GENERAL RULE almost verbatim, but the QR never states rule (i) ROLL VS. TARGET NUMBER or (ii) single OPPOSED ROLL as generic, reusable mechanics — it only gives their concrete applications (Confidence/Reaction tests, single fire actions). The full text here makes clear these are three named, general-purpose die-roll mechanics used throughout the whole rulebook, not just for combat.
- Base mobility, timescale, groundscale, and basing details (this chapter) are not covered in the QR at all — they are pure scale/logistics info the QR omits entirely, confirming this chapter supplies definitions the summary assumes as background knowledge.
- The QR gives no counter/marker inventory; the full counters list (p.7) is new information (types and exact quantities of all 31 marker/chit types — 2 activation/confidence types, 4 casualty/fire-effect types, 25 play-marker types) with no summary equivalent, and would need to be sourced from this page to build a component/marker data model in software.
- Nothing here contradicts a QR numeric value (die types D4–D12, the WYSIWYG "exceed to succeed" convention, etc. all agree with the QR's own "GENERAL RULE" text on qr-p2).

## Notes

- No illegible text was encountered on printed pages 5, 6, or 7; all numbers, table values, and counter quantities were confirmed via pixel-level zoom crops.
- "The are a number of times" (start of THE "CLOCKFACE" DIRECTION METHOD section, p.6) is a printed typo for "There are"; transcribed verbatim as printed, per instructions not to silently correct.
- Designer's-note/flavour asides (the bracketed reader's note on figure scale vs. groundscale, and the D20-not-used aside) are paraphrased above rather than quoted in full, as they contain no rule mechanics.
- Confirmed by pixel-sampling (checked for any saturated/non-grey pixel across the whole page): printed page 7 (sg-p08.png) is pure black-and-white line art — it contains no colour ink anywhere. Every icon-colour word in the Counter column below is therefore a description of grey/black/white tone only; where the adjoining Description column states an actual physical colour (e.g. "RED mine symbols"), that colour is known from the printed text and from the separately-checked full-colour counter-sheet scans (see `counters.checked.md`), not from this page's artwork.

<details><summary>Checker's corrections</summary>

- Section B, TREATED CASUALTY MARKERS icon parenthetical (p.7) — was: "(icon: white square, red cross)" — now: "(icon: grey square, white circle, dark cross)". The icon's square background is a mid-grey, not white (the white part is the circle inside it), and the cross itself is dark grey/black ink — printed page 7 has no colour ink at all (confirmed by whole-page pixel sampling), so the first reader's "red" was an invented colour not present on the page; "Red Cross" is the symbol's official name (correctly kept in the Description column) but is not the colour actually printed here.
- Section C, ANTI-VEHICLE MINEFIELD MARKERS icon parenthetical (p.7) — was: "(three grey/outline mine-star symbols)" — now: "(three solid grey mine-star symbols)". Zoomed comparison against the solid black AP-minefield stars and the mixed black/grey MIXED-minefield stars shows the AV stars are solid, filled shapes in a lighter grey tone (the RED ink of the text description rendering as mid-grey on this monochrome page) — they are not hollow/outline shapes as "outline" implied.
- `quickRefDisagreements` bullet on the counter inventory (no page number — this is the checker's own commentary, not source text) — was: "all 26 marker/chit types" — now: "all 31 marker/chit types — 2 activation/confidence types, 4 casualty/fire-effect types, 25 play-marker types". Recounting the digest's own three tables (A: 2 rows, B: 4 rows, C: 25 rows) gives 31 distinct counter/marker entries on p.7, not 26.
- Everything else was checked line by line against sg-p06.png, sg-p07.png and sg-p08.png (printed pp.5–7) and found accurate: every measurement and scale figure (25/15/20mm, 1"=10m, 1"=5m, 1cm=10m, 1"=25mm, 4'x6', 480x720m, 2p-coin base size), the 5-minute/six-turn timescale figures, the five die types (D4/D6/D8/D10/D12) and the D20-not-used note, the CLOSED/OPEN die-shift rules and the "P.38" cross-reference, the worked example (REGULAR unit, LV 2, D8, target 2, 1–2 fail/3+ succeed), the three named die-roll types (i–iii) and the boxed GENERAL RULE, the Clockface Direction Method diagram and caption, the Counter Sheets text, and every row and quantity in the A/B/C counter tables on p.7 (activation-marker colour breakdown 10/18/28/18/10=84, confidence-marker breakdown 21/21/18/14/10=84, and all 25 individual quantities in section C) — all confirmed correct and complete against the page images, with no invented, missing, or misplaced rule content found beyond the two icon-colour errors and one count error corrected above.

</details>

---

# Chunk 03 · pp. 8–10 · 3 Organising your forces

Source: printed pages 8–10 (PDF pages sg-p09.png, sg-p10.png, sg-p11.png).

---

## ORGANISING YOUR FORCES (p.8)

Before starting the game, you will need to organise your miniatures into UNITS, which are squad-size groups of troopers - the basic operating formation used in SGII.

A UNIT is any group of figures that includes a LEADER figure and is thus capable of independent actions. A unit can theoretically be of any number of men, but a typical infantry squad will comprise from **four to ten troopers** - with **six to eight** being common for most forces. As a general rule, the higher the tech level of the forces involved, the fewer men they are likely to have in each squad.

Single figures or specialist teams of two or three figures operating as sub-units of squads (ie: without their own Leader, but subject to the Leader of their "parent" squad) are referred to as **ELEMENTS**. A single model vehicle with its own crew and commander is considered a UNIT in its own right, while a transport vehicle attached to a squad and crewed by members of the squad is considered an ELEMENT.

At all times during the game, each unit has two markers (counters) placed with it on the table - one is the **ACTIVATION MARKER**, the other is the **CONFIDENCE MARKER**. They function of these markers is fully explained in the relevant sections on **P.9** (Activation markers) and **P.20** (Confidence markers). [Verbatim as printed; the sentence "They function of these markers is fully explained..." appears to be a grammatical slip in the original, transcribed exactly as printed rather than corrected. "P.9" and "P.20" are the book's own printed page numbers, i.e. printed page 9 (Activation Markers, covered later in this same digest) and printed page 20 (Confidence Markers, in a later chapter).]

> **Boxed rule summary:** One UNIT, or SQUAD, is a group of figures with a LEADER. A sub-unit without a LEADER is an ELEMENT.

Several SQUADS will be combined to form a **PLATOON** (usually from **two to five** Squads) and a number of Platoons (typically **three or four**) will be grouped into a **COMPANY**. Each of these organisational levels (Squad, Platoon, Company) is called a **COMMAND LEVEL** - this is more fully explained below.

At SQUAD level, the LEADER figure is an integral part of the Squad; at higher Command Levels, there must be a specific HQ/Command unit that contains the Leader figure for that Command Level and his command staff, communications specialists and so on - this Command Unit functions as a separate Squad.

**Note:** we are using contemporary military terminology here to describe the various Command Levels as this will be familiar to most players. There is no reason why you cannot call your Command Levels anything you wish, to fit in with whatever background you are using - your Squads can be called Sections, Lances, Maniples, anything you like, and similarly with your Platoons and Companies.

It is equally possible to omit certain Command Levels altogether in some circumstances; for instance, a force might be composed of many small units ("squads") all under a single overall Company-level command, with no "platoon" command level being used (this sort of situation might occur where the force is a mass of non-military personnel under a single charismatic leader, eg: in feudal societies or massed gang warfare).

*(Right column, p.8):* Organisational notes for the major forces in our own background timeline are given in the BACKGROUND section, but in keeping with our intention of making the main rules as generic as possible we have listed below an example that you can modify as you wish to suit your own forces:

### SAMPLE FORCE ORGANISATION (p.8)

This TO&E is not representative of any of the particular armies detailed in the background sections of this book; it is simply an example of how a force may be put together, to give you a starting point for working out your own organisations. This full Reinforced Company would give a **BIG** game taking quite a while to play, and for most games we would suggest only using some parts of the force.

**REINFORCED COMBAT COMPANY:**

**Company Command Unit:**
One squad-size unit incorporating the Company Commander, with one Command APC counted as an integral part of the unit. Unit may include specialist elements such as EW or liaison teams.

**Fire Support Battery:**
3 light RAM mortar teams with one transport vehicle each; these will normally be off-table and do not need to be represented by miniatures unless desired.

**Attached Armour Platoon:**
3 Tanks or other combat vehicles, each of which acts as a separate UNIT, one of the three is designated as a Platoon Command Unit.

**Three Infantry Platoons** each of:

**Platoon Command Unit:**
Squad size unit incorporating the Platoon Commander, Platoon Sergeant, Support Liaison element and possibly an EW element, plus a few line troopers for defence; issued with one APC or other vehicle as appropriate to type of force.*

**Three Infantry Squads**
Units of eight men, each of Squad Leader, SAW gunner, Special Weapon (eg: GMS/P or Plasma Gun) trooper and five line troopers, with transport if appropriate.*

Other support assets available: Battalion level artillery, Regimental level Gunship flight.

\* If the force is MECHANISED infantry then an APC or MICV will be issued to each squad; AIRMOBILE infantry will have VTOL craft for transport, though not necessarily enough to carry all the force at once. Ordinary "leg" infantry Companies have to get transport allocated from support echelons if available - more often than not they will find themselves walking.....

### Photo caption (p.8, bottom)

"A typical platoon suitable for a small to medium sized game. The platoon consists of four six-man squads, one of which is the platoon command squad. The two markers with each squad show the quality and leadership of the unit and its present confidence level." (Photo of a painted 25mm infantry platoon with counters; no additional numeric rules content beyond confirming the two-marker-per-unit convention stated above.)

---

## COMMAND LEVELS: (p.8–9)

Throughout these rules you will find references to COMMAND LEVELS. This represents to the organisational "chain of command", and is particularly relevant to attempts to transfer actions, request support and generally communicate between units. [Verbatim as printed — "This represents to the organisational" appears to be a grammatical slip in the original, transcribed exactly as printed.] As explained above, we have kept to standard military terminology for this; you are of course free to rename any or all of the Command Levels to fit your own background if you wish.

The progression of COMMAND LEVELS is as follows:

**SQUAD** (smallest), **PLATOON, COMPANY, BATTALION, REGIMENT.**

While on-table forces will almost never represent anything above COMPANY level, off-table support will frequently be organised at Battalion or Regimental level and thus these command levels are included in the sequence above.

The basis of the Chain of Command is that orders and communications are generally only passed up or down **one command level at a time**; thus a Company commander will talk to his Platoon commanders, but would be unlikely to communicate directly with a Squad leader unless circumstances were exceptional - normally this would be the job of the Platoon commander. The structure of the command and communications rules in SGII is designed so that interaction between units following the normal chain of command is usually fairly straightforward (unless you have some very poor troops and/or very good officers!), but if for any reason you need to bypass one or more of the normal command levels - eg: if the Company commander DID need to talk to one of his Squads directly - it becomes progressively more difficult to communicate successfully.

Whenever provision is made in a scenario for off-table assets (artillery support, air support or even orbital support), the COMMAND LEVEL at which these assets are allocated must be specified, as it will affect the on-table units' attempts to communicate with their off-table assets. For example, a force of Platoon strength (with the Platoon commander as the highest on-table Command Level) might be told that it has access to support from the Company mortar section (**one level up**, thus quite easy to obtain fire from), the Battalion artillery battery (**two levels up**) and a flight of Aerospace support craft organised at Regimental level (**three levels up**, and thus very unlikely to be available when needed!).

> **Boxed rule summary:** Progression of COMMAND LEVELS: SQUAD, PLATOON, COMPANY, BATTALION, REGIMENT.

---

## ACTIVATION MARKERS: (p.9)

Throughout the game, each unit is marked with a counter that is referred to in the rules as an **ACTIVATION MARKER**. The COLOUR of the Activation marker denotes the Unit Quality - **RED for ELITES, ORANGE for VETERANS, BLUE for REGULARS, GREEN for GREENS** (surprise...) **and YELLOW for UNTRAINED**, while the NUMBER on the marker indicates the Leadership Rating (for the definitions of the Quality and Leadership levels, see below). Thus, for example, a Regular unit with an average commander would have a **BLUE "2"** activation marker. Looking at some of the extremes, a Veteran unit that had lost its previous leader and had him replaced by some hopeless case just out of training might be rated **ORANGE "3"**, as the troops would not trust the new squad leader as far as they could throw him; on the other hand, a raw unit of new recruits could be spurred on to great things by a really charismatic and competent leader - this would be a case for a **GREEN "1"**.

The Activation Marker remains with the unit at all times during the game; it serves as a reminder of the die type and leader value used in all confidence and reaction tests for the unit, and is also **inverted each turn** to indicate when a unit has been activated for that turn. The only times that an Activation Marker will be changed for another are:
i) if the unit commander is lost, when a marker with a worse Leadership Rating may have to be used to indicate a less-experienced assistant taking over, and
ii) if two or more depleted units are merged under the rules for 'regrouping'.

> **Boxed rule summary — Activation Marker colour code:**
> COLOUR of ACTIVATION MARKER is UNIT QUALITY; NUMBER on marker is LEADERSHIP.
>
> | Colour | Quality |
> |---|---|
> | YELLOW | UNTRAINED |
> | GREEN | GREEN |
> | BLUE | REGULAR |
> | ORANGE | VETERAN |
> | RED | ELITE |

---

## UNIT QUALITY AND LEADERSHIP VALUE: (p.9)

Each squad-sized UNIT in a player's force has two important characteristics - its **UNIT QUALITY** and the **LEADERSHIP VALUE** of the unit commander. The Unit Quality is rated as one of five levels, from UNTRAINED through to ELITE, as described below. The Leadership Value is a measure of how good the commander of that unit is at his job, and how he is liked/respected by his troops. Leaders are rated as **1, 2 or 3**; a grade 1 leader is a man that so inspires his men that they would follow him through anything, a grade 2 leader is an all-round 'average' officer and finally a grade 3 is more likely to get shot by his own men than by the enemy!

> **Boxed rule summary:** Leadership Value (LV) ranges from **1 (best) to 3 (worst)**. LV denoted by NUMBER on activation marker.

Note that the terms used for the different Quality levels are actually quite loose, as the level does not refer solely to the degree of Combat experience - it also reflects the amount of formal or informal training the troops have received, their general level of competence, skill with weapons, coolness under fire and many other factors.

The five QUALITY LEVELS are:

**UNTRAINED** troops are usually non-military personnel (ie: civilians), with little or no weapons training and no real idea of how to function in combat. This grade should only be used where non-combatant personnel are forced to take up arms by circumstances, eg: citizens defending their homes, miners or workers protecting their claims or installations against attacking forces etc. "Leaders" for UNTRAINED units may be civic leaders with no combat experience (usually LV 3), or may sometimes be police or security personnel (maybe retired military) in which case they may actually be quite good (LV 2 or even 1).
The QUALITY DIE of an UNTRAINED squad is a **D4**; Untrained squads have **YELLOW** activation markers.

**GREEN** troops are those who have had at least a little relevant combat training, but have seldom if ever had to fire a shot in anger. Such troops would generally be new, raw recruits to either military or security forces. They can fight, but are by no means very good at it. This level could also apply to members of local volunteer militia forces (National Guard types), who have received some formal training but have little real knowledge of combat. Leaders for GREEN squads may potentially be of any LV.
The QUALITY DIE for a GREEN squad is a **D6**; Green squads have **GREEN** activation markers.

**REGULAR** troops are "average" in terms of combat training and experience; they will form the bulk of most military units. Squads of REGULAR status normally have at least some experience of being under fire, know how to react in combat conditions, and are reasonably competent with weaponry.
REGULAR Leaders may be of any LV.
The QUALITY DIE for REGULARS is a **D8**; Regular squads have **BLUE** activation markers.

**VETERAN** troops are particularly well-trained and experienced in combat; they will be either professional soldiers with a good few years of service, or else those that are just naturally good fighters. VETERANS know what it is like to be shot at, and to shoot people in return. They know how to follow a good leader, but it should be remembered that they probably survived this long by knowing when NOT to follow a bad leader..... Most professional or long-service military units will include a fair proportion of VETERAN squads, as will any reasonably good Mercenary units.
Leaders for VETERAN squads can be of any LV, but there are likely to be more LV1 or 2 leaders than LV3.
The QUALITY DIE for a VETERAN squad is a **D10**; Veteran squads have **ORANGE** activation markers.

**ELITE** troops are the very best of all; Special Forces, Commandoes and the like, with the highest levels of training, morale and experience. Such troops are usually reserved for special missions such as deep infiltration, surgical strikes etc. Leaders for Elite units will most likely be LV 1, with a few LV 2; the only conceivable circumstances in which an LV 3 would be in charge of an Elite force would be as a political appointee or a corporate official sent to "look after the Company's interests" (guess who's going to get fragged first....).
The QUALITY DIE of an ELITE squad is a **D12**; Elite squads have **RED** activation markers.

**Summary table (compiled from the running text above; not printed as a grid on the page):**

| Quality Level | Quality Die | Activation Marker Colour | Leader LV notes |
|---|---|---|---|
| UNTRAINED | D4 | YELLOW | Usually LV3; occasionally LV2 or LV1 if ex-police/military |
| GREEN | D6 | GREEN | Any LV |
| REGULAR | D8 | BLUE | Any LV |
| VETERAN | D10 | ORANGE | Any LV, but more LV1/2 than LV3 |
| ELITE | D12 | RED | Most likely LV1, some LV2; LV3 only as political appointee |

---

## DETERMINING QUALITY AND LEADERSHIP: (p.10)

There are a number of ways in which you can determine the Quality and Leadership of a given unit prior to the game. If the unit is used through a series of games (or even a full campaign), then it will build up its own unit history and carry its characteristics over from game to game (perhaps modified upwards as the unit gains experience and battle honours, or downwards if it requires a large influx of "Fungs" to replace combat losses between battles).

When starting a unit from scratch, or just determining values for a one-off game, the best way is to put a selection of Activation Markers face-down and draw them at random - either drawing in turn for each unit, or else drawing a number of markers and then assigning them to various units as desired. The 'mix' of markers provided on the countersheets is biased towards 'average' units, so if you draw at random from the whole set of markers then you should end up with a balanced force of largely Regular troops with smaller proportions of Veterans and Greens, plus a few Elites if you are lucky and Untraineds if you are not. If the particular scenario or background warrants it, feel free to bias the mix of markers further in any desired direction - for example, if drawing markers for a very high-quality mercenary force you might agree to pick from a mix of mainly Veterans with average/good leaders, with just a few Regular and Green markers thrown in for that bit of uncertainty (even the best forces need raw recruits at some point to replace casualties). On the other hand, if you are generating a Planetary Defence Militia then you would probably use mostly Green markers, plus a few Regulars.

It is recommended that you do **NOT** use Untrained (yellow) markers in the mix when forming most organised military forces, as these are included mainly for armed civilian units and "rabble"; similarly do not include more than a very few (if any) Elite (red) markers unless you are specifically creating a Special Forces unit or similar.

Finally of course, you can simply lay down the unit qualities and leaderships when writing the scenario, making them fit in with the storyline behind the engagement - this is the method we most strongly recommend if you are prepared to do the preparation work, and will give the most realistic feel to your battles.

---

## UNDER-STRENGTH UNITS: (p.10)

Most players will, naturally, collect and organise their miniature forces according to a theoretical full-strength TO&E; if you are playing a linked series of games with the same units, the attrition due to casualties and lack of enough replacements between actions will soon reduce units to a "realistic" understrength level. If you are playing a one-off game, however, we strongly recommend using the rule below to put a bit of realism and unpredictability into your forces:

Once the figures have been organised into their full-strength units, roll a die for **EACH individual figure** in each unit; if the unit is deemed **FRESH** at the start of the game (see FATIGUE rules, **P.19**) then roll a **D10** for each figure, if it is **TIRED** use a **D8** and if **EXHAUSTED** a **D6**. All figures for which a **ONE** is rolled are removed from the unit before the game starts - they are assumed to be wounded or killed in a previous action (and not yet replaced), on sick parade that day, or otherwise unavailable for that battle. If the figure removed is the Squad Leader, then consult the rules for losing squad leaders in battle and use the same method to determine the new leader's ability. If the lost figure is a Support or Special Weapon trooper then his weapon is assumed either destroyed earlier or not serviceable for some reason - it may **NOT** be transferred to another squad member.

(Cross-reference: FATIGUE rules are stated to be on printed page 19, i.e. the Fresh/Tired/Exhausted fatigue levels used to pick D10/D8/D6 above are defined in a later chapter, not on these pages.)

**Under-strength unit die by Fatigue level:**

| Fatigue level | Die rolled per figure | Result of a "1" |
|---|---|---|
| FRESH | D10 | Figure removed (unavailable for battle) |
| TIRED | D8 | Figure removed (unavailable for battle) |
| EXHAUSTED | D6 | Figure removed (unavailable for battle) |

---

## LOSS OF UNIT LEADER: (p.10)

Should the Leader figure in any unit become a casualty (wounded or killed), the unit is immediately given **one SUPPRESSION marker**. The unit counts in all ways as if suppressed by fire, until such time as the marker is removed. This represents the confusion that surrounds the loss of the unit leader, until the next-in-line can take over and pull the unit together. Note that this suppression effect happens even with **HIGH MISSION MOTIVATION** units - it is pretty much instinctive on the part of the troops.

As soon as a leader is wounded or killed, the second-in-command of the unit will assume the duties of unit leader (should the same thing then happen again, the leadership passes yet further down the chain of seniority). When this occurs, it is necessary to determine what Leadership level the second-in-command actually is: he is likely to be of the same or lower level than the original leader, but may occasionally actually be HIGHER - there are cases where a unit is led by a particularly hated or mistrusted leader, but the assistant leader is much more respected.

To determine the level of the new leader, simply roll a single **D6**: on a roll of **1 or 2**, the new leader is **one level WORSE** than the original; on a **3, 4 or 5** he is the **same level**, and on a roll of **6** he is **one level BETTER**. Of course, you cannot have worse than a level 3 leader or better than a level 1, so any shifts outside this range do not apply (eg: the second-in-command to a level 3 leader is a level 3 on a roll of 1-5, and level 2 on a 6).

As soon as the new leader's level has been sorted out he will take command of the unit, which may then be activated as normal - the new leader's first action, naturally, is likely to be an attempt to remove the suppression marker.

Note that a **Confidence test** must be taken by the unit immediately the leader becomes a casualty, and there is a **high threat level** applied to this in most cases.

> **Boxed rule summary:** For LV of replacement Leader, roll D6: **1-2 = worse, 3-5 = same, 6 = better.**

**Replacement Leader D6 table:**

| D6 roll | New leader's LV relative to original |
|---|---|
| 1–2 | One level WORSE (capped at LV3; cannot go worse than 3) |
| 3–5 | Same level |
| 6 | One level BETTER (capped at LV1; cannot go better than 1) |

---

## BALANCING FORCES: ("Or 'WHY YOU CAN'T FIND THE POINTS VALUE LISTINGS'") (p.10)

Designer's note (summarised): the designers explain that they deliberately chose **not** to include a points-value/costing system for building "balanced" forces. Their stated reasons: any points system is inherently artificial and never really works, since a unit is more (and less) than the sum of its individually-costed parts; points systems also tend to encourage a "competition mentality" of rules-lawyering and loophole-hunting for a numerical edge rather than real tactical skill; and over-reliance on points produces dull "line 'em up and advance" games. Instead they recommend building scenarios around a one-line background/story premise, setting the Motivation and Fatigue levels for each side to suit that story, and using the random die-rolls already given above (Under-Strength Units, Determining Quality and Leadership) to let force composition and understrength status emerge organically rather than from a costed list. They close by joking that if enough players demand a points system, one might appear in a future supplement.

*(No new numeric rule beyond what is already given in "Under-Strength Units" and "Determining Quality and Leadership" above; this section contains no die rolls, thresholds, or tables of its own.)*

---

## Quick-reference disagreements / additions

Places where the full rulebook (pp. 8–10) states something the two-page Quick Reference summary does not cover, or states in more detail:

1. **Quality-die-per-troop-quality mapping is absent from the Quick Reference.** The QR (page 1, ARMOUR table) only tabulates Armour Die by armour type (D4/D6/D8/D10/D12 for Basic Battledress through Heavy Power Armour). It never states the parallel mapping of **Quality Die** to troop Quality level (UNTRAINED=D4, GREEN=D6, REGULAR=D8, VETERAN=D10, ELITE=D12), which chapter 3 (p.9) gives explicitly and which is needed to resolve every fire/confidence/reaction roll in the game (all of which use "Quality die of X").
2. **Activation Marker colour code is not in the Quick Reference at all.** Chapter 3 (p.9) defines YELLOW=Untrained, GREEN=Green, BLUE=Regular, ORANGE=Veteran, RED=Elite, with the printed NUMBER giving the LV (1–3). The QR never mentions activation-marker colour or how LV is recorded on it.
3. **Loss-of-unit-leader replacement procedure is not in the Quick Reference.** The QR's CONFIDENCE AND REACTION section notes "Unit Leader becomes a casualty" as a Confidence-test trigger (Threat Level 4/3/2 by mission motivation) but gives no rule for how a new leader's LV is determined. Chapter 3 (p.10) supplies this: immediate 1 Suppression marker, mandatory Confidence test, and a D6 roll (1–2 worse / 3–5 same / 6 better, capped at LV1–LV3) to set the new leader's LV.
4. **Command Level bypass mechanics reference chapter 3's definitions.** The QR's COMMUNICATIONS entry ("SHIFT DIE TYPE DOWN one type per Command Level being BYPASSED") presupposes the Command Level ladder (SQUAD, PLATOON, COMPANY, BATTALION, REGIMENT) and the one-level-at-a-time chain-of-command rule defined only in chapter 3 (pp.8–9), not restated in the QR.
5. **Under-strength unit generation (Fresh/Tired/Exhausted → D10/D8/D6, "1" removes the figure) has no Quick Reference equivalent** — this optional pre-game force-generation procedure, including the special case of a lost Squad Leader triggering the Loss-of-Unit-Leader rule, is absent from the QR entirely.
6. There is **no points-value/costing system** in Stargrunt II by design (chapter 3, p.10, BALANCING FORCES) — the QR likewise contains no points-cost figures, which is consistent, not a discrepancy, but worth noting explicitly for a programmer who might otherwise expect a costing table to exist somewhere in the rules.

No numeric conflicts (i.e., cases where the QR states one number/die and the rulebook pages read here state a different one) were found on these three pages.

## Illegible content

None. All text, numbers, die types, and table/box values on printed pages 8, 9, and 10 were legible.

<details><summary>Checker's corrections</summary>

Checked line by line against sg-p09.png (printed p.8), sg-p10.png (printed p.9), and sg-p11.png (printed p.10), including every number, die type, threshold, range, count, table cell and worked example, and cross-checked the "Quick-reference disagreements" claims against qr-p1.checked.md and qr-p2.checked.md.

1. **UNDER-STRENGTH UNITS paragraph (p.10) — was:** "...consult the rules for losing squad leaders in battle **(see LOSS OF UNIT LEADER, below)** and use the same method..." — **now:** "...consult the rules for losing squad leaders in battle and use the same method..." The parenthetical cross-reference "(see LOSS OF UNIT LEADER, below)" does not appear in the printed text and was silently inserted into what is presented as a verbatim quotation of the rule; removed so the sentence matches the page exactly. (The digest's own LOSS OF UNIT LEADER section immediately follows, so the cross-reference is not needed to find the rule.)
2. **Quick-reference disagreements, item 1 — was:** "The QR (**page 2**, ARMOUR table)..." — **now:** "The QR (**page 1**, ARMOUR table)..." The ARMOUR table (Basic Battledress D4 through Heavy Power Armour D12) is the last section of qr-p1.checked.md, not page 2; page 2 of the Quick Reference covers Fire Combat, Close Assault, and Artillery Support and has no armour-type table. The rest of the claim (that no Quality Die table for troop quality exists in the QR) is correct.

No other errors were found. Every quoted sentence, boxed rule summary, numeric value (troop counts 4–10/6–8, Platoon size 2–5, Company size 3–4 Platoons, Quality Dice D4/D6/D8/D10/D12, Activation Marker colours YELLOW/GREEN/BLUE/ORANGE/RED, LV range 1–3, the D6 replacement-leader table 1–2/3–5/6, the Under-strength Fresh/Tired/Exhausted D10/D8/D6 rule, and all worked examples — BLUE "2", ORANGE "3", GREEN "1", the one/two/three-levels-up support example, and the level-3-leader replacement example) was verified against the page images and matches exactly. The two grammatical slips flagged as "verbatim as printed" (p.8: "They function of these markers is fully explained..."; p.8–9: "This represents to the organisational...") are indeed printed exactly that way and are correctly preserved uncorrected. All five items (2, 3, 4, 5, 6) in the Quick-reference disagreements list besides item 1 were independently verified against both qr-p1.checked.md and qr-p2.checked.md and are accurate. Nothing on printed pages 8–10 was found omitted, and no rule content in the file is invented, misplaced, or presented as a rule when it is actually commentary.

</details>

---

# Chunk 04 · pp. 11–13 · 4 Basic principles of play

Source pages: printed pages 11–13 (PDF files sg-p12.png, sg-p13.png, sg-p14.png).

---

## UNIT INTEGRITY: (printed p.11)

A unit is said to be within Unit Integrity limits if all its figures can satisfy EITHER of the following criteria:

i) all figures in the unit are contained within a circular area 6" in diameter, OR:

ii) no figure in the unit is more than 2" (between base centres) from another figure in the same unit.

Thus a unit could be within Integrity limits by having its figures in a loose grouping (within a 6" circle), or in a line or column formation longer than 6" provided there is not more than 2" between any two adjacent figures.

Should a unit be deemed to have some of its figures outside these Unit Integrity limits, and those figures are NOT designated as a DETACHED ELEMENT, then the unit is DISORGANISED; on its next activation, the first action by its leader must be a REORGANISE action in which the player must move any out-of-integrity figures by the minimum necessary distances to regain integrity. While a unit is disorganised, it may do nothing (except react if close-assaulted).

> **Boxed rule (as printed):** "Unit integrity is EITHER all in 6" diameter cicle or each within 2" of next figure. If out of integrity, must REORGANISE before other actions." *(printed exactly this way; "cicle" is a printing typo for "circle," transcribed verbatim.)*

**Diagram (unit integrity):** Two example squads are shown.
- Squad **A** is drawn as four figures in a column, with three arrows (one between each adjacent pair) each labelled **2"**.
- Squad **B** is drawn as four figures inside a dashed circle labelled **6"** (diameter, shown as a diagonal arrow across the circle).
- Two further figures are marked **B1**, next to a marker labelled **DET** (detached element marker).

**Caption ("> Unit Integrity"):** "Squad A is in unit integrity as each member is within 2" of the next figure; Squad B is also in unit integrity because its members are within a 6" diameter circle; the two figures marked B1 have been designated a detached element, so may operate outside the integrity distance. If they were not designated as detached then Squad B as a whole would not be in unit integrity."

*(Designer's note tone: the surrounding photo/diagram material is illustrative, no additional rule content beyond the caption above.)*

---

## LINE OF SIGHT AND LINE OF FIRE: (printed p.11)

Some rules systems provide lengthy mechanisms, charts and formulae to determine whether lines of sight are blocked by intervening terrain, especially where the observer and the target are themselves at differing height levels. All that is required, however, is a reasonable attitude and a bit of common sense: "If you can stretch the tape-measure in a straight line between the two elements without the tape touching an intervening obstacle, then there is a clear line of sight (and hence line of fire, if within range)." As the relationship between model size and terrain scale is distorted anyway (see notes on scales and definitions), any more detailed method is actually pretty abstract and not all that relevant to play in the majority of cases; players who want to work it out mathematically in every case are free to do so.

Lines of sight/fire are blocked by raised ground, buildings and woods, unless the observer/firer is on terrain high enough that he may see over the obstacle. Smoke and other obscuration agents will also block sight and firing.

**Photo caption:** "The NAC squad (on the left) has a clear line of sight to the ESU squad in the bushes on the hill, but not to the second ESU squad concealed behind the hill." *(Photo shows a squad in the open with clear sight to a squad in bushes atop a low hill; a second squad is hidden behind the hill's reverse slope.)*

A clear line of sight/line of fire is required between firer and target for all fire combat EXCEPT indirect support fire; a clear line of sight is normally required for all observation and spotting attempts, UNLESS using remote sensors.

As the playing area of a STARGRUNT II game represents quite a small area, there is NO limitation to visibility distance on the table in NORMAL CONDITIONS (daylight, good weather and an assumed temperate Earthlike environment). Variations in any of these factors, however, may — at the agreement of all players — be deemed to limit overall sighting distances; some suggestions for other conditions (both climatic and overall environment) are given in the sections on WEATHER and EXOTIC ENVIRONMENTS pn P.57. *(printed exactly as "pn P.57" — apparent typo for "on p.57", transcribed verbatim.)*

All airborne craft are assumed to actually be flying considerably higher than the model's actual stand height, and are generally visible from anywhere on the table (unless there is a particular VERY tall terrain feature in the way) — conversely, such aircraft can also SEE anything on the table themselves, and thus potentially attack it.

> **Boxed rule:** "No limit on visibility in normal circumstances; line of sight exists unless physically blocked."

---

## MEASURING RANGES BETWEEN UNITS: (printed p.11–12)

As most activity in STARGRUNT II is carried out using GROUPS of figures (UNITS), the measurement of such things as ranges and lines of sight is not quite as simple as measuring between two single figures. Whenever a distance needs to be measured or a line determined between two units, players must measure from the approximate CENTRE of each group of miniatures (normally from the "middle" figure in the group). A certain amount of common sense and "fair play" needs to prevail here — most cases will not be too contentious, but sometimes it could make the difference between one Range Band and the next; in such cases it may be necessary to use an Umpire's adjudication or a die roll if players really can't agree in a gentlemanly manner.

It should be noted that using the notional "centre" of a group may mean that some figures in the unit may appear to be at closer or longer ranges individually, but it is always the distance to the group centre that is used for all game purposes.

*(continued on p.12, no new heading)* A similar situation can arise when some of the figures in a group are in one kind of cover, and others in different circumstances (eg: if two figures in the unit are behind a small bit of solid cover, and the rest are just in bushes). In this case, the standard ruling is that the type of cover or concealment applied to the unit is the one the MAJORITY (ie: more than half) of the unit are in. If a unit consisting of an even number of troops is split exactly half-and-half in two cover types, count the LESS protective cover as the default value (eg: if a six-man squad has three men in hard cover and three in soft cover, the unit would count as all in soft cover when fired on; if four of the troops were behind the hard cover and only two in the soft, then the whole unit would count as in hard cover).

In the same way, for a unit to be deemed "visible" for line-of-sight and line-of-fire purposes AT LEAST HALF of the unit's members must be in view of the firing/sighting element — thus if three of a six-man squad are fully out-of-sight behind a building or similar and the other three are in clear view, the unit as a whole is deemed visible for firing purposes.

**ALTERNATIVE RULE:** If the players prefer, and especially for small games with few units, if a unit has members split between two cover types (or some visible and some hidden) then the figures that are in the LESSER cover, or are clearly visible, may be fired on normally as if they were separate from their unit; the fire is conducted in the usual way, but when allocating any hits among the figures this is done ONLY between those in the sub-group fired at. Such fire may be carried out entirely at the discretion of the firer, but must only apply when the target group is in two or more different circumstances — it is not permitted to fire at a partial group if the entire group is in the same cover or circumstances.

When judging line-of-sight and line-of-fire to or from a vehicle, this must also be traced from the CENTRE of the model — thus if a vehicle model is partly hidden behind a terrain feature or building then it is only visible to the enemy if a line from the observer to the centre of the vehicle is not blocked by the terrain.

> **Boxed rule:** "All distances and ranges are measured to and from the CENTRE of any group of figures. IF MORE THAN HALF a unit is in cover or hidden, then whole unit is hidden."

---

## TARGET PRIORITY: (printed p.12)

This is an important rule, but (it must be admitted) one that will probably cause the most disputes between players. It concerns the selection of target unit(s) for an activated unit to fire at, if there is a choice presented to the player.

It is almost impossible to put down a watertight set of rules for this, as every situation will be different and must be judged on its own merits.

The basis of the TARGET PRIORITY rule is that: **ANY UNIT WILL TREAT AS A PRIORITY TARGET THE ENEMY UNIT THAT IS SEEN AS THE GREATEST THREAT TO THE FIRING UNIT ITSELF.**

This needs considerable amplification, so the following can be added to the general principle:

i) Units will generally engage an already-activated enemy unit rather than one that has not yet activated for that turn. [A unit that has already moved and/or fired has drawn attention to itself.]

ii) Units will normally engage enemies closer to them rather than ones further away, unless the nearer enemy poses less of a threat to the firer.

iii) Units will normally engage an enemy that is in the open, rather than one concealed or in cover, again unless the exposed element does not pose an immediate threat.

Every individual situation must be assessed on its merits, and a reasonable decision reached. As with any other rules disagreement, any real dispute can always be settled by the umpire or by a die roll.

> **Boxed rule:** "Any unit will treat as a priority target the enemy unit that is seen as the greatest threat to the firing unit itself."

*(No worked numeric example accompanies this section; no diagram is attached directly to Target Priority — the nearby diagram on this page illustrates Cover and Concealment, below.)*

---

## EFFECTS OF WOODS: (printed p.12)

Wooded areas on the table block lines of sight and fire, and can also offer concealment to troops and vehicles. Woods are defined as LIGHT or DENSE for unit movement purposes, but for all other game functions both types of Woods are treated the same.

Any unit that occupies a Wooded area must be declared to be either WITHIN the wood (if its Mobility type allows this), or on the EDGE of the wood. To be counted as on the EDGE of a wood, the majority of figures in the unit must be in contact with the defined fringe of the wood area (it is useful if woods are depicted on the table by a cloth or paper area dotted with model trees, rather than just using the trees alone — this gives a clearly delineated "edge" to the wood).

Units which are on the edge of a wood may fire normally at targets outside the wood, and count as being in SOFT COVER when fired at. Units that are actually WITHIN the wood may neither fire, nor be fired on, by direct fire weapons or small arms; they may only be engaged in Close Assault by infantry that are also inside the wood, or attacked by Indirect Fire (Artillery or Air attacks) targeted on the wood itself.

> **Boxed rule:** "Units on EDGE of woods are in soft cover. Units WITHIN woods may only be engaged by others in same wood, then only by Close Assault or Artillery."

---

## COVER AND CONCEALMENT: (printed p.12–13)

Infantry units (and vehicles) may adopt 'covered' positions in bushes and scrub, in wood fringes and so on; such positions count as the element being in SOFT COVER (a vehicle "hull down" has the same effect). The unit in cover may fire and perform other combat actions normally, but receives defensive bonuses when being fired at. To qualify for the benefits of the cover, the majority of figures in the unit must be in physical contact with the feature that they are claiming cover behind or within.

**Diagram:** Two labelled fire points, **Y** and **X**, each with its own arrow to squad **A** (a small group of figures behind an L-shaped wall) and a separate arrow to squad **B** (a larger group of figures in a clump of round bushes/scrub) — four arrows in total (Y→A, Y→B, X→A, X→B), showing the two firing directions onto each squad.

**Caption ("> Benefits of cover"):** "Squad A is hiding behind a wall; Squad B is in a clump of bushes. Against incoming fire from Point X, Squad A gets hard cover from the wall, and Squad B gets soft cover. From Point Y, Squad B is still in soft cover, but Squad A is counted as in the open as the wall only gives cover in one direction."

*(continued on p.13, no new heading)* If a unit is in cover of a solid object such as a wall, a clump of rocks or boulders, behind a hill crest or ridgeline etc., then they are taken as being in HARD COVER, which conveys greater benefits in terms of protection from fire than Soft Cover does.

Units in SOFT COVER always benefit from having their Range Die (Target Die) shifted up one type when fired at; units in HARD COVER get their die shifted up TWO types. Similar shifts are applied to the ARMOUR dice of units in cover — up one die for SOFT, or two for HARD cover.

A lot of cover, both soft and hard, is DIRECTIONAL — that is, it gives protection only against fire coming through the cover — for example, if troops are hiding behind a wall they will get a HARD COVER benefit from anyone firing at them from the other side of the wall, but NOT from any troops that get round behind them. If a unit is actually **within** an area of bushes, rocks or scrub (as opposed to hiding behind it) they may claim all-round cover.

> **Boxed rule:** "In SOFT cover = shift both Range and Armour dice up one type. In HARD cover = shift both Range and Armour dice up TWO types."

---

## UNITS IN POSITION: (printed p.13)

Being IN POSITION represents a unit making the best use of what cover or concealment is available, with each trooper finding himself a good firing position with as much protection as the terrain allows. The better trained (ie: higher Quality) the troops are, the more easily they will be able to go IN POSITION — their Leadership is also a factor, as a good leader can ensure that his troops are doing what they should: *"Funk - get your ****ing head DOWN or I'll save the Euries the trouble and shoot you MYSELF...."* *(flavour quotation, printed with the expletive rendered as four asterisks and "Euries" as printed — a faction/enemy nickname, undefined on this page.)*

Getting a unit IN POSITION takes one action, and needs a REACTION TEST roll. As no area of terrain on the table is ever really "clear", units may attempt to go IN POSITION even if out in the open — this indicates the men are prone and taking cover behind anything that is available — small rocks, clumps of scrub, small folds in the ground or whatever.

Of course, it is easier to go In Position when in decent cover than when out in open ground, and this is reflected in the Threat Levels applied to the Reaction test. If the unit is IN COVER (soft or hard), the Threat Level for the test to go In Position is **0**; for units in the open, it is **2**.

**Worked example (verbatim, italicised in original):** "Example: A Regular unit with a level 2 leader attempts to become IN POSITION; it rolls a D8 for its Reaction test - if unit is **in cover** the score must exceed **2** (LV + 0), but if **in the open** it must exceed **4** (LV + 2)."

Failing the reaction test means the unit does NOT go in position, and the action is wasted.

If the test is passed, the unit is marked with an IN POSITION marker and gains the benefits of being in position for as long as it does not move (it may freely carry out non-movement actions, eg: fire, observe, communicate etc.).

If a unit carries out a REORGANISE action while IN POSITION, it must take another reaction test (at the same levels as before) to see if it can REMAIN in position — failing this means the Reorganise action happens as normal, but the in position marker is lost.

When an IN POSITION unit wishes to move, the player has two choices:
- he may either spend an action to remove the IN POSITION marker (success is automatic in this case), and then move in his next action;
- alternatively, he may attempt to get the unit to move in the same action as he removes the IP marker: to do this he must take (and pass) a Reaction test at a Threat Level of **2** (whether the unit is in cover or in the open). Failing this test means the IP marker remains, and the unit cannot move — that action is lost. If the test is passed the unit may move as desired, using normal or combat movement to the player's choice.

---

## BENEFITS OF BEING IN POSITION: (printed p.13)

Units that are IN POSITION are more difficult to hit with both direct and indirect fire.

When an IN POSITION unit is fired on with direct fire, treat the RANGE as being ONE RANGE BAND GREATER than it actually is (so the Target Die will be shifted up one die type). This die shift is on top of any shift(s) due to soft or hard cover.

If the die shift puts the Target Die over a D12 then casualties are impossible.

Troops engaged by direct fire do NOT get an Armour Die shift for being IP — just the Range Die modification.

When figures from an IN POSITION unit are caught in the blast of any INDIRECT (Artillery) attack, shift their ARMOUR DIE up one die type (again, this is on top of any shifts due to cover) — this is because troops are less vulnerable to shrapnel and blast if they are prone and "hugging the ground". Thus troops that are in hard cover AND in position will actually benefit from shifting their die type THREE levels — two for the cover plus one for being IP.

This Armour modifier is an OPEN SHIFT, so if the targets' Armour Die should be shifted up over a D12 then apply any extra shifts to LOWER the IMPACT die of the blast.

**Worked example (verbatim, italicised in original):** "Example: Troops in Full Combat Armour (Armour Die D8) are caught in an artillery burst of D10 impact value; the troops are in HARD COVER and IN POSITION, thus getting THREE die shifts - this would shift their D8 to a D14 (which of course does not exist), so the die used is a D12 and the extra 1 shift is used to move the firer's IMPACT die from a D10 down to a D8."

> **Boxed rule (as printed, including a stray double-period after "(LV+2)."):** "One action to go "in position"; roll Quality die, exceed LV+0 in cover, LV+2 in open. Must REMOVE IP marker before moving; if trying to move without removing IP first then need reaction test first (LV+2). .
> When in postion, shift Range Die up one type when fired at by Direct fire, and shift Armour Die up one type for Indirect fire. Normal COVER shifts apply." *("postion" is a printed typo for "position", transcribed verbatim.)*

---

## FIELD DEFENCES: (printed p.13)

Field Defences covers the provision of man-made defensive positions such as hull-down emplacements for tanks and AFVs, trenches or foxholes for Infantry etc. Defenceworks like this should be represented on the terrain in such a way that they are clearly identifiable to all players, and agreed as such before the game; any unit that is declared to be occupying such a position gains the benefit of the defences, which provide HARD COVER against incoming fire (direct and indirect). Should the unit then move from that position it loses the benefit of the defenceworks; the defencework itself (being part of the terrain) naturally remains on the table and may be re-occupied later by either player's forces.

Given the timescale of the average SGII battle, field defences may only be used by forces that start the game deployed into these positions; the actual creation of such defenceworks is not possible within the time frame of a single game.

Most field defences such as foxholes and trenches give protection from all directions, though walls, barricades and berms will only give the protection to their front.

Units may go "In Position" while in field defences, thus gaining the cumulative benefits of the hard cover and being In Position. The usual IP rules apply as above.

*(Illustration: infantry figures prone in tall grass/undergrowth using cover, purely decorative — no additional rule text or caption on the page.)*

---

## Quick-Reference Disagreements / Additions

Comparing this chapter (printed pp.11–13) against the two-page Quick Reference summary:

1. **Cover die shifts — QR is a compressed match, not a discrepancy, but omits the DIRECTIONAL nature of cover.** The QR states "In SOFT cover = shift both Range and Armour dice up one type. In HARD cover = shift Range and Armour dice up TWO types," which matches the rulebook's boxed rule exactly. However, the QR does **not** mention that cover is DIRECTIONAL (protects only against fire from the direction the covering object faces) or the "majority of figures must be in physical contact with the feature" qualifying condition, or the all-round-cover exception for units actually *within* bushes/rocks/scrub rather than hiding behind them. A programmer using only the QR would not know to model cover as directional or contact-dependent.

2. **In Position (IP) — QR box matches the rulebook's boxed rule verbatim** (including the "postion" typo and the stray "(LV+2). ." double period), confirming both are the same source text. But the QR omits several implementation-critical details spelled out only in the full chapter text: (a) the Threat Level values of 0 (in cover) / 2 (in open) for the initial "go IP" reaction test are stated in the QR box, but the worked example with a Level‑2‑leader Regular unit rolling D8 (exceed 2 or exceed 4) is only in the full text; (b) the rule that IP benefits persist only "as long as it does not move," and that non-movement actions are unaffected; (c) the REORGANISE-while-IP interaction, which requires a second reaction test at the same Threat Levels to remain IP, is **not mentioned at all in the QR**; (d) the rule that if the Range Die shift for IP pushes the die past D12, casualties from that hit become impossible — **not in the QR**; (e) direct fire IP shift applies to Range Die only (no Armour Die shift), while indirect fire IP shift applies to Armour Die only — the QR box does state this correctly, but doesn't flag that hard-cover-plus-IP under indirect fire stacks to **three** die-type shifts, which is spelled out with a full worked example only in the main text; (f) the "open shift" behavior when a shift would exceed D12 — instead of losing the extra shift, it is applied downward to the **firer's Impact die** instead — is explained only in the full text and its worked example, not in the QR at all.

3. **Field Defences is entirely absent from the Quick Reference.** The QR's "COVER AND INTEGRITY" box covers unit integrity and IP but has no equivalent for man-made Field Defences (hull-down positions, trenches, foxholes providing HARD COVER, directional protection for walls/barricades/berms, the restriction that they can only be used by forces starting the game already deployed in them, and stacking with IP). A programmer relying solely on the QR would have no rule at all for foxholes/trenches/hull-down emplacements.

4. **Unit Integrity — QR box is a faithful condensation** ("Unit integrity is EITHER all in 6" diameter cicle or each within 2" of next figure. If out of integrity, must REORGANISE before other actions."), matching the rulebook's own boxed rule verbatim (typo included). However, the QR omits the DISORGANISED state name and the detail that while disorganised a unit "may do nothing (except react if close-assaulted)" — it only says "must REORGANISE before other actions," which does not make clear that a disorganised unit is otherwise completely inactive except for close-assault reactions.

5. **Line of Sight / Range measurement — entirely absent from the Quick Reference.** Neither QR page mentions: the "no limit on visibility in normal conditions" rule; that LOS/LOF is blocked by raised ground, buildings, woods, and smoke; that ranges/LOS are measured from unit CENTRES; the majority-rule for mixed cover/visibility within a unit (with the even-split-defaults-to-less-protective-cover clause); the Alternative Rule allowing partial-unit fire against sub-groups in different cover; or the special LOS-to/from-vehicle rule (traced to the model's centre). This entire topic — foundational to a programmer's LOS/targeting implementation — has no QR coverage at all.

6. **Target Priority — entirely absent from the Quick Reference.** The QR has no box or mention of the Target Priority rule (treat the greatest threat as priority target; prefer already-activated enemies, closer enemies, and exposed enemies, all "unless" caveats). This is a rule a programmer would need for any AI/priority-targeting logic and it does not appear in the QR summary.

7. **Effects of Woods — entirely absent from the Quick Reference.** The QR never distinguishes LIGHT/DENSE woods, the EDGE-vs-WITHIN declaration requirement, that edge units count as soft cover while within-wood units can only be fired on by other within-wood infantry (Close Assault) or Artillery/Air indirect fire. A programmer relying only on the QR would have no woods-specific targeting restriction at all (only the general SOFT/HARD cover shift rules), and could incorrectly allow direct/small-arms fire against troops within a wood.

---

## Illegible / Uncertain Content

None. All text, table cells, boxed rules, diagram labels, and captions on printed pages 11, 12 and 13 were legible at the resolution provided (verified with additional pixel-level zoom crops on the "cicle", "postion", "pn P.57", and flavour-quote passages).

<details><summary>Checker's corrections</summary>

Checked line by line against sg-p12.png (printed p.11), sg-p13.png (printed p.12) and sg-p14.png (printed p.13), including 2x–3x pixel-level zoom crops on both diagrams (unit integrity, cover and concealment), the "cicle" / "postion" / "pn P.57" typo passages, the IN POSITION boxed rule's stray double period, the flavour quotation, and both italicised worked examples. All rule text, boxed-rule wording, numbers, die types, thresholds and headings matched the source exactly; the QR cross-reference section's claims were re-checked against qr-p1.checked.md and qr-p2.checked.md and confirmed accurate. Four corrections were made, all to diagram descriptions and worked-example transcription completeness — no rule content, number, die type or threshold was wrong.

- Unit Integrity diagram, Squad B figure count — was "Squad B is drawn as five figures inside a dashed circle" — now "Squad B is drawn as four figures inside a dashed circle" (a pixel-zoom crop of the circle shows exactly four miniature figures: one top-centre, one left-centre, one right-centre, one bottom-centre — not five).
- Cover and Concealment diagram, arrow description — was "Two arrows marked Y and X point at two squads: A ... and B ..." (implying one arrow each) — now describes four arrows: a separate arrow from Y to A, from Y to B, from X to A, and from X to B (a pixel-zoom crop confirms both Y and X each have two arrows, one to each squad, four arrows total).
- UNITS IN POSITION worked example — was quoted starting "A Regular unit with a level 2 leader attempts..." — now starts "Example: A Regular unit with a level 2 leader attempts..." (the printed italic text begins with the word "Example:", which the prior transcription dropped; instructions require worked examples to be transcribed in full).
- BENEFITS OF BEING IN POSITION worked example — was quoted starting "Troops in Full Combat Armour..." — now starts "Example: Troops in Full Combat Armour..." (same omitted lead-in word, corrected for the same reason).

</details>

---

# Chunk 05 · pp. 14–15 · 5 Setting up the game, 6 Game sequence

Source: scanned pages `sg-p15.png` (printed page **14**) and `sg-p16.png` (printed page **15**).

---

## 5. SETTING UP THE GAME (printed p.14)

### PRELIMINARIES - SETTING UP THE GAME: (p.14)

It is strongly recommended that STARGRUNT II games are played using SCENARIOS designed either by the players themselves or an umpire, which will usually specify things like force dispositions, objectives and so on; for some examples, refer to the SCENARIOS section on **P.62**. If you don't have a scenario prepared for the game or don't want to bother with one, then you may choose to play a simple ENCOUNTER or ATTACK/DEFENCE battle. The different set-up procedures for these types of game are detailed below.

### TERRAIN SET-UP: (p.14)

Before the game starts, the terrain must be set up either in accordance with the scenario to be played or otherwise to the satisfaction of the players; a good method for one-off games without a detailed scenario is that one player lays out the terrain, and the other then decides which end of the table he would prefer to play from. Assuming a conventional rectangular playing area, the table edge nearest to each player is termed his "baseline" - in most cases the two players' baselines will be opposite sides of the table. As a general rule, a player's units may only enter and exit the table over his own baseline, unless specified otherwise by the scenario being used (a possible exception would be where one of the player's objectives is to get some or all of his units off the table via his OPPONENT'S baseline).

For most STARGRUNT II battles the terrain should be fairly cluttered and close, with plenty of cover in the form of vegetation, rocks and small hills/depressions; remember that few areas of "open" ground are actually flat and featureless in reality, even in desert or arctic areas. Areas of open space can be left in places if desired to form natural killing zones and choke points, but don't be surprised if most players avoid these like the plague!

### DEFINING TERRAIN EFFECTS: (p.14)

The terrain on the table has a number of effects on play - it can hinder (or sometimes assist) movement, block sight and fire lines, provide cover and protection for units and so on. It is important that both players agree before the game starts exactly what each piece of terrain represents. For example, areas of bushes and scrub provide SOFT COVER for troops, but if your vegetation consists of bits of lichen (model railway "moss") spread around the table you will need to define which clumps of it are actually sufficient to provide cover and which just represent isolated bushes. You might say that a clump or row of lichen of a certain size is enough for a squad to take cover in, while a few scattered small bits indicate an area of ground with enough light scrub and ground cover to impede certain types of movement.

The same thing applies to hills and raised areas - you must agree before the game which ones are low enough to see over and which block line-of-sight, which slopes are too steep for vehicles, and so on. Similarly, are any water areas (streams, rivers or lakes) on the table shallow enough for troops and vehicles to ford, or are they passable only to units with proper amphibious capability? Are gaps between hills or buildings wide enough for vehicles to pass, or are they only accessible to infantry?

[The reason we have left a lot of this open to agreement is that no two players' model terrain collections are ever likely to be exactly the same - what one player uses as a wood may be just a clump of bushes to another, and one player's rough ground area may be another's impenetrable swamp!]

*(An illustration occupying roughly the bottom quarter of the LEFT column below this section — column-width, not full-page — shows infantry figures in power armour taking cover behind sandbags/rubble; no caption text, only an illegible artist's signature scrawl at bottom right of the picture.)*

### ENCOUNTER BATTLES: (p.14)

This is the simplest form of game. No units are deployed on-table until the game starts; both forces will enter the table from their baselines on the first turn of the game, and fight a mobile battle for possession of the table. Normally, neither force may employ hidden units, with the exception of any SNIPERS they have who may attempt to go into hiding during the game (see Sniper rules). Similarly, no fieldworks or pre-laid minefields may be used by either side. An encounter battle will normally be fought until one side withdraws from the table, either voluntarily or through adverse confidence results.

### ATTACK/DEFENCE BATTLES: (p.14)

In an attack/defence game, one player is designated the "defender"; his forces are deployed on the table at the start of the game, while the other player - the "attacker" - moves onto the table from his baseline in the first turn, as per an encounter battle. Exactly where on the table the defender can deploy his forces is up to agreement between the players and will probably be affected by the layout of the terrain; in most cases we suggest the defender should be allowed to deploy his forces up to the middle of the table (ie: halfway between the two baselines). The game can end as for an encounter battle, with one force being driven off the table, or more specific objectives may be agreed - for example, the attacker may win by taking certain terrain features that are held by the defender's forces at the start of the game.

### OBJECTIVES AND VICTORY CONDITIONS: (p.14)

Each player in the game should be given an OBJECTIVE for his troops, which sets out what his force is trying to accomplish in their mission. The type of objective will depend on the scenario being played, and in most cases will be fairly obvious from the scenario itself - if one player is laying an ambush for the other, then the ambusher's objective will be to cause as much damage to the other player's forces as possible without taking heavy casualties himself; the other player will have as his objective to get his forces safely across the table without getting them destroyed by the ambush.

In most cases the opposing players' objectives will be mutually exclusive, that is if one player achieves his objective this will usually prevent the other player from succeeding in his. This need not always be the case, however, as it is possible to design objectives so that both players can achieve their own successfully - this then becomes a race to see who succeeds first, with the possibility of a "drawn" game if both fulfil their objectives at virtually the same time.

Wherever possible, players should also be given a SECONDARY OBJECTIVE to attempt if they are unable to fulfil their primary one - in a simple attack/defence battle the defender might have as his primary objective to hold his defensive positions, but a secondary objective of inflicting maximum damage on the attacking enemy before withdrawing his forces if holding the line appears hopeless. If a player can fulfil his secondary objective while denying the enemy the chance to succeed in their own objectives, he may still be able to win the game.

In most games, a player may claim to have fulfilled his VICTORY CONDITIONS if he achieves his primary objective, or his secondary objective while ensuring that the opposition cannot succeed in their own primary objective. The game will usually end when one player can demonstrate that he has achieved his Victory Conditions, and this player is judged to have won.

We strongly suggest that each player is NOT made aware of what his opponent's objectives and victory conditions are, as this preserves the element of confusion about enemy intentions ands adds much suspense to the game. If an umpire is used then he can write up the objectives and hand them out to each player; if you do not have an umpire then a useful idea is to write down several different objectives on cards and have each player pick one at random - though this may sometimes give rise to some odd combinations, it can lead to some amusing games!

*(Printed page number: 14)*

---

## 6. GAME SEQUENCE (printed p.15)

### OVERVIEW OF GAME SEQUENCE: (p.15)

SGII is played as a series of GAME TURNS. During each turn, the players alternate in choosing one of their units (squads) to be ACTIVATED - they then make all the actions they wish to do with that unit; it is then the opponent's chance to pick one of his units to activate. As each squad gets activated, its quality/leadership counter (also referred to as an Activation Marker) is turned over to indicate that the unit has finished its activation for that turn. The only way that unit can then perform any other actions during that particular game turn is if it has an "extra" activation passed down to it by a senior command element (see rules for transferring actions, **P.16**); otherwise it must wait until the following game turn before being able to activate again.

Under most circumstances, there is no restriction on which unit a player may activate at which time - he may freely choose any of his still-unactivated squads, regardless of quality levels, leadership or any other factors.

### ACTIONS AND ACTIVATIONS: (p.15)

Please read the following definitions of these two terms carefully, as they appear throughout the SGII rules and are one major way in which the basic gameplay differs from DSII.

An **ACTIVATION** is when a player decides to do something with a particular unit, when it is his turn to do so in the game sequence. The ACTIVATION of a unit allows it to move, shoot and/or do other various things, after which its quality/leadership counter is flipped over to indicate that it has "done its thing" for that turn. Once a unit has been activated and has had its Activation Marker flipped over, it may not do anything else that game turn except in certain special circumstances (eg: if it is close-assaulted).

An **ACTION**, on the other hand, is the unit doing ONE THING such as moving, firing etc. Some actions are carried out by the entire unit (eg: movement), while some only concern the unit leader (eg: communication attempts) or a special weapons trooper (eg: firing a missile at a point target) - in all cases, however, one action is taken up irrespective of how many unit members it directly involves. During each ACTIVATION, a unit normally gets to perform TWO ACTIONS - for example, it might move (1 action) and fire small arms (1 action), OR move double-distance (2 actions), OR fire (1 action) while the squad leader attempts to communicate with another unit (1 action), and so on.

If a squad is all together (all men within unit integrity distance), one ACTION normally affects all troops in the squad, if desired (eg: it takes one action to make them all MOVE); if part of the squad has been divided off as a DETACHED ELEMENT for any reason (see **P.17**), then one action affects only ONE of the separated parts of the unit - so to get them both to move the squad leader would have to expend BOTH his actions, one for each part.

Note that even if all the squad is together, one action NEED NOT affect ALL members of the squad - the player may decide to have some squad members (eg: the ordinary troopers and the SAW gunner) fire at one target, while he uses the other action to make the squad's missile launcher fire at another target such as an enemy vehicle.

> **[Boxed callout, ruled border, p.15, positioned between this section and the next]**
> Players alternate in activating UNITS. ACTIVATION allows TWO ACTIONS.

### SEQUENCE OF PLAY - THE GAME TURN: (p.15)

One of the central mechanisms of STARGRUNT II is the turn sequence. While many other games use either a simultaneous or an alternate move sequence, consisting of several steps that must be followed by both players in a set order, we instead use a system we call the **INTEGRATED GAME SEQUENCE**. This functions by each player taking it in turn to move, fire and/or make other actions with any ONE squad-sized UNIT of his choice, following which the opposing player may make similar actions with one of his units; the first player may then act with another unit, and so on until all desired units on both sides have had their turn to do something. This completes one full GAME TURN. The key to this system is that when a player decides to do something with any particular unit (this is termed as ACTIVATING the unit), that unit gets to perform ALL of the actions it wishes to do for that turn at that one point, and in effectively any order the player wishes - the unit may move, then fire; fire, then move; or conduct any other combination of permissible actions. Once a unit has performed all the actions the player wishes, its ACTIVATION MARKER is inverted to show that it has used up its ACTIVATION for that turn; a unit with an inverted Activation marker may perform NO further actions in that Game Turn, except in very special circumstances.

[NOTE that at no time is a Unit forced to make any actions, unless it is as a result of adverse Confidence levels; in the Game Turn, each player may activate all, some or none of his forces.]

A player may elect to PASS on an activation (that is, to forego his right to activate a unit, and thus force his opponent to activate two units in succession) ONLY if at that time he has fewer UNACTIVATED units (with face-up Activation Markers) than his opponent does.

Once both players have activated all the units that they wish to, a brief TURN END PHASE occurs during which all Activation Markers are turned face-up again in readiness for the next Turn.

The player with the SMALLER number of units on the table has the choice of whether to have the first activation of each turn, or to make his opponent activate first; this can be decided differently for each turn if desired. [OPTIONS: if preferred, the first activation of each turn can be decided randomly by die roll, or can alternate between players in each successive turn - use whichever method you are happiest with.]

Once one player has activated the LAST unit he has (or the last he wishes to activate that turn), the opposing player may activate any remaining units he has, one at a time, until he too has done all he wishes in the turn.

The use of the INTEGRATED GAME SEQUENCE ensures the full involvement of all players at all times in the game, and requires them to make continual tactical decisions about the exact order in which they will activate their individual units - for instance, if a unit is particularly threatened, do you activate it immediately to get it out of trouble (thus perhaps doing exactly what your opponent wants you to do!), or do you instead activate another unit that will maybe cause him some problems in return and make HIM re-think his plans?

Players are encouraged not to view each Game Turn as a separate period of time, but to think of the alternating sequence of activations as an on-going, fluid representation of the ebb and flow of the battle.

*(Note on source layout: on the printed page this heading and its opening sentence sit at the bottom of the LEFT column and are cut off mid-sentence after "...ACTIVATING the unit), that"; the sentence resumes at the very top of the RIGHT column with "unit gets to perform ALL of the actions...". The two halves are joined above into one continuous passage, in the same wording and order as printed, with nothing added or omitted.)*

### THE "TURN END PHASE": (p.15)

When both (or all) players have conducted the Activations for all desired units, this completes the Game Turn. The TURN END PHASE consists of ALL inverted Activation Markers being turned face-up again in readiness for the next Game Turn to start, and moving any markers that are currently on the "Inbound Chart" (see **P.44**). If players are recording the elapsed turns of the game using the turn track on the Inbound Chart, move the turn marker at this time.

*(A photographic/illustrative image appears at the bottom of the right column showing two power-armoured troopers, one crouching, one standing and signalling with a raised arm; no caption text.)*

*(Printed page number: 15)*

---

## Quick-reference disagreements / gaps

The two-page Quick Reference summary (`qr-p1.md`/`qr-p2.md`, checked versions) does not cover Chapter 5 (game setup, scenarios, objectives) at all, and covers Chapter 6's activation mechanic only in a single opening line: "All units can perform TWO ACTIONS when activated; SOME actions require a REACTION TEST to be passed before they may be carried out, others may be done without a die roll. Unit may perform TWO fire actions, but only with DIFFERENT weapons; any single weapon may only fire ONCE per game turn." Comparing that to the full text on printed pp.14–15 (confirmed against both checked QR files — neither mentions baselines, objectives, victory conditions, encounter/attack-defence battles, terrain agreement, or the pass/first-activation rules):

- **Not in the QR at all (setup, Ch.5, p.14)**: the entire PRELIMINARIES/TERRAIN SET-UP/DEFINING TERRAIN EFFECTS/ENCOUNTER BATTLES/ATTACK/DEFENCE BATTLES/OBJECTIVES AND VICTORY CONDITIONS material — baselines, soft-cover-terrain-definition-by-agreement, encounter-battle restrictions (no hidden units except snipers, no fieldworks/pre-laid minefields), attack/defence deployment convention (defender up to halfway), and the objective/secondary-objective/victory-condition framework. A programmer working only from the QR would have no model at all for scenario setup, table halves, or win conditions — this is pure gap, not contradiction.
- **Activation/turn mechanics not in the QR (Ch.6, p.15)**: the QR never explains the alternating INTEGRATED GAME SEQUENCE itself — i.e., that players take turns activating ONE unit at a time (not all units at once), that the Activation Marker is the unit's own quality/leadership counter flipped face-down once used, that a player may PASS an activation only when he currently has fewer un-activated units than his opponent, that the side with fewer on-table units chooses who activates first each turn (with optional random/alternating variants), or the TURN END PHASE's role in flipping markers back up and advancing the Inbound Chart turn track. The QR's "TRANSFERRING ACTIONS" and "DETACHED ELEMENTS" entries reference the underlying activation system but assume the reader already knows how base activation works — that base mechanic is defined only in the full rulebook on this page, not in the QR.
- **Consistent, no contradiction found**: the QR's "TWO ACTIONS per activation" and "one action may affect the whole squad, or a detached element separately" language matches the full rulebook's ACTIONS AND ACTIVATIONS section exactly in substance (two actions per activation; one action can move/fire the whole in-integrity squad; a detached element needs its own action). The QR's note that "any single weapon may only fire ONCE per game turn" and "TWO fire actions... only with DIFFERENT weapons" is not stated on these two pages at all (it must appear elsewhere in the fire-combat chapter) — pages 14–15 do not confirm or contradict it, they simply don't address weapon-firing limits.

<details><summary>Reader's notes</summary>

- **Page 14 layout**: two columns. Left column: PRELIMINARIES - SETTING UP THE GAME, TERRAIN SET-UP, DEFINING TERRAIN EFFECTS (ending in a bracketed italic-style aside in square brackets, followed by a column-width illustration of infantry in cover — the illustration occupies only the left column, not the full page). Right column: ENCOUNTER BATTLES, ATTACK/DEFENCE BATTLES, OBJECTIVES AND VICTORY CONDITIONS. Each heading is set in a grey horizontal banner bar. No tables appear on this page.
- **Page 14 typo, transcribed verbatim**: "...as this preserves the element of confusion about enemy intentions **ands** adds much suspense to the game." Confirmed at 2x zoom against the source scan — "ands" is printed exactly as shown (evident typo for "and").
- **Page 15 layout / column-flow complication**: the page is two columns, but the running prose does NOT stay within one column per heading — the heading "SEQUENCE OF PLAY - THE GAME TURN:" appears near the bottom of the LEFT column, and its body text is cut off mid-sentence ("...that when a player decides to do something with any particular unit (this is termed as ACTIVATING the unit), that") at the bottom of the left column; the sentence continues at the very TOP of the RIGHT column ("unit gets to perform ALL of the actions it wishes to do for that turn..."), before the right column's own heading "THE 'TURN END PHASE':" appears further down. This digest now places the whole continuous passage under its own correct printed heading, SEQUENCE OF PLAY - THE GAME TURN, joining the two column-halves into one passage exactly as printed (see the inline layout note under that heading above). The actual reading order on the printed page is: left column top-to-bottom (OVERVIEW OF GAME SEQUENCE; ACTIONS AND ACTIVATIONS; boxed callout "Players alternate..."; SEQUENCE OF PLAY - THE GAME TURN heading + opening paragraph, cut off) → right column top-to-bottom (continuation sentence "unit gets to perform ALL..." through the end of that section's material; THE "TURN END PHASE" heading and text; bottom illustration).
- No numbered tables, dice, thresholds, or worked examples appear anywhere on either of these two pages (printed pp.14–15) — the content is entirely descriptive/procedural prose plus two illustrations (one on each page) with no captions.
- Bold/capitalised emphasis (e.g. ACTIVATION, ACTION, ACTIVATED, GAME TURN, INTEGRATED GAME SEQUENCE, DETACHED ELEMENT, SOFT COVER, OBJECTIVE, VICTORY CONDITIONS, ENCOUNTER, ATTACK/DEFENCE) is reproduced as printed (all-caps in the source, not italics/bold typeface) except where the source itself uses genuine bold type for the terms **ACTIVATION** and **ACTION** the first time each is formally defined in the "ACTIONS AND ACTIVATIONS" section, and **INTEGRATED GAME SEQUENCE** the first time it is named in "SEQUENCE OF PLAY" — these are rendered in bold above to match. Note also the source's own inconsistency, reproduced faithfully: "its ACTIVATION MARKER is inverted..." (both words capitalised) followed shortly after by "...an inverted Activation marker may perform NO further actions..." (only "Activation" capitalised).
- Page-reference citations embedded in the prose (P.62, P.16, P.17, P.44) are printed exactly as shown, referring to the rulebook's own printed page numbers (not this scan's PDF page numbers).
- Nothing on either page was illegible; no numbers were guessed.
- No designer's-note sidebar boxes (of the kind seen elsewhere in the book, e.g. italicised "Designer's Note") appear on these two pages — the only bracketed asides are the "[The reason we have left a lot of this open to agreement...]" passage on p.14 and the "[NOTE that at no time is a Unit forced...]" and "[OPTIONS: if preferred...]" asides on p.15, all transcribed in full above since they are short and rules-relevant (the first explains WHY terrain effects are left to player agreement; the latter two are substantive procedural notes, not flavour).

</details>

<details><summary>Checker's corrections</summary>

- Chapter 6, section placement — was: the right-column continuation sentence ("unit gets to perform ALL of the actions...") through "...ebb and flow of the battle" was spliced into the ACTIONS AND ACTIVATIONS section (after the boxed callout), with a "Reader's notes" explanation saying it was placed there "for readability" — now: that whole passage (which on the page is the continuation, across the column break, of the SEQUENCE OF PLAY - THE GAME TURN heading's opening sentence) is moved to its own correct heading, SEQUENCE OF PLAY - THE GAME TURN, joined seamlessly with the opening sentence exactly as printed. This was misplaced content: the first-pass reading was textually complete and accurate, but filed under the wrong heading, which would mislead a programmer looking for "what happens during SEQUENCE OF PLAY" versus "what ACTIONS AND ACTIVATIONS means."
- p.14, illustration caption note — was: "(A full-page illustration below this section shows infantry figures in power armour taking cover behind sandbags/rubble; no caption text.)" — now: corrected to note the illustration is column-width (confined to the left column), not full-page, and that it carries an illegible artist's signature scrawl (no other caption text). This was a commentary/description error, not a rule, but was inaccurate as written.
- p.14, "Page 14 layout" bullet in Reader's notes — was: described the same illustration as "a full-width illustration of infantry in cover" — now: corrected to "column-width illustration ... confined to the left column, not the full page," matching the fix above.
- Reader's notes, "Page 15 layout" bullet — was: stated the digest "places the full continuous passage under ACTIONS AND ACTIVATIONS above ... since the callout box interrupts the left-column text at the same point the reader must jump to the right column" — now: updated to describe the corrected placement (passage now under its own SEQUENCE OF PLAY - THE GAME TURN heading) while keeping the accurate physical-layout description of the column break itself.
- All other prose, numbers, page cross-references (P.62, P.16, P.17, P.44), the "ands" typo, the bracketed asides, the boxed callout, and the "Quick-reference disagreements / gaps" section were checked word-for-word against the page images and the checked QR files and found accurate; no other content was added, removed, or changed.

</details>

---

# Chunk 06 · pp. 16–18 · 7 Actions

Source: STARGRUNT II (Jon Tuffley, Ground Zero Games, 1996). Pages cited are PRINTED page numbers (PDF page = printed page + 1). This digest covers printed pages 16–18 (sg-p17.png, sg-p18.png, sg-p19.png).

---

## AVAILABLE ACTIONS: (p.16)

When a unit is ACTIVATED, its LEADER is able (in normal circumstances) to perform TWO ACTIONS. The possible actions are divided into two types: MOTIVATION ACTIONS which consist of the Leader getting the rest of the troops in the unit to do something (eg: to move or fire) and LEADER ACTIONS which are the Leader himself doing something (such as communicating with another unit, observing for support fire etc.). The main types of actions available are as follows - certain ones require dice tests to be rolled successfully before the action is carried out, as noted.

### MOTIVATION ACTIONS:

| Action | Test required |
|---|---|
| MOVE (normal or combat movement)* | No test required. |
| MOVE OUT OF COVER | Reaction test required if SHAKEN or lower confidence. |
| FIRE SQUAD SMALL ARMS** | No test required. [May INCLUDE firing support weapons at same target] |
| FIRE SUPPORT, SPECIAL or HEAVY WEAPON** | No test required. |
| CLOSE-ASSAULT | Reaction test required. [Takes up full activation, ie: 2 actions] |
| REORGANISE UNIT | No test required. [Includes Medical Treatment of wounded if appropriate] |

### LEADER ACTIONS:

| Action | Test required |
|---|---|
| COMMUNICATE* | Communication test required. |
| OBSERVE* | Spotting test required IN SOME CIRCUMSTANCES. |
| REMOVE SUPPRESSION* | Suppression removal test required. |
| FORM DETACHED ELEMENT* | No test required. |
| RALLY UNIT | Rally test required. |
| TRANSFER ACTION* | Communication test normally required (unless in direct contact). |

\* Actions marked with an asterisk on the table above may be DOUBLED UP, ie: the SAME action carried out (or attempted) TWICE within one activation, using one action for each attempt. Actions NOT marked thus may only be attempted ONCE in a given turn, but may (unless specified otherwise) be carried out along with another action.

\*\* Unit may perform TWO fire actions, but only with DIFFERENT weapons; any single weapon may only fire ONCE per game turn.

This is just a list of the most common actions; other special or unusual actions may well be required in some games, so feel free to add to this list as desired provided everyone agrees to it.

> **Boxed rule summary:** All units can perform TWO ACTIONS when activated; SOME actions require a REACTION TEST to be passed before they may be carried out, others may be done without a die roll.

---

## COMMUNICATIONS: (p.16)

When it is necessary for two units to communicate, the success or failure of the attempt is resolved as follows:

Take the POORER of the Leadership Values of the two communicating units (ie: the numerically-higher LV), then roll a die type equivalent to the Quality level of the unit making the communication attempt (ie: the "sender" of the communication). For the communication to be successful, the die score must EXCEED the worst (ie: higher number) LV.

**Example:** *If a REGULAR Platoon Command element with LV1 is trying to communicate with a GREEN squad leader of LV2, a D8 is rolled (for the REGULAR status) with a 3 or better needed on the die (ie: to exceed the poorer of the LVs, which is 2).*

*If a GREEN/3 unit was trying to communicate with a VETERAN/2, a D6 would be used to try and roll 4 or better.*

This roll actually simulates quite a lot of things, such as whether the communication is clear or garbled, does it get acted on properly, and can a panicky junior officer under fire get the co-ordinates right when he requests support!

If the communication attempt is between two units that are more than one command level apart in the chain of command (eg: a Company command unit communicating with a Squad) then REDUCE the die type used by one for each additional command level between the two units.

Note that certain specialised communications, particularly calling for support fire, use variations of this rule - they are fully explained where they occur.

> **Boxed rule summary:** Roll QUALITY DIE of SENDER - for success, EXCEED POORER LV (out of sender and receiver). SHIFT DIE TYPE DOWN one type per Command Level being BYPASSED.

---

## TRANSFERRING ACTIONS: (p.16)

One of the key uses of actually having command elements (eg: Platoon or Company commanders) present on the table is that in certain circumstances they can "transfer" one or both of their own actions (when they are activated as a unit) down their chain of command to a subordinate unit or units, thus allowing the subordinate to take an "extra" activation in a turn whether or not it has already used up its own activation.

For a superior officer to transfer an activation, he must make a successful Communication action in the same way as normal communications (see rules above). For example, for a Company commander trying to activate one of his Platoon commanders the die would be unmodified (this is a "normal" command chain link), but if he was trying to directly activate one of the platoon's SQUADS (thus bypassing the platoon command element) he would drop 1 die type for the communications roll.

If the communications action is successful, then the subordinate unit may immediately make a full ACTIVATION (two actions), just as though it was on its own normal activation turn; this is carried out BEFORE the opponent's next activation occurs, as it is all considered to be part of the superior commander's activation.

Note that the superior only has to use ONE of his actions in order to give the subordinate a full 2-action activation, and thus may attempt to communicate with and activate TWO subordinate units in the one turn if he wishes (though both must be resolved at the same time).

It is perfectly allowable for a subordinate activated in this way to in turn transfer his action(s) down to his own subordinates, subject to the usual rolls for success - thus it is theoretically possible that a Company commander could transfer his actions to two of his Platoon commanders, who could then in turn activate two squads each - thus the Company CO's activation actually results in FOUR squads being able to take extra actions, all at the same time, before the enemy can react to them; this is of great use in organising a final assault on a defended position, or moving up reserves, and is thus exactly the kind of thing that commanders are SUPPOSED to be used for; it is one of the quite reasonable benefits of having senior command on the table (balancing the tendency for them to become "fire magnets:" as soon as they appear!).

If a communications roll fails, it is assumed that the message either did not get through or was misunderstood (deliberately or otherwise!) and the action is wasted.

**Special note:** the above mechanism assumes reasonable battlefield communications, eg: by headset radio etc. EW may affect this in the same way as it affects any other communications.

If a superior commander is actually within 6" of a subordinate element, it is deemed to be within direct contact range and may transfer actions automatically without die rolls or risk of jamming - hence the advantages of "leading from the front", even on the future battlefield!

> **Boxed rule summary:** Roll as for COMMUNICATIONS, with Commander as "sender". If successful, receiver unit may immediately make full activation (2 actions). Commander can attempt to re-activate 2 subordinate units per turn, each with one Communication action.

---

## THE REORGANISE ACTION: (p.17)

"Reorganise" is a general action that can encompass a number of minor events: basically it involves the leader getting his squad back into good order, pulling in stragglers that have got themselves out of Unit Integrity and repositioning men to the best advantage of the unit. When a Reorganise action is used, the overall position of the squad does not alter - thus it is not "movement" as such - but individual figures may be moved around short distances in order to restore the conditions for unit integrity, change formation, move individuals into better firing positions and so on. During this action, Medics or other troopers are assumed to be able to move around among any wounded figures in order to provide treatment. Any or all of the figures in a unit may be moved in any combination of these ways within one Reorganise action. Although players should be allowed reasonable freedom in positioning figures during a Reorganise action, care should be taken that it is not misused by allowing the overall position of the unit to "creep" in an advantageous direction - if you want the whole unit to move, you must use a Move action!

A Reorganise action MAY be taken while a unit is SUPPRESSED, but only if the unit is currently in some sort of COVER (soft or hard). Units in the open cannot reorganise while suppressed.

> **Boxed rule summary:** REORGANISE allows repositioning of individual figures, restoring unit integrity and medical treatment of casualties. MAY be done while SUPPRESSED, only if unit is IN COVER.

*Illustration below the box: two power-armoured troopers standing together (no caption text).*

---

## THE RALLY ACTION: (p.17)

If a unit is suffering from lowered Confidence, it is possible for a superior command element to attempt to RALLY the troops - that is, to attempt to boost their morale and restore their Confidence Level. Firstly, the command unit in question must announce it is using an action for RALLYING, and indicate the unit it is trying to Rally; a Communication test must then be made (unless in direct contact), with the usual modifications if more than one command level exists between the two units.

If the communication attempt is successful, then a Rally test is rolled:

A Rally Test is similar to a normal Confidence test, and the unit being rallied rolls the usual die type for its Unit Quality; the score that must be exceeded is the SUM of the LEADERSHIP VALUES of both the unit testing and the Command Unit; if the score rolled exceeds this total then the Unit's Confidence rises by ONE LEVEL.

**Example:** *a "Regular 2" unit is currently at BROKEN (BR); the player attempts to rally it, using the Platoon Commander (a "Veteran 1" unit). Adding the Leadership values of both units gives 3, and a D8 is rolled as the unit being rallied is of "Regular" quality. If the number rolled is 4 or higher (thus exceeding the required score), the unit will have its Confidence Level raised to SHAKEN (SH).*

> **Boxed rule summary:** Successful COMMUNICATION required first, then roll QUALITY die to exceed SUM of leaderships of rallied and rallying units. Success = Confidence rises ONE level.

---

## REGROUPING: (p.17)

It is possible to COMBINE two (or more) depleted UNITS into one "new" unit during the game, if a player so wishes. This is known as REGROUPING.

The remaining figures of one unit must be moved (during their activation) in to the Unit Integrity distance of the unit with which they wish to regroup. The latter unit must NOT have already been activated this turn; if it has, then the actual regrouping must wait until the next turn.

The Regrouping uses up the activation of the unit being joined, so its Activation marker is inverted. It also uses up any remaining action of the unit that has moved into contact.

Once the necessary activations have been expended, the two former units are considered grouped into one new unit. The new unit has the Leadership of the BETTER of the two former unit leaders, the Quality of the LARGER of the two units (in terms of NUMBER of men in each) and an "average" of the two Confidence Levels (rounded up if necessary).

> **Boxed rule summary:** REGROUPING joins two depleted units into one; new unit gets BEST of LVs, QUALITY of larger no. of figures, and AVERAGE of Confidence Levels.

---

## DETACHED ELEMENTS: (p.17–18)

For most game purposes the basic "unit" of troops is the SQUAD, with all its members operating together - the Squad moves, fires and performs other actions as a cohesive group. There are certain circumstances, however, where it is necessary to separate a small sub-group from the squad and send them off to perform a separate function - obvious examples would be a recon team sent to check on something, a fire-direction team positioned in a suitable location to control support fire, or a SAW gunner and partner remaining in position to give suppressive fire as the rest of the squad moves to an assault. When a squad is divided in this way, the main part of the squad is defined as that which still contains the Squad Leader figure (even if this part is numerically smaller), while the separated group is termed the DETACHED ELEMENT.

A Detached Element is marked with a DET counter as soon as it is moved out of unit integrity with its parent unit; it takes one action by the unit leader to form a detached element (if figures are moved out of unit integrity **without** being designated as a detached element, then the [printed: "the are"] simply separated and the unit is disorganised).

Once formed and out of unit integrity distance, the element acts as a separate "squad" in its own right, with certain limitations: the Detached Element may only do something when its parent squad activates, and the leader of the parent squad must spend one of his actions to activate the element, in the same way as a superior officer transferring actions down the chain of command (see "Transferring Actions"); when activated in this way, the detached element may perform TWO actions as a normal unit would.

If the main squad and the detached element are within 6" of each other, then the part containing the squad leader may get the detached element to activate by simple direct communication (still taking one action to accomplish); if they are more than 6" apart then a successful COMMUNICATION roll is required to get the detached element to activate, rolling against the LV of the unit leader.

Once a detached element moves back into unit integrity with its parent unit, the DET marker is removed and the element once again becomes part of the parent unit.

Note that detached elements should ONLY be used for specific purposes separate from the actions of the parent unit - the splitting-off of detached elements just to increase the number of actions available to the unit is NOT permitted.

> **Boxed rule summary:** DETACHED ELEMENTS take 1 action to form. They must be ACTIVATED by a successful transfer of action by the unit leader each turn.

---

## SUPPRESSION: (p.18)

SUPPRESSION is normally a result of fire combat, but we have placed it in this section because its main relevance is to ACTIONS, or rather preventing them! A unit is SUPPRESSED when it is fired upon effectively enough for its members to feel in danger of being hit (whether or not any of them actually are) and thus are inhibited from carrying out actions that would expose them to further risk. The main effect of suppression in game terms is that it stops a unit taking most actions until the suppression is lifted.

When a unit is SUPPRESSED, one of the SUPPRESSION MARKERS from the counter set is placed by the unit to indicate this.

### SUPPRESSION OF INFANTRY UNITS: (p.18)

Whenever a unit has had a SUPPRESSION result inflicted on it by enemy action and is therefore marked with a SUPPRESSED counter, it may not perform ANY actions (apart from certain exceptions detailed below). The SUPPRESSION counter remains in place until [printed: "is is"] successfully removed - to do this requires the unit to be activated, and its Leader to expend one action, for which he gets to roll the unit quality die, if he scores greater than his own Leadership value, the suppression counter is removed and he may use his second action in any way desired. If the first roll fails, the player may try again with the leader's second action, but of course this means the unit may do nothing else until the next turn even if the roll is successful.

[printed: "The the"] main use of suppression is to prevent the target unit from using one or both of its actions for, say, returning fire - you can thus "pin down" a unit so that it may be attacked in close-assault, or to allow your troops to cross a killing zone with less danger. Always be aware, however, that good quality units with decent leadership will find it relatively easy to remove suppression counters - for this reason we allow MULTIPLE SUPPRESSIONS as described below.

The only cases in which a unit MAY actually do something while suppressed are:

i) the unit may defend itself if close-assaulted (and then only by defending in the actual close-combat, not by firing at the oncoming assault);

ii) the unit may carry out a REORGANISE action, but ONLY if it is currently in either soft or hard cover; units in the open may NOT reorganise while suppressed;

iii) the unit's LEADER may still carry out OBSERVE or COMMUNICATE actions while the unit is suppressed, and of course may use an action to try and remove the suppression marker.

Note that it is not COMPULSORY for a leader to use an immediate action to try and remove the suppression; as the leader himself may still make OBSERVE or COMMUNICATE actions while his unit is suppressed, in some cases it might well be more important to call in that fire mission than to get his squad motivated again....

### SUPPRESSION OF VEHICLES AND BUILDINGS: (p.18)

Suppression markers may be placed against vehicles or structures (especially fortifications and bunkers) if they take fire that would produce a suppression result. Suppression of vehicles and buildings does NOT inhibit them for moving, firing and most other actions, but it does prevent their crew or occupants from doing anything that involves leaving the protection of the vehicle or structure - thus if a crew can operate all its weapons from inside the vehicle then they may fire as normal, but the commander may NOT stick his head out of the hatch in order to fire an external pintle-mounted weapon; this is why most external weapon mounts have provision for remote operation from under armour! Similarly, infantry aboard a vehicle may NOT dismount from it while the vehicle has a SUPPRESSION marker. Troops in a building which has a suppression marker may not exit the building from the side under fire, or from an adjacent side - they may however leave via the opposite side of the building to that fired on (we recommend that the suppression marker is placed against one wall of the building to indicate which side is under fire).

Suppression markers on vehicles must be removed by an action by the vehicle commander, while those on buildings may be removed by the action of any infantry unit occupying the structure.

### MULTIPLE SUPPRESSIONS: (p.18)

If a unit receives [printed: "a another"] SUPPRESSION result while it already has a suppression counter on it, it gets another counter; a unit may accumulate up to THREE suppression counters in this way at any one time (any more over three are ignored), and each one takes a successful removal roll (and therefore at least one action) to dispose of it. Thus a player may fire several times at one enemy unit, with the intention of inflicting multiple suppressions and so pinning the unit down for a considerable time - perhaps long enough to get the assault troops in position to attack, or to get the C-Vac VTOL in to pick up the wounded.

> **Boxed rule summary:** SUPPRESSION prevents INFANTRY units from taking most actions except Observe, Communicate, Reorganise (if in cover) and Remove Suppression, and VEHICLES from taking any action that requires occupants to exit the vehicle. Removing 1 suppression marker takes 1 action, and roll of Quality die - exceed LV to succeed.
>
> Multiple suppressions (up to 3 at one time) are allowed.

*Photo at bottom of right column, caption: "FSE Colonial Legion troops advance with their AGCI-5 APC." (flavour photo of miniatures; not a rules diagram.)*

---

## Notes on illegibility

Nothing on printed pages 16–18 was illegible; all rule text, box text, and the two worked examples were fully legible at the resolution provided.

## quickRefDisagreements

- The quick-reference boxed summaries for COMMUNICATIONS, TRANSFERRING ACTIONS, REORGANISE, RALLYING, REGROUPING, DETACHED ELEMENTS, and SUPPRESSION are verbatim (or near-verbatim) copies of this chapter's own boxed rule summaries, so there is no wording conflict between the QR and the rulebook on those boxes themselves. The disagreements below are all places where the QR's brevity drops a rule, condition, or exception that is stated in the full chapter text and that a programmer relying only on the QR would miss.
- **Suppression exceptions incomplete.** The QR's suppression box says suppressed INFANTRY units may act only via "Observe, Communicate, Reorganise (if in cover) and Remove Suppression." It omits the rulebook's exception (i): a suppressed unit MAY still defend itself if close-assaulted (fighting only in the actual close combat, not by firing at the attackers first). A programmer following the QR alone would incorrectly disallow a suppressed unit from fighting back in close assault.
- **Suppression of vehicles/buildings not in QR at all.** The QR box only says suppressed vehicles are barred "from taking any action that requires occupants to exit the vehicle." The full rulebook (p.18) adds: suppression does NOT stop a vehicle/building from moving, firing weapons operable from inside/under cover, etc.; only exiting/dismounting/exposing a crewman is barred; and — not mentioned in the QR at all — suppressed BUILDINGS can be occupied by suppression markers too, with occupants barred from exiting on the fired-upon side or an adjacent side (but free to leave from the opposite side), and building suppression is removed by an action from any infantry unit occupying the structure, while vehicle suppression must be removed specifically by the vehicle commander's action. None of this vehicle/building nuance is in the QR.
- **Multiple suppressions: removal cost per counter not spelled out.** The QR states "Multiple suppressions (up to 3 at one time) are allowed" and separately that removing "1 suppression marker takes 1 action." The full rulebook is explicit that each of the up to three counters requires its OWN successful removal roll (hence its own action) to dispose of — the QR doesn't make explicit that stacked suppressions must be removed one at a time, roll by roll, nor that any suppression results beyond three are simply ignored (a cap the QR states but doesn't explain the mechanism of).
- **Regrouping: rounding direction for Confidence Level average.** The QR box says the new unit gets "AVERAGE of Confidence Levels" with no rounding rule given. The full rulebook specifies the average is "rounded up if necessary" — a concrete detail a programmer needs and the QR omits. The QR also omits the activation-consumption mechanics of regrouping (joining unit must not have already activated this turn or the merge waits until next turn; the joined unit's activation marker is inverted; any remaining action of the moving unit is also consumed).
- **Detached elements: activation mechanism only partly in QR.** The QR box says detached elements "must be ACTIVATED by a successful transfer of action by the unit leader each turn," which reads as though a communication roll is always required. The full rulebook clarifies this is only true when the element is more than 6" from the part of the parent squad containing the squad leader; within 6" the leader may activate the detached element by simple direct communication with no die roll (still costing one action). The QR does not distinguish these two cases.
- **Rally action: announcement and no-test-in-contact clause not in QR.** The QR box gives only the die mechanic ("roll QUALITY die to exceed SUM of leaderships..."). The full text adds process detail: the rallying command unit must first announce it is using an action to Rally and name the target unit, and the required prior Communication test is waived if the two units are in direct contact — neither point appears in the QR.
- **Transferring actions: cascading/chain-transfer and 6" auto-transfer not in QR.** The QR box covers only a single transfer ("Commander can attempt to re-activate 2 subordinate units per turn, each with one Communication action"). The full rulebook adds two mechanics absent from the QR: (1) a subordinate who receives a transferred activation may in turn transfer his own action(s) further down the chain (e.g. a Company CO's single activation can cascade to four squads acting at once via two Platoon commanders); and (2) if the transferring commander is within 6" of the subordinate, the transfer happens automatically with no die roll and no jamming risk ("direct contact").
- **Available Actions table not represented in QR at all.** The QR's opening ACTIONS box only states the general "two actions, some need reaction tests" rule and the two-different-weapons firing rule. It does not reproduce the underlying Available Actions list (which specific actions are Motivation vs. Leader actions, which of the twelve listed actions need which specific test — e.g., that MOVE OUT OF COVER needs a reaction test only if SHAKEN or lower, that CLOSE-ASSAULT's reaction test consumes the full 2-action activation, that OBSERVE needs a spotting test only "in some circumstances," or that actions marked with an asterisk may be attempted twice in one activation). A programmer building the action-list/test-requirement logic needs this table, which exists only in the full chapter, not the QR.

<details><summary>Checker's corrections</summary>

Checked line by line and cell by cell against sg-p17.png (printed p.16), sg-p18.png (printed p.17) and sg-p19.png (printed p.18), including 1.6x–2x pixel zooms of the AVAILABLE ACTIONS table, both worked examples, the REORGANISE illustration, the SUPPRESSION boxes, and the four printed typos, plus footer-digit crops confirming the printed page numbers (16, 17, 18).

No corrections were required. Specifically re-verified and confirmed correct as transcribed (no change made):

- Printed page numbers — was/now: footers on sg-p17/18/19.png read "16", "17", "18" respectively, matching the digest's page citations throughout (p.16, p.17, p.17–18, p.18) and the header note "(sg-p17.png, sg-p18.png, sg-p19.png)".
- AVAILABLE ACTIONS table (p.16) — was/now: all 12 rows (6 Motivation, 6 Leader actions), every "Test required" cell text, both bracketed sub-notes ([May INCLUDE firing support weapons at same target], [Takes up full activation, ie: 2 actions], [Includes Medical Treatment of wounded if appropriate]), and both footnotes (* doubling-up rule, ** two-different-weapons rule) match the page verbatim, cell for cell.
- COMMUNICATIONS example (p.16) — was/now: "REGULAR/LV1 vs GREEN/LV2 → D8, need 3+" and "GREEN/3 vs VETERAN/2 → D6, need 4+" both match the page exactly.
- RALLY ACTION example (p.17) — was/now: "Regular 2 at BROKEN, Platoon Commander Veteran 1, sum LV = 3, D8, 4+ needed, success → SHAKEN" matches the page exactly.
- Four printed typos preserved verbatim and correctly bracketed — was/now: "the are" (p.17/18, DETACHED ELEMENTS), "is is" (p.18, SUPPRESSION OF INFANTRY UNITS), "The the" (p.18, same section, next paragraph — confirmed at pixel zoom the source reads "The the," not "The The"), and "a another" (p.18, MULTIPLE SUPPRESSIONS) — all four confirmed present on the page exactly as bracketed in the digest, none invented or mis-transcribed.
- REORGANISE illustration (p.17) — was/now: confirmed it shows two power-armoured troopers with no caption text, as described.
- SUPPRESSION boxed rule summary two-paragraph split (p.18) — was/now: confirmed the box on the page itself contains two separate lines ("...exceed LV to succeed." / "Multiple suppressions (up to 3 at one time) are allowed."), matching the digest's two-paragraph blockquote.
- Photo caption (p.18) — was/now: "FSE Colonial Legion troops advance with their AGCI-5 APC." matches the page exactly.
- The quickRefDisagreements notes were checked against qr-p1.checked.md and the full chapter text; all seven claims are accurate characterizations of what the QR box omits relative to the full rulebook text on these pages, and none is invented or misattributed, so all were kept unchanged.

No invented content, no misplaced rules, and no illegible text were found on printed pages 16–18; the "Notes on illegibility" section's claim that nothing was illegible is confirmed.

</details>

---

# Chunk 07 · pp. 19–21 · 8 Confidence and reaction

*(Chapter number "8" and title "CONFIDENCE AND REACTION" printed in the header banner on all three pages.)*

## MISSION MOTIVATION: (p.19)

The concept of Mission Motivation needs some explanation, because it is a key factor in the way SGII games are played. It can be considered as part of the morale/confidence system, in that it affects the psychological state of the troops and how they will fight; it is also something that is not often addressed in miniatures rules of this type, and hence the idea will be unfamiliar to many players.

MISSION MOTIVATION is an abstract representation of the importance that the troops on the ground place on the success of their particular mission, and is rated as **LOW, MEDIUM or HIGH**. Effectively, it determines at what point a force will change from its primary objective (usually destroying the enemy) to a secondary "survival" objective of getting their own men out safely. The idea is best explained with a couple of examples:

*i) A platoon has been sent out on a regular patrol sweep, with orders to identify and report any signs of enemy activity; engagement of any enemy units located is at the discretion of the platoon leader. This is a typical case of **LOW** Mission Motivation - the troops are not certain that they will even make contact with the enemy, and if they do have no real incentive to make a fight of it. If enemy forces are discovered, it is more than likely that the platoon commander will err on the side of caution and withdraw, especially if he starts to take casualties - it will not be worth the loss of his men when they can simply pull back and let a proper strike force take care of the enemy for them.*

*ii) The remains of a platoon, now little more than a reinforced squad, is dug in to a hilltop position commanding the entrance to a mountain pass - the only route of advance for the enemy forces. Most of the friendly army is pulling back, and this unit has orders to hold up the enemy for as long as possible; little supporting fire is available, and no relief force is going to come. This situation has a **HIGH** Mission Motivation, as the troops know that they must hold on as long as they can still fight; a mixture of honour, determination and strong leadership will keep them going in the face of overwhelming odds.*

In general terms, a LOW motivation mission will be one where the troops are unwilling to take what they see as unnecessary risks or to absorb more than a few casualties, because the importance of the mission is not enough to warrant them - someone else can mop things up later. A MEDIUM motivation mission would be a "normal" battle, where success is important (because the top brass says so...) and a certain level of casualties is accepted as the price to be paid, but forces will still withdraw if faced with unreasonable odds.

A HIGH motivation mission is likely to be either a last-stand defence as in the example above, or else a surgical strike/infiltration mission by a special-forces unit - the mission MUST succeed at whatever cost, as the price of failure would be too high.

In game terms, the function of the Mission Motivation level is to determine under what circumstances the unit will take confidence and reaction tests, and hence how fast (on average) it will lose its confidence levels and thus lose the will to fight on. For example, a LOW MM force will test virtually every time anything unpleasant happens to it, a MEDIUM MM unit less often and a HIGH MM force will only have to test under the very worst circumstances. The differences in the test criteria are set out in the table in the Confidence Level section.

Note that even a High Mission Motivation will not mean that a unit will AUTOMATICALLY fight "to the last man" - it is simply that casualties and other adverse circumstances will be less likely to make the force abandon its mission.

The level of Mission Motivation to be used for each side in a game should be determined by the scenario, along the lines of the examples given above; if no specific scenario is written then use default values of MEDIUM Mission Motivation for both forces.

Generally, all of one player's forces will have the SAME Mission Motivation level for a given scenario, but this need not always be the case - for example, a small force of good troops (probably Medium or High MM) might be supported by a backup force of local militia troops who could well be of Low MM - they have their own agenda for survival and will probably fade away into the countryside if things get nasty!

*(Designer's note in spirit: this whole section is explanatory/flavour text illustrating why Mission Motivation matters and how to set it per scenario; the two worked examples above are transcribed in full per instructions since they define what LOW/HIGH MM mean in play.)*

## FATIGUE LEVEL: (p.19)

In addition to the Mission Motivation level of troops involved in the game, the FATIGUE LEVEL of the force should be determined before the game starts; as with the MM, this is normally written into the scenario, depending on what has happened to the force in the period immediately before the game being played. There are three different degrees of Fatigue Level:

- **FRESH** (troops new to the battle area, eg: those just dropped from orbit or flown in from rear areas)
- **TIRED** (men who have been in the front line for some days at least, or who have had a long period of stressful garrison duty - perhaps in a firebase under constant harassing bombardment)
- **EXHAUSTED** (those who have been in active combat for several days or weeks, on long forced marches, and/or have been on short rations and supplies).

The effect of Fatigue Level on the game is that FRESH troops start the battle with their Confidence Level at CONFIDENT (CO), those that are classed as TIRED will start off at STEADY (ST) and any that are EXHAUSTED will start at SHAKEN (SH); thus the more fatigued the troops are, the quicker they will approach a Broken or Routed state as things start to go bad. Troops that start the game with an ST or SH Confidence level due to fatigue may **NOT** be raised above this starting level during the game by rallying - this is the highest Confidence level they can attain without rest away from the battlefront.

**Mechanic summary:** FATIGUE LEVEL → starting Confidence Level, and a ceiling on rallying:
| Fatigue Level | Starting CL | Rallying ceiling |
|---|---|---|
| FRESH | CONFIDENT (CO) | (none - can reach CO) |
| TIRED | STEADY (ST) | May not rally above ST |
| EXHAUSTED | SHAKEN (SH) | May not rally above SH |

*(An illustration of a Combat Power Suit / power-armour trooper with a heavy support weapon occupies the lower right of this page; purely decorative art, not a rules diagram.)*

---

## CONFIDENCE LEVELS: (p.20)

In addition to its Activation Marker, each UNIT also has a marker placed by it at all times that indicates its current CONFIDENCE LEVEL. This is the state of the Unit's morale at any given time, and will fluctuate up or down depending on the Unit's fortunes during the battle.

The Confidence Level Markers (known hereafter as CL markers) are the GREY counters with WHITE letters on them - there are five different kinds, for the five Confidence Levels used in the game:

- **CO** = Confident (morale high, 'ready for anything')
- **ST** = Steady (morale holding, generally still willing to fight)
- **SH** = Shaken (distinctly worried and reluctant to take risks)
- **BR** = Broken (morale almost gone, no longer willing to fight)
- **RO** = Routed (morale shattered and running away!)

In general, most units will start a game with a CO (Confident) marker; however this is not always the case - a few units might well start at ST (Steady). If the scenario warrants it, there may even be units that start the game at SH (Shaken) - for instance, if they were the demoralised defenders of a position that had already been under attack for some time with no hope of relief forces. Except in very unusual scenarios, no unit should start a game at BR (Broken).

For a one-off game it is suggested that players mix some ST markers with the CO ones (and a very few SH if desired), and draw at random for each unit they have. If the rules for FATIGUE LEVELS are being used, then units will have CONFIDENT, STEADY or SHAKEN starting levels as dictated by their degree of battle fatigue.

A unit's CL marker may change as the result of a CONFIDENCE TEST (see below); failure to achieve the necessary score in the test will cause the unit's Confidence to drop by one or two levels. Eg: a unit with a current CL of "ST" fails a test and drops ONE level of Confidence - replace the ST marker with an SH (Shaken) one; if the test was failed badly enough for a 2-level drop all at once, then the unit would drop to Broken and get a BR marker in place of the ST.

There are certain circumstances where the unit's CL can actually RISE (eg: a Shaken unit could return to Steady). These cases are detailed in the rules for Rallying (P.17) and Casevac (P.54).

## CONFIDENCE TESTS: (p.20)

Confidence Tests are taken immediately following the occurrence of whatever event requires the test to be taken; for instance, if casualties suffered by a unit require a Confidence Test then it will be resolved there and then, as soon as the casualties have been inflicted. This may well result in a given unit having to take more than one test in a Game Turn - this is fully acceptable, and may cause the unit to lose several Levels of confidence in the one Turn (eg: if it is fired on by more than one enemy unit in the turn, in different enemy activations). The effects of a Confidence Test are applied immediately; eg: if a unit that had not yet used its activation had to take a test due to enemy action and lost Confidence Levels as a result, it might then NOT be able to carry out whatever action the owning player had intended it to do in its activation for that turn.

A CONFIDENCE TEST is a simple, quick procedure involving a single die roll, which is made as soon as a Unit is placed in any of the circumstances detailed on the list below. Note that each circumstance described has a "THREAT LEVEL" assigned to it, which indicates just how serious the occurrence is to the unit's confidence.

When a Confidence Test is called for, simply take the unit's LEADERSHIP RATING (the NUMBER on its Activation marker) and ADD this to the THREAT LEVEL that applies in this case. This total is the score that must be EXCEEDED to pass the confidence test safely.

The player testing then rolls 1 die, the DIE TYPE being determined by the QUALITY of the Unit (as indicated by the colour of its Activation marker).

If the die roll is HIGHER than the score needed, the test is passed successfully and the unit's Confidence is unaffected; if the roll is EQUAL TO or LESS THAN the score needed, the unit's Confidence drops by ONE level. If the number rolled is only HALF OR LESS of the required score, then the unit's Confidence drops by TWO levels.

**Worked example (printed on page):** *a unit has a current CL of ST (Steady); it is a Regular ("Blue") unit with Average ("2") leadership; it is on a MEDIUM MOTIVATION mission. The unit has just taken its first casualty, which requires it to test confidence with a Threat Level of +2. Adding the Leadership to the Threat Level gives a total of 4; as it is a Regular unit, the player rolls a D8. If he is lucky enough to roll 5 or more then the unit's confidence will remain unchanged at ST. If he rolled 3 or 4, the unit's CL would drop by ONE level to SH (Shaken). If he was VERY unlucky and rolled a 1 or 2, this would be half or less than half the required score of 4, and the CL would drop by TWO levels to BR (Broken).*

*[Checker's note: this worked example is printed exactly as shown, including "a Threat Level of +2" for taking a first casualty under a MEDIUM MOTIVATION mission. This appears to conflict with the THREAT LEVEL TABLE FOR CONFIDENCE TESTS below, which gives "Unit takes casualties from fire" a base Threat Level of only 1 (not 2) under MEDIUM Mission Motivation. Both the example and the table were checked pixel-by-pixel against the scan and each is transcribed exactly as printed on page 20; the discrepancy exists in the source rulebook itself and is not a transcription error. A programmer implementing this exactly should be aware the printed worked example and the printed table numerically disagree by 1 for this specific case.]*

## THREAT LEVEL TABLE FOR CONFIDENCE TESTS: (p.20)

Note that the some Threat Levels in this table are cumulative, and some are not; if the table gives just a number (eg: 2), then that is a basic threat level - use just the HIGHEST one of these that applies to the unit at any given point. If the threat level is noted as a "+" number (eg: +2), then this is a cumulative modifier - any "+" threat levels should be ADDED to the basic threat level to get the final level.

| CIRCUMSTANCES FOR TAKING TEST: | MISSION MOTIVATION — LOW | MISSION MOTIVATION — MEDIUM | MISSION MOTIVATION — HIGH |
|---|---|---|---|
| FIRST time unit is SUPPRESSED by fire | 2 | 1 | NTR* |
| Unit takes casualties from fire | 2 | 1 | NTR |
| Unit takes MORE casualties in one attack than it has surviving members afterwards | 4 | 3 | 1 |
| Unit Leader becomes casualty | 4 | 3 | 2 |
| Unit is under Artillery or Aerospace attack | +2 | +1 | +0 |
| For each currently UNTREATED CASUALTY in unit | +1 | +0 | NTR |
| Unit is forced to ABANDON WOUNDED** | +3 | +2 | +1 |

\* NTR = No Test Required.

\*\* Wounded figures (either treated or untreated casualties) are considered ABANDONED if the unit withdraws away from visible enemy units without taking their wounded along, leaving the wounded nearer to the enemy than their parent unit is. DEAD figures do not count in this case.

*(This table's numbers match the Quick Reference summary exactly - no disagreement.)*

*(A full-page illustration of infantry figures, including a fist-pumping trooper, occupies the lower-left of page 20; decorative art only, not a rules diagram.)*

---

## (continued header, no new boxed heading at top) (p.21)

**IMPORTANT NOTE:** There will be times when cumulative Threat Levels render it impossible for a unit to pass a Confidence Test, for example if a Green unit (rolling a D6) ends up with a total Threat Level of 6 or more; this sort of situation is quite acceptable in game terms, as it indicates a situation that is so bad that some drop in unit confidence is unavoidable. In such cases the test roll should still be made, as it is necessary to check whether the unit loses just one level of confidence or two (by rolling less than half the required number).

**Boxed summary rule (p.21):**
> Confidence Test taken as soon as required. Roll Quality die, exceed LV+ Threat Level to pass test. Failure = drop one CL; score less than HALF needed number = drop TWO CLs.

## RESULTS OF REDUCED CONFIDENCE LEVELS: (p.21)

As a unit drops in Confidence, it may become reluctant to do things that are obviously dangerous; as the degradation of confidence becomes more severe, so do the restrictions on what a unit may do.

At **CONFIDENT (CO)** or **STEADY (ST)**, a unit may make any actions that are normally available to it.

At **SHAKEN (SH)**, a unit may not leave cover and move into the open, or to advance towards a located enemy, unless it passes a REACTION TEST. It becomes difficult (though not impossible) to get the unit to CLOSE ASSAULT the enemy.

At **BROKEN (BR)**, a unit in the open must move to the nearest cover (but must not move closer to any located enemy while doing so). Broken units may not leave cover except to withdraw further from all located enemies, and will only fire on enemy units that have fired on them. If Close Assaulted, they will immediately drop to ROUTED.

At **ROUTED (RO)**, the unit is effectively no longer capable of fighting; it must withdraw towards its own baseline (or designated rendezvous/extraction point), and will not fire at anything. If there are enemy units within 12" and the unit cannot withdraw without moving closer to a located enemy, it will surrender.*

Note that all the above effects are cumulative, ie: a unit at Broken suffers all the restrictions of being Shaken as well.

\* See Surrender and Prisoners rules (P.53) for full details.

**Boxed summary rule (p.21):**
> CONFIDENT = Any action.
> STEADY = Any action.
> SHAKEN = Reaction Test to leave cover.
> BROKEN = Move to cover; leave cover only to retreat; may only fire if fired upon.
> ROUTED = Withdraw, no fire. Surrender if enemy within 12".

## REACTION TESTS: (p.21)

A REACTION TEST is in most ways similar the the Confidence test [printed exactly as shown — this reads "similar the the Confidence test" in the source, apparently a printing error for "similar to the Confidence test"], except that failing the test does NOT actually reduce the unit's CL. The Reaction test is taken whenever a unit is ordered to do something that its troops may or may not have the nerve to carry out - such as entering into Close Assault with enemy troops, or leaving cover while under the threat of enemy fire. Reaction test circumstances (as described in the table) are assigned Threat Levels in the same way as the circumstances for Confidence tests, and the test is taken in exactly the same manner.

If the required score is EXCEEDED by the die roll, then the unit WILL carry out whatever action forced the test to be made; if the roll is EQUAL TO or LOWER THAN the required score then the troops will NOT carry out the action - they have decided it is much safer to continue to skulk in cover and pretend they have not heard the order to advance.... No change is made to the CL marker however, and the unit may again be ordered to carry out the same action next turn (in which case they have to test again, and may pass or fail in the same way). If a unit fails a Reaction test to carry out its FIRST action of the activation, then that action is lost - the player may not change to another action instead, but must move on to the unit's second action; this second action may NOT be an attempt to repeat the failed test, but must be a different action. The failed action may not be re-attempted until the FOLLOWING turn.

**Worked example (printed on page, right column):** *A SHAKEN unit tries to leave cover in its first action, but fails its Reaction test; for the second action, the player may NOT attempt to get the unit to leave cover again, but MAY do something else (eg: fire). In the NEXT turn, he may once again attempt to motivate the unit to leave cover.*

## THREAT LEVEL TABLE FOR REACTION TESTS: (p.21)

| Circumstance | Threat Level |
|---|---|
| Unit attempts to go IN POSITION while IN OPEN | 2 |
| Unit attempts to go IN POSITION while IN COVER | 0 |
| Unit attempts to MOVE without removing IP marker first | 2 |
| SHAKEN Unit attempts to leave cover and advance | 2 |

*(Matches the Quick Reference summary exactly - no disagreement.)*

Reaction tests are also used in the CLOSE ASSAULT procedure - for details of threat levels for this refer to the CLOSE ASSAULT rules in chapter 15.

Note that MISSION MOTIVATION does **NOT** affect the Threat Level for REACTION TESTS as it does for CONFIDENCE TESTS.

For full explanation of IN POSITION and its effects, refer to P.13.

Umpires should feel free to use Reaction tests in other circumstances as they see fit - those given above should be considered examples and used as guidelines when setting threat levels for other tests.

**Boxed summary rule (p.21):**
> Reaction Test taken as soon as required. Roll Quality die, exceed LV+ Threat Level to pass test.
> NO drop in CL for failing Reaction Test.

## PANIC: (p.21)

Panic is a special reaction that affects only lower quality troops, and represents their tendency to "freeze" when they make first contact with the enemy.

**UNTRAINED** units must test for PANIC the first time they come into line-of-sight of ANY enemy unit in the game.

**GREEN** units test for PANIC the first time they are FIRED ON by any enemy unit in the game, or the first time they SEE any unit of enemy ARMOUR (AFVs) or POWER-ARMOUR TROOPS.

**REGULAR** units only need to test for PANIC the first time they are attacked by any enemy that provokes a TERROR reaction (see Close Assault rules, P.43).

**VETERAN** and better troops **NEVER** need to test for PANIC.

To test for a PANIC reaction, roll a REACTION TEST at a threat level of 0 (so unit just needs to exceed their unmodified LV to pass). If this test is FAILED, then the unit PANICS - mark it with a PANIC counter.

While it is panicking, the unit may do nothing - not even the actions that it could normally carry out while SUPPRESSED; to attempt to remove the PANIC marker the unit leader must spend TWO actions (his whole next activation), and pass a reaction test at TL 0. Each time a unit tries to remove a panic marker and fails, if they roll a ONE then they also lose one level of CONFIDENCE.

Once a unit has tested once for PANIC and passed, or else has panicked but the PANIC marker has been successfully removed, the unit is no longer at risk of panic for the rest of the game - it has got over the shock of first contact.

[Note that the PANIC markers are also used in the reaction of Independent Figures (see P.26), but in this case the rules used and the results are different.]

**Boxed summary rule (p.21):**
> Units test for PANIC when:
> UNTRAINED first sight enemy; GREENS first fired on or see AFVs/PA; REGULARS first attacked by TERROR units.
> Roll Reaction test, TL 0.
> Fail = PANIC. NO actions while panicked. Takes 2 actions to remove - roll Reaction, TL 0 - score 1 = lose 1 CL.

---

## Quick-reference disagreements / additions found only in the full rulebook

- **Mission Motivation and Fatigue Level are entirely absent from the Quick Reference.** QR page 1's "CONFIDENCE AND REACTION" box starts directly at the Confidence Test rule and never defines Mission Motivation (LOW/MED/HIGH) or Fatigue Level (FRESH/TIRED/EXHAUSTED) as concepts, even though the Threat Level table it reproduces is keyed entirely by Mission Motivation. A programmer working only from the QR would have the MM column headers with no definition of what sets a force's MM, and no rule at all for Fatigue Level setting a unit's starting Confidence Level (FRESH=CO, TIRED=ST, EXHAUSTED=SH) or capping how high rallying can raise it.
- **The QR omits the "score less than HALF needed number = drop TWO CLs" worked mechanic's example**, though the rule text itself is present verbatim in the QR ("Failure = drop one CL; score less than HALF needed number = drop TWO CLs"). The full rulebook adds the complete worked numeric example (Regular unit, LV 2, TL+2, D8, total 4, needing 5+ to hold ST, 3-4 drops one to SH, 1-2 drops two to BR) which the QR does not include. Note also (see Checker's note in the CONFIDENCE TESTS section above) that this example's Threat Level of +2 for a first casualty under MEDIUM Mission Motivation numerically disagrees with the printed Threat Level Table's value of 1 for "Unit takes casualties from fire" under MEDIUM - an inconsistency present in the full rulebook itself, reproduced faithfully here.
- **The QR does not state that "+" Threat Levels are cumulative modifiers while bare-number Threat Levels are NOT cumulative (use only the highest applicable one)** — this rule of table interpretation, plus the "IMPORTANT NOTE" that a Confidence Test must still be rolled even when the required score can never mathematically be exceeded (to check for a 1-level vs 2-level drop), appears only in the full rulebook (p.21), not in the QR.
- **PANIC is entirely absent from QR page 1's summary in the form given here** — actually the QR DOES include a Panic box (QR p.1), and it matches the rulebook's content closely (UNTRAINED/GREEN/REGULAR/VETERAN triggers, Reaction test TL0, fail=panic, 2 actions to remove, roll of 1 = lose 1 CL). No disagreement found there.
- **The QR's Reaction Test summary omits** the full rulebook's additional procedural detail that failing a Reaction test on a unit's FIRST action of its activation loses that action outright (the unit's second action must be a *different* action, not a repeat of the failed one, and the failed action cannot be re-attempted until the following turn). This nuance is only in the full text (p.21).
- **The QR gives "Unit attempts to MOVE without removing IP marker first" a Threat Level of 2** under REACTION TESTS, consistent with the full rulebook's Threat Level Table for Reaction Tests (also 2) — no disagreement.
- Numeric values in both Threat Level tables (Confidence Tests: 2/1/NTR, 2/1/NTR, 4/3/1, 4/3/2, +2/+1/+0, +1/+0/NTR, +3/+2/+1; Reaction Tests: 2, 0, 2, 2) match the QR exactly - no discrepancies found in the tables themselves. (These table values were re-verified pixel-by-pixel against the scan during this check; see Checker's corrections below.)
- The full rulebook cross-references several other sections not given numeric content here but relevant to implementation: Rallying (P.17), Casevac (P.54), Surrender and Prisoners (P.53), IN POSITION (P.13), Close Assault Threat Levels / TERROR reaction (chapter 15, cited on p.21 as "P.43" for the Terror rule specifically and "chapter 15" for Close Assault threat levels generally), and Independent Figures' distinct Panic rules (P.26).

## Illegible content

None. All text, numbers, and table values on pages 19-21 were legible at the resolution provided.

<details><summary>Checker's corrections</summary>

Checked line by line and cell by cell against sg-p20.png (printed p.19), sg-p21.png (printed p.20) and sg-p22.png (printed p.21), including pixel-level zoom crops of the two Threat Level tables, the "IMPORTANT NOTE" box, both worked examples, and the REACTION TESTS text on p.21, and cross-checked against qr-p1.checked.md / qr-p2.checked.md. The first reading's prose, both worked examples, both Threat Level tables (all values), all five boxed summary rules, the PANIC rules, and the "Quick-reference disagreements" analysis were all verbatim-accurate and complete. Two corrections were made:

- **Where:** Chapter 8, p.21 — placement of the "SHAKEN unit tries to leave cover..." worked example relative to the REACTION TESTS heading.
  **Was:** The example was placed immediately after the "RESULTS OF REDUCED CONFIDENCE LEVELS" boxed summary (CONFIDENT=Any action...ROUTED=...) and *before* the "## REACTION TESTS:" heading and its two explanatory paragraphs.
  **Now:** Moved the example to appear *after* the two REACTION TESTS paragraphs (which end "...may not be re-attempted until the FOLLOWING turn.") and immediately before "## THREAT LEVEL TABLE FOR REACTION TESTS:". This matches the source page's actual layout (the example sits at the top of the right column, directly following the left column's REACTION TESTS text) and its content — it illustrates the just-stated rule that failing a Reaction test on a unit's first action forfeits that action and forces a different second action, not the Confidence Level effects described in the preceding section. No wording of the example itself was changed.

- **Where:** Chapter 8, p.20 — CONFIDENCE TESTS worked example.
  **Was:** No note that the example's stated Threat Level (+2, for a unit taking its first casualty under MEDIUM Mission Motivation) numerically disagrees with the THREAT LEVEL TABLE FOR CONFIDENCE TESTS' value of 1 for "Unit takes casualties from fire" under MEDIUM.
  **Now:** Added a bracketed checker's note directly after the worked example flagging this discrepancy, confirming (via pixel-level zoom on both the example paragraph and the table) that both numbers are printed exactly as transcribed and the mismatch is an inconsistency in the source rulebook itself, not a transcription error, so an implementer is aware of it. Also referenced this note from the "Quick-reference disagreements" section. No rule content or table value was altered.

All other numbers, die types, threat levels, thresholds, ranges, counts, table cells and conditions on pages 19-21 were confirmed correct as originally transcribed, including: the FRESH/TIRED/EXHAUSTED → CO/ST/SH starting-Confidence-Level and rallying-ceiling rule; all five Confidence Level definitions (CO/ST/SH/BR/RO); the Confidence Test procedure (LV + Threat Level, exceed to pass, half-or-less = 2-level drop); every cell of both Threat Level tables; the "+" cumulative vs. bare-number highest-only rule; the IMPORTANT NOTE about unpassable tests; all four CO/ST/SH/BR/RO behavioural restrictions and their boxed summary; the Reaction Test procedure and its first-action-forfeit rule; the PANIC rules for UNTRAINED/GREEN/REGULAR/VETERAN and the removal procedure; and all page cross-references (P.17, P.53, P.54, P.13, P.43, P.26, chapter 15).

</details>

---

# Chunk 08 · pp. 22–24 · 9 Movement

## MOVING UNITS: (p.22)

When a unit moves, the whole group of figures that represents that unit is moved the relevant distance; players should NOT get too picky about exactly how far an individual figure within the group moves, as long as the overall unit is seen to move the required distance. In general, it is suggested that the front-most figure of the group is moved a measured distance, then the other squad members simply moved up "by eye" to roughly their relevant positions.

## MOVEMENT: TROOPS ON FOOT: (p.22)

When activated, a unit may use one or both of its actions in order to MOVE. There are two different types of MOVE action available for troops on foot:

**NORMAL MOVEMENT:** in Normal Movement the unit may move up to its base mobility (in inches) for each action spent. A unit may use both its activations to move if desired, thus moving up to twice its base mobility.

No die roll is required for normal movement, unless a Reaction test is called for (eg: if a SHAKEN unit is trying to leave cover and advance) in which case the test must be passed before the movement can be made.

**COMBAT MOVEMENT:** a unit will use Combat Movement when it is trying to cover dangerous ground in short dashes, eg: when it expects to be fired on while moving. For each action of Combat Movement, roll the die type equivalent to the unit's base mobility (eg: if the base mobility is 6, roll a D6) and DOUBLE the die score; the result is the distance in inches that the unit moves.

When using Combat Movement, the direction of proposed movement must be stated by the player BEFORE rolling the die, along with the required end point of the movement (eg: if the unit is trying to run for an area of cover, the player would indicate the cover as the destination for the movement). The die is then rolled, and if the score is enough for the unit to reach its indicated destination then it does so safely, and may then stop. If the die roll turns out to be insufficient for the desired destination, the player MUST move the unit the full distance of the die score in the indicated direction; if this means that the unit ends its activation stuck out in the open, then this is exactly what happens — the unit is caught in mid-dash and may be fired on as a target in the open until its next activation gives it a chance to make it into cover. This gives an element of risk to balance against the advantage of the increased movement that may be gained from a good die roll. If the unit is using both its actions for Combat movement, each action is taken separately and the die is rolled once for each action.

**Worked example (verbatim):** "Example: a unit of normal troops (base mobility 6) attempts to dash 15" across an open space into the cover of some scrub, using both its actions; for the first action, the player nominates the scrub as his eventual destination and rolls a D6, scoring 4 - this doubles to 8, and the unit moves 8". For the second action, the player gets lucky and rolls a 6, for 12" of movement - the unit easily covers the remaining 7" and reaches the scrub safely. If the player had been less lucky and rolled 1 on his second action, the unit would have been forced to move 2" and ended the move stuck out in the open, still 5" short of safety."

**Boxed summary (verbatim):**
> Normal Movement is up to Base Mobility per action.
> Combat Movement is 2 x Mobility Die roll per action, but must indicate destination and then move full distance rolled.

### BASE MOBILITY DISTANCES: (p.22)

| Troop type | Base Mobility | Combat Movement |
|---|---|---|
| Normal troops on foot (full kit, body armour if applicable) | 6" | D6x2" |
| Very light troops (light scouts with little equipment) | 8" | D8x2" |
| Troops in "Slow" Power Armour | 6" | D6x2" |
| Troops in "Fast" Power Armour | 12" | D12x2" |

"Troops encumbered by heavy equipment (eg: carrying stripped-down heavy weapons in manpack loads) or carrying casualties move at one die type lower than normal - thus encumbered normal troops would move 4" (or D4x2" Combat move)."

## TERRAIN MODIFICATIONS TO BASE MOBILITY: (p.22)

The base mobility factors assume movement over clear, relatively unimpeding terrain; certain types of terrain features will slow down movement considerably, according to the type of troops which are attempting to move through it. Different troop and vehicle types have different definitions of what constitutes POOR or DIFFICULT going, as explained in the Terrain Types section, but when these circumstances apply the following movement costs are used:

**CLEAR TERRAIN** — costs 1" worth of Movement to actually move figure 1".

**POOR TERRAIN** — costs 2" worth of Movement to actually move figure 1".

**DIFFICULT TERRAIN** — costs 3" worth of Movement to actually move figure 1".

**IMPASSABLE TERRAIN** cannot be traversed by that troop type.

*(Photo caption, not a rule: "Neu Swabian League Infantry with their LKPzW VI MICV, supported by a Power Armour squad.")*

## TERRAIN TYPES AND EFFECTS: (p.22)

The list given here details a wide selection of typical terrain that would be found on Earth or a reasonably terrestrial planet; there are notes given in the appendices for those players who wish to set their games in more 'exotic' environments.

**ROADS:** undamaged, solid roads and highways; includes dirt-tracks if they are stable and in good order.

**OPEN:** flat desert, plains, grassland etc. with only minimal obstacles to inhibit movement; provides good, firm going.

**LIGHT SCRUB:** rougher grassland, tundra etc., dotted with occasional bushes, trees and rocks.

**ROUGH/BROKEN:** rocks, gullies, thick scrub etc., making the going tricky for most vehicles and slowing foot movement.

**CULTIVATED:** farming land, includes ploughed fields, paddyfields and similar plantations - quite difficult to cross quickly on foot or by vehicle.

**SLOPES:** moderate hills and rolling terrain.

**SWAMP:** areas of boggy or unstable ground, can include bayous, soft sand, deep snow etc.

**OPEN WATER:** wide rivers, estuaries, lakes and calm coastal waters. Rivers count as Open Water if they are defined as being wide enough to be easily navigable to waterborne craft.

**RIVERS AND STREAMS:** narrower watercourses that provide obstacles (usually due to steep banks) but are not wide enough for effective navigation.

**LIGHT/OPEN WOODS:** fairly sparse forest or woodland, with trees well-spaced and not too much undergrowth to hinder movement.

**DENSE WOODS/JUNGLE:** thick forest or tropical/subtropical jungle, with very dense undergrowth; trees closely packed, very difficult going even for men on foot.

## TERRAIN EFFECTS ON MOBILITY: (p.23)

Having defined what each type of terrain is, we can now combine that with the different mobility types and and show exactly how the various types of element are affected by the terrain they cross:

**NORMAL INFANTRY:**
- CLEAR = Open, Light Scrub, Slopes, Roads
- POOR = Rough, Cultivated, Swamp, all Woods
- DIFFICULT = Rivers/Streams (crossing only)
- IMPASSABLE = Open Water (unless having amphibious capability, when counted as POOR)

**POWER-ARMOURED INFANTRY:**
- CLEAR = Open, Light Scrub, Rough, Cultivated, Slopes, Roads
- POOR = Swamp, all Woods
- DIFFICULT = Rivers/Streams (crossing only), Open Water (wading along bottom)
- IMPASSABLE = Open Water (unless having amphibious capability, when counted as POOR)

**LOW-MOBILITY WHEELED VEHICLES:**
- CLEAR = Roads
- POOR = Open, Slopes
- DIFFICULT = Light Scrub, Cultivated, Rivers/Streams (crossing only at designated ford - otherwise impassable)
- IMPASSABLE = Rough, Swamp, all Woods, Open Water (unless amphibious, when DIFFICULT)

**HIGH-MOBILITY WHEELED VEHICLES:**
- CLEAR = Roads, Open
- POOR = Light Scrub, Cultivated, Slopes
- DIFFICULT = Rough, Swamp, Rivers/Streams (crossing only)
- IMPASSABLE = All Woods, Open Water (unless amphibious, when POOR)

**TRACKED VEHICLES:**
- CLEAR = Roads, Open, Light Scrub
- POOR = Rough, Cultivated, Slopes
- DIFFICULT = Light Woods, Rivers/Streams (crossing only)
- IMPASSABLE = Swamp, Dense Woods, Open Water (unless amphibious, when POOR)

**HOVER/GEV (Ground Effect Vehicle):**
- CLEAR = Roads, Open, Open Water, Swamp
- POOR = Light Scrub, Slopes, Cultivated
- DIFFICULT = Rough, Rivers/Streams (crossing only)
- IMPASSABLE = All Woods

**GRAV: (in ground-skimming mode)**
- CLEAR = Roads, Open, Open Water, Rivers/Streams (crossing only), Light Scrub, Cultivated, Swamp
- POOR = Rough, Slopes
- (no DIFFICULT category printed for this mobility type)
- IMPASSABLE = All Woods (must use high mode to fly over)

**WALKER VEHICLES:**
- CLEAR = Roads, Open, Light Scrub, Slopes
- POOR = Rough, Cultivated
- DIFFICULT = Open Woods, Swamp, Rivers/Streams (crossing only), Open Water (wading on bottom)
- IMPASSABLE = Dense Woods

## VEHICLE MOVEMENT: (p.23)

Ground vehicles (this includes Hover/GEV types and Grav vehicles moving in ground-skimming mode) are moved in a similar way to infantry units, with each vehicle being treated as a "unit" in its own right.

Vehicles have the same two movement options as infantry, that is Normal movement up to a fixed distance, or Combat movement according to a die roll.

Normal movement for vehicles indicates that the driver is carefully picking his way over the terrain - an apparently "clear" stretch of off-road terrain is fraught with dangers for unwary vehicle drivers, and even roads in combat zones carry the ever-present risk of mines or booby-traps.

If the vehicle uses Combat movement, the driver has decided to make a dash for it and put his foot down. If the die roll is good, he has made it without mishap; if it is poor he has probably rammed a treestump or put a wheel down a nasty pothole - no damage is done, but it takes a few moments to get going again and he ends up not moving very far.

It should be noted that the actual speeds represented by vehicle moves in the game are in fact only a very small fraction of the theoretical 'maximum' speeds of the vehicles concerned. Most movement should be considered to be "tactical movement", with the vehicles darting from one covered position to another, spotting for the enemy etc., as well as having to negotiate all the myriad minor obstacles and obstructions that even a stretch of seemingly open, flat ground is in reality dotted with.

**Designer's note (bracketed text, verbatim):**
> There is another very good reason why we have kept vehicle movement rates low - that of playability. SGII is an infantry-based game; allowing vehicles to scoot from one side of the table to the other in a single turn, while perhaps being "realistic" in some cases, is very unbalancing to game play!

## BASE MOBILITY DISTANCE FOR VEHICLES: (p.23)

For the purposes of STARGRUNT II, we have given ALL vehicle types the same base mobility; this is **12"**, which gives a Combat Move of **D12 x 2 inches**. As no vehicle is ever going to be travelling at anything near its maximum speed during a game, setting different Base Mobilities for different mobility types is really not relevant, especially as a lot of vehicle movement is going to be randomised by die rolls anyway.

Where the differences between mobility types do come into effect is in which terrain types they count as Clear, Poor or Difficult (as listed under Terrain Effects): the effects of these classifications are the same as for infantry movement.

**Boxed summary (verbatim):**
> Vehicles move same as Infantry.
> Base Mobility for all vehicles = 12".

## TRANSPORT OF INFANTRY: (p.24)

Vehicles made specifically for transporting troops (ie: Armoured Personnel Carriers) may carry the number of troopers specified in their design - typically a squad of 8, but both smaller and larger APCs are common in some armies. Other vehicles may be used to transport troops, such as civilian-type trucks, jeeps and cars, and the capacities of such vehicles should be agreed by the players (a typical jeep or groundcar could carry 4-5 men including the driver, while a large truck might fit in as many as 20 or more). Getting troops into or out of a vehicle takes one MOVE action per squad/unit, during which neither the troops or the vehicle may do anything else. When disembarking from a vehicle, the troops should all be placed within 6" of the vehicle - they are then free to use their other action to move away, fire or whatever. To load troops in, the unit must be moved so that all figures are within 6" of the vehicle, then one action is spent to get everyone on board. If loading more than one unit into a large carrier or truck, it takes one action to get each individual SQUAD embarked, and each may only board when they are themselves ACTIVATED.

Some infantry-carrying vehicles (such as true MICVs - Mechanised Infantry Combat Vehicles) may be classed as having their own integral crews, in which case they may operate "empty" just as any other combat vehicle, and are considered to be "units" in their own right - they have their own activation and confidence markers and are fully independent of their carried infantry units. Others, particularly the "Battle Taxi" types of basic APCs, often do not actually have their own drivers or commanders - they will be driven by one member of the infantry squad, and commanded by the squad leader. These vehicles must therefore be parked up when the squad dismounts and may not do anything until the infantry re-mount, UNLESS the player opts to split the squad and leave some personnel aboard to operate the vehicle. If this is done, either the vehicle or the dismount team must be classed as a DETACHED ELEMENT (with all the relevant rules and limitations applying), depending on whether the squad leader stays in the "Trac" or dismounts with his troops. This rule applies even if the dismounts stay within Unit Integrity distance of the APC, owing to the difficulty of properly commanding the squad from inside the vehicle (or vice-versa).

**Boxed summary (verbatim):**
> Troops must be within 6" of carrier to embark;
> 1 action to load 1 squad.

## TRAVEL MOVEMENT: (p.24)

Travel movement is a special movement action which may be made in place of normal or combat movement, but ONLY when the unit is not expecting to be engaged in combat or be fired upon. Travel movement is used when a unit is required to move quickly, but at the cost of losing its immediate combat-readiness - the men will be marching with weapons shouldered or packed.

The unit must be formed into a COLUMN either one or two men wide, and in this mode the unit may not use actions for anything other than movement. Each figure in the column must be in base-to-base contact with the figure in front of it (or base centres within 1" if not using 1" bases). For each action spent in Travel Movement, the unit moves DOUBLE its base mobility in inches, so if it uses both actions it will actually move FOUR TIMES its base movement in the one turn.

It takes one action to form-up a unit for travel movement, and one action to get it to revert to either normal or combat movement: these are considered REORGANISE actions, during which the unit as a whole may NOT move, though the individual figures may be moved into or out of the column formation.

If a unit is fired on while in Travel mode, REDUCE the Range Die by one type, as they are caught in a very vulnerable state and are easy targets. In addition, any unit fired upon (by whatever weaponry) while in travel mode AUTOMATICALLY receives a SUPPRESSION marker, regardless of the fire result. After removing the suppression they must still use a reorganise action to get back into a combat-ready state.

**Boxed summary (verbatim):**
> Travel Move = twice Normal move; in column only, no other actions. REORGANISE required to return to combat state.
> If engaged, shift Range Die down one; unit automatically suppressed.

## MOVING CASUALTIES: (p.24)

Once a unit has taken casualties the player must decide what to do with them; if they cannot be evacuated or left in a safe area, then they must be abandoned (with the subsequent problems of Unit Confidence that this causes) or else carried with the squad until they can be got to safety.

If a squad moves on foot while carrying casualties, it is considered ENCUMBERED and moves as if one mobility type lower than normal - so a unit of normal infantry would move 4" instead of 6", and have a Combat Move die of D4 rather than D6. This applies whether there is one casualty or several being carried, but the limiting factor is that a squad cannot move more casualties than it has able-bodied personnel left; thus if an eight-man squad had taken four casualties the remaining four troops could move them, but if they took another hit they would have to abandon some of the wounded or else stop and wait for help.

Troops moving casualties may fire as normal - they are assumed to put the wounded down before taking the fire action!

**Boxed summary (verbatim):**
> Shift Mobility down 1 die type if carrying wounded.
> One fit man can move only 1 casualty.

---

## Illustrations (not rules content)

- p.22: photo of Neu Swabian League Infantry with an LKPzW VI MICV and a Power Armour squad (caption transcribed above).
- p.23: illustration (right column, spanning most of the column height) of two Power Armour troopers descending a rocky cliff face on a rope, one figure shown inverted/mid-climb (no caption, no rules text).
- p.24: illustration of a wheeled APC/transport vehicle (no caption, no rules text).

## Quick-reference disagreements / gaps

- **Combat Movement "stop at destination" nuance is missing from the QR.** The QR (p.1, MOVEMENT box) says Combat Movement "must indicate destination and then move full distance rolled," which taken alone implies the unit always travels the exact rolled distance. The full rulebook (p.22) clarifies this only applies when the roll is **insufficient** to reach the declared destination; if the roll is enough to reach the destination, the unit reaches it safely and **may then stop** rather than being forced further. A programmer coding strictly from the QR line could incorrectly overshoot the destination or fail to cap movement at it.
- **QR's "TROOP TRANSPORT" entry is a large simplification.** The QR gives only "must be within 6" of carrier to embark; 1 action to load 1 squad." The full rulebook (p.24) adds: troops disembarking must be placed within 6" of the vehicle; loading multiple squads into one large carrier/truck costs one action per squad and each squad may only board once it is itself activated; vehicle capacity guidance (typical squad = 8; jeep/groundcar 4–5 incl. driver; large truck up to 20+); the integral-crew MICV vs. driverless "Battle Taxi" APC distinction; and the requirement to use Detached Element rules when a squad splits between vehicle-crew and dismounted troops. None of this appears in the QR.
- **Moving Casualties is entirely absent from the QR's MOVEMENT section.** The QR MOVEMENT box (p.1) has no equivalent to the p.24 "MOVING CASUALTIES" rule (encumbrance for carrying wounded, one-casualty-per-fit-trooper cap, ability to still fire while carrying casualties). Only the general "Reduce movement one die type if encumbered" line hints at it, without giving the specific casualty-carrying mechanics.
- **All Terrain content (Terrain Modifications to Base Mobility, Terrain Types and Effects, and Terrain Effects on Mobility) is completely absent from the QR.** The QR's MOVEMENT box gives no Clear/Poor/Difficult/Impassable movement-cost multipliers (1"/2"/3" of movement per inch actually moved), no terrain type definitions, and none of the eight mobility-type-specific terrain tables (Normal Infantry, Power-Armoured Infantry, Low/High-Mobility Wheeled, Tracked, Hover/GEV, Grav, Walker). This is essential data for implementing movement that a programmer working only from the QR would entirely lack.
- **Base Mobility for vehicles is split across two pages in the full rulebook but merged in the QR.** The QR's single BASE MOBILITY DISTANCES table includes an "All vehicles: 12" (Combat movement D12x2")" row alongside the troop rows. In the full rulebook this vehicle figure is instead given separately under "BASE MOBILITY DISTANCE FOR VEHICLES" (p.23), while the p.22 BASE MOBILITY DISTANCES table covers only troops on foot. The numbers agree exactly (12", D12x2") — this is a presentation difference only, not a numeric conflict.
- **Travel Movement's "per action" doubling is only implicit in the QR.** The QR's Travel Move box ("twice Normal move") is quoted verbatim from the rulebook's own boxed summary (p.24), so there is no wording conflict, but the QR does not carry over the explanatory paragraph stating that the doubling is **per action spent**, meaning a unit spending both actions on Travel Movement moves **four times** its base mobility, not merely twice. A programmer relying only on the boxed line risks implementing a flat "2x" multiplier regardless of how many actions are spent.

<details><summary>Checker's corrections</summary>

- p.23, "TERRAIN EFFECTS ON MOBILITY" intro paragraph — was: "...and show exactly how the various types of element are affected by the terrain they cross. (Each mobility type below lists which terrain types count as CLEAR, POOR, DIFFICULT and IMPASSABLE for it, exactly as printed.)" — now: "...and **and** show exactly how the various types of element are affected by the terrain they cross:" (restored verbatim, including the printed book's own doubled "and and," which the first reader had silently corrected to a single "and"; also removed the trailing parenthetical, which is not printed on the page and is invented editorial commentary, and restored the printed colon in place of the added period).
- p.23, Vehicle Movement section, bracketed designer's aside after the "tactical movement" paragraph — was: a paraphrased summary ("*Designer's note (bracketed aside, summarised): the designers deliberately kept vehicle move rates low for playability, since letting vehicles cross the whole table in one turn (even if arguably "realistic") would unbalance an infantry-focused game.*") — now: transcribed in full and verbatim as printed ("There is another very good reason why we have kept vehicle movement rates low - that of playability. SGII is an infantry-based game; allowing vehicles to scoot from one side of the table to the other in a single turn, while perhaps being "realistic" in some cases, is very unbalancing to game play!"), since this bracketed aside is actual printed page content, not the checker's commentary, and should be given exactly rather than summarised.
- Illustrations list, p.23 entry — was: "full-page illustration of Power Armour troopers on a cliff/rope" — now: "illustration (right column, spanning most of the column height) of two Power Armour troopers descending a rocky cliff face on a rope, one figure shown inverted/mid-climb" (more precise description; the illustration occupies the right column, not the full page, and text/tables continue in the left column and at the foot of the page).

All other content was checked line by line against sg-p23.png (printed p.22), sg-p24.png (printed p.23) and sg-p25.png (printed p.24) — every number, die type, die shift, range, count, table cell and condition in the BASE MOBILITY DISTANCES table, the CLEAR/POOR/DIFFICULT/IMPASSABLE movement-cost figures, all eleven Terrain Type definitions, and all eight per-mobility-type Terrain Effects lists (Normal Infantry, Power-Armoured Infantry, Low-Mobility Wheeled, High-Mobility Wheeled, Tracked, Hover/GEV, Grav, Walker) — including the confirmed absence of a printed DIFFICULT line for Grav — matched the source exactly and required no change. The worked example's arithmetic (4→8", 6→12" covering the remaining 7", 1→2" leaving 5" short) and all three boxed summaries besides the vehicle one were also confirmed verbatim.

</details>

---

# Chunk 09 · pp. 25–27 · 10 Observation and hidden units, 11 Snipers and characters

Source scans: sg-p26.png = printed p.25; sg-p27.png = printed p.26; sg-p28.png = printed p.27. All images legible at full resolution; nothing marked [illegible].

---

## CHAPTER 10: OBSERVATION AND HIDDEN UNITS (p.25)

### HIDDEN UNITS: (p.25)

- When playing an Attack/Defence game (or any other scenario that warrants it), a DEFENDING player may elect to deploy some of his forces in concealed positions. Such units are NOT placed on the table during the deployment phase, but instead are represented by "Hidden Unit" markers placed face-down in the location occupied by the actual unit. The Hidden Unit markers (use the green counters marked with single letters) may be supplemented by a number of DUMMY markers — the book suggests 1D6 dummies for every 3–4 real units.
- One 'real' marker is used per UNIT that starts the game in concealment, and must be placed in positions in which elements could be concealed from enemy reconnaissance (such as at the edges of woods, within groups of buildings, in bushes or scrub etc.). The marker's placement represents the approximate centre of the actual unit's deployment area — when the figures are finally placed on the table they should be suitably spaced around the marker's location, within the limits for Unit Integrity. Any DUMMY markers are also placed in suitable locations, to confuse the attacking player.
- During deployment the player must note down in writing which unit is represented by which lettered counter, to avoid disputes later.
- Hidden Unit markers are revealed and replaced by the actual units they represent in the following circumstances:
  1. when the owning player first wishes to activate that unit;
  2. the first time that an opposing unit obtains a clear line-of-sight to the marker if it is in the open; or
  3. when an enemy unit makes a successful SPOTTING action on a marker that is in line of sight but concealed (e.g. in cover).
  - Dummy markers are removed from play when thus revealed, while 'real' markers are replaced by the models they represent.
- Inverted counters can also represent hidden mines, booby-traps etc., but these are NOT automatically revealed when in line of sight; specific rules on these follow below (see Spotting Hidden Units).
- Generally, units may not enter a 'hidden' state while the game is in progress, with the important exception of SNIPERS, who may go into hidden positions using their own special rules (see printed p.27).

### SPOTTING HIDDEN UNITS: (p.25)

- A **Leader (at any Command Level)** may use an action to OBSERVE in an attempt to identify an "unknown" inverted counter. (Only Leaders may take this action — the rule text explicitly restricts it to Leaders.)
- To resolve this, an opposed roll is made: the "target" (the player owning the observed counter) rolls a die type depending on the distance from the observer to the counter — starting with a D4, going up one die type for every full 12" of distance; the die rises a further 1 type if the counter is in soft cover, or 2 types if in hard cover. **If the target counter is also "in position," raise the die one more type.**
- The observer rolls two dice: one is his QUALITY DIE; the second is whatever die type is relevant to the form of SENSOR he is using — these range from ordinary unaided vision (D4) up to highly advanced electronics, per the Sensor Types Table below.

**SENSOR TYPES TABLE:**

| Sensor type | Die |
|---|---|
| Unaided Vision ("Mark 1 Eyeball") | D4 |
| Aided Vision or Basic Electronic Sensors | D6 |
| Enhanced Electronic Sensors | D8 |
| Superior Electronic Sensors | D10 |

- If BOTH the observer's rolls are less than or equal to the score of the owner of the counter, he has failed to identify it and the counter remains in place, still inverted.
- If ONE of the observer's rolls exceeds the counter's score, then the owner of the counter checks what it is (without revealing it at this stage): if it is a UNIT (infantry or vehicle) he flips the counter over, to show that there is indeed something there — he does NOT actually place the miniatures on the table. If the counter is a sniper, mine, booby-trap, or dummy, it is left inverted and the observer knows only that there is not actually a troop unit present.
- Should the observer beat the target's score with BOTH of his dice, then if the counter represents a **unit or a sniper** it is revealed and the actual figures are placed on the table; DUMMIES are removed from play, while mine and booby-trap counters are left inverted **unless the observer is within 6" of them**, when they are flipped face-up.

Boxed rule summary (as printed):
> Observe action used to spot hidden units; Roll Quality and Sensor dice, "target" rolls D4 shifted up for cover and for every 12" range. Minor success = counter flipped (if unit), dummies removed. Major success = figures placed if unit. Mines etc. only detected with Major success when within 6".

*(Note: this boxed summary is a compressed restatement of the paragraph rule above — see Quick-Reference Disagreements.)*

### FIRING AT UNLOCATED TARGETS: (p.25)

- A unit may, if wished, fire on any inverted counter that is within line-of-fire. This simulates attempts to suppress troops that might or might not be there, allowing for speculative fire and "reconnaissance by fire." Fire is calculated exactly as normal, with the following provisions:
- The "target" rolls a RANGE die as normal (as this is calculated by the firing unit's quality or weapon type), modified by COVER if appropriate (e.g. if the inverted counter was hidden in some soft cover, increase range die type by one).
- No casualties can result from speculative fire against unidentified counters; there is NO EFFECT from the fire UNLESS the firer manages to beat the target's best roll with TWO DICE OR MORE. If successful, then if the counter represents an actual unit it is flipped over, but the figures are NOT placed on the table — the presence of troops has been revealed by noise and movement when they came under fire (and maybe a scared trooper letting off a shot in response), but their strength and type is still uncertain. The unit thus revealed also receives a SUPPRESSED marker.
- If the counter is anything other than a troop unit (a dummy, minefield, booby-trap etc.) then it is left inverted and unidentified.

Boxed rule summary (as printed):
> Roll as normal fire; Major success = counter flipped (if unit) and suppressed. No other effects possible.

### DRONES: (p.25)

- Drones are tiny remotely-controlled flying reconnaissance units, operated by specialist teams of infantry; the drones themselves are expendable, and a drone team is assumed to carry several; each team may only control ONE drone at any one time.
- Drones in flight are represented by the DRONE counters from the counter sheet.
- If a Drone operating element is present on-table, it takes them one action to prepare and launch one drone; once a drone is in the air, the element may not carry out any actions except to control and spot with the drone — if they do anything else the drone crashes and is lost.
- Each action that the element spends controlling it, the drone may either MOVE or SPOT; if moved, it can go in any direction up to a distance of 24" per action.
- If it uses an action to SPOT, the drone may observe just as any other airborne unit; if it can see an inverted counter then that counter is revealed under the normal rules; for counters in cover the drone must make a spotting roll with a die type relevant to its System level (drones may be BASIC, ENHANCED or SUPERIOR as for all battlefield electronics); the range for the spotting attempt is the distance from the drone to the target.
- A drone may remain operational until it is recalled to its operator, shot down, or otherwise lost.
- A drone may be shot down by an enemy unit if the drone comes within ONE range band of the unit's weaponry (assuming the drone is a size 1 target); to attempt to shoot down a drone the firing unit uses one action and rolls its Quality die — if it beats the drone's system die roll, the drone is shot down.

Boxed rule summary (as printed):
> One action to launch drone. Move 24" per action or may SPOT. Roll spotting as other air units.
> Shooting down drones: if within 1 range band, opposed roll unit quality vs. drone level.

---

## CHAPTER 11: SNIPERS AND CHARACTERS (p.26–27)

### INDEPENDENT FIGURES: (p.26)

- Some figures do not operate as part of a unit but as single "independent" figures: SNIPERS and SPECIAL CHARACTERS. Snipers have their own rules governing their actions (see below). A Special Character can be almost any type of person, military or otherwise, introduced as background interest or a carry-over from another game; Special Characters will be out-of-the-ordinary "Heroes." *(Designer's note, summarised: StarGrunt II is a game of unit tactics rather than individual heroics, and Special Characters are recommended only for occasional use, not routine play.)*
- Independent Figures (both snipers and characters) must each have an Activation Marker like that of a normal unit, but do **NOT** require a Confidence Level marker. The COLOUR of the activation marker still represents the figure's QUALITY, and the Leadership number is his self-discipline/motivation. Example given in the text: a "GREEN 1" counter on a sniper indicates a newly-trained, inexperienced but highly motivated trooper, while a "VETERAN 2" would be a man with plenty of combat experience but less inclined to take risks.
- An Independent Figure may be ACTIVATED at any time in the game sequence, the same as activating any unit. Like any unit, it gets the chance to use TWO actions during its activation, and most standard actions apply to it.
- Special Characters MAY act like Leaders if written into the scenario as such. *(Flavour example about a Hero of the Revolution vs. a "Nerd Farmboy" summarised, not transcribed.)*
- Independent figures may be joined to squads at any time, simply by moving them within Unit Integrity distance of the squad they are joining. They may separate off from a squad at any time by moving away from it. When accompanying a squad, an independent figure is treated as a member of that unit in some respects, but may still be activated separately and carry out its own actions if desired — each turn the player may choose whether the figure shares the squad's actions or performs its own. An independent figure with LEADERSHIP abilities may act like a "senior officer," transferring his own actions to the squad and allowing it to do more in one turn than it would normally be capable of.
- *(Designer's note, summarised: the book cannot cover every case for Special Characters, and fitting them into scenarios needs work by the players.)*

Boxed rule summary (as printed):
> Independent figures activate like units; may have Leadership ability if specified. May join or leave squads at will.

### FIRING AT INDEPENDENT FIGURES: (p.26)

- When an independent figure is accompanying a squad, it is treated as a member of the squad for incoming fire purposes — when dicing to distribute hits among the squad, the independent figure is included and is an equally valid target as any other trooper in the unit.
- If an independent figure is on its own, not joined to any squad, it may be fired on under the normal rules as if it were a unit in its own right; the normal fire procedure applies, but the **TARGET DIE is shifted UP a die type** to reflect the increased difficulty of hitting a single man rather than a group of troops.
- **Worked example (transcribed in full):** "Thus if the independent figure is over one range band from the firers (and in the open), the range die would normally be a D6 but is shifted up to a D8 as the target is a single figure — if he was also in SOFT COVER it would rise to a D10."
- Note on the consequence of this: "the actual effect of this is that independent figures can only be fired on at up to four range bands if in the open, three range bands if in soft cover or two range bands if in hard cover, as ranges greater than these will push the die type over D12 and thus make the shot impossible."
- Independent figures may go "in position" using the usual rules, which gives them the usual extra die shift.
- If an independent figure is unlucky enough to get hit despite its dice advantage, then there is no need to do the "Who buys the farm?" roll — any hits inflicted will be taken by the figure. *(The "Who buys the farm?" mechanic itself is not defined on this page — it is referenced as an existing rule from elsewhere in the fire-combat chapter.)*
- Independent figures may be SUPPRESSED like any other troops, and need to make the usual roll (against their own leadership number) to remove the suppression.
- Independent figures that get caught in explosive bursts are diced for as any other figure — they get **NO special die shifts** in this case.

Boxed rule summary (as printed):
> If with squad, fired at as normal squad member.
> If separate, shift Target die up 1 type.
> Treat as normal figure against explosive bursts.

### REACTION OF INDEPENDENT FIGURES: (p.26)

- Independent figures take Reaction tests as any other unit does, with the same threat modifiers (if applicable) and the same results.
- Confidence tests are also taken in the normal way, but because independent figures don't have a Confidence Level marker, they use a different method of reacting to the results. When an event occurs that would require the figure to take a Confidence test, roll it as for any other unit (using the figure's leadership rating as the number to beat, plus any threat modifiers as appropriate):
  - If the figure **fails** the test, instead of the usual drop in confidence level it is given a **SUPPRESSION marker**, which has all the usual suppression effects and must be removed in the usual way.
  - If the figure fails the test **badly** (a result that would normally drop TWO confidence levels if it were a unit), give it one of the **PANIC markers** from the counter set; an independent figure with a PANIC marker suffers the same effects as if suppressed, and must roll to remove it as if it were a suppression marker, but **if the player rolls a ONE** when attempting this then the figure's nerve goes completely and the figure is **permanently removed from play**.

Boxed rule summary (as printed):
> Test as normal; if drop one CL then SUPPRESSED, if two then PANIC. Roll of 1 when removing Panic = nerve failed.

### SNIPERS: (p.27)

- Specialist Snipers are very deadly on the small-unit battlefield, as their role is to pick off the most important individuals in the enemy force — usually leaders or special weapons men. *(Designer's note, summarised: they are very effective in SGII, so their use should be carefully limited in most scenarios to avoid unbalancing play.)*
- Snipers may be attached to ordinary squads, in which case they move and act with the squad as any other trooper — if they fire, they are considered as any other support weapon in the squad: they may either add their firepower die to the squad's small arms, or fire on their own using a separate action. If a sniper fires in support of the squad's small arms, he may not choose a target figure — his fire is simply resolved along with all the rest; if he uses an action to fire separately, he may use the sniper fire rules below.
- It is when snipers split off from their squad and operate independently that they become truly effective.

### SNIPER FIRE: (p.27)

- When a sniper fires, the shot is resolved similarly to the normal firing process for a support or heavy weapon, with a few variations: the target player rolls a RANGE DIE as usual, calculated from the sniper's Range Band (shifted upwards as usual for cover or in-position status), but this Range Band is **TWICE** that used for normal small-arms fire from troops of the sniper's Quality level.
- **Worked example (transcribed in full):** "a VETERAN sniper would have a Range Band of 20" rather than the 10" of a normal Veteran trooper."
- The sniper rolls two dice: his quality die and the die relevant to his particular type of sniper weapon (see Sniper Weapon Types below). Even if he fails with both dice, the effect is still a SUPPRESSION on the target — the psychological effect of coming under sniper fire is very high.
- Success with ONE die means the sniper has hit one member of the target squad, but has failed to correctly identify a key figure — the soldier hit is determined randomly in the usual way.
- Success with BOTH dice means the sniper has picked out his target correctly and has hit him — the sniping player may choose which figure of the target squad is hit. Any figure hit must still be checked for wound/kill results with an Impact vs. Armour roll, so may yet survive.
- When the sniper rolls his two dice, he should actually roll the QUALITY die first — the reason is that if he rolls a score of **ONE** on this die, he has given his position away as he fired, and his miniature is placed on the table.

Boxed rule summary (as printed):
> Snipers fire normally, but RANGE BAND 2 x Quality. Minor Success means hit random figure, Major success means hit specified figure. If ONE rolled on Quality die, position revealed.

**SNIPER WEAPON TYPES:** (p.27)

The list below gives the types of specialist sniping weapons used in SGII, with their Firepower and Impact die types:

| Weapon | Firepower | Impact |
|---|---|---|
| Conventional Sniping Rifle | D10 | D10 |
| Gauss Sniping Rifle | D10 | D12 |
| Laser Sniping Rifle | D12 | D8 |
| Heavy Anti-Material Rifle | D8 | D12x2 |

*(Designer's note, summarised: the Laser rifle's high Firepower reflects its extreme accuracy, offsetting its low rate of fire; the Heavy Anti-Material Rifle ("HAMR"/"Hammer") is a high-calibre rifle built to take out armoured targets.)*

### SNIPERS - CONCEALED MOVEMENT: (p.27)

- A trained sniper knows not to take too many shots from one location — he is the master of "shoot and scoot," taking a shot and then stealthily moving to another position nearby for his next one; his survival depends on remaining unlocated.
- When a sniper is in a hidden firing position (represented by an inverted SNIPER counter), the player may place **two DUMMY counters** in suitable covered positions, each within 6" of the sniper counter.
- During his activation, the sniper may use one action to change his position to one of the dummy counters; to attempt this undetected, the player rolls the sniper's Quality die — if the score exceeds the sniper's "leadership," he has successfully changed position without being spotted, and his own counter (still inverted) is swapped with the dummy counter. This swap should not be watched by the opposing player, who should be asked to turn his back for a moment. *(Note: the text remarks that a certain amount of trust or an impartial umpire is helpful here to prevent "Gamesmanship.")*
- If the sniper fails to exceed his leadership, he is spotted while changing position and his figure is placed on the table in its new location, assuming an enemy unit is in suitable line-of-sight to observe him.
- Optional bluff tactic (rule as printed, in brackets): "The player with the sniper may, if he wishes, try to double-bluff his opponent by rolling to move the sniper and then not actually moving him at all — the downside of this trick is that if he rolls badly he still has to reveal the figure!"

Boxed rule summary (as printed):
> 2 extra fire positions allowed. Exceed LV with quality die to shift to different position - failure = revealed.

### SNIPERS GOING INTO HIDING: (p.27)

- If a sniper figure wishes to go from being "located" (figure on the table) to "concealed" (figure removed and replaced by counter) during the game, he may attempt to do so by using one action and rolling his quality die as for changing position. The sniper figure must, at that time, be in a suitable position (e.g. in cover of some sort) — even a trained sniper cannot hide out in the open.
- A **THREAT LEVEL of +2** is applied to this test, so the sniper must exceed his leadership **+2** in order to successfully go into hiding.
- Provided he succeeds, the figure is removed and **THREE markers** are placed on the table, all in covered positions and each not more than 6" from the location the figure was in (each marker within 6" of the next). One of the markers — the enemy does not get to see which one — is the sniper counter, while the other two are dummies; these represent the alternative firing positions the sniper has chosen.

Boxed rule summary (as printed):
> To hide, exceed LV+2; if successful place three inverted counters.

---

## Quick-Reference Disagreements / Additions

1. **Who may Observe.** The full rule restricts the OBSERVE action to "A Leader (at any Command Level)." The QR page 1 box just says "OBSERVE: action used to spot hidden units..." without stating this restriction — a programmer working from the QR alone could wrongly let any figure/unit take the Observe action.
2. **"In position" adds an extra range-die shift for the target's Spotting roll.** The full rule states that if the target counter is "in position," its die is raised **one more type**, on top of the shifts for range and cover. The QR box ("target rolls D4 shifted up for cover and for every 12" range") omits this "in position" shift entirely.
3. **Sensor Types Table is not in the QR.** The QR just says "roll Quality and Sensor dice" with no die-type table. The full text gives the concrete dice: Unaided Vision D4, Aided Vision/Basic Electronic Sensors D6, Enhanced Electronic Sensors D8, Superior Electronic Sensors D10. Without this table a programmer cannot implement sensor-based spotting at all.
4. **When dummies are removed, and what "minor" success actually reveals.** The QR box says "Minor success = counter flipped (if unit), dummies removed. Major success = figures placed if unit." Read literally, this could be taken to mean dummies are removed on a **minor** success. The full-page rule is more precise and different: on a **minor** success (one die exceeds), a UNIT counter is flipped (no figures placed) but a sniper/mine/booby-trap/**dummy** counter is left inverted — nothing is removed. Only on a **major** success (both dice exceed) are DUMMIES removed from play, and only then are a unit's **or a sniper's** figures actually placed on the table. This is a materially different sequencing from what the QR implies, and also clarifies that snipers are revealed like units on a major success but behave like mines/dummies (no reveal) on a minor success — a distinction the QR does not make at all.
5. **PANIC-removal roll of 1 has a different consequence for independent figures.** The general Panic rule (QR p.1) states "Takes 2 actions to remove - roll Reaction, TL 0 - score 1 = lose 1 CL." Independent figures have no CL marker, so page 26 states that for them a roll of 1 while removing a Panic marker instead means the figure's nerve fails completely and it is **permanently removed from play** — a harsher and structurally different outcome than the generic "lose 1 CL," not derivable from the QR text alone.
6. **Drone system levels for spotting only go Basic/Enhanced/Superior, not "Unaided" D4**, per the full drone rule — the QR does not mention system levels for drone spotting at all, it just says "Roll spotting as other air units."
7. **Sniper Weapon Types table is entirely absent from the QR.** The QR's SNIPERS box only gives the range-band/success/reveal mechanic, not the four weapon profiles (Conventional D10/D10, Gauss D10/D12, Laser D12/D8, Heavy Anti-Material D8/D12x2) needed to actually resolve a sniper's fire dice.
8. **Concealed-movement and going-into-hiding mechanics (two dummy counters for shoot-and-scoot vs. three counters for going into hiding, the LV vs. LV+2 thresholds, the double-bluff option) are not present in the QR at all** — the QR's SNIPERS box covers only firing, not concealment.
9. **Independent-figure rules (Chapter 11 as a whole — activation without CL marker, joining/leaving squads, target-die-up-one-type when fired on alone, suppression instead of CL loss on failed Confidence test) are not covered in the QR pages at all.**

---

<details><summary>Checker's corrections</summary>

Checked line by line against sg-p26.png (printed p.25), sg-p27.png (printed p.26) and sg-p28.png (printed p.27), including every number, die type, die shift, threshold, range, count, table cell and condition, and cross-checked the "Quick-Reference Disagreements" claims against qr-p1.checked.md and qr-p2.checked.md.

The first reading was highly faithful: every die type and shift (Sensor Types Table D4/D6/D8/D10; Sniper Weapon Types D10/D10, D10/D12, D12/D8, D8/D12x2; the "in position" extra shift; the range-die-up-one-type-per-single-figure rule and its D6→D8→D10 worked example; the sniper's doubled Range Band with the "20" vs 10"" worked example; the +2 threat level and three-marker/two-marker counts for sniper concealment), every threshold and count (1D6 dummies per 3–4 units, 6" spacing distances, "beat with two dice or more," roll-of-1-on-Quality-die reveals), all four boxed rule summaries verbatim, and all nine Quick-Reference Disagreements entries were transcribed and characterized correctly, with no numbers, dice, or table cells wrong.

One correction was made:

- **Where:** Chapter 11, "INDEPENDENT FIGURES" (p.26), the sentence on an independent figure with Leadership abilities acting as a "senior officer."
  **Was:** "...allowing it to do more in one turn than it would normally be capable of (cross-references the Transferring Actions rule)."
  **Now:** "...allowing it to do more in one turn than it would normally be capable of." — the parenthetical cross-reference to a "Transferring Actions rule" does not appear anywhere on p.26; it was invented commentary presented as if part of the rule text (unlike the digest's other asides, it was not labelled as an editorial note), so it has been removed to match the page exactly.

</details>

---

# Chunk 10 · pp. 28–30 · 12 Weapons and equipment

## PERSONAL ARMOUR (p.28)

Many (if not most) infantrymen in STARGRUNT II will wear at least some degree of personal armour protection - this can range from partial light armour (a combat helmet, main or upper torso protection and maybe a few armoured pads on shoulders, legs etc.) right through complete armoured bodysuits up to heavy Power Armour suits.

Each type of armour protection is assigned an ARMOUR DIE TYPE, which determines how well it protects its wearer from injury - these are listed in the table below. This is the die type rolled whenever you have to check if the armour protects the wearer, and is normally used in an opposed roll against the firing weapon's Impact Die type.

Note that figures wearing no effective armour, including those in civilian clothing, count as "basic battledress" for an Armour Die of D4.

A helmet is assumed to be part of most troops' equipment even if otherwise unarmoured, but whether or not an individual miniature figure is actually wearing one does not affect its Armour Value category. As with many other aspects of the rules, players should determine and agree before the game as to what kind of armour their troops are taken to be wearing, which should in most cases be fairly obvious from the miniatures themselves.

### ARMOUR TABLE

| Type of armour worn: | Armour Die |
|---|---|
| Basic Battledress | D4 |
| Partial Light Armour | D6 |
| Full-Suit Light Armour | D8 |
| Combat Power Suit ("Light" Power Armour) | D10 |
| Heavy Power Armour | D12 |

(This table matches the ARMOUR table on the quick-reference sheet exactly, except that the quick reference also lists "Vehicle Armour: D12 x Armour Class," which does not appear in this table on p.28.)

## SYSTEM QUALITIES AND LEVELS (p.28)

SYSTEM QUALITY refers to the level of sophistication and ability of the various Electonics [sic, printed exactly thus] and Sensor packages with which vehicles, weapons and sometimes infantry are equipped.

The different types of SYSTEMS include:

- **ELECTRONIC WARFARE (EW) SYSTEMS:** Battlefield electronics systems carried by EW specialists to intercept and jam communications, provide electronic intelligence-gathering and disrupt enemy electronics.
- **FIRE CONTROL SYSTEMS:** The package of sensors and computer modules that assist the Gunner of a vehicle in controlling Direct-Fire weaponry.
- **ELECTRONIC COUNTER MEASURES (ECM):** Systems designed specifically to jam the guidance of incoming Missiles.
- **GUIDANCE SYSTEMS:** The sensor and guidance package of a Missile Launcher (GMS), that determines how well the missiles can seek their targets and avoid enemy ECM.

Each SYSTEM is rated as one of three QUALITY LEVELS: BASIC, ENHANCED or SUPERIOR.

- **BASIC** systems are exactly what they sound like - the simplest and cheapest form of the system, with relatively limited abilities; they roll a **D6** whenever the system attempts a task.
- **ENHANCED** systems are better than Basic, costing more but having a better chance of doing their job successfully; **Enhanced** systems use a **D8**.
- **SUPERIOR** are the top-line, state-of-the-art systems - the most complex and expensive, but also the most effective; Superior systems use a **D10**.

(System Quality Level table below is compiled from the prose paragraphs above for reference; it is not printed as a table in the original - the three quality levels appear only as three consecutive bold-lead-in paragraphs on p.28.)

| System Quality Level | Die rolled |
|---|---|
| Basic | D6 |
| Enhanced | D8 |
| Superior | D10 |

## WEAPONS SYSTEMS (p.28)

Weapons in STARGRUNT II fall into three basic categories:

- **SMALL ARMS** are the personal weapons carried by the majority of infantrymen, generally rifle-type arms but also including pistols, submachine-gun types and similar.
- **INFANTRY SUPPORT WEAPONS** are things like Squad Automatic Weapons (light machineguns and their higher-tech equivalents), man-portable Plasma guns, small portable missile or rocket launchers and so on - anything that may be carried and fired by a single trooper.
- **HEAVY WEAPONS** covers any weapon that is large enough to require mounting on a vehicle, or on a tripod, wheeled, hover or grav mount. Heavy Weapons range in size from medium/heavy crew-served machineguns right up to the heaviest tank guns.

(No numeric weapon-statistic tables for Small Arms or Infantry Support Weapons appear on these three pages; the text states elsewhere on p.30 that the Automatic Grenade Launcher, the one Infantry Support Weapon dealt with individually, "is covered in the Infantry Support Weapons section on P.34" - i.e. outside this chunk.)

## WEAPONS TECHNOLOGY (p.28–29)

### INFANTRY WEAPON TECHNOLOGY (p.28)

In the sort of background in which SGII is set, most common small arms are assumed to still fire projectiles of some sort. They may fire them by conventional explosive propellants (mainly using caseless round technology) or by injecting liquid/gaseous propellants into the firing chamber behind the round; alternatively they may employ magnetic accelerator (Gauss Rifle) mechanisms. The important thing is that a high-velocity projectile comes out of the business end of the gun, and damages its target by imparting lots of kinetic energy to it. Additionally, many small arms used in STARGRUNT II are capable of firing small airburst explosive rounds (usually from an over/under type secondary barrel), which will actually be used more frequently than kinetic-penetrator rounds in most infantry firefight situations.

Moving on from the "conventional" side of infantry weapons, we have the more esoteric stuff in the form of Directed Energy Weapons (DEW); this covers Lasers and Plasma/Fusion guns. In the technology levels assumed in our own background material, both these weapons are perfectly feasible for battlefield use and could in fact be issued to all troops as small arms - in practice they are not, for the same reasons that currently (in the late 20th century) we still use good old helicopters and conventional aircraft when we have ample technology to build VTOL aircraft - it is all down to cost-effectiveness, reliability and the like. Plasma guns are immensely powerful but are bulky, heavy and expensive. Lasers require huge power inputs to do much damage, have significant recycle times (hence low rates of fire) and are not good penetrators of armour. Both weapons are relatively fragile, complex and not terribly reliable. It is therefore considered much better to give the average Grunt a nice, old-fashioned, strong and dependable rifle that he can use easily, doesn't cost a fortune and will be unlikely to break too often.

Where the DEW systems ARE used is for specialist tasks. Plasma Guns are in common use with most major armies as a support and point-fire weapon, normally utilised as an alternative to rockets or missiles as an anti-hard-target system at squad or platoon level; their major disadvantage in use is the huge firing signature, made even worse by clouds of vapour caused by the standard practice of bleeding liquid nitrogen through the weapon barrel after firing to cool it for the next shot. Lasers are the preferred weapons of many snipers, who value their low firing signature and pinpoint accuracy over extreme ranges. For these benefits they can live with the low rate of fire and relatively low armour penetration capability - the sniper is used to placing each and every shot where it will count.

Portable rocket launchers, both reloadable and disposable one-shot types, are still in common use as cost-effective antiarmour weapons for the infantry. Unguided antitank rockets are cheap and simple, and though high-tech armour has reduced their effectiveness somewhat they are still popular with many forces - they also can't be "spoofed" by ECM or other countermeasures.

Infantry-carried missiles, in both the one-man GMS/P (Guided Missile System, Portable) and the larger crew-served GMS/L (Guided Missile System, Light) versions, are common in most armies. The missiles themselves are all of the fire-and-forget type, with sophisticated seeker heads that may be configured for operation against ground or air targets.

GMS/P launchers are often magazine-fed with three or four round capacities, while GMS/L systems use single tube-packaged rounds attached to a portable firing/guidance unit.

*(Designer's note/flavour, summarised: this whole section is background flavour explaining why, technologically, infantry mostly still fight with kinetic-projectile rifles rather than lasers/plasma weapons, and where DEW and missile weapons fit into the setting. No new numeric rules are given here.)*

## HEAVY WEAPONS (p.29)

Heavy Weapon types are defined by Size Classes in much the same way as vehicle sizes; weapons are generally available in sizes 1 (Smallest) to 5 (Largest), though not every different kind of system will be available in all sizes - for example, an RFAC is available in sizes 1 or 2 only, while an HKP only comes in classes 3 to 5. Full details of the possible sizes for each weapon type are given in the sections describing the weapon systems.

The Size Class of a weapon system determines the damage it can inflict and how much space the system takes up when mounting it in a vehicle; it also of course affects its potential range, but this is of fairly minor consequence in SGII (at least with the bigger systems) due to the short distances involved on the tabletop.

## HEAVY WEAPONS SYSTEMS (p.29)

The weapons described below are the main types of vehicle-mounted heavy weapons, and are the same types as used in DIRTSIDE II. Players are, of course, free to develop their own additional systems if they wish.

### RAPID-FIRE AUTOCANNONS (RFACs)

"Conventional" small-calibre shell-firing cannons. The RFAC is available in size classes 1 and 2 only, corresponding to 20-25mm and 30-40mm calibres respectively.

- RFAC Base Impact Value: **D10**.
- RFAC Impact Value multiplier = size class, eg: RFAC/2 has Impact **D10x2**.

### HIGH VELOCITY CANNONS (HVCs)

The HVC is the final development of the conventional high-velocity tank gun, generally a large-calibre weapon firing superdense saboted rounds; most are fin-stabilised smoothbores, and use liquid propellants. HVCs are available in size classes 3 to 5.

- HVC Base Impact Value: **D10**.
- HVC Impact Value multiplier = size class, eg: HVC/4 has Impact **D10x4**.

### HYPER-KINETIC PENETRATORS (HKPs)

A common tank/antitank weapon, the HKP uses a relatively small-calibre (but VERY long) barrel to develop hyper-velocities for its superdense long-rod penetrator rounds. Early models use liquid propellants, while the more advanced types use a very small plasma reaction to propel the round. HKPs are available in size classes 3 to 5.

- HKP Base Impact Value: **D12**.
- HKP Impact Value multiplier = size class, eg: HKP/5 has Impact **D12x5**.

### GAUSS AUTOCANNONS (GACs)

Autocannons that fire kinetic-energy projectiles by electromagnetic acceleration. GACs are small calibre weapons with a very high rate of fire, using solid slugs propelled at incredibly high velocities. GACs are available in size classes 1 and 2.

- GAC Base Impact Value: **D12**.
- GAC Impact Value multiplier = size class, eg: GAC/2 has Impact **D12x2**.

### MASS-DRIVER CANNONS (MDCs)

Larger magnetic-acceleration weapons, the heavier versions of the Gauss Autocannon. Primarily used as long-range tank killing weapons. MDCs are available in size classes 3 to 5.

- MDC Base Impact Value: **D12**.
- MDC Impact Value multiplier = size class, eg: MDC/3 has Impact **D12x3**.

### HIGH-ENERGY LASERS (HELs)

Combat Lasers project a very short but very high-intensity pulse of coherent light energy, causing damage to the target by the sudden massive overpressure and explosive vaporisation effects as the beam's energy is released at the point of impact.

When engaging point (armoured) targets, HELs use a single very high energy pulse; when they need to engage infantry or other dispersed targets a lower power setting enables the weapon to "sweep" an area with rapid-fire pulses of much lower intensity. HELs are available in all size classes (1-5).

- HEL Base Impact Value: **D8**.
- HEL Impact Value multiplier = size class, eg: HEL/4 has Impact **D8x4**.

### DIRECT-FIRE FUSION GUNS (DFFGs)

The "big brothers" of the Infantry Plasma Guns. Each round of DFFG ammunition consists of a hydrogen fuel charge, a flash laser ignition system to heat the fuel to plasma state and the power supply that holds the plasma in containment until fusion occurs, when the bolt is released down the magnetically screened barrel. DFFGs are available in all size classes (1-5).

- DFFG Base Impact Value: **D12**.
- DFFG Impact Value multiplier is **DOUBLE** size class, eg: DFFG/2 has Impact **D12x4**, DFFG/4 has **D12x8**.

### GUIDED MISSILE SYSTEMS (GMS)

Advanced guided weapons using "fire and forget" guidance systems. Effective armour-killers, but susceptible to countermeasures - it is relatively simple for a properly equipped vehicle to confuse and jam an incoming missile.

GMSs are available in size classes 1 and 2, which are denoted as GMS/L (light) and GMS/H (heavy) respectively. Infantry may only carry GMS/Ls, while vehicles may be equipped with L or H versions subject to normal size restrictions. When GMS/L systems are issued to infantry they count as crew-served heavy weapons - they are larger and more powerful than the little one-man GMS/P launchers covered in the Infantry Support Weapons section.

- GMS Base Impact Value: **D12**.
- GMS/P Impact Value: **D12**; for GMS/L and GMS/H Impact Value multiplier is **DOUBLE** size class, ie: **D12x2** and **D12x4** respectively.

### Heavy Weapons Systems summary table (values as printed, compiled from the text above; not printed as a table in the original)

| System | Base Impact Value | Size classes available | Impact multiplier rule | Worked example(s) |
|---|---|---|---|---|
| RFAC | D10 | 1–2 only | = size class | RFAC/2 = D10x2 |
| HVC | D10 | 3–5 | = size class | HVC/4 = D10x4 |
| HKP | D12 | 3–5 | = size class | HKP/5 = D12x5 |
| GAC | D12 | 1–2 | = size class | GAC/2 = D12x2 |
| MDC | D12 | 3–5 | = size class | MDC/3 = D12x3 |
| HEL | D8 | 1–5 (all) | = size class | HEL/4 = D8x4 |
| DFFG | D12 | 1–5 (all) | DOUBLE size class | DFFG/2 = D12x4; DFFG/4 = D12x8 |
| GMS (GMS/P) | D12 | — (infantry-portable) | n/a — flat D12 | GMS/P = D12 |
| GMS/L, GMS/H | D12 | 1–2 (L, H) | DOUBLE size class | GMS/L = D12x2; GMS/H = D12x4 |

## CREW-SERVED WEAPONS (p.30)

Heavy weapons of size class 1 may be used on infantry-portable groundmounts, usually a tripod mounting with the complete weapon system being broken down into several manpack loads. The weapon crew will normally consist of between two and four men, and such a team is considered a unit in its own right. The weapon takes one action to set up ready for firing, or TWO actions if the crew is understrength for any reason. Tearing the weapon down for movement takes the same time as setting it up. When moving with the weapon system packed for transport, the crew count as ENCUMBERED. If the normal crew is reduced to half strength or less, the weapon may not be moved - it may, however, continue to fire if it has at least one crewman left.

Whenever a crew-served weapon unit is hit by fire, the weapon itself should be rolled for as if it was a member of the unit - if it is hit, it gets a **D8 Armour Die** - a KILL result will disable the weapon.

A crew-served weapon may be equipped with a Fire Control system; it fires in all ways like a vehicle-mounted weapon, but may NOT fire if the crew is SUPPRESSED.

Heavy weapons of size 2 and above may NOT be man-packed - they require either self-propelled or towed carriages.

## AMMUNITION SUPPLY (p.30)

For most weapons, we ignore the question of ammunition supply - it is assumed that, for example, infantrymen carry sufficient small-arms ammunition for the length of a typical engagement. If you wish to run a scenario in which limited ammunition supply is a problem to one or both sides, then feel free to do so; you will however have to do a fair bit of paperwork to record ammunition usage by each of your units.

Where the ammunition supply does affect ALL games is in the case of weapons such as infantry-portable missile or rocket launchers, or any similar weapon that carries only a few rounds of ammunition (or is a single-shot disposable weapon). With these weapons, the figures carrying them should each be allocated a number of the "missile" counters - each counter represents one round of ammunition and is expended when fired.

Disposable one-shot weapons naturally only have one counter - when that is gone the weapon may not be fired again.

Magazine-fed infantry portable Missile Launchers generally carry three rounds, though two and four-shot types are possible; we suggest for general purposes allocating three shots (ie: three counters) to all these weapons, though if you prefer to use the actual number that relates exactly to the miniature figure then do so. When the counters are all expended the weapon may not fire again, though with the agreement of all players it may be permitted for troops to re-arm with extra rounds from a suitable point (usually their squad APC) by spending a Reorganise action next to the vehicle.

> Boxed callout text: "Each MISSILE weapon has a limited number of rounds available (usually 3). indicated by counters placed with figure; one counter expended per missile fired."

*Photo caption (flavour, not a rule): "An FSE Squad (left) fires a GMS/P at an NAC Phalanx APC. Note the counter used to indicate the missile in flight, leaving the GMS operator with two remaining rounds."*

## GRENADES (p.30)

Hand grenades and launched grenades are both assumed to be in common use, but in game terms their effects are factored-in to the combat mechanisms and they do not need to be treated as separate weapons; the small-calibre grenades fired from infantry small-arms are included in the fire combat calculations (giving a bonus to the small-arms firepower of troops so equipped), while hand grenades are assumed to be included in the close-assault resolution - they can only be thrown about 4-5 inches of table range, so are within the realm of close combat weapons.

The only type of grenade weapon that is considered in its own right is the Automatic Grenade Launcher, which is covered in the Infantry Support Weapons section on P.34 (outside this chunk of pages).

## MULTIPLE LAUNCHER PACKS (p.30)

These weapon systems are used mainly by Power Armour suits, though they are sometimes found fitted to vehicles as additional anti-infantry weapons. An ML pack is a box launcher for a cluster of very small (20-30mm calibre) rockets, which are salvo-fired to saturate a dispersed target (ie: infantry) with a lot of grenade-sized warheads.

For game purposes, an ML pack functions as an infantry support weapon, in that it adds an extra die to the small-arms fire resolution.

Most suits are fitted with twin packs, one over each shoulder, but both are fired at once and count as a single salvo (ie: only one support die is added per trooper with ML packs, not one per individual pack).

Each ML salvo fired adds a **D8** support die to the unit's firepower.

For simple games we assume that ML packs carry enough rounds to fire unlimited salvoes during the game - if you wish to specify limited ammunition (we would suggest three salvoes per suit) and keep the appropriate records feel free to do so.

## POWER ARMOURED TROOPS (p.30)

Power Armour troopers are "heavy infantry" in power-assisted combat suits, giving them superhuman abilities of strength and protection. PA troops have a tendency to consider themselves a bit above the average lowly Grunt, which can make for some animosities when they are mixed with "ordinary" infantry for missions.

Power Armour is not easy to operate without considerable specialist training, hence PA troops will generally be of good quality - in most armies only the best and most experienced troops are transferred to the Powered Forces, so most PA units will be at least VETERAN quality if not ELITE; some armies may have a very few REGULAR units of PA troops, but this is unusual. GREEN PA units are virtually unheard of, and an UNTRAINED man in a PA suit would probably kill himself and most of his comrades long before he sighted an enemy!

In game terms, PA units function just like any other infantry unit for most purposes - their movement rates and armour protection are better, but these are covered in the relevant rules sections.

The capabilities of Power Armour suits are defined by their armour levels - Light or Heavy (these terms are entirely relative, as even "light" PA is much tougher than any unpowered personal armour) - and their mobility, Slow or Fast; a slow PA suit has the same mobility as an ordinary unarmoured trooper, while the fast suits are much more agile.

The highest tech suits are fast mobility and heavy-armoured; older obsolescent designs could be slow and light-armoured.

PA squads are formed in the same way as normal infantry units, though they generally tend to have fewer personnel - an army using 8-man infantry squads would probably only have 5 or 6 man PA units. A PA unit activates just as any other unit, with the usual 2 actions - it may use any of the actions available to normal infantry.

When conducting fire combat, a PA unit again operates just as any other infantry squad; the standard APW (Anti-Personnel Weapon) of a PA suit is basically equivalent to an ordinary infantry "rifle" and small-arms fire is worked out in the usual way.

*(Illustration on p.29: full-page line-art of Power Armoured troopers ["ZUMI II", "21st", "ADL" markings visible on suits] carrying an autocannon-type weapon and a quad rocket/missile pack - flavour art, not a rule.)*

*(Photo on p.30: a wargames-table photo of an APC and infantry figures in scrub terrain, captioned as above under Ammunition Supply.)*

## quickRefDisagreements (places where this chunk of the full rulebook says something different from, or more than, the quick-reference summary)

- The quick-reference ARMOUR table (qr-p1) lists six rows, including "Vehicle Armour: D12 x Armour Class." The ARMOUR TABLE on p.28 of the rulebook lists only the five personal-armour rows (Basic Battledress D4 through Heavy Power Armour D12) and does NOT include a Vehicle Armour row or an "Armour Class" concept at all - that vehicle-armour figure is not present anywhere on pages 28-30.
- The quick reference gives no information at all on System Qualities/Levels (Basic/Enhanced/Superior, D6/D8/D10), on the specific Heavy Weapons Systems (RFAC, HVC, HKP, GAC, MDC, HEL, DFFG, GMS) and their Base Impact Values, size-class multiplier rules and worked examples, on Crew-Served Weapons rules (D8 armour die for the weapon itself, set-up/tear-down actions, encumbrance, understrength penalties), on Ammunition Supply/missile-counter rules, on Multiple Launcher Packs (D8 support die), or on Power Armoured Troops (quality tendencies, Light/Heavy and Slow/Fast suit categories). All of this is "more than" the quick reference and a programmer relying only on the quick-reference sheet would have no data at all for heavy-weapon damage values, ML pack support-die values, or crew-served-weapon armour values.
- The quick reference's Generic Weapons Table (small arms and support weapons firepower/impact dice, e.g. Gauss Rifle D12, Infantry Plasma Gun D6/D12*, MLP D8/D8*, etc.) is not duplicated on pages 28-30 of the full rulebook; those specific small-arms/support-weapon statistic tables are on a different page of the book (referenced here only indirectly, via the p.30 cross-reference to "the Infantry Support Weapons section on P.34" for the Automatic Grenade Launcher). A programmer should not assume pages 28-30 contain the small-arms/support-weapon stat tables — they are elsewhere in the book.
- The quick reference does not mention that GMS/L systems, when carried by infantry, "count as crew-served heavy weapons" rather than as a support weapon like the one-man GMS/P - this distinction (crew-served vs. infantry-support classification of the two missile-launcher types) is only in the full text on p.29.
- The quick reference's ARMOUR TABLE gives armour dice only by armour-type category and does not mention the crew-served-weapon-specific rule that the weapon itself (as distinct from its crew) always uses a flat D8 armour die when checking for a hit regardless of what armour die the weapon type "should" logically have - this is a p.30-only rule.

<details><summary>Checker's corrections</summary>

Checked word-for-word, line by line, against sg-p29.png (printed p.28), sg-p30.png (printed p.29) and sg-p31.png (printed p.30), including 1.8x–2x pixel-level zoom crops of the ARMOUR TABLE, the SYSTEM QUALITIES bold-lead-in paragraphs, the WEAPONS SYSTEMS bullet definitions, every Heavy Weapons Systems sub-section (RFAC/HVC/HKP/GAC/MDC/HEL/DFFG/GMS, all Base Impact Values, size-class ranges and worked-example multipliers), the CREW-SERVED WEAPONS paragraph, the boxed MISSILE-counter callout, and the GMS/P photo caption. Cross-checked the quickRefDisagreements section against qr-p1.checked.md and qr-p2.checked.md.

Result: every number, die type, size-class range, impact-value multiplier rule, worked example, table cell, and rule condition in the chunk matches the source pages exactly. Nothing on pages 28-30 was found to be omitted, and no rule text in the file is invented, paraphrased incorrectly, or misplaced relative to its source section. Both printed oddities the first reader preserved verbatim were confirmed correct at pixel zoom: "Electonics" (sic) in the SYSTEM QUALITY paragraph, and the boxed callout's "(usually 3). indicated by counters..." (lower-case "indicated" after a full stop, exactly as printed). The photo caption "An FSE Squad (left) fires a GMS/P at an NAC Phalanx APC..." and the Power Armour illustration's visible suit markings ("V", "ZUMI II", "21st", "ADL...") were also confirmed by zoom.

One correction made — where: the "System Quality Level | Die rolled" table (Basic/Enhanced/Superior → D6/D8/D10), directly under the SYSTEM QUALITIES AND LEVELS heading; was: presented as a plain table with no indication of its source; now: prefixed with a parenthetical note ("...compiled from the prose paragraphs above for reference; it is not printed as a table in the original - the three quality levels appear only as three consecutive bold-lead-in paragraphs on p.28.") so it isn't mistaken for a printed table, matching the disclaimer already used for the compiled Heavy Weapons Systems summary table further down the same file. The values themselves (D6/D8/D10) were already correct and unchanged.

No other changes were made; every other table, worked example, and rule statement in the file was verified correct as originally transcribed.

</details>

---

# Chunk 11 · pp. 31–32 · 13 Vehicles

Source: STARGRUNT II (Jon Tuffley, Ground Zero Games, 1996), printed pages 31–32 (scan files sg-p32.png, sg-p33.png).

## USE OF VEHICLES IN STARGRUNT II GAMES (p. 31)

Designer's-note flavour (summarised): warns against fielding heavy AFVs that don't suit the scenario being simulated — e.g. Main Battle Tanks on both sides would logically have destroyed each other at ranges far beyond an SGII table; mechanised infantry with APCs and a couple of light tanks attacking a lightly-held position is reasonable; if you want lots of heavy vehicles, stage them as an armoured column ambushed in close terrain by a prepared anti-armour infantry force, to teach the lesson that tanks need infantry support.

Rule (verbatim substance): Any vehicle designed under the system given in DIRTSIDE II can be used with these rules; the weapon and system statistics and levels are basically the same between the two rulebooks, although some work a bit differently here because of the great difference in groundscale — everything on a STARGRUNT II table is well within the closest range bands of a DSII game.

## VEHICLE TYPES AND TECHNOLOGY (p. 31)

Rule: SGII allows any type of vehicle, from conventional wheeled and tracked types up to Grav or Walker machines, depending on the technology available to the army being used. The player must decide the highest tech level their force can field (e.g. can they build Grav vehicles, or afford to buy them from someone who can), noting that a nation's troops are not automatically equipped with the highest tech theoretically available to it — high-tech equipment is expensive to buy/develop, needs complex support and field maintenance, and a cheaper/simpler alternative may not be worth foregoing.

Flavour (summarised): illustrative background — Grav technology, while broadly available, is expensive, power-hungry and maintenance-intensive, so even top powers mostly reserve it for a few elite strike units (and parades); most "ordinary" troops still use cheap, reliable wheeled, tracked or hover vehicles, if they get to ride at all.

## VEHICLE SIZE CLASSES (p. 31)

Rule: Vehicles are referred to by their SIZE CLASS, generally from Class 1 (VERY SMALL) through to Class 5 (VERY LARGE). The Size Class of a vehicle determines how much (and what kind of) equipment, weapons and cargo can be fitted into it.

Size Class table (as printed, with example vehicle types for each class):

| Size Class | Description | Example vehicle types |
|---|---|---|
| Class 1 (VERY SMALL) | — | Very light scout vehicles, 'jeeps', fast attack buggies etc. |
| Class 2 (SMALL) | — | Light scout tanks, small APCs (typically 4-6 man capacity), small armoured cars etc. |
| Class 3 (MEDIUM) | — | Medium Tanks, APCs and MICVs (8-12 man capacity), light SP Artillery, most VTOL transports and gunships etc. |
| Class 4 (LARGE) | — | Heavy tanks, larger APCs (usually those with a capacity of more than 12 troops), big SP Artillery pieces etc. |
| Class 5 (VERY LARGE) | — | Superheavy tanks and similar very big combat vehicles, Interface Landers and Dropships. |

**CAPACITY (derived from Size Class):** To determine how much CAPACITY a vehicle has for carrying weapons and other systems (and for transporting Infantry etc.), simply multiply the vehicle's Size Class by FIVE; thus a class 4 (LARGE) vehicle would have 4 x 5 = 20 Capacity points available.

Exception/note, worked example (verbatim): *"Bear in mind that you do not have to use up ALL the capacity points allowed by the vehicle's size, especially if doing so would produce a ludicrous situation. This is especially true with the smaller size classes - a motorbike and sidecar is a size 1 vehicle, which gives it 5 capacity points - thus by the numbers it could carry FIVE infantrymen. This would be amusing, but not very sensible......"*

*(A sketch of a soldier firing a heavy rifle appears in this column; it is illustrative art, not a rules diagram.)*

## VEHICLE DESIGN AND CLASSIFICATION (p. 31)

### VEHICLE ARMOUR:

Rule: Each vehicle type is assigned an ARMOUR VALUE, a numerical rating from 1 (very thin, used on light AFVs) to a maximum of 5 (very heavy Battle Tanks).

Rule: In STARGRUNT II, this value is used as a MULTIPLIER to a D12 roll when the vehicle ARMOUR DIE needs to be rolled; thus a vehicle with Armour Value 3 would roll a single D12 and multiply the result by 3, giving a range of possible results from 3 to 36.

Rule: NO VEHICLE MAY CARRY AN ARMOUR RATING HIGHER THAN ITS BASIC SIZE CLASS; thus a size 4 vehicle could only be fitted with a MAXIMUM Armour Value of 4.

Rule: The rated Armour Value actually indicates the armour used on the FRONT surfaces of the vehicle; the SIDES, TOP and REAR are assumed to have a value of 1 LESS than the frontal armour, except for those with Armour 1, which are assumed to be 1 all round.

Worked example (verbatim): *"a vehicle with an Armour Value of 5 would have armour 5 on the front, but only armour 4 on sides, top and rear."*

Rule: "Softskinned" vehicles — those with no armour protection, such as trucks, jeeps and civilian vehicles (which in DIRTSIDE II have armour 0) — use a D6 as their Armour Die, whatever face is fired upon.

Rule: OPEN-TOPPED vehicles count as SOFTSKINNED (Armour Die D6) against all INDIRECT FIRE, regardless of what other armour they have.

### WEAPON SIZE CLASSES:

Rule: Weapon types are defined by Size Classes in much the same way as vehicle sizes; weapons are generally available in sizes 1 (Smallest) to 5 (Largest), though not every kind of system is available in all sizes — for example, an RFAC is available in sizes 1 or 2 only, while an HKP only comes in classes 3 to 5. Full details of the possible sizes for each weapon type are given in the sections describing the weapon systems (not on these pages).

Rule: The Size Class of a weapon system determines the damage it can inflict and how much space it takes up when mounting it in a vehicle.

### WEAPONS FIT LIMITATIONS: (heading on p. 31; text continues onto p. 32)

Rule: The size and number of weapons that a vehicle may be fitted with is determined by its capacity points (from its Size Class) and by the type of mounts (ie: fixed or turreted) that are chosen for the weapons.

Continuing on p. 32 (no repeated heading):

Rule: When equipping a vehicle with weapons, select the LARGEST weapon to be fitted first; if it is to be in a FIXED MOUNT (ie: like a Tank Destroyer or Assault Gun), the amount of capacity that the weapon takes up is equal to TWICE the weapon's SIZE CLASS; if it is to be in a TURRET, capable of all-round traverse, it takes up THREE TIMES its SIZE CLASS.

Worked example (verbatim): *"a class 3 weapon (of whatever type) fills 6 points of Capacity if in a Fixed Mount, or 9 points if in a Turret."*

Design note (bracketed, printed in the rules text): *"[This capacity includes the gun mechanism, crew space, ammunition storage etc; turreted guns take more capacity due to the internal space required in the hull for the turret mechanism and so on.]"*

Rule (multiple-mount weapons): When further weapons are added to a vehicle that already has a turreted main weapon (including adding extra barrels of the same weapon type to make a multiple mount), all the additional weapons only occupy TWICE their class in terms of capacity — the extra bulk of the turret has already been accounted for in the primary weapon.

Worked example (verbatim): *"to put (say) a TWIN-MOUNT class 3 gun system in a turret would use up 9 capacity points for the first barrel, but only 6 for the additional one — a total of 15 points capacity for the twin-mount."*

Rule: Infantry Support Weapons, when mounted on vehicles, take up ONE capacity point regardless of the type of mounting.

Rule (free SAW): Most military vehicle types are assumed to have one SAW type weapon, such as a basic pintle-mounted machine gun, fitted for anti-personnel defence; this is a "free" weapon and takes no capacity points, but additional weapons of this type use one capacity point each. The basic free SAW is always assumed to be an EXTERNAL mount weapon with manual control, and thus cannot be fired while the vehicle is suppressed; a remote-control SAW operable from inside the vehicle must be paid for in capacity.

Rule (crews): Vehicle CREWS — the personnel actually required to operate the vehicle and its weapons/systems — do NOT cost capacity points; space for them is assumed to be part of the vehicle's basic construction. If constructing a troop-carrying vehicle, however, the space for carried infantry must be paid for in capacity points as this is the "payload" of the vehicle. The rates for infantry transport are 1 point per ordinary trooper carried, or two points per Power Armour trooper.

**Examples (verbatim):**

1) *A MEDIUM (class 3) vehicle has 15 capacity points. If we were building a "Tank Destroyer" with a large fixed gun, we could fit a single class-4 weapon in a Fixed Mount at a capacity cost of 8; this leaves us with 7 points over. Deciding that a fully-traversable secondary weapon would be a good idea, we mount a class-2 gun (maybe an RFAC-2) in a turret, at a cost of 6 capacity points — as we did not fit a turret for the main weapon, the extra capacity MUST be allowed for on the secondary weapon. There is ONE point left over, which we could use for a support weapon in the turret.*

2) *A SMALL (class 2) vehicle has 10 capacity points. If we wish to build a light APC to carry a small squad of 6 troops, this will cost 6 points for the infantry capacity, leaving 4 points for weapons; we decide to fit a GAC/1 in a remote turret, costing 3 points, and a co-axial machine gun (counting as an infantry support weapon) for the last point.*

## ARCS OF FIRE (p. 32)

Rule (turrets): Weapons that are mounted in TURRETS have an all-round (360 degree) Arc of Fire, unless some specific feature of the particular vehicle design makes this impossible (for example, some multi-turreted designs available in model form have obvious limitations to the traverse of some or all turrets) — in such cases a 180 degree Arc is suggested for restricted-traverse turrets, 90 degrees each side of the turret's normal facing.

Rule (fixed mounts): FIXED MOUNTS have much more limited Fire Arcs; a vehicle-mounted weapon in a Fixed Mount may only fire through a 30 degree Arc, ie: 15 degrees either side of the vehicle centre-line. Targets outside this arc may not be engaged without physically turning the vehicle, which counts as a MOVE action.

Rule (guided missiles in fixed mounts): Guided missile launchers in fixed mounts are not subject to the same arc restrictions, as the missiles are steerable after firing; they are, however, unable to engage targets outside the 180 degree forward arc of the launcher's facing.

Design note (bracketed, printed in the rules text): *"[Some designs use vertical missile launch bins, which have an all-round 360 degree field of fire; the type fitted should be obvious from the model used.]"*

## FIRE CONTROL SYSTEMS (p. 32)

Rule: The basic firing system, centred around infantry small-arms fire, assumes that most weapons are "manually" aimed and fired (often with some electronic support such as head-up targeting in visor displays, or gyromount harnesses for support weapons, but these are factored in to the system anyway). For support and heavy weapons on vehicle or carriage mounts, sophisticated electronic fire-direction systems are accounted for separately: Vehicle or Groundmount heavy weapons may be equipped with FIRE CONTROL systems in three levels of sophistication: BASIC, ENHANCED or SUPERIOR.

Rule: Each heavy weapon system should have its FIRE CONTROL type specified; if there is no Fire Control type given then the weapon is assumed to be manually operated.

Rule: The Fire Control type determines the die type used (along with the operator's Quality die) when rolling for hits, as follows:

| Fire Control level | Die type |
|---|---|
| BASIC Fire Control | D6 |
| ENHANCED Fire Control | D8 |
| SUPERIOR Fire Control | D10 |
| (MANUALLY operated) | D4 |

Rule/clarification: The Fire Control Die does not REPLACE the Quality die in the firer's roll, but supplements it — the Quality die remains a representation of the level of experience and alertness in the vehicle or weapon crew, affecting their ability to locate and identify targets and engage them (even with all the electronic help in the world, an incompetent crew will still be incompetent).

## ECM (p. 32)

Rule: Electronic Counter Measures (ECM), in this context, refers to the specific countermeasures suites installed on vehicles as a defence against guided weapons fire. The ECM package consists of various jamming and disruption devices designed to confuse or deflect the guidance systems of missiles and similar guided weapons.

Rule: Like other vehicle systems, ECM suites come in three levels of effectiveness — BASIC (ECM die D6), ENHANCED (D8) or SUPERIOR (D10).

Rule: Whenever an ECM roll is required to defend the vehicle against a missile attack, roll the relevant die for the level of ECM carried. If a vehicle has no specified ECM suite, then use a D4 as the default die.

Clarification (cross-reference): A vehicle's defensive ECM suite should not be confused with the much more sophisticated and versatile EW (Electronic Warfare) systems carried by dedicated EW elements, which have many other offensive and defensive capabilities (see chapter 19).

## CAPACITY FOR WEAPONS AND SYSTEMS (p. 32)

Table (as printed):

| System | Capacity cost |
|---|---|
| All DIRECT-FIRE WEAPONS | Class x 2 if in FIXED MOUNT (or secondary to a turret-mount Primary weapon); Class x 3 if PRIMARY TURRET-MOUNT WEAPON. |
| GUIDED MISSILE SYSTEMS | GMS/L = 2, GMS/H = 4. |
| SAW type ANTI-PERSONNEL WEAPON | 1 (first "free" SAW = 0). |
| INFANTRY SUPPORT WEAPONS on vehicle mountings | 1 |
| INFANTRY TRANSPORT | Normal infantry = 1 per man; Powered Armour = 2 per man. |
| COMMAND/COMMUNICATIONS SYSTEMS | 8 (essential for any Command Vehicle, eg: for a Company Command unit). |

Rule: Fire control, ECM and guidance systems should be specified during vehicle design, but do not take up any capacity points. Decoy launchers, smoke dischargers and similar small external fittings similarly do not occupy capacity points.

## Quick-reference disagreements / additions

- The quick reference (qr-p1, ARMOUR table) states only "Vehicle Armour: D12 x Armour Class." The full rulebook (p. 31) adds substantial mechanics the QR omits entirely: (a) Armour Value is capped at the vehicle's own Size Class (a size-4 vehicle cannot exceed Armour Value 4); (b) the rated Armour Value is the FRONT value only — sides, top and rear are 1 LESS than frontal armour, except Armour-1 vehicles which are 1 all round; (c) "softskinned" vehicles (trucks, jeeps, civilian vehicles, DSII armour 0) use a flat D6 Armour Die regardless of which face is hit; (d) OPEN-TOPPED vehicles count as softskinned (D6) against INDIRECT FIRE specifically, regardless of their actual armour rating. A programmer implementing "roll the Armour Die" purely from the QR's single line would get facing, size-class capping, and the open-topped/indirect-fire exception all wrong.
- The QR's FIRING HEAVY WEAPONS line ("FIRER'S DICE: Quality die, Fire Control die") and FIRING GUIDED MISSILES line ("TARGET'S DIE: ECM Systems Die") name these dice but never say what die type they actually are. This chapter supplies the missing values: Fire Control die = D6 (Basic) / D8 (Enhanced) / D10 (Superior), or D4 if the weapon has no Fire Control type specified (manual); ECM die = D6 (Basic) / D8 (Enhanced) / D10 (Superior), or D4 default if no ECM suite is specified. Without this chunk, those two QR dice references are unresolvable.
- The QR's ELECTRONIC WARFARE box gives "EW systems D6, D8 or D10" for spotting/jamming/spoofing by dedicated EW elements. This chapter explicitly warns that a vehicle's defensive ECM suite (also D6/D8/D10) is a *different, less versatile* system from EW proper and must not be confused with it (cross-referencing chapter 19 for EW) — a distinction the QR does not draw, even though the die-type coincidence invites conflating the two.
- The QR contains no equivalent at all for: vehicle Size Classes (1–5) and their capacity formula (Size Class x 5); weapon Size Classes and fit limitations (capacity cost = weapon class x2 fixed / x3 turret, x2 for secondary barrels on an existing turret mount); the free/paid SAW rule; the capacity-point costs for guided missiles (GMS/L=2, GMS/H=4), infantry support weapons on vehicles (1), infantry/Power-Armour transport (1/2 per man), and Command/Communications systems (8); or the Arcs of Fire rules (360° turret unless restricted to 180°, 30° fixed mount, 180° forward arc for fixed-mount guided missiles). All of this is new material a programmer would need beyond the summary.

## Unreadable content

None. All body text, headings, the bracketed design notes, both worked-example paragraphs, and the CAPACITY FOR WEAPONS AND SYSTEMS table were legible in the page scans and in 2x zoom crops made to verify small print (e.g. "GAC/1", "RFAC-2", "GMS/L = 2, GMS/H = 4", "RFAC", "HKP"). Nothing was marked [illegible].

<details><summary>Checker's corrections</summary>

- VEHICLE SIZE CLASSES (p. 31), "Exception/note" worked example — was: quoted only "You do not have to use up ALL the capacity points allowed by the vehicle's size, especially if doing so would produce a ludicrous situation." followed by a separately-labelled "Worked example (as printed)" starting directly at "a motorbike and sidecar is a size 1 vehicle...", silently dropping the connecting sentence "This is especially true with the smaller size classes -" and the printed trailing ellipsis "......" — now: the whole paragraph, including that connecting sentence and the trailing ellipsis, is quoted verbatim as a single worked example, per the instruction that worked examples must be transcribed in full.

Every other number, die type, die-shift/multiplier, threshold, range, count, and table cell in the chunk (Size Class values and the x5 capacity formula; Armour Value range 1–5, the D12 multiplier and 3–36 example, the size-class cap, the front/sides-top-rear −1 rule and its "Armour 5 / 4" example, softskinned D6, open-topped-vs-indirect D6; the RFAC 1–2 / HKP 3–5 size examples; the Fixed-Mount x2 / Turret x3 / additional-barrel x2 capacity formulas and both worked capacity examples verbatim, including the two full numbered "Tank Destroyer" and "light APC" examples with all their arithmetic; the free-SAW rule; the 1-per-man / 2-per-man transport rates; the 360°/180°/90°, 30°/15°, and 180°-forward-arc figures in ARCS OF FIRE; the Fire Control die table D6/D8/D10/D4; the ECM die levels D6/D8/D10 and D4 default; and every row of the CAPACITY FOR WEAPONS AND SYSTEMS table, including GMS/L=2, GMS/H=4 and the Command/Communications cost of 8) was checked word-for-word and digit-for-digit against sg-p32.png (printed p. 31) and sg-p33.png (printed p. 32), including targeted 2x zoom crops of the WEAPON SIZE CLASSES paragraph, the CAPACITY FOR WEAPONS AND SYSTEMS table, and both numbered capacity examples, and all match the source exactly. No rule present on either page was found missing from the chunk, and nothing in the chunk was found to be invented, misattributed to the wrong page, or presented as a rule that is not actually on the page. The bracketed design notes and the "Quick-reference disagreements / additions" section (clearly labelled as the digest-author's own cross-check against the QR, not source rules text) were also confirmed accurate and left unchanged.

</details>

---

# Chunk 12 · pp. 33–36 · 14 Fire combat (part 1)

Source images: sg-p34.png (printed p.33), sg-p35.png (printed p.34), sg-p36.png (printed p.35), sg-p37.png (printed p.36).

---

## GENERAL FIRE PROCEDURE: (p.33)

When any FIRE action is made — whether firing the collective small arms of an infantry squad, firing a missile or a single shot from a heavy weapon — the basic procedure for determining the effectiveness of the shot is the same:

The FIRER and the TARGET players make a MULTIPLE OPPOSED ROLL - the firer will roll at least TWO dice, sometimes more, while the target rolls just ONE die in all cases. What these dice represent and how the die types are determined varies according to the kind of shot being resolved, but the results are always read in the same way:

If the FIRER fails to beat the TARGET'S die roll with ANY of his dice scores, then the fire attempt FAILS - a single shot misses, and small-arms fire is too inaccurate to cause any effect. If just ONE of the firer's scores EXCEEDS the target's roll, then the shot is deemed to be a MINOR SUCCESS - a single shot hits (but probably not at the optimum angle or a vulnerable spot), and small-arms fire is accurate enough to frighten the target troops and SUPPRESS them even though it does not actually hit anyone.

If TWO (or more) of the firer's scores EXCEED the target's score, then a MAJOR SUCCESS occurs - single shots hit cleanly and squarely on a target's weak spot, and small-arms fire is effective enough that some enemy troops are actually hit.

This roll is followed by various different procedures for determining the final results of the hits depending on the type of shot and type of target, but the above general rule holds true for all direct (line-of-sight) fire in the game.

IMPORTANT NOTE: as a general rule, NO WEAPON MAY BE FIRED MORE THAN ONCE PER TURN; a unit may perform two fire actions in one activation, but they cannot both be with the same weapon(s).

> **Boxed rule (p.33):**
> MULTIPLE OPPOSED ROLL used for all DIRECT FIRE RESOLUTION:
> FIRER rolls TWO or more dice, TARGET rolls ONE die.
> Firer rolls less than or equal to target score with ALL his dice = FAILED.
> Firer exceeds target score with ONE die only = MINOR SUCCESS.
> Firer exceeds target score with TWO dice or more = MAJOR SUCCESS.

The dice used by FIRER and TARGET for each type of weapon is as follows:

**FIRING SMALL ARMS:**
FIRER'S DICE: Quality die, Small Arms Firepower die, plus any relevant Support Firepower dice.
TARGET'S DIE: Range Die

**FIRING SUPPORT WEAPONS:**
FIRER'S DICE: Quality die, Support Firepower die.
TARGET'S DIE: Range Die

**FIRING HEAVY WEAPONS:**
FIRER'S DICE: Quality die, Fire Control die.
TARGET'S DIE: Range Die

**FIRING GUIDED MISSILES:**
FIRER'S DICE: Quality die, Missile Guidance die.
TARGET'S DIE: ECM Systems Die

## TARGET SIZE: (p.33)

Everything in SGII, from infantry squads to vehicles and buildings, has a SIZE CLASS which indicates how easy or difficult a target it presents to someone trying to shoot at it. The SIZE CLASSES range from 1 (smallest, and thus hardest to hit) up to 5 (largest and easiest target).

ALL INFANTRY UNITS are considered SIZE 1 (Very Small) targets, regardless of how many men are in the unit. Infantry targets are also referred to as DISPERSED TARGETS, and any dispersed target is automatically a size 1 target.

VEHICLES and constructions are classed as POINT TARGETS, and their size class depends on what they are; very small point targets are size 1, right up to the largest at size 5. Details on typical vehicle sizes are listed in the vehicle design section (see P.31).

## SMALL ARMS RANGES: (p.33)

For all fire from SMALL ARMS and INFANTRY SUPPORT WEAPONS, the basic range bands are equivalent to the QUALITY DIE TYPE of the squad firing: thus to an UNTRAINED squad, one RANGE BAND is **4"**, to a GREEN it is **6"**, REGULAR **8"**, VETERAN **10"** and ELITE **12"**.

For every full multiple of the RANGE BAND, the RANGE DIE is shifted UP one type; further shifts may also be applied for the circumstances of the target - whether it is in any cover, or "in position" - as fully explained in the Cover rules (P.12/13).

Small arms fire is effective up to the point where the RANGE DIE would be GREATER than a D12 - when this limit is reached then effective small arms fire is impossible.

*(Illustration of two infantry figures, one holding binoculars/a targeting device, one a missile weapon — no rules content.)*

## RANGE BANDS: (p.33)

The RANGE BAND for any given weapon or firer is the distance after which the RANGE DIE (which is the die rolled by the TARGET player in the fire resolution) is shifted UP ONE DIE TYPE.

For every full multiple of the RANGE BAND between the firer and the target, increase the Range Die by one die type - shots at up to one Range Band start with a D4 as the Range Die, at up to TWO range bands the range die rises to a D6, at up to 3 range bands it goes up to a D8 and so on.

> **Boxed rule (p.33):** Shift RANGE DIE up one type for every multiple of RANGE BAND.

### Range band → Range Die progression, and quality → range band (p.33)

| Squad Quality | Base Range Band |
|---|---|
| UNTRAINED | 4" |
| GREEN | 6" |
| REGULAR | 8" |
| VETERAN | 10" |
| ELITE | 12" |

| Multiples of Range Band elapsed | Range Die |
|---|---|
| up to 1 | D4 |
| up to 2 | D6 |
| up to 3 | D8 |
| up to 4 | D10 |
| up to 5 | D12 |
| over 5 | shot impossible (die type would exceed D12) |

### Continuation on p.34 — open/soft/hard cover range limits

Against a target in the open, the range die starts at D4 for up to one range band, rises to D6 in the second range band, and so on - reaching a D12 when the range is up to FIVE range bands. Thus at OVER five multiples of the range band, the shot is impossible as the range die type would be more than D12; if the target was in soft cover any shot over 4 range bands would be impossible, as would any over 3 range bands if the target was in hard cover.

*Worked example (p.34):* "a REGULAR unit has a basic range band of 8"; its maximum effective range against targets in the open is five times this, or 40". Against targets in soft cover the maximum effective range is 32" (four times the RB), and against targets in hard cover 24"."

Note that certain weapon systems may be defined as being CLOSE-RANGE weapons (such as Shotguns and Machine Pistols); these are ONLY effective up to ONE multiple of its range band. (Actual Range Die used is still subject to shifts for cover etc.)

> **Boxed rule (p.34):** Small arms and support weapons RANGE BANDS = Quality of user. CLOSE RANGE weapons only effective to 1 RANGE BAND.

## FIREPOWER: (p.34)

The Firepower of a weapon is a measure of its ability to put down an effective amount of fire on a target; as such, the rating actually represents both the rate-of-fire of the weapon and, to some extent, its inherent accuracy.

The Firepower (FP) of a SMALL-ARMS type weapon is normally 1, 2 or 3. In general terms, FP 1 means single-shot or semiauto weapons, such as civilian hunting rifles, pistols and obsolete military arms, FP 2 covers automatic burst-fire weapons (most standard military combat rifles) while FP 3 represents which either output very large volumes of fire (eg: machine-pistols) or have an area effect such as shotguns. *(Printed exactly as shown — "represents which either output" appears to be a typo in the original for something like "represents weapons which either output".)*

Adding an explosive-round launcher (eg: an over/under grenade launcher, whether retrofitted or designed into the weapon) adds an additional 1 to the Firepower of the weapon.

It is also possible to have an FP of 0.5, which would represent a weapon with a VERY low rate of fire - archaic firearms, muskets, crossbows and the like; while such weapons are unlikely to crop up in many games, they could be found in the hands of very poor colonial forces or even low-tech aliens, "lost colonies" etc. - the possibilities are there, so use them if you wish!

The SMALL ARMS FIREPOWER DIE is the die type used to represent a squad's combined SMALL ARMS fire in the combat resolution. It is a measure of the amount of fire laid down by the troopers in the squad that are using small arms, and is calculated by multiplying the FIREPOWER of the weapon type issued to the squad by the actual number of troopers firing that weapon type. The result is expressed the nearest Die Type (rounded up) to the total Fire Value of the squad *(printed exactly as shown; appears to omit the word "as" before "the nearest")* - so seven men with FP1 weapons would have a total FP of 7, so using a D8, while five men with FP2 weapons would total 10 and use a D10. If the total FP is 4 or less then a D4 is used, and anything over 12 still gets a D12 (there is no bonus for extra fire value points above 12).

Note that this FIREPOWER DIE is worked out only for the troops who are actually firing their small arms in this fire resolution - if part of the squad are carrying out a different action then they will NOT be counted!

> **Boxed rule (p.34):**
> Squad FIREPOWER = Small Arms Firepower x Men firing.
> Support Weapons ADD extra dice to firer's roll.

INFANTRY SUPPORT WEAPONS, as opposed to Small Arms, have their FIREPOWER given as a DIE TYPE rather than a fixed numerical value; this is because each such weapon adds an extra die (of its Firepower type) to the combat resolution roll. Note that these weapons have different Firepower die types against DISPERSED (infantry) or POINT targets, to reflect their different effectiveness in the two cases - obviously, you use the die type relevant to what you are firing at.

### Fire-value → Firepower Die table (small arms), as worked in the text (p.34)

| Total small-arms Fire Value of squad | Firepower Die |
|---|---|
| 4 or less | D4 |
| 7 (example: 7 men × FP1) | D8 |
| 10 (example: 5 men × FP2) | D10 |
| over 12 | D12 (no bonus above 12) |

## IMPACT VALUE: (p.34)

The Impact Value of a weapon system is the penetration/lethality effect of being hit by the weapon's rounds. [OK, we know that penetration and lethality are actually two very different characteristics, but at this level of game it is more practical to combine them into one factor]. The IV is represented by a DIE TYPE, and gives the die to be rolled when determining casualty effects from effective fire.

Impact Values range from D4 for relatively low-lethality weapons such as small handguns up to D12 for rounds with a high kill potential; true "heavy weapons" mounted on vehicles or groundmounts usually have IVs represented by MULTIPLIERS on a D12 roll, eg: D12x3, which indicates the result of a D12 roll multiplied by three (NOT three D12 rolls added together).

## GENERIC WEAPONS TABLE: (p.34)

A very large number of different weapons systems may be classified for use in STARGRUNT II to suit whatever background you wish to use. Listed below are some suggested "generic" weapon types, those specific to the individual nations/forces of our own optional background being listed in chapter 24.

### Small Arms

| Weapon Type | Range limitations | FIREPOWER | IMPACT |
|---|---|---|---|
| Improvised Firearm (archaic designs, airguns etc.) | Close only | 0.5 | D4 |
| Light Autopistol | Close only | 1 | D6 |
| Heavy Autopistol | Close only | 1 | D10 |
| Machine Pistol/SMG | Close only | 3 | D8 |
| Assault Shotgun | Close only | 3 | D8 |
| Hunting Rifle | | 1 | D10 |
| Low-Tech Assault Rifle | | 2 | D8 |
| Low-Tech Assault Rifle (with GL) | | 3 | D8 |
| Advanced Assault Rifle | | 2 | D10 |
| Advanced Assault Rifle (with GL) | | 3 | D10 |
| Gauss Rifle | | 2 | D12 |
| Gauss Rifle (with GL) | | 3 | D12 |

(Blank cells in the "Range limitations" column are blank in the original — no range-limitation text is printed for those rows.)

### Support Weapons

| Weapon Type | Support Firepower | IMPACT |
|---|---|---|
| Conventional Machine Gun (SAW) | D8 | D10 |
| Rotary (Gatling type) Machine Gun (SAW) | D10 | D10 |
| Gauss Machine Gun (SAW) | D10 | D12 |
| Infantry Plasma Gun | D6 | D12* |
| Automatic Grenade Launcher | D12 | D8* |
| Multiple Launcher Pack (MLP) | D8 | D8* |
| Infantry Rocket (IAVR) | D10 | D12* |

\* Impact value against Dispersed targets or for MINOR hits on point targets - DOUBLE this for MAJOR hits on point targets.

Note that the GMS/P Missile system, though technically an Infantry Support Weapon, CANNOT be fired as part of a small-arms fire resolution - it must be fired using a separate action.

*(Illustration on p.34: two figures, one an old man in coat with pistol, one soldier with rifle — no rules content.)*

---

## FIRE RESOLUTION: (p.35)

The first step of fire combat resolution is an OPPOSED ROLL between the player controlling the squad that is firing (termed "the firer" from here on) and the owner of the troops being fired at ("the target"). The "Target" player will roll TWO dice, while the "Firer" will roll two dice PLUS one or more extra dice if his squad has support or special weapons in it which he wishes to fire at the same time.

*(Note: this sentence describes the target rolling "TWO dice," but see "THE TARGET'S ROLL" immediately below, which states the target rolls only ONE die, the Range Die — printed exactly as shown; the two statements as printed differ.)*

### THE TARGET'S ROLL: (p.35)

The Target player rolls one die, known as the RANGE DIE.

Measure the range from firer to target; if it is UP TO ONE multiple of the firer's RANGE BAND, then the RANGE DIE is a D4; at over one Range Band but less than two, the die rises to a D6, and so one with a one die type increase per multiple of the range band. *(printed "so one" — verbatim.)*

If the target group is IN THE OPEN, the target player gets to roll the Range Die as calculated above. If the group is in any kind of cover, then the die gets shifted up further: if they are in SOFT COVER, shift up ONE further die type; if in HARD COVER, shift up TWO dice types. Being "in position" gets the target one extra die shift upward. If the die type is shifted OVER a D12 then the fire is automatically ineffective.

The score rolled on the final RANGE DIE type is termed the TARGET ROLL.

### THE FIRER'S ROLLS: (p.35)

The Firer will roll a MINIMUM of two dice, and possibly more (see SUPPORT FIREPOWER below); the two compulsory dice are a QUALITY DIE and a FIREPOWER DIE (or FIRECONTROL DIE for Heavy Weapons).

The QUALITY DIE is the squad's basic die type, as explained for the Target above; it represents the fact that better troops (while not necessarily being better individual shots) will perform more "controlled" fire that actually has an effect rather than just emptying magazines at random.

The FIREPOWER DIE will be the SMALL ARMS FIREPOWER die for the squad if you are resolving small-arms fire; if you are firing a single support weapon or heavy weapon then you will use the relevant firepower die or firecontrol die for that weapon type instead. If you are adding support weapons to small-arms fire (as explained below) then you get to roll ALL the relevant Firepower dice.

*(Illustration on p.35: an armoured wheeled/tracked vehicle with turret weapon — no rules content.)*

## ADDING SUPPORT FIREPOWER: (p.35)

If one or more troopers in a squad are carrying Infantry Support weapons such as Squad Automatic Weapons, Plasma Guns, Rocket launchers or similar then each of these weapons MAY (if desired by the player) be "added in" to the general firing of the squad at an infantry target. If they do so, then they may NOT be fired separately against a different target in the same turn - in other words, if you decide to fire your Plasma Gun in support of the small arms then you can't also fire it against a vehicle target in the same activation.

For each weapon system that the player wishes to add in to support the general small arms firepower, there is an EXTRA DIE added to the firer's rolls.

These extra dice are referred to as SUPPORT FIREPOWER DICE, and when rolled they are counted in just the same way as the two normal dice (Quality and Small Arms Firepower) rolled by the firer.

*Example (p.35): the firer decides to use the Plasma Gun that one of his squad members is carrying to add to the firepower of the squad's small arms; the Plasma Gun's Support Firepower is a D6. When the firer rolls his dice for the small-arms fire, he may roll the extra D6 for the Plasma Gun as well as the usual QUALITY and SMALL ARMS FIREPOWER dice for the squad.*

IMPORTANT NOTE: when you use support weapons to add to the firepower of a squad's small-arms fire, ALL potential hits scored are resolved using the Impact Value of the SMALL ARMS TYPE ONLY - the support weapons fired simply add to the weight of firepower, NOT to the impact results.

## FIRE AGAINST DISPERSED TARGETS: (p.35)

### STEP 1: RESULT OF OPPOSED FIRE-EFFECT ROLL:

If ALL of the firer's die rolls (taken as individual numbers, NOT added together) are EQUAL OR LESS than the target's roll, then the target squad suffers no adverse effects - the fire was too wild and random to concern them.

If ONLY ONE of the firer's rolls EXCEEDS the target's roll, then the fire was good enough for the target squad to be SUPPRESSED by it, though it still causes no casualties. The target gets a SUPPRESSION marker, and the fire resolution ends.

If TWO OR MORE of the firer's rolls EXCEED the target's roll, then the fire is deemed FULLY EFFECTIVE and it may actually cause casualties to the target squad - in this case ADD UP THE SCORES ON **ALL** THE DICE ROLLED BY THE FIRER (including any that scored less than the target's rolls) and proceed to the next step below:

### STEP 2: DETERMINING POTENTIAL HITS:

If you get a "Fully Effective Fire" result in the previous step, then the fire has been accurate and concentrated enough to (potentially at least) cause some casualties to the target unit.

As noted above, total up the scores on ALL the firer's dice. The number of POTENTIAL HITS scored on the target unit is the firer's total dice score divided by the RANGE DIE TYPE that the target used in step 1: thus if the target had rolled a **D6** as his Range Die then the total fire points will be divided by **6** to give the number of POTENTIAL HITS.

The effectiveness of the fire is thus dependent on the range to the target and its cover status (if any), so that as the range increases the firer will score progressively fewer potential hits.

If the total fire score is not an exact multiple of the Range Die type, then the points "left over" represent a CHANCE to inflict another hit: in this case, the TARGET player should roll the Range Die type once: if this roll EXCEEDS the left-over fire points, then NO extra hit is scored - if it is equal or less, then the firer gets to claim an additional hit. [This also applies if the total of fire points is less than that required for at least one automatic hit - a single roll with the range die type will give one hit unless the target player can roll over the total fire points.]

*Example (p.35): the firer rolls 3 dice (for a squad with small arms and a SAW) and scores a total of (say) 18. The target squad is over one range band distant (but not as far as two), and is in soft cover - the target player would therefore have rolled a D8 (D4, shifted up one die type for the range plus one for soft cover) during the opposed roll for fire effect, and obviously didn't score enough to prevent the firer getting an effective fire result; whatever the target player rolled, it is his DIE TYPE - the D8 - which is important to this step. With the firer's total of 18, the DV of 8 divides into the 18 twice, with 2 left over. The firer thus gets two hits, plus a possible third - to avoid this extra hit the target player has to roll better than 2 on a D8 roll, if he fails in this then the third hit is inflicted.*

Once you have determined the total number of potential hits inflicted on the target squad, you need to see out which of these translate into ACTUAL HITS, as below: *(printed "see out" — verbatim; likely intends "see" or "sort out".)*

---

## STEP 3: PENETRATION AND EFFECT: (p.36)

For each POTENTIAL HIT, the firer and target make an opposed roll of just a single die each - the firer rolls the die type for the IMPACT VALUE of the weapons used, and the target rolls the die type for the ARMOUR his squad is wearing (as listed on the armour table below). If the firer's roll is LESS THAN OR EQUAL TO the target's roll, the shot has been stopped by the armour and there is no effect; if it is GREATER THAN the target's roll, then a WOUND is scored; if it is GREATER THAN TWICE the target's roll, then a KILL is scored.

Once the number of WOUNDS and KILLS inflicted on the squad is determined, these effects are randomly distributed among the target squad members as described in "Who buys the farm?" below.

*Example (p.36): Three potential hits have been inflicted on a squad, by enemy troops using Advanced Assault Rifles (Impact value D10); the squad under fire consists of troopers in Partial Light Armour, with an Armour Value of D6. For each potential hit, the players make a single opposed roll - the firer with a D10 and the target with a D6. For the first hit, the firer scores 3 and the target 5 - the shot is stopped by the target's armour, and he suffers no injury. Rolling a second time, the firer gets 6 and the target another 5 - this shot is a WOUND, as the firer has won the roll but not scored more than twice the target's roll. Finally, on the third roll the firer gets a 9 and the target a 4 - this is enough for a KILL result. The target squad ends up with one man dead, another down with a wound and a third examining the big dent in his combat helmet, trying to stop his ears ringing and wishing he had a change of underwear....*

*(Armour table referenced as "below" is not present on these four pages — it appears elsewhere in the book (see the ARMOUR table already given on Quick-Reference p.1: Basic Battledress D4, Partial Light Armour D6, Full-Suit Light Armour D8, Combat Power Suit ("Light" Power Armour) D10, Heavy Power Armour D12, Vehicle Armour D12 x Armour Class); not transcribed here as it is not printed on pages 33–36.)*

## STEP 4: ALLOCATING HITS, or "WHO BUYS THE FARM...?" (p.36)

When a squad takes one or more casualties, it is usually necessary to determine which actual figures take the hits; this wouldn't matter much if all the squad members were the same, but in most units you will have at least a Leader figure and most likely one or more weapon specialists as well as the ordinary riflemen, so you need to know exactly who "gets it".

To determine this, simply roll the nearest die type to the actual number of figures in the squad (ie: for four figures or less use a D4, for 5-6 figures a D6, 7-8 a D8 and so on); now start at one nominated figure and count along the group until you get to the number you just rolled, which shows you who takes that hit. If you set a convention of always counting around/along a group in the same way (eg: left-right along a line, front-back along a column, clockwise around a "bunched" group), then there should be no disputes arising when using this method. (Of course, if you have five figures and roll 6 on your D6, go back to the first figure you counted and apply the hit to him; for this reason it makes sense that you should start counting at the figure who is either most exposed or otherwise most likely to get hit - eg: the one in the centre of the fire zone.)

It is perfectly acceptable for one figure to take two (or more) hits using this method; if any figure takes two or more WOUND hits in one fire resolution he is considered DEAD.

NOTE: if desired, steps 3 and 4 above may be performed in reverse order - you may roll to see who takes each of the potential hits BEFORE you see which of them have caused wound or kill results; though this means you will sometimes be rolling unnecessarily to distribute some hits that have no effect, it does allow you to use squads with mixed personal armour types.

*(Photo illustration, p.36: an 8-man Pan African Union Squad on tabletop terrain, figures numbered 1–8, with a D8 die showing a 5. Caption: "Allocating hits: An eight man Pan African Union Squad has taken fire - the D8 score of 5 indicates the fifth man along gets hit.")*

> **Boxed rule — SUMMARY OF INFANTRY FIRE PROCEDURE: (p.36)**
>
> STEP 1: TARGET rolls RANGE DIE. FIRER rolls 2 or more dice: Quality die, Small Arms Firepower die, plus any Support Firepower dice. If NONE of firer's dice exceed target's score, NO EFFECT. If ONE of firer's dice exceeds target's score, SUPPRESSION ONLY. If TWO of firer's dice exceed target's roll, fire is FULLY EFFECTIVE (Suppression + potential casualties).
>
> STEP 2: Divide firer's TOTAL DICE SCORE from step 1 by target's RANGE DIE TYPE: result, rounded down to whole number, is number of POTENTIAL HITS scored. 1 extra roll (using range die type) may give 1 extra hit from left-over score.
>
> STEP 3: For every Potential Hit from step 2, make opposed roll: firer rolls IMPACT DIE for weapon type, target rolls ARMOUR DIE. No modifiers used. If Firer's roll LESS THAN or EQUAL TO target's, NO EFFECT; if firer's EXCEEDS target's, WOUND scored; if firer's MORE THAN TWICE target's, KILL scored.
>
> STEP 4: Allocate any WOUNDS or KILLS from step 3 at random among members of target squad.

## THE QUICK-AND-DIRTY OPTION: (p.36)

The full small-arms fire procedure detailed above is the one we would recommend for most games of SGII, but there may be some cases - with exceptionally large forces, or if playing time is short - where players may prefer a simplified option. For such times, our suggestion is this:

Follow the normal fire procedure up to and including totalling the scores of all the Firer's dice; now, instead of dividing this total by the target's DV (his Range Die type), you divide it by the target's ARMOUR DIE type - thus if the targets are in D6 armour, divide the total fire score [continues onto next page, not included in these four pages]

---

## Designer's notes / flavour (summarised)

- The narrative asides throughout this section (e.g., the bracketed authorial aside on Impact Value combining "penetration" and "lethality" into one factor for playability, and the closing sentence of the Step 3 worked example describing a soldier's ringing ears and need for a change of underwear) are informal, humorous framing rather than rules content, and have been summarised/noted rather than repeated verbatim above except where they are part of the worked example itself.
- The chapter opens with a large "14 FIRE COMBAT" chapter banner and a small vehicle icon graphic, both purely decorative page furniture, repeated identically on all four pages.

## Illegible / uncertain content

Nothing on these four pages was found illegible; all numbers, die types, and table values were legible at full resolution. Two apparent printing anomalies were transcribed verbatim per instructions rather than corrected (see inline notes above):
1. p.34, FIREPOWER section: "FP 3 represents which either output very large volumes of fire" — likely missing the word "weapons" after "represents."
2. p.34, FIREPOWER DIE paragraph: "The result is expressed the nearest Die Type" — likely missing the word "as."
3. p.35, opening of FIRE RESOLUTION: states the Target player "will roll TWO dice," which conflicts with the very next subsection ("THE TARGET'S ROLL"), stating the target rolls only ONE die (the Range Die). Both are transcribed as printed.
4. p.35, end of STEP 2: "you need to see out which of these translate into ACTUAL HITS" — likely a typo for "see" or "sort out."

<details><summary>Checker's corrections</summary>

Checked line by line and cell by cell against the source page images (sg-p34.png = printed p.33, sg-p35.png = printed p.34, sg-p36.png = printed p.35, sg-p37.png = printed p.36), including targeted 2x pixel-level zoom crops on: the bolded range-band distances in SMALL ARMS RANGES ("4"/6"/8"/10"/12""), the "IMPORTANT NOTE:" lead-in weight, and the "so one with a one die type increase" line, plus full-resolution reads of every paragraph, box, table and worked example on all four pages, cross-referenced against the vocabulary and step summary already verified on qr-p1.checked.md and qr-p2.checked.md.

Result: no content errors found. Every number, die type, die shift, range band, threshold, table cell, and worked-example figure in the file matches the source exactly, and no rule on these four pages is missing from the digest. Specifically re-verified and confirmed correct (no change made):

- The four FIRER'S DICE / TARGET'S DIE weapon-type blocks on p.33 (Small Arms, Support Weapons, Heavy Weapons, Guided Missiles), including the "Fire Control die" (two words, p.33) vs. "firecontrol die" (one word, lower case, p.35) spelling difference between the two pages, both reproduced exactly as printed in each location.
- All boxed rules on p.33 and p.34 (MULTIPLE OPPOSED ROLL box, Shift RANGE DIE box, RANGE BANDS box, Squad FIREPOWER box), word for word.
- The Range Band distances (4", 6", 8", 10", 12" for UNTRAINED/GREEN/REGULAR/VETERAN/ELITE) and their bold formatting in the original, and the Range Die progression (D4 through D12 over 5 multiples of the range band, impossible beyond).
- The worked example's maximum-range figures for a REGULAR unit (40" open, 32" soft cover, 24" hard cover) and the Fire Value → Firepower Die examples (7 men FP1 → total 7 → D8; 5 men FP2 → total 10 → D10; ≤4 → D4; >12 → D12, no bonus).
- Every row of both Generic Weapons tables (12 Small Arms rows with FIREPOWER 0.5/1/1/3/3/1/2/3/2/3/2/3 and IMPACT D4/D6/D10/D8/D8/D10/D8/D8/D10/D10/D12/D12; 7 Support Weapons rows with Support Firepower D8/D10/D10/D6/D12/D8/D10 and IMPACT D10/D10/D12/D12*/D8*/D8*/D12*) and the asterisk footnote.
- The full FIRE RESOLUTION / THE TARGET'S ROLL / THE FIRER'S ROLLS / ADDING SUPPORT FIREPOWER text on p.35, including the D6 Plasma Gun support-firepower example.
- STEP 1–4 of FIRE AGAINST DISPERSED TARGETS and PENETRATION AND EFFECT, including the worked example numbers on p.35 (total score 18, D8 range die, 2 hits + chance of a 3rd needing target to beat 2 on D8) and on p.36 (firer D10 vs. target D6, rolls 3/5 no effect, 6/5 wound, 9/4 kill), and the STEP 4 allocation-of-hits rule and its photo caption ("the D8 score of 5 indicates the fifth man along gets hit").
- The SUMMARY OF INFANTRY FIRE PROCEDURE box on p.36, matching the equivalent box on qr-p2.
- The opening of THE QUICK-AND-DIRTY OPTION on p.36, correctly noted as cut off at the page boundary.
- All four printed typos/anomalies already flagged by the first reader (FP 3 "represents which," "expressed the nearest," the TWO-dice/ONE-die target-roll discrepancy, and "see out") were re-confirmed against the source at zoom and are correctly preserved verbatim rather than silently corrected.

No invented, misplaced, or out-of-scope content was found in the file, and nothing present on these four pages was found missing from it. This chunk required no substantive corrections.

</details>

---

# Chunk 13 · pp. 37–39 · 14 Fire combat (part 2): heavy weapons, point targets, vehicles

Source: STARGRUNT II (Jon Tuffley, Ground Zero Games, 1996), printed pages 37, 38, 39 (scan files sg-p38.png, sg-p39.png, sg-p40.png). Chapter heading "14 FIRE COMBAT" repeats at the top of every page in this chapter.

## Quick-and-dirty fire resolution option (continued from p.36) (p.37)

This is the tail end of a designer-provided alternative/simplified fire-resolution method that begins on the previous page (not in this chunk); the opening clause is a mid-sentence continuation as printed:

"...by 6. If the target is in soft cover, raise the armour value by 1 die type, or by 2 die types if in hard cover. If wished, you can still make the extra die roll for any left-over fire points to see if an extra hit is scored."

"Once you have the number of hits, this is the number of casualties scored - distribute them as normal, then treat each figure hit as "wounded" until they are checked by a medic (when you will find if they are dead, wounded or OK)."

"Using this alternative method skips the complete step 3 from the full fire procedure - no rolls of impact vs. armour are needed, and fire combat resolution is speeded up considerably. The down-side is that it takes no account of the differences in lethality between small arms types, and range has much less of an effect on the fire results; it is definitely less "realistic", though its effect on the overall game result may be very small."

"Which method you use in entirely up to you; both work, but the "gun bunnies" and hardware freaks will probably prefer the full version. One warning: DO NOT mix the two systems in one game, as they will give different results - it is important that you clearly decide before the game which method all the players wish to use."

(Designer's note, summarised: this quick-and-dirty method is an optional, faster alternative to the full fire procedure; players must pick one method and stick with it for the whole game, never mixing the two.)

## INDIVIDUAL FIRE OF SUPPORT WEAPONS: (p.37)

Rule (verbatim): "When a player desires to fire a support weapon individually, rather than in support of general squad fire, he must use a separate ACTION to do so. In general, such fire is resolved exactly as for the normal squad fire procedure detailed above, with the exception that there is (obviously) no die used for the squad Small Arms firepower; the firer rolls just two dice, his QUALITY die (for the weapon gunner/crew) and the Firepower die for the specific weapon type, which is the same as the SUPPORT FIREPOWER die described above."

Rule (verbatim): "The RANGE BAND is the same as for small arms fire if the support weapon is being used by infantry, but can be higher (depending on target size) if the weapon is on a groundmount or vehicle. Potential hits are scored in the usual way, and when rolling to convert these into actual hits use the Impact Die of the specific weapon type."

Rule (verbatim): "Support weapons that are marked with an ASTERISK on the weapons table may be fired like HEAVY WEAPONS when firing at point targets, as they have enough power to cause real damage to armoured targets; those support weapons that are classed as SAWs fire only small-arms calibre rounds, and are subject to the SMALL ARMS AGAINST POINT TARGETS rules below due to their limited damage potential against anything but unarmoured targets."

## FIRING SMALL ARMS AT POINT TARGETS: (p.37)

Rule (verbatim): "Infantry squads may fire their small-arms at vehicle or building targets if they wish, but unless those targets are only very lightly armoured the fire will have very little effect."

Rule (verbatim): "The fire is rolled for in the usual way, using the Range band for normal small-arms fire (ie: the unit's Quality) to determine the Target's range die. The firer rolls his Quality die and his small-arms Firepower die, plus dice for any support weapons he is using. If the firer exceeds the target's roll with one die, he causes a SUPPRESSION result as usual (though this has limited effect on a point target); if he exceeds it with TWO dice or more, then the effect depends on how well armoured the target is: if the target is of armour class 2 or better, there can be NO EFFECT other than the suppression, but if it is armour class 1 or less (ie: if it has an armour die of D12 or less) then it is possible that the small-arms rounds will cause damage. In this case, roll ONCE ONLY for penetration as if a MINOR hit had been scored, so the Impact is just the basic value for the small arms type. Roll this against the Armour die, and apply results as follows:"

- "If the Impact roll fails to beat the Armour roll, there is no effect."
- "If the Impact beats the Armour, then some rounds have penetrated the vehicle; go to the CASUALTIES step below. Other than this the vehicle itself is undamaged."
- "If the Impact is MORE THAN TWICE the Armour roll, roll for casualties as below, PLUS the vehicle is DISABLED."

Rule (verbatim, casualties from small-arms penetration): "If the vehicle is penetrated by small-arms rounds, some of the crew and/or passengers may be hit; roll for EACH occupant, using the figure's Armour Die, any that score 1 are DEAD, any rolling 2 are WOUNDED and those with 3 or better are unharmed."

Worked example (verbatim, p.37 right column): *"An infantry squad with Gauss Rifles plus a Gauss SAW fire on a softskinned jeep carrying four men - a driver in ordinary battledress and three troopers in partial light armour. The opposed roll to hit is made, and the firer beats the target's roll with TWO of his 3 dice, thus getting a possible effective result. The jeep has an Armour Die of D6 as it is unarmoured - the D6 represents just its normal bodywork. Using the Impact die for Gauss small arms (D12), the firer rolls a 9, while the target gets just 4 on his D6. The firer has scored MORE THAN TWICE the target's roll, so the jeep is DISABLED; rolling for each occupant, the driver rolls a D4 and gets 3 - he is OK. The three troopers each roll a D6: one gets 4 and is thus safe, one gets a 2 and is WOUNDED, while the third is unlucky enough to roll a 1 and is thus KILLED. Not a bad result for the firer...."*

Note (verbatim): "As with anti-personnel fire, if a squad fires all its weapons at a point target the effects are all calculated on the Impact value of the SMALL ARMS only, so in most cases if firing at "HARD TARGETS" such as armoured vehicles then it is more effective to use a single specialised point-fire weapon such as a plasma gun or rocket launcher on its own; squad small-arms fire may cause several hits, but they are unlikely to do much damage."

Boxed summary (verbatim, p.37 right column):
> Roll as for ordinary small arms fire. one-die success = Suppression, two-die success = roll for penetration as MINOR HIT. If impact beats Armour, roll for casualties; if twice or more, casualties PLUS vehicle disabled.
>
> Casualty roll: Armour die per figure, 1 = DEAD, 2 = WOUNDED, 3+ = OK.

## HEAVY WEAPONS RANGE BANDS: (p.37)

Rule (verbatim): "The basic RANGE BAND for any heavy weapon against a SIZE 1 TARGET, such as an infantry unit or a very small point target is **12"**."

Rule (verbatim): "If the target is LARGER than size 1, you MULTIPLY the 12" basic range band by the target size class - thus against a size 3 vehicle one Range Band is 36", and against a size 5 target it is 60"."

Exception (verbatim): "Note that any MAN-CARRIED and manually-fired weapons such as Small Arms and Infantry Support Weapons simply use their basic Range Bands against ANY size target; the multiplication of Range Bands described above is ONLY used for Heavy Weapons fitted to vehicles or groundmounts, to reflect their ability to fire accurately over much greater ranges than infantry-portable arms."

Boxed summary (verbatim): "Heavy Weapon range band is 12" x Target Size."

*(Illustration on p.37, bottom right: two power-armoured troopers standing together; no caption printed. Illustrative art, not a rules diagram.)*

## IMPACT VALUES FOR HEAVY WEAPONS: (p.38)

Rule (verbatim): "For HEAVY WEAPONS, the impact values listed on P.29 are for the SIZE 1 version of the weapon; for larger versions you MULTIPLY the impact value by the size class of the weapon, so for an HKP/3 you would use a D12x3, giving a possible score of between 3 and 36."

Rule (verbatim): "The listed impact values are for MINOR HITS on point targets - if you are lucky enough to score a MAJOR HIT then the impact value of the shot is DOUBLED, so in the above D12x3 example it would actually be D12x6, giving a possible range of 6 to 72."

Cross-reference (verbatim): "Some VERY powerful weapons, such as DFFGs and Guided Missiles, have additional multipliers applied to their Impact values - these are listed in the Heavy Weapons table on P.29." (that table is not on this chunk's pages.)

Boxed summary (verbatim):
> Heavy Weapon IMPACT: listed value x weapon size; DOUBLE for Major hits.

*(Photo on p.38, left column: a Heavy GEV Tank model with an armoured trooper figure beside it; caption printed: "Heavy GEV Tank with armoured trooper." Illustrative photo, not a rules diagram.)*

## ARMOUR VALUES OF POINT TARGETS: (p.38)

Rule (verbatim): "As for impact values, the armour values of point targets are expressed as die types with multipliers; for armoured targets, the die type is always a D12 and the multiplier is equivalent to the level of armour class - so class 1 vehicle armour uses just a D12 roll (x1), class 2 armour uses a D12x2, class 3 a D12x3 and so on. Targets with protection less than class 1 armour (basically "soft" targets such as unarmoured vehicles etc.) each have just a die type without modifiers, similar to infantry personal armour - thus an unarmoured truck would be armour value D6, as its bodywork would be about equivalent to infantry partial light armour."

Note (verbatim): "Note that the heaviest type of "infantry" armour, the Heavy Power Suit, has a D12 armour value and is thus the same protection as class 1 vehicle armour."

Boxed summary (verbatim):
> Armour value = D12 x armour class; Softskins have D6 armour.

## ANGLE OF ATTACK: (p.38)

Rule (verbatim): "As vehicles can have different armour values on different faces, it will often be necessary to determine which face of the vehicle is actually hit by fire. Lines extrapolated through diagonally-opposite corners of the model, give four possible arcs through which the vehicle may be fired at; all fire coming from attackers within the FRONT arc will strike the frontal armour, while that from side or rear will hit accordingly."

Rule (verbatim): "Attacks from AIRBORNE vehicles and INDIRECT FIRE will always hit the TOP armour, irrespective of which direction the fire comes from."

(No diagram of the four arcs is printed on this page — the arc construction is described in text only.)

## HEAVY WEAPON FIRE AT POINT TARGETS: (p.38)

Rule (verbatim): "Point fire by heavy weapons is resolved in a similar manner to small-arms fire, in that it is basically an opposed roll between the firer and target player."

Rule (verbatim): "The TARGET player rolls a single RANGE DIE, which is determined by the Range Band relevant to the shot (as calculated above), modified for cover or other circumstances as applicable. Against this the FIRER rolls two dice: the QUALITY die of the weapon/vehicle crew and the FIRE CONTROL system die; if the vehicle has no Fire Control for that weapon (ie: the weapon is being fired manually) then use a D4."

Rule (verbatim, outcome thresholds):
- "If the firer fails to beat the target's roll with ANY of his dice, then the shot has missed completely;"
- "if ONE of the firer's dice beats the target's roll, then he has scored a MINOR HIT;"
- "if TWO (or more) of the firer's dice beat the target's roll, then he has scored a MAJOR HIT."

Worked example (verbatim): *"The firing player has a Scout Car with a 25mm Rapid-Fire Autocannon (classed as an RFAC/1); he is firing this weapon at an enemy APC, which is a size 3 vehicle. The RFAC/1 has a basic Range band of 12", but multiplying this by the target size class of 3 gives 36" - so one range band for the RFAC against the APC will be 36". The APC is currently 40" away from the firing vehicle, which is over 1 range band, so the target's Range Die is shifted up to a D6."*

*"The Scout Car in which the firing weapon is mounted has a REGULAR crew and BASIC Fire Control for the RFAC. The firer will therefore roll a D8 for his crew quality and a D6 for the Basic Fire Control system. The target rolls a 4 on his D6, but the firer is lucky and rolls 7 and 5. Thus the firer has beaten the target with TWO dice, and gets a MAJOR HIT on the APC."*

Boxed summary (verbatim):
> FIRER rolls Quality and Fire Control dice (D4 if no FC); Target rolls Range die.
>
> Firer fails to beat target's roll with ANY dice = miss;
>
> ONE of firer's dice beats target's roll = MINOR HIT;
>
> TWO (or more) of firer's dice beat target's roll = MAJOR HIT.

## ARMOUR PENETRATION AND HIT EFFECTS: (p.38–39)

Rule (verbatim): "If a hit (major or minor) is scored, the players then make another opposed roll to see if the hit penetrates the target's armour. The target player will roll his vehicle's Armour Die (a D12, with the score multiplied by the vehicle's Armour Class), while the firer will roll his weapon's Impact Die (multiplied as required for the weapon's Impact value) - if a MAJOR HIT has been scored, then DOUBLE the final result of the firer's roll. If the firer's final score exceeds the target's, then the shot has penetrated the vehicle's armour."

Rule (verbatim, DESTROYED vs DISABLED): "A PENETRATING HIT that exceeds the target's armour score by MORE THAN TWICE the required number DESTROYS the vehicle completely - it "brews up" spectacularly and will be a burnt-out hulk past any hope of later recovery. A penetrating hit that fails to score enough to do this will DISABLE the vehicle, putting it completely out of action for the rest of the game but leaving it recoverable and repairable after the battle. Whether a vehicle is destroyed or just disabled has a significant effect on whether its crew or occupants get out alive, as described in the section on Vehicle Occupant Casualties on P.39."

Worked example (verbatim, continuing the RFAC/1-vs-APC example): *"Continuing the example above, the target APC has Armour 2 (Armour Die D12x2). The RFAC/1 has a basic Impact Value of D10, but as the hit was a MAJOR one then the penetration score will be doubled - it will effectively be D10x2."*

*"The target rolls his D12 and scores 4, which multiplied by 2 gives him 8. The firer rolls his D10 and scores 7; for a MINOR hit this would not be enough to penetrate, but as a MAJOR hit then the roll is doubled to 14, thus penetrating the vehicle - as it is not more than TWICE the target's score, however, the final result is that the vehicle is DISABLED by the hit rather than DESTROYED."*

Continuation on p.39: *"Note that if the firer had rolled 9 or more it would have been enough to penetrate even with just a minor hit, and with a major hit the total score of 18 would have been more than TWICE the target's final score, thus DESTROYING the vehicle."*

Rule (verbatim, failed penetration): "If the penetration roll is FAILED by the firer, then the hit is a NON-PENETRATING one. This will not disable or destroy the vehicle, but can cause some damage such as immobilising the vehicle or knocking-out its weaponry and other systems."

Boxed summary (verbatim, p.39):
> Roll IMPACT vs. ARMOUR (both with appropriate multipliers - DOUBLE impact roll if MAJOR hit).
>
> If Impact exceeds Armour, DISABLED; if more than twice Armour, DESTROYED.

## NON-PENETRATING HITS ON VEHICLES: (p.39)

Rule (verbatim): "If a vehicle is HIT but the penetration roll then fails, there may still be some damage; roll a D6 - on a score of 1 or 2 the vehicle's SUSPENSION has been hit, and on a roll of 6 the external parts of its SYSTEMS have taken damage. Rolls of 3-5 have no further effect."

Rule (verbatim, suspension damage): "If the roll gives a SUSPENSION hit, the chance of damaging it (and thus immobilising the vehicle) depends on the type of suspension it has; roll a die for the suspension according to the type as given below, in an opposed roll against the Impact Value of the weapon (for a MINOR or MAJOR hit, as appropriate):"

| Suspension type | Die |
|---|---|
| Civilian-type WHEELED (trucks, jeeps etc.) | D6 |
| Military Hi-Mobility WHEELED (wheeled AFVs) | D10 |
| TRACKED vehicles | D10 |
| HOVER vehicle skirts | D8 |

Exception (verbatim, GRAV/WALKER): "GRAV and WALKER type vehicles both have their suspension systems (grav lift units and legs, respectively) protected by the same armour as the rest of the vehicle, and their suspensions cannot be damaged by a hit that failed to penetrate the hull armour in the first place." (I.e., Grav and Walker vehicles have no separate suspension roll for non-penetrating hits.)

Rule (verbatim, immobilisation and crew effect): "If the IMPACT score exceeds the SUSPENSION score, then the vehicle is IMMOBILISED and can no longer move - it is marked with an IMM counter. No casualties to occupants will be caused by immobilisation, but the crew (and passengers if appropriate) should take a Confidence test at a Threat level of 3 - if they fail this they lose CLs accordingly and MUST bail out of the vehicle. If the test is passed, they may of course bail out voluntarily or choose to remain on board - the weapons and other systems of the vehicle are still functional."

Rule (verbatim, systems hit): "If a SYSTEMS hit is rolled, then the shot has caused damage to external sensors, aerials, vision systems etc.; this is automatic regardless of the type of weapon used, but such damage may be only temporary. Mark the vehicle with a SYS counter - while this is in place the vehicle may not fire weapons or use any electronic systems (including communication systems); it may move normally, and there is no effect to crew or passengers. Each time the vehicle is ACTIVATED while it has the SYS marker, the player may use one action in an attempt to remove the marker by getting backup systems on line to replace the damaged ones. This is attempted with a simple D6 roll - on a score of 5 or 6 the backups are functioning and the SYS counter is removed; the vehicle may now function normally again."

Boxed summary (verbatim):
> Non-penetrating hits: roll D6: 1-2 = SUSPENSION, 6= SYSTEMS.
>
> SUSPENSION HIT: roll Impact vs. Suspension type die (Civ. wheeled D6, Mil. wheeled D10, Tracked D10, Hover D8); success = IMMOBILISED. Crew take Conf. Test at TL 3; fail = bail out.
>
> SYSTEMS HIT: all systems off-line; 1 action for repair attempt, roll D6 - 5 or 6 gets backups online.

## INDICATING DAMAGED VEHICLES: (p.39)

Rule (verbatim): "There are counters provided for marking damage to vehicles: if a vehicle is IMMOBILISED, place an IMM counter by it; if it has its SYSTEMS knocked out use a SYS marker, and if completely DISABLED use a DIS marker. If a vehicle is DESTROYED we recommend that it is marked with some cotton-wool "smoke" - you can also tip the model over if you want to!"

## CASUALTIES TO VEHICLE OCCUPANTS: (p.39)

Rule (verbatim): "When a vehicle is disabled or destroyed by a penetrating hit from a support or heavy weapon, there is a strong likelihood that some of its occupants (crew and/or passengers) will become casualties; being inside a vehicle that is penetrated by a powerful round is a bit like being inside a liquidiser when it is turned on!!."

Rule (verbatim, base roll): "Roll once for EACH occupant of the vehicle, using the die type equivalent to their ARMOUR VALUE - thus embarked troops in Partial Light Armour would roll a D6 per man, while if the crew were just in normal fatigues they would only get a D4 each."

Rule (verbatim, DISABLED threshold): "If the vehicle has been DISABLED, then the score that each man's roll must EXCEED to avoid them being injured is equal to the SIZE CLASS of the weapon type which knocked-out the vehicle; ie: if the vehicle was penetrated by an MDC/3 shot then the size class would be 3; in this case each man's die roll would have to score 4 or more for him to escape unscathed - a roll of 3 or less means that figure is a casualty."

Rule (verbatim, DESTROYED threshold): "If the vehicle is actually DESTROYED, then the Size Class of the weapon is DOUBLED for the purpose of these rolls; thus in the example above the MDC/3 would have an effective class of 6, and only troops rolling 7 or better would get out of the wreck - hence any in less than D8 armour are automatically casualties."

Rule (verbatim, casualty severity): "Once you have determined which figures are casualties, roll a D6 for each of them: they are DEAD on 1-3, and WOUNDED on 4-6."

Boxed summary (verbatim):
> Vehicle DISABLED: roll occupants' Armour die, exceed Weapon Size to save, otherwise casualty. If vehicle DESTROYED, double size class of weapon for this roll. Roll D6 for each casualty - 1-3 DEAD, 4-6 WOUNDED.

## MEDICAL TREATMENT OF WOUNDED TROOPS: (p.39)

Flavour (italic in-text, summarised): a passage urging the reader to see wounded figures on the table as squad-mates worth saving, not just tipped-over markers, framing why the medical-treatment rule exists.

Rule (verbatim): "When a Reorganise action is spent on the squad, any troopers who are WOUNDED (those marked with WHITE skulls) may be treated by their comrades and/or the squad medic (if there is one). This represents seeing if the casualties can be saved, and if so applying sufficient emergency aid to stabilise them until they can be Casevac'd to safety." (Flavour continuation, summarised: with luck, a lightly-wounded man patched up in the field can sometimes return to the fight immediately.)

Rule (verbatim): "Note that ALL current casualties in the unit may be treated during one reorganise action."

Rule (verbatim, D6 outcome and markers): "For each casualty attended to by his ordinary squad-mates, roll a D6: on a score of 1 or 2, they are too far gone to save (at least with the limited resources to hand at that moment); remove the white skull marker and replace with a black one - the figure is effectively DEAD for game purposes. On a roll of 3 to 5, the casualty is STABILISED; replace the white skull with a "Red Cross" marker - the figure is now treated and full of painkillers and happy juice, no longer screaming and his comrades are now much happier about the situation; the figure will not, however, be able to take any part in the action and will need to be either parked somewhere safe or else carried around with the squad until an Evac can be arranged. Finally, if the roll was a 6, the patched-up soldier is back on his feet again and ready to resume fighting!"

Rule (verbatim, medic bonus): "If a MEDIC figure is part of the unit, then ADD 1 to the score of the D6 roll described above; if a specialised MEDICAL UNIT (eg: a field ambulance and crew) is attending the unit then ADD 2 to each roll."

Boxed summary (verbatim):
> Wounded may be treated in Reorganise action. Roll D6 per man: 1-2 = DEAD, 3-5 = STABILISED, 6 = OK.
>
> Add 1 to die if MEDIC, or 2 if specialised MEDICAL UNIT.

## Where the full rulebook differs from, or adds to, the quick-reference summary

- **Fire Control default die for heavy-weapon point fire is a p.38-only rule.** The quick reference's "FIRING HEAVY WEAPONS" line (p.2 of the QR) says only "FIRER'S DICE: Quality die, Fire Control die," with no fallback specified. The full text (p.38) adds: "if the vehicle has no Fire Control for that weapon (ie: the weapon is being fired manually) then use a D4." A programmer working from the QR alone would have no die to roll for an unguided/manual mount.
- **The Range-Band-times-Target-Size multiplier applies only to vehicle/groundmount heavy weapons, not universally.** The QR states flatly "TARGET'S DIE: Range Die (Range Band = 12" x Weapon Size)" for "FIRING HEAVY WEAPONS," which could be misread as applying the multiplier to any heavy-weapon shot. The full text (p.37, HEAVY WEAPONS RANGE BANDS) clarifies the multiplier is by TARGET size class, not weapon size, and — more importantly — states explicitly that "any MAN-CARRIED and manually-fired weapons such as Small Arms and Infantry Support Weapons simply use their basic Range Bands against ANY size target; the multiplication of Range Bands described above is ONLY used for Heavy Weapons fitted to vehicles or groundmounts." This exception is not stated anywhere in the QR.
- **Vehicle DESTROYED vs DISABLED: the QR already carries the Casualties to Vehicle Occupants mechanic almost verbatim; what it omits is the narrative reason for the two damage states.** The QR's "HEAVY WEAPONS FIRE AGAINST VEHICLES" box does NOT lack the occupant-casualties mechanic — it already includes, in the same box, wording essentially identical to the full rule's own p.39 boxed summary: "Vehicle DISABLED: roll occupants' Armour die, exceed Weapon Size to save, otherwise casualty. If vehicle DESTROYED, double size class of weapon for this roll. Roll D6 for each casualty - 1-3 DEAD, 4-6 WOUNDED." So a programmer working from the QR alone DOES have the die-per-occupant-by-armour-type roll, the doubled Size Class on DESTROYED, and the D6 DEAD-1-3/WOUNDED-4-6 severity roll. What the QR omits is (a) the full text's explanation of WHY the two states differ — a DISABLED vehicle is out of action for the rest of the game but "recoverable and repairable after the battle," whereas a DESTROYED one "brews up" into "a burnt-out hulk past any hope of later recovery" (p.38) — and (b) the full text's statement that this particular occupant-casualties mechanic applies specifically to a vehicle "disabled or destroyed by a penetrating hit from a support or heavy weapon" (p.39), as distinct from the differently-worded, non-Size-Class-based casualty roll used for small-arms-vs-point-target penetrations (p.37: armour-die roll of 1=DEAD/2=WOUNDED/3+=OK, no Size-Class threshold or doubling).
- **Non-penetrating hits: the GRAV/WALKER suspension exception is absent from the QR.** The QR's "NON-PENETRATING HITS" box gives the D6 table (1-2 SUSPENSION, 3-5 HULL/no effect, 6 SYSTEMS) and the four suspension-type dice (Civ. wheeled D6, Mil. wheeled D10, Tracked D10, Hover D8) correctly, but does not mention that GRAV and WALKER vehicles have no separate suspension roll at all (their lift units/legs share the hull's own armour and can't be hit by a shot that already failed to penetrate) — a programmer following the QR table alone would need a suspension die for these vehicle types that the full rules say does not exist.
- **Systems-hit vehicle effects are compressed in the QR.** The QR's "SYSTEMS HIT" line ("all systems off-line; 1 action for repair attempt, roll D6 - 5 or 6 gets backups online") matches the full text's mechanics exactly, but omits the full text's clarification that a SYS-marked vehicle "may move normally, and there is no effect to crew or passengers" — only firing and electronic-system use (including comms) are blocked. This matters for a programmer deciding what a SYS-flagged vehicle entity can still legally do.
- **Small-arms-vs-point-target rule (armour class 2+ = no damage possible at all) is not in the QR's own summary of it.** The QR's "SMALL ARMS FIRE AGAINST VEHICLES" box gives the mechanical steps (one-die = suppression, two-die = roll for penetration as MINOR HIT, etc.) but omits the full text's threshold that this whole penetration-roll step is skipped entirely (no damage possible, suppression only) if "the target is of armour class 2 or better" — only armour class 1 or less (armour die D12 or less) is even eligible to take damage from small arms. Without this gate, a programmer might apply the small-arms penetration roll to heavily armoured vehicles when the rulebook says it should never be attempted.
- **Medical treatment: the QR omits that one Reorganise action treats every casualty in the unit.** The QR's "WOUNDED" entry gives the D6 table and medic/medical-unit bonuses correctly and identically to the full text, but does not state the full rule's "Note that ALL current casualties in the unit may be treated during one reorganise action" — read narrowly, the QR could be misread as one roll per Reorganise action rather than one roll per wounded figure per Reorganise action.
- **Armour Values of Point Targets and Angle of Attack have no QR equivalent at all.** Neither the D12-times-armour-class point-target armour scheme (with the D6 softskin floor and the note that Heavy Power Suit infantry armour equals class-1 vehicle armour) nor the four-arc angle-of-attack facing rule (front/side/rear by diagonal-corner extrapolation; airborne and indirect fire always hit TOP armour) appear anywhere in the two-page quick reference.

## Illegible or uncertain content

None. All rule text, table values, die types, and thresholds on printed pages 37, 38, and 39 were legible.

<details><summary>Checker's corrections</summary>

Checked line by line against sg-p38.png (printed p.37), sg-p39.png (printed p.38), and sg-p40.png (printed p.39), including pixel-level zoom crops on the suspension-die paragraph, the non-penetrating-hits summary box, the GRAV/WALKER exception, and the HKP/3 example, and cross-checked every "Against the quick reference" claim against qr-p1.checked.md / qr-p2.checked.md.

- **"## Where the full rulebook differs..." section, 3rd bullet (Vehicle DESTROYED vs DISABLED / Casualties to Vehicle Occupants) — was: claimed "The QR has no equivalent of the 'Casualties to Vehicle Occupants' rule ... in any form — this entire mechanic is absent from both QR pages" — now: corrected. This was a factual error: the QR's "HEAVY WEAPONS FIRE AGAINST VEHICLES" box (qr-p2.checked.md) already contains this mechanic almost word for word — "Vehicle DISABLED: roll occupants' Armour die, exceed Weapon Size to save, otherwise casualty. If vehicle DESTROYED, double size class of weapon for this roll. Roll D6 for each casualty - 1-3 DEAD, 4-6 WOUNDED." The bullet has been rewritten to say the QR already has the numeric mechanic, and instead identify what is genuinely missing from the QR: the DISABLED-is-recoverable vs DESTROYED-is-a-burnt-out-hulk narrative reasoning (p.38), and the full text's statement that this mechanic is specifically for a support-or-heavy-weapon penetrating hit, as opposed to the separately-worded small-arms-vs-point-target casualty roll (p.37).

All other content checked and confirmed correct as first transcribed (no change made):
- Every verbatim rule quotation, worked example, and boxed summary on pp.37–39, word for word against the scans, including the two worked examples (softskinned-jeep small-arms example, p.37; RFAC/1-vs-APC heavy-weapon example, p.38–39) and all their numbers (D6/D12 rolls of 9 and 4; D8/D6 crew rolls of 7 and 5 vs. target's 4; D12/D10 rolls of 4 and 7, doubled to 14, vs. Armour score of 8; the D4/D6 occupant rolls of 3, 4, 2, 1).
- All die types, multipliers, and thresholds: HKP/3 → D12x3 (range 3–36, doubled to D12x6 for 6–72 on Major hits); armour value D12 x armour class with D6 softskin floor; Heavy Power Suit = D12 = class 1 vehicle armour; Heavy Weapon range band 12" x target size class; the four suspension dice (Civ. wheeled D6, Mil. wheeled D10, Tracked D10, Hover D8) and the GRAV/WALKER no-separate-suspension-roll exception; the D6 non-penetrating-hit table (1-2 Suspension, 6 Systems, 3-5 no effect) and its "6= SYSTEMS" boxed wording (no "3-5" line in this box, unlike the QR's version — confirmed printed as shown, not a transcription error); the Vehicle Occupant Casualties thresholds (exceed weapon Size Class to escape when DISABLED, doubled Size Class when DESTROYED, D6 1-3 DEAD/4-6 WOUNDED); the Medical Treatment D6 table (1-2 DEAD, 3-5 STABILISED, 6 OK) and MEDIC (+1) / MEDICAL UNIT (+2) bonuses.
- The suspension-type dice (D6/D10/D10/D8) are printed on p.39 as four separate sentences ("Civilian-type WHEELED suspension (trucks, jeeps etc.) roll a D6;" etc.), not as a table; rendering them as a markdown table in the digest is a reasonable presentational choice and every value in it is correct, so this was not treated as an error.
- All seven headings' page attributions (p.37, p.37, p.37, p.38, p.38, p.38, p.38–39, p.39, p.39, p.39, p.39) match where each section actually begins/ends on the scans.
- The "Illegible or uncertain content: None" statement is confirmed — nothing on pp.37–39 was illegible.

</details>

---

# Chunk 14 · pp. 40–42 · 14 Fire combat (end), 15 Infantry close assault

Source: scanned pages sg-p41.png, sg-p42.png, sg-p43.png = PRINTED pages 40, 41, 42 respectively. All citations below use PRINTED page numbers. All text is legible at full resolution; nothing was marked [illegible].

---

## PRINTED PAGE 40 — Chapter 14, "FIRE COMBAT" (tail end of chapter)

The chapter-14 banner ("14 FIRE COMBAT") still heads this page; it is the last page of that chapter before Chapter 15 begins. A flavour illustration (a VTOL/helicopter over a "MEDIVAC 1" armoured medical vehicle, with a medic and casualty) occupies the right column; no rule text in it.

### POWER ARMOUR TROOP CASUALTIES: (p.40)

- When a Power-Armour (PA) trooper becomes a casualty but is not killed outright, the controlling player rolls **immediately** to see what happens to him — not deferred to a later Reorganise action — because the suit's automated systems include medical stabilisation and a biomonitor link to the unit leader.
- Roll **1D6**:
  - **1** = wearer fatally wounded → marked as **DEAD**.
  - **2–4** = wounded, but the suit's systems stabilise him.
  - **5** = wearer unhurt, but the suit itself is wrecked — he is out of the game, marked with a **DISABLED** counter (as for a vehicle) rather than a stabilised-casualty counter; he can only wait to be extracted.
  - **6** = suit switches to backup systems, pumps drugs into the stunned operator, and gets him back into action.
- If the result is a suit immobilisation (the "5" roll), a **Reorganise action** must be spent to extract the trooper from the suit. After that he may be represented by any unarmoured figure (probably armed with a pistol) and may either continue with the squad or be sent back to his own lines.

> **Boxed rule (as printed):** "1D6 when wounded: 1 = DEAD, 2-4 = Stabilised wounded, 5 = Suit KO, 6 = OK."

### GUIDED MISSILE FIRE: (p.40)

- GMS (Guided Missile System) launchers use a fire mechanism similar to other point-target fire. **FIRER rolls TWO dice**: the Quality die of the missile operator and the **Guidance die** of the missile.
- Instead of a Range Die, the **TARGET** rolls one die according to the level of ECM (Electronic Counter-Measures) fitted to the target vehicle:
  - No ECM: **D4**
  - Basic ECM: **D6**
  - Enhanced ECM: **D8**
  - Superior ECM: **D10**
- Range to target does **not** affect missile fire (missiles are assumed to have effective range far in excess of any usable table size), but a clear line of sight is required for target acquisition; if the target is in any kind of cover, **shift the ECM die up one type**.
- **IMPORTANT NOTE:** although classed as an Infantry Support Weapon (it is man-portable), the GMS/P may **NOT** be fired in support of a small-arms fire resolution — it may **only** be used in a separate fire action.

> **Boxed rule (as printed):** "Guided Missiles roll Quality die and Guidance die, vs. Target ECM die (D4 if no ECM). Shift ECM die up one type if in cover. No RANGE limit on GMS fire. GMS may fire in separate action only."

### REMOTE MISSILE LAUNCHERS: (p.40)

- Remote launchers can be used for any type of guided missile: an emplaced launcher package, usually one-shot, represented on-table by an inverted MISSILE marker.
- Emplacing the launcher takes the operator **one action**; he may then move up to **12"** away from it while remaining able to fire it by remote control.
- With a remote launcher, line of sight to the target may be traced **either** from the operator **or** from the launcher itself (operator "sees" via optical link).
- When the missile is fired, the launcher system is discarded.
- Hit resolution is identical to normal missile fire.

### UNGUIDED ROCKETS: (p.40)

- Infantry-portable unguided rocket launchers ("IAVRs" — Infantry Anti-Vehicle Rockets — or "buzzbombs") are shoulder-fired, tube-launched, usually disposable (a few reloadable types exist).
- Fired as any other support weapon: firer rolls the operator's **Quality die** plus the rocket's **Firepower die (a D8)**; target rolls a **Range die** as usual.
- The Range Band of an unguided rocket equals the **Small Arms range band for the operator's Quality** — e.g. a REGULAR operator gives an 8" range band. Normal die shifts for target-in-cover apply.
- Because rockets are short-ranged, this range band applies to **all target sizes** — it is **not** multiplied by target size class the way Heavy Weapon fire range bands are.
- Unlike Guided Missiles, unguided rockets **MAY** be used to support infantry small-arms fire (i.e., combined into the same fire resolution).

### HEAVY WEAPONS FIRE AGAINST INFANTRY: (p.40)

- Most vehicle fire against infantry in SGII uses dedicated anti-personnel weapons, but a vehicle's main direct-fire armament can be fired at an infantry target; this is possible but generally not very effective, since such weapons are optimised to kill armour, not to hit dispersed groups of men. All such shots are assumed to be either explosive rounds or shots fired into the ground for blast/debris effect — either way resolved the same way.
- If fired at a dispersed target, resolve exactly as small-arms/support fire: the target squad rolls a **Range die** (treated as a size-1 target); the vehicle rolls its **Quality die** and its **Fire Control die**; sum as normal if effective fire is scored, then work out potential hits.
- For **IMPACT**, treat the fire as though from a GPE (General Purpose Explosive) artillery round — a **D8** is rolled for impact against the Armour of whichever troops take potential hits, since blast/shrapnel effects are similar.

> **Boxed rule (as printed):** "Roll as for small-arms fire, using Quality and Fire Control dice. Impact die is a D8 for blast and shrapnel effects."

---

## PRINTED PAGE 41 — Chapter 15, "INFANTRY CLOSE ASSAULT" (start)

Chapter banner: "15 INFANTRY CLOSE ASSAULT."

### Introduction (p.41)

*[Editorial heading — not printed on the page; the chapter banner is immediately followed by the flavour text below with no "Introduction" label in the original.]*

Designer's-note-style framing (flavour, condensed): Close Assault is the decisive hand-to-hand infantry fight, contrasted with ranged Firefights (which mostly suppress rather than kill); its outcome hinges more on the attackers' nerve and the defenders' willingness to stand than on raw firepower, and it is usually the only reliable way (short of Artillery) to take ground the enemy is dug into. The mechanism for Close Assault therefore leans heavily on the REACTION and CONFIDENCE TEST systems for both sides.

Rule text (verbatim):
- "One CLOSE ASSAULT may be made by a Unit during its activation, and is assumed to use up both actions of the unit, whether or not both are needed for the movement to contact — in other words, the unit cannot expend one action on something else and then close-assault with its second action."
- "The 'target' of the assault must be a single defensive position or location held by one enemy unit, though the attacking player may attempt to commit more than one unit to the close assault (see **Multiple Activations** rule below)." — *[Cross-reference only: the Multiple Activations rule is not printed on pages 40–42 and is not transcribed here.]*

### INITIATING CLOSE ASSAULT: (p.41)

- The attacker must announce his intention **before** moving the activated unit.
- He then immediately makes a **REACTION test**, at Threat Level:
  - **0** if the unit is currently **CO** (CONFIDENT)
  - **+1** if **ST** (STEADY)
  - **+3** if **SH** (SHAKEN)
- Units currently at **BROKEN** or **ROUTED** confidence may **NOT** attempt Close Assaults.
- If the Reaction test is **passed**, the assault may proceed. If **failed**, the unit loses its first action but may still use its second action for something else (it may not retry the close-assault that activation).
- Once the test is passed, the unit makes a **COMBAT MOVE** (roll its mobility die type and **double** the score). This movement must be enough to bring at least some figures of the assaulting unit into contact with the defending unit (or the cover/position they occupy).
  - If the Combat Move roll is sufficient to reach the defenders, the assault proceeds as below.
  - If **not** sufficient, the assaulting unit may use its **second action** to repeat the Combat Move roll — but only **after** taking fire from the defenders (detailed later in the chapter, not on these pages).
- As soon as the attackers pass their Reaction test and begin to charge, the **defender** makes a **CONFIDENCE TEST**, at a Threat Level set by the attacker:defender odds:
  - **1:1 odds** (i.e., less than 2:1 superiority) → Threat Level **+1**
  - **2:1** or better → **+2**
  - **3:1** → **+3**, and so on.
  - When calculating odds, each ordinary trooper counts as **1**; each **POWER ARMOURED** trooper counts as **2**; round the odds **down**.
  - Worked numeric examples (verbatim): "6 ordinary attackers against 4 defenders would be 1:1 (so the threat level would be +1), 8 against 4 would be 2:1 for a threat level of 2, but 6 Powered Troopers (= 12) against 4 ordinary defenders would be 3:1, for a threat level of +3."
- If the attackers have a **TERROR EFFECT** (defined elsewhere, not on these pages), **DOUBLE** the Threat Level for the defender's confidence test.
- As usual, total Threat Level is added to the unit's **Leadership Value (LV)**; the defender must exceed that number to pass.
- If the defender's test is **passed**: the defender may stand firm and receive the assault.
- If **failed**: the unit loses Confidence Level(s) accordingly and must immediately withdraw from the position by **6"** or its basic movement distance in that terrain, whichever is **greater**.

**SPECIAL NOTE** (verbatim): "a defending unit that is already at BROKEN will **automatically** drop to ROUTED and withdraw if close-assaulted; provided the attackers pass their test to charge, the defenders do not get to take their confidence test to stand."

- Should the defender withdraw (he may also elect to do so **voluntarily**, regardless of the confidence-test result), the attacker immediately occupies the vacated position and his activation ends. He may pursue the retreating enemy on his **next** activation — *[cross-reference to the optional rule on OVERRUNS AND FOLLOW-THROUGH ATTACKS, not printed on pages 40–42]*.
- If the defending unit stands to face the assault, actual Close Assault combat is resolved (see Close Combat Resolution, below).

> **Boxed rule "Initiating Close Assault" (as printed):**
> "Attackers take reaction test: Threat Level +0 if CO, +1 if ST, +3 if SH. If test passed, may COMBAT MOVE to assault.
> Defenders take confidence test: Threat Level is ODDS, ie: 1:1 = +1, 2:1 = +2 etc. Power Armour count as 2 troops in odds calculation. DOUBLE threat level for TERROR effect. If test failed, withdraw 6" or base move, plus lose CL. If passed, stand and receive assault."

### CLOSE COMBAT RESOLUTION: (p.41–42)

- "Hand-to-hand combat is fast and bloody — very much a case of 'kill or be killed'. Unlike fire combat it is resolved on a man-to-man basis, with each figure involved rolling against his immediate opponent."
- **Figure allocation:** when two units come into contact, the **attacking** player first places one of his figures into base-to-base contact with each defending figure. Once every defender has one attacker allocated, any **leftover attacking figures** are allocated by the **DEFENDING** player — some defenders may end up facing two (or more) attackers, but the defender (not the attacker) chooses which figures take the extra opponents, preventing the attacker from deliberately piling onto important figures (leaders, special weapons, etc.).
- If there are **more defenders than attackers**, reverse the process: the **defender** allocates figures first, and the **attacker** allocates the remainder.

**Worked example / diagram (p.41, "Infantry Close Combat"):** Illustration shows attacking figures **A, B, C, D, E** and defending figures **W, X, Y, Z**. Caption (verbatim): "Attacker has five men, A-E; defender has four men W-Z. When they come into close combat, the attacker first places one of his men to attack each of the defenders so A-D are 'paired off' with W-Z. The defender now chooses who the final attacker (E) gets to fight, and chooses figure Y to take on two opponents."

**Continuing on p.42:**

- "Once each figure is in base contact with one or more opposing figures, each figure will fight its opponent(s) using an opposed die roll."
- Each figure rolls **ONE** die; whichever figure rolls **higher** puts the opponent out of the combat, marked with a **WHITE SKULL** marker. (What happens to the "downed" trooper is resolved at the end of the close combat — see Casualties, below.)
- If **two or more** figures attack a single opponent, each attacker rolls independently and is compared **separately** to the defender's roll — the attackers' dice are **not** added together. It is possible for the lone defender to beat one attacker but lose to the other, or (rarely, if good and lucky) beat both.
- If two opposing rolls are **equal**, neither combatant is affected; they continue fighting in the next round.
- **Die type:** the figure's **Quality die**, shifted by the close-combat weapon type it is using (if any). This is an **OPEN SHIFT** — if a weapon's shift(s) would push the die type over D12, the excess is applied as a **NEGATIVE** shift to the **opponent's** die type instead. If facing **two opponents**, the excess shift is taken off **both** of their dice.

**Close combat weapon values are (table as printed):**

| Weapon | Die shift |
|---|---|
| No specific close combat weapon (trooper has just ranged combat weaponry) | No die shift. |
| Close combat firearm (pistol, machine pistol etc.) | Shift up ONE die type. |
| Close combat edged weapon (sword, axe, power sword etc.) | Shift up ONE die type. |
| Shotgun or Flame weapon | Shift up TWO die types. |

- If one figure is in **POWER ARMOUR**, **DOUBLE** his die roll score (the numeric result of his roll, after the die is rolled).
- If it is the **FIRST ROUND** of close combat in that assault, and the defenders are in cover, "in position," or occupying field defences, **all defending figures get a one die shift upwards**. This bonus does **not** apply in second or later rounds of the same assault, since by then the attackers are assumed to be intermingled with the defenders and slugging it out hand-to-hand.

**Worked example (p.42, italicised "Example:"), transcribed in full:**

"Two troopers in Power Armour are in close combat with three light infantry; one of the infantrymen has a shotgun, while the other two have ordinary small arms. One PA trooper has a flamer in his suit, the other has a normal APW."

"After 'pairing off', the figure with the shotgun ends up fighting the ordinary PA trooper on his own, while the other two tackle the remaining PA trooper (the one with the flamer). We assume neither side gets the bonus for defending from cover."

"The light infantry are all REGULARS, so get D8s — the one with the shotgun gets a 2 level shift up to a D12 for his weapon, while the other two stay on D8s. The PA troops are VETERANS, so get a D10 each; the one with the APW gets no die shift, but the one with the flamer would get a two level shift — this would put him above a D12, so instead one shift is applied to him (to raise to D12) and the remaining shift will be taken OFF his opponents' dice — thus the two light infantry he is facing each drop from D8 to just D6."

"Everyone now rolls their dice: the two light infantry with the D6s score 3 and 5, while the PA trooper they are fighting gets a 4 with his D12 — not very good, but he gets the score DOUBLED due to his Power Armour and ends up with 8, thus beating BOTH his opponents."

"The light infantryman with the shotgun rolls his D12 and gets a 10; his PA opponent rolls his D10 and gets only 3, which is doubled to 6 — not enough, and to his great relief the shotgun-armed soldier brings down the PA trooper – obviously a pointblank shot into a vital spot!"

"The first round of close combat therefore ends with two of the light infantry and one of the PA troops all 'down' with white skull markers, and the one remaining figure from each side facing off for the second round — provided the light infantryman does not turn and run first."

> **Boxed rule "Close Combat Resolution" (as printed):** "'Pair off' figures to determine who fights who, then roll die for each figure - any that exceed their opponent's roll win their fight. Die type is Quality, shift up one for close combat weapon, two for flamer or shotgun. One die shift up for defenders in cover or in position, for first round only. DOUBLE roll for Power Armour. Mark all losing figures with white skull."

---

## PRINTED PAGE 42 — Chapter 15, "INFANTRY CLOSE ASSAULT" (continued)

### CASUALTIES IN CLOSE COMBAT: (p.42)

- Any figure beaten by an opponent immediately gets a **CASUALTY marker** (white skull counter) and is out of action for the rest of that close-combat resolution.
- When the combat is over, roll **D6** for **each** figure that is "down" (from **both** forces):
  - **1–2** = **DEAD**
  - **3–4** = **WOUNDED** (need medical treatment as usual)
  - **5–6** = **stunned or knocked out** — they may return to combat if they were on the **winning side**, or are **taken prisoner** if on the **losing side**.
- A losing unit that pulls back from close combat **CANNOT** take its wounded or stunned troops with it — they must be left to the mercy of the victors.

> **Boxed rule (as printed):** "Roll for casualty effects when close assault is over; 1-2 = DEAD, 3-4 = WOUNDED (need attention), 5-6 = stunned, now OK. Stunned/wounded losers are captured."

### ENDING CLOSE COMBAT: (p.42)

- After the **first round** of combat resolution, the player who took the **most casualties** in that round (or the **DEFENDER**, if casualties are equal) must take another **CONFIDENCE test**, at Threat Level **+1 per casualty** he suffered in that stage of the assault.
  - If he **fails**: he must fall back from the position (as described under Initiating Close Assault) and his opponent has "won" the assault.
  - If he **passes**: the opponent must take the same kind of test, at Threat Level **+1 per casualty** the opponent himself suffered.
    - If the opponent **fails**: he must fall back from the assault (6" or his base movement, whichever is greater) and loses Confidence Levels as applicable.
    - If the opponent also **passes**: a **second round** of combat is fought, exactly as the first round, **except** the Defender may **NOT** count any bonus for being in Cover or In Position this time (that bonus is first-round-only, per Close Combat Resolution above).
- After the second (or later) round, the same test-and-fall-back sequence above repeats, starting with the side that has taken the **most casualties overall** since the start of the close assault. *[Printed exactly as: "reaction-test again starting with the side that has taken the most casualties OVERALL since the start of the close assault" — note the rulebook's own wording says "reaction-test" here, even though the test being repeated throughout this section is a CONFIDENCE test (Threat Level +1 per casualty), not the Reaction test used to initiate the charge. This may be a terminology slip in the source; transcribed as printed rather than silently corrected.]*
- If there is **still** no conclusive result (neither side falls back, whether by choice or by failing a test), the assault continues into **yet another combat round** — described as rare, since most assaults resolve in one or two rounds of fighting.

### Photograph caption (p.42, flavour, not a rule)

A photo of two miniatures units in a hilltop terrain setup is captioned: "Two squads of New Anglian Marines charge into close assault against a Eurasian unit defending the hilltop." Purely illustrative; no additional rule content.

---

## Cross-references to material NOT on pages 40–42

These topics are named or implied in the text on my assigned pages but their rules are printed elsewhere in the chapter (later pages) and are **not** transcribed here per the "don't add rules not on the page" instruction:
- **Multiple Activations** (committing more than one unit to a single close assault) — referenced on p.41 ("see Multiple Activations rule below").
- **TERROR EFFECT** definition — referenced on p.41 ("see below") as doubling the defender's confidence Threat Level; the definition of what confers Terror Effect is not printed on pp.40–42.
- **OVERRUNS AND FOLLOW-THROUGH ATTACKS** (optional rule) — referenced on p.41 as what governs pursuit of a retreating enemy on the attacker's next activation.
- **Final Defensive Fire** (defenders firing on attackers who fail to close the distance in their first action) — this topic appears in the quick-reference summary (see below) but is not printed anywhere on pp.40–42; it must be on a subsequent page of Chapter 15.

## quickRefDisagreements

Comparing the full rulebook text on pp.40–42 against `qr-p1.checked.md` / `qr-p2.checked.md`:

1. **Attacker eligibility restriction missing from QR.** The full rulebook (p.41) states units currently at **BROKEN or ROUTED** confidence may **NOT** attempt a Close Assault at all. The QR's CLOSE ASSAULT box gives the attacker's reaction-test Threat Levels (CO/ST/SH) but never states this hard restriction for Broken/Routed attackers — a programmer following only the QR could incorrectly allow a Broken or Routed unit to attempt (and even take a reaction test for) a close assault.
2. **"Already-BROKEN defender" special case missing from QR.** The full rulebook's "SPECIAL NOTE" (p.41) says a defending unit already at BROKEN automatically drops to ROUTED and withdraws without taking the confidence test to stand, once the attackers pass their charge test. The QR CLOSE ASSAULT box has no such special case — it implies every defender takes the odds-based confidence test.
3. **Open-shift / negative-shift mechanic entirely absent from QR.** The full rulebook (p.42) explains that close-combat weapon die shifts are an "OPEN SHIFT": if a shift would push a figure's die above D12, the excess is instead applied as a **negative** shift to the **opponent's** die (and against both opponents' dice if facing two). The QR's Close Combat Resolution box only says "shift up one for close combat weapon, two for flamer or shotgun" with no mention of the over-D12 rule at all. This is exactly the kind of edge case (e.g., a Veteran/Elite figure with a flamer) that the worked example on p.42 depends on, and a programmer implementing only from the QR would get results like the example's D6-vs-D6 fights wrong (they would likely just cap the attacker at D12 with no compensating penalty to the opponents).
4. **Stunned/knocked-out fate by winner/loser not fully in QR.** QR's close-assault casualty line reads only "...5-6 = stunned, now OK" (qr-p2.checked.md line 57), with no distinction based on which side won. The full rulebook (p.42) and its own boxed summary specify that a "5-6" figure returns to combat only if on the **winning** side, and is **taken prisoner** if on the **losing** side, and separately states a retreating loser cannot bring wounded/stunned troops with it. None of that winner/loser distinction is present in the QR line as transcribed.
5. **Tie-break for "most casualties" not in QR.** The full rulebook (p.42, Ending Close Combat) specifies that if casualties are tied after a round, the **DEFENDER** is the one who must test Confidence first. The QR's "Side with most casualties after each round tests Confidence" line has no tie-break rule.
6. **Order of testing in 3rd+ rounds not in QR.** The full rulebook specifies that after the second round, retesting starts with the side with the most casualties **overall since the start of the assault** (not just that round). The QR simply says "continue until one side breaks or is destroyed," without stating who tests first in later rounds.
7. **Support-weapon die values (pp.40) not covered by QR at all.** The QR's two pages never mention Guided Missile Systems' ECM-die table (D4/D6/D8/D10 by ECM level), Remote Missile Launchers, Unguided Rockets (IAVR) as a distinct rule, Heavy Weapons Fire Against Infantry, or the Power Armour Troop Casualty (1D6: 1=DEAD/2-4=stabilised/5=Suit KO/6=OK) sub-table. These are all on p.40 but have no QR counterpart, so a programmer relying only on the QR would be missing this entire subsystem.
8. **Possible numeric conflict — Unguided Rocket Firepower die.** Page 40 rule text states explicitly: "the firer rolling the operator's Quality die plus the rocket's Firepower die (**a D8**)." The QR's GENERIC WEAPONS TABLE (qr-p2.checked.md, Support Weapons) lists "Infantry Rocket (IAVR) | D10 | D12*" — i.e. Support Firepower **D10**, not D8. Both appear to describe the same weapon (IAVR / Infantry Anti-Vehicle Rocket / "unguided rocket"). This is a direct numeric conflict between the page-40 prose and the QR's weapons table that a programmer must resolve by checking the full Appendix weapons-table page (not part of this page range) before hard-coding either value.

## Illegible content

None. All text, numbers, table cells, and the worked examples on pp.40–42 were legible at full resolution.

<details><summary>Checker's corrections</summary>

Checked line by line against sg-p41.png (printed p.40), sg-p42.png (printed p.41), and sg-p43.png (printed p.42), including both boxed-rule call-outs on p.40, the "Initiating Close Assault" and "Close Combat Resolution" boxes on p.41–42, the worked odds examples, the full close-combat weapon-shift table, the italicised worked example (Power Armour vs. light infantry), and the illustration/photo captions.

**Result: the first reading was highly faithful.** Every die type, die shift, threshold, range, count and table cell I checked matches the source exactly — including the GMS ECM die table (D4/D6/D8/D10), the unguided-rocket Firepower die (D8) and its correctly-flagged conflict with the QR's D10 entry, the PA-casualty 1D6 sub-table, the close-combat weapon shift table (No shift / +1 / +1 / +2), the odds-based Threat Levels and the worked "6 vs 4 / 8 vs 4 / 6 PA vs 4" example, the OPEN SHIFT / negative-shift mechanic, and every number in the full Power-Armour-vs-infantry close combat worked example (D8s, D10s, the shift to D12 with the leftover shift taken off both opponents dropping them to D6, the rolls of 3/5/4(→8)/10/3(→6), and the resulting casualties). All four boxed "as printed" rules were verified character-for-character against the scans and match. Nothing was found on the pages that the digest invented, misplaced, or presented as a rule when it was actually commentary. The cross-reference list (Multiple Activations, Terror Effect, Overruns and Follow-Through Attacks, Final Defensive Fire) and the "Illegible content: none" declaration are both accurate. The "quickRefDisagreements" section's eight points were independently re-checked against qr-p1.checked.md / qr-p2.checked.md and all are accurate as stated.

I made two small corrections, both about faithfulness of presentation rather than substance:

1. **Where:** Printed page 41, "### Introduction" heading. — **Was:** presented as a plain section heading with no indication of its status. — **Now:** added an editorial note that "Introduction" is not printed on the page — the chapter banner is followed directly by the flavour paragraphs, with no heading of that name in the original — so a reader doesn't mistake it for printed section text.

2. **Where:** Printed page 42, "ENDING CLOSE COMBAT," the sentence about what happens after the second round. — **Was:** "the confidence-test/reaction sequence repeats," a paraphrase that silently resolved an oddity in the source's own wording. — **Now:** restored a note that the rulebook's literal text here is "reaction-test again," even though the test being repeated throughout this whole section (Threat Level +1 per casualty, added to LV) is a CONFIDENCE test, not the Reaction test used earlier to initiate the charge — flagged as a probable terminology slip in the source and transcribed as printed rather than quietly corrected.

No numbers, dice, thresholds, ranges, counts, table cells, or worked-example figures needed changing.

</details>

---

# Chunk 15 · pp. 43–46 · 15 Close assault (end), 16 Off-table support, 17 Artillery fire

Source images: `sg-p44.png` = printed p.43, `sg-p45.png` = printed p.44, `sg-p46.png` = printed p.45, `sg-p47.png` = printed p.46.

Note on scope: printed page 43 is the tail end of **Chapter 15: INFANTRY CLOSE ASSAULT** (the chapter banner running along the top of every page of that chapter reads "15 INFANTRY CLOSE ASSAULT"), not Chapter 16. Chapter 16 (OFF TABLE SUPPORT) begins on printed p.44, and Chapter 17 (ARTILLERY FIRE) begins on printed p.46. Chapter 17 continues past printed p.46 onto pages not included in this batch (the "casualties from artillery fire" and "on-table artillery" sections mentioned in the chapter's topic list are not present on any of the four supplied pages).

---

## Chapter 15: INFANTRY CLOSE ASSAULT (continued) — printed p.43

This page continues directly from the close-combat "pair off and roll" procedure described earlier in the chapter (that procedure itself is not on this page).

**Multi-round resolution (opening paragraph, no sub-heading):**
Note that the entire action is fought out at one go, even if it goes to multiple rounds of combat; once any Close Assaulting unit actually reaches its objective then the assault is resolved completely within ONE Game Turn, and never lasts over to the next turn.

> **Boxed rule summary:** Side with most casualties after each round tests Confidence: Threat Level +1 per casualty in this close assault. If test failed, fall back and lose CL; if passed, other player must test in same way, with same results.
> If both hold, fight second round of close combat - continue until one side breaks or is destroyed.

### FINAL DEFENSIVE FIRE: (p.43)

If, while attempting to move into a close-assault, the attacking unit **fails** to roll enough movement distance to actually reach the defenders in his first action, then a special rule comes into effect: the DEFENDERS can take a "free shot" at the attacking troops, whether or not the defenders have already activated that turn.

The defenders may attempt to do this EVEN IF SUPPRESSED, although if they are, then they must first pass a REACTION TEST with a Threat Level equal to the number of Suppression markers they are currently suffering from. If not suppressed the defenders may perform the fire without a reaction test.

Provided they manage to fire, they then perform a single action of infantry weapons fire, which may include support weapons if desired subject to the usual rules.

When resolving this fire, use the normal procedure with one major exception: there is no normal SUPPRESSION result used in the fire procedure; if the fire fails to score actual casualties, then there is no effect. If casualties **are** inflicted, then the attacking unit must make an immediate reaction test, at a threat level of +1 for every casualty suffered - if it fails this test, it must immediately withdraw to the nearest cover, or to the point it started the assault from (to the attacking player's choice), after which movement it acquires a Suppression marker. Should the attackers either not suffer any casualties, or pass the reaction test after taking casualties, they may then attempt to use their second action to complete the assault, rolling for combat movement as before and moving accordingly. Should they STILL fail to roll enough movement to reach the defenders, the player may choose to either have the unit move forward as dictated by the combat move roll, and then to remain where they are (still in mid-dash) with the intention of completing the assault next turn, or he may choose to abort the assault and immediately withdraw the troops as if they had failed the reaction test.

[Note that Final Defensive Fire may ONLY be carried out if the defenders have taken and PASSED their confidence test to stand and face the assault - if they fail this test, they withdraw without firing.]

> **Boxed rule summary:** If attackers do not make distance in first action, defenders may fire - reaction test to fire if suppressed (TL = no. of suppressions).
> Fire only has effect if casualties inflicted - then attackers must test reaction at TL of +1 per casualty; if failed, abandon assault and withdraw (also suppressed). If passed, roll combat move for second action.

### TERROR EFFECTS: (p.43)

As mentioned above, if the attacking troops have a TERROR EFFECT on the defenders, this DOUBLES the Threat level used by the defenders when rolling to see if they can stand and face the charge.

An attacking unit has a Terror Effect if it contains either weapons or troops that instil great fear into their opposition - this includes FLAME/INCENDIARY weapons, units with reputations for especially vicious hand-to-hand combat (eg: screaming Gurkhas brandishing sharp implements) and spiky acid-dripping alien thingies - or even units with psychological weapons such as bagpipes....

Units with a Terror Effect should be agreed between players or specified by the Umpire before the game, to avoid any disputes as to what is or is not valid — the effects will naturally depend on the type of troops on each side.

### COMBINED CLOSE-ASSAULT ACTIVATIONS: (p.43)

The mounting of a Close Assault attack is the only time in normal play where TWO (or more) units may actually be activated SIMULTANEOUSLY without needing transferred activations from a higher command unit.

If a player has two or more units near enough to a single enemy unit's position that both can carry out Close Assaults, and he wishes both (or all) of these units to make a COMBINED Assault on the one enemy unit, this IS permissible. Each of the units attacking must make their Reaction tests separately; if one or more fail their tests, the player may at his discretion abort the Assault, or continue with just the units that passed their tests.

The Close Assault is played through just as for a one-on-one attack, but at each step that tests are required each involved unit tests separately. If at any point PART of the attacking force falls back due to a test result, the player must again decide whether to break off altogether or continue — if he continues after one of his units has withdrawn, the remaining unit(s) must add an extra +1 to the Threat Level of any further tests they make in this Assault.

> **Boxed rule summary:** Two or more units may be activated together for a combined assault. If one fails to assault or breaks off, others have threat level of +1 in all further tests.

[Illustration on this page: pencil drawing of a soldier lunging forward with a rifle, no rules content.]

### OVERRUNS AND FOLLOW-THROUGH ATTACKS: (p.43)

If a Close Assault action ends with the Defending unit withdrawing (or destroyed), the Attacking player may choose to use a special option — the FOLLOW-THROUGH move. Instead of occupying the recently-vacated enemy position, he may overrun it and then attempt to continue moving his victorious unit(s).

To make a Follow-Through move, the player must immediately make a Reaction test for his unit (or units) that have just won the Assault. The Threat level is +1 if the defending units were completely destroyed, or +2 if they pulled back. If the player passes this test, he may then immediately make an EXTRA MOVEMENT ACTION with that unit, moving through the captured position and pursuing the retreating enemy. This action may ONLY be rolled as Combat Movement.

Such a Follow-Through action may of course bring the unit into contact with the retreating enemy defenders again, and commence yet another Close Assault combat.

> **Boxed rule summary:** After successful close assault, attacker may make immediate extra combat move action through position just taken, if desired.

---

## Chapter 16: OFF TABLE SUPPORT — printed p.44

**Introduction (unheaded, top of page):**
Off-table support covers Artillery fire from gun or launcher batteries located far behind the battle area (and sometimes even from orbiting starships), or support from Aerospace assets (Ground-attack craft or VTOL Gunships) that appear over the table to make their attacks.

The procedures for requesting either Artillery or Air support are detailed below; both make use of the INBOUND CHART to record exactly what is approaching the table area and when it will arrive.

This chapter also includes details of how the Inbound Chart is used to record the approach and arrival of other units such as troop-transport air assault missions and even ground reinforcements.

### ARTILLERY SUPPORT: (p.44)

When we are dealing with a small-unit action such as SGII is intended to simulate, it is very unlikely that a player's on-table forces will include any artillery or similar indirect-support assets (the only exception to this might be if playing a very large game with full Company-sized forces, where it is possible that the Company's "organic" support units — a RAM mortar section for example — might actually be depicted on-table). In general, most fire support will be assumed to come from off-table artillery (or even Orbital assets) which are organised and controlled at a much higher command level than the units on the table.

### CALLING FOR ARTILLERY FIRE SUPPORT: (p.44)

Requests for Artillery support may be made either by dedicated forward-observer elements, or by any squad leader or higher command level officer. Any call for support, whoever it is from, requires an action to be spent on communicating the request and a die roll for whether it is successful or not — success in this case means that i) the call actually gets through to the support battery, ii) the message is understood and the fire co-ordinates relayed correctly, and iii) the support battery is actually available to provide support (ie: it is not already occupied supporting some other engagement).

The chance of success in a fire support request depends upon a number of variables: the leadership of the requesting unit or officer (the better he is, the more likely he is to get the message relayed correctly), the organisational level of the support battery (Company organic support units are much more likely to respond than Regimental-level artillery that may well be engaged elsewhere) and finally the importance/urgency of the request (everyone wants fire support, and the battery commander has to prioritise the requests as he sees best).

At the start of the game, each player is allocated a number of SUPPORT REQUEST counters; how you decide the number given to each player is either up to the scenario, or can be done by die roll (eg: roll a D6 for the number allocated to each player). These request counters may be "spent" when fire support requests are made during the game, to increase the chance of success for that request — basically, each counter spent will increase the die type used to resolve the fire request by one level. A player may commit as many request counters as he wishes to any attempt, or may use none; once all his counters are used he may still make support requests, but without any die type modification.

It should be noted that no matter how many counters are committed to a particular request, it may still fail — all you are doing is increasing your CHANCE of success. Whether the request succeeds or fails, any counters committed to it are still expended.

Requesting support fire works in the following way: the player rolls one die (starting with a basic die type of D8 and modifying as applicable), needing to exceed his own LEADERSHIP plus a fixed number (relevant to the type of support he is calling) for success. As with other Communications tests (see P.16), **decrease** the die type by one for every additional command level between the caller and the support unit — thus if a Platoon Commander was trying to call for support from a battery organised at Company level, there would be no die shift for this as it is only one command level difference — there are no extra levels between them. Similarly, if a SQUAD leader was calling for fire from the same battery he would shift down one die (to a D6) to allow for the bypassing of the Platoon command level. Similarly, if the Platoon commander was calling for support from Battalion level he would be bypassing Company command and shift down one die.

The die type used is shifted UP one for every SUPPORT REQUEST counter the player decides to commit to the attempt — thus if the Squad Leader in the above example REALLY needed the fire support desperately, the player might decide it was worth spending **two** of his counters to boost the die type from a D6 up to a D10.

If support is being requested by a special observer/liaison element dedicated to that particular battery or other support provider, then the request may be made without any modification for intervening command levels (as the caller is basically a cross-attached element from the support unit). For example, a Platoon command unit might be noted as having a dedicated observer from the Battalion artillery battery attached to it for a particular mission — this element may then call fire with a D8 roll rather than the D6 that the Platoon commander himself would have to use (plus the dedicated observer gets a lower score needed for success, as noted below).

The number that the player must exceed on his roll is the LEADERSHIP of the requesting unit, PLUS the applicable factor from the following list:

For Artillery support: +0 if called by Forward Observer dedicated to that support battery, otherwise +2.

For Orbital support: +3 if called by dedicated Orbital Liaison element, otherwise +6.

These factors are suggested for use in most games, and reflect how hard it will be for small force commanders to get the heavier forms of support; if you wish to adjust them to account for special circumstances in a particular scenario, then feel free to do so.

The player must nominate his intended target point as soon as the fire request is successful — this is done by placing an IMPACT MARKER on the table at the desired spot. To confuse his opponent as to the exact target of the fire mission, the player may place the marker FACE DOWN, at the same time placing two DUMMY markers (face down) elsewhere on the table; the "real" impact marker is not revealed until the time the fire mission arrives on the table. The intended impact point (and any false points marked by dummies) must be in clear line of sight of the unit that requests the fire mission.

> **Boxed rule summary:** Roll D8, shifted down one type per command level bypassed and up one type per SUPPORT REQUEST chit.
> For success, exceed LV plus:
> Artillery support: +0 with Forward Observer, otherwise +2.
> Orbital support: +3 with Orbital Liaison, otherwise +6.

### REQUESTING AIR SUPPORT: (p.44)

Calling for Air Support uses the same rules as given above for Artillery Support. Unless the scenario states that air assets will arrive at a given time, they must be requested through command channels, spending Support Request counters if required; if a request is successful, then the air assets will approach the table via the INBOUND CHART exactly as for a fire mission.

To successfully communicate a request for air support the player must exceed the LV of the requesting unit, +2 if the request is made by a dedicated Air Liaison element, otherwise +4.

The same modifiers to the die type used apply as for Artillery fire, and as aerospace assets are generally organised at a fairly high command level it is likely that the player will need to spend a number of support request counters to have any real chance of being granted air support.

Once the craft appear on-table they move and attack subject to the Aerospace Operations rules in chapter 18.

> **Boxed rule summary:** Air Support as Artillery, except +2 with Air Liaison, otherwise +4.

### THE INBOUND CHART: (p.44, continues p.45)

On P.72 you will find a chart which you may photocopy (preferably onto thin card); this is the INBOUND CHART, and it is used for recording the movement and location of any units and/or support fire missions that are approaching the battle area represented by the table.

For each unit or support mission that is "inbound" towards the table area, a counter is placed on the chart and moved at the end of each game-turn, in accordance with the rules below. At the centre of the chart is a box labelled BATTLE AREA — this is the actual tabletop, and any counters that are moved into this area are deemed to have arrived at the table edge; they may then enter play on the following game turn. Outside the Battle Area are two sets of boxes, one for each player (or team) in the game; each player's side of the chart consists of a track of three boxes labelled 1 to 3 (with 1 nearest the Battle Area, and 3 furthest away) and a separate box labelled "LOITER". The three numbered boxes represent how many turns it will take for the inbound unit or mission to arrive at the area of the tabletop, while the LOITER box is used as a "holding area" for units that are in the vicinity of the battle area but not actually to be committed to the table yet.

Counters are placed on the Inbound Chart whenever:

i) an on-table unit calls (successfully) for any kind of off-table support mission, such as artillery fire or orbital fire support. In this case a counter representing the inbound fire mission is placed on the chart, in whatever numbered box represents the time the fire will take to arrive on-table (eg: support fire from a dedicated mortar unit fairly close by would be placed in box 1, as it will take only one turn to arrive, but orbital fire support would be placed in box 3 because of the long time such fire takes to reach the table);

ii) any ground or airborne unit is moving towards the table, either as scheduled reinforcements or in response to an on-table call for air support — again, the box in which it is placed depends on the time it will take to reach the table — this may either follow the general rules below or may be determined by the scenario being played.

At the end of each full game turn, during the TURN END PHASE, both players move any counters currently on the Inbound Chart — each counter is moved ONE box closer to the "Battle Area", irrespective of what the counter represents. Counters that are newly placed on the chart are still moved up at the end of the turn they were placed. Whenever a counter is in box 1 at the start of the Turn End Phase, the player may have the option to shift it across to the LOITER box INSTEAD of moving it onto the Battle Area circle; this is only permitted if the counter represents a UNIT (ground or air) rather than a fire support mission — incoming fire missions must automatically be moved onto the Battle Area when they reach it. The use of the LOITER box represents a ground or air unit being told to hold position just outside the battle area and wait to be called in; once moved to this box, a counter is NOT moved onto the battle area until it is called by a successful COMMUNICATION from an on-table unit — once called in this way, the counter is immediately moved onto the Battle Area — the unit is assumed to then be on the table edge and may then be activated in that same turn like any other unit.

An AIRBORNE unit has to run the gauntlet of the enemy's AIR DEFENCE ENVIRONMENT (if any) before it may enter the table — this is checked for once only, at the point that the unit moves either from box 1 or the LOITER box into the Battle Area. At this point, it must immediately roll against the ADE (see P.48) to find out if it successfully penetrates the anti-air defences in the general vicinity of the tabletop. If the unit survives this, it will appear on the table edge as normal; if not it may either have to abort its mission or may actually be destroyed.

> **Boxed rule summary:** Counters on Inbound Chart move 1 box in Turn End Phase. May appear on table after reaching box 1.
> Airborne units roll vs. ADE on entering table. LOITERING units need successful comms roll to enter table.

It is quite permissible (and great fun!) to use DUMMY counters on the Inbound Chart, to confuse your opponent as to exactly what (if anything) is really approaching the table. If dummy counters are used then ALL counters on the chart should be inverted right up until they are moved into the Battle Area circle, when they should be flipped over and any dummies removed. Dummy counters can be placed in the LOITER box if desired, and left there just to worry the hell out of your opponent!

---

## STARTING POSITIONS ON INBOUND CHART: — printed p.45

Whereabouts on the Inbound Chart you actually start off depends on what the counter represents, and where it is located in relation to the Battle Area. A lot of this is down to the scenario and should thus be left to the decision of the umpire, but the following are provided as general guidelines:

Fire support missions from batteries in direct support of the tabletop forces (eg: from a Company Mortar Battery) will be on fast response — their mission counters should be started from box 1, as the fire will take only a short time to arrive. Fire from larger batteries organised at higher command levels, will have slower response times (and longer actual flight times, as the guns will often be tens of kilometres away); fire missions from Battalion level guns should start in box 2, and from Regimental or higher in box 3.

Orbital fire support, when available, should always start from box 3 due to the very long response time — the fire has to travel a LONG way!

For actual units, including ground reinforcements and air support, the starting box depends entirely on the scenario. Units may even start in the LOITER box at the beginning of the game, representing reserve forces held just off-board or air support craft stooging around in a "cab rank" awaiting target information. If reinforcements arriving at random are part of the scenario, you can always roll a D6, halve the result and put the unit on the indicated box.

Casevac units (see P.54) also use the Inbound Chart, and may either have to be called in from a distance or be in the LOITER box already according to the scenario.

### UNITS LEAVING THE BATTLE AREA: (p.45)

If any unit (eg: Casevac or troop-carrying units) needs to return to its base to load, offload or re-arm during the game, the scenario should specify how far out along the Inbound track it must be moved before it reaches its base; its down-time on the ground should also be agreed, according to what it is doing (refuelling and re-arming a gunship or strike craft will generally take longer than unloading a few casualties from a Casevac ship). Units leaving the table move outwards on the track at the same one box per turn as they do when approaching the table.

Air units leaving the table should have to roll against the ADE on their way from the Battle Area to box 1, in the same way as they did when approaching. We suggest, however, that for this roll the ADE is counted as one die type LOWER than usual, as air defences tend to concentrate their attention on things coming in rather than leaving.

### THE TURN TRACK: (p.45)

Along one side of the Inbound Chart we have printed a numbered track labelled the TURN TRACK. This is there for you to record how many game turns have elapsed, by moving a counter along the track one space in each Turn End Phase — we have provided one "TURN" marker on the counter sheets for this. The use of the Turn Track is NOT essential for most games, but you may find it useful for use in certain scenarios — especially if something has to happen at a particular point in the game. If any such special events are scheduled by the scenario (or crop up during play and require a number of turns' delay), we suggest allocating one of the lettered counters to the event, noting down what it represents and placing this counter on the turn track at the relevant point. When this turn is reached, you will be reminded that an event is due to occur.

[Illustration on this page: pencil drawing of two power-armoured troopers advancing past a wrecked vehicle, no rules content.]

---

## Chapter 17: ARTILLERY FIRE — printed p.46

### ARRIVAL OF FIRE SUPPORT: (p.46)

Once a Fire Support mission has been successfully requested, a counter representing the mission is placed on the Inbound Chart (see P.44) in the relevant box for the time it will take to reach the battle area. If the counter is placed in box 1 to start with, this means the mission is an immediate-response one and will arrive during the SAME game-turn it was requested; if it starts at box 2 or 3 then it moves up one box per Turn End Phase as usual and is available on-table once it reaches box 1.

Unless specified otherwise for a particular scenario, fire from Company-level assets are immediate-response (start in box 1), missions from Battalion assets start in box 2 and from anything higher in box 3.

When the mission counter has arrived in box 1 then the player may choose to resolve the fire at any time during the turn, counting this as his activation (ie: in place of activating an on-table unit). If the player does not choose to bring the fire down before he has activated his last on-table unit he MUST then resolve it before the Turn End Phase.

### FIRE SUPPORT ACCURACY: (p.46)

When a fire mission arrives on-table, it may or may not hit exactly on its intended target point; the chance of this depends on whether the observer who requested the fire mission is still able to see the target, and if he has specialised designation equipment to guide the fire in.

To determine the accuracy of the fire mission, the player rolls the QUALITY die of the unit that requested the fire. If the unit contains a specialised artillery observer with designation equipment (and can still see the impact point), the roll must exceed the Leadership of the unit; if this is not the case then the roll must exceed TWICE the leadership of the requesting unit.

If this roll is successful, the fire mission arrives on the point indicated by the Impact Marker — if not, then note the ACTUAL score rolled on the die and then follow the DEVIATION procedure below:

Roll two dice: one will be a **D12**, which gives the **DIRECTION** of deviation (using the standard clockface method); the second die is a **D8**, and gives the **DISTANCE** of deviation. The score of the second die is then MULTIPLIED by the actual score rolled on the (failed) accuracy test above — thus if a unit with LV 2 scored a 2 for the fire accuracy roll — not enough, as 3+ would be needed for success — then the Distance die score is multiplied by 2. The final result of this is the number of inches the fire deviates, in the direction shown by the D12 roll, and the Impact Marker is moved to this new position before resolving the effects of the fire.

**Worked example (in text):** It will be noted that using this system, it is remotely possible that a mission could have a VERY large deviation distance — for instance if fire is called by a unit with an LV of 3 and the player rolls a 6 (not enough for accuracy - he wants 7 or better) then his distance of deviation roll will be multiplied by SIX — if he rolls a high number on the D8 and the direction die is back towards his own troops he could be in DEEEEP trouble..... but hey, that's what Friendly Fire is all about!

> **Boxed rule summary:** Roll Quality die of observer; if specialist AND can see target, exceed LV for accuracy; if not, exceed 2xLV.
> IF INACCURATE, roll D12 for direction and D8 for distance - multiply distance by score rolled in accuracy test.

[Illustration below this box, at the bottom of the left column (the only illustration on this page): pencil drawing of a tracked vehicle, hull number "17" visible, carrying a large single rocket/missile body on its rear deck, with camouflage netting draped over its front cab and a blast/smoke burst visible in the background; no rules content.]

### MULTIPLE INCOMING ROUNDS: (p.46)

Fire missions may consist of a single incoming round, but are usually a salvo of several — one round per weapon in the firing battery (single rounds may be fired if desired, but this is to the firer's choice and should be noted down when the fire mission is requested — if this is not specified then assume a multiple round salvo). For multiple round missions a separate impact marker is used for each round; the first marker is placed on the main impact point as determined by the accuracy and deviation procedures, then a separate deviation roll is made for each of the other markers to see how far (and in which direction) from the first marker each round actually impacts. For these rolls, use the usual D12 clockface method for direction (with direction 12 being perpendicular to the firer's baseline table edge) and a D6 for distance in inches.

**Worked example:** a support battery of three light RAM mortars fires an unguided salvo mission of three rounds (one per tube in the firing battery); the usual deviation procedure is used to determine where the first impact marker is placed, which is where the first of the three rounds actually lands. The direction (D12) and distance (D6) dice are then rolled twice, for the other two rounds: the results are 9 on the D12 and 4 on the D6, so the second round impacts 4" left of the first, then 6 and 2 giving the last projectile an impact 2" short of the first round. This is a fairly close grouping, and the burst radii of the three rounds will overlap — thus unlucky figures could find themselves caught in two or even all three of the blasts.

> **Boxed rule summary:** First round hits impact point; for each other roll D12 (direction) and D6 (distance) for deviation from main impact point.

### DELIVERY SYSTEMS AND WARHEAD TYPES: (p.46)

The DELIVERY SYSTEM of a fire mission is the type of gun or launcher firing the rounds; these are divided into categories from SMALL to VERY LARGE as listed in the weapon types table below. The size of delivery system determines the BURST RADIUS of the warhead — the distance from the impact marker within which targets may be hit by the burst.

The WARHEAD TYPE determines the Impact Die type to be rolled for each figure or point target that may be hit — each different warhead listed below has an impact die specified for dispersed (infantry) and for point targets. Of course, if one burst catches both troops and vehicles in its radius then both dice will be used, one for each target type as appropriate.

GENERAL PURPOSE EXPLOSIVE rounds are "conventional" shells with moderate effect against all targets; ANTI-PERSONNEL or ANTI-ARMOUR SUBMUNITIONS are cluster rounds optimised for maximum effect against a specific target type. If APS or AAS rounds are to be used, this MUST be noted down when the fire mission is requested — if this is not done, assume all rounds to be GPE type.

**ARTILLERY WEAPON DATA:**

| DELIVERY SYSTEM | BURST RADIUS |
|---|---|
| SMALL (light mortars) | 3" |
| MEDIUM (medium mortars, light artillery) | 4" |
| LARGE (heavy mortars, field artillery) | 6" |
| VERY LARGE (superheavy artillery, area saturation weapons) | 10" |

**IMPACT VALUES**

| WARHEAD TYPE | vs. Dispersed (infantry) | vs. Point targets |
|---|---|---|
| GENERAL PURPOSE EXPLOSIVE | D8 | D8 |
| ANTI-PERSONNEL SUBMUNITIONS | D12 | D8 |
| ANTI-ARMOUR SUBMUNITIONS | D6 | D12x2 |

> **Boxed rule summary:** Delivery system type gives burst radius; Warhead type gives IMPACT against dispersed or point targets. If warhead not specified, assume GPE.

[Page ends here at printed p.46; the rest of Chapter 17 (casualties from artillery fire, on-table artillery) is not present in the supplied pages.]

---

## quickRefDisagreements

- **Chapter 15 material on p.43 is almost entirely absent from the quick reference.** The QR's CLOSE ASSAULT section (qr-p2) gives only the single boxed lines for "if attackers don't make distance" (Final Defensive Fire) and "after successful close assault... extra combat move" (Follow-Through), plus the multi-round Confidence-test line. It has **no equivalent at all** for: (1) the full Final Defensive Fire mechanics (the "free shot," the reaction test keyed to suppression count, and the restriction that FDF only applies if defenders passed their stand-and-face confidence test); (2) TERROR EFFECTS (what qualifies, doubling the defender's Threat Level, umpire arbitration); (3) COMBINED CLOSE-ASSAULT ACTIVATIONS (the only case of simultaneous multi-unit activation without transferred actions, individual per-unit reaction tests, and the option to abort vs. continue with a +1 TL penalty); and (4) the important qualifier on Follow-Through/Overrun that a **Reaction test is required first** (TL +1 if the enemy was destroyed, +2 if they pulled back) — the QR's line ("attacker may make immediate extra combat move action... if desired") reads as automatic and a programmer following only the QR would omit this reaction test entirely.
- **Artillery/Air support request mechanics (p.44) match the QR's boxed numbers exactly** (D8 base, shift down per command level bypassed / up per Support Request counter; +0/+2 Artillery, +3/+6 Orbital, +2/+4 Air) but the QR omits several mechanics a programmer needs: what a "successful" request actually represents (three conditions: message gets through, is understood/relayed correctly, and the battery is available); how SUPPORT REQUEST counters are allocated at game start (scenario-defined or D6 roll) and that a player may spend zero, some, or all of them (spent even on failure, and requests can still be attempted with none, just without die-type modification); the exception that a request routed through a *dedicated* observer/liaison element skips ALL intervening command-level shifts, not just the ones for its own bonus; and the impact-marker placement mechanic (placed face down with two dummy markers, target must be in LOS of the requesting unit, real marker only revealed on arrival).
- **The entire INBOUND CHART / TURN TRACK / STARTING POSITIONS / UNITS LEAVING THE BATTLE AREA system (pp.44-45) is not mentioned anywhere in the two-page quick reference.** This is a complete game subsystem (a physical/virtual track with boxes 1-3, a LOITER box, per-player tracks, Turn-End-Phase movement of one box, the LOITER-vs-Battle-Area choice restricted to units, the one-time Air Defence Environment roll for airborne units entering play, dummy-counter bluffing, scenario-driven or default (Company=box1/Battalion=box2/Regimental+=box3, Orbital=always box3) starting positions, the D6-halved random-arrival rule, and the rule for units leaving the table (ADE roll one die type lower)) that a programmer relying solely on the QR would miss completely.
- **FIRE SUPPORT ACCURACY (p.46) matches the QR's boxed rule exactly** (Quality die vs. LV or 2xLV; D12 direction / D8 distance deviation multiplied by the actual failed roll), and the QR's worked-example numbers are consistent with the rulebook's own inline example (LV3 unit rolling a 6, needing 7+, multiplier of 6). No numeric disagreement, but the QR omits the illustrative "friendly fire" example's specific mechanic of the multiplier deriving from the *actual rolled score*, not the shortfall — this is stated in both but easy to mis-implement (e.g., as needed-minus-rolled instead of the rolled value itself) without the worked example.
- **MULTIPLE INCOMING ROUNDS (p.46) matches the QR's boxed rule exactly** (D12 direction / D6 distance for each additional round, deviating from the first round's impact point), confirmed further by the fully worked three-mortar example on p.46 (D12=9, D6=4 → 4" left; D12=6, D6=2 → 2" short) which the QR does not include.
- **DELIVERY SYSTEMS AND WARHEAD TYPES table (p.46) matches the QR's tables exactly**, cell for cell (burst radii 3"/4"/6"/10"; impact values D8/D8, D12/D8, D6/D12x2), with only a cosmetic difference — the rulebook's VERY LARGE category is described more fully as "superheavy artillery, area saturation weapons" versus the QR's "superheavy artillery" — not a rules disagreement.

<details><summary>Checker's corrections</summary>

Checked line by line against sg-p44.png (printed p.43), sg-p45.png (printed p.44), sg-p46.png (printed p.45) and sg-p47.png (printed p.46), with additional 1.5x–2x pixel-level zoom crops made for this check on the TERROR EFFECTS paragraph, the artillery/orbital modifier list, the FINAL DEFENSIVE FIRE paragraphs, the COMBINED CLOSE-ASSAULT ACTIVATIONS and OVERRUNS boxes, and the bottom of p.46 (to settle how many illustrations actually appear there and where). The first reading was very faithful on numbers, dice, thresholds and tables — no die type, threshold, range, count or table cell was found to be wrong anywhere in the chunk — and the worked examples (fire-deviation "DEEEEP trouble" example and the three-mortar salvo example) were both transcribed in full and match the source verbatim. Three corrections were needed, all in surrounding prose/illustration description rather than in numeric rules content:

- **TERROR EFFECTS paragraph (Chapter 15, p.43) — was a paraphrase that lost the book's actual examples — now transcribed verbatim.** The first reading gave: "designer's examples given are flame/incendiary weapons, troops with reputations for especially vicious hand-to-hand combat, alien creatures, and even psychological weapons such as bagpipes (the last three examples are flavour/humour)." The page actually reads: "this includes FLAME/INCENDIARY weapons, units with reputations for especially vicious hand-to-hand combat (eg: screaming Gurkhas brandishing sharp implements) and spiky acid-dripping alien thingies - or even units with psychological weapons such as bagpipes...." The paraphrase dropped the specific "(eg: screaming Gurkhas brandishing sharp implements)" example and rewrote "spiky acid-dripping alien thingies" as generic "alien creatures," and it added an editorial aside ("the last three examples are flavour/humour") that is not in the book and reads as the digest author's commentary rather than a transcription. Replaced with the exact printed wording.
- **Artillery/Orbital support modifier list (Chapter 16, CALLING FOR ARTILLERY FIRE SUPPORT, p.44) — was presented as a two-column markdown table — now given as the two-line prose list actually printed on the page.** The page does not print a ruled/bordered table at this point (that only happens for the separate boxed rule summary, and for the real tables in Chapter 17); the "For Artillery support: ... / For Orbital support: ..." factors are plain body-text lines with hanging indentation, not a table. The content (the +0/+2 and +3/+6 figures) was correct in the first reading; only the invented table structure was removed, to avoid implying the source page contains a table it does not.
- **Duplicate/invented illustration note on p.46 — the first reading described two different illustrations where the page has only one.** It gave one vague illustration note ("pencil drawing of a tracked artillery/rocket vehicle firing") right after the FIRE SUPPORT ACCURACY box, and then a second, more detailed note ("pencil drawing of a tracked multiple-rocket-launcher vehicle (hull number "17" visible) with camouflage netting") at the very end of the page, after the DELIVERY SYSTEMS box. A pixel-level check of the full bottom half of the page shows there is only ONE illustration on p.46, at the bottom of the left column (immediately below the FIRE SUPPORT ACCURACY box, before the right column's MULTIPLE INCOMING ROUNDS even begins): a tracked vehicle, hull number "17," carrying what reads as a single large rocket/missile body (not multiple launcher tubes) on its rear deck, with camouflage netting over its front cab, and a blast/smoke burst visible in the background. Removed the duplicate note at the end of the page and corrected the single remaining note's description and its "no rules content" framing to match what is actually drawn.

Everything else — every rule, condition, worked example, table, boxed summary, die type, threshold and page citation in the chunk — was checked against the scans and confirmed correct as first transcribed; no rules content was found to be missing, invented, or misplaced beyond the three items above.

</details>

---

# Chunk 16 · pp. 47–50 · 17 Artillery fire (end), 18 Aerospace operations

Source images: sg-p48.png (printed 47), sg-p49.png (printed 48), sg-p50.png (printed 49), sg-p51.png (printed 50).

**Chapter note:** printed page 47 (sg-p48.png) is the tail end of **Chapter 17, ARTILLERY FIRE** — it is included here only because it is on the assigned scan page, not because it belongs to Chapter 18. **Chapter 18, AEROSPACE OPERATIONS**, begins on printed page 48 and runs through printed page 50, where the text is cut off mid-sentence ("...then the player owning the VTOL must roll the") continuing onto printed page 51, which is outside this chunk and not transcribed here.

---

## [Ch.17 spillover] CASUALTIES FROM ARTILLERY FIRE (p.47)

Any figure caught within the burst radius of an artillery fire impact may become a casualty; the chance depends on the figure's level of protection (armour and/or protective cover) and the type of warhead used. Each different type of warhead has two different IMPACT DIE types, one used against dispersed (infantry) targets and the other against point (vehicle/building) targets. For each figure caught in the burst radius, make an opposed roll: the firing player uses the relevant Impact Die for the warhead type, and the target player rolls his figure's Armour Die (with die type shifts for cover if appropriate). If the firer's roll EXCEEDS the target's roll, the figure is WOUNDED and marked with a white skull counter; if it is more than double the target's score then the figure is DEAD.

If a particular figure is caught in overlapping burst radii from more than one warhead, make an opposed roll separately for each burst the figure is endangered by — a figure may escape injury from one burst but be hit by another (a figure that takes more than one WOUND is considered DEAD).

Point targets (vehicles etc.) caught in explosive burst areas roll their Armour vs. the Impact of the explosion (against point targets), as if taking a MINOR HIT from a direct-fire heavy weapon.

Figures protected by cover get the same bonuses as for other fire, ie: shift their armour die up one die type for soft cover and two dice types for hard cover. As usual, note that some cover is protective from all directions (eg: foxholes) while other types such as walls or ridges protect only from certain directions — if troops are hiding behind a wall and a round impacts BEHIND them, they are not going to be able to claim any cover from the wall.

Note that if ANY of its members are caught in the burst area of an explosion, whether or not they are actually injured, a unit becomes SUPPRESSED.

> Boxed summary: "Roll for ALL figures/vehicles in burst area — if bursts overlap roll for each one. Opposed roll Impact vs. Armour, wound/kill as for small arms, usual cover modifiers. All in burst area are SUPPRESSED." / "Vehicles roll Impact vs. Armour as for MINOR HIT."

**Worked example ("> Artillery Fire Effects", accompanying a diagram of a building, a wall, troopers A/B/C/D, and impact points X, Y, Z):**
"Three rounds of artillery fire impact at points X, Y and Z. Shell X would have affected trooper A, but he is completed [sic, printed thus — evidently intended "completely"] shielded by the building. Shell Y catches all four troops in its burst, but they each get the benefit of HARD COVER from the wall they are behind. Shell Z only catches figures C and D in its burst radius, but they do NOT get any cover benefit as the impact point in [sic, printed thus — evidently intended "is"] on their side of the wall. A and B therefore roll once each with HARD COVER die shifts, while C and D roll once with the cover AND once without."

## [Ch.17 spillover] ON-TABLE ARTILLERY FIRE (p.47)

The vast majority of Artillery fire comes from off-table support batteries, but occasionally artillery weapons form part of a player's on-table forces — most likely Company-level mortars or similar, unless the scenario is about an attack on a firebase or artillery position, in which case bigger weapons could be in play.

Any artillery weapon can theoretically be fired directly at a visible target, over "open sights" — treat this as a normal artillery fire mission, with immediate response time and without needing a fire request, since the weapon's own crew is controlling the fire. Gun-type artillery may engage any visible target this way, but Rocket artillery (MRLs) and mortars have minimum ranges below which they may not fire: **24" for light mortars** and **48" for all other weapon types**.

When dicing for accuracy of fire aimed directly at visible targets, use the normal accuracy and deviation procedure as if the fire were being controlled by a specialist observer — but if the fire is inaccurate, do NOT multiply the deviation distance roll by the number on the accuracy die; simply use the deviation distance roll as it stands.

On-table artillery pieces may be fired singly (each weapon activated as a separate unit) or in a battery salvo (the whole battery activated as one unit), player's free choice, as long as each weapon fires only once per turn. One shot by an on-table artillery weapon takes TWO actions: one for the crew to observe and designate the aim point, the second to fire.

No artillery weapon may fire and move in the same activation. Towed or manpacked artillery (ie: anything not on a self-propelled carriage) "must have at one REORGANISE action" [printed exactly thus — apparently a typo for "at least one"] used to deploy them before firing or to re-pack them ready for moving off.

If on-table artillery is required to fire at a target not visible to its own crew, this is treated exactly as off-table fire and requested the same way, by a unit that can see the target point. If the artillery and the observing unit are under the same overall command level, the fire is treated as an immediate-response mission if the request succeeds. If the fire is requested by the on-table command level that actually controls the artillery unit, only a simple inter-unit communication test needs to be passed, after which approval of the fire request is automatic (eg: a Company command unit directing fire from its own "organic" mortar battery).

---

## AEROSPACE OPERATIONS — Chapter 18 header (p.48)

## AEROSPACE AND ANTI-AIR OPERATIONS: (p.48)

In small-unit combat such as SGII is meant to simulate, the use of on-table airborne units is restricted to VTOL craft used for inserting or evacuating troops, and maybe the occasional fire-support gunship in certain scenarios. Any more extensive air support operations, such as bombing missions by ground attack craft, are dealt with as off-table support in the same way as artillery (designer scoping note).

All air vehicles actually appearing on table are assumed to be operating at low altitude, and are classed simply as either "airborne" or "grounded" — there are no distinctions between different height levels.

In most cases, anti-air defence for on-table forces is also of a very limited nature; some units may carry missiles with AA capability (some advanced anti-armour missiles can perform a dual role against low-flying air targets), and there may be a few light AA cannons on some vehicles or installations, but anything heavier is almost always part of the general off-table support assets.

Assuming an enemy force has access to any AA weaponry at all, there is always the possibility that any air vehicle heading for the game-table area will come under air attack along the way, and may therefore be forced to abort or even be shot down before actually reaching the table. This is handled by the AIR DEFENCE ENVIRONMENT rules below.

Cross-reference: the rules for requesting Air Support are given in the chapter on OFF-TABLE SUPPORT on P.44.

## THE AIR DEFENCE ENVIRONMENT: (p.48)

Whenever airborne or interface elements are called to appear on-table, they must first successfully penetrate the AIR DEFENCE ENVIRONMENT in the region of the battle area; this is an abstract representation of the amount of anti-air protection the opposing forces can put up in that area, covering all factors such as specific anti-air weapons, combat air patrols (interceptors) and AA-dedicated electronic warfare. The ADE is represented by a die type, according to the level of AA coverage:

| ADE level | Description | Die |
|---|---|---|
| MINIMAL ADE | no more than a few ground-fired light AA cannons, common with low-tech forces | D4 |
| LOW ADE | a few dedicated weapons such as shoulder-fired AA missiles and some vehicle-mounted flak guns | D6 |
| MODERATE ADE | medium-tech forces with reasonable AA equipment and some air cover of their own | D8 |
| HIGH ADE | heavily-defended area with advanced AA weapons and electronic warfare capability | D10 |
| EXTREME ADE | massive AA defences: laser systems, ultra-tech missiles, fighter superiority etc. | D12 |

There may be scenarios with **NO ADE at all** — eg: where the enemy is an isolated group of partisans or terrorists with nothing but small arms; there is no need to test for ADE effects on incoming aircraft in this case, since firing small arms at air vehicles is so ineffective it doesn't count as AA fire. This is unusual, however; normally at least a MINIMAL ADE should be assumed where the enemy is any kind of organised military force.

The level of ADE for each side should normally be specified when the scenario is designed, per the size/technology of the forces and the overall military situation. For hastily-created one-off games without a full scenario, the suggested default is **LOW ADE (D6)** for both sides to actively encourage use of airborne forces, or **HIGH ADE (D10)** to discourage it.

## EFFECTS OF THE AIR DEFENCE ENVIRONMENT: (p.48)

The ADE takes effect when an air vehicle attempts to leave box 1 (or the LOITER box) on the INBOUND CHART (see P.44) and enter the table area. Resolution is a two-stage process using two separate opposed rolls against the ADE die type.

1. **Acquisition roll:** the ADE die is rolled against the air vehicle's ECM systems die type (default D4 if the vehicle has no ECM suite). ADE is the "firer", the air vehicle the "target" — the ADE roll must BEAT the ECM score to have an effect. If it succeeds, the aircraft has been "acquired" by the air defences; the owning player may ABORT voluntarily or press on. The pilot must then take a **REACTION TEST at threat level +2**; if failed, the aircraft is forced to abort — its marker is removed from the inbound chart and it returns to base, mission abandoned.
2. **Shoot-down roll:** if the pilot passes the reaction test (or presses on), a second opposed roll is made, ADE die vs. the aircraft's ARMOUR die; if the ADE wins, the aircraft is shot down and lost before reaching the table. If the ADE fails, the aircraft may enter the table on the next turn as per the Inbound Chart rules.

> Boxed summary: "When aircraft tries to enter table, roll ADE vs. ECM; if ADE wins, aircraft may abort voluntarily or be forced to abort if failing Reaction test at TL +2. If carrying on, roll ADE vs. ARMOUR; if ADE wins, aircraft shot down."

## EFFECTS OF ON-TABLE ANTI-AIR FIRE: (p.48–49)

Anti-air fire from on-table weapons is generally limited to the occasional shoulder-fired missile, though in some scenarios dedicated anti-aircraft vehicles or systems may appear.

To fire at an airborne target, the firing weapon must have a Fire Control system (or Guidance system for a missile). If the system is not specified as an AA-dedicated type, shift its die type **DOWN one** (eg: an AA-dedicated Enhanced fire control keeps D8, but an ordinary Enhanced FC without AA specialisation drops to D6). Multirole missiles suffer this same drop when fired at air targets, so an Enhanced-guidance missile gets only D6 against aircraft; specialised AA missiles use their full guidance die; ground-target-only (non-multirole) missiles cannot engage air targets at all.

**Acquiring the target:** a simple opposed roll — the weapon's Fire Control/Guidance die (modified as above) vs. the aircraft's ECM die type (default D4 if it has no ECM). If the FC wins, it has "locked on"; if not, it has failed to acquire and may not fire.

**Evasion:** once acquired, the pilot may try to break the lock-on. To do so he must immediately move the aircraft **AT LEAST 24"** as a normal air move action (including turning if desired), and roll his QUALITY die against another roll of the weapon's FC/Guidance die — if he exceeds the FC score he has broken the lock-on; otherwise the FC/Guidance still has the target. If the pilot moves to a position with no line of sight for the firing weapon, the lock-on breaks automatically. After moving, the aircraft's Activation marker is inverted — it may not do anything else that turn, though it may repeat the evasion procedure if attacked by another AA weapon.

**Firing:** if the pilot fails to evade (or chooses not to attempt it), the weapon may fire. Resolved exactly as ground-target fire, except the target (aircraft) uses its **ECM die type** as the Target Die regardless of weapon type. If the aircraft is HOVERING, reduce the ECM die by one type (an aircraft with no ECM, using the "default" D4, remains on D4).

**Hit effects:** roll effect as for any anti-vehicle fire (using the aircraft's Armour Rating):
- Any result less than a DISABLE forces the pilot to take a **CONFIDENCE TEST at threat level +2** — if failed, he must abort his mission and leave the table.
- A **DISABLE** result means the aircraft must make a controlled emergency landing (see below).
- A **DESTROYED** result means the aircraft is totally destroyed in the air; wreckage hits the ground at the same spot as an emergency landing, causing an explosion of **radius 6"**, with a **D8 impact** effect on anyone unlucky enough to be near it. All personnel aboard a destroyed air vehicle are killed.

> Boxed summary ("Firing on-table AA weapons"): "Step 1: Opposed roll to ACQUIRE - FC/Guidance vs. ECM. Reduce FC die one type if not AA-dedicated." / "Step 2: If acquired, pilot may evade - move 24"+, roll Quality vs. FC/Guidance to break lock-on." / "Step 3: If lock-on maintained, may fire: roll as for ground fire, vs. ECM die (shift down 1 die if HOVERING)." / "Result: Hit but no Disable = Confidence test at +2, abort if failed. Disable = emergency landing. Destroyed = crash." / "Landing/crash site D12x2" away if moving. For emergency landing roll pilot Quality: 1 = destroyed, 2-3 = crashland, occupants killed on D6 roll of 1, wounded on 2-3. Quality roll 4+ = safe landing."

## Emergency landing procedure (p.49, unheaded continuation)

In the event of an emergency landing, if the aircraft is hovering it lands exactly where it is. If moving, roll a **D12 and double the score** — the aircraft impacts that distance (inches) directly ahead of its current position. On impact, roll the pilot's quality die:
- Roll of **1**: the aircraft explodes, as if DESTROYED (see above).
- Roll of **2 or 3**: it crash-lands — roll a **D6 for each occupant**, irrespective of armour type or anything else: **1** = killed, **2 or 3** = wounded, **4+** = get out safely.
- Roll of **4 or better**: the pilot makes a controlled landing and no-one on board is injured.

If the landing point means the aircraft collides with a solid object (a vehicle, building etc.), it is destroyed on impact and all aboard are killed. The object hit is in most cases also destroyed automatically, unless it is something very heavily armoured such as a bunker — in that case it is up to the umpire to decide what happens.

*(A full-page illustration of a jet aircraft trailing smoke, spiralling down in a crash, appears at the top of p.49; no caption text accompanies it.)*

## FACING OF AIR VEHICLES: (p.49)

Non-VTOL aircraft must always be facing exactly along their current line of flight.

VTOL craft must still generally face their direction of movement, but if hovering (ie: not actually moved in either action of its activation) it may be freely rotated to any desired direction without this counting as an action (eg: a hovering model may be swivelled to point any way while carrying out other actions such as spotting or firing).

A VTOL craft may move sideways or backwards while maintaining its current facing, but such a move may only be up to **12" per action**; this can be advantageous to keep weapons trained on the enemy while moving.

> Boxed summary: "VTOLs may rotate to any direction while hovering; can also move backwards/sideways at 12" per action. All other aircraft face direction of movement."

## AIR VEHICLE MOVEMENT: (p.49–50)

Airborne vehicles get two ACTIONS during activation, as for any other vehicle, but the use of these actions differs due to their very high speed.

For each action an air vehicle spends on-table, it must be in one of three modes: **MOVING, HOVERING or GROUNDED**. MOVING is available to ALL air vehicle types; HOVERING and GROUNDED are only possible for vehicles capable of vertical takeoff and landing (VTOL) operation, ie: helicopters, helijets, aerospace craft with vectored-thrust capability, and grav vehicles.

Each time an air vehicle is activated on-table, it may use one or both actions (if desired) to move ANYWHERE on the table, with the limitation that it must not change direction by more than **90 degrees** during one move action. Any actions not used for movement may be used to fire weapons, drop cargo/ordnance, or make spotting attempts. If an air vehicle is NOT capable of VTOL operation, it MUST use at least one action per activation to MOVE, and must move **AT LEAST 24"** in that action.

VTOL-capable vehicles have greater freedom: if such a vehicle does not move at all during an activation, it enters HOVERING mode (marked with the appropriate counter); if it moves in at least one of its two actions, it is still classed as MOVING. It takes one action for the vehicle to land, or become GROUNDED; this may be done from either Hovering or Moving state. Once grounded, VTOL craft may load/unload troops or cargo, and may still make spotting attempts as for any ground unit.

Grav vehicles differ from other flight-capable craft: they are effectively ground combat vehicles with a secondary flight capability — "grounding" a grav vehicle does not mean actually landing it, but rather dropping to a very low mode, skimming the ground like a GEV. Grav vehicles may move as normal vehicles while grounded (the basic mobility rates for Grav vehicles in the movement rules assume they are moving at ground-skimming height), whereas other VTOL craft may NOT move once landed — unless they have wheeled landing gear and are on a good paved surface (road or runway), in which case they may taxi at **6" per action**.

> Boxed summary: "Air vehicles may move anywhere on table, but only one turn of up to 90 degrees per action. Non-VTOLs must move in 1 action, at least 24". If a VTOL craft does not move in either action, counts as HOVERING. Landing takes 1 action."

## FIRE FROM AIRBORNE VEHICLES: (p.50)

Weapons mounted on airborne and aerospace craft may be of four types: **TURRETTED, FIXED, DEADFALL or GUIDED**.

**TURRETTED** weapons (such as chin-turret guns on VTOLs and helicopters) are generally assumed to have a **180 degree field of fire** — for a chin turret this is the forward 180° arc. As turrets may be differently positioned on different models, it is up to the players to agree valid arcs of fire for each model before the game. "Door guns" are also classed as turretted weapons, usually with a 180° field of fire to the side of the craft they are mounted on. Unless players specifically agree otherwise for a particular model, no turretted weapon (while airborne) can fire at a ground target closer than **6" from the centre of the craft's stand** — the weapon cannot be depressed far enough. Weapons mounted UNDER the craft (eg: chin guns) may NOT fire when the craft is grounded, but door or other mounts may do so with their usual fire arcs.

**FIXED** weapons are rigidly mounted to fire straight ahead only (or rearwards in some cases). Such weapons may only engage targets falling in a **6" wide "fire corridor"** directly in front of the craft, per the model's actual facing. If the craft is a VTOL or helicopter, any target in this corridor may be shot at provided it is **over 12"** from the craft's stand, since such vehicles may dip their noses to bring fixed weapons to bear on fairly close targets; for non-VTOL aerospace craft, which cannot do this in flight, no target closer than **24"** may be engaged. Fixed weapons may NOT be fired while grounded.

**DEADFALL** weapons are simple "dumb bombs" dropped from the point at which the model is currently standing. They always impact directly along the flight line of the craft (ie: straight in front of the model). When one is dropped, roll a **D6** and place the impact marker that many inches directly in front of the craft's stand. If the player wishes to drop more than one deadfall weapon, he may (all counting as just one action):
- if all bombs are released together, roll a **separate D6 for each one** and place its impact marker accordingly, each measured from the aircraft's current position;
- alternatively, to drop the bombs in a "stick" spaced out along the flight line, roll a **D6 for each bomb in turn** and place each one's impact marker the indicated number of inches FURTHER ON than the last impact point.

**Worked example:** "if four bombs are dropped in a stick and the four rolls are, in sequence, 4, 2, 3 and 6, then the first bomb impacts 4" in front of the aircraft, the second 2" further on (6'" [sic, printed with a stray mark before the inch symbol] away in total), the next 3" further (9" total) and the last 6" on (15" total distance from the aircraft)."

If dropping deadfall ordnance from a HOVERING aircraft, the bombs simply impact directly under the craft. Deadfall ordnance cannot be used while grounded.

**GUIDED** weapons such as missiles and guided bombs may be fired at any target within the front **180 degree arc** of the firing craft; if the target is outside the front **90 degree** arc, however, the GUIDANCE die used for the weapon's hit resolution is shifted **DOWN one die type**, representing the extra difficulty of locking on to a target in the peripheral part of the field of fire. Guided missiles MAY be fired while grounded, but guided bombs may not.

> Boxed summary: "Turretted weapons fire in 180 degree arc, miminum [sic] range 6"." / "Fixed weapons fire straight ahead only, fire corridor 6" wide, minimum range 12" VTOL, 24" non-VTOL." / "Deadfall weapons fall along flight path, D6" in front of model; each bomb in "stick" falls D6" from last." / "Guided weapons fire in 180 degree arc, but shift Guidance die down 1 type if outside 90 degrees."

## SPOTTING FROM AIR VEHICLES: (p.50)

Any airborne vehicle may attempt to spot hidden inverted enemy counters the same way a ground unit does, using the same rules. One spotting attempt may be made per action used as such. To an airborne spotter, all areas of the table are generally considered in line of sight (unless players agree something is hidden by a particularly tall or unusual terrain feature); thus all counters NOT concealed in cover are automatically spotted by any airborne vehicle (but not revealed unless they are actually troop units). Counters hidden in cover must still be subject to individual spotting attempts, as by ground units.

*(Photo, captioned:)* "A squad disembarks from the first VTOL down on the LZ; a second troop carrier prepares to land while a gunship circles to provide fire support."

## LANDING ZONES: (p.50)

To land a VTOL-capable air vehicle on the table, it requires a suitable LANDING ZONE ("LZ"); for a safe landing, this area must be COMPLETELY clear of any kind of obstruction, whether terrain features (bushes, broken ground etc.), man-made objects or troop units. If there is any kind of minor obstruction* on the LZ, a landing may still be attempted but becomes more risky to the landing vehicle. Required LZ sizes are:

| Craft class | LZ diameter |
|---|---|
| Small craft (assault VTOLs, Gunships and such) | 6" diameter circle |
| Larger transport VTOLs | 12" diameter |
| VTOL-capable Interface Landers (orbital "Dropships") or other very big craft | 18" diameter |

*(Checker's note: on the printed page these three sizes are given as a single run of prose — "Required LZ sizes are a 6" diameter circle for small craft such as assault VTOLs, Gunships and such, 12" diameter for larger transport VTOLs and a full 18" diameter for VTOL capable Interface Landers (orbital "Dropships") or other very big craft" — not a bordered table; it is reformatted here as a table for clarity. All three diameters were verified correct against the page at zoom.)*

[It is up to the players to agree before the game exactly what class any VTOL craft fall into for this purpose, according to the actual models in use.]

If the LZ circle is completely unobstructed, a landing is assumed to always be safely made. If there is any minor obstruction such as vegetation, the edge of a hill or some broken terrain (or any troop figures, of either side), then the player owning the VTOL must roll the... *[text continues onto printed page 51, not included in this chunk]*.

*Note: the asterisk after "minor obstruction*" earlier in this section has no footnote visible anywhere within pages 47–50; it is presumably defined or explained on printed page 51 or later, outside this chunk.*

---

## Against the quick reference

The quick-reference pages (qr-p1, qr-p2) say essentially nothing about aerospace/anti-air operations beyond two passing mentions: the THREAT LEVELS FOR CONFIDENCE TESTS table's "Unit is under Artillery or Aerospace attack" row (+2/+1/+0 by mission motivation), and the ARTILLERY SUPPORT box's "Air Support: +2 with Air Liaison, otherwise +4" request modifier. Everything else in Chapter 18 is entirely new information relative to the QR — a programmer working only from the summary would be missing all of the following:

- **No Air Defence Environment mechanics at all.** The QR never mentions that airborne/interface elements must penetrate an abstract ADE die-type gauntlet (D4/D6/D8/D10/D12 by MINIMAL/LOW/MODERATE/HIGH/EXTREME) before ever reaching the table, nor the two-stage opposed-roll resolution (ADE vs ECM triggering a pilot Reaction Test at TL+2, then ADE vs Armour to shoot the aircraft down outright).
- **No on-table anti-air fire procedure.** The QR's fire-combat rules (multiple opposed roll, firepower/impact dice, etc.) are written for ground targets. It does not say that firing at an airborne target requires a Fire Control/Guidance die shifted down one type unless AA-dedicated, that the target rolls its own ECM die type (not a Range Die) as its defensive die, that hit resolution runs through an ACQUIRE roll and an optional pilot EVASION roll (24"+ move plus Quality vs FC/Guidance) before the shot is even made, or that a HOVERING aircraft's ECM die is shifted down one type when fired on.
- **No crash/emergency-landing subsystem.** Disable and Destroyed results on an aircraft (D12x2" landing/crash site, pilot Quality roll for destroyed/crash-land/safe landing, D6 occupant casualty rolls, collision-with-solid-object rules, and the 6"-radius/D8-impact explosion on a destroyed aircraft) have no counterpart anywhere in the QR.
- **No air vehicle movement/facing rules.** The QR's MOVEMENT section covers only ground troops and vehicles by Mobility Die; it says nothing about the MOVING/HOVERING/GROUNDED action framework, the 90°-per-action turn limit, the 24" minimum move for non-VTOL aircraft, VTOL free rotation while hovering, or the 12" sideways/backward hover move.
- **No weapon-mounting/fire-arc rules for airborne weapons.** The QR's generic weapons and fire-procedure tables carry no equivalent of the TURRETTED (180° arc, 6" minimum range while airborne)/FIXED (6" corridor, 12"/24" minimum range)/DEADFALL (D6" impact scatter, stick-drop rules)/GUIDED (180° arc, die-shift beyond 90°) distinctions.
- **No Landing Zone rules.** LZ size requirements (6"/12"/18" diameter by craft class) and the obstruction-risk mechanic are entirely absent from the QR.
- **Spotting from air vehicles** (automatic spotting of any counter not in cover, one attempt per action for counters that are in cover) is not covered by the QR's OBSERVATION section, which is written for ground-based observers only.

For the Chapter 17 spillover (on-table/casualty artillery rules on p.47): the QR's ARTILLERY SUPPORT box gives the off-table request procedure and the generic BURST RADIUS / IMPACT VALUES tables, but says nothing about: a whole unit becoming SUPPRESSED if *any* member is caught in a burst regardless of injury; point (vehicle) targets in a burst rolling Armour vs Impact as a MINOR HIT; separate opposed rolls being required per overlapping burst; or any of the on-table-artillery-specific rules (24"/48" minimum ranges for direct "open sights" fire, the two-actions-per-shot requirement, battery-salvo activation, the no-fire-and-move restriction, or the REORGANISE requirement to deploy/re-pack towed or manpacked pieces). A programmer building only off the QR would have a working off-table call-for-fire model but no on-table artillery unit at all.

<details><summary>Checker's corrections</summary>

Checked line by line against sg-p48.png (printed 47), sg-p49.png (printed 48), sg-p50.png (printed 49) and sg-p51.png (printed 50), including targeted 2x–3x pixel-zoom crops (made for this check) of every die-type table, boxed summary, minimum-range/measurement sentence, and both worked examples, cross-referenced against qr-p1.checked.md / qr-p2.checked.md for vocabulary.

**Content verified correct (no change needed) — the first reading was very faithful:**
- The full CASUALTIES FROM ARTILLERY FIRE and ON-TABLE ARTILLERY FIRE text (p.47), including the 24"/48" minimum ranges, the two-actions-per-shot rule, and the "> Artillery Fire Effects" worked example, which is quoted word-for-word including both printed sics ("completed" for "completely", "in" for "is").
- The ADE table: MINIMAL/LOW/MODERATE/HIGH/EXTREME → D4/D6/D8/D10/D12, confirmed at pixel zoom against every row on p.48.
- Both ADE-related boxed summaries and both on-table-AA-fire boxed summaries, checked word-for-word against their bordered boxes on p.48–50 (including the printed "miminum" typo in the FIRE FROM AIRBORNE VEHICLES box, correctly preserved and flagged as [sic]).
- All die-shift and threshold figures in EFFECTS OF ON-TABLE ANTI-AIR FIRE: FC/Guidance shift down one type if not AA-dedicated, ECM default D4, evasion move of "AT LEAST 24"", ECM shifted down one type when HOVERING, Confidence Test at +2 for a hit short of Disable, and the DESTROYED result's 6" burst radius with D8 impact — all confirmed exactly as printed, including the correct distinction the digest draws between the ADE section's REACTION test at +2 and the on-table-fire section's separate CONFIDENCE test at +2 (these are two different tests in the source, not a duplicate).
- The emergency-landing procedure's D12x2" distance and pilot-Quality/D6-occupant results (1 = destroyed, 2–3 = crash-land with D6 casualty roll, 4+ = safe landing).
- AIR VEHICLE MOVEMENT and FACING OF AIR VEHICLES in full, including the 90°-per-action turn limit, the 24" minimum move for non-VTOLs, the 12" VTOL sideways/backward hover move, and the 6" grav-vehicle/wheeled-taxi figure.
- FIRE FROM AIRBORNE VEHICLES in full: TURRETTED (180° arc, 6" minimum range), FIXED (6" corridor, 12" VTOL / 24" non-VTOL minimum range), DEADFALL and GUIDED (180°/90° arc, guidance die down one type outside 90°) — every number confirmed at zoom, including the deadfall "stick" worked example (rolls 4, 2, 3, 6 → running totals 4", 6", 9", 15" from the aircraft), which the digest transcribes exactly, including the stray-mark [sic] on "6'"".
- SPOTTING FROM AIR VEHICLES, the photo caption, and the LANDING ZONES obstruction rule and 6"/12"/18" diameter figures, all confirmed against the page (see note added below on the LZ figures' original presentation).
- The chunk's chapter-boundary note (p.47 as Ch.17 spillover, Ch.18 starting p.48) and the exact point at which p.50's text is cut off ("...then the player owning the VTOL must roll the"), both confirmed against the page images.

**Two corrections made:**
1. **Where:** "ON-TABLE ARTILLERY FIRE" (p.47), the sentence about towed/manpacked artillery needing a REORGANISE action. **Was:** "...used to deploy **it** before firing or to re-pack **it** ready for moving off." **Now:** "...used to deploy **them** before firing or to re-pack **them** ready for moving off." The printed page uses "them" (referring back to the towed/manpacked pieces), not "it"; the quoted fragment "must have at one REORGANISE action" itself was already correctly transcribed with its typo intact.
2. **Where:** "LANDING ZONES" (p.50), directly under the LZ-size table. **Was:** no note. **Now:** added a checker's note stating that the three LZ diameters (6"/12"/18") are given on the printed page as a single sentence of running prose, not as a bordered table, though the table's own figures were already correct; this is a transparency addition, not a factual fix.

No invented rules, no missing rules, and no mis-transcribed table cells or worked examples were found anywhere in the chunk. No text was illegible.

</details>

---

# Chunk 17 · pp. 51–52 · 18 Aerospace operations (end), 19 Electronic warfare

**Source images:** `sg/sg-p52.png` (PDF page 52 → printed page **51**) and `sg/sg-p53.png` (PDF page 53 → printed page **52**).

> **IMPORTANT — content/assignment mismatch.** The task brief for this chunk describes "Chapter 19 ELECTRONIC WARFARE ... and the start of Chapter 20 ADVANCED AND OPTIONAL RULES (reaction fire, surrender and taking prisoners, interrogation, the last stand …)." That is **not** what is printed on these two page images. What is actually printed is:
> - Printed p. 51 — the **tail end of Chapter 18, AEROSPACE OPERATIONS** (running header "18 AEROSPACE OPERATIONS"), continuing a rule from the (unsupplied) previous page, then the sections "Dropping Troops from Hovering Craft," "A Typical Air Mission," "High-Altitude or Orbital Insertion," and "Interface Landings from Orbit."
> - Printed p. 52 — only the **opening page of Chapter 19, ELECTRONIC WARFARE** (running header "19 ELECTRONIC WARFARE"), covering "Electronic Warfare, ECM and Jamming" in full (subsections i–iv) plus a boxed rules summary.
> There is **no** Chapter 20 / Advanced and Optional Rules material, no "reaction fire," "surrender," "interrogation," or "last stand" text on either page. Everything below is transcribed only from what is actually printed on these two images; nothing has been invented to match the expected chapter list.
> *(Checker's note: re-verified directly against both page images — confirmed correct. Page 51 ends with the Interface Landings from Orbit text and a photograph; page 52 ends with the EW boxed summary and an illustration; the page 52 footer is printed page 52 with no Chapter 20 heading anywhere on either page.)*

---

## Printed page 51 — Chapter 18, AEROSPACE OPERATIONS (continued)

*(Page opens mid-rule, continuing a landing-procedure paragraph begun on the previous, unsupplied page.)*

Continuing paragraph: "QUALITY die of the craft's crew - on a roll of 3+ the landing is made safely, but on a 1 or 2 there is a problem - the craft is safely down (with no injuries to crew or passengers), but will NOT be able to take off again for the rest of the game."

Footnote-style note: "[*Note: an area that is heavily obstructed - eg: by trees, buildings, enemy vehicles etc., is NOT a valid LZ.]"

> **Boxed rule:** LZ must be 6" dia. for small VTOLs, 12" for larger or 18" for Interface craft. If LZ obstructed, roll pilot Quality: 1-2 = disabled on landing.

### DROPPING TROOPS FROM HOVERING CRAFT: (p. 51)

"If a suitable LZ is not available, it is permissible for a troop-carrying VTOL craft to hover while troops either abseil down ropes or free-drop with jump or grav packs (if they have such equipment). If the troops are using jump or grav packs, a whole squad may be dropped in just ONE action of the VTOL's activation; if they are using ropes then it takes a full TWO actions to get one squad safely on the ground. During these actions the VTOL may not perform any other function. With either method of descent, roll 1 die (the QUALITY die) for each member of the squad being dropped - on a roll of 1 they have made a mistake (at best sprained an ankle, at worst impaled themselves on something!) and are treated as WOUNDED, just as if hit by enemy small arms fire. If the men are being dropped into difficult terrain such as thick woods or jungle, on hillsides or onto the roofs of buildings, then rolls of 1 or 2 will cause them mishaps."

"Troops may be free-dropped from a Grav vehicle in hover, but may NOT abseil from one - the grav lift field directly under the vehicle makes this too dangerous."

> **Boxed rule:** VTOL must be in Hover; roll quality for each man, 1 = accident. In dangerous areas, 1-2 = accident.

### A TYPICAL AIR MISSION (p. 51)

"A typical mission profile for a troop-carrying VTOL might go something like this:"

- **First turn:** one action to line-up for run onto the table (model placed on table edge at entry point), second action to move VTOL across table to an attack position.
- **Second turn:** one action to fire its chin-turret gun to suppress a ground target threatening the proposed LZ (Landing Zone), second action to move to area of LZ.
- **Third turn:** one action to land (VTOL is now GROUNDED on the LZ), second action for troops to disembark from grounded VTOL.
- **Fourth turn:** first action, VTOL lifts off; second action to move it off-table.

Designer's note/flavour (not transcribed in full): an italicised first-person combat-fiction vignette ("The Hog inserted us to the LZ just as dawn was breaking...") follows, dramatising the above four-turn insertion sequence as a squad is dropped into jungle terrain and moves out; it contains no additional rules content. *(Checker's note: re-read in full against the page image — confirmed this is pure narrative flavour text with no dice rolls, numbers, or mechanical statements; nothing rules-relevant was omitted by summarising it.)*

### HIGH-ALTITUDE OR ORBITAL INSERTION: (p. 51)

"Certain specially-equipped units (known as DROP TROOPS) may be "directly inserted" to the battle area by parachute, jump pack or grav pack from high-flying transports (termed "paradropping", whatever technology is used for the descent), or in ballistic entry capsules directly from an orbiting spacecraft."

"Only REGULAR units or better may be paradropped from in atmosphere, and only VETERANS or ELITES may drop from orbit."

"If dropped from within atmosphere, Line or Powered Infantry may be used; only infantry, infantry heavy weapons and Very Small (class 1) vehicles and equipment may be paradropped. Only Power-Armoured troops may drop directly from orbit."

"To simulate the random nature of the drop, take one of the LETTERED MARKERS to represent each UNIT of Drop Troops; now actually "drop" these markers from at least 36" above the table, over their intended target area (they should bounce nicely!) - where they end up is the centre of the drop zone for that unit. Any markers that bounce off-table represent units either killed by AA fire on the way down, or else missing the drop area completely - either way they are "lost" for the purposes of the game."

"The actual figures for the units are now put on the table, each Unit being scattered around its drop zone marker; to determine exactly where each figure ends up roll two dice for each man - a D12 and a D10. The D12 indicates the DIRECTION the man lands in relation to the drop zone marker (use the "clock face" method with the score rolled on the D12), while the D10 score is the DISTANCE in inches from the drop zone marker. If the drop was from orbit, DOUBLE all the distance rolls. The unit will thus arrive on table with at least some (probably most) troops scattered out of Unit Integrity, and its first action (or actions, if its troops are very scattered) on-table must be a REORGANISE action to move its elements into integrity distance before it can do anything else."

"Any trooper that rolls a natural 1 on his DISTANCE (D10) roll is injured on landing, as for troops dropped from hovering VTOLs."

"If a figure ends up dropping in bad terrain (woods, buildings, cliffs or similar), roll the unit's QUALITY DIE for him - on a roll of 1 or 2, he is lost on landing - remove the figure from play, as even his own squad will not know what has happened to him; dropped vehicles or other equipment are lost on rolls of 1-5 if they land in bad terrain. In URBAN areas, troopers are lost on rolls of 1-4 and vehicle/equipment elements are ALL lost automatically. All figures, vehicles and equipment landing in OPEN WATER are lost completely, except for POWERED INFANTRY who are lost on a 1-3 but otherwise may wade ashore."

### INTERFACE LANDINGS FROM ORBIT: (p. 51)

"Troops and vehicles may be landed from orbit in Interface Craft (Dropships), which may be of almost any size from small one-squad ships up to huge craft that carry several vehicles or whole platoons of troops. Some dropships may be VTOL-capable, while others may require a conventional runway; for SGII games the only ones that can actually arrive on-table during a game are the VTOL-capable types."

"VTOL dropships act in most ways like any other VTOL aircraft; they may land anywhere on-table provided they have a suitable LZ."

"A grounded dropship may disembark one unit (one troop squad OR one vehicle) per action after landing."

*(A photograph of a ruined/wrecked structure occupies the lower right of the page; it carries no caption or rule text.)*

Page footer: printed page number **51**.

---

## Printed page 52 — Chapter 19, ELECTRONIC WARFARE (opening page)

### ELECTRONIC WARFARE, ECM AND JAMMING: (p. 52)

"An EW (Electronic Warfare) unit is any unit which has a dedicated EW figure in it; EW figures may be part of a normal combat unit or command unit, or may be organised as small units of their own (usually a two-man unit of one EW man and one normal trooper for defence)."

"During its activation, an EW unit may elect to have its equipment either ACTIVE or INACTIVE; if the systems are placed on "active", then the unit gets THREE EW markers placed by it in a stack. These three markers represent the three attempts at EW tasks that the unit can now make between then and its next activation; each time such a task is attempted (whether successfully or not) one of the markers is removed. When the unit's next activation comes round in the following turn, the player must decide again whether to remain active (in which case the unit is replenished to 3 markers, irrespective of how many it has used from the last turn) or to switch its equipment off, in which case any remaining markers are removed and no new ones placed."

"Once all three markers have been used up in a turn, the EW unit is considered INACTIVE."

"During a game turn, an active EW unit may attempt to use its EW equipment in any combination of the following ways:"

i) to jam an enemy communications attempt;
ii) to try and identify an inverted enemy counter;
iii) to disrupt enemy sensors or guidance systems;
iv) to try and foil an attempted task by an opposing EW unit (ie: ECM, ECCM, ECCCM and so on....).

"Whenever one of these EW "tasks" is attempted, it costs the EW unit one of its EW markers from its stack; when all three are used up, no further tasks may be attempted by that unit until it is re-activated next game turn."

"Whenever an EW unit has to roll a die in attempting a task, the type of die it rolls depends on the level of its EW system: for a unit with a BASIC EW package a D6 is used, with ENHANCED EW a D8 and with SUPERIOR EW a D10."

"If desired, an EW unit can boost its chances of success in a given task by expending MORE than one of its EW markers; for each extra marker used up, raise the die type by one: thus a BASIC EW system can be boosted to use a D8 by expending TWO markers rather than the usual one, or boosted right up to a D10 by using THREE markers at once. No EW system can be boosted above a D12, so there is no point in expending more than two markers on a SUPERIOR system."

#### i) Jamming Communications: (p. 52)

"Whenever a player attempts to communicate between units using battlefield comms (ie: any communication other than between units in direct contact), the opposing player may attempt to jam or disrupt the communications if he has an active EW unit on the table with at least one EW marker left. Such a jamming attempt must be announced immediately after the communicating player has announced exactly how he is making his call attempt (ie: after he has decided what request chits etc. to commit to the attempt) but BEFORE any dice are rolled. The "jamming" player then rolls a die according to the level of EW equipment he is using, at the same time as the communicating player makes his roll. If the jamming roll exceeds the communications roll (irrespective of whether the comms roll is successful in its own right) then the communication attempt has been jammed and the message fails to get through. An attempted communications jam, whether successful or not, is one EW task attempt and thus uses up the EW marker(s) allocated to the task.."

*(Note: the source text ends this paragraph with a double period ".." exactly as printed.)*

#### ii) Remote Spotting of Inverted Counters: (p. 52)

"An active EW unit may expend one (or more) markers at any time, in an attempt to identify ANY inverted enemy counter on the table, whether or not the counter is within sight of the EW unit. To do this, the EW unit is assumed to be linking in to its side's overall battlefield intelligence and processing and collating data collected from sensors on other on-table units, aerial recon drones, intercepted enemy communications and other sources. In game terms, the rule is very simple: the EW player rolls a die (according to his EW system type, shifted up if he is committing more than one EW marker to the task), and the player owning the inverted counter rolls a die according to the counter's circumstances: if it is out in the open he uses a D4, if in concealment (ie: in any form of cover) a D6; shift up one die type if the counter is NOT within line-of-sight of the EW unit. To identify the counter, the EW player must roll HIGHER than his opponent. If he succeeds, the counter is revealed **even if** it is a mine, booby-trap or sniper (which would normally be proof against ordinary sensor location attempts). If the EW player fails to beat his opponent's roll then the counter remains inverted."

#### iii) Disruption of Enemy Sensors and Guidance Systems: (p. 52)

"Whenever the enemy does something that uses electronic systems, such as attempting a sensor scan or firing a guided weapon, then an EW unit can attempt to "spoof" those systems and foil the enemy's attempt (these events can be occurring anywhere on the table, not necessarily in sight of the EW unit). The EW player announces he is attempting this task as soon as the opponent announces his intended action; the opponent rolls for his action as normal (with one or more dice depending on what he is doing), and the EW player rolls his own die at the same time - if the EW roll exceeds ANY ONE of the opponent's roll(s), then the EW has jammed the attempted action and it fails (irrespective of whether the opponent's roll(s) would normally have been enough for a success or not)."

#### iv) Jamming attempted tasks by opposing EW units: (p. 52)

"When an EW unit attempts any EW task, if the opposing player also has an active EW unit he may attempt to foil the first player by rolling his own EW die and attempting to roll higher; if he succeeds, then the EW task attempt is jammed and fails. This gets into the realms of Electronic Counter-Measures (ECM), Electronic Counter-Counter-Measures (ECCM) and so on - just how far you go with trying to spoof each other's spoofing attempts depends on how silly you want to get (and who runs out of EW markers first!)."

*(The final clause about "how silly you want to get" is authorial flavour rather than a hard rule; the mechanical content — opposing EW unit rolls its own die, higher roll jams the task — is transcribed verbatim above.)*

> **Boxed rule summary (bottom-right of page):**
> EW systems D6, D8 or D10; one EW marker to attempt task, shift die up for every EXTRA marker used.
> To JAM Communications, exceed opponent's Comms roll.
> To SPOT, exceed D4 in open, D6 in cover. Shift up 1 die if out of sight of EW unit.
> To SPOOF sensors/guidance, exceed ONE of opponent's rolls.
> To JAM EW, exceed opposing EW roll.

*(A full-height illustration of an EW-equipped trooper with a whip antenna and back-mounted electronics pack occupies the lower-left of the page, with a small illegible artist's signature/date mark at bottom-left; no rules text.)*

Page footer: printed page number **52**.

---

## Illegible content

None. All body text, box text, headings, and numbers on both pages were legible at the supplied resolution. The artist's signature under the illustration on p. 52 is a small handwritten mark that is not rules text; it is not transcribed as it carries no game content, but is noted here rather than being silently dropped. No numbers were guessed. *(Checker's note: re-examined this signature at 4x pixel zoom — it is a stylised cursive mark reading approximately "B [surname] / '9[4]", plausibly an artist credit and year, but not confidently legible letter-by-letter and correctly left untranscribed rather than guessed.)*

<details><summary>Checker's corrections</summary>

Checked line by line against the source images `sg/sg-p52.png` (printed p. 51) and `sg/sg-p53.png` (printed p. 52) at full resolution, with additional 2x–4x pixel-level crops made for this check on the "bad terrain" casualty-roll paragraph (the 1-5 / 1-4 / 1-3 thresholds), the EW boxed rule summary, the page-51 header/box area, and the p. 52 illustration signature. Cross-checked EW terminology and die values against the already-checked quick-reference files (`qr-p1.checked.md`, `qr-p2.checked.md`), whose "ELECTRONIC WARFARE" summary box matches this chunk's page-52 boxed summary verbatim.

**Result: no content errors found.** Every number, die type, die shift, threshold, range, count and condition in the file matches the source exactly, including:
- LZ sizes (6"/12"/18") and the pilot-Quality 1-2 disabled result on p. 51.
- The hovering-drop rules (ONE action for jump/grav packs, TWO actions for ropes; 1 = accident, 1-2 in dangerous areas).
- The four-turn "Typical Air Mission" sequence.
- The orbital/high-altitude insertion rules, including the 36" drop height, D12 (direction)/D10 (distance) scatter rolls, doubled distance from orbit, natural-1 injury, and the bad-terrain/urban/open-water loss thresholds (1-2, 1-5, 1-4, 1-3 respectively).
- The Interface Landings from Orbit rules, including "one troop squad OR one vehicle) per action."
- The full Electronic Warfare rules on p. 52: THREE EW markers per activation, D6/D8/D10 by BASIC/ENHANCED/SUPERIOR system, the marker-boosting rule (2 markers → D8 from Basic, 3 → D10, cap at D12), and all four EW task subsections (i–iv) with their exact mechanics (exceed opponent's Comms roll; D4 open/D6 cover with a further shift for no line-of-sight; exceed ANY ONE of opponent's rolls; exceed opposing EW roll), matching the boxed summary word for word.

No rule present on either page was found missing from the digest, and no invented, misplaced, or uncredited commentary was found presented as a rule (the italicised parentheticals in the file are clearly marked as the checker's/first reader's own observations, not source text, and are kept as such per the task instructions).

The digest's own flagged content/assignment mismatch (these two pages contain the tail of Chapter 18 Aerospace Operations and only the opening page of Chapter 19 Electronic Warfare — not Chapter 20 Advanced and Optional Rules as the task brief described) was independently re-verified against both page images and confirmed accurate; no Chapter 20, reaction fire, surrender, interrogation, or last-stand text appears anywhere on either page.

No wording, number, or table cell was changed from the first reading. Two clarifying checker's notes were added in place (marked as such) to record that the flavour vignette and the illustration signature were independently re-examined rather than assumed correct: no rules content resulted from either check.

</details>

---

# Chunk 18 · pp. 53–56 · 20 Advanced and optional rules

**Source images:** `sg/sg-p54.png` (PDF page 54 → printed page **53**), `sg/sg-p55.png` (PDF page 55 → printed page **54**), `sg/sg-p56.png` (PDF page 56 → printed page **55**), `sg/sg-p57.png` (PDF page 57 → printed page **56**). Running header on all four pages: "20 ADVANCED AND OPTIONAL RULES".

> **Content/assignment note.** The task brief for this chunk lists "casualty evacuation, rules of engagement, mines, conventional minefields, command-detonated mines, booby traps, decoys, buildings and fortifications (with their armour table), fires, flame and incendiary weapons, smoke, weather conditions, exotic environments." What is actually printed on these four pages is: REACTION FIRE, THE LAST STAND, SURRENDER AND TAKING PRISONERS, and INTERROGATION OF PRISONERS (all on printed pp.53–54, not mentioned in the brief), then CASUALTY EVACUATION (CASEVAC), RULES OF ENGAGEMENT, MINES, CONVENTIONAL MINEFIELDS, MINE CLEARING, COMMAND-DETONATED MINES, BOOBY TRAPS, DECOYS, and BUILDINGS AND FORTIFICATIONS (with its armour-ratings table, itself continuing onto the next page beyond this chunk). There is **no** Fires, Flame and Incendiary Weapons, Smoke, Weather Conditions or Exotic Environments material anywhere in these four pages — those sections must fall later in the chapter, outside this chunk. Everything below is transcribed only from what is actually printed on these four images.

---

## Printed page 53 — REACTION FIRE

"In normal play, whenever a unit is fired on it is assumed to be in the position and circumstances that it occupies at that moment, regardless of whether it has moved from somewhere else earlier in the turn; thus if a unit is activated and moves from the open into cover, whenever any opposing unit fires on it later in that turn it is considered in cover - if they wanted to fire at it while it was in the open, they should have done so BEFORE it activated."

"There is, however, ONE exception to this general rule - this is called **REACTION FIRE**."

"If a unit uses BOTH its actions for movement (of whatever type), then an opposing unit that can see it may declare REACTION FIRE against it - this consists of just ONE fire action by the opposing unit, which takes place as if the moving unit was caught in between its two actions. This is best illustrated with an example:"

Worked example (verbatim, italicised in source): *"A unit starts its activation hidden behind a building or hill; during its activation it dashes out from concealment, runs across a stretch of open ground and dives into the cover of some bushes. This takes it both its actions, and the opponent immediately announces that he wishes to perform REACTION FIRE by a unit that is in a position to see the moving squad run across the open ground: he may resolve his fire as if he had caught the moving unit in the open, in mid-dash between its first and second actions; the result of the fire is calculated and applied immediately, so the target unit may or may not be able to complete its second action - if not this is lost."*

"Performing one action of Reaction Fire uses up the WHOLE activation of the unit that fires, so its activation marker is flipped over and it may do nothing more that turn; of course, units that have already activated may not perform reaction fire. It also counts as the "next activation" for the player who fires, so immediately afterwards it is once again the "moving" player's turn to activate a unit. Only ONE opposing unit may perform Reaction Fire against any one moving unit."

"Reaction Fire may ONLY be performed against units that are MOVING with both actions as explained above - it may not be used in any other circumstances, including cases in which units move with just one action. The moving unit MUST be visible to the firing unit at the point between its first and second move actions."

> **Boxed rule:** Reaction Fire occurs only against units making double move actions; fire takes effect between first and second actions. Uses up complete activation of firing unit to perform 1 Reaction Fire action.

---

## Printed page 53 — THE LAST STAND

"Military history (and fiction) is full of stories and events in which small bands of gallant troops, cut off from support, facing terrifying odds and almost out of ammunition have steadfastly refused to either run or surrender and have held their position until the last of their number fell. For every one case like this there are lots in which the troops drop their weapons and run like hell, but nevertheless we need to be able to simulate the CHANCE of the heroic, suicidal "last stand"."

Flavour paragraph (summarised): a Sergeant is dead, the unit is down to a single magazine per man and one missile, the enemy are massing outside the perimeter, and a Corporal invokes his unit's history ("Remember Camerone/The Alamo/Talos IV") as his men brace to receive the assault; the game needs a special rule for this.

"A Last Stand test may be made VOLUNTARILY by the player owning the unit, provided certain conditions are met: the unit must be in cover (soft or hard) and/or In Position, and cannot have any other friendly units within 12" of it. Additionally, there must be at least three enemy units in line of sight at the time of testing, not including any that are Broken, Routed or voluntarily retreating. At the time of testing, the unit must have a Confidence no lower than SHAKEN; Broken or Routed units may not attempt the Last Stand, as their morale has already crumbled too far."

"The actual test is simple: roll a D6, and a score of 6 indicates that the test is successful; a roll of 1-5 means that the troops panic totally and the unit disintegrates - if any enemy are within 12" then the troops will attempt to surrender to them (if applicable to the scenario - see rules on Surrendering and POWs), otherwise the figures are simply removed from play - they have dropped their weapons and fled."

"If the Last Stand test is successful, the unit's CONFIDENCE marker is removed and replaced with a LAST STAND counter - after this, the unit does not need to take ANY further tests for confidence or reaction, even if close-assaulted, and will IGNORE any Suppression results inflicted on it. The unit will remain in its present position until either it is destroyed, or until all visible enemy units are in retreat - if this occurs, then the unit loses its Last Stand marker and regains a normal Confidence marker (at STEADY, irrespective of its earlier level), after which it will return to normal rules."

Designer's Note (summarised): the harsh 1-in-6 success chance is deliberate, to keep the rule rare and stop players abusing it; it is best omitted if the opponent can't be trusted with it, and an umpire running "Spirit of the Game" may adjust the odds for a particular unit's history (up for units with a proud tradition, never available at all to poorly motivated conscripts).

---

## Printed pages 53–54 — SURRENDER AND TAKING PRISONERS

"If a unit reaches a confidence level of ROUTED and is unable to retreat without moving closer to any located enemies, it will attempt to SURRENDER to an enemy unit if one is within 12". If it is cut off from retreat but there are **no** enemy units within 12", the Routed unit will instead disintegrate - simply remove all the figures from the table, as they have thrown down their weapons and scattered."

"Bear in mind that units will NOT surrender to an enemy that they know will not take prisoners - would you surrender to a slavering alien that has a reputation for eating humans alive? Surrender and the taking of prisoners will generally only happen in battles between human forces, where the troops can expect at least survival and hopefully decent treatment."

"When a unit surrenders, the opponent has the choice of either moving the surrendering troops to his own men's position or of moving his troops to the surrendering unit; either way, the figures are moved immediately, whether or not one or both units have activated that turn. Once in contact with the opposing unit, the surrendering troops are deemed captured and may (if desired) be interrogated using the rules below. After this, the prisoners may either be moved along with the unit that captured them or else despatched to the rear - in this case, the capturing unit must provide a detached element to escort the prisoners, at the rate of one guard per six (or fewer) captives. Wounded prisoners may be carried by their captive comrades, taking two fit men to move one casualty."

"Of course, prisoners may simply be shot (not that you'd think of that, would you...) - however this is where the "Spirit of the Game" comes in, and you should really role-play your forces properly. Undisciplined rebel scum might well butcher captives, but "civilised" armies probably won't unless very severely provoked; mercenaries will generally not kill prisoners for the sake of it, but may if it is tactically expedient. Like so much of the game, suit the reactions to the scenario in use."

> **Boxed rule:** Routed troops will surrender to enemy within 12" if unable to retreat. Prisoners may be moved to captors, or vice versa. When escorting prisoners 1 guard required per 6 captives.

---

## Printed pages 53–54 — INTERROGATION OF PRISONERS

"When a unit has captured live enemy troops (including any wounded but stabilised by medical treatment), it may attempt to INTERROGATE them to obtain information about enemy forces or positions. To carry out an interrogation of any captives, the unit must spend a REORGAN-ISE action." *(Word hyphenated across the printed page 53/54 break: "REORGAN-" ends page 53, "ISE action." begins page 54.)* "Note that this is just a very quick field interrogation, using whatever means are at hand and are deemed necessary under the circumstances - it is handled as a very abstract thing, but if you want to go into all the gory details (nasty person....) then feel free to do so!"

"For each captive being interrogated, roll the **prisoner's** quality die in an opposed roll against the **interrogator's** quality die (this assumes that the fine art of military interrogation - and how to resist it - is learned by troops as part of their training and hence better troops are better at it - a great simplification, but it works). If the interrogator's roll EXCEEDS the prisoner's roll, then the interrogation is successful and the prisoner reveals some information about his side's forces."

"What can be gained from a successful interrogation depends on the type of prisoner being questioned. If he is an ordinary soldier, he will be able to give less useful information than if he is an NCO or Officer. If a successful interrogation attempt is made on an ordinary trooper, then it allows the interrogating player to REVEAL ONE INVERTED ENEMY COUNTER, anywhere on the table (whether in sight of any troops or not). Which counter should be revealed, however, is up to the choice of the player owning the prisoner figure and the counter - he may freely select ANY one of his own inverted counters to reveal, and thus will usually choose to reveal a dummy or other relatively unimportant item. If the prisoner is an NCO or Officer, however, the INTERROGATING player has the choice of which counter is revealed, thus he can choose to see one that he is particularly worried about."

"Each individual prisoner may only be interrogated ONCE by the unit that captures him, though if a higher-level Intelligence unit is on the table the prisoner may be passed to them for further questioning; such actions are outside the scope of most SGII games, but may be useful in particular scenarios."

"These interrogation rules are extremely simple and abstract, but do add a touch of variety to the game as well as giving players a reason not to just kill everything out of hand! Of course, players are free to expand on them if desired, especially if a scenario is built around the need to capture a live enemy and find some especially important piece of information."

> **Boxed rule:** Reorganise action spent to INTERROGATE prisoners. Roll opposed quality dice - if interrogator wins, reveal 1 enemy inverted counter (interrogator's choice if officer/NCO, otherwise prisoner's choice).

*(A photograph of two soldiers with a bound/seated captive figure in undergrowth occupies the lower left of page 54; caption-less, no rule text.)*

---

## Printed page 54 — CASUALTY EVACUATION (CASEVAC)

"CASUALTY EVACUATION operations, commonly known as CASEVAC or C-VAC to most armies, are provided by specialised vehicles (usually VTOL aircraft, though they can also be ground vehicle ambulances) dedicated to the rapid extraction of injured troops from the battlezone."

"The availability of such units is dependant on the circumstances of the forces involved in the game and the scenario being played. If such a unit is available, the knowledge that casualties can be quickly recovered from the battlefront and returned to medical facilities off-table is a great psychological boost to the troops on the ground."

"Provided it is agreed that a Casevac unit is on call, it operates as for any normal airborne or ground unit (as appropriate); a marker to represent the Casevac vehicle should be placed in the LOITER box on the Incoming chart - it is then available to be called by the player at any time, with a successful COMMUNICATION roll being needed to call the Casevac on to the table. This roll is carried out in the same way as for transferral of actions or requests for support - thus the die type used for the communication is modified if the communication attempt bypasses one or more of the normal chain-of-command levels. It is assumed that the Casevac unit is allocated at the highest Command level present on-table - thus if a Platoon commander is the highest Command unit in play then the Casevac may be called by him at no communications penalty, or by a Squad leader at a one-level communications penalty."

"When successfully called, the Casevac unit marker is immediately moved from the LOITER box to the BATTLE AREA circle and the vehicle model placed on the table edge where desired. On the NEXT game turn, it may be activated as a normal unit and will enter the table."

"Loading injured troops (stabilised casualties) into a Casevac vehicle takes one action with the squad in direct contact with the ambulance or grounded VTOL; once the vehicle leaves with the wounded aboard, the squad may immediately make a D6 roll - if they score 3 or more, they immediately RISE one level of Confidence; if they are lucky enough to roll a 6 then they rise TWO levels. Additionally, any other friendly unit WITHOUT any wounded to be evacuated that is within 12" of the unit attended by the Casevac may also roll a D6 and will recover ONE confidence level on a score of 5+ (their own morale is lifted by seeing their comrades recovered). Note these rolls are not dependant on the unit's quality or leadership - it is the same simple D6 roll for ANY type of unit. Of course, no unit may rise above CONFIDENT (CO), so if they are already on this level there will be no effect."

"Important note: unlike other means of raising CL, such as Rallying, the effects of successful Casevac CAN actually raise the CL of fatigued troops above their initial starting levels - right up to CO if they are lucky. The morale-boosting effect overrides their fatigue, at least for the short time the game represents."

"A Casevac vehicle may make more than one pickup of casualties while on the table if desired, but may not hold more injured personnel than HALF the normal complement of troops for that type of vehicle (wounded personnel, especially on stretchers, take much more room than seated soldiers - plus there are the medics and additional equipment on board already)."

"After all desired pickups have been made, or when the vehicle is full, it must immediately leave the table - how long before it may return (if at all) will depend on the scenario in play - if this is not specified, then it must travel out to box 3 of the Inbound Chart (see P.44) before it may turn round and start coming back."

"In addition to the potential recovery in Confidence levels, the successful evacuation of injured personnel may have a beneficial effect to the player's Victory Conditions (this should be specified in the scenario) and can also be of use in a series of games - see P.61 for details of how recovered casualties may return to duty with their units in a campaign game."

> **Boxed rule:** Casevac must be called by successful communications roll. After evac, roll D6: on 3+ raise CL of unit 1 level, 6 = up 2 CLs. Other units raise CL by one on 5+ if within 12" (and in sight) of evac.

*(Note: the boxed summary adds "and in sight" as a qualifier for the nearby-unit recovery roll; the body text states only "within 12" of the unit attended by the Casevac" and does not explicitly say "in sight" — see "Against the quick reference" below is not applicable here, but implementers should note the box is more restrictive than the body paragraph on this point.)*

---

## Printed page 55 — RULES OF ENGAGEMENT

"Certain scenarios may specify that one or both sides must operate under restrictive RULES OF ENGAGEMENT, which prohibit them from doing certain things and/or using certain weapon types. The exact nature of these rules will depend on the scenario and the Umpire's decisions, but typical examples could be no fire of anything heavier than small-arms and infantry support weapons while within towns or villages, no shooting at civilians (exact target identification required before firing), no artillery or air support to be called on anything near civilian settlements and so on."

"The imposition of such rules is usually made on forces operating against guerrilla or insurgent forces in theoretically "friendly" areas, but can be applied to other situations such as peacekeeping troops or police actions - anywhere that politics conspire to stop the soldiers doing their job properly!"

"How the Rules of Engagement are implemented is really up to Umpire and how strict he wishes to be about it - a minor breach of the rules like shooting a farmer's livestock may simply lose the player some victory points (under whatever system is in use) or may in extreme cases cause him to automatically lose the game - things like cluster-bombing the local school/hospital/orphanage probably fit into this category....."

No boxed rule or table accompanies this section; it is entirely descriptive/umpire-adjudicated.

---

## Printed page 55 — MINES

"Mines have always been particularly nasty things, and they just get nastier as technology increases. Most mines are detonated by proximity fuses (thermal, audio or vibration detectors, or magnetic/gravitic sensors for anti-vehicle types) so it is not even necessary to step on or drive over one to set it off. Some have extra devious tricks like random delay fusing that stops them going off on the first (or even second) activation, so even if one man or vehicle successfully negotiates a mined area the next one might get caught by a "dormant" mine that ignored the first target! Some mines move themselves about at random, and even "pounce" on targets from some distance away."

"Minefields are represented by inverted counters until someone stumbles into them or manages to successfully detect their presence."

"There are three different kinds of mine considered in the game - ANTI-PERSONNEL (AP) mines, ANTI-VEHICLE (AV) mines and COMMAND-DETONATED MINES (CDMs); the first two types are laid in minefields, which may contain just one kind of mine or a mix of both. CDMs are rather different in operation and are dealt with separately."

---

## Printed page 55 — CONVENTIONAL MINEFIELDS

"A minefield counter indicates a mined area 6" in diameter, centred on the counter; thus any unit coming within 3" of the counter may trigger a mine. BLACK mine symbols on the counter represent Anti-Personnel mines, RED symbols are Anti-Vehicle mines and a counter with BOTH symbols represents a mixed field."

"Note that all Minefields are areas sown with multiple mines - setting one (or several) off does NOT render the field ineffective; it remains active for the game duration unless cleared or neutralised."

"Whenever an infantry unit moves so that some (or all) of its figures are within 3" of an AP or Mixed minefield counter, a die must be rolled for EACH figure that actually in the danger area (if this means that you send some poor s*d forward on his own to see if he gets blown up, then that is fine - but remember he must either stay within unit integrity distance or must be operating as a detached element). For each man, roll the unit's QUALITY DIE, on the assumption that the poorer the troops the more likely they are to trigger something nasty without noticing it. If the minefield is a pure AP type, then each man is caught by a mine if he rolls a 1,2 or 3; if it is a MIXED minefield then each figure will only get attacked on a roll of 1 or 2, to represent the lower density of AP mines. Infantry will NOT set off AV mines." *(Printed exactly as shown, including "a die must be rolled for EACH figure that actually in the danger area" — grammatically incomplete in the source, transcribed verbatim rather than silently corrected to "actually is in".)*

"Any figure attacked by a mine must roll his Armour die vs. the Mine's Impact value, which is **D10**. Casualties are reckoned as for fire attacks, ie: Impact beats Armour = WOUNDED, Impact MORE THAN TWICE Armour = DEAD."

"Vehicles entering or moving through pure AV mined areas will **automatically** be attacked by a mine; in MIXED fields roll a D6, with the vehicle being attacked on a roll of 3 or more."

"When a vehicle is attacked by an AV mine (AP mines have no effect), roll a **D10** for the mine and roll for the vehicle's SUSPENSION type in the same way as for hits on the suspension during heavy-weapons fire (see P.39):"

"A Civilian-type WHEELED vehicle rolls a D6; a Military WHEELED type a D10, a TRACKED vehicle a D10 and a HOVER vehicle a D8. UNLIKE suspension hits from direct fire, GRAV (ground-skimming) and WALKER type vehicles roll a D12."

"If the MINE rolls higher than the vehicle suspension roll, then the vehicle is IMMOBILISED by the mine."

"If the mine rolls MORE THAN TWICE the suspension score, then the vehicle is DISABLED and some of its occupants may be injured - roll for them as per the vehicle crew casualty rules on P.39; counting the mine as a SIZE 2 weapon: if the vehicle is an AFV then roll as if it was a MINOR hit - thus any occupant that rolls 1 or 2 on their personal ARMOUR die will be a casualty; if the vehicle is a SOFTSKIN then treat it as a MAJOR hit, so casualties occur on rolls of 1-4."

> **Boxed rule:** All minefields 6" diameter (3" radius around counter). RED = AV, BLACK = AP, BOTH = MIXED.
> AP mines vs. infantry: Roll Quality die for each figure in minefield; AP fields: hit on 1-3; Mixed fields 1-2. Men hit roll D10 (mine Impact) vs. Armour, normal casualty scores.
> AV mines vs. vehicles: automatic attack in AV field, attacked on 3+ on D6 in Mixed field. Roll D10 (mine) vs. SUSPENSION (Civ. wheeled D6, Mil. wheeled D10, Tracked D10, Hover D8, Grav/Walker D12). Mine exceeds Armour = IMMOBILISED; more than twice = DISABLED + possible casualties (AFV occupants 1-2 on Armour roll, Softskin occupants 1-4)

*(Reader's note on the box's own wording: the box rolls the mine "vs. SUSPENSION" but then calls the immobilise/disable thresholds "Mine exceeds Armour" / "more than twice [Armour]" — printed exactly this way; it is the box's own shorthand for the suspension-die roll, not a separate Armour die, and is transcribed verbatim above.)*

---

## Printed page 55 — MINE CLEARING

"In the timescale of the game, Mine clearance by hand is not possible. Mines MAY be cleared during the game by specialist engineering vehicles (eg: ones fitted with Mine Ploughs or similar equipment), which may clear a minefield by driving over the counter; each time, roll the Quality of the vehicle driver - if he rolls a ONE then the vehicle is attacked by a mine, otherwise it clears the field without being attacked."

"The other way mines may be cleared in game-time is by ARTILLERY - if an artillery round lands so that the MINE counter is within the burst radius of the shell, the blast sets off the mines and clears the field."

> **Boxed rule:** Mines cleared by Engineering vehicles (roll Quality - 1 = vehicle attacked by Mine), or by Artillery (Mine counter must be in burst radius).

---

## Printed pages 55–56 — COMMAND-DETONATED MINES

"CDMs are special forms of mine similar to the "Claymores" in current service. A CDM is a "directional" defensive mine that, when fired, sprays a cone of shrapnel towards an enemy unit with devastating effect against infantry."

"CDMs may be emplaced before or during the game (it takes an infantry unit equipped with them 1 action to set up a CDM, which is marked by the relevant counter), and may be detonated by the owning player at ANY time during the game, provided the unit that controls them (usually the one that set them up) is in a suitable position to see the mine and the unit being attacked by it. The player does NOT have to wait for his unit to activate in order to trigger a CDM - it may be done in response to a move or action by an opposing unit, and does not use up the activation of the controlling unit. Any number of CDMs controlled by the same unit may be fired at the same time, at the player's discretion."

"When a CDM is fired, it will attack the NEAREST infantry unit to it; roll for EACH figure in the unit that is within 6" of the CDM counter (they do not have to be directly in front of it - the CDM is a "smart" device that will swivel to fire in the optimum attack pattern for the threat it senses). For each figure caught in the blast, roll a D10 for the mine against the Armour die of the figure, counting casualties with the usual scores."

"CDMs have no effect against ARMOURED vehicles (AFVs), but against SOFTSKINNED vehicle targets they roll as for infantry - if the mine's roll exceeds the vehicle's D6 Armour Die then the vehicle is DISABLED and its occupants should each roll as described in the AV mines section above."

"Note that, unlike conventional minefields, a CDM marker represents just ONE mine and is therefore removed after detonation."

> **Boxed rule:** CDMs: 1 action to emplace. May fire at any time, no action needed to detonate. Roll for each figure within 6", using D10 for CDM vs. figure Armour. Softskin vehicles roll vs. mine, AFVs no effect. Remove marker after detonation.

---

## Printed page 56 — BOOBY TRAPS

"Booby Traps are similar in effect to Mines, but are one-shot devices designed to kill or incapacitate (usually) a single soldier that blunders into one. Though there are many different types of booby-trap possible, for SGII we assume a typical small explosive type with some sort of remote sensor or trip-wire detonation. When a unit (or any figures from one) comes within 3" of a booby-trap counter, the player owning the troops should roll his unit's Quality die, while the player that placed the trap rolls a D8. For simplicity we assume the trap is either discovered or detonated - if the trap's roll beats the unit's roll, the booby-trap detonates; if it does not, it is discovered by the troops and rendered harmless. If the booby-trap detonates, whichever figure was CLOSEST to the trap counter must roll his Armour Die in an opposed roll against the trap's Impact die, which is a D8 in most cases (more or less powerful traps may be specified if agreed, depending on the scenario). The effect on the figure is reckoned in the same way as any other explosive effect. If any other figures are in base-to-base contact with the "victim" figure when the trap goes off, they are also attacked but with an Impact die one lower than the main attack (ie: a D6 for most booby-traps)."

"Once a booby-trap has been set off or discovered, the counter is removed from play."

No separate boxed-rule summary is printed for this section.

---

## Printed page 56 — DECOYS

"Decoys are devices that emit signals to confuse Guided weapons, drawing them away from their intended target and towards the Decoy."

"Vehicles may be fitted with DECOY launchers, which may be fired (launching one decoy) whenever the vehicle is fired on by a Guided Missile. When used, the decoy rolls a D8 in an opposed roll against the Missile's Guidance die; this roll is made BEFORE the missile hit is rolled for. If the decoy roll exceeds the missile's roll, then the missile has been confused and will home on the decoy rather than the target vehicle. If more than one missile is incoming, roll separately for each missile against the decoy - it can attempt to deflect more than one missile, but once it has succeeded it will be destroyed by the missile it has attracted, so any other missiles fired later in the turn will ignore it. A vehicle decoy launcher may only fire ONCE per turn."

"If desired, infantry units may also employ emplaced decoys; it takes one action to place a decoy - mark the spot with a DECOY counter, which remains in place until it does its job and is thus destroyed. An emplaced decoy will attempt to attract any enemy missile fired at any target that is within 6" of the decoy at the time the missile is fired."

> **Boxed rule:** Vehicle DECOYS fire once per turn if attacked by Missile. Roll Decoy (D8) vs. Guidance, success = missile attacks decoy. Emplaced decoys take 1 action to set; will roll vs. any missile aimed at unit within 6" of decoy.

---

## Printed page 56 — BUILDINGS AND FORTIFICATIONS

"Buildings and fixed fortifications can play a part in any scenario. All structures are considered POINT TARGETS when fired at, and each should be given a SIZE CLASS in a similar way to vehicles - thus a small bunker or pillbox might be a size 2 or 3 target, but most buildings are going to be size 4 or 5; very large structures should be considered as being made up of several sections or modules, each of which may be attacked and/or destroyed separately."

"Fire at structures is resolved in the same way as fire at vehicles, using the structure's size class to calculate the range band (depending on the weapon type firing)"

"If a player wishes to attempt to fire at a certain part of a building, such as a window or door, then treat the intended target point as a much smaller target (windows or small doors would be size 1 targets) and roll accordingly to see if the shot hits. If such a shot MISSES the intended target point then roll a D6 - if this roll exceeds the overall size class of the building then the shot has actually missed the structure completely, if not then it hits the building somewhere other than the specific point of aim."

Worked example (verbatim, italicised in source): *"A player fires a plasma gun at the door of a bunker - taking the door as a size 1 target, he rolls accordingly and fails to hit. The bunker itself is a size 5 target, so having missed the door the player rolls a D6 and scores 3 - his shot hit the bunker's armoured wall; if he had rolled a 6 (thus exceeding the bunker's size class of 5) his shot would have missed the structure completely."*

"Fortifications may mount weaponry if desired, using the same capacity limitations as for vehicles."

"All structures have ARMOUR RATINGS similar to those of vehicles; defended military structures will have much higher armour ratings than civilian buildings, and specific parts of buildings (doors, windows etc.) may be given different armour ratings to those of the main structure."

**"Suggested examples of armour ratings are:"**

| Structure/part | Armour Class |
|---|---|
| Primitive building (timber, adobe etc.) | Armour Class 0 (D6) |
| Typical civilian building (brick or similar) | Armour Class 2 (D12x2) |
| Steel or concrete building | Armour Class 3 (D12x3) |
| Fortified bunker | Armour Class 5 (D12x5) |
| Door or window in civilian building | Armour Class 0 (D6) |
| Armoured viewport | Armour Class 1 (D12) |
| Armoured door | Armour Class 2 (D12x2) |
| Heavy armoured door | Armour Class 3 (D12x3) |

*(The table ends cleanly on this page after the "Heavy armoured door / Armour Class 3 (D12x3)" row: there is a blank space below it and then the page footer, the same margin pattern seen at the bottom of every other page in this chunk (e.g. the CASEVAC box on p.54). Nothing on the page indicates the table continues onto the next page. A small stray printed mark appears between "1" and "(D12)" in the Armoured viewport row — transcribed as a plain space; not a second digit.)*

*(A photograph occupies roughly the top half of the right column of page 56 (not the full page): "NSL Power Armour troopers break through into the bunker in the face of FSE Legionnaire resistance." — captioned. Below the photo and caption, in the same right-hand column, the BUILDINGS AND FORTIFICATIONS body text continues (the "being made up of several sections..." sentence onward) and then the armour-ratings table; no additional rule text appears in the photo area itself.)*

---

## Illegible content

None. All body text, box text, headings, the worked examples, and every table cell on all four pages were legible at the supplied resolution, including under 2x zoom crops of the smaller boxed-rule text. No numbers were guessed.

---

## Against the quick reference

None of the topics on these four pages (Reaction Fire, The Last Stand, Surrender and Taking Prisoners, Interrogation of Prisoners, Casualty Evacuation, Rules of Engagement, Mines of any kind, Booby Traps, Decoys, or Buildings and Fortifications) appear anywhere in the two-page quick-reference summary (`qr-p1.checked.md`, `qr-p2.checked.md`). A programmer implementing only the QR would be missing all of this content outright, not merely getting a detail wrong. Specific points worth flagging for an implementer building from the QR plus earlier full-rules chunks:

- **Mine "suspension" die for GRAV/WALKER vehicles contradicts the direct-fire rule already digested from p.39.** The QR's NON-PENETRATING HITS box (`qr-p2.checked.md`) gives only four suspension dice — Civ. wheeled D6, Mil. wheeled D10, Tracked D10, Hover D8 — with no entry for GRAV or WALKER vehicles, and the full-rules digest of p.39 (`sg-13-fire-b.md`) explains why: for ordinary non-penetrating direct-fire hits, GRAV and WALKER vehicles have **no separate suspension roll at all**, because their lift units/legs are protected by the same armour as the rest of the hull and cannot be damaged by a hit that already failed to penetrate. The mine rules on p.55 explicitly override this for mines only: "UNLIKE suspension hits from direct fire, GRAV (ground-skimming) and WALKER type vehicles roll a D12" against a mine. An implementer must therefore give GRAV/WALKER vehicles two different, mutually exclusive behaviours depending on attack type: immune to non-penetrating-hit suspension damage from direct fire, but rolling a D12 suspension die specifically against mines.
- **The mine rules box's own wording is loose about "Armour."** The printed boxed summary on p.55 says to roll the mine "D10 (mine) vs. SUSPENSION" and then describes the outcome as "Mine exceeds Armour = IMMOBILISED; more than twice = DISABLED" — using "Armour" as shorthand for the suspension-type die roll just described, not a separate vehicle Armour die. This is printed exactly this way in the source and is not a transcription error; implementers should not confuse this with the vehicle's actual Armour Class used elsewhere (e.g. against direct-fire penetration).
- **Casevac's area-effect confidence recovery: box vs. body text differ slightly.** The printed summary box says other units recover a Confidence level "on 5+ if within 12" (**and in sight**) of evac," but the full body paragraph states the condition only as "any other friendly unit... within 12" of the unit attended by the Casevac," with no explicit line-of-sight requirement. Both are printed as shown; an implementer following only the boxed rule would additionally require line-of-sight that the prose does not explicitly demand.
- **Armour Class notation for structures matches the vehicle-armour convention already in the QR** (`qr-p1.checked.md`'s ARMOUR table: "Vehicle Armour: D12 x Armour Class"), so no new die-mechanic is introduced by the Buildings and Fortifications armour-ratings table — only new example values (Armour Class 0 through 5) for structure types, which the QR does not list at all.

---

<details><summary>Checker's corrections</summary>

Checked line by line and box by box against sg-p54.png (printed 53), sg-p55.png (printed 54), sg-p56.png (printed 55) and sg-p57.png (printed 56), including pixel-level zoom crops (via a local script) of every boxed rule (REACTION FIRE, SURRENDER, INTERROGATION, CASEVAC, MINES, MINE CLEARING, CDM, DECOYS), the "actually in the danger area" sentence, and the full BUILDINGS AND FORTIFICATIONS armour-ratings table, and cross-checked the "Against the quick reference" GRAV/WALKER suspension claim against `sg-13-fire-b.checked.md`.

**Content (numbers, dice, thresholds, ranges, counts, table cells, conditions, worked examples): no errors found.** Every quoted paragraph, both worked examples (Reaction Fire's dash-across-open-ground example; the plasma-gun-at-a-bunker-door example), every boxed-rule summary, and every cell of the 8-row Buildings and Fortifications armour-ratings table (Armour Classes 0/2/3/5/0/1/2/3 with dice D6/D12x2/D12x3/D12x5/D6/D12/D12x2/D12x3) match the scans exactly, including preserved verbatim quirks (the "actually in the danger area" grammatical slip on p.55, the box's "vs. SUSPENSION" / "exceeds Armour" shorthand, the "REORGAN-/ISE action" page-break hyphenation, and the stray mark in "Armour Class 1·(D12)"). The task-brief/content mismatch note (this chunk actually holds Reaction Fire through Buildings and Fortifications, not the Fires/Flame/Smoke/Weather/Exotic-Environments material the brief listed) was independently confirmed against all four images — no such material appears anywhere on these pages — and is correctly kept as a labelled note rather than invented content.

**Two corrections made, both to descriptive/layout notes, not to any rule, number, or wording:**

1. **Printed page 56, note after the armour-ratings table** — was: "Table continues to the bottom edge of printed page 56 with no closing rule or further heading before the page footer; it may continue onto the next page, which lies outside this chunk's supplied images." — now: the table in fact ends cleanly after the "Heavy armoured door" row, followed only by the same blank bottom-margin seen before the page-footer number on every other page in this chunk (confirmed by comparing the gap against, e.g., the CASEVAC box's identical margin before the "54" footer on p.54); there is no positive evidence the table continues onto a further page, so the speculative continuation claim was removed.
2. **Printed page 56, note on the photograph** — was: "A full-page photograph occupies the right column of page 56 ... — captioned, no additional rule text." — now: the photograph and its caption occupy only roughly the top half of the right column; the BUILDINGS AND FORTIFICATIONS body text and the armour-ratings table continue below it in the same column (confirmed by zoom crop — the caption "...face of FSE Legionnaire resistance." sits directly above the "being made up of several sections..." body-text continuation). "Full-page" was inaccurate and could have misled an implementer into thinking the whole page 56 was one image with no further rules text on it.

No rule, die type, threshold, range, count, table cell, or condition anywhere in the four pages was found to be wrong, invented, or omitted in the first reader's transcription.

</details>

---

# Chunk 19 · pp. 57–59 · 20 Advanced and optional rules (end), 21 Record cards

Source: sg-p58.png (printed p.57), sg-p59.png (printed p.58), sg-p60.png (printed p.59).

## CHAPTER 20: ADVANCED AND OPTIONAL RULES (continued) — printed p.57

The page opens mid-section, continuing a topic (buildings under fire) whose heading appeared on an earlier page not in this chunk; no heading is printed above it here.

### [Continued: buildings under fire] — printed p.57

- Buildings that are hit by weapons fire are checked for effects **as for vehicles**: hits that fail to penetrate do no damage; hits that penetrate and would **DISABLE** a vehicle cause potential casualties among the occupants of a building (as for vehicle occupant casualties) but do not endanger the integrity of the structure; hits that would **DESTROY** a vehicle cause casualties accordingly and also reduce the building (or that part of a large "modular" structure) to rubble.
- Designer's note: the possibilities for civilian/fortified building types are almost endless and cannot all be detailed in the book; if such structures play a part in a game, players must supply their own specifications and any special rules required.
- Boxed rule (verbatim): "Buildings are treated same as vehicles when fired on; small areas (doors, windows) may be targeted specifically if desired."

### FIRES, FLAME AND INCENDIARY WEAPONS: — printed p.57

- Flame weapons (normally termed "Flamers" in SF) are specialised man-carried weapons that fire burning chemicals; short-ranged but very nasty. In Close Assault they are classed as **TERROR** weapons due to the fear they cause — very few men will stand and face an enemy with a flame weapon.
- The effects of Flamers in combat are covered under the normal close combat procedures (see Close Assault chapter), but any time they are used there is a chance the surrounding area will be set alight: roll a D6 — if the area is particularly flammable (decided by players/umpire) it catches light on a roll of **3 or greater**; if there is nothing much around to burn, only a **6** will cause a fire. Once a fire has been started, place one of the FIRE markers at the centre point of the action that caused the fire.
- Incendiary rounds may also be used, from artillery, aircraft or other weapons, to deliberately create fires; the use and effects of these should be regulated by the umpire depending on circumstances, as they will have much more effect in some situations than others.
- Once a FIRE marker is placed, an area of radius **3"** all around the counter is assumed to be ON FIRE (not necessarily a huge raging inferno, but probably a number of small fires scattered around the area). Any infantry figure or Softskin vehicle coming within 3" of a FIRE marker must roll its Armour protection vs. a **D4** for the fire — if the fire roll beats the Armour roll, the figure becomes a casualty in the usual way (as for small arms fire, mines etc.).
- Every FIRE marker on the table also produces SMOKE — see the SMOKE rules below.
- For every FIRE marker on the table, roll a D6 at each TURN END PHASE: on a roll of **1** the fire goes out; on a roll of **6** it spreads — roll for DEVIATION using the D12 clockface method plus a D6 for distance, and place another FIRE marker at the designated spot.
- An infantry unit may attempt to fight a fire by spending its whole activation (2 actions) doing so — in this case roll the die type nearest to the NUMBER of men in the unit (rounded up); if they roll **4 or better** then the fire is put out and that fire marker is removed.
- Boxed summary (verbatim):
  - "Flamer use causes FIRE on 6 in normal areas, 3+ if very flammable (D6 roll)."
  - "FIRE marker represents 3" radius fire area. Figures in area roll Armour vs. D4 for fire, casualties as normal."
  - "Roll per fire at turn end: D6 - 1 = fire out, 6 = fire spreads (deviation roll, D6 distance)."
  - "Firefighting: whole activation, roll die for no. of men, 4+ = extinguished."

### SMOKE: — printed p.57

- Smoke (which for game purposes includes any chemical agent designed for obscuration) may be produced naturally — by things on fire — or by artificial means.
- Smoke clouds block lines of sight and lines of fire — units may neither see nor fire through smoke.
- Component note: smoke should be represented on the table by cotton wool "balls" (available from any chemist), teased out until approximately **2" in diameter** — each such ball represents one small "cloud" of smoke.
- All fires produce smoke clouds that extend downwind from the FIRE marker. When the fire starts, roll a **D6** and place that number of smoke "clouds" in a continuous line extending downwind. In each TURN END PHASE, roll a D6 again for every fire on the table (after rolling to see if the fire remains alight):
  - **1** — remove all the smoke
  - **2** — remove one cloud from the upwind end
  - **3 or 4** — leave it as it is
  - **5 or 6** — add an extra cloud to the downwind end
- Artificially produced smoke lasts only a short time — all such clouds are removed at the Turn End Phase, regardless of when in the turn they were created.
- Infantry units and vehicles fitted with smoke dischargers may create a **three-cloud wide** smoke screen across the front of their present position, the clouds being placed **6" in front** of the unit or vehicle.
- Smoke shells may be fired by Artillery: place a number of clouds equal to the artillery type's **BURST RADIUS** (so a delivery system with a 6" burst radius would produce 6 clouds of smoke) extending downwind from the impact marker.
- Boxed summary (verbatim): "SMOKE is in 2" clouds; vehicles/squads produce 3 cloud screen 6" from unit. Shells produce clouds = to burst radius." / "Fires dice each turn end for change in smoke, 1 = gone, 2 = lose 1 cloud, 5-6 = add 1 cloud." (Note: the boxed summary omits the "3 or 4 = leave as is" case that the main text states; the main text is followed here as the fuller statement of the rule.)

### WEATHER CONDITIONS: — printed p.57

- Flavour/framing: fighting in adverse weather is usually harder for both sides than in good weather. The suggestions below give an idea of limitations that can be imposed; exact rules used can be varied to suit the scenario and location of the battle (especially if set off-Earth, on a colony world with climate extremes).
- **RAINY** conditions cause most terrain types to become **one grade worse** (e.g. POOR becomes DIFFICULT) for wheeled and tracked vehicles, and for all troops on foot. If the rain is deemed heavy enough it will also restrict maximum sensor range and make all direct fire treat its range band as if it were **one band greater** than it actually is. Falling snow will have similar effects, but can also (if sufficiently heavy) cut sensor range down **even less** [printed exactly as shown; the source text reads "even less," not "even further/more," though this may be an error in the original] and make many types of terrain completely impassable to ground vehicles. Heavy rain or snow may also prevent aerospace craft from flying.
- **VERY HIGH WINDS** (especially on non-terran worlds) may be so strong that only Powered troops and vehicles can stand against it — unsuited Infantry must remain in their vehicles. Such winds may also make Air and Interface missions impossible.
- There are many other possibilities for weather effects that can be explored if desired — dust and sandstorms in desert areas, fog and mist, etc. The best way of dealing with any weather effects is to write them into specific scenarios.
- **NIGHT FIGHTING** can be worked out on a similar basis to adverse weather conditions, but the text notes that most modern forces are very well equipped for night or low-light operations; with the provision of advanced sensors, image-intensification and the like, night fighting is far less difficult or restricted than it used to be.
- No numeric die-roll mechanics are given for rain, snow, wind, or night fighting beyond the descriptive limitations above — these are presented as guidelines for umpires/players to adapt, not as fixed tables.

### EXOTIC ENVIRONMENTS: — printed p.57–58

- Games set on other worlds (and even certain parts of Earth, e.g. desert or arctic regions) may have terrain and conditions very different from battles in Earth's temperate zones. Icefields, very hot/volcanic areas, high or low gravity, and vacuum environments can all be used for variety.
- The book states it cannot detail all such environments in full, and gives only brief guidelines:
  - GEVs and any conventional aircraft or helicopters cannot function on vacuum worlds.
  - Extremes of temperature and/or gravity mean all infantry must be Power suited.
  - Hostile/poisonous atmospheres require all troops and vehicles to be fully sealed at all times.
  - **Vacuum combat**: all troopers must be in fully sealed suits with life-support systems, and all vehicles must be airtight and pressurised. **All WOUND effects are considered KILLS when fighting in vacuum**, due to the fatal nature of almost any suit breach. Most weapons systems function normally in vacuum, but hovercraft (GEVs), VTOLs, helicopters and winged aircraft cannot operate — all flying craft require either Grav or Thruster propulsion. Vehicles with air-breathing (internal combustion) engines cannot be used unless they carry tanked air supplies.
  - "Exotic" scenarios can be used to balance games between otherwise incompatible forces, and can be an enjoyable change from the basic style of game.
  - Native flora and fauna — dangerous plants and randomly-roaming wildlife — can add twists to a game.
- Designer's aside: it is questioned as a cliché that a whole planet is classed as a "Desert World" or "Jungle World" in SF games/literature/movies — any planet within a star's habitable ("life") zone will have as much variation in terrain and climate as Earth does; average conditions may be hotter or colder, but even an arid low-water planet will have temperate bands at some latitudes. Human settlement on colony worlds will tend to cluster in the most easily habitable (Earth-like) areas, unless there is good reason to do otherwise (e.g. a mining colony where the ore is, even if it means a hostile environment).
- No new die-roll mechanics are introduced in this section; it is guidance/flavour for umpires designing scenarios.

### ALIEN RACES IN STARGRUNT II: — printed p.58

- The rules in the book are based on human-vs-human conflicts, but the framework functions equally well for human/alien or alien/alien games.
- A full, detailed treatment of alien races is planned for the first SGII supplement, provisionally titled **BUGS DON'T SURF!** [the authors note they hope to release it in the not-too-distant future but are not promising dates].
- In the meantime, to include alien forces, use the normal rules with "twists" to give alien forces a different feel from human armies — e.g. a human force of low-to-mid-tech troops and equipment against an alien invader with all Grav vehicles and energy weaponry, or vice versa.
- A more complex question than alien technology is alien psychology: if aliens react to combat conditions and stress exactly as human troops do, they are little more than the traditional "man in a rubber suit" Hollywood alien. What is really needed is to give each alien race its own unique variations in confidence, leadership, etc. — examples suggested: a race that reveres its unit leaders like gods, so that the death of one sends the rest of the unit into a kill-crazed frenzy; or a race where the sight of a retreating enemy unit triggers a berserker bloodlust and uncontrollable charge.
- Readers are invited to send in particularly good ideas for alien psychology/background, which the authors may use when producing the supplement.
- No new game mechanics (dice, thresholds, etc.) are introduced in this section — it is entirely design guidance and a supplement teaser.

## CHAPTER 21: RECORD CARDS — printed p.59

Introductory text:
- For ease of play, the book recommends the use of **three types of RECORD CARD**: MISSION CARDS, VEHICLE CARDS and SQUAD CARDS. Suitable blanks of each are provided on **P.71** — purchasers of the book are granted permission to photocopy these cards for their own personal use.
- The Vehicle and Squad record cards are intended to give all the data and statistics about a player's particular units needed during play, greatly reducing the amount of referring back to the rules required during play.
- It is suggested that players and umpires build up a "library" of Vehicle and Squad cards, one for each **TYPE** of vehicle or squad in their collection, so that the data cards for those unit types will be readily to hand when needed in a game.
- Note: a card is not needed for every separate unit in a game — just one for every **DIFFERENT TYPE** of unit. The cards are not intended to record changes of information during the game, but simply to provide the basic data; game events such as casualties or damage are recorded with on-table markers, **NOT** written on the cards.

### MISSION CARDS: — printed p.59

- Recommended for every game, whether a one-off battle or part of a campaign series: a MISSION CARD filled out for each player or side involved in the battle.
- The MISSION CARD gives all the important information about the player's objectives, forces, mission motivation, fatigue level, and support availability.
- Suggested workflow: filled-in mission cards are kept by the umpire after each game, since they can easily be reused if the same scenario is replayed later; this lets the umpire/players build a file of missions that can be combined in different ways for quick, easy game set-ups at any time.
- The mission card is for the player's reference only — no written records need be entered on the card by the player during the game.

**Fields on the MISSION CARD** (as printed, header "STARGRUNT II MISSION CARD"), with the printed worked example (Major Tim's platoon):

| Field (as printed) | Example entry (worked example) |
|---|---|
| COMMANDER | MAJOR TIM |
| FORCE | REINFORCED PLATOON (PA) |
| MISSION MOTIVATION | HIGH |
| FATIGUE LEVEL | FRESH |
| ADE (HOSTILE) | LOW (D6) |
| MISSION OUTLINE (boxed free-text area) | SURGICAL STRIKE TO OBTAIN TACTICAL DATA FROM ENEMY COMMAND POST. UNITS WILL INSERT BY HIGH ALTITUDE DROP AT GAME START. |
| PRIMARY OBJECTIVE (boxed free-text area) | ENTER COMMAND POST, RETRIEVE DATA FROM COMMAND TERMINAL; RECOVER AS MUCH OF FORCE AS POSSIBLE. |
| SECONDARY OBJECTIVE (boxed free-text area) | DESTROY COMMAND TERMINAL AND EXTRACT SURVIVING TROOPS IF POSSIBLE |
| FORCE ORGANISATION (boxed free-text area) | POWER ARMOUR PLATOON, 4 SQUADS OF 6 MEN EACH COMMAND SQUAD HAS 1 EW ELEMENT ATTACHED (2 MEN) ALL IN FAST, HEAVY PA SUITS. |
| SUPPORT ASSETS (boxed free-text area, left) | INTERFACE LANDER ON CALL FOR PICKUP. STARTS IN BOX 3 WHEN CALLED. NO ARTILLERY ASSETS AVAILABLE. |
| ORGANISATIONAL LEVEL (boxed field, right, paired on the same row as SUPPORT ASSETS) | AT COMPANY LEVEL |
| NOTES (boxed free-text area) | MUST SPEND 1 ACTION WITH EW OR COMMAND ELEMENT IN CONTACT WITH COMMAND TERMINAL TO RETRIEVE DATA. |

That is 12 distinct labelled fields (5 single-line header fields, 5 boxed free-text sections, plus the paired SUPPORT ASSETS / ORGANISATIONAL LEVEL row counted as two fields). No die types, thresholds or mechanics are defined by the card itself; MISSION MOTIVATION, FATIGUE LEVEL and ADE values are the same categories used elsewhere in the rules (e.g. Threat Levels for Confidence Tests are keyed to Mission Motivation per the quick reference), but this page does not restate those tables.

### VEHICLE CARDS: — printed p.59

- A Vehicle Data Card contains all the necessary game statistics for a particular vehicle **type**; it records not only the basic information about the vehicle (mobility, armour type, etc.) but also has space for the values needed in the game when firing the vehicle's weaponry or using its other systems.

**Fields on the VEHICLE DATA CARD** (header "STARGRUNT II VEHICLE DATA CARD"), with the printed worked example:

| Field (as printed) | Example entry (worked example) |
|---|---|
| NAME | LKPzW VI |
| TYPE | NSL HOVER MICV |
| SIZE | 3 (MED) |
| MOBILITY | GEV |
| ECM | D8 |
| ARMOUR — FRONT | 2 |
| ARMOUR — SIDE | 1 |
| CREW | 3 |
| INFANTRY CARRIED | 8 |
| WEAPONRY TYPE (table, one row per weapon system) | Row 1: GAC/1 (TURRET); Row 2: GSM/L (TURRET); Row 3: blank (spare row) |
| FIRECON (same table, per-weapon column) | Row 1: ENH (D8); Row 2: ENH GUID. (D8) |
| BASE IMPACT (same table, per-weapon column) | Row 1: D12; Row 2: D12x2 |
| NOTES AND OTHER EQUIPMENT (boxed free-text area) | DECOYS, SMOKE LAUNCHERS. |

That is 13 distinct labelled fields: 9 single-value header fields (NAME, TYPE, SIZE, MOBILITY, ECM, ARMOUR-FRONT, ARMOUR-SIDE, CREW, INFANTRY CARRIED), a 3-column x 3-row weaponry table (WEAPONRY TYPE / FIRECON / BASE IMPACT, with one row left blank on the printed example for a third weapon), and a NOTES AND OTHER EQUIPMENT free-text box.

### SQUAD CARDS: — printed p.59

- Like the vehicle cards, the Squad card records all the necessary information on one **type** of infantry squad or similar unit — how many members it has (when at full strength), what their weapon types are, the game stats for the weapons, and so on.
- It does **NOT** record information like unit leadership, quality level or confidence, as these vary from squad to squad — the card is only for the general type of squad rather than for a specific unit on the table.
- If a player DOES want a separate card per unit, that unit's quality, LV, etc. can be recorded in the NOTES box on the card.

**Fields on the SQUAD DATA CARD** (header "STARGRUNT II SQUAD DATA CARD"), with the printed worked example (a typical infantry squad):

| Field (as printed) | Example entry (worked example) |
|---|---|
| SQUAD TYPE | FSE LEGION INFANTRY SQUAD |
| FULL STRENGTH | 8 |
| ARMOUR | PARTIAL (D6) |
| MOBILITY | NORMAL (D6) |
| SENSORS | ENH. (D8) |
| SMALL ARMS TYPE (table row) | GAUSS ASSAULT RIFLE |
| — FIREPOWER (same table row) | 2 |
| — IMPACT (same table row) | D12 |
| SUPPORT WEAPONS (table, one row per weapon) | Row 1: GAUSS SAW; Row 2: GMS/P (ENH. GUIDANCE); Row 3: blank (spare row) |
| — FIREPOWER (same table, per-weapon column) | Row 1: D10; Row 2: D8 |
| — IMPACT (same table, per-weapon column) | Row 1: D12; Row 2: D12 |
| ATTACHED SPECIALISTS | SNIPER, GAUSS SNIPING RIFLE |
| NOTES AND OTHER EQUIPMENT (boxed free-text area) | ONE AGCI-5B APC ATTACHED FOR SQUAD TRANSPORT |

That is 9 distinct labelled fields/sections: SQUAD TYPE, FULL STRENGTH, ARMOUR, MOBILITY, SENSORS (5 single-value header fields), a single-row SMALL ARMS TYPE/FIREPOWER/IMPACT table, a multi-row SUPPORT WEAPONS/FIREPOWER/IMPACT table (3 rows printed, one left blank), ATTACHED SPECIALISTS, and NOTES AND OTHER EQUIPMENT.

### KEEPING OTHER RECORDS OF YOUR UNITS: — printed p.59

- If playing a series of games with the same forces, players will need to keep records of what happens to each squad or other unit in each game: casualties taken in each battle, any recovered troops and when they return to duty, replacements assigned, and so on.
- The text states these factors are more fully explained in the chapter on CAMPAIGN games (a different chapter, not part of this chunk).
- Suggestion: each player keeps a "unit roster" for their force, listing each squad and, if desired, each individual trooper — a player can even start assigning names to individuals, but the text warns: "as soon as you start identifying with individuals in your units you'll have a very different attitude to putting them out to get shot...!" (flavour/humour, transcribed as printed).

## Against the quick reference

- Chapters 20 (the fires/smoke/weather/exotic-environments/alien-races material on this page) and 21 (all three Record Card types and their fields) have **no counterpart at all** in the quick reference summary (qr-p1/qr-p2). A programmer building only from the QR would be missing: the FIRE marker mechanic (D6 ignition chance, 3" radius, D4-vs-Armour damage roll, D6 spread/extinguish rolls); the SMOKE mechanic (cloud placement, the D6 turn-end change table, discharger/shell cloud counts); the descriptive (non-tabular) weather-condition guidance; and the entire concept and field layout of Mission/Vehicle/Squad record cards.
- The record cards give concrete confirmation of vocabulary used loosely elsewhere: "FIRECON" on the Vehicle card corresponds to the QR's "Fire Control die" (used for FIRING HEAVY WEAPONS, qr-p2), and "ECM" on the Vehicle card corresponds to the QR's "ECM Systems Die" (the target's die for FIRING GUIDED MISSILES, qr-p2). Neither term is spelled out as an abbreviation on this page or in the QR.
- The worked-example weapon stats on the Squad card are consistent with the QR's Generic Weapons Table: GAUSS ASSAULT RIFLE at Firepower 2 / Impact D12 matches the QR's "Gauss Rifle" row (Firepower 2, Impact D12), and GAUSS SAW at Support Firepower D10 / Impact D12 matches the QR's "Gauss Machine Gun (SAW)" row exactly — no discrepancy found.
- The Vehicle card's ARMOUR fields (FRONT 2, SIDE 1) are Armour *Class* numbers only; per the QR's ARMOUR table ("Vehicle Armour: D12 x Armour Class"), these values must still be multiplied by a D12 roll to get the actual armour die result — the record card itself does not restate that multiplier, so a programmer reading only the card (without the QR/rules text) could mistake "2" and "1" for die-type values rather than multipliers.
- No numeric conflicts were found between this chunk and the quick reference on any point where both sources state a rule.

<details><summary>Checker's corrections</summary>

- WEATHER CONDITIONS, RAINY paragraph — was: "...but can also (if sufficiently heavy) cut sensor range down **even further** and make many types of terrain completely impassable to ground vehicles." — now: "...cut sensor range down **even less** [printed exactly as shown; the source text reads "even less," not "even further/more," though this may be an error in the original] and make many types of terrain completely impassable to ground vehicles." The printed page (sg-p58.png, right column) actually reads "even less," not "even further" — the first reading silently "corrected" what looks like an authorial slip; per instructions the page is transcribed as printed, with the oddity flagged rather than fixed.
- Chapter 21 intro, "library" paragraph — was: "...so that the data cards for those unit types will be "readily to hand" [printed exactly as shown] when needed in a game." — now: "...so that the data cards for those unit types will be readily to hand when needed in a game." The phrase "readily to hand" is not in quotation marks on the printed page (only "library" is quoted); the first reading added quote marks and a bracketed claim that they were "printed exactly as shown," which is not correct.
- Chapter 21 intro, "Note" paragraph — was: "The cards are not intended to record changes of information during the game; game events such as casualties or damage are recorded with on-table markers, **NOT** written on the cards." — now: "The cards are not intended to record changes of information during the game, but simply to provide the basic data; game events such as casualties or damage are recorded with on-table markers, **NOT** written on the cards." The first reading dropped the clause "but simply to provide the basic data," which is present on the page.
- MISSION CARD table, FORCE ORGANISATION example entry — was: "POWER ARMOUR PLATOON, 4 SQUADS OF 6 MEN EACH. COMMAND SQUAD HAS 1 EW ELEMENT ATTACHED (2 MEN). ALL IN FAST, HEAVY PA SUITS." — now: "POWER ARMOUR PLATOON, 4 SQUADS OF 6 MEN EACH COMMAND SQUAD HAS 1 EW ELEMENT ATTACHED (2 MEN) ALL IN FAST, HEAVY PA SUITS." The handwritten card has no periods after "EACH" or after "(2 MEN)" (confirmed at 3x zoom) — only line breaks and a single period at the very end, after "SUITS." The first reading inserted two periods that are not on the card.
- All other content checked against sg-p58.png, sg-p59.png and sg-p60.png at full resolution and at 2x–3x zoom crops where needed (the two boxed rule/summary panels on p.57, the WEATHER CONDITIONS paragraph, the "library" sentence, and all three record-card worked examples cell by cell): no further numeric, die-type, threshold, range, count, table-cell or verbatim-quote errors were found, and no rules present on the pages were missing from the digest, and no invented content was found elsewhere in the file.

</details>

---

# Chunk 20 · pp. 60–61 · 22 Campaign games

Source: sg-p61.png (printed p.60), sg-p62.png (printed p.61).

## Introduction (p.60)

*Heading added for structure; the printed page carries no heading here — this text runs directly under the chapter title "CAMPAIGN GAMES."*

Prose, no mechanics. Campaigns are usually a series of linked games following a larger military operation. The authors say a full campaign system could fill half the book, so the chapter only gives "a few ideas to start you off," and points readers to historical-wargame campaign books for logistics detail, noting that many of the same supply/maintenance problems apply even in an SF setting.

A successful campaign needs to account for the force's logistics "tail" (supply, fuel, maintenance, backup units), not just its front-line "teeth." If fuel, ammo, medical treatment, food and rest are not provided between battles, Confidence and combat efficiency suffer "VERY greatly" in the next battle. Between battles, forces can repair/recover damaged vehicles (a battle's winner can recover repairable equipment from both sides), bring units back to strength given resources and replacements, carry out reconnaissance, and be granted rest and recovery time.

The chapter frames the existing Quality/Confidence system as the mechanism for both improvement (surviving battles lets GREEN units become REGULAR, then aspire to VETERAN) and the "down side" (replacement troops — "Fungs" — dumped into a depleted unit can reduce its overall Quality).

## Untrained and Elite troops (p.60)

*This paragraph is printed at the top of column 2, BEFORE the "SUGGESTED CAMPAIGN STYLE:" heading — it is part of the chapter's unheaded opening matter, not printed under "IMPROVING TROOP QUALITY:". Its content is echoed again, almost verbatim, later inside the printed "IMPROVING TROOP QUALITY:" section (see below), which is presumably why the first draft filed it there; it is broken out separately here to match the page.*

UNTRAINED and ELITE units, representing the two extremes of the quality scale, are said not to really belong in the improvement progression. UNTRAINED units, being "basically civilian rabble," will not usually improve to GREEN or above unless actually given proper military training; the ELITE rating is reserved for Special Forces formed through extensive specialised training, and is not simply a further step up from VETERAN.

## Suggested Campaign Style (p.60)

*Printed heading: "SUGGESTED CAMPAIGN STYLE:"*

Prose/advice, no numeric mechanics. Because STARGRUNT II focuses on small-unit actions, the suggested campaign scale is a platoon or company per player (or player group), followed over weeks or months of game-time as a "tour of duty." An umpire is called essential to any good campaign set-up — the umpire runs a pool of other forces to pit against the players so the same two sides don't always fight each other, players can take turns controlling the umpire's opposition forces, or the umpire plays the enemy directly. Occasionally the umpire may have all players' forces meet and fight each other head-to-head; players not involved in a particular game can be pressed into service as subordinate commanders so no one is left out. The text explicitly says these ideas are "just the start" and that GZG hoped to expand the campaign game in future publications.

## Improving Troop Quality (p.60)

*Printed heading: "IMPROVING TROOP QUALITY:"*

- As already discussed (see above), UNTRAINED and ELITE troops "do not really fit into the normal progression of quality levels" [printed exactly as "UNTRAINED and ELITE troops to do not really fit into the normal progression of quality levels" — the extra "to" is a printed typo, transcribed verbatim] and should be dealt with on their own merits as befits the campaign's storyline.
- **Suggested point system:** award each unit points for each battle it participates in:
  - **3 points** for being on the winning side.
  - **1 point** for losing (the text notes: even a bad result gives experience — not a direct quotation in the original, just parenthetical).
  - **+1 point extra** for achieving the unit's own limited objective, even if its side loses overall.
- Track points from game to game. Thresholds to advance one quality level:
  - **5 points**: GREEN → REGULAR.
  - **8 points**: REGULAR → VETERAN.
  - These numbers may be changed to suit the campaign (a high intensity war against good opposition improves troops faster than suppressing a few rebel farmers...).
- Any quality rise from accrued points must be applied **before** allocating any replacement personnel (see below), because the replacement influx can itself drop quality again — in that case the improvement points are considered used up, and the unit starts accruing points afresh.
- Alternative method offered: the umpire may instead simply judge each unit's performance in the battle and assign (or withhold) level increases directly, much like a GM's allocation of "experience points" in some Role-Playing games; if done properly and without personal bias this will usually feel more realistic than the points system, but "as with everything here it is down to which method you prefer."

## Replacement Troops (p.60–61)

*Printed heading: "REPLACEMENT TROOPS:"*

- The level of replacements available in a campaign is left to the umpire, "in keeping with the campaign scenario."
- **Suggested mechanic:** each player rolls **one die per PLATOON** they have:
  - **D6** if few replacements are available.
  - **D8** if average.
  - Up to **D12** if plenty of new troops are coming in.
  - The die result = number of new soldiers available to fill gaps in that platoon's TO&E, distributed among its squads as the player wishes.
- Squads normally won't be assigned more new troops than they have spaces in their TO&E — but this is not a hard and fast rule: any "extra" troops could easily be attached to full units to make "reinforced" units.
- **Quality-drop check when assigning replacements to a depleted unit:**
  1. Take the unit's current strength (existing members, including any recovered wounded — see below); find the **die type nearest to that number** (round the die type **up** if necessary).
  2. Roll that die.
  3. If the roll **exceeds** the number of replacements being assigned → unit's Quality level is **unaltered**.
  4. If the roll is **less than or equal to** the number of replacements → unit's Quality **drops one level**.
  - Injured troops who return to their original unit after recovery do **not** count toward the "replacement number," but **do** count as part of the unit's current strength when making this roll.
  - **Worked example (numbers as printed):** A VETERAN unit with normal strength 8 has taken 3 casualties, of which 1 has recovered — current strength counted as 6. Assigning 2 replacements to bring it to full TO&E: roll a D6 (nearest die type to 6), needing to roll **3 or better** (i.e., exceed 2) to stay VETERAN; a roll of 1 or 2 drops it to REGULAR.
  - **Exception:** a GREEN unit will **not** normally drop to UNTRAINED (per the reasoning above). ELITE units will not normally be assigned "ordinary" replacement troops unless desperate for manpower — if this does happen they are subject to the same quality-drop roll as any other unit.
  - The umpire is told to feel free to adjust this system to fit the campaign, since many other factors can affect replacement availability.

*(For the "receiving and assigning replacements takes 1 day" rule, see Rest and Recovery below — it is printed inside that section on p.61, not under this heading, although it concerns replacements.)*

## Rest and Recovery (p.61)

*Printed heading: "REST AND RECOVERY:"*. In the source, everything below runs as continuous unheaded paragraphs inside this one boxed section; the sub-headings "Fatigue recovery," "Vehicle and equipment repair," "Injured troop recovery," "Replacements received during R&R," and "Fatigue accumulation" are added here for navigability and are not printed.

- Campaign timescale is left to the scenario (a major assault could throw troops into battle after battle with no gap; a low-intensity "brushfire war" could have days/weeks between contacts). As a working average, the chapter measures campaign time in **days**.
- All times below assume the unit is resting in a **safe area** with adequate supplies and sufficient engineering backup for repairs. If rest/repairs are attempted "in the field" and/or without suitable supplies, **DOUBLE** all times given.

### Fatigue recovery

- A unit takes **2 days** of R&R to recover its fatigue level from **EXHAUSTED to TIRED**, and a further **2 days** to reach **FRESH**.
- Any combat action during this recovery time means the unit must start accruing R&R time again from the beginning.

### Vehicle and equipment repair

- Repairing an **IMMOBILISED** or **SYSTEM DAMAGED** vehicle takes **1 day**.
- Repairing a **DISABLED** vehicle takes **3 days**; disabled-vehicle repair may **ONLY** be carried out "will full engineering facilities in a rear area" [printed exactly as shown — "will" for "with" appears to be a printing typo, transcribed verbatim per instructions, not corrected].
- Vehicles/equipment classed as **DESTROYED** may **not** be repaired.

### Injured troop recovery

- For injured troops recovered from a battle, roll **D6 per man**:
  - **1–2**: trooper is evacuated **permanently** to a rear-area hospital (for the campaign's purposes).
  - **3+**: trooper may return to duty after a number of **days equal to the score rolled** (i.e., 3–6 days).

### Replacements received during R&R

- Receiving and assigning replacement troops and equipment takes **1 day**, if and when they are available. This can occur during R&R time, but only at a **safe area**; units must wait until they are pulled out of the battle line before they can receive replacements.

### Fatigue accumulation (fighting without rest)

- After each battle fought without sufficient R&R, all troops drop **one fatigue level**; fatigue may only be recovered by R&R as above.
- If a unit is already at **EXHAUSTED** and must fight again, roll **D6**:
  - If the roll is **less than or equal to** the TOTAL number of actions fought since the last R&R period → the unit becomes unfit for battle and **MUST** be withdrawn from further combat until recovered.
  - Failure to withdraw it results in the unit **disintegrating** and being **lost** for the rest of the campaign.
- **Worked example (numbers as printed):** A unit starts FRESH, fights two battles in quick succession → drops to TIRED after the first, EXHAUSTED after the second. Forced into a third battle immediately (fighting it as EXHAUSTED), it must then roll D6 needing **4 or more** to be able to continue (this being its 3rd battle fought). If it passes and is kept in the line for a 4th battle, it must roll again needing **5 or better** to stay in action. The text notes that after **SIX** consecutive battles a unit can no longer pass the test and must be pulled out or is lost completely.

## Unit Histories

The chapter has no separate "Unit Histories" section or heading on either printed page (60–61); no such mechanic or table is printed here. (If a unit-history mechanic exists elsewhere in the rulebook, it is outside this chapter's two pages and was not found in the material reviewed.)

## Illegibility

Nothing on either page was illegible at the resolution reviewed; all numbers, thresholds and table entries above were read directly off the scans, including a check against 2–3x zoomed crops of the passages with printed typos or quotation marks in question.

<details><summary>Checker's corrections</summary>

Checked line by line against sg-p61.png (printed p.60) and sg-p62.png (printed p.61), including zoomed crops of the disputed passages.

1. **Removed a section of implementation notes.** The first reader, as asked, closed the chunk with notes on how these mechanics would plug into this repository's campaign layer (`src/campaign/`). That is analysis, not transcription, so it was taken out of the digest; the rules above are what the pages print.
2. **Misquoted parenthetical, p.60 ("Improving Troop Quality"):** the draft wrote `1 point for losing (a bad result "even gives experience")`. The book has no quotation marks here and the actual word order is "1 for losing (even a bad result gives experience)." Corrected; quotation marks removed and word order fixed.
3. **Misquoted parenthetical, p.60:** the draft wrote `suppressing "a few rebel farmers...)."`, adding quotation marks around "a few rebel farmers." The print has no quotation marks there (it reads "...suppressing a few rebel farmers...)." with an ellipsis before the closing parenthesis). Corrected.
4. **Misplaced quotation marks, p.60–61 (Replacement Troops):** the draft wrote `this is "not a hard and fast rule"` — the phrase "not a hard and fast rule" is NOT in quotes in the original. The book instead puts quotation marks around **"extra"** (as in "any 'extra' troops") and **"reinforced"** ("...'reinforced' units"); the draft kept the "reinforced" quote but silently dropped the "extra" quote and misquoted "not a hard and fast rule" instead. Corrected: "extra" is now quoted, "not a hard and fast rule" is not.
5. **Corrected a smoothed-over printed typo, p.61 (vehicle repair):** the draft's paraphrase read "...may ONLY be carried out **with** full engineering facilities..." The book actually prints "...may ONLY be carried out **will** full engineering facilities in a rear area" (confirmed via a 3x zoomed crop) — very likely a print typo for "with," but per the "never guess" instruction it is now transcribed verbatim, with a note, rather than silently fixed.
6. **Restored a dropped clause, p.61 (replacements during R&R):** the draft's sentence "Receiving and assigning replacement troops and equipment takes 1 day. This can occur during R&R time..." dropped the clause "**if and when they are available**," which follows "1 day" in the source. Restored.
7. **Structural/placement correction:** the "receiving and assigning replacements takes 1 day" rule is physically printed inside the "REST AND RECOVERY:" box on p.61 (between the Injured Troop Recovery and Fatigue Accumulation paragraphs), not under the "REPLACEMENT TROOPS:" heading on p.60 where the first draft filed it. Moved to the Rest and Recovery section (as a new "Replacements received during R&R" subsection), with a cross-reference left under Replacement Troops.
8. **Structural/placement correction:** the UNTRAINED/ELITE paragraph is printed at the top of column 2 on p.60, immediately BEFORE the "SUGGESTED CAMPAIGN STYLE:" heading — i.e., before "Improving Troop Quality" even begins, not inside it. The first draft filed the whole paragraph as the opening bullet of "Improving Troop Quality." Given that a shorter, near-identical restatement genuinely is printed inside "IMPROVING TROOP QUALITY:" ("As already discussed, UNTRAINED and ELITE troops...do not really fit..."), the two are now separated: the original standalone paragraph gets its own "Untrained and Elite troops (p.60)" section in printed order, and the short in-section restatement stays as a bullet under "Improving Troop Quality."
9. **Added a disclosure note for un-printed sub-headings.** The first draft presented "Fatigue recovery," "Fatigue accumulation (fighting without rest)," "Vehicle and equipment repair," and "Injured troop recovery" as if they were printed sub-headings under "Rest and Recovery." On the page these are all continuous, unheaded paragraphs inside a single "REST AND RECOVERY:" box. A note has been added disclosing that these breakout headings (plus the new "Replacements received during R&R" one) are editorial, matching how qr-p2.md flagged its own added headings.
10. **Minor wording restored, p.61:** "units must wait until they are pulled out of the battle line before they can receive replacements" (source) vs. the draft's "units must be pulled out of the battle line before they can receive replacements" — restored "must wait until they are" for exactness.
11. **Verified as correctly transcribed (no change):** the draft's verbatim rendering of the printed grammatical error "UNTRAINED and ELITE troops **to** do not really fit into the normal progression..." (extra "to") is confirmed present in the scan and was correctly kept as printed — flagged here only to confirm it was checked, not to correct it.
12. Everything else checked — the numeric content of the point system (3/1/+1, thresholds 5/8), the replacement die types (D6/D8/D12), the quality-drop mechanic and its worked example (8 troopers, 3 casualties, 1 recovered, strength 6, 2 replacements, D6, "3 or better"/"1 or 2"), the R&R day counts (2+2 days fatigue, 1/3 days vehicle repair, D6 1–2/3+ injured-troop roll with 3–6 day return, DOUBLE time "in the field"), and the fatigue-accumulation worked example (4-or-more on 3rd battle, 5-or-better on 4th, SIX consecutive battles) — all matched the printed pages exactly and needed no correction.

</details>

---

# Chunk 21 · pp. 62–64 · 23 Scenarios

Source: sg-p63.png = printed p.62, sg-p64.png = printed p.63, sg-p65.png = printed p.64.

## Chapter introduction (printed p.62)

Prose, no mechanics — summarised: Three simple scenarios are provided to get players started. In each, the forces are deliberately left unspecified — described only as "Blue force" and "Red force" — with compositions given as guidelines to be fitted to whatever troops/models the players own; when actually playing, descriptions can be tailored more exactly. Each scenario's special rules are meant as guidelines for designing similar scenarios of the reader's own. The author deliberately avoided overcomplicating the scenarios with heavy off-table support and other assets, though these can be added if desired. The author notes he does not claim these scenarios (except perhaps the first) are "balanced" — finding out is meant to be part of the fun; if this worries players, force compositions should be adjusted until everyone agrees.

---

## SCENARIO 1: RECON IN FORCE (printed p.62)

**SITUATION:** Prose, summarised — a simple encounter action between recon units of two opposing forces; an ideal starter game to introduce new players to the SGII system. Both Blue and Red armies are moving troops forward for a major battle; scouting parties from each force operate well ahead of the main bodies (even with satellite recon, there is no substitute for physically checking the ground — "the Grunts get the dirty job"). Though their main mission is reconnaissance, both forces are prepared to fight and will engage any enemy units they contact.

**FORCE COMPOSITION – BOTH PLAYERS:** Each player should organise approximately a platoon of light troops, without vehicle transport, with a Platoon Command squad as part of the force. A couple of supporting vehicles may be added if desired or agreed, but most infantry movement should be on foot.

**OBJECTIVES – BOTH PLAYERS:** Primary objective is to identify the enemy forces, by revealing all their inverted counters, and inflict as much damage on them as possible — ideally to force them to retreat from the table. Secondary objective for each player is to preserve his own forces wherever possible — this is, after all, only a scouting mission.

**MISSION MOTIVATIONS:** MEDIUM for both forces.

**FATIGUE LEVEL:** FRESH for all troops (they have just been inserted to their patrol areas).

**SUPPORT AVAILABLE:** None, unless players wish to be a bit more adventurous, in which case a mortar battery or similar organised at Company level may be allocated to either side; otherwise, assume all artillery and air assets are too busy covering the main force advances.

**TERRAIN SET-UP:** Anything the players or umpire wish; this scenario can be played on a fairly small area, especially if plenty of cover and terrain obstacles are provided to hide units.

**SPECIAL RULES:** Both players deploy their forces as face-down markers, one per unit, plus each player may roll a D8 and place that many dummy markers; once this is done and all markers are on the table, each player may REMOVE THREE of his OPPONENT'S markers from the table. The player must NOT look at the markers he removes, so he does not know exactly what strength of opposition he will be facing in the battle. If either side has their Command squad removed, they may exchange this with another of their real units left on the table (obviously, without their opponent seeing this). Normal rules for spotting and revealing of inverted markers apply after the game starts.

**VICTORY CONDITIONS:** A decisive win is forcing the opposition to leave the table, after identifying all their units; a moderate win is possible by withdrawing from the table after identifying all enemy inverted counters, while having suffered fewer casualties than your opponent. A drawn game is possible if both sides feel they have sustained enough casualties and decide to call it a day!

---

## SCENARIO 2: AMBUSH! (printed pp.62–63)

**SITUATION:** Prose, summarised — a typical ambush situation. Blue force is a convoy of a few trucks containing something important (gold, weapons, medical supplies — whatever the umpire wishes) escorted by a platoon of APCs full of infantry. Red force wants whatever is in the trucks and has set up an ambush for the convoy. Ideal for a guerrilla-type action, with Red force being low-tech, lightly-equipped insurgent troops.

**BLUE FORCE (CONVOY):** The Blue player has three APCs, each carrying a squad of infantry, and two to four trucks (unarmed/unarmoured civilian types) carrying the valuable cargo. One of the infantry squads should be designated the Platoon Command unit.

Quality for the escorting troops is variable, and should be picked from a mix of largely Regulars and Greens.

**OBJECTIVE – CONVOY PLAYER:** To get the trucks (or as many of them as possible) across the table and exit them along the road at the far end. Secondary objective is to destroy or force off-table the ambushing troops; as a last resort you may destroy the trucks yourself to prevent capture, but this will at best force a drawn game.

**MISSION MOTIVATION:** MEDIUM.

**FATIGUE LEVEL:** FRESH.

**SUPPORT AVAILABLE:** Battalion level artillery (3 gun battery) on call — if successfully requested, fire mission will start at box 2 of Inbound chart. Platoon Commander receives 1D4 Support Request chits.

**RED FORCE (AMBUSHER):** The Red player gets a Platoon of light infantry to carry out the ambush, consisting of two or three squads (depending on tech level, equipment and umpire's choice) with one being designated as the Platoon Command squad. One or two of the squads should be equipped with suitable anti-vehicle weapons such as GMS/Ps or IAVRs. 1D4 MINE counters are available (one must be an AV or Mixed type but others to the player's choice) along with 1D6 dummy markers — mines and dummies must be placed in the set-up phase, with at least one (real) AV or Mixed mine counter on the road to stop the lead APC (see special rules below).

The Red troops are good quality — pick from a mix of mainly Regulars and Veterans.

**OBJECTIVE – ATTACKING PLAYER:** To defeat the escorting troops of Blue force and capture the trucks containing the "valuables" — ideally at least some of the trucks should be captured intact and driveable, but this is not essential. Some losses to your force are acceptable, but heavy casualties are not — if the opposition proves too powerful, you should attempt to DESTROY the trucks and their contents before withdrawing.

**MISSION MOTIVATION:** MEDIUM.

**FATIGUE LEVEL:** FRESH.

**SUPPORT AVAILABLE:** None.

**TERRAIN SET-UP:** Fairly close terrain with the road running the length of the table, plenty of suitable cover to conceal the ambushers. The terrain to either side of the road should be passable to the APCs and troops on foot, but very difficult for the trucks — they should be basically confined to the road.

**SPECIAL RULES:**
- Movement of Blue forces is limited to travelling along the road until the trap is sprung.
- In the set-up stage, Blue should decide the travelling order of his convoy along the road — he must have one APC in the lead, but the remaining APCs and the trucks can be arranged as he wishes. All the convoy will travel in column with approximately 3" between vehicles. All Blue troops start the game mounted in their vehicles — they may not dismount until the ambush starts.
- Red should deploy his ambush by placing hidden markers for all his units and deploying his mines and dummies.
- The game starts at the point that the Blue convoy's lead APC is disabled by a mine planted in the road, which must be far enough along the road that the whole convoy is on the table. The disabling of the APC is automatic, but the Blue player should then roll to see what happens to the occupants using the normal rules. The disabled APC blocks the road, and the trucks may not move past it until it has been moved out of the way — as this cannot be done while under fire, the Blue force must defeat the ambushers before the convoy can continue.
- **Special option:** if the Umpire wishes to turn this scenario round and be really sneaky, the Blue convoy may be a trap set to catch the guerrilla group responsible for ambushes in the area; instead of the trucks carrying valuable cargo, each truck will have a squad of heavily-armed troops aboard which may be revealed and dismounted at Blue's discretion! In this version, Blue's objective is to kill or capture as many of the Red force as possible before they can escape.

**VICTORY CONDITIONS:** Blue wins decisively if he defeats the ambushers and is able to continue with the cargo (or at least most of it) intact; Red wins decisively if he manages to capture the valuables and destroy or drive off the defending troops. Other outcomes, including destruction of the trucks by either side, are basically drawn games.

---

## SCENARIO 3: THE REARGUARD (printed pp.63–64)

**SITUATION:** Prose, summarised — the war is not going well in this theatre for Blue force; they have just lost a major battle, and now their troops are streaming towards the rear in disorder with Red force units in hot pursuit. Small Blue reserve forces have been detailed to establish blocking positions at natural choke points on the main highways, to try to hold up the Red units long enough to get some of the withdrawing troops reorganised for a full defence of the region. Blue force in this scenario is one of these blocking forces; a small ad-hoc formation of the best resources Command could scrape together, mission to delay the advancing Red troops as long as possible. Retreating Blue units stream past them throughout, and in the early stages of the game the Blue player may attempt to persuade any of the retreating forces that are still in some kind of fighting shape to stop and join his defence.

**BLUE FORCE (DEFENDER):** Initially: one Command squad (Platoon commander) and two infantry squads, organised into an ad-hoc understrength Platoon. No vehicles available at start, but each squad will have its usual complement of support weapons. Quality levels will be Regular or Veteran (pick randomly for each squad); Platoon commander will be LV 1, squad leaders any LV (pick randomly).

During the game, reinforcements may become available from any retreating units that the player can stop and persuade to join the defence (see Special Rules below).

The initial force has 1D6 MINE counters available to it at the start of the game, which can be the player's choice of CDMs, AP, AV or Mixed mines; 1D8 Dummy counters are available. Mines and Dummies may be placed anywhere on the table EXCEPT on the main road.

**OBJECTIVE – DEFENDING PLAYER:** Delay the advancing Red forces as long as possible; every turn you hold out, the more of your army will reach safety and be able to rally for a counterattack across the whole front. Your own units know they are considered expendable, and are ready to do their duty; any of the retreating units that you convince to join you may not have this level of commitment — they have been in combat a long time already and are pretty shot.

**MISSION MOTIVATION:** Initial force, HIGH; retreating units that stop, MEDIUM.

**FATIGUE LEVEL:** Initial force, TIRED. Retreating units: as rolled on table below.

**SUPPORT AVAILABLE:** None.

**RED FORCE (ATTACKER):** At least two full Platoons, with light armour support if Umpire is feeling nasty! Pick Quality and Leadership randomly for all units, with Greens/Regulars/Veterans and all LVs in the mix.

**OBJECTIVE – ATTACKING PLAYER:** You must push through any defending forces as quickly as possible, but at the same time you know you cannot accept too many casualties — if you take heavy losses your force will not be in good enough shape to continue effective pursuit. Your high command is trying to balance the importance of continued pressure on the retreating enemy with the need to ensure your own army is strong enough to resist any counterattack.

**MISSION MOTIVATION:** MEDIUM or LOW (Umpire's choice).

**FATIGUE LEVEL:** FRESH or TIRED (determine randomly for each unit in force).

**SUPPORT AVAILABLE:** None.

**TERRAIN SET-UP:** The table layout is to the Umpire's discretion, but should include a main road running the length of the table (down which the retreating forces and their pursuers will come) and a "choke point" at the defender's end of the table which can be a village, a pass between hills or anything similar that suits the terrain available.

**SPECIAL RULES:**

The attacking Red force will enter the table at the beginning of the FOURTH turn.

The first three turns consist of various retreating units of the Blue army passing through the table; at the start of each of these turns, the Blue player may roll a D12 THREE TIMES and consult the table below to see what units pass through on that turn. In total, the Blue player may attempt to persuade up to SIX of the units passing to stop and join in the defence, with up to three of these attempts being made each turn but only on the units passing IN THAT TURN. Once his six attempts have been made, he may not try and stop any more units — thus if three units pass on each of the first two turns and he rolls to try and stop them all, he may NOT attempt to stop any of those who appear on the third turn (but roll them anyway, just to show him what he has missed…). To try and persuade a unit to stop, the Blue player's Command squad must be by the roadside; for each unit that passes, roll a D12 — the player must exceed the "score to beat" listed on the table to get the unit to join him. Units that refuse to join the defence or are not rolled for (because the player is out of rolls or is saving them in the hope of a better unit coming along) exit the table on the blue baseline in the same turn.

Once a unit has agreed to stop and help with the defence, it may be moved by the Blue player as normal and is subject to the normal timescale. Units retreating down the road ignore the normal movement sequence and simply traverse the length of the table in a single turn unless stopped by the Blue force (we assume the movement of these units is an abstract event which takes place outside the normal turn timescale).

**Example (as printed):** on turn one, the Blue player rolls three times and gets 2, 4 and 9: the 2 gives nothing, so the only units that pass down the road in the first turn are an exhausted half-strength squad of troops on foot and a truck carrying two exhausted but basically full-strength squads. The player decides the half-strength squad is not worth trying to stop, so saves his roll on that one; he does want to stop the truck, so rolls the D12 — he needs to roll a 7 or better (exceeding 6) to get the truck and its squads to stop. Whether he succeeds or not, he has used one attempt and thus has five left to use on whatever comes down the road in turns two and three.

### Table (printed pp.63–64; no printed title — see Checker's corrections)

| DIE ROLL | UNIT TYPE/FATIGUE LEVEL | SCORE TO BEAT |
|---|---|---|
| 1-2 | Nothing | - |
| 3 | Half-strength squad on foot/TIRED | 4 |
| 4 | Half-strength squad on foot/EXHAUSTED | 5 |
| 5 | Squad on foot/TIRED | 3 |
| 6 | Squad on foot/EXHAUSTED | 4 |
| 7 | APC/MICV, empty/TIRED | 4 |
| 8 | APC/MICV with squad aboard/TIRED | 6 |
| 9 | Truck with 2 squads aboard/EXHAUSTED | 6 |
| 10 | Jeep with specialist team (umpire's choice)/TIRED | 7 |
| 11 | Light/medium tank (or similar AFV)/EXHAUSTED | 6 |
| 12 | Light/medium tank (or similar AFV)/TIRED | 7 |

Roll is D12, rolled three times per turn during turns 1–3 (see procedure above). "Score to beat" is the number the D12 persuasion roll must exceed for that unit to stop and join the defence.

Umpire's note (prose, summarised): the Umpire should feel free to modify this table to suit the models available, or for any other reason. The first three turns could be conducted with the Red player out of earshot so he does not know what he is facing until his troops enter the table — in this case the Umpire may allow the Blue player to deploy his forces using the hidden units and dummy markers rules (as in Scenario 1). Troop types can be adjusted to suit the relevant forces and tech levels — a few could be in Power Armour if desired. Unit strengths can likewise be adjusted to the Umpire's choice — "full strength" squads could be missing one or two men, or even slightly overstrength having picked up a few stragglers from other units, and "half-strength" units could be anything from a couple of men to five or six. To be even more devious, the Umpire could give some of the retreating units casualties they are carrying with them, creating a moral dilemma for Blue — he may need the troops, but does he dare stop the casualties getting to hospital? This kind of scenario can introduce a role-playing element often missing from straight miniatures battles.

**VICTORY CONDITIONS:** The Red player starts with 10 points at the time he enters the table on turn 4. For each subsequent turn that he fails to exit any of his units from the Blue baseline, he loses one point; for each of his units that is reduced to a BROKEN state or lower, he loses one point (even if it is later rallied). For any of his units that are destroyed altogether or rout off the table, he loses TWO points. If the Red player succeeds in defeating the Blue defences (or bypassing them and getting all his surviving units off the Blue baseline) before he reaches 0 points or less, he has won — otherwise the victory goes to Blue.

---

<details><summary>Reader's notes</summary>

- Printed p.62 has an illustration accompanying Scenario 2, occupying roughly the lower half of the page in the right column only (not the full page — the left column alongside it is entirely Scenario 1 body text); it shows a soldier under fire with an APC and a light tank/APC behind him. Printed p.63 has a full-width photo of painted miniatures (APCs and infantry); one vehicle in the photo is marked "556"/"FSE". Printed p.64 has a line illustration of a soldier in power armour. None carry rules text and are not transcribed.
- On printed p.64, the mine list for Scenario 3's initial force reads "CDM s, AP, AV or Mixed mines" in the source scan — the "CDMs" appears to have an unintended space before the final "s" (a kerning/print artifact); transcribed above as "CDMs" per its evident intent, since GZG's other mine-type abbreviations (AP, AV) are unspaced acronyms elsewhere in this book.
- All numbers, dice types, and table values on these three pages were legible; nothing was marked [illegible].
- Section order on printed p.63 is: (top of page) large photo spanning the page width, then two columns of body text — left column finishes Scenario 2 (Blue-force/Red-force paragraph, Objective, Mission Motivation, Fatigue Level, Support Available, Terrain Set-up, Special Rules, Victory Conditions), right column begins Scenario 3 (Situation, Blue Force (Defender)). This transcription preserves that logical order rather than the raw column layout.

</details>

<details><summary>Checker's corrections</summary>

Checked against sg-p63.png (printed p.62), sg-p64.png (printed p.63), sg-p65.png (printed p.64), line by line. The first-reader transcript was accurate on every number, die type, and table cell (all three Force/Objective/Support blocks, the 1D4/1D6/1D8/D8/D12 dice counts, the "3 gun battery"/"box 2"/"3\" between vehicles"/"LV 1"/"FOURTH turn"/"SIX"/"10 points"/"one point"/"TWO points"/"0 points" figures, and every row of the 12-row reinforcement table) — no numeric, dice, or table-cell errors were found, and nothing on the three pages was omitted or fabricated. The corrections below are wording-fidelity fixes in body text that is not marked as a paraphrased summary, plus two factual fixes to the reader's own notes:

1. **Scenario 1, Special Rules** — "once done and all markers are on the table" corrected to "once **this** is done and all markers are on the table" (word omitted).
2. **Scenario 1, Special Rules** — "...so he does not know exactly what strength of opposition he will be facing." corrected to "...he will be facing **in the battle**." (clause omitted).
3. **Scenario 1, Force Composition** — "if desired/agreed" corrected to "if desired **or** agreed" (printed text uses "or", not a slash).
4. **Scenario 1, Objectives** — the clause "this is, after all, only a scouting mission" is plain prose in the original with no quotation marks; the draft had wrapped it in a quoted aside. Corrected to remove the added quotation marks.
5. **Scenario 2, Blue Force (Convoy)** — "picked from a mix **largely of** Regulars and Greens" corrected to "picked from a mix **of largely** Regulars and Greens" (word order reversed in the draft).
6. **Scenario 3, Special Rules** — "he may not **try to** stop any more units" corrected to "he may not **try and** stop any more units" (matches the printed colloquial phrasing, and matches the parallel "he rolls to try and stop them all" a few words later, which the draft had already transcribed correctly).
7. **Reader's notes** — the draft described the page-62 illustration as "full-page." On the actual page it occupies only the lower portion of the right-hand column; the left column alongside it is unbroken Scenario 1 text. Corrected.
8. **Reader's notes** — the draft said the page-63 photo has "one figure marked '556'/'FSE'." The "556" and "FSE" markings are painted on a vehicle hull, not on a human figure. Corrected to "one vehicle marked."
9. **Structure/heading note** — the "Rearguard reinforcement table" has no printed heading on the page; it follows directly on from the paragraph's reference to "the table below." The draft's "### Rearguard reinforcement table" heading was a transcriber addition presented without a flag. The corrected file relabels this heading to say explicitly that it is not printed, matching the convention used in qr-p2.md for its own added headings.

No content was found on the three pages that the draft left out, and no rule, name, or condition in the draft was found that is not actually on the pages.

</details>

---

# Chunk 22 · pp. 65–66 · 24 Background

*Source: sg-p66.png = printed p.65; sg-p67.png = printed p.66.*

## Introduction (p.65)

No mechanics on this page — prose only, summarised:

The chapter opens with a disclaimer: the background presented is "a suggestion, not a recommendation" — an expanded version of the Timeline already used in the publisher's FULL THRUST and DIRTSIDE II rules, offered as a common setting for players who want to integrate all three games, but entirely optional ("if you don't use the "OFFICIAL" game setting..."). The period 2000–2100 AD is skipped here because it is already covered in FULL THRUST; the 2101–2183 span has been greatly expanded with ground-war detail relevant to STARGRUNT II. The author also flags the 21st-century part of the timeline (e.g. the Second Secessionist War/2nd American Civil War, 2049–57) as fertile ground for future material, and notes military hardware realistically stays in service a long time, so "modern" figures/equipment are fine for games set in the 21st century.

## TIMELINE: (pp.65–66)

Before the year-by-year entries, the printed "TIMELINE:" heading itself carries three scene-setting paragraphs (these come *after* the heading, not before it, contrary to the previous draft): by the dawn of the 22nd century the Jump Drive (developed in the 2060s) has enabled interstellar colonisation, but old rivalries were exported to the new worlds along with the settlers, especially in the "Inner Colonies" near Earth where many nations planted competing settlements. The two largest power blocs on Earth and in colonised space are named as the New Anglian Confederation (NAC) — a primarily British-controlled alliance encompassing Canada and the former USA which grew out of the rubble of the Second American Civil War — and the Eurasian Solar Union (ESU), a Chinese-dominated Sino-Russian bloc; the United Nations (UN), by now an independent body with its own resources and military forces, tries to keep some kind of lid on international (and now interstellar) relations. A third paragraph notes that as the new century opens, Europe and its colonial possessions are once again the major hot-spot of unrest, as the United Federal Europe (UFE) breaks down under increasing arguments between its member states — leading directly into the 2101 entry below.

Compact year-by-year digest of the printed timeline (all years, powers, unit/commander names and place names as printed; wording condensed):

| Year | Event |
|---|---|
| 2101 | United Federal Europe (UFE) disintegrates: Germany, Austria + East European states form the Neu Swabian League (NSL); France + remaining members (Italy, Spain) reform as the Federal Stats Europa (FSE). Border incidents escalate to open FSE/NSL war; FSE overruns NSL Inner Colony settlements Trelleborg and Flensberg, then Outworld colonies Wittenberge, Kecel and Lienz; on Earth, Baden Wurttemberg, Bayern and parts of the Rhineland fall to FSE armour. |
| 2102 | NSL General Janos Matthias halts the FSE armour at the Battle of Breznice; an NSL counter-thrust only regains ground up to the Danube. **In late 2102** the Netherlands (an unwilling "associate member" of the FSE since the UFE's collapse) breaks all ties with the FSE and, refusing an alliance offer from the NSL, reasserts its independence, ejecting all FSE influence from its homeland and colonial possessions. |
| 2103 | While the FSE/NSL war on Earth/Inner worlds stagnates, the battles in the Outworlds intensify; NSL commando raids/planetary assaults on FSE colonies cause damage but cannot mount full-scale assaults. |
| 2104 | Treaty of Saarbrucken (UN- and NAC-sponsored) ends the FSE/NSL war, fixing territorial boundaries on Earth and the Inner Colonies and spheres of Outworld influence. |
| 2110 | Indonesian Commonwealth air attacks start a war with the Oceanic Union over Papua New Guinea; Indonesians defeat the Oceanic 6th Infantry Division at Aitape, take the Long Islands and Admiralty Islands, and beachhead the New Islands; advance stopped at the Mouths of the Fly River (Southern Papua). |
| 2111 | Oceanic forces counter-attack with two armoured and three infantry divisions, taking Traigan, Jamdena and Timor; halts after the Battle of Ramang in the South Banda Sea; war grinds toward an indecisive close after a half-hearted late Indonesian offensive. |
| 2112 | Sydney Accord officially ends the Papua New Guinea War. |
| 2123 | Islamic Federation and ESU forces clash on Earth: the ESU massacres Muslims on the Indian subcontinent; mostly cross-border raids/artillery duels; UN diplomacy prevents full escalation; Beijing government punishes the **Hindu** officials who sanctioned the pogrom. |
| 2127 | One hundred years after the effective destruction of Israel by Arab terrorist groups, the Jewish colony government on New Israel renews its pledge of "never-ending war" against "anti-Zionists"; to date this "war" has largely been the province of the **New Israeli Intelligence and Special Forces**, but Rabbi Avraham Yoffe's statement that the Jewish state would avenge the destruction of their original homeland marks the start of Operation Jericho, in which New Israeli Interface and Airborne units assault and destroy several Islamic bases on the Inner Colonies. |
| 2128 | LLAR mercenary forces (San Deseado Interface Brigade), hired by the Indonesian Commonwealth to protect Caroline Islands installations, clash with New Anglian forces against the will of their employers. Indonesians execute the entire LLAR Brigade to appease the Anglians, starting the "Mercenary War." |
| 2129 | Dutch mercenaries of the Van Koost Armoured Legion (for the Indonesians) recapture Easter from LLAR regulars and a Turkish mercenary unit. A Swiss mercenary strike force (for the LLAR) raids an Indonesian logistics centre in Manila on Earth but is repelled by local forces and Japanese mercenary troops, who use nerve agents — causing heavy Japanese casualties and severe UN protest. |
| 2130 | Shi'ite fundamentalists on the Islamic Federation's Outworld settlements Abu Haman and Sad Al Bari declare independence; the Saudi 2nd Islamic Legion sent to suppress them defects under Mullah Saeed ibn Aamir; the two colonies form the Saeed Khalifate and turn to hiring out mercenary units, later renowned as among the toughest in Human space. |
| 2131 | Israeli and Islamic mercenaries clash with each other on Easter while both under Indonesian contract; both contracts revoked, and the Commonwealth officials responsible are punished. |
| 2132 | The Mercenary War ends with the Mercenary Charter signed on the Dutch-settled world of Freisland: settles the LLAR/Commonwealth reparations dispute and lays down a code of conduct for mercenary units and employers, adopted by most nations/blocs. |
| 2133 | Radical French separatists in Bretonneux, Doullens and Compville declare unilateral independence from the FSE; Colonial Legion elements (1e REP, 5th and 13th DBLC) defeat the rebels' main forces after stronger-than-expected resistance, but a prolonged guerrilla war continues. |
| 2137 | ESU declares war on the NAC ("hostile actions and intents of the Imperialists"), starting the First Solar War (five years) across the Inner Colonies and Outworlds. ESU forces invade NAC Salzburg but are repelled; an ESU Naval Infantry Assault Division takes the NAC Outworld base of Lancelot; an **inconclusive** NAC/ESU space skirmish off Grendel begins major naval offensives on both sides. |
| 2138 | NAC launches Operation Jester: ESU possessions on Mariana and Trelleborg fall rapidly, but an attempt on Chiang is beaten back; an attempt to retake Lancelot also fails, with heavy losses to the Anglian 2nd Drop Cavalry. |
| 2139 | ESU 15th Guards "Zhukov" Division and 135th "Tyulenev" Division land on Flensberg and invest the Anglian settlement of Faith; defended by Local Volunteer Reserve troops and the 3rd Infantry Brigade (reformed Gurkha Rifles) for nearly nine months until General Pauline Chappell's relief force repels the Eurasians. |
| 2140 | Operation Season's End: NAC seizes the ESU outposts of Mikhailovka and Showyang, both against heavy resistance. |
| 2142 | The Accord of Freisland ends the First Solar War; Anglians hail it as a major victory while the ESU licks its wounds. |
| 2145 | Second Solar War begins: a surprise ESU strike on the Romanov Hegemony (RH); NAC and NSL back the RH against "Communist aggression" while the FSE and the Pan African Union (PAU) join the Eurasian side. |
| 2146 | ESU launches a campaign to regain colonies lost in the First Solar War: retakes Trelleborg and Showyang after short campaigns; a joint FSE/PAU invasion force is beaten back on Dnestr by Romanov defenders, who hold their major towns as invaders regroup in the outback. |
| 2147 | ESU retakes Mikhailovka and raids the Anglian settlements of Bifrost and Valhalla. |
| 2148 | NAC forces under Admiral Sir Andrew Le Throux launch Operation Dryland, a surprise attack on the PAU-settled world of Grand Lahou, taking the townships of Bouna and Markounda despite strong PAU/FSE naval resistance. |
| 2149 | NAC and NSL launch Operation Galahad to retake Lancelot; ESU General Lech Pawodowski (57th Combined Division) beats back attack after attack for seventy days before surrendering with full military honours — **one hundred and forty** survivors of his Division taken captive. |
| 2150 | Neu Swabian forces attempt to take the FSE settlement of Di Persano but are repulsed by System Defence forces; a PAU strike force fails to recapture Grand Lahou. |
| 2151 | Romanov assault forces land on the ESU colony of Nizhneudinsk and campaign to capture its major townships; NAC political agents fail to persuade the Manchu government on Chiang to rise against the ESU. |
| 2152 | Boer Voortrekkers claim a large subtropical area on Iylichograd, naming it Neu Transvaal. Operation White Feather — an Anglian attempt to remove Eurasians from the Chi Draconis system — ends in Anglian defeat in space and on the ground from sheer weight of numbers. |
| 2154 | FSE concludes a peace treaty with the NAC/NSL/RH alliance, withdrawing from the Second Solar War; PAU makes one last abortive attempt on Grand Lahou before joining peace negotiations. |
| 2155 | ESU assaults the NAC-held Winchester system with a massive task force and large troop landings; Planetary Defence troops hold on through Winchester's long, bitter winter. |
| 2156 | Anglian Naval units under Rear Admiral Dame Jayne Oppenburger jump into Winchester and defeat the ESU fleet; the Eurasian ground troops surrender unconditionally after their fleet's virtual destruction. |
| 2157 | The Treaty of Khorramshahr ends the Second Solar War. |
| 2159 | California and Texas secede from the NAC, forming Free Cal-Tex (FCT), claiming the small colony settlements of Austin and Fenris (renamed New Pasadena). |
| 2163 | Islamic fundamentalists seize power in New Riyadh, murdering the remaining Saudi royal family; a two-year loyalist civil war fails; the Islamic Federation grows increasingly hostile to both the NAC and ESU. |
| 2164 | ESU forces on Iylichograd move on the Neu Transvaal colony and claim its mineral resources; Boer settlers withdraw to the jungle and begin a guerrilla war against the occupying Eurasians. |
| 2165 | Third Solar War begins: NAC launches a major operation to regain worlds lost under the Treaty of Khorramshahr; early successes falter as the FSE again allies with the ESU, funding LLAR and Indonesian mercenary contingents. |
| 2166 | NSL attacks its spatial border with the FSE; mercenary troops from New Israel are hired by the Anglians. |
| 2168 | ESU Naval forces enter the Treralis system and attempt to take the Romanov-held settlement of Tsitsihar; the Eurasian fleet under Admiral Jia Dehuai defeats the system defence forces but at such cost that the assault force is too weak to beach-head against fierce Planetary Defence resistance. |
| 2169 | NAC-sponsored French separatists in Bretonneux and Doullens overthrow Federal forces and proclaim the New French Republic; a similar insurrection in Compville fails. |
| 2170 | Scandinavian mercenaries employed by the NAC overrun Compville and install the separatists in government; Compville joins the New French Republic, still denied diplomatic recognition by the UN due to FSE pressure. |
| 2171 | War enters a relatively quiet phase of minor skirmishing and diplomatic posturing as major powers rebuild depleted forces; an uneasy "peace within war" ensues. |
| 2177 | A sudden ESU fleet attack on the Anglian Nagisa system opens the next "hot phase" of the Third Solar War; Nagisa falls quickly after a warning orbital bombardment. NSL regulars and Swiss mercenary units strike FSE settlements on the inner colony of Flensberg. |
| 2179 | The colony of Bradley on Fliescher II falls to FSE units under General Henri de Pascalle, despite nearly six months' resistance from the 136th Gloucestershire Regiment; the FSE pours massive armour reinforcements into Bradley to forestall NAC attempts to regain it. |
| 2181 | On Kayleigh, NSL and NAC armoured forces are defeated by LLAR mercenary units; NAC General Heinrich Vortsheimer, leading the Allied troops, is relieved of command following the reverse. |
| 2182 | The ESU lands Khalifate mercenaries on Tsitsihar to reinforce its offensive against Romanov units in the colony. |
| 2183 | Indonesian mercenary units working for the ESU capture NSL possessions on Salzburg; with Khalifate help the ESU finally takes Tsitsihar from the Romanovs. Separately, the UNSC Survey Cruisers *Niven* and *McCaffrey* are lost on an Outworld-rim mission; the UNSC despatches the PeaceForce Cruiser *Heitman* to investigate — it finds *Niven* debris showing signs of combat but no trace of *McCaffrey* or any hostile forces; no spacegoing nation admits involvement, and speculation grows that the UN is suppressing information about the unknown aggressors. |

**Closing note (p.66):** the printed Timeline ends at 2183, "on the brink of first contact with alien sentients, that will lead to the terrible XENO WAR." Readers who own MORE THRUST (the Full Thrust starship-combat supplement) will already know how the first years of the Xeno War unfold; since STARGRUNT II deals mainly with human-vs-human conflict, the authors say they are deferring alien-force combat to a future volume.

## Powers named in the Background chapter (one line each)

- **New Anglian Confederation (NAC)** — British-controlled alliance encompassing Canada and the former USA, which grew out of the rubble of the **Second American Civil War** (elsewhere in the chapter also called the Second Secessionist War, 2049–57); with the ESU, one of the two largest Earth power blocs; principal combatant of the First, Second and Third Solar Wars (2137–2183+).
- **Eurasian Solar Union (ESU)** — Chinese-dominated Sino-Russian bloc; the other of the two largest power blocs; NAC's main adversary through all three Solar Wars, and ally of the FSE/PAU in several of them.
- **United Nations (UN)** — by the 22nd century a fully independent body with its own resources and military forces (including the UNSC); tries to keep a lid on international/interstellar relations; sponsors the Treaty of Saarbrucken and the Sydney Accord; investigates the 2183 *Niven*/*McCaffrey* incident and is suspected of covering it up.
- **United Federal Europe (UFE)** — pre-2101 European union (member states include France, Germany, Austria, Italy, Spain); disintegrates in 2101 amid disputes over French domination, splitting into the NSL and FSE.
- **Neu Swabian League (NSL)** — formed 2101 by Germany, Austria and several East European states seceding from the UFE in protest at French domination; fights the FSE (2101–2104), later allies with the NAC (and Romanov Hegemony) against the ESU/FSE in the Solar Wars.
- **Federal Stats Europa (FSE)** — formed 2101 when France and the remaining UFE members (notably Italy and Spain) reform after the UFE's collapse; fights the NSL (2101–2104); allies with the ESU/PAU in the Second Solar War and again with the ESU in the Third; fields the Colonial Legion (1e REP, 5th/13th DBLC).
- **Indonesian Commonwealth** — fights the Oceanic Union over Papua New Guinea (2110–2112); hires then executes the LLAR Brigade (2128), triggering the Mercenary War; later supplies mercenary units to the ESU (2183).
- **Oceanic Union** — Pacific power that fights the Indonesian Commonwealth over Papua New Guinea, ended by the Sydney Accord (2112).
- **Islamic Federation** — clashes with the ESU on Earth (2123 pogrom against Muslims); loses its Abu Haman/Sad Al Bari colonies to Shi'ite secessionists who form the Saeed Khalifate (2130); grows hostile to both the NAC and ESU after the 2163 New Riyadh coup.
- **New Israel** — Jewish colony state whose government renews a "never-ending war against anti-Zionists" in 2127 (Operation Jericho, via New Israeli Intelligence/Special Forces and Interface/Airborne units); supplies mercenaries later hired by the NAC (2166).
- **LLAR** — mercenary organisation (fields units such as the San Deseado Interface Brigade); hired and then wiped out by the Indonesian Commonwealth (2128), sparking the Mercenary War; continues supplying mercenary units afterward, including forces that defeat NSL/NAC armour on Kayleigh (2181).
- **Saeed Khalifate** — mercenary state formed 2130 by Shi'ite fundamentalist secessionists (led by Mullah Saeed ibn Aamir) from the Islamic Federation's Abu Haman and Sad Al Bari colonies; its mercenary troops become renowned as among the toughest in Human space; hired by the ESU (2182) against Romanov forces.
- **Van Koost Armoured Legion** — Dutch mercenary armoured unit that fights for the Indonesian Commonwealth in the Mercenary War (recaptures Easter, 2129).
- **Pan African Union (PAU)** — allies with the ESU/FSE against the NAC/NSL/Romanov Hegemony in the Second Solar War; its colony world Grand Lahou is attacked by the NAC in Operation Dryland (2148) and defended unsuccessfully through 2150.
- **Romanov Hegemony (RH)** — backed by the NAC and NSL in the Second Solar War against the ESU's **"Communist aggression"**; holds the colonies Dnestr, Nizhneudinsk and Tsitsihar; loses Tsitsihar to the ESU (with Khalifate/Indonesian mercenary help) in 2183.
- **New French Republic** — proclaimed 2169 by NAC-sponsored French separatists in Bretonneux and Doullens after overthrowing FSE Federal forces; joined by Compville in 2170; denied UN diplomatic recognition due to FSE pressure.
- **Free Cal-Tex (FCT)** — formed 2159 when California and Texas secede from the NAC, claiming the colony settlements of Austin and Fenris (renamed New Pasadena).
- **UNSC** — the United Nations' space/naval arm; operates Survey Cruisers (*Niven*, *McCaffrey*) and the PeaceForce Cruiser *Heitman*; loses two ships to unknown forces at the Outworld rim in 2183, the incident that foreshadows first contact with aliens and the coming Xeno War.

## Ties to Full Thrust / shared universe

- The chapter states outright that this Timeline is "an expanded version of the Timeline used in our FULL THRUST and DIRTSIDE II rules," provided as "a common starting point for integrating all the games."
- The pre-2100 period (2000–2100 AD, including the Jump Drive's development in the 2060s) is explicitly left out here because it is "fully detailed in FULL THRUST."
- The major factions — NAC, ESU, FSE, NSL, and the Pan African Union (PAU) among others — correspond to Full Thrust fleet/faction books of the same names; the First, Second and Third Solar Wars described here are the same conflicts fought out in Full Thrust starship actions (e.g., the ESU fleet actions at Lancelot, Grendel, and Winchester, and the Anglian victory at Winchester under Rear Admiral Dame Jayne Oppenburger).
- The chapter's final paragraph ties directly into Full Thrust's alien-invasion supplement: "those of you who have a copy of MORE THRUST (the supplement to our FULL THRUST Starship Combat rules) will already be aware of how the first few years of the Xeno War unfold." The 2183 loss of the UNSC Survey Cruisers *Niven* and *McCaffrey* on the Outworld rim is presented as the seed incident for that Xeno War.

## Illegible / uncertain

None. Both pages (printed pp.65–66) were fully legible at the scan resolution provided; no numbers, dice values, or proper names required guessing. (A small pen-and-ink signature/date mark appears under the illustration on p.66, but it is decorative artist signage, not rules text, and is not transcribed.)

<details><summary>Checker's corrections</summary>

Checked sg-background.md against sg-p66.png (printed p.65) and sg-p67.png (printed p.66) line by line. Corrections made:

1. **Misdated event (2101 → 2102).** The original placed "The Netherlands also breaks from the FSE late this year, ejecting FSE influence" under the 2101 table row. The page text actually reads "**In late 2102**, the Netherlands ... breaks all ties with the FSE ..." as the second paragraph of the **2102** entry (p.65), not part of 2101. Moved the sentence to the 2102 row and restored the year.
2. **Fabricated/duplicated content (2145 row).** The original's 2145 row appended "ESU attacks NAC Salzburg; an ESU Naval Infantry Assault Division takes NAC Outworld base Lancelot; a skirmish off Grendel starts major naval offensives" — none of this is in the printed 2145 paragraph. That material (Salzburg invasion, Lancelot's capture by an ESU Naval Infantry Assault Division, the Grendel skirmish) belongs solely to the **2137** entry, where it is correctly reported. Removed the duplicate from 2145, which per the page consists only of the Romanov Hegemony surprise strike and the NAC/NSL/FSE/PAU alignment sentence.
3. **Dropped word changing meaning (2137 row).** Printed text: "an **inconclusive** skirmish between NAC and ESU space units off Grendel." The draft had "an **inconsistent** NAC/ESU space skirmish" — wrong word (inconsistent ≠ inconclusive). Corrected.
4. **Dropped qualifier (2123 row).** Printed text: "the Beijing government ... deals harshly with the **Hindu** officials who sanctioned the pogrom." The draft's table row said only "officials," dropping "Hindu." Restored.
5. **Incomplete row (2127).** The printed paragraph states the New Israel/anti-Zionist "war" had "to date ... been largely the province of the **New Israeli Intelligence and Special Forces**" before Operation Jericho. This unit name was present in the doc's "Powers named" bullet for New Israel but missing from the Timeline table row itself; also restored the printed wording "renews the pledge of never-ending war against the anti-Zionists" (draft's row had softened this to "renews its pledge against 'anti-Zionists'"). Row updated; also restored "One hundred years" (printed spelled out) in place of "100 years."
6. **Numbers not exactly as printed.** (a) 2137: printed "The **five years** of intense space and land warfare" — draft table used "(5 years)"; restored spelled-out form. (b) 2149: printed "the remaining **one hundred and forty** survivors" — draft used the numeral "140"; restored spelled-out form.
7. **Invented compound name (Powers section, NAC bullet).** The draft's NAC bullet read "grew out of the rubble of the Second (American) Secessionist Civil War" — this exact phrase is not printed anywhere. The page's Powers paragraph (p.65, under the TIMELINE heading) names it plainly as "the rubble of the **Second American Civil War**"; a separate, earlier paragraph (p.65, pre-TIMELINE) calls a nearby-dated 21st-century conflict the "Second Secessionist War (aka 2nd American Civil War) of 2049–57." The draft silently merged the two into a name that appears nowhere in print. Corrected the bullet to use the printed phrase at that location, with a note that the chapter also uses the other name elsewhere.
8. **Dropped quoted word (Powers section, Romanov Hegemony bullet).** Printed text (2145): NAC/NSL support the RH against the "**Communist** aggression." The draft's bullet read "against ESU 'aggression,'" dropping "Communist" and mis-attributing the quoted phrase to "ESU" rather than quoting it as printed. Corrected.
9. **Section-boundary/heading placement.** The original's "## Introduction (p.65)" section included a second paragraph summarising (a) the 22nd-century colonisation/"Inner Colonies" paragraph, (b) the NAC/ESU/UN "two largest power blocs" paragraph, and (c) the UFE-breakdown paragraph. On the actual page, all three of these paragraphs appear **after** the bold "TIMELINE:" heading, immediately before the 2101 entry — not before it as part of the introductory disclaimer. Moved this material into the "## TIMELINE:" section as its lead-in, and trimmed "Introduction (p.65)" to only the paragraph that truly precedes the TIMELINE heading (the disclaimer / skipped-period / 21st-century-equipment paragraph).

No other numbers, names, dates, or table cells were found to differ from the printed pages; nothing else on the two pages was found omitted from the digest (aside from the New Israeli unit name noted in item 5, which was present elsewhere in the document but missing from that specific table row).

</details>

---

# Chunk 23 · pp. 67–69 · 25 Organisation and equipment

Source: sg-p68.png (printed p.67), sg-p69.png (printed p.68), sg-p70.png (printed p.69).

## FORCE ORGANISATIONS (p.67)

Prose introduction, no mechanics: the organisation notes are for typical units of some of the major powers in the GZG Timeline. Each force is representative of that nation's standard ground-forces organisation, but real armies vary widely. The New Anglian Confederation (NAC) example given is a Royal Marine assault force (Company-strength) with the kind of attached supporting units that might be available under ideal circumstances — an actual force encountered in combat is unlikely to have all these assets. The authors note they have gone into unusually heavy stat/background detail on NAC units, equipment and vehicles as a worked example, but space precludes the same treatment for other nations here (promised for future publications).

---

## NEW ANGLIAN CONFEDERATION (p.67)

### NEW ANGLIAN ROYAL MARINE ASSAULT FORCE – THIRD SOLAR WAR PERIOD (p.67)

Prose/background, no mechanics: a company-level force typical of Assault Forces used in Colonial areas in the 2170s, equipped with ground vehicles (mainly high-mobility wheeled types as issued to the bulk of NAC army units), whereas a first-line Strike Force would have at least a proportion of Grav combat vehicles. The organisation is for offensive missions; in a defensive role it would likely be stripped of its PA platoon and many vehicles. The table given lists only the main combat parts of the force — maintenance, engineering, administration, catering, medical and other sections exist but are not detailed since they seldom appear on-table.

#### Company Command Unit (p.67)
One squad-size unit incorporating the Company Commander, Company Sergeant Major and three command staff, plus a 2-man EW team and a Battalion Support Liaison officer. Travels/operates from one Command APC (Merlin MMRAV/C or Phalanx/C).

#### Company Security Unit (p.67)
A squad-size unit of Military Police, organised as an eight-man infantry squad with normal small arms (L7A3s) but issued with support weapons only when in combat situations. Functions as a Police force out of combat; in action, tasked with defending the Company Command Unit. Led by a senior MP NCO; issued with one APC (usually a Hoplite MMRAV) for combat transport (other smaller vehicles available for on-base duties).

#### Fire Support Battery (p.67)
Well-equipped Assault Forces may have an organic battery of 3 Striker MMRAV mobile MRL launchers, but most have just a 3-tube battery of light RAM mortars carried in APCs or trucks.

#### Attached Tank Platoon (p.67)
Either a Troop of 3 Paladins cross-attached from whatever Armour forces are operating with the Marines, or in some cases 3 Hunter MMRAV tank-killer variants organic to the Company. Each vehicle acts as a separate UNIT; one of the three is designated as a Platoon Command Unit.

#### Three Infantry Platoons, each of: (p.67)

**Platoon Command Unit:** Squad-size unit incorporating the Platoon Commander and Platoon Sergeant along with six other troopers. One L5 SAW is issued as standard; other weaponry available if required. EW and/or Liaison elements may be attached, replacing some ordinary troopers, depending on mission. Rides in a single APC (Hoplite or Phalanx).

**Three Infantry Squads:** Units of eight men — Squad Leader, SAW (L5) gunner, Special Weapon (GMS/P or PPG(I) Plasma Gun) trooper, and five line troopers with L7A3, one APC (Hoplite or Phalanx).

#### One Power-Armour Infantry Platoon (p.67)

**PA Platoon Command Unit:** Squad-size unit incorporating the Platoon Commander and Platoon Sergeant along with four other troopers. Suit fits are mission-specific but generally: one Command suit, one special-weapon suit (L18P GMS or L23A2 HVAT railgun), one L6P SAW gun suit, and three general-service suits with L41 APWs; one or more GS suits may have over-shoulder multilauncher packs fitted.

**Three PA Infantry Squads:** Units of six PA troopers with a similar suit mix to the command squad; if a squad operates away from the rest of the Platoon (e.g. cross-attached to a light infantry platoon), a Command suit is issued to the squad leader — otherwise he wears a standard GS suit.

PA units use Phalanx APCs for transport (the Hoplite is not large enough for PA suits), but normally fight without vehicles, using their suits for mobility.

**Other support available:** Battalion and Regimental level artillery, other assets according to mission and theatre.

### NAC ROYAL MARINE EQUIPMENT AND WEAPONS (pp.67–68)

Italicised background paragraph on the L7A3 (p.67, no mechanics beyond what's captured below): the L7A3 is a tried-and-tested design introduced in 2156 to replace the L7A1 of 2134 (the L7A2 was an interim model that never fully entered service). It is a twin weapon in the common over/under layout — a 4mm binary liquid propellant automatic mechanism above a 25mm rocket-assisted explosive round launcher. The 4mm weapon is bullpup-configured, fed from a 100-round box magazine (which also holds the liquid propellant supply) behind the pistol grip; the 25mm launcher feeds from a 10-round cassette ahead of the grip. The whole system is a minimum-maintenance design in a high-strength polymer casing for survivability/reliability. An integral laser rangefinder auto-sets the 25mm airburst fuses for optimum fragmentation distance against a target. Various optical/optoelectronic sights can be top-mounted, though most NAC infantry instead use full integrated targeting built into the 2145-pattern combat helmet's head-up visor, interfaced to the L7 via contacts in the pistol grip and the user's combat-suit gloves (no separate weapon-mounted sight needed).

#### Weapons table

| Weapon | TYPE | FIREPOWER | IMPACT | GUIDANCE | Notes |
|---|---|---|---|---|---|
| L7A3 Individual Weapon | Advanced Assault Rifle with GL | 3 | D10 | — | Current standard infantry small arm of the NAC forces. |
| L41 Anti-Personnel Weapon | Power Armour Individual Weapon with GL | 3 | D10 | — | Modified L7 action in a new casing for one-handed use by Power Armour troops. |
| L5 Squad Automatic Weapon | Binary Propellant Machine Gun | D8 | D10 | — | Standard SAW for light infantry, usually carried on a Gyromount harness for effective fire and movement. |
| L6P Squad Automatic Weapon (PA) | Binary Propellant Machine Gun (PA) | D10 | D10 | — | Rotary-action BPMG for mounting on the arm of a Mk.IV GS Power Armour suit. |
| L20A1 PPG(I) | Portable Plasma Gun (Infantry) | D6 | D12 | — | The "PIG"; squad/platoon-level point-fire support weapon. Normally used by Power Armour troops; can be handled by light infantry but needs additional operator protection over normal partial combat armour. |
| L18/L18P GMS/P | Portable Guided Missile Launcher | — | D12 | Enhanced (D8) | Man-portable GMS launcher firing 81mm fire-and-forget multirole missiles from a 3-round cassette magazine; L18P has modified casing/mounts for Power Armour use. |
| L23A2 HVAT railgun | Point-Fire Support Railgun | D8 | D12 | — | Gauss-type point-fire weapon used only with Power Armour; mainly a hard-target killer against light vehicles. |
| L9 Sniper Rifle (Gauss) | Gauss Sniping Rifle | D10 | D12 | — | An obsolescent gauss sniper rifle, still preferred by some snipers over the more modern laser types. |
| L10A2 Sniper Rifle (Laser) | Laser Sniping Rifle | D12 | D8 | — | The standard NAC sniper weapon; a high-energy pulse laser fed from a backpack power supply. |

#### Personal armour (p.68)

**NAC Marine standard-issue battledress:** Insulated ballistic cloth fatigues overlaid with partial light armour (flexible polyarmour plates); upgraded 2145-pattern Combat Helmet with full in-visor targeting displays, tactical communications facilities and weapon data links. ARMOUR VALUE: D6. MOBILITY TYPE of wearer: NORMAL INFANTRY (6" or D6").

**United Cybernetics Mk.IV General Service Power Armour:** A fully-sealed suit of power-assisted combat armour, with power/life-support for up to 36 hours continuous operation in hostile environments. Various arm and backpack mounting options for a wide range of individual and support weaponry. ARMOUR VALUE: D12; MOBILITY TYPE: "FAST" POWER ARMOUR (12" or D12").

### NAC ROYAL MARINE VEHICLES (p.68)

**FV202 PHALANX HEAVY APC:** Prose (no numeric mechanics beyond the stat block): the largest wheeled APC in NAC service; common in most Marine and Army formations as a load carrier and infantry transport. The NAC's only ground vehicle APC able to carry Power-Armoured troops. The Phalanx's large hull can carry one squad of PA troops or two full squads of light infantry, though where enough vehicles are available it's generally issued one per squad. Two hull-top mounts for independent light weapons turrets, typical fit a pair of Rockwell-Mishima Industries rotary plasma cannons. A Command post version, designated Phalanx/C, is also in use.

| Field | Value |
|---|---|
| MOBILITY TYPE | Hi-Mobility Wheeled |
| SIZE CLASS | 4 (Large) |
| ARMOUR CLASS | 3 |
| WEAPONRY | Various — typically 2 x DFFG/1 (gatling type), Enhanced Firecontrol. |
| CREW | 2 (Commander, Driver) |
| TROOP SPACES | 16 (Phalanx/C 8 plus 4 equipment operation stations) |
| OTHER EQUIPMENT | Basic ECM, Smoke launchers (Phalanx/C – full Command/Communications equipment and Superior ECM) |

**FV700 MMRAV FAMILY:** Prose: the MMRAV (Modular Multi-Role Armoured Vehicle) family was designed in the late 2150s as a range of medium vehicles for the NAC army and Marines, sharing as many common components as possible to simplify field maintenance/supply. All FV700-series vehicles share the same chassis (a six-wheel high-mobility platform based on the older Paladin MBT, driven by a Hydromagnetic Turbine plant), main hull and forward decking, including the forward part of the crew compartment with its underslung driver's pod. Each variant has a customised rear hull module for its specific equipment — a job requiring heavy lifting equipment and a full maintenance shop, though the modules are theoretically interchangeable between chassis/hull units. The most common family members are the FV701 Hoplite (personnel carrier), FV703 Hunter (tank-killer), FV705 Defender (anti-aircraft), FV707 Striker (multiple rocket launcher/MRL artillery), and FV710 Merlin (mobile command post); other versions exist for engineering/recovery, field ambulance and general cargo roles.

| Field | Value |
|---|---|
| MOBILITY TYPE | Hi-Mobility Wheeled |
| SIZE CLASS | 3 (Medium) |
| ARMOUR CLASS | 2 |
| WEAPONRY | Varies with version — examples: Hoplite 1 x DFFG/1 (gatling) with Enhanced FC; Hunter 1 x HKP/2 (Superior FC) plus GMS/H system (Superior guidance). |
| CREW | 2 (Commander, Driver) |
| TROOP SPACES | Hoplite: 10 |
| OTHER EQUIPMENT | Enhanced ECM, Smoke launchers (Hunter – Superior ECM plus decoy launchers) |

---

## NEU SWABIAN LEAGUE (p.68)

### NEU SWABIAN LEAGUE PANZERGRENADIER PLATOON (p.68)

Prose: a mechanised platoon of combat-armoured troops, reinforced with a squad of Power Armoured infantry. Panzergrenadier units operate in small 6-man squads, each with a hover MICV with a separate 2-man crew. The standard unpowered armour suit gives good protection against enemy fire and shrapnel but is tiring to wear for long periods — hence few Panzergrenadier units operate without their vehicles, leaving light-infantry tasks to other non-armoured troops.

#### Platoon Command Unit (p.68)
Six-man squad incorporating the Platoon Commander and Platoon Sergeant along with three other troopers (all with SG58 Individual Weapon) and one MG66 SAW gunner; other weaponry available if required. EW and/or Liaison elements may be attached, replacing some ordinary troopers, depending on mission. Rides in one LKPzW VI hover MICV with two additional crew (commander/gunner and driver).

#### Three Infantry Squads (p.68)
Units of six men — Squad Leader, SAW (MG66) gunner, Special Weapon (GMS/P or SK51 Plasma Gun) trooper, and three line troopers with SG58 Individual Weapon. One LKPzW VI hover MICV with two additional crew (commander/gunner and driver) per squad. At least one squad commonly includes a specialist sniper with an LG24 laser rifle.

#### One Power-Armour Infantry Squad (p.68)
Unit of six troopers in PZKpfZ III Power Armour suits: normal complement is one Command suit, one SAW suit, one special weapon suit (GMS/P or Plasma Gun) and 3 standard trooper suits each with an SGKpfZ 60 Anti-Personnel Weapon; normally at least one of the standard suits also has over-shoulder launchers. Two LKPzW VIs are issued to the PA squad — one for carrying the (unsuited) troops, one modified vehicle transporting the Armour suits and their field backup facilities; generally neither accompanies the troops into combat, though both can provide additional support/carrying capacity in an emergency.

### NSL PANZERGRENADIER EQUIPMENT AND WEAPONS (p.68)

#### Weapons table

| Weapon | TYPE | FIREPOWER | IMPACT | GUIDANCE | Notes |
|---|---|---|---|---|---|
| SG 58 (Sturmgewehr 58) Individual Weapon | Advanced Assault Rifle with GL | 3 | D10 | — | |
| SGKpfZ 60 Anti-Personnel Weapon | Power Armour Individual Weapon with GL | 3 | D10 | — | |
| MG 66 (Maschinengewehr 66) SAW | Rotary Action Machine Gun (on Gyromount) | D8 | D12 | — | Also carried by PA troops as the MGKpfZ 66. |
| SK51 (Sturmkanone 51) | Portable Plasma Gun (Infantry) | D6 | D12 | — | Also carried by PA troops as the SKKpfZ 51. |
| PzShK XII GMS/P | Portable Guided Missile Launcher | — | D12 | Enhanced (D8) | 4-round GMS/P launcher, carried by combat-armoured and Power Armoured troops. |
| LG24 (Lasergewehr 24) Sniper Rifle | Laser Sniping Rifle | D12 | D8 | — | |

#### Personal armour (p.68)

**NSL Panzergrenadier standard Combat Suit:** Full suit of (unpowered) hardshell polyarmour composites; integral Combat Helmet with full targeting and communications systems. ARMOUR VALUE: D8. MOBILITY TYPE of wearer: NORMAL INFANTRY (6" or D6").

**PZKpfZ III Power Armour suit:** The Panzerkampfanzug III suit has power and life-support systems for up to 48 hours operation, in increasing levels of wearer discomfort. Arm and backpack mountings for individual and support weaponry. ARMOUR VALUE: D12; MOBILITY TYPE: "FAST" POWER ARMOUR (12" or D12").

### Vehicle (p.68–69)

**NSL LKPzW VI (Luftkissenpanzerwagen VI):** Prose (p.68): a medium-sized and efficient GEV Mechanised Infantry Combat Vehicle (MICV) issued to NSL Panzergrenadier units. Has a 2-man crew which is NOT part of the infantry squad, so the vehicle may operate independently once the troops have debussed; normally the MICV accompanies the troops in the assault to provide fire support (and evacuation if necessary).

| Field | Value |
|---|---|
| MOBILITY TYPE | GEV (hover) |
| SIZE CLASS | 3 (Medium) |
| ARMOUR CLASS | 2 |
| WEAPONRY | Remote turret mounting GAC/1 with Enhanced Firecontrol and single GMS/L tube (Enhanced Guidance). |
| CREW | 2 (Commander, Driver) |
| TROOP SPACES | 8 |
| OTHER EQUIPMENT | Enhanced ECM, Decoy launchers, Smoke launchers |

(Stat block begins on p.68 under the vehicle's name and concludes at the top of p.69.)

---

## EURASIAN SOLAR UNION (p.69)

### EURASIAN SOLAR UNION NAVAL INFANTRY HEAVY PLATOON (p.69)

Prose: a typical platoon of ESU Drop (interface) Naval Infantry, as might be embarked on a Cruiser-size space warship as a Marine contingent. The force has no vehicles allocated, relying on the interface craft from their ship for transport/support — in a protracted ground-combat situation they would probably be attached to a normal army force and issued vehicles by the parent unit. This HEAVY PLATOON contains a squad of Power Armour troopers for assault duties; a LIGHT PLATOON would lack this PA unit.

#### Platoon Command Unit (p.69)
Eight-man squad incorporating the Platoon Commander (Ensign) and Platoon Senior NCO, with six other troopers (all with KI-72 Individual Weapons). One RK80 SAW is issued for squad support.

#### Three Infantry Squads (p.69)
Units of eight men — Squad Leader, SAW (RK80) gunner, five line riflemen with KI-72s, and one Special Weapons trooper: two squads in the Platoon normally have GMS/P systems (the AT-17 "Sandbox") while the third squad has a Sniper as the weapons specialist.

#### One Power-Armour Infantry Squad (p.69)
Unit of six troopers in Chen-Kunyang Model II Power Armour suits; normal complement is one Command suit, one RK-100 SAW suit, one special weapon suit (GMS/P or 20mm Assault Cannon) and 3 standard trooper suits each with a KI-95 Anti-Personnel Weapon; one of the standard suits also has over-shoulder grenade launchers.

### ESU NAVAL INFANTRY EQUIPMENT AND WEAPONS (p.69)

#### Weapons table

| Weapon | TYPE | FIREPOWER | IMPACT | GUIDANCE | Notes |
|---|---|---|---|---|---|
| KI-72 Individual Weapon | Advanced Assault Rifle | 2 | D10 | — | |
| KI-95 Anti-Personnel Weapon | Power Armour Individual Weapon | 2 | D10 | — | |
| RK80 Squad Automatic Weapon | Light Machine Gun (on Gyromount) | D8 | D10 | — | |
| RK100 Squad Automatic Weapon | Rotary Machine Gun for Power Armour suits | D10 | D10 | — | |
| VK20 Assault Cannon (20mm) | RFAC/1 for Power Armour suits | D10 | D12 | — | |
| AT-17 "Sandbox" | Portable Guided Missile Launcher | — | D12 | Enhanced (D8) | 3-round GMS/P launcher, carried by light and Power Armoured troops. |
| Kalyev Sniper Rifle | Conventional-round Sniping Rifle | D8 | D10 | — | |
| Muan Teng MT3 Sniper Rifle (Laser) | Laser Sniping Rifle | D12 | D6 | — | |

#### Personal armour (p.69)

**ESU Naval Infantry standard battledress:** Ballistic cloth fatigues overlaid with partial light armour (flexible polyarmour plates); open-face Combat Helmet with drop-down flash visor containing head-up display systems. All ESU infantry issued with a full-length camouflage cape (insulated against thermal detectors and other sensors), kept rolled under the backpack unless needed. ARMOUR VALUE: D6. MOBILITY TYPE of wearer: NORMAL INFANTRY (6" or D6").

**Chen-Kunyang mod.II Power Armour suit:** An ageing and fairly basic PA suit design, very slow compared to current models; relatively cheap to produce/maintain. Power/life-support good for only 12 hours in the standard suit, extendable with external disposable power packs for longer missions. ARMOUR VALUE: D10; MOBILITY TYPE: "SLOW" POWER ARMOUR (6" or D6").

---

## FEDERAL STATS EUROPA (p.69)

*Printed exactly as shown on the page — "FEDERAL STATS EUROPA" (section banner and both body sub-headings on this page use "STATS," not "STATES"); transcribed verbatim per instructions as a probable printing error.*

### FEDERAL STATS EUROPA COLONIAL LEGION PLATOON (p.69)

Prose: a light infantry platoon of the FSE Legionnaires, typical of the small units stationed on outworld settlements. The platoon has no indigenous transport or support, relying on higher-echelon assets. The Legionnaires are equipped/experienced for long periods of independent operations, often penetrating deep into enemy-held territory where heavy support and vehicles would make them too easily detectable. Although lightly equipped, the Legion platoon has **five** 8-man squads including the platoon command unit, giving it more manpower than the platoons of most other armies. Due to the lack of external support on many missions, Legion units are liberally equipped with multirole Mistral-5 GMS launchers. Their reliance on light infantry is also reflected in widespread use of Gauss weapons rather than the more conventional types preferred by other nations — although lacking an inbuilt grenade launcher, the standard Legion FA-75 is one of the most effective infantry arms in current production. Where vehicular transport is essential, the most common APC issued to Legion units is the AGCI-5B (detailed below).

#### Platoon Command Unit (p.69)
Eight-man squad incorporating the Platoon Commander and Platoon Senior Sergeant, with six other legionnaires (all with FA-75 Gauss Rifles). One FM-77 SAW is issued for squad support, and many units have one or two specialist snipers (with FA-75/F2 Gauss Sniping Rifles) who are administratively placed in the command squad but usually detach for independent operations when in the field.

#### Four Infantry Squads (p.69)
Units of eight men — Squad Leader, SAW (FM-77) gunner, five line legionnaires with FA-75s, and one legionnaire with a Mistral-5 GMS/P launcher.

### FSE COLONIAL LEGION EQUIPMENT AND WEAPONS (p.69)

#### Weapons table

| Weapon | TYPE | FIREPOWER | IMPACT | GUIDANCE | Notes |
|---|---|---|---|---|---|
| FA-75 Individual Weapon | Gauss Assault Rifle | 2 | D12 | — | |
| FM-77 Squad Automatic Weapon | Gauss Machine Gun | D10 | D12 | — | |
| Mistral-5 GMS/P | 3-round Portable Guided Missile Launcher | — | D12 | Enhanced (D8) | |
| FA-75/F2 Sniper Rifle | Gauss Sniping Rifle | D10 | D12 | — | |

#### Personal armour (p.69)

**FSE Colonial Legion battledress:** Ballistic cloth fatigues with partial light armour; open-face Combat Helmet with drop-down flash visor containing head-up display systems, plus removable filter mask to cover lower part of face; mask seals to visor when both are in position, giving limited hostile-environment and chemical protection. ARMOUR VALUE: D6. MOBILITY TYPE of wearer: NORMAL INFANTRY (6" or D6").

### Vehicle (p.69)

**AGCI-5B (Aero-Glisseur Combat D'Infanterie 5B):** Prose: a medium-sized GEV APC in common service with FSE Legion forces; an old but effective type, the AGCI-5 basic design is also in service and/or licensed production with several other nations (including the Oceanic Union, where the home-produced version is known as the "Wombat").

| Field | Value |
|---|---|
| MOBILITY TYPE | GEV (hover) |
| SIZE CLASS | 3 (Medium) |
| ARMOUR CLASS | 2 |
| WEAPONRY | Remote turret mounting either DFFG/1 or tribarrel GAC/1; some variants have an additional RFAC/1 pintle-mounted either on turret top or rear hull. Enhanced Firecontrol for all weapons. |
| CREW | 2 (Commander, Driver) |
| TROOP SPACES | 8 |
| OTHER EQUIPMENT | Basic ECM, Smoke launchers |

---

<details><summary>Reader's notes</summary>

- Weapon-code abbreviations used in vehicle WEAPONRY lines (DFFG, HKP, GAC, RFAC, GMS/H, GMS/L) are transcribed exactly as printed; their expansions are not given on these three pages, only their use in specific vehicle fits.
- Where a weapon's stat line omits FIREPOWER (all GMS/P and GMS/L guided-missile launchers), that field is left blank in the tables above — the printed entries genuinely give only TYPE, IMPACT and GUIDANCE for these weapons, consistent with the "FIRING GUIDED MISSILES" fire-resolution rule (Quality die + Missile Guidance die vs. target's ECM Systems die) noted in the quick-reference sheet.
- "NSL" (Neu Swabian League) is printed as "NEU SWABIAN LEAGUE" in the section banner and body text on p.68 — transcribed as printed.
- The FV700 MMRAV FAMILY stat block on p.68 gives only "Hoplite: 10" under TROOP SPACES (no figure given for other named variants in that field); transcribed exactly as printed.
- All text on these three pages was legible; nothing has been marked [illegible].

---

</details>

<details><summary>Checker's corrections</summary>

Checked line-by-line against sg-p68.png (printed p.67), sg-p69.png (printed p.68) and sg-p70.png (printed p.69). Two errors found and corrected in this file; everything else — every stat line, table cell, die type, headcount, page citation and named item — matched the page images exactly.

1. **FSE weapons table, Mistral-5 GMS/P row (p.69) — wrong TYPE field, fabricated Notes text.** The printed entry reads: "Mistral-5 GMS/P: TYPE: **3-round** Portable Guided Missile Launcher; IMPACT: D12; GUIDANCE: Enhanced (D8)." — the round count is part of the TYPE field itself, and there is no separate explanatory sentence after it (unlike the L18/L18P, PzShK XII and AT-17 "Sandbox" entries elsewhere on these pages, which do each have TYPE: "Portable Guided Missile Launcher" *plus* a following sentence, e.g. "4-round GMS/P launcher, carried by combat armoured and Power Armoured troops."). The original digest had copied that other pattern onto Mistral-5, giving TYPE = "Portable Guided Missile Launcher" and Notes = "3-round GMS/P launcher." — moving the round count out of TYPE and inventing a Notes sentence that isn't printed for this weapon. Corrected to TYPE = "3-round Portable Guided Missile Launcher" with an empty Notes cell, matching the print.

2. **NAC "Three Infantry Squads" entry (p.67) — plural added, sentence split.** The printed text is one sentence: "Units of eight men, each of Squad Leader, SAW (L5) gunner, Special Weapon (GMS/P or PPG(I) Plasma Gun) trooper and five line troopers with **L7A3**, one APC (Hoplite or Phalanx)." — "L7A3" is singular here (no trailing "s"), even though the plural "L7A3s" is used elsewhere on the same page (e.g. the Company Security Unit entry, "normal small-arms (L7A3s)") — an inconsistency in the original book itself. The digest had normalised this instance to "L7A3s" and split it into two sentences ("...with L7A3s. One APC (Hoplite or Phalanx) per squad."). Corrected to match the print exactly, singular "L7A3" and the original single-sentence structure.

Everything else checked out, including: every FIREPOWER/IMPACT/GUIDANCE value in all four nations' weapons tables; all four vehicle stat blocks (FV202 Phalanx, FV700 MMRAV, NSL LKPzW VI, FSE AGCI-5B) field-by-field, including the odd "TROOP SPACES: 16 (Phalanx/C 8 plus 4 equipment operation stations)" figure and the "Hoplite: 10" TROOP SPACES entry that the FV700 block gives for only one named variant; all headcounts and squad/suit compositions for every platoon and squad across all four nations (NAC, NSL, ESU, FSE), including the FSE platoon's bolded "**five**" 8-man squads; all four ARMOUR VALUE/MOBILITY TYPE personal-armour entries per nation; the "FEDERAL STATS EUROPA" heading and sub-heading, confirmed printed with "STATS" not "STATES" on both occurrences; and the "NEU SWABIAN LEAGUE" spelling of NSL. No content present on the three pages was left out of the digest, and nothing in the digest was found that is not on the pages.

</details>

---

# Chunk 24 · pp. 70–72 · 26 Appendices, data cards, inbound chart

Source images: `sg-p71.png` (printed p.70), `sg-p72.png` (printed p.71), `sg-p73.png` (printed p.72, per the PDF→printed offset used throughout this project; see Reader's notes below — the physical sheet itself prints no folio digit). `sg-p74.png`/`sg-p75.png` were glanced at only to confirm identity with the already-transcribed Quick Reference sheet (`qr-p1.md`, `qr-p2.md`) — confirmed: they are the same two-page "QUICK REFERENCE RULES SUMMARY" (FIRE COMBAT / CLOSE ASSAULT / HEAVY WEAPONS FIRE AGAINST VEHICLES / ARTILLERY SUPPORT etc.), not re-transcribed here.

---

## Chapter 26: APPENDICES (printed p.70)

Two-column prose page, no game mechanics/numbers of rule-relevance. Summarised rather than transcribed, per instructions.

### TERRAIN AVAILABILITY AND MODELLING: (p.70)

Advises players that Stargrunt II is most enjoyable played on an attractive tabletop layout. Describes a spectrum of options from simplest to most elaborate: (1) a plain cloth/sheet or blanket over the table with folded items underneath (folded cloths, books etc.) for hills; (2) a painted cloth or rigid board with cut-foam/wood/card contours; (3) a fully-sculpted layout in wood, plaster, expanded polystyrene or a combination, built along model-railway-hobby lines — with the caveat that playable terrain needs movable pieces and stepped, placeable "contours" rather than actual slopes, prioritising playability over pure diorama looks; (4) buying a commercial modular/integral terrain system, which the text argues is often better value than it first appears once the time and materials cost of scratch-building are considered. It specifically recommends the "GAMESCAPE" system (hexagonal terrain tiles about 12" across, with a wide selection of "partial" hexes and hill sections, in grass-green or desert-yellow, made in the USA by GEO-HEX) and GEO-HEX's coated felt cloths (6' x 4', coated in the same green or sand flock as the foam terrain tiles) as a compact storage alternative. It then gives tips for dressing terrain: roads/rivers from cloth, felt or card; trees/vegetation from model-railway or wargames suppliers; and an off-beat tip that pet-shop/aquarium plastic plants (intended for tropical fish tanks, mounted on metal washer bases with a bit of Milliput or filler) make good "alien" foliage, plus dried seed-pods from florists for "wierd and exotic trees" [sic, printed "wierd"] — crediting "Paul Lewis" for many of the ideas and for lending his terrain collection for the book's photos.

No dice, thresholds or costs on this page other than commercial advertisement prices printed in the two boxed ads at the bottom of the left column: **FULL THRUST** and **MORE THRUST** (supplement) each **£5.95**, plus £1 postage (UK) / £2 overseas; **DIRTSIDE II** **£8.95**, plus £1 postage (UK) / £2 overseas. These are product adverts, not Stargrunt II rules.

### AVAILABILITY OF SUITABLE FIGURES: (p.70)

Ground Zero Games states they produce their own 25mm STARGRUNT MINIATURES range designed to fit the rules and background, and would obviously like players to buy them, but explicitly says players are welcome to use figures from **any** manufacturer — contrasting themselves with companies that take the attitude of "if you don't use our figures for our games, you are a nasty subversive and won't be allowed to play". It declines to list rival figure manufacturers by name (citing that availability varies by country and firms "come and go"), instead advising players to check their local independent games store, wargaming magazines (named: *Miniature Wargames*, *Wargames Illustrated*, *Practical Wargamer*, "etc.") or mail-order advertisers, or a wargames show/convention. It stresses always including a stamped self-addressed envelope (or International Reply Coupons for overseas enquiries) when writing to any manufacturer or stockist for a reply.

Contact addresses given for GZG's own products/ranges (printed exactly, for reference — not "rules" numbers):
- **UK & Europe:** Ground Zero Games, "Fizno", Barking Tye, Needham Market, Suffolk IP6 8JB, UK. (Catalogue: send £1.50 inc. post/packing; overseas readers send 5×IRCs.)
- **USA/Canada:** GEO-HEX, 2126 North Lewis, Portland, Oregon 97227, USA (for Gamescape terrain and GZG ranges).
- **Australia:** Eureka Miniatures, The Military Bookroom, 1410 Malvern Rd, Glen Iris, Vic. 3146, Australia (for GZG figures).

Footnote: "Details and addresses correct at time of printing."

---

## Photocopiable Cards (printed p.71)

Page footer is numbered **71** (visible page-number tab; despite being a tear-out/photocopy sheet, it does carry a printed page number, unlike the Inbound Chart sheet below). Footer note on the page (same line as the "71" page-number tab, not a header): "© 1996 GZG. Permission granted to photocopy for personal use only." The page holds three blank pro-forma cards, each a title bar reading "STARGRUNT II" + card name, followed by labelled blank fields/boxes for players to fill in by hand. Fields are listed in the order printed, left to right, top to bottom.

### MISSION CARD

| Field | Notes |
|---|---|
| COMMANDER | single-line box |
| FORCE | single-line box |
| MISSION MOTIVATION | single-line box |
| FATIGUE LEVEL | single-line box |
| ADE (HOSTILE) | single-line box (printed exactly as "ADE (HOSTILE)"; the sheet does not define the abbreviation) |
| MISSION OUTLINE | large multi-line box |
| PRIMARY OBJECTIVE | multi-line box |
| SECONDARY OBJECTIVE | multi-line box |
| FORCE ORGANISATION | large multi-line box |
| SUPPORT ASSETS | multi-line box (wide, left) |
| ORGANISATIONAL LEVEL | box (narrower, right, alongside SUPPORT ASSETS) |
| NOTES | multi-line box |

### VEHICLE DATA CARD

| Field | Notes |
|---|---|
| NAME | single-line box |
| TYPE | single-line box |
| SIZE | single-line box |
| MOBILITY | single-line box |
| ECM | single-line box |
| ARMOUR — FRONT | box (under "ARMOUR" label) |
| ARMOUR — SIDE | box (under "ARMOUR" label; only FRONT and SIDE facings are printed — no REAR/TOP box) |
| CREW | single-line box |
| INFANTRY CARRIED | single-line box |
| WEAPONRY TYPE (table) | columns: **WEAPONRY TYPE**, **FIRECON**, **BASE IMPACT**; 3 blank data rows |
| NOTES AND OTHER EQUIPMENT | large multi-line box |

### SQUAD DATA CARD

| Field | Notes |
|---|---|
| SQUAD TYPE | single-line box |
| FULL STRENGTH | single-line box |
| ARMOUR | single-line box (alongside FULL STRENGTH) |
| MOBILITY | single-line box |
| SENSORS | single-line box (alongside MOBILITY) |
| SMALL ARMS TYPE (table) | columns: **SMALL ARMS TYPE**, **FIREPOWER**, **IMPACT**; 1 blank data row |
| SUPPORT WEAPONS (table) | columns: **SUPPORT WEAPONS**, **FIREPOWER**, **IMPACT**; 3 blank data rows |
| ATTACHED SPECIALISTS | single-line box |
| NOTES AND OTHER EQUIPMENT | multi-line box |

**Implication for a program tracking game state:** a Squad needs to store type, full strength (headcount), armour die, mobility die, sensors die, one small-arms weapon (firepower+impact), up to 3 support-weapon lines (firepower+impact each), and attached specialists; a Vehicle needs name, type, size, mobility die, ECM die, front/side armour values, crew size, infantry-carrying capacity, and up to 3 weapon lines (fire-control die + base impact die each); a Mission needs commander, force, mission motivation, fatigue level, an "ADE (Hostile)" value, free-text mission outline/primary/secondary objectives, force organisation, support assets, and an organisational level.

---

## STARGRUNT II INBOUND CHART (printed p.72; sheet itself carries no printed folio)

By the PDF→printed offset used throughout this project (`sg-pNN.png` = printed page NN−1), `sg-p73.png` maps to printed p.72. This is corroborated externally: the separately-transcribed front Contents page (`sg-01-intro.md`) lists, under "CHAPTER 26: APPENDICES," an entry "INBOUND CHART: 72" — but that cross-reference has not itself been checked against its source scan as part of this pass, so it is offered only as corroboration, not proof. What is directly verifiable from `sg-p73.png` itself: all four edges of the sheet were inspected at full resolution and none carry a page-number tab like the "71" tab on the cards page — only the "© 1996 GZG. Permission granted to photocopy for personal use only." footer line (same wording as on the cards page) appears, with no page number next to it. So the sheet is correctly a numbered page in the book's own pagination (p.72) despite printing no visible folio — both facts are true at once, and the original draft's plain "unnumbered sheet" heading understated the first.

It is a pure graphical chart — no rules text is printed on the sheet itself explaining its procedure; the mechanic it supports must be read from the rules chapter it belongs to (not in this page range). Layout, printed exactly as arranged:

**Title:** "STARGRUNT II INBOUND CHART" (top of sheet).

**Two mirrored inbound tracks, one on each side, both feeding into a central box:**
- **Left inbound track:** three boxes in a row reading (left→right) **3, 2, 1**, with an arrow from box "1" pointing right into the central "BATTLE AREA" box.
- **Right inbound track:** three boxes in a row reading (left→right) **1, 2, 3** (mirror image), with an arrow from box "1" pointing left into the central "BATTLE AREA" box.
- Each track's "1" box (the one adjacent to the Battle Area) also connects to its own **LOITER** box, positioned above the track: one arrow runs **up** from the "1" box into LOITER, and a second arrow runs **down** from LOITER straight into the Battle Area box. This gives each approaching unit/asset a choice at the "1" box: either proceed directly into the Battle Area that turn, or divert into LOITER and enter the Battle Area from LOITER on a subsequent turn instead. (Verified on both sides — the arrow pairing is identical, mirrored left and right.)
- **Central "BATTLE AREA" box:** a small schematic map icon — a road (or river) running from the bottom-left corner to a fork/junction, a cluster of small dark hatched rectangles at the fork (a building/settlement icon), and three contour-ringed hill/high-ground blobs (one upper-left, one upper-right, one lower-right). This is a generic stand-in icon for "the tabletop," not a specific scenario map.

**Turn Track (separate strip, printed below the inbound tracks in the correctly-rotated orientation):** a row of boxes reading **SET UP**, then **1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12**, with a heading "TURN TRACK ▶" and an arrow indicating the direction of play (left to right) — a simple game-turn marker track from set-up through turn 12.

**What it is for:** No rules paragraph is printed on this sheet, so its exact procedure cannot be confirmed from this page alone — this is necessarily inference, not transcription. "LOITER" is an aviation term for circling near a target before committing to a run, which does suggest the two mirrored 3-2-1 tracks are for assets approaching the table over several turns (most naturally off-table support such as aerospace/air strikes, but the term alone does not rule out other off-table assets). Two other already-drafted (not yet independently checked) parts of this project's digest bear on this and point toward a broader reading than "aerospace only": the Contents listing places "THE INBOUND CHART" and "STARTING POSITIONS ON INBOUND CHART" under **Chapter 16: OFF TABLE SUPPORT** (printed pp.44–45), and the setup-sequence draft (`sg-05-setup-sequence.md`) describes the chart's turn track as also used generically to record the game's elapsed turns, moved at the end of every Turn End Phase regardless of whether any off-table asset is in play. Neither of those source pages (44–45) is among the images checked in this pass, so the precise scope of what "inbound" on this chart covers — aerospace only, or off-table support assets generally (artillery mission timing, air, orbital) — should be read there rather than treated as settled by this appendix sheet.

---

<details><summary>Reader's notes</summary>

- Printed-page vs. PDF-page mapping used here: `sg-p71.png` = printed p.70 (numbered, start of Ch.26); `sg-p72.png` = printed p.71 (numbered — confirmed by cropping the page-number tab, which reads "71"); `sg-p73.png` = printed p.72 by the same PDF−1 offset, though (unlike `sg-p71.png`/`sg-p72.png`) the physical sheet prints no visible folio digit anywhere on any of its four edges — see the Inbound Chart section above for the full reasoning.
- Both `sg-p72.png` and `sg-p73.png` are printed in landscape orientation on a portrait page (i.e., the card/chart artwork is rotated 90° relative to the rest of the book, intended to be read after rotating the physical page) — the tables and chart above were transcribed after digitally rotating the images upright. Note the two pages rotate in *opposite* directions from each other (confirmed by testing both rotations against the readable result): `sg-p72.png` reads correctly rotated 90° clockwise, `sg-p73.png` reads correctly rotated 90° counter-clockwise — consistent with them being a mirrored two-page spread of landscape content bound into a portrait book.
- All text on the three pages was legible at full resolution, including after zooming into small print (addresses, postal codes, the terrain/figures body text, and all four card tables); nothing is marked [illegible].
- The Vehicle Data Card's ARMOUR line prints only "FRONT" and "SIDE" boxes (no separate REAR/TOP/REAR-facing box) — transcribed exactly as printed, not assumed; re-confirmed against a full-resolution rotated crop of the card.

---

</details>

<details><summary>Checker's corrections</summary>

Checked `sg-appendices.md` line-by-line against `sg-p71.png` (printed p.70), `sg-p72.png` (printed p.71, both cards re-derived from a rotated crop of every field/table/row), and `sg-p73.png` (the Inbound Chart, re-derived from a rotated crop and from crops of all four raw edges). All prose content, addresses, prices, postal codes, card field names/order, table column headers and row counts, and the chart's box numbers/arrows/labels in the original draft were verified correct against the page images — no dice, thresholds, costs, names or table cells needed changing, and nothing was illegible. Corrections made:

1. **Inbound Chart page citation (content/citation error).** The draft titled this section "(unnumbered sheet, follows p.71)" and asserted only that it was unnumbered. Per the task's own PDF→printed mapping (`sg-pNN.png` = printed page NN−1), `sg-p73.png` is printed **p.72**, and this is independently corroborated by the Contents page transcription (`sg-01-intro.md`), which lists "INBOUND CHART: 72" under Chapter 26. I re-inspected all four edges of `sg-p73.png` at full resolution and confirmed no folio digit is actually printed on the physical sheet (the draft's underlying observation was correct) — but the section should still be cited as printed p.72, with the absence of a visible folio noted as a fact about the sheet, not used as the citation itself. Re-titled the section and expanded the reasoning in place.
2. **"Header note" should be "Footer note" (factual/terminology error).** In the Photocopiable Cards section, the draft called the "© 1996 GZG. Permission granted to photocopy for personal use only." line a "Header note on the page." I confirmed from a full-resolution crop of the page's bottom edge that this line sits in the page's footer, on the same line as the "71" page-number tab — not at the top of the page. (The draft's own Inbound Chart section correctly called the identical line a "footer" — this was an internal inconsistency as well as an error.) Fixed to "Footer note."
3. **Section headings not given as printed (style/faithfulness).** The draft's two Chapter 26 subheadings were written in sentence case without the printed colon ("Terrain Availability and Modelling," "Availability of Suitable Figures"). The page prints these as all-caps banner headings ending in a colon: "TERRAIN AVAILABILITY AND MODELLING:" and "AVAILABILITY OF SUITABLE FIGURES:". Per the task instruction to give section headings as printed (and to match the convention already used elsewhere in this project's digest, e.g. "## TIMELINE:" in `sg-background.checked.md`), corrected both headings to the printed all-caps/colon form.
4. **Overconfident claim not supported by the checked pages (analytical overreach, softened rather than a hard factual error).** The draft's closing paragraph asserted as a conclusion that the Inbound Chart "tracks aerospace assets... not artillery shells," despite itself noting no rules paragraph confirms this. Cross-checking other (not-yet-independently-verified) parts of this project's digest shows the Inbound Chart is documented under Chapter 16 "OFF TABLE SUPPORT" (printed pp.44–45, outside the pages checked here) and that its turn track is also used as a general elapsed-turn marker per a first-reader's draft of the setup sequence — both of which point to a broader or at least unconfirmed scope, not a confident aerospace-only/no-artillery exclusion. Reworded the closing paragraph to keep the aviation-terminology observation (still reasonable) but drop the unsupported exclusion of artillery, and pointed to the actual chapter/pages where the mechanic is defined instead of asserting a reading the appendix pages alone cannot support.
5. **Minor wording precision.** Tightened a few paraphrased sentences in the Terrain/Figures summary to track the printed wording more closely — including quoting GZG's "if you don't use our figures for our games, you are a nasty subversive and won't be allowed to play" line in full and exactly (my first attempt at quoting it here initially dropped the word "are"; corrected against a zoomed crop before finalizing), the printed "etc." after the three named wargames magazines, and the printed "wierd" [sic] spelling for "weird" — since these were paraphrased slightly loosely in the first draft even though not factually wrong. No numbers, dice, prices or addresses required any change — all were already correct in the draft.

</details>
