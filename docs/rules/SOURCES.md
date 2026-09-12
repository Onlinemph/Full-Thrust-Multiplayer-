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
| 11 Faster Than Light | **Not implemented.** FTL fit is priced and carried on the SSD; entry and exit are out. |
| 12 Optional Rules | Covered from the section itself now: sensors and ECM, boarding combat (12.7), fleet morale, striking the colors and civil wars. |
| 13 Ship design and construction | Covered by the construction tables, which encode every cost the section states. |
| 14 Ship construction summary | Covered — the tables *are* section 14. |
| 15 The Imperial Tech Base | **Not implemented.** No faction availability restrictions. |
| 16 Special moves | **Not implemented** (thrust-0 drives, rolling, towing, docking, ramming). |
| 17 Terrain effects | **Not implemented.** |
| 18 Battles, scenarios and CPV | Points are computed from the construction tables; fleet-composition guidance is not encoded. |

Appending the missing pages to `continuum-rulebook-extract.txt` is all it takes to close these —
the engine reads rules from the spec documents in this directory, not from the PDF.
