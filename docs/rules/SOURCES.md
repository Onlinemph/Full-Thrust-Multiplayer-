# Rule sources

The engine is built from these, and every rule reference in the code points at one of them.

| Source | What it covers | Where |
| --- | --- | --- |
| *Full Thrust: Project Continuum* v1.1.4, April 2017 | Sections 1–9: overview, sequence of play, cinematic movement, beam combat, threshold checks, all direct-fire weapons, ordnance, defensive systems, fighters, gunboats | `continuum-rulebook-extract.txt` |
| Full Thrust Continuum Ultimate Ship Builder v1.31 | Sections 13–14: the mass and points cost of every hull, drive, system and weapon/arc combination | `construction-tables.md` |
| Full Thrust XD Quick Reference | Core Systems effects (bridge, life support, power core) and damage control, cross-checked against the rulebook | `threshold.md`, marked `[XD]` |
| Stellar Imperium campaign rules | The strategic layer: economy, research, espionage, production | `campaign.md` |

## A known gap

`continuum-rulebook-extract.txt` stops part-way through section 9.2 — page 81 of 151 — and
everything from section 10 on is therefore **not** quoted prose.

**The rulebook is not the problem.** The extract stops because the Google Drive connector that
produced it caps its PDF text extraction at roughly 270,000 characters, and this book is about
twice that. Measured, not guessed:

| Document in the same Drive | File size | Characters returned | Ends |
| --- | --- | --- | --- |
| *Project Continuum* | 13.5 MB | 276,641 | mid-list, page 81 |
| *Squadron Strike 2e* | 21 MB | 268,299 | mid-sentence |
| *Interceptor 2e* | 15.6 MB | 183,077 | at its own copyright notice — complete |

Two long books stop within 3% of each other and a shorter one comes through whole, so the ceiling
is the connector's, not any document's. The connector returns the same capped text however it is
asked: `read_file_content` and a `fullText` search snippet return byte-identical output, so a
targeted search cannot reach past it either. Direct download is refused above 10 MB (this file is
13.5 MB) and `drive.google.com` is blocked by the environment's network egress policy, so there is
no way round it from inside a session.

**What would close the gap**, in order of reliability:

1. **Split the PDF** — pages 1–80 and 81–151 as two files in Drive. Each half is under the
   character ceiling and extracts in full. Shrinking the file on its own does *not* help: the cap
   counts extracted characters, not megabytes, so a "text only" re-save of the same 151 pages
   truncates in exactly the same place.
2. **Paste sections 10–22 into a Google Doc** (or two). A document under the ceiling reads whole.
3. **Drop a text file into `docs/rules/`** — the engine is written against the spec documents in
   this directory, not against the PDF, so a `continuum-81-151.txt` committed to the repository is
   all the engine ever needed.

Roughly 70 of 151 pages are behind that ceiling. Until they are through, what they contain is
recorded below as not implemented rather than guessed at.

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

Appending the missing pages to `continuum-rulebook-extract.txt` is all it takes to close these —
the engine reads rules from the spec documents in this directory, not from the PDF.
