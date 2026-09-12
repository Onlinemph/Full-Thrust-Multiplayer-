# Rule sources

The engine is built from these, and every rule reference in the code points at one of them.

| Source | What it covers | Where |
| --- | --- | --- |
| *Full Thrust: Project Continuum* v1.1.4, April 2017 | Sections 1–9: overview, sequence of play, cinematic movement, beam combat, threshold checks, all direct-fire weapons, ordnance, defensive systems, fighters, gunboats | `continuum-rulebook-extract.txt` |
| Full Thrust Continuum Ultimate Ship Builder v1.31 | Sections 13–14: the mass and points cost of every hull, drive, system and weapon/arc combination | `construction-tables.md` |
| Full Thrust XD Quick Reference | Core Systems effects (bridge, life support, power core) and damage control, cross-checked against the rulebook | `threshold.md`, marked `[XD]` |
| Stellar Imperium campaign rules | The strategic layer: economy, research, espionage, production | `campaign.md` |

## The source, in two halves

The rulebook reaches this repository as two text extracts, and it takes two because the Google
Drive connector that produced them caps its PDF text extraction at roughly 270,000 characters:

| File | Pages | Covers |
| --- | --- | --- |
| `continuum-rulebook-extract.txt` | 1–81 | Sections 1–9.2, up to the Needle Gunboat |
| `continuum-rulebook-part2.txt` | 79–155 | Sections 9–22, complete to the credits |

They overlap at pages 79–81, which is how they were checked to meet without a gap.

The cap is worth recording because it cost this project half its source for a while, and because
the obvious fix does not work. Measured on three PDFs in the same Drive: the full *Project
Continuum* (13.5 MB) returns 276,641 characters and stops mid-list; *Squadron Strike 2e* (21 MB)
returns 268,299 and stops mid-sentence; *Interceptor 2e* (15.6 MB), a shorter book, returns 183,077
and ends at its own copyright notice. Two long books stopping within 3% of each other and a short
one coming through whole is a ceiling in the tool, not a defect in any document. It counts
extracted characters rather than megabytes, so shrinking a file changes nothing — the book has to
be **split**, which is exactly what `part2.pdf` is.

Nothing else reaches past it from inside a session: the connector returns the same capped text
however it is asked (`read_file_content` and a `fullText` search snippet come back byte-identical),
direct download is refused above 10 MB, and `drive.google.com` is blocked by the environment's
network egress policy for both curl and WebFetch.

Section 9 is covered as far as the text goes: 9.1 in full and five gunboat types from 9.2 (Beam,
Plasma, Graser, Gatling, Needle), plus the FTL and Heavy modifications. The list is cut off after
the Needle Gunboat, so any further type is missing rather than omitted. `gunboats.md` records it.

Section 6's ordnance is wired end to end now. The three families that were never reachable are:
rocket pods (6.7) and plasma bolt launchers (6.8), which had no launch action at all, antimatter
warheads (6.6), whose blast `resolveOrdnanceAttack` returned null for, and mines (6.9, 6.10), where
`plot-mines` set a flag that changed only *when* a ship moved and no marker was ever laid. All four
have actions and tests now, and a player has a phase 3 panel to launch from — before that, only the
computer could launch anything at all.

What the rest costs, and what stands in for it:

