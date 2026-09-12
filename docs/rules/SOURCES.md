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

What the rest costs, and what stands in for it:

| Section | Status |
| --- | --- |
| 10 Threshold Points | Covered: 4.11 states the threshold rules in full, and the Core Systems effects come from the XD quick reference. Two consequences the XD sheet gives timings but not effects for — what life support failure and being out of control actually cost — are judgement calls, marked `[reading]` in `threshold.md`. |
| 11 Faster Than Light | Exit implemented end to end (11.4); entry, jump gates, tugs, battleriders and hyperspace battles are implemented in `ftl.ts` and wait on a scenario to place them. |
| 12 Optional Rules | Covered from the section itself now: sensors and ECM, boarding combat (12.7), fleet morale, striking the colors and civil wars. |
| 13 Ship design and construction | Covered, and now checked against the section itself rather than only the spreadsheet. |
| 14 Ship construction summary | Covered and verified. Every price the catalogue already carried matches 14.1–14.8 exactly — hulls, drives, screens, armour, every direct-fire weapon, ordnance, fighters and gunboats. What the checking found was omissions, not errors: eighteen weapon classes the engine could resolve but nobody could buy, eleven gunboat types, and one real bug, the stealth hull sold at a flat 2 points where 14.1 charges 2 *per hull and armour box*. |
| 15 The Imperial Tech Base | Tables and the availability predicate in `techbase.ts`, tested, and now folded over a fleet by `src/data/techBaseCheck.ts`. A side picks a base at setup, the fleet picker marks the hulls it could not have built, the shipyard says the same about the design on the bench, and the choice rides in the battle file. Advisory rather than enforced, for a reason worth recording: **neither of 15.2's example factions buys armour**, and every design in the roster carries a layer of it, so a hard error would refuse every fleet in the game. |
| 16 Special moves | Implemented and tested in `specialmoves.ts`. Ramming and rolling are wired end to end — a roll is written in the order, costs its thrust point out of the turning allowance, and mirrors every arc the ship fires through, the computer's included. Towing, docking, disengaging and the moving table are resolvers waiting on a phase to call them. |
| 17 Terrain effects | Implemented and tested in `terrain.ts`. Wired: line of fire (17.1), collisions with a solid body (17.6), dust and nebula speed damage (17.2 rule 1) and meteor fields (17.4) — all behind the `terrainHazards` setup flag, because section 17 calls itself *"mostly pure space opera"* and because every hazard draws a die, which would shift the RNG stream of every battle file saved before it existed. Still waiting on a phase: cloud lock-on, battle debris, solar flares, gravity wells, orbits and atmospheric entry. |
| 18 Battles, scenarios and CPV | 18.1's deployment is wired: a battle type picked at setup replaces the scenario's written positions with a deployment step — 4.12's die for who places first, then alternating placement inside a zone drawn on the map, with the defender's one terrain feature in an offensive/defensive battle. The computer deploys its own fleet. CPV and the tournament list checks in `battles.ts` are still library-only; the fleet picker's composition bar is a lookalike that buckets by the declared hull group rather than by mass and counts no embarked fighters. |

Appending the missing pages to `continuum-rulebook-extract.txt` is all it takes to close these —
the engine reads rules from the spec documents in this directory, not from the PDF.
