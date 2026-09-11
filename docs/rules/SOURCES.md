# Rule sources

The engine is built from these, and every rule reference in the code points at one of them.

| Source | What it covers | Where |
| --- | --- | --- |
| *Full Thrust: Project Continuum* v1.1.4, April 2017 | Sections 1–9: overview, sequence of play, cinematic movement, beam combat, threshold checks, all direct-fire weapons, ordnance, defensive systems, fighters, gunboats | `continuum-rulebook-extract.txt` |
| Full Thrust Continuum Ultimate Ship Builder v1.31 | Sections 13–14: the mass and points cost of every hull, drive, system and weapon/arc combination | `construction-tables.md` |
| Full Thrust XD Quick Reference | Core Systems effects (bridge, life support, power core) and damage control, cross-checked against the rulebook | `threshold.md`, marked `[XD]` |
| Stellar Imperium campaign rules | The strategic layer: economy, research, espionage, production | `campaign.md` |

## A known gap

`continuum-rulebook-extract.txt` is the text layer of the rulebook PDF, and it ends part-way
through section 9.2 — page 80 of 151. Everything from section 10 on is therefore **not** quoted
prose.

Section 9 is covered as far as the text goes: 9.1 in full and five gunboat types from 9.2 (Beam,
Plasma, Graser, Gatling, Needle), plus the FTL and Heavy modifications. The list is cut off after
the Needle Gunboat, so any further type is missing rather than omitted. `gunboats.md` records it.

What the rest costs, and what stands in for it:

| Section | Status |
| --- | --- |
| 10 Threshold Points | Covered: 4.11 states the threshold rules in full, and the Core Systems effects come from the XD quick reference. Two consequences the XD sheet gives timings but not effects for — what life support failure and being out of control actually cost — are judgement calls, marked `[reading]` in `threshold.md`. |
| 11 Faster Than Light | **Not implemented.** FTL fit is priced and carried on the SSD; entry and exit are out. |
| 12 Optional Rules | Partly covered — sensors and ECM from 7.18/7.19, boarding from 5.9/5.18. Vector movement (12.12) is **not implemented**. |
| 13 Ship design and construction | Covered by the construction tables, which encode every cost the section states. |
| 14 Ship construction summary | Covered — the tables *are* section 14. |
| 15 The Imperial Tech Base | **Not implemented.** No faction availability restrictions. |
| 16 Special moves | **Not implemented** (thrust-0 drives, rolling, towing, docking, ramming). |
| 17 Terrain effects | **Not implemented.** |
| 18 Battles, scenarios and CPV | Points are computed from the construction tables; fleet-composition guidance is not encoded. |

Re-extracting the missing pages and dropping them into `continuum-rulebook-extract.txt` is all it
takes to close these — the engine reads rules from spec documents, not from the PDF.