| Section | Status |
| --- | --- |
| 10 Threshold Points | Covered: 4.11 states the threshold rules in full, and the Core Systems effects come from the XD quick reference. Two consequences the XD sheet gives timings but not effects for — what life support failure and being out of control actually cost — are judgement calls, marked `[reading]` in `threshold.md`. |
| 11 Faster Than Light | Exit implemented end to end (11.4); entry, jump gates, tugs, battleriders and hyperspace battles are implemented in `ftl.ts` and wait on a scenario to place them. |
| 12 Optional Rules | Covered from the section itself now: sensors and ECM, boarding combat (12.7), fleet morale, striking the colors and civil wars. |
| 13 Ship design and construction | Covered, and now checked against the section itself rather than only the spreadsheet. |
| 14 Ship construction summary | Covered and verified. Every price the catalogue already carried matches 14.1–14.8 exactly — hulls, drives, screens, armour, every direct-fire weapon, ordnance, fighters and gunboats. What the checking found was omissions, not errors: eighteen weapon classes the engine could resolve but nobody could buy, eleven gunboat types, and one real bug, the stealth hull sold at a flat 2 points where 14.1 charges 2 *per hull and armour box*. |
| 15 The Imperial Tech Base | Tables and the availability predicate in `techbase.ts`, tested, and now folded over a fleet by `src/data/techBaseCheck.ts`. A side picks a base at setup, the fleet picker marks the hulls it could not have built, the shipyard says the same about the design on the bench, and the choice rides in the battle file. Advisory rather than enforced, for a reason worth recording: **neither of 15.2's example factions buys armour**, and every design in the roster carries a layer of it, so a hard error would refuse every fleet in the game. |
| 12.12 Vector movement | Offered as a setup choice and wired end to end for two players: the order sheet is a sequence typed as the book writes it (`TP3, MD6`), a ship carries a course marker in degrees that is not its facing, and every fire arc already read the facing so nothing about combat had to change. The computer still writes cinematic orders, so choosing a computer fleet puts the battle back on 3.1 — a fleet that never manoeuvres is worse than no option. |
| 16 Special moves | Implemented and tested in `specialmoves.ts`. Wired: ramming, rolling (written in the order, charged a thrust point out of the turning allowance, mirroring every arc the ship fires through), the moving table (16.4) and disengagement (16.5). 3.9 came with them: `GameState` now carries the table, so a ship can fly off it, by an edge, with the optional re-entry roll. Docking too: the approach is settled as the movement phase closes, because 16.6 tests where a ship *"ends up … at the end of the turn"* and against a target that is itself under way that cannot be answered until both have moved. Towing (16.3) is the last one out, and it stays out: it needs a per-pair hull-damage accumulator the engine does not keep and a towing rig on `ShipDesign`, both spine changes. |
| 17 Terrain effects | Implemented and tested in `terrain.ts`. Wired: line of fire (17.1), collisions with a solid body (17.6), dust and nebula speed damage (17.2 rule 1) and meteor fields (17.4) — all behind the `terrainHazards` setup flag, because section 17 calls itself *"mostly pure space opera"* and because every hazard draws a die, which would shift the RNG stream of every battle file saved before it existed. Cloud lock-on and screen attenuation (17.2 rules 2 and 3) and battle debris (17.5) are wired too, and 12.11's knocked-off-course roll rides on the threshold sweep as its own optional rule. A debris cloud is projected into `state.terrain` as a `debris` feature, which the 17.4 path already treats as a meteor field — *"exactly as for the meteor and debris rules given in the section above"*. Gravity wells too (17.9): a `TerrainFeature` can carry a `gravity` block, which builds 17.9's three zones, and a ship crossing them is sped up, slowed down or swung round by the arc the planet lies in — with the change held over to the next move when the ship ends the phase still inside a zone, and a partial orbit shielding a pass that actually turns. The **Weight of Worlds** scenario is built round one, because a rule with no scenario placing it is a rule nobody meets. Solar flares (17.3) are wired behind their own `solarFlares` flag — a `solar-flare` feature carries the die score it goes off on, because the rule names no frequency — and the **Close Orbit, Bad Star** scenario places one. 17.8's orbit track and 17.11's atmosphere are wired too: a `TerrainFeature` can carry an `orbit` block, a ship that meets the track at the orbital velocity makes orbit and is carried round it, arriving slow decays into the atmosphere and arriving fast is an uncontrolled entry, a drive or bridge threshold failure rolls again to stay up, and a declared landing turns 17.8's decaying orbit into 17.11's deliberate one. **The Track Above Meridian** is the scenario for it. 17.7's orbital table is wired behind its own flag — the table is a slice of orbit, so running off the edge is a lap round the world and the ship is placed back on the opposite edge at the same course and speed, within 6 MU of its recorded distance from the diagonally opposite corner; this needed `GameState.table`, which is why it waited. The same action finally brings a 3.9 departure back too, which had been recording a re-entry turn nothing read. 17.10 is wired as an alternative a body opts into with `simpleOrbit`. Satellites and starbases are on the track too: a scenario force entry can name a body and a marker, a station is exempt from the velocity rules that would otherwise drop every starbase in the game out of the sky on turn one, and it faces outward rather than along the track. The **Bastion** and **Sentinel** are in the roster for it. Section 17 is now wired end to end bar one line: 17.8's *"we recommend only one ship or starbase may occupy each marker point"* is a recommendation with three variants and no displacement rule behind it, so shared markers are allowed and fight at 1 MU as the same rule describes. |
| 18 Battles, scenarios and CPV | 18.1's deployment is wired: a battle type picked at setup replaces the scenario's written positions with a deployment step — 4.12's die for who places first, then alternating placement inside a zone drawn on the map, with the defender's one terrain feature in an offensive/defensive battle. The computer deploys its own fleet. CPV is a setup toggle that reprices every hull and scores the battle in the same currency, and the fleet picker now runs 18.2's own composition check — classes taken from mass by `classifyByMass`, a format to check against, and a carrier's wings counted with the carrier, which is what *"including their fighters"* was written for. `checkTournamentList` and `identicalForces` are still library-only: no surface here holds a tournament, and `FleetShip.modified` is not something the engine can derive. |

Appending the missing pages to `continuum-rulebook-extract.txt` is all it takes to close these —
the engine reads rules from the spec documents in this directory, not from the PDF.
